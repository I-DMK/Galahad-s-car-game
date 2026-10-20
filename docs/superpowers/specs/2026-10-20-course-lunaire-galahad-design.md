# Course Lunaire de Galahad — document de design

Date : 2026-10-20
Statut : relu (relecture standard + relecture adversariale intégrées), en attente
de validation par le papa avant le plan d'implémentation.

## 1. But et public

Un jeu de course de voiture pour Galahad, 5 ans et demi, construit avec son papa.
Il se joue sur une tablette Lenovo Tab P12 (TB372FC, Android, écran 12,7",
2560×1600 physiques, soit 1280×800 CSS à DPR 2), dans Chrome, avec un seul
doigt, en mode paysage.

Succès = Galahad lance une course tout seul depuis l'écran d'accueil, comprend
quoi faire sans lire, rit quand ça saute ou que ça se cogne, et veut rejouer.
Une course dure 2 à 3 minutes. Il finit parfois premier, parfois pas, jamais
loin derrière. Il ne reste jamais coincé plus de 2 secondes.

Ce que Galahad a choisi :

- Vue de côté (type Hill Climb Racing).
- Un doigt : appuyer = accélérer, lâcher = ralentir.
- Une voiture de course bleue à bandes rouges, avec un pilote casqué qui s'appelle Galahad.
- Décor : la Lune, une piste de course, des volcans à éviter.
- Chute ou retournement : réapparition rapide un peu avant, on continue.
- 4 adversaires (5 voitures en tout) tirés parmi Pablo, Diego, Timothée,
  Matthis, Malo, Liam, Mathilde, Suzanne, chacun avec sa couleur.
- Les voitures se cognent et se poussent.
- Des étoiles à ramasser qui donnent un turbo.
- Bruits de moteur, de sauts, et une musique, avec un bouton pour couper.
- Galahad lit les chiffres et commence à lire les mots : menus à grosses
  images et mots courts, scores en gros chiffres.

Hypothèses retenues sans question posée :

- Pas de carburant qui se vide, pas de vies, pas de compte, pas de réseau
  nécessaire après le premier chargement.
- Difficulté réglée pour un enfant de 5 ans ; les adversaires restent proches.
- Les étoiles sont ramassables par tout le monde et réapparaissent au même
  endroit quelques secondes après avoir été prises, comme les boîtes d'objets
  de Mario Kart (choix de Galahad).

## 2. Choix techniques

- TypeScript + Vite, site statique. Une seule dépendance d'exécution : Matter.js
  (moteur physique 2D, utilisé sans son rendu ni son runner). Vitest pour les
  tests unitaires et les simulations physiques (Matter.js tourne sous Node),
  Playwright pour les tests de bout en bout et les captures d'écran.
- Rendu sur un `<canvas>` 2D. Tous les visuels sont dessinés par code, sans
  fichiers d'images. Sons synthétisés avec Web Audio, sans fichiers audio.
- Interface (titre, HUD, podium, pause) en HTML/CSS par-dessus le canvas.
- PWA : manifeste, icône SVG, service worker (plugin Vite PWA).
- Déploiement : **GitHub Pages via GitHub Actions** (le connecteur Vercel de
  la session n'est pas utilisable : « utilisateur introuvable »). Le workflow
  se déclenche sur push de la branche de travail et publie `dist/`. Le `base`
  Vite vaut `/I-DMK/` (nom du dépôt), piloté par la variable d'environnement
  `VITE_BASE` pour pouvoir changer d'hébergeur sans toucher au code. Le
  squelette CI + déploiement est en place dès l'étape 1, la PWA à l'étape 5.
- Une étape manuelle pour le papa, une seule fois : dans GitHub, Settings →
  Pages → Source = « GitHub Actions » (le workflow tente aussi de l'activer
  lui-même).

Approches écartées : physique maison sans moteur, Phaser (trop lourd).

## 3. Unités, échelle et constantes

Tout `config.ts`. Le jeu raisonne en mètres et secondes ; Matter.js travaille
en pixels. Valeurs de départ (à calibrer à l'étape 6) :

| Constante | Valeur de départ | Rôle |
|---|---|---|
| `PIXELS_PER_METER` | 40 | échelle monde ↔ physique |
| `GRAVITY` | 4,9 m/s² | moitié de la Terre |
| `V_MAX` | 14 m/s | vitesse max sans turbo (plafond de vitesse angulaire des roues) |
| `V_CRUISE` | 0,8 × `V_MAX` | vitesse de croisière utilisée pour calibrer la longueur |
| `TURBO_FACTOR` | 1,5 | multiplie `V_MAX` et le couple pendant 3 s |
| `RAMP_ANGLE` | 22° | angle des rampes de saut et de volcan |
| `CAR_LENGTH` | 2,2 m | longueur du châssis |
| `WHEEL_RADIUS` | 0,45 m | rayon des roues (≥ 2 × l'espacement des points de piste) |
| `TRACK_POINT_SPACING` | 0,2 m | espacement des points du relief |
| `STAR_RESPAWN_SECONDS` | 5 s | réapparition d'une étoile prise |
| `RACE_TARGET_SECONDS` | 150 s | durée visée → longueur = `V_CRUISE` × 150 s ≈ 1 680 m |
| `PHYSICS_DT` | 1/60 s | pas fixe |
| `MAX_STEPS_PER_FRAME` | 4 | ralenti plutôt que saut dans le temps |

Une fonction pure `jumpRange(v0, g, angle)` (balistique simple) est partagée
par `track/` et par les tests : portée d'un saut depuis une rampe d'angle
`angle` quitté à la vitesse `v0`. Une fonction pure `runUpDistance(vTarget,
accel)` donne la distance pour atteindre `vTarget` depuis l'arrêt avec
l'accélération moyenne mesurée de la voiture (constante calibrée par un test
Matter.js, voir §11).

## 4. Architecture

```
src/
  main.ts            point d'entrée : crée le jeu, branche les écrans
  game.ts            boucle de jeu + machine d'états
  config.ts          toutes les constantes (§3) et réglages
  track/             relief, tranches, volcans, étoiles, points de repère (logique pure)
  physics/           monde Matter.js : sol, voitures, capteurs, filtres de collision, file de respawn
  cars/              pilotes (noms, couleurs, caractères), état d'une voiture en course, points sûrs, respawn (logique pure)
  ai/                conduite des robots + élastique (logique pure)
  render/            dessin canvas : décor pré-rendu, piste, voitures, effets, caméra
  audio/             synthèse Web Audio : moteur, effets, musique, bouton son
  ui/                écrans HTML : titre, HUD, décompte, podium, pause/orientation
  input/             accélérateur tactile (pointer events sur window)
tests/               Vitest : logique pure + simulations Matter.js headless
e2e/                 Playwright : tablette simulée (1280×800, DPR 2, tactile)
```

Règle : `track/`, `cars/`, `ai/` ne dépendent ni de Matter.js ni du DOM.
`physics/` et `render/` consomment leurs sorties. `game.ts` orchestre.

### Machine d'états

`title` → `countdown` (3, 2, 1, PARTEZ) → `racing` → `finished` (Galahad passe
la ligne, 1,5 s de roue libre) → `podium` → `countdown` (ENCORE : mêmes graines
de piste **et** de pilotes) ou `title`.

`paused(précédent)` : entré depuis `countdown` ou `racing` quand l'onglet
passe en arrière-plan, que la tablette passe en portrait, ou que le geste
« retour » Android arrive (`popstate`, voir §8). Un calque plein écran affiche
« PAUSE » (ou « TOURNE » avec un dessin de tablette si portrait) et un gros
bouton « REPRENDRE ». Reprise uniquement en paysage, par un tap sur ce bouton,
tap consommé (il n'accélère pas). Une pause pendant `countdown` relance le
décompte à 3.

### Boucle de jeu

`requestAnimationFrame` pour le rendu ; physique à pas fixe `PHYSICS_DT` avec
accumulateur, au plus `MAX_STEPS_PER_FRAME` pas par image. Le chrono de course
est basé sur le temps simulé (nombre de pas), pas sur l'horloge murale : si la
tablette ralentit, le chrono reste juste. Les respawns et autres déplacements de
corps sont mis en file pendant le pas et appliqués entre deux pas, jamais dans
un callback de collision.

## 5. Piste

### Génération (logique pure, `track/`)

Entrée : graine (entier), longueur cible en mètres, et les constantes de §3.
Sortie : points `(x, y)` espacés de `TRACK_POINT_SPACING`, liste des tranches
avec leur type et leurs bornes, liste des volcans (x de la lave, largeur),
liste des étoiles, x de la ligne de départ, x de la ligne d'arrivée, x du mur
final. PRNG déterministe (mulberry32) : même graine → même piste.

Catalogue de tranches :

- `plat` : zones de respiration.
- `bosses` : ondulations douces, amplitude et longueur d'onde bornées.
- `rampe-saut` : montée à `RAMP_ANGLE` puis cassure, retombée en descente douce.
- `double-bosse` : deux bosses rapprochées pour des petits sauts enchaînés.
- `rampe-volcan` : **plat d'élan** de longueur `L_ELAN` + rampe à `RAMP_ANGLE`
  + volcan dans le creux + **plat de réception** + mur-butée bas côté aval
  pour qu'une voiture courte ne glisse pas en arrière dans la lave.
  - `L_ELAN` = `runUpDistance(V_SAUT, accel)` × 1,2, avec `V_SAUT` la vitesse
    nécessaire pour franchir le volcan : le saut est calibré pour une voiture
    qui **part de l'arrêt au début du plat d'élan**, doigt posé, sans turbo.
  - La lave est placée à 70 % de `jumpRange(V_SAUT)` ; le plat de réception
    mesure au moins `jumpRange(V_MAX × TURBO_FACTOR)` × 1,2 pour qu'un turbo
    n'envoie jamais au-delà.

Assemblage : départ = `plat` d'au moins 5 × 1,5 × `CAR_LENGTH` + 10 m ; puis
tranches tirées au hasard en remplissant jusqu'à (cible − plat final) ; puis
plat final avec la ligne d'arrivée, 60 m de plat au-delà, et un mur. Longueur
totale dans ±5 % de la cible.

Contraintes garanties (toutes testées) : pente max `RAMP_ANGLE` + 5° (jamais
de mur sur la piste) ; aucun volcan dans les 15 premiers % ni les 10 derniers ;
**au moins une tranche d'un autre type entre deux `rampe-volcan`** (le plat de
réception interne ne compte pas) ; ligne d'arrivée sur un plat.

### Points de repère exposés par `track/`

Pour chaque volcan : `xElanStart` (début du plat d'élan), `xLava`,
`xReception` (début du plat de réception). Ces x servent aux points sûrs (§6),
à l'IA (§7) et au placement des étoiles.

### Étoiles

Sur les plats et au bas des montées, à hauteur de roue. Exclusion **par
distance**, pas par tranche : aucune étoile à moins de `3 s × V_MAX ×
TURBO_FACTOR` (≈ 63 m) avant une lave, ni sur le plat final ni après la ligne.
Toute voiture peut ramasser une étoile ; elle disparaît avec un petit éclat
et **réapparaît au même endroit 5 s plus tard** (`STAR_RESPAWN_SECONDS`),
comme une boîte d'objets de Mario Kart. Une voiture derrière trouve donc
presque toujours l'étoile de nouveau en place.

### Volcans

Cône solide (deux pentes) avec cratère de lave. La lave est un **capteur
épais** : tout le volume du cratère jusqu'au plancher, pas une ligne fine, pour
qu'une roue rapide ne le traverse pas sans être détectée. Fumée et bulles
animées en rendu.

### Sol physique

Pas un corps unique : un corps statique par segment de piste, en trapèze plein
descendant jusqu'à un plancher (y = fond du monde), avec un chevauchement d'un
pixel entre segments voisins. `WHEEL_RADIUS` ≥ 2 × `TRACK_POINT_SPACING` pour
que les roues ne s'accrochent pas aux jointures. Vitesse verticale des corps
plafonnée à `V_MAX × TURBO_FACTOR × 1,5` pour limiter le tunneling (Matter.js
n'a pas de collision continue). Un test Matter.js fait tomber des roues à cette
vitesse sur la piste et vérifie qu'aucune ne passe au travers.

## 6. Voitures et physique

### Modèle Matter.js (identique pour les 5 voitures)

- Châssis : rectangle à coins arrondis (`chamfer`), masse fixée.
- Deux roues : cercles, friction élevée, chacune reliée au châssis par **deux
  contraintes** (ressort vertical + contrainte latérale rigide, sur le modèle
  de `Composites.car`) pour qu'elle ne dérive pas latéralement.
- Collisions : `collisionFilter.group` négatif unique par voiture (châssis et
  roues d'une même voiture ne se touchent pas) ; catégories `SOL`, `VOITURE`,
  `CAPTEUR`. Les capteurs (lave, étoile) sont dans une catégorie toujours
  détectée. Masses, restitution faible, mêmes réglages pour tous.
- « Roue au sol » = la roue est en contact avec n'importe quel corps non
  capteur (sol ou autre voiture).

### Conduite

- Doigt posé : couple moteur sur les deux roues, plafonné par la vitesse
  angulaire correspondant à `V_MAX` (× facteur turbo ou élastique).
- Doigt levé : couple nul + léger frein moteur. Jamais de marche arrière.
- En l'air (aucune roue au sol) : rotation corrective douce vers
  l'horizontale. Au sol ou posé sur une autre voiture : aucune correction.

### Points sûrs (logique pure, `cars/safepoint.ts`)

Toutes les 0,5 s, un point sûr est enregistré si : les deux roues sont au sol,
la voiture est à l'endroit, |pente locale| < 10°, et x n'est pas dans
l'intervalle `[xElanStart + L_ELAN × 0,25, xReception)` d'un volcan. Autrement
dit, un point sûr est soit loin d'un volcan, soit dans le premier quart du
plat d'élan (assez d'élan pour sauter depuis l'arrêt), soit sur le plat de
réception. Le point sûr mémorise x, y et l'angle du sol.

### Respawn

Déclencheurs :

- lave touchée (immédiat) ;
- châssis à l'envers (angle normalisé dans [−180°, 180°], |angle| > 110°)
  pendant plus de 1 s, ou sur le flanc (|angle| > 70°) pendant plus de 2 s ;
- **blocage** : doigt posé (ou robot en accélération) et progression < 1 m
  pendant 2 s ;
- châssis sous le sol, ou vitesse > 3 × `V_MAX × TURBO_FACTOR` (garde-fou).

Effet (appliqué entre deux pas physiques) : la voiture est replacée au dernier
point sûr, châssis à l'angle du sol mémorisé, roues posées à la hauteur du sol
à leur abscisse, vitesses nulles. Invulnérabilité aux collisions entre
voitures (les capteurs et le sol restent actifs) pendant 0,5 s, **prolongée
tant que le châssis chevauche une autre voiture**, plafond 2 s. Étincelles et
son rigolo (seulement si la voiture est à l'écran). Aucun message.

Garde-fous : sans point sûr (début de course), le point sûr est la case de
départ de la voiture. **Deux respawns consécutifs au même point sûr → la
voiture est replacée sur le plat de réception après le volcan** (on ne reste
jamais enfermé devant un volcan).

### Collisions entre voitures

Les 5 voitures partagent le même monde et se poussent réellement. Masses
égales, châssis arrondis, restitution faible. Pendant les 5 premières secondes
de course, l'élastique est neutre (facteur 1,0) pour éviter que les robots
percutent Galahad au départ.

### Grille de départ

Vue de côté : les voitures sont en file. **Galahad en pole**, les robots
derrière, espacés de 1,5 × `CAR_LENGTH`. À PARTEZ, le robot de rang n démarre
avec un délai de 0,3 s × n. Le HUD de position reste vide pendant la première
seconde.

### Étoile / turbo (toutes les voitures)

Turbo 3 s : `V_MAX` et couple × `TURBO_FACTOR`, flammes, bruit de fusée (si
la voiture est visible). Un nouveau turbo remet le compteur à 3 s. Pour les
robots, le turbo se combine à l'élastique (voir §7) : un copain déjà loin
devant ne s'envole pas grâce aux étoiles.

### Arrivée

Détection par abscisse : x du châssis ≥ x de la ligne. Chrono démarré à
PARTEZ, figé pour chaque voiture à son passage. Une voiture qui a fini coupe le
moteur et freine ; la piste continue 60 m puis un mur, personne ne tombe dans
le vide. Quand Galahad passe : trompette, état `finished`, 1,5 s de roue libre,
puis podium. Classement final = voitures arrivées par temps, puis non arrivées
par progression ; égalité tranchée par l'index de voiture.

## 7. Adversaires (IA)

- Pilotes : Pablo, Diego, Timothée, Matthis, Malo, Liam, Mathilde, Suzanne,
  couleur fixe chacun (`cars/pilots.ts`), casque assorti, et un caractère :
  facteur de base (0,85 à 1,0) et probabilité de lever le pied avant une
  `rampe-saut` ou une `double-bosse` (prudent / fonceur).
- À chaque course, 4 pilotes tirés au hasard (graine de pilotes, mémorisée
  pour ENCORE).
- Conduite : accélère par défaut. **Jamais de lever de pied et facteur ≥ 1,0
  dans la zone `[xElanStart, xLava]` de chaque volcan** (l'IA lit les points
  de repère de `track/`). Lève le pied brièvement, selon son caractère,
  seulement avant `rampe-saut` et `double-bosse`.
- Élastique (`ai/rubberband.ts`, logique pure) : facteur appliqué **au couple
  et au plafond de vitesse**, à partir de l'écart de progression avec Galahad.
  - Robot devant de plus de `X` (= au moins la demi-largeur visible de la
    caméra, donc hors écran) : facteur descend progressivement jusqu'à 0,6.
  - Robot derrière de plus de `X` : facteur monte jusqu'à 1,3 (sans flammes).
  - Dans la fenêtre : facteur = caractère.
  - Turbo d'un robot : le facteur final = facteur élastique × `TURBO_FACTOR`,
    **plafonné à 1,3 au total** ; un robot hors écran devant Galahad garde
    les flammes mais ne dépasse jamais le facteur 1,0 (les étoiles ne cassent
    pas l'élastique).
  - Variation limitée à 0,15 par seconde : jamais d'arrêt net visible.
  - Neutre (1,0) les 5 premières secondes et dans les zones d'élan.
- Les robots respawnent exactement comme Galahad (mêmes règles, mêmes
  garde-fous).
- Classement en course par progression (abscisse), recalculé chaque image mais
  **affiché avec hystérésis** : un changement de position n'est montré que s'il
  tient 0,5 s ou si l'écart dépasse 2 m.
- Objectif mesurable (test de simulation §11) : sur 20 graines fixes, Galahad
  modélisé « doigt toujours posé » finit 1er ou 2e au moins la moitié du
  temps et dernier au plus 2 fois ; aucun robot ne respawne plus de 3 fois
  par course.

## 8. Interface, entrée et rendu

### Entrée tactile (`input/`)

Écoute de `pointerdown`, `pointerup`, `pointercancel` sur `window`, avec un
compteur de pointeurs actifs : compteur > 0 = accélérer. Remise à zéro sur
`pointercancel`, `blur` et `visibilitychange`. Le HUD a `pointer-events: none`
sauf ses boutons. Le `pointerdown` sur JOUER compte comme doigt posé : si
Galahad garde le doigt après avoir appuyé, la voiture part à PARTEZ.
`touch-action: none`, zoom, défilement et menu contextuel désactivés.

Geste « retour » Android : `history.pushState` à l'entrée en `racing` ;
`popstate` → `paused`. (Le geste système lui-même ne peut pas être bloqué par
une page web ; à documenter pour le papa : navigation à 3 boutons conseillée.)

Activation utilisateur : `AudioContext.resume()` et `requestFullscreen()` sont
appelés de façon synchrone dans le gestionnaire `click` du bouton JOUER (et du
bouton son), car sur tactile `pointerdown` n'accorde pas l'activation.
`resume()` est retenté à chaque `pointerup` tant que le contexte est suspendu.
Si le plein écran est refusé, on continue sans.

### Rendu (`render/`)

- Caméra : suit Galahad avec un décalage vers l'avant proportionnel à la
  vitesse, lissé. Zoom fixe, calculé pour que la hauteur visible couvre les
  plus hauts sauts.
- Décor : ciel noir étoilé (parallaxe lente) et Terre au loin **pré-rendus
  dans un canvas hors écran** et blittés ; sol gris lunaire avec cratères
  décoratifs ; plots lumineux le long de la piste.
- Voitures : carrosserie, bandes, vitre, pilote avec casque coloré, roues qui
  tournent. Prénom en petit au-dessus de chaque adversaire.
- Effets : flammes de turbo, poussière à l'atterrissage, étincelles de
  respawn, lave qui bouillonne, fumée, confettis sur le podium si Galahad gagne.
- Résolution : largeur du backing store plafonnée à 1920 px (DPR effectif
  ≈ 1,5 sur la tablette), hauteur proportionnelle. Un compteur d'images par
  seconde est affiché en petit avec `?debug=1`.

### Écrans (HTML, `ui/`)

- **Titre** : nom du jeu, numéro de version en tout petit, voiture de Galahad
  qui rebondit (canvas), très gros bouton rond « JOUER » avec drapeau, petit
  bouton son, petit bouton « AUTRE PISTE » (nouvelle graine) avec un dé.
- **Décompte** : 3, 2, 1, PARTEZ en plein écran, un son par chiffre.
- **HUD** : en haut à gauche la position en très gros (« 1er », « 2e »… avec
  une petite voiture bleue), vide la première seconde ; en haut au centre une
  barre de progression avec les 5 petites voitures ; en haut à droite le chrono
  en gros chiffres (mm:ss). **Aucun bouton pendant la course** : tout l'écran
  est la pédale. Le bouton son n'existe qu'au titre et au podium.
- **Podium** : les 3 premiers sur des marches avec prénom et médaille ; Galahad
  toujours affiché (sur le podium ou à côté avec sa place) ; son temps en gros
  chiffres ; gros bouton « ENCORE » (mêmes piste et copains), bouton « MENU »,
  bouton son.
- **Pause / orientation** : voir §4.
- Tous les boutons font au moins 96 px CSS de côté. Mots courts avec icône.

## 9. Audio (`audio/`)

Web Audio, tout synthétisé, réglages de volume séparés (moteur, effets,
musique) dans `config.ts` :

- Moteur : oscillateur + bruit filtré passe-bas, hauteur suivant la vitesse,
  volume faible.
- Turbo : bruit filtré type fusée. Étoile : « ding » arpégé. Gros saut (temps
  en l'air > 0,6 s) : « boing ». Choc (impulsion > seuil) : « pof », délai
  minimal entre deux. Respawn : glissando puis « pop ». Arrivée : trompette.
  Décompte : bip, bip, bip, bip aigu.
- **Les effets ne sont joués que pour Galahad ou pour une voiture visible à
  l'écran.**
- Tous les gains passent par `setTargetAtTime` (pas de clics).
- Musique : boucle courte de 8 mesures, simple et joyeuse, démarre au titre
  après le premier `click`.
- Bouton son : coupe tout, choix mémorisé dans `localStorage`.
- `suspend()` explicite sur `visibilitychange` (pas de moteur qui tourne
  tablette verrouillée). Si Web Audio échoue : jeu silencieux, bouton grisé.

## 10. Robustesse

- Garde-fous de vitesse et de position (§6). Pas plus de 4 pas physiques par
  image. Chrono en temps simulé.
- Pause automatique en arrière-plan, en portrait et sur `popstate`.
- Redimensionnement : canvas et HUD suivent la fenêtre.
- Si Matter.js lève une exception dans un pas (NaN typiquement) : les corps
  des 5 voitures sont **reconstruits** depuis leurs points sûrs (pas un simple
  `setPosition`), 3 essais au plus, puis retour au titre avec un message
  d'excuse dessiné.
- Service worker : cache de l'application au premier chargement ; mise à jour
  téléchargée en arrière-plan et **appliquée (rechargement) uniquement à
  l'écran titre**, jamais en course. Numéro de version visible au titre pour
  que le papa sache quelle version joue.
- Paramètres d'URL : `?seed=` (piste), `?len=` (longueur en mètres),
  `?debug=1` (compteur fps, API `window.__game` pour les tests).

## 11. Tests

### Vitest, logique pure

- Piste : même graine → même piste ; longueur dans ±5 % ; pente max ; zones
  interdites ; au moins une tranche d'un autre type entre deux `rampe-volcan` ;
  étoiles jamais à moins de 63 m avant une lave ni sur le plat final ; arrivée
  sur un plat ; 60 m + mur après la ligne ; départ assez long pour 5 voitures.
- Points sûrs : jamais dans la zone interdite d'un volcan ; repli sur la case
  de départ ; angle mémorisé.
- Respawn : deux respawns consécutifs au même point → réception après le volcan.
- Élastique : facteur dans [0,6 ; 1,3], monotone en fonction de l'écart,
  variation ≤ 0,15/s, neutre les 5 premières secondes et dans les zones d'élan,
  turbo robot plafonné à 1,3 au total et à 1,0 pour un robot loin devant.
- Étoiles : réapparition 5 s après ramassage au même endroit, ramassable par
  n'importe quelle voiture.
- Pilotes : 4 tirés sans doublon, Galahad jamais parmi eux, couleurs uniques,
  même graine → mêmes pilotes.
- Classement : arrivés par temps puis progression ; tie-break par index ;
  hystérésis d'affichage.

### Vitest, simulations Matter.js headless (le vrai monde physique)

- Calibration : mesure de l'accélération moyenne d'une voiture plein gaz sur le
  plat (constante `accel` de §3).
- Chaque type de tranche : une voiture partant de l'arrêt au début du plat
  d'élan, doigt posé, franchit le volcan sans turbo et atterrit sur le plat de
  réception ; avec turbo, elle atterrit aussi sur le plat (jamais au-delà).
- Tunneling : chute de roues à la vitesse plafond sur toute la piste, aucune
  traversée.
- Course complète sur 20 graines fixes (0 à 19) avec les 5 voitures, Galahad
  « doigt toujours posé », puis variante « lève le doigt 30 % du temps » :
  objectif de répartition de §7, aucun robot à plus de 3 respawns, aucune
  voiture bloquée plus de 2 s, budget de temps par pas physique < 4 ms en
  moyenne sur la machine de test (indicateur, non bloquant).

### Playwright (Chromium, viewport 1280×800, `deviceScaleFactor: 2`, `hasTouch`, `isMobile`)

- Titre affiché ; `click` sur JOUER → décompte → course.
- Appui long simulé via CDP `Input.dispatchTouchEvent` (touchStart… 3 s …
  touchEnd) : `window.__game.progress('galahad') > 0`.
- Doigt gardé posé depuis JOUER à travers le décompte : la voiture part à PARTEZ.
- Portrait → calque « TOURNE » et état `paused` ; retour paysage + tap sur
  REPRENDRE → `racing`, et le tap n'a pas fait avancer la voiture.
- Capture d'écran de chaque écran (titre, course, podium), envoyée au papa
  comme livrable, pas comme assertion.
- Les performances réelles sont mesurées sur la tablette avec `?debug=1` dès
  l'étape 1, pas en headless.

## 12. Déploiement

- Branche `ccr-5b6fabc4-n96ofo`, commits par étape.
- `.github/workflows/deploy.yml` : sur push de cette branche, `npm ci`, tests
  Vitest, `npm run build` avec `VITE_BASE=/I-DMK/`, publication de `dist/` sur
  GitHub Pages via `actions/configure-pages` (avec `enablement: true`) et
  `actions/deploy-pages`. Adresse attendue : `https://i-dmk.github.io/I-DMK/`.
- PWA (étape 5) : `manifest.webmanifest` (nom, icône SVG, `display:
  fullscreen`, `orientation: landscape`, `start_url` relatif au `base`),
  service worker avec la politique de mise à jour de §10.
- Procédure pour le papa : ouvrir l'adresse dans Chrome sur la tablette,
  menu ⋮ → « Ajouter à l'écran d'accueil ». Conseil : navigation Android à
  3 boutons pour éviter le geste « retour » pendant la course.

## 13. Étapes jouables et découpage en deux plans

**Plan A — socle jouable**

1. Squelette du projet, CI et déploiement GitHub Pages, voiture bleue et
   rouge sur une piste lunaire générée, un doigt, sauts, caméra, décor,
   compteur fps avec `?debug=1`. Vérification sur la tablette.
2. Volcans avec plat d'élan et plat de réception, points sûrs, respawn avec
   tous les garde-fous, ligne d'arrivée, chrono, simulations Matter.js de §11.
3. Étoiles et turbo.

→ Test réel avec Galahad sur la tablette avant le plan B.

**Plan B — copains et finitions**

4. Les 4 copains, grille de départ, chocs, élastique, position avec
   hystérésis, barre de progression, simulation de course sur 20 graines.
5. Titre, décompte, pause, podium, sons, musique, PWA, numéro de version.

**Étape 6 (session manuelle, pas un plan)** : calibration de la durée et de
la difficulté d'après les retours de Galahad, via `config.ts`.

Chaque étape se termine par des tests verts, une capture d'écran et une
version déployée.

## 14. Hors périmètre (pour plus tard)

Autres voitures, autres décors, mode deux joueurs, sauvegarde des meilleurs
temps, choix du nombre d'adversaires, fantôme de la meilleure course.
