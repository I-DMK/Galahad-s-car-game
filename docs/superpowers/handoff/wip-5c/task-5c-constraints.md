# Contraintes et cadrage de la tâche 5c « saut fiabilisé » (phase 1 : mesure et candidats)

## Pourquoi (décision du papa, 2026-10-21)
Lors de la relecture adversariale de la tâche 5b, on a trouvé des chutes dans la lave **doigt posé et sans aucun choc**. Elles sont prouvées en retirant les autres voitures, puis en rejouant la voiture seule dans le même état :
- Diego, graine 1, volcan 4 : 10,98 m/s au sommet ;
- Galahad, graine 10, volcan 2 : 11,44 m/s au sommet, alors que Galahad seul (`robots: false`) passe ce même volcan à 11,51.

Cause mesurée : la phase de la suspension. Sur la rampe, la roue arrière sautille (écart roue-sol de 0,39 à 0,40 m, contre ≈ 0,30 quand le saut passe), puis frappe l'arête du sommet. Ce coup décide de la trajectoire. Voir les lignes « Task 4: DÉCOUVERTE » et « Task 5b: DÉCOUVERTE » de docs/superpowers/handoff/sdd-ledger-plan-b.md.

Promesse du jeu, faite au papa : **doigt posé depuis le plat de lancement, on ne tombe jamais**. Le papa veut un correctif ciblé. Il le choisira sur un tableau comparatif.

## Ce que cette phase livre (Steps 1 et 2 du brief, PAS le Step 3)
1. Un **protocole d'échantillonnage des phases**, reproductible et déterministe, qui doit retrouver les chutes propres connues. Exemples de leviers :
   - départs arrêtés échelonnés en amont de `xLancement` ;
   - motifs de doigt antérieurs tirés par graine, puis doigt posé à partir de `xLancement`, ou plus tôt ;
   - historiques avec turbo.
   Budget CPU : environ 30 min de calcul au total pour toute la phase, sur 4 cœurs ; parallélise par fichier. Vérification obligatoire : le protocole reproduit au moins un état de type « chute propre à plus de 10,5 m/s au sommet ». Sinon, il n'échantillonne pas le bon phénomène.
2. **Mesure de référence** (configuration actuelle), sur les volcans des graines 0 à 9 :
   - taux de chute doigt posé ;
   - distribution de la vitesse au sommet et de l'écart roue arrière–sol sur la rampe ;
   - liste des cas qui tombent.
3. **Correctifs candidats**, chacun mesuré avec le même protocole. Au moins :
   - (a) arête de rampe arrondie : un congé au sommet dans le profil `rampe-volcan` de `src/track/slices.ts`, en respectant `MAX_SLOPE` et les parois exemptées, sans changer `lipY` ni la position du sommet ;
   - (b) `LAVA_MARGIN` à 0,75 ;
   - (c) amortissement de suspension (`SUSPENSION_DAMPING`).
   Tu peux ajouter un candidat que la mesure suggère. Pour chaque candidat, donne :
   - le taux de chute doigt posé avec le protocole ;
   - les **cas 1 à 7 de la tâche 4** (`tests/volcans.test.ts`, `tests/slow/volcans-slow.test.ts` et les helpers de `tests/helpers/runs.ts`), en particulier le **cas 1 « arrêt à `xElanStart` puis doigt posé → lave à chaque fois »**, qui doit rester vrai, faute de quoi le candidat est rejeté ;
   - la marge de doigt levé tolérée avant le volcan (tableau (b) de la tâche 4 : lancé à V_MAX, doigt levé T secondes depuis `xElanStart − 10`) ;
   - l'effet sur les rampes-saut (`tests/rampes.test.ts`) ;
   - le coût en durée de `npm test`.
4. Un **tableau comparatif** en français, lisible par un papa non développeur (deux ou trois phrases par candidat : ce que ça change pour l'enfant), avec ta recommandation argumentée.

## Ce qui peut être commité dans cette phase
- Le harnais de mesure : une suite lente `tests/slow/phases.test.ts` ou équivalent, qui imprime les tableaux et n'asserte que ce qui est vrai aujourd'hui, avec ses helpers. Commit `test: échantillonnage des phases de suspension au saut des volcans`. Il ne doit pas entrer dans `npm test` (budget CI).
- **Aucun changement de géométrie, de config ni de physique** n'est commité avant le choix du papa. Les candidats s'évaluent par `cfg` surchargé ou par une option de profil, dans les sondes et le harnais seulement.

## Contraintes globales (plan, extraits)
- Typecheck et `npm test` verts à chaque commit, jamais de `.skip`. Les suites longues vont dans `tests/slow/`.
- Déterminisme : tout aléa vient d'un `mulberry32` dérivé d'une graine.
- `track/`, `cars/`, `ai/` et `loop/` n'importent ni matter-js ni le DOM.
- Avant de toucher la physique, lis la section « Décisions prises hors plan » de docs/superpowers/handoff/2026-10-20-plan-a-passation.md : inertie explicite, roues à 48 côtés, 3e ressort, contact débouncé, convention d'angle.
- Commits en français, avec les trailers de la session (voir le brief de dispatch).
