import { test, expect } from '@playwright/test';

// Deterministic fixture for Yahoo Finance chart endpoint (avoid live API flakiness).
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

test.describe("Shannon's Demon smoke", () => {
  test('runs analysis with default tickers and shows targets', async ({ page }) => {
    await page.click('button:has-text("Run Analysis")');
    await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('td:has-text("SPY")').first()).toBeVisible();
  });

  test('holdings input persists across reload', async ({ page }) => {
    const firstHolding = page.locator('input[placeholder="0"]').first();
    await page.click('button:has-text("Current Holdings")');
    await firstHolding.fill('50');
    await expect(firstHolding).toHaveValue('50');
    // Wait until the persistence effect has written to localStorage before reloading.
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('shannonsdemon_v1') || '{}')?.currentHoldings?.['Taxable']
          ?.SPY === 50
    );
    await page.reload();
    await page.waitForSelector('#root');
    await page.click('button:has-text("Current Holdings")');
    await expect(page.locator('input[placeholder="0"]').first()).toHaveValue('50');
  });

  test('generates trades when holdings are empty', async ({ page }) => {
    await page.click('button:has-text("Run Analysis")');
    await expect(page.locator('text=Risk Parity Weights')).toBeVisible({ timeout: 15000 });
    await page.click('button:has-text("Trades")');
    await expect(page.locator('text=Rebalancing Trades')).toBeVisible();
  });
});
