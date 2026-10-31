import { expect, firstTickLabel, readout, ready, slider, test, timeline, valueNow } from './fixtures';
import type { Page } from '@playwright/test';

const tickLabels = (page: Page) => page.locator('.tw-axis .tw-tick text').allTextContents();
const focusedItemId = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-item-id') ?? null);

test.beforeEach(async ({ page }) => {
  await ready(page, '/operations/index.html');
  await expect(page.locator('[data-item-id]').first()).toBeVisible();
});

test('loads and renders rows, items and ticks', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Station Nord');
  await expect(firstTickLabel(page)).toBeVisible();
  expect(await page.locator('[data-row-id]').count()).toBeGreaterThan(10);
});

test('Lecture advances the readout', async ({ page }) => {
  const before = await readout(page).textContent();
  await page.getByRole('button', { name: 'Lecture', exact: true }).click();
  await expect(timeline(page)).toHaveAttribute('data-transport', 'playing');
  await expect(readout(page)).not.toHaveText(before!);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(timeline(page)).toHaveAttribute('data-transport', 'paused');
});

test('clicking the axis seeks, dragging it pans without seeking', async ({ page }) => {
  const axis = slider(page);
  const box = (await axis.boundingBox())!;
  const y = box.y + box.height / 2;

  // Click on the background near the right edge: a seek.
  const start = await valueNow(page);
  const readoutBefore = await readout(page).textContent();
  await page.mouse.click(box.x + box.width * 0.85, y);
  await expect.poll(() => valueNow(page)).toBeGreaterThan(start);
  await expect(readout(page)).not.toHaveText(readoutBefore!);
  await expect(timeline(page)).toHaveAttribute('data-status', 'ready');

  // Drag: the viewport moves, the time does not.
  const time = await valueNow(page);
  const ticks = await tickLabels(page);
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(box.x + box.width * 0.5 - step * 25, y);
  await page.mouse.up();
  await expect.poll(() => tickLabels(page)).not.toEqual(ticks);
  await page.waitForTimeout(150);
  expect(await valueNow(page)).toBe(time);
});

test('Ctrl + wheel zooms around the pointer without moving the time', async ({ page }) => {
  const box = (await slider(page).boundingBox())!;
  const time = await valueNow(page);
  const labels = await tickLabels(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -400);
  await page.keyboard.up('Control');
  // Zooming in on a 4 h window yields finer ticks.
  await expect.poll(() => tickLabels(page)).not.toEqual(labels);
  expect(await valueNow(page)).toBe(time);
});

test('slider keyboard: arrows step, PageDown goes to the next key', async ({ page }) => {
  const axis = slider(page);
  await axis.focus();
  const start = await valueNow(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => valueNow(page)).toBeGreaterThan(start);

  const afterArrow = await valueNow(page);
  await page.keyboard.press('PageDown');
  await expect.poll(() => valueNow(page)).toBeGreaterThan(afterArrow);
  await expect(page.locator('.ops-log, .log').last().locator('li').first()).toContainText('key');
});

test('Tab reaches the items, arrow keys move focus between them', async ({ page }) => {
  await slider(page).focus();
  let id: string | null = null;
  for (let i = 0; i < 15 && id === null; i++) {
    await page.keyboard.press('Tab');
    id = await focusedItemId(page);
  }
  expect(id, 'an item receives focus by Tab').not.toBeNull();

  await page.keyboard.press('ArrowDown');
  await expect.poll(() => focusedItemId(page)).not.toBe(id);
  const second = await focusedItemId(page);
  expect(second).not.toBeNull();

  await page.keyboard.press('ArrowUp');
  await expect.poll(() => focusedItemId(page)).not.toBe(second);
  expect(await focusedItemId(page)).not.toBeNull();
});

test('Direct with the simulated stream goes live and advances', async ({ page }) => {
  await page.getByLabel('Flux simulé').check();
  await page.getByRole('button', { name: 'Direct', exact: true }).click();
  await expect(timeline(page)).toHaveAttribute('data-transport', 'live');
  const first = await readout(page).textContent();
  await expect(readout(page)).not.toHaveText(first!, { timeout: 5_000 });
  await expect(timeline(page)).toHaveAttribute('data-transport', 'live');
});
