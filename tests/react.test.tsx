// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PlaybackControls,
  Timeline,
  frenchLabels,
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
    fireEvent.pointerMove(axis, { pointerId: 2, clientX: 300, buttons: 1 });
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

describe('announcements', () => {
  it('does not update the slider value on every playback frame', () => {
    const { controller, scheduler } = makeController();
    render(<Timeline controller={controller} />);
    const slider = screen.getByRole('slider');
    act(() => controller.play());
    act(() => scheduler.advance(500));
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
    act(() => controller.pause());
    expect(slider.getAttribute('aria-valuenow')).toBe('500');
    act(() => controller.seek(2000));
    expect(slider.getAttribute('aria-valuenow')).toBe('2000');
  });
});

describe('axis', () => {
  it('key markers jump to their key and expose an accessible name', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: /Key Alerte/ }));
    expect(controller.getSnapshot().time).toBe(4000);
    expect(controller.getSnapshot().lastCause).toBe('key');
  });

  it('shows the pending target separately from the confirmed cursor', async () => {
    let release!: () => void;
    const { controller } = makeController({
      prepareTime: (request) => (request.cause === 'seek' ? new Promise<void>((resolve) => (release = resolve)) : undefined),
    });
    const { container } = render(<Timeline controller={controller} />);
    act(() => controller.seek(6000));
    expect(container.querySelector('.tw-pending-line')).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 450)));
    expect(screen.getByRole('status').textContent).toMatch(/Preparing/);
    await act(async () => release());
    expect(container.querySelector('.tw-pending-line')).toBeNull();
  });

  it('zoom buttons are always available', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const zoomed = controller.getSnapshot().viewport;
    expect(zoomed.end - zoomed.start).toBeLessThan(10_000);
    fireEvent.click(screen.getByRole('button', { name: 'Show the whole period' }));
    expect(controller.getSnapshot().viewport).toEqual({ start: 0, end: 10_000 });
  });
});

describe('DetailModal', () => {
  it('keeps Tab inside the dialog and closes on backdrop click', async () => {
    const { DetailModal } = await import('../src/react/index.js');
    const onClose = vi.fn();
    render(
      <DetailModal title="Titre" onClose={onClose}>
        <a href="#x">lien</a>
      </DetailModal>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    const link = screen.getByRole('link');
    expect(document.activeElement).toBe(close);
    act(() => link.focus());
    fireEvent.keyDown(link, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(link);
    fireEvent.mouseDown(document.querySelector('.tw-modal-backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('review regressions (React)', () => {
  function rect(element: Element) {
    (element as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 800, bottom: 40, width: 800, height: 40, x: 0, y: 0, toJSON() {} }) as DOMRect;
  }

  it('a cursor drag seeks once per move and stops when no button is pressed', () => {
    const seeks: number[] = [];
    const { controller } = makeController({ prepareTime: (r) => void (r.cause === 'seek' && seeks.push(r.target)) });
    const { container } = render(<Timeline controller={controller} />);
    const axis = screen.getByRole('slider');
    rect(axis);
    const handle = container.querySelector('.tw-cursor-handle')!;
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 0 });
    fireEvent.pointerMove(axis, { pointerId: 1, clientX: 400, buttons: 1 });
    expect(seeks).toEqual([5000]);
    fireEvent.pointerMove(axis, { pointerId: 1, clientX: 600, buttons: 0 });
    fireEvent.pointerMove(axis, { pointerId: 1, clientX: 700, buttons: 0 });
    expect(seeks).toEqual([5000]);
  });

  it('removing an item does not steal focus from another control', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} toolbar={<input aria-label="filtre" />} />);
    act(() => screen.getByRole('button', { name: /Mesure 1/ }).focus());
    const input = screen.getByRole('textbox', { name: 'filtre' });
    act(() => input.focus());
    act(() => controller.update({ items: { remove: ['i1'] } }));
    expect(document.activeElement).toBe(input);
  });

  it('an off-screen item is revealed before activation', () => {
    const { controller } = makeController();
    const onItemClick = vi.fn();
    render(<Timeline controller={controller} onItemClick={onItemClick} />);
    const item = screen.getByRole('button', { name: /Mesure 1/ });
    act(() => item.focus());
    act(() => controller.setViewport({ start: 6000, end: 10_000 }));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    expect(onItemClick).toHaveBeenCalled();
    const viewport = controller.getSnapshot().viewport;
    expect(viewport.start).toBeLessThanOrEqual(1000);
    expect(viewport.end).toBeGreaterThanOrEqual(1000);
  });
});

describe('accessibility audit', () => {
  it('key markers are outside the slider, clickable, and Page Up / Page Down are described', () => {
    const { controller } = makeController();
    const { container } = render(<Timeline controller={controller} />);
    const slider = screen.getByRole('slider');
    const key = screen.getByRole('button', { name: /Key Alerte/ });
    expect(slider.contains(key)).toBe(false);
    expect(slider.querySelector('button, [tabindex="0"]')).toBeNull();
    expect(key.closest('.tw-keys')).not.toBeNull();
    expect(key.getAttribute('tabindex')).toBe('-1');
    const help = document.getElementById(slider.getAttribute('aria-describedby')!);
    expect(help?.textContent).toMatch(/Page Up and Page Down/);
    expect(slider.contains(help)).toBe(false);
    fireEvent.click(key);
    expect(controller.getSnapshot().time).toBe(4000);
    expect(container.querySelectorAll('.tw-key')).toHaveLength(1);
    expect(frenchLabels.cursorHelp).toMatch(/Page précédente/);
  });

  it('a grouped item without label is named by its group size, once', () => {
    const { controller } = makeController({
      source: [...items, { id: 'grp-42', rowId: 'b', at: 7000, group: { count: 5 } }],
    });
    render(<Timeline controller={controller} />);
    const button = document.querySelector('[data-item-id="grp-42"]')!;
    const name = button.getAttribute('aria-label')!;
    expect(name).toMatch(/^Group of 5, /);
    expect(name).not.toContain('grp-42');
    expect(name.match(/Group of 5/g)).toHaveLength(1);
    // A labelled group keeps its label then its size.
    expect(document.querySelector('[data-item-id="g"]')!.getAttribute('aria-label')).toMatch(/^Synthèse, Group of 12, /);
  });

  it('getItemAriaLabel replaces the accessible name of items', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} getItemAriaLabel={(item) => `Visible ${item.label ?? item.id}`} />);
    expect(screen.getByRole('button', { name: 'Visible Mesure 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Visible Cycle' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Mesure 1, / })).toBeNull();
  });

  it('the detail dialog is rendered in document.body and makes the timeline inert while open', () => {
    const { controller } = makeController();
    const { container } = render(<Timeline controller={controller} detail theme="dark" />);
    const frame = container.querySelector<HTMLElement>('.tw-timeline')!;
    const trigger = screen.getByRole('button', { name: /Cycle/ });
    act(() => trigger.focus());
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(frame.contains(dialog)).toBe(false);
    expect(dialog.closest('.tw-modal-backdrop')!.parentElement).toBe(document.body);
    expect(dialog.closest('.tw-modal-backdrop')!.getAttribute('data-theme')).toBe('dark');
    expect(frame.hasAttribute('inert')).toBe(true);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(frame.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('theme is light by default and always written to data-theme', () => {
    const { controller } = makeController();
    const { container, rerender } = render(<Timeline controller={controller} />);
    const frame = () => container.querySelector<HTMLElement>('.tw-timeline')!;
    expect(frame().getAttribute('data-theme')).toBe('light');
    rerender(<Timeline controller={controller} theme="auto" />);
    expect(frame().getAttribute('data-theme')).toBe('auto');
    rerender(<Timeline controller={controller} theme="light" />);
    expect(frame().getAttribute('data-theme')).toBe('light');
    rerender(<Timeline controller={controller} theme="dark" />);
    expect(frame().getAttribute('data-theme')).toBe('dark');
  });

  it('the detail dialog follows the theme prop, including when it changes while open', () => {
    const { controller } = makeController();
    const { rerender } = render(<Timeline controller={controller} detail theme="light" />);
    fireEvent.click(screen.getByRole('button', { name: /Cycle/ }));
    const backdrop = () => screen.getByRole('dialog').closest('.tw-modal-backdrop')!;
    expect(backdrop().getAttribute('data-theme')).toBe('light');
    rerender(<Timeline controller={controller} detail theme="dark" />);
    expect(backdrop().getAttribute('data-theme')).toBe('dark');
    rerender(<Timeline controller={controller} detail />);
    expect(backdrop().getAttribute('data-theme')).toBe('light');
  });

  it('keeps a compact "whole period" button on narrow screens', () => {
    const { controller } = makeController();
    const { container } = render(<Timeline controller={controller} initialTrackWidth={300} labelWidth={200} />);
    expect(container.querySelector('.tw-timeline')!.hasAttribute('data-narrow')).toBe(true);
    act(() => controller.zoomBy(2));
    const fit = screen.getByRole('button', { name: 'Show the whole period' });
    expect(fit.textContent).toBe('');
    fireEvent.click(fit);
    expect(controller.getSnapshot().viewport).toEqual({ start: 0, end: 10_000 });
  });

  it('tick labels near the right edge are anchored inside the track', () => {
    const { controller } = makeController();
    const { container } = render(<Timeline controller={controller} initialTrackWidth={800} />);
    const texts = Array.from(container.querySelectorAll<SVGTextElement>('.tw-tick text'));
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      const g = text.parentElement!;
      const x = Number(/translate\(([-\d.]+)/.exec(g.getAttribute('transform')!)![1]);
      const width = text.textContent!.length * 6.2;
      const end = text.getAttribute('text-anchor') === 'end' ? x - 4 : x + 4 + width;
      expect(end).toBeLessThanOrEqual(800);
    }
  });
});

describe('batch replacement reuse', () => {
  const clone = (list: readonly TimelineItem[]): TimelineItem[] => list.map((item) => ({ ...item }));

  it('an equivalent refresh does not re-render rows and hands out the current objects', () => {
    const { controller } = makeController();
    const renderRowLabel = vi.fn((row: { row: { label: string } }) => row.row.label);
    const onItemClick = vi.fn();
    const { container } = render(<Timeline controller={controller} renderRowLabel={renderRowLabel} onItemClick={onItemClick} />);
    const button = container.querySelector('[data-item-id="i2"]');
    renderRowLabel.mockClear();
    const next = clone(items);
    act(() => controller.setItems(next));
    expect(renderRowLabel).not.toHaveBeenCalled();
    expect(container.querySelector('[data-item-id="i2"]')).toBe(button);
    fireEvent.click(screen.getByRole('button', { name: /Mesure 2/ }));
    expect(onItemClick.mock.calls[0]![0]).toBe(next[1]);
  });

  it('only the rows whose items changed are re-rendered', () => {
    const { controller } = makeController();
    const renderRowLabel = vi.fn((row: { row: { id: string; label: string } }) => row.row.label);
    render(<Timeline controller={controller} renderRowLabel={renderRowLabel} />);
    renderRowLabel.mockClear();
    act(() => controller.setItems(clone(items).map((item) => (item.id === 'i3' ? { ...item, label: 'Cycle 2' } : item))));
    expect(renderRowLabel.mock.calls.map((call) => call[0].row.id)).toEqual(['b']);
    expect(screen.getByRole('button', { name: /Cycle 2/ })).toBeTruthy();
    // Moved times change the order and the lanes of that row only.
    renderRowLabel.mockClear();
    act(() => controller.setItems(clone(items).map((item) => (item.id === 'i1' ? { ...item, at: 3500 } : item))));
    expect(renderRowLabel.mock.calls.map((call) => call[0].row.id).sort()).toEqual(['a', 'b']);
  });

  it('custom item renderers receive the current objects after an equivalent refresh', () => {
    const { controller } = makeController();
    const renderItem = vi.fn((item: TimelineItem) => String(item.meta ?? ''));
    render(<Timeline controller={controller} renderItem={renderItem} />);
    act(() => controller.setItems(clone(items).map((item) => ({ ...item, meta: 'v2' }))));
    expect(screen.getAllByText('v2').length).toBeGreaterThan(0);
  });
});

describe('narrow spans', () => {
  it('render no clipped label, only a group count that fits, and keep the accessible name', () => {
    // 10 000 ms over 800 px: 12.5 ms per pixel.
    const { controller } = makeController({
      source: [
        { id: 'wide', rowId: 'a', start: 1000, end: 3000, label: 'Large' },
        { id: 'thin', rowId: 'a', start: 4000, end: 4200, label: 'Étroit' },
        { id: 'thin-group', rowId: 'b', start: 4000, end: 4300, label: 'Lot', group: { count: 3 } },
        { id: 'tiny-group', rowId: 'b', start: 6000, end: 6200, label: 'Lot 2', group: { count: 123 } },
      ],
    });
    const { container } = render(<Timeline controller={controller} initialTrackWidth={800} />);
    const item = (id: string): HTMLElement => container.querySelector<HTMLElement>(`[data-item-id="${id}"]`)!;
    expect(item('wide').textContent).toBe('Large');
    expect(item('thin').textContent).toBe('');
    expect(item('thin').getAttribute('aria-label')).toMatch(/^Étroit, /);
    expect(item('thin-group').textContent).toBe('3');
    expect(item('thin-group').getAttribute('aria-label')).toMatch(/^Lot, Group of 3, /);
    expect(item('tiny-group').textContent).toBe('');
    expect(item('tiny-group').getAttribute('aria-label')).toMatch(/^Lot 2, Group of 123, /);
  });
});

describe('final review regressions', () => {
  it('a pointer press on an item near the edge does not move the view', () => {
    const { controller } = makeController({ source: [{ id: 'edge', rowId: 'a', at: 5100, label: 'Bord' }] });
    act(() => controller.setViewport({ start: 0, end: 5000 }));
    render(<Timeline controller={controller} />);
    const button = screen.getByRole('button', { name: /Bord/ });
    fireEvent.pointerDown(button);
    act(() => button.focus());
    expect(controller.getSnapshot().viewport).toEqual({ start: 0, end: 5000 });
    act(() => button.blur());
    act(() => button.focus());
    expect(controller.getSnapshot().viewport.end).toBeGreaterThanOrEqual(5100);
  });

  it('auto theme ignores ancestors for the detail dialog', () => {
    const { controller } = makeController();
    render(
      <div data-theme="light">
        <Timeline controller={controller} detail theme="auto" />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cycle/ }));
    expect(document.querySelector('.tw-modal-backdrop')?.getAttribute('data-theme')).toBe('auto');
  });

  it('focus follows an item moved to another row', () => {
    const { controller } = makeController();
    render(<Timeline controller={controller} />);
    act(() => screen.getByRole('button', { name: /Mesure 1/ }).focus());
    act(() => controller.update({ items: { upsert: [{ id: 'i1', rowId: 'b', at: 1000, label: 'Mesure 1' }] } }));
    expect(document.activeElement?.getAttribute('data-item-id')).toBe('i1');
    expect(document.activeElement?.closest('[data-row-id]')?.getAttribute('data-row-id')).toBe('b');
  });
});

describe('review fixes: keyboard, announcements, dialog, live', () => {
  it('keeps a tab stop on the nearest item when none intersects the viewport', () => {
    const { controller } = makeController();
    act(() => controller.setViewport({ start: 8000, end: 10_000 }));
    const { container } = render(<Timeline controller={controller} />);
    const tabbable = container.querySelectorAll<HTMLElement>('.tw-item[tabindex="0"]');
    expect(tabbable).toHaveLength(1);
    // i3 ends at 6000: the closest item in time to the viewport.
    expect(tabbable[0]!.getAttribute('data-item-id')).toBe('i3');
    act(() => tabbable[0]!.focus());
    const viewport = controller.getSnapshot().viewport;
    expect(viewport.start).toBeLessThanOrEqual(6000);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(['i1', 'i2']).toContain(document.activeElement?.getAttribute('data-item-id'));
  });

  it('a new controller does not inherit the delayed announcement of the previous one', async () => {
    const slow = () => makeController({ prepareTime: (r) => (r.cause === 'seek' ? new Promise<void>(() => {}) : undefined) });
    const first = slow().controller;
    const { rerender } = render(<Timeline controller={first} />);
    act(() => first.seek(6000));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 450)));
    expect(screen.getByRole('status').textContent).toMatch(/Preparing/);
    const second = slow().controller;
    rerender(<Timeline controller={second} />);
    act(() => second.seek(7000));
    expect(second.getSnapshot().pending?.id).toBe(first.getSnapshot().pending?.id);
    expect(screen.getByRole('status').textContent).toBe('');
    await act(async () => new Promise((resolve) => setTimeout(resolve, 450)));
    expect(screen.getByRole('status').textContent).toMatch(/Preparing/);
  });

  it('DetailModal moves inert to a new inertRoot while open', async () => {
    const { DetailModal } = await import('../src/react/index.js');
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    const { rerender, unmount } = render(<DetailModal title="T" onClose={() => {}} inertRoot={a} />);
    expect(a.hasAttribute('inert')).toBe(true);
    rerender(<DetailModal title="T" onClose={() => {}} inertRoot={b} />);
    expect(a.hasAttribute('inert')).toBe(false);
    expect(b.hasAttribute('inert')).toBe(true);
    unmount();
    expect(b.hasAttribute('inert')).toBe(false);
    a.remove();
    b.remove();
  });

  it('PlaybackControls show Pause in live mode', () => {
    const { controller } = makeController();
    render(<PlaybackControls controller={controller} showLive />);
    act(() => controller.goLive());
    expect(controller.getSnapshot().transport).toBe('live');
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(controller.getSnapshot().transport).toBe('paused');
  });

  it('Space activates an item exactly once', () => {
    const { controller } = makeController();
    const onItemClick = vi.fn();
    render(<Timeline controller={controller} onItemClick={onItemClick} />);
    const button = screen.getByRole('button', { name: /Mesure 2/ });
    act(() => button.focus());
    // A browser fires keydown, keyup, then the native click of the button.
    fireEvent.keyDown(button, { key: ' ', code: 'Space' });
    fireEvent.keyUp(button, { key: ' ', code: 'Space' });
    fireEvent.click(button);
    expect(onItemClick).toHaveBeenCalledTimes(1);
  });
});
