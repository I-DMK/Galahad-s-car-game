# Tâche 5c (saut fiabilisé) — relectures en cours

État : commits `ee58194` (harnais de phases) et `25ba33f` (congé de 10 m au pied de la rampe-volcan), base `0a78392`. Branche de sauvegarde `wip-plan-b`, non déployée. Le papa n'a pas encore validé la tâche.

## Relecture standard (sonnet) : APPROUVÉE
- Conforme :
  - congé en config ;
  - rampe-volcan seule ; un test vérifie que `rampeSaut` est identique au bit près ;
  - pas d'option morte ;
  - continuité de pente testée ;
  - `phases` asserte 0 chute ;
  - invariant à 5 voitures sur les graines 0 à 23, en 4 fichiers ;
  - commentaires de mesure à jour.
- Géométrie vérifiée à la main : tangences, pente maximale 22° (inférieure à `MAX_SLOPE`), profil identique au bit près au-delà du congé, garde-fou de débordement testé. Le protocole retrouve la chute d'avant (`PHASES_VARIANTS=pli`, graine 6, volcan 2, 11,31 m/s).
- Mineurs :
  1. `tests/helpers/phases.ts` (555 lignes) garde l'outillage de comparaison de la phase 1. Les parties `cases`, `releases` et `ramps` tournent par défaut sans rien asserter et dupliquent des seuils. À élaguer, ou à mettre derrière une option.
  2. Le témoin `pli` (au moins une chute sans congé) n'est pas dans `test:slow` par défaut : l'assertion « 0 chute » n'a donc pas de contrôle vivant.
  3. La hausse de `npm test` (166 → 178–190 s) n'est pas isolée. Il faut mesurer `race-smoke` seul, avant et après. Le suivi des contacts de `fiveCarRace` tourne aussi en CI.
  4. Aucun test ne montre que l'observateur `onStep` est sans effet (course avec et sans, résultat égal).
  5. Les chutes propres des copains sont imprimées, pas assertées.
  6. Les commentaires attribuent à la 5c l'invariant `lavaByCar.galahad === 0`, qui existait depuis la 5b. La 5c n'a fait qu'élargir les graines.
  7. Le cas 7 atteint la limite de 2 chutes par volcan sur la graine 5. Ce seuil date de la tâche 4.

## code-review (high) : 10 constats, non vérifiés, aucun dans le code du jeu
1. `tests/slow/phases.test.ts:41` : `expectNoFall` ne fait échouer que l'issue `'lave'`. Les issues `'autre'` (pas d'atterrissage sur la réception, blocage, retombée sur le flanc ou dans la vallée) sont acceptées en silence.
2. `tests/helpers/race.ts:128` : les chutes propres des copains sont classées mais jamais assertées. Mesure actuelle : 0 sur les graines 0 à 23 pour toutes les voitures.
3. `tests/slow/phases.test.ts:68` : en mode `PHASES_MERGE`, l'assertion est sautée sans avertissement si les morceaux fusionnés ne couvrent pas toutes les graines.
4. `tests/helpers/phases.ts:518` : l'aller-retour JSON transforme NaN et -Infinity en `null`, que `Math.min`/`Math.max` traitent comme 0 dans le tableau fusionné.
5. `tests/helpers/phases.ts:173` : `turboAt` est tiré dans `[xLancement − 50, …]` alors que le départ est à x0 ≈ `xLancement − 40`. Environ 18 % des historiques « turbo » déclenchent le turbo à l'arrêt au premier pas, et ne couvrent donc pas « turbo actif au pied ».
6. `tests/helpers/race.ts:69` : `lastContact` n'est pas remis à zéro au respawn, donc une chute propre peut être classée « choc ».
7. `tests/helpers/race.ts:62` : `carPairsTouching` est appelé à chaque pas en plus du parcours propre à `simulateRace`. C'est du temps de calcul en suite lente.
8. `src/track/slices.ts:158` : le congé relève les ≈ 1,94 derniers mètres du plat d'élan. Or `dxRampStart`, la doc de `L_ELAN` (« seul levier de difficulté ») et `rampSpeed` (« pied de la rampe ») décrivent encore l'ancien pli. Le plat d'élan réel vaut `L_ELAN − 1,94` m, et la vitesse « au pied » est lue 0,19 m plus haut sur la courbe. À documenter, ou à exposer `xFoot0`.
9. `tests/slices.test.ts:192` : deux assertions ne vérifient que les helpers du test (`x1`, `arc()`), jamais `p.heights`, ce qui les rend tautologiques.
10. `tests/slow/race-invariants-*.test.ts` : 4 fichiers dupliquent le même en-tête. Une ligne qui renvoie vers `registerRaceInvariants` suffirait.

## Relecture adversariale (opus, sondes physiques) : CORRECTIONS REQUISES

**Aucune chute doigt posé** sur environ 22 900 runs et 24 courses à 5 voitures. Couverture des sondes :
- 11 739 historiques : doigt levé puis reposé, respawn sur le lancement, turbo au pas de 1 m ;
- 5 097 départs arrêtés au pas de 0,25 m ;
- 3 200 turbos au pas de 0,1 m ;
- protocole du harnais sur les graines 24 à 33 ;
- 5 voitures avec doigt levé 30 % hors volcans.

Les corrections portent sur deux chiffres faux présentés au papa, et sur le harnais.

1. **Important (mesuré) : la « garde minimale 1,72 m » est fausse.**
   - Mesure : Galahad lancé à V_MAX, turbo pris à `xL − 26`, doigt posé du début à la fin. Sommet à 11,05 m/s et 18,75°, **garde de 0,63 m**, à l'identique pour g0 v2 et g8 v3.
   - Cause supposée : en fin de turbo, `applyDrive` (src/physics/car.ts:149) ramène d'un coup ω à omegaMax. Les roues freinent et la voiture arrive au pied à 11,30 m/s.
   - À corriger : src/config.ts:21 et :23, src/physics/world.ts:54-56, tests/helpers/runs.ts:29-36, tests/slow/phases.test.ts:9-11.
   - Correctif proposé : écrire 0,63 m (fin de turbo au pied), ajouter au harnais une famille turbo dense (pas de 1 m, lancée à V_MAX) et asserter une garde ≥ 0,3 m.
2. **Important (mesuré) : « doigt levé toléré 1,25 → 1,5 s en médiane » est un artefact de la grille.**
   - Mesure au pas de 0,05 s sur 43 volcans. Toléré au sens strict, médiane / moyenne : congé **1,25 / 1,32 s**, pli **1,45 / 1,42 s**.
   - Le plafond ne passe que de 1,65 à 1,70 s, et la frontière reste chaotique (trou à 1,30 s sous congé).
   - **Le jeu n'est pas plus facile.**
   - À corriger : refaire le tableau (b) au pas de 0,05 s, et rectifier le rapport, le commentaire de `dosage` et le §5.
3. **Mineur : le cas 1 tient.** Arrêt à `xElanStart + d` avec d ∈ [−1,75 ; 7,5] → lave, y compris arrêté sur le congé. La frontière [−2,5 ; −2] reste chaotique, comme avant.
4. **RAS (mesuré)** :
   - Sur 50 graines, seuls les points du congé changent ; tranches, volcans, étoiles et rampes-saut sont identiques au bit près.
   - Aucun point sûr possible sur le congé.
   - L'étoile la plus proche est à 6,06 m.
   - Angle maximal de 36,7° sur l'élan et la rampe : pas de respawn parasite.
   - Le rendu `tremplin.png` est propre.
5. **Mineur : la mutation R = 0 donne bien du rouge** (g10 v2 et g1 v4). Mais l'invariant à 5 voitures ne détecte la régression que par une graine sur 24 : le vrai garde-fou est `phases`. En CI, seul `slices.test.ts` la verrait.
6. **RAS : durée.** race-smoke, volcans et slices : 77,9 s en base contre 74,8 s en head. La hausse de `npm test` est du bruit de machine, et `tests/slow` est bien hors CI.

**Questions pour le papa** :
- La marge de 63 cm quand un turbo s'arrête juste avant le pied du tremplin suffit-elle, ou faut-il adoucir la fin du turbo ?
- Lever le doigt est toléré jusqu'à ≈ 1,3–1,6 s, comme avant. Faut-il un levier pour durcir le jeu ? (le bouton saut et les copains apportent déjà du défi)
