import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import {
  applyAirLevel, applyDrive, carAngle, carSpeedMps, clampVelocities, createCar, placeCar, wheelsBelowChassis,
  wheelsOnGround,
  type CarBody,
} from '../src/physics/car';
import { mpsToPxPerStep, physToWorld, toPx } from '../src/physics/units';
import { createWorld, sensorsTouching, stepWorld, type World } from '../src/physics/world';
import { generateTrack } from '../src/track/generate';
import { heightAt, slopeAt } from '../src/track/query';
import type { Volcano } from '../src/track/types';

const { Body, Composite } = Matter;

const SEEDS = [0, 1, 2, 3, 4];
const TRACK_LENGTH = 1680;
const DEG = Math.PI / 180;
const STEPS_PER_SECOND = 60;
/** Vol : au moins 0,3 s sans aucun contact avec le sol (roues ni châssis). */
const FLIGHT_STEPS = 0.3 * STEPS_PER_SECOND;
/**
 * Les roues rebondissent à grande vitesse (contact une étape sur quatre environ à V_MAX sur le
 * plat) : « deux roues au sol » = chaque roue a touché le sol dans les 0,1 dernière seconde.
 */
const BOTH_WHEELS_WINDOW = 6;
const VOLCANO_STEPS = 12 * STEPS_PER_SECOND;
const AFTER_LANDING_STEPS = 3 * STEPS_PER_SECOND;
/** Abscisse du sommet d'une rampe-saut, depuis le début de la tranche. */
const SAUT_LIP_DX = CONFIG.RAMP_LENGTH * Math.cos(CONFIG.RAMP_ANGLE);
const SAUT_RUN_UP = 40;
const SAUT_LAUNCH_BEFORE = 3;

const worlds = new Map<number, World>();
/** Un monde par seed, partagé par les scénarios de ce seed. */
function worldFor(seed: number): World {
  let world = worlds.get(seed);
  if (!world) {
    world = createWorld(generateTrack(seed, TRACK_LENGTH, CONFIG), CONFIG);
    worlds.set(seed, world);
  }
  return world;
}

let current: CarBody | undefined;
/** Voiture neuve à l'arrêt en x (posée selon la pente locale) ; la précédente est retirée du monde. */
function freshCar(world: World, x: number): CarBody {
  if (current) Composite.remove(world.engine.world, current.composite);
  current = createCar(world, 'galahad', 0, x, CONFIG);
  placeCar(current, x, (xx) => heightAt(world.track, xx), slopeAt(world.track, x), CONFIG);
  return current;
}

/** Lance toutes les parties à v m/s le long de la pente locale, roues en roulement sans glissement. */
function launch(world: World, car: CarBody, x: number, v: number): void {
  const a = slopeAt(world.track, x);
  const velocity = { x: mpsToPxPerStep(v * Math.cos(a)), y: -mpsToPxPerStep(v * Math.sin(a)) };
  for (const p of car.parts) Body.setVelocity(p, velocity);
  for (const w of car.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(v) / toPx(CONFIG.WHEEL_RADIUS));
}

/** Le châssis est-il en contact actif avec un corps non capteur (sol, mur) ? */
function chassisOnGround(world: World, car: CarBody): boolean {
  for (const pair of world.engine.pairs.list as Matter.Pair[]) {
    if (!pair.isActive) continue;
    const { bodyA, bodyB } = pair;
    if ((bodyA.parent === car.chassis && !bodyB.isSensor) || (bodyB.parent === car.chassis && !bodyA.isSensor)) return true;
  }
  return false;
}

interface StepState { x: number; wheels: [boolean, boolean]; chassis: boolean; lava: boolean }

/** Boucle de la tâche : applyDrive → applyAirLevel → stepWorld → clampVelocities, puis lecture des contacts. */
function step(world: World, car: CarBody, factor: number): StepState {
  applyDrive(car, true, factor, CONFIG);
  applyAirLevel(car, wheelsOnGround(world.engine, car), CONFIG);
  stepWorld(world);
  clampVelocities(car, CONFIG);
  return {
    x: physToWorld(car.chassis.position).x,
    wheels: wheelsOnGround(world.engine, car),
    chassis: chassisOnGround(world, car),
    lava: sensorsTouching(world.engine, car.parts).some((b) => b.label === 'lava'),
  };
}

/**
 * Suit un saut à partir de xTakeoff : vol = FLIGHT_STEPS pas consécutifs sans aucun contact ;
 * contact = premier pas où une partie touche le sol après le début du vol ; atterrissage =
 * premier pas où les deux roues ont touché le sol (depuis le début du vol) dans la fenêtre.
 */
class JumpTracker {
  private streak = 0;
  private lastWheelContact = [-Infinity, -Infinity];
  flightStart = 0;
  touchStep = 0;
  landStep = 0;

  constructor(private readonly xTakeoff: number) {}

  /** À appeler à chaque pas i (1, 2, …). */
  update(i: number, s: StepState): void {
    s.wheels.forEach((on, k) => { if (on) this.lastWheelContact[k] = i; });
    if (this.landStep) return;
    if (!this.flightStart) {
      if (s.x < this.xTakeoff) return;
      this.streak = s.wheels[0] || s.wheels[1] || s.chassis ? 0 : this.streak + 1;
      if (this.streak >= FLIGHT_STEPS) this.flightStart = i - this.streak + 1;
      return;
    }
    if (!this.touchStep && (s.wheels[0] || s.wheels[1] || s.chassis)) this.touchStep = i;
    if (this.lastWheelContact.every((t) => t >= this.flightStart && t > i - BOTH_WHEELS_WINDOW)) this.landStep = i;
  }
}

interface VolcanoRun {
  lava: boolean;
  /** Vitesse (m/s) au premier pas où le châssis passe xLip. */
  lipSpeed: number;
  maxX: number;
  flightSeconds: number;
  touchX: number;
  landX: number;
  landSeconds: number;
  /** Fin du scénario : chaque roue sous l'axe du châssis (pas coincée dans la position miroir). */
  wheelsBelow: boolean;
}

/** Plein gaz depuis l'arrêt en x0, jusqu'à l'atterrissage, la lave ou 12 s. */
function volcanoRun(world: World, v: Volcano, x0: number, factor: number): VolcanoRun {
  const car = freshCar(world, x0);
  const jump = new JumpTracker(v.xLip);
  const run: VolcanoRun = { lava: false, lipSpeed: NaN, maxX: -Infinity, flightSeconds: NaN, touchX: NaN, landX: NaN, landSeconds: NaN, wheelsBelow: false };
  for (let i = 1; i <= VOLCANO_STEPS; i++) {
    const s = step(world, car, factor);
    run.maxX = Math.max(run.maxX, s.x);
    if (Number.isNaN(run.lipSpeed) && s.x >= v.xLip) run.lipSpeed = carSpeedMps(car);
    if (s.lava) { run.lava = true; break; }
    jump.update(i, s);
    if (jump.touchStep === i) run.touchX = s.x;
    if (jump.landStep === i) {
      run.flightSeconds = (jump.touchStep - jump.flightStart) / STEPS_PER_SECOND;
      run.landX = s.x;
      run.landSeconds = i / STEPS_PER_SECOND;
      break;
    }
  }
  run.wheelsBelow = wheelsBelowChassis(car);
  return run;
}

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
  const jump = new JumpTracker(xRamp + SAUT_LIP_DX);
  const run: SautRun = { rampSpeed: NaN, flightSeconds: NaN, touchDx: NaN, touchAngle: NaN, landAngle: NaN, maxAngleAfter: 0, stepsAfter: 0, wheelsBelow: false };
  const maxSteps = 15 * STEPS_PER_SECOND;
  for (let i = 1; i <= maxSteps; i++) {
    const s = step(world, car, factor);
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

const f1 = (n: number) => n.toFixed(1);

test.each(SEEDS)('seed %i : chaque volcan est franchi sans lave (élan complet, pire point sûr, turbo permanent)', (seed) => {
  const world = worldFor(seed);
  const { volcanoes } = world.track;
  expect(volcanoes.length).toBeGreaterThan(0);
  for (const v of volcanoes) {
    const worst = v.xElanStart + (1 - CONFIG.ELAN_SAFE_FRACTION) * (v.xRampStart - v.xElanStart);
    const scenarios = [
      { name: 'élan complet', x0: v.xElanStart, factor: 1 },
      { name: 'pire point sûr', x0: worst, factor: 1 },
      { name: 'turbo permanent', x0: v.xElanStart, factor: CONFIG.TURBO_FACTOR },
    ];
    for (const { name, x0, factor } of scenarios) {
      const r = volcanoRun(world, v, x0, factor);
      const where = `seed ${seed}, volcan en x = ${f1(v.xElanStart)}, ${name} : vitesse au sommet ${f1(r.lipSpeed)} m/s, `
        + `x max ${f1(r.maxX)}, contact ${f1(r.touchX)}, atterrissage ${f1(r.landX)} `
        + `(lave ${f1(v.xLava)}, réception [${f1(v.xReception)} ; ${f1(v.xEnd)}])`;
      expect(r.lava, where).toBe(false);
      expect(r.landX, where).toBeGreaterThanOrEqual(v.xReception);
      expect(r.landX, where).toBeLessThanOrEqual(v.xEnd);
      expect(r.wheelsBelow, where).toBe(true);
    }
  }
});

test.each(SEEDS)('seed %i : chaque rampe-saut, abordée à V_MAX puis à V_MAX × TURBO_FACTOR, atterrit à moins de 45° sans retournement', (seed) => {
  const world = worldFor(seed);
  const { track } = world;
  const ramps = track.slices.filter((s) => s.type === 'rampe-saut');
  expect(ramps.length).toBeGreaterThan(0);
  for (const ramp of ramps) {
    // Élan de 40 m depuis l'arrêt, jamais dans la zone d'un volcan (on repartirait du plat de réception).
    let restX = ramp.xStart - SAUT_RUN_UP;
    for (const v of track.volcanoes) if (restX >= v.xElanStart && restX < v.xReception) restX = v.xReception;
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
