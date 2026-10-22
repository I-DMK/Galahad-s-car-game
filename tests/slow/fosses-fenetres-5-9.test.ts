// Budget : < 10 min mur (≈ 9 fosses × 4 cas × 98 runs à ≈ 0,06 s, ≈ 3,5 min CALCULÉ). Fenêtres de saut des fosses des
// graines 5 à 9 : protocole dans tests/helpers/fosses-fenetres.ts (tâche 5g, Step 6).
import { registerFosseWindows } from '../helpers/fosses-fenetres';

registerFosseWindows([5, 6, 7, 8, 9]);
