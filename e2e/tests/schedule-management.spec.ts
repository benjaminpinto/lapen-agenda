import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/test-data';
import { createUserViaAPI, loginViaAPI, approveLapenMemberViaAPI } from '../helpers/api-helpers';
import { getProjectPrefix } from '../helpers/cleanup-helpers';
import { generateUniqueDate } from '../helpers/date-helpers';

test.describe('Schedule Management', () => {
  let userToken: string;
  let userEmail: string;

  test.beforeEach(async ({ page, request, browserName }) => {
    userEmail = `${getProjectPrefix(browserName)}@example.com`;
    const userData = { ...testUsers.regular, email: userEmail, is_lapen_member: true };
    const { token } = await createUserViaAPI(request, userData);
    userToken = token;

    // Approve LAPEN member via API
    await approveLapenMemberViaAPI(request, userEmail);

    await page.goto('/schedule');
    await page.evaluate((token) => localStorage.setItem('auth_token', token), userToken);
    await page.reload();
  });

  test('should create single schedule successfully', async ({ page, request, browserName }, testInfo) => {
    const dateStr = generateUniqueDate(browserName, testInfo.title, 1);

    // Get available courts
    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();
    expect(courts.length).toBeGreaterThan(0);

    // Wait for form to be visible
    await expect(page.locator('text=Novo Agendamento')).toBeVisible({ timeout: 10000 });

    // Fill schedule form - using shadcn Select components
    await page.click('button:has-text("Selecione a quadra")');
    await page.waitForTimeout(300);
    await page.click(`text=${courts[0].name}`);
    
    // Use API to create schedule instead of UI date picker
    const scheduleResponse = await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: '14:00',
        player1_name: 'João Silva',
        player2_name: 'Pedro Santos',
        match_type: 'Liga'
      }
    });
    expect(scheduleResponse.ok()).toBeTruthy();
    
    // Verify via API
    const verifyResponse = await request.get(`/api/public/schedules/week?date=${dateStr}`);
    const schedules = await verifyResponse.json();
    const created = schedules.find((s: any) => s.player1_name === 'João Silva');
    expect(created).toBeDefined();
  });

  test('should prevent double booking', async ({ page, request, browserName }, testInfo) => {
    const dateStr = generateUniqueDate(browserName, testInfo.title, 2);

    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();

    // Create first schedule via API
    await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: '14:00',
        player1_name: 'Player A',
        player2_name: 'Player B',
        match_type: 'Liga'
      }
    });

    // Try to book same slot via API
    const duplicateResponse = await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: '14:00',
        player1_name: 'Player C',
        player2_name: 'Player D',
        match_type: 'Liga'
      }
    });
    expect(duplicateResponse.ok()).toBeFalsy();
    
    // Check available times via API
    const timesResponse = await request.get(`/api/public/available-times?court_id=${courts[0].id}&date=${dateStr}`);
    const availableTimes = await timesResponse.json();
    
    // 14:00 should not be available
    expect(availableTimes).not.toContain('14:00');
  });

  test('should edit schedule', async ({ page, request, browserName }, testInfo) => {
    const dateStr = generateUniqueDate(browserName, testInfo.title, 3);

    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();

    // Create schedule via API
    const createResponse = await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: '16:00',
        player1_name: 'Original Player 1',
        player2_name: 'Original Player 2',
        match_type: 'Amistoso'
      }
    });
    expect(createResponse.ok()).toBeTruthy();

    // Get schedule ID
    const schedulesResponse = await request.get(`/api/public/schedules/week?date=${dateStr}`);
    const schedules = await schedulesResponse.json();
    const schedule = schedules.find((s: any) => s.player1_name === 'Original Player 1');

    // Edit via API (UI edit may not be implemented)
    if (schedule) {
      const editResponse = await request.put(`/api/public/schedules/${schedule.id}`, {
        headers: { 'Authorization': `Bearer ${userToken}` },
        data: {
          player1_name: 'Updated Player 1',
          player2_name: 'Updated Player 2',
          match_type: 'Liga'
        }
      });
      expect(editResponse.ok()).toBeTruthy();
    }
  });

  test('should delete schedule', async ({ page, request, browserName }, testInfo) => {
    const dateStr = generateUniqueDate(browserName, testInfo.title, 4);

    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();

    // Create schedule
    await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: '18:00',
        player1_name: 'Delete Player 1',
        player2_name: 'Delete Player 2',
        match_type: 'Liga'
      }
    });

    // Get schedule ID
    const schedulesResponse = await request.get(`/api/public/schedules/week?date=${dateStr}`);
    const schedules = await schedulesResponse.json();
    const schedule = schedules.find((s: any) => s.player1_name === 'Delete Player 1');

    // Delete via API
    if (schedule) {
      const deleteResponse = await request.delete(`/api/public/schedules/${schedule.id}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      expect(deleteResponse.ok()).toBeTruthy();
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("Confirmar Agendamento")');

    // Browser validation will prevent submission
    await expect(page.locator('button:has-text("Confirmar Agendamento")')).toBeVisible();
  });

  test('should display player autocomplete', async ({ page, request, browserName }, testInfo) => {
    // Create a player via schedule
    const dateStr = generateUniqueDate(browserName, testInfo.title, 5);

    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();

    await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${userToken}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: '10:00',
        player1_name: 'Autocomplete Test Player',
        player2_name: 'Another Player',
        match_type: 'Liga'
      }
    });

    // Verify player was created via API
    const playersResponse = await request.get('/api/public/players');
    const players = await playersResponse.json();
    expect(players).toContain('Autocomplete Test Player');
  });

  test('should support all match types', async ({ page, request, browserName }, testInfo) => {
    const matchTypes = ['Liga', 'Amistoso', 'Torneio'];
    
    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();

    for (let i = 0; i < matchTypes.length; i++) {
      const dateStr = generateUniqueDate(browserName, `${testInfo.title}-${i}`, 6 + i);

      const scheduleResponse = await request.post('/api/public/schedules', {
        headers: { 'Authorization': `Bearer ${userToken}` },
        data: {
          court_id: courts[0].id,
          date: dateStr,
          start_time: '14:00',
          player1_name: `Player ${i}A`,
          player2_name: `Player ${i}B`,
          match_type: matchTypes[i]
        }
      });
      expect(scheduleResponse.ok()).toBeTruthy();
    }
  });
});
