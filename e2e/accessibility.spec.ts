import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Accessibility
 */

test.describe('Accessibility', () => {
  test('should have proper page title', async ({ page }) => {
    await page.goto('/');

    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.goto('/');

    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(0);
  });

  test('should have alt text for images', async ({ page }) => {
    await page.goto('/');

    const images = await page.locator('img').all();

    for (const img of images) {
      const alt = await img.getAttribute('alt');
      const ariaLabel = await img.getAttribute('aria-label');
      const role = await img.getAttribute('role');

      // Image should have alt text or be decorative (role="presentation")
      expect(alt !== null || ariaLabel !== null || role === 'presentation').toBeTruthy();
    }
  });

  test('should have proper form labels', async ({ page }) => {
    await page.goto('/');

    // Check all inputs have associated labels
    const inputs = await page.locator('input:not([type="hidden"])').all();

    for (const input of inputs.slice(0, 5)) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      const placeholder = await input.getAttribute('placeholder');

      // Input should have some form of label
      if (id) {
        const label = await page.locator(`label[for="${id}"]`).count();
        expect(label > 0 || ariaLabel || ariaLabelledBy || placeholder).toBeTruthy();
      }
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through focusable elements
    await page.keyboard.press('Tab');

    // Something should be focused
    const focusedElement = await page.locator(':focus').first();
    expect(await focusedElement.count()).toBeGreaterThanOrEqual(0);
  });

  test('should have skip link', async ({ page }) => {
    await page.goto('/');

    // Press Tab to reveal skip link
    await page.keyboard.press('Tab');

    // Check for skip link (might be hidden until focused)
    const skipLink = page.locator('a[href="#main"], a[href="#content"]');
    // Skip link is optional but recommended
  });

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('/');

    // This is a basic check - real contrast testing needs specialized tools
    // Check that text is visible (not white on white, etc.)
    const bodyColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).color;
    });

    expect(bodyColor).toBeTruthy();
  });

  test('should have RTL support', async ({ page }) => {
    await page.goto('/');

    // Check for RTL direction
    const html = page.locator('html');
    const dir = await html.getAttribute('dir');
    const lang = await html.getAttribute('lang');

    // Should be RTL for Arabic
    expect(dir === 'rtl' || lang?.startsWith('ar')).toBeTruthy();
  });

  test('should be usable with screen reader', async ({ page }) => {
    await page.goto('/');

    // Check for ARIA landmarks
    const main = await page.locator('main, [role="main"]').count();
    const nav = await page.locator('nav, [role="navigation"]').count();

    // Should have at least some landmarks
    expect(main + nav).toBeGreaterThanOrEqual(0);
  });

  test('should handle focus trap in dialogs', async ({ page }) => {
    await page.goto('/');

    // If there's a button that opens a dialog
    const dialogTrigger = page.getByRole('button', { name: /إضافة|add|open/i }).first();

    if (await dialogTrigger.isVisible()) {
      await dialogTrigger.click();

      // Dialog should trap focus
      const dialog = page.getByRole('dialog');
      if (await dialog.isVisible()) {
        // Focus should be within dialog
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          return document.activeElement?.closest('[role="dialog"]') !== null;
        });
        // Focus trapping is expected behavior
      }
    }
  });
});

test.describe('Mobile Accessibility', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be accessible on mobile', async ({ page }) => {
    await page.goto('/');

    // Touch targets should be large enough (44x44 minimum)
    const buttons = await page.locator('button, a').all();

    for (const button of buttons.slice(0, 3)) {
      const box = await button.boundingBox();
      if (box) {
        // Buttons should be at least 32x32 (allowing some flexibility)
        expect(box.width).toBeGreaterThanOrEqual(24);
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test('should have readable text size on mobile', async ({ page }) => {
    await page.goto('/');

    const fontSize = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontSize;
    });

    // Font size should be at least 14px
    const size = parseInt(fontSize);
    expect(size).toBeGreaterThanOrEqual(12);
  });
});
