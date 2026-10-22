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

## `generated/` (à créer par le papa) : les sept sprites générés (addendum §1.3, option A)

Déposer ici les PNG **tels que sortis du générateur** (≥ 1024 px de large, fond transparent),
nommés `galahad.png`, `pablo.png`, `diego.png`, `timothée.png`, `matthis.png`, `malo.png`,
`liam.png` (par exemple sur GitHub, « Add file › Upload files » dans ce dossier, sur la branche
de la session). Un dossier dans le dépôt plutôt qu'une archive : une archive envoyée à une
session disparaît avec elle.

### Gabarit

- `docs/sprites-gabarit.svg` : le gabarit coté (tâche 8b, Step 0), dans le repère du châssis
  physique. Roues de 0,90 m de diamètre à ±0,75 m du centre et 0,25 m dessous (suspension quasi
  rigide : ±1 cm en course, mesuré sur 3 courses à 5 voitures), arches de 0,50 m de rayon, pilote
  casqué au tiers arrière, cadre de 2,80 × 1,40 m centré sur le châssis.
- `docs/sprites-gabarit-reference.png` : **l'image à joindre au générateur** (silhouette grise,
  roues en pointillés, fond blanc, mêmes proportions que le cadre).

Les carrosseries contrôlées font **512 × 256 px et couvrent exactement ce cadre** (183 px/m) : la
tâche 8b les dessine dans le rectangle de 2,80 × 1,40 m centré sur le châssis, tourné de son angle.

### Génération

Générer d'abord Galahad jusqu'à satisfaction, puis demander « la même voiture » dans chaque
couleur, pour garder un seul style, un seul angle et une seule taille. Prompt de départ, avec
`sprites-gabarit-reference.png` en pièce jointe :

```
Side view of a cartoon lunar racing buggy, facing right, strictly profile,
transparent background. Follow the attached layout image exactly: the car
body fills the grey silhouette (same length, same height, same wheel arch
positions and sizes), the helmeted driver's head is on the grey circle, visor
facing right. The dashed circles only show where the wheels will be added
later: do NOT draw wheels, leave the wheel arches empty and transparent.
Do not copy the grey color, the outlines or the dashed lines of the layout.
Bold flat colors with soft shading, kid-friendly, no text, no shadow on the
ground. Body color: blue (#1e5cff) with red (#e2231a) stripes, red helmet.
```

Puis, pour chaque copain : « Same car, same angle, same style, same size and position, only the
colors change: » suivi de sa ligne (palette validée en 5a, `src/cars/pilots.ts`) :

| Fichier | Couleurs |
|---|---|
| `pablo.png` | `bright red body (#c8001e), cream-gold stripes (#ffdc64), light red helmet (#d64056)` |
| `diego.png` | `green body (#2ecc40), cream stripes (#fff096), dark green helmet (#208f2d)` |
| `timothée.png` | `white body (#f5f5f5), teal stripes (#00a8a0), light grey helmet (#d0d0d0)` |
| `matthis.png` | `yellow body (#ffff00), brown stripes (#965a1e), light yellow helmet (#ffff40)` |
| `malo.png` | `orange body (#ff8000), turquoise stripes (#3cd2be), light orange helmet (#ffa040)` |
| `liam.png` | `pink body (#ff77aa), lime green stripes (#bee63c), light pink helmet (#ffa0c4)` |

Si le générateur dessine quand même les roues, ce n'est pas grave : le contrôle les efface
(wheel.png les remplace en jeu). Ce qui compte : la taille et la place des arches, et rien de
coupé par le cadre.

### Contrôle (session)

Outils dans `tools/sprites/` (Node + Playwright pour le rendu du gabarit, Python 3 avec Pillow et
numpy pour le contrôle) :

```
node tools/sprites/rendu-gabarit.cjs calque calque.png
python3 -I tools/sprites/controle.py assets/generated/<id>.png assets/sprites/<id>.png apercu-<id>.png calque.png assets/sprites/wheel.png
```

`controle.py` repère les deux arches (ou, à défaut, les roues dessinées), met l'image à l'échelle
pour que leurs centres tombent sur les axes du gabarit, efface l'intérieur des arches, réduit à
512 × 256 px (Lanczos sur alpha prémultiplié), quantifie en PNG-8 et imprime un rapport. Accepté si :
arches de 0,47 à 0,55 m de rayon, centres à la même hauteur (±3 cm), pente ≤ 1,5°, rien d'opaque
coupé par le cadre (hors roues effacées), ≤ 60 KB. L'aperçu montre la voiture sur le ciel du jeu
avec ses roues, puis la même avec le calque du gabarit : c'est lui que le papa valide.

Essais (2026-10-22) : la silhouette du gabarit elle-même est acceptée (arches à 49,5 cm, même
emprise au pixel près que le rendu direct) ; avec des roues dessinées, elles sont effacées et
l'arche mesurée à 50 cm ; le sprite Grok `galahad.png` est **refusé** comme l'annonçait le §1.3
(arches de 0,26 m à notre échelle, carrosserie de 2,87 m coupée par le cadre).
