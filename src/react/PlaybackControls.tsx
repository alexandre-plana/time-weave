import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { formatTimeReadout } from '../core/index.js';
import type { TimeMode, TimelineController } from '../core/index.js';
import { useTimelineSnapshot } from './useTimelineController.js';
import { defaultLabels } from './labels.js';
import type { TimelineLabels } from './labels.js';

export const DEFAULT_SPEEDS: readonly number[] = [0.25, 0.5, 1, 2, 4, 8];

export interface PlaybackControlsProps {
  controller: TimelineController<any, any, any>;
  /** Speeds offered in the selector. The API accepts any positive factor. */
  speeds?: readonly number[];
  /** Show the live button. Defaults to `false`. */
  showLive?: boolean;
  showLoop?: boolean;
  showKeys?: boolean;
  showReadout?: boolean;
  locale?: string;
  labels?: Partial<TimelineLabels>;
  formatTime?: (time: number, mode: TimeMode) => string;
  formatSpeed?: (speed: number) => string;
  className?: string;
}

function Icon({ name }: { name: 'play' | 'pause' | 'stop' | 'prev' | 'next' | 'loop' | 'live' }): ReactNode {
  const paths: Record<typeof name, ReactNode> = {
    play: <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" />,
    pause: <path d="M5 3.5v9M11 3.5v9" />,
    stop: <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none" />,
    prev: <path d="M4 3.5v9M12 3.5 6 8l6 4.5z" />,
    next: <path d="M12 3.5v9M4 3.5 10 8l-6 4.5z" />,
    loop: <path d="M3 7a4 4 0 0 1 4-4h5l-2-2M13 9a4 4 0 0 1-4 4H4l2 2" />,
    live: <circle cx="8" cy="8" r="3.5" fill="currentColor" stroke="none" />,
  };
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="tw-icon">
      {paths[name]}
    </svg>
  );
}

/** Optional playback bar using the same controller as the timeline and the application. */
export function PlaybackControls(props: PlaybackControlsProps): ReactNode {
  const { controller, speeds = DEFAULT_SPEEDS, showLive = false, showLoop = true, showKeys = true, showReadout = true, locale, className } = props;
  const labels = useMemo(() => ({ ...defaultLabels, ...props.labels }), [props.labels]);
  const snapshot = useTimelineSnapshot(controller);
  const format = props.formatTime ?? ((time: number, mode: TimeMode) => formatTimeReadout(time, mode, locale));
  const formatSpeed = props.formatSpeed ?? ((speed: number) => `${speed.toLocaleString(locale)}×`);
  // Live mode already progresses: the main button offers Pause (Play stays available through the API).
  const playing = (snapshot.transport === 'playing' && !snapshot.rewinding) || snapshot.transport === 'live';
  const options = speeds.includes(snapshot.speed) ? speeds : [...speeds, snapshot.speed].sort((a, b) => a - b);
  const live = snapshot.transport === 'live';

  return (
    <div className={['tw-controls', className].filter(Boolean).join(' ')} role="group" aria-label={labels.timeline}>
      <button type="button" className="tw-button" onClick={() => controller.stop()} aria-label={labels.stop} title={labels.stop}>
        <Icon name="stop" />
      </button>
      {showKeys && (
        <button
          type="button"
          className="tw-button"
          onClick={() => controller.previousKey()}
          disabled={!snapshot.canPreviousKey}
          aria-label={labels.previousKey}
          title={labels.previousKey}
        >
          <Icon name="prev" />
        </button>
      )}
      <button
        type="button"
        className="tw-button tw-button--primary"
        onClick={() => (playing ? controller.pause() : controller.play())}
        aria-label={playing ? labels.pause : labels.play}
        title={playing ? labels.pause : labels.play}
      >
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      {showKeys && (
        <button
          type="button"
          className="tw-button"
          onClick={() => controller.nextKey()}
          disabled={!snapshot.canNextKey}
          aria-label={labels.nextKey}
          title={labels.nextKey}
        >
          <Icon name="next" />
        </button>
      )}
      <label className="tw-speed">
        <span className="tw-sr-only">{labels.speed}</span>
        <select value={snapshot.speed} onChange={(event) => controller.setSpeed(Number(event.target.value))}>
          {options.map((speed) => (
            <option key={speed} value={speed}>
              {formatSpeed(speed)}
            </option>
          ))}
        </select>
      </label>
      {showLoop && (
        <button
          type="button"
          className="tw-button"
          aria-pressed={snapshot.loop}
          onClick={() => controller.setLoop(!snapshot.loop)}
          aria-label={labels.loop}
          title={labels.loop}
        >
          <Icon name="loop" />
        </button>
      )}
      {showLive && (
        <button
          type="button"
          className={live ? 'tw-button tw-button--live tw-button--on' : 'tw-button tw-button--live'}
          aria-pressed={live}
          onClick={() => (live ? controller.pause() : controller.goLive())}
        >
          <Icon name="live" />
          <span>{labels.live}</span>
        </button>
      )}
      {showReadout && (
        <span className="tw-readout" data-status={snapshot.status}>
          <span className="tw-readout-time">{format(snapshot.time, snapshot.mode)}</span>
          {snapshot.status === 'error' && (
            <button type="button" className="tw-button tw-button--text" onClick={() => controller.retry()}>
              {labels.retry}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
