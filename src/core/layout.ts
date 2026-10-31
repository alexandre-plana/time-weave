import type { TimelineItem } from './model.js';
import { itemEnd, itemStart } from './model.js';

export interface LaneLayout {
  /** Lane index of each item id. */
  readonly lanes: ReadonlyMap<string, number>;
  /** Number of lanes needed (at least 1). */
  readonly laneCount: number;
}

/**
 * Places overlapping items in deterministic lanes. Items are sorted by start,
 * end then id, so the result does not depend on the input order.
 * `minExtent` is the minimal footprint of an item in time units (e.g. a marker's
 * width converted at the current scale), so close points do not overlap visually.
 */
export function assignLanes(items: readonly TimelineItem<unknown>[], minExtent = 0): LaneLayout {
  const sorted = items
    .map((item) => {
      const start = itemStart(item);
      return { id: item.id, start, end: Math.max(itemEnd(item), start + minExtent) };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
