# Journal des versions

## 0.1.0 — non publiée (package `@time-weave/react`, licence MIT)

Première implémentation de la [conception V1](docs/CONCEPTION-V1.md).

- Moteur `@time-weave/react/core` sans React ni DOM : période, fenêtre, lecture, pause, stop, vitesse, boucle, saut, clés, rewind, mode Direct, contrat `prepareTime` avec annulation, sources en mémoire ou par fenêtre, collections dynamiques atomiques, erreurs structurées.
- Graduations calendaires en UTC et relatives, de la milliseconde aux décennies ; placement déterministe en pistes.
- Vue React `Timeline` : axe SVG, lignes dépliables, limitation au visible, curseur confirmé et cible en attente, zoom et déplacement à la souris, au clavier et au pincement, focus des éléments, infobulle, fenêtre de détail facultative, textes anglais et français, thème sombre.
- `PlaybackControls`, `DetailModal`, `useTimelineController`, `useTimelineHost`, `useTimelineSnapshot`.
- Exemples d'opérations et d'histoire d'entreprise, page de mesure du jeu de référence.
- Navigation : `zoomTo`, `centerOn`, `stepBy`, `fitToItems`, événement `viewport` ; composant `TimelineOverview` (vue d'ensemble de toute la période) ; bandes de mise en évidence (`highlights`) ; hook `useTimelineSelector` et `shallowEqual`.
- Comportements validés le 31 octobre 2026 : Lecture depuis le Direct sans retour au début ; éléments de lignes supprimées pendant un chargement écartés.
- Graduations calendaires alignées sur les semaines ISO, sans chevauchement des libellés longs.
- Prop `theme` (`light`, `dark`, `auto`), prop `getItemAriaLabel`, fenêtre de détail en portail avec arrière-plan `inert`.
- Accessibilité : contrastes conformes en thèmes clair et sombre, repères de clés hors du curseur accessible, noms accessibles des groupes, annonces d'attente différées.
- Performance : lignes mémorisées (60 images/s en lecture sur le jeu de référence), réutilisation des lignes inchangées au remplacement d'un lot.
- `update()` ne valide que les éléments modifiés (0,11 ms au lieu de 3,4 ms sur 20 000 éléments) ; correction d'une rétention mémoire de la vue en mode Direct.
- Démo publiée sur GitHub Pages dans le style du CV de l'auteur : accueil, exemples opérations, histoire, temps relatif et surveillance de site (carte, caméras, mosaïque vidéo), onglet Documentation d'intégration avec exemples copiables vérifiés et schémas ; documentation anglaise dans `docs/en/`.
- Film de présentation de 60 s (`motion/`), logo vectoriel (`docs/assets/`) et README réécrit.
- Vérifications : tests de règles sur horloge manuelle, tests aléatoires d'invariants, tests jsdom, tests de bout en bout Playwright, isolation du moteur, archive installée dans une application distincte avec React 19 et React 18.3, CI.
