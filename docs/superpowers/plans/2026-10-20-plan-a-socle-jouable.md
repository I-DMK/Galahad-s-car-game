# Plan A — Socle jouable de la Course Lunaire de Galahad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une voiture bleue et rouge pilotée à un doigt sur une piste lunaire générée, avec sauts, volcans, respawn, ligne d'arrivée, chrono, étoiles turbo, déployée sur GitHub Pages et vérifiable sur la tablette.

**Architecture:** Site statique Vite + TypeScript. La logique pure (piste, points sûrs, respawn, turbo) vit dans `src/track/` et `src/cars/` sans dépendance à Matter.js ni au DOM. `src/physics/` construit le monde Matter.js à partir de la piste. `src/sim/simulate.ts` contient **le pas de course unique** (`stepRace`) utilisé à la fois par le jeu et par les tests de simulation. `src/render/` dessine sur un canvas 2D, `src/game.ts` orchestre une boucle à pas fixe. Une seule voiture (Galahad) dans ce plan ; la structure (filtres de collision, état par voiture) est prête pour les 4 copains du plan B.

**Tech Stack:** TypeScript 5.7 (strict), Vite 8, matter-js 0.20.0 (+ @types/matter-js 0.20.2), Vitest 5 (+ jsdom pour un fichier), @playwright/test 1.56.1 (Chromium pré-installé, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), GitHub Actions + GitHub Pages. Node 22.

**Spec:** `docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md` (§3 constantes, §4 architecture, §5 piste, §6 voiture/physique, §8 entrée/rendu, §10 robustesse, §11 tests, §12 déploiement, §13 étapes 1 à 3).

**Relectures intégrées :** relecture standard et relecture adversariale du 2026-10-20 (cette dernière a simulé la voiture avec matter-js 0.20.0 ; ses mesures sont citées là où elles fixent une valeur).

## Global Constraints

- Mètres et secondes dans la logique ; Matter.js en pixels ; `PIXELS_PER_METER = 40`. Axe y du monde vers le **haut**, axe y Matter.js vers le **bas** : `py = −y × 40`.
- Pas physique fixe `PHYSICS_DT = 1/60 s`, au plus `MAX_STEPS_PER_FRAME = 4` pas par image, **accumulateur plafonné** à `4 × PHYSICS_DT` et remis à zéro quand l'onglet redevient visible. Chrono en temps simulé (compte de pas).
- Matter.js sans `Render` ni `Runner`. Vitesses Matter.js en px par pas de 1/60 s (matter-js 0.20 normalise à `Body._baseDelta = 1000/60`). Gravité : `engine.gravity.y = GRAVITY × 40 / 1000` (1 unité ≈ 1 000 px/s² avec `scale` par défaut 0,001).
- **`frictionAir = CONFIG.AIR_DRAG = 0` sur toutes les parties de la voiture** (le défaut Matter 0,01 plafonne la voiture à 10 m/s et fait rater tous les sauts).
- Masse des corps donnée **par l'option `mass` de `Bodies.rectangle`/`Bodies.circle`** (inertie cohérente), jamais via `Body.setMass` après coup.
- Aucun déplacement de corps dans un callback de collision : détection par scrutation de `engine.pairs.list` (paires `isActive`) après `Engine.update`, application entre deux pas.
- Aucun fichier image ni audio ; tout est dessiné par code.
- `track/`, `cars/` n'importent ni `matter-js` ni le DOM (test de dépendance, tâche 2).
- `type Config = { readonly [K in keyof typeof CONFIG]: number }` pour que les tests puissent passer un `cfg` modifié.
- Vitest : `defineConfig` importé de `vitest/config`, `test.globals: true`, `types: ["vite/client", "vitest/globals"]`, **`test.testTimeout: 180_000`** (les simulations Matter.js durent de 30 s à quelques minutes : ~2 ms par pas sur un monde de 8 400 corps statiques).
- Base Vite = `process.env.VITE_BASE ?? '/'` ; en CI `VITE_BASE=/I-DMK/`. Déploiement sur push de `ccr-5b6fabc4-n96ofo` (branche par défaut du dépôt). Adresse : `https://i-dmk.github.io/I-DMK/`.
- Paramètres d'URL : `?seed=` (défaut 1), `?len=` (mètres, défaut calculé), `?debug=1` (compteur fps + `window.__game`).
- Tout texte utilisateur en français, mots courts, chiffres en gros. Aucun bouton pendant la course.
- Commits en français, préfixés `feat:`, `test:`, `chore:`, `docs:`. Pas d'identifiant de modèle dans les commits.

## Review Focus

Entrées ou situations que le spec implique ; chaque ligne a son test dans la tâche indiquée.

1. **`?len=` absurde (0, négatif, NaN, 50 m, 50 000 m).** Attendu : longueur bornée à [300 ; 6 000] ou valeur par défaut ; piste toujours valide. → tâche 4.
2. **Doigt posé avant le chargement, ou onglet caché puis revisible.** Attendu : accélérateur relâché tant qu'aucun nouveau `pointerdown` n'arrive ; aucun « saut dans le temps » de l'accumulateur. → tâche 8 (Throttle) et tâche 9b (`advanceAccumulator`).
3. **Voiture calée contre le flanc du cône ou posée sur le flanc.** Attendu : respawn en ≤ 2,1 s. → tâche 10b.
4. **Deuxième chute dans le même volcan.** Attendu : replacement sur le plat de réception, jamais plus de 2 respawns par volcan. → tâche 10a (`chooseRespawnTarget` par volcan) et 10b (simulation).
5. **DPR 2 à 1280×800 CSS.** Attendu : backing store ≤ 1920 px, voiture lisible (~125 px CSS), pas de défilement. → tâche 9a (`computeBackingSize`) et tâche 14.

---

## Structure des fichiers

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, .gitignore
.github/workflows/deploy.yml
src/main.ts                 lit l'URL, crée Game, démarre
src/config.ts               toutes les constantes (§3 du spec + dérivées)
src/game.ts                 boucle rAF à pas fixe, états racing/finished, window.__game, garde-fou exception
src/track/rng.ts            mulberry32, pickWeighted
src/track/ballistics.ts     jumpRange, runUpDistance
src/track/types.ts          Track, Slice, Volcano, Star, TrackPoint
src/track/slices.ts         profils de hauteur de chaque tranche, volcanoGeometry
src/track/generate.ts       generateTrack, defaultTrackLength, parseTrackOptions
src/track/query.ts          heightAt, slopeAt, sliceAt, volcanoAhead, nearestVolcanoZone
src/track/stars.ts          placeStars
src/physics/units.ts        toPx, toM, worldToPhys, physToWorld, speedMps, mpsToPxPerStep
src/physics/world.ts        CAT, createWorld (engine, sol, lave, mur), stepWorld, sensorsTouching
src/physics/car.ts          createCar, placeCar, applyDrive, wheelsOnGround, applyAirLevel, clampVelocities, setCarInvulnerable
src/physics/stars.ts        createStarBodies, syncStarBodies
src/cars/state.ts           CarState, SafePoint, newCarState
src/cars/safepoint.ts       forbiddenZone, isSafePointCandidate
src/cars/respawn.ts         normalizeAngle, updateRespawnTimers, chooseRespawnTarget, applyRespawnToState
src/cars/turbo.ts           activateTurbo, turboFactor
src/cars/stars.ts           StarState, isStarActive, takeStar
src/sim/simulate.ts         RaceSim, createRaceSim, stepRace, simulateRace (le pas de course unique)
src/input/throttle.ts       Throttle (pointer events sur window, Set de pointerId)
src/render/camera.ts        Camera, computeBackingSize
src/render/background.ts    ciel + Terre pré-rendus hors écran
src/render/track.ts         sol (avec culling), volcans, lave, ligne d'arrivée, étoiles
src/render/car.ts           carrosserie, pilote, roues, flammes
src/render/effects.ts       particules : étincelles, poussière, bulles, fumée
src/render/renderer.ts      orchestre le dessin d'une Scene
src/ui/hud.ts               chrono, fps (debug), écran ARRIVÉE provisoire
src/loop/accumulator.ts     advanceAccumulator (pur)
tests/*.test.ts             Vitest (pure + Matter.js headless)
e2e/*.spec.ts               Playwright
```

---

### Task 1 : Squelette du projet, scripts, CI et déploiement GitHub Pages

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/config.ts`, `.gitignore`, `.github/workflows/deploy.yml`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `CONFIG` et `type Config` dans `src/config.ts`. Scripts npm : `dev`, `build`, `preview`, `test` (`vitest run`), `test:watch`, `typecheck` (`tsc --noEmit`), `e2e` (`playwright test`).

- [ ] **Step 1 : Initialiser le projet et les dépendances**

```bash
cd /home/user/I-DMK && npm init -y
npm install matter-js@0.20.0
npm install -D typescript@5.7 vite@8 vitest@5 jsdom @types/matter-js@0.20.2 @playwright/test@1.56.1
```

`.gitignore` : `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `e2e/screenshots/`.

- [ ] **Step 2 : Écrire `src/config.ts`**

```ts
const DEG = Math.PI / 180;
export const CONFIG = {
  PIXELS_PER_METER: 40,
  GRAVITY: 4.9,                 // m/s²
  V_MAX: 14,                    // m/s
  V_CRUISE: 0.8 * 14,
  V_JUMP: 10,                   // m/s au sommet de rampe : vitesse de calibration des volcans (à 22°, exige ≥ 8,8 m/s pour passer le bord aval de la lave)
  TURBO_FACTOR: 1.5,
  TURBO_SECONDS: 3,
  STAR_RESPAWN_SECONDS: 5,
  STAR_EXCLUSION_BEFORE_LAVA: 3 * 14 * 1.5,   // 63 m
  RAMP_ANGLE: 22 * DEG,
  RAMP_LENGTH: 6,               // m le long de la pente → sommet à 2,25 m
  MAX_SLOPE: 27 * DEG,
  LAVA_MARGIN: 0.7,             // lave à 70 % de la portée calculée à V_JUMP
  ELAN_MARGIN: 1.2,
  ELAN_SAFE_FRACTION: 0.75,     // le plat d'élan est dimensionné pour qu'il suffise de 75 % de sa longueur
  CAR_LENGTH: 2.2, CAR_HEIGHT: 0.7, WHEEL_BASE: 1.5, WHEEL_RADIUS: 0.45, WHEEL_DROP: 0.25,
  CHASSIS_MASS: 60, WHEEL_MASS: 40,
  SUSPENSION_STIFFNESS: 0.3, SUSPENSION_DAMPING: 0.1, SUSPENSION_ANCHOR_SPREAD: 0.3,
  WHEEL_FRICTION: 1.0, CHASSIS_FRICTION: 0.3, RESTITUTION: 0.05, AIR_DRAG: 0,
  DRIVE_ACCEL: 4,               // m/s² : REMPLACÉ par la valeur mesurée en tâche 7a
  WHEEL_SPINUP: 0.01,           // rad/pas par pas (0,02 mesuré ≈ 7 m/s², trop)
  ENGINE_BRAKE: 0.995,          // facteur par pas sur omega, doigt levé
  FINISH_BRAKE: 0.98,           // facteur par pas après l'arrivée
  AIR_LEVEL_K: 0.004, AIR_LEVEL_D: 0.08,   // rad/pas² par rad, et par rad/pas ; réglés par le test 7a
  TRACK_POINT_SPACING: 0.2,
  RACE_TARGET_SECONDS: 150,
  TRACK_MIN_LENGTH: 300, TRACK_MAX_LENGTH: 6000,
  START_LENGTH: 5 * 1.5 * 2.2 + 10,     // 26,5 m
  FINISH_PLAT_BEFORE: 20, AFTER_FINISH: 60,
  LAVA_WIDTH: 3, RIM_HEIGHT: 1.2, CRATER_DEPTH: 1, STOP_BUMP_HEIGHT: 0.3, STOP_BUMP_LENGTH: 1,
  PHYSICS_DT: 1 / 60, MAX_STEPS_PER_FRAME: 4,
  SAFE_POINT_INTERVAL: 0.5, SAFE_POINT_MAX_SLOPE: 10 * DEG,
  RESPAWN_INVULN: 0.5, RESPAWN_INVULN_MAX: 2,
  FLIP_ANGLE: 110 * DEG, FLIP_SECONDS: 1, SIDE_ANGLE: 70 * DEG, SIDE_SECONDS: 2,
  STUCK_SECONDS: 2, STUCK_DISTANCE: 1,
  SPEED_GUARD: 3 * 14 * 1.5,    // 63 m/s
  VERTICAL_SPEED_CAP: 14 * 1.5 * 1.5,   // 31,5 m/s
  FINISH_COAST_SECONDS: 1.5,
  BACKING_MAX_WIDTH: 1920,
  CAMERA_LEAD_SECONDS: 0.6, CAMERA_SMOOTHING: 0.08, VISIBLE_HEIGHT_M: 14,   // 57 px/m à 800 px CSS → voiture ≈ 125 px
  GALAHAD_COLOR: 0x1e5cff, GALAHAD_ACCENT: 0xe2231a,
} as const;
export type Config = { readonly [K in keyof typeof CONFIG]: number };
```

- [ ] **Step 3 : `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`**

`vite.config.ts` : `import { defineConfig } from 'vitest/config'` ; `base: process.env.VITE_BASE ?? '/'` ; `test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 180_000 }`. `tsconfig.json` : `strict`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `types: ["vite/client", "vitest/globals"]`, `include: ["src", "tests", "e2e"]`. `index.html` : viewport `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no` ; `<canvas id="game">` ; `<div id="hud">` ; styles `html,body{margin:0;height:100%;overflow:hidden;background:#000;touch-action:none;overscroll-behavior:none;-webkit-user-select:none;user-select:none}`, `canvas{display:block;width:100vw;height:100vh}`, `#hud{position:fixed;inset:0;pointer-events:none}`. `src/main.ts` : écrit pour l'instant « Course Lunaire » sur le canvas (remplacé en tâche 9b).

- [ ] **Step 4 : Test de fumée `tests/smoke.test.ts`** : `CONFIG.PIXELS_PER_METER === 40`, `GRAVITY === 4.9`, `STAR_EXCLUSION_BEFORE_LAVA === 63`, `AIR_DRAG === 0`, `START_LENGTH ≥ 5 × 1,5 × CAR_LENGTH + 10`. Run : `npm test` PASS, `npm run typecheck` 0 erreur, `VITE_BASE=/I-DMK/ npm run build` → `dist/index.html` référence `/I-DMK/assets/`.

- [ ] **Step 5 : `.github/workflows/deploy.yml`**

Déclencheurs : `push` sur `ccr-5b6fabc4-n96ofo`, `workflow_dispatch`. `permissions: contents: read, pages: write, id-token: write`. `concurrency: group: pages, cancel-in-progress: true`. Job `build` : `actions/checkout@v4`, `actions/setup-node@v4` (node 22, cache npm), `npm ci`, `npm run typecheck`, `npm test`, `npm run build` (`VITE_BASE: /I-DMK/`), `actions/configure-pages@v5` avec `enablement: true`, `actions/upload-pages-artifact@v3` (`path: dist`). Job `deploy` : `needs: build`, `environment: github-pages`, `actions/deploy-pages@v4`. Attendu : le premier run peut échouer en 403 sur `configure-pages` tant que le papa n'a pas fait Settings → Pages → Source « GitHub Actions » ; le dire dans le message final de la tâche.

- [ ] **Step 6 : Commit et push** `chore: squelette Vite/TypeScript, tests, CI et déploiement GitHub Pages` ; `git push -u origin ccr-5b6fabc4-n96ofo` ; vérifier le run via l'API GitHub.

---

### Task 2 : Unités, balistique, RNG et garde de dépendances

**Files:**
- Create: `src/physics/units.ts`, `src/track/ballistics.ts`, `src/track/rng.ts`
- Test: `tests/units.test.ts`, `tests/ballistics.test.ts`, `tests/rng.test.ts`, `tests/deps.test.ts`

**Interfaces:**
- `toPx(m)`, `toM(px)`, `worldToPhys({x,y})` (y inversé), `physToWorld`, `speedMps({x,y})` (`norme × 60 / 40`), `mpsToPxPerStep(v)`.
- `jumpRange(v0, g, angle, drop = 0)` : `t = (v sinθ + √(v² sin²θ + 2 g drop)) / g`, portée `v cosθ · t`. `runUpDistance(vTarget, accel) = vTarget² / (2·accel)`.
- `mulberry32(seed): () => number` ; `pickWeighted<T>(rng, items: {item: T, weight: number}[]): T`.

- [ ] **Step 1 : Tests** : `jumpRange(10, 4.9, 22°) ≈ 100·sin(44°)/4.9` ; `jumpRange(10, 4.9, 22°, 1.05) ≈ 16.42` (±0,05) ; avec chute > sans ; `runUpDistance(11, 4) ≈ 15.125` ; `worldToPhys({1,2}) = {40,−80}` ; `speedMps({40/60, 0}) ≈ 1` ; mulberry32 déterministe et dans [0,1) sur 1 000 tirages ; `pickWeighted` respecte les poids à ±5 % sur 10 000 tirages ; `deps.test.ts` : aucun fichier de `src/track`, `src/cars`, `src/loop` ne contient `from 'matter-js'`, `document.` ou `window.`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: unités, balistique, RNG déterministe et garde de dépendances`

---

### Task 3 : Profils des tranches de piste

**Files:**
- Create: `src/track/types.ts`, `src/track/slices.ts`
- Test: `tests/slices.test.ts`

**Interfaces (`types.ts`):**
```ts
export interface TrackPoint { x: number; y: number }
export type SliceType = 'plat' | 'bosses' | 'rampe-saut' | 'double-bosse' | 'rampe-volcan';
export interface Slice { type: SliceType; xStart: number; xEnd: number }
export interface Volcano { xElanStart: number; xRampStart: number; xLip: number; lipY: number; xLava: number; lavaWidth: number; rimY: number; xReception: number; xEnd: number }
export interface Star { id: number; x: number; y: number }
export interface Track { seed: number; targetLength: number; length: number; points: TrackPoint[]; slices: Slice[]; volcanoes: Volcano[]; stars: Star[]; xStart: number; xFinish: number; xWall: number }
```

**Interfaces (`slices.ts`):** `interface SliceProfile { type: SliceType; heights: number[]; length: number; exemptIndices: number[]; volcano?: { dxRampStart; dxLip; lipY; dxLava; lavaWidth; rimY; dxReception; dxEnd } }` (hauteurs tous les `TRACK_POINT_SPACING`, premier point exclu, `exemptIndices` = indices des points exemptés du test de pente) ; builders `plat(rng, cfg, length?)`, `bosses(rng, cfg)`, `rampeSaut(rng, cfg)`, `doubleBosse(rng, cfg)`, `rampeVolcan(cfg)` ; `volcanoGeometry(cfg)` → `{ lElan, rampRun, lipY, descentRun, ascentRun, valleyRun, dxLava, dxReception, dxEnd }`.

Géométrie de `rampe-volcan` (valeurs avec CONFIG : lipY 2,25 ; rampRun 5,56 ; descentRun 4,41 ; ascentRun 2,36 ; dxLava 11,49 ; valleyRun 3,22 ; réception dès 15,35 ; fin ≈ 81 m ; tranche ≈ 105 m) :
1. Plat d'élan : `vBottom = √(V_JUMP² + 2·GRAVITY·lipY)` ; `lElan = runUpDistance(vBottom, DRIVE_ACCEL) × ELAN_MARGIN / ELAN_SAFE_FRACTION` (≈ 24,4 m avec DRIVE_ACCEL 4).
2. Rampe : `RAMP_LENGTH` à `RAMP_ANGLE` → `lipY = RAMP_LENGTH·sin`, `rampRun = RAMP_LENGTH·cos`.
3. Descente à `MAX_SLOPE` jusqu'à 0, plat de vallée `valleyRun`, montée à `MAX_SLOPE` jusqu'à `RIM_HEIGHT`, cratère : **parois verticales** (une colonne de 0,2 m de profil de chaque côté, exemptées du test de pente, donc ≤ 2 points exemptés par volcan), fond à `RIM_HEIGHT − CRATER_DEPTH` sur `LAVA_WIDTH − 0,4`, puis descente à `MAX_SLOPE` jusqu'à 0.
4. `dxLava = LAVA_MARGIN × jumpRange(V_JUMP, GRAVITY, RAMP_ANGLE, lipY − RIM_HEIGHT)` ; `valleyRun = dxLava − (descentRun + ascentRun + LAVA_WIDTH/2)` ; **`rampeVolcan` lance une erreur si `valleyRun < 0`**.
5. Butée : bosse en demi-sinus de `STOP_BUMP_HEIGHT` sur `STOP_BUMP_LENGTH` au pied de la descente aval (spec §5), pente vérifiée (0,3 m sur 1 m : pente max ≈ 25°).
6. Plat de réception de `dxReception` jusqu'à `dxEnd = max(dxReception + 10, dxLip + 1,2 × jumpRange(V_MAX × TURBO_FACTOR, GRAVITY, RAMP_ANGLE, lipY))`.

Autres tranches : `plat` 20–40 m (ou longueur imposée). `bosses` 30–60 m : somme de deux sinus de longueurs d'onde λ₁, λ₂ ∈ [8, 14] m et d'amplitudes `A_i = rng × λ_i × tan(MAX_SLOPE) / (5π)`, multipliée par l'enveloppe `sin²(π x / L)` pour finir à 0. `rampe-saut` : rampe `RAMP_LENGTH` à `RAMP_ANGLE`, cassure de 0,4 m sur 0,2 m (1 point exempté), descente à 10° jusqu'à 0, puis 8 m de plat. `double-bosse` : deux demi-sinus de **0,9 m** sur 6 m (pente max 25,3°), séparés de 4 m, puis 6 m de plat.

- [ ] **Step 1 : Tests** : chaque type commence et finit à 0, espacement 0,2 ; pente ≤ MAX_SLOPE partout sauf aux `exemptIndices` (≤ 1 pour rampe-saut, ≤ 2 pour rampe-volcan, 0 ailleurs) ; `volcanoGeometry` : `valleyRun ≥ 0`, `RIM_HEIGHT < lipY`, `dxLava ≈ 11.49` (±0,1), `dxEnd ≥ dxLip + 1,2 × portée turbo` ; `lElan ≈ 24.4` (±0,5) ; `rampeVolcan({...CONFIG, LAVA_MARGIN: 0.4})` lance ; builders déterministes pour un même rng.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: profils des tranches de piste et géométrie des volcans`

---

### Task 4 : Assemblage de la piste, contraintes et requêtes

**Files:**
- Create: `src/track/generate.ts`, `src/track/query.ts`
- Test: `tests/generate.test.ts`, `tests/query.test.ts`

**Interfaces:**
- `generateTrack(seed, targetLength, cfg, opts?: { onlyPlat?: boolean }): Track` (`stars: []` jusqu'à la tâche 5 ; `onlyPlat` : que des `plat`, pour les tests de calibration).
- `defaultTrackLength(cfg) = V_CRUISE × RACE_TARGET_SECONDS`.
- `parseTrackOptions(search, cfg): { seed; length; debug }` — `seed` entier ≥ 0 (défaut 1) ; `length` borné à `[TRACK_MIN_LENGTH, TRACK_MAX_LENGTH]`, NaN/absent → défaut.
- `heightAt(track, x)` (interpolation linéaire, clampée), `slopeAt(track, x)` (radians, montée positive), `sliceAt(track, x)`, `volcanoAhead(track, x)` (premier volcan avec `xLava > x`), `nearestVolcanoZone(track, x)` (volcan dont `[xElanStart, xEnd)` contient x).

Assemblage : `plat` de départ de `START_LENGTH` (`xStart = START_LENGTH − 5`) ; puis tirage pondéré `{plat 2, bosses 3, rampe-saut 2, double-bosse 2, rampe-volcan 3}` ; une tranche n'est acceptée que si `x + longueur ≤ target − FINISH_PLAT_BEFORE − AFTER_FINISH`, sinon on arrête ; `rampe-volcan` refusée si `x < 0,15 × target`, si `x + longueur > 0,90 × target`, ou si la tranche précédente est `rampe-volcan` (retirer une autre) ; puis `plat` jusqu'à `xFinish = target − AFTER_FINISH`, `xWall = target`, `length = target`. Les `exemptIndices` sont reportés dans un tableau `exemptPointIndices` du `Track` (ajouter le champ) pour le test de pente.

- [ ] **Step 1 : Tests** (seeds 0..49 × lengths [300, 1680, 6000]) : déterminisme ; longueur = cible et espacement 0,2 ; pente ≤ MAX_SLOPE hors `exemptPointIndices` ; aucune lave dans [0, 15 %) ni [90 %, 100 %] ; jamais deux `rampe-volcan` consécutives ; hauteur 0 sur `[xFinish − 20, xWall]` ; `START_LENGTH` de plat au début ; `onlyPlat` → hauteur 0 partout ; `parseTrackOptions` : `"?seed=5&len=900"` → {5, 900} ; `"?len=50"` → 300 ; `"?len=abc"` → défaut ; `"?len=-1"` → 300 ; `"?len=99999"` → 6000 ; `"?debug=1"` → true ; `slopeAt` sur une rampe ≈ RAMP_ANGLE ; `volcanoAhead`/`nearestVolcanoZone`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: génération déterministe de la piste et contraintes des volcans`

---

### Task 5 : Placement des étoiles

**Files:**
- Create: `src/track/stars.ts` ; Modify: `src/track/generate.ts`
- Test: `tests/stars.test.ts`

**Interfaces:** `placeStars(track, rng, cfg): Star[]` — candidats tous les 12–20 m sur les `plat` (après `xStart`) et les plats de réception, plus 1 m avant chaque `rampe-saut` ; exclusion si `x ∈ [xLava − STAR_EXCLUSION_BEFORE_LAVA, xLava]` ou `x ≥ xFinish − FINISH_PLAT_BEFORE` ; `y = heightAt(x) + 0,6` ; ids croissants.

- [ ] **Step 1 : Tests** (50 graines) : aucune étoile à < 63 m avant une lave ; aucune sur le plat final ; ≥ 5 étoiles pour 1 680 m ; `y − heightAt(x) ≈ 0,6` ; ids uniques.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: placement des étoiles à distance de sécurité des volcans`

---

### Task 6 : Monde physique : gravité, sol, lave, mur

**Files:**
- Create: `src/physics/world.ts`
- Test: `tests/world.test.ts`

**Interfaces:**
```ts
export const CAT = { GROUND: 0x0001, CAR: 0x0002, SENSOR: 0x0004 } as const;
export interface World { engine: Matter.Engine; track: Track; ground: Matter.Body[]; lava: Matter.Body[]; wall: Matter.Body; floorY: number }
export function createWorld(track: Track, cfg: Config): World
export function stepWorld(world: World): void          // Engine.update(engine, 1000/60)
export function sensorsTouching(engine: Matter.Engine, bodies: Matter.Body[]): Matter.Body[]   // capteurs des paires isActive de engine.pairs.list impliquant l'un des bodies
```
- Gravité : `engine.gravity.y = GRAVITY × PIXELS_PER_METER / 1000`, `enableSleeping = false`.
- Sol : un corps statique par segment, trapèze `(x_i, y_i), (x_{i+1} + 1 px, y_{i+1}), (x_{i+1} + 1 px, floorY), (x_i, floorY)` en px ; `floorY = −min(y)×40 + 400` ; créé par `Bodies.fromVertices(c.x, c.y, [verts])` avec **`c = Vertices.centre(verts)`** (sinon décalage vertical) ; `friction: 1`, `collisionFilter: {category: GROUND, mask: CAR}`, `label: 'ground'`.
- Lave : par volcan, rectangle `isSensor`, x de `xLava − lavaWidth/2` à `xLava + lavaWidth/2`, de `rimY − CRATER_DEPTH + 0,2` (0,2 m au-dessus de la surface) jusqu'à `floorY`, `{category: SENSOR, mask: CAR}`, `label: 'lava'`, `plugin: { volcano }`.
- Mur : rectangle statique à `xWall`, 10 m de haut, GROUND, `label: 'wall'`.

- [ ] **Step 1 : Tests** (corps de test : `category: CAT.CAR`, `frictionAir: 0`, un seul monde par test)
  - gravité : corps lâché, 60 pas → chute 2,45 m ± 10 %.
  - sol sans trou : piste seed 1, **toutes les roues créées dans le même monde**, une tous les 5 m, `collisionFilter.group` négatif commun pour qu'elles s'ignorent, lâchées 3 m au-dessus du sol, 300 pas → chaque centre à `heightAt + WHEEL_RADIUS ± 0,05`.
  - tunneling : roues lancées vers le bas à `VERTICAL_SPEED_CAP` (31,5 m/s) tous les 5 m, même monde → aucune sous `heightAt − 0,1`.
  - lave : cercle posé dans le cratère → rapporté par `sensorsTouching` ; sur le plat de réception → non.
  - mur : corps lancé vers `xWall` arrêté avant `xWall + 1`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** (durée attendue < 60 s)
- [ ] **Step 5 : Commit** `feat: monde Matter.js, sol en trapèzes, capteurs de lave et mur`

---

### Task 7a : Voiture physique, conduite et calibration

**Files:**
- Create: `src/physics/car.ts` ; Modify: `src/config.ts` (valeurs calibrées)
- Test: `tests/car.test.ts`

**Interfaces:**
```ts
export interface CarBody { id: string; index: number; chassis: Matter.Body; wheels: [Matter.Body, Matter.Body]; constraints: Matter.Constraint[]; composite: Matter.Composite; parts: Matter.Body[] }
export function createCar(world: World, id: string, index: number, x: number, cfg: Config): CarBody      // posé sur la piste à x via heightAt(world.track, ·) par roue, angle 0
export function placeCar(car: CarBody, x: number, heightAt: (x: number) => number, angle: number, cfg: Config): void
   // châssis à (x, heightAt(x) + WHEEL_RADIUS + WHEEL_DROP) tourné de angle ; chaque roue à (xRoue, heightAt(xRoue) + WHEEL_RADIUS) ; Body.setVelocity({0,0}) et setAngularVelocity(0) sur CHAQUE partie
export function applyDrive(car: CarBody, throttle: boolean, speedFactor: number, cfg: Config): void
   // par pas : si throttle, omega += WHEEL_SPINUP jusqu'à mpsToPxPerStep(V_MAX × factor) / toPx(WHEEL_RADIUS) ; sinon omega ×= ENGINE_BRAKE ; jamais omega < 0
export function applyBrake(car: CarBody, factor: number): void          // omega ×= factor (FINISH_BRAKE après l'arrivée)
export function wheelsOnGround(engine: Matter.Engine, car: CarBody): [boolean, boolean]   // contact isActive avec un corps non capteur
export function applyAirLevel(car: CarBody, onGround: [boolean, boolean], cfg: Config): void
   // si aucune roue au sol : chassis.torque = (−normalizeAngle(angle) × AIR_LEVEL_K − angularVelocity × AIR_LEVEL_D) × chassis.inertia / (1000/60)²
export function clampVelocities(car: CarBody, cfg: Config): void       // |vy| de chaque partie ≤ VERTICAL_SPEED_CAP
export function setCarInvulnerable(car: CarBody, on: boolean): void    // mask GROUND|SENSOR si on, sinon GROUND|CAR|SENSOR
export function carSpeedMps(car: CarBody): number ; export function carAngle(car: CarBody): number   // normalisé (−π, π]
```
Construction : châssis `Bodies.rectangle(…, { mass: CHASSIS_MASS, chamfer: { radius: toPx(0.2) }, friction: CHASSIS_FRICTION, frictionAir: AIR_DRAG, restitution: RESTITUTION })` ; roues `Bodies.circle(…, { mass: WHEEL_MASS, friction: WHEEL_FRICTION, frictionAir: AIR_DRAG, restitution: RESTITUTION })`, axes à `WHEEL_BASE/2` de part et d'autre, `WHEEL_DROP` sous le centre du châssis ; par roue **deux** contraintes depuis les points du châssis `(±WHEEL_BASE/2 ± SUSPENSION_ANCHOR_SPREAD, 0)` vers le centre de roue, `stiffness: SUSPENSION_STIFFNESS`, `damping: SUSPENSION_DAMPING`, `length` = distance au repos ; `collisionFilter: { group: −(index + 1), category: CAT.CAR, mask: GROUND | CAR | SENSOR }` ; labels `chassis`, `wheel`. `normalizeAngle` vient de `cars/respawn.ts` (tâche 10a) : créer ici `src/physics/angle.ts` avec `normalizeAngle` et la réexporter en 10a.

- [ ] **Step 1 : Tests** (piste `generateTrack(1, 600, cfg, { onlyPlat: true })`, voiture à x = 10)
  - construction : `frictionAir === 0` sur les 3 parties ; masses 60/40/40 ; groupe négatif ; 4 contraintes.
  - repos : 120 pas sans gaz → |v| < 0,05 m/s, |angle| < 2°, roues à `WHEEL_RADIUS ± 0,05` du sol.
  - calibration : plein gaz, accélération moyenne sur 0–2 s ; **écrire la valeur mesurée (arrondie à 0,1) dans `CONFIG.DRIVE_ACCEL`** et asserter `|mesure − DRIVE_ACCEL| ≤ 0,1 × DRIVE_ACCEL` ; cible 3,5–5 m/s² (régler `WHEEL_SPINUP`).
  - vitesse max : plein gaz 10 s → vitesse dans [0,9 ; 1,02] × V_MAX.
  - doigt levé : ralentit sans jamais reculer ; de 14 m/s, encore > 8 m/s après 2 s.
  - `applyBrake(FINISH_BRAKE)` : de 14 m/s à < 1 m/s en moins de 6 s.
  - air-level sur **la voiture complète** (monde sans sol : `createWorld` sur une piste puis `Composite.remove` des corps `ground`) : châssis lâché à 40° → < 10° après 90 pas, sans dépasser −15° ; régler `AIR_LEVEL_K`/`AIR_LEVEL_D`.
  - `clampVelocities` : partie à −80 m/s vertical → −31,5 ; horizontale inchangée.
  - `placeCar` sur une pente de 8° (piste seed 1, x choisi via `slopeAt`) : 30 pas sans gaz → |v| < 0,05 m/s.
  - invulnérable : mask sans CAT.CAR, puis rétabli.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter et calibrer** → **Step 4 : PASS** ; relancer `tests/slices.test.ts` et `tests/generate.test.ts` (lElan dépend de `DRIVE_ACCEL`) → PASS.
- [ ] **Step 5 : Commit** `feat: voiture Matter.js, conduite à un doigt et constantes calibrées`

---

### Task 7b : Sauts de volcans et de rampes vérifiés

**Files:**
- Test: `tests/jump.test.ts` ; Modify éventuel : `src/config.ts` (`V_JUMP`, `LAVA_MARGIN`)

Boucle de test (sera remplacée par `stepRace` en 9b ; ici boucle locale) : `applyDrive(throttle, factor)` → `applyAirLevel(wheelsOnGround)` → `stepWorld` → `clampVelocities` → lecture `sensorsTouching` (lave).

- [ ] **Step 1 : Tests** (pistes seeds 0..4, chaque volcan ; durée attendue 2–4 min)
  - depuis l'arrêt à `xElanStart`, plein gaz : jamais de lave, atterrit (deux roues au sol) dans `[xReception, xEnd]` avant 12 s.
  - depuis l'arrêt à `xElanStart + (1 − ELAN_SAFE_FRACTION) × lElan` (pire point sûr) : idem.
  - avec turbo permanent (`factor = TURBO_FACTOR`) depuis `xElanStart` : atterrit dans `[xReception, xEnd]`.
  - `rampe-saut` (chaque occurrence, seeds 0..4) abordée à V_MAX puis à V_MAX × TURBO_FACTOR : |angle| < 45° à l'atterrissage, pas de retournement (|angle| > 110°) dans les 3 s qui suivent.
- [ ] **Step 2 : Run** → si un saut de volcan échoue : la vitesse au sommet est bornée par la traction (≈ 11 m/s mesurés), donc **ne pas augmenter `V_JUMP`** ; abaisser `LAVA_MARGIN` (≥ 0,55, `valleyRun ≥ 0`) ou augmenter `ELAN_MARGIN` ; si une rampe-saut retourne la voiture : augmenter `AIR_LEVEL_K`/`D` puis rejouer 7a. Documenter les valeurs retenues dans le commit.
- [ ] **Step 3 : PASS** → **Step 4 : Commit** `test: sauts de volcans et de rampes vérifiés en simulation Matter.js`

---

### Task 8 : Accélérateur tactile

**Files:**
- Create: `src/input/throttle.ts`
- Test: `tests/throttle.test.ts` (`// @vitest-environment jsdom`)

**Interfaces:** `class Throttle { constructor(target: Window = window); readonly pressed: boolean; dispose(): void }` — `Set<number>` de `pointerId` : ajout au `pointerdown` sauf si `event.target` (ou un ancêtre) porte `data-no-pedal` ; suppression au `pointerup`/`pointercancel` **du même id** ; `clear()` sur `blur` et sur `visibilitychange` quel que soit l'état ; `pressed = set.size > 0`. Bloque aussi `contextmenu`.

- [ ] **Step 1 : Tests** : pointerdown → pressed ; deux ids, un levé → pressed ; pointercancel → relâché ; **pointerup sans pointerdown → toujours relâché, puis pointerdown → pressed** ; visibilitychange → relâché ; blur → relâché ; pointerdown sur un élément `data-no-pedal` ignoré ; `dispose` retire les écouteurs.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: accélérateur à un doigt sur window avec relâchement sûr`

---

### Task 9a : Rendu et caméra

**Files:**
- Create: `src/render/camera.ts`, `src/render/background.ts`, `src/render/track.ts`, `src/render/car.ts`, `src/render/renderer.ts`
- Test: `tests/camera.test.ts`

**Interfaces:**
- `computeBackingSize(cssW, cssH, dpr, maxW = 1920): { w; h; scale }` (`scale = w / cssW`).
- `class Camera { constructor(cfg); update(targetX, targetY, speedMps, dt): void; readonly x; readonly y; pxPerMeter(viewH): number; worldToScreen(p, viewW, viewH): {x,y} }` — cible `(targetX + speed × CAMERA_LEAD_SECONDS, targetY)` lissée par `CAMERA_SMOOTHING` ; `pxPerMeter = viewH / VISIBLE_HEIGHT_M` ; `visibleHalfWidthM(viewW, viewH)`.
- `interface CarView { x; y; angle; wheels: {x; y; angle}[]; color: string; accent: string; name: string; turbo: boolean }` ; `interface Scene { track: Track; cars: CarView[]; stars: {x; y; active: boolean}[]; t: number }` ; `class Renderer { constructor(canvas, cfg); resize(): void; draw(scene, camera): void }`.
- `prerenderSky(w, h): HTMLCanvasElement` (ciel noir, 200 étoiles, Terre bleue en haut à droite), parallaxe `0,1 × camera.x`.
- `drawTrack(ctx, track, camera, view)` — **ne dessine que `[camera.x − halfWidth − 5, camera.x + halfWidth + 5]`** ; sol gris rempli jusqu'en bas, cratères décoratifs, plots lumineux tous les 10 m, cônes de volcan plus sombres, lave orange animée par `t`, ligne de départ, drapeau à damier à `xFinish`, mur.
- `drawCar(ctx, view, pxPerMeter)` — carrosserie `color`, deux bandes `accent`, vitre, pilote (tête ronde, casque `accent`), roues à rayons tournants, flammes si `turbo`.
- `drawStar(ctx, x, y, t)` — étoile jaune à 5 branches tournant lentement, halo.

- [ ] **Step 1 : Tests** : `computeBackingSize(1280, 800, 2)` → `{1920, 1200, 1.5}` ; `(800, 500, 1)` → `{800, 500, 1}` ; `Camera.update` converge devant la voiture ; `worldToScreen` inverse y ; `pxPerMeter(800) ≈ 57,1`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**, `npm run typecheck` 0 erreur.
- [ ] **Step 5 : Commit** `feat: rendu canvas de la piste, de la voiture et caméra`

---

### Task 9b : Pas de course, boucle de jeu, HUD : étape 1 jouable

**Files:**
- Create: `src/cars/state.ts`, `src/sim/simulate.ts`, `src/loop/accumulator.ts`, `src/ui/hud.ts`, `src/game.ts` ; Modify: `src/main.ts`
- Test: `tests/accumulator.test.ts`, `tests/simulate.test.ts`

**Interfaces:**
- `cars/state.ts` : `interface SafePoint { x; y; angle }` ; `interface CarState { id; name; color; accent; progress; safePoint: SafePoint; lastSafePointAt; lastRespawnLavaX: number | null; consecutiveRespawns; flippedSince: number | null; sideSince; stuckSince; stuckRefProgress; invulnerableUntil; turboUntil; finishedAt: number | null }` ; `newCarState(id, name, color, accent, start: SafePoint): CarState`.
- `loop/accumulator.ts` : `advanceAccumulator(acc, elapsed, dt, maxSteps): { steps: number; acc: number }` — `acc = min(acc + elapsed, maxSteps × dt)`, `steps = floor(acc / dt)`, `acc −= steps × dt`.
- `sim/simulate.ts` :
  ```ts
  export type SimEvent = { type: 'respawn'; t; reason: string; target: SafePoint } | { type: 'landing'; t; x; strength } | { type: 'star'; t; id } | { type: 'finish'; t }
  export interface RaceSim { track: Track; world: World; car: CarBody; state: CarState; time: number; events: SimEvent[]; airborneSince: number | null; cfg: Config }
  export function createRaceSim(track: Track, cfg: Config): RaceSim   // voiture id 'galahad', nom « Galahad », couleurs GALAHAD_*, x0 = track.xStart − 2, état avec safePoint = {x0, heightAt(x0), 0}
  export function stepRace(sim: RaceSim, throttle: boolean): void      // vide sim.events, puis : applyDrive → applyAirLevel(wheelsOnGround) → stepWorld → clampVelocities → state.progress = toM(chassis.x) → time += PHYSICS_DT ; 'landing' quand une roue retouche le sol après ≥ 0,3 s en l'air (tâches 10b/11/12 étendent ce pas)
  export function simulateRace(track, opts: { throttle: (t: number) => boolean; maxSeconds: number; cfg: Config }): { respawns: SimEvent[]; finishedAt: number | null; maxStuckSeconds: number; maxSpeed: number; starsTaken: SimEvent[]; progressAt: (t: number) => number }
  ```
- `ui/hud.ts` : `class Hud { constructor(root); setTime(seconds): void (mm:ss, très gros, en haut à droite); setFps(fps | null): void; showFinished(seconds, onAgain): void (calque avec `pointer-events: auto`, bouton « ENCORE » 120 px portant `data-no-pedal`); showError(message): void; hide(): void }`.
- `game.ts` : `class Game { constructor(canvas, hudRoot, opts: { seed; length; debug }); start(): void; get state(): 'racing' | 'finished' | 'error'; get time(): number; get seed(): number; progress(id: string): number }` — boucle rAF : `advanceAccumulator` → `steps × stepRace(sim, throttle.pressed)` → caméra → `renderer.draw` ; `visibilitychange` (visible) → `acc = 0` ; `resize` → `renderer.resize()` ; si `opts.debug` : **`window.__game = game`** (accesseurs vivants) et fps moyen sur 1 s dans le HUD. Garde-fou §10 : `try/catch` autour de `stepRace` ; à l'exception, recréer la voiture (`createCar` + `placeCar` au point sûr, réaffecter `sim.car`), compteur ; au 3e échec, `state = 'error'`, `hud.showError('Oups ! Recharge la page')`, boucle arrêtée.
- `main.ts` : `parseTrackOptions(location.search)` → `new Game(...)` → `start()`.

- [ ] **Step 1 : Tests** : `advanceAccumulator(0, 30, 1/60, 4)` → `steps 4, acc 0` ; `(0, 1/60, 1/60, 4)` → `steps 1` ; `(0.01, 0.005, 1/60, 4)` → `steps 0, acc 0.015` ; `simulate.test.ts` : seed 1, doigt posé 5 s → `progressAt(5) − progressAt(0) > 20 m`, `time ≈ 5` ; doigt levé 5 s → < 0,5 m.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**, `typecheck`, `build`.
- [ ] **Step 5 : Vérification visuelle** : `npm run dev -- --host --port 4173 --strictPort` puis script Playwright ponctuel (1280×800, DPR 2, `?seed=1&debug=1`) : capture `e2e/screenshots/etape1.png` après 3 s de doigt posé via CDP `Input.dispatchTouchEvent`. Regarder : voiture bleue à bandes rouges ≈ 125 px, sol gris, ciel, Terre, chrono lisible.
- [ ] **Step 6 : Commit et push** `feat: pas de course, boucle de jeu et HUD — étape 1 jouable` ; vérifier le déploiement ; donner au papa `https://i-dmk.github.io/I-DMK/?debug=1` pour lire le fps sur la tablette.

---

### Task 10a : Points sûrs et respawn (logique pure)

**Files:**
- Create: `src/cars/safepoint.ts`, `src/cars/respawn.ts` (réexporte `normalizeAngle` de `physics/angle.ts` ? **Non** : `cars/` ne doit pas importer `physics/`. Déplacer `normalizeAngle` dans `src/cars/angle.ts` et faire importer `physics/car.ts` depuis là.)
- Test: `tests/safepoint.test.ts`, `tests/respawn.test.ts`

**Interfaces:**
- `forbiddenZone(v: Volcano, cfg): [number, number]` = `[v.xElanStart + (1 − ELAN_SAFE_FRACTION) × (v.xRampStart − v.xElanStart), v.xReception)`.
- `isSafePointCandidate(obs: { x; t; bothWheelsOnGround; carAngle; groundSlope }, state, track, cfg): boolean` — `t − lastSafePointAt ≥ SAFE_POINT_INTERVAL`, deux roues au sol, `|carAngle| < 20°`, `|groundSlope| < SAFE_POINT_MAX_SLOPE`, x hors de toute `forbiddenZone`.
- `type RespawnReason = 'lava' | 'flipped' | 'side' | 'stuck' | 'underground' | 'speed'`.
- `updateRespawnTimers(state, obs: { t; angle; throttle; progress; y; groundY; speedMps; onLava }, cfg): RespawnReason | null` — `flippedSince` (|angle| > FLIP_ANGLE), `sideSince` (|angle| > SIDE_ANGLE), `stuckSince`/`stuckRefProgress` (throttle et `progress − stuckRefProgress < STUCK_DISTANCE` ; `stuckRefProgress` avance quand la voiture progresse) ; raison dès que la durée est dépassée ; `'lava'` immédiat ; `'underground'` si `y < groundY − 1` ; `'speed'` si `speedMps > SPEED_GUARD`. Timers remis à null quand la condition cesse.
- `chooseRespawnTarget(state, track, cfg): { point: SafePoint; lavaX: number | null; consecutive: number }` — `v = volcanoAhead(track, state.safePoint.x)` ; `lavaX = v?.xLava ?? null` ; **`consecutive = (lavaX !== null && lavaX === state.lastRespawnLavaX) ? state.consecutiveRespawns + 1 : 1`** ; si `consecutive ≥ 2` et `v` : cible `{ x: v.xReception + 3, y: heightAt, angle: 0 }`, `consecutive = 0`, `lavaX = null` ; sinon cible = `safePoint`.
- `applyRespawnToState(state, target, lavaX, consecutive, t, cfg): void` — `lastRespawnLavaX = lavaX`, `consecutiveRespawns = consecutive`, `invulnerableUntil = t + RESPAWN_INVULN`, timers à null, `stuckRefProgress = target.x`, `safePoint = target`, `lastSafePointAt = t`.

- [ ] **Step 1 : Tests** : zone interdite = `[elan + 25 %, réception)` ; candidat refusé (< 0,5 s, roue en l'air, pente 15°, dans la zone) / accepté (plat de réception, premier quart de l'élan) ; `normalizeAngle(3π) ≈ π`, `(−190°) ≈ 170°` ; flipped 0,9 s → null, 1,05 s → `'flipped'` ; side 80° 2,05 s ; stuck avec/sans throttle ; lava/underground/speed ; `chooseRespawnTarget` : 1er → point sûr, consecutive 1, lavaX du volcan ; **2e avec un point sûr différent mais même volcan devant → réception + 3, consecutive 0** ; volcan différent → consecutive 1.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: points sûrs et décision de respawn par volcan`

---

### Task 10b : Respawn branché dans le pas de course et simulations

**Files:**
- Modify: `src/sim/simulate.ts`, `src/game.ts` (étincelles en tâche 13)
- Test: `tests/respawn-sim.test.ts`

Dans `stepRace`, après la physique : observer (`wheelsOnGround`, `carAngle`, `slopeAt`, `sensorsTouching` → lave) ; `isSafePointCandidate` → `state.safePoint = {x, heightAt(x), slopeAt(x)}`, `lastSafePointAt = t` ; `updateRespawnTimers` → si raison : `chooseRespawnTarget`, `placeCar(car, x, x => heightAt(track, x), angle)`, `setCarInvulnerable(true)`, `applyRespawnToState`, `events.push({type:'respawn', …})`. Invulnérabilité levée quand `t ≥ invulnerableUntil` **et** `Query.collides(chassis, autres châssis)` vide (aucun autre châssis au plan A), au plus tard à `invulnerableUntil + RESPAWN_INVULN_MAX`.

- [ ] **Step 1 : Tests** (durée attendue 1–3 min)
  - doigt toujours posé, seeds 0..4 : `finishedAt` sera testé en 11 ; ici **zéro respawn de toute raison**, `maxStuckSeconds ≤ 2,1`, `progressAt(maxSeconds) ≥ xFinish` avec `maxSeconds = 240`.
  - voiture placée à vitesse nulle sur le flanc amont du premier volcan (x entre `xLip + descentRun + 0,5` et le rebord, angle = pente), doigt posé : respawn en ≤ 2,1 s.
  - voiture placée dans la lave du premier volcan deux fois de suite sans nouveau point sûr hors zone : 2e cible = `xReception + 3`.
  - motif 0,7 s posé / 0,3 s levé, seed 1, `maxSeconds 300` : `respawns.length ≤ 2 × track.volcanoes.length + 2`, **au plus 2 respawns par volcan** (grouper par `lavaX`), `maxStuckSeconds ≤ 2,1`, `progressAt(300) ≥ xFinish`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: respawn avec garde-fous dans le pas de course, simulations vérifiées`

---

### Task 11 : Ligne d'arrivée, chrono, écran ARRIVÉE provisoire

**Files:**
- Modify: `src/sim/simulate.ts`, `src/game.ts`, `src/ui/hud.ts`
- Test: `tests/finish.test.ts`

Dans `stepRace` : si `state.finishedAt === null` et `progress ≥ track.xFinish` → `finishedAt = time`, `events.push({type:'finish'})` ; après l'arrivée, `throttle` ignoré et `applyBrake(FINISH_BRAKE)` au lieu de `applyDrive`. `simulateRace` renvoie `finishedAt`. `game.ts` : à l'événement `finish`, état `finished`, chrono figé à `finishedAt`, puis après `FINISH_COAST_SECONDS` : `hud.showFinished(finishedAt, onAgain)` ; `onAgain` recharge la page avec la même `?seed` (et `?len`, `?debug`).

- [ ] **Step 1 : Test** : doigt posé seeds 0..4 → `finishedAt` défini et < 240 s ; `finishedAt` ≈ premier t où `progressAt(t) ≥ xFinish` (± 1 pas) ; à `finishedAt + 10`, la voiture est à < `xWall − 1` et vitesse < 0,5 m/s.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: ligne d'arrivée, chrono en temps simulé et écran ARRIVÉE provisoire`

---

### Task 12 : Étoiles et turbo

**Files:**
- Create: `src/cars/turbo.ts`, `src/cars/stars.ts`, `src/physics/stars.ts` ; Modify: `src/sim/simulate.ts`, `src/game.ts`, `src/render/renderer.ts`
- Test: `tests/turbo.test.ts`, `tests/stars-sim.test.ts`

**Interfaces:**
- `activateTurbo(state, t, cfg)` (`turboUntil = t + TURBO_SECONDS`) ; `turboFactor(state, t, cfg)` (`TURBO_FACTOR` si `t < turboUntil`, sinon 1).
- `interface StarState { id; takenAt: number | null }` ; `isStarActive(s, t, cfg)` ; `takeStar(s, t)`.
- `createStarBodies(world, stars, cfg): Matter.Body[]` (cercles capteurs r = 0,5 m, `label: 'star'`, `plugin: { starId }`, SENSOR/mask CAR) ; `syncStarBodies(bodies, states, t, cfg)` (`mask = 0` si inactive).
- `RaceSim` gagne `stars: StarState[]`, `starBodies` ; `stepRace` : `applyDrive(car, throttle, turboFactor(...))` ; après la physique, capteurs `'star'` actifs touchés → `takeStar`, `activateTurbo`, `events.push({type:'star'})` ; `syncStarBodies`. `simulateRace` renvoie `starsTaken` et `maxSpeed`.
- Rendu : `Scene.stars[].active` ; `CarView.turbo = turboFactor > 1` (flammes).

- [ ] **Step 1 : Tests purs** : `turboFactor` avant/pendant/après ; nouveau turbo remet 3 s ; `isStarActive` faux avant 5 s, vrai après.
- [ ] **Step 2 : Simulation** (seed 1, doigt posé) : ≥ 1 étoile prise avant 60 s ; `maxSpeed > 1,2 × V_MAX` ; l'étoile prise inactive 5 s puis active ; `finishedAt` défini ; **zéro respawn** sur toute la course (le turbo ne doit jamais envoyer dans la lave).
- [ ] **Step 3 : FAIL** → **Step 4 : Implémenter** → **Step 5 : PASS** → **Step 6 : Commit** `feat: étoiles ramassables avec réapparition et turbo avec flammes`

---

### Task 13 : Effets visuels

**Files:**
- Create: `src/render/effects.ts` ; Modify: `src/render/renderer.ts`, `src/game.ts`
- Test: `tests/effects.test.ts`

**Interfaces:** `class Effects { spawnSparks(x, y): void; spawnDust(x, y, strength): void; update(dt, track, camera): void; draw(ctx, camera, view): void; readonly count: number }` — particules (position, vitesse, vie), plafond 300 ; bulles de lave tirées toutes les 0,3 s sur chaque volcan visible ; fumée grise lente au-dessus de la lave. `game.ts` : `'respawn'` → étincelles ; `'landing'` → poussière.

- [ ] **Step 1 : Tests** : `spawnSparks` ajoute 20–40 particules ; `update(5)` les tue toutes ; plafond 300 après 50 `spawnSparks`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: effets de particules (étincelles, poussière, lave, fumée)`

---

### Task 14 : Tests Playwright tablette et captures

**Files:**
- Create: `playwright.config.ts`, `e2e/race.spec.ts`, `e2e/helpers.ts` ; Modify: `package.json`

**Interfaces:**
- `playwright.config.ts` : `webServer: { command: 'npm run dev -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true }`, `use: { baseURL: 'http://localhost:4173' }`, projet `tablet` : `viewport {1280, 800}`, `deviceScaleFactor: 2`, `hasTouch: true`, `isMobile: true` ; navigateur via `PLAYWRIGHT_BROWSERS_PATH` (déjà `/opt/pw-browsers`), pas d'`executablePath` ; `timeout: 120_000`.
- `e2e/helpers.ts` : `holdFinger(page, seconds)` (CDP `Input.dispatchTouchEvent` touchStart au centre, attente, touchEnd) ; `gameState(page)` lit `window.__game`. **Toutes les navigations incluent `&debug=1`.**

- [ ] **Step 1 : Tests** : charge `/?seed=1&debug=1` : `scrollWidth === 1280`, `state === 'racing'` ; doigt posé 3 s : `progress` après − avant > 5 m ; sans doigt 2 s : delta < 0,5 m ; `/?seed=1&len=300&debug=1` doigt posé jusqu'à 90 s max (`test.setTimeout(150_000)`) : `state === 'finished'`, calque ARRIVÉE visible ; captures `e2e/screenshots/course.png` (après 3 s) et `arrivee.png`.
- [ ] **Step 2 : `npm run e2e`** → PASS ; regarder les captures.
- [ ] **Step 3 : Commit et push** `test: Playwright tablette (1280×800 DPR 2) et captures d'écran` ; envoyer les captures au papa avec l'adresse déployée.

---

### Task 15 : Relecture de branche et remise au papa

- [ ] **Step 1 :** `npm run typecheck && npm test && npm run build && npm run e2e` verts ; déploiement GitHub Pages vert.
- [ ] **Step 2 :** Relecture adversariale de la branche entière par un relecteur frais (bugs, écarts au spec §5, §6, §8, §10) ; corrections ; re-tests.
- [ ] **Step 3 :** Message au papa : adresse, ce qu'il faut regarder avec Galahad (fps avec `?debug=1`, confort du doigt, sauts des volcans, durée avec `?len=`), performance (si le fps < 40 sur la tablette : fenêtre glissante de corps de sol ±150 m, à faire en calibration), et ce qui vient au plan B.
