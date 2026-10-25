# Course Lunaire de Galahad — addendum « rochers » (plan C, tâche 11c)

Date : 2026-10-25
Statut : **v1, décisions du papa prises** (Q-C1 à Q-C8 et Q-C4 bis, session 8, 2026-10-25) ; **à relire par le papa avant le plan**.
Amende : le spec du 2026-10-20 (§3.3 de l'addendum plan B : « obstacles qui ralentissent ou bloquent plutôt que qui tuent »), l'addendum « bouton saut » (`2026-10-21-bouton-saut-design.md`, §0 « hors périmètre : obstacles sur la piste » et §4 tests) et l'addendum plan B (`2026-10-21-plan-b-addendum.md`). En cas de contradiction, ce document l'emporte sur les trois pour tout ce qui touche aux rochers ; il ne change rien d'autre.

## 0. Origine, intention, décisions

Test tablette des tâches 6 et 7 (2026-10-24) : course « trop facile », Galahad concentré garde le doigt posé tout le temps. Décision du papa : le levier est le **plan C, des obstacles qui ralentissent, à sauter au bouton**, après le jalon « démo tablette » (rempli le 2026-10-25) et avant l'audio. `ENGINE_BRAKE` écarté (il ne joue que doigt levé). Vidéo de la démo : Galahad mène longtemps puis se fait doubler à la fin ; le défi tient, les rochers donnent du jeu au bouton saut.

Ce qui définit le succès :
- doigt posé sans jamais sauter, on **touche** chaque rocher et on perd ≈ 1,2 s à chacun ; on finit toujours la course ; **un rocher ne cause jamais de réapparition** (ni lave, ni retournement, ni blocage) ;
- un saut bien placé passe au-dessus ; la fenêtre est entre celle d'une fosse et celle d'une étoile haute (§2) ;
- les copains sautent les rochers avec leur caractère : les fonceurs en touchent ≈ 1 sur 3, les prudents presque jamais (§4) ;
- Galahad comprend seul : le rocher est plus haut que la voiture, il éclate quand on le touche.

**Décisions du papa (2026-10-25, registre)** :

| # | Question | Décision |
|---|---|---|
| Q-C1 | Nature de l'obstacle | **capteur + ralentissement imposé** (pas de corps solide : mesuré, dès 0,45 m de haut la voiture se bloque et réapparaît) |
| Q-C2 | Prix d'un rocher touché | **vitesse ramenée à 2 m/s**, ≈ 1,2 s perdues (0 m/s : 1,67 s ; 4 m/s : 0,87 s) |
| Q-C3 | Taille | **1,6 m de haut × 3 m de large** : fenêtre 0,77 / 0,88 s à 11,2 / 14 m/s |
| Q-C4 | Combien, où | **au plus 4 par course**, tirés après tous les autres tirages (terrain et étoiles inchangés au bit près) |
| Q-C4 bis | Places | **plats ordinaires + réceptions de fosse** : 4,2 places par piste (2 à 7), jamais 0 (les plats seuls : 2,4, 7 pistes sur 50 sans rocher) |
| Q-C5 | Copains | **sautent toujours**, erreur des fosses N(0, 2,5 × `jumpSkill`) |
| Q-C6 | Rendu | **dessin par code**, le rocher **éclate** au choc et disparaît pour cette voiture |
| Q-C7 | Signal d'approche | **rien qui s'allume** (cohérent avec Q-F5 des fosses), à rejuger sur la tablette |
| Q-C8 | Chocs après le ralentissement | la voiture ralentie est **traversable ≈ 1,5 s** (mécanisme de l'invulnérabilité) |

Conventions des chiffres : **MESURÉ** = sonde jetable de la session 8 (Galahad seul, vrai `stepRace`, piste plate de 700 m, rocher en x = 250 m, obstacle-capteur ou corps solide, supprimée après) ; **CALCULÉ** = formule ou prototype statique sur `generateTrack` (graines 0 à 49, 1 680 m). Le plan refait ces mesures en tests.

## 1. Le rocher

- **Objet de piste** : `Rock { id, xStart, xEnd }` dans `Track.rocks` (ordre de la piste), `xEnd = xStart + ROCK_WIDTH` (3 m). Hauteur `ROCK_HEIGHT` = 1,6 m au-dessus du sol local (toujours du plat par construction, §3). Pas de nouveau type de tranche : un rocher se pose **sur** une tranche existante.
- **Capteur** (`physics/rocks.ts`, comme `physics/stars.ts`) : un rectangle statique `isSensor` par rocher, `[xStart, xEnd] × [sol, sol + ROCK_HEIGHT]`, label `'rock'`, catégorie `CAT.SENSOR`, **masque = OU des catégories des voitures qui ne l'ont pas encore touché** (`syncRockBodies`, même règle que `syncStarBodies` : un capteur ne reste jamais actif sans raison, Galahad seul garde un filtre d'une seule voiture).
- **État par voiture** (`cars/rocks.ts`, pur) : `RockState { id, hitAt: (number | null)[] }`, une case par voiture ; `isRockActiveFor(state, k)` = `hitAt[k] === null`. **Un seul choc par voiture et par rocher**, jamais réarmé (après le choc la voiture est de l'autre côté ; ENCORE recrée la course).
- **Rendu vu par Galahad** : `Scene.rocks: { xStart, xEnd, height, active }[]`, `active` = pas encore touché **par Galahad** (index 0) ; un copain qui touche un rocher ne change rien à l'écran, comme pour les étoiles (décision P5 du plan B).

### 1.1 Pourquoi pas un rocher solide (Q-C1)

MESURÉ, corps Matter statique (friction 1), 14 et 11,2 m/s doigt posé, 5 phases de départ :

| Hauteur | Issue | Temps perdu sur 60 m |
|---|---|---|
| 0,3 m | passe dessus, aucun retournement | 0,70 à 1,02 s |
| 0,4 m | passe dessus | 1,52 à 2,07 s |
| 0,45 m | passe à 14 m/s ; **à 11,2 m/s, 1 run sur 5 bloqué → réapparition** | 2,0 à 3,1 s |
| 0,5 m | passe à 14 m/s (2,5 s) ; **à 11,2 m/s, bloquée 5 fois sur 5 → réapparition** | — |
| ≥ 0,6 m | arrêt net, réapparition « bloquée » (2 s) | — |

Un rocher qui ne tue pas doit faire ≤ 0,4 m : il se saute alors avec plus de 1,5 s de fenêtre (aucun défi), ressemble à un caillou, et cinq voitures qui s'y bousculent seraient chaotiques. Le capteur donne un prix exact, le même à toute vitesse.

## 2. Le choc et la fenêtre

### 2.1 Le choc (Q-C2, Q-C8)

Au pas où une pièce de la voiture k (châssis ou roue) touche un rocher actif pour elle (lecture de `sensorsTouching` dans la phase d'après `stepWorld`, comme `collectStars`), `collectRocks(sim, car, k)` :
1. `hitAt[k] = t` ; le masque du capteur est réaligné à la fin du pas (`syncRockBodies`) ;
2. `applyRockHit(body, cfg)` (`physics/car.ts`, hors de tout callback de collision, comme `applyJump`) : la vitesse de **chaque pièce** est ramenée à la norme `ROCK_HIT_SPEED` = 2 m/s, direction conservée (une pièce plus lente ne change pas) ; la vitesse angulaire des roues est ramenée au roulement à 2 m/s (`ROCK_HIT_SPEED / WHEEL_RADIUS`), pour que les roues ne patinent pas ;
3. **traversable** : `car.invulnerable = true`, `state.invulnerableUntil = t + ROCK_HIT_TRAVERSABLE` (1,5 s), `syncMask` ; la levée est celle d'aujourd'hui (`releaseInvulnerability` : dès `invulnerableUntil` si aucune pièce ne chevauche une autre voiture, et de toute façon `RESPAWN_INVULN_MAX − RESPAWN_INVULN` = 1,5 s plus tard). Les copains traversent la voiture ralentie au lieu de la percuter à 14 m/s (précédent : les fantômes près des volcans ont fait passer les chutes de 11 à 2 sur 24 graines, tâche 5b). Un copain touché devient traversable de la même façon ;
4. événement `'rock'` (`carId`, `t`, `x`, `id`) : éclats et poussière (§5), son plus tard (tâche 12).

Ce qui ne change pas : le turbo en cours reste (la reprise est plus vive, le rocher coûte moins : accepté) ; le doigt, le saut, le délai de saut (le choc ne consomme pas de saut) ; le chronomètre « bloquée » (à 2 m/s, 1 m est parcouru en 0,5 s, loin des 2 s) ; aucun capteur de lave ni zone volcan à moins de 60 m (§3), donc **aucune réapparition** ne peut suivre un choc : c'est un test (§6).

Coût, MESURÉ (14 m/s tenus, 60 m après le rocher) : 2 m/s → **1,22 s**, retour à 13 m/s en 2,6 s ; comparaison : 0 m/s → 1,67 s ; 4 m/s → 0,87 s ; 6 m/s → 0,60 s ; zone lente à 4 m/s sur 6 m → 1,38 s. Repères : une chute dans une fosse ≈ 3,6 s de retour plus la réaccélération, deux chutes ≈ 4,5 s (saut §6.4).

### 2.2 La fenêtre (Q-C3)

MESURÉ, obstacle-capteur, appui à chaque pas des 2 s qui précèdent le contact du témoin sans saut, « passe » = aucune pièce ne touche la boîte, aucune réapparition, d'un seul tenant partout :

| h × w | 8 m/s | 11,2 m/s | 14 m/s | bords à 14 m/s (s avant `xStart`) |
|---|---|---|---|---|
| 0,8 × 1 | 1,30 s | 1,42 s | 1,47 s | 0,25 – 1,69 |
| 0,8 × 3 | 1,05 s | 1,23 s | 1,32 s | 0,25 – 1,54 |
| 1,2 × 1 | 1,10 s | 1,20 s | 1,25 s | 0,35 – 1,57 |
| 1,2 × 3 | 0,85 s | 1,03 s | 1,12 s | 0,35 – 1,44 |
| 1,2 × 6 | 0,48 s | 0,75 s | 0,92 s | 0,35 – 1,24 |
| 1,2 × 9 | 0,10 s | 0,48 s | 0,68 s | 0,35 – 1,01 |
| **1,6 × 3 (choisi)** | **0,62 s** | **0,77 s** | **0,88 s** | **0,48 – 1,34** |
| 1,6 × 1 | 0,87 s | 0,95 s | 1,00 s | 0,48 – 1,46 |
| 1,6 × 6 | 0,23 s | 0,50 s | 0,65 s | 0,48 – 1,11 |
| 2,0 × 3 | 0,28 s | 0,47 s | 0,57 s | 0,63 – 1,17 |

Lecture pour 1,6 × 3 : la hauteur fixe le **dernier** appui possible (0,48 s avant, la voiture doit être déjà haute), la largeur fixe le **premier** (il faut retomber après le rocher). Distances châssis → `xStart` au saut : 6,7 à 18,8 m à 14 m/s, 5,5 à 13,9 m à 11,2, 4,1 à 8,9 m à 8. Repères : fosse 1,02 / 1,20 s, étoile haute 0,57 / 0,60 s. La fenêtre **grandit avec la vitesse** : en turbo (21 m/s) elle dépasse 0,88 s (CALCULÉ ; à mesurer dans le plan, avec le départ arrêté à 30 m du rocher : ≈ 13 m/s à l'arrivée, fenêtre attendue ≈ 0,8 s).

**Ce que voit l'enfant** (CALCULÉ, vue 1 280 × 800, avance de caméra 0,6 s) : la piste est visible 19,6 m devant à 14 m/s, soit 1,4 s ; la fenêtre s'ouvre 1,34 s avant : **dès que le rocher apparaît, on peut sauter**, et jusqu'à ce qu'il soit à ≈ 7 m. À 11,2 m/s : visible 1,6 s avant, fenêtre de 1,24 à 0,49 s avant. Pas de signal d'approche (Q-C7) ; un rocher raté se voit (la voiture bute, le rocher éclate).

**Centre de la fenêtre** : 0,91 / 0,86 / 0,81 s avant `xStart` à 14 / 11,2 / 8 m/s (MESURÉ). Formule des copains : `rockJumpLead(v) = ROCK_JUMP_AIM − ROCK_WIDTH / (2 max(v, 1))` avec `ROCK_JUMP_AIM` = 1,0 s → 0,89 / 0,87 / 0,81 s, à 0,02 s des centres mesurés. Bord au plus tard : `rockLatestLead(v)` = 0,48 s à 14, 0,49 à 11,2, 0,51 à 8 → `ROCK_JUMP_LATE` = 0,5 s (constante, le bord tardif dépend de la hauteur, pas de la vitesse).

## 3. Combien, et où (`placeRocks`) (Q-C4, Q-C4 bis)

- **`placeRocks(track, rng, cfg)`** est appelé par `generateTrack` **après `placeStars`**, et ne tire sur le `rng` de piste **qu'après tous les autres tirages** : avec `ROCKS_PER_RACE` = 0, aucun tirage de plus, pistes et étoiles identiques au bit près à celles d'aujourd'hui (c'est l'entrée `ROCKS_PER_RACE: 0` ajoutée à `ANCIENNES_PISTES`). Déterministe : ENCORE rejoue les mêmes rochers.
- **Candidates**, une par place, dans l'ordre de la piste (CALCULÉ, graines 0 à 49) :
  - **plats ordinaires** (`plat`, hors plat de départ, hors plat d'arrivée au-delà de `xFinish − FINISH_PLAT_BEFORE`), longueur ≥ `ROCK_MIN_PLAT` (20 m, c'est le minimum du générateur), **pas le plat qui suit un volcan** (tremplin ou fosse : à la sortie d'une réception les voitures se rattrapent et se cognent, décision a105e2b), le rocher entièrement sur le plat ;
  - **réceptions de fosse** : `xStart` ≥ bord aval + `FOSSE_STAR_AFTER` + `ROCK_STAR_GAP` (35 m : 10 m après l'étoile de réception) et `xEnd` ≤ `xEnd` de la fosse − 5 m ; c'est dans la zone fantôme (bord aval + 40 m) : accepté, la voiture ralentie y est de toute façon traversable. Une voiture posée à bord aval + 5 m après deux chutes (option B) repart arrêtée et arrive au rocher 30 m plus loin à ≈ 13 m/s (CALCULÉ) : elle peut le sauter ;
  - dégagements : `xStart` ≥ `track.xStart + D_LANCE` (zone de départ, comme les étoiles hautes) ; `xStart` ≥ fin de la dernière rampe-saut + `ROCK_RAMP_CLEARANCE` (50 m : une voiture lancée par une rampe-saut vole jusqu'à 61 m à 21 m/s et retomberait sur le rocher **sans pouvoir sauter**, hors tolérance de sol ; même valeur que `STAR_HIGH_RAMP_CLEARANCE`) ; `xEnd` + `ROCK_VOLCANO_GAP` (60 m) ≤ début de la prochaine tranche volcan (après un choc à 2 m/s, il faut `D_LANCE` ≈ 27 m pour revenir à 14 m/s avant l'approche d'une fosse ; décision Q-C4) ; `xStart` ≥ étoile haute précédente + `ROCK_HIGH_STAR_LANDING` (30 m : atterrissage d'un saut d'étoile en turbo ≤ 27 m) ;
  - **position** : le centre de l'intervalle admissible, décalé au point admissible le plus proche du centre qui laisse `ROCK_STAR_GAP` (10 m) entre le rocher et toute étoile basse (un rocher sous une étoile ferait un capteur sous un capteur) ; sans point admissible, pas de candidate ;
  - **espacement** : `ROCK_SPACING` = 60 m entre deux rochers retenus (glouton dans l'ordre de la piste).
- **Choix** : s'il y a au plus `ROCKS_PER_RACE` (4) candidates, toutes ; sinon `ROCKS_PER_RACE` tirées sans remise par le `rng` (Fisher-Yates partiel, comme `chooseHighStars`), résultat dans l'ordre de la piste. Ids 0, 1, 2…
- **Effet mesuré** (CALCULÉ, prototype statique, graines 0 à 49 ; le prototype n'appliquait `ROCK_VOLCANO_GAP` qu'aux plats, pas aux réceptions de fosse : le plan remesure avec toutes les règles, et si la moyenne passe sous 4,0 ou qu'une piste tombe à 0, il le dit au papa avec les leviers ci-dessous) : **4,20 candidates par piste (2 à 7)** ; avec le plafond 4 : **4 rochers sur 34 pistes, 3 sur 8, 2 sur 8, jamais 0**. Plats seuls (sans les réceptions de fosse) : 2,42 (0 à 6), 7 pistes sans rocher : c'est pourquoi les réceptions de fosse entrent (Q-C4 bis). La règle qui coûte le plus est le dégagement après une rampe-saut (1,58 plat par piste juste après une rampe-saut ; sans lui, 3,62 candidates) ; elle est gardée. Leviers si le papa veut plus de rochers : `ROCK_VOLCANO_GAP` 60 → 40 (+0,1), autoriser le plat qui suit un volcan (+0,4), plats-rocher insérés par le générateur (exactement 4 partout, mais toutes les pistes changent : écarté par le papa, Q-C4 bis).
- Pistes courtes (`?len=`) : au plus 4, souvent moins ; 0 à 300 m est permis.
- **Terrain** : aucune tranche n'est ajoutée ni déplacée, aucune hauteur ne change. Les volcans restent 3,62 par course, les étoiles 8,50 basses et 3 hautes (saut §6.3, §6.5).

## 4. Copains (Q-C5)

- **Ils sautent tous les rochers**, sans tirage `jumpTry` (comme les fosses) : ne pas sauter coûte 1,2 s à coup sûr.
- `DriverContext.nextRock: { xStart, index } | null` : prochain rocher devant à moins de `JUMP_LOOKAHEAD` (40 m), **encore actif pour cette voiture** (rempli par `fillContext` avec un curseur, comme `nextHighStar`).
- **Instant visé** : demande à chaque pas tant que `inRockJumpWindow(xStart, x, v, cfg, e)` : `(xStart − x) / max(v, 1)` ≤ `rockJumpLead(v) + e` et > `JUMP_BUFFER`, le filet `JUMP_BUFFER + PHYSICS_DT` compris (`cars/jump.ts`, à côté d'`inFosseJumpWindow`). **Pas de bascule** d'une erreur trop tardive (contrairement aux fosses, saut §6.8) : un saut trop tard se voit déjà, la voiture bute sur le rocher et il éclate.
- **Erreur** `e` ~ N(0, `FOSSE_SKILL_FACTOR` × `jumpSkill`) = N(0, 2,5 × trait), **une par rocher** pré-tirée à la création du driver (`robotDraws`, après les erreurs de fosse et avant les levers de pied : les tirages existants gardent leurs valeurs quand `ROCKS_PER_RACE` = 0 ; avec des rochers, les tirages de `lift` changent : accepté, c'est de l'aléa de caractère). Une seule tentative par rocher (pas de « 2e essai » : après le choc, la voiture est passée).
- Priorité des demandes dans `wantJump` : fosse (sur l'approche), puis rocher, puis étoile haute. Un rocher n'est jamais dans [`xLancement`, `xReception`] d'un tremplin ni dans une tranche fosse avant sa réception (§3) : `inNoJumpZone` et la garde `autoJumps` ne changent pas. Sur une réception de fosse, le rocher est permis (hors `inNoJumpZone`, qui ne couvre que les tremplins).
- **Taux de choc attendus** (CALCULÉ, loi normale, demi-fenêtres mesurées : 0,44 s à 14 m/s, 0,385 s à 11,2, 0,31 s à 8) :

  | Pilote (σ = 2,5 × jumpSkill) | 14 m/s | 11,2 m/s | 8 m/s |
  |---|---|---|---|
  | Pablo (0,45 s) | 33 % | 39 % | 49 % |
  | Matthis (0,375 s) | 24 % | 30 % | 41 % |
  | Diego (0,25 s) | 8 % | 12 % | 21 % |
  | Malo (0,225 s) | 5 % | 9 % | 17 % |
  | Liam (0,125 s) | 0,04 % | 0,2 % | 1,3 % |
  | Timothé (0,10 s) | ≈ 0 | ≈ 0 | 0,2 % |

  Un fonceur perd ≈ 1,5 s par course (4 rochers × 1,2 s × 30 %) ; l'élastique absorbe. Mesuré dans le plan (48 graines, par bras comme `robots-sauts`) : fonceurs entre 15 et 45 % de chocs par rocher, prudents ≤ 2 %.
- Politesse, lever de pied, élastique, zone volcan : inchangés. Un copain traversable (après son choc) ne bloque personne (`traversable` du contexte, déjà là).

## 5. Rendu et effets (Q-C6, Q-C7)

- **Rocher** (`render/track.ts`, `drawRock`, dessiné après la piste et avant les étoiles, seulement dans la vue) : polygone gris lunaire irrégulier (7 à 9 sommets, déterministes par `id`) inscrit dans `[xStart, xEnd] × [sol, sol + ROCK_HEIGHT]`, ombre portée au sol (ellipse sombre), une arête claire en haut à gauche ; pas de contour magenta, pas d'image pour l'instant. Une image générée par le papa pourra le remplacer plus tard par le repli image par image de la 8b (`art.rock`), hors de ce périmètre.
- **Rocher touché par Galahad** : au pas du choc, `Effects.rockBurst(x, y)` émet 14 éclats gris (triangles, gravité, vie 0,8 s, rotation) et 10 grains de poussière (comme la poussière d'atterrissage), dans le plafond `MAX_PARTICLES` (300) ; le rocher **n'est plus dessiné** pour Galahad (`active` faux). Un copain qui touche un rocher : rien à l'écran pour Galahad (§1).
- **Interpolation** : les rochers sont statiques, rien à interpoler ; les éclats sont des effets (≤ 1 pas d'avance accepté, comme les étoiles, 5f).
- **Pas de signal** d'approche (Q-C7) : ni panneau ni halo. À rejuger sur la tablette.
- HUD inchangé ; `__game` expose le nombre de chocs de Galahad (`rocksHit`) et les rochers de la piste pour les e2e.
- Au titre et au podium : rien (le podium ne montre pas les voitures ; les rochers de la piste y restent dessinés, comme les étoiles).

## 6. Tests d'acceptation

- **Statique** (graines 0 à 49, 1 680 m) : chaque rocher sur un `plat` ordinaire éligible ou une réception de fosse ; tous les dégagements du §3 ; au plus 4 par piste, 4 sur ≥ 30 pistes sur 50, aucune piste à 0 ; espacement ≥ 60 m ; ≥ 10 m de toute étoile basse ; déterminisme (deux générations identiques) ; **avec `ROCKS_PER_RACE` = 0, piste et étoiles identiques au bit près** à celles d'aujourd'hui (points, tranches, volcans, étoiles).
- **Physique, piste plate, Galahad seul** (`tests/rochers.test.ts`, harnais `tests/helpers/rochers.ts` sur le modèle des fosses) :
  - doigt posé sans saut, à 8, 11,2, 14 et 21 m/s tenus et en turbo pris 40 m avant : le rocher est touché (événement `'rock'`), la vitesse du châssis est ≤ 2,1 m/s au pas suivant, un seul événement par run, aucune réapparition dans les 5 s, temps perdu à 14 m/s entre 1,0 et 1,4 s ;
  - fenêtre : en CI, bloc central de 25 appuis (0,4 s) autour de `rockJumpLead(v)` à 11,2 et 14 m/s et au départ arrêté 30 m avant : tous passent ; fenêtre entière balayée en suite lente (`tests/slow/rochers-fenetres.test.ts`) : ≥ 0,70 s à 11,2 et 14 m/s, ≥ 0,55 s à 8 m/s, premier et dernier pas gagnants aux bords du §2.2 à ± 0,05 s ;
  - un seul choc par rocher : lancé à 2 m/s dedans après un choc, aucun second événement ;
  - traversable : `invulnerable` vrai au pas du choc, levé entre 1,5 et 3,0 s après ;
  - aucune trace sur le saut : `lastJumpAt` et `jumpRequestedAt` inchangés par le choc ;
  - déterminisme (deux runs identiques).
- **Vraies pistes, doigt posé sans saut** (graines 0 à 9, Galahad seul, turbo compris par le motif des étoiles) : **chaque rocher est touché**, jamais survolé ; aucune réapparition dans les 3 s qui suivent un choc. Recette du survol (suite lente) : rocher posé à `ROCK_RAMP_CLEARANCE` exactement après une rampe-saut et à 12 m après une double-bosse, lancée à 21 m/s : touché ou passé derrière, jamais une réapparition.
- **5 voitures** (graines 0 à 23 ; Galahad sauteur parfait aux fosses et aux rochers, puis sans saut) : 0 réapparition dans les 3 s après un choc rocher, pour toute voiture ; 0 retournement dans ces 3 s ; invariants existants gardés (≤ 3 réapparitions par robot hors fosses, arrivée de Galahad < 240 s, `ghostContacts` = 0) ; chocs des copains comptés par bras (48 graines, `tests/slow/robots-rochers-*.test.ts`) : fonceurs 15 à 45 % par rocher, prudents ≤ 2 %, 0 saut de copain dans `inNoJumpZone`.
- **Rattrapage** (`npm run test:slow:rattrapage`, lignes étiquetées par commit, 48 graines) : place moyenne de Galahad doigt posé **sans saut** avant et après (attendue : elle monte, il perd ≈ 4 × 1,2 s) ; **sauteur parfait** avant et après (attendue : quasi inchangée, ± 0,1 place) ; chiffres au registre et dans la passation, pas d'assertion.
- **Empreinte** : `FROZEN` (pistes d'avant, `ROCKS_PER_RACE` = 0) identique ; `FROZEN_CONFIG` **recapturée par le ruling R-F10** (Galahad doigt posé touche les rochers des graines 0 à 2 dès que l'un tombe dans les 30 premières secondes ; sinon identique : à constater et consigner).
- **e2e** (`e2e/rochers.spec.ts`, graine dont le premier rocher est le plus proche du départ, choisie à l'implémentation) : doigt tenu sans saut jusqu'au rocher → `rocksHit` passe à 1, la vitesse lue chute sous 3 m/s puis remonte, la course continue, capture `rocher.png` (rocher à l'écran avant le choc) et `rocher-eclats.png` (au pas d'après) ; saut par Espace au centre de la fenêtre (`__game` donne `rockJumpLead`) → `rocksHit` reste 0 ; un copain qui touche un rocher ne fait rien disparaître pour Galahad (vérifié sur la scène exposée).
- **Budget** : `npm test` reste < 6 min (les balayages entiers vont en suite lente) ; `npm run e2e` + 2 tests.

## 7. Constantes (`config.ts`) et interrupteur

| Constante | Valeur | Rôle |
|---|---|---|
| `ROCKS_PER_RACE` | 4 | au plus N rochers par course ; **0 = aucun, pistes d'aujourd'hui au bit près** (entrée ajoutée à `ANCIENNES_PISTES`) |
| `ROCK_WIDTH`, `ROCK_HEIGHT` | 3, 1,6 | m : boîte du capteur et du dessin (Q-C3) |
| `ROCK_HIT_SPEED` | 2 | m/s : norme imposée à chaque pièce au choc (Q-C2) |
| `ROCK_HIT_TRAVERSABLE` | 1,5 | s : la voiture ralentie est traversable (Q-C8, levée par `releaseInvulnerability`) |
| `ROCK_MIN_PLAT` | 20 | m : longueur minimale d'un plat porteur |
| `ROCK_RAMP_CLEARANCE` | 50 | m après une rampe-saut (vol doigt posé jusqu'à 61 m à 21 m/s) |
| `ROCK_VOLCANO_GAP` | 60 | m entre la fin du rocher et le début de la prochaine tranche volcan (décision Q-C4) |
| `ROCK_HIGH_STAR_LANDING` | 30 | m après une étoile haute sans rocher (atterrissage en turbo ≤ 27 m) |
| `ROCK_STAR_GAP` | 10 | m entre un rocher et toute étoile basse ; aussi l'écart après l'étoile de réception d'une fosse |
| `ROCK_SPACING` | 60 | m entre deux rochers |
| `ROCK_JUMP_AIM` | 1,0 | s : `rockJumpLead(v) = ROCK_JUMP_AIM − ROCK_WIDTH / (2 max(v, 1))`, centre de la fenêtre (§2.2) |
| `ROCK_JUMP_LATE` | 0,5 | s : bord au plus tard, information des tests et du sauteur de la dernière chance (pas de bascule) |

Réutilisées : `JUMP_LOOKAHEAD`, `JUMP_BUFFER`, `FOSSE_SKILL_FACTOR`, `RESPAWN_INVULN`, `RESPAWN_INVULN_MAX`, `D_LANCE`, `FOSSE_STAR_AFTER`, `FINISH_PLAT_BEFORE`, `MAX_PARTICLES`.

## 8. Périmètre, régime, méthode

- **Dans la 11c** : §1 à §7, version **1.3.0**, passation et registre, déploiement après validation du papa sur capture puis sur la tablette.
- **Hors périmètre** : son du choc (tâche 12), image du rocher (plus tard, repli de la 8b), panneau ou halo (rejugés après la tablette), rochers sur les bosses, météorites, saut dosé, cratères piégeux (plan C, suite), levier de difficulté réglable.
- **Régime physique** : plan écrit depuis cette spec (rédacteur frais, format du plan 10, relu contre le code dans un worktree avant l'implémenteur), implémenteur frais, **quatre relectures** (standard, adversariale avec sondes et mutants, `code-review`, `security-review`), ≤ 5 tours, « Galahad seul identique au bit près » hors rochers (`FROZEN`), `FROZEN_CONFIG` recapturée par ruling R-F10 au registre, sauvegarde sur `wip-plan-b` après chaque commit, fusion normale sur `ccr-5b6fabc4-n96ofo`, `npm run e2e:live` après le run vert, jamais de PR.
- **Ordre** : 11c, puis 12 (audio ; le son du choc s'ajoute à l'événement `'rock'`), 13, 14, 15, 16, 17.

## 9. À savoir, sans question

- Les rochers ne changent **ni le terrain ni les étoiles** : les mesures des fosses et des étoiles hautes restent valables ; seul l'ordre des tirages des drivers (`lift`) change pour les copains.
- Une piste sur six n'a que 2 ou 3 rochers (jamais 0) ; le papa l'a accepté (Q-C4 bis) plutôt que de faire changer toutes les pistes.
- Le rocher sur une réception de fosse est dans la zone fantôme : une voiture qui le touche y est déjà traversable ; l'étoile de réception (turbo) est 10 m avant lui : en turbo, la fenêtre est plus large, pas plus étroite.
- Un saut juste après un décollage (tolérance de sol, 0,35 s) peut passer un rocher de plus haut : c'est un vrai saut, comme pour les fosses (saut §6.10).
- **Doigt posé sans saut**, l'empreinte de Galahad seul sur les pistes de CONFIG change dès qu'il touche un rocher : recapture R-F10, consignée ; `FROZEN` (pistes d'avant, sans rocher) ne bouge pas.
