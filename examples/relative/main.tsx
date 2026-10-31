import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  PlaybackControls,
  Timeline,
  formatRelative,
  formatTimeReadout,
  frenchLabels,
  useTimelineController,
  useTimelineSnapshot,
} from '@time-weave/react';
import type { TimeMode, TimeRequest, TimelineItem, TimelineKey, TimelineRow } from '@time-weave/react';
import '@time-weave/react/styles.css';
import '../shared.css';
import './relative.css';

type Kind = 'phase' | 'actuator' | 'event' | 'alarm' | 'burst';
interface Info {
  readonly kind: Kind;
}

// Deterministic PRNG (mulberry32) so every reload shows the same test run.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Reproducible noise for a given millisecond and channel.
const noise = (t: number, channel: number) => mulberry32(Math.floor(t) * 7 + channel * 104729)() - 0.5;

const rows: TimelineRow[] = [
  { id: 'bench', label: 'Banc d’essai' },
  { id: 'sensors', label: 'Capteurs', parentId: 'bench' },
  { id: 'accel', label: 'Accéléromètre', parentId: 'sensors' },
  { id: 'pressure', label: 'Pression', parentId: 'sensors' },
  { id: 'temp', label: 'Température', parentId: 'sensors' },
  { id: 'actuators', label: 'Actionneurs', parentId: 'bench' },
  { id: 'valve', label: 'Vanne V1', parentId: 'actuators' },
  { id: 'motor', label: 'Moteur M1', parentId: 'actuators' },
];

const phases: [string, number, number][] = [
  ['Pré-déclenchement', -2000, 0],
  ['Mise en pression', 0, 2500],
  ['Allumage', 2500, 3200],
  ['Régime nominal', 3200, 9000],
  ['Arrêt', 9000, 10500],
  ['Purge', 10500, 12000],
];

const items: TimelineItem<Info>[] = [];
const span = (id: string, rowId: string, start: number, end: number, label: string, kind: Kind, count?: number) =>
  items.push({ id, rowId, start, end, label, meta: { kind }, ...(count ? { group: { count } } : {}) });
const point = (id: string, rowId: string, at: number, label: string, kind: Kind) => items.push({ id, rowId, at, label, meta: { kind } });

phases.forEach(([label, start, end], i) => span(`phase-${i}`, 'bench', start, end, label, 'phase'));
span('valve-open', 'valve', 120, 9040, 'Ouverte 100 %', 'actuator');
span('valve-purge', 'valve', 10500, 11800, 'Purge 30 %', 'actuator');
point('valve-cmd', 'valve', 0, 'Commande d’ouverture', 'event');
point('valve-close', 'valve', 9000, 'Commande de fermeture', 'event');
span('motor-start', 'motor', 2500, 3200, 'Démarrage', 'actuator');
span('motor-run', 'motor', 3200, 9000, '3 000 tr/min', 'actuator');
span('motor-slow', 'motor', 9000, 10200, 'Ralentissement', 'actuator');
point('trigger', 'sensors', 0, 'Déclenchement', 'event');

// The application groups the dense vibration bursts itself.
const rand = mulberry32(42);
[2510, 3150, 6020, 9010].forEach((start, i) => {
  const length = 120 + Math.floor(rand() * 160);
  span(`burst-${i}`, 'accel', start, start + length, 'Rafale', 'burst', 30 + Math.floor(rand() * 90));
});
for (let i = 0; i < 14; i++) {
  const at = Math.round(3300 + rand() * 5600);
  point(`peak-${i}`, 'accel', at, `Pic ${(1.5 + rand() * 2).toFixed(2)} g`, 'event');
}
point('p-high', 'pressure', 2380, 'Seuil 8 bar franchi', 'alarm');
point('p-low', 'pressure', 9720, 'Retour sous 2 bar', 'event');
span('p-over', 'pressure', 3410, 3587, 'Surpression', 'alarm');
point('t-high', 'temp', 7845, 'Seuil 80 °C', 'alarm');
span('t-cool', 'temp', 9000, 12000, 'Refroidissement', 'actuator');

const keys: TimelineKey[] = phases.map(([label, start]) => ({ id: `k-${start}`, at: start, label }));

// Sensor models: smooth curves plus reproducible noise.
const ramp = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
function readSensors(t: number) {
  const vibration = t < 2500 ? 0.02 : t < 9000 ? 0.8 + 0.4 * Math.sin(t / 90) : 0.8 * (1 - ramp(t, 9000, 10500));
  const pressure = t < 0 ? 1 : 1 + 8.5 * ramp(t, 0, 2500) - 7.5 * ramp(t, 9000, 9800);
  const temperature = 21 + 64 * ramp(t, 2500, 8200) - 30 * ramp(t, 9000, 12000);
  return [
    { label: 'Accéléromètre', value: Math.abs(vibration + noise(t, 1) * 0.3), unit: 'g', max: 2 },
    { label: 'Pression', value: pressure + noise(t, 2) * 0.2, unit: 'bar', max: 10 },
    { label: 'Température', value: temperature + noise(t, 3) * 0.6, unit: '°C', max: 100 },
  ];
}

const readout = (time: number) => `T${time < 0 ? '' : '+'}${formatTimeReadout(time, 'relative')}`;
const formatTime = (time: number, _mode: TimeMode) => readout(time);

interface Reading {
  readonly time: number;
  readonly cause: string;
  readonly phase: string;
  readonly sensors: ReturnType<typeof readSensors>;
}

function App() {
  const [reading, setReading] = useState<Reading | null>(null);
  const [selected, setSelected] = useState<TimelineItem<Info> | null>(null);

  // Synchronous preparation: compute the sensor state, the position is confirmed on return.
  const prepareTime = useCallback((request: TimeRequest) => {
    const t = request.target;
    const phase = phases.find(([, start, end]) => t >= start && t < end)?.[0] ?? 'Fin de séquence';
    setReading({ time: t, cause: request.cause, phase, sensors: readSensors(t) });
  }, []);

  const controller = useTimelineController<unknown, Info>({
    mode: 'relative',
    domain: { start: -2000, end: 12000 },
    initialTime: -500,
    rows,
    keys,
    source: items,
    expanded: ['bench', 'sensors', 'actuators'],
    speed: 0.25,
    prepareTime,
  });
  const snapshot = useTimelineSnapshot(controller);
  const selectedTime = selected ? ('at' in selected ? selected.at : selected.start) : null;

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Time Weave · exemple 03</p>
          <h1>Banc d’essai — séquence de mise à feu</h1>
          <p className="lead">Mode relatif : temps en millisecondes depuis le déclenchement, pré-déclenchement négatif, lecture au ralenti.</p>
        </div>
        <span className="badge rel-clock">{readout(snapshot.time)}</span>
      </header>
      <div className="layout">
        <Timeline
          controller={controller}
          height={460}
          labelWidth={190}
          locale="fr-FR"
          labels={frenchLabels}
          rowsHeader="Équipements"
          formatTime={formatTime}
          toolbar={
            <PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" showLoop speeds={[0.1, 0.25, 0.5, 1, 2]} formatTime={formatTime} />
          }
          getItemClassName={(item) => `rel--${item.meta?.kind ?? 'event'}`}
          onItemClick={(item) => setSelected(item)}
          selectedItemId={selected?.id ?? null}
        />
        <aside>
          <section className="panel" aria-live="off">
            <h2>Mesures à l’instant confirmé</h2>
            {reading ? (
              <>
                <dl className="facts">
                  <dt>Instant</dt>
                  <dd>{formatRelative(reading.time)}</dd>
                  <dt>Phase</dt>
                  <dd>{reading.phase}</dd>
                  <dt>Cause</dt>
                  <dd>{reading.cause}</dd>
                </dl>
                <ul className="rel-gauges">
                  {reading.sensors.map((sensor) => (
                    <li key={sensor.label}>
                      <span>{sensor.label}</span>
                      <strong>
                        {sensor.value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sensor.unit}
                      </strong>
                      <meter min={0} max={sensor.max} value={sensor.value} aria-label={sensor.label} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="lead">Synchronisation…</p>
            )}
          </section>
          <section className="panel">
            <h2>Inspecteur</h2>
            {selected && selectedTime !== null ? (
              <>
                <dl className="facts">
                  <dt>Élément</dt>
                  <dd>{selected.label}</dd>
                  <dt>Début</dt>
                  <dd>{formatRelative(selectedTime)}</dd>
                  {'end' in selected && (
                    <>
                      <dt>Durée</dt>
                      <dd>{formatRelative(selected.end - selected.start)}</dd>
                    </>
                  )}
                  {selected.group && (
                    <>
                      <dt>Échantillons</dt>
                      <dd>{selected.group.count}</dd>
                    </>
                  )}
                </dl>
                <p>
                  <button type="button" className="tw-button tw-button--text" onClick={() => controller.seek(selectedTime)}>
                    Aller à cet instant
                  </button>
                </p>
              </>
            ) : (
              <p className="lead">Cliquer sur un élément pour l’inspecter.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
