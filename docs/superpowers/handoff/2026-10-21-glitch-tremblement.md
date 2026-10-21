# Glitch « une voiture qui tremble » : phase 1, recherche de la cause racine (commit 0a78392)

Enquête menée le 2026-10-21 dans un worktree isolé (`scratchpad/wt-glitch`, commit 0a78392). Rien n'a été corrigé dans `src/`. Les sondes (`tests/zz-probe-glitch-*`, `e2e/zz-probe-glitch-frames.spec.ts`) ont été supprimées à la fin.

Légende : **[MESURÉ]** veut dire obtenu par une sonde, avec les chiffres donnés. **[SUPPOSÉ]** veut dire déduit ou plausible, mais non vérifié.

## 0. Résumé

- **[MESURÉ]** La simulation ne produit **aucun** tremblement visible, avec ou sans copains. Sur 24 courses à 5 voitures doigt posé (graines 0 à 23), 4 courses avec doigt levé et 9 courses de Galahad seul, il n'y a aucune oscillation de l'angle du châssis d'au moins 3° à 3 Hz ou plus. Il n'y a qu'un seul épisode de vibration d'au moins 2 px à l'écran : 0,18 s, et c'est un choc, pas une vibration entretenue. Les contacts entre voitures (copain posé sur un toit, voitures empilées) sont fréquents, mais leurs mouvements sont lents (≤ 2 à 3 Hz). Ils ressemblent à « grimper » ou « rouler sur », pas à « trembler ». Le taux de micro-secousses (≥ 1 px) est le même avec et sans copains : 0,82 contre 0,83 épisode par voiture-minute.
- **[MESURÉ]** La boucle d'affichage (`src/game.ts`) dessine l'état physique brut, sans interpolation. Or la caméra avance, elle, au temps réel (`camera.update(..., elapsed)`). Chaque image qui reçoit 0 pas ou 2 pas physiques au lieu d'un fait donc sauter toutes les voitures d'un pas entier par rapport au décor : 13 px CSS à 14 m/s, 20 px en turbo. On a rejoué les **vraies trajectoires** de Galahad (courses à 5 voitures) à travers `advanceAccumulator` et `Camera` réels :
  - avec un écran à 59,94 ou 60,05 Hz et une gigue de 0,1 à 0,2 ms, on obtient **6 à 7 épisodes de secousses par course** (≥ 3 à-coups de plus de 4 px en 0,5 s), un toutes les 17 à 20 s ;
  - avec la même cadence et une interpolation entre pas, il n'en reste aucun (ou un seul en tout sur 12 courses, dû à la physique, au même niveau que « 1 pas par image ») ;
  - Galahad seul donne le même résultat : 36 épisodes sur 6 courses sans interpolation, 0 avec.
- **Cause racine la plus probable [SUPPOSÉ, mécanisme MESURÉ]** : un **aliasing temporel du rendu**. L'accumulateur à pas fixe n'est pas interpolé, et la caméra est lissée au temps réel. La phase de l'accumulateur dérive lentement par rapport à la synchro de l'écran, parce que la fréquence de rafraîchissement n'est jamais exactement de 60,000 Hz. Quand elle passe près du bord d'un pas, la gigue des horodatages produit une rafale d'images à 0 et 2 pas en alternance. La voiture suivie fait alors des allers-retours de ±13 px pendant quelques dixièmes de seconde : c'est « une voiture qui tremble », « à un moment ». Les fps restent bons (une image par vsync).
- Ce qui reste incertain : la tablette elle-même (fréquence de rafraîchissement et gigue de `requestAnimationFrame`) n'a pas pu être mesurée (voir §8).

## 1. Définition mesurable et seuils

Échelle d'écran : la tablette affiche 800 px CSS de haut pour 14 m (`VISIBLE_HEIGHT_M`), soit 57 px/m. Une voiture fait 2,2 m, soit 125 px. On juge visible un déplacement de 2 à 3 px CSS ou plus. Une rotation de 3° déplace le nez de 1,1 × sin 3° = 5,8 cm, soit 3,3 px. Un pas à 14 m/s correspond à 13,3 px (20 px en turbo).

Côté **simulation** (un état enregistré par pas et par voiture : position, angle, vitesse angulaire, contacts bruts par pièce, sol de jeu, fantôme, invulnérable, turbo, doigt, respawn, roues dans le repère du châssis, air-level actif) :

| Critère | Définition | Seuils | Justification |
|---|---|---|---|
| A. Angle | Demi-oscillations de l'angle du châssis (extrema avec hystérésis) | Amplitude ≥ 3°, chaque demi-oscillation ≤ 10 pas (≥ 3 Hz), au moins 4 de suite | 3° ≈ 3 px au nez. Les bosses (λ de 8 à 14 m à 14 m/s) donnent 1 à 1,75 Hz : le seuil de 3 Hz exclut le suivi du relief. Variantes : 1° et ≤ 10 pas, 3° et ≤ 20 pas (≥ 1,5 Hz) |
| B. Hauteur | Oscillation de y − sol, sur le plat et au sol | ≥ 4 cm (≈ 2,3 px), mêmes règles | « Voiture qui sautille sur le plat » |
| C. Pixels | Coins haut-avant et haut-arrière de la carrosserie en px CSS, passe-haut (écart à la moyenne glissante centrée de 9 pas, ≥ ~4 Hz), RMS sur 0,5 s et inversions de signe | Strict : RMS ≥ 2 px et ≥ 6 inversions en 0,5 s. Large : ≥ 1 px et ≥ 4 inversions | Mesure ce que l'œil voit : angle et position confondus |
| D. Bavardage de contacts | Bascules de « au moins une paire active avec une autre voiture » | ≥ 6 bascules en 1 s (≥ 3 cycles contact / sans contact) | « Voiture qui alterne collision et absence de collision » |
| D'. Masques | Bascules de `ghost` ou `invulnerable` | ≥ 3 bascules en 1 s | Masque qui oscille |
| Roues | Position de chaque roue dans le repère du châssis | Saut de plus de 5 cm en un pas | « Roue qui saute entre deux positions » |

Les pas situés à ±0,5 s d'une réapparition (téléportation) sont exclus. La visibilité suit la caméra de Galahad : x = Galahad + v × 0,6, lissage 0,08, demi-largeur 11,2 m en 16:10.

Côté **rendu** : on calcule la position écran (px CSS) de la voiture suivie, image par image, avec `advanceAccumulator` et `Camera` réels. Un **à-coup** est une image où |Δ²x| > 4 px. Un **épisode de tremblement** compte au moins 3 à-coups en 0,5 s. Les téléportations (|Δx| > 60 px) sont exclues à ±1 s.

## 2. Données

**[MESURÉ]** Une sonde a enregistré chaque course en entier, avec un état par pas et par voiture, jusqu'à 1,5 s après l'arrivée de Galahad :

| Lot | Courses | Voiture-minutes |
|---|---|---|
| `robots` : 5 voitures, doigt posé, graines 0 à 23 | 24 | 251 |
| `solo` : Galahad seul (`robots: false`), graines 0 à 8 | 9 | 18 |
| `lifted` : 5 voitures, Galahad avec `liftedPattern(seed, 0.3)`, graines 0 à 3 | 4 | 48 |

Le lot `lifted` lève le doigt dès la première seconde de la graine 0, ce qui couvre aussi le cas « départ sans doigt ».

## 3. Épisodes détectés (simulation)

### 3.1 Totaux

| Critère | robots (24) | solo (9) | lifted (4) |
|---|---|---|---|
| A strict (3°, ≥ 3 Hz, 4 demi-oscillations) | **0** | 0 | 0 |
| A large (1°, ≥ 3 Hz) | 34 (0,14 par voiture-minute) | 3 (0,17 par voiture-minute) | 6 (0,13 par voiture-minute) |
| A lent (3°, ≥ 1,5 Hz) | 5 | 0 | 1 |
| B hauteur sur le plat (4 cm) | 0 | 0 | 0 |
| C strict (≥ 2 px, ≥ 6 inversions) | **1** | 0 | 0 |
| C large (≥ 1 px, ≥ 4 inversions) | 206 (0,82 par voiture-minute) | 15 (0,83 par voiture-minute) | 42 (0,88 par voiture-minute) |
| D bavardage de contacts | 111 (13 visibles, 11 impliquant Galahad) | 0 | 30 (25 visibles, 16 impliquant Galahad) |
| D' masques (≥ 3 bascules en 1 s) | 0 (1 004 bascules de `ghost` au total, toutes espacées) | 0 | 0 |
| Roues (saut de plus de 5 cm par pas) | 0 (écart maximal au repos 6,8 cm, saut maximal 4,2 cm par pas) | — | — |

### 3.2 Détail par graine (robots)

C1 désigne les épisodes du critère C large (≥ 1 px), D ceux du critère D.

| Graine | C1 | C1 avec contact voiture | C1 Galahad | D | D visibles | D avec Galahad |
|---|---|---|---|---|---|---|
| 0 | 18 | 6 | 4 | 4 | 2 | 2 |
| 1 | 8 | 5 | 4 | 4 | 2 | 2 |
| 2 | 12 | 4 | 2 | 6 | 0 | 0 |
| 3 | 12 | 6 | 2 | 14 | 2 | 2 |
| 4 | 7 | 3 | 0 | 3 | 0 | 0 |
| 5 | 7 | 3 | 2 | 9 | 0 | 0 |
| 6 | 6 | 1 | 1 | 3 | 3 | 2 |
| 7 | 12 | 5 | 1 | 15 | 0 | 0 |
| 8 | 3 | 1 | 1 | 0 | 0 | 0 |
| 9 | 9 | 3 | 1 | 4 | 0 | 0 |
| 10 | 17 | 7 | 3 | 6 | 4 | 3 |
| 11 | 10 | 5 | 2 | 4 | 0 | 0 |
| 12 | 8 | 4 | 2 | 3 | 0 | 0 |
| 13 | 6 | 1 | 0 | 2 | 0 | 0 |
| 14 | 6 | 2 | 2 | 5 | 0 | 0 |
| 15 | 4 | 1 | 1 | 2 | 0 | 0 |
| 16 | 10 | 1 | 0 | 0 | 0 | 0 |
| 17 | 13 | 5 | 0 | 6 | 0 | 0 |
| 18 | 5 | 3 | 1 | 2 | 0 | 0 |
| 19 | 4 | 2 | 1 | 6 | 0 | 0 |
| 20 | 11 | 3 | 3 | 2 | 0 | 0 |
| 21 | 7 | 3 | 1 | 4 | 0 | 0 |
| 22 | 7 | 3 | 1 | 3 | 0 | 0 |
| 23 | 4 | 1 | 0 | 4 | 0 | 0 |

### 3.3 Par voiture et par contexte (robots)

| Voiture | C1 | D |
|---|---|---|
| Galahad | 35 | 5 |
| Timothée | 34 | 20 |
| Malo | 29 | 21 |
| Liam | 28 | 27 |
| Matthis | 31 | 16 |
| Diego | 32 | 13 |
| Pablo | 17 | 9 |

| Contexte (tranche, ou position dans le volcan) | C1 | D |
|---|---|---|
| Bosses | 47 | 48 |
| Rampe-saut | 35 | 21 |
| Double-bosse | 31 | 15 |
| Plat | 28 | 12 |
| Volcan, plat de réception (xReception…) | 29 | 14 |
| Volcan, fin du plat de lancement et plat d'élan (xElanStart…), turbo ou V_MAX, fantôme | 27 | 0 |
| Volcan, pied de rampe | 8 | 0 |

### 3.4 Ce que sont ces épisodes [MESURÉ, traces pas à pas]

- **A large et C large hors contact** : le châssis se balance doucement à V_MAX ou en turbo sur le plat (±0,7 à 3°, 2 à 4 Hz), parce que les roues polygonales (48 côtés) sautillent et qu'une roue décolle parfois. On voit aussi les transitoires de décollage et d'atterrissage aux rampes. Ce phénomène existe aussi pour Galahad seul, au même taux, et reste sous le seuil visible.
- **D, bavardage de contacts** : un copain retombe d'un saut (rampe-saut, bosses) sur le toit ou le capot d'un autre, roule dessus 1 à 3 s, nez levé de 20 à 45°, puis en descend. Le contact s'allume et s'éteint à chaque petit rebond, mais l'angle et la hauteur évoluent lentement (au plus 7 inversions de la vitesse angulaire par épisode). En graines 0, 3, 6 et 10, Galahad est concerné et à l'écran. Exemples :
  - graine 0, t = 20,9 s : Timothée atterrit sur Galahad ;
  - graine 10, t = 79,6 s : Galahad sort de la zone fantôme encore en l'air et atterrit sur Pablo, puis se cabre à 30° ;
  - graine 10, t = 123,2 s : Pablo grimpe sur Malo, puis Galahad décolle à 5,8 m.

  Ce sont des chocs et des « voitures qui grimpent », qu'on voit bien. Mais ils ne correspondent pas à une vibration. Le toit d'une autre voiture compte comme sol (`wheelsOnGround`), et l'air-level est alors coupé pendant que la roue touche le toit : c'est le constat déjà reporté, qu'on observe ici sans effet de vibration.
- **C strict, le seul épisode** : graine 19, Galahad, t = 73,2 s, 0,18 s, 2,2 px. Liam, en turbo et en l'air, atterrit sur l'arrière de Galahad, qui se cabre de 0 à 23° en 0,15 s. C'est un choc isolé.
- **Superpositions** (deux châssis l'un sur l'autre) : 44 épisodes, presque tous entre copains et hors écran. Le cas extrême est 22 s en graine 13, dont 13,6 s en fantôme retenu hors zone, ce qui confirme le constat du registre. Les écarts relatifs varient lentement (dx de 0,6 à 1,2 m, au plus 5 inversions en 22 s). Un seul cas est visible : graine 10, Galahad et Pablo sautent ensemble le volcan, superposés 0,98 s, à 1,1 à 3,5° l'un de l'autre. Ce n'est pas un tremblement.
- **Départ sans doigt** (lifted, graine 0, de 0 à 9 s) : les copains poussent Galahad et grimpent sur lui. Timothée reste à 39° sur l'arrière de Galahad, Diego monte sur Timothée et finit à 114°. Le contact bascule toutes les 1 à 3 pas, mais l'angle de Galahad reste à ±1° et sa hauteur à 0,67–0,70 m. L'amas est visible, mais il ne tremble pas au sens défini. Sur les 4 courses avec doigt levé, on compte 30 épisodes D, dont 25 visibles et 16 avec Galahad : le doigt levé ramène les copains sur lui. Ils restent lents (au plus 6 inversions par épisode), et le critère C strict n'en relève aucun.
- **Masques et roues** : aucune bascule rapide de `ghost` ou d'`invulnerable`, aucune roue qui saute.

## 4. Comparaison sans copains

**[MESURÉ]** Avec Galahad seul (`robots: false`, 9 graines), on trouve 0 épisode A strict, 0 épisode C strict et 15 épisodes C large, soit 0,83 par voiture-minute, contre 0,82 à 5 voitures. Le taux de A large est de 0,17 par voiture-minute seul, contre 0,14 à 5 voitures. Pour Galahad lui-même à 5 voitures, il y a 35 épisodes C1 sur 24 courses. Les copains n'ajoutent donc aucune vibration. Ils ajoutent des chocs et des « grimpettes » (critère D : 0 seul, 111 à 5 voitures), qui sont des mouvements lents.

**[MESURÉ]** Côté rendu, le tremblement existe **aussi sans copains**. En rejouant les trajectoires de Galahad seul, on obtient 36 épisodes sur 6 courses à 60,05 Hz, et 0 si on interpole (§6).

## 5. Analyse du rendu

Constats dans le code **[lus dans 0a78392]** :

1. `Game.frame` : `advanceAccumulator` donne 0 à 4 pas par image. `present()` dessine ensuite `sceneOf(sim)`, c'est-à-dire l'**état du dernier pas, sans interpolation**. Le reste `acc` n'est jamais utilisé pour le dessin.
2. `Camera.update(c.x + v × 0,6, …, elapsed)` lisse avec le **temps réel** de l'image (`elapsed`), pas avec le nombre de pas. Sur une image à 0 pas, la caméra avance et la voiture ne bouge pas. Sur une image à 2 pas, la voiture avance de 2 pas. Par rapport au décor, qui défile avec la caméra, la voiture recule puis bondit de ±1 pas, soit 13 px à 14 m/s et 20 px en turbo.
3. Les roues sont dessinées avec leur angle propre (`-w.angle`) et 5 rayons, donc une période de 72°. À 14 m/s, la roue tourne de 29,7° par pas. En turbo (21 m/s), elle tourne de 44,6° par pas, ce qui apparaît comme −27° : les roues semblent tourner à l'envers. Une image à 2 pas donne un saut apparent de +17°. C'est un effet stroboscopique secondaire, pas un tremblement du châssis.
4. L'ordre de dessin est fixe (`reverse()`, Galahad au-dessus). Il n'y a pas de clignotement d'ordre.

**[MESURÉ]** Cadences synthétiques, vitesse constante de 14 m/s, 20 courses de 150 s par modèle, phase de démarrage aléatoire :

| Modèle d'écran | Courses avec épisode | Épisodes par course | Images à-coup (> 3 px) |
|---|---|---|---|
| 60,000 Hz, gigue 0,1 ms | 1/20 | 0,1 (mais 4,8 % d'images à-coup : quand la phase tombe sur le bord, tremblement permanent) | 4,8 % |
| 60,000 Hz, gigue 0,5 ms | 3/20 | 3,0 | 5,3 % |
| 59,94 Hz, gigue 0,1 ms | **20/20** | **8,9** (un toutes les ~17 s) | 1,1 % |
| 60,05 Hz, gigue 0,2 ms | **20/20** | **7,5** (un toutes les ~20 s) | 2,0 % |
| 60,05 Hz, gigue 0,5 ms | 20/20 | 7,5 | 4,7 % |
| 90 Hz | 20/20 | permanent | 65 % |
| 120 Hz | 20/20 | permanent | 95 % |

Avec interpolation, l'écart maximal tombe à 0,0–0,6 px dans tous les modèles.

**Playwright [MESURÉ, non représentatif]** : on a joué la graine 10, doigt posé, en Chromium headless (1280×800, DPR 2), avec un échantillonnage par image via `requestAnimationFrame`. On obtient 551 images en 25,9 s (≈ 21 i/s), avec 0, 1, 2, 3 et 4 pas par image dans 1 %, 13 %, 41 %, 23 % et 23 % des cas, et des à-coups de plus de 5 px sur 43 % des images. Le conteneur était saturé par les tests d'un autre agent. Cela confirme seulement que la voiture saute dès que le nombre de pas par image varie. Cela ne dit rien de la tablette, où les fps sont bons.

## 6. Hypothèse et preuve

**Hypothèse unique** : le tremblement vient de l'affichage. L'état physique est dessiné sans interpolation entre deux pas fixes, alors que la caméra avance au temps réel. La phase de l'accumulateur dérive lentement par rapport au vsync, puisqu'aucun écran ne tourne à 60,000 Hz pile. Quand elle passe près de la frontière d'un pas, la gigue des horodatages de `requestAnimationFrame` produit une rafale d'images à 0 et 2 pas. Toutes les voitures à l'écran, et d'abord celle de Galahad que la caméra suit, font alors des allers-retours de ±13 px (±20 px en turbo) pendant quelques dixièmes de seconde. Les fps restent bons, puisqu'une image est dessinée à chaque vsync. Les copains ne sont pas la cause.

**Expérience minimale** (sonde `zz-probe-glitch-replay`, sans toucher `src/`) : on rejoue les **vraies trajectoires pas à pas** de Galahad, issues des courses enregistrées, à travers `advanceAccumulator` et `Camera` réels, avec trois variantes :

- « physique » : exactement 1 pas par image, ce que la simulation fournit ;
- « actuel » : cadence réaliste, sans interpolation, comme `Game.frame` ;
- « interpolé » : même cadence, état dessiné = lerp(pas précédent, pas courant, acc/dt).

Seul le facteur suspecté, l'interpolation, change entre « actuel » et « interpolé ».

| Lot (courses) | Écran | Physique | **Actuel** | Interpolé |
|---|---|---|---|---|
| robots (12) | 60,05 Hz, gigue 0,2 ms | 1 | **75** | 1 |
| robots (12) | 59,94 Hz, gigue 0,1 ms | 1 | **89** | 1 |
| robots (12) | 60,000 Hz, gigue 0,2 ms | 0 | 2 (4,7 % d'images à-coup) | 0 |
| robots (12) | 120 Hz | 0 | 13 (98 % d'images à-coup) | 0 |
| solo (6) | 60,05 Hz, gigue 0,2 ms | 0 | **36** | 0 |
| solo (6) | 59,94 Hz, gigue 0,1 ms | 0 | **42** | 0 |
| lifted (4) | 60,05 Hz, gigue 0,2 ms | 2 | **29** | 2 |

La valeur est le nombre d'épisodes de tremblement (≥ 3 à-coups de plus de 4 px en 0,5 s). Pour robots, l'unique épisode et, pour lifted, les 2 épisodes sont les mêmes en « physique » et en « interpolé » : ils viennent de la trajectoire, autour d'une réapparition, et pas de la cadence.

L'épisode disparaît quand on coupe le facteur suspecté, qu'il y ait des copains ou non. La physique seule, à 1 pas par image, n'en produit pas. **[MESURÉ]**

**Fréquence attendue [SUPPOSÉ, selon l'écran]** :

- sur un écran à 60 Hz légèrement décalé (±0,05 à 0,1 %, ce qui est courant), environ 6 à 9 épisodes de 0,2 à 0,5 s par course de 150 s, soit un toutes les 15 à 20 s ;
- à 60,000 Hz exact, soit jamais, soit en permanence, selon la phase tirée au démarrage ;
- sur une tablette à 90 ou 120 Hz, une saccade permanente plutôt qu'un « moment ».

Le papa n'a remarqué « qu'un moment ». C'est compatible avec des épisodes courts qu'on ne voit vraiment que lorsque l'œil suit une voiture rapide, par exemple pendant un saut où plusieurs voitures bougent ensemble. Ce point n'est pas vérifié.

## 7. Pistes de correctif (pour information, non implémentées)

1. **Interpoler le rendu** (le correctif classique du pas fixe) : garder l'état de chaque pièce au pas précédent (position et angle du châssis et des roues), puis dans `present()` dessiner lerp(précédent, courant, `acc / PHYSICS_DT`), avec un lerp d'angle sur l'angle normalisé. La caméra vise alors la position interpolée de Galahad. Il faut passer en mode « pas d'interpolation » lors d'une téléportation (respawn ou `rebuildCars`). Coût : un pas de latence, soit 16 ms.
2. **Variante minimale** : lisser la caméra au nombre de pas consommés (`steps × PHYSICS_DT`) plutôt qu'au temps réel. Le décor saute alors avec la voiture, sans écart relatif. Le mouvement reste saccadé (image figée puis double), mais la voiture ne « tremble » plus par rapport au sol. C'est moins bien que la piste 1 sur un écran à 90 ou 120 Hz.
3. **Hystérésis de l'accumulateur** : ajouter une tolérance de ±1 à 2 ms autour de la frontière d'un pas (par exemple accepter 1 pas si `acc` est à moins de 2 ms de dt). Les rafales 0/2 dues à la gigue sont absorbées sur un écran à 60 Hz. Cela ne règle pas les écrans à 90 ou 120 Hz.

À part, hors tremblement : l'effet stroboscopique des roues en turbo (5 rayons, 44,6° par pas). On pourrait flouter les rayons ou en mettre plus.

## 8. Ce qui reste incertain

- **La tablette n'a pas été mesurée.** On ignore sa fréquence de rafraîchissement et la gigue réelle de ses horodatages `requestAnimationFrame`. Si elle tourne à 90 ou 120 Hz, la saccade serait permanente, et le papa aurait sans doute dit « tout le temps ». Pour trancher sans corriger :
  - lui demander le modèle de tablette ;
  - ou ajouter en `?debug=1` un compteur des images à 0 et 2 pas affiché dans le HUD, et regarder s'il bouge au moment du glitch. C'est une petite modification de `src/`, à faire en phase 2 seulement si on la valide.
- **Pourquoi seulement maintenant ?** Le mécanisme existait déjà au plan A, avec Galahad seul. Le papa ne l'avait pas signalé. On peut supposer qu'il a été plus attentif au test à 5 voitures, ou que plus de voitures en mouvement à l'écran le rendent plus visible. Ce n'est pas vérifié.
- **Images perdues sous la charge** : le coût d'un `stepRace` n'a pas pu être mesuré proprement, car le conteneur était saturé (médianes de 3 à 6 ms, aussi bien seul qu'à 5 voitures, ce qui reflète le bruit). Une image perdue donne un seul à-coup de 13 px, pas une rafale. Les « fps bons » rendent ce cas moins probable, sans l'exclure.
- **Chocs et grimpettes entre voitures** (§3.4) : ils sont réels, visibles et fréquents, avec 4 graines sur 24 où Galahad est concerné à l'écran, sans compter le départ sans doigt. Si « tremble » voulait dire « se cabre, sautille sur une autre voiture », c'est cette famille qu'il faudrait viser. Elle est liée au toit compté comme sol, à l'absence d'évitement par les robots et à la sortie de zone fantôme encore en l'air. Mais ces mouvements mesurés sont lents, ≤ 2 à 3 Hz, et ne ressemblent pas à un tremblement.
- **Couverture** : 24 courses doigt posé, 4 courses doigt levé et 9 courses seul. La fin de course après le calque d'arrivée (voitures qui s'entassent avant le mur, sous un voile à 65 %) n'a pas été enregistrée au-delà de 1,5 s après l'arrivée de Galahad.
- Les seuils (3°, 2 px, 3 Hz) sont des choix argumentés, pas des mesures de perception. Le critère C large (1 px) montre que le résultat ne dépend pas d'un seuil serré.
