# Plan B (suite) — Rendu interpolé, étoiles pour tous, bouton saut, conduite des robots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. À chaque tâche : implémenteur frais, puis relecture standard + relecture adversariale par sous-agents frais **et** le skill `code-review` sur le diff de la tâche ; tours de correction (≤ 5) ; validation du papa ; passation mise à jour et commitée ; push.

**Statut :** v1.4.
- v1 (04d458a) : brouillon.
- v1.1 : tour de relecture 1 (standard, adversariale avec calculs physiques, rulings du coordinateur).
- v1.2 : décisions du papa intégrées (registre 567ee13) et constats de la re-relecture.
- v1.3 : vérification finale, sections 5e et 6.
  - Placement des étoiles hautes revu : plats voisins fusionnés, élan et atterrissage autorisés hors du plat.
  - Cible réaliste ≈ 1 étoile haute par course, seuil fixé sur mesure.
  - Gain d'un saut sur pente chiffré.
  - Fichiers complétés.
- v1.4 (2026-10-22) : décisions du papa au Step 9 de la 5e (registre e02dcae), spécifiées dans l'addendum « bouton saut » §6 :
  - fin de la 5e réécrite (Steps 9 à 15) : plats étoile dans le générateur, 3 étoiles hautes à 3,90 m ;
  - **nouvelle tâche 5g « fosses de lave »**, entre la 5e et la 6 ;
  - tâche 6 ajustée (sauts des copains aux fosses) ;
  - migration des tests qui supposent « doigt posé = 0 chute » ou des pistes figées ; budget CI.

v1.3 validée par le papa et exécutée jusqu'au Step 8 de la 5e. **v1.4 en attente** : relectures (standard, adversariale, `code-review`), puis réponses du papa aux questions Q-F1 à Q-F5 (addendum §6.10), avant tout code.

**Goal:** Supprimer le tremblement d'affichage (5f). Rendre la course rattrapable : chaque voiture a ses propres étoiles (5d), Galahad a un bouton saut et des étoiles en hauteur s'ajoutent (5e). Les copains conduisent pour de vrai : départ échelonné, lever de pied, politesse, sauts plus ou moins bien placés (6).

**Architecture:** Inchangée (spec §4, plan v2.1). `track/`, `cars/`, `ai/` et `loop/` restent purs.

| Fichier | Rôle |
|---|---|
| `loop/interpolation.ts` | poses et interpolation |
| `loop/frame.ts` | une image complète (pas, alpha, poses dessinées, cible de caméra), appelée **à la fois** par `Game` et par le rejeu des tests |
| `loop/frame-stats.ts` | compteur d'images (debug) |
| `cars/jump.ts` | décision de saut |
| `ai/driver.ts` | pilote automatique et ses types (`Driver`, `DriverContext`) |
| `physics/car.ts` | la seule fonction de saut, `applyJump` |
| `sim/simulate.ts` | le pas de course unique, `stepRace(sim, galahadThrottle, galahadJump)` |
| `input/jump.ts` | front d'appui (à côté de `input/throttle.ts`) |
| `ui/jump-button.ts` | bouton DOM (à côté de `ui/hud.ts`) |

**Ordre d'exécution :** **5f → 5d → 5e → 5g → 6**, puis la tâche 7 du plan v2.1. Prérequis : la tâche 5c est validée et fusionnée sur `ccr-5b6fabc4-n96ofo` (passation, « Prochaine action » 2).

**Spec :**
- `docs/superpowers/specs/2026-10-21-bouton-saut-design.md` (validé) fait autorité pour 5d, 5e et 6. Le Step 1 de la 5e l'amende avec les décisions du papa. Référence : « saut §n ». [fosses] Son §6 (fosses et plats étoile, décisions du 2026-10-22) fait autorité pour la fin de la 5e, la 5g et les sauts des copains aux fosses ; il l'emporte sur l'addendum plan B (§1.4 à §1.8) pour les fosses.
- `docs/superpowers/handoff/2026-10-21-glitch-tremblement.md` §5 à §7 vaut pour 5f. Référence : « tremblement §n ».
- Pour le reste : l'addendum plan B v3.1 (« addendum §n ») et le spec du 2026-10-20.

**Ce document remplace la tâche 6 du plan v2.1** (`2026-10-21-plan-b-copains-et-finitions.md`), en gardant tout ce qu'elle contenait : délai de départ, lever de pied, zone volcan, robots polis, héritages de la 5b. Les tâches 5f, 5d, 5e et 5g s'insèrent entre la 5c et la 6. La tâche 7 du plan v2.1 reste valable ; son objectif mesuré (`race-objective`) inclut désormais les sauts des copains, qui sont dans leur driver (saut §5).

## Décisions du papa (registre 567ee13)

| # | Question | Décision | Effet dans le plan |
|---|---|---|---|
| P1 | Étoiles hautes : combien, et où ? | **En plus** des étoiles du curseur, seulement sur les plats éligibles. Les étoiles basses ne changent pas. | `STAR_HIGH_PER_RACE` (interrupteur, 0 = comme avant au bit près). Le nombre par course est mesuré : la cible réaliste est ≈ 1 par course, pas 2 à 3, car les plats ne mesurent que 20 à 40 m. Le papa le valide avec le tableau de calibration. |
| P2 | Un appui un peu trop tôt compte-t-il ? | **Oui**, mémoire de 0,1 s. | `JUMP_BUFFER: 0.1`, `CarState.jumpRequestedAt`. |
| P3 | Sauter dans une montée : plus haut, ou pareil ? | **Même hauteur partout** : environ 2,5 m de plus que sans saut, quelle que soit la pente. | Formule d'`applyJump` ci-dessous ; l'addendum §1 est amendé. À dire au papa : au milieu d'une rampe-saut, le gain **ressenti** n'est que d'environ 1,5 m (2,5 − Δy·cos²θ), parce que la voiture sans saut aurait déjà décollé du tremplin. |
| P4 | Caractère des copains pour sauter | **Tableau des traits gardé.** | Tâche 6. |
| P5 | Montrer qu'un copain a pris une étoile ? | **Rien à l'écran.** | 5d : on dessine l'état vu par Galahad, sans signe. |

Restent soumis au papa pendant l'exécution :
- le tableau de calibration de la hauteur des étoiles hautes (5e, Step 9) et le nombre d'étoiles hautes par course : **tranchés le 2026-10-22** (ci-dessous) ;
- les validations de fin de tâche.

## Décisions du papa (registre e02dcae, Step 9 de la 5e)

| # | Décision | Effet dans le plan |
|---|---|---|
| P6 | `STAR_HIGH_Y` = 3,90 m | 5e, Steps 9 et 11 ; jeu de dégagements de la 5e : 50 / 12 / 20 / 25 (saut §6.6, ruling R-F7) |
| P7 | **Au moins 3 étoiles hautes par course**, sur des **plats étoile** (≈ 50 m) posés par le générateur, le reste du terrain changeant le moins possible | 5e, Steps 10 à 15 : tranche `'plat-étoile'` de 57 m, 3 par piste (saut §6.6) |
| P8 | **Volcans sans tremplin** : fosses de lave sur le plat, ≈ 1 volcan sur 2 | tâche 5g (saut §6.2 à §6.5) |
| P9 | **Promesse changée** : sans sauter, on tombe dans une fosse (respawn avant, 2e chute de suite → posé de l'autre côté) ; on finit toujours la course ; les tremplins gardent « doigt posé, jamais de chute » | Global Constraints, migration des tests |
| P10 | Toutes les pistes changent, à longueur totale constante ; l'empreinte de Galahad seul est recapturée par un ruling | Global Constraints, Step 13 de la 5e et Step 8 de la 5g (ruling R-F10) |

**Questions ouvertes** (saut §6.10, réponses attendues avant le code concerné) : Q-F1 largeur des fosses (8 m recommandé) ; Q-F2 coût d'une fosse ratée deux fois (posé juste après la fosse recommandé) ; Q-F3 les copains ratent parfois une fosse (`FOSSE_SKILL_FACTOR` 2,5 recommandé) ; Q-F4 exactement 3 étoiles hautes (recommandé) ; Q-F5 pas de bouton qui clignote au premier test (recommandé).

## Global Constraints

Toutes celles du plan v2.1 restent valables :
- unités, pas fixe, roues à 48 côtés, contact débouncé ;
- aucun déplacement de corps dans un callback de collision ;
- commits en français préfixés `feat:`, `fix:`, `test:`, `chore:` ou `docs:` ;
- aucun identifiant de modèle dans les commits.

En plus :

- **Typecheck et `npm test` verts à chaque commit.** `tsconfig.json` inclut `tests/`, et `deploy.yml` lance `npm run typecheck` puis `npm test`. **Jamais de `.skip`.** Une API n'est retirée que dans le commit qui migre son dernier consommateur.
- **Budget CI.** `npm test` reste sous 6 min mur sur le runner (≈ 3 min 05 ici, 331 tests). Simulations de course complète à 5 voitures, balayages et calibrations vont dans `tests/slow/` (`npm run test:slow`). [fosses] Chiffres à jour et ajouts de la fin de la 5e et de la 5g : section « Budget CI (v1.4) » en fin de plan.
  - Chaque fichier lent a un budget écrit en tête, **moins de 30 min mur**.
  - On scinde les fichiers plutôt que de les allonger, puisque Vitest parallélise par fichier.
- **Déterminisme.** Toute décision aléatoire vient d'un `mulberry32` dérivé d'une graine :
  - graine de piste pour les étoiles hautes ; [fosses] `mulberry32((seed ^ 0x6a09e667) >>> 0)` pour la phase de l'alternance tremplin / fosse, sans toucher au `rng` de la piste ;
  - `sim.pilotSeed` pour les copains ;
  - graine de test pour la gigue des écrans simulés.

  `ENCORE` rejoue la même course.
- **Pureté et cycles.** `track/`, `cars/`, `ai/` et `loop/` n'importent ni matter-js ni le DOM. `tests/deps.test.ts` couvre `src/{track,cars,loop}`, et la tâche 6 y ajoute `ai`. Aucun cycle d'import :
  - les types `Driver` et `DriverContext` vivent dans `ai/driver.ts`, que `sim/simulate.ts` importe ;
  - les types qui remontent l'autre sens utilisent `import type` ;
  - pas de réexport.
- **Galahad seul (`robots: false`), « au bit près ».**
  - L'**empreinte par pas** est un sha1 des flottants bruts de toutes les pièces à chaque pas (`tests/empreinte.test.ts`). Elle est figée au Step 1 de la 5f, **sur le commit final de la 5c** : son hash est noté dans le test et au registre à l'exécution.
  - C'est l'empreinte qui juge le « bit près ». `PLAN_A_TRACE` (`tests/simulate.test.ts`, tolérance ±0,01 m) reste un garde-fou lisible, pas une preuve.

  | Tâche | Galahad seul | Pourquoi |
  |---|---|---|
  | 5f | **identique** | Seul le rendu change ; `stepRace` n'est pas touché. |
  | 5d | **identique** (vérifié par l'empreinte) | `syncStarBodies` gardée, catégorie de collision par voiture. Avec une seule voiture, le masque d'un capteur vaut la catégorie de Galahad quand l'étoile est active pour lui, et 0 sinon : c'est le comportement d'aujourd'hui. Les paires de capteurs comptent dans `totalContacts` (`Resolver.preSolvePosition`) : elles ne sont donc jamais laissées actives sans raison. |
  | 5e | **identique au bit près avec `STAR_HIGH_PER_RACE: 0`** ; avec `CONFIG`, identique **attendu** | Étoiles basses inchangées. Tirages des étoiles hautes **après** tous les autres dans `placeStars`, dernier consommateur du rng de piste (`generate.ts:110`). `galahadJump = false` : `applyJump` n'est jamais appelé. Avec `CONFIG`, les capteurs d'étoiles hautes s'ajoutent au monde : doigt posé ne les touche jamais (testé), mais les ids des corps changent. L'empreinte avec `CONFIG` est donc mesurée et consignée, et c'est l'empreinte figée, à `STAR_HIGH_PER_RACE: 0`, qui fait foi. |
  | 5e (fin, v1.4) | **identique avec `ANCIENNES_PISTES`** ; avec `CONFIG`, **recapturée par ruling** | Les plats étoile changent les pistes (décision P10). `ANCIENNES_PISTES` = `{ STAR_FLATS_PER_RACE: 0, FOSSE_PERIOD: 0, STAR_HIGH_PER_RACE: 0, STAR_STEP_MIN: 60, STAR_STEP_MAX: 100 }` redonne les pistes de e02dcae au bit près (saut §6.9) : l'empreinte figée y reste la preuve que la physique n'a pas bougé. |
  | 5g | **identique avec `ANCIENNES_PISTES`** ; avec `CONFIG`, **recapturée par ruling** | Les fosses changent les pistes. Aucun chemin de code des fosses ne s'exécute sans fosse. |
  | 6 | **identique**, avec `ANCIENNES_PISTES` et (v1.4) avec `CONFIG` | Galahad n'a pas de driver ; le saut provisoire des copains aux fosses (5g) n'existe qu'à 5 voitures. |

  Si l'empreinte bouge alors que le tableau dit « identique » : on s'arrête, on mesure, le papa tranche, le ruling va au registre. On ne recapture jamais en silence. [fosses] Une recapture « par ruling » (fin de 5e, 5g) consigne au registre : les 3 anciens hash, les 3 nouveaux, le commit, et la preuve que l'empreinte `ANCIENNES_PISTES` est restée identique dans le même commit.
- **Promesse de la 5c conservée (saut §0).** Doigt posé sans jamais sauter, on finit la course et on ne tombe jamais dans la lave. L'invariant `lavaByCar.galahad === 0` à 5 voitures, graines 0 à 23 (`tests/slow/race-invariants-*.test.ts`), reste vert à chaque tâche.
  [fosses] **Amendée à partir de la 5g (décision P9, saut §6.1)** :
  - doigt posé sans jamais sauter : 0 chute **aux tremplins** ; **exactement 2 chutes par fosse** (la 2e pose la voiture de l'autre côté) ; arrivée avant 240 s ;
  - doigt posé avec un saut au centre de la fenêtre à chaque fosse (`fosseJumpWanted`, 5g) : 0 chute, comme avant ;
  - les invariants à 5 voitures font courir Galahad **avec** ce saut (`lavaByCar.galahad === 0` garde son sens), et une famille nouvelle le fait courir **sans** (2 chutes par fosse, 0 au tremplin).
- **Paramètres.** Chaque nouveau paramètre va dans `src/config.ts`, en nombres seulement. Une constante dérivée est déclarée avant le littéral, comme `D_LANCE`. La gravité devient la constante locale `GRAVITY`, réutilisée par `JUMP_VY`. [fosses] Constantes de la fin de la 5e et de la 5g : saut §6.9 ; `STAR_FLAT_LENGTH` est dérivée (dégagement d'entrée + élan + atterrissage).
- [fosses] **Pistes d'avant.** `tests/helpers/anciennes-pistes.ts` exporte `ANCIENNES_PISTES` et `withAnciennesPistes(cfg)`. Les tests qui jugent la physique ou comparent à une mesure d'avant (empreinte, `PLAN_A_TRACE`, `PRE_5E_STARS`, phases, dosage, calibrations, rejeu d'interpolation, rattrapage apparié) les utilisent ; les tests d'acceptation du jeu (invariants, cas des volcans, fosses, étoiles) tournent sur `CONFIG`. Un test `tests/anciennes-pistes.test.ts` fige le sha1 des pistes de e02dcae (points, tranches, volcans, étoiles ; graines 0 à 49, 1 680 m) : si ce sha1 bouge, l'interrupteur ment.
- **Fin de tâche.**
  - Commandes : `npm run typecheck`, `npm test`, `npm run test:slow` et `npm run e2e`.
  - Capture dans `e2e/screenshots/` quand l'écran change.
  - Passation et registre mis à jour, commit `docs: tâche Nx validée, passation et registre`.
  - Enfin `git status -sb` et `git push origin ccr-5b6fabc4-n96ofo`.
  - Les corrections après relecture font un commit `fix: …` par tour.
- **Arbre partagé.** Jamais de `git reset`, `checkout`, `stash` ni `clean` pendant qu'un sous-agent travaille. Les sondes s'appellent `tests/zz-probe-*.test.ts` et sont supprimées avant le commit.

## Review Focus

1. **Écran à 59,94, 60,05 ou 120 Hz, avec gigue.**
   - Attendu : aucun épisode de tremblement en interpolé, et pas de traînée à une réapparition.
   - Tâche : 5f.
2. **Un copain prend une étoile juste devant Galahad.**
   - Attendu : elle reste visible et prenable par Galahad, qui a aussi son turbo.
   - Tâche : 5d.
3. **Doigt posé, turbo compris, à 5 voitures.**
   - Attendu : 0 étoile haute prise sans saut, 0 chute de Galahad.
   - Tâche : 5e.
4. **Saut au milieu d'un tremplin.**
   - Attendu : apogée ≈ 2,5 m au-dessus du vol balistique sans saut (même hauteur partout), pas ≈ 12 m.
   - Tâche : 5e.
5. **Tap sur le bouton pendant que l'autre doigt accélère.**
   - Attendu : la voiture avance et saute. Un tap seul donne un saut, sans gaz.
   - Tâche : 5e.
6. **Copain fonceur devant une étoile haute.**
   - Attendu : jamais de saut dans `[xLancement, xReception]`, et au plus 3 respawns par course.
   - Tâche : 6.
7. **Galahad arrêté sur la grille.**
   - Attendu : les copains ne le poussent pas pendant au moins 2 s.
   - Tâche : 6.
8. [fosses] **Turbo pris sur une double-bosse juste avant une fosse, sans sauter.**
   - Attendu : la voiture tombe (jamais de survol), grâce au plat de garde de 20 m.
   - Tâche : 5g.
9. [fosses] **Départ arrêté au point sûr d'avant une fosse, après une chute.**
   - Attendu : un saut bien placé passe (fenêtre ≥ 0,4 s, mesurée 0,87 s pour 8 m) ; à la 2e chute, la voiture est posée de l'autre côté et finit la course.
   - Tâche : 5g.
10. [fosses] **Plat étoile après une rampe-saut ou une double-bosse, en turbo.**
    - Attendu : jamais de plat étoile juste après une rampe-saut ; après une double-bosse, aucune étoile haute prise sans saut.
    - Tâche : 5e (fin).
11. [fosses] **`ANCIENNES_PISTES`.**
    - Attendu : pistes et empreinte de e02dcae au bit près ; aucun chemin de code des fosses ni des plats étoile ne s'exécute.
    - Tâches : 5e (fin) et 5g.

---

## Structure des fichiers (nouveaux ou refondus)

```
src/loop/interpolation.ts     CarPose, lerpAngle, lerpCarPose, PoseHistory (5f)
src/loop/frame.ts             runFrame, cameraTarget : une image, pure, partagée par Game et le rejeu (5f)
src/loop/frame-stats.ts       StepHistogram (5f)
src/sim/simulate.ts           posesOf, sceneOf(sim, poses, alpha) (5f) ; étoiles par voiture (5d) ;
                              stepRace(sim, throttle, jump), 'jump', jumpReady (5e) ; drivers { throttle, jump } (6)
src/sim/harness.ts            simulateRace et ses aides, extraits de simulate.ts ; option jump (5e)
src/physics/world.ts          catégorie de collision par voiture (5d)
src/physics/car.ts            filtre par voiture (5d) ; applyJump (5e)
src/physics/stars.ts          syncStarBodies : masque = OU des voitures pour qui l'étoile est active (5d)
src/cars/stars.ts             StarState par voiture (5d)
src/cars/jump.ts              canJump, wantsJump (5e)
src/cars/state.ts             lastJumpAt, jumpRequestedAt (5e)
src/track/types.ts, stars.ts  Star.high, étoiles hautes ajoutées (5e)
src/input/jump.ts             JumpInput (5e)
src/ui/jump-button.ts         JumpButton (5e)
src/ui/hud.ts                 setFrameSteps (5f) ; fps et compteurs déplacés sous le bouton (5e)
src/cars/pilots.ts            jumpTry, jumpSkill (6)
src/ai/driver.ts              Driver, DriverContext, makeRobotDriver (6)
src/track/query.ts            inNoJumpZone (6)
tests/helpers/frames.ts       écrans simulés, rejeu par runFrame, détecteur d'épisodes (5f)
tests/helpers/fingerprint.ts  empreinte par pas (5f)
tests/helpers/jump-runs.ts    harnais de saut : voiture lancée, saut à l'instant donné, fenêtre par dichotomie (5e)
tests/helpers/recorded.ts     courses enregistrées (poses par pas) pour l'évaluation hors ligne (5e)
src/track/types.ts            [fosses] SliceType 'plat-étoile' (5e fin) et 'fosse' ; Volcano = Tremplin | Fosse (5g)
src/track/slices.ts           [fosses] platEtoile (5e fin) ; fosseGeometry, fosse (5g)
src/track/generate.ts         [fosses] plats étoile insérés (5e fin) ; alternance tremplin / fosse (5g)
src/track/stars.ts            [fosses] étoiles des plats étoile (5e fin) ; zones et étoile de réception des fosses (5g)
src/track/query.ts            [fosses] tremplins, fosses, nextFosse, inGhostZone (option B) (5g)
src/cars/jump.ts              [fosses] fosseJumpWanted : saut au centre de la fenêtre d'une fosse (5g)
src/render/track.ts           [fosses] fosse : lave à ras bord, langues de feu, halo, panneau (5g)
tests/helpers/anciennes-pistes.ts  [fosses] ANCIENNES_PISTES, withAnciennesPistes (5e fin, complétée en 5g)
tests/helpers/fosses.ts       [fosses] piste à une fosse, fosseRun, fosseWindow (dichotomie), sauteur parfait (5g)
```

---

### Task 5f (ajoutée) : Rendu interpolé (tremblement)

**Constat (tremblement §5–§6, mesuré) :**
- `Game.present` dessine `sceneOf(sim)`, c'est-à-dire l'état du dernier pas. Pendant ce temps, `Camera.update(…, elapsed)` lisse au temps réel.
- Une image qui reçoit 0 pas ou 2 pas déplace donc les voitures de ±1 pas par rapport au décor : 13 px CSS à 14 m/s, 20 px en turbo.
- À 60,05 Hz avec 0,2 ms de gigue : 75 épisodes sur 12 courses sans interpolation, contre 1 avec.

Correctif retenu : la piste 1 du rapport (§7). Coût : un pas de latence, soit 16 ms.

**Files:**
- Create: `src/loop/interpolation.ts`, `src/loop/frame.ts`, `src/loop/frame-stats.ts`, `tests/helpers/frames.ts`, `tests/helpers/fingerprint.ts`
- Modify:
  - `src/sim/simulate.ts` : `posesOf`, `carView(sim, i, pose?)`, `sceneOf(sim, poses?, alpha?)` ;
  - `src/game.ts` : `frame` et `present` passent par `runFrame` et `cameraTarget` ;
  - `src/ui/hud.ts` : `setFrameSteps` ;
  - `e2e/helpers.ts` : lecture de `frameSteps`.
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
/** Résultat d'un pas, fourni par l'appelant : poses après le pas et index téléportés ; { rebuilt } après rebuildCars ; 'stop' = abandon. */
export type StepOutcome = { poses: CarPose[]; teleported: ReadonlySet<number> } | { rebuilt: CarPose[] } | 'stop';
export interface FrameState { acc: number; history: PoseHistory }
export interface FrameResult { steps: number; alpha: number; poses: CarPose[]; stopped: boolean }
/** advanceAccumulator, puis step(i) pour chaque pas (i = 0 pour le premier), puis poses dessinées = history.at(acc / dt) (cur si interpolate = false). */
export function runFrame(s: FrameState, elapsed: number, cfg: Config, step: (i: number) => StepOutcome, interpolate = true): FrameResult;
/** Cible de caméra pour la pose de Galahad : x, max(y, sol + 3), vitesse. */
export function cameraTarget(pose: CarPose, groundAt: (x: number) => number): { x: number; y: number; speed: number };
// src/loop/frame-stats.ts (pur)
export class StepHistogram { record(steps: number, nowMs: number): void; readonly last: { frames: number; zero: number; multi: number } }
// src/sim/simulate.ts
export function posesOf(sim: RaceSim): CarPose[];
export function carView(sim: RaceSim, index: number, pose?: CarPose): CarView;
/** Sans poses : comportement actuel. Avec poses et alpha : voitures interpolées et Scene.t = sim.time − (1 − alpha) × PHYSICS_DT. */
export function sceneOf(sim: RaceSim, poses?: CarPose[], alpha?: number): Scene;
```

**Règles :**
- **État dessiné** = `lerp(précédent, courant, alpha)`, avec `alpha = acc / PHYSICS_DT`.
- **Angles.** Le châssis et les roues passent par `lerpAngle`. L'angle de roue reste cumulé (`-w.angle`) ; il avance de 44,6° par pas en turbo, donc moins de 180°.
- **Caméra.** `cameraTarget(poses[0], x => heightAt(track, x))`, puis `camera.update(t.x, t.y, t.speed, elapsed)`. `elapsed` reste le temps réel.
- **Téléportation.**
  - Après chaque `stepRace`, `Game` passe dans `teleported` les index qui ont un `'respawn'` dans `sim.events`.
  - Après `rebuildCars`, le rappel renvoie `{ rebuilt: posesOf(sim) }` et `runFrame` appelle `history.reset`.
  - Pas de seuil de distance : les événements font foi.
- **Temps de simulation.** Étoiles, effets et HUD gardent le temps de simulation. `Scene.t` suit la même latence que les voitures.
- **`?debug=1`.** `StepHistogram` est alimenté à chaque image. Le HUD affiche « 0 pas : z · 2+ pas : m » sur la dernière seconde (`.hud-steps`), à côté du fps. En 5e, les deux passent sous le bouton saut. `window.__game.frameSteps` vaut `{ frames, zero, multi }`, pour que le papa puisse vérifier sur la tablette (tremblement §8).
- **`present` ne touche jamais `sim`.**

**Détecteur (tremblement §1, côté rendu) :**
- On suit la position écran de Galahad en px CSS, vue 1280 × 800, donc `ppm = 800 / VISIBLE_HEIGHT_M` ≈ 57,1 px/m.
- Un **à-coup** est une image où |Δ²x| > 4 px.
- Un **épisode** est d'au moins 3 à-coups en 0,5 s.
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
Le rejeu appelle **les mêmes** `runFrame`, `cameraTarget` et `Camera` que `Game`. Seule la source des pas change : des poses enregistrées au lieu de `stepRace`.

- [ ] **Step 1 : Figer l'empreinte** sur le commit final de la 5c, avant toute modification.
  - Créer `tests/helpers/fingerprint.ts` et `tests/empreinte.test.ts`.
  - Cas : Galahad seul, graines 0, 1 et 2, 1 680 m, doigt posé, 30 s.
  - Coller les 3 sha1 cumulés **mesurés**. En commentaire : le hash du commit, et « si l'empreinte bouge, c'est un défaut, pas une valeur à recapturer ».
  - Commande : `npx vitest run tests/empreinte.test.ts`, verte en moins de 10 s.
- [ ] **Step 2 : Extraire `loop/frame.ts` sans changer le comportement.**
  - Écrire `runFrame` et `cameraTarget`, une `PoseHistory` minimale dont `at()` renvoie `cur` (comportement d'aujourd'hui), et `posesOf`. `Game.frame` et `present` passent par eux.
  - Tests purs dans `tests/frame.test.ts` :
    - nombre de pas égal à celui d'`advanceAccumulator` ;
    - `'stop'` interrompt la boucle ;
    - `{ rebuilt }` remet l'historique à zéro ;
    - `step` reçoit i = 0 pour le premier pas ;
    - `cameraTarget` vaut `max(y, sol + 3)`.
  - Puis `npm run typecheck`, `npm test` (empreinte inchangée) et `npm run e2e` doivent être verts. Pas de commit à ce stade.
- [ ] **Step 3 : Tests rouges.**
  - `tests/interpolation.test.ts` :
    - `lerpAngle(179°, −179°, 0,5)` donne ±180°, pas 0 ;
    - `alpha` 0 donne `prev`, 1 donne `cur`, et un alpha hors de [0, 1] est borné ;
    - voiture téléportée : `at(α) = cur` ;
    - `reset` fonctionne ;
    - `at` ne modifie rien.
  - `tests/frame-stats.test.ts` : la suite 1, 0, 2, 1, 1, 3 sur 1 s donne `{ 6, 1, 2 }`, puis le compteur repart à zéro.
  - `tests/interpolation-replay.test.ts` (CI) :
    - Cas : Galahad seul, graine 1, 40 s ; écrans {60,05 Hz, σ 0,2 ms} et {59,94 Hz, σ 0,1 ms}, graines d'écran 0 à 2.
    - Contrôle : `actuel` compte au moins 1 épisode au total.
    - **Exigence : `interpolé` = 0, et ≤ `physique`.**
    - Téléportation sans traînée : Galahad posé à `xLava` du premier volcan de la graine 1, comme `tests/respawn-e2e.test.ts`. Au pas du `'respawn'`, pour α ∈ {0 ; 0,5 ; 0,99}, l'image dessine exactement la cible. Contrôle : sans le drapeau de téléportation, α = 0,5 donne un x intermédiaire.
    - `rebuildCars` : la pose dessinée est la cible.
    - Physique inchangée : 600 pas à 5 voitures (graine 2), avec et sans `runFrame`, donnent des `stepFingerprint` identiques à chaque pas.
  - Commande : `npx vitest run tests/interpolation.test.ts tests/frame-stats.test.ts tests/interpolation-replay.test.ts`.
  - **ROUGE attendu et constaté** : avec la `PoseHistory` minimale, `interpolé` ≡ `actuel`. On note le nombre d'épisodes.
- [ ] **Step 4 : Implémenter** `lerpAngle`, `lerpCarPose`, la `PoseHistory` complète, `StepHistogram`, `sceneOf(sim, poses, alpha)` et l'affichage debug. **VERT**, plus `npx vitest run tests/deps.test.ts`.
- [ ] **Step 5 : Suite lente** `tests/slow/interpolation-replay-slow.test.ts`. Budget : moins de 30 min ; enregistrements en mémoire, une course par graine.
  - Cas : 12 courses à 5 voitures (graines 0 à 11, 150 s), chacune rejouée sur les écrans {60,05 / 0,2 ; 59,94 / 0,1 ; 60,000 / 0,2 ; 120 Hz / 0,1}.
  - Exigence par écran : `interpolé` ≤ `physique`, et 0 épisode hors de ±1 s autour d'une réapparition.
  - Le test imprime le tableau physique / actuel / interpolé (tremblement §6).
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/interpolation-replay-slow.test.ts`.
- [ ] **Step 6 : e2e** (`e2e/race.spec.ts`, `?seed=1&debug=1`).
  - Après 2 s, `.hud-steps` est visible et `window.__game.frameSteps.frames` > 0.
  - Les 6 e2e existants restent verts.
  - Commande : `npm run e2e`.
- [ ] **Step 7 : Suites complètes** : `npm run typecheck`, `npm test` (chronométré, moins de 6 min), `npm run test:slow`.
- [ ] **Step 8 : Commit** `feat: rendu interpolé entre deux pas, caméra sur la pose interpolée, compteur d'images à 0 et 2 pas`.
- [ ] **Step 9 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec ces sondes :
    - écrans à 90 et 120 Hz ;
    - `MAX_STEPS_PER_FRAME` atteint ;
    - réapparition au 1er puis au 2e pas d'une image à 2 pas ;
    - voiture fantôme qui sort de zone ;
    - `acc` ≈ dt − 1e-9 ;
    - allocations par image à 5 voitures ;
    - stroboscope des roues en turbo (à noter seulement).
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 10 : Validation du papa** sur la tablette, avec `?debug=1`.
  - Il vérifie qu'aucune voiture ne tremble plus, relève le compteur d'images et le modèle de tablette.
  - Puis commit `docs: tâche 5f validée, passation et registre`, `git status -sb`, push.

---

### Task 5d (ajoutée) : Étoiles pour tous

**Règle (saut §2) :**
- L'état d'une étoile est tenu **par voiture**. Une voiture qui prend une étoile la rend inactive pour elle seule pendant `STAR_RESPAWN_SECONDS`, et son turbo démarre.
- `collectStars` décide voiture par voiture.
- L'écran montre l'état vu par Galahad. Une prise par un copain n'y laisse aucun signe (décision P5).
- **Capteurs :** `syncStarBodies` est gardée, avec une **catégorie de collision par voiture**. Le masque d'un capteur est le OU des catégories des voitures pour qui l'étoile est active.

**Files:**
- Modify (code) :
  - `src/physics/world.ts` :
    - `carCategory(index) = 0x0008 << index` et `CAT.ALL_CARS` (OU des 5 bits) ;
    - garde levée si plus de 5 voitures ;
    - sol, mur et lave passent à `mask: CAT.ALL_CARS` ;
    - `CAT.CAR` est retiré quand son dernier usage est migré.
  - `src/physics/car.ts` : `createCar` passe `category: carCategory(index)`, et `MASK_NORMAL = GROUND | ALL_CARS | SENSOR`.
  - `src/physics/stars.ts` : `syncStarBodies` prend comme masque le OU des voitures actives ; `createStarBodies` part de `mask: ALL_CARS`.
  - `src/cars/stars.ts` : refonte.
  - `src/sim/simulate.ts` :
    - `newStarStates(track.stars, cars.length)` ;
    - `collectStars(sim, car, index)` ;
    - `sceneOf` dessine l'état vu par l'index 0 ;
    - `SimulateResult` gagne `starsByCar` et `firstStar` ;
    - commentaires de `RaceSim.stars` et de `stepRace` réécrits.
- Modify (tests, **consommateurs de `CAT.CAR`**) :
  - `tests/car.test.ts:66-67` (catégorie et masque d'une pièce) et `:340-350` (masque invulnérable) ;
  - `tests/fantomes.test.ts:32-34` (`carBits`, `SOLID`) ;
  - `tests/respawn-e2e.test.ts:178`, `:193` et `:254` (`masks`) ;
  - `tests/simulate.test.ts:125` (bit voiture du masque après la grille) ;
  - `tests/world.test.ts:18`, **migration obligatoire** (corps de test filtré `category: CAT.CAR`) ;
  - le commentaire de `src/sim/simulate.ts:227` (« toutes filtrées CAT.CAR »).

  Les tests qui lisent le bit « voiture » lisent désormais `& CAT.ALL_CARS` ; ceux qui lisent la catégorie lisent `carCategory(index)`.
- Modify (tests, **consommateurs de l'état d'étoile**) :
  - `tests/turbo.test.ts` (l. 3 et 37–50, vers `isStarActiveFor`/`takeStarFor`/`newStarStates(…, n)`) ;
  - `tests/slow/stars-sim.test.ts` (l. 4 et 37–52, `takenAt[0]`) ;
  - `tests/simulate.test.ts` : en-tête « étoiles partagées » devient « étoiles par voiture ». **Le test l. 190, « une étoile prise par une voiture est inactive pour toutes : au même pas et au pas suivant », est inversé** en « … reste active pour les autres, inactive pour elle seule ».
- Modify (dépôt) : `.gitignore` gagne `tests/slow/out/`.
- Test: `tests/stars-pour-tous.test.ts`, `tests/slow/rattrapage-0-23.test.ts`, `tests/slow/rattrapage-24-47.test.ts`, `tests/slow/race-invariants-*.test.ts` (relancés)

**Interfaces :**
```ts
// src/cars/stars.ts (pur)
export interface StarState { id: number; /** Par index de voiture : instant (s) de sa dernière prise, null si jamais. */ takenAt: (number | null)[] }
export function newStarStates(stars: Star[], carCount: number): StarState[];
export function isStarActiveFor(s: StarState, carIndex: number, t: number, cfg: Config): boolean;
export function takeStarFor(s: StarState, carIndex: number, t: number): void;
// src/physics/world.ts
export const carCategory: (index: number) => number;
// SimulateResult
starsByCar: Record<string, Extract<SimEvent, { type: 'star' }>[]>;
firstStar: { carId: string; t: number } | null;   // au même pas : la plus petite index
```
`isStarActive` et `takeStar` sont retirées dans ce commit, avec leurs derniers consommateurs.

**Mesure du rattrapage** (sert aussi en 5e et en 6). Deux fichiers en parallèle, `tests/slow/rattrapage-0-23.test.ts` et `tests/slow/rattrapage-24-47.test.ts`, harnais `fiveCarRace`. Budget : ≈ 15 min par fichier.
- Courses : 48 à 5 voitures, Galahad doigt posé (graines 0 à 47), plus 16 avec le motif `liftedPattern(seed, 0.3)`.
- Pour chaque graine :
  - vainqueur ;
  - voiture de la première étoile (premier `'star'` par `onStep`) ;
  - place de Galahad ;
  - étoiles prises par voiture.
- Une ligne JSON par graine dans `tests/slow/out/rattrapage-<étape>.jsonl`, pour la **comparaison appariée par graine** entre étapes :
  - nombre de graines où « vainqueur = première étoile » passe de vrai à faux, et l'inverse ;
  - écart moyen de la place de Galahad.
- Le tableau est imprimé. Pas d'assertion chiffrée (ruling Q9).

- [ ] **Step 1 : Mesure « avant »**, sur le code de départ, sans changer `src/`.
  - Créer les deux fichiers `rattrapage-*` et compléter `.gitignore`.
  - Lancer `npx vitest run -c vitest.slow.config.ts tests/slow/rattrapage-0-23.test.ts tests/slow/rattrapage-24-47.test.ts`.
  - Porter le résultat au registre, ligne `Task 5d: rattrapage avant`.
- [ ] **Step 2 : Écrire les tests, qui doivent échouer.** Fichier `tests/stars-pour-tous.test.ts` :
  - **Pur :**
    - la voiture 1 prend l'étoile à t = 10 : l'étoile reste active pour les voitures 0, 2, 3 et 4 ;
    - elle est inactive pour la voiture 1 jusqu'à 10 + `STAR_RESPAWN_SECONDS` (borne exclue) ;
    - deux prises au même t : chaque voiture a son propre délai.
  - **Physique :**
    - `syncStarBodies`, avec la voiture 1 inactive, donne un masque égal au OU des catégories 0, 2, 3 et 4 ;
    - `carCategory` donne 5 bits distincts, disjoints de GROUND et de SENSOR.
  - **Simulation, graine 1, `robots: true` :**
    - un copain posé 6 m avant la 1re étoile, Galahad 20 m derrière, tous deux doigt posé, reçoivent chacun un `'star'` du **même** `id`, et les deux turbos sont actifs ;
    - `sceneOf(sim).stars[i].active` reste vrai après la prise du copain et ne passe à faux qu'après celle de Galahad.
  - **Réapparition par voiture :** une voiture garée dans le capteur, doigt levé, reçoit l'étoile à t0, t0 + 5 et t0 + 10 s (±1 pas), jamais entre.
  - Le test inversé de `tests/simulate.test.ts:190`.
  - Commande : `npx vitest run tests/stars-pour-tous.test.ts tests/simulate.test.ts`. Résultat attendu : **ROUGE**.
- [ ] **Step 3 : Implémenter**, puis **VERT** : `npm run typecheck` et `npm test`. **L'empreinte et `PLAN_A_TRACE` ne bougent pas.**
- [ ] **Step 4 : Effet à 5 voitures** (`npm run test:slow`).
  - Sur les graines 0 à 23, ces invariants doivent rester vrais :
    - au plus 3 respawns par robot ;
    - blocage d'au plus 2,1 s ;
    - `lavaByCar.galahad === 0` ;
    - `ghostContacts === 0`.
  - Tableau par graine, avant et après : étoiles par voiture, chutes par voiture, place de Galahad.
  - Si un invariant tombe, **on ne l'assouplit pas** : on cherche la cause avec `describeFall`, et le papa tranche.
- [ ] **Step 5 : Mesure « après 5d »** (comparaison appariée), puis registre. **Commit** `feat: étoiles pour tous, état par voiture, vu par Galahad à l'écran`.
- [ ] **Step 6 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec ces sondes :
    - deux voitures dans le même capteur au même pas ;
    - étoile d'élan prise par 3 voitures ensemble ;
    - `meanStepMs` avant et après ;
    - empreinte de Galahad seul, graines 0 à 4, course complète ;
    - filtres d'une voiture invulnérable ou fantôme.
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 7 : Validation du papa.**
  - Lui montrer une capture d'une étoile prise par un copain, encore visible, et le chiffre du rattrapage.
  - Puis commit `docs: tâche 5d validée, passation et registre`, `git status -sb`, push.

---

### Task 5e (ajoutée) : Bouton saut et étoiles hautes (Galahad)

**Décisions du papa :**
- **P1** : des étoiles hautes **ajoutées** aux étoiles du curseur ; les étoiles basses ne changent pas.
- **P2** : mémoire de la demande pendant 0,1 s.
- **P3** : **même hauteur partout**.
- [fosses] **P6, P7** (Step 9, e02dcae) : `STAR_HIGH_Y` = 3,90 m ; au moins 3 étoiles hautes par course, sur des plats étoile. La fin de la tâche (Steps 9 à 15) est réécrite en v1.4, plus bas.

**Saut §1 (amendé au Step 1) :**
- **Bouton** : rond, au moins 140 px, en bas à gauche, `data-no-pedal`.
- **Front d'appui** : `pointerdown` sur le bouton, ou `keydown` Espace non répété.
- **Conditions** :
  - au moins une roue au sol, au sens du contact débouncé (ruling Q6) ;
  - `JUMP_COOLDOWN` écoulé ;
  - course en cours.
- **Demande non servie** : elle reste valable `JUMP_BUFFER` = 0,1 s.

**Files:**
- Create: `src/cars/jump.ts`, `src/input/jump.ts`, `src/ui/jump-button.ts`, `src/sim/harness.ts`, `tests/helpers/jump-runs.ts`, `tests/helpers/recorded.ts`
- Modify (spec) : `docs/superpowers/specs/2026-10-21-bouton-saut-design.md` (Step 1).
- Modify (code) :
  - `src/config.ts` (ci-dessous).
  - `src/physics/car.ts` : `applyJump`.
  - `src/cars/state.ts` : `lastJumpAt` et `jumpRequestedAt` (`number | null`, `null` dans `newCarState`).
  - `src/sim/simulate.ts` :
    - `stepRace(sim, galahadThrottle, galahadJump = false)` ;
    - `CarSim.grounded` ;
    - événement `'jump'` ;
    - `jumpReady` ;
    - `simulateRace` et ses aides (`StuckMeter`, `carPairsTouching`, `SimulateResult`) sont **déplacés** dans `src/sim/harness.ts`. C'est l'héritage de la 5b, avancé ici parce que la 5e ajoute du code au harnais.
  - `src/sim/harness.ts` : option `jump?: (t: number, sim: RaceSim) => boolean` (demande de Galahad à chaque pas, défaut jamais) et `highStarsByCar`.
  - `src/track/types.ts` (`Star.high: boolean`) et `src/track/stars.ts`.
  - `src/ui/hud.ts` : `.hud-fps` et `.hud-steps` passent **sous** le bouton (`left: 28px; bottom: 6px`, bouton à `bottom: 40px`).
  - `src/game.ts` :
    - `JumpInput` et `JumpButton` ;
    - **`take()` appelé dans le rappel de pas de `runFrame` quand i === 0** : si l'image n'a aucun pas, la demande reste en attente ;
    - bouton grisé ;
    - poussière sur `'jump'` ;
    - en debug, `__game.jumps` et `__game.throttlePressed`.
  - `e2e/helpers.ts` : `tapJump`, `holdFingerAndTapJump`.
- Modify (tests, **migration de `simulateRace` vers `src/sim/harness.ts`**, sans réexport, dans le même commit) :
  - `tests/observer.test.ts:4`, `tests/simulate.test.ts`, `tests/race-smoke.test.ts` ;
  - `tests/helpers/race.ts`, `runs.ts`, `phases.ts` ;
  - `tests/slow/*.test.ts`.
- Modify (tests, **le type `Star` gagne `high`**) :
  - `tests/turbo.test.ts:38,43` : littéraux `Star` avec `high: false`.
  - `tests/stars.test.ts` : filtrer `!s.high` aux l. 75, 100-103, 108-125, 130-134, 157, 198-208, 211, 216-220 et 251-252 (« y − sol ≈ 0,6 », comptes 6 à 14, écarts du curseur, plancher). Les étoiles basses restent soumises à ces règles inchangées. La l. 204 (y d'une étoile d'élan) est couverte par le filtre de la l. 198.
  - `tests/smoke.test.ts` : nouvelles constantes.

  Les bornes « 6 à 14 étoiles prises doigt posé » (`tests/race-smoke.test.ts:28-29`, `tests/helpers/phases.ts:485`, `tests/slow/finish.test.ts`) **ne changent pas** : les étoiles basses sont les mêmes et doigt posé ne prend jamais d'étoile haute.
- Test: `tests/jump.test.ts`, `tests/jump-input.test.ts` (jsdom), `tests/high-stars.test.ts`, `tests/high-stars-window.test.ts` (garde CI), `tests/slow/calibration-saut-sol.test.ts`, `tests/slow/calibration-saut-fenetres.test.ts`, `tests/slow/calibration-saut-vols-0-11.test.ts`, `tests/slow/calibration-saut-vols-12-23.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan.test.ts`, `e2e/jump.spec.ts`

**Interfaces :**
```ts
// src/config.ts — avant le littéral
const GRAVITY = 4.9;     // m/s², remplace le littéral GRAVITY: 4.9
const JUMP_APEX = 2.5;   // m : hauteur gagnée par un saut au-dessus du vol sans saut, quelle que soit la pente (décision P3)
GRAVITY,
JUMP_APEX,
JUMP_VY: Math.sqrt(2 * GRAVITY * JUMP_APEX),   // ≈ 4,95 m/s : vitesse verticale d'un saut depuis l'arrêt ; corrigée par la mesure du Step 3 si l'apogée sort de ±10 % (consigné)
JUMP_COOLDOWN: 0.5,                            // s depuis le dernier saut de cette voiture
JUMP_BUFFER: 0.1,                              // s : mémoire d'une demande pas encore servie (décision P2)
JUMP_BUTTON_SIZE_PX: 150,                      // px CSS (≥ 140)
STAR_HIGH_PER_RACE: 3,                         // au plus N étoiles hautes ajoutées par course ; 0 = étoiles d'avant la 5e, au bit près (décision P1)
STAR_HIGH_Y: /* calibré au Step 8, départ 3,85 */,                 // m au-dessus du sol local (centre)
STAR_HIGH_TAKEOFF_ROOM: /* calibré, départ 15 */,                  // m de terrain permis avant l'étoile (élan du saut), pas forcément du plat
STAR_HIGH_LANDING_ROOM: /* calibré, départ 15 */,                  // m de terrain permis après l'étoile (atterrissage) ; le vol dure ≈ 2 s, soit ≈ 28 m à 14 m/s
STAR_HIGH_GAP: 10,                                                 // m minimum entre une étoile haute et toute étoile basse
STAR_HIGH_RAMP_CLEARANCE: /* calibré, départ 70 */,                // m après la fin d'une rampe-saut
STAR_HIGH_BUMP_CLEARANCE: /* calibré, départ 12 */,                // m après la fin d'une bosses, double-bosse ou cratère
// src/cars/jump.ts (pur)
export function canJump(o: { lastJumpAt: number | null; grounded: boolean; finished: boolean; t: number }, cfg: Config): boolean;
/** Demande valable à t : faite il y a au plus JUMP_BUFFER (à 1e-9 près). */
export function wantsJump(jumpRequestedAt: number | null, t: number, cfg: Config): boolean;
// src/physics/car.ts
/**
 * Saut, même hauteur partout (décision P3) : vy0 = vitesse verticale du châssis vers le haut (m/s).
 * vy = √(vy0² + 2 g JUMP_APEX) si vy0 > 0 (l'apogée monte de JUMP_APEX au-dessus du vol sans saut),
 * sinon JUMP_VY (voiture à plat ou qui descend : même poussée vers le haut, apogée ≈ JUMP_APEX au-dessus du point de départ).
 * Cette vy est posée sur le châssis et les deux roues, vx inchangée. Hors de tout callback de collision.
 */
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
export function flatJumpTrajectory(v: number, cfg: Config): CarPose[];   // une trajectoire de saut sur le plat, par vitesse
export function windowFor(world: World, star: Star, v: number, cfg: Config): { start: number; end: number; seconds: number; centreLead: number };   // dichotomie des bords
// tests/helpers/recorded.ts
export function recordRace(seed: number, opts: { robots: boolean; turboBefore?: number[] }): { track: Track; poses: CarPose[][] };   // une course, poses de toutes les pièces à chaque pas
export function sensorHits(rec: { poses: CarPose[][] }, star: { x: number; y: number }, cfg: Config, margin?: number): { step: number; carIndex: number }[];   // hors ligne : châssis rectangle + roues disques contre le disque du capteur (r 0,5), marge 5 cm par défaut
```

**Règles de mise en œuvre :**
- **Dans `stepRace`**, voiture par voiture, après `updateGroundContact` et avant `stepWorld` :
  1. Une nouvelle demande (Galahad : `galahadJump` ; robot : `jump` du driver, tâche 6) pose `state.jumpRequestedAt = t`.
  2. Si `wantsJump(jumpRequestedAt, t)` et `canJump(...)` : `applyJump`, `lastJumpAt = t`, `jumpRequestedAt = null`, événement `'jump'`.
  3. Une demande périmée passe à `null`.
  4. `CarSim.grounded = grounded[0] || grounded[1]`.

  En tâche 6, le driver d'un robot maintient sa demande : `jumpRequestedAt` y est rafraîchi à chaque pas.
- **`Game`** : le rappel de pas de `runFrame` fait :

  ```
  const jump = i === 0 && this.jumpInput.take();
  stepRace(sim, pressed, jump);
  ```

  À chaque image : `jumpButton.setReady(jumpReady(sim, 0) && state === 'racing')`. Après l'arrivée : `jumpInput.clear()`.
- **`JumpButton`** :
  - position `absolute`, `left: 28px`, `bottom: 40px` ;
  - taille `JUMP_BUTTON_SIZE_PX`, `border-radius: 50%` ;
  - `pointer-events: auto` (`#hud` est à `none`) ;
  - `touch-action: none` ;
  - `data-no-pedal` ;
  - icône de ressort en SVG inline.

  Grisé par la classe `is-waiting` (opacité 0,4), **jamais par l'attribut `disabled`**. Un bouton désactivé n'émet pas de `pointerdown` vers sa cible : le tap risquerait de compter comme du gaz.
- **`JumpInput`** :
  - `pointerdown` sur le bouton, ou `keydown` avec `code === 'Space' && !repeat` (plus `preventDefault`), donne une demande ;
  - garder le doigt ou la touche enfoncés ne relance rien ;
  - le `pointerId` du bouton n'entre jamais dans `Throttle`.
- **Ruling Q6** : le contact débouncé laisse un saut possible jusqu'à 0,1 s après un décollage. La règle de l'addendum est gardée, et l'effet est mesuré au Step 13.

**Étoiles hautes ajoutées (décision P1).** Étape 5 de `placeStars`, après l'étape 4 actuelle. Ses tirages viennent **après** tous les autres.

**Constat de la vérification finale** (calculé sur les graines 0 à 49) : une tranche `plat` mesure 20 à 40 m (`slices.ts:40`).

| Règle d'élan et d'atterrissage | Étoiles hautes par course | Pistes avec au moins une étoile haute |
|---|---|---|
| 20 m d'élan + 25 m d'atterrissage, dans un seul plat | 0 | 0 / 50 |
| Mêmes valeurs, plats voisins fusionnés | 0,36 | 16 / 50 |
| 15 m + 15 m | 0,9 à 1,0 | 31 à 33 / 50 |
| Élan et atterrissage permis hors du plat, hors rampes et dégagements | 1,1 à 1,4 | 34 à 40 / 50 |

La règle retenue est la dernière. **La cible réaliste est donc ≈ 1 étoile haute par course**, pas 2 à 3. Le papa la valide au Step 9.

1. **Segments éligibles (où l'étoile peut se trouver).** On part des tranches `plat` hors plat de départ et hors plat d'arrivée. **Les plats voisins sont fusionnés** en un seul segment. Puis on retire :
   - `STAR_HIGH_RAMP_CLEARANCE` après la fin de toute `rampe-saut` ;
   - `STAR_HIGH_BUMP_CLEARANCE` après la fin de toute `bosses`, `double-bosse` ou `cratère`. C'est le constat C2 : vols calculés de 3,6 m à 14 m/s, ≈ 8 m en turbo. Le cratère arrive en tâche 15.

   Les plats de lancement et de réception des volcans ne sont jamais des tranches `plat` : ils sont donc exclus d'office (ruling Q2).
2. **Position candidate.** x appartient à un segment éligible, à au moins `STAR_HIGH_GAP` de toute étoile basse, et `[x − STAR_HIGH_TAKEOFF_ROOM, x + STAR_HIGH_LANDING_ROOM]` est un **terrain permis**. Ce terrain peut déborder du plat sur une tranche voisine, sauf :
   - une tranche `rampe-saut` ;
   - une tranche `rampe-volcan` ;
   - une zone de dégagement (clearance après une rampe-saut, une bosse, une double-bosse ou un cratère).
   - Par segment : une candidate au centre de l'intervalle admissible.
   - Si le centre est trop près d'une étoile basse : le point admissible le plus proche du centre.
   - Si aucun point n'est admissible : pas de candidate.
3. **Choix** : si le nombre de candidates dépasse `STAR_HIGH_PER_RACE`, on en tire `STAR_HIGH_PER_RACE` sans remise, par le rng de piste (Fisher-Yates partiel). Sinon on les garde toutes. Avec `STAR_HIGH_PER_RACE = 0`, il n'y a aucun tirage.
4. **Étoiles hautes** : `high: true`, `y = sol + STAR_HIGH_Y`. Fusion avec les étoiles basses, tri par x, ids renumérotés 0, 1, 2…

   Les ids des étoiles basses peuvent donc changer. Les tests repèrent les étoiles par `x` et par `high`, pas par `id`.

**Tolérance du nombre par course** (cible réaliste ≈ 1, mesurée, validée par le papa au Step 9) :
- **par course** : 0 ≤ n ≤ `STAR_HIGH_PER_RACE` ;
- **sur les graines 0 à 49** : moyenne et nombre minimal de pistes avec au moins une étoile haute, **seuils fixés au Step 9 à partir de la distribution mesurée et présentés au papa** ;
- **étoiles basses** : x, y et nombre **identiques** à ceux de `STAR_HIGH_PER_RACE: 0`.

Si la moyenne ou le nombre de pistes déçoit le papa, on lui présente la distribution et les leviers : clearances, `TAKEOFF_ROOM`, `LANDING_ROOM`, `STAR_HIGH_GAP`. Rien n'est relâché en silence.

**Hauteur et fenêtre** (ordre de grandeur, relecture adversariale I9, calculé) :
- Le châssis au repos est à ≈ sol + 0,70 m ; à l'apogée d'un saut depuis le plat, à ≈ sol + 3,2 m.
- Les pièces couvrent [y_c − 0,70 ; y_c + 0,35], et le capteur a un rayon de 0,5 m.
- Sur le plat, la fenêtre de décollage vaut W ≈ T_contact(h) + ≈ 3,4 m / v.
- **Elle est très sensible à la hauteur** : 0,55 s pour une étoile à 3,9 m, 0,24 s à 4,0 m, 0 à 4,1 m.

Conséquences :
- **Marge exigée** : la valeur choisie doit tenir au moins 0,3 s aussi à `STAR_HIGH_Y + 0,05 m`.
- **Recalibrage obligatoire** si `JUMP_VY`, la gravité, la suspension ou les roues changent. Le test de garde CI `tests/high-stars-window.test.ts` échoue sous 0,3 s, et un commentaire dans `config.ts` le rappelle.

- [ ] **Step 0 : Décisions du papa consignées** (registre 567ee13) : P1 (b), P2 oui, P3 même hauteur partout. Rien à demander avant de commencer.
- [ ] **Step 1 : Amender l'addendum** `docs/superpowers/specs/2026-10-21-bouton-saut-design.md`, avec des passages marqués « [plan] » :
  - §1 : formule « même hauteur partout », avec la mention que le gain ressenti au milieu d'une rampe-saut n'est que d'≈ 1,5 m ; mémoire `JUMP_BUFFER` de 0,1 s.
  - §2 : étoiles hautes **ajoutées** (≈ 1 par course, nombre validé sur mesure, au plus `STAR_HIGH_PER_RACE`), plats éligibles fusionnés, élan et atterrissage sur terrain permis, clearances, étoiles basses inchangées. Le « environ 1 étoile du curseur sur 3 » et la ligne « Inchangés : nombre d'étoiles » sont réécrits.
  - §4 : tests d'apogée sur pente, tolérance du nombre.

  Commit `docs: addendum bouton saut amendé (décisions du papa : étoiles hautes ajoutées, mémoire 0,1 s, même hauteur partout)`.
- [ ] **Step 2 : Tests rouges du saut.**
  - `tests/jump.test.ts` (CI), voiture seule :
    - **apogée sur le plat** : voiture 2 s au repos, `y0` = y du châssis ; après le saut, `max(y) − y0` ∈ [2,25 ; 2,75].
    - **apogée sur une pente (P3)** : voiture à 14 m/s au milieu de la montée d'une `rampe-saut` (graine choisie dans le test).
      - Au pas du saut, on lit vy0 (vers le haut, > 0) et y0.
      - Attendu : `max(y) − y0 − vy0² / (2 g)` ∈ [2,25 ; 2,75], soit 2,5 m ± 10 % au-dessus du vol sans saut.
      - Contrôle : l'apogée mesuré est **très en dessous** de celui que donnerait « s'ajoute » (vy0 + JUMP_VY).
    - **descente** : voiture sur la descente à 10° d'une `rampe-saut`, à **vitesse lente imposée** (≈ 3 m/s, posée puis plafonnée par `speedCapUntil`) pour qu'elle reste au sol avant le saut (vy0 < 0). Attendu : `max(y) − y0` ∈ [2,25 ; 2,75].
    - **vx gardée** : à 14 m/s, vx avant = vx après `applyJump`, à 1e-9 près.
    - **au sol seulement (I4)** :
      - une demande 0,7 s après le décollage ne déclenche aucun `'jump'` et laisse vy inchangée ;
      - voiture lâchée de 2 m sans saut, demande à chaque pas : aucun saut avant le contact.
    - **mémoire de 0,1 s (P2)**, voiture lâchée de 2 m, `JUMP_BUFFER` 0,1 :
      - une demande **0,05 s avant le contact** donne un saut au premier pas au sol ;
      - une demande **0,15 s avant le contact** ne donne aucun saut.
    - **délai (I4)** : avec `cfg = { ...CONFIG, JUMP_VY: 0.5 }`, le vol dure moins de 0,25 s. Une demande à chaque pas pendant 3 s donne des sauts espacés de 0,5 s ± 1 pas.
    - **`canJump` et `wantsJump`** en table.
    - **après l'arrivée** : la demande est ignorée.
    - **bouton grisé en l'air** : `jumpReady(sim, 0)` est faux du 7e pas après le décollage jusqu'au retour au sol, et pendant le délai.
    - **déterminisme** : même calendrier de demandes, même empreinte à chaque pas.
    - **sans demande** : `stepRace(sim, t)` ≡ `stepRace(sim, t, false)`.
  - `tests/jump-input.test.ts` (jsdom) :
    - `pointerdown` sur le bouton : `take()` vaut vrai, puis faux ; `Throttle.pressed` reste faux.
    - doigt maintenu : un seul `take()` vrai.
    - Espace : une demande ; `repeat: true` : rien ; une autre touche : rien.
    - `pointerdown` ailleurs : gaz, aucune demande.
    - bouton d'au moins 140 px, `data-no-pedal`, en bas à gauche, jamais `disabled` après `setReady(false)`.
  - Commande : `npx vitest run tests/jump.test.ts tests/jump-input.test.ts`. Attendu : **ROUGE**.
- [ ] **Step 3 : Implémenter le saut**, puis **VERT**.
  - Mesurer l'apogée réel (plat à l'arrêt, plat à 14 m/s, pente, descente) et le consigner.
  - Si un apogée sort de ±10 % : corriger `JUMP_VY` par un facteur mesuré, en commentaire.
  - `npm run typecheck`, puis `npm test` (empreinte inchangée).
- [ ] **Step 4 : e2e** (`e2e/jump.spec.ts`, `?seed=1&debug=1`).
  - **Tap seul** : CDP `touchStart` au centre du bouton. On lit `__game.throttlePressed` **pendant** l'appui, puis `touchEnd`. Attendu : `jumps` passe de 0 à 1, `throttlePressed` reste faux.
  - **Gaz + tap** :
    1. `touchStart` [A = (640, 400)] ;
    2. 1 s plus tard, `touchStart` [A, B = centre du bouton] ;
    3. 0,2 s plus tard, `touchMove` [A] seul (CDP relâche B par comparaison ; le helper vérifie que `throttlePressed` reste vrai) ;
    4. 2 s plus tard, `touchEnd`.

    Attendu : `jumps` = 1, et Galahad progresse de plus de 10 m entre la pose de A et la fin.
  - **Espace** : un saut ; un keydown avec `repeat: true` ne donne rien.
  - **Chevauchement du HUD** (constat 7), par `boundingBox()` Playwright : les boîtes de `.hud-fps`, `.hud-steps` et du bouton sont disjointes, et le bouton est entièrement dans la vue 1280 × 800.
  - Capture `e2e/screenshots/bouton-saut.png`.
  - Commande : `npm run e2e`.
- [ ] **Step 5 : Commit** `feat: bouton saut (applyJump même hauteur partout, délai, mémoire 0,1 s, front d'appui, Espace)`.
- [ ] **Step 6 : Harnais.**
  - `tests/helpers/jump-runs.ts` : `jumpRun`, `flatJumpTrajectory`, `windowFor`.
  - `tests/helpers/recorded.ts` : `recordRace`, `sensorHits`.
  - Option `jump` de `simulateRace`.
  - `tests/high-stars-window.test.ts` commence par vérifier `flatJumpTrajectory` : apogée cohérent avec le Step 3, à 1 cm près.
- [ ] **Step 7 : Tests de placement** (ROUGE, puis implémentation, puis VERT). Fichier `tests/high-stars.test.ts`, en CI, statique, graines 0 à 49, pistes de 1 680 m. **Aucun seuil sur le nombre d'étoiles hautes à ce stade** : la moyenne et le nombre de pistes sont seulement imprimés, et leurs assertions arrivent au Step 10, après la calibration.
  - 0 ≤ n ≤ `STAR_HIGH_PER_RACE` par piste ;
  - plats voisins fusionnés : une étoile haute peut se trouver à cheval sur deux tranches `plat` consécutives (fixture) ;
  - aucune étoile haute hors d'une tranche `plat` éligible, ni dans les clearances, ni à moins de `STAR_HIGH_GAP` d'une étoile basse ;
  - `[x − TAKEOFF_ROOM, x + LANDING_ROOM]` est du terrain permis pour chaque étoile haute : ni rampe-saut, ni rampe-volcan, ni dégagement ;
  - aucune étoile haute dans `[xLancement, xLava]` ;
  - y = sol + `STAR_HIGH_Y` pour les hautes, sol + 0,6 pour les basses ;
  - déterminisme ;
  - **avec `STAR_HIGH_PER_RACE: 0`, étoiles égales au code d'avant (x, y, `high: false`)** ;
  - **x et y des étoiles basses identiques entre 0 et la valeur retenue**, nombre d'étoiles basses identique ;
  - `tests/stars.test.ts` filtré (`!s.high`) reste vert sans autre changement.

  Commande : `npx vitest run tests/high-stars.test.ts tests/stars.test.ts`.
- [ ] **Step 8 : Calibration mesurée de la hauteur** (constats I8 et 8). Elle se fait en mesure : seule la fin du balayage est assertée. Chaque course est enregistrée **une fois**, et toutes les hauteurs et clearances candidates sont évaluées **hors ligne** par `sensorHits` : les capteurs n'agissent pas sur la physique, et une marge de 5 cm couvre l'écart avec la géométrie exacte de Matter.

  | Fichier | Contenu | Budget |
  |---|---|---|
  | `tests/slow/calibration-saut-sol.test.ts` | **(a) Garde au sol.** Galahad seul doigt posé, graines 0 à 9, une fois à `V_MAX`, une fois avec un turbo forcé 20 m avant chaque candidate (`turboBefore`). Pour chaque hauteur : distance minimale pièces–capteur, et prises. | < 10 min |
  | `tests/slow/calibration-saut-fenetres.test.ts` | **(b) Fenêtre.** Une trajectoire de saut sur le plat par vitesse (`flatJumpTrajectory` à 11,2 et 14 m/s ; 21 m/s pour information), puis fenêtre géométrique prédite pour chaque candidate des graines 0 à 9, puis **dichotomie des deux bords** en simulation réelle (`windowFor`, monde rogné `croppedWorld` de `tests/helpers/phases.ts`, ≈ 14 runs par étoile, par vitesse et par hauteur). On note la fenêtre (s), son centre en « temps avant l'étoile » (futur `JUMP_STAR_LEAD` de la tâche 6), et les respawns dans les 3 s après l'atterrissage. Hauteurs : 3,60 à 4,05 m au pas de 5 cm. | < 25 min |
  | `tests/slow/calibration-saut-vols-0-11.test.ts`, `-12-23.test.ts` | **(c) Vols.** Une course enregistrée à 5 voitures, doigt posé, sans saut, par graine. Prises hors ligne pour chaque jeu candidat : rampe-saut {50, 60, 70, 80}, bosses {8, 12, 16}, `STAR_HIGH_TAKEOFF_ROOM` {10, 15, 20}, `STAR_HIGH_LANDING_ROOM` {10, 15, 20, 25}. Le placement est statique : il est recalculé pour chaque jeu, sans nouvelle simulation. Pour chaque jeu : nombre d'étoiles hautes par course (moyenne, minimum, maximum) et nombre de pistes sur 50 avec au moins une étoile haute. | < 25 min chacun |

  Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/calibration-saut-sol.test.ts tests/slow/calibration-saut-fenetres.test.ts tests/slow/calibration-saut-vols-0-11.test.ts tests/slow/calibration-saut-vols-12-23.test.ts`.
#### Fin de la 5e (v1.4, décisions P6 et P7 du 2026-10-22, registre e02dcae)

Steps 1 à 8 faits (registre : commits 96556a2 à 4a414c6). Les Steps 9 à 14 de la v1.3 sont remplacés par ceux-ci. Spécification : saut §6.6 (plats étoile) et §6.9 (constantes, `ANCIENNES_PISTES`).

**Files (fin de la 5e) :**
- Create: `tests/helpers/anciennes-pistes.ts`, `tests/anciennes-pistes.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan.test.ts`
- Modify (code) :
  - `src/config.ts` : `STAR_HIGH_Y` 3,90 ; jeu 50 / 12 / 20 / 25 ; `STAR_FLATS_PER_RACE` 3 ; `STAR_FLAT_SPACING` 400 ; `STAR_FLAT_LENGTH` dérivée (57) ; `STAR_STEP_MIN/MAX` selon la mesure du Step 11 ; commentaires « PROVISOIRE » retirés.
  - `src/track/types.ts` : `'plat-étoile'` dans `SliceType`.
  - `src/track/slices.ts` : `platEtoile(cfg)` (sans `rng`).
  - `src/track/generate.ts` : ancres, insertion, refus des volcans sur la dernière tranche **tirée** ; `onlyPlat` sans plat étoile.
  - `src/track/stars.ts` : une étoile haute par plat étoile, posée d'abord ; plats étoile hors des zones du curseur ; candidates ordinaires à ≥ 45 m d'une étoile de plat étoile ; terrain permis : un plat étoile en est.
  - `src/render/track.ts` : rien, sauf si un `switch` sur le type de tranche l'exige (le sol est dessiné depuis les points).
- Modify (tests) : voir « Migration des tests existants (v1.4) », lignes marquées **5e**.
- Test: `tests/anciennes-pistes.test.ts`, `tests/high-stars.test.ts`, `tests/high-stars-window.test.ts`, `tests/generate.test.ts`, `tests/stars.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan.test.ts`, `e2e/jump.spec.ts` (capture)

- [x] **Step 9 : Décisions du papa enregistrées** (e02dcae).
  - Tableau du Step 8 présenté (4a414c6) : à 3,90 m, fenêtre min 0,57 / 0,53 s à 11,2 / 14 m/s, 0,42 s à +5 cm ; garde au sol de Galahad ≥ 2,1 m.
  - Décisions : P6 `STAR_HIGH_Y` = 3,90 m ; P7 au moins 3 étoiles hautes par course sur des plats étoile ; P8 fosses (tâche 5g) ; P9 promesse changée ; P10 pistes changées, empreinte recapturée par ruling.
  - Jeu de dégagements retenu (saut §6.6, ruling R-F7) : **50 / 12 / 20 / 25**. C'est le plus permissif des 4 jeux à 0 prise sans saut à 3,90 m (5 voitures, graines 0 à 23).
- [ ] **Step 10 : Spécification relue, pistes d'avant figées.**
  - Relectures de l'addendum §6 et de ce plan v1.4 : standard, adversariale, `code-review`. Réponses du papa aux questions Q-F1 à Q-F5 consignées au registre. Commit `docs: …` par tour.
  - **Avant tout changement de `src/`** : `tests/helpers/anciennes-pistes.ts` exporte `ANCIENNES_PISTES` et `withAnciennesPistes(cfg)`. Les clés `STAR_FLATS_PER_RACE` et `FOSSE_PERIOD` n'existent pas encore dans `Config` : l'helper les ajoute dès qu'elles existent, sans changer de valeur.
  - `tests/anciennes-pistes.test.ts` : sha1 des pistes générées avec `withAnciennesPistes(CONFIG)` (Float64 de `points`, puis tranches, volcans, étoiles ; graines 0 à 49 à 1 680 m, graines 0 à 9 à 300 et 6 000 m). Valeurs **mesurées sur e02dcae** et collées, avec le hash du commit en commentaire.
  - `tests/empreinte.test.ts`, `PLAN_A_TRACE` (`tests/simulate.test.ts`) et `PRE_5E_STARS` (`tests/high-stars.test.ts`) passent à `withAnciennesPistes(CONFIG)`. Leurs valeurs figées ne changent pas.
  - Commande : `npx vitest run tests/anciennes-pistes.test.ts tests/empreinte.test.ts tests/simulate.test.ts tests/high-stars.test.ts`, **vert**.
  - Commit `test: pistes d'avant figées derrière un interrupteur (ANCIENNES_PISTES)`.
- [ ] **Step 11 : Plats étoile dans le générateur** (ROUGE, puis implémentation, puis VERT).
  - Tests rouges :
    - `tests/generate.test.ts` :
      - N = 3 plats étoile à 1 680 m (graines 0 à 49) et à 6 000 m (graines 0 à 19), 1 à 600 m, 0 à 300 m ;
      - longueur `STAR_FLAT_LENGTH` à une maille près ;
      - jamais juste après une rampe-saut ;
      - le k-ième commence à la première frontière ≥ a_k permise ;
      - aucun volcan juste après une rampe-saut ou un autre volcan, en ignorant les plats étoile ;
      - la suite des tranches tirées (plats étoile retirés) a, avec celle de `withAnciennesPistes`, un préfixe commun d'au moins 20 tranches sur chaque graine 0 à 49 (CALCULÉ : 25 au moins) ;
      - `onlyPlat` : ni plat étoile ni volcan.
    - `tests/high-stars.test.ts` :
      - **exactement 3 étoiles hautes par piste de 1 680 m, graines 0 à 49** (seuil validé par le papa, P7), chacune à `xStart` de son plat étoile + 32 m, y = sol + 3,90 ;
      - `STAR_HIGH_PER_RACE` = 5 (fixture) : les 3 des plats étoile toujours présentes, les autres à ≥ 45 m d'elles, sur des plats ordinaires selon la règle de la 5e ;
      - aucune étoile basse sur un plat étoile ;
      - étoiles basses identiques entre `STAR_HIGH_PER_RACE` 0 et 3 ;
      - déterminisme ;
      - les tests de placement du Step 7 restent pour les plats ordinaires (fixture à plafond 5).
    - `tests/stars.test.ts` : 6 à 14 étoiles basses (graines 0 à 19), filtrées `!s.high`.
  - Implémentation, puis **mesure** de la distribution des étoiles basses (graines 0 à 49).
    - Si la moyenne est hors de [8, 12] ou le minimum sous 6, le pas passe à [55, 90] (CALCULÉ : 8,74 de moyenne, de 6 à 13), puis on remesure.
    - Ruling au registre, cible inchangée (addendum plan B §1.5).
  - Commande : `npx vitest run tests/generate.test.ts tests/high-stars.test.ts tests/stars.test.ts tests/anciennes-pistes.test.ts`. Puis `npm run typecheck` et `npm test`. L'empreinte `CONFIG` n'est pas encore figée : seule `ANCIENNES_PISTES` fait foi.
- [ ] **Step 12 : Acceptation.**
  - `tests/high-stars-window.test.ts` (CI) : étoile du 1er plat étoile de la graine 1, fenêtre ≥ **0,4 s** à 11,2 et à 14 m/s, ≥ 0,3 s à 3,95 m (MESURÉ sur un plat : 0,57 / 0,60 s, et 0,47 / 0,48 s à +5 cm).
  - `tests/slow/high-stars-sim.test.ts` (< 25 min) :
    - **(i)** 5 voitures doigt posé sans saut, turbo compris, graines 0 à 23 : 0 étoile haute prise par Galahad. Un copain ne prend une étoile haute sans saut que dans les 2 s après un contact entre voitures (« catapulte », relevée par l'observateur `carPairsTouching`, comme les chutes « par choc ») : les prises sont imprimées, et une prise sans contact échoue (saut §4).
    - **(ii)** Galahad seul, turbo forcé tous les 5 m de [x★ − 80, x★ − 20], graines 0 à 9 : 0 prise.
    - **(iii)** Pour chaque étoile de plat étoile des graines 0 à 9 : fenêtre ≥ 0,4 s à 11,2 et 14 m/s, ≥ 0,3 s à +5 cm, sans respawn (`windowFor`). Le centre est imprimé (futur `JUMP_STAR_LEAD`, mesuré ≈ 1,0 s).
    - **(iv)** Pour chaque plat étoile précédé de bosses ou d'une double-bosse (graines 0 à 49) : élan à 21 m/s sur la tranche précédente, 0 prise sans saut.
  - `tests/slow/saut-volcan.test.ts` (< 15 min), inchangé depuis la v1.3, sur les **tremplins** :
    - doigt posé sans saut : 0 chute ;
    - un saut mal placé peut faire tomber, au moins une position sur [xElanStart − 10, xLip].
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/high-stars-sim.test.ts tests/slow/saut-volcan.test.ts`.
- [ ] **Step 13 : Non-régression, empreinte recapturée, commit.**
  - Avec `ANCIENNES_PISTES` : empreinte, `PLAN_A_TRACE`, `PRE_5E_STARS` et sha1 des pistes **inchangés**.
  - Avec `CONFIG` : les 3 nouveaux hash de l'empreinte (graines 0, 1, 2, 30 s) sont mesurés et collés dans `tests/empreinte.test.ts` (second tableau `FROZEN_CONFIG`). **Ruling R-F10** au registre : anciens et nouveaux hash, commit, raison (P10), et la preuve que l'empreinte `ANCIENNES_PISTES` est restée identique dans le même commit.
  - Migration des tests marqués **5e** dans « Migration des tests existants (v1.4) ».
  - `npm run typecheck`, `npm test` (chronométré, < 6 min), `npm run test:slow`, `npm run e2e`, avec la capture `e2e/screenshots/plat-etoile.png`.
  - Rattrapage « après 5e », en deux mesures :
    - sur `ANCIENNES_PISTES`, appariée aux mesures de la 5d (mêmes pistes, sans plats étoile) ;
    - sur `CONFIG` : nouvelle référence, non appariée.
  - Commit `feat: plats étoile, 3 étoiles hautes par course à 3,90 m, pistes d'avant derrière un interrupteur`.
- [ ] **Step 14 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec les sondes de la v1.3 :
    - saut à chaque x d'un volcan ; saut depuis un toit ; saut dans les 0,1 s après un sommet (Q6) ; mémoire de 0,1 s combinée au délai de 0,5 s ;
    - saut en turbo ; saut juste après un respawn ; sauts sur les bosses ; apogée sur toutes les pentes du générateur (P3) ;
    - étoile haute prise en vol de rampe-saut turbo ; doigt qui glisse du bouton vers l'écran ; Espace maintenu ; demande faite pendant une image à 0 pas.
  - Plus ces sondes :
    - plat étoile après une double-bosse ou des bosses prises à 21 m/s ;
    - pistes de 300, 600 et 6 000 m ;
    - mutant « plat étoile après une rampe-saut » ;
    - mutant « refus des volcans sur la tranche précédente au lieu de la dernière tirée » ;
    - `ANCIENNES_PISTES` au bit près ;
    - copain catapulté sur un plat étoile.
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 15 : Validation du papa et de Galahad.**
  - Questions : Galahad comprend-il le bouton seul ? Un saut raté se voit-il, et coûte-t-il quelque chose (saut §0) ? Trouve-t-il les 3 étoiles hautes ?
  - Puis commit `docs: tâche 5e validée, passation et registre`, `git status -sb`, push.

---

### Task 5g (ajoutée, v1.4) : Fosses de lave (volcans sans tremplin)

**Décisions du papa :** P8 (fosses, ≈ 1 volcan sur 2), P9 (promesse changée), P10 (pistes changées, empreinte recapturée par ruling). Réponses à Q-F1 (largeur), Q-F2 (2e chute) et Q-F5 (aide) consignées au Step 0.

**Spécification :** saut §6.1 à §6.5, §6.7 et §6.9. Les chiffres MESURÉS de la spec viennent de sondes jetables ; cette tâche les refait en tests.

**Files:**
- Create:
  - `tests/helpers/fosses.ts` :
    - `fossePiste` : piste plate à une fosse, avec en option des tranches avant ;
    - `fosseRun` : Galahad seul, lancé à v ou arrêté, doigt posé, turbo forcé à un x, saut au pas k ; il renvoie la lave, le passage, le x du saut et de l'atterrissage, la plus petite garde des roues au-dessus du capteur ;
    - `fosseWindow` : dichotomie des deux bords, contiguïté vérifiée à ± 3 pas de chaque bord ;
    - `sauteurParfait(track, cfg)` : option `jump` de `simulateRace`, par `fosseJumpWanted`.
  - `tests/fosses.test.ts` (CI) ; `tests/slow/fosses-a.test.ts`, `tests/slow/fosses-fenetres.test.ts`, `tests/slow/race-sans-saut-0-11.test.ts`, `tests/slow/race-sans-saut-12-23.test.ts` ; `e2e/fosse.spec.ts`.
- Modify (code) :
  - `src/config.ts` : `FOSSE_PERIOD` 2, `FOSSE_WIDTH` (Q-F1, 8 recommandé), `FOSSE_GUARD` 20, `FOSSE_STAR_AFTER` 25, `FOSSE_JUMP_LEAD` 0,65 ; si Q-F2 = B, `FOSSE_RESPAWN_AFTER` 5 et `FOSSE_GHOST_AFTER` 40 ; `STAR_STEP_MIN/MAX` d'après la mesure du Step 7.
  - `src/track/types.ts` : `'fosse'` ; `Volcano = Tremplin | Fosse` (champ `kind`, `xBord`).
  - `src/track/slices.ts` : `fosseGeometry`, `fosse` ; `SliceProfile.volcano` devient lui aussi une union.
  - `src/track/generate.ts` : phase tirée dans un `mulberry32` dédié, alternance, `kind` posé à l'ajout.
  - `src/track/query.ts` :
    - `tremplins`, `nextFosse` ;
    - `inElanZone` sur les tremplins seuls ;
    - `inGhostZone` étendue jusqu'à bord aval + `FOSSE_GHOST_AFTER` si Q-F2 = B.
  - `src/track/stars.ts` : zones admissibles (réception seule pour une fosse), étoile de réception, plancher, `highStarTerrain` sans les tranches `'fosse'`.
  - `src/cars/respawn.ts` : cible de 2e chute selon le type. A : inchangée. B : bord aval + `FOSSE_RESPAWN_AFTER`, et le respawn groupé de cette cible avance.
  - `src/cars/jump.ts` : `fosseJumpWanted` (pur).
  - `src/sim/simulate.ts` :
    - copains provisoires : `updateJump(sim, car, car.driver ? fosseJumpWanted(…) : galahadJump, …)`, sans erreur, remplacé en tâche 6 ;
    - `inElanZone` restreint aux tremplins.
  - `src/physics/world.ts` : commentaire de `buildLava` (fosse : `rimY` 0, capteur à 0,3 m au-dessus du sol), code inchangé.
  - `src/render/track.ts` :
    - fosse : lave à ras bord, langues de feu jusqu'au haut du capteur, halo pulsé ;
    - panneau à ressort à `xLancement` des fosses ;
    - cône sombre et `xLip` réservés aux tremplins.
  - `src/render/effects.ts` : rien d'attendu (`xLava`, `rimY`), vérifié par test.
- Modify (tests) : « Migration des tests existants (v1.4) », lignes marquées **5g**.
- Test: `tests/fosses.test.ts`, `tests/generate.test.ts`, `tests/stars.test.ts`, `tests/high-stars.test.ts`, `tests/query.test.ts`, `tests/safepoint.test.ts`, `tests/respawn.test.ts`, `tests/world.test.ts`, `tests/render-smoke.test.ts`, `tests/effects.test.ts`, `tests/race-smoke.test.ts`, `tests/slow/fosses-a.test.ts`, `tests/slow/fosses-fenetres.test.ts`, `tests/slow/race-invariants-*.test.ts`, `tests/slow/race-sans-saut-*.test.ts`, `tests/slow/volcans-slow.test.ts`, `e2e/fosse.spec.ts`

**Interfaces :**
```ts
// src/track/types.ts
export type SliceType = 'plat' | 'plat-étoile' | 'bosses' | 'rampe-saut' | 'double-bosse' | 'rampe-volcan' | 'fosse' | 'cratère';
interface VolcanoBase { xLancement: number; xLava: number; lavaWidth: number; rimY: number; xReception: number; xEnd: number }
export interface Tremplin extends VolcanoBase { kind: 'tremplin'; xElanStart: number; xRampStart: number; xLip: number; lipY: number }
/** Fosse (saut §6.2) : garde, approche [xLancement, xBord[, lave [xBord, xReception] (xReception = bord aval), réception ; rimY = 0. */
export interface Fosse extends VolcanoBase { kind: 'fosse'; xBord: number }
export type Volcano = Tremplin | Fosse;
// src/track/slices.ts
export interface FosseGeometry { guard: number; approach: number; width: number; reception: number; length: number }
/** length = longueur de rampeVolcan(cfg) ; bords sur la maille ; lance si reception < 60 m. */
export function fosseGeometry(cfg: Config): FosseGeometry;
export function fosse(cfg: Config): SliceProfile;   // hauteur 0 sauf ]xBord, xBord + W[ à −CRATER_DEPTH ; deux parois exemptées
// src/track/query.ts
export function tremplins(track: Track): Tremplin[];
export function nextFosse(track: Track, x: number): Fosse | undefined;   // première fosse dont xBord > x
// src/cars/jump.ts (pur)
/** x dans [xLancement, xBord[ de la prochaine fosse et (xBord − x) / max(v, 1) ≤ FOSSE_JUMP_LEAD. */
export function fosseJumpWanted(track: Track, x: number, v: number, cfg: Config): boolean;
// tests/helpers/fosses.ts
export function fosseRun(world: World, opts: { x0: number; v: number | 'arrêt'; jumpAtStep: number | null; turboAtX?: number; cfg?: Config }):
  { lava: boolean; passed: boolean; jumpX: number | null; landX: number | null; minWheelGap: number };
export function fosseWindow(world: World, f: Fosse, v: number | 'arrêt', cfg?: Config):
  { seconds: number; sMin: number; sMax: number; contiguous: boolean; landMax: number; runs: number };
```

**Règles de mise en œuvre :**
- **Générateur** : une `'rampe-volcan'` tirée et acceptée devient une fosse si (rang du volcan + phase) mod `FOSSE_PERIOD` = `FOSSE_PERIOD` − 1. Le rang compte tous les volcans, dans l'ordre de la piste.
  - La phase est tirée une fois par piste dans `mulberry32((seed ^ 0x6a09e667) >>> 0)`. Elle n'est tirée que si `FOSSE_PERIOD` > 0 : avec 0, aucun appel.
  - Le `rng` principal ne voit aucun tirage de plus ; `fosse(cfg).length === rampeVolcan(cfg).length` est assertée.
  - Refus (saut §6.3) : jugés sur la dernière tranche tirée ; un volcan ne suit jamais une rampe-saut ni un autre volcan, quel que soit son type.
- **Capteur** : `buildLava` inchangé ; une fosse porte `rimY` = 0.
- **Copains provisoires** : demande de saut à chaque pas tant que `fosseJumpWanted` est vrai. `wantsJump` et `canJump` filtrent, comme pour Galahad. Ce saut n'a pas d'erreur. La tâche 6 le remplace par le driver.
- **Galahad dans `Game`** : rien ne change, c'est l'enfant qui saute.

- [ ] **Step 0 : Décisions du papa consignées** : Q-F1, Q-F2 et Q-F5 (registre). Si Q-F1 ≠ 8 m, les seuils « attendus » ci-dessous sont remplacés par les mesures du Step 6, sans relâcher le plancher de 0,4 s.
- [ ] **Step 1 : Tests rouges statiques.**
  - `tests/fosses.test.ts`, partie statique :
    - longueur égale à celle de la rampe-volcan ;
    - garde de 20 m, approche `LANCEMENT_LENGTH`, lave de W m ;
    - réception ≥ 60 m ;
    - bords sur la maille ;
    - hauteur 0 sur [début, xBord] et sur [xReception, xEnd] (aucune lèvre) ;
    - −`CRATER_DEPTH` dans la fosse ;
    - deux parois exemptées.
  - `tests/generate.test.ts` (graines 0 à 49, 1 680 m) :
    - volcans consécutifs de types différents ;
    - les deux phases présentes ;
    - au moins une fosse et un tremplin dès 2 volcans ;
    - **2 à 7 volcans (graines 0 à 19)**, remplace « 3 à 7 » ;
    - aucun volcan après une rampe-saut ou un volcan (dernière tranche tirée) ;
    - [15 %, 90 %] ;
    - même suite de tranches tirées et mêmes x qu'avec `FOSSE_PERIOD` 0, à l'échange tremplin / fosse près ;
    - `FOSSE_PERIOD` 0 avec `ANCIENNES_PISTES` : sha1 des pistes inchangé.
  - `tests/stars.test.ts`, `tests/high-stars.test.ts` :
    - aucune étoile basse dans [début de la tranche fosse, xReception) ;
    - étoile de réception à xReception + 25, tirée 1 fosse sur 2 ;
    - plancher dans l'ordre de la piste (élan ou réception) ;
    - aucune étoile haute dans une tranche fosse ;
    - 6 à 14 étoiles basses (graines 0 à 19).
  - `tests/query.test.ts`, `tests/safepoint.test.ts`, `tests/respawn.test.ts` (purs) :
    - `forbiddenZone` d'une fosse ;
    - `volcanoAhead` trouve une fosse ;
    - 2e chute → cible A ou B, selon Q-F2 ;
    - `inElanZone` faux sur toute la fosse ;
    - `inGhostZone` d'une fosse ;
    - `nextFosse`.
  - Commande : `npx vitest run tests/fosses.test.ts tests/generate.test.ts tests/stars.test.ts tests/high-stars.test.ts tests/query.test.ts tests/safepoint.test.ts tests/respawn.test.ts`. Attendu : **ROUGE**.
- [ ] **Step 2 : Implémenter la piste** (types, slices, generate, stars, query, respawn) → **VERT** statique.
  - `npm run typecheck` liste chaque usage des champs du tremplin : on les restreint aux tremplins, par `tremplins(track)` ou par un test sur `kind`. Ni `as`, ni `!` sans commentaire.
- [ ] **Step 3 : Tests rouges physiques**, `tests/fosses.test.ts` (CI, une fosse sur piste plate, monde rogné) :
  - **(a)** roulé sans saut à 3, 11,2, 14, 21 et 30 m/s : lave, châssis repris avant `xBord` ;
  - **(a')** double-bosse puis fosse, turbo à 21 m/s à l'entrée de la double-bosse : lave. Le mutant `FOSSE_GUARD` 0 est mesuré et consigné ;
  - **(b)** `fosseWindow` à 11,2 et à 14 m/s : ≥ 0,4 s, d'un seul tenant, 0 respawn dans les 3 s après l'atterrissage, valeurs imprimées (attendu 1,02 / 1,20 s pour 8 m) ;
  - **(c)** départ arrêté en `xLancement + SAFE_LANCEMENT_MARGIN − 0,01` : ≥ 0,4 s (attendu 0,87 s) ;
  - **(d)** à 21 m/s, le saut qui passe et atterrit le plus loin le fait avant `xEnd − 10` (attendu ≤ 31,6 m après le bord aval) ;
  - `fosseJumpWanted` à 11,2, 14 et 21 m/s, et au départ arrêté : passe ;
  - 2e chute de suite : cible A ou B. Une chute puis un retournement remettent la série à zéro ;
  - 5 voitures dans la fosse au même pas, point sûr `xLancement + 1` : 5 respawns en file, sans chevauchement, aucun `'speed'` ;
  - fantômes :
    - une voiture arrêtée au point sûr est traversée par une voiture lancée, sans paire active ;
    - (B) une voiture posée à bord aval + 5 est traversée par une voiture qui atterrit ;
  - Galahad seul, doigt posé sans saut, sur la première graine de 0 à 9 qui a ≥ 2 fosses : exactement 2 chutes par fosse, 0 au tremplin, arrivée < 240 s. Avec `sauteurParfait` : 0 chute ;
  - 5 voitures, graine 1 : copains provisoires 0 chute, Galahad `sauteurParfait` 0 chute.
  - Commande : `npx vitest run tests/fosses.test.ts`. Attendu : **ROUGE**.
- [ ] **Step 4 : Implémenter** `fosseJumpWanted`, le saut des copains provisoires et la cible B si elle est choisie → **VERT**. Puis `npm test` : l'empreinte `ANCIENNES_PISTES` ne bouge pas.
- [ ] **Step 5 : Rendu et e2e.**
  - Dessin : lave à ras bord, langues de feu jusqu'au capteur, halo pulsé au temps de simulation, panneau à ressort.
  - `tests/render-smoke.test.ts` :
    - une fosse et son panneau se dessinent sans erreur ;
    - aucun plot au-dessus de la lave ;
    - le cône sombre reste réservé aux tremplins.
  - `e2e/fosse.spec.ts` (`?seed=<graine figée dans le test, dont la 1re fosse est la plus proche du départ>&debug=1`) :
    - doigt tenu jusqu'à la fosse, capture `e2e/screenshots/fosse.png` (fosse, halo et panneau à l'écran) ;
    - puis, sans saut, deux `'respawn'` de raison lave, et la course continue ;
    - pas d'assertion sur l'instant exact d'un saut à la main (Playwright n'est pas assez régulier) : le saut juste est couvert par (b) et (c).
  - Commande : `npm run e2e`.
- [ ] **Step 6 : Suite lente.**

  | Fichier | Contenu | Budget |
  |---|---|---|
  | `tests/slow/fosses-a.test.ts` | Chaque fosse des graines 0 à 19, Galahad lancé à V_MAX 100 m avant la tranche précédente, turbo pris tous les 2 m de 80 m avant cette tranche jusqu'à `xLancement`, sans saut : **100 % de lave** (sonde de la spec : 0 survol sur 1 044 runs avec la garde). **Témoin vivant** : sur les pistes synthétiques de `tests/helpers/fosses.ts` (bosses, double-bosse, bosses + double-bosse avant la fosse : profils de la sonde de la spec), le même balayage avec `FOSSE_GUARD` 0 et W 6 retrouve au moins un survol (sonde : 2 sur 1 044). Sinon, le balayage ne prouve rien. | < 20 min |
  | `tests/slow/fosses-fenetres.test.ts` | Chaque fosse des graines 0 à 9 : (b) à 11,2 et 14 m/s, (c) départ arrêté au pire point sûr, (d) turbo. Minimum, médiane et centre des fenêtres ; `FOSSE_JUMP_LEAD` est dans la fenêtre partout. | < 20 min |
  | `tests/slow/race-invariants-*.test.ts` (migrés) | 5 voitures, graines 0 à 23, Galahad doigt posé **avec** `sauteurParfait` : `lavaByCar.galahad === 0`, aucune chute propre, chutes classées par type de volcan. | inchangé |
  | `tests/slow/race-sans-saut-0-11.test.ts`, `-12-23.test.ts` | 5 voitures, Galahad doigt posé **sans** saut : lave de Galahad = 2 × nombre de fosses, 0 au tremplin, arrivée < 240 s ; copains provisoires 0 chute. Temps perdu par fosse imprimé (attendu ≈ 1 s en A, ≈ 4,7 s en B). | < 15 min chacun |
  | `tests/slow/volcans-slow.test.ts` (complété) | Scénario (ii) : double-bosse puis tremplin, turbo à 21 m/s, doigt posé : 0 chute (sonde de la spec : 189 / 189). Scénario (iii) : rampe-saut, plat, puis fosse, turbo : lave sans saut, passage avec `sauteurParfait`. | + 5 min |

  Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/fosses-a.test.ts tests/slow/fosses-fenetres.test.ts tests/slow/race-sans-saut-0-11.test.ts tests/slow/race-sans-saut-12-23.test.ts`, puis `npm run test:slow`.
- [ ] **Step 7 : Étoiles basses.** Mesure sur les graines 0 à 49. Passer à [50, 85] si la moyenne sort de [8, 12] ou si le minimum passe sous 6 (CALCULÉ : 9,10, de 6 à 13). Ruling au registre.
- [ ] **Step 8 : Non-régression et empreinte.**
  - `ANCIENNES_PISTES` : empreinte, `PLAN_A_TRACE` et sha1 des pistes **inchangés**.
  - `CONFIG` : nouveaux hash dans `FROZEN_CONFIG`, ruling R-F10 (2e recapture, même contenu qu'en 5e).
  - Migration des tests marqués **5g**.
  - `npm run typecheck`, `npm test` (chronométré, < 6 min), `npm run test:slow`, `npm run e2e`.
  - Rattrapage « après 5g » :
    - sur `ANCIENNES_PISTES` : identique à « après 5e » course par course, sinon c'est un défaut ;
    - sur `CONFIG` : nouvelle référence, Galahad doigt posé avec et sans `sauteurParfait`.
- [ ] **Step 9 : Commit** `feat: fosses de lave (1 volcan sur 2), à franchir avec le bouton saut`.
- [ ] **Step 10 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec ces sondes :
    - turbo pris sur des bosses ou une double-bosse avant une fosse, et rebond d'atterrissage au bord ;
    - saut trop tôt qui retombe avant la fosse, puis second saut après le délai ;
    - saut au dernier pas permis, roue avant au coin du capteur ;
    - départ arrêté au pire point sûr, avec 4 autres voitures sur le même point sûr ;
    - 2e chute avec la cible occupée (A et B) ;
    - copain retourné sur l'approche ;
    - fantômes à la sortie de la zone ;
    - `ANCIENNES_PISTES` au bit près ;
    - pistes de 300, 600 et 6 000 m ;
    - mutants : rebord surélevé de 5 cm, capteur à 0 m au lieu de 0,3 m, alternance remplacée par un tirage sur le `rng` principal ;
    - double-bosse puis tremplin à 21 m/s (promesse des tremplins).
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 11 : Validation du papa** (tablette, puis Galahad).
  - Montrer `fosse.png` et le tableau mesuré : fenêtres, chutes, temps perdu par fosse ratée.
  - Questions : Galahad voit-il venir la fosse ? Saute-t-il seul ? La largeur est-elle juste ? Une fosse ratée coûte-t-elle assez ?
  - Puis commit `docs: tâche 5g validée, passation et registre`, `git status -sb`, push.

---

### Task 6 : Conduite des robots (remplace la tâche 6 du plan v2.1)

**[fosses] Ajustements v1.4 (saut §6.8) : sauts des copains aux fosses.** Ils complètent le texte ci-dessous, qui reste valable pour les tremplins et les étoiles hautes.
- **Décision du papa attendue** : Q-F3 (`FOSSE_SKILL_FACTOR`, 2,5 recommandé ; 1 = traits tels quels). Consignée au Step 0.
- **Fichiers en plus** :
  - `src/config.ts` : `FOSSE_SKILL_FACTOR` ; `JUMP_STAR_LEAD` = 1,0 s (centre mesuré en 5e, 0,98 à 1,02 s sur un plat étoile).
  - `src/sim/simulate.ts` : le saut provisoire des copains aux fosses (5g) est **retiré** ; c'est le driver qui saute.
  - `src/track/query.ts` : `inNoJumpZone` = [`xLancement`, `xReception`] d'un **tremplin** seulement.
- **`DriverContext`** gagne `nextFosse: { xBord: number; attempt: 1 | 2 } | null` : prochaine fosse à moins de `JUMP_LOOKAHEAD`, avec le numéro de la tentative. Il vaut 2 après une chute dans cette fosse, et revient à 1 à la fosse suivante.
- **Règle 3, zone volcan** : pour une **fosse**, `throttle: true`, jamais de politesse ni de lever de pied, et le saut de la fosse : le copain saute dès que (`xBord − x`) / max(v, 1) ≤ `FOSSE_JUMP_LEAD` + e. L'erreur e vient de N(0, `FOSSE_SKILL_FACTOR` × `jumpSkill`), pré-tirée à la création du driver, 2 par fosse dans l'ordre de la piste (Box-Muller sur la graine du driver), après les tirages des étoiles hautes. Pas de tirage `jumpTry` : on saute toujours. Un seul saut par tentative entre `xLancement` et le bord aval + 5 m.
- **Tests en plus** (`tests/driver.test.ts`) :
  - `jumpSkill` 0 : saut au premier pas où (`xBord − x`) / v ≤ `FOSSE_JUMP_LEAD` ;
  - 2e tentative : 2e erreur ;
  - jamais deux sauts dans la même approche ;
  - jamais de saut d'étoile dans une tranche fosse ;
  - `inNoJumpZone` vrai sur les tremplins et faux sur les fosses ;
  - déterminisme.
- **Mesures en plus** (Step 3) :
  - par bras « Pablo » / « Timothé », chutes aux fosses par tentative, comparées au tableau CALCULÉ de saut §6.8 ;
  - tentatives ≈ 1,8 fosse × 4 copains × 48 graines ≈ 350 par bras, au-dessus du seuil de 40 ;
  - respawns : au plus 3 par robot hors fosses, au plus 2 par fosse ;
  - les invariants à 5 voitures classent une chute de copain dans une fosse « fosse » (attendue), pas « propre ». Une chute propre à un tremplin reste un échec.
- **Galahad** court avec `sauteurParfait` dans les invariants, et sans saut dans `race-sans-saut-*` (5g).
- **Validation du papa** (Step 9) : en plus, « les copains tombent-ils parfois dans une fosse, de façon crédible ? ».

**Files:**
- Create: `src/ai/driver.ts` (types `Driver` et `DriverContext`, et `makeRobotDriver`)
- Modify :
  - `src/cars/pilots.ts` : `jumpTry` et `jumpSkill` ; `GALAHAD` à 0 et 0.
  - `src/sim/simulate.ts` :
    - importe `Driver` et `DriverContext` de `ai/driver.ts` et ne les définit plus ;
    - `holdAfterStartDelay` remplacé par `makeRobotDriver` ;
    - garde « jamais de saut de robot dans `inNoJumpZone` » ;
    - commentaire du champ `ghost` mis à jour (zone jusqu'à la roue arrière, héritage de la 5b).
  - `src/track/query.ts` : `inNoJumpZone`.
  - `src/config.ts` :

    | Constante | Valeur |
    |---|---|
    | `POLITE_SPEED` | 2 |
    | `POLITE_GAP` | 4 |
    | `POLITE_MAX_WAIT` | 3 (ruling Q8) |
    | `LIFT_LOOKAHEAD` | 8 |
    | `LIFT_SECONDS` | 0,4 |
    | `JUMP_LOOKAHEAD` | 40 |
    | `JUMP_STAR_LEAD` | mesuré en 5e, Step 8 ; [fosses] 1,0 s (centre sur un plat étoile) |
    | `FOSSE_SKILL_FACTOR` | [fosses] Q-F3 (2,5 recommandé) |
  - `tests/deps.test.ts` : `src/{track,cars,loop,ai}`.
  - **Drivers écrits à la main**, `() => boolean` → `() => ({ throttle, jump: false })` :
    - `tests/fantomes.test.ts`, l. 24, 69, 114, 122 et 131 ;
    - `tests/race-smoke.test.ts:60` ;
    - `tests/respawn-e2e.test.ts:199` et `:231` ;
    - `tests/simulate.test.ts:192`, et les tests du driver provisoire.
  - `tests/simulate.test.ts` : `carOf` remplacé par `carPairsTouching` et `chassisX` (héritage de la 5b).
  - `tests/pilots.test.ts`.
  - `e2e/race.spec.ts` : `BEFORE_ROBOTS_S` passe de 0,8 à 2.
- Test: `tests/driver.test.ts`, `tests/pilots.test.ts`, `tests/slow/robots-sauts-0-23.test.ts`, `tests/slow/robots-sauts-24-47.test.ts`, `tests/slow/rattrapage-*.test.ts` (relancés), `tests/slow/race-invariants-*.test.ts`

**Interfaces :**
```ts
// src/ai/driver.ts (pur ; import type de CarState, Track, Pilot, Config)
export interface DriverContext {
  t: number; state: CarState; track: Track; speed: number;
  x: number; grounded: boolean;
  /** Autres voitures, dans l'ordre des index (index = celui de sim.cars). */
  others: readonly { index: number; x: number; speed: number }[];
  /** Étoile haute la plus proche devant, à moins de JUMP_LOOKAHEAD (40 m), avec sa disponibilité pour CETTE voiture ; null sinon. */
  nextHighStar: { index: number; x: number; available: boolean } | null;
}
export type Driver = (ctx: DriverContext) => { throttle: boolean; jump: boolean };
export function makeRobotDriver(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): Driver;
// src/track/query.ts
export function inNoJumpZone(track: Track, x: number): boolean;   // x ∈ [xLancement, xReception] d'un volcan [fosses] à tremplin
// src/cars/pilots.ts
readonly jumpTry: number;    // [0 ; 1]
readonly jumpSkill: number;  // s : écart-type de l'erreur sur l'instant du saut
```
Graine du driver : `(sim.pilotSeed + rank × 0x9e3779b9) >>> 0`. ENCORE rejoue donc les mêmes sauts.

**Règles** (spec §7, addendum §1.8, saut §3, texte v2.1 repris), par ordre de priorité :
1. **Après `finishedAt`** : le driver est ignoré, le pas freine.
2. **Délai de départ** : `{ throttle: false, jump: false }` tant que `t < rank × START_DELAY_PER_RANK`.
3. **Zone volcan `[xLancement, xLava]`** :
   - `throttle: true`, jamais de lever de pied ni de politesse ;
   - **saut interdit sur `[xLancement, xReception]`**, dans le driver **et** par la garde de `stepRace` pour toute voiture qui a un driver.
4. **Robots polis** (décision du papa, 5b) :
   - hors zone volcan, `throttle: false` si une autre voiture roule à moins de `POLITE_SPEED` et se trouve devant, à une distance de châssis à châssis dans `(0, POLITE_GAP]` ;
   - au-delà de 3 s d'attente continue derrière la même voiture, le robot repart (ruling Q8) ;
   - l'attente revient à zéro quand la voiture de devant repart.
5. **Lever de pied** :
   - quand x entre dans les `LIFT_LOOKAHEAD` m avant `xStart` d'une `rampe-saut` ou d'une `double-bosse`, tirage une fois par tranche : `rng() < pilot.lift` ;
   - si le tirage tombe, doigt levé **pendant** `LIFT_SECONDS` à partir de ce premier pas ;
   - jamais dans un `cratère` (tâche 15).
6. **Saut des copains (saut §3)** :
   - **Pré-tirage** : à la création du driver, pour chaque étoile haute dans l'ordre de la piste, on tire `essaie = rng() < jumpTry`, puis `erreur = N(0, jumpSkill)` (Box-Muller).
   - **Déclenchement** : quand `nextHighStar` est disponible et que `essaie` est vrai, le copain saute dès que `(xÉtoile − x) / max(speed, 1) ≤ JUMP_STAR_LEAD + erreur`.
   - **Maintien** : la demande est tenue jusqu'au saut ou jusqu'au passage de l'étoile. `wantsJump` et `canJump` filtrent.
   - **Après un respawn** : la décision tirée pour cette étoile est rejouée telle quelle.
   - Il peut rater l'étoile, mal retomber, se retourner.
7. Sinon : `{ throttle: true, jump: false }`.

**Traits des copains (décision P4 : tableau gardé)** :

| Pilote | Caractère | `jumpTry` | `jumpSkill` (s) | Raté attendu par l'erreur seule [ESTIMÉ] |
|---|---|---|---|---|
| Pablo | fonceur | 0,80 | 0,18 | ≈ 27–40 % |
| Matthis | fonceur | 0,75 | 0,15 | ≈ 18–32 % |
| Diego | moyen | 0,55 | 0,10 | ≈ 5–13 % |
| Malo | moyen | 0,50 | 0,09 | ≈ 3–10 % |
| Timothé | prudent | 0,30 | 0,04 | ≈ 0 % |
| Liam | prudent | 0,30 | 0,05 | ≈ 0 % |

**Puissance des mesures (I7)** :
- **Comparaison appariée par graine** : chaque graine est jouée deux fois, une fois avec les traits de saut de Pablo pour les 4 copains, une fois avec ceux de Timothé. Seul le trait change.
- **Tentatives attendues** : avec ≈ 1 étoile haute par course (5e, Step 9), 4 copains et 48 graines, on compte ≈ 150 tentatives dans le bras « Pablo » (4 × 48 × 0,8) et ≈ 58 dans le bras « Timothé » (4 × 48 × 0,3). C'est au-dessus du seuil de 40 : la mesure est valable. [fosses] Avec 3 étoiles hautes par course (P7) : ≈ 460 et ≈ 170.
- **Seuil** : au moins 40 tentatives exigées par bras, sinon on passe à 96 graines (4 fichiers).

- [ ] **Step 0 : Décisions du papa consignées** (registre 567ee13). Le tableau des traits est gardé (P4).
- [ ] **Step 1 : Tests rouges.**
  - `tests/driver.test.ts`, pur, avec un contexte fabriqué à la main :
    - **délai** : `throttle` faux pour `t < rank × 0,3`, vrai ensuite.
    - **zone volcan** : `throttle` jamais faux dans `[xLancement, xLava]`, même avec `lift = 1` et une voiture arrêtée devant.
    - **lever de pied** : avec `lift = 1`, doigt levé 24 pas ± 1, à partir du premier pas dans les 8 m avant chaque rampe-saut et chaque double-bosse ; avec `lift = 0`, jamais levé.
    - **politesse** :
      - voiture devant à 3 m et 1 m/s : `false` ;
      - à 3 m et 5 m/s : `true` ;
      - à 6 m : `true` ;
      - voiture derrière : `true` ;
      - en zone volcan : `true` ;
      - après 3 s d'attente : `true`.
    - **saut** :
      - `jumpTry = 1`, `jumpSkill = 0` : `jump` devient vrai au premier pas où `(xÉtoile − x) / v ≤ JUMP_STAR_LEAD` ;
      - `jumpTry = 0` : jamais ;
      - étoile indisponible : jamais ;
      - **jamais `jump: true` dans `inNoJumpZone`** : balayage au pas de 0,1 m sur tous les volcans des graines 0 à 19, avec `jumpTry = 1` et des étoiles hautes fictives juste après chaque réception.
    - **déterminisme** : même graine, mêmes sorties ; deux rangs, deux tirages différents.
  - `tests/pilots.test.ts` :
    - bornes : `jumpTry` ∈ [0 ; 1], `jumpSkill` ∈ [0,02 ; 0,25] ;
    - ordre de `jumpTry` : fonceurs > moyens > prudents ;
    - ordre de `jumpSkill` : prudents < moyens < fonceurs ;
    - Galahad à 0 et 0.
  - Commande : `npx vitest run tests/driver.test.ts tests/pilots.test.ts`. Attendu : **ROUGE**.
- [ ] **Step 2 : Implémenter**, puis **VERT**.
  - Driver, traits, types déplacés dans `ai/driver.ts`, contexte, garde, migration des drivers de test.
  - `npm run typecheck`, puis `npm test` (empreinte inchangée).
- [ ] **Step 3 : Mesures, suite lente** (`tests/slow/robots-sauts-*.test.ts`, moins de 30 min par fichier). 5 voitures, graines 0 à 47, Galahad doigt posé.
  - **Aucun saut de copain en zone volcan** : 0 `'jump'` de robot avec `inNoJumpZone(x)`.
  - **Fonceurs contre prudents**, en appariement par graine. Par bras, on compte :
    - tentatives ;
    - étoiles prises au saut ;
    - ratés (saut sans étoile dans les 2,5 s) ;
    - respawns dans les 3 s.

    Assertions : au moins 40 tentatives par bras, et taux de raté « Pablo » > taux de raté « Timothé ». On imprime aussi les chiffres du tirage normal, pilote par pilote.
  - **Déterminisme** : graine 3 jouée deux fois, même empreinte finale et même liste de `'jump'`.
  - **Invariants** :
    - au plus 3 respawns par robot ;
    - blocage d'au plus 2,1 s ;
    - `lavaByCar.galahad === 0` ;
    - `ghostContacts === 0`.

    Si les sauts font dépasser 3 respawns : on mesure, et le papa choisit entre baisser `jumpTry` et accepter. On ne relâche rien en silence.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/robots-sauts-0-23.test.ts tests/slow/robots-sauts-24-47.test.ts`.
- [ ] **Step 4 : Seuils de politesse.**
  - Sonde « grille » : Galahad arrêté 10 s, puis doigt posé, graines 0 à 4.
  - Sonde « bouchon » : un copain retourné ou arrêté au milieu d'un plat.
  - Fixer `POLITE_SPEED` et `POLITE_GAP`, et les consigner au registre.
  - Puis `npx vitest run tests/race-smoke.test.ts` et `npm run e2e`, avec la fenêtre « sans doigt » de 2 s.
- [ ] **Step 5 : Rattrapage « après 6 ».**
  - Relancer `rattrapage-*` et comparer, graine par graine : **avant la 5d, après la 5d, après la 5e, après la 6**.
  - **Variante « Galahad sauteur »** (ruling Q9) : même lot, avec l'option `jump` de `simulateRace` pilotée par `makeRobotDriver`, traits `jumpTry` 1 et `jumpSkill` 0,05 appliqués à Galahad.
  - Chiffres dans la passation, sans assertion chiffrée.
- [ ] **Step 6 : Suites** : `npm run typecheck`, `npm test` (moins de 6 min), `npm run test:slow`, `npm run e2e`.
- [ ] **Step 7 : Commit** `feat: conduite des robots (départ, lever de pied, robots polis, sauts des copains)`.
- [ ] **Step 8 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec ces sondes :
    - mutant « garde du driver retirée » ;
    - copain qui saute sur un autre ;
    - saut pendant le fantôme de sortie de zone ;
    - interblocage poli entre deux copains ;
    - respawn avant une étoile déjà tirée ;
    - turbo pendant l'approche (`JUMP_STAR_LEAD`) ;
    - allocations de `others` par pas ;
    - absence de cycle d'import.
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 9 : Validation du papa** (tablette, 5 voitures) :
  - Les copains sautent-ils de façon crédible ?
  - La course est-elle encore jouée d'avance ?

  Puis commit `docs: tâche 6 validée, passation et registre`, `git status -sb`, push. On enchaîne sur la tâche 7 du plan v2.1. Après les tâches 6 et 7, le papa rejuge la difficulté (`ENGINE_BRAKE`, plan C).

---

## Migration des tests existants (v1.4)

Toutes les pistes changent (P10), et la promesse « doigt posé = 0 chute » ne vaut plus qu'aux tremplins (P9). La liste ci-dessous couvre **tous** les tests qui supposent l'une ou l'autre, repérés par `grep` des usages de `volcanoes`, `firstVolcano`, `xElanStart`, `xLip`, `lavaByCar`, des valeurs figées et des graines fixes. Une migration est faite dans le commit qui change le comportement, jamais par `.skip`.

Légende des migrations :
- **AP** : passer à `withAnciennesPistes(cfg)`. Le test juge la physique ou compare à une mesure d'avant, et ses valeurs figées ne bougent pas.
- **T** : prendre les tremplins seulement (`tremplins(track)`, `firstTremplin`). Le test vise la géométrie du tremplin, et le compilateur signale l'usage.
- **SP** : Galahad court avec `sauteurParfait`. Le test garde « 0 chute ».
- **+F** : ajouter le cas fosse.

| Test | Ce qu'il suppose | Migration | Tâche |
|---|---|---|---|
| `tests/empreinte.test.ts` | sha1 figés sur les pistes `CONFIG` des graines 0 à 2 | AP pour `FROZEN` (inchangé) ; `FROZEN_CONFIG` recapturé par ruling R-F10 | 5e, puis 5g |
| `tests/simulate.test.ts` | `PLAN_A_TRACE` (graine 1, 20 s) ; `rebuildCars` à mi-course sans « stuck » | AP pour `PLAN_A_TRACE` ; à mi-course, vérifier qu'une chute dans une fosse n'est pas comptée comme « stuck » | 5e ; 5g |
| `tests/high-stars.test.ts` | `PRE_5E_STARS` (sha1, `STAR_HIGH_PER_RACE` 0) ; 0 ≤ n ≤ 3 ; règles de placement sur les plats ; aucune étoile haute dans [xLancement, xLava] | AP pour `PRE_5E_STARS` ; n = 3 exactement ; règles des plats ordinaires sur fixture à plafond 5 ; +F (aucune dans une tranche fosse) | 5e ; 5g |
| `tests/high-stars-window.test.ts` | « graine 1 ou première graine 0 à 9 avec une étoile haute », 0,3 s | 1er plat étoile de la graine 1, 0,4 s (0,3 s à +5 cm) | 5e |
| `tests/stars.test.ts` | zones admissibles (plats, lancement, réception) ; étoiles d'élan sur tous les volcans (l. 26, 43, 154, 205 à 260) ; 6 à 14 | plats étoile hors zones ; T pour les étoiles d'élan ; +F (zone = réception, étoile de réception, plancher) ; 6 à 14 au pas mesuré | 5e ; 5g |
| `tests/generate.test.ts` | volcans consécutifs (l. 74 à 96) ; rampe-saut avant un volcan (l. 140) ; 3 à 7 volcans (l. 149) ; `onlyPlat` ; types présents (l. 167) ; pente hors parois | dernière tranche tirée ; **2 à 7** volcans dès la 5e (plats étoile : minimum 2 CALCULÉ) ; `onlyPlat` sans plat étoile ; + `'plat-étoile'`, + `'fosse'` ; parois de fosse exemptées ; +F (alternance, phase) | 5e ; 5g |
| `tests/slices.test.ts` | géométrie de la rampe-volcan | inchangée ; + `platEtoile`, + `fosseGeometry` et `fosse` | 5e ; 5g |
| `tests/query.test.ts` | `volcanoes[0]` porte `xElanStart` et `xLip` (l. 33 à 99) | T ; +F (`volcanoAhead`, `nearestVolcanoZone`, `inGhostZone`, `nextFosse` ; `inElanZone` faux) | 5g |
| `tests/safepoint.test.ts` | `volcanoes[0]` (l. 18) : refus sur l'élan et la rampe | T ; +F (zone interdite d'une fosse, garde permise) | 5g |
| `tests/respawn.test.ts` | séries et cible `xEnd − 10` sur des pistes à ≥ 2 volcans (l. 187 à 271) | inchangé pour A (vérifié sur les deux types) ; +F, et cible B si Q-F2 = B | 5g |
| `tests/respawn-e2e.test.ts` | `firstVolcano` (flanc amont, vallée, 2 chutes, retourné sur l'élan) | T (`firstTremplin`) ; le cas fosse des 2 chutes va dans `tests/fosses.test.ts` | 5g |
| `tests/fantomes.test.ts` | `firstVolcano` (élan, sortie de zone) | T ; +F (approche de fosse, et zone prolongée si B) | 5g |
| `tests/world.test.ts` | capteur du 1er volcan (cratère, rebord à 1,2 m) | T ; +F (capteur d'une fosse : [xBord, xBord + W], haut à 0,3 m au-dessus du sol) | 5g |
| `tests/effects.test.ts` | bulles du `volcanoes[0]` | inchangé (champs communs) ; +F (bulles au ras du sol) | 5g |
| `tests/game-frame.test.ts` | `volcanoes[0]` pour une réapparition forcée | inchangé (champs communs) ; vérifier que la graine choisie a toujours un volcan | 5g |
| `tests/interpolation-replay.test.ts` | graine 1, 40 s doigt posé : nombre d'épisodes ; téléportation au 1er volcan | AP (une fosse ajouterait des téléportations au rejeu) | 5e |
| `tests/observer.test.ts` | `runFrom` au 1er volcan (élan) | T | 5g |
| `tests/race-smoke.test.ts` | cas 6 : 0 respawn, 110 à 170 s, 6 à 14 étoiles ; à 5 voitures : ≤ 3 respawns ; « 5 dans la lave » au 1er volcan | SP pour le cas 6 et Galahad à 5 voitures ; T pour « 5 dans la lave » ; +F (5 dans la fosse) ; bornes de temps remesurées (ruling si elles bougent) | 5e (bornes) ; 5g |
| `tests/rampes.test.ts` | toutes les rampes-saut des graines ; saut des volcans (l. 70) | champs communs, inchangé ; pistes nouvelles : vérifier la durée (≈ 131 s, le plus long de la CI) | 5e ; 5g |
| `tests/volcans.test.ts` (+ `helpers/cases.ts`) | cas 1 à 5 sur le 1er volcan des graines 0 à 2 | T (cas définis par l'élan et le sommet) | 5g |
| `tests/jump.test.ts` | rampe-saut d'une graine choisie (apogée sur pente, bouton grisé en vol) | à vérifier en 5e : si la recherche dépend de la piste, prendre la 1re rampe-saut de la graine trouvée dynamiquement | 5e |
| `tests/stars-pour-tous.test.ts` | graine 1 : 1re étoile, copain 6 m avant | à vérifier en 5e et 5g (choisir la 1re étoile **basse**) | 5e ; 5g |
| `tests/render-smoke.test.ts` | dessin d'une piste à volcans | +F (fosse, panneau, pas de plot au-dessus de la lave, cône réservé aux tremplins) | 5g |
| `tests/smoke.test.ts` | constantes | nouvelles constantes et valeurs (3,90 ; 50 / 12 / 20 / 25 ; plats étoile ; fosses) | 5e ; 5g |
| `tests/helpers/runs.ts` | `firstVolcano`, `trackFor` | `firstTremplin`, `firstFosse` ; `trackFor` reste sur `CONFIG` | 5g |
| `tests/helpers/phases.ts` | `variantTrack` sur `CONFIG` : les « 43 volcans » et les 2 924 + 4 601 historiques | AP dans `variantTrack` : les échantillons restent ceux de la 5c | 5e |
| `tests/helpers/race.ts` | Galahad doigt posé ; chute classée « choc » ou « propre » | option `jump` (SP par défaut, sans saut pour `race-sans-saut-*`) ; cause « fosse » (attendue sans saut) ; une chute propre à un tremplin reste un échec | 5g |
| `tests/helpers/recorded.ts`, `calibration-saut.ts` | courses enregistrées de la calibration de la 5e | AP (les tableaux du Step 8 restent comparables) | 5e |
| `tests/helpers/rattrapage.ts` | mesure appariée par graine depuis la 5d | deux mesures : AP (appariée) et `CONFIG` (nouvelle référence) | 5e ; 5g |
| `tests/slow/race-invariants-*.test.ts` | `lavaByCar.galahad === 0`, aucune chute propre | SP ; chutes par type de volcan | 5g |
| `tests/slow/finish.test.ts` | cas 6, graines 0 à 4 : 0 respawn, 6 à 14 étoiles, 110 à 170 s | SP ; bornes remesurées | 5e (bornes) ; 5g |
| `tests/slow/stars-sim.test.ts` | graine 1 : arrivée sans réapparition | SP | 5g |
| `tests/slow/volcans-slow.test.ts` | cas 7 : ≤ 2 respawns par volcan ; scénario (i) rampe-saut → plat → volcan | cas 7 inchangé (vrai pour les deux types) ; T pour (i) ; + (ii) et (iii) | 5g |
| `tests/slow/dosage.test.ts` | 1er volcan de la graine 0, tremplins des graines 0 à 2 | AP | 5e |
| `tests/slow/phases.test.ts`, `phases-dense.test.ts` | volcans des graines 0 à 9 | AP (par `helpers/phases.ts`) | 5e |
| `tests/slow/interpolation-replay-slow.test.ts` | 12 courses à 5 voitures, doigt posé | AP | 5e |
| `tests/slow/calibration-saut-*.test.ts` | pistes de la calibration du Step 8 | AP | 5e |
| `tests/slow/rattrapage-*.test.ts` | comparaison appariée « avant 5d / après 5d » | voir `helpers/rattrapage.ts` | 5e ; 5g |
| `tests/slow/race-objective.test.ts` (tâche 7) | Galahad doigt posé | à trancher en tâche 7 : Galahad avec SP (le joueur saute) ; noté ici pour ne pas l'oublier | 7 |
| `e2e/race.spec.ts` (`?seed=1`) | captures `course.png`, `arrivee.png` ; course courte `len=300` doigt posé | captures refaites ; à 300 m, 0 plat étoile, et une fosse possible : l'arrivée reste sous le délai de 150 s (2 chutes ≈ + 8 s au plus) | 5e ; 5g |
| `e2e/jump.spec.ts` (`?seed=1`) | tap, Espace, HUD ; capture `bouton-saut.png` | inchangé ; capture refaite si l'écran change | 5e |

## Budget CI (v1.4)

- **Aujourd'hui** (MESURÉ ici, e02dcae, 4 cœurs) : `npm test` 441 tests en **131,5 s** mur. La limite reste 6 min sur le runner. `tests/rampes.test.ts` (≈ 131 s) fixe la durée.
- **Ajouts** (CALCULÉ d'après les sondes : ≈ 0,1 à 0,2 s par run de fosse en monde rogné ; ≈ 15 runs par bord de fenêtre en dichotomie) :
  - fin de la 5e : `anciennes-pistes` (sha1 de 70 pistes, ≈ 2 s), `high-stars` (≈ 1 s), `high-stars-window` (≈ 45 runs, ≈ 5 s) : ≈ + 10 s de CPU ;
  - 5g : `tests/fosses.test.ts`, ≈ + 30 s de CPU :
    - partie statique ≈ 1 s ;
    - (a) et (a') 6 runs ;
    - (b) et (c) 3 dichotomies, ≈ 45 runs ;
    - (d) ≈ 15 runs ;
    - 2 courses de Galahad seul (≈ 5 s chacune) ;
    - 5 voitures sur la graine 1 (≈ 10 s) ;
  - fichier à part : Vitest parallélise par fichier, et le mur reste fixé par `rampes.test.ts`.
  - **Estimation : ≈ 2 min 15 à 2 min 45 mur ici, sous 6 min.** Si un run CI dépasse 4 min : réduire d'abord `rampes.test.ts` aux graines 0 à 2 (mineur différé de la tâche 4).
- **Suite lente** (`npm run test:slow`), chaque fichier sous 30 min mur, budget écrit en tête :
  - `fosses-a` < 20 min (≈ 1 600 runs, ≈ 5 min CALCULÉ) ;
  - `fosses-fenetres` < 20 min (≈ 2 200 runs, ≈ 6 min) ;
  - `race-sans-saut-0-11` et `-12-23` < 15 min chacun ;
  - `high-stars-sim` < 25 min ; `saut-volcan` < 15 min ;
  - `volcans-slow` + 5 min.

  Les autres fichiers ne changent pas de taille. Durée totale attendue avec 4 cœurs : ≈ + 15 min par rapport à aujourd'hui.

## Rulings du plan (ambiguïtés de l'addendum tranchées ici)

- **Q2 — Où les étoiles hautes sont interdites.**
  - Exclues : plats de lancement et de réception des volcans, `STAR_HIGH_RAMP_CLEARANCE` après une rampe-saut, `STAR_HIGH_BUMP_CLEARANCE` après une `bosses`, une `double-bosse` ou un `cratère`.
  - Pourquoi : sans ces exclusions, une voiture en vol doigt posé prendrait une étoile haute, ce que saut §4 interdit.
- **Q4 — « Vitesse de croisière ».**
  - Décision : la fenêtre d'au moins 0,3 s est exigée à la fois à `V_CRUISE` (11,2 m/s) et à `V_MAX` (14 m/s).
  - Pourquoi : 14 m/s est la vitesse réelle avec le doigt posé.
- **Q5 — Bornes « 6 à 14 étoiles prises ».**
  - Décision : sans objet depuis P1, les bornes restent telles quelles.
  - Pourquoi : les étoiles basses ne changent pas, et le doigt posé ne prend jamais d'étoile haute.
- **Q6 — Saut juste après un décollage.**
  - Décision : on garde le contact débouncé de l'addendum, donc un saut reste possible jusqu'à 0,1 s après un décollage.
  - Suite : l'effet est mesuré en 5e et remonté au papa s'il gêne.
- **Q7 — Bouton pendant le décompte ou la pause.**
  - Décision : renvoyé à la tâche 10. Les demandes y sont jetées (`JumpInput.clear`).
- **Q8 — Patience des robots polis.**
  - Décision : `POLITE_MAX_WAIT` = 3 s. Ensuite le robot repart, comme aujourd'hui.
  - Garde : l'e2e exige au moins 2 s.
- **Q9 — Rattrapage.**
  - Décision : mesure consignée, appariée par graine, sans seuil d'assertion.
  - Ajout : une variante « Galahad sauteur ».

### Rulings v1.4 (fosses et plats étoile, saut §6)

Chacun est à confirmer par les relectures de la v1.4 ; « coût si faux » comme au registre.

- **R-F1 — Une fosse est un `Volcano`** (`Tremplin | Fosse`, champ `kind`), et non un tableau à part.
  - Pourquoi : le capteur, les points sûrs, la série de chutes, les fantômes et les bulles n'utilisent que les champs communs ; ils valent donc d'office pour les fosses. Le compilateur signale chaque usage des champs du tremplin.
  - Coût si faux : une migration de types.
- **R-F2 — La tranche fosse a la longueur de la rampe-volcan.** Le terrain ne change que par le type. Coût : une réception de 64,8 m, plus longue que nécessaire.
- **R-F3 — 1 volcan sur 2 par alternance**, phase tirée dans un `mulberry32` dédié. Le `rng` principal n'est pas touché. Coût si faux : une ligne.
- **R-F4 — Plat de garde de 20 m** avant l'approche.
  - Mesuré : 0 survol sur 1 044 runs en turbo après des bosses ou une double-bosse, contre 2 sans garde (W = 6) ; W = 8 : 0 avec et sans garde.
  - Coût si faux : 20 m de plat par fosse.
- **R-F5 — Les refus de volcan regardent la dernière tranche tirée**, plats étoile ignorés. La suite tirée reste celle d'aujourd'hui. Coût si faux : nul.
- **R-F6 — Étoiles autour d'une fosse.**
  - Aucune étoile basse sur la garde ni sur l'approche ; une étoile de réception à bord aval + 25 m ; plancher par élan ou réception.
  - Le pas du curseur est ajusté sur mesure, la cible ne bouge pas.
  - Coût si faux : quelques étoiles.
- **R-F7 — Jeu de la 5e : 50 / 12 / 20 / 25.** C'est le plus permissif des 4 jeux à 0 prise sans saut à 3,90 m (calibration de la 5e). Coût si faux : 4 constantes.
- **R-F8 — Plat étoile.**
  - Tranche `'plat-étoile'` de 57 m, étoile à + 32 m, jamais juste après une rampe-saut, pas de fusion, pas d'étoile basse dessus.
  - Les étoiles des plats étoile passent d'abord ; `STAR_HIGH_PER_RACE` plafonne le total.
  - Coût si faux : une règle d'insertion.
- **R-F9 — Copains provisoires en 5g** : ils sautent chaque fosse sans erreur, jusqu'à la tâche 6. Sans cela, les invariants à 5 voitures n'auraient plus de sens entre la 5g et la 6. Coût si faux : nul (code retiré en tâche 6).
- **R-F10 — Empreinte.**
  - `ANCIENNES_PISTES` garde les hash figés sur la 5c.
  - `FROZEN_CONFIG` est recapturé en fin de 5e et en 5g. Chaque fois, le registre reçoit les anciens et les nouveaux hash, le commit, la raison (P10) et la preuve que l'empreinte `ANCIENNES_PISTES` n'a pas bougé.
  - Toute autre variation de l'empreinte reste un défaut.
- **R-F11 — Chute « fosse »** : dans les invariants, une chute dans une fosse sans saut est attendue. Elle n'est ni « choc » ni « propre ». Une chute propre à un tremplin reste un échec.
- **R-F12 — Copains catapultés** : une étoile haute prise sans saut par un copain n'est tolérée que dans les 2 s après un contact entre voitures ; elle est comptée. Pour Galahad, aucune tolérance.
- **R-F13 — e2e** : pas d'assertion sur un saut à la main à l'instant juste (Playwright n'est pas régulier à 16 ms près). Le saut juste est couvert par les fenêtres (b) et (c) en simulation.
