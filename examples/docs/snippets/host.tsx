import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Timeline, createAnimationFrameScheduler, createTimelineController, useTimelineHost } from '@time-weave/react';
import type { TimelineController } from '@time-weave/react';

// L’application possède l’instance : elle la crée et la détruit elle-même.
const TimelineContext = createContext<TimelineController | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const [controller] = useState(() =>
    createTimelineController({
      domain: { start: 0, end: 60_000 },
      mode: 'relative',
      scheduler: createAnimationFrameScheduler(), // useTimelineHost ne remplace pas l’ordonnanceur
    }),
  );
  // Démarrage, suspension quand la page est masquée, préférence de mouvement réduit.
  useTimelineHost(controller, { respectReducedMotion: true });
  // Les hooks ne détruisent jamais l’instance : son propriétaire le fait.
  useEffect(() => () => controller.dispose(), [controller]);
  return <TimelineContext.Provider value={controller}>{children}</TimelineContext.Provider>;
}

export function useSharedTimeline(): TimelineController {
  const controller = useContext(TimelineContext);
  if (!controller) throw new Error('TimelineProvider manquant');
  return controller;
}

export function Vue() {
  return <Timeline controller={useSharedTimeline()} />;
}
