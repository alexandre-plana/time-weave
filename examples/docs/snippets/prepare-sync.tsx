import { useState } from 'react';
import { Timeline, useTimelineController } from '@time-weave/react';
import type { TimeRequest, TimelineItem } from '@time-weave/react';

const debut = Date.UTC(2026, 9, 18, 8);
const mesures: TimelineItem[] = [
  { id: 'm1', rowId: 'capteur', at: debut + 5 * 60_000, label: '12 °C' },
  { id: 'm2', rowId: 'capteur', at: debut + 25 * 60_000, label: '14 °C' },
];

// État de l’application à un instant : calcul rapide et synchrone.
function temperatureA(temps: number): string {
  const derniere = mesures.filter((m) => 'at' in m && m.at <= temps).at(-1);
  return derniere?.label ?? '—';
}

export function Synchrone() {
  const [temperature, setTemperature] = useState('—');
  const controller = useTimelineController({
    domain: { start: debut, end: debut + 3_600_000 },
    rows: [{ id: 'capteur', label: 'Capteur' }],
    source: mesures,
    // Retour immédiat (pas de promesse) : la position est confirmée tout de suite.
    prepareTime: (request: TimeRequest) => {
      setTemperature(temperatureA(request.target));
    },
  });
  return (
    <>
      <p>Température : {temperature}</p>
      <Timeline controller={controller} height={160} />
    </>
  );
}
