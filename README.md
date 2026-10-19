# Time Weave

Projet de bibliothèque TypeScript et React pour créer des timelines interactives : plusieurs lignes, hiérarchie dépliable, navigation temporelle et lecture synchronisée avec une application.

## État du projet

**18 octobre 2026 — Conception V1 validée ; reprise au plan de réalisation.**

Le dépôt contient la synthèse des besoins et la conception V1, enrichie du temps réel et d'un mode Direct activable. La conception a été relue par Astra et validée par l'utilisateur. Le plan de réalisation sera rédigé lors de la prochaine séance. Aucune fonctionnalité n'est encore implémentée et aucun package npm n'est publié.

## Premiers usages

- **Rejouer une journée d'opérations** : parcourir des communications de capteurs et piloter les autres éléments d'une application à partir du temps de lecture.
- **Surveiller un flux** : mettre à jour les collections pendant l'utilisation et suivre le Direct, avec possibilité de revenir à l'historique.
- **Présenter l'histoire d'une entreprise** : explorer des événements et des périodes sur plusieurs années ou décennies.

## Directions retenues

- Interface React dès la première version, avec du code TypeScript.
- Échelles allant de la milliseconde aux décennies.
- Temps de calendrier et temps relatif à un point de départ, par exemple une séquence commençant à `0 ms`.
- Zoom et déplacement libres, avec des limites configurables.
- Lignes dépliables sur plusieurs niveaux.
- Lecture, pause, arrêt, vitesse réglable, clé suivante/précédente et boucle sur la période complète parmi les besoins exprimés.
- Clés fournies dans les données comme des repères temporels pour la navigation.
- Actions au clic personnalisables par l'application.
- Pilotage temporel dans les deux sens : la timeline informe l'application, et l'application peut déplacer le curseur ou lancer la lecture.
- Regroupement des communications géré par l'application consommatrice ; la timeline affiche les éléments individuels ou groupés qu'elle reçoit.
- Données fournies par fenêtre temporelle et remplaçables au zoom ou au déplacement.
- Lecture suspendue lorsque l'application doit se mettre à jour, jusqu'à ce qu'elle soit prête.
- Collections dynamiques : ajout, modification et suppression pendant l'utilisation.
- Mode Direct activable suivant la dernière position fournie par l'application ; chargement et connexion au flux restent externes.

La séparation d'un moteur temporel indépendant de React et de la vue React est proposée ; le détail de cette architecture reste à valider.

## Documents de conception

- [Conception V1 validée](docs/CONCEPTION-V1.md) : lecture rapide, comportements, données, synchronisation et critères de réalisation.
- [Définition et statut du brainstorming](docs/DEFINITION.md) : besoins confirmés, propositions et limites de responsabilité.
- [Architecture proposée](docs/ARCHITECTURE.md) : séparation du moteur, de la vue React et des aides facultatives.
- [Questions ouvertes](docs/QUESTIONS-OUVERTES.md) : décisions restantes, par priorité.
- [Revue extérieure Astra](docs/REVUE-V1.md) : regard critique, recommandations et réponses de l'utilisateur.
- [Jeu de référence proposé](docs/JEU-REFERENCE.md) : volumes et scénarios pour mesurer la future implémentation.

Le cas opérationnel peut produire des centaines de communications par seconde avant regroupement. Le jeu de référence propose les volumes à mesurer après regroupement.

## Maquettes interactives

Le dossier [mockups/](mockups/README.md) contient sept explorations visuelles autonomes : l'Atelier original, Signaux, Jalons, Pistes, Matrice, Arches et Loupe. Ouvrir [le comparateur](mockups/propositions.html) pour parcourir les directions, ou [l'originale](mockups/index.html) pour retrouver la première maquette conservée à l'identique. Les dernières pistes et leurs références sont documentées dans [les notes de recherche](mockups/RECHERCHES.md).

Ces prototypes HTML/CSS/JavaScript illustrent la présentation et les interactions ; l'implémentation de la bibliothèque TypeScript/React reste à réaliser.

## Point de reprise

Commencer par rédiger le plan de réalisation à partir de la conception V1 validée. Les choix d'outillage et de versions exactes seront fixés dans ce plan. Aucun squelette de package, dépendance ou code produit n'a encore été créé ; aucune publication npm n'a été effectuée.

## Publication

Le nom du package npm, sa disponibilité, la licence, les versions de React prises en charge et l'outillage de distribution restent à choisir. Ce dépôt sera la racine du projet destiné à être public ; les documents de méthode et l'historique de travail sont conservés dans un espace local séparé.
