import { useEffect } from 'react';
import { PlaybackControls, Timeline, frenchLabels, useTimelineController } from '@time-weave/react';
import type { TimelineItem } from '@time-weave/react';

interface Message {
  readonly id: string;
  readonly source: string;
  readonly date: number;
  readonly texte: string;
}

export function Surveillance({ sources }: { sources: readonly { id: string; nom: string }[] }) {
  const controller = useTimelineController({
    domain: { start: Date.now() - 3_600_000, end: Date.now() },
    rows: sources.map((s) => ({ id: s.id, label: s.nom })),
    source: [],
  });

  useEffect(() => {
    controller.goLive();
    const socket = new WebSocket('wss://exemple.fr/flux');
    socket.addEventListener('message', (event) => {
      const messages: Message[] = JSON.parse(String(event.data));
      const items: TimelineItem[] = messages.map((m) => ({ id: m.id, rowId: m.source, at: m.date, label: m.texte }));
      controller.update({ items: { upsert: items } });
      // extendDomain ne recule jamais (une fin plus petite lève une erreur) : prendre le maximum.
      const fin = Math.max(controller.getSnapshot().domain.end, ...messages.map((m) => m.date));
      controller.extendDomain(fin); // période et frontière du direct suivent le flux
    });
    // Le temps passe même sans message : la frontière avance chaque seconde.
    const horloge = setInterval(() => controller.extendDomain(Math.max(Date.now(), controller.getSnapshot().domain.end)), 1000);
    return () => {
      socket.close();
      clearInterval(horloge);
    };
  }, [controller]);

  return (
    <Timeline
      controller={controller}
      labels={frenchLabels}
      locale="fr-FR"
      toolbar={<PlaybackControls controller={controller} labels={frenchLabels} showLive />}
    />
  );
}
