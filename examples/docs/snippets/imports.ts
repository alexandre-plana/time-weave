// Vue React, hooks, aides — et réexport du moteur.
import { PlaybackControls, Timeline, useTimelineController } from '@time-weave/react';
// Styles par défaut : à importer explicitement, une fois.
import '@time-weave/react/styles.css';
// Moteur seul, sans React ni DOM (serveur, worker, tests, autre framework).
import { createTimelineController } from '@time-weave/react/core';

export { PlaybackControls, Timeline, useTimelineController, createTimelineController };
