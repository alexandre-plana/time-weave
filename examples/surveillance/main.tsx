import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaybackControls, Timeline, frenchLabels, useTimelineController, useTimelineSelector } from '@time-weave/react';
import type { TimeRequest, TimelineController, TimelineItem, VisibleRow } from '@time-weave/react';
import '@time-weave/react/styles.css';
import './surveillance.css';
import {
  MINUTE,
  SHIFT_END,
  SHIFT_START,
  SIM_END,
  at,
  buildItems,
  cameras,
  clock,
  highlights,
  incidents,
  keys,
  missionFor,
  pois,
  recordings,
  rows,
} from './data';
import type { Camera, Incident, ItemInfo, Poi, RowInfo, SiteState } from './data';
import { SceneView, useAlarmVersion } from './scene';
import { SiteMap } from './SiteMap';

type Controller = TimelineController<RowInfo, ItemInfo>;
type Selection = { type: 'poi'; id: string } | { type: 'incident'; id: string } | null;

const SPEEDS = [1, 10, 60, 300];
const STREAM_TICK = 200;
const STREAM_STEP = 6_000;

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const signature = (item: TimelineItem<ItemInfo>) => ('at' in item ? `${item.at}` : `${item.start}-${item.end}-${item.group?.count ?? 0}`);

const poiIndex = (id: string) => pois.findIndex((poi) => poi.id === id);
const visibleCodes = (mask: number) => pois.filter((_, p) => mask & (1 << p)).map((poi) => poi.code);

const CARDINALS = ['E', 'SE', 'S', 'SO', 'O', 'NO', 'N', 'NE'];
/** Bearing in compass degrees from a heading (radians, 0 = east, y down). */
function bearing(heading: number): string {
  const deg = ((heading * 180) / Math.PI + 360) % 360;
  const compass = Math.round((deg + 90) % 360);
  return `${CARDINALS[Math.round(deg / 45) % 8]} · ${compass}°`;
}

// ------------------------------------------------------------------ header

function Header({ controller, scene, live, onToggleLive }: { controller: Controller; scene: SceneView; live: boolean; onToggleLive: () => void }) {
  const time = useRef<HTMLSpanElement>(null);
  const date = useRef<HTMLSpanElement>(null);
  const state = useAlarmVersion(scene);
  const transport = useTimelineSelector(controller, (s) => s.transport);
  useEffect(
    () =>
      scene.addSink((s) => {
        const text = clock(s.time);
        if (time.current && time.current.textContent !== text) time.current.textContent = text;
        const day = new Date(s.time).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
        if (date.current && date.current.textContent !== day) date.current.textContent = day;
      }),
    [scene],
  );
  const count = state.alarms.length;
  return (
    <header className="sv-header">
      <a className="sv-brand" href="../index.html" aria-label="time-weave — retour aux exemples">
        <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="1" y="2.5" width="8" height="2.6" rx="1.3" fill="#0969da" />
          <rect x="4" y="6.7" width="11" height="2.6" rx="1.3" fill="#1a7f37" />
          <rect x="2.5" y="10.9" width="6" height="2.6" rx="1.3" fill="#fd8c73" />
        </svg>
        <span className="sv-brand__name">time-weave</span>
        <span className="sv-brand__sep" aria-hidden="true">
          /
        </span>
        <span className="sv-brand__page">surveillance</span>
      </a>
      <div className="sv-title">
        <h1>Surveillance de site</h1>
        <p>Terminal portuaire Est · poste de nuit 20:00 → 06:00 UTC</p>
      </div>
      <div className="sv-header__status">
        <span className={`sv-pill ${count ? 'sv-pill--alarm' : 'sv-pill--ok'}`} data-testid="alarm-pill">
          <span className="sv-pill__dot" aria-hidden="true" />
          {count ? `${count} alarme${count > 1 ? 's' : ''} active${count > 1 ? 's' : ''}` : 'Site calme'}
        </span>
        <div className="sv-clock" aria-label="Heure confirmée (UTC)">
          <span className="sv-clock__date" ref={date} />
          <span className="sv-clock__time" ref={time}>
            --:--:--
          </span>
          {transport === 'live' && <span className="sv-live-tag">DIRECT</span>}
        </div>
        <button type="button" className="sv-button sv-button--live" aria-pressed={live} onClick={onToggleLive}>
          <span className="sv-rec-dot" aria-hidden="true" />
          <span className="sv-button__text">Flux en direct</span>
        </button>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------ alarms banner

function AlarmBanner({ scene, onOpenCamera, onSelect }: { scene: SceneView; onOpenCamera: (id: string) => void; onSelect: (incident: Incident) => void }) {
  const state = useAlarmVersion(scene);
  return (
    <div className="sv-alarms-banner" aria-live="polite" data-alarm={state.alarms.length ? 'alarme' : 'calme'}>
      {state.alarms.map((incident) => {
        const cam = cameras.find((c) => c.id === incident.camera);
        return (
          <div key={incident.id} className={`sv-alarm sv-alarm--${incident.kind}`} role="alert">
            <svg className="sv-alarm__icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1.5 15 14H1L8 1.5Z" />
              <path className="sv-alarm__mark" d="M8 6v4M8 11.6v.4" />
            </svg>
            <button type="button" className="sv-alarm__text" onClick={() => onSelect(incident)}>
              <strong>{incident.label}</strong>
              <span>
                {incident.place} · depuis {clock(incident.start)}
              </span>
            </button>
            {cam && (
              <button type="button" className="sv-button sv-button--small" onClick={() => onOpenCamera(cam.id)}>
                Voir {cam.code}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ video

function FeedCanvas({ scene, camera, large, className }: { scene: SceneView; camera: number; large: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return scene.addFeed(canvas, camera, large);
  }, [scene, camera, large]);
  return <canvas ref={ref} className={className} width={large ? 960 : 320} height={large ? 540 : 180} aria-hidden="true" />;
}

function Mosaic({
  scene,
  open,
  onToggle,
  onOpen,
  active,
}: {
  scene: SceneView;
  open: boolean;
  onToggle: () => void;
  onOpen: (camera: Camera, trigger: HTMLElement) => void;
  active: string | null;
}) {
  useEffect(() => scene.invalidate(), [scene, open]);
  return (
    <section className="sv-mosaic" data-open={open} aria-label="Mosaïque vidéo">
      <button type="button" className="sv-mosaic__head" aria-expanded={open} aria-controls="sv-mosaic-grid" onClick={onToggle}>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="sv-mosaic__icon">
          <rect x="1.5" y="2.5" width="5.5" height="4.5" rx="1" />
          <rect x="9" y="2.5" width="5.5" height="4.5" rx="1" />
          <rect x="1.5" y="9" width="5.5" height="4.5" rx="1" />
          <rect x="9" y="9" width="5.5" height="4.5" rx="1" />
        </svg>
        <span className="sv-mosaic__title">Mosaïque vidéo</span>
        <span className="sv-counter">{cameras.length}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true" className="sv-chevron">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <ul id="sv-mosaic-grid" className="sv-mosaic__grid">
          {cameras.map((cam, c) => (
            <li key={cam.id}>
              <button
                type="button"
                className="sv-tile"
                data-camera={cam.id}
                data-active={active === cam.id || undefined}
                aria-label={`Agrandir le flux ${cam.code} — ${cam.label}`}
                ref={(el) => {
                  scene.tileEls[c] = el;
                }}
                onClick={(event) => onOpen(cam, event.currentTarget)}
              >
                <FeedCanvas scene={scene} camera={c} large={false} className="sv-tile__feed" />
                <span className="sv-tile__caption">
                  <span className="sv-tile__code">{cam.code}</span>
                  <span className="sv-tile__label">{cam.label}</span>
                  <span className="sv-tile__state" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Viewer({ scene, camera, onClose, onStep }: { scene: SceneView; camera: number; onClose: () => void; onStep: (delta: number) => void }) {
  const cam = cameras[camera]!;
  const close = useRef<HTMLButtonElement>(null);
  const rec = useRef<HTMLElement>(null);
  const seen = useRef<HTMLElement>(null);
  const signal = useRef<HTMLElement>(null);
  useEffect(() => close.current?.focus(), []);
  useEffect(
    () =>
      scene.addSink((s: SiteState) => {
        const set = (el: HTMLElement | null, text: string) => {
          if (el && el.textContent !== text) el.textContent = text;
        };
        set(rec.current, s.lost[camera] ? '—' : s.recording[camera] ? 'En cours' : 'En veille');
        set(seen.current, s.lost[camera] ? '—' : visibleCodes(s.inView[camera]!).join(', ') || 'Aucun');
        set(signal.current, s.lost[camera] ? 'Perdu' : 'Nominal');
      }),
    [scene, camera],
  );
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };
  return (
    <div className="sv-viewer" role="dialog" aria-label={`Flux ${cam.code} — ${cam.label}`} data-testid="viewer" onKeyDown={onKeyDown}>
      <div className="sv-viewer__head">
        <h2>
          <span className="sv-tile__code">{cam.code}</span> {cam.label}
        </h2>
        <div className="sv-viewer__nav">
          <button type="button" className="sv-icon-button" aria-label="Caméra précédente" onClick={() => onStep(-1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <button type="button" className="sv-icon-button" aria-label="Caméra suivante" onClick={() => onStep(1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
          <button type="button" className="sv-icon-button" aria-label="Fermer le flux agrandi" ref={close} onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </div>
      <FeedCanvas key={camera} scene={scene} camera={camera} large className="sv-viewer__feed" />
      <dl className="sv-facts sv-facts--row">
        <div>
          <dt>Signal</dt>
          <dd ref={signal} />
        </div>
        <div>
          <dt>Enregistrement</dt>
          <dd ref={rec} />
        </div>
        <div>
          <dt>Mobiles dans le champ</dt>
          <dd ref={seen} />
        </div>
        <div>
          <dt>Champ</dt>
          <dd>
            {cam.fov}° · {cam.range} m
          </dd>
        </div>
      </dl>
    </div>
  );
}

// ------------------------------------------------------------------ details

function PoiCard({ scene, poi, onClose }: { scene: SceneView; poi: Poi; onClose: () => void }) {
  const p = poiIndex(poi.id);
  const refs = {
    status: useRef<HTMLElement>(null),
    mission: useRef<HTMLElement>(null),
    speed: useRef<HTMLElement>(null),
    heading: useRef<HTMLElement>(null),
    cams: useRef<HTMLElement>(null),
  };
  useEffect(
    () =>
      scene.addSink((s) => {
        const set = (el: HTMLElement | null, text: string) => {
          if (el && el.textContent !== text) el.textContent = text;
        };
        const present = s.present[p] === 1;
        const speed = s.speed[p]!;
        set(refs.status.current, !present ? 'Hors site' : speed > 0.3 ? 'En mouvement' : 'À l’arrêt');
        const mission = missionFor(poi, s.time);
        set(refs.mission.current, mission && s.time >= mission.start && s.time < mission.end ? mission.label : '—');
        set(refs.speed.current, present ? `${(speed * 3.6).toFixed(1)} km/h` : '—');
        set(refs.heading.current, present ? bearing(s.heading[p]!) : '—');
        let mask = 0;
        for (let c = 0; c < cameras.length; c++) if (s.inView[c]! & (1 << p)) mask |= 1 << c;
        set(refs.cams.current, present ? cameras.filter((_, c) => mask & (1 << c)).map((c) => c.code).join(', ') || 'Aucune' : '—');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, poi, p],
  );
  return (
    <section className={`sv-card sv-kind--${poi.kind}`} aria-label={`Détails ${poi.code}`} data-testid="poi-card">
      <header className="sv-card__head">
        <span className="sv-swatch" aria-hidden="true" />
        <div>
          <h2>{poi.label}</h2>
          <p>
            {poi.kindLabel} · <span className="sv-mono">{poi.code}</span>
          </p>
        </div>
        <button type="button" className="sv-icon-button sv-icon-button--ghost" aria-label="Fermer les détails" onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      <dl className="sv-facts">
        <dt>État</dt>
        <dd ref={refs.status} />
        <dt>Mission</dt>
        <dd ref={refs.mission} />
        <dt>Vitesse</dt>
        <dd ref={refs.speed} />
        <dt>Cap</dt>
        <dd ref={refs.heading} />
        <dt>Vu par</dt>
        <dd ref={refs.cams} />
      </dl>
      <div className="sv-card__actions">
        <button
          type="button"
          className="sv-button sv-button--small"
          onClick={() => {
            const s = scene.shown;
            scene.centerOn?.(s.x[p]!, s.y[p]!);
          }}
        >
          Centrer sur le plan
        </button>
      </div>
    </section>
  );
}

function IncidentCard({ incident, controller, onOpenCamera, onClose }: { incident: Incident; controller: Controller; onOpenCamera: (id: string) => void; onClose: () => void }) {
  const cam = cameras.find((c) => c.id === incident.camera);
  return (
    <section className={`sv-card sv-card--incident sv-card--${incident.kind}`} aria-label={`Détails ${incident.label}`}>
      <header className="sv-card__head">
        <span className="sv-swatch" aria-hidden="true" />
        <div>
          <h2>{incident.label}</h2>
          <p>{incident.place}</p>
        </div>
        <button type="button" className="sv-icon-button sv-icon-button--ghost" aria-label="Fermer les détails" onClick={onClose}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      <dl className="sv-facts">
        <dt>Début</dt>
        <dd className="sv-mono">{clock(incident.start)}</dd>
        <dt>Fin</dt>
        <dd className="sv-mono">{clock(incident.end)}</dd>
        <dt>Durée</dt>
        <dd>{Math.round((incident.end - incident.start) / MINUTE)} min</dd>
      </dl>
      <div className="sv-card__actions">
        <button type="button" className="sv-button sv-button--small" onClick={() => controller.goToKey(`k-${incident.id}`)}>
          Aller au début
        </button>
        {cam && (
          <button type="button" className="sv-button sv-button--small" onClick={() => onOpenCamera(cam.id)}>
            Voir {cam.code}
          </button>
        )}
      </div>
    </section>
  );
}

function Legend() {
  const kinds: [string, string][] = [
    ['patrol', 'Patrouille'],
    ['vehicle', 'Véhicule'],
    ['drone', 'Drone'],
    ['truck', 'Poids lourd'],
    ['car', 'Relève'],
    ['intruder', 'Intrus'],
  ];
  return (
    <details className="sv-legend-box">
      <summary>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="4" cy="5" r="2" />
          <circle cx="4" cy="11" r="2" />
          <path d="M8 5h6M8 11h6" />
        </svg>
        Légende
      </summary>
    <ul className="sv-legend">
      {kinds.map(([kind, label]) => (
        <li key={kind} className={`sv-kind--${kind}`}>
          <span className="sv-swatch" aria-hidden="true" />
          {label}
        </li>
      ))}
      <li className="sv-legend__cone">
        <span className="sv-swatch" aria-hidden="true" />
        Mouvement détecté
      </li>
    </ul>
    </details>
  );
}

// ------------------------------------------------------------------ splitter

function Splitter({ value, onChange, container }: { value: number; onChange: (value: number) => void; container: React.RefObject<HTMLElement | null> }) {
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    const move = (e: PointerEvent) => {
      const box = container.current?.getBoundingClientRect();
      if (!box) return;
      onChange(Math.min(0.75, Math.max(0.22, (box.bottom - e.clientY) / box.height)));
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };
  const onKeyDown = (event: ReactKeyboardEvent) => {
    const steps: Record<string, number> = { ArrowUp: 0.05, ArrowDown: -0.05, PageUp: 0.15, PageDown: -0.15 };
    if (event.key in steps) {
      event.preventDefault();
      onChange(Math.min(0.75, Math.max(0.22, value + steps[event.key]!)));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(0.22);
    } else if (event.key === 'End') {
      event.preventDefault();
      onChange(0.75);
    }
  };
  return (
    <div
      className="sv-splitter"
      role="separator"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label="Hauteur de la chronologie"
      aria-valuemin={22}
      aria-valuemax={75}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={`${Math.round(value * 100)} % de la hauteur`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className="sv-splitter__grip" aria-hidden="true" />
    </div>
  );
}

// ------------------------------------------------------------------ app

function App() {
  const scene = useMemo(() => new SceneView(), []);
  const narrow = useMedia('(max-width: 760px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  scene.reducedMotion = reduced;
  const [selection, setSelection] = useState<Selection>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  const [mosaicOpen, setMosaicOpen] = useState(() => !(typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches));
  const [split, setSplit] = useState(0.4);
  const [live, setLive] = useState(false);
  const viewerTrigger = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const initialItems = useMemo(() => buildItems(SHIFT_END), []);
  const known = useRef<Map<string, string> | null>(null);
  if (!known.current) known.current = new Map(initialItems.map((item) => [item.id, signature(item)]));

  // The application state for the requested time is computed synchronously;
  // it is shown only when the controller confirms that time (see 'time' below).
  const prepareTime = useCallback((request: TimeRequest) => scene.prepare(request.target), [scene]);

  const controller = useTimelineController<RowInfo, ItemInfo>({
    mode: 'calendar',
    domain: { start: SHIFT_START, end: SHIFT_END },
    initialTime: at(22, 30),
    viewport: { start: at(21, 50), end: at(0, 50) },
    rows,
    keys,
    source: initialItems,
    expanded: ['cams', 'mobiles', 'alarms'],
    speed: 60,
    prepareTime,
  });

  useEffect(() => {
    const off = controller.on('time', (change) => scene.commit(change.time));
    const snapshot = controller.getSnapshot();
    if (snapshot.status !== 'initializing') scene.commit(snapshot.time);
    return () => {
      off();
      scene.dispose();
    };
  }, [controller, scene]);

  // Simulated live stream: the domain grows and the new detections are appended.
  useEffect(() => {
    if (!live) return;
    controller.goLive();
    const timer = setInterval(() => {
      const end = controller.getSnapshot().domain.end;
      if (end >= SIM_END) {
        setLive(false);
        return;
      }
      const next = Math.min(SIM_END, end + STREAM_STEP);
      controller.extendDomain(next);
      const items = buildItems(next);
      const map = known.current!;
      const upsert: TimelineItem<ItemInfo>[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        seen.add(item.id);
        const sig = signature(item);
        if (map.get(item.id) !== sig) {
          map.set(item.id, sig);
          upsert.push(item);
        }
      }
      const remove = [...map.keys()].filter((id) => !seen.has(id));
      for (const id of remove) map.delete(id);
      if (upsert.length || remove.length) controller.update({ items: { upsert, remove } });
    }, STREAM_TICK);
    return () => clearInterval(timer);
  }, [live, controller]);

  const openViewer = useCallback((c: number, trigger?: HTMLElement | null) => {
    viewerTrigger.current = trigger ?? (document.activeElement as HTMLElement | null);
    setViewer(c);
  }, []);
  const closeViewer = useCallback(() => {
    setViewer(null);
    const trigger = viewerTrigger.current;
    requestAnimationFrame(() => trigger?.isConnected && trigger.focus());
  }, []);

  const selectCameraItem = useCallback((cam: Camera) => {
    const list = recordings.get(cam.id) ?? [];
    const time = scene.shown.time;
    let index = -1;
    for (let i = 0; i < list.length; i++) if (list[i]!.start <= time) index = i;
    if (index >= 0) setSelectedItemId(`rec-${cam.code}-${index}`);
  }, [scene]);

  // Scrolls the timeline body so that a row is visible (rows are virtualised:
  // jump close to it first, then align on the rendered row).
  const pane = useRef<HTMLElement>(null);
  const revealRow = useCallback(
    (rowId: string) => {
      const attempt = (tries: number) => {
        const tlBody = pane.current?.querySelector<HTMLElement>('.tw-body');
        if (!tlBody) return;
        const row = tlBody.querySelector<HTMLElement>(`.tw-row[data-row-id="${rowId}"]`);
        if (row) {
          const top = row.offsetTop;
          if (top < tlBody.scrollTop || top + row.offsetHeight > tlBody.scrollTop + tlBody.clientHeight) {
            tlBody.scrollTo({ top: Math.max(0, top - 8), behavior: scene.reducedMotion ? 'auto' : 'smooth' });
          }
          return;
        }
        if (tries <= 0) return;
        const visible = controller.getSnapshot().visibleRows;
        const index = visible.findIndex((r) => r.row.id === rowId);
        if (index < 0) return;
        tlBody.scrollTop = (tlBody.scrollHeight * index) / visible.length;
        requestAnimationFrame(() => attempt(tries - 1));
      };
      requestAnimationFrame(() => attempt(3));
    },
    [controller, scene],
  );

  const onSelectPoi = useCallback(
    (poi: Poi) => {
      setSelection({ type: 'poi', id: poi.id });
      setSelectedItemId(missionFor(poi, scene.shown.time)?.id ?? null);
      controller.expand('mobiles');
      revealRow(`row-${poi.id}`);
    },
    [controller, scene, revealRow],
  );
  const onSelectCamera = useCallback(
    (cam: Camera) => {
      openViewer(cameras.indexOf(cam));
      selectCameraItem(cam);
      revealRow(cam.id);
    },
    [openViewer, selectCameraItem, revealRow],
  );
  const openCameraById = useCallback((id: string) => {
    const c = cameras.findIndex((cam) => cam.id === id);
    if (c >= 0) openViewer(c);
  }, [openViewer]);
  const onSelectIncident = useCallback((incident: Incident) => {
    setSelection({ type: 'incident', id: incident.id });
    setSelectedItemId(incident.id);
  }, []);

  const onItemClick = useCallback(
    (item: TimelineItem<ItemInfo>) => {
      setSelectedItemId(item.id);
      const meta = item.meta;
      if (meta?.poi && meta.kind === 'mission') setSelection({ type: 'poi', id: meta.poi });
      else if (meta?.incident) setSelection({ type: 'incident', id: meta.incident });
      else if (meta?.camera) {
        const c = cameras.findIndex((cam) => cam.id === meta.camera);
        if (c >= 0) openViewer(c);
      }
    },
    [openViewer],
  );

  const renderRowLabel = useCallback((row: VisibleRow<RowInfo>) => {
    const meta = row.row.meta;
    if (meta?.kind === 'group') return <span className="sv-row sv-row--group">{row.row.label}</span>;
    const poi = meta?.kind === 'poi' ? pois.find((p) => p.id === meta.ref) : undefined;
    const [code, ...rest] = row.row.label.split(' · ');
    return (
      <span className={`sv-row sv-row--${meta?.kind}${poi ? ` sv-kind--${poi.kind}` : ''}`}>
        <span className="sv-swatch" aria-hidden="true" />
        {rest.length ? (
          <>
            <span className="sv-row__code">{code}</span>
            <span className="sv-row__label">{rest.join(' · ')}</span>
          </>
        ) : (
          <span className="sv-row__label">{code}</span>
        )}
      </span>
    );
  }, []);

  const itemClass = useCallback((item: TimelineItem<ItemInfo>) => {
    const meta = item.meta;
    switch (meta?.kind) {
      case 'recording':
        return 'sv-item sv-item--rec';
      case 'motion':
        return meta.poi === 'int' ? 'sv-item sv-item--motion-alert' : meta.poi ? 'sv-item sv-item--motion' : 'sv-item sv-item--motion-env';
      case 'burst':
        return 'sv-item sv-item--burst';
      case 'mission': {
        const poi = pois.find((p) => p.id === meta.poi);
        return `sv-item sv-item--mission sv-kind--${poi?.kind}`;
      }
      case 'alarm':
      case 'incident':
        return `sv-item sv-item--alarm sv-item--${meta.alarm}`;
      default:
        return undefined;
    }
  }, []);

  const state = useAlarmVersion(scene);
  const alarmCameras = useMemo(() => new Set(state.alarms.map((a) => a.camera).filter((id): id is string => !!id)), [state.alarms]);
  const fenceAlarm = state.alarms.some((a) => a.id === 'inc-fence');
  const doorAlarm = state.alarms.some((a) => a.id === 'inc-door');

  const selectedPoi = selection?.type === 'poi' ? pois.find((p) => p.id === selection.id) ?? null : null;
  const selectedIncident = selection?.type === 'incident' ? incidents.find((i) => i.id === selection.id) ?? null : null;
  const rightInset = mosaicOpen && !narrow ? 372 : 0;

  return (
    <div className="sv" data-alarm={state.alarms.length ? 'alarme' : 'calme'} style={{ '--sv-timeline': `${Math.round(split * 100)}%` } as React.CSSProperties}>
      <Header controller={controller} scene={scene} live={live} onToggleLive={() => setLive((v) => !v)} />
      <div className="sv-body" ref={body}>
        <main className="sv-map-pane" aria-label="Plan et vidéo" style={{ '--sv-inset': `${rightInset}px` } as React.CSSProperties}>
          <SiteMap
            scene={scene}
            selectedPoi={selection?.type === 'poi' ? selection.id : null}
            selectedCamera={viewer !== null ? cameras[viewer]!.id : null}
            alarmCameras={alarmCameras}
            fenceAlarm={fenceAlarm}
            doorAlarm={doorAlarm}
            rightInset={rightInset}
            onSelectPoi={onSelectPoi}
            onSelectCamera={onSelectCamera}
          >
            <AlarmBanner scene={scene} onOpenCamera={openCameraById} onSelect={onSelectIncident} />
            <div className="sv-overlay-left">
              {selectedPoi && <PoiCard key={selectedPoi.id} scene={scene} poi={selectedPoi} onClose={() => { setSelection(null); setSelectedItemId(null); }} />}
              {selectedIncident && (
                <IncidentCard
                  incident={selectedIncident}
                  controller={controller}
                  onOpenCamera={openCameraById}
                  onClose={() => {
                    setSelection(null);
                    setSelectedItemId(null);
                  }}
                />
              )}
              <Legend />
            </div>
            <Mosaic
              scene={scene}
              open={mosaicOpen}
              onToggle={() => setMosaicOpen((v) => !v)}
              onOpen={(cam, trigger) => {
                openViewer(cameras.indexOf(cam), trigger);
                selectCameraItem(cam);
              }}
              active={viewer !== null ? cameras[viewer]!.id : null}
            />
            {viewer !== null && (
              <Viewer
                scene={scene}
                camera={viewer}
                onClose={closeViewer}
                onStep={(delta) => setViewer((v) => (v === null ? v : (v + delta + cameras.length) % cameras.length))}
              />
            )}
          </SiteMap>
        </main>
        <Splitter value={split} onChange={setSplit} container={body} />
        <section className="sv-timeline-pane" aria-label="Chronologie du poste" ref={pane}>
          <Timeline
            controller={controller}
            height="100%"
            labelWidth={narrow ? 128 : 208}
            laneHeight={22}
            locale="fr-FR"
            labels={frenchLabels}
            rowsHeader="Sources"
            toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" showLive speeds={SPEEDS} />}
            renderRowLabel={renderRowLabel}
            getItemClassName={itemClass}
            onItemClick={onItemClick}
            selectedItemId={selectedItemId}
            highlights={highlights}
          />
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
