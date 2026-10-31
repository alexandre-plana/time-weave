import type { TimelineItem, WindowRequest, WindowedSource } from '@time-weave/react';

interface Evenement {
  readonly id: string;
  readonly capteur: string;
  readonly date: string; // ISO 8601
  readonly message: string;
}

// Source par fenêtre : appelée pour la fenêtre visible + 25 % de marge de chaque côté.
export const source: WindowedSource = {
  kind: 'windowed',
  async load(request: WindowRequest) {
    const { start, end } = request.range;
    const reponse = await fetch(`/api/evenements?du=${start}&au=${end}`, { signal: request.signal });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`); // → snapshot.data.error, lot précédent conservé
    const evenements: Evenement[] = await reponse.json();
    const items: TimelineItem[] = evenements.map((e) => ({ id: e.id, rowId: e.capteur, at: Date.parse(e.date), label: e.message }));
    return { range: request.range, items }; // un tableau vide signifie « aucune donnée »
  },
};
