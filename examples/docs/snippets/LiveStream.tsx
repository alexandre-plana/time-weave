import { useEffect } from 'react';
import { PlaybackControls, Timeline, frenchLabels, useTimelineController } from '@time-weave/react';
import { usePageTheme } from '../../theme'; // docs:hide

const MINUTE = 60_000;

export function LiveStream() {
  const controller = useTimelineController({
    domain: { start: Date.now() - 2 * MINUTE, end: Date.now() },
    viewport: { start: Date.now() - MINUTE, end: Date.now() + 5_000 },
    rows: [{ id: 'flux', label: 'Messages reçus' }],
    source: [],
  });

  // Se placer sur la frontière du direct au montage.
  useEffect(() => controller.goLive(), [controller]);

  // Flux simulé : un message par seconde, la période s’étend avec lui.
  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      const maintenant = Date.now();
      n += 1;
      controller.update({ items: { upsert: [{ id: `m${n}`, rowId: 'flux', at: maintenant, label: `#${n}` }] } });
      controller.extendDomain(maintenant); // la frontière du direct suit la fin de période
    }, 1000);
    return () => clearInterval(timer);
  }, [controller]);

  return (
    <Timeline
      controller={controller}
      theme={usePageTheme()} // docs:hide
      height={150}
      locale="fr-FR"
      labels={frenchLabels}
      toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" showLive showLoop={false} showKeys={false} />}
    />
  );
}
