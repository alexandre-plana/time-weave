# Mesures sur le jeu de référence

Date : 31 octobre 2026.
Statut : séries relevées dans un environnement de développement sans écran. Elles ne constituent pas une capacité annoncée.

Les scénarios suivent le [jeu de référence](JEU-REFERENCE.md). Sur un poste de travail, `npm run bench -- --headed` construit les exemples, exécute les scénarios dans Chromium avec fenêtre et affiche un tableau Markdown à coller ici. La page `examples/bench/` les exécute : `npm run dev:examples`, puis ouvrir `/bench/index.html` et cliquer sur « Lancer les scénarios », ou ajouter `?run=1` à l'adresse. Les résultats sont aussi exposés dans `window.__bench` pour une exécution automatisée.

## Environnement

| Élément | Valeur |
| --- | --- |
| Navigateur | Chromium 153 sans interface (Playwright), serveur de développement Vite |
| Machine | Conteneur Linux, 4 cœurs virtuels Intel Xeon 2,1 GHz, sans GPU |
| Vue | 1440 × 900, densité 1, hauteur de timeline 640 px |
| Rendu | Lignes et marqueurs HTML/CSS, axe SVG, limitation verticale et horizontale au visible |
| Build | Séries 1, 2 et 3 : serveur de développement Vite, React en mode développement ; colonne production : `vite build` servi par `vite preview` (non relevée pour la série 3) |

Les durées mesurées incluent deux images d'affichage après la commande (`requestAnimationFrame` ×2) : leur plancher est d'environ 33 ms. Le navigateur sans interface cadence les images entre 30 et 60 par seconde.

## Volumes obtenus

| Mesure | Jeu de référence | Obtenu |
| --- | --- | --- | --- |
| Lignes totales | 211 | 211 |
| Lignes visibles au départ | 51 | 51 |
| Éléments transmis pour la fenêtre avec marge | 5 000 | 5 000 |
| Éléments dans la fenêtre temporelle visible | ~2 000 | 3 981 (générateur plus dense que prévu dans la zone visible) |
| Éléments présents dans le DOM | ~1 000 visibles | 256 (lignes visibles en hauteur, avec marge) |

## Résultats

Série 2 : après la mémorisation des lignes et les corrections de la relecture. La série 1 (vue redessinée entièrement à chaque image) est conservée pour comparaison.

Série 3 : après la réutilisation des lignes équivalentes au remplacement d'un lot (voir plus bas). Même environnement que les séries précédentes (même conteneur, même Chromium sans interface, serveur de développement) ; trois passages complets du banc, la colonne donne l'étendue des valeurs obtenues.

| Scénario | Série 1 | Série 2 | Série 2, build de production | Série 3 (3 passages) |
| --- | --- | --- | --- | --- |
| 1. Affichage initial (montage jusqu'à deux images) | 232 ms | 235 ms | 148 ms | 191 à 258 ms |
| 1. Dépliage ou repliage d'un type, médiane | 69 ms | 49 ms | 33 ms | 32 à 40 ms |
| 2. Zoom par pas, médiane / p95 | 34 / 64 ms | 33 / 56 ms | 33 / 34 ms | 48 à 51 / 53 à 85 ms |
| 2. Déplacement horizontal, médiane / p95 | 34 / 53 ms | 34 / 50 ms | 33 / 35 ms | 34 à 37 / 52 à 67 ms |
| 2. Défilement vertical, médiane | 46 ms | 33 ms | 33 ms | 33 ms |
| 3. Remplacement des 5 000 éléments (source immédiate, génération du lot incluse) | 33 ms (1 essai) | médiane 67 ms, max 83 ms (5 essais) | médiane 50 ms, max 50 ms | médiane 50 ms, max 50 à 58 ms (3 × 5 essais) |
| 4. Lecture 1×, 60×, 600× : images/s | 48 à 49 | 60 | 60 | 57 à 60 |
| 4. Lecture : p95 de durée d'image, images > 50 ms sur 2 s | 50 ms, 1 à 3 | 16,7 ms, 0 | 16,8 ms, 0 | 16,7 ms (une fois 33 ms à 600×), 0 |
| 4. Rendu React de la timeline par mise à jour, médiane / p95 | 6,6 à 7,1 / 47 à 53 ms | 3,1 à 5,0 / 7 à 8,6 ms | non mesuré (`Profiler` inactif en production) | 3,5 à 5,8 / 5,9 à 18,9 ms |
| 4. Boucle complète | retour au début confirmé | idem | idem | idem |
| 5. Avance logique / temps réel, préparation 0 ms | 99 % (85 % avant correction) | 100 % | 100 % | 99 à 100 % |
| 5. Avance logique / temps réel, préparation 50 ms | 20 % | 23 % | 23 % | 19 à 24 % |
| 5. Avance logique / temps réel, préparation 200 ms | 4 % | 6 % | 7 % | 7 % |
| 6. Pause, saut et Stop pendant une attente de 200 ms | dernière destination appliquée | idem | idem | idem |
| 7. Rewind de 300 ms actives | 318 ms réelles, cible exacte | 319 ms, cible exacte | 311 ms, cible exacte | 312 à 319 ms, cible exacte |
| 8. Collections dynamiques, 5 modifications / 50 ms, jusqu'à l'image | médiane 24 ms, p95 30 ms | 16 / 17 ms | 16 / 17 ms | 6,6 à 7,0 / 9,5 à 10,9 ms (banc modifié entre-temps, non comparé) |
| 9. Direct, source lente (200 ms), rafraîchissements toutes les 50 ms pendant 3 s | 14 lots sur 15 demandes, écart 1 s simulée | idem | idem | idem |
| 10. Historique puis retour au Direct | aucune reprise involontaire | idem | idem | idem |

## Série 3 : remplacement d'un lot

Un rafraîchissement renvoie le plus souvent les mêmes éléments (mêmes identifiants et mêmes temps) sous forme de nouveaux objets. Jusqu'à la série 2, chaque nouveau tableau d'éléments regroupait, triait deux fois (tri de la ligne puis tri interne de `assignLanes`), recalculait les pistes et recréait la disposition de chaque ligne : toutes les lignes mémorisées étaient redessinées.

Depuis la série 3, une ligne dont les éléments sont équivalents (comparés dans l'ordre reçu : identifiants, temps, libellé, taille de groupe) garde son tableau trié, ses pistes et son objet de disposition, et n'est pas redessinée. Si seuls le libellé ou la taille de groupe changent, l'ordre et les pistes sont repris sans nouveau tri. Avec `renderItem`, `getItemClassName` ou `getItemAriaLabel`, qui peuvent lire n'importe quel champ, la ligne n'est réutilisée telle quelle que si les objets sont identiques. Le tri n'est plus fait qu'une fois (`assignLanes(items, minExtent, { presorted: true })`, même résultat qu'avant). Le clic transmet toujours l'objet courant à `onItemClick`.

Avant / après, relevés le même jour, dans le même environnement, trois passages complets du banc de chaque côté (serveur de développement) :

| Scénario | Avant (code de la série 2) | Après (série 3) |
| --- | --- | --- |
| 3. Remplacement, médiane sur 5 essais | 66 ms, 67 ms, 100 ms | 50 ms, 50 ms, 50 ms |
| 3. Remplacement, maximum sur 5 essais | 84 ms, 84 ms, 117 ms | 50 ms, 51 ms, 58 ms |
| 4. Lecture 1× / 60× / 600× : images/s | 58 à 60 | 57 à 60 |
| 4. Lecture : p95 de durée d'image, images > 50 ms | 16,8 ms, 0 | 16,7 à 16,8 ms (une fois 33,2 ms à 600×), 0 |
| 4. Rendu React par mise à jour, médiane / p95 (1×) | 5,2 à 8,4 / 7,4 à 11,2 ms | 5,3 à 5,8 / 8,0 à 8,2 ms |
| 4. Rendu React par mise à jour, médiane / p95 (60×) | 3,7 à 6,4 / 7,6 à 10,1 ms | 4,1 à 4,7 / 5,9 à 10,9 ms |
| 4. Rendu React par mise à jour, médiane / p95 (600×) | 3,0 à 4,4 / 11,6 à 16,4 ms | 3,5 à 3,9 / 9,5 à 18,9 ms |

- Le remplacement passe d'environ quatre images (67 ms) à trois (50 ms) en mode développement ; les durées sont arrondies aux images du navigateur (16,7 ms), le gain réel par lot n'est donc connu qu'à une image près.
- La lecture n'est pas modifiée : les écarts restent dans la dispersion entre passages.
- Le dépliage (32 à 40 ms contre 53 à 79 ms avant le même jour) profite aussi de la réutilisation des lignes situées au-dessus de la ligne dépliée ; le zoom et le déplacement ne changent pas de façon nette.
- Le premier passage « avant » (affichage initial 447 ms, zoom 67 ms) montre que l'environnement varie d'un passage à l'autre ; ce jour-là, le zoom médian du code de la série 2 était de 50 à 67 ms, au-dessus des 33 ms de la série 2. Les comparaisons ne valent qu'entre relevés d'une même session.
- Le build de production n'a pas été remesuré pour la série 3.

## Lecture des résultats

- **Préparation retardée** : avec 50 ou 200 ms d'attente par position, le rejeu avance de la durée d'une image par cycle de préparation. C'est le comportement retenu par la conception (« un écran lent ralentit le rejeu », aucun rattrapage). Une application lente qui veut un rejeu plus rapide peut augmenter la vitesse, ou préparer moins souvent en ignorant les petites variations.
- **Correction issue de la mesure** : la première série donnait 85 % d'avance avec une préparation immédiate. Le temps de rendu React pendant une confirmation synchrone était compté comme une attente. Le moteur garde désormais l'horodatage de l'image comme référence quand la confirmation arrive dans cette même image ; un test de règle couvre ce cas.
- **Direct avec source lente** : les rafraîchissements continus sont regroupés derrière la demande active ; presque toutes les demandes aboutissent au lieu d'être annulées.
- **Pics de rendu pendant la lecture (série 1)** : chaque image redessinait toutes les lignes. Depuis la série 2, une ligne n'est redessinée que si sa disposition, la fenêtre ou les éléments sous le curseur changent ; le p95 de rendu passe sous 9 ms.
- **Remplacement des données (série 2)** : la série 1 ne reposait que sur un essai. Sur cinq essais, la médiane est de 67 ms. Le calcul des pistes de 5 000 éléments prend environ 9 ms hors navigateur ; le reste se partage entre la génération du lot par la source d'essai, la validation et le rendu React en mode développement.
- **Remplacement des données (série 3)** : les lignes équivalentes ne sont plus ni triées, ni redessinées ; la médiane descend à 50 ms en mode développement (voir la section Série 3).
- **Rendu** : la limitation au visible maintient le DOM à quelques centaines d'éléments pour 5 000 transmis. Les durées d'interaction restent proches du plancher de deux images dans cet environnement ; une mesure sur un poste avec écran et un build de production reste à faire avant d'annoncer une capacité.

## À compléter

- Même série sur un poste de travail réel (navigateur avec écran) et sur un navigateur WebKit ou Firefox.
- Mémoire : non mesurée dans cette série.
- Profilage du remplacement de lot (50 ms en production en série 2, 50 ms en développement en série 3), pour séparer génération du lot, validation, pistes et rendu ; série 3 en build de production.

## Mise à jour groupée des collections (hors navigateur)

Mesure Node.js du coût d'un appel `update()` (2 suppressions, 2 ajouts, 1 modification) sur une source en mémoire, avant et après la validation incrémentale (`tests/update-perf.test.ts` vérifie l'équivalence avec la validation complète).

| Éléments | Validation complète | Validation des seuls éléments modifiés |
| --- | --- | --- |
| 2 000 | 206 µs | 15 µs |
| 20 000 | 3,4 ms | 0,11 ms |

Le coût restant est surtout la copie du tableau immuable exposé dans l'instantané.
