import { createManualScheduler, createTimelineController } from '../src/core/index.js';
import type { TimeRequest, TimelineControllerOptions } from '../src/core/index.js';

export interface Deferred<T = void> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

export function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Controller with a manual scheduler; `prepare` lets each test resolve requests by hand. */
export function setup(options: Partial<TimelineControllerOptions> = {}, manualPrepare = false) {
  const scheduler = createManualScheduler();
  const requests: { request: TimeRequest; done: Deferred }[] = [];
  const controller = createTimelineController({
    domain: { start: 0, end: 10_000 },
    mode: 'relative',
    scheduler,
    ...(manualPrepare
      ? {
          prepareTime: (request: TimeRequest) => {
            const done = deferred();
            requests.push({ request, done });
            return done.promise;
          },
        }
      : {}),
    ...options,
  });
  const last = () => requests[requests.length - 1]!;
  const resolveLast = async () => {
    last().done.resolve();
    await flush();
  };
  return { controller, scheduler, requests, last, resolveLast, snap: () => controller.getSnapshot() };
}
