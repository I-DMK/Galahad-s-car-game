# Plan B (suite) — Rendu interpolé, étoiles pour tous, bouton saut, conduite des robots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. À chaque tâche : implémenteur frais, puis relecture standard + relecture adversariale par sous-agents frais **et** le skill `code-review` sur le diff de la tâche ; tours de correction (≤ 5) ; validation du papa ; passation mise à jour et commitée ; push.

**Statut :** v1.7 (tâche 7, élastique, réécrite le 2026-10-23 avec les décisions du papa ; v1.6 avant).
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

- v1.5 (2026-10-22) : tour de correction 1.
  - Réponses du papa Q-F1 à Q-F5 (registre 10282e7).
  - **Tolérance de sol pour le saut** (0718977) : nouveau Step 11 de la 5e.
  - Constats des relectures standard et adversariale : migrations des helpers de pistes d'avant au Step 10, ordre des migrations et des commandes, tâche 6 amendée dans ses Steps, chiffres corrigés (étoiles basses, budget CI, coûts en course).
- v1.6 (2026-10-22) : tour de correction 2.
  - Q-F6 tranché par le papa (c73faf5) : tolérance de sol gardée à 0,35 s.
  - Budget CI refait sur mesure : fenêtres des fosses balayées sur les 1,6 s avant le bord, bloc central de 0,4 s en CI, cas à 5 m/s échantillonné, fichiers lents scindés (`fosses-fenetres-*`, `saut-volcan-*`, `saut-rampes`).
  - Nouveau Step 12 de la 5e : `STAR_HIGH_Y` 3,90 et jeu 50 / 12 / 20 / 25 posés dans `config.ts` ; les Steps suivants deviennent 13 à 17.
  - Ruling Q6 marqué « remplacé par P11 » ; migrations des tests de c2b1f51 (`lastGroundedAt` nul à la création, test « pente (P3) », table de `canJump`, littéral de `jump-runs.ts`).
  - Tâche 6, règle 3 : « un seul saut par tentative ».

v1.3 validée par le papa et exécutée jusqu'au Step 8 de la 5e. **v1.6 en attente** de relecture. Toutes les questions du papa sont tranchées, Q-F6 compris (c73faf5).

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

**Ordre d'exécution :** **5f → 5d → 5e → 5g → 6**, puis la **tâche 7 (v1.7, ci-dessous)**, qui remplace celle du plan v2.1. Prérequis : la tâche 5c est validée et fusionnée sur `ccr-5b6fabc4-n96ofo` (passation, « Prochaine action » 2).

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
| P6 | `STAR_HIGH_Y` = 3,90 m | 5e : décision au Step 9, valeur posée au Step 12 avec le jeu de dégagements 50 / 12 / 20 / 25 (saut §6.6, ruling R-F7) |
| P7 | **Au moins 3 étoiles hautes par course**, sur des **plats étoile** (≈ 50 m) posés par le générateur, le reste du terrain changeant le moins possible | 5e, Steps 13 à 15 (plats étoile, acceptation, recapture) : tranche `'plat-étoile'` de 57 m, 3 par piste (saut §6.6) |
| P8 | **Volcans sans tremplin** : fosses de lave sur le plat, ≈ 1 volcan sur 2 | tâche 5g (saut §6.2 à §6.5) |
| P9 | **Promesse changée** : sans sauter, on tombe dans une fosse (respawn avant, 2e chute de suite → posé de l'autre côté) ; on finit toujours la course ; les tremplins gardent « doigt posé, jamais de chute » | Global Constraints, migration des tests |
| P10 | Toutes les pistes changent, à longueur totale constante ; l'empreinte de Galahad seul est recapturée par un ruling | Global Constraints, Step 15 de la 5e et Step 8 de la 5g (ruling R-F10) |

## Décisions du papa (registre 10282e7, 0718977 et c73faf5, réponses aux questions de la v1.4 et de la v1.5)

| # | Décision | Effet dans le plan |
|---|---|---|
| Q-F1 | Fosse de **8 m**, franchissable **à doigt posé** (sous ≈ 6 m/s, aucun saut ne passe) | `FOSSE_WIDTH` 8 (5g) ; saut §6.1 |
| Q-F2 | **Option B** : à la 2e chute de suite, voiture posée **juste après la fosse** (bord aval + 5 m) | 5g : cible de 2e chute, respawn groupé vers l'aval ; zone fantôme jusqu'à bord aval + 40 m |
| Q-F3 | Les copains **ratent parfois** : erreur × **2,5** aux fosses, instant visé **centré à chaque vitesse** | tâche 6 : `FOSSE_SKILL_FACTOR` 2,5, `fosseJumpLead(v)` ; taux mesuré vitesse par vitesse (Pablo : 19 à 34 % attendus) |
| Q-F4 | **Exactement 3** étoiles hautes par course | 5e, Step 13 : `STAR_HIGH_PER_RACE` 3, test « exactement 3 » |
| Q-F5 | Rien ne s'allume à l'approche d'une fosse pour le premier test | 5g : panneau et lave seulement ; rejugé au test tablette |
| P11 | **Tolérance de sol** : le saut part si une roue a eu le contact de jeu dans les **0,35 s** précédentes ; mémoire de 0,1 s gardée ; `JUMP_COOLDOWN` empêche le double saut ; un saut juste après un décollage de bosse ou de rampe est accepté | 5e, Step 11 : `JUMP_GROUND_GRACE`, tests, remesure des sauts aux sommets |
| Q-F6 | Tolérance de sol **gardée à 0,35 s** : 0,41 % d'appuis perdus à 21 m/s tenus, accepté, à rejuger au test tablette | 5e, Step 11 : « au plus 0,5 % » à 21 m/s tenus |

Aucune question restante (addendum §6.10).

## Global Constraints

Toutes celles du plan v2.1 restent valables :
- unités, pas fixe, roues à 48 côtés, contact débouncé ;
- aucun déplacement de corps dans un callback de collision ;
- commits en français préfixés `feat:`, `fix:`, `test:`, `chore:` ou `docs:` ;
- aucun identifiant de modèle dans les commits.

En plus :

- **Typecheck et `npm test` verts à chaque commit.** `tsconfig.json` inclut `tests/`, et `deploy.yml` lance `npm run typecheck` puis `npm test`. **Jamais de `.skip`.** Une API n'est retirée que dans le commit qui migre son dernier consommateur.
- **Budget CI.** `npm test` reste sous 6 min mur sur le runner (MESURÉ ici, 4 cœurs : 441 tests en ≈ 130 s, 131,5 s à la relecture ; la CI réelle met 2 min 01 à 2 min 18). Simulations de course complète à 5 voitures, balayages et calibrations vont dans `tests/slow/` (`npm run test:slow`). [fosses] Chiffres à jour et ajouts de la fin de la 5e et de la 5g : section « Budget CI (v1.6) » en fin de plan.
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
  | 5e (fin, v1.4) | **identique avec `ANCIENNES_PISTES`** ; avec `CONFIG`, **recapturée par ruling** | Les plats étoile changent les pistes (décision P10). `ANCIENNES_PISTES` = `{ STAR_FLATS_PER_RACE: 0, FOSSE_PERIOD: 0, STAR_HIGH_PER_RACE: 0, STAR_STEP_MIN: 60, STAR_STEP_MAX: 100 }` redonne les pistes de e02dcae **sans étoiles hautes** au bit près (saut §6.9) : l'empreinte figée y reste la preuve que la physique n'a pas bougé. La tolérance de sol (Step 11) ne joue que sur une demande de saut : doigt posé sans saut, l'empreinte ne bouge pas. |
  | 5g | **identique avec `ANCIENNES_PISTES`** ; avec `CONFIG`, **recapturée par ruling** | Les fosses changent les pistes. Aucun chemin de code des fosses ne s'exécute sans fosse. |
  | 6 | **identique**, avec `ANCIENNES_PISTES` et (v1.4) avec `CONFIG` | Galahad n'a pas de driver ; le saut provisoire des copains aux fosses (5g) n'existe qu'à 5 voitures. |

  Si l'empreinte bouge alors que le tableau dit « identique » : on s'arrête, on mesure, le papa tranche, le ruling va au registre. On ne recapture jamais en silence. [fosses] Une recapture « par ruling » (fin de 5e, 5g) consigne au registre : les 3 anciens hash, les 3 nouveaux, le commit, et la preuve que l'empreinte `ANCIENNES_PISTES` est restée identique dans le même commit.
- **Promesse de la 5c conservée (saut §0).** Doigt posé sans jamais sauter, on finit la course et on ne tombe jamais dans la lave. L'invariant `lavaByCar.galahad === 0` à 5 voitures, graines 0 à 23 (`tests/slow/race-invariants-*.test.ts`), reste vert à chaque tâche.
  [fosses] **Amendée à partir de la 5g (décision P9, saut §6.1)** :
  - doigt posé sans jamais sauter : 0 chute **aux tremplins** ; **exactement 2 chutes par fosse** (la 2e pose la voiture juste après la fosse, option B) et au plus 2 par série ; arrivée avant 240 s ;
  - doigt posé avec un saut au centre de la fenêtre à chaque fosse (`fosseJumpWanted`, 5g) : 0 chute, comme avant ;
  - les invariants à 5 voitures font courir Galahad **avec** ce saut (`lavaByCar.galahad === 0` garde son sens), et une famille nouvelle le fait courir **sans** (2 chutes par fosse, 0 au tremplin).
- **Paramètres.** Chaque nouveau paramètre va dans `src/config.ts`, en nombres seulement. Une constante dérivée est déclarée avant le littéral, comme `D_LANCE`. La gravité devient la constante locale `GRAVITY`, réutilisée par `JUMP_VY`. [fosses] Constantes de la fin de la 5e et de la 5g : saut §6.9 ; `STAR_FLAT_LENGTH` est dérivée (dégagement d'entrée + élan + atterrissage).
- [fosses] **Pistes d'avant** (« e02dcae sans étoiles hautes »). `tests/helpers/anciennes-pistes.ts` exporte `ANCIENNES_PISTES` et `withAnciennesPistes(cfg)`.
  - Qui les utilise : les tests qui jugent la physique ou comparent à une mesure d'avant (empreinte, `PLAN_A_TRACE`, `PRE_5E_STARS`, phases, dosage, calibrations, rejeu d'interpolation, rattrapage apparié). Les tests d'acceptation du jeu (invariants, cas des volcans, fosses, étoiles) tournent sur `CONFIG`.
  - Helpers à migrer **au Step 10 de la 5e, avant tout changement de `src/`** :
    - `trackFor(seed, cfg = CONFIG)` et `worldFor(seed, cfg = CONFIG)` (`tests/helpers/runs.ts`), avec un cache par cfg (clé `JSON.stringify(cfg)`) ;
    - `recordTrajectory(seed, seconds, robots, cfg = CONFIG)` (`tests/helpers/frames.ts`) ;
    - `variantTrack` (`tests/helpers/phases.ts`) ;
    - `cfgFor` de la calibration (`tests/helpers/calibration-saut.ts`) devient `{ ...withAnciennesPistes(CONFIG), STAR_HIGH_PER_RACE: 3, … }`, avec une assertion de non-vacuité (au moins une candidate par jeu sur les graines calibrées). Sinon, les tableaux du Step 8 se vident sans faire échouer le test.
  - `tests/anciennes-pistes.test.ts` fige le sha1 des pistes de e02dcae sans étoiles hautes (points, tranches, volcans, étoiles ; graines 0 à 49 à 1 680 m, graines 0 à 9 à 300 et 6 000 m) : si ce sha1 bouge, l'interrupteur ment.
  - Le rattrapage mesuré sur ces pistes est un **contrôle de non-régression** (identique à la 5d par construction) ; l'effet de la 5e et de la 5g se mesure sur `CONFIG`.
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
8. [fosses] **Appui de saut pendant un rebond, en turbo, au milieu de la fenêtre d'une fosse.**
   - Attendu : avec la tolérance de sol de 0,35 s, aucun appui perdu à 14 m/s ni en turbo pris à 14 m/s ; à 21 m/s tenus, au plus 0,5 %.
   - Tâche : 5e (Step 11).
9. [fosses] **Turbo pris sur une double-bosse juste avant une fosse, sans sauter.**
   - Attendu : la voiture tombe (jamais de survol), grâce au plat de garde de 20 m.
   - Tâche : 5g.
10. [fosses] **Départ arrêté au point sûr d'avant une fosse, après une chute.**
   - Attendu : un saut bien placé passe (fenêtre ≥ 0,4 s, mesurée 0,87 à 0,92 s pour 8 m) ; à la 2e chute, la voiture est posée juste après la fosse (bord aval + 5 m) et finit la course.
   - Tâche : 5g.
11. [fosses] **Plat étoile après une rampe-saut ou une double-bosse, en turbo.**
    - Attendu : jamais de plat étoile juste après une rampe-saut ; après une double-bosse, aucune étoile haute prise sans saut.
    - Tâche : 5e (fin).
12. [fosses] **`ANCIENNES_PISTES`.**
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
src/cars/jump.ts              [fosses] canJump avec tolérance de sol (5e fin) ; fosseJumpLead, fosseJumpWanted (5g)
src/sim/simulate.ts           [fosses] CarSim.lastGroundedAt (5e fin) ; saut provisoire des copains aux fosses (5g)
src/game.ts                   [fosses] __game.respawns en ?debug=1 (5g)
src/render/track.ts           [fosses] fosse : lave à ras bord, langues de feu, halo, panneau (5g)
tests/helpers/anciennes-pistes.ts  [fosses] ANCIENNES_PISTES, withAnciennesPistes (5e fin, complétée en 5g)
tests/helpers/fosses.ts       [fosses] piste à une fosse, fosseRun, fosseWindow (chaque pas des 1,6 s avant le bord), fosseBlock (bloc de 0,4 s), sauteur parfait (5g)
tests/jump-grace.test.ts      [fosses] tolérance de sol, appuis perdus (5e fin)
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
- [fosses] **P6, P7, Q-F4, P11, Q-F6** (Step 9) : `STAR_HIGH_Y` = 3,90 m ; exactement 3 étoiles hautes par course, sur des plats étoile ; tolérance de sol de 0,35 s, gardée. La fin de la tâche (Steps 9 à 17) est réécrite en v1.5 et v1.6, plus bas.

**Saut §1 (amendé au Step 1) :**
- **Bouton** : rond, au moins 140 px, en bas à gauche, `data-no-pedal`.
- **Front d'appui** : `pointerdown` sur le bouton, ou `keydown` Espace non répété.
- **Conditions** :
  - au moins une roue au sol, au sens du contact débouncé (ruling Q6, **remplacé par P11** au Step 11 : contact de jeu dans les 0,35 s précédentes, saut §1) ;
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
- Test: `tests/jump.test.ts`, `tests/jump-input.test.ts` (jsdom), `tests/high-stars.test.ts`, `tests/high-stars-window.test.ts` (garde CI), `tests/slow/calibration-saut-sol.test.ts`, `tests/slow/calibration-saut-fenetres.test.ts`, `tests/slow/calibration-saut-vols-0-11.test.ts`, `tests/slow/calibration-saut-vols-12-23.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan-0-4.test.ts`, `tests/slow/saut-volcan-5-9.test.ts`, `tests/slow/saut-rampes.test.ts`, `e2e/jump.spec.ts`

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
- **Ruling Q6, remplacé par P11** (Step 11) : il gardait le contact débouncé, donc un saut possible jusqu'à 0,1 s après un décollage. La tolérance de sol de 0,35 s le remplace ; ses effets sont mesurés au Step 11 (appuis perdus, sauts aux sommets).

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
- [ ] **Step 7 : Tests de placement** (ROUGE, puis implémentation, puis VERT). Fichier `tests/high-stars.test.ts`, en CI, statique, graines 0 à 49, pistes de 1 680 m. **Aucun seuil sur le nombre d'étoiles hautes à ce stade** : la moyenne et le nombre de pistes sont seulement imprimés, et leurs assertions arrivent au Step 13 (v1.6), après la calibration.
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
#### Fin de la 5e (v1.6, décisions P6, P7, Q-F4, P11 et Q-F6 du 2026-10-22)

Steps 1 à 8 faits (registre : commits 96556a2 à 4a414c6). Les Steps 9 à 14 de la v1.3 sont remplacés par les Steps 9 à 17 ci-dessous. Spécification : saut §1 (tolérance de sol), §6.6 (plats étoile) et §6.9 (constantes, `ANCIENNES_PISTES`).

**Files (fin de la 5e) :**
- Create: `tests/helpers/anciennes-pistes.ts`, `tests/anciennes-pistes.test.ts`, `tests/jump-grace.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan-0-4.test.ts`, `tests/slow/saut-volcan-5-9.test.ts`, `tests/slow/saut-rampes.test.ts`
- Modify (code) :
  - `src/config.ts` :
    - `JUMP_GROUND_GRACE` 0,35 (Step 11) ;
    - `STAR_HIGH_Y` 3,90 et jeu 50 / 12 / 20 / 25, à la place des valeurs de départ « PROVISOIRE » 3,85 / 15 / 15 / 70, commentaires « PROVISOIRE » retirés (Step 12) ;
    - `STAR_HIGH_PER_RACE` 3 (inchangé), `STAR_FLATS_PER_RACE` 3, `STAR_FLAT_SPACING` 400, `STAR_FLAT_LENGTH` dérivée (57), `STAR_STEP_MIN/MAX` 55 / 90 (Step 13).
  - `src/cars/jump.ts` : `canJump` reçoit `lastGroundedAt` à la place de `grounded`.
  - `src/sim/simulate.ts` : `CarSim.lastGroundedAt` (instant du dernier contact de jeu ; **`null` à la création**, dans `createRaceSim` comme dans tout littéral `CarSim`, et remis à `null` par une téléportation) ; `updateJump`, `jumpReady`.
  - `src/track/types.ts` : `'plat-étoile'` dans `SliceType`.
  - `src/track/slices.ts` : `platEtoile(cfg)` (sans `rng`).
  - `src/track/generate.ts` : ancres, insertion, refus des volcans sur la dernière tranche **tirée** ; `onlyPlat` sans plat étoile.
  - `src/track/stars.ts` : une étoile haute par plat étoile, posée d'abord ; plats étoile hors des zones du curseur ; candidates ordinaires à ≥ 45 m d'une étoile de plat étoile ; un plat étoile est du terrain permis.
  - `src/render/track.ts` : rien, sauf si un `switch` sur le type de tranche l'exige (le sol est dessiné depuis les points).
- Modify (tests) : « Migration des tests existants (v1.6) », lignes marquées **5e**, chacune au Step indiqué.
- Test: `tests/anciennes-pistes.test.ts`, `tests/jump.test.ts`, `tests/jump-grace.test.ts`, `tests/high-stars.test.ts`, `tests/high-stars-window.test.ts`, `tests/generate.test.ts`, `tests/stars.test.ts`, `tests/slow/high-stars-sim.test.ts`, `tests/slow/saut-volcan-0-4.test.ts`, `tests/slow/saut-volcan-5-9.test.ts`, `tests/slow/saut-rampes.test.ts`, `e2e/jump.spec.ts` (capture)

- [x] **Step 9 : Décisions du papa enregistrées** (e02dcae, 10282e7, 0718977).
  - Tableau du Step 8 présenté (4a414c6) : à 3,90 m, fenêtre min 0,57 / 0,53 s à 11,2 / 14 m/s, 0,42 s à +5 cm ; garde au sol de Galahad ≥ 2,1 m.
  - Décisions :
    - P6 : `STAR_HIGH_Y` = 3,90 m ;
    - P7 et Q-F4 : exactement 3 étoiles hautes par course, sur 3 plats étoile ;
    - P8, Q-F1, Q-F2, Q-F5 : fosses (tâche 5g) ;
    - P9 : promesse changée ;
    - P10 : pistes changées, empreinte recapturée par ruling ;
    - P11 : tolérance de sol de 0,35 s ; Q-F6 (c73faf5) : gardée à 0,35 s.
  - Jeu de dégagements retenu (saut §6.6, ruling R-F7) : **50 / 12 / 20 / 25**. C'est le plus permissif des 4 jeux à 0 prise sans saut à 3,90 m (5 voitures, graines 0 à 23).
- [ ] **Step 10 : Spécification relue, pistes d'avant figées, migrations « AP ».** Aucun changement de `src/` dans ce Step.
  - Relectures de l'addendum §6 et de ce plan (v1.5, puis v1.6) ; commit `docs: …` par tour.
  - `tests/helpers/anciennes-pistes.ts` exporte `ANCIENNES_PISTES` et `withAnciennesPistes(cfg)`. Les clés `STAR_FLATS_PER_RACE` et `FOSSE_PERIOD` n'existent pas encore dans `Config` : l'helper les ajoute dès qu'elles existent, sans changer de valeur.
  - `tests/anciennes-pistes.test.ts` : sha1 des pistes générées avec `withAnciennesPistes(CONFIG)` (Float64 de `points`, puis tranches, volcans, étoiles ; graines 0 à 49 à 1 680 m, graines 0 à 9 à 300 et 6 000 m), **mesuré sur e02dcae** et collé, avec le hash du commit en commentaire. Ce sont les pistes de e02dcae sans étoiles hautes.
  - Helpers (Global Constraints, « Pistes d'avant ») :
    - `trackFor(seed, cfg)` et `worldFor(seed, cfg)` (cache par cfg) ;
    - `recordTrajectory(…, cfg)` ;
    - `variantTrack` ;
    - `cfgFor` de la calibration, avec son assertion de non-vacuité.
  - Toutes les lignes **AP** du tableau de migration :
    - `tests/empreinte.test.ts`, `PLAN_A_TRACE` (`tests/simulate.test.ts`), `PRE_5E_STARS` (`tests/high-stars.test.ts`) ;
    - `tests/interpolation-replay.test.ts` et `tests/slow/interpolation-replay-slow.test.ts` ;
    - `tests/slow/dosage.test.ts`, `tests/slow/phases*.test.ts`, `tests/slow/calibration-saut-*.test.ts`, `tests/helpers/rattrapage.ts`.

    Leurs valeurs figées ne changent pas : sur e02dcae, ces pistes **sont** celles de `CONFIG` sans étoiles hautes, et les étoiles hautes ne touchent pas la physique (empreinte identique au Step 7).
  - Commandes : `npm run typecheck` ; `npm test` (vert, durée notée) ; `npx vitest run -c vitest.slow.config.ts tests/slow/dosage.test.ts tests/slow/calibration-saut-sol.test.ts` (vert, mêmes chiffres qu'en 4a414c6).
  - Commit `test: pistes d'avant figées derrière un interrupteur (ANCIENNES_PISTES), helpers par configuration`.
- [ ] **Step 11 : Tolérance de sol pour le saut** (décision P11, saut §1). ROUGE, puis VERT.
  - Tests rouges, `tests/jump.test.ts` migré et `tests/jump-grace.test.ts` (CI) :
    - « au sol seulement » devient, au décollage d'une rampe-saut : une demande **0,30 s** après le dernier contact de jeu donne un saut ; à **0,40 s** et à 0,7 s, aucun saut, vy inchangée. Pas de cas « voiture lâchée de 2 m » ici : elle n'a jamais touché le sol ;
    - `lastGroundedAt` vaut `null` à la création : le test de c2b1f51 « voiture lâchée de 2 m, demande à chaque pas : aucun saut avant le contact » est gardé tel quel, et il échoue si la création pose un contact ;
    - migrations de c2b1f51 (tableau de migration) : table de `canJump` (`grounded` remplacé par `lastGroundedAt` : `null`, t − 0,30, t − 0,35 et t − 0,40) ; littéral `CarSim` de `tests/helpers/jump-runs.ts` (`lastGroundedAt: null`, le compilateur le signale) ; commentaire du test « pente (P3) » (l. 139-142) réécrit : le saut part maintenant **en l'air** (graine 0 : 2,90 m après le pied, 0,18 s après le dernier contact de jeu, gain 2,46 m, MESURÉ (relecture)), assertions inchangées ;
    - bouton grisé : `jumpReady` vrai jusqu'à 0,35 s après le dernier contact de jeu, faux ensuite jusqu'au retour au sol, et pendant le délai ;
    - pas de double saut : demande à chaque pas pendant 3 s après un saut → un seul saut avant le retour au sol. CALCULÉ : le contact de jeu dure jusqu'à t + 0,1 s, la tolérance jusqu'à t + 0,45 s, et le délai de 0,5 s finit après elle, avec 0,05 s de marge. Le test garde cette marge : si `GROUND_DEBOUNCE_SECONDS`, `JUMP_GROUND_GRACE` ou `JUMP_COOLDOWN` change, il échoue ;
    - mémoire de 0,1 s : les deux cas de la v1.3 inchangés ;
    - une téléportation (respawn) remet `lastGroundedAt` à `null` : pas de saut de tolérance sur le contact d'avant la téléportation ;
    - **0 appui perdu** (saut §6.2, calcul sur la suite « au sol / en l'air » d'une course sans saut, sans relancer la physique par appui) : **4 cas** (11,2 m/s, 14 m/s, turbo pris à 14 m/s, 21 m/s tenus), chacun de 24 lancers de 9 s décalés de 0,37 m sur une piste plate. Chaque pas de [2 s, 8 s] est un appui : 6 s × 60 × 24 = 8 640 appuis par cas. Un appui est servi si un pas de [k, k + `JUMP_BUFFER`] a eu un contact de jeu dans les 0,35 s. Attendu (MESURÉ avec la tolérance émulée) :
      - 0 sur 8 640 à 11,2 et 14 m/s ;
      - 0 avec un turbo pris à 14 m/s ;
      - à 21 m/s tenus (facteur 1,5 permanent) : part imprimée, au plus 0,5 % (MESURÉ : 0,41 %, rebonds jusqu'à 0,77 s ; accepté par le papa, Q-F6, c73faf5).

      Coût MESURÉ : 6,4 à 6,7 s de CPU par cas, ≈ 26 s pour le fichier.
  - Implémentation → **VERT** ; `npm test` : empreinte et `PLAN_A_TRACE` inchangés (aucune demande de saut doigt posé).
  - **Remesure des sauts aux sommets**, trois fichiers lents écrits à ce Step et complétés au Step 14, budget 15 min chacun (un saut coûte ≈ 0,13 s : 2 576 sauts en 338 s, MESURÉ) :
    - **tremplins**, `tests/slow/saut-volcan-0-4.test.ts` (graines 0 à 4 : 23 tremplins, 2 576 sauts, ≈ 5,6 min MESURÉ) et `tests/slow/saut-volcan-5-9.test.ts` (graines 5 à 9 : 20 tremplins, ≈ 2 240 sauts, ≈ 4,9 min), 4 cas d'arrivée :
      - doigt posé depuis `xLancement` ;
      - turbo de l'étoile d'élan ;
      - lancée à V_MAX en `xLancement − 45`, turbo à − 26 ;
      - turbo permanent.

      Saut à chaque pas de [dernier contact de jeu − 6 pas, dernier contact + 0,35 s] : atterrissage avant `xEnd`, part de lave imprimée (saut §6.2, « Tolérance de sol », chiffres de la sonde) ;
    - **rampes-saut**, `tests/slow/saut-rampes.test.ts` : graines 0 à 4 (38 rampes-saut), à V_MAX et en turbo, même balayage (≈ 2 130 sauts, ≈ 4,6 min) : angle au contact, retournements et atterrissage imprimés, sans assertion (un saut mal placé se paie, saut §0).

    Comptes sur les pistes du Step 11, sans plat étoile ni fosse ; à partir de la 5g, `saut-volcan-*` ne voit plus que les tremplins, ≈ 2 fois moins nombreux.
  - Commit `feat: tolérance de sol pour le saut (0,35 s), aucun appui perdu dans une fenêtre`.
- [ ] **Step 12 : Valeurs de la calibration posées** (décision P6, ruling R-F7). ROUGE, puis VERT.
  - Test rouge, `tests/smoke.test.ts` : `STAR_HIGH_Y` 3,90, `STAR_HIGH_TAKEOFF_ROOM` 20, `STAR_HIGH_LANDING_ROOM` 25, `STAR_HIGH_RAMP_CLEARANCE` 50, `STAR_HIGH_BUMP_CLEARANCE` 12.
  - `src/config.ts` : ces valeurs remplacent les valeurs de départ « PROVISOIRE » (3,85 / 15 / 15 / 70 ; 12 inchangé). Les mentions « PROVISOIRE » sont retirées. Le commentaire du bloc cite la calibration (4a414c6) et le choix du papa (e02dcae), et garde le rappel « recalibrer si `JUMP_VY`, la gravité, la suspension ou les roues changent ».
  - Aucune mesure nouvelle : ce sont les valeurs du tableau du Step 8 (0 prise sans saut à 3,90 m, 5 voitures, graines 0 à 23 ; fenêtre min 0,57 / 0,53 s à 11,2 / 14 m/s, 0,42 s à + 5 cm).
  - Verts sans autre changement : `tests/high-stars.test.ts` (placement relu avec les nouvelles valeurs, moyenne imprimée ; `PRE_5E_STARS` inchangé, à `STAR_HIGH_PER_RACE` 0) ; `tests/high-stars-window.test.ts` (≥ 0,3 s) ; `tests/stars.test.ts` (étoiles basses inchangées).
  - L'empreinte `ANCIENNES_PISTES` ne bouge pas ; elle seule fait foi jusqu'au Step 15.
  - Commandes : `npx vitest run tests/smoke.test.ts tests/high-stars.test.ts tests/high-stars-window.test.ts tests/stars.test.ts`, puis `npm run typecheck` et `npm test` (vert).
  - Commit `feat: étoiles hautes à 3,90 m, dégagements 50 / 12 / 20 / 25 (calibration du Step 8, décision P6)`.
- [ ] **Step 13 : Plats étoile dans le générateur** (ROUGE, puis implémentation, puis VERT).
  - Tests rouges :
    - `tests/generate.test.ts` :
      - N = 3 plats étoile à 1 680 m (graines 0 à 49) et à 6 000 m (graines 0 à 19), 1 à 600 m, 0 à 300 m ;
      - longueur `STAR_FLAT_LENGTH` à une maille près ;
      - jamais juste après une rampe-saut ;
      - le k-ième commence à la première frontière ≥ a_k permise ;
      - aucun volcan juste après une rampe-saut ou un autre volcan, en ignorant les plats étoile ;
      - la suite des tranches tirées (plats étoile retirés) a, avec celle de `withAnciennesPistes`, un préfixe commun d'au moins 20 tranches sur chaque graine 0 à 49 (MESURÉ : 25 au moins, 31,9 en moyenne) ;
      - **2 à 7 volcans** (graines 0 à 19), remplace « 3 à 7 » (MESURÉ : 2 à 5) ;
      - `onlyPlat` : ni plat étoile ni volcan.
    - `tests/high-stars.test.ts` :
      - **exactement 3 étoiles hautes par piste de 1 680 m, graines 0 à 49** (Q-F4), chacune à `xStart` de son plat étoile + 32 m, y = sol + 3,90 ;
      - `STAR_HIGH_PER_RACE` = 5 (fixture) : les 3 des plats étoile toujours présentes, les autres à ≥ 45 m d'elles, sur des plats ordinaires selon la règle de la 5e ;
      - aucune étoile basse sur un plat étoile ;
      - étoiles basses identiques entre `STAR_HIGH_PER_RACE` 0 et 3 ;
      - déterminisme ;
      - les tests de placement du Step 7 restent pour les plats ordinaires (fixture à plafond 5).
    - `tests/stars.test.ts` : 6 à 14 étoiles basses (graines 0 à 19), filtrées `!s.high`.
  - Implémentation, `STAR_STEP_MIN/MAX` = 55 / 90 (MESURÉ (relecture) : 8,72 de moyenne). On remesure ; si la moyenne sort de [8, 12] ou si le minimum passe sous 6 : ruling, cible inchangée (addendum plan B §1.5).
  - **Dans ce même Step**, migration des tests marqués **5e (Step 13)**, qui cassent quand le générateur change :
    - `tests/generate.test.ts`, `tests/stars.test.ts`, `tests/high-stars.test.ts` ;
    - `tests/high-stars-window.test.ts`, `tests/stars-pour-tous.test.ts`, `tests/jump.test.ts` (rampe trouvée dynamiquement) ;
    - bornes de `tests/race-smoke.test.ts` et de `tests/slow/finish.test.ts` remesurées.
  - Commandes : `npx vitest run tests/generate.test.ts tests/high-stars.test.ts tests/stars.test.ts tests/anciennes-pistes.test.ts`, puis `npm run typecheck` et `npm test` (vert). L'empreinte `CONFIG` n'est figée qu'au Step 15 : jusque-là seule `ANCIENNES_PISTES` fait foi, et `FROZEN_CONFIG` n'existe pas encore.
- [ ] **Step 14 : Acceptation.**
  - `tests/high-stars-window.test.ts` (CI) : étoile du 1er plat étoile de la graine 1, fenêtre ≥ **0,4 s** à 11,2 et à 14 m/s, ≥ 0,3 s à 3,95 m (MESURÉ sur un plat : 0,57 / 0,60 s, et 0,47 / 0,48 s à +5 cm).
  - `tests/slow/high-stars-sim.test.ts` (< 25 min) :
    - **(i)** 5 voitures doigt posé sans saut, turbo compris, graines 0 à 23 : 0 étoile haute prise sans saut ni contact. Une voiture (Galahad compris depuis le tour 2 de la 5g, R-F12 amendé) ne prend une étoile haute sans saut que dans les 2 s après un contact entre voitures (« catapulte », relevée par l'observateur `carPairsTouching`, comme les chutes « par choc ») : les prises sont imprimées, et une prise sans contact échoue (saut §4).
    - **(ii)** Galahad seul, turbo forcé tous les 5 m de [x★ − 80, x★ − 20], graines 0 à 9 : 0 prise.
    - **(iii)** Pour chaque étoile de plat étoile des graines 0 à 9 : fenêtre ≥ 0,4 s à 11,2 et 14 m/s, ≥ 0,3 s à +5 cm, sans respawn (`windowFor`). Le centre est imprimé (futur `JUMP_STAR_LEAD`, mesuré ≈ 1,0 s).
    - **(iv)** Pour chaque plat étoile précédé de bosses ou d'une double-bosse (graines 0 à 49) : élan à 21 m/s sur la tranche précédente, 0 prise sans saut.
  - `tests/slow/saut-volcan-0-4.test.ts` et `-5-9.test.ts` (Step 11), complétés, sur les **tremplins** :
    - doigt posé sans saut : 0 chute ;
    - un saut mal placé peut faire tomber : au moins une position sur [xElanStart − 10, xLip] (balayage tous les 2 m, arrêté à la première chute, par tremplin) ;
    - sauts dans la tolérance au sommet : chiffres du Step 11 assertés.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/high-stars-sim.test.ts tests/slow/saut-volcan-0-4.test.ts tests/slow/saut-volcan-5-9.test.ts tests/slow/saut-rampes.test.ts`.
- [ ] **Step 15 : Non-régression, empreinte recapturée, commit.**
  - Avec `ANCIENNES_PISTES` : empreinte, `PLAN_A_TRACE`, `PRE_5E_STARS` et sha1 des pistes **inchangés**.
  - Avec `CONFIG` : les 3 nouveaux hash de l'empreinte (graines 0, 1, 2, 30 s) sont mesurés et collés dans `tests/empreinte.test.ts` (second tableau `FROZEN_CONFIG`). **Ruling R-F10** au registre : anciens et nouveaux hash, commit, raison (P10), et la preuve que l'empreinte `ANCIENNES_PISTES` est restée identique dans le même commit.
  - Migrations restantes marquées **5e** (tableau).
  - `npm run typecheck`, `npm test` (chronométré, < 6 min), `npm run test:slow`, `npm run e2e`, avec la capture `e2e/screenshots/plat-etoile.png`.
  - Rattrapage « après 5e » :
    - sur `ANCIENNES_PISTES` : **contrôle de non-régression**, identique à la mesure de la 5d course par course ;
    - sur `CONFIG` : **mesure de l'effet**, nouvelle référence, non appariée.
  - Commit `feat: plats étoile, 3 étoiles hautes par course à 3,90 m, pistes d'avant derrière un interrupteur`.
- [ ] **Step 16 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec les sondes de la v1.3 :
    - saut à chaque x d'un volcan ; saut depuis un toit ; saut juste après un sommet (Q6, remplacé par P11 : voir les sondes de la tolérance de sol ci-dessous) ; mémoire de 0,1 s combinée au délai de 0,5 s ;
    - saut en turbo ; saut juste après un respawn ; sauts sur les bosses ; apogée sur toutes les pentes du générateur (P3) ;
    - étoile haute prise en vol de rampe-saut turbo ; doigt qui glisse du bouton vers l'écran ; Espace maintenu ; demande faite pendant une image à 0 pas.
  - Plus ces sondes :
    - tolérance de sol : double saut, saut après une téléportation, saut 0,34 et 0,36 s après un décollage ;
    - plat étoile après une double-bosse ou des bosses prises à 21 m/s ;
    - pistes de 300, 600 et 6 000 m ;
    - mutants : « plat étoile après une rampe-saut », « refus des volcans sur la tranche précédente au lieu de la dernière tirée », « tolérance de 0,1 s » (le test des appuis perdus doit échouer) ;
    - `ANCIENNES_PISTES` au bit près ;
    - copain catapulté sur un plat étoile.
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 17 : Validation du papa et de Galahad.**
  - Questions :
    - Galahad comprend-il le bouton seul ?
    - Un saut raté se voit-il, et coûte-t-il quelque chose (saut §0) ?
    - Trouve-t-il les 3 étoiles hautes ?
    - Le saut « juste après une bosse » lui plaît-il ?
  - Puis commit `docs: tâche 5e validée, passation et registre`, `git status -sb`, push.

---

### Task 5g (ajoutée, v1.5) : Fosses de lave (volcans sans tremplin)

**Décisions du papa :**
- P8 (fosses, ≈ 1 volcan sur 2), P9 (promesse changée), P10 (pistes changées, empreinte recapturée par ruling) ;
- Q-F1 (8 m, franchissable à doigt posé), Q-F2 (option B : posée juste après la fosse), Q-F5 (rien ne s'allume), registre 10282e7.

La tolérance de sol (P11) est déjà en place (5e, Step 11).

**Spécification :** saut §6.1 à §6.5, §6.7 et §6.9. Les chiffres MESURÉS de la spec viennent de sondes jetables ; cette tâche les refait en tests.

**Files:**
- Create:
  - `tests/helpers/fosses.ts` :
    - `fossePiste` : piste plate à une fosse, avec en option des tranches avant (recette de saut §6.2 (a)) ;
    - `fosseRun` : Galahad seul, lancé à v ou arrêté, doigt posé, turbo forcé à un x, appui au pas k par le vrai `stepRace` ; il renvoie la lave, le passage, le x du saut et de l'atterrissage, la plus petite garde des roues au-dessus du capteur ;
    - `fosseWindow` : fenêtre par balayage de **chaque pas des 1,6 s qui précèdent la chute de la course témoin sans saut**, soit ≈ [bord − 1,6 s × v, bord] et 98 runs (pas de dichotomie : la continuité est vérifiée partout). Le premier pas balayé doit échouer, sinon la fenêtre déborde du balayage et le helper échoue (MESURÉ : elle s'ouvre au plus 1,47 s avant la chute, à 21 m/s tenus). Tour 1 : s'il passe, le balayage recule par blocs de 0,4 s, jusqu'à 2,8 s avant la chute (un turbo qui finit dans la fenêtre la fait durer jusqu'à 1,85 s, MESURÉ) ; Les morceaux plus tôt (sauts 35 à 54 m trop tôt, sauvés par un rebond) sont hors du balayage, ni exigés ni interdits ;
    - `fosseBlock` : pour la CI, le bloc de 0,4 s centré sur k*, premier pas où `fosseJumpWanted` est vrai sur la course témoin : 25 appuis, un par pas de [k* − 12, k* + 12] ;
    - `sauteurParfait(track, cfg)` : option `jump` de `simulateRace`, par `fosseJumpWanted`.
  - `tests/fosses.test.ts` (CI) ; `tests/slow/fosses-a.test.ts`, `tests/slow/fosses-fenetres-0-4.test.ts`, `tests/slow/fosses-fenetres-5-9.test.ts` (remplacés au tour 1 par `fosses-fenetres-vitesses`, `-terrain-0-7` et `-terrain-8-15`, Step 6), `tests/slow/race-sans-saut-0-11.test.ts`, `tests/slow/race-sans-saut-12-23.test.ts` ; `e2e/fosse.spec.ts`.
- Modify (code) :
  - `src/config.ts` : `FOSSE_PERIOD` 2, `FOSSE_WIDTH` 8, `FOSSE_GUARD` 20, `FOSSE_STAR_AFTER` 25, `FOSSE_JUMP_AIM` (Step 1), `FOSSE_RESPAWN_AFTER` 5, `FOSSE_GHOST_AFTER` 40 ; `STAR_TREMPLIN_LANDING` 55 et `STAR_FOSSE_LANDING` 22 (demande du papa : pas d'étoile basse avant l'atterrissage sur les réceptions) ; `STAR_STEP_MIN/MAX` **35 / 58** (Step 7, ruling ; 50 / 85 au plan) ; tour 1 : `FOSSE_JUMP_MIN_DISTANCE` 2 et `TREMPLIN_AFTER_DOUBLE_BOSSE` 0 (décision du papa : pas de tremplin juste après une double-bosse) ; tour 2 : `VOLCANO_WEIGHT` 4 (décision du papa : ≈ 3,6 volcans par course ; 3 dans `ANCIENNES_PISTES`).
  - `src/cars/safepoint.ts` (tour 1) : `forbiddenZone` d'une fosse prolongée jusqu'à `xReception + WHEEL_BASE/2 + WHEEL_RADIUS + 0,3` (≈ 1,5 m après le bord aval), pour tous les appelants : un châssis posé juste après le bord aval avait sa roue arrière dans le capteur.
  - `src/track/types.ts` : `'fosse'` ; `Volcano = Tremplin | Fosse` (champ `kind`, `xBord`).
  - `src/track/slices.ts` : `fosseGeometry`, `fosse` ; `SliceProfile.volcano` devient lui aussi une union.
  - `src/track/generate.ts` : phase tirée dans un `mulberry32` dédié, alternance, `kind` posé à l'ajout.
  - `src/track/query.ts` :
    - `tremplins`, `nextFosse` ;
    - `inElanZone` sur les tremplins seuls ;
    - `inGhostZone` : fosse jusqu'à bord aval + `FOSSE_GHOST_AFTER`.
  - `src/track/stars.ts` : zones admissibles (réception seule, moins ± `STAR_ELAN_GAP` autour de l'étoile de réception), étoile de réception, plancher, `highStarTerrain` sans les tranches `'fosse'`.
  - `src/cars/respawn.ts` : cible de 2e chute selon le type.
    - Tremplin : `xEnd − 10`, inchangée.
    - Fosse : bord aval + `FOSSE_RESPAWN_AFTER`. Le respawn groupé de cette cible avance (`shiftTarget` gagne un sens).
  - `src/cars/jump.ts` : `fosseJumpLead(v, cfg)` et `fosseJumpWanted` (purs).
  - `src/sim/simulate.ts` :
    - copains provisoires : `updateJump(sim, car, car.driver ? fosseJumpWanted(…) : galahadJump, …)`, sans erreur, remplacé en tâche 6 ;
    - `inElanZone` restreint aux tremplins.
  - `src/game.ts` : en `?debug=1`, `__game.respawns` : liste des réapparitions de Galahad (raison, t, x), pour l'e2e.
  - `src/physics/world.ts` : commentaire de `buildLava` (fosse : `rimY` 0, capteur à 0,3 m au-dessus du sol), code inchangé.
  - `src/render/track.ts` :
    - fosse : lave à ras bord, langues de feu jusqu'au haut du capteur, halo pulsé ;
    - panneau à ressort à `xLancement` des fosses ;
    - cône sombre et `xLip` réservés aux tremplins.
  - `src/render/effects.ts` : rien d'attendu (`xLava`, `rimY`), vérifié par test.
- Modify (tests) : « Migration des tests existants (v1.6) », lignes marquées **5g**, au Step indiqué.
- Test: `tests/fosses.test.ts`, `tests/generate.test.ts`, `tests/stars.test.ts`, `tests/high-stars.test.ts`, `tests/query.test.ts`, `tests/safepoint.test.ts`, `tests/respawn.test.ts`, `tests/world.test.ts`, `tests/render-smoke.test.ts`, `tests/effects.test.ts`, `tests/race-smoke.test.ts`, `tests/slow/fosses-a.test.ts`, `tests/slow/fosses-fenetres-*.test.ts`, `tests/slow/race-invariants-*.test.ts`, `tests/slow/race-sans-saut-*.test.ts`, `tests/slow/volcans-slow.test.ts`, `e2e/fosse.spec.ts`

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
/** Centre de la fenêtre, en s avant le bord amont, à la vitesse v : max(FOSSE_JUMP_MIN_DISTANCE / v, FOSSE_JUMP_AIM − FOSSE_WIDTH / (2 max(v, 1))) (saut §6.8 ; plancher au tour 1). */
export function fosseJumpLead(v: number, cfg: Config): number;
/** x dans [xLancement, xBord[ de la prochaine fosse et JUMP_BUFFER < (xBord − x) / max(v, 1) ≤ fosseJumpLead(v) (tour 1 : la demande ne déborde pas le bord). */
export function fosseJumpWanted(track: Track, x: number, v: number, cfg: Config): boolean;
// tests/helpers/fosses.ts
export function fosseRun(world: World, opts: { x0: number; v: number | 'arrêt'; pressAtStep: number | null; turboAtX?: number; cfg?: Config }):
  { lava: boolean; passed: boolean; jumpX: number | null; landX: number | null; minWheelGap: number };
/** Chaque pas des 1,6 s avant la chute de la course témoin sans saut ; échoue si le premier pas balayé passe. */
export function fosseWindow(world: World, f: Fosse, v: number | 'arrêt', opts?: { turboAtX?: number; cfg?: Config }):
  { seconds: number; pieces: number; sMin: number; sMax: number; centreLead: number; landMax: number; runs: number };
/** CI : k* = premier pas où fosseJumpWanted est vrai sur la course témoin ; appui à chaque pas de [k* − 12, k* + 12]. */
export function fosseBlock(world: World, f: Fosse, v: number | 'arrêt', opts?: { turboAtX?: number; cfg?: Config }):
  { kStar: number; leadStar: number; passed: number; runs: number };
```

**Règles de mise en œuvre :**
- **Générateur** : une `'rampe-volcan'` tirée et acceptée devient une fosse si (rang du volcan + phase) mod `FOSSE_PERIOD` = `FOSSE_PERIOD` − 1. Le rang compte tous les volcans, dans l'ordre de la piste.
  - La phase est tirée une fois par piste dans `mulberry32((seed ^ 0x6a09e667) >>> 0)`, seulement si `FOSSE_PERIOD` > 0 : avec 0, aucun appel.
  - Le `rng` principal ne voit aucun tirage de plus ; `fosse(cfg).length === rampeVolcan(cfg).length` est assertée.
  - Refus (saut §6.3) : jugés sur la dernière tranche tirée ; un volcan ne suit jamais une rampe-saut ni un autre volcan, quel que soit son type ; un **tremplin** ne suit jamais une double-bosse (tour 1, décision du papa ; le type du volcan suivant est connu avant le tirage, par l'alternance), une fosse le peut. Clé `TREMPLIN_AFTER_DOUBLE_BOSSE: 1` dans `ANCIENNES_PISTES`.
  - Poids de tirage d'un volcan : `VOLCANO_WEIGHT` (tour 2, décision du papa : 4 ; 3 dans `ANCIENNES_PISTES`, pistes d'avant au bit près) : 3,62 volcans par course (1 à 5), graines 0 à 49.
- **Capteur** : `buildLava` inchangé ; une fosse porte `rimY` = 0.
- **Copains provisoires** : demande de saut **à chaque pas** tant que `fosseJumpWanted` est vrai. `wantsJump` et `canJump` filtrent, comme pour Galahad, avec la tolérance de sol. Ce saut n'a pas d'erreur. La tâche 6 le remplace par le driver.
- **Galahad dans `Game`** : rien ne change, c'est l'enfant qui saute.

- [ ] **Step 0 : Décisions du papa consignées** (registre 10282e7) : Q-F1 8 m, Q-F2 option B, Q-F5 rien. Rien à demander.
- [ ] **Step 1 : Tests rouges statiques et purs.**
  - `tests/fosses.test.ts`, partie statique :
    - longueur égale à celle de la rampe-volcan ;
    - garde de 20 m, approche `LANCEMENT_LENGTH`, lave de 8 m ;
    - réception ≥ 60 m ;
    - bords sur la maille ;
    - hauteur 0 sur [début, xBord] et sur [xReception, xEnd] (aucune lèvre) ;
    - −`CRATER_DEPTH` dans la fosse ;
    - deux parois exemptées.
  - `tests/generate.test.ts` (graines 0 à 49, 1 680 m) :
    - volcans consécutifs de types différents ;
    - les deux phases présentes ;
    - au moins une fosse et un tremplin dès 2 volcans ;
    - aucun volcan après une rampe-saut ou un volcan (dernière tranche tirée) ;
    - [15 %, 90 %] ;
    - même suite de tranches tirées et mêmes x qu'avec `FOSSE_PERIOD` 0, à l'échange tremplin / fosse près ;
    - `FOSSE_PERIOD` 0 avec `ANCIENNES_PISTES` : sha1 des pistes inchangé.

    Le « 2 à 7 volcans » est déjà migré en 5e.
  - `tests/stars.test.ts`, `tests/high-stars.test.ts` :
    - aucune étoile basse dans [début de la tranche fosse, xReception) ;
    - étoile de réception à xReception + 25, tirée 1 fosse sur 2 ;
    - aucune autre étoile basse à moins de 3 m d'elle (trou de ± `STAR_ELAN_GAP` du curseur) ;
    - plancher dans l'ordre de la piste (élan ou réception) ;
    - aucune étoile haute dans une tranche fosse ;
    - 6 à 14 étoiles basses (graines 0 à 19).
  - `tests/query.test.ts`, `tests/safepoint.test.ts`, `tests/respawn.test.ts` (purs) :
    - `forbiddenZone` d'une fosse ;
    - `volcanoAhead` trouve une fosse ;
    - 2e chute de suite : bord aval + 5 ; recul groupé **vers l'aval** pour cette cible, 4 au plus ;
    - au plus 2 chutes par série ;
    - `inElanZone` faux sur toute la fosse ;
    - `inGhostZone` d'une fosse jusqu'à bord aval + 40 m ;
    - `nextFosse`.
  - `fosseJumpLead` et `fosseJumpWanted` (purs) : valeurs à 8, 11,2, 14 et 21 m/s (saut §6.8) ; faux hors [xLancement, xBord[.
  - Commande : `npx vitest run tests/fosses.test.ts tests/generate.test.ts tests/stars.test.ts tests/high-stars.test.ts tests/query.test.ts tests/safepoint.test.ts tests/respawn.test.ts`. Attendu : **ROUGE**.
- [ ] **Step 2 : Implémenter la piste et les règles, migrer, VERT.**
  - Implémentation : types, slices, generate, stars, query, respawn, `fosseJumpLead`, `fosseJumpWanted`, saut provisoire des copains.
  - **Dans ce même Step, avant le typecheck**, toutes les migrations « 5g S2 » du tableau :
    - **T** (tremplins seuls) : `query`, `safepoint`, `respawn`, `respawn-e2e`, `fantomes`, `world`, `observer`, `volcans` et `helpers/cases.ts`, `helpers/runs.ts`, `slow/volcans-slow`, `slow/saut-volcan-*` ;
    - **SP** (`sauteurParfait`) : `race-smoke`, `helpers/race.ts`, `slow/race-invariants-*`, `slow/finish`, `slow/stars-sim`, `slow/high-stars-sim`.

    Sans elles, le typecheck casse sur `xElanStart` et `xLip`, et les courses doigt posé tombent dans les fosses.
  - `npm run typecheck` liste chaque usage des champs du tremplin : on les restreint par `tremplins(track)` ou par un test sur `kind`. Ni `as`, ni `!` sans commentaire.
  - Commandes : les tests du Step 1, puis `npm run typecheck` et `npm test`, **verts**. L'empreinte `ANCIENNES_PISTES` ne bouge pas.
- [ ] **Step 3 : Tests physiques**, `tests/fosses.test.ts` (CI, une fosse de 8 m sur piste plate, monde rogné). **Seulement les cas qui discriminent : ≈ 25 s de CPU, plafond 60 s**, durée imprimée (budget en fin de plan). Ils passent en général dès le Step 2. Ceux qui échouent sont corrigés au Step 4 : rouge attendu jusqu'au Step 4.
  - **(a)** roulé sans saut à 3, 11,2, 14, 21 et 30 m/s : lave, châssis repris avant `xBord` ;
  - **(b), (c) bloc central** (`fosseBlock`), à 14 m/s, avec un turbo pris 40 m avant le bord, et au départ arrêté en `xLancement + SAFE_LANCEMENT_MARGIN − 0,01` : les 25 appuis de [k* − 12, k* + 12] (0,4 s, chaque pas) passent, sans respawn dans les 3 s après l'atterrissage. C'est l'exigence « 0,4 s d'un seul tenant », autour de l'instant visé par les copains. MESURÉ (sonde v1.6) : vert dans les 3 cas, k* à 0,62 / 0,72 / 0,55 s avant la chute du témoin, dans des fenêtres de 1,18 / 1,17 / 0,87 s ;
  - **à doigt posé seulement** : à 5 m/s, 13 appuis, tous les 0,05 s de 0 à 0,6 s avant la chute du témoin : aucun ne passe (MESURÉ : 0 sur 13, et 0 sur 97 à chaque pas) ;
  - `fosseJumpWanted` à 8, 11,2 et 21 m/s : passe (à 14 m/s, en turbo et au départ arrêté, c'est k* des blocs) ;
  - 2e chute de suite : posée à bord aval + 5, à l'arrêt ; une chute puis un retournement remettent la série à zéro ;
  - 5 voitures dans la fosse au même pas, point sûr `xLancement + 1` : 5 respawns en file, sans chevauchement, aucun `'speed'` ;
  - 5 voitures qui ratent toutes deux fois : posées à bord aval + 5, + 8,3, + 11,6… (recul vers l'aval), aucun `'speed'` ;
  - fantômes :
    - une voiture arrêtée au point sûr est traversée par une voiture lancée ;
    - une voiture posée à bord aval + 5 est traversée par une voiture qui atterrit ;
    - deux sauteurs qui se croisent en l'air ne se touchent pas ;
  - Galahad seul, doigt posé sans saut, sur la première graine de 0 à 9 qui a ≥ 2 fosses : exactement 2 chutes par fosse, 0 au tremplin, arrivée < 240 s. C'est la seule course complète du fichier (13,1 s), le plus gros poste.
  - **Hors CI** (Step 6) : fenêtres entières, 11,2 m/s, centres et (d) (`fosses-fenetres-*`) ; (a') double-bosse puis fosse en turbo, et son témoin vivant (`fosses-a`) ; courses avec `sauteurParfait` et à 5 voitures (`race-sans-saut-*`, `race-invariants-*` ; en CI, `race-smoke`, migré au Step 2, les couvre déjà).
  - Commande : `npx vitest run tests/fosses.test.ts` (durée notée).
- [ ] **Step 4 : Corriger** ce que le Step 3 a trouvé → **VERT**. Puis `npm test` : l'empreinte `ANCIENNES_PISTES` ne bouge pas.
- [ ] **Step 5 : Rendu et e2e.**
  - Dessin : lave à ras bord, langues de feu jusqu'au capteur, halo pulsé au temps de simulation, panneau à ressort.
  - `src/game.ts` : `__game.respawns` en `?debug=1`.
  - `tests/render-smoke.test.ts` :
    - une fosse et son panneau se dessinent sans erreur ;
    - aucun plot au-dessus de la lave ;
    - le cône sombre reste réservé aux tremplins.
  - `tests/effects.test.ts` : bulles d'une fosse au ras du sol.
  - `e2e/fosse.spec.ts` (`?seed=<graine figée dans le test, dont la 1re fosse est la plus proche du départ>&debug=1`) :
    - doigt tenu jusqu'à la fosse, deux captures : `e2e/screenshots/fosse-panneau.png` (le panneau, au début de l'approche) et `fosse.png` (lave, halo, langues de feu) ; la vue fait ≈ 22 m de large et le panneau est 32 m avant le bord : une seule image ne les montre pas ensemble ;
    - sans saut, `__game.respawns` reçoit deux réapparitions de raison `'lava'` ; la 2e pose Galahad après la fosse, et la course continue ;
    - pas d'assertion sur l'instant exact d'un saut à la main (Playwright n'est pas assez régulier) : le saut juste est couvert par (b) et (c).
  - Commande : `npm run e2e`.
- [ ] **Step 6 : Suite lente.**

  | Fichier | Contenu | Budget |
  |---|---|---|
  | `tests/slow/fosses-a.test.ts` | Chaque fosse des graines 0 à 19, Galahad lancé à V_MAX 100 m avant la tranche précédente, turbo pris tous les 2 m de 80 m avant cette tranche jusqu'à `xLancement`, sans saut : **100 % de lave** (≈ 3 400 runs, ≈ 14 min MESURÉ (relecture)). Le cas (a') de la v1.5 (double-bosse puis fosse, turbo) y est compris, sur les vraies pistes ; le mutant `FOSSE_GUARD` 0 y est mesuré et consigné. **Témoin vivant** : sur les pistes k = 6 et k = 14 de la recette (saut §6.2 (a)), sans garde et à W = 6, le même balayage en t retrouve au moins un survol (sonde : t = −20 m et t = +8 m ; ≈ 130 runs, ≈ 0,5 min). Sinon, le balayage ne prouve rien. | < 20 min |
  | `tests/slow/fosses-fenetres-vitesses.test.ts`, `-terrain-0-7.test.ts`, `-terrain-8-15.test.ts` (tour 1 ; remplacent `fosses-fenetres-0-4` et `-5-9`, dont les 18 fosses n'étaient que 4 trajectoires) | **Une seule fosse** (`fossePiste`), par `fosseWindow`, en faisant varier ce qui change la trajectoire : (b) 8, 11,2, 14, 17,5 et 21 m/s tenus, (c) départ arrêté au pire point sûr, (d) turbo pris 50 à 95 m avant le bord (pas de 5 m), saut d'étoile haute 80 et 90 m avant le bord (11,2, 14 m/s, turbo) ; puis la tranche d'avant prise en turbo, k = 0 à 15 de la recette du saut §6.2 (a), turbo 75 et 95 m avant le bord. Fenêtre principale ≥ 0,4 s d'un seul tenant, morceaux imprimés ; `fosseJumpLead(v)` à moins de 0,05 s du centre mesuré à vitesse tenue ; tout saut qui passe en turbo atterrit avant `xEnd − 10` ; le saut d'étoile haute retombe avant la fenêtre. 22 + 16 + 16 cas × 98 runs. | < 10 min chacun |
  | `tests/slow/race-invariants-*.test.ts` (migrés au Step 2) | 5 voitures, graines 0 à 23, Galahad doigt posé **avec** `sauteurParfait` : `lavaByCar.galahad === 0`, aucune chute propre, chutes classées par type de volcan. | inchangé |
  | `tests/slow/race-sans-saut-0-11.test.ts`, `-12-23.test.ts` | Galahad doigt posé **sans** saut, graines 0 à 23 : **seul** (saut §4) puis à **5 voitures**. Lave de Galahad = 2 × nombre de fosses, au plus 2 par série, 0 au tremplin, arrivée < 240 s ; copains provisoires 0 chute. Temps perdu par fosse imprimé, contre la même course avec `sauteurParfait` (attendu ≈ 4,3 à 4,6 s, option B). | < 15 min chacun |
  | `tests/slow/volcans-slow.test.ts` (complété) | Scénario (ii) : double-bosse puis tremplin, turbo à 21 m/s, doigt posé : 0 chute (sonde de la spec : 189 / 189). Tour 1 (plus de tremplin juste après une double-bosse) : double-bosse, une tranche, puis tremplin, turbo tous les 2 m de 80 m avant la double-bosse à sa fin : **0 chute, sans tolérance** ; témoin sur les pistes à règle levée (graine 7, turbo 31,8 m avant la double-bosse) : chute. Scénario (iii) : rampe-saut, plat, puis fosse, turbo : lave sans saut, passage avec `sauteurParfait`. | + 5 min |

  Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/fosses-a.test.ts tests/slow/fosses-fenetres-*.test.ts tests/slow/race-sans-saut-0-11.test.ts tests/slow/race-sans-saut-12-23.test.ts`, puis `npm run test:slow`.
- [ ] **Step 7 : Étoiles basses.** Pas [50, 85] (MESURÉ (relecture) : 8,52, de 6 à 12). On remesure avec le trou de ± 5 m autour de l'étoile de réception ; si la moyenne sort de [8, 12] ou si le minimum passe sous 6 : ruling au registre.
  - Fait (ruling du Step 7) : avec les dégagements de réception demandés par le papa (`STAR_TREMPLIN_LANDING` 55, `STAR_FOSSE_LANDING` 22), le pas [50, 85] donnait 6,50 (4 à 9) ; pas retenu **[35, 58]** : 8,50 (5 à 12 ; graines 0 à 19 : 6 à 12). Tour 1 (pas de tremplin juste après une double-bosse, moins de volcans) : 8,12 (5 à 12 ; graines 0 à 19 : 8,35, 6 à 12), pas gardé. Tour 2 (poids de tirage des volcans 4) : 8,50 (6 à 13 ; graines 0 à 19 : 8,60, 6 à 12), pas gardé.
- [ ] **Step 8 : Non-régression et empreinte.**
  - `ANCIENNES_PISTES` : empreinte, `PLAN_A_TRACE` et sha1 des pistes **inchangés**.
  - `CONFIG` : nouveaux hash dans `FROZEN_CONFIG`, ruling R-F10 (2e recapture, même contenu qu'en 5e).
  - Migrations restantes marquées **5g**.
  - `npm run typecheck`, `npm test` (chronométré, < 6 min), `npm run test:slow`, `npm run e2e`.
  - Rattrapage « après 5g » :
    - sur `ANCIENNES_PISTES` : contrôle de non-régression, identique à « après 5e » course par course, sinon c'est un défaut ;
    - sur `CONFIG` : mesure de l'effet, Galahad doigt posé avec et sans `sauteurParfait`.
- [ ] **Step 9 : Commit** `feat: fosses de lave (1 volcan sur 2), à franchir avec le bouton saut`.
- [ ] **Step 10 : Relectures.**
  - Relecture standard.
  - Relecture adversariale, avec ces sondes :
    - turbo pris sur des bosses ou une double-bosse avant une fosse, et rebond d'atterrissage au bord ;
    - appuis à chaque pas d'une fenêtre en turbo (tolérance de sol) ;
    - saut trop tôt qui retombe avant la fosse, puis second saut après le délai ;
    - saut au dernier pas permis, roue avant au coin du capteur ;
    - départ arrêté au pire point sûr, avec 4 autres voitures sur le même point sûr ;
    - 2e chute avec la cible occupée ;
    - copain retourné sur l'approche ;
    - fantômes à la sortie de la zone ;
    - doigt levé 2 à 3 s avant la fosse ;
    - `ANCIENNES_PISTES` au bit près ;
    - pistes de 300, 600 et 6 000 m ;
    - mutants : rebord surélevé de 5 cm, capteur à 0 m au lieu de 0,3 m, alternance remplacée par un tirage sur le `rng` principal, recul groupé vers l'amont pour la cible d'après la fosse ;
    - double-bosse puis tremplin à 21 m/s (promesse des tremplins).
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 11 : Validation du papa** (tablette, puis Galahad).
  - Montrer `fosse.png` et le tableau mesuré : fenêtres, chutes, temps perdu par fosse ratée.
  - Questions :
    - Galahad voit-il venir la fosse ?
    - Saute-t-il seul ?
    - La largeur est-elle juste ?
    - Une fosse ratée coûte-t-elle assez ?
    - Lève-t-il le doigt devant la lave (sous ≈ 6 m/s, la fosse est infranchissable) ?
  - Puis commit `docs: tâche 5g validée, passation et registre`, `git status -sb`, push.

---

### Task 6 : Conduite des robots (remplace la tâche 6 du plan v2.1)

**[fosses] v1.5 : sauts des copains aux fosses (saut §6.8, décision Q-F3).** Les amendements sont faits dans le texte même de la tâche, marqués « [fosses] ». La tâche s'exécute après la 5g : les pistes ont des fosses, et les copains y sautent déjà sans erreur (driver provisoire de la 5g). Cette tâche remplace ce saut par celui du driver.

**Files:**
- Create: `src/ai/driver.ts` (types `Driver` et `DriverContext`, et `makeRobotDriver`)
- Modify :
  - `src/cars/pilots.ts` : `jumpTry` et `jumpSkill` ; `GALAHAD` à 0 et 0.
  - `src/sim/simulate.ts` :
    - importe `Driver` et `DriverContext` de `ai/driver.ts` et ne les définit plus ;
    - `holdAfterStartDelay` remplacé par `makeRobotDriver` ;
    - garde « jamais de saut de robot dans `inNoJumpZone` » ;
    - commentaire du champ `ghost` mis à jour (zone jusqu'à la roue arrière, héritage de la 5b) ;
    - [fosses] le saut provisoire des copains aux fosses (5g) est **retiré** : c'est le driver qui saute ; `DriverContext.nextFosse` est rempli.
  - `src/track/query.ts` : `inNoJumpZone`, [fosses] sur les **tremplins** seulement.
  - `src/config.ts` :

    | Constante | Valeur |
    |---|---|
    | `POLITE_SPEED` | 2 |
    | `POLITE_GAP` | 4 |
    | `POLITE_MAX_WAIT` | 3 (ruling Q8) |
    | `LIFT_LOOKAHEAD` | 8 |
    | `LIFT_SECONDS` | 0,4 |
    | `JUMP_LOOKAHEAD` | 40 |
    | `JUMP_STAR_LEAD` | mesuré en 5e, Step 8 ; [fosses] 1,0 s (centre sur un plat étoile, 0,98 à 1,02 s quelle que soit la vitesse) |
    | `FOSSE_SKILL_FACTOR` | [fosses] **2,5** (Q-F3) |
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
  /** [fosses] Prochaine fosse devant, à moins de JUMP_LOOKAHEAD : bord amont, rang dans la piste, tentative (2 après une chute dans cette fosse, 1 sinon) ; null sinon. */
  nextFosse: { xBord: number; index: number; attempt: 1 | 2 } | null;
}
export type Driver = (ctx: DriverContext) => { throttle: boolean; jump: boolean };
export function makeRobotDriver(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): Driver;
// src/track/query.ts
export function inNoJumpZone(track: Track, x: number): boolean;   // x ∈ [xLancement, xReception] d'un volcan [fosses] à tremplin
// src/cars/jump.ts (5g) : centre de la fenêtre d'une fosse, en s avant le bord, à la vitesse v
export function fosseJumpLead(v: number, cfg: Config): number;
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
   - **saut interdit sur `[xLancement, xReception]`**, dans le driver **et** par la garde de `stepRace` pour toute voiture qui a un driver. [fosses] Pour un tremplin seulement.
   - [fosses] **Fosse** : saut de la fosse, toujours tenté (pas de tirage `jumpTry`).
     - L'instant visé est **centré à chaque vitesse** : le copain demande le saut dès que (`xBord − x`) / max(v, 1) ≤ `fosseJumpLead(v)` + e.
     - e est pré-tirée à la création du driver : N(0, `FOSSE_SKILL_FACTOR` × `jumpSkill`), **2 par fosse** (une par tentative), dans l'ordre de la piste, après les tirages des étoiles hautes (Box-Muller sur la graine du driver).
     - **Un seul saut par tentative** entre `xLancement` et le bord aval + 5 m. La demande, elle, est refaite à chaque pas jusqu'au saut (règle 6, « Maintien ») ; après le saut, plus aucune jusqu'à la tentative suivante (après une chute). Jamais de saut d'étoile dans une tranche fosse.
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
   - **Maintien** : la demande est tenue jusqu'au saut ou jusqu'au passage de l'étoile. `wantsJump` et `canJump` filtrent. [fosses] Concrètement, **le driver redemande le saut à chaque pas** tant qu'il est dans sa fenêtre (étoile ou fosse) et qu'il n'a pas sauté. Avec la tolérance de sol de 0,35 s, un rebond ne fait plus perdre la demande (saut §6.2).
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

- [ ] **Step 0 : Décisions du papa consignées** (registre 567ee13). Le tableau des traits est gardé (P4). [fosses] Q-F3 (registre 10282e7) : `FOSSE_SKILL_FACTOR` 2,5, instant visé centré à chaque vitesse.
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
      - **jamais `jump: true` dans `inNoJumpZone`** : balayage au pas de 0,1 m sur tous les volcans des graines 0 à 19, avec `jumpTry = 1` et des étoiles hautes fictives juste après chaque réception. [fosses] Sur les tremplins ; `inNoJumpZone` est faux sur toute une fosse.
    - [fosses] **saut de fosse** :
      - `jumpSkill = 0` : demande au premier pas où (`xBord − x`) / v ≤ `fosseJumpLead(v)`, à 8, 11,2, 14 et 21 m/s ;
      - redemandée à chaque pas jusqu'au saut ;
      - 2e tentative (après une chute) : 2e erreur pré-tirée ;
      - jamais deux sauts dans la même approche ;
      - `jumpTry = 0` : la fosse est quand même sautée.
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
- [ ] **Step 3 : Mesures, suite lente** (`tests/slow/robots-sauts-*.test.ts`, moins de 30 min par fichier). 5 voitures, graines 0 à 47, Galahad doigt posé [fosses] **avec `sauteurParfait`** aux fosses.
  - **Aucun saut de copain en zone volcan** : 0 `'jump'` de robot avec `inNoJumpZone(x)`.
  - **Fonceurs contre prudents**, en appariement par graine. Par bras, on compte :
    - tentatives ;
    - étoiles prises au saut ;
    - ratés (saut sans étoile dans les 2,5 s) ;
    - respawns dans les 3 s.

    Assertions : au moins 40 tentatives par bras, et taux de raté « Pablo » > taux de raté « Timothé ». On imprime aussi les chiffres du tirage normal, pilote par pilote.
  - [fosses] **Fosses**, mêmes bras appariés :
    - chutes par tentative, **vitesse par vitesse** (vitesse au saut par tranches de 2 m/s, et départ arrêté après une chute) ;
    - comparées au CALCULÉ de saut §6.8 : Pablo 19 à 34 % selon la vitesse, prudents ≈ 0 ;
    - ≈ 1,8 fosse × 4 copains × 48 graines ≈ 350 tentatives par bras, au-dessus du seuil de 40 ;
    - assertion : raté « Pablo » > raté « Timothé ». Les taux mesurés vont au registre et au papa (validation, Step 9).
  - **Déterminisme** : graine 3 jouée deux fois, même empreinte finale et même liste de `'jump'`.
  - **Invariants** :
    - au plus 3 respawns par robot ; [fosses] **hors chutes dans une fosse**, et au plus 2 chutes par série à une fosse (la 2e pose la voiture juste après) ;
    - blocage d'au plus 2,1 s ;
    - `lavaByCar.galahad === 0` ([fosses] Galahad avec `sauteurParfait`) ;
    - `ghostContacts === 0` ;
    - [fosses] chute d'un copain dans une fosse classée « fosse » (attendue) ; une chute propre à un tremplin reste un échec.

    Si les sauts font dépasser 3 respawns : on mesure, et le papa choisit entre baisser `jumpTry` et accepter. On ne relâche rien en silence.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/robots-sauts-0-23.test.ts tests/slow/robots-sauts-24-47.test.ts`.
- [ ] **Step 4 : Seuils de politesse.**
  - Sonde « grille » : Galahad arrêté 10 s, puis doigt posé, graines 0 à 4.
  - Sonde « bouchon » : un copain retourné ou arrêté au milieu d'un plat.
  - Fixer `POLITE_SPEED` et `POLITE_GAP`, et les consigner au registre.
  - Puis `npx vitest run tests/race-smoke.test.ts` et `npm run e2e`, avec la fenêtre « sans doigt » de 2 s.
- [ ] **Step 5 : Rattrapage « après 6 ».**
  - Relancer `rattrapage-*` et comparer, graine par graine : **avant la 5d, après la 5d, après la 5e, après la 5g, après la 6**. [fosses] Les comparaisons appariées se font sur `ANCIENNES_PISTES` ; l'effet des fosses et des plats étoile se lit sur `CONFIG`, à partir des mesures « après 5e » et « après 5g ».
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
    - turbo pendant l'approche (`JUMP_STAR_LEAD`, [fosses] `fosseJumpLead`) ;
    - [fosses] copain qui rate une fosse deux fois, puis posé juste après ; deux copains qui sautent la même fosse ;
    - allocations de `others` par pas ;
    - absence de cycle d'import.
  - `code-review` sur le diff.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 9 : Validation du papa** (tablette, 5 voitures) :
  - Les copains sautent-ils de façon crédible ?
  - La course est-elle encore jouée d'avance ?
  - [fosses] Les copains tombent-ils parfois dans une fosse, de façon crédible (taux mesurés du Step 3) ?

  Puis commit `docs: tâche 6 validée, passation et registre`, `git status -sb`, push. On enchaîne sur la tâche 7 du plan v2.1. Après les tâches 6 et 7, le papa rejuge la difficulté (`ENGINE_BRAKE`, plan C).

---

### Task 7 (v1.7) : Élastique (remplace la tâche 7 du plan v2.1)

**Statut.**
- v1 (2026-10-23) : écrit en lecture seule sur `wip-plan-b` à 5a3f0fb.
- v2 : corrigé après la relecture standard (I1 à I6, M1 à M9) et la relecture adversariale (I1, I2, M1 à M4). La correspondance est à l'annexe C.
- **v3 : décisions du papa du 2026-10-23 intégrées** dans le texte même de la tâche (§ « Décisions du papa »).
- v3.1 : re-relecture de la v3 ; N1 corrigé par le ruling R7-16 (plafond du turbo hors écran, même définition de l'écran que le compteur) et deux mineurs.
- v1.7 du plan (2026-10-23) : ce texte, intégré tel quel ; corrections du § « Corrections à reporter » faites avec la doc de la tâche.

**Prérequis.**
- La tâche 6 est validée et fusionnée, tour de correction 3 compris (graine du « Galahad sauteur » salée pour ne plus être corrélée à `drawPilots` ; chutes par volcan comptées à une seule source).
- BASE = le dernier commit de la tâche 6, noté au registre.
- **Toutes les mesures « avant » se font à BASE.** Celles du tour 1 de la 6 (registre l. 209) ne servent que de repères.

**Pourquoi un amendement.** La tâche 7 du plan v2.1 date d'avant la course à 5 voitures (5b), le saut fiabilisé (5c), le rendu interpolé (5f), les étoiles pour tous (5d), le bouton saut et les plats étoile (5e), les fosses (5g) et la conduite des robots (6).
- Sa liste de consommateurs d'`applyDrive` est fausse.
- Elle ne dit rien des fosses.
- Son objectif mesuré suppose « doigt posé = jamais de chute », ce qui n'est plus vrai depuis P9.
- La passation demande de mesurer « ce que le bouton rend à Galahad ».
- **Mesuré, l'élastique tel qu'écrit au plan v2.1 rendait la course jouée d'avance et vidait l'écran** (§ 0.2). D'où les décisions D7-2 et D7-3.

**Conventions des chiffres** (comme saut §6.0) :
- **MESURÉ (registre, l. n)** : registre `sdd-ledger-plan-b.md`.
- **MESURÉ (adversaire)** : relecture adversariale du brouillon : prototype de l'élastique câblé dans `stepRace`, courses `fiveCarRace` (CONFIG, saut parfait), émulations avec phases (`scratchpad/r7-sondes/`).
- **MESURÉ (sonde du brouillon)** : tour 1 (annexe A, une trajectoire par cas) et tour 2 (annexe B, options de fenêtre et de `base` sur le prototype de l'adversaire).
- **CALCULÉ** : formule donnée. **ESTIMÉ** : jugement, à remplacer par une mesure de la tâche.
- Bruit : sur 10 courses, ± 1,6 victoire d'écart-type à p = 0,5 ; sur 20 courses, ± 2,2 (CALCULÉ, binomiale).

---

#### Décisions du papa (2026-10-23)

Le papa a retenu toutes les recommandations du brouillon v2. Les options écartées ne sont plus dans le plan.

| # | Question | Décision | Mesures qui l'ont fondée |
|---|---|---|---|
| D7-1 | Quel Galahad sert de référence pour l'objectif ? | **Doigt posé, saut parfait à chaque fosse, jamais de saut d'étoile** | joueur modèle des invariants depuis la 5g (P9) ; 12/48 victoires au tour 1 de la 6 (registre l. 209) |
| D7-2 | Forme de la fenêtre | **La fenêtre est la vue : 20 m devant, 3 m derrière** (`RUBBER_WINDOW_AHEAD_M` 20, `RUBBER_WINDOW_BEHIND_M` 3) | Copain à l'écran 14 % du temps avec la fenêtre de 12 m, 40 % sans élastique, 32 % avec 20/3 et les `base` d'avant (MESURÉ). Avec 12 m, la marche du turbo était visible |
| D7-3 | Caractère de vitesse des copains | **`base` regroupées entre 0,97 et 1,00, dans le même ordre** : Pablo 1,00, Matthis 0,995, Malo 0,9875, Diego 0,985, Liam 0,975, Timothé 0,97. Le caractère reste porté par `lift`, `jumpTry` et `jumpSkill` | Avec les `base` d'avant et la fenêtre de 12 m, Galahad gagnait 19/20 (adversaire). Avec D7-2 et D7-3 : Galahad 1er 4/10, 1er ou 2e 8/10, dernier 0, place 1,80, **copain à l'écran 49 % (31 à 97 %)** (sonde du brouillon, graines 0 à 9) |
| D7-4 | Cibles de l'objectif | **Le spec (1er ou 2e ≥ 10/20, dernier ≤ 2/20, ≤ 3 réapparitions par copain), plus Galahad 1er dans 5 à 15 des 20 courses, et un copain à l'écran au moins 30 % du temps en moyenne** | même ligne que D7-3 |
| D7-5 | Cibles des autres variantes | **Sauteur** : place moyenne ≤ celle du modèle D7-1, sur les mêmes graines. **Doigt levé 30 %** : imprimé, seules les limites des copains sont exigées. **Sans saut** : imprimé par le rattrapage et `test:slow:bouton` | doigt levé, élastique du plan v2.1 : 2/10, dernier 2 fois, place 3,0 (adversaire) |

**Règle qui reste.** Hors cible, on montre les chiffres au papa ; aucun levier sans lui (R7-14).

---

#### 0. Ce que la tâche change, et pourquoi

##### 0.1 Pour un copain (règles du spec, décisions D7-2 et D7-3)

Galahad ne change pas : 14 m/s doigt posé, turbo 21 m/s, couple 1 (addendum §2 [plan]).

| Copain | Aujourd'hui (tâche 6) | Après la tâche 7 |
|---|---|---|
| dans la fenêtre (de 3 m derrière Galahad à 20 m devant), sans turbo | 14 m/s, couple 1 | `base` × 14 : 13,6 (Timothé, 0,97) à 14,0 m/s (Pablo, 1,00), couple × `base` |
| loin devant (> 20 m) | 14 m/s | jusqu'à 8,4 m/s (0,6), couple × 0,6 ; facteur remonté vers 1,0 dans les 40 m de pré-zone, au moins 1,0 dans `[xLancement, xLava]` |
| loin derrière (> 3 m) | 14 m/s | jusqu'à 18,2 m/s (1,3), couple × 1,3 |
| en turbo | 21 m/s, couple 1 | min(1,3 ; élastique × 1,5) au plafond **et** au couple, donc ≤ 18,2 m/s ; ≤ 14 m/s hors écran devant Galahad (au-delà de 11,2 + 0,6 v + 1,6 m, v sa vitesse : 21,2 m à 14 m/s, R7-16), flammes gardées (spec §7) |

- **Équilibre sans étoile** (CALCULÉ : là où la cible vaut 1,0, soit 3 + 40 × (1 − `base`) / (1,3 − `base`) m derrière Galahad doigt posé) : de 3 m (Pablo) à 6,6 m (Timothé). C'est au bord de la vue : 2,8 m derrière Galahad à 14 m/s. Avec la fenêtre de 12 m et les `base` d'avant, c'était 14,5 à 24,7 m, hors de la vue.
- **Vitesse maximale conduite d'un copain.**
  - 18,2 m/s CALCULÉ (14 × 1,3) ; 18,8 m/s MESURÉ (sonde du brouillon, facteur 1,3 tenu, pentes comprises) ; facteur maximal 1,30 sur 60 courses (MESURÉ, adversaire). Elle ne vaut pas 27,3 m/s (R7-1).
  - Ce n'est pas la vitesse maximale du châssis (MESURÉ, adversaire) : juste après un contact entre voitures, vx atteint 21,4 à 21,8 m/s ; en descente, la vitesse totale monte jusqu'à 25 m/s. La règle des catapultes (R-F12) couvre ces cas, et la suite lente les imprime (Step 5).
- **Enveloppe.** La vitesse conduite d'un copain (≤ 18,8 m/s) reste dans celle de Galahad en turbo (21 m/s), déjà mesurée pour les fosses, les tremplins et les plats étoile. Ce qui est neuf : le couple × 1,3 ou × 0,6, et le 1,3 **tenu** (le turbo de Galahad dure 3 s).

##### 0.2 Ce que l'élastique fait à la course (MESURÉ)

- Conditions : graines 0 à 9, sauf mention ; Galahad doigt posé avec le saut parfait aux fosses ; 5 voitures ; `CONFIG`.
- « Copain à l'écran » : part du temps (après les 5 s neutres, avant l'arrivée de Galahad) où au moins un copain est dans [0,6 v − 12,8 ; 0,6 v + 12,8] m de Galahad (v sa vitesse). C'est la vue de 1 280 × 800 (11,2 m de demi-largeur, avance de caméra 0,6 s × v) plus 1,6 m ; définition de l'adversaire.
- La tâche en fait **une seule fonction pure, `onScreen(gap, vGalahad, cfg)`** (§ Interfaces). Elle sert à la fois au plafond « ≤ 1 hors écran devant » de `finalFactor` (R7-16), au compteur « freinage net » et à la part « copain à l'écran » (Steps 2 et 5).

| Réglage | Galahad 1er | 1er ou 2e | dernier | place moyenne | copain à l'écran (moyenne, min–max) | Source |
|---|---|---|---|---|---|---|
| sans élastique (code de la 6) | 5/10 | 6/10 | 0 | 2,00 | 40 % (4 à 86) | adversaire |
| plan v2.1 : `base` d'avant, fenêtre 12/12 | 9/10 (19/20 sur 0 à 19) | 10/10 (20/20) | 0 | 1,10 (1,05) | 14 % (0 à 42) | adversaire |
| `base` d'avant, fenêtre 20/3 | 4/10 | 8/10 | 0 | 1,90 | 32 % (1 à 90) | sonde du brouillon |
| **décidé : `base` 0,97 à 1,00, fenêtre 20/3** | **4/10** | **8/10** | **0** | **1,80** | **49 % (31 à 97)** | sonde du brouillon |
| plan v2.1, Galahad doigt levé 30 % | 2/10 | 3/10 | 2 | 3,0 | — | adversaire |

**La physique tient** (MESURÉ, adversaire, fenêtre de 12 m) : aucune chute aux tremplins, aucune étoile haute prise sans saut, aucun choc plus fort. Le Step 4 la remesure avec la fenêtre décidée.

---

**Files:**
- Create :
  - `src/ai/rubberband.ts` : élastique, pur.
  - `tests/rubberband.test.ts` : pur, CI.
  - `tests/elastique.test.ts` : simulations courtes, CI.
  - `tests/slow/elastique-volcans.test.ts` : Review Focus n° 3, tremplins à 1,3 avec phases, marche au pied, fosses, plats étoile, départ à 0,6, Galahad arrêté.
  - `tests/slow/race-objective.test.ts` : modèle D7-1 et sauteur, 2 × 20 courses.
  - `tests/slow/race-objective-leve.test.ts` : doigt levé 30 %, 10 courses.
  - `tests/helpers/objective.ts` : lignes, tableau, cibles de D7-4 et D7-5, compteurs « copain à l'écran » et « freinage net à l'écran ». Réutilise `fiveCarRace` et la forme `RattrapageRow`.
  - `tests/slow/bouton.test.ts` et `vitest.slow-bouton.config.ts`, script `test:slow:bouton` : « ce que le bouton rend » (Step 6).
- Modify :
  - `src/physics/car.ts` : `applyDrive`, nouvelle signature (§ Interfaces).
  - `src/sim/simulate.ts` :
    - champs `CarSim.rubber`, `speedFactor`, `torqueFactor` ;
    - élastique de chaque copain avant `applyDrive` ;
    - commentaire du champ `factor` réécrit (« 1 en 5b » est périmé).
  - `src/track/query.ts` : `inVolcanoZone(track, x)`, utilisée par le driver (sa copie locale, `driver.ts:158`, disparaît) et par l'élastique.
  - `src/ai/driver.ts` : appel de `inVolcanoZone`, aucun changement de règle.
  - `src/config.ts` : constantes `RUBBER_*` (§ Constantes).
  - **`src/cars/pilots.ts`** : `base` du papa (D7-3), commentaire du champ (« [0,97 ; 1], décision du papa du 2026-10-23 ») ; **`tests/pilots.test.ts`** : bornes, valeurs, ordre (Step 2).
  - Tests à migrer :
    - `tests/helpers/runs.ts` (`step`), `tests/car.test.ts`, `tests/bounce.test.ts` ;
    - `tests/helpers/jump-runs.ts` : littéral `CarSim`, et `launchSolo` qui coupe l'élastique ;
    - `tests/fantomes.test.ts` : copains à vitesse imposée ;
    - `tests/query.test.ts` : `inVolcanoZone` ;
    - `tests/smoke.test.ts` : constantes ;
    - `tests/helpers/rattrapage.ts` : indicateurs « 1er ou 2e » et « dernier », et lecteur pour `bouton.test.ts`.
  - `tests/helpers/robots-sauts.ts` : assertion nouvelle, au Step 4.
  - `package.json` et configs de Vitest :
    - `vitest.slow-race.config.ts` : `include: ['tests/slow/race-objective*.test.ts']` ;
    - `vitest.slow.config.ts` : `exclude` de ce glob et de `tests/slow/bouton.test.ts` ;
    - `vitest.slow-bouton.config.ts` : nouveau ;
    - script `test:slow:bouton`.
  - Documents : § « Corrections à reporter ».
- Test :
  - CI : `tests/rubberband.test.ts`, `tests/pilots.test.ts`, `tests/query.test.ts`, `tests/car.test.ts`, `tests/elastique.test.ts`, `tests/race-smoke.test.ts` (inchangé, élastique actif).
  - Lent : `tests/slow/elastique-volcans.test.ts` et `tests/slow/race-objective*.test.ts`.
  - Lent, relancés : liste du Step 6.

**Interfaces :**
```ts
// src/physics/car.ts : positionnel, aucun objet alloué par pas. Le compilateur signale les 8 appels (grep à BASE :
// src/sim/simulate.ts, tests/helpers/runs.ts, tests/car.test.ts ×5, tests/bounce.test.ts). Les mentions dans des
// commentaires (phases.ts, phases-dense.test.ts, game-frame.test.ts, runs.ts) ne changent pas.
export function applyDrive(car: CarBody, throttle: boolean, speedFactor: number, torqueFactor: number, cfg: Config): void;
//   omegaMax = V_MAX × speedFactor ; montée de rotation = WHEEL_SPINUP × torqueFactor (x × 1 = x : Galahad au bit près)

// src/ai/rubberband.ts (pur ; import type de Track et Config ; query.ts). Arguments positionnels : aucune allocation par pas.
// Wa = RUBBER_WINDOW_AHEAD_M (20), Wb = RUBBER_WINDOW_BEHIND_M (3), R = RUBBER_RAMP_M (40).
export function targetFactor(gap: number /* xCopain − xGalahad, m */, base: number, cfg: Config): number;
//   base sur [−Wb, Wa] ; de base à RUBBER_MIN, linéaire, sur [Wa, Wa + R] ; de base à RUBBER_MAX sur [−(Wb + R), −Wb] ;
//   constante au-delà (R7-15)
export function rampFactor(prev: number, target: number, dt: number, cfg: Config): number; // |Δ| ≤ RUBBER_RATE_PER_S × dt
export function zoneFloor(track: Track, x: number, cfg: Config): number;
//   1 dans [xLancement − RUBBER_PREZONE_M, xLava] d'un volcan (tremplin ou fosse ; xLancement d'une fosse = début de
//   l'approche, la garde est dans la pré-zone), 0 sinon
// Vue de référence (R7-16) : écran de 1 280 × 800, caméra en avance de CAMERA_LEAD_SECONDS × vGalahad (vitesse du châssis
// de Galahad au début du pas, `carSpeedMps`, comme `cameraTarget`). Une seule définition, partagée par l'élastique et les tests.
export function screenAheadEdge(vGalahad: number, cfg: Config): number;  // SCREEN_REF_HALF_WIDTH_M + CAMERA_LEAD_SECONDS × v + SCREEN_EDGE_MARGIN_M (21,2 m à 14 m/s)
export function screenBehindEdge(vGalahad: number, cfg: Config): number; // CAMERA_LEAD_SECONDS × v − SCREEN_REF_HALF_WIDTH_M − SCREEN_EDGE_MARGIN_M (−4,4 m à 14 m/s)
export function onScreen(gap: number, vGalahad: number, cfg: Config): boolean; // screenBehindEdge ≤ gap ≤ screenAheadEdge
export function finalFactor(rubber: number, turbo: number, gap: number, vGalahad: number, cfg: Config): number;
//   min(RUBBER_MAX, rubber × turbo) ; si gap > screenAheadEdge(vGalahad) (copain hors écran devant) : min(·, 1).
//   Reçoit donc la vitesse de Galahad. La fenêtre de targetFactor (20 m / 3 m) ne bouge pas.
export function stepRubber(prev: number, t: number, gap: number, base: number, x: number, track: Track, cfg: Config): number;
//   règles 1 à 4 ci-dessous, dans cet ordre

// src/track/query.ts
export function inVolcanoZone(track: Track, x: number): boolean; // [xLancement, xLava] d'un tremplin ou d'une fosse, sans allocation

// src/sim/simulate.ts : CarSim gagne
rubber: number | null;  // élastique après rampe (copain : 1 à la création) ; null = coupé (Galahad toujours ; copain dont un test impose `factor`)
speedFactor: number;    // facteurs appliqués au dernier pas, pour TOUTE voiture (mesures, tests)
torqueFactor: number;   // Galahad : 1 toujours
onScreen: boolean;      // copain à l'écran au début du pas (onScreen(gap, vGalahad)), les valeurs mêmes de finalFactor ; faux pour Galahad
// `factor` garde son rôle : multiplicateur imposé du plafond (tests, mesures ; 1 en jeu), lu seulement quand rubber === null.

// src/cars/pilots.ts (D7-3) : base = 1,00 (Pablo), 0,995 (Matthis), 0,9875 (Malo), 0,985 (Diego), 0,975 (Liam), 0,97 (Timothé)
```
`Driver`, `DriverContext` et `makeRobotDriver` ne changent pas.

**Règles** (spec §7, addendum §1.8 et §2, plan v2.1, décisions D7-2 et D7-3), à chaque pas, pour chaque voiture pas encore arrivée, **avant** `applyDrive` :
- **Voiture sans élastique** (`rubber === null` : Galahad, ou un copain d'un test) : `applyDrive(body, throttle, turbo × factor, 1, cfg)`, puis `speedFactor = turbo × factor` et `torqueFactor = 1`. C'est exactement le pas d'aujourd'hui.
- **Copain sous élastique.** L'écart vaut `gap = x(copain) − x(Galahad)`, x du châssis au début du pas : aucune voiture n'a bougé dans le pas, donc l'ordre des voitures ne compte pas. Puis, dans l'ordre :
  1. **Cible.** 1,0 tant que `t < RUBBER_NEUTRAL_SECONDS`, sinon `targetFactor(gap, pilot.base)` : `base` de 3 m derrière Galahad à 20 m devant.
  2. **Plancher.** cible = max(cible, `zoneFloor(track, x)`).
  3. **Rampe.** `rubber = rampFactor(rubber, cible, PHYSICS_DT)`.
  4. **Clamp de zone.** Si `inVolcanoZone(track, x)` : `rubber = max(rubber, 1)`, immédiat et **stocké** (R7-5). Il agit surtout sur un copain réapparu dans la zone avec un facteur < 1 ; ailleurs, la pré-zone suffit (2,7 s depuis 0,6, CALCULÉ).
  5. **Facteur final.** `vG` = vitesse du châssis de Galahad au début du pas (instantané). `f = finalFactor(rubber, turboFactor(state, t), gap, vG)`, puis `applyDrive(body, throttle, f, f, cfg)`, `speedFactor = torqueFactor = f` et `onScreen = onScreen(gap, vG)`.
- **Ce que le taux ne borne pas.** Seul l'élastique est limité à 0,15/s ; ces marches restent :
  - le début et la fin d'un turbo, comme pour Galahad (flammes qui s'allument ou s'éteignent, R7-6) ;
  - le clamp de zone (étape 4), qui ne fait que monter ;
  - le plafond « ≤ 1 hors écran devant » (R7-16). Il tombe **toujours hors de la vue** : le copain passe le bord avant de l'écran (21,2 m à 14 m/s, 25,4 m quand Galahad roule à 21 m/s), quelle que soit la vitesse de Galahad.
  - Sa levée, quand le copain revient dans la vue, relève seulement le plafond. Le copain accélère alors à son couple ; ce n'est pas un freinage.
- **Voiture arrivée.** Elle freine (pas inchangé) ; son élastique est figé.
- **Réapparition.** L'élastique est gardé ; le plancher et le clamp font le reste.
- **Interactions avec la tâche 6** (driver inchangé) :
  - un copain poli lève le pied : son facteur ne compte plus pendant l'attente, et il repart avec le facteur du moment ;
  - lever de pied avant une rampe-saut ou une double-bosse : inchangé ; un copain à 1,3 y arrive à 18,2 m/s au plus, dans l'enveloppe de Galahad en turbo ;
  - fosses : le driver vise avec sa **vitesse réelle** (`fosseJumpLead(v)`) ; l'élastique ne touche ni l'instant visé ni l'erreur.

**Constantes** (`src/config.ts`) :

| Constante | Valeur | Rôle |
|---|---|---|
| `RUBBER_WINDOW_AHEAD_M` | 20 | m devant Galahad où le facteur vaut `base` (D7-2 : 11,2 + 0,6 × 14 = 19,6 m visibles à `V_MAX`) |
| `RUBBER_WINDOW_BEHIND_M` | 3 | m derrière Galahad (D7-2 : 2,8 m visibles à `V_MAX`) |
| `RUBBER_RAMP_M` | 40 | m : de `base` à la borne (R7-15) |
| `RUBBER_MIN` | 0,6 | spec §7 |
| `RUBBER_MAX` | 1,3 | spec §7 ; aussi le plafond total du turbo d'un copain |
| `RUBBER_RATE_PER_S` | 0,15 | spec §7 : à 14 m/s, une baisse coûte au plus 2,1 m/s² (CALCULÉ) |
| `RUBBER_NEUTRAL_SECONDS` | 5 | spec §6 « Collisions » |
| `RUBBER_PREZONE_M` | 40 | addendum §1.8 : de 0,6 à 1,0 en 2,7 s |
| `SCREEN_REF_HALF_WIDTH_M` | 11,2 (dérivée : `VISIBLE_HEIGHT_M` × 1 280 / 800 / 2, déclarée avant le littéral comme `D_LANCE`) | m : demi-largeur de la vue de référence (tablette 1 280 × 800), R7-16 |
| `SCREEN_EDGE_MARGIN_M` | 1,6 | m : marge pour qu'un copain « hors écran » le soit en entier (définition de l'adversaire, § 0.2), R7-16 |

`RUBBER_WINDOW_M` (12, plan v2.1) n'est pas créée. La demi-largeur visible suit la forme de l'écran (`visibleHalfWidthM`) : 11,2 m en 1 280 × 800, 12,4 m en 16:9. Les 20 m sont calculés pour la tablette.

**Aucun levier sans le papa** (R7-14). `base`, bornes, taux, neutre, pré-zone, fenêtre et rampe sont des valeurs validées. Si une cible du Step 5 n'est pas tenue : on mesure, on montre les chiffres au papa, et le papa choisit.

**Galahad seul : identique au bit près**, avec `ANCIENNES_PISTES` comme avec `CONFIG` (`tests/empreinte.test.ts`, `PLAN_A_TRACE`).
- Sans copain, aucun élastique ne tourne, et les `base` ne sont pas lues.
- Le pas de Galahad calcule `turbo × factor` comme aujourd'hui, avec `factor = 1`.
- Le couple vaut `WHEEL_SPINUP × 1`, exact en flottant.
- MESURÉ (adversaire) : 6 empreintes sur 6 identiques avec le couple positionnel.
- Ligne à ajouter au tableau « Galahad seul » des Global Constraints : « 7 | **identique** | l'élastique ne s'applique qu'aux copains ; Galahad : couple × 1 ».

**Ce qui doit être mesuré, et les garde-fous.**

Un garde-fou ne s'applique jamais d'office. Formulation commune : « si la mesure du Step n est mauvaise, on mesure les options et le papa choisit », car chacune change une valeur validée.

| Sujet | Déjà su | À mesurer dans la tâche | Si la mesure est mauvaise (papa) |
|---|---|---|---|
| **Review Focus n° 3** : copain freiné à 0,6 loin devant qui aborde un volcan | MESURÉ :<br>• sonde du brouillon : 17 tremplins, 0 chute, 12,0 à 14,0 m/s à `xLancement`, sommet ≥ 12,6 m/s ; 18 fosses, saut centré, 0 chute ;<br>• adversaire, 10 phases : 0 chute sur 180 aux fosses, 13,9 à 14,1 m/s au bord ;<br>• même résultat avec une pré-zone qui part de `xLancement − 40` ou du début de la garde − 40 | Step 4 (vrai élastique, tous les volcans des graines 0 à 9) :<br>• facteur appliqué ≥ 1,0 à chaque pas de `[xLancement, xLava]` ;<br>• tremplin : pas de lave, sommet ≥ `LIP_SPEED_THRESHOLD` + 1 ;<br>• fosse : le saut d'un copain sans erreur passe ;<br>• variante « réapparu à `xLancement` + 1 avec 0,6 » : clamp au 1er pas | pré-zone plus longue, ou partant du début de la garde |
| **Tremplins** : copain à 1,3 (plafond et couple), « doigt posé, jamais de chute » | MESURÉ (adversaire, émulation avec phases) :<br>• 510 runs (arrêt au pire point sûr, arrêt en − 30, lancée à 18,2 m/s) : 0 lave, 0 retournement, garde ≥ 3,72 m, marge ≥ 27,4 m avant `xEnd` ;<br>• **marche 1,3 → 1,0 au pied**, balayée au pas de 1 m de `xLancement − 10` au sommet, lancée en − 45 et − 50, 1 836 runs : 0 lave, garde ≥ 1,84 m (Galahad en fin de turbo : 0,63 m), sommet ≥ 12,2 m/s ;<br>• facteur qui redescend dès `xLava`, 170 runs : 0 réapparition, angle ≤ 10° | Step 4 :<br>• mêmes familles, départs arrêtés décalés de 0,05 m, départs lancés de 0,37 m ;<br>• balayage de la marche au pied ;<br>• exigé : 0 chute, atterrissage avant `xEnd − 10`, garde ≥ 0,3 m (seuil de la 5c) ; garde minimale imprimée.<br>Step 6 : `race-invariants` (0 chute propre au tremplin, toutes voitures) | facteur plafonné à 1,0 dans `[xLancement, xLava]` (addendum §1.8 : « ≥ 1,0 »), ou couple plafonné à 1 en zone (spec §7) |
| **Fosses** : fenêtre, ratés, atterrissage | La tranche 20–22 m/s de la tâche 6 (fonceurs 13,8 %, registre l. 209) disparaît.<br>Ratés CALCULÉS (demi-fenêtre MESURÉE à 17,5 m/s, 0,665 s, saut §6.2 ; loi normale) : Pablo 14 %, Matthis 7,6 %, Diego 0,8 %, Malo 0,3 %, prudents 0 ; à 14 m/s : 19 / 12 / 1,8 / 0,9 % (saut §6.8).<br>MESURÉ (adversaire, 10 phases, règle du tour 2 de la 6) :<br>• saut centré : 0 chute sur 180, atterrissage ≤ bord aval + 15,5 m ;<br>• saut le plus tardif permis : 1 chute sur 180, atterrissage ≤ + 26,8 m.<br>C'est sous `FOSSE_GHOST_AFTER` = 40 m | **Step 4** :<br>• `elastique-volcans` : saut centré et saut le plus tardif permis à 1,3, atterrissage exigé ≤ 35 m ;<br>• `tests/helpers/robots-sauts.ts`, assertion ajoutée dans ce même Step : par bras, atterrissage le plus long d'un copain après le bord aval ≤ `FOSSE_GHOST_AFTER − 5` (35 m).<br>Imprimés en plus : chutes par tentative par tranche de vitesse, facteur au saut.<br>Exécutée au Step 6. R-F16 se ferme sur les deux | zone fantôme d'une fosse plus longue (R-F16) |
| **Plats étoile** : prise sans saut à 1,3 | MESURÉ :<br>• sonde du brouillon : 0 prise sur 30 ;<br>• adversaire, 300 runs : 0 prise, haut du châssis ≤ 1,93 m au-dessus du sol (bas du capteur à 3,40 m) | Step 6 : `high-stars-sim` (5 voitures, graines 0 à 23) : 0 prise sans saut ni contact ; catapultes (R-F12) comptées avant et après | — (R-F12 tolère et compte ; un surplus va au papa) |
| **Départ à 0,6** (couple 0,6) au pied d'une bosse ou d'une rampe | MESURÉ : sonde du brouillon, 234 tranches, 0 réapparition ; adversaire, 568 runs, 0 réapparition | Step 4 : même balayage (exigé : 0 réapparition) ; Step 6 : `race-invariants` (blocage ≤ 2,1 s) | couple plancher à 1 sous un facteur 1,0 (spec §7) |
| **Galahad arrêté, copains derrière** (fenêtre de 3 m : des copains boostés jusqu'à lui) | MESURÉ (adversaire, fenêtre 12 m, graines 0 à 4, Galahad doigt levé 10 s à t = 40 et 70 s) : impact relatif ≤ 10,8 m/s (12,2 sans élastique), 0 réapparition de Galahad | Step 4 : même sonde avec la fenêtre 20/3 : vitesse d'impact, réapparitions de Galahad. Step 5 : contacts Galahad–copain par course | cible ≤ 1,0 derrière un Galahad plus lent que `POLITE_SPEED` |
| **Freinage net à l'écran** (spec §7 : « jamais d'arrêt net visible ») | CALCULÉ : vue à 14 m/s [−2,8 ; 19,6] m (sans la marge de 1,6 m). Le plafond « ≤ 1 » tombe au bord avant de la vue, marge comprise (R7-16), donc jamais à l'écran | **Seuil exigé** : aucune baisse de `speedFactor` de plus de 0,15 × dt (+ 1e-9) en un pas pour un copain dont `onScreen` est vrai à ce pas ; **seule exception : la fin de son propre turbo**. Test CI dans `elastique.test` ; compteur et décélération maximale hors contact dans `race-objective` (exigé : 0) | montrer au papa (aucun levier sans lui) |

**Galahad au bit près, effet physique.** Le test de champs (`torqueFactor === 1`) ne suffit pas. MESURÉ (adversaire) : le mutant « élastique sur Galahad » ne change l'empreinte que si un turbo tombe dans les 30 s (4 empreintes sur 6). D'où le test du Step 2 : Galahad dépasse 19 m/s en turbo dans une course à 5 voitures.

---

- [ ] **Step 0 : Décisions du papa consignées** au registre (D7-1 à D7-5, 2026-10-23) ; prérequis vérifiés : tâche 6 validée (tour 3 compris) et fusionnée, BASE noté.
- [ ] **Step 1 : Mesures « avant »** (BASE, aucun changement de code).
  - Un worktree dédié : `git worktree add --detach scratchpad/wt-t7-mesures <BASE>`. Les mesures « après » du Step 6 se font **dans ce même worktree** (`git -C … checkout --detach <commit de la tâche 7>`). Raison : `tests/slow/out/` est ignoré par git, et `readStage(REF)` lit le dossier courant. À défaut, copier les trois `tests/slow/out/rattrapage-7-avant*.jsonl` dans l'arbre de l'après.
  - Trois mesures, une à la fois :
    - `RATTRAPAGE_ETAPE=7-avant npm run test:slow:rattrapage` (saut parfait aux fosses : modèle D7-1) ;
    - `RATTRAPAGE_ETAPE=7-avant-sauteur RATTRAPAGE_SAUT=sauteur npm run test:slow:rattrapage` ;
    - `RATTRAPAGE_ETAPE=7-avant-jamais RATTRAPAGE_SAUT=jamais npm run test:slow:rattrapage`.
  - ≈ 8 à 10 min mur chacune (MESURÉ : 7 min 36 à 10 min 09 par étape, registre l. 142, 173, 209).
  - Les lignes jsonl ont déjà `galahadPlace` : « 1er ou 2e » et « dernier » se recalculent au Step 6.
  - Repères :
    - tour 1 de la 6 : doigt posé, Galahad gagne 12/48 (25 %), place moyenne 2,46, vainqueur = 1re étoile 11/48 ; doigt levé 0/16 ; place totale 3,09 (registre l. 209) ;
    - sauteur à 12a876d : 42/48, 1,15 (registre l. 203), à remesurer (graine salée au tour 3) ;
    - sans saut, en 5g : 0/48, place 4,92, 178 chutes (registre l. 173).
- [ ] **Step 2 : Tests rouges.**
  - `tests/pilots.test.ts` (D7-3) :
    - `base` exacte de chaque copain : Pablo 1,00, Matthis 0,995, Malo 0,9875, Diego 0,985, Liam 0,975, Timothé 0,97 ;
    - bornes [0,97 ; 1] (au lieu de [0,85 ; 1]) ;
    - ordre gardé : `base` strictement décroissante quand `lift` croît strictement (test existant, inchangé) ;
    - Galahad à 1.
  - `tests/rubberband.test.ts` (pur) :
    - `targetFactor` :
      - `base` sur [−3, 20] ;
      - 0,6 au-delà de 60 m devant ; 1,3 en deçà de 43 m derrière ; linéaire entre les deux ;
      - bornes [0,6 ; 1,3] pour toute `base` de [0,97 ; 1] ;
      - non croissante en `gap` (balayage de −120 à 120 m au pas de 0,1) ;
    - `rampFactor` : |Δ| ≤ 0,15 × dt, et la cible est atteinte sans la dépasser ;
    - `zoneFloor` : 1 sur `[xLancement − 40, xLava]` de chaque tremplin et de chaque fosse des graines 0 à 19 (garde comprise), 0 à ± 1 cm hors de ces bornes ;
    - `screenAheadEdge`, `screenBehindEdge`, `onScreen` :
      - 21,2 m et −4,4 m à 14 m/s ; 25,4 m à 21 m/s ; ± 12,8 m à l'arrêt ;
      - `SCREEN_REF_HALF_WIDTH_M` = `VISIBLE_HEIGHT_M` × 1 280 / 800 / 2 ;
    - `finalFactor` :
      - 0,97 × 1,5 → 1,3 ; 1 × 1,5 → 1,3 ; 0,8 × 1,5 → 1,2 ;
      - avec `vGalahad` 14 : turbo et `gap` 15 → 1,3 (à l'écran, pas de plafond ; tue le mutant « plafond à 12 m ») ;
      - `gap` 20,5 → 1,3 (tue le mutant « plafond à 20 m, la fenêtre ») ;
      - `gap` 21,3 → 1,0 ;
      - avec `vGalahad` 21 : `gap` 24 → 1,3, `gap` 25,5 → 1,0 ;
    - `stepRubber` :
      - neutre : cible 1 pour t < 5 s, même avec un `gap` de ± 100 m ;
      - clamp ≥ 1 au premier pas dans `[xLancement, xLava]` depuis 0,6 ;
      - en sortant de la zone, la baisse part de ≥ 1 à 0,15/s au plus (clamp stocké).
  - `tests/query.test.ts` : `inVolcanoZone` vrai sur `[xLancement, xLava]` des tremplins et des fosses des graines 0 à 9 (bornes incluses), faux à ± 1 cm.
  - `tests/car.test.ts` :
    - `torqueFactor` 0,6 : accélération sur 2 s ≈ 0,6 × 4,3 ± 15 % (≈ linéaire en `WHEEL_SPINUP`, registre plan A 7c) ;
    - `torqueFactor` 1 et `speedFactor` 1,5 : 4,3 ± 10 % (turbo de Galahad inchangé) ;
    - `torqueFactor` 1,3 : imprimée, plus grande qu'avec 1 (limite d'adhérence possible : μ g ≈ 4,9 m/s², CALCULÉ).
  - `tests/elastique.test.ts` (CI, vrai `stepRace`) :
    - **Galahad, champs** : 5 voitures, graine 1, 30 s doigt posé : à chaque pas `torqueFactor === 1` et `speedFactor === turbo × factor`.
    - **Galahad, effet physique** : même course jusqu'à son premier turbo + 3 s : sa vitesse dépasse 19 m/s (avec l'élastique appliqué à Galahad, elle plafonnerait à 18,2).
    - **Neutre** : pour t < 5 s, les copains ont 1, ou 1,3 en turbo ; les étoiles prises avant 5 s sont imprimées (R7-8).
    - **Taux** : à chaque pas **hors pas de clamp de zone**, |Δ`rubber`| ≤ 0,15 × dt + 1e-12, sur 30 s de course.
    - **Fenêtre** : copain à 2,5 m derrière Galahad, cible `base` ; à 3,5 m derrière, cible > `base` ; à 19,5 m devant, `base` ; à 20,5 m devant, < `base`.
    - **Turbo loin devant** : copain 60 m devant, turbo forcé : `speedFactor` ≤ 1, `carView(...).turbo` vrai.
    - **Freinage net à l'écran** : seuil du tableau, exigé à 0, dans deux cas :
      - graine 1, 60 s ;
      - scénario forcé : Galahad tenu à 14 m/s sur un plat, un copain en turbo (`rubber` 1,3, `RUBBER_NEUTRAL_SECONDS: 0`) qui part 15 m devant et s'éloigne.
      - Attendu dans le scénario : `speedFactor` du copain à 1,3 tant que `gap` ≤ 21,2 m, à 1,0 au premier pas au-delà, `onScreen` faux à ce pas, compteur à 0.
      - Le mutant « plafond à 12 m » fait baisser le facteur à l'écran : compteur > 0, tué.
    - **Review Focus n° 3**, premier tremplin et première fosse de la graine 1 :
      - réglage : Galahad garé 150 m derrière ; un copain (`jumpSkill` 0) posé 100 m avant `xLancement`, ou juste après le `xEnd` du volcan précédent s'il est plus près (précaution de la sonde de la v1 : la première fosse peut suivre le premier tremplin de moins de 100 m) ; `rubber` 0,6, `RUBBER_NEUTRAL_SECONDS: 0` ;
      - attendu : facteur ≥ 1 à chaque pas de `[xLancement, xLava]` ; tremplin sans lave ; fosse passée ;
      - variante : le même copain posé à `xLancement` + 1 avec 0,6 (clamp au premier pas).
    - **Élastique coupé** : `launchSolo` sur un copain met `rubber = null`. Le test « copain à 3 m/s tenus » de `fosses.test.ts` tue le mutant « sans coupure ».
  - Commande : `npx vitest run tests/pilots.test.ts tests/rubberband.test.ts tests/query.test.ts tests/car.test.ts tests/elastique.test.ts`. Attendu : **ROUGE**.
- [ ] **Step 3 : Implémenter**, puis **VERT**.
  - Code :
    - `applyDrive` et ses 8 appels ;
    - `rubberband.ts` ; `inVolcanoZone` ; câblage dans `stepRace` ; constantes ;
    - **`base` des six copains dans `src/cars/pilots.ts`** (D7-3), commentaire du champ et de la table (« caractère de vitesse regroupé près de 1 : le caractère est porté par `lift`, `jumpTry`, `jumpSkill` ») ; la grep de `base` à BASE ne trouve aucun autre lecteur.
  - Migrations :
    - `launchSolo` met `rubber = null` quand il impose `factor` ;
    - `tests/fantomes.test.ts` l. 69, 112 et 131 (grep à BASE) : `rubber = null` sur les copains à vitesse imposée ;
    - littéral `CarSim` de `jump-runs.ts` (le compilateur le signale) ;
    - `smoke` : nouvelles constantes.
  - Outillage de mesure (commit `test:`) :
    - `indicators` de `rattrapage.ts` imprime « 1er ou 2e » et « dernier » ;
    - `tests/slow/bouton.test.ts` et `vitest.slow-bouton.config.ts` (`include: ['tests/slow/bouton.test.ts']`, exclu de `vitest.slow.config.ts`), script `"test:slow:bouton"` :
      - il lit, par `readStage`, trois étapes pour l'avant (`BOUTON_AVANT`, défaut `7-avant,7-avant-sauteur,7-avant-jamais`) et trois pour l'après (`BOUTON_APRES`, défaut `7,7-sauteur,7-jamais`) ;
      - il exige 64 courses par étape au même commit (non-vacuité) ;
      - il imprime, pour chaque motif (doigt posé 48, doigt levé 16), avant puis après :
        - victoires, « 1er ou 2e », « dernier » et place moyenne de Galahad pour sans saut, saut parfait et sauteur ;
        - les écarts appariés par graine : saut parfait − sans saut (ce que rendent les fosses), sauteur − saut parfait (ce que rendent les étoiles hautes) ;
        - la liste des places par graine ;
      - il n'a aucune assertion chiffrée (ruling Q9, D7-5) et dure moins de 1 s.
  - Puis `npm run typecheck` (0 erreur) et `npm test` (vert, empreinte inchangée sans recapture).
- [ ] **Step 4 : Suites lentes « volcans sous élastique » et `robots-sauts`** (commit `test:`).
  - `tests/slow/elastique-volcans.test.ts` : budget en tête < 15 min mur. ESTIMÉ ≈ 5 à 8 min : les émulations de l'adversaire coûtent 0,15 à 0,25 s par run en monde rogné, et la marche au pied en compte 1 836.
    - Contenu : les lignes « à mesurer » du tableau (Review Focus n° 3, tremplins à 1,3 avec phases, marche 1,3 → 1,0 au pied, fosses à 1,3, plats étoile à 1,3, départ à 0,6, Galahad arrêté avec la fenêtre 20/3).
    - Avec le vrai élastique : un copain forcé par `rubber` et par la position de Galahad garé, les autres garés derrière la grille.
    - Exigé : 0 chute aux tremplins, garde ≥ 0,3 m, facteur ≥ 1 dans la zone, 0 prise d'étoile haute sans saut, 0 réapparition au départ à 0,6, atterrissage après une fosse ≤ 35 m, 0 réapparition de Galahad arrêté.
    - Imprimé : vitesse à `xLancement`, au sommet et au bord ; garde minimale ; vitesse maximale conduite ; vx maximale après contact ; vitesses d'impact sur Galahad arrêté (repère : 10,8 m/s avec la fenêtre de 12 m).
  - `tests/helpers/robots-sauts.ts` : assertion « atterrissage ≤ `FOSSE_GHOST_AFTER − 5` » (tableau, ligne Fosses), à partir de la version du tour 3 de la 6.
  - Commande : `npx vitest run -c vitest.slow.config.ts tests/slow/elastique-volcans.test.ts`.
- [ ] **Step 5 : Objectif** (`npm run test:slow:race`).
  - Fichiers et coût (≈ 13,7 s par course à 5 voitures, MESURÉ (relecture), budget v1.6) :
    - `race-objective.test.ts` : modèle D7-1 et sauteur, graines 0 à 19, 40 courses, ≈ 9 min ;
    - `race-objective-leve.test.ts` : doigt levé 30 % avec saut parfait, graines 0 à 9, ≈ 2,5 min.
    - Ce sont des sous-ensembles des graines du rattrapage : les lignes « 7 » du rattrapage sont les mêmes courses, et la comparaison sert de contrôle de déterminisme.
  - Exigé dans chaque course (les deux fichiers) :
    - ≤ 3 réapparitions par copain hors chutes dans une fosse ;
    - au plus 2 chutes par série ;
    - arrivée de Galahad < 240 s ;
    - 0 chute « sans tentative » ;
    - compteur « freinage net à l'écran » à 0.
  - Exigé au total, modèle D7-1 (20 courses, D7-4) :
    - Galahad 1er ou 2e dans au moins 10 courses ;
    - dernier au plus 2 fois ;
    - 1er dans 5 à 15 courses ;
    - un copain à l'écran au moins 30 % du temps, en moyenne sur les 20 courses.
  - Exigé au total, sauteur (D7-5) : place moyenne ≤ celle du modèle D7-1 sur les mêmes 20 graines.
  - Doigt levé 30 % (D7-5) : places imprimées ; seules les limites des copains sont exigées.
  - Tableau imprimé par graine :
    - place, vainqueur, première étoile ;
    - étoiles et réapparitions par voiture ;
    - facteur moyen des copains ;
    - part du temps avec un copain à l'écran, et devant Galahad ;
    - contacts Galahad–copain ;
    - vx maximale d'un copain après contact.
  - Repère (MESURÉ, sonde du brouillon, graines 0 à 9, mêmes réglages) : 4/10 victoires, 8/10 « 1er ou 2e », 0 dernier, copain à l'écran 49 %.
  - Bruit : ± 2,2 victoires d'écart-type sur 20 courses (CALCULÉ).
  - **Hors cible : on montre les chiffres au papa, aucun levier sans lui** (R7-14). On mesure les options s'il en demande. On compare aussi au rattrapage sur 48 graines.
- [ ] **Step 6 : Suites ciblées et rattrapage « après ».**
  - Fichiers lents à 5 voitures, sans changement d'assertion sauf `robots-sauts` (Step 4) :
    - `race-invariants-*` (4), `robots-sauts-*` (2), `high-stars-sim`, `race-sans-saut-*` (2), `interpolation-replay-slow` ;
    - commande : `npx vitest run -c vitest.slow.config.ts` suivi de ces fichiers ;
    - repère : 9 fichiers ciblés en 33 min 14 au tour 1 de la 6 (registre l. 209).
  - Rattrapage, dans le worktree du Step 1 :
    - `RATTRAPAGE_ETAPE=7 RATTRAPAGE_REF=7-avant npm run test:slow:rattrapage` ;
    - `RATTRAPAGE_ETAPE=7-sauteur RATTRAPAGE_SAUT=sauteur RATTRAPAGE_REF=7-avant-sauteur npm run test:slow:rattrapage` ;
    - `RATTRAPAGE_ETAPE=7-jamais RATTRAPAGE_SAUT=jamais RATTRAPAGE_REF=7-avant-jamais npm run test:slow:rattrapage`.
  - Puis **`npm run test:slow:bouton`** : « ce que le bouton rend à Galahad », avant et après ; sans saut imprimé ici (D7-5). À la passation et au papa.
  - Pas de mesure sur `ANCIENNES_PISTES` (R7-10).
- [ ] **Step 7 : Suites de fin de tâche** (une fois) :
  - `npm run typecheck` ;
  - `npm test` (< 6 min ; ajout ESTIMÉ ≈ + 20 s de CPU dans des fichiers à part, mur inchangé) ;
  - `npm run test:slow` en entier (≈ 36 min) et `npm run test:slow:race` ;
  - `npm run e2e` : les 2 premières secondes sont neutres, « sans doigt » est donc inchangé ; captures refaites si l'écran change.
- [ ] **Step 8 : Commits** `feat: élastique des copains (facteur au couple et au plafond, fenêtre de la vue, base regroupées près de 1)`, puis `test:` pour l'outillage et les suites lentes (Steps 3 à 5).
- [ ] **Step 9 : Relectures** (quatre sièges, méthode de la session 4).
  - **Standard.**
  - **Adversariale**, sondes et mutants dans une copie (worktree du scratchpad).
    - Mutants :
      - élastique appliqué à Galahad (tué par l'effet physique du Step 2) ;
      - clamp de zone retiré, et clamp appliqué sans être stocké ;
      - pré-zone comptée depuis `xBord` ;
      - taux non borné ;
      - neutre retiré ;
      - plafond du turbo retiré (1,5) ;
      - « ≤ 1 loin devant » retiré ;
      - signe de `gap` inversé ;
      - fenêtre symétrique (20/20 ou 3/3) ;
      - `base` d'avant remises ;
      - couple non multiplié pour les copains ;
      - `launchSolo` sans coupure ;
      - `factor` lu par un copain sous élastique ;
      - plafond « ≤ 1 » appliqué à 12 m, ou à la fenêtre de 20 m au lieu du bord de l'écran (tués par `rubberband.test` et le compteur « freinage net ») ;
      - `finalFactor` et le compteur avec deux définitions différentes de l'écran (une seule fonction `onScreen` exigée).
    - Sondes :
      - Review Focus n° 3 avec des phases ;
      - copain en turbo qui franchit les 20 m devant un Galahad en turbo ;
      - Galahad arrêté 10 s en course ;
      - téléportation de Galahad (réapparition 40 à 60 m en arrière) ;
      - deux copains boostés qui se cognent ;
      - copain réapparu dans la pré-zone ;
      - déterminisme (graine jouée deux fois) ;
      - allocations par pas.
  - **Skill `code-review`** sur le diff de la tâche.
  - **Skill `security-review`** : attendu sans objet hors des helpers de test qui écrivent du jsonl (`tests/slow/out`) et lisent `RATTRAPAGE_*` et `BOUTON_*` ; le dire.
  - Tours de correction (5 au plus), un commit `fix:` chacun.
- [ ] **Step 10 : Validation du papa** (tablette, 5 voitures).
  - Questions, avec les chiffres du Step 5 :
    - Les copains restent-ils à l'écran, et proches ? (part du temps avec un copain à l'écran)
    - Un copain qui ralentit ou qui perd son turbo à l'écran se voit-il ?
    - Les caractères (fonceurs, prudents) se voient-ils encore, maintenant que leurs vitesses sont proches ?
    - Galahad gagne-t-il trop souvent, ou jamais ?
  - Puis commit `docs: tâche 7 validée, passation et registre`, `git status -sb`, push.
  - **Après les tâches 6 et 7, le papa rejuge la difficulté** (`ENGINE_BRAKE`, plan C).

**Budget (tâche 7).**

| Où | Ajout | Coût |
|---|---|---|
| `npm test` | `rubberband` (pur), `pilots`, `inVolcanoZone`, 3 tests de `car.test`, `elastique.test` (≈ 9 simulations courtes) | ESTIMÉ ≈ + 20 s de CPU dans des fichiers à part ; mur fixé par `rampes.test.ts` ; aujourd'hui 625 tests en 2 min 42 (registre l. 209) |
| `test:slow` | `elastique-volcans` (nouveau) | < 15 min mur (budget écrit en tête) |
| `test:slow:race` | `race-objective` (40 courses), `race-objective-leve` (10) | ≈ 9 et ≈ 2,5 min, en parallèle ; budget en tête : 20 min chacun |
| `test:slow:rattrapage` | 3 étapes avant, 3 après | ≈ 8 à 10 min mur chacune, ≈ 1 h en tout, dans le worktree du Step 1 |
| `test:slow:bouton` | lecture des 6 étapes | < 1 s |

**Tableau de migration (tâche 7).** Les numéros de ligne sont ceux de 5a3f0fb : grep à BASE.

| Test | Ce qu'il suppose | Migration |
|---|---|---|
| `tests/car.test.ts`, `tests/bounce.test.ts`, `tests/helpers/runs.ts` (`step`) | `applyDrive(car, throttle, factor, cfg)` | couple 1 explicite ; + tests de couple (Step 2) |
| `tests/helpers/jump-runs.ts` | littéral `CarSim` ; `launchSolo` tient la vitesse par `factor`, sur Galahad **et** sur des copains (`robots.test.ts` ×4, `fosses.test.ts` ×2) | `rubber: null`, `speedFactor`, `torqueFactor` dans le littéral ; `launchSolo` met `rubber = null` |
| `tests/fantomes.test.ts` l. 69, 112, 131 | `factor` imposé à un copain (0,05 ; 0,3 ; 1). Les l. 111 et 120 visent Galahad : inchangées | `rubber = null` sur ce copain |
| `tests/pilots.test.ts` | `base` ∈ [0,85 ; 1], ordre des caractères | valeurs du papa, bornes [0,97 ; 1], ordre gardé (Step 2) |
| `tests/simulate.test.ts` (`factor === 1` à la création) | — | inchangé ; + `rubber` 1 pour les copains, null pour Galahad |
| `tests/stars-pour-tous.test.ts`, `tests/robots.test.ts` (grille, politesse) | copains au facteur 1 | inchangé attendu (5 premières secondes neutres) ; turbo d'un copain à 1,3 au lieu de 1,5 : vérifier les tests qui chronomètrent un turbo |
| `tests/race-smoke.test.ts` | invariants à 5 voitures, graines 1 et 2 | inchangé, élastique actif |
| `tests/empreinte.test.ts`, `PLAN_A_TRACE` | Galahad seul | inchangés (preuve du bit près) |
| `tests/helpers/rattrapage.ts`, `tests/helpers/robots-sauts.ts` | indicateurs ; pas de borne d'atterrissage | Steps 3 et 4 |
| `vitest.slow-race.config.ts`, `vitest.slow.config.ts` | un seul fichier `race-objective.test.ts` | glob `race-objective*.test.ts` ; `bouton.test.ts` exclu de `test:slow` |

---

#### Review Focus de la tâche 7

1. **Copain freiné à 0,6 loin devant qui aborde un volcan** (n° 3 du plan v2.1) : facteur ≥ 1 de `xLancement` à `xLava`, aucune chute au tremplin, fosse passée par un saut sans erreur.
2. **Galahad seul** : empreinte identique sans recapture, et Galahad au-dessus de 19 m/s en turbo dans une course à 5 voitures.
3. **Copain à 1,3 sur un tremplin**, plafond et couple :
   - depuis le pire point sûr et lancé, avec des phases ;
   - marche 1,3 → 1,0 au pied ;
   - attendu : aucune chute, garde ≥ 0,3 m, atterrissage avant `xEnd − 10`.
4. **Copains à l'écran** : au moins 30 % du temps en moyenne (D7-4) ; aucune baisse de facteur plus rapide que 0,15/s à l'écran, sauf la fin du turbo du copain lui-même (le plafond « ≤ 1 » tombe toujours au bord de la vue, R7-16) ; Galahad arrêté sans réapparition malgré les copains tirés jusqu'à 3 m derrière lui.
5. **Test qui impose une vitesse à un copain** : élastique coupé, comportement de la tâche 6.

---

#### À dire au papa, sans question

- Les « 27,3 m/s » de la spec bouton saut étaient une erreur de calcul (R7-1). Un copain conduit ne dépasse pas 18,2 m/s (18,8 MESURÉ en descente). Il peut aller plus vite poussé par un choc (21,8 m/s MESURÉ) : la règle des catapultes s'applique.
- En turbo, les copains iront **moins vite qu'aujourd'hui** (21 → 18,2 m/s). Loin devant, ils gardent les flammes sans gagner de vitesse (spec §7).
- Aux fosses, les ratés des fonceurs se calculent désormais à ≈ 14 et ≈ 18 m/s (Pablo 19 % et 14 %, Matthis 12 % et 7,6 %, CALCULÉ).
- Autour de chaque volcan, un copain loin devant n'est pas freiné : ≈ 97 m par tremplin et ≈ 76 m par fosse, CALCULÉ ; ≈ 19 % de la piste avec 3,6 volcans par course.
- Avec la fenêtre de 3 m derrière, des copains roulent souvent juste derrière Galahad. Plus de contacts sont possibles s'il lève le doigt ; c'est mesuré au Step 4 (chocs lancés acceptés, décision 3 du 2026-10-23).

---

#### Rulings proposés (le coordinateur peut trancher seul)

Aucun ne change une valeur ou un comportement validé par le papa ; ce qui en changerait est dans les décisions D7-1 à D7-5 ou dans la colonne « papa » du tableau.

- **R7-1 — Vitesse maximale conduite d'un copain : 18,2 m/s, pas 27,3.**
  - Le plafond « 1,3 au total » du spec §7 tient : saut §3 laisse l'élastique inchangé, et addendum §2 ne dit rien d'autre.
  - MESURÉ (adversaire) : f ≤ 1,30 sur tous les chemins, 60 courses.
  - Saut §6.2, §6.4, §6.6 et R-F16 sont corrigés ; R-F16 se ferme sur le Step 4 (émulation) et le Step 6 (vrai driver).
  - Coût si faux : tout refaire à 27 m/s ; 27,3 m/s sortirait de l'enveloppe des tremplins (Galahad en turbo permanent n'a plus que 3,6 m avant `xEnd`).
- **R7-2 — `applyDrive(car, throttle, speedFactor, torqueFactor, cfg)` positionnel** : aucune allocation par pas, et le compilateur signale les 8 appels. Coût si faux : nul.
- **R7-3 — `CarSim.rubber: number | null`.**
  - `null` coupe l'élastique : Galahad, et un copain dont un test impose `factor` (`launchSolo` le coupe). Un copain sous élastique ne lit pas `factor`.
  - `speedFactor` et `torqueFactor` sont stockés pour toute voiture.
  - Coût si faux : un test qui croit tenir la vitesse d'un copain ne la tient pas (mutant du Step 9).
- **R7-4 — Pré-zone d'une fosse : `[xLancement − 40, xLancement)`**, `xLancement` étant le début de l'approche : lecture littérale de l'addendum §1.8, la garde de 20 m est dans la pré-zone.
  - MESURÉ : même résultat que depuis le début de la garde − 40.
  - Coût si faux : 20 m de pré-zone de plus devant chaque fosse (ce serait un choix du papa).
- **R7-5 — Le clamp ≥ 1 de la zone est stocké dans `rubber`.** À la sortie de la zone, le facteur redescend de ≥ 1 à 0,15/s, sans marche. Le test du taux exclut le pas du clamp. Coût si faux : une marche de facteur au-dessus de la lave.
- **R7-6 — Début et fin d'un turbo de copain : marches, comme le turbo de Galahad** (spec « Étoile / turbo » ; les flammes montrent la cause). La marche du plafond « ≤ 1 » relève de R7-16. Coût si faux : un turbo de copain sans effet visible.
- **R7-7 — Écart lu au début du pas** (x du châssis, avant toute conduite), donc indépendant de l'ordre des voitures. Rien de spécial après l'arrivée de Galahad. Coût si faux : nul.
- **R7-8 — Neutre : la cible de l'élastique vaut 1 pendant 5 s**, mais le plafond du turbo (1,3) s'applique déjà : un copain qui prend une étoile avant 5 s va à 18,2 m/s, pas 21.
  - Coût si faux : un turbo de copain moins fort au départ (ESTIMÉ rare ; imprimé par `elastique.test`).
- **R7-9 — Le plancher s'arrête à `xLava`** (addendum §1.8). En vol, le facteur peut redescendre (au plus 0,3 en 2 s, CALCULÉ).
  - MESURÉ (adversaire, 170 runs) : 0 réapparition, angle ≤ 10° à l'atterrissage. Remesuré au Step 4.
  - Coût si faux : des atterrissages roues freinées. Le garde-fou « pas de baisse en l'air » serait un choix du papa.
- **R7-10 — Pas de mesure du rattrapage sur `ANCIENNES_PISTES`.** Écart assumé avec saut §4 (l. 126) : le contrôle « identique à la 5d » n'existe plus depuis la tâche 6. Coût : nul.
- **R7-11 — Graines de l'objectif : 0 à 19 doigt posé, 0 à 9 doigt levé.** Ce sont des sous-ensembles du rattrapage. Coût : nul.
- **R7-12 — Galahad arrêté en course, copains derrière : mesure seulement.**
  - Les chocs lancés sont acceptés (décision du papa 3, 2026-10-23).
  - Exigé au Step 4 : 0 réapparition de Galahad.
  - Les vitesses d'impact avec la fenêtre 20/3 sont montrées au papa si elles dépassent celles de la tâche 6 (12,2 m/s).
  - Coût si faux : des chocs plus forts sur Galahad arrêté.
- **R7-13 — `inVolcanoZone` déplacée dans `track/query.ts`** : une copie privée aujourd'hui (`driver.ts:158`), une deuxième utilisation avec l'élastique, et un test propre. Coût : nul.
- **R7-14 — Aucun levier de réglage sans le papa.** Le plan v2.1 permettait d'« ajuster `base` et `RUBBER_RAMP_M` » : retiré, ce sont des valeurs validées. Hors cible, on montre les chiffres. Coût : un aller-retour avec le papa.
- **R7-15 — Lectures des interfaces du plan v2.1.**
  - `RUBBER_RAMP_M` va de `base` à la borne, pas de 1,0 (v2.1 l. 246). Depuis 1,0, la cible sauterait de `base` à 1,0 au bord de la fenêtre.
  - `zoneFloor(track, x, cfg)` prend l'ordre de `query.ts`.
  - Coût si faux : nul.
- **R7-16 — Le plafond « ≤ 1,0 » d'un copain s'applique quand il est hors écran devant Galahad** (ruling du coordinateur, re-relecture de la v3, constat N1). C'est la lettre du spec §7 : « un robot hors écran devant Galahad garde les flammes mais ne dépasse jamais le facteur 1,0 ».
  - La fenêtre de l'élastique ne bouge pas : 20 m devant, 3 m derrière (D7-2).
  - Le bord avant du plafond vaut `screenAheadEdge(vGalahad)` = 11,2 + 0,6 × vGalahad + 1,6 m. C'est la même définition que le compteur « freinage net » et la part « copain à l'écran » : une seule fonction pure, `onScreen`, et `finalFactor` reçoit la vitesse de Galahad.
  - La marge de 1,6 m vient de la définition du § 0.2, que le coordinateur a demandé de garder identique au compteur. Sans elle (11,2 + 0,6 v), le compteur, qui la compte, verrait la marche.
  - La marche tombe donc toujours au bord de la vue, hors écran, et le compteur exige 0 sans autre exception que la fin du turbo du copain lui-même.
  - Limite (ESTIMÉ) : la vue de référence est celle de la tablette (1 280 × 800) et de la cible de caméra, pas de la caméra lissée (`CAMERA_SMOOTHING`) ; la marge couvre une partie du retard. Un écran 16:9 (12,4 m de demi-largeur) montrerait la marche à 1,2 m du bord.
  - Coût si faux : le bord du plafond bouge avec la vitesse de Galahad. En turbo, un copain peut garder 1,3 jusqu'à 25,4 m devant lui (23,8 m sans la marge), soit une portion de piste où il reste dopé hors de la vue.

---

#### Corrections à reporter (avec la doc de la tâche, après sa validation)

- **Addendum plan B §2** (il l'emporte sur le spec), nouvelle puce « [tâche 7] Élastique (décisions du papa, 2026-10-23) ». Elle amende le spec §7 sur trois points :
  - « `base` des copains regroupées près de 1, ordre gardé : Pablo 1,00, Matthis 0,995, Malo 0,9875, Diego 0,985, Liam 0,975, Timothé 0,97 ; le caractère est porté par le lever de pied et les sauts ». Dans la borne 0,85 à 1,0 du spec §7, mais ce ne sont plus les valeurs du 5a ;
  - « fenêtre de l'élastique = la vue : 20 m devant Galahad, 3 m derrière ». Le spec §7 disait « X = au moins la demi-largeur visible, donc hors écran », des deux côtés : derrière, le papa veut les copains à l'écran ;
  - objectif mesuré (spec §7, §11 ; addendum §2) : « modèle doigt posé + saut parfait aux fosses ; Galahad 1er dans 5 à 15 des 20 courses ; un copain à l'écran au moins 30 % du temps ; variantes de D7-5 ».
- **Spec bouton saut :**
  - §6.2 (détail W = 8, puce « turbo »), « copains sous élastique et turbo (27,3 m/s, tâche 7) : ≈ 44 m (CALCULÉ) », devient : « copains sous élastique : vitesse conduite ≤ 18,2 m/s (CALCULÉ ; 18,8 MESURÉ) ; atterrissage ≤ bord aval + 26,8 m (MESURÉ, relecture de la tâche 7 ; Step 4) » ;
  - §6.4 (« À revérifier en tâche 7 ») : fermé par les Steps 4 et 6 ;
  - §6.6 (« 44 à 79 m de portée ») devient : « à 18,2 m/s, 0 prise sans saut (sonde et relecture de la tâche 7) ; `high-stars-sim` relancé ».
- **Plan v1.6 :**
  - R-F16 : « À revérifier en tâche 7 » est fermé ;
  - tableau de migration, ligne `race-objective` : « modèle doigt posé + saut parfait (D7-1) ; sauteur et doigt levé en variantes (D7-5) » ;
  - nouvelles lignes `pilots.test` et `bouton.test` (renvoi au tableau de cette tâche) ;
  - « Ordre d'exécution » et « Ce document remplace la tâche 6 » : la tâche 7 est désormais la v1.7 de ce plan ;
  - tableau « Galahad seul » : ligne 7 ;
  - section « Décisions du papa » : D7-1 à D7-5.
- **Registre :** « DÉCISION PAPA (2026-10-23, tâche 7) » avec D7-1 à D7-5 (Step 0).
- Le texte du plan v2.1 reste tel quel, pour l'historique ; une ligne en tête de sa tâche 7 renvoie ici.

---

#### Annexe A — Sonde du brouillon, tour 1

**Où.** `scratchpad/wt-t7/tests/zz-probe-t7.test.ts`, worktree détaché à 5a3f0fb. ≈ 1 min pour 387 runs. Rien n'a été touché dans le dépôt.

**Émulation d'un copain.**
- Galahad seul (`soloSim`, `launchSolo`), vrai `stepRace`, monde rogné.
- Facteur f au plafond (`car.factor`) et au couple (`sim.cfg.WHEEL_SPINUP` × f, remplacé à chaque pas).
- Sauts de fosse par `fosseJumpWanted` (règle de 5a3f0fb).

**Graines 0 à 9.** Une trajectoire par cas (l'adversaire a refait ces familles avec des phases).

| Famille | Résultat (MESURÉ) |
|---|---|
| Tremplin à 1,3 : arrêt au pire point sûr, et lancée à 18,2 m/s | 0 lave sur 34, 0 retournement ; sommet 16,5 à 17,2 m/s ; atterrissage ≤ `xReception` + 32,5 m ; marge ≥ 31,8 m avant `xEnd` |
| Tremplin, copain freiné : 8,4 m/s à 0,6, puis + 0,15/s dès `xLancement − 40`, clamp à `xLancement` | 0 lave sur 17 ; 12,0 à 14,0 m/s à `xLancement` ; sommet ≥ 12,6 m/s |
| Fosse à 1,3, saut centré | 0 chute sur 18 ; atterrissage ≤ bord aval + 14,7 m |
| Fosse à 1,3, saut au dernier pas permis (règle d'avant le tour 2 de la 6) | 5 chutes sur 18 (sauts à 1,8–1,9 m du bord) ; sinon atterrissage ≤ + 26,7 m |
| Fosse, copain freiné, saut centré ; pré-zone depuis `xLancement − 40` ou depuis le début de la garde − 40 | 0 chute sur 18 dans les deux cas ; 13,9 à 14,1 m/s au bord |
| Plat étoile à 1,3, lancée à 18,2 m/s, sans saut | 0 prise sur 30 ; châssis ≤ 0,8 m au-dessus du sol à ± 3 m de l'étoile |
| Départ arrêté à 0,6 au pied des bosses, double-bosses et rampes-saut | 234 tranches, 0 réapparition |
| Vitesse maximale du châssis à 1,3 | 18,8 m/s |

#### Annexe B — Sonde du brouillon, tour 2 : options de fenêtre et de `base`

**Où.**
- Prototype de l'adversaire (`scratchpad/r7-sondes/prototype-elastique.diff`) appliqué dans `scratchpad/wt-t7`, plus un crochet `baseFn` (`base` remappée par pilote, ordre gardé). Le tout est sauvegardé dans `scratchpad/r7-options-prototype.diff`.
- Courses `objRace` de l'adversaire : `fiveCarRace`, `CONFIG`, doigt posé, saut parfait.
- 4 réglages × graines 0 à 9, 4 fichiers en parallèle : 6 min 29 mur. Sorties : `scratchpad/r7-options/probe-t7-options.out`. Worktree remis à 5a3f0fb ensuite.

**Réglages.** Rampe 40 m, bornes 0,6 et 1,3, 0,15/s, neutre 5 s, pré-zone 40 m, clamp stocké.

| Réglage | `base` | Fenêtre (devant / derrière) | Galahad 1er | 1er ou 2e | dernier | place moyenne | copain à l'écran |
|---|---|---|---|---|---|---|---|
| C1 | 0,97 + (b − 0,86) × 0,25 | 12 / 12 | 7/10 | 10/10 | 0 | 1,30 | 21 % (0 à 59) |
| **C2 (décidé)** | 0,97 + (b − 0,86) × 0,25 | 20 / 3 | 4/10 | 8/10 | 0 | 1,80 | 49 % (31 à 97) |
| C3 | celles des pilotes | 20 / 3 | 4/10 | 8/10 | 0 | 1,90 | 32 % (1 à 90) |
| C4 | 0,97 + (b − 0,86) × 0,5 | 20 / 3 | 3/10 | 6/10 | 1 | 2,40 | 57 % (27 à 91) |

- Dans les 40 courses, aucun copain n'a dépassé 1 réapparition, chacune après une chute dans la lave ; le type de volcan n'a pas été relevé.
- Galahad : 0 chute.

#### Annexe C — Constats des relectures et leur traitement

| Constat | Traitement |
|---|---|
| Standard I1 (avant et après dans des arbres différents) | Step 1 : un seul worktree pour l'avant et l'après, ou copie des jsonl |
| Standard I2 (« ce que le bouton rend » sans outil) | `tests/slow/bouton.test.ts`, `test:slow:bouton` (Steps 3 et 6) |
| Standard I3 (`robots-sauts` : impression ou assertion ?) | assertion ≤ 35 m, posée au Step 4, exécutée au Step 6 |
| Standard I4 (garde-fous qui changent des valeurs validées) | colonne « papa » du tableau ; R7-14 |
| Standard I5 (« pas de freinage net » sans seuil) | seuil exigé et tests (Steps 2 et 5), D7-2, Review Focus 4 |
| Standard I6 (questions dépendantes) | questions posées dans l'ordre ; tranchées (D7-1 à D7-5) |
| Adversaire I1 (19/20 victoires ; leviers) | § 0.2, D7-3, R7-14 |
| Adversaire I2 (copains hors écran) | § 0.2, D7-2, D7-4 (cible d'écran), Step 5 |
| Adversaire M1 (marche au pied) | tableau (Tremplins), Step 4, Review Focus 3 |
| Standard M6 et adversaire M2 (test du taux et clamp) | Step 2 « hors pas de clamp », R7-5 |
| Adversaire M3 (vitesse après choc) | § 0.1, Step 5, « À dire au papa » |
| Adversaire M4 (couple de Galahad sans effet physique) | Step 2 (> 19 m/s en turbo), Review Focus 2 |
| Standard M1 à M5, M7 à M9 | remplacé par la mesure (M1) ; tableau de migration (M2) ; arguments positionnels (M3) ; R7-13 et `query.test` (M4) ; constantes nommées, note sur la forme de l'écran (M5) ; `RATTRAPAGE_SAUT` aux Steps 1 et 6 (M7) ; Step 6 ciblé, Step 7 entier, « grep à BASE » (M8) ; R7-15, R7-3, R7-10 (M9) |
| Coordinateur (tour 3 de la 6, BASE) | Prérequis, Step 1 |
| Re-relecture de la v3, N1 (le compteur voyait la marche du plafond à 20 m) | R7-16 : plafond hors écran, défini par la même fonction `onScreen` que le compteur ; Interfaces (`finalFactor` reçoit la vitesse de Galahad, `CarSim.onScreen`) ; constantes `SCREEN_*` ; Steps 2 et 9 (mutants « 12 m » et « 20 m » distinguables) |
| Re-relecture de la v3, mineurs | Step 5 « les deux fichiers » ; Step 2, Review Focus n° 3 : départ après le `xEnd` du volcan précédent |
| Décisions du papa (2026-10-23) | § « Décisions du papa », intégrées aux Files, Interfaces, Constantes, Règles, Steps 2, 3 et 5, et aux Corrections à reporter |

---

## Migration des tests existants (v1.6)

Toutes les pistes changent (P10), et la promesse « doigt posé = 0 chute » ne vaut plus qu'aux tremplins (P9). La liste ci-dessous couvre **tous** les tests qui supposent l'une ou l'autre, ainsi que ceux que la tolérance de sol (P11) touche. Elle a été établie par `grep` des usages de `volcanoes`, `firstVolcano`, `trackFor`, `worldFor`, `xElanStart`, `xLip`, `lavaByCar`, des valeurs figées et des graines fixes.
- Chaque migration est faite **au Step indiqué**, qui est celui où le comportement change ; ce Step finit vert. Jamais de `.skip`.
- « 5e S10 » se lit : tâche 5e, Step 10. Numérotation de la v1.6 : le Step 12 de la 5e pose les valeurs de la calibration, les plats étoile sont au Step 13, l'acceptation au Step 14, la recapture au Step 15.

Légende des migrations :
- **AP** : passer à `withAnciennesPistes(cfg)`. Le test juge la physique ou compare à une mesure d'avant, et ses valeurs figées ne bougent pas.
- **T** : prendre les tremplins seulement (`tremplins(track)`, `firstTremplin`). Le test vise la géométrie du tremplin, et le compilateur signale l'usage.
- **SP** : Galahad court avec `sauteurParfait`. Le test garde « 0 chute ».
- **+F** : ajouter le cas fosse.

| Test | Ce qu'il suppose | Migration | Quand |
|---|---|---|---|
| `tests/helpers/runs.ts` | `trackFor`, `worldFor` et `firstVolcano` sur `CONFIG` | `trackFor(seed, cfg)` et `worldFor(seed, cfg)` (cache par cfg) ; `firstTremplin` et `firstFosse` | 5e S10 ; 5g S2 |
| `tests/helpers/frames.ts` | `recordTrajectory` sur `CONFIG` | paramètre `cfg` | 5e S10 |
| `tests/helpers/phases.ts` | `variantTrack` sur `CONFIG` : les « 43 volcans » et les 2 924 + 4 601 historiques | AP dans `variantTrack` | 5e S10 |
| `tests/helpers/calibration-saut.ts` | `cfgFor` part de `CONFIG` | `{ ...withAnciennesPistes(CONFIG), STAR_HIGH_PER_RACE: 3, … }`, assertion de non-vacuité | 5e S10 |
| `tests/helpers/recorded.ts` | courses enregistrées de la calibration de la 5e | AP (par `cfgFor` et `trackFor`) | 5e S10 |
| `tests/helpers/rattrapage.ts` | mesure appariée par graine depuis la 5d | deux mesures : AP (contrôle de non-régression) et `CONFIG` (effet) | 5e S10 ; 5g S8 |
| `tests/helpers/race.ts` | Galahad doigt posé ; chute classée « choc » ou « propre » | option `jump` (SP par défaut, sans saut pour `race-sans-saut-*`) ; cause « fosse » (attendue sans saut) ; au plus 2 chutes par série | 5g S2 |
| `tests/empreinte.test.ts` | sha1 figés sur les pistes `CONFIG` des graines 0 à 2 | AP pour `FROZEN` (inchangé) ; `FROZEN_CONFIG` recapturé par ruling R-F10 | 5e S10 ; 5e S15 ; 5g S8 |
| `tests/simulate.test.ts` | `PLAN_A_TRACE` (graine 1, 20 s) ; `rebuildCars` à mi-course sans « stuck » ; l. 257 : piste de 300 m, arrivée en moins de 60 s | AP pour `PLAN_A_TRACE`. À mi-course, une chute dans une fosse n'est pas un « stuck ». L. 257 : une fosse est possible à 300 m ; sans saut, l'arrivée reste sous 60 s (2 chutes ≈ + 5 s), sinon SP | 5e S10 ; 5g S2 |
| `tests/jump.test.ts` | « au sol seulement » (demande 0,7 s après le décollage) ; bouton grisé du 7e pas après le décollage ; table de `canJump` (`grounded`) ; « pente (P3) » : saut au premier pas **au sol** de la seconde moitié de la montée (commentaire des l. 139-142) ; rampe-saut d'une graine choisie | tolérance de sol, au décollage d'une rampe-saut : demande à 0,30 s → saut, à 0,40 et 0,7 s → aucun ; bouton grisé à partir de 0,35 s après le dernier contact de jeu ; table de `canJump` sur `lastGroundedAt` ; « pente (P3) » : le saut part maintenant en l'air (graine 0 : 2,90 m après le pied, 0,18 s après le dernier contact, gain 2,46 m, MESURÉ (relecture)), commentaire réécrit, assertions inchangées ; « lâchée de 2 m » inchangé (il exige `lastGroundedAt` nul à la création) ; rampe trouvée dynamiquement (`rampTrack`) | 5e S11 ; 5e S13 |
| `tests/helpers/jump-runs.ts` | littéral `CarSim` (l. 37) sans `lastGroundedAt` | `lastGroundedAt: null` (le compilateur le signale) | 5e S11 |
| `tests/high-stars.test.ts` | `PRE_5E_STARS` (sha1, `STAR_HIGH_PER_RACE` 0) ; 0 ≤ n ≤ 3 ; placement sur les plats ; aucune étoile haute dans [xLancement, xLava] | AP pour `PRE_5E_STARS` ; valeurs 3,90 et 50 / 12 / 20 / 25 relues (S12) ; n = 3 exactement ; règles des plats ordinaires sur fixture à plafond 5 ; +F (aucune dans une tranche fosse) | 5e S10 ; 5e S12 ; 5e S13 ; 5g S1 |
| `tests/high-stars-window.test.ts` | « graine 1 ou première graine 0 à 9 avec une étoile haute », 0,3 s | vert à 3,90 m sans changement (S12) ; puis 1er plat étoile de la graine 1, 0,4 s (0,3 s à +5 cm) | 5e S12 ; 5e S13 |
| `tests/stars.test.ts` | zones admissibles (plats, lancement, réception) ; étoiles d'élan sur tous les volcans (l. 26, 43, 154, 205 à 260) ; 6 à 14 | plats étoile hors zones (S13) ; T pour les étoiles d'élan ; +F (zone = réception moins ± 5 m autour de l'étoile de réception, plancher) ; 6 à 14 au pas mesuré | 5e S13 ; 5g S1 et S2 |
| `tests/generate.test.ts` | volcans consécutifs (l. 74 à 96) ; rampe-saut avant un volcan (l. 140) ; 3 à 7 volcans (l. 149) ; `onlyPlat` ; types présents (l. 167) ; pente hors parois | dernière tranche tirée ; **2 à 7 volcans** ; `onlyPlat` sans plat étoile ; + `'plat-étoile'` (S13) ; + `'fosse'`, parois de fosse exemptées, alternance, phase | 5e S13 ; 5g S1 |
| `tests/stars-pour-tous.test.ts` | graine 1 : 1re étoile **basse** (`findIndex(!s.high)`, déjà) | vérifier que le copain et Galahad n'ont pas une fosse avant cette étoile | 5e S13 ; 5g S2 |
| `tests/slices.test.ts` | géométrie de la rampe-volcan | inchangée ; + `platEtoile` ; + `fosseGeometry`, `fosse` | 5e S13 ; 5g S1 |
| `tests/query.test.ts` | `volcanoes[0]` porte `xElanStart` et `xLip` (l. 33 à 99) | T ; +F (`volcanoAhead`, `nearestVolcanoZone`, `inGhostZone` jusqu'à + 40 m, `nextFosse` ; `inElanZone` faux) | 5g S1 et S2 |
| `tests/safepoint.test.ts` | `volcanoes[0]` (l. 18) : refus sur l'élan et la rampe | T ; +F (zone interdite d'une fosse, garde permise) | 5g S1 et S2 |
| `tests/respawn.test.ts` | séries et cible `xEnd − 10` sur des pistes à ≥ 2 volcans (l. 187 à 271) | T pour `xEnd − 10` ; +F (cible bord aval + 5, respawn groupé vers l'aval, au plus 2 par série) | 5g S1 et S2 |
| `tests/respawn-e2e.test.ts` | `firstVolcano` (flanc amont, vallée, 2 chutes, retourné sur l'élan) | T (`firstTremplin`) ; les 2 chutes à la fosse vont dans `tests/fosses.test.ts` | 5g S2 |
| `tests/fantomes.test.ts` | `firstVolcano` (élan, sortie de zone) | T ; +F (approche, saut, zone jusqu'à + 40 m) | 5g S2 ; 5g S3 |
| `tests/world.test.ts` | capteur du 1er volcan (cratère, rebord à 1,2 m) | T ; +F (capteur d'une fosse : [xBord, xBord + W], haut à 0,3 m au-dessus du sol) | 5g S2 ; 5g S3 |
| `tests/effects.test.ts` | bulles du `volcanoes[0]` | inchangé (champs communs) ; +F (bulles au ras du sol) | 5g S5 |
| `tests/game-frame.test.ts` | voitures posées sur la lave de `volcanoes[0]` | inchangé (une fosse reprend aussi une voiture posée en `xLava`) | 5g S2 (vérifié) |
| `tests/interpolation-replay.test.ts` | graine 1, 40 s doigt posé : nombre d'épisodes ; téléportation au 1er volcan | AP (`recordTrajectory(…, cfg)`) | 5e S10 |
| `tests/observer.test.ts` | `runFrom` au 1er volcan (élan) | T | 5g S2 |
| `tests/race-smoke.test.ts` | cas 6 : 0 respawn, 110 à 170 s, 6 à 14 étoiles ; à 5 voitures : ≤ 3 respawns ; « 5 dans la lave » au 1er volcan | bornes remesurées (S13) ; SP pour le cas 6 et Galahad à 5 voitures ; copains provisoires sauteurs ; T pour « 5 dans la lave » ; +F (5 dans la fosse) | 5e S13 ; 5g S2 ; 5g S3 |
| `tests/rampes.test.ts` | toutes les rampes-saut des graines ; saut des volcans (l. 70, champs communs) | inchangé ; durée vérifiée (le plus long fichier de la CI) | 5e S13 ; 5g S2 |
| `tests/volcans.test.ts` (+ `helpers/cases.ts`) | cas 1 à 5 sur le 1er volcan des graines 0 à 2 | T | 5g S2 |
| `tests/render-smoke.test.ts` | dessin d'une piste à volcans | +F (fosse, panneau, pas de plot au-dessus de la lave, cône réservé aux tremplins) | 5g S5 |
| `tests/smoke.test.ts` | constantes | nouvelles constantes et valeurs ; S12 : 3,90 et 50 / 12 / 20 / 25 (test rouge du Step) | 5e S11, S12 et S13 ; 5g S2 |
| `tests/slow/race-invariants-*.test.ts` | `lavaByCar.galahad === 0`, aucune chute propre | SP ; chutes par type de volcan ; copains provisoires sauteurs | 5g S2 |
| `tests/slow/finish.test.ts` | cas 6, graines 0 à 4 : 0 respawn, 6 à 14 étoiles, 110 à 170 s | bornes remesurées (S13) ; SP | 5e S13 ; 5g S2 |
| `tests/slow/stars-sim.test.ts` | graine 1 : arrivée sans réapparition | SP | 5g S2 |
| `tests/slow/volcans-slow.test.ts` | cas 7 : ≤ 2 respawns par volcan ; scénario (i) rampe-saut → plat → volcan | cas 7 : « au plus 2 par série » ; T pour (i) ; + (ii), (iii) | 5g S2 ; 5g S6 |
| `tests/slow/saut-volcan-0-4.test.ts`, `-5-9.test.ts` (5e S11) | `xElanStart`, `xLip` des volcans | T (`saut-rampes` ne vise que les rampes-saut : inchangé) | 5g S2 |
| `tests/slow/high-stars-sim.test.ts` (5e S14) | Galahad doigt posé sans saut, 5 voitures, graines 0 à 23 : 0 prise d'étoile haute | Galahad tombe aux fosses à partir de la 5g : SP (les sauts de fosse n'atteignent pas une étoile de plat étoile, testé) ou sans saut avec 2 chutes par fosse admises | 5g S2 |
| `tests/slow/dosage.test.ts` | 1er volcan de la graine 0, tremplins des graines 0 à 2 | AP (`worldFor(seed, cfg)`) | 5e S10 |
| `tests/slow/phases.test.ts`, `phases-dense.test.ts` | volcans des graines 0 à 9 | AP (par `variantTrack`) | 5e S10 |
| `tests/slow/interpolation-replay-slow.test.ts` | 12 courses à 5 voitures, doigt posé | AP (`recordTrajectory(…, cfg)`) | 5e S10 |
| `tests/slow/calibration-saut-*.test.ts` | pistes de la calibration du Step 8 | AP (par `cfgFor`) | 5e S10 |
| `tests/slow/rattrapage-*.test.ts` | comparaison appariée depuis la 5d | voir `helpers/rattrapage.ts` | 5e S10 |
| `tests/slow/race-objective.test.ts` (tâche 7) | Galahad doigt posé | à trancher en tâche 7 : Galahad avec SP (le joueur saute) | 7 |
| `e2e/race.spec.ts` (`?seed=1`) | captures `course.png`, `arrivee.png` ; course courte `len=300` doigt posé | captures refaites ; à 300 m, aucun plat étoile et une fosse possible : l'arrivée reste sous le délai de 150 s (option B : ≈ + 5 s) | 5e S15 ; 5g S5 |
| `e2e/jump.spec.ts` (`?seed=1`) | tap, Espace, HUD ; capture `bouton-saut.png` | inchangé ; « bouton grisé » relu avec la tolérance (gris 0,35 s après le décollage, pas avant) | 5e S11 |

## Budget CI (v1.6)

- **Aujourd'hui** (MESURÉ ici, 4 cœurs, code de 4a414c6) : `npm test`, 441 tests, **≈ 130 s** mur (129,3 s ; 131,5 s à la relecture) pour ≈ 300 s de CPU. La CI réelle met 2 min 01 à 2 min 18 (relecture). `tests/rampes.test.ts`, le plus long fichier, fixe la durée. La limite reste 6 min sur le runner.
- **Coûts unitaires** (MESURÉ) :
  - une course complète : **13,1 s** avec Galahad seul, **13,7 s** à 5 voitures (MESURÉ (relecture)) ;
  - un run de fosse en monde rogné (lancé quelques secondes avant le bord, arrêté à l'atterrissage + 3 s) : **≈ 0,06 s** (sonde v1.6 : 98 runs en 5,5 à 6,1 s, par cas) ; un run de `fosses-a`, parti 100 m avant la tranche précédente : ≈ 0,24 s (MESURÉ (relecture)) ;
  - un saut au sommet d'un tremplin ou d'une rampe-saut : **≈ 0,13 s** (2 576 sauts en 338 s) ;
  - un lancer de 9 s sur piste plate (`jump-grace`) : **≈ 0,27 s** (24 lancers en 6,4 à 6,7 s) ;
  - un appui servi ou perdu, sur la suite « au sol / en l'air » : ≈ 0.
- **Ajouts en CI** (CPU) :
  - fin de la 5e, ≈ + 30 s :
    - `anciennes-pistes` : sha1 de 70 pistes, ≈ 2 s ;
    - `jump-grace` : 4 cas × 24 lancers de 9 s, **≈ 26 s** (MESURÉ), plus les tests unitaires de la tolérance, ≈ 2 s ;
    - `high-stars` et `high-stars-window` sont déjà en CI, à coût à peu près égal ;
  - 5g, `tests/fosses.test.ts` : **≈ 25 s, plafond 60 s** (CALCULÉ à 0,06 s par run) :
    - partie statique et fonctions pures : ≈ 1 s ;
    - (a) 5 runs, 5 m/s 14 runs, `fosseJumpWanted` 3 runs : ≈ 1,5 s ;
    - 3 blocs centraux de 26 runs (témoin compris) : ≈ 5 s ;
    - 2e chute, retournement, 5 voitures, fantômes : ≈ 8 runs, ≈ 3 s ;
    - une course complète de Galahad seul sans saut : 13,1 s.

    La durée est imprimée au Step 3. Au-delà de 60 s, la course complète sort de la CI : `race-sans-saut-*` la fait déjà, sur 24 graines.
  - Chaque ajout est un fichier à part : Vitest parallélise par fichier, et le mur reste fixé par `rampes.test.ts`.
- **Estimation : ≈ + 55 s de CPU, ≈ 2 min 15 à 2 min 30 mur ici**, la CI réelle sous 3 min, loin des 6 min. Si un run CI dépasse 4 min, réduire d'abord `rampes.test.ts` aux graines 0 à 2 (mineur différé de la tâche 4).
- **Suite lente** (`npm run test:slow`) : chaque fichier sous 30 min mur, et sous 20 min pour les fosses et les sauts ; budget écrit en tête.

  | Fichier | Contenu | Coût attendu | Budget |
  |---|---|---|---|
  | `fosses-a` | ≈ 3 400 runs ; témoin vivant sur 2 pistes de la recette, ≈ 130 runs | ≈ 14,5 min (MESURÉ (relecture)) | 20 min |
  | `fosses-fenetres-vitesses`, `-terrain-0-7`, `-terrain-8-15` (tour 1 ; remplacent `-0-4` et `-5-9`) | 22, 16 et 16 cas × 98 runs (122 quand la fenêtre dépasse 1,6 s) | 7,6, 6,4 et 6,6 min (MESURÉ, en parallèle) | 10 min chacun |
  | `race-sans-saut-0-11`, `-12-23` | 12 courses à 5 voitures et 12 de Galahad seul chacun | ≈ 12 × (13,7 + 13,1) s ≈ 5,5 min chacun | 15 min chacun |
  | `saut-volcan-0-4` | 23 tremplins × 4 cas × 28 sauts = 2 576 sauts | ≈ 5,6 min (MESURÉ) | 15 min |
  | `saut-volcan-5-9` | 20 tremplins, ≈ 2 240 sauts | ≈ 4,9 min | 15 min |
  | `saut-rampes` | 38 rampes-saut × 2 cas × 28 sauts ≈ 2 130 sauts | ≈ 4,6 min | 15 min |
  | `high-stars-sim` | (5e) | < 25 min | 25 min |
  | `volcans-slow` | scénarios (ii) et (iii) en plus | + 5 min | budget d'avant + 5 min |

  Les comptes de `saut-*` sont ceux des pistes du Step 11 (43 tremplins et 80 rampes-saut sur les graines 0 à 9). Après la 5g, les tremplins sont ≈ 2 fois moins nombreux.

  Durée totale attendue avec 4 cœurs : ≈ 75 min de CPU en plus, soit ≈ + 20 min mur par rapport à aujourd'hui.

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
- **Q6 — Saut juste après un décollage. Remplacé par P11** (tolérance de sol de 0,35 s, décision du papa, 0718977 ; 5e, Step 11).
  - Ancienne décision : on gardait le contact débouncé de l'addendum, donc un saut restait possible jusqu'à 0,1 s après un décollage.
  - L'effet a été mesuré et remonté au papa, qui a choisi la tolérance de sol (saut §1, §6.2).
- **Q7 — Bouton pendant le décompte ou la pause.**
  - Décision : renvoyé à la tâche 10. Les demandes y sont jetées (`JumpInput.clear`).
- **Q8 — Patience des robots polis.**
  - Décision : `POLITE_MAX_WAIT` = 3 s. Ensuite le robot repart, comme aujourd'hui.
  - Garde : l'e2e exige au moins 2 s.
- **Q9 — Rattrapage.**
  - Décision : mesure consignée, appariée par graine, sans seuil d'assertion.
  - Ajout : une variante « Galahad sauteur ».

### Rulings v1.5 et v1.6 (fosses, plats étoile, tolérance de sol ; saut §6)

Chacun est à confirmer par les relectures de la v1.6 ; « coût si faux » comme au registre.

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
  - Dégagements de réception (demande du papa, 5g) : pas d'étoile basse du curseur avant `xReception + STAR_TREMPLIN_LANDING` (55 m) sur un tremplin, ni avant `xReception + STAR_FOSSE_LANDING` (22 m) sur une fosse ; `STAR_TREMPLIN_LANDING: 0` dans `ANCIENNES_PISTES`.
  - Le pas du curseur est ajusté sur mesure, la cible ne bouge pas : **[35, 58]** (Step 7).
  - Coût si faux : quelques étoiles.
- **R-F7 — Jeu de la 5e : 50 / 12 / 20 / 25.** C'est le plus permissif des 4 jeux à 0 prise sans saut à 3,90 m (calibration de la 5e). Coût si faux : 4 constantes.
- **R-F8 — Plat étoile.**
  - Tranche `'plat-étoile'` de 57 m, étoile à + 32 m, jamais juste après une rampe-saut, **pas après un volcan** (décision du papa, relectures de la 5e, a105e2b ; en 5g, pas non plus après une fosse), élan de l'étoile hors des 50 m qui suivent une rampe-saut, pas de fusion, pas d'étoile basse dessus. Jeu des ancres si les N plats étoile ne tiennent pas (spec §6.6).
  - Les étoiles des plats étoile passent d'abord ; `STAR_HIGH_PER_RACE` plafonne le total. Les étoiles hautes de repli des plats ordinaires (pistes courtes) suivent la même règle « pas après un volcan » et restent à 45 m les unes des autres.
  - Coût si faux : une règle d'insertion.
- **R-F9 — Copains provisoires en 5g** : ils redemandent le saut à chaque pas de leur fenêtre, sans erreur, au centre `fosseJumpLead(v)`, jusqu'à la tâche 6. Sans cela, les invariants à 5 voitures n'auraient plus de sens entre la 5g et la 6. Coût si faux : nul (code retiré en tâche 6).
- **R-F10 — Empreinte.**
  - `ANCIENNES_PISTES` garde les hash figés sur la 5c.
  - `FROZEN_CONFIG` est recapturé en fin de 5e, en 5g, au tour 1 de la 5g (pas de tremplin juste après une double-bosse), puis au tour 2 (poids de tirage des volcans 4). Chaque fois, le registre reçoit les anciens et les nouveaux hash, le commit, la raison (P10, puis la décision du papa) et la preuve que l'empreinte `ANCIENNES_PISTES` n'a pas bougé.
  - Toute autre variation de l'empreinte reste un défaut.
- **R-F11 — Chute « fosse »** : dans les invariants, une chute dans une fosse sans saut est attendue. Elle n'est ni « choc » ni « propre ». Une chute propre à un tremplin reste un échec.
- **R-F12 — Voitures catapultées** : une étoile haute prise sans saut n'est tolérée que dans les 2 s après un contact entre voitures ; elle est comptée et imprimée. Jusqu'au tour 1 de la 5g, pour les copains seulement ; amendé au tour 2 (décision du papa) : pour Galahad aussi (graine 5, retombé sur le toit de Liam et catapulté sur l'étoile 1,15 s après). Une prise sans saut ni contact reste un échec, pour toute voiture.
- **R-F13 — e2e** : pas d'assertion sur un saut à la main à l'instant juste (Playwright n'est pas régulier à 16 ms près). Le saut juste est couvert par les fenêtres (b) et (c) en simulation. Les réapparitions de Galahad sont exposées en `?debug=1` (`__game.respawns`).
- **R-F14 — Tolérance de sol (P11) : comment on la teste.** Le test « 0 appui perdu » se calcule sur la suite « au sol / en l'air » d'une course sans saut, sans relancer la physique par appui.
  - Exigé : 0 à 11,2 et à 14 m/s, et avec un turbo pris à 14 m/s (MESURÉ : 0 sur 8 640 chacun).
  - À 21 m/s **tenus** (facteur 1,5 permanent), la part perdue est imprimée et bornée à 0,5 % (MESURÉ : 0,41 %, rebonds jusqu'à 0,77 s). Accepté par le papa : Q-F6, c73faf5.
  - Coût si faux : un appui sur 250 perdu en turbo enchaîné.
- **R-F15 — Option B, respawn groupé vers l'aval** : la cible « bord aval + 5 m » avance de 1,5 × `CAR_LENGTH` par voiture déjà posée, 4 fois au plus. Reculer la ramènerait vers la lave. Coût si faux : quelques mètres.
- **R-F16 — Zone fantôme d'une fosse jusqu'à bord aval + 40 m**, quelle que soit l'option : les sauteurs atterrissent jusqu'à ≈ 32 m, et une voiture posée à + 5 m y attend. Coût si faux : des voitures qui se traversent 40 m de plus. À revérifier en tâche 7 (copains sous élastique : ≈ 44 m).
- **R-F17 — Fenêtres des fosses : bloc central en CI, balayage entier en suite lente** (v1.6).
  - La CI prouve l'exigence elle-même : 0,4 s d'un seul tenant autour de l'instant visé par les copains, 25 appuis par cas.
  - La suite lente balaie chaque pas des 1,6 s avant le bord. Tour 1 : sur une seule fosse, en faisant varier vitesse, turbo, tranche d'avant et saut d'étoile haute (les fosses des graines 0 à 9 ne donnaient que 4 trajectoires) ; le balayage recule par blocs de 0,4 s si la fenêtre déborde. La fenêtre principale y tient entière (au plus 1,47 s à vitesse tenue, 1,85 s quand le turbo finit dedans, MESURÉ).
  - Coût si faux : un bord de fenêtre qui recule n'est vu qu'en suite lente.
