# Time Weave

Projet de bibliothèque TypeScript et React pour créer des timelines interactives : plusieurs lignes, hiérarchie dépliable, navigation temporelle et lecture synchronisée avec une application.

## État du projet

**18 octobre 2026 — Définition et brainstorming en cours.**

Le dépôt contient la synthèse des besoins et les pistes de conception. Aucune fonctionnalité n'est encore implémentée, aucun package npm n'est publié et le périmètre de la première version n'est pas arrêté. Les fonctionnalités décrites sont des objectifs de conception, pas des fonctionnalités déjà disponibles.

## Premiers usages

- **Rejouer une journée d'opérations** : parcourir des communications de capteurs et piloter les autres éléments d'une application à partir du temps de lecture.
- **Présenter l'histoire d'une entreprise** : explorer des événements et des périodes sur plusieurs années ou décennies.

## Directions retenues

- Interface React dès la première version, avec du code TypeScript.
- Échelles allant de la milliseconde aux décennies.
- Zoom et déplacement libres, avec des limites configurables.
- Lignes dépliables sur plusieurs niveaux.
- Lecture, pause, arrêt, changement de vitesse et navigation par points d'intérêt parmi les besoins exprimés.
- Actions au clic personnalisables par l'application.
- Regroupement des communications géré par l'application consommatrice ; la timeline affiche les éléments individuels ou groupés qu'elle reçoit.

La séparation d'un moteur temporel indépendant de React et de la vue React est proposée ; le détail de cette architecture reste à valider.

## Documents de conception

- [Définition et statut du brainstorming](docs/DEFINITION.md) : besoins confirmés, propositions et limites de responsabilité.
- [Architecture proposée](docs/ARCHITECTURE.md) : séparation du moteur, de la vue React et des aides facultatives.
- [Questions ouvertes](docs/QUESTIONS-OUVERTES.md) : décisions restantes, par priorité.

Le cas opérationnel peut produire des centaines de communications par seconde avant regroupement. Le volume réellement transmis et affiché reste à préciser, ainsi que le modèle temporel, les comportements de lecture et le périmètre de la première version.

## Publication

Le nom du package npm, sa disponibilité, la licence, les versions de React prises en charge et l'outillage de distribution restent à choisir. Ce dépôt sera la racine du projet destiné à être public ; les documents de méthode et l'historique de travail sont conservés dans un espace local séparé.
