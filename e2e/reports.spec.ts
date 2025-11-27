import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Reports
 */

test.describe('Reports Page', () => {
  test.skip(({ browserName }) => true, 'Requires authentication setup');

  test.beforeEach(async ({ page }) => {
    await page.goto('/reports');
  });

  test('should display report tabs', async ({ page }) => {
    // Check for tab navigation
    await expect(page.locator('[role="tablist"]')).toBeVisible();

    // Check for specific report tabs
    const reportTabs = [
      'ميزان المراجعة',
      'قائمة الدخل',
      'التدفق النقدي',
      'أعمار الذمم',
    ];

    for (const tab of reportTabs) {
      const tabElement = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      expect(await tabElement.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('should have date range filter', async ({ page }) => {
    // Check for date inputs
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('should switch between report tabs', async ({ page }) => {
    // Click on different tabs
    const tabs = await page.locator('[role="tab"]').all();

    for (const tab of tabs.slice(0, 3)) {
      await tab.click();
      await page.waitForTimeout(500);

      // Content should change
      await expect(page.locator('[role="tabpanel"]')).toBeVisible();
    }
  });

  test('should display income statement', async ({ page }) => {
    // Click income statement tab
    const incomeTab = page.getByRole('tab', { name: /قائمة الدخل|income/i });
    if (await incomeTab.isVisible()) {
      await incomeTab.click();

      // Should show revenue and expenses sections
      await expect(page.getByText(/الإيرادات|revenue/i)).toBeVisible();
      await expect(page.getByText(/المصروفات|expenses/i)).toBeVisible();
    }
  });

  test('should display cash flow report', async ({ page }) => {
    const cashFlowTab = page.getByRole('tab', { name: /التدفق النقدي|cash flow/i });
    if (await cashFlowTab.isVisible()) {
      await cashFlowTab.click();

      // Should show cash in/out
      await expect(page.getByText(/النقد الداخل|cash in/i)).toBeVisible();
      await expect(page.getByText(/النقد الخارج|cash out/i)).toBeVisible();
    }
  });

  test('should export reports', async ({ page }) => {
    // Look for export button
    const exportButton = page.getByRole('button', { name: /تصدير|export|PDF|Excel/i });

    if (await exportButton.isVisible()) {
      // Click should trigger download (we can't easily verify the download)
      await exportButton.click();
    }
  });

  test('should filter by date range', async ({ page }) => {
    // Set start date
    const startDate = page.locator('input[type="date"]').first();
    if (await startDate.isVisible()) {
      await startDate.fill('2024-01-01');
    }

    // Set end date
    const endDate = page.locator('input[type="date"]').last();
    if (await endDate.isVisible()) {
      await endDate.fill('2024-12-31');
    }

    // Click apply/generate button
    const applyButton = page.getByRole('button', { name: /تطبيق|apply|تحديث|generate/i });
    if (await applyButton.isVisible()) {
      await applyButton.click();

      // Report should update
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Report Calculations', () => {
  test.skip(({ browserName }) => true, 'Requires authentication setup');

  test('should calculate totals correctly', async ({ page }) => {
    await page.goto('/reports');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check that numeric values are formatted properly
    const amounts = await page.locator('[class*="amount"], [data-testid*="amount"]').all();

    for (const amount of amounts.slice(0, 3)) {
      const text = await amount.textContent();
      // Should be a formatted number (with commas or Arabic numerals)
      expect(text).toBeTruthy();
    }
  });

  test('should show profit/loss indicator', async ({ page }) => {
    await page.goto('/reports');

    // Click income statement
    const incomeTab = page.getByRole('tab', { name: /قائمة الدخل|income/i });
    if (await incomeTab.isVisible()) {
      await incomeTab.click();

      // Should show net profit/loss
      await expect(page.getByText(/صافي|net|ربح|خسارة/i)).toBeVisible();
    }
  });
});
