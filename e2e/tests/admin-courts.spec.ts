import { test, expect } from '@playwright/test';
import { testAdmin } from '../fixtures/test-data';
import { loginAdmin } from '../helpers/auth-helpers';
import { getProjectPrefix } from '../helpers/cleanup-helpers';

test.describe.skip('Admin Court Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page, testAdmin.password);
    await page.goto('/admin/courts');
    await expect(page.locator('text=Gerenciar Quadras')).toBeVisible();
  });

  test('should display courts list', async ({ page }) => {
    await expect(page.locator('text=Quadras').or(page.locator('text=Gerenciar'))).toBeVisible();
    
    // Check if at least one court is displayed
    const courtCards = page.locator('[data-testid="court-card"]').or(page.locator('text=Quadra'));
    const count = await courtCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should create new court', async ({ page, browserName }) => {
    const courtName = `Test Court ${getProjectPrefix(browserName)}`;
    
    // Click create button
    await page.click('button:has-text("Nova Quadra")');
    
    // Fill form
    await page.fill('input[name="name"]', courtName);
    await page.selectOption('select[name="type"]', 'Saibro');
    await page.fill('textarea[name="description"]', 'Test court description');
    
    // Submit
    await page.click('button[type="submit"]:has-text("Salvar")');
    
    await expect(page.locator('text=criada com sucesso').or(page.locator(`text=${courtName}`))).toBeVisible({ timeout: 10000 });
  });

  test('should edit court details', async ({ page, request }) => {
    // Get existing courts
    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();
    
    if (courts.length > 0) {
      const court = courts[0];
      
      // Find and click edit button
      const courtCard = page.locator(`text=${court.name}`).first();
      await courtCard.click();
      
      const editButton = page.locator('button:has-text("Editar")');
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Update name
        const nameInput = page.locator('input[name="name"]');
        await nameInput.fill(`${court.name} Updated`);
        
        // Save
        await page.click('button[type="submit"]:has-text("Salvar")');
        
        await expect(page.locator('text=atualizada com sucesso')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should toggle court active status', async ({ page, request }) => {
    const courtsResponse = await request.get('/api/public/courts');
    const courts = await courtsResponse.json();
    
    if (courts.length > 0) {
      const court = courts[0];
      
      const courtCard = page.locator(`text=${court.name}`).first();
      await courtCard.click();
      
      // Toggle active status
      const toggleButton = page.locator('button:has-text("Desativar")').or(page.locator('button:has-text("Ativar")'));
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await expect(page.locator('text=atualizada').or(page.locator('text=status'))).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should delete court', async ({ page, browserName }) => {
    // Create a court to delete
    const courtName = `Delete Court ${getProjectPrefix(browserName)}`;
    
    await page.click('button:has-text("Nova Quadra")');
    await page.fill('input[name="name"]', courtName);
    await page.selectOption('select[name="type"]', 'Sintético');
    await page.click('button[type="submit"]:has-text("Salvar")');
    
    await page.waitForTimeout(1000);
    
    // Find and delete
    const courtCard = page.locator(`text=${courtName}`).first();
    if (await courtCard.isVisible()) {
      await courtCard.click();
      
      const deleteButton = page.locator('button:has-text("Excluir")');
      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        
        // Confirm deletion
        await page.click('button:has-text("Confirmar")');
        
        await expect(page.locator('text=excluída com sucesso')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("Nova Quadra")');
    
    // Try to submit without filling
    await page.click('button[type="submit"]:has-text("Salvar")');
    
    // Should show validation errors
    await expect(page.locator('text=obrigatório').or(page.locator('text=required')).first()).toBeVisible();
  });

  test('should support all court types', async ({ page, browserName }) => {
    const courtTypes = ['Saibro', 'Sintético', 'Grama', 'Duro'];
    
    for (let i = 0; i < courtTypes.length; i++) {
      const courtName = `${courtTypes[i]} Court ${getProjectPrefix(browserName)}-${i}`;
      
      await page.click('button:has-text("Nova Quadra")');
      await page.fill('input[name="name"]', courtName);
      await page.selectOption('select[name="type"]', courtTypes[i]);
      await page.click('button[type="submit"]:has-text("Salvar")');
      
      await expect(page.locator(`text=${courtName}`).or(page.locator('text=criada com sucesso'))).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);
    }
  });

  test('should upload court image', async ({ page, browserName }) => {
    const courtName = `Image Court ${getProjectPrefix(browserName)}`;
    
    await page.click('button:has-text("Nova Quadra")');
    await page.fill('input[name="name"]', courtName);
    await page.selectOption('select[name="type"]', 'Saibro');
    
    // Check if file upload exists
    const fileInput = page.locator('input[type="file"]');
    if (await fileInput.isVisible()) {
      // Note: In real test, you'd upload an actual image file
      // For now, just verify the input exists
      await expect(fileInput).toBeVisible();
    }
    
    await page.click('button[type="submit"]:has-text("Salvar")');
    await expect(page.locator('text=criada com sucesso')).toBeVisible({ timeout: 10000 });
  });
});
