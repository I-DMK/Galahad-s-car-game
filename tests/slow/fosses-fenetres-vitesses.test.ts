// Budget : < 10 min mur (22 cas × 98 runs, 122 quand la fenêtre dépasse 1,6 s ; 7,6 min MESURÉ, les 3 fichiers de
// fenêtres en parallèle sur 4 cœurs). Fenêtres de saut d'une fosse (tâche 5g, tour 1 ; protocole dans
// tests/helpers/fosses-fenetres.ts) : vitesse tenue 8 à 21 m/s, départ arrêté au pire point sûr, turbo pris 50 à 95 m
// avant le bord (lancé à 14 m/s), saut d'étoile haute 80 et 90 m avant le bord (au plus tard : une étoile haute est à
// au moins STAR_HIGH_LANDING_ROOM du début de la garde, soit 77,4 m du bord).
import { CONFIG } from '../../src/config';
import { registerFosseWindows, type WindowCase } from '../helpers/fosses-fenetres';

const f1 = (v: number): string => String(Math.round(v * 10) / 10);

const cases: WindowCase[] = [
  ...[8, CONFIG.V_CRUISE, CONFIG.V_MAX, 17.5, 21].map((v): WindowCase => ({ name: `(b) ${f1(v)} m/s tenus`, before: 'plat', v })),
  { name: '(c) arrêt au pire point sûr', before: 'plat', v: 'arrêt' },
  ...[50, 55, 60, 65, 70, 75, 80, 85, 90, 95].map((d): WindowCase => ({ name: `(d) turbo ${d} m avant le bord`, before: 'plat', v: CONFIG.V_MAX, turboBefore: d })),
  ...[80, 90].flatMap((p): WindowCase[] => [
    { name: `saut d'étoile haute ${p} m avant le bord, ${f1(CONFIG.V_CRUISE)} m/s`, before: 'plat', v: CONFIG.V_CRUISE, preJumpBefore: p },
    { name: `saut d'étoile haute ${p} m avant le bord, ${f1(CONFIG.V_MAX)} m/s`, before: 'plat', v: CONFIG.V_MAX, preJumpBefore: p },
    { name: `saut d'étoile haute ${p} m avant le bord, turbo 95 m avant`, before: 'plat', v: CONFIG.V_MAX, preJumpBefore: p, turboBefore: 95 },
  ]),
];

registerFosseWindows('fenêtres d’une fosse : vitesses, turbo, saut d’étoile haute avant', cases);
