import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { QUAY_EDGE, WORLD, buildings, cameras, containers, cranes, doors, fence, gate, pois, roads, tanks, zones } from './data';
import type { Camera, Poi } from './data';
import type { SceneView } from './scene';

const MIN_ZOOM = 0.2;
/** Area framed by « Recadrer »: the fenced site and the quay edge. */
const FIT = { x0: 10, y0: 24, x1: 1050, y1: 756 } as const;
const MAX_ZOOM = 8;

const path = (points: readonly (readonly [number, number])[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

function conePath(cam: Camera): string {
  const a = cam.h - cam.half;
  const b = cam.h + cam.half;
  const x1 = cam.x + Math.cos(a) * cam.range;
  const y1 = cam.y + Math.sin(a) * cam.range;
  const x2 = cam.x + Math.cos(b) * cam.range;
  const y2 = cam.y + Math.sin(b) * cam.range;
  return `M${cam.x} ${cam.y} L${x1.toFixed(1)} ${y1.toFixed(1)} A${cam.range} ${cam.range} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

/** Static plan of the site: drawn once. */
const Plan = memo(function Plan() {
  const parking = zones.find((z) => z.id === 'parking')!;
  const stalls: ReactNode[] = [];
  for (let x = parking.x + 8; x < parking.x + parking.w; x += 16) {
    stalls.push(<line key={`a${x}`} x1={x} y1={parking.y + 4} x2={x} y2={parking.y + 40} />);
    stalls.push(<line key={`b${x}`} x1={x} y1={parking.y + parking.h - 40} x2={x} y2={parking.y + parking.h - 4} />);
  }
  return (
    <g className="sv-plan">
      <rect className="sv-water" x={QUAY_EDGE} y={-3000} width={6000} height={WORLD.height + 6000} />
      <g className="sv-waves">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} d={`M${QUAY_EDGE + 30 + (i % 3) * 50} ${40 + i * 52} q 10 -6 20 0 t 20 0`} />
        ))}
      </g>
      <rect className="sv-site" x={40} y={40} width={QUAY_EDGE - 40} height={700} />
      {zones.map((z) => (
        <rect key={z.id} className={`sv-zone sv-zone--${z.id.replace(/\d/, '')}`} x={z.x} y={z.y} width={z.w} height={z.h} rx={4} />
      ))}
      <g className="sv-roads">
        {roads.map((r, i) => (
          <path key={i} d={path(r)} />
        ))}
      </g>
      <g className="sv-road-lines">
        {roads.map((r, i) => (
          <path key={i} d={path(r)} />
        ))}
      </g>
      <g className="sv-stalls">{stalls}</g>
      {buildings.map((b) => (
        <g key={b.id} className={`sv-building sv-building--${b.kind}`}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={2} />
          {b.kind === 'building' && <rect className="sv-roof" x={b.x + 6} y={b.y + 6} width={b.w - 12} height={b.h - 12} rx={1} />}
        </g>
      ))}
      <g className="sv-containers">
        {containers.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={1} data-tone={i % 5} />
        ))}
      </g>
      <g className="sv-tanks">
        {tanks.map((t, i) => (
          <circle key={i} cx={t.x} cy={t.y} r={t.r} />
        ))}
      </g>
      <g className="sv-cranes">
        {cranes.map((c, i) => (
          <g key={i}>
            <rect x={c.x - 34} y={c.y - 12} width={68} height={24} />
            <line x1={c.x - 34} y1={c.y} x2={c.x + 34} y2={c.y} />
          </g>
        ))}
      </g>
      <line className="sv-quay-edge" x1={QUAY_EDGE} y1={-3000} x2={QUAY_EDGE} y2={WORLD.height + 3000} />
      <g className="sv-fence">
        {fence.map((f, i) => (
          <path key={i} d={path(f)} />
        ))}
      </g>
      <g className="sv-gate">
        <line x1={gate.x} y1={gate.y1} x2={gate.x} y2={gate.y2} />
      </g>
      <g className="sv-labels" aria-hidden="true">
        {buildings.map((b) =>
          b.kind === 'building' ? (
            <text key={b.id} x={b.x + b.w / 2} y={b.y + b.h / 2}>
              {b.label}
            </text>
          ) : null,
        )}
        <text className="sv-label--zone" x={102} y={440}>
          Poste de garde
        </text>
        <text className="sv-label--zone" x={parking.x + parking.w / 2} y={parking.y + parking.h / 2 + 4}>
          Parking P1
        </text>
        <text className="sv-label--zone" x={934} y={64}>
          Quai 1
        </text>
        <text className="sv-label--zone" x={934} y={720}>
          Quai 2
        </text>
        <text className="sv-label--water" x={1100} y={390}>
          Bassin Est
        </text>
        <text className="sv-label--small" x={395} y={656}>
          Cuves
        </text>
        <text className="sv-label--zone" x={20} y={330} transform="rotate(-90 20 330)">
          Entrée
        </text>
      </g>
    </g>
  );
});

interface SiteMapProps {
  scene: SceneView;
  selectedPoi: string | null;
  selectedCamera: string | null;
  alarmCameras: ReadonlySet<string>;
  fenceAlarm: boolean;
  doorAlarm: boolean;
  /** Width of the overlay on the right (mosaic), kept clear when fitting. */
  rightInset: number;
  onSelectPoi: (poi: Poi) => void;
  onSelectCamera: (cam: Camera) => void;
  children?: ReactNode;
}

export function SiteMap({ scene, selectedPoi, selectedCamera, alarmCameras, fenceAlarm, doorAlarm, rightInset, onSelectPoi, onSelectCamera, children }: SiteMapProps) {
  const frame = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const fitted = useRef(false);
  const inset = useRef(rightInset);
  inset.current = rightInset;

  const fit = useCallback(() => {
    const el = frame.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) return;
    const available = Math.max(200, w - inset.current);
    const { x0, y0, x1, y1 } = FIT;
    const k = Math.min((available - 24) / (x1 - x0), (h - 24) / (y1 - y0));
    scene.setView(k, (available - (x1 - x0) * k) / 2 - x0 * k, (h - (y1 - y0) * k) / 2 - y0 * k);
  }, [scene]);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    fit();
    fitted.current = true;
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  useEffect(() => {
    if (fitted.current) fit();
  }, [rightInset, fit]);

  const zoomAt = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const el = frame.current;
      if (!el) return;
      const { k, tx, ty } = scene.view;
      const px = cx ?? (el.clientWidth - inset.current) / 2;
      const py = cy ?? el.clientHeight / 2;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
      const ratio = next / k;
      scene.setView(next, px - (px - tx) * ratio, py - (py - ty) * ratio);
    },
    [scene],
  );

  const panBy = useCallback((dx: number, dy: number) => scene.setView(scene.view.k, scene.view.tx + dx, scene.view.ty + dy), [scene]);

  const centerOn = useCallback(
    (x: number, y: number) => {
      const el = frame.current;
      if (!el) return;
      const k = Math.max(scene.view.k, 1.4);
      scene.setView(k, (el.clientWidth - inset.current) / 2 - x * k, el.clientHeight / 2 - y * k);
    },
    [scene],
  );
  // Exposed for the detail card.
  scene.centerOn = centerOn;

  // Wheel zoom (non-passive so the page does not scroll).
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Drag to pan; pinch is left to the buttons.
  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      svg.current?.setPointerCapture(event.pointerId);
      svg.current?.classList.add('is-dragging');
    }
    d.x = event.clientX;
    d.y = event.clientY;
    panBy(dx, dy);
  };
  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    svg.current?.classList.remove('is-dragging');
    if (d.moved) {
      // Swallow the click that ends a drag.
      const stop = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    }
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const step = event.shiftKey ? 160 : 60;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => panBy(step, 0),
      ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step),
      ArrowDown: () => panBy(0, -step),
      '+': () => zoomAt(1.25),
      '=': () => zoomAt(1.25),
      '-': () => zoomAt(0.8),
      '0': fit,
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  const activate = (event: ReactKeyboardEvent, fn: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fn();
    }
  };

  useEffect(() => scene.invalidate(), [scene]);

  return (
    <div className="sv-map" ref={frame}>
      <div className="sv-map__canvas" tabIndex={0} role="group" aria-label="Plan du site" aria-describedby="sv-map-help" onKeyDown={onKeyDown}>
        <svg
          ref={svg}
          className="sv-map__svg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-hidden="false"
        >
          <defs>
            <pattern id="sv-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" className="sv-grid-line" />
            </pattern>
            <radialGradient id="sv-cone-fill">
              <stop offset="0" stopOpacity="0.32" className="sv-cone-stop" />
              <stop offset="1" stopOpacity="0.04" className="sv-cone-stop" />
            </radialGradient>
          </defs>
          <rect className="sv-grid" width="100%" height="100%" fill="url(#sv-grid)" />
          <g
            ref={(el) => {
              scene.world = el;
              if (el) el.setAttribute('transform', `translate(${scene.view.tx} ${scene.view.ty}) scale(${scene.view.k})`);
            }}
          >
            <Plan />
            <g className="sv-cones">
              {cameras.map((cam, c) => (
                <g
                  key={cam.id}
                  className="sv-cone"
                  data-selected={selectedCamera === cam.id || undefined}
                  ref={(el) => {
                    scene.coneEls[c] = el;
                  }}
                >
                  <path d={conePath(cam)} />
                </g>
              ))}
            </g>
            <g className="sv-alarms" aria-hidden="true">
              <path className="sv-alarm-fence" data-on={fenceAlarm || undefined} d="M640 40 L880 40" />
              <circle className="sv-alarm-door" data-on={doorAlarm || undefined} cx={doors.a3.x} cy={doors.a3.y} r={9} />
              <rect className="sv-door" x={doors.a3.x - 7} y={doors.a3.y - 2} width={14} height={4} />
              <rect className="sv-door" x={doors.dock.x - 2} y={doors.dock.y - 14} width={4} height={28} />
            </g>
            <g className="sv-trails" aria-hidden="true">
              {pois.map((poi, p) => (
                <polyline
                  key={poi.id}
                  className={`sv-trail sv-kind--${poi.kind}`}
                  ref={(el) => {
                    scene.trailEls[p] = el;
                  }}
                />
              ))}
            </g>
            <g className="sv-cams">
              {cameras.map((cam) => (
                <g
                  key={cam.id}
                  className="sv-cam"
                  role="button"
                  tabIndex={0}
                  aria-label={`Caméra ${cam.code} — ${cam.label} : ouvrir le flux`}
                  data-selected={selectedCamera === cam.id || undefined}
                  data-alarm={alarmCameras.has(cam.id) || undefined}
                  transform={`translate(${cam.x} ${cam.y})`}
                  onClick={() => onSelectCamera(cam)}
                  onKeyDown={(event) => activate(event, () => onSelectCamera(cam))}
                >
                  <CameraGlyph cam={cam} glyphRef={(el) => (scene.camGlyphEls[cameras.indexOf(cam)] = el)} />
                </g>
              ))}
            </g>
            <g className="sv-pois">
              {pois.map((poi, p) => (
                <g
                  key={poi.id}
                  className={`sv-poi sv-kind--${poi.kind}`}
                  data-poi={poi.id}
                  data-selected={selectedPoi === poi.id || undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`${poi.kindLabel} ${poi.code} — ${poi.label}`}
                  style={{ display: 'none' }}
                  ref={(el) => {
                    scene.poiEls[p] = el;
                  }}
                  onClick={() => onSelectPoi(poi)}
                  onKeyDown={(event) => activate(event, () => onSelectPoi(poi))}
                >
                  <PoiGlyph poi={poi} headingRef={(el) => (scene.headingEls[p] = el)} />
                </g>
              ))}
            </g>
          </g>
        </svg>
      </div>
      <p id="sv-map-help" className="sv-visually-hidden">
        Flèches : déplacer le plan. Plus et moins : zoomer. Zéro : recadrer. Tabulation : caméras puis mobiles.
      </p>
      <div className="sv-map__controls" role="toolbar" aria-label="Navigation du plan">
        <button type="button" className="sv-icon-button" aria-label="Zoomer" onClick={() => zoomAt(1.3)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
        <button type="button" className="sv-icon-button" aria-label="Dézoomer" onClick={() => zoomAt(1 / 1.3)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        </button>
        <button type="button" className="sv-icon-button" aria-label="Recadrer le plan" onClick={fit}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
          </svg>
        </button>
      </div>
      <div className="sv-scale" aria-hidden="true">
        <ScaleBar scene={scene} />
      </div>
      {children}
    </div>
  );
}

function ScaleBar({ scene }: { scene: SceneView }) {
  const bar = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // The map view changes outside React: poll it on frames where the scene draws.
    return scene.addSink(() => {
      const k = scene.view.k;
      const metres = [20, 50, 100, 200, 500].find((m) => m * k >= 60) ?? 500;
      if (bar.current) bar.current.style.width = `${Math.round(metres * k)}px`;
      if (text.current && text.current.textContent !== `${metres} m`) text.current.textContent = `${metres} m`;
    });
  }, [scene]);
  return (
    <>
      <span className="sv-scale__bar" ref={bar} />
      <span className="sv-scale__text" ref={text} />
    </>
  );
}

function CameraGlyph({ cam, glyphRef }: { cam: Camera; glyphRef: (el: SVGGElement | null) => void }) {
  return (
    <g className="sv-cam__glyph" ref={glyphRef}>
      <circle className="sv-cam__halo" r={13} />
      <g transform={`rotate(${cam.heading})`}>
        <rect x={-7} y={-5} width={11} height={10} rx={2} />
        <path d="M4 -3 L9 -6 L9 6 L4 3 Z" />
      </g>
      <text className="sv-cam__code" x={0} y={-15}>
        {cam.code}
      </text>
    </g>
  );
}

function PoiGlyph({ poi, headingRef }: { poi: Poi; headingRef: (el: SVGGElement | null) => void }) {
  const body = (() => {
    switch (poi.kind) {
      case 'patrol':
      case 'intruder':
        return <circle className="sv-poi__body" r={6} />;
      case 'drone':
        return (
          <g className="sv-poi__body">
            <path d="M-6 -6 L6 6 M6 -6 L-6 6" className="sv-poi__arms" />
            <circle r={4.5} />
          </g>
        );
      case 'truck':
        return <rect className="sv-poi__body" x={-11} y={-5.5} width={22} height={11} rx={2} />;
      default:
        return <rect className="sv-poi__body" x={-8} y={-5} width={16} height={10} rx={3} />;
    }
  })();
  return (
    <>
      <circle className="sv-poi__ring" r={15} />
      <circle className="sv-poi__pulse" r={12} />
      <g ref={headingRef}>
        <path className="sv-poi__heading" d={poi.kind === 'truck' ? 'M13 0 L7 -4 L7 4 Z' : 'M12 0 L6 -4 L6 4 Z'} />
        {poi.kind === 'drone' ? null : body}
      </g>
      {poi.kind === 'drone' ? body : null}
      <text className="sv-poi__label" x={0} y={-14}>
        {poi.code}
      </text>
    </>
  );
}
