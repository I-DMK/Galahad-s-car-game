# Course Lunaire de Galahad — addendum « présentation »

Date : 2026-10-22
Statut : **brouillon, en relecture par le papa** (à valider section par section, comme l'addendum « bouton saut »).
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

Trois options, **décision du papa** :

- **(A) Générer de nouveaux sprites** à nos proportions : carrosserie basse et longue (rapport 2,2 × 0,7), arches prévues pour une roue de 0,45 m, empattement à 68 % de la longueur, pilote casqué au tiers arrière, vue de côté stricte, fond transparent, nez à droite. Le papa les génère avec l'outil de son choix ; un gabarit SVG des proportions (`docs/sprites-gabarit.svg`) est fourni par la tâche pour les contrôler. Résultat le plus propre, demande une passe de génération par pilote.
- **(B) Reprendre les sprites Grok** tels quels, carrosserie à 2,87 m, roue PNG au rayon physique. Zéro génération, aspect « grosses roues » à valider. Recommandé comme **essai de 30 minutes** (Step 0 de la tâche) pour juger sur capture avant de choisir A ou C.
- **(C) Garder le dessin par code** et l'améliorer (dégradés, ombre portée, reflet). Le moins cher, le moins joli.

Recommandation : B en essai, puis A si l'essai déplaît. Dans tous les cas la carrosserie se dessine centrée sur le châssis physique, et la roue PNG remplace le 48-gone à rayons.

### 1.4 Correspondance des couleurs (amende tâche 5a, palette)

Les sprites Grok portent leur couleur dans l'image. La palette validée en 5a (aucun copain bleu, cyan, turquoise ou violet ; casque assorti ; contraste ≥ 3:1 sur le ciel) reste la règle. Correspondance proposée par teinte :

| Notre pilote | Couleur 5a | Sprite Grok | Teinte du sprite |
|---|---|---|---|
| Galahad | bleu | `galahad.png` | bleu |
| Pablo | rouge | `liam.png` | rouge |
| Diego | vert | `pablo.png` | vert |
| Matthis | jaune | `malo.png` | jaune |
| Malo | orange | `timothe.png` | orange |
| Liam | rose | `diego.png` | rose |
| Timothée | blanc | **aucun** | à générer (option A) ou repli par code |

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
| **8b (nouvelle)** | **Images** : `assets.ts`, carrosseries et roue, flammes, étoile, ombre au sol, budget de taille, repli par code ; Step 0 = essai option B sur capture, décision A/B/C du papa | écrans |
| 10 | Titre avec les copains, décompte, pause, orientation, **police** | écrans |
| 11 | Podium | écrans |
| **Jalon « démo tablette »** | Galahad lance une course seul depuis le titre, reconnaît les voitures, voit le podium. Le papa filme 30 s. C'est le succès défini par le spec §1. | |
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

## 8. Questions ouvertes pour le papa

1. Option A, B ou C pour la géométrie des sprites (§1.3), après l'essai B sur capture ?
2. Timothée en blanc : génération d'un sprite, ou repli par code tant qu'il n'existe pas ?
3. Le jalon « démo tablette » avant l'audio (ordre proposé) ou après ?
4. Garder `JUMP_BUFFER` à 0,1 s (décision P2) ou l'essayer à 0,18 s comme Grok, sur la tablette ?
