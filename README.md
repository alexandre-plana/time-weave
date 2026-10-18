# Time Weave

Projet de bibliothèque TypeScript et React pour créer des timelines interactives : plusieurs lignes, hiérarchie dépliable, navigation temporelle et lecture synchronisée avec une application.

## État du projet

**18 octobre 2026 — Définition et brainstorming en cours.**

Le dépôt contient la synthèse des besoins et les pistes de conception. La vision fonctionnelle décrite est retenue comme base pour la V1 et a fait l'objet d'une revue extérieure par un sous-agent Astra. Les règles détaillées, l'API et le plan de réalisation restent à formaliser. Aucune fonctionnalité n'est encore implémentée et aucun package npm n'est publié.

## Premiers usages

- **Rejouer une journée d'opérations** : parcourir des communications de capteurs et piloter les autres éléments d'une application à partir du temps de lecture.
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

La séparation d'un moteur temporel indépendant de React et de la vue React est proposée ; le détail de cette architecture reste à valider.

## Documents de conception

- [Définition et statut du brainstorming](docs/DEFINITION.md) : besoins confirmés, propositions et limites de responsabilité.
- [Architecture proposée](docs/ARCHITECTURE.md) : séparation du moteur, de la vue React et des aides facultatives.
- [Questions ouvertes](docs/QUESTIONS-OUVERTES.md) : décisions restantes, par priorité.
- [Revue extérieure Astra](docs/REVUE-V1.md) : regard critique, recommandations et réponses de l'utilisateur.
- [Jeu de référence proposé](docs/JEU-REFERENCE.md) : volumes et scénarios pour mesurer la future implémentation.

Le cas opérationnel peut produire des centaines de communications par seconde avant regroupement. Le volume réellement transmis et affiché reste à préciser, ainsi que le modèle temporel, les comportements de lecture et le périmètre de la première version.

## Publication

Le nom du package npm, sa disponibilité, la licence, les versions de React prises en charge et l'outillage de distribution restent à choisir. Ce dépôt sera la racine du projet destiné à être public ; les documents de méthode et l'historique de travail sont conservés dans un espace local séparé.
