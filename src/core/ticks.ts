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
  ...steps('year', [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000, 100_000]),
];

const relativeSteps: TickStep[] = [
  ...fixedSteps,
  ...steps('day', [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 1e6, 1e7, 1e8, 1e9]),
];

/** Picks the smallest step whose spacing is at least `minSpacing` pixels. */
export function chooseTickStep(mode: TimeMode, range: TimeRange, width: number, minSpacing = 90): TickStep {
  const list = mode === 'calendar' ? calendarSteps : relativeSteps;
  const duration = range.end - range.start;
  const msPerPixel = width > 0 ? duration / width : duration;
  const minimum = msPerPixel * minSpacing;
  return list.find((step) => step.duration >= minimum) ?? list[list.length - 1]!;
}

function* fixedTickTimes(range: TimeRange, step: number): Generator<number> {
  let time = Math.ceil(range.start / step) * step;
  for (let i = 0; time <= range.end && i < 10_000; i++, time += step) yield time === 0 ? 0 : time;
}

function* calendarTickTimes(range: TimeRange, step: TickStep): Generator<number> {
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
      return date.getUTCDate() === 1;
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

export function generateTicks(options: TickOptions): TickResult {
  const { mode, range, width, locale, format } = options;
  const step = chooseTickStep(mode, range, width, options.minSpacing ?? 90);
  const times = mode === 'calendar' ? calendarTickTimes(range, step) : fixedTickTimes(range, step.duration);
  const ticks: Tick[] = [];
  for (const time of times) {
    const major = mode === 'calendar' ? isMajorCalendar(time, step) : time === 0;
    const label = format
      ? format(time, step, mode)
      : mode === 'calendar'
        ? formatCalendarTick(time, step, locale, major)
        : formatRelative(time, step.duration >= unitDuration[step.unit] ? unitDuration[step.unit] : 1);
    ticks.push({ time, label, major });
  }
  return { step, ticks };
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
