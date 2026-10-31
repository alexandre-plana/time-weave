/** Texts used by the components. Every entry can be replaced. */
export interface TimelineLabels {
  timeline: string;
  rows: string;
  cursor: string;
  /** Keyboard help linked to the cursor slider (key markers are reached with Page Up / Page Down). */
  cursorHelp: string;
  zoomIn: string;
  zoomOut: string;
  zoomFit: string;
  expandRow: (label: string) => string;
  collapseRow: (label: string) => string;
  key: (label: string, time: string) => string;
  group: (count: number) => string;
  preparing: (time: string) => string;
  initializing: string;
  preparationError: (time: string) => string;
  dataLoading: string;
  dataError: string;
  liveFrontier: string;
  play: string;
  pause: string;
  stop: string;
  previousKey: string;
  nextKey: string;
  speed: string;
  loop: string;
  live: string;
  retry: string;
  close: string;
  details: string;
  start: string;
  end: string;
  duration: string;
}

export const defaultLabels: TimelineLabels = {
  timeline: 'Timeline',
  rows: 'Rows',
  cursor: 'Current time',
  cursorHelp: 'Arrow keys move the time, Page Up and Page Down jump to the previous or next key, plus and minus zoom.',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomFit: 'Show the whole period',
  expandRow: (label) => `Expand ${label}`,
  collapseRow: (label) => `Collapse ${label}`,
  key: (label, time) => `Key ${label}, ${time}`,
  group: (count) => `Group of ${count}`,
  preparing: (time) => `Preparing ${time}…`,
  initializing: 'Synchronising…',
  preparationError: (time) => `Could not prepare ${time}`,
  dataLoading: 'Loading data…',
  dataError: 'Data could not be loaded',
  liveFrontier: 'Live frontier',
  play: 'Play',
  pause: 'Pause',
  stop: 'Stop',
  previousKey: 'Previous key',
  nextKey: 'Next key',
  speed: 'Speed',
  loop: 'Loop',
  live: 'Live',
  retry: 'Retry',
  close: 'Close',
  details: 'Details',
  start: 'Start',
  end: 'End',
  duration: 'Duration',
};

export const frenchLabels: TimelineLabels = {
  timeline: 'Timeline',
  rows: 'Lignes',
  cursor: 'Temps courant',
  cursorHelp: 'Les flèches déplacent le temps, Page précédente et Page suivante sautent à la clé précédente ou suivante, plus et moins zooment.',
  zoomIn: 'Zoomer',
  zoomOut: 'Dézoomer',
  zoomFit: 'Afficher toute la période',
  expandRow: (label) => `Déplier ${label}`,
  collapseRow: (label) => `Replier ${label}`,
  key: (label, time) => `Clé ${label}, ${time}`,
  group: (count) => `Groupe de ${count}`,
  preparing: (time) => `Préparation de ${time}…`,
  initializing: 'Synchronisation…',
  preparationError: (time) => `Échec de la préparation de ${time}`,
  dataLoading: 'Chargement des données…',
  dataError: 'Les données n’ont pas pu être chargées',
  liveFrontier: 'Frontière du direct',
  play: 'Lecture',
  pause: 'Pause',
  stop: 'Stop',
  previousKey: 'Clé précédente',
  nextKey: 'Clé suivante',
  speed: 'Vitesse',
  loop: 'Boucle',
  live: 'Direct',
  retry: 'Réessayer',
  close: 'Fermer',
  details: 'Détails',
  start: 'Début',
  end: 'Fin',
  duration: 'Durée',
};
