### Task 5c (ajoutée, décision du papa) : Saut fiabilisé

**Constat (relecture adversariale de la 5b) :** doigt posé, une voiture lancée peut tomber dans la lave sans aucun choc (10,98 et 11,44 m/s au sommet), selon la phase de la suspension : la roue arrière sautille sur la rampe (écart roue-sol 0,39–0,40 m contre ≈ 0,30 en passage) et frappe l'arête du sommet. Galahad seul n'y tombe sur aucune des graines 0 à 23 (trajectoire unique par piste), mais un doigt levé plus tôt change la phase d'arrivée.

**Files:** à déterminer par la mesure (candidats : `src/track/slices.ts` (arête de rampe arrondie), `src/config.ts` (`LAVA_MARGIN`, amortissement de suspension)), `tests/slow/` (balayage de phases), `tests/helpers/race.ts` (invariant élargi).

- [ ] **Step 1 : Mesure** : Galahad doigt posé depuis `xLancement` après des historiques variés (départs échelonnés en amont au pas de 0,05 m, motifs de doigt antérieurs tirés par graine), sur les volcans des graines 0 à 9 : taux de chute, vitesse au sommet, écart roue arrière–sol sur la rampe.
- [ ] **Step 2 : Correctifs candidats** mesurés de la même façon (au moins : arête arrondie ; `LAVA_MARGIN` 0,75 ; amortissement), en gardant vrais les cas 1 à 7 de la tâche 4 (en particulier « arrêt à `xElanStart` → lave ») ; tableau comparatif pour le papa, qui choisit.
- [ ] **Step 3 : Implémenter le choix**, puis invariant `lavaByCar.galahad === 0` à 5 voitures doigt posé sur les graines 0 à 23 (suite lente) ; **Commit** `fix: saut fiabilisé` ; push ; le papa vérifie sur la tablette.

---

