import type { TimelineController } from '@time-weave/react';

export function brancher(controller: TimelineController): () => void {
  // Chaque abonnement retourne sa fonction de désabonnement.
  const arrets = [
    controller.on('time', ({ time, previous, cause }) => console.log('confirmé', time, 'depuis', previous, cause)),
    controller.on('error', ({ target, error }) => console.error('préparation échouée pour', target, error)),
    controller.on('dataError', ({ error }) => console.error('chargement de fenêtre échoué', error)),
    controller.on('viewport', ({ viewport, origin }) => console.log('fenêtre', viewport, origin)),
  ];
  return () => arrets.forEach((arreter) => arreter());
}

export function naviguer(controller: TimelineController) {
  controller.zoomTo(3_600_000); // fenêtre d’une heure autour du curseur
  controller.centerOn(Date.UTC(2026, 9, 18, 12)); // centre la fenêtre, même durée
  controller.stepBy(-5 * 60_000); // recule de 5 minutes
  controller.fitToItems(0.1); // couvre les éléments chargés, 10 % de marge
  if (!controller.nextKey()) console.log('aucune clé suivante');
}
