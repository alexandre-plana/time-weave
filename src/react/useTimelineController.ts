import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
