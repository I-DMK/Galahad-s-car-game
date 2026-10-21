# Course Lunaire de Galahad — addendum « bouton saut et étoiles pour tous »

Date : 2026-10-21
Statut : **VALIDÉ par le papa** le 2026-10-21 (design approuvé section par section, puis document relu et approuvé).
Amende : le spec du 2026-10-20 et l'addendum plan B (`2026-10-21-plan-b-addendum.md`, §2 et §3.3). En cas de contradiction, ce document l'emporte sur les deux.

## 0. Origine et intention

Retour du test tablette à 5 voitures (version 0a78392) : « le premier qui prend une étoile, et donc la première place, est irrattrapable ». Le mécanisme est mesuré : toutes les voitures ont le même plafond de vitesse, et une étoile prise disparaît pour toutes. Le premier enchaîne donc les turbos (boule de neige).

Décisions du papa :
- **étoiles pour tous** ;
- **élastique gardé** (tâche 7) ;
- **bouton saut avancé du plan C**, voulu par Galahad : un saut mal placé fait mal retomber (mauvais versant de bosse, lave), et certaines étoiles sont en hauteur, il faut un bon saut pour les avoir. Le premier peut ainsi rater sa course malgré les étoiles.

Ce qui définit le succès :
- Galahad comprend le bouton seul.
- Un saut mal placé se voit et coûte quelque chose.
- Doigt posé sans jamais sauter, on finit toujours la course et on ne tombe jamais dans la lave (promesse de la tâche 5c, conservée).
- Une course n'est plus jouée d'avance par la première étoile.

Hors périmètre (reste au plan C) : obstacles sur la piste, météorites, saut dosé.

## 1. Bouton et saut (décisions : bouton en bas à gauche, force fixe, impulsion physique)

- **Bouton** : rond, diamètre ≥ 140 px CSS, en bas à gauche, icône de ressort. Il porte `data-no-pedal` : son `pointerdown` n'est jamais compté comme du gaz. Le gaz reste « un doigt n'importe où ailleurs » ; les deux fonctionnent en même temps (multi-touch). Sur ordinateur, la barre d'espace fait la même chose (développement et e2e).
- **Déclenchement sur front** : chaque appui (`pointerdown` sur le bouton, ou `keydown` Espace non répété) dépose une demande de saut, consommée au pas de physique suivant. Garder le doigt sur le bouton ne relance pas de saut.
- **Conditions** :
  - au moins une roue au contact du sol (contact de jeu débouncé) ;
  - au moins `JUMP_COOLDOWN` (0,5 s) depuis le dernier saut de cette voiture ;
  - course en cours (ni décompte, ni pause, ni après l'arrivée).

  Sinon, la demande est ignorée. Le bouton est grisé pendant le délai et tant que Galahad est en l'air.
- **Physique (approche A)** : une vitesse verticale `JUMP_VY` (m/s, vers le haut du monde) s'ajoute à toutes les pièces de la voiture : châssis et roues. Sa valeur se calcule à partir de la gravité du jeu pour un apogée du châssis d'environ 2,5 m au-dessus de sa hauteur de roulage à l'arrêt, vérifiée à ± 10 % en test. Lancée, la voiture garde sa vitesse horizontale, donc le bond porte plus loin. Le vol, le contrôle d'assiette en l'air, l'atterrissage, les retournements, la lave et les respawns sont ceux d'aujourd'hui : **la physique décide** du prix d'un saut raté.
- **Un seul chemin** : Galahad et les copains sautent par la même fonction (`applyJump(car, cfg)` dans `physics/car.ts`, sans déplacement de corps dans un callback de collision). `stepRace(sim, galahadThrottle, galahadJump)` reçoit la demande de Galahad ; le `Driver` des robots renvoie `{ throttle, jump }` (tâche 6). L'événement `'jump'` (`carId`) sert à la poussière et, plus tard, au son.
- Nouveaux paramètres dans `config.ts` : `JUMP_VY`, `JUMP_COOLDOWN`, `JUMP_BUTTON_SIZE_PX` (nombres).

## 2. Étoiles pour tous et étoiles en hauteur

- **Étoiles pour tous** : l'état d'une étoile est tenu **par voiture**. Une voiture qui prend une étoile la rend inactive pour elle seule, jusqu'à `STAR_RESPAWN_SECONDS`, et active son turbo. Pour les autres, l'étoile reste prenable. Les capteurs restent actifs ; la décision « prise ou non » se fait voiture par voiture dans `collectStars`. **À l'écran, on dessine l'état vu par Galahad** : une étoile prise par un copain reste visible.
- **Étoiles hautes** :
  - À la génération (`placeStars`, rng de la piste, déterministe pour ENCORE), environ **1 étoile du curseur sur 3** est surélevée.
  - Emplacement : sur les plats et au-dessus du sommet d'une bosse.
  - Hauteur réglée pour deux conditions, toutes deux mesurées en test : une voiture au sol, à `V_MAX` comme en turbo, ne la touche jamais ; un saut déclenché dans une **fenêtre d'au moins 0,3 s** (visée ≈ 0,4 s) à vitesse de croisière l'attrape, sans respawn à l'atterrissage.
- **Jamais en hauteur** : les étoiles d'élan et toute étoile du plat de lancement d'un volcan. Une étoile haute juste avant un volcan inviterait à sauter au pire moment. Le saut devant un volcan reste un piège, pas une récompense.
- **Inchangés** : nombre d'étoiles (≈ 9 par course, test 6 à 14), plancher de 6, zones interdites, turbo de 3 s.

## 3. Copains

- **Deux traits de plus par pilote** (`src/cars/pilots.ts`), à valider par le papa comme les couleurs :
  - `jumpTry` ∈ [0 ; 1] : probabilité de tenter une étoile haute disponible pour lui ;
  - `jumpSkill` : écart-type de l'erreur sur l'instant du saut, de quelques centièmes à ≈ 0,2 s.

  Fonceurs (Pablo, Matthis) : tentent souvent (≈ 0,8), visent moins bien. Moyens (Diego, Malo) : entre les deux. Prudents (Timothée, Liam) : tentent rarement (≈ 0,3), visent juste.
- **Décision** :
  1. À l'approche d'une étoile haute encore disponible pour lui, le copain tire une fois, par la graine de pilotes, s'il tente.
  2. S'il tente, il calcule l'instant idéal d'après sa vitesse, y ajoute son erreur tirée, et saute.
  3. Il peut rater l'étoile, mal retomber, voire se retourner.
- **Jamais de saut pour un copain** dans `[xLancement, xReception]` d'un volcan.
- Le saut s'intègre à la tâche 6 (conduite des robots), avec les « robots polis ». L'élastique (tâche 7) est inchangé.

## 4. Tests d'acceptation

- **Saut (unitaires et simulation)** :
  - au sol seulement ;
  - délai respecté ;
  - un saut par appui ;
  - apogée 2,5 m ± 10 % à l'arrêt ;
  - aucune trace de gaz par le bouton ;
  - déterminisme.
- **e2e** : tap sur le bouton → événement `'jump'`, sans gaz ; doigt de gaz + tap simultanés → la voiture avance et saute.
- **Étoiles hautes** :
  - doigt posé sans saut, turbo compris : 0 étoile haute prise ;
  - pour chaque étoile haute (graines 0 à 9), il existe une fenêtre d'au moins 0,3 s de décollage qui la prend sans respawn ;
  - aucune sur un plat de lancement ;
  - environ 1 sur 3 (tolérance à fixer au plan).
- **Volcans** :
  - doigt posé sans saut : 0 chute (invariants de la tâche 5c gardés, graines 0 à 23 à 5 voitures) ;
  - un saut mal placé dans l'élan ou sur la rampe peut faire tomber : mesuré, pour vérifier que le risque existe.
- **Étoiles pour tous** : une étoile prise par un copain reste prenable par Galahad ; délai de réapparition par voiture.
- **Copains** :
  - aucun saut dans une zone volcan ;
  - les fonceurs ratent plus que les prudents (mesuré) ;
  - déterminisme.
- **Rattrapage** : sur les courses lentes à 5 voitures, part des courses gagnées par la voiture qui a pris la première étoile, avant et après. Baisse nette attendue. Chiffre consigné dans la passation.

## 5. Ordre dans le plan B

Après la tâche 5c :

| Tâche | Contenu |
|---|---|
| **5d** | Étoiles pour tous (état par voiture, rendu de l'état vu par Galahad) |
| **5e** | Bouton saut et étoiles hautes (Galahad) |
| **6** | Conduite des robots : délai de départ, lever de pied, robots polis, **sauts des copains** et nouveaux traits de pilote |
| **7** | Élastique ; l'objectif mesuré tient compte des sauts |

Les finitions et le décor suivent sans changement. Le plan d'implémentation de ces tâches s'écrit à partir de ce document (skill writing-plans), avec les relectures habituelles.
