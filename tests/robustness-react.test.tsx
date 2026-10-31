// @vitest-environment jsdom
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PlaybackControls,
  Timeline,
  createManualScheduler,
  createTimelineController,
  useTimelineController,
  useTimelineHost,
} from '../src/react/index.js';
import type { ManualScheduler, TimelineController, TimelineItem } from '../src/react/index.js';

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
];

function makeController(): { controller: TimelineController; scheduler: ManualScheduler } {
  const scheduler = createManualScheduler();
  const controller = createTimelineController({
    mode: 'relative',
    domain: { start: 0, end: 10_000_000 },
    rows,
    source: items,
    keys: [{ id: 'k1', at: 4000, label: 'Alerte' }],
    expanded: ['root'],
    scheduler,
  });
  controller.start();
  return { controller, scheduler };
}

const listenerCount = (controller: TimelineController): number => (controller as any).listeners.size;
const eventListenerCount = (controller: TimelineController): number => {
  const sets = (controller as any).eventListeners;
  return sets.time.size + sets.error.size + sets.dataError.size;
};

/**
 * Tracks the listeners registered on `document` and `window`, with the DOM's
 * deduplication semantics (same type, callback and capture flag = one listener).
 */
function trackGlobalListeners() {
  const live = new Map<string, Set<unknown>>();
  let added = 0;
  const restores: (() => void)[] = [];
  const capture = (options: unknown): boolean =>
    typeof options === 'boolean' ? options : Boolean((options as { capture?: boolean } | undefined)?.capture);
  for (const [name, target] of [
    ['document', document],
    ['window', window],
  ] as const) {
    const add = target.addEventListener;
    const remove = target.removeEventListener;
    target.addEventListener = function (this: EventTarget, type: string, fn: any, options?: any) {
      const key = `${name}:${type}:${capture(options)}`;
      if (fn) {
        if (!live.has(key)) live.set(key, new Set());
        live.get(key)!.add(fn);
        added++;
      }
      return add.call(this, type, fn, options);
    } as typeof target.addEventListener;
    target.removeEventListener = function (this: EventTarget, type: string, fn: any, options?: any) {
      live.get(`${name}:${type}:${capture(options)}`)?.delete(fn);
      return remove.call(this, type, fn, options);
    } as typeof target.removeEventListener;
    restores.push(() => {
      target.addEventListener = add;
      target.removeEventListener = remove;
    });
  }
  return {
    get live(): number {
      let total = 0;
      for (const set of live.values()) total += set.size;
      return total;
    },
    get added(): number {
      return added;
    },
    keys: () => Array.from(live).filter(([, set]) => set.size).map(([key, set]) => `${key}=${set.size}`),
    restore: () => restores.forEach((restore) => restore()),
  };
}

/** The application connects the shared controller to the page once per mounted view. */
function Host({ controller, children }: { controller: TimelineController; children: ReactNode }): ReactNode {
  useTimelineHost(controller, { respectReducedMotion: true });
  return children;
}

function View({ controller, host = true }: { controller: TimelineController; host?: boolean }): ReactNode {
  const content = (
    <>
      <PlaybackControls controller={controller} showLive />
      <Timeline controller={controller} detail />
    </>
  );
  return host ? <Host controller={controller}>{content}</Host> : content;
}

let tracker: ReturnType<typeof trackGlobalListeners>;
let originalMatchMedia: typeof window.matchMedia | undefined;
const mediaListeners = new Set<unknown>();

beforeEach(() => {
  // jsdom has no matchMedia: a minimal one lets `respectReducedMotion` register its listener.
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: (_type: string, fn: unknown) => mediaListeners.add(fn),
    removeEventListener: (_type: string, fn: unknown) => mediaListeners.delete(fn),
  })) as unknown as typeof window.matchMedia;
  mediaListeners.clear();
  tracker = trackGlobalListeners();
});

afterEach(() => {
  tracker.restore();
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  else delete (window as any).matchMedia;
});

describe.each([
  ['plain', false],
  ['StrictMode', true],
])('mount/unmount cycles (%s)', (_name, strict) => {
  const wrap = (node: ReactNode): ReactNode => (strict ? <StrictMode>{node}</StrictMode> : node);

  it('200 remounts of Timeline + PlaybackControls leave no listener behind', () => {
    const { controller, scheduler } = makeController();
    const baseListeners = listenerCount(controller);
    const baseEvents = eventListenerCount(controller);
    // Warm-up: React DOM installs process-wide listeners once (`selectionchange` on the
    // document, focus/pointer capture listeners on the window at the first interaction).
    // They are not per-mount and are excluded from the baseline.
    const warm = render(wrap(<View controller={controller} />));
    fireEvent.click(screen.getByRole('button', { name: /Mesure 2/ }));
    warm.unmount();
    warm.container.remove();
    const baseGlobal = tracker.live;

    for (let i = 0; i < 200; i++) {
      const { unmount, container } = render(wrap(<View controller={controller} />));
      expect(listenerCount(controller)).toBeGreaterThan(baseListeners);
      // Some cycles interact before unmounting: play, open the detail dialog, move time.
      if (i % 10 === 0) {
        fireEvent.click(screen.getByRole('button', { name: /Mesure 2/ }));
        expect(screen.getByRole('dialog')).toBeTruthy();
      }
      if (i % 3 === 0) act(() => controller.togglePlay());
      if (i % 2 === 0) act(() => scheduler.frame(16));
      expect(scheduler.pendingFrames).toBeLessThanOrEqual(1);
      unmount();
      expect(container.childNodes).toHaveLength(0);
      container.remove();
      expect(listenerCount(controller)).toBe(baseListeners);
      expect(tracker.live, `${i}: ${tracker.keys().join(', ')}`).toBe(baseGlobal);
      // An unmounted host suspends the clock: no frame is left requested.
      expect(scheduler.pendingFrames).toBe(0);
    }
    expect(tracker.added).toBeGreaterThan(0); // visibilitychange was registered (and removed) each time
    expect(mediaListeners.size).toBe(0);
    expect(eventListenerCount(controller)).toBe(baseEvents);
    // Nothing left in the page, including the dialog portal rendered in document.body.
    expect(document.body.children.length).toBe(0);
  }, 30_000);

  it('only one frame request is outstanding while playing after remounts', () => {
    const { controller, scheduler } = makeController();
    act(() => controller.play());
    for (let i = 0; i < 25; i++) {
      const { unmount } = render(wrap(<View controller={controller} />));
      expect(scheduler.pendingFrames).toBe(1);
      act(() => scheduler.advance(48));
      expect(scheduler.pendingFrames).toBe(1);
      unmount();
      expect(scheduler.pendingFrames).toBe(0);
    }
    // Two views sharing the controller, mounted and remounted alternately.
    const first = render(wrap(<View controller={controller} />));
    const second = render(wrap(<View controller={controller} />));
    for (let i = 0; i < 25; i++) {
      const extra = render(wrap(<View controller={controller} />));
      act(() => scheduler.frame(16));
      expect(scheduler.pendingFrames).toBe(1);
      extra.unmount();
    }
    // The last unmounted host suspended the controller although others are mounted:
    // documented behaviour of useTimelineHost ("use it once per controller").
    second.unmount();
    first.unmount();
    expect(scheduler.pendingFrames).toBe(0);
    expect(controller.getSnapshot().transport).toBe('playing');

    // Views without a host never touch the clock: the frame stays single.
    act(() => controller.setActive(true));
    expect(scheduler.pendingFrames).toBe(1);
    for (let i = 0; i < 25; i++) {
      const { unmount } = render(wrap(<View controller={controller} host={false} />));
      act(() => scheduler.frame(16));
      expect(scheduler.pendingFrames).toBe(1);
      unmount();
      expect(scheduler.pendingFrames).toBe(1);
    }
    expect(listenerCount(controller)).toBe(0);
    controller.dispose();
    expect(scheduler.pendingFrames).toBe(0);
  });

  it('useTimelineController instances are suspended on unmount and leak no global listener', () => {
    let baseGlobal = -1;
    const schedulers: ManualScheduler[] = [];
    const controllers: TimelineController[] = [];
    function Owned(): ReactNode {
      const scheduler = createManualScheduler();
      schedulers.push(scheduler);
      const controller = useTimelineController({ mode: 'relative', domain: { start: 0, end: 10_000 }, rows, source: items, scheduler });
      controllers.push(controller);
      return <View controller={controller} host={false} />;
    }
    for (let i = 0; i < 50; i++) {
      const { unmount } = render(wrap(<Owned />));
      const controller = controllers[controllers.length - 1]!;
      act(() => controller.play());
      unmount();
      expect(listenerCount(controller)).toBe(0);
      expect(controller.isActive()).toBe(false);
      // The first cycle is the warm-up (see above).
      if (i === 0) baseGlobal = tracker.live;
      expect(tracker.live).toBe(baseGlobal);
    }
    expect(schedulers.every((scheduler) => scheduler.pendingFrames === 0)).toBe(true);
    expect(mediaListeners.size).toBe(0);
  });
});
