import { StrictMode, useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaybackControls, Timeline, frenchLabels, isSpan, useTimelineController, useTimelineSnapshot } from '@time-weave/react';
import type { TimeRequest, TimelineItem, TimelineKey, TimelineRow, VisibleRow } from '@time-weave/react';
import '@time-weave/react/styles.css';
import '../shared.css';
import './home.css';

type Tone = 'blue' | 'green' | 'amber' | 'purple';

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
  { id: 'infra', label: 'Infrastructure', meta: { tone: 'amber' } },
  { id: 'deploy', label: 'Déploiement', parentId: 'infra', meta: { tone: 'blue' } },
  { id: 'watch', label: 'Supervision', parentId: 'infra', meta: { tone: 'amber' } },
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
  span('i1', 'infra', at(11, 30), at(14, 30), 'Fenêtre de déploiement', 'amber'),
  span('e1', 'deploy', at(12), at(13), 'Canari 5 %', 'blue'),
  span('e2', 'deploy', at(13), at(14, 30), 'Trafic 100 %', 'blue'),
  point('e3', 'deploy', at(18, 10), 'Correctif en ligne', 'blue'),
  { id: 'w1', rowId: 'watch', at: at(12, 40), label: '14 alertes', group: { count: 14 }, meta: { tone: 'amber' } },
  { id: 'w2', rowId: 'watch', start: at(15), end: at(17), label: '38 alertes', group: { count: 38 }, meta: { tone: 'amber' } },
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
      <span className="home-row">
        <i data-tone={row.row.meta?.tone} />
        {row.row.label}
      </span>
    ),
    [],
  );

  const active = items.filter((item) => (isSpan(item) ? snapshot.time >= item.start && snapshot.time < item.end : false)).length;

  return (
    <div className="home-demo">
      <div className="home-demo__bar">
        <span className="home-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="home-demo__title">Jour de lancement · 18 novembre</span>
        <span className="home-chip home-chip--live">Démo en direct</span>
      </div>
      <Timeline
        controller={controller}
        height={narrow ? 432 : 372}
        labelWidth={180}
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
        getItemClassName={(item) => `home-tone--${item.meta?.tone ?? 'blue'}`}
      />
      <div className="home-demo__status" aria-live="polite">
        <span className="home-clock">{clock(snapshot.time)}</span>
        <div className="home-demo__phase">
          <strong>{phase.label}</strong>
          <span>{phase.text}</span>
        </div>
        <span className="home-chip">
          {active} période{active > 1 ? 's' : ''} en cours
        </span>
      </div>
    </div>
  );
}

const examples = [
  {
    href: './operations/index.html',
    tag: 'Exemple 01',
    tone: 'blue',
    title: 'Journée d’opérations',
    text: 'Rejeu, flux simulé, mode Direct, fenêtres chargées à la demande et groupes.',
  },
  {
    href: './history/index.html',
    tag: 'Exemple 02',
    tone: 'purple',
    title: 'Histoire d’entreprise',
    text: 'Soixante-quinze ans de périodes et de jalons, avec contenu personnalisé.',
  },
  {
    href: './relative/index.html',
    tag: 'Exemple 03',
    tone: 'green',
    title: 'Temps relatif',
    text: 'Une séquence de −2 s à 12 s à la milliseconde, phases et rafales regroupées.',
  },
  {
    href: './bench/index.html',
    tag: 'Banc',
    tone: 'amber',
    title: 'Banc de performance',
    text: 'Des milliers d’éléments pour mesurer le rendu, le zoom et la lecture.',
  },
] as const;

const features = [
  { tone: 'blue', label: 'Échelle', title: 'Des millisecondes aux décennies', text: 'Graduations calendaires ou relatives, adaptées à chaque niveau de zoom.' },
  { tone: 'purple', label: 'Transport', title: 'Lecture, clés et boucle', text: 'Lecture à vitesse variable, navigation par moments clés, boucle sur la période.' },
  { tone: 'green', label: 'prepareTime', title: 'Synchronisation explicite', text: 'L’application prépare son état avant que la timeline confirme une position.' },
  { tone: 'amber', label: 'Direct', title: 'Mode Direct', text: 'Suit la frontière du temps réel et étend la période au fil de l’eau.' },
  { tone: 'blue', label: 'Données', title: 'Collections dynamiques', text: 'Mises à jour atomiques en mémoire ou chargement par fenêtre visible.' },
  { tone: 'green', label: 'A11y', title: 'Accessibilité clavier', text: 'Navigation au clavier, noms accessibles et respect du mouvement réduit.' },
] as const;

function App() {
  return (
    <div className="home">
      <header className="home-nav">
        <a className="home-brand" href="./index.html">
          <span className="home-logo" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          Time Weave
        </a>
        <nav aria-label="Sections">
          <a href="#exemples">Exemples</a>
          <a href="#fonctionnalites">Fonctionnalités</a>
        </nav>
      </header>

      <main>
        <section className="home-hero">
          <p className="eyebrow">Bibliothèque React · TypeScript</p>
          <h1>Time Weave</h1>
          <p className="home-tagline">Des timelines interactives qui restent synchronisées avec votre application.</p>
          <div className="home-cta">
            <a className="home-button home-button--primary" href="#exemples">
              Voir les exemples
            </a>
            <a className="home-button" href="./operations/index.html">
              Ouvrir la démo d’opérations
            </a>
          </div>
          <HeroTimeline />
        </section>

        <section id="exemples" className="home-section">
          <div className="home-section__head">
            <p className="eyebrow">Exemples</p>
            <h2>Trois applications, un même moteur</h2>
          </div>
          <div className="home-cards">
            {examples.map((example) => (
              <a key={example.href} className="home-card" href={example.href}>
                <span className={`home-pill home-pill--${example.tone}`}>{example.tag}</span>
                <strong>{example.title}</strong>
                <span className="home-card__text">{example.text}</span>
                <span className="home-card__go" aria-hidden="true">
                  Ouvrir →
                </span>
              </a>
            ))}
          </div>
        </section>

        <section id="fonctionnalites" className="home-section">
          <div className="home-section__head">
            <p className="eyebrow">Fonctionnalités</p>
            <h2>Ce que la bibliothèque prend en charge</h2>
          </div>
          <div className="home-features">
            {features.map((feature) => (
              <article key={feature.title} className="home-feature">
                <span className={`home-pill home-pill--${feature.tone}`}>{feature.label}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <span>Time Weave</span>
        <span>TypeScript · React · version 0.1.0 non publiée</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
