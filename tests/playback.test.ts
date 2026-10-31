import { describe, expect, it, vi } from 'vitest';
import { createTimelineController, createManualScheduler, TimelineValidationError } from '../src/core/index.js';
import { flush, setup } from './helpers.js';

describe('construction', () => {
  it('has no effect before start and starts idle', () => {
    const prepare = vi.fn();
    const { controller, scheduler, snap } = setup({ prepareTime: prepare });
    expect(prepare).not.toHaveBeenCalled();
    expect(scheduler.pendingFrames).toBe(0);
    expect(snap().status).toBe('initializing');
    expect(snap().transport).toBe('paused');
    controller.start();
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare.mock.calls[0]![0]).toMatchObject({ cause: 'initial', target: 0, previous: 0 });
    expect(snap().status).toBe('ready');
  });

  it('rejects invalid domains and options with structured errors', () => {
    expect(() => createTimelineController({ domain: { start: 5, end: 5 } })).toThrow(TimelineValidationError);
    try {
      createTimelineController({ domain: { start: 0, end: 10 }, speed: -1 });
    } catch (error) {
      expect((error as TimelineValidationError).issues[0]).toMatchObject({ path: 'speed' });
    }
  });

  it('keeps the initial status until the first confirmation', async () => {
    const { controller, snap, resolveLast, last } = setup({ initialTime: 500 }, true);
    controller.start();
    expect(snap().status).toBe('initializing');
    expect(snap().time).toBe(500);
    expect(last().request.cause).toBe('initial');
    await resolveLast();
    expect(snap().status).toBe('ready');
  });

  it('accepts relative negative times', () => {
    const { controller, snap } = setup({ domain: { start: -5000, end: 5000 } });
    controller.seek(-2500);
    expect(snap().time).toBe(-2500);
  });
});

describe('playback', () => {
  it('progresses with elapsed time, not frame count', () => {
    const a = setup();
    const b = setup();
    a.controller.play();
    b.controller.play();
    a.scheduler.advance(1000, 16);
    b.scheduler.advance(1000, 50);
    expect(a.snap().time).toBeCloseTo(1000, 6);
    expect(b.snap().time).toBeCloseTo(1000, 6);
  });

  it('applies speed to the next progression', () => {
    const { controller, scheduler, snap } = setup();
    controller.play();
    scheduler.advance(100);
    controller.setSpeed(4);
    expect(snap().time).toBeCloseTo(100);
    scheduler.advance(100);
    expect(snap().time).toBeCloseTo(500);
    expect(() => controller.setSpeed(0)).toThrow(TimelineValidationError);
  });

  it('keeps fractional progress at slow speeds', () => {
    const { controller, scheduler, snap } = setup({ speed: 0.01 });
    controller.play();
    scheduler.advance(1000, 10);
    expect(snap().time).toBeCloseTo(10, 6);
  });

  it('pause keeps the confirmed position; play resumes from it', () => {
    const { controller, scheduler, snap } = setup();
    controller.play();
    scheduler.advance(300);
    controller.pause();
    scheduler.advance(300);
    expect(snap().time).toBeCloseTo(300);
    expect(scheduler.pendingFrames).toBe(0);
    controller.play();
    scheduler.advance(200);
    expect(snap().time).toBeCloseTo(500);
  });

  it('stop returns to the start of the full domain', () => {
    const { controller, scheduler, snap } = setup({ domain: { start: 100, end: 10_000 } });
    controller.play();
    scheduler.advance(500);
    controller.stop();
    expect(snap().time).toBe(100);
    expect(snap().transport).toBe('paused');
    expect(snap().lastCause).toBe('stop');
  });

  it('stops at the end without loop and restarts from the start on play', () => {
    const { controller, scheduler, snap } = setup({ domain: { start: 0, end: 100 } });
    controller.play();
    scheduler.advance(500);
    expect(snap().time).toBe(100);
    expect(snap().transport).toBe('paused');
    controller.play();
    expect(snap().time).toBe(0);
    expect(snap().transport).toBe('playing');
    scheduler.advance(50);
    expect(snap().time).toBeCloseTo(50);
  });

  it('loops on the full domain without accumulating overshoot', () => {
    const { controller, scheduler, snap } = setup({ domain: { start: 0, end: 100 }, loop: true });
    const causes: string[] = [];
    controller.on('time', (change) => causes.push(change.cause));
    controller.play();
    scheduler.advance(96, 16); // 6 frames: 96
    scheduler.frame(16); // would be 112: confirms 100 then loops to 0
    expect(causes.slice(-2)).toEqual(['play', 'loop']);
    expect(snap().time).toBe(0);
    expect(snap().transport).toBe('playing');
    scheduler.frame(16);
    expect(snap().time).toBeCloseTo(16);
  });

  it('does not catch up time spent waiting for the application', async () => {
    const { controller, scheduler, snap, last, resolveLast } = setup({}, true);
    controller.play();
    await resolveLast(); // initial
    scheduler.frame(100);
    expect(last().request).toMatchObject({ cause: 'play', target: 100 });
    scheduler.advance(5000); // waiting: no new requests
    await resolveLast();
    expect(snap().time).toBe(100);
    scheduler.frame(16);
    expect(last().request.target).toBeCloseTo(116);
  });

  it('caps a single long pulse and resumes without catch-up after inactivity', () => {
    const { controller, scheduler, snap } = setup();
    controller.play();
    scheduler.frame(16);
    scheduler.frame(5000); // blocked thread
    expect(snap().time).toBeCloseTo(16 + 250);
    controller.setActive(false);
    scheduler.advance(10_000);
    expect(snap().time).toBeCloseTo(266);
    controller.setActive(true);
    scheduler.frame(16);
    expect(snap().time).toBeCloseTo(282);
  });

  it('produces the same observed state for the same commands and durations', () => {
    const run = () => {
      const { controller, scheduler, snap } = setup({ loop: true, domain: { start: 0, end: 1000 } });
      const times: number[] = [];
      controller.on('time', (c) => times.push(c.time));
      controller.play();
      scheduler.advance(700, 16);
      controller.setSpeed(2);
      scheduler.advance(400, 16);
      controller.seek(200);
      scheduler.advance(100, 16);
      return { times, final: snap().time };
    };
    expect(run()).toEqual(run());
  });
});

describe('preparation contract', () => {
  it('keeps the confirmed time while waiting and exposes the pending target', async () => {
    const { controller, snap, last, resolveLast } = setup({}, true);
    controller.start();
    await resolveLast();
    controller.seek(4000);
    expect(snap().time).toBe(0);
    expect(snap().pending).toMatchObject({ target: 4000, cause: 'seek' });
    expect(snap().status).toBe('preparing');
    expect(last().request.isCurrent()).toBe(true);
    await resolveLast();
    expect(snap().time).toBe(4000);
    expect(snap().pending).toBeNull();
  });

  it('a new destination invalidates the previous one, which can never apply', async () => {
    const { controller, snap, requests, flushAll } = { ...setup({}, true), flushAll: flush };
    controller.start();
    requests[0]!.done.resolve();
    await flushAll();
    controller.seek(1000);
    const first = requests[1]!;
    controller.seek(2000);
    expect(first.request.signal.aborted).toBe(true);
    expect(first.request.isCurrent()).toBe(false);
    first.done.resolve();
    await flushAll();
    expect(snap().time).toBe(0);
    requests[2]!.done.resolve();
    await flushAll();
    expect(snap().time).toBe(2000);
  });

  it('pause lets an engaged preparation finish without restarting playback', async () => {
    const { controller, scheduler, snap, last, resolveLast } = setup({}, true);
    controller.play();
    await resolveLast();
    scheduler.frame(100);
    controller.pause();
    await resolveLast();
    expect(snap().time).toBe(100);
    expect(snap().transport).toBe('paused');
    scheduler.advance(500);
    expect(last().request.target).toBe(100);
  });

  it('stop during a preparation cancels it and prepares the start', async () => {
    const { controller, snap, requests, last } = setup({}, true);
    controller.start();
    requests[0]!.done.resolve();
    await flush();
    controller.seek(5000);
    const seek = last();
    controller.stop();
    expect(seek.request.signal.aborted).toBe(true);
    expect(last().request.cause).toBe('stop');
    seek.done.resolve();
    last().done.resolve();
    await flush();
    expect(snap().time).toBe(0);
  });

  it('play during an ordinary wait reactivates the intention without a concurrent request', async () => {
    const { controller, snap, requests, resolveLast } = setup({}, true);
    controller.start();
    await resolveLast();
    controller.seek(1000);
    const count = requests.length;
    controller.play();
    expect(requests.length).toBe(count);
    expect(snap().transport).toBe('playing');
    await resolveLast();
    expect(snap().time).toBe(1000);
  });

  it('a failed preparation keeps the position, cancels playback and exposes the target', async () => {
    const { controller, scheduler, snap, last, resolveLast } = setup({}, true);
    controller.play();
    await resolveLast();
    scheduler.frame(100);
    await resolveLast();
    controller.seek(3000);
    last().done.reject(new Error('sensor store unavailable'));
    await flush();
    expect(snap().time).toBe(100);
    expect(snap().transport).toBe('paused');
    expect(snap().status).toBe('error');
    expect(snap().error).toMatchObject({ target: 3000, cause: 'seek' });
    expect(controller.retry()).toBe(true);
    await resolveLast();
    expect(snap().time).toBe(3000);
    expect(snap().error).toBeNull();
  });

  it('synchronous exceptions in prepareTime are reported as failures', () => {
    const { controller, snap } = setup({
      prepareTime: (request) => {
        if (request.cause === 'seek') throw new Error('boom');
      },
    });
    controller.start();
    controller.seek(10);
    expect(snap().error?.target).toBe(10);
  });

  it('disabling loop while a loop return waits cancels it and stays at the end', async () => {
    const { controller, scheduler, snap, last, resolveLast } = setup({ domain: { start: 0, end: 50 }, loop: true }, true);
    controller.play();
    await resolveLast();
    scheduler.frame(100);
    await resolveLast(); // confirms 50, starts loop return
    expect(last().request.cause).toBe('loop');
    controller.setLoop(false);
    expect(last().request.signal.aborted).toBe(true);
    await resolveLast();
    expect(snap().time).toBe(50);
    expect(snap().transport).toBe('paused');
  });
});

describe('keys', () => {
  const keys = [
    { id: 'a', at: 1000 },
    { id: 'b', at: 3000 },
    { id: 'b2', at: 3000 },
    { id: 'c', at: 9000 },
  ];

  it('navigates distinct instants and treats simultaneous keys as one destination', () => {
    const { controller, snap } = setup({ keys });
    controller.start();
    expect(controller.nextKey()).toBe(true);
    expect(snap().time).toBe(1000);
    expect(controller.nextKey()).toBe(true);
    expect(snap().time).toBe(3000);
    expect(controller.nextKey()).toBe(true);
    expect(snap().time).toBe(9000);
    expect(controller.nextKey()).toBe(false);
    expect(snap().canNextKey).toBe(false);
    expect(controller.previousKey()).toBe(true);
    expect(snap().time).toBe(3000);
  });

  it('uses the pending destination as reference', async () => {
    const { controller, last, resolveLast } = setup({ keys }, true);
    controller.start();
    await resolveLast();
    controller.nextKey();
    expect(last().request.target).toBe(1000);
    controller.nextKey();
    expect(last().request.target).toBe(3000);
    controller.nextKey();
    expect(last().request.target).toBe(9000);
  });

  it('does not wrap even when looping, and keeps the playback intention', () => {
    const { controller, snap } = setup({ keys, loop: true });
    controller.play();
    controller.seek(9500);
    expect(controller.nextKey()).toBe(false);
    expect(controller.previousKey()).toBe(true);
    expect(snap().transport).toBe('playing');
    expect(snap().lastCause).toBe('key');
  });

  it('reaches keys outside the loaded window', async () => {
    const { controller, snap } = setup({
      keys,
      viewport: { start: 0, end: 500 },
      source: { kind: 'windowed', load: (request) => ({ range: request.range, items: [] }) },
    });
    controller.start();
    controller.goToKey('c');
    await flush();
    expect(snap().time).toBe(9000);
    expect(snap().viewport.start).toBeLessThanOrEqual(9000);
    expect(snap().viewport.end).toBeGreaterThanOrEqual(9000);
  });
});

describe('rewind', () => {
  it('animates to the exact target and restores the playback intention', () => {
    const { controller, scheduler, snap } = setup({ rewindDuration: 300 });
    controller.seek(5000);
    controller.rewindTo(1000);
    expect(snap().rewinding).toBe(true);
    const seen: number[] = [];
    controller.on('time', (c) => seen.push(c.time));
    scheduler.advance(400);
    expect(snap().time).toBe(1000);
    expect(snap().rewinding).toBe(false);
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.every((t, i) => i === 0 || t <= seen[i - 1]!)).toBe(true);
    expect(snap().transport).toBe('paused');
  });

  it('resumes playback after rewinding when it was playing', () => {
    const { controller, scheduler, snap } = setup();
    controller.play();
    scheduler.advance(2000);
    controller.rewindTo(500);
    scheduler.advance(300);
    expect(snap().time).toBe(500);
    scheduler.advance(100);
    expect(snap().time).toBeCloseTo(600);
  });

  it('waiting lengthens the real duration', async () => {
    const { controller, scheduler, snap, last, resolveLast } = setup({ rewindDuration: 100, initialTime: 1000 }, true);
    controller.start();
    await resolveLast();
    controller.rewindTo(0);
    scheduler.frame(50);
    scheduler.advance(1000); // waiting, no progress counted
    await resolveLast();
    expect(snap().rewinding).toBe(true);
    scheduler.frame(50);
    expect(last().request.target).toBe(0);
    await resolveLast();
    expect(snap().rewinding).toBe(false);
  });

  it('pause interrupts the rewind; play moves forward from the confirmed position', () => {
    const { controller, scheduler, snap } = setup({ initialTime: 5000 });
    controller.rewindTo(0);
    scheduler.frame(100);
    const mid = snap().time;
    expect(mid).toBeLessThan(5000);
    controller.pause();
    scheduler.advance(500);
    expect(snap().time).toBe(mid);
    controller.rewindTo(0);
    scheduler.frame(16);
    controller.play();
    const pos = snap().time;
    scheduler.frame(100);
    expect(snap().time).toBeCloseTo(pos + 100);
  });

  it('reduced motion turns rewind into an immediate jump', () => {
    const { controller, snap } = setup({ initialTime: 5000, reducedMotion: true });
    controller.rewindTo(1000);
    expect(snap().time).toBe(1000);
    expect(snap().lastCause).toBe('rewind');
  });
});

describe('frame reference', () => {
  it('does not lose playback time spent rendering a synchronous confirmation', () => {
    const scheduler = createManualScheduler();
    let inFrame = false;
    const slowScheduler = {
      now: () => scheduler.now() + (inFrame ? 5 : 0),
      requestFrame: (callback: (now: number) => void) =>
        scheduler.requestFrame((now) => {
          inFrame = true;
          try {
            callback(now);
          } finally {
            inFrame = false;
          }
        }),
    };
    const controller = createTimelineController({ mode: 'relative', domain: { start: 0, end: 10_000 }, scheduler: slowScheduler });
    controller.play();
    scheduler.advance(160, 16);
    expect(controller.getSnapshot().time).toBeCloseTo(160, 6);
  });

  it('measures from the confirmation after a real wait', async () => {
    const { controller, scheduler, last, resolveLast } = setup({}, true);
    controller.play();
    await resolveLast();
    scheduler.frame(16);
    scheduler.setTime(scheduler.now() + 300);
    await resolveLast();
    scheduler.frame(16);
    expect(last().request.target).toBeCloseTo(32);
  });
});
