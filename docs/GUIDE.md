# Guide d'utilisation

Date : 31 octobre 2026.
Statut : décrit l'API implémentée dans ce dépôt (version 0.1.0, non publiée). Les noms suivent la [conception V1](CONCEPTION-V1.md).

## Installation et points d'entrée

Le package n'est pas encore publié. Pour l'essayer dans une autre application : `npm pack` dans ce dépôt, puis `npm install chemin/vers/time-weave-0.1.0.tgz`.

| Import | Contenu |
| --- | --- |
| `time-weave` | Vue React, hooks, aides, et réexport du moteur |
| `time-weave/core` | Moteur seul, sans React ni DOM |
| `time-weave/styles.css` | Styles par défaut, à importer explicitement |

React 18.3 ou 19 est une dépendance fournie par l'application.

## Exemple minimal

```tsx
import { PlaybackControls, Timeline, frenchLabels, useTimelineController } from 'time-weave';
import 'time-weave/styles.css';

export function Replay() {
  const controller = useTimelineController({
    mode: 'calendar',
    domain: { start: Date.UTC(2026, 9, 18), end: Date.UTC(2026, 9, 19) },
    rows: [
      { id: 'station', label: 'Station Nord' },
      { id: 'mqtt', label: 'Réseau MQTT', parentId: 'station' },
    ],
    keys: [{ id: 'incident', at: Date.UTC(2026, 9, 18, 8), label: 'Pic de charge' }],
    source: [{ id: 'm1', rowId: 'mqtt', at: Date.UTC(2026, 9, 18, 6, 12), label: 'Mesure' }],
    expanded: ['station'],
    prepareTime: async (request) => {
      await monApplication.afficherEtatA(request.target, request.signal);
    },
  });

  return (
    <Timeline
      controller={controller}
      labels={frenchLabels}
      locale="fr-FR"
      toolbar={<PlaybackControls controller={controller} labels={frenchLabels} showLive />}
      onItemClick={(item, { row }) => ouvrirDetail(item, row)}
    />
  );
}
```

## Temps

Tous les temps sont des nombres en millisecondes. En mode `calendar`, ce sont des timestamps Unix : l'application convertit ses dates avant de les transmettre. En mode `relative`, ce sont des positions depuis l'origine choisie ; les valeurs négatives sont permises.

Les graduations calendaires sont calculées en UTC. La locale des libellés est configurable (`locale`) et les fonctions `formatTick` et `formatTime` remplacent les libellés par défaut.

Trois plages sont distinctes : la période complète `domain`, la fenêtre visible `viewport` et la plage chargée `data.coverage`. La boucle, Stop et la fin de lecture utilisent toujours `domain`, jamais le lot chargé.

## Données

| Objet | Champs |
| --- | --- |
| Ligne | `id`, `label`, `parentId?`, `meta?` |
| Point | `id`, `rowId`, `at`, `label?`, `meta?`, `group?` |
| Période | `id`, `rowId`, `start`, `end` (fin exclue), `label?`, `meta?`, `group?` |
| Groupe | Point ou période avec `group: { count, ref? }`, `count > 0` |
| Clé | `id`, `at`, `label?`, `meta?` |

Les lignes parentes affichent les éléments que l'application leur fournit : la bibliothèque ne regroupe rien. Replier une ligne masque ses descendants et conserve les éléments du parent.

Les données invalides (identifiant dupliqué, ligne inconnue, cycle, temps invalide, période inversée, compteur de groupe non positif) lèvent une `TimelineValidationError` dont `issues` détaille chaque problème. Le dernier état valide est conservé.

### Source en mémoire

Passer un tableau dans `source`, puis le modifier avec :

- `controller.setItems(items)` : remplacement complet ;
- `controller.update({ rows, keys, items })` : ajouts, modifications et suppressions par identifiant (`{ upsert, remove }`), validés puis appliqués atomiquement.

### Source par fenêtre

```ts
source: {
  kind: 'windowed',
  async load(request) {
    // request.visible : fenêtre visible ; request.range : fenêtre + 25 % de marge
    const items = await api.communications(request.range, { signal: request.signal });
    return { range: request.range, items }; // tableau vide = « aucune donnée »
  },
}
```

- Une navigation manuelle (glisser, zoom explicite) crée une nouvelle génération ; les réponses précédentes sont ignorées.
- Les déplacements automatiques (suivi de lecture, Direct) gardent la demande active et mémorisent une seule prochaine plage.
- `controller.refresh()` redemande la fenêtre courante ; les rafraîchissements pendant un chargement sont regroupés en un seul.
- Le regroupement reste à l'application : elle peut appeler `refresh()` quand son niveau de regroupement change avec le zoom (voir l'exemple d'opérations).
- `snapshot.data` expose séparément `coverage`, `loading` et `error`. Un échec laisse le lot précédent affiché.

En source par fenêtre, l'application modifie son propre magasin puis appelle `refresh()` ; `update({ items })` est refusé.

## Préparation et confirmation du temps

`prepareTime(request)` est appelée avant chaque nouvelle position. Elle termine immédiatement ou retourne une promesse ; sa fin confirme la position si la demande est encore courante.

| Champ | Rôle |
| --- | --- |
| `id` | Identifiant monotone de la demande |
| `previous`, `target` | Position confirmée de départ et cible |
| `cause` | `initial`, `play`, `seek`, `key`, `loop`, `stop`, `rewind`, `live` |
| `signal` | `AbortSignal` déclenché quand une nouvelle destination remplace celle-ci |
| `isCurrent()` | À vérifier avant d'appliquer un résultat asynchrone |

Pendant l'attente, `snapshot.time` reste la position confirmée et `snapshot.pending` indique la cible. Le temps passé à attendre n'est jamais rattrapé. Un échec conserve la position, met le transport en pause et expose `snapshot.error` ; `controller.retry()` redemande la même cible.

Pour attendre des données couvrant la cible : `await controller.waitForData(request.target, request.signal)`.

`controller.on('time', ({ time, previous, cause }) => …)` notifie chaque confirmation ; `on('error', …)` chaque échec de préparation et `on('dataError', …)` chaque échec ou lot invalide d'une source par fenêtre. Chaque appel retourne une fonction de désabonnement.

## Commandes

| Commande | Effet |
| --- | --- |
| `play()`, `pause()`, `togglePlay()`, `stop()` | Transport ; Stop prépare le début de la période |
| `setSpeed(facteur)` | Facteur strictement positif |
| `setLoop(booléen)` | Boucle sur toute la période |
| `seek(t)` | Saut immédiat, borné à la période ; conserve l'intention de lecture |
| `previousKey()`, `nextKey()`, `goToKey(id)` | Navigation par clés ; retourne `false` sans destination |
| `rewindTo(t)` | Déplacement animé vers une cible passée (300 ms actives par défaut) |
| `goLive()` | Suit la frontière du direct |
| `setLiveTime(t)`, `extendDomain(fin, liveTime?)` | Frontière du direct (jamais en recul) et extension de période |
| `setViewport(plage)`, `zoomBy(facteur, ancre?)`, `panBy(durée)` | Fenêtre visible |
| `expand(id)`, `collapse(id)`, `toggle(id)`, `setExpanded(ids)`, `expandAll()`, `collapseAll()` | Dépliage |
| `setFollowPlayback(booléen)`, `setReducedMotion(booléen)`, `setRewindDuration(ms)` | Suivi de la fenêtre, animations |
| `setRows(lignes)`, `setKeys(clés)`, `setItems(éléments)`, `setSource(source)`, `refresh()` | Remplacement des collections ou de la source |
| `setPrepareTime(fonction)`, `setScheduler(ordonnanceur)` | Changement du contrat de préparation ou de la source d'impulsions |
| `isActive()`, `isDisposed()` | État du cycle de vie |
| `start()`, `setActive(booléen)`, `dispose()` | Cycle de vie |

L'état observable est `controller.getSnapshot()`, un objet immuable stable entre deux changements, avec `controller.subscribe(listener)`. En React, `useTimelineSnapshot(controller)` s'y abonne.

## Mode Direct

`goLive()` demande la frontière `liveTime` via le contrat de préparation habituel. Les frontières reçues pendant une préparation remplacent une unique prochaine cible : aucune file ne se forme et la préparation en cours n'est pas annulée. Pause, Stop, un saut, une clé ou un déplacement manuel de la fenêtre quittent le Direct ; Lecture démarre un rejeu depuis la position courante. Le zoom conserve le Direct.

Par défaut, `liveTime` suit la fin de période ; dès que l'application fournit `liveTime`, elle le pilote explicitement.

## React

- `useTimelineController(options)` crée une instance stable. Les options sont lues une fois, sauf `prepareTime` qui appelle toujours la dernière fonction fournie. Le hook démarre le contrôleur, suspend la progression quand la page est masquée et suit `prefers-reduced-motion` sauf si `reducedMotion` est donné.
- `useTimelineHost(controller, { respectReducedMotion? })` raccorde une instance créée par l'application avec `createTimelineController` : démarrage et suspension quand la page est masquée. Contrairement au hook précédent, il ne remplace pas l'ordonnanceur (passer `scheduler: createAnimationFrameScheduler()` à la création) et ne suit `prefers-reduced-motion` qu'avec `respectReducedMotion: true`.
- Aucun des deux hooks n'appelle `dispose()` au démontage : ils suspendent la progression (`setActive(false)`), ce qui reste compatible avec StrictMode et `<Activity>`. Le propriétaire d'une instance partagée appelle `dispose()` lui-même.
- `Timeline` : `height`, `laneHeight`, `labelWidth`, `locale`, `labels`, `formatTime`, `formatTick`, `renderRowLabel`, `renderItem`, `getItemClassName`, `getItemAriaLabel`, `onItemClick`, `selectedItemId`, `tooltip`, `detail`, `toolbar`, `showZoomControls`, `rowsHeader`, `initialTrackWidth` (largeur avant la première mesure), `className`, `style`.
- `getItemAriaLabel(item)` remplace le nom accessible des éléments (par défaut : libellé, ou « Groupe de N » pour un groupe sans libellé, puis l'heure). Avec un `renderItem` qui affiche du texte, le nom doit contenir ce texte visible (WCAG 2.5.3, « Étiquette dans le nom »). Sans cette prop, le comportement par défaut est conservé.
- `PlaybackControls` : `speeds` (par défaut `0,25×` à `8×`), `showLive` (faux par défaut), `showLoop` et `showKeys` (vrais par défaut), `showReadout`, `locale`, `labels`, `formatTime`, `formatSpeed`, `className`.
- `DetailModal` : fenêtre de détail simple, utilisable indépendamment, rendue dans `document.body` (portail). `inertRoot` désigne l'élément rendu `inert` pendant l'ouverture (`Timeline` y passe son cadre) ; son `data-theme` est recopié sur la fenêtre.
- `frenchLabels` et `defaultLabels` fournissent les textes ; chaque entrée est remplaçable.

## Interactions et clavier

| Geste | Effet |
| --- | --- |
| Clic sur le fond | Saut à l'instant pointé |
| Glisser le fond | Déplacement de la fenêtre (sans saut au relâchement) |
| Glisser la poignée du curseur | Saut vers la dernière position pointée |
| Ctrl/⌘ + molette | Zoom autour du pointeur |
| Pincement à deux doigts | Zoom autour des doigts |
| Clic sur un repère de clé | Saut vers cette clé |
| Maj + molette, défilement horizontal | Déplacement horizontal |
| Clic sur un élément | `onItemClick` ; le temps ne bouge pas |

L'axe est un curseur accessible (`role="slider"`) :

| Touche | Effet |
| --- | --- |
| ← / → | Saut de 1/50 de la fenêtre (Maj : 1/10) |
| Début / Fin | Début ou fin de la période |
| Page préc. / Page suiv. | Clé précédente / suivante |
| + / − | Zoom |
| Espace | Lecture / pause |

Les losanges des clés sont posés au-dessus de l'axe, hors du curseur ; ils restent cliquables (zone de 24 px) mais ne sont pas des arrêts de tabulation : Page préc. / Page suiv. y mènent, ce que rappelle une description associée au curseur (`labels.cursorHelp`).

Les éléments forment un seul arrêt de tabulation. Les flèches parcourent la ligne (← →) ou passent à la ligne voisine (↑ ↓), Début et Fin vont aux extrémités de la ligne ; Entrée ou Espace active l'élément. Un élément hors de la fenêtre est révélé avant de recevoir le focus.

## Styles

Importer `time-weave/styles.css`. Les couleurs sont des variables `--tw-*` sur `.tw-timeline` ; un thème sombre suit `prefers-color-scheme`, et `data-theme="light"` ou `"dark"` posé sur l'élément `.tw-timeline` lui-même force un thème (par exemple via un `ref` ou une règle CSS de l'application). Les classes `tw-item`, `tw-item--point`, `tw-item--span`, `tw-item--group`, `tw-item--selected` et `tw-item--active` permettent d'adapter l'affichage ; `getItemClassName` ajoute des classes par élément.

## Choix d'implémentation à valider

Ces comportements ne sont pas tranchés explicitement par la conception ; l'implémentation retient l'option indiquée.

| Situation | Comportement actuel | Alternative |
| --- | --- | --- |
| Lecture depuis le Direct alors que la frontière est la fin de période | Applique « Lecture à la fin » : retour au début puis lecture | Rester à la frontière, lecture immédiatement terminée |
| Pause pendant un retour de boucle, puis extension de la période | Le retour engagé se termine (Pause laisse finir la préparation en cours) | Annuler le retour, rester à l'ancienne fin |
| Navigation manuelle de la fenêtre | Nouvelle génération créée au plus une fois par tâche (microtâche), pour regrouper un geste | Invalidation synchrone à chaque déplacement |
| Lot de fenêtre citant une ligne supprimée pendant son chargement | Lot refusé avec erreur structurée, lot précédent conservé | Écarter silencieusement les éléments de lignes absentes |
| Clés hors de la période complète | Ignorées par la navigation ; redeviennent des destinations si la période s'étend | — |
