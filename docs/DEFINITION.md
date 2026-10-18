# Définition et statut du brainstorming

Dernière mise à jour : 18 octobre 2026.

## Statut

Le projet est en phase de définition. Le choix de React est arrêté ; le périmètre de la première version et la conception détaillée ne le sont pas. Aucun code produit n'est encore implémenté.

Les mentions ci-dessous distinguent les besoins exprimés, les décisions prises et les recommandations encore à discuter. Un besoin confirmé n'est pas automatiquement un engagement pour la première version.

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
- Permettre le zoom et le déplacement libres, avec des limites configurables par le développeur.
- Disposer d'une position temporelle courante pour synchroniser l'application.
- Proposer lecture automatique, pause, arrêt et changement de vitesse.
- Naviguer par points d'intérêt.
- Rejoindre immédiatement un instant choisi et permettre un rewind optionnel jusqu'à une cible passée.

Les règles de fin de lecture, d'arrêt, de reprise et de navigation restent ouvertes.

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

Lorsqu'un type est replié, sa ligne doit représenter les communications de ses connecteurs par des marqueurs. La règle exacte pour les autres niveaux parents reste à préciser.

### Densité et regroupement

Les communications peuvent être très denses. Un moyen de regroupement est donc nécessaire. Le développeur doit conserver la liberté d'appliquer ses propres règles.

La répartition des responsabilités reste à décider. La proposition de l'assistant distingue :

- Le regroupement métier, défini par l'application : sessions, incidents ou catégories, par exemple.
- Le regroupement visuel facultatif, fourni par la librairie selon la proximité des marqueurs et le zoom.

Cette approche mixte n'est pas encore validée. Préserver les événements sources pendant le regroupement visuel est une recommandation de conception.

### Interactions

L'application choisit librement l'action déclenchée par un clic sur un élément ou un groupe.

Une infobulle au survol et une modale au clic ont été proposées par l'utilisateur comme aides facultatives prêtes à l'emploi. Leur contenu, leur personnalisation et leur activation initiale restent à définir.

La distinction entre un clic sur un élément et un clic sur le fond temporel est une proposition de l'assistant à préciser.

## Décisions et propositions techniques

| Sujet | État |
| --- | --- |
| TypeScript | Langage demandé |
| React | Retenu pour l'interface dès la première version |
| Séparation architecturale | Souhait exprimé ; découpage détaillé proposé dans `ARCHITECTURE.md` |
| Vue indépendante des frameworks | Écartée de la direction initiale au profit d'une première vue React |
| Moteur temporel indépendant de React | Recommandation de l'assistant, à confirmer dans la conception |
| Technique de rendu, dépendances et API | À définir |
| Périmètre de la première version | À définir |
| Licence et publication npm | À définir |

## Responsabilités envisagées

La timeline expose et contrôle le temps, affiche les données temporelles et permet les interactions.

L'application consommatrice fournit les données, leur sens métier et les actions personnalisées. La restitution de ses propres états à un instant donné lui revient dans le découpage proposé. Le protocole précis de synchronisation reste à définir, en particulier pour distinguer un saut direct d'un parcours continu des événements.

L'ingestion des capteurs et le rendu de l'application complète ne font pas partie des fonctionnalités demandées à la timeline.

## Volumétrie

L'estimation actuelle est « potentiellement des centaines ». L'unité reste inconnue : connecteurs, communications sur une journée ou communications par seconde. Aucun objectif de performance n'est donc encore fixé.

## Suite

Clarifier les [questions ouvertes](QUESTIONS-OUVERTES.md), arrêter le périmètre initial, puis produire une conception et un plan de réalisation. Aucun outil de construction ni squelette de package n'a encore été choisi.
