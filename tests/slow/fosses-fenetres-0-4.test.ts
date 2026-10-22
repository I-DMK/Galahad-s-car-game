// Budget : < 10 min mur (≈ 9 fosses × 4 cas × 98 runs à ≈ 0,06 s, ≈ 3,5 min CALCULÉ). Fenêtres de saut des fosses des
// graines 0 à 4 : protocole dans tests/helpers/fosses-fenetres.ts (tâche 5g, Step 6).
import { registerFosseWindows } from '../helpers/fosses-fenetres';

registerFosseWindows([0, 1, 2, 3, 4]);
