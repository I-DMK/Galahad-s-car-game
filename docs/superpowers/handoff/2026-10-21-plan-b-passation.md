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
  **En attente de validation du papa**, puis push.
- Consignes de conteneur apprises : le push passe quand la session est en
  mode « accepter les modifications » (le mode auto le classe comme
  déploiement) ; vérifier `git status -sb` avant un push (HEAD détaché au
  démarrage) ; jamais de `git reset`/`checkout`/`stash`/`clean` pendant qu'un
  sous-agent travaille dans l'arbre partagé.
- Branche : `ccr-5b6fabc4-n96ofo` (branche par défaut, déploiement
  automatique à chaque push). Commits signés par le git config local du dépôt
  (`Claude <noreply@anthropic.com>`) avec les trailers `Co-Authored-By:
  Claude Fable 5.1` et `Claude-Session` de la session courante.

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
| 2 étoiles v2 (curseur global, étoiles d'élan, plancher 6, pas 60–100) | **code fait, relu (3 relectures, 2 tours), en attente de validation du papa** |
| 3 points sûrs et respawn v2 | à faire |
| 4 simulations d'acceptation, suites lentes, balayage de dosage | à faire → **gate : test tablette du papa** |
| 5a pilotes | à faire |
| 5b course à 5 voitures, grille, chocs, respawn groupé | à faire → mesure fps du papa |
| 6 conduite des robots | à faire |
| 7 élastique (+ suite `test:slow:race`) | à faire |
| 8 position, barre de progression, classement | à faire |
| 9 (conditionnelle) fenêtre glissante de sol | si fps < 50 |
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
- Les skills `superpowers:*` ne sont pas installés dans le conteneur : on en
  applique la méthode telle que décrite ici et dans les plans.

## Prochaine action précise

1. Obtenir du papa la **validation de la tâche 2** (commits `6dd91e2..11ed39b`,
   ruling du pas 60–100 inclus), puis `git push -u origin ccr-5b6fabc4-n96ofo`
   (session en mode « accepter les modifications »).
2. Dispatcher la **tâche 3** (points sûrs et respawn v2) à un implémenteur
   frais (brief : plan tâche 3, addendum §1.6, contraintes globales, registre
   plan A §rulings 10a/10b et registre plan B), puis relectures, validation,
   passation, push.
3. Après la tâche 4 : test tablette du papa et de Galahad (gate), au plus deux
   tours de calibration, puis tâche 5a.
