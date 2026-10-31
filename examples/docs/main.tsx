import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@time-weave/react/styles.css';
import '../shared.css';
import './docs.css';
import { RepoHeader, TopBar } from '../chrome';
import { SECTIONS, Sections } from './sections';

/** Lower case without diacritics, so that « securite » finds « Sécurité ». */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Ids of the sections whose text contains every word of the query. */
function matchingSections(query: string): ReadonlySet<string> | null {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const found = new Set<string>();
  for (const element of document.querySelectorAll<HTMLElement>('[data-doc-section]')) {
    const text = normalize(element.textContent ?? '');
    if (words.every((word) => text.includes(word))) found.add(element.dataset.docSection!);
  }
  return found;
}

/** Section currently read: the last one whose top went above the reading line. */
function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 140;
      let current = ids[0] ?? '';
      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element || element.hidden) continue;
        if (element.getBoundingClientRect().top - line <= 0) current = id;
      }
      // At the bottom of the page, the last visible section is the active one.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        const last = [...ids].reverse().find((id) => !document.getElementById(id)?.hidden);
        if (last) current = last;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

function Toc({ query, onQuery, visible }: { query: string; onQuery: (query: string) => void; visible: ReadonlySet<string> | null }) {
  const [open, setOpen] = useState(false);
  const ids = useMemo(() => SECTIONS.map((section) => section.id), []);
  const active = useActiveSection(ids);
  const count = visible ? visible.size : SECTIONS.length;
  return (
    <nav className="docs-toc" aria-label="Sommaire de la documentation" data-open={open}>
      <button type="button" className="docs-toc__toggle" aria-expanded={open} aria-controls="docs-toc-body" onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">☰</span> Sommaire
        <span className="docs-toc__current">{SECTIONS.find((section) => section.id === active)?.title}</span>
        <svg className="docs-toc__chevron" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id="docs-toc-body" className="docs-toc__body">
        <div className="docs-search">
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Filtrer les sections…"
            aria-label="Filtrer les sections"
            aria-describedby="docs-search-count"
          />
        </div>
        <p id="docs-search-count" className="docs-search__count" aria-live="polite">
          {visible ? `${count} section${count > 1 ? 's' : ''} sur ${SECTIONS.length}` : `${SECTIONS.length} sections`}
        </p>
        <ol className="docs-toc__list">
          {SECTIONS.map((section) => {
            const hidden = visible !== null && !visible.has(section.id);
            return (
              <li key={section.id} hidden={hidden}>
                <a href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={() => setOpen(false)}>
                  <span className="docs-toc__num" aria-hidden="true">
                    {String(section.num).padStart(2, '0')}
                  </span>
                  <span aria-hidden="true">{section.icon}</span>
                  <span>{section.title}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function App() {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState<ReadonlySet<string> | null>(null);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => setVisible(matchingSections(query)), [query]);

  // Hidden sections are filtered in the DOM so that their live timelines keep their state.
  useEffect(() => {
    for (const element of content.current?.querySelectorAll<HTMLElement>('[data-doc-section]') ?? []) {
      element.hidden = visible !== null && !visible.has(element.dataset.docSection!);
    }
  }, [visible]);

  // Opening the page on an anchor: scroll once the live sections are laid out.
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, []);

  return (
    <>
      <TopBar current="docs" root="../" />
      <main className="page docs-page">
        <RepoHeader
          slug="docs"
          tag="Guide"
          title="Documentation — intégrer Time Weave"
          lead="Tout ce qu’il faut pour brancher une timeline synchronisée dans une application React : installation, modèle de données, contrat de préparation, composants, personnalisation et recettes. Chaque exemple se copie et compile tel quel."
          pills={[
            ['React 18.3 · 19', 'blue'],
            ['TypeScript', 'purple'],
            ['prepareTime', 'green'],
            ['accessible', 'yellow'],
          ]}
          aside={<span className="badge">v0.1.0 · non publiée</span>}
        />
        <div className="docs-layout">
          <Toc query={query} onQuery={setQuery} visible={visible} />
          <div className="docs-content" ref={content}>
            {visible !== null && visible.size === 0 && (
              <p className="docs-empty" role="status">
                Aucune section ne contient « {query} ».{' '}
                <button type="button" className="docs-link" onClick={() => setQuery('')}>
                  Effacer le filtre
                </button>
              </p>
            )}
            <Sections />
          </div>
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
