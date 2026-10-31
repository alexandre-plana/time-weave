import { describe, expect, it } from 'vitest';
import {
  DAY,
  HOUR,
  assignLanes,
  chooseTickStep,
  formatRelative,
  formatTimeReadout,
  generateTicks,
} from '../src/core/index.js';

describe('ticks', () => {
  it('chooses steps from milliseconds to decades', () => {
    expect(chooseTickStep('calendar', { start: 0, end: 100 }, 1000)).toMatchObject({ unit: 'millisecond', count: 10 });
    expect(chooseTickStep('calendar', { start: 0, end: DAY }, 1200)).toMatchObject({ unit: 'hour', count: 2 });
    const decades = chooseTickStep('calendar', { start: Date.UTC(1900, 0), end: Date.UTC(2030, 0) }, 1200);
    expect(decades).toMatchObject({ unit: 'year', count: 10 });
  });

  it('aligns calendar months and years on UTC boundaries', () => {
    const { ticks, step } = generateTicks({
      mode: 'calendar',
      range: { start: Date.UTC(2020, 1, 15), end: Date.UTC(2021, 5, 1) },
      width: 1200,
      locale: 'en-US',
    });
    expect(step.unit).toBe('month');
    for (const tick of ticks) {
      const date = new Date(tick.time);
      expect(date.getUTCDate()).toBe(1);
      expect(date.getUTCHours()).toBe(0);
    }
    expect(ticks.find((t) => t.major)?.label).toBe('Jan 2021');
  });

  it('labels millisecond ticks with their milliseconds', () => {
    const start = Date.UTC(2026, 9, 31, 10, 0, 0);
    const { ticks } = generateTicks({ mode: 'calendar', range: { start, end: start + 50 }, width: 1000, locale: 'en-US' });
    expect(ticks[1]?.label).toMatch(/10:00:00\.0\d\d$/);
  });

  it('supports relative time with negative values and origin', () => {
    const { ticks } = generateTicks({ mode: 'relative', range: { start: -2 * HOUR, end: 2 * HOUR }, width: 800 });
    const zero = ticks.find((t) => t.time === 0);
    expect(zero).toMatchObject({ label: '0', major: true });
    expect(ticks[0]!.label.startsWith('−')).toBe(true);
  });

  it('keeps labels apart', () => {
    const { ticks } = generateTicks({ mode: 'relative', range: { start: 0, end: 10_000 }, width: 600, minSpacing: 90 });
    expect(ticks.length).toBeLessThanOrEqual(600 / 90 + 1);
  });

  it('formats relative durations and readouts', () => {
    expect(formatRelative(5_400_000, 60_000)).toBe('1 h 30 min');
    expect(formatRelative(-250)).toBe('−250 ms');
    expect(formatTimeReadout(-(DAY + 1500), 'relative')).toBe('−1 d 00:00:01.500');
    expect(formatTimeReadout(Date.UTC(2026, 9, 31, 8, 5, 3, 7), 'calendar', 'en-GB')).toBe('31 Oct 2026 08:05:03.007 UTC');
  });
});

describe('ticks audit', () => {
  const utcYear = (year: number) => {
    const date = new Date(0);
    date.setUTCFullYear(year, 0, 1);
    return date.getTime();
  };
  const calendar = (start: number, end: number, width = 1200, minSpacing?: number) =>
    generateTicks({ mode: 'calendar', range: { start, end }, width, locale: 'en-US', ...(minSpacing ? { minSpacing } : {}) });

  it('aligns weekly ticks on ISO Mondays, fortnights on every other Monday', () => {
    for (const [start, end] of [
      [Date.UTC(2026, 0, 1), Date.UTC(2026, 3, 1)],
      [Date.UTC(1960, 5, 3), Date.UTC(1960, 8, 1)],
    ] as const) {
      const { step, ticks } = calendar(start, end);
      expect(step).toMatchObject({ unit: 'day', count: 7 });
      for (const tick of ticks) {
        expect(new Date(tick.time).getUTCDay()).toBe(1);
        expect((((tick.time % DAY) + DAY) % DAY)).toBe(0);
      }
      // First Monday of each month is major.
      expect(ticks.filter((t) => t.major).every((t) => new Date(t.time).getUTCDate() <= 7)).toBe(true);
      expect(ticks.some((t) => t.major)).toBe(true);
    }
    const one = calendar(Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 1));
    expect(one.step).toMatchObject({ unit: 'day', count: 14 });
    // Panning keeps the same fortnight phase.
    const two = calendar(Date.UTC(2026, 0, 8), Date.UTC(2026, 6, 8));
    const shared = two.ticks.filter((t) => t.time <= Date.UTC(2026, 6, 1)).map((t) => t.time);
    expect(one.ticks.map((t) => t.time)).toEqual(expect.arrayContaining(shared));
    for (const tick of one.ticks) expect(new Date(tick.time).getUTCDay()).toBe(1);
    expect(one.ticks.filter((t) => t.major).map((t) => new Date(t.time).getUTCMonth())).toEqual(
      [...new Set(one.ticks.map((t) => new Date(t.time).getUTCMonth()))],
    );
  });

  it('places 2-day ticks on odd days restarting each month, stable when panning', () => {
    const start = Date.UTC(2024, 0, 20);
    const { step, ticks } = calendar(start, start + 26 * DAY);
    expect(step).toMatchObject({ unit: 'day', count: 2 });
    const days = ticks.map((t) => new Date(t.time).getUTCDate());
    expect(days).toEqual([21, 23, 25, 27, 29, 1, 3, 5, 7, 9, 11, 13, 15]);
    expect(ticks.find((t) => new Date(t.time).getUTCDate() === 1)).toMatchObject({ major: true, label: 'Feb 1, 2024' });
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]!.time - ticks[i - 1]!.time).toBeGreaterThanOrEqual(2 * DAY);
    const panned = calendar(start + DAY, start + 27 * DAY);
    const shared = panned.ticks.filter((t) => t.time <= start + 26 * DAY).map((t) => t.label);
    expect(ticks.map((t) => t.label)).toEqual(expect.arrayContaining(shared));
    // Leap February: 27 Feb → 1 Mar.
    const leap = calendar(Date.UTC(2024, 1, 20), Date.UTC(2024, 2, 17));
    expect(leap.ticks.map((t) => new Date(t.time).getUTCDate())).toEqual([21, 23, 25, 27, 1, 3, 5, 7, 9, 11, 13, 15, 17]);
  });

  it('aligns hour steps on UTC midnight, including before 1970', () => {
    for (const base of [Date.UTC(2026, 9, 31), Date.UTC(1900, 4, 7)]) {
      for (const hours of [1, 2, 3, 6, 12]) {
        const start = base - 5 * HOUR + 17 * 60_000;
        const { step, ticks } = calendar(start, start + 12 * hours * HOUR, 1300);
        expect(step).toMatchObject({ unit: 'hour', count: hours });
        for (const tick of ticks) expect(new Date(tick.time).getUTCHours() % hours).toBe(0);
        expect(ticks.find((t) => t.time === base)).toMatchObject({ major: true });
        for (const tick of ticks) expect(tick.major).toBe(new Date(tick.time).getUTCHours() === 0);
      }
    }
  });

  it('handles years before 100, before 1970 and far in the future', () => {
    const early = calendar(utcYear(40), utcYear(160));
    expect(early.step).toMatchObject({ unit: 'year', count: 10 });
    expect(early.ticks.map((t) => t.label)).toEqual(['40', '50', '60', '70', '80', '90', '100', '110', '120', '130', '140', '150', '160']);
    expect(early.ticks[1]!.time).toBe(utcYear(50));
    expect(early.ticks.find((t) => t.label === '100')?.major).toBe(true);
    const hastings = calendar(utcYear(1000), utcYear(1200));
    expect(hastings.ticks.map((t) => t.label)).toContain('1060');
    for (const tick of hastings.ticks) expect(new Date(tick.time).getUTCMonth()).toBe(0);
    const bc = calendar(utcYear(-520), utcYear(130));
    expect(bc.ticks.map((t) => t.label)).toContain('-500');
    expect(bc.ticks.map((t) => t.label)).toContain('0');
    const future = calendar(utcYear(250_000), utcYear(275_000), 1000);
    expect(future.ticks.length).toBeGreaterThan(0);
    for (const tick of future.ticks) expect(Number(tick.label) % future.step.count).toBe(0);
    // Beyond Date's range: clamped, no invalid dates, bounded.
    const huge = calendar(-1e17, 1e17, 1000);
    expect(huge.ticks.length).toBeLessThanOrEqual(1000 / 90 + 2);
    for (const tick of huge.ticks) expect(tick.label).not.toMatch(/NaN|Invalid/);
  });

  it('formats relative labels for every unit', () => {
    expect(formatRelative(500, 1)).toBe('500 ms');
    expect(formatRelative(1500, 1)).toBe('1 s 500 ms');
    expect(formatRelative(90_000, 1000)).toBe('1 min 30 s');
    expect(formatRelative(3 * HOUR, 60_000)).toBe('3 h');
    expect(formatRelative(DAY + 23 * HOUR + 59 * 60_000, 60_000)).toBe('1 d 23 h 59 min');
    expect(formatRelative(-2_000_000 * DAY, DAY)).toBe('−2\u202f000\u202f000 d');
  });

  it('enlarges the step when long relative labels would overlap', () => {
    // 2 d around 1 d 12 h: 15-min steps give labels like "1 d 23 h 45 min" (≈ 105 px).
    const range = { start: DAY + 12 * HOUR, end: DAY + 12 * HOUR + 8 * HOUR };
    expect(chooseTickStep('relative', range, 3000)).toMatchObject({ unit: 'minute', count: 15 });
    const { step, ticks } = generateTicks({ mode: 'relative', range, width: 3000 });
    expect(step).toMatchObject({ unit: 'minute', count: 30 });
    const pxPerMs = 3000 / (range.end - range.start);
    for (let i = 1; i < ticks.length; i++) {
      expect((ticks[i]!.time - ticks[i - 1]!.time) * pxPerMs).toBeGreaterThanOrEqual(ticks[i - 1]!.label.length * 6.5 + 8);
    }
    // Disabled check keeps the minSpacing step.
    expect(generateTicks({ mode: 'relative', range, width: 3000, charWidth: 0 }).step.count).toBe(15);
  });

  it('keeps relative ticks bounded on huge ranges', () => {
    for (const span of [1e9 * DAY, 1e12 * DAY, 1e15 * DAY]) {
      const { step, ticks } = generateTicks({ mode: 'relative', range: { start: -span, end: span }, width: 800 });
      expect(step.unit).toBe('day');
      expect(ticks.length).toBeGreaterThan(1);
      expect(ticks.length).toBeLessThanOrEqual(800 / 90 + 2);
      expect(String(step.count)).toMatch(/^[125]0*$/);
    }
    expect(generateTicks({ mode: 'relative', range: { start: -Infinity, end: 0 }, width: 800 }).ticks).toEqual([]);
  });

  it('never produces more than width / minSpacing + 2 ticks', () => {
    const widths = [1, 50, 333, 1200, 4000];
    const spans = [7, 1000, 59_000, 5 * HOUR, 9 * DAY, 45 * DAY, 400 * DAY, 3000 * DAY, 300_000 * DAY];
    for (const mode of ['calendar', 'relative'] as const) {
      for (const width of widths) {
        for (const span of spans) {
          for (const minSpacing of [40, 90]) {
            const start = Date.UTC(2023, 1, 27, 13, 7, 11, 3);
            const { ticks } = generateTicks({ mode, range: { start, end: start + span }, width, minSpacing, locale: 'en-US' });
            expect(ticks.length).toBeLessThanOrEqual(Math.floor(width / minSpacing) + 2);
          }
        }
      }
    }
  });
});

describe('lanes', () => {
  it('places overlaps in deterministic lanes independent of input order', () => {
    const items = [
      { id: 'a', rowId: 'r', start: 0, end: 10 },
      { id: 'b', rowId: 'r', start: 5, end: 15 },
      { id: 'c', rowId: 'r', start: 10, end: 20 },
      { id: 'd', rowId: 'r', at: 12 },
    ];
    const one = assignLanes(items);
    const two = assignLanes([...items].reverse());
    expect([...one.lanes.entries()].sort()).toEqual([...two.lanes.entries()].sort());
    expect(one.lanes.get('a')).toBe(0);
    expect(one.lanes.get('b')).toBe(1);
    expect(one.lanes.get('c')).toBe(0);
    expect(one.lanes.get('d')).toBe(2);
    expect(one.laneCount).toBe(3);
  });

  it('uses a minimal extent for points', () => {
    const items = [
      { id: 'p1', rowId: 'r', at: 0 },
      { id: 'p2', rowId: 'r', at: 1 },
    ];
    expect(assignLanes(items, 0).laneCount).toBe(1);
    expect(assignLanes(items, 5).laneCount).toBe(2);
  });

  it('accepts presorted input with the same result, ties on start included', () => {
    const items = [
      { id: 'z', rowId: 'r', start: 0, end: 1 },
      { id: 'b', rowId: 'r', start: 5, end: 6 },
      { id: 'a', rowId: 'r', start: 5, end: 8 },
      { id: 'p', rowId: 'r', at: 5 },
      { id: 'c', rowId: 'r', start: 7, end: 20 },
      { id: 'q', rowId: 'r', at: 30 },
    ];
    for (const extent of [0, 4]) {
      const sorted = assignLanes(items, extent);
      const presorted = assignLanes(items, extent, { presorted: true });
      expect([...presorted.lanes.entries()].sort()).toEqual([...sorted.lanes.entries()].sort());
      expect(presorted.laneCount).toBe(sorted.laneCount);
    }
    // With a minimal extent, ties on start are ordered by footprint then id, not by end.
    const ties = [
      { id: 'b', rowId: 'r', start: 0, end: 1 },
      { id: 'a', rowId: 'r', start: 0, end: 2 },
    ];
    expect(assignLanes(ties, 5, { presorted: true }).lanes.get('a')).toBe(0);
    expect(assignLanes(ties, 5).lanes.get('a')).toBe(0);
  });

  it('sorts input wrongly marked as presorted', () => {
    const items = [
      { id: 'late', rowId: 'r', start: 10, end: 20 },
      { id: 'early', rowId: 'r', start: 0, end: 15 },
    ];
    expect([...assignLanes(items, 0, { presorted: true }).lanes.entries()].sort()).toEqual([...assignLanes(items).lanes.entries()].sort());
    expect(assignLanes(items, 0, { presorted: true }).lanes.get('early')).toBe(0);
  });
});
