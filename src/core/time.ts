import type { TimeRange } from './model.js';

/** Largest absolute value for which every millisecond is representable. */
export const MAX_SAFE_TIME = Number.MAX_SAFE_INTEGER;
/** Range accepted by `Date` (±100 000 000 days). */
export const MAX_DATE_TIME = 8.64e15;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clampToRange(value: number, range: TimeRange): number {
  return clamp(value, range.start, range.end);
}

export function rangeDuration(range: TimeRange): number {
  return range.end - range.start;
}

export function rangeContains(outer: TimeRange, inner: TimeRange): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

export function rangeContainsTime(range: TimeRange, time: number): boolean {
  return time >= range.start && time <= range.end;
}

export function rangesEqual(a: TimeRange | null, b: TimeRange | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.start === b.start && a.end === b.end;
}

/** Expands `range` by `ratio` of its duration on each side, bounded by `bounds`. */
export function expandRange(range: TimeRange, ratio: number, bounds: TimeRange): TimeRange {
  const margin = rangeDuration(range) * ratio;
  return {
    start: Math.max(bounds.start, range.start - margin),
    end: Math.min(bounds.end, range.end + margin),
  };
}

/**
 * Fits a viewport inside `domain`, keeping its duration where possible and
 * respecting the minimum duration.
 */
export function fitViewport(range: TimeRange, domain: TimeRange, minDuration: number): TimeRange {
  const domainDuration = rangeDuration(domain);
  let duration = clamp(rangeDuration(range), Math.min(minDuration, domainDuration), domainDuration);
  if (!Number.isFinite(duration)) duration = domainDuration;
  const center = (range.start + range.end) / 2;
  let start = Number.isFinite(center) ? center - duration / 2 : domain.start;
  if (rangeDuration(range) === duration) start = range.start;
  start = clamp(start, domain.start, domain.end - duration);
  return { start, end: start + duration };
}

/** Translates a viewport so that `time` sits at `ratio` of its width, inside `domain`. */
export function anchorViewport(viewport: TimeRange, time: number, ratio: number, domain: TimeRange): TimeRange {
  const duration = rangeDuration(viewport);
  const start = clamp(time - duration * ratio, domain.start, domain.end - duration);
  return { start, end: start + duration };
}
