import { describe, expect, it } from 'vitest';
import { TimelineValidationError } from '../src/core/index.js';
import type { WindowRequest } from '../src/core/index.js';
import { flush, setup } from './helpers.js';

const rows = [
  { id: 'root', label: 'Root' },
  { id: 'a', label: 'A', parentId: 'root' },
  { id: 'a1', label: 'A1', parentId: 'a' },
  { id: 'b', label: 'B', parentId: 'root' },
];

describe('collections API', () => {
  it('setRows keeps expansion of remaining rows and prunes items of removed rows', () => {
    const { controller, snap } = setup({ rows, source: [{ id: 'x', rowId: 'a1', at: 1 }, { id: 'y', rowId: 'b', at: 2 }], expanded: ['root', 'a'] });
    controller.setRows(rows.filter((row) => row.id !== 'a1'));
    expect(snap().items.map((i) => i.id)).toEqual(['y']);
    expect([...snap().expanded]).toEqual(['root', 'a']);
    expect(snap().visibleRows.find((r) => r.row.id === 'a')).toMatchObject({ hasChildren: false, expanded: false });
    controller.setRows(rows.filter((row) => row.id !== 'a' && row.id !== 'a1'));
    expect([...snap().expanded]).toEqual(['root']);
    expect(() => controller.setRows([{ id: 'z', label: 'Z', parentId: 'z' }])).toThrow(TimelineValidationError);
  });

  it('setKeys replaces keys and validates them', () => {
    const { controller, snap } = setup();
    controller.setKeys([{ id: 'k', at: 100 }]);
    expect(snap().keyInstants).toEqual([100]);
    expect(() => controller.setKeys([{ id: 'k', at: Number.POSITIVE_INFINITY }])).toThrow(TimelineValidationError);
  });

  it('setSource switches between static and windowed sources', async () => {
    const requests: WindowRequest[] = [];
    const { controller, snap } = setup({ rows, source: [{ id: 'x', rowId: 'a', at: 1 }] });
    controller.start();
    expect(snap().sourceKind).toBe('static');
    controller.setSource({ kind: 'windowed', load: (request) => (requests.push(request), { range: request.range, items: [] }) });
    await flush();
    expect(snap().sourceKind).toBe('windowed');
    expect(requests.at(-1)?.reason).toBe('source');
    controller.setSource([{ id: 'y', rowId: 'b', at: 3 }]);
    expect(snap().items.map((i) => i.id)).toEqual(['y']);
    expect(snap().data.coverage).toEqual(snap().domain);
    expect(() => controller.setSource([{ id: 'bad', rowId: 'nope', at: 1 }])).toThrow(TimelineValidationError);
  });

  it('expandAll, collapseAll and setExpanded ignore unknown ids', () => {
    const { controller, snap } = setup({ rows });
    controller.expandAll();
    expect(snap().visibleRows.map((r) => r.row.id)).toEqual(['root', 'a', 'a1', 'b']);
    controller.collapseAll();
    expect(snap().visibleRows.map((r) => r.row.id)).toEqual(['root']);
    controller.setExpanded(['root', 'ghost']);
    expect([...snap().expanded]).toEqual(['root']);
    controller.toggle('root');
    expect(snap().expanded.size).toBe(0);
  });
});

describe('options API', () => {
  it('without follow, a destination outside the viewport does not move it', () => {
    const { controller, snap } = setup({ viewport: { start: 0, end: 1000 }, followPlayback: false });
    controller.seek(5000);
    expect(snap().viewport).toEqual({ start: 0, end: 1000 });
    controller.setFollowPlayback(true);
    controller.seek(6000);
    expect(snap().viewport.start).toBeGreaterThan(0);
  });

  it('setRewindDuration validates and is applied to the next rewind', () => {
    const { controller, scheduler, snap } = setup({ initialTime: 5000 });
    expect(() => controller.setRewindDuration(-1)).toThrow(TimelineValidationError);
    controller.setRewindDuration(0);
    controller.rewindTo(1000);
    expect(snap().time).toBe(1000);
    controller.setRewindDuration(1000);
    controller.rewindTo(0);
    scheduler.advance(500);
    expect(snap().rewinding).toBe(true);
  });

  it('extendDomain with an explicit live time keeps it explicit afterwards', () => {
    const { controller, snap } = setup({ domain: { start: 0, end: 1000 } });
    controller.extendDomain(2000, 1500);
    expect(snap().liveTime).toBe(1500);
    controller.extendDomain(3000);
    expect(snap().liveTime).toBe(1500);
    expect(() => controller.extendDomain(4000, 5000)).toThrow(TimelineValidationError);
  });

  it('waitForData rejects when its signal aborts', async () => {
    const { controller } = setup({ rows, source: { kind: 'windowed', load: () => new Promise(() => {}) } });
    controller.start();
    const abort = new AbortController();
    const wait = controller.waitForData(5000, abort.signal);
    abort.abort();
    await expect(wait).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('togglePlay alternates play and pause; event listeners can be removed', () => {
    const { controller, scheduler, snap } = setup();
    let count = 0;
    const off = controller.on('time', () => count++);
    controller.togglePlay();
    expect(snap().transport).toBe('playing');
    scheduler.frame(16);
    off();
    scheduler.frame(16);
    controller.togglePlay();
    expect(snap().transport).toBe('paused');
    expect(count).toBe(2); // initial + one frame
  });

  it('a new scheduler takes over progression without catch-up', async () => {
    const { controller, scheduler, snap } = setup();
    controller.play();
    scheduler.advance(100);
    const { createManualScheduler } = await import('../src/core/index.js');
    const next = createManualScheduler(50_000);
    controller.setScheduler(next);
    scheduler.advance(1000);
    expect(snap().time).toBeCloseTo(100);
    next.advance(100);
    expect(snap().time).toBeCloseTo(200);
  });
});
