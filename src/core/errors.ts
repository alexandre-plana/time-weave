export type ValidationCode =
  | 'invalid-time'
  | 'invalid-range'
  | 'invalid-domain'
  | 'duplicate-id'
  | 'missing-id'
  | 'unknown-row'
  | 'unknown-parent'
  | 'cycle'
  | 'invalid-group'
  | 'invalid-speed'
  | 'invalid-option'
  | 'live-regression'
  | 'source-mismatch';

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly message: string;
  /** Collection or option concerned, e.g. `rows`, `items`, `keys`, `domain`. */
  readonly path: string;
  readonly id?: string | undefined;
}

/**
 * Structured error thrown by commands receiving invalid input.
 * The controller keeps its last valid state when it is thrown.
 */
export class TimelineValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    const first = issues[0];
    super(
      first
        ? `${first.message}${issues.length > 1 ? ` (+${issues.length - 1} more)` : ''}`
        : 'Invalid timeline input',
    );
    this.name = 'TimelineValidationError';
    this.issues = issues;
  }
}

export function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError';
}
