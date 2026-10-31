import { useEffect } from 'react';
import { Timeline, useTimelineController, useTimelineSelector } from '@time-weave/react';
import type { TimelineItem, TimelineRow, WindowRequest } from '@time-weave/react';

interface Agregat {
  readonly capteur: string;
  readonly debut: number;
  readonly fin: number;
  readonly nombre: number;
}

// Pas de regroupement côté serveur selon le zoom : choisi par l’application.
const pasPour = (duree: number) => (duree > 86_400_000 ? 3_600_000 : duree > 3_600_000 ? 300_000 : 0);

async function charger(request: WindowRequest) {
  const { start, end } = request.range;
  const pas = pasPour(request.visible.end - request.visible.start);
  const url = `/api/mesures?du=${start}&au=${end}&pas=${pas}`;
  const reponse = await fetch(url, { signal: request.signal });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  const agregats: Agregat[] = await reponse.json();
  const items: TimelineItem[] = agregats.map((a) =>
    a.nombre === 1
      ? { id: `${a.capteur}:${a.debut}`, rowId: a.capteur, at: a.debut }
      : { id: `${a.capteur}:${a.debut}:${pas}`, rowId: a.capteur, start: a.debut, end: a.fin, group: { count: a.nombre } },
  );
  return { range: request.range, items };
}

export function Mesures({ capteurs, debut, fin }: { capteurs: TimelineRow[]; debut: number; fin: number }) {
  const controller = useTimelineController({
    domain: { start: debut, end: fin },
    rows: capteurs,
    source: { kind: 'windowed', load: charger },
    windowMargin: 0.5, // précharge une demi-fenêtre de chaque côté
  });

  // Quand le pas de regroupement change avec le zoom, redemander la fenêtre.
  const pas = useTimelineSelector(controller, (s) => pasPour(s.viewport.end - s.viewport.start));
  useEffect(() => controller.refresh(), [controller, pas]);

  return <Timeline controller={controller} height={360} />;
}
