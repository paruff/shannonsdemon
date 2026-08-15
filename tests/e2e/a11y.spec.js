import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MOCK_CLOSES = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.1) * 5);

test.beforeEach(async ({ page }) => {
  await page.route('https://query1.finance.yahoo.com/**', route =>
    route.fulfill({
      json: {
        chart: { result: [{ indicators: { adjclose: [{ adjclose: MOCK_CLOSES }] } }] },
      },
    })
  );
  await page.goto('/shannonsdemon/');
  await page.waitForSelector('#root');
});

test.describe('Accessibility', () => {
  test('no violations on holdings tab', async ({ page }) => {
    await page.click('button:has-text("Current Holdings")');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('no violations on analysis tab after run', async ({ page }) => {
    await page.click('button:has-text("Run Analysis")');
    await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
