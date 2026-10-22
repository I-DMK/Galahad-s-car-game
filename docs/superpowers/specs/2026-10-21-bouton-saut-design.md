# Course Lunaire de Galahad — addendum « bouton saut et étoiles pour tous »

Date : 2026-10-21
Statut : **VALIDÉ par le papa** le 2026-10-21 (design approuvé section par section, puis document relu et approuvé).
Amendé [plan] le 2026-10-22 (tâche 5e, Step 1) avec les décisions du papa sur le plan 5e/6 (registre 567ee13) : Q-P1 (b) étoiles hautes **en plus** des étoiles du curseur ; Q-P2 mémoire de la demande de saut de 0,1 s ; Q-P3 **même hauteur partout**. Les passages amendés sont marqués « [plan] » ; le plan `docs/superpowers/plans/2026-10-21-plan-b-saut-et-rendu.md` (tâche 5e) en donne le détail.
Amendé [fosses] le 2026-10-22 avec les décisions du papa au Step 9 de la tâche 5e (registre e02dcae) : `STAR_HIGH_Y` = 3,90 m ; au moins 3 étoiles hautes par course, sur des **plats étoile** posés par le générateur ; **fosses de lave** sans tremplin, environ 1 volcan sur 2 ; promesse changée. Les passages amendés sont marqués « [fosses] » ; le détail, les mesures et les questions ouvertes sont au §6. **À relire (standard, adversariale, `code-review`) et à faire valider par le papa avant tout code.**
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
  - un saut bien placé passe toujours une fosse, y compris depuis un départ arrêté au point sûr (fenêtre d'au moins 0,4 s, §6.2).
- Une course n'est plus jouée d'avance par la première étoile.
- [fosses] Au moins 3 étoiles hautes par course, chacune sur son plat étoile (§6.6).

Hors périmètre (reste au plan C) : obstacles sur la piste, météorites, saut dosé.

## 1. Bouton et saut (décisions : bouton en bas à gauche, force fixe, impulsion physique)

- **Bouton** : rond, diamètre ≥ 140 px CSS, en bas à gauche, icône de ressort. Il porte `data-no-pedal` : son `pointerdown` n'est jamais compté comme du gaz. Le gaz reste « un doigt n'importe où ailleurs » ; les deux fonctionnent en même temps (multi-touch). Sur ordinateur, la barre d'espace fait la même chose (développement et e2e).
- **Déclenchement sur front** : chaque appui (`pointerdown` sur le bouton, ou `keydown` Espace non répété) dépose une demande de saut, prise au pas de physique suivant. Garder le doigt sur le bouton ne relance pas de saut.
- **Mémoire de la demande** [plan] (décision Q-P2) : une demande qui ne peut pas être servie tout de suite (voiture en l'air, délai pas écoulé) **reste valable `JUMP_BUFFER` = 0,1 s**. Un appui un peu trop tôt, juste avant de retoucher le sol, donne donc un saut au premier pas au sol ; au-delà de 0,1 s, la demande est oubliée.
- **Conditions** :
  - au moins une roue au contact du sol (contact de jeu débouncé) ;
  - au moins `JUMP_COOLDOWN` (0,5 s) depuis le dernier saut de cette voiture ;
  - course en cours (ni décompte, ni pause, ni après l'arrivée).

  Sinon, la demande attend au plus `JUMP_BUFFER`, puis elle est ignorée [plan]. Le bouton est grisé pendant le délai et tant que Galahad est en l'air.
- **Physique (approche A)** : une vitesse verticale (m/s, vers le haut du monde) est posée sur toutes les pièces de la voiture : châssis et roues. Sa valeur se calcule à partir de la gravité du jeu pour un apogée du châssis d'environ 2,5 m (`JUMP_APEX`) au-dessus de sa hauteur de roulage à l'arrêt, vérifiée à ± 10 % en test. Lancée, la voiture garde sa vitesse horizontale, donc le bond porte plus loin. Le vol, le contrôle d'assiette en l'air, l'atterrissage, les retournements, la lave et les respawns sont ceux d'aujourd'hui : **la physique décide** du prix d'un saut raté.
- **Même hauteur partout** [plan] (décision Q-P3, remplace « s'ajoute ») : avec vy0 la vitesse verticale du châssis vers le haut au moment du saut et g la gravité du jeu,
  - si vy0 > 0 (voiture qui monte, par exemple sur une rampe) : vy = √(vy0² + 2·g·`JUMP_APEX`). L'apogée monte de `JUMP_APEX` au-dessus du vol que la voiture aurait eu sans saut, quelle que soit la pente ;
  - sinon (plat, ou voiture qui descend) : vy = `JUMP_VY` = √(2·g·`JUMP_APEX`) ≈ 4,95 m/s, apogée ≈ `JUMP_APEX` au-dessus du point de départ.

  La vitesse horizontale de chaque pièce ne change pas. « S'ajoute » (vy0 + `JUMP_VY`) aurait donné ≈ 12 m d'apogée au milieu d'un tremplin. À dire au papa : au milieu d'une rampe-saut, le gain **ressenti** n'est que d'environ 1,5 m (2,5 − Δy·cos²θ, Δy étant la montée de rampe qui restait), parce que la voiture sans saut aurait de toute façon décollé du tremplin.
- **Un seul chemin** : Galahad et les copains sautent par la même fonction (`applyJump(car, cfg)` dans `physics/car.ts`, sans déplacement de corps dans un callback de collision). `stepRace(sim, galahadThrottle, galahadJump)` reçoit la demande de Galahad ; le `Driver` des robots renvoie `{ throttle, jump }` (tâche 6). L'événement `'jump'` (`carId`) sert à la poussière et, plus tard, au son.
- Nouveaux paramètres dans `config.ts` : `JUMP_VY`, `JUMP_COOLDOWN`, `JUMP_BUTTON_SIZE_PX` (nombres) ; [plan] `GRAVITY` (constante locale réutilisée), `JUMP_APEX` (2,5 m, `JUMP_VY` en est dérivée) et `JUMP_BUFFER` (0,1 s).

## 2. Étoiles pour tous et étoiles en hauteur

- **Étoiles pour tous** : l'état d'une étoile est tenu **par voiture**. Une voiture qui prend une étoile la rend inactive pour elle seule, jusqu'à `STAR_RESPAWN_SECONDS`, et active son turbo. Pour les autres, l'étoile reste prenable. Les capteurs restent actifs ; la décision « prise ou non » se fait voiture par voiture dans `collectStars`. **À l'écran, on dessine l'état vu par Galahad** : une étoile prise par un copain reste visible.
- **Étoiles hautes** [plan] (décision Q-P1 (b), remplace « environ 1 étoile du curseur sur 3 est surélevée ») :
  - Elles sont **ajoutées** aux étoiles du curseur, qui ne changent pas. À la génération (`placeStars`, rng de la piste, déterministe pour ENCORE), leurs tirages viennent **après** tous les autres ; avec `STAR_HIGH_PER_RACE` = 0, les étoiles sont celles d'avant, au bit près.
  - Nombre : **au plus `STAR_HIGH_PER_RACE`** par course, réaliste **≈ 1 par course**, et certaines pistes n'en ont aucune. Les plats ne mesurent que 20 à 40 m, et un saut vole ≈ 28 m à 14 m/s. Le nombre est mesuré, puis validé par le papa sur le tableau de calibration.
    [fosses] Remplacé par la décision du 2026-10-22 : **au moins 3 par course**, une sur chacun des 3 **plats étoile** que le générateur pose (§6.6). `STAR_HIGH_PER_RACE` devient le plafond total (3 recommandé, question Q-F4) ; les étoiles des plats étoile passent toujours en premier.
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
  - au sol seulement ;
  - délai respecté ;
  - un saut par appui ;
  - apogée 2,5 m ± 10 % à l'arrêt ;
  - [plan] apogée sur une pente (milieu d'une rampe-saut à 14 m/s) : 2,5 m ± 10 % au-dessus du vol sans saut (max(y) − y0 − vy0²/(2g)), très en dessous de « s'ajoute » ; en descente (vy0 < 0) : 2,5 m ± 10 % au-dessus du point de départ ; vitesse horizontale gardée ;
  - [plan] mémoire de 0,1 s : une demande 0,05 s avant le contact donne un saut au premier pas au sol, une demande 0,15 s avant n'en donne aucun ;
  - aucune trace de gaz par le bouton ;
  - déterminisme.
- **e2e** : tap sur le bouton → événement `'jump'`, sans gaz ; doigt de gaz + tap simultanés → la voiture avance et saute.
- **Étoiles hautes** :
  - doigt posé sans saut, turbo compris : 0 étoile haute prise ; [fosses] pour Galahad, sans exception ; pour un copain, une prise sans saut n'est tolérée que dans les 2 s qui suivent un choc entre voitures (copain « catapulté », mesuré à la 5e : 4 courses sur 24), comptée et imprimée ; une prise sans saut et sans choc est un échec ;
  - pour chaque étoile haute (graines 0 à 9), il existe une fenêtre d'au moins 0,3 s de décollage qui la prend sans respawn ; [fosses] sur un plat étoile : au moins **0,4 s** à 11,2 et à 14 m/s, et au moins 0,3 s à `STAR_HIGH_Y` + 5 cm ;
  - aucune sur un plat de lancement ; [fosses] aucune dans une tranche `fosse` ;
  - [plan] nombre, remplace « environ 1 sur 3 » : 0 ≤ n ≤ `STAR_HIGH_PER_RACE` par course ; sur les graines 0 à 49, moyenne et nombre minimal de pistes avec au moins une étoile haute, seuils fixés à partir de la distribution mesurée et validés par le papa (cible réaliste ≈ 1 par course) ;
    [fosses] remplacé : **exactement `STAR_FLATS_PER_RACE` = 3 plats étoile et au moins 3 étoiles hautes par piste de 1 680 m**, graines 0 à 49 (et à 6 000 m, graines 0 à 19) ; chaque plat étoile porte la sienne ; n ≤ `STAR_HIGH_PER_RACE` ;
  - [plan] étoiles basses (x, y, nombre) identiques à celles de `STAR_HIGH_PER_RACE` = 0. [fosses] Toujours vrai à pistes égales : les plats étoile font partie du terrain, les tirages des étoiles hautes restent les derniers.
- **Volcans** (à tremplin) :
  - doigt posé sans saut : 0 chute (invariants de la tâche 5c gardés, graines 0 à 23 à 5 voitures) ; [fosses] 0 chute **aux volcans à tremplin** ;
  - un saut mal placé dans l'élan ou sur la rampe peut faire tomber : mesuré, pour vérifier que le risque existe.
- [fosses] **Fosses** (§6.2 à §6.5) :
  - (a) doigt posé sans saut, de 3 à 30 m/s et en turbo, depuis n'importe quelle tranche précédente : la voiture tombe, à 100 % (jamais de survol) ;
  - (b) lancée à 11,2 et à 14 m/s : fenêtre de saut d'au moins 0,4 s, d'un seul tenant, sans respawn dans les 3 s après l'atterrissage ;
  - (c) départ arrêté au pire point sûr (`xLancement + 5 − ε`), doigt posé : fenêtre d'au moins 0,4 s ;
  - (d) turbo (21 m/s) : tout saut qui passe atterrit avant `xEnd − 10` ;
  - course doigt posé sans saut (Galahad seul et à 5 voitures, graines 0 à 23) : exactement 2 chutes par fosse, 0 au tremplin, toutes dans une fosse, arrivée avant 240 s ;
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

Conventions des chiffres :
- **MESURÉ** : sonde jetable `tests/zz-probe-*` (supprimée), Galahad seul, vrai `stepRace` (contact débouncé, saut, capteurs, respawns), monde rogné, vitesse tenue doigt posé par le facteur de la voiture comme dans `jumpRun`. Les tâches 5e et 5g refont ces mesures en tests.
- **CALCULÉ** : formule, ou prototype statique du générateur (même `rng`, mêmes profils, sans physique ; vérifié identique à `generateTrack` sans fosse ni plat étoile sur les graines 0 à 49).
- Vocabulaire : un **volcan** est soit un **tremplin** (la `rampe-volcan` d'aujourd'hui), soit une **fosse**. W = `FOSSE_WIDTH`, largeur de lave. s = distance du châssis au bord amont de la fosse au moment du saut.

### 6.1 Promesse (amende §0, l'addendum plan B §1.2 et la tâche 5c)

| Situation, doigt posé | Volcan à tremplin | Fosse |
|---|---|---|
| sans jamais sauter | passe, jamais de chute (promesse 5c inchangée) | tombe, à coup sûr (§6.2 (a)) ; respawn au point sûr d'avant ; 2e chute de suite → posée de l'autre côté ; on finit la course |
| saut bien placé | (sans objet : le saut n'est pas nécessaire) | passe, sans respawn (§6.2 (b) à (d)) |
| saut mal placé | peut tomber (mesuré en fin de 5e, `saut-volcan`) | tombe : trop tard, la roue avant touche la lave ; trop tôt, la voiture retombe dans la fosse |

Ce qui ne change pas : on finit toujours la course ; aucune autre tranche ne fait tomber ; la règle « 2e chute de suite au même volcan » ne compte que les chutes dans la lave (ruling de la tâche 3).

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

**Mesures (MESURÉ)**, fosse de W m sur une piste plate, saut demandé à chaque pas, « passe » = aucune lave et aucun respawn jusqu'à 3 s après l'atterrissage :

| W (m) | lancée 8 m/s | 11,2 m/s | 14 m/s | 21 m/s | départ arrêté au pire point sûr (c) | turbo pris 40 m avant le bord (d) |
|---|---|---|---|---|---|---|
| 3 | 1,28 s | 1,47 s | 1,55 s | 1,75 s * | 1,17 s | 1,50 s * |
| 6 | 0,92 s | 1,22 s | 1,33 s | 1,68 s * | 1,00 s | 1,30 s * |
| **8** | **0,67 s** | **1,02 s** | **1,20 s** | **1,48 s** * | **0,87 s** | **1,18 s** * |
| 10 | 0,42 s | 0,83 s | 1,05 s | 1,33 s | 0,75 s | 1,10 s * |
| 12 | 0,17 s | 0,65 s | 0,92 s | 1,23 s | 0,70 s | 1,05 s |

\* fenêtre en deux morceaux : un saut 35 à 54 m trop tôt retombe avant la fosse et le rebond de l'atterrissage la franchit. Accepté : l'enfant a sauté.

Détail pour W = 8 (MESURÉ) :
- 11,2 m/s : s ∈ [1,62 ; 12,78] m, atterrissage 1,7 à 12,7 m après le bord aval ;
- 14 m/s : s ∈ [1,69 ; 18,18] m, soit 0,12 à 1,30 s avant le bord (centre 0,71 s), atterrissage 1,7 à 18,2 m après ;
- départ arrêté en `xLancement + 4,99` : vitesse au saut ≈ 12,3 m/s, s ∈ [1,77 ; 12,61] m, atterrissage 2,0 à 17,3 m après ;
- turbo : atterrissage jusqu'à 30,8 m après le bord aval (31,6 m à 21 m/s tenus) ; copains sous élastique et turbo (27,3 m/s, tâche 7) : ≈ 44 m (CALCULÉ). La réception de 64,8 m les absorbe tous.

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
- **(d) en turbo, le saut retombe sur la réception** : au plus 31,6 m après le bord aval, pour une réception de 64,8 m, soit avant `xEnd − 10` = bord aval + 54,8 m.

**Ce que voit l'enfant** (CALCULÉ, vue 1 280 × 800, `VISIBLE_HEIGHT_M` 14, avance de caméra 0,6 s) : la piste est visible jusqu'à 11,2 m + 0,6 s × v devant la voiture, soit 19,6 m à 14 m/s. La fosse apparaît donc ≈ 1,4 s avant le bord. Pour W = 8, la fenêtre s'ouvre ≈ 0,1 s après son apparition à 14 m/s. À 11,2 m/s, sauter dès qu'elle apparaît est trop tôt pendant ≈ 0,46 s : « attendre un peu » fait partie du défi. Le panneau (§6.7) prévient ≈ 3,7 s avant le bord.

### 6.3 Combien de fosses, et où (`generate`)

- **1 volcan sur 2** : `FOSSE_PERIOD` = 2. Les volcans de la piste, dans l'ordre, alternent tremplin et fosse ; la phase (le premier est un tremplin ou une fosse) est tirée une fois par piste dans un `mulberry32` dédié, dérivé de la graine de piste (`(seed ^ 0x6a09e667) >>> 0`). Le `rng` principal n'est pas touché. `FOSSE_PERIOD` = 0 : aucune fosse, pistes d'avant.
  - Pourquoi l'alternance plutôt qu'un pile ou face par volcan : chaque piste a au moins une fosse et un tremplin dès qu'elle a 2 volcans, et jamais 2 fosses de suite. Avec un tirage indépendant, ≈ 1 piste sur 10 n'aurait aucune fosse (CALCULÉ : 0,5^3,6 avec 3,6 volcans par course).
- **Même tirage que le tremplin.** Une fosse est un `'rampe-volcan'` tiré par les poids d'aujourd'hui (3), avec les mêmes refus, puis typé fosse par l'alternance. Elle a la même longueur : la suite des tranches tirées, leurs longueurs et leurs places sont celles d'aujourd'hui.
- **Refus d'un volcan, quel qu'il soit** (règles d'aujourd'hui, étendues aux fosses) :
  - hors de [15 %, 90 %] de la longueur cible ;
  - juste après un autre volcan (tremplin ou fosse) ;
  - juste après une **rampe-saut** (option (a) de la tâche 1 ; pour une fosse, c'est aussi la contrainte (a) : vol de 61 m à 21 m/s) ;
  - ces refus regardent la **dernière tranche tirée**, pas un plat étoile intercalé (§6.6) : sans cela, un plat étoile posé entre une rampe-saut et un volcan changerait les tirages suivants.
- **Bosses et double-bosses avant une fosse** : permises. Le plat de garde de 20 m absorbe leur vol en turbo (§6.2 (a), mesuré). Pas de refus de plus, donc pas de tirage de plus.
- **Effet sur les pistes** (CALCULÉ, prototype, graines 0 à 49, 1 680 m, avec les 3 plats étoile du §6.6) :
  - volcans par course : 4,22 (2 à 6) aujourd'hui → **3,62 (2 à 5)**, dont 1,82 fosses (1 à 3) et 1,80 tremplins (1 à 3). Graines 0 à 19 : 3,70 (2 à 5). La baisse vient des 171 m de plats étoile, pris sur la fin de piste à longueur constante ;
  - tranches avant une fosse : bosses 37, double-bosse 26, plat 24, plat étoile 4 (91 fosses) ;
  - le test « 3 à 7 volcans par piste, graines 0 à 19 » devient « 2 à 7 volcans, dont au moins 1 fosse et au moins 1 tremplin dès 2 volcans ». Levier si le papa veut plus de volcans : le poids de tirage (3 → 4 donne 4,08, CALCULÉ), au prix d'un terrain plus changé. À dire au papa, sans question.

### 6.4 Points sûrs, respawn, fantômes

- **Zone interdite aux points sûrs** : `forbiddenZone(v)` = [`xLancement + SAFE_LANCEMENT_MARGIN`, `xReception`) pour les deux types, sans changement de formule. Pour une fosse : de 5 m après le début de l'approche jusqu'au bord aval. Le plat de garde accepte les points sûrs.
- **1re chute** : respawn au point sûr, à l'arrêt. Le pire point sûr laisse `D_LANCE` de plat : (c) donne une fenêtre de 0,87 s (W = 8). Le retour au bord prend ≈ 4 s (CALCULÉ : ≈ 33 m depuis l'arrêt).
- **Série** : `chooseRespawnTarget` est inchangé ; `volcanoAhead` trouve aussi les fosses (champ `xLava`). Seules les chutes dans la lave comptent ; toute autre raison remet la série à zéro (ruling de la tâche 3).
- **2e chute de suite** : la voiture est posée de l'autre côté, à l'arrêt, au sol local.
  - **Règle d'aujourd'hui (option A)** : `xEnd − RESPAWN_AFTER_VOLCANO_BACK`, soit bord aval + 54,8 m pour W = 8, au-delà de toute zone d'atterrissage (31,6 m). **Coût d'une fosse ratée deux fois ≈ 1,05 s** seulement (MESURÉ : temps jusqu'à bord aval + 120 m, Galahad doigt posé sans saut contre saut au centre de la fenêtre). Ne pas sauter ne coûte presque rien en temps : la chute se voit, mais la course ne la paie pas.
  - **Option B (recommandée, question Q-F2)** : posée à **bord aval + 5 m** (`FOSSE_RESPAWN_AFTER`) ; coût ≈ 4,7 s (MESURÉ : 4,77 s à + 3 m, 3,55 s à + 20 m, 1,75 s à + 45 m). La voiture est alors posée dans la zone d'atterrissage des autres. Il faut donc deux règles de plus :
    - la zone fantôme d'une fosse va jusqu'à bord aval + `FOSSE_GHOST_AFTER` (40 m ≥ 1,2 × 31,6 m) ;
    - le respawn groupé de cette cible **avance** de 1,5 × `CAR_LENGTH` par voiture déjà posée, au lieu de reculer (reculer la ramènerait vers la lave).
- **Respawn groupé** au point sûr : inchangé (`shiftTarget` recule, hors zone interdite et hors cratère).
- **Fantômes** : `inGhostZone` vaut pour les deux types, châssis dans [`xLancement`, `xReception` + `WHEEL_BASE/2` + `WHEEL_RADIUS`]. Pour une fosse : de l'approche jusqu'à la roue arrière passée au-delà du bord aval (option B : jusqu'à bord aval + 40 m). Une voiture qui repart arrêtée du point sûr, ou qui saute, est traversée par les voitures lancées.
- **Respawn immédiat d'une voiture retournée** (`inElanZone`, [`xElanStart`, `xLip`]) : tremplins seuls. Sur l'approche plate d'une fosse, les délais `FLIP_SECONDS` / `SIDE_SECONDS` d'aujourd'hui s'appliquent.
- **Robots polis et lever de pied** : la zone volcan [`xLancement`, `xLava`] vaut pour les deux types (gaz toujours, jamais de politesse).

### 6.5 Étoiles près des fosses (tranché)

- **Pas d'étoile basse sur le plat de garde, l'approche ni la fosse.** Pour le curseur, la zone admissible d'une tranche `fosse` est sa seule réception [`xReception`, `xEnd`]. Motif : un turbo pris pendant l'approche change la vitesse pendant que l'enfant choisit son instant, et, après une chute, l'étoile serait reprise à chaque nouvel essai.
- **Pas d'étoile d'élan pour une fosse.** À la place, une **étoile de réception** à `xReception + FOSSE_STAR_AFTER` (25 m, juste après la zone d'atterrissage à 14 m/s), tirée 1 fosse sur 2 comme l'étoile d'élan. Le plancher de 6 ajoute, dans l'ordre de la piste, l'étoile d'élan d'un tremplin ou l'étoile de réception d'une fosse.
  - C'est une **récompense du saut réussi** : une voiture posée de l'autre côté après deux chutes repart au-delà (option A, + 54,8 m) et ne la prend pas. Avec l'option B (+ 5 m), elle la prend : la récompense ne distingue plus, et c'est le temps perdu qui compte.
- **Pas d'étoile haute dans une tranche `fosse`**, ni au-dessus de la lave. `highStarTerrain` traite une fosse comme une `rampe-volcan` : ni étoile, ni élan, ni atterrissage d'un saut d'étoile.
  - Motif : à 3,90 m, une étoile au-dessus d'une fosse demande un saut à la fois parfait pour l'étoile (0,57 s) et pour la fosse. Rater l'un, c'est la lave. Elle pourrait servir de guide visuel « saute ici » : à proposer au plan C, après le test tablette.
- **Pas d'étoile haute juste avant une fosse** : le plat étoile qui précède une fosse finit par ses 25 m d'atterrissage, et la fosse commence par 20 m de garde. Un saut d'étoile retombe donc avant l'approche (atterrissage au plus 27 m après l'étoile, en turbo).
- **Nombre d'étoiles basses** (CALCULÉ, prototype, graines 0 à 49) : avec les fosses et les plats étoile, au pas actuel [60, 100], 7,06 en moyenne (4 à 10, 4 pistes sous le plancher de 6). Avec l'étoile de réception et le pas [50, 85] : **9,10 (6 à 13)**, contre 9,24 (6 à 13) aujourd'hui. Le pas est donc ajusté (règle de l'addendum plan B §1.5 : le pas bouge, la cible 8–12 et le test 6–14 restent), d'abord à [55, 90] en fin de 5e (plats étoile seuls : 8,74, 6 à 13), puis à [50, 85] en 5g. Les valeurs finales sont celles que mesurent les vrais tests.

### 6.6 Plats étoile

- **Nouvelle tranche `'plat-étoile'`** (`SliceType`) : un plat de **`STAR_FLAT_LENGTH` = 57 m**, l'étoile haute à **32 m** de son début, à sol + `STAR_HIGH_Y` = 3,90 m.
  - 57 m = 12 m de dégagement d'entrée (`STAR_HIGH_BUMP_CLEARANCE`) + 20 m d'élan (`STAR_HIGH_TAKEOFF_ROOM`) + 25 m d'atterrissage (`STAR_HIGH_LANDING_ROOM`). Constante dérivée, déclarée avant le littéral de `config.ts`.
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

  L'étoile est à 32 m du début du plat étoile : au-delà de la portée des bosses et des double-bosses en turbo (marge ≥ 10 m), mais pas de celle d'une rampe-saut. D'où la règle d'insertion ci-dessous. Copains sous élastique et turbo (27,3 m/s, tâche 7) : 44 à 79 m de portée ; à mesurer en tâche 7 avec la règle des copains catapultés (§4).
- **Insertion par le générateur** (tranches posées sans `rng`) :
  - N = min(`STAR_FLATS_PER_RACE`, ⌊(limite − x0) / `STAR_FLAT_SPACING`⌋), avec x0 la fin du plat de départ, limite = cible − `FINISH_PLAT_BEFORE` − `AFTER_FINISH`, `STAR_FLATS_PER_RACE` = 3 et `STAR_FLAT_SPACING` = 400 m. Soit 3 à 1 680 m et à 6 000 m, 1 à 600 m, 0 à 300 m.
  - Ancres a_k = x0 + (k + ½) × (limite − x0) / N, k = 0 … N − 1 (CALCULÉ à 1 680 m : plats étoile vers 300, 850 et 1 350 m).
  - Avant chaque tirage, si x ≥ a_k, si la dernière tranche tirée n'est pas une **rampe-saut** et si le plat étoile tient avant la limite, il est posé et k avance. Sinon, on tire normalement et on réessaie à la frontière suivante. S'il ne tient plus, les plats étoile restants sont abandonnés : pistes courtes seulement, testé à 1 680 m et 6 000 m.
  - Aucun `rng` consommé, refus des volcans sur la dernière tranche tirée (§6.3) : la suite des tranches tirées est celle d'aujourd'hui. La piste ne perd que ses dernières tranches, ≈ 171 m (CALCULÉ : tête identique sur 25 à 38 tranches, 31,8 en moyenne).
  - Voisins (CALCULÉ, 150 plats étoile) : avant, un volcan 59 fois, des bosses 56, un plat 20, une double-bosse 15 ; jamais une rampe-saut. Après : toute tranche (une fosse commence par sa garde, un tremplin par son plat de lancement).
- **Pas de fusion.** Un plat étoile n'est pas fusionné avec ses voisins : son étoile a une place fixe, sa longueur suffit seule. Pour une étoile haute sur un plat ordinaire (si le plafond le permet), il compte comme terrain permis (élan, atterrissage), mais pas comme segment. Les plats ordinaires gardent la règle de la 5e (voisins fusionnés, dégagements, terrain permis).
- **Pas d'étoile basse sur un plat étoile** : pas une zone admissible du curseur. Une étoile basse dans l'élan donnerait un turbo juste avant le saut, et elle pourrait gêner `STAR_HIGH_GAP`.
- **Choix des étoiles hautes** : d'abord une par plat étoile, toujours. Ensuite, s'il reste de la place sous `STAR_HIGH_PER_RACE`, les candidates des plats ordinaires (règle de la 5e) sont tirées par le `rng` de piste, après tous les autres tirages, sans remise. Elles restent à au moins 45 m (élan + atterrissage) de l'étoile d'un plat étoile.
  - `STAR_HIGH_PER_RACE` = 3 (recommandé, Q-F4) : seulement les 3 des plats étoile.
  - Jeu de la 5e retenu pour les plats ordinaires : dégagements **50 m après une rampe-saut, 12 m après des bosses, une double-bosse ou un cratère ; élan 20 m ; atterrissage 25 m**. C'est le plus permissif des 4 jeux qui donnent 0 prise sans saut à 3,90 m, à 5 voitures, graines 0 à 23 (calibration de la 5e, MESURÉ ; 50/12/15/15 et 70/12/15/15 laissaient des copains catapultés prendre une étoile, graines 17 et 20).
- **Copains catapultés** : la règle du §4 s'applique, car les plats étoile sont hors des zones fantômes. Galahad : 0 prise sans saut, sans exception. Copain : une prise sans saut n'est tolérée que dans les 2 s après un choc entre voitures ; elle est comptée. Les robots polis (tâche 6) devraient faire baisser ces chocs : mesuré en tâche 6.
- **Tests** : exactement 3 plats étoile et 3 étoiles hautes par piste de 1 680 m (graines 0 à 49) ; pour chaque étoile de plat étoile des graines 0 à 9, fenêtre ≥ 0,4 s à 11,2 et 14 m/s, ≥ 0,3 s à + 5 cm ; 0 prise sans saut (Galahad seul, turbo forcé ; 5 voitures, graines 0 à 23). Avec `STAR_FLATS_PER_RACE` = 0 et `FOSSE_PERIOD` = 0 (et `STAR_HIGH_PER_RACE` = 0, pas [60, 100]), pistes et étoiles identiques au bit près à celles d'aujourd'hui.

### 6.7 Rendu : comment l'enfant voit une fosse

- **Lave à ras bord.** La fosse est remplie : surface de lave à 0,1 m sous le sol, orange vif, bulles (les bulles de `effects.ts` valent telles quelles, `rimY` = 0). Des **langues de feu** animées montent jusqu'à 0,3 m au-dessus du sol, la hauteur du capteur. Une roue qui touche la lave touche donc du feu dessiné : la reprise ne paraît pas injuste. Pour le tremplin, la bande invisible de 0,45 m relevée en tâche 1 ne change pas.
- **Halo.** Lueur orange au-dessus de la fosse, jusqu'à ≈ 3 m, qui pulse au temps de simulation. Visible dès que la fosse entre dans l'écran, ≈ 1,4 s avant le bord à 14 m/s.
- **Panneau.** Un poteau et un triangle jaune portant **le ressort du bouton saut**, planté au début de l'approche (`xLancement`, 32 m avant le bord). Il est visible ≈ 3,7 s avant le bord à 14 m/s (CALCULÉ). Le même dessin que le bouton relie le panneau au geste. Pas de panneau devant un tremplin : il suffit d'y garder le doigt.
- **Plots** : pas de plot lumineux au-dessus de la lave (règle d'aujourd'hui, `lavaWidth` compris).
- **Plat étoile** : rien de plus que l'étoile haute. Elle est visible ≈ 1,4 s avant (19,6 m), et la fenêtre s'ouvre ≈ 1,3 s avant l'étoile : l'enfant la voit à temps.
- **Aide en option (Q-F5)** : le bouton saut pulse quand une fosse approche (de l'apparition de la fosse au bord). Non recommandé pour le premier test.
- **Captures** : `e2e/screenshots/fosse.png` (fosse, halo et panneau à l'écran) et `plat-etoile.png`.

### 6.8 Copains (tâche 6)

- **Ils sautent toutes les fosses** : pas de tirage `jumpTry`, ne pas sauter serait tomber à coup sûr.
- **Instant** : le copain saute quand (`xBord − x`) / max(v, 1) ≤ `FOSSE_JUMP_LEAD` + e, avec `FOSSE_JUMP_LEAD` = **0,65 s**, centre mesuré de la fenêtre (0,58 s au départ arrêté, 0,64 s à 11,2 m/s, 0,71 s à 14 m/s, W = 8). L'erreur e suit N(0, σ_f) avec σ_f = `FOSSE_SKILL_FACTOR` × `jumpSkill`, les traits validés. Deux erreurs sont pré-tirées par fosse à la création du driver, une par tentative, par la graine du driver : ENCORE rejoue les mêmes sauts.
- **Taux de raté attendus** (CALCULÉ, loi normale, demi-fenêtre de 0,59 s à 14 m/s, W = 8) :

  | `FOSSE_SKILL_FACTOR` | Pablo | Matthis | Diego | Malo | Timothé | Liam |
  |---|---|---|---|---|---|---|
  | 1 (traits tels quels) | 0,1 % | 0 % | 0 % | 0 % | 0 % | 0 % |
  | 2 | 10 % | 5 % | 0,3 % | 0,1 % | 0 % | 0 % |
  | **2,5** (recommandé, Q-F3) | **19 %** | **12 %** | **1,8 %** | **0,9 %** | 0 % | 0 % |
  | 3 | 28 % | 19 % | 5 % | 3 % | 0 % | 0 % |

  Avec les traits tels quels, les copains ne ratent jamais une fosse, alors que Galahad le peut. La fosse ne pèse alors que sur lui.
- **Quand un copain rate** : même règle que Galahad (§6.4) : lave, respawn au point sûr, 2e chute de suite → posé de l'autre côté. Fantôme près de la fosse, donc jamais de choc. Son 2e essai utilise la 2e erreur pré-tirée.
- **Limite de respawns** : « ≤ 3 respawns par robot et par course » (addendum §2) compte hors fosses ; aux fosses, au plus 2 par fosse, par construction. Tout dépassement est mesuré et montré au papa, jamais relâché en silence.
- **Garde de `stepRace`** : `inNoJumpZone` = [`xLancement`, `xReception`] d'un **tremplin**. Devant une fosse, le seul saut d'un copain est celui de la fosse : ni saut d'étoile, ni second saut entre `xLancement` et le bord aval + 5 m.
- **Étoiles hautes** : avec 3 étoiles hautes par course, le bras « Pablo » compte ≈ 4 × 48 × 3 × 0,8 ≈ 460 tentatives et le bras « Timothé » ≈ 170, au-dessus du seuil de 40 de la tâche 6.
- **Entre la 5g et la 6** (driver provisoire), les copains sautent chaque fosse **sans erreur**, à `FOSSE_JUMP_LEAD`. Les invariants à 5 voitures gardent ainsi un sens (« aucune chute propre ») avant la vraie conduite.

### 6.9 Constantes (`config.ts`) et interrupteurs

| Constante | Valeur | Rôle |
|---|---|---|
| `STAR_HIGH_Y` | 3,90 | choix du papa (5e) |
| `STAR_HIGH_TAKEOFF_ROOM`, `STAR_HIGH_LANDING_ROOM` | 20, 25 | élan, atterrissage (5e) |
| `STAR_HIGH_RAMP_CLEARANCE`, `STAR_HIGH_BUMP_CLEARANCE` | 50, 12 | dégagements (5e) |
| `STAR_HIGH_PER_RACE` | 3 | plafond total, plats étoile d'abord (Q-F4) |
| `STAR_FLATS_PER_RACE` | 3 | plats étoile par course ; 0 = aucun |
| `STAR_FLAT_LENGTH` | 57 (dérivée) | dégagement d'entrée + élan + atterrissage |
| `STAR_FLAT_SPACING` | 400 | m de piste par plat étoile (pistes courtes) |
| `STAR_STEP_MIN`, `STAR_STEP_MAX` | 55 / 90 (5e), puis 50 / 85 (5g) | pas du curseur, CALCULÉ, fixé par les vrais tests |
| `FOSSE_PERIOD` | 2 | 1 volcan sur 2 est une fosse ; 0 = aucune |
| `FOSSE_WIDTH` | 8 | m de lave (Q-F1) |
| `FOSSE_GUARD` | 20 | m de plat de garde avant l'approche |
| `FOSSE_STAR_AFTER` | 25 | m entre le bord aval et l'étoile de réception |
| `FOSSE_JUMP_LEAD` | 0,65 | s avant le bord : centre de la fenêtre |
| `FOSSE_RESPAWN_AFTER`, `FOSSE_GHOST_AFTER` | 5, 40 | option B seulement (Q-F2) |
| `FOSSE_SKILL_FACTOR` | 2,5 | tâche 6 (Q-F3) |

Réutilisées sans changement : `LANCEMENT_LENGTH` (approche), `CRATER_DEPTH` (fond), `LAVA_SENSOR_ABOVE_RIM` (capteur), `SAFE_LANCEMENT_MARGIN`, `RESPAWN_AFTER_VOLCANO_BACK`.

**Pistes d'avant, au bit près.** `{ STAR_FLATS_PER_RACE: 0, FOSSE_PERIOD: 0, STAR_HIGH_PER_RACE: 0, STAR_STEP_MIN: 60, STAR_STEP_MAX: 100 }` redonne les pistes et les étoiles d'aujourd'hui (HEAD e02dcae) au bit près. C'est l'helper de test `ANCIENNES_PISTES`. Grâce à lui, l'empreinte figée, `PLAN_A_TRACE`, `PRE_5E_STARS` et les mesures de référence (phases, dosage, calibration, rattrapage) restent comparables. Avec `CONFIG`, les pistes changent deux fois, en fin de 5e (plats étoile) puis en 5g (fosses). Chaque fois, l'empreinte de Galahad seul est **recapturée par un ruling** consigné au registre (hash, commit, raison), jamais en silence.

### 6.10 Questions ouvertes pour le papa

Réponses attendues avant la fin de la 5e (Q-F4), avant la 5g (Q-F1, Q-F2, Q-F5) et avant la tâche 6 (Q-F3). Chacune se règle par une constante ; tout se rejuge au test tablette.

- **Q-F1 — Largeur des fosses (la difficulté).** Plus la fosse est large, plus l'instant du saut doit être juste. Temps pour bien sauter à 11,2 m/s / à pleine vitesse (14 m/s) / en repartant après une chute : 6 m → 1,2 / 1,3 / 1,0 s ; **8 m → 1,0 / 1,2 / 0,9 s** ; 10 m → 0,8 / 1,05 / 0,75 s ; 12 m → 0,65 / 0,9 / 0,7 s. Pour comparer, une étoile haute laisse 0,6 s. **Recommandation : 8 m.** C'est deux fois plus facile qu'une étoile haute, parce que rater coûte une chute. À l'écran, la fosse fait un tiers de la largeur.
- **Q-F2 — Combien coûte une fosse ratée deux fois ?** Avec la règle d'aujourd'hui (posé en fin de réception, comme aux volcans), ne pas sauter ne fait perdre qu'**≈ 1 s** par fosse : on voit la chute, mais la course ne la paie presque pas. Posé juste après la fosse, on perd **≈ 4,7 s** (environ 65 m), et les copains qui sautent passent devant. **Recommandation : juste après la fosse (B).** Sinon, sauter ne sert presque à rien. Coût technique : deux petites règles pour que les voitures qui atterrissent traversent celle qui vient d'être posée.
- **Q-F3 — Les copains tombent-ils parfois dans les fosses ?** Avec les caractères validés, ils ne ratent jamais une fosse, alors que Galahad le peut. **Recommandation : oui, un peu.** Les fonceurs ratent ≈ 1 fosse sur 5 (Pablo) ou 1 sur 8 (Matthis), les moyens ≈ 1 sur 50 à 1 sur 100, les prudents jamais. Un seul réglage, sans toucher au tableau des caractères.
- **Q-F4 — Combien d'étoiles hautes ?** **Recommandation : exactement 3, une par plat étoile.** C'est prévisible pour Galahad (une au début, une au milieu, une vers la fin), et chaque étoile a sa fenêtre mesurée sur un plat. Possible : 3 + celles des plats ordinaires (≈ 1 de plus en moyenne, jusqu'à 5).
- **Q-F5 — Aider Galahad à voir la fosse ?** Panneau à ressort et lave visible sont prévus d'office. En plus, le bouton saut pourrait s'allumer à l'approche d'une fosse. **Recommandation : non pour le premier test.** On l'ajoute si Galahad oublie de sauter.

À savoir, sans question : à longueur constante, les plats étoile prennent ≈ 171 m. Une course a donc ≈ 3,6 volcans au lieu de 4,2 (≈ 1,8 fosses et 1,8 tremplins).
