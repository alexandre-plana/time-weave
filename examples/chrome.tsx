import type { ReactNode } from 'react';

/** Shared page chrome of the examples: top bar, repository navigation, pills. */

export const REPOSITORY = 'https://github.com/alexandre-plana/time-weave';

export type Tone = 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'gray';

export type PageId = 'home' | 'operations' | 'history' | 'relative' | 'docs';

const PAGES: { id: PageId; href: string; icon: string; label: string }[] = [
  { id: 'home', href: 'index.html', icon: '📋', label: 'Aperçu' },
  { id: 'operations', href: 'operations/index.html', icon: '🛰️', label: 'Opérations' },
  { id: 'history', href: 'history/index.html', icon: '🏛️', label: 'Histoire' },
  { id: 'relative', href: 'relative/index.html', icon: '⏱️', label: 'Temps relatif' },
  { id: 'docs', href: 'docs/index.html', icon: '📖', label: 'Documentation' },
];

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1" y="2.5" width="8" height="2.6" rx="1.3" fill="#0969da" />
      <rect x="4" y="6.7" width="11" height="2.6" rx="1.3" fill="#1a7f37" />
      <rect x="2.5" y="10.9" width="6" height="2.6" rx="1.3" fill="#fd8c73" />
    </svg>
  );
}

/** On a narrow screen, scrolls the navigation so that the current page is visible. */
function revealCurrent(nav: HTMLElement | null) {
  const link = nav?.querySelector<HTMLElement>('[aria-current="page"]');
  if (nav && link && link.offsetLeft + link.offsetWidth > nav.clientWidth) nav.scrollLeft = link.offsetLeft - 16;
}

/**
 * Top bar. `root` is the relative path to the examples root ('./' on the
 * landing page, '../' in an example).
 */
export function TopBar({ current, root }: { current: PageId; root: string }) {
  const page = PAGES.find((entry) => entry.id === current);
  return (
    <header className={`topbar${current === 'home' ? ' topbar--home' : ''}`}>
      <div className="topbar__row">
        <a className="topbar__brand" href={`${root}index.html`}>
          <Logo size={24} />
          <span>time-weave</span>
        </a>
        {current !== 'home' && page && (
          <>
            <span className="topbar__sep" aria-hidden="true">
              /
            </span>
            <a className="topbar__crumb" href={`${root}${page.href}`} aria-current="page">
              {current}
            </a>
          </>
        )}
        <div className="topbar__actions">
          <a className="topbar__button" href={`${root}bench/index.html`} aria-label="Banc de performance">
            <span aria-hidden="true">📊</span>
            <span className="topbar__label">Banc</span>
          </a>
          <a className="topbar__button" href={REPOSITORY} aria-label="Dépôt GitHub">
            <span aria-hidden="true">⭐</span>
            <span className="topbar__label">GitHub</span>
          </a>
        </div>
      </div>
      {current !== 'home' && (
        <nav className="underline-nav" aria-label="Pages de démonstration" ref={revealCurrent}>
          {PAGES.map((entry) => (
            <a key={entry.id} href={`${root}${entry.href}`} aria-current={entry.id === current ? 'page' : undefined}>
              <span aria-hidden="true">{entry.icon}</span>
              {entry.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Pill({ tone = 'blue', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="pill" data-tone={tone}>
      {children}
    </span>
  );
}

/** Green status pill with a pulsing dot, as on a GitHub profile. */
export function StatusPill({ children }: { children: ReactNode }) {
  return <span className="status-pill">{children}</span>;
}

/** Repository-style page header of an example. */
export function RepoHeader({
  slug,
  tag,
  title,
  lead,
  pills,
  aside,
}: {
  slug: string;
  tag: string;
  title: string;
  lead: string;
  pills: readonly (readonly [string, Tone])[];
  aside?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        <p className="repo-path">
          <span aria-hidden="true">📁</span>
          <span className="repo-link">time-weave/{slug}</span>
          <span className="visibility">{tag}</span>
        </p>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
        <p className="pills">
          {pills.map(([label, tone]) => (
            <Pill key={label} tone={tone}>
              {label}
            </Pill>
          ))}
        </p>
      </div>
      {aside && <div className="page-header__aside">{aside}</div>}
    </header>
  );
}

/** Bordered box with a header, the GitHub "Box" pattern. */
export function Box({
  icon,
  title,
  meta,
  className,
  children,
}: {
  icon: string;
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`box${className ? ` ${className}` : ''}`}>
      <div className="box__head">
        <h2>
          <span aria-hidden="true">{icon}</span> {title}
        </h2>
        {meta && <div className="box__meta">{meta}</div>}
      </div>
      {children}
    </section>
  );
}
