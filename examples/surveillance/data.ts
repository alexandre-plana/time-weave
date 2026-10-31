import type { TimelineItem, TimelineKey, TimelineProps, TimelineRow } from '@time-weave/react';

/*
 * Simulated night shift on a port site. Everything here is deterministic and
 * plain data: the site plan (shared by the SVG map and the canvas feeds), the
 * cameras, the trajectories of the mobiles, the incidents, and the timeline
 * rows and items derived from them.
 */

// ------------------------------------------------------------------ time

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
/** Start of the night shift: 30 October 2026, 20:00 UTC. */
export const SHIFT_START = Date.UTC(2026, 9, 30, 20);
/** End of the recorded shift (initial end of the domain). */
export const SHIFT_END = SHIFT_START + 10 * HOUR;
/** End of the simulated data: the live stream may extend the domain up to here. */
export const SIM_END = SHIFT_START + 12 * HOUR;
/** Clock time of the night (hours ≥ 20 are on the first day, the others on the next). */
export const at = (h: number, m = 0, s = 0): number => SHIFT_START + ((h - 20 + 24) % 24) * HOUR + m * MINUTE + s * SECOND;

export const clock = (time: number): string => new Date(time).toISOString().slice(11, 19);
export const shortClock = (time: number): string => new Date(time).toISOString().slice(11, 16);

/** Deterministic pseudo-random generator (mulberry32). */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ site plan (metres, y down)

export const WORLD = { width: 1200, height: 780 } as const;
export const QUAY_EDGE = 1000;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface Building extends Rect {
  readonly id: string;
  readonly label: string;
  readonly kind: 'building' | 'post';
}
export interface Zone extends Rect {
  readonly id: string;
  readonly label: string;
}

/** Perimeter fence, open on the quay. The gate is the gap on the west side. */
export const fence: readonly (readonly [number, number])[][] = [
  [
    [QUAY_EDGE, 40],
    [40, 40],
    [40, 356],
  ],
  [
    [40, 404],
    [40, 740],
    [QUAY_EDGE, 740],
  ],
];
export const gate = { x: 40, y1: 356, y2: 404 } as const;

/** Road centre lines (width 14 m). */
export const roads: readonly (readonly [number, number])[][] = [
  [
    [0, 380],
    [860, 380],
  ],
  [
    [480, 70],
    [480, 710],
  ],
  [
    [90, 70],
    [860, 70],
    [860, 710],
    [90, 710],
    [90, 70],
  ],
  [
    [250, 380],
    [250, 350],
  ],
];

export const buildings: readonly Building[] = [
  { id: 'offices', label: 'Bureaux', kind: 'building', x: 130, y: 100, w: 200, h: 96 },
  { id: 'post', label: 'Poste de garde', kind: 'post', x: 54, y: 322, w: 46, h: 34 },
  { id: 'wa', label: 'Entrepôt A', kind: 'building', x: 540, y: 100, w: 280, h: 150 },
  { id: 'wb', label: 'Entrepôt B', kind: 'building', x: 540, y: 460, w: 280, h: 170 },
  { id: 'workshop', label: 'Atelier', kind: 'building', x: 140, y: 470, w: 200, h: 140 },
];

export const zones: readonly Zone[] = [
  { id: 'parking', label: 'Parking P1', x: 130, y: 226, w: 240, h: 124 },
  { id: 'quay1', label: 'Quai 1', x: 872, y: 50, w: 124, h: 312 },
  { id: 'quay2', label: 'Quai 2', x: 872, y: 400, w: 124, h: 330 },
  { id: 'guard', label: 'Accès', x: 44, y: 312, w: 116, h: 110 },
];

export const tanks: readonly { x: number; y: number; r: number }[] = [
  { x: 395, y: 560, r: 22 },
  { x: 395, y: 620, r: 22 },
];

/** Container stacks on the quays. */
export const containers: readonly Rect[] = (() => {
  const list: Rect[] = [];
  const rand = random(11);
  for (const [y0, y1] of [
    [96, 330],
    [470, 700],
  ] as const) {
    for (let y = y0; y < y1; y += 16) {
      for (const x of [884, 920]) {
        if (rand() < 0.18) continue;
        list.push({ x, y, w: 30, h: 12 });
      }
    }
  }
  return list;
})();

/** Dock doors of the warehouses (east face of B, south door A3 of A). */
export const doors = {
  a3: { x: 700, y: 250, label: 'Porte A3' },
  dock: { x: 820, y: 540, label: 'Quai de chargement B' },
} as const;

export const cranes: readonly { x: number; y: number }[] = [
  { x: 960, y: 210 },
  { x: 960, y: 580 },
];

// ------------------------------------------------------------------ cameras

export interface Camera {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Heading in degrees, 0 = east, clockwise (y down). */
  readonly heading: number;
  readonly fov: number;
  readonly range: number;
  /** Precomputed: heading in radians and half field of view. */
  readonly h: number;
  readonly half: number;
  readonly cos: number;
  readonly sin: number;
}

const camera = (code: string, label: string, x: number, y: number, heading: number, fov: number, range: number): Camera => {
  const h = (heading * Math.PI) / 180;
  return { id: `cam-${code}`, code, label, x, y, heading, fov, range, h, half: (fov * Math.PI) / 360, cos: Math.cos(h), sin: Math.sin(h) };
};

export const cameras: readonly Camera[] = [
  camera('C1', 'Portail', 150, 314, 152, 64, 175),
  camera('C2', 'Parking P1', 368, 214, 150, 76, 210),
  camera('C3', 'Clôture nord', 512, 56, 2, 46, 340),
  camera('C4', 'Porte A3', 612, 318, -32, 70, 190),
  camera('C5', 'Quai 1', 990, 336, -95, 46, 300),
  camera('C6', 'Docks B', 900, 418, 115, 70, 220),
  camera('C7', 'Carrefour', 420, 444, -40, 80, 170),
  camera('C8', 'Clôture ouest', 58, 724, -88, 42, 330),
];

/** True when (x, y) is inside the camera's field of view. */
export function inView(cam: Camera, x: number, y: number): boolean {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const forward = dx * cam.cos + dy * cam.sin;
  if (forward <= 2) return false;
  const dist2 = dx * dx + dy * dy;
  if (dist2 > cam.range * cam.range) return false;
  const lateral = -dx * cam.sin + dy * cam.cos;
  return Math.abs(Math.atan2(lateral, forward)) <= cam.half;
}

// ------------------------------------------------------------------ mobiles

export type PoiKind = 'patrol' | 'vehicle' | 'drone' | 'truck' | 'intruder' | 'car';

export interface Mission {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly label: string;
}

export interface Track {
  readonly times: Float64Array;
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Heading (radians) of each segment; a stop keeps the previous heading. */
  readonly headings: Float64Array;
  /** Speed (m/s) of each segment. */
  readonly speeds: Float64Array;
}

export interface Poi {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly kind: PoiKind;
  readonly kindLabel: string;
  readonly track: Track;
  /** Periods during which the mobile is on the map. */
  readonly presence: readonly (readonly [number, number])[];
  readonly missions: readonly Mission[];
  /** Height above ground (drone), metres. */
  readonly altitude: number;
}

/** Builds a trajectory from moves at a given speed and waits. */
class Route {
  private readonly points: number[] = [];
  private t: number;
  private x: number;
  private y: number;

  constructor(t: number, x: number, y: number) {
    this.t = t;
    this.x = x;
    this.y = y;
    this.points.push(t, x, y);
  }

  get time(): number {
    return this.t;
  }

  /** Moves through the points at `speed` m/s. */
  go(speed: number, ...path: (readonly [number, number])[]): this {
    for (const [x, y] of path) {
      const dist = Math.hypot(x - this.x, y - this.y);
      this.t += (dist / speed) * SECOND;
      this.x = x;
      this.y = y;
      this.points.push(this.t, x, y);
    }
    return this;
  }

  /** Stays in place until `time` (ignored if already past). */
  wait(time: number): this {
    if (time > this.t) {
      this.t = time;
      this.points.push(time, this.x, this.y);
    }
    return this;
  }

  /** Teleports (used when the mobile is not on the map). */
  jump(time: number, x: number, y: number): this {
    this.wait(time);
    this.t = time + 1;
    this.x = x;
    this.y = y;
    this.points.push(this.t, x, y);
    return this;
  }

  build(): Track {
    const n = this.points.length / 3;
    const times = new Float64Array(n);
    const xs = new Float64Array(n);
    const ys = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      times[i] = this.points[i * 3]!;
      xs[i] = this.points[i * 3 + 1]!;
      ys[i] = this.points[i * 3 + 2]!;
    }
    const headings = new Float64Array(Math.max(1, n - 1));
    const speeds = new Float64Array(Math.max(1, n - 1));
    let heading = 0;
    for (let i = 0; i < n - 1; i++) {
      const dx = xs[i + 1]! - xs[i]!;
      const dy = ys[i + 1]! - ys[i]!;
      const dt = (times[i + 1]! - times[i]!) / SECOND;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) heading = Math.atan2(dy, dx);
      headings[i] = heading;
      speeds[i] = dt > 0 && dist < 50 * dt ? dist / dt : 0;
    }
    // A stop at the start takes the heading of the first move.
    const first = speeds.findIndex((speed) => speed > 0);
    for (let i = 0; i < first; i++) headings[i] = headings[first]!;
    return { times, xs, ys, headings, speeds };
  }
}

/** Index of the segment containing `time` (binary search), clamped to the track. */
export function segmentAt(track: Track, time: number): number {
  const times = track.times;
  const last = times.length - 1;
  if (time <= times[0]!) return 0;
  if (time >= times[last]!) return Math.max(0, last - 1);
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (times[mid]! <= time) low = mid;
    else high = mid;
  }
  return low;
}

/** Writes the position at `time` into `out` ([x, y]) without allocating. */
export function positionAt(track: Track, time: number, out: Float64Array, offset = 0): number {
  const i = segmentAt(track, time);
  const t0 = track.times[i]!;
  const t1 = track.times[Math.min(i + 1, track.times.length - 1)]!;
  const u = t1 > t0 ? Math.min(1, Math.max(0, (time - t0) / (t1 - t0))) : 0;
  const j = Math.min(i + 1, track.xs.length - 1);
  out[offset] = track.xs[i]! + (track.xs[j]! - track.xs[i]!) * u;
  out[offset + 1] = track.ys[i]! + (track.ys[j]! - track.ys[i]!) * u;
  return i;
}

export function isPresent(poi: Poi, time: number): boolean {
  for (const [start, end] of poi.presence) if (time >= start && time < end) return true;
  return false;
}

/** Start of the presence period containing `time`, or `time` itself. */
export function presenceStart(poi: Poi, time: number): number {
  for (const [start, end] of poi.presence) if (time >= start && time < end) return start;
  return time;
}

const POST: [number, number] = [77, 340];
const PARK_VS: [number, number] = [128, 404];
const PAD: [number, number] = [232, 148];

/** One patrol round on foot along the service road, with a check at door A3. */
function patrolRound(route: Route, start: number, speed = 1.3): Route {
  return route
    .wait(start)
    .go(speed, [90, 372], [90, 70], [480, 70], [700, 70], [700, 90])
    .wait(route.time + 2 * MINUTE)
    .go(speed, [700, 70], [860, 70], [940, 70], [940, 380], [860, 380], [860, 270], [700, 270])
    .wait(route.time + 4 * MINUTE)
    .go(speed, [480, 270], [480, 380], [860, 380], [860, 710], [480, 710], [90, 710], [90, 400], POST);
}

function buildPatrol(): Poi {
  const r = new Route(SHIFT_START, ...POST);
  const missions: Mission[] = [];
  const round = (start: number, n: number) => {
    r.wait(start);
    const s = r.time;
    patrolRound(r, s);
    missions.push({ id: `m-pat-${n}`, start: s, end: r.time, label: `Ronde ${n}` });
  };
  round(at(20, 30), 1);
  round(at(22, 18), 2);
  round(at(0, 12), 3);
  // Response to the intrusion alarm: runs to door A3, secures it, walks back.
  r.wait(at(1, 16));
  const s = r.time;
  r.go(2.3, [110, 380], [480, 380], [480, 270], [690, 270], [700, 258]);
  r.wait(at(1, 47));
  r.go(1.3, [690, 270], [480, 270], [480, 380], [110, 380], POST);
  missions.push({ id: 'm-pat-alert', start: s, end: r.time, label: 'Levée de doute porte A3' });
  round(at(2, 50), 4);
  round(at(4, 35), 5);
  round(at(6, 20), 6);
  r.wait(SIM_END);
  return {
    id: 'pat',
    code: 'PAT-1',
    label: 'Agent Martin',
    kind: 'patrol',
    kindLabel: 'Patrouille à pied',
    track: r.build(),
    presence: [[SHIFT_START, SIM_END]],
    missions,
    altitude: 0,
  };
}

function buildVehicle(): Poi {
  const r = new Route(SHIFT_START, ...PARK_VS);
  const missions: Mission[] = [];
  const ring = (start: number, label: string, speed = 7) => {
    r.wait(start);
    const s = r.time;
    r.go(speed, [128, 380], [480, 380], [480, 70], [860, 70], [860, 710], [90, 710], [90, 70], [480, 70], [480, 380], [128, 380], PARK_VS);
    missions.push({ id: `m-vs-${missions.length}`, start: s, end: r.time, label });
  };
  ring(at(21, 10), 'Tournée véhicule');
  ring(at(22, 41), 'Escorte livraison', 5);
  ring(at(23, 52), 'Tournée véhicule');
  // Intrusion: heads to the north fence, then follows the intruder.
  r.wait(at(1, 13, 30));
  let s = r.time;
  r.go(9, [128, 380], [480, 380], [480, 70], [745, 70]);
  r.wait(at(1, 19));
  r.go(4, [835, 70], [860, 70], [860, 250]);
  r.wait(at(1, 24));
  r.go(6, [860, 70], [790, 70]);
  r.wait(at(1, 38));
  r.go(7, [480, 70], [480, 380], [128, 380], PARK_VS);
  missions.push({ id: 'm-vs-alert', start: s, end: r.time, label: 'Intervention clôture nord' });
  ring(at(3, 12), 'Tournée véhicule');
  ring(at(5, 5), 'Tournée véhicule');
  ring(at(7, 2), 'Tournée véhicule');
  s = r.time;
  r.wait(SIM_END);
  return {
    id: 'vs',
    code: 'VS-01',
    label: 'Véhicule de sécurité',
    kind: 'vehicle',
    kindLabel: 'Véhicule',
    track: r.build(),
    presence: [[SHIFT_START, SIM_END]],
    missions,
    altitude: 0,
  };
}

function buildDrone(): Poi {
  const r = new Route(SHIFT_START, ...PAD);
  const missions: Mission[] = [];
  const presence: [number, number][] = [];
  const flight = (start: number, label: string, path: [number, number][], speed = 6) => {
    r.wait(start);
    const s = r.time;
    r.go(speed, ...path, PAD);
    missions.push({ id: `m-dr-${missions.length}`, start: s, end: r.time, label });
    presence.push([s, r.time]);
  };
  const perimeter: [number, number][] = [
    [60, 60],
    [990, 60],
    [990, 720],
    [60, 720],
  ];
  flight(at(23, 38), 'Vol de contrôle', perimeter);
  // Intrusion: lift-off, hovers over door A3, then follows the escape.
  r.wait(at(1, 15));
  const s = r.time;
  r.go(8, [700, 280]);
  r.wait(at(1, 22, 30));
  r.go(4, [835, 250], [835, 70], [790, 40], [790, 10]);
  r.wait(at(1, 31));
  r.go(8, PAD);
  missions.push({ id: 'm-dr-alert', start: s, end: r.time, label: 'Levée de doute aérienne' });
  presence.push([s, r.time]);
  flight(at(3, 48), 'Vol de contrôle', perimeter);
  flight(at(6, 40), 'Vol de contrôle', perimeter);
  r.wait(SIM_END);
  return {
    id: 'dr',
    code: 'DR-1',
    label: 'Drone de surveillance',
    kind: 'drone',
    kindLabel: 'Drone',
    track: r.build(),
    presence,
    missions,
    altitude: 28,
  };
}

function buildTruck(): Poi {
  const r = new Route(SHIFT_START, -30, 380);
  const arrive = at(22, 38);
  r.jump(arrive, -30, 380);
  const s = r.time;
  r.go(8, [70, 380]);
  r.wait(at(22, 41, 30));
  const s2 = r.time;
  r.go(6, [480, 380], [860, 380], [860, 540], [836, 540]);
  const dock = r.time;
  r.wait(at(23, 26));
  const leave = r.time;
  r.go(5, [860, 540], [860, 380], [480, 380], [70, 380]);
  r.wait(r.time + 40 * SECOND);
  r.go(8, [-30, 380]);
  const end = r.time;
  r.wait(SIM_END);
  return {
    id: 'pl',
    code: 'PL-482',
    label: 'Camion de livraison',
    kind: 'truck',
    kindLabel: 'Poids lourd',
    track: r.build(),
    presence: [[s, end]],
    missions: [
      { id: 'm-pl-gate', start: s, end: s2, label: 'Contrôle au portail' },
      { id: 'm-pl-in', start: s2, end: dock, label: 'Accès' },
      { id: 'm-pl-dock', start: dock, end: leave, label: 'Déchargement quai B' },
      { id: 'm-pl-out', start: leave, end, label: 'Sortie' },
    ],
    altitude: 0,
  };
}

function buildIntruder(): Poi {
  const r = new Route(SHIFT_START, 745, -10);
  r.jump(at(1, 9, 20), 745, -6);
  const s = r.time;
  r.go(1, [745, 34]);
  r.wait(at(1, 12, 10));
  r.go(0.6, [745, 46]);
  r.go(1.6, [835, 60], [835, 262], [706, 262]);
  r.wait(at(1, 19, 40));
  r.go(0.8, [700, 244]);
  r.wait(at(1, 22, 10));
  r.go(3.2, [706, 262], [835, 262], [835, 70], [790, 46]);
  r.wait(at(1, 26, 40));
  r.go(0.5, [790, 34]);
  r.go(1.6, [790, -10]);
  const end = r.time;
  r.wait(SIM_END);
  return {
    id: 'int',
    code: 'INTRUS',
    label: 'Individu non identifié',
    kind: 'intruder',
    kindLabel: 'Intrus',
    track: r.build(),
    presence: [[s, end]],
    missions: [{ id: 'm-int', start: s, end, label: 'Présence non autorisée' }],
    altitude: 0,
  };
}

function buildRelief(): Poi {
  const r = new Route(SHIFT_START, -30, 380);
  r.jump(at(5, 31), -30, 380);
  const s = r.time;
  r.go(9, [70, 380]);
  r.wait(at(5, 33, 30));
  r.go(6, [250, 380], [250, 330], [300, 330], [300, 300]);
  const parked = r.time;
  r.wait(SIM_END);
  return {
    id: 'rel',
    code: 'REL-2',
    label: 'Voiture de la relève',
    kind: 'car',
    kindLabel: 'Véhicule léger',
    track: r.build(),
    presence: [[s, SIM_END]],
    missions: [
      { id: 'm-rel-in', start: s, end: parked, label: 'Arrivée relève' },
      { id: 'm-rel-park', start: parked, end: SIM_END, label: 'Stationnée P1' },
    ],
    altitude: 0,
  };
}

export const pois: readonly Poi[] = [buildPatrol(), buildVehicle(), buildDrone(), buildTruck(), buildIntruder(), buildRelief()];

// ------------------------------------------------------------------ incidents

export type AlarmKind = 'intrusion' | 'door' | 'signal';

export interface Incident {
  readonly id: string;
  readonly kind: AlarmKind;
  readonly rowId: string;
  readonly start: number;
  readonly end: number;
  readonly label: string;
  readonly place: string;
  readonly camera?: string;
}

export const incidents: readonly Incident[] = [
  { id: 'inc-fence', kind: 'intrusion', rowId: 'al-intrusion', start: at(1, 12, 20), end: at(1, 28, 30), label: 'Intrusion périmètre', place: 'Clôture nord', camera: 'cam-C3' },
  { id: 'inc-door', kind: 'door', rowId: 'al-access', start: at(1, 19, 40), end: at(1, 47), label: 'Porte forcée', place: 'Porte A3 — Entrepôt A', camera: 'cam-C4' },
  { id: 'inc-c6', kind: 'signal', rowId: 'al-video', start: at(2, 40), end: at(2, 58), label: 'Perte de signal', place: 'Caméra C6 — Docks B', camera: 'cam-C6' },
  { id: 'inc-c8', kind: 'signal', rowId: 'al-video', start: at(4, 10), end: at(4, 16, 30), label: 'Perte de signal', place: 'Caméra C8 — Clôture ouest', camera: 'cam-C8' },
];

/** Camera outages, from the signal-loss incidents. */
export const outages: ReadonlyMap<string, readonly Incident[]> = (() => {
  const map = new Map<string, Incident[]>();
  for (const incident of incidents) {
    if (incident.kind !== 'signal' || !incident.camera) continue;
    const list = map.get(incident.camera) ?? [];
    list.push(incident);
    map.set(incident.camera, list);
  }
  return map;
})();

export function isLost(cameraId: string, time: number): boolean {
  const list = outages.get(cameraId);
  if (!list) return false;
  for (const o of list) if (time >= o.start && time < o.end) return true;
  return false;
}

// ------------------------------------------------------------------ detections

export interface Detection {
  readonly at: number;
  readonly camera: string;
  /** Mobile seen, or null for an environmental trigger. */
  readonly poi: string | null;
  readonly label: string;
}

export interface Recording {
  readonly start: number;
  readonly end: number;
}

const SAMPLE = 5 * SECOND;

/**
 * Motion detections: a moving mobile entering a camera's field of view, plus
 * environmental triggers (wildlife, a squall on the quays).
 */
function computeDetections(): Map<string, Detection[]> {
  const byCamera = new Map<string, Detection[]>(cameras.map((cam) => [cam.id, []]));
  const pos = new Float64Array(2);
  const lastSeen = new Float64Array(cameras.length * pois.length).fill(-Infinity);
  for (let t = SHIFT_START; t < SIM_END; t += SAMPLE) {
    pois.forEach((poi, p) => {
      if (!isPresent(poi, t)) return;
      const seg = positionAt(poi.track, t, pos);
      if (poi.track.speeds[seg]! < 0.3) return;
      cameras.forEach((cam, c) => {
        if (isLost(cam.id, t) || !inView(cam, pos[0]!, pos[1]!)) return;
        const k = c * pois.length + p;
        if (t - lastSeen[k]! > 20 * SECOND) {
          byCamera.get(cam.id)!.push({ at: t, camera: cam.id, poi: poi.id, label: `Mouvement · ${poi.code}` });
        }
        lastSeen[k] = t;
      });
    });
  }
  const rand = random(2026);
  const causes = ['Faune', 'Végétation', 'Reflet', 'Faune'];
  for (const cam of cameras) {
    const list = byCamera.get(cam.id)!;
    let t = SHIFT_START + rand() * 30 * MINUTE;
    while (t < SIM_END) {
      const rounded = Math.round(t / SECOND) * SECOND;
      if (!isLost(cam.id, rounded)) list.push({ at: rounded, camera: cam.id, poi: null, label: `Mouvement · ${causes[Math.floor(rand() * causes.length)]}` });
      t += (14 + rand() * 50) * MINUTE;
    }
    // Squall on the quays: dense spurious detections, grouped below.
    if (cam.id === 'cam-C5' || cam.id === 'cam-C6' || cam.id === 'cam-C3') {
      let s = at(3, 4) + rand() * 2 * MINUTE;
      while (s < at(3, 24)) {
        const rounded = Math.round(s / SECOND) * SECOND;
        if (!isLost(cam.id, rounded)) list.push({ at: rounded, camera: cam.id, poi: null, label: 'Mouvement · Pluie' });
        s += (10 + rand() * 40) * SECOND;
      }
    }
    list.sort((a, b) => a.at - b.at);
  }
  return byCamera;
}

export const detections = computeDetections();

/** Motion-triggered recordings: 10 s before, 40 s after the last detection, merged, cut by outages. */
function computeRecordings(): Map<string, Recording[]> {
  const map = new Map<string, Recording[]>();
  for (const cam of cameras) {
    const list: Recording[] = [];
    let current: { start: number; end: number } | null = null;
    const pos = new Float64Array(2);
    for (const d of detections.get(cam.id)!) {
      // Keep recording while the mobile stays in view.
      let end = d.at + 40 * SECOND;
      const poi = d.poi ? pois.find((p) => p.id === d.poi) : undefined;
      if (poi) {
        let t = d.at;
        while (t < SIM_END && isPresent(poi, t)) {
          const seg = positionAt(poi.track, t, pos);
          if (!inView(cam, pos[0]!, pos[1]!) || poi.track.speeds[seg]! < 0.3) break;
          t += SAMPLE;
        }
        end = Math.max(end, t + 30 * SECOND);
      }
      const start = d.at - 10 * SECOND;
      if (current && start <= current.end + 15 * SECOND) current.end = Math.max(current.end, end);
      else {
        if (current) list.push(current);
        current = { start, end };
      }
    }
    if (current) list.push(current);
    // Cut by outages.
    const cut: Recording[] = [];
    for (const rec of list) {
      let pieces: Recording[] = [rec];
      for (const o of outages.get(cam.id) ?? []) {
        pieces = pieces.flatMap((p) => {
          if (o.end <= p.start || o.start >= p.end) return [p];
          const out: Recording[] = [];
          if (o.start > p.start) out.push({ start: p.start, end: o.start });
          if (o.end < p.end) out.push({ start: o.end, end: p.end });
          return out;
        });
      }
      cut.push(...pieces);
    }
    map.set(cam.id, cut);
  }
  return map;
}

export const recordings = computeRecordings();

/** True when the camera records at `time` (binary search over its recordings). */
export function isRecording(cameraId: string, time: number): boolean {
  const list = recordings.get(cameraId);
  if (!list || list.length === 0) return false;
  let low = 0;
  let high = list.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    const rec = list[mid]!;
    if (time < rec.start) high = mid - 1;
    else if (time >= rec.end) low = mid + 1;
    else return true;
  }
  return false;
}

// ------------------------------------------------------------------ timeline model

export interface RowInfo {
  readonly kind: 'group' | 'camera' | 'poi' | 'alarm';
  readonly ref?: string;
}

export interface ItemInfo {
  readonly kind: 'recording' | 'motion' | 'burst' | 'mission' | 'alarm' | 'incident';
  readonly camera?: string;
  readonly poi?: string;
  readonly alarm?: AlarmKind;
  readonly incident?: string;
}

export const rows: TimelineRow<RowInfo>[] = [
  { id: 'cams', label: 'Caméras', meta: { kind: 'group' } },
  ...cameras.map((cam) => ({ id: cam.id, label: `${cam.code} · ${cam.label}`, parentId: 'cams', meta: { kind: 'camera' as const, ref: cam.id } })),
  { id: 'mobiles', label: 'Mobiles', meta: { kind: 'group' } },
  ...pois.map((poi) => ({ id: `row-${poi.id}`, label: `${poi.code} · ${poi.kindLabel}`, parentId: 'mobiles', meta: { kind: 'poi' as const, ref: poi.id } })),
  { id: 'alarms', label: 'Alarmes', meta: { kind: 'group' } },
  { id: 'al-intrusion', label: 'Intrusion', parentId: 'alarms', meta: { kind: 'alarm' } },
  { id: 'al-access', label: 'Contrôle d’accès', parentId: 'alarms', meta: { kind: 'alarm' } },
  { id: 'al-video', label: 'Supervision vidéo', parentId: 'alarms', meta: { kind: 'alarm' } },
];

export const keys: TimelineKey[] = incidents.map((incident) => ({
  id: `k-${incident.id}`,
  at: incident.start,
  label: `${incident.label} — ${incident.place}`,
}));

export const highlights: NonNullable<TimelineProps['highlights']> = incidents.map((incident) => ({
  id: `h-${incident.id}`,
  start: incident.start,
  end: incident.end,
  label: incident.label,
  tone: incident.kind === 'signal' ? ('warning' as const) : ('danger' as const),
}));

const BURST_GAP = 2 * MINUTE;
const BURST_MIN = 2;

/**
 * Items known at `until` (the live frontier): later items are left out and
 * spans in progress are cut at the frontier. Ids are stable, so a stream can
 * upsert only what changed.
 */
export function buildItems(until: number): TimelineItem<ItemInfo>[] {
  const items: TimelineItem<ItemInfo>[] = [];
  const clip = (end: number) => Math.min(end, until);
  for (const cam of cameras) {
    recordings.get(cam.id)!.forEach((rec, i) => {
      if (rec.start >= until || clip(rec.end) <= rec.start) return;
      items.push({ id: `rec-${cam.code}-${i}`, rowId: cam.id, start: rec.start, end: clip(rec.end), label: 'Enregistrement', meta: { kind: 'recording', camera: cam.id } });
    });
    // Bursts are grouped by the application: dense detections become one group.
    const list = detections.get(cam.id)!;
    let i = 0;
    while (i < list.length && list[i]!.at < until) {
      let j = i + 1;
      while (j < list.length && list[j]!.at < until && list[j]!.at - list[j - 1]!.at < BURST_GAP) j++;
      const first = list[i]!;
      if (j - i >= BURST_MIN) {
        const last = list[j - 1]!;
        items.push({
          id: `burst-${cam.code}-${i}`,
          rowId: cam.id,
          start: first.at,
          end: Math.max(clip(last.at + 20 * SECOND), first.at + SECOND),
          label: j - i >= 6 ? 'Rafale de détections' : 'Détections',
          group: { count: j - i },
          meta: { kind: 'burst', camera: cam.id },
        });
      } else {
        for (let k = i; k < j; k++) {
          const d = list[k]!;
          items.push({ id: `mot-${cam.code}-${k}`, rowId: cam.id, at: d.at, label: d.label, meta: { kind: 'motion', camera: cam.id, poi: d.poi ?? undefined } });
        }
      }
      i = j;
    }
  }
  for (const poi of pois) {
    for (const m of poi.missions) {
      if (m.start >= until) continue;
      items.push({ id: m.id, rowId: `row-${poi.id}`, start: m.start, end: Math.max(clip(m.end), m.start + SECOND), label: m.label, meta: { kind: 'mission', poi: poi.id } });
    }
  }
  for (const incident of incidents) {
    if (incident.start >= until) continue;
    items.push({
      id: incident.id,
      rowId: incident.rowId,
      start: incident.start,
      end: clip(incident.end),
      label: `${incident.label} · ${incident.place}`,
      meta: { kind: 'alarm', alarm: incident.kind, incident: incident.id, camera: incident.camera },
    });
    items.push({ id: `${incident.id}-sum`, rowId: 'alarms', start: incident.start, end: clip(incident.end), label: incident.label, meta: { kind: 'incident', alarm: incident.kind, incident: incident.id } });
  }
  return items;
}

/** The mission of a mobile at `time`, or the closest one. */
export function missionFor(poi: Poi, time: number): Mission | undefined {
  let best: Mission | undefined;
  let distance = Infinity;
  for (const m of poi.missions) {
    if (time >= m.start && time < m.end) return m;
    const d = Math.min(Math.abs(time - m.start), Math.abs(time - m.end));
    if (d < distance) {
      distance = d;
      best = m;
    }
  }
  return best;
}

// ------------------------------------------------------------------ application state at a time

/**
 * State of the site at one instant. Two instances are kept: one prepared for
 * the requested time, one shown for the confirmed time. Arrays are reused.
 */
export class SiteState {
  time = Number.NaN;
  readonly x = new Float64Array(pois.length);
  readonly y = new Float64Array(pois.length);
  readonly heading = new Float64Array(pois.length);
  readonly speed = new Float64Array(pois.length);
  readonly present = new Uint8Array(pois.length);
  /** Per camera: bit mask of the mobiles moving in its field of view. */
  readonly motion = new Uint32Array(cameras.length);
  /** Per camera: bit mask of the mobiles in its field of view (moving or not). */
  readonly inView = new Uint32Array(cameras.length);
  readonly recording = new Uint8Array(cameras.length);
  readonly lost = new Uint8Array(cameras.length);
  alarms: readonly Incident[] = [];
  /** Changes only when the set of active alarms changes. */
  alarmKey = '';
  private readonly pos = new Float64Array(2);

  compute(time: number): this {
    this.time = time;
    const pos = this.pos;
    for (let p = 0; p < pois.length; p++) {
      const poi = pois[p]!;
      const seg = positionAt(poi.track, time, pos);
      this.x[p] = pos[0]!;
      this.y[p] = pos[1]!;
      this.heading[p] = poi.track.headings[seg]!;
      this.speed[p] = time >= poi.track.times[poi.track.times.length - 1]! ? 0 : poi.track.speeds[seg]!;
      this.present[p] = isPresent(poi, time) ? 1 : 0;
    }
    for (let c = 0; c < cameras.length; c++) {
      const cam = cameras[c]!;
      const lost = isLost(cam.id, time);
      this.lost[c] = lost ? 1 : 0;
      this.recording[c] = !lost && isRecording(cam.id, time) ? 1 : 0;
      let motion = 0;
      let seen = 0;
      if (!lost) {
        for (let p = 0; p < pois.length; p++) {
          if (!this.present[p] || !inView(cam, this.x[p]!, this.y[p]!)) continue;
          seen |= 1 << p;
          if (this.speed[p]! > 0.3) motion |= 1 << p;
        }
      }
      this.motion[c] = motion;
      this.inView[c] = seen;
    }
    let key = '';
    let active: Incident[] | null = null;
    for (const incident of incidents) {
      if (time >= incident.start && time < incident.end) {
        (active ??= []).push(incident);
        key += `${incident.id};`;
      }
    }
    if (key !== this.alarmKey) {
      this.alarmKey = key;
      this.alarms = active ?? [];
    }
    return this;
  }
}
