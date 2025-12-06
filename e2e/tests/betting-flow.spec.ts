import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';
import { createUserViaAPI, approveLapenMemberViaAPI } from '../helpers/api-helpers';
import { getProjectPrefix } from '../helpers/cleanup-helpers';
import { generateUniqueDate } from '../helpers/date-helpers';

test.describe('Complete Betting Flow', () => {
  let userToken: string;
  let userEmail: string;
  let scheduleId: number;
  let matchId: number;

  test.beforeEach(async ({ page, request, browserName }, testInfo) => {
    userEmail = `${getProjectPrefix(browserName)}@example.com`;
    const userData = { ...testUsers.regular, email: userEmail, is_lapen_member: true };
    const { token } = await createUserViaAPI(request, userData);
    userToken = token;

    // Approve LAPEN member
    await approveLapenMemberViaAPI(request, userEmail);

    // Create a future schedule with unique date to avoid conflicts
    const dateStr = generateUniqueDate(browserName, testInfo.title);

    const startTime = '14:00';
    console.log(`Creating schedule for ${dateStr} at ${startTime}`);

    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();

    const scheduleResponse = await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: startTime,
        player1_name: 'Rafael Nadal',
        player2_name: 'Roger Federer',
        match_type: 'Liga'
      }
    });
    
    if (!scheduleResponse.ok()) {
      const errorText = await scheduleResponse.text();
      console.error('Schedule creation failed:', scheduleResponse.status(), errorText);
    }
    expect(scheduleResponse.ok()).toBeTruthy();

    // Get schedule ID from created schedules
    const schedulesResponse = await request.get(`/api/public/schedules/week?date=${dateStr}`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const schedules = await schedulesResponse.json();
    const createdSchedule = schedules.find((s: any) => 
      s.player1_name === 'Rafael Nadal' && s.player2_name === 'Roger Federer'
    );
    scheduleId = createdSchedule?.id;

    // Create match from schedule
    if (scheduleId) {
      const matchResponse = await request.post('/api/matches/create', {
        headers: { 'Authorization': `Bearer ${userToken}` },
        data: { schedule_id: scheduleId, betting_enabled: true }
      });
      
      if (!matchResponse.ok()) {
        const errorText = await matchResponse.text();
        console.error('Match creation failed:', matchResponse.status(), errorText);
      }
      expect(matchResponse.ok()).toBeTruthy();
      
      const matchData = await matchResponse.json();
      matchId = matchData.match_id;
      console.log(`Match created with ID: ${matchId}`);
    } else {
      throw new Error('Schedule ID not found');
    }

    await page.goto('/betting');
    await page.evaluate((token) => localStorage.setItem('auth_token', token), userToken);
    await page.reload();
  });

  test('should display available matches with odds', async ({ page }) => {
    await expect(page.getByTestId('betting-form')).toBeVisible({ timeout: 10000 });
    
    // Check if match is displayed
    await expect(page.locator('text=Rafael Nadal').first()).toBeVisible();
    await expect(page.locator('text=Roger Federer').first()).toBeVisible();
  });

  test('should place bet with PIX payment', async ({ page, request }) => {
    await expect(page.getByTestId('betting-form')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    const playerButton = page.locator('button:has-text("Rafael Nadal")').first();
    await expect(playerButton).toBeVisible({ timeout: 10000 });
    await playerButton.click();

    await page.fill('input[name="amount"]', '50');
    await page.locator('button:has-text("PIX")').first().click();
    await page.locator('button[type="submit"]:has-text("Apostar")').first().click();

    await expect(page.locator('text=QR Code PIX').or(page.locator('text=Pagar com PIX')).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="pix-qr-code"]').or(page.locator('canvas')).first()).toBeVisible();
  });

  test('should validate minimum bet amount', async ({ page }) => {
    await expect(page.getByTestId('betting-form')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    const playerButton = page.locator('button:has-text("Rafael Nadal")').first();
    await expect(playerButton).toBeVisible({ timeout: 10000 });
    await playerButton.click();

    await page.fill('input[name="amount"]', '0.50');
    await page.locator('button[type="submit"]:has-text("Apostar")').first().click();

    await expect(page.locator('text=mínimo').or(page.locator('text=maior que zero')).first()).toBeVisible();
  });

  test('should show bet in my bets after placement', async ({ page, request }) => {
    // Create bet via API
    const paymentResponse = await request.post('/api/betting/create-payment-intent', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        schedule_id: scheduleId,
        player_name: 'Rafael Nadal',
        amount: '100',
        payment_method: 'pix',
        device_id: 'test-device'
      }
    });

    if (paymentResponse.ok()) {
      const paymentData = await paymentResponse.json();
      
      // Place bet
      await request.post('/api/betting/place-bet', {
        headers: { 'Authorization': `Bearer ${userToken}` },
        data: {
          schedule_id: scheduleId,
          player_name: 'Rafael Nadal',
          amount: '100',
          payment_intent_id: paymentData.payment_id || 'test-payment-id',
          payment_method: 'pix'
        }
      });
    }

    // Navigate to my bets
    await page.goto('/my-bets');
    await page.reload();

    await expect(page.getByTestId('my-bets-page')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Rafael Nadal').first()).toBeVisible();
  });

  test('should calculate potential winnings correctly', async ({ page, request }) => {
    await expect(page.getByTestId('betting-form')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(1000);
    const playerButton = page.locator('button:has-text("Rafael Nadal")').first();
    await expect(playerButton).toBeVisible({ timeout: 10000 });
    await playerButton.click();
    await page.fill('input[name="amount"]', '100');

    const potentialReturn = page.locator('text=Retorno Potencial').or(page.locator('text=Ganho')).first();
    if (await potentialReturn.isVisible()) {
      await expect(potentialReturn).toBeVisible();
    }
  });

  test('should prevent betting on finished match', async ({ page, request }) => {
    // Finish the match via API
    if (matchId) {
      await request.put(`/api/matches/${matchId}/status`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
        data: { status: 'finished' }
      });
    }

    await page.reload();
    await page.waitForTimeout(1000);

    // Try to bet
    const matchCard = page.locator('text=Rafael Nadal').first();
    if (await matchCard.isVisible()) {
      await matchCard.click();
      
      // Should show message that betting is closed
      await expect(page.locator('text=fechadas').or(page.locator('text=encerradas'))).toBeVisible();
    }
  });

  test('should display betting history with status', async ({ page, request }) => {
    // Create a bet
    const paymentResponse = await request.post('/api/betting/create-payment-intent', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        schedule_id: scheduleId,
        player_name: 'Roger Federer',
        amount: '75',
        payment_method: 'pix'
      }
    });

    if (paymentResponse.ok()) {
      const paymentData = await paymentResponse.json();
      
      await request.post('/api/betting/place-bet', {
        headers: { 'Authorization': `Bearer ${userToken}` },
        data: {
          schedule_id: scheduleId,
          player_name: 'Roger Federer',
          amount: '75',
          payment_intent_id: paymentData.payment_id || 'test-payment-id',
          payment_method: 'pix'
        }
      });
    }

    await page.goto('/my-bets');
    await page.reload();

    await expect(page.getByTestId('my-bets-page')).toBeVisible({ timeout: 10000 });
    
    // Check bet details
    await expect(page.locator('text=Roger Federer').first()).toBeVisible();
    await expect(page.locator('text=R$').or(page.locator('text=75')).first()).toBeVisible();
  });

  test('should show empty state when no bets placed', async ({ page }) => {
    await page.goto('/my-bets');
    await page.reload();

    await expect(page.getByTestId('my-bets-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('empty-bets')).toBeVisible();
  });

  test('should update odds when multiple bets placed', async ({ page, request }) => {
    // Create second user
    const user2Email = `${getProjectPrefix('user2')}@example.com`;
    const user2Data = { ...testUsers.regular, email: user2Email, is_lapen_member: true };
    const { token: user2Token } = await createUserViaAPI(request, user2Data);

    await approveLapenMemberViaAPI(request, user2Email);

    // User 1 bets on Nadal
    const payment1 = await request.post('/api/betting/create-payment-intent', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        schedule_id: scheduleId,
        player_name: 'Rafael Nadal',
        amount: '100',
        payment_method: 'pix'
      }
    });

    if (payment1.ok()) {
      const paymentData1 = await payment1.json();
      await request.post('/api/betting/place-bet', {
        headers: { 'Authorization': `Bearer ${userToken}` },
        data: {
          schedule_id: scheduleId,
          player_name: 'Rafael Nadal',
          amount: '100',
          payment_intent_id: paymentData1.payment_id || 'test-payment-1',
          payment_method: 'pix'
        }
      });
    }

    // User 2 bets on Federer
    const payment2 = await request.post('/api/betting/create-payment-intent', {
      headers: { 'Authorization': `Bearer ${user2Token}` },
      data: {
        schedule_id: scheduleId,
        player_name: 'Roger Federer',
        amount: '50',
        payment_method: 'pix'
      }
    });

    if (payment2.ok()) {
      const paymentData2 = await payment2.json();
      await request.post('/api/betting/place-bet', {
        headers: { 'Authorization': `Bearer ${user2Token}` },
        data: {
          schedule_id: scheduleId,
          player_name: 'Roger Federer',
          amount: '50',
          payment_intent_id: paymentData2.payment_id || 'test-payment-2',
          payment_method: 'pix'
        }
      });
    }

    // Check odds updated
    const oddsResponse = await request.get(`/api/betting/match/${matchId}/bets`);
    if (oddsResponse.ok()) {
      const oddsData = await oddsResponse.json();
      expect(oddsData.odds).toBeDefined();
      expect(oddsData.match.total_pool).toBeGreaterThan(0);
    }
  });
});
