# Course Lunaire de Galahad — document de design

Date : 2026-10-20
Statut : en relecture (standard + adversariale) avant implémentation

## 1. But et public

Un jeu de course de voiture pour Galahad, 5 ans et demi, construit avec son papa.
Il se joue sur une tablette Lenovo Tab P12 (TB372FC, Android, écran 12,7"),
dans Chrome, avec un seul doigt, en mode paysage.

Succès = Galahad lance une course tout seul depuis l'écran d'accueil, comprend
quoi faire sans lire, rit quand ça saute ou que ça se cogne, et veut rejouer.
Une course dure 2 à 3 minutes. Il finit parfois premier, parfois pas, jamais
loin derrière.

Ce que Galahad a choisi :

- Vue de côté (type Hill Climb Racing).
- Un doigt : appuyer = accélérer, lâcher = ralentir.
- Une voiture de course bleue à bandes rouges, avec un pilote casqué qui s'appelle Galahad.
- Décor : la Lune, une piste de course, des volcans à éviter.
- Chute ou retournement : réapparition immédiate un peu avant, on continue.
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

## 2. Choix techniques

- TypeScript + Vite, site statique. Une seule dépendance d'exécution : Matter.js
  (moteur physique 2D). Vitest pour les tests unitaires, Playwright pour les
  tests de bout en bout et les captures d'écran.
- Rendu sur un `<canvas>` 2D. Tous les visuels (voitures, pilotes, Lune, volcans,
  étoiles, Terre au loin) sont dessinés par code, sans fichiers d'images.
- Sons synthétisés avec Web Audio, sans fichiers audio.
- Interface (titre, HUD, podium) en HTML/CSS par-dessus le canvas.
- PWA : manifeste, icône dessinée en SVG, service worker qui met en cache
  l'application pour jouer hors ligne après le premier chargement.
- Déploiement automatique à chaque push : Vercel si le compte est connecté,
  sinon GitHub Pages via GitHub Actions.

Approches écartées : physique maison sans moteur (sauts et chocs moins vivants,
beaucoup de bricolage), Phaser (trop lourd pour ce qu'on utilise).

## 3. Architecture

```
src/
  main.ts            point d'entrée : crée le jeu, branche les écrans
  game.ts            boucle de jeu + machine d'états
  config.ts          toutes les constantes de réglage (gravité, vitesses, longueur de piste, durées…)
  track/             génération du relief, des volcans, des étoiles (logique pure)
  physics/           monde Matter.js : sol, voitures, capteurs volcan/étoile, collisions
  cars/              pilotes (noms, couleurs), état d'une voiture en course, respawn (logique pure)
  ai/                conduite des robots + élastique (logique pure)
  render/            dessin canvas : décor, piste, voitures, effets, caméra
  audio/             synthèse Web Audio : moteur, effets, musique, bouton son
  ui/                écrans HTML : titre, HUD, décompte, podium, orientation
  input/             gestion tactile un doigt (pointer events)
tests/               tests Vitest (logique pure)
e2e/                 tests Playwright (tablette simulée)
```

Règle : `track/`, `cars/`, `ai/` ne dépendent ni de Matter.js ni du DOM.
`physics/` et `render/` consomment leurs sorties. `game.ts` orchestre.

### Machine d'états

`title` → `countdown` (3, 2, 1, PARTEZ) → `racing` → `finished` (Galahad passe
la ligne) → `podium` → (`countdown` avec la même graine, ou `title`).

Une pause automatique se déclenche si l'onglet passe en arrière-plan ou si la
tablette passe en portrait ; reprise au retour en paysage par un toucher.

### Boucle de jeu

`requestAnimationFrame` pour le rendu ; physique à pas fixe de 1/60 s avec
accumulateur, au plus 4 pas par image (si la tablette ralentit, le jeu ralentit
au lieu de sauter dans le temps). Matter.js est utilisé sans son moteur de rendu
ni son runner intégrés.

## 4. Piste

### Génération (logique pure, `track/`)

Entrée : une graine (entier) et une longueur cible en mètres (défaut : calibrée
pour 2 à 3 minutes, voir §9). Sortie : un tableau de points `(x, y)` espacés
régulièrement, une liste de volcans, une liste d'étoiles, la position de la
ligne d'arrivée.

La piste est une suite de tranches tirées au hasard (PRNG déterministe type
mulberry32) selon un catalogue :

- `plat` : départ (toujours en premier, assez long pour aligner 5 voitures) et
  zones de respiration.
- `bosses` : ondulations douces, amplitude et fréquence bornées.
- `rampe-saut` : montée régulière puis cassure, retombée en descente douce.
- `rampe-volcan` : rampe puis un volcan dans le creux qui suit, puis un plat de
  réception. L'écart rampe → volcan est calculé pour qu'une voiture qui
  accélère sans turbo le franchisse ; une voiture lente tombe dedans.
- `double-bosse` : deux bosses rapprochées pour des petits sauts enchaînés.

Contraintes garanties : pente maximale bornée (jamais de mur), au moins un
plat entre deux volcans, jamais de volcan dans les 15 premiers pourcents ni
les 5 derniers, ligne d'arrivée sur un plat. La même graine donne toujours la
même piste.

### Étoiles

Placées sur les plats et au bas des montées, à hauteur de roue, jamais juste
avant un volcan (un turbo imprévu ne doit pas envoyer la voiture dans la lave
ni au-delà du plat de réception). Une étoile ramassée disparaît et réapparaît
10 s plus tard.

### Volcans

Cône solide (deux pentes) avec un cratère de lave au centre. La lave est un
capteur Matter.js : toute roue ou châssis qui le touche déclenche le respawn.
Fumée et bulles de lave animées en rendu.

### Points sûrs

Toutes les 0,5 s, si la voiture a les deux roues au sol, est à l'endroit, et
n'est pas dans une tranche `rampe-volcan`, sa position est enregistrée comme
dernier point sûr.

## 5. Voitures et physique

### Modèle Matter.js

- Châssis : rectangle à coins arrondis (chamfer), masse fixée.
- Deux roues : cercles, friction élevée, reliées au châssis par des
  contraintes ressort (raideur et amortissement réglés dans `config.ts`).
- Toutes les voitures ont la même masse et les mêmes réglages ; seules les
  couleurs et l'IA diffèrent.
- Gravité : environ la moitié de la Terre (valeur dans `config.ts`), pour des
  sauts hauts et lents.
- Roues lourdes par rapport au châssis et ressorts fermes pour retomber sur
  les roues la plupart du temps.

### Conduite

- Doigt posé : couple moteur sur les deux roues, limité par une vitesse
  angulaire maximale (= vitesse max de la voiture).
- Doigt levé : couple nul + léger frein moteur. Jamais de marche arrière.
- En l'air (aucune roue au sol) : une rotation corrective douce ramène le
  châssis vers l'horizontale. Le doigt n'a aucun effet sur l'inclinaison.

### Respawn

Déclencheurs : lave touchée ; châssis à l'envers (angle > 110°) pendant plus
de 1 s ; châssis sous le sol ; vitesse absurde (> 3× la vitesse max turbo).
Effet : la voiture est replacée au dernier point sûr, à l'horizontale, vitesse
nulle, roues au sol, avec 0,5 s d'invulnérabilité aux collisions entre voitures
pour ne pas être repoussée dans le volcan. Effet visuel d'étincelles et son
rigolo. Aucun message.

Garde-fou : si aucun point sûr n'existe (début de course), le point sûr est la
grille de départ.

### Collisions entre voitures

Les 5 voitures partagent le même monde et se poussent réellement. Pour que ça
reste drôle : masses égales, châssis arrondis, restitution faible. Une voiture
en invulnérabilité post-respawn traverse les autres pendant 0,5 s (filtre de
collision), mais pas le sol.

### Étoile / turbo

Capteur ; ramassée par n'importe quelle voiture. Turbo 3 s : vitesse max
+50 %, couple +50 %, flammes derrière, bruit de fusée. Un nouveau turbo
pendant un turbo remet le compteur à 3 s.

### Arrivée

Ligne avec drapeau à damier sur un plat. Quand Galahad la passe : son de
trompette, l'état passe à `finished`, la physique tourne encore 1,5 s pour que
la voiture roule en roue libre, puis le podium s'affiche. Les adversaires qui
n'ont pas fini sont classés par distance parcourue le long de la piste.

## 6. Adversaires (IA)

- Pilotes : Pablo, Diego, Timothée, Matthis, Malo, Liam, Mathilde, Suzanne.
  Chacun a une couleur fixe (voir `cars/pilots.ts`), un casque de la même
  couleur, et un "caractère" : facteur d'accélération (0,85 à 1,0) et
  probabilité de lever le pied avant une rampe (prudent / fonceur).
- À chaque course, 4 pilotes sont tirés au hasard (graine indépendante de la
  piste).
- Conduite : accélère par défaut ; lève le pied brièvement avant certaines
  rampes selon son caractère ; vise les étoiles sur sa trajectoire.
- Élastique (logique pure, `ai/rubberband.ts`) : calcule un facteur de
  couple à partir de l'écart de progression avec Galahad.
  - Écart > +X m devant Galahad : facteur réduit progressivement jusqu'à 0,6.
  - Écart < −X m derrière : facteur augmenté jusqu'à 1,3 (turbo invisible,
    sans flammes).
  - Dans la fenêtre : facteur = caractère.
  - X et les bornes dans `config.ts`. Objectif mesurable : sur 20 courses
    simulées, Galahad (modélisé comme un pilote moyen) finit 1er ou 2e au
    moins la moitié du temps et dernier moins d'une fois sur 10.
- Les robots respawnent exactement comme Galahad.
- Classement : par progression le long de la piste (abscisse curviligne),
  recalculé chaque image.

## 7. Interface et rendu

### Rendu

- Caméra : suit Galahad avec un décalage vers l'avant proportionnel à la
  vitesse, lissé. Zoom fixe, calculé pour que la hauteur visible couvre les
  plus hauts sauts.
- Décor : ciel noir étoilé (parallaxe lente), Terre au loin, sol gris lunaire
  avec cratères décoratifs, piste marquée par des plots lumineux.
- Voitures : carrosserie, bandes, vitre, pilote avec casque coloré, roues qui
  tournent. Prénom en petit au-dessus de chaque adversaire.
- Effets : flammes de turbo, poussière à l'atterrissage, étincelles de respawn,
  lave qui bouillonne, fumée des volcans, confettis sur le podium si Galahad
  gagne.
- Résolution : canvas à la taille CSS × devicePixelRatio, plafonné à 2 pour
  préserver les performances.

### Écrans (HTML)

- **Titre** : nom du jeu, voiture de Galahad qui rebondit (canvas), très gros
  bouton rond « JOUER » avec drapeau, petit bouton son, petit bouton « AUTRE
  PISTE » (nouvelle graine) avec une icône de dé.
- **Décompte** : 3, 2, 1, PARTEZ en plein écran, un son par chiffre. Le doigt
  peut déjà être posé ; la voiture ne part qu'à PARTEZ.
- **HUD** : en haut à gauche la position en très gros (« 1er », « 2e »… avec
  une petite voiture bleue) ; en haut au centre une barre de progression avec
  les 5 petites voitures ; en haut à droite le chrono en gros chiffres
  (mm:ss). Petit bouton son en bas à droite, assez loin des zones de jeu.
- **Podium** : les 3 premiers sur des marches avec prénom et médaille ;
  Galahad toujours affiché (sur le podium ou à côté avec sa place) ; son temps
  en gros chiffres ; gros bouton « ENCORE » (même piste) et bouton « MENU ».
- **Orientation** : si portrait, écran plein avec un dessin de tablette qui
  tourne et le mot « TOURNE ». Le jeu est en pause.
- Tous les boutons font au moins 96 px de côté. Aucun texte indispensable à la
  compréhension ; les mots sont courts et accompagnés d'une icône.

### Entrée tactile

Pointer events sur le canvas. Doigt posé = accélérer ; plusieurs doigts =
toujours accélérer ; tous levés = ralentir. `touch-action: none`, zoom et
défilement désactivés, menu contextuel désactivé, plein écran demandé au
premier toucher (si refusé, on continue).

## 8. Audio

Web Audio, tout synthétisé :

- Moteur : oscillateur dont la hauteur suit la vitesse, volume faible.
- Turbo : bruit filtré type fusée.
- Étoile : « ding » arpégé. Gros saut (temps en l'air > 0,6 s) : « boing ».
- Choc entre voitures (impulsion > seuil) : « pof », avec un délai minimal
  entre deux « pof ».
- Respawn : glissando descendant puis « pop ». Arrivée : petite trompette.
  Décompte : bip, bip, bip, bip aigu.
- Musique : boucle courte de 8 mesures, mélodie simple et joyeuse, volume
  modéré, démarre à l'écran titre après le premier toucher.
- Bouton son : coupe tout ; choix mémorisé dans `localStorage`.
- L'`AudioContext` est créé et repris au premier geste utilisateur. Si le son
  ne démarre pas, le jeu continue sans.

## 9. Réglages et calibration

Toutes les constantes vivent dans `config.ts`. La longueur de piste par
défaut est calculée à partir de la vitesse de croisière de Galahad :
`longueur = vitesse_croisière × 150 s`, puis ajustée après les premiers tests
réels avec lui. Un paramètre d'URL `?len=` et `?seed=` permettent d'essayer
d'autres longueurs et pistes sans rebuild.

## 10. Robustesse

- Garde-fou de vitesse et respawn sur valeurs absurdes (voir §5).
- Pas plus de 4 pas physiques par image.
- Pause automatique en arrière-plan et en portrait.
- Redimensionnement : le canvas et le HUD suivent la fenêtre.
- Si Web Audio échoue : jeu silencieux, bouton son grisé.
- Si Matter.js lève une exception dans un pas : log console, respawn de
  toutes les voitures, la course continue.
- Service worker : cache de l'application au premier chargement ; mise à jour
  en arrière-plan ; jamais de blocage au lancement.

## 11. Tests

Vitest (logique pure) :

- Piste : même graine → même piste ; longueur dans ±5 % de la cible ; pente
  max respectée ; pas de volcan dans les zones interdites ; plat entre deux
  volcans ; étoiles jamais juste avant un volcan ; arrivée sur un plat.
- Classement : ordre correct par progression ; égalités stables.
- Respawn : choix du dernier point sûr ; repli sur la grille au début.
- Élastique : facteur dans les bornes ; monotone en fonction de l'écart.
- Pilotes : 4 tirés sans doublon, Galahad jamais parmi eux, couleurs uniques.
- Simulation de course (modèle simplifié sans Matter.js) : objectif de
  répartition des places de Galahad sur 20 courses.

Playwright (navigateur Chromium à la taille de la tablette, 2560×1600 logique
ou équivalent CSS) :

- Le titre s'affiche, le bouton JOUER lance le décompte puis la course.
- Doigt simulé posé 3 s : la voiture avance (progression > 0).
- Capture d'écran de chaque écran (titre, course, podium) envoyée au papa.
- Portrait → écran « TOURNE » ; retour paysage → reprise.
- Performance : au moins 50 images/s en moyenne sur 10 s de course en
  Chromium headless, comme indicateur (la tablette sera vérifiée à la main).

## 12. Déploiement

- Branche `ccr-5b6fabc4-n96ofo`, commits par étape.
- Vercel si le compte est accessible, sinon GitHub Pages via Actions
  (`npm ci && npm run build`, publication de `dist/`).
- PWA : `manifest.webmanifest` (nom, icône SVG, `display: fullscreen`,
  `orientation: landscape`), service worker généré par le plugin Vite PWA.
- Procédure pour le papa : ouvrir l'adresse dans Chrome sur la tablette, menu
  ⋮ → « Ajouter à l'écran d'accueil ».

## 13. Étapes jouables

1. Voiture bleue et rouge sur la Lune, un doigt, sauts, caméra, décor.
2. Volcans, respawn, ligne d'arrivée, chrono.
3. Étoiles et turbo.
4. Les 4 copains, chocs, position, barre de progression, élastique.
5. Titre, décompte, podium, sons, musique, PWA, déploiement.
6. Calibration (durée, difficulté) d'après les retours de Galahad.

Chaque étape se termine par des tests verts, une capture d'écran et une
version déployée.

## 14. Hors périmètre (pour plus tard)

Autres voitures, autres décors, mode deux joueurs, sauvegarde des meilleurs
temps, choix du nombre d'adversaires, fantôme de la meilleure course.
