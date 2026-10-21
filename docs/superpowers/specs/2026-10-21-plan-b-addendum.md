# Course Lunaire de Galahad — addendum plan B

Date : 2026-10-21
Statut : v3 VALIDÉE par le papa le 2026-10-21, après deux tours de relecture (standard, adversariale,
`code-review` : 9 à 14 points au premier tour, 8 à 9 au second, tous intégrés
ou tranchés ci-dessous), en attente de validation par le papa avant le plan
d'implémentation.

Ce document amende le spec du 2026-10-20
(`2026-10-20-course-lunaire-galahad-design.md`), qui reste l'autorité pour tout
ce qui n'est pas repris ici. Chaque amendement cite la section du spec qu'il
modifie. En cas de contradiction entre le spec et cet addendum, l'addendum
l'emporte.

## 0. Décisions du brainstorming

| # | Question | Décision |
|---|---|---|
| 1 | Périmètre et ordre du plan B | Calibration, puis copains (étape 4), puis finitions (étape 5) et décor lunaire. Bond lunaire + obstacles reportés à un plan C, après une question à Galahad (son choix « un seul doigt » est en jeu). |
| 2 | Risque de lave | « Il faut arriver lancé » : le saut passe doigt posé, rate si l'on s'arrête ou lève le doigt dans l'élan. 8 à 12 étoiles par course au lieu de 35. |
| 3 | Décor lunaire | Paquet « lunaire » : parallaxe, texture, rochers, cratères creusés, drapeau, module lunaire, étoile filante. Règle fps par calques activables. |
| 4 | Copains | Tirage au sort (pas d'écran de choix). Suzanne et Mathilde retirées : 6 pilotes, 4 par course. |
| — | Relectures | Le skill `code-review` s'ajoute aux relectures standard et adversariale par sous-agents, à chaque étape (§4). |

Décisions prises à la relecture (à confirmer par le papa) :

- La **butée** aval des volcans (`STOP_BUMP_*`) est supprimée : avec le
  capteur de lave plein cratère, une voiture qui retombe sur le flanc aval et
  recule tombe dans la lave, ce qui est l'issue juste d'un saut trop court ; la
  butée tombait sinon pile dans la zone d'atterrissage d'une voiture lancée
  lente (19,8 m du sommet).
- Chaque volcan gagne un **plat de lancement** de `D_LANCE + 5` m devant son
  plat d'élan (§1.4) au lieu d'une contrainte sur la tranche précédente, qui
  aurait divisé le nombre de volcans par deux.
- Un seul levier de difficulté : la longueur du plat d'élan `L_ELAN` (§1.6).

Réponses de Galahad encore à recueillir (ne bloquent pas le plan) :

- « Les volcans, tu veux qu'ils soient un peu plus difficiles à sauter, ou
  qu'ils restent faciles ? » — le papa a tranché « plus difficiles » ; la
  réponse de Galahad dose `L_ELAN` (§1.6).
- « Sur la Lune, qu'est-ce que tu veux voir ? Choisis-en trois : un drapeau,
  une fusée posée, des gros rochers, des étoiles filantes, un astronaute qui
  fait coucou, des traces de pas. » — ses trois choix s'ajoutent au §3.2.

## 1. Calibration : « arriver lancé »

Amende spec §1 (« difficulté réglée pour un enfant de 5 ans » : le risque de
lave devient réel mais toujours rattrapable), §3, §5, §6, §7 et §11.

### 1.1 Constat sur le plan A

Le plat d'élan est dimensionné par `runUpDistance(vBottom) × ELAN_MARGIN /
ELAN_SAFE_FRACTION` (22,7 m, marge 1,6×). N'importe quel départ arrêté au début
de l'élan atteint `V_MAX` avant la rampe ; arrêté ou lancé, la voiture arrive au
sommet à la même vitesse (mesurée 11,1 à 12,7 m/s en 7b), alors que la lave se
franchit dès 8,75 m/s. Reculer la lave seule ne crée aucun risque ; le levier
est la longueur de l'élan.

### 1.2 Principe

Trois situations, trois issues, vérifiées par simulation (§1.7) :

| Situation | Vitesse au sommet | Issue |
|---|---|---|
| Arrêt au début du plat d'élan, puis doigt posé | ≈ 7 m/s à `L_ELAN` 8 m (modèle sans moteur sur la rampe, confirmé par 7b : 17 m → 11,1 mesuré) | retombe **dans la vallée** (portée ≤ 8 m, avant le flanc amont à 9,3 m) puis lave, à chaque volcan |
| Doigt posé depuis le début du plat de lancement | ≥ 11,1 m/s (mesuré 11,1 à 12,7) | passe, atterrit à `x ≥ xReception` (à 9,8 m/s déjà : 18,5 m du sommet contre 17,0 pour `xReception`) |
| Turbo actif au sommet | jusqu'à 21 m/s | atterrit sur le plat de réception, jamais au-delà |

Vitesse requise au sommet pour franchir le bord aval de la lave avec
`LAVA_MARGIN` 0,8 : 9,4 m/s (centre), 9,8 m/s (roue arrière, capteur plein
cratère). Marge pour la voiture lancée la plus lente mesurée : ≥ 1,3 m/s.

### 1.3 Constantes (`config.ts`)

Valeurs de départ ; les valeurs finales sont fixées par la tâche de calibration
d'après §1.7, puis confirmées sur la tablette.

| Constante | Plan A | Plan B (départ) | Rôle |
|---|---|---|---|
| `L_ELAN` (nouvelle) | calculée (22,7 m) | 8 m | longueur du plat d'élan, **seul levier de difficulté** (§1.6) ; valeur retenue mesurée par le cas 1 de §1.7 |
| `ELAN_MARGIN`, `ELAN_SAFE_FRACTION` | 1,2 / 0,75 | supprimées | remplacées par `L_ELAN` |
| `D_LANCE` (nouvelle) | — | `runUpDistance(V_MAX, DRIVE_ACCEL) × 1,2` = 27,3 m | distance de plat garantissant `V_MAX` depuis l'arrêt |
| `LANCEMENT_LENGTH` (nouvelle) | — | `D_LANCE + 5` = 32,3 m | plat de lancement devant chaque élan (§1.4) |
| `V_JUMP` | 10 | 10 | vitesse de calibration de la lave (inchangée) |
| `LAVA_MARGIN` | 0,7 | 0,8 | lave à 13,1 m du sommet (centre), franchie dès 9,4–9,8 m/s |
| `LAVA_SENSOR_ABOVE_RIM` (nouvelle) | 0 | 0,5 m | le capteur de lave dépasse le rebord de 0,5 m : une voiture qui rebondit sur le flanc amont ne survole pas la lave (les sauts réussis passent ≥ 2 m au-dessus, mesure 10b) |
| `STOP_BUMP_HEIGHT`, `STOP_BUMP_LENGTH` | 0,3 / 1 | supprimées | butée supprimée (§0) |
| `STAR_EXCLUSION_BEFORE_LAVA` | 63 m | supprimée | remplacée par §1.5 |
| `STAR_STEP_MIN`, `STAR_STEP_MAX` (nouvelles) | 12 / 20 m (dans `stars.ts`) | 80 / 130 m | pas du curseur global d'étoiles (§1.5 ; ≈ 830 m admissibles par course → ≈ 8 étoiles + ≈ 2,7 d'élan ; graines pauvres ≈ 410 m → 4 + 1,5) |

Plat de réception inchangé : au moins `jumpRange(V_MAX × TURBO_FACTOR) × 1,2`
depuis le sommet (67,7 × 1,2 m), et au moins 10 m après le rebord aval.

### 1.4 Piste (amende spec §5)

- Tranche `rampe-volcan` = **plat de lancement** (`LANCEMENT_LENGTH`) + plat
  d'élan (`L_ELAN`) + rampe + descente + vallée + volcan + plat de réception.
  Points de repère exposés : `xLancement`, `xElanStart`, `xLava`, `xReception`
  (= rebord aval + `RIM_HEIGHT / tan(MAX_SLOPE)`), `xEnd`. Toute tranche peut
  précéder un volcan : le plat de lancement absorbe une arrivée lente (voiture
  échouée au pied d'une `rampe-saut`, défaut noté en 7b).
- Nouveau type de tranche **`cratère`** (livré avec le décor, §3.2, mais défini
  ici car il touche la génération) : creux doux sans lave, longueur `L` de 8 à
  12 m, profondeur ≤ `L × tan(MAX_SLOPE) / π` (≈ 1,3 m à 8 m), pentes ≤
  `MAX_SLOPE`, fond arrondi. Compte comme « autre
  type » entre deux volcans. Aucune étoile ni point sûr dans un `cratère`
  (exclusion explicite, en plus de la règle de pente). Les robots n'y lèvent
  pas le pied. Poids de tirage égal à `double-bosse`.
- `xElanStart` change de sens : début du plat d'élan (après le lancement),
  plus début de tranche. La zone de `nearestVolcanoZone` (`src/track/query.ts`)
  et ses tests passent de `[xElanStart, xEnd[` à `[xLancement, xEnd[`.
- Test : 3 à 7 volcans par course de longueur par défaut sur les graines 0 à
  19 (la tranche passe de 109,5 à ≈ 128 m ; plan A : 4 à 7 ; si la moyenne
  passe sous 4, le poids de `rampe-volcan` est relevé dans la tâche de
  calibration).

### 1.5 Étoiles (amende spec §5 et §11 « étoiles jamais à moins de 63 m »)

- **Curseur global** le long de la piste : distance cumulée comptée seulement
  sur les zones admissibles (plats hors départ, plats de lancement, plats de
  réception, 1 m avant une `rampe-saut`) ; à chaque pas tiré dans
  [`STAR_STEP_MIN`, `STAR_STEP_MAX`], une étoile est posée au premier x
  admissible. Les étoiles automatiques « 1 m avant chaque rampe-saut » du plan
  A disparaissent (elles donnaient à elles seules 3 à 13 étoiles).
- **Étoile d'élan** : pour un volcan sur deux (tirage par la graine), une
  étoile à `xElanStart − 2` m. Le turbo (3 s, ≥ 42 m) est encore actif au
  sommet ; le plat de réception absorbe le saut turbo.
- Aucune étoile dans `[xElanStart, xLava]` (règle et test identiques).
- Plancher : si une piste compte moins de 6 étoiles, le générateur ajoute une
  étoile d'élan aux volcans qui n'en ont pas, dans l'ordre de la piste, jusqu'à
  6 (déterministe).
- Cible : 8 à 12 étoiles par course de longueur par défaut. Test : entre 6 et
  14 sur les graines 0 à 19 (le pas est ajusté dans la tâche de calibration si
  besoin, la cible ne bouge pas).

### 1.6 Points sûrs, respawn et dosage (amende spec §6)

- Zone interdite aux points sûrs : `[xLancement + 5, xReception)`. Un point sûr
  est donc soit dans les 5 premiers mètres du plat de lancement (puis
  `D_LANCE` de plat → `V_MAX` avant l'élan), soit avant, soit sur le plat de
  réception. Le « premier quart du plat d'élan » du spec disparaît.
- Deuxième chute consécutive au même volcan → replacée à `xEnd − 10` m (fin du
  plat de réception), plus à `xReception + 3` m qui est la zone
  d'atterrissage des autres voitures.
- Respawn groupé : si un châssis occupe déjà la cible (à moins de
  `1,5 × CAR_LENGTH`), la cible recule de `1,5 × CAR_LENGTH` par voiture déjà
  posée, jusqu'à 4 fois, en reculant jusqu'au premier x de pente < 10° hors
  `cratère`, posée à la hauteur et à l'angle du sol local. La cible
  `xEnd − 10` reste ≥ `xReception + 10` (plat de réception ≥ 20 m, garanti par
  la règle turbo).
- Voiture retournée ou sur le flanc dans `[xElanStart, xLava]` (copain atterri
  dessus) : respawn immédiat, sans les délais de 1 s / 2 s, pour ne pas faire
  obstacle à une voiture lancée. Test : 5 voitures dans la lave au même pas → aucun
  chevauchement à la réapparition, aucun garde-fou de vitesse déclenché.
- Dosage, **défini par mesure** (cas 1 de §1.7 rejoué pour `L_ELAN` de 6 à
  16 m par pas de 1 m, résultats consignés dans la passation) : « plus
  difficile » = la plus grande `L_ELAN` où 100 % des départs arrêtés tombent ;
  « facile » = la plus petite `L_ELAN` où ≥ 50 % passent. Valeur de départ
  8 m ; choix final après la réponse de Galahad et le test tablette. `LAVA_MARGIN` ne bouge pas.

### 1.7 Simulations d'acceptation (amende spec §11)

Sur toutes les `rampe-volcan` des graines 0 à 9 (≥ 30 volcans), voiture seule,
sans turbo sauf mention, assertions à 100 % (le monde est déterministe) :

1. Arrêt au début du plat d'élan, doigt posé → événement `lava` avant
   `xReception`.
2. Arrêt au début du plat de lancement, doigt posé → pas de `lava`, atterrissage
   ≥ `xReception`, |angle au contact| < 45°, pas de retournement.
3. Variante « lancée après bosses » : arrêt 60 m avant `xLancement` quand la
   tranche précédente est `bosses` ou `rampe-saut` (graines où cela existe) →
   mêmes assertions que 2.
4. Variante « choc » : vitesse ramenée à 8 m/s à `xElanStart − 15` m (choc
   inélastique simulé) → mêmes assertions que 2.
5. Même départ que 2 avec turbo pris à `xElanStart − 2` m → pas de `lava`,
   atterrissage sur le plat de réception, avant `xEnd`.
6. Course complète doigt posé, graines 0 à 4 : 0 respawn, arrivée en 120 à
   170 s, 6 à 14 étoiles prises.
7. Course « doigt levé 30 % du temps » : motif déterministe (graine du motif =
   graine de piste, tranches de 1 s) → ≤ 2 respawns par volcan (la règle
   « replacé après » borne à 2), arrivée avant 240 s.
8. Tranche `cratère` (livrée avec le décor, même simulation que `rampe-saut`) :
   traversée lancée à `V_MAX` et avec turbo, et arrêt au fond puis doigt posé →
   |angle au contact| < 45°, pas de retournement, pas de blocage > 2 s.

Répartition : cas 1 à 5 sur les graines 0 à 4 et cas 6 dans `npm test`
(≈ 3 min ; remplace les scénarios volcan de `jump.test.ts`, **conserve** ses
scénarios `rampe-saut` : V_MAX, turbo, lancée, depuis l'arrêt, roues sous le
châssis) ; cas 1 à 5 sur les graines 5 à 9, cas 7 et le balayage de dosage
dans `tests/slow/` (§2). Dès la tâche de calibration, les suites
`finish`, `respawn-sim` et `stars-sim` (5 × 240 s chacune, ledger T15) passent
dans `tests/slow/` pour tenir le budget CI.

Tests du plan A à réécrire (listés pour l'implémenteur) : `tests/jump.test.ts`
(« élan complet » devient le cas 1, « pire point sûr » devient le cas 2,
`ELAN_SAFE_FRACTION` disparaît), `tests/safepoint.test.ts` (zone interdite),
`tests/stars.test.ts` (exclusion 63 m → §1.5), `tests/slices.test.ts` (formule
`lElan`, butée), `tests/smoke.test.ts`, `tests/respawn.test.ts` (cible
`xEnd − 10`).

Puis test tablette par le papa (et Galahad) avant les copains : au plus **deux
tours** de calibration supplémentaires ; ensuite le papa tranche la valeur.

### 1.8 Robots (amende spec §7)

- Zone « jamais de lever de pied, facteur ≥ 1,0 » : `[xLancement, xLava]`.
  Le spec disait « neutre (1,0) » : lire « ≥ 1,0 » (un robot derrière à 1,3 le
  reste ; sa portée turbo-élastique 1,3 reste < 1,5, donc sur le plat de
  réception).
- Pré-zone de 40 m avant `xLancement` : le facteur remonte vers 1,0 à la
  vitesse normale (0,15/s, 2,7 s depuis 0,6). À `xLancement`, clamp immédiat
  à ≥ 1,0 par sécurité. Le facteur s'applique au couple et au plafond (spec
  §7) : un saut de 0,85 à 1,0 sur le couple d'un robot à l'écran est jugé
  invisible (≈ 0,6 m/s² de plus).

## 2. Copains (étape 4 du spec, amende §7 et §11)

- Pilotes : Pablo, Diego, Timothée, Matthis, Malo, Liam (Suzanne et Mathilde
  retirées). 4 tirés sans doublon par graine de pilotes, mémorisée pour ENCORE.
  Couleurs et casques distincts entre eux et de Galahad (bleu/rouge).
- Tout le reste conforme aux §6 et §7 : grille en file avec Galahad en pole,
  espacement 1,5 × `CAR_LENGTH`, départ du robot n à 0,3 s × n, chocs réels,
  invulnérabilité au respawn, élastique borné [0,6 ; 1,3], plafond turbo,
  neutre les 5 premières secondes, position avec hystérésis, barre de
  progression à 5 voitures, respawn identique pour tous (§1.6).
- Métrique ajoutée à la course simulée : chutes dans la lave par voiture
  (les chocs dans le plat de lancement deviennent une cause de chute) ; limite
  du spec : ≤ 3 respawns par robot et par course.
- Tests de course à 5 voitures, deux niveaux :
  - **CI** (`npm test`, exécuté par `deploy.yml`) : invariants sur 2 graines,
    doigt posé : ≤ 3 respawns par robot, aucune voiture bloquée > 2 s, pas
    physique < 4 ms en moyenne (indicateur), arrivée de Galahad < 240 s.
    Budget : `npm test` reste < 6 min (d'où le déplacement des suites longues
    du plan A dans `tests/slow/`, §1.7).
  - **Suite lente** (`npm run test:slow`, fichiers `tests/slow/`, hors
    `npm test`) : 20 graines doigt posé + 10 graines motif 30 % → objectif
    §7 (Galahad 1er ou 2e au moins la moitié du temps, dernier au plus 2
    fois, ≤ 3 respawns par robot). Budget < 20 min. Lancée à la fin de la
    tâche « élastique » et avant la relecture de branche ; résultat consigné
    dans la passation.

## 3. Finitions et décor (étape 5 du spec + décor)

### 3.1 Finitions

Conformes aux §8, §9, §10 et §12 du spec : titre (JOUER, AUTRE PISTE, son,
numéro de version), décompte, pause/orientation, podium avec ENCORE (mêmes
graines piste et pilotes) et MENU, sons synthétisés, musique, bouton son
mémorisé, PWA et mise à jour à l'écran titre seulement.

### 3.2 Décor lunaire (amende spec §8 « Rendu »)

| Élément | Où | Calque |
|---|---|---|
| Montagnes lointaines | fond, parallaxe lente (vitesse 0,2) | pré-rendu hors écran, blitté |
| Texture du sol | grain et petits cailloux sous la ligne de piste | pré-rendu par bande de piste (comme le sol actuel) |
| Rochers | en bord de piste, 1 tous les 40 à 80 m, hors tranches `rampe-volcan` | décor de piste, dessiné avec la piste |
| Cratères creusés | tranche `cratère` (§1.4) : petit saut gratuit | relief |
| Drapeau | planté au départ | décor de piste |
| Module lunaire | posé après la ligne d'arrivée | décor de piste |
| Étoile filante | ciel, une toutes les 10 à 20 s, 0,5 s | dynamique, 1 trait |

Règle fps : chaque élément est derrière un drapeau dans `config.ts`
(`DECOR.mountains`, `DECOR.rocks`, …). Préalable : le socle à 5 voitures sans
décor doit tenir ≥ 50 fps sur la tablette (`?debug=1`) ; sinon, la fenêtre
glissante de corps de sol (± 150 m, notée dans la passation du plan A) est
faite d'abord, dans la tâche copains. Ensuite le papa mesure avant et après
chaque élément ; sous 50 fps, on désactive le dernier élément ajouté, pas tout.
Les trois choix de Galahad (§0) s'ajoutent au tableau, même s'ils viennent du
paquet « riche » (astronaute, rover, traces de pas, Terre qui tourne).

### 3.3 Hors périmètre du plan B (plan C)

Bouton « bond lunaire » et obstacles (rochers sur la piste, cratères piégeux,
météorites) : à discuter avec Galahad ; version envisagée : gros bouton en bas à
gauche + gaz partout ailleurs, obstacles qui ralentissent ou bloquent (coût en
temps) plutôt que qui tuent.

## 4. Méthode et relectures

- Ordre des tâches du plan : (1) calibration, une tâche, puis test tablette du
  papa (≤ 2 tours, §1.7) ; (2) copains ; (3) finitions ; (4) décor. Chaque
  tâche finit par des tests verts, une capture et un déploiement.
- Relectures à chaque étape : relecture standard + relecture adversariale par
  sous-agents frais, **plus le skill `code-review`** : sur cet addendum, sur le
  plan, sur le diff de chaque tâche avant approbation, et sur la branche
  entière avant la remise. Rapports ≤ 30 lignes, corrections intégrées, au
  plus 5 tours de correction par tâche (comme au plan A), validation du papa à
  chaque étape.
- Exécution par sous-agents (superpowers:subagent-driven-development) : un
  implémenteur frais par tâche, un relecteur frais, tours de correction.
- Passation `docs/superpowers/handoff/` mise à jour et commitée à la fin de
  chaque tâche ; push sur `ccr-5b6fabc4-n96ofo` après chaque tâche approuvée ;
  jamais de PR sans demande explicite.
