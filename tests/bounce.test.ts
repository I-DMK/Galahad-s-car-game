import Matter from 'matter-js';
import { CONFIG, type Config } from '../src/config';
import {
  applyAirLevel, applyDrive, carAngle, clampVelocities, createCar, onTrack, updateGroundContact, wheelsOnGround,
  type CarBody, type GroundContact,
} from '../src/physics/car';
import { physToWorld, worldToPhys } from '../src/physics/units';
import { CAT, carCategory, createWorld, stepWorld } from '../src/physics/world';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';

const DEG = Math.PI / 180;
const STEPS_PER_SECOND = 60;
const WARMUP_STEPS = 4 * STEPS_PER_SECOND;
const MEASURE_STEPS = 6 * STEPS_PER_SECOND;

interface BounceStats {
  /** Part des pas avec au moins une roue au sol (contact de jeu, updateGroundContact). */
  anyShare: number;
  /** Part des pas avec les deux roues au sol (contact de jeu). */
  bothShare: number;
  /** Mêmes parts, contact brut du pas (wheelsOnGround), pour information. */
  rawAnyShare: number;
  rawBothShare: number;
  /** max − min de l'altitude monde du châssis (m). */
  excursion: number;
  /** max |angle du châssis| (rad). */
  angleMax: number;
}

/**
 * Plein gaz sur piste plate depuis x = 10 avec la boucle de jeu (applyDrive → applyAirLevel(contact
 * de jeu) → stepWorld → clampVelocities → updateGroundContact) : 4 s d'accélération ignorées, puis 6 s mesurées.
 */
function measureBounce(factor: number, cfg: Config = CONFIG): BounceStats {
  const track = generateTrack(1, 600, cfg, { onlyPlat: true });
  const world = createWorld(track, cfg);
  const car = createCar(world, 'galahad', 0, 10, cfg);
  const ground = (x: number) => heightAt(track, x);
  const contact: GroundContact = { groundedUntil: [0, 0], trackUntil: [0, 0] };
  let grounded: [boolean, boolean] = [true, true];
  let any = 0;
  let both = 0;
  let rawAny = 0;
  let rawBoth = 0;
  let yMin = Infinity;
  let yMax = -Infinity;
  let angleMax = 0;
  for (let i = 0; i < WARMUP_STEPS + MEASURE_STEPS; i++) {
    applyDrive(car, true, factor, cfg);
    applyAirLevel(car, grounded, cfg);
    stepWorld(world);
    clampVelocities(car, cfg);
    grounded = updateGroundContact(world.engine, car, contact, (i + 1) / STEPS_PER_SECOND, ground, cfg);
    if (i < WARMUP_STEPS) continue;
    const [rear, front] = grounded;
    if (rear || front) any++;
    if (rear && front) both++;
    const [rawRear, rawFront] = wheelsOnGround(world.engine, car);
    if (rawRear || rawFront) rawAny++;
    if (rawRear && rawFront) rawBoth++;
    const y = physToWorld(car.chassis.position).y;
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
    angleMax = Math.max(angleMax, Math.abs(carAngle(car)));
  }
  return {
    anyShare: any / MEASURE_STEPS, bothShare: both / MEASURE_STEPS,
    rawAnyShare: rawAny / MEASURE_STEPS, rawBothShare: rawBoth / MEASURE_STEPS,
    excursion: yMax - yMin, angleMax,
  };
}

const pct = (x: number) => `${(100 * x).toFixed(1)} %`;
const fmt = (s: BounceStats) =>
  `jeu : une roue ${pct(s.anyShare)}, deux roues ${pct(s.bothShare)} ; ` +
  `brut : une roue ${pct(s.rawAnyShare)}, deux roues ${pct(s.rawBothShare)} ; ` +
  `excursion ${s.excursion.toFixed(3)} m, |angle| max ${(s.angleMax / DEG).toFixed(2)}°`;

test('updateGroundContact : contact brut ou écart < GROUND_CONTACT_GAP, puis GROUND_DEBOUNCE_SECONDS de tolérance', () => {
  expect(CONFIG.GROUND_DEBOUNCE_SECONDS).toBe(0.1);
  expect(CONFIG.GROUND_CONTACT_GAP).toBe(0.03);
  const R = CONFIG.WHEEL_RADIUS;
  /** Corps factice (catégorie de collision `category`) dont le bas (centre − R) est à `gap` m au-dessus d'un sol plat à y = 0. */
  const body = (label: string, category: number, gap = 1) => {
    const b = { label, isSensor: false, position: worldToPhys({ x: 0, y: R + gap }), collisionFilter: { category } } as Matter.Body;
    b.parent = b;
    return b;
  };
  const flat = () => 0;
  const ground = body('ground', CAT.GROUND);
  const sensor = { ...body('lava', CAT.SENSOR), isSensor: true } as Matter.Body;
  sensor.parent = sensor;
  const [rear, front] = [body('rear', carCategory(0)), body('front', carCategory(0))];
  const car = { wheels: [rear, front] } as unknown as CarBody;
  const engineWith = (pairs: { bodyA: Matter.Body; bodyB: Matter.Body; isActive: boolean }[]) =>
    ({ pairs: { list: pairs } }) as unknown as Matter.Engine;
  const contact: GroundContact = { groundedUntil: [0, 0], trackUntil: [0, 0] };
  const update = (engine: Matter.Engine, t: number) => updateGroundContact(engine, car, contact, t, flat, CONFIG);

  // Roues à 1 m du sol. t = 0 : roue arrière en contact brut, roue avant sur un capteur seulement.
  const touching = engineWith([
    { bodyA: rear, bodyB: ground, isActive: true },
    { bodyA: sensor, bodyB: front, isActive: true },
  ]);
  expect(update(touching, 0)).toEqual([true, false]);
  // Plus aucun contact : encore au sol à t = 0,05 s, plus à t = 0,15 s.
  const none = engineWith([{ bodyA: rear, bodyB: ground, isActive: false }]);
  expect(update(none, 0.05)).toEqual([true, false]);
  expect(update(none, 0.15)).toEqual([false, false]);
  // Nouveau contact : la fenêtre repart de cet instant.
  expect(update(touching, 0.2)).toEqual([true, false]);
  expect(update(none, 0.29)).toEqual([true, false]);
  // Sans contact brut, l'écart suffit : 2 cm → au sol, 4 cm → non (puis la fenêtre s'écoule).
  front.position = worldToPhys({ x: 0, y: R + 0.02 });
  expect(update(none, 0.5)).toEqual([false, true]);
  front.position = worldToPhys({ x: 0, y: R + 0.04 });
  expect(update(none, 0.55)).toEqual([false, true]);
  expect(update(none, 0.61)).toEqual([false, false]);
  // Piste seule (tâche 5e, relectures : seule la piste compte) : le sol et l'écart datent `trackUntil` comme le
  // contact de jeu ; une autre voiture date le contact de jeu, jamais `trackUntil`.
  expect(onTrack(contact, 0.61)).toBe(false);
  front.position = worldToPhys({ x: 0, y: R + 1 });
  const copain = body('copain', carCategory(1));
  const onCopain = engineWith([{ bodyA: copain, bodyB: rear, isActive: true }]);
  expect(update(onCopain, 1)).toEqual([true, false]);
  expect(onTrack(contact, 1)).toBe(false);
  expect(update(touching, 1.2)).toEqual([true, false]);
  expect(onTrack(contact, 1.2)).toBe(true);
  expect(onTrack(contact, 1.35)).toBe(false);
});

/*
 * Seuils fixés en 7c d'après la mesure (48 côtés, 3e ressort, WHEEL_SPINUP 0,0054, contact de jeu) :
 * facteur 1 : une roue 98,1 %, deux roues 92,8 % (brut : 28,3 % / 3,6 %), excursion 0,067 m, |angle| 1,72° ;
 * turbo : une roue 85,0 %, deux roues 67,8 % (brut : 18,1 % / 2,2 %), excursion 0,166 m, |angle| 3,98°.
 * Planchers imposés : facteur 1 ≥ 0,8 / ≥ 0,6 / ≤ 0,10 m / ≤ 3° ; turbo ≥ 0,6 / ≤ 0,30 m.
 * L'excursion est sensible au moindre réglage (0,042 à 0,088 m en 7c) : marge laissée au plancher.
 */
test('plein gaz sur le plat : roues au sol (contact de jeu), châssis stable', () => {
  const s = measureBounce(1);
  const where = `facteur 1 : ${fmt(s)}`;
  expect(s.anyShare, where).toBeGreaterThanOrEqual(0.9);
  expect(s.bothShare, where).toBeGreaterThanOrEqual(0.8);
  expect(s.excursion, where).toBeLessThanOrEqual(0.1);
  expect(s.angleMax, where).toBeLessThanOrEqual(3 * DEG);
});

test('turbo sur le plat : au moins une roue au sol (contact de jeu), châssis peu agité', () => {
  const s = measureBounce(CONFIG.TURBO_FACTOR);
  const where = `turbo : ${fmt(s)}`;
  expect(s.anyShare, where).toBeGreaterThanOrEqual(0.75);
  expect(s.excursion, where).toBeLessThanOrEqual(0.25);
});
