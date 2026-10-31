import type { TimeMode, TimeRange } from './model.js';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const YEAR_APPROX = 365.2425 * DAY;
export const MONTH_APPROX = YEAR_APPROX / 12;

export type TickUnit = 'millisecond' | 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

export interface TickStep {
  readonly unit: TickUnit;
  /** Number of units between two ticks. */
  readonly count: number;
  /** Approximate duration in ms (exact below months). */
  readonly duration: number;
}

export interface Tick {
  readonly time: number;
  readonly label: string;
  /** Tick aligned on a larger unit (day, year…), shown more prominently. */
  readonly major: boolean;
}

export interface TickOptions {
  readonly mode: TimeMode;
  readonly range: TimeRange;
  /** Width in pixels available for `range`. */
  readonly width: number;
  /** Minimum spacing between two labels, in pixels. Defaults to 90. */
  readonly minSpacing?: number;
  /** Locale used for calendar labels. Defaults to the runtime locale. */
  readonly locale?: string | undefined;
  /**
   * Estimated advance of one label character, in pixels, used to keep labels
   * from overlapping (a label starts 4 px right of its tick). Defaults to 6.5
   * (10 px monospace). Set to 0 to disable the label-width check.
   */
  readonly charWidth?: number;
  /** Replaces the default label. */
  readonly format?: ((time: number, step: TickStep, mode: TimeMode) => string) | undefined;
}

export interface TickResult {
  readonly step: TickStep;
  readonly ticks: readonly Tick[];
}

const unitDuration: Record<TickUnit, number> = {
  millisecond: 1,
  second: SECOND,
  minute: MINUTE,
  hour: HOUR,
  day: DAY,
  month: MONTH_APPROX,
  year: YEAR_APPROX,
};

function steps(unit: TickUnit, counts: number[]): TickStep[] {
  return counts.map((count) => ({ unit, count, duration: count * unitDuration[unit] }));
}

const fixedSteps: TickStep[] = [
  ...steps('millisecond', [1, 2, 5, 10, 20, 50, 100, 200, 500]),
  ...steps('second', [1, 2, 5, 10, 15, 30]),
  ...steps('minute', [1, 2, 5, 10, 15, 30]),
  ...steps('hour', [1, 2, 3, 6, 12]),
];

const calendarSteps: TickStep[] = [
  ...fixedSteps,
  ...steps('day', [1, 2, 7, 14]),
  ...steps('month', [1, 3, 6]),
  ...steps('year', [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000]),
];

const relativeSteps: TickStep[] = [
  ...fixedSteps,
  ...steps('day', [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000]),
];

/** Smallest 1-2-5 × 10^k number not below `value` (`value` > 0). */
function niceAbove(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  for (const factor of [1, 2, 5, 10]) {
    if (factor * power >= value * (1 - 1e-12)) return factor * power;
  }
  return 10 * power;
}

/** Steps past the end of the list continue as 1-2-5 multiples of days (relative) or years (calendar). */
function extendedStep(mode: TimeMode, count: number): TickStep {
  const unit: TickUnit = mode === 'calendar' ? 'year' : 'day';
  return { unit, count, duration: count * unitDuration[unit] };
}

/** The next coarser step after `step`. */
function nextTickStep(mode: TimeMode, step: TickStep): TickStep {
  const list = mode === 'calendar' ? calendarSteps : relativeSteps;
  const index = list.indexOf(step);
  if (index >= 0 && index < list.length - 1) return list[index + 1]!;
  return extendedStep(mode, niceAbove(step.count * 1.5));
}

/** Picks the smallest step whose spacing is at least `minSpacing` pixels. */
export function chooseTickStep(mode: TimeMode, range: TimeRange, width: number, minSpacing = 90): TickStep {
  const list = mode === 'calendar' ? calendarSteps : relativeSteps;
  const duration = range.end - range.start;
  const msPerPixel = width > 0 ? duration / width : duration;
  const minimum = msPerPixel * minSpacing;
  const found = list.find((step) => step.duration >= minimum);
  if (found) return found;
  const last = list[list.length - 1]!;
  const count = niceAbove(minimum / unitDuration[last.unit]);
  return Number.isFinite(count) && count > last.count ? extendedStep(mode, count) : last;
}

function* fixedTickTimes(range: TimeRange, step: number, offset = 0): Generator<number> {
  const first = Math.ceil((range.start - offset) / step) * step + offset;
  for (let i = 0; i < 10_000; i++) {
    const time = first + i * step;
    if (time > range.end) return;
    yield time === 0 ? 0 : time;
  }
}

/** 1970-01-05, the first Monday after the Unix epoch (a Thursday): weeks are ISO weeks. */
const MONDAY_OFFSET = 4 * DAY;

function daysInMonth(date: Date): number {
  const end = new Date(date.getTime());
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return end.getUTCDate();
}

/**
 * Two-day steps restart on the 1st of each month: odd days 1, 3, 5…, keeping
 * at least two days before the next 1st (gaps are 2 or 3 days, never 1).
 * Depends on the date only, so labels stay put while panning.
 */
function* twoDayTickTimes(range: TimeRange): Generator<number> {
  let time = Math.ceil(range.start / DAY) * DAY;
  for (let i = 0; time <= range.end && i < 20_000; i++, time += DAY) {
    const date = new Date(time);
    const day = date.getUTCDate();
    if (day % 2 === 1 && day < daysInMonth(date)) yield time;
  }
}

/** Valid `Date` range: ±8.64e15 ms. */
const MAX_DATE = 8.64e15;

function* calendarTickTimes(range: TimeRange, step: TickStep): Generator<number> {
  if (step.unit === 'day' && step.count === 2) {
    yield* twoDayTickTimes(range);
    return;
  }
  if (step.unit === 'day' && step.count % 7 === 0) {
    yield* fixedTickTimes(range, step.duration, MONDAY_OFFSET);
    return;
  }
  if (step.unit !== 'month' && step.unit !== 'year') {
    yield* fixedTickTimes(range, step.duration);
    return;
  }
  const first = new Date(range.start);
  let year = first.getUTCFullYear();
  let month = step.unit === 'year' ? 0 : first.getUTCMonth();
  if (step.unit === 'year') year = Math.floor(year / step.count) * step.count;
  else month = Math.floor(month / step.count) * step.count;
  for (let i = 0; i < 10_000; i++) {
    const date = new Date(0);
    date.setUTCFullYear(year, month, 1);
    date.setUTCHours(0, 0, 0, 0);
    const time = date.getTime();
    if (Number.isNaN(time) || time > range.end) return;
    if (time >= range.start) yield time;
    if (step.unit === 'year') year += step.count;
    else {
      month += step.count;
      if (month >= 12) {
        year += Math.floor(month / 12);
        month %= 12;
      }
    }
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
    formatters.set(key, format);
  }
  return format;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function isMajorCalendar(time: number, step: TickStep): boolean {
  const date = new Date(time);
  switch (step.unit) {
    case 'millisecond':
    case 'second':
      return date.getUTCMilliseconds() === 0 && date.getUTCSeconds() === 0;
    case 'minute':
    case 'hour':
      return date.getUTCHours() === 0 && date.getUTCMinutes() === 0;
    case 'day':
      // First tick of each month: the 1st for 1- and 2-day steps, the first
      // Monday (weeks) or the first of the fortnightly Mondays.
      return date.getUTCDate() <= step.count;
    case 'month':
      return date.getUTCMonth() === 0;
    case 'year':
      return date.getUTCFullYear() % (step.count * 10) === 0;
  }
}

/** Default calendar label for a tick, in UTC. */
export function formatCalendarTick(time: number, step: TickStep, locale?: string, major = false): string {
  const date = new Date(time);
  switch (step.unit) {
    case 'millisecond': {
      const base = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
      return major ? `${dateFormat(locale, { day: 'numeric', month: 'short' }).format(date)} ${base}` : base;
    }
    case 'second': {
      const base = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
      return major ? `${dateFormat(locale, { day: 'numeric', month: 'short' }).format(date)} ${base}` : base;
    }
    case 'minute':
    case 'hour': {
      if (major) return dateFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
      return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    }
    case 'day':
      return dateFormat(locale, major ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }).format(date);
    case 'month':
      return dateFormat(locale, major ? { month: 'short', year: 'numeric' } : { month: 'short' }).format(date);
    case 'year':
      return String(date.getUTCFullYear());
  }
}

const relativeUnits: [number, string][] = [
  [DAY, 'd'],
  [HOUR, 'h'],
  [MINUTE, 'min'],
  [SECOND, 's'],
  [1, 'ms'],
];

/**
 * Formats a relative position as its components down to `resolution`, e.g. `1 h 30 min`, `-250 ms`.
 */
export function formatRelative(time: number, resolution = 1): string {
  if (time === 0) return '0';
  const sign = time < 0 ? '−' : '';
  let remaining = Math.round(Math.abs(time));
  const parts: string[] = [];
  for (const [size, label] of relativeUnits) {
    if (size < resolution && parts.length > 0) break;
    const value = Math.floor(remaining / size);
    remaining -= value * size;
    if (value > 0) parts.push(`${value.toLocaleString('en-US').replace(/,/g, ' ')} ${label}`);
    if (size <= resolution && parts.length > 0) break;
  }
  return sign + (parts.length ? parts.join(' ') : '0');
}

/** Space around a label: 4 px from its tick line, 4 px before the next tick. */
const LABEL_PADDING = 8;

/**
 * Builds the ticks for `step`, or returns null when there would be more than
 * `maxTicks` of them or when a label would overlap the next tick.
 */
function buildTicks(options: TickOptions, range: TimeRange, step: TickStep, maxTicks: number, msPerPixel: number, charWidth: number): Tick[] | null {
  const { mode, locale, format } = options;
  const times = mode === 'calendar' ? calendarTickTimes(range, step) : fixedTickTimes(range, step.duration);
  const checkLabels = charWidth > 0 && msPerPixel > 0 && Number.isFinite(msPerPixel);
  // Calendar majors carry longer labels (date + time): reserve room for one even
  // when none is visible, so the step does not change while panning.
  let reserved = 0;
  if (checkLabels && mode === 'calendar' && !format) {
    reserved = formatCalendarTick(Math.min(Math.max(range.start, -MAX_DATE), MAX_DATE), step, locale, true).length * charWidth + LABEL_PADDING;
  }
  const ticks: Tick[] = [];
  let previous: { time: number; width: number } | null = null;
  for (const time of times) {
    if (ticks.length >= maxTicks) return null;
    const major = mode === 'calendar' ? isMajorCalendar(time, step) : time === 0;
    const label = format
      ? format(time, step, mode)
      : mode === 'calendar'
        ? formatCalendarTick(time, step, locale, major)
        : formatRelative(time, unitDuration[step.unit]);
    if (checkLabels) {
      const width = Math.max(label.length * charWidth + LABEL_PADDING, reserved);
      if (previous && (time - previous.time) / msPerPixel < previous.width) return null;
      previous = { time, width };
    }
    ticks.push({ time, label, major });
  }
  return ticks;
}

export function generateTicks(options: TickOptions): TickResult {
  const { mode, width } = options;
  const minSpacing = options.minSpacing ?? 90;
  const charWidth = options.charWidth ?? 6.5;
  let step = chooseTickStep(mode, options.range, width, minSpacing);
  if (!Number.isFinite(options.range.start) || !Number.isFinite(options.range.end)) return { step, ticks: [] };
  // Calendar labels need a valid Date.
  const range =
    mode === 'calendar'
      ? { start: Math.max(options.range.start, -MAX_DATE), end: Math.min(options.range.end, MAX_DATE) }
      : options.range;
  // No more ticks than fit at `minSpacing`, plus one at each edge.
  const maxTicks = width > 0 && minSpacing > 0 && Number.isFinite(width / minSpacing) ? Math.min(10_000, Math.floor(width / minSpacing) + 2) : width > 0 ? 10_000 : 2;
  const msPerPixel = width > 0 ? (options.range.end - options.range.start) / width : NaN;
  for (let attempt = 0; attempt < 200; attempt++) {
    const ticks = buildTicks(options, range, step, maxTicks, msPerPixel, charWidth);
    if (ticks) return { step, ticks };
    step = nextTickStep(mode, step);
  }
  return { step, ticks: [] };
}

/** Full-precision readout for a position: UTC date and time, or a signed relative clock. */
export function formatTimeReadout(time: number, mode: TimeMode, locale?: string): string {
  const rounded = Math.round(time);
  if (mode === 'calendar') {
    const date = new Date(rounded);
    if (Number.isNaN(date.getTime())) return '';
    const day = dateFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
    return `${day} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)} UTC`;
  }
  const sign = rounded < 0 ? '−' : '';
  let rest = Math.abs(rounded);
  const days = Math.floor(rest / DAY);
  rest -= days * DAY;
  const hours = Math.floor(rest / HOUR);
  rest -= hours * HOUR;
  const minutes = Math.floor(rest / MINUTE);
  rest -= minutes * MINUTE;
  const seconds = Math.floor(rest / SECOND);
  const ms = rest - seconds * SECOND;
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`;
  return `${sign}${days ? `${days} d ` : ''}${clock}`;
}
