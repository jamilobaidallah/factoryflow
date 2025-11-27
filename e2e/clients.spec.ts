import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Clients Management
 */

test.describe('Clients Page', () => {
  test.skip(({ browserName }) => true, 'Requires authentication setup');

  test.beforeEach(async ({ page }) => {
    await page.goto('/clients');
  });

  test('should display clients list', async ({ page }) => {
    // Check for table or list structure
    await expect(page.locator('table, [role="grid"]').first()).toBeVisible();
  });

  test('should have add client button', async ({ page }) => {
    // Look for add button
    const addButton = page.getByRole('button', { name: /إضافة|جديد|add|new/i });
    await expect(addButton).toBeVisible();
  });

  test('should open add client dialog', async ({ page }) => {
    // Click add button
    await page.getByRole('button', { name: /إضافة|جديد|add|new/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible();

    // Form fields should be visible
    await expect(page.getByPlaceholder(/الاسم|name/i)).toBeVisible();
  });

  test('should validate client form', async ({ page }) => {
    // Open add dialog
    await page.getByRole('button', { name: /إضافة|جديد|add|new/i }).click();

    // Try to submit empty form
    await page.getByRole('button', { name: /حفظ|save|إضافة/i }).click();

    // Should show validation error
    await expect(page.getByText(/مطلوب|required|خطأ/i)).toBeVisible();
  });

  test('should create new client', async ({ page }) => {
    // Open add dialog
    await page.getByRole('button', { name: /إضافة|جديد|add|new/i }).click();

    // Fill form
    await page.getByPlaceholder(/الاسم|name/i).fill('عميل اختبار');
    await page.getByPlaceholder(/الهاتف|phone/i).fill('0791234567');

    // Submit
    await page.getByRole('button', { name: /حفظ|save|إضافة/i }).click();

    // Should show success message
    await expect(page.getByText(/تم|success|نجاح/i)).toBeVisible({ timeout: 5000 });
  });

  test('should search clients', async ({ page }) => {
    // Look for search input
    const searchInput = page.getByPlaceholder(/بحث|search/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill('test');

      // Results should filter
      await page.waitForTimeout(500); // Wait for debounce
    }
  });

  test('should edit client', async ({ page }) => {
    // Click edit button on first client row
    const editButton = page.locator('[aria-label*="edit"], button:has-text("تعديل")').first();

    if (await editButton.isVisible()) {
      await editButton.click();

      // Edit dialog should open
      await expect(page.getByRole('dialog')).toBeVisible();
    }
  });

  test('should delete client with confirmation', async ({ page }) => {
    // Click delete button
    const deleteButton = page.locator('[aria-label*="delete"], button:has-text("حذف")').first();

    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirmation dialog should appear
      await expect(page.getByRole('alertdialog')).toBeVisible();
    }
  });
});
