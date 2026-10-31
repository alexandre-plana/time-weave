import { defaultLabels, frenchLabels } from '@time-weave/react';
import type { TimelineLabels } from '@time-weave/react';

// Textes anglais par défaut (defaultLabels) ou français (frenchLabels) ; chaque entrée est remplaçable.
export const libelles: Partial<TimelineLabels> = {
  ...frenchLabels,
  rows: 'Équipements',
  live: 'Temps réel',
  group: (count) => `${count} événements`,
};

export const english: TimelineLabels = defaultLabels;
