import { describe, expect, it } from 'vitest';
import { TimelineValidationError } from '../src/core/index.js';
import type { TimelineItem, ViewportChange, WindowRequest } from '../src/core/index.js';
import { flush, setup } from './helpers.js';

function record(controller: { on(event: 'viewport', listener: (change: ViewportChange) => void): () => void }) {
  const events: ViewportChange[] = [];
  controller.on('viewport', (change) => events.push(change));
  return events;
}

const items: TimelineItem[] = [
  { id: 'a', rowId: 'r', start: 2000, end: 3000 },
  { id: 'b', rowId: 'r', at: 4000 },
];

describe('zoomTo', () => {
  it('keeps the visible cursor at the same relative position', () => {
    const { controller, snap } = setup({ viewport: { start: 0, end: 4000 }, initialTime: 1000 });
    controller.start();
    controller.zoomTo(2000);
    expect(snap().viewport).toEqual({ start: 500, end: 2500 });
  });

  it('uses the viewport centre when the cursor is not visible, or an explicit anchor', () => {
    const { controller, snap } = setup({ viewport: { start: 4000, end: 8000 }, initialTime: 0, followPlayback: false });
    controller.start();
    controller.zoomTo(2000);
    expect(snap().viewport).toEqual({ start: 5000, end: 7000 });
    controller.zoomTo(4000, 5000);
    // anchor 5000 at ratio 0 of [5000, 7000] stays at ratio 0
    expect(snap().viewport).toEqual({ start: 5000, end: 9000 });
  });

  it('clamps the duration to [minViewportDuration, domain length] and stays in the domain', () => {
    const { controller, snap } = setup({ minViewportDuration: 100, initialTime: 9990 });
    controller.start();
    controller.zoomTo(1);
    expect(snap().viewport.end - snap().viewport.start).toBe(100);
    expect(snap().viewport.end).toBeLessThanOrEqual(10_000);
    controller.zoomTo(1e9);
    expect(snap().viewport).toEqual({ start: 0, end: 10_000 });
  });

  it('keeps live mode and the live anchor', () => {
    const { controller, snap } = setup({ viewport: { start: 0, end: 2000 }, liveTime: 5000 });
    controller.start();
    controller.goLive();
    expect(snap().transport).toBe('live');
    controller.zoomTo(1000);
    expect(snap().transport).toBe('live');
    expect(snap().viewport).toEqual({ start: 4100, end: 5100 });
  });

  it('rejects invalid input', () => {
    const { controller } = setup();
    expect(() => controller.zoomTo(0)).toThrow(TimelineValidationError);
    expect(() => controller.zoomTo(-5)).toThrow(TimelineValidationError);
    expect(() => controller.zoomTo(Number.NaN)).toThrow(TimelineValidationError);
    expect(() => controller.zoomTo(Infinity)).toThrow(TimelineValidationError);
    expect(() => controller.zoomTo(100, Number.NaN)).toThrow(TimelineValidationError);
  });
});

describe('centerOn', () => {
  it('centres the time with the same duration, within the domain', () => {
    const { controller, snap } = setup({ viewport: { start: 0, end: 2000 } });
    controller.start();
    controller.centerOn(5000);
    expect(snap().viewport).toEqual({ start: 4000, end: 6000 });
    controller.centerOn(9900);
    expect(snap().viewport).toEqual({ start: 8000, end: 10_000 });
    controller.centerOn(-1e6);
    expect(snap().viewport).toEqual({ start: 0, end: 2000 });
  });

  it('leaves live mode like a pan, without moving the cursor', () => {
    const { controller, snap } = setup({ viewport: { start: 0, end: 2000 }, liveTime: 5000 });
    controller.start();
    controller.goLive();
    controller.centerOn(1000);
    expect(snap().transport).toBe('paused');
    expect(snap().time).toBe(5000);
    expect(snap().viewport).toEqual({ start: 0, end: 2000 });
  });

  it('rejects invalid input', () => {
    const { controller } = setup();
    expect(() => controller.centerOn(Number.NaN)).toThrow(TimelineValidationError);
  });
});

describe('stepBy', () => {
  it('seeks relative to the confirmed time, bounded to the domain', () => {
    const { controller, snap } = setup({ initialTime: 1000 });
    controller.start();
    controller.stepBy(500);
    expect(snap().time).toBe(1500);
    expect(snap().lastCause).toBe('seek');
    controller.stepBy(-1e9);
    expect(snap().time).toBe(0);
    controller.stepBy(1e9);
    expect(snap().time).toBe(10_000);
  });

  it('steps from the pending destination', async () => {
    const { controller, snap, resolveLast, last } = setup({}, true);
    controller.start();
    await resolveLast();
    controller.seek(3000);
    controller.stepBy(100);
    expect(last().request).toMatchObject({ target: 3100, cause: 'seek' });
    await resolveLast();
    expect(snap().time).toBe(3100);
  });

  it('keeps the playback intention and leaves live mode', () => {
    const { controller, snap } = setup({ liveTime: 5000 });
    controller.start();
    controller.play();
    controller.stepBy(100);
    expect(snap().transport).toBe('playing');
    controller.goLive();
    controller.stepBy(-1000);
    expect(snap().transport).toBe('paused');
    expect(snap().time).toBe(4000);
  });

  it('ignores 0 and rejects non-finite steps', () => {
    const { controller, snap } = setup({ initialTime: 1000 });
    controller.start();
    const cause = snap().lastCause;
    controller.stepBy(0);
    expect(snap().lastCause).toBe(cause);
    expect(() => controller.stepBy(Number.NaN)).toThrow(TimelineValidationError);
    expect(() => controller.stepBy(Infinity)).toThrow(TimelineValidationError);
  });
});

describe('fitToItems', () => {
  it('covers the item extent with padding', () => {
    const { controller, snap } = setup({ rows: [{ id: 'r', label: 'R' }], source: items, viewport: { start: 0, end: 500 } });
    controller.start();
    controller.fitToItems();
    expect(snap().viewport).toEqual({ start: 1900, end: 4100 });
    controller.fitToItems(0);
    expect(snap().viewport).toEqual({ start: 2000, end: 4000 });
  });

  it('stays within the domain and respects the minimum duration', () => {
    const { controller, snap } = setup({
      rows: [{ id: 'r', label: 'R' }],
      source: [{ id: 'p', rowId: 'r', at: 9990 }],
      minViewportDuration: 100,
      viewport: { start: 0, end: 500 },
    });
    controller.start();
    controller.fitToItems();
    expect(snap().viewport).toEqual({ start: 9900, end: 10_000 });
    controller.update({ items: { upsert: [{ id: 'q', rowId: 'r', start: 0, end: 10_000 }] } });
    controller.fitToItems(1);
    expect(snap().viewport).toEqual({ start: 0, end: 10_000 });
  });

  it('fits the domain without items, and uses the loaded batch of a windowed source', async () => {
    const empty = setup({ viewport: { start: 0, end: 500 } });
    empty.controller.start();
    empty.controller.fitToItems();
    expect(empty.snap().viewport).toEqual({ start: 0, end: 10_000 });

    const windowed = setup({
      rows: [{ id: 'r', label: 'R' }],
      viewport: { start: 0, end: 5000 },
      source: { kind: 'windowed', load: (request: WindowRequest) => ({ range: request.range, items }) },
    });
    windowed.controller.start();
    await flush();
    windowed.controller.fitToItems(0);
    expect(windowed.snap().viewport).toEqual({ start: 2000, end: 4000 });
  });

  it('leaves live mode and rejects invalid padding', () => {
    const { controller, snap } = setup({ rows: [{ id: 'r', label: 'R' }], source: items });
    controller.start();
    controller.goLive();
    controller.fitToItems();
    expect(snap().transport).toBe('paused');
    expect(() => controller.fitToItems(-0.1)).toThrow(TimelineValidationError);
    expect(() => controller.fitToItems(Number.NaN)).toThrow(TimelineValidationError);
  });
});

describe('viewport event', () => {
  it('fires once per change with navigation or zoom origin, never on a no-op', () => {
    const { controller } = setup({ viewport: { start: 0, end: 2000 } });
    controller.start();
    const events = record(controller);
    controller.setViewport({ start: 1000, end: 3000 });
    expect(events).toEqual([{ viewport: { start: 1000, end: 3000 }, previous: { start: 0, end: 2000 }, origin: 'navigation' }]);
    controller.setViewport({ start: 1000, end: 3000 });
    controller.panBy(0);
    controller.centerOn(2000);
    expect(events).toHaveLength(1);
    controller.panBy(500);
    expect(events[1]).toMatchObject({ viewport: { start: 1500, end: 3500 }, origin: 'navigation' });
    controller.zoomBy(2, 2500);
    expect(events[2]).toMatchObject({ viewport: { start: 2000, end: 3000 }, origin: 'zoom' });
    controller.zoomTo(2000, 2500);
    expect(events[3]).toMatchObject({ viewport: { start: 1500, end: 3500 }, origin: 'zoom' });
    controller.zoomTo(2000, 2500);
    controller.centerOn(5000);
    expect(events[4]).toMatchObject({ viewport: { start: 4000, end: 6000 }, origin: 'navigation' });
    controller.fitToItems();
    expect(events[5]).toMatchObject({ viewport: { start: 0, end: 10_000 }, origin: 'navigation' });
    controller.fitToItems();
    controller.zoomBy(0.5);
    expect(events).toHaveLength(6);
  });

  it('is emitted after the state update and before subscribers', () => {
    const { controller, snap } = setup({ viewport: { start: 0, end: 2000 } });
    controller.start();
    const order: string[] = [];
    controller.on('viewport', ({ viewport }) => {
      expect(snap().viewport).toEqual(viewport);
      order.push('viewport');
    });
    controller.subscribe(() => order.push('subscribe'));
    controller.panBy(100);
    expect(order).toEqual(['viewport', 'subscribe']);
  });

  it('reports follow during playback', () => {
    const { controller, scheduler } = setup({ viewport: { start: 0, end: 1000 } });
    controller.start();
    const events = record(controller);
    controller.play();
    scheduler.advance(900);
    expect(events).toEqual([]);
    scheduler.advance(200);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.origin === 'follow')).toBe(true);
    expect(events[0]!.previous).toEqual({ start: 0, end: 1000 });
  });

  it('reports follow for a seek outside the viewport and for live mode', () => {
    const { controller } = setup({ viewport: { start: 0, end: 1000 }, liveTime: 5000 });
    controller.start();
    const events = record(controller);
    controller.seek(3000);
    expect(events).toEqual([{ viewport: { start: 2500, end: 3500 }, previous: { start: 0, end: 1000 }, origin: 'follow' }]);
    controller.goLive();
    expect(events[1]).toMatchObject({ viewport: { start: 4100, end: 5100 }, origin: 'follow' });
    controller.setLiveTime(6000);
    expect(events[2]).toMatchObject({ viewport: { start: 5100, end: 6100 }, origin: 'follow' });
    controller.setLiveTime(6000);
    expect(events).toHaveLength(3);
  });

  it('reports domain for a re-fit after extendDomain, then follow for live', () => {
    const { controller, snap } = setup({ domain: { start: 0, end: 50 }, minViewportDuration: 100 });
    controller.start();
    expect(snap().viewport).toEqual({ start: 0, end: 50 });
    const events = record(controller);
    controller.extendDomain(1000);
    expect(events).toEqual([{ viewport: { start: 0, end: 100 }, previous: { start: 0, end: 50 }, origin: 'domain' }]);

    controller.goLive();
    expect(events.slice(1).map((event) => event.origin)).toEqual(['follow']);
    expect(snap().viewport).toEqual({ start: 900, end: 1000 });
    controller.extendDomain(2000, 1500);
    expect(events.slice(2)).toEqual([{ viewport: { start: 1410, end: 1510 }, previous: { start: 900, end: 1000 }, origin: 'follow' }]);
    // Extending the domain without effect on the viewport emits nothing.
    controller.pause();
    controller.extendDomain(3000);
    expect(events).toHaveLength(3);
  });

  it('delivers changes made by a listener, in order, in a single notification', () => {
    const { controller } = setup({ viewport: { start: 0, end: 2000 } });
    controller.start();
    const events = record(controller);
    let notifications = 0;
    controller.subscribe(() => notifications++);
    const stop = controller.on('viewport', () => {
      stop();
      controller.panBy(100);
    });
    controller.panBy(100);
    expect(events.map((event) => event.viewport.start)).toEqual([100, 200]);
    expect(notifications).toBe(1);
  });
});
