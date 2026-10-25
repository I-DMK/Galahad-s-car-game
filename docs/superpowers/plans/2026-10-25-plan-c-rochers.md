# Tâche 11c — Rochers (plan C) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Régime physique** : un implémenteur frais pour toute la tâche, puis **quatre relectures** du diff (standard, adversariale avec sondes et mutants, skill `code-review`, skill `security-review`), tours de correction (≤ 5), suite lente, **validation du papa sur capture puis sur la tablette** avant la fusion. Jamais de PR.

**Statut :** v1 (2026-10-25), écrit depuis la spec validée ; **à relire contre le code dans un worktree avant l'implémenteur** (leçon des sessions 5 à 7).

**Goal:** Poser jusqu'à 4 rochers par course sur les plats et les réceptions de fosse ; doigt posé sans sauter, la voiture bute (vitesse ramenée à 2 m/s, ≈ 1,2 s perdues, jamais de réapparition) ; un saut bien placé passe au-dessus (fenêtre 0,77 / 0,88 s à 11,2 / 14 m/s) ; les copains sautent avec leur caractère ; le rocher éclate quand on le touche.

**Architecture:** Un rocher est un **capteur** Matter (rectangle `[xStart, xStart + 3] × [sol, sol + 1,6]`) posé par le générateur **après tous les autres tirages** (terrain et étoiles inchangés au bit près), avec un **état par voiture** (`hitAt[k]`, comme les étoiles) et un masque de collision égal au OU des voitures qui ne l'ont pas encore touché. Au contact, `collectRocks` (dans `stepRace`, phase d'après `stepWorld`, comme `collectStars`) ramène chaque pièce de la voiture à 2 m/s, la rend traversable 1,5 s par le mécanisme existant de l'invulnérabilité, et émet l'événement `'rock'`. Le driver des copains gagne `nextRock` et une fenêtre `inRockJumpWindow` (centre `rockJumpLead(v)`, erreur des fosses). Le rendu dessine le rocher par code (polygone gris, ombre) tant que Galahad ne l'a pas touché, puis des éclats (`Effects.rockBurst`).

**Tech Stack:** TypeScript 5.7 strict, Vite 8, Vitest 5 (+ jsdom), Playwright 1.56, matter-js 0.20. **Aucune nouvelle dépendance.**

**Spec :** `docs/superpowers/specs/2026-10-25-rochers-design.md` (toutes les décisions du papa Q-C1 à Q-C8 et Q-C4 bis, mesures, constantes). Références ci-dessous : « spec §n ». Documents de fond : addendum « bouton saut » (`2026-10-21-bouton-saut-design.md`, §1 saut, §6.8 fenêtre des fosses, §6.9 interrupteur `ANCIENNES_PISTES`), passation `docs/superpowers/handoff/2026-10-21-plan-b-passation.md` (méthode, environnement), registre `sdd-ledger-plan-b.md`.

**État de départ :** tâche 11 et correctif 1.2.1 déployés ; spec de la 11c commitée (`2fc3b32`). **BASE = la tête de `wip-plan-b` au départ de la session d'exécution** (`origin/ccr-5b6fabc4-n96ofo` = `b405e2f` en est l'ancêtre : la fusion finale se fait en avance rapide si rien d'autre n'a été fusionné entre-temps, sinon fusion normale). Avant le Step 1, le contrôleur écrit BASE en clair au registre (première ligne « Task 11c: »). BASE est **recopié en clair** dans chaque commande qui en a besoin (Steps 2, 27 et 32, notés `<BASE>` : une variable de shell ne survit pas d'un appel d'outil à l'autre).

## Global Constraints

- **Galahad seul identique au bit près hors rochers** : `tests/empreinte.test.ts` : `FROZEN` (pistes d'avant, `ANCIENNES_PISTES`, donc `ROCKS_PER_RACE` 0) **inchangé** ; `FROZEN_CONFIG` recapturé **par ruling R-F10** seulement si Galahad doigt posé touche un rocher dans les 30 premières secondes des graines 0 à 2 (registre : anciens et nouveaux hash, commit, raison, preuve que `FROZEN` n'a pas bougé dans le même commit). Toute autre variation est un défaut. Sans rocher touché, aucun chemin de code des rochers ne modifie une pièce de voiture (spec §2.1).
- **Terrain et étoiles inchangés** : avec `CONFIG` comme avec `ROCKS_PER_RACE` = 0, `points`, `slices`, `volcanoes`, `exemptPointIndices` et `stars` de chaque piste sont ceux de BASE (fixture de hash du Step 2). `placeRocks` ne tire sur le `rng` qu'après `placeStars` (spec §3).
- **Un rocher ne cause jamais de réapparition** (spec §0) : aucun `respawn` dans les 3 s après un `'rock'`, pour toute voiture, piste plate et vraies pistes, Galahad seul et à 5 voitures.
- Promesse « doigt posé sans sauter, on finit toujours » gardée ; les promesses des tremplins et des fosses (saut §6.1) ne changent pas ; `inNoJumpZone`, la garde `autoJumps`, l'élastique, la politesse et le lever de pied ne changent pas.
- Valeurs de la spec §7, copiées telles quelles : `ROCKS_PER_RACE` 4, `ROCK_WIDTH` 3, `ROCK_HEIGHT` 1.6, `ROCK_HIT_SPEED` 2, `ROCK_HIT_TRAVERSABLE` 1.5, `ROCK_MIN_PLAT` 20, `ROCK_RAMP_CLEARANCE` 50, `ROCK_VOLCANO_GAP` 60, `ROCK_HIGH_STAR_LANDING` 30, `ROCK_STAR_GAP` 10, `ROCK_SPACING` 60, `ROCK_JUMP_AIM` 1, `ROCK_JUMP_LATE` 0.5. `ANCIENNES_PISTES` gagne `ROCKS_PER_RACE: 0`.
- Plan B : une seule dépendance d'exécution ; `track/`, `cars/`, `loop/`, `ai/` sans DOM ni matter-js, `render/` sans matter-js, aucun cycle d'import (`tests/deps.test.ts`) ; `sim/simulate.ts` : aucune allocation par pas dans les chemins chauds (`fillContext`, `collectRocks` : boucles sur des tableaux existants) ; pas de `@types/node`.
- Version `1.3.0` dans `package.json` (décision Q3 de la 10 : +1 par tâche déployée) ; `package-lock.json` n'est pas touché (sa `version` est déjà décalée : écart connu, registre de la 11).
- `npm run typecheck` et `npm test` verts à chaque commit ; jamais de `.skip` ; `npm test` < 6 min sur le runner (les balayages entiers et les courses à 5 voitures vont dans `tests/slow/`).
- Commits en français préfixés `feat:` / `fix:` / `test:` / `chore:` / `docs:`, trailers de la session, aucun identifiant de modèle. Code, commentaires et docs en français ; `tests/zz-probe-*` jamais commités ; commits ciblés (`git commit -- <chemins>`) ; jamais de `git reset` / `checkout` / `stash` / `clean` pendant qu'un autre agent travaille dans l'arbre ; sauvegarde `git push origin wip-plan-b` après chaque commit d'implémentation (leçon de la session 7).
- **Retour arrière** si la tâche déployée déplaît : `ROCKS_PER_RACE: 0` est un repli d'une ligne (pistes d'aujourd'hui au bit près) ; sinon `git revert` des commits de la 11c sur `ccr-5b6fabc4-n96ofo`, push, CI verte, `npm run e2e:live`.

## Environnement (conteneur)

Playwright 1.56.1 attend Chromium **1194**, le conteneur a la **1243** : dossier de liens dans le scratchpad et `PLAYWRIGHT_BROWSERS_PATH` **devant chaque commande Playwright** (commande de création : plan de la 8b, `docs/superpowers/plans/2026-10-24-plan-b-images.md`, section « Environnement »). Noté `<scratchpad>/pw-browsers` ci-dessous, à recopier en clair.

```bash
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npx playwright test e2e/rochers.spec.ts
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live
```

Le skill `security-review` a besoin de `origin/HEAD` : `git remote set-head origin ccr-5b6fabc4-n96ofo`. `npm test` ≈ 3 min, `npm run test:slow` ≈ 15 min, `npm run test:slow:race` ≈ 25 min, `npm run test:slow:rattrapage` ≈ 7 min.

## Review Focus

1. **Choc en l'air.** Une voiture qui retombe d'un saut raté (trop tard) touche le rocher par une roue avant encore en l'air : la norme de chaque pièce passe à 2 m/s, vitesse verticale comprise ; elle ne doit ni se retourner ni réapparaître, et retomber sur ses roues. Test « saut 0,3 s avant le rocher à 14 m/s » (Step 11).
2. **Choc puis rocher suivant proche.** Deux rochers à 60 m (`ROCK_SPACING`) : après le premier choc, la voiture repart de 2 m/s et arrive au second à ≈ 13 m/s ; elle doit pouvoir le sauter (fenêtre ≥ 0,7 s) et, sans saut, le toucher sans réapparition. Test « deux rochers à 60 m » (Step 11).
3. **Rocher sur une réception de fosse, voiture posée à + 5 m.** Deux chutes dans la fosse → posée à bord aval + 5 m, à l'arrêt, à 30 m du rocher : doigt posé elle le touche (≈ 13 m/s, pas de réapparition, pas de 3e « chute ») ; un saut au centre passe. Test « réception de fosse » (Step 11) et e2e si la graine choisie s'y prête.
4. **Masque du capteur à 5 voitures.** Galahad touche un rocher : il doit rester actif pour les 4 copains (et dessiné pour Galahad disparaître) ; un copain traversable qui le traverse à 2 m/s ne doit pas déclencher un second choc. Tests « état par voiture » (Step 7) et « 5 voitures » (Step 24).
5. **Pistes courtes et `ROCKS_PER_RACE` = 0.** `?len=300` : 0 rocher, aucune exception, aucun tirage de plus ; `ROCKS_PER_RACE` = 0 : `Track.rocks` vide, aucun capteur créé, `Scene.rocks` vide, `nextRock` toujours null, tirages des drivers inchangés. Tests du Step 4 et du Step 17.

## Structure des fichiers

| Fichier | Rôle | Partie |
|---|---|---|
| `src/config.ts` | 13 constantes `ROCK_*` et `ROCKS_PER_RACE` (spec §7) | 1 |
| `src/track/types.ts` | `Rock`, `Track.rocks` | 1 |
| `src/track/rocks.ts` (créé) | `rockCandidates`, `placeRocks` (pur) | 1 |
| `src/track/generate.ts` | appel de `placeRocks` après `placeStars` | 1 |
| `src/track/query.ts` | `nextRock(track, x)` | 1 |
| `tests/helpers/anciennes-pistes.ts`, `tests/helpers/fosses.ts` (`trackOf`), `tests/helpers/jump-runs.ts` (`rampSautTrack`) | `ROCKS_PER_RACE: 0` ; `rocks: []` dans les pistes synthétiques | 1 |
| `tests/fixtures/pistes-base.json` (créé), `tests/rochers-piste.test.ts` (créé) | hash des pistes à BASE ; tests statiques du §3 | 1 |
| `src/cars/rocks.ts` (créé) | `RockState`, `newRockStates`, `isRockActiveFor`, `hitRockFor` (pur) | 2 |
| `src/physics/rocks.ts` (créé) | `createRockBodies`, `syncRockBodies` | 2 |
| `src/physics/car.ts` | `applyRockHit(car, cfg)` | 2 |
| `src/sim/simulate.ts` | `RaceSim.rocks`, `rockBodies` ; événement `'rock'` ; `collectRocks` ; `Scene.rocks` dans `sceneOf` | 2, 4 |
| `tests/helpers/rochers.ts` (créé), `tests/rochers.test.ts` (créé), `tests/slow/rochers-fenetres.test.ts` (créé) | harnais piste plate, cas physiques, fenêtres entières | 2 |
| `tests/empreinte.test.ts` | `FROZEN_CONFIG` recapturé si besoin (R-F10) | 2 |
| `src/cars/jump.ts` | `rockJumpLead`, `rockLatestLead`, `inRockJumpWindow`, `rockJumpWanted` | 3 |
| `src/ai/driver.ts` | `DriverContext.nextRock`, `RobotDraws.rockErr`, demande de saut de rocher | 3 |
| `src/sim/simulate.ts` | `fillContext` : `nextRock` (curseur, sans allocation) | 3 |
| `tests/helpers/fosses.ts` | `sauteurParfait` saute aussi les rochers | 3 |
| `tests/jump.test.ts` ou `tests/fosses.test.ts`, `tests/driver.test.ts`, `tests/slow/robots-rochers-0-23.test.ts` et `-24-47` (créés), `tests/helpers/robots-rochers.ts` (créé) | fenêtre pure, driver, chocs par bras | 3 |
| `src/render/renderer.ts` (`Scene.rocks`), `src/render/track.ts` (`drawRock`), `src/render/effects.ts` (`rockBurst`) | rendu et éclats | 4 |
| `src/game.ts` | événement `'rock'` → `rockBurst` ; `rocksHit`, `rocks`, `rockJumpLead` pour `?debug=1` | 4 |
| `package.json` | `"version": "1.3.0"` | 4 |
| `tests/render-smoke.test.ts`, `tests/effects.test.ts`, `tests/game-frame.test.ts` | rendu, éclats, câblage | 4 |
| `e2e/rochers.spec.ts` (créé), `e2e/helpers.ts` | rocher à l'écran, choc, éclats, saut | 4 |
| `tests/slow/race-*.test.ts`, `tests/slow/rattrapage-*.test.ts`, `tests/helpers/race.ts` | rochers dans les invariants et le rattrapage | 5 |
| passation, registre | lignes de la tâche 11c | 6 |

---

## Partie 1 — Piste : constantes, `Rock`, `placeRocks` (Steps 1 à 5)

**Files:**
- Create: `src/track/rocks.ts`, `tests/rochers-piste.test.ts`, `tests/fixtures/pistes-base.json`
- Modify: `src/config.ts`, `src/track/types.ts`, `src/track/generate.ts` (l. 201 : après `placeStars`), `src/track/query.ts`, `tests/helpers/anciennes-pistes.ts`, `tests/helpers/fosses.ts` (`trackOf`, l. 51–54), `tests/helpers/jump-runs.ts` (`rampSautTrack`, l. 195 : `{ ...t, stars: [], rocks: [] }`), `tests/generate.test.ts`

**Interfaces (produit) :**

```ts
// src/track/types.ts
/** Rocher (plan C, tâche 11c, spec §1) : boîte [xStart, xEnd] × [sol, sol + ROCK_HEIGHT], sur du plat. */
export interface Rock { id: number; xStart: number; xEnd: number }
export interface Track { /* … */ rocks: Rock[] }

// src/track/rocks.ts — pur (ni DOM, ni matter-js)
/** Places possibles (xStart), une par plat ordinaire éligible et par réception de fosse, dans l'ordre de la piste (spec §3). */
export function rockCandidates(track: Track, cfg: Config): number[];
/** Au plus ROCKS_PER_RACE rochers : toutes les candidates, ou ROCKS_PER_RACE tirées sans remise par `rng` ; ordre de la piste, ids 0, 1, 2… ; `[]` sans tirage si ROCKS_PER_RACE = 0. */
export function placeRocks(track: Track, rng: () => number, cfg: Config): Rock[];

// src/track/query.ts
/** Premier rocher dont xStart > x, undefined sinon ; sans allocation. */
export function nextRock(track: Track, x: number): Rock | undefined;
```

Règles de `rockCandidates` (spec §3, une candidate par place, `W` = `ROCK_WIDTH`) :
- plat ordinaire : `slices[i]` de type `'plat'`, `i > 0`, `xEnd ≤ xFinish − FINISH_PLAT_BEFORE`, longueur ≥ `ROCK_MIN_PLAT`, `slices[i − 1].type` ni `'rampe-volcan'` ni `'fosse'` ; intervalle `[lo, hi]` de `xStart` : `lo = max(sl.xStart, track.xStart + D_LANCE, fin de la dernière rampe-saut avant ≤ sl.xStart + ROCK_RAMP_CLEARANCE, dernière étoile haute avant sl.xStart + ROCK_HIGH_STAR_LANDING)`, `hi = min(sl.xEnd − W, début de la prochaine tranche volcan ≥ sl.xEnd − ROCK_VOLCANO_GAP − W)` ;
- réception de fosse : `lo = f.xReception + FOSSE_STAR_AFTER + ROCK_STAR_GAP`, `hi = f.xEnd − W − 5`, mêmes dégagements volcan et rampe-saut ;
- position : le point de `[lo, hi]` le plus proche du centre `(lo + hi) / 2` (balayage à `TRACK_POINT_SPACING`) tel qu'aucune étoile basse ne soit dans `]x − ROCK_STAR_GAP, x + W + ROCK_STAR_GAP[` ; aucun → pas de candidate ;
- `hi < lo` → pas de candidate ; espacement : glouton dans l'ordre de la piste, candidate écartée si `|x − dernière retenue| < ROCK_SPACING`.

- [ ] **Step 1 : Constantes et types.** Dans `src/config.ts`, après le bloc des fosses : les 13 constantes de la spec §7 avec un commentaire d'une ligne chacune (valeur mesurée ou décision citée). Dans `src/track/types.ts` : `Rock`, `Track.rocks`. `npm run typecheck` → erreurs attendues sur les littéraux `Track` (`generate.ts` l. 197–200, `tests/helpers/fosses.ts` `trackOf`, `tests/helpers/jump-runs.ts` `rampSautTrack`) : y ajouter `rocks: []` (le générateur le remplit au Step 3). `npm run typecheck` → 0.

- [ ] **Step 2 : Fixture des pistes de BASE** (preuve « terrain et étoiles inchangés »). Script jetable (`tests/zz-probe-pistes-base.test.ts`, supprimé) qui, sur `<BASE>` **avant tout changement du générateur** (ce Step se fait avant le Step 3 ; si le Step 1 est déjà commité, les pistes sont encore celles de BASE : `rocks: []`), écrit `tests/fixtures/pistes-base.json` : pour les graines 0 à 49 à 1 680 m, et 0 à 19 à 300, 600 et 1 000 m, un sha1 (Float64 bruts, comme `tests/helpers/fingerprint.ts`) de `points`, `exemptPointIndices`, `slices` (type, xStart, xEnd), `volcanoes` (tous les champs numériques) et `stars` (id, x, y, high), sous `CONFIG`. Puis le test permanent dans `tests/rochers-piste.test.ts` :

```ts
test.each([[1680, 50], [300, 20], [600, 20], [1000, 20]])('%i m : terrain et étoiles identiques à BASE, avec CONFIG et avec ROCKS_PER_RACE = 0', (len, n) => { /* hash de chaque graine === fixture */ });
```

Run : `npx vitest run tests/rochers-piste.test.ts` → vert (encore sans rocher). Commit : `git commit -m "test: empreinte des pistes de BASE (terrain et étoiles) pour la tâche 11c" -- tests/fixtures/pistes-base.json tests/rochers-piste.test.ts src/config.ts src/track/types.ts src/track/generate.ts tests/helpers/fosses.ts tests/helpers/jump-runs.ts`

- [ ] **Step 3 : Tests statiques des rochers** dans `tests/rochers-piste.test.ts` (graines 0 à 49, 1 680 m, `generateTrack(seed, 1680, CONFIG)`) :

```ts
test('au plus 4 rochers par piste, 4 sur au moins 30 pistes sur 50, aucune piste à 0 ; ids 0, 1, 2… dans l’ordre de la piste', …);
test('chaque rocher : largeur ROCK_WIDTH, sur un plat ordinaire éligible (≥ 20 m, pas après un volcan, pas le plat d’arrivée) ou une réception de fosse (xStart ≥ bord aval + 35, xEnd ≤ xEnd − 5) ; sol à 0 sous tout le rocher', …);
test('dégagements : ≥ D_LANCE après xStart ; ≥ 50 m après la fin de toute rampe-saut ; ≥ 60 m avant le début de toute tranche volcan ; ≥ 30 m après toute étoile haute ; ≥ 10 m de toute étoile basse ; ≥ 60 m entre deux rochers', …);
test('déterminisme : deux générations identiques ; ENCORE (même graine) donne les mêmes rochers', …);
test('ROCKS_PER_RACE = 0 : rocks vide ; pistes courtes (?len=300) : 0 ou plus, aucune exception, au plus ROCKS_PER_RACE', …);
test('rockCandidates : 4,20 ± 0,3 candidates par piste en moyenne sur les graines 0 à 49 (prototype de la spec : 4,20, 2 à 7) ; imprimé', …);
test('nextRock : premier rocher strictement devant x, undefined après le dernier', …);
```

Run : `npx vitest run tests/rochers-piste.test.ts` → FAIL (`placeRocks` absent).

- [ ] **Step 4 : `src/track/rocks.ts`, `nextRock`, appel dans `generateTrack`** : `track.rocks = placeRocks(track, rng, cfg)` **juste après** `track.stars = placeStars(track, rng, cfg)` (l. 201 ; `buildTrack` rend le `track` complet). `ANCIENNES_PISTES` gagne `ROCKS_PER_RACE: 0` (commentaire : tâche 11c). Si la moyenne des candidates sort de 4,20 ± 0,3 ou qu'une piste tombe à 0 avec toutes les règles : **ne pas régler** les dégagements ; le dire au contrôleur, qui pose la question au papa avec les leviers de la spec §3.

- [ ] **Step 5 : Vert et commit** : `npx vitest run tests/rochers-piste.test.ts tests/generate.test.ts tests/anciennes-pistes.test.ts tests/stars.test.ts tests/high-stars.test.ts tests/fosses.test.ts` → vert (le test de BASE du Step 2 reste vert : terrain et étoiles n'ont pas bougé), `npm run typecheck` → 0, `npm test` → vert. Commit : `git commit -m "feat: rochers du plan C posés par le générateur (au plus 4, plats et réceptions de fosse, après tous les tirages)" -- src/track/rocks.ts src/track/generate.ts src/track/query.ts tests/helpers/anciennes-pistes.ts tests/rochers-piste.test.ts` ; `git push origin wip-plan-b`.

---

## Partie 2 — Physique : capteurs, choc, traversable, événement (Steps 6 à 13)

**Files:**
- Create: `src/cars/rocks.ts`, `src/physics/rocks.ts`, `tests/helpers/rochers.ts`, `tests/rochers.test.ts`, `tests/slow/rochers-fenetres.test.ts`
- Modify: `src/physics/car.ts`, `src/sim/simulate.ts` (`SimEvent`, `RaceSim`, `createRaceSim`, `stepRace` après `collectStars`, `syncStarBodies`), `tests/helpers/jump-runs.ts` (`soloSim` : `rocks`, `rockBodies`), `tests/empreinte.test.ts` (si recapture)

**Interfaces (produit) :**

```ts
// src/cars/rocks.ts — pur
export interface RockState { id: number; /** Par index de voiture : instant (s) de son choc, null si jamais. */ hitAt: (number | null)[] }
export function newRockStates(rocks: Rock[], carCount: number): RockState[];
/** Encore actif pour la voiture `carIndex` (jamais touché par elle) ; RangeError hors de `hitAt`. */
export function isRockActiveFor(s: RockState, carIndex: number): boolean;
export function hitRockFor(s: RockState, carIndex: number, t: number): void;

// src/physics/rocks.ts
/** Un capteur rectangle statique par rocher, label 'rock', catégorie CAT.SENSOR, masque CAT.ALL_CARS ; `body.plugin = { rockId }`. */
export function createRockBodies(world: World, rocks: Rock[], cfg: Config): Matter.Body[];
/** Masque = OU des catégories des voitures pour qui le rocher est actif ; réécrit seulement s'il change. */
export function syncRockBodies(bodies: Matter.Body[], states: RockState[]): void;

// src/physics/car.ts
/** Choc contre un rocher (spec §2.1) : norme de la vitesse de chaque pièce ramenée à ROCK_HIT_SPEED (direction gardée, une pièce plus lente inchangée) ; vitesse angulaire des roues = ROCK_HIT_SPEED / WHEEL_RADIUS (roulement). Hors de tout callback de collision. */
export function applyRockHit(car: CarBody, cfg: Config): void;

// src/sim/simulate.ts
export type SimEvent = /* … */ | { type: 'rock'; carId: string; t: number; x: number; id: number };
export interface RaceSim { /* … */ rocks: RockState[]; rockBodies: Matter.Body[] }
```

Comportement de `stepRace` : dans la boucle d'après `stepWorld`, **après `collectStars(sim, car, i)`** et avant le test d'arrivée, `collectRocks(sim, car, i)` : pour chaque capteur `'rock'` de `sensorsTouching(engine, car.body.parts)` actif pour `i` → `hitRockFor`, `applyRockHit`, `car.invulnerable = true`, `car.state.invulnerableUntil = t + ROCK_HIT_TRAVERSABLE`, `syncMask(car)`, événement `'rock'` (`x` = châssis). Après la boucle : `syncRockBodies(sim.rockBodies, sim.rocks)` à côté de `syncStarBodies`. `createRaceSim` : `rocks: newRockStates(track.rocks, cars.length)`, `rockBodies: createRockBodies(world, track.rocks, cfg)` ; `rebuildCars` ne touche pas aux rochers. La hauteur du capteur se mesure depuis `heightAt(track, xStart)` (sol plat sous le rocher par construction).

- [ ] **Step 6 : Tests purs** (`tests/rochers.test.ts`, première partie) : `newRockStates` (une case par voiture, aucun choc), `isRockActiveFor` / `hitRockFor` (RangeError hors index), `applyRockHit` sur une voiture synthétique (`createCar` dans un monde plat ; pièces à 14 m/s → chaque pièce à 2,000 m/s à 1e-9 près, roues à 2 / 0,45 rad/s ; une pièce déjà à 1 m/s inchangée ; direction gardée sur une pièce à (10, −3) m/s). Run → FAIL.

- [ ] **Step 7 : Implémenter `src/cars/rocks.ts`, `src/physics/rocks.ts`, `applyRockHit`, `RaceSim.rocks` / `rockBodies`, `collectRocks`, `syncRockBodies`, l'événement `'rock'`** (comportement ci-dessus). `soloSim` (`tests/helpers/jump-runs.ts`) crée aussi `rocks` et `rockBodies` depuis `world.track.rocks` et `disposeSolo` retire les `rockBodies`. Test de câblage dans `tests/rochers.test.ts` : « état par voiture : Galahad touche le rocher → masque du capteur sans sa catégorie, les 4 autres bits restent ; un second passage de Galahad à 2 m/s ne donne aucun second événement » (5 voitures par `createRaceSim(track, CONFIG, { robots: true })` sur une piste synthétique à un rocher, Galahad posé par `placeCar` 20 m avant le rocher et lancé à 14 m/s par `setCarSpeed`, les copains laissés sur la grille). Run → vert.

- [ ] **Step 8 : Harnais piste plate** `tests/helpers/rochers.ts` (modèle : `tests/helpers/fosses.ts`) :

```ts
/** Piste plate de 700 m (`generateTrack(3, 700, cfg, { onlyPlat: true })`, étoiles retirées) avec un rocher en xStart = 250 (ou `rocks` donnés) ; monde créé par `createWorld`. */
export function rockWorld(opts?: { rocks?: { xStart: number }[]; cfg?: Config }): { world: World; rock: Rock };
export interface RockRunOptions { x0: number; v: number | 'arrêt'; pressAtStep: number | null; turboAtX?: number; maxSeconds?: number; trace?: boolean; cfg?: Config }
export interface RockRunResult { hit: boolean; hitStep: number | null; hitX: number | null; speedAfterHit: number; respawn: boolean; flipped: boolean; jumpX: number | null; landX: number | null; passed: boolean; xs: number[]; speeds: number[]; invulnerableSteps: number; tAt: (x: number) => number | null }
/** Galahad seul, lancé à v (tenue par `factor`) ou arrêté, doigt posé, appui au pas k ; s'arrête 3 s après l'atterrissage qui suit le saut, 5 s après un choc, à une réapparition, ou à maxSeconds (14). `passed` = saut, aucun 'rock', aucune réapparition, châssis au-delà de xEnd + CAR_LENGTH. */
export function rockRun(world: World, rock: Rock, opts: RockRunOptions): RockRunResult;
/** Fenêtre entière (suite lente) : témoin sans saut jusqu'au pas du choc kHit, appui à chaque pas de [kHit − 2 s, kHit] ; fenêtre principale, morceaux, bords en s avant xStart. */
export function rockWindow(world: World, rock: Rock, v: number | 'arrêt', opts?: { turboAtX?: number; x0?: number }): { seconds: number; pieces: number; leadFrom: number; leadTo: number; runs: number };
/** CI : 25 appuis, un par pas, sur [k* − 12, k* + 12], k* = premier pas où rockJumpWanted est vrai sur le témoin (Partie 3 ; en attendant : pas où (xStart − x)/v ≤ rockJumpLead(v)). */
export function rockBlock(world: World, rock: Rock, v: number | 'arrêt', opts?: { turboAtX?: number }): { passed: number; runs: number; failed: number[] };
```

`rockJumpLead` vient de la Partie 3 : pour cette partie, le harnais calcule le centre par la formule de la spec §2.2 en local (`1 − ROCK_WIDTH / (2 max(v, 1))`) et passera à `rockJumpLead` au Step 15.

- [ ] **Step 9 : Cas physiques** (`tests/rochers.test.ts`, suite ; piste plate, rocher en 250) :

```ts
describe('(a) doigt posé sans saut : la voiture bute', () => {
  test.each([8, 11.2, 14, 21])('%s m/s tenus : un seul événement rock, châssis ≤ 2,1 m/s au pas suivant, aucune réapparition en 5 s, châssis passe xEnd + 10', …);
  test('turbo pris 40 m avant : touché, un seul événement, pas de réapparition', …);
  test('14 m/s : temps perdu sur 60 m entre 1,0 et 1,4 s (mesuré 1,22 s)', …);           // comparé à un run témoin sans rocher (rockWorld({ rocks: [] }))
  test('départ arrêté 30 m avant : touché à ≥ 11 m/s, pas de réapparition', …);
});
describe('(b) fenêtre', () => {
  test.each([11.2, 14, 'arrêt'])('bloc central à %s : 25 appuis sur 25 passent', …);     // rockBlock ; départ arrêté : x0 = xStart − 30
  test('14 m/s : le dernier appui qui passe est entre 0,40 et 0,56 s avant xStart ; 0,2 s avant : touché', …);
});
describe('(c) après le choc', () => {
  test('traversable : invulnerable vrai au pas du choc, levé entre 1,5 et 3,0 s après (aucune autre voiture)', …);
  test('lastJumpAt et jumpRequestedAt inchangés par le choc ; un saut 0,6 s après le choc passe (délai écoulé, au sol)', …);
  test('déterminisme : deux runs identiques (xs, speeds, hitStep)', …);
});
```

Run → FAIL tant que `rockRun` et consorts manquent ; puis implémenter le harnais (Step 8) et faire passer : `npx vitest run tests/rochers.test.ts` → vert, durée imprimée < 60 s.

- [ ] **Step 10 : Suite lente des fenêtres** `tests/slow/rochers-fenetres.test.ts` : `rockWindow` à 8, 11,2, 14, 21 m/s tenus, départ arrêté 30 m avant, turbo pris 40 m avant : fenêtre principale ≥ 0,55 s à 8, ≥ 0,70 s à 11,2 et 14, ≥ 0,70 s en turbo et à 21 ; un seul morceau ; bords à 14 m/s : dernier appui dans [0,40 ; 0,56] s avant, premier dans [1,20 ; 1,50] s avant (mesurés 0,48 et 1,34) ; tableau imprimé. `npx vitest run -c vitest.slow.config.ts tests/slow/rochers-fenetres.test.ts` → vert (< 10 min).

- [ ] **Step 11 : Review Focus 1 à 3** dans `tests/rochers.test.ts` :
  - « saut 0,3 s avant le rocher à 14 m/s (trop tard) : événement rock en l'air, aucun retournement (|angle| < FLIP_ANGLE sur les 3 s suivantes), aucune réapparition, châssis repasse sous 0,9 m » ;
  - « deux rochers à 60 m : sans saut, deux événements, aucune réapparition ; vitesse au second ≥ 12 m/s ; bloc central du second (25 appuis) : ≥ 23 passent » (le témoin du second part après le premier choc) ;
  - « réception de fosse : piste `fossePiste()` avec un rocher en `xReception + 35` ; Galahad posé à l'arrêt en `xReception + FOSSE_RESPAWN_AFTER`, doigt posé : touché à ≥ 11 m/s, pas de réapparition ; bloc central au départ arrêté : 25/25 » (le rocher est dans la zone fantôme : `car.ghost` vrai avant le choc, vérifié).
  Run → vert ; sinon c'est un défaut à comprendre, pas un seuil à relâcher.

- [ ] **Step 12 : Empreinte.** `npx vitest run tests/empreinte.test.ts` : `FROZEN` (3 graines) doit être **vert**. Si `FROZEN_CONFIG` rougit : vérifier que la cause est un rocher touché dans les 30 s (imprimer x des rochers des graines 0 à 2 et le pas du premier `'rock'`), coller les nouveaux hash, écrire au registre le ruling R-F10 (anciens, nouveaux, commit, raison « Galahad doigt posé touche un rocher à x m, graine n », preuve `FROZEN` vert). Si `FROZEN_CONFIG` rougit sans rocher touché : **défaut**, arrêt, mesure.

- [ ] **Step 13 : Vert, commit, sauvegarde** : `npm run typecheck` → 0 ; `npm test` → vert (`tests/deps.test.ts` compris : `cars/rocks.ts` et `track/rocks.ts` purs). Commit : `git commit -m "feat: choc contre un rocher (capteur par voiture, 2 m/s, traversable 1,5 s, événement rock)" -- src/cars/rocks.ts src/physics/rocks.ts src/physics/car.ts src/sim/simulate.ts tests/helpers/jump-runs.ts tests/helpers/rochers.ts tests/rochers.test.ts tests/slow/rochers-fenetres.test.ts tests/empreinte.test.ts` ; `git push origin wip-plan-b`.

---

## Partie 3 — Copains : fenêtre, driver, sauteur parfait (Steps 14 à 18)

**Files:**
- Create: `tests/helpers/robots-rochers.ts`, `tests/slow/robots-rochers-0-23.test.ts`, `tests/slow/robots-rochers-24-47.test.ts`
- Modify: `src/cars/jump.ts`, `src/ai/driver.ts`, `src/sim/simulate.ts` (`DriverSlot`, `DriverCache`, `fillContext`), `tests/helpers/fosses.ts` (`sauteurParfait`), `tests/helpers/rochers.ts` (centre par `rockJumpLead`), `tests/fosses.test.ts` (fonctions pures), `tests/driver.test.ts`

**Interfaces (produit) :**

```ts
// src/cars/jump.ts — pur
/** Centre de la fenêtre d'un rocher, s avant xStart : ROCK_JUMP_AIM − ROCK_WIDTH / (2 max(v, 1)) : 0,81 / 0,87 / 0,89 s à 8 / 11,2 / 14 m/s (spec §2.2). */
export function rockJumpLead(v: number, cfg: Config): number;
/** Bord au plus tard : ROCK_JUMP_LATE (0,5 s), constante (la hauteur fixe ce bord, pas la vitesse). */
export function rockLatestLead(v: number, cfg: Config): number;
/** (xStart − x) / max(v, 1) ≤ max(rockJumpLead(v) + error, JUMP_BUFFER + PHYSICS_DT) et > JUMP_BUFFER ; pas de bascule (spec §4). */
export function inRockJumpWindow(xStart: number, x: number, v: number, cfg: Config, error?: number): boolean;
/** Prochain rocher (`nextRock`) à moins de JUMP_LOOKAHEAD et dans sa fenêtre ; faux sinon ; sans allocation. */
export function rockJumpWanted(track: Track, x: number, v: number, cfg: Config, error?: number): boolean;

// src/ai/driver.ts
export interface DriverContext { /* … */ /** Prochain rocher devant à moins de JUMP_LOOKAHEAD, encore actif pour cette voiture ; null sinon. */ nextRock: { xStart: number; index: number } | null }
export interface RobotDraws { /* … */ /** Par rocher (ordre de la piste) : erreur (s), N(0, FOSSE_SKILL_FACTOR × jumpSkill). */ rockErr: number[] }
```

Comportement :
- `robotDraws` : les tirages `rockErr` viennent **après** `fosseErr` et **avant** `lift` (spec §4 ; `ROCKS_PER_RACE` = 0 : aucun tirage, `lift` inchangé).
- `wantJump` (driver) : ordre fosse (approche), puis **rocher** : `ctx.nextRock` non null, `rockDone[index] !== epoch`, pas dans `inNoJumpZone` → `inRockJumpWindow(nextRock.xStart, x, speed, cfg, rockErr[index]) && request(3, index, epoch)` ; puis étoile haute. `pendingKind` 3 → `rockDone`. Une seule tentative par rocher et par `epoch` (après un choc, le rocher n'est plus actif : `nextRock` passe au suivant).
- `fillContext` : `nextRock` par un curseur sur `track.rocks` (comme `starCursor`), premier rocher avec `xStart > x`, `xStart − x ≤ JUMP_LOOKAHEAD` et `isRockActiveFor(sim.rocks[k], i)` ; objet `rock` réutilisé dans `DriverSlot`.
- `sauteurParfait` (`tests/helpers/fosses.ts`) : `fosseJumpWanted(...) || rockJumpWanted(track, x, v, cfg)` (le saut de la dernière chance des fosses inchangé).

- [ ] **Step 14 : Tests des fonctions pures** (dans `tests/fosses.test.ts`, bloc « saut voulu devant un rocher », ou `tests/rochers.test.ts`) : `rockJumpLead(8|11.2|14)` = 0,8125 / 0,866 / 0,893 à 1e-3 ; `rockLatestLead` = 0,5 ; `inRockJumpWindow` vrai sur `[xStart − lead × v, xStart − JUMP_BUFFER × v[`, faux avant et après, avec erreur ± 0,3 s déplace le bord ; `rockJumpWanted` sur une piste des graines 0 à 49 à rochers : vrai dans la fenêtre du premier rocher, faux 41 m avant, faux après `xEnd`, faux sur une piste `ROCKS_PER_RACE` 0. Run → FAIL.

- [ ] **Step 15 : Implémenter `src/cars/jump.ts`** (4 fonctions), brancher `tests/helpers/rochers.ts` sur `rockJumpLead`. Run → vert ; `npx vitest run tests/rochers.test.ts` reste vert.

- [ ] **Step 16 : Tests du driver** (`tests/driver.test.ts`, modèle des tests de fosse existants) : « `robotDraws` : `rockErr.length === track.rocks.length`, N(0, 2,5 × jumpSkill) (sur 200 graines : écart-type dans [0,8 ; 1,2] × 2,5 × jumpSkill) ; avec `ROCKS_PER_RACE` 0, `starTry`, `starErr`, `fosseErr`, `lift` identiques à ceux d'avant (fixture : valeurs de BASE pour Pablo rang 1, graine 7, graine de pilotes 0) » ; « driver dans la fenêtre d'un rocher actif : `jump` vrai à chaque pas de la fenêtre, faux après le saut (`lastJumpAt` changé), faux si le rocher n'est plus actif (`nextRock` null) » ; « priorité : sur l'approche d'une fosse, la demande est celle de la fosse » ; « jamais dans `inNoJumpZone` » (contexte construit à la main comme les tests existants). Run → FAIL ; implémenter `driver.ts` et `fillContext` ; run → vert.

- [ ] **Step 17 : Review Focus 5 (drivers et `ROCKS_PER_RACE` 0)** : test dans `tests/driver.test.ts` « `ROCKS_PER_RACE` 0 : `nextRock` null à tout pas d'une course de 10 s (`driverContext`), aucun tirage de plus » ; test dans `tests/simulate.test.ts` « `createRaceSim` sur une piste sans rocher : `rocks` et `rockBodies` vides, aucun corps `'rock'` dans le monde ». Run → vert.

- [ ] **Step 18 : Chocs des copains par bras** `tests/helpers/robots-rochers.ts` + `tests/slow/robots-rochers-0-23.test.ts` et `-24-47.test.ts` (modèle : `tests/helpers/robots-sauts.ts`, 3 bras : traits de Pablo, traits de Timothé, tirage normal ; `fiveCarRace(seed, { traits, jump: 'parfait' })`, observateur comptant les `'rock'` par voiture et les rochers rencontrés par voiture (châssis passé `xEnd`) ; sortie `tests/slow/out/robots-rochers-*.json`). Assertions : bras fonceurs 15 à 45 % de chocs par rocher rencontré, bras prudents ≤ 2 %, tirage normal entre les deux ; 0 réapparition dans les 3 s après un `'rock'` ; `expectRaceInvariants`. `npx vitest run -c vitest.slow.config.ts tests/slow/robots-rochers-0-23.test.ts` → vert (< 30 min). Commit : `git commit -m "feat: les copains sautent les rochers (fenêtre rockJumpLead, erreur des fosses)" -- src/cars/jump.ts src/ai/driver.ts src/sim/simulate.ts tests/helpers/fosses.ts tests/helpers/rochers.ts tests/helpers/robots-rochers.ts tests/fosses.test.ts tests/rochers.test.ts tests/driver.test.ts tests/simulate.test.ts tests/slow/robots-rochers-0-23.test.ts tests/slow/robots-rochers-24-47.test.ts` ; `git push origin wip-plan-b`.

---

## Partie 4 — Rendu, éclats, `Game`, e2e (Steps 19 à 23)

**Files:**
- Create: `e2e/rochers.spec.ts`
- Modify: `src/render/renderer.ts` (`Scene.rocks`, `draw`), `src/render/track.ts` (`drawRock`), `src/render/effects.ts` (`rockBurst`), `src/sim/simulate.ts` (`sceneOf`), `src/game.ts` (`present`, getters), `package.json`, `tests/render-smoke.test.ts`, `tests/effects.test.ts`, `tests/game-frame.test.ts`, `e2e/helpers.ts`

**Interfaces (produit) :**

```ts
// src/render/renderer.ts
export interface Scene { /* … */ rocks: { xStart: number; xEnd: number; height: number; active: boolean }[] }   // `active` : pas encore touché par Galahad
// src/render/track.ts
/** Rocher gris lunaire : polygone irrégulier de 7 à 9 sommets (déterministe par `id`), dans [xStart, xEnd] × [sol, sol + height], ombre au sol, arête claire ; dessiné après la piste, avant les étoiles, seulement dans la vue. */
export function drawRock(ctx: Ctx, rock: { xStart: number; xEnd: number; height: number }, id: number, groundY: number, ppm: number, S: (x: number, y: number) => Pt): void;
// src/render/effects.ts
/** 14 éclats gris (triangles, gravité, vie 0,8 s, rotation) et 10 grains de poussière en (x, y), dans MAX_PARTICLES. */
rockBurst(x: number, y: number): void;
// src/game.ts (?debug=1, e2e)
get rocksHit(): number;                 // événements 'rock' de Galahad
get rocks(): { xStart: number; xEnd: number }[];
rockJumpLead(v: number): number;
```

Comportement : `sceneOf` remplit `rocks` depuis `track.rocks` et `isRockActiveFor(sim.rocks[k], GALAHAD_INDEX)` (`height` = `ROCK_HEIGHT`) ; `Renderer.draw` dessine les rochers actifs dans la vue entre les effets et les étoiles ; `Game.present` : événement `'rock'` d'une voiture `shown` → `effects.rockBurst(e.x, heightAt(track, e.x) + ROCK_HEIGHT / 2)` ; `Game.step` compte les `'rock'` de Galahad. Le titre (`drawTitle`) et le podium (scène figée) ne changent pas : le podium garde les rochers de la piste dessinés comme les étoiles.

- [ ] **Step 19 : Tests de rendu et d'effets** : `tests/render-smoke.test.ts` « une scène à 2 rochers (un actif, un touché) : `drawRock` appelé une fois (espion), aucune exception, état du canvas restauré » ; `tests/effects.test.ts` « `rockBurst` : + 24 particules, aucune au-delà de `MAX_PARTICLES`, toutes mortes après 1,2 s d'`update` » ; `tests/game-frame.test.ts` « un événement `'rock'` de Galahad à l'écran → `effects.count` augmente de 24 et `rocksHit` passe à 1 ; un `'rock'` d'un copain hors écran → rien » (événement injecté par une piste synthétique à rocher où Galahad est posé 20 m avant, doigt posé, images jusqu'au choc). Run → FAIL.

- [ ] **Step 20 : Implémenter** `Scene.rocks`, `sceneOf`, `drawRock`, `Renderer.draw`, `rockBurst`, `Game` (`present`, `step`, getters, exposés dans `__game` comme `jumps`), `package.json` → `1.3.0`. Run → vert ; `npm run typecheck` → 0 ; `npm test` → vert. Commit : `git commit -m "feat: rochers dessinés et éclats au choc, version 1.3.0" -- src/render src/sim/simulate.ts src/game.ts package.json tests/render-smoke.test.ts tests/effects.test.ts tests/game-frame.test.ts`.

- [ ] **Step 21 : Choix de la graine e2e** : script jetable (supprimé) imprimant, pour les graines 0 à 49 à `defaultTrackLength(CONFIG)`, le `xStart` du premier rocher ; retenir la graine dont le premier rocher est le plus proche du départ **et** à plus de 60 m de toute fosse (le chemin doigt posé jusqu'au rocher ne doit pas croiser une fosse : deux chutes rendraient le test long) ; noter graine et x dans l'en-tête du spec e2e.

- [ ] **Step 22 : e2e** `e2e/rochers.spec.ts` (modèle `e2e/fosse.spec.ts`, `?seed=<graine>&debug=1`, `startRace`, CDP tactile) :
  - « doigt tenu sans sauter jusqu'au premier rocher : capture `rocher.png` quand le châssis est à `xStart − 10` (rocher à l'écran, `rocksHit` 0) ; après le choc, `rocksHit` = 1, vitesse lue par `__game.speed('galahad')` (à ajouter si absente : m/s du châssis) < 3 m/s dans les 0,2 s puis > 10 m/s dans les 4 s ; capture `rocher-eclats.png` au premier `rocksHit` 1 ; état `racing`, aucune réapparition (`__game.respawns` vide), le châssis dépasse `xEnd + 20` » ;
  - « Espace au centre de la fenêtre (`__game.rockJumpLead(v)`, appui par `page.keyboard.press('Space')` quand `(xStart − x) / v ≤ lead`) : `jumps` = 1, `rocksHit` reste 0 après `xEnd + 20` » (tolérance : si Playwright rate la fenêtre deux fois sur trois essais, le test imprime et accepte `rocksHit` ≤ 1, comme le e2e des fosses ne juge pas le saut à la main) ;
  - « 5 voitures : un copain qui touche un rocher (observé par `__game` : exposer `rocksHitByCar` si nécessaire) ne retire rien de la scène de Galahad (`__game.sceneRocksActive` = nombre de rochers actifs pour Galahad inchangé) » ; si aucun copain ne touche de rocher sur la graine choisie en 60 s, le test l'imprime et passe (couvert en simulation au Step 7).
  Run : `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npx playwright test e2e/rochers.spec.ts` → vert ; regarder `e2e/screenshots/rocher.png` (rocher plus haut que la voiture, ombre, gris lunaire lisible sur le sol gris : si le rocher ne se distingue pas du sol, assombrir le rocher ou éclaircir son arête, pas le sol).

- [ ] **Step 23 : Suite e2e complète et commit** : `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e` → tout vert (34 attendus : 32 + 2 ou 3 ; `race.spec` et `fosse.spec` roulent sur des pistes qui ont maintenant des rochers : si un e2e existant casse parce que Galahad bute sur un rocher, adapter la graine ou la durée de ce test, pas le rocher). Commit : `git commit -m "test: e2e des rochers (choc, éclats, saut, scène de Galahad)" -- e2e/rochers.spec.ts e2e/helpers.ts src/game.ts` ; `git push origin wip-plan-b`.

---

## Partie 5 — Acceptation : vraies pistes, 5 voitures, rattrapage (Steps 24 à 27)

**Files:**
- Modify: `tests/helpers/race.ts` (observateur `'rock'`, `rocksByCar`, invariant « aucune réapparition dans les 3 s après un rock »), `tests/slow/race-sans-saut-*.test.ts`, `tests/slow/race-invariants-*.test.ts`, `tests/slow/rattrapage-*.test.ts`, `tests/rochers.test.ts`

- [ ] **Step 24 : 5 voitures.** `FiveCarRace` gagne `rocksByCar: Record<string, number>` et `rockRespawns: string[]` (réapparitions de toute voiture dans les 3 s après son `'rock'`) ; `expectRaceInvariants` exige `rockRespawns` vide. `tests/slow/race-invariants-*` (Galahad sauteur parfait : fosses **et** rochers) et `race-sans-saut-*` (Galahad sans saut : il touche ses rochers ; les assertions « exactement 2 chutes par fosse, arrivée avant 240 s » restent) relancés : `npm run test:slow` → vert ; imprimer par graine les chocs par voiture. Review Focus 4 : dans `tests/rochers.test.ts`, « 5 voitures sur une piste synthétique à un rocher, Galahad devant : après son choc, `rocks[0].hitAt` n'a que la case 0 remplie et le masque du capteur vaut le OU des 4 autres ».

- [ ] **Step 25 : Vraies pistes doigt posé sans saut** (`tests/rochers.test.ts`, graines 0 à 9, Galahad seul, `simulateRace` avec `throttle: () => true`, sans saut) : « chaque rocher de la piste donne exactement un `'rock'` de Galahad ; aucun `'respawn'` dans les 3 s après un `'rock'` ; arrivée avant 240 s » (si un rocher n'est pas touché, c'est un survol : imprimer x, tranche précédente, vitesse ; **défaut de placement** à remonter au contrôleur). En CI, graines 0 à 4 ; 5 à 9 dans `tests/slow/rochers-pistes.test.ts` avec la recette du survol (spec §6 : rocher à exactement `ROCK_RAMP_CLEARANCE` après une rampe-saut et à 12 m après une double-bosse, lancée à 21 m/s : touché ou passé derrière, jamais une réapparition).

- [ ] **Step 26 : Rattrapage** : `npm run test:slow:rattrapage` sur la tête (lignes étiquetées par commit) : place moyenne de Galahad **sans saut** et **sauteur parfait**, avant (lignes de la tâche 7 au registre) et après ; pas d'assertion ; chiffres au registre. Attendu : sans saut, Galahad perd (place qui monte) ; sauteur parfait, ± 0,1 place.

- [ ] **Step 27 : Frontière et suites complètes** :

```bash
git diff --stat <BASE> -- src/physics src/sim src/track src/cars src/ai src/loop src/config.ts   # <BASE> : SHA en clair, lu au registre
npm run typecheck && npm test
npm run test:slow && npm run test:slow:race
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
```

Expected : le diff ne montre que les fichiers de la structure ci-dessus ; `src/loop/` intact ; tout vert ; `tests/empreinte.test.ts` : `FROZEN` identique, `FROZEN_CONFIG` tel que décidé au Step 12. Commit des tests d'acceptation : `git commit -m "test: acceptation des rochers (vraies pistes, 5 voitures, rattrapage)" -- tests/helpers/race.ts tests/rochers.test.ts tests/slow` ; `git push origin wip-plan-b`.

---

## Partie 6 — Relectures, validation, fusion, déploiement (Steps 28 à 33)

- [ ] **Step 28 : Quatre relectures du diff `<BASE>..HEAD`** (sous-agents frais, rapports ≤ 30 lignes) : standard (spec §1 à §7 point par point), adversariale (sondes : choc en l'air à 21 m/s, choc pendant un vol de fosse raté, rocher + étoile de réception en turbo, 5 voitures sur le même rocher au même pas ; mutants : `applyRockHit` sans les roues, masque jamais réaligné, `hitAt` partagé entre voitures, `rockErr` tiré avant `fosseErr`, `nextRock` ignorant `isRockActiveFor`, `ROCK_VOLCANO_GAP` à 0 ; chaque mutant doit rougir un test), `code-review`, `security-review`. Tours de correction ≤ 5, chaque tour commité et poussé sur `wip-plan-b` ; re-relecture des points CORRECTIONS REQUISES.

- [ ] **Step 29 : Captures pour le papa** : `e2e/screenshots/rocher.png`, `rocher-eclats.png`, plus une capture à 5 voitures où un copain saute un rocher si une graine s'y prête ; questions ouvertes de la spec (aucune prévue ; les points « à rejuger sur la tablette » : signal d'approche Q-C7, espacement 60 m, turbo gardé au choc) listées en une ligne chacune. **Validation du papa sur capture**, décisions au registre.

- [ ] **Step 30 : Passation et registre** : passation (« Où en est-on » : puce « Tâche 11c faite… », tableau → faite ; « Prochaine action précise » : 12 audio avec le son du choc sur l'événement `'rock'` ; « Leçons de la session ») ; registre : 3 à 5 lignes « Task 11c: » (commits ; mesures : fenêtres, coût, candidates par piste, chocs des copains par bras, rattrapage avant/après, empreinte ; écarts à ce plan ; verdicts des relectures et tours ; à dire au papa). Commit : `git commit -m "docs: tâche 11c (rochers), passation et registre" -- docs/superpowers/handoff/2026-10-21-plan-b-passation.md docs/superpowers/handoff/sdd-ledger-plan-b.md`.

- [ ] **Step 31 : Fusion, push, CI** (aucun sous-agent dans l'arbre) :

```bash
git status -sb
git fetch origin ccr-5b6fabc4-n96ofo
git checkout -B ccr-5b6fabc4-n96ofo origin/ccr-5b6fabc4-n96ofo
git merge --ff-only wip-plan-b || git merge wip-plan-b -m "Merge de wip-plan-b : tâche 11c (rochers)"   # conflit possible : la passation, garder les deux côtés
git push -u origin ccr-5b6fabc4-n96ofo          # session en mode « accepter les modifications »
```

Run GitHub Actions vert (`mcp__github__actions_list` / `actions_get`).

- [ ] **Step 32 : Site en ligne** :

```bash
VITE_BASE=/Galahad-s-car-game/ npm run build && ls dist/assets/index-*.js
curl -s https://i-dmk.github.io/Galahad-s-car-game/ | grep -o 'index-[A-Za-z0-9_-]*\.js'      # = le build local
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live                             # tout vert, rochers.spec compris
git checkout wip-plan-b && git merge --ff-only ccr-5b6fabc4-n96ofo && git push origin wip-plan-b
```

Registre : « Task 11c: déploiement vérifié (run n, hash, e2e:live) », tableau de la passation → « déployée », commit `docs:`, push des deux branches.

- [ ] **Step 33 : Tablette.** Le papa joue avec Galahad (version 1.3.0 au titre) : rochers vus et sautés, un raté (la voiture bute, éclats), copains qui sautent ou butent, course serrée. Recueillir : Q-C7 (faut-il un signal ?), taille et nombre ressentis, le rocher se voit-il assez tôt, le turbo gardé au choc ; décisions au registre. Suite : tâche 12 (audio).

## Questions pour le papa

Aucune avant le code : tout est tranché dans la spec (Q-C1 à Q-C8, Q-C4 bis). Deux cas ramènent une question en cours de route, chiffrée, par le contrôleur : (1) Step 4, si la moyenne des candidates sort de 4,20 ± 0,3 ou qu'une piste n'a aucun rocher ; (2) Step 25, si un rocher est survolé doigt posé sur une vraie piste.

## Écarts connus, à ne pas « corriger »

- `package-lock.json` garde une `version` décalée (registre de la 11).
- `tests/slow/race-sans-saut-*` : Galahad sans saut touche désormais ses rochers ; ses temps d'arrivée montent de ≈ 4 × 1,2 s ; la borne reste 240 s.
- Les tirages `lift` des drivers changent sur les pistes à rochers (`rockErr` tiré avant) : les chiffres « lever de pied » de la tâche 6 ne sont plus appariés ; ceux de `ROCKS_PER_RACE` 0 le restent.
