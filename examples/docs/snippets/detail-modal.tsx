import { useState } from 'react';
import { DetailModal, Timeline, frenchLabels } from '@time-weave/react';
import type { TimelineController, TimelineItem } from '@time-weave/react';

// Option 1 : la fenêtre de détail intégrée.
export function AvecDetail({ controller }: { controller: TimelineController }) {
  return (
    <Timeline
      controller={controller}
      labels={frenchLabels}
      detail={(item, row) => <p>{item.label} sur {row?.row.label}</p>}
      tooltip={(item) => <strong>{item.label}</strong>}
    />
  );
}

// Option 2 : la même fenêtre, pilotée par l’application.
export function AvecMaFenetre({ controller }: { controller: TimelineController }) {
  const [ouvert, setOuvert] = useState<TimelineItem | null>(null);
  return (
    <>
      <Timeline controller={controller} labels={frenchLabels} onItemClick={(item) => setOuvert(item)} selectedItemId={ouvert?.id ?? null} />
      {ouvert && (
        <DetailModal title={ouvert.label ?? ouvert.id} labels={frenchLabels} onClose={() => setOuvert(null)}>
          <p>Identifiant : {ouvert.id}</p>
        </DetailModal>
      )}
    </>
  );
}
