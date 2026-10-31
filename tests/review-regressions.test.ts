import { describe, expect, it } from 'vitest';
import type { ItemBatch, TimeRequest, WindowRequest } from '../src/core/index.js';
import { deferred, flush, setup } from './helpers.js';
import type { Deferred } from './helpers.js';

const rows = [{ id: 'r', label: 'R' }];

function slowSource() {
  const loads: { request: WindowRequest; done: Deferred<ItemBatch> }[] = [];
  return {
    loads,
    source: {
      kind: 'windowed' as const,
      load: (request: WindowRequest) => {
        const done = deferred<ItemBatch>();
        loads.push({ request, done });
        return done.promise;
      },
    },
    answer: async (index: number) => {
      const load = loads[index]!;
      load.done.resolve({ range: load.request.range, items: [] });
      await flush();
    },
  };
}

describe('review regressions', () => {
  it('returning to a loaded range drops the obsolete request (manual navigation)', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({ rows, source, viewport: { start: 0, end: 1000 } });
    controller.start();
    await answer(0);
    controller.seek(5000);
    expect(loads).toHaveLength(2);
    controller.setViewport({ start: 0, end: 1000 });
    await flush();
    expect(loads[1]!.request.signal.aborted).toBe(true);
    await answer(1);
    expect(snap().data.coverage).toEqual({ start: 0, end: 1250 });
  });

  it('returning to a loaded range drops the obsolete request (automatic follow)', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({ rows, source, viewport: { start: 0, end: 1000 } });
    controller.start();
    await answer(0);
    controller.seek(5000);
    controller.seek(500);
    await answer(1);
    const coverage = snap().data.coverage!;
    expect(coverage.start).toBeLessThanOrEqual(snap().viewport.start);
    expect(coverage.end).toBeGreaterThanOrEqual(snap().viewport.end);
    expect(loads.length).toBeGreaterThanOrEqual(2);
  });

  it('keys outside the domain are never destinations', () => {
    const { controller, snap } = setup({ keys: [{ id: 'a', at: 5000 }, { id: 'far', at: 20_000 }, { id: 'neg', at: -50 }] });
    expect(controller.nextKey()).toBe(true);
    expect(snap().time).toBe(5000);
    expect(controller.nextKey()).toBe(false);
    expect(snap().canNextKey).toBe(false);
    controller.seek(0);
    expect(controller.previousKey()).toBe(false);
    expect(controller.goToKey('far')).toBe(false);
    controller.extendDomain(30_000);
    expect(controller.nextKey()).toBe(true);
    expect(controller.nextKey()).toBe(true);
    expect(snap().time).toBe(20_000);
  });

  it('the initial preparation loads the data around an initial time outside the viewport', async () => {
    const { source, loads, answer } = slowSource();
    let controllerRef: { waitForData(t: number, s: AbortSignal): Promise<void> } | null = null;
    const { controller, snap } = setup({
      rows,
      source,
      viewport: { start: 0, end: 1000 },
      initialTime: 8000,
      prepareTime: (request: TimeRequest) => controllerRef!.waitForData(request.target, request.signal),
    });
    controllerRef = controller;
    controller.start();
    expect(loads[0]!.request.range.start).toBeLessThanOrEqual(8000);
    expect(loads[0]!.request.range.end).toBeGreaterThanOrEqual(8000);
    await answer(0);
    expect(snap().status).toBe('ready');
  });

  it('play while the pending destination is the end restarts from the start', async () => {
    const { controller, snap, last, resolveLast } = setup({}, true);
    controller.start();
    await resolveLast();
    controller.seek(10_000);
    controller.play();
    await resolveLast();
    expect(last().request).toMatchObject({ cause: 'play', target: 0 });
    await resolveLast();
    expect(snap().time).toBe(0);
    expect(snap().transport).toBe('playing');
  });

  it('rewind compares with the pending destination', async () => {
    const { controller, snap, resolveLast } = setup({ initialTime: 5000 }, true);
    controller.start();
    await resolveLast();
    controller.seek(9000);
    controller.rewindTo(7000);
    expect(snap().rewinding).toBe(true);
  });

  it('dispose rejects pending data waits', async () => {
    const { source } = slowSource();
    const { controller } = setup({ rows, source });
    controller.start();
    const wait = controller.waitForData(9999);
    controller.dispose();
    await expect(wait).rejects.toMatchObject({ name: 'AbortError' });
  });
});
