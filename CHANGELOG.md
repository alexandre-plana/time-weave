# Journal des versions

## 0.1.0 — non publiée

Première implémentation de la [conception V1](docs/CONCEPTION-V1.md).

- Moteur `time-weave/core` sans React ni DOM : période, fenêtre, lecture, pause, stop, vitesse, boucle, saut, clés, rewind, mode Direct, contrat `prepareTime` avec annulation, sources en mémoire ou par fenêtre, collections dynamiques atomiques, erreurs structurées.
- Graduations calendaires en UTC et relatives, de la milliseconde aux décennies ; placement déterministe en pistes.
- Vue React `Timeline` : axe SVG, lignes dépliables, limitation au visible, curseur confirmé et cible en attente, zoom et déplacement à la souris, au clavier et au pincement, focus des éléments, infobulle, fenêtre de détail facultative, textes anglais et français, thème sombre.
- `PlaybackControls`, `DetailModal`, `useTimelineController`, `useTimelineHost`, `useTimelineSnapshot`.
- Exemples d'opérations et d'histoire d'entreprise, page de mesure du jeu de référence.
- Vérifications : tests de règles sur horloge manuelle, tests jsdom, isolation du moteur, archive installée dans une application distincte, CI.
