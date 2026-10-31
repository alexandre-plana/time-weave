import { shallowEqual, useTimelineSelector } from '@time-weave/react';
import type { TimelineController } from '@time-weave/react';

const libelles = { paused: 'En pause', playing: 'Lecture', live: 'Direct' } as const;

// Barre d’état : un rendu quand transport, statut, chargement ou minute changent — jamais par image.
export function BarreEtat({ controller }: { controller: TimelineController }) {
  const etat = useTimelineSelector(
    controller,
    (s) => ({
      transport: s.transport,
      preparation: s.status === 'preparing',
      chargement: s.data.loading,
      erreur: s.error !== null,
      minute: Math.floor(s.time / 60_000),
    }),
    shallowEqual,
  );
  return (
    <div role="status">
      {libelles[etat.transport]}
      {etat.preparation && ' · préparation…'}
      {etat.chargement && ' · chargement…'}
      {etat.erreur && (
        <button type="button" onClick={() => controller.retry()}>
          Réessayer
        </button>
      )}
      {' · '}
      {new Date(etat.minute * 60_000).toISOString().slice(11, 16)}
    </div>
  );
}
