// Garde CI de la fenêtre des étoiles hautes (plan B, tâche 5e). Step 6 : la trajectoire de saut sur le plat du
// harnais (`flatJumpTrajectory`) a l'apogée mesuré au Step 3 (tests/jump.test.ts), à 1 cm près ; elle sert à
// prédire la fenêtre géométrique de chaque étoile haute. Step 14 : garde de la fenêtre réelle sur l'étoile du
// premier plat étoile de la graine 1 (au moins 0,4 s à 11,2 et à 14 m/s, au moins 0,3 s à STAR_HIGH_Y + 5 cm ; saut
// §6.6). Elle échoue si JUMP_VY, la gravité, la suspension ou les roues changent sans recalibrer STAR_HIGH_Y.
import { CONFIG } from '../src/config';
import { heightAt } from '../src/track/query';
import { flatJumpTrajectory, predictedWindow, RUN_UP, windowFor } from './helpers/jump-runs';
import { croppedWorld } from './helpers/phases';
import { trackFor } from './helpers/runs';

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

describe('fenêtre réelle de l’étoile du 1er plat étoile de la graine 1 (garde CI)', () => {
  const track = trackFor(1);
  const flat = track.slices.find((sl) => sl.type === 'plat-étoile')!;
  const star = track.stars.find((st) => st.high && st.x >= flat.xStart && st.x <= flat.xEnd)!;
  const world = croppedWorld(track, CONFIG, star.x - RUN_UP - 15, star.x + 14 * 9 + 30);

  test.each([CONFIG.V_CRUISE, CONFIG.V_MAX])('à %f m/s : au moins 0,4 s, et au moins 0,3 s à STAR_HIGH_Y + 5 cm, sans réapparition', (v) => {
    expect(star.y - heightAt(track, star.x)).toBeCloseTo(CONFIG.STAR_HIGH_Y, 9);
    const w = windowFor(world, star, v, CONFIG);
    const up = windowFor(world, { ...star, y: star.y + 0.05 }, v, CONFIG);
    console.log(`fenêtre, graine 1, étoile du 1er plat étoile (x = ${star.x.toFixed(1)}) à ${v.toFixed(1)} m/s : ${w.seconds.toFixed(3)} s `
      + `(centre ${w.centreLead.toFixed(2)} s avant l'étoile), ${up.seconds.toFixed(3)} s à + 5 cm`);
    expect(w.seconds).toBeGreaterThanOrEqual(0.4);
    expect(up.seconds).toBeGreaterThanOrEqual(0.3);
    expect(w.respawnSeen || up.respawnSeen).toBe(false);
  });
});
