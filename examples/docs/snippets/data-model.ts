import { TimelineValidationError } from '@time-weave/react';
import type { TimelineController, TimelineItem, TimelineKey, TimelineRow } from '@time-weave/react';

// Les métadonnées sont libres et typées par l’application.
interface InfoLigne {
  readonly type: 'site' | 'equipement';
}
interface InfoElement {
  readonly gravite: 'info' | 'alerte';
}

const t0 = Date.UTC(2026, 9, 18, 8);
const min = 60_000;

// Lignes : une hiérarchie par parentId (la racine n’en a pas).
export const rows: TimelineRow<InfoLigne>[] = [
  { id: 'site', label: 'Site de Lyon', meta: { type: 'site' } },
  { id: 'pompe', label: 'Pompe P1', parentId: 'site', meta: { type: 'equipement' } },
  { id: 'vanne', label: 'Vanne V2', parentId: 'site', meta: { type: 'equipement' } },
];

export const items: TimelineItem<InfoElement>[] = [
  // Point : un instant (at).
  { id: 'demarrage', rowId: 'pompe', at: t0 + 10 * min, label: 'Démarrage', meta: { gravite: 'info' } },
  // Période : de start inclus à end EXCLU.
  { id: 'cycle', rowId: 'pompe', start: t0 + 20 * min, end: t0 + 50 * min, label: 'Cycle', meta: { gravite: 'info' } },
  // Groupe : un point ou une période qui résume plusieurs sources, fourni par l’application.
  { id: 'alertes', rowId: 'vanne', start: t0 + 30 * min, end: t0 + 45 * min, label: '12 alertes', group: { count: 12 }, meta: { gravite: 'alerte' } },
  // Le parent affiche seulement ce qu’on lui donne : la bibliothèque ne regroupe rien.
  { id: 'synthese', rowId: 'site', start: t0, end: t0 + 60 * min, label: 'Journée normale', meta: { gravite: 'info' } },
];

// Clés : des instants remarquables, atteints par « clé précédente / suivante ».
export const keys: TimelineKey[] = [
  { id: 'k1', at: t0 + 20 * min, label: 'Début du cycle' },
  { id: 'k2', at: t0 + 30 * min, label: 'Première alerte' },
];

// Des données invalides lèvent une TimelineValidationError ; le dernier état valide est conservé.
export function ajouter(controller: TimelineController<InfoLigne, InfoElement>, element: TimelineItem<InfoElement>) {
  try {
    controller.update({ items: { upsert: [element] } });
  } catch (error) {
    if (error instanceof TimelineValidationError) {
      for (const issue of error.issues) console.warn(issue.code, issue.message);
    } else throw error;
  }
}
