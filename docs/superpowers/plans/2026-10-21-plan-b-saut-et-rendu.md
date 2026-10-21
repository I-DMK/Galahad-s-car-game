# Plan B (suite) — Rendu interpolé, étoiles pour tous, bouton saut, conduite des robots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. À chaque tâche : implémenteur frais, puis relecture standard + relecture adversariale par sous-agents frais **et** le skill `code-review` sur le diff de la tâche ; tours de correction (≤ 5) ; validation du papa ; passation mise à jour et commitée ; push.

**Statut :** v1, brouillon écrit le 2026-10-21 sur `wip-plan-b` (148240a), **non relu**. Il passe par les relectures standard, adversariale (avec sondes physiques) et `code-review`, puis par la validation du papa.

**Goal:** Supprimer le tremblement d'affichage (5f). Rendre la course rattrapable : chaque voiture a ses propres étoiles (5d), Galahad a un bouton saut et certaines étoiles sont en hauteur (5e). Les copains conduisent pour de vrai : départ échelonné, lever de pied, politesse, sauts plus ou moins bien placés (6).

**Architecture:** Inchangée (spec §4, plan v2.1).
- `track/`, `cars/`, `ai/` et `loop/` restent purs. L'interpolation des poses va dans `loop/interpolation.ts`, le compteur d'images dans `loop/frame-stats.ts`, la décision de saut dans `cars/jump.ts`, le pilote automatique dans `ai/driver.ts`.
- `physics/car.ts` porte la seule fonction de saut, `applyJump`.
- `sim/simulate.ts` garde le pas de course unique : `stepRace(sim, galahadThrottle, galahadJump)`.
- `render/` dessine des poses déjà interpolées.
- `input/jump.ts` (front d'appui) et `ui/jump-button.ts` (bouton DOM) s'ajoutent à côté de `input/throttle.ts` et de `ui/hud.ts`.

**Ordre d'exécution :** **5f → 5d → 5e → 6**, puis la tâche 7 du plan v2.1. Prérequis : la tâche 5c est validée et fusionnée sur `ccr-5b6fabc4-n96ofo`, comme le dit la passation (« Prochaine action » 2).

**Spec :**
- `docs/superpowers/specs/2026-10-21-bouton-saut-design.md` (validé) fait autorité pour 5d, 5e et 6. Références ci-dessous : « saut §n ».
- `docs/superpowers/handoff/2026-10-21-glitch-tremblement.md`, §5 à §7, pour 5f. Références : « tremblement §n ».
- Pour le reste : l'addendum plan B v3.1 (« addendum §n ») et le spec du 2026-10-20.

**Ce document remplace la tâche 6 du plan v2.1** (`2026-10-21-plan-b-copains-et-finitions.md`). Il garde tout ce qu'elle contenait : délai de départ, lever de pied, zone volcan, robots polis, héritages de la 5b. Les tâches 5f, 5d et 5e s'insèrent entre la 5c et la 6. La tâche 7 du plan v2.1 reste valable telle quelle. Une seule nuance : son objectif mesuré (`race-objective`) inclut désormais les sauts des copains, qui sont dans leur driver (saut §5).

## Global Constraints

Toutes celles du plan v2.1 restent valables : unités, pas fixe, roues 48 côtés, contact débouncé, aucun déplacement de corps dans un callback de collision, commits en français préfixés, aucun identifiant de modèle dans les commits. On rappelle ou on ajoute :

- **Typecheck et `npm test` verts à chaque commit** (`tsconfig.json` inclut `tests/`, et `deploy.yml` lance `npm run typecheck` puis `npm test`). **Jamais de `.skip`.** Une API n'est retirée que dans le commit qui migre son dernier consommateur.
- **Budget CI :** `npm test` reste sous 6 min mur sur le runner (≈ 3 min 05 ici, 329 tests). Toute simulation de course complète à 5 voitures, tout balayage et toute calibration vont dans `tests/slow/` (`npm run test:slow`). Vitest parallélise par fichier : on scinde les fichiers plutôt que de les allonger.
- **Déterminisme :** toute décision aléatoire (choix des étoiles hautes, tentative et erreur de saut des copains, lever de pied, gigue des écrans simulés) vient d'un `mulberry32` dérivé d'une graine. La graine de piste sert pour les étoiles, la graine de pilotes `sim.pilotSeed` pour les copains, une graine de test pour les écrans. `ENCORE` rejoue la même course.
- **Pureté :** `track/`, `cars/`, `ai/` et `loop/` n'importent ni matter-js ni le DOM. `tests/deps.test.ts` couvre `src/{track,cars,loop}` ; la tâche 6 y ajoute `ai`.
- **Galahad seul (`robots: false`) identique au bit près**, vérifié par la trace figée `PLAN_A_TRACE` (`tests/simulate.test.ts`) et par l'empreinte par pas que la tâche 5f fige (Step 1) :

  | Tâche | Galahad seul avec `CONFIG` | Pourquoi |
  |---|---|---|
  | 5f | **identique** | Seul le rendu change. `stepRace` n'est pas touché. |
  | 5d | **identique attendu** | Avec une seule voiture, l'état par voiture se comporte comme l'état partagé. Les capteurs d'étoile restent actifs (`syncStarBodies` disparaît), mais le solveur de Matter ignore les paires de capteurs. À vérifier : si l'empreinte bouge, on s'arrête, on mesure (ordre de `pairs.list` ?), le papa tranche, et le ruling va au registre. On ne recapture jamais en silence. |
  | 5e | **change** avec la configuration par défaut, **identique** avec `STAR_HIGH_SHARE: 0` | Environ un tiers des étoiles du curseur montent en hauteur, donc le doigt posé ne les prend plus et le turbo change. Les tirages des étoiles hautes viennent **après** tous les autres dans `placeStars`, qui est le dernier consommateur du rng de piste (`generate.ts:110`). Avec `galahadJump = false`, `applyJump` n'est jamais appelé. La trace figée et l'empreinte passent donc à `{ ...CONFIG, STAR_HIGH_SHARE: 0 }`, avec un commentaire, et le registre le note. |
  | 6 | **identique** | Galahad n'a pas de driver. |
- **Promesse de la 5c conservée** (saut §0) : doigt posé sans jamais sauter, on finit la course et on ne tombe jamais dans la lave. L'invariant `lavaByCar.galahad === 0` à 5 voitures sur les graines 0 à 23 (`tests/slow/race-invariants-*.test.ts`) reste vert à chaque tâche.
- Chaque nouveau paramètre va dans `src/config.ts` (que des nombres ; une constante dérivée est déclarée avant le littéral, comme `D_LANCE`).
- Après chaque tâche : `npm run typecheck`, `npm test`, `npm run test:slow` (≈ 12 min) et `npm run e2e`. Une capture va dans `e2e/screenshots/` quand l'écran change. Passation et registre sont mis à jour.
- **Arbre partagé :** jamais de `git reset`, `checkout`, `stash` ni `clean` pendant qu'un sous-agent travaille. Les sondes s'écrivent `tests/zz-probe-*.test.ts` et sont supprimées avant le commit.

## Review Focus

1. **Écran à 59,94 Hz, 60,05 Hz ou 120 Hz, avec gigue.** Attendu : aucun épisode de tremblement en mode interpolé. Une réapparition ne laisse pas de traînée. → 5f.
2. **Un copain prend une étoile juste devant Galahad.** Attendu : l'étoile reste visible et prenable par Galahad, qui a lui aussi son turbo. → 5d.
3. **Doigt posé, turbo compris, à 5 voitures.** Attendu : 0 étoile haute prise sans saut, 0 chute de Galahad. → 5e.
4. **Tap sur le bouton pendant que l'autre doigt accélère.** Attendu : la voiture avance et saute. Tap seul : un saut, aucun gaz. → 5e.
5. **Un copain fonceur tente une étoile haute juste après une réception.** Attendu : jamais de saut dans `[xLancement, xReception]`. Il peut mal retomber, ce qui coûte du temps, mais il ne dépasse jamais 3 respawns par course. → 6.
6. **Galahad arrêté sur la grille.** Attendu : les copains ne le poussent pas pendant au moins 2 s (robots polis). → 6.

---

## Structure des fichiers (nouveaux ou refondus)

```
src/loop/interpolation.ts     CarPose, lerpAngle, lerpCarPose, PoseHistory (5f)
src/loop/frame-stats.ts       StepHistogram : images à 0 pas et à ≥ 2 pas sur la dernière seconde (5f)
src/sim/simulate.ts           posesOf (5f) ; étoiles par voiture, starsByCar (5d) ; stepRace(sim, throttle, jump), événement 'jump' (5e) ; Driver { throttle, jump }, contexte élargi (6)
src/render/renderer.ts        Scene inchangée (les CarView arrivent déjà interpolées) ; étoile haute dessinée à sa hauteur (5e)
src/game.ts                   interpolation, caméra sur la pose interpolée, compteur debug (5f) ; bouton et Espace (5e)
src/ui/hud.ts                 setFrameSteps (5f)
src/cars/stars.ts             StarState par voiture : isStarActiveFor, takeStarFor (5d)
src/physics/stars.ts          capteurs toujours actifs, syncStarBodies retirée (5d)
src/cars/jump.ts              canJump (5e)
src/physics/car.ts            applyJump (5e)
src/cars/state.ts             CarState.lastJumpAt (5e)
src/track/types.ts            Star.high (5e)
src/track/stars.ts            étoiles hautes (5e)
src/input/jump.ts             JumpInput : front d'appui (bouton data-no-pedal, Espace non répété) (5e)
src/ui/jump-button.ts         JumpButton : rond ≥ 140 px en bas à gauche, ressort, grisé (5e)
src/cars/pilots.ts            Pilot.jumpTry, Pilot.jumpSkill (6)
src/ai/driver.ts              makeRobotDriver (6)
src/sim/harness.ts            simulateRace extrait de simulate.ts (6, héritage de la 5b)
src/track/query.ts            inNoJumpZone (6)
tests/helpers/frames.ts       écrans simulés, rejeu, détecteur d'épisodes (5f)
tests/helpers/fingerprint.ts  empreinte par pas (5f)
```

---

### Task 5f (ajoutée) : Rendu interpolé (tremblement)

**Constat (tremblement §5–§6, mesuré) :** `Game.present` dessine `sceneOf(sim)`, c'est-à-dire l'état du dernier pas, alors que `Camera.update(…, elapsed)` lisse au temps réel. Une image qui reçoit 0 ou 2 pas déplace donc les voitures de ±1 pas par rapport au décor : 13 px CSS à 14 m/s, 20 px en turbo. Sur un écran à 60,05 Hz avec 0,2 ms de gigue, on compte 75 épisodes sur 12 courses sans interpolation, contre 1 avec. Correctif retenu : la piste 1 du rapport (§7), qui coûte un pas de latence (16 ms).

**Files:**
- Create: `src/loop/interpolation.ts`, `src/loop/frame-stats.ts`, `tests/helpers/frames.ts`, `tests/helpers/fingerprint.ts`
- Modify: `src/sim/simulate.ts` (`posesOf`, `carView(sim, i, pose?)`, `sceneOf(sim, poses?)`), `src/game.ts` (`frame`, `present`), `src/ui/hud.ts` (`setFrameSteps`), `e2e/helpers.ts` (lecture de `frameSteps`)
- Test: `tests/interpolation.test.ts`, `tests/frame-stats.test.ts`, `tests/interpolation-replay.test.ts`, `tests/empreinte.test.ts`, `tests/slow/interpolation-replay-slow.test.ts`, `e2e/race.spec.ts`

**Interfaces :**
```ts
// src/loop/interpolation.ts (pur : n'importe que cars/angle.ts)
export interface PartPose { x: number; y: number; angle: number }          // monde : m, y vers le haut, angle anti-horaire
export interface CarPose { chassis: PartPose; wheels: PartPose[]; speed: number }   // speed : m/s (avance de caméra)
export function lerpAngle(a: number, b: number, alpha: number): number;     // a + normalizeAngle(b − a) × alpha
export function lerpCarPose(prev: CarPose, cur: CarPose, alpha: number): CarPose;
export class PoseHistory {
  reset(poses: CarPose[]): void;                                    // prev = cur = poses (départ, rebuildCars)
  push(poses: CarPose[], teleported: ReadonlySet<number>): void;    // après chaque pas : prev ← cur, cur ← poses ; pour i téléporté, prev[i] ← cur[i]
  at(alpha: number): CarPose[];                                     // alpha borné à [0, 1] ; neuf (aucune mutation)
}
// src/loop/frame-stats.ts (pur)
export class StepHistogram {
  record(steps: number, nowMs: number): void;
  /** Dernière seconde close : images, images à 0 pas, images à ≥ 2 pas. */
  readonly last: { frames: number; zero: number; multi: number };
}
// src/sim/simulate.ts
export function posesOf(sim: RaceSim): CarPose[];                    // châssis et roues en repère monde, angles comme carView
export function carView(sim: RaceSim, index: number, pose?: CarPose): CarView;
export function sceneOf(sim: RaceSim, poses?: CarPose[]): Scene;     // sans poses : comportement actuel (tests existants inchangés)
```

Règles :
- **État dessiné** = `lerp(précédent, courant, alpha)` avec `alpha = acc / PHYSICS_DT`, où `acc` est le reste rendu par `advanceAccumulator`. Les angles du châssis et des roues passent par `lerpAngle` (différence normalisée dans (−π, π]). L'angle de roue reste cumulé, comme `-w.angle` aujourd'hui : en turbo il tourne de 44,6° par pas, donc moins de 180°, et le lerp reste juste.
- **Caméra :** `camera.update(pose.chassis.x, max(pose.chassis.y, heightAt(pose.chassis.x) + 3), pose.speed, elapsed)` avec la pose interpolée de Galahad (`poses[0]`). `elapsed` reste le temps réel : le lissage est déjà indépendant de la cadence.
- **Téléportation :** après chaque `stepRace`, les voitures qui ont un événement `'respawn'` dans `sim.events` sont passées dans `teleported`, donc dessinées directement à la cible. Après `rebuildCars`, on appelle `history.reset(posesOf(sim))`. Il n'y a pas de seuil de distance : la source de vérité, ce sont les événements.
- Les étoiles, les effets et le HUD gardent le temps de simulation. `Scene.t` vaut `sim.time − (1 − alpha) × PHYSICS_DT`, pour que les flammes suivent la même latence.
- **`?debug=1` :** `StepHistogram` alimenté à chaque image. Le HUD affiche, sous le fps, « 0 pas : z · 2+ pas : m » sur la dernière seconde (`hud-steps`). `window.__game.frameSteps` expose `{ frames, zero, multi }`. Le papa peut ainsi vérifier sur la tablette que le compteur bouge au moment d'un ancien glitch (tremblement §8).
- `Game` ne touche jamais `sim` dans `present` : l'interpolation lit, elle n'écrit pas.

**Détecteur (tremblement §1, côté rendu) :** position écran de Galahad en px CSS (vue 1280 × 800, donc `ppm = 800 / VISIBLE_HEIGHT_M`, soit 57,1 px/m), image par image. Un **à-coup** est une image où |Δ²x| > 4 px. Un **épisode** compte au moins 3 à-coups en 0,5 s. Les téléportations (|Δx| > 60 px) sont exclues à ±1 s.

```ts
// tests/helpers/frames.ts
export interface ScreenModel { hz: number; jitterMs: number; seed: number }   // gigue gaussienne σ = jitterMs (Box-Muller sur mulberry32(seed)), phase de départ tirée
export function frameTimesMs(model: ScreenModel, seconds: number): number[];
export interface Trajectory { poses: CarPose[]; teleportAt: boolean[] }       // Galahad, un élément par pas (avant le pas 0 compris)
export function recordTrajectory(seed: number, seconds: number, robots: boolean): Trajectory; // stepRace doigt posé + posesOf
export type RenderMode = 'physique' | 'actuel' | 'interpolé';                  // physique : 1 pas par image ; actuel : dernier pas (Game d'avant la 5f) ; interpolé : PoseHistory
export function replayScreenX(traj: Trajectory, track: Track, model: ScreenModel, mode: RenderMode, cfg: Config): { tMs: number[]; x: number[] };
export function shakeEpisodes(r: { tMs: number[]; x: number[] }): number;
// tests/helpers/fingerprint.ts
export function stepFingerprint(sim: RaceSim): string;  // sha1 (node:crypto) des Float64 bruts : position, angle, vitesse, vitesse angulaire de chaque pièce de chaque voiture, temps
```
Le rejeu utilise les vrais `advanceAccumulator`, `PoseHistory` et `Camera` : c'est le même enchaînement que `Game.frame`.

- [ ] **Step 1 : Figer l'empreinte avant toute modification.** Créer `tests/helpers/fingerprint.ts` et `tests/empreinte.test.ts` : Galahad seul, graines 0, 1 et 2, 1 680 m, doigt posé, 30 s. On calcule le sha1 de la concaténation des empreintes par pas, puis on colle les trois sha1 **mesurés sur le code d'avant la 5f** dans le test, avec le commentaire « si l'empreinte bouge, c'est un défaut, pas une valeur à recapturer », comme `PLAN_A_TRACE`. Commande : `npx vitest run tests/empreinte.test.ts`, qui doit passer. Durée attendue : moins de 10 s.
- [ ] **Step 2 : Tests purs (FAIL).**
  - `tests/interpolation.test.ts` :
    - `lerpAngle(179°, −179°, 0,5)` vaut ±180° et non 0 ;
    - `alpha` 0 donne `prev` et 1 donne `cur` ; un alpha hors de [0, 1] est borné ;
    - une voiture téléportée donne `at(α) = cur` pour tout α, les autres restent interpolées ;
    - `reset` donne `at(α) = poses` ;
    - `at` ne modifie ni `prev` ni `cur`.
  - `tests/frame-stats.test.ts` : la suite 1, 0, 2, 1, 1, 3 sur une seconde donne `{ frames: 6, zero: 1, multi: 2 }`, puis remise à zéro à la seconde suivante.
- [ ] **Step 3 : Implémenter** `src/loop/interpolation.ts`, `src/loop/frame-stats.ts` et `posesOf` (`carView` et `sceneOf` acceptent une pose). Puis **PASS**, et `npx vitest run tests/deps.test.ts` vert, car `loop/` reste pur.
- [ ] **Step 4 : Tests de rejeu (FAIL tant que le mode interpolé n'est pas branché sur `PoseHistory`).** `tests/interpolation-replay.test.ts` (CI) :
  - Galahad seul, graine 1, 40 s ; modèles {60,05 Hz, σ 0,2 ms} et {59,94 Hz, σ 0,1 ms}, graines d'écran 0 à 2.
  - Contrôle : en mode `actuel`, le total d'épisodes est ≥ 1. Cela prouve que le détecteur voit le défaut ; le rapport mesure ≈ 6 épisodes par course de 150 s.
  - En mode `interpolé`, le total vaut 0, et il est ≤ `physique`.
  - Téléportation sans traînée : Galahad posé à `xLava` du premier volcan (graine 1, comme `tests/respawn-e2e.test.ts`), puis pas jusqu'à l'événement `'respawn'`. À ce pas, pour α ∈ {0 ; 0,5 ; 0,99}, la pose interpolée vaut exactement la pose à la cible : aucun x entre l'ancien et le nouveau. Contrôle : sans le drapeau, α = 0,5 donne un x intermédiaire.
  - `rebuildCars` suivi de `reset` : pose = cible.
  - Physique inchangée : 600 pas à 5 voitures (graine 2), avec et sans `posesOf` et `PoseHistory` appelés entre chaque pas. Les `stepFingerprint` sont identiques pas à pas.
  - `tests/slow/interpolation-replay-slow.test.ts` : 12 courses à 5 voitures (graines 0 à 11, 150 s) × {60,05 / 0,2 ; 59,94 / 0,1 ; 60,000 / 0,2 ; 120 Hz / 0,1}. Pour chaque modèle, `interpolé` ≤ `physique`, et `interpolé` vaut 0 hors des pas à ±1 s d'une réapparition. On imprime le tableau physique / actuel / interpolé, dans la forme de tremblement §6.
- [ ] **Step 5 : Brancher `Game`.**
  - Le constructeur appelle `history.reset(posesOf(sim))`.
  - Dans `frame`, après chaque `stepRace`, on appelle `history.push(posesOf(sim), indicesRéapparus(sim.events))`. Après `rebuildCars`, on appelle `history.reset`.
  - `present` reçoit `alpha = this.acc / PHYSICS_DT` et utilise les poses `history.at(alpha)` pour la caméra (Galahad) et pour `sceneOf(sim, poses)`.
  - En debug, `StepHistogram.record(steps, now)` et `hud.setFrameSteps(...)`.
  - Puis **PASS** : `npm run typecheck` à 0 erreur, `npm test` vert. `PLAN_A_TRACE` et `tests/empreinte.test.ts` ne bougent pas.
- [ ] **Step 6 : e2e.** Dans `e2e/race.spec.ts`, avec `?seed=1&debug=1` : après 2 s, `.hud-steps` est visible et `window.__game.frameSteps.frames` > 0. Les 6 e2e existants restent verts. Commande : `npm run e2e`.
- [ ] **Step 7 : Suites.** `npm run test:slow` vert, et le tableau de rejeu va dans la passation. On chronomètre `npm test` (moins de 6 min mur).
- [ ] **Step 8 : Commit** `feat: rendu interpolé entre deux pas, caméra sur la pose interpolée, compteur d'images à 0 et 2 pas`.
- [ ] **Step 9 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec sondes :
    - 90 et 120 Hz ;
    - `MAX_STEPS_PER_FRAME` atteint (onglet repris) ;
    - réapparition au 1er puis au 2e pas d'une image à 2 pas ;
    - voiture fantôme qui sort de zone ;
    - alpha au bord (`acc` ≈ dt − 1e-9) ;
    - allocations par image à 5 voitures ;
    - stroboscope des roues en turbo (tremblement §5.3), à noter seulement.
  - `code-review` sur le diff.
  - Tours de correction (≤ 5).
- [ ] **Step 10 : Validation du papa** sur la tablette (`?debug=1`) : plus de voiture qui tremble ; le compteur d'images à 0 et 2 pas est noté avec le modèle de tablette (tremblement §8). Puis passation et registre (tableau du rejeu, fréquence de l'écran si connue), commit `docs:` et **push** sur `ccr-5b6fabc4-n96ofo`.

---

### Task 5d (ajoutée) : Étoiles pour tous

**Saut §2 :** l'état d'une étoile est tenu **par voiture**. Une voiture qui prend une étoile la rend inactive pour elle seule pendant `STAR_RESPAWN_SECONDS`, et active son turbo. Pour les autres, l'étoile reste prenable. Les capteurs restent actifs, et `collectStars` décide voiture par voiture. À l'écran, on dessine l'état vu par Galahad.

**Files:**
- Modify:
  - `src/cars/stars.ts` (refonte) ;
  - `src/physics/stars.ts` (capteurs toujours `mask: CAT.CAR`, **retrait** de `syncStarBodies`) ;
  - `src/sim/simulate.ts` (`newStarStates(track.stars, cars.length)`, `collectStars(sim, car, index)`, retrait de l'appel `syncStarBodies` ; `sceneOf` : `active` = vu par l'index 0 ; `SimulateResult` gagne `starsByCar` et `firstStar` ; commentaires de `RaceSim.stars` et de `stepRace` réécrits) ;
  - `tests/turbo.test.ts` (migration de `isStarActive`/`takeStar`) ;
  - `tests/slow/stars-sim.test.ts` (migration de `takenAt`/`isStarActive`) ;
  - `tests/simulate.test.ts` (le commentaire d'en-tête « étoiles partagées » devient « étoiles par voiture », plus le test associé s'il existe).
- Test: `tests/stars-pour-tous.test.ts`, `tests/slow/rattrapage.test.ts`, `tests/slow/race-invariants-*.test.ts` (inchangés, relancés)

**Interfaces :**
```ts
// src/cars/stars.ts (pur)
export interface StarState { id: number; /** Par index de voiture : instant (s) de sa dernière prise, null si jamais. */ takenAt: (number | null)[] }
export function newStarStates(stars: Star[], carCount: number): StarState[];
export function isStarActiveFor(s: StarState, carIndex: number, t: number, cfg: Config): boolean;
export function takeStarFor(s: StarState, carIndex: number, t: number): void;
// src/sim/simulate.ts — SimulateResult
starsByCar: Record<string, Extract<SimEvent, { type: 'star' }>[]>;
/** Première étoile de la course, toutes voitures confondues (au même pas : la plus petite index). */
firstStar: { carId: string; t: number } | null;
```
`isStarActive` et `takeStar` sont retirées dans ce commit, avec leurs deux derniers consommateurs (`tests/turbo.test.ts` et `tests/slow/stars-sim.test.ts`). `starsTaken` (Galahad) reste.

- [ ] **Step 1 : Mesure « avant » du rattrapage**, sur le code actuel, sans rien changer dans `src/`. Créer `tests/slow/rattrapage.test.ts` :
  - 24 courses à 5 voitures doigt posé (graines 0 à 23, harnais `fiveCarRace` de `tests/helpers/race.ts`), plus 10 courses avec le motif `liftedPattern(seed, 0.3)` pour Galahad.
  - La première étoile se trouve par `onStep` (premier événement `'star'`) : aucun besoin de `firstStar` pour cette mesure.
  - On imprime : la part des courses gagnées par la voiture de la première étoile, la place de Galahad, les étoiles prises par voiture.
  - Pas d'assertion, à part « au moins une course a une première étoile ».
  - Le chiffre est consigné dans le registre (`Task 5d: rattrapage avant`). Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/rattrapage.test.ts`. Le commit de ce fichier va avec le Step 5.
- [ ] **Step 2 : Tests (FAIL).** `tests/stars-pour-tous.test.ts` :
  - Pur :
    - une étoile prise par la voiture 1 à t = 10 reste active pour 0, 2, 3 et 4 ;
    - elle est inactive pour 1 jusqu'à 10 + `STAR_RESPAWN_SECONDS` (exclu), puis active ;
    - deux voitures la prennent au même t : chacune a son délai.
  - Simulation, graine 1, `robots: true` :
    - une voiture est posée par `placeCar` 6 m avant la 1re étoile, doigt posé ; Galahad la suit 20 m derrière, doigt posé ;
    - les deux voitures reçoivent un événement `'star'` de **même** `id` ;
    - les deux turbos sont actifs ;
    - `sceneOf(sim).stars[i].active` reste vrai après la prise du copain, et ne passe à faux qu'après celle de Galahad.
  - Réapparition par voiture : une voiture garée à l'arrêt dans le capteur, doigt levé, reçoit des prises à t0, puis t0 + 5 s, puis t0 + 10 s, à ±1 pas près, jamais entre deux.
  - Galahad seul : `PLAN_A_TRACE` et `tests/empreinte.test.ts` inchangés (attendu ; voir Global Constraints).
- [ ] **Step 3 : Implémenter**, puis **PASS** : `npm run typecheck` à 0 erreur, `npm test` vert.
- [ ] **Step 4 : Effet à 5 voitures.** `npm run test:slow`. Les invariants des graines 0 à 23 (≤ 3 respawns par robot, aucun blocage > 2,1 s, `lavaByCar.galahad === 0`, `ghostContacts === 0`) doivent rester verts. Les copains prennent désormais toutes leurs étoiles : plus de turbo, donc des chocs plus rapides hors zone fantôme et des étoiles d'élan prises par plusieurs voitures. On imprime, avant et après, le tableau par graine : étoiles prises par voiture, chutes dans la lave par voiture, place de Galahad. Si un invariant tombe, on **ne l'assouplit pas** : on mesure la cause (choc ou propre, `describeFall`), et le papa tranche.
- [ ] **Step 5 : Mesure « après 5d »** (`rattrapage.test.ts` relancé). Le chiffre va au registre. **Commit** `feat: étoiles pour tous, état par voiture, vu par Galahad à l'écran`.
- [ ] **Step 6 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec sondes :
    - deux voitures dans le même capteur au même pas, Galahad en dernier dans l'ordre des index ;
    - étoile d'élan prise par 3 voitures qui arrivent ensemble au volcan (turbo en zone fantôme : lave ?) ;
    - coût de capteurs toujours actifs (`meanStepMs`) ;
    - empreinte Galahad seul graines 0 à 4 sur une course complète.
  - `code-review` sur le diff.
  - Tours (≤ 5).
- [ ] **Step 7 : Validation du papa** : capture d'une étoile prise par un copain et encore visible, et chiffre du rattrapage. Puis passation, registre, push.

---

### Task 5e (ajoutée) : Bouton saut et étoiles hautes (Galahad)

**Saut §1–§2 :**
- **Bouton** rond, ≥ 140 px, en bas à gauche, avec `data-no-pedal`.
- **Déclenchement sur front** : `pointerdown` sur le bouton, ou `keydown` Espace non répété. Chaque front dépose une demande, consommée au pas suivant ; elle est ignorée si les conditions ne sont pas réunies.
- **Conditions** : au moins une roue au sol au sens du contact débouncé, `JUMP_COOLDOWN` écoulé, course en cours.
- **Physique** : `JUMP_VY` s'ajoute à la vitesse verticale des 3 pièces.
- **Étoiles hautes** : environ 1 étoile du curseur sur 3, jamais sur le plat de lancement ni sur l'élan.

**Files:**
- Create: `src/cars/jump.ts`, `src/input/jump.ts`, `src/ui/jump-button.ts`
- Modify:
  - `src/config.ts` (voir ci-dessous) ;
  - `src/physics/car.ts` (`applyJump`) ;
  - `src/cars/state.ts` (`lastJumpAt: number | null`, `null` dans `newCarState`) ;
  - `src/sim/simulate.ts` (`stepRace(sim, galahadThrottle, galahadJump = false)`, `CarSim.grounded`, événement `'jump'`, `jumpReady(sim, index)`) ;
  - `src/track/types.ts` (`Star.high: boolean`) ;
  - `src/track/stars.ts` (étoiles hautes) ;
  - `src/render/renderer.ts` (rien à changer : `y` porte la hauteur ; à vérifier avec la capture) ;
  - `src/game.ts` (`JumpInput`, `JumpButton`, demande passée au **premier** pas de l'image, ou gardée en attente si l'image a 0 pas, bouton grisé, poussière sur `'jump'`, `__game.jumps` et `__game.throttlePressed` en debug) ;
  - `e2e/helpers.ts` (`tapJump`, `holdFingerAndTapJump`, multi-touch CDP) ;
  - `tests/simulate.test.ts` et `tests/empreinte.test.ts` (cfg `STAR_HIGH_SHARE: 0`, commentaire) ;
  - `tests/slow/finish.test.ts` (cas 6 : voir Questions ouvertes 5) ;
  - `tests/smoke.test.ts`.
- Test: `tests/jump.test.ts`, `tests/jump-input.test.ts` (jsdom), `tests/high-stars.test.ts`, `tests/slow/calibration-saut.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan.test.ts`, `e2e/jump.spec.ts`

**Interfaces :**
```ts
// src/config.ts — déclarées avant le littéral, comme D_LANCE
const JUMP_APEX = 2.5;  // m : apogée du châssis au-dessus de sa hauteur de roulage à l'arrêt (saut §1)
JUMP_APEX,
JUMP_VY: Math.sqrt(2 * 4.9 * JUMP_APEX),   // ≈ 4,95 m/s, √(2 g h) avec la gravité du jeu ; corrigée par la mesure du Step 2 si l'apogée sort de 2,5 ± 10 % (consigné)
JUMP_COOLDOWN: 0.5,                        // s depuis le dernier saut de cette voiture
JUMP_BUTTON_SIZE_PX: 150,                  // px CSS (≥ 140, saut §1)
STAR_HIGH_SHARE: 1 / 3,                    // part des étoiles du curseur surélevées ; 0 = étoiles du plan B d'avant la 5e
STAR_HIGH_Y: /* calibré au Step 6, départ 3,9 */,        // m au-dessus du sol local (centre de l'étoile)
STAR_HIGH_RAMP_CLEARANCE: /* calibré au Step 6, départ 70 */,  // m : pas d'étoile haute à moins de cette distance après la fin d'une rampe-saut
// src/cars/jump.ts (pur)
export function canJump(o: { lastJumpAt: number | null; grounded: boolean; finished: boolean; t: number }, cfg: Config): boolean;
// src/physics/car.ts
/** Ajoute JUMP_VY (m/s, vers le haut du monde) à la vitesse du châssis et des deux roues ; vx inchangée. Hors de tout callback de collision. */
export function applyJump(car: CarBody, cfg: Config): void;
// src/sim/simulate.ts
| { type: 'jump'; carId: string; t: number; x: number }        // nouveau SimEvent
export function stepRace(sim: RaceSim, galahadThrottle: boolean, galahadJump?: boolean): void;
export function jumpReady(sim: RaceSim, index: number): boolean;  // pour griser le bouton : canJump au dernier pas
// src/input/jump.ts
export class JumpInput {
  constructor(target: Window, button: HTMLElement);
  /** Vrai une fois par front d'appui en attente, puis faux jusqu'au prochain front. */
  take(): boolean;
  clear(): void;   // pour la tâche 10 : demandes jetées pendant le décompte et la pause
  dispose(): void;
}
// src/ui/jump-button.ts
export class JumpButton { constructor(root: HTMLElement, cfg: Config); readonly el: HTMLButtonElement; setReady(ready: boolean): void }
```

Règles de mise en œuvre :
- Dans `stepRace`, pour chaque voiture, après `updateGroundContact`, pour avoir le `grounded` de ce pas, et avant `stepWorld` :
  - `want = car.driver ? false : galahadJump` (les copains arrivent en tâche 6) ;
  - si `want && canJump(...)`, alors `applyJump(car.body, cfg)`, `state.lastJumpAt = t` et événement `'jump'`.

  `CarSim.grounded = grounded[0] || grounded[1]`.
- `applyJump` : `Body.setVelocity(p, { x: p.velocity.x, y: p.velocity.y − mpsToPxPerStep(JUMP_VY) })` pour chaque pièce (repère Matter, y vers le bas). L'addendum dit « s'ajoute » : sur une pente montante, le saut s'ajoute à la vitesse verticale existante.
- Le contact débouncé laisse un saut possible jusqu'à 0,1 s (`GROUND_DEBOUNCE_SECONDS`) après le décollage, par exemple juste après le sommet d'une rampe. C'est un effet connu, qu'on mesure (Step 9) et qu'on laisse à la physique, sauf avis contraire du papa. Le toit d'une autre voiture compte comme sol (`wheelsOnGround`) : on peut sauter depuis un toit.
- `Game` :
  - `const jump = steps > 0 && this.jumpInput.take()` ; on appelle `stepRace(sim, pressed, i === 0 && jump)` ;
  - à chaque image, `jumpButton.setReady(jumpReady(sim, 0) && state === 'racing')` ;
  - après l'arrivée, on appelle `jumpInput.clear()` à chaque image.
- `JumpButton` :
  - `position:absolute; left:28px; bottom:28px`, taille `JUMP_BUTTON_SIZE_PX`, `border-radius:50%`, `pointer-events:auto` (le `#hud` est à `none`), `touch-action:none`, `data-no-pedal`, icône de ressort en SVG inline ;
  - grisé par une classe (`is-waiting`, opacité 0,4), **jamais par l'attribut `disabled`** : un bouton désactivé n'émet pas de `pointerdown` vers sa cible, et le tap risquerait d'atteindre le canvas, donc de compter comme du gaz.
- `JumpInput` :
  - `pointerdown` sur le bouton donne une demande ;
  - `keydown` avec `code === 'Space' && !repeat` donne une demande, avec `preventDefault` ;
  - garder le doigt ou la touche ne relance rien ;
  - le `pointerId` du bouton n'entre jamais dans `Throttle`, qui l'ignore déjà par `closest('[data-no-pedal]')`.

**Étoiles hautes (`placeStars`) :** l'étape 5 s'ajoute après l'étape 4 actuelle, et ses tirages viennent **après** tous les autres.
1. Éligibles : étoiles du **curseur** situées dans une tranche `plat` (hors plat de départ et plat d'arrivée), à plus de `STAR_HIGH_RAMP_CLEARANCE` après la fin de toute tranche `rampe-saut`. Jamais une étoile d'élan, jamais une étoile du plat de lancement ni du plat de réception : une voiture lancée par un volcan survole la réception, et sans cette règle elle prendrait une étoile haute doigt posé.
2. Nombre visé : `k = min(round(STAR_HIGH_SHARE × nCurseur), nÉligibles)`. Les `k` étoiles sont tirées sans remise parmi les éligibles, par le rng de piste (Fisher-Yates partiel). Avec `STAR_HIGH_SHARE = 0`, aucun tirage n'a lieu.
3. Étoile haute : `high: true`, `y = heightAt(x) + STAR_HIGH_Y`. Les autres : `high: false`, `y = heightAt(x) + 0,6`, comme avant. Les ids restent triés par x.

**Tolérance « environ 1 sur 3 »** (saut §4, fixée ici) :
- sur chaque piste, `nHautes = min(round(nCurseur / 3), nÉligibles)` exactement ;
- sur les graines 0 à 49, la part des étoiles du curseur qui sont hautes vaut entre 0,25 et 0,40 ;
- au moins 40 pistes sur 50 ont une étoile haute ou plus.

Si les éligibles manquent (part < 0,25), on le mesure et on le montre au papa. On ne relâche pas la règle d'éligibilité en silence.

**Ordre de grandeur [ESTIMÉ, à mesurer au Step 6]** :
- Châssis au repos ≈ 0,70 m au-dessus du sol (`WHEEL_RADIUS + WHEEL_DROP`), donc apogée ≈ 3,2 m.
- Les pièces de la voiture couvrent verticalement [y_c − 0,70 ; y_c + 0,35], et le capteur de l'étoile a un rayon de 0,5 m. Le contact exige donc y_c > y_étoile − 0,85.
- Sur le plat, à vitesse constante, la trajectoire du saut est la même à un décalage près. La fenêtre de décollage vaut donc W ≈ T_contact(h) + (≈ 3,4 m) / v. Cela donne 0,24 s de base à 14 m/s et 0,30 s à 11,2 m/s, plus le temps passé au-dessus du seuil.
- Une étoile vers 3,9–4,0 m (centre) donne W ≈ 0,4 s à 14 m/s. 10 cm plus bas, W ≈ 0,6 s.
- Une voiture au sol, toit ≈ 1,05 m, ne l'approche pas. Ce sont les vols de rampe-saut (apogée ≈ 5 m au-dessus du sol à 14 m/s) et de volcan qui dictent l'éligibilité.

- [ ] **Step 1 : Tests du saut (FAIL).** `tests/jump.test.ts` (CI), piste `onlyPlat` ou graine 1, voiture seule par `createRaceSim` :
  - **Apogée** : la voiture est au repos 2 s sur le plat ; `y0` = y du châssis. On saute et on suit le max de y : `max − y0` ∈ [2,25 ; 2,75].
  - **vx gardée** : lancée à 14 m/s, vx avant et après `applyJump` à 1e-9 près.
  - **Au sol seulement** : demande en l'air (2e appui 0,3 s après le décollage) : pas d'événement, vitesse inchangée.
  - **Délai** : `canJump` pur (tableau : `lastJumpAt` null, t − 0,49, t − 0,5 ; grounded ; finished). En simulation, une demande à chaque pas, voiture maintenue au sol : les sauts sont espacés d'au moins 0,5 s.
  - **Un saut par appui** : voir `jump-input`.
  - **Après l'arrivée** : demande ignorée.
  - **Déterminisme** : deux simulations avec le même calendrier de demandes ont la même empreinte (`stepFingerprint`) à chaque pas.
  - **Sans demande** : `stepRace(sim, t)` ≡ `stepRace(sim, t, false)` (même empreinte).

  `tests/jump-input.test.ts` (jsdom) :
  - `pointerdown` sur le bouton : `take()` vaut vrai, puis faux ; `Throttle.pressed` reste faux. C'est le test « aucune trace de gaz par le bouton ».
  - `pointerdown` maintenu, puis un 2e `take()` : faux.
  - Espace : une demande ; Espace avec `repeat: true` : rien ; autre touche : rien.
  - `pointerdown` ailleurs : `Throttle.pressed` vrai, aucune demande.
  - Le bouton fait ≥ 140 px, porte `data-no-pedal`, est en bas à gauche, et n'a jamais l'attribut `disabled` après `setReady(false)`.
- [ ] **Step 2 : Implémenter le saut** (`config`, `cars/jump.ts`, `applyJump`, `stepRace`, `JumpInput`, `JumpButton`, `Game`), puis **PASS**. On mesure l'apogée réel à l'arrêt et à 14 m/s, et on le consigne. Si l'apogée sort de ±10 %, on corrige `JUMP_VY` par un facteur mesuré, écrit dans le commentaire, sans toucher `GRAVITY`. `npm run typecheck`, `npm test`.
- [ ] **Step 3 : e2e (FAIL, puis PASS).** `e2e/jump.spec.ts`, avec `?seed=1&debug=1` :
  - **tap seul** sur le centre du bouton (CDP `touchStart`/`touchEnd`) : `__game.jumps` passe de 0 à 1 et `__game.throttlePressed` reste faux pendant que le doigt est posé sur le bouton ;
  - **doigt de gaz + tap** : `touchStart` [A = (640, 400)], 1 s plus tard `touchStart` [A, B = bouton], puis `touchEnd` sur B seul : la progression augmente de plus de 5 m et `jumps` vaut 1 ;
  - **Espace** : un saut, et un keydown répété ne donne rien ;
  - capture `e2e/screenshots/bouton-saut.png`.

  Commande : `npm run e2e`.
- [ ] **Step 4 : Commit** `feat: bouton saut (applyJump, délai, front d'appui, Espace)`.
- [ ] **Step 5 : Tests de placement (FAIL).** `tests/high-stars.test.ts` (CI, statique, graines 0 à 49, 1 680 m) :
  - tolérance ci-dessus ;
  - aucune étoile haute dans `[xLancement, xElanStart]` ni dans `[xElanStart, xLava]` ;
  - aucune étoile haute sur un plat de réception, ni à moins de `STAR_HIGH_RAMP_CLEARANCE` après une rampe-saut ;
  - aucune étoile d'élan haute ;
  - `y` = sol + `STAR_HIGH_Y` ou sol + 0,6 ;
  - déterminisme ;
  - avec `STAR_HIGH_SHARE: 0`, les étoiles valent celles du code d'avant (mêmes x, mêmes y, `high: false`), et le nombre d'étoiles est inchangé (6 à 14 sur les graines 0 à 19, plancher 6).

  Puis **implémenter** et **PASS**, avec les valeurs de départ (3,9 m ; 70 m).
- [ ] **Step 6 : Calibration mesurée de la hauteur.** `tests/slow/calibration-saut.test.ts` mesure ; il n'asserte que la fin du balayage. Pour `STAR_HIGH_Y` ∈ {3,0 ; 3,2 ; … ; 4,4} et pour chaque étoile haute des graines 0 à 9 :
  - **(a) Garde au sol** : Galahad seul doigt posé, à `V_MAX` puis en turbo (`activateTurbo` 20 m avant). On mesure la distance minimale entre le haut des pièces et le bas du capteur, ainsi que les prises.
  - **(b) Fenêtre** : Galahad lancé à 11,2 m/s (`V_CRUISE`) puis à 14 m/s, stabilisé 40 m avant l'étoile (`launch` et `speedCapUntil` de `tests/helpers/runs.ts`, monde rogné `croppedWorld` de `tests/helpers/phases.ts`), doigt posé. On demande un saut à chaque pas de décollage possible, de 60 m à 0 m avant l'étoile. La fenêtre est la plus longue suite de pas qui prend l'étoile **sans respawn** dans les 3 s qui suivent l'atterrissage, en secondes. On note aussi le centre de la fenêtre en « temps avant l'étoile », qui sert à la tâche 6 (`JUMP_STAR_LEAD`).
  - **(c) Vols** : prises d'étoiles hautes doigt posé, sans saut, à 5 voitures sur les graines 0 à 23, et pour `STAR_HIGH_RAMP_CLEARANCE` ∈ {50, 60, 70, 80}.

  Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/calibration-saut.test.ts`.
- [ ] **Step 7 : Tableau pour le papa** (une ligne par hauteur ; c'est le papa qui choisit) :

  | `STAR_HIGH_Y` (m) | garde au sol min, V_MAX / turbo (m) | prises sans saut | fenêtre min à 11,2 m/s (s) | fenêtre min à 14 m/s (s) | médiane (s) | étoiles ≥ 0,3 s | respawns à l'atterrissage |
  |---|---|---|---|---|---|---|---|
  | 3,0 … 4,4 | | | | | | | |

  On y joint une capture d'une étoile haute vue de la tablette (1280 × 800), et le second tableau, celui de `STAR_HIGH_RAMP_CLEARANCE`. Recommandation : la plus haute valeur où **toutes** les étoiles ont une fenêtre ≥ 0,3 s aux deux vitesses, avec 0 prise sans saut ; viser ≈ 0,4 s. Le papa choisit. On écrit la valeur dans `config.ts`, avec un commentaire des mesures, et le registre la consigne.
- [ ] **Step 8 : Acceptation (FAIL, puis PASS avec la valeur choisie).** `tests/slow/high-stars-sim.test.ts` :
  - doigt posé sans saut, turbo compris, 5 voitures, graines 0 à 23 : **0** événement `'star'` sur une étoile `high` ; même résultat pour Galahad seul en turbo forcé devant chaque étoile haute des graines 0 à 9 ;
  - pour chaque étoile haute des graines 0 à 9, une fenêtre de décollage ≥ 0,3 s à 11,2 et à 14 m/s, sans respawn, rejouée par le harnais du Step 6 avec la valeur retenue.

  `tests/slow/saut-volcan.test.ts` :
  - doigt posé sans saut, 5 voitures, graines 0 à 23 : 0 chute de Galahad (déjà couvert par `race-invariants-*`, rappelé) ;
  - **un saut mal placé peut faire tomber** : Galahad lancé doigt posé depuis `xLancement`, un saut demandé à x ∈ [xElanStart − 10, xLip] au pas de 0,5 m, premiers volcans des graines 0 à 4. On imprime la part de lave par position et on asserte qu'au moins une position tombe : le risque existe (saut §4).

  `tests/slow/finish.test.ts` cas 6 : adapté selon la réponse à la Question ouverte 5.
- [ ] **Step 9 : Non-régression.**
  - `tests/simulate.test.ts` (`PLAN_A_TRACE`) et `tests/empreinte.test.ts` passent à `{ ...CONFIG, STAR_HIGH_SHARE: 0 }`, avec le commentaire « depuis la 5e, Galahad seul est identique au plan A étoiles hautes désactivées ; avec CONFIG il ne prend plus les étoiles hautes doigt posé ». Les valeurs figées ne changent pas.
  - `npm run typecheck`, `npm test`, `npm run test:slow`, `npm run e2e`.
  - Mesure « après 5e » de `rattrapage.test.ts`, au registre.
- [ ] **Step 10 : Commit** `feat: étoiles hautes, une étoile du curseur sur trois, hauteur calibrée`.
- [ ] **Step 11 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec sondes physiques :
    - saut à chaque x d'un volcan (tableau) ;
    - saut depuis un toit ;
    - saut dans les 0,1 s après le sommet d'une rampe-saut ou d'une rampe-volcan (débounce) ;
    - saut en turbo ;
    - saut juste après un respawn (invulnérable) ;
    - saut sur les bosses (retournements ?) ;
    - apogée selon la vitesse et la pente ;
    - étoile haute prise en vol de rampe-saut turbo ;
    - multi-touch réel (doigt qui glisse du bouton vers l'écran) ;
    - Espace maintenu ;
    - demande faite pendant une image à 0 pas.
  - `code-review` sur le diff.
  - Tours (≤ 5).
- [ ] **Step 12 : Validation du papa et de Galahad** : Galahad comprend-il le bouton seul ? Un saut raté se voit-il et coûte-t-il quelque chose ? (saut §0). Puis passation (apogée mesuré, tableau de calibration, valeur choisie, rattrapage), registre, push.

---

### Task 6 : Conduite des robots (remplace la tâche 6 du plan v2.1)

**Files:**
- Create: `src/ai/driver.ts`, `src/sim/harness.ts` (extraction de `simulateRace`, de `StuckMeter` et de `carPairsTouching` hors de `simulate.ts` ; `simulate.ts` les réexporte le temps de migrer les imports, puis les imports sont migrés dans le même commit)
- Modify:
  - `src/cars/pilots.ts` (`jumpTry`, `jumpSkill` ; `GALAHAD` à 0 et 0) ;
  - `src/sim/simulate.ts` (le type `Driver` renvoie `{ throttle, jump }` ; contexte élargi ; `holdAfterStartDelay` retiré ; branche `makeRobotDriver` ; garde « jamais de saut de robot dans `inNoJumpZone` » ; commentaire du champ `ghost` mis à jour : zone jusqu'à la roue arrière) ;
  - `src/track/query.ts` (`inNoJumpZone`) ;
  - `src/config.ts` (`POLITE_SPEED`, `POLITE_GAP`, `POLITE_MAX_WAIT`, `LIFT_LOOKAHEAD`, `LIFT_SECONDS`, `JUMP_LOOKAHEAD`, `JUMP_STAR_LEAD`, valeurs ci-dessous) ;
  - `tests/deps.test.ts` (`src/{track,cars,loop,ai}`) ;
  - `tests/simulate.test.ts` (`carOf` remplacé par `carPairsTouching`/`chassisX`, héritage de la 5b ; tests du driver provisoire migrés) ;
  - `tests/pilots.test.ts` (nouveaux traits) ;
  - `e2e/race.spec.ts` (`BEFORE_ROBOTS_S` 0,8 → 2).
- Test: `tests/driver.test.ts`, `tests/pilots.test.ts`, `tests/slow/robots-sauts.test.ts`, `tests/slow/rattrapage.test.ts` (relancé), `tests/slow/race-invariants-*.test.ts`

**Interfaces :**
```ts
// src/sim/simulate.ts
export interface DriverContext {
  t: number; state: CarState; track: Track; speed: number;
  x: number; grounded: boolean;
  /** Autres voitures : x du châssis et vitesse (m/s), dans l'ordre des index. */
  others: readonly { x: number; speed: number }[];
  /** Étoile haute la plus proche devant (x > x voiture, à moins de JUMP_LOOKAHEAD), avec sa disponibilité pour CETTE voiture ; null sinon. */
  nextHighStar: { index: number; x: number; available: boolean } | null;
}
export type Driver = (ctx: DriverContext) => { throttle: boolean; jump: boolean };
// src/ai/driver.ts (pur)
export function makeRobotDriver(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): Driver;
// src/track/query.ts
export function inNoJumpZone(track: Track, x: number): boolean;   // x ∈ [xLancement, xReception] d'un volcan
// src/cars/pilots.ts
readonly jumpTry: number;   // [0 ; 1] : probabilité de tenter une étoile haute disponible
readonly jumpSkill: number; // s : écart-type de l'erreur sur l'instant du saut
```
La graine du driver vaut `(sim.pilotSeed + rank × 0x9e3779b9) >>> 0`. Elle est donc indépendante de la graine de piste, et ENCORE rejoue les mêmes copains et les mêmes sauts.

**Règles** (spec §7, addendum §1.8, saut §3 ; texte de la tâche 6 v2.1 repris), par ordre de priorité :
1. Après `finishedAt` : ignoré (le pas freine, comme aujourd'hui).
2. **Délai de départ** : `{ throttle: false, jump: false }` tant que `t < rank × START_DELAY_PER_RANK`.
3. **Zone volcan** `[xLancement, xLava]` de tout volcan : `throttle: true`, jamais de lever de pied ni de politesse. **Saut interdit** sur `[xLancement, xReception]` (`inNoJumpZone`), dans le driver **et** par la garde de `stepRace` pour toute voiture qui a un driver (défense en profondeur).
4. **Robots polis** (décision du papa, 5b) : hors zone volcan, `throttle: false` si une autre voiture roule à moins de `POLITE_SPEED` et se trouve devant à une distance de châssis à châssis dans `(0, POLITE_GAP]`. Valeurs de départ : 2 m/s et 4 m (≈ `CAR_LENGTH` + 1,8 m), fixées par la mesure du Step 5. Au-delà de `POLITE_MAX_WAIT` (départ : 3 s) d'attente continue derrière la même voiture, le robot repart : voir la Question ouverte 8. L'attente remet à zéro dès que la voiture de devant repart. Un robot poli a le doigt levé, donc son chronomètre de blocage ne court pas ; c'est le comportement voulu.
5. **Lever de pied** : devant une `rampe-saut` ou une `double-bosse`, quand x est dans les `LIFT_LOOKAHEAD` (8 m) avant `xStart` de la tranche, on tire une fois par tranche `rng() < pilot.lift`. Si le tirage tombe, `throttle: false` pendant `LIFT_SECONDS` (0,4 s). Pas de lever de pied dans un `cratère` (tâche 15).
6. **Saut des copains** (saut §3) : quand `nextHighStar` est disponible pour lui, le copain applique la décision **pré-tirée** pour cette étoile. À la création du driver, pour chaque étoile haute dans l'ordre de la piste, on tire `essaie = rng() < jumpTry` puis `erreur = N(0, jumpSkill)` (Box-Muller sur le même rng). Le tirage est fait une seule fois : un respawn qui ramène le robot devant la même étoile rejoue la même décision.

   S'il essaie, il saute dès que `(xÉtoile − x) / max(speed, 1) ≤ JUMP_STAR_LEAD + erreur`. `JUMP_STAR_LEAD` est le centre de fenêtre mesuré en 5e Step 6 ; il vaut ≈ `JUMP_VY / GRAVITY` ≈ 1,0 s [ESTIMÉ]. La demande est maintenue (`jump: true`) jusqu'au saut ou jusqu'au passage de l'étoile : `stepRace` filtre par `canJump`.

   Il peut rater l'étoile, mal retomber, se retourner : la physique décide.
7. Sinon `{ throttle: true, jump: false }`.

**Traits proposés, À VALIDER PAR LE PAPA** (comme les couleurs en 5a). La fenêtre de l'étoile vaut au moins ±0,15 s autour du centre (≥ 0,3 s, visée 0,4). La probabilité de rater par l'erreur seule vaut donc ≈ P(|N(0, σ)| > 0,15–0,2 s) :

| Pilote | Caractère | `jumpTry` | `jumpSkill` (s) | Raté attendu par l'erreur seule [ESTIMÉ] |
|---|---|---|---|---|
| Pablo | fonceur | 0,80 | 0,18 | ≈ 30–40 % |
| Matthis | fonceur | 0,75 | 0,15 | ≈ 20–30 % |
| Diego | moyen | 0,55 | 0,10 | ≈ 5–13 % |
| Malo | moyen | 0,50 | 0,09 | ≈ 3–10 % |
| Timothée | prudent | 0,30 | 0,04 | ≈ 0 % |
| Liam | prudent | 0,30 | 0,05 | ≈ 0 % |

- [ ] **Step 1 : Tests du driver (FAIL).** `tests/driver.test.ts` (pur, sans matter-js ; contexte fabriqué à la main) :
  - **délai** : `false` à `t < rank × 0,3`, puis `true` ;
  - **zone volcan** : `throttle` jamais `false` dans `[xLancement, xLava]`, même avec `lift = 1` et une voiture arrêtée juste devant ;
  - **lift** : avec `lift = 1`, le robot lève exactement 0,4 s (24 pas ± 1) avant chaque rampe-saut et chaque double-bosse ; avec `lift = 0`, jamais ;
  - **politesse** : voiture devant à 3 m et 1 m/s, donc `false` ; à 3 m et 5 m/s, donc `true` ; à 6 m, donc `true` ; derrière, donc `true` ; en zone volcan, donc `true` ; après `POLITE_MAX_WAIT`, donc `true` ;
  - **saut** :
    - `jumpTry = 1` et `jumpSkill = 0` : `jump` passe à vrai exactement quand `(xÉtoile − x) / v ≤ JUMP_STAR_LEAD` ;
    - `jumpTry = 0` : jamais ;
    - étoile indisponible : jamais ;
    - **jamais `jump: true` dans `inNoJumpZone`**, sur un balayage de x par pas de 0,1 m sur tous les volcans des graines 0 à 19, avec `jumpTry = 1` et des étoiles hautes fictives posées juste après chaque réception ;
  - **déterminisme** : même graine, mêmes sorties ; deux rangs, deux tirages différents.

  `tests/pilots.test.ts` : `jumpTry` dans [0 ; 1] et `jumpSkill` dans [0,02 ; 0,25] pour chaque copain ; fonceurs `jumpTry` > moyens > prudents ; prudents `jumpSkill` < moyens < fonceurs ; Galahad à 0 et 0.
- [ ] **Step 2 : Implémenter** `ai/driver.ts`, les traits, le nouveau `Driver`, le contexte et la garde dans `stepRace`, puis extraire `src/sim/harness.ts`. **PASS** : `npm run typecheck`, `npm test`. `PLAN_A_TRACE` et l'empreinte (cfg `STAR_HIGH_SHARE: 0`) sont inchangées.
- [ ] **Step 3 : Validation des traits par le papa** (avant les mesures longues) : le tableau ci-dessus, plus une phrase par copain (« Pablo saute presque toujours, souvent trop tôt ou trop tard »). Le papa garde ou change les valeurs, et le registre les consigne.
- [ ] **Step 4 : Mesures (suite lente).** `tests/slow/robots-sauts.test.ts`, 5 voitures, graines 0 à 23, Galahad doigt posé :
  - **aucun saut de copain dans une zone volcan** : 0 événement `'jump'` de robot avec `inNoJumpZone(x)` ;
  - **fonceurs contre prudents** : par pilote, tentatives, étoiles prises au saut, ratés (saut sans étoile dans les 2,5 s), respawns dans les 3 s qui suivent un saut. On asserte `ratés / tentatives` des fonceurs (Pablo, Matthis) > celui des prudents (Timothée, Liam), en agrégeant toutes les courses où ils roulent, et chaque groupe doit avoir au moins 10 tentatives ;
  - **déterminisme** : graine 3 jouée deux fois, même empreinte finale, même liste d'événements `'jump'` ;
  - **invariants** : ≤ 3 respawns par robot, aucun blocage > 2,1 s, `lavaByCar.galahad === 0`, `ghostContacts === 0`. Si les sauts des fonceurs font dépasser 3 respawns, on **ne relâche pas** la limite : on mesure, on présente au papa (baisser `jumpTry` ou accepter), et le papa tranche.

  On imprime le tableau par pilote.
- [ ] **Step 5 : Seuils de politesse.**
  - Sonde : Galahad arrêté sur la grille 10 s, puis doigt posé (graines 0 à 4). On mesure le premier contact copain–Galahad, le recul de Galahad et l'ordre de départ.
  - Sonde « bouchon » : un copain retourné ou arrêté au milieu d'un plat.
  - On fixe `POLITE_SPEED`, `POLITE_GAP` et `POLITE_MAX_WAIT` (valeurs et mesures au registre). Puis `tests/race-smoke.test.ts` reste vert, et l'e2e « sans doigt » retrouve sa fenêtre de 2 s (`BEFORE_ROBOTS_S = 2`) : `npm run e2e`.
- [ ] **Step 6 : Mesure du rattrapage « après »** (`tests/slow/rattrapage.test.ts`) : on compare la part des courses gagnées par la voiture de la première étoile **avant la 5d / après 5d / après 5e / après 6**, ainsi que la place moyenne de Galahad. La baisse nette est attendue (saut §4) ; le chiffre va dans la passation. Pas d'assertion chiffrée sans l'avis du papa (Question ouverte 9).
- [ ] **Step 7 : Suites.** `npm run typecheck`, `npm test` (< 6 min), `npm run test:slow`, `npm run e2e`.
- [ ] **Step 8 : Commit** `feat: conduite des robots (départ, lever de pied, robots polis, sauts des copains)`.
- [ ] **Step 9 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec sondes :
    - mutant « garde `inNoJumpZone` retirée du driver » : la garde de `stepRace` le rattrape-t-elle, et un test le voit-il ? ;
    - copain qui saute sur un autre ;
    - saut pendant le fantôme de sortie de zone ;
    - interblocage poli entre deux copains arrêtés ;
    - respawn avant une étoile déjà tirée ;
    - turbo et `JUMP_STAR_LEAD` (vitesse qui change pendant l'approche) ;
    - coût du contexte par pas (allocations de `others`).
  - `code-review` sur le diff.
  - Tours (≤ 5).
- [ ] **Step 10 : Validation du papa** : test tablette à 5 voitures. Les copains sautent-ils de façon crédible ? La course est-elle encore jouée d'avance ? Puis passation (tableau par pilote, rattrapage), registre, push. Ensuite, la tâche 7 du plan v2.1 (élastique). Après les tâches 6 et 7, le papa rejuge la difficulté (`ENGINE_BRAKE`, plan C), comme le prévoit la passation.

---

## Questions ouvertes (ambiguïtés de l'addendum, non tranchées ici)

1. **« Sur les plats et au-dessus du sommet d'une bosse »** (saut §2). Le curseur ne pose des étoiles que sur les zones admissibles : plats, plats de lancement, plats de réception. Les bosses n'en reçoivent jamais. Le plan ne surélève que des étoiles de plat. Pour avoir des étoiles au-dessus des bosses, il faudrait soit déplacer une étoile choisie vers le sommet de la `bosses` ou `double-bosse` suivante (cela change les écarts du curseur), soit rendre le sommet des bosses admissible pour les seules étoiles hautes. Papa : faut-il des étoiles au-dessus des bosses ?
2. **Plats de réception et plats après une rampe-saut.** L'addendum autorise « les plats » et n'exclut que le lancement et l'élan. Or une voiture lancée par un volcan ou une rampe-saut survole ces plats : sans exclusion, elle prendrait une étoile haute doigt posé, ce qui contredit « 0 étoile haute prise doigt posé ». Le plan exclut la réception et les `STAR_HIGH_RAMP_CLEARANCE` m après une rampe-saut. À confirmer.
3. **« Environ 1 étoile du curseur sur 3 ».** Comme une partie des étoiles du curseur n'est pas éligible (lancement, réception), la part réelle peut tomber sous 1/3. Le plan vise `round(n / 3)` parmi les éligibles, avec une tolérance de 0,25 à 0,40 sur les graines 0 à 49. Le papa accepte-t-il une part plus basse sur certaines pistes, ou faut-il ajouter des zones éligibles (voir Q1) ?
4. **« Vitesse de croisière »** (saut §2). `V_CRUISE` vaut 11,2 m/s dans `config.ts`, mais Galahad doigt posé roule à `V_MAX` = 14 m/s. Le plan exige la fenêtre ≥ 0,3 s **aux deux** vitesses. À confirmer.
5. **Cas 6 de l'addendum §1.7** (« 6 à 14 étoiles prises » doigt posé, `tests/slow/finish.test.ts`) et **plancher de 6** (saut §2 « inchangé »). Avec environ un tiers d'étoiles hautes, le doigt posé n'en prend plus que les deux tiers, soit parfois moins de 6. Les deux règles entrent en conflit. Propositions : (a) le cas 6 compte les étoiles basses, avec « prises ≥ basses − 1 » ; (b) le plancher de 6 s'applique aux étoiles basses, ce qui ajoute des étoiles d'élan ; (c) on accepte de 4 à 14. Le papa choisit avant la 5e (Step 8).
6. **Saut dans les 0,1 s après le décollage** (contact débouncé, `GROUND_DEBOUNCE_SECONDS`). La règle « au moins une roue au sol » au sens du contact de jeu permet un saut juste après le sommet d'une rampe, ce qui donne un super-saut. On le laisse à la physique, ou on exige un contact brut ce pas-ci (`wheelsOnGround`) ? La mesure est faite au Step 11 de la 5e.
7. **Bouton pendant le décompte ou la pause** (tâche 10, à venir). Le plan jette les demandes hors course (`JumpInput.clear`). Faut-il aussi un retour visuel (bouton masqué pendant le décompte) ? À décider en tâche 10.
8. **Robots polis derrière un Galahad qui ne part pas.** L'addendum ne dit pas combien de temps un copain attend. Sans limite, les 4 copains restent derrière Galahad tant qu'il ne bouge pas. Avec `POLITE_MAX_WAIT` (3 s proposées), ils finissent par pousser et grimper, comme aujourd'hui dès 0,95 s. L'e2e exige 2 s. Le papa choisit la durée, ou « jamais ».
9. **Rattrapage : seuil de réussite.** « Baisse nette attendue » n'a pas de chiffre. Faut-il une assertion (par exemple « après ≤ avant − 20 points ») ou une simple mesure consignée ? Autre biais : dans ces simulations, Galahad doigt posé ne saute jamais, alors que les copains prennent des étoiles hautes. Faut-il une variante mesurée « Galahad sauteur » (driver de test avec `jumpTry` 1 et `jumpSkill` 0,05) pour juger le jeu tel que Galahad le vivra ?
10. **`JUMP_VY` « s'ajoute »** à la vitesse verticale existante, ou la **fixe** ? Le plan suit la lettre (« s'ajoute »). Sur une pente montante ou en rebond, le saut part donc plus haut. À confirmer si le papa voulait une hauteur toujours identique.
11. **Effets d'une étoile prise par un copain.** L'étoile reste visible pour Galahad. Faut-il un petit signe (scintillement, couleur du copain) quand un copain la prend, ou rien ? Le plan ne dessine rien.
