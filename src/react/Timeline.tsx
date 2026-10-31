import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

function sortItems<M>(items: readonly TimelineItem<M>[]): TimelineItem<M>[] {
  return items
    .slice()
    .sort((a, b) => itemStart(a) - itemStart(b) || itemEnd(a) - itemEnd(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
    labelWidth = 220,
    initialTrackWidth = 800,
    locale,
    formatTick,
    renderRowLabel,
    renderItem,
    getItemClassName,
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
  const tooltipId = `tw-tooltip-${useId().replace(/:/g, '')}`;
  const snapshot = useTimelineSnapshot(controller);
  const { viewport, domain, mode } = snapshot;
  const formatTime = props.formatTime ?? ((time: number, timeMode: TimeMode) => formatTimeReadout(time, timeMode, locale));

  const [axisRef, trackWidth] = useElementWidth(initialTrackWidth);
  const [bodySizeRef, bodyHeight] = useElementHeight(300);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
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
  const itemsByRow = useMemo(() => {
    const grouped = groupItemsByRow(snapshot.items);
    const sorted = new Map<string, TimelineItem<ItemMeta>[]>();
    for (const [rowId, list] of grouped) sorted.set(rowId, sortItems(list));
    return sorted;
  }, [snapshot.items]);

  const laneScale = quantizedScale(msPerPixel);
  const laneCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof assignLanes>>();
    for (const [rowId, list] of itemsByRow) cache.set(rowId, assignLanes(list, (POINT_SIZE + 4) * laneScale));
    return cache;
  }, [itemsByRow, laneScale]);

  const rowLayouts = useMemo(() => {
    let top = 0;
    const result: RowLayout<RowMeta, ItemMeta>[] = [];
    for (const visible of snapshot.visibleRows) {
      const items = itemsByRow.get(visible.row.id) ?? [];
      const lanes = laneCache.get(visible.row.id);
      const laneCount = lanes?.laneCount ?? 1;
      const rowHeight = laneCount * laneHeight + ROW_PADDING * 2;
      result.push({
        visible,
        items,
        starts: items.map(itemStart),
        lanes: lanes?.lanes ?? new Map(),
        top,
        height: rowHeight,
      });
      top += rowHeight;
    }
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
      const hadFocus = !active || active === document.body || (frameRef.current?.contains(active) ?? false);
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
    event.currentTarget.setPointerCapture?.(event.pointerId);
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
      if (!target?.closest('.tw-axis, .tw-row-track, .tw-body')) return;
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
    revealTime(isSpan(item) ? Math.max(item.start, Math.min(item.end, viewport.start)) : item.at);
    const index = rowIndexById.get(item.rowId);
    if (index !== undefined) revealRow(index);
  };

  const activateItem = (item: TimelineItem<ItemMeta>, row: VisibleRow<RowMeta>, event: ReactMouseEvent | ReactKeyboardEvent): void => {
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
    if (focusedId && itemIndex.has(focusedId)) return focusedId;
    for (const layout of visibleRowSlice) {
      const first = layout.items.find((item) => itemEnd(item) >= viewport.start && itemStart(item) <= viewport.end);
      if (first) return first.id;
    }
    return null;
  }, [focusedId, itemIndex, visibleRowSlice, viewport]);

  // ------------------------------------------------------------------ status
  const statusMessage = useMemo(() => {
    if (snapshot.status === 'initializing') return labels.initializing;
    if (snapshot.status === 'error' && snapshot.error) return labels.preparationError(formatTime(snapshot.error.target, mode));
    if (snapshot.pending && (snapshot.pending.cause === 'seek' || snapshot.pending.cause === 'key' || snapshot.pending.cause === 'stop')) {
      return labels.preparing(formatTime(snapshot.pending.target, mode));
    }
    if (snapshot.data.error) return labels.dataError;
    return '';
    // Playback frames are deliberately not announced.
  }, [snapshot.status, snapshot.error, snapshot.pending, snapshot.data.error, labels, mode, formatTime]);

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

  const describeItem = (item: TimelineItem<ItemMeta>): string => {
    const parts = [item.label ?? item.id];
    if (item.group) parts.push(labels.group(item.group.count));
    parts.push(isSpan(item) ? `${formatTime(item.start, mode)} – ${formatTime(item.end, mode)}` : formatTime(item.at, mode));
    return parts.join(', ');
  };

  const showTooltip = (item: TimelineItem<ItemMeta>, element: HTMLElement): void => {
    if (!tooltip) return;
    const frame = frameRef.current?.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    setHovered({ id: item.id, x: rect.left - (frame?.left ?? 0) + rect.width / 2, y: rect.bottom - (frame?.top ?? 0) + 6 });
  };

  const renderItemElement = (item: TimelineItem<ItemMeta>, layout: RowLayout<RowMeta, ItemMeta>): ReactNode => {
    const start = itemStart(item);
    const end = itemEnd(item);
    const lane = layout.lanes.get(item.id) ?? 0;
    const span = isSpan(item);
    const itemHeight = span ? laneHeight - 4 : POINT_SIZE;
    const top = ROW_PADDING + lane * laneHeight + (laneHeight - itemHeight) / 2;
    let left: number;
    let width: number;
    if (span) {
      const x1 = Math.max(-2, toX(Math.max(start, domain.start)));
      const x2 = Math.min(trackWidth + 2, toX(Math.min(end, domain.end)));
      left = x1;
      width = Math.max(3, x2 - x1);
    } else {
      left = toX(start) - POINT_SIZE / 2;
      width = POINT_SIZE;
    }
    const selected = item.id === selectedId;
    const active = span ? snapshot.time >= start && snapshot.time < end : Math.abs(snapshot.time - start) <= msPerPixel * 2;
    const classes = [
      'tw-item',
      span ? 'tw-item--span' : 'tw-item--point',
      item.group ? 'tw-item--group' : '',
      selected ? 'tw-item--selected' : '',
      active ? 'tw-item--active' : '',
      getItemClassName?.(item) ?? '',
    ]
      .filter(Boolean)
      .join(' ');
    const context: ItemRenderContext<RowMeta> = { row: layout.visible, width, selected, active };
    return (
      <button
        key={item.id}
        type="button"
        className={classes}
        data-item-id={item.id}
        tabIndex={item.id === tabStopId ? 0 : -1}
        aria-label={describeItem(item)}
        aria-pressed={selected}
        aria-describedby={hovered?.id === item.id ? tooltipId : undefined}
        style={{ left, width, top, height: itemHeight }}
        onClick={(event) => activateItem(item, layout.visible, event)}
        onKeyDown={(event) => onItemKeyDown(event, item, layout)}
        onFocus={(event) => {
          setFocusedId(item.id);
          showTooltip(item, event.currentTarget);
        }}
        onBlur={() => setHovered((current) => (current?.id === item.id ? null : current))}
        onMouseEnter={(event) => showTooltip(item, event.currentTarget)}
        onMouseLeave={() => setHovered((current) => (current?.id === item.id ? null : current))}
      >
        {renderItem ? (
          renderItem(item, context)
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
  };

  const frameStyle = {
    '--tw-label-width': `${labelWidth}px`,
    height,
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={frameRef}
      className={['tw-timeline', className].filter(Boolean).join(' ')}
      style={frameStyle}
      role="region"
      aria-label={labels.timeline}
      data-status={snapshot.status}
      data-transport={snapshot.transport}
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
              <button type="button" className="tw-button tw-button--text" onClick={() => controller.setViewport(domain, { origin: 'zoom' })} title={labels.zoomFit}>
                {labels.zoomFit}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tw-header">
        <div className="tw-corner">{rowsHeader ?? labels.rows}</div>
        <div
          ref={setAxisRef}
          className="tw-axis"
          tabIndex={0}
          role="slider"
          aria-label={labels.cursor}
          aria-valuemin={domain.start}
          aria-valuemax={domain.end}
          aria-valuenow={Math.round(snapshot.time)}
          aria-valuetext={formatTime(snapshot.time, mode)}
          aria-busy={snapshot.status === 'preparing' || snapshot.status === 'initializing'}
          onKeyDown={onAxisKeyDown}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
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
              return (
                <g key={tick.time} className={tick.major ? 'tw-tick tw-tick--major' : 'tw-tick'} transform={`translate(${x},0)`}>
                  <line y1="22" y2="100%" />
                  <text x="4" y="16">
                    {tick.label}
                  </text>
                </g>
              );
            })}
          </svg>
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
          {inTrack(cursorX) && (
            <span
              className="tw-cursor-handle"
              style={{ left: cursorX }}
              onPointerDown={onCursorPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => {
                drag.current = null;
                event.currentTarget.releasePointerCapture?.(event.pointerId);
              }}
              aria-hidden="true"
            />
          )}
          {snapshot.data.loading && <span className="tw-loading" aria-hidden="true" />}
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
              const { visible } = layout;
              const firstIndex = lowerBound(layout.starts, viewport.start - duration * 0.05 - (POINT_SIZE * msPerPixel));
              const rendered: TimelineItem<ItemMeta>[] = [];
              // Spans that started before the viewport may still cross it.
              for (let i = 0; i < firstIndex; i++) {
                const item = layout.items[i]!;
                if (itemEnd(item) >= viewport.start || item.id === focusedId) rendered.push(item);
              }
              const limit = viewport.end + duration * 0.05 + POINT_SIZE * msPerPixel;
              for (let i = firstIndex; i < layout.items.length; i++) {
                const item = layout.items[i]!;
                if (itemStart(item) > limit) {
                  if (focusedId && layout.items.slice(i).some((rest) => rest.id === focusedId)) {
                    rendered.push(layout.items.find((rest) => rest.id === focusedId)!);
                  }
                  break;
                }
                rendered.push(item);
              }
              const inDomain = rendered.filter((item) => itemEnd(item) >= domain.start && itemStart(item) <= domain.end);
              return (
                <div
                  key={visible.row.id}
                  className={`tw-row tw-row--depth-${Math.min(visible.depth, 5)}`}
                  role="listitem"
                  style={{ top: layout.top, height: layout.height }}
                  data-row-id={visible.row.id}
                >
                  <div className="tw-row-label" style={{ paddingLeft: 10 + visible.depth * 16 }}>
                    {visible.hasChildren ? (
                      <button
                        type="button"
                        className="tw-toggle"
                        aria-expanded={visible.expanded}
                        aria-label={visible.expanded ? labels.collapseRow(visible.row.label) : labels.expandRow(visible.row.label)}
                        onClick={() => controller.toggle(visible.row.id)}
                      >
                        <span aria-hidden="true" className="tw-chevron" />
                      </button>
                    ) : (
                      <span className="tw-toggle-spacer" />
                    )}
                    <span className="tw-row-text">{renderRowLabel ? renderRowLabel(visible) : visible.row.label}</span>
                  </div>
                  <div className="tw-row-track">{inDomain.map((item) => renderItemElement(item, layout))}</div>
                </div>
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
