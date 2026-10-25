// Fenêtres de saut d'un rocher, balayées pas à pas (plan C, tâche 11c, Step 10 ; spec « rochers » §2.2 et §6) : Galahad
// seul sur la piste plate, rocher en 250 m, témoin sans saut jusqu'au choc, un appui à chaque pas des 2 s qui précèdent.
// Fenêtre principale ≥ 0,55 s à 8 m/s et au départ arrêté, ≥ 0,70 s à 11,2, 14, 21 et en turbo ; un seul morceau ; bords à 14 m/s mesurés en
// session 8 : 0,48 et 1,34 s avant xStart.
import { CONFIG } from '../../src/config';
import { rockWindow, rockWorld, type RockWindow } from '../helpers/rochers';
import { f2 } from '../helpers/runs';

const { world, rock } = rockWorld();
const rows: string[] = [];

afterAll(() => {
  console.log(['fenêtres d’un rocher 1,6 × 3 m (s ; bords en s avant xStart)', ...rows].join('\n'));
});

const CASES: { label: string; v: number | 'arrêt'; turboAtX?: number; min: number }[] = [
  { label: '8 m/s tenus', v: 8, min: 0.55 },
  { label: '11,2 m/s tenus', v: 11.2, min: 0.7 },
  { label: '14 m/s tenus', v: 14, min: 0.7 },
  { label: '21 m/s tenus', v: 21, min: 0.7 },
  // Le plan ne fixe pas de seuil au départ arrêté (la spec §2.2 en attendait ≈ 0,8 s, CALCULÉ à 13 m/s tenus) : MESURÉ
  // 0,63 s, la voiture accélère pendant la fenêtre (un appui tôt part plus lentement et retombe plus court) ; plancher
  // de 8 m/s gardé, écart rapporté au contrôleur.
  { label: 'départ arrêté 30 m avant', v: 'arrêt', min: 0.55 },
  { label: 'turbo pris 40 m avant (14 m/s)', v: 14, turboAtX: rock.xStart - 40, min: 0.7 },
];

test.each(CASES)('$label : fenêtre principale ≥ $min s, un seul morceau', ({ label, v, turboAtX, min }) => {
  const w: RockWindow = rockWindow(world, rock, v, { turboAtX });
  rows.push(`${label.padEnd(32)} | ${f2(w.seconds)} s | ${w.pieces} morceau(x) | bords ${f2(w.leadFrom)} – ${f2(w.leadTo)} | choc du témoin à ${f2(w.hitSpeed)} m/s | ${w.runs} runs`);
  expect(w.pieces).toBe(1);
  expect(w.seconds).toBeGreaterThanOrEqual(min);
  if (v === 14 && turboAtX === undefined) {
    expect(w.leadTo).toBeGreaterThanOrEqual(0.4);
    expect(w.leadTo).toBeLessThanOrEqual(0.56);
    expect(w.leadFrom).toBeGreaterThanOrEqual(1.2);
    expect(w.leadFrom).toBeLessThanOrEqual(1.5);
  }
  expect(CONFIG.ROCK_HEIGHT).toBe(1.6);
});
