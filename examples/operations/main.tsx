import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PlaybackControls,
  Timeline,
  formatTimeReadout,
  frenchLabels,
  rangeContainsTime,
  shallowEqual,
  useTimelineController,
  useTimelineSelector,
} from '@time-weave/react';
import type { TimeRequest, TimelineController, TimelineItem, VisibleRow, WindowRequest } from '@time-weave/react';
import '@time-weave/react/styles.css';
import '../shared.css';
import './operations.css';
import { Box, RepoHeader, TopBar } from '../chrome';
import {
  CommunicationStore,
  DAY_START,
  HISTORY_END,
  HOUR,
  binFor,
  buildItems,
  incidents,
  keys,
  rows,
  sleep,
} from './data';
import type { Communication, ItemInfo, RowInfo } from './data';

const format = (time: number) => formatTimeReadout(time, 'calendar', 'fr-FR');
const clock = (time: number) => new Date(time).toISOString().slice(11, 19);
const DELAYS = [0, 50, 200, 800];

interface AppState {
  readonly time: number;
  readonly cause: string;
  readonly recent: Communication[];
  readonly active: number;
  readonly incident: string | null;
}

function computeState(store: CommunicationStore, time: number, cause: string): AppState {
  const recent: Communication[] = [];
  let active = 0;
  for (const row of rows) {
    if (row.meta?.kind !== 'connector') continue;
    const last = store.lastBefore(row.id, time);
    if (!last) continue;
    if (time - last.at < 10 * 60_000) active++;
    recent.push(last);
  }
  recent.sort((a, b) => b.at - a.at);
  const incident = incidents.find((entry) => time >= entry.start && time < entry.end)?.label ?? null;
  return { time, cause, recent: recent.slice(0, 6), active, incident };
}

/**
 * Controller facts of the simulation panel. The selection only changes when a
 * displayed value changes, so this panel does not render on every playback frame.
 */
function ControllerFacts({ controller }: { controller: TimelineController<RowInfo, ItemInfo> }) {
  const facts = useTimelineSelector(
    controller,
    (s) => ({
      followPlayback: s.followPlayback,
      status: s.status,
      transport: s.transport,
      loading: s.data.loading,
      itemCount: s.items.length,
      domainEnd: s.domain.end,
      inViewport: rangeContainsTime(s.viewport, s.time),
    }),
    shallowEqual,
  );
  return (
    <>
      <label className="field" htmlFor="ops-follow">
        Suivre la lecture
        <input id="ops-follow" type="checkbox" checked={facts.followPlayback} onChange={(event) => controller.setFollowPlayback(event.target.checked)} />
      </label>
      <dl className="facts">
        <dt>Statut</dt>
        <dd>{facts.status}</dd>
        <dt>Transport</dt>
        <dd>{facts.transport}</dd>
        <dt>Données</dt>
        <dd>
          {facts.loading ? 'chargement' : 'prêtes'} · {facts.itemCount} éléments
        </dd>
        <dt>Fin de période</dt>
        <dd>{clock(facts.domainEnd)}</dd>
        <dt>Dans la fenêtre</dt>
        <dd>{facts.inViewport ? 'oui' : 'non'}</dd>
      </dl>
    </>
  );
}

function App() {
  const store = useMemo(() => new CommunicationStore(), []);
  const [prepareDelay, setPrepareDelay] = useState(0);
  const [loadDelay, setLoadDelay] = useState(50);
  const [stream, setStream] = useState(false);
  const [appState, setAppState] = useState<AppState | null>(null);
  const [selected, setSelected] = useState<TimelineItem<ItemInfo> | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const settings = useRef({ prepareDelay, loadDelay });
  settings.current = { prepareDelay, loadDelay };
  const lastBin = useRef<number | null>(null);
  const controllerRef = useRef<TimelineController<RowInfo, ItemInfo> | null>(null);

  const source = useMemo(
    () => ({
      kind: 'windowed' as const,
      async load(request: WindowRequest) {
        await sleep(settings.current.loadDelay, request.signal);
        const bin = binFor(request.visible.end - request.visible.start);
        lastBin.current = bin;
        const expanded = controllerRef.current?.getSnapshot().expanded ?? new Set<string>();
        return { range: request.range, items: buildItems(store, request.range, bin, expanded) };
      },
    }),
    [store],
  );

  // The application decides when its own state is ready to be shown at the target time.
  const prepareTime = useCallback(
    async (request: TimeRequest) => {
      await sleep(settings.current.prepareDelay, request.signal);
      await controllerRef.current?.waitForData(request.target, request.signal);
      if (!request.isCurrent()) return;
      setAppState(computeState(store, request.target, request.cause));
    },
    [store],
  );

  const controller = useTimelineController<RowInfo, ItemInfo>({
    mode: 'calendar',
    domain: { start: DAY_START, end: HISTORY_END },
    initialTime: DAY_START + 6 * HOUR,
    viewport: { start: DAY_START + 5 * HOUR, end: DAY_START + 9 * HOUR },
    rows,
    keys,
    expanded: ['station', 't0', 't1'],
    source,
    speed: 60,
    prepareTime,
  });
  controllerRef.current = controller;
  // App only renders again when a selected value changes, not on every playback frame.
  const viewportBin = useTimelineSelector(controller, (s) => binFor(s.viewport.end - s.viewport.start));
  const expandedKey = useTimelineSelector(controller, (s) => Array.from(s.expanded).sort().join(','));

  // Grouping belongs to the application: ask for fresh data when the level changes.
  useEffect(() => {
    if (lastBin.current !== null && viewportBin !== lastBin.current) controller.refresh();
  }, [controller, viewportBin]);

  // Expansion changes which connectors the provider details.
  const firstExpansion = useRef(true);
  useEffect(() => {
    if (firstExpansion.current) {
      firstExpansion.current = false;
      return;
    }
    controller.refresh();
  }, [controller, expandedKey]);

  // Simulated stream: 5 communications every 50 ms, the domain grows with it.
  useEffect(() => {
    if (!stream) return;
    const timer = setInterval(() => {
      const until = store.latest + 1000;
      store.append(until, 5);
      controller.extendDomain(until);
      controller.refresh();
    }, 50);
    return () => clearInterval(timer);
  }, [stream, store, controller]);

  useEffect(
    () =>
      controller.on('time', (change) => {
        if (change.cause === 'play' || change.cause === 'rewind' || change.cause === 'live') return;
        setLog((entries) => [`${clock(change.time)} · ${change.cause}`, ...entries].slice(0, 30));
      }),
    [controller],
  );

  const onItemClick = useCallback((item: TimelineItem<ItemInfo>) => setSelected(item), []);
  const renderRowLabel = useCallback((row: VisibleRow<RowInfo>) => {
    const kind = row.row.meta?.kind;
    return (
      <span className={`ops-row ops-row--${kind}`}>
        {kind === 'connector' && <span className="ops-dot" aria-hidden="true" />}
        {row.row.label}
      </span>
    );
  }, []);
  const itemClass = useCallback((item: TimelineItem<ItemInfo>) => {
    const meta = item.meta;
    if (meta?.kind === 'incident') return 'ops-incident';
    if (meta?.kind === 'summary') return 'ops-summary';
    if (meta?.communication?.alarm) return 'ops-alarm';
    return undefined;
  }, []);

  const selectedTime = selected ? ('at' in selected ? selected.at : selected.start) : null;

  return (
    <>
      <TopBar current="operations" root="../" />
      <main className="page">
        <RepoHeader
          slug="operations"
          tag="Exemple 01"
          title="Journée d’opérations — Station Nord"
          lead="211 lignes, communications regroupées par l’application selon le zoom, préparation asynchrone et flux simulé."
          pills={[
            ['calendaire', 'blue'],
            ['direct', 'red'],
            ['fenêtré', 'purple'],
            ['prepareTime', 'green'],
          ]}
          aside={<span className="badge">{store.size.toLocaleString('fr-FR')} communications en mémoire</span>}
        />

        <div className="layout">
          <Box icon="🛰️" title="Chronologie" meta={<span className="counter">211 lignes</span>} className="tl-box">
            <Timeline
              controller={controller}
              height={620}
              labelWidth={210}
              locale="fr-FR"
              labels={frenchLabels}
              rowsHeader="Structure"
              toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" showLive speeds={[1, 10, 60, 300, 1200]} />}
              renderRowLabel={renderRowLabel}
              getItemClassName={itemClass}
              onItemClick={onItemClick}
              selectedItemId={selected?.id ?? null}
            />
          </Box>

          <aside>
            <section className="panel" aria-live="off">
              <h2>
                <span aria-hidden="true">🧭</span> État de l’application
              </h2>
              {appState ? (
                <dl className="facts">
                  <dt>Instant confirmé</dt>
                  <dd>{clock(appState.time)}</dd>
                  <dt>Cause</dt>
                  <dd>{appState.cause}</dd>
                  <dt>Connecteurs actifs</dt>
                  <dd>{appState.active} / 200</dd>
                  <dt>Incident</dt>
                  <dd>{appState.incident ?? '—'}</dd>
                </dl>
              ) : (
                <p className="lead">Synchronisation…</p>
              )}
              <ul className="log" aria-label="Dernières communications">
                {appState?.recent.map((c) => (
                  <li key={c.id}>
                    {clock(c.at)} {c.connector} → {c.value}
                    {c.alarm ? ' ⚠' : ''}
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel">
              <h2>
                <span aria-hidden="true">🔍</span> Inspecteur
              </h2>
              {selected ? (
                <>
                  <dl className="facts">
                    <dt>Élément</dt>
                    <dd>{selected.label ?? selected.id}</dd>
                    <dt>Type</dt>
                    <dd>{selected.meta?.kind}</dd>
                    {selected.group && (
                      <>
                        <dt>Regroupe</dt>
                        <dd>{selected.group.count}</dd>
                      </>
                    )}
                    <dt>Début</dt>
                    <dd>{selectedTime !== null ? format(selectedTime) : ''}</dd>
                  </dl>
                  <p>
                    <button
                      type="button"
                      className="tw-button tw-button--text"
                      onClick={() => {
                        if (selectedTime === null) return;
                        if (selectedTime < controller.getSnapshot().time) controller.rewindTo(selectedTime);
                        else controller.seek(selectedTime);
                      }}
                    >
                      Aller à cet instant
                    </button>
                  </p>
                </>
              ) : (
                <p className="lead">Cliquer sur un élément. Le clic ne déplace pas le temps.</p>
              )}
            </section>

            <section className="panel">
              <h2>
                <span aria-hidden="true">⚙️</span> Simulation
              </h2>
              <label className="field" htmlFor="ops-prepare-delay">
                Préparation de l’application
                <select id="ops-prepare-delay" value={prepareDelay} onChange={(event) => setPrepareDelay(Number(event.target.value))}>
                  {DELAYS.map((delay) => (
                    <option key={delay} value={delay}>
                      {delay} ms
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="ops-load-delay">
                Chargement des fenêtres
                <select id="ops-load-delay" value={loadDelay} onChange={(event) => setLoadDelay(Number(event.target.value))}>
                  {DELAYS.map((delay) => (
                    <option key={delay} value={delay}>
                      {delay} ms
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor="ops-stream">
                Flux simulé (5 msg / 50 ms)
                <input id="ops-stream" type="checkbox" checked={stream} onChange={(event) => setStream(event.target.checked)} />
              </label>
              <ControllerFacts controller={controller} />
            </section>

            <section className="panel">
              <h2>
                <span aria-hidden="true">📜</span> Journal des confirmations
              </h2>
              <ul className="log">
                {log.map((entry, index) => (
                  <li key={index}>{entry}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
