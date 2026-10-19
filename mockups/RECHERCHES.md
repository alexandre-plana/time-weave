# Recherches — Explorer d’autres écritures temporelles

19 octobre 2026. Les quatre études existantes sont conservées ; trois propositions supplémentaires explorent le composant de timeline, avec les mêmes données illustratives.

## Références consultées

- [Observable Plot — Cell mark](https://observablehq.github.io/plot/marks/cell) : cellules, encodage de couleur et vues compactes. Point de départ de **Matrice**. Le prototype ne dépend pas de cette bibliothèque.
- [Mike Bostock — Fisheye Distortion](https://bost.ocks.org/mike/fisheye/) : technique focus + contexte. Point de départ de **Loupe**, adaptée ici en trois segments linéaires explicites, plutôt qu’en déformation continue.
- [SIMILE Widgets — Timeline](https://www.simile-widgets.org/timeline/) : exploration temporelle avec contexte. Référence complémentaire de navigation.
- [UBC InfoVis — TimeElide](https://www.cs.ubc.ca/group/infovis/time-elide/) : plusieurs niveaux de détail temporel et encodages en cellules ou bandes. Cela conforte l’intérêt de comparer des représentations selon la tâche.
- [vis-timeline — types d’éléments](https://visjs.github.io/vis-timeline/docs/timeline/) : distinction entre points, périodes et zones de fond. Les études maintiennent une distinction entre instant et intervalle.

## Les trois interprétations

| Étude | Question visuelle | Représentation | Limite à garder visible |
| --- | --- | --- | --- |
| 05 — Matrice | Où se trouvent les périodes actives et les creux ? | Cellules temporelles, couleur selon la couverture, losange pour un instant | Une cellule peut contenir plusieurs éléments ; son détail est consultable |
| 06 — Arches | Comment lire les bornes et la longueur des périodes autrement ? | Une courbe entre le début et la fin, deux extrémités, nom au-dessus | La hauteur des arches n’est pas une mesure ni un lien causal |
| 07 — Loupe | Comment inspecter un moment tout en gardant les alentours ? | Centre agrandi, côtés comprimés, graduations explicites, fenêtre déplaçable | L’échelle horizontale n’est pas uniforme |

**Arches** est une exploration graphique originale des intervalles ; elle ne prétend pas reproduire une méthode de visualisation validée par ces références.

## Sémantique de la matrice

Chaque cellule correspond à une tranche de la fenêtre visible. Sa couverture est la durée de l’union des périodes présentes dans cette tranche, divisée par la durée de la tranche. Un chevauchement ne compte donc pas deux fois. Les instants sont signalés séparément par un losange.

Un groupe fourni reste un seul élément du jeu de données : son compteur n’est pas réparti arbitrairement dans les cellules. Les nombres de communications sous-jacentes ne sont pas inventés. Cliquer une cellule révèle les éléments qui l’intersectent et leurs informations.

## Sémantique de la loupe

Une tranche de 20 % de la fenêtre temporelle reçoit normalement 64 % de la largeur. Le contexte de part et d’autre conserve 18 % chacun, lorsqu’il existe. La zone peut être déplacée avec le réglage « Centre de la loupe » ou suivre le curseur.

Le clic sur le fond et le déplacement du curseur appliquent la fonction inverse de cette échelle. Le zoom, les clés et la lecture continuent à commander le même temps logique. La vue d’ensemble reste linéaire. Les séparateurs `//` et la mention « échelle non uniforme » rendent le changement d’échelle visible.

Ces études sont des prototypes d’exploration visuelle, pas une modification du périmètre validé de la bibliothèque. Elles restent en thème clair, avec trois densités, les deux scénarios et la navigation temporelle.
