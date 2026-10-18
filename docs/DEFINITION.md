# Définition et statut du brainstorming

Dernière mise à jour : 18 octobre 2026.

## Statut

Le projet est en phase de définition. React est retenu et l'utilisateur accepte la vision fonctionnelle décrite comme base pour la V1. Une [revue extérieure Astra](REVUE-V1.md) a été réalisée pour préparer la conception détaillée et le plan. Aucun code produit n'est encore implémenté.

Les mentions ci-dessous distinguent les besoins exprimés, les décisions prises et les recommandations encore à discuter. Les options, comportements détaillés et éventuels reports proposés lors de la revue devront être formalisés ; l'acceptation de la vision ne fixe pas encore chaque règle d'API ou d'interface.

## Intention

Fournir une bibliothèque TypeScript permettant à une application React de présenter et de parcourir des informations dans le temps. La timeline peut aussi servir de commande temporelle pour synchroniser d'autres éléments de l'application.

Le projet est développé progressivement, avec un accompagnement sur la conception, l'API et la publication d'une première librairie.

## Cas de référence

### Rejeu d'une journée d'opérations

Une application ingère des données de capteurs et permet de rejouer une journée a posteriori. Le curseur avance pendant la lecture et contrôle les autres éléments de l'application.

Lors d'un saut vers un instant passé, les éléments pilotés doivent retrouver l'état correspondant à cet instant. Un retour animé, ou rewind, jusqu'au point cliqué est souhaité en option.

Les éléments pilotés ne sont pas encore définis. Graphiques, valeurs et cartes ont été évoqués par l'assistant comme illustrations possibles, sans être des composants demandés à la librairie.

### Histoire d'une entreprise

Présenter l'histoire d'une entreprise sur plusieurs années ou décennies, avec des événements et des périodes répartis sur plusieurs lignes.

La référence visuelle initiale associe un axe horizontal à des lignes d'entreprises, de projets, de compétences et d'explorations. Elle illustre un type de rendu souhaité ; elle ne définit pas à elle seule les interactions du futur composant.

## Besoins confirmés ou explicitement exprimés

### Temps et navigation

- Couvrir des échelles de la milliseconde aux années et aux décennies.
- Prendre en charge les dates de calendrier et le temps relatif à un point de départ, sans date obligatoire.
- Permettre le zoom et le déplacement libres, avec des limites configurables par le développeur.
- Disposer d'une position temporelle courante pour synchroniser l'application.
- Permettre aussi à l'application de piloter la timeline, notamment de déplacer le curseur et de lancer la lecture depuis ses propres commandes.
- Attendre que l'application soit prête avant de poursuivre la lecture lorsqu'elle doit reconstruire ou mettre à jour ses éléments synchronisés. Le contrat précis de disponibilité reste à formaliser.
- Proposer lecture automatique, pause, arrêt, vitesse réglable et lecture en boucle sur la période complète.
- Naviguer entre des clés, fournies dans les données comme des repères temporels, avec des commandes « clé suivante » et « clé précédente ».
- Rejoindre immédiatement un instant choisi et permettre un rewind optionnel jusqu'à une cible passée.

La vitesse réglable, les commandes clé suivante/précédente et la boucle sont explicitement demandées. La boucle porte sur la période complète de la timeline ; la boucle sur une sous-période est reportée pour le moment. Le zoom ne définit pas une nouvelle plage de boucle. Les vitesses proposées, le format des clés et les règles détaillées de fin de lecture, d'arrêt, de reprise et de navigation restent ouverts.

Proposition de comportements par défaut par l'assistant, à valider :

- **Pause** : interrompre la lecture en conservant la position.
- **Stop** : interrompre la lecture et revenir au début de la période de lecture configurée, indépendamment du zoom.
- **Fin de période sans boucle** : terminer la lecture en conservant le curseur à la fin, sans reprise automatique.
- **Boucle activée** : revenir au début de la période complète et continuer la lecture. La portée de la boucle est confirmée ; les règles détaillées de transition restent à préciser.

Définition confirmée par l'utilisateur : une clé est un repère temporel qu'il définit et fournit dans les données. Les commandes précédente/suivante servent à naviguer entre ces repères. Une interface de création ou d'édition de clés dans la timeline ne fait pas partie du besoin retenu. Le format des données, le comportement aux bornes, en cours de lecture et en présence de plusieurs clés au même instant restent à définir.

Deux modes temporels sont confirmés :

- **Calendrier** : des instants datés, pour une journée d'opérations ou l'histoire d'une entreprise.
- **Relatif** : des positions mesurées depuis une origine choisie, par exemple `0 ms`, `250 ms`, puis `1 s`, sans date de calendrier.

Le format accepté par l'API, les règles de libellés et de graduation et la possibilité éventuelle de convertir entre les deux modes restent à définir. Cette décision n'impose pas de les afficher simultanément sur une même timeline.

### Hiérarchie de lignes

Le dépliage doit révéler plusieurs niveaux de sous-ensembles. Exemple de référence :

```text
Connecteurs
  Type A
    Connecteur A1 → communications dans le temps
    Connecteur A2 → communications dans le temps
  Type B
    Connecteur B1 → communications dans le temps
```

Les noms sont illustratifs. Les communications sont le contenu temporel des lignes individuelles, pas un niveau supplémentaire de sous-lignes imposé.

Lorsqu'un type est replié, sa ligne doit représenter les communications de ses connecteurs par des marqueurs, ou les groupes préparés par l'application. La règle exacte de représentation pour les autres niveaux parents reste à préciser.

### Densité et regroupement

Le flux source peut atteindre des centaines de communications par seconde.

Décision de l'utilisateur : le regroupement incombe au développeur qui utilise la librairie. L'application prépare les communications individuelles ou groupées à afficher et choisit ses règles, qu'elles soient métier ou adaptées à la densité visuelle. Aucun regroupement automatique interne n'est retenu à ce stade ; cette décision remplace la proposition mixte antérieure de l'assistant.

La timeline affiche les éléments fournis et relaie les interactions personnalisées. Le format des groupes et de leurs métadonnées reste à définir. La correspondance avec les communications sources et leur utilisation pour reconstruire un état métier relèvent de l'application.

Besoin confirmé après la revue : dès la V1, l'application peut fournir seulement les données de la fenêtre temporelle visible et les remplacer au zoom ou au déplacement. Le chargement et le regroupement restent externes à la librairie. Le contrat de notification de fenêtre et de remplacement des données reste à formaliser.

Proposition de conception : conserver la période complète indépendamment des données actuellement chargées et préserver le curseur, l'état de lecture et le dépliage lors d'un remplacement. Limiter le rendu aux éléments visibles est une optimisation d'affichage distincte du regroupement.

### Interactions

L'application choisit librement l'action déclenchée par un clic sur un élément ou un groupe.

Une infobulle au survol et une modale au clic ont été proposées par l'utilisateur comme aides facultatives prêtes à l'emploi. Leur contenu, leur personnalisation et leur activation initiale restent à définir.

La distinction entre un clic sur un élément et un clic sur le fond temporel est une proposition de l'assistant à préciser.

## Décisions et propositions techniques

| Sujet | État |
| --- | --- |
| TypeScript | Langage demandé |
| React | Retenu pour l'interface dès la première version |
| Regroupement des communications | Géré par l'application consommatrice |
| Séparation architecturale | Souhait exprimé ; découpage détaillé proposé dans `ARCHITECTURE.md` |
| Vue indépendante des frameworks | Écartée de la direction initiale au profit d'une première vue React |
| Moteur temporel indépendant de React | Recommandation de l'assistant, à confirmer dans la conception |
| Technique de rendu, dépendances et API | À définir |
| Vision fonctionnelle de la première version | Acceptée comme base ; critères et règles détaillés à formaliser |
| Données par fenêtre temporelle | Retenues dès la V1, chargement par l'application |
| Disponibilité de l'application | La lecture doit attendre lorsqu'une mise à jour n'est pas prête |
| Licence et publication npm | À définir |

## Responsabilités envisagées

La timeline expose et contrôle le temps, affiche les données temporelles et permet les interactions.

Le pilotage temporel est confirmé dans les deux sens : la timeline communique le temps courant à l'application, et l'application peut commander la timeline. Cette décision porte sur la capacité de contrôle ; elle ne fixe pas le choix entre propriétés React, hooks, références ou contrôleur externe.

L'application consommatrice fournit les données, les regroupements, leur sens métier et les actions personnalisées. La restitution de ses propres états à un instant donné lui revient dans le découpage proposé. Le protocole précis de synchronisation reste à définir, en particulier pour distinguer un saut direct d'un parcours continu des événements.

L'ingestion des capteurs et le rendu de l'application complète ne font pas partie des fonctionnalités demandées à la timeline.

## Volumétrie

Le cas de référence peut produire des centaines de communications par seconde avant regroupement. Ce débit source n'est pas une exigence de rendu individuel de tous les événements de la journée. L'utilisateur délègue à l'assistant la proposition d'un [jeu de référence après regroupement](JEU-REFERENCE.md) pour évaluer le rendu. Ce jeu constitue une cible de mesure, sans garantie de performance annoncée avant validation.

## Suite

Formaliser les contrats identifiés par la revue et les réponses aux [questions ouvertes](QUESTIONS-OUVERTES.md), puis produire une conception et un plan de réalisation. Aucun outil de construction ni squelette de package n'a encore été choisi.
