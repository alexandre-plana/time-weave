import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { defaultLabels } from './labels.js';
import type { TimelineLabels } from './labels.js';

export interface DetailModalProps {
  title: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  /** Element focused again when the dialog closes. Defaults to the element focused at opening. */
  returnFocus?: HTMLElement | null;
  labels?: Partial<TimelineLabels>;
  className?: string;
  /**
   * Element made `inert` while the dialog is open (restored on close), e.g. the
   * timeline frame. Its `data-theme` (or that of its nearest ancestor) is copied
   * on the dialog, which is rendered in `document.body`.
   */
  inertRoot?: HTMLElement | null;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Simple optional dialog, rendered in `document.body`: moves focus inside,
 * keeps Tab within it, closes on Escape and returns focus to its trigger (or a
 * still-present fallback).
 */
export function DetailModal(props: DetailModalProps): ReactNode {
  const { title, children, onClose, className } = props;
  const labels = { ...defaultLabels, ...props.labels };
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const returnTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const inertRoot = props.inertRoot ?? null;
  const theme = inertRoot?.closest('[data-theme]')?.getAttribute('data-theme') ?? undefined;

  useEffect(() => {
    returnTo.current = props.returnFocus ?? (document.activeElement as HTMLElement | null);
    // The content behind the dialog leaves the accessibility tree and focus order.
    const wasInert = inertRoot?.hasAttribute('inert') ?? false;
    if (inertRoot && !wasInert) inertRoot.setAttribute('inert', '');
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => {
      // Restored before returning focus: an inert element cannot take focus.
      if (inertRoot && !wasInert) inertRoot.removeAttribute('inert');
      const target = returnTo.current;
      if (target && target.isConnected) target.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="tw-modal-backdrop" data-theme={theme} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className={['tw-modal', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="tw-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="tw-button" onClick={onClose} aria-label={labels.close}>
            ×
          </button>
        </div>
        <div className="tw-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
