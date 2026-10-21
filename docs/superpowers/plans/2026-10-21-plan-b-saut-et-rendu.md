# Plan B (suite) — Rendu interpolé, étoiles pour tous, bouton saut, conduite des robots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. À chaque tâche : implémenteur frais, puis relecture standard + relecture adversariale par sous-agents frais **et** le skill `code-review` sur le diff de la tâche ; tours de correction (≤ 5) ; validation du papa ; passation mise à jour et commitée ; push.

**Statut :** v1.1. Le brouillon v1 (04d458a) a été corrigé après le tour de relecture 1 : relecture standard, relecture adversariale avec calculs physiques, rulings du coordinateur. Il attend une re-relecture ciblée, puis les réponses du papa (section « Questions pour le papa ») et sa validation.

**Goal:** Supprimer le tremblement d'affichage (5f). Rendre la course rattrapable : chaque voiture a ses propres étoiles (5d), Galahad a un bouton saut et certaines étoiles sont en hauteur (5e). Les copains conduisent pour de vrai : départ échelonné, lever de pied, politesse, sauts plus ou moins bien placés (6).

**Architecture:** Inchangée (spec §4, plan v2.1). `track/`, `cars/`, `ai/` et `loop/` restent purs.
- `loop/interpolation.ts` : poses et interpolation.
- `loop/frame.ts` : une image complète (pas, alpha, poses dessinées, cible de caméra), appelée **à la fois** par `Game` et par le rejeu des tests.
- `loop/frame-stats.ts` : compteur d'images de debug.
- `cars/jump.ts` : décision de saut.
- `ai/driver.ts` : pilote automatique.
- `physics/car.ts` : la seule fonction de saut, `applyJump`.
- `sim/simulate.ts` : le pas de course unique, `stepRace(sim, galahadThrottle, galahadJump)`.
- `input/jump.ts` (front d'appui) et `ui/jump-button.ts` (bouton DOM) s'ajoutent à côté de `input/throttle.ts` et `ui/hud.ts`.

**Ordre d'exécution :** **5f → 5d → 5e → 6**, puis la tâche 7 du plan v2.1. Prérequis : la tâche 5c est validée et fusionnée sur `ccr-5b6fabc4-n96ofo` (passation, « Prochaine action » 2). Les tâches 5e et 6 commencent chacune par un **Step 0 bloquant** : les réponses du papa.

**Spec :** les références ci-dessous suivent ce format.
- `docs/superpowers/specs/2026-10-21-bouton-saut-design.md` (validé) fait autorité pour 5d, 5e et 6. Référence : « saut §n ».
- `docs/superpowers/handoff/2026-10-21-glitch-tremblement.md`, §5 à §7, pour 5f. Référence : « tremblement §n ».
- Pour le reste : l'addendum plan B v3.1 (« addendum §n ») et le spec du 2026-10-20.

**Ce document remplace la tâche 6 du plan v2.1** (`2026-10-21-plan-b-copains-et-finitions.md`) et garde tout ce qu'elle contenait : délai de départ, lever de pied, zone volcan, robots polis, héritages de la 5b. Les tâches 5f, 5d et 5e s'insèrent entre la 5c et la 6. La tâche 7 du plan v2.1 reste valable telle quelle ; son objectif mesuré (`race-objective`) inclut désormais les sauts des copains, puisqu'ils sont dans leur driver (saut §5).

## Global Constraints

Toutes les contraintes du plan v2.1 restent valables : unités, pas fixe, roues 48 côtés, contact débouncé, aucun déplacement de corps dans un callback de collision, commits en français préfixés `feat:`, `fix:`, `test:`, `chore:` ou `docs:`, aucun identifiant de modèle dans les commits. En plus :

- **Typecheck et `npm test` verts à chaque commit.** `tsconfig.json` inclut `tests/`, et `deploy.yml` lance `npm run typecheck` puis `npm test`. **Jamais de `.skip`.** Une API n'est retirée que dans le commit qui migre son dernier consommateur.
- **Budget CI :** `npm test` reste sous 6 min mur sur le runner (≈ 3 min 05 ici, 329 tests). Les simulations de course complète à 5 voitures, les balayages et les calibrations vont dans `tests/slow/` (`npm run test:slow`). On scinde les fichiers plutôt que de les allonger, car Vitest parallélise par fichier.
- **Déterminisme :** toute décision aléatoire vient d'un `mulberry32` dérivé d'une graine. Graine de piste pour les étoiles hautes, `sim.pilotSeed` pour les copains, graine de test pour la gigue des écrans simulés. `ENCORE` rejoue la même course.
- **Pureté :** `track/`, `cars/`, `ai/` et `loop/` sans matter-js ni DOM. `tests/deps.test.ts` couvre `src/{track,cars,loop}` ; la tâche 6 y ajoute `ai`.
- **Galahad seul (`robots: false`), « au bit près » :** l'**empreinte par pas** est un sha1 des flottants bruts de toutes les pièces à chaque pas (`tests/empreinte.test.ts`, figée au Step 1 de la 5f **sur le commit final de la 5c**, dont le hash est noté dans le test et dans le registre à l'exécution). C'est elle qui juge le bit près. `PLAN_A_TRACE` (`tests/simulate.test.ts`) n'a qu'une tolérance de ±0,01 m : elle reste en garde-fou lisible, pas en preuve.

  | Tâche | Galahad seul avec `CONFIG` | Pourquoi |
  |---|---|---|
  | 5f | **identique** | Seul le rendu change ; `stepRace` n'est pas touché. |
  | 5d | **identique** (attendu, vérifié par l'empreinte) | `syncStarBodies` est gardée. Avec une seule voiture, le masque d'un capteur vaut la catégorie de Galahad quand l'étoile est active pour lui, 0 sinon : exactement le comportement d'aujourd'hui. Les paires de capteurs comptent dans `totalContacts` (`Resolver.preSolvePosition` de matter-js), donc on ne les laisse **pas** toujours actives. |
  | 5e | **identique** si les étoiles hautes s'ajoutent (option (b) de la Q-P1) ou avec `STAR_HIGH_SHARE: 0` ; **change** sinon | Selon l'option choisie par le papa : une étoile basse devenue haute n'est plus prise doigt posé, donc le turbo change. Les tirages des étoiles hautes viennent **après** tous les autres dans `placeStars`, dernier consommateur du rng de piste (`generate.ts:110`). Avec `galahadJump = false`, `applyJump` n'est jamais appelé. |
  | 6 | **identique** | Galahad n'a pas de driver. |

  Si l'empreinte bouge alors que le tableau dit « identique » : on s'arrête, on mesure, le papa tranche, et le ruling va au registre. On ne recapture jamais en silence.
- **Promesse de la 5c conservée (saut §0) :** doigt posé sans jamais sauter, on finit la course et on ne tombe jamais dans la lave. L'invariant `lavaByCar.galahad === 0` à 5 voitures, graines 0 à 23 (`tests/slow/race-invariants-*.test.ts`), reste vert à chaque tâche.
- Chaque nouveau paramètre va dans `src/config.ts`, en nombres seulement. Une constante dérivée est déclarée avant le littéral, comme `D_LANCE`. La gravité devient la constante locale `GRAVITY`, réutilisée par `JUMP_VY`.
- **Commandes de fin de tâche :** `npm run typecheck`, `npm test`, `npm run test:slow` (≈ 12 min) et `npm run e2e`. Capture dans `e2e/screenshots/` quand l'écran change. Passation et registre mis à jour, commit `docs: tâche Nx validée, passation et registre`, puis `git status -sb` et `git push origin ccr-5b6fabc4-n96ofo`.
- Corrections après relecture : un commit `fix: …` par tour.
- **Arbre partagé :** jamais de `git reset`, `checkout`, `stash` ni `clean` pendant qu'un sous-agent travaille. Les sondes s'appellent `tests/zz-probe-*.test.ts` et sont supprimées avant le commit.

## Review Focus

1. **Écran à 59,94, 60,05 ou 120 Hz, avec gigue.** Attendu : aucun épisode de tremblement en interpolé ; une réapparition ne laisse pas de traînée. → 5f.
2. **Un copain prend une étoile juste devant Galahad.** Attendu : elle reste visible et prenable par Galahad, qui a lui aussi son turbo. → 5d.
3. **Doigt posé, turbo compris, à 5 voitures.** Attendu : 0 étoile haute prise sans saut, 0 chute de Galahad. → 5e.
4. **Tap sur le bouton pendant que l'autre doigt accélère.** Attendu : la voiture avance et saute. Tap seul : un saut, aucun gaz. → 5e.
5. **Copain fonceur devant une étoile haute juste après une réception.** Attendu : jamais de saut dans `[xLancement, xReception]`. Il peut mal retomber, mais pas plus de 3 respawns. → 6.
6. **Galahad arrêté sur la grille.** Attendu : les copains ne le poussent pas pendant au moins 2 s (robots polis). → 6.

---

## Structure des fichiers (nouveaux ou refondus)

```
src/loop/interpolation.ts     CarPose, lerpAngle, lerpCarPose, PoseHistory (5f)
src/loop/frame.ts             runFrame, cameraTarget : une image, pure, partagée par Game et le rejeu (5f)
src/loop/frame-stats.ts       StepHistogram (5f)
src/sim/simulate.ts           posesOf, sceneOf(sim, poses, alpha) (5f) ; étoiles par voiture, starsByCar, firstStar (5d) ;
                              stepRace(sim, throttle, jump), 'jump', jumpReady (5e) ; Driver { throttle, jump } (6)
src/sim/harness.ts            simulateRace et ses aides, extraits de simulate.ts (5e, pour l'option jump ; voir 5e)
src/physics/world.ts          catégorie de collision par voiture (5d)
src/physics/car.ts            filtre par voiture (5d) ; applyJump (5e)
src/physics/stars.ts          syncStarBodies : masque = OU des voitures pour qui l'étoile est active (5d)
src/cars/stars.ts             StarState par voiture (5d)
src/cars/jump.ts              canJump (5e)
src/cars/state.ts             lastJumpAt (5e)
src/track/types.ts, stars.ts  Star.high, étoiles hautes (5e)
src/input/jump.ts             JumpInput (5e)
src/ui/jump-button.ts         JumpButton (5e)
src/ui/hud.ts                 setFrameSteps (5f) ; fps et compteurs déplacés sous le bouton (5e)
src/cars/pilots.ts            jumpTry, jumpSkill (6)
src/ai/driver.ts              makeRobotDriver (6)
src/track/query.ts            inNoJumpZone (6)
tests/helpers/frames.ts       écrans simulés, rejeu par runFrame, détecteur d'épisodes (5f)
tests/helpers/fingerprint.ts  empreinte par pas (5f)
tests/helpers/jump-runs.ts    harnais de saut : voiture lancée, saut à l'instant donné, fenêtre par dichotomie (5e)
```

---

### Task 5f (ajoutée) : Rendu interpolé (tremblement)

**Constat (tremblement §5–§6, mesuré) :**
- `Game.present` dessine `sceneOf(sim)`, l'état du dernier pas, alors que `Camera.update(…, elapsed)` lisse au temps réel.
- Une image à 0 ou 2 pas déplace donc les voitures de ±1 pas par rapport au décor : 13 px CSS à 14 m/s, 20 px en turbo.
- À 60,05 Hz avec une gigue de 0,2 ms : 75 épisodes sur 12 courses sans interpolation, 1 avec.
- Correctif retenu : la piste 1 du rapport (§7). Coût : un pas de latence, 16 ms.

**Files:**
- Create: `src/loop/interpolation.ts`, `src/loop/frame.ts`, `src/loop/frame-stats.ts`, `tests/helpers/frames.ts`, `tests/helpers/fingerprint.ts`
- Modify: `src/sim/simulate.ts` (`posesOf`, `carView(sim, i, pose?)`, `sceneOf(sim, poses?, alpha?)`), `src/game.ts` (`frame` et `present` passent par `runFrame` et `cameraTarget`), `src/ui/hud.ts` (`setFrameSteps`), `e2e/helpers.ts` (lecture de `frameSteps`)
- Test: `tests/empreinte.test.ts`, `tests/interpolation.test.ts`, `tests/frame.test.ts`, `tests/frame-stats.test.ts`, `tests/interpolation-replay.test.ts`, `tests/slow/interpolation-replay-slow.test.ts`, `e2e/race.spec.ts`

**Interfaces :**
```ts
// src/loop/interpolation.ts (pur ; n'importe que cars/angle.ts)
export interface PartPose { x: number; y: number; angle: number }            // monde : m, y vers le haut, angle anti-horaire
export interface CarPose { chassis: PartPose; wheels: PartPose[]; speed: number }   // speed : m/s (avance de caméra)
export function lerpAngle(a: number, b: number, alpha: number): number;       // a + normalizeAngle(b − a) × alpha
export function lerpCarPose(prev: CarPose, cur: CarPose, alpha: number): CarPose;
export class PoseHistory {
  reset(poses: CarPose[]): void;                                  // prev = cur = poses (départ, rebuildCars)
  push(poses: CarPose[], teleported: ReadonlySet<number>): void;  // après un pas : prev ← cur, cur ← poses ; prev[i] ← cur[i] si i téléporté
  at(alpha: number): CarPose[];                                   // alpha borné à [0, 1] ; neuf, sans mutation
}
// src/loop/frame.ts (pur)
/** Résultat d'un pas, fourni par l'appelant : poses après le pas, index téléportés ; 'rebuilt' après rebuildCars ; 'stop' = abandon. */
export type StepOutcome = { poses: CarPose[]; teleported: ReadonlySet<number> } | { rebuilt: CarPose[] } | 'stop';
export interface FrameState { acc: number; history: PoseHistory }
export interface FrameResult { steps: number; alpha: number; poses: CarPose[]; stopped: boolean }
/** advanceAccumulator, puis `step(i)` pour chaque pas, puis poses dessinées = history.at(acc / dt) (ou cur si interpolate = false). */
export function runFrame(s: FrameState, elapsed: number, cfg: Config, step: (i: number) => StepOutcome, interpolate = true): FrameResult;
/** Cible de caméra pour la pose de Galahad : x, max(y, sol + 3), vitesse. */
export function cameraTarget(pose: CarPose, groundAt: (x: number) => number): { x: number; y: number; speed: number };
// src/loop/frame-stats.ts (pur)
export class StepHistogram { record(steps: number, nowMs: number): void; readonly last: { frames: number; zero: number; multi: number } }
// src/sim/simulate.ts
export function posesOf(sim: RaceSim): CarPose[];
export function carView(sim: RaceSim, index: number, pose?: CarPose): CarView;
/** Sans poses : comportement actuel. Avec poses et alpha : voitures interpolées, Scene.t = sim.time − (1 − alpha) × PHYSICS_DT. */
export function sceneOf(sim: RaceSim, poses?: CarPose[], alpha?: number): Scene;
```

**Règles :**
- **État dessiné** = `lerp(précédent, courant, alpha)`, avec `alpha = acc / PHYSICS_DT`.
- **Angles :** ceux du châssis et des roues passent par `lerpAngle`. L'angle de roue reste cumulé (`-w.angle`) ; en turbo il tourne de 44,6° par pas, moins de 180°, donc le lerp reste juste.
- **Caméra :** `cameraTarget(poses[0], x => heightAt(track, x))`, puis `camera.update(t.x, t.y, t.speed, elapsed)`. `elapsed` reste le temps réel, puisque le lissage est déjà indépendant de la cadence.
- **Téléportation :**
  - Après chaque `stepRace`, `Game` passe dans `teleported` les index qui ont un `'respawn'` dans `sim.events`.
  - Après `rebuildCars`, l'appelant renvoie `{ rebuilt: posesOf(sim) }`, et `runFrame` appelle `history.reset`.
  - Pas de seuil de distance : les événements font foi.
- Étoiles, effets et HUD restent au temps de simulation. `Scene.t` suit la même latence que les voitures.
- **`?debug=1` :** `StepHistogram` est alimenté à chaque image. Le HUD affiche « 0 pas : z · 2+ pas : m » sur la dernière seconde (`.hud-steps`), à côté du fps (en 5e, les deux passent sous le bouton saut). `window.__game.frameSteps` vaut `{ frames, zero, multi }`. Le papa pourra vérifier sur la tablette (tremblement §8).
- **`present` ne touche jamais `sim`.**

**Détecteur (tremblement §1, côté rendu) :**
- Position écran de Galahad en px CSS, vue 1280 × 800, donc `ppm = 800 / VISIBLE_HEIGHT_M` ≈ 57,1 px/m.
- Un **à-coup** est une image où |Δ²x| > 4 px. Un **épisode** compte au moins 3 à-coups en 0,5 s.
- Les téléportations (|Δx| > 60 px) sont exclues à ±1 s.

```ts
// tests/helpers/frames.ts
export interface ScreenModel { hz: number; jitterMs: number; seed: number }   // gigue gaussienne σ = jitterMs (Box-Muller sur mulberry32), phase tirée
export function frameTimesMs(model: ScreenModel, seconds: number): number[];
export interface Trajectory { poses: CarPose[][]; teleported: ReadonlySet<number>[] }   // un élément par pas, toutes les voitures
export function recordTrajectory(seed: number, seconds: number, robots: boolean): Trajectory;   // stepRace doigt posé + posesOf
export type RenderMode = 'physique' | 'actuel' | 'interpolé';   // physique : 1 pas par image ; actuel : runFrame(…, interpolate = false) ; interpolé : runFrame
export function replayScreenX(traj: Trajectory, track: Track, model: ScreenModel, mode: RenderMode, cfg: Config): { tMs: number[]; x: number[] };
export function shakeEpisodes(r: { tMs: number[]; x: number[] }): number;
// tests/helpers/fingerprint.ts
export function stepFingerprint(sim: RaceSim): string;   // sha1 (node:crypto) des Float64 bruts : position, angle, vitesses de chaque pièce, temps
```
Le rejeu appelle **le même** `runFrame`, le même `cameraTarget` et la même `Camera` que `Game`. Seule la source des pas change : poses enregistrées au lieu de `stepRace`.

- [ ] **Step 1 : Figer l'empreinte** sur le commit final de la 5c, avant toute modification.
  - Créer `tests/helpers/fingerprint.ts` et `tests/empreinte.test.ts`.
  - Galahad seul, graines 0, 1 et 2, 1 680 m, doigt posé, 30 s.
  - Coller les 3 sha1 cumulés **mesurés**. Le commentaire du test donne le hash du commit et la consigne « si l'empreinte bouge, c'est un défaut, pas une valeur à recapturer ».
  - Commande : `npx vitest run tests/empreinte.test.ts`, verte, < 10 s.
- [ ] **Step 2 : Extraire `loop/frame.ts` sans changer le comportement.**
  - `runFrame` et `cameraTarget`.
  - `PoseHistory` dans une version minimale où `at()` renvoie `cur`, comme aujourd'hui.
  - `posesOf`.
  - `Game.frame` et `present` passent par eux.
  - `tests/frame.test.ts` (pur) :
    - nombre de pas égal à celui d'`advanceAccumulator` ;
    - `'stop'` interrompt la boucle ;
    - `{ rebuilt }` remet l'historique à zéro ;
    - `cameraTarget` donne `max(y, sol + 3)`.
  - Puis `npm run typecheck`, `npm test` (empreinte inchangée) et `npm run e2e` : tout vert. Pas de commit à ce stade.
- [ ] **Step 3 : Tests rouges.**
  - `tests/interpolation.test.ts` :
    - `lerpAngle(179°, −179°, 0,5)` vaut ±180°, pas 0 ;
    - `alpha` 0 donne `prev`, 1 donne `cur`, et un alpha hors bornes est borné ;
    - téléporté : `at(α) = cur` pour tout α, les autres restent interpolées ;
    - `reset` ;
    - `at` ne mute rien.
  - `tests/frame-stats.test.ts` : la suite 1, 0, 2, 1, 1, 3 sur 1 s donne `{ 6, 1, 2 }`, puis remise à zéro.
  - `tests/interpolation-replay.test.ts` (CI) :
    - Galahad seul, graine 1, 40 s ; écrans {60,05 Hz, σ 0,2 ms} et {59,94 Hz, σ 0,1 ms}, graines d'écran 0 à 2.
    - Contrôle : `actuel` ≥ 1 épisode au total.
    - **Exigence : `interpolé` = 0 et ≤ `physique`.**
    - Téléportation sans traînée : Galahad posé à `xLava` du premier volcan de la graine 1 (comme `tests/respawn-e2e.test.ts`). Au pas du `'respawn'`, pour α ∈ {0 ; 0,5 ; 0,99}, `runFrame` dessine exactement la cible. Contrôle : sans le drapeau, α = 0,5 donne un x intermédiaire.
    - `rebuildCars` : pose dessinée = cible.
    - Physique inchangée : 600 pas à 5 voitures (graine 2), avec et sans `runFrame`. Les `stepFingerprint` sont identiques à chaque pas.
  - Commande : `npx vitest run tests/interpolation.test.ts tests/frame-stats.test.ts tests/interpolation-replay.test.ts`.
  - **ROUGE attendu et constaté** : avec la `PoseHistory` minimale du Step 2, `interpolé` ≡ `actuel`, donc des épisodes sont comptés. On note le nombre.
- [ ] **Step 4 : Implémenter** l'interpolation (`lerpAngle`, `lerpCarPose`, `PoseHistory` complète), `StepHistogram`, `sceneOf(sim, poses, alpha)` et l'affichage debug. **VERT**, plus `npx vitest run tests/deps.test.ts`.
- [ ] **Step 5 : Suite lente.** `tests/slow/interpolation-replay-slow.test.ts` :
  - 12 courses à 5 voitures (graines 0 à 11, 150 s) × écrans {60,05 / 0,2 ; 59,94 / 0,1 ; 60,000 / 0,2 ; 120 Hz / 0,1}.
  - Pour chaque écran : `interpolé` ≤ `physique`, et 0 hors de ±1 s autour d'une réapparition.
  - Le tableau physique / actuel / interpolé (forme de tremblement §6) est imprimé.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/interpolation-replay-slow.test.ts`.
- [ ] **Step 6 : e2e.** Dans `e2e/race.spec.ts`, avec `?seed=1&debug=1` : après 2 s, `.hud-steps` est visible et `window.__game.frameSteps.frames` > 0. Les 6 e2e existants restent verts. Commande : `npm run e2e`.
- [ ] **Step 7 : Suites complètes** : `npm run typecheck`, `npm test` (chronométré, < 6 min), `npm run test:slow`.
- [ ] **Step 8 : Commit** `feat: rendu interpolé entre deux pas, caméra sur la pose interpolée, compteur d'images à 0 et 2 pas`.
- [ ] **Step 9 : Relectures.**
  - Relecture standard.
  - Relecture adversariale. Sondes :
    - écrans à 90 et 120 Hz ;
    - `MAX_STEPS_PER_FRAME` atteint ;
    - réapparition au 1er puis au 2e pas d'une image à 2 pas ;
    - fantôme qui sort de zone ;
    - `acc` ≈ dt − 1e-9 ;
    - allocations par image à 5 voitures ;
    - stroboscope des roues en turbo (tremblement §5.3), à noter seulement.
  - `code-review` sur le diff.
  - Tours de correction (≤ 5), un commit `fix:` chacun.
- [ ] **Step 10 : Validation du papa** sur la tablette avec `?debug=1` : plus de voiture qui tremble ; compteur d'images noté ; modèle de tablette noté (tremblement §8). Puis passation et registre (tableau du rejeu), commit `docs: tâche 5f validée, passation et registre`, `git status -sb` et push.

---

### Task 5d (ajoutée) : Étoiles pour tous

**Règle (saut §2) :**
- L'état d'une étoile est tenu **par voiture**. Une voiture qui prend une étoile la rend inactive pour elle seule pendant `STAR_RESPAWN_SECONDS`, et active son turbo.
- La décision « prise ou non » se fait voiture par voiture dans `collectStars`.
- À l'écran, on dessine l'état vu par Galahad.
- **Capteurs (rédaction du plan) :** on garde `syncStarBodies`, avec une **catégorie de collision par voiture**. Le masque d'un capteur vaut le OU des catégories des voitures pour qui l'étoile est active. Les paires de capteurs inutiles n'existent donc pas : elles compteraient dans `totalContacts`, via `Resolver.preSolvePosition`. Avec une seule voiture, le comportement est identique à aujourd'hui.

**Files:**
- Modify:
  - `src/physics/world.ts` : `CAT` gagne `carCategory(index) = 0x0008 << index` et `CAT.ALL_CARS` (OU des 5 bits ; garde `ROBOT_COUNT + 1 ≤ 5` levée sinon). Sol, mur et lave passent à `mask: CAT.ALL_CARS`. `CAT.CAR` est retiré quand son dernier usage est migré.
  - `src/physics/car.ts` : `createCar` passe `category: carCategory(index)` ; `MASK_NORMAL = GROUND | ALL_CARS | SENSOR`.
  - `src/physics/stars.ts` : `syncStarBodies(bodies, states, t, cfg)`, masque = OU des voitures actives ; `createStarBodies` à `mask: ALL_CARS`.
  - `src/cars/stars.ts` (refonte).
  - `src/sim/simulate.ts` :
    - `newStarStates(track.stars, cars.length)` ;
    - `collectStars(sim, car, index)` ;
    - `sceneOf` dessine l'état vu par l'index 0 ;
    - `SimulateResult` gagne `starsByCar` et `firstStar` ;
    - commentaires de `RaceSim.stars` et de `stepRace` réécrits.
  - `tests/turbo.test.ts` : l. 3 et 37–50 migrent vers `isStarActiveFor`/`takeStarFor`/`newStarStates(…, n)`.
  - `tests/slow/stars-sim.test.ts` : l. 4 et 37–52, `takenAt[0]`.
  - `tests/simulate.test.ts` :
    - en-tête « étoiles partagées » devient « étoiles par voiture » ;
    - **le test l. 190 « une étoile prise par une voiture est inactive pour toutes : au même pas et au pas suivant » est inversé** en « … reste active pour les autres, inactive pour elle seule » ;
    - les tests qui lisent `collisionFilter` et `CAT` passent aux catégories par voiture.
  - `tests/world.test.ts` : filtres du sol, s'il les lit.
- Test: `tests/stars-pour-tous.test.ts`, `tests/slow/rattrapage-*.test.ts`, `tests/slow/race-invariants-*.test.ts` (inchangés, relancés)

**Interfaces :**
```ts
// src/cars/stars.ts (pur)
export interface StarState { id: number; /** Par index de voiture : instant (s) de sa dernière prise, null si jamais. */ takenAt: (number | null)[] }
export function newStarStates(stars: Star[], carCount: number): StarState[];
export function isStarActiveFor(s: StarState, carIndex: number, t: number, cfg: Config): boolean;
export function takeStarFor(s: StarState, carIndex: number, t: number): void;
// src/physics/world.ts
export const carCategory: (index: number) => number;
// src/sim/simulate.ts — SimulateResult
starsByCar: Record<string, Extract<SimEvent, { type: 'star' }>[]>;
firstStar: { carId: string; t: number } | null;   // au même pas : la plus petite index
```
`isStarActive` et `takeStar` sont retirées dans ce commit, avec leurs derniers consommateurs (`tests/turbo.test.ts`, `tests/slow/stars-sim.test.ts`).

**Mesure du rattrapage (sert aussi en 5e et 6) :** `tests/slow/rattrapage-0-23.test.ts` et `tests/slow/rattrapage-24-47.test.ts`, deux fichiers en parallèle, harnais `fiveCarRace` de `tests/helpers/race.ts`.
- 48 courses à 5 voitures, Galahad doigt posé (graines 0 à 47), plus 16 courses avec le motif `liftedPattern(seed, 0.3)` pour Galahad.
- Première étoile : premier `'star'` vu par `onStep`, sans besoin de `firstStar` pour la mesure « avant ».
- Par graine : vainqueur, voiture de la première étoile, place de Galahad, étoiles par voiture. Une ligne JSON par graine est écrite dans `tests/slow/out/rattrapage-<étape>.jsonl` (ignoré par git, à ajouter au `.gitignore` dans ce commit), pour la **comparaison appariée par graine** entre étapes :
  - nombre de graines où « vainqueur = première étoile » passe de vrai à faux, et l'inverse ;
  - écart moyen de la place de Galahad sur les mêmes graines.
- Le tableau est imprimé. Pas d'assertion chiffrée (ruling Q9). Durée estimée : ≈ 25 min mur sur 4 cœurs.

- [ ] **Step 1 : Mesure « avant »** sur le code de départ, sans rien changer dans `src/`.
  - Créer les deux fichiers `rattrapage-*` et ajouter `tests/slow/out/` au `.gitignore`.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/rattrapage-0-23.test.ts tests/slow/rattrapage-24-47.test.ts`.
  - Recopier le chiffre au registre (`Task 5d: rattrapage avant`) et garder le `.jsonl`.
- [ ] **Step 2 : Tests rouges.** `tests/stars-pour-tous.test.ts` :
  - **pur :**
    - prise par la voiture 1 à t = 10 : active pour 0, 2, 3 et 4 ;
    - inactive pour 1 jusqu'à 10 + `STAR_RESPAWN_SECONDS` (exclu) ;
    - deux prises au même t : chaque voiture a son délai.
  - **physique :** `syncStarBodies`, avec la voiture 1 inactive, donne un masque = OU des catégories 0, 2, 3 et 4. `carCategory` vaut 5 bits distincts, disjoints de GROUND et SENSOR.
  - **simulation, graine 1, `robots: true` :**
    - un copain est posé par `placeCar` 6 m avant la 1re étoile, Galahad 20 m derrière, tous deux doigt posé ;
    - les deux reçoivent un `'star'` du **même** `id`, les deux turbos sont actifs ;
    - `sceneOf(sim).stars[i].active` reste vrai après la prise du copain et passe à faux après celle de Galahad.
  - **réapparition par voiture :** voiture garée à l'arrêt dans le capteur, doigt levé → prises à t0, t0 + 5 et t0 + 10 s (±1 pas), jamais entre.
  - Le test inversé de `tests/simulate.test.ts:190`.
  - Commande : `npx vitest run tests/stars-pour-tous.test.ts tests/simulate.test.ts`. **ROUGE.**
- [ ] **Step 3 : Implémenter**, puis **VERT** : `npm run typecheck` et `npm test`. **L'empreinte et `PLAN_A_TRACE` sont inchangées.**
- [ ] **Step 4 : Effet à 5 voitures.** `npm run test:slow`.
  - Doivent rester vrais, sur les graines 0 à 23 : ≤ 3 respawns par robot, blocage ≤ 2,1 s, `lavaByCar.galahad === 0`, `ghostContacts === 0`.
  - Tableau par graine, avant et après : étoiles par voiture, chutes par voiture, place de Galahad.
  - Si un invariant tombe : **on ne l'assouplit pas.** On donne la cause (`describeFall`), et le papa tranche.
- [ ] **Step 5 : Mesure « après 5d »** (fichiers `rattrapage-*` relancés, comparaison appariée), puis registre. **Commit** `feat: étoiles pour tous, état par voiture, vu par Galahad à l'écran`.
- [ ] **Step 6 : Relectures.**
  - Relecture standard.
  - Relecture adversariale. Sondes :
    - deux voitures dans le même capteur au même pas ;
    - étoile d'élan prise par 3 voitures qui arrivent ensemble au volcan (turbo en zone fantôme : lave ?) ;
    - `meanStepMs` avant et après ;
    - empreinte de Galahad seul, graines 0 à 4, course complète ;
    - filtres d'une voiture invulnérable ou fantôme (capteurs gardés).
  - `code-review` sur le diff.
  - Tours (≤ 5), un commit `fix:` chacun.
- [ ] **Step 7 : Validation du papa** : capture d'une étoile prise par un copain encore visible, chiffre du rattrapage. Puis commit `docs: tâche 5d validée, passation et registre`, `git status -sb` et push.

---

### Task 5e (ajoutée) : Bouton saut et étoiles hautes (Galahad)

**Saut §1–§2 :**
- **Bouton :** rond, ≥ 140 px, en bas à gauche, `data-no-pedal`.
- **Front d'appui :** `pointerdown` sur le bouton, ou `keydown` Espace non répété.
- **Conditions :**
  - au moins une roue au sol au sens du contact débouncé (ruling Q6) ;
  - `JUMP_COOLDOWN` écoulé ;
  - course en cours.
- **Physique :** `JUMP_VY` s'ajoute aux 3 pièces, sauf réponse contraire du papa (Q-P3).
- **Étoiles hautes :** jamais sur le plat de lancement ni sur l'élan.

**Files:**
- Create: `src/cars/jump.ts`, `src/input/jump.ts`, `src/ui/jump-button.ts`, `src/sim/harness.ts`, `tests/helpers/jump-runs.ts`
- Modify:
  - `src/config.ts` (ci-dessous).
  - `src/physics/car.ts` (`applyJump`).
  - `src/cars/state.ts` (`lastJumpAt: number | null`, `null` dans `newCarState`).
  - `src/sim/simulate.ts` :
    - `stepRace(sim, galahadThrottle, galahadJump = false)` ;
    - `CarSim.grounded` ;
    - `'jump'` ;
    - `jumpReady` ;
    - `simulateRace` et ses aides (`StuckMeter`, `carPairsTouching`, `SimulateResult`) déplacés dans `src/sim/harness.ts`. **Pas de réexport** : tous les imports sont migrés dans le même commit (`tests/helpers/race.ts`, `runs.ts`, `phases.ts`, `tests/simulate.test.ts`, `race-smoke.test.ts`, `fantomes.test.ts`, `respawn-e2e.test.ts`, `tests/slow/*.test.ts`). C'est l'héritage de la 5b, avancé ici puisque la 5e ajoute du code au harnais.
  - `src/sim/harness.ts` : `simulateRace` gagne l'option `jump?: (t: number, sim: RaceSim) => boolean` (demande de Galahad à chaque pas, défaut : jamais) et `highStarsByCar`.
  - `src/track/types.ts` (`Star.high: boolean`) et `src/track/stars.ts`.
  - `src/ui/hud.ts` : `.hud-fps` et `.hud-steps` passent **sous** le bouton (bande `left: 28px; bottom: 6px`, bouton à `bottom: 40px`) ; non chevauchement testé en jsdom.
  - `src/game.ts` :
    - `JumpInput` et `JumpButton` ;
    - la demande va au **premier** pas de l'image, ou reste en attente si l'image a 0 pas ;
    - bouton grisé ;
    - poussière sur `'jump'` ;
    - en debug : `__game.jumps` et `__game.throttlePressed`.
  - `e2e/helpers.ts` : `tapJump`, `holdFingerAndTapJump`.
  - **Étoiles en hauteur, consommateurs de `Star` et de « y = sol + 0,6 » :**
    - `tests/stars.test.ts:75` et `:204` (« y − sol ≈ 0,6 » réservé aux étoiles basses) ;
    - `tests/turbo.test.ts:38,43` (littéraux `Star` sans `high`) ;
    - `tests/race-smoke.test.ts:28-29` et `tests/helpers/phases.ts:485` (bornes « 6 à 14 étoiles prises » doigt posé, voir ruling Q5) ;
    - `tests/slow/finish.test.ts` (cas 6, même ruling) ;
    - `tests/simulate.test.ts` et `tests/empreinte.test.ts` (cfg selon le tableau des Global Constraints) ;
    - `tests/smoke.test.ts`.
- Test: `tests/jump.test.ts`, `tests/jump-input.test.ts` (jsdom), `tests/hud.test.ts` (jsdom, placement), `tests/high-stars.test.ts`, `tests/high-stars-window.test.ts` (garde CI), `tests/slow/calibration-saut.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan.test.ts`, `e2e/jump.spec.ts`

**Interfaces :**
```ts
// src/config.ts — avant le littéral
const GRAVITY = 4.9;     // m/s², remplace le littéral GRAVITY: 4.9
const JUMP_APEX = 2.5;   // m : apogée du châssis au-dessus de sa hauteur de roulage à l'arrêt (saut §1)
GRAVITY,
JUMP_APEX,
JUMP_VY: Math.sqrt(2 * GRAVITY * JUMP_APEX),   // ≈ 4,95 m/s ; corrigée par la mesure du Step 2 si l'apogée sort de ±10 % (consigné)
JUMP_COOLDOWN: 0.5,                            // s depuis le dernier saut de cette voiture
JUMP_BUFFER: 0 /* ou 0,1 selon Q-P2 */,         // s : mémoire d'une demande refusée
JUMP_BUTTON_SIZE_PX: 150,                      // px CSS (≥ 140)
STAR_HIGH_SHARE: /* selon Q-P1 */,
STAR_HIGH_Y: /* calibré au Step 7, départ 3,85 */,               // m au-dessus du sol local (centre)
STAR_HIGH_RAMP_CLEARANCE: /* calibré, départ 70 */,              // m après la fin d'une rampe-saut
STAR_HIGH_BUMP_CLEARANCE: /* calibré, départ 12 */,              // m après la fin d'une bosses ou double-bosse
// src/cars/jump.ts (pur)
export function canJump(o: { lastJumpAt: number | null; grounded: boolean; finished: boolean; t: number }, cfg: Config): boolean;
// src/physics/car.ts
/** Ajoute JUMP_VY (m/s, vers le haut du monde) au châssis et aux deux roues ; vx inchangée. Hors de tout callback de collision. */
export function applyJump(car: CarBody, cfg: Config): void;
// src/sim/simulate.ts
| { type: 'jump'; carId: string; t: number; x: number }
export function stepRace(sim: RaceSim, galahadThrottle: boolean, galahadJump?: boolean): void;
export function jumpReady(sim: RaceSim, index: number): boolean;
// src/input/jump.ts
export class JumpInput { constructor(target: Window, button: HTMLElement); take(): boolean; clear(): void; dispose(): void }
// src/ui/jump-button.ts
export class JumpButton { constructor(root: HTMLElement, cfg: Config); readonly el: HTMLButtonElement; setReady(ready: boolean): void }
// tests/helpers/jump-runs.ts
export function jumpRun(world: World, opts: { x0: number; v: number; jumpAtStep: number; maxSeconds: number; cfg?: Config }):
  { jumped: boolean; starTaken: number[]; respawnWithin3s: boolean; apexY: number; trace: CarPose[] };
export function flatJumpTrajectory(v: number, cfg: Config): CarPose[];   // une trajectoire de saut sur plat, par vitesse
export function windowFor(world: World, star: Star, v: number, cfg: Config): { start: number; end: number; seconds: number; centreLead: number };   // dichotomie des bords
```

**Règles de mise en œuvre :**
- **Ordre dans `stepRace`**, pour chaque voiture, après `updateGroundContact` (pour avoir le `grounded` du pas) et avant `stepWorld` :
  1. `want = car.driver ? false : galahadJump`. Les copains arrivent en tâche 6.
  2. Si `JUMP_BUFFER > 0`, une demande refusée reste valable pendant `JUMP_BUFFER`.
  3. Si `want && canJump(...)` : `applyJump(car.body, cfg)`, `state.lastJumpAt = t` et événement `'jump'`.
  4. `CarSim.grounded = grounded[0] || grounded[1]`.
- **`applyJump` :** `Body.setVelocity(p, { x: p.velocity.x, y: p.velocity.y − mpsToPxPerStep(JUMP_VY) })` pour chaque pièce.
- **`Game` :**
  - `const jump = steps > 0 && this.jumpInput.take()` ;
  - `stepRace(sim, pressed, i === 0 && jump)` ;
  - `jumpButton.setReady(jumpReady(sim, 0) && state === 'racing')` ;
  - après l'arrivée, `jumpInput.clear()`.
- **`JumpButton` :**
  - `position:absolute; left:28px; bottom:40px` ;
  - taille `JUMP_BUTTON_SIZE_PX`, `border-radius:50%` ;
  - `pointer-events:auto`, car `#hud` est à `none` ;
  - `touch-action:none`, `data-no-pedal`, ressort en SVG inline.

  Il est grisé par la classe `is-waiting` (opacité 0,4), **jamais par l'attribut `disabled`** : un bouton désactivé n'émet pas de `pointerdown` vers sa cible, et le tap risquerait d'être compté comme du gaz.
- **`JumpInput` :**
  - `pointerdown` sur le bouton, ou `keydown` avec `code === 'Space' && !repeat` (plus `preventDefault`), crée une demande ;
  - garder le doigt ou la touche ne relance rien ;
  - le `pointerId` du bouton n'entre jamais dans `Throttle` (`closest('[data-no-pedal]')`).
- **Ruling Q6 :** le contact débouncé laisse un saut possible jusqu'à 0,1 s après un décollage, par exemple juste après le sommet d'une rampe. On garde la règle de l'addendum et on mesure l'effet au Step 12.

**Étoiles hautes : constat de la relecture adversariale (C1, calculé) :**
- Avec les règles du v1, la part d'étoiles hautes atteignable n'est que de **0,18** des étoiles du curseur, et de **0,05** si on exclut aussi les plats qui suivent une `bosses` ou une `double-bosse`. Règles du v1 : étoiles du curseur sur une tranche `plat` seulement (hors départ et arrivée), ni réception, ni lancement, ni dans les 70 m après une rampe-saut.
- **Le « 1 sur 3 » est donc impossible tel quel.** La règle de placement dépend de la réponse **Q-P1** (Step 0).
- **Exclusions gardées et étendues (ruling Q2) :**
  - réception de volcan ;
  - `STAR_HIGH_RAMP_CLEARANCE` après une rampe-saut ;
  - `STAR_HIGH_BUMP_CLEARANCE` après une `bosses` ou une `double-bosse` (C2 : vols calculés de 3,6 m à 14 m/s, ≈ 8 m en turbo).
- **Placement selon l'option retenue en Q-P1 :**
  - **(a)** parmi les étoiles du curseur éligibles, `k = min(round(STAR_HIGH_SHARE × nCurseur), nÉligibles)`, tirées sans remise (Fisher-Yates partiel) ;
  - **(b)** des étoiles hautes **en plus**, une au milieu de chaque segment de plat éligible d'au moins `STAR_HIGH_MIN_SEGMENT` m, au plus `STAR_HIGH_PER_RACE`, tirées si elles sont trop nombreuses ;
  - **(c)** le générateur ajoute des plats éligibles (tranche `plat` sans voisin rampe ou bosses) ;
  - **(d)** les plats d'après bosses deviennent éligibles, avec une étoile plus haute (`STAR_HIGH_Y_AFTER_BUMP`).

  Dans tous les cas : tirages **après** tous les autres, `high: true`, `y = sol + STAR_HIGH_Y`, ids triés par x.
- **Tolérance (fixée ici, ajustée à l'option) :**
  - (a) : `nHautes = min(round(part × nCurseur), nÉligibles)` exactement par piste, et part mesurée ∈ [0,8 × part visée ; 1,2 × part visée] sur les graines 0 à 49 ;
  - (b) : entre 1 et `STAR_HIGH_PER_RACE` étoiles hautes sur au moins 45 pistes sur 50, et étoiles basses **identiques** (x et y) au code d'avant.

**Hauteur et fenêtre, ordre de grandeur (relecture adversariale I9, calculé) :**
- Châssis au repos ≈ sol + 0,70 m, apogée ≈ sol + 3,2 m.
- Les pièces couvrent [y_c − 0,70 ; y_c + 0,35] et le capteur a un rayon de 0,5 m. Sur le plat, à vitesse constante, la trajectoire du saut est la même à un décalage près. La fenêtre de décollage vaut donc W ≈ T_contact(h) + ≈ 3,4 m / v.
- **Sensibilité très forte :** W ≈ 0,55 s pour une étoile à 3,9 m, 0,24 s à 4,0 m, 0 à 4,1 m.
- Conséquences :
  - **marge exigée** : la valeur choisie doit tenir ≥ 0,3 s aussi à `STAR_HIGH_Y + 0,05 m` ;
  - **recalibrage obligatoire** si `JUMP_VY`, la gravité, la suspension ou la géométrie des roues changent. C'est le rôle du test de garde CI `tests/high-stars-window.test.ts`, une étoile par vitesse, qui échoue si la fenêtre tombe sous 0,3 s ;
  - commentaire dans `config.ts`.

- [ ] **Step 0 : Réponses du papa (bloquant).** Poser les questions **Q-P1** (étoiles hautes : part et placement), **Q-P2** (mémoire de 0,1 s) et **Q-P3** (saut sur une pente : s'ajoute ou remplace) de la section « Questions pour le papa ». Consigner les réponses au registre. Elles fixent `STAR_HIGH_SHARE` et l'option de placement, `JUMP_BUFFER`, et la formule d'`applyJump`. Pour Q-P3, si la réponse est « remplace », alors `vy = −mpsToPxPerStep(JUMP_VY)`, et l'interface ne change pas.
- [ ] **Step 1 : Tests rouges du saut.**
  - `tests/jump.test.ts` (CI), piste `onlyPlat` ou graine 1, voiture seule :
    - **apogée :** 2 s au repos, `y0` = y du châssis ; on saute, et `max(y) − y0` ∈ [2,25 ; 2,75] ;
    - **vx gardée :** lancée à 14 m/s, vx avant et après `applyJump` à 1e-9 ;
    - **au sol seulement (I4) :**
      - demande **0,7 s après le décollage** (bien au-delà du débounce de 0,1 s), donc pas de `'jump'` et vy inchangée ;
      - voiture lâchée de 2 m au-dessus du sol, sans saut préalable, avec une demande à chaque pas pendant la chute, donc aucun saut avant le contact ;
    - **délai (I4) :** avec `cfg = { ...CONFIG, JUMP_VY: 0.5 }`, vol < 0,25 s, donc le délai est le seul frein. Une demande à chaque pas pendant 3 s donne des sauts espacés de 0,5 s ± 1 pas, dont le premier au pas 0 ;
    - **`canJump`** en table : `lastJumpAt` null, t − 0,49, t − 0,5 ; grounded ; finished ;
    - **après l'arrivée :** demande ignorée ;
    - **bouton grisé en l'air :** `jumpReady(sim, 0)` est faux du 7e pas après le décollage jusqu'au retour au sol, et pendant les 0,5 s du délai ;
    - **déterminisme :** même calendrier de demandes, même empreinte à chaque pas ;
    - **sans demande :** `stepRace(sim, t)` ≡ `stepRace(sim, t, false)`.
  - `tests/jump-input.test.ts` (jsdom) :
    - `pointerdown` sur le bouton : `take()` vaut vrai puis faux, et `Throttle.pressed` reste faux (« aucune trace de gaz ») ;
    - doigt maintenu : un seul `take()` vrai ;
    - Espace : une demande ; Espace avec `repeat: true` : rien ; autre touche : rien ;
    - `pointerdown` ailleurs : gaz, aucune demande ;
    - bouton ≥ 140 px, `data-no-pedal`, en bas à gauche, jamais `disabled` après `setReady(false)`.
  - `tests/hud.test.ts` (jsdom) : `.hud-fps` et `.hud-steps` ne chevauchent pas le bouton.
  - Commande : `npx vitest run tests/jump.test.ts tests/jump-input.test.ts tests/hud.test.ts`. **ROUGE.**
- [ ] **Step 2 : Implémenter le saut**, puis **VERT**.
  - Mesurer l'apogée réel à l'arrêt et à 14 m/s et le consigner. S'il sort de ±10 %, corriger `JUMP_VY` par un facteur mesuré, écrit dans le commentaire.
  - `npm run typecheck`, `npm test` (empreinte inchangée : aucune demande, aucune étoile haute encore).
- [ ] **Step 3 : e2e.** `e2e/jump.spec.ts`, avec `?seed=1&debug=1`.
  - **Tap seul :** CDP `touchStart` au centre du bouton, `__game.throttlePressed` lu **pendant** que le doigt est posé, puis `touchEnd`. Attendu : `jumps` passe de 0 à 1, et `throttlePressed` reste faux.
  - **Gaz + tap :**
    1. `touchStart` [A = (640, 400)] ;
    2. 1 s plus tard, `touchStart` [A, B = centre du bouton] ;
    3. 0,2 s plus tard, `touchMove` [A] seul : CDP relâche B par comparaison à l'événement précédent ; le helper vérifie que `throttlePressed` reste vrai ;
    4. 2 s plus tard, `touchEnd`.

    Attendu : `jumps` = 1, et la progression de Galahad entre la pose de A et la fin dépasse 10 m.
  - **Espace :** un saut ; un keydown avec `repeat: true` ne donne rien.
  - Capture `e2e/screenshots/bouton-saut.png`.
  - Commande : `npm run e2e`.
- [ ] **Step 4 : Commit** `feat: bouton saut (applyJump, délai, front d'appui, Espace)`.
- [ ] **Step 5 : Harnais.** `tests/helpers/jump-runs.ts` (`jumpRun`, `flatJumpTrajectory`, `windowFor`) et l'option `jump` de `simulateRace`. `tests/high-stars-window.test.ts` démarre en vérifiant `flatJumpTrajectory` : apogée cohérent avec le Step 2, à 1 cm près.
- [ ] **Step 6 : Tests de placement (rouges, puis implémentation et vert).** `tests/high-stars.test.ts` (CI, statique, graines 0 à 49, 1 680 m) :
  - tolérance de l'option retenue ;
  - aucune étoile haute dans `[xLancement, xLava]` ;
  - aucune sur une réception, ni dans les clearances après une rampe-saut ou une bosse ;
  - aucune étoile d'élan haute ;
  - y = sol + `STAR_HIGH_Y` ou sol + 0,6 ;
  - déterminisme ;
  - **les x de toutes les étoiles basses sont identiques entre `STAR_HIGH_SHARE: 0` et la valeur retenue**, et pour (a) le nombre total d'étoiles aussi ;
  - avec `STAR_HIGH_SHARE: 0`, étoiles égales au code d'avant (x, y, `high: false`).

  Commande : `npx vitest run tests/high-stars.test.ts tests/stars.test.ts`.
- [ ] **Step 7 : Calibration mesurée de la hauteur (I8).** `tests/slow/calibration-saut.test.ts` mesure, et n'asserte que la fin du balayage.
  1. **Une trajectoire par vitesse :** `flatJumpTrajectory` à 11,2 m/s (`V_CRUISE`) et à 14 m/s (`V_MAX`), plus 21 m/s pour information.
  2. **Pour chaque hauteur candidate** `STAR_HIGH_Y` ∈ {3,60 ; 3,65 ; … ; 4,05} (pas de 5 cm, vu la sensibilité) et **chaque étoile haute** des graines 0 à 9 :
     - **(a) Garde au sol :** Galahad doigt posé à `V_MAX`, puis en turbo (`activateTurbo` 20 m avant) ; distance minimale entre les pièces et le capteur, prises éventuelles.
     - **(b) Fenêtre :** fenêtre géométrique prédite par la trajectoire, puis **dichotomie des deux bords** en simulation réelle (`windowFor`, monde rogné `croppedWorld` de `tests/helpers/phases.ts`, ≈ 14 runs par étoile et par vitesse au lieu d'un balayage pas à pas). On garde la fenêtre en secondes, son centre en « temps avant l'étoile » (qui devient `JUMP_STAR_LEAD` en tâche 6), et les respawns dans les 3 s qui suivent l'atterrissage.
     - **(c) Vols :** prises sans saut, à 5 voitures, graines 0 à 23, pour chaque clearance candidate (rampe-saut {50, 60, 70, 80} ; bosses {8, 12, 16}).
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/calibration-saut.test.ts`.
- [ ] **Step 8 : Tableau pour le papa**, qui choisit :

  | `STAR_HIGH_Y` (m) | garde au sol min, V_MAX / turbo (m) | prises sans saut | fenêtre min 11,2 m/s (s) | fenêtre min 14 m/s (s) | médiane (s) | fenêtre min à +5 cm (s) | respawns à l'atterrissage |
  |---|---|---|---|---|---|---|---|
  | 3,60 … 4,05 | | | | | | | |

  On y joint le tableau des clearances et une capture d'une étoile haute vue sur la tablette.

  **Recommandation :** la plus haute valeur où **toutes** les étoiles ont une fenêtre ≥ 0,3 s aux **deux** vitesses (ruling Q4), y compris à +5 cm, avec 0 prise sans saut ; viser ≈ 0,4 s.

  Valeur choisie : écrite dans `config.ts` avec un commentaire des mesures, la sensibilité et l'obligation de recalibrer. Consignée au registre.
- [ ] **Step 9 : Acceptation.**
  - `tests/slow/high-stars-sim.test.ts` :
    - doigt posé sans saut, turbo compris, 5 voitures, graines 0 à 23 : **0** `'star'` sur une étoile `high` (`highStarsByCar`) ;
    - même chose pour Galahad seul en turbo forcé devant chaque étoile haute des graines 0 à 9 ;
    - pour chaque étoile haute des graines 0 à 9 : fenêtre ≥ 0,3 s à 11,2 et à 14 m/s, sans respawn (`windowFor`).
  - `tests/high-stars-window.test.ts` (CI) : graine 1, première étoile haute, deux vitesses, fenêtre ≥ 0,3 s.
  - `tests/slow/saut-volcan.test.ts` :
    - doigt posé sans saut, 0 chute de Galahad (rappel de `race-invariants-*`) ;
    - **un saut mal placé peut faire tomber :** Galahad doigt posé depuis `xLancement`, saut demandé (option `jump`) à chaque x ∈ [xElanStart − 10, xLip] au pas de 0,5 m, premiers volcans des graines 0 à 4. La part de lave par position est imprimée, et au moins une position doit tomber (saut §4).
  - **Ruling Q5, option (a)**, si l'option Q-P1 change des étoiles basses :
    - le cas 6 de `tests/slow/finish.test.ts`, `tests/race-smoke.test.ts:28-29` et `tests/helpers/phases.ts:485` comptent les étoiles **basses** de la piste, avec « prises ≥ basses − 1 et ≤ 14 » ;
    - avec l'option (b), ces bornes ne changent pas.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/high-stars-sim.test.ts tests/slow/saut-volcan.test.ts`.
- [ ] **Step 10 : Non-régression.**
  - `PLAN_A_TRACE` et `tests/empreinte.test.ts` : inchangés avec l'option (b) ; sinon cfg `{ ...CONFIG, STAR_HIGH_SHARE: 0 }` et commentaire, selon le tableau des Global Constraints.
  - `npm run typecheck`, `npm test`, `npm run test:slow`, `npm run e2e`.
  - Mesure « après 5e » de `rattrapage-*` (appariée), puis registre.
- [ ] **Step 11 : Commit** `feat: étoiles hautes, placement et hauteur calibrés`.
- [ ] **Step 12 : Relectures.**
  - Relecture standard.
  - Relecture adversariale. Sondes physiques :
    - saut à chaque x d'un volcan ;
    - saut depuis un toit ;
    - saut dans les 0,1 s après un sommet (Q6, mesuré : hauteur et portée gagnées) ;
    - saut en turbo ;
    - saut juste après un respawn ;
    - saut sur les bosses (retournements) ;
    - apogée selon la vitesse et la pente (Q-P3) ;
    - étoile haute prise en vol de rampe-saut turbo ;
    - doigt qui glisse du bouton vers l'écran ;
    - Espace maintenu ;
    - demande pendant une image à 0 pas.
  - `code-review` sur le diff.
  - Tours (≤ 5), un commit `fix:` chacun.
- [ ] **Step 13 : Validation du papa et de Galahad.** Galahad comprend-il le bouton seul ? Un saut raté se voit-il et coûte-t-il quelque chose (saut §0) ? Puis commit `docs: tâche 5e validée, passation et registre` (apogée, tableaux, valeurs, rattrapage), `git status -sb` et push.

---

### Task 6 : Conduite des robots (remplace la tâche 6 du plan v2.1)

**Files:**
- Create: `src/ai/driver.ts`
- Modify:
  - `src/cars/pilots.ts` (`jumpTry`, `jumpSkill` ; `GALAHAD` à 0 et 0).
  - `src/sim/simulate.ts` :
    - `Driver` renvoie `{ throttle, jump }`, contexte élargi ;
    - `holdAfterStartDelay` remplacé par `makeRobotDriver` ;
    - garde « jamais de saut de robot dans `inNoJumpZone` » ;
    - commentaire du champ `ghost` mis à jour (zone jusqu'à la roue arrière, héritage de la 5b).
  - `src/track/query.ts` (`inNoJumpZone`).
  - `src/config.ts` : `POLITE_SPEED` (2), `POLITE_GAP` (4), `POLITE_MAX_WAIT` (3, ruling Q8), `LIFT_LOOKAHEAD` (8), `LIFT_SECONDS` (0,4), `JUMP_LOOKAHEAD` (**40**), `JUMP_STAR_LEAD` (mesuré en 5e Step 7).
  - `tests/deps.test.ts` (`src/{track,cars,loop,ai}`).
  - **Drivers écrits à la main dans les tests** (`() => boolean`, à migrer vers `() => ({ throttle, jump: false })`) :
    - `tests/fantomes.test.ts` l. 24, 69, 114, 122 et 131 ;
    - `tests/race-smoke.test.ts:60` ;
    - `tests/respawn-e2e.test.ts:199` et `:231` ;
    - `tests/simulate.test.ts:192`, plus les tests du driver provisoire de `simulate.test.ts`.
  - `tests/simulate.test.ts` : `carOf` remplacé par `carPairsTouching`/`chassisX` (héritage de la 5b).
  - `tests/pilots.test.ts` (nouveaux traits).
  - `e2e/race.spec.ts` (`BEFORE_ROBOTS_S` 0,8 → 2).
- Test: `tests/driver.test.ts`, `tests/pilots.test.ts`, `tests/slow/robots-sauts-0-23.test.ts`, `tests/slow/robots-sauts-24-47.test.ts`, `tests/slow/rattrapage-*.test.ts` (relancés), `tests/slow/race-invariants-*.test.ts`

**Interfaces :**
```ts
// src/sim/simulate.ts
export interface DriverContext {
  t: number; state: CarState; track: Track; speed: number;
  x: number; grounded: boolean;
  /** Autres voitures, dans l'ordre des index (index = celui de sim.cars). */
  others: readonly { index: number; x: number; speed: number }[];
  /** Étoile haute la plus proche devant, à moins de JUMP_LOOKAHEAD (40 m), avec sa disponibilité pour CETTE voiture ; null sinon. */
  nextHighStar: { index: number; x: number; available: boolean } | null;
}
export type Driver = (ctx: DriverContext) => { throttle: boolean; jump: boolean };
// src/ai/driver.ts (pur)
export function makeRobotDriver(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): Driver;
// src/track/query.ts
export function inNoJumpZone(track: Track, x: number): boolean;   // x ∈ [xLancement, xReception] d'un volcan
// src/cars/pilots.ts
readonly jumpTry: number;    // [0 ; 1]
readonly jumpSkill: number;  // s : écart-type de l'erreur sur l'instant du saut
```
Graine du driver : `(sim.pilotSeed + rank × 0x9e3779b9) >>> 0`. Elle ne dépend pas de la graine de piste, et ENCORE rejoue les mêmes sauts.

**Règles** (spec §7, addendum §1.8, saut §3, texte v2.1 repris), par priorité :
1. **Après `finishedAt` :** ignoré, le pas freine.
2. **Délai de départ :** `{ throttle: false, jump: false }` tant que `t < rank × START_DELAY_PER_RANK`.
3. **Zone volcan `[xLancement, xLava]` :** `throttle: true`, jamais de lever de pied ni de politesse. **Saut interdit sur `[xLancement, xReception]`**, dans le driver **et** par la garde de `stepRace` pour toute voiture qui a un driver.
4. **Robots polis** (décision du papa, 5b) :
   - hors zone volcan, `throttle: false` si une autre voiture roule à moins de `POLITE_SPEED` et se trouve devant, à une distance de châssis à châssis dans `(0, POLITE_GAP]` ;
   - au-delà de `POLITE_MAX_WAIT` = 3 s d'attente continue derrière la même voiture (ruling Q8), le robot repart ;
   - l'attente revient à zéro dès que la voiture de devant repart ;
   - doigt levé : le chronomètre de blocage ne court pas (voulu).
5. **Lever de pied :** quand x entre dans les `LIFT_LOOKAHEAD` m avant `xStart` d'une `rampe-saut` ou d'une `double-bosse`, on tire une fois par tranche `rng() < pilot.lift`. Si le tirage tombe, le doigt est levé **pendant** `LIFT_SECONDS`, à partir de ce premier pas. Jamais dans un `cratère` (tâche 15).
6. **Saut des copains (saut §3) :**
   - À la création du driver, pour chaque étoile haute dans l'ordre de la piste, on pré-tire `essaie = rng() < jumpTry`, puis `erreur = N(0, jumpSkill)` (Box-Muller sur le même rng). Un respawn qui ramène le robot devant la même étoile rejoue la même décision.
   - Quand `nextHighStar` est disponible et que `essaie` est vrai, il saute dès que `(xÉtoile − x) / max(speed, 1) ≤ JUMP_STAR_LEAD + erreur`.
   - La demande reste maintenue jusqu'au saut ou jusqu'au passage de l'étoile ; `canJump` filtre.
   - Il peut rater, mal retomber, se retourner.
7. Sinon `{ throttle: true, jump: false }`.

**Traits proposés, À VALIDER PAR LE PAPA** (Step 0). La fenêtre de l'étoile fait au moins 0,3 s, soit ±0,15 s, visée ±0,2 s. Le raté par l'erreur seule vaut donc ≈ P(|N(0, σ)| > 0,15–0,2 s) :

| Pilote | Caractère | `jumpTry` | `jumpSkill` (s) | Raté attendu par l'erreur seule [ESTIMÉ] |
|---|---|---|---|---|
| Pablo | fonceur | 0,80 | 0,18 | ≈ 27–40 % |
| Matthis | fonceur | 0,75 | 0,15 | ≈ 18–32 % |
| Diego | moyen | 0,55 | 0,10 | ≈ 5–13 % |
| Malo | moyen | 0,50 | 0,09 | ≈ 3–10 % |
| Timothée | prudent | 0,30 | 0,04 | ≈ 0 % |
| Liam | prudent | 0,30 | 0,05 | ≈ 0 % |

**Puissance des mesures (I7) :**
- Avec ≈ 1 à 3 étoiles hautes par course (selon Q-P1) et 4 copains sur 6, un fonceur donné court dans 2/3 des courses. Sur 48 graines, on attend ≈ 60 à 190 tentatives des fonceurs et ≈ 20 à 70 des prudents.
- Pour ne pas dépendre du tirage des pilotes, la comparaison « fonceurs ratent plus que prudents » est **appariée par graine** : chaque graine est jouée deux fois, une fois avec les traits de saut de Pablo pour les 4 copains, une fois avec ceux de Timothée. Mêmes courses, seul le trait change.
- On exige au moins 40 tentatives par bras. Sinon on passe à 96 graines (≈ 50 min mur, 4 fichiers).

- [ ] **Step 0 : Réponses du papa (bloquant).** Valider le tableau des traits (Q-P4), avec une phrase par copain (« Pablo saute presque toujours, souvent trop tôt ou trop tard »). Les valeurs sont gardées ou changées, et consignées.
- [ ] **Step 1 : Tests rouges.** `tests/driver.test.ts`, pur, contexte fabriqué à la main :
  - **délai :** `throttle` faux tant que `t < rank × 0,3`, puis vrai ;
  - **zone volcan :** `throttle` jamais faux dans `[xLancement, xLava]`, même avec `lift = 1` et une voiture arrêtée devant ;
  - **lift :**
    - avec `lift = 1`, le doigt est levé pendant 24 pas ± 1, à partir du premier pas dans les 8 m avant chaque rampe-saut et chaque double-bosse, puis reposé ;
    - avec `lift = 0`, jamais levé ;
  - **politesse :**
    - voiture devant à 3 m, à 1 m/s : `false` ;
    - à 3 m, à 5 m/s : `true` ;
    - à 6 m : `true` ;
    - derrière : `true` ;
    - en zone volcan : `true` ;
    - après 3 s d'attente : `true` ;
  - **saut :**
    - `jumpTry = 1` et `jumpSkill = 0` : `jump` passe à vrai au premier pas où `(xÉtoile − x) / v ≤ JUMP_STAR_LEAD` ;
    - `jumpTry = 0` : jamais ;
    - étoile indisponible : jamais ;
    - **jamais `jump: true` dans `inNoJumpZone`** : balayage de x au pas de 0,1 m sur tous les volcans des graines 0 à 19, avec `jumpTry = 1` et des étoiles hautes fictives juste après chaque réception ;
  - **déterminisme :** même graine, mêmes sorties ; deux rangs, deux tirages différents.

  `tests/pilots.test.ts` :
  - `jumpTry` ∈ [0 ; 1] et `jumpSkill` ∈ [0,02 ; 0,25] ;
  - `jumpTry` : fonceurs > moyens > prudents ;
  - `jumpSkill` : prudents < moyens < fonceurs ;
  - Galahad à 0 et 0.

  Commande : `npx vitest run tests/driver.test.ts tests/pilots.test.ts`. **ROUGE.**
- [ ] **Step 2 : Implémenter** (driver, traits, `Driver`, contexte, garde, migration des drivers de test), puis **VERT** : `npm run typecheck`, `npm test` (empreinte inchangée).
- [ ] **Step 3 : Mesures (suite lente).** `tests/slow/robots-sauts-*.test.ts`, 5 voitures, graines 0 à 47, Galahad doigt posé.
  - **Aucun saut de copain en zone volcan :** 0 `'jump'` de robot avec `inNoJumpZone(x)`.
  - **Fonceurs contre prudents**, en appariement par graine (ci-dessus). Par bras : tentatives, étoiles prises au saut, ratés (saut sans étoile dans les 2,5 s), respawns dans les 3 s.
    - Assertion : ≥ 40 tentatives par bras, et taux de raté « Pablo » > taux « Timothée ».
    - On imprime aussi, pour information, les mêmes chiffres en tirage normal, par pilote.
  - **Déterminisme :** graine 3 jouée deux fois, même empreinte finale et même liste de `'jump'`.
  - **Invariants :** ≤ 3 respawns par robot, blocage ≤ 2,1 s, `lavaByCar.galahad === 0`, `ghostContacts === 0`. Si les sauts font dépasser 3 respawns, **on ne relâche pas** la limite : on mesure, le papa choisit entre baisser `jumpTry` et accepter.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/robots-sauts-0-23.test.ts tests/slow/robots-sauts-24-47.test.ts`.
- [ ] **Step 4 : Seuils de politesse.**
  - Sonde « grille » : Galahad arrêté 10 s, puis doigt posé (graines 0 à 4). On mesure le premier contact copain–Galahad, le recul de Galahad et l'ordre de départ.
  - Sonde « bouchon » : un copain retourné ou arrêté au milieu d'un plat.
  - On fixe `POLITE_SPEED` et `POLITE_GAP` (registre). Puis `npx vitest run tests/race-smoke.test.ts` vert et `npm run e2e`, avec la fenêtre « sans doigt » de 2 s.
- [ ] **Step 5 : Rattrapage « après 6 »** (`rattrapage-*` relancés).
  - Comparaison appariée par graine : **avant la 5d / après 5d / après 5e / après 6**. Part des courses gagnées par la voiture de la première étoile, et place moyenne de Galahad.
  - **Variante « Galahad sauteur »** (ruling Q9) : même lot, avec l'option `jump` de `simulateRace` pilotée par un driver de test (`makeRobotDriver` avec des traits `jumpTry` 1 et `jumpSkill` 0,05 appliqués à Galahad).
  - Chiffres consignés dans la passation, sans assertion chiffrée.
- [ ] **Step 6 : Suites :** `npm run typecheck`, `npm test` (< 6 min), `npm run test:slow`, `npm run e2e`.
- [ ] **Step 7 : Commit** `feat: conduite des robots (départ, lever de pied, robots polis, sauts des copains)`.
- [ ] **Step 8 : Relectures.**
  - Relecture standard.
  - Relecture adversariale. Sondes :
    - mutant « garde du driver retirée » : la garde de `stepRace` et un test le voient-ils ? ;
    - copain qui saute sur un autre ;
    - saut pendant le fantôme de sortie de zone ;
    - interblocage poli entre deux copains arrêtés ;
    - respawn avant une étoile déjà tirée ;
    - turbo pendant l'approche (`JUMP_STAR_LEAD`) ;
    - allocations de `others` par pas.
  - `code-review` sur le diff.
  - Tours (≤ 5), un commit `fix:` chacun.
- [ ] **Step 9 : Validation du papa** : test tablette à 5 voitures. Les copains sautent-ils de façon crédible ? La course est-elle encore jouée d'avance ? Puis commit `docs: tâche 6 validée, passation et registre`, `git status -sb` et push. Ensuite la tâche 7 du plan v2.1. Après 6 et 7, le papa rejuge la difficulté (`ENGINE_BRAKE`, plan C).

---

## Rulings du plan (ambiguïtés de l'addendum tranchées ici, à confirmer par la relecture)

- **Q2 — Où les étoiles hautes sont exclues.** Exclusions gardées et étendues :
  - plat de réception ;
  - `STAR_HIGH_RAMP_CLEARANCE` après une rampe-saut ;
  - `STAR_HIGH_BUMP_CLEARANCE` après une `bosses` ou une `double-bosse` (vols calculés de 3,6 m à 14 m/s, ≈ 8 m en turbo).

  Sans elles, un vol doigt posé prendrait une étoile haute, ce qui contredit saut §4.
- **Q4 — « Vitesse de croisière ».** La fenêtre ≥ 0,3 s est exigée à `V_CRUISE` (11,2 m/s) **et** à `V_MAX` (14 m/s, la vitesse réelle doigt posé).
- **Q5 — Bornes « 6 à 14 étoiles prises » doigt posé** (addendum §1.7, cas 6). Option (a) : on compte les étoiles basses, avec « prises ≥ basses − 1 ». Avec l'option (b) de Q-P1, rien ne change.
- **Q6 — Saut juste après un décollage.** On garde le contact débouncé de l'addendum : un saut reste possible ≤ 0,1 s après un décollage. L'effet est mesuré en 5e (Step 12) et remonté au papa s'il est gênant.
- **Q7 — Bouton pendant le décompte ou la pause.** Renvoyé à la tâche 10 : les demandes y sont jetées (`JumpInput.clear`). L'affichage du bouton pendant le décompte se décide en tâche 10.
- **Q8 — Patience des robots polis.** `POLITE_MAX_WAIT` = 3 s, puis le robot repart (pousse et grimpe comme aujourd'hui). L'e2e exige au moins 2 s de patience.
- **Q9 — Rattrapage.** Mesure consignée, appariée par graine, sans seuil d'assertion, plus la variante « Galahad sauteur ».

## Questions pour le papa

Écrites pour être lues telles quelles. Une recommandation suit chaque question.

**Q-P1. Les étoiles en hauteur : combien, et où ?** *(bloque la 5e, Step 0)*

On voulait environ 1 étoile sur 3 en hauteur. Mais une étoile haute ne doit pas être prise par une voiture qui vole après une rampe, un volcan ou une bosse : sinon, on l'aurait sans appuyer sur le bouton. En retirant ces endroits, il ne reste de la place que pour environ **1 étoile sur 6** (18 %). Si l'on retire aussi tous les plats qui suivent une bosse, il n'en reste qu'**1 sur 20** (5 %). Quatre choix :
- **(a)** Moins d'étoiles hautes : environ 1 sur 6, soit une ou deux par course. Rien d'autre ne change.
- **(b)** Les étoiles hautes s'ajoutent aux étoiles habituelles, posées seulement aux bons endroits (2 ou 3 par course, à mesurer). Les étoiles du sol restent exactement comme aujourd'hui.
- **(c)** On change la fabrication des pistes pour créer plus de grands plats tranquilles. Toutes les pistes changent.
- **(d)** On met aussi des étoiles hautes après les bosses, mais encore plus haut, pour qu'un vol de bosse ne les touche pas. Elles seraient plus dures à attraper.

**Recommandation : (b).** C'est le seul choix qui garde le « 1 sur 3 » en esprit sans rien abîmer : les étoiles du sol, leur nombre, le minimum de 6 et les vérifications déjà faites restent identiques. Les étoiles hautes deviennent un bonus pour un bon saut. Le nombre total d'étoiles passe d'environ 9 à environ 11, ce qui reste dans la cible de 8 à 12. Si (b) donne trop peu de places, repli sur (a).

**Q-P2. Un appui un tout petit peu trop tôt doit-il compter ?** *(5e, Step 0)*

Aujourd'hui, un appui sur le bouton pendant que la voiture est encore en l'air est perdu. On peut le garder en mémoire 0,1 s : si la voiture touche le sol dans ce dixième de seconde, elle saute quand même.

**Recommandation : oui, 0,1 s.** C'est invisible et plus gentil pour un enfant de 5 ans, qui appuie souvent un peu trop tôt. On ne peut pas en abuser : le délai de 0,5 s entre deux sauts reste.

**Q-P3. Sauter dans une montée : plus haut, ou pareil ?** *(5e, Step 0)*

La règle écrite dit que le saut « s'ajoute » à la vitesse de la voiture. Sur le tremplin d'un volcan, la voiture monte déjà : en sautant au sommet, elle irait jusqu'à **environ 12 m de haut** au lieu de 2,5 m, et pourrait passer au-dessus de tout. Autre possibilité : le saut donne toujours la même poussée vers le haut, quelle que soit la pente, donc environ 2,5 m de plus que sans saut, partout.

**Recommandation : la même hauteur partout.** C'est plus facile à comprendre, et cela évite des super-sauts surprenants au-dessus des volcans. La règle écrite serait alors corrigée.

**Q-P4. Le caractère des copains pour sauter** *(tâche 6, Step 0)* : valider le tableau des traits (`jumpTry`, `jumpSkill`) de la tâche 6. Pablo et Matthis sautent presque toujours mais visent mal ; Diego et Malo sont au milieu ; Timothée et Liam sautent rarement mais visent juste.

**Recommandation : garder le tableau**, et revoir les chiffres après le test sur la tablette.

**Q-P5. Quand un copain prend une étoile, faut-il le montrer ?** *(5d, non bloquant)*

L'étoile reste visible pour Galahad, puisqu'il peut encore la prendre. On peut ajouter un petit scintillement de la couleur du copain, ou ne rien montrer.

**Recommandation : rien pour l'instant.** On verra au test sur la tablette si Galahad est surpris.
