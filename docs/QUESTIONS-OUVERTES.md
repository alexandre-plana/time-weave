# Questions ouvertes

Dernière mise à jour : 18 octobre 2026.

Cette liste rassemble les décisions restantes. Elle distingue les besoins à préciser des sujets ajoutés par l'assistant pour préparer une bibliothèque utilisable et publiable. Elle ne constitue ni un engagement de fonctionnalités ni un plan d'implémentation validé.

## À trancher avant le premier plan de réalisation

### 1. Volumétrie de référence

Point clarifié : le flux source peut atteindre des centaines de communications par seconde. L'application consommatrice gère le regroupement.

- Combien de lignes sont présentes et dépliées simultanément ?
- Quel volume après regroupement doit être transmis à la timeline, et quelle densité doit être visible ?
- Quels objectifs simples de fluidité et de temps de chargement vérifier sur un jeu représentatif ?

### 2. Périmètre de la première version

- Quel cas de référence sert à la première démonstration ?
- Quelles fonctions entrent dans cette version, et lesquelles sont reportées ?
- Quelle place donner immédiatement au rewind, aux points d'intérêt, à l'affichage de groupes fournis et aux aides de détail ?

### 3. Contrat temporel et synchronisation

Décision prise : les dates de calendrier et le temps relatif à un départ sont tous deux pris en charge dans les besoins.

Décision prise : le pilotage temporel fonctionne dans les deux sens, de la timeline vers l'application et de l'application vers la timeline.

- Quel format de temps accepte l'API et comment distinguer instants et durées ?
- Quelles règles de graduation et de libellés pour chacun des deux modes ?
- Faut-il permettre de convertir entre les modes à partir d'une origine datée ?
- Quelle convention de fuseau horaire, de localisation et de changement d'heure ?
- Quels signaux transmettre à l'application pendant la lecture et lors d'un saut ?
- Quelle API de contrôle externe proposer, et comment synchroniser les commandes de la timeline et celles de l'application ?
- Comment distinguer restitution d'un état à une date et exécution d'actions ponctuelles ?
- Que se passe-t-il à la fin, pendant un arrêt, après un rewind et lors d'un changement de vitesse ?
- Valider ou modifier les comportements de pause, stop et fin de période proposés dans la définition.
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

- Les données sont-elles uniquement chargées au départ, ou modifiables ensuite ?
- Faut-il charger par fenêtre temporelle ?
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

Préciser le volume à afficher après regroupement, puis arrêter un petit périmètre initial et les règles essentielles de temps et de lecture. Ces réponses permettront d'écrire la conception et le plan de réalisation sans choisir prématurément une technique de rendu.
