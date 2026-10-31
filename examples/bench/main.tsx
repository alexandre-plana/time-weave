import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaybackControls, Timeline, frenchLabels, useTimelineController } from 'time-weave';
import type { TimeRequest, TimelineController, TimelineItem, TimelineRow, WindowRequest } from 'time-weave';
import 'time-weave/styles.css';
import '../shared.css';

/* Reference set (docs/JEU-REFERENCE.md): 211 rows, 51 visible at start, ~5 000 items per window with margin. */

const HOUR = 3_600_000;
const START = Date.UTC(2026, 9, 18);
const DOMAIN = { start: START, end: START + 24 * HOUR };
const VIEWPORT = { start: START + 8 * HOUR, end: START + 12 * HOUR };
const ITEMS_PER_WINDOW = 5000;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rows: TimelineRow[] = [{ id: 'root', label: 'Station' }];
for (let t = 0; t < 10; t++) {
  rows.push({ id: `t${t}`, label: `Type ${t + 1}`, parentId: 'root' });
  for (let c = 0; c < 20; c++) rows.push({ id: `c${t}-${c}`, label: `Connecteur ${t + 1}.${c + 1}`, parentId: `t${t}` });
}

/** Items for a range, on the rows visible with the given expansion; irregular, with dense zones and overlaps. */
function generate(range: { start: number; end: number }, expanded: ReadonlySet<string>, version: number): TimelineItem[] {
  const visibleRows = rows.filter((row) => row.parentId === undefined || expanded.has(row.parentId)).map((row) => row.id);
  const rand = random(Math.floor(range.start / 60_000) + version * 7919);
  const items: TimelineItem[] = [];
  const duration = range.end - range.start;
  for (let i = 0; i < ITEMS_PER_WINDOW; i++) {
    const rowId = visibleRows[Math.floor(rand() * visibleRows.length)]!;
    const dense = rand() < 0.35;
    const at = dense ? range.start + duration * (0.45 + rand() * 0.08) : range.start + rand() * duration;
    const kind = rand();
    const id = `v${version}-${rowId}-${Math.round(at)}-${i}`;
    if (kind < 0.6) items.push({ id, rowId, at, label: `#${i}` });
    else if (kind < 0.9) items.push({ id, rowId, start: at, end: at + 60_000 + rand() * 20 * 60_000, label: `Période ${i}` });
    else items.push({ id, rowId, start: at, end: at + 5 * 60_000, group: { count: 2 + Math.floor(rand() * 40) } });
  }
  return items;
}

interface Result {
  readonly scenario: string;
  readonly value: string;
}

declare global {
  interface Window {
    __bench?: { done: boolean; results: Result[]; env: Record<string, unknown> };
  }
}

const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const settle = async () => {
  await frame();
  await frame();
};
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const ms = (value: number) => `${value.toFixed(1)} ms`;

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
}

async function sampleFrames(duration: number): Promise<{ fps: number; p95: number; long: number }> {
  const deltas: number[] = [];
  let last = await frame();
  const end = last + duration;
  while (last < end) {
    const now = await frame();
    deltas.push(now - last);
    last = now;
  }
  const average = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
  return { fps: 1000 / average, p95: percentile(deltas, 95), long: deltas.filter((d) => d > 50).length };
}

async function timed(action: () => void): Promise<number> {
  const start = performance.now();
  action();
  await settle();
  return performance.now() - start;
}

async function runScenarios(controller: TimelineController, settings: { prepareDelay: number; loadDelay: number }, mountTime: number) {
  const results: Result[] = [];
  const push = (scenario: string, value: string) => {
    results.push({ scenario, value });
    console.log(`[bench] ${scenario}: ${value}`);
  };
  push('1. Affichage initial (montage → 2 images)', ms(mountTime));
  await controller.waitForData(VIEWPORT.start);
  await settle();
  const snapshot = controller.getSnapshot();
  push('Lignes visibles / totales', `${snapshot.visibleRows.length} / ${snapshot.rows.length}`);
  push('Éléments transmis (fenêtre + marge)', String(snapshot.items.length));
  const inWindow = snapshot.items.filter((item) => {
    const s = 'at' in item ? item.at : item.start;
    const e = 'at' in item ? item.at : item.end;
    return e >= snapshot.viewport.start && s <= snapshot.viewport.end;
  }).length;
  push('Éléments dans la fenêtre temporelle', String(inWindow));
  push('Éléments rendus dans le DOM', String(document.querySelectorAll('.tw-item').length));

  const toggles: number[] = [];
  for (const id of ['t2', 't3', 't2', 't3']) toggles.push(await timed(() => controller.toggle(id)));
  push('1. Dépliage / repliage d’un type (médiane)', ms(percentile(toggles, 50)));

  const zooms: number[] = [];
  for (let i = 0; i < 10; i++) zooms.push(await timed(() => controller.zoomBy(i < 5 ? 1.25 : 0.8)));
  push('2. Zoom par pas (médiane / p95)', `${ms(percentile(zooms, 50))} / ${ms(percentile(zooms, 95))}`);
  const pans: number[] = [];
  for (let i = 0; i < 20; i++) pans.push(await timed(() => controller.panBy(((i % 2 ? -1 : 1) * (VIEWPORT.end - VIEWPORT.start)) / 40)));
  push('2. Déplacement horizontal (médiane / p95)', `${ms(percentile(pans, 50))} / ${ms(percentile(pans, 95))}`);
  const body = document.querySelector<HTMLElement>('.tw-body')!;
  const scrolls: number[] = [];
  for (let i = 0; i < 10; i++) {
    scrolls.push(
      await timed(() => {
        body.scrollTop = (i % 2) * 600;
        body.dispatchEvent(new Event('scroll'));
      }),
    );
  }
  push('2. Défilement vertical (médiane)', ms(percentile(scrolls, 50)));

  controller.setViewport(VIEWPORT);
  await settle();
  const before = performance.now();
  controller.refresh();
  await controller.waitForData(VIEWPORT.start);
  while (controller.getSnapshot().data.loading) await frame();
  await settle();
  push(`3. Remplacement des données (${settings.loadDelay} ms de source incluse)`, ms(performance.now() - before));

  for (const speed of [1, 60, 600]) {
    controller.seek(VIEWPORT.start);
    controller.setSpeed(speed);
    controller.play();
    const sample = await sampleFrames(2000);
    controller.pause();
    push(`4. Lecture ${speed}× : images/s · p95 · images > 50 ms`, `${sample.fps.toFixed(0)} · ${ms(sample.p95)} · ${sample.long}`);
  }
  controller.setLoop(true);
  controller.seek(DOMAIN.end - 1000);
  controller.setSpeed(1);
  controller.play();
  await wait(1500);
  push('4. Boucle complète', controller.getSnapshot().time < DOMAIN.start + 2000 ? 'retour au début confirmé' : 'ÉCHEC');
  controller.pause();
  controller.setLoop(false);
  controller.setSpeed(1);

  for (const delay of [0, 50, 200]) {
    settings.prepareDelay = delay;
    controller.seek(VIEWPORT.start + HOUR);
    await wait(delay + 50);
    const startTime = controller.getSnapshot().time;
    controller.setSpeed(60);
    controller.play();
    const started = performance.now();
    await wait(2000);
    controller.pause();
    const elapsed = performance.now() - started;
    const progressed = (controller.getSnapshot().time - startTime) / 60;
    push(`5. Préparation ${delay} ms : avance logique / temps réel`, `${((progressed / elapsed) * 100).toFixed(0)} %`);
  }
  settings.prepareDelay = 0;

  // 6. Commands during a wait: the last one wins.
  settings.prepareDelay = 200;
  controller.seek(VIEWPORT.start + 10_000);
  controller.pause();
  controller.seek(VIEWPORT.start + 20_000);
  controller.stop();
  controller.seek(VIEWPORT.start + 30_000);
  await wait(400);
  push('6. Commandes pendant une attente', controller.getSnapshot().time === VIEWPORT.start + 30_000 ? 'dernière destination appliquée' : 'ÉCHEC');
  settings.prepareDelay = 0;

  controller.seek(VIEWPORT.end);
  await settle();
  controller.rewindTo(VIEWPORT.start);
  const rewindStart = performance.now();
  while (controller.getSnapshot().rewinding) await frame();
  push('7. Rewind (300 ms actives)', `${ms(performance.now() - rewindStart)} · cible ${controller.getSnapshot().time === VIEWPORT.start ? 'exacte' : 'ÉCHEC'}`);

  window.__bench!.results = results;
  window.__bench!.done = true;
}

async function dynamicScenario(push: (scenario: string, value: string) => void) {
  // 8. Static source with ~5 000 items, 5 changes every 50 ms, oldest replaced.
  const items = generate({ start: VIEWPORT.start - HOUR, end: VIEWPORT.end + HOUR }, new Set(['root', 't0', 't1']), 99);
  const controller = (window as unknown as { __dynamic: TimelineController }).__dynamic;
  controller.setItems(items);
  await settle();
  const queue = [...items];
  let next = 0;
  const durations: number[] = [];
  const end = performance.now() + 3000;
  while (performance.now() < end) {
    const removed = queue.splice(0, 5).map((item) => item.id);
    const added: TimelineItem[] = [];
    for (let i = 0; i < 5; i++) {
      const at = VIEWPORT.start + Math.random() * (VIEWPORT.end - VIEWPORT.start);
      added.push({ id: `dyn-${next++}`, rowId: `c0-${i}`, at, label: 'nouveau' });
    }
    queue.push(...added);
    const start = performance.now();
    controller.update({ items: { upsert: added, remove: removed } });
    await frame();
    durations.push(performance.now() - start);
    await wait(50);
  }
  push('8. Collections dynamiques : mise à jour → image (médiane / p95)', `${ms(percentile(durations, 50))} / ${ms(percentile(durations, 95))}`);
  push('8. Éléments conservés', String(controller.getSnapshot().items.length));
}

async function liveScenario(push: (scenario: string, value: string) => void) {
  // 9. Live with extendable domain, slow provider (200 ms) and continuous refreshes.
  let batches = 0;
  let requests = 0;
  const controller = new (await import('time-weave')).TimelineController({
    mode: 'calendar',
    domain: { start: START, end: START + HOUR },
    rows,
    expanded: ['root', 't0'],
    viewport: { start: START, end: START + 10 * 60_000 },
    source: {
      kind: 'windowed',
      load: async (request: WindowRequest) => {
        requests++;
        await wait(200);
        batches++;
        return { range: request.range, items: generate(request.range, new Set(['root', 't0']), 1).slice(0, 1000) };
      },
    },
    prepareTime: () => wait(20),
  });
  controller.start();
  controller.goLive();
  let end = START + HOUR;
  const timer = setInterval(() => {
    end += 1000;
    controller.extendDomain(end);
    controller.refresh();
  }, 50);
  await wait(3000);
  clearInterval(timer);
  const snapshot = controller.getSnapshot();
  push('9. Direct, source lente : lots appliqués / demandes', `${batches} / ${requests}`);
  push('9. Écart frontière – temps confirmé', `${((snapshot.liveTime - snapshot.time) / 1000).toFixed(1)} s simulées`);
  // 10. Explore history then come back.
  controller.seek(START + 5 * 60_000);
  await wait(300);
  controller.setLiveTime(end);
  const stayed = controller.getSnapshot().transport === 'paused';
  controller.goLive();
  await wait(400);
  push('10. Historique puis retour au Direct', stayed && controller.getSnapshot().transport === 'live' ? 'aucune reprise involontaire, retour explicite' : 'ÉCHEC');
  controller.dispose();
}

function Bench() {
  const [settings] = useState(() => ({ prepareDelay: 0, loadDelay: 0 }));
  const [mountStart] = useState(() => performance.now());
  const controllerRef = useRef<TimelineController | null>(null);
  const controller: TimelineController = useTimelineController({
    mode: 'calendar',
    domain: DOMAIN,
    viewport: VIEWPORT,
    initialTime: VIEWPORT.start,
    rows,
    expanded: ['root', 't0', 't1'],
    keys: Array.from({ length: 24 }, (_, h) => ({ id: `k${h}`, at: START + h * HOUR })),
    source: {
      kind: 'windowed',
      load: async (request: WindowRequest) => {
        if (settings.loadDelay) await wait(settings.loadDelay);
        const expanded = controllerRef.current?.getSnapshot().expanded ?? new Set(['root', 't0', 't1']);
        return { range: request.range, items: generate(request.range, expanded, 0) };
      },
    },
    prepareTime: (_request: TimeRequest) => (settings.prepareDelay ? wait(settings.prepareDelay) : undefined),
  });
  controllerRef.current = controller;
  const dynamic = useTimelineController({ mode: 'calendar', domain: DOMAIN, viewport: VIEWPORT, rows, expanded: ['root', 't0', 't1'] });
  (window as unknown as { __dynamic: TimelineController }).__dynamic = dynamic;

  const [started, setStarted] = useState(false);
  const start = async () => {
    setStarted(true);
    window.__bench = {
      done: false,
      results: [],
      env: { userAgent: navigator.userAgent, cores: navigator.hardwareConcurrency, width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    };
    await settle();
    const mount = performance.now() - mountStart;
    await runScenarios(controller, settings, mount);
    const extra: Result[] = [];
    await dynamicScenario((scenario, value) => extra.push({ scenario, value }));
    await liveScenario((scenario, value) => extra.push({ scenario, value }));
    window.__bench!.results.push(...extra);
    setStarted(false);
    setResults([...window.__bench!.results]);
  };
  const [results, setResults] = useState<Result[]>([]);
  if (new URLSearchParams(location.search).has('run') && !started && !window.__bench) void start();

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Time Weave · mesures</p>
          <h1>Jeu de référence</h1>
          <p className="lead">211 lignes, ~5 000 éléments par fenêtre avec marge. Les mesures dépendent de la machine et du navigateur.</p>
        </div>
        <button type="button" className="tw-button" onClick={start} disabled={started}>
          Lancer les scénarios
        </button>
      </header>
      <Timeline controller={controller} height={640} labels={frenchLabels} locale="fr-FR" toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" />} />
      <div style={{ height: 1, overflow: 'hidden' }}>
        <Timeline controller={dynamic} height={300} />
      </div>
      {results.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Résultats</h2>
          <dl className="facts">
            {results.map((result) => (
              <div key={result.scenario} style={{ display: 'contents' }}>
                <dt>{result.scenario}</dt>
                <dd>{result.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bench />
  </StrictMode>,
);
