# Time Weave

Interactive, synchronised timelines for React, written in TypeScript: hierarchical rows that expand and collapse, free zoom and pan from milliseconds to decades, playback with keys, and a live mode. The timeline and your application drive time in both directions: the timeline asks your application to prepare each new position before confirming it, and your application can move the cursor or start playback.

The project's design documents are written in French; this page and the [English usage guide](GUIDE.md) are for users of the library.

## Status

Version **0.1.0, not published**. The V1 design is implemented: a TypeScript engine independent of React (`@time-weave/react/core`), a React view, playback controls, examples and a benchmark page. The package will be published as `@time-weave/react` under the MIT licence, supporting React 18.3 and 19, with `0.x` versions until first real-world feedback.

## Installation

The package is not on npm yet. Build an archive from this repository and install it in your application:

```bash
# in this repository
npm install
npm pack                     # builds dist/ and creates time-weave-react-0.1.0.tgz

# in your application (React 18.3 or 19 required)
npm install path/to/time-weave-react-0.1.0.tgz
```

## Minimal example

```tsx
import { PlaybackControls, Timeline, useTimelineController } from '@time-weave/react';
import '@time-weave/react/styles.css';

const day = Date.UTC(2026, 9, 18);
const hour = 3_600_000;

export function App() {
  const controller = useTimelineController({
    mode: 'calendar',
    domain: { start: day, end: day + 24 * hour },
    rows: [{ id: 'station', label: 'North station' }],
    source: [{ id: 'm1', rowId: 'station', at: day + 6 * hour, label: 'Measurement' }],
    prepareTime: (request) => {
      console.log('show the application state at', new Date(request.target));
    },
  });

  return <Timeline controller={controller} toolbar={<PlaybackControls controller={controller} showLive />} />;
}
```

All times are numbers in milliseconds (Unix timestamps in `calendar` mode, offsets from an origin in `relative` mode).

## Key ideas

- **One controller** owns the state; the view, the playback bar and your code all send it the same commands and read the same immutable snapshot.
- **`prepareTime`** lets your application update itself before a position is confirmed; playback waits for it and can be cancelled.
- **Your data, your grouping**: items can come from memory or be loaded per visible window; the library displays the individual or grouped items you give it.
- **Live mode** follows a frontier supplied by your application; the stream itself stays outside the library.

## Documentation

- [Usage guide](GUIDE.md): API, preparation contract, windowed sources, live mode, React components, keyboard and styles.
- [Examples](../../examples/README.md) (French): operations day replay, company history, relative-time test bench, benchmark page. Run them with `npm run dev:examples`.
- French design documents: [V1 design](../CONCEPTION-V1.md), [architecture](../ARCHITECTURE.md), [definition](../DEFINITION.md), [open questions](../QUESTIONS-OUVERTES.md), [measurements](../MESURES.md), [French usage guide](../GUIDE.md).
- [Changelog](../../CHANGELOG.md) (French).
