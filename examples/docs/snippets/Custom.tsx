import type { CSSProperties } from 'react';
import { Timeline, frenchLabels, useTimelineController } from '@time-weave/react';
import type { TimelineItem, TimelineRow, VisibleRow } from '@time-weave/react';

interface Tache {
  readonly avancement: number; // 0 à 1
  readonly bloquee?: boolean;
}

const lundi = Date.UTC(2026, 9, 19);
const jour = 86_400_000;
const rows: TimelineRow<{ couleur: string }>[] = [
  { id: 'design', label: 'Design', meta: { couleur: '#8250df' } },
  { id: 'dev', label: 'Développement', meta: { couleur: '#0969da' } },
];
const items: TimelineItem<Tache>[] = [
  { id: 't1', rowId: 'design', start: lundi, end: lundi + 2 * jour, label: 'Maquettes', meta: { avancement: 1 } },
  { id: 't2', rowId: 'dev', start: lundi + jour, end: lundi + 4 * jour, label: 'API', meta: { avancement: 0.6 } },
  { id: 't3', rowId: 'dev', start: lundi + 4 * jour, end: lundi + 6 * jour, label: 'Interface', meta: { avancement: 0.1, bloquee: true } },
];

export function Planning() {
  const controller = useTimelineController<{ couleur: string }, Tache>({
    domain: { start: lundi, end: lundi + 7 * jour },
    rows,
    source: items,
  });

  return (
    <Timeline
      controller={controller}
      className="planning"
      height={150}
      locale="fr-FR"
      labels={frenchLabels}
      // Variables CSS --tw-* : directement sur l’élément ou dans une feuille de style.
      style={{ '--tw-accent': '#1a7f37', '--tw-point': '#1a7f37' } as CSSProperties}
      // Une classe par élément, pour des tons ou des états.
      getItemClassName={(item) => (item.meta?.bloquee ? 'tache-bloquee' : undefined)}
      // Le contenu de l’élément : il doit tenir dans context.width.
      renderItem={(item, context) => (
        <span className="tache">
          <span className="tache__barre" style={{ width: `${(item.meta?.avancement ?? 0) * 100}%` }} />
          {context.width > 60 && <span className="tache__texte">{item.label} · {Math.round((item.meta?.avancement ?? 0) * 100)} %</span>}
        </span>
      )}
      // Le nom accessible contient le texte visible (WCAG 2.5.3).
      getItemAriaLabel={(item) => `${item.label} · ${Math.round((item.meta?.avancement ?? 0) * 100)} %${item.meta?.bloquee ? ', bloquée' : ''}`}
      renderRowLabel={(row: VisibleRow<{ couleur: string }>) => (
        <span className="ligne">
          <i style={{ background: row.row.meta?.couleur }} />
          {row.row.label}
        </span>
      )}
    />
  );
}
