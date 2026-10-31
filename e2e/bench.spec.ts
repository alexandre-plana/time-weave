import { expect, test } from './fixtures';

test('reference scenarios complete without failure', async ({ page }) => {
  await page.goto('/bench/index.html?run=1');
  await page.waitForFunction(() => window.__bench?.done === true, undefined, { timeout: 50_000, polling: 250 });
  // `done` is raised after the main scenarios; the dynamic and live ones then append theirs and render the results.
  const values = page.locator('.panel dl.facts dd');
  await expect(page.locator('.panel dl.facts dt').filter({ hasText: /^10\./ })).toHaveCount(1, { timeout: 20_000 });
  const results = await page.evaluate(() => window.__bench!.results);
  expect(results.length).toBeGreaterThanOrEqual(10);
  for (const { scenario, value } of results) expect(value, scenario).not.toContain('ÉCHEC');
  expect(await values.allTextContents()).not.toContain('ÉCHEC');
});

declare global {
  interface Window {
    __bench?: { done: boolean; results: { scenario: string; value: string }[] };
  }
}
