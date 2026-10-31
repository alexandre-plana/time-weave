import { useState } from 'react';
import type { ReactNode } from 'react';
import { PlaybackControls, Timeline, frenchLabels, useTimelineController } from '@time-weave/react';
import type { TimelineController } from '@time-weave/react';
import { C, Callout, CodeBlock, Demo, Figure, Kbd, Section, SubTitle, Table } from './components';
import type { SectionInfo } from './components';
import { ArchitectureDiagram, CursorDiagram, DataModelDiagram, RangesDiagram, SequenceDiagram } from './diagrams';

import { QuickStart } from './snippets/QuickStart';
import quickStartCode from './snippets/QuickStart.tsx?raw';
import importsCode from './snippets/imports.ts?raw';
import coreOnlyCode from './snippets/core-only.ts?raw';
import { items as modelItems, keys as modelKeys, rows as modelRows } from './snippets/data-model';
import dataModelCode from './snippets/data-model.ts?raw';
import { formatT, relatif } from './snippets/time-modes';
import timeModesCode from './snippets/time-modes.ts?raw';
import prepareSyncCode from './snippets/prepare-sync.tsx?raw';
import { PrepareAsync } from './snippets/PrepareAsync';
import prepareAsyncCode from './snippets/PrepareAsync.tsx?raw';
import staticSourceCode from './snippets/static-source.ts?raw';
import windowedSourceCode from './snippets/windowed-source.ts?raw';
import { LiveStream } from './snippets/LiveStream';
import liveStreamCode from './snippets/LiveStream.tsx?raw';
import { AvecSelecteur, AvecSnapshot } from './snippets/RenderCount';
import renderCountCode from './snippets/RenderCount.tsx?raw';
import { Semaine } from './snippets/Overview';
import overviewCode from './snippets/Overview.tsx?raw';
import hostCode from './snippets/host.tsx?raw';
import detailModalCode from './snippets/detail-modal.tsx?raw';
import labelsCode from './snippets/labels.ts?raw';
import { Planning } from './snippets/Custom';
import customCode from './snippets/Custom.tsx?raw';
import './snippets/theme.css';
import themeCode from './snippets/theme.css?raw';
import eventsCode from './snippets/events.ts?raw';
import recipeMapCode from './snippets/recipe-map.tsx?raw';
import recipeStatusCode from './snippets/recipe-status.tsx?raw';
import recipeApiCode from './snippets/recipe-api.tsx?raw';
import recipeLiveCode from './snippets/recipe-live.tsx?raw';

export const SECTIONS: readonly SectionInfo[] = [
  { id: 'installation', num: 1, title: 'Installation', icon: '📦' },
  { id: 'demarrage', num: 2, title: 'Démarrage rapide', icon: '⚡' },
  { id: 'modele', num: 3, title: 'Modèle de données', icon: '🧱' },
  { id: 'temps', num: 4, title: 'Temps', icon: '🕒' },
  { id: 'synchronisation', num: 5, title: 'Synchronisation avec l’application', icon: '🔄' },
  { id: 'sources', num: 6, title: 'Sources de données', icon: '📡' },
  { id: 'composants', num: 7, title: 'Composants React', icon: '⚛️' },
  { id: 'personnalisation', num: 8, title: 'Personnalisation', icon: '🎨' },
  { id: 'commandes', num: 9, title: 'Commandes du contrôleur', icon: '🎛️' },
  { id: 'accessibilite', num: 10, title: 'Accessibilité et clavier', icon: '⌨️' },
  { id: 'recettes', num: 11, title: 'Recettes', icon: '🍳' },
  { id: 'faq', num: 12, title: 'FAQ et pièges', icon: '❓' },
];

const info = (id: string): SectionInfo => SECTIONS.find((section) => section.id === id)!;

const INSTALL = `# Le package n’est pas encore publié sur npm : fabriquer l’archive depuis le dépôt
git clone https://github.com/alexandre-plana/time-weave.git
cd time-weave
npm install
npm pack
# → time-weave-react-0.1.0.tgz (prepack lance le build)

# Dans votre application
npm install ../time-weave/time-weave-react-0.1.0.tgz`;

const INSTALL_LATER = `# Une fois publié
npm install @time-weave/react`;

// ------------------------------------------------------------------- 1

function Installation() {
  return (
    <Section info={info('installation')} lead="Un seul package, deux points d’entrée et une feuille de style. React est fourni par votre application.">
      <Callout tone="warning" title="Pas encore publié sur npm">
        <p>
          La version 0.1.0 n’est pas encore sur le registre. En attendant, fabriquez l’archive avec <C>npm pack</C> et installez le fichier{' '}
          <C>.tgz</C> obtenu : c’est exactement le contenu qui sera publié.
        </p>
      </Callout>
      <CodeBlock code={INSTALL} language="sh" file="terminal" />
      <CodeBlock code={INSTALL_LATER} language="sh" file="terminal (plus tard)" />
      <Table
        head={['Import', 'Contenu']}
        rows={[
          [<C>@time-weave/react</C>, 'Vue React, hooks, aides, et réexport du moteur'],
          [<C>@time-weave/react/core</C>, 'Moteur seul, sans React ni DOM (serveur, worker, tests)'],
          [<C>@time-weave/react/styles.css</C>, 'Styles par défaut, à importer explicitement une fois'],
        ]}
      />
      <p>
        Dépendances fournies par l’application (<em>peer dependencies</em>) : <C>react</C> et <C>react-dom</C> en version <b>18.3</b> ou <b>19</b>.
        Aucune autre dépendance à l’exécution.
      </p>
      <CodeBlock code={importsCode} language="ts" file="imports.ts" />
      <details className="docs-details">
        <summary>Utiliser le moteur sans React</summary>
        <CodeBlock code={coreOnlyCode} language="ts" file="core-only.ts" />
      </details>
    </Section>
  );
}

// ------------------------------------------------------------------- 2

function QuickStartSection() {
  return (
    <Section info={info('demarrage')} lead="Un composant complet : copiez-le dans votre projet, il fonctionne tel quel. Le rendu ci-dessous exécute exactement ce code.">
      <CodeBlock code={quickStartCode} file="QuickStart.tsx" />
      <Demo title="QuickStart.tsx">
        <QuickStart />
      </Demo>
      <p className="docs-hint">
        Essayez : <Kbd>Espace</Kbd> sur l’axe pour lire, un clic sur le fond pour sauter, <Kbd>Ctrl</Kbd> + molette pour zoomer, le chevron de
        « Station Nord » pour replier.
      </p>
      <SubTitle>Ce qui se passe</SubTitle>
      <Figure caption="L’application fournit les données et prépare son état ; le contrôleur possède le temps ; les vues lisent ses instantanés." minWidth={600}>
        <ArchitectureDiagram />
      </Figure>
      <ol className="docs-steps">
        <li>
          <C>useTimelineController(options)</C> crée <b>un</b> contrôleur stable : le moteur qui possède le temps, la lecture, la fenêtre visible et
          les données.
        </li>
        <li>
          <C>{'<Timeline controller={…} />'}</C> l’affiche ; <C>{'<PlaybackControls />'}</C> le pilote. Boutons, clavier et application passent par
          les mêmes commandes.
        </li>
        <li>
          Votre application suit le temps avec <C>prepareTime</C> (section 5) ou <C>useTimelineSelector</C> (section 7).
        </li>
      </ol>
    </Section>
  );
}

// ------------------------------------------------------------------- 3

function DataModelDemo() {
  const controller = useTimelineController({
    domain: { start: Date.UTC(2026, 9, 18, 7, 50), end: Date.UTC(2026, 9, 18, 9, 10) },
    rows: modelRows,
    keys: modelKeys,
    source: modelItems,
    expanded: ['site'],
  });
  return (
    <Timeline
      controller={controller}
      height={200}
      locale="fr-FR"
      labels={frenchLabels}
      showZoomControls={false}
      getItemClassName={(item) => (item.meta?.gravite === 'alerte' ? 'tone-yellow' : undefined)}
    />
  );
}

function DataModel() {
  return (
    <Section info={info('modele')} lead="Cinq objets simples, identifiés par une chaîne. Tous les temps sont des nombres en millisecondes.">
      <Figure caption="Chaque ligne visible de l’arborescence devient une bande. Un élément est un point (at) ou une période (start → end exclu) ; un groupe est l’un ou l’autre avec group.count." minWidth={620}>
        <DataModelDiagram />
      </Figure>
      <Table
        head={['Objet', 'Champs', 'À savoir']}
        rows={[
          ['Ligne', <C>id, label, parentId?, meta?</C>, 'Hiérarchie par parentId ; replier masque les descendants'],
          ['Point', <C>id, rowId, at, label?, meta?, group?</C>, 'Un instant'],
          ['Période', <C>id, rowId, start, end, label?, meta?, group?</C>, <>Active de <C>start</C> inclus à <C>end</C> exclu</>],
          ['Groupe', <C>{'group: { count, ref? }'}</C>, <>Point ou période qui en résume plusieurs ; <C>count &gt; 0</C></>],
          ['Clé', <C>id, at, label?, meta?</C>, 'Instant remarquable : losange sur l’axe, clé précédente / suivante'],
        ]}
      />
      <CodeBlock code={dataModelCode} language="ts" file="data-model.ts" />
      <Demo title="Les mêmes données">
        <DataModelDemo />
      </Demo>
      <Callout tone="info" title="La bibliothèque ne regroupe rien">
        <p>
          Une ligne parente n’agrège pas ses enfants : elle affiche les éléments que vous lui donnez. Les groupes sont fabriqués par
          l’application (par exemple selon le zoom, voir la recette « charger par fenêtre »).
        </p>
      </Callout>
    </Section>
  );
}

// ------------------------------------------------------------------- 4

function RelativeDemo() {
  const controller = useTimelineController(relatif);
  return (
    <Timeline
      controller={controller}
      height={170}
      labels={frenchLabels}
      formatTime={formatT}
      showZoomControls={false}
      toolbar={<PlaybackControls controller={controller} labels={frenchLabels} formatTime={formatT} showLoop={false} />}
    />
  );
}

function TimeSection() {
  return (
    <Section info={info('temps')} lead="Deux modes, fixés à la création, et trois plages qu’il ne faut pas confondre.">
      <Table
        head={['Mode', 'Unité', 'Graduations']}
        rows={[
          [<C>calendar</C>, 'Timestamps Unix en ms (Date.UTC, Date.parse…)', 'Dates et heures, calculées en UTC ; libellés selon locale'],
          [<C>relative</C>, 'Millisecondes depuis une origine (T0), négatives permises', <>Durées signées : <C>−2 s</C>, <C>0</C>, <C>+4 s</C></>],
        ]}
      />
      <Figure caption="domain borne la lecture ; viewport est ce que l’on voit ; data.coverage est ce qui est chargé. Les trois évoluent indépendamment." minWidth={620}>
        <RangesDiagram />
      </Figure>
      <CodeBlock code={timeModesCode} language="ts" file="time-modes.ts" />
      <Demo title="Mode relatif : l’option relatif ci-dessus">
        <RelativeDemo />
      </Demo>
    </Section>
  );
}

// ------------------------------------------------------------------- 5

function SyncSection() {
  return (
    <Section
      info={info('synchronisation')}
      lead={
        <>
          Le cœur de la bibliothèque : le curseur n’avance que lorsque <b>votre application</b> affiche l’instant demandé. Carte, tableau, vidéo
          et timeline restent ainsi toujours d’accord.
        </>
      }
    >
      <Figure caption="Une nouvelle destination annule la précédente (signal) ; seule la demande courante est confirmée." minWidth={640}>
        <SequenceDiagram />
      </Figure>
      <Table
        head={['Champ de request', 'Rôle']}
        rows={[
          [<C>id</C>, 'Identifiant monotone de la demande'],
          [<C>previous</C>, 'Position confirmée de départ'],
          [<C>target</C>, 'Position demandée'],
          [<C>cause</C>, <><C>initial</C>, <C>play</C>, <C>seek</C>, <C>key</C>, <C>loop</C>, <C>stop</C>, <C>rewind</C>, <C>live</C></>],
          [<C>signal</C>, <><C>AbortSignal</C> déclenché quand une nouvelle destination remplace celle-ci</>],
          [<C>isCurrent()</C>, 'À vérifier avant d’appliquer un résultat asynchrone'],
        ]}
      />
      <SubTitle>Préparation synchrone</SubTitle>
      <p>
        Si l’état se calcule immédiatement, ne retournez rien : la position est confirmée sans attente.
      </p>
      <CodeBlock code={prepareSyncCode} file="prepare-sync.tsx" />
      <SubTitle>Préparation asynchrone</SubTitle>
      <p>
        Retournez une promesse. Pendant l’attente, <C>snapshot.time</C> reste la position confirmée et <C>snapshot.pending</C> indique la cible : la
        timeline dessine un curseur pointillé. Le temps passé à attendre n’est jamais rattrapé.
      </p>
      <Figure caption="Deux curseurs : celui que l’application affiche, et celui qu’elle prépare.">
        <CursorDiagram />
      </Figure>
      <CodeBlock code={prepareAsyncCode} file="PrepareAsync.tsx" />
      <Demo title="Préparation de 600 ms">
        <div className="docs-demo-pad">
          <PrepareAsync />
        </div>
      </Demo>
      <p className="docs-hint">Cliquez deux fois rapidement sur le fond : la première demande est annulée, seule la seconde est confirmée.</p>
      <Callout tone="tip" title="Échec de préparation">
        <p>
          Si la promesse est rejetée (hors annulation), la position est conservée, la lecture se met en pause et <C>snapshot.error</C> est
          renseigné ; <C>controller.retry()</C> redemande la même cible. L’événement <C>error</C> est émis.
        </p>
      </Callout>
    </Section>
  );
}

// ------------------------------------------------------------------- 6

function SourcesSection() {
  return (
    <Section info={info('sources')} lead="Les éléments viennent d’un tableau en mémoire ou d’un fournisseur appelé par fenêtre visible.">
      <Table
        head={['', 'Tableau en mémoire', 'Source par fenêtre']}
        rows={[
          ['Option', <C>source: items</C>, <C>{"source: { kind: 'windowed', load }"}</C>],
          ['Volume', 'Quelques milliers d’éléments', 'Illimité : seule la fenêtre (+ marge) est chargée'],
          ['Mise à jour', <><C>setItems</C>, <C>update</C></>, <>votre magasin, puis <C>refresh()</C></>],
          ['Annulation', '—', <><C>request.signal</C> à chaque navigation</>],
        ]}
      />
      <SubTitle>Tableau et mises à jour</SubTitle>
      <CodeBlock code={staticSourceCode} language="ts" file="static-source.ts" />
      <SubTitle>Source par fenêtre</SubTitle>
      <p>
        <C>load(request)</C> reçoit la fenêtre visible (<C>request.visible</C>) et la plage à charger (<C>request.range</C>, la fenêtre plus{' '}
        <C>windowMargin</C> de chaque côté). Une navigation manuelle annule la demande précédente ; ses réponses tardives sont ignorées.{' '}
        <C>snapshot.data</C> expose <C>coverage</C>, <C>loading</C> et <C>error</C> ; un échec laisse le lot précédent affiché.
      </p>
      <CodeBlock code={windowedSourceCode} language="ts" file="windowed-source.ts" />
      <Callout tone="warning" title="update({ items }) est refusé en source par fenêtre">
        <p>
          La source fait foi : modifiez votre propre magasin, puis appelez <C>controller.refresh()</C>. Les rafraîchissements demandés pendant un
          chargement sont regroupés en un seul.
        </p>
      </Callout>
      <SubTitle>Mode direct et flux</SubTitle>
      <p>
        <C>goLive()</C> suit la frontière <C>liveTime</C> ; <C>extendDomain(fin, liveTime?)</C> allonge la période (jamais en recul) ;{' '}
        <C>setLiveTime(t)</C> pilote la frontière explicitement. Pause, Stop, un saut ou un déplacement manuel quittent le direct ; le zoom le
        conserve.
      </p>
      <CodeBlock code={liveStreamCode} file="LiveStream.tsx" />
      <Demo title="Un message par seconde">
        <LiveStream />
      </Demo>
    </Section>
  );
}

// ------------------------------------------------------------------- 7

function RenderCountDemo() {
  const controller = useTimelineController({
    domain: { start: Date.UTC(2026, 9, 18, 8), end: Date.UTC(2026, 9, 18, 10) },
    rows: [{ id: 'r', label: 'Lecture' }],
    source: [{ id: 'p', rowId: 'r', start: Date.UTC(2026, 9, 18, 8, 20), end: Date.UTC(2026, 9, 18, 9, 30), label: 'Période' }],
    speed: 300,
    loop: true,
  });
  return (
    <>
      <div className="docs-compare">
        <div>
          <p className="docs-compare__title">
            <C>useTimelineSnapshot</C>
          </p>
          <AvecSnapshot controller={controller as TimelineController} />
        </div>
        <div>
          <p className="docs-compare__title">
            <C>useTimelineSelector</C> + <C>shallowEqual</C>
          </p>
          <AvecSelecteur controller={controller as TimelineController} />
        </div>
      </div>
      <Timeline
        controller={controller}
        height={130}
        labels={frenchLabels}
        locale="fr-FR"
        showZoomControls={false}
        toolbar={<PlaybackControls controller={controller} labels={frenchLabels} locale="fr-FR" speeds={[300]} showKeys={false} />}
      />
    </>
  );
}

function ThemedOverview() {
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  return (
    <Demo
      title="Timeline, TimelineOverview et bandes"
      note={
        <span className="docs-segmented" role="group" aria-label="Thème de la démonstration">
          {(['auto', 'light', 'dark'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}>
              {value}
            </button>
          ))}
        </span>
      }
    >
      <div className="docs-overview" data-theme={theme === 'auto' ? undefined : theme}>
        <Semaine theme={theme} />
      </div>
    </Demo>
  );
}

function ComponentsSection() {
  return (
    <Section info={info('composants')} lead="Une vue, des contrôles, une vue d’ensemble, une fenêtre de détail, et des hooks pour lire l’état sans tout re-rendre.">
      <SubTitle id="timeline-props">
        <C>{'<Timeline />'}</C>
      </SubTitle>
      <Table
        className="docs-table--props"
        head={['Prop', 'Type', 'Défaut', 'Rôle']}
        rows={[
          [<C>controller</C>, <C>TimelineController</C>, 'requis', 'Instance à afficher'],
          [<C>height</C>, <C>number | string</C>, <C>420</C>, 'Hauteur totale (px ou CSS)'],
          [<C>laneHeight</C>, <C>number</C>, <C>26</C>, 'Hauteur d’une voie dans une ligne'],
          [<C>labelWidth</C>, <C>number</C>, <C>220</C>, 'Largeur de la colonne des lignes'],
          [<C>initialTrackWidth</C>, <C>number</C>, <C>800</C>, 'Largeur avant la première mesure (serveur, tests)'],
          [<C>locale</C>, <C>string</C>, '—', 'Locale des graduations et du temps affiché'],
          [<C>labels</C>, <C>{'Partial<TimelineLabels>'}</C>, 'anglais', <>Textes ; <C>frenchLabels</C> fourni</>],
          [<C>formatTime</C>, <C>{'(time, mode) => string'}</C>, '—', 'Format du temps (bulle, annonce)'],
          [<C>formatTick</C>, <C>{'(time, step, mode) => string'}</C>, '—', 'Format des graduations'],
          [<C>renderRowLabel</C>, <C>{'(row) => ReactNode'}</C>, '—', 'Contenu du libellé de ligne'],
          [<C>renderItem</C>, <C>{'(item, context) => ReactNode'}</C>, '—', <>Contenu d’un élément ; doit tenir dans <C>context.width</C></>],
          [<C>getItemClassName</C>, <C>{'(item) => string | undefined'}</C>, '—', 'Classes par élément'],
          [<C>getItemAriaLabel</C>, <C>{'(item) => string'}</C>, 'libellé + heure', 'Nom accessible de l’élément'],
          [<C>onItemClick</C>, <C>{'(item, { row, controller, event }) => void'}</C>, '—', 'Clic ou Entrée ; ne déplace pas le temps'],
          [<C>selectedItemId</C>, <C>{'string | null'}</C>, 'interne', 'Sélection contrôlée'],
          [<C>tooltip</C>, <C>{'boolean | (item) => ReactNode'}</C>, <C>true</C>, 'Bulle au survol et au focus'],
          [<C>detail</C>, <C>{'boolean | (item, row) => ReactNode'}</C>, <C>false</C>, 'Fenêtre de détail à l’activation'],
          [<C>showZoomControls</C>, <C>boolean</C>, <C>true</C>, 'Boutons de zoom'],
          [<C>toolbar</C>, <C>ReactNode</C>, '—', <>Barre d’outils, ex. <C>{'<PlaybackControls />'}</C></>],
          [<C>rowsHeader</C>, <C>ReactNode</C>, <C>labels.rows</C>, 'En-tête de la colonne des lignes'],
          [<C>highlights</C>, <C>{'TimelineHighlight[]'}</C>, '—', 'Bandes de fond sur toutes les lignes'],
          [<C>theme</C>, <C>{"'auto' | 'light' | 'dark'"}</C>, <C>{"'auto'"}</C>, <>Force un thème (<C>data-theme</C>)</>],
          [<C>className</C>, <C>string</C>, '—', <>Classe ajoutée à <C>.tw-timeline</C></>],
          [<C>style</C>, <C>CSSProperties</C>, '—', <>Style inline, variables <C>--tw-*</C> comprises</>],
        ]}
      />

      <SubTitle>
        <C>{'<PlaybackControls />'}</C> et <C>{'<TimelineOverview />'}</C>
      </SubTitle>
      <Table
        head={['Composant', 'Props']}
        rows={[
          [
            <C>PlaybackControls</C>,
            <>
              <C>controller</C>, <C>speeds</C> (<C>0,25×</C> à <C>8×</C>), <C>showLive</C> (faux), <C>showLoop</C> et <C>showKeys</C> (vrais),{' '}
              <C>showReadout</C> (vrai), <C>locale</C>, <C>labels</C>, <C>formatTime</C>, <C>formatSpeed</C>, <C>className</C>
            </>,
          ],
          [
            <C>TimelineOverview</C>,
            <>
              <C>controller</C>, <C>height</C> (48), <C>showDensity</C> (vrai), <C>labels</C>, <C>locale</C>, <C>formatTime</C>, <C>initialWidth</C>,{' '}
              <C>controlsId</C> (relie la barre à la timeline), <C>className</C>
            </>,
          ],
          [
            <C>DetailModal</C>,
            <>
              <C>title</C>, <C>children</C>, <C>onClose</C>, <C>returnFocus</C>, <C>inertRoot</C>, <C>theme</C>, <C>labels</C>, <C>className</C> —
              rendu dans <C>document.body</C>
            </>,
          ],
        ]}
      />
      <p>
        <C>highlights</C> colore des périodes sur toutes les lignes (tons <C>neutral</C>, <C>info</C>, <C>success</C>, <C>warning</C>,{' '}
        <C>danger</C>) ; le libellé de la bande qui contient le temps est ajouté à l’annonce du curseur. <C>TimelineOverview</C> affiche toute la
        période : glisser la fenêtre la déplace, glisser ses bords zoome.
      </p>
      <CodeBlock code={overviewCode} file="Overview.tsx" />
      <ThemedOverview />

      <SubTitle>Re-rendre seulement quand il le faut</SubTitle>
      <p>
        <C>useTimelineSnapshot(controller)</C> renvoie l’instantané complet : le composant se rend à chaque image de lecture.{' '}
        <C>useTimelineSelector(controller, selector, isEqual = Object.is)</C> ne rend que si la valeur choisie change. Pour un objet ou un tableau
        construit par le sélecteur, passez <C>shallowEqual</C>.
      </p>
      <CodeBlock code={renderCountCode} file="RenderCount.tsx" />
      <Demo title="Comptez les rendus pendant la lecture">
        <RenderCountDemo />
      </Demo>

      <SubTitle>Qui possède l’instance ?</SubTitle>
      <Table
        head={['Hook', 'Usage']}
        rows={[
          [
            <C>useTimelineController(options)</C>,
            <>
              Crée et héberge une instance pour la durée du composant. Options lues <b>une fois</b>, sauf <C>prepareTime</C> (toujours la dernière
              fonction). Suit <C>prefers-reduced-motion</C>.
            </>,
          ],
          [
            <C>useTimelineHost(controller, options?)</C>,
            <>
              Raccorde une instance créée par l’application (<C>createTimelineController</C>) : démarrage, page masquée ;{' '}
              <C>respectReducedMotion: true</C> pour le mouvement réduit.
            </>,
          ],
          [<C>useTimelineSnapshot(controller)</C>, 'Instantané complet, un rendu par changement'],
          [<C>useTimelineSelector(controller, sel, eq?)</C>, 'Une valeur dérivée, un rendu quand elle change'],
        ]}
      />
      <CodeBlock code={hostCode} file="host.tsx" />

      <SubTitle>Détail, bulles et textes</SubTitle>
      <CodeBlock code={detailModalCode} file="detail-modal.tsx" />
      <CodeBlock code={labelsCode} language="ts" file="labels.ts" />
    </Section>
  );
}

// ------------------------------------------------------------------- 8

const VARIABLES: readonly (readonly [string, string])[] = [
  ['--tw-bg', 'Fond'],
  ['--tw-surface', 'En-têtes, barre d’outils'],
  ['--tw-ink', 'Texte'],
  ['--tw-muted', 'Texte secondaire'],
  ['--tw-line', 'Bordures'],
  ['--tw-grid', 'Grille mineure'],
  ['--tw-grid-major', 'Grille majeure'],
  ['--tw-accent', 'Curseur, accent'],
  ['--tw-accent-soft', 'Fond d’accent'],
  ['--tw-live', 'Frontière du direct'],
  ['--tw-item-bg', 'Fond des périodes'],
  ['--tw-item-border', 'Bordure des périodes'],
  ['--tw-item-ink', 'Texte des périodes'],
  ['--tw-group-bg', 'Fond des groupes'],
  ['--tw-group-border', 'Bordure des groupes'],
  ['--tw-group-ink', 'Texte des groupes'],
  ['--tw-point', 'Points'],
  ['--tw-group-point', 'Points groupés'],
  ['--tw-key', 'Clés'],
  ['--tw-focus', 'Anneau de focus'],
  ['--tw-highlight-warning', 'Bande (ton warning ; aussi neutral, info, success, danger)'],
];

function Customization() {
  return (
    <Section info={info('personnalisation')} lead="Variables CSS pour les couleurs, classes pour les états, fonctions de rendu pour le contenu.">
      <SubTitle>Variables CSS</SubTitle>
      <p>
        Les couleurs sont des variables <C>--tw-*</C> définies sur <C>.tw-timeline</C> (et sur la fenêtre de détail). Les pastilles ci-dessous
        affichent leur valeur sur cette page, qui les redéfinit aux couleurs du site — changez de thème système pour les voir basculer.
      </p>
      <Table
        className="docs-table--vars"
        head={['Variable', 'Rendu', 'Rôle']}
        rows={VARIABLES.map(([name, role]) => [
          <C>{name}</C>,
          <span className="tw-timeline docs-swatch" style={{ background: `var(${name})` }} aria-hidden="true" />,
          role,
        ])}
      />
      <p>
        Autres variables : <C>--tw-font</C>, <C>--tw-mono</C>, <C>--tw-radius</C>, <C>--tw-axis-height</C>, <C>--tw-label-width</C>. Classes
        stables : <C>tw-item</C>, <C>tw-item--point</C>, <C>tw-item--span</C>, <C>tw-item--group</C>, <C>tw-item--selected</C>,{' '}
        <C>tw-item--active</C>.
      </p>
      <CodeBlock code={themeCode} language="css" file="theme.css" />
      <SubTitle>Rendu personnalisé</SubTitle>
      <CodeBlock code={customCode} file="Custom.tsx" />
      <Demo title="Planning avec renderItem et renderRowLabel">
        <Planning />
      </Demo>
      <Callout tone="info" title="Mode sombre">
        <p>
          Par défaut (<C>{"theme='auto'"}</C>), la timeline suit <C>prefers-color-scheme</C>. <C>{"theme='dark'"}</C> ou <C>{"'light'"}</C> pose{' '}
          <C>data-theme</C> sur <C>.tw-timeline</C> et sur la fenêtre de détail : ciblez <C>[data-theme=&apos;dark&apos;]</C> dans vos
          surcharges. Essayez le sélecteur de thème de la section 7.
        </p>
      </Callout>
    </Section>
  );
}

// ------------------------------------------------------------------- 9

function CommandsSection() {
  const group = (name: string, rows: (readonly [string, string])[]) =>
    rows.map(([command, effect], index) => [index === 0 ? <span className="docs-group">{name}</span> : '', <C>{command}</C>, effect] as const);
  return (
    <Section info={info('commandes')} lead="Toutes les interactions passent par ces commandes : vos boutons utilisent exactement les mêmes transitions que ceux de la timeline.">
      <Table
        className="docs-table--commands"
        head={['Groupe', 'Commande', 'Effet']}
        rows={[
          ...group('Transport', [
            ['play() · pause() · togglePlay()', 'Lecture et pause'],
            ['stop()', 'Pause et préparation du début de la période'],
            ['setSpeed(facteur)', 'Facteur strictement positif (1 = temps réel)'],
            ['setLoop(booléen)', 'Boucle sur toute la période'],
            ['goLive()', 'Suit la frontière du direct'],
            ['retry()', 'Redemande la cible après un échec de préparation'],
          ]),
          ...group('Navigation', [
            ['seek(t)', 'Saut immédiat, borné à la période ; conserve l’intention de lecture'],
            ['stepBy(durée)', 'Saut relatif depuis la cible en attente ou le temps confirmé'],
            ['rewindTo(t)', 'Retour animé vers une cible passée (300 ms par défaut)'],
            ['previousKey() · nextKey() · goToKey(id)', 'Navigation par clés ; false sans destination'],
          ]),
          ...group('Fenêtre', [
            ['setViewport(plage)', 'Fenêtre visible explicite'],
            ['zoomBy(facteur, ancre?) · zoomTo(durée, ancre?)', 'Zoom relatif ou à une durée ; conserve le direct'],
            ['panBy(durée)', 'Déplacement horizontal'],
            ['centerOn(t)', 'Centre la fenêtre sur t (même durée)'],
            ['fitToItems(marge = 0,05)', 'Couvre les éléments chargés, ou la période'],
            ['setFollowPlayback(booléen)', 'La fenêtre suit la lecture'],
          ]),
          ...group('Lignes', [['expand · collapse · toggle(id) · setExpanded(ids) · expandAll() · collapseAll()', 'Dépliage']]),
          ...group('Données', [
            ['setRows · setKeys · setItems', 'Remplacement complet, validé'],
            ['update({ rows, keys, items })', 'upsert / remove par identifiant, atomique'],
            ['setSource(source) · refresh()', 'Nouvelle source, ou redemande de la fenêtre'],
            ['extendDomain(fin, liveTime?) · setLiveTime(t)', 'Période et frontière du direct (jamais en recul)'],
            ['waitForData(t, signal?)', 'Promesse résolue quand un lot couvre t'],
          ]),
          ...group('Cycle de vie', [
            ['start() · setActive(booléen)', 'Démarrage, suspension (faits par les hooks)'],
            ['setPrepareTime(f) · setScheduler(s)', 'Changer le contrat ou la source d’impulsions'],
            ['setReducedMotion(b) · setRewindDuration(ms)', 'Animations'],
            ['dispose() · isDisposed() · isActive()', 'Destruction par le propriétaire'],
          ]),
          ...group('État', [
            ['getSnapshot() · subscribe(listener)', 'Instantané immuable et abonnement (useSyncExternalStore)'],
            ['on(événement, listener)', 'Événements ci-dessous ; retourne le désabonnement'],
          ]),
        ]}
      />
      <SubTitle>Événements</SubTitle>
      <Table
        head={['Événement', 'Charge', 'Quand']}
        rows={[
          [<C>time</C>, <C>{'{ time, previous, cause, requestId }'}</C>, 'Chaque position confirmée'],
          [<C>error</C>, <C>{'{ target, cause, error }'}</C>, 'Chaque échec de préparation'],
          [<C>dataError</C>, <C>{'{ error }'}</C>, 'Échec ou lot invalide d’une source par fenêtre'],
          [<C>viewport</C>, <C>{'{ viewport, previous, origin }'}</C>, <>Changement réel de fenêtre ; origin : <C>navigation</C>, <C>zoom</C>, <C>follow</C>, <C>domain</C></>],
        ]}
      />
      <CodeBlock code={eventsCode} language="ts" file="events.ts" />
    </Section>
  );
}

// ------------------------------------------------------------------- 10

function AccessibilitySection() {
  return (
    <Section info={info('accessibilite')} lead="L’axe est un curseur accessible (role=slider) ; les éléments forment un seul arrêt de tabulation parcouru aux flèches.">
      <div className="docs-keys">
        <div>
          <SubTitle>Sur l’axe (curseur)</SubTitle>
          <Table
            head={['Touches', 'Effet']}
            rows={[
              [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, '1/50 de la fenêtre'],
              [<><Kbd>Maj</Kbd> + <Kbd>←</Kbd> <Kbd>→</Kbd></>, '1/10 de la fenêtre'],
              [<><Kbd>Début</Kbd> <Kbd>Fin</Kbd></>, 'Début ou fin de la période'],
              [<><Kbd>Page préc.</Kbd> <Kbd>Page suiv.</Kbd></>, 'Clé précédente / suivante'],
              [<><Kbd>+</Kbd> <Kbd>−</Kbd></>, 'Zoom'],
              [<Kbd>Espace</Kbd>, 'Lecture / pause'],
            ]}
          />
        </div>
        <div>
          <SubTitle>Sur les éléments</SubTitle>
          <Table
            head={['Touches', 'Effet']}
            rows={[
              [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, 'Élément précédent / suivant de la ligne'],
              [<><Kbd>↑</Kbd> <Kbd>↓</Kbd></>, 'Ligne voisine'],
              [<><Kbd>Début</Kbd> <Kbd>Fin</Kbd></>, 'Extrémités de la ligne'],
              [<><Kbd>Entrée</Kbd> <Kbd>Espace</Kbd></>, <>Active l’élément (<C>onItemClick</C>)</>],
            ]}
          />
        </div>
        <div>
          <SubTitle>Vue d’ensemble (barre de défilement)</SubTitle>
          <Table
            head={['Touches', 'Effet']}
            rows={[
              [<><Kbd>←</Kbd> <Kbd>→</Kbd></>, '10 % (Maj : 50 %)'],
              [<><Kbd>Page préc.</Kbd> <Kbd>Page suiv.</Kbd></>, 'Une fenêtre'],
              [<><Kbd>+</Kbd> <Kbd>−</Kbd></>, 'Zoom'],
              [<><Kbd>Début</Kbd> <Kbd>Fin</Kbd></>, 'Bornes de la période'],
            ]}
          />
        </div>
      </div>
      <SubTitle>À la souris et au toucher</SubTitle>
      <Table
        head={['Geste', 'Effet']}
        rows={[
          ['Clic sur le fond', 'Saut à l’instant pointé'],
          ['Glisser le fond', 'Déplacement de la fenêtre (sans saut)'],
          ['Glisser la poignée du curseur', 'Saut vers la dernière position'],
          [<><Kbd>Ctrl</Kbd>/<Kbd>⌘</Kbd> + molette, pincement</>, 'Zoom autour du pointeur'],
          [<><Kbd>Maj</Kbd> + molette</>, 'Déplacement horizontal'],
          ['Clic sur un élément', <><C>onItemClick</C> ; le temps ne bouge pas</>],
        ]}
      />
      <Callout tone="tip" title="Ce que vous devez fournir">
        <ul>
          <li>
            Des <C>labels</C> dans la langue de la page (<C>frenchLabels</C>) : ils nomment boutons, curseur et annonces.
          </li>
          <li>
            Avec un <C>renderItem</C> qui affiche du texte, un <C>getItemAriaLabel</C> qui contient ce texte (WCAG 2.5.3).
          </li>
          <li>
            Le mouvement réduit est suivi automatiquement : les retours animés deviennent des sauts.
          </li>
        </ul>
      </Callout>
    </Section>
  );
}

// ------------------------------------------------------------------- 11

function Recipes() {
  return (
    <Section info={info('recettes')} lead="Des intégrations complètes, à adapter.">
      <SubTitle id="recette-carte">Synchroniser une carte</SubTitle>
      <p>
        La carte charge les positions de l’instant demandé ; le curseur n’avance qu’une fois la carte à jour. Une demande remplacée est annulée
        (le <C>fetch</C> reçoit le <C>signal</C>).
      </p>
      <CodeBlock code={recipeMapCode} file="recipe-map.tsx" />
      <SubTitle id="recette-etat">Afficher un panneau d’état sans re-rendu par image</SubTitle>
      <CodeBlock code={recipeStatusCode} file="recipe-status.tsx" />
      <SubTitle id="recette-api">Charger par fenêtre depuis une API</SubTitle>
      <p>Le serveur agrège selon le zoom ; l’application transforme ses agrégats en groupes et redemande la fenêtre quand le pas change.</p>
      <CodeBlock code={recipeApiCode} file="recipe-api.tsx" />
      <SubTitle id="recette-direct">Mode surveillance en direct</SubTitle>
      <CodeBlock code={recipeLiveCode} file="recipe-live.tsx" />
    </Section>
  );
}

// ------------------------------------------------------------------- 12

const FAQ: readonly { q: string; a: ReactNode }[] = [
  {
    q: 'J’ai changé une option de useTimelineController, rien ne se passe.',
    a: (
      <>
        Les options sont lues <b>une seule fois</b>, à la création. Passez par les commandes : <C>setItems</C>, <C>setRows</C>, <C>setSpeed</C>,{' '}
        <C>setViewport</C>… Seule <C>prepareTime</C> est relue à chaque rendu (la dernière fonction est toujours appelée).
      </>
    ),
  },
  {
    q: 'Faut-il appeler dispose() au démontage ?',
    a: (
      <>
        Non avec les hooks : ils suspendent l’instance (<C>setActive(false)</C>), ce qui reste compatible avec StrictMode et <C>{'<Activity>'}</C>.
        Si l’application crée l’instance avec <C>createTimelineController</C>, c’est à elle d’appeler <C>dispose()</C>, une fois.
      </>
    ),
  },
  {
    q: 'Les graduations sont décalées d’une ou deux heures.',
    a: (
      <>
        Les graduations calendaires sont calculées en <b>UTC</b>. La <C>locale</C> change la langue des libellés, pas le fuseau. Pour afficher
        l’heure locale, fournissez <C>formatTick</C> et <C>formatTime</C>.
      </>
    ),
  },
  {
    q: 'Ma période se termine à 10:00 mais l’élément est encore actif à 10:00.',
    a: (
      <>
        La fin d’une période est <b>exclue</b> : <C>{'{ start: 9h, end: 10h }'}</C> est active jusqu’à 9:59:59.999. Deux périodes consécutives
        partagent donc leur borne sans se chevaucher.
      </>
    ),
  },
  {
    q: 'Le curseur ne bouge plus et la lecture s’est mise en pause.',
    a: (
      <>
        <C>prepareTime</C> a rejeté sa promesse : <C>snapshot.error</C> le décrit et <C>controller.retry()</C> réessaie. Une annulation (
        <C>AbortError</C> après <C>signal.abort()</C>) n’est pas une erreur.
      </>
    ),
  },
  {
    q: 'extendDomain lève une TimelineValidationError.',
    a: (
      <>
        La période ne peut que s’étendre. Avec des horodatages désordonnés, passez{' '}
        <C>Math.max(fin, controller.getSnapshot().domain.end)</C>. Pour la réduire, créez une nouvelle instance.
      </>
    ),
  },
  {
    q: 'update({ items }) lève une erreur avec ma source par fenêtre.',
    a: (
      <>
        C’est voulu : la source fait foi. Mettez à jour votre magasin puis appelez <C>refresh()</C>.
      </>
    ),
  },
  {
    q: 'Mon composant se rend 60 fois par seconde pendant la lecture.',
    a: (
      <>
        Il lit probablement <C>useTimelineSnapshot</C>. Préférez <C>useTimelineSelector</C> avec une valeur arrondie (minute, seconde) ou{' '}
        <C>shallowEqual</C> pour un objet.
      </>
    ),
  },
  {
    q: 'Mes données sont rejetées.',
    a: (
      <>
        Identifiant dupliqué, ligne inconnue, cycle de parents, temps non fini, période inversée ou <C>group.count</C> non positif lèvent une{' '}
        <C>TimelineValidationError</C> dont <C>issues</C> détaille chaque problème. Le dernier état valide est conservé.
      </>
    ),
  },
];

function FaqSection() {
  return (
    <Section info={info('faq')} lead="Les questions qui reviennent, et les comportements qui surprennent.">
      <div className="docs-faq">
        {FAQ.map((entry) => (
          <details key={entry.q} className="docs-details">
            <summary>{entry.q}</summary>
            <p>{entry.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Sections() {
  return (
    <>
      <Installation />
      <QuickStartSection />
      <DataModel />
      <TimeSection />
      <SyncSection />
      <SourcesSection />
      <ComponentsSection />
      <Customization />
      <CommandsSection />
      <AccessibilitySection />
      <Recipes />
      <FaqSection />
    </>
  );
}
