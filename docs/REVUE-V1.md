# Revue extérieure de la vision V1

Date : 18 octobre 2026.
Relecteur : sous-agent Astra (`gpt-6-astra`), sollicité explicitement par l'utilisateur.

Cette synthèse restitue une revue indépendante de la définition, de l'architecture et des questions ouvertes. Le relecteur disposait des choix confirmés, mais pas de l'historique complet de la conversation. Aucun code n'a été créé ou modifié pendant la revue.

Les recommandations ci-dessous préparent la conception ; elles ne constituent pas une API ni un plan d'implémentation validés.

## Avis général

La vision est cohérente et peut servir de base V1. La séparation entre navigation temporelle, affichage React et logique métier est pertinente. La V1 est ambitieuse pour une première bibliothèque : la difficulté principale sera la cohérence des interactions et des mises à jour.

La recommandation est de conserver les fonctions retenues en limitant leurs variantes, plutôt que d'élargir le projet.

## Observations prioritaires

### 1. Stabiliser la base fonctionnelle

La vision acceptée doit être distinguée des détails encore à concevoir. Il n'est plus nécessaire de rediscuter l'existence des clés, de la boucle ou la responsabilité du regroupement.

Le statut des documents a été corrigé en conséquence. Un découpage logique du moteur et de React, dans un package initial unique, reste conseillé. Un rewind borné vers une cible et des aides de détail simples éviteraient de créer un système général de lecture inversée ou un grand catalogue de composants.

### 2. Définir un contrat temporel unique

Une notification de temps ne garantit pas l'exécution de chaque communication traversée. Lecture accélérée, saut, rewind et boucle doivent être identifiables par l'application, qui reste responsable de la reconstruction de son état et des actions métier.

Une seule autorité temporelle, commandée par l'interface et l'application, est recommandée. L'utilisateur a précisé après la revue que la lecture doit attendre lorsqu'une mise à jour de l'application n'est pas prête.

### 3. Mesurer les données réellement affichées

Le débit source de centaines de communications par seconde ne définit pas une charge de rendu. Les lignes, éléments transmis et éléments visibles après regroupement doivent être mesurés séparément.

L'utilisateur délègue la proposition d'un jeu de référence. Le [jeu proposé](JEU-REFERENCE.md) sert à mesurer les stratégies de rendu ; il ne représente pas une performance garantie.

### 4. Distinguer période complète, fenêtre et données chargées

Le regroupement externe au zoom nécessite potentiellement de remplacer les données pendant l'utilisation. Cette mise à jour doit préserver l'état pertinent de la timeline.

L'utilisateur confirme le chargement par fenêtre dès la V1. La période complète doit rester indépendante du lot chargé, afin qu'un zoom ne change pas implicitement la boucle ou le retour au début. Des identifiants stables et une gestion des réponses obsolètes sont recommandés.

### 5. Préciser les lignes parentes

Qui prépare les marqueurs d'une ligne parente repliée doit être explicite. Une synthèse automatique pourrait réintroduire du regroupement dans la librairie malgré le choix de le laisser à l'application.

Proposition : permettre à l'application de fournir les éléments de chaque ligne, y compris ceux des parents. Replier masque les descendants et conserve la représentation fournie au parent. La règle exacte reste à intégrer à la conception. Une portée globale des clés constitue aussi un premier comportement simple à proposer.

### 6. Partager les calculs, spécialiser les graduations

Calendrier et relatif peuvent partager les calculs de position et de lecture, avec des règles de graduation et de libellé adaptées à chaque mode. Une représentation numérique commune et un seul mode par instance sont recommandés. La conversion automatique entre modes peut être reportée.

Les commandes au clavier, les préférences de réduction des animations et un essai du package installé dans une application distincte sont recommandés parmi les critères de livraison.

## Réponses de l'utilisateur après la revue

| Sujet | Réponse |
| --- | --- |
| Jeu de référence après regroupement | L'assistant peut le proposer |
| Données fournies par fenêtre et remplacées au zoom ou au déplacement | Oui, dès la V1 |
| Application temporairement non prête | La lecture attend qu'elle soit prête |

Ces réponses sont intégrées à la définition. Elles lèvent les trois questions de produit prioritaires soulevées par la revue.

## Complément : attente de l'application

Un second avis ciblé du même relecteur propose le contrat suivant, à formaliser dans la conception :

1. Le moteur demande une position cible avec une cause et un identifiant de demande. L'application prépare son état pour cette position.
2. Pendant cette préparation, la position confirmée reste stable. Une cible en attente peut être indiquée séparément.
3. L'application confirme la demande valide. Le moteur valide la position puis poursuit si l'intention de lecture est toujours active.
4. L'attente ne consomme pas de temps de lecture et n'entraîne pas de rattrapage automatique du temps réel écoulé.
5. Une nouvelle destination invalide la demande précédente. Une réponse dépassée ne peut ni déplacer le curseur ni remplacer l'état métier courant ; l'application doit elle aussi vérifier la validité de ses résultats.
6. Pause désactive l'intention de lecture ; une préparation engagée peut se terminer, mais elle ne déclenche pas de reprise automatique. Lecture, Stop et changement de vitesse doivent avoir des transitions définies pendant l'attente.
7. En cas d'échec, conserver la position confirmée, exposer l'erreur et permettre une nouvelle demande ou un nouvel essai.

Les demandes de données liées à une fenêtre ont leur propre validité. Elles ne bloquent la lecture que lorsque l'application en a besoin pour préparer la position demandée.

Ce mécanisme prépare des positions temporelles ; il ne transforme pas la timeline en moteur d'exécution de toutes les communications. La forme de l'API et la fréquence des préparations restent à concevoir. Le relecteur ne voit pas de nouvelle question utilisateur indispensable pour proposer ces règles.

## Suite proposée

Rédiger la conception V1 à partir des besoins confirmés et de ces recommandations, expliciter les comportements choisis, puis établir le plan de réalisation. Les adaptateurs pour d'autres frameworks, la boucle sur sous-période, l'édition des clés et un système de plugins ne font pas partie de cette base.
