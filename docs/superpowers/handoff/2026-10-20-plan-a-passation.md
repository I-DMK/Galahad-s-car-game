# Passation — Plan A (Course Lunaire de Galahad)

Mis à jour à la fin de chaque tâche. Permet à une nouvelle session de reprendre
sans le contexte de celle-ci.

## Où en est-on

- Spec : `docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md` (validée par le papa, relectures intégrées).
- Plan A : `docs/superpowers/plans/2026-10-20-plan-a-socle-jouable.md` (validé, relectures intégrées).
- Méthode : exécution pilotée par sous-agents (superpowers:subagent-driven-development) : un implémenteur frais par tâche, un relecteur frais, tours de correction, puis relecture de branche finale.
- Registre complet (décisions, mineurs reportés) : `docs/superpowers/handoff/sdd-ledger-plan-a.md` (copie du registre de travail).
- Branche : `ccr-5b6fabc4-n96ofo` (branche par défaut du dépôt). Dépôt renommé `I-DMK/Galahad-s-car-game`, public depuis le 2026-10-20.
- Déploiement : GitHub Pages via Actions, vert depuis le run 13 → **https://i-dmk.github.io/Galahad-s-car-game/** (`?debug=1` pour le fps, `?seed=`, `?len=`).

## Tâches

| Tâche | État |
|---|---|
| 1 squelette + CI | complete |
| 2 unités/balistique/RNG | complete |
| 3 tranches de piste | complete |
| 4 génération de piste | complete |
| 5 étoiles (placement) | complete |
| 6 monde Matter.js | complete (1 tour de correction) |
| 7a voiture + calibration | complete (1 tour) |
| 7b sauts vérifiés | complete |
| 7c (ajoutée) roues 48 côtés, 3e ressort, contact débouncé | complete (3 tours) |
| 8 accélérateur tactile | complete |
| 9a rendu + caméra | complete |
| 9b pas de course + boucle + HUD | complete — capture `e2e/screenshots/etape1.png` OK |
| 10a points sûrs/respawn (pur) | complete |
| 10b respawn dans stepRace + simulations | complete (1 tour) |
| 11 ligne d'arrivée, chrono, écran ARRIVÉE | complete (127–134 s doigt posé, 0 respawn) |
| 12 étoiles + turbo | complete (35 étoiles/course, turbo quasi permanent → équilibrage à l'étape 6) |
| 13 effets | **prochaine** |
| 14 Playwright tablette | à faire |
| 15 relecture de branche + remise | à faire |

## Décisions prises hors plan (à connaître avant de toucher la physique)

- matter-js 0.20 : l'option `mass` n'actualise PAS l'inertie → inertie passée explicitement (`INERTIA_SCALE = 4` = `Body._inertiaScale`).
- Roues = `Bodies.polygon` à 48 côtés (`WHEEL_SIDES`), `maxSides` de `Bodies.circle` n'est qu'un plafond (18 côtés à r = 18 px).
- Suspension : 3 contraintes par roue (2 sur la ligne médiane + 1 depuis un point haut `SUSPENSION_TOP_OFFSET`) ; sinon la roue bascule au-dessus du châssis (91/148 sauts).
- Contact au sol de jeu = contact brut OU écart < 3 cm OU dans les 0,1 s (`updateGroundContact`) ; `wheelsOnGround` brut reste pour la physique.
- Convention d'angle : `carAngle` = angle MONDE (positif = nez en montée) ; le rendu négative les angles Matter des roues.
- Capteur de lave : tout le cratère, du rebord (`rimY`) au plancher.
- Calibration : `DRIVE_ACCEL 4.3` (mesuré 4,34), `WHEEL_SPINUP 0.0054`, `AIR_LEVEL_K 0.004 / D 0.08` (40° → 7,8° en 90 pas, marge mince), `V_JUMP 10`, `LAVA_MARGIN 0.7` inchangés.
- Plat d'élan dimensionné pour que 75 % suffisent ; butée aval sur 2 × `STOP_BUMP_LENGTH`.
- Anti-boucle de respawn comptée par volcan (`lastRespawnLavaX`), pas par égalité de flottants.
- Commits signés `Claude <noreply@anthropic.com>` (git config local), trailers `Co-Authored-By: Claude Fable 5.1` + `Claude-Session`.

## Environnement

- `npm test` ≈ 3–4 min (simulations Matter.js : `jump.test.ts` ~3 min) ; lancer les tests ciblés en itérant.
- Playwright 1.56.1, Chromium pré-installé (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) ; pas encore de `playwright.config.ts` (tâche 14).
- Captures : `e2e/screenshots/` (ignoré par git).

## Prochaine action précise

Tâche 13 : `src/render/effects.ts` (classe Effects : étincelles, poussière, bulles de lave, fumée ; plafond 300 particules), branchée dans `renderer.ts` et `game.ts` (événements 'respawn' → étincelles, 'landing' → poussière) ; `tests/effects.test.ts`. Puis 14 (Playwright) et 15 (relecture finale).
