import { QUAY_EDGE, WORLD, buildings, cameras, clock, containers, cranes, fence, pois, roads, tanks, zones } from './data';
import type { Camera, SiteState } from './data';

/*
 * Simulated camera feeds on <canvas>. The ground seen by each camera is
 * ray-cast once from a raster of the site plan into a cached background; each
 * frame only draws the mobiles, the noise and the overlays.
 */

let worldRaster: HTMLCanvasElement | null = null;

/** Night, monochrome raster of the site plan (1 px = 1 m), built once. */
function world(): HTMLCanvasElement {
  if (worldRaster) return worldRaster;
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.width;
  canvas.height = WORLD.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  // Soil texture.
  for (let i = 0; i < 2600; i++) {
    const v = 34 + ((i * 2654435761) % 18);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect((i * 7919) % WORLD.width, (i * 104729) % WORLD.height, 3, 3);
  }
  ctx.fillStyle = '#121212';
  ctx.fillRect(QUAY_EDGE, 0, WORLD.width - QUAY_EDGE, WORLD.height);
  ctx.fillStyle = '#4a4a4a';
  for (const z of zones) if (z.id.startsWith('quay')) ctx.fillRect(z.x, z.y, z.w, z.h);
  ctx.strokeStyle = '#5c5c5c';
  ctx.lineWidth = 14;
  ctx.lineJoin = 'round';
  for (const road of roads) {
    ctx.beginPath();
    road.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.strokeStyle = '#8a8a8a';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 8]);
  for (const road of roads) {
    ctx.beginPath();
    road.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const parking = zones.find((z) => z.id === 'parking')!;
  ctx.fillStyle = '#3e3e3e';
  ctx.fillRect(parking.x, parking.y, parking.w, parking.h);
  ctx.strokeStyle = '#9a9a9a';
  for (let x = parking.x + 8; x < parking.x + parking.w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, parking.y + 4);
    ctx.lineTo(x, parking.y + 40);
    ctx.moveTo(x, parking.y + parking.h - 40);
    ctx.lineTo(x, parking.y + parking.h - 4);
    ctx.stroke();
  }
  for (const b of buildings) {
    ctx.fillStyle = b.kind === 'post' ? '#8c8c8c' : '#6e6e6e';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#7c7c7c';
    for (let x = b.x + 10; x < b.x + b.w - 6; x += 20) ctx.fillRect(x, b.y + 4, 2, b.h - 8);
  }
  ctx.fillStyle = '#909090';
  for (const c of containers) ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = '#777';
  for (const t of tanks) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#a0a0a0';
  ctx.lineWidth = 3;
  for (const c of cranes) {
    ctx.strokeRect(c.x - 30, c.y - 12, 60, 24);
  }
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 2;
  for (const line of fence) {
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  // Light pools of the street lamps.
  ctx.globalCompositeOperation = 'lighter';
  const lamp = (x: number, y: number, r: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(90,90,90,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let x = 120; x < 860; x += 120) lamp(x, 372, 34);
  for (let y = 110; y < 700; y += 120) lamp(472, y, 30);
  for (let y = 90; y < 720; y += 90) lamp(990, y, 36);
  lamp(80, 380, 50);
  ctx.globalCompositeOperation = 'source-over';
  worldRaster = canvas;
  return canvas;
}

/** Camera optics for one output size. */
interface Optics {
  readonly f: number;
  readonly cx: number;
  readonly cy: number;
  readonly cos: number;
  readonly sin: number;
  readonly hc: number;
}

const MOUNT = 7;

function optics(cam: Camera, width: number, height: number): Optics {
  const f = width / 2 / Math.tan(cam.half);
  // Tilt so that ~45 % of the range sits at the image centre.
  const pitch = Math.atan(MOUNT / (cam.range * 0.38));
  return { f, cx: width / 2, cy: height / 2, cos: Math.cos(pitch), sin: Math.sin(pitch), hc: MOUNT };
}

const backgrounds = new Map<string, HTMLCanvasElement>();

/** Ground and sky seen by the camera, ray-cast once per camera and size. */
function background(cam: Camera, width: number, height: number): HTMLCanvasElement {
  const key = `${cam.id}:${width}x${height}`;
  const cached = backgrounds.get(key);
  if (cached) return cached;
  const src = world();
  const srcData = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);
  const out = image.data;
  const o = optics(cam, width, height);
  for (let y = 0; y < height; y++) {
    const v = (y - o.cy) / o.f;
    const down = o.sin + v * o.cos;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const vignette = 1 - 0.55 * (((x - o.cx) / width) ** 2 * 2 + ((y - o.cy) / height) ** 2 * 2);
      let lum: number;
      if (down <= 0.0005) {
        // Sky: faint glow near the horizon.
        lum = 10 + 16 * Math.max(0, 1 + down * 12);
      } else {
        const s = o.hc / down;
        const forward = s * (o.cos - v * o.sin);
        const lateral = s * ((x - o.cx) / o.f);
        const wx = Math.round(cam.x + forward * cam.cos - lateral * cam.sin);
        const wy = Math.round(cam.y + forward * cam.sin + lateral * cam.cos);
        const ground = wx >= 0 && wy >= 0 && wx < src.width && wy < src.height ? srcData[(wy * src.width + wx) * 4]! : 30;
        const fog = Math.min(1, Math.max(0, (forward - cam.range * 0.65) / (cam.range * 0.9)));
        lum = ground * (1 - fog) + 22 * fog;
      }
      lum *= vignette;
      out[i] = lum * 0.78;
      out[i + 1] = lum * 0.96;
      out[i + 2] = lum * 0.9;
      out[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  backgrounds.set(key, canvas);
  return canvas;
}

let noiseTile: HTMLCanvasElement | null = null;
function noise(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(128, 128);
  let seed = 1234567;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const v = seed >>> 24;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  noiseTile = canvas;
  return canvas;
}

const scanlines = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();
function scanlinePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const cached = scanlines.get(ctx);
  if (cached) return cached;
  const tile = document.createElement('canvas');
  tile.width = 1;
  tile.height = 3;
  const t = tile.getContext('2d')!;
  t.fillStyle = 'rgba(0,0,0,0.28)';
  t.fillRect(0, 0, 1, 1);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) scanlines.set(ctx, pattern);
  return pattern;
}

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const DATE_FMT = (time: number) => `${new Date(time).toISOString().slice(0, 10)} ${clock(time)} UTC`;

export interface FeedOptions {
  readonly reducedMotion: boolean;
  /** Frame counter for the noise offset; constant when motion is reduced. */
  readonly frame: number;
  readonly large: boolean;
}

/** Draws the feed of camera `c` for the confirmed state. */
export function drawFeed(ctx: CanvasRenderingContext2D, c: number, state: SiteState, options: FeedOptions): void {
  const cam = cameras[c]!;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const scale = width / 320;
  const n = noise();
  const frame = options.reducedMotion ? 0 : options.frame;
  const ox = (frame * 37) % 128;
  const oy = (frame * 61) % 128;

  if (state.lost[c]) {
    ctx.fillStyle = '#16191d';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 0.5;
    for (let y = -oy; y < height; y += 128) for (let x = -ox; x < width; x += 128) ctx.drawImage(n, x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(13,17,23,0.72)';
    const bh = 34 * scale;
    ctx.fillRect(0, height / 2 - bh / 2, width, bh);
    ctx.fillStyle = '#f85149';
    ctx.font = `600 ${Math.round(14 * scale)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SIGNAL PERDU', width / 2, height / 2);
    ctx.textAlign = 'left';
    overlays(ctx, cam, state, c, scale, width, height);
    return;
  }

  ctx.drawImage(background(cam, width, height), 0, 0);

  // Mobiles, far ones first.
  const o = optics(cam, width, height);
  const order = sortedByDistance(cam, state);
  for (const p of order) {
    const poi = pois[p]!;
    const dx = state.x[p]! - cam.x;
    const dy = state.y[p]! - cam.y;
    const forward = dx * cam.cos + dy * cam.sin;
    const lateral = -dx * cam.sin + dy * cam.cos;
    if (forward < 3 || forward > cam.range * 1.15) continue;
    const footX = project(o, forward, lateral, 0);
    if (footX === null) continue;
    const [sx, syGround] = footX;
    if (sx < -40 * scale || sx > width + 40 * scale) continue;
    const kind = poi.kind;
    const altitude = poi.altitude;
    const dims = kind === 'patrol' || kind === 'intruder' ? [0.6, 1.8] : kind === 'truck' ? [2.6, 3.8] : kind === 'drone' ? [0.9, 0.4] : [1.9, 1.5];
    const top = project(o, forward, lateral, altitude + dims[1]!);
    const base = altitude ? project(o, forward, lateral, altitude) : footX;
    if (!top || !base) continue;
    const h = Math.max(3 * scale, base[1] - top[1]);
    const w = Math.max(2 * scale, (dims[0]! / dims[1]!) * h * (kind === 'patrol' || kind === 'intruder' ? 1 : 1.6));
    const y0 = base[1] - h;
    const warm = kind === 'intruder' || kind === 'patrol' ? '#f2fff6' : '#d4e3dc';
    ctx.fillStyle = warm;
    if (kind === 'patrol' || kind === 'intruder') {
      const head = w * 0.55;
      ctx.beginPath();
      ctx.arc(sx, y0 + head * 0.6, head * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sx - w / 2, y0 + head * 1.1, w, h - head * 1.1);
    } else if (kind === 'drone') {
      ctx.fillRect(sx - w / 2, y0, w, Math.max(2, h));
      ctx.fillRect(sx - w, y0 - 1, w * 2, Math.max(1, scale));
    } else {
      ctx.fillRect(sx - w / 2, y0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - w / 2 + 1, y0 + h * 0.6, Math.max(1.5, w * 0.12), Math.max(1.5, h * 0.14));
      ctx.fillRect(sx + w / 2 - 1 - Math.max(1.5, w * 0.12), y0 + h * 0.6, Math.max(1.5, w * 0.12), Math.max(1.5, h * 0.14));
    }
    // Analytics box around moving mobiles.
    if (state.motion[c]! & (1 << p)) {
      const pad = 3 * scale;
      ctx.strokeStyle = kind === 'intruder' ? '#f85149' : '#3fb950';
      ctx.lineWidth = Math.max(1, scale);
      ctx.strokeRect(sx - w / 2 - pad, y0 - pad, w + pad * 2, h + pad * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = `500 ${Math.round(8 * scale)}px ${MONO}`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(poi.code, sx - w / 2 - pad, y0 - pad - 1);
    }
    void syGround;
  }

  // Sensor noise and scanlines.
  ctx.globalAlpha = 0.09;
  ctx.globalCompositeOperation = 'screen';
  for (let y = -oy; y < height; y += 128) for (let x = -ox; x < width; x += 128) ctx.drawImage(n, x, y);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const pattern = scanlinePattern(ctx);
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
  overlays(ctx, cam, state, c, scale, width, height);
}

function overlays(ctx: CanvasRenderingContext2D, cam: Camera, state: SiteState, c: number, scale: number, width: number, height: number) {
  const pad = 7 * scale;
  ctx.textBaseline = 'top';
  ctx.font = `600 ${Math.round(9.5 * scale)}px ${MONO}`;
  label(ctx, `${cam.code} · ${cam.label.toUpperCase()}`, pad, pad, '#e6edf3');
  ctx.font = `500 ${Math.round(8.5 * scale)}px ${MONO}`;
  ctx.textBaseline = 'bottom';
  label(ctx, DATE_FMT(state.time), pad, height - pad, '#e6edf3');
  if (state.recording[c]) {
    ctx.textBaseline = 'top';
    ctx.font = `600 ${Math.round(9 * scale)}px ${MONO}`;
    const text = '● REC';
    const w = ctx.measureText(text).width;
    label(ctx, text, width - pad - w, pad, '#ff7b72');
  }
  if (state.motion[c] && !state.lost[c]) {
    ctx.textBaseline = 'bottom';
    ctx.font = `600 ${Math.round(8 * scale)}px ${MONO}`;
    const text = 'MOUVEMENT';
    const w = ctx.measureText(text).width;
    label(ctx, text, width - pad - w, height - pad, '#e3b341');
  }
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.fillStyle = 'rgba(1,4,9,0.55)';
  const w = ctx.measureText(text).width;
  const fontSize = parseFloat(ctx.font.split(' ')[1] ?? '10');
  const top = ctx.textBaseline === 'bottom' ? y - fontSize - 2 : y - 2;
  ctx.fillRect(x - 3, top, w + 6, fontSize + 4);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function project(o: Optics, forward: number, lateral: number, height: number): [number, number] | null {
  const up = height - o.hc;
  const z = forward * o.cos - up * o.sin;
  if (z <= 0.5) return null;
  const down = -forward * o.sin - up * o.cos;
  return [o.cx + (o.f * lateral) / z, o.cy + (o.f * down) / z];
}

const order: number[] = [];
const distances = new Float64Array(pois.length);
function sortedByDistance(cam: Camera, state: SiteState): number[] {
  order.length = 0;
  for (let p = 0; p < pois.length; p++) {
    if (!state.present[p]) continue;
    distances[p] = Math.hypot(state.x[p]! - cam.x, state.y[p]! - cam.y);
    order.push(p);
  }
  order.sort((a, b) => distances[b]! - distances[a]!);
  return order;
}
