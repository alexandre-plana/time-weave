# Conception V1 — Time Weave

Date : 18 octobre 2026.
Statut : conception enrichie du temps réel et du mode Direct, relue par Astra et validée par l'utilisateur le 18 octobre 2026. Plan à rédiger lors de la reprise.

Ce document consolide la [définition](DEFINITION.md) et les réponses à la [revue Astra](REVUE-V1.md). Les décisions fonctionnelles de l'utilisateur sont conservées. Les conventions détaillées ci-dessous ont été proposées par l'assistant puis retenues avec la validation du document ; les formulations « proposé » en conservent la provenance. Aucune implémentation n'est encore réalisée.

## Lecture rapide : conventions proposées

| Sujet | Proposition et conséquence |
| --- | --- |
| Organisation | Un moteur TypeScript séparé de la vue React, dans un package unique |
| Temps | Des nombres en millisecondes ; calendrier en UTC pour les graduations, formatage personnalisable |
| Synchronisation | Le curseur principal attend la confirmation de l'application ; pas de rattrapage du temps passé à attendre |
| Lignes parentes | L'application fournit leurs marqueurs, comme ceux des lignes individuelles |
| Clés | Repères globaux, utilisables même hors de la fenêtre chargée ou dans des lignes repliées |
| Rewind | Animation vers une cible passée, 300 ms actives par défaut, durée configurable et allongée par les attentes |
| Lecture | Pause conserve la position ; Stop revient au début complet ; boucle sur toute la période |
| Temps réel | Collections modifiables pendant l'utilisation ; regroupement et connexion au flux restent à l'application |
| Direct | Suivi activable de la dernière position fournie, avec attente de l'application et retour possible à l'historique |
| Affichage | HTML/CSS et axe SVG comme première approche, avec limitation au visible et mesures avant toute capacité annoncée |

Ces choix complètent les besoins retenus et ont été validés avec le document. Les sections suivantes précisent les règles et les critères de réalisation.

## 1. Intention et réussite

Créer une bibliothèque TypeScript/React de timelines horizontales, utilisable pour rejouer une journée d'opérations, surveiller un flux en temps réel ou présenter l'histoire d'une entreprise. La timeline expose un temps partagé que l'application peut observer et piloter.

La V1 réussit si une application peut afficher ses données, personnaliser les interactions, parcourir son historique et rester synchronisée lors de la lecture, des sauts et des mises à jour asynchrones. Les fonctionnalités doivent être utilisables depuis un package installé dans une application distincte.

Un échec serait une timeline qui impose le sens métier des données, change ses bornes lors du chargement d'une fenêtre, applique une ancienne réponse après une nouvelle commande ou nécessite React dans son moteur temporel.

## 2. Périmètre

### Besoins retenus par l'utilisateur

- React dès la V1 et code TypeScript, avec une séparation architecturale.
- Temps calendrier et relatif ; échelles de la milliseconde aux décennies.
- Zoom et déplacement libres dans des limites configurables.
- Lignes hiérarchiques dépliables sur plusieurs niveaux.
- Événements et périodes ; données individuelles ou groupées par l'application.
- Lecture, pause, stop, vitesse réglable, clé précédente/suivante et boucle sur toute la période.
- Clés fournies dans les données ; aucune édition de clés dans la timeline.
- Saut immédiat et rewind optionnel vers une cible passée.
- Actions personnalisées, avec infobulle et modale facultatives simples.
- Pilotage temporel dans les deux sens avec l'application.
- Données fournies par fenêtre et remplacées au zoom ou au déplacement.
- Attente de l'application lorsqu'elle n'est pas prête.
- Ajout, modification et suppression d'éléments dans les collections pendant l'utilisation, notamment pour surveiller un flux.
- Mode Direct activable, qui suit les dernières données et peut être quitté pour explorer l'historique.

### Limites proposées pour cette V1

La bibliothèque ne charge pas elle-même les capteurs ou les données d'un serveur. Elle appelle le fournisseur de données de l'application. Elle ne regroupe pas automatiquement les événements et n'exécute pas toutes les communications traversées par le temps.

La boucle sur une sous-période et l'édition des clés sont hors de cette version, conformément aux échanges. Autres limites proposées : affichage horizontal, un mode temporel par instance, pas de conversion automatique calendrier/relatif, pas de lecture inversée permanente, pas d'adaptateur pour un autre framework et pas de système de plugins.

## 3. Responsabilités et architecture

| Partie | Responsabilité proposée |
| --- | --- |
| Moteur TypeScript | Modèle générique, état temporel, commandes, hiérarchie, demandes de préparation et de données, validation et notifications |
| Intégration React | Cycle de vie, abonnement à l'état et raccordement à l'ordonnanceur du navigateur |
| Vue React | Axe, lignes, marqueurs, curseur, zoom, déplacement, dépliage et contenu personnalisable |
| Aides React | Commandes de lecture, infobulle et modale remplaçables |
| Application | Données, regroupement, chargement, état métier, disponibilité et actions personnalisées |

Un seul dépôt et un seul package sont proposés. Le moteur n'importe ni React ni le DOM ; la couche navigateur fournit les impulsions de temps. Les objets métier comme les capteurs n'apparaissent pas dans les règles du moteur.

Le contrôleur est l'unique propriétaire de l'état de la timeline. Les boutons internes et les commandes de l'application passent par les mêmes transitions. React observe des instantanés stables de cet état ; un mécanisme tel que `useSyncExternalStore` convient à cette frontière.

## 4. Temps, période et vue

### Représentation proposée

Les temps sont des nombres en millisecondes. En mode calendrier, ce sont des timestamps Unix ; l'application convertit ses chaînes ou objets Date avant de les transmettre. En relatif, ce sont des positions depuis l'origine choisie ; les valeurs négatives sont permises.

Les entrées doivent être finies et rester dans une plage où la milliseconde est représentable ; les timestamps calendrier doivent aussi être représentables par Date. La progression interne peut conserver des fractions de milliseconde pour ne pas perdre les petits incréments aux vitesses lentes. La précision de présentation garantie par le périmètre est la milliseconde.

### Trois plages distinctes

| Notion | Règle |
| --- | --- |
| Période complète `domain` | Bornes explicites `start < end`, connues indépendamment des éléments chargés ; limites de lecture et de boucle |
| Fenêtre visible `viewport` | Portion de la période affichée ; modifiée par le zoom ou le déplacement |
| Plage chargée | Portion couverte par le lot actuellement fourni, éventuellement plus large que la fenêtre |

Le mode et l'origine de la période sont fixes pour une instance. L'application peut étendre explicitement la fin de période pendant l'utilisation, notamment avec un flux. Cette extension n'est jamais déduite des éléments chargés. Changer d'historique, déplacer l'origine ou réduire la période recrée l'instance dans cette première version.

Le temps courant est borné à la période complète. La fenêtre reste dans cette période et respecte une durée minimale configurable, proposée à 1 ms par défaut, et une durée maximale égale à la période. L'application peut aussi fournir une frontière du direct `liveTime`, croissante ou inchangée, dans la période ; par défaut elle correspond à sa fin connue. Elle n'est pas calculée comme le maximum des marqueurs reçus, qui peuvent être regroupés ou arriver en retard.

Les positions de navigation et les requêtes de fenêtre incluent leurs deux bornes. Une période d'événement est active de son début inclus à sa fin exclue ; une durée nulle se représente par un événement ponctuel. Les lots remplacent les précédents : la bibliothèque ne concatène pas automatiquement des fenêtres voisines.

### Graduations et formatage

Le mode relatif utilise des pas de durée adaptés à l'espace disponible. Le mode calendrier utilise des repères calendaires pour les mois, années et décennies, et des pas adaptés aux niveaux plus fins. Les libellés évitent les chevauchements.

Convention proposée pour la première version : graduations calendaires en UTC, locale configurable et fonctions de formatage remplaçables. Un formatage local personnalisé est possible ; la génération de bornes calendaires dans tous les fuseaux horaires n'est pas promise dans cette V1. Cette convention doit être visible dans la documentation et les exemples.

## 5. Données

### Objets conceptuels

| Objet | Champs minimaux proposés |
| --- | --- |
| Ligne | `id`, `label`, `parentId` optionnel, métadonnées optionnelles |
| Élément ponctuel | `id`, `rowId`, `at`, libellé et métadonnées optionnels |
| Élément de période | `id`, `rowId`, `start`, `end`, libellé et métadonnées optionnels |
| Groupe fourni | Même géométrie qu'un point ou une période, plus une indication de groupe et un compteur positif |
| Clé | `id`, `at`, libellé et métadonnées optionnels |
| Lot de fenêtre | Plage couverte et liste d'éléments, attachées à la demande correspondante |

Les métadonnées métier sont typées et opaques pour le moteur. Un groupe peut porter une référence vers des données externes ; il n'est pas nécessaire d'y copier toutes ses communications sources.

Les identifiants sont stables et uniques dans leur catégorie. Représenter une communication sur un parent et un enfant utilise deux identifiants d'élément distincts ; une référence métier commune peut rester dans les métadonnées. Les identifiants de lignes et de clés sont indépendants du lot d'éléments chargé.

Les lignes sont un arbre ou une forêt, sans cycle ni parent manquant. L'ordre des racines et des enfants suit l'ordre fourni. Les références de ligne inconnues, identifiants dupliqués, temps invalides et périodes inversées provoquent une erreur structurée ; le dernier état valide est conservé. Un objet temporel hors période complète est écarté de l'affichage ; les périodes qui la croisent sont coupées visuellement, sans modifier la donnée métier.

### Lignes parentes et clés

Chaque ligne peut porter ses propres éléments, y compris un parent. L'application prépare donc les représentations résumées qu'elle veut montrer sur un parent. Le repli masque ses descendants et conserve les éléments fournis sur le parent ; il ne déclenche pas de regroupement calculé par la librairie.

La profondeur n'est pas figée au domaine des connecteurs. L'état de dépliage est conservé pour les identifiants présents lors d'un remplacement des lignes. Les lignes supprimées perdent cet état ; les nouvelles démarrent repliées, sauf configuration initiale explicite.

Les clés sont globales à l'instance et couvrent la période complète, indépendamment du zoom et des lignes repliées. Précédente/suivante choisit l'instant de clé strictement inférieur/supérieur à la destination en attente, ou au temps confirmé en l'absence de demande. Plusieurs clés au même instant constituent une seule destination temporelle. Sans destination possible, la commande est inactive ; elle ne boucle pas, même si la lecture en boucle est activée.

### Collections dynamiques

Les lignes, éléments et clés peuvent être remplacés pendant l'utilisation. Un mécanisme de mise à jour groupée par identifiant est aussi proposé pour ajouter, modifier ou supprimer sans reconstruire systématiquement de grandes collections. La forme exacte des commandes sera précisée dans le plan ; les règles suivantes font partie de la conception :

- Une modification groupée est validée puis appliquée atomiquement, ou rejetée en conservant le dernier état valide. Les suppressions de lignes et modifications de leurs relations doivent former une hiérarchie valide à la fin de l'opération.
- Le dépliage, la fenêtre, la sélection et la position sont conservés tant que leurs identifiants ou valeurs restent valides. Un élément supprimé quitte le focus ou la modale ouverte, avec retour vers une cible encore présente.
- Le cache visuel écarte les éléments de lignes supprimées. La bibliothèque ne supprime pas les données métier détenues par l'application.
- Une correction ou un événement tardif met à jour les marqueurs, mais ne fait pas reculer la frontière du direct.
- Les mises à jour continuent pendant une pause ou l'exploration de l'historique. Elles ne constituent pas une commande de lecture ou de déplacement du curseur.
- En source directe, les ajouts/modifications/suppressions concernent la collection fournie. En source fenêtrée, l'application actualise son magasin puis demande le rafraîchissement de la fenêtre ; elle ne modifie pas simultanément le cache de fenêtre par une seconde voie concurrente.

L'application limite les volumes et conserve sa politique de rétention. L'extension de la fin de période ne requiert pas de conserver toutes les communications en mémoire dans la librairie. Les données anciennes peuvent être absentes de la source, avec une réponse vide explicite pour la plage concernée.

## 6. Contrôleur et surface React

Noms de travail proposés pour rendre les responsabilités concrètes ; leur orthographe finale peut être fixée pendant le plan :

- `createTimelineController` : création du moteur avec période, mode, lignes, clés, temps et fenêtre initiaux.
- `useTimelineController` : intégration d'une instance stable à React.
- `Timeline` : vue utilisant le contrôleur fourni.
- `PlaybackControls` : commandes facultatives utilisant le même contrôleur.

Le contrôleur expose un instantané et un abonnement, plus les commandes de lecture, pause, stop, vitesse, boucle, navigation, fenêtre, dépliage et entrée/sortie du Direct. Le remplacement ou la modification groupée des collections préserve les autres états valides. Il permet aussi de rafraîchir la source de données courante et de mettre à jour explicitement la fin de période et la frontière du direct.

La configuration temporelle initiale n'est pas recopiée en continu depuis des propriétés concurrentes : l'application commande la même instance. La vue n'a pas sa propre seconde position temporelle. La propriété et le nettoyage d'une instance partagée doivent être explicites ; les montages/démontages et reprises d'effets React ne créent ni double horloge ni abonnements persistants.

Une source d'éléments peut être un tableau en mémoire ou un fournisseur de fenêtre synchrone/asynchrone. Les deux alimentent le même modèle de lot ; le mode de source est explicite. Le chargement, les requêtes réseau et le regroupement restent dans l'application.

Le moteur peut être importé sans initialiser le navigateur. Le composant interactif est destiné au client ; le rendu serveur de la timeline n'est pas un critère de livraison V1. L'import du package doit néanmoins être sans effet de bord lié à `window` ou `document`.

## 7. Lecture et commandes

Au départ, le temps est celui demandé par la configuration, ou le début de la période ; la lecture est inactive. Une préparation initiale synchronise l'application avant la première progression. Aucune lecture n'est démarrée par le constructeur ou pendant un rendu React.

| Action | Comportement proposé |
| --- | --- |
| Lecture | Active l'intention de lecture ; reprend depuis la position confirmée après les éventuelles préparations |
| Lecture à la fin | Depuis la pause : demande le début de la période puis démarre, même sans boucle. Depuis le Direct : aucun retour au début (voir « Décisions complémentaires du 31 octobre 2026 ») |
| Pause | Désactive l'intention de lecture ; conserve la position confirmée ; une préparation déjà engagée peut se terminer sans relancer la lecture |
| Stop | Désactive l'intention, annule les demandes temporelles précédentes et prépare le début de la période complète |
| Vitesse | Facteur strictement positif et fini ; appliqué à la progression suivante ; aucun déplacement à lui seul |
| Saut immédiat | Demande une destination bornée à la période, sans animation ; conserve l'intention de lecture |
| Clé précédente/suivante | Saut vers la destination de clé, selon les règles de la section 5 ; conserve l'intention de lecture |
| Fin sans boucle | Confirme la dernière borne, puis désactive l'intention de lecture |
| Fin avec boucle | Confirme la fin puis prépare le début et poursuit ; pas d'accumulation de dépassements de frontière |

La barre proposée offre des vitesses de départ `0,25×`, `0,5×`, `1×`, `2×`, `4×`, `8×`, remplaçables par l'application. L'API accepte d'autres facteurs positifs, notamment pour parcourir des années. La vitesse n'est pas une garantie d'exécution des événements intermédiaires.

En rejeu, une extension de la fin de période ne déplace pas le curseur ni ne relance une lecture arrêtée. Si un retour de boucle attendait mais que l'ancienne fin n'est plus la fin courante, ce retour est annulé et la lecture peut continuer vers la nouvelle fin. La boucle vise toujours la période complète explicitement déclarée, jamais le seul lot de données.

### Rewind

Le rewind est un déplacement animé borné vers une cible passée, pas un mode permanent de lecture à vitesse négative. Durée active proposée : 300 ms, configurable. Les positions intermédiaires passent par le même contrat de préparation que les autres déplacements ; l'attente peut donc allonger la durée réelle.

L'animation termine exactement à la cible puis restaure l'intention de lecture antérieure si aucune commande ne l'a modifiée. Un nouveau saut ou Stop remplace l'animation. Pause interrompt sa poursuite, tout en autorisant la confirmation d'une étape déjà préparée. Lecture pendant le rewind l'interrompt et demande une progression vers l'avant depuis la position confirmée ; une étape dépassée est invalidée. Une préférence de réduction des animations transforme ce déplacement en saut immédiat.

### Fenêtre et visibilité

Déplacer le curseur ne recalcule pas l'échelle du zoom. Lorsqu'une destination demandée sort de la fenêtre et que le suivi est actif, la fenêtre se translate avec sa durée actuelle dès la demande pour charger cette destination avant sa confirmation. Le curseur principal reste au temps confirmé et la cible demandée peut être indiquée séparément. Cette anticipation évite qu'une préparation attende des données dont le chargement ne commencerait qu'après la confirmation. Le suivi du rejeu peut être désactivé par l'application ; celle-ci charge alors elle-même les données nécessaires à la cible. La boucle conserve ses bornes complètes.

La progression du rejeu est suspendue quand la vue n'est plus active dans le navigateur, puis reprend sans rattrapage temporel. Une préparation engagée peut se terminer, mais aucune série de positions n'est produite pour le temps passé en arrière-plan.

### Mode Direct

Le Direct est distinct du rejeu à vitesse choisie. Il vise la dernière frontière `liveTime` déclarée par l'application ; il ne génère pas une seconde horloge avec l'heure du navigateur. Il fonctionne donc aussi pour une source dont le temps est relatif.

Conventions proposées :

- L'action Direct active le suivi et demande la dernière frontière connue via le contrat normal de préparation. À destination confirmée, le Direct reste actif en attendant les prochaines données.
- La fenêtre conserve sa durée et suit la cible du Direct. Le zoom peut rester actif en conservant cet ancrage ; déplacer manuellement la fenêtre dans l'historique, choisir une clé ou déplacer le curseur quitte le Direct.
- Quitter le Direct pour une navigation laisse le transport en pause ; la destination de navigation est préparée normalement. La réception des données continue.
- Pause quitte le Direct et gèle la progression, sans interrompre les mises à jour de collections. Stop quitte le Direct et demande le début complet. Lecture seule démarre un rejeu depuis la position courante ; le bouton Direct est le moyen explicite de revenir au flux.
- Vitesse et boucle concernent le rejeu. Leurs réglages sont conservés mais leurs commandes ne s'appliquent pas au Direct. L'intention de transport est unique : pause, rejeu ou Direct ; ces modes ne progressent jamais simultanément.
- Pendant une préparation de Direct, les frontières plus récentes remplacent une unique prochaine cible mémorisée. Elles n'annulent pas systématiquement la préparation en cours et ne créent pas une file par communication. Après confirmation, seule la frontière la plus récente est demandée.
- Une commande explicite de navigation, Pause ou Stop prévaut sur ce suivi. Après la préparation déjà autorisée par Pause, aucune réponse tardive ne réactive le Direct.
- Une correction de données à frontière inchangée ne crée pas une nouvelle destination. L'application gère la mise à jour de son propre état à temps constant ; elle peut demander explicitement une nouvelle préparation si nécessaire.
- Après une suspension de la vue en arrière-plan, le Direct demande la dernière frontière connue. Il ne rejoue pas toutes les positions reçues pendant l'absence.

Le Direct attend donc l'application comme le rejeu, mais sa prochaine cible est la dernière position connue. Le choix de ne pas rattraper du temps réel écoulé dans le rejeu ne l'oblige pas à parcourir les anciennes positions reçues pendant une attente du Direct.

## 8. Préparation et confirmation du temps

L'attente de l'application est un besoin confirmé. Le contrat proposé est une fonction `prepareTime` optionnelle, qui termine immédiatement ou retourne une promesse. Sans travail de préparation, la confirmation est immédiate.

### Demande temporelle

Chaque demande contient un identifiant monotone propre à l'instance, la position précédente, la cible, la cause (`initial`, `play`, `seek`, `key`, `loop`, `stop`, `rewind`, `live`), un signal d'annulation et un moyen de vérifier qu'elle est toujours courante.

1. Le moteur choisit la cible et publie son état en attente.
2. L'application prépare son état ; elle décide quand cette préparation est réellement prête à être présentée.
3. La fin de la fonction ou de sa promesse confirme cette demande si elle est encore valide.
4. Le moteur publie la nouvelle position confirmée et sa cause. L'application peut l'observer sans émettre une seconde commande identique.
5. La progression suivante n'est demandée que si l'intention de lecture le permet.

La position confirmée et le curseur principal restent stables pendant l'attente. Une destination demandée peut être indiquée comme aperçu distinct, notamment pendant un déplacement du curseur à la souris. L'indication initiale reste au temps de départ avec un statut d'initialisation jusqu'à la première confirmation.

### Concurrence, erreurs et temps écoulé

Une seule préparation temporelle est courante. Une nouvelle destination explicite invalide l'ancienne et signale son annulation, sans attendre qu'une promesse ignorant ce signal se termine. Le moteur ignore ses résultats tardifs ; l'application doit également vérifier la validité avant d'appliquer ses propres résultats asynchrones. L'arrivée automatique de frontières de Direct utilise la coalescence décrite plus haut afin qu'un flux rapide ne rende pas toutes les préparations obsolètes avant leur fin.

Pause change l'intention, sans créer de destination. Lecture pendant une attente ordinaire réactive l'intention sans lancer de préparation concurrente. La vitesse affecte la prochaine progression. Désactiver la boucle alors qu'un retour de boucle attend annule ce retour et laisse la lecture arrêtée à la fin.

L'attente n'avance pas le temps logique : après confirmation, l'ordonnanceur du rejeu reprend une référence de temps réel neuve. Il ne traite ni tous les événements traversés ni le retard accumulé. Un écran lent ralentit donc le rejeu, conformément au choix de l'utilisateur. En Direct, une nouvelle confirmation vise ensuite la dernière frontière fournie, sans file des frontières intermédiaires.

Une préparation échouée conserve la dernière position confirmée, annule l'intention de lecture et expose une erreur avec la cible concernée. L'application peut réessayer explicitement cette cible ou en choisir une autre. Pas de délai d'expiration ni de reprise silencieuse imposés ; annulation, Pause et Stop restent utilisables.

L'attente du moteur signifie que l'application a confirmé sa disponibilité ; elle ne garantit pas un rendu atomique de tous les composants externes. La documentation explique que la simple programmation d'une mise à jour React ne prouve pas que son affichage est terminé.

## 9. Demandes de fenêtre et remplacement des données

Une demande de fenêtre contient son propre identifiant, la plage visible, une plage demandée avec une marge proposée de 25 % de chaque côté, bornée à la période, et un signal d'annulation. Les identifiants de demande de fenêtre et de préparation temporelle sont distincts.

La source retourne un lot avec sa plage couverte et ses éléments. Une source en mémoire peut retourner immédiatement toute la période. Une source distante peut attendre et ne retourner que la plage demandée. Une réponse vide couvrant une plage signifie « aucune donnée », distinct de « chargement en cours ».

Les notifications de fenêtre sont coalescées au rythme du rendu pendant un geste. Une navigation manuelle, un zoom explicite ou un changement de fournisseur crée une nouvelle génération de demandes et invalide immédiatement les demandes de la génération précédente. Une plage déjà couverte par le lot valide peut être parcourue sans rechargement.

Les déplacements automatiques de fenêtre, qu'ils viennent du Direct ou du suivi du rejeu, et les extensions de période ne rendent pas sans cesse le chargement engagé obsolète. Ils conservent la demande active de la génération courante et mémorisent une seule prochaine plage désirée, la plus récente. Sa réponse peut alimenter le lot avec sa couverture réelle ; une seule nouvelle requête pour la plage encore nécessaire est ensuite lancée. Une navigation manuelle conserve sa priorité et change de génération.

Un rafraîchissement de données à plage et fournisseur inchangés mémorise de même un seul besoin de rafraîchir après la réponse active. Les rafraîchissements suivants sont regroupés dans ce besoin. Cela permet à un flux continu de produire des lots affichables, puis un lot plus récent, plutôt que d'annuler tous les chargements avant leur fin.

Seules les réponses de demandes encore valides dans la génération courante sont appliquées. Le lot expose sa couverture réelle ; une couverture partielle peut donc rester affichable pendant le chargement suivant. Le remplacement conserve période, temps confirmé, vitesse, intention de lecture, fenêtre et dépliage des lignes encore présentes. Un échec laisse le précédent lot disponible et expose l'erreur ; la disponibilité des données, le chargement en cours et l'erreur sont observables séparément.

Le chargement de fenêtre ne bloque pas automatiquement la lecture. Lorsque ces données sont nécessaires à l'état synchronisé, la fonction de préparation de l'application attend un lot valide couvrant sa cible, même vide. Elle n'attend pas que tous les rafraîchissements soient terminés : un flux actif peut en demander continuellement. Aucun ordre de chargement caché n'est imposé entre ces deux mécanismes.

Une préparation hors de la fenêtre courante peut déclencher le déplacement anticipé décrit en section 7 ; l'application peut aussi charger directement les données de sa cible. Une donnée arrivée ou remplacée ne vaut pas, à elle seule, confirmation d'une demande temporelle.

## 10. Vue, personnalisation et accessibilité

### Choix de rendu proposé

Commencer avec des lignes et marqueurs HTML/CSS et un axe SVG simple. Limiter le rendu aux lignes et éléments visibles, avec une petite marge. Les chevauchements sont placés dans des pistes déterministes à l'intérieur d'une ligne, avec une hauteur dérivée ; aucun élément n'est fusionné pour résoudre un chevauchement.

Les algorithmes exacts de placement et de virtualisation sont laissés au constructeur. Ils doivent conserver un ordre stable et l'accès aux éléments. Le rendu sera évalué sur le jeu de référence avant de confirmer sa capacité ; Canvas n'est pas une condition de la V1.

### Interactions et contenu

Le clic sur un élément ou un groupe transmet sa donnée, la ligne et le contexte de l'action. Il ne déplace pas le temps par défaut. Le clic sur le fond temporel demande un saut ; un glissement du fond déplace la fenêtre. Le déplacement du curseur demande la dernière destination pointée en invalidant les précédentes.

Les commandes de zoom sont toujours disponibles par boutons ; des gestes de souris/tactile les complètent. Un glissement ne doit pas produire un clic de navigation au relâchement. Les gestes et seuils exacts sont des choix d'implémentation à documenter.

Les libellés, styles via classes/variables CSS, contenus de ligne, contenus d'élément et contenus de détail peuvent être personnalisés avec React. La géométrie et le placement restent pilotés par la timeline ; les contenus personnalisés respectent la place qui leur est donnée.

Par défaut, aucune modale métier ne s'ouvre automatiquement. Les aides facultatives peuvent afficher le libellé, le temps et le compteur d'un groupe, ou un contenu fourni. L'infobulle fonctionne aussi au focus. La modale facultative gère le focus, sa fermeture par Échap et le retour au déclencheur. Les métadonnées ne sont pas automatiquement sérialisées en interface.

### Exigences d'accès

Toutes les commandes et le dépliage sont accessibles au clavier avec un nom explicite. Les éléments disposent d'une navigation de focus qui ne nécessite pas de traverser des milliers de tabulations. Une cible de focus hors écran est révélée avant activation.

La navigation temporelle au clavier a des équivalents aux gestes de pointeur ; les raccourcis sont limités à la zone active et n'interceptent pas les champs de saisie personnalisés. Les positions annoncées sont formatées selon le mode. Le statut d'attente ou d'erreur est exposé sans annoncer chaque image de lecture. La réduction des animations est respectée.

## 11. Validation et exemples

### Cas de réussite à vérifier

- Même séquence de commandes et de durées injectées, même état temporel observé, sans dépendance au nombre d'images du navigateur.
- Saut vers une clé située hors du lot chargé ; navigation entre clés simultanées sans blocage.
- Pause, Stop et nouveau saut pendant une préparation ; aucune ancienne réponse ne reprend la main.
- Fin avec et sans boucle, à plusieurs vitesses ; aucune dépendance à la fenêtre visible.
- Remplacement et erreur de fenêtre pendant lecture et dépliage, sans perte de la période complète ni corruption du temps.
- Ajouts, modifications et suppressions de lignes, éléments et clés pendant la lecture et la pause ; opérations invalides rejetées atomiquement.
- Extension explicite de la fin de période, avec et sans suivi du Direct ; événements tardifs sans recul de la frontière.
- Frontières reçues plus vite que les confirmations en Direct : une préparation courante et une cible récente, sans file croissante ni annulation perpétuelle.
- Rafraîchissements continus de la même fenêtre avec une source lente : les chargements aboutissent et les changements de fenêtre ignorent les anciennes réponses.
- Direct continu avec préparation immédiate, source lente et période extensible : les déplacements automatiques n'annulent pas perpétuellement les chargements ; une couverture utilisable permet de confirmer sans attendre la fin de tous les rafraîchissements.
- Sortie du Direct par navigation ou pause, retour explicite et absence de reprise causée par une réponse tardive.
- Saut vers une cible nécessitant une autre fenêtre : son chargement commence avant que la confirmation ne soit attendue.
- Rewind complet, interrompu et ralenti par l'attente ; cible exacte et règles d'intention respectées.
- Mode calendrier des millisecondes aux décennies ; mode relatif incluant origine et valeurs négatives.
- Données invalides rejetées en conservant le dernier état valide.
- Déconnexion/reconnexion de la vue, effets React rejoués et absence de doubles horloges ou abonnements oubliés.
- Parcours clavier, aides facultatives et réduction des animations.
- Installation de l'archive du package dans une application distincte, avec import du JavaScript, types et styles.

Les tests de règles utilisent une horloge contrôlée. Les essais de navigateur vérifient les interactions et l'intégration ; les mesures du [jeu de référence](JEU-REFERENCE.md) rapportent l'environnement et ne sont pas remplacées par des tests de pure logique.

Deux exemples sont proposés : une application d'opérations avec rejeu, flux simulé, suivi du Direct, fenêtres chargées, groupes et disponibilité retardée ; une histoire d'entreprise avec périodes et contenu personnalisé. L'application d'opérations sert de premier fil conducteur, puis le second exemple vérifie la réutilisation du modèle. Le flux simulé appartient à l'exemple, pas au transport réseau de la bibliothèque.

## 12. Livraison et choix laissés au plan

Distribution proposée : JavaScript en modules ES, déclarations TypeScript et styles explicitement importables ; React reste une dépendance fournie par l'application. Le moteur est importable par un point d'entrée distinct afin de vérifier sa séparation.

Le constructeur choisira dans le plan le compilateur de distribution, les outils de test, les versions stables exactes de React à prendre en charge et les dépendances de placement utiles. Le choix d'une licence et la disponibilité du nom npm seront réglés avant une publication effective ; ils ne sont pas nécessaires pour écrire le moteur.

Le plan doit séquencer les livraisons vérifiables : règles et contrats, intégration et affichage, exemples, mesures puis préparation du package. Ce document ne vaut pas instruction de publier sur npm.

## Sources techniques consultées

- [React — useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) : abonnement à un état externe et stabilité des instantanés.
- [MDN — requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) : ordonnancement du navigateur ; la progression doit utiliser un temps écoulé plutôt que compter les images.
- [MDN — Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) : formatage localisé de dates.

Ces sources documentent les mécanismes sous-jacents. Les conventions et limites de la V1 ci-dessus sont les choix de conception proposés pour ce projet.

## Relecture avant planification

Le 18 octobre 2026, un nouveau sous-agent Astra (`gpt-6-astra`) a lu la version précédant l'ajout du temps réel, sans historique complet, pour identifier les questions indispensables à sa planification. Son retour était : « rien d'important ne manque ».

Un autre relecteur Astra indépendant a ensuite contrôlé l'ajout des collections dynamiques et du Direct. Il a identifié un point structurant : les déplacements automatiques pouvaient annuler tous les chargements d'une source lente. La section 9 distingue désormais les générations de navigation manuelle des déplacements automatiques, qui conservent la demande active et une unique prochaine plage. La section 11 inclut ce cas de validation. Aucun nouveau choix de produit n'a été demandé à l'utilisateur.

Le relecteur a vérifié la correction et confirmé que ce point est résolu, sans contradiction indispensable restante dans les sections relues.

La relecture ne remplace pas la validation de la conception par l'utilisateur ni les vérifications de la future implémentation.

## Décisions complémentaires du 31 octobre 2026

Cinq choix d'implémentation, que la conception ne tranchait pas explicitement, ont été validés par l'utilisateur le 31 octobre 2026 :

1. **Lecture depuis le Direct** : Lecture démarre un rejeu depuis la position courante, sans retour au début, même lorsque la frontière du Direct est la fin de période. À la fin, la lecture se termine aussitôt en pause à la fin ; avec la boucle, la règle normale de fin de lecture s'applique. « Lecture à la fin » ne concerne que la Lecture demandée depuis la pause.
2. **Pause pendant un retour de boucle, puis extension de la période** : le retour engagé se termine.
3. **Navigation manuelle de la fenêtre** : une nouvelle génération est créée au plus une fois par tâche, afin de regrouper les déplacements d'un même geste.
4. **Lot de fenêtre citant une ligne supprimée pendant son chargement** : les éléments de cette ligne sont écartés silencieusement. Le lot n'est refusé, avec l'erreur structurée `unknown-row`, que s'il cite une ligne inconnue, absente aussi lors de l'émission de la demande.
5. **Clés hors de la période complète** : ignorées par la navigation ; elles redeviennent des destinations si la période s'étend.
