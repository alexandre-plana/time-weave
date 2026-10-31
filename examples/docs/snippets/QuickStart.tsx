import { PlaybackControls, Timeline, frenchLabels, useTimelineController } from '@time-weave/react';
import { usePageTheme } from '../../theme'; // docs:hide
import type { TimelineItem, TimelineKey, TimelineRow } from '@time-weave/react';
import '@time-weave/react/styles.css';

// Les temps sont des millisecondes : ici, des timestamps UTC.
const jour = Date.UTC(2026, 9, 18);
const h = (heures: number, minutes = 0) => jour + (heures * 60 + minutes) * 60_000;

const rows: TimelineRow[] = [
  { id: 'station', label: 'Station Nord' },
  { id: 'reseau', label: 'Réseau', parentId: 'station' },
  { id: 'capteurs', label: 'Capteurs', parentId: 'station' },
];

const items: TimelineItem[] = [
  { id: 'maintenance', rowId: 'station', start: h(8), end: h(11), label: 'Maintenance' },
  { id: 'coupure', rowId: 'reseau', start: h(9, 30), end: h(10, 15), label: 'Coupure' },
  { id: 'alerte', rowId: 'capteurs', at: h(9, 40), label: 'Alerte' },
  { id: 'mesures', rowId: 'capteurs', start: h(12), end: h(15), label: '42 mesures', group: { count: 42 } },
];

const keys: TimelineKey[] = [
  { id: 'debut', at: h(8), label: 'Début de maintenance' },
  { id: 'retour', at: h(11), label: 'Retour en service' },
];

export function QuickStart() {
  // Une instance stable par composant ; les options sont lues une seule fois.
  const controller = useTimelineController({
    mode: 'calendar',
    domain: { start: h(6), end: h(18) },
    rows,
    keys,
    source: items,
    expanded: ['station'],
    speed: 600, // 10 minutes par seconde
  });

  return (
    <Timeline
      controller={controller}
      theme={usePageTheme()} // docs:hide
      height={250}
      locale="fr-FR"
      labels={frenchLabels}
      toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" speeds={[60, 600, 1800]} />}
    />
  );
}
