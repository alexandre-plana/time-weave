import type { TimelineController, TimelineItem } from '@time-weave/react';

// Source en mémoire : `source: items` à la création, puis…
export function exemples(controller: TimelineController, items: readonly TimelineItem[]) {
  // … remplacement complet.
  controller.setItems(items);

  // … ou modifications par identifiant, validées puis appliquées atomiquement.
  controller.update({
    items: {
      upsert: [{ id: 'alerte-42', rowId: 'pompe', at: Date.now(), label: 'Surpression' }],
      remove: ['alerte-12'],
    },
    rows: { upsert: [{ id: 'pompe', label: 'Pompe P1' }] },
    keys: { remove: ['ancienne-cle'] },
  });
}
