# Explorations supplémentaires

La maquette 01 (`index.html`, `styles.css`, `app.js` et `preview.html`) reste inchangée.

Ouvrir `propositions.html` pour comparer les sept directions. Le serveur local existant expose cette page sur http://127.0.0.1:4173/propositions.html. Le comparateur montre le composant seul par défaut ; scénario et densité sont communs aux sept vues. L’option « Interface complète » retrouve les compositions d’application.

| Direction | Page | Intention |
| --- | --- | --- |
| 01 — Atelier original | `index.html` | Référence conservée |
| 02 — Signaux / Console | `console.html` | Périodes en créneaux, trames de traits pour les groupes, impulsions ponctuelles |
| 03 — Jalons / Horizon | `horizon.html` | Rails, nœuds circulaires, légendes alternées et axe temporel inférieur |
| 04 — Pistes / Studio | `studio.html` | Clips détaillés sur deux niveaux, accolades de synthèse des groupes |
| 05 — Matrice | `matrix.html` | Couverture temporelle en cellules et détail des éléments par tranche |
| 06 — Arches | `arcs.html` | Courbes entre les bornes des périodes, nom et temps aux extrémités |
| 07 — Loupe | `lens.html` | Centre agrandi et contexte comprimé, fenêtre déplaçable et suivi |

Les nouvelles pages réutilisent les interactions originales. `variants.css` et `variants.js` définissent les compositions d’application. `timeline-views.css` et `timeline-views.js` définissent trois géométries de timeline. `comparison.js` pilote la comparaison du composant ; les styles de cadrage sont injectés uniquement dans l’aperçu, sans modifier l’originale. Les pages peuvent aussi être ouvertes directement depuis le dossier.

Studio permet d’ajuster les densités, la grille, les libellés, le panneau de détail et la largeur de structure. Sur petit écran, les réglages essentiels se placent au-dessus de la timeline.

Pour régénérer les six variantes à partir de l’originale : `node generate-variants.mjs`. Aucune installation de dépendances n’est nécessaire.

Les études 05 à 07 sont documentées dans [RECHERCHES.md](RECHERCHES.md), avec les références consultées, les intentions et les limites de lecture. Elles utilisent `explorations.js` et `explorations.css`, indépendamment des géométries 02 à 04. Le générateur produit désormais six variantes en laissant l’originale intacte.
