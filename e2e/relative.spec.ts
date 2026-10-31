import { expect, ready, readout, slider, test, valueNow } from './fixtures';

test.beforeEach(async ({ page }) => {
  await ready(page, '/relative/index.html');
});

test('next key moves the readout to the trigger key (T+0)', async ({ page }) => {
  expect(await valueNow(page)).toBe(-500);
  await page.getByRole('button', { name: 'Clé suivante' }).click();
  await expect.poll(() => valueNow(page)).toBe(0);
  await expect(readout(page)).toHaveText('T+00:00:00.000');
  await expect(page.locator('.rel-clock')).toHaveText('T+00:00:00.000');

  await page.getByRole('button', { name: 'Clé suivante' }).click();
  await expect.poll(() => valueNow(page)).toBe(2500);
  await expect(readout(page)).toHaveText('T+00:00:02.500');
});

test('tick labels include negative values', async ({ page }) => {
  await expect(slider(page)).toBeVisible();
  const labels = await page.locator('.tw-axis .tw-tick text').allTextContents();
  expect(labels.some((label) => /^[-−]/.test(label.trim()))).toBe(true);
});
