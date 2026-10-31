import { describe, expect, it } from 'vitest';
import { TimelineValidationError } from '../src/core/index.js';
import type { ItemBatch, TimelineItem, WindowRequest } from '../src/core/index.js';
import { deferred, flush, setup } from './helpers.js';
import type { Deferred } from './helpers.js';

const rows = [
  { id: 'root', label: 'Root' },
  { id: 'a', label: 'A', parentId: 'root' },
  { id: 'b', label: 'B', parentId: 'root' },
  { id: 'a1', label: 'A1', parentId: 'a' },
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

describe('live mode', () => {
  it('follows the live frontier through the normal preparation contract', async () => {
    const { controller, snap, last, resolveLast } = setup({ domain: { start: 0, end: 1000 }, liveTime: 400 }, true);
    controller.start();
    await resolveLast();
    controller.goLive();
    expect(snap().transport).toBe('live');
    expect(last().request).toMatchObject({ cause: 'live', target: 400 });
    await resolveLast();
    expect(snap().time).toBe(400);
    expect(snap().transport).toBe('live');
  });

  it('coalesces frontiers received faster than confirmations', async () => {
    const { controller, snap, requests, last, resolveLast } = setup({ domain: { start: 0, end: 10_000 }, liveTime: 100 }, true);
    controller.start();
    await resolveLast();
    controller.goLive();
    const engaged = last();
    for (let t = 200; t <= 2000; t += 100) controller.setLiveTime(t);
    expect(engaged.request.signal.aborted).toBe(false);
    const countBefore = requests.length;
    await resolveLast();
    expect(snap().time).toBe(100);
    expect(requests.length).toBe(countBefore + 1);
    expect(last().request.target).toBe(2000);
    await resolveLast();
    expect(snap().time).toBe(2000);
    expect(requests.length).toBe(countBefore + 1);
  });

  it('never moves the frontier back', () => {
    const { controller, snap } = setup({ liveTime: 500 });
    controller.setLiveTime(300);
    expect(snap().liveTime).toBe(500);
    expect(() => controller.setLiveTime(20_000)).toThrow(TimelineValidationError);
  });

  it('leaves live mode on navigation, pause and stop, and late answers never reactivate it', async () => {
    const { controller, snap, last, resolveLast } = setup({ liveTime: 5000 }, true);
    controller.start();
    await resolveLast();
    controller.goLive();
    const live = last();
    controller.pause();
    expect(snap().transport).toBe('paused');
    controller.setLiveTime(6000);
    live.done.resolve();
    await flush();
    expect(snap().time).toBe(5000);
    expect(snap().transport).toBe('paused');
    expect(last()).toBe(live);

    controller.goLive();
    await resolveLast();
    controller.seek(100);
    expect(snap().transport).toBe('paused');
    await resolveLast();
    controller.goLive();
    await resolveLast();
    controller.stop();
    expect(snap().transport).toBe('paused');
    await resolveLast();
    expect(snap().time).toBe(0);
  });

  it('play starts a replay from the current position', () => {
    const { controller, scheduler, snap } = setup({ liveTime: 5000 });
    controller.goLive();
    controller.play();
    expect(snap().transport).toBe('playing');
    scheduler.advance(100);
    expect(snap().time).toBeCloseTo(5100);
  });

  it('a data correction at an unchanged frontier creates no destination', () => {
    const { controller, requests } = setup({ liveTime: 5000, rows, source: [] }, true);
    controller.goLive();
    requests.at(-1)!.done.resolve();
    const count = requests.length;
    controller.update({ items: { upsert: [{ id: 'x', rowId: 'a', at: 4999 }] } });
    controller.setLiveTime(5000);
    expect(requests.length).toBe(count);
  });

  it('the viewport keeps its duration and follows the live target; zoom keeps live', () => {
    const { controller, snap } = setup({ domain: { start: 0, end: 100_000 }, viewport: { start: 0, end: 1000 }, liveTime: 50_000 });
    controller.goLive();
    expect(snap().viewport.end - snap().viewport.start).toBe(1000);
    expect(snap().viewport.start).toBeLessThanOrEqual(50_000);
    expect(snap().viewport.end).toBeGreaterThanOrEqual(50_000);
    controller.zoomBy(2);
    expect(snap().transport).toBe('live');
    expect(snap().viewport.end - snap().viewport.start).toBe(500);
    controller.panBy(-10_000);
    expect(snap().transport).toBe('paused');
  });

  it('extends the domain explicitly and follows the new live end by default', () => {
    const { controller, snap } = setup({ domain: { start: 0, end: 1000 } });
    controller.goLive();
    expect(snap().time).toBe(1000);
    controller.extendDomain(2000);
    expect(snap().domain.end).toBe(2000);
    expect(snap().liveTime).toBe(2000);
    expect(snap().time).toBe(2000);
    expect(() => controller.extendDomain(1500)).toThrow(TimelineValidationError);
  });

  it('in replay, extending the domain neither moves the cursor nor restarts a stopped playback', () => {
    const { controller, scheduler, snap } = setup({ domain: { start: 0, end: 100 } });
    controller.play();
    scheduler.advance(200);
    expect(snap().transport).toBe('paused');
    controller.extendDomain(500);
    expect(snap().time).toBe(100);
    expect(snap().transport).toBe('paused');
    scheduler.advance(200);
    expect(snap().time).toBe(100);
  });

  it('a waiting loop return is cancelled when the end moves and playback continues', async () => {
    const { controller, scheduler, snap, last, resolveLast } = setup({ domain: { start: 0, end: 100 }, loop: true }, true);
    controller.play();
    await resolveLast();
    scheduler.frame(150);
    await resolveLast();
    expect(last().request.cause).toBe('loop');
    const loopReturn = last();
    controller.extendDomain(300);
    expect(loopReturn.request.signal.aborted).toBe(true);
    scheduler.frame(50);
    expect(last().request).toMatchObject({ cause: 'play', target: 150 });
  });

  it('after a background suspension, live asks for the latest frontier only', async () => {
    const { controller, snap, requests, resolveLast } = setup({ liveTime: 100 }, true);
    controller.goLive();
    await resolveLast(); // initial was aborted by goLive; this resolves live
    await resolveLast();
    controller.setActive(false);
    const count = requests.length;
    // Frontiers keep arriving while hidden: a single preparation chases the latest.
    controller.setLiveTime(200);
    controller.setLiveTime(300);
    expect(requests.length).toBe(count + 1);
    controller.setActive(true);
    await resolveLast();
    expect(requests.at(-1)!.request.target).toBe(300);
    await resolveLast();
    expect(snap().time).toBe(300);
  });
});

describe('windowed data', () => {
  it('requests the viewport with a 25% margin bounded to the domain', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({ rows, source, viewport: { start: 1000, end: 2000 } });
    controller.start();
    expect(loads[0]!.request.range).toEqual({ start: 750, end: 2250 });
    expect(loads[0]!.request.visible).toEqual({ start: 1000, end: 2000 });
    expect(snap().data.loading).toBe(true);
    await answer(0, [{ id: 'i', rowId: 'a', at: 1500 }]);
    expect(snap().items).toHaveLength(1);
    expect(snap().data).toMatchObject({ loading: false, coverage: { start: 750, end: 2250 }, error: null });
  });

  it('manual navigation starts a new generation and ignores old answers', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({ rows, source, viewport: { start: 0, end: 1000 } });
    controller.start();
    controller.setViewport({ start: 5000, end: 6000 });
    await flush();
    expect(loads).toHaveLength(2);
    expect(loads[0]!.request.signal.aborted).toBe(true);
    expect(loads[1]!.request.generation).toBe(loads[0]!.request.generation + 1);
    await answer(0, [{ id: 'old', rowId: 'a', at: 10 }]);
    expect(snap().items).toHaveLength(0);
    await answer(1, [{ id: 'new', rowId: 'a', at: 5500 }]);
    expect(snap().items.map((i) => i.id)).toEqual(['new']);
  });

  it('gesture changes are coalesced and covered ranges need no reload', async () => {
    const { source, loads, answer } = slowSource();
    const { controller } = setup({ rows, source, viewport: { start: 0, end: 1000 } });
    controller.start();
    await answer(0);
    for (let i = 1; i <= 20; i++) controller.panBy(10);
    await flush();
    expect(loads).toHaveLength(1);
    for (let i = 1; i <= 20; i++) controller.panBy(100);
    await flush();
    expect(loads).toHaveLength(2);
  });

  it('automatic moves keep the active request and remember a single next range', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({
      rows,
      source,
      domain: { start: 0, end: 100_000 },
      viewport: { start: 0, end: 1000 },
      liveTime: 500,
    });
    controller.goLive();
    expect(loads).toHaveLength(1);
    for (let t = 2000; t <= 20_000; t += 1000) controller.setLiveTime(t);
    expect(loads).toHaveLength(1);
    expect(loads[0]!.request.signal.aborted).toBe(false);
    await answer(0);
    expect(loads).toHaveLength(2);
    expect(loads[1]!.request.range.end).toBeGreaterThanOrEqual(20_000);
    expect(snap().time).toBe(20_000);
  });

  it('refreshes are grouped behind the active request', async () => {
    const { source, loads, answer } = slowSource();
    const { controller } = setup({ rows, source });
    controller.start();
    controller.refresh();
    controller.refresh();
    controller.refresh();
    expect(loads).toHaveLength(1);
    await answer(0);
    expect(loads).toHaveLength(2);
    expect(loads[1]!.request.reason).toBe('refresh');
    await answer(1);
    expect(loads).toHaveLength(2);
  });

  it('a failed load keeps the previous batch and exposes the error separately', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({ rows, source });
    controller.start();
    await answer(0, [{ id: 'kept', rowId: 'a', at: 5 }]);
    controller.refresh();
    loads[1]!.done.reject(new Error('network'));
    await flush();
    expect(snap().items.map((i) => i.id)).toEqual(['kept']);
    expect((snap().data.error as Error).message).toBe('network');
    expect(snap().data.loading).toBe(false);
  });

  it('an invalid batch is rejected without replacing the previous one', async () => {
    const { source, loads, answer } = slowSource();
    const { controller, snap } = setup({ rows, source });
    controller.start();
    await answer(0, [{ id: 'kept', rowId: 'a', at: 5 }]);
    controller.refresh();
    await answer(1, [{ id: 'bad', rowId: 'missing', at: 5 }]);
    expect(snap().items.map((i) => i.id)).toEqual(['kept']);
    expect(snap().data.error).toBeInstanceOf(TimelineValidationError);
    expect(loads).toHaveLength(2);
  });

  it('a seek outside the viewport starts loading before confirmation is awaited', async () => {
    const { source, loads, answer } = slowSource();
    const order: string[] = [];
    const { controller, snap } = setup({
      rows,
      source: { kind: 'windowed', load: (r) => (order.push(`load:${r.range.start}`), source.load(r)) },
      viewport: { start: 0, end: 1000 },
      prepareTime: async (request) => {
        order.push(`prepare:${request.target}`);
        await controller.waitForData(request.target, request.signal);
      },
    });
    controller.start();
    await answer(0);
    controller.seek(8000);
    expect(order.slice(-2)).toEqual(['load:7250', 'prepare:8000']);
    expect(snap().pending?.target).toBe(8000);
    await answer(1);
    expect(snap().time).toBe(8000);
  });

  it('an empty batch is "no data", distinct from loading', async () => {
    const { source, answer } = slowSource();
    const { controller, snap } = setup({ rows, source });
    controller.start();
    expect(snap().data.coverage).toBeNull();
    await answer(0, []);
    expect(snap().data.coverage).not.toBeNull();
    expect(snap().items).toEqual([]);
  });

  it('replacing data keeps time, speed, intention, viewport and expansion', async () => {
    const { source, answer } = slowSource();
    const { controller, scheduler, snap } = setup({ rows, source, expanded: ['root', 'a'], speed: 2 });
    controller.play();
    await answer(0);
    scheduler.advance(100);
    const before = snap();
    controller.refresh();
    await answer(1, [{ id: 'n', rowId: 'a1', at: 3 }]);
    const after = snap();
    expect(after.time).toBe(before.time);
    expect(after.speed).toBe(2);
    expect(after.transport).toBe('playing');
    expect(after.viewport).toEqual(before.viewport);
    expect([...after.expanded]).toEqual(['root', 'a']);
  });

  it('items of a windowed source cannot be modified through a second channel', () => {
    const { source } = slowSource();
    const { controller } = setup({ rows, source });
    expect(() => controller.update({ items: { upsert: [] } })).toThrow(TimelineValidationError);
  });
});

describe('dynamic collections', () => {
  const items = [
    { id: 'p1', rowId: 'a', at: 100 },
    { id: 's1', rowId: 'a1', start: 100, end: 200 },
  ];

  it('applies grouped changes atomically or rejects them entirely', () => {
    const { controller, snap } = setup({ rows, source: items });
    controller.update({
      items: { upsert: [{ id: 'p2', rowId: 'b', at: 300 }, { id: 'p1', rowId: 'a', at: 150 }], remove: ['s1'] },
      keys: { upsert: [{ id: 'k', at: 300 }] },
    });
    expect(snap().items.map((i) => i.id)).toEqual(['p1', 'p2']);
    expect(snap().keys).toHaveLength(1);
    const before = snap();
    expect(() =>
      controller.update({
        items: { upsert: [{ id: 'p3', rowId: 'b', at: 1 }] },
        rows: { upsert: [{ id: 'x', label: 'X', parentId: 'nowhere' }] },
      }),
    ).toThrow(TimelineValidationError);
    expect(snap()).toBe(before);
  });

  it('rejects cycles introduced by a change of parent', () => {
    const { controller } = setup({ rows });
    expect(() => controller.update({ rows: { upsert: [{ id: 'a', label: 'A', parentId: 'a1' }] } })).toThrow(
      /cycle/,
    );
  });

  it('removing a row drops its items and expansion state, keeps the others', () => {
    const { controller, snap } = setup({ rows, source: items, expanded: ['root', 'a'] });
    controller.update({ rows: { remove: ['a1'] } });
    expect(snap().items.map((i) => i.id)).toEqual(['p1']);
    expect([...snap().expanded]).toEqual(['root', 'a']);
    controller.update({ rows: { remove: ['a'] } });
    expect([...snap().expanded]).toEqual(['root']);
  });

  it('new rows start collapsed; visible rows follow expansion', () => {
    const { controller, snap } = setup({ rows, expanded: ['root'] });
    expect(snap().visibleRows.map((r) => r.row.id)).toEqual(['root', 'a', 'b']);
    controller.expand('a');
    expect(snap().visibleRows.map((r) => r.row.id)).toEqual(['root', 'a', 'a1', 'b']);
    controller.update({ rows: { upsert: [{ id: 'c', label: 'C', parentId: 'root' }, { id: 'c1', label: 'C1', parentId: 'c' }] } });
    const c = snap().visibleRows.find((r) => r.row.id === 'c')!;
    expect(c).toMatchObject({ hasChildren: true, expanded: false, depth: 1 });
  });

  it('updates continue during playback and are not time commands', () => {
    const { controller, scheduler, snap } = setup({ rows, source: items });
    controller.play();
    scheduler.advance(100);
    const time = snap().time;
    controller.update({ items: { upsert: [{ id: 'late', rowId: 'b', at: 50 }] } });
    expect(snap().time).toBe(time);
    expect(snap().transport).toBe('playing');
  });

  it('rejects invalid items with structured issues', () => {
    const { controller } = setup({ rows });
    try {
      controller.setItems([
        { id: 'x', rowId: 'a', start: 10, end: 5 },
        { id: 'x', rowId: 'a', at: Number.NaN },
        { id: 'g', rowId: 'a', at: 1, group: { count: 0 } },
      ]);
      expect.unreachable();
    } catch (error) {
      const codes = (error as TimelineValidationError).issues.map((i) => i.code);
      expect(codes).toEqual(['invalid-range', 'duplicate-id', 'invalid-time', 'invalid-group']);
    }
  });
});

describe('lifecycle', () => {
  it('dispose cancels requests and frames, and ignores later commands', () => {
    const { controller, scheduler, last } = setup({}, true);
    controller.play();
    const initial = last();
    controller.dispose();
    expect(initial.request.signal.aborted).toBe(true);
    controller.play();
    controller.seek(10);
    expect(scheduler.pendingFrames).toBe(0);
  });

  it('notifies subscribers once per command and keeps snapshots stable', () => {
    const { controller } = setup({ rows });
    let calls = 0;
    const unsubscribe = controller.subscribe(() => calls++);
    const s1 = controller.getSnapshot();
    expect(controller.getSnapshot()).toBe(s1);
    controller.seek(100);
    expect(calls).toBe(1);
    expect(controller.getSnapshot()).not.toBe(s1);
    unsubscribe();
    controller.seek(200);
    expect(calls).toBe(1);
  });
});
