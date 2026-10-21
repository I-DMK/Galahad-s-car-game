// Rampes-saut (scénarios conservés de l'ancien tests/jump.test.ts) : abordées à V_MAX puis à
// V_MAX × TURBO_FACTOR, depuis l'arrêt 40 m avant ou lancées 3 m avant, la voiture atterrit à moins
// de 45°, ne se retourne pas et garde ses roues sous le châssis.
import { CONFIG } from '../src/config';
import { carAngle, carSpeedMps, wheelsBelowChassis } from '../src/physics/car';
import type { World } from '../src/physics/world';
import {
  DEG, JumpTracker, STEPS_PER_SECOND, f1, freshCar, launch, newContact, step, worldFor,
} from './helpers/runs';

const SEEDS = [0, 1, 2, 3, 4];
const AFTER_LANDING_STEPS = 3 * STEPS_PER_SECOND;
/** Abscisse du sommet d'une rampe-saut, depuis le début de la tranche. */
const SAUT_LIP_DX = CONFIG.RAMP_LENGTH * Math.cos(CONFIG.RAMP_ANGLE);
const SAUT_RUN_UP = 40;
const SAUT_LAUNCH_BEFORE = 3;

interface SautRun {
  /** Vitesse (m/s) au premier pas où le châssis passe le début de la rampe. */
  rampSpeed: number;
  flightSeconds: number;
  touchDx: number;
  touchAngle: number;
  /** Angle à l'atterrissage deux roues, s'il a lieu dans les 3 s qui suivent le contact (sinon NaN). */
  landAngle: number;
  /** max |angle| du contact jusqu'à 3 s après. */
  maxAngleAfter: number;
  /** Nombre de pas observés après le contact (AFTER_LANDING_STEPS si la fenêtre est complète). */
  stepsAfter: number;
  /** Fin du scénario : chaque roue sous l'axe du châssis. */
  wheelsBelow: boolean;
}

/** Plein gaz (facteur) depuis x0, à l'arrêt ou lancée à v0 ; suit le saut de la rampe-saut commençant en xRamp. */
function sautRun(world: World, xRamp: number, x0: number, factor: number, v0: number): SautRun {
  const car = freshCar(world, x0);
  if (v0 > 0) launch(world, car, x0, v0);
  const contact = newContact();
  const jump = new JumpTracker(xRamp + SAUT_LIP_DX);
  const run: SautRun = { rampSpeed: NaN, flightSeconds: NaN, touchDx: NaN, touchAngle: NaN, landAngle: NaN, maxAngleAfter: 0, stepsAfter: 0, wheelsBelow: false };
  const maxSteps = 15 * STEPS_PER_SECOND;
  for (let i = 1; i <= maxSteps; i++) {
    const s = step(world, car, true, factor, contact, (i - 1) * CONFIG.PHYSICS_DT);
    if (Number.isNaN(run.rampSpeed) && s.x >= xRamp) run.rampSpeed = carSpeedMps(car);
    jump.update(i, s);
    if (!jump.touchStep) continue;
    const angle = carAngle(car);
    if (jump.touchStep === i) {
      run.flightSeconds = (i - jump.flightStart) / STEPS_PER_SECOND;
      run.touchDx = s.x - xRamp;
      run.touchAngle = angle;
    }
    if (jump.landStep === i) run.landAngle = angle;
    run.maxAngleAfter = Math.max(run.maxAngleAfter, Math.abs(angle));
    run.stepsAfter = i - jump.touchStep;
    if (run.stepsAfter >= AFTER_LANDING_STEPS) break;
  }
  run.wheelsBelow = wheelsBelowChassis(car);
  return run;
}

test.each(SEEDS)('seed %i : chaque rampe-saut, abordée à V_MAX puis à V_MAX × TURBO_FACTOR, atterrit à moins de 45° sans retournement', (seed) => {
  const world = worldFor(seed);
  const { track } = world;
  const ramps = track.slices.filter((s) => s.type === 'rampe-saut');
  expect(ramps.length).toBeGreaterThan(0);
  for (const ramp of ramps) {
    // Élan de 40 m depuis l'arrêt, jamais dans la zone d'un volcan (on repartirait du plat de réception).
    let restX = ramp.xStart - SAUT_RUN_UP;
    for (const v of track.volcanoes) if (restX >= v.xLancement && restX < v.xReception) restX = v.xReception;
    const launchX = ramp.xStart - SAUT_LAUNCH_BEFORE;
    for (const factor of [1, CONFIG.TURBO_FACTOR]) {
      const target = CONFIG.V_MAX * factor;
      const scenarios = [
        { name: `élan de ${f1(ramp.xStart - restX)} m depuis l'arrêt`, x0: restX, v0: 0 },
        { name: `lancée à ${f1(target)} m/s ${SAUT_LAUNCH_BEFORE} m avant`, x0: launchX, v0: target },
      ];
      for (const { name, x0, v0 } of scenarios) {
        const r = sautRun(world, ramp.xStart, x0, factor, v0);
        const where = `seed ${seed}, rampe-saut en x = ${f1(ramp.xStart)}, facteur ${factor}, ${name} : `
          + `vitesse en bas de rampe ${f1(r.rampSpeed)} m/s, vol ${f1(r.flightSeconds)} s, contact à +${f1(r.touchDx)} m `
          + `à ${f1(r.touchAngle / DEG)}°, max ${f1(r.maxAngleAfter / DEG)}° sur ${r.stepsAfter} pas`;
        if (v0 > 0) expect(r.rampSpeed, where).toBeGreaterThan(0.7 * target);
        expect(r.flightSeconds, where).toBeGreaterThan(0); // NaN si pas de vol ni de contact
        expect(r.stepsAfter, where).toBe(AFTER_LANDING_STEPS);
        expect(Math.abs(r.touchAngle), where).toBeLessThan(45 * DEG);
        expect(r.maxAngleAfter, where).toBeLessThanOrEqual(CONFIG.FLIP_ANGLE);
        expect(r.wheelsBelow, where).toBe(true);
      }
    }
  }
});
