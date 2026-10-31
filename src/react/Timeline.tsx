import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import {
  assignLanes,
  formatTimeReadout,
  generateTicks,
  groupItemsByRow,
  isSpan,
  itemEnd,
  itemStart,
  lowerBound,
  rangeContainsTime,
} from '../core/index.js';
import type {
  TickStep,
  TimeMode,
  TimelineController,
  TimelineItem,
  TimelineSnapshot,
  VisibleRow,
} from '../core/index.js';
import { useTimelineSnapshot } from './useTimelineController.js';
import { defaultLabels } from './labels.js';
import type { TimelineLabels } from './labels.js';
import { DetailModal } from './DetailModal.js';

export interface ItemActionContext<RowMeta, ItemMeta, KeyMeta> {
  readonly event: ReactMouseEvent | ReactKeyboardEvent;
  readonly controller: TimelineController<RowMeta, ItemMeta, KeyMeta>;
  /** Visible row on which the item was activated. */
  readonly row: VisibleRow<RowMeta>;
}

export interface ItemRenderContext<RowMeta> {
  readonly row: VisibleRow<RowMeta>;
  /** Width given to the item, in pixels. Custom content must fit in it. */
  readonly width: number;
  readonly selected: boolean;
  readonly active: boolean;
}

export interface TimelineProps<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown> {
  controller: TimelineController<RowMeta, ItemMeta, KeyMeta>;
  /** Total height of the component. Defaults to 420 px. */
  height?: number | string;
  /** Height of one lane inside a row. Defaults to 26 px. */
  laneHeight?: number;
  /** Width of the row label column. Defaults to 220 px. */
  labelWidth?: number;
  /** Width used before the first measurement (server, tests). Defaults to 800 px. */
  initialTrackWidth?: number;
  locale?: string;
  labels?: Partial<TimelineLabels>;
  formatTime?: (time: number, mode: TimeMode) => string;
  formatTick?: (time: number, step: TickStep, mode: TimeMode) => string;
  renderRowLabel?: (row: VisibleRow<RowMeta>) => ReactNode;
  renderItem?: (item: TimelineItem<ItemMeta>, context: ItemRenderContext<RowMeta>) => ReactNode;
  getItemClassName?: (item: TimelineItem<ItemMeta>) => string | undefined;
  /**
   * Accessible name of an item button. Defaults to its label (or group size),
   * then its time. When `renderItem` shows text, include it in the name (WCAG 2.5.3).
   */
  getItemAriaLabel?: (item: TimelineItem<ItemMeta>) => string;
  /** Called on click or keyboard activation. Does not move time by default. */
  onItemClick?: (item: TimelineItem<ItemMeta>, context: ItemActionContext<RowMeta, ItemMeta, KeyMeta>) => void;
  /** Controlled selection. When omitted, the timeline keeps its own. */
  selectedItemId?: string | null;
  /** Tooltip on hover and focus. `false` disables it; a function replaces its content. */
  tooltip?: boolean | ((item: TimelineItem<ItemMeta>) => ReactNode);
  /** Opens a simple detail dialog on activation. Off by default. */
  detail?: boolean | ((item: TimelineItem<ItemMeta>, row: VisibleRow<RowMeta> | undefined) => ReactNode);
  showZoomControls?: boolean;
  /** Content placed in the toolbar, e.g. `<PlaybackControls />`. */
  toolbar?: ReactNode;
  /** Header of the row column. */
  rowsHeader?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const POINT_SIZE = 10;
const ROW_PADDING = 5;
const OVERSCAN_PX = 200;
const DRAG_THRESHOLD = 4;
const ZOOM_STEP = 1.6;
const ANNOUNCE_DELAY = 400;
/** Estimated advance of one character of a 10 px monospace tick label. */
const TICK_CHAR_WIDTH = 6.2;
/** Spans narrower than this (in px) show no text label, only a group count that fits. */
const MIN_LABEL_WIDTH = 28;
/** Estimated advance of one character of the 9 px monospace group count. */
const COUNT_CHAR_WIDTH = 5.6;
/** Horizontal padding and border of the group count badge, plus a small margin. */
const COUNT_CHROME = 12;

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

function useElementHeight(fallback: number): [(element: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((element: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    const measure = (): void => {
      const next = element.clientHeight;
      if (next > 0) setHeight(next);
    };
    measure();
    if (typeof ResizeObserver === 'function') {
      observer.current = new ResizeObserver(measure);
      observer.current.observe(element);
    }
  }, []);
  return [ref, height];
}

interface RowLayout<RowMeta, ItemMeta> {
  readonly visible: VisibleRow<RowMeta>;
  readonly items: readonly TimelineItem<ItemMeta>[];
  readonly starts: readonly number[];
  readonly lanes: ReadonlyMap<string, number>;
  readonly top: number;
  readonly height: number;
}

function quantizedScale(msPerPixel: number): number {
  if (!(msPerPixel > 0) || !Number.isFinite(msPerPixel)) return 1;
  return Math.pow(2, Math.round(Math.log2(msPerPixel) * 8) / 8);
}

const EMPTY_ITEMS: readonly TimelineItem<never>[] = [];
const EMPTY_LANES: ReadonlyMap<string, number> = new Map();

/**
 * Sorted items of one row, kept between snapshots. A refresh usually returns the
 * same items as new objects: an equivalent row reuses its order, lanes and layout.
 */
interface RowItemsEntry<ItemMeta> {
  /** Items of the row in the order received. */
  readonly input: readonly TimelineItem<ItemMeta>[];
  /** `sorted[k] === input[order[k]]` (or an equivalent earlier object). */
  readonly order: readonly number[];
  /** Items by start, end then id. */
  readonly sorted: readonly TimelineItem<ItemMeta>[];
  readonly starts: readonly number[];
  /** Changes only when the ids or times of the row change. */
  readonly geometry: object;
  /** `sorted` holds the very objects of `input`, not equivalent earlier ones. */
  readonly exact: boolean;
}

/** Same id, kind and times: the order and lanes do not change. */
function sameGeometry(a: TimelineItem<unknown>, b: TimelineItem<unknown>): boolean {
  if (a === b) return true;
  if (a.id !== b.id) return false;
  if (isSpan(a)) return isSpan(b) && a.start === b.start && a.end === b.end;
  return !isSpan(b) && a.at === b.at;
}

/** Same geometry, label and group size: the default rendering does not change. */
function sameRendering(a: TimelineItem<unknown>, b: TimelineItem<unknown>): boolean {
  return a === b || (sameGeometry(a, b) && a.label === b.label && a.group?.count === b.group?.count);
}

function sortRow<M>(input: readonly TimelineItem<M>[]): RowItemsEntry<M> {
  const starts = input.map(itemStart);
  const ends = input.map(itemEnd);
  const order = input.map((_, index) => index);
  order.sort((a, b) => {
    const idA = input[a]!.id;
    const idB = input[b]!.id;
    return starts[a]! - starts[b]! || ends[a]! - ends[b]! || (idA < idB ? -1 : idA > idB ? 1 : 0);
  });
  return {
    input,
    order,
    sorted: order.map((index) => input[index]!),
    starts: order.map((index) => starts[index]!),
    geometry: {},
    exact: true,
  };
}

/**
 * Sorts a row, reusing the previous entry when the items are equivalent
 * (compared in received order). `strict` requires the same objects to reuse
 * them for rendering, because custom renderers may read any field; the order
 * and lanes are still reused when only non-geometric fields change.
 */
function updateRow<M>(previous: RowItemsEntry<M> | undefined, input: readonly TimelineItem<M>[], strict: boolean): RowItemsEntry<M> {
  if (!previous || previous.input.length !== input.length) return sortRow(input);
  const before = previous.input;
  let identical = true;
  let rendering = true;
  for (let i = 0; i < input.length; i++) {
    const a = before[i]!;
    const b = input[i]!;
    if (a === b) continue;
    if (!sameGeometry(a, b)) return sortRow(input);
    identical = false;
    if (!sameRendering(a, b)) rendering = false;
  }
  const exact = previous.exact && identical;
  // Equivalent rendering: keep the previous objects so memoised rows skip rendering.
  if (exact || (rendering && !strict)) return { ...previous, input, exact };
  return { ...previous, input, sorted: previous.order.map((index) => input[index]!), exact: true };
}

function sameVisibleRow<M>(a: VisibleRow<M>, b: VisibleRow<M>): boolean {
  return a === b || (a.row === b.row && a.depth === b.depth && a.hasChildren === b.hasChildren && a.expanded === b.expanded);
}

function countFits(count: number, width: number): boolean {
  return String(count).length * COUNT_CHAR_WIDTH + COUNT_CHROME <= width;
}

/**
 * Interactive horizontal timeline: SVG axis, expandable HTML rows and markers,
 * confirmed cursor and pending target, zoom and pan, keyboard navigation.
 */
export function Timeline<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown>(
  props: TimelineProps<RowMeta, ItemMeta, KeyMeta>,
): ReactNode {
  const {
    controller,
    height = 420,
    laneHeight = 26,
    labelWidth: preferredLabelWidth = 220,
    initialTrackWidth = 800,
    locale,
    formatTick,
    renderRowLabel,
    renderItem,
    getItemClassName,
    getItemAriaLabel,
    onItemClick,
    tooltip = true,
    detail = false,
    showZoomControls = true,
    toolbar,
    rowsHeader,
    className,
    style,
  } = props;
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);
  const baseId = useId().replace(/:/g, '');
  const tooltipId = `tw-tooltip-${baseId}`;
  const axisHelpId = `tw-axis-help-${baseId}`;
  const snapshot = useTimelineSnapshot(controller);
  const { viewport, domain, mode } = snapshot;
  const formatTime = useMemo(
    () => props.formatTime ?? ((time: number, timeMode: TimeMode) => formatTimeReadout(time, timeMode, locale)),
    [props.formatTime, locale],
  );

  const [axisRef, trackWidth] = useElementWidth(initialTrackWidth);
  const [frameWidthRef, frameWidth] = useElementWidth(initialTrackWidth + preferredLabelWidth);
  // On narrow screens the label column gives room to the track.
  const narrow = frameWidth < 640;
  const labelWidth = narrow ? Math.min(preferredLabelWidth, Math.max(96, Math.round(frameWidth * 0.34))) : preferredLabelWidth;
  const indent = narrow ? 10 : 16;
  const [bodySizeRef, bodyHeight] = useElementHeight(300);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const setFrameRef = useCallback(
    (element: HTMLDivElement | null) => {
      frameRef.current = element;
      frameWidthRef(element);
    },
    [frameWidthRef],
  );
  const axisElement = useRef<HTMLDivElement | null>(null);
  const setAxisRef = useCallback(
    (element: HTMLDivElement | null) => {
      axisElement.current = element;
      axisRef(element);
    },
    [axisRef],
  );
  const setBodyRef = useCallback(
    (element: HTMLDivElement | null) => {
      bodyRef.current = element;
      bodySizeRef(element);
    },
    [bodySizeRef],
  );
  const [scrollTop, setScrollTop] = useState(0);

  const duration = viewport.end - viewport.start;
  const msPerPixel = duration / Math.max(1, trackWidth);
  const toX = useCallback((time: number) => ((time - viewport.start) / duration) * trackWidth, [viewport.start, duration, trackWidth]);
  const timeAtClientX = useCallback(
    (clientX: number): number => {
      const rect = axisElement.current?.getBoundingClientRect();
      const left = rect?.left ?? 0;
      const width = rect && rect.width > 0 ? rect.width : trackWidth;
      return viewport.start + ((clientX - left) / width) * duration;
    },
    [viewport.start, duration, trackWidth],
  );

  // ------------------------------------------------------------------ layout
  // Each cache keeps only the rows of the latest computation; equivalent rows
  // keep their sorted array, lanes and layout object (see `updateRow`).
  const strictItems = Boolean(renderItem || getItemClassName || getItemAriaLabel);
  const rowItemsCache = useRef(new Map<string, RowItemsEntry<ItemMeta>>());
  const itemsByRow = useMemo(() => {
    const previous = rowItemsCache.current;
    const next = new Map<string, RowItemsEntry<ItemMeta>>();
    for (const [rowId, list] of groupItemsByRow(snapshot.items)) next.set(rowId, updateRow(previous.get(rowId), list, strictItems));
    rowItemsCache.current = next;
    return next;
  }, [snapshot.items, strictItems]);

  const laneScale = quantizedScale(msPerPixel);
  const laneStore = useRef(new Map<string, { geometry: object; scale: number; layout: ReturnType<typeof assignLanes> }>());
  const laneCache = useMemo(() => {
    const previous = laneStore.current;
    const next = new Map<string, { geometry: object; scale: number; layout: ReturnType<typeof assignLanes> }>();
    for (const [rowId, entry] of itemsByRow) {
      const cached = previous.get(rowId);
      next.set(
        rowId,
        cached && cached.geometry === entry.geometry && cached.scale === laneScale
          ? cached
          : { geometry: entry.geometry, scale: laneScale, layout: assignLanes(entry.sorted, (POINT_SIZE + 4) * laneScale, { presorted: true }) },
      );
    }
    laneStore.current = next;
    return next;
  }, [itemsByRow, laneScale]);

  const layoutStore = useRef(new Map<string, RowLayout<RowMeta, ItemMeta>>());
  const rowLayouts = useMemo(() => {
    const previous = layoutStore.current;
    const next = new Map<string, RowLayout<RowMeta, ItemMeta>>();
    let top = 0;
    const result: RowLayout<RowMeta, ItemMeta>[] = [];
    for (const visible of snapshot.visibleRows) {
      const entry = itemsByRow.get(visible.row.id);
      const items = entry?.sorted ?? (EMPTY_ITEMS as readonly TimelineItem<ItemMeta>[]);
      const lanes = laneCache.get(visible.row.id)?.layout;
      const laneMap = lanes?.lanes ?? EMPTY_LANES;
      const rowHeight = (lanes?.laneCount ?? 1) * laneHeight + ROW_PADDING * 2;
      const old = previous.get(visible.row.id);
      const layout: RowLayout<RowMeta, ItemMeta> =
        old && old.items === items && old.lanes === laneMap && old.top === top && old.height === rowHeight && sameVisibleRow(old.visible, visible)
          ? old
          : { visible, items, starts: entry?.starts ?? [], lanes: laneMap, top, height: rowHeight };
      next.set(visible.row.id, layout);
      result.push(layout);
      top += rowHeight;
    }
    layoutStore.current = next;
    return { rows: result, total: top };
  }, [snapshot.visibleRows, itemsByRow, laneCache, laneHeight]);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rowLayouts.rows.forEach((layout, index) => map.set(layout.visible.row.id, index));
    return map;
  }, [rowLayouts]);

  // ------------------------------------------------------------------ selection and focus
  const [internalSelection, setInternalSelection] = useState<string | null>(null);
  const selectedId = props.selectedItemId !== undefined ? props.selectedItemId : internalSelection;
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  /** Whether an item button holds the keyboard focus (cleared on blur). */
  const itemHasFocus = useRef(false);
  const [hovered, setHovered] = useState<{ id: string; x: number; y: number } | null>(null);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);
  const detailReturnFocus = useRef<HTMLElement | null>(null);

  const itemIndex = useMemo(() => {
    const map = new Map<string, { item: TimelineItem<ItemMeta>; rowId: string }>();
    for (const item of snapshot.items) map.set(item.id, { item, rowId: item.rowId });
    return map;
  }, [snapshot.items]);

  // An item removed from the collections leaves focus, tooltip and dialog.
  useEffect(() => {
    if (focusedId && !itemIndex.has(focusedId)) {
      // The removed button took focus with it: focus falls back to the body.
      const active = document.activeElement;
      const hadFocus = itemHasFocus.current && (!active || active === document.body);
      itemHasFocus.current = false;
      setFocusedId(null);
      if (hadFocus) axisElement.current?.focus();
    }
    if (hovered && !itemIndex.has(hovered.id)) setHovered(null);
    if (detailItemId && !itemIndex.has(detailItemId)) setDetailItemId(null);
    if (internalSelection && !itemIndex.has(internalSelection)) setInternalSelection(null);
  }, [itemIndex, focusedId, hovered, detailItemId, internalSelection]);

  useLayoutEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const candidates = frameRef.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? [];
    const element = Array.from(candidates).find((candidate) => candidate.dataset.itemId === id);
    if (element) {
      pendingFocus.current = null;
      element.focus({ preventScroll: true });
    }
  });

  // ------------------------------------------------------------------ vertical virtualisation
  const firstRow = useMemo(() => {
    const rows = rowLayouts.rows;
    let low = 0;
    let high = rows.length;
    const limit = scrollTop - OVERSCAN_PX;
    while (low < high) {
      const mid = (low + high) >>> 1;
      const row = rows[mid]!;
      if (row.top + row.height < limit) low = mid + 1;
      else high = mid;
    }
    return low;
  }, [rowLayouts, scrollTop]);
  const visibleRowSlice = useMemo(() => {
    const result: RowLayout<RowMeta, ItemMeta>[] = [];
    const limit = scrollTop + bodyHeight + OVERSCAN_PX;
    for (let i = firstRow; i < rowLayouts.rows.length; i++) {
      const row = rowLayouts.rows[i]!;
      if (row.top > limit) break;
      result.push(row);
    }
    // Keep the focused item's row rendered so focus is never lost.
    if (focusedId) {
      const entry = itemIndex.get(focusedId);
      const index = entry ? rowIndexById.get(entry.rowId) : undefined;
      const row = index === undefined ? undefined : rowLayouts.rows[index];
      if (row && !result.includes(row)) result.push(row);
    }
    return result;
  }, [rowLayouts, firstRow, scrollTop, bodyHeight, focusedId, itemIndex, rowIndexById]);

  // ------------------------------------------------------------------ ticks
  const ticks = useMemo(
    () => generateTicks({ mode, range: viewport, width: trackWidth, locale, format: formatTick }),
    [mode, viewport, trackWidth, locale, formatTick],
  );

  // Tick labels start right of their line; near the right edge a label is
  // anchored to its end instead, or dropped when it would cover its neighbour.
  const tickLabels = useMemo(() => {
    const result = new Map<number, { x: number; anchor: 'start' | 'end' } | null>();
    let previousEnd = -Infinity;
    for (const tick of ticks.ticks) {
      const x = ((tick.time - viewport.start) / (viewport.end - viewport.start)) * trackWidth;
      const width = tick.label.length * TICK_CHAR_WIDTH;
      let placement: { x: number; anchor: 'start' | 'end' } | null = { x: 4, anchor: 'start' };
      let left = x + 4;
      let right = x + 4 + width;
      if (right > trackWidth - 2) {
        placement = { x: -4, anchor: 'end' };
        left = x - 4 - width;
        right = x - 4;
        if (left < previousEnd + 4) placement = null;
      }
      if (placement) previousEnd = right;
      result.set(tick.time, placement);
    }
    return result;
  }, [ticks, viewport, trackWidth]);

  // ------------------------------------------------------------------ pointer interactions
  const drag = useRef<
    | { kind: 'pan'; pointerId: number; startX: number; startViewport: { start: number; end: number }; moved: boolean }
    | { kind: 'cursor'; pointerId: number }
    | { kind: 'pinch'; startDistance: number; startViewport: { start: number; end: number }; anchor: number; ratio: number }
    | null
  >(null);
  // Active touch pointers, for the two-finger pinch zoom.
  const touches = useRef(new Map<number, number>());

  const startPinch = (): void => {
    const [a, b] = Array.from(touches.current.values());
    if (a === undefined || b === undefined) return;
    const rect = axisElement.current?.getBoundingClientRect();
    const width = rect && rect.width > 0 ? rect.width : trackWidth;
    const middle = (a + b) / 2;
    const ratio = Math.min(1, Math.max(0, (middle - (rect?.left ?? 0)) / width));
    drag.current = {
      kind: 'pinch',
      startDistance: Math.max(1, Math.abs(a - b)),
      startViewport: viewport,
      anchor: viewport.start + ratio * duration,
      ratio,
    };
  };

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.pointerType === 'touch') {
      touches.current.set(event.pointerId, event.clientX);
      if (touches.current.size === 2) {
        startPinch();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        return;
      }
    }
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('.tw-item, .tw-row-label, .tw-key, .tw-cursor-handle, button')) return;
    drag.current = { kind: 'pan', pointerId: event.pointerId, startX: event.clientX, startViewport: viewport, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onCursorPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return;
    event.stopPropagation();
    drag.current = { kind: 'cursor', pointerId: event.pointerId };
    // Capture on the axis: the handle may unmount while the cursor leaves the view.
    axisElement.current?.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>): void => {
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, event.clientX);
    const state = drag.current;
    if (!state) return;
    if (state.kind === 'pinch') {
      const [a, b] = Array.from(touches.current.values());
      if (a === undefined || b === undefined) return;
      const factor = Math.max(1, Math.abs(a - b)) / state.startDistance;
      const span = (state.startViewport.end - state.startViewport.start) / factor;
      const start = state.anchor - span * state.ratio;
      controller.setViewport({ start, end: start + span }, { origin: 'zoom' });
      return;
    }
    if (state.pointerId !== event.pointerId) return;
    if (event.pointerType !== 'touch' && event.buttons === 0) {
      // The release was missed (lost capture): the drag is over.
      drag.current = null;
      return;
    }
    if (state.kind === 'cursor') {
      controller.seek(Math.min(domain.end, Math.max(domain.start, timeAtClientX(event.clientX))));
      return;
    }
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    state.moved = true;
    const shift = -dx * ((state.startViewport.end - state.startViewport.start) / Math.max(1, trackWidth));
    controller.setViewport({ start: state.startViewport.start + shift, end: state.startViewport.end + shift });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>): void => {
    const wasTouch = touches.current.delete(event.pointerId);
    const state = drag.current;
    if (state?.kind === 'pinch') {
      // Lifting one finger ends the pinch without a click navigation.
      if (wasTouch) drag.current = null;
      return;
    }
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (state.kind === 'pan' && !state.moved) {
      const time = timeAtClientX(event.clientX);
      if (rangeContainsTime(domain, time)) controller.seek(time);
    }
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLElement>): void => {
    touches.current.delete(event.pointerId);
    drag.current = null;
  };

  // Wheel needs a non-passive listener to prevent page zoom and scroll.
  const wheelState = useRef({ timeAtClientX, msPerPixel });
  wheelState.current = { timeAtClientX, msPerPixel };
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent): void => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.tw-axis, .tw-keys, .tw-row-track, .tw-body')) return;
      if (target.closest('.tw-row-label')) return;
      const { timeAtClientX: at, msPerPixel: scale } = wheelState.current;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        controller.zoomBy(Math.exp(-event.deltaY * 0.0025), at(event.clientX));
      } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        const delta = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
        controller.panBy(delta * scale);
      }
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [controller]);

  // ------------------------------------------------------------------ keyboard
  const revealTime = useCallback(
    (time: number) => {
      const current = controller.getSnapshot().viewport;
      if (rangeContainsTime(current, time)) return;
      const span = current.end - current.start;
      controller.setViewport({ start: time - span / 2, end: time + span / 2 });
    },
    [controller],
  );

  const revealRow = useCallback(
    (rowIndex: number) => {
      const body = bodyRef.current;
      const row = rowLayouts.rows[rowIndex];
      if (!body || !row) return;
      if (row.top < body.scrollTop) body.scrollTop = row.top;
      else if (row.top + row.height > body.scrollTop + body.clientHeight) body.scrollTop = row.top + row.height - body.clientHeight;
      setScrollTop(body.scrollTop);
    },
    [rowLayouts],
  );

  const onAxisKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.target !== event.currentTarget) return;
    const step = duration / (event.shiftKey ? 10 : 50);
    const reference = snapshot.pending?.target ?? snapshot.time;
    let handled = true;
    switch (event.key) {
      case 'ArrowRight':
        controller.seek(Math.min(domain.end, reference + step));
        break;
      case 'ArrowLeft':
        controller.seek(Math.max(domain.start, reference - step));
        break;
      case 'Home':
        controller.seek(domain.start);
        break;
      case 'End':
        controller.seek(domain.end);
        break;
      case 'PageDown':
        controller.nextKey();
        break;
      case 'PageUp':
        controller.previousKey();
        break;
      case '+':
      case '=':
        controller.zoomBy(ZOOM_STEP);
        break;
      case '-':
      case '_':
        controller.zoomBy(1 / ZOOM_STEP);
        break;
      case ' ':
        controller.togglePlay();
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  };

  const moveFocusTo = (item: TimelineItem<ItemMeta> | undefined): void => {
    if (!item) return;
    pendingFocus.current = item.id;
    setFocusedId(item.id);
    revealItem(item);
  };

  const revealItem = (item: TimelineItem<ItemMeta>): void => {
    revealTime(isSpan(item) ? Math.max(item.start, Math.min(item.end, viewport.start)) : item.at);
    const index = rowIndexById.get(item.rowId);
    if (index !== undefined) revealRow(index);
  };

  const activateItem = (rendered: TimelineItem<ItemMeta>, row: VisibleRow<RowMeta>, event: ReactMouseEvent | ReactKeyboardEvent): void => {
    // A reused row may hold an equivalent earlier object: hand out the current one.
    const item = itemIndex.get(rendered.id)?.item ?? rendered;
    revealItem(item);
    if (props.selectedItemId === undefined) setInternalSelection(item.id);
    setFocusedId(item.id);
    onItemClick?.(item, { event, controller, row });
    if (detail) {
      detailReturnFocus.current = event.currentTarget as HTMLElement;
      setDetailItemId(item.id);
    }
  };

  const onItemKeyDown = (event: ReactKeyboardEvent<HTMLElement>, item: TimelineItem<ItemMeta>, layout: RowLayout<RowMeta, ItemMeta>): void => {
    const index = layout.items.indexOf(item);
    const rowIndex = rowIndexById.get(layout.visible.row.id) ?? 0;
    const nearestIn = (target: RowLayout<RowMeta, ItemMeta> | undefined): TimelineItem<ItemMeta> | undefined => {
      if (!target || target.items.length === 0) return undefined;
      const at = lowerBound(target.starts, itemStart(item));
      const candidates = [target.items[at - 1], target.items[at]].filter(Boolean) as TimelineItem<ItemMeta>[];
      return candidates.sort((a, b) => Math.abs(itemStart(a) - itemStart(item)) - Math.abs(itemStart(b) - itemStart(item)))[0];
    };
    const findRow = (direction: 1 | -1): RowLayout<RowMeta, ItemMeta> | undefined => {
      for (let i = rowIndex + direction; i >= 0 && i < rowLayouts.rows.length; i += direction) {
        if (rowLayouts.rows[i]!.items.length) return rowLayouts.rows[i];
      }
      return undefined;
    };
    let handled = true;
    switch (event.key) {
      case 'ArrowRight':
        moveFocusTo(layout.items[index + 1]);
        break;
      case 'ArrowLeft':
        moveFocusTo(layout.items[index - 1]);
        break;
      case 'Home':
        moveFocusTo(layout.items[0]);
        break;
      case 'End':
        moveFocusTo(layout.items[layout.items.length - 1]);
        break;
      case 'ArrowDown':
        moveFocusTo(nearestIn(findRow(1)));
        break;
      case 'ArrowUp':
        moveFocusTo(nearestIn(findRow(-1)));
        break;
      case 'Enter':
      case ' ':
        activateItem(item, layout.visible, event);
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  // The roving tab stop: the focused item, or the first rendered one.
  const tabStopId = useMemo(() => {
    const focused = focusedId ? itemIndex.get(focusedId)?.item : undefined;
    if (focused && (itemHasFocus.current || (itemEnd(focused) >= viewport.start && itemStart(focused) <= viewport.end))) return focused.id;
    for (const layout of visibleRowSlice) {
      const first = layout.items.find((item) => itemEnd(item) >= viewport.start && itemStart(item) <= viewport.end);
      if (first) return first.id;
    }
    return null;
  }, [focusedId, itemIndex, visibleRowSlice, viewport]);

  // ------------------------------------------------------------------ status
  // A wait is announced only if it lasts: dragging the cursor or holding an
  // arrow key would otherwise announce every intermediate destination.
  const [slowPendingId, setSlowPendingId] = useState<number | null>(null);
  const pendingId = snapshot.pending?.id ?? null;
  useEffect(() => {
    if (pendingId === null) return;
    const timer = setTimeout(() => setSlowPendingId(pendingId), ANNOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [pendingId]);

  const statusMessage = useMemo(() => {
    if (snapshot.status === 'initializing') return labels.initializing;
    if (snapshot.status === 'error' && snapshot.error) return labels.preparationError(formatTime(snapshot.error.target, mode));
    if (snapshot.pending && snapshot.pending.id === slowPendingId && (snapshot.pending.cause === 'seek' || snapshot.pending.cause === 'key' || snapshot.pending.cause === 'stop')) {
      return labels.preparing(formatTime(snapshot.pending.target, mode));
    }
    if (snapshot.data.error) return labels.dataError;
    return '';
    // Playback frames are deliberately not announced.
  }, [snapshot.status, snapshot.error, snapshot.pending, slowPendingId, snapshot.data.error, labels, mode, formatTime]);

  // The slider value is not updated on every playback frame, so assistive
  // technologies do not announce each image; it follows pauses and jumps.
  const announcedTime = useRef(snapshot.time);
  const settled = snapshot.transport === 'paused' && !snapshot.rewinding;
  const discrete = snapshot.lastCause !== 'play' && snapshot.lastCause !== 'rewind' && snapshot.lastCause !== 'live';
  if (settled || discrete) announcedTime.current = snapshot.time;

  // ------------------------------------------------------------------ rendering helpers
  const cursorX = toX(snapshot.time);
  const pendingX = snapshot.pending && snapshot.pending.cause !== 'play' ? toX(snapshot.pending.target) : null;
  const liveVisible = snapshot.transport === 'live' || snapshot.liveTime < domain.end;
  const liveX = liveVisible ? toX(snapshot.liveTime) : null;
  const inTrack = (x: number | null): x is number => x !== null && x >= -1 && x <= trackWidth + 1;
  const coverage = snapshot.data.coverage;
  const visibleKeys = useMemo(() => {
    const seen = new Set<number>();
    return snapshot.keys.filter((key) => {
      if (!rangeContainsTime(viewport, key.at) || seen.has(key.at)) return false;
      seen.add(key.at);
      return true;
    });
  }, [snapshot.keys, viewport]);

  const hoveredItem = hovered ? itemIndex.get(hovered.id)?.item : undefined;
  const detailEntry = detailItemId ? itemIndex.get(detailItemId) : undefined;
  const detailRow = detailEntry ? rowLayouts.rows[rowIndexById.get(detailEntry.rowId) ?? -1]?.visible : undefined;

  const showTooltip = (item: TimelineItem<ItemMeta>, element: HTMLElement): void => {
    if (!tooltip) return;
    const frame = frameRef.current?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    setHovered({ id: item.id, x: rect.left - (frame?.left ?? 0) + rect.width / 2, y: rect.bottom - (frame?.top ?? 0) + 6 });
  };

  // Handlers read through a stable ref so memoised rows do not re-render when they change.
  const actions = useRef<RowActions<RowMeta, ItemMeta>>(null as unknown as RowActions<RowMeta, ItemMeta>);
  actions.current = {
    activate: activateItem,
    keyDown: onItemKeyDown,
    focus: (item, element) => {
      itemHasFocus.current = true;
      setFocusedId(item.id);
      revealItem(item);
      showTooltip(item, element);
    },
    hover: showTooltip,
    leave: (item) => setHovered((current) => (current?.id === item.id ? null : current)),
    blur: (item) => {
      itemHasFocus.current = false;
      setHovered((current) => (current?.id === item.id ? null : current));
    },
    toggle: (rowId) => controller.toggle(rowId),
  };

  // Items under the cursor, per row; rows re-render only when this changes.
  const activeByRow = useMemo(() => {
    const result = new Map<string, string>();
    const time = snapshot.time;
    const tolerance = msPerPixel * 2;
    for (const layout of visibleRowSlice) {
      const limit = lowerBound(layout.starts, time + tolerance + Number.EPSILON);
      let ids = '';
      for (let i = 0; i < limit; i++) {
        const item = layout.items[i]!;
        const active = isSpan(item) ? time >= item.start && time < item.end : Math.abs(time - item.at) <= tolerance;
        if (active) ids += `${item.id}\u0000`;
      }
      if (ids) result.set(layout.visible.row.id, ids);
    }
    return result;
  }, [visibleRowSlice, snapshot.time, msPerPixel]);

  const frameStyle = {
    '--tw-label-width': `${labelWidth}px`,
    height,
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={setFrameRef}
      className={['tw-timeline', className].filter(Boolean).join(' ')}
      style={frameStyle}
      role="region"
      aria-label={labels.timeline}
      data-status={snapshot.status}
      data-transport={snapshot.transport}
      data-narrow={narrow || undefined}
    >
      {(toolbar || showZoomControls) && (
        <div className="tw-toolbar">
          <div className="tw-toolbar-main">{toolbar}</div>
          {showZoomControls && (
            <div className="tw-zoom" role="group" aria-label="Zoom">
              <button type="button" className="tw-button" onClick={() => controller.zoomBy(1 / ZOOM_STEP)} aria-label={labels.zoomOut} title={labels.zoomOut}>
                −
              </button>
              <button type="button" className="tw-button" onClick={() => controller.zoomBy(ZOOM_STEP)} aria-label={labels.zoomIn} title={labels.zoomIn}>
                +
              </button>
              <button
                type="button"
                className={narrow ? 'tw-button tw-button--fit' : 'tw-button tw-button--text'}
                onClick={() => controller.setViewport(domain, { origin: 'zoom' })}
                aria-label={narrow ? labels.zoomFit : undefined}
                title={labels.zoomFit}
              >
                {narrow ? (
                  <svg className="tw-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
                  </svg>
                ) : (
                  labels.zoomFit
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tw-header">
        <div className="tw-corner">{rowsHeader ?? labels.rows}</div>
        <div className="tw-axis-wrap">
          <div
            ref={setAxisRef}
            className="tw-axis"
            tabIndex={0}
            role="slider"
            aria-label={labels.cursor}
            aria-describedby={axisHelpId}
            aria-valuemin={domain.start}
            aria-valuemax={domain.end}
            aria-valuenow={Math.round(announcedTime.current)}
            aria-valuetext={formatTime(announcedTime.current, mode)}
            aria-busy={snapshot.status === 'preparing' || snapshot.status === 'initializing'}
            onKeyDown={onAxisKeyDown}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={(event) => {
              if (drag.current && drag.current.kind !== 'pinch' && drag.current.pointerId === event.pointerId) drag.current = null;
            }}
          >
            <svg className="tw-axis-svg" width={trackWidth} height="100%" aria-hidden="true">
              {coverage && (
                <rect
                  className="tw-coverage"
                  x={Math.max(0, toX(coverage.start))}
                  width={Math.max(0, Math.min(trackWidth, toX(coverage.end)) - Math.max(0, toX(coverage.start)))}
                  y="0"
                  height="3"
                />
              )}
              {ticks.ticks.map((tick) => {
                const x = toX(tick.time);
                const placement = tickLabels.get(tick.time);
                return (
                  <g key={tick.time} className={tick.major ? 'tw-tick tw-tick--major' : 'tw-tick'} transform={`translate(${x},0)`}>
                    <line y1="22" y2="100%" />
                    {placement && (
                      <text x={placement.x} y="16" textAnchor={placement.anchor}>
                        {tick.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {inTrack(cursorX) && (
              <span
                className="tw-cursor-handle"
                style={{ left: cursorX }}
                onPointerDown={onCursorPointerDown}
                aria-hidden="true"
              />
            )}
            {snapshot.data.loading && <span className="tw-loading" aria-hidden="true" />}
          </div>
          {/* Key markers sit over the axis, outside the slider: a slider cannot contain controls. */}
          <div className="tw-keys">
            {visibleKeys.map((key) => (
              <button
                key={key.id}
                type="button"
                className="tw-key"
                style={{ left: toX(key.at) }}
                aria-label={labels.key(key.label ?? key.id, formatTime(key.at, mode))}
                title={key.label ?? key.id}
                onClick={() => controller.goToKey(key.id)}
                tabIndex={-1}
              />
            ))}
          </div>
          <span id={axisHelpId} className="tw-sr-only">
            {labels.cursorHelp}
          </span>
        </div>
      </div>

      <div className="tw-body-wrap">
        <div className="tw-grid" aria-hidden="true">
          {ticks.ticks.map((tick) => (
            <span key={tick.time} className={tick.major ? 'tw-grid-line tw-grid-line--major' : 'tw-grid-line'} style={{ left: toX(tick.time) }} />
          ))}
        </div>
        <div
          ref={setBodyRef}
          className="tw-body"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <div className="tw-rows" role="list" aria-label={labels.rows} style={{ height: rowLayouts.total }}>
            {visibleRowSlice.map((layout) => {
              const rowId = layout.visible.row.id;
              const inRow = (id: string | null | undefined): string | null => (id && itemIndex.get(id)?.rowId === rowId ? id : null);
              return (
                <RowView<RowMeta, ItemMeta>
                  key={layout.visible.row.id}
                  layout={layout}
                  viewportStart={viewport.start}
                  duration={duration}
                  trackWidth={trackWidth}
                  domainStart={domain.start}
                  domainEnd={domain.end}
                  laneHeight={laneHeight}
                  indent={indent}
                  mode={mode}
                  activeKey={activeByRow.get(layout.visible.row.id) ?? ''}
                  selectedId={inRow(selectedId)}
                  tabStopId={inRow(tabStopId)}
                  focusedId={inRow(focusedId)}
                  describedId={inRow(hovered?.id)}
                  tooltipId={tooltipId}
                  labels={labels}
                  formatTime={formatTime}
                  renderRowLabel={renderRowLabel}
                  renderItem={renderItem}
                  getItemClassName={getItemClassName}
                  getItemAriaLabel={getItemAriaLabel}
                  actions={actions}
                />
              );
            })}
          </div>
        </div>
        <div className="tw-overlay" aria-hidden="true">
          {inTrack(liveX) && <span className="tw-live-line" style={{ left: liveX }} title={labels.liveFrontier} />}
          {inTrack(pendingX) && <span className="tw-pending-line" style={{ left: pendingX }} />}
          {inTrack(cursorX) && <span className="tw-cursor-line" style={{ left: cursorX }} />}
        </div>
      </div>

      {tooltip && hoveredItem && hovered && (
        <div id={tooltipId} role="tooltip" className="tw-tooltip" style={{ left: hovered.x, top: hovered.y }}>
          {typeof tooltip === 'function' ? (
            tooltip(hoveredItem)
          ) : (
            <>
              <strong>{hoveredItem.label ?? hoveredItem.id}</strong>
              <span>
                {isSpan(hoveredItem)
                  ? `${formatTime(hoveredItem.start, mode)} – ${formatTime(hoveredItem.end, mode)}`
                  : formatTime(hoveredItem.at, mode)}
              </span>
              {hoveredItem.group && <span>{labels.group(hoveredItem.group.count)}</span>}
            </>
          )}
        </div>
      )}

      <div className="tw-sr-only" aria-live="polite" role="status">
        {statusMessage}
      </div>

      {detail && detailEntry && (
        <DetailModal
          title={detailEntry.item.label ?? detailEntry.item.id}
          labels={labels}
          returnFocus={detailReturnFocus.current}
          inertRoot={frameRef.current}
          onClose={() => setDetailItemId(null)}
        >
          {typeof detail === 'function' ? (
            detail(detailEntry.item, detailRow)
          ) : (
            <DefaultDetail item={detailEntry.item} row={detailRow} labels={labels} format={(time) => formatTime(time, mode)} />
          )}
        </DetailModal>
      )}
    </div>
  );
}

interface RowActions<RowMeta, ItemMeta> {
  activate(item: TimelineItem<ItemMeta>, row: VisibleRow<RowMeta>, event: ReactMouseEvent | ReactKeyboardEvent): void;
  keyDown(event: ReactKeyboardEvent<HTMLElement>, item: TimelineItem<ItemMeta>, layout: RowLayout<RowMeta, ItemMeta>): void;
  focus(item: TimelineItem<ItemMeta>, element: HTMLElement): void;
  hover(item: TimelineItem<ItemMeta>, element: HTMLElement): void;
  leave(item: TimelineItem<ItemMeta>): void;
  blur(item: TimelineItem<ItemMeta>): void;
  toggle(rowId: string): void;
}

interface RowViewProps<RowMeta, ItemMeta> {
  layout: RowLayout<RowMeta, ItemMeta>;
  viewportStart: number;
  duration: number;
  trackWidth: number;
  domainStart: number;
  domainEnd: number;
  laneHeight: number;
  indent: number;
  mode: TimeMode;
  /** Ids of the items under the cursor, joined; a change re-renders the row. */
  activeKey: string;
  selectedId: string | null;
  tabStopId: string | null;
  focusedId: string | null;
  describedId: string | null;
  tooltipId: string;
  labels: TimelineLabels;
  formatTime: (time: number, mode: TimeMode) => string;
  renderRowLabel: ((row: VisibleRow<RowMeta>) => ReactNode) | undefined;
  renderItem: ((item: TimelineItem<ItemMeta>, context: ItemRenderContext<RowMeta>) => ReactNode) | undefined;
  getItemClassName: ((item: TimelineItem<ItemMeta>) => string | undefined) | undefined;
  getItemAriaLabel: ((item: TimelineItem<ItemMeta>) => string) | undefined;
  actions: { readonly current: RowActions<RowMeta, ItemMeta> };
}

function RowViewImpl<RowMeta, ItemMeta>(props: RowViewProps<RowMeta, ItemMeta>): ReactNode {
  const { layout, viewportStart, duration, trackWidth, domainStart, domainEnd, laneHeight, indent, mode, labels, formatTime, actions } = props;
  const { visible } = layout;
  const msPerPixel = duration / Math.max(1, trackWidth);
  const toX = (time: number): number => ((time - viewportStart) / duration) * trackWidth;
  const viewportEnd = viewportStart + duration;
  const active = useMemo(() => new Set(props.activeKey.split('\u0000').filter(Boolean)), [props.activeKey]);

  // Items crossing the viewport (with a small margin), plus the focused item so focus is never lost.
  const margin = duration * 0.05 + POINT_SIZE * msPerPixel;
  const rendered: TimelineItem<ItemMeta>[] = [];
  const firstIndex = lowerBound(layout.starts, viewportStart - margin);
  for (let i = 0; i < firstIndex; i++) {
    const item = layout.items[i]!;
    if (itemEnd(item) >= viewportStart || item.id === props.focusedId) rendered.push(item);
  }
  for (let i = firstIndex; i < layout.items.length; i++) {
    const item = layout.items[i]!;
    if (itemStart(item) > viewportEnd + margin) {
      const focused = props.focusedId ? layout.items.slice(i).find((rest) => rest.id === props.focusedId) : undefined;
      if (focused) rendered.push(focused);
      break;
    }
    rendered.push(item);
  }

  const describe = (item: TimelineItem<ItemMeta>): string => {
    if (props.getItemAriaLabel) return props.getItemAriaLabel(item);
    const group = item.group ? labels.group(item.group.count) : undefined;
    const parts = [item.label || group || item.id];
    if (group && item.label) parts.push(group);
    parts.push(isSpan(item) ? `${formatTime(item.start, mode)} – ${formatTime(item.end, mode)}` : formatTime(item.at, mode));
    return parts.join(', ');
  };

  return (
    <div
      className={`tw-row tw-row--depth-${Math.min(visible.depth, 5)}`}
      role="listitem"
      style={{ top: layout.top, height: layout.height }}
      data-row-id={visible.row.id}
    >
      <div className="tw-row-label" style={{ paddingLeft: 6 + visible.depth * indent }}>
        {visible.hasChildren ? (
          <button
            type="button"
            className="tw-toggle"
            aria-expanded={visible.expanded}
            aria-label={visible.expanded ? labels.collapseRow(visible.row.label) : labels.expandRow(visible.row.label)}
            onClick={() => actions.current.toggle(visible.row.id)}
          >
            <span aria-hidden="true" className="tw-chevron" />
          </button>
        ) : (
          <span className="tw-toggle-spacer" />
        )}
        <span className="tw-row-text">{props.renderRowLabel ? props.renderRowLabel(visible) : visible.row.label}</span>
      </div>
      <div className="tw-row-track">
        {rendered.map((item) => {
          const start = itemStart(item);
          const end = itemEnd(item);
          if (end < domainStart || start > domainEnd) return null;
          const lane = layout.lanes.get(item.id) ?? 0;
          const span = isSpan(item);
          const itemHeight = span ? laneHeight - 4 : POINT_SIZE;
          const top = ROW_PADDING + lane * laneHeight + (laneHeight - itemHeight) / 2;
          let left: number;
          let width: number;
          if (span) {
            const x1 = Math.max(-2, toX(Math.max(start, domainStart)));
            const x2 = Math.min(trackWidth + 2, toX(Math.min(end, domainEnd)));
            left = x1;
            width = Math.max(3, x2 - x1);
          } else {
            left = toX(start) - POINT_SIZE / 2;
            width = POINT_SIZE;
          }
          const selected = item.id === props.selectedId;
          const isActive = active.has(item.id);
          const classes = [
            'tw-item',
            span ? 'tw-item--span' : 'tw-item--point',
            item.group ? 'tw-item--group' : '',
            selected ? 'tw-item--selected' : '',
            isActive ? 'tw-item--active' : '',
            props.getItemClassName?.(item) ?? '',
          ]
            .filter(Boolean)
            .join(' ');
          const context: ItemRenderContext<RowMeta> = { row: visible, width, selected, active: isActive };
          // Too narrow for text: no clipped label, only a group count that fits.
          const compact = span && width < MIN_LABEL_WIDTH;
          return (
            <button
              key={item.id}
              type="button"
              className={classes}
              data-item-id={item.id}
              tabIndex={item.id === props.tabStopId ? 0 : -1}
              aria-label={describe(item)}
              aria-pressed={selected}
              aria-describedby={props.describedId === item.id ? props.tooltipId : undefined}
              style={{ left, width, top, height: itemHeight }}
              onClick={(event) => actions.current.activate(item, visible, event)}
              onKeyDown={(event) => actions.current.keyDown(event, item, layout)}
              onFocus={(event) => actions.current.focus(item, event.currentTarget)}
              onBlur={() => actions.current.blur(item)}
              onMouseEnter={(event) => actions.current.hover(item, event.currentTarget)}
              onMouseLeave={() => actions.current.leave(item)}
            >
              {props.renderItem ? (
                props.renderItem(item, context)
              ) : compact ? (
                item.group && countFits(item.group.count, width) ? (
                  <span className="tw-item-count tw-item-count--compact">{item.group.count}</span>
                ) : null
              ) : span ? (
                <span className="tw-item-label">
                  {item.label}
                  {item.group ? <span className="tw-item-count">{item.group.count}</span> : null}
                </span>
              ) : item.group ? (
                <span className="tw-item-count tw-item-count--point">{item.group.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const RowView = memo(RowViewImpl) as typeof RowViewImpl;

function DefaultDetail<RowMeta, ItemMeta>(props: {
  item: TimelineItem<ItemMeta>;
  row: VisibleRow<RowMeta> | undefined;
  labels: TimelineLabels;
  format: (time: number) => string;
}): ReactNode {
  const { item, row, labels, format } = props;
  return (
    <dl className="tw-detail-fields">
      {row && (
        <>
          <dt>{labels.rows}</dt>
          <dd>{row.row.label}</dd>
        </>
      )}
      {isSpan(item) ? (
        <>
          <dt>{labels.start}</dt>
          <dd>{format(item.start)}</dd>
          <dt>{labels.end}</dt>
          <dd>{format(item.end)}</dd>
        </>
      ) : (
        <>
          <dt>{labels.start}</dt>
          <dd>{format(item.at)}</dd>
        </>
      )}
      {item.group && (
        <>
          <dt>{labels.group(item.group.count)}</dt>
          <dd>{item.group.count}</dd>
        </>
      )}
    </dl>
  );
}

export type { TimelineSnapshot };
