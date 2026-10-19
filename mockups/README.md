# Time Weave — Maquette 01

Maquette exploratoire autonome, séparée de la bibliothèque publiée. Ouvrir `index.html` dans un navigateur, ou, depuis le dossier `mockups/`, lancer :

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Puis ouvrir http://127.0.0.1:4173.

`preview.html` présente le format desktop à l’échelle dans une fenêtre étroite. `index.html` est l’interface interactive responsive.

## Direction

Thème clair, neutre et technique : bordures de 1 px, ombres discrètes, typographie Inter, valeurs temporelles en IBM Plex Mono et icônes SVG au trait. Les couleurs douces identifient les catégories de données. Les polices utilisent Google Fonts avec des polices système de secours.

## Interactions

- Deux scénarios : journée d’opérations et histoire d’entreprise.
- Trois densités : compacte, standard et confortable.
- Dépliage de la hiérarchie, repli/dépliage global.
- Lecture, pause, arrêt, vitesse et boucle sur la période complète.
- Navigation entre les clés, zoom, ajustement et vue d’ensemble.
- Clic sur le fond temporel ou déplacement de la poignée pour déplacer le curseur.
- Sélection d’un élément, inspecteur et saut à son instant de début.
- Filtres de couleur et réinitialisation.
- Flèches et Espace lorsque le curseur temporel a le focus.

Les données sont illustratives. La lecture est accélérée pour explorer les scénarios. Ce prototype visuel ne constitue pas l’implémentation du moteur TypeScript/React décrit dans `../librairie/docs/`.

## Autres propositions

Ouvrir `propositions.html` pour comparer sept géométries de timeline : Originale, Signaux, Jalons, Pistes, Matrice, Arches et Loupe. Le comparateur affiche le composant seul, avec scénario et densité communs. Les quatre premières études sont conservées.

Les nouvelles recherches du 19 octobre 2026 sont expliquées dans [RECHERCHES.md](RECHERCHES.md). Les pages autonomes correspondantes sont `matrix.html`, `arcs.html` et `lens.html` ; aucune dépendance supplémentaire n’est nécessaire.
