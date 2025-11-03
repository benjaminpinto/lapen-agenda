import {expect, test} from '@playwright/test';
import {testUsers} from '../fixtures/test-data';
import {loginUser, logout, registerUser} from '../helpers/auth-helpers';
import {getProjectPrefix} from '../helpers/cleanup-helpers';

test.describe('Authentication', () => {
    test('should register new user successfully', async ({page, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};

        await registerUser(page, userData);
        await expect(page).toHaveURL('/signup-success');
        await expect(page.locator('text=Conta Criada!')).toBeVisible();
    });

    test('should show error for duplicate email', async ({page, request, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail, is_lapen_member: false};

        // Create user via API to ensure it exists
        const createResponse = await request.post('/api/auth/register', {
            data: userData
        });
        expect(createResponse.ok()).toBeTruthy();

        // Try to register again with same email via UI
        await page.goto('/signup');
        await page.fill('input[name="name"]', userData.name);
        await page.fill('input[name="email"]', userData.email);
        await page.fill('input[name="phone"]', userData.phone);
        await page.fill('input[name="pix_key"]', userData.pix_key);
        await page.fill('input[name="password"]', userData.password);
        await page.fill('input[name="confirmPassword"]', userData.password);

        const [response] = await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/register')),
            page.click('button[type="submit"]')
        ]);

        // Check if the response was actually an error
        expect(response.status()).toBe(400);

        // Wait for error message to appear
        await expect(page.locator('text=Email já cadastrado')).toBeVisible({timeout: 10000});
    });

    test('should login with valid credentials', async ({page, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};

        await registerUser(page, userData);

        await page.goto('/login');
        await page.fill('input[name="email"]', userData.email);
        await page.fill('input[name="password"]', userData.password);

        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/login')),
            page.click('button[type="submit"]')
        ]);

        await page.waitForURL('/');

        // Open mobile menu to see user greeting
        const menuButton = page.locator('button:has(svg.lucide-menu)');
        if (await menuButton.isVisible()) {
            await menuButton.click();
            await page.waitForTimeout(300);
        }

        await expect(page.locator('text=Olá').last()).toBeVisible();
    });

    test('should show error for invalid credentials', async ({page}) => {
        await page.goto('/login');
        await page.fill('input[name="email"]', 'invalid@example.com');
        await page.fill('input[name="password"]', 'wrongpassword');

        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/auth/login')),
            page.click('button[type="submit"]')
        ]);

        await expect(page.locator('text=Email ou senha inválidos')).toBeVisible();
    });

    test('should logout successfully', async ({page, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};

        await registerUser(page, userData);
        await loginUser(page, userData.email, userData.password);
        await logout(page);

        await expect(page).toHaveURL('/');
    });

    test('should request password reset', async ({page, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.regular, email: uniqueEmail};

        await registerUser(page, userData);

        await page.goto('/forgot-password');
        await page.fill('input[name="email"]', userData.email);
        await page.click('button[type="submit"]');

        await expect(page.locator('text=Email enviado').first()).toBeVisible();
    });

    test('should register LAPEN member with approval pending', async ({page, browserName}) => {
        const uniqueEmail = `${getProjectPrefix(browserName)}@example.com`;
        const userData = {...testUsers.lapenMember, email: uniqueEmail};

        await registerUser(page, userData);
        await expect(page).toHaveURL('/signup-success');
        await expect(page.locator('text=Conta Criada!')).toBeVisible();
    });
});
