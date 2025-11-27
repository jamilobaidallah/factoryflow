import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Dashboard
 * Note: These tests assume user is authenticated
 */

test.describe('Dashboard', () => {
  // Skip if not authenticated - in real tests, use auth fixture
  test.skip(({ browserName }) => true, 'Requires authentication setup');

  test('should display dashboard statistics', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for stats cards
    await expect(page.locator('[class*="card"]').first()).toBeVisible();

    // Check for key metrics
    await expect(page.getByText(/العملاء|clients/i)).toBeVisible();
    await expect(page.getByText(/الإيرادات|revenue/i)).toBeVisible();
  });

  test('should display charts', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for chart containers
    const charts = page.locator('[class*="chart"], [class*="recharts"]');
    await expect(charts.first()).toBeVisible();
  });

  test('should show recent transactions', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for transactions section
    await expect(page.getByText(/آخر المعاملات|recent transactions/i)).toBeVisible();
  });

  test('should show recent clients', async ({ page }) => {
    await page.goto('/dashboard');

    // Check for clients section
    await expect(page.getByText(/العملاء|clients/i)).toBeVisible();
  });

  test('should navigate to other pages from dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Click on a navigation item
    const clientsLink = page.getByRole('link', { name: /العملاء|clients/i });
    if (await clientsLink.isVisible()) {
      await clientsLink.click();
      await expect(page).toHaveURL(/\/clients/);
    }
  });
});
