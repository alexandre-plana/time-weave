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
});
