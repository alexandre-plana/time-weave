import { StrictMode, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlaybackControls, Timeline, frenchLabels, isSpan, useTimelineController, useTimelineSnapshot } from 'time-weave';
import type { TimeRequest, TimelineItem, TimelineKey, TimelineRow, VisibleRow } from 'time-weave';
import 'time-weave/styles.css';
import '../shared.css';
import './history.css';

type Category = 'direction' | 'product' | 'site' | 'milestone';

interface RowInfo {
  readonly color: string;
}

interface Fact {
  readonly category: Category;
  readonly story: string;
}

const year = (y: number, month = 1, day = 1) => Date.UTC(y, month - 1, day);
const yearOf = (time: number) => new Date(time).getUTCFullYear();
const longDate = (time: number) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(time);

const rows: TimelineRow<RowInfo>[] = [
  { id: 'direction', label: 'Direction', meta: { color: '#8770bc' } },
  { id: 'products', label: 'Produits', meta: { color: '#238976' } },
  { id: 'p-mech', label: 'Mécanique', parentId: 'products', meta: { color: '#238976' } },
  { id: 'p-elec', label: 'Électronique', parentId: 'products', meta: { color: '#238976' } },
  { id: 'p-soft', label: 'Logiciel', parentId: 'products', meta: { color: '#238976' } },
  { id: 'sites', label: 'Implantations', meta: { color: '#b08027' } },
  { id: 'events', label: 'Jalons', meta: { color: '#4772e9' } },
];

const span = (id: string, rowId: string, start: number, end: number, label: string, category: Category, story: string): TimelineItem<Fact> => ({
  id,
  rowId,
  start,
  end,
  label,
  meta: { category, story },
});
const point = (id: string, rowId: string, at: number, label: string, story: string): TimelineItem<Fact> => ({
  id,
  rowId,
  at,
  label,
  meta: { category: 'milestone', story },
});

const items: TimelineItem<Fact>[] = [
  span('d1', 'direction', year(1952), year(1974), 'Hélène Martin', 'direction', 'Fondatrice, elle installe l’atelier de précision à Lyon.'),
  span('d2', 'direction', year(1974), year(1991), 'Paul Martin', 'direction', 'Ouvre l’entreprise à l’export et lance l’électronique.'),
  span('d3', 'direction', year(1991), year(2008), 'Claire Dubreuil', 'direction', 'Première dirigeante extérieure à la famille ; virage industriel.'),
  span('d4', 'direction', year(2008), year(2019), 'Samir Haddad', 'direction', 'Transformation numérique et rachat de la filiale logicielle.'),
  span('d5', 'direction', year(2019), year(2026, 10, 31), 'Inès Moreau', 'direction', 'Recentrage sur les capteurs connectés.'),
  span('p-m1', 'p-mech', year(1952), year(1980), 'Compteurs mécaniques', 'product', 'Le produit historique, fabriqué à la main.'),
  span('p-m2', 'p-mech', year(1968), year(1999), 'Vannes régulées', 'product', 'Premier succès à l’export.'),
  span('p-e1', 'p-elec', year(1978), year(2004), 'Régulateurs analogiques', 'product', 'Le passage à l’électronique.'),
  span('p-e2', 'p-elec', year(1996), year(2026, 10, 31), 'Capteurs numériques', 'product', 'La gamme qui porte encore l’entreprise.'),
  span('p-s1', 'p-soft', year(2001), year(2015), 'Supervision locale', 'product', 'Logiciel livré avec les capteurs.'),
  span('p-s2', 'p-soft', year(2012), year(2026, 10, 31), 'Plateforme en ligne', 'product', 'Supervision à distance, en abonnement.'),
  span('s1', 'sites', year(1952), year(1988), 'Lyon — Vaise', 'site', 'L’atelier d’origine.'),
  span('s2', 'sites', year(1988), year(2026, 10, 31), 'Lyon — Gerland', 'site', 'Le siège actuel.'),
  span('s3', 'sites', year(1983), year(2010), 'Montréal', 'site', 'Filiale nord-américaine.'),
  span('s4', 'sites', year(2005), year(2026, 10, 31), 'Porto', 'site', 'Centre de développement logiciel.'),
  point('m1', 'events', year(1952, 3, 3), 'Fondation', 'Trois personnes et un tour d’horloger.'),
  point('m2', 'events', year(1968, 9, 12), 'Premier contrat export', 'Une commande de vannes pour une raffinerie belge.'),
  point('m3', 'events', year(1979, 6, 1), '100 salariés', 'L’atelier devient une usine.'),
  point('m4', 'events', year(1991, 4, 15), 'Entrée en bourse', 'Cotation sur le second marché.'),
  point('m5', 'events', year(2001, 11, 20), 'Premier logiciel', 'Livré sur CD avec chaque capteur.'),
  point('m6', 'events', year(2012, 2, 1), 'Rachat de Datalog', 'La filiale logicielle portugaise rejoint le groupe.'),
  point('m7', 'events', year(2020, 3, 17), 'Télétravail généralisé', 'La plateforme en ligne tient la charge.'),
  point('m8', 'events', year(2026, 6, 30), '1 million de capteurs', 'Le cap symbolique est franchi.'),
];

const keys: TimelineKey[] = items
  .filter((item) => item.rowId === 'events' || item.rowId === 'direction')
  .map((item) => ({ id: `k-${item.id}`, at: isSpan(item) ? item.start : item.at, label: item.label }));

function App() {
  const [chapter, setChapter] = useState<TimelineItem<Fact> | null>(null);

  // The story panel shows what is active at the confirmed time.
  const prepareTime = useCallback((request: TimeRequest) => {
    const t = request.target;
    const active = items.filter((item) => (isSpan(item) ? t >= item.start && t < item.end : false) && item.rowId === 'direction');
    setChapter(active[0] ?? null);
  }, []);

  const controller = useTimelineController<RowInfo, Fact>({
    mode: 'calendar',
    domain: { start: year(1950), end: year(2027) },
    rows,
    keys,
    source: items,
    expanded: ['products'],
    speed: 365 * 24 * 3600 * 1000 / 4, // four years per second
    prepareTime,
  });
  const snapshot = useTimelineSnapshot(controller);

  const renderItem = useCallback((item: TimelineItem<Fact>, context: { width: number }) => {
    if (!isSpan(item)) return null;
    return (
      <span className="hist-item">
        {context.width > 40 && item.label}
        {context.width > 150 && (
          <small>
            {yearOf(item.start)}–{yearOf(item.end)}
          </small>
        )}
      </span>
    );
  }, []);

  const renderRowLabel = useCallback(
    (row: VisibleRow<RowInfo>) => (
      <span className="hist-row">
        <i style={{ ['--swatch' as string]: row.row.meta?.color }} />
        {row.row.label}
      </span>
    ),
    [],
  );

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Time Weave · exemple 02</p>
          <h1>Soixante-quinze ans d’une entreprise</h1>
          <p className="lead">Le même moteur sur plusieurs décennies : périodes, jalons, contenu personnalisé et fenêtre de détail.</p>
        </div>
        <span className="badge">{yearOf(snapshot.time)}</span>
      </header>
      <div className="layout">
        <Timeline
          controller={controller}
          height={540}
          locale="fr-FR"
          labels={frenchLabels}
          rowsHeader="Thèmes"
          toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" speeds={[365 * 24 * 3600 * 1000 / 4]} formatSpeed={() => '4 ans/s'} formatTime={longDate} />}
          formatTime={longDate}
          renderItem={renderItem}
          renderRowLabel={renderRowLabel}
          getItemClassName={(item) => `hist--${item.meta?.category ?? 'milestone'}`}
          detail={(item) => (
            <div className="hist-story">
              <p>{item.meta?.story}</p>
              <p className="lead">
                {isSpan(item) ? `${yearOf(item.start)} – ${yearOf(item.end)}` : longDate(item.at)}
              </p>
            </div>
          )}
        />
        <aside className="panel hist-story" aria-live="polite">
          <h2>Chapitre en cours</h2>
          {chapter ? (
            <>
              <strong>{chapter.label}</strong>
              {chapter.meta?.story}
            </>
          ) : (
            <p className="lead">Avant la fondation.</p>
          )}
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
