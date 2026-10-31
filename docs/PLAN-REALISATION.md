# Plan de réalisation V1

Date : 31 octobre 2026.
Statut : plan rédigé à partir de la [conception V1 validée](CONCEPTION-V1.md) ; exécution engagée le même jour.

Ce plan séquence les livraisons vérifiables. Chaque étape se termine par des tests qui passent et un commit poussé. Le package reste marqué `private` : aucune publication npm n'est prévue par ce plan.

## Choix d'outillage

| Sujet | Choix | Raison |
| --- | --- | --- |
| Langage | TypeScript strict, modules ES | Exigence de conception ; déclarations publiées avec le code |
| Compilation de distribution | `tsc` seul, vers `dist/` | Pas de bundler nécessaire pour une bibliothèque ESM ; déclarations natives |
| Tests de règles | Vitest, horloge et ordonnanceur injectés | Section 11 : mêmes commandes et durées, même état, sans dépendre des images |
| Tests React | Vitest + jsdom + Testing Library | Cycle de vie, abonnements, interactions clavier |
| Exemples | Vite, application séparée dans `examples/` | Démonstration et essais en navigateur |
| React | Dépendance `peer` : `^18.3.0 \|\| ^19.0.0` | Fournie par l'application ; `useSyncExternalStore` disponible dans les deux |
| Styles | Feuille CSS livrée telle quelle, variables CSS `--tw-*` | Import explicite `time-weave/styles.css` |

## Points d'entrée

- `time-weave/core` : moteur seul, sans React ni DOM. Importable côté serveur et dans les tests.
- `time-weave` : vue React, hook, aides, et réexport du moteur.
- `time-weave/styles.css` : styles par défaut.

Le nom `time-weave` est provisoire ; sa disponibilité et la licence seront réglées avant toute publication.

## Organisation du code

```
src/
  core/
    time.ts          bornes, clamp, validation des nombres
    model.ts         types publics : lignes, éléments, clés, lots
    validate.ts      erreurs structurées, validation atomique
    tree.ts          hiérarchie, lignes aplaties selon le dépliage
    keys.ts          clé précédente/suivante, clés simultanées
    ticks.ts         graduations calendrier (UTC) et relatif
    layout.ts        pistes déterministes dans une ligne
    scheduler.ts     interface d'horloge + horloge manuelle de test
    controller.ts    état, commandes, préparation, fenêtre, Direct
    index.ts
  react/
    useTimelineController.ts
    Timeline.tsx, PlaybackControls.tsx, Tooltip/DetailModal
    browserScheduler.ts   requestAnimationFrame + visibilité
    index.ts
  styles.css
tests/              tests Vitest (moteur puis React)
examples/operations/  premier fil conducteur
examples/history/     second exemple : histoire d'entreprise
```

## Étapes

### Étape 1 — Squelette et contrats (livrable : package compilable)

- `package.json`, `tsconfig`, Vitest, scripts `build`, `test`, `typecheck`.
- Types publics du modèle et validation structurée.
- Critère : `npm test` et `npm run build` passent ; `dist/core` n'importe ni React ni DOM.

### Étape 2 — Moteur temporel

- Période, fenêtre, bornes, vitesse, intention de transport (pause, rejeu, Direct).
- Contrat `prepareTime` : identifiant monotone, cause, `AbortSignal`, `isCurrent()`.
- Lecture, pause, stop, fin avec/sans boucle, saut, clés, rewind, Direct avec coalescence.
- Échec de préparation : position conservée, intention annulée, erreur exposée.
- Critère : un test par ligne des tableaux des sections 7 et 8, avec horloge manuelle.

### Étape 3 — Données et fenêtres

- Source directe et fournisseur de fenêtre synchrone/asynchrone, marge de 25 %.
- Générations manuelles, demandes automatiques coalescées, rafraîchissement regroupé.
- Collections dynamiques : remplacement et modifications groupées atomiques.
- Critère : cas de validation de la section 11 sur les fenêtres, le Direct et les données.

### Étape 4 — Intégration et vue React

- `useTimelineController` (instance stable, nettoyage, React StrictMode).
- `Timeline` : axe SVG, lignes HTML dépliables, marqueurs, pistes, curseur confirmé et cible en attente, zoom/déplacement, virtualisation verticale et horizontale.
- `PlaybackControls`, infobulle et modale facultatives ; clavier et réduction des animations.
- Critère : tests jsdom de rendu, de dépliage, de clavier et d'absence de double horloge.

### Étape 5 — Exemples

- Opérations : 211 lignes du jeu de référence, rejeu, flux simulé, Direct, fenêtres lentes, groupes, préparation retardée.
- Histoire d'entreprise : calendrier sur plusieurs décennies, périodes, contenu personnalisé.

### Étape 6 — Mesures et package

- Page de mesure sur le jeu de référence ; résultats documentés avec l'environnement.
- `npm pack` puis installation dans une application distincte : JavaScript, types, styles.

## Suivi

L'avancement est tenu dans la section « Journal » ci-dessous et dans le README.

## Journal

- 31 octobre 2026 : plan rédigé ; étapes 1 à 3 engagées.
