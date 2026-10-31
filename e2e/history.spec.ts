import { expect, ready, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await ready(page, '/history/index.html');
});

test('clicking an item opens the detail dialog, Escape closes it and restores focus', async ({ page }) => {
  const item = page.locator('[data-item-id="d1"]');
  await item.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('atelier de précision');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(item).toBeFocused();
});

test('a row toggle collapses and expands its children', async ({ page }) => {
  const rows = page.locator('[data-row-id]');
  const expanded = await rows.count();
  await expect(page.locator('[data-row-id="p-mech"]')).toBeVisible();

  const toggle = page.getByRole('button', { name: 'Replier Produits' });
  await toggle.click();
  await expect(rows).toHaveCount(expanded - 3);
  await expect(page.locator('[data-row-id="p-mech"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Déplier Produits' }).click();
  await expect(rows).toHaveCount(expanded);
  await expect(page.getByRole('button', { name: 'Replier Produits' })).toHaveAttribute('aria-expanded', 'true');
});
