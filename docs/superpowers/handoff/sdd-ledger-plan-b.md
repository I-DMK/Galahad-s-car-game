# SDD ledger — plan : docs/superpowers/plans/2026-10-21-plan-b-copains-et-finitions.md
Spec : docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md (autorité) + docs/superpowers/specs/2026-10-21-plan-b-addendum.md (v3.1, l'emporte)
Workspace : branche ccr-5b6fabc4-n96ofo dans le conteneur (branche désignée, pas de worktree : même ruling qu'au plan A).

## Décisions du brainstorming et des relectures (2026-10-21)
- Périmètre : calibration → copains → finitions → décor ; bond lunaire + obstacles → plan C. Copains tirés au sort parmi 6 (Suzanne, Mathilde retirées).
- Relectures : standard + adversariale par sous-agents + skill `code-review`, sur spec, plan, chaque tâche, branche.
- Addendum v3 validé par le papa ; v3.1 = amendements [plan] (L_ELAN 6, capteur 0,3, flipped immédiat sur [xElanStart, xLip], pas de zone-point d'étoile, turbo Galahad plafond seul, deux scripts lents). À confirmer avec le plan.
- Mesures de la sonde adversariale (à L_ELAN 4/6/8/10, LAVA_MARGIN 0,8, capteur +0,5, butée 0) : arrêt à xElanStart avec L_ELAN 8 → 8,9 m/s au sommet (jusqu'à 10,4), 27/29 chutes ; 6 → 29/29 ; 10 → 2/29 passent ; seuil de franchissement ≈ 10,3–10,5 m/s à capteur 0,5 ; lancé ≥ 10,7 m/s, 0 faux positif. Suite actuelle 218/218 en 178 s mur (4 cœurs), jump.test.ts seul = 178 s.

## Pré-vérification (scan du plan v2.1)
| Paire / tâche | Constat |
|---|---|
| T1 retire des constantes ↔ tests qui les lisent (tsconfig inclut tests/) | résolu : constantes retirées avec leur dernier consommateur (T2 : STAR_EXCLUSION, T3 : ELAN_SAFE_FRACTION), forbiddenZone de transition en T1, jamais de .skip |
| T1 'cratère' dans SliceType ↔ T3 safepoint / T5b shiftTarget / T15 générateur | résolu : littéral ajouté en T1 |
| T2 curseur ↔ addendum §1.5 « 1 m avant rampe-saut » | résolu : zones de longueur nulle supprimées (addendum v3.1) |
| T3 flipped immédiat ↔ T4 cas 1 attend 'lava' | résolu : zone [xElanStart, xLip] |
| T4 jump.test ↔ budget CI | résolu : scission volcans/rampes, cas 1–5 graines 0–2 en CI |
| T5b refonte RaceSim ↔ tests du plan A, game.ts | résolu : liste de migration, défaut robots:false, trace figée |
| T5b simulateRace arrêt anticipé ↔ slow/finish.test (10 s après la ligne) | résolu : option stopAfterFinish |
| T7 applyDrive nouvelle signature ↔ consommateurs | résolu : liste (simulate, helpers/runs, car.test, bounce.test, rampes, volcans) ; turbo Galahad plafond seul |
| T10 états ↔ 'error' existant | résolu : conservé |
| T13 vite-plugin-pwa ↔ Vite 8, vitest, Playwright | résolu : ^2.0.0 + workbox ^7.4.1, disable sous VITEST, webServer tableau + projet preview |

## Progression
(aucune tâche dispatchée)
