/**
 * Public data model. All times are numbers in milliseconds:
 * Unix timestamps in `calendar` mode, offsets from the chosen origin in `relative` mode.
 */

export type TimeMode = 'calendar' | 'relative';

/** Inclusive range of time. */
export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

export interface TimelineRow<RowMeta = unknown> {
  readonly id: string;
  readonly label: string;
  readonly parentId?: string | undefined;
  readonly meta?: RowMeta;
}

/** Marks an item supplied by the application as a group of several sources. */
export interface ItemGroup {
  /** Strictly positive number of grouped sources. */
  readonly count: number;
  /** Optional reference to external data; the library never resolves it. */
  readonly ref?: unknown;
}

interface ItemBase<ItemMeta> {
  readonly id: string;
  readonly rowId: string;
  readonly label?: string | undefined;
  readonly meta?: ItemMeta;
  readonly group?: ItemGroup | undefined;
}

export interface PointItem<ItemMeta = unknown> extends ItemBase<ItemMeta> {
  readonly at: number;
}

/** Active from `start` included to `end` excluded. */
export interface SpanItem<ItemMeta = unknown> extends ItemBase<ItemMeta> {
  readonly start: number;
  readonly end: number;
}

export type TimelineItem<ItemMeta = unknown> = PointItem<ItemMeta> | SpanItem<ItemMeta>;

export interface TimelineKey<KeyMeta = unknown> {
  readonly id: string;
  readonly at: number;
  readonly label?: string | undefined;
  readonly meta?: KeyMeta;
}

/** A batch of items covering a range. An empty batch means "no data" for that range. */
export interface ItemBatch<ItemMeta = unknown> {
  readonly range: TimeRange;
  readonly items: readonly TimelineItem<ItemMeta>[];
}

export function isSpan<M>(item: TimelineItem<M>): item is SpanItem<M> {
  return 'start' in item;
}

export function isPoint<M>(item: TimelineItem<M>): item is PointItem<M> {
  return 'at' in item;
}

export function itemStart(item: TimelineItem<unknown>): number {
  return isSpan(item) ? item.start : item.at;
}

export function itemEnd(item: TimelineItem<unknown>): number {
  return isSpan(item) ? item.end : item.at;
}

/** Changes applied atomically by id. */
export interface CollectionChanges<T> {
  readonly upsert?: readonly T[];
  readonly remove?: readonly string[];
}
