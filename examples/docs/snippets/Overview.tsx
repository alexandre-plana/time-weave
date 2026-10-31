import { PlaybackControls, Timeline, TimelineOverview, frenchLabels, useTimelineController } from '@time-weave/react';
import type { TimelineHighlight, TimelineItem } from '@time-weave/react';

const lundi = Date.UTC(2026, 9, 19);
const heure = 3_600_000;
const jour = 24 * heure;

// Une semaine de déploiements : un point toutes les 3 h environ.
const items: TimelineItem[] = Array.from({ length: 56 }, (_, i) => ({
  id: `d${i}`,
  rowId: i % 2 ? 'api' : 'web',
  at: lundi + i * 3 * heure + (i % 5) * 1_200_000,
  label: `Déploiement ${i + 1}`,
}));

// Bandes de fond sur toutes les lignes : incident, maintenance, heures ouvrées…
const highlights: TimelineHighlight[] = [
  { id: 'incident', start: lundi + jour + 9 * heure, end: lundi + jour + 15 * heure, label: 'Incident', tone: 'danger' },
  { id: 'gel', start: lundi + 4 * jour, end: lundi + 5 * jour + 12 * heure, label: 'Gel des versions', tone: 'warning' },
];

export function Semaine({ theme = 'auto' }: { theme?: 'light' | 'dark' | 'auto' }) {
  const controller = useTimelineController({
    domain: { start: lundi, end: lundi + 7 * jour },
    viewport: { start: lundi, end: lundi + 2 * jour },
    rows: [
      { id: 'web', label: 'Front web' },
      { id: 'api', label: 'API' },
    ],
    source: items,
    speed: 7_200,
  });

  return (
    <>
      <Timeline
        controller={controller}
        theme={theme}
        height={190}
        locale="fr-FR"
        labels={frenchLabels}
        highlights={highlights}
        toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" speeds={[3_600, 7_200, 14_400]} />}
      />
      {/* Toute la période : densité, clés, curseur et fenêtre visible déplaçable. */}
      <TimelineOverview controller={controller} labels={frenchLabels} locale="fr-FR" height={44} />
    </>
  );
}
