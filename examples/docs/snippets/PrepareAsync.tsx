import { useState } from 'react';
import { PlaybackControls, Timeline, frenchLabels, useTimelineController, useTimelineSelector } from '@time-weave/react';
import { usePageTheme } from '../../theme'; // docs:hide
import type { TimeRequest, TimelineItem } from '@time-weave/react';

const debut = Date.UTC(2026, 9, 18, 8);
const min = 60_000;
const items: TimelineItem[] = [
  { id: 'a', rowId: 'carte', start: debut + 10 * min, end: debut + 40 * min, label: 'Tournée A' },
  { id: 'b', rowId: 'carte', start: debut + 70 * min, end: debut + 110 * min, label: 'Tournée B' },
];

// Simule un travail de l’application (requête, rendu d’une carte…) annulable.
function attendre(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}

export function PrepareAsync() {
  const [etat, setEtat] = useState('aucun');
  const controller = useTimelineController({
    domain: { start: debut, end: debut + 2 * 60 * min },
    rows: [{ id: 'carte', label: 'Carte' }],
    keys: [{ id: 'b', at: debut + 70 * min, label: 'Tournée B' }],
    source: items,
    speed: 600,
    prepareTime: async (request: TimeRequest) => {
      await attendre(600, request.signal); // rejette si une autre destination remplace celle-ci
      await controller.waitForData(request.target, request.signal); // données couvrant la cible
      if (!request.isCurrent()) return; // résultat périmé : ne rien appliquer
      setEtat(new Date(request.target).toISOString().slice(11, 16));
    },
  });

  // Instant confirmé (curseur plein) et cible en attente (curseur pointillé).
  const confirme = useTimelineSelector(controller, (s) => s.time);
  const cible = useTimelineSelector(controller, (s) => s.pending?.target ?? null);
  const heure = (t: number) => new Date(t).toISOString().slice(11, 16);

  return (
    <>
      <p className="etat">
        Confirmé : <b>{heure(confirme)}</b> · En attente : <b>{cible === null ? '—' : heure(cible)}</b> · Carte affichée à : <b>{etat}</b>
      </p>
      <Timeline
        controller={controller}
        theme={usePageTheme()} // docs:hide
        height={170}
        locale="fr-FR"
        labels={frenchLabels}
        showZoomControls={false}
        toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" showLoop={false} speeds={[600]} />}
      />
    </>
  );
}
