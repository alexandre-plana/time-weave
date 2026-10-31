import type { TimelineItem, TimelineKey, TimelineRow } from 'time-weave';

/** Deterministic pseudo-random generator so every run shows the same day. */
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

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY_START = Date.UTC(2026, 9, 18);
/** End of the recorded history; the simulated stream continues after it. */
export const HISTORY_END = DAY_START + 18 * HOUR;

export const TYPES = ['MQTT', 'LoRa', 'Modbus', 'OPC UA', 'BACnet', 'Zigbee', 'SNMP', 'HTTP', 'CAN', 'Série'];
export const CONNECTORS_PER_TYPE = 20;

export interface RowInfo {
  readonly kind: 'station' | 'type' | 'connector';
  readonly type?: number;
}

export interface Communication {
  readonly id: string;
  readonly at: number;
  readonly connector: string;
  readonly value: number;
  readonly alarm: boolean;
}

export interface ItemInfo {
  readonly kind: 'communication' | 'group' | 'summary' | 'incident';
  readonly communication?: Communication;
  readonly connector?: string;
}

export interface Incident {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly label: string;
}

export const rows: TimelineRow<RowInfo>[] = [{ id: 'station', label: 'Station Nord', meta: { kind: 'station' } }];
TYPES.forEach((name, type) => {
  rows.push({ id: `t${type}`, label: `Réseau ${name}`, parentId: 'station', meta: { kind: 'type', type } });
  for (let c = 0; c < CONNECTORS_PER_TYPE; c++) {
    const id = `c${type}-${String(c).padStart(2, '0')}`;
    rows.push({ id, label: `${name.slice(0, 3).toUpperCase()}-${String(c + 1).padStart(3, '0')}`, parentId: `t${type}`, meta: { kind: 'connector', type } });
  }
});

export const incidents: Incident[] = [
  { id: 'inc-1', start: DAY_START + 2 * HOUR + 10 * MINUTE, end: DAY_START + 2 * HOUR + 55 * MINUTE, label: 'Perte de liaison LoRa' },
  { id: 'inc-2', start: DAY_START + 8 * HOUR, end: DAY_START + 8 * HOUR + 30 * MINUTE, label: 'Pic de charge' },
  { id: 'inc-3', start: DAY_START + 11 * HOUR + 40 * MINUTE, end: DAY_START + 12 * HOUR + 5 * MINUTE, label: 'Alarme température' },
  { id: 'inc-4', start: DAY_START + 14 * HOUR, end: DAY_START + 15 * HOUR + 20 * MINUTE, label: 'Maintenance planifiée' },
  { id: 'inc-5', start: DAY_START + 16 * HOUR + 45 * MINUTE, end: DAY_START + 17 * HOUR, label: 'Redémarrage passerelle' },
];

export const keys: TimelineKey[] = [
  { id: 'k-start', at: DAY_START + 6 * HOUR, label: 'Prise de poste' },
  ...incidents.map((incident) => ({ id: `k-${incident.id}`, at: incident.start, label: incident.label })),
];

/**
 * Application store: communications per connector, sorted by time.
 * The timeline never sees it directly; the window provider below reads it.
 */
export class CommunicationStore {
  private readonly byConnector = new Map<string, Communication[]>();
  private sequence = 0;
  private readonly next = random(7);
  latest = DAY_START;

  constructor() {
    const rand = random(42);
    for (const row of rows) {
      if (row.meta?.kind !== 'connector') continue;
      const list: Communication[] = [];
      const mean = (90 + rand() * 500) * 1000;
      let t = DAY_START + rand() * mean;
      while (t < HISTORY_END) {
        const dense = incidents.some((incident) => t >= incident.start && t < incident.end);
        list.push(this.make(row.id, t, rand));
        t += -Math.log(1 - rand()) * (dense ? mean / 6 : mean);
      }
      this.byConnector.set(row.id, list);
    }
    this.latest = HISTORY_END;
  }

  private make(connector: string, at: number, rand: () => number): Communication {
    return { id: `m${++this.sequence}`, at: Math.round(at), connector, value: Math.round(rand() * 1000) / 10, alarm: rand() < 0.03 };
  }

  get size(): number {
    let total = 0;
    for (const list of this.byConnector.values()) total += list.length;
    return total;
  }

  /** Simulated stream: a few communications, sometimes late, up to `until`. */
  append(until: number, count: number): void {
    const connectors = Array.from(this.byConnector.keys());
    for (let i = 0; i < count; i++) {
      const connector = connectors[Math.floor(this.next() * connectors.length)]!;
      const late = this.next() < 0.2;
      const at = late ? until - this.next() * 20_000 : this.latest + this.next() * (until - this.latest);
      const list = this.byConnector.get(connector)!;
      const communication = this.make(connector, at, this.next);
      const index = lowerIndex(list, communication.at);
      list.splice(index, 0, communication);
    }
    this.latest = Math.max(this.latest, until);
  }

  range(connector: string, start: number, end: number): Communication[] {
    const list = this.byConnector.get(connector) ?? [];
    return list.slice(lowerIndex(list, start), lowerIndex(list, end + 1));
  }

  count(connector: string, start: number, end: number): number {
    const list = this.byConnector.get(connector) ?? [];
    return lowerIndex(list, end) - lowerIndex(list, start);
  }

  lastBefore(connector: string, time: number): Communication | undefined {
    const list = this.byConnector.get(connector) ?? [];
    return list[lowerIndex(list, time + 1) - 1];
  }
}

function lowerIndex(list: readonly Communication[], time: number): number {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (list[mid]!.at < time) low = mid + 1;
    else high = mid;
  }
  return low;
}

const BINS = [1_000, 5_000, 15_000, 30_000, MINUTE, 5 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR];

/** Grouping chosen by the application for a visible duration: one bin per ~16 px of screen, at most 70. */
export function binFor(visibleDuration: number): number {
  const bins = typeof innerWidth === 'number' ? Math.max(16, Math.min(70, Math.round((innerWidth - 300) / 16))) : 70;
  const wanted = visibleDuration / bins;
  if (wanted < 500) return 0;
  return BINS.find((bin) => bin >= wanted) ?? BINS[BINS.length - 1]!;
}

/**
 * Builds the items of a window: individual communications when zoomed in,
 * groups otherwise; type rows always receive a summary prepared here.
 */
export function buildItems(
  store: CommunicationStore,
  range: { start: number; end: number },
  bin: number,
  expanded: ReadonlySet<string>,
): TimelineItem<ItemInfo>[] {
  const items: TimelineItem<ItemInfo>[] = [];
  for (const incident of incidents) {
    if (incident.end >= range.start && incident.start <= range.end) {
      items.push({ id: incident.id, rowId: 'station', start: incident.start, end: incident.end, label: incident.label, meta: { kind: 'incident' } });
    }
  }
  const summaryBin = bin || 30_000;
  const first = Math.floor(range.start / summaryBin) * summaryBin;
  TYPES.forEach((_, type) => {
    const typeId = `t${type}`;
    const connectors = rows.filter((row) => row.parentId === typeId).map((row) => row.id);
    for (let start = first; start < range.end; start += summaryBin) {
      let count = 0;
      for (const connector of connectors) count += store.count(connector, start, start + summaryBin);
      if (count > 0) {
        items.push({ id: `${typeId}@${summaryBin}:${start}`, rowId: typeId, start, end: start + summaryBin, group: { count }, meta: { kind: 'summary' } });
      }
    }
    if (!expanded.has(typeId)) return;
    for (const connector of connectors) {
      const communications = store.range(connector, range.start, range.end);
      if (!bin) {
        for (const c of communications) {
          items.push({ id: c.id, rowId: connector, at: c.at, label: `${c.value}`, meta: { kind: 'communication', communication: c, connector } });
        }
        continue;
      }
      let index = 0;
      while (index < communications.length) {
        const binStart = Math.floor(communications[index]!.at / bin) * bin;
        let end = index;
        while (end < communications.length && communications[end]!.at < binStart + bin) end++;
        const count = end - index;
        const c = communications[index]!;
        if (count === 1) {
          items.push({ id: c.id, rowId: connector, at: c.at, label: `${c.value}`, meta: { kind: 'communication', communication: c, connector } });
        } else {
          items.push({
            id: `${connector}@${bin}:${binStart}`,
            rowId: connector,
            start: binStart,
            end: binStart + bin,
            group: { count },
            meta: { kind: 'group', connector },
          });
        }
        index = end;
      }
    }
  });
  return items;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      },
      { once: true },
    );
  });
}
