import { test as base, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Fails the test if the page logs a console error or throws an uncaught exception. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const slider = (page: Page): Locator => page.getByRole('slider');
export const readout = (page: Page): Locator => page.locator('.tw-readout-time');
export const timeline = (page: Page): Locator => page.locator('.tw-timeline').first();
export const firstTickLabel = (page: Page): Locator => page.locator('.tw-axis .tw-tick text').first();
export const valueNow = async (page: Page): Promise<number> => Number(await slider(page).getAttribute('aria-valuenow'));

/** Waits until the timeline has confirmed its initial time. */
export async function ready(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(timeline(page)).toHaveAttribute('data-status', 'ready');
}
