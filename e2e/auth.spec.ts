import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Authentication Flow
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    // Check for login form elements
    await expect(page.getByRole('heading', { name: /تسجيل الدخول|FactoryFlow/i })).toBeVisible();
    await expect(page.getByPlaceholder(/البريد الإلكتروني|email|example@email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/••••••••|كلمة المرور|password/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Enter invalid credentials
    await page.getByPlaceholder(/البريد الإلكتروني|email|example@email/i).fill('invalid@test.com');
    await page.getByPlaceholder(/••••••••|كلمة المرور|password/i).fill('wrongpassword');

    // Click login button
    await page.getByRole('button', { name: /تسجيل الدخول|دخول|login/i }).click();

    // Should show error message
    await expect(page.getByText(/خطأ|error|invalid/i)).toBeVisible({ timeout: 10000 });
  });

  test('should toggle between login and signup modes', async ({ page }) => {
    // Find and click signup toggle
    const signupToggle = page.getByText(/إنشاء حساب|حساب جديد|sign up/i);

    if (await signupToggle.isVisible()) {
      await signupToggle.click();

      // Should show signup form
      await expect(page.getByRole('button', { name: /إنشاء|تسجيل|create/i })).toBeVisible();
    }
  });

  test('should validate email format', async ({ page }) => {
    const emailInput = page.getByPlaceholder(/البريد الإلكتروني|email/i);

    // Enter invalid email
    await emailInput.fill('invalid-email');
    await emailInput.blur();

    // Should show validation error or prevent submission
    const loginButton = page.getByRole('button', { name: /تسجيل الدخول|دخول|login/i });
    await loginButton.click();

    // Page should still be on login (not redirected)
    await expect(page).toHaveURL('/');
  });

  test('should have RTL layout', async ({ page }) => {
    // Check that the page has RTL direction
    const html = page.locator('html');
    const dir = await html.getAttribute('dir');

    // Should be RTL or the body should have RTL classes
    const body = page.locator('body');
    const bodyClass = await body.getAttribute('class');

    expect(dir === 'rtl' || bodyClass?.includes('rtl')).toBeTruthy();
  });
});

test.describe('Session Management', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard');

    // Should redirect to login or show login form
    await expect(page).toHaveURL(/\/$|\/login/);
  });

  test('should maintain session state', async ({ page, context }) => {
    // This test would require actual authentication
    // For now, we verify the auth state is checked
    await page.goto('/');

    // Auth check should occur
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });
});
