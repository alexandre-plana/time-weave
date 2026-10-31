import { useEffect, useRef } from 'react';
import { Timeline, useTimelineController } from '@time-weave/react';
import type { TimeRequest } from '@time-weave/react';

// L’API de votre carte (Leaflet, MapLibre, OpenLayers…), réduite à ce qui sert ici.
export interface Carte {
  chargerPositions(temps: number, signal: AbortSignal): Promise<readonly Position[]>;
  afficher(positions: readonly Position[]): void;
}
interface Position {
  readonly vehicule: string;
  readonly lat: number;
  readonly lon: number;
}

export function CarteSynchronisee({ carte, debut, fin }: { carte: Carte; debut: number; fin: number }) {
  const carteRef = useRef(carte);
  useEffect(() => {
    carteRef.current = carte;
  }, [carte]);

  const controller = useTimelineController({
    domain: { start: debut, end: fin },
    speed: 60,
    // Le curseur n’avance que lorsque la carte affiche l’instant demandé.
    prepareTime: async (request: TimeRequest) => {
      const positions = await carteRef.current.chargerPositions(request.target, request.signal);
      if (request.isCurrent()) carteRef.current.afficher(positions);
    },
  });

  return <Timeline controller={controller} height={200} />;
}
