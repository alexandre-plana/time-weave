import { formatTimeReadout } from '@time-weave/react';
import type { TimelineControllerOptions } from '@time-weave/react';

// Calendrier : timestamps Unix en millisecondes. L’application convertit ses dates.
export const calendrier: TimelineControllerOptions = {
  mode: 'calendar',
  domain: { start: Date.parse('2026-10-18T00:00:00Z'), end: Date.parse('2026-10-19T00:00:00Z') }, // période complète
  viewport: { start: Date.parse('2026-10-18T06:00:00Z'), end: Date.parse('2026-10-18T12:00:00Z') }, // fenêtre visible
  initialTime: Date.parse('2026-10-18T08:00:00Z'),
};

// Relatif : positions depuis une origine choisie (T0) ; les valeurs négatives sont permises.
export const relatif: TimelineControllerOptions = {
  mode: 'relative',
  domain: { start: -4_000, end: 12_000 },
  initialTime: -2_000,
  minViewportDuration: 100,
  rows: [
    { id: 'sequence', label: 'Séquence' },
    { id: 'moteurs', label: 'Moteurs', parentId: 'sequence' },
  ],
  keys: [{ id: 't0', at: 0, label: 'T0' }],
  source: [
    { id: 'decompte', rowId: 'sequence', start: -4_000, end: 0, label: 'Décompte' },
    { id: 'allumage', rowId: 'moteurs', at: -1_500, label: 'Allumage' },
    { id: 'poussee', rowId: 'moteurs', start: 0, end: 9_000, label: 'Poussée' },
  ],
  expanded: ['sequence'],
};

formatTimeReadout(-1_500, 'relative'); // « −00:00:01.500 »
formatTimeReadout(Date.parse('2026-10-18T08:00:00Z'), 'calendar', 'fr-FR'); // « 18 oct. 2026 08:00:00.000 UTC »

// Un format à vous, passé en formatTime à Timeline et PlaybackControls : « T+00:00:02.500 ».
export const formatT = (temps: number) => `T${temps < 0 ? '' : '+'}${formatTimeReadout(temps, 'relative')}`;
