# SDD ledger — plan: docs/superpowers/plans/2026-10-20-plan-a-socle-jouable.md
Spec: docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md (lu, autorité)
Workspace: branche ccr-5b6fabc4-n96ofo dans le conteneur (branche désignée, pas main). Ruling: pas de worktree séparé — la branche de travail est déjà isolée et c'est la seule que l'on pousse ; coût si faux : aucun (rien d'autre ne vit dans ce conteneur).

## Pré-vérification (scan du plan)

| Paire / tâche | Produit vs consommé | Constat |
|---|---|---|
| T1 CONFIG ↔ T9a/T9b | GALAHAD_COLOR/ACCENT sont des nombres (Config = number), CarView.color/CarState.color sont des string | CONFLIT → Ruling: createRaceSim (T9b) convertit via un helper `colorHex(n)` ; coût si faux : trivial |
| T2 ballistics ↔ T3 slices | jumpRange(v0,g,angle,drop), runUpDistance | cohérent |
| T3 types ↔ T4 generate | T4 dit « ajouter exemptPointIndices au Track » mais types.ts est créé en T3 | CONFLIT → Ruling: T3 définit `exemptPointIndices: number[]` dans Track dès le départ |
| T3 tests ↔ T7a/T7b calibration | T3 assert `lElan ≈ 24.4` et `dxLava ≈ 11.49` avec CONFIG, mais T7a remplace DRIVE_ACCEL et T7b peut changer LAVA_MARGIN | CONFLIT → Ruling: les assertions numériques de T3 utilisent un cfg explicite `{...CONFIG, DRIVE_ACCEL: 4, V_JUMP: 10, LAVA_MARGIN: 0.7}` ; l'assertion sur CONFIG réel vérifie la formule ; coût si faux : un test à retoucher |
| T3 SliceProfile.volcano (dx*) ↔ T4 Volcano (x*) | T4 ajoute xStart de la tranche | cohérent |
| T4 heightAt/slopeAt ↔ T6/T7a/T9b/T10 | World.track porte la piste | cohérent |
| T6 test lave sur seed 1 | seed 1 n'a pas forcément de volcan | Ruling: les tests prennent la première graine de 0..9 ayant ≥ 1 volcan |
| T7a normalizeAngle | T7a dit « physics/angle.ts », T10a dit « cars/angle.ts » | CONFLIT → Ruling: T7a crée `src/cars/angle.ts` (pur), physics/car.ts l'importe ; T10a réexporte |
| T7a ↔ T4 onlyPlat | generateTrack(seed,len,cfg,{onlyPlat}) | cohérent |
| T8 Throttle ↔ T9b Game / T9b Hud (data-no-pedal) | exemption opt-in | cohérent |
| T9a Renderer/Scene/CarView ↔ T9b/T12/T13 | Scene.stars[].active, CarView.turbo | cohérent |
| T9b RaceSim/stepRace/simulateRace ↔ T10b/T11/T12 | extensions successives, SimEvent union | cohérent ; simulateRace renvoie respawns/starsTaken vides avant 10b/12 |
| T9b Game.progress('galahad') ↔ T14 e2e | id 'galahad' fixé en createRaceSim | cohérent |
| T10a chooseRespawnTarget ↔ T10b | lastRespawnLavaX dans CarState (T9b) | cohérent |
| T11 ↔ T10b | ordre : finish après respawn dans stepRace | cohérent |
| T12 syncStarBodies ↔ T9a drawStar | Scene.stars.active | cohérent |
| Chaque tâche, auto-cohérence | tests vs code, fichiers créés vs modifiés | T10a : « réexporte normalizeAngle ? Non » — texte auto-corrigé, ruling ci-dessus. T9b crée src/loop/accumulator.ts testé par deps.test (T2 couvre src/loop). OK |
| Mandats du plan vs rubrique | tests qui n'assertent rien, duplication | aucun trouvé |

## Progression
Task 1: minor (deferred): caret ranges sur matter-js/@types/matter-js/@playwright/test (plan-mandated via `npm install pkg@x`) ; description/repository.url inventés dans package.json ; commit T1 sans trailer Co-Authored-By (les dispatches suivants l'imposent)
Task 1: complete (commits bce81e0..a7714cf, review clean)
Task 2: minor (deferred): pas de garde g≤0/accel≤0 dans ballistics ; poids négatifs dans pickWeighted ; tolérance ±5 % absolue ; garde de deps limitée à .ts et aux substrings exacts ; type Vec dans physics/units.ts (track/ ne peut pas l'importer)
Task 2: complete (commits a7714cf..cdaa057, review clean)
Task 3: Ruling: STOP_BUMP_LENGTH = longueur de chaque flanc de la butée (butée sur 2 m, pente max 25°) — le brief disait 1 m total ce qui donnait 43° > MAX_SLOPE ; coût si faux : butée un peu plus longue, sans effet de jeu. Ruling: START_LENGTH 26,5 arrondi à la grille (26,6) via profile.length — coût nul.
Note: commits ré-attribués à Claude <noreply@anthropic.com> (hook du dépôt) ; cdaa057→954ddf8, 3acacb2→1dfb14d ; git config local réglé, les dispatches suivants n'utilisent plus -c user.*
Task 3: minor (deferred): VolcanoGeometry.dxLava (depuis le lip) vs SliceProfile.volcano.dxLava (depuis le début de tranche) — même nom, origines différentes ; test bosses sans rng saturé ; assertion tautologique dxLava ; largeur du plancher de lave non testée ; literals magiques dans rampeSaut/doubleBosse ; pas de garde LAVA_WIDTH < 0,4 ; commentaire STOP_BUMP_LENGTH dans config.ts à mettre à jour (« chaque flanc »)
Task 3: complete (commits 954ddf8..1dfb14d, review clean)
Task 4: minor (deferred): pas de test « refus de volcan → retirage » ; generateTrack lève si cible < ~100 m (parseTrackOptions borne à 300) ; switch dupliquant la table de poids ; convention de slopeAt aux sommets non documentée ; ?seed=-0.5 → -0 ; cas ?len=0 et ?seed=2.7 non testés
Task 4: complete (commits 1dfb14d..2002bbf, review clean)
Task 5: minor (deferred): tests d'exclusion lave/plat final sans garde de non-vacuité ; sources rampe-saut et plat de réception jamais assertées ; détermination trivialement vraie dans un cas ; tirages rng inutiles sur les plats finaux
Task 5: complete (commits 2002bbf..b29c0ea, review clean)
Task 6: Ruling: le test « sol sans trou » du plan (centre = heightAt + R ± 0,05) est faux sur les pentes (R/cos θ) ; remplacé par la distance normale au segment le plus proche − R (ou heightAt + R/cos(slopeAt)), ±0,05, sur les graines 0..4 — coût si faux : un test moins strict d'un demi-centimètre, aucun effet de jeu
Task 6: fix round 1/5 (2 addressed, 0 open — métrique normale au sol sur seeds 0..4 ; check() redondant retiré ; commits 607289c..1820059)
Task 6: minor (deferred): test de tunneling incapable de détecter un sol mince (21 px/pas < 36 px de roue ; marge réelle = 400 px de profondeur) ; signe de signedGroundDistance par heightAt (OK sans surplomb) ; constante 400 px magique dans floorY ; import style retenu : `import Matter from 'matter-js'` + destructuration
Task 6: complete (commits b29c0ea..1820059, review clean)
Task 7a: Ruling: convention d'angle = angle monde (positif = nez en montée, comme slopeAt) ; carAngle = normalizeAngle(−chassis.angle) ; placeCar prend un angle monde ; le rendu (9a) doit inverser le signe pour dessiner — coût si faux : voiture dessinée penchée à l'envers, visible immédiatement
Task 7a: Ruling: inertie passée explicitement (×4 = Body._inertiaScale, formule analytique) car l'option `mass` de matter-js 0.20 n'actualise pas l'inertie (_initProperties fige la valeur avant setMass) — vérifié dans la source par le relecteur ; coût si faux : aucun (le test de construction asserte les inerties)
Task 7a: calibration retenue : WHEEL_SPINUP 0.006, DRIVE_ACCEL 4.3 (mesuré 4,33 m/s²), AIR_LEVEL_K 0.004 / D 0.08 (40° → 2,9° en 90 pas, sans dépassement), vitesse max 13,8 m/s
Task 7a: fix round 1/5 (2 addressed, 0 open — test air-level avec suspension au repos + témoin K=D=0 ; ancres des contraintes assertées ; commits 466810d..4a430df)
Task 7a: minor (deferred): INERTIA_SCALE=4 dupliqué de Matter ; STEP_MS dupliqué entre car.ts et world.ts ; test de pente en montée seulement ; plafond omegaMax appliqué en un pas (fin de turbo abrupte) ; cliquet omega ≥ 0 : voiture calée sur une rampe ne recule pas ; roues posées à heightAt + R légèrement enfoncées en pente raide ; air-level depuis une pose placeCar seule (ressorts hors repos) se comporte différemment
Task 7a: complete (commits 1820059..4a430df, review clean)
Task 7b: mesures (inertie corrigée) : vitesse au lip 11,4–12,7 m/s (pire point sûr 11,1), atterrissages 5–11 m après xReception, turbo ≥ 44 m avant xEnd ; rampes-saut |angle| ≤ 1,4° au contact, max 37° ensuite ; aucune constante changée
Task 7b: Ruling: « roue au sol » sera débouncé (contact dans les 0,1 s) dans stepRace (9b/10b) car à V_MAX les roues rebondissent (aucune roue au sol 76 % des pas sur plat, écarts ≤ 0,14 m ; 0,58 m avec turbo) — origine : voiture 7a (suspension) ; à vérifier visuellement en 9b (si vibration visible : tour de correction sur SUSPENSION_STIFFNESS/DAMPING) ; coût si faux : points sûrs plus rares à grande vitesse
Task 7b: concern: rampe-saut suivie d'une rampe-saut → voiture « échouée » au pied de la 2e à 1–5 m/s (détecteur de blocage 10a le couvre)
Task 7b: minor (deferred): voiture précédente jamais retirée du monde mis en cache (groupe commun, inoffensif) ; pas d'assertion touchX ≥ xReception ; un rebond sur plat peut compter comme « vol » sur les runs lents ; plancher de vitesse 0,7 lâche ; runs « depuis l'arrêt 40 m avant » coûteux et hors brief
Task 7b: complete (commits 4a430df..2b282ec, review clean)
Task 7c (ajoutée — complexité cachée): Ruling: roues = polygones à 18 côtés (Bodies.circle, maxSides par défaut) → rebond à V_MAX ; correctif ciblé : maxSides 48–64 sur les roues dans physics/car.ts, mesure de la part de pas « roue au sol » à V_MAX sur plat, re-validation car.test + jump.test — coût si faux : ~3 min de tests ; si le rebond persiste, revoir masses/amortissement en calibration (étape 6) et débouncer wheelsOnGround en 9b/10b
Task 7c: mesures : 18 côtés → excursion châssis 0,105 m / 3,4° à V_MAX ; 48 côtés (Bodies.polygon, maxSides est seulement un plafond) → 0,042 m / 1,5° ; turbo 0,26 m ; contact par pas reste ≤ 26 % quels que soient côtés/raideur/amortissement (limite du moteur : pivot sur sommet, v²/r ≫ g)
Task 7c: Ruling: (1) roues = Bodies.polygon à WHEEL_SIDES 48 avec circleRadius ; (2) WHEEL_SPINUP recalibré pour garder DRIVE_ACCEL 4,3 ±10 % (lElan inchangé) ; (3) « roue au sol » débouncé : contact dans les 0,1 s (`groundedUntil` par roue) — exposé par physics/car.ts via un petit état `GroundContact` et utilisé par stepRace pour air-level, points sûrs, atterrissage ; (4) seuils de bounce.test : part débouncée ≥ 0,95 (f1) / ≥ 0,8 (turbo), excursion ≤ 0,05 m (f1) / ≤ 0,3 m (turbo), |angle| ≤ 3° — coût si faux : rebond visible au turbo (26 cm) à revoir en calibration (appui aérodynamique), noté pour l'étape 6
Task 7c: DÉFAUT DE PLAN découvert : suspension bistable (2 ancres colinéaires sur la ligne médiane → position miroir de la roue au-dessus du châssis, stable car roue/châssis ne collisionnent pas) ; 91/148 sauts de rampe finissent avec une roue basculée dans le code d'origine ; jump.test passait par chance
Task 7c: Ruling: 3e contrainte par roue depuis un point haut du châssis (axleX, −CAR_HEIGHT/2 − SUSPENSION_TOP_OFFSET) → 3 ancres non colinéaires, position unique sous le châssis ; test « roues sous le châssis » après atterrissages durs + assertion dans chaque run de jump.test ; re-mesure du rebond après ce correctif ; contact au sol = contact brut OU écart roue-sol < GROUND_CONTACT_GAP (3 cm) OU dans la fenêtre de 0,1 s ; seuils fixés sur mesure avec planchers (f1 : au moins une roue ≥ 0,8, deux roues ≥ 0,6, excursion ≤ 0,1 m ; turbo : au moins une ≥ 0,6, excursion ≤ 0,3 m) — coût si faux : suspension un peu plus raide ; si les planchers ne sont pas atteints → BLOCKED et je revois le modèle de voiture
Task 7c: résultat : 3e ressort → roues basculées 0/148 rampes, 0/45 volcans ; contact de jeu (brut OU écart < 3 cm OU 0,1 s) : f1 au moins une 98 %, deux 93 %, excursion 0,067 m, 1,7° ; turbo 85 %, 0,166 m ; WHEEL_SPINUP 0.0054 (4,34 m/s²) ; air-level 40° → 7,8° (limite 10°)
Task 7c: commit 4c4255d (trailer amendé Fable 5.1) — en relecture
Task 7c: fix round 1/5 (2 addressed, 0 open — console.log retirés, commentaire WHEEL_SIDES ; commits 4c4255d..c23d146)
Task 7c: minor (deferred): marge air-level mince (7,8° / limite 10°) → nudge AIR_LEVEL_K 0.006 / D 0.1 ou couple sur l'inertie totale ; test d'atterrissage dur à repro étroite (ajouter l'assertion wheelsBelowChassis à chaque pas) ; 3 Constraint.create répétitifs (helper spring()) ; pas d'assertion « air-level inactif sur plat »
Task 7c: complete (commits 2b282ec..c23d146, review clean)
Task 8: minor (deferred): casts PointerEvent ; dispose non testé pour blur/visibilitychange ; contextmenu bouillonnant non testé ; down sur data-no-pedal puis up ailleurs non testé (comportement correct)
Task 8: complete (commits c23d146..e7cbf8f, review clean)
Task 9a: minor (deferred): ox fractionnaire du ciel (seam) ; resize re-prérend même sans changement ; literals magiques (mur 10 m, drapeaux) ; lava via heightAt(xLava) sans commentaire d'équivalence ; tests smoke sans position du mur/drapeau ; skyOffset non testé ; garde deps render sur `from 'matter-js'` seulement ; camera.ts non gardé « sans DOM »
Task 9a: complete (commits e7cbf8f..425b2e1, review clean) — contrat pour 9b : CarView.angle et wheel.angle en convention monde (y up) → négation des angles Matter (carAngle le fait déjà ; roues : −wheel.angle)
Task 9b: capture etape1.png vue par le contrôleur : OK (voiture, pilote, sol, Terre, chrono, 57 fps)
Task 9b: minor (deferred): strength d'atterrissage couplée à PHYSICS_DT vs STEP_MS ; game.ts lit chassis.position pour la caméra (utiliser sceneOf) ; pas de tests unitaires pour landing/negation des roues/rebuildCar/formatTime ; compteur d'erreurs cumulatif ; listeners resize/visibilitychange jamais retirés
Task 9b: complete (commits 425b2e1..0b9ff60, review clean)
Ruling (hors plan): dépôt privé → GitHub Pages impossible sans passage en public ; étapes Pages du workflow conditionnées à `vars.DEPLOY_PAGES == 'true'` pour arrêter les mails d'échec en attendant la décision du papa (public / Vercel / fichier unique) — coût si faux : réactiver une variable
Task 10a: minor (deferred): tests dépendant de generateTrack (fixture à 2 volcans souhaitable) ; bornes exactes non testées ; _cfg inutilisé ; target stocké par référence (10b ne doit pas le muter)
Task 10a: complete (commits 942f978..38dee01, review clean)
Task 10b: mesures : doigt posé seeds 0..4 → 0 respawn avant xFinish (atteint en 127–134 s) ; motif 70/30 seed 1 → 0 respawn, maxStuck 0,68 s ; sans ligne d'arrivée la voiture bute sur le mur → 'stuck' toutes les 2 s (50 par seed) → assertion « zéro respawn » limitée à avant xFinish jusqu'à la tâche 11
Task 10b: DÉFAUT DE CONCEPTION : capteur de lave de (surface + 0,2 m) au plancher → une voiture lente (3–4 m/s) traverse le cratère de 3 m sans le toucher ; le flanc amont ne bloque pas non plus (bascule dans le cratère puis 'lava' à 3 s). Ruling: le capteur de lave remplit TOUT le cratère (de rimY au plancher, largeur lavaWidth, spec §5 « tout le volume du cratère ») ; rendu de la lave jusqu'à rimY − 0,15 ; nouveau test « rampe depuis la vallée » : voiture à l'arrêt au fond de la vallée, doigt posé → 'lava' en ≤ 10 s et jamais x ≥ xReception ; test « flanc amont » : respawn (lava ou stuck) ≤ 2,1 s depuis x = xLava − lavaWidth/2 − 0,8 ; re-validation jump.test (les sauts passent 2 m au-dessus du rebord) — coût si faux : un saut rasant déclenche la lave (visible dans jump.test)
Task 10b: fix round 1/5 (2 rulings appliquées — capteur de lave plein cratère, tests flanc/vallée ; commits 0ee4a46..3a4c6f3)
Task 10b: minor (deferred): assertion maxStuck ≤ 2,1 infalsifiable (copie du timer) ; test flanc trivial (vallée discrimine) ; point sûr rafraîchi là où la voiture est bloquée sur plat → respawn 'stuck' sur place (OK pour le mur, à garder en tête) ; coins du capteur de lave exactement sur les rebords ; bulles 5 cm au-dessus du rebord
Task 10b: complete (commits 38dee01..3a4c6f3, review clean)
Note: Pages activé par le papa (Source = GitHub Actions) ; run 13 (attempt 2) vert → https://i-dmk.github.io/Galahad-s-car-game/
Décision papa : finir le plan A dans cette session ; passation écrite dans docs/superpowers/handoff/ et mise à jour à chaque fin de tâche ; relectures ≤ 30 lignes
Task 11: mesures : finishedAt 127–134 s (seeds 0..4), arrêt ~22 m après la ligne, 0 respawn
Task 11: minor (deferred): progressAt décalé d'un pas (tCross = finishedAt + DT, passe à la borne ±DT) ; start() ne remet pas finishTime/finishShown ; Game.time non figé (seul le HUD l'est, conforme)
Task 11: complete (commits 96fea85..db878fc, review clean)
Task 12: équilibrage à voir en calibration (étape 6) : 27–36 étoiles par course (espacement 12–20 m), turbo quasi permanent, course 110–115 s au lieu de 127–134 ; levier : espacement des étoiles dans placeStars (ex. 40–60 m) ou TURBO_SECONDS
Task 12: mesures : seed 1 doigt posé 35 étoiles (1re à 6 s), maxSpeed 21 m/s, arrivée 110 s, 0 respawn ; seeds 0..4 : 0 respawn, 110–114 s
Task 12: minor (deferred): assertion turbo===false à t+4,9 fragile ; collectStars actif après l'arrivée ; _cfg inutilisé dans syncStarBodies
Task 12: complete (commits 19a0582..68d4679, review clean)
