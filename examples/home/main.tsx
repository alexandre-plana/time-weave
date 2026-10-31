import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaybackControls, Timeline, frenchLabels, isSpan, useTimelineController, useTimelineSnapshot } from '@time-weave/react';
import type { TimeRequest, TimelineItem, TimelineKey, TimelineRow, VisibleRow } from '@time-weave/react';
import '@time-weave/react/styles.css';
import '../shared.css';
import { Box, Logo, Pill, REPOSITORY, StatusPill, TopBar } from '../chrome';
import type { Tone } from '../chrome';
import './home.css';
import { usePageTheme } from '../theme';


interface RowInfo {
  readonly tone: Tone;
}

interface ItemInfo {
  readonly tone: Tone;
}

// A launch day, 07:00 → 21:00 UTC. Played at 40 minutes per second: ~21 s per loop.
const DAY = Date.UTC(2026, 10, 18);
const at = (h: number, m = 0) => DAY + (h * 60 + m) * 60_000;
const SPEED = 40 * 60;

const rows: TimelineRow<RowInfo>[] = [
  { id: 'product', label: 'Produit', meta: { tone: 'purple' } },
  { id: 'design', label: 'Design', parentId: 'product', meta: { tone: 'purple' } },
  { id: 'dev', label: 'Développement', parentId: 'product', meta: { tone: 'blue' } },
  { id: 'qa', label: 'Qualité', parentId: 'product', meta: { tone: 'green' } },
  { id: 'infra', label: 'Infrastructure', meta: { tone: 'yellow' } },
  { id: 'deploy', label: 'Déploiement', parentId: 'infra', meta: { tone: 'blue' } },
  { id: 'watch', label: 'Supervision', parentId: 'infra', meta: { tone: 'yellow' } },
  { id: 'comms', label: 'Communication', meta: { tone: 'purple' } },
];

const span = (id: string, rowId: string, start: number, end: number, label: string, tone: Tone): TimelineItem<ItemInfo> => ({
  id,
  rowId,
  start,
  end,
  label,
  meta: { tone },
});
const point = (id: string, rowId: string, time: number, label: string, tone: Tone): TimelineItem<ItemInfo> => ({
  id,
  rowId,
  at: time,
  label,
  meta: { tone },
});

const items: TimelineItem<ItemInfo>[] = [
  span('p1', 'product', at(7, 30), at(12, 30), 'Préparation', 'purple'),
  span('p2', 'product', at(12, 30), at(20, 30), 'Lancement', 'purple'),
  span('d1', 'design', at(7, 45), at(10, 15), 'Maquettes finales', 'purple'),
  span('d2', 'design', at(13, 30), at(16), 'Retours utilisateurs', 'purple'),
  span('v1', 'dev', at(8), at(11), 'Correctifs', 'blue'),
  point('v2', 'dev', at(11, 20), 'Version 2.4', 'blue'),
  span('v3', 'dev', at(14, 30), at(17, 30), 'Correctif 2.4.1', 'blue'),
  span('q1', 'qa', at(9), at(12), 'Recette', 'green'),
  span('q2', 'qa', at(17, 30), at(19), 'Non-régression', 'green'),
  span('i1', 'infra', at(11, 30), at(14, 30), 'Fenêtre de déploiement', 'yellow'),
  span('e1', 'deploy', at(12), at(13), 'Canari 5 %', 'blue'),
  span('e2', 'deploy', at(13), at(14, 30), 'Trafic 100 %', 'blue'),
  point('e3', 'deploy', at(18, 10), 'Correctif en ligne', 'blue'),
  { id: 'w1', rowId: 'watch', at: at(12, 40), label: '14 alertes', group: { count: 14 }, meta: { tone: 'yellow' } },
  { id: 'w2', rowId: 'watch', start: at(15), end: at(17), label: '38 alertes', group: { count: 38 }, meta: { tone: 'yellow' } },
  point('w3', 'watch', at(19, 30), 'Retour au calme', 'green'),
  span('c1', 'comms', at(9, 30), at(11), 'Embargo presse', 'purple'),
  point('c2', 'comms', at(15), 'Annonce publique', 'purple'),
  span('c3', 'comms', at(15, 30), at(18), 'Questions-réponses', 'purple'),
];

const keys: TimelineKey[] = [
  { id: 'k-freeze', at: at(9), label: 'Gel du code' },
  { id: 'k-prod', at: at(12), label: 'Mise en production' },
  { id: 'k-announce', at: at(15), label: 'Annonce publique' },
  { id: 'k-review', at: at(19), label: 'Bilan' },
];

const phases = [
  { from: at(7), label: 'Avant-lancement', text: 'Les équipes finalisent les maquettes et les correctifs.' },
  { from: at(9), label: 'Recette', text: 'Le code est gelé, la qualité valide la version 2.4.' },
  { from: at(12), label: 'Mise en production', text: 'Déploiement progressif : canari, puis 100 % du trafic.' },
  { from: at(15), label: 'Annonce', text: 'La presse publie, le trafic grimpe, la supervision veille.' },
  { from: at(19), label: 'Bilan', text: 'Correctif en ligne, alertes résorbées : on rejoue la journée.' },
] as const;

const clock = (time: number) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(time);
const phaseAt = (time: number) => [...phases].reverse().find((phase) => time >= phase.from) ?? phases[0];

function useNarrow() {
  const query = '(max-width: 640px)';
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return narrow;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function HeroTimeline() {
  const pageTheme = usePageTheme();
  // prepareTime is the synchronisation point: the application updates its own
  // state before the timeline confirms the new position.
  const [phase, setPhase] = useState<(typeof phases)[number]>(phases[0]);
  const prepareTime = useCallback((request: TimeRequest) => {
    setPhase(phaseAt(request.target));
  }, []);

  const controller = useTimelineController<RowInfo, ItemInfo>({
    mode: 'calendar',
    domain: { start: at(7), end: at(21) },
    rows,
    keys,
    source: items,
    expanded: ['product', 'infra'],
    speed: SPEED,
    loop: true,
    prepareTime,
  });
  const snapshot = useTimelineSnapshot(controller);
  const narrow = useNarrow();

  useEffect(() => {
    if (!reducedMotion()) controller.play();
  }, [controller]);

  const renderRowLabel = useCallback(
    (row: VisibleRow<RowInfo>) => (
      <span className="row-label">
        <i style={{ ['--swatch' as string]: `var(--${row.row.meta?.tone ?? 'blue'}-dot)` }} />
        {row.row.label}
      </span>
    ),
    [],
  );

  const active = items.filter((item) => (isSpan(item) ? snapshot.time >= item.start && snapshot.time < item.end : false)).length;

  return (
    <Box
      icon="📌"
      className="home-demo"
      title={
        <>
          <span className="repo-link">time-weave/lancement</span>
          <span className="home-demo__date">Jour de lancement · 18 novembre</span>
        </>
      }
      meta={<Pill tone="gray">boucle de 21 s</Pill>}
    >
      <Timeline
        controller={controller}
        theme={pageTheme}
        height={narrow ? 432 : 372}
        labelWidth={narrow ? 150 : 172}
        locale="fr-FR"
        labels={frenchLabels}
        rowsHeader="Équipes"
        toolbar={
          <PlaybackControls
            controller={controller}
            labels={frenchLabels}
            locale="fr-FR"
            speeds={[SPEED / 2, SPEED, SPEED * 2]}
            formatSpeed={(speed) => `${Math.round(speed / 60)} min/s`}
            formatTime={clock}
          />
        }
        formatTime={clock}
        renderRowLabel={renderRowLabel}
        getItemClassName={(item) => `tone-${item.meta?.tone ?? 'blue'}`}
      />
      <div className="home-demo__status" aria-live="polite">
        <span className="home-clock">{clock(snapshot.time)}</span>
        <div className="home-demo__phase">
          <strong>{phase.label}</strong>
          <span>{phase.text}</span>
        </div>
        <span className="counter">
          {active} période{active > 1 ? 's' : ''} en cours
        </span>
      </div>
    </Box>
  );
}

interface Example {
  readonly href: string;
  readonly slug: string;
  readonly tag: string;
  readonly title: string;
  readonly text: string;
  readonly pills: readonly (readonly [string, Tone])[];
  readonly lang: readonly [string, Tone];
  readonly facts: string;
}

const examples: readonly Example[] = [
  {
    href: './operations/index.html',
    slug: 'operations',
    tag: 'Exemple 01',
    title: 'Journée d’opérations — Station Nord',
    text: 'Rejeu, flux simulé, mode Direct, fenêtres chargées à la demande et regroupement selon le zoom.',
    pills: [
      ['direct', 'red'],
      ['fenêtré', 'blue'],
      ['prepareTime', 'green'],
    ],
    lang: ['calendaire', 'blue'],
    facts: '211 lignes · ≈ 90 000 messages',
  },
  {
    href: './history/index.html',
    slug: 'history',
    tag: 'Exemple 02',
    title: 'Soixante-quinze ans d’une entreprise',
    text: 'Périodes et jalons sur plusieurs décennies, contenu personnalisé et fenêtre de détail.',
    pills: [
      ['décennies', 'purple'],
      ['renderItem', 'yellow'],
      ['dialogue', 'gray'],
    ],
    lang: ['calendaire', 'blue'],
    facts: '7 lignes · 1950 → 2027',
  },
  {
    href: './relative/index.html',
    slug: 'relative',
    tag: 'Exemple 03',
    title: 'Banc d’essai — séquence de mise à feu',
    text: 'Une séquence de −2 s à 12 s à la milliseconde, phases, mesures et rafales regroupées.',
    pills: [
      ['milliseconde', 'green'],
      ['boucle', 'purple'],
      ['ralenti', 'yellow'],
    ],
    lang: ['relatif', 'green'],
    facts: '8 lignes · T−2 s → T+12 s',
  },
  {
    href: './surveillance/index.html',
    slug: 'surveillance',
    tag: 'Exemple 04',
    title: 'Surveillance de site — poste de nuit',
    text: 'Carte d’un terminal portuaire avec mobiles, caméras et mosaïque vidéo synchronisées sur la timeline, alarmes et flux en direct.',
    pills: [
      ['carte', 'blue'],
      ['vidéo', 'purple'],
      ['direct', 'red'],
    ],
    lang: ['calendaire', 'blue'],
    facts: '20:00 → 06:00 · 8 caméras · 6 mobiles',
  },
  {
    href: './bench/index.html',
    slug: 'bench',
    tag: 'Banc',
    title: 'Banc de performance',
    text: 'Des milliers d’éléments pour mesurer le rendu, le zoom et la lecture.',
    pills: [
      ['mesures', 'yellow'],
      ['5 000 éléments', 'gray'],
    ],
    lang: ['calendaire', 'blue'],
    facts: '211 lignes · 10 scénarios',
  },
];

const features = [
  { icon: '📏', label: 'Échelle', title: 'Des millisecondes aux décennies', text: 'Graduations calendaires ou relatives, adaptées à chaque niveau de zoom.' },
  { icon: '⏯️', label: 'Transport', title: 'Lecture, clés et boucle', text: 'Lecture à vitesse variable, navigation par moments clés, boucle sur la période.' },
  { icon: '🔗', label: 'Préparation', title: 'Synchronisation explicite', text: 'L’application prépare son état avant que la timeline confirme une position.' },
  { icon: '🔴', label: 'Direct', title: 'Mode Direct', text: 'Suit la frontière du temps réel et étend la période au fil de l’eau.' },
  { icon: '🗃️', label: 'Données', title: 'Collections dynamiques', text: 'Mises à jour atomiques en mémoire ou chargement par fenêtre visible.' },
  { icon: '♿', label: 'Accessibilité', title: 'Accessibilité clavier', text: 'Navigation au clavier, noms accessibles et respect du mouvement réduit.' },
] as const;

const stack: { label: string; pills: (readonly [string, Tone])[] }[] = [
  {
    label: 'Langages',
    pills: [
      ['typescript', 'blue'],
      ['react', 'blue'],
      ['css', 'purple'],
    ],
  },
  {
    label: 'Modes de temps',
    pills: [
      ['calendaire', 'blue'],
      ['relatif', 'green'],
      ['direct', 'red'],
    ],
  },
  {
    label: 'Outillage',
    pills: [
      ['vite', 'purple'],
      ['vitest', 'green'],
      ['playwright', 'yellow'],
    ],
  },
];

type TabId = 'apercu' | 'exemples' | 'fonctionnalites';

const tabs: { id: TabId; icon: string; label: string; count?: number }[] = [
  { id: 'apercu', icon: '📋', label: 'Aperçu' },
  { id: 'exemples', icon: '🗂️', label: 'Exemples', count: examples.length },
  { id: 'fonctionnalites', icon: '✨', label: 'Fonctionnalités', count: features.length },
];

const tabFromHash = (): TabId => {
  const hash = typeof location !== 'undefined' ? location.hash.slice(1) : '';
  return tabs.some((tab) => tab.id === hash) ? (hash as TabId) : 'apercu';
};

function RepoCard({ example, compact = false }: { example: Example; compact?: boolean }) {
  return (
    <a className={`repo-card${compact ? ' repo-card--compact' : ''}`} href={example.href}>
      <span className="repo-card__top">
        <span aria-hidden="true">📁</span>
        <span className="repo-link">time-weave/{example.slug}</span>
        <span className="visibility">{example.tag}</span>
      </span>
      <strong className="repo-card__title">{example.title}</strong>
      <span className="repo-card__text">{example.text}</span>
      {!compact && (
        <span className="pills">
          {example.pills.map(([label, tone]) => (
            <Pill key={label} tone={tone}>
              {label}
            </Pill>
          ))}
        </span>
      )}
      <span className="repo-card__meta">
        <span className="repo-card__lang">
          <i style={{ ['--swatch' as string]: `var(--${example.lang[1]}-dot)` }} aria-hidden="true" />
          {example.lang[0]}
        </span>
        <span>{example.facts}</span>
      </span>
    </a>
  );
}

function Sidebar() {
  return (
    <aside className="profile" aria-label="Le projet">
      <div className="profile__avatar">
        <span className="profile__ring">
          <Logo size={112} />
        </span>
        <StatusPill>Démo en direct</StatusPill>
      </div>
      <h1 className="profile__name">time-weave</h1>
      <p className="profile__handle">@time-weave/react</p>
      <p className="profile__title">Timelines interactives pour React</p>
      <p className="profile__subtitle">Calendaire · Relatif · Direct · Accessible</p>
      <p className="profile__bio">Des timelines interactives qui restent synchronisées avec votre application.</p>
      <div className="profile__buttons">
        <a className="btn btn--primary" href="./operations/index.html">
          Ouvrir la démo
        </a>
        <a className="btn" href={REPOSITORY}>
          Code source
        </a>
      </div>
      <ul className="profile__meta">
        <li>
          <span aria-hidden="true">📦</span>Version 0.1.0 · non publiée
        </li>
        <li>
          <span aria-hidden="true">⚛️</span>React 18.3 et 19
        </li>
        <li>
          <span aria-hidden="true">🧩</span>TypeScript strict, sans dépendance
        </li>
        <li>
          <span aria-hidden="true">🌍</span>Libellés français et anglais
        </li>
        <li>
          <span aria-hidden="true">⚖️</span>Licence MIT
        </li>
      </ul>
      <section className="profile__section">
        <h2 className="profile__label">Stack</h2>
        {stack.map((group) => (
          <div key={group.label} className="profile__group">
            <p className="eyebrow">{group.label}</p>
            <p className="pills">
              {group.pills.map(([label, tone]) => (
                <Pill key={label} tone={tone}>
                  {label}
                </Pill>
              ))}
            </p>
          </div>
        ))}
      </section>
    </aside>
  );
}

function App() {
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (id: TabId, focus = false) => {
    setTab(id);
    history.replaceState(null, '', id === 'apercu' ? location.pathname + location.search : `#${id}`);
    if (focus) document.getElementById(`tab-${id}`)?.focus();
  };

  const onTabKey = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((entry) => entry.id === tab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    select(tabs[next]!.id, true);
  };

  return (
    <>
      <TopBar current="home" root="./" />
      <div className="home">
        <Sidebar />

        <main className="home-main">
          <h2 className="section-title">
            <span aria-hidden="true">👤</span> À propos
          </h2>
          <div className="about">
            <p>
              <strong>Time Weave</strong> est une bibliothèque React pour afficher des lignes hiérarchiques d’éléments dans le temps — périodes,
              instants, groupes — et les rejouer. Sa particularité : la timeline ne confirme une position qu’une fois l’application prête,
              grâce à <code>prepareTime</code>. Le même moteur couvre une séquence à la milliseconde, une journée d’opérations en direct ou
              trois quarts de siècle d’histoire.
            </p>
          </div>

          <div className="tabs" role="tablist" aria-label="Contenu" onKeyDown={onTabKey}>
            {tabs.map((entry) => (
              <button
                key={entry.id}
                id={`tab-${entry.id}`}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === entry.id}
                aria-controls={`panel-${entry.id}`}
                tabIndex={tab === entry.id ? 0 : -1}
                onClick={() => select(entry.id)}
              >
                <span aria-hidden="true">{entry.icon}</span>
                {entry.label}
                {entry.count !== undefined && <span className="counter">{entry.count}</span>}
              </button>
            ))}
          </div>

          {tab === 'apercu' && (
            <div id="panel-apercu" role="tabpanel" aria-labelledby="tab-apercu" className="tab-panel">
              <HeroTimeline />
              <h2 className="section-title">
                <span aria-hidden="true">📌</span> Exemples épinglés
              </h2>
              <div className="pinned">
                {examples.slice(0, 4).map((example) => (
                  <RepoCard key={example.slug} example={example} compact />
                ))}
              </div>
            </div>
          )}

          {tab === 'exemples' && (
            <div id="panel-exemples" role="tabpanel" aria-labelledby="tab-exemples" className="tab-panel">
              <h2 className="section-title">
                <span aria-hidden="true">🗂️</span> Trois applications, un même moteur
              </h2>
              <div className="repo-list">
                {examples.map((example) => (
                  <RepoCard key={example.slug} example={example} />
                ))}
              </div>
            </div>
          )}

          {tab === 'fonctionnalites' && (
            <div id="panel-fonctionnalites" role="tabpanel" aria-labelledby="tab-fonctionnalites" className="tab-panel">
              <h2 className="section-title">
                <span aria-hidden="true">✨</span> Ce que la bibliothèque prend en charge
              </h2>
              <div className="features">
                {features.map((feature) => (
                  <article key={feature.title} className="feature">
                    <p className="feature__label">
                      <span aria-hidden="true">{feature.icon}</span>
                      {feature.label}
                    </p>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      <footer className="home-footer">
        <Logo size={16} />
        <span>time-weave</span>
        <span>TypeScript · React · version 0.1.0 non publiée</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
