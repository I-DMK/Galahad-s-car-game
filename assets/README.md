# Fichiers en attente pour la tâche 8b (addendum « présentation » du 2026-10-22)

Dossier **hors de `public/`** : rien ici n'est servi ni empaqueté par Vite. La tâche 8b
déplacera ces fichiers dans `public/sprites/` et `public/fonts/` et les chargera
(`src/render/assets.ts`, `@font-face` dans `index.html`). Tant que l'addendum n'est pas
validé, le jeu déployé n'y touche pas.

## `sprites/` (303 KB, budget de l'addendum §1.2 : ≤ 400 KB)

Origine : reproduction du jeu par Grok, générée par le papa le 2026-10-22 (archive
`grok-workspace.zip`, dossier `public/sprites/`). Images originales 1069 × 600 px
(≈ 500 KB chacune), réduites ici à 512 px de large (roue, étoile, flammes 256 px, Terre
384 px), filtre Lanczos, puis quantifiées en PNG-8 à 256 couleurs avec tramage.

Les carrosseries sont **renommées par pilote** selon la correspondance de teinte de
l'addendum §1.4 (le nom Grok est donné pour retrouver l'original) :

| Fichier | Pilote (palette 5a) | Nom dans l'archive Grok |
|---|---|---|
| `galahad.png` | Galahad, bleu | `galahad.png` |
| `pablo.png` | Pablo, rouge | `liam.png` |
| `diego.png` | Diego, vert | `pablo.png` |
| `matthis.png` | Matthis, jaune | `malo.png` |
| `malo.png` | Malo, orange | `timothe.png` |
| `liam.png` | Liam, rose | `diego.png` |
| (aucun) | Timothée, blanc | à générer (option A) ou repli par code |

Non repris : `kaiden.png` (turquoise) et `matthis.png` (violet) de l'archive, exclus par la
règle de la 5a (aucun copain bleu, cyan, turquoise ou violet).

Les carrosseries sont **sans roues** (arches vides) : `wheel.png` se dessine à la position et à
l'angle que Matter donne à chaque roue. Géométrie mesurée sur les originaux (fractions de la
largeur de l'image) : centres des roues à x = 0,2016 et 0,7249, y = 0,765 de la hauteur,
rayon des arches 0,0897. Voir l'addendum §1.3 pour le désaccord avec `WHEEL_BASE` et
`WHEEL_RADIUS`, et la décision A/B/C.

Autres : `wheel.png`, `star.png`, `earth.png`, `flame-0.png` à `flame-3.png` (boucle de turbo).

## `fonts/` (40 KB)

Fredoka, graisses 600 et 700, sous-ensemble latin, `woff2`, tels que livrés par
`@fontsource/fredoka` 5.3 dans l'archive. Licence SIL Open Font License 1.1
(https://openfontlicense.org), auto-hébergement autorisé. Addendum §2.
