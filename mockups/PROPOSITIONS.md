# Explorations supplémentaires

La maquette 01 (`index.html`, `styles.css`, `app.js` et `preview.html`) reste inchangée.

Ouvrir `propositions.html` pour comparer les quatre directions. Le serveur local existant expose cette page sur http://127.0.0.1:4173/propositions.html.

| Direction | Page | Intention |
| --- | --- | --- |
| 01 — Atelier original | `index.html` | Référence conservée |
| 02 — Console | `console.html` | Navigation latérale, densité forte, journal de session |
| 03 — Horizon | `horizon.html` | Parcours panoramique, quatre strates, détail inférieur |
| 04 — Studio | `studio.html` | Réglages de présentation à gauche, timeline large, détail inférieur |

Les nouvelles pages réutilisent les interactions originales. `variants.css` et `variants.js` ajoutent les compositions sans modifier les fichiers existants. Les pages peuvent aussi être ouvertes directement depuis le dossier.

Studio permet d’ajuster les densités, la grille, les libellés, le panneau de détail et la largeur de structure. Sur petit écran, les réglages essentiels se placent au-dessus de la timeline.

Pour régénérer les trois pages à partir de l’originale : `node generate-variants.mjs`. Aucune installation de dépendances n’est nécessaire.
