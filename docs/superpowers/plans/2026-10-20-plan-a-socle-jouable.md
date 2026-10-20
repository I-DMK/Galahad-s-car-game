# Plan A — Socle jouable de la Course Lunaire de Galahad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une voiture bleue et rouge pilotée à un doigt sur une piste lunaire générée, avec sauts, volcans, respawn, ligne d'arrivée, chrono, étoiles turbo, déployée sur GitHub Pages et vérifiable sur la tablette.

**Architecture:** Site statique Vite + TypeScript. La logique pure (piste, points sûrs, respawn, turbo) vit dans `src/track/` et `src/cars/` sans dépendance à Matter.js ni au DOM. `src/physics/` construit le monde Matter.js à partir de la piste, `src/render/` dessine sur un canvas 2D, `src/game.ts` orchestre une boucle à pas fixe. Une seule voiture (Galahad) dans ce plan ; la structure (filtres de collision, état par voiture) est prête pour les 4 copains du plan B.

**Tech Stack:** TypeScript 5.7 (strict), Vite 8, matter-js 0.20.0 (+ @types/matter-js 0.20.2), Vitest 5, @playwright/test 1.56.1 (Chromium pré-installé dans `/opt/pw-browsers`), GitHub Actions + GitHub Pages. Node 22.

**Spec:** `docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md` (§3 constantes, §4 architecture, §5 piste, §6 voiture/physique, §8 entrée/rendu, §10 robustesse, §11 tests, §12 déploiement, §13 étapes 1 à 3).

## Global Constraints

- Mètres et secondes dans la logique ; Matter.js en pixels ; `PIXELS_PER_METER = 40`. Axe y du monde vers le **haut** (hauteur de piste), axe y Matter.js vers le **bas** : `py = -y × 40`.
- Pas physique fixe `PHYSICS_DT = 1/60 s`, au plus `MAX_STEPS_PER_FRAME = 4` pas par image. Chrono en temps simulé (compte de pas).
- Matter.js utilisé sans `Render` ni `Runner`. Vitesses Matter.js en px par pas de 1/60 s (matter-js 0.20 normalise à `Body._baseDelta = 1000/60`).
- Aucun déplacement de corps dans un callback de collision : détection par scrutation de `engine.pairs.list` après `Engine.update`, application entre deux pas.
- Aucun fichier image ni audio ; tout est dessiné par code.
- `track/`, `cars/` n'importent ni `matter-js` ni le DOM (test de dépendance, tâche 2).
- Base Vite = `process.env.VITE_BASE ?? '/'` ; en CI `VITE_BASE=/I-DMK/`. Déploiement sur push de la branche `ccr-5b6fabc4-n96ofo`.
- Paramètres d'URL : `?seed=` (défaut 1), `?len=` (mètres, défaut longueur calculée), `?debug=1` (compteur fps + `window.__game`).
- Tout texte utilisateur en français, mots courts, chiffres en gros. Aucun bouton pendant la course.
- Commits en français, préfixés `feat:`, `test:`, `chore:`, `docs:`. Pas d'identifiant de modèle dans les commits.

## Review Focus

Entrées ou situations que le spec implique mais qu'aucune tâche ne testait avant cette liste ; chaque ligne a reçu son test dans la tâche indiquée.

1. **`?len=` absurde (0, négatif, NaN, 50 m, 50 000 m).** Attendu : la longueur est bornée à [300 m ; 6 000 m] et sinon remplacée par la valeur par défaut ; la piste contient toujours un départ, une arrivée et aucun volcan dans les zones interdites. → tâche 4 (`parseTrackOptions`) et tâche 4 (contraintes sur 50 graines × 3 longueurs).
2. **Le doigt est posé avant le chargement de la page ou pendant qu'elle est en arrière-plan.** Attendu : au retour, l'accélérateur est relâché tant qu'aucun nouveau `pointerdown` n'arrive ; jamais de voiture qui part toute seule. → tâche 8 (`visibilitychange`, `blur`, `pointercancel`).
3. **La voiture atterrit sur le flanc gauche du cône du volcan (côté lave) ou cale à 90° contre lui.** Attendu : respawn par blocage en 2 s ou par flanc en 2 s, jamais plus. → tâche 10 (simulation : voiture posée contre le flanc à vitesse nulle, doigt posé → respawn ≤ 2,1 s).
4. **Respawn alors que le point sûr n'a pas changé (deuxième chute au même volcan).** Attendu : replacement sur le plat de réception après le volcan, et la course continue. → tâche 10 (`chooseRespawnTarget`) et simulation.
5. **Fenêtre redimensionnée ou DPR 2 avec largeur 1280 CSS.** Attendu : backing store ≤ 1920 px de large, HUD lisible, pas de défilement de page. → tâche 9 (`computeBackingSize`) et tâche 14 (Playwright à 1280×800 DPR 2 : `document.documentElement.scrollWidth === 1280`).

---

## Structure des fichiers

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html, .gitignore
.github/workflows/deploy.yml
src/main.ts                 lit l'URL, crée Game, démarre
src/config.ts               toutes les constantes (§3 du spec + dérivées)
src/game.ts                 boucle à pas fixe, états racing/finished, window.__game
src/track/rng.ts            mulberry32
src/track/ballistics.ts     jumpRange, runUpDistance
src/track/types.ts          Track, Slice, Volcano, Star, TrackPoint
src/track/slices.ts         profils de hauteur de chaque type de tranche
src/track/generate.ts       generateTrack, parseTrackOptions
src/track/query.ts          heightAt, slopeAt, volcanoAhead, inForbiddenZone
src/track/stars.ts          placeStars
src/physics/units.ts        toPx, toM, worldToPhys, physToWorld, speedMps
src/physics/world.ts        createWorld : engine, sol, capteurs lave, mur
src/physics/car.ts          createCar, applyDrive, applyAirLevel, wheelsOnGround, placeCar
src/physics/sensors.ts      sensorsTouching(engine, car)
src/physics/stars.ts        createStarBodies, syncStarBodies
src/sim/simulate.ts         simulateRace : le pas de jeu partagé par game.ts et les tests Matter.js
src/cars/state.ts           CarState, SafePoint, newCarState
src/cars/safepoint.ts       isSafePointCandidate, forbiddenZone
src/cars/respawn.ts         normalizeAngle, updateRespawnTimers, chooseRespawnTarget
src/cars/turbo.ts           activateTurbo, turboFactor
src/cars/stars.ts           StarState, isStarActive, takeStar
src/input/throttle.ts       Throttle (pointer events sur window)
src/render/camera.ts        Camera, computeBackingSize
src/render/background.ts    ciel + Terre pré-rendus hors écran
src/render/track.ts         sol, volcans, lave, ligne d'arrivée, étoiles
src/render/car.ts           carrosserie, pilote, roues, flammes
src/render/effects.ts       particules : étincelles, poussière, bulles, fumée
src/render/renderer.ts      orchestre le dessin d'une Scene
src/ui/hud.ts               chrono, fps (debug), écran ARRIVÉE provisoire
tests/*.test.ts             Vitest (pure + Matter.js headless)
e2e/*.spec.ts               Playwright
```

---

### Task 1 : Squelette du projet, scripts, CI et déploiement GitHub Pages

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/config.ts`, `.gitignore`, `.github/workflows/deploy.yml`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `CONFIG` (objet `as const`) dans `src/config.ts`, utilisé par toutes les tâches. Scripts npm : `dev`, `build`, `preview`, `test` (vitest run), `test:watch`, `typecheck` (tsc --noEmit), `e2e` (playwright test).

- [ ] **Step 1 : Initialiser le projet et les dépendances**

```bash
cd /home/user/I-DMK
npm init -y
npm install matter-js@0.20.0
npm install -D typescript@5.7 vite@8 vitest@5 @types/matter-js@0.20.2 @playwright/test@1.56.1
```

`.gitignore` : `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `e2e/screenshots/`.

- [ ] **Step 2 : Écrire `src/config.ts`** (valeurs du spec §3 et dérivées ; `as const`)

```ts
const DEG = Math.PI / 180;
export const CONFIG = {
  PIXELS_PER_METER: 40,
  GRAVITY: 4.9,                 // m/s²
  V_MAX: 14,                    // m/s
  V_CRUISE: 0.8 * 14,
  V_JUMP: 10,                   // m/s au sommet de la rampe, vitesse de calibration des volcans
  TURBO_FACTOR: 1.5,
  TURBO_SECONDS: 3,
  STAR_RESPAWN_SECONDS: 5,
  STAR_EXCLUSION_BEFORE_LAVA: 3 * 14 * 1.5,   // 63 m
  RAMP_ANGLE: 22 * DEG,
  RAMP_LENGTH: 6,               // m le long de la pente
  MAX_SLOPE: 27 * DEG,          // RAMP_ANGLE + 5°
  CAR_LENGTH: 2.2, CAR_HEIGHT: 0.7, WHEEL_BASE: 1.5, WHEEL_RADIUS: 0.45,
  CHASSIS_MASS: 60, WHEEL_MASS: 40,
  SUSPENSION_STIFFNESS: 0.3, SUSPENSION_DAMPING: 0.1, SUSPENSION_ANCHOR_SPREAD: 0.3,
  WHEEL_FRICTION: 1.0, CHASSIS_FRICTION: 0.3, RESTITUTION: 0.05,
  DRIVE_ACCEL: 4,               // m/s² moyenne mesurée (calibrée par test, tâche 7)
  WHEEL_SPINUP: 0.02,           // rad/pas par pas, réglé pour atteindre DRIVE_ACCEL
  ENGINE_BRAKE: 0.985,          // facteur par pas sur la vitesse angulaire des roues, doigt levé
  AIR_LEVEL_K: 0.002, AIR_LEVEL_D: 0.05,
  TRACK_POINT_SPACING: 0.2,
  RACE_TARGET_SECONDS: 150,
  TRACK_MIN_LENGTH: 300, TRACK_MAX_LENGTH: 6000,
  START_LENGTH: 5 * 1.5 * 2.2 + 10,     // 26,5 m
  FINISH_PLAT_BEFORE: 20, AFTER_FINISH: 60,
  LAVA_WIDTH: 3, RIM_HEIGHT: 1.2, CRATER_DEPTH: 1,
  PHYSICS_DT: 1 / 60, MAX_STEPS_PER_FRAME: 4,
  SAFE_POINT_INTERVAL: 0.5, SAFE_POINT_MAX_SLOPE: 10 * DEG,
  RESPAWN_INVULN: 0.5, RESPAWN_INVULN_MAX: 2,
  FLIP_ANGLE: 110 * DEG, FLIP_SECONDS: 1, SIDE_ANGLE: 70 * DEG, SIDE_SECONDS: 2,
  STUCK_SECONDS: 2, STUCK_DISTANCE: 1,
  SPEED_GUARD: 3 * 14 * 1.5,    // 63 m/s
  FINISH_COAST_SECONDS: 1.5,
  BACKING_MAX_WIDTH: 1920,
  CAMERA_LEAD_SECONDS: 0.6, CAMERA_SMOOTHING: 0.08, VISIBLE_HEIGHT_M: 22,
} as const;
export type Config = typeof CONFIG;
```

- [ ] **Step 3 : `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`**

`vite.config.ts` : `base: process.env.VITE_BASE ?? '/'`, section `test` Vitest (`environment: 'node'`, `include: ['tests/**/*.test.ts']`). `tsconfig.json` : `strict`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `types: ["vite/client"]`, `include: ["src", "tests", "e2e"]`. `index.html` : `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`, `<canvas id="game">`, `<div id="hud">`, style `html,body{margin:0;height:100%;overflow:hidden;background:#000;touch-action:none;overscroll-behavior:none}`, `canvas{display:block;width:100vw;height:100vh}`. `src/main.ts` : affiche pour l'instant « Course Lunaire » sur le canvas (remplacé en tâche 9).

- [ ] **Step 4 : Test de fumée**

```ts
// tests/smoke.test.ts
import { CONFIG } from '../src/config';
test('config: valeurs pivot du spec', () => {
  expect(CONFIG.PIXELS_PER_METER).toBe(40);
  expect(CONFIG.GRAVITY).toBe(4.9);
  expect(CONFIG.STAR_EXCLUSION_BEFORE_LAVA).toBe(63);
  expect(CONFIG.START_LENGTH).toBeGreaterThanOrEqual(5 * 1.5 * CONFIG.CAR_LENGTH + 10);
});
```

Run : `npm test` → PASS. `npm run typecheck` → 0 erreur. `VITE_BASE=/I-DMK/ npm run build` → `dist/index.html` référence `/I-DMK/assets/...`.

- [ ] **Step 5 : Workflow de déploiement `.github/workflows/deploy.yml`**

Déclencheurs : `push` sur `ccr-5b6fabc4-n96ofo` et `workflow_dispatch`. `permissions: contents: read, pages: write, id-token: write`. `concurrency: group: pages, cancel-in-progress: true`. Job `build` (ubuntu-latest) : `actions/checkout@v4`, `actions/setup-node@v4` (node 22, cache npm), `npm ci`, `npm run typecheck`, `npm test`, `npm run build` avec `VITE_BASE: /I-DMK/`, `actions/configure-pages@v5` avec `enablement: true`, `actions/upload-pages-artifact@v3` (`path: dist`). Job `deploy` : `needs: build`, `environment: github-pages`, `actions/deploy-pages@v4`.

- [ ] **Step 6 : Commit et push**

```bash
git add -A && git commit -m "chore: squelette Vite/TypeScript, tests, CI et déploiement GitHub Pages"
git push -u origin ccr-5b6fabc4-n96ofo
```

Vérifier ensuite via l'API GitHub que le workflow a tourné ; s'il échoue sur l'activation de Pages, noter pour le papa l'étape Settings → Pages → Source « GitHub Actions ».

---

### Task 2 : Unités, balistique, RNG et garde de dépendances

**Files:**
- Create: `src/physics/units.ts`, `src/track/ballistics.ts`, `src/track/rng.ts`
- Test: `tests/units.test.ts`, `tests/ballistics.test.ts`, `tests/rng.test.ts`, `tests/deps.test.ts`

**Interfaces:**
- Produces:
  - `toPx(m: number): number`, `toM(px: number): number`, `worldToPhys(p: {x,y}): {x,y}` (y inversé), `physToWorld(p): {x,y}`, `speedMps(v: {x,y}): number` (norme de la vitesse Matter.js px/pas → m/s : `× 60 / 40`), `mpsToPxPerStep(v: number): number`.
  - `jumpRange(v0: number, g: number, angle: number, drop = 0): number` — portée horizontale d'un projectile lancé à `v0` m/s, angle `angle`, atterrissant `drop` m plus bas (drop ≥ 0).
  - `runUpDistance(vTarget: number, accel: number): number` = `vTarget² / (2·accel)`.
  - `mulberry32(seed: number): () => number` (uniforme dans [0,1)), `pickWeighted<T>(rng, items: {item: T, weight: number}[]): T`.

- [ ] **Step 1 : Tests**

```ts
// ballistics.test.ts
test('jumpRange plat = v² sin(2θ)/g', () => expect(jumpRange(10, 4.9, 22*DEG)).toBeCloseTo(100*Math.sin(44*DEG)/4.9, 3));
test('jumpRange avec chute est plus long', () => expect(jumpRange(10, 4.9, 22*DEG, 2.25)).toBeGreaterThan(jumpRange(10, 4.9, 22*DEG)));
test('runUpDistance', () => expect(runUpDistance(11, 4)).toBeCloseTo(15.125, 3));
// units.test.ts
test('worldToPhys inverse y et met à l échelle', () => expect(worldToPhys({x: 1, y: 2})).toEqual({x: 40, y: -80}));
test('speedMps', () => expect(speedMps({x: 40/60, y: 0})).toBeCloseTo(1));
// rng.test.ts
test('mulberry32 déterministe', () => { const a = mulberry32(7), b = mulberry32(7); expect([a(),a(),a()]).toEqual([b(),b(),b()]); });
test('mulberry32 dans [0,1)', ...1000 tirages);
// deps.test.ts : lit récursivement src/track et src/cars, échoue si un fichier contient `from 'matter-js'` ou `document.` ou `window.`
```

- [ ] **Step 2 : Run → FAIL (modules absents)**
- [ ] **Step 3 : Implémenter** (formule de `jumpRange` avec chute : `t = (v sinθ + √(v² sin²θ + 2 g drop)) / g`, portée `= v cosθ · t`).
- [ ] **Step 4 : Run → PASS**
- [ ] **Step 5 : Commit** `feat: unités, balistique, RNG déterministe et garde de dépendances`

---

### Task 3 : Profils des tranches de piste

**Files:**
- Create: `src/track/types.ts`, `src/track/slices.ts`
- Test: `tests/slices.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export interface TrackPoint { x: number; y: number }          // mètres, y vers le haut
  export type SliceType = 'plat' | 'bosses' | 'rampe-saut' | 'double-bosse' | 'rampe-volcan';
  export interface Slice { type: SliceType; xStart: number; xEnd: number }
  export interface Volcano { xElanStart: number; xRampStart: number; xLip: number; xLava: number; lavaWidth: number; rimY: number; xReception: number; xEnd: number }
  export interface Star { id: number; x: number; y: number }
  export interface Track { seed: number; targetLength: number; length: number; points: TrackPoint[]; slices: Slice[]; volcanoes: Volcano[]; stars: Star[]; xStart: number; xFinish: number; xWall: number }
  ```
- Produces (`slices.ts`): `interface SliceProfile { heights: number[]; length: number; volcano?: Omit<Volcano, 'xElanStart'|'xRampStart'|'xLip'|'xLava'|'xReception'|'xEnd'> & { dxRampStart: number; dxLip: number; dxLava: number; dxReception: number } }` ; builders `plat(rng, cfg, length?)`, `bosses(rng, cfg)`, `rampeSaut(rng, cfg)`, `doubleBosse(rng, cfg)`, `rampeVolcan(cfg)` ; `volcanoGeometry(cfg)` retourne `{ lElan, rampRun, lipY, descentRun, ascentRun, valleyRun, dxLava, receptionEnd }`. Chaque profil commence et finit à hauteur 0, points espacés de `TRACK_POINT_SPACING`, premier point exclu (il coïncide avec le dernier du précédent).

Géométrie de `rampe-volcan` (de gauche à droite, en mètres) :
1. Plat d'élan : `lElan = runUpDistance(√(V_JUMP² + 2·GRAVITY·lipY), DRIVE_ACCEL) × 1,2`.
2. Rampe : montée à `RAMP_ANGLE` sur `RAMP_LENGTH` le long de la pente → `lipY = RAMP_LENGTH·sin`, `rampRun = RAMP_LENGTH·cos`.
3. Descente à `MAX_SLOPE` jusqu'à 0, plat de vallée de longueur `valleyRun`, montée à `MAX_SLOPE` jusqu'à `RIM_HEIGHT`, cratère de largeur `LAVA_WIDTH` creusé de `CRATER_DEPTH`, descente à `MAX_SLOPE` jusqu'à 0.
4. `dxLava` (centre de la lave, mesuré depuis le sommet de rampe) = `0,7 × jumpRange(V_JUMP, GRAVITY, RAMP_ANGLE, lipY − RIM_HEIGHT)`. `valleyRun` est ce qui reste pour que la lave tombe à `dxLava` ; **doit être ≥ 0** (sinon `rampeVolcan` lance une erreur : constantes incohérentes).
5. Plat de réception jusqu'à `dxReception + max(10, 1,2 × jumpRange(V_MAX × TURBO_FACTOR, GRAVITY, RAMP_ANGLE, lipY) − (dxReception − dxLip))`, donc la fin de tranche est au moins à 1,2 portée turbo du sommet de rampe.

Autres tranches : `plat` 20–40 m (ou longueur imposée) ; `bosses` 30–60 m, somme de 2 sinus d'amplitude 0,6–1,2 m et longueur d'onde 8–14 m, pente vérifiée ≤ `MAX_SLOPE` (sinon amplitude réduite) ; `rampe-saut` : rampe `RAMP_LENGTH` à `RAMP_ANGLE`, cassure (chute verticale de 0,4 m dans le profil, tolérée comme seule exception à la pente max, longueur 0,2 m), puis descente douce à 10° jusqu'à 0, plus 8 m de plat ; `double-bosse` : deux bosses en demi-sinus de 1 m sur 6 m, séparées de 4 m, puis 6 m de plat.

- [ ] **Step 1 : Tests**

```ts
test.each(['plat','bosses','rampe-saut','double-bosse','rampe-volcan'])('%s commence et finit à 0, espacement 0,2', ...);
test('pente ≤ MAX_SLOPE partout sauf la cassure de rampe-saut (≤ 1 point)', ...);
test('rampe-volcan : lave à 0,7 portée du sommet, valleyRun ≥ 0, rim < lipY', () => { const g = volcanoGeometry(CONFIG); expect(g.valleyRun).toBeGreaterThanOrEqual(0); expect(CONFIG.RIM_HEIGHT).toBeLessThan(g.lipY); });
test('rampe-volcan : fin ≥ lip + 1,2 × portée turbo', ...);
test('builders déterministes pour un même rng', ...);
```

- [ ] **Step 2 : Run → FAIL**
- [ ] **Step 3 : Implémenter `slices.ts` et `types.ts`**
- [ ] **Step 4 : Run → PASS**
- [ ] **Step 5 : Commit** `feat: profils des tranches de piste et géométrie des volcans`

---

### Task 4 : Assemblage de la piste, contraintes et requêtes

**Files:**
- Create: `src/track/generate.ts`, `src/track/query.ts`
- Test: `tests/generate.test.ts`, `tests/query.test.ts`

**Interfaces:**
- Produces:
  - `generateTrack(seed: number, targetLength: number, cfg: Config): Track` (sans étoiles : `stars: []`, remplies en tâche 5).
  - `defaultTrackLength(cfg): number` = `V_CRUISE × RACE_TARGET_SECONDS`.
  - `parseTrackOptions(search: string, cfg): { seed: number; length: number; debug: boolean }` — `seed` entier ≥ 0 (défaut 1), `length` borné à `[TRACK_MIN_LENGTH, TRACK_MAX_LENGTH]`, NaN/absent → `defaultTrackLength`.
  - `heightAt(track, x): number` (interpolation linéaire, clampée aux bornes), `slopeAt(track, x): number` (radians, signe : montée positive), `sliceAt(track, x): Slice | undefined`, `volcanoAhead(track, x): Volcano | undefined` (premier volcan dont `xLava > x`), `nearestVolcanoZone(track, x): Volcano | undefined` (volcan dont `[xElanStart, xEnd)` contient x).

Algorithme d'assemblage : `plat` de départ de longueur `START_LENGTH` (`xStart` = `START_LENGTH − 5 m`, ligne de départ dessinée là, voiture placée à 3 m) ; puis tirage pondéré `{plat 2, bosses 3, rampe-saut 2, double-bosse 2, rampe-volcan 3}` avec les règles : pas de `rampe-volcan` si `x < 0,15 × target` ou si `x + longueur de volcan > 0,90 × target` ou si la tranche précédente est `rampe-volcan` ; on arrête de tirer quand `x ≥ target − FINISH_PLAT_BEFORE − AFTER_FINISH − 40` ; puis `plat` jusqu'à `xFinish = target − AFTER_FINISH`, `xWall = target`, `length = target` (donc longueur exacte ; le ±5 % du spec est respecté par construction, le test le vérifie quand même).

- [ ] **Step 1 : Tests** (sur `seeds = 0..49` × `lengths = [300, 1680, 6000]`)

```ts
test('déterministe : même graine → mêmes points', ...);
test('longueur dans ±5 % de la cible et points espacés de 0,2', ...);
test('pente ≤ MAX_SLOPE sauf cassures de rampe-saut', ...);
test('aucune lave dans [0, 15 %) ni [90 %, 100 %]', ...);
test('entre deux rampe-volcan, au moins une tranche d un autre type', ...);
test('arrivée sur un plat : hauteur 0 sur [xFinish − 20, xWall]', ...);
test('départ : START_LENGTH de plat', ...);
test('parseTrackOptions : "?seed=5&len=900" → {5, 900}; "?len=50" → 300; "?len=abc" → défaut; "?len=-1" → 300; "?len=99999" → 6000; "?debug=1" → debug true', ...);
test('heightAt/slopeAt : sur une rampe, slopeAt ≈ RAMP_ANGLE ; hors bornes clampé', ...);
test('volcanoAhead et nearestVolcanoZone', ...);
```

- [ ] **Step 2 : Run → FAIL**
- [ ] **Step 3 : Implémenter**
- [ ] **Step 4 : Run → PASS**
- [ ] **Step 5 : Commit** `feat: génération déterministe de la piste et contraintes des volcans`

---

### Task 5 : Placement des étoiles

**Files:**
- Create: `src/track/stars.ts`
- Modify: `src/track/generate.ts` (appelle `placeStars` en fin de génération)
- Test: `tests/stars.test.ts`

**Interfaces:**
- Produces: `placeStars(track: Track, rng: () => number, cfg: Config): Star[]` — candidats : toutes les 12–20 m sur les tranches `plat` (hors départ avant `xStart`) et sur les plats de réception, plus 1 m avant chaque `rampe-saut` ; exclusion si `x ∈ [xLava − STAR_EXCLUSION_BEFORE_LAVA, xLava]` pour un volcan, ou `x ≥ xFinish − FINISH_PLAT_BEFORE` ; `y = heightAt(x) + 0,6` ; ids croissants.

- [ ] **Step 1 : Tests** (50 graines) : aucune étoile à moins de 63 m avant une lave ; aucune sur le plat final ; au moins 5 étoiles pour 1 680 m ; `y − heightAt(x) ≈ 0,6` ; ids uniques.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: placement des étoiles à distance de sécurité des volcans`

---

### Task 6 : Monde physique : gravité, sol, lave, mur

**Files:**
- Create: `src/physics/world.ts`, `src/physics/sensors.ts`
- Test: `tests/world.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const CAT = { GROUND: 0x0001, CAR: 0x0002, SENSOR: 0x0004 } as const;
  export interface World { engine: Matter.Engine; ground: Matter.Body[]; lava: Matter.Body[]; wall: Matter.Body; floorY: number }
  export function createWorld(track: Track, cfg: Config): World
  export function stepWorld(world: World, cfg: Config): void   // Engine.update(engine, 1000/60)
  export function sensorsTouching(engine: Matter.Engine, bodies: Matter.Body[]): Matter.Body[] // capteurs en contact actif avec l'un des bodies (scrute engine.pairs.list, pairs actives, isSensor)
  ```
- Gravité : `engine.gravity.y = GRAVITY × PIXELS_PER_METER / 1000` (scale Matter par défaut 0,001 ⇒ 1 unité = 1 000 px/s²).
- Sol : un corps statique par segment `[p_i, p_{i+1}]`, trapèze `(x_i, y_i), (x_{i+1} + 1 px, y_{i+1}), (x_{i+1} + 1 px, floorY), (x_i, floorY)` en px (`Bodies.fromVertices`, convexe), `floorY = −min(y)×40 + 400 px`, `friction = 1`, `collisionFilter {category: GROUND, mask: CAR}`, `label: 'ground'`.
- Lave : par volcan, rectangle capteur `isSensor: true`, largeur `lavaWidth`, depuis 0,2 m au-dessus de la surface de lave (`rimY − CRATER_DEPTH + 0,2`) jusqu'à `floorY`, `collisionFilter {category: SENSOR, mask: CAR}`, `label: 'lava'`, `plugin: { volcano }`.
- Mur : rectangle statique à `xWall`, hauteur 10 m, catégorie GROUND, `label: 'wall'`.
- Les corps statiques sont ajoutés en une fois (`Composite.add`), et `engine.enableSleeping = false`.

- [ ] **Step 1 : Tests**

```ts
test('gravité calibrée : un corps lâché tombe 2,45 m ± 10 % en 60 pas', ...); // corps dynamique seul, frictionAir 0
test('sol : un segment par point, pas de trou : une roue (cercle r=0,45 m, frictionAir 0) lâchée tous les 1 m sur la piste seed 1 depuis 3 m de haut repose à ≤ 0,05 m du sol après 300 pas (y_centre − heightAt ≈ WHEEL_RADIUS ± 0,05)', ...);
test('tunneling : roue lancée vers le bas à SPEED_GUARD m/s sur chaque segment ne passe jamais sous le sol (y_centre > heightAt − 0,1)', ...);
test('lave : un cercle placé dans le cratère est rapporté par sensorsTouching ; placé sur le plat de réception, non', ...);
test('mur : un corps lancé vers xWall est arrêté avant xWall + 1 m', ...);
```

- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: monde Matter.js, sol en trapèzes, capteurs de lave et mur`

---

### Task 7 : Voiture physique, conduite, calibration et saut des volcans

**Files:**
- Create: `src/physics/car.ts`
- Test: `tests/car.test.ts`, `tests/jump.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CarBody { id: string; index: number; chassis: Matter.Body; wheels: [Matter.Body, Matter.Body]; constraints: Matter.Constraint[]; composite: Matter.Composite; parts: Matter.Body[] }
  export function createCar(world: World, id: string, index: number, x: number, cfg: Config): CarBody   // posé sur la piste à x (hauteur via heightAt + WHEEL_RADIUS), angle 0
  export function placeCar(car: CarBody, x: number, groundY: number, angle: number, cfg: Config): void  // téléporte châssis et roues, vitesses nulles, roues à la hauteur du sol à leur abscisse
  export function applyDrive(car: CarBody, throttle: boolean, speedFactor: number, cfg: Config): void   // par pas : si throttle, omega += WHEEL_SPINUP jusqu'à mpsToPxPerStep(V_MAX×factor)/WHEEL_RADIUS_px ; sinon omega ×= ENGINE_BRAKE (jamais négatif vers l'arrière)
  export function wheelsOnGround(engine, car): [boolean, boolean]   // contact actif avec un corps non capteur
  export function applyAirLevel(car: CarBody, onGround: [boolean, boolean], cfg: Config): void   // si aucune roue au sol : chassis.torque = −angle·K − angularVelocity·D (angle normalisé)
  export function setCarInvulnerable(car: CarBody, on: boolean): void  // mask = GROUND|SENSOR si on, sinon GROUND|CAR|SENSOR
  export function clampVelocities(car: CarBody, cfg: Config): void   // par pas, après stepWorld : composante verticale de chaque partie plafonnée à ±(V_MAX × TURBO_FACTOR × 1,5) m/s (spec §5, anti-tunneling)
  export function carSpeedMps(car): number ; export function carAngle(car): number (normalisé)
  ```
- Construction : châssis `Bodies.rectangle` (`chamfer: {radius: 0.2 m}`), masse `CHASSIS_MASS` ; roues `Bodies.circle` masse `WHEEL_MASS`, `friction: WHEEL_FRICTION` ; par roue **deux** contraintes du châssis (points `±SUSPENSION_ANCHOR_SPREAD` autour de l'axe, à mi-hauteur du châssis) vers le centre de roue, `stiffness: SUSPENSION_STIFFNESS`, `damping: SUSPENSION_DAMPING`, `length` = distance au repos ; `collisionFilter.group = −(index + 1)` sur toutes les parties, `category: CAT.CAR`, `mask: GROUND|CAR|SENSOR` ; labels `chassis`, `wheel`.

- [ ] **Step 1 : Tests**

```ts
// car.test.ts (piste : generateTrack(1, 1680) ; voiture à xStart)
test('repos : après 120 pas sans gaz, la voiture ne bouge pas (|v| < 0,05 m/s) et reste droite', ...);
test('calibration : plein gaz sur plat, accélération moyenne sur les 2 premières secondes dans [0,75; 1,25] × DRIVE_ACCEL', ...); // sinon ajuster WHEEL_SPINUP dans config.ts, puis DRIVE_ACCEL si besoin, et le noter dans le commit
test('vitesse max : plein gaz 10 s sur une piste 100 % plat (generateTrack avec slices forcées plat), vitesse dans [0,9; 1,05] × V_MAX', ...);
test('doigt levé : la voiture ralentit sans reculer', ...);
test('en l air : un châssis lâché incliné à 40° sans sol revient sous 10° en moins de 90 pas', ...);
test('invulnérable : mask exclut CAT.CAR, puis le rétablit', ...);
test('clampVelocities : une partie à −80 m/s vertical est ramenée à −31,5 m/s, l horizontale inchangée', ...);
// jump.test.ts (pour chaque volcan des pistes seeds 0..9)
test('depuis l arrêt au début du plat d élan, plein gaz : jamais de contact lave, et atterrit sur le plat de réception (x dans [xReception, xEnd], deux roues au sol) avant 12 s', ...);
test('avec turbo permanent (factor TURBO_FACTOR) : atterrit aussi dans [xReception, xEnd]', ...);
test('à mi-plat d élan depuis l arrêt (le pire point sûr autorisé, 25 % de lElan) : franchit aussi la lave', ...);
```

- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** (la boucle de test : `stepWorld` puis `applyDrive`/`applyAirLevel`, lecture `sensorsTouching` pour la lave) → **Step 4 : PASS** (si le test de saut échoue, ajuster d'abord `V_JUMP` ↑ ou la marge 0,7 ↓ dans `slices.ts`, puis relancer ; documenter la valeur retenue)
- [ ] **Step 5 : Commit** `feat: voiture Matter.js, conduite à un doigt, calibration et sauts de volcans vérifiés`

---

### Task 8 : Accélérateur tactile

**Files:**
- Create: `src/input/throttle.ts`
- Test: `tests/throttle.test.ts` (Vitest avec `environment: 'jsdom'` pour ce fichier via `// @vitest-environment jsdom`, ajouter `jsdom` en devDependency)

**Interfaces:**
- Produces: `class Throttle { constructor(target: Window = window); readonly pressed: boolean; dispose(): void }` — compteur de pointeurs actifs sur `pointerdown`/`pointerup`/`pointercancel` ; remis à 0 sur `blur` et `visibilitychange` (hidden) ; `pressed = count > 0` ; ignore les pointeurs dont la cible est un élément `button`.

- [ ] **Step 1 : Tests** : pointerdown → pressed ; deux doigts, un levé → toujours pressed ; pointercancel → relâché ; visibilitychange hidden → relâché même sans pointerup ; blur → relâché ; pointerdown sur un `<button>` ignoré ; dispose retire les écouteurs.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: accélérateur à un doigt sur window avec relâchement sûr`

---

### Task 9 : Rendu, caméra, boucle de jeu : étape 1 jouable

**Files:**
- Create: `src/render/camera.ts`, `src/render/background.ts`, `src/render/track.ts`, `src/render/car.ts`, `src/render/renderer.ts`, `src/ui/hud.ts`, `src/game.ts`, `src/cars/state.ts`
- Modify: `src/main.ts`
- Test: `tests/camera.test.ts`

**Interfaces:**
- `cars/state.ts` : `interface SafePoint { x: number; y: number; angle: number }` ; `interface CarState { id: string; name: string; color: string; accent: string; progress: number; safePoint: SafePoint; lastSafePointAt: number; lastRespawnX: number | null; consecutiveRespawns: number; flippedSince: number | null; sideSince: number | null; stuckSince: number | null; stuckRefProgress: number; invulnerableUntil: number; turboUntil: number; finishedAt: number | null }` ; `newCarState(id, name, color, accent, start: SafePoint): CarState`.
- `camera.ts` : `computeBackingSize(cssW, cssH, dpr, maxW = 1920): { w: number; h: number; scale: number }` (scale = w / cssW) ; `class Camera { constructor(cfg); update(targetX: number, targetY: number, speedMps: number, dt): void; readonly x; readonly y; worldToScreen(p: {x,y}, viewW, viewH): {x,y}; pxPerMeter(viewH): number }` — suit `(targetX + speed × CAMERA_LEAD_SECONDS, max(targetY, 2))` avec lissage `CAMERA_SMOOTHING` ; `pxPerMeter = viewH / VISIBLE_HEIGHT_M`.
- `renderer.ts` : `interface Scene { track: Track; cars: CarView[]; stars: { x, y, active: boolean }[]; t: number }` ; `interface CarView { x, y, angle, wheels: {x,y,angle}[], color, accent, name, turbo: boolean, visible: boolean }` ; `class Renderer { constructor(canvas: HTMLCanvasElement, cfg); resize(): void; draw(scene: Scene, camera: Camera): void }`.
- `background.ts` : `prerenderSky(w, h): HTMLCanvasElement` (ciel noir, 200 étoiles, Terre bleue en haut à droite) ; dessiné avec parallaxe `0,1 × camera.x`.
- `track.ts` : `drawTrack(ctx, track, camera, view)` — sol gris rempli jusqu'en bas, cratères décoratifs, plots lumineux tous les 10 m, volcans (cône plus sombre, lave orange animée par `t`), ligne de départ et drapeau à damier à `xFinish`, mur.
- `car.ts` : `drawCar(ctx, view: CarView, pxPerMeter)` — carrosserie `color` avec deux bandes `accent`, vitre, pilote (tête ronde, casque `accent`), roues avec rayons tournants, flammes si `turbo`.
- `hud.ts` : `class Hud { constructor(root: HTMLElement); setTime(seconds): void (mm:ss, gros chiffres, en haut à droite); setFps(fps | null): void; showFinished(seconds, onAgain: () => void): void; hide(): void }`. Pendant la course, `#hud` a `pointer-events: none` ; seul l'écran ARRIVÉE (provisoire, remplacé au plan B) a un bouton « ENCORE » de 120 px.
- `game.ts` : `class Game { constructor(canvas, hudRoot, opts: { seed, length, debug }); start(): void; readonly state: 'racing' | 'finished'; readonly time: number; progress(id: string): number }` — boucle `requestAnimationFrame` avec accumulateur (`PHYSICS_DT`, `MAX_STEPS_PER_FRAME`), ordre par pas : lire `throttle.pressed` → `applyDrive` → `applyAirLevel` → `stepWorld` → `clampVelocities` → mise à jour `CarState.progress = chassis.x en m` ; `time += PHYSICS_DT` par pas ; rendu après ; si `opts.debug`, `window.__game = { state, time, seed, progress }` et fps moyen sur 1 s dans le HUD. Dans cette tâche : état `racing` seulement, pas d'arrivée ni de respawn (tâches 10 et 11).
- `main.ts` : `parseTrackOptions(location.search)` → `new Game(...)` → `start()`.

- [ ] **Step 1 : Tests `camera.test.ts`** : `computeBackingSize(1280, 800, 2)` → `{1920, 1200, 1.5}` ; `(800, 500, 1)` → `{800, 500, 1}` ; `Camera.update` converge vers la cible en avant de la voiture ; `worldToScreen` inverse y.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter tout le rendu et la boucle** → **Step 4 : PASS**, `npm run typecheck` 0 erreur, `npm run build` OK.
- [ ] **Step 5 : Vérification visuelle** : `npm run dev -- --host` puis capture avec Playwright en script ponctuel (viewport 1280×800, DPR 2) : `e2e/screenshots/etape1.png`. Regarder la capture : voiture bleue à bandes rouges posée sur le sol gris, ciel étoilé, Terre, au moins un volcan visible en avançant 3 s avec doigt posé (CDP `Input.dispatchTouchEvent`). Envoyer la capture au papa.
- [ ] **Step 6 : Commit et push** `feat: rendu canvas, caméra, HUD et boucle de jeu — étape 1 jouable` ; vérifier que le déploiement GitHub Pages est vert et donner l'adresse `https://i-dmk.github.io/I-DMK/?debug=1` au papa pour le test fps sur la tablette.

---

### Task 10 : Points sûrs et respawn (logique pure + branchement)

**Files:**
- Create: `src/cars/safepoint.ts`, `src/cars/respawn.ts`
- Modify: `src/game.ts`, `src/physics/car.ts` (si `placeCar` a besoin d'ajustements)
- Test: `tests/safepoint.test.ts`, `tests/respawn.test.ts`, `tests/respawn-sim.test.ts`

**Interfaces:**
- `safepoint.ts` : `forbiddenZone(v: Volcano): [number, number]` = `[v.xElanStart + 0,25 × (v.xRampStart − v.xElanStart), v.xReception)` ; `isSafePointCandidate(obs: { x: number; t: number; bothWheelsOnGround: boolean; carAngle: number; groundSlope: number }, state: CarState, track: Track, cfg): boolean` — vrai si `t − lastSafePointAt ≥ SAFE_POINT_INTERVAL`, deux roues au sol, `|carAngle| < 20°`, `|groundSlope| < SAFE_POINT_MAX_SLOPE`, et x hors de toute `forbiddenZone`.
- `respawn.ts` :
  - `normalizeAngle(a: number): number` dans `(−π, π]`.
  - `type RespawnReason = 'lava' | 'flipped' | 'side' | 'stuck' | 'underground' | 'speed'`.
  - `updateRespawnTimers(state: CarState, obs: { t; angle; throttle: boolean; progress; y; groundY; speedMps; onLava: boolean }, cfg): RespawnReason | null` — met à jour `flippedSince` (|angle| > FLIP_ANGLE), `sideSince` (|angle| > SIDE_ANGLE), `stuckSince`/`stuckRefProgress` (throttle et progress − ref < STUCK_DISTANCE) ; renvoie la raison dès qu'un seuil de durée est dépassé, `'lava'` immédiatement, `'underground'` si `y < groundY − 1`, `'speed'` si `speedMps > SPEED_GUARD`. Les timers sont remis à null quand la condition cesse.
  - `chooseRespawnTarget(state: CarState, track: Track, cfg): { point: SafePoint; consecutive: number }` — si `state.lastRespawnX === state.safePoint.x` alors `consecutive = state.consecutiveRespawns + 1` sinon 1 ; si `consecutive ≥ 2` et qu'un `volcanoAhead(track, safePoint.x)` existe, cible = `{ x: v.xReception + 3, y: heightAt, angle: 0 }` et `consecutive = 0` ; sinon cible = `safePoint`.
  - `applyRespawnToState(state, target, consecutive, t, cfg): void` — `lastRespawnX = target.x` (ou null si réception), `consecutiveRespawns`, `invulnerableUntil = t + RESPAWN_INVULN`, timers à null, `stuckRefProgress = target.x`.
- `game.ts` : après chaque pas, pour la voiture : observer, `isSafePointCandidate` → enregistrer `{x, y: heightAt(x), angle: slopeAt(x)}` ; `updateRespawnTimers` → si raison, mettre en file ; **entre deux pas** : `chooseRespawnTarget`, `placeCar(car, x, heightAt(x), angle)`, `setCarInvulnerable(car, true)`, effet étincelles (tâche 13), `applyRespawnToState`. Invulnérabilité levée quand `t ≥ invulnerableUntil` **et** qu'aucun chevauchement voiture-voiture (`Query.collides(chassis, autres châssis)` vide), au plus tard à `invulnerableUntil + RESPAWN_INVULN_MAX`.

- [ ] **Step 1 : Tests purs**

```ts
// safepoint.test.ts
test('zone interdite = [elan + 25 %, réception)', ...);
test('candidat refusé : moins de 0,5 s, roue en l air, pente 15°, dans la zone ; accepté sur plat de réception et dans le premier quart du plat d élan', ...);
// respawn.test.ts
test('normalizeAngle(3π) ≈ π ; normalizeAngle(−190°) ≈ 170°', ...);
test('flipped : 110° pendant 0,9 s → null ; 1,05 s → "flipped"', ...);
test('side : 80° pendant 2,05 s → "side"', ...);
test('stuck : throttle et progression < 1 m pendant 2,05 s → "stuck" ; sans throttle → null', ...);
test('lava → "lava" immédiat ; underground ; speed', ...);
test('chooseRespawnTarget : 1er respawn → point sûr ; 2e au même point → réception + 3 m, consecutive 0 ; point sûr différent → consecutive 1', ...);
```

- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Simulation `respawn-sim.test.ts`** (Matter.js, piste seed 1 ; le pas de jeu de `game.ts` est extrait dans `src/sim/simulate.ts` : `stepRace(sim: RaceSim, throttle: boolean): void` fait un pas complet (conduite, physique, clamp, points sûrs, respawn en file puis appliqué, arrivée ; étoiles et turbo ajoutés en tâche 12) et `simulateRace(track, opts: { throttle: (t: number) => boolean; maxSeconds: number; cfg }): { respawns: { t: number; reason: RespawnReason; target: SafePoint }[]; finishedAt: number | null; maxStuckSeconds: number; maxSpeed: number; starsTaken: { t: number; id: number }[]; progressAt: (t: number) => number }` enchaîne les pas ; `game.ts` appelle `stepRace` et ne duplique pas la logique) :

```ts
test('doigt toujours posé : finit la course en moins de 240 s, zéro respawn "stuck" ni "underground" ni "speed"', ...);
test('voiture posée à vitesse nulle sur le flanc gauche du premier volcan, doigt posé : respawn en ≤ 2,1 s', ...);
test('voiture placée dans la lave du premier volcan deux fois de suite (point sûr inchangé) : la 2e cible est le plat de réception', ...);
test('doigt levé 30 % du temps (motif déterministe 0,7 s on / 0,3 s off) : finit en moins de 300 s, au plus 6 respawns', ...);
```

- [ ] **Step 6 : PASS** → **Step 7 : Commit** `feat: points sûrs, respawn avec garde-fous et simulation de course`

---

### Task 11 : Ligne d'arrivée, chrono, écran ARRIVÉE provisoire

**Files:**
- Modify: `src/game.ts`, `src/ui/hud.ts`
- Test: `tests/finish.test.ts` (via `simulateRace`)

**Interfaces:**
- `game.ts` : quand `progress ≥ track.xFinish` et `finishedAt === null` : `finishedAt = time`, état `finished`, `throttle` ignoré, `applyDrive(car, false, ...)` (frein moteur) pendant `FINISH_COAST_SECONDS`, puis `hud.showFinished(finishedAt, onAgain)` ; `onAgain` recharge la page avec la même `?seed`. Le chrono HUD affiche `time` jusqu'à `finishedAt` puis se fige.
- `window.__game.state` reflète `'finished'`.

- [ ] **Step 1 : Test** : `simulateRace` doigt posé → `finishedAt` défini, `finishedAt ≈` temps au passage de `xFinish` (±1 pas), la voiture s'arrête avant `xWall`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: ligne d'arrivée, chrono en temps simulé et écran ARRIVÉE provisoire`

---

### Task 12 : Étoiles et turbo

**Files:**
- Create: `src/cars/turbo.ts`, `src/cars/stars.ts`, `src/physics/stars.ts`
- Modify: `src/game.ts`, `src/render/track.ts`, `src/render/car.ts`
- Test: `tests/turbo.test.ts`, `tests/stars-sim.test.ts`

**Interfaces:**
- `cars/turbo.ts` : `activateTurbo(state: CarState, t: number, cfg): void` (`turboUntil = t + TURBO_SECONDS`) ; `turboFactor(state, t, cfg): number` (`TURBO_FACTOR` si `t < turboUntil`, sinon 1).
- `cars/stars.ts` : `interface StarState { id: number; takenAt: number | null }` ; `isStarActive(s: StarState, t, cfg): boolean` (`takenAt === null || t ≥ takenAt + STAR_RESPAWN_SECONDS`) ; `takeStar(s, t): void`.
- `physics/stars.ts` : `createStarBodies(world, stars: Star[], cfg): Matter.Body[]` (cercles capteurs rayon 0,5 m, `label: 'star'`, `plugin: { starId }`, catégorie SENSOR, mask CAR) ; `syncStarBodies(bodies, states, t, cfg): void` (`collisionFilter.mask = 0` quand inactive, `CAT.CAR` sinon).
- `game.ts` : après le pas, `sensorsTouching(engine, car.parts)` filtré `label === 'star'` et actif → `takeStar`, `activateTurbo` ; `applyDrive(car, throttle, turboFactor(...))` ; `CarView.turbo = turboFactor > 1` ; `Scene.stars[].active`.
- Rendu : étoile jaune à 5 branches qui tourne lentement (`t`), halo ; inactive : non dessinée. Flammes orange/jaune derrière la voiture si `turbo`.

- [ ] **Step 1 : Tests purs** : `turboFactor` avant/pendant/après ; un nouveau turbo remet 3 s ; `isStarActive` avant 5 s faux, après vrai.
- [ ] **Step 2 : Simulation** : piste seed 1, doigt posé : au moins une étoile prise avant 60 s ; pendant le turbo, vitesse max observée > `V_MAX × 1,2` ; l'étoile prise est inactive 5 s puis active ; aucune chute dans la lave liée à un turbo (déjà couvert par `jump.test.ts`, vérifier zéro `'lava'` sur la course complète doigt posé).
- [ ] **Step 3 : FAIL** → **Step 4 : Implémenter** → **Step 5 : PASS**
- [ ] **Step 6 : Commit** `feat: étoiles ramassables avec réapparition et turbo avec flammes`

---

### Task 13 : Effets visuels : étincelles, poussière, lave, fumée

**Files:**
- Create: `src/render/effects.ts`
- Modify: `src/render/renderer.ts`, `src/game.ts`
- Test: `tests/effects.test.ts`

**Interfaces:**
- `class Effects { spawnSparks(x, y): void; spawnDust(x, y, strength): void; update(dt): void; draw(ctx, camera, view): void; readonly count: number }` — particules simples (position, vitesse, vie), au plus 300 vivantes ; lave : bulles tirées sur chaque volcan visible toutes les 0,3 s ; fumée : particules grises lentes au-dessus de la lave.
- `game.ts` : étincelles au respawn ; poussière à l'atterrissage (roue passe de « en l'air > 0,3 s » à « au sol »).

- [ ] **Step 1 : Tests** : `spawnSparks` ajoute 20–40 particules ; `update(5)` les fait toutes mourir ; plafond 300 respecté après 50 `spawnSparks`.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS**
- [ ] **Step 5 : Commit** `feat: effets de particules (étincelles, poussière, lave, fumée)`

---

### Task 14 : Tests Playwright tablette et captures

**Files:**
- Create: `playwright.config.ts`, `e2e/race.spec.ts`, `e2e/helpers.ts`
- Modify: `package.json` (script `e2e`)

**Interfaces:**
- `playwright.config.ts` : `webServer: { command: 'npm run dev -- --port 4173', url: 'http://localhost:4173' }`, projet `tablet` avec `viewport: {width: 1280, height: 800}`, `deviceScaleFactor: 2`, `hasTouch: true`, `isMobile: true`, `launchOptions.executablePath: process.env.CHROMIUM_PATH` (défaut `/opt/pw-browsers/chromium`), `outputDir: 'test-results'`.
- `e2e/helpers.ts` : `holdFinger(page, seconds)` — session CDP `Input.dispatchTouchEvent` `touchStart` au centre, attente, `touchEnd` ; `gameState(page)` lit `window.__game`.

- [ ] **Step 1 : Tests**

```ts
test('la page charge, canvas plein écran, aucun défilement', async ({page}) => { await page.goto('/?seed=1&debug=1'); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280); expect(await page.evaluate(() => (window as any).__game.state)).toBe('racing'); });
test('doigt posé 3 s : la voiture avance', ...progress > 5 m);
test('sans doigt : la voiture ne bouge pas en 2 s', ...progress < 0,5 m);
test('course courte ?len=300 doigt posé : état finished avant 60 s et écran ARRIVÉE visible', ...);
test('captures : titre provisoire/course/arrivée dans e2e/screenshots/', ...);
```

- [ ] **Step 2 : Run `npm run e2e`** → PASS. Regarder les captures (voiture, piste, volcan, étoile, HUD lisible).
- [ ] **Step 3 : Commit et push** `test: Playwright tablette (1280×800 DPR 2) et captures d'écran` ; envoyer les captures au papa avec l'adresse déployée.

---

### Task 15 : Relecture de branche et remise au papa

- [ ] **Step 1 :** `npm run typecheck && npm test && npm run build && npm run e2e` tous verts ; déploiement GitHub Pages vert sur le dernier commit.
- [ ] **Step 2 :** Relecture adversariale de la branche entière par un relecteur frais (bugs, écarts au spec §5, §6, §8, §10), corrections, re-tests.
- [ ] **Step 3 :** Message au papa : adresse du jeu, ce qu'il faut regarder avec Galahad (fps avec `?debug=1`, confort du doigt, sauts des volcans, durée de course avec `?len=`), et ce qui vient au plan B (copains, titre, podium, sons, PWA).
