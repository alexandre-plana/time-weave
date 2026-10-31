import { createManualScheduler, createTimelineController } from '@time-weave/react/core';

// Le moteur fonctionne sans navigateur : un ordonnanceur manuel fait avancer le temps.
const scheduler = createManualScheduler();
const controller = createTimelineController({
  mode: 'relative',
  domain: { start: 0, end: 10_000 },
  scheduler,
});

const arret = controller.subscribe(() => console.log(controller.getSnapshot().time));
controller.start();
controller.play();
scheduler.advance(1_000); // une seconde de lecture
controller.dispose();
arret();
