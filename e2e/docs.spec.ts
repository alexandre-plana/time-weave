import { expect, test } from './fixtures';

const PATH = '/docs/index.html';

test.beforeEach(async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole('heading', { level: 1, name: /Documentation/ })).toBeVisible();
});

test('the page shows every section and the Documentation tab is current', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'Pages de démonstration' }).getByRole('link', { name: /Documentation/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('[data-doc-section]')).toHaveCount(12);
  await expect(page.locator('.docs-code').first()).toBeVisible();
});

test('the table of contents scrolls to a section', async ({ page }) => {
  const heading = page.getByRole('heading', { level: 2, name: /Synchronisation avec l’application/ });
  await expect(heading).not.toBeInViewport();
  await page.getByRole('navigation', { name: 'Sommaire de la documentation' }).getByRole('link', { name: /Synchronisation/ }).click();
  await expect(page).toHaveURL(/#synchronisation$/);
  await expect(heading).toBeInViewport();
  await expect(page.getByRole('link', { name: /Synchronisation/ }).first()).toHaveAttribute('aria-current', 'location');
});

test('the copy button copies the code and confirms it', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const block = page.locator('.docs-code', { hasText: 'QuickStart.tsx' }).first();
  await block.getByRole('button', { name: 'Copier' }).click();
  await expect(block.getByRole('button', { name: 'Copié' })).toBeVisible();
  await expect(block.getByRole('status')).toHaveText('Code copié dans le presse-papiers');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('export function QuickStart()');
  expect(copied).toContain("import '@time-weave/react/styles.css';");
});

test('the live quick start renders the items of its code', async ({ page }) => {
  const demo = page.getByRole('region', { name: 'Rendu en direct : QuickStart.tsx' });
  const timeline = demo.locator('.tw-timeline');
  await expect(timeline).toHaveAttribute('data-status', 'ready');
  await expect(timeline.locator('.tw-item')).toHaveCount(4);
  for (const label of ['Maintenance', 'Coupure', 'Alerte', '42 mesures']) {
    await expect(timeline.locator(`.tw-item[aria-label^="${label}"]`)).toBeVisible();
  }
  await expect(timeline.getByRole('slider')).toBeVisible();
});

test('the search box filters the sections', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: 'Filtrer les sections' });
  await search.fill('shallowEqual');
  await expect(page.locator('#composants')).toBeVisible();
  await expect(page.locator('#installation')).toBeHidden();
  await search.fill('aucun-resultat-possible');
  await expect(page.getByText('Aucune section ne contient')).toBeVisible();
  await page.getByRole('button', { name: 'Effacer le filtre' }).click();
  await expect(page.locator('[data-doc-section]:visible')).toHaveCount(12);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the table of contents is collapsible', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /Sommaire/ });
    const link = page.getByRole('navigation', { name: 'Sommaire de la documentation' }).getByRole('link', { name: /Recettes/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(link).toBeHidden();
    await toggle.click();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole('heading', { level: 2, name: /Recettes/ })).toBeInViewport();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
