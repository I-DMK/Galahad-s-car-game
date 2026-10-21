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
- **Tâche 5c faite, EN RELECTURE, non validée** (sur la branche de
  sauvegarde **`wip-plan-b`**, non déployée) : `ee58194` (harnais
  d'échantillonnage des phases de suspension) et `25ba33f` (congé de 10 m au
  pied de la rampe-volcan, `RAMP_FOOT_RADIUS`, choisi par le papa sur
  tableau comparatif). Cause mesurée des chutes propres : rebond au pli du
  pied de rampe → décollage à 14° au lieu de 21°. Résultat : 0 chute doigt
  posé sur 2 924 historiques, 0 chute (toutes voitures) à 5 voitures sur les
  graines 0 à 23, cas 1 à 7 de la tâche 4 tenus. Relecture standard
  approuvée, `code-review` 10 constats (harnais seulement), adversariale
  **CORRECTIONS REQUISES** : aucune chute doigt posé sur ≈ 22 900 runs,
  mais deux chiffres présentés au papa sont faux (garde minimale réelle
  **0,63 m** en fin de turbo au pied, pas 1,72 m ; doigt levé toléré
  **inchangé** ≈ 1,3 s, pas 1,5 s) et le harnais doit gagner une famille
  turbo dense. Tout est dans `handoff/wip-5c/relectures.md`, avec deux
  questions pour le papa (marge de fin de turbo, levier de difficulté).
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
| 5c (ajoutée) saut fiabilisé | **faite, en relecture** (branche `wip-plan-b`) → tour de correction, validation |
| 5f (ajoutée) rendu interpolé (tremblement) | à faire, juste après 5c |
| 5d (ajoutée) étoiles pour tous | à faire (addendum bouton saut §2) |
| 5e (ajoutée) bouton saut et étoiles hautes | à faire (addendum bouton saut §1–2) |
| 6 conduite des robots (+ robots polis + sauts des copains) | à faire |
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

1. Nouvelle session : **`git fetch origin wip-plan-b && git checkout -B
   wip-plan-b origin/wip-plan-b`** (ou cloner cette branche), `npm ci`. Lire
   cette passation, puis `sdd-ledger-plan-b.md` (tâches 1 à 5c, décisions du
   2026-10-21), le registre du plan A (« Décisions prises hors plan »),
   l'addendum v3.1 [tâche 2] [tâche 4] [tâche 5b], l'**addendum bouton saut**
   (validé), le plan v2.1 (5c ajoutée, 6 amendée), `handoff/wip-5c/` et
   `2026-10-21-glitch-tremblement.md`.
2. **Finir la tâche 5c** : poser au papa les deux questions de
   `wip-5c/relectures.md` (marge 0,63 m en fin de turbo : adoucir la fin du
   turbo ? levier de difficulté ?) ; un tour de correction groupant les
   constats adversariaux (chiffres faux corrigés partout, famille turbo dense
   et garde ≥ 0,3 m asserté, tableau (b) au pas de 0,05 s), les 10 de
   `code-review` et les mineurs utiles de la relecture standard (au moins 1,
   2, 3, 5, 6, 8, 9 de code-review ; témoin `pli` vivant ; test « onStep sans
   effet ») ; re-relecture ciblée ; **validation du papa** ; puis fusion
   rapide (`git checkout ccr-5b6fabc4-n96ofo && git merge --ff-only
   wip-plan-b`), passation, registre, push sur `ccr-5b6fabc4-n96ofo`
   (déploiement), et suppression de `wip-plan-b` sur GitHub si le papa est
   d'accord.
3. **Écrire le plan des nouvelles tâches** (skill writing-plans) à partir de
   l'addendum bouton saut et du rapport de tremblement : **5f** rendu
   interpolé (interpoler entre le pas précédent et le pas courant, alpha =
   accumulateur / dt, caméra sur la position interpolée, pas d'interpolation
   à travers une téléportation ; compteur d'images à 0 / 2 pas en
   `?debug=1`), **5d** étoiles pour tous, **5e** bouton saut et étoiles
   hautes, **6** amendée (polis + sauts des copains + traits `jumpTry` /
   `jumpSkill` à faire valider). Relectures standard + adversariale +
   `code-review` du plan, validation du papa.
4. Exécuter dans l'ordre **5f → 5d → 5e → 6 → 7**, avec la méthode habituelle
   (implémenteur frais, trois relectures, ≤ 5 tours, validation, passation,
   push). Après 6 et 7, le papa rejuge la difficulté (`ENGINE_BRAKE`, plan C).
