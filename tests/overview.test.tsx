// @vitest-environment jsdom
import { Profiler } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TimelineOverview,
  createManualScheduler,
  createTimelineController,
  frenchLabels,
} from '../src/react/index.js';
import type { TimelineItem } from '../src/react/index.js';
import { computeOverviewDensity } from '../src/react/TimelineOverview.js';

afterEach(cleanup);

const rows = [{ id: 'a', label: 'A' }];
const items: TimelineItem[] = [
  { id: 'p1', rowId: 'a', at: 500 },
  { id: 'p2', rowId: 'a', at: 700 },
  { id: 'g', rowId: 'a', at: 5500, group: { count: 5 } },
  { id: 's', rowId: 'a', start: 2000, end: 4000 },
];

function makeController(extra: Partial<Parameters<typeof createTimelineController>[0]> = {}) {
  const scheduler = createManualScheduler();
  const controller = createTimelineController({
    mode: 'relative',
    domain: { start: 0, end: 10_000 },
    viewport: { start: 2000, end: 4000 },
    minViewportDuration: 1000,
    // The cursor (0) is outside the viewport: following would move the view.
    followPlayback: false,
    rows,
    source: items,
    keys: [{ id: 'k', at: 6000 }],
    scheduler,
    ...extra,
  });
  controller.start();
  return { controller, scheduler };
}

/** The strip is 800 px wide: 1 px = 12.5 ms of the 10 s domain. */
function mockTrack(container: HTMLElement) {
  const track = container.querySelector('.tw-overview-track') as HTMLElement;
  track.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 48, width: 800, height: 48, x: 0, y: 0, toJSON() {} }) as DOMRect;
  return track;
}

const windowOf = () => screen.getByRole('scrollbar', { name: 'Visible window' });

describe('computeOverviewDensity', () => {
  it('counts points, spans and group weights per column', () => {
    const bins = computeOverviewDensity(items, { start: 0, end: 10_000 }, 10);
    expect(bins).toEqual([2, 0, 1, 1, 0, 5, 0, 0, 0, 0]);
  });

  it('ignores items outside the domain and clamps the last instant', () => {
    const bins = computeOverviewDensity(
      [
        { id: 'a', rowId: 'a', at: -1 },
        { id: 'b', rowId: 'a', at: 10_000 },
        { id: 'c', rowId: 'a', start: -500, end: 100 },
      ],
      { start: 0, end: 10_000 },
      4,
    );
    expect(bins).toEqual([1, 0, 0, 1]);
  });
});

describe('TimelineOverview', () => {
  it('renders the window at the viewport position with an accessible scrollbar', () => {
    const { controller } = makeController();
    const { container } = render(<TimelineOverview controller={controller} />);
    const win = windowOf();
    expect(win.style.left).toBe('160px');
    expect(win.style.width).toBe('160px');
    expect(win.getAttribute('aria-orientation')).toBe('horizontal');
    expect(win.getAttribute('aria-valuenow')).toBe('25');
    expect(win.getAttribute('aria-valuetext')).toMatch(/ to /);
    expect(win.tabIndex).toBe(0);
    expect(screen.getByRole('group', { name: 'Overview' })).toBeTruthy();
    expect(container.querySelectorAll('.tw-overview-key')).toHaveLength(1);
    expect(container.querySelector('.tw-overview-density')?.getAttribute('d')).toBeTruthy();
    expect(container.querySelector('.tw-overview-coverage')).toBeTruthy();
  });

  it('uses the given labels', () => {
    const { controller } = makeController();
    render(<TimelineOverview controller={controller} labels={frenchLabels} />);
    expect(screen.getByRole('scrollbar', { name: 'Fenêtre visible' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Vue d’ensemble' })).toBeTruthy();
  });

  it('dragging the window pans without seeking or leaving its size', () => {
    const { controller } = makeController();
    const { container } = render(<TimelineOverview controller={controller} />);
    const track = mockTrack(container);
    const win = windowOf();
    fireEvent.pointerDown(win, { pointerId: 1, button: 0, clientX: 200 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 280, buttons: 1 });
    fireEvent.pointerUp(track, { pointerId: 1, button: 0, clientX: 280 });
    expect(controller.getSnapshot().viewport).toEqual({ start: 3000, end: 5000 });
    expect(controller.getSnapshot().time).toBe(0);
    // A move after a missed release does nothing.
    fireEvent.pointerDown(win, { pointerId: 2, button: 0, clientX: 300 });
    fireEvent.pointerMove(track, { pointerId: 2, clientX: 400, buttons: 0 });
    fireEvent.pointerMove(track, { pointerId: 2, clientX: 500, buttons: 1 });
    expect(controller.getSnapshot().viewport).toEqual({ start: 3000, end: 5000 });
  });

  it('dragging an edge resizes the window and respects the minimum duration', () => {
    const { controller } = makeController();
    const { container } = render(<TimelineOverview controller={controller} />);
    const track = mockTrack(container);
    const end = container.querySelector('[data-edge="end"]') as HTMLElement;
    fireEvent.pointerDown(end, { pointerId: 1, button: 0, clientX: 320 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 480, buttons: 1 });
    expect(controller.getSnapshot().viewport).toEqual({ start: 2000, end: 6000 });
    fireEvent.pointerUp(track, { pointerId: 1, button: 0, clientX: 480 });
    const start = container.querySelector('[data-edge="start"]') as HTMLElement;
    fireEvent.pointerDown(start, { pointerId: 2, button: 0, clientX: 160 });
    fireEvent.pointerMove(track, { pointerId: 2, clientX: 700, buttons: 1 });
    fireEvent.pointerUp(track, { pointerId: 2, button: 0, clientX: 700 });
    // The right edge stays put; the window keeps the 1 s minimum.
    expect(controller.getSnapshot().viewport).toEqual({ start: 5000, end: 6000 });
  });

  it('a click outside the window centres the view there without seeking', () => {
    const { controller } = makeController();
    const { container } = render(<TimelineOverview controller={controller} />);
    const track = mockTrack(container);
    fireEvent.pointerDown(track, { pointerId: 1, button: 0, clientX: 640 });
    fireEvent.pointerUp(track, { pointerId: 1, button: 0, clientX: 640 });
    expect(controller.getSnapshot().viewport).toEqual({ start: 7000, end: 9000 });
    expect(controller.getSnapshot().time).toBe(0);
    expect(windowOf().style.left).toBe('560px');
  });

  it('the wheel pans the view', () => {
    const { controller } = makeController();
    const { container } = render(<TimelineOverview controller={controller} />);
    const track = mockTrack(container);
    act(() => {
      track.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true }));
    });
    expect(controller.getSnapshot().viewport).toEqual({ start: 2500, end: 4500 });
  });

  it('is keyboard operable', () => {
    const { controller } = makeController();
    render(<TimelineOverview controller={controller} />);
    const win = windowOf();
    fireEvent.keyDown(win, { key: 'ArrowRight' });
    expect(controller.getSnapshot().viewport).toEqual({ start: 2200, end: 4200 });
    fireEvent.keyDown(win, { key: 'ArrowLeft', shiftKey: true });
    expect(controller.getSnapshot().viewport).toEqual({ start: 1200, end: 3200 });
    fireEvent.keyDown(win, { key: 'End' });
    expect(controller.getSnapshot().viewport).toEqual({ start: 8000, end: 10_000 });
    expect(win.getAttribute('aria-valuenow')).toBe('100');
    fireEvent.keyDown(win, { key: 'Home' });
    expect(controller.getSnapshot().viewport).toEqual({ start: 0, end: 2000 });
    fireEvent.keyDown(win, { key: '-' });
    expect(controller.getSnapshot().viewport.end - controller.getSnapshot().viewport.start).toBeCloseTo(3200);
    fireEvent.keyDown(win, { key: '+' });
    fireEvent.keyDown(win, { key: '+' });
    expect(controller.getSnapshot().viewport.end - controller.getSnapshot().viewport.start).toBeCloseTo(1250);
    expect(controller.getSnapshot().time).toBe(0);
  });

  it('shows the live frontier only when it is relevant', () => {
    const { controller } = makeController();
    const { container } = render(<TimelineOverview controller={controller} />);
    expect(container.querySelector('.tw-overview-live')).toBeNull();
    cleanup();
    const live = makeController({ domain: { start: 0, end: 10_000 }, liveTime: 5000 }).controller;
    const { container: second } = render(<TimelineOverview controller={live} />);
    expect((second.querySelector('.tw-overview-live') as HTMLElement).style.transform).toBe('translateX(400px)');
    act(() => live.setLiveTime(6000));
    expect((second.querySelector('.tw-overview-live') as HTMLElement).style.transform).toBe('translateX(480px)');
  });

  it('can hide the density histogram', () => {
    const { controller } = makeController();
    const { container } = render(<TimelineOverview controller={controller} showDensity={false} />);
    expect(container.querySelector('.tw-overview-density')).toBeNull();
  });

  it('playback moves the cursor without recomputing the histogram or rendering the strip', () => {
    // Items count the reads of their time: binning reads every item once.
    let reads = 0;
    const counted: TimelineItem[] = Array.from({ length: 50 }, (_, index) => {
      const item = { id: `c${index}`, rowId: 'a' } as { id: string; rowId: string; at: number };
      Object.defineProperty(item, 'at', {
        enumerable: true,
        get() {
          reads += 1;
          return index * 100;
        },
      });
      return item;
    });
    const { controller, scheduler } = makeController({ source: counted, viewport: { start: 0, end: 10_000 }, followPlayback: false });
    const commits: string[] = [];
    // The strip formats its window text on every render of its own.
    let stripRenders = 0;
    const labels = { overviewRange: (start: string, end: string) => (stripRenders += 1, `${start}–${end}`) };
    const { container } = render(
      <Profiler id="overview" onRender={(_id, phase) => commits.push(phase)}>
        <TimelineOverview controller={controller} labels={labels} />
      </Profiler>,
    );
    const cursor = container.querySelector('.tw-overview-cursor') as HTMLElement;
    const density = container.querySelector('.tw-overview-density');
    const windowBefore = windowOf();
    act(() => controller.play());
    act(() => scheduler.frame(16));
    reads = 0;
    stripRenders = 0;
    const commitsBefore = commits.length;
    for (let i = 0; i < 20; i += 1) act(() => scheduler.frame(16));
    expect(controller.getSnapshot().time).toBeGreaterThan(300);
    expect(reads).toBe(0);
    expect(stripRenders).toBe(0);
    // One commit per frame, each from the cursor alone.
    expect(commits.length - commitsBefore).toBeLessThanOrEqual(20);
    expect(cursor.style.transform).toMatch(/translateX\(2[0-9.]+px\)/);
    expect(container.querySelector('.tw-overview-density')).toBe(density);
    expect(windowOf()).toBe(windowBefore);
  });
});
