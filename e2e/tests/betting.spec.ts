import {expect, test} from '@playwright/test';
import {testUsers} from '../fixtures/test-data';
import {createUserViaAPI} from '../helpers/api-helpers';
import {getProjectPrefix} from '../helpers/cleanup-helpers';

test.describe('Betting System', () => {
    test('should display betting page', async ({page}) => {
        await page.goto('/betting');
        await expect(page.locator('h1:has-text("Tigrinho LAPEN 🐯")')).toBeVisible();
    });

    test('should show login prompt for unauthenticated users', async ({page}) => {
        await page.goto('/betting');
        await expect(page.locator('text=Você precisa estar logado')).toBeVisible();
        await expect(page.getByTestId('login-link')).toBeVisible();
    });

    test('should display betting form when authenticated', async ({page, request, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};
        const {token} = await createUserViaAPI(request, userData);

        await page.goto('/betting');
        await page.evaluate((token) => localStorage.setItem('auth_token', token), token);

        const [meResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/me')),
            page.reload()
        ]);
        
        await expect(meResponse.status()).toBe(200);
        await expect(page.getByTestId('betting-form')).toBeVisible({timeout: 10000});
    });

    test('should navigate to my bets page', async ({page, request, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};
        const {token} = await createUserViaAPI(request, userData);

        await page.goto('/betting');
        await page.evaluate((token) => localStorage.setItem('auth_token', token), token);

        const [meResponse] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/me')),
            page.reload()
        ]);
        
        await expect(meResponse.status()).toBe(200);
        await page.getByTestId('my-bets-button').click();
        await page.waitForURL('/my-bets', {timeout: 15000});
    });

    test('should display sections', async ({page}) => {
        await page.goto('/betting');
        await expect(page.locator('h1:has-text("Tigrinho LAPEN")').first()).toBeVisible();
    });
});
