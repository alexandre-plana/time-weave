import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { highlight } from './highlight';
import type { Language } from './highlight';

/** Building blocks of the documentation page: code blocks, sections, callouts, tables. */

const LANGUAGE_LABELS: Record<Language, string> = { tsx: 'TSX', ts: 'TypeScript', css: 'CSS', sh: 'Shell' };

/** Copies text with the asynchronous clipboard API, or a hidden textarea when it is unavailable or refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission refused: fall back below.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  document.body.appendChild(area);
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  previous?.focus({ preventScroll: true });
  return copied;
}

export function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? 'done' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };
  return (
    <>
      <button type="button" className="docs-copy" data-state={state} onClick={onClick}>
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          {state === 'done' ? (
            <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 3.2V3a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3v5.5A1.5 1.5 0 0 0 3.5 10h.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </>
          )}
        </svg>
        <span>{state === 'done' ? 'Copié' : state === 'failed' ? 'Échec' : label}</span>
      </button>
      <span className="docs-sr-only" role="status" aria-live="polite">
        {state === 'done' ? 'Code copié dans le presse-papiers' : state === 'failed' ? 'La copie a échoué : sélectionner le code manuellement' : ''}
      </span>
    </>
  );
}

/** Removes the trailing newline of raw files and the lines marked `// docs:hide`. */
export function cleanSnippet(code: string): string {
  return code
    .split('\n')
    .filter((line) => !line.includes('docs:hide'))
    .join('\n')
    .replace(/\s+$/, '');
}

export function CodeBlock({ code, language = 'tsx', file }: { code: string; language?: Language; file?: string }) {
  const text = useMemo(() => cleanSnippet(code), [code]);
  const tokens = useMemo(() => highlight(text, language), [text, language]);
  return (
    <figure className="docs-code">
      <figcaption className="docs-code__head">
        <span className="docs-code__file">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 1.5h5.5L13 5v9.5H4z M9.5 1.5V5H13" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          {file ?? LANGUAGE_LABELS[language]}
        </span>
        <span className="docs-code__lang">{LANGUAGE_LABELS[language]}</span>
        <CopyButton text={text} />
      </figcaption>
      <pre className="docs-code__pre" tabIndex={0} aria-label={file ? `Code ${file}` : 'Code'}>
        <code>
          {tokens.map((token, index) =>
            token.kind === 'plain' || token.kind === 'punct' ? token.text : (
              <span key={index} className={`tk-${token.kind}`}>
                {token.text}
              </span>
            ),
          )}
        </code>
      </pre>
    </figure>
  );
}

export interface SectionInfo {
  readonly id: string;
  readonly num: number;
  readonly title: string;
  readonly icon: string;
}

export function Section({ info, lead, children }: { info: SectionInfo; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={info.id} className="docs-section" data-doc-section={info.id} aria-labelledby={`${info.id}-title`}>
      <h2 id={`${info.id}-title`} className="docs-section__title">
        <span className="docs-section__num" aria-hidden="true">
          {String(info.num).padStart(2, '0')}
        </span>
        {info.title}
        <a className="docs-anchor" href={`#${info.id}`} aria-label={`Lien vers la section ${info.title}`}>
          #
        </a>
      </h2>
      {lead && <p className="docs-lead">{lead}</p>}
      {children}
    </section>
  );
}

export function SubTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="docs-h3">
      {children}
    </h3>
  );
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'tip' | 'warning'; title: string; children: ReactNode }) {
  const icon = tone === 'warning' ? '⚠️' : tone === 'tip' ? '💡' : 'ℹ️';
  return (
    <aside className="docs-callout" data-tone={tone}>
      <p className="docs-callout__title">
        <span aria-hidden="true">{icon}</span> {title}
      </p>
      <div className="docs-callout__body">{children}</div>
    </aside>
  );
}

/** Box holding a live rendering, the GitHub "Box" pattern with a live badge. */
export function Demo({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="box docs-demo" aria-label={`Rendu en direct : ${title}`}>
      <div className="box__head">
        <h4 className="docs-demo__title">
          <span className="docs-live-dot" aria-hidden="true" /> {title}
        </h4>
        <div className="box__meta">{note ?? <span className="docs-demo__tag">rendu en direct</span>}</div>
      </div>
      {children}
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="docs-kbd">{children}</kbd>;
}

/** Inline code. */
export function C({ children }: { children: ReactNode }) {
  return <code className="docs-inline">{children}</code>;
}

export function Table({ head, rows, className }: { head: readonly ReactNode[]; rows: readonly (readonly ReactNode[])[]; className?: string }) {
  return (
    <div className={`docs-table-wrap${className ? ` ${className}` : ''}`}>
      <table className="docs-table">
        <thead>
          <tr>
            {head.map((cell, index) => (
              <th key={index} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td key={column} data-label={typeof head[column] === 'string' ? head[column] : undefined}>
                  {cell === '' ? null : <span className="docs-cell">{cell}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Figure wrapping an SVG illustration, scrollable horizontally on narrow screens. */
export function Figure({ caption, minWidth, children }: { caption: ReactNode; minWidth?: number; children: ReactNode }) {
  return (
    <figure className="docs-figure">
      <div className="docs-figure__scroll" tabIndex={minWidth ? 0 : undefined} role={minWidth ? 'group' : undefined} aria-label={minWidth ? 'Illustration défilante' : undefined}>
        <div style={minWidth ? { minWidth } : undefined}>{children}</div>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
