# Tâche 5c « saut fiabilisé », phase 1 : mesure et correctifs candidats

Date : 2026-10-21. Branche `ccr-5b6fabc4-n96ofo`. Steps 1 et 2 du brief. Le Step 3 (implémenter le choix) attend la décision du papa.

**Convention.** **MESURÉ** désigne un chiffre sorti d'une simulation lancée dans cette session, avec la commande indiquée en fin de rapport. **SUPPOSÉ** désigne un raisonnement ou une estimation non vérifiés par une simulation. **REGISTRE** désigne une valeur reprise du registre sans être remesurée.

## 1. Ce qui fait tomber une voiture lancée, doigt posé (MESURÉ)

J'ai tracé pas à pas deux chutes propres retrouvées par le protocole : graine 6 volcan 2 (11,31 m/s au sommet) et graine 0 volcan 3 (11,18 m/s). Je les ai comparées à leur voisin d'échantillon, qui passe.

1. **Au pied de la rampe.** La voiture arrive à V_MAX (13,96 m/s) et la roue avant tape le pli 0° → 22°. En deux pas, la vitesse tombe à 12,0–12,4 m/s et la direction de la vitesse saute à 26–29°. **La voiture décolle dès le pied.**
2. **Sur la rampe.** Dans le cas qui tombe, les deux roues survolent toute la rampe : l'écart roue arrière–sol est de 0,3 à 0,4 m, et la roue avant ne touche plus rien du pied au sommet. La direction de la vitesse retombe sous l'effet de la gravité : 29° au pied, **13,7° au sommet**. Dans le cas qui passe, la roue avant retouche la rampe 1,6 m avant le sommet. La direction revient alors à 22–23,6° et les roues motrices réaccélèrent la voiture de 11,7 à 12,6 m/s.
3. **Au sommet.** La voiture décolle à 13,7° au lieu de ≈ 21°. Le saut est donc trop plat : apogée du châssis à 3,9 m, contre 5,1 m dans le cas qui passe. La **roue arrière touche le bord aval du capteur de lave** : en x = sommet + 14,62 m, alors que ce bord est à + 14,63 m, et 3 cm sous son toit.

La vitesse au sommet ne sépare donc pas les chutes des passages. Sur la référence, des sauts passent à 10,76 m/s alors que d'autres tombent à 11,31 m/s. Le facteur qui décide est la **direction de la vitesse au sommet** : 13,5–14,1° pour toutes les chutes, contre une médiane de 21,3° pour les passages. Ce qui la fixe, c'est le rebond au pied de la rampe, et non l'arête du sommet. Le « coup de la roue arrière sur l'arête », décrit dans les tâches 4 et 5b, est bien présent dans 2 chutes sur 4 : la roue arrière touche 0,13 à 0,24 m *avant* le sommet. Mais c'est une conséquence du vol au-dessus de la rampe, pas sa cause.

## 2. Protocole d'échantillonnage (tests/helpers/phases.ts, tests/slow/phases.test.ts)

- **Galahad seul**, aucune autre voiture. Toute chute est donc « propre » : aucun choc n'est possible.
- **Volcans :** les 43 volcans des graines 0 à 9 (6 + 5 + 8 × 4).
- **68 historiques par volcan**, déterministes (`mulberry32` d'une graine qui mélange graine de piste, volcan, famille et k). Le doigt est toujours posé au plus tard à xLancement, puis jusqu'au bout. Trois familles :
  - **échelonné** (16 par volcan) : départ arrêté à xLancement − d, doigt posé tout du long. d = k × 0,05 m sur deux fenêtres : [0 ; 0,40[ (départ au bord du plat) et [30 ; 30,40[ (arrivée à V_MAX après le relief de la tranche précédente) ;
  - **motif** (40 par volcan) : départ arrêté à xLancement − 40 − k × 0,05. Le doigt est levé par tranches de 0,25 s, avec une probabilité de 0,4 par tranche, puis posé pour de bon dès un x tiré dans [xLancement − 15 ; xLancement] ;
  - **turbo** (12 par volcan) : comme « motif », plus un turbo de 3 s pris en un x tiré dans [xLancement − 50 ; xElanStart − 2]. Le turbo est encore actif, ou s'arrête, n'importe où sur l'approche.
- **Total :** **2 924 runs par configuration**. Les mêmes historiques sont rejoués pour chaque candidat : la comparaison est appariée.
- **Issue d'un run :** `lave` (une pièce touche le capteur), `passe` (`passesVolcano` des cas de la tâche 4), sinon `autre`. Mesures par run :
  - vitesse à xLancement, au pied de la rampe et au sommet ;
  - direction de la vitesse au sommet ;
  - écart roue arrière–sol sur la rampe (max, moyen, au sommet) ;
  - premier contact de la roue arrière après le sommet ;
  - **garde au-dessus du capteur de lave** : bas de la pièce la plus basse moins le toit du capteur, sur toute la durée du vol. Une garde ≤ 0 signifie que la pièce a touché. C'est une mesure continue, qui montre la proximité d'une chute même quand aucun run ne tombe.
- **Monde rogné.** Je retire du monde Matter les corps statiques hors d'une fenêtre [xLancement − 85 ; xEnd + 15] autour du volcan. Les runs restent identiques au bit près à ceux du monde complet (MESURÉ : 16 runs sur 16, vitesse au sommet, atterrissage et durée égaux en `===`). Ils sont 15 fois plus rapides : 0,12 ms par pas au lieu de 1,83. Sans cela, le budget de calcul ne permettait pas plus de quelques centaines de runs.
- **Évaluation des candidats**, sans rien changer dans `src/` :
  - `cfg` surchargé pour (b) et (c) ; la piste est regénérée avec ce `cfg` ;
  - retouche des points de la piste après génération pour (a) et (d) (`roundLip`, `filletRampFoot`). Un test du harnais contrôle chaque retouche : pente ≤ MAX_SLOPE hors parois, 2 derniers mètres de rampe inchangés, aucun point au-dessus de lipY à moins de 8 m de xLip. Les parois du cratère ne bougent pas.

**Preuve que le protocole échantillonne le bon phénomène (MESURÉ).** Sur la configuration actuelle, il retrouve **4 chutes propres, toutes à plus de 10,5 m/s au sommet** : 10,94, 11,18, 11,18 et 11,31 m/s. Le harnais l'asserte : `protocole : au moins une chute propre doigt posé à plus de 10,5 m/s au sommet`.

## 3. Mesure de référence (configuration actuelle, MESURÉ)

2 924 runs sur 43 volcans : **4 chutes (0,14 %)**, 0 `autre`, sur 4 volcans différents. Toutes sont à plus de 10,5 m/s au sommet.

| famille | runs | chutes | vitesse à xLancement (min / p1 / p10 / méd. / p90 / max, m/s) |
|---|---|---|---|
| échelonné | 688 | 0 | 0,09 / 0,12 / 0,67 / 8,24 / 13,86 / 13,95 |
| motif | 1 720 | 2 (0,12 %) | 5,48 / 7,87 / 8,58 / 11,98 / 13,77 / 13,97 |
| turbo | 516 | 2 (0,39 %) | 6,88 / 7,93 / 8,73 / 12,35 / 14,27 / 17,68 |

Distributions (min / p1 / p10 / médiane / p90 / max) :

| | sommet (m/s) | direction au sommet (°) | écart roue arrière max sur la rampe (m) | écart moyen (m) |
|---|---|---|---|---|
| passe (2 920) | 10,76 / 11,18 / 11,90 / 12,50 / 13,34 / 19,09 | 13,26 / 13,38 / 19,51 / 21,34 / 23,26 / 27,17 | 0,20 / 0,23 / 0,26 / 0,31 / 0,36 / 0,52 | 0,06 / 0,07 / 0,08 / 0,12 / 0,17 / 0,38 |
| lave (4) | 10,94 / … / 11,18 / … / 11,31 | 13,55 / … / 13,90 / … / 14,10 | 0,37 / … / 0,38 | 0,24 / … / 0,25 |

Garde au-dessus du capteur, tous runs : **−0,03 / 0,96 / 1,81 / 2,57 / 3,43 / 5,62 m**. 1 % des sauts passent à moins d'un mètre de la lave.

Chutes (dans les 4 cas, c'est la roue arrière qui touche le capteur) :

- graine 0 volcan 2, turbo 11. Départ à xLancement − 40,55, doigt posé dès xLancement − 12,2, turbo à xLancement − 28,2. Arrivée 15,07 m/s, sommet 10,94 m/s à 13,76°, écart roue arrière max 0,38 m, moyen 0,25 ;
- graine 0 volcan 3, motif 1. Départ à xLancement − 40,05, doigt posé dès xLancement − 5,5. Arrivée 11,91 m/s, sommet 11,18 m/s à 13,55°, roue arrière qui touche la rampe à xLip − 0,13 m ;
- graine 6 volcan 2, motif 6. Départ à xLancement − 40,30, doigt posé dès xLancement − 14,8. Arrivée 10,64 m/s, sommet 11,31 m/s à 14,10°, roue arrière qui touche à xLip − 0,24 m ;
- graine 8 volcan 2, turbo 8. Départ à xLancement − 40,40, doigt posé dès xLancement − 1,8, turbo à xLancement − 18,2. Arrivée 12,28 m/s, sommet 11,18 m/s à 13,90°.

Comparaison avec le registre. Les chutes de la tâche 5b (Diego g1 v4 à 10,98 m/s, Galahad g10 v2 à 11,44 m/s) sont du même type : chute propre à plus de 10,5 m/s, écart roue arrière 0,37–0,40 m. La graine 10 est hors du périmètre 0–9 ; je n'ai pas rejoué ces deux courses-là.

## 4. Candidats (tous MESURÉS avec le même protocole, sur les mêmes 2 924 historiques)

Définition des candidats (aucun n'est commité dans `src/`) :

- **(a) arête du sommet arrondie côté aval, r = 1 m** (`roundLip`).
  - Le sommet (xLip, lipY) reste le point le plus haut, et la rampe ne change pas.
  - La descente commence à l'horizontale par un arc de 1 m de rayon, tangent à la pente de 27°. La descente rectiligne est ensuite décalée de 0,24 m vers l'aval, pris sur la vallée.
  - Le pli au sommet passe de 49° (+22° → −27°) à 22°. Points modifiés : de xLip + 0,09 à xLip + 4,49 m.
  - Pourquoi un congé côté aval seulement : un congé symétrique abaisserait le sommet d'environ 0,1 × r et le reculerait, ce que le cadrage interdit (« sans changer lipY ni la position du sommet »). Le congé symétrique n'a pas été mesuré.
- **(b) `LAVA_MARGIN` 0,75**, au lieu de 0,8. La lave se rapproche de 0,82 m du sommet et la vallée raccourcit d'autant. La longueur des tranches et le tracé ne changent pas : 43 volcans, piste de 1 680 m.
- **(c) `SUSPENSION_DAMPING` 0,3**, au lieu de 0,1.
- **(d) congé au pied de la rampe, R = 10 m** (`filletRampFoot`, candidat ajouté d'après le mécanisme du §1).
  - Le pli 0° → 22° du pied est remplacé par un arc concave de 10 m de rayon. L'arc est tangent au plat d'élan en xRampStart − 1,94 m et à la rampe en xRampStart + 1,80 m.
  - Points modifiés : de xRampStart − 1,75 à xRampStart + 1,65 m. Le sol est relevé de 19 cm au droit de l'ancien pli.
  - Au-delà, la rampe rectiligne, son sommet (xLip, lipY), l'angle de décollage de 22°, la lave et la réception ne changent pas. Pente maximale : 22°.

### 4.1 Taux de chute doigt posé et sauts

| | référence | (a) arête arrondie | (b) LAVA_MARGIN 0,75 | (c) amortissement 0,3 | (d) congé au pied |
|---|---|---|---|---|---|
| chutes / 2 924 | **4 (0,14 %)** | 2 (0,07 %) | 2 (0,07 %) | **150 (5,13 %)** | **0** |
| volcans avec une chute | 4 / 43 | 2 / 43 | 2 / 43 | 43 / 43 | 0 / 43 |
| chutes par famille (échelonné / motif / turbo) | 0 / 2 / 2 | 0 / 0 / 2 | 0 / 0 / 2 | 57 / 87 / 6 | 0 / 0 / 0 |
| garde au-dessus du capteur, min / p1 / p10 / méd. (m) | −0,03 / 0,96 / 1,81 / 2,57 | −0,03 / 0,96 / 1,81 / 2,58 | −0,02 / 1,21 / 1,98 / 2,69 | −0,13 / −0,05 / 0,43 / 1,65 | **1,72 / 1,92 / 2,21 / 2,76** |
| sommet des sauts réussis, min / p10 / méd. (m/s) | 10,76 / 11,90 / 12,50 | 10,76 / 11,89 / 12,50 | 10,76 / 11,89 / 12,50 | 10,61 / 11,63 / 12,19 | 12,04 / 12,71 / 13,03 |
| direction au sommet, min / p10 / méd. (°) | 13,3 / 19,5 / 21,3 | 13,3 / 19,5 / 21,3 | 13,3 / 19,5 / 21,3 | 12,5 / 15,8 / 18,7 | 18,3 / 19,4 / 20,8 |
| écart roue arrière–sol sur la rampe, méd. du max / méd. du moyen (m) | 0,31 / 0,12 | 0,31 / 0,12 | 0,31 / 0,12 | 0,38 / 0,24 | **0,11 / 0,07** |

Lecture :

- **(a) et (b)** suppriment les 2 mêmes chutes (« motif » g0 v3 et g6 v2). Ils laissent les 2 mêmes chutes « turbo » : g0 v2 et g8 v2, avec une garde de −0,01 à −0,03 m.
- **(a)** ne change que la descente après le sommet. Le saut reste aussi plat (13,8–13,9°), il est simplement un peu moins puni.
- **(b)** rapproche la lave. La garde du 1 % le plus bas passe de 0,96 à 1,21 m, mais les sauts les plus plats touchent encore.
- **(c)** fait pire. Une suspension plus raide transmet le coup du pied de rampe au châssis : 150 chutes, sur tous les volcans.
- **(d)** traite la cause. La voiture reste collée à la rampe (écart roue arrière moyen médian 0,07 m au lieu de 0,12) et garde sa motricité (sommet médian 13,03 m/s au lieu de 12,50). Elle décolle toujours entre 18,3 et 26,5°. **Aucune chute, et le saut le plus juste passe encore à 1,72 m au-dessus de la lave.**

### 4.2 Cas 1 à 7 de la tâche 4, sous chaque candidat

Les cas 1, 2, 2-lancement, 3, 4, 5, turbo et (i) sont joués sur **tous** les volcans des graines 0 à 9, c'est-à-dire plus que la CI et la suite lente. Le cas 6 est joué sur les graines 0 à 4, le cas 7 sur les graines 0 à 9, en courses complètes, Galahad seul. Chaque cellule donne « tenus / joués » puis la plage de vitesse au sommet en m/s.

| cas | référence | (a) | (b) | (c) | (d) |
|---|---|---|---|---|---|
| **1 arrêt à xElanStart → lave** | **43/43** (8,68) | **43/43** (8,68) | **43/43** (8,68) | **43/43** (8,83) | **43/43** (8,45) |
| 2 pire point sûr → passe | 43/43 (11,73) | 43/43 (11,73) | 43/43 (11,73) | 43/43 (12,54) | 43/43 (13,28) |
| 2-lancement | 43/43 (11,18–13,11) | idem | idem | 43/43 (11,05–13,24) | 43/43 (12,66–13,54) |
| 3 après bosses | 31/31 (11,31–12,99) | idem | idem | 31/31 (11,49–13,02) | 31/31 (12,83–13,61) |
| 4 choc 8 m/s | 43/43 (11,48) | idem | idem | **0/43 (10,48, lave)** | 43/43 (12,93–12,94) |
| 5 turbo à l'étoile d'élan | 43/43 (13,78–15,93) | idem | idem | 43/43 (12,59–15,39) | 43/43 (15,00–16,17) |
| turbo permanent | 43/43 (15,84–17,79) | idem | idem | 43/43 (14,41–18,34) | 43/43 (16,76–18,52) |
| (i) rampe-saut → plat → volcan | 12/12 | 12/12 | 12/12 | **11/12** (g2 v2 turbo −40 m : lave) | 12/12 |
| 6 course doigt posé (g0–4) | 5/5 ; 119,9 / 118,1 / 119,0 / 126,5 / 122,4 s ; 0 respawn | 5/5 ; 119,6 / 118,3 / 119,0 / 126,5 / 122,4 ; 0 | 5/5 ; 119,9 / 119,0 / 118,9 / 128,1 / 121,6 ; 0 | 5/5 ; 117,6 / 115,4 / 118,2 / 126,6 / 122,6 ; 0 | 5/5 ; 119,6 / 116,7 / 117,7 / 126,8 / 120,8 ; 0 |
| 7 doigt levé 30 % (g0–9) | 10/10 ; 3 chutes (g1, g2, g6), max 1 par volcan | 10/10 ; 3 chutes, max 1 | 10/10 ; 3 chutes (g1, g2, g8), max 1 | 10/10 ; **7 chutes**, max 1 | 10/10 ; 3 chutes (g1, g8 ×2), **max 2** (g8 ; limite 2) |
| sommet ≥ seuil + 1 (cas 2 à 5, turbo) | 100 % | 100 % | 100 % | 100 % sauf cas 4 | 100 % |

Le **cas 1 tient pour tous les candidats.** Frontière de l'arrêt complet près du volcan (sonde : arrêt à xElanStart − k, premiers volcans des graines 0 et 3) :

- **référence et (d) :** inchangée, lave pour k ≤ 1,5 m, passage pour k ≥ 2 m ;
- **(b) :** elle recule de 0,5 m, et k = 1,5 m passe désormais.

Pour (d), le cas 7 de la graine 8 tombe deux fois au même volcan, à la limite admise (≤ 2). C'est le fonctionnement prévu : après la deuxième chute de suite, la voiture est replacée à xEnd − 10. Il s'agit de vraies chutes doigt levé, pas de chutes propres.

### 4.3 Doigt levé toléré, rampes-saut, durée

| | référence | (a) | (b) | (c) | (d) |
|---|---|---|---|---|---|
| tableau (b) : volcans passés à T = 1 / 1,25 / 1,5 / 1,75 s | 43 / 43 / 18 / 0 | 43 / 43 / 18 / 0 | 43 / 43 / 40 / 0 | 43 / 1 / 0 / 0 | 43 / 43 / 41 / 0 |
| doigt levé toléré par volcan, min / médiane | 1,25 / 1,25 s | 1,25 / 1,25 s | 1,25 / 1,5 s | **1 / 1 s** | 1,25 / 1,5 s |
| rampes-saut (tests/rampes.test.ts, graines 0–4) | 152/152 | 152/152 (identiques) | 152/152 (identiques) | 152/152 (angle au contact max 8,4°, au lieu de 3,1°) | 152/152 (identiques) |
| pas simulés des cas joués en CI (volcans) / rampes | 13 629 / 77 660 | 13 629 / 77 660 | 13 629 / 77 660 | 13 194 / 75 816 | 13 853 (+1,6 %) / 77 660 |
| durée de `npm test` | **165,7 s MESURÉ** (323/323) | ≈ 165,7 s | ≈ 165,7 s | ≈ 163 s | ≈ 166–167 s |

La ligne « tableau (b) » reprend la tâche 4 : voiture lancée à V_MAX, doigt levé T s depuis xElanStart − 10, puis gaz, sur les 43 volcans.

Durées de `npm test` par candidat (SUPPOSÉ) : je n'ai rien changé dans `src/` et je n'ai donc pas pu lancer `npm test` sous un candidat. L'estimation se fait au prorata des pas simulés. Le seul fichier touché est `tests/volcans.test.ts` (≈ 63 s d'après le REGISTRE), qui varie de −3 % à +1,6 %. Pour (d), cela fait environ +1 s, et `rampes.test.ts` ne change pas. Quel que soit le candidat, le Step 3 ajoutera en suite lente l'invariant à 5 voitures sur les graines 0 à 23. SUPPOSÉ : ≈ 24 courses × ≈ 16 s ≈ 6–7 min sur un cœur, d'après race-invariants (10 courses en ≈ 165 s, REGISTRE).

## 5. Tableau comparatif pour le papa

| Correctif | Ce que ça change pour Galahad | Tombe-t-il encore doigt posé ? | Verdict |
|---|---|---|---|
| **(a) Sommet de la rampe arrondi** | Rien de visible au départ du saut : seule la pente qui suit le sommet devient arrondie. La voiture saute exactement pareil, et le défaut, la voiture qui « décolle trop plat », reste. | Oui, 2 fois sur 2 924 (contre 4 aujourd'hui). | Insuffisant. |
| **(b) Lave rapprochée (marge 0,75)** | La lave est 80 cm plus près du tremplin, donc tous les sauts sont un peu plus faciles. Lever le doigt juste avant un volcan pardonne un peu plus. S'arrêter 1,5 m avant le début du plat d'élan ne fait plus tomber, alors qu'aujourd'hui si. | Oui, 2 fois sur 2 924. Les sauts « ratés » restent ratés, la lave est juste plus près. | Insuffisant seul ; rend le jeu plus facile. |
| **(c) Suspension plus amortie** | La voiture est plus raide. Elle encaisse plus mal le pied du tremplin et décolle de travers bien plus souvent. Un choc juste avant le volcan (cas 4) la fait tomber à tous les coups. | Oui, et beaucoup plus : 150 fois sur 2 924, sur tous les volcans. | **Rejeté** (le cas 4 casse). |
| **(d) Bas du tremplin arrondi (congé de 10 m)** | Le tremplin du volcan commence en douceur, par une courbe au lieu d'un pli. La voiture monte collée à la rampe au lieu de rebondir au pied, et elle s'envole toujours dans le bon angle. Le reste ne change pas : s'arrêter devant le volcan fait toujours tomber, et lever le doigt plus d'environ 1,5 s juste avant aussi. | **Non : 0 sur 2 924.** Le saut le plus juste passe encore à 1,7 m au-dessus de la lave, contre 0 cm aujourd'hui. | **Recommandé.** |

**Recommandation : (d), congé au pied de la rampe-volcan, R = 10 m.** Trois raisons.

1. C'est le seul candidat qui supprime les chutes propres : 0 sur 2 924, au lieu de 4. Il le fait avec une marge (garde minimale de 1,72 m) et non au bord.
2. Il corrige la cause mesurée, le rebond au pied de la rampe, et non un symptôme.
3. Il garde tout ce que le papa a validé : le cas 1 (arrêt au pied → lave) et sa frontière à 1,5–2 m, le seuil de doigt levé (minimum 1,25 s, médiane 1,5 s, contre 1,25 s), les rampes-saut, les cas 2 à 7 et (i). La course doigt posé dure de 116,7 à 126,8 s, contre 118,1 à 126,5 s aujourd'hui.

Points d'attention, à vérifier au Step 3 :

- le rayon de 10 m est la seule valeur mesurée. Un rayon plus petit (SUPPOSÉ) rebondirait davantage ;
- l'effet sur les chutes à 5 voitures (Diego g1 v4, Galahad g10 v2) n'a pas été mesuré. Il le sera par l'invariant `lavaByCar.galahad === 0` à 5 voitures sur les graines 0 à 23 ;
- les tests de `tests/slices.test.ts` qui exigent un plat d'élan à 0 jusqu'à xRampStart, et la valeur du premier point de rampe, devront être amendés : le plat d'élan est relevé sur ses 1,94 derniers mètres ;
- visuellement, le pied du tremplin sera arrondi sur ≈ 3,7 m.

(b) peut s'ajouter à (d) si le papa veut aussi un jeu un peu plus facile. Ce n'est pas nécessaire pour la promesse.

## 6. Commandes, sorties, commits

**Sondes temporaires**, `tests/zz-probe-5c-*.test.ts`, toutes supprimées :

| sonde | ce qu'elle mesure | résultat |
|---|---|---|
| timing | coût d'un run en monde complet | 54 481 pas en 99,7 s, soit 1,83 ms par pas |
| crop | monde rogné contre monde complet | 16/16 runs identiques au bit près ; 0,122 ms par pas contre 1,827 |
| pilote | 4 fichiers, 10/15/8 historiques par volcan | 1 849 runs, 2 chutes propres (11,18 et 11,31 m/s) |
| trace | les 2 chutes et leurs voisins, pas à pas | mécanisme du §1 |
| count | nombre de volcans par graine et par candidat | 6 5 4 4 4 4 4 4 4 4 pour les 5 configurations |
| stops | arrêt à xElanStart − k, référence, (d) et (b) | voir §4.2 |

**Mesure principale.** Quatre processus en parallèle, où `<g>` vaut 0,2 / 1,3 / 4,5,6 / 7,8,9 :

```
PHASES_VARIANTS=reference,arete,marge,amortissement,pied PHASES_SEEDS=<g> PHASES_OUT=test-results/phases npx vitest run -c vitest.slow.config.ts tests/slow/phases.test.ts
```

Sortie : 14/14, 14/14, 21/21 et 21/21 tests passés, en 571 s, 483 s, 628 s et 607 s.

**Courses (cas 6 et 7).** Cinq processus, `<v>` parcourant les cinq configurations :

```
PHASES_VARIANTS=<v> PHASES_PARTS=races PHASES_OUT=test-results/phases npx vitest run -c vitest.slow.config.ts tests/slow/phases.test.ts
```

Sortie : 10 ou 20 tests passés par processus (20 pour (a) et (d), qui ajoutent le contrôle du profil), en 312 à 525 s.

**Fusion :**

```
PHASES_MERGE=test-results/phases npx vitest run -c vitest.slow.config.ts tests/slow/phases.test.ts
```

Sortie : 1 test passé, qui imprime les tableaux et asserte la chute propre de la référence (4 trouvées).

**Contrôle des profils retouchés** (pente ≤ 27°, sommet gardé) : passé sur les graines 0 à 9 pour (a) et (d).

**Vérifications avant commit :**

- `npm run typecheck` : 0 erreur ;
- `npm test` : 28 fichiers, **323/323**, 165,74 s.

**Commit :** `ee58194 test: échantillonnage des phases de suspension au saut des volcans`. Il contient :

- `tests/helpers/phases.ts` (nouveau) ;
- `tests/slow/phases.test.ts` (nouveau) ;
- `tests/helpers/runs.ts` : observateur `onStep` optionnel dans `runFrom`, sans effet sur les tests existants.

Aucun push, aucune modification de `src/`.

**Calcul consommé :** ≈ 27 min en temps réel sur 4 cœurs (sondes ≈ 4,5 min, mesure principale 10,5 min, courses ≈ 9 min, `npm test` 2,8 min).

**Réserves :**

- Le lancement par défaut de la suite (référence seule, un seul processus, ≈ 7,4 min sur un cœur, mesuré comme somme des morceaux) n'a pas été rejoué tel quel. Le même code a tourné en morceaux, et la fusion a passé la même assertion.
- La suite entre dans `npm run test:slow`, dont elle allonge la durée d'environ 7 min de travail pour un cœur.

## Phase 2 : implémentation du choix du papa, (d) congé de 10 m au pied de la rampe

### Ce qui a été fait (commit `25ba33f fix: saut fiabilisé, bas du tremplin arrondi`)

**Code (`src/`) :**

- **`src/config.ts`** : nouvelle constante `RAMP_FOOT_RADIUS: 10`. Son commentaire cite la mesure : 4 chutes propres sur 2 924 avant, 0 après, garde minimale de −0,03 m avant et de 1,72 m après, tâche 5c. Les commentaires de `V_JUMP` et `LAVA_MARGIN` reprennent les nouvelles mesures.
- **`src/track/slices.ts`, `rampeVolcan`** :
  - le congé est le comportement par défaut, sans option morte. L'arc concave est tangent au plat d'élan en xRampStart − R tan 11° (−1,94 m) et à la rampe en xRampStart − 1,94 + R sin 22° (+1,80 m) ;
  - le profil lève une erreur si le congé déborde du plat d'élan ou atteint le sommet ;
  - avec R = 0, on retrouve exactement le pli d'origine. Ce n'est pas une option du jeu : c'est le cas limite du rayon, qui sert à la variante « pli » du harnais pour la comparaison avant/après ;
  - les rampes-saut ne sont pas touchées (testé).
  - Le harnais de la phase 1 n'avait pas d'option de profil dans `src/` : c'était une retouche faite dans les tests. Elle est supprimée, comme les candidats (a), (b) et (c), qui restent disponibles au commit `ee58194`.
- **`src/sim/simulate.ts`** : `simulateRace` accepte un observateur optionnel `onStep(sim)`, sans effet sur la course. Il sert à classer les chutes à 5 voitures. `src/physics/world.ts` : commentaire de seuil mis à jour.

**Tests :**

- **`tests/slices.test.ts`** (+6 tests, 44 au total). Couvert :
  - plat d'élan à 0 jusqu'à xRampStart − 1,944 m, puis relevé sur l'arc (+0,19 m au droit de l'ancien pli) ;
  - premier point de rampe sur l'arc, au-dessus de l'ancienne rampe rectiligne ;
  - au-delà du congé, hauteurs identiques au bit près au profil sans congé : sommet (dxLip, lipY), lave, réception, longueur, parois exemptées ;
  - **pente continue**, variation ≤ 1,5° par segment de 0,2 m, contre plus de 15° (22°) sans congé, avec une pente entre 0 et 22° ;
  - `MAX_SLOPE` et parois exemptées, par le test générique de tous les profils ;
  - erreur si le congé déborde ; rampe-saut identique avec ou sans congé ;
  - R = 0 redonne le pli d'origine.
- **`tests/slow/phases.test.ts`** : il asserte maintenant **0 chute doigt posé** sur la configuration par défaut (2 924 historiques) et imprime toujours les tableaux. La variante `PHASES_VARIANTS=pli` asserte l'inverse : le protocole retrouve au moins une chute propre à plus de 10,5 m/s sur l'ancien pied.
- **Invariant à 5 voitures, graines 0 à 23**, en quatre fichiers parallèles. `tests/slow/race-invariants.test.ts` est renommé en `race-invariants-0-5.test.ts`, et j'ai ajouté `-6-11`, `-12-17` et `-18-23`, sur un helper commun, `registerRaceInvariants` (`tests/helpers/race.ts`). Pour chaque graine, `expectRaceInvariants` porte `lavaByCar.galahad === 0`. Le tableau des chutes de **toutes** les voitures donne leur cause : « choc » si un contact avec une autre voiture a eu lieu dans les 5 s précédentes, « propre » sinon. Le budget CI n'est pas touché : `race-smoke` reste sur les graines 1 et 2.
- **Commentaires de mesures mis à jour** : `tests/helpers/cases.ts` (vitesses au sommet des cas et trajectoire unique), `tests/helpers/runs.ts` (`LIP_SPEED_THRESHOLD`), `tests/slow/dosage.test.ts` (bande du seuil et tableau (a)).

### Preuves TDD (MESURÉ)

1. **Profil.**
   - Rouge : les tests de `slices.test.ts` écrits avant l'implémentation donnent **4 en échec**, 40 passent (plat relevé, premier point de rampe, pas de pli, erreur de débordement).
   - Vert, après implémentation : **44/44**.
2. **Invariant à 5 voitures.**
   - Rouge, avant l'implémentation : `race-invariants-0-5` et `-6-11` donnent **1 échec, graine 10** : « galahad au volcan 2 (t = 70,8 s) : propre, dernier contact avec malo 47,2 s avant », `lavaByCar.galahad` = 1. Le tableau signale aussi « diego au volcan 4 (graine 1, t = 96,9 s) : propre, dernier contact 65,6 s avant ». Ce sont les deux chutes propres de la tâche 5b.
   - Vert, après implémentation : **24/24 graines, 0 chute pour toutes les voitures**.
3. **Harnais des phases.** Avant, la mesure de la phase 1 donnait 4 chutes sur la même protocole (pied d'avant). Après : **0 chute sur 2 924**, assertion verte dans `npm run test:slow`.

### Mesures après le correctif (MESURÉ, `npm run test:slow`)

**Échantillonnage des phases** (2 924 historiques, 43 volcans, graines 0 à 9) :

- **0 chute**, 0 `autre` ;
- garde au-dessus du capteur (min / p1 / p10 / médiane / p90 / max) : **1,72** / 1,92 / 2,21 / 2,76 / 3,69 / 5,69 m ;
- sommet : 12,04 / 12,44 / 12,71 / 13,03 / 13,65 / 20,10 m/s ;
- direction au sommet : 18,3 / 18,8 / 19,4 / 20,8 / 22,8 / 26,5° ;
- écart roue arrière–sol sur la rampe : 0,11 m (médiane du max) et 0,07 m (médiane du moyen).

Ces valeurs sont identiques à la mesure du candidat (d) en phase 1.

**Cas de la tâche 4**, tous les volcans des graines 0 à 9 (harnais) :

| cas | tenus | sommet (m/s) | avant le congé |
|---|---|---|---|
| 1 | 43/43 lave | 8,4477, écart 7e-9 | 8,6775 |
| 2 | 43/43 | 13,2783, écart 1e-7 | 11,7304 |
| 2-lancement | 43/43 | 12,66–13,54 | 11,18–13,11 |
| 3 | 31/31 | 12,83–13,61 | 11,31–12,99 |
| 4 | 43/43 | 12,9327–12,9368 (écart 0,004, contre 3e-6 avant) | 11,4834 |
| 5 | 43/43 | 15,00–16,17 | 13,78–15,93 |
| turbo | 43/43 | 16,76–18,52 | 15,84–17,79 |
| (i) | 12/12 | 12,27–13,66 | 11,79–13,52 |

Tous les cas exigeant une vitesse au sommet ≥ seuil + 1 la tiennent.

- **`volcans-slow`** (cas 7 et scénario (i)) : vert.
  - Cas 7 (doigt levé 30 %) : respawns par graine 0, 1, 0, 1, 0, 2, 0, 0, 0, 0 ; au plus 2 par volcan, atteint à la graine 5 (à la limite admise de 2) ; arrivées entre 126,5 et 142,4 s.
- **`finish`** (cas 6) : 118,4 / 117,1 / 118,6 / 126,8 / 120,5 s, 0 respawn.
- **`dosage`** : vert.
  - Bissection, roues bridées, 15 volcans : **tombe 9,75–10,14 m/s, passe 9,96–10,75**. Cas 2 au sommet ≥ 12,77, marge de 2,63 m/s contre la pire chute (0,92 avant).
  - Tableau (c) : arrêt à xElanStart − k → lave pour k = 0 et 1, passage dès k = 2 (inchangé).
  - Tableau (b), premier volcan de la graine 0 : doigt levé 1,5 s → passe (10,41), 2 s → lave (9,48).
  - Tableau (a) : le cas 1 tombe jusqu'à L_ELAN 7,5 m. Il passe ensuite de 7,75 à 12 m, sauf à 9,25 m (lave). Avant, l'issue était chaotique dès 7,5 m.
- **Tableau (b) sur les 43 volcans** (harnais) : doigt levé toléré minimum 1,25 s, médiane 1,5 s (1,25 s avant).
- **Rampes-saut :** 152/152, identiques.

**Courses à 5 voitures, doigt posé, graines 0 à 23 :**

- 24/24 invariants tenus ;
- **0 chute dans la lave, toutes voitures confondues** (propres 0, choc 0) ;
- **les deux chutes propres d'avant ont disparu** : Diego graine 1 volcan 4, et Galahad graine 10 volcan 2 (Galahad 1er à la graine 10, en 125,3 s) ;
- Galahad arrive entre 116,5 et 130,3 s. Il est 1er dans 20 graines sur 24 : 2e aux graines 1 et 17, 3e aux graines 6 et 19.

**Trace figée** (`tests/simulate.test.ts`, graine 1, 20 s, x ≤ 235 m) : **inchangée**, le test passe sans recapture. C'est attendu : le premier volcan de la graine 1 commence à xLancement ≈ 544 m, hors de la trace.

### Durées (MESURÉ)

| commande | résultat | durée |
|---|---|---|
| `npm run typecheck` | 0 erreur | — |
| `npm test` | 28 fichiers, **329/329** | **178,4 s**, puis **190,3 s** au second passage (165,7 s avant, avec 323 tests) |
| `npm run test:slow` (une fois, en entier) | 9 fichiers, **158/158** | **713 s** (≈ 11 min 53) |
| `npm run e2e` | **6/6** | 59,7 s |

Sur `npm test`, l'écart de +12 à +25 s n'est pas expliqué par les pas simulés : +1,6 % sur les cas de volcans, 6 tests de profil quasi instantanés. Il vient probablement de la machine et du suivi des contacts ajouté à `race-smoke`. SUPPOSÉ, non isolé.

Dans `test:slow`, `phases.test.ts` (≈ 7 min sur un cœur) et les 24 courses à 5 voitures (≈ 14 à 23 s chacune) dominent.

### Capture

Fichier : **`e2e/screenshots/tremplin.png`**. Graine 1, premier volcan (xRampStart 582,95), Galahad à 1,9 m du pied, 50 images par seconde. On y voit le plat d'élan qui se relève en courbe douce vers la rampe, au lieu du pli.

La capture vient d'une sonde Playwright temporaire (`e2e/zz-probe-5c-tremplin.spec.ts`, 52 s), supprimée avant `npm run e2e` et avant le commit. Le dossier `e2e/screenshots/` est ignoré par git : la capture n'est pas commitée.

### Commandes de la phase 2

```
npx vitest run tests/slices.test.ts                                     # rouge (4 en échec), puis vert 44/44
npx vitest run -c vitest.slow.config.ts tests/slow/race-invariants-0-5.test.ts tests/slow/race-invariants-6-11.test.ts   # rouge : graine 10
npm run typecheck ; npm test ; npm run test:slow ; npm run e2e
npx playwright test e2e/zz-probe-5c-tremplin.spec.ts                    # capture (sonde supprimée)
```

Commits de la tâche 5c :

- `ee58194` : test, phase 1 ;
- `25ba33f` : fix, phase 2.

Aucun push.
