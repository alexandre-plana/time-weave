/**
 * Source of time pulses for playback. The engine never counts frames: it uses
 * the elapsed time between two pulses, so the frame rate does not change the result.
 */
export interface FrameScheduler {
  /** Current time in milliseconds, monotonic. */
  now(): number;
  /** Requests one call of `callback`; returns a function cancelling the request. */
  requestFrame(callback: (now: number) => void): () => void;
}

/** Timer-based scheduler available in any JavaScript environment. */
export function createTimeoutScheduler(interval = 16): FrameScheduler {
  const clock = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance : Date;
  return {
    now: () => clock.now(),
    requestFrame(callback) {
      const handle = setTimeout(() => callback(clock.now()), interval);
      return () => clearTimeout(handle);
    },
  };
}

/** Scheduler driven by hand, for tests and deterministic simulations. */
export interface ManualScheduler extends FrameScheduler {
  /** Number of frame callbacks waiting. */
  readonly pendingFrames: number;
  /** Moves the clock without running frames, e.g. to simulate a blocked thread. */
  setTime(time: number): void;
  /** Runs one frame `step` milliseconds after the current time. */
  frame(step?: number): void;
  /** Runs frames of `step` milliseconds until `duration` has elapsed. */
  advance(duration: number, step?: number): void;
}

export function createManualScheduler(start = 0): ManualScheduler {
  let time = start;
  let nextId = 1;
  const callbacks = new Map<number, (now: number) => void>();
  const runFrame = (): void => {
    const due = Array.from(callbacks.values());
    callbacks.clear();
    for (const callback of due) callback(time);
  };
  return {
    now: () => time,
    requestFrame(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return () => {
        callbacks.delete(id);
      };
    },
    get pendingFrames() {
      return callbacks.size;
    },
    setTime(next) {
      time = next;
    },
    frame(step = 16) {
      time += step;
      runFrame();
    },
    advance(duration, step = 16) {
      let remaining = duration;
      while (remaining > 0) {
        const delta = Math.min(step, remaining);
        remaining -= delta;
        time += delta;
        runFrame();
      }
    },
  };
}
