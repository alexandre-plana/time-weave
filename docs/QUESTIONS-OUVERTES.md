# Questions ouvertes

Dernière mise à jour : 31 octobre 2026.

**31 octobre 2026** : la V1 est implémentée. Les choix techniques laissés au plan (outillage, versions) sont fixés dans le [plan de réalisation](PLAN-REALISATION.md). Les comportements que l'implémentation a dû trancher sans décision explicite sont listés dans la section « Choix d'implémentation à valider » du [guide](GUIDE.md). Restent ouverts avant publication : nom npm, licence, versions de React prises en charge et mesures sur un poste réel.

Cette liste rassemble les décisions restantes. Elle distingue les besoins à préciser des sujets ajoutés par l'assistant pour préparer une bibliothèque utilisable et publiable. Elle ne constitue ni un engagement de fonctionnalités ni un plan d'implémentation validé.

Les trois questions de produit prioritaires de la revue Astra ont reçu une réponse. Les points restants servent à préparer une proposition de conception ; ils ne constituent pas tous des questions à soumettre à l'utilisateur.

Depuis, la [conception V1](CONCEPTION-V1.md) répond aux sujets ci-dessous, a été relue par Astra et a été validée par l'utilisateur le 18 octobre 2026. Cet inventaire conserve la trace du cadrage : il ne constitue plus une liste de questions bloquant la rédaction du plan. Outils, versions, licence et publication seront réglés aux étapes correspondantes.

Ajout confirmé pendant cette formalisation : collections dynamiques et suivi du Direct activable. Une relecture Astra ciblée a identifié puis vérifié la correction d'un risque d'annulations perpétuelles des chargements. Les règles correspondantes sont incluses dans la conception validée.

## À formaliser pour le premier plan de réalisation

### 1. Volumétrie de référence

Points clarifiés : le flux source peut atteindre des centaines de communications par seconde. L'application consommatrice gère le regroupement. L'utilisateur délègue à l'assistant la proposition d'un [jeu de référence](JEU-REFERENCE.md) pour les mesures après regroupement.

Une première référence de lignes, d'éléments transmis et d'éléments visibles est proposée dans le jeu lié ci-dessus. Les objectifs de fluidité et de temps de mise à jour restent à déterminer à partir de mesures sur un environnement documenté.

### 2. Périmètre de la première version

La vision fonctionnelle discutée est acceptée par l'utilisateur comme base V1. La [revue extérieure Astra](REVUE-V1.md) a été réalisée ; les simplifications qu'elle recommande restent des propositions de conception.

- Quel cas de référence sert à la première démonstration ?
- Comment traduire cette vision en critères de réalisation vérifiables ?
- Quels ajustements de périmètre la revue recommande-t-elle, et lesquels seront retenus ?

### 3. Contrat temporel et synchronisation

Décision prise : les dates de calendrier et le temps relatif à un départ sont tous deux pris en charge dans les besoins.

Décision prise : le pilotage temporel fonctionne dans les deux sens, de la timeline vers l'application et de l'application vers la timeline.

Définition confirmée : une clé est un repère temporel défini par l'utilisateur et fourni dans les données. Aucune interface de création ou d'édition de clés n'est demandée.

Décision prise : la boucle porte sur la période complète de la timeline. La boucle sur une sous-période est reportée pour le moment.

Décision prise après la revue : la lecture doit attendre que l'application soit prête lorsque les éléments synchronisés mettent du temps à se mettre à jour.

- Quel format de temps accepte l'API et comment distinguer instants et durées ?
- Quelles règles de graduation et de libellés pour chacun des deux modes ?
- Faut-il permettre de convertir entre les modes à partir d'une origine datée ?
- Quelle convention de fuseau horaire, de localisation et de changement d'heure ?
- Quels signaux transmettre à l'application pendant la lecture et lors d'un saut ?
- Quelle API de contrôle externe proposer, et comment synchroniser les commandes de la timeline et celles de l'application ?
- Comment signaler la disponibilité de l'application, distinguer attente et pause manuelle, et invalider une mise à jour dépassée par une nouvelle commande ?
- Comment distinguer restitution d'un état à une date et exécution d'actions ponctuelles ?
- Que se passe-t-il à la fin, pendant un arrêt, après un rewind et lors d'un changement de vitesse ?
- Valider ou modifier les comportements de pause, stop et fin de période avec ou sans boucle proposés dans la définition.
- Quelles vitesses proposer et comment les configurer ?
- Quel format de données prévoir pour les clés et leurs éventuelles métadonnées ?
- Quelles clés prendre en compte selon les lignes, et quel comportement aux bornes ou en cas de clés simultanées ?
- Comment le curseur et la fenêtre visible se comportent-ils lorsque le temps courant sort de l'écran ?

### 4. Modèle de données

- Quels champs minimaux pour une ligne, un événement, une période et un point d'intérêt ?
- Comment identifier les objets et transporter leurs métadonnées métier ?
- Une communication est-elle un instant, une période, ou les deux selon les données ?
- Comment traiter les événements simultanés, les chevauchements et les bornes des périodes ?
- Quelle règle applique une ligne parente repliée à chacun des niveaux de la hiérarchie ?
- Quels contrôles appliquer aux identifiants, aux périodes invalides ou aux hiérarchies cycliques ?

## À préciser pendant la conception de l'interface et de l'API

### 5. Personnalisation

- Quelles zones peuvent recevoir un composant React personnalisé ?
- Quel contrôle offrir sur les couleurs, tailles, icônes, libellés et styles ?
- Comment exposer les éléments ou les membres d'un groupe aux actions personnalisées ?
- Comment activer, remplacer ou désactiver les infobulles et modales proposées ?
- Comment distinguer le clic d'action et le clic de navigation temporelle ?

### 6. Regroupement et rendu

Décision prise : l'application consommatrice calcule les regroupements. La proposition de regroupement mixte antérieure n'est pas retenue.

- Quel format permet de fournir des éléments groupés et leurs métadonnées à la vue ?
- Quels changements de fenêtre ou de zoom exposer pour permettre à l'application d'adapter ses groupes ?
- Que montrent les groupes au survol selon le contenu fourni par l'application ?
- Quelle technique de rendu est adaptée au jeu de données de référence ?
- Faut-il rendre uniquement les lignes et événements visibles ?

### 7. Mise à jour des données

Décision prise : l'application peut fournir seulement les données de la fenêtre visible et les remplacer au zoom ou au déplacement, dès la V1.

Décisions complémentaires : les collections peuvent recevoir des ajouts, modifications et suppressions ; un mode Direct activable suit les dernières données et peut être quitté pour l'historique. La source du flux et sa politique de rétention appartiennent à l'application.

- Quel contrat de demande de fenêtre et de remplacement des données proposer ?
- Comment conserver l'état d'interface et distinguer la période complète du lot actuellement chargé ?
- Quels comportements pendant un chargement, une absence de données ou une modification en cours de lecture ?
- Le temps courant et l'état des lignes sont-ils gérés par la librairie, contrôlés par l'application, ou les deux selon l'intégration ?

### 8. Navigation et accessibilité

- Quels gestes de zoom, déplacement, sélection et déplacement du curseur ?
- Quels équivalents au clavier et sur écran tactile ?
- Comment exposer la hiérarchie et les événements aux technologies d'assistance ?
- Comment gérer le focus dans les aides de détail et adapter les animations aux préférences de l'utilisateur ?

## À fixer pour préparer la publication

### 9. Compatibilité et distribution

- Quelles versions de React et quels navigateurs prendre en charge ?
- Les applications avec rendu côté serveur font-elles partie de la première cible ?
- Quels points d'entrée, fichiers de types et styles distribuer ?
- Un package unique suffit-il pour la première version ?
- Comment vérifier le package installé dans une application consommatrice distincte ?

### 10. Projet et maintenance

- Quel nom npm disponible et quelle licence ?
- Quel outillage de compilation et de validation ?
- Quelles règles de version, de compatibilité et de documentation de l'API publique ?
- Quelles démonstrations et quels exemples fournir ?
- Quelles vérifications automatiser avant une version ?

## Prochaine étape proposée

Écrire le plan de réalisation lors de la reprise. Les mesures sur le jeu de référence permettront ensuite de vérifier les choix de rendu.
