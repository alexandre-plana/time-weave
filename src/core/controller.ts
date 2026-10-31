import type {
  CollectionChanges,
  ItemBatch,
  TimeMode,
  TimeRange,
  TimelineItem,
  TimelineKey,
  TimelineRow,
} from './model.js';
import { TimelineValidationError, isAbortError } from './errors.js';
import type { ValidationIssue } from './errors.js';
import {
  applyChanges,
  isValidTime,
  throwIfIssues,
  validateDomain,
  validateItems,
  validateKeys,
  validateRange,
  validateRows,
} from './validate.js';
import {
  anchorViewport,
  clamp,
  expandRange,
  fitViewport,
  rangeContains,
  rangeContainsTime,
  rangeDuration,
} from './time.js';
import { buildRowTree, flattenVisibleRows } from './tree.js';
import type { RowTree, VisibleRow } from './tree.js';
import { keyInstants, nextKeyInstant, previousKeyInstant } from './keys.js';
import type { FrameScheduler } from './scheduler.js';
import { createTimeoutScheduler } from './scheduler.js';

/** Why the time is being moved. */
export type TimeCause = 'initial' | 'play' | 'seek' | 'key' | 'loop' | 'stop' | 'rewind' | 'live';

/** Single transport intention: the modes never progress simultaneously. */
export type Transport = 'paused' | 'playing' | 'live';

export type TimelineStatus = 'initializing' | 'ready' | 'preparing' | 'error';

/** Request passed to `prepareTime`. Resolving confirms it if it is still current. */
export interface TimeRequest {
  readonly id: number;
  readonly previous: number;
  readonly target: number;
  readonly cause: TimeCause;
  readonly signal: AbortSignal;
  isCurrent(): boolean;
}

export type WindowReason = 'initial' | 'navigation' | 'follow' | 'refresh' | 'source';

export interface WindowRequest {
  readonly id: number;
  readonly generation: number;
  /** Visible viewport when the request was made. */
  readonly visible: TimeRange;
  /** Requested range: the viewport with its margin, bounded to the domain. */
  readonly range: TimeRange;
  readonly reason: WindowReason;
  readonly signal: AbortSignal;
  isCurrent(): boolean;
}

export interface StaticSource<ItemMeta = unknown> {
  readonly kind: 'static';
  readonly items: readonly TimelineItem<ItemMeta>[];
}

export interface WindowedSource<ItemMeta = unknown> {
  readonly kind: 'windowed';
  load(request: WindowRequest): ItemBatch<ItemMeta> | PromiseLike<ItemBatch<ItemMeta>>;
}

export type ItemSource<ItemMeta = unknown> = StaticSource<ItemMeta> | WindowedSource<ItemMeta>;

export interface PendingTime {
  readonly id: number;
  readonly target: number;
  readonly cause: TimeCause;
}

export interface PreparationError {
  readonly target: number;
  readonly cause: TimeCause;
  readonly error: unknown;
}

export interface DataState {
  /** Range covered by the current valid batch, or `null` when nothing is loaded. */
  readonly coverage: TimeRange | null;
  readonly loading: boolean;
  readonly error: unknown;
}

export interface TimelineSnapshot<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown> {
  readonly mode: TimeMode;
  readonly domain: TimeRange;
  readonly liveTime: number;
  /** Confirmed time. The main cursor shows it. */
  readonly time: number;
  readonly status: TimelineStatus;
  readonly transport: Transport;
  readonly pending: PendingTime | null;
  readonly rewinding: boolean;
  readonly lastCause: TimeCause | null;
  readonly error: PreparationError | null;
  readonly speed: number;
  readonly loop: boolean;
  readonly followPlayback: boolean;
  readonly reducedMotion: boolean;
  readonly viewport: TimeRange;
  readonly minViewportDuration: number;
  readonly rows: readonly TimelineRow<RowMeta>[];
  readonly rowTree: RowTree<RowMeta>;
  readonly visibleRows: readonly VisibleRow<RowMeta>[];
  readonly expanded: ReadonlySet<string>;
  readonly keys: readonly TimelineKey<KeyMeta>[];
  /** Sorted distinct key instants. */
  readonly keyInstants: readonly number[];
  readonly canPreviousKey: boolean;
  readonly canNextKey: boolean;
  readonly items: readonly TimelineItem<ItemMeta>[];
  readonly data: DataState;
  readonly sourceKind: ItemSource['kind'];
}

export interface TimelineControllerOptions<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown> {
  /** Defaults to `calendar`. Fixed for the instance. */
  mode?: TimeMode;
  /** Complete period, independent from the loaded items. */
  domain: TimeRange;
  /** Live frontier; defaults to the end of the domain. */
  liveTime?: number;
  rows?: readonly TimelineRow<RowMeta>[];
  keys?: readonly TimelineKey<KeyMeta>[];
  /** Items in memory, or a provider called by window. */
  source?: ItemSource<ItemMeta> | readonly TimelineItem<ItemMeta>[];
  /** Defaults to the domain start. */
  initialTime?: number;
  /** Defaults to the whole domain. */
  viewport?: TimeRange;
  /** Defaults to 1 ms. */
  minViewportDuration?: number;
  /** Defaults to 1. */
  speed?: number;
  loop?: boolean;
  /** Translate the viewport when a destination leaves it. Defaults to `true`. */
  followPlayback?: boolean;
  /** Active duration of a rewind, in ms. Defaults to 300. */
  rewindDuration?: number;
  /** Turns rewinds into immediate jumps. */
  reducedMotion?: boolean;
  /** Rows initially expanded. Others start collapsed. */
  expanded?: Iterable<string>;
  /** Margin requested on each side of the viewport, as a ratio of its duration. Defaults to 0.25. */
  windowMargin?: number;
  /** Largest elapsed time taken into account between two pulses. Defaults to 250 ms. */
  maxFrameDelta?: number;
  /** Lets the application prepare its state before a time is confirmed. */
  prepareTime?: (request: TimeRequest) => void | PromiseLike<unknown>;
  scheduler?: FrameScheduler;
}

export interface TimeChange {
  readonly time: number;
  readonly previous: number;
  readonly cause: TimeCause;
  readonly requestId: number;
}

export interface TimelineEvents {
  time: TimeChange;
  error: PreparationError;
  dataError: { readonly error: unknown };
}

export interface ViewportOptions {
  /** `zoom` keeps the live anchor; `navigation` (default) leaves live mode. */
  readonly origin?: 'navigation' | 'zoom';
}

interface Preparation {
  readonly id: number;
  readonly target: number;
  readonly previous: number;
  readonly cause: TimeCause;
  readonly abort: AbortController;
}

interface Rewind {
  readonly from: number;
  readonly target: number;
  readonly duration: number;
  elapsed: number;
}

interface ActiveLoad {
  readonly id: number;
  readonly generation: number;
  readonly range: TimeRange;
  readonly abort: AbortController;
  /** Rows known when the request was issued (row trees are immutable, so this is a cheap reference). */
  readonly rowsAtRequest: ReadonlyMap<string, unknown>;
}

interface CoverageWaiter {
  readonly time: number;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
}

type Listener<T> = (value: T) => void;

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function';
}

function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * Owner of the timeline state. Internal buttons and application commands go
 * through the same transitions; views observe immutable snapshots.
 */
export class TimelineController<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown> {
  readonly mode: TimeMode;

  private domain: TimeRange;
  private liveTime: number;
  private liveExplicit: boolean;
  private time: number;
  private initialTime: number;
  private initialized = false;
  private transport: Transport = 'paused';
  private lastCause: TimeCause | null = null;
  private error: PreparationError | null = null;
  private speed: number;
  private loop: boolean;
  private followPlayback: boolean;
  private reducedMotion: boolean;
  private rewindDuration: number;
  private viewport: TimeRange;
  private readonly minViewportDuration: number;
  private readonly windowMargin: number;
  private readonly maxFrameDelta: number;

  private rows: readonly TimelineRow<RowMeta>[] = [];
  private rowTree: RowTree<RowMeta>;
  private expanded: ReadonlySet<string>;
  private visibleRowsCache: readonly VisibleRow<RowMeta>[] | null = null;
  private keys: readonly TimelineKey<KeyMeta>[] = [];
  private keyInstantsCache: number[] = [];

  private source: ItemSource<ItemMeta>;
  private items: readonly TimelineItem<ItemMeta>[] = [];
  /**
   * id -> position in `itemIndexFor` (see `ItemIndex`), used by `update()` on a static source to
   * apply small changes without re-indexing or revalidating the whole
   * collection. It is only trusted while `itemIndexFor === this.items`; any
   * other assignment of `items` (setItems, setSource, row pruning, ...)
   * invalidates it implicitly and it is rebuilt lazily on the next update.
   */
  private itemIndex: ItemIndex | null = null;
  private itemIndexFor: readonly TimelineItem<ItemMeta>[] | null = null;
  private coverage: TimeRange | null = null;
  private dataError: unknown = null;

  private prep: Preparation | null = null;
  private prepSeq = 0;
  private rewind: Rewind | null = null;
  private restartOnConfirm: Preparation | null = null;
  private prepareTime: TimelineControllerOptions<RowMeta, ItemMeta, KeyMeta>['prepareTime'];

  private loadSeq = 0;
  private generation = 0;
  private activeLoad: ActiveLoad | null = null;
  private nextLoadWanted = false;
  private refreshPending = false;
  private navigationQueued = false;
  private coverageWaiters: CoverageWaiter[] = [];

  private scheduler: FrameScheduler;
  private cancelFrame: (() => void) | null = null;
  private lastFrameNow: number | null = null;
  /** Timestamp of the frame being processed, so a synchronous confirmation keeps it as reference. */
  private frameNow: number | null = null;
  private active = true;
  private started = false;
  private disposed = false;

  private listeners = new Set<() => void>();
  private eventListeners: { [K in keyof TimelineEvents]: Set<Listener<TimelineEvents[K]>> } = {
    time: new Set(),
    error: new Set(),
    dataError: new Set(),
  };
  private batchDepth = 0;
  private dirty = false;
  private snapshot: TimelineSnapshot<RowMeta, ItemMeta, KeyMeta> | null = null;

  constructor(options: TimelineControllerOptions<RowMeta, ItemMeta, KeyMeta>) {
    const mode = options.mode ?? 'calendar';
    if (mode !== 'calendar' && mode !== 'relative') {
      throw new TimelineValidationError([{ code: 'invalid-option', path: 'mode', message: `Unknown mode "${String(mode)}"` }]);
    }
    this.mode = mode;
    throwIfIssues(validateDomain(options.domain, mode));
    this.domain = { start: options.domain.start, end: options.domain.end };

    const issues: ValidationIssue[] = [];
    const positive = (value: number | undefined, fallback: number, path: string, allowZero = false): number => {
      if (value === undefined) return fallback;
      if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
        issues.push({ code: 'invalid-option', path, message: `${path} must be a ${allowZero ? 'non-negative' : 'positive'} finite number` });
        return fallback;
      }
      return value;
    };
    this.speed = positive(options.speed, 1, 'speed');
    this.minViewportDuration = positive(options.minViewportDuration, 1, 'minViewportDuration');
    this.rewindDuration = positive(options.rewindDuration, 300, 'rewindDuration', true);
    this.windowMargin = positive(options.windowMargin, 0.25, 'windowMargin', true);
    this.maxFrameDelta = positive(options.maxFrameDelta, 250, 'maxFrameDelta');
    if (options.liveTime !== undefined && !(isValidTime(options.liveTime, mode) && rangeContainsTime(this.domain, options.liveTime))) {
      issues.push({ code: 'invalid-time', path: 'liveTime', message: 'liveTime must be inside the domain' });
    }
    if (options.initialTime !== undefined && !isValidTime(options.initialTime, mode)) {
      issues.push({ code: 'invalid-time', path: 'initialTime', message: 'initialTime must be a valid time' });
    }
    if (options.viewport !== undefined) issues.push(...validateRange(options.viewport, mode, 'viewport'));
    const rows = options.rows ?? [];
    const keys = options.keys ?? [];
    issues.push(...validateRows(rows), ...validateKeys(keys, mode));
    const source = this.normalizeSource(options.source);
    if (source.kind === 'static' && issues.length === 0) {
      issues.push(...validateItems(source.items, new Set(rows.map((row) => row.id)), mode));
    }
    throwIfIssues(issues);

    this.liveExplicit = options.liveTime !== undefined;
    this.liveTime = options.liveTime ?? this.domain.end;
    this.initialTime = clamp(options.initialTime ?? this.domain.start, this.domain.start, this.domain.end);
    this.time = this.initialTime;
    this.loop = options.loop ?? false;
    this.followPlayback = options.followPlayback ?? true;
    this.reducedMotion = options.reducedMotion ?? false;
    this.viewport = fitViewport(options.viewport ?? this.domain, this.domain, this.minViewportDuration);
    this.rows = rows.slice();
    this.rowTree = buildRowTree(this.rows);
    this.expanded = new Set(Array.from(options.expanded ?? []).filter((id) => this.rowTree.nodes.has(id)));
    this.setKeyCollection(keys.slice());
    this.source = source;
    if (source.kind === 'static') {
      this.items = source.items.slice();
      this.coverage = this.domain;
    }
    this.prepareTime = options.prepareTime;
    this.scheduler = options.scheduler ?? createTimeoutScheduler();
  }

  // ---------------------------------------------------------------- observation

  /** Subscribes to state changes; compatible with `useSyncExternalStore`. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Returns an immutable snapshot, stable until the next change. */
  getSnapshot = (): TimelineSnapshot<RowMeta, ItemMeta, KeyMeta> => {
    if (!this.snapshot) this.snapshot = this.buildSnapshot();
    return this.snapshot;
  };

  on<K extends keyof TimelineEvents>(event: K, listener: Listener<TimelineEvents[K]>): () => void {
    const set = this.eventListeners[event] as Set<Listener<TimelineEvents[K]>>;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  /** Resolves once a valid batch covers `time` (an empty batch counts). */
  waitForData(time: number, signal?: AbortSignal): Promise<void> {
    if (this.coverage && rangeContainsTime(this.coverage, time)) return Promise.resolve();
    if (signal?.aborted) return Promise.reject(abortError());
    return new Promise<void>((resolve, reject) => {
      const waiter: CoverageWaiter = {
        time,
        resolve: () => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        },
        reject: (error) => {
          signal?.removeEventListener('abort', onAbort);
          reject(error);
        },
      };
      const onAbort = (): void => {
        this.coverageWaiters = this.coverageWaiters.filter((entry) => entry !== waiter);
        reject(abortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      this.coverageWaiters.push(waiter);
    });
  }

  // ---------------------------------------------------------------- lifecycle

  /**
   * Starts the initial preparation and the first data request. Idempotent.
   * Never called by the constructor so that creating an instance has no effect.
   */
  start(): void {
    this.batch(() => this.ensureStarted());
  }

  private ensureStarted(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.beginPreparation(this.time, 'initial');
    // The initial preparation may already have requested the range around its target.
    if (this.source.kind === 'windowed' && !this.activeLoad) this.startLoad('initial');
  }

  /**
   * Suspends or resumes progression, e.g. when the view is hidden or unmounted.
   * Time spent inactive is never caught up.
   */
  setActive(active: boolean): void {
    if (this.disposed || this.active === active) return;
    this.active = active;
    this.batch(() => {
      if (!active) {
        this.stopFrames();
        return;
      }
      this.lastFrameNow = this.scheduler.now();
      if (this.transport === 'live' && !this.prep && this.started && this.liveTime !== this.time) {
        this.beginPreparation(this.liveTime, 'live');
      }
      this.ensureFrame();
    });
  }

  isActive(): boolean {
    return this.active;
  }

  /** Replaces the pulse source, e.g. with the browser animation frame scheduler. */
  setScheduler(scheduler: FrameScheduler): void {
    if (this.scheduler === scheduler) return;
    this.stopFrames();
    this.scheduler = scheduler;
    this.lastFrameNow = scheduler.now();
    this.ensureFrame();
  }

  setPrepareTime(prepareTime: TimelineControllerOptions<RowMeta, ItemMeta, KeyMeta>['prepareTime']): void {
    this.prepareTime = prepareTime;
  }

  /** Cancels every request and stops progression. The instance ignores later commands. */
  dispose(): void {
    if (this.disposed) return;
    this.stopFrames();
    this.prep?.abort.abort();
    this.prep = null;
    this.activeLoad?.abort.abort();
    this.activeLoad = null;
    const waiters = this.coverageWaiters;
    this.coverageWaiters = [];
    for (const waiter of waiters) waiter.reject(abortError());
    this.disposed = true;
    this.listeners.clear();
    for (const set of Object.values(this.eventListeners)) set.clear();
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  // ---------------------------------------------------------------- transport

  play(): void {
    if (this.disposed) return;
    this.batch(() => {
      this.ensureStarted();
      this.error = null;
      if (this.rewind) {
        this.rewind = null;
        if (this.prep?.cause === 'rewind') this.abortPreparation();
      }
      // Play from live starts a replay from the current position, never from the start:
      // at the end, playback simply ends (or follows the normal loop rule).
      const fromLive = this.transport === 'live';
      this.transport = 'playing';
      if (fromLive) {
        if (!this.prep && this.time >= this.domain.end) {
          if (this.loop) this.beginPreparation(this.domain.start, 'loop');
          else this.transport = 'paused';
        }
        // A pending live destination keeps going; frames then play (or end) from there.
      } else if (!this.prep && this.time >= this.domain.end) this.beginPreparation(this.domain.start, 'play');
      // Play while the pending destination is the end: restart from the start once it is confirmed.
      else if (this.prep && this.prep.cause !== 'play' && this.prep.target >= this.domain.end) this.restartOnConfirm = this.prep;
      this.lastFrameNow = this.scheduler.now();
      this.ensureFrame();
      this.changed();
    });
  }

  pause(): void {
    if (this.disposed) return;
    this.batch(() => {
      this.transport = 'paused';
      this.rewind = null;
      this.stopFrames();
      this.changed();
    });
  }

  togglePlay(): void {
    if (this.transport === 'playing' && !this.rewind) this.pause();
    else this.play();
  }

  stop(): void {
    if (this.disposed) return;
    this.batch(() => {
      this.ensureStarted();
      this.transport = 'paused';
      this.rewind = null;
      this.stopFrames();
      this.beginPreparation(this.domain.start, 'stop');
    });
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) {
      throw new TimelineValidationError([{ code: 'invalid-speed', path: 'speed', message: 'Speed must be a positive finite number' }]);
    }
    if (this.disposed || speed === this.speed) return;
    this.batch(() => {
      this.speed = speed;
      this.changed();
    });
  }

  setLoop(loop: boolean): void {
    if (this.disposed || loop === this.loop) return;
    this.batch(() => {
      this.loop = loop;
      if (!loop && this.prep?.cause === 'loop') {
        this.abortPreparation();
        this.transport = 'paused';
        this.stopFrames();
      }
      this.changed();
    });
  }

  setFollowPlayback(follow: boolean): void {
    if (this.disposed || follow === this.followPlayback) return;
    this.batch(() => {
      this.followPlayback = follow;
      this.changed();
    });
  }

  setReducedMotion(reduced: boolean): void {
    if (this.disposed || reduced === this.reducedMotion) return;
    this.batch(() => {
      this.reducedMotion = reduced;
      this.changed();
    });
  }

  setRewindDuration(duration: number): void {
    if (!Number.isFinite(duration) || duration < 0) {
      throw new TimelineValidationError([
        { code: 'invalid-option', path: 'rewindDuration', message: 'rewindDuration must be a non-negative finite number' },
      ]);
    }
    this.rewindDuration = duration;
  }

  // ---------------------------------------------------------------- navigation

  /** Immediate jump, bounded to the domain. Keeps the playback intention, leaves live mode. */
  seek(time: number): void {
    this.assertTime(time, 'time');
    this.navigate(clamp(time, this.domain.start, this.domain.end), 'seek');
  }

  /** Moves to the next distinct key instant. Returns `false` when there is none. */
  nextKey(): boolean {
    const target = nextKeyInstant(this.keyInstantsCache, this.navigationReference());
    if (target === null || this.disposed) return false;
    this.navigate(target, 'key');
    return true;
  }

  /** Moves to the previous distinct key instant. Returns `false` when there is none. */
  previousKey(): boolean {
    const target = previousKeyInstant(this.keyInstantsCache, this.navigationReference());
    if (target === null || this.disposed) return false;
    this.navigate(target, 'key');
    return true;
  }

  /** Jumps to a given key by id. Returns `false` if it is unknown. */
  goToKey(id: string): boolean {
    const key = this.keys.find((entry) => entry.id === id);
    if (!key || this.disposed || !rangeContainsTime(this.domain, key.at)) return false;
    this.navigate(key.at, 'key');
    return true;
  }

  /**
   * Animated move towards a past target. With reduced motion, or for a target
   * that is not in the past, it becomes an immediate jump.
   */
  rewindTo(time: number): void {
    this.assertTime(time, 'time');
    if (this.disposed) return;
    const target = clamp(time, this.domain.start, this.domain.end);
    if (this.reducedMotion || this.rewindDuration === 0 || target >= this.navigationReference()) {
      this.navigate(target, 'rewind');
      return;
    }
    this.batch(() => {
      this.ensureStarted();
      if (this.transport === 'live') this.transport = 'paused';
      this.abortPreparation();
      this.error = null;
      this.rewind = { from: this.time, target, duration: this.rewindDuration, elapsed: 0 };
      this.lastFrameNow = this.scheduler.now();
      this.ensureFrame();
      this.changed();
    });
  }

  /** Follows the live frontier supplied by the application. */
  goLive(): void {
    if (this.disposed) return;
    this.batch(() => {
      this.ensureStarted();
      this.transport = 'live';
      this.rewind = null;
      this.error = null;
      this.stopFrames();
      if (this.prep?.cause === 'live') {
        this.changed();
        return;
      }
      this.abortPreparation();
      if (this.liveTime !== this.time) this.beginPreparation(this.liveTime, 'live');
      else this.followTarget(this.liveTime, 'live');
      this.changed();
    });
  }

  /** Retries the target of a failed preparation. */
  retry(): boolean {
    const failed = this.error;
    if (!failed || this.disposed) return false;
    this.batch(() => {
      this.error = null;
      this.beginPreparation(failed.target, failed.cause);
    });
    return true;
  }

  // ---------------------------------------------------------------- live frontier and domain

  /** Moves the live frontier forward. Earlier values are ignored: the frontier never goes back. */
  setLiveTime(time: number): void {
    this.assertTime(time, 'liveTime');
    if (time > this.domain.end) {
      throw new TimelineValidationError([
        { code: 'invalid-range', path: 'liveTime', message: 'liveTime must not exceed the domain end; extend the domain first' },
      ]);
    }
    if (this.disposed) return;
    this.liveExplicit = true;
    if (time <= this.liveTime) return;
    this.batch(() => {
      this.liveTime = time;
      this.chaseLive();
      this.changed();
    });
  }

  /** Extends the end of the domain. Reducing it requires a new instance. */
  extendDomain(end: number, liveTime?: number): void {
    this.assertTime(end, 'domain.end');
    if (end < this.domain.end) {
      throw new TimelineValidationError([
        { code: 'invalid-domain', path: 'domain', message: 'The domain can only be extended; create a new instance to reduce it' },
      ]);
    }
    if (liveTime !== undefined) {
      this.assertTime(liveTime, 'liveTime');
      if (liveTime > end) {
        throw new TimelineValidationError([{ code: 'invalid-range', path: 'liveTime', message: 'liveTime must not exceed the domain end' }]);
      }
    }
    if (this.disposed) return;
    this.batch(() => {
      const previousEnd = this.domain.end;
      if (end > previousEnd) {
        this.domain = { start: this.domain.start, end };
        // The minimum viewport duration may have been capped by the former domain length.
        this.viewport = fitViewport(this.viewport, this.domain, this.minViewportDuration);
        this.keyInstantsCache = this.keyInstantsInDomain(this.keys);
        if (this.source.kind === 'static') this.setCoverage(this.domain);
        if (this.prep?.cause === 'loop' && this.transport === 'playing') {
          // The old end is no longer the end: keep playing towards the new one.
          this.abortPreparation();
          this.lastFrameNow = this.scheduler.now();
        }
      }
      if (liveTime !== undefined) {
        this.liveExplicit = true;
        if (liveTime > this.liveTime) this.liveTime = liveTime;
      } else if (!this.liveExplicit && end > this.liveTime) {
        this.liveTime = end;
      }
      this.chaseLive();
      this.ensureFrame();
      this.changed();
    });
  }

  // ---------------------------------------------------------------- viewport

  setViewport(range: TimeRange, options: ViewportOptions = {}): void {
    throwIfIssues(validateRange(range, this.mode, 'viewport'));
    if (this.disposed) return;
    this.batch(() => {
      const next = fitViewport(range, this.domain, this.minViewportDuration);
      if (options.origin !== 'zoom' && this.transport === 'live') this.transport = 'paused';
      if (this.transport === 'live') {
        this.viewport = anchorViewport(next, this.liveTarget(), 0.9, this.domain);
      } else {
        this.viewport = next;
      }
      this.queueNavigationLoad();
      this.changed();
    });
  }

  /** Zooms by `factor` (> 1 zooms in) around `anchor`, the cursor or the live target. */
  zoomBy(factor: number, anchor?: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new TimelineValidationError([{ code: 'invalid-option', path: 'factor', message: 'Zoom factor must be positive' }]);
    }
    const viewport = this.viewport;
    let center = anchor;
    if (center === undefined || !Number.isFinite(center)) {
      center = rangeContainsTime(viewport, this.time) ? this.time : (viewport.start + viewport.end) / 2;
    }
    const start = center - (center - viewport.start) / factor;
    const end = center + (viewport.end - center) / factor;
    const duration = clamp(end - start, this.minViewportDuration, rangeDuration(this.domain));
    const ratio = rangeDuration(viewport) > 0 ? (center - viewport.start) / rangeDuration(viewport) : 0.5;
    const nextStart = center - duration * ratio;
    this.setViewport({ start: nextStart, end: nextStart + duration }, { origin: 'zoom' });
  }

  panBy(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.setViewport({ start: this.viewport.start + delta, end: this.viewport.end + delta });
  }

  // ---------------------------------------------------------------- rows, keys, items

  setRows(rows: readonly TimelineRow<RowMeta>[]): void {
    throwIfIssues(validateRows(rows));
    if (this.disposed) return;
    this.batch(() => this.applyRows(rows.slice()));
  }

  setKeys(keys: readonly TimelineKey<KeyMeta>[]): void {
    throwIfIssues(validateKeys(keys, this.mode));
    if (this.disposed) return;
    this.batch(() => {
      this.setKeyCollection(keys.slice());
      this.changed();
    });
  }

  /** Replaces the items of a static source. */
  setItems(items: readonly TimelineItem<ItemMeta>[]): void {
    this.assertStatic();
    throwIfIssues(validateItems(items, this.rowTree.nodes, this.mode));
    if (this.disposed) return;
    this.batch(() => {
      this.items = items.slice();
      this.source = { kind: 'static', items: this.items };
      this.changed();
    });
  }

  /**
   * Adds, modifies and removes rows, keys and items by id. The whole change is
   * validated first and applied atomically, or rejected without any effect.
   */
  update(changes: {
    rows?: CollectionChanges<TimelineRow<RowMeta>>;
    keys?: CollectionChanges<TimelineKey<KeyMeta>>;
    items?: CollectionChanges<TimelineItem<ItemMeta>>;
  }): void {
    if (changes.items) this.assertStatic();
    const rows = changes.rows ? applyChanges(this.rows, changes.rows.upsert, changes.rows.remove) : null;
    const keys = changes.keys ? applyChanges(this.keys, changes.keys.upsert, changes.keys.remove) : null;
    const issues: ValidationIssue[] = [];
    if (rows) issues.push(...validateRows(rows));
    if (keys) issues.push(...validateKeys(keys, this.mode));
    let items: TimelineItem<ItemMeta>[] | null = null;
    let commitIndex: (() => void) | null = null;
    if (changes.items && issues.length === 0) {
      if (rows) {
        // Rows change too: existing items may lose their row, so validate everything.
        const rowIds = new Set(rows.map((row) => row.id));
        const base = this.items.filter((item) => rowIds.has(item.rowId));
        items = applyChanges(base, changes.items.upsert, changes.items.remove);
        issues.push(...validateItems(items, rowIds, this.mode));
      } else {
        const plan = this.planItemChanges(changes.items);
        if (plan.issues.length) issues.push(...plan.issues);
        else ({ items, commit: commitIndex } = plan);
      }
    }
    throwIfIssues(issues);
    if (this.disposed) return;
    this.batch(() => {
      if (rows) this.applyRows(rows);
      if (keys) this.setKeyCollection(keys);
      if (items) {
        this.items = items;
        this.source = { kind: 'static', items };
        commitIndex?.();
      }
      this.changed();
    });
  }

  /**
   * Incremental counterpart of `applyChanges` + `validateItems` for a static
   * collection whose rows do not change. The current items are valid (every
   * assignment of `items` is validated), so only the upserted entries are
   * checked, in the order the full validation would visit them, which yields
   * the same issues. Ids are located through `itemIndex`; nothing is mutated
   * until `commit`, so a rejected change has no effect. The new array is
   * still an O(n) copy (snapshots expose immutable arrays); it is a single
   * `concat` plus `splice` per removal and now dominates the cost of an
   * update (~0.1 ms at 20 000 items), but it no longer hashes every id.
   */
  private planItemChanges(changes: CollectionChanges<TimelineItem<ItemMeta>>):
    | { issues: ValidationIssue[]; items: null; commit: null }
    | { issues: []; items: TimelineItem<ItemMeta>[]; commit: () => void } {
    const current = this.items;
    const index = this.indexItems(current);
    const updates = new Map<string, TimelineItem<ItemMeta>>();
    for (const entry of changes.upsert ?? []) updates.set(entry.id, entry);
    const replaced: number[] = [];
    const added: TimelineItem<ItemMeta>[] = [];
    for (const [id, entry] of updates) {
      const at = index.position(id);
      if (at === undefined) added.push(entry);
      else replaced.push(at);
    }
    replaced.sort((a, b) => a - b);
    const checked = replaced.map((at) => updates.get(current[at]!.id)!).concat(added);
    const issues = validateItems(checked, this.rowTree.nodes, this.mode);
    if (issues.length) return { issues, items: null, commit: null };

    const removedAt: number[] = [];
    const removedIds = new Set<string>();
    for (const id of changes.remove ?? []) {
      if (updates.has(id) || removedIds.has(id)) continue;
      const at = index.position(id);
      if (at === undefined) continue;
      removedIds.add(id);
      removedAt.push(at);
    }

    // One copy (concat) with replacements patched in place, then removals.
    // `splice` (a memmove) beats an element-by-element copy for a few removals.
    const next = current.concat(added);
    for (const at of replaced) next[at] = updates.get(current[at]!.id)!;
    if (removedAt.length) {
      removedAt.sort((a, b) => a - b);
      if (removedAt.length <= 16) {
        for (let k = removedAt.length - 1; k >= 0; k--) next.splice(removedAt[k]!, 1);
      } else {
        let write = removedAt[0]!;
        let k = 0;
        for (let read = write; read < next.length; read++) {
          if (k < removedAt.length && removedAt[k] === read) k++;
          else next[write++] = next[read]!;
        }
        next.length = write;
      }
    }

    const commit = () => {
      index.commit(removedIds, added, next);
      this.itemIndexFor = next;
    };
    return { issues: [], items: next, commit };
  }

  private indexItems(items: readonly TimelineItem<ItemMeta>[]): ItemIndex {
    if (this.itemIndex && this.itemIndexFor === items) return this.itemIndex;
    const index = new ItemIndex(items);
    this.itemIndex = index;
    this.itemIndexFor = items;
    return index;
  }

  /** Replaces the item source. A new provider starts a new request generation. */
  setSource(source: ItemSource<ItemMeta> | readonly TimelineItem<ItemMeta>[]): void {
    const next = this.normalizeSource(source);
    if (next.kind === 'static') throwIfIssues(validateItems(next.items, this.rowTree.nodes, this.mode));
    if (this.disposed) return;
    this.batch(() => {
      this.generation++;
      this.activeLoad?.abort.abort();
      this.activeLoad = null;
      this.nextLoadWanted = false;
      this.refreshPending = false;
      this.dataError = null;
      this.source = next;
      if (next.kind === 'static') {
        this.items = next.items.slice();
        this.setCoverage(this.domain);
      } else {
        this.items = [];
        this.coverage = null;
        if (this.started) this.startLoad('source');
      }
      this.changed();
    });
  }

  /** Asks the windowed source for fresh data on the current range. */
  refresh(): void {
    if (this.disposed || this.source.kind !== 'windowed' || !this.started) return;
    this.batch(() => {
      if (this.activeLoad) this.refreshPending = true;
      else this.startLoad('refresh');
      this.changed();
    });
  }

  // ---------------------------------------------------------------- expansion

  expand(id: string): void {
    this.setRowExpanded(id, true);
  }

  collapse(id: string): void {
    this.setRowExpanded(id, false);
  }

  toggle(id: string): void {
    this.setRowExpanded(id, !this.expanded.has(id));
  }

  setExpanded(ids: Iterable<string>): void {
    if (this.disposed) return;
    this.batch(() => {
      this.expanded = new Set(Array.from(ids).filter((id) => this.rowTree.nodes.has(id)));
      this.visibleRowsCache = null;
      this.changed();
    });
  }

  expandAll(): void {
    this.setExpanded(Array.from(this.rowTree.nodes.values()).filter((node) => node.childIds.length > 0).map((node) => node.row.id));
  }

  collapseAll(): void {
    this.setExpanded([]);
  }

  // ================================================================ internals

  private normalizeSource(
    source: ItemSource<ItemMeta> | readonly TimelineItem<ItemMeta>[] | undefined,
  ): ItemSource<ItemMeta> {
    if (source === undefined) return { kind: 'static', items: [] };
    if (Array.isArray(source)) return { kind: 'static', items: source as readonly TimelineItem<ItemMeta>[] };
    const typed = source as ItemSource<ItemMeta>;
    if (typed.kind === 'static' || (typed.kind === 'windowed' && typeof typed.load === 'function')) return typed;
    throw new TimelineValidationError([{ code: 'invalid-option', path: 'source', message: 'Unknown item source' }]);
  }

  private assertStatic(): void {
    if (this.source.kind !== 'static') {
      throw new TimelineValidationError([
        {
          code: 'source-mismatch',
          path: 'items',
          message: 'Items of a windowed source are changed in the application store, then refreshed',
        },
      ]);
    }
  }

  private assertTime(time: number, path: string): void {
    if (!isValidTime(time, this.mode)) {
      throw new TimelineValidationError([{ code: 'invalid-time', path, message: `${path} must be a valid time` }]);
    }
  }

  private setRowExpanded(id: string, expanded: boolean): void {
    if (this.disposed || !this.rowTree.nodes.has(id) || this.expanded.has(id) === expanded) return;
    this.batch(() => {
      const next = new Set(this.expanded);
      if (expanded) next.add(id);
      else next.delete(id);
      this.expanded = next;
      this.visibleRowsCache = null;
      this.changed();
    });
  }

  private applyRows(rows: TimelineRow<RowMeta>[]): void {
    this.rows = rows;
    this.rowTree = buildRowTree(rows);
    const tree = this.rowTree;
    this.expanded = new Set(Array.from(this.expanded).filter((id) => tree.nodes.has(id)));
    this.visibleRowsCache = null;
    if (this.items.some((item) => !tree.nodes.has(item.rowId))) {
      this.items = this.items.filter((item) => tree.nodes.has(item.rowId));
      if (this.source.kind === 'static') this.source = { kind: 'static', items: this.items };
    }
    this.changed();
  }

  private setKeyCollection(keys: TimelineKey<KeyMeta>[]): void {
    this.keys = keys;
    this.keyInstantsCache = this.keyInstantsInDomain(keys);
  }

  /** Keys outside the domain are not destinations. */
  private keyInstantsInDomain(keys: readonly TimelineKey<KeyMeta>[]): number[] {
    const domain = this.domain;
    return keyInstants(keys.filter((key) => key.at >= domain.start && key.at <= domain.end));
  }

  private navigationReference(): number {
    return this.rewind?.target ?? this.prep?.target ?? this.time;
  }

  private navigate(target: number, cause: TimeCause): void {
    if (this.disposed) return;
    this.batch(() => {
      this.ensureStarted();
      if (this.transport === 'live') this.transport = 'paused';
      this.rewind = null;
      this.beginPreparation(target, cause);
    });
  }

  private liveTarget(): number {
    return this.prep?.cause === 'live' ? this.prep.target : this.transport === 'live' ? this.liveTime : this.time;
  }

  private chaseLive(): void {
    if (this.transport !== 'live' || !this.started) return;
    // A preparation in progress is not cancelled: the next confirmation chases the latest frontier.
    if (this.prep) return;
    if (this.liveTime !== this.time) this.beginPreparation(this.liveTime, 'live');
  }

  // ---------------------------------------------------------------- preparation

  private abortPreparation(): void {
    const prep = this.prep;
    if (!prep) return;
    this.prep = null;
    prep.abort.abort();
    this.changed();
  }

  private beginPreparation(target: number, cause: TimeCause): void {
    this.abortPreparation();
    this.stopFrames();
    const prep: Preparation = {
      id: ++this.prepSeq,
      target,
      previous: this.time,
      cause,
      abort: new AbortController(),
    };
    this.prep = prep;
    if (cause !== 'play' && cause !== 'rewind') this.error = null;
    this.followTarget(target, cause);
    this.changed();
    const request: TimeRequest = {
      id: prep.id,
      previous: prep.previous,
      target,
      cause,
      signal: prep.abort.signal,
      isCurrent: () => this.prep === prep && !prep.abort.signal.aborted,
    };
    let result: void | PromiseLike<unknown>;
    try {
      result = this.prepareTime?.(request);
    } catch (error) {
      this.failPreparation(prep, error);
      return;
    }
    if (isThenable(result)) {
      result.then(
        () => this.batch(() => this.confirmPreparation(prep)),
        (error: unknown) => this.batch(() => this.failPreparation(prep, error)),
      );
    } else {
      this.confirmPreparation(prep);
    }
  }

  private confirmPreparation(prep: Preparation): void {
    if (this.prep !== prep || this.disposed) return;
    this.prep = null;
    const previous = this.time;
    this.time = prep.target;
    this.lastCause = prep.cause;
    this.initialized = true;
    // A confirmation received during the frame that requested it did not wait:
    // keep the frame time as reference so rendering work is not lost from playback.
    this.lastFrameNow = this.frameNow ?? this.scheduler.now();
    this.changed();
    this.emit('time', { time: this.time, previous, cause: prep.cause, requestId: prep.id });

    if (this.prep) return; // a listener issued a new command
    const restart = this.restartOnConfirm === prep;
    this.restartOnConfirm = null;
    if (restart && this.transport === 'playing' && this.time >= this.domain.end) {
      this.beginPreparation(this.domain.start, 'play');
    } else if (prep.cause === 'play' && this.time >= this.domain.end && this.transport === 'playing') {
      if (this.loop) this.beginPreparation(this.domain.start, 'loop');
      else this.transport = 'paused';
    } else if (prep.cause === 'rewind' && this.rewind && this.time === this.rewind.target) {
      this.rewind = null;
    } else if (prep.cause === 'live') {
      this.chaseLive();
    }
    this.ensureFrame();
  }

  private failPreparation(prep: Preparation, error: unknown): void {
    if (this.prep !== prep || this.disposed) return;
    this.prep = null;
    if (prep.abort.signal.aborted && isAbortError(error)) return;
    this.error = { target: prep.target, cause: prep.cause, error };
    this.transport = 'paused';
    this.rewind = null;
    this.stopFrames();
    this.changed();
    this.emit('error', this.error);
  }

  // ---------------------------------------------------------------- frames

  private wantsFrames(): boolean {
    return (
      !this.disposed &&
      this.started &&
      this.active &&
      this.prep === null &&
      (this.rewind !== null || this.transport === 'playing')
    );
  }

  private ensureFrame(): void {
    if (this.cancelFrame || !this.wantsFrames()) return;
    this.cancelFrame = this.scheduler.requestFrame(this.onFrame);
  }

  private stopFrames(): void {
    this.cancelFrame?.();
    this.cancelFrame = null;
  }

  private onFrame = (now: number): void => {
    this.cancelFrame = null;
    if (!this.wantsFrames()) return;
    const last = this.lastFrameNow;
    this.lastFrameNow = now;
    const delta = last === null ? 0 : clamp(now - last, 0, this.maxFrameDelta);
    if (delta === 0) {
      this.ensureFrame();
      return;
    }
    this.frameNow = now;
    try {
      this.batch(() => this.advanceFrame(delta));
    } finally {
      this.frameNow = null;
    }
    this.ensureFrame();
  };

  private advanceFrame(delta: number): void {
    {
      const rewind = this.rewind;
      if (rewind) {
        rewind.elapsed += delta;
        const progress = rewind.duration === 0 ? 1 : Math.min(1, rewind.elapsed / rewind.duration);
        const position =
          progress >= 1 ? rewind.target : rewind.from + (rewind.target - rewind.from) * easeOutCubic(progress);
        this.beginPreparation(position, 'rewind');
      } else {
        const target = Math.min(this.domain.end, this.time + delta * this.speed);
        if (target > this.time) this.beginPreparation(target, 'play');
        else if (this.time >= this.domain.end) {
          if (this.loop) this.beginPreparation(this.domain.start, 'loop');
          else {
            this.transport = 'paused';
            this.changed();
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- viewport following

  private followTarget(target: number, cause: TimeCause): void {
    let next: TimeRange | null = null;
    if (this.transport === 'live' && (cause === 'live' || cause === 'initial')) {
      next = anchorViewport(this.viewport, target, 0.9, this.domain);
    } else if (this.followPlayback && !rangeContainsTime(this.viewport, target)) {
      const ratio = cause === 'play' || cause === 'loop' ? 0.1 : cause === 'rewind' ? 0.9 : 0.5;
      next = anchorViewport(this.viewport, target, ratio, this.domain);
    }
    if (next && (next.start !== this.viewport.start || next.end !== this.viewport.end)) {
      this.viewport = next;
      this.requestAutomaticLoad();
      this.changed();
    }
  }

  // ---------------------------------------------------------------- window loading

  private desiredRange(): TimeRange {
    return expandRange(this.viewport, this.windowMargin, this.domain);
  }

  private viewportCovered(range: TimeRange | null): boolean {
    return range !== null && rangeContains(range, this.viewport);
  }

  private queueNavigationLoad(): void {
    if (this.source.kind !== 'windowed' || !this.started || this.navigationQueued) return;
    this.navigationQueued = true;
    queueMicrotask(() => {
      this.navigationQueued = false;
      if (this.disposed || this.source.kind !== 'windowed') return;
      if (this.viewportCovered(this.coverage)) {
        // The visible range is already loaded: a request for another range is now obsolete.
        if (this.activeLoad && !this.viewportCovered(this.activeLoad.range)) this.batch(() => this.dropActiveLoad());
        return;
      }
      if (this.activeLoad?.generation === this.generation && this.viewportCovered(this.activeLoad.range)) return;
      this.batch(() => {
        this.generation++;
        this.activeLoad?.abort.abort();
        this.activeLoad = null;
        this.nextLoadWanted = false;
        this.refreshPending = false;
        this.startLoad('navigation');
      });
    });
  }

  private requestAutomaticLoad(): void {
    if (this.source.kind !== 'windowed' || !this.started) return;
    if (this.viewportCovered(this.coverage)) {
      // Returning to a loaded range: the active request for another range would replace it.
      if (this.activeLoad && !this.viewportCovered(this.activeLoad.range) && !this.refreshPending) this.dropActiveLoad();
      return;
    }
    if (this.activeLoad) {
      // Keep the active request; remember a single next range (the latest viewport).
      if (!this.viewportCovered(this.activeLoad.range)) this.nextLoadWanted = true;
      return;
    }
    this.startLoad('follow');
  }

  private dropActiveLoad(): void {
    this.generation++;
    this.activeLoad?.abort.abort();
    this.activeLoad = null;
    this.nextLoadWanted = false;
    this.changed();
  }

  private startLoad(reason: WindowReason): void {
    const source = this.source;
    if (source.kind !== 'windowed') return;
    const load: ActiveLoad = {
      id: ++this.loadSeq,
      generation: this.generation,
      range: this.desiredRange(),
      abort: new AbortController(),
      rowsAtRequest: this.rowTree.nodes,
    };
    this.activeLoad = load;
    this.nextLoadWanted = false;
    if (reason === 'refresh') this.refreshPending = false;
    this.changed();
    const request: WindowRequest = {
      id: load.id,
      generation: load.generation,
      visible: this.viewport,
      range: load.range,
      reason,
      signal: load.abort.signal,
      isCurrent: () => this.activeLoad === load && !load.abort.signal.aborted,
    };
    let result: ItemBatch<ItemMeta> | PromiseLike<ItemBatch<ItemMeta>>;
    try {
      result = source.load(request);
    } catch (error) {
      this.finishLoad(load, null, error);
      return;
    }
    if (isThenable(result)) {
      result.then(
        (batch) => this.batch(() => this.finishLoad(load, batch, null)),
        (error: unknown) => this.batch(() => this.finishLoad(load, null, error ?? new Error('Window load failed'))),
      );
    } else {
      this.finishLoad(load, result, null);
    }
  }

  private finishLoad(load: ActiveLoad, batch: ItemBatch<ItemMeta> | null, error: unknown): void {
    if (this.activeLoad !== load || this.disposed) return;
    this.activeLoad = null;
    if (error !== null || !batch) {
      if (!(load.abort.signal.aborted && isAbortError(error))) {
        this.dataError = error ?? new Error('Window load returned no batch');
        this.emit('dataError', { error: this.dataError });
      }
    } else {
      // Rows removed while the load was in flight: their items are dropped silently.
      // Only a row unknown both at request time and now makes the batch fail.
      const current = this.rowTree.nodes;
      const known = { has: (id: string) => current.has(id) || load.rowsAtRequest.has(id) };
      const issues = [
        ...validateRange(batch.range, this.mode, 'batch.range'),
        ...(Array.isArray(batch.items) ? validateItems(batch.items, known as ReadonlySet<string>, this.mode) : [
          { code: 'invalid-option' as const, path: 'batch.items', message: 'Batch items must be an array' },
        ]),
      ];
      if (issues.length) {
        this.dataError = new TimelineValidationError(issues);
        this.emit('dataError', { error: this.dataError });
      } else {
        this.items = batch.items.filter((item) => current.has(item.rowId));
        this.dataError = null;
        this.setCoverage({ start: batch.range.start, end: batch.range.end });
      }
    }
    this.changed();
    if (this.refreshPending) this.startLoad('refresh');
    else if ((this.nextLoadWanted || !this.viewportCovered(load.range)) && !this.viewportCovered(this.coverage)) {
      // The viewport moved away from the range this load was made for.
      this.startLoad('follow');
    } else this.nextLoadWanted = false;
  }

  private setCoverage(range: TimeRange): void {
    this.coverage = range;
    if (!this.coverageWaiters.length) return;
    const remaining: CoverageWaiter[] = [];
    const ready: CoverageWaiter[] = [];
    for (const waiter of this.coverageWaiters) {
      (rangeContainsTime(range, waiter.time) ? ready : remaining).push(waiter);
    }
    this.coverageWaiters = remaining;
    for (const waiter of ready) waiter.resolve();
  }

  // ---------------------------------------------------------------- notification

  private changed(): void {
    this.dirty = true;
    this.snapshot = null;
  }

  private batch(fn: () => void): void {
    this.batchDepth++;
    try {
      fn();
    } finally {
      this.batchDepth--;
      if (this.batchDepth === 0 && this.dirty) {
        this.dirty = false;
        for (const listener of Array.from(this.listeners)) listener();
      }
    }
  }

  private emit<K extends keyof TimelineEvents>(event: K, value: TimelineEvents[K]): void {
    for (const listener of Array.from(this.eventListeners[event]) as Listener<TimelineEvents[K]>[]) {
      listener(value);
    }
  }

  private buildSnapshot(): TimelineSnapshot<RowMeta, ItemMeta, KeyMeta> {
    if (!this.visibleRowsCache) this.visibleRowsCache = flattenVisibleRows(this.rowTree, this.expanded);
    const reference = this.navigationReference();
    const prep = this.prep;
    const status: TimelineStatus = !this.initialized
      ? this.error && !prep
        ? 'error'
        : 'initializing'
      : prep
        ? 'preparing'
        : this.error
          ? 'error'
          : 'ready';
    return {
      mode: this.mode,
      domain: this.domain,
      liveTime: this.liveTime,
      time: this.time,
      status,
      transport: this.transport,
      pending: prep ? { id: prep.id, target: prep.target, cause: prep.cause } : null,
      rewinding: this.rewind !== null,
      lastCause: this.lastCause,
      error: this.error,
      speed: this.speed,
      loop: this.loop,
      followPlayback: this.followPlayback,
      reducedMotion: this.reducedMotion,
      viewport: this.viewport,
      minViewportDuration: this.minViewportDuration,
      rows: this.rows,
      rowTree: this.rowTree,
      visibleRows: this.visibleRowsCache,
      expanded: this.expanded,
      keys: this.keys,
      keyInstants: this.keyInstantsCache,
      canPreviousKey: previousKeyInstant(this.keyInstantsCache, reference) !== null,
      canNextKey: nextKeyInstant(this.keyInstantsCache, reference) !== null,
      items: this.items,
      data: { coverage: this.coverage, loading: this.activeLoad !== null, error: this.dataError },
      sourceKind: this.source.kind,
    };
  }
}

export function createTimelineController<RowMeta = unknown, ItemMeta = unknown, KeyMeta = unknown>(
  options: TimelineControllerOptions<RowMeta, ItemMeta, KeyMeta>,
): TimelineController<RowMeta, ItemMeta, KeyMeta> {
  return new TimelineController(options);
}

/** First index in the sorted `values` whose value is >= `target`. */
function lowerBound(values: readonly number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Locates items by id in O(log d) without re-indexing on every removal.
 *
 * Each item gets a slot, increasing in array order: replacements keep their
 * slot, appended items take fresh slots, removed slots are kept in the sorted
 * `dead` list. An item's position is its slot minus the number of dead slots
 * before it. When dead slots pile up the index is compacted (O(n), amortized
 * over at least n/8 removals).
 */
class ItemIndex {
  private readonly slots = new Map<string, number>();
  private dead: number[] = [];
  private nextSlot = 0;

  constructor(items: readonly { readonly id: string }[]) {
    this.reset(items);
  }

  position(id: string): number | undefined {
    const slot = this.slots.get(id);
    if (slot === undefined) return undefined;
    return this.dead.length === 0 ? slot : slot - lowerBound(this.dead, slot);
  }

  /** Records a change already validated and applied to produce `next`. */
  commit(removed: Iterable<string>, added: readonly { readonly id: string }[], next: readonly { readonly id: string }[]): void {
    for (const id of removed) {
      const slot = this.slots.get(id)!;
      this.slots.delete(id);
      this.dead.splice(lowerBound(this.dead, slot), 0, slot);
    }
    for (const entry of added) this.slots.set(entry.id, this.nextSlot++);
    if (this.dead.length > Math.max(64, next.length >>> 3)) this.reset(next);
  }

  private reset(items: readonly { readonly id: string }[]): void {
    this.slots.clear();
    for (let i = 0; i < items.length; i++) this.slots.set(items[i]!.id, i);
    this.dead = [];
    this.nextSlot = items.length;
  }
}
