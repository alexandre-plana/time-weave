# Architecture proposée

Date : 18 octobre 2026.
Statut : React est retenu ; le découpage détaillé ci-dessous est une proposition à valider.

## Objectif

Utiliser React pour construire l'interface, tout en séparant les règles temporelles et le modèle de données de leur affichage. Cette séparation vise à faciliter les tests, la maintenance et une éventuelle autre vue ultérieure.

Une première vue indépendante des frameworks avec adaptateur React a été envisagée. Le choix de React dès le départ remplace cette piste. Un moteur indépendant ne fournit pas automatiquement une autre vue : la première timeline visuelle nécessitera React.

## Responsabilités proposées

### Moteur TypeScript

- Modèle générique d'événements, de périodes, de lignes hiérarchiques et de clés définies comme des repères temporels par l'utilisateur.
- État temporel et règles de lecture : position, vitesse, pause, navigation clé suivante/précédente et boucle. Les modalités de définition des clés et les bornes de boucle restent ouvertes.
- Calculs de temps, de fenêtre visible et de limites.
- Prise en charge des deux modes confirmés : calendrier et relatif, avec une représentation interne à définir.
- Interface permettant à la vue et à l'application d'observer et de contrôler cet état.

Le pilotage par l'application et la transmission du temps courant vers elle sont des besoins confirmés. Utiliser les mêmes transitions temporelles pour les commandes internes et externes est une proposition pour maintenir un état cohérent ; la forme de l'API reste ouverte.

Le moteur serait indépendant de React et du DOM. L'avancement dépendant de l'horloge du navigateur serait raccordé par l'intégration, avec une source de temps contrôlable pour vérifier les règles de lecture.

Le moteur doit rester générique : les notions de connecteur, de capteur ou d'entreprise appartiennent aux données de l'application.

### Vue et intégration React

- Création, connexion et cycle de vie du moteur.
- Affichage de l'axe, des lignes, des événements et du curseur.
- Dépliage, zoom, déplacement et interactions au pointeur ou au clavier.
- Zones de contenu personnalisables avec React.
- Transmission des actions et changements de temps à l'application.
- Affichage des éléments individuels ou groupés fournis par l'application, sans calcul de regroupement automatique retenu à ce stade.

Le niveau exact de personnalisation reste ouvert. La répartition entre rendu HTML, SVG et Canvas doit être évaluée selon les volumes et les interactions attendues ; React ne détermine pas à lui seul cette répartition.

### Aides React facultatives

- Commandes de lecture.
- Infobulles.
- Fenêtres de détail.

Ces composants seraient utilisables ou remplaçables selon les besoins de l'application. Leur comportement par défaut et leur distribution ne sont pas définis.

### Application consommatrice

- Fournir les données et leurs métadonnées.
- Définir les actions métier.
- Actualiser ses graphiques, cartes ou autres éléments à l'instant choisi.
- Préparer les regroupements nécessaires, selon ses règles métier ou la densité visuelle souhaitée.

La façon de reconstruire un état à un instant donné reste propre à l'application dans ce découpage. Le contrat de synchronisation doit expliciter le comportement lors d'un saut, d'une lecture et d'un rewind.

Le cas de référence peut atteindre des centaines de communications par seconde en entrée de l'application. La timeline recevrait les éléments choisis par cette application. Exposer la fenêtre visible et ses changements est une proposition pour permettre l'adaptation des groupes au zoom ; le format de ces échanges reste à définir. Les optimisations de rendu des éléments visibles relèvent de l'affichage et ne changent pas la décision de laisser le regroupement à l'application.

## Sens des dépendances

La vue React et les aides d'interface s'appuient sur le moteur. Le moteur ne dépend pas de l'interface. L'application relie la timeline à ses propres données et composants.

Cette séparation est logique avant d'être une séparation de packages. Un seul dépôt et un seul package au départ sont recommandés pour limiter le travail de publication.

## Points à valider avant implémentation

- Frontières exactes entre le moteur, les calculs de placement et l'état d'interface.
- API d'observation et de contrôle, gestion des mises à jour et nettoyage.
- Personnalisation des lignes, marqueurs, groupes et détails.
- Traitement des données denses et des lignes hors écran.
- Intégration aux applications React qui rendent aussi côté serveur, si elle fait partie du périmètre.
- Structure du package, points d'entrée et distribution des styles.

## Sources consultées pendant la comparaison

- [React — Hooks](https://react.dev/reference/react/hooks) : état, contexte et synchronisation avec des systèmes externes.
- [React — Portails](https://react.dev/reference/react-dom/createPortal) : contenu React dans des conteneurs distincts.
- [TypeScript — Publication des types](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html) : distribution des déclarations avec un package.

L'architecture décrite est une proposition propre au projet ; ces sources documentent les mécanismes techniques discutés.
