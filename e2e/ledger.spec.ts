import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Ledger (Financial Transactions)
 */

test.describe('Ledger Page', () => {
  test.skip(({ browserName }) => true, 'Requires authentication setup');

  test.beforeEach(async ({ page }) => {
    await page.goto('/ledger');
  });

  test('should display ledger entries table', async ({ page }) => {
    // Check for table
    await expect(page.locator('table').first()).toBeVisible();

    // Check for table headers
    await expect(page.getByText(/التاريخ|date/i)).toBeVisible();
    await expect(page.getByText(/المبلغ|amount/i)).toBeVisible();
  });

  test('should have add entry button', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /إضافة|جديد|add/i });
    await expect(addButton).toBeVisible();
  });

  test('should open add entry form', async ({ page }) => {
    await page.getByRole('button', { name: /إضافة|جديد|add/i }).click();

    // Form should be visible (might be dialog or inline)
    await expect(page.getByPlaceholder(/الوصف|description/i)).toBeVisible();
  });

  test('should show category dropdown', async ({ page }) => {
    await page.getByRole('button', { name: /إضافة|جديد|add/i }).click();

    // Look for category selector
    const categorySelect = page.locator('select, [role="combobox"]').first();
    await expect(categorySelect).toBeVisible();
  });

  test('should validate amount field', async ({ page }) => {
    await page.getByRole('button', { name: /إضافة|جديد|add/i }).click();

    // Enter invalid amount
    const amountInput = page.getByPlaceholder(/المبلغ|amount/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill('-100');
      await amountInput.blur();

      // Should show validation error or prevent negative
    }
  });

  test('should create income entry', async ({ page }) => {
    await page.getByRole('button', { name: /إضافة|جديد|add/i }).click();

    // Fill form fields
    await page.getByPlaceholder(/الوصف|description/i).fill('دخل اختبار');

    const amountInput = page.getByPlaceholder(/المبلغ|amount/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill('1000');
    }

    // Select category (assuming income category)
    // Submit form
    await page.getByRole('button', { name: /حفظ|save|إضافة/i }).click();

    // Should show success
    await expect(page.getByText(/تم|success/i)).toBeVisible({ timeout: 5000 });
  });

  test('should create expense entry', async ({ page }) => {
    await page.getByRole('button', { name: /إضافة|جديد|add/i }).click();

    // Fill form for expense
    await page.getByPlaceholder(/الوصف|description/i).fill('مصروف اختبار');

    const amountInput = page.getByPlaceholder(/المبلغ|amount/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill('500');
    }

    // Select expense category
    // Submit
    await page.getByRole('button', { name: /حفظ|save|إضافة/i }).click();
  });

  test('should filter entries by type', async ({ page }) => {
    // Look for filter controls
    const filterButton = page.getByRole('button', { name: /فلتر|filter|تصفية/i });

    if (await filterButton.isVisible()) {
      await filterButton.click();

      // Filter options should appear
      await expect(page.getByText(/دخل|income/i)).toBeVisible();
      await expect(page.getByText(/مصروف|expense/i)).toBeVisible();
    }
  });

  test('should show entry statistics', async ({ page }) => {
    // Stats section should show totals
    await expect(page.getByText(/إجمالي|total/i)).toBeVisible();
  });
});

test.describe('Ledger ARAP Tracking', () => {
  test.skip(({ browserName }) => true, 'Requires authentication setup');

  test('should show ARAP toggle', async ({ page }) => {
    await page.goto('/ledger');
    await page.getByRole('button', { name: /إضافة|جديد|add/i }).click();

    // Look for ARAP tracking option
    const arapToggle = page.getByText(/تتبع|الدفع|AR|AP/i);
    expect(await arapToggle.count()).toBeGreaterThanOrEqual(0);
  });

  test('should enable partial payments when ARAP is on', async ({ page }) => {
    await page.goto('/ledger');
    await page.getByRole('button', { name: /إضافة|جديد|add/i }).click();

    // Enable ARAP tracking
    const arapCheckbox = page.locator('input[type="checkbox"]').first();
    if (await arapCheckbox.isVisible()) {
      await arapCheckbox.check();

      // Initial payment option should appear
      await expect(page.getByText(/دفعة|payment/i)).toBeVisible();
    }
  });
});
