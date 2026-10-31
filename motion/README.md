# Time Weave — film de démonstration (60 s)

Film de motion design pour présenter Time Weave : 60 secondes, 1920 × 1080, 60 i/s, avec une bande-son électronique minimale.

![Planche du film](out/storyboard.png)

- Vidéo : [`out/time-weave-demo.mp4`](out/time-weave-demo.mp4)
- Prévisualisation interactive : ouvrir `index.html` (Espace pour lire ou mettre en pause, curseur pour se déplacer)

## Note d'intention

Le film ne dit qu'une chose : **le temps reste partagé**. Un seul trait bleu, le curseur, sert de fil conducteur du début à la fin. Il se dessine, révèle le titre, devient le curseur de la timeline, est suivi par l'application, devient rouge en Direct, sert de volet pour passer au thème sombre et finit en logo.

Le style est éditorial : beaucoup d'air, un panneau blanc posé sur un fond `#F7F8FA`, des filets de 1 px `#E6E9EE`, une légende de chapitre en haut à gauche (numéro en Plex Mono et phrase-titre en Inter) et un folio discret en haut à droite. Les mouvements décélèrent (`outCubic`, `outQuart`, `outExpo`), les changements de cadre utilisent `inOutCubic`, et la caméra zoome de façon logarithmique pour garder une vitesse perçue constante.

L'interface montrée reprend l'API réelle de la bibliothèque : barre `PlaybackControls`, clés en losanges, contrat `prepareTime(request)`, Direct, raccourcis clavier documentés dans `docs/GUIDE.md` et fenêtre de détail.

## Découpage

| Temps | Séquence | Ce que l'on voit | Son |
| --- | --- | --- | --- |
| 0:00 – 0:06 | **Ouverture** | Un trait bleu se dessine. Sa poignée affiche `12:34:56.789` et défile pendant qu'il balaie la page et révèle « Time Weave », un tiret bleu, puis « des timelines qui restent synchronisées » sur un filet gradué. | Nappe en la mineur 9 qui monte, tics de graduation, cloche |
| 0:06 – 0:12 | **01 Hiérarchie** | Recul de caméra ×7 → ×1 : le trait devient le curseur du panneau. Le pointeur ouvre Connecteurs, puis Réseau MQTT et Réseau LoRa, et les lignes se déplient en cascade. | Souffle descendant, sub, le kick entre à 0:08, une note par ligne |
| 0:12 – 0:20 | **02 Échelles** | Ctrl + molette : plongée jusqu'à **23 ms** (graduations à la milliseconde), puis zoom arrière continu jusqu'à **46 ans**. Les éléments se regroupent en pastilles avec compteur. Une échelle « ms · s · min · h · jour · mois · an · décennie » suit la fenêtre visible. | Le kick s'arrête pendant la plongée. Une tonalité suit l'échelle (sa hauteur suit le zoom, son volume suit la vitesse). |
| 0:20 – 0:28 | **03 Lecture** | Retour sur 3 h, lecture, trois sauts « clé suivante » (les losanges ambre pulsent), boucle activée, vitesse ×4, retour automatique au début. | Cloches ascendantes sur les clés, arpège à rebours sur la boucle |
| 0:28 – 0:36 | **04 Synchronisation** | Écran partagé avec un tableau de bord « Station Nord ». Un clic place une **ligne d'attente en pointillés** et la requête `prepareTime(request)` part vers l'application, qui affiche des squelettes. Ensuite, le curseur et les données se confirment **ensemble** (« Synchronisé »). Pendant la lecture, une deuxième attente montre que la lecture se suspend. Le contrat de code est affiché. | Tic-tac d'attente, carillon de confirmation |
| 0:36 – 0:44 | **05 Direct** | Le bouton Direct passe au rouge. La frontière rouge avance et le flux arrive (anneaux d'arrivée). L'utilisateur fait glisser la vue vers l'historique : une pastille « Direct +28 » compte ce qui arrive hors champ. Un clic dans le passé, puis « Revenir au Direct ». | Impact grave, petites notes d'arrivée, frottement, souffle montant |
| 0:44 – 0:52 | **06 Thèmes & clavier** | Le trait bleu balaie l'écran et fait passer tout le film en thème sombre. Navigation au clavier (`Tab`, `←`, `←`, `↑`, `Entrée`, `Tab`, `Échap`) avec un anneau de focus. La fenêtre de détail s'ouvre et se ferme. | Grand souffle et chute de sub, clics de touches, « pop » de fenêtre |
| 0:52 – 1:00 | **Logo** | Les lignes se replient, retour au clair. Le trait revient au centre puis se résout en trois brins tissés (bleu, vert, violet). Le mot-symbole `timeweave` apparaît, puis la signature **TypeScript · React · Open source** et un filet gradué où le curseur continue d'avancer. | Accord final en do majeur 9, trois notes pincées, résonance |

## Système graphique

| Rôle | Valeur |
| --- | --- |
| Fond | `#F7F8FA` (sombre `#0E1014`) |
| Panneaux | `#FFFFFF`, rayon 14 px, ombre très diffuse (sombre `#15181D`) |
| Filets | `#E6E9EE`, 1 px |
| Curseur | `#4772E9` |
| Direct | `#D9483B` |
| Pastilles | bleu (communication), vert (acquisition), ambre (alerte), violet (traitement) : fond teinté, bord plus soutenu, texte foncé |
| Clés | losanges ambre `#C08A22` |
| Typographie | Inter 400/500/600 pour les textes, IBM Plex Mono 400/500/600 pour les horodatages, les valeurs et le code |

Les couleurs des pastilles et du thème sombre reprennent les variables `--tw-*` de `src/styles.css`.

## Musique

Le morceau est entièrement synthétisé par `music.py` avec numpy, sans échantillon : 120 BPM, une mesure = 2 s, donc chaque séquence tombe sur une barre. La grille harmonique est la mineur 9, fa majeur 9, do majeur 9, sol 6, ré mineur 9 et mi mineur 7, et se résout en do majeur 9 sur le logo. Le morceau combine un pad additif désaccordé, un kick doux avec compression latérale, une charleston en contretemps, une basse sur les contretemps et des arpèges pincés en écho ping-pong, le tout passé dans une réverbération à convolution. Les effets sont calés à l'image près sur les repères exportés par la scène (`out/cues.json`). Le niveau intégré est d'environ −13 LUFS et la crête à −1 dBFS.

## Fabrication

Toute l'image est une fonction pure du temps, `TW.render(ctx, t)` dans `scene.js` (Canvas 2D). Le rendu est donc déterministe image par image et ne dépend d'aucune horloge.

```bash
cd motion
node render.cjs cues                       # repères sonores → out/cues.json
python3 music.py                           # bande-son → out/music.wav
node render.cjs video 60                   # 3 600 images → out/time-weave-demo.mp4 (H.264 + AAC)
node render.cjs stills 2,14,31,48 out/img  # images de contrôle
```

Il faut Node 18 ou plus, Playwright avec Chromium, ffmpeg (libx264), ainsi que Python 3 et numpy. Les polices Inter et IBM Plex Mono sont incluses dans `fonts/` (licence SIL OFL 1.1).
