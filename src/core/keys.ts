import type { TimelineKey } from './model.js';

/** Sorted distinct key instants. Several keys at the same instant form one destination. */
export function keyInstants(keys: readonly TimelineKey<unknown>[]): number[] {
  const instants = Array.from(new Set(keys.map((key) => key.at)));
  instants.sort((a, b) => a - b);
  return instants;
}

/** First instant strictly after `reference`, or `null`. */
export function nextKeyInstant(instants: readonly number[], reference: number): number | null {
  let low = 0;
  let high = instants.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (instants[mid]! <= reference) low = mid + 1;
    else high = mid;
  }
  return low < instants.length ? instants[low]! : null;
}

/** Last instant strictly before `reference`, or `null`. */
export function previousKeyInstant(instants: readonly number[], reference: number): number | null {
  let low = 0;
  let high = instants.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (instants[mid]! < reference) low = mid + 1;
    else high = mid;
  }
  return low > 0 ? instants[low - 1]! : null;
}
