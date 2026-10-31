# Usage guide

Status: describes the API implemented in this repository (version 0.1.0, not yet published to npm). This is the English counterpart of the French [guide d'utilisation](../GUIDE.md); the source code in `src/` is authoritative when the two differ. Names follow the [V1 design](../CONCEPTION-V1.md) (French).

## Installation and entry points

The package is not published yet. To try it in another application, run `npm pack` in this repository, then `npm install path/to/time-weave-react-0.1.0.tgz` in your application.

| Import | Contents |
| --- | --- |
| `@time-weave/react` | React view, hooks, helpers, and a re-export of the engine |
| `@time-weave/react/core` | Engine only, with no React and no DOM |
| `@time-weave/react/styles.css` | Default styles, to be imported explicitly |

React 18.3 or 19 (and the matching `react-dom`) is a peer dependency supplied by your application.

## Minimal example

```tsx
import { PlaybackControls, Timeline, useTimelineController } from '@time-weave/react';
import type { TimelineItem, VisibleRow } from '@time-weave/react';
import '@time-weave/react/styles.css';

// Provided by your application.
declare const myApp: { showStateAt(time: number, signal: AbortSignal): Promise<void> };
declare function openDetails(item: TimelineItem, row: VisibleRow): void;

export function Replay() {
  const controller = useTimelineController({
    mode: 'calendar',
    domain: { start: Date.UTC(2026, 9, 18), end: Date.UTC(2026, 9, 19) },
    rows: [
      { id: 'station', label: 'North station' },
      { id: 'mqtt', label: 'MQTT network', parentId: 'station' },
    ],
    keys: [{ id: 'incident', at: Date.UTC(2026, 9, 18, 8), label: 'Load peak' }],
    source: [{ id: 'm1', rowId: 'mqtt', at: Date.UTC(2026, 9, 18, 6, 12), label: 'Measurement' }],
    expanded: ['station'],
    prepareTime: async (request) => {
      await myApp.showStateAt(request.target, request.signal);
    },
  });

  return (
    <Timeline
      controller={controller}
      locale="en-GB"
      toolbar={<PlaybackControls controller={controller} locale="en-GB" showLive />}
      onItemClick={(item, { row }) => openDetails(item, row)}
    />
  );
}
```

The component texts are in English by default (`defaultLabels`). For French, pass `labels={frenchLabels}` to both `Timeline` and `PlaybackControls` (see [Texts and localisation](#texts-and-localisation)).

## Time

All times are numbers in milliseconds. In `calendar` mode (the default) they are Unix timestamps: convert your dates before passing them in. In `relative` mode they are offsets from an origin you choose; negative values are allowed. The mode is fixed for the lifetime of a controller.

Calendar ticks are computed in UTC. The locale of the labels is configurable (`locale`), and the `formatTick` and `formatTime` functions replace the default labels.

Three ranges are distinct: the complete period `domain`, the visible window `viewport`, and the loaded range `data.coverage`. Loop, Stop and the end of playback always use `domain`, never the loaded batch.

## Data

| Object | Fields |
| --- | --- |
| Row (`TimelineRow`) | `id`, `label`, `parentId?`, `meta?` |
| Point (`PointItem`) | `id`, `rowId`, `at`, `label?`, `meta?`, `group?` |
| Span (`SpanItem`) | `id`, `rowId`, `start`, `end` (end excluded), `label?`, `meta?`, `group?` |
| Group | A point or span with `group: { count, ref? }`, `count > 0` |
| Key (`TimelineKey`) | `id`, `at`, `label?`, `meta?` |

`meta` is typed by the generic parameters `RowMeta`, `ItemMeta` and `KeyMeta` of the controller and components. `isSpan(item)`, `isPoint(item)`, `itemStart(item)` and `itemEnd(item)` help distinguish item kinds.

Parent rows display the items your application gives them: the library never groups anything itself. Collapsing a row hides its descendants and keeps the parent's own items.

Invalid data (duplicate id, unknown row, cycle in the row hierarchy, invalid time, inverted span, non-positive group count) throws a `TimelineValidationError` whose `issues` array details each problem (`code`, `path`, `id?`, `message`). The last valid state is kept.

### In-memory source

Pass an array as `source` (or `{ kind: 'static', items }`), then change it with:

- `controller.setItems(items)`: full replacement;
- `controller.setRows(rows)`, `controller.setKeys(keys)`: full replacement of rows or keys;
- `controller.update({ rows, keys, items })`: additions, modifications and removals by id (`{ upsert, remove }` for each collection), validated first and then applied atomically.

```ts
import { TimelineValidationError } from '@time-weave/react/core';
import type { TimelineController } from '@time-weave/react/core';

declare const controller: TimelineController;

try {
  controller.update({
    rows: { upsert: [{ id: 'pump', label: 'Pump', parentId: 'station' }] },
    items: {
      upsert: [{ id: 'run-1', rowId: 'pump', start: Date.UTC(2026, 9, 18, 7), end: Date.UTC(2026, 9, 18, 9), label: 'Run' }],
      remove: ['m1'],
    },
  });
} catch (error) {
  if (error instanceof TimelineValidationError) {
    for (const issue of error.issues) console.warn(issue.code, issue.path, issue.id, issue.message);
  } else {
    throw error;
  }
}
```

### Windowed source

```ts
import { createTimelineController } from '@time-weave/react/core';
import type { TimeRange, TimelineItem } from '@time-weave/react/core';

declare const api: { messages(range: TimeRange, options: { signal: AbortSignal }): Promise<TimelineItem[]> };

export const controller = createTimelineController({
  domain: { start: Date.UTC(2026, 9, 18), end: Date.UTC(2026, 9, 19) },
  rows: [{ id: 'station', label: 'North station' }],
  source: {
    kind: 'windowed',
    async load(request) {
      // request.visible: visible viewport; request.range: viewport + 25 % margin on each side
      const items = await api.messages(request.range, { signal: request.signal });
      return { range: request.range, items }; // an empty array means "no data here"
    },
  },
});
```

The `WindowRequest` passed to `load` also carries `id`, `generation`, `reason` (`initial`, `navigation`, `follow`, `refresh`, `source`) and `isCurrent()`. The margin is set with the `windowMargin` option (ratio of the viewport duration, default `0.25`).

- Manual navigation (dragging, explicit zoom) starts a new generation; responses to earlier requests are ignored.
- Automatic moves (playback following, live mode) keep the active request and remember a single next range.
- `controller.refresh()` asks again for the current window; refreshes requested during a load are merged into one.
- Grouping stays in your application: call `refresh()` when your grouping level changes with the zoom (see the operations example).
- `snapshot.data` exposes `coverage`, `loading` and `error` separately. A failed load leaves the previous batch displayed and emits a `dataError` event.
- `controller.setSource(source)` swaps the source (array or provider) and starts a new generation.

With a windowed source, your application changes its own store and then calls `refresh()`; `setItems()` and `update({ items })` throw a `TimelineValidationError` with code `source-mismatch`.

## Preparing and confirming time

`prepareTime(request)` is called before every new position. It either returns immediately or returns a promise; when it completes, the position is confirmed if the request is still current.

| Field | Role |
| --- | --- |
| `id` | Monotonic request id |
| `previous`, `target` | Confirmed starting position and target |
| `cause` | `initial`, `play`, `seek`, `key`, `loop`, `stop`, `rewind`, `live` |
| `signal` | `AbortSignal` aborted when a new destination replaces this one |
| `isCurrent()` | Check it before applying an asynchronous result |

While waiting, `snapshot.time` stays at the confirmed position and `snapshot.pending` holds the target. Time spent waiting is never caught up. A failure keeps the position, pauses the transport and exposes `snapshot.error` (and an `error` event); `controller.retry()` requests the same target again.

To wait for data covering the target: `await controller.waitForData(request.target, request.signal)`.

```ts
import { createTimelineController } from '@time-weave/react/core';
import type { TimeRequest } from '@time-weave/react/core';

declare const dashboard: { render(time: number): void };

const controller = createTimelineController({
  domain: { start: 0, end: 60_000 },
  mode: 'relative',
  prepareTime: async (request: TimeRequest) => {
    await controller.waitForData(request.target, request.signal);
    if (!request.isCurrent()) return;
    dashboard.render(request.target);
  },
});

const unsubscribe = controller.on('time', ({ time, previous, cause }) => {
  console.log(`confirmed ${time} (from ${previous}, ${cause})`);
});
controller.on('error', ({ target, error }) => console.error('could not prepare', target, error));
controller.on('dataError', ({ error }) => console.error('window load failed', error));
unsubscribe();
```

`controller.on(event, listener)` returns an unsubscribe function. The `time` event fires on each confirmation; `error` on a failed preparation; `dataError` on a failed window load.

## Controller options

`useTimelineController(options)` and `createTimelineController(options)` accept the same options (`TimelineControllerOptions`):

| Option | Default | Notes |
| --- | --- | --- |
| `domain` | required | Complete period `{ start, end }` |
| `mode` | `'calendar'` | Or `'relative'`; fixed for the instance |
| `liveTime` | `domain.end` | Live frontier; must be inside the domain |
| `rows`, `keys` | `[]` | |
| `source` | `[]` | Array, `{ kind: 'static', items }` or `{ kind: 'windowed', load }` |
| `initialTime` | `domain.start` | Clamped to the domain |
| `viewport` | whole domain | |
| `minViewportDuration` | `1` ms | Smallest visible duration (zoom limit) |
| `speed` | `1` | Strictly positive |
| `loop` | `false` | |
| `followPlayback` | `true` | Moves the viewport when a destination leaves it |
| `rewindDuration` | `300` ms | Active duration of `rewindTo` animations; `0` makes them jumps |
| `reducedMotion` | `false` | Turns rewinds into immediate jumps |
| `expanded` | none | Row ids initially expanded; others start collapsed |
| `windowMargin` | `0.25` | Margin requested on each side of the viewport (windowed source) |
| `maxFrameDelta` | `250` ms | Largest elapsed time taken into account between two frames |
| `prepareTime` | none | See above |
| `scheduler` | timeout-based (core); `requestAnimationFrame` (hook) | Frame source |

`useTimelineController` also accepts `respectReducedMotion` (default: `true` unless `reducedMotion` is given).

## Commands

| Command | Effect |
| --- | --- |
| `play()`, `pause()`, `togglePlay()`, `stop()` | Transport; Stop prepares the start of the period. Play at the end restarts from the start |
| `setSpeed(factor)` | Strictly positive factor (otherwise throws) |
| `setLoop(boolean)` | Loop over the whole period |
| `seek(t)` | Immediate jump, clamped to the period; keeps the playback intention, leaves live mode |
| `previousKey()`, `nextKey()`, `goToKey(id)` | Key navigation; return `false` when there is no destination |
| `rewindTo(t)` | Animated move to a past target (300 ms of active time by default) |
| `goLive()` | Follows the live frontier |
| `retry()` | Retries a failed preparation; returns `false` if there is none |
| `setLiveTime(t)`, `extendDomain(end, liveTime?)` | Live frontier (never moves back) and extension of the period (it can only grow) |
| `setViewport(range, { origin? })`, `zoomBy(factor, anchor?)`, `panBy(duration)` | Visible window; `zoomBy` factor `> 1` zooms in |
| `zoomTo(duration, anchor?)` | Viewport duration clamped to [minimum duration, domain]; the anchor (visible cursor, else centre; live target in live mode) keeps its relative position; keeps live mode |
| `centerOn(t)` | Centres the viewport on `t` (same duration, clamped); leaves live mode |
| `stepBy(duration)` | Relative jump from the pending destination or the confirmed time, clamped; keeps the playback intention, leaves live mode |
| `fitToItems(padding = 0.05)` | Viewport covering the loaded items (+ padding on each side), or the domain when there is none; leaves live mode |
| `expand(id)`, `collapse(id)`, `toggle(id)`, `setExpanded(ids)`, `expandAll()`, `collapseAll()` | Row expansion |
| `setRows(rows)`, `setKeys(keys)`, `setItems(items)`, `update(changes)`, `setSource(source)`, `refresh()` | Data |
| `setFollowPlayback(boolean)`, `setReducedMotion(boolean)`, `setRewindDuration(ms)` | Viewport following, animations |
| `setPrepareTime(fn)`, `setScheduler(scheduler)` | Replace the preparation function or the frame source |
| `start()`, `setActive(boolean)`, `dispose()`, `isActive()`, `isDisposed()` | Lifecycle |

The observable state is `controller.getSnapshot()`, an immutable object that stays the same until the next change, together with `controller.subscribe(listener)` (compatible with `useSyncExternalStore`). In React, `useTimelineSnapshot(controller)` subscribes to it. Useful snapshot fields include `time`, `pending`, `status` (`initializing`, `ready`, `preparing`, `error`), `transport` (`paused`, `playing`, `live`), `rewinding`, `speed`, `loop`, `viewport`, `domain`, `liveTime`, `visibleRows`, `items`, `keys`, `canPreviousKey`, `canNextKey` and `data`.

A controller created with `createTimelineController` does nothing until `start()` is called (the React hooks call it for you).

## Live mode

`goLive()` requests the `liveTime` frontier through the usual preparation contract. Frontiers received during a preparation replace a single next target: no queue builds up and the preparation in progress is not cancelled. Pause, Stop, a seek, a key or a manual viewport move leave live mode; Play starts a replay from the current position. Zooming keeps live mode.

By default `liveTime` follows the end of the period; as soon as your application supplies `liveTime` (option, `setLiveTime` or the second argument of `extendDomain`), it drives it explicitly.

## React

- `useTimelineController(options)` creates one stable instance for the component's lifetime. Options are read once, except `prepareTime`, which always calls the latest function given. The hook uses a `requestAnimationFrame` scheduler (unless `scheduler` is given), starts the controller, suspends progression while the page is hidden or the component is unmounted, and follows `prefers-reduced-motion` unless `reducedMotion` is given.
- `useTimelineHost(controller, { respectReducedMotion? })` connects an instance your application created with `createTimelineController`: start, page visibility and suspension on unmount. Unlike the hook above it does not install the animation-frame scheduler (pass `scheduler: createAnimationFrameScheduler()` yourself) and follows `prefers-reduced-motion` only with `respectReducedMotion: true`. Neither hook calls `dispose()`.

- `useTimelineSnapshot(controller)` returns the whole snapshot, so the component renders on every playback frame. `useTimelineSelector(controller, selector, isEqual = Object.is)` returns `selector(snapshot)` and renders the component again only when the selected value changes according to `isEqual` (no tearing, StrictMode-safe, React 18.3 and 19). The selector may be an inline function. When it builds an object or array, pass `shallowEqual` (one-level comparison).

```tsx
import { shallowEqual, useTimelineSelector } from '@time-weave/react';
import type { TimelineController } from '@time-weave/react';

function Status({ controller }: { controller: TimelineController }) {
  // One render per second of playback, not one per frame.
  const seconds = useTimelineSelector(controller, (s) => Math.floor(s.time / 1000));
  const { status, transport } = useTimelineSelector(controller, (s) => ({ status: s.status, transport: s.transport }), shallowEqual);
  return <p>{transport} · {status} · {seconds} s</p>;
}
```

```tsx
import { useEffect, useState } from 'react';
import {
  Timeline,
  createAnimationFrameScheduler,
  createTimelineController,
  useTimelineHost,
  useTimelineSnapshot,
} from '@time-weave/react';

export function OwnedController() {
  const [controller] = useState(() =>
    createTimelineController({
      domain: { start: 0, end: 10_000 },
      mode: 'relative',
      scheduler: createAnimationFrameScheduler(),
    }),
  );
  useTimelineHost(controller, { respectReducedMotion: true });
  useEffect(() => () => controller.dispose(), [controller]);

  const { time, transport } = useTimelineSnapshot(controller);
  return (
    <>
      <p>
        {transport} at {time} ms
      </p>
      <Timeline controller={controller} />
    </>
  );
}
```

### `Timeline` props

| Prop | Default | Notes |
| --- | --- | --- |
| `controller` | required | |
| `height` | `420` | Total height (number in px or CSS string) |
| `laneHeight` | `26` | Height of one lane inside a row, px |
| `labelWidth` | `220` | Width of the row label column, px (reduced on narrow screens) |
| `initialTrackWidth` | `800` | Width used before the first measurement (server rendering, tests) |
| `locale`, `labels` | runtime locale, `defaultLabels` | `labels` is a partial override |
| `formatTime(time, mode)`, `formatTick(time, step, mode)` | built in | Replace time and tick labels |
| `renderRowLabel(row)` | row label | |
| `renderItem(item, { row, width, selected, active })` | built in | Custom content must fit in `width` px |
| `getItemClassName(item)` | none | Extra classes per item |
| `getItemAriaLabel(item)` | label (or "Group of N"), then time | Accessible name of an item |
| `onItemClick(item, { event, controller, row })` | none | Click or keyboard activation; time does not move |
| `selectedItemId` | internal selection | Controlled selection (`string \| null`) |
| `tooltip` | `true` | `false` disables it; a function replaces its content |
| `detail` | `false` | `true` opens a simple detail dialog on activation; a function `(item, row)` renders its content |
| `showZoomControls` | `true` | Zoom out, zoom in, show whole period |
| `toolbar` | none | Content placed in the toolbar, e.g. `<PlaybackControls />` |
| `rowsHeader` | `labels.rows` | Header of the row column |
| `theme` | `'auto'` | `'auto'` follows `prefers-color-scheme`; `'light'` or `'dark'` forces the theme (sets `data-theme` on the frame and on the detail dialog) |
| `className`, `style` | none | Applied to the `.tw-timeline` frame |

When `renderItem` displays text, the accessible name returned by `getItemAriaLabel` must contain that visible text (WCAG 2.5.3, "Label in Name"). Without this prop the default name is kept.

```tsx
import { useRef, useState } from 'react';
import { DetailModal, Timeline, isSpan } from '@time-weave/react';
import type { TimelineController, TimelineItem } from '@time-weave/react';

interface Message {
  readonly topic: string;
}

declare const controller: TimelineController<unknown, Message>;

export function BuiltInDetail() {
  return (
    <Timeline
      controller={controller}
      detail={(item, row) => (
        <p>
          {row?.row.label}: {item.meta?.topic}
        </p>
      )}
      getItemClassName={(item) => (isSpan(item) ? 'my-span' : undefined)}
      getItemAriaLabel={(item) => `${item.label ?? item.id}, topic ${item.meta?.topic ?? 'none'}`}
    />
  );
}

export function OwnDetail() {
  const [open, setOpen] = useState<TimelineItem<Message> | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  return (
    <div ref={frame}>
      <Timeline controller={controller} selectedItemId={open?.id ?? null} onItemClick={(item) => setOpen(item)} />
      {open && (
        <DetailModal title={open.label ?? open.id} onClose={() => setOpen(null)} inertRoot={frame.current}>
          <p>{open.meta?.topic}</p>
        </DetailModal>
      )}
    </div>
  );
}
```

### `PlaybackControls` props

| Prop | Default | Notes |
| --- | --- | --- |
| `controller` | required | Same controller as the timeline |
| `speeds` | `DEFAULT_SPEEDS` = `0.25, 0.5, 1, 2, 4, 8` | Speeds offered in the selector; the current speed is added if missing |
| `showLive` | `false` | Live button |
| `showLoop` | `true` | Loop toggle |
| `showKeys` | `true` | Previous / next key buttons |
| `showReadout` | `true` | Current time, with a Retry button after a failed preparation |
| `locale`, `labels`, `formatTime(time, mode)` | as `Timeline` | |
| `formatSpeed(speed)` | `0.25×` … `8×` (localised number) | |
| `className` | none | |

### `DetailModal` props

A simple dialog usable on its own, rendered into `document.body` (portal). It moves focus inside, keeps Tab within it, closes on Escape or a click on the backdrop, and returns focus when it closes.

| Prop | Notes |
| --- | --- |
| `title`, `children` | Heading and body |
| `onClose()` | Required |
| `returnFocus` | Element focused on close; defaults to the element focused at opening |
| `inertRoot` | Element made `inert` while open (`Timeline` passes its frame); its `data-theme` (or that of its nearest ancestor) is copied onto the dialog |
| `theme` | `'light'` or `'dark'` forces the dialog theme instead (`Timeline` passes its `theme`) |
| `labels`, `className` | `labels.close` names the close button |

### Texts and localisation

`defaultLabels` (English) and `frenchLabels` provide every text used by the components (`TimelineLabels`); each entry can be replaced, and the `labels` props accept a partial object.

```tsx
import { PlaybackControls, Timeline, frenchLabels } from '@time-weave/react';
import type { TimelineController } from '@time-weave/react';

declare const controller: TimelineController;

export const french = (
  <Timeline
    controller={controller}
    labels={frenchLabels}
    locale="fr-FR"
    toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" />}
  />
);

export const custom = <Timeline controller={controller} labels={{ rows: 'Sensors', group: (count) => `${count} messages` }} />;
```

## Overview

```tsx
<TimelineOverview controller={controller} height={48} controlsId="my-timeline" />
```

`TimelineOverview` shows the whole domain: density histogram of loaded items, keys, cursor, live frontier, loaded range and the visible window. Drag the window to pan, drag its edges to zoom, click elsewhere to centre the view there, wheel to pan. With the keyboard the window is a `role="scrollbar"`: ←/→ pan by 10% (Shift: 50%), PageUp/PageDown by one viewport, +/− zoom, Home/End go to the bounds. `controlsId` sets `aria-controls` to the timeline. The histogram is recomputed only when items, domain or width change.

## Highlight bands

```tsx
<Timeline controller={controller} highlights={[{ id: 'maint', start, end, label: 'Maintenance', tone: 'warning' }]} />
```

Bands tint a period across all rows (incident, maintenance, business hours). Tones: `neutral`, `info`, `success`, `warning`, `danger` (`--tw-highlight-*` variables), plus an optional `className`. They are decorative and never capture the pointer; labels of the bands containing the confirmed time are appended to the cursor's announced value. Invalid bands are skipped with a development warning.

## Interactions and keyboard

| Gesture | Effect |
| --- | --- |
| Click on the background | Seek to the time under the pointer |
| Drag the background | Pan the viewport (no seek on release) |
| Drag the cursor handle | Seek to the last pointed position |
| Ctrl/⌘ + wheel | Zoom around the pointer |
| Shift + wheel, horizontal scroll | Pan horizontally |
| Two-finger pinch (touch) | Zoom |
| Click on an item | `onItemClick` (and `detail`, if enabled); time does not move |
| Click on a key marker | Go to that key |

The axis is an accessible slider (`role="slider"`):

| Key | Effect |
| --- | --- |
| ← / → | Move by 1/50 of the viewport (Shift: 1/10) |
| Home / End | Start or end of the period |
| Page Up / Page Down | Previous / next key |
| + / − (also `=` / `_`) | Zoom in / out |
| Space | Play / pause |

Key markers (diamonds) sit above the axis, outside the slider. They remain clickable (24 px hit area) but are not tab stops: Page Up / Page Down reach them, as stated by a description attached to the slider (`labels.cursorHelp`).

Items form a single tab stop. The arrow keys move within the row (← →) or to the nearest item of the neighbouring row (↑ ↓); Home / End go to the first or last item of the row; Enter or Space activates the item. An item outside the viewport is revealed before it receives focus.

## Styles

Import `@time-weave/react/styles.css`. Colours and sizes are `--tw-*` custom properties defined on `.tw-timeline` (and on `.tw-modal-backdrop` for the dialog). A dark theme follows `prefers-color-scheme`; a `data-theme="light"` or `"dark"` attribute on the `.tw-timeline` element itself forces a theme, whatever the system preference. Use the `theme` prop (`'light' | 'dark' | 'auto'`, default `'auto'`) to set it: it is applied to the frame and to the detail dialog. The variables can also be overridden through `className` / `style`.

The classes `tw-item`, `tw-item--point`, `tw-item--span`, `tw-item--group`, `tw-item--selected` and `tw-item--active` (item under the confirmed cursor) let you adapt the display; `getItemClassName` adds classes per item. The frame also exposes `data-status` and `data-transport` attributes.

## Behaviours settled on 31 October 2026

These behaviours, not settled by the initial design, were approved and recorded in the (French) design document.

| Situation | Behaviour |
| --- | --- |
| Play from live mode | Replay from the current position, never back to the start, even if the frontier is the end of the period |
| Pause during a loop return, then extension of the period | The return in progress completes (Pause lets the current preparation finish) |
| Manual navigation of the viewport | A new generation is created at most once per task, to group one gesture |
| Window batch citing a row removed while it was loading | Items of that row are dropped; `unknown-row` error only for a row unknown when the request was made |
| Keys outside the complete period | Ignored by navigation; become destinations again if the period grows |
