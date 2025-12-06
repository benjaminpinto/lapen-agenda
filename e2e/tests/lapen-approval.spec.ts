import { test, expect } from '@playwright/test';
import { testAdmin, testUsers } from '../fixtures/test-data';
import { loginAdmin } from '../helpers/auth-helpers';
import { createUserViaAPI, approveLapenMemberViaAPI } from '../helpers/api-helpers';
import { getProjectPrefix } from '../helpers/cleanup-helpers';

test.describe.skip('LAPEN Member Approval Workflow', () => {
  test('should display pending approvals', async ({ page, request, browserName }) => {
    // Create LAPEN member
    const userEmail = `${getProjectPrefix(browserName)}@example.com`;
    const userData = { ...testUsers.lapenMember, email: userEmail };
    await createUserViaAPI(request, userData);

    // Login as admin
    await loginAdmin(page, testAdmin.password);
    await page.goto('/admin/lapen-approvals');
    
    await expect(page.locator('text=Aprovações de Membros LAPEN')).toBeVisible();
    await expect(page.locator(`text=${userEmail}`).or(page.locator(`text=${userData.name}`))).toBeVisible();
  });

  test('should approve LAPEN member', async ({ page, request, browserName }) => {
    const userEmail = `${getProjectPrefix(browserName)}@example.com`;
    const userData = { ...testUsers.lapenMember, email: userEmail };
    await createUserViaAPI(request, userData);

    await loginAdmin(page, testAdmin.password);
    await page.goto('/admin/lapen-approvals');
    
    // Find user and approve
    const userRow = page.locator(`text=${userEmail}`).first();
    await userRow.click();
    
    await page.click('button:has-text("Aprovar")');
    
    await expect(page.locator('text=aprovado com sucesso')).toBeVisible({ timeout: 10000 });
  });

  test('should reject LAPEN member', async ({ page, request, browserName }) => {
    const userEmail = `${getProjectPrefix(browserName)}-reject@example.com`;
    const userData = { ...testUsers.lapenMember, email: userEmail };
    await createUserViaAPI(request, userData);

    await loginAdmin(page, testAdmin.password);
    await page.goto('/admin/lapen-approvals');
    
    const userRow = page.locator(`text=${userEmail}`).first();
    await userRow.click();
    
    await page.click('button:has-text("Rejeitar")');
    
    // Confirm rejection
    await page.click('button:has-text("Confirmar")');
    
    await expect(page.locator('text=rejeitado').or(page.locator('text=recusado'))).toBeVisible({ timeout: 10000 });
  });

  test('should allow approved member to login', async ({ page, request, browserName }) => {
    const userEmail = `${getProjectPrefix(browserName)}@example.com`;
    const userData = { ...testUsers.lapenMember, email: userEmail };
    const { token } = await createUserViaAPI(request, userData);

    // Approve via API
    await approveLapenMemberViaAPI(request, userEmail);

    // Try to login
    await page.goto('/login');
    await page.fill('input[name="email"]', userEmail);
    await page.fill('input[name="password"]', userData.password);
    await page.click('button[type="submit"]');

    await page.waitForURL('/');
    
    // Open mobile menu to see user greeting
    const menuButton = page.locator('button:has(svg.lucide-menu)');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300);
    }

    await expect(page.locator('text=Olá').last()).toBeVisible();
  });

  test('should prevent unapproved member from scheduling', async ({ page, request, browserName }) => {
    const userEmail = `${getProjectPrefix(browserName)}@example.com`;
    const userData = { ...testUsers.lapenMember, email: userEmail };
    const { token } = await createUserViaAPI(request, userData);

    // Try to create schedule without approval
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const dateStr = futureDate.toISOString().split('T')[0];

    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();

    const scheduleResponse = await request.post('/api/public/schedules', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        court_id: courts[0].id,
        date: dateStr,
        start_time: '14:00',
        player1_name: 'Player 1',
        player2_name: 'Player 2',
        match_type: 'Liga'
      }
    });

    expect(scheduleResponse.status()).toBe(403);
  });

  test('should show approval status in admin panel', async ({ page, request, browserName }) => {
    // Create approved and pending members
    const approvedEmail = `${getProjectPrefix(browserName)}-approved@example.com`;
    const pendingEmail = `${getProjectPrefix(browserName)}-pending@example.com`;
    
    await createUserViaAPI(request, { ...testUsers.lapenMember, email: approvedEmail });
    await createUserViaAPI(request, { ...testUsers.lapenMember, email: pendingEmail });

    // Approve first one
    await approveLapenMemberViaAPI(request, approvedEmail);

    await loginAdmin(page, testAdmin.password);
    await page.goto('/admin/lapen-approvals');
    
    // Check statuses
    await expect(page.locator(`text=${pendingEmail}`)).toBeVisible();
    
    // Approved member should not be in pending list
    const approvedRow = page.locator(`text=${approvedEmail}`);
    const isVisible = await approvedRow.isVisible();
    expect(isVisible).toBeFalsy();
  });

  test('should filter by approval status', async ({ page }) => {
    await loginAdmin(page, testAdmin.password);
    await page.goto('/admin/lapen-approvals');
    
    await expect(page.locator('text=Aprovações de Membros LAPEN')).toBeVisible();
    
    // Check if filter exists
    const filterSelect = page.locator('select[name="status"]').or(page.locator('button:has-text("Filtrar")'));
    if (await filterSelect.isVisible()) {
      await filterSelect.click();
    }
  });

  test('should view approval history', async ({ page, request, browserName }) => {
    const userEmail = `${getProjectPrefix(browserName)}@example.com`;
    const userData = { ...testUsers.lapenMember, email: userEmail };
    await createUserViaAPI(request, userData);

    // Approve
    await approveLapenMemberViaAPI(request, userEmail);

    await loginAdmin(page, testAdmin.password);
    await page.goto('/admin/lapen-approvals');
    
    // Check for history tab or section
    const historyTab = page.locator('button:has-text("Histórico")').or(page.locator('a:has-text("Histórico")'));
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await expect(page.locator(`text=${userEmail}`)).toBeVisible();
    }
  });
});
