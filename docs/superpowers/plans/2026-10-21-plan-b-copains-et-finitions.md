# Plan B — Copains et finitions de la Course Lunaire de Galahad

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. À chaque tâche : implémenteur frais, puis relecture standard + relecture adversariale par sous-agents frais **et** le skill `code-review` sur le diff de la tâche ; tours de correction (≤ 5) ; validation du papa ; passation mise à jour et commitée ; push.

**Statut :** v2 après relectures (standard : 6 importants + 10 mineurs ; adversariale : 4 bloquants + 7 importants + 3 mineurs ; `code-review` : 10 constats), tous intégrés ; en attente de validation par le papa.

**Goal:** Transformer le socle du plan A (une voiture, piste, volcans, étoiles, arrivée) en un vrai jeu : volcans qu'il faut aborder lancé, 4 copains qui se cognent et restent proches, position et barre de progression, écran titre, décompte, pause, podium, sons, musique, PWA, et une Lune plus vivante, le tout jouable sur la tablette à ≥ 50 fps.

**Architecture:** Inchangée (spec §4) : `track/`, `cars/`, `ai/` purs ; `physics/` construit le monde ; `sim/simulate.ts` porte **le pas de course unique** `stepRace`, désormais sur un tableau de voitures (Galahad = index 0) ; `render/` dessine ; `game.ts` orchestre une machine d'états ; `ui/` en DOM ; `audio/` en Web Audio. Un seul monde Matter.js pour les 5 voitures.

**Tech Stack:** identique au plan A (TypeScript 5.7 strict, Vite 8, matter-js 0.20, Vitest 5, Playwright 1.56, Node 22), plus `vite-plugin-pwa` (tâche 13).

**Spec :** `docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md` (autorité) amendé par `docs/superpowers/specs/2026-10-21-plan-b-addendum.md` (v3 validée ; l'addendum l'emporte en cas de contradiction). Références ci-dessous : « spec §n » et « addendum §n ».

**Relectures intégrées :** relecture standard, relecture adversariale (avec sonde physique : L_ELAN 4/6/8/10, LAVA_MARGIN 0,8, capteur +0,5 m ; suite actuelle 218/218 en 178 s mur sur 4 cœurs, `jump.test.ts` seul = 178 s) et `code-review` du 2026-10-21 ; les mesures sont citées là où elles fixent une valeur.

**État de départ :** branche `ccr-5b6fabc4-n96ofo`, commit `89a5693`, 218 tests Vitest verts (≈ 3–4 min), 5 e2e verts, déployé sur https://i-dmk.github.io/Galahad-s-car-game/. Passation : `docs/superpowers/handoff/2026-10-20-plan-a-passation.md`, registre `sdd-ledger-plan-a.md` (lire « Décisions prises hors plan » avant de toucher la physique).

## Global Constraints

Toutes celles du plan A restent (unités, pas fixe, `frictionAir = 0`, masse par option, inertie explicite `INERTIA_SCALE`, roues 48 côtés, 3e ressort, contact débouncé, convention d'angle monde, aucun déplacement de corps dans un callback de collision, pas d'images ni d'audio en fichiers, `track/`/`cars/`/`ai/`/`loop/` sans matter-js ni DOM, commits en français préfixés `feat:`/`test:`/`chore:`/`docs:`, aucun identifiant de modèle dans les commits). En plus :

- **Typecheck vert à chaque commit :** `tsconfig.json` inclut `tests/` et `deploy.yml` lance `npm run typecheck` avant `npm test`. Donc : **jamais de `describe.skip`** pour masquer une constante retirée ; une constante n'est retirée de `CONFIG` que dans la tâche qui réécrit son dernier consommateur (code et tests). Chaque tâche laisse `npm run typecheck` et `npm test` verts et déployables.
- **Budget CI :** `npm test` (exécuté par `deploy.yml`) < 6 min mur sur le runner GitHub (≈ 3 min ici). Les suites longues vivent dans `tests/slow/` et ne tournent que par `npm run test:slow` / `npm run test:slow:race` (tâche 4). Toute nouvelle simulation de course complète à 5 voitures va dans `tests/slow/`, sauf les 2 graines d'invariants (tâche 5b). Vitest parallélise par fichier : scinder les fichiers de simulation plutôt que d'allonger un fichier.
- **Déterminisme :** toute décision aléatoire (pilotes, lever de pied, étoiles d'élan, motif « doigt levé ») vient d'un `mulberry32` dérivé d'une graine ; `ENCORE` rejoue exactement la même course.
- **Galahad = `cars[0]`**, id `'galahad'` ; les robots ont pour id le prénom en minuscules.
- Les événements de simulation portent `carId`. Les effets et sons ne sont joués que pour Galahad ou une voiture visible (spec §9).
- Chaque nouveau paramètre va dans `src/config.ts` (type `Config` inchangé : nombres seulement ; les drapeaux de décor sont des nombres 0/1). Le numéro de version n'y va pas : `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` dans `vite.config.ts` (tâche 10).
- `SliceType` gagne `'cratère'` dès la tâche 1 (le générateur ne le tire qu'à la tâche 15) pour que `safepoint.ts` (tâche 3) et `shiftTarget` (tâche 5b) puissent le tester sans erreur TS2367.
- Mesures de la relecture adversariale à connaître : arrêt à `xElanStart` avec `L_ELAN` 8 → 8,9 m/s au sommet (jusqu'à 10,4 selon le volcan), 27 chutes sur 29 ; `L_ELAN` 6 → 29/29 ; seuil réel de franchissement avec capteur +0,5 m ≈ 10,3–10,5 m/s ; voiture lancée ≥ 10,7 m/s, 0 faux positif du capteur rehaussé.
- Après chaque tâche : `npm run typecheck`, `npm test`, et `npm run e2e` quand l'interface change ; capture d'écran dans `e2e/screenshots/` quand l'écran change ; passation mise à jour.

## Review Focus

1. **Départ arrêté au milieu de l'élan** → lave à chaque fois ; **doigt posé depuis le lancement** → jamais la lave. → tâche 4.
2. **Cinq voitures dans la lave au même pas**, respawns sur le même point sûr. Attendu : aucun chevauchement, aucun garde-fou de vitesse. → tâche 5b.
3. **Robot freiné à 0,6 loin devant qui aborde un volcan.** Attendu : facteur ≥ 1,0 dès le plat de lancement, saut réussi. → tâche 7.
4. **Tablette en portrait pendant le décompte, puis retour paysage.** Attendu : « TOURNE », reprise par tap qui n'accélère pas, décompte relancé à 3. → tâche 10 et 14.
5. **Mise à jour du service worker pendant une course.** Attendu : rien ne bouge avant le retour au titre. → tâche 13.
6. **fps sur la tablette à 5 voitures avec décor.** Attendu : ≥ 50 fps ; sinon calques retirés un à un. → tâches 9 et 16.

---

## Structure des fichiers (nouveaux ou refondus)

```
src/config.ts                    + L_ELAN, D_LANCE, LANCEMENT_LENGTH, LAVA_SENSOR_ABOVE_RIM, STAR_STEP_*, RUBBER_*, DECOR_*
src/track/slices.ts              rampeVolcan v2 (lancement + élan + rampe + vallée + volcan + réception, sans butée), cratere
src/track/types.ts               Volcano.xLancement, SliceType 'cratère'
src/track/stars.ts               placeStars v2 (curseur global, étoiles d'élan, plancher)
src/track/query.ts               nearestVolcanoZone sur [xLancement, xEnd)
src/cars/pilots.ts               PILOTS (6), drawPilots(seed) → 4 pilotes
src/cars/safepoint.ts            forbiddenZone v2, exclusion des cratères
src/cars/respawn.ts              cible xEnd − 10, respawn immédiat retourné dans l'élan, décalage groupé
src/cars/ranking.ts              rankCars, DisplayedRank (hystérésis)
src/ai/driver.ts                 robotThrottle (caractère, zone volcan, délai de départ)
src/ai/rubberband.ts             targetFactor, rampFactor, finalFactor
src/sim/simulate.ts              RaceSim multi-voitures, stepRace, simulateRace v2 (classement, respawns par voiture)
src/game.ts                      machine d'états title/countdown/racing/finished/podium/paused/error
src/ui/screens.ts                titre, décompte, pause/orientation, podium
src/ui/hud.ts                    position, barre de progression, chrono
src/audio/*.ts                   context, engine, sfx, music, mute
src/render/decor.ts              montagnes, rochers, drapeau, module, étoile filante (calques)
tests/volcans.test.ts, tests/rampes.test.ts   remplacent tests/jump.test.ts (fichiers parallélisés)
tests/slow/*.test.ts             suites longues (hors npm test)
vitest.slow.config.ts            config des suites lentes
```

---

## Partie 1 — Calibration « arriver lancé » (addendum §1)

### Task 1 : Géométrie du volcan v2 et constantes

**Files:**
- Modify: `src/config.ts`, `src/track/types.ts`, `src/track/slices.ts`, `src/track/generate.ts`, `src/track/query.ts`, `src/physics/world.ts`, `src/render/track.ts`, `src/cars/safepoint.ts` (transition, voir ci-dessous), `tests/jump.test.ts` (réduit), `tests/safepoint.test.ts` (adapté)
- Test: `tests/smoke.test.ts`, `tests/slices.test.ts`, `tests/generate.test.ts`, `tests/query.test.ts`, `tests/world.test.ts`

**Interfaces:**
- `CONFIG` : `const D_LANCE = (14 * 14) / (2 * 4.3) * 1.2` déclarée **avant** le littéral `as const` (≈ 27,3 ; commentaire : « runUpDistance(V_MAX, DRIVE_ACCEL) × 1,2 », recalculée si `DRIVE_ACCEL` change), puis `L_ELAN: 6`, `D_LANCE`, `LANCEMENT_LENGTH: D_LANCE + 5`, `LAVA_MARGIN: 0.8`, `LAVA_SENSOR_ABOVE_RIM: 0.3`. Supprimées **dans cette tâche** : `ELAN_MARGIN`, `STOP_BUMP_HEIGHT`, `STOP_BUMP_LENGTH` (plus aucun consommateur après la refonte de `slices.ts` et de `tests/slices.test.ts`). **Conservées** avec le commentaire `// retirée en tâche 3` / `// retirée en tâche 2` : `ELAN_SAFE_FRACTION` (lue par `safepoint.ts`, `tests/safepoint.test.ts`, `tests/jump.test.ts`) et `STAR_EXCLUSION_BEFORE_LAVA` (lue par `stars.ts`, `tests/stars.test.ts`).
- `SliceType` gagne `'cratère'` (type seulement).
- **Transition sûre entre les tâches 1 et 3 :** `forbiddenZone` lit `xElanStart`, qui change de sens ; pour qu'un déploiement entre les deux tâches ne mette pas de point sûr sur un élan de 6 m, la tâche 1 réécrit `forbiddenZone` en `[v.xLancement + (1 − ELAN_SAFE_FRACTION) × (v.xElanStart − v.xLancement), v.xReception)` (même formule, appliquée au plat de lancement ; la tâche 3 la remplace par la règle finale) et adapte `tests/safepoint.test.ts` en conséquence.
- `Volcano` gagne `xLancement` (début de tranche). `xElanStart = xLancement + LANCEMENT_LENGTH` (**nouveau sens** : début du plat d'élan).
- `volcanoGeometry(cfg)` : `lLancement`, `lElan = cfg.L_ELAN`, `rampRun`, `lipY`, `descentRun`, `ascentRun`, `valleyRun`, `dxLava` (depuis le sommet, inchangé), `dxReception = dxLip + dxLava + LAVA_WIDTH/2 + RIM_HEIGHT/tan(MAX_SLOPE)` (plus de butée), `dxEnd = max(dxReception + 10, dxLip + 1.2 × turboRange)`.
- Capteur de lave (`buildLava`) : du plancher à `rimY + LAVA_SENSOR_ABOVE_RIM`. Rendu de la lave inchangé (jusqu'à `rimY − 0,15`).
- `nearestVolcanoZone(track, x)` : `[xLancement, xEnd)`.
- `tests/jump.test.ts` : les scénarios volcan existants (« élan complet », « pire point sûr ») asserteraient l'inverse de la nouvelle règle ; en tâche 1 ils sont **réduits à un invariant encore vrai** (un départ arrêté à `xLancement` doigt posé passe le volcan et atterrit ≥ `xReception` : c'est le futur cas 2) et `ELAN_SAFE_FRACTION` n'y est plus lue ; la tâche 4 les réécrit entièrement. `VOLCANO_STEPS` passe à 20 s.
- `tests/respawn-sim.test.ts` : « 2e cible = xReception + 3 » reste vrai en tâche 1 (changé en tâche 3).

- [ ] **Step 1 : Tests** : `smoke` (nouvelles constantes ; `expect('ELAN_MARGIN' in CONFIG).toBe(false)`, `STOP_BUMP_*` absents) ; `slices` : profil `rampe-volcan` = 0 sur `[0, lLancement + lElan]`, sommet à `lipY`, vallée à 0, fond de lave à `RIM − CRATER_DEPTH`, plat de réception à 0 de `dxReception` à la fin, **plus de butée** (max des hauteurs après le rebord aval = `RIM_HEIGHT` décroissant vers 0, aucune bosse), `valeurs de référence` recalculées (`lElan = cfg.L_ELAN`, `dxLava ≈ 13,13`, `dxReception − dxLip ≈ 17,0`), deux parois exemptées ; `generate` : `xElanStart − xLancement = LANCEMENT_LENGTH`, `xRampStart − xElanStart = L_ELAN`, 3 à 7 volcans par piste de 1 680 m sur les graines 0 à 19 (si une graine sort de la fourchette, relever le poids de `rampe-volcan` de 3 à 4 dans `generate.ts` et le consigner dans le registre) ; `query` : `nearestVolcanoZone` sur `[xLancement, xEnd)` ; `world` : capteur de lave dont la boîte englobante monte à `rimY + LAVA_SENSOR_ABOVE_RIM` (y monde) et descend au plancher.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** (y compris le retrait de `halfSine`/`stopBumpSpan` s'ils ne servent plus) → **Step 4 : PASS** : `npm run typecheck` 0 erreur, `npm test` entièrement vert (aucun `.skip`), `npm run e2e` vert.
- [ ] **Step 5 : Commit** `feat: volcan v2, plat de lancement, lave reculée, butée supprimée`

---

### Task 2 : Étoiles v2 (curseur global, étoiles d'élan, plancher)

**Files:**
- Modify: `src/config.ts` (`STAR_STEP_MIN: 80`, `STAR_STEP_MAX: 130`, `STAR_MIN_COUNT: 6`, `STAR_ELAN_OFFSET: 2`, `STAR_ELAN_GAP: 5` ; **retire** `STAR_EXCLUSION_BEFORE_LAVA`), `src/track/stars.ts`, `tests/smoke.test.ts`
- Test: `tests/stars.test.ts` (réécrit)

**Interfaces:** `placeStars(track, rng, cfg): Star[]`.
Algorithme (déterministe, un seul `rng`) :
1. Zones admissibles (intervalles de longueur > 0) dans l'ordre de la piste : chaque `plat` hors plat de départ et hors `[xFinish − FINISH_PLAT_BEFORE, xWall]` ; chaque plat de lancement `[xLancement, xElanStart − STAR_ELAN_GAP]` ; chaque plat de réception `[xReception, xEnd)`. Pas de zone de longueur nulle (une telle zone ne recevrait jamais le curseur) : les « 1 m avant une rampe-saut » du plan A disparaissent.
2. Curseur : `due = rng ∈ [STEP_MIN, STEP_MAX]`, `d = 0`. Dans chaque zone `[a, b]` : tant que `d + (b − x) ≥ due`, poser une étoile à `x + (due − d)`, puis `d = due`, `x` = position de l'étoile, `due += nouveau pas` ; en sortant de la zone, `d += b − x`.
3. Étoiles d'élan : pour chaque volcan, `rng() < 0.5` → étoile à `xElanStart − STAR_ELAN_OFFSET` (au moins `STAR_ELAN_GAP − STAR_ELAN_OFFSET` = 3 m après la dernière étoile de lancement possible).
4. Plancher : tant que le total < `STAR_MIN_COUNT`, ajouter une étoile d'élan au premier volcan qui n'en a pas (ordre de la piste) ; s'il n'y a plus de volcan, laisser.
5. Trier par x, ids croissants, `y = heightAt + 0,6`. Invariant : aucune étoile dans `[xElanStart, xLava]`, ni sur le plat de départ, ni après `xFinish − FINISH_PLAT_BEFORE`.

- [ ] **Step 1 : Tests** (graines 0 à 19 et 0 à 49 pour les invariants, 1 680 m) : invariants ci-dessus ; 6 ≤ n ≤ 14 sur les graines 0 à 19 ; « curseur » : sur une piste `onlyPlat` de 1 680 m, les écarts entre étoiles sont tous dans [80, 130] ; « plancher » : avec un `cfg` à `STAR_STEP_MIN/MAX = 100 000` et un `rng` forcé à `() => 0.99` (aucune étoile d'élan tirée), chaque piste a `min(6, nVolcans)` étoiles, toutes à `xElanStart − 2` ; « étoile d'élan » : avec `rng = () => 0` toutes les étoiles d'élan existent, aucune étoile du curseur à moins de 3 m d'elles, aucune dans `[xElanStart, xLava]` ; déterminisme ; ids.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: étoiles par curseur global, étoiles d'élan, plancher de 6`

---

### Task 3 : Points sûrs et respawn v2

**Files:**
- Modify: `src/cars/safepoint.ts`, `src/cars/respawn.ts`, `src/cars/state.ts` (si besoin), `src/sim/simulate.ts` (appel), `src/config.ts` (`SAFE_LANCEMENT_MARGIN: 5`, `RESPAWN_AFTER_VOLCANO_BACK: 10` ; **retire** `ELAN_SAFE_FRACTION`), `tests/respawn-sim.test.ts` (assertion « 2e cible » → `xEnd − 10`), `tests/smoke.test.ts`
- Test: `tests/safepoint.test.ts`, `tests/respawn.test.ts`

**Interfaces:**
- `forbiddenZone(v, cfg) = [v.xLancement + SAFE_LANCEMENT_MARGIN, v.xReception)` ; `isSafePointCandidate` refuse aussi toute position dans une tranche de type `'cratère'`.
- `chooseRespawnTarget(state, track, cfg)` : deuxième chute consécutive au même volcan → `x = v.xEnd − RESPAWN_AFTER_VOLCANO_BACK`.
- `updateRespawnTimers(state, obs, cfg)` gagne `obs.inElanZone: boolean` (calculé par le pas de course : `x ∈ [xElanStart, xLip]` d'un volcan, élan et rampe seulement : au-delà du sommet c'est la lave qui tranche, et le cas 1 de la tâche 4 attend `lava`) : si vrai et |angle| > `SIDE_ANGLE` → `'flipped'` immédiat (sans les délais 1 s / 2 s).
- Le décalage groupé (plusieurs voitures) est fait en tâche 5b.

- [ ] **Step 1 : Tests** : zone interdite = `[xLancement + 5, xReception)` (demi-ouverte) ; accepté dans les 5 premiers mètres du lancement et sur la réception ; refusé dans un cratère (fixture : une piste dont une tranche est retypée `'cratère'` à la main) ; cible 2e chute = `xEnd − 10` ≥ `xReception + 10` sur les graines 0 à 19 ; retourné sur l'élan ou la rampe → `'flipped'` au premier pas ; retourné dans la vallée ou hors volcan → délais inchangés.
- [ ] **Step 2 : FAIL** → **Step 3 : Implémenter** → **Step 4 : PASS** → **Step 5 : Commit** `feat: points sûrs avant le lancement, respawn en fin de réception, retourné dans l'élan`

---

### Task 4 : Simulations d'acceptation, suite lente, balayage de dosage

**Files:**
- Create: `tests/volcans.test.ts`, `tests/rampes.test.ts` (scission de `tests/jump.test.ts`, supprimé), `tests/race-smoke.test.ts`, `tests/helpers/runs.ts` (helpers partagés), `tests/slow/` (déplacer `finish.test.ts`, `respawn-sim.test.ts`, `stars-sim.test.ts` ; créer `volcans-slow.test.ts`, `dosage.test.ts`), `vitest.slow.config.ts` (`include: ['tests/slow/**/*.test.ts']`, `exclude: ['tests/slow/race-objective.test.ts']`, `testTimeout: 1_800_000`), `vitest.slow-race.config.ts` (`include: ['tests/slow/race-objective.test.ts']`, `passWithNoTests: true`, même timeout)
- Modify: `vite.config.ts` (`include: ['tests/*.test.ts']`), `package.json` (`"test:slow": "vitest run -c vitest.slow.config.ts"`, `"test:slow:race": "vitest run -c vitest.slow-race.config.ts"`), `.github/workflows/deploy.yml` (inchangé : `npm test` seulement)
- Test: `tests/volcans.test.ts`, `tests/rampes.test.ts`, `tests/race-smoke.test.ts`, `tests/slow/*.test.ts`

**Interfaces (`tests/helpers/runs.ts`, construits à partir des helpers actuels de `jump.test.ts` : `worldFor`, `freshCar`, `launch`, `step`, `volcanoRun`, `sautRun`) :** `worldFor(seed)`, `runFrom(world, x0, opts: { throttle: (t) => boolean; turboAt?: number; speedCapUntil?: { x: number; v: number }; maxSeconds: number })` → `{ lava: boolean; landX: number | null; landAngle: number; flipped: boolean; wheelsBelow: boolean; maxStuck: number; lipSpeed: number | null }` (`lipSpeed` : vitesse au passage de `xLip`, pour les mesures). `speedCapUntil` : à chaque pas tant que `x < x` cible, `Body.setVelocity` plafonne la vitesse horizontale à `v`.

Cas (addendum §1.7), chacun sur toutes les `rampe-volcan` des graines indiquées, assertions à 100 % :
1. arrêt à `xElanStart` → `lava` avant `xReception` ;
2. arrêt à `xLancement + SAFE_LANCEMENT_MARGIN` (pire point sûr) **et** à `xLancement` → pas de lave, `landX ≥ xReception`, |angle| < 45°, pas de retournement, roues sous le châssis ; `lipSpeed` ≥ `LIP_SPEED_THRESHOLD + 1` m/s, avec `LIP_SPEED_THRESHOLD` constante de `tests/helpers/runs.ts`, **mesurée à capteur 0,3 m** (la sonde de la relecture donne 10,3–10,5 m/s à 0,5 m ; attendre ≈ 10,1 à 0,3), consignée dans le registre, mise à jour d'après `dosage.test.ts` qui la bissecte sur `speedCapUntil` et l'imprime ;
3. arrêt à `max(xLancement − 60, xStart de la tranche précédente)` quand la tranche précédente est `bosses` ou `rampe-saut` → comme 2 ;
4. comme 2 avec vitesse plafonnée à 8 m/s jusqu'à `xElanStart − 15` (choc simulé : `Body.setVelocity` à chaque pas tant que x < seuil) → comme 2 ;
5. comme 2 avec turbo activé à `xElanStart − 2` → pas de lave, `xReception ≤ landX < xEnd` ;
6. course complète doigt posé (`simulateRace`), graines 0 à 4 : 0 respawn, `finishedAt` ∈ [120, 170] s, 6 ≤ étoiles prises ≤ 14 ;
7. course « doigt levé 30 % » : motif `mulberry32(seed)` par tranche de 1 s (`rng() < 0.3` → levé) → ≤ 2 respawns par volcan, arrivée < 240 s ;
8. (tâche 15) cratère.

Répartition : `tests/volcans.test.ts` = cas 1 à 5 sur les graines 0 à 2 ; `tests/rampes.test.ts` = scénarios `rampe-saut` existants **conservés** (V_MAX, turbo, lancée, depuis l'arrêt, roues sous le châssis) ; `tests/slow/volcans-slow.test.ts` = cas 1 à 5 sur les graines 3 à 9 + cas 7 (qui absorbe le test « motif 0,7 » de `respawn-sim.test.ts`) ; cas 6 : graines 0 à 4 dans `tests/slow/finish.test.ts` (déplacé), et la seule graine 1 dans `tests/race-smoke.test.ts` (une course, ≈ 25 s) pour la CI.
`tests/slow/dosage.test.ts` : pour `L_ELAN` de 3 à 16 m par pas de 1 (cfg surchargé, pistes regénérées), part de volcans où le cas 1 tombe et où le cas 2 (pire point sûr seulement) passe, graines 0 à 2 (≈ 14 × 18 × 2 runs ≈ 6 min) ; imprime le tableau et la bissection de `LIP_SPEED_THRESHOLD` ; asserte que la valeur de `CONFIG.L_ELAN` donne 100 % / 100 %. Mesure de référence : à 8 m, 27/29 ; à 6 m, 29/29 ; à 10 m, 2/29 passent.

- [ ] **Step 1 : Réorganiser** (déplacements, configs, script) : `npm test` ne lance plus les suites lentes ; `npm run test:slow` les lance.
- [ ] **Step 2 : Tests** cas 1 à 7 + dosage ; **Step 3 : FAIL / PASS** ; si le cas 1 ou 2 n'est pas à 100 % avec `L_ELAN 6` / `LAVA_MARGIN 0,8` / capteur 0,3 : ajuster `L_ELAN` (3 à 8) d'abord, puis `LAVA_SENSOR_ABOVE_RIM` (0,2 à 0,5) en gardant une marge lancée ≥ 1 m/s, jamais `LAVA_MARGIN` ni `V_JUMP` sans l'écrire dans le registre ; reporter les mesures (vitesse au sommet par scénario, seuil de franchissement, tableau de dosage) dans la passation.
- [ ] **Step 4 : Chronométrer** `npm test` (< 6 min mur ; si `volcans.test.ts` seul dépasse 3 min, les cas 3 et 4 passent sur les graines 0 à 1 seulement) ; `npm run test:slow` (≈ 15 min) ; `test:slow:race` vide pour l'instant.
- [ ] **Step 5 : Commit** `test: simulations « arriver lancé », suite lente, balayage de dosage` ; **push** ; déploiement ; **test tablette par le papa** (gate : au plus 2 tours de calibration ; le papa fixe `L_ELAN`).

---

## Partie 2 — Copains (addendum §2, spec §6 §7)

### Task 5a : Pilotes

**Files:**
- Create: `src/cars/pilots.ts`
- Test: `tests/pilots.test.ts`

**Interfaces:**
```ts
export interface Pilot { id: string; name: string; color: number; accent: number; helmet: number; base: number; lift: number }
export const PILOTS: readonly Pilot[]; // Pablo, Diego, Timothée, Matthis, Malo, Liam
export const GALAHAD: Pilot;           // id 'galahad', bleu 0x1e5cff / rouge 0xe2231a
export function drawPilots(pilotSeed: number, count = 4): Pilot[]; // mulberry32, sans doublon
```
`base` ∈ [0,85 ; 1,0], `lift` ∈ [0 ; 0,6] (probabilité de lever le pied avant une rampe-saut ou double-bosse), fixés à la main par pilote (2 prudents, 2 moyens, 2 fonceurs). Couleurs distinctes entre elles et de Galahad (distance RGB ≥ 120 sur au moins une composante).

- [ ] **Step 1 : Tests** : 6 pilotes, ids uniques, Galahad jamais tiré, 4 sans doublon, même graine → mêmes pilotes, graines 0 à 99 → chaque pilote apparaît au moins 20 fois, couleurs distinctes.
- [ ] **Step 2–4 : FAIL / Implémenter / PASS** → **Step 5 : Commit** `feat: pilotes et tirage des copains`

---

### Task 5b : Course à 5 voitures (pas de course multi-voitures, grille, chocs, respawn groupé)

**Files:**
- Modify: `src/sim/simulate.ts` (refonte), `src/cars/respawn.ts` (décalage groupé), `src/physics/car.ts` (si `createCar` a besoin d'un index de groupe : déjà `index`), `src/game.ts` (`sim.cars[0]`, `rebuildCar` → `rebuildCars`, `progress(id)` pour toute voiture, `window.__game.pilots`), `src/render/renderer.ts` (plusieurs voitures, prénom au-dessus des robots : déjà `CarView.name`), `src/config.ts` (`GRID_SPACING_FACTOR: 1.5`, `START_DELAY_PER_RANK: 0.3`, `RESPAWN_GROUP_SPACING_FACTOR: 1.5`, `RESPAWN_GROUP_MAX_SHIFT: 4`)
- **Migration obligatoire** (tous dans `tsconfig`, donc typecheck) des usages de `sim.car`, `sim.state`, `sim.contact`, `sim.others`, `sim.invulnerable`, `carView(sim)`, `rebuildCar(sim)` vers `sim.cars[0]` / `carView(sim, 0)` / `rebuildCars(sim)` : `src/game.ts`, `tests/simulate.test.ts`, `tests/race-smoke.test.ts`, `tests/volcans.test.ts` et `tests/rampes.test.ts` (s'ils utilisent `RaceSim`), `tests/slow/respawn-sim.test.ts`, `tests/slow/stars-sim.test.ts`, `tests/slow/finish.test.ts`, `tests/helpers/runs.ts`.
- Test: `tests/simulate.test.ts`, `tests/respawn.test.ts`, `tests/race-smoke.test.ts`, `tests/slow/race-invariants.test.ts`

**Interfaces:**
```ts
export type Driver = (ctx: { t: number; state: CarState; track: Track; speed: number }) => boolean; // doigt posé ?
export interface CarSim { pilot: Pilot; body: CarBody; state: CarState; contact: GroundContact; airborneSince: number | null; invulnerable: boolean; driver: Driver | null; factor: number }
export interface RaceSim { track; world; cars: CarSim[]; time; events: SimEvent[]; stars; starBodies; cfg; pilotSeed: number }
export function createRaceSim(track, cfg, opts?: { pilotSeed?: number; robots?: boolean }): RaceSim; // défaut robots: false → Galahad seul ; les tests et le jeu à 5 voitures passent robots: true explicitement (tous les fichiers migrés du plan A gardent le défaut et le disent en commentaire)
export function stepRace(sim, galahadThrottle: boolean): void;
```
- `SimEvent` gagne `carId`. Grille : Galahad à `xStart − 2`, robot de rang n à `xStart − 2 − n × GRID_SPACING_FACTOR × CAR_LENGTH`. Délai de départ : le driver renvoie `false` tant que `t < n × START_DELAY_PER_RANK` (tâche 6 ; en 5b, driver provisoire = doigt posé après le délai).
- Ordre d'un pas : pour chaque voiture : drive (facteur `car.factor`, 1,0 en 5b), contact, air-level ; `stepWorld` une fois ; pour chaque voiture : clamp, progress, étoiles (une étoile prise par une voiture est inactive pour toutes), arrivée (chaque voiture a son `finishedAt`), invulnérabilité (`others` = châssis des autres), observe & respawn.
- Respawn groupé (`cars/respawn.ts`, pur) : `shiftTarget(point, occupiedXs: number[], track, cfg): SafePoint` : tant qu'un `occupiedXs` est à moins de `RESPAWN_GROUP_SPACING_FACTOR × CAR_LENGTH` de la cible et que le nombre de reculs < `RESPAWN_GROUP_MAX_SHIFT`, reculer la cible de `RESPAWN_GROUP_SPACING_FACTOR × CAR_LENGTH`, puis l'ajuster vers l'amont par pas de `TRACK_POINT_SPACING` jusqu'au premier x où `|slopeAt| < SAFE_POINT_MAX_SLOPE`, hors `forbiddenZone` de tout volcan et hors tranche `'cratère'` (au plus 10 m d'ajustement, sinon ce recul est abandonné) ; après 4 reculs ou abandon, **garder la dernière cible valide** (l'invulnérabilité couvre le chevauchement). `y` et `angle` = sol local.
- `simulateRace(track, { throttle, maxSeconds, cfg, robots?, pilotSeed?, stopAfterFinish? })` v2 : s'arrête à `finishedAt(Galahad) + stopAfterFinish` (défaut `FINISH_COAST_SECONDS` ; `tests/slow/finish.test.ts` passe 10 car il asserte l'arrêt 10 s après la ligne) ou à `maxSeconds` ; renvoie en plus `ranking` final, `respawnsByCar`, `lavaByCar`, `finishedAtByCar`, `maxStepMs` et `meanStepMs` (indicateurs).
- `game.ts` : caméra sur `cars[0]`, scène avec toutes les voitures, effets pour toute voiture visible.

- [ ] **Step 1 : Tests** : `simulate` : non-régression du plan A : avec le défaut (`robots: false`), graine 1 doigt posé 20 s, `progressAt(t)` échantillonné chaque seconde égale (±0,01 m) une trace figée **avant** la refonte (capturée en Step 1 et collée dans le test) ; grille : 5 voitures espacées de 3,3 m, Galahad devant, aucune paire active entre voitures au pas 0 ; `respawn` : `shiftTarget` sur un plat recule de 3,3 m par occupant, s'arrête à 4, saute une pente, refuse la zone interdite, garde la cible si rien n'est valide ; `race-smoke` (CI) : graines 1 et 2, 5 voitures doigt posé (robots : driver provisoire) → personne bloqué > 2 s, ≤ 3 respawns par voiture, aucun événement `'speed'`, Galahad arrive, `meanStepMs` < 4 (indicateur imprimé) ; « 5 dans la lave » : les 5 voitures posées **à `xLava`** (comme `respawn-sim.test.ts`), avec le **même** `safePoint` (`x = xLancement + 1`, légal) imposé aux 5 états, doigt posé → 5 respawns dans les 3 s, à l'instant de chaque respawn aucune paire de châssis dont les AABB se chevauchent, aucun `'speed'` dans les 5 s suivantes ; `slow/race-invariants` : graines 0 à 9, mêmes invariants.
- [ ] **Step 2–4** ; **Step 5 : Commit** `feat: course à 5 voitures, grille de départ, chocs, respawn groupé` ; push ; **le papa mesure le fps à 5 voitures** (`?debug=1`) → décide la tâche 9 (qui peut s'intercaler n'importe où avant la tâche 16, sans renumérotation).

---

### Task 6 : Conduite des robots

**Files:**
- Create: `src/ai/driver.ts`
- Modify: `src/sim/simulate.ts` (branche le driver), `tests/deps.test.ts` (`src/ai` sans matter-js ni DOM)
- Test: `tests/driver.test.ts`

**Interfaces:**
```ts
export function makeRobotDriver(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): Driver;
```
Règles (spec §7, addendum §1.8) : `false` tant que `t < rank × START_DELAY_PER_RANK` ; `true` dans `[xLancement, xLava]` de tout volcan ; devant une `rampe-saut` ou `double-bosse` (x dans les 8 m avant `xStart` de la tranche), tirage une fois par tranche : `rng() < pilot.lift` → lever 0,4 s ; sinon `true`. Après `finishedAt` : ignoré (le pas freine).

- [ ] **Step 1 : Tests** : délai de départ ; jamais `false` dans la zone volcan même avec `lift = 1` ; avec `lift = 1` lève exactement 0,4 s avant chaque rampe-saut ; avec `lift = 0` jamais ; déterministe par graine.
- [ ] **Step 2–4** → **Step 5 : Commit** `feat: conduite des robots`

---

### Task 7 : Élastique

**Files:**
- Create: `src/ai/rubberband.ts`
- Modify: `src/physics/car.ts` (`applyDrive(car, throttle, { speedFactor, torqueFactor }, cfg)` : `omegaMax × speedFactor`, `WHEEL_SPINUP × torqueFactor` ; **Galahad garde `torqueFactor = 1`** même en turbo, comme au plan A, pour ne pas dérégler la calibration de la tâche 4 ; les robots reçoivent `speedFactor = torqueFactor = car.factor`), `src/sim/simulate.ts`, `src/config.ts` (`RUBBER_WINDOW_M: 12`, `RUBBER_MIN: 0.6`, `RUBBER_MAX: 1.3`, `RUBBER_RATE_PER_S: 0.15`, `RUBBER_NEUTRAL_SECONDS: 5`, `RUBBER_PREZONE_M: 40`, `RUBBER_RAMP_M: 40` = distance sur laquelle le facteur passe de 1,0 à la borne)
- Consommateurs de `applyDrive` à migrer vers la nouvelle signature : `src/sim/simulate.ts`, `tests/helpers/runs.ts`, `tests/car.test.ts`, `tests/bounce.test.ts`, `tests/rampes.test.ts`, `tests/volcans.test.ts`.
- Test: `tests/rubberband.test.ts`, `tests/car.test.ts` (facteur sur le couple), `tests/slow/race-objective.test.ts`

**Interfaces:**
```ts
export function targetFactor(gap: number /* xRobot − xGalahad */, base: number, cfg): number; // base dans la fenêtre ; décroît linéairement jusqu'à RUBBER_MIN quand gap > WINDOW + RAMP ; monte jusqu'à RUBBER_MAX quand gap < −(WINDOW + RAMP)
export function rampFactor(prev: number, target: number, dt: number, cfg): number; // |Δ| ≤ RATE × dt
export function zoneFloor(x: number, track: Track, cfg): number; // 1,0 dans [xLancement − PREZONE, xLava] de tout volcan, sinon 0
export function finalFactor(rubber: number, turbo: number, gap: number, cfg): number; // min(RUBBER_MAX, rubber × turbo) ; si gap > WINDOW : ≤ 1,0
```
Dans le pas (robots) : `t < NEUTRAL_SECONDS` → cible 1,0 ; cible `max(targetFactor, zoneFloor)` ; `rampFactor` ; puis si `x ∈ [xLancement, xLava]` → clamp `≥ 1,0` immédiat ; `car.factor = finalFactor(rubber, turboFactor, gap)`. Galahad : `speedFactor = turboFactor`, `torqueFactor = 1`. Vérifié à la relecture : la décélération par le plafond via la rampe 0,15/s vaut ≈ 2,1 m/s² (acceptable) ; un robot à 1,3 saute une rampe-saut à 18,2 m/s → portée ≈ 49 m < plat de réception.

- [ ] **Step 1 : Tests** purs : bornes [0,6 ; 1,3] ; monotone décroissante en `gap` ; variation ≤ 0,15/s ; neutre les 5 premières secondes ; plancher 1,0 dans la pré-zone et la zone ; turbo robot plafonné à 1,3 et à 1,0 loin devant ; `car.test` : avec `torqueFactor` 0,6 l'accélération mesurée sur 2 s est ≈ 0,6 × 4,3 ± 15 % (l'accélération est ≈ linéaire en `WHEEL_SPINUP`, ledger 7c) ; avec `torqueFactor` 1 et `speedFactor` 1,5, l'accélération reste 4,3 ± 10 % (turbo de Galahad inchangé) ; `slow/race-objective.test.ts` (script `test:slow:race`, ≈ 20 à 25 min) : 20 graines doigt posé + 10 graines motif 30 % → Galahad 1er ou 2e dans ≥ 10 des 20 courses doigt posé, dernier ≤ 2 fois, ≤ 3 respawns par robot ; tableau imprimé.
- [ ] **Step 2–4** ; si l'objectif n'est pas atteint : ajuster `base` des pilotes et `RUBBER_RAMP_M` (consigner) ; **Step 5 : Commit** `feat: élastique des copains` ; résultat de la suite lente dans la passation.

---

### Task 8 : Position, barre de progression, classement

**Files:**
- Create: `src/cars/ranking.ts`
- Modify: `src/ui/hud.ts`, `src/game.ts`, `src/config.ts` (`RANK_HYSTERESIS_S: 0.5`, `RANK_HYSTERESIS_M: 2`, `RANK_HIDE_SECONDS: 1`)
- Test: `tests/ranking.test.ts`, `tests/hud.test.ts` (jsdom)

**Interfaces:**
```ts
export function rankCars(cars: { index: number; progress: number; finishedAt: number | null }[]): number[]; // indices triés : arrivés par temps, puis progression, tie-break index
export class DisplayedRank { update(rawRank: number, gapToNeighbourM: number, t: number): number } // change si tient 0,5 s ou si écart > 2 m
export function ordinal(rank: number): string; // 1 → '1er', 2 → '2e' …
```
HUD : position en haut à gauche (très gros, petite voiture bleue dessinée en CSS/SVG inline), vide la première seconde ; barre de progression en haut au centre avec 5 points colorés (progress / xFinish) ; chrono à droite (existant).

- [ ] **Step 1 : Tests** : `rankCars` (cas arrivés/non arrivés/égalité) ; hystérésis (changement bref ignoré, changement tenu 0,5 s affiché, écart > 2 m immédiat) ; HUD jsdom : texte « 1er » après 1 s, vide avant, 5 marqueurs positionnés en %.
- [ ] **Step 2–4** → **Step 5 : Commit** `feat: position, barre de progression, classement` ; capture `e2e/screenshots/course-copains.png`.

---

### Task 9 (conditionnelle) : Fenêtre glissante de corps de sol

À faire **seulement si** le papa mesure < 50 fps à 5 voitures sans décor (après la tâche 5b ou 8).

**Files:** Modify `src/physics/world.ts` (`updateGroundWindow(world, xMin, xMax, margin = 150)` : ajoute/retire les trapèzes pour que les corps présents couvrent exactement `[xMin − margin, xMax + margin]`, `xMin`/`xMax` = voiture la plus en arrière / la plus en avant), `src/sim/simulate.ts` ; Test `tests/world.test.ts` (après déplacement, les corps présents couvrent exactement la fenêtre ; une voiture ne traverse jamais le sol à la frontière : simulation 60 s doigt posé graine 1 à 5 voitures, Galahad arrêté à 20 s, sans `'underground'`).

- [ ] Commit `perf: fenêtre glissante de corps de sol`

---

## Partie 3 — Finitions (spec §8 §9 §10 §12)

### Task 10 : Machine d'états, titre, décompte, pause, orientation

**Files:**
- Create: `src/ui/screens.ts`
- Modify: `src/game.ts` (états `title | countdown | racing | finished | podium | paused | error` ; `error` garde le comportement actuel : 3 échecs de `stepRace` ou une exception de rendu → « Oups ! Recharge la page », boucle arrêtée), `src/main.ts`, `src/render/renderer.ts` (scène titre : voiture qui rebondit), `index.html`, `src/config.ts` (`COUNTDOWN_SECONDS: 3`), `vite.config.ts` (`define: { __APP_VERSION__ }` depuis `package.json`, déclaré dans `src/vite-env.d.ts`, **à créer**)
- Test: `tests/game-states.test.ts` (jsdom, machine d'états pure extraite dans `src/loop/states.ts`), `e2e/race.spec.ts` (mis à jour : JOUER → décompte → course)

**Règles (spec §4, §8) :** `title` → clic JOUER (activation : `AudioContext.resume()`, `requestFullscreen()` dans le `click`, échec ignoré) → `countdown` (3, 2, 1, PARTEZ, 1 s chacun, plein écran) → `racing` (`history.pushState`) ; `popstate`, `visibilitychange` caché, orientation portrait (`innerHeight > innerWidth`) → `paused(prev)` avec calque « PAUSE » ou « TOURNE » + dessin de tablette, bouton REPRENDRE (96 px min, **`data-no-pedal`** : le `pointerdown` n'est jamais compté par `Throttle`, aucune nouvelle API) actif seulement en paysage, reprise de `countdown` à 3. `history.pushState` à l'entrée en `racing` **si aucune entrée n'est en place** (drapeau `historyArmed`, remis à faux par `popstate`, qui consomme l'entrée) ; sinon `replaceState` (pile stable, et le deuxième geste retour ne quitte pas la page) ; `requestFullscreen()` avec `.catch(() => {})` (rejeté en headless et sur certains Chrome). Titre : nom du jeu, version en tout petit, voiture qui rebondit, JOUER (rond, drapeau), son, AUTRE PISTE (dé → `seed = (Date.now() % 100000)`, écrit dans l'URL par `history.replaceState`). `pointerdown` sur JOUER compte comme doigt posé (pas de `data-no-pedal`). `ENCORE`/`MENU` arrivent en tâche 11 ; en attendant, `finished` → `title` après 3 s.

- [ ] **Step 1 : Tests** : transitions pures (table, y compris `error` depuis `racing`/`countdown`) ; jsdom : boutons ≥ 96 px, calque TOURNE en portrait, REPRENDRE porte `data-no-pedal` ; e2e : titre → JOUER → `countdown` → `racing` ; portrait → `paused` + TOURNE ; paysage + tap REPRENDRE → `countdown` puis `racing`, progression inchangée par le tap ; doigt gardé depuis JOUER → la voiture avance dès PARTEZ.
- [ ] **Step 2–4** → **Step 5 : Commit** `feat: titre, décompte, pause et orientation` ; captures `titre.png`, `decompte.png`, `pause.png`.

---

### Task 11 : Podium

**Files:**
- Modify: `src/ui/screens.ts` (podium), `src/game.ts` (`finished` → 1,5 s roue libre → `podium` ; ENCORE → `countdown` avec mêmes graines piste et pilotes ; MENU → `title`), `src/render/effects.ts` (confettis si Galahad 1er)
- Test: `tests/podium.test.ts` (jsdom), e2e (course courte 300 m jusqu'au podium, capture `podium.png`)

**Règles (spec §6 « Arrivée », §8) :** classement final = `rankCars` ; 3 marches avec prénom, couleur et médaille ; Galahad toujours affiché (sur le podium ou à côté avec sa place) ; son temps en gros ; ENCORE (gros), MENU, son. Les robots non arrivés sont classés par progression.

- [ ] **Step 1–4** → **Step 5 : Commit** `feat: podium, ENCORE et MENU`

---

### Task 12 : Audio

**Files:**
- Create: `src/audio/context.ts` (création, `resume` au clic et à chaque `pointerup` tant que suspendu, `suspend` sur `visibilitychange`), `src/audio/engine.ts` (oscillateur + bruit filtré, hauteur ∝ vitesse de Galahad), `src/audio/sfx.ts` (turbo, étoile, boing, pof, respawn, trompette, bips), `src/audio/music.ts` (boucle 8 mesures), `src/audio/mute.ts` (localStorage `mute`)
- Modify: `src/game.ts` (branche les événements : `star`, `landing` (airtime > 0,6 s → boing), `respawn`, `finish`, chocs (impulsion > seuil, ≥ 0,3 s entre deux)), `src/ui/screens.ts` (bouton son au titre et au podium), `src/config.ts` (`VOL_ENGINE: 0.15`, `VOL_SFX: 0.5`, `VOL_MUSIC: 0.3`, `HIT_REL_SPEED_MIN: 3`, `HIT_MIN_INTERVAL_S: 0.3`) ; choc = paire active châssis/châssis de deux voitures dans `engine.pairs.list` après le pas, avec vitesse relative > `HIT_REL_SPEED_MIN` (événement `'hit'` émis par `stepRace`, avec les deux `carId`)
- Test: `tests/audio.test.ts` (jsdom + faux `AudioContext` : aucun son pour une voiture hors écran, gains via `setTargetAtTime`, mute mémorisé, jeu silencieux si `AudioContext` absent)

- [ ] **Step 1–4** → **Step 5 : Commit** `feat: moteur, effets sonores, musique et bouton son` ; le papa vérifie sur la tablette (volume, pas de clic).

---

### Task 13 : PWA et version

**Files:**
- Modify: `package.json` (`vite-plugin-pwa@^2.0.0` — compatible Vite 8, vérifié — **plus ses pairs explicites** `workbox-build@^7.4.1` et `workbox-window@^7.4.1`, sinon ERESOLVE à `npm ci` ; `version`), `vite.config.ts` (`VitePWA({ registerType: 'prompt', disable: !!process.env.VITEST, manifest: { name, short_name, display: 'fullscreen', orientation: 'landscape', start_url: '.', icons: [svg] } })`), `src/main.ts` (mise à jour appliquée **uniquement** à l'écran titre : `updateSW()` différé tant que l'état ≠ `title`), `src/ui/screens.ts` (version), `playwright.config.ts` (`webServer` est global : tableau de deux serveurs, `npm run dev` sur 4173 et `npm run build && npm run preview -- --port 4174` ; projet `tablet` avec `baseURL` 4173 et `testIgnore: 'pwa.spec.ts'`, projet `preview` avec `baseURL` 4174 et `testMatch: 'pwa.spec.ts'`)
- Test: `tests/pwa.test.ts` (la fonction `shouldApplyUpdate(state)` pure), `e2e/pwa.spec.ts` (projet `preview` : `manifest.webmanifest` servi avec `display: fullscreen`, `navigator.serviceWorker.getRegistration()` défini). Repli si le plugin ne build pas sous Vite 8 : service worker manuel minimal (cache de `dist/`), consigné.

- [ ] **Step 1–4** → **Step 5 : Commit** `feat: PWA et numéro de version` ; le papa ajoute à l'écran d'accueil de la tablette.

---

### Task 14 : Playwright tablette, captures, relecture de mi-parcours

**Files:** `e2e/race.spec.ts`, `e2e/helpers.ts`, `playwright.config.ts`.

- [ ] Scénarios du spec §11 complets (titre, JOUER, doigt gardé, portrait/paysage, course courte jusqu'au podium, ENCORE rejoue la même piste : même `seed` et mêmes prénoms lus dans `window.__game.pilots`) ; captures titre, course, podium envoyées au papa.
- [ ] Relecture de branche (standard + adversariale + `code-review` sur `cd7afb1..HEAD`), corrections, **Commit** `test: e2e tablette complets` ; passation.

---

## Partie 4 — Décor lunaire (addendum §3.2)

### Task 15 : Tranche `cratère`

**Files:**
- Modify: `src/track/slices.ts` (`cratere(rng, cfg)` : longueur 8 à 12 m, profondeur `min(1.2, L × tan(MAX_SLOPE) / π)`, profil en cosinus), `src/track/generate.ts` (poids = celui de `double-bosse` ; compte comme « autre type » entre deux volcans), `src/cars/safepoint.ts` (jamais de point sûr dans un `cratère`), `src/track/stars.ts` (non admissible), `src/ai/driver.ts` (pas de lever de pied), `src/render/track.ts` (ombre du cratère)
- Test: `tests/slices.test.ts`, `tests/generate.test.ts`, `tests/safepoint.test.ts`, `tests/stars.test.ts`, `tests/volcans.test.ts` (cas 8 : traversée à `V_MAX` et turbo, arrêt au fond puis doigt posé → |angle| < 45°, pas de retournement, pas de blocage > 2 s)

- [ ] **Step 1–4** → **Step 5 : Commit** `feat: tranche cratère`

---

### Task 16 : Calques de décor

**Files:**
- Create: `src/render/decor.ts`
- Modify: `src/render/background.ts` (montagnes en parallaxe 0,2, pré-rendues), `src/render/track.ts` (texture du sol par bande pré-rendue, rochers 1 par 40–80 m hors `rampe-volcan`, positions tirées de la graine de piste), `src/render/renderer.ts` (drapeau au départ, module lunaire après l'arrivée, étoile filante toutes les 10–20 s pendant 0,5 s), `src/config.ts` (`DECOR_MOUNTAINS: 1`, `DECOR_TEXTURE: 1`, `DECOR_ROCKS: 1`, `DECOR_FLAG: 1`, `DECOR_MODULE: 1`, `DECOR_SHOOTING: 1`, + un drapeau par choix de Galahad), `src/track/generate.ts` (pas de rochers : rendu seul)
- Test: `tests/render-smoke.test.ts` (chaque calque dessine sans exception, drapeau à 0 → rien de dessiné : espionner `ctx` par compteur d'appels), `tests/decor.test.ts` (positions des rochers déterministes, hors volcans)

- [ ] **Step 1–4** ; **Step 5 : Commit** `feat: décor lunaire par calques` ; le papa mesure le fps calque par calque (`?debug=1`, 5 voitures) ; sous 50 fps, le dernier calque ajouté passe à 0 dans `config.ts` (commit `chore:`). Les trois choix de Galahad (addendum §0) sont ajoutés ici, chacun derrière son drapeau ; s'ils ne sont pas connus au moment de la tâche, elle les saute et la passation le note.

---

### Task 17 : Relecture de branche finale et remise

- [ ] `npm run typecheck`, `npm test`, `npm run test:slow`, `npm run test:slow:race`, `npm run e2e` verts ; captures finales.
- [ ] Relecture de branche `cd7afb1..HEAD` : standard, adversariale, `code-review` ; vague de correction ; re-relecture.
- [ ] Passation finale `docs/superpowers/handoff/2026-10-21-plan-b-passation.md` (état, décisions hors plan, mesures, mineurs reportés, prochaine action : plan C) ; registre `sdd-ledger-plan-b.md`.
- [ ] Commit `docs: plan B terminé, passation et registre finaux` ; push ; déploiement vérifié ; le papa et Galahad jouent.
