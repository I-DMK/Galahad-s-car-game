# Course Lunaire de Galahad — addendum « bouton saut et étoiles pour tous »

Date : 2026-10-21
Statut : **VALIDÉ par le papa** le 2026-10-21 (design approuvé section par section, puis document relu et approuvé).
Amendé [plan] le 2026-10-22 (tâche 5e, Step 1) avec les décisions du papa sur le plan 5e/6 (registre 567ee13) : Q-P1 (b) étoiles hautes **en plus** des étoiles du curseur ; Q-P2 mémoire de la demande de saut de 0,1 s ; Q-P3 **même hauteur partout**. Les passages amendés sont marqués « [plan] » ; le plan `docs/superpowers/plans/2026-10-21-plan-b-saut-et-rendu.md` (tâche 5e) en donne le détail.
Amendé [fosses] le 2026-10-22 avec les décisions du papa au Step 9 de la tâche 5e (registre e02dcae) : `STAR_HIGH_Y` = 3,90 m ; au moins 3 étoiles hautes par course, sur des **plats étoile** posés par le générateur ; **fosses de lave** sans tremplin, environ 1 volcan sur 2 ; promesse changée. Les passages amendés sont marqués « [fosses] » ; le détail et les mesures sont au §6.
v1.5 (tour de correction 1, 2026-10-22) : réponses du papa aux questions Q-F1 à Q-F5 (registre 10282e7) et **tolérance de sol pour le saut** (0718977), constats des relectures standard et adversariale.
v1.6 (tour de correction 2, 2026-10-22) : Q-F6 tranché (c73faf5, tolérance gardée à 0,35 s) ; mesure des fenêtres en test (§6.2) ; super saut après une bosse (§6.10). **À relire, puis à faire valider par le papa avant tout code.**
Amende : le spec du 2026-10-20 et l'addendum plan B (`2026-10-21-plan-b-addendum.md`, §1.4 à §1.8 pour les fosses, §2 et §3.3). En cas de contradiction, ce document l'emporte sur les deux.

## 0. Origine et intention

Retour du test tablette à 5 voitures (version 0a78392) : « le premier qui prend une étoile, et donc la première place, est irrattrapable ». Le mécanisme est mesuré : toutes les voitures ont le même plafond de vitesse, et une étoile prise disparaît pour toutes. Le premier enchaîne donc les turbos (boule de neige).

Décisions du papa :
- **étoiles pour tous** ;
- **élastique gardé** (tâche 7) ;
- **bouton saut avancé du plan C**, voulu par Galahad : un saut mal placé fait mal retomber (mauvais versant de bosse, lave), et certaines étoiles sont en hauteur, il faut un bon saut pour les avoir. Le premier peut ainsi rater sa course malgré les étoiles.

Ce qui définit le succès :
- Galahad comprend le bouton seul.
- Un saut mal placé se voit et coûte quelque chose.
- [fosses] **Promesse changée** (décision du papa, 2026-10-22 ; remplace « doigt posé sans jamais sauter, on finit toujours la course et on ne tombe jamais dans la lave ») :
  - doigt posé sans jamais sauter, **on finit toujours la course** ;
  - **volcans à tremplin** : on ne tombe jamais dans leur lave (promesse de la tâche 5c, conservée pour eux) ;
  - **fosses de lave** : sans sauter, on tombe. Respawn au point sûr d'avant la fosse ; à la 2e chute de suite dans la même fosse, la voiture est posée de l'autre côté (§6.4) ;
  - **à doigt posé**, un saut bien placé passe toujours une fosse, y compris depuis un départ arrêté au point sûr (fenêtre d'au moins 0,4 s, §6.2). Sous ≈ 6 m/s, aucun saut ne passe : doigt levé ≈ 2,5 s avant la fosse, la fosse est infranchissable (§6.1).
- Une course n'est plus jouée d'avance par la première étoile.
- [fosses] Au moins 3 étoiles hautes par course, chacune sur son plat étoile (§6.6).

Hors périmètre (reste au plan C) : obstacles sur la piste, météorites, saut dosé.

## 1. Bouton et saut (décisions : bouton en bas à gauche, force fixe, impulsion physique)

- **Bouton** : rond, diamètre ≥ 140 px CSS, en bas à gauche, icône de ressort. Il porte `data-no-pedal` : son `pointerdown` n'est jamais compté comme du gaz. Le gaz reste « un doigt n'importe où ailleurs » ; les deux fonctionnent en même temps (multi-touch). Sur ordinateur, la barre d'espace fait la même chose (développement et e2e).
- **Déclenchement sur front** : chaque appui (`pointerdown` sur le bouton, ou `keydown` Espace non répété) dépose une demande de saut, prise au pas de physique suivant. Garder le doigt sur le bouton ne relance pas de saut.
- **Mémoire de la demande** [plan] (décision Q-P2) : une demande qui ne peut pas être servie tout de suite (voiture en l'air, délai pas écoulé) **reste valable `JUMP_BUFFER` = 0,1 s**. Un appui un peu trop tôt, juste avant de retoucher le sol, donne donc un saut au premier pas au sol ; au-delà de 0,1 s, la demande est oubliée.
- **Conditions** :
  - [fosses] **tolérance de sol** (décision du papa, 0718977 ; remplace « au moins une roue au contact du sol (contact de jeu débouncé) ») : au moins une roue a touché **la piste** (sol, mur ou écart roue-sol, contact débouncé) dans les **`JUMP_GROUND_GRACE` = 0,35 s** précédentes ; [relectures 5e] **seule la piste compte** (décision du papa, a105e2b) : le toit d'un copain ne permet pas de sauter. Effet accepté par le papa : un saut reste possible juste après un décollage de bosse, de rampe ou de rebond, toujours avec la même hauteur (+ 2,5 m au-dessus du vol sans saut). La mémoire de 0,1 s est gardée. Pas de double saut : le contact du décollage (débouncé 0,1 s) plus la tolérance (0,35 s) finissent 0,05 s avant `JUMP_COOLDOWN` (0,5 s), et un toit ne compte pas ; un nouveau saut demande donc un nouveau contact avec la piste. Motif mesuré au §6.2 : sans elle, un appui fait au milieu de la fenêtre d'une fosse peut tomber pendant un rebond et être perdu ;
  - au moins `JUMP_COOLDOWN` (0,5 s) depuis le dernier saut de cette voiture ;
  - course en cours (ni décompte, ni pause, ni après l'arrivée).

  Sinon, la demande attend au plus `JUMP_BUFFER`, puis elle est ignorée [plan]. Le bouton est grisé pendant le délai et tant que Galahad est en l'air ; [fosses] en l'air, à partir de `JUMP_GROUND_GRACE` après le dernier contact avec la piste (sur le toit d'un copain aussi).
- **Physique (approche A)** : une vitesse verticale (m/s, vers le haut du monde) est posée sur toutes les pièces de la voiture : châssis et roues. Sa valeur se calcule à partir de la gravité du jeu pour un apogée du châssis d'environ 2,5 m (`JUMP_APEX`) au-dessus de sa hauteur de roulage à l'arrêt, vérifiée à ± 10 % en test. Lancée, la voiture garde sa vitesse horizontale, donc le bond porte plus loin. Le vol, le contrôle d'assiette en l'air, l'atterrissage, les retournements, la lave et les respawns sont ceux d'aujourd'hui : **la physique décide** du prix d'un saut raté.
- **Même hauteur partout** [plan] (décision Q-P3, remplace « s'ajoute ») : avec vy0 la vitesse verticale du châssis vers le haut au moment du saut et g la gravité du jeu,
  - si vy0 > 0 (voiture qui monte, par exemple sur une rampe) : vy = √(vy0² + 2·g·`JUMP_APEX`). L'apogée monte de `JUMP_APEX` au-dessus du vol que la voiture aurait eu sans saut, quelle que soit la pente ;
  - sinon (plat, ou voiture qui descend) : vy = `JUMP_VY` = √(2·g·`JUMP_APEX`) ≈ 4,95 m/s, apogée ≈ `JUMP_APEX` au-dessus du point de départ.

  La vitesse horizontale de chaque pièce ne change pas. « S'ajoute » (vy0 + `JUMP_VY`) aurait donné ≈ 12 m d'apogée au milieu d'un tremplin. À dire au papa : au milieu d'une rampe-saut, le gain **ressenti** n'est que d'environ 1,5 m (2,5 − Δy·cos²θ, Δy étant la montée de rampe qui restait), parce que la voiture sans saut aurait de toute façon décollé du tremplin.
- **Un seul chemin** : Galahad et les copains sautent par la même fonction (`applyJump(car, cfg)` dans `physics/car.ts`, sans déplacement de corps dans un callback de collision). `stepRace(sim, galahadThrottle, galahadJump)` reçoit la demande de Galahad ; le `Driver` des robots renvoie `{ throttle, jump }` (tâche 6). L'événement `'jump'` (`carId`) sert à la poussière et, plus tard, au son.
- Nouveaux paramètres dans `config.ts` : `JUMP_VY`, `JUMP_COOLDOWN`, `JUMP_BUTTON_SIZE_PX` (nombres) ; [plan] `GRAVITY` (constante locale réutilisée), `JUMP_APEX` (2,5 m, `JUMP_VY` en est dérivée) et `JUMP_BUFFER` (0,1 s) ; [fosses] `JUMP_GROUND_GRACE` (0,35 s).

## 2. Étoiles pour tous et étoiles en hauteur

- **Étoiles pour tous** : l'état d'une étoile est tenu **par voiture**. Une voiture qui prend une étoile la rend inactive pour elle seule, jusqu'à `STAR_RESPAWN_SECONDS`, et active son turbo. Pour les autres, l'étoile reste prenable. Les capteurs restent actifs ; la décision « prise ou non » se fait voiture par voiture dans `collectStars`. **À l'écran, on dessine l'état vu par Galahad** : une étoile prise par un copain reste visible.
- **Étoiles hautes** [plan] (décision Q-P1 (b), remplace « environ 1 étoile du curseur sur 3 est surélevée ») :
  - Elles sont **ajoutées** aux étoiles du curseur, qui ne changent pas. À la génération (`placeStars`, rng de la piste, déterministe pour ENCORE), leurs tirages viennent **après** tous les autres ; avec `STAR_HIGH_PER_RACE` = 0, les étoiles sont celles d'avant, au bit près.
  - Nombre : **au plus `STAR_HIGH_PER_RACE`** par course, réaliste **≈ 1 par course**, et certaines pistes n'en ont aucune. Les plats ne mesurent que 20 à 40 m, et un saut vole ≈ 28 m à 14 m/s. Le nombre est mesuré, puis validé par le papa sur le tableau de calibration.
    [fosses] Remplacé par la décision du 2026-10-22 : **au moins 3 par course**, une sur chacun des 3 **plats étoile** que le générateur pose (§6.6). `STAR_HIGH_PER_RACE` devient le plafond total (3 : exactement 3, Q-F4) ; les étoiles des plats étoile passent toujours en premier.
  - [fosses] Hauteur : **`STAR_HIGH_Y` = 3,90 m** (choix du papa sur le tableau du Step 9 ; fenêtre réelle mesurée 0,57 / 0,60 s à 11,2 / 14 m/s sur un plat étoile, 0,47 / 0,48 s à +5 cm).
  - Emplacement : **seulement sur les plats éligibles**, jamais au-dessus d'une bosse (remplace « sur les plats et au-dessus du sommet d'une bosse »). [fosses] Les plats étoile ont leurs propres règles (§6.6) ; les règles ci-dessous ne valent plus que pour les étoiles hautes ajoutées sur des plats ordinaires, si le plafond le permet.
    - Les tranches `plat`, hors plat de départ et plat d'arrivée, **voisines fusionnées** en un seul segment.
    - Moins un dégagement après une rampe-saut (`STAR_HIGH_RAMP_CLEARANCE`) et après des bosses, une double-bosse ou un cratère (`STAR_HIGH_BUMP_CLEARANCE`) : une voiture qui vole doigt posé ne doit jamais la prendre.
    - À au moins `STAR_HIGH_GAP` de toute étoile basse.
    - L'élan (`STAR_HIGH_TAKEOFF_ROOM` avant l'étoile) et l'atterrissage (`STAR_HIGH_LANDING_ROOM` après) se font sur du **terrain permis**, qui peut déborder du plat : ni rampe-saut, ni rampe-volcan, ni dégagement ; [fosses] ni tranche `fosse`. Un plat étoile est du terrain permis.
    - Une candidate par segment (au centre de l'intervalle admissible) ; s'il y en a plus que `STAR_HIGH_PER_RACE`, le rng de la piste en tire `STAR_HIGH_PER_RACE`.
  - Hauteur `STAR_HIGH_Y` au-dessus du sol local, la même partout, réglée pour deux conditions, toutes deux mesurées en test : une voiture au sol, à `V_MAX` comme en turbo, ne la touche jamais ; un saut déclenché dans une **fenêtre d'au moins 0,3 s** (visée ≈ 0,4 s) l'attrape, sans respawn à l'atterrissage. [plan] La fenêtre est exigée à la fois à `V_CRUISE` (11,2 m/s) et à `V_MAX` (14 m/s), et encore à `STAR_HIGH_Y` + 5 cm (elle est très sensible à la hauteur).
- **Jamais en hauteur** : les étoiles d'élan et toute étoile du plat de lancement d'un volcan. Une étoile haute juste avant un volcan inviterait à sauter au pire moment. Le saut devant un volcan reste un piège, pas une récompense. [plan] Les plats de lancement et de réception ne sont pas des tranches `plat` : ils sont exclus d'office. [fosses] Aucune étoile haute dans une tranche `fosse` (garde, approche, fosse, réception), ni au-dessus de la lave (§6.5).
- **Inchangés** [plan] : les étoiles basses (celles du curseur et d'élan) gardent leur nombre (≈ 9 par course, test 6 à 14), leur position et leur hauteur ; plancher de 6, zones interdites, turbo de 3 s. Le nombre total d'étoiles d'une course est celui des étoiles basses plus celui des étoiles hautes. [fosses] Les pistes changent, donc les positions aussi : plats étoile hors des zones du curseur, étoile de réception des fosses, pas du curseur ajusté sur mesure (§6.5). Le nombre visé (8 à 12), le test 6 à 14, la hauteur et le plancher ne changent pas.

## 3. Copains

- **Deux traits de plus par pilote** (`src/cars/pilots.ts`), à valider par le papa comme les couleurs :
  - `jumpTry` ∈ [0 ; 1] : probabilité de tenter une étoile haute disponible pour lui ;
  - `jumpSkill` : écart-type de l'erreur sur l'instant du saut, de quelques centièmes à ≈ 0,2 s.

  Fonceurs (Pablo, Matthis) : tentent souvent (≈ 0,8), visent moins bien. Moyens (Diego, Malo) : entre les deux. Prudents (Timothé, Liam) : tentent rarement (≈ 0,3), visent juste.
- **Décision** :
  1. À l'approche d'une étoile haute encore disponible pour lui, le copain tire une fois, par la graine de pilotes, s'il tente.
  2. S'il tente, il calcule l'instant idéal d'après sa vitesse, y ajoute son erreur tirée, et saute.
  3. Il peut rater l'étoile, mal retomber, voire se retourner.
- **Jamais de saut pour un copain** dans `[xLancement, xReception]` d'un volcan. [fosses] Lire « d'un volcan **à tremplin** ». Devant une fosse, le copain saute toujours, une fois par tentative (§6.8).
- Le saut s'intègre à la tâche 6 (conduite des robots), avec les « robots polis ». L'élastique (tâche 7) est inchangé.

## 4. Tests d'acceptation

- **Saut (unitaires et simulation)** :
  - au sol seulement ; [fosses] lire : au sol, ou en l'air depuis au plus `JUMP_GROUND_GRACE` (0,35 s) après le dernier contact de jeu ; au-delà, aucun saut ;
  - [fosses] aucun appui perdu dans la fenêtre d'une fosse : 0 sur 24 lancers à 11,2 et à 14 m/s, et avec un turbo pris à 14 m/s (calcul sur la suite « au sol / en l'air » d'une course sans saut) ; à 21 m/s tenus, part imprimée, au plus 0,5 % (accepté par le papa, Q-F6) (§6.2) ;
  - [fosses] sauts dans la tolérance au sommet des tremplins et des rampes-saut : remesurés (§6.2, « Tolérance de sol ») ;
  - délai respecté ;
  - un saut par appui ;
  - apogée 2,5 m ± 10 % à l'arrêt ;
  - [plan] apogée sur une pente (milieu d'une rampe-saut à 14 m/s) : 2,5 m ± 10 % au-dessus du vol sans saut (max(y) − y0 − vy0²/(2g)), très en dessous de « s'ajoute » ; en descente (vy0 < 0) : 2,5 m ± 10 % au-dessus du point de départ ; vitesse horizontale gardée ;
  - [plan] mémoire de 0,1 s : une demande 0,05 s avant le contact donne un saut au premier pas au sol, une demande 0,15 s avant n'en donne aucun ;
  - aucune trace de gaz par le bouton ;
  - déterminisme.
- **e2e** : tap sur le bouton → événement `'jump'`, sans gaz ; doigt de gaz + tap simultanés → la voiture avance et saute.
- **Étoiles hautes** :
  - doigt posé sans saut, turbo compris : 0 étoile haute prise ; [fosses] pour toute voiture, Galahad compris (R-F12 amendé, décision du papa au tour 2 de la 5g), une prise sans saut n'est tolérée que dans les 2 s qui suivent un choc entre voitures (voiture « catapultée », mesuré à la 5e : 4 courses sur 24 ; au tour 2 de la 5g, graine 5 : Galahad retombé d'une bosse sur le toit de Liam, catapulté sur l'étoile 1,15 s après), comptée et imprimée ; une prise sans saut et sans choc est un échec ;
  - pour chaque étoile haute (graines 0 à 9), il existe une fenêtre d'au moins 0,3 s de décollage qui la prend sans respawn ; [fosses] sur un plat étoile : au moins **0,4 s** à 11,2 et à 14 m/s, et au moins 0,3 s à `STAR_HIGH_Y` + 5 cm ;
  - aucune sur un plat de lancement ; [fosses] aucune dans une tranche `fosse` ;
  - [plan] nombre, remplace « environ 1 sur 3 » : 0 ≤ n ≤ `STAR_HIGH_PER_RACE` par course ; sur les graines 0 à 49, moyenne et nombre minimal de pistes avec au moins une étoile haute, seuils fixés à partir de la distribution mesurée et validés par le papa (cible réaliste ≈ 1 par course) ;
    [fosses] remplacé : **exactement 3 plats étoile et exactement 3 étoiles hautes par piste de 1 680 m** (Q-F4), graines 0 à 49 (et à 6 000 m, graines 0 à 19) ; chaque plat étoile porte la sienne ;
  - [plan] étoiles basses (x, y, nombre) identiques à celles de `STAR_HIGH_PER_RACE` = 0. [fosses] Toujours vrai à pistes égales : les plats étoile font partie du terrain, les tirages des étoiles hautes restent les derniers.
- **Volcans** (à tremplin) :
  - doigt posé sans saut : 0 chute (invariants de la tâche 5c gardés, graines 0 à 23 à 5 voitures) ; [fosses] 0 chute **aux volcans à tremplin** ;
  - un saut mal placé dans l'élan ou sur la rampe peut faire tomber : mesuré, pour vérifier que le risque existe.
- [fosses] **Fosses** (§6.2 à §6.5) :
  - (a) doigt posé sans saut, de 3 à 30 m/s et en turbo, depuis n'importe quelle tranche précédente : la voiture tombe, à 100 % (jamais de survol) ;
  - (b) lancée à 11,2 et à 14 m/s, et en turbo : fenêtre principale d'au moins 0,4 s, **d'un seul tenant (chaque pas vérifié)**, sans respawn dans les 3 s après l'atterrissage ; des morceaux isolés plus tôt (saut trop tôt sauvé par un rebond) sont permis et imprimés. Fenêtres entières en suite lente ; en CI, un bloc de 0,4 s autour de l'instant visé par les copains (§6.2) ;
  - (c) départ arrêté au pire point sûr (`xLancement + 5 − ε`), doigt posé : fenêtre d'au moins 0,4 s ;
  - sous ≈ 6 m/s, presque aucun saut ne passe (à 5 m/s, aucun ; mesuré et imprimé, c'est la limite « à doigt posé » du §6.1) ;
  - (d) turbo (21 m/s) : tout saut qui passe atterrit avant `xEnd − 10` ;
  - course doigt posé sans saut (Galahad seul et à 5 voitures, graines 0 à 23) : exactement 2 chutes par fosse, 0 au tremplin, toutes dans une fosse, arrivée avant 240 s ; au plus 2 chutes par série ;
  - course doigt posé avec un saut au centre de la fenêtre à chaque fosse : 0 chute ;
  - 2e chute de suite à la même fosse : voiture posée de l'autre côté (§6.4) ; une autre raison de respawn remet la série à zéro ;
  - 5 voitures dans la même fosse au même pas : 5 respawns en file, sans chevauchement ni garde-fou de vitesse.
- [fosses] **Plats étoile** (§6.6) : longueur, place de l'étoile, insertion, voisins permis, pas d'étoile basse dessus, terrain d'avant au bit près avec `STAR_FLATS_PER_RACE` = 0 et `FOSSE_PERIOD` = 0.
- **Étoiles pour tous** : une étoile prise par un copain reste prenable par Galahad ; délai de réapparition par voiture.
- **Copains** :
  - aucun saut dans une zone volcan ; [fosses] à tremplin ;
  - les fonceurs ratent plus que les prudents (mesuré) ; [fosses] aux étoiles hautes comme aux fosses ;
  - [fosses] un copain qui rate une fosse suit la règle de Galahad (§6.8) ;
  - déterminisme.
- **Rattrapage** : sur les courses lentes à 5 voitures, part des courses gagnées par la voiture qui a pris la première étoile, avant et après. Baisse nette attendue. Chiffre consigné dans la passation. [fosses] Deux mesures à partir de la fin de la 5e : sur les pistes d'avant (`ANCIENNES_PISTES`, appariée aux mesures de la 5d), et sur les pistes nouvelles (nouvelle référence).

## 5. Ordre dans le plan B

Après la tâche 5c :

| Tâche | Contenu |
|---|---|
| **5d** | Étoiles pour tous (état par voiture, rendu de l'état vu par Galahad) |
| **5e** | Bouton saut et étoiles hautes (Galahad) ; [fosses] fin : plats étoile dans le générateur, 3 étoiles hautes à 3,90 m |
| **5g** | [fosses] Fosses de lave (volcans sans tremplin), 1 volcan sur 2 |
| **6** | Conduite des robots : délai de départ, lever de pied, robots polis, **sauts des copains** et nouveaux traits de pilote ; [fosses] sauts des copains aux fosses |
| **7** | Élastique ; l'objectif mesuré tient compte des sauts |

Les finitions et le décor suivent sans changement. Le plan d'implémentation de ces tâches s'écrit à partir de ce document (skill writing-plans), avec les relectures habituelles.

[fosses] La tâche 5g s'insère entre la 5e et la 6. La tâche 15 (cratère) mesure en plus la portée des vols du cratère avant une fosse et avant un plat étoile (§6.3, §6.6).

## 6. Fosses de lave et plats étoile (décisions du 2026-10-22)

### 6.0 Décisions du papa (registre e02dcae) et conventions

- `STAR_HIGH_Y` = **3,90 m**.
- **Au moins 3 étoiles hautes par course**, sur des **plats étoile** : le générateur pose au moins 3 longs plats dédiés par piste (≈ 50 m, à calibrer : 57 m ici, §6.6), chacun portant une étoile haute. Le reste du terrain change le moins possible.
- **Volcans sans tremplin** : des **fosses de lave** posées sur le plat, à franchir avec le bouton saut. Environ **1 volcan sur 2**.
- **Promesse changée** (§0, §6.1). Les volcans à tremplin gardent « doigt posé, jamais de chute ».
- Toutes les pistes changent, à longueur totale constante. L'empreinte de Galahad seul est recapturée par un ruling (§6.9).

Réponses du papa aux questions de la v1.4 (registre 10282e7 et 0718977) :
- **Q-F1** : fosse de **8 m**, franchissable **à doigt posé** (§6.1).
- **Q-F2** : **option B**, voiture posée juste après la fosse à la 2e chute de suite (§6.4).
- **Q-F3** : les copains ratent parfois : erreur × **2,5** aux fosses, instant visé **centré à chaque vitesse** (§6.8).
- **Q-F4** : **exactement 3** étoiles hautes par course (§6.6).
- **Q-F5** : rien ne s'allume à l'approche d'une fosse pour le premier test (§6.7).
- Nouveau : **tolérance de sol** pour le saut, `JUMP_GROUND_GRACE` = 0,35 s (§1, §6.2).
- **Q-F6** (c73faf5) : tolérance de sol **gardée à 0,35 s**, à rejuger au test tablette (§6.10).

Conventions des chiffres :
- **MESURÉ** : sonde jetable `tests/zz-probe-*` (supprimée), Galahad seul, vrai `stepRace` (contact débouncé, saut, capteurs, respawns), monde rogné, vitesse tenue doigt posé par le facteur de la voiture comme dans `jumpRun`. « MESURÉ (relecture) » : sonde d'une relecture (adversariale de la v1.4, ou re-relecture de la v1.5). Les mesures « avec tolérance » émulent `JUMP_GROUND_GRACE` (saut posé par `applyJump` si le dernier contact de jeu date d'au plus 0,35 s) en attendant son code. Les tâches 5e et 5g refont ces mesures en tests.
- **CALCULÉ** : formule, ou prototype statique du générateur (même `rng`, mêmes profils, sans physique ; vérifié identique à `generateTrack` sans fosse ni plat étoile sur les graines 0 à 49).
- Vocabulaire : un **volcan** est soit un **tremplin** (la `rampe-volcan` d'aujourd'hui), soit une **fosse**. W = `FOSSE_WIDTH`, largeur de lave. s = distance du châssis au bord amont de la fosse au moment du saut.

### 6.1 Promesse (amende §0, l'addendum plan B §1.2 et la tâche 5c)

| Situation, doigt posé | Volcan à tremplin | Fosse |
|---|---|---|
| sans jamais sauter | passe, jamais de chute (promesse 5c inchangée) | tombe, à coup sûr (§6.2 (a)) ; respawn au point sûr d'avant ; 2e chute de suite → posée juste après la fosse (option B) ; on finit la course |
| saut bien placé | (sans objet : le saut n'est pas nécessaire) | **à doigt posé**, passe, sans respawn (§6.2 (b) à (d)) |
| saut mal placé | peut tomber (mesuré en fin de 5e, `saut-volcan-*`) | tombe : trop tard, la roue avant touche la lave ; trop tôt, la voiture retombe dans la fosse |

Ce qui ne change pas : on finit toujours la course ; aucune autre tranche ne fait tomber ; la règle « 2e chute de suite au même volcan » ne compte que les chutes dans la lave (ruling de la tâche 3).

**« À doigt posé » (Q-F1, constat 3 de la relecture adversariale).** Une fosse de 8 m ne se franchit que lancée. Mesures à vitesse tenue, tolérance de sol comprise (MESURÉ) :

| Vitesse | 5 m/s | 5,5 m/s | 6 m/s | 6,5 m/s | 7 m/s | 7,5 m/s | 8 m/s |
|---|---|---|---|---|---|---|---|
| Fenêtre | aucune | 0,08 s | 0,23 s | 0,37 s | 0,48 s | 0,57 s | 0,65 s |

- **Sous ≈ 6 m/s, presque aucun saut ne passe**, et sous ≈ 6,5 m/s la fenêtre est sous les 0,4 s promises.
- Doigt posé, cela n'arrive pas : le pire point sûr laisse 27,35 m d'élan (fenêtre 0,87 s).
- Doigt levé ≈ 2,5 s avant la fosse (frein moteur), ou reparti arrêté à moins de ≈ 6 m du bord, la fosse ne se passe pas (MESURÉ (relecture)). L'enfant tombe alors une fois, repart du point sûr, et passe.

### 6.2 La fosse

**Nouvelle tranche `'fosse'`** (`SliceType`). Profil, de l'amont vers l'aval :

| Partie | Longueur | Rôle |
|---|---|---|
| plat de garde | `FOSSE_GUARD` = 20 m | absorbe le vol d'une bosse ou d'une double-bosse prise en turbo (§6.3) ; points sûrs permis |
| plat d'approche | `LANCEMENT_LENGTH` = 32,35 m, de `xLancement` au bord amont `xBord` | même rôle que le plat de lancement : `D_LANCE` de plat après le pire point sûr |
| fosse | W = `FOSSE_WIDTH`, **8 m recommandé** (Q-F1) | parois verticales d'un pas (indices exemptés), fond à −`CRATER_DEPTH` (1 m), pleine de lave |
| plat de réception | le reste : 64,8 m pour W = 8 (au moins 60 m, garde-fou dans `fosseGeometry`) | atterrissage, y compris en turbo |

- **Longueur totale = celle de la `rampe-volcan` (125,2 m).** Une fosse prend exactement la place d'un tremplin : le reste de la piste ne bouge pas (§6.3). Bords arrondis à la maille de 0,2 m.
- **Rebords au ras du sol.** Ni lèvre, ni bosse, ni pente avant le bord : une voiture qui roule ne décolle jamais du rebord. C'est ce qui rend (a) vrai à toute vitesse. Un rebord surélevé serait un petit tremplin, et une voiture rapide survolerait la fosse sans sauter.
- **Capteur de lave** : celui des volcans (`buildLava`, inchangé), sur [xBord, xBord + W], du plancher jusqu'à `rimY + LAVA_SENSOR_ABOVE_RIM` avec `rimY` = 0, soit **0,3 m au-dessus du sol**. Une roue qui roule (bas de roue au sol, à quelques cm près) le touche dès que son centre est à ≈ 0,4 m du bord : la voiture est reprise avant de basculer.
- **Type** : `Volcano` devient l'union `Tremplin | Fosse` avec `kind: 'tremplin' | 'fosse'`. Champs communs : `xLancement`, `xLava` (centre de la lave), `lavaWidth` (= W), `rimY` (0 pour une fosse), `xReception` (bord aval pour une fosse), `xEnd`. Champs du tremplin seuls : `xElanStart`, `xRampStart`, `xLip`, `lipY`. Champ de la fosse : `xBord` (= `xLava − W/2`). Tout ce qui n'utilise que les champs communs (capteur, points sûrs, série de chutes, fantômes, bulles de lave) vaut sans changement pour les deux ; le compilateur signale chaque usage des champs du tremplin, à restreindre à `kind === 'tremplin'`.

**Pourquoi la fenêtre existe** (CALCULÉ, saut de 2,46 m d'apogée, vol ≈ 2,0 s, roues à ±0,75 m du châssis, rayon 0,45 m) :
- au plus tard : la roue avant doit avoir quitté le sol avant de toucher le coin du capteur, soit s ≥ ≈ 1,2 m + 0,06 s × v ;
- au plus tôt : la roue arrière doit être encore à plus de 0,3 m du sol quand elle passe le bord aval, soit s ≤ ≈ 1,96 s × v − W − 1,2 m ;
- fenêtre ≈ 1,9 s − (W + 2,3 m) / v : **elle s'élargit avec la vitesse** et rétrécit avec W.

**Mesures (MESURÉ, v1.4, sans tolérance de sol)**, fosse de W m sur une piste plate, saut demandé à chaque pas, « passe » = aucune lave et aucun respawn jusqu'à 3 s après l'atterrissage :

| W (m) | lancée 8 m/s | 11,2 m/s | 14 m/s | 21 m/s | départ arrêté au pire point sûr (c) | turbo pris 40 m avant le bord (d) |
|---|---|---|---|---|---|---|
| 3 | 1,28 s | 1,47 s | 1,55 s | 1,75 s * | 1,17 s | 1,50 s * |
| 6 | 0,92 s | 1,22 s | 1,33 s | 1,68 s * | 1,00 s | 1,30 s * |
| **8** | **0,67 s** | **1,02 s** | **1,20 s** | **1,48 s** * | **0,87 s** | **1,18 s** * |
| 10 | 0,42 s | 0,83 s | 1,05 s | 1,33 s | 0,75 s | 1,10 s * |
| 12 | 0,17 s | 0,65 s | 0,92 s | 1,23 s | 0,70 s | 1,05 s |

\* fenêtre en plusieurs morceaux, pour deux raisons :
- un saut 35 à 54 m trop tôt retombe avant la fosse, et le rebond de l'atterrissage la franchit. Accepté : l'enfant a sauté ;
- **des appuis perdus au milieu de la fenêtre**, pendant un rebond (MESURÉ (relecture) : en turbo, 0,78 s puis 0,42 s). La tolérance de sol les supprime (ci-dessous).

**Avec la tolérance de sol** (MESURÉ, W = 8, `JUMP_GROUND_GRACE` émulée, appui à chaque pas, servi par la mémoire de 0,1 s) :

| | 8 m/s | 11,2 m/s | 14 m/s | 17,5 m/s | 21 m/s tenus | arrêt au pire point sûr | turbo pris 40 m avant |
|---|---|---|---|---|---|---|---|
| fenêtre principale | 0,65 s | 1,02 s | 1,20 s | 1,33 s | 1,43 s | 0,87 s | 1,17 s |
| morceaux | 1 | 1 | 1 | 1 | 5 (+ 0,17 s) | 1 | 2 (+ 1 pas) |
| s (m) | 1,45 – 6,49 | 1,58 – 12,74 | 1,70 – 18,20 | 2,10 – 25,01 | 2,09 – 31,67 | 1,77 – 12,61 | 2,30 – 24,73 |
| centre (s avant le bord) | 0,50 | 0,64 | 0,71 | 0,78 | 0,80 | 0,58 | ≈ 0,71 |

- La fenêtre principale est d'un seul tenant partout : le trou du turbo a disparu.
- Les morceaux en plus sont des sauts trop tôt sauvés par un rebond, plus, à 21 m/s tenus, quelques appuis encore perdus (ci-dessous).
- **Mesure en test** (MESURÉ, sonde de la v1.6, piste synthétique) : on balaie chaque pas des 1,6 s qui précèdent la chute de la course sans saut, soit ≈ [bord − 1,6 s × v, bord]. La fenêtre principale y tient entière et le premier pas balayé échoue toujours : fenêtres de 1,02 / 1,18 / 0,87 / 1,17 / 1,45 s à 11,2 m/s, 14 m/s, départ arrêté, turbo et 21 m/s tenus, ouvertes au plus 1,47 s avant. Les morceaux plus tôt (sauts 35 à 54 m trop tôt) sont hors du balayage : ni exigés, ni interdits. Un run coûte ≈ 0,06 s.
- **En CI**, un bloc suffit : 25 appuis, un par pas, sur les 0,4 s centrées sur l'instant visé par les copains (`fosseJumpLead`, §6.8). Ils passent tous à 14 m/s, en turbo et au départ arrêté (MESURÉ). À 5 m/s, 13 appuis échantillonnés suffisent à montrer qu'aucun ne passe (0 sur 97 à chaque pas, MESURÉ).

**Tolérance de sol : appuis perdus** (MESURÉ, piste plate, 24 lancers décalés de 0,37 m, chaque pas de 6 s pris comme appui, soit 8 640 appuis par cas ; calcul sur la suite « au sol / en l'air » d'une course sans saut) :

| Cas | sans tolérance | 0,35 s | 0,5 s | 0,8 s | plus long vol (contact de jeu) |
|---|---|---|---|---|---|
| 11,2 m/s | 0 | 0 | 0 | 0 | 3 pas |
| 14 m/s | 0,30 % | **0** | 0 | 0 | 10 pas |
| turbo pris à 14 m/s | 2,16 % | **0** | 0 | 0 | 23 pas |
| 21 m/s tenus (facteur 1,5 permanent) | 6,49 % | **0,41 %** | 0,15 % | 0 | 46 pas (0,77 s) |

- À 21 m/s tenus, la voiture rebondit souvent plus de 0,35 s sur le plat. Galahad n'y arrive qu'en enchaînant les étoiles. Le papa garde 0,35 s (Q-F6, c73faf5) : 1 appui sur 250 perdu dans ce cas, à rejuger au test tablette.

**Tolérance de sol : saut au sommet d'un tremplin** (MESURÉ ; demandé par le papa) :
- Protocole :
  - 23 tremplins des graines 0 à 4, 4 arrivées : doigt posé depuis `xLancement` ; turbo de l'étoile d'élan ; lancée à V_MAX en `xLancement − 45` avec turbo à − 26 ; turbo permanent ;
  - saut posé à chaque pas, de 6 pas avant le dernier contact de jeu du sommet jusqu'à 0,35 s après ;
  - soit 2 576 sauts.
- Résultat : **0 lave, 0 autre respawn, tous les atterrissages avant `xEnd`**. Marge minimale avant `xEnd` :
  - 38,6 m doigt posé ;
  - 29,4 m avec le turbo de l'étoile d'élan (vitesse au sommet ≤ 15,9 m/s) ;
  - 3,6 m en turbo permanent (vitesse au sommet ≤ 19,9 m/s, hors de portée de Galahad).
- Au dernier contact exact, la marge est de 30,3 m (élan) et 5,4 m (turbo permanent).
- Avec 0,8 s de tolérance : mêmes conclusions (marges 26,7 m et 3,0 m).
- **Aucune parade n'est nécessaire** : la tolérance de sol peut rester active sur les tremplins. Les copains n'y sautent jamais (`inNoJumpZone`).

Détail pour W = 8 (MESURÉ) :
- 11,2 m/s : s ∈ [1,62 ; 12,78] m, atterrissage 1,7 à 12,7 m après le bord aval ;
- 14 m/s : s ∈ [1,69 ; 18,18] m, soit 0,12 à 1,30 s avant le bord (centre 0,71 s), atterrissage 1,7 à 18,2 m après ;
- départ arrêté en `xLancement + 4,99` : vitesse au saut ≈ 12,3 m/s, s ∈ [1,77 ; 12,61] m, atterrissage 2,0 à 17,3 m après ;
- turbo : atterrissage jusqu'à 30,8 m après le bord aval (31,6 m à 21 m/s tenus) ; [tâche 7] copains sous élastique : vitesse conduite ≤ 18,2 m/s (CALCULÉ ; 18,8 MESURÉ ; le « 27,3 m/s » d'avant était une erreur, R7-1) ; atterrissage ≤ bord aval + 26,8 m (MESURÉ, relecture de la tâche 7 et Step 4 de la tâche : saut le plus tardif permis à 1,3, 180 runs ; saut centré ≤ + 15,5 m). La réception de 64,8 m les absorbe tous.

Les quatre contraintes :
- **(a) sans sauter, on tombe toujours.**
  - Sur le plat (MESURÉ) : lave à 100 % de 3 à 30 m/s (W = 2, 3 et 6), châssis repris 0,7 à 1,15 m avant le bord amont.
  - Sur terrain (MESURÉ), le vrai danger : une voiture qui arrive **en l'air**. Une double-bosse prise à 17,5–21 m/s lance la voiture sur 38 à 49 m (apogée du châssis 4,8 à 5,3 m au-dessus de sa hauteur de roulage) ; elle retombe ≈ 28 m après la tranche, et le rebond de l'atterrissage (≈ 11 m ; roues à 0,3–0,7 m du sol au bord, puis à plus de 1,4 m au-dessus de la lave) peut franchir la fosse. Balayage : bosses, double-bosse ou bosses + double-bosse avant la fosse, turbo pris tous les 2 m de 80 m avant les bosses jusqu'à leur fin, 16 pistes, 1 044 runs par cas : sans garde, 2 survols pour W = 6, 0 pour W = 8 ; garde de 10 m, 2 survols (W = 6) ; **garde de 20 m, 0 survol** (W = 6 et W = 8).
    - Recette (pour le témoin vivant de la 5g, la sonde étant supprimée) :
      - piste : plat de 150 m, puis la tranche k, puis la fosse (garde G, approche 32,35 m, W, réception 55 m), puis un plat de 100 m ;
      - tranche k : k = 0, une double-bosse ; k = 1 à 10, `bosses(mulberry32(500 + k))` ; k = 11 à 15, `bosses` puis `doubleBosse` sur le même `mulberry32(500 + k)` ;
      - Galahad lancé à 14 m/s 100 m avant la tranche, doigt posé, sans saut ;
      - turbo de 3 s posé quand le châssis passe le début de la tranche + t, t de −80 m à la fin de la tranche par pas de 2 m.
    - Survols sans garde à W = 6 : k = 6 (t = −20 m) et k = 14 (t = +8 m) ; avec une garde de 10 m : k = 11 (t = −8 m) et k = 13 (t = −2 m).
  - Une rampe-saut lance plus loin encore (roues à plus de 0,3 m jusqu'à 61 m après sa fin à 21 m/s) : pas de fosse juste après une rampe-saut (§6.3).
- **(b) fenêtre d'au moins 0,4 s à vitesse de croisière**, sans respawn : 1,02 s à 11,2 m/s pour W = 8 ; tenu jusqu'à W = 12 (0,65 s).
- **(c) départ arrêté au point sûr d'avant la fosse**, doigt posé : le pire point sûr (`xLancement + 5 − ε`) laisse `D_LANCE` de plat ; fenêtre 0,87 s pour W = 8, au moins 0,70 s jusqu'à W = 12.
- **(d) en turbo, le saut retombe sur la réception** : au plus 32,0 m après le bord aval (31,6 m sans tolérance de sol ; 31,9 m MESURÉ (relecture)), pour une réception de 64,8 m, soit avant `xEnd − 10` = bord aval + 54,8 m.

**Ce que voit l'enfant** (CALCULÉ, vue 1 280 × 800, `VISIBLE_HEIGHT_M` 14, avance de caméra 0,6 s) : la piste est visible jusqu'à 11,2 m + 0,6 s × v devant la voiture, soit 19,6 m à 14 m/s. La fosse apparaît donc ≈ 1,4 s avant le bord. Pour W = 8, la fenêtre s'ouvre ≈ 0,1 s après son apparition à 14 m/s. À 11,2 m/s, sauter dès qu'elle apparaît est trop tôt pendant ≈ 0,46 s : « attendre un peu » fait partie du défi. Le panneau (§6.7) prévient ≈ 3,7 s avant le bord.

### 6.3 Combien de fosses, et où (`generate`)

- **1 volcan sur 2** : `FOSSE_PERIOD` = 2. Les volcans de la piste, dans l'ordre, alternent tremplin et fosse ; la phase (le premier est un tremplin ou une fosse) est tirée une fois par piste dans un `mulberry32` dédié, dérivé de la graine de piste (`(seed ^ 0x6a09e667) >>> 0`). Le `rng` principal n'est pas touché. `FOSSE_PERIOD` = 0 : aucune fosse, pistes d'avant.
  - Pourquoi l'alternance plutôt qu'un pile ou face par volcan : chaque piste a au moins une fosse et un tremplin dès qu'elle a 2 volcans, et jamais 2 fosses de suite. Avec un tirage indépendant, ≈ 1 piste sur 10 n'aurait aucune fosse (CALCULÉ : 0,5^3,6 avec 3,6 volcans par course).
- **Même tirage que le tremplin.** Une fosse est un `'rampe-volcan'` tiré avec le poids des volcans (`VOLCANO_WEIGHT` : 3 jusqu'au tour 1 de la 5g, 4 depuis le tour 2, ci-dessous), avec les mêmes refus, puis typé fosse par l'alternance. Elle a la même longueur : la suite des tranches tirées, leurs longueurs et leurs places sont celles d'aujourd'hui.
- **Refus d'un volcan, quel qu'il soit** (règles d'aujourd'hui, étendues aux fosses) :
  - hors de [15 %, 90 %] de la longueur cible ;
  - juste après un autre volcan (tremplin ou fosse) ;
  - juste après une **rampe-saut** (option (a) de la tâche 1 ; pour une fosse, c'est aussi la contrainte (a) : vol de 61 m à 21 m/s) ;
  - juste après une **double-bosse**, pour un **tremplin** seulement (décision du papa, tour 1 de la 5g ; `TREMPLIN_AFTER_DOUBLE_BOSSE` = 0). Motif (relecture adversariale, MESURÉ) : un turbo pris ≈ 32 m avant la double-bosse finit pendant son vol, la voiture arrive au tremplin à ≈ 11,2 m/s au sommet et tombe doigt posé (3 chutes sur 1 568 runs, une seule trajectoire). Le type du volcan suivant est connu avant le tirage (alternance par rang, ci-dessus) : une fosse reste permise après une double-bosse ;
  - ces refus regardent la **dernière tranche tirée**, pas un plat étoile intercalé (§6.6) : sans cela, un plat étoile posé entre une rampe-saut et un volcan changerait les tirages suivants.
- **Bosses et double-bosses avant une fosse** : permises. Le plat de garde de 20 m absorbe leur vol en turbo (§6.2 (a), mesuré). Pas de refus de plus pour une fosse.
- **Effet sur les pistes** (CALCULÉ, prototype, graines 0 à 49, 1 680 m, avec les 3 plats étoile du §6.6) :
  - volcans par course : 4,22 (2 à 6) aujourd'hui → **3,62 (2 à 5)**, dont 1,82 fosses (1 à 3) et 1,80 tremplins (1 à 3). Graines 0 à 19 : 3,70 (2 à 5). La baisse vient des 171 m de plats étoile, pris sur la fin de piste à longueur constante ;
  - tranches avant une fosse : bosses 37, double-bosse 26, plat 24, plat étoile 4 (91 fosses) ;
  - le test « 3 à 7 volcans par piste, graines 0 à 19 » devient « 2 à 7 volcans, dont au moins 1 fosse et au moins 1 tremplin dès 2 volcans ». Levier si le papa veut plus de volcans : le poids de tirage (3 → 4 donne 4,08, CALCULÉ), au prix d'un terrain plus changé. À dire au papa, sans question.
  - avec « pas de tremplin juste après une double-bosse » (MESURÉ, `generateTrack`, graines 0 à 49) : volcans **3,16 (2 à 4)** au lieu de 3,64 (2 à 5), dont 1,60 fosses (1 à 2) et 1,56 tremplins (1 à 2) ; graines 0 à 19 : 3,15 (2 à 4). Un tremplin refusé est souvent remplacé par une autre tranche, et le volcan suivant arrive plus loin. Même levier (poids de tirage) si le papa veut revenir vers 3,6.
  - **décision du papa (tour 2 de la 5g) : revenir à ≈ 3,6 volcans par course, poids de tirage des volcans 3 → 4.** Coût du levier : une clé de config (`VOLCANO_WEIGHT`, 4 dans `CONFIG`), sa valeur d'avant dans `ANCIENNES_PISTES` (3 : pistes d'avant au bit près), et une recapture de l'empreinte de `CONFIG` (R-F10) ; le terrain change dès le premier tirage (préfixe commun mesuré avec l'ancien poids). MESURÉ (`generateTrack`, 1 680 m) : graines 0 à 49, volcans **3,62 (1 à 5)**, fosses 1,86 (0 à 3), tremplins 1,76 (1 à 3), étoiles basses 8,50 (6 à 13), 3 plats étoile et 3 étoiles hautes partout, 0 tremplin juste après une double-bosse ; graines 0 à 19 : 3,75 (2 à 5) ; graines 0 à 999 : 3,53 (0 à 6). Une graine sur 50 (39) n'a qu'un volcan, un tremplin, et pas de fosse : le test « 2 à 7 volcans » porte sur les graines 0 à 19.

### 6.4 Points sûrs, respawn, fantômes

- **Zone interdite aux points sûrs** : `forbiddenZone(v)` = [`xLancement + SAFE_LANCEMENT_MARGIN`, fin) ; fin = `xReception` pour un tremplin, et pour une fosse **`xReception + WHEEL_BASE/2 + WHEEL_RADIUS + 0,3`** (≈ 1,5 m après le bord aval ; tour 1 de la 5g, relecture adversariale MESURÉE : un châssis posé entre le bord aval et + 1,25 m a sa roue arrière dans le capteur de lave, d'où une boucle de réapparitions ou une 2e chute comptée pour le volcan suivant). Pour une fosse : de 5 m après le début de l'approche jusqu'à ≈ 1,5 m après le bord aval. Vaut pour tous les appelants (points sûrs, `shiftTarget`, réapparitions groupées). Le plat de garde accepte les points sûrs.
- **1re chute** : respawn au point sûr, à l'arrêt. Le pire point sûr laisse `D_LANCE` = 27,35 m de plat : (c) donne une fenêtre de 0,87 s (W = 8). Le retour au bord prend ≈ 3,6 s (CALCULÉ : 27,35 m depuis l'arrêt).
- **Série** : comptée sur la lave **réellement touchée** (`nearestVolcanoZone` au x de la chute, sinon `volcanoAhead` ; tour 1 de la 5g), pas sur le volcan devant le point sûr ; `volcanoAhead` trouve aussi les fosses (champ `xLava`). Seules les chutes dans la lave comptent ; toute autre raison remet la série à zéro (ruling de la tâche 3). Il y a donc **au plus 2 chutes par série**, pas « par fosse » : un retournement entre deux chutes ouvre une nouvelle série (jamais vu en 64 cas, MESURÉ (relecture)).
- **2e chute de suite : option B, choisie par le papa (Q-F2).** La voiture est posée à **bord aval + `FOSSE_RESPAWN_AFTER`** (5 m), à l'arrêt, au sol local, juste de l'autre côté.
  - Coût en temps d'une fosse ratée deux fois, contre un saut réussi :
    - option B : **≈ 4,3 à 4,6 s** (MESURÉ (relecture) sur le plat ; ma sonde : 4,77 s à + 3 m) ;
    - option A écartée, règle des tremplins (`xEnd − RESPAWN_AFTER_VOLCANO_BACK`, bord aval + 54,8 m) : ≈ 0,8 à 1,05 s sur le plat, et **≈ 2 s par fosse en course** (MESURÉ (relecture), 5 voitures, graines 1 et 4 : 6,2 s pour 3 fosses, 3,4 s pour 2), parce que la voiture posée loin saute aussi les étoiles de la réception.
  - Le respawn groupé de cette cible **avance** de 1,5 × `CAR_LENGTH` par voiture déjà posée, au lieu de reculer : reculer la ramènerait vers la lave. Même plafond de 4 décalages que `shiftTarget`.
  - Les tremplins gardent `xEnd − RESPAWN_AFTER_VOLCANO_BACK`.
- **Respawn groupé** au point sûr : inchangé (`shiftTarget` recule, hors zone interdite et hors cratère). La zone interdite prolongée garantit qu'une cible posée après une fosse n'est jamais ramenée vers sa lave : elle reste au-delà du bord aval + 1,5 m. Si le recul n'y trouve pas de place libre (toute la zone interdite est derrière), la cible reste sur l'occupant : les voitures s'y traversent (fantômes, zone d'une fosse jusqu'à bord aval + 40 m). Le sens « avance » ne sert qu'à l'option B.
- **Fantômes** : `inGhostZone` vaut pour les deux types.
  - Tremplin : châssis dans [`xLancement`, `xReception` + `WHEEL_BASE/2` + `WHEEL_RADIUS`], inchangé.
  - **Fosse** : châssis dans [`xLancement`, bord aval + `FOSSE_GHOST_AFTER`], avec `FOSSE_GHOST_AFTER` = 40 m. C'est l'atterrissage le plus long mesuré (31,6 m ; 31,9 m MESURÉ (relecture)) plus une marge.
  - [tâche 6, tour 1] La zone commence au début du plat de garde (`xLancement` − `FOSSE_GUARD`). MESURÉ : avec les copains qui ratent parfois une fosse et repartent du point sûr, Galahad en turbo (18 à 20 m/s) percutait un copain plus lent ou reposé à 2 à 4 m avant `xLancement` et était catapulté par-dessus l'approche dans la lave (graines 33 et 36, sauteur parfait). Garde comprise, ces courses sont propres. Confirmé par le papa (décision (1) du 2026-10-23, rulings de la tâche 6).
  - Ainsi, une voiture qui repart arrêtée du point sûr, deux sauteurs qui se croisent en l'air, et une voiture posée juste après la fosse sont traversés par les autres.
  - [tâche 7] Vérifié (R-F16 fermé) : sous élastique, un copain conduit ne dépasse pas 18,2 m/s (le « 27,3 m/s » était une erreur, R7-1) ; il atterrit au plus à bord aval + 26,8 m (MESURÉ, Step 4 de la tâche 7 : saut le plus tardif permis à 1,3, 180 runs) ; en course, `robots-sauts` exige ≤ `FOSSE_GHOST_AFTER` − 5 = 35 m par bras (Step 6 de la tâche 7 : MESURÉ 23,6 m au plus, 48 graines × 3 bras).
- **Respawn immédiat d'une voiture retournée** (`inElanZone`, [`xElanStart`, `xLip`]) : tremplins seuls. Sur l'approche plate d'une fosse, les délais `FLIP_SECONDS` / `SIDE_SECONDS` d'aujourd'hui s'appliquent.
- **Robots polis et lever de pied** : la zone volcan [`xLancement`, `xLava`] vaut pour les deux types (gaz toujours, jamais de politesse). [tâche 7, tour 1] Hors de cette zone, un copain à moins de `POLITE_GAP` derrière Galahad doigt levé lève le pied lui aussi, sans limite de durée (décision du papa, relectures de la tâche 7), sauf si l'un des deux est fantôme ou invulnérable, et plus après l'arrivée de Galahad. [tâche 7, tour 2] Cette règle ne joue qu'après le départ de Galahad, c'est-à-dire après son premier appui (gaz posé au moins une fois ; décision du papa du 2026-10-23). Sur la grille, avant ce premier appui, la politesse ordinaire de la tâche 6 reste seule : 3 s au plus, puis les copains partent. Pendant ce lever de pied, la demande de saut d'étoile haute d'un copain reste faite. La demande de saut d'une fosse ne se fait que sur l'approche, en zone : elle n'est jamais gênée par cette règle.

### 6.5 Étoiles près des fosses (tranché)

- **Pas d'étoile basse sur le plat de garde, l'approche ni la fosse.** Pour le curseur, la zone admissible d'une tranche `fosse` est sa seule réception [`xReception`, `xEnd`]. Motif : un turbo pris pendant l'approche change la vitesse pendant que l'enfant choisit son instant, et, après une chute, l'étoile serait reprise à chaque nouvel essai.
- **Pas d'étoile d'élan pour une fosse.** À la place, une **étoile de réception** à `xReception + FOSSE_STAR_AFTER` (25 m, juste après la zone d'atterrissage à 14 m/s), tirée 1 fosse sur 2 comme l'étoile d'élan. Le plancher de 6 ajoute, dans l'ordre de la piste, l'étoile d'élan d'un tremplin ou l'étoile de réception d'une fosse.
  - Le curseur s'écarte de ± `STAR_ELAN_GAP` (5 m) autour de cette étoile, comme il s'arrête 5 m avant l'étoile d'élan. Ce trou est retiré de la zone admissible, qu'il y ait une étoile de réception ou non : aucune autre étoile basse à moins de 3 m d'elle (même test que l'étoile d'élan).
  - Avec l'option B, une voiture posée à + 5 m après deux chutes la prend aussi : c'est le temps perdu (≈ 4,5 s), pas l'étoile, qui fait payer la fosse.
- **Pas d'étoile haute dans une tranche `fosse`**, ni au-dessus de la lave. `highStarTerrain` traite une fosse comme une `rampe-volcan` : ni étoile, ni élan, ni atterrissage d'un saut d'étoile.
  - Motif : à 3,90 m, une étoile au-dessus d'une fosse demande un saut à la fois parfait pour l'étoile (0,57 s) et pour la fosse. Rater l'un, c'est la lave. Elle pourrait servir de guide visuel « saute ici » : à proposer au plan C, après le test tablette.
- **Pas d'étoile haute juste avant une fosse** : le plat étoile qui précède une fosse finit par ses 25 m d'atterrissage, et la fosse commence par 20 m de garde. Un saut d'étoile retombe donc avant l'approche (atterrissage au plus 27 m après l'étoile, en turbo).
- **Pas d'étoile basse avant l'atterrissage, sur les réceptions** (demande du papa, 5g) : une étoile au début d'une réception était survolée doigt posé. Critère : aucune étoile basse du curseur avant l'atterrissage le plus long doigt posé, turbo compris, plus une marge. Le curseur ne compte la réception d'un tremplin qu'à partir de `xReception + STAR_TREMPLIN_LANDING` (55 m après le pied de la descente aval ; il reste ≈ 9,3 m), et celle d'une fosse qu'à partir de `xReception + STAR_FOSSE_LANDING` (22 m après le bord aval ; le trou de ± 5 m autour de l'étoile de réception porte le début à 30 m) ; l'étoile de réception (25 m) est au-delà. MESURÉ (5 voitures doigt posé, graines 0 à 23) : contact le plus loin 49,0 m (tremplin) et 17,1 m (fosse), 64 étoiles de réception sur 64 prises.
  - **Survol possible en turbo, noté pour le test tablette** (décision du papa, tour 2 de la 5g, dégagement gardé à 55 m) : MESURÉ, graine 2, un tremplin pris en turbo (étoile d'élan) touche à 50,1 m, rebondit et survole jusqu'à 62,2 m une étoile basse en 60,7 m. Le test des étoiles de réception tolère une étoile survolée quand le volcan est pris en turbo (turbo actif au sommet : celui de l'étoile d'élan finit pendant le vol) et imprime la liste ; hors turbo, il exige toujours « prise ».
- **Nombre d'étoiles basses** (graines 0 à 49) :
  - aujourd'hui : **9,02** (6 à 13 ; `PRE_5E_STARS` = 451 étoiles sur 50 pistes, MESURÉ) ;
  - fin de la 5e (plats étoile seuls), au pas **[55, 90]** : **8,72** (MESURÉ (relecture), prototype vérifié identique à `generateTrack`) ; au pas actuel [60, 100], 8,10 avec 1 piste sous le plancher (CALCULÉ) ;
  - 5g (fosses, étoile de réception, plats étoile), au pas **[50, 85]** : **8,52** (6 à 12, MESURÉ (relecture)) ; au pas [60, 100], 4 pistes sous le plancher (CALCULÉ).
  - 5g avec les dégagements de réception : au pas [50, 85], 6,50 (4 à 9) ; au pas **[35, 58]**, **8,50** (5 à 12 ; graines 0 à 19 : 6 à 12), MESURÉ ; puis, avec « pas de tremplin juste après une double-bosse » (moins de volcans, donc moins d'étoiles d'élan et de réception), **8,12** (5 à 12 ; graines 0 à 19 : 8,35, 6 à 12), MESURÉ, pas gardé ; enfin, avec le poids de tirage des volcans 4 (tour 2), **8,50** (6 à 13 ; graines 0 à 19 : 8,60, 6 à 12), MESURÉ.
  - Choix : **[55, 90] en fin de 5e, puis [35, 58] en 5g** (ruling du Step 7). C'est la règle de l'addendum plan B §1.5 : le pas bouge, la cible 8 à 12 et le test 6 à 14 restent.
  - Les valeurs finales sont celles que mesurent les vrais tests. Le trou de ± 5 m autour de l'étoile de réception les baisse un peu : on remesure et, si besoin, ruling.

### 6.6 Plats étoile

- **Nouvelle tranche `'plat-étoile'`** (`SliceType`) : un plat de **`STAR_FLAT_LENGTH` = 57 m**, l'étoile haute à **32 m** de son début, à sol + `STAR_HIGH_Y` = 3,90 m.
  - 57 m = 12 m de dégagement d'entrée (`STAR_HIGH_BUMP_CLEARANCE`) + 20 m d'élan (`STAR_HIGH_TAKEOFF_ROOM`) + 25 m d'atterrissage (`STAR_HIGH_LANDING_ROOM`). Constante dérivée, déclarée avant le littéral de `config.ts` ; [relectures 5e] `generateTrack` refuse une configuration où `STAR_FLAT_LENGTH` diffère de cette somme.
- **Fenêtre sur un plat étoile** (MESURÉ, plat pur, 3,90 m) :

  | v (m/s) | fenêtre | à + 5 cm | saut au plus tôt | au plus tard | atterrissage jusqu'à |
  |---|---|---|---|---|---|
  | 8 | 0,65 s | 0,55 s | 10,5 m avant l'étoile | 5,4 m avant | 10,5 m après |
  | 11,2 | 0,57 s | 0,47 s | 14,3 m | 8,2 m | 14,1 m |
  | 14 | 0,60 s | 0,48 s | 18,3 m | 10,1 m | 17,7 m |
  | 21 | 0,55 s | 0,47 s | 25,8 m | 14,7 m | 27,0 m |

  Centre de la fenêtre ≈ 1,0 s avant l'étoile (0,98 à 1,02 s), quelle que soit la vitesse. Les 20 m d'élan couvrent le saut le plus tôt à 14 m/s (18,3 m) ; les 25 m d'atterrissage couvrent le plus long à 14 m/s (17,7 m) avec 7 m de marge. En turbo, l'atterrissage peut déborder de 2 m sur la tranche suivante ; si c'est un volcan, ces 2 m tombent sur son plat de lancement ou sur la garde d'une fosse : accepté.
- **Dégagement d'entrée de 12 m** (MESURÉ, vitesse tenue, « portée » = dernier x au-delà de la fin de la tranche où le haut du châssis atteint 3,35 m, soit le bas du capteur d'une étoile à 3,90 m moins 5 cm) :
  - double-bosse : aucune à 14 m/s ; 11,3 m à 17,5 m/s ; 21,6 m à 21 m/s ;
  - bosses (30 tirages) : aucune à 14 m/s ; 4,2 m à 17,5 m/s ; 18,6 m à 21 m/s ;
  - rampe-saut : 7,7 m à 14 m/s ; 15,8 m à 17,5 m/s ; **36,6 m à 21 m/s**.

  L'étoile est à 32 m du début du plat étoile : au-delà de la portée des bosses et des double-bosses en turbo (marge ≥ 10 m), mais pas de celle d'une rampe-saut. D'où la règle d'insertion ci-dessous. [tâche 7] Copains sous élastique : à 18,2 m/s (1,3 tenu), 0 prise sans saut (sonde et relecture de la tâche 7 ; Step 4 de la tâche : 300 runs lancés à 18,2 m/s, haut du châssis ≤ 1,93 m au-dessus du sol à ± 3 m de l'étoile, bas du capteur à 3,40 m) ; `high-stars-sim` relancé (5 voitures, graines 0 à 23 : 0 prise sans saut ni contact, 115 prises au saut de copains, 4 prises tolérées après un contact contre 1 à la tâche 6), règle des copains catapultés (§4) inchangée.
- **Insertion par le générateur** (tranches posées sans `rng`) :
  - N = min(`STAR_FLATS_PER_RACE`, ⌊(limite − x0) / `STAR_FLAT_SPACING`⌋), avec x0 la fin du plat de départ, limite = cible − `FINISH_PLAT_BEFORE` − `AFTER_FINISH`, `STAR_FLATS_PER_RACE` = 3 et `STAR_FLAT_SPACING` = 400 m. Soit 3 à 1 680 m et à 6 000 m, 2 à 1 000 m, 1 à 600 m, 0 à 300 m.
  - Ancres a_k = x0 + (k + ½) × (limite − x0) / N, k = 0 … N − 1 (MESURÉ à 1 680 m, graines 0 à 49 : plats étoile en moyenne vers 342, 897 et 1 401 m).
  - [relectures 5e] **Jeu des ancres** : si la pose n'en met pas N (graine 128 : le 3e ne tenait plus pour 1,4 m), la piste est refaite depuis la même graine avec les ancres calculées sur (limite − j × `STAR_FLAT_LENGTH` − x0), j = 1, 2 … 11 ; la première pose complète est gardée. Une piste posée du premier coup ne change pas. MESURÉ, graines 0 à 999 à 1 680 m : 3 plats étoile partout, 26 pistes refaites (j = 1 à 6) ; graines 0, 1 et 2 sans jeu.
  - Avant chaque tirage, si x ≥ a_k, si la dernière tranche tirée n'est ni une **rampe-saut** ni un **volcan** ([relectures 5e] **pas après un volcan**, décision du papa a105e2b : à la sortie d'une réception, les voitures se rattrapent et se cognent ; graine 7, Galahad catapulté à 4,75 m ; en 5g, pas non plus après une fosse), si l'élan de son étoile, [x + 12, x + 32], est hors des 50 m (`STAR_HIGH_RAMP_CLEARANCE`) qui suivent la fin de la dernière rampe-saut ([relectures 5e] rampe-saut puis plat court : 549 plats étoile sur 3 000 l'avaient, graines 0 à 999), et si le plat étoile tient avant la limite, il est posé et k avance. Sinon, on tire normalement et on réessaie à la frontière suivante. S'il ne tient plus, les plats étoile restants sont abandonnés, et la piste est refaite avec du jeu sur les ancres (ci-dessus).
  - Aucun `rng` consommé, refus des volcans sur la dernière tranche tirée (§6.3). La suite des tranches tirées est celle d'aujourd'hui **sur un préfixe** d'au moins 25 tranches (31,8 en moyenne, MESURÉ, graines 0 à 49). La fin de piste (≈ 171 m) change : la règle des 90 % et la limite d'arrivée s'appliquent à des x décalés.
  - Voisins (MESURÉ, graines 0 à 49, 150 plats étoile, règles des relectures de la 5e) : avant, des bosses 94 fois, un plat 32, une double-bosse 24 ; jamais une rampe-saut ni un volcan. Après : toute tranche (une fosse commence par sa garde, un tremplin par son plat de lancement).
- **Pas de fusion.** Un plat étoile n'est pas fusionné avec ses voisins : son étoile a une place fixe, sa longueur suffit seule. Pour une étoile haute sur un plat ordinaire (si le plafond le permet), il compte comme terrain permis (élan, atterrissage), mais pas comme segment. Les plats ordinaires gardent la règle de la 5e (voisins fusionnés, dégagements, terrain permis).
- **Pas d'étoile basse sur un plat étoile** : pas une zone admissible du curseur. Une étoile basse dans l'élan donnerait un turbo juste avant le saut, et elle pourrait gêner `STAR_HIGH_GAP`.
- **Choix des étoiles hautes** : d'abord une par plat étoile, toujours. Ensuite, s'il reste de la place sous `STAR_HIGH_PER_RACE`, les candidates des plats ordinaires (règle de la 5e) sont tirées par le `rng` de piste, après tous les autres tirages, sans remise. Elles restent à au moins 45 m (élan + atterrissage) de toute autre étoile haute, de plat étoile ou de plat ordinaire ([relectures 5e] les candidates de repli sont aussi écartées entre elles), et [relectures 5e] **jamais sur un plat juste après un volcan**, comme les plats étoile.
  - `STAR_HIGH_PER_RACE` = 3 (**Q-F4 : exactement 3**) : à 1 680 m, seulement les 3 des plats étoile. Les candidates des plats ordinaires (code de la 5e) n'y servent plus ; elles restent testées sur une fixture à plafond 5, pour un éventuel changement d'avis.
  - Pistes courtes (MESURÉ, graines 0 à 199, `?len=`) : les candidates des plats ordinaires complètent jusqu'à 3. À 300 m : 0 plat étoile, 0 ou 1 étoile haute (0,10 en moyenne) ; à 600 m : 1 plat étoile, 1 à 3 étoiles hautes (1,25) ; à 1 000 m : 2 plats étoile, 2 ou 3 étoiles hautes (2,34).
  - Jeu de la 5e retenu pour les plats ordinaires : dégagements **50 m après une rampe-saut, 12 m après des bosses, une double-bosse ou un cratère ; élan 20 m ; atterrissage 25 m**. C'est le plus permissif des 4 jeux qui donnent 0 prise sans saut à 3,90 m, à 5 voitures, graines 0 à 23 (calibration de la 5e, MESURÉ ; 50/12/15/15 et 70/12/15/15 laissaient des copains catapultés prendre une étoile, graines 17 et 20).
- **Voitures catapultées** : la règle du §4 s'applique, car les plats étoile sont hors des zones fantômes. Pour toute voiture, Galahad compris (R-F12 amendé, tour 2 de la 5g ; « Galahad : 0 prise sans saut, sans exception » jusque-là) : une prise sans saut n'est tolérée que dans les 2 s après un choc entre voitures, ou pendant le vol qui suit ce choc, sans retour sur la piste (tour 1 de la tâche 6 : graine 8, Malo catapulté par le toit de Timothé prend l'étoile 2,18 s après le contact, toujours en l'air ; lecture confirmée par le papa, décision (4) du 2026-10-23) ; elle est comptée et imprimée. Une prise sans saut ni choc reste un échec. Les robots polis (tâche 6) devraient faire baisser ces chocs : mesuré en tâche 6.
- **Tests** : exactement 3 plats étoile (graines 0 à 999) et exactement 3 étoiles hautes (graines 0 à 49) par piste de 1 680 m ; pour chaque étoile de plat étoile des graines 0 à 9, fenêtre ≥ 0,4 s à 11,2 et 14 m/s, ≥ 0,3 s à + 5 cm ; 0 prise sans saut (Galahad seul, turbo forcé ; 5 voitures, graines 0 à 23). Avec `STAR_FLATS_PER_RACE` = 0 et `FOSSE_PERIOD` = 0 (et `STAR_HIGH_PER_RACE` = 0, pas [60, 100]), pistes et étoiles identiques au bit près à celles de e02dcae **sans étoiles hautes** (`PRE_5E_STARS`).

### 6.7 Rendu : comment l'enfant voit une fosse

- **Lave à ras bord.** La fosse est remplie : surface de lave à 0,1 m sous le sol, orange vif, bulles (les bulles de `effects.ts` valent telles quelles, `rimY` = 0). Des **langues de feu** animées montent jusqu'à 0,3 m au-dessus du sol, la hauteur du capteur. Une roue qui touche la lave touche donc du feu dessiné : la reprise ne paraît pas injuste. Pour le tremplin, la bande invisible de 0,45 m relevée en tâche 1 ne change pas.
- **Halo.** Lueur orange au-dessus de la fosse, jusqu'à ≈ 3 m, qui pulse au temps de simulation. Dégradé radial étiré (fondu vers le haut et sur les côtés, sans bord net), large de la lave plus `FOSSE_HALO_SIDE_M` (2 m) de chaque côté ; la fosse est dessinée dès que cette étendue entre dans la vue (tour 1 de la 5g). Visible dès que la fosse entre dans l'écran, ≈ 1,4 s avant le bord à 14 m/s. C'est la lave qui brille tout le temps, pas un signal d'approche : rien ne s'allume quand la voiture arrive (Q-F5).
- **Panneau.** Un poteau et un triangle jaune portant **le ressort du bouton saut**, planté au début de l'approche (`xLancement`, 32 m avant le bord). Il est visible ≈ 3,7 s avant le bord à 14 m/s (CALCULÉ). Le même dessin que le bouton relie le panneau au geste. Pas de panneau devant un tremplin : il suffit d'y garder le doigt.
- **Plots** : pas de plot lumineux au-dessus de la lave (règle d'aujourd'hui, `lavaWidth` compris).
- **Plat étoile** : rien de plus que l'étoile haute. Elle est visible ≈ 1,4 s avant (19,6 m), et la fenêtre s'ouvre ≈ 1,3 s avant l'étoile : l'enfant la voit à temps.
- **Aide (Q-F5)** : un bouton saut qui pulse à l'approche d'une fosse n'est **pas retenu** pour le premier test (décision du papa). Il sera rejugé si Galahad oublie de sauter.
- **Captures** (e2e, graine 18, première fosse la plus proche du départ des graines 0 à 49, bord amont en 316,6 m ; graine 31 jusqu'au tour 1 de la 5g) : deux captures de la fosse, `e2e/screenshots/fosse-panneau.png` (le panneau, au début de l'approche) et `fosse.png` (lave, halo, langues de feu) : la vue fait ≈ 22 m de large, le panneau est 32 m avant le bord, ils ne tiennent pas sur une seule image. Plus `plat-etoile.png`.

### 6.8 Copains (tâche 6)

- **Ils sautent toutes les fosses** : pas de tirage `jumpTry`, ne pas sauter serait tomber à coup sûr.
- **Instant visé, centré à chaque vitesse** (Q-F3). Le copain demande le saut dès que (`xBord − x`) / max(v, 1) ≤ `fosseJumpLead(v)` + e, avec `fosseJumpLead(v)` = max(`FOSSE_JUMP_MIN_DISTANCE` / v, `FOSSE_JUMP_AIM` − `FOSSE_WIDTH` / (2v)), `FOSSE_JUMP_AIM` = 1,00 s et `FOSSE_JUMP_MIN_DISTANCE` = 2 m (tour 1 de la 5g : sous ≈ 4 m/s, la formule seule donnait un instant ≤ 0, et sous ≈ 6 m/s elle visait plus près du bord que la lave ne reprend la voiture, ≈ 1,15 m ; un copain lent ne sautait jamais). Il ne demande plus quand la mémoire de la demande (`JUMP_BUFFER`) l'emmènerait au-delà du bord : (`xBord − x`) / max(v, 1) > `JUMP_BUFFER`.
  - [tâche 6, tours 1 et 2] **Raté tardif visible.**
    - Tour 1 (décision du papa, 9cf3fd6) : une erreur trop tardive ne supprimait plus le saut, la demande partait au dernier pas permis (max(`fosseJumpLead(v)` + e, `JUMP_BUFFER` + `PHYSICS_DT`)). La re-relecture a MESURÉ que ce saut partait 0 à 2 pas (≤ 33 ms) avant que la lave ne reprenne la voiture : raté invisible. Et la lave, qui reprend le châssis 1,05 à 1,17 m avant le bord, devançait ce saut selon la phase du pas entre ≈ 10,5 et 11,25 m/s (bande de phase, 11,21 m/s au plus, et non un seuil net « jusqu'à ≈ 11,3 m/s ») : chute « sans tentative », tolérée sous 11,5 m/s.
    - **Tour 2 (décision du papa du 2026-10-23) : une erreur trop tardive devient un saut trop tôt du même écart.** Trop tardive : `fosseJumpLead(v)` + e < `fosseLatestLead(v)` = `FOSSE_JUMP_LATE_DISTANCE` / max(v, 1) + `FOSSE_JUMP_LATE_TIME` (1,2 m et 0,06 s : le bord au plus tard CALCULÉ ci-dessous ; prudent, les bords mesurés du §6.2 sont plus près de la lave). L'instant visé devient alors `fosseJumpLead(v)` − e. Le filet `JUMP_BUFFER` + `PHYSICS_DT` reste. Une seule formule, `inFosseJumpWindow(xBord, x, v, cfg, e)` (tour 3), sert au sauteur parfait des tests (par `fosseJumpWanted(track, x, v, cfg, e)`, qui cherche la fosse) et au driver des copains (qui lit la fosse de son contexte) ; sans erreur rien ne bascule (`fosseJumpLead` ≥ `fosseLatestLead` + 0,073 s à toute vitesse, minimum à 6 m/s), et Galahad seul est identique au bit près.
    - Un saut basculé de justesse vise le bord au plus tôt CALCULÉ (le milieu des deux bords est `fosseJumpLead`, à 0,02 s près) : du côté tôt de la fenêtre, qui est large, et il passe. MESURÉ (piste plate, saut demandé à chaque pas avec l'erreur, 6 phases) : erreur à ± 0,002 s du seuil, à 8, 11,2, 14, 17,5 et 21 m/s, 60 passages sur 60 ; à 0,03 s sous le seuil, 29 sur 30. Près du seuil, la bascule suit les petites variations de vitesse d'un pas à l'autre : le saut part entre les deux bords, et passe.
    - MESURÉ (piste plate, Pablo, erreur −1,05 s, vitesse tenue de 3 à 21 m/s, 6 phases) : le copain saute toujours avant la lave, de 5,1 m (3 m/s) à 31,6 m (17,5 m/s) avant le bord, et la lave le reprend 1,93 s après (1,93 à 1,97 s) ; à 21 m/s, l'instant visé tombe avant l'approche : il saute au début de l'approche et retombe au bord aval (dans la lave 5 fois sur 6). Départ arrêté au point sûr (27,35 à 32 m du bord) : la bascule se décide à la vitesse du moment (9,9 à 11,1 m/s) ; il saute à 16 à 18,3 m du bord et retombe dans la lave 1,93 à 1,95 s après (le saut à ≈ 13 m du bord vient des erreurs de −0,55 à −0,7 s). Plus aucune chute « sans tentative » : la tolérance des invariants est resserrée à 0 (décision du papa (3)).
    - **Saut si tôt qu'il retombe avant la fosse** (re-relecture du tour 2, MESURÉ, piste plate) : pour une très grosse erreur, la voiture atterrit avant le bord puis roule dans la lave. À e = −1,5 s et 11,25 ou 14 m/s : 1,4 à 2,9 m avant le bord, lave 2,02 à 2,13 s après le saut ; au départ arrêté avec e = −2 s : 3,4 à 3,8 m avant le bord, lave 2,22 à 2,43 s après. C'est rare (Pablo, σ_f = 0,45 s : ≈ 0,3 % des tentatives à 14 m/s, CALCULÉ), c'est le miroir des erreurs trop tôt qui existaient déjà, le saut reste visible, et la chute est classée « fosse ».
    - MESURÉ en course (5 voitures ; robots-sauts graines 0 à 47 et race-invariants graines 0 à 23, Galahad avec le saut parfait ; race-sans-saut graines 0 à 23, Galahad sans saut) : 128 chutes de copain dans une fosse, **toutes après un saut**, reprises par la lave 1,92 à 2,00 s après le saut (médiane 1,93 s) : le raté se voit toujours ; 0 chute « sans tentative », 0 « choc », 0 au tremplin ; 0 chute de Galahad avec le saut parfait.
  - CALCULÉ : le bord au plus tard est à ≈ 1,2 m + 0,06 s × v, le bord au plus tôt à ≈ 1,96 s × v − W − 1,2 m ; leur milieu, divisé par v, donne la formule.
  - Comparé aux centres mesurés (§6.2, avec tolérance) :

    | v | 8 m/s | 11,2 m/s | 14 m/s | 17,5 m/s | 21 m/s |
    |---|---|---|---|---|---|
    | `fosseJumpLead(v)` | 0,50 s | 0,64 s | 0,71 s | 0,77 s | 0,81 s |
    | centre mesuré | 0,50 s | 0,64 s | 0,71 s | 0,78 s | 0,80 s |

    L'écart est d'au plus 0,01 s à vitesse tenue.
  - Quand la voiture accélère encore (départ arrêté au point sûr, turbo qui commence), le vrai centre arrive ≈ 0,1 s plus tard que la formule (0,58 s mesuré contre 0,68 s au départ arrêté). La tâche 6 mesure le raté dans ces cas, vitesse par vitesse.
  - Le driver **redemande le saut à chaque pas** tant qu'il est dans sa fenêtre et n'a pas sauté.
  - L'erreur e suit N(0, σ_f), avec σ_f = `FOSSE_SKILL_FACTOR` × `jumpSkill` = 2,5 × les traits validés.
  - Deux erreurs sont pré-tirées par fosse à la création du driver, une par tentative, par la graine du driver : ENCORE rejoue les mêmes sauts. [tâche 6, tour 1] La tentative se compte par fosse : 2 dès que la voiture est tombée une fois dans cette fosse, même si une autre réapparition (retournement) remet la série de chutes à zéro.
- **Taux de raté attendus** (CALCULÉ, loi normale, instant centré, demi-fenêtres mesurées du §6.2) :

  | Pilote (σ_f) | 8 m/s (0,32 s) | 11,2 m/s (0,50 s) | 14 m/s (0,59 s) | 21 m/s (0,70 s) | départ arrêté (0,44 s) |
  |---|---|---|---|---|---|
  | Pablo (0,45 s) | 48 % | 27 % | 19 % | 12 % | 33 % |
  | Matthis (0,375 s) | 40 % | 18 % | 12 % | 6 % | 24 % |
  | Diego (0,25 s) | 21 % | 4,6 % | 1,8 % | 0,5 % | 7,8 % |
  | Malo (0,225 s) | 16 % | 2,7 % | 0,9 % | 0,2 % | 5,1 % |
  | Timothé (0,10 s), Liam (0,125 s) | ≤ 1 % | 0 % | 0 % | 0 % | ≈ 0 % |

  Fourchette réaliste pour Pablo : **19 à 34 %** (14 m/s doigt posé ; 11,2 m/s ; 2e essai depuis le point sûr, plus le biais de 0,1 s en accélération). Avec les traits tels quels (facteur 1), les copains ne rataient jamais une fosse, alors que Galahad le peut.
  - [tâche 6, tour 2] Avec la bascule, un raté tardif devient un raté tôt du même écart : à vitesse tenue, la fenêtre est à peu près symétrique autour de `fosseJumpLead(v)`, et le taux ne change presque pas. MESURÉ (robots-sauts, 48 graines, chutes par tentative) : bras « fonceurs » 74/422 (17,5 % ; tour 1 : 82/429, 19,1 %), dont 12–14 m/s 53/281 (18,9 %), 14–16 m/s 1/30, 18–20 m/s 3/10, 20–22 m/s 4/29 (13,8 %), départ arrêté (2e essai) 12/62 (19,4 %) ; bras « prudents » 0/360 ; tirage normal : Pablo 12/63 (19,0 % ; tour 1 : 17,5 %), Matthis 14/69 (20,3 % ; tour 1 : 20,3 %), Diego, Malo, Timothé et Liam 0.
- **Quand un copain rate** : même règle que Galahad (§6.4).
  - Lave, puis respawn au point sûr ; à la 2e chute de suite, posé juste après la fosse.
  - Fantôme près de la fosse et jusqu'à bord aval + 40 m, donc jamais de choc.
  - Son 2e essai utilise la 2e erreur pré-tirée.
- **Limite de respawns** : « ≤ 3 respawns par robot et par course » (addendum §2) compte hors fosses. Aux fosses, au plus 2 chutes **par série** (un retournement entre deux chutes en ouvre une nouvelle). Tout dépassement est mesuré et montré au papa, jamais relâché en silence.
- **Garde de `stepRace`** : `inNoJumpZone` = [`xLancement`, `xReception`] d'un **tremplin**. Devant une fosse, le seul saut d'un copain est celui de la fosse : ni saut d'étoile, ni second saut entre `xLancement` et le bord aval + 5 m.
- **Étoiles hautes** : avec exactement 3 étoiles hautes par course, le bras « Pablo » compte ≈ 4 × 48 × 3 × 0,8 ≈ 460 tentatives et le bras « Timothé » ≈ 170, au-dessus du seuil de 40 de la tâche 6.
- **Entre la 5g et la 6** (driver provisoire), les copains sautent chaque fosse **sans erreur**, au centre `fosseJumpLead(v)`, en redemandant à chaque pas. Les invariants à 5 voitures gardent ainsi un sens (« aucune chute propre ») avant la vraie conduite.

### 6.9 Constantes (`config.ts`) et interrupteurs

| Constante | Valeur | Rôle |
|---|---|---|
| `JUMP_GROUND_GRACE` | 0,35 | s : tolérance de sol du saut (§1, décision du papa) |
| `STAR_HIGH_Y` | 3,90 | choix du papa (5e) |
| `STAR_HIGH_TAKEOFF_ROOM`, `STAR_HIGH_LANDING_ROOM` | 20, 25 | élan, atterrissage (5e) |
| `STAR_HIGH_RAMP_CLEARANCE`, `STAR_HIGH_BUMP_CLEARANCE` | 50, 12 | dégagements (5e) |
| `STAR_HIGH_PER_RACE` | 3 | exactement 3, celles des plats étoile (Q-F4) |
| `STAR_FLATS_PER_RACE` | 3 | plats étoile par course ; 0 = aucun |
| `STAR_FLAT_LENGTH` | 57 (dérivée) | dégagement d'entrée + élan + atterrissage |
| `STAR_FLAT_SPACING` | 400 | m de piste par plat étoile (pistes courtes) |
| `STAR_STEP_MIN`, `STAR_STEP_MAX` | 55 / 90 (fin de 5e), puis 35 / 58 (5g, ruling du Step 7) | pas du curseur ; 8,72 puis 8,50 étoiles basses (6 à 13), MESURÉ (§6.5) |
| `STAR_TREMPLIN_LANDING`, `STAR_FOSSE_LANDING` | 55, 22 | m sans étoile basse du curseur après `xReception` d'un tremplin (pied de la descente aval), d'une fosse (bord aval) (demande du papa, §6.5) |
| `FOSSE_PERIOD` | 2 | 1 volcan sur 2 est une fosse ; 0 = aucune |
| `FOSSE_WIDTH` | 8 | m de lave (Q-F1) |
| `FOSSE_GUARD` | 20 | m de plat de garde avant l'approche |
| `FOSSE_STAR_AFTER` | 25 | m entre le bord aval et l'étoile de réception |
| `FOSSE_JUMP_AIM` | 1,00 | s : `fosseJumpLead(v)` = max(`FOSSE_JUMP_MIN_DISTANCE` / v, `FOSSE_JUMP_AIM` − `FOSSE_WIDTH` / (2v)), centre de la fenêtre (§6.8) |
| `FOSSE_JUMP_MIN_DISTANCE` | 2 | m : instant visé au moins 2 m avant le bord (copains lents, tour 1 de la 5g) |
| `FOSSE_JUMP_LATE_DISTANCE`, `FOSSE_JUMP_LATE_TIME` | 1,2, 0,06 | m, s : bord au plus tard CALCULÉ (§6.2), `fosseLatestLead(v)` = 1,2 / max(v, 1) + 0,06 s ; une erreur de copain qui viserait plus tard devient un saut trop tôt du même écart (décision du papa, tour 2 de la tâche 6, §6.8) |
| `TREMPLIN_AFTER_DOUBLE_BOSSE` | 0 | pas de tremplin juste après une double-bosse (décision du papa, §6.3) ; 1 = permis (pistes d'avant) |
| `VOLCANO_WEIGHT` | 4 | poids de tirage d'un volcan (plat 2, bosses 3, rampe-saut 2, double-bosse 2) ; 3 jusqu'au tour 1 de la 5g et dans les pistes d'avant (décision du papa, §6.3) |
| `FOSSE_RESPAWN_AFTER` | 5 | m : 2e chute de suite, posée à bord aval + 5 (Q-F2, option B) |
| `FOSSE_GHOST_AFTER` | 40 | m : zone fantôme d'une fosse jusqu'à bord aval + 40 (atterrissage le plus long ≈ 32 m, plus une marge) |
| `FOSSE_SKILL_FACTOR` | 2,5 | tâche 6 (Q-F3) |

Réutilisées sans changement : `LANCEMENT_LENGTH` (approche), `CRATER_DEPTH` (fond), `LAVA_SENSOR_ABOVE_RIM` (capteur), `SAFE_LANCEMENT_MARGIN`, `RESPAWN_AFTER_VOLCANO_BACK` (tremplins).

**Pistes d'avant, au bit près.** `{ STAR_FLATS_PER_RACE: 0, FOSSE_PERIOD: 0, STAR_HIGH_PER_RACE: 0, STAR_STEP_MIN: 60, STAR_STEP_MAX: 100, STAR_TREMPLIN_LANDING: 0, TREMPLIN_AFTER_DOUBLE_BOSSE: 1, VOLCANO_WEIGHT: 3 }` redonne au bit près les pistes de e02dcae **sans étoiles hautes** (`PRE_5E_STARS`). C'est l'helper de test `ANCIENNES_PISTES`.
- Avec lui, l'empreinte figée, `PLAN_A_TRACE`, `PRE_5E_STARS` et les mesures de référence (phases, dosage, calibration) restent comparables.
- Le rattrapage mesuré sur ces pistes n'est qu'un **contrôle de non-régression** ; l'effet des plats étoile et des fosses se mesure sur `CONFIG`.
- Avec `CONFIG`, les pistes changent quatre fois : en fin de 5e (plats étoile), en 5g (fosses, dégagements de réception, pas [35, 58]), au tour 1 de la 5g (pas de tremplin juste après une double-bosse), puis au tour 2 (poids de tirage des volcans 4). Chaque fois, l'empreinte de Galahad seul est **recapturée par un ruling** (R-F10) consigné au registre (hash, commit, raison), jamais en silence.
- La tolérance de sol ne joue que sur une demande de saut : doigt posé sans saut, l'empreinte ne bouge pas.

### 6.10 Questions pour le papa

**Tranchées** (registre 10282e7, 0718977 et c73faf5), un seul calendrier, avant tout code :

| # | Question | Réponse |
|---|---|---|
| Q-F1 | Largeur des fosses | **8 m**, franchissable à doigt posé (§6.1, §6.2) |
| Q-F2 | Coût d'une fosse ratée deux fois | **option B** : posée juste après la fosse, ≈ 4,3 à 4,6 s perdues (A : ≈ 2 s en course) (§6.4) |
| Q-F3 | Les copains ratent-ils parfois une fosse ? | **oui**, erreur × 2,5, instant centré à chaque vitesse (§6.8) |
| Q-F4 | Combien d'étoiles hautes ? | **exactement 3** (§6.6) |
| Q-F5 | Aider Galahad à voir la fosse ? | **rien qui s'allume** pour le premier test, à rejuger (§6.7) |
| — | Saut après un décollage | **tolérance de sol de 0,35 s** (§1, §6.2) |
| Q-F6 | Tolérance de sol en turbo enchaîné (1 appui sur 250 perdu à 21 m/s tenus) | **0,35 s gardé**, à rejuger au test tablette (§6.2) |

**Reste à trancher** : rien.

**À savoir, sans question :**
- **Volcans** : à longueur constante, les plats étoile prennent ≈ 171 m. Une course a donc ≈ 3,6 volcans au lieu de 4,2 (≈ 1,8 fosses et 1,8 tremplins).
- **Alternance stricte** tremplin / fosse : jamais deux fosses de suite, et le type du volcan suivant est prévisible. Galahad peut l'apprendre ; c'est voulu (chaque piste a les deux).
- **Plat étoile de 57 m** au lieu des « ≈ 50 m » demandés : les 12 m d'entrée empêchent une voiture lancée en turbo par une bosse de prendre l'étoile sans sauter (§6.6).
- **Voitures catapultées** : une voiture projetée par un choc peut prendre une étoile haute sans sauter. C'est toléré dans les 2 s qui suivent un choc, ou pendant le vol qui suit ce choc (décision du papa, tâche 6), et compté ; pour Galahad aussi depuis le tour 2 de la 5g (décision du papa, R-F12 amendé).
- **Copains qui ratent une fosse** (décision du papa, tour 2 de la tâche 6) : ils sautent toujours ; un raté trop tardif devient un saut trop tôt, si bien que le copain vole ≈ 1,9 s avant de retomber dans la lave. Pour une très grosse erreur (≈ 0,3 % des tentatives de Pablo), il retombe 1,4 à 3,8 m avant le bord puis roule dans la lave : la chute se voit aussi. Fonceurs ≈ 1 fosse sur 5 ratée, prudents jamais (§6.8).
- **À doigt posé seulement** : sous ≈ 6 m/s, une fosse ne se passe pas. Doigt levé ≈ 2,5 s avant la lave, l'enfant tombe une fois, puis repart du point sûr et passe (§6.1).
- **Tremplins et tolérance de sol** : un saut au sommet d'un tremplin, même pendant la tolérance, atterrit toujours sur la réception. Aucune parade n'est nécessaire (§6.2).
- **Super saut après une bosse** (MESURÉ (relecture), 727 sauts dans la tolérance juste après des bosses ou une double-bosse, à 14, 17,5 et 21 m/s). Avec la tolérance, on peut sauter juste après avoir décollé d'une bosse : le saut monte alors 2,5 m au-dessus du vol de la bosse et porte plus loin.
  - Il retombe au plus 65 m après la bosse, donc toujours avant `xEnd − 10` d'une fosse qui suivrait (115 m après son début).
  - À 14 m/s, il n'attrape qu'une fois l'étoile haute d'un plat étoile qui suit. En turbo, il l'attrape 134 fois sur 727.
  - 40 de ces sauts retombent dans la lave d'une fosse qui suit.
  - Ce sont de vrais sauts : l'enfant a appuyé, et un saut mal placé se paie (§0). Doigt posé sans saut, rien ne change : la promesse tient.
