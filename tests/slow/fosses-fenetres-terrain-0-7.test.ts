// Budget : < 10 min mur (16 cas × 98 runs, 122 quand la fenêtre dépasse 1,6 s ; 6,4 min MESURÉ, les 3 fichiers de
// fenêtres en parallèle). Fenêtres de saut d'une fosse précédée de la tranche k = 0 à 7 de la recette du saut §6.2 (a),
// prise en turbo (75 et 95 m avant le bord, lancé à 14 m/s 20 m avant la tranche) : la voiture peut arriver en l'air
// (tâche 5g, tour 1 ; protocole dans tests/helpers/fosses-fenetres.ts).
import { CONFIG } from '../../src/config';
import { beforeLabel, registerFosseWindows, type WindowCase } from '../helpers/fosses-fenetres';

const cases = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((k) => [75, 95].map((d): WindowCase => (
  { name: `${beforeLabel(k)}, turbo ${d} m avant le bord`, before: k, v: CONFIG.V_MAX, turboBefore: d })));

registerFosseWindows('fenêtres d’une fosse après la tranche k = 0 à 7 prise en turbo', cases);
