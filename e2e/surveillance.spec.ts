import { expect, ready, slider, test, timeline } from './fixtures';
import type { Page } from '@playwright/test';

const PAGE = '/surveillance/index.html';
const poiTransform = (page: Page, id: string) => page.locator(`[data-poi="${id}"]`).getAttribute('transform');

test.beforeEach(async ({ page }) => {
  await ready(page, PAGE);
  // The confirmed state has been drawn on the map.
  await expect.poll(() => poiTransform(page, 'pat')).toMatch(/translate/);
});

test('loads the map, the cameras, the mosaic and the timeline', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Surveillance de site');
  await expect(page.getByRole('group', { name: 'Plan du site' })).toBeVisible();
  await expect(page.locator('.sv-cam')).toHaveCount(8);
  await expect(page.locator('.sv-tile')).toHaveCount(8);
  await expect(page.locator('[data-row-id="cam-C1"]').first()).toBeVisible();
  await expect(page.locator('.sv')).toHaveAttribute('data-alarm', 'calme');
});

test('playing moves the mobiles on the map', async ({ page }) => {
  const before = await poiTransform(page, 'pat');
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await expect(timeline(page)).toHaveAttribute('data-transport', 'playing');
  await expect.poll(() => poiTransform(page, 'pat')).not.toBe(before);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(timeline(page)).toHaveAttribute('data-transport', 'paused');
});

test('seeking to an incident key raises the alarm state', async ({ page }) => {
  await expect(page.getByTestId('alarm-pill')).toHaveText('Site calme');
  await slider(page).focus();
  await page.keyboard.press('PageDown');
  await expect(page.locator('.sv')).toHaveAttribute('data-alarm', 'alarme');
  await expect(page.getByRole('alert').filter({ hasText: 'Intrusion périmètre' })).toBeVisible();
  await expect(page.getByTestId('alarm-pill')).toHaveText('1 alarme active');
  // The intruder is on the map at that time.
  await expect(page.locator('[data-poi="int"]')).toBeVisible();
});

test('clicking a camera thumbnail enlarges its feed', async ({ page }) => {
  const tile = page.getByRole('button', { name: 'Agrandir le flux C4 — Porte A3' });
  const small = (await tile.locator('canvas').boundingBox())!;
  await tile.click();
  const viewer = page.getByRole('dialog', { name: 'Flux C4 — Porte A3' });
  await expect(viewer).toBeVisible();
  const large = (await viewer.locator('canvas').boundingBox())!;
  expect(large.width).toBeGreaterThan(small.width * 1.5);
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
});

test('selecting a mobile shows its details and selects its mission', async ({ page }) => {
  await page.locator('[data-poi="pat"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('poi-card')).toContainText('Agent Martin');
  await expect(page.locator('.tw-item--selected')).toHaveCount(1);
});

test('the live stream extends the domain', async ({ page }) => {
  const max = Number(await slider(page).getAttribute('aria-valuemax'));
  await page.getByRole('button', { name: 'Flux en direct' }).click();
  await expect(timeline(page)).toHaveAttribute('data-transport', 'live');
  await expect.poll(async () => Number(await slider(page).getAttribute('aria-valuemax'))).toBeGreaterThan(max);
  await page.getByRole('button', { name: 'Flux en direct' }).click();
});
