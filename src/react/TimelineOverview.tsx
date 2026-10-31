import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { formatTimeReadout, isSpan } from '../core/index.js';
import type { TimeMode, TimeRange, TimelineController, TimelineItem } from '../core/index.js';
import { useTimelineSelector } from './useTimelineController.js';
import { defaultLabels } from './labels.js';
import type { TimelineLabels } from './labels.js';

export interface TimelineOverviewProps<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown> {
  controller: TimelineController<RowMeta, ItemMeta, KeyMeta>;
  /** Height of the strip in pixels. Defaults to 48. */
  height?: number;
  labels?: Partial<TimelineLabels>;
  locale?: string;
  formatTime?: (time: number, mode: TimeMode) => string;
  /** Colour theme, as on `Timeline`: `'light'` (default), `'dark'` or `'auto'`. */
  theme?: 'light' | 'dark' | 'auto';
  className?: string;
  /** Item density histogram. Defaults to `true`. */
  showDensity?: boolean;
  /** Width used before the first measurement (server, tests). Defaults to 800 px. */
  initialWidth?: number;
  /** `id` of the element whose visible range the window controls (`aria-controls`). */
  controlsId?: string;
}

/** Pixels per histogram column. */
const BIN_WIDTH = 4;
const ZOOM_STEP = 1.6;
/** Narrowest drawn window, so that a tiny viewport stays grabbable. */
const MIN_WINDOW_PX = 8;
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 400;

/**
 * Counts items per column across `domain`. A point adds its weight to one
 * column; a span adds it to every column it overlaps. The weight is
 * `group.count` for a group, 1 otherwise. Linear in items + columns.
 */
export function computeOverviewDensity(items: readonly TimelineItem<unknown>[], domain: TimeRange, columns: number): number[] {
  const count = Math.max(1, Math.floor(columns));
  const duration = domain.end - domain.start;
  const diff = new Float64Array(count + 1);
  if (!(duration > 0)) return Array.from({ length: count }, () => 0);
  const column = (time: number): number => Math.floor(((time - domain.start) / duration) * count);
  for (const item of items) {
    const weight = item.group ? item.group.count : 1;
    let first: number;
    let last: number;
    if (isSpan(item)) {
      if (item.end <= domain.start || item.start >= domain.end) continue;
      first = Math.max(0, column(item.start));
      // The end is excluded: a span ending exactly on a column edge stays out of it.
      last = Math.min(count - 1, Math.ceil(((item.end - domain.start) / duration) * count) - 1);
      if (last < first) last = first;
    } else {
      if (item.at < domain.start || item.at > domain.end) continue;
      first = last = Math.min(count - 1, column(item.at));
    }
    diff[first]! += weight;
    diff[last + 1]! -= weight;
  }
  const bins: number[] = new Array(count);
  let running = 0;
  for (let i = 0; i < count; i += 1) {
    running += diff[i]!;
    bins[i] = running;
  }
  return bins;
}

function useElementWidth(fallback: number): [(element: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    const measure = (): void => {
      const next = element.clientWidth;
      if (next > 0) setWidth(next);
    };
    measure();
    if (typeof ResizeObserver === 'function') {
      observer.current = new ResizeObserver(measure);
      observer.current.observe(element);
    }
  }, []);
  return [ref, width];
}

type Drag =
  | { kind: 'pan'; pointerId: number; startX: number; startViewport: TimeRange }
  | { kind: 'start' | 'end'; pointerId: number; startX: number; startViewport: TimeRange };

const selectDomain = (s: { domain: TimeRange }) => s.domain;
const selectViewport = (s: { viewport: TimeRange }) => s.viewport;
const selectMode = (s: { mode: TimeMode }) => s.mode;
const selectKeyInstants = (s: { keyInstants: readonly number[] }) => s.keyInstants;
const selectCoverage = (s: { data: { coverage: TimeRange | null } }) => s.data.coverage;
const selectReducedMotion = (s: { reducedMotion: boolean }) => s.reducedMotion;

/**
 * Overview strip of the whole period: item density, keys, cursor, live
 * frontier, loaded range and a window for the visible range that can be
 * dragged, resized and operated with the keyboard.
 *
 * Renders only when the domain, viewport, keys or coverage change; the cursor
 * is a separate subscriber and the histogram is recomputed only when the items,
 * the domain or the width change.
 */
export function TimelineOverview<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown>(
  props: TimelineOverviewProps<RowMeta, ItemMeta, KeyMeta>,
) {
  const { controller, height = 48, locale, className, showDensity = true, initialWidth = 800, controlsId } = props;
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);
  const formatTime = useMemo(
    () => props.formatTime ?? ((time: number, timeMode: TimeMode) => formatTimeReadout(time, timeMode, locale)),
    [props.formatTime, locale],
  );
  const helpId = `tw-overview-help-${useId().replace(/:/g, '')}`;

  const domain = useTimelineSelector(controller, selectDomain);
  const viewport = useTimelineSelector(controller, selectViewport);
  const mode = useTimelineSelector(controller, selectMode);
  const keyInstants = useTimelineSelector(controller, selectKeyInstants);
  const coverage = useTimelineSelector(controller, selectCoverage);
  const reducedMotion = useTimelineSelector(controller, selectReducedMotion);

  const [measureRef, width] = useElementWidth(initialWidth);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const setTrackRef = useCallback(
    (element: HTMLDivElement | null) => {
      trackRef.current = element;
      measureRef(element);
    },
    [measureRef],
  );

  const domainDuration = Math.max(1e-9, domain.end - domain.start);
  const toX = (time: number): number => ((time - domain.start) / domainDuration) * width;
  const viewportDuration = viewport.end - viewport.start;

  // Drawn window, widened around its centre when too narrow to grab.
  let windowLeft = toX(viewport.start);
  let windowWidth = toX(viewport.end) - windowLeft;
  if (windowWidth < MIN_WINDOW_PX) {
    windowLeft = Math.min(Math.max(0, windowLeft + windowWidth / 2 - MIN_WINDOW_PX / 2), Math.max(0, width - MIN_WINDOW_PX));
    windowWidth = MIN_WINDOW_PX;
  }

  // ------------------------------------------------------------------ pointer
  const drag = useRef<Drag | null>(null);
  const geometry = useRef({ width, domainDuration });
  geometry.current = { width, domainDuration };

  /** Milliseconds per pixel of the strip, from its measured box when available. */
  const scale = (): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    const pixels = rect && rect.width > 0 ? rect.width : geometry.current.width;
    return geometry.current.domainDuration / Math.max(1, pixels);
  };
  const timeAtClientX = (clientX: number): number => {
    const left = trackRef.current?.getBoundingClientRect().left ?? 0;
    return domain.start + (clientX - left) * scale();
  };

  const centerOn = (time: number): void => {
    const current = controller.getSnapshot().viewport;
    const span = current.end - current.start;
    controller.setViewport({ start: time - span / 2, end: time + span / 2 }, { origin: 'navigation' });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    const edge = target.closest('[data-edge]')?.getAttribute('data-edge');
    const onWindow = target.closest('.tw-overview-window') !== null;
    if (!onWindow) {
      // Outside the window: centre the view there, then keep dragging it.
      centerOn(timeAtClientX(event.clientX));
    }
    const kind = edge === 'start' || edge === 'end' ? edge : 'pan';
    drag.current = { kind, pointerId: event.pointerId, startX: event.clientX, startViewport: controller.getSnapshot().viewport };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (onWindow) (target.closest('.tw-overview-window') as HTMLElement | null)?.focus({ preventScroll: true });
    event.preventDefault();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    if (event.pointerType !== 'touch' && event.buttons === 0) {
      // The release was missed (lost capture): the drag is over.
      drag.current = null;
      return;
    }
    const shift = (event.clientX - state.startX) * scale();
    const { start, end } = state.startViewport;
    if (state.kind === 'pan') {
      controller.setViewport({ start: start + shift, end: end + shift }, { origin: 'navigation' });
      return;
    }
    const { domain: currentDomain, minViewportDuration } = controller.getSnapshot();
    const minimum = Math.min(minViewportDuration, currentDomain.end - currentDomain.start);
    if (state.kind === 'start') {
      const nextStart = Math.min(end - minimum, Math.max(currentDomain.start, start + shift));
      controller.setViewport({ start: nextStart, end }, { origin: 'zoom' });
    } else {
      const nextEnd = Math.max(start + minimum, Math.min(currentDomain.end, end + shift));
      controller.setViewport({ start, end: nextEnd }, { origin: 'zoom' });
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  // Wheel needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onWheel = (event: WheelEvent): void => {
      const unit = event.deltaMode === 1 ? LINE_HEIGHT_PX : event.deltaMode === 2 ? PAGE_HEIGHT_PX : 1;
      const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
      if (delta === 0) return;
      event.preventDefault();
      const { width: pixels, domainDuration: total } = geometry.current;
      controller.panBy(delta * (total / Math.max(1, pixels)));
    };
    track.addEventListener('wheel', onWheel, { passive: false });
    return () => track.removeEventListener('wheel', onWheel);
  }, [controller]);

  // ------------------------------------------------------------------ keyboard
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const { viewport: current, domain: bounds } = controller.getSnapshot();
    const span = current.end - current.start;
    const step = span * (event.shiftKey ? 0.5 : 0.1);
    const move = (start: number): void => controller.setViewport({ start, end: start + span }, { origin: 'navigation' });
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        move(current.start - step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        move(current.start + step);
        break;
      case 'PageUp':
        move(current.start - span);
        break;
      case 'PageDown':
        move(current.start + span);
        break;
      case 'Home':
        move(bounds.start);
        break;
      case 'End':
        move(bounds.end - span);
        break;
      case '+':
      case '=':
        controller.zoomBy(ZOOM_STEP, (current.start + current.end) / 2);
        break;
      case '-':
      case '_':
        controller.zoomBy(1 / ZOOM_STEP, (current.start + current.end) / 2);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const scrollable = domainDuration - viewportDuration;
  const position = scrollable > 0 ? Math.round(((viewport.start - domain.start) / scrollable) * 100) : 0;

  return (
    <div
      className={['tw-overview', className].filter(Boolean).join(' ')}
      data-theme={props.theme ?? 'light'}
      role="group"
      aria-label={labels.overview}
      style={{ height }}
      data-reduced-motion={reducedMotion || undefined}
    >
      <div
        ref={setTrackRef}
        className="tw-overview-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={(event) => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
      >
        <svg className="tw-overview-svg" width={width} height={height} aria-hidden="true">
          {coverage && (
            <rect
              className="tw-overview-coverage"
              x={Math.max(0, toX(coverage.start))}
              width={Math.max(0, Math.min(width, toX(coverage.end)) - Math.max(0, toX(coverage.start)))}
              y={height - 3}
              height="3"
            />
          )}
          {showDensity && <OverviewDensity controller={controller} domain={domain} width={width} height={height - 4} />}
          {keyInstants.map((time) =>
            time >= domain.start && time <= domain.end ? (
              <line key={time} className="tw-overview-key" x1={toX(time)} x2={toX(time)} y1="0" y2={height} />
            ) : null,
          )}
        </svg>
        <div className="tw-overview-shade" style={{ left: 0, width: Math.max(0, windowLeft) }} aria-hidden="true" />
        <div className="tw-overview-shade" style={{ left: windowLeft + windowWidth, right: 0 }} aria-hidden="true" />
        <OverviewMarkers controller={controller} domain={domain} width={width} liveLabel={labels.liveFrontier} />
        <div
          className="tw-overview-window"
          style={{ left: windowLeft, width: windowWidth }}
          tabIndex={0}
          role="scrollbar"
          aria-orientation="horizontal"
          aria-label={labels.overviewWindow}
          aria-describedby={helpId}
          aria-controls={controlsId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={position}
          aria-valuetext={labels.overviewRange(formatTime(viewport.start, mode), formatTime(viewport.end, mode))}
          onKeyDown={onKeyDown}
        >
          <span className="tw-overview-handle tw-overview-handle--start" data-edge="start" aria-hidden="true" />
          <span className="tw-overview-handle tw-overview-handle--end" data-edge="end" aria-hidden="true" />
        </div>
      </div>
      <span id={helpId} className="tw-sr-only">
        {labels.overviewHelp}
      </span>
    </div>
  );
}

interface DensityProps {
  controller: TimelineController<any, any, any>;
  domain: TimeRange;
  width: number;
  height: number;
}

const selectItems = (s: { items: readonly TimelineItem<unknown>[] }) => s.items;

/** Histogram bars as one path. Subscribes to the items only. */
const OverviewDensity = memo(function OverviewDensity({ controller, domain, width, height }: DensityProps) {
  const items = useTimelineSelector(controller, selectItems);
  const path = useMemo(() => {
    const columns = Math.max(1, Math.round(width / BIN_WIDTH));
    const bins = computeOverviewDensity(items, domain, columns);
    const max = bins.reduce((a, b) => Math.max(a, b), 0);
    if (max <= 0 || height <= 0) return '';
    const columnWidth = width / columns;
    let d = '';
    bins.forEach((value, index) => {
      if (value <= 0) return;
      // At least one pixel tall, so that a lone item stays visible.
      const barHeight = Math.max(1, (value / max) * height);
      const x = index * columnWidth;
      d += `M${round(x)} ${round(height)}V${round(height - barHeight)}H${round(x + Math.max(1, columnWidth - 1))}V${round(height)}Z`;
    });
    return d;
  }, [items, domain, width, height]);
  return path ? <path className="tw-overview-density" d={path} /> : null;
});

const round = (value: number): number => Math.round(value * 10) / 10;

interface MarkersProps {
  controller: TimelineController<any, any, any>;
  domain: TimeRange;
  width: number;
  liveLabel: string;
}

const selectTime = (s: { time: number }) => s.time;
const selectLive = (s: { transport: string; liveTime: number; domain: TimeRange }) =>
  s.transport === 'live' || s.liveTime < s.domain.end ? s.liveTime : null;

/** Cursor and live frontier: the only part that updates on every playback frame. */
const OverviewMarkers = memo(function OverviewMarkers({ controller, domain, width, liveLabel }: MarkersProps) {
  const time = useTimelineSelector(controller, selectTime);
  const live = useTimelineSelector(controller, selectLive);
  const duration = Math.max(1e-9, domain.end - domain.start);
  const toX = (value: number): number => ((value - domain.start) / duration) * width;
  return (
    <>
      {live !== null && (
        <span className="tw-overview-live" style={{ transform: `translateX(${toX(live)}px)` }} title={liveLabel} aria-hidden="true" />
      )}
      <span className="tw-overview-cursor" style={{ transform: `translateX(${toX(time)}px)` }} aria-hidden="true" />
    </>
  );
});
