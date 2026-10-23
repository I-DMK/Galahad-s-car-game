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
- **Tâche 6 faite côté code, EN RE-RELECTURE, NON VALIDÉE, NON DÉPLOYÉE** (conduite des robots : `12a876d` feat, `9558085` test, `452b47b` tour 1, `c3e28a7` docs ; branche `wip-plan-b`) : `src/ai/driver.ts` (`Driver` → `{ throttle, jump }`), départ à rang × 0,3 + 0,38 s, lever de pied, **robots polis seulement derrière une voiture arrêtée, doigt levé, non fantôme ni invulnérable** (attente cumulée ≤ 3 s), sauts d'étoile haute (`jumpTry`/`jumpSkill`) et de fosse (erreur × 2,5, instant visé centré, plancher 2 m, **saut tardif au dernier pas permis** : raté visible), garde de zone tremplin dans `updateJump` pour toute demande automatique, tentative comptée par fosse, chute de copain classée fosse / choc / sans tentative. Mesures (48 graines) : fosses Pablo 17,5 %, Matthis 20,3 %, autres 0 % ; étoiles hautes ratées fonceurs 10,2 %, prudents 3,9 % ; 0,52 chute de copain par course ; invariants 5 voitures 0–23 : 0 chute de Galahad sauteur parfait, 0 au tremplin. **Rattrapage CONFIG doigt posé : Galahad gagne 12/48 (33/48 avant la 6), place moyenne 2,46** → l'élastique (tâche 7) doit rééquilibrer. npm test 625/625, e2e 13/13. **Deux rulings à faire confirmer par le papa** : (1) zone fantôme d'une fosse étendue au plat de garde (Galahad sauteur percuté en turbo et catapulté dans la lave, graines 33 et 36) ; (2) seuil « chute sans tentative » tolérée sous 11,5 m/s (la lave reprend la voiture avant tout saut sous ≈ 11,3 m/s). Aussi : R-F12 lu « 2 s après un contact ou pendant le vol qui suit ».
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
  `Claude-Session` fournis par la session courante.

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
| 6 conduite des robots (+ robots polis + sauts des copains) | **faite côté code, tour 1 fait** → re-relecture ciblée, validation (2 rulings), déploiement (fusion normale) |
| 7 élastique (+ suite `test:slow:race`) | à faire |
| 8 position, barre de progression, classement | à faire |
| 9 (conditionnelle) fenêtre glissante de sol | fps OK à 5 voitures → non ; à remesurer avec le décor (tâche 16) |
| 10 machine d'états, titre, décompte, pause, orientation | à faire |
| 11 podium | à faire |
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

## Prochaine action précise

Session 3 (2026-10-21 → 23) terminée à la demande du papa (contexte à 50 %). 5c, 5f, 5d, 5e, 5g validées et déployées ; tâche 6 faite et corrigée (tour 1), **non validée**, sur `wip-plan-b` (HEAD `c3e28a7`, tout poussé). Plan de référence : `docs/superpowers/plans/2026-10-21-plan-b-saut-et-rendu.md` (v1.6 + amendements 5g/6) ; spec : `docs/superpowers/specs/2026-10-21-bouton-saut-design.md` (§1–6) ; toutes les décisions du papa sont au registre `sdd-ledger-plan-b.md` (lignes « DÉCISION PAPA »).

1. Nouvelle session : `git fetch origin wip-plan-b && git checkout -B wip-plan-b origin/wip-plan-b`, `npm ci`. Lire cette passation, la fin du registre (depuis « Session 3 »), la Task 6 du plan v1.6 et la spec §3, §6.
2. **Finir la tâche 6** : re-relecture ciblée du tour 1 (`git diff 9cf3fd6..c3e28a7`) avec mutants dans une copie (worktree du scratchpad) ; poser au papa les **deux rulings** (zone fantôme étendue au plat de garde ; seuil « sans tentative » 11,5 m/s) ; sa validation ; mettre à jour passation + registre ; **fusion normale** sur `ccr-5b6fabc4-n96ofo` (voir la puce « Fusion de la session sprites ») ; push (déploie) ; vérifier le run GitHub Actions.
3. Puis **tâche 7** (élastique, plan v2.1 + « l'objectif mesuré tient compte des sauts ») : Galahad ne gagne plus que 12/48 doigt posé et la variante « sauteur » mesure ce que le bouton lui rend ; après 6 et 7, le papa rejuge la difficulté (`ENGINE_BRAKE`, plan C).
4. Points à regarder au prochain test tablette : bouton saut, étoiles hautes, fosses, copains qui ratent (Pablo, Matthis), robots polis, Q-F5 (rien ne s'allume avant une fosse), appuis perdus à 21 m/s, étoile de réception survolée en turbo, catapultes.
