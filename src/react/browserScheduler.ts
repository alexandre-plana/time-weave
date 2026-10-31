import type { FrameScheduler } from '../core/index.js';
import { createTimeoutScheduler } from '../core/index.js';

/**
 * Scheduler using `requestAnimationFrame`. Globals are only read when a frame
 * is requested, so creating it has no side effect on import or on the server.
 */
export function createAnimationFrameScheduler(): FrameScheduler {
  let fallback: FrameScheduler | null = null;
  const getFallback = (): FrameScheduler => (fallback ??= createTimeoutScheduler());
  return {
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    requestFrame(callback) {
      if (typeof requestAnimationFrame !== 'function') return getFallback().requestFrame(callback);
      const handle = requestAnimationFrame((now) => callback(now));
      return () => cancelAnimationFrame(handle);
    },
  };
}
