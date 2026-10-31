/**
 * `update({ items })` on a static source validates only the upserted items and
 * keeps an id -> position index instead of revalidating and re-indexing the whole
 * collection. These tests check it against a reference (full `applyChanges` +
 * full `validateItems`, i.e. the original implementation) on randomized small
 * changes, and guard against a return to O(n) validation per update.
 */
import { describe, expect, it } from 'vitest';
import { applyChanges, TimelineValidationError, validateItems } from '../src/core/index.js';
import type { CollectionChanges, TimelineItem, TimelineRow, ValidationIssue } from '../src/core/index.js';
import { setup } from './helpers.js';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows: TimelineRow[] = [
  { id: 'root', label: 'Root' },
  { id: 'a', label: 'A', parentId: 'root' },
  { id: 'b', label: 'B', parentId: 'root' },
];
const rowIds = new Set(rows.map((row) => row.id));

/** Reference: the original full rebuild + full validation. */
function reference(current: readonly TimelineItem[], changes: CollectionChanges<TimelineItem>) {
  const items = applyChanges(current, changes.upsert, changes.remove);
  const issues = validateItems(items, rowIds, 'relative');
  return { items, issues };
}

function makeItems(count: number, prefix = 'i'): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push(
      i % 3 === 0
        ? { id: `${prefix}${i}`, rowId: i % 2 ? 'a' : 'b', start: i, end: i + 5 }
        : { id: `${prefix}${i}`, rowId: i % 2 ? 'a' : 'b', at: i },
    );
  }
  return items;
}

function issuesOf(fn: () => void): ValidationIssue[] | null {
  try {
    fn();
    return null;
  } catch (error) {
    if (!(error instanceof TimelineValidationError)) throw error;
    return [...error.issues];
  }
}

describe('incremental item updates', () => {
  it('matches the full rebuild + full validation on randomized small changes', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const random = mulberry32(seed);
      const int = (n: number) => Math.floor(random() * n);
      const { controller, snap } = setup({ rows, source: makeItems(30 + int(40)) });
      let model: readonly TimelineItem[] = snap().items;
      let fresh = 0;

      for (let step = 0; step < 150; step++) {
        const ids = model.map((item) => item.id);
        const pickId = () => (ids.length && random() < 0.85 ? ids[int(ids.length)]! : `ghost${int(5)}`);
        const upsert: TimelineItem[] = [];
        const upserts = int(5);
        for (let u = 0; u < upserts; u++) {
          const id = random() < 0.5 ? pickId() : random() < 0.1 && upsert.length ? upsert[0]!.id : `n${seed}_${fresh++}`;
          const roll = random();
          let item: TimelineItem;
          if (roll < 0.05) item = { id, rowId: 'ghost', at: 1 };
          else if (roll < 0.1) item = { id, rowId: 'a', start: 10, end: 5 };
          else if (roll < 0.13) item = { id, rowId: 'a', at: Number.NaN };
          else if (roll < 0.15) item = { id, rowId: 'b', at: 3, group: { count: 0 } };
          else if (roll < 0.17) item = { id: '', rowId: 'b', at: 3 };
          else if (roll < 0.6) item = { id, rowId: random() < 0.5 ? 'a' : 'b', at: int(1000) };
          else item = { id, rowId: 'root', start: int(500), end: 500 + int(500) };
          upsert.push(item);
        }
        const remove: string[] = [];
        const removals = int(4);
        for (let r = 0; r < removals; r++) remove.push(random() < 0.3 && upsert.length ? upsert[int(upsert.length)]!.id : pickId());
        const changes: CollectionChanges<TimelineItem> = {
          ...(upsert.length || random() < 0.5 ? { upsert } : {}),
          ...(remove.length || random() < 0.5 ? { remove } : {}),
        };

        const expected = reference(model, changes);
        const before = snap();
        const actual = issuesOf(() => controller.update({ items: changes }));
        if (expected.issues.length) {
          expect(actual).toEqual(expected.issues);
          expect(snap()).toBe(before);
        } else {
          expect(actual).toBeNull();
          expect(snap().items).toEqual(expected.items);
          model = snap().items;
        }

        // Occasionally replace the collection through other paths, which must reset the index.
        if (step % 37 === 36) {
          controller.setItems(model.slice().reverse());
          model = snap().items;
        } else if (step % 53 === 52) {
          controller.update({ rows: { upsert: [{ id: 'c', label: 'C', parentId: 'root' }] }, items: { upsert: [{ id: `c${step}`, rowId: 'c', at: 1 }] } });
          controller.update({ rows: { remove: ['c'] } });
          model = snap().items;
          expect(model.some((item) => item.rowId === 'c')).toBe(false);
        }
      }
    }
  });

  it('keeps positions: replacements in place, removals first, new entries appended', () => {
    const { controller, snap } = setup({ rows, source: makeItems(6) });
    controller.update({
      items: {
        upsert: [{ id: 'x', rowId: 'a', at: 1 }, { id: 'i4', rowId: 'a', at: 44 }, { id: 'i1', rowId: 'b', at: 11 }, { id: 'x', rowId: 'b', at: 2 }],
        remove: ['i0', 'i1', 'i3', 'nope'],
      },
    });
    expect(snap().items.map((item) => item.id)).toEqual(['i1', 'i2', 'i4', 'i5', 'x']);
    expect(snap().items.find((item) => item.id === 'x')).toEqual({ id: 'x', rowId: 'b', at: 2 });
    // The index stays consistent after removals shifted positions.
    controller.update({ items: { upsert: [{ id: 'i5', rowId: 'a', at: 55 }], remove: ['i2'] } });
    expect(snap().items.map((item) => item.id)).toEqual(['i1', 'i4', 'i5', 'x']);
    expect(snap().items[2]).toEqual({ id: 'i5', rowId: 'a', at: 55 });
  });

  it('does not mutate the previous snapshot array', () => {
    const { controller, snap } = setup({ rows, source: makeItems(5) });
    const before = snap().items;
    const copy = before.slice();
    controller.update({ items: { upsert: [{ id: 'i2', rowId: 'a', at: 99 }, { id: 'z', rowId: 'a', at: 1 }], remove: ['i0'] } });
    expect(before).toEqual(copy);
    expect(snap().items).not.toBe(before);
  });

  it('applies 1 000 updates of 5 items on a 20 000-item collection quickly', () => {
    const { controller, snap } = setup({ rows, source: makeItems(20_000) });
    let oldest = 0;
    let next = 20_000;
    const run = (updates: number) => {
      for (let u = 0; u < updates; u++) {
        // Live-stream shape: drop the 2 oldest, append 2, modify 1 existing.
        const remove = [`i${oldest++}`, `i${oldest++}`];
        const upsert: TimelineItem[] = [
          { id: `i${next}`, rowId: 'a', at: next++ },
          { id: `i${next}`, rowId: 'b', at: next++ },
          { id: `i${next - 100}`, rowId: 'a', at: next },
        ];
        controller.update({ items: { upsert, remove } });
      }
    };
    run(20); // warm-up
    const started = performance.now();
    run(1_000);
    const elapsed = performance.now() - started;
    if (process.env.TW_PERF_LOG) console.log(`1 000 stream updates on 20 000 items: ${elapsed.toFixed(1)} ms`);
    expect(snap().items).toHaveLength(20_000);
    // Full revalidation took ~3.5 s here; the incremental path ~0.13 s. Generous bound.
    expect(elapsed).toBeLessThan(1_200);
  });

  it('appends and replacements without removals stay cheap', () => {
    const { controller } = setup({ rows, source: makeItems(20_000) });
    let next = 20_000;
    const started = performance.now();
    for (let u = 0; u < 1_000; u++) {
      controller.update({
        items: {
          upsert: [
            { id: `i${next}`, rowId: 'a', at: next++ },
            { id: `i${u * 7}`, rowId: 'b', at: u },
            { id: `i${u * 11 + 1}`, rowId: 'a', at: u },
            { id: `i${next}`, rowId: 'b', at: next++ },
            { id: `i${u * 13 + 2}`, rowId: 'a', at: u },
          ],
        },
      });
    }
    const elapsed = performance.now() - started;
    if (process.env.TW_PERF_LOG) console.log(`1 000 append/replace updates on 20 000 items: ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(1_200);
  });
});
