// Garde CI de la fenêtre des étoiles hautes (plan B, tâche 5e). Step 6 : la trajectoire de saut sur le plat du
// harnais (`flatJumpTrajectory`) a l'apogée mesuré au Step 3 (tests/jump.test.ts), à 1 cm près ; elle sert à
// prédire la fenêtre géométrique de chaque étoile haute. La fenêtre d'au moins 0,3 s (graine 1, deux vitesses)
// s'ajoute au Step 10, après la calibration de la hauteur (Step 9).
import { CONFIG } from '../src/config';
import { flatJumpTrajectory, predictedWindow } from './helpers/jump-runs';

/** Apogée du châssis (m) au-dessus de sa hauteur au saut, sur le plat, mesuré au Step 3 (à l'arrêt et à 14 m/s). */
const STEP3_APEX = 2.459;

describe('flatJumpTrajectory (harnais de saut)', () => {
  test.each([CONFIG.V_CRUISE, CONFIG.V_MAX])('à %f m/s : apogée = Step 3 à 1 cm près, vitesse tenue, retour au sol', (v) => {
    const traj = flatJumpTrajectory(v, CONFIG);
    const y0 = traj[0].chassis.y;
    const apex = Math.max(...traj.map((p) => p.chassis.y)) - y0;
    const flight = (traj.length - 1) * CONFIG.PHYSICS_DT;
    const range = traj[traj.length - 1].chassis.x - traj[0].chassis.x;
    console.log(`saut sur le plat à ${v.toFixed(1)} m/s : apogée ${apex.toFixed(3)} m, vol ${flight.toFixed(2)} s, ${range.toFixed(1)} m`);
    expect(Math.abs(apex - STEP3_APEX)).toBeLessThanOrEqual(0.01);
    expect(traj[0].speed).toBeCloseTo(v, 0);
    // Vol ≈ 2 × JUMP_VY / g ≈ 2 s, portée ≈ v × 2 s.
    expect(flight).toBeGreaterThan(1.8);
    expect(flight).toBeLessThan(2.6);
    expect(range / v).toBeCloseTo(flight, 0);
  });

  test('fenêtre géométrique prédite : non vide à 3,6 m, plus courte quand l’étoile monte, vide bien au-dessus de l’apogée', () => {
    const traj = flatJumpTrajectory(CONFIG.V_MAX, CONFIG);
    const w = (h: number): number => {
      const p = predictedWindow(traj, h, CONFIG);
      return Number.isNaN(p.sMin) ? 0 : (p.sMax - p.sMin) / CONFIG.V_MAX;
    };
    const rows = [3.6, 3.8, 3.9, 4.0, 4.1, 4.2].map((h) => `${h.toFixed(2)} m : ${w(h).toFixed(3)} s`);
    console.log(`fenêtre géométrique prédite à 14 m/s : ${rows.join(' ; ')}`);
    expect(w(3.6)).toBeGreaterThan(0.3);
    expect(w(3.9)).toBeLessThan(w(3.6));
    expect(w(6)).toBe(0);
  });
});
