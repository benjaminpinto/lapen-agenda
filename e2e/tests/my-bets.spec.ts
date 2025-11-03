import {expect, test} from '@playwright/test';
import {testUsers} from '../fixtures/test-data';
import {createUserViaAPI} from '../helpers/api-helpers';
import {cleanupTestData, getProjectPrefix} from '../helpers/cleanup-helpers';

test.describe('My Bets Page', () => {
    test('should display my bets page when authenticated', async ({page, request, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};
        const {token} = await createUserViaAPI(request, userData);

        await page.goto('/my-bets');
        await page.evaluate((token) => localStorage.setItem('auth_token', token), token);
        
        const meResponse = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/me')),
            page.reload()
        ]);
        
        await expect(meResponse[0].status()).toBe(200);
        await expect(page.getByTestId('my-bets-page')).toBeVisible({timeout: 10000});
        await expect(page.locator('h1:has-text("Minhas Apostas")')).toBeVisible();
    });

    test('should show empty state when no bets', async ({page, request, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};
        const {token} = await createUserViaAPI(request, userData);

        await page.goto('/my-bets');
        await page.evaluate((token) => localStorage.setItem('auth_token', token), token);
        
        const meResponse = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/me')),
            page.reload()
        ]);
        
        await expect(meResponse[0].status()).toBe(200);
        await expect(page.getByTestId('empty-bets')).toBeVisible({timeout: 10000});
    });

    test('should navigate back to betting dashboard', async ({page, request, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};
        const {token} = await createUserViaAPI(request, userData);

        await page.goto('/my-bets');
        await page.evaluate((token) => localStorage.setItem('auth_token', token), token);
        
        const meResponse = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/me')),
            page.reload()
        ]);
        
        await expect(meResponse[0].status()).toBe(200);
        await page.getByTestId('back-to-betting').click();
        await page.waitForURL('/betting', {timeout: 15000});
    });

    test('should require authentication', async ({page}) => {
        await page.goto('/my-bets');
        await expect(page.locator('text=Login Necessário')).toBeVisible();
    });
});
