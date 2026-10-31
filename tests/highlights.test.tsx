// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// Imported from the modules themselves: the public index is edited in parallel.
import { createManualScheduler, createTimelineController } from '../src/core/index.js';
import type { TimelineItem } from '../src/core/index.js';
import { Timeline } from '../src/react/Timeline.js';
import type { TimelineHighlight } from '../src/react/Timeline.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rows = [
  { id: 'a', label: 'Réseau A' },
  { id: 'b', label: 'Réseau B' },
];
const items: TimelineItem[] = [
  { id: 'i1', rowId: 'a', at: 1000, label: 'Mesure 1' },
  { id: 'i2', rowId: 'b', start: 2000, end: 6000, label: 'Cycle' },
];

function makeController() {
  const controller = createTimelineController({
    mode: 'relative',
    domain: { start: 0, end: 10_000 },
    rows,
    source: items,
    scheduler: createManualScheduler(),
  });
  controller.start();
  return controller;
}

const band = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`.tw-highlight[data-highlight-id="${id}"]`);

function rect(element: Element) {
  (element as HTMLElement).getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 800, bottom: 40, width: 800, height: 40, x: 0, y: 0, toJSON() {} }) as DOMRect;
}

describe('highlight bands', () => {
  it('positions bands, clips them to the domain and viewport, and skips those outside', () => {
    const controller = makeController();
    const highlights: TimelineHighlight[] = [
      { id: 'inside', start: 2000, end: 3000, label: 'Maintenance' },
      { id: 'before', start: -1000, end: 500 },
      { id: 'after', start: 12_000, end: 13_000 },
    ];
    const { container } = render(<Timeline controller={controller} highlights={highlights} initialTrackWidth={800} />);
    const inside = band(container, 'inside')!;
    expect(inside.style.left).toBe('160px');
    expect(inside.style.width).toBe('80px');
    expect(inside.closest('.tw-grid')?.getAttribute('aria-hidden')).toBe('true');
    const before = band(container, 'before')!;
    expect(before.style.left).toBe('0px');
    expect(before.style.width).toBe('40px');
    expect(before.classList.contains('tw-highlight--clip-start')).toBe(true);
    expect(band(container, 'after')).toBeNull();

    // Zoomed on [4000, 6000]: the band [2000, 3000] leaves the view.
    act(() => controller.setViewport({ start: 4000, end: 6000 }));
    expect(band(container, 'inside')).toBeNull();
    act(() => controller.setViewport({ start: 2500, end: 4500 }));
    const clipped = band(container, 'inside')!;
    expect(clipped.style.left).toBe('0px');
    expect(clipped.style.width).toBe('200px');
    expect(clipped.classList.contains('tw-highlight--clip-start')).toBe(true);
    expect(clipped.classList.contains('tw-highlight--clip-end')).toBe(false);
  });

  it('maps tones and custom classes, and shows the label tag only on wide bands', () => {
    const controller = makeController();
    const { container } = render(
      <Timeline
        controller={controller}
        highlights={[
          { id: 'wide', start: 1000, end: 4000, label: 'Incident', tone: 'danger', className: 'my-band' },
          { id: 'narrow', start: 5000, end: 5500, label: 'Hidden' },
          { id: 'odd', start: 7000, end: 8000, tone: 'bogus' as never },
        ]}
      />,
    );
    const wide = band(container, 'wide')!;
    expect(wide.classList.contains('tw-highlight--danger')).toBe(true);
    expect(wide.classList.contains('my-band')).toBe(true);
    expect(wide.querySelector('.tw-highlight-label')?.textContent).toBe('Incident');
    const narrow = band(container, 'narrow')!;
    expect(narrow.classList.contains('tw-highlight--neutral')).toBe(true);
    expect(narrow.querySelector('.tw-highlight-label')).toBeNull();
    expect(band(container, 'odd')!.classList.contains('tw-highlight--neutral')).toBe(true);
    // The band continues across the axis, inside its decorative SVG.
    expect(container.querySelectorAll('.tw-axis-svg .tw-highlight-mark.tw-highlight--danger')).toHaveLength(1);
  });

  it('lets clicks and drags through: a background click still seeks, a drag still pans', () => {
    const controller = makeController();
    const { container } = render(<Timeline controller={controller} highlights={[{ id: 'all', start: 0, end: 10_000, label: 'All' }]} />);
    expect(container.querySelector('.tw-highlight')!.closest('.tw-grid')).toBeTruthy();
    const axis = screen.getByRole('slider');
    rect(axis);
    const body = container.querySelector<HTMLElement>('.tw-body')!;
    const track = container.querySelector<HTMLElement>('.tw-row-track')!;
    fireEvent.pointerDown(track, { pointerId: 1, button: 0, clientX: 400 });
    fireEvent.pointerUp(body, { pointerId: 1, button: 0, clientX: 400 });
    expect(controller.getSnapshot().time).toBe(5000);
    act(() => controller.zoomBy(2));
    const start = controller.getSnapshot().viewport.start;
    fireEvent.pointerDown(track, { pointerId: 2, button: 0, clientX: 400 });
    fireEvent.pointerMove(body, { pointerId: 2, clientX: 300, buttons: 1 });
    fireEvent.pointerUp(body, { pointerId: 2, button: 0, clientX: 300 });
    expect(controller.getSnapshot().viewport.start).toBeGreaterThan(start);
    expect(controller.getSnapshot().time).toBe(5000);
  });

  it('adds the labels of the bands under the confirmed cursor to the slider value text', () => {
    const controller = makeController();
    render(
      <Timeline
        controller={controller}
        highlights={[
          { id: 'm', start: 4000, end: 6000, label: 'Maintenance' },
          { id: 'i', start: 4500, end: 7000, label: 'Incident', tone: 'danger' },
          { id: 'u', start: 4000, end: 9000 },
        ]}
      />,
    );
    const slider = screen.getByRole('slider');
    const plain = slider.getAttribute('aria-valuetext')!;
    expect(plain).not.toContain('—');
    act(() => controller.seek(5000));
    expect(slider.getAttribute('aria-valuetext')).toMatch(/ — Maintenance, Incident$/);
    act(() => controller.seek(6500));
    expect(slider.getAttribute('aria-valuetext')).toMatch(/ — Incident$/);
    act(() => controller.seek(8000));
    expect(slider.getAttribute('aria-valuetext')).not.toContain('—');
  });

  it('ignores invalid bands with a single warning each', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = makeController();
    const highlights: TimelineHighlight[] = [
      { id: 'ok', start: 1000, end: 2000 },
      { id: 'inverted', start: 3000, end: 2000 },
      { id: 'nan', start: Number.NaN, end: 2000 },
    ];
    const { container, rerender } = render(<Timeline controller={controller} highlights={highlights} />);
    expect(band(container, 'ok')).toBeTruthy();
    expect(band(container, 'inverted')).toBeNull();
    expect(band(container, 'nan')).toBeNull();
    rerender(<Timeline controller={controller} highlights={[...highlights]} />);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]![0])).toContain('inverted');
  });

  it('never re-renders the rows because of the bands', () => {
    const controller = makeController();
    const renderItem = vi.fn((item: TimelineItem) => item.label);
    const { container, rerender } = render(<Timeline controller={controller} renderItem={renderItem} highlights={[]} />);
    const calls = renderItem.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    rerender(<Timeline controller={controller} renderItem={renderItem} highlights={[{ id: 'x', start: 1000, end: 5000, label: 'X' }]} />);
    rerender(<Timeline controller={controller} renderItem={renderItem} highlights={[{ id: 'x', start: 2000, end: 6000, label: 'Y' }]} />);
    expect(band(container, 'x')).toBeTruthy();
    expect(renderItem.mock.calls.length).toBe(calls);
  });
});
