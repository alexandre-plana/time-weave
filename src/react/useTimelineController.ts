import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { TimelineController } from '../core/index.js';
import type { TimelineControllerOptions, TimelineSnapshot } from '../core/index.js';
import { createAnimationFrameScheduler } from './browserScheduler.js';

export interface UseTimelineControllerOptions<RowMeta, ItemMeta, KeyMeta>
  extends TimelineControllerOptions<RowMeta, ItemMeta, KeyMeta> {
  /**
   * Follow the user's `prefers-reduced-motion` setting. Defaults to `true`
   * unless `reducedMotion` is given explicitly.
   */
  respectReducedMotion?: boolean;
}

/**
 * Creates one stable controller for the component's lifetime. Options are read
 * once: later changes go through the controller's commands, except `prepareTime`
 * which always calls the latest function.
 *
 * Effects start the controller, pause progression while the page is hidden and
 * suspend it when the component unmounts. Re-run effects (StrictMode, Activity)
 * never create a second clock or leave subscriptions behind.
 */
export function useTimelineController<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown>(
  options: UseTimelineControllerOptions<RowMeta, ItemMeta, KeyMeta>,
): TimelineController<RowMeta, ItemMeta, KeyMeta> {
  const prepareRef = useRef(options.prepareTime);
  prepareRef.current = options.prepareTime;
  const [controller] = useState(() => {
    const { respectReducedMotion: _ignored, prepareTime, ...rest } = options;
    return new TimelineController<RowMeta, ItemMeta, KeyMeta>({
      ...rest,
      scheduler: options.scheduler ?? createAnimationFrameScheduler(),
      prepareTime: prepareTime ? (request) => prepareRef.current?.(request) : undefined,
    });
  });
  const respectReducedMotion = options.respectReducedMotion ?? options.reducedMotion === undefined;
  useTimelineHost(controller, { respectReducedMotion });
  return controller;
}

export interface TimelineHostOptions {
  readonly respectReducedMotion?: boolean;
}

/**
 * Connects an existing controller to the browser: start, page visibility and
 * reduced motion. Use it once per controller when the application owns the instance.
 */
export function useTimelineHost(controller: TimelineController<any, any, any>, options: TimelineHostOptions = {}): void {
  const respectReducedMotion = options.respectReducedMotion ?? false;
  useEffect(() => {
    if (controller.isDisposed()) return;
    const doc = typeof document !== 'undefined' ? document : null;
    const update = (): void => controller.setActive(!(doc?.hidden ?? false));
    update();
    controller.start();
    doc?.addEventListener('visibilitychange', update);
    let media: MediaQueryList | null = null;
    const onMotion = (): void => controller.setReducedMotion(Boolean(media?.matches));
    if (respectReducedMotion && typeof matchMedia === 'function') {
      media = matchMedia('(prefers-reduced-motion: reduce)');
      onMotion();
      media.addEventListener?.('change', onMotion);
    }
    return () => {
      doc?.removeEventListener('visibilitychange', update);
      media?.removeEventListener?.('change', onMotion);
      controller.setActive(false);
    };
  }, [controller, respectReducedMotion]);
}

/** Subscribes to the controller state with `useSyncExternalStore`. */
export function useTimelineSnapshot<RowMeta, ItemMeta, KeyMeta>(
  controller: TimelineController<RowMeta, ItemMeta, KeyMeta>,
): TimelineSnapshot<RowMeta, ItemMeta, KeyMeta> {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}

/**
 * Subscribes to a slice of the controller state. The component re-renders only
 * when `isEqual(previous, next)` is false, so a component reading `transport`
 * does not render on every playback frame. The selector may be an inline
 * function; use {@link shallowEqual} when it builds a new object or array.
 *
 * Same semantics as `useSyncExternalStoreWithSelector`, built on the native
 * `useSyncExternalStore` (no tearing, React 18.3 and 19).
 */
export function useTimelineSelector<Selection, RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown>(
  controller: TimelineController<RowMeta, ItemMeta, KeyMeta>,
  selector: (snapshot: TimelineSnapshot<RowMeta, ItemMeta, KeyMeta>) => Selection,
  isEqual: (previous: Selection, next: Selection) => boolean = Object.is,
): Selection {
  // Last committed selection, reused by a new memo (new inline selector,
  // re-render) as long as it stays equal.
  const committed = useRef<{ value: Selection } | null>(null);
  const getSelection = useMemo(() => {
    let memoized: { snapshot: TimelineSnapshot<RowMeta, ItemMeta, KeyMeta>; selection: Selection } | null = null;
    return (): Selection => {
      const snapshot = controller.getSnapshot();
      if (memoized && Object.is(memoized.snapshot, snapshot)) return memoized.selection;
      const next = selector(snapshot);
      const previous = memoized ?? (committed.current ? { selection: committed.current.value } : null);
      const selection = previous && isEqual(previous.selection, next) ? previous.selection : next;
      memoized = { snapshot, selection };
      return selection;
    };
  }, [controller, selector, isEqual]);
  const value = useSyncExternalStore(controller.subscribe, getSelection, getSelection);
  useEffect(() => {
    committed.current = { value };
  }, [value]);
  return value;
}

/**
 * Compares two values one level deep: identical values, or arrays / plain
 * objects whose items or own enumerable keys are `Object.is` equal.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const right = b as unknown as readonly unknown[];
    return a.length === right.length && a.every((item, index) => Object.is(item, right[index]));
  }
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && Object.is(left[key], right[key]));
}
