import type { TimelineItem } from './model.js';
import { itemEnd, itemStart } from './model.js';

export interface LaneLayout {
  /** Lane index of each item id. */
  readonly lanes: ReadonlyMap<string, number>;
  /** Number of lanes needed (at least 1). */
  readonly laneCount: number;
}

export interface AssignLanesOptions {
  /**
   * The items are already ordered by start time (ties in any order), e.g. by
   * `start`, `end` then `id`. The full sort is then skipped: only runs of equal
   * starts are reordered, so the result is the same as without the option.
   * Input that turns out not to be ordered by start is sorted as usual.
   */
  readonly presorted?: boolean;
}

interface LaneEntry {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

function compareEntries(a: LaneEntry, b: LaneEntry): number {
  return a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Orders entries already sorted by start: only runs of equal starts are sorted. */
function sortPresorted(entries: LaneEntry[]): boolean {
  let runStart = 0;
  for (let i = 1; i <= entries.length; i++) {
    if (i < entries.length) {
      const delta = entries[i]!.start - entries[i - 1]!.start;
      if (!(delta >= 0)) return false;
      if (delta === 0) continue;
    }
    if (i - runStart > 1) {
      const run = entries.slice(runStart, i).sort(compareEntries);
      for (let k = 0; k < run.length; k++) entries[runStart + k] = run[k]!;
    }
    runStart = i;
  }
  return true;
}

/**
 * Places overlapping items in deterministic lanes. Items are sorted by start,
 * end then id, so the result does not depend on the input order.
 * `minExtent` is the minimal footprint of an item in time units (e.g. a marker's
 * width converted at the current scale), so close points do not overlap visually.
 */
export function assignLanes(items: readonly TimelineItem<unknown>[], minExtent = 0, options: AssignLanesOptions = {}): LaneLayout {
  const sorted: LaneEntry[] = items.map((item) => {
    const start = itemStart(item);
    return { id: item.id, start, end: Math.max(itemEnd(item), start + minExtent) };
  });
  if (!options.presorted || !sortPresorted(sorted)) sorted.sort(compareEntries);
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const entry of sorted) {
    let lane = laneEnds.findIndex((end) => end <= entry.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.end);
    } else {
      laneEnds[lane] = entry.end;
    }
    lanes.set(entry.id, lane);
  }
  return { lanes, laneCount: Math.max(1, laneEnds.length) };
}

/** Groups items by row id, keeping their order. */
export function groupItemsByRow<M>(items: readonly TimelineItem<M>[]): Map<string, TimelineItem<M>[]> {
  const result = new Map<string, TimelineItem<M>[]>();
  for (const item of items) {
    let list = result.get(item.rowId);
    if (!list) result.set(item.rowId, (list = []));
    list.push(item);
  }
  return result;
}

/** Index of the first value >= `target` in a sorted array. */
export function lowerBound(values: readonly number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid]! < target) low = mid + 1;
    else high = mid;
  }
  return low;
}
