import type { TimeMode, TimeRange, TimelineItem, TimelineKey, TimelineRow } from './model.js';
import { isSpan } from './model.js';
import { MAX_DATE_TIME, MAX_SAFE_TIME } from './time.js';
import type { ValidationIssue } from './errors.js';
import { TimelineValidationError } from './errors.js';

export function isValidTime(value: unknown, mode: TimeMode): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const limit = mode === 'calendar' ? MAX_DATE_TIME : MAX_SAFE_TIME;
  return Math.abs(value) <= limit;
}

export function validateDomain(domain: TimeRange, mode: TimeMode): ValidationIssue[] {
  if (!domain || !isValidTime(domain.start, mode) || !isValidTime(domain.end, mode)) {
    return [{ code: 'invalid-time', path: 'domain', message: 'Domain bounds must be finite, representable times' }];
  }
  if (!(domain.start < domain.end)) {
    return [{ code: 'invalid-domain', path: 'domain', message: 'Domain start must be strictly before its end' }];
  }
  return [];
}

function checkId(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    issues.push({ code: 'missing-id', path, message: `Every entry in ${path} needs a non-empty string id` });
    return false;
  }
  return true;
}

export function validateRows(rows: readonly TimelineRow<unknown>[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, TimelineRow<unknown>>();
  for (const row of rows) {
    if (!checkId(row?.id, 'rows', issues)) continue;
    if (byId.has(row.id)) {
      issues.push({ code: 'duplicate-id', path: 'rows', id: row.id, message: `Duplicate row id "${row.id}"` });
      continue;
    }
    byId.set(row.id, row);
  }
  for (const row of byId.values()) {
    if (row.parentId !== undefined && !byId.has(row.parentId)) {
      issues.push({
        code: 'unknown-parent',
        path: 'rows',
        id: row.id,
        message: `Row "${row.id}" refers to unknown parent "${row.parentId}"`,
      });
    }
  }
  if (issues.length) return issues;
  // Cycle detection: walk up from each row with a visited marker.
  const state = new Map<string, 1 | 2>(); // 1 = in progress, 2 = done
  for (const row of byId.values()) {
    const chain: string[] = [];
    let current: TimelineRow<unknown> | undefined = row;
    while (current && state.get(current.id) !== 2) {
      if (state.get(current.id) === 1) {
        issues.push({ code: 'cycle', path: 'rows', id: current.id, message: `Row hierarchy has a cycle at "${current.id}"` });
        break;
      }
      state.set(current.id, 1);
      chain.push(current.id);
      current = current.parentId === undefined ? undefined : byId.get(current.parentId);
    }
    for (const id of chain) state.set(id, 2);
    if (issues.length) break;
  }
  return issues;
}

export function validateKeys(keys: readonly TimelineKey<unknown>[], mode: TimeMode): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    if (!checkId(key?.id, 'keys', issues)) continue;
    if (seen.has(key.id)) {
      issues.push({ code: 'duplicate-id', path: 'keys', id: key.id, message: `Duplicate key id "${key.id}"` });
    }
    seen.add(key.id);
    if (!isValidTime(key.at, mode)) {
      issues.push({ code: 'invalid-time', path: 'keys', id: key.id, message: `Key "${key.id}" has an invalid time` });
    }
  }
  return issues;
}

export function validateItems(
  items: readonly TimelineItem<unknown>[],
  rowIds: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  mode: TimeMode,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!checkId(item?.id, 'items', issues)) continue;
    if (seen.has(item.id)) {
      issues.push({ code: 'duplicate-id', path: 'items', id: item.id, message: `Duplicate item id "${item.id}"` });
    }
    seen.add(item.id);
    if (!rowIds.has(item.rowId)) {
      issues.push({
        code: 'unknown-row',
        path: 'items',
        id: item.id,
        message: `Item "${item.id}" refers to unknown row "${item.rowId}"`,
      });
    }
    if (isSpan(item)) {
      if (!isValidTime(item.start, mode) || !isValidTime(item.end, mode)) {
        issues.push({ code: 'invalid-time', path: 'items', id: item.id, message: `Item "${item.id}" has an invalid time` });
      } else if (!(item.start < item.end)) {
        issues.push({
          code: 'invalid-range',
          path: 'items',
          id: item.id,
          message: `Span "${item.id}" must start strictly before it ends; use a point for zero duration`,
        });
      }
    } else if (!isValidTime((item as { at?: unknown }).at, mode)) {
      issues.push({ code: 'invalid-time', path: 'items', id: item.id, message: `Item "${item.id}" has an invalid time` });
    }
    if (item.group !== undefined) {
      const count = item.group.count;
      if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) {
        issues.push({
          code: 'invalid-group',
          path: 'items',
          id: item.id,
          message: `Group "${item.id}" needs a strictly positive count`,
        });
      }
    }
  }
  return issues;
}

export function validateRange(range: TimeRange, mode: TimeMode, path: string): ValidationIssue[] {
  if (!range || !isValidTime(range.start, mode) || !isValidTime(range.end, mode)) {
    return [{ code: 'invalid-time', path, message: `${path} bounds must be valid times` }];
  }
  if (range.start > range.end) {
    return [{ code: 'invalid-range', path, message: `${path} start must not be after its end` }];
  }
  return [];
}

export function throwIfIssues(issues: readonly ValidationIssue[]): void {
  if (issues.length) throw new TimelineValidationError(issues);
}

/**
 * Applies removals then upserts by id, keeping the existing order.
 * Replaced entries keep their position; new entries go last.
 */
export function applyChanges<T extends { readonly id: string }>(
  current: readonly T[],
  upsert: readonly T[] = [],
  remove: readonly string[] = [],
): T[] {
  const removed = new Set(remove);
  const updates = new Map<string, T>();
  for (const entry of upsert) updates.set(entry.id, entry);
  const result: T[] = [];
  for (const entry of current) {
    if (removed.has(entry.id) && !updates.has(entry.id)) continue;
    const next = updates.get(entry.id);
    if (next) {
      result.push(next);
      updates.delete(entry.id);
    } else {
      result.push(entry);
    }
  }
  for (const entry of updates.values()) result.push(entry);
  return result;
}
