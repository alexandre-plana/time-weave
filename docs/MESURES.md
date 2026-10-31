# Mesures sur le jeu de référence

Date : 31 octobre 2026.
Statut : première série, relevée dans un environnement de développement sans écran. Elle ne constitue pas une capacité annoncée.

Les scénarios suivent le [jeu de référence](JEU-REFERENCE.md). La page `examples/bench/` les exécute : `npm run dev:examples`, puis ouvrir `/bench/index.html` et cliquer sur « Lancer les scénarios », ou ajouter `?run=1` à l'adresse. Les résultats sont aussi exposés dans `window.__bench` pour une exécution automatisée.

## Environnement

| Élément | Valeur |
| --- | --- |
| Navigateur | Chromium 153 sans interface (Playwright), serveur de développement Vite |
| Machine | Conteneur Linux, 4 cœurs virtuels Intel Xeon 2,1 GHz, sans GPU |
| Vue | 1440 × 900, densité 1, hauteur de timeline 640 px |
| Rendu | Lignes et marqueurs HTML/CSS, axe SVG, limitation verticale et horizontale au visible |
| Build | Mode développement de React (plus lent que la production) |

Les durées mesurées incluent deux images d'affichage après la commande (`requestAnimationFrame` ×2) : leur plancher est d'environ 33 ms. Le navigateur sans interface cadence les images entre 30 et 60 par seconde.

## Volumes obtenus

| Mesure | Jeu de référence | Obtenu |
| --- | --- | --- |
| Lignes totales | 211 | 211 |
| Lignes visibles au départ | 51 | 51 |
| Éléments transmis pour la fenêtre avec marge | 5 000 | 5 000 |
| Éléments dans la fenêtre temporelle visible | ~2 000 | 3 981 (générateur plus dense que prévu dans la zone visible) |
| Éléments présents dans le DOM | ~1 000 visibles | 256 (lignes visibles en hauteur, avec marge) |

## Résultats

Série 2 : après la mémorisation des lignes et les corrections de la relecture. La série 1 (vue redessinée entièrement à chaque image) est conservée pour comparaison.

| Scénario | Série 1 | Série 2 |
| --- | --- | --- |
| 1. Affichage initial (montage jusqu'à deux images) | 232 ms | 235 ms |
| 1. Dépliage ou repliage d'un type, médiane | 69 ms | 49 ms |
| 2. Zoom par pas, médiane / p95 | 34 / 64 ms | 33 / 56 ms |
| 2. Déplacement horizontal, médiane / p95 | 34 / 53 ms | 34 / 50 ms |
| 2. Défilement vertical, médiane | 46 ms | 33 ms |
| 3. Remplacement des 5 000 éléments (source immédiate, génération du lot incluse) | 33 ms (1 essai) | médiane 67 ms, max 83 ms (5 essais) |
| 4. Lecture 1×, 60×, 600× : images/s | 48 à 49 | 60 |
| 4. Lecture : p95 de durée d'image, images > 50 ms sur 2 s | 50 ms, 1 à 3 | 16,7 ms, 0 |
| 4. Rendu React de la timeline par mise à jour, médiane / p95 | 6,6 à 7,1 / 47 à 53 ms | 3,1 à 5,0 / 7 à 8,6 ms |
| 4. Boucle complète | retour au début confirmé | idem |
| 5. Avance logique / temps réel, préparation 0 ms | 99 % (85 % avant correction) | 100 % |
| 5. Avance logique / temps réel, préparation 50 ms | 20 % | 23 % |
| 5. Avance logique / temps réel, préparation 200 ms | 4 % | 6 % |
| 6. Pause, saut et Stop pendant une attente de 200 ms | dernière destination appliquée | idem |
| 7. Rewind de 300 ms actives | 318 ms réelles, cible exacte | 319 ms, cible exacte |
| 8. Collections dynamiques, 5 modifications / 50 ms, jusqu'à l'image | médiane 24 ms, p95 30 ms | 16 / 17 ms |
| 9. Direct, source lente (200 ms), rafraîchissements toutes les 50 ms pendant 3 s | 14 lots sur 15 demandes, écart 1 s simulée | idem |
| 10. Historique puis retour au Direct | aucune reprise involontaire | idem |

## Lecture des résultats

- **Préparation retardée** : avec 50 ou 200 ms d'attente par position, le rejeu avance de la durée d'une image par cycle de préparation. C'est le comportement retenu par la conception (« un écran lent ralentit le rejeu », aucun rattrapage). Une application lente qui veut un rejeu plus rapide peut augmenter la vitesse, ou préparer moins souvent en ignorant les petites variations.
- **Correction issue de la mesure** : la première série donnait 85 % d'avance avec une préparation immédiate. Le temps de rendu React pendant une confirmation synchrone était compté comme une attente. Le moteur garde désormais l'horodatage de l'image comme référence quand la confirmation arrive dans cette même image ; un test de règle couvre ce cas.
- **Direct avec source lente** : les rafraîchissements continus sont regroupés derrière la demande active ; presque toutes les demandes aboutissent au lieu d'être annulées.
- **Pics de rendu pendant la lecture (série 1)** : chaque image redessinait toutes les lignes. Depuis la série 2, une ligne n'est redessinée que si sa disposition, la fenêtre ou les éléments sous le curseur changent ; le p95 de rendu passe sous 9 ms.
- **Remplacement des données (série 2)** : la série 1 ne reposait que sur un essai. Sur cinq essais, la médiane est de 67 ms. Le calcul des pistes de 5 000 éléments prend environ 9 ms hors navigateur ; le reste se partage entre la génération du lot par la source d'essai, la validation et le rendu React en mode développement.
- **Rendu** : la limitation au visible maintient le DOM à quelques centaines d'éléments pour 5 000 transmis. Les durées d'interaction restent proches du plancher de deux images dans cet environnement ; une mesure sur un poste avec écran et un build de production reste à faire avant d'annoncer une capacité.

## À compléter

- Même série sur un poste de travail réel (navigateur avec écran, build de production) et sur un navigateur WebKit ou Firefox.
- Mémoire : non mesurée dans cette série.
- Profilage du remplacement de lot en build de production, pour séparer validation, pistes et rendu.
