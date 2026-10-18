# Jeu de référence proposé

Date : 18 octobre 2026.
Statut : proposition de l'assistant et du relecteur Astra, à matérialiser pendant la réalisation. L'utilisateur a délégué le choix d'une première référence de mesure.

Ce document ne rapporte aucun test exécuté. Il décrit un jeu après regroupement destiné à mesurer la future implémentation. Aucun débit ni nombre d'images par seconde n'est garanti à ce stade.

## Structure

| Mesure | Référence proposée |
| --- | --- |
| Lignes totales | 211 : une racine, 10 types, 200 connecteurs |
| Répartition | 20 connecteurs par type |
| Arbre aplati au départ | 51 lignes : racine ouverte, 10 types visibles, 2 types ouverts révélant 40 connecteurs |
| Lignes dans la hauteur d'écran | Environ 25, selon la taille de la vue |
| Éléments transmis pour une fenêtre avec marge | 5 000 au total, y compris les représentations de parents fournies par l'application |
| Éléments dans la fenêtre temporelle visible | Environ 2 000 sur les lignes disponibles |
| Éléments visibles à la fois horizontalement et verticalement | Environ 1 000 |

Ces nombres décrivent des charges distinctes et ne s'additionnent pas. Les groupes de parents sont fournis par l'application ; la librairie ne reconstruit pas un regroupement des descendants.

## Contenu

- Instants, périodes et groupes déjà préparés par l'application.
- Répartition irrégulière, avec quelques zones très denses et des chevauchements.
- Clés temporelles fournies dans les données.
- Identifiants stables permettant le remplacement d'une fenêtre de données.
- Une période complète explicitement déclarée, indépendante de la fenêtre et du lot chargé ; fixe pour le cas de rejeu initial, extensible pour le scénario de Direct.

Le débit brut des capteurs n'est pas simulé comme une obligation d'afficher chaque communication. Les mêmes volumes affichés peuvent représenter un historique beaucoup plus dense regroupé par l'application.

## Scénarios de mesure

1. Affichage initial puis dépliage et repliage des types.
2. Zoom et déplacement horizontal et vertical.
3. Remplacement des données au changement de fenêtre, en conservant l'état de navigation et la période complète.
4. Lecture à plusieurs vitesses, saut entre clés et boucle complète.
5. Préparation de positions avec disponibilités immédiates, puis délais simulés de 50 et 200 ms.
6. Réponses reçues dans le désordre et commandes de pause, saut ou stop pendant une attente.
7. Rewind et gestion d'une préparation échouée, selon les règles définies pour la V1.
8. Collections dynamiques : lots proposés de 5 modifications toutes les 50 ms, avec ajouts, corrections tardives et suppressions ; conserver environ 5 000 éléments fournis en remplaçant les plus anciens dans l'exemple.
9. Direct actif avec fin de période extensible, préparations immédiates puis retardées, et fournisseur de fenêtre lent ; vérifier que des lots aboutissent malgré les nouvelles données et le déplacement automatique continu.
10. Exploration de l'historique pendant que les données arrivent, puis retour au Direct ; aucune file de positions accumulées, aucune réponse ancienne qui réactive le suivi.

Les valeurs de délai sont des cas d'essai proposés, pas des délais autorisés ou imposés à l'application consommatrice.

Le rythme des modifications est lui aussi un scénario de mesure après regroupement, pas une capacité annoncée. Les mises à jour sont simulées par l'application d'exemple ; la bibliothèque ne génère ni ne reçoit directement le protocole du flux.

## Résultats à relever

Mesurer séparément la fluidité des interactions, la durée des mises à jour, le coût mémoire et le comportement sous attente. Documenter le navigateur, la machine, les dimensions de la vue et la technique de rendu utilisée.

Vérifier aussi la correction : aucune ancienne réponse ne remplace la demande courante, une pause manuelle reste respectée, l'attente ne provoque pas de rattrapage temporel et un changement de fenêtre ne modifie pas les bornes de boucle.

Ces observations permettront de choisir ou d'ajuster le rendu et la limitation aux éléments visibles avant d'annoncer une capacité prise en charge.
