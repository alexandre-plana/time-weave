# Exemples

Applications consommatrices de la bibliothèque, servies par Vite. Elles importent `@time-weave/react` depuis les sources du dépôt (alias dans `vite.config.ts`).

```bash
npm run dev:examples     # http://localhost:5173/
npm run build:examples   # build statique dans examples/dist
```

| Page | Ce qu'elle montre |
| --- | --- |
| `operations/` | Journée d'opérations : 211 lignes du jeu de référence, source par fenêtre avec regroupement décidé par l'application selon le zoom, `prepareTime` qui attend les données et met à jour un panneau d'état, flux simulé qui étend la période, Direct, délais de préparation et de chargement réglables, inspecteur au clic. |
| `history/` | Histoire d'entreprise sur 75 ans : périodes, jalons comme clés, contenu d'élément personnalisé, libellés de ligne, fenêtre de détail facultative, lecture à quatre ans par seconde. |
| `relative/` | Banc d'essai en temps relatif : séquence de −2 s à 12 s autour d'un déclenchement à 0 ms, phases, mesures à la milliseconde, rafales regroupées par l'application, valeurs des capteurs recalculées dans `prepareTime`. |
| `bench/` | Page de mesure du [jeu de référence](../docs/JEU-REFERENCE.md). Bouton « Lancer les scénarios » ou `?run=1` ; résultats dans `window.__bench`. Résultats relevés : [MESURES.md](../docs/MESURES.md). |

## Ce que les exemples illustrent du contrat

- **Regroupement côté application** : `operations/data.ts` (`binFor`, `buildItems`) choisit un niveau de regroupement selon la durée visible et fournit les résumés des lignes parentes. La timeline ne regroupe rien ; l'exemple appelle `controller.refresh()` quand son niveau change ou que le dépliage change.
- **Préparation** : `prepareTime` attend `controller.waitForData(target, signal)`, simule un délai, vérifie `request.isCurrent()` puis met à jour l'état affiché.
- **Flux** : le flux simulé ajoute 5 communications toutes les 50 ms dans le magasin de l'application, puis appelle `extendDomain` et `refresh`. La bibliothèque ne reçoit pas le flux elle-même.
