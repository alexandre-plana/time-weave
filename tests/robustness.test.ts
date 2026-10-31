import { describe, expect, it } from 'vitest';
import { createManualScheduler, createTimelineController } from '../src/core/index.js';
import type { ItemBatch, TimeRequest, TimelineController, TimelineItem, WindowRequest } from '../src/core/index.js';
import { deferred, flush } from './helpers.js';
import type { Deferred } from './helpers.js';

/** Deterministic PRNG (mulberry32) so a failure can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, label: `Row ${i}` }));

/** Private state, read only to measure sizes. */
function internals(controller: TimelineController) {
  const c = controller as any;
  return {
    listeners: c.listeners.size as number,
    events: (c.eventListeners.time.size + c.eventListeners.error.size + c.eventListeners.dataError.size) as number,
    waiters: c.coverageWaiters.length as number,
    prep: c.prep as unknown,
    activeLoad: c.activeLoad as unknown,
    cancelFrame: c.cancelFrame as unknown,
  };
}

/** AbortController whose signal counts its listeners. */
function countedAbort() {
  const abort = new AbortController();
  const signal = abort.signal;
  let listeners = 0;
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = ((type: string, fn: any, opts?: any) => {
    if (type === 'abort') listeners++;
    add(type, fn, opts);
  }) as typeof signal.addEventListener;
  signal.removeEventListener = ((type: string, fn: any, opts?: any) => {
    if (type === 'abort') listeners--;
    remove(type, fn, opts);
  }) as typeof signal.removeEventListener;
  return { abort, signal, listeners: () => listeners };
}

describe('robustness: long live stream on a static source', () => {
  it('20 000 cycles keep internal state bounded and dispose leaves nothing pending', async () => {
    const random = rng(42);
    const scheduler = createManualScheduler();
    const preps: { request: TimeRequest; done: Deferred }[] = [];
    let seq = 0;
    const makeItem = (at: number): TimelineItem => {
      const id = `i${seq++}`;
      const row = rows[seq % rows.length]!.id;
      return seq % 3 === 0 ? { id, rowId: row, start: at, end: at + 40 } : { id, rowId: row, at };
    };
    const live: string[] = [];
    const initial: TimelineItem[] = [];
    for (let i = 0; i < 2000; i++) {
      const item = makeItem(i * 5);
      initial.push(item);
      live.push(item.id);
    }
    let end = 10_000;
    const controller = createTimelineController({
      mode: 'relative',
      domain: { start: 0, end },
      rows,
      source: initial,
      scheduler,
      // Half of the preparations wait for the test to answer, out of order.
      prepareTime: (request) => {
        if (random() < 0.5) return;
        const done = deferred();
        preps.push({ request, done });
        return done.promise;
      },
    });
    controller.start();
    controller.goLive();

    const base = internals(controller);
    const notifications = { count: 0 };
    const keep = controller.subscribe(() => notifications.count++);
    const keepTime = controller.on('time', () => {});
    const outstandingSignals: ReturnType<typeof countedAbort>[] = [];
    let maxPreps = 0;
    let maxFrames = 0;
    let maxWaiters = 0;

    const settlePreps = (all = false) => {
      // Answer a random subset, in random order; stale answers must be ignored.
      for (let i = preps.length - 1; i >= 0; i--) {
        if (all || random() < 0.6) {
          const [entry] = preps.splice(i, 1);
          if (random() < 0.1) entry!.done.reject(new Error('transient'));
          else entry!.done.resolve();
        }
      }
    };

    const CYCLES = 20_000;
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      end += 50;
      controller.extendDomain(end);
      controller.setLiveTime(end - Math.floor(random() * 10));
      // The stream is applied every other cycle, two items at a time, to keep the test fast;
      // `update()` validates only the changed items (see tests/update-perf.test.ts).
      if (cycle % 2 === 0) {
        const upsert = [makeItem(end - 20), makeItem(end - 10)];
        const remove = live.splice(0, 2);
        for (const item of upsert) live.push(item.id);
        // Modify an existing item now and then.
        if (cycle % 14 === 0) upsert.push({ id: live[live.length - 3]!, rowId: 'r1', at: end - 30 });
        controller.update({ items: { upsert, remove } });
      }

      // Transient observers.
      if (cycle % 5 === 0) {
        const off = controller.subscribe(() => {});
        const offTime = controller.on('time', () => {});
        const offError = controller.on('error', () => {});
        const offData = controller.on('dataError', () => {});
        off();
        offTime();
        offError();
        offData();
        off(); // idempotent
      }

      // Waiters for times beyond the domain: never covered until aborted (or the domain grows).
      if (cycle % 3 === 0) {
        const counted = countedAbort();
        controller.waitForData(end + 10_000, counted.signal).catch(() => {});
        outstandingSignals.push(counted);
        if (outstandingSignals.length > 20) outstandingSignals.shift()!.abort.abort();
      }

      // Alternate transports so frames are requested and cancelled.
      if (cycle % 500 === 100) controller.play();
      if (cycle % 500 === 300) controller.goLive();
      if (cycle % 1000 === 450) controller.seek(end / 2);
      if (cycle % 2 === 0) scheduler.frame(16);

      if (random() < 0.3) settlePreps();
      if (cycle % 64 === 0) await flush();

      const pendingPreps = preps.filter((p) => !p.request.signal.aborted).length;
      maxPreps = Math.max(maxPreps, pendingPreps);
      maxFrames = Math.max(maxFrames, scheduler.pendingFrames);
      maxWaiters = Math.max(maxWaiters, internals(controller).waiters);
    }
    settlePreps(true);
    await flush();
    for (const s of outstandingSignals.splice(0)) s.abort.abort();
    await flush();

    expect(controller.getSnapshot().items).toHaveLength(2000);
    // The scenario really exercised pending preparations and frames: bounded at exactly one.
    expect(maxPreps).toBe(1);
    expect(maxFrames).toBe(1);
    // Domain growth may have covered some waiters; at most the 21 latest remain.
    expect(maxWaiters).toBeGreaterThan(0);
    expect(maxWaiters).toBeLessThanOrEqual(21);
    expect(notifications.count).toBeGreaterThan(CYCLES);

    keep();
    keepTime();
    const after = internals(controller);
    expect(after.listeners).toBe(base.listeners);
    expect(after.events).toBe(base.events);
    expect(after.waiters).toBe(0);

    // An outstanding waiter and preparation at dispose time.
    controller.play();
    const counted = countedAbort();
    const waiting = controller.waitForData(end + 1, counted.signal);
    controller.seek(end / 3);
    expect(counted.listeners()).toBe(1);
    controller.dispose();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(counted.listeners()).toBe(0);
    const disposed = internals(controller);
    expect(disposed.listeners).toBe(0);
    expect(disposed.events).toBe(0);
    expect(disposed.waiters).toBe(0);
    expect(disposed.prep).toBeNull();
    expect(disposed.cancelFrame).toBeNull();
    expect(scheduler.pendingFrames).toBe(0);
    expect(preps.every((p) => p.request.signal.aborted)).toBe(true);
    scheduler.advance(1000);
    expect(scheduler.pendingFrames).toBe(0);
  }, 20_000);
});

describe('robustness: windowed source answering out of order', () => {
  it('refreshes and navigation keep at most one live request and waiters do not accumulate', async () => {
    const random = rng(7);
    const scheduler = createManualScheduler();
    const loads: { request: WindowRequest; done: Deferred<ItemBatch> }[] = [];
    const answer = (request: WindowRequest): ItemBatch => {
      const items: TimelineItem[] = [];
      const step = Math.max(1, (request.range.end - request.range.start) / 50);
      for (let i = 0; i < 50; i++) items.push({ id: `w${i}`, rowId: rows[i % rows.length]!.id, at: request.range.start + i * step });
      return { range: request.range, items };
    };
    let end = 10_000;
    const controller = createTimelineController({
      mode: 'relative',
      domain: { start: 0, end },
      rows,
      scheduler,
      source: {
        kind: 'windowed',
        load: (request) => {
          // A third of the answers are synchronous, the rest come later in random order.
          if (random() < 0.33) return answer(request);
          const done = deferred<ItemBatch>();
          loads.push({ request, done });
          return done.promise;
        },
      },
    });
    controller.start();
    controller.goLive();
    const base = internals(controller);

    let maxCurrent = 0;
    let maxUnsettledAlive = 0;
    let maxWaiters = 0;
    let maxFrames = 0;
    let maxLoadsQueued = 0;
    const signals: ReturnType<typeof countedAbort>[] = [];
    const settled: Promise<unknown>[] = [];

    const settleLoads = (all = false) => {
      for (let i = loads.length - 1; i >= 0; i--) {
        const pick = all ? i : Math.floor(random() * (i + 1));
        if (!all && random() < 0.5) continue;
        const [entry] = loads.splice(pick, 1);
        if (random() < 0.05) entry!.done.reject(new Error('network'));
        else entry!.done.resolve(answer(entry!.request));
      }
    };

    for (let cycle = 0; cycle < 20_000; cycle++) {
      end += 50;
      controller.extendDomain(end);
      controller.setLiveTime(end);
      controller.refresh();
      if (cycle % 11 === 0) controller.zoomBy(random() < 0.5 ? 1.2 : 0.8);
      if (cycle % 997 === 0) controller.setViewport({ start: 0, end: 5000 }); // navigation leaves live
      if (cycle % 997 === 10) controller.goLive();
      if (cycle % 4 === 0) {
        const counted = countedAbort();
        // Some waiters target the past (soon covered), others the far future (until aborted).
        const target = random() < 0.5 ? end - 100 : end + 1_000_000;
        settled.push(controller.waitForData(target, counted.signal).catch(() => {}));
        signals.push(counted);
        if (signals.length > 10) signals.shift()!.abort.abort();
      }
      if (random() < 0.4) settleLoads();
      if (cycle % 16 === 0) await flush();

      const alive = loads.filter((l) => !l.request.signal.aborted);
      maxUnsettledAlive = Math.max(maxUnsettledAlive, alive.length);
      maxCurrent = Math.max(maxCurrent, alive.filter((l) => l.request.isCurrent()).length);
      maxWaiters = Math.max(maxWaiters, internals(controller).waiters);
      maxFrames = Math.max(maxFrames, scheduler.pendingFrames);
      maxLoadsQueued = Math.max(maxLoadsQueued, loads.length);
    }
    for (const s of signals.splice(0)) s.abort.abort();
    settleLoads(true);
    await flush();
    await Promise.all(settled.splice(0));

    // A replaced request is always aborted: at most one request is alive at a time.
    expect(maxUnsettledAlive).toBe(1);
    expect(maxCurrent).toBe(1);
    expect(maxWaiters).toBeGreaterThan(0);
    expect(maxWaiters).toBeLessThanOrEqual(11);
    expect(maxFrames).toBeLessThanOrEqual(1);
    expect(internals(controller).waiters).toBe(0);
    expect(internals(controller).listeners).toBe(base.listeners);
    expect(maxLoadsQueued).toBeLessThan(200);

    // Dispose with an outstanding load and waiter.
    controller.refresh();
    const counted = countedAbort();
    const waiting = controller.waitForData(end + 5_000_000, counted.signal);
    controller.dispose();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(counted.listeners()).toBe(0);
    expect(loads.every((l) => l.request.signal.aborted)).toBe(true);
    const disposed = internals(controller);
    expect(disposed.activeLoad).toBeNull();
    expect(disposed.waiters).toBe(0);
    expect(disposed.listeners).toBe(0);
    expect(scheduler.pendingFrames).toBe(0);
    // Late answers after dispose are ignored without throwing.
    settleLoads(true);
    await flush();
    expect(controller.getSnapshot().data.loading).toBe(false);
  }, 20_000);

  it('aborted or satisfied waitForData calls leave no waiter nor abort listener', async () => {
    const controller = createTimelineController({
      mode: 'relative',
      domain: { start: 0, end: 1000 },
      scheduler: createManualScheduler(),
      source: { kind: 'windowed', load: () => new Promise<ItemBatch>(() => {}) },
    });
    controller.start();
    for (let i = 0; i < 5000; i++) {
      const abort = new AbortController();
      const waiting = controller.waitForData(500, abort.signal);
      abort.abort();
      await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    }
    expect(internals(controller).waiters).toBe(0);
    // Waiters resolved by coverage release their abort listener too.
    const counted = Array.from({ length: 100 }, () => countedAbort());
    const pending = counted.map((c) => controller.waitForData(500, c.signal));
    expect(internals(controller).waiters).toBe(100);
    controller.setSource([]);
    await Promise.all(pending);
    expect(internals(controller).waiters).toBe(0);
    expect(counted.every((c) => c.listeners() === 0)).toBe(true);
    controller.dispose();
  });
});
