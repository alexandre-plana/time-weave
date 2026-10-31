import { expect, ready, readout, test, timeline } from './fixtures';
import type { CDPSession, Page } from '@playwright/test';

/**
 * Long live run of the operations example: the simulated stream appends
 * 5 communications every 50 ms, extends the domain and refreshes the window.
 *
 * The example's `CommunicationStore` keeps every communication on purpose, so
 * the JS heap legitimately grows with the stream (about 100 records per second).
 * The heap bound below therefore subtracts nothing and is only a generous
 * ceiling; the strict assertions are on what the library owns: DOM nodes and
 * JS event listeners (`Memory.getDOMCounters`), which must stay flat while the
 * stream runs because the view is windowed and virtualised.
 */

interface Sample {
  readonly at: number;
  readonly heap: number;
  readonly perfHeap: number | null;
  readonly nodes: number;
  readonly listeners: number;
  readonly documents: number;
  readonly stored: number;
}

const RUN_MS = 20_000;
const INTERVAL_MS = 2_000;

async function storedCount(page: Page): Promise<number> {
  const text = (await page.locator('.badge', { hasText: 'communications en mémoire' }).textContent()) ?? '';
  return Number(text.replace(/\D/g, ''));
}

async function sample(page: Page, cdp: CDPSession, start: number): Promise<Sample> {
  // Two passes: the first may only schedule finalisation of weakly held objects.
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  const counters = await cdp.send('Memory.getDOMCounters');
  const perfHeap = await page.evaluate(
    () => (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
  );
  return {
    at: Date.now() - start,
    heap: usedSize,
    perfHeap,
    nodes: counters.nodes,
    listeners: counters.jsEventListeners,
    documents: counters.documents,
    stored: await storedCount(page),
  };
}

test.beforeEach(async ({ page }) => {
  // A full Chrome (PW_CHROMIUM_PATH) requests /favicon.ico, which the examples do not ship;
  // its 404 would be reported as a console error by the fixture.
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204, body: '' }));
});

/** Runs the live stream for RUN_MS and samples the counters after GC every INTERVAL_MS. */
async function runLiveStream(page: Page): Promise<Sample[]> {
  await ready(page, '/operations/index.html');
  await expect(page.locator('[data-item-id]').first()).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');

  await page.getByLabel('Flux simulé').check();
  await page.getByRole('button', { name: 'Direct', exact: true }).click();
  await expect(timeline(page)).toHaveAttribute('data-transport', 'live');
  // Warm-up: first live renders, JIT, caches.
  await page.waitForTimeout(1_500);

  const start = Date.now();
  const samples: Sample[] = [await sample(page, cdp, start)];
  while (Date.now() - start < RUN_MS) {
    await page.waitForTimeout(INTERVAL_MS);
    samples.push(await sample(page, cdp, start));
  }
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  test.info().annotations.push({
    type: 'samples',
    description: samples
      .map((s) => `${(s.at / 1000).toFixed(1)}s heap=${mb(s.heap)} nodes=${s.nodes} listeners=${s.listeners} stored=${s.stored}`)
      .join(' ; '),
  });

  // Still live and advancing: the measurement is about a working stream.
  await expect(timeline(page)).toHaveAttribute('data-transport', 'live');
  const time = await readout(page).textContent();
  await expect(readout(page)).not.toHaveText(time!, { timeout: 5_000 });
  expect(samples[samples.length - 1]!.stored - samples[0]!.stored, 'the stream appended data').toBeGreaterThan(1_000);
  return samples;
}

test('live stream for 20 s keeps DOM nodes and JS listeners bounded', async ({ page }) => {
  test.setTimeout(40_000);
  const samples = await runLiveStream(page);
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;

  // DOM: windowed and virtualised, so the node count does not follow the stream.
  const nodes = samples.map((s) => s.nodes);
  expect(Math.max(...nodes), `DOM nodes ${nodes.join(',')}`).toBeLessThan(first.nodes * 1.25 + 300);
  const tail = samples.slice(-3).map((s) => s.nodes);
  expect(Math.min(...tail), `no steady DOM growth ${nodes.join(',')}`).toBeLessThan(first.nodes * 1.15 + 200);
  expect(last.documents).toBeLessThanOrEqual(first.documents + 1);

  // JS event listeners: the count oscillates by a few hundred (listeners on the
  // AbortSignals of in-flight loads and preparations, released with them), but
  // nothing is added per frame, refresh or batch: no steady growth.
  const listeners = samples.map((s) => s.listeners);
  expect(Math.max(...listeners), `listeners ${listeners.join(',')}`).toBeLessThan(first.listeners * 1.5 + 200);
  const tailListeners = samples.slice(-3).map((s) => s.listeners);
  expect(Math.min(...tailListeners), `no steady listener growth ${listeners.join(',')}`).toBeLessThan(first.listeners * 1.3 + 100);
});

test('live stream for 20 s keeps the JS heap after GC bounded', async ({ page }) => {
  // Regression test: memoised callbacks with independent dependencies in Timeline once
  // kept each other's render closure contexts alive, an unbounded chain (~5-6 MB/s here).
  test.setTimeout(40_000);
  const samples = await runLiveStream(page);
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const appended = last.stored - first.stored;
  // The store keeps every communication (well under 0.5 KB each with its share of the
  // per-bin aggregates); anything beyond that plus a generous 15 MB margin is a leak.
  const growth = last.heap - first.heap;
  const heaps = samples.map((s) => (s.heap / 1024 / 1024).toFixed(1)).join(',');
  expect(growth, `heap after GC (MB): ${heaps} for ${appended} appended records`).toBeLessThan(appended * 512 + 15 * 1024 * 1024);
});
