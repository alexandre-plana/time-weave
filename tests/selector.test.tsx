// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createManualScheduler,
  createTimelineController,
  shallowEqual,
  useTimelineSelector,
  useTimelineSnapshot,
} from '../src/react/index.js';
import type { TimelineController, TimelineSnapshot } from '../src/react/index.js';

afterEach(cleanup);

function makeController(domainEnd = 100_000) {
  const scheduler = createManualScheduler();
  const controller = createTimelineController({
    mode: 'relative',
    domain: { start: 0, end: domainEnd },
    rows: [{ id: 'a', label: 'A' }],
    source: [],
    scheduler,
  });
  controller.start();
  return { controller, scheduler };
}

/** Plays `frames` frames of 16 ms, one `act` per frame. */
function playFrames(scheduler: ReturnType<typeof createManualScheduler>, frames: number): void {
  for (let i = 0; i < frames; i += 1) act(() => scheduler.frame(16));
}

const selectTransport = (snapshot: TimelineSnapshot) => snapshot.transport;

describe('useTimelineSelector', () => {
  it('a component selecting transport does not render on every playback frame', () => {
    const { controller, scheduler } = makeController();
    let selectorRenders = 0;
    let snapshotRenders = 0;
    function TransportView() {
      selectorRenders += 1;
      return <span data-testid="transport">{useTimelineSelector(controller, selectTransport)}</span>;
    }
    function FullView() {
      snapshotRenders += 1;
      return <span>{useTimelineSnapshot(controller).time}</span>;
    }
    render(
      <>
        <TransportView />
        <FullView />
      </>,
    );
    selectorRenders = 0;
    snapshotRenders = 0;
    act(() => controller.play());
    playFrames(scheduler, 50);
    expect(controller.getSnapshot().time).toBeGreaterThan(0);
    expect(screen.getByTestId('transport').textContent).toBe('playing');
    expect(selectorRenders).toBeGreaterThanOrEqual(1);
    expect(selectorRenders).toBeLessThanOrEqual(2);
    expect(snapshotRenders).toBeGreaterThanOrEqual(50);
    act(() => controller.pause());
    expect(screen.getByTestId('transport').textContent).toBe('paused');
  });

  it('renders once per second when selecting the rounded time, with an inline selector', () => {
    const { controller, scheduler } = makeController();
    let renders = 0;
    function Seconds() {
      renders += 1;
      const seconds = useTimelineSelector(controller, (s) => Math.floor(s.time / 1000));
      return <span data-testid="seconds">{seconds}</span>;
    }
    render(<Seconds />);
    act(() => controller.play());
    renders = 0;
    playFrames(scheduler, 200); // 3.2 s at speed 1
    const seconds = Math.floor(controller.getSnapshot().time / 1000);
    expect(seconds).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('seconds').textContent).toBe(String(seconds));
    expect(renders).toBe(seconds);
  });

  it('inline selectors stay correct when the parent re-renders and the selector changes', () => {
    const { controller } = makeController();
    function View() {
      const [offset, setOffset] = useState(0);
      const value = useTimelineSelector(controller, (s) => s.time + offset);
      return (
        <button type="button" onClick={() => setOffset((o) => o + 1)}>
          {value}
        </button>
      );
    }
    render(<View />);
    expect(screen.getByRole('button').textContent).toBe('0');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('1');
    act(() => controller.seek(500));
    expect(screen.getByRole('button').textContent).toBe('501');
  });

  it('shallowEqual keeps object selections stable across frames', () => {
    const { controller, scheduler } = makeController();
    let renders = 0;
    const seen: unknown[] = [];
    function Panel() {
      renders += 1;
      const value = useTimelineSelector(controller, (s) => ({ transport: s.transport, speed: s.speed }), shallowEqual);
      seen.push(value);
      return <span data-testid="panel">{`${value.transport}@${value.speed}`}</span>;
    }
    render(<Panel />);
    act(() => controller.play());
    renders = 0;
    seen.length = 0;
    playFrames(scheduler, 30);
    expect(renders).toBe(0);
    act(() => controller.setSpeed(2));
    expect(screen.getByTestId('panel').textContent).toBe('playing@2');
    expect(renders).toBe(1);
  });

  it('without shallowEqual a new object per frame renders every frame (baseline)', () => {
    const { controller, scheduler } = makeController();
    let renders = 0;
    function Panel() {
      renders += 1;
      const value = useTimelineSelector(controller, (s) => ({ transport: s.transport }));
      return <span>{value.transport}</span>;
    }
    render(<Panel />);
    act(() => controller.play());
    renders = 0;
    playFrames(scheduler, 10);
    expect(renders).toBeGreaterThanOrEqual(10);
  });

  it('follows a controller switch', () => {
    const first = makeController(10_000).controller;
    const second = makeController(20_000).controller;
    act(() => second.seek(7000));
    function View({ controller }: { controller: TimelineController }) {
      return <span data-testid="v">{useTimelineSelector(controller, (s) => `${s.domain.end}:${s.time}`)}</span>;
    }
    const { rerender } = render(<View controller={first} />);
    expect(screen.getByTestId('v').textContent).toBe('10000:0');
    rerender(<View controller={second} />);
    expect(screen.getByTestId('v').textContent).toBe('20000:7000');
    // The old controller no longer drives the component.
    act(() => first.seek(3000));
    expect(screen.getByTestId('v').textContent).toBe('20000:7000');
    act(() => second.seek(9000));
    expect(screen.getByTestId('v').textContent).toBe('20000:9000');
  });

  it('is stable under StrictMode', () => {
    const { controller, scheduler } = makeController();
    let renders = 0;
    function TransportView() {
      renders += 1;
      return <span data-testid="t">{useTimelineSelector(controller, (s) => s.transport)}</span>;
    }
    render(
      <StrictMode>
        <TransportView />
      </StrictMode>,
    );
    renders = 0;
    act(() => controller.play());
    playFrames(scheduler, 50);
    expect(screen.getByTestId('t').textContent).toBe('playing');
    // StrictMode doubles each render: one transport change gives at most 2 x 2.
    expect(renders).toBeLessThanOrEqual(4);
    act(() => controller.pause());
    expect(screen.getByTestId('t').textContent).toBe('paused');
  });
});

describe('shallowEqual', () => {
  it('compares arrays and plain objects one level deep', () => {
    const shared = { x: 1 };
    expect(shallowEqual({ a: 1, b: shared }, { a: 1, b: shared })).toBe(true);
    expect(shallowEqual({ a: 1, b: { x: 1 } }, { a: 1, b: { x: 1 } })).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(shallowEqual({ a: 1, c: undefined } as object, { a: 1, b: undefined } as object)).toBe(false);
    expect(shallowEqual([1, 'a', NaN], [1, 'a', NaN])).toBe(true);
    expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(shallowEqual<unknown>([], {})).toBe(false);
    expect(shallowEqual<unknown>(null, {})).toBe(false);
    expect(shallowEqual(3, 3)).toBe(true);
    expect(shallowEqual('a', 'b')).toBe(false);
  });
});
