import { useRef } from 'react';
import { shallowEqual, useTimelineSelector, useTimelineSnapshot } from '@time-weave/react';
import type { TimelineController } from '@time-weave/react';

// Rend à chaque image de lecture (≈ 60 fois par seconde).
export function AvecSnapshot({ controller }: { controller: TimelineController }) {
  const rendus = useRef(0);
  rendus.current += 1;
  const snapshot = useTimelineSnapshot(controller);
  return <p>{snapshot.transport} · {rendus.current} rendus</p>;
}

// Rend seulement quand la valeur choisie change.
export function AvecSelecteur({ controller }: { controller: TimelineController }) {
  const rendus = useRef(0);
  rendus.current += 1;
  // Une valeur simple : comparée avec Object.is.
  const secondes = useTimelineSelector(controller, (s) => Math.floor((s.time - s.domain.start) / 60_000));
  // Un objet construit par le sélecteur : comparer avec shallowEqual.
  const { transport, status } = useTimelineSelector(controller, (s) => ({ transport: s.transport, status: s.status }), shallowEqual);
  return <p>{transport} · {status} · minute {secondes} · {rendus.current} rendus</p>;
}
