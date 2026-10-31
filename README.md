# Time Weave

Projet de bibliothèque TypeScript et React pour créer des timelines interactives : plusieurs lignes, hiérarchie dépliable, navigation temporelle et lecture synchronisée avec une application.

## État du projet

**31 octobre 2026 — Première implémentation V1.**

La conception V1, validée le 18 octobre, est implémentée selon le [plan de réalisation](docs/PLAN-REALISATION.md) : moteur TypeScript indépendant de React, vue React, commandes de lecture, deux exemples et une page de mesure. Le package reste privé ; aucune publication npm n'a été effectuée.

## Démarrage

```bash
npm install
npm test              # règles du moteur (horloge contrôlée) et composants React (jsdom)
npm run dev:examples  # exemples : http://localhost:5173/
npm run check         # typage, tests, build, isolation du moteur, archive installée, exemples
```

```tsx
import { PlaybackControls, Timeline, useTimelineController } from 'time-weave';
import 'time-weave/styles.css';

const controller = useTimelineController({
  mode: 'calendar',
  domain: { start: Date.UTC(2026, 9, 18), end: Date.UTC(2026, 9, 19) },
  rows: [{ id: 'station', label: 'Station Nord' }],
  source: [{ id: 'm1', rowId: 'station', at: Date.UTC(2026, 9, 18, 6), label: 'Mesure' }],
  prepareTime: (request) => application.afficherEtatA(request.target, request.signal),
});

<Timeline controller={controller} toolbar={<PlaybackControls controller={controller} showLive />} />;
```

Le [guide d'utilisation](docs/GUIDE.md) décrit l'API, le contrat de préparation, les sources par fenêtre, le Direct, le clavier et les styles.

## Premiers usages

- **Rejouer une journée d'opérations** : parcourir des communications de capteurs et piloter les autres éléments d'une application à partir du temps de lecture.
- **Surveiller un flux** : mettre à jour les collections pendant l'utilisation et suivre le Direct, avec possibilité de revenir à l'historique.
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
- Collections dynamiques : ajout, modification et suppression pendant l'utilisation.
- Mode Direct activable suivant la dernière position fournie par l'application ; chargement et connexion au flux restent externes.

La séparation d'un moteur temporel indépendant de React et de la vue React est proposée ; le détail de cette architecture reste à valider.

## Documents

- [Guide d'utilisation](docs/GUIDE.md) : API implémentée, exemples de code, clavier et styles.
- [English usage guide](docs/en/GUIDE.md) : guide et [présentation](docs/en/README.md) en anglais pour les futurs utilisateurs.
- [Plan de réalisation](docs/PLAN-REALISATION.md) : outillage, étapes et journal.
- [Mesures](docs/MESURES.md) : première série sur le jeu de référence et environnement.
- [Conception V1 validée](docs/CONCEPTION-V1.md) : lecture rapide, comportements, données, synchronisation et critères de réalisation.
- [Définition et statut du brainstorming](docs/DEFINITION.md) : besoins confirmés, propositions et limites de responsabilité.
- [Architecture proposée](docs/ARCHITECTURE.md) : séparation du moteur, de la vue React et des aides facultatives.
- [Questions ouvertes](docs/QUESTIONS-OUVERTES.md) : décisions restantes, par priorité.
- [Revue extérieure Astra](docs/REVUE-V1.md) : regard critique, recommandations et réponses de l'utilisateur.
- [Jeu de référence proposé](docs/JEU-REFERENCE.md) : volumes et scénarios de mesure.

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/core/` | Moteur : modèle, validation, hiérarchie, clés, graduations, pistes, ordonnanceurs, contrôleur |
| `src/react/` | `Timeline`, `PlaybackControls`, `DetailModal`, hooks, textes anglais et français |
| `src/styles.css` | Styles par défaut, variables `--tw-*`, thème sombre |
| `tests/` | Tests Vitest du moteur et des composants |
| `examples/` | Journée d'opérations, histoire d'entreprise, page de mesure |
| `scripts/` | Vérification de l'isolation du moteur et de l'archive installée |

## Maquettes interactives

Le dossier [mockups/](mockups/README.md) contient sept explorations visuelles autonomes : l'Atelier original, Signaux, Jalons, Pistes, Matrice, Arches et Loupe. Ouvrir [le comparateur](mockups/propositions.html) pour parcourir les directions, ou [l'originale](mockups/index.html) pour retrouver la première maquette conservée à l'identique. Les dernières pistes et leurs références sont documentées dans [les notes de recherche](mockups/RECHERCHES.md).

Ces prototypes HTML/CSS/JavaScript ont guidé la présentation ; la bibliothèque implémentée reprend la direction de l'Atelier original.

## Point de reprise

Prochaines étapes proposées : mesures sur un poste réel en build de production, relecture de l'API par l'utilisateur, puis choix du nom npm, de la licence et des versions de React prises en charge avant toute publication.

## Publication

Le nom du package npm, sa disponibilité, la licence, les versions de React prises en charge et l'outillage de distribution restent à choisir. Ce dépôt sera la racine du projet destiné à être public ; les documents de méthode et l'historique de travail sont conservés dans un espace local séparé.
