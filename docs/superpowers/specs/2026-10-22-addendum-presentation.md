# Course Lunaire de Galahad — addendum « présentation »

Date : 2026-10-22
Statut : **VALIDÉ par le papa** le 2026-10-22 (recommandations de la session acceptées ; décisions reportées au §1.3, §1.4, §6 et §8).
Amende : le spec du 2026-10-20 (§2, §8, §12), l'addendum plan B (`2026-10-21-plan-b-addendum.md`, §3.1, §3.2, §4) et le plan B partie 3 (tâches 10, 13, 16). En cas de contradiction, ce document l'emporte. Tout ce qui n'est pas repris ici reste inchangé, en particulier la physique, les volcans, les étoiles, le saut (5e), les copains (6) et l'élastique (7).

## 0. Origine et intention

Le papa a fait reproduire le jeu par Grok à partir d'un prompt, en une heure (archive du 2026-10-22). Avis donné en session : le jeu Grok est un runner cinématique sans physique, à piste fixe (arrivée à 714–717 m, 50 s de course quelle que soit la graine) et à élastique total (les quatre copains franchissent l'arrivée dans le même dixième de seconde, Galahad finit entre 1er et 3e quoi qu'il fasse). Rien de cela n'est repris. En revanche, il est **beaucoup plus agréable à regarder**, pour trois raisons que ce document reprend :

1. des **images** pour les voitures, la roue, les flammes, l'étoile et la Terre, au lieu de dessins par code ;
2. un **écran titre** qui montre les copains tirés au sort, et la **Terre dans le ciel** ;
3. une **police arrondie** (Fredoka) sur tous les textes.

Et une leçon de méthode : presque tout ce qui plaît chez Grok est déjà dans notre plan B, partie 3 (position et barre en 8, titre et décompte en 10, podium en 11, audio en 12, installation en 13, décor en 16). On n'a pas un problème de conception, on a un problème de **rythme** sur la présentation. Le §5 allège la méthode pour ces tâches.

Ce qui définit le succès :

- Galahad reconnaît sa voiture et celles des copains au premier coup d'œil, sur la tablette, et sait contre qui il court avant de partir.
- Le jeu « a l'air fini » dès l'écran titre, sans qu'une seule mesure physique change.
- Le jalon **« démo tablette »** (§6) est atteint avant le décor.

Déjà en place, donc **pas rouverts** ici : les prénoms au-dessus des copains (`src/render/car.ts`, depuis la 5b) ; la mémoire d'appui du saut (`JUMP_BUFFER` = 0,1 s, décision P2 de la 5e ; Grok garde 0,18 s, à revoir seulement si Galahad « appuie trop tôt » sur la tablette) ; la téléportation après une deuxième chute au même volcan (`RESPAWN_AFTER_VOLCANO_BACK`).

## 1. Images pour les voitures (amende spec §2 « sans fichiers d'images » et §8 « Rendu »)

### 1.1 Principe

Le spec interdisait les fichiers d'images pour tout dessiner par code. Cette règle est **levée pour les sprites** listés ci-dessous, et pour eux seulement. Le reste (piste, ciel, lave, particules, écrans) reste dessiné par code.

- La physique ne change pas d'un bit : les sprites se posent sur les poses que le moteur fournit déjà (`CarView` : centre et angle du châssis, centre et angle de chaque roue). Les empreintes de Galahad seul (`tests/helpers/fingerprint.ts`) restent identiques.
- **Carrosserie et roues séparées**, comme chez Grok : un PNG de carrosserie par pilote (sans roues), un PNG de roue commun, tourné de l'angle que Matter donne à chaque roue. Les roues sont donc à leur vraie position physique, suspension comprise.
- **Repli par code** : si une image manque ou n'a pas chargé, `drawCar` dessine la voiture comme aujourd'hui. Les tests unitaires de rendu couvrent les deux chemins ; sous jsdom, aucune image ne charge, c'est le chemin de repli qui est testé, plus un faux `Image` pour le chemin sprite.

### 1.2 Fichiers (`public/sprites/`)

| Fichier | Rôle | Source |
|---|---|---|
| `galahad.png`, `<id>.png` × 6 | carrosserie + pilote casqué, sans roues | archive Grok (voir 1.4) ou génération |
| `wheel.png` | roue, vue de côté, fond transparent | archive Grok |
| `flame-0.png` … `flame-3.png` | 4 images de flamme de turbo | archive Grok |
| `star.png` | étoile | archive Grok (facultatif : le dessin par code reste correct) |
| `earth.png` | la Terre, pour le décor (§3) | archive Grok |

- **Budget** : les PNG de l'archive font 1069 × 600 px et ≈ 500 KB chacun, la Terre 1,1 MB, soit ≈ 5 MB en tout. **Inacceptable** pour un premier chargement sur tablette et pour le cache PWA. Ils sont **réduits à 512 px de large** (roue, étoile, flammes 256 px, Terre 384 px) et recompressés : **≤ 60 KB par carrosserie, ≤ 400 KB en tout**. Un test (`tests/deps.test.ts` ou `tests/assets.test.ts`) vérifie la taille totale du dossier pour que le budget tienne dans la durée.
- **Chemins** : préfixés par `import.meta.env.BASE_URL` (le site vit sous `/Galahad-s-car-game/`). Les sprites entrent dans le cache du service worker à la tâche 13.
- **Chargement** : `src/render/assets.ts`, `loadArt(): Promise<Art>`, lancé au démarrage en parallèle de la création de la piste ; une image en échec devient `null` (repli par code, jamais d'exception). L'écran titre n'attend pas les images : elles apparaissent quand elles sont prêtes. En debug, `__game.art` expose ce qui a chargé (e2e).

### 1.3 Géométrie : le problème à trancher

Les sprites Grok ne correspondent pas à notre voiture. Mesuré sur `galahad.png` : empattement = 52,3 % de la largeur de l'image, rayon de roue = 9 % de la largeur. Nos constantes physiques, calibrées et **intouchables** : `CAR_LENGTH` 2,2 m, `WHEEL_BASE` 1,5 m, `WHEEL_RADIUS` 0,45 m.

- Pour faire coïncider l'empattement du sprite avec les roues physiques, la carrosserie se dessine sur **2,87 m** de large, soit 0,33 m de débord à chaque bout du châssis de 2,2 m : visible seulement quand deux voitures se touchent (les sprites se chevauchent un peu avant le choc).
- À cette échelle, les passages de roue du sprite font 0,26 m de rayon ; notre roue de 0,45 m **dépasse largement** des arches. L'aspect est à juger sur capture, pas à deviner.

**Décision du papa : option A, générer de nouveaux sprites à nos proportions.** Les options écartées, pour mémoire : (B) reprendre les sprites Grok tels quels, carrosserie à 2,87 m et roues 1,7 fois plus grandes que leurs arches, aspect « monster truck » prévisible sans essai ; (C) garder le dessin par code et l'améliorer, le moins cher et le moins joli.

Pourquoi A : notre voiture a des proportions de buggy (roues de 0,9 m de diamètre pour une caisse de 0,7 m de haut), parce que la physique a été calibrée ainsi et qu'on n'y touche pas. Aucun sprite pensé pour une citadine n'ira ; un sprite généré sur nos proportions ira du premier coup, et un buggy lunaire est crédible sur la Lune.

Cahier des charges des sprites à générer :

- **sept carrosseries** (Galahad et les six copains) dans la **même passe**, même style, même angle, même pilote casqué : vue de côté stricte, nez à droite, fond transparent, **sans roues** (arches vides) ;
- caisse basse et longue (rapport 2,2 × 0,7), arches prévues pour une roue de 0,45 m de rayon, empattement à 68 % de la longueur, pilote casqué au tiers arrière ;
- couleurs de la palette 5a (Galahad bleu à bandes rouges et casque rouge ; Pablo rouge, Diego vert, Timothée blanc, Matthis jaune, Malo orange, Liam rose ; casque assorti à la carrosserie) ;
- un **gabarit SVG des proportions** (`docs/sprites-gabarit.svg`, fourni par la tâche 8b, Step 0) sert à contrôler chaque image avant de la réduire au budget du §1.2.

Le papa les génère avec l'outil de son choix, **dès maintenant, en parallèle des tâches 5e, 6 et 7**, pour qu'elles soient prêtes à la 8b. Les sprites Grok de `assets/sprites/` restent le repli si la génération tarde (option B, à juger sur capture dans ce seul cas). La carrosserie se dessine centrée sur le châssis physique ; la roue PNG (`wheel.png` de Grok, indépendante de la géométrie) remplace le 48-gone à rayons.

### 1.4 Correspondance des couleurs (amende tâche 5a, palette)

Les sprites portent leur couleur dans l'image. La palette validée en 5a (aucun copain bleu, cyan, turquoise ou violet ; casque assorti ; contraste ≥ 3:1 sur le ciel) reste la règle et s'impose aux sprites générés (option A). La correspondance ci-dessous ne concerne que les sprites Grok rangés dans `assets/sprites/` en repli :

| Notre pilote | Couleur 5a | Sprite Grok | Teinte du sprite |
|---|---|---|---|
| Galahad | bleu | `galahad.png` | bleu |
| Pablo | rouge | `liam.png` | rouge |
| Diego | vert | `pablo.png` | vert |
| Matthis | jaune | `malo.png` | jaune |
| Malo | orange | `timothe.png` | orange |
| Liam | rose | `diego.png` | rose |
| Timothée | blanc | **aucun** | repli par code tant que le sprite généré n'existe pas |

Les sprites turquoise (`kaiden.png`) et violet (`matthis.png`) sont **exclus** par la règle 5a. Les constantes `color` des pilotes servent encore aux points de la barre de progression, au podium et au prénom : si la teinte d'un sprite s'écarte visiblement de sa constante, c'est **la constante qui s'aligne sur le sprite**, sous les mêmes tests de contraste ; les coloris sont alors re-validés par le papa comme en 5a. Le `helmet` d'un pilote à sprite n'est plus dessiné (le casque est dans l'image) ; la constante reste pour le repli.

### 1.5 Flammes, étoile, ombre

- Flammes de turbo : les 4 images en boucle à ≈ 14 images/s, à l'arrière de la carrosserie, à la place de `drawFlames`. Repli par code inchangé.
- Étoile : `star.png` si présent, sinon `drawStar`. Même taille qu'aujourd'hui.
- **Ombre au sol** : ellipse sombre sous chaque voiture, à la hauteur du sol (`heightAt`), qui rétrécit et s'éclaircit avec la hauteur de vol (comme chez Grok). C'est le détail qui rend un saut lisible. Dessinée par code, derrière les roues.

## 2. Écran titre et police (amende spec §8 « Écrans », tâche 10)

- **Les quatre copains sur le titre.** Sous le nom du jeu et à côté de la voiture de Galahad qui rebondit : les quatre copains tirés pour cette graine, chacun avec sa voiture (sprite, ou dessin par code) et son prénom, dans l'ordre de la grille. Pas de mot de caractère (« fonceur ») : Galahad commence tout juste à lire, le prénom suffit. AUTRE PISTE retire les copains.
- **Police arrondie Fredoka** (licence SIL OFL), **auto-hébergée** dans `public/fonts/` (les deux `woff2` latin 600 et 700 de l'archive, ≈ 20 KB chacun), déclarée en `@font-face` dans `index.html` avec `font-display: swap`. Utilisée par le HUD, les écrans et les textes canvas (prénoms, « Arrivée »). Pour le canvas, `document.fonts.load('700 20px Fredoka')` au démarrage ; tant qu'elle n'est pas prête, `system-ui` : aucun texte n'attend la police. Aucune requête réseau après le premier chargement (spec §1).
- Reste inchangé : boutons ≥ 96 px, bouton saut ≥ 140 px, aucun bouton pendant la course hormis le saut, mots courts.

## 3. La Terre dans le ciel (amende addendum plan B §3.2, tâche 16)

Un calque de plus dans `src/render/decor.ts`, derrière son drapeau `DECOR_EARTH: 1` comme les autres : la Terre (`earth.png`, repli : disque bleu avec un croissant d'ombre), en haut à droite, diamètre ≈ 22 % de la plus petite dimension du tampon, parallaxe 0,02 (elle bouge à peine). Dessinée après le ciel et avant les montagnes, une `drawImage` par image, pas de pré-rendu. Le papa mesure le fps comme pour les autres calques.

## 4. Ce qui n'est pas repris de Grok (pour mémoire)

- L'élastique total et la vitesse turbo des copains dès que Galahad arrive. Notre tâche 7 garde un élastique mesuré (52 % de victoires après « étoiles pour tous »).
- La piste écrite à la main. La nôtre est générée, 2 à 3 minutes.
- L'absence de physique (pas de chocs, de suspension, de retournement), les téléportations des copains bloqués, le ratage volontaire des trous.
- Le lien d'installation iOS en dur (la tablette est sous Android ; la tâche 13 couvre la PWA).
- Le gabarit à soixante dépendances. Une seule dépendance d'exécution chez nous, et ça reste.

## 5. Méthode : deux régimes (amende addendum plan B §4)

La rigueur du plan B a payé sur la physique : 0 chute doigt posé sur 7 525 historiques, tremblement éliminé, chocs réels. Elle coûte trop cher sur la présentation. À partir de maintenant :

| Régime | Tâches | Ce qu'on garde | Ce qu'on retire |
|---|---|---|---|
| **Physique et course** | 5e, 6, 7 | spec, tests unitaires et lents, trois relectures, registre, empreintes | rien |
| **Écrans et décor** | 8, 8b (sprites), 10, 11, 12, 13, 16 | tests unitaires (jsdom) et e2e, **une** relecture (`code-review`), une capture d'écran par tâche validée par le papa sur la tablette | suites lentes, relecture adversariale, registre détaillé (une ligne dans la passation suffit) |

Une tâche de présentation qui touche à la simulation (par exemple un événement de plus dans `stepRace`) repasse au régime physique pour cette partie-là : l'empreinte de Galahad seul doit rester identique.

## 6. Ordre dans le plan B et jalon « démo tablette »

| Tâche | Contenu | Régime |
|---|---|---|
| 5e | Bouton saut et étoiles hautes | physique |
| 6 | Conduite des robots | physique |
| 7 | Élastique | physique |
| 8 | Position, barre de progression, classement | écrans |
| **8b (nouvelle)** | **Images** : Step 0 = gabarit SVG des proportions et contrôle des sept sprites générés par le papa ; `assets.ts`, carrosseries et roue, flammes, étoile, ombre au sol, budget de taille, repli par code | écrans |
| 10 | Titre avec les copains, décompte, pause, orientation, **police** | écrans |
| 11 | Podium | écrans |
| **Jalon « démo tablette »** | Galahad lance une course seul depuis le titre, reconnaît les voitures, voit le podium. Le papa filme 30 s. C'est le succès défini par le spec §1. **Avant l'audio** (décision) : les trois critères n'ont pas besoin de son, et l'audio est la tâche la plus exposée aux surprises de tablette (déblocage de l'AudioContext, clics, volume) ; une base muette filmée sert de référence. | |
| 12 | Audio | écrans |
| 13 | PWA (cache des sprites et de la police) | écrans |
| 15, 16 | Cratères, calques de décor **+ Terre** | écrans |
| 17 | Relecture finale | |

Le plan d'implémentation de la 8b et les amendements des tâches 10, 13 et 16 s'écrivent à partir de ce document (skill writing-plans), au régime « écrans ».

## 7. Tests d'acceptation

- **Images** : chaque sprite absent → repli par code sans exception (jsdom) ; faux `Image` chargé → `drawImage` appelée avec la bonne taille et au bon angle, roue tournée de l'angle Matter ; taille totale de `public/sprites/` ≤ 400 KB ; e2e : `__game.art` complet sur la tablette simulée, capture `course-sprites.png`.
- **Déterminisme** : empreinte de Galahad seul identique avant et après la 8b (le rendu ne touche pas à la simulation).
- **Titre** : les quatre copains du tirage de la graine affichés dans l'ordre de la grille, avec leur prénom ; AUTRE PISTE les change ; capture `titre.png`.
- **Police** : aucune requête hors du site ; texte visible avant le chargement de la police (jsdom : `document.fonts` absent → `system-ui`).
- **Terre** : drapeau à 0 → rien de dessiné ; fps mesuré par le papa.
- **Couleurs** : tests de palette de la 5a toujours verts après tout alignement de constante sur un sprite.
- **Démo tablette** : vidéo de 30 s du papa, jointe à la passation (ou son lien).

## 8. Décisions du papa (2026-10-22)

1. **Géométrie des sprites : option A**, sept sprites générés à nos proportions, dans la même passe (§1.3). Les sprites Grok restent en repli.
2. **Timothée en blanc : réglé par la décision 1.** Généré avec les six autres ; repli par code tant que le sprite n'existe pas.
3. **Jalon « démo tablette » avant l'audio** (§6).
4. **`JUMP_BUFFER` reste à 0,1 s** (décision P2 de la 5e). Les 0,18 s de Grok compensent un saut sans physique ; chez nous la condition « roue au sol » s'appuie déjà sur l'antirebond de 0,1 s, qui élargit la fenêtre réelle. Un tampon plus long ferait partir à l'atterrissage un appui donné en l'air que l'enfant n'a plus en tête, parfois juste avant un volcan. À rouvrir seulement si Galahad est observé « appuyer trop tôt » sur la tablette ; ce sera une constante à changer.
5. **Ordre inchangé** : reprise par la 5e, puis 6 et 7 (le retour tablette portait sur le jeu, pas sur l'aspect), les écrans ensuite au régime allégé ; la 8b peut se faire dans la même session que la 8. La génération des sprites par le papa se fait en parallèle.
