// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PlaybackControls,
  Timeline,
  createManualScheduler,
  createTimelineController,
  useTimelineController,
  useTimelineSnapshot,
} from '../src/react/index.js';
import type { TimelineController, TimelineItem } from '../src/react/index.js';

afterEach(cleanup);

const rows = [
  { id: 'root', label: 'Connecteurs' },
  { id: 'a', label: 'Réseau A', parentId: 'root' },
  { id: 'b', label: 'Réseau B', parentId: 'root' },
];
const items: TimelineItem[] = [
  { id: 'i1', rowId: 'a', at: 1000, label: 'Mesure 1' },
  { id: 'i2', rowId: 'a', at: 3000, label: 'Mesure 2' },
  { id: 'i3', rowId: 'b', start: 2000, end: 6000, label: 'Cycle' },
  { id: 'g', rowId: 'root', at: 2500, label: 'Synthèse', group: { count: 12 } },
];

function makeController(extra: Partial<Parameters<typeof createTimelineController>[0]> = {}) {
  const scheduler = createManualScheduler();
  const controller = createTimelineController({
    mode: 'relative',
    domain: { start: 0, end: 10_000 },
    rows,
    source: items,
    keys: [{ id: 'k1', at: 4000, label: 'Alerte' }],
    expanded: ['root'],
    scheduler,
    ...extra,
  });
  controller.start();
  return { controller, scheduler };
}

describe('Timeline', () => {
  it('renders rows, items and expands with accessible buttons', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    expect(screen.getByText('Connecteurs')).toBeTruthy();
    expect(screen.getByText('Réseau A')).toBeTruthy();
    const toggle = screen.getByRole('button', { name: 'Collapse Connecteurs' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(screen.queryByText('Réseau A')).toBeNull();
    expect(controller.getSnapshot().expanded.has('root')).toBe(false);
    // The parent keeps the representation supplied by the application.
    expect(screen.getByRole('button', { name: /Synthèse, Group of 12/ })).toBeTruthy();
  });

  it('item click reaches the application and does not move time', () => {
    const { controller } = makeController();
    const onItemClick = vi.fn();
    render(<Timeline controller={controller} onItemClick={onItemClick} />);
    fireEvent.click(screen.getByRole('button', { name: /Mesure 2/ }));
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick.mock.calls[0]![0].id).toBe('i2');
    expect(onItemClick.mock.calls[0]![1].row.row.id).toBe('a');
    expect(controller.getSnapshot().time).toBe(0);
  });

  it('the cursor slider is keyboard operable', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    const slider = screen.getByRole('slider', { name: 'Current time' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(controller.getSnapshot().time).toBe(200);
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(controller.getSnapshot().time).toBe(4000);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(controller.getSnapshot().time).toBe(10_000);
    fireEvent.keyDown(slider, { key: '+' });
    expect(controller.getSnapshot().viewport.end - controller.getSnapshot().viewport.start).toBeLessThan(10_000);
  });

  it('items use a single tab stop and arrow keys move between them', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    const tabbable = document.querySelectorAll('.tw-item[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
    const first = screen.getByRole('button', { name: /Mesure 1/ });
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('data-item-id')).toBe('i2');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('data-item-id')).toBe('i3');
  });

  it('a removed item leaves focus without losing the keyboard position', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    const item = screen.getByRole('button', { name: /Mesure 1/ });
    act(() => item.focus());
    act(() => controller.update({ items: { remove: ['i1'] } }));
    expect(document.activeElement?.getAttribute('role')).toBe('slider');
  });

  it('the optional detail dialog traps focus, closes on Escape and returns focus', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} detail />);
    const trigger = screen.getByRole('button', { name: /Cycle/ });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Réseau B');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('shows a tooltip on focus', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    const item = screen.getByRole('button', { name: /Synthèse/ });
    act(() => item.focus());
    expect(screen.getByRole('tooltip').textContent).toContain('Group of 12');
  });

  it('announces waits and errors, not playback frames', async () => {
    let fail = false;
    const { controller, scheduler } = makeController({
      prepareTime: () => (fail ? Promise.reject(new Error('x')) : undefined),
    });
    render(<Timeline controller={controller} />);
    const status = screen.getByRole('status');
    act(() => controller.play());
    act(() => scheduler.advance(100));
    expect(status.textContent).toBe('');
    fail = true;
    await act(async () => controller.seek(5000));
    expect(status.textContent).toMatch(/Could not prepare/);
  });
});

describe('integration hooks', () => {
  function Harness({ onController }: { onController: (c: TimelineController) => void }) {
    const [scheduler] = useState(() => createManualScheduler());
    const controller = useTimelineController({ domain: { start: 0, end: 1000 }, mode: 'relative', scheduler });
    onController(controller);
    const snap = useTimelineSnapshot(controller);
    return <output data-testid="time">{snap.time}</output>;
  }

  it('creates one stable instance under StrictMode without a second clock', () => {
    const seen = new Set<TimelineController>();
    const { unmount } = render(
      <StrictMode>
        <Harness onController={(c) => seen.add(c)} />
      </StrictMode>,
    );
    // StrictMode may call the initializer twice, but one instance is kept for renders.
    const used = Array.from(seen).filter((c) => c.getSnapshot().status === 'ready');
    expect(used).toHaveLength(1);
    const controller = used[0]!;
    expect(controller.isActive()).toBe(true);
    unmount();
    expect(controller.isActive()).toBe(false);
  });

  it('PlaybackControls drive the same controller', () => {
    const { controller, scheduler } = makeController();
    render(<PlaybackControls controller={controller} showLive />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(controller.getSnapshot().transport).toBe('playing');
    act(() => scheduler.advance(100));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(controller.getSnapshot().transport).toBe('paused');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '4' } });
    expect(controller.getSnapshot().speed).toBe(4);
    fireEvent.click(screen.getByRole('button', { name: 'Next key' }));
    expect(controller.getSnapshot().time).toBe(4000);
    expect((screen.getByRole('button', { name: 'Next key' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Live/ }));
    expect(controller.getSnapshot().transport).toBe('live');
  });
});

describe('pointer gestures', () => {
  function rect(element: Element) {
    (element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 40, width: 800, height: 40, x: 0, y: 0, toJSON() {} }) as DOMRect;
  }

  it('click on the background seeks; dragging pans without seeking', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    const axis = screen.getByRole('slider');
    rect(axis);
    fireEvent.pointerDown(axis, { pointerId: 1, button: 0, clientX: 400 });
    fireEvent.pointerUp(axis, { pointerId: 1, button: 0, clientX: 400 });
    expect(controller.getSnapshot().time).toBe(5000);
    act(() => controller.zoomBy(2));
    const before = controller.getSnapshot().viewport.start;
    fireEvent.pointerDown(axis, { pointerId: 2, button: 0, clientX: 400 });
    fireEvent.pointerMove(axis, { pointerId: 2, clientX: 300 });
    fireEvent.pointerUp(axis, { pointerId: 2, button: 0, clientX: 300 });
    expect(controller.getSnapshot().viewport.start).toBeGreaterThan(before);
    expect(controller.getSnapshot().time).toBe(5000);
  });

  it('two-finger pinch zooms around the fingers', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    const axis = screen.getByRole('slider');
    rect(axis);
    fireEvent.pointerDown(axis, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 300 });
    fireEvent.pointerDown(axis, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 500 });
    fireEvent.pointerMove(axis, { pointerId: 2, pointerType: 'touch', clientX: 700 });
    const viewport = controller.getSnapshot().viewport;
    expect(viewport.end - viewport.start).toBeCloseTo(5000);
    fireEvent.pointerUp(axis, { pointerId: 2, pointerType: 'touch', clientX: 700 });
    fireEvent.pointerUp(axis, { pointerId: 1, pointerType: 'touch', clientX: 300 });
    expect(controller.getSnapshot().time).toBe(0);
  });
});

describe('host lifecycle', () => {
  it('pauses progression while the page is hidden and resumes without catch-up', () => {
    const scheduler = createManualScheduler();
    function Host() {
      const controller = useTimelineController({ domain: { start: 0, end: 100_000 }, mode: 'relative', scheduler });
      (globalThis as { __c?: TimelineController }).__c = controller;
      return null;
    }
    render(<Host />);
    const controller = (globalThis as { __c?: TimelineController }).__c!;
    act(() => controller.play());
    act(() => scheduler.advance(100));
    expect(controller.getSnapshot().time).toBeCloseTo(100);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => scheduler.advance(5000));
    expect(controller.getSnapshot().time).toBeCloseTo(100);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => scheduler.advance(50));
    expect(controller.getSnapshot().time).toBeCloseTo(150);
  });
});
