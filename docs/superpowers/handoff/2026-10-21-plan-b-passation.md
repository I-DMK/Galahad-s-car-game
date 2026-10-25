# Passation — Plan B (Course Lunaire de Galahad)

Mis à jour à la fin de chaque tâche. Permet à une nouvelle session de reprendre
sans le contexte de celle-ci.

## Où en est-on

- **Plan A terminé** et déployé : https://i-dmk.github.io/Galahad-s-car-game/
  (`?debug=1` fps, `?seed=`, `?len=`). Passation du plan A :
  `2026-10-20-plan-a-passation.md` ; registre : `sdd-ledger-plan-a.md` (lire
  « Décisions prises hors plan » avant de toucher la physique).
- **Brainstorming du plan B fait** avec le papa (2026-10-21, 4 questions) :
  calibration « arriver lancé », puis copains, puis finitions, puis décor ;
  bond lunaire + obstacles reportés en plan C ; 6 pilotes (Suzanne et Mathilde
  retirées), tirés au sort ; skill `code-review` ajouté aux relectures.
- **Addendum du spec** : `docs/superpowers/specs/2026-10-21-plan-b-addendum.md`,
  v3 validée par le papa, v3.1 avec cinq amendements « [plan] » issus de la
  relecture du plan (élan 6 m, capteur de lave +0,3 m, respawn immédiat
  limité à l'élan et la rampe, étoiles sans zones de longueur nulle, turbo de
  Galahad sur le plafond seul, suites lentes en deux scripts).
- **Plan d'implémentation** : `docs/superpowers/plans/2026-10-21-plan-b-copains-et-finitions.md`,
  v2.1 après deux tours de relecture (standard, adversariale avec sonde
  physique, `code-review`). **Validés par le papa** (v2.1 et addendum v3.1)
  le 2026-10-21.
- **Tâche 1 faite et validée** (commits `7967a49`, `f61d2ab`, `ed94190`,
  poussés) : volcan v2 (plat de lancement 32,3 m + élan 6 m, lave à 0,8,
  capteur +0,3 m, butée supprimée), `xLancement`, `nearestVolcanoZone` sur
  `[xLancement, xEnd)`, `forbiddenZone` de transition, `'cratère'` dans
  `SliceType`, étoile « 1 m avant une rampe-saut » retirée dès maintenant
  (voir registre). Décision papa : option (a), plus de volcan juste après une
  rampe-saut (commit `1465d3b`). Déployé (run 28 vert).
- **Tâche 2 faite côté code** (étoiles v2 : `6dd91e2` poussé avec la tâche 1,
  `fc83f97` + tour 2 non poussés) : curseur global, étoiles d'élan, plancher
  de 6, pas recalibré à [60, 100] m (ruling, voir registre : ≈ 9 étoiles par
  course au lieu de 7,3). Trois relectures approuvées après deux tours.
  **Validée par le papa**, poussée (`6dd91e2..bb42472`).
- **Tâche 3 faite côté code** (points sûrs et respawn v2 : `be41a0b`,
  `b58f1ec`, `93b5ad3`, non poussés) : zone interdite `[xLancement + 5,
  xReception)`, cratère refusé, 2e chute dans la lave → `xEnd − 10`,
  retourné/sur le flanc sur l'élan ou la rampe → respawn immédiat ; rulings :
  raison `'side'` véridique, seules les chutes dans la lave comptent pour la
  série, `LANCEMENT_LENGTH = D_LANCE + SAFE_LANCEMENT_MARGIN`. Trois
  relectures approuvées après deux tours ; 256/256 tests, e2e 5/5.
  **Validée par le papa**, poussée.
- **Tâche 5a faite** (pilotes : `3f1f2c4`, `0df3b30`, `ae6d2f1`) :
  `src/cars/pilots.ts` (6 copains, `GALAHAD`, `drawPilots(graine, 4)`
  déterministe sans doublon, graine entière dans [0, 2³²) sinon
  `RangeError`, entrées gelées). Palette : Pablo rouge, Matthis jaune
  (fonceurs), Diego vert, Malo orange (moyens), Timothée blanc, Liam rose
  (prudents) ; casques = nuance de la carrosserie (spec §7 « assorti »),
  aucun copain bleu/cyan/violet (Galahad = « la voiture bleue »), contraste
  ≥ 3:1 sur le ciel `#0a1030`. Trois relectures + `code-review`, deux tours
  de correction ; 286/286 tests. **Validée par le papa** (couleurs et
  caractères gardés), poussée.
- **Tâche 5b faite** (course à 5 voitures : `cf034c6`, `b646e72`,
  `1ec51dc`, `b28ce50`) : `RaceSim.cars` (Galahad = `cars[0]`), grille à
  3,3 m, départs à 0,3 s × rang, driver provisoire (doigt posé après le
  délai), chocs réels, `shiftTarget` (respawn groupé sans chevauchement),
  `rankCars` créé dès la 5b, `simulateRace` v2 (classement, respawns et lave
  par voiture, `meanStepMs`), casque en `helmet`, prénoms, invulnérabilité
  sur toutes les pièces, `rebuildCars` sûr. **Décisions du papa** après la
  relecture adversariale (Galahad doigt posé tombait dans la lave sur 2
  pistes sur 24 à 5 voitures) : **voitures fantômes près des volcans**
  (`[xLancement, xReception + 1,2 m]`, faites dans la 5b : chutes 11 → 2 sur
  les graines 0 à 23), **saut fiabilisé** (nouvelle tâche 5c pour les 2
  chutes « propres » restantes) et **robots polis** (tâche 6). Galahad seul
  reste identique au bit près au plan A. 323/323 tests, e2e 6/6. **Validée
  par le papa**, poussée ; **fps OK sur la tablette** (tâche 9 inutile pour
  l'instant).
- **Tâche 5c faite, validée et déployée avec la 5f** : `ee58194` (harnais de phases), `25ba33f` (congé de 10 m au pied de la rampe-volcan, `RAMP_FOOT_RADIUS`), `db037f3` (tour 1), `8d92584` (doc). 0 chute doigt posé sur 2 924 historiques + 4 601 en turbo dense, 0 chute à 5 voitures graines 0 à 23 ; garde minimale **0,63 m** en fin de turbo au pied (gardée par le papa, assertée ≥ 0,3 m), ≥ 1,72 m sinon ; doigt levé toléré inchangé (≈ 1,25–1,3 s, pas de levier de difficulté pour l'instant, décision du papa). npm test 331/331, test:slow 170/170.
- **Tâche 5f faite, validée et déployée** (rendu interpolé : `38b012f` empreinte figée, `e979930` feat, `9ecf7b2` tour 1, `7e05336` tour 2) : `loop/interpolation.ts` (PoseHistory, lerpAngle), `loop/frame.ts` (runFrame, cameraTarget), `loop/frame-stats.ts` (compteur d'images à 0 et 2+ pas, HUD en `?debug=1`), `sim/present.ts` (presentFrame, stepOutcome, partagés par `Game` et les tests), `tests/game-frame.test.ts` (vraie boucle de `Game` sous jsdom). Rejeu de 12 courses à 5 voitures : épisodes de tremblement sans / avec interpolation 75 / 0 (60,05 Hz), 90 / 0 (59,94 Hz), 13 / 0 (120 Hz), 3 / 1 (60,000 Hz, choc réel, masqué). Galahad seul identique au bit près (empreinte sha1 par pas). npm test 373/373, e2e 7/7, suite lente de l'interpolation 18/18. Non corrigé (choix) : effets, étoiles et flammes avec ≤ 1 pas d'avance sur la voiture dessinée ; stroboscope des roues à 60 Hz.
- **Tâche 5d faite, validée et déployée** (étoiles pour tous : `0cabe30` mesure « avant », `39cda73` feat, `1110f14` tour 1, `da1166f` tour 2) : état d'étoile par voiture (`takenAt[k]`, `isStarActiveFor`, `takeStarFor`), catégorie de collision par voiture (`carCategory(k)`, `CAT.ALL_CARS`, `MAX_CARS` 5), masque des capteurs = OU des voitures actives (empreinte de Galahad seul identique), rendu de l'état vu par Galahad (`GALAHAD_INDEX`), `firstStar`/`firstStarCars`, `starsByCar`. Rattrapage (48 courses doigt posé, appariées) : vainqueur = première étoile 94 % → 58 %, Galahad gagne 81 % → 52 %, place moyenne 1,33 → 1,77, étoiles par voiture 341/128/88/79/67 → ≈ 390 chacune (McNemar p ≈ 4·10⁻⁵) ; mesure à la demande : `npm run test:slow:rattrapage` (≈ 7 min, lignes étiquetées par commit). npm test 386/386, e2e 7/7, test:slow 252/252 (avant sortie du rattrapage).
- **Tâche 5e faite, validée et déployée avec la 5g** (commits `96556a2`…`f435108`) : bouton saut (`applyJump` même hauteur partout ≈ 2,46 m, délai 0,5 s, mémoire 0,1 s, tolérance de sol 0,35 s sur la **piste seule**, front d'appui bouton ou Espace, vol non compté dans le blocage, plafond ≈ 4 s) ; **exactement 3 étoiles hautes à 3,90 m par course** sur des **plats étoile** de 57 m (pas après un volcan, ni dans les 50 m après une rampe-saut ; ancres avancées si un plat ne tient pas) ; toutes les pistes ont changé (`ANCIENNES_PISTES` redonne les anciennes au bit près, empreinte recapturée par ruling R-F10) ; fenêtres ≥ 0,52 s, appuis perdus 0 sauf 0,41 % à 21 m/s tenus ; doigt posé sans saut : 0 chute, 0 étoile haute prise. npm test 485/485, e2e 12/12.
- **Tâche 5g faite, validée et déployée** (fosses de lave : `c6c06e7`…`83f6ff5`) : environ 1 volcan sur 2 est une **fosse de 8 m** à sauter au bouton (garde de 20 m, approche 32,4 m, panneau, halo) ; sans saut 100 % lave, 2 chutes de suite → posée à bord aval + 5 m (≈ 4,4 s perdues) ; zone interdite prolongée à bord aval + 1,5 m, série comptée sur la lave touchée ; **pas de tremplin juste après une double-bosse** (0 chute doigt posé aux tremplins) ; poids des volcans 4 → 3,62 volcans par course (1,86 fosses), 8,50 étoiles basses ; étoiles de réception décalées (plus de survol doigt posé, sauf rare cas en turbo toléré) ; catapulte par un copain tolérée dans les 2 s après un choc (R-F12) ; copains sautent les fosses sans erreur (driver complet en tâche 6). npm test 561/561, e2e 13/13, test:slow vert.
- **Tâche 6 faite, validée et déployée** (conduite des robots : `12a876d` feat, `9558085` test, `452b47b` tour 1, `6874c72` tour 2, `29ed7e8` tour 3, docs jusqu'à `bd2d516`) : `src/ai/driver.ts` (`Driver` → `{ throttle, jump }`), départ à rang × 0,3 + 0,38 s, lever de pied, **robots polis seulement derrière une voiture arrêtée, doigt levé, non fantôme ni invulnérable** (attente cumulée ≤ 3 s), sauts d'étoile haute (`jumpTry`/`jumpSkill`) et de fosse (erreur × 2,5, instant visé centré, plancher 2 m) ; **raté visible** (décision du papa, tour 2) : une erreur trop tardive devient un saut trop tôt du même écart, le copain vole ≈ 1,93 s puis retombe dans la fosse (0 chute sans saut, `SANS_TENTATIVE_MAX_SPEED` retiré) ; zone fantôme d'une fosse dès le plat de garde (confirmée par le papa) ; R-F12 « 2 s après un contact ou pendant le vol qui suit » (confirmé) ; tentative et chutes comptées par volcan à une seule source ; fenêtre de saut de fosse unique (`inFosseJumpWindow`). Mesures (48 graines) : fosses, bras fonceurs 17,5 %, Pablo 19,0 %, Matthis 20,3 %, autres 0 % ; étoiles hautes ratées fonceurs 10,2 %, prudents 3,9 % ; 0 chute de Galahad sauteur parfait, 0 au tremplin ; Galahad seul identique au bit près. Rattrapage doigt posé (tour 1) : **Galahad gagne 12/48** (33/48 avant la 6) → l'élastique (tâche 7) rééquilibre. Relectures : standard, adversariale (mutants), `code-review`, **`security-review`** (aucune vulnérabilité), trois tours. npm test 635/635, test:slow 334/334, e2e 13/13. **Validée par le papa le 2026-10-23, déployée.**
- **Tâche 7 faite, validée et déployée** (élastique : `55c4923` feat, `33f66fe` et `ded61ec` tests et mesures, `eb33308` tour 1, `a1ba837` tour 2, docs jusqu'à `a841607`) : `src/ai/rubberband.ts` (facteur au couple et au plafond des copains, borné [0,6 ; 1,3], 0,15/s, neutre 5 s, plancher ≥ 1 en zone volcan et pré-zone 40 m), **fenêtre = la vue, 20 m devant et 3 m derrière** (D7-2), **`base` des copains entre 0,97 et 1,00** (D7-3), turbo d'un copain plafonné à 1,3 et à 1,0 hors écran devant Galahad (R7-16, `onScreen`) ; `applyDrive(car, throttle, speedFactor, torqueFactor, cfg)`, Galahad couple 1 (empreinte identique) ; **copain poli derrière Galahad doigt levé** (≤ 4 m, hors zone volcan, sans limite de 3 s) **seulement après son premier appui** (décisions du papa). Objectif (20 courses, doigt posé + saut parfait aux fosses) : 1er 6, 1er ou 2e 12, dernier 1, place 2,30, copain à l'écran 56 %, 0 freinage net ; rattrapage 48 courses avant → après : saut parfait place 2,42 → 2,21 (victoires 13 → 17), sans saut 4,85 → 3,88, sauteur 1,42 → 1,23 ; copains ≤ 18,2 m/s (les « 27,3 m/s » de la spec étaient une erreur, R7-1) ; acceptés par le papa : ratés d'étoile haute des copains en peloton (≈ 22 %, tous après un contact), Galahad dernier 9/10 à 30 % de doigt levé (à rejuger avec la difficulté). Quatre relectures, deux tours ; npm test 694/694, test:slow 343/343, test:slow:race 52/52, e2e 13/13. **Validée par le papa le 2026-10-23, déployée.**
- **Test tablette du papa après les tâches 6 et 7** (2026-10-24) : course « trop facile » ; Galahad concentré garde le doigt posé tout le temps ; copains « tous pareils » ; rien de gênant. **Décision du papa** : levier = **plan C, obstacles qui ralentissent** (à sauter au bouton), nouvelle tâche au régime physique **après le jalon « démo tablette »**, avant l'audio ; `ENGINE_BRAKE` écarté (il ne joue que doigt levé).
- **Tâche 8 faite, validée et déployée** (position, barre, classement : `584afe8` feat, `ff051b2` tour 1, `30a1c1d` tour 2, `7942883` tour 3) : `src/cars/ranking.ts` (`DisplayedRank.update(cars, me, t)` : changement de place montré s'il tient 0,5 s ou si l'écart avec la voiture échangée dépasse 2 m, place finale immédiate ; `ordinal` ; `rankEntriesOf` partagé avec le harnais) ; HUD : place très grosse en haut à gauche avec la petite voiture bleue, vide la première seconde ; **barre en cinq couloirs** (décision du papa : une ligne fine par voiture dans l'ordre de la grille, Galahad en haut, bleu et plus épais ; avant, les copains étaient cachés sous Galahad 80 à 97 % du temps) avec un **drapeau à damier** au bout (décision du papa sur capture) ; tailles qui suivent la fenêtre jusqu'à 844 × 390 ; marqueurs déplacés par `transform`. Mesuré : 32 courses, retard d'affichage ≤ 0,53 s, 0 place jamais tenue ; copains visibles 100 % du temps sur la barre. Quatre relectures, trois tours ; npm test 727/727, e2e 15/15. Couleurs des pilotes gardées (Q1 de la 8b), prénom « Timothé » gardé (Q6).
- **Tâche 8b faite, validée et déployée** (images : `41a46f4` chargeur, `38d401a` images, `2b1aae9` dessin, `03cb141` branchement, `188c21c` et `767125b` tour 1, `4d8d6c6` tour 2 ; plan `docs/superpowers/plans/2026-10-24-plan-b-images.md` v1.1) : `src/render/assets.ts` (`loadArt(): Promise<Art>`, 13 images sous `BASE_URL + 'sprites/'`, noms ASCII (`timothé` → `timothe.png`), une image en échec ou muette 8 s → `null`, requête coupée pour libérer l'événement `load`, jamais d'exception) ; `public/sprites/` (7 carrosseries, roue, 4 flammes et étoile sans liseré magenta, `tools/sprites/lisere.py` ; 146 846 octets, budget et propreté des palettes testés ; la Terre reste dans `assets/` pour la 16) ; `drawCar` : carrosserie dans le cadre 2,80 × 1,40 m tournée du châssis, roue PNG tournée de l'angle Matter par-dessus, casque non dessiné avec sprite, flammes image ≈ 14 images/s, étoile image centrée sur son centroïde, **ombre au sol** (rétrécit et pâlit avec la hauteur de vol, aucune au-dessus de la lave, `overLava` dans `track/query.ts`) ; repli par code image par image ; `__game.art`. Mesuré (adversaire) : 8 872 trames, écart au châssis < 0,0002 px ; fps 59,6 avec images / 59,5 sans ; empreinte de Galahad seul identique (une ligne sous `src/sim/` : `id` dans `carView`). Quatre relectures, deux tours ; npm test 811/811, e2e 19/19. Validée par le papa sur capture ; Q3 (flammes), Q4 (étoile), Q5 (ombre, pâle en vol) gardées, à rejuger sur la tablette.
- **Tâche 10 faite, validée sur capture** (écrans : plan `docs/superpowers/plans/2026-10-24-plan-b-ecrans.md` v1.1, BASE `106f714` ; `a25efb0` machine d'états et police, `dbf214b` `Screens`, `07fde7d` scène du titre, `bd36ac8` `Game`, `c1fc143`, `4a52919` e2e, tours `7a2ff47`, `0e1bc81`, `638932e`, puis tour 3 prénoms × 1,8) : `src/loop/states.ts` (machine pure `title | countdown | racing | finished | podium | paused | error`, table testée), `src/ui/screens.ts` (titre, décompte, pause/TOURNE en DOM, créés une fois et cachés par `hidden`, jamais retirés), `src/render/title.ts` + `Renderer.drawTitle` (Galahad qui rebondit devant, les quatre copains de la graine derrière à 3,3 m comme sur la grille, prénoms × 1,8, sprites ou code), `src/ui/font.ts` + Fredoka 600/700 dans `public/fonts/` (`@font-face` dans `index.html`, `font-display: swap`, réécrite sous la base par Vite). `Game` : aucun pas de simulation hors `racing`/`finished` ; décompte 3, 2, 1, PARTEZ au `pointerdown` de JOUER (doigt gardé → la voiture part à PARTEZ) ; plein écran au `pointerup` du doigt ; pause par onglet caché, geste retour (`popstate`) ou portrait, reprise toujours par un décompte à 3 (REPRENDRE au `pointerdown`, voile `data-no-pedal`) ; scène figée en pause (effets et caméra compris) ; une entrée d'historique armée au décompte, consommée par MENU (`history.back()`) ; AUTRE PISTE (`Date.now() % 100000`, URL par `replaceState`) ; ARRIVÉE garde ENCORE (même course) et gagne MENU ; version `1.1.0` au titre (`__APP_VERSION__`). Empreinte de Galahad seul identique (sous `src/sim|cars` : `colorHex` et `defaultPilotSeed` déplacés dans `cars/pilots.ts`). Décisions du papa : Q1 e2e par le vrai JOUER, Q2 ENCORE + MENU, Q3 version 1.1.0 puis +1 par tâche déployée, Q4 « Course Lunaire » / « de Galahad », Q5 rangée gardée, prénoms × 1,8, Q6 rebond gardé (à juger sur la tablette), titre en portrait : rien (manifeste de la 13). Mesuré : `drawTitle` 0,136 ms par image contre `draw` 0,153 ms, 59–61 fps. Quatre relectures (standard, adversariale à 36 + 15 mutants, `code-review`, `security-review` : aucune vulnérabilité), trois tours ; npm test 863/863 (avant le tour 3), e2e 27/27. **Déployée le 2026-10-25** (session 7, avance rapide `5e97707..86c9518`, run 46 vert, bundle `index-DQ5VrlED.js` = build local à la base, police en 200, npm test 864/864, e2e 27/27, e2e:live 27/27).
- **Tâche 11 faite, validée** (podium + bouton pause : plan `docs/superpowers/plans/2026-10-25-plan-b-podium.md` v1.1, BASE `6e4af78` ; `320bcbc` classement final, confettis, petite voiture, `5c9afc8` écran podium, `def8ce5` branchement et version 1.2.0, `8941832` e2e, `7f5bd32` bouton pause ; tours `8b0e75b`…`b2dfaef`, `2e8635f`, `73f78c6`, `32096cd`) : `finished` → 1,5 s de roue libre en temps de course → `podium` (calque ARRIVÉE retiré) ; classement `podiumView` sur `rankCars` figé à l'entrée (copains non arrivés par progression) ; trois marches (prénom, petite voiture peinte par `drawCar`, médaille SVG), temps en gros, Galahad toujours visible (marche dorée, ou case « 4e »/« 5e » à droite) ; scène figée **sans les voitures de la course** (décision Q5 du papa), seuls les confettis bougent (`Effects.updateConfetti`, 160 confettis, vie ≈ 9,7 s, dessinés après les voitures, seulement si Galahad 1er) ; ENCORE au `pointerdown` et au `click` (un doigt de gaz peut rester posé), MENU au `pointerup` du doigt posé sur lui et au `click`, le click suivant avalé 300 ms (A20 : sinon AUTRE PISTE fantôme au titre) ; petites voitures repeintes à la rotation ; repli en portrait étroit. **Bouton pause ⏸** (demande du papa après la tablette de la 10, exception voulue à « aucun bouton en course ») : en haut à droite sous le chrono, `data-no-pedal`, visible au décompte et en course seulement (`syncPauseButton`), reprise par le décompte comme les autres pauses. Décisions du papa : Q1 à Q3 (pause dans la 11, sous le chrono, décompte et course), Q4 case « 4e » gardée, Q5 fond sans voitures, Q6 reste bon. Mesuré : 0,88 ms par image au podium avec 160 confettis (2,05 ms en course), 4 tailles d'écran sans recouvrement, 3 tours sans fuite. Quatre relectures (standard APPROUVÉE, adversariale 41 mutants tués, `code-review` 10 remarques, `security-review` aucune vulnérabilité), trois tours ; npm test 898/898, e2e 31/31.
- **Addendum « présentation »** (2026-10-22, `docs/superpowers/specs/2026-10-22-addendum-presentation.md`,
  **VALIDÉ par le papa le 2026-10-22**, décisions au §8) : après comparaison avec la reproduction
  Grok du jeu (archive du papa), reprise de sa présentation seulement : sprites
  pour les voitures, la roue, les flammes, l'étoile et la Terre (nouvelle tâche
  8b, option de géométrie A/B/C à trancher sur capture), copains sur l'écran
  titre et police Fredoka (tâche 10), Terre dans le ciel (tâche 16), méthode
  allégée pour les tâches d'écrans et de décor, jalon « démo tablette » après la
  tâche 11. Rien de la physique, de l'élastique ni de la piste Grok n'est repris.
  Décisions : sprites **générés par le papa** à nos proportions (option A, sept
  voitures dans la même passe, en parallèle des tâches 5e à 7, gabarit SVG fourni
  par la 8b), jalon avant l'audio, `JUMP_BUFFER` gardé à 0,1 s, ordre inchangé
  (reprise par la 5e). **Fichiers rangés** dans `assets/` (hors
  `public/`, non servis) : 6 carrosseries renommées par pilote, roue, étoile, Terre,
  4 flammes (303 KB, réduits et quantifiés) et Fredoka 600/700 (40 KB), voir
  `assets/README.md` ; l'archive Grok elle-même n'est pas dans le dépôt.
  **Prochaine session (décision du papa, 2026-10-22) : les sept sprites, ensemble.**
  Le papa génère les images avec son outil (Claude ne génère pas d'images) ; la
  session fournit le gabarit SVG des proportions (`docs/sprites-gabarit.svg`,
  Step 0 de la 8b avancé), contrôle chaque PNG dessus, efface les roues s'il en
  reste, réduit à 512 px dans le budget du §1.2 et range le résultat
  (`assets/generated/` bruts, `assets/sprites/` réduits, en remplaçant les
  sprites Grok de même nom). Pas de code de jeu dans cette session. À la fin,
  la session indique la suite : reprise du plan B par la 5e (régime physique),
  puis 6, 7, 8 et 8b. Prompt et méthode de génération dans `assets/README.md`.
  **Gabarit fait** (session sprites du 2026-10-22, branche `ccr-919aff50-6z5vz0` partie de
  `claude/gifted-ritchie-ic81ct`) : `docs/sprites-gabarit.svg` (cotes du châssis ; suspension
  mesurée quasi rigide, roues à (±0,75 ; −0,25) m à ±1 cm), `docs/sprites-gabarit-reference.png`
  (image à joindre au générateur), outils `tools/sprites/` (rendu du gabarit, contrôle et réduction
  à 512 × 256 px = cadre de 2,80 × 1,40 m centré sur le châssis, contrat de dessin pour la 8b).
  Contrôle essayé : silhouette du gabarit acceptée, roues dessinées effacées, sprite Grok refusé
  (arches 0,26 m). Prompt mis à jour (image de référence, couleurs exactes de la 5a, bandes
  comprises). **Sept sprites livrés par le papa et contrôlés (2026-10-23)** : bruts dans
  `assets/generated/` (1672 × 941 px), réduits dans `assets/sprites/<id>.png` (512 × 256 px,
  12 à 15 KB, 93 KB les sept ; `assets/sprites/` en tout 212 KB ≤ 400), planche en jeu
  `docs/sprites-planche.png`. Tous acceptés ; arches **serrées** (43,6 à 46,2 cm au lieu de 50 :
  la roue dessinée par-dessus en cache le bord, sans jour visible), tolérance du contrôle passée à
  [43 ; 55] cm ; carrosserie rendue opaque (le générateur livre alpha 250 à 254). `wheel.png`
  corrigée (liseré magenta de 2 px hérité de Grok) ; même liseré sur étoile, Terre et flammes, à
  corriger à la 8b (`assets/README.md`). **Planche validée par le papa le 2026-10-23, arches
  serrées gardées** ; jugement final sur la tablette à la 8b. Branche des sprites fusionnée dans
  `ccr-5b6fabc4-n96ofo` le 2026-10-23 (images, docs et outils seulement, aucun code de jeu).
- **Fusion de la session « sprites » sur la branche déployée** (2026-10-23, autre session, à la demande du papa) : `ccr-5b6fabc4-n96ofo` est à `775dad3` = `568ec91` + addendum « présentation », gabarit, sept carrosseries dans `assets/`, `docs/sprites-*`, `tools/sprites/` (aucun fichier de `src/`, `tests/`, `e2e/` ni de config). **Conséquence** : `git merge --ff-only wip-plan-b` ne passe plus ; faire `git fetch origin ccr-5b6fabc4-n96ofo && git checkout -B ccr-5b6fabc4-n96ofo origin/ccr-5b6fabc4-n96ofo && git merge wip-plan-b` (fusion normale), ou fusionner d'abord `origin/ccr-5b6fabc4-n96ofo` dans `wip-plan-b`. En cas de conflit sur cette passation, **garder les deux côtés** (puce « Addendum « présentation » », ligne « 8b » du tableau, point « 0. Sprites » de « Prochaine action précise »).
- **Retour tablette du papa à 5 voitures** (version 0a78392) : fps OK ;
  « une voiture qui tremble » → **cause trouvée** : rendu sans
  interpolation (`2026-10-21-glitch-tremblement.md`), correctif à faire
  (tâche 5f) ; « le premier qui prend une étoile est irrattrapable » →
  **décisions** : étoiles pour tous, élastique gardé, **bouton saut avancé
  du plan C** : addendum `docs/superpowers/specs/2026-10-21-bouton-saut-design.md`
  **validé par le papa** (tâches 5d, 5e, 6 amendée).
- Consignes de conteneur apprises : le push passe quand la session est en
  mode « accepter les modifications » (le mode auto le classe comme
  déploiement) ; vérifier `git status -sb` avant un push (HEAD détaché au
  démarrage) ; jamais de `git reset`/`checkout`/`stash`/`clean` pendant qu'un
  sous-agent travaille dans l'arbre partagé.
- Branche : `ccr-5b6fabc4-n96ofo` (branche par défaut, déploiement
  automatique à chaque push). Commits signés par le git config local du dépôt
  (`Claude <noreply@anthropic.com>`) avec les trailers `Co-Authored-By` et
  `Claude-Session` fournis par la session courante. **Depuis le 2026-10-23**, la
  branche de déploiement porte un commit de fusion (`775dad3`, session sprites) :
  `wip-plan-b` (partie de `568ec91`) ne s'y fusionne plus en avance rapide, faire
  une fusion normale (`git merge wip-plan-b`, seul conflit possible : cette
  passation, garder les deux côtés). La session de la tâche 6 a été prévenue par
  message le 2026-10-23.

## Réponses de Galahad encore à recueillir (ne bloquent pas)

- « Les volcans, tu veux qu'ils soient un peu plus difficiles à sauter, ou
  qu'ils restent faciles ? » → dose `L_ELAN` (tâche 4, addendum §1.6).
- « Sur la Lune, qu'est-ce que tu veux voir ? Choisis-en trois : un drapeau,
  une fusée posée, des gros rochers, des étoiles filantes, un astronaute qui
  fait coucou, des traces de pas. » → tâche 16.

## Tâches du plan B

| Tâche | État |
|---|---|
| 1 géométrie du volcan v2 (lancement, élan 6 m, lave 0,8, capteur +0,3, butée supprimée) | **faite, validée** (+ option (a) : pas de volcan après une rampe-saut) ; push en attente d'autorisation |
| 2 étoiles v2 (curseur global, étoiles d'élan, plancher 6, pas 60–100) | **faite, validée**, poussée |
| 3 points sûrs et respawn v2 | **faite, validée**, poussée |
| 4 simulations d'acceptation, suites lentes, balayage de dosage | **faite, validée, poussée** → gate tablette **fait** : « un peu facile », L_ELAN 6 conservé |
| 5a pilotes | **faite, validée**, poussée |
| 5b course à 5 voitures, grille, chocs, respawn groupé (+ fantômes près des volcans) | **faite, validée**, poussée → mesure fps du papa |
| 5c (ajoutée) saut fiabilisé | **faite, validée**, déployée avec la 5f |
| 5f (ajoutée) rendu interpolé (tremblement) | **faite, validée**, déployée → test tablette (tremplin + tremblement) |
| 5d (ajoutée) étoiles pour tous | **faite, validée**, déployée |
| 5e (ajoutée) bouton saut et étoiles hautes (+ plats étoile) | **faite, validée**, déployée avec la 5g |
| 5g (ajoutée) fosses de lave (1 volcan sur 2) | **faite, validée**, déployée → test tablette |
| 6 conduite des robots (+ robots polis + sauts des copains) | **faite, validée, déployée** (2026-10-23) → test tablette |
| 7 élastique (+ suite `test:slow:race`) | **faite, validée, déployée** (2026-10-23) → test tablette fait (2026-10-24) : « trop facile » → plan C (obstacles) après la démo tablette |
| 8 position, barre de progression (cinq couloirs + drapeau), classement | **faite, validée, déployée** (2026-10-24) |
| 8b (ajoutée, addendum « présentation ») images : carrosseries, roue, flammes, étoile, ombre | **faite, validée, déployée** (2026-10-24) ; **validée sur la tablette par le papa** (voitures, arches, flammes, étoile, ombre, roues, barre : « tout est bon ») |
| 9 (conditionnelle) fenêtre glissante de sol | fps OK à 5 voitures → non ; à remesurer avec le décor (tâche 16) |
| 10 machine d'états, titre (copains), décompte, pause, orientation, police | **faite, validée sur capture, déployée** (2026-10-25, run 46, version 1.1.0, e2e:live 27/27) → tablette (rebond Q6, plein écran) |
| 11 podium (+ bouton pause en course, demande du papa) | **faite, validée sur capture** (2026-10-25), déployée en version 1.2.0 (voir registre) → jalon « démo tablette » |
| jalon « démo tablette » | après la 11 |
| 11c (ajoutée, décision du papa) plan C : obstacles qui ralentissent, à sauter au bouton | à faire **après le jalon**, régime physique (spec à écrire avec le papa) |
| 12 audio | à faire |
| 13 PWA et version | à faire |
| 14 e2e tablette, relecture de mi-parcours | à faire |
| 15 tranche cratère | à faire |
| 16 calques de décor | à faire |
| 17 relecture de branche finale, passation | à faire |

## Méthode (exigée par le papa)

- superpowers:subagent-driven-development : un implémenteur frais par tâche
  (il reçoit le plan, l'addendum, le spec, cette passation), un relecteur
  standard frais, un relecteur adversarial frais, **et le skill `code-review`**
  sur le diff de la tâche ; tours de correction (≤ 5) ; rapports ≤ 30 lignes ;
  validation du papa ; passation et registre mis à jour et commités ; push.
- **Quatre relectures par tâche** (décision du papa, 2026-10-23) : standard,
  adversariale (sondes et mutants), skill `code-review` **et skill
  `security-review`** sur le diff de la tâche. Pas de Codex dans le cloud
  (domaines OpenAI bloqués, login à refaire à chaque conteneur) : le papa
  s'en passe. La commande `.claude/commands/xreview.md` (copie de celle du PC
  du papa, avec `code-review` et `security-review` lancés même sans Codex)
  reste disponible.
- Typecheck et tests verts à chaque commit (la CI lance `npm run typecheck`
  puis `npm test` avant de déployer) ; jamais de `.skip`.
- Jamais de PR sans demande explicite.

## Environnement

- `npm test` ≈ 3 min ici (4 cœurs), `jump.test.ts` seul ≈ 3 min (scindé en
  tâche 4). Suites lentes à venir : `npm run test:slow` (≈ 15 min) et
  `npm run test:slow:race` (≈ 25 min).
- Playwright 1.56.1, Chromium pré-installé (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`),
  `playwright.config.ts` existant (webServer `npm run dev`).
- Les skills `superpowers:*` et `code-review` étaient disponibles dans la
  2e session du 2026-10-21 ; s'ils manquent, appliquer la méthode telle que
  décrite ici et dans les plans.
- **Site en ligne testable depuis le conteneur** (2026-10-23) : le domaine `i-dmk.github.io` est autorisé dans le réseau de l'environnement. `npm run e2e:live` rejoue les 13 e2e sur le site déployé (`playwright.live.config.ts`, adresse changeable par `E2E_LIVE_URL`, captures dans `test-results/live-screenshots`). **À lancer après chaque déploiement**, une fois le run GitHub Actions vert ; vérifier aussi que le hash du `index-*.js` servi est celui d'un build local **à la même base** : depuis la 8b (`import.meta.env.BASE_URL` inscrit dans le bundle), comparer avec `VITE_BASE=/Galahad-s-car-game/ npm run build`.
- **Playwright dans le conteneur** (2026-10-24) : Playwright 1.56.1 attend Chromium révision 1194, le conteneur n'a que la 1243 (`/opt/pw-browsers`) : `npm run e2e` brut échoue à `browserType.launch`. Contournement sans toucher au dépôt ni à `/opt` : dossier de liens dans le scratchpad (`chromium-1194`, `chromium_headless_shell-1194`, `ffmpeg-1011` → binaires 1243) et `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers` devant chaque commande Playwright (`npm run e2e`, `npm run e2e:live`). Commande pour le recréer : plan de la 8b, section « Environnement ».
- **Version** (décision Q3 du papa, tâche 10) : `package.json` donne le numéro affiché au titre (`__APP_VERSION__`, `vite.config.ts`). `1.1.0` = tâche 10, `1.2.0` = tâche 11 ; monter d'un cran à chaque tâche déployée. Pas de date ni de SHA : le hash du bundle reste comparable entre le build local et le site.
- **e2e depuis la tâche 10** : le jeu s'ouvre au titre ; chaque e2e passe par le vrai JOUER (`startRace` dans `e2e/helpers.ts`, ≈ 4 s de décompte par test, `npm run e2e` ≈ 3,5 min). Chromium headless accorde le plein écran au `pointerup` : un test qui change la taille de la fenêtre doit d'abord en sortir (`document.exitFullscreen()`, voir le test portrait de `e2e/screens.spec.ts`).
- Clone frais : `npm ci` d'abord. Le clone est superficiel (`--depth 1`) :
  `git fetch origin ccr-5b6fabc4-n96ofo` avant un push.
- Registre de travail des sous-agents (briefs, rapports, paquets de
  relecture) : `.superpowers/sdd/2026-10-21-plan-b-copains-et-finitions/`
  (ignoré par git, perdu avec le conteneur) ; ce qui compte est recopié dans
  `sdd-ledger-plan-b.md`.

## Retour du test tablette (gate après la tâche 4)

Galahad (seul en piste) trouve le jeu « un peu facile, surtout quand on a
juste à appuyer pour avancer », et voudrait plus d'obstacles. Le papa pense
que les copains ajouteront du défi. `L_ELAN` reste à 6 m. À reconsidérer
après la tâche 5b : durcir `ENGINE_BRAKE` (levier continu, voir registre
tâche 4) et, si le défi manque encore, proposer au papa d'avancer une part du
plan C (obstacles qui ralentissent, bouton « bond lunaire »).

## Leçons de la session 7 (2026-10-25, fin de la 10 et tâche 11)

- Le conteneur a redémarré trois fois : les sous-agents se reprennent par `SendMessage` (travail et commits gardés) ; sauvegarder sur `wip-plan-b` après chaque commit d'implémentation.
- Le skill writing-plans n'est pas dans le conteneur : un rédacteur frais écrit le plan au format du plan 10, puis un relecteur l'essaie dans un worktree (il a trouvé 3 importants avant tout code, dont ENCORE au `click` avec un doigt tenu).
- Un doigt de gaz tenu empêche le `click` d'un second doigt (Chromium) : tout bouton de fin de course réagit au `pointerdown` ou au `pointerup` sur lui-même ; un bouton qui fait changer d'écran doit avaler le `click` qui suit, sinon il tombe sur le bouton de l'écran suivant au même endroit (AUTRE PISTE).
- En CDP, lever un doigt parmi deux se fait par `touchEnd` avec les points levés, pas par `touchMove`.
- « Scène figée » vaut aussi pour les minuteries d'effets (bulles, fumée) : figer par une mise à jour dédiée, pas par `update(dt)`.
- Le fond d'un écran de fin ne doit pas montrer les voitures de la course : le papa a jugé les doublons sur capture.

## Leçons de la session 6 (2026-10-24 et 25, tâche 10)

- Relire le plan contre le code AVANT l'implémenteur a payé : 7 importants trouvés sur le papier (REPRENDRE au `click` incompatible avec un doigt tenu, `display:flex` qui annule `hidden`, champs `sim`/`loop`/`step` lus par les tests existants, `now` absolus des tests qui ne font plus de pas après un décompte).
- `[hidden]` ne cache pas un élément dont une règle d'auteur pose `display` (flex, block) : chaque calque ou bouton caché par l'attribut a besoin de sa règle `…[hidden]{display:none}` (et d'un descendant `.screen [hidden]`), testée en jsdom sur la feuille et en e2e sur la boîte. Une règle globale reste à faire (registre, minor deferred).
- jsdom ne cascade pas : une règle générique plus spécifique (`.screen button{padding:0}`) qui écrase une règle de classe ne se voit qu'en e2e (`getComputedStyle` dans Chromium) ou sur la capture.
- Une scène « figée » doit l'être en entier : `present(elapsed)` faisait encore avancer particules et caméra pendant la pause. Passer `elapsed = 0`, et le mesurer (compte et positions des particules stables).
- Une entrée d'historique poussée par le jeu doit être consommée par toute sortie volontaire (MENU → `history.back()`), sinon le geste retour au titre ne quitte plus la page et `replaceState` réécrit la mauvaise entrée.
- Les limites de quota arrêtent les sous-agents en plein travail : vérifier `git status` puis les reprendre par `SendMessage` (le travail est gardé). Les notifications « waiting on its own background work » d'un relecteur qui attend ses mutants ne sont pas un blocage : regarder `ps` plutôt que relancer.

## Leçons de la session 5 (2026-10-24, tâches 8 et 8b)

- 8b : le code d'images était juste partout (géométrie mesurée sur 8 872 trames) ; ce sont les **tests** qui manquaient (flamme absente → `drawImage(null)` → « Oups ! », état du canvas après l'ombre et la roue). Un faux contexte 2D doit suivre la pile save/restore pour qu'un test puisse voir une scène qui pâlit.
- Un délai d'abandon d'image ne suffit pas : la requête restée pendante bloque l'événement `load` du document (e2e, futur service worker) ; il faut la couper (`removeAttribute('src')`) et le prouver dans un vrai navigateur.

- La relecture adversariale mesure ce que l'enfant voit : une barre « juste » (positions exactes) cachait les copains sous Galahad 80 à 97 % du temps, à cause de l'élastique. Mesurer la part du temps où chaque marqueur est visible, pas seulement sa position.
- Un tour de correction qui refait des tests peut perdre un test de câblage (l'affichage de la valeur rendue) : la re-relecture par mutants l'a vu. Toujours un mutant « valeur brute affichée » sur un affichage filtré.
- Le plan d'une tâche peut s'écrire en parallèle de l'implémentation de la précédente (rédacteur en lecture seule), puis être relu contre le code avant usage ; sa base se fixe à la clôture de la tâche précédente (SHA en clair, pas de variable de shell).
- Régime « écrans » + quatre relectures (décision du papa) : la tâche 8 a tenu en trois tours courts ; le papa tranche sur capture (couloirs, drapeau).

## Leçons de la session 4 (2026-10-23, tâches 6 et 7)

- Un « raté visible » se vérifie à l'écran, pas dans le code : la re-relecture a mesuré que le saut tardif partait ≤ 33 ms avant la reprise par la lave. Mesurer le temps de vol avant la lave a été la bonne preuve.
- Les relectures d'un plan peuvent câbler un prototype dans un worktree : l'adversaire a montré, avant tout code, que l'élastique du plan v2.1 faisait gagner Galahad 19/20 et cachait les copains hors de l'écran.
- Une valeur validée par le papa (caractères, fenêtre, pré-zone) ne devient jamais un garde-fou réglé par le coordinateur : on la lui pose en question chiffrée.
- Quatre relectures par tâche : standard, adversariale, `code-review`, `security-review` (le skill a besoin de `origin/HEAD` : `git remote set-head origin ccr-5b6fabc4-n96ofo`). Pas de Codex dans le cloud.
- La commande `/xreview` du papa est dans `.claude/commands/` ; une commande ajoutée en cours de session n'est vue qu'à la session suivante.
- Une règle de conduite ajoutée pour un cas (Galahad doigt levé en course) peut changer un autre cas (la grille sans doigt) : l'e2e complet l'a vu, l'implémenteur ne l'avait pas lancé. Toujours `npm run e2e` après une règle de conduite.
- Les mesures « avant » et « après » dans un même worktree (`scratchpad/wt-t7-mesures`) rendent le rattrapage apparié sans copie de fichiers.

## Leçons de la session 3 (2026-10-21 → 23, tâches 5c à 6)

- Un conteneur peut redémarrer en plein travail d'un sous-agent : le reprendre par son identifiant (SendMessage) ; vérifier `git status` d'abord. Commits ciblés (`git commit -- <chemins>`) pour ne jamais embarquer le travail d'un autre agent.
- Les relectures adversariales avec sondes physiques et mutants ont trouvé à chaque tâche un vrai défaut (tests aveugles au câblage de `Game`, réapparition au bord d'une fosse, saut depuis l'arrêt pris pour un blocage, politesse qui étirait la grille) : les garder, et faire tuer les mutants par les tests.
- Les questions au papa en choix multiples avec recommandation et chiffres mesurés marchent bien ; il aime trancher sur un tableau ou une capture.
- Toute modification du générateur change toutes les pistes : prévoir la recapture de l'empreinte (ruling R-F10) et l'interrupteur `ANCIENNES_PISTES` pour les mesures comparatives.
- Le hook d'arrêt réclame un commit quand un sous-agent travaille : ne jamais commiter son travail à sa place.

## Leçons des sessions du 2026-10-21 (tâches 1 à 5b)

- Push : passe quand la session est en mode « accepter les modifications »
  (le mode auto le classe comme déploiement). Vérifier `git status -sb`
  avant (HEAD détaché au démarrage possible : `git checkout -B
  ccr-5b6fabc4-n96ofo`).
- Jamais de `git reset`/`checkout`/`stash`/`clean` pendant qu'un sous-agent
  travaille dans l'arbre partagé ; le dire dans chaque brief.
- Relecture adversariale avec sondes physiques indispensable : elle a trouvé
  la fausse « falaise » de dosage et la trajectoire unique (registre tâche 4).
- Vitest 5 masque les `console.log` des tests verts : `silent: false` est
  posé dans les configs.
- Une limite de quota peut arrêter un sous-agent : vérifier `git log` avant
  de relancer (le commit peut être fait).
- Les sous-agents laissent des sondes `tests/zz-probe-*.test.ts` le temps de
  leur travail ; le hook d'arrêt les signale, c'est normal.
- Le hook d'arrêt réclame aussi un push à chaque commit local : on ne pousse
  qu'après la validation du papa (chaque push redéploie le site).
- Couleurs (tâche 5a) : le critère du plan « ≥ 120 sur une composante RGB »
  ne suffit pas à la lisibilité ; un aperçu rendu (PNG) des voitures a permis
  au papa de trancher en un coup d'œil.
- Tâche 5b : la relecture adversariale à 5 voitures a montré que les mesures
  de marge faites voiture seule (tâche 4) ne valent que pour les trajectoires
  mesurées : une autre phase de suspension à l'arrivée peut faire tomber une
  voiture lancée. Élargir les graines (0 à 23) et retirer les autres voitures
  pour trancher choc / chute propre.
- Un relecteur ciblé peut lire un paquet de diff pendant que l'implémenteur
  travaille au tour suivant, à condition de lui interdire de lancer des tests.
- Une enquête (débogage) peut tourner en parallèle d'un implémenteur dans un
  `git worktree` du scratchpad (lien symbolique vers `node_modules`) : aucune
  interférence avec l'arbre partagé.
- Un « glitch » rapporté sans détail : demander au papa à quoi il ressemble
  (choix multiples), puis mesurer avant toute correction ; ici c'était le
  rendu, pas la physique.
- Une nouvelle session repart d'un clone de GitHub : le travail non validé
  doit être poussé sur une branche de sauvegarde (`wip-plan-b`, sans
  déploiement), jamais laissé seulement dans le conteneur.

## Leçons de la session sprites (2026-10-22 et 23, tâche 8b Step 0)

- Générateur d'images guidé par une **image de référence** (silhouette grise, roues en
  pointillés, sans texte, `docs/sprites-gabarit-reference.png`) : les sept voitures conformes
  du premier coup. Sans les roues en pointillés, la silhouette ne se lisait plus comme une
  voiture. Pour les copains : « la même voiture », en joignant la première acceptée.
- La suspension est quasi rigide (±1 cm en course, sonde sur 3 courses à 5 voitures) : un
  sprite se cale sur les axes nominaux (±0,75 ; −0,25) m.
- Le générateur livre un alpha de 250 à 254 sur les parties opaques, et la quantification
  octree de Pillow mêle l'alpha (opaque → 250 à 254) : remettre à 255 les entrées de palette
  d'alpha ≥ 240 (fait dans `tools/sprites/controle.py`). Ni libimagequant ni pngquant dans le
  conteneur.
- Les PNG de l'archive Grok ont un **liseré magenta** au bord (reste de détourage) : regarder
  la couleur des pixels de bord semi-transparents avant d'utiliser une image (roue corrigée,
  étoile, Terre et flammes à faire à la 8b).
- Une archive envoyée par le papa dans le chat arrive dans `/root/.claude/uploads/<session>/` ;
  les noms y sont en cp437 (`timoth├⌐.png` = `timothée.png`).
- Une autre session peut travailler en parallèle sur `wip-plan-b` : avant de pousser sur la
  branche de déploiement, regarder `git ls-remote` et les sessions actives, et prévenir l'autre
  session par message (`send_message`, priorité « later »).

## Prochaine action précise

Session 4 (2026-10-23) : **tâches 6 et 7 validées et déployées** (fusions normales sur `ccr-5b6fabc4-n96ofo` ; `wip-plan-b` avancée sur la même tête après chaque fusion). Plan de référence : `docs/superpowers/plans/2026-10-21-plan-b-saut-et-rendu.md` v1.7 (tâches 5f à 7) ; tâches 8 à 17 : plan v2.1 `2026-10-21-plan-b-copains-et-finitions.md`, amendé par l'addendum « présentation » (`docs/superpowers/specs/2026-10-22-addendum-presentation.md` : 8b, régime « écrans », jalon « démo tablette »). Toutes les décisions du papa sont au registre (lignes « DÉCISION PAPA »).

0. Sprites (session dédiée) : **terminé et session close** (2026-10-23) : gabarit, sept sprites
   contrôlés et rangés, planche validée par le papa (arches serrées gardées), fusionnés et
   déployés (`775dad3`, run 39 vert). La 8b part de `assets/sprites/` (cadre
   2,80 × 1,40 m centré sur le châssis, roues par-dessus ; liseré magenta de l'étoile, de la Terre
   et des flammes à corriger, `assets/README.md`).
Session 5 (2026-10-24) : test tablette des tâches 6 et 7 recueilli (« trop facile », copains « tous pareils » → plan C après la démo), **tâches 8 et 8b validées et déployées**.

Session 6 (2026-10-24 et 25) : **tâche 10 faite et validée sur capture, PAS encore fusionnée ni déployée** (session arrêtée à la demande du papa, suite dans une nouvelle session). Tête de `wip-plan-b` = tour 3 (`cafe56f`) + ce commit de docs ; `origin/ccr-5b6fabc4-n96ofo` = `5e97707`, ancêtre de `wip-plan-b` : la fusion se fait **en avance rapide**.

Session 7 (2026-10-25) : **tâche 10 déployée** (run 46, e2e:live 27/27), retour tablette « tout est bon » + demande d'un bouton pause ; **tâche 11 (podium + bouton pause) faite, validée sur capture et déployée** en 1.2.0 (registre, lignes « Task 11: »).

**Suite (session 8)** : **jalon « démo tablette »** (addendum §6) : Galahad lance une course seul depuis le titre, reconnaît les voitures, voit le podium ; le papa filme 30 s ; recueillir son retour (podium, confettis, bouton ⏸, ENCORE/MENU au doigt, fps). Puis **11c** (plan C : obstacles qui ralentissent, régime physique, spec à écrire avec le papa), puis 12 (audio ; le bouton son ira au titre et au podium), 13, 14, 15, 16, 17. Les points 1 à 4 ci-dessous sont l'historique de la session 7.

1. Nouvelle session : `git fetch origin wip-plan-b && git checkout -B wip-plan-b origin/wip-plan-b`, `npm ci`, `git remote set-head origin ccr-5b6fabc4-n96ofo`, dossier de liens Playwright (section « Environnement »). Lire cette passation et la fin du registre (depuis « Session 5 »).
2. **FAIT (session 7, 2026-10-25) : tâche 10 déployée** (run 46, hash vérifié, e2e:live 27/27). Ancienne consigne : **Finir la tâche 10** (plan `2026-10-24-plan-b-ecrans.md`, Steps 28 à 30) :
   - `npm run typecheck && npm test` (attendu ≈ 865 verts) puis `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e` (27 verts) sur la tête de `wip-plan-b` ; le lancement de fin de session 6 a été interrompu avant son résultat ;
   - `git fetch origin ccr-5b6fabc4-n96ofo && git checkout -B ccr-5b6fabc4-n96ofo origin/ccr-5b6fabc4-n96ofo && git merge --ff-only wip-plan-b && git push -u origin ccr-5b6fabc4-n96ofo` (mode « accepter les modifications ») ;
   - run GitHub Actions vert (outils `mcp__github__actions_list` / `actions_get`) ; hash du `index-*.js` servi par https://i-dmk.github.io/Galahad-s-car-game/ = celui de `VITE_BASE=/Galahad-s-car-game/ npm run build` ; `curl -sI …/fonts/fredoka-latin-700.woff2` → 200 ;
   - `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live` (27 verts, `screens.spec` compris) ;
   - registre « Task 10: déploiement vérifié (run n, hash, e2e:live) », tableau ci-dessus → « déployée », commit `docs:`, puis `git checkout wip-plan-b && git merge --ff-only ccr-5b6fabc4-n96ofo && git push origin wip-plan-b`.
3. Retour tablette du papa sur la tâche 10 à recueillir : titre (rangée, prénoms × 1,8, rebond Q6), décompte, pause et TOURNE (rotation), plein écran au lever du doigt sur JOUER (non vérifiable en headless), fps au titre avec `?debug=1`.
4. Puis **tâche 11** (podium : `finished` → 1,5 s de roue libre → `podium`, qui remplace le calque ARRIVÉE ; ENCORE et MENU sont déjà câblés dans la machine et `Game` ; `podium` est dans la table de `src/loop/states.ts` ; version `1.2.0` ; plan à écrire depuis le plan v2.1 Task 11, skill writing-plans, régime « écrans » à quatre relectures), le **jalon « démo tablette »**, la **11c (plan C : obstacles qui ralentissent, régime physique, spec à écrire avec le papa)**, puis 12, 13, 14, 15, 16 (choix de Galahad pour le décor à recueillir), 17. Points du test tablette non revus (rien de gênant d'après le papa) : Q-F5, appuis perdus à 21 m/s, étoile de réception survolée en turbo, catapultes.
5. Mineurs reportés (registre, lignes « minor (deferred) ») : à trier à la relecture de branche (tâche 14 ou 17).
6. Après chaque fusion sur `ccr-5b6fabc4-n96ofo` : run GitHub Actions vert, puis `npm run e2e:live` ; avancer `wip-plan-b` sur la même tête (la fusion suivante se fait alors en avance rapide).
