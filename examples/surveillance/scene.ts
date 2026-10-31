import { useSyncExternalStore } from 'react';
import { SECOND, SiteState, cameras, pois, positionAt, presenceStart } from './data';
import { drawFeed } from './feeds';

/*
 * Imperative view of the site: the confirmed state is drawn into the SVG map
 * and the feed canvases from a controller subscription, coalesced to one
 * animation frame. React only renders when a coarse value (active alarms,
 * selection) changes.
 */

export interface MapView {
  k: number;
  tx: number;
  ty: number;
}

interface FeedEntry {
  readonly canvas: HTMLCanvasElement;
  readonly camera: number;
  readonly large: boolean;
  visible: boolean;
}

type Sink = (state: SiteState) => void;

const TRAIL_SAMPLES = 13;
const TRAIL_DURATION = 120 * SECOND;

export class SceneView {
  /** State shown on screen: always the confirmed time. */
  shown = new SiteState();
  /** State computed by `prepareTime` for the requested time. */
  private prepared = new SiteState();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  readonly view: MapView = { k: 1, tx: 0, ty: 0 };
  world: SVGGElement | null = null;
  readonly poiEls: (SVGGElement | null)[] = pois.map(() => null);
  readonly headingEls: (SVGGElement | null)[] = pois.map(() => null);
  readonly trailEls: (SVGPolylineElement | null)[] = pois.map(() => null);
  readonly coneEls: (SVGGElement | null)[] = cameras.map(() => null);
  /** Camera glyphs, kept at a constant screen size. */
  readonly camGlyphEls: (SVGGElement | null)[] = cameras.map(() => null);
  readonly tileEls: (HTMLElement | null)[] = cameras.map(() => null);
  private readonly feeds = new Set<FeedEntry>();
  private readonly sinks = new Set<Sink>();
  private readonly lastCone = new Int32Array(cameras.length).fill(-1);
  private readonly lastPresent = new Int8Array(pois.length).fill(-1);
  private frameRequest = 0;
  private frame = 0;
  private readonly pos = new Float64Array(2);
  reducedMotion = false;
  /** Set by the map: centres the view on a point of the site. */
  centerOn: ((x: number, y: number) => void) | null = null;

  /** Called by `prepareTime`: computes the application state for the target. */
  prepare(time: number): void {
    this.prepared.compute(time);
  }

  /** Called when the controller confirms a time: the prepared state becomes visible. */
  commit(time: number): void {
    if (this.prepared.time === time) {
      const next = this.prepared;
      this.prepared = this.shown;
      this.shown = next;
    } else {
      this.shown.compute(time);
    }
    const alarmKey = this.shown.alarmKey;
    if (alarmKey !== this.notifiedAlarmKey) {
      this.notifiedAlarmKey = alarmKey;
      this.version++;
      for (const listener of this.listeners) listener();
    }
    this.schedule();
  }

  private notifiedAlarmKey: string | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  /** Registers a function that writes per-frame text (clock, detail card). */
  addSink(sink: Sink): () => void {
    this.sinks.add(sink);
    if (!Number.isNaN(this.shown.time)) sink(this.shown);
    return () => this.sinks.delete(sink);
  }

  addFeed(canvas: HTMLCanvasElement, camera: number, large: boolean): () => void {
    const entry: FeedEntry = { canvas, camera, large, visible: true };
    this.feeds.add(entry);
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver((records) => {
        for (const record of records) entry.visible = record.isIntersecting;
        if (entry.visible) this.schedule();
      });
      observer.observe(canvas);
    }
    this.schedule();
    return () => {
      observer?.disconnect();
      this.feeds.delete(entry);
    };
  }

  setView(k: number, tx: number, ty: number): void {
    this.view.k = k;
    this.view.tx = tx;
    this.view.ty = ty;
    this.world?.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${k.toFixed(4)})`);
    const glyph = `scale(${(1 / k).toFixed(4)})`;
    for (const el of this.camGlyphEls) el?.setAttribute('transform', glyph);
    this.renderMobiles();
    this.schedule();
  }

  schedule(): void {
    if (this.frameRequest || typeof requestAnimationFrame !== 'function') return;
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0;
      this.render();
    });
  }

  dispose(): void {
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;
  }

  private render(): void {
    const state = this.shown;
    if (Number.isNaN(state.time)) return;
    this.frame++;
    this.renderMobiles();
    for (let c = 0; c < cameras.length; c++) {
      const code = (state.lost[c]! ? 1 : 0) | (state.motion[c] ? 2 : 0) | (state.recording[c] ? 4 : 0);
      if (code === this.lastCone[c]) continue;
      this.lastCone[c] = code;
      const value = state.lost[c] ? 'lost' : state.motion[c] ? 'motion' : 'idle';
      const cone = this.coneEls[c];
      if (cone) {
        cone.dataset.state = value;
        cone.dataset.rec = state.recording[c] ? '1' : '0';
      }
      const tile = this.tileEls[c];
      if (tile) {
        tile.dataset.state = value;
        tile.dataset.rec = state.recording[c] ? '1' : '0';
      }
    }
    for (const sink of this.sinks) sink(state);
    for (const feed of this.feeds) {
      if (!feed.visible || !feed.canvas.isConnected) continue;
      const ctx = feed.canvas.getContext('2d');
      if (ctx) drawFeed(ctx, feed.camera, state, { reducedMotion: this.reducedMotion, frame: this.frame, large: feed.large });
    }
  }

  /** Re-applies cone/tile attributes after elements are (re)mounted. */
  invalidate(): void {
    this.lastCone.fill(-1);
    this.lastPresent.fill(-1);
    this.schedule();
  }

  private renderMobiles(): void {
    const state = this.shown;
    if (Number.isNaN(state.time)) return;
    const scale = 1 / this.view.k;
    const pos = this.pos;
    for (let p = 0; p < pois.length; p++) {
      const el = this.poiEls[p];
      const trail = this.trailEls[p];
      const present = state.present[p]! as 0 | 1;
      if (present !== this.lastPresent[p]) {
        this.lastPresent[p] = present;
        if (el) el.style.display = present ? '' : 'none';
        if (trail) trail.style.display = present ? '' : 'none';
      }
      if (!present) continue;
      const x = state.x[p]!;
      const y = state.y[p]!;
      el?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})`);
      const deg = (state.heading[p]! * 180) / Math.PI;
      this.headingEls[p]?.setAttribute('transform', `rotate(${deg.toFixed(1)})`);
      if (el) el.dataset.moving = state.speed[p]! > 0.3 ? '1' : '0';
      if (trail) {
        const poi = pois[p]!;
        const from = Math.max(state.time - TRAIL_DURATION, presenceStart(poi, state.time));
        let points = '';
        for (let i = 0; i < TRAIL_SAMPLES; i++) {
          const t = from + ((state.time - from) * i) / (TRAIL_SAMPLES - 1);
          positionAt(poi.track, t, pos);
          points += `${pos[0]!.toFixed(1)},${pos[1]!.toFixed(1)} `;
        }
        trail.setAttribute('points', points);
      }
    }
  }
}

/** Re-renders a component when the active alarms change (not on every frame). */
export function useAlarmVersion(scene: SceneView): SiteState {
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
  return scene.shown;
}
