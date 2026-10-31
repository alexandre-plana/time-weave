import { describe, expect, it } from 'vitest';
import { TimelineValidationError } from '../src/core/index.js';
import type { ItemBatch, TimelineItem, WindowRequest } from '../src/core/index.js';
import { deferred, flush, setup } from './helpers.js';
import type { Deferred } from './helpers.js';

// Decisions validated by the product owner on 31 October 2026 (docs/CONCEPTION-V1.md).

const rows = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];

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
    answer: async (index: number, items: TimelineItem[] = []) => {
      const load = loads[index]!;
      load.done.resolve({ range: load.request.range, items });
      await flush();
    },
  };
}

describe('play from live', () => {
  it('starts a replay from the current position', () => {
    const { controller, scheduler, snap } = setup({ liveTime: 4000 });
    controller.goLive();
    expect(snap()).toMatchObject({ transport: 'live', time: 4000 });
    controller.play();
    expect(snap()).toMatchObject({ transport: 'playing', time: 4000 });
    scheduler.advance(100);
    expect(snap().time).toBe(4100);
  });

  it('never jumps to the start when the live frontier is the domain end', () => {
    const { controller, scheduler, snap, requests } = setup({ liveTime: 10_000 }, true);
    const causes = () => requests.map((r) => r.request.cause);
    controller.goLive();
    requests.at(-1)!.done.resolve();
    return flush().then(() => {
      expect(snap()).toMatchObject({ transport: 'live', time: 10_000 });
      const before = requests.length;
      controller.play();
      scheduler.advance(100);
      expect(snap()).toMatchObject({ transport: 'paused', time: 10_000 });
      expect(requests.length).toBe(before);
      expect(causes()).not.toContain('play');
    });
  });

  it('ends at the end even when the live destination is still pending', async () => {
    const { controller, scheduler, snap, requests, resolveLast } = setup({ liveTime: 10_000 }, true);
    controller.goLive();
    const afterLive = requests.length - 1;
    expect(requests[afterLive]!.request).toMatchObject({ cause: 'live', target: 10_000 });
    controller.play();
    await resolveLast();
    scheduler.advance(100);
    expect(snap()).toMatchObject({ transport: 'paused', time: 10_000, pending: null });
    expect(requests.slice(afterLive).map((r) => r.request.target)).not.toContain(0);
  });

  it('with loop enabled, follows the normal end-of-playback loop rule', () => {
    const { controller, scheduler, snap } = setup({ liveTime: 10_000, loop: true });
    controller.goLive();
    controller.play();
    expect(snap().lastCause).toBe('loop');
    expect(snap().time).toBe(0);
    scheduler.advance(100);
    expect(snap()).toMatchObject({ transport: 'playing', time: 100 });
  });

  it('play from paused at the end still restarts from the start', () => {
    const { controller, scheduler, snap } = setup({ initialTime: 10_000 });
    controller.start();
    expect(snap()).toMatchObject({ transport: 'paused', time: 10_000 });
    controller.play();
    expect(snap()).toMatchObject({ transport: 'playing', time: 0, lastCause: 'play' });
    scheduler.advance(100);
    expect(snap().time).toBe(100);
  });
});

describe('windowed batch citing rows removed during its load', () => {
  it('drops items of rows removed while the load was in flight', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({ rows, source, viewport: { start: 0, end: 1000 } });
    controller.start();
    controller.update({ rows: { remove: ['b'] } });
    await answer(0, [
      { id: 'ia', rowId: 'a', at: 100 },
      { id: 'ib', rowId: 'b', at: 200 },
    ]);
    expect(loads).toHaveLength(1);
    expect(snap().items.map((i) => i.id)).toEqual(['ia']);
    expect(snap().data).toMatchObject({ error: null, loading: false });
  });

  it('keeps items of a row removed then re-added during the load', async () => {
    const { source, answer } = slowSource();
    const { controller, snap } = setup({ rows, source, viewport: { start: 0, end: 1000 } });
    controller.start();
    controller.setRows([rows[0]!]);
    controller.setRows(rows);
    await answer(0, [{ id: 'ib', rowId: 'b', at: 200 }]);
    expect(snap().items.map((i) => i.id)).toEqual(['ib']);
  });

  it('still rejects a batch citing a row unknown at request time', async () => {
    const { source, answer } = slowSource();
    const { controller, snap } = setup({ rows, source, viewport: { start: 0, end: 1000 } });
    const errors: unknown[] = [];
    controller.on('dataError', ({ error }) => errors.push(error));
    controller.start();
    await answer(0, [{ id: 'ia', rowId: 'a', at: 100 }]);
    controller.setViewport({ start: 5000, end: 6000 });
    await flush();
    controller.update({ rows: { remove: ['b'] } });
    await answer(1, [
      { id: 'ib', rowId: 'b', at: 5100 },
      { id: 'iz', rowId: 'ghost', at: 5200 },
    ]);
    expect(errors).toHaveLength(1);
    const error = snap().data.error as TimelineValidationError;
    expect(error).toBeInstanceOf(TimelineValidationError);
    expect(error.issues.map((issue) => issue.code)).toEqual(['unknown-row']);
    expect(error.issues[0]).toMatchObject({ id: 'iz' });
    expect(snap().items.map((i) => i.id)).toEqual(['ia']);
  });
});
