import Matter from 'matter-js';
import { CONFIG, type Config } from '../src/config';
import { normalizeAngle } from '../src/cars/angle';
import {
  applyAirLevel, applyBrake, applyDrive, carAngle, carSpeedMps, clampVelocities, createCar,
  placeCar, setCarInvulnerable, wheelsBelowChassis, wheelsOnGround, type CarBody,
} from '../src/physics/car';
import { mpsToPxPerStep, physToWorld, speedMps, toPx } from '../src/physics/units';
import { CAT, carCategory, createWorld, stepWorld, type World } from '../src/physics/world';
import { generateTrack } from '../src/track/generate';
import { heightAt, slopeAt } from '../src/track/query';

const { Body, Composite, Vector } = Matter;

const DEG = Math.PI / 180;
const STEPS_PER_SECOND = 60;
const R = CONFIG.WHEEL_RADIUS;

/** Piste plate de 600 m (partagée : les tests ajoutent chacun leur voiture dans un monde neuf). */
const FLAT = generateTrack(1, 600, CONFIG, { onlyPlat: true });

function flatCar(x = 10): { world: World; car: CarBody } {
  const world = createWorld(FLAT, CONFIG);
  const car = createCar(world, 'galahad', 0, x, CONFIG);
  return { world, car };
}

/** Vitesse horizontale du châssis (m/s, monde : positive vers +x). */
const vxMps = (car: CarBody) => (car.chassis.velocity.x * STEPS_PER_SECOND) / CONFIG.PIXELS_PER_METER;
const posM = (b: Matter.Body) => physToWorld(b.position);

/** Lance toutes les parties à v m/s vers +x, roues en roulement sans glissement. */
function launch(car: CarBody, v: number): void {
  for (const p of car.parts) Body.setVelocity(p, { x: mpsToPxPerStep(v), y: 0 });
  for (const w of car.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(v) / toPx(R));
}

/**
 * Boucle de conduite de la tâche : applyDrive → stepWorld → clampVelocities. Facteurs de vitesse (plafond) et de couple
 * (montée de rotation) : 1 par défaut, comme Galahad (tâche 7).
 */
function drive(
  world: World, car: CarBody, steps: number, throttle: boolean, onStep?: (i: number) => void, speedFactor = 1, torqueFactor = 1,
): void {
  for (let i = 1; i <= steps; i++) {
    applyDrive(car, throttle, speedFactor, torqueFactor, CONFIG);
    stepWorld(world);
    clampVelocities(car, CONFIG);
    onStep?.(i);
  }
}

test('normalizeAngle ramène dans (−π, π]', () => {
  expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
  expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
  expect(normalizeAngle(-190 * DEG)).toBeCloseTo(170 * DEG, 12);
  expect(normalizeAngle(0.5)).toBeCloseTo(0.5, 12);
  expect(normalizeAngle(-7 * Math.PI + 0.25)).toBeCloseTo(-Math.PI + 0.25, 12);
});

test('construction : 3 parties sans frottement de l’air, masses 60/40/40, groupe négatif, 6 contraintes', () => {
  const { world, car } = flatCar();
  expect(car.id).toBe('galahad');
  expect(car.index).toBe(0);
  expect(car.parts).toEqual([car.chassis, ...car.wheels]);
  expect(car.chassis.label).toBe('chassis');
  for (const w of car.wheels) expect(w.label).toBe('wheel');
  for (const p of car.parts) {
    expect(p.frictionAir).toBe(0);
    expect(p.collisionFilter.group).toBe(-1);
    expect(p.collisionFilter.category).toBe(carCategory(0));
    expect(p.collisionFilter.mask).toBe(CAT.GROUND | CAT.ALL_CARS | CAT.SENSOR);
    expect(p.plugin.carId).toBe('galahad');
  }
  expect(car.chassis.mass).toBeCloseTo(CONFIG.CHASSIS_MASS, 9);
  for (const w of car.wheels) expect(w.mass).toBeCloseTo(CONFIG.WHEEL_MASS, 9);
  // Inertie cohérente avec la masse (au moins celle du disque / du rectangle plein) : sans
  // elle, Matter garde l'inertie d'un corps d'environ 1 kg et les roues tressautent.
  const [L, H, Rpx] = [toPx(CONFIG.CAR_LENGTH), toPx(CONFIG.CAR_HEIGHT), toPx(R)];
  expect(car.chassis.inertia).toBeGreaterThanOrEqual((CONFIG.CHASSIS_MASS * (L * L + H * H)) / 12);
  for (const w of car.wheels) expect(w.inertia).toBeGreaterThanOrEqual((CONFIG.WHEEL_MASS * Rpx * Rpx) / 2);
  expect(car.constraints).toHaveLength(6);
  for (const c of car.constraints) {
    expect(c.bodyA).toBe(car.chassis);
    expect(car.wheels).toContain(c.bodyB);
    expect(c.stiffness).toBe(CONFIG.SUSPENSION_STIFFNESS);
    expect(c.damping).toBe(CONFIG.SUSPENSION_DAMPING);
  }
  // Trois contraintes par roue : deux ancrées sur l'axe du châssis à ±SUSPENSION_ANCHOR_SPREAD de
  // l'axe de roue, une au-dessus du toit (SUSPENSION_TOP_OFFSET) : position de la roue unique.
  const [axleX, drop, spread] = [toPx(CONFIG.WHEEL_BASE / 2), toPx(CONFIG.WHEEL_DROP), toPx(CONFIG.SUSPENSION_ANCHOR_SPREAD)];
  const topY = toPx(CONFIG.CAR_HEIGHT / 2 + CONFIG.SUSPENSION_TOP_OFFSET);
  car.wheels.forEach((w, i) => {
    const mine = car.constraints.filter((c) => c.bodyB === w);
    expect(mine).toHaveLength(3);
    const side = i === 0 ? -1 : 1;
    const axis = mine.filter((c) => c.pointA.y === 0);
    expect(axis.map((c) => c.pointA.x).sort((a, b) => a - b))
      .toEqual([side * axleX - spread, side * axleX + spread].sort((a, b) => a - b));
    for (const c of axis) expect(c.length).toBeCloseTo(Math.hypot(spread, drop), 12);
    const top = mine.filter((c) => c.pointA.y !== 0);
    expect(top).toHaveLength(1);
    expect(top[0].pointA).toEqual({ x: side * axleX, y: -topY });
    expect(top[0].length).toBeCloseTo(topY + drop, 12);
    for (const c of mine) expect(c.pointB).toEqual({ x: 0, y: 0 });
  });
  const all = Composite.allBodies(world.engine.world);
  for (const p of car.parts) expect(all).toContain(p);
  expect(Composite.allConstraints(world.engine.world)).toHaveLength(6);
  // Une deuxième voiture a son propre groupe et sa propre catégorie.
  const other = createCar(world, 'b', 1, 20, CONFIG);
  for (const p of other.parts) expect(p.collisionFilter.group).toBe(-2);
  for (const p of other.parts) expect(p.collisionFilter.category).toBe(carCategory(1));
  // Posée à angle 0 : roues de part et d'autre, sous le centre du châssis.
  const c = posM(car.chassis);
  const [w0, w1] = car.wheels.map(posM);
  expect(c.x).toBeCloseTo(10, 6);
  expect(c.y).toBeCloseTo(R + CONFIG.WHEEL_DROP, 6);
  expect(w0.x).toBeCloseTo(10 - CONFIG.WHEEL_BASE / 2, 6);
  expect(w1.x).toBeCloseTo(10 + CONFIG.WHEEL_BASE / 2, 6);
  expect(w0.y).toBeCloseTo(R, 6);
  expect(carAngle(car)).toBeCloseTo(0, 12);
  expect(wheelsBelowChassis(car)).toBe(true);
});

test('repos : 120 pas sans gaz → immobile, à plat, roues posées', () => {
  const { world, car } = flatCar();
  drive(world, car, 120, false);
  for (const p of car.parts) expect(speedMps(p.velocity)).toBeLessThan(0.05);
  expect(carSpeedMps(car)).toBeLessThan(0.05);
  expect(Math.abs(carAngle(car))).toBeLessThan(2 * DEG);
  for (const w of car.wheels) {
    const p = posM(w);
    expect(Math.abs(p.y - heightAt(FLAT, p.x) - R)).toBeLessThan(0.05);
  }
  expect(wheelsOnGround(world.engine, car)).toEqual([true, true]);
});

test('calibration : accélération moyenne sur 0–2 s = DRIVE_ACCEL (± 10 %), dans [3,5 ; 5] m/s²', () => {
  const { world, car } = flatCar();
  drive(world, car, 2 * STEPS_PER_SECOND, true);
  const accel = carSpeedMps(car) / 2;
  expect(accel).toBeGreaterThanOrEqual(3.5);
  expect(accel).toBeLessThanOrEqual(5);
  expect(Math.abs(accel - CONFIG.DRIVE_ACCEL)).toBeLessThanOrEqual(0.1 * CONFIG.DRIVE_ACCEL);
  expect(vxMps(car)).toBeGreaterThan(0); // le gaz fait avancer vers +x
});

describe('couple de l’élastique (tâche 7) : montée de rotation WHEEL_SPINUP × torqueFactor', () => {
  /** Accélération moyenne (m/s²) sur 0–2 s, plein gaz depuis l'arrêt sur le plat. */
  const accel2s = (speedFactor: number, torqueFactor: number): number => {
    const { world, car } = flatCar();
    drive(world, car, 2 * STEPS_PER_SECOND, true, undefined, speedFactor, torqueFactor);
    return carSpeedMps(car) / 2;
  };

  test('torqueFactor 0,6 (copain loin devant) : ≈ 0,6 × 4,3 m/s² (± 15 %)', () => {
    const a = accel2s(0.6, 0.6);
    console.log(`accélération sur 2 s, facteurs 0,6 / 0,6 : ${a.toFixed(2)} m/s² (0,6 × DRIVE_ACCEL = ${(0.6 * CONFIG.DRIVE_ACCEL).toFixed(2)})`);
    expect(Math.abs(a - 0.6 * CONFIG.DRIVE_ACCEL)).toBeLessThanOrEqual(0.15 * 0.6 * CONFIG.DRIVE_ACCEL);
  });

  test('torqueFactor 1 et speedFactor 1,5 (turbo de Galahad) : 4,3 m/s² (± 10 %), inchangé', () => {
    const a = accel2s(CONFIG.TURBO_FACTOR, 1);
    console.log(`accélération sur 2 s, facteurs 1,5 / 1 (turbo de Galahad) : ${a.toFixed(2)} m/s²`);
    expect(Math.abs(a - CONFIG.DRIVE_ACCEL)).toBeLessThanOrEqual(0.1 * CONFIG.DRIVE_ACCEL);
  });

  test('torqueFactor 1,3 (copain loin derrière) : plus grande qu’avec 1 (imprimée : limite d’adhérence possible, μ g ≈ 4,9 m/s²)', () => {
    const a13 = accel2s(1.3, 1.3);
    const a1 = accel2s(1.3, 1);
    console.log(`accélération sur 2 s, facteurs 1,3 / 1,3 : ${a13.toFixed(2)} m/s² ; 1,3 / 1 : ${a1.toFixed(2)} m/s² (μ g ≈ ${(CONFIG.WHEEL_FRICTION * CONFIG.GRAVITY).toFixed(1)})`);
    expect(a13).toBeGreaterThan(a1);
  });

  test('couple × 1 : rotation montée de WHEEL_SPINUP exactement (Galahad au bit près)', () => {
    const { car } = flatCar();
    for (const w of car.wheels) Body.setAngularVelocity(w, 0.1);
    applyDrive(car, true, 1, 1, CONFIG);
    for (const w of car.wheels) expect(w.angularVelocity).toBe(0.1 + CONFIG.WHEEL_SPINUP);
    for (const w of car.wheels) Body.setAngularVelocity(w, 0.1);
    applyDrive(car, true, 1, 0.6, CONFIG);
    for (const w of car.wheels) expect(w.angularVelocity).toBe(0.1 + CONFIG.WHEEL_SPINUP * 0.6);
  });
});

test('vitesse max : plein gaz 10 s → [0,9 ; 1,02] × V_MAX', () => {
  const { world, car } = flatCar();
  let peak = 0;
  drive(world, car, 10 * STEPS_PER_SECOND, true, () => { peak = Math.max(peak, carSpeedMps(car)); });
  expect(carSpeedMps(car)).toBeGreaterThanOrEqual(0.9 * CONFIG.V_MAX);
  expect(peak).toBeLessThanOrEqual(1.02 * CONFIG.V_MAX);
  // Les roues sont bornées à la vitesse de roulement V_MAX × facteur ; le turbo relève la limite.
  const omegaMax = mpsToPxPerStep(CONFIG.V_MAX) / toPx(R);
  applyDrive(car, true, 1, 1, CONFIG);
  for (const w of car.wheels) expect(w.angularVelocity).toBeCloseTo(omegaMax, 12);
  applyDrive(car, true, CONFIG.TURBO_FACTOR, 1, CONFIG);
  for (const w of car.wheels) expect(w.angularVelocity).toBeGreaterThan(omegaMax);
});

test('après un turbo, doigt toujours posé : la vitesse redescend à V_MAX (± 5 %)', () => {
  // Garde-fou (relecture de branche) : le plafond de rotation des roues suffit à ramener le châssis
  // à V_MAX par le frottement roue–sol (mesuré : 20,3 → 14,0 m/s en ≈ 1,5 s). Le ≈ 20,9 m/s
  // soutenu observé en course vient des étoiles qui relancent le turbo, pas d'un défaut de plafond.
  const { world, car } = flatCar();
  const run = (factor: number, steps: number, onStep?: (i: number) => void) => {
    for (let i = 1; i <= steps; i++) {
      applyDrive(car, true, factor, 1, CONFIG);
      stepWorld(world);
      clampVelocities(car, CONFIG);
      onStep?.(i);
    }
  };
  run(CONFIG.TURBO_FACTOR, 5 * STEPS_PER_SECOND);
  expect(carSpeedMps(car)).toBeGreaterThan(1.2 * CONFIG.V_MAX);
  let lastSecondMax = 0;
  run(1, 5 * STEPS_PER_SECOND, (i) => {
    for (const w of car.wheels) expect(w.angularVelocity).toBeGreaterThanOrEqual(0);
    if (i > 4 * STEPS_PER_SECOND) lastSecondMax = Math.max(lastSecondMax, carSpeedMps(car));
  });
  expect(carSpeedMps(car)).toBeLessThanOrEqual(1.05 * CONFIG.V_MAX);
  expect(lastSecondMax).toBeLessThanOrEqual(1.05 * CONFIG.V_MAX);
  expect(vxMps(car)).toBeGreaterThan(0.9 * CONFIG.V_MAX); // elle roule toujours
});

test('doigt levé : de 14 m/s, ralentit sans jamais reculer, encore > 8 m/s après 2 s', () => {
  const { world, car } = flatCar();
  launch(car, 14);
  let minVx = Infinity;
  let at2s = 0;
  drive(world, car, 10 * STEPS_PER_SECOND, false, (i) => {
    minVx = Math.min(minVx, vxMps(car));
    for (const w of car.wheels) expect(w.angularVelocity).toBeGreaterThanOrEqual(0);
    if (i === 2 * STEPS_PER_SECOND) at2s = carSpeedMps(car);
  });
  expect(at2s).toBeGreaterThan(8);
  expect(at2s).toBeLessThan(14);
  expect(carSpeedMps(car)).toBeLessThan(at2s);
  expect(minVx).toBeGreaterThanOrEqual(0);
});

test('applyBrake(FINISH_BRAKE) : de 14 m/s à < 1 m/s en moins de 6 s', () => {
  const { world, car } = flatCar();
  launch(car, 14);
  let stoppedAt = Infinity;
  for (let i = 1; i <= 6 * STEPS_PER_SECOND && stoppedAt === Infinity; i++) {
    applyBrake(car, CONFIG.FINISH_BRAKE);
    stepWorld(world);
    clampVelocities(car, CONFIG);
    if (carSpeedMps(car) < 1) stoppedAt = i;
  }
  expect(stoppedAt).toBeLessThanOrEqual(6 * STEPS_PER_SECOND);
  expect(vxMps(car)).toBeGreaterThanOrEqual(0);
});

/**
 * Voiture complète en l'air (sol et mur retirés, 30 m de haut), châssis à 40° et roues à
 * leur position de repos dans le repère du châssis : la suspension part au repos et ne
 * redresse donc rien d'elle-même. Rend l'angle (°) tous les 15 pas et le minimum atteint.
 */
function airDrop(cfg: Config): { angles: number[]; minAngle: number; car: CarBody } {
  const world = createWorld(FLAT, cfg);
  Composite.remove(world.engine.world, [...world.ground, world.wall]);
  const car = createCar(world, 'galahad', 0, 10, cfg);
  placeCar(car, 10, () => 30, 40 * DEG, cfg);
  car.wheels.forEach((w, i) => {
    const local = { x: (i === 0 ? -1 : 1) * toPx(cfg.WHEEL_BASE / 2), y: toPx(cfg.WHEEL_DROP) };
    Body.setPosition(w, Vector.add(car.chassis.position, Vector.rotate(local, car.chassis.angle)));
  });
  for (const c of car.constraints) {
    const a = Vector.add(car.chassis.position, Vector.rotate(c.pointA, car.chassis.angle));
    expect(Vector.magnitude(Vector.sub(c.bodyB!.position, a))).toBeCloseTo(c.length, 6);
  }
  expect(carAngle(car)).toBeCloseTo(40 * DEG, 9);
  const angles: number[] = [];
  let minAngle = Infinity;
  for (let i = 1; i <= 90; i++) {
    const onGround = wheelsOnGround(world.engine, car);
    expect(onGround).toEqual([false, false]);
    applyAirLevel(car, onGround, cfg);
    stepWorld(world);
    clampVelocities(car, cfg);
    minAngle = Math.min(minAngle, carAngle(car) / DEG);
    if (i % 15 === 0) angles.push(carAngle(car) / DEG);
  }
  expect(posM(car.chassis).y).toBeGreaterThan(20); // toujours en l'air, rien touché
  return { angles, minAngle, car };
}

test('air-level sur la voiture complète : lâchée à 40° → < 10° après 90 pas, sans dépasser −15°', () => {
  const { angles, minAngle } = airDrop(CONFIG);
  expect(Math.abs(angles[angles.length - 1])).toBeLessThan(10);
  expect(minAngle).toBeGreaterThan(-15);
  // Témoin : sans air-level, rien ne redresse la voiture (le test ne peut pas passer à vide).
  const control = airDrop({ ...CONFIG, AIR_LEVEL_K: 0, AIR_LEVEL_D: 0 });
  expect(control.angles[control.angles.length - 1]).toBeGreaterThan(30);
});

test('lancée à V_MAX × TURBO_FACTOR, 10° vers le haut, 2 m au-dessus du plat : après 3 s, roues sous le châssis, voiture droite', () => {
  // Avant le 3e ressort (7c), la roue avant traversait l'axe du châssis à l'atterrissage (pas 116)
  // et restait coincée dans sa position miroir au-dessus (voiture sur le ventre, roues en l'air).
  const { world, car } = flatCar();
  const a = 10 * DEG;
  const v = CONFIG.V_MAX * CONFIG.TURBO_FACTOR;
  placeCar(car, 10, (x) => heightAt(FLAT, x) + 2 + (x - 10) * Math.tan(a), a, CONFIG);
  for (const p of car.parts) Body.setVelocity(p, { x: mpsToPxPerStep(v * Math.cos(a)), y: -mpsToPxPerStep(v * Math.sin(a)) });
  for (const w of car.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(v) / toPx(R));
  expect(wheelsBelowChassis(car)).toBe(true);
  for (let i = 1; i <= 3 * STEPS_PER_SECOND; i++) {
    applyDrive(car, true, CONFIG.TURBO_FACTOR, 1, CONFIG);
    applyAirLevel(car, wheelsOnGround(world.engine, car), CONFIG);
    stepWorld(world);
    clampVelocities(car, CONFIG);
  }
  expect(wheelsBelowChassis(car)).toBe(true);
  expect(Math.abs(carAngle(car))).toBeLessThan(15 * DEG);
  expect(posM(car.chassis).x).toBeGreaterThan(10 + 3 * CONFIG.V_MAX); // elle roule toujours
});

test('air-level inactif dès qu’une roue touche le sol', () => {
  const { car } = flatCar();
  placeCar(car, 10, () => 0, 20 * DEG, CONFIG);
  applyAirLevel(car, [true, false], CONFIG);
  expect(car.chassis.torque).toBe(0);
  applyAirLevel(car, [false, false], CONFIG);
  expect(car.chassis.torque).not.toBe(0);
});

test('clampVelocities : −80 m/s vertical → −31,5 m/s, horizontale inchangée', () => {
  const { car } = flatCar();
  const vx = mpsToPxPerStep(5);
  Body.setVelocity(car.chassis, { x: vx, y: mpsToPxPerStep(80) }); // Matter : y vers le bas
  Body.setVelocity(car.wheels[0], { x: -vx, y: -mpsToPxPerStep(80) });
  Body.setVelocity(car.wheels[1], { x: vx, y: mpsToPxPerStep(10) });
  clampVelocities(car, CONFIG);
  const worldVy = (b: Matter.Body) => (-b.velocity.y * STEPS_PER_SECOND) / CONFIG.PIXELS_PER_METER;
  expect(worldVy(car.chassis)).toBeCloseTo(-CONFIG.VERTICAL_SPEED_CAP, 9);
  expect(car.chassis.velocity.x).toBeCloseTo(vx, 12);
  expect(worldVy(car.wheels[0])).toBeCloseTo(CONFIG.VERTICAL_SPEED_CAP, 9);
  expect(car.wheels[0].velocity.x).toBeCloseTo(-vx, 12);
  expect(worldVy(car.wheels[1])).toBeCloseTo(-10, 9);
  expect(car.wheels[1].velocity.x).toBeCloseTo(vx, 12);
});

test('placeCar sur une pente de 8° (seed 1) : 30 pas sans gaz → immobile, sans saut', () => {
  const track = generateTrack(1, 1680, CONFIG);
  // Montée de 7 à 9° sous le châssis, régulière sous les deux roues (6 à 10°).
  const inRange = (x: number, lo: number, hi: number) => slopeAt(track, x) >= lo * DEG && slopeAt(track, x) <= hi * DEG;
  let x = NaN;
  for (const s of track.slices.filter((sl) => sl.type === 'bosses')) {
    for (let xx = s.xStart + 2; xx < s.xEnd - 2 && Number.isNaN(x); xx += 0.1) {
      const h = CONFIG.WHEEL_BASE / 2;
      if (inRange(xx, 7, 9) && inRange(xx - h, 6, 10) && inRange(xx + h, 6, 10)) x = xx;
    }
    if (!Number.isNaN(x)) break;
  }
  expect(Number.isNaN(x)).toBe(false);
  const world = createWorld(track, CONFIG);
  const car = createCar(world, 'galahad', 0, x, CONFIG);
  placeCar(car, x, (xx) => heightAt(track, xx), slopeAt(track, x), CONFIG);
  expect(carAngle(car)).toBeCloseTo(slopeAt(track, x), 9);
  for (const p of car.parts) {
    expect(p.velocity).toEqual({ x: 0, y: 0 });
    expect(p.angularVelocity).toBe(0);
  }
  const y0 = posM(car.chassis).y;
  drive(world, car, 30, false);
  expect(carSpeedMps(car)).toBeLessThan(0.05);
  expect(Math.abs(posM(car.chassis).y - y0)).toBeLessThan(0.05);
  expect(Math.abs(carAngle(car) - slopeAt(track, x))).toBeLessThan(2 * DEG);
});

test('placeCar remet à zéro les vitesses de toutes les parties', () => {
  const { car } = flatCar();
  launch(car, 14);
  placeCar(car, 50, () => 0, 0, CONFIG);
  for (const p of car.parts) {
    expect(p.velocity).toEqual({ x: 0, y: 0 });
    expect(p.angularVelocity).toBe(0);
  }
  expect(posM(car.chassis).x).toBeCloseTo(50, 6);
});

test('catégorie de collision par voiture (tâche 5d) : les pièces de la voiture d’index i portent carCategory(i) ; une 6e voiture lève une RangeError', () => {
  const world = createWorld(FLAT, CONFIG);
  for (let i = 0; i < 5; i++) {
    const car = createCar(world, `v${i}`, i, 10 + 5 * i, CONFIG);
    for (const p of car.parts) {
      expect(p.collisionFilter.category, `index ${i}`).toBe(carCategory(i));
      expect(p.collisionFilter.mask, `index ${i}`).toBe(CAT.GROUND | CAT.ALL_CARS | CAT.SENSOR);
      expect(p.collisionFilter.group, `index ${i}`).toBe(-(i + 1));
    }
  }
  expect(() => createCar(world, 'v5', 5, 40, CONFIG)).toThrow(RangeError);
});

test('invulnérable : mask sans les voitures (CAT.ALL_CARS), puis rétabli', () => {
  const { car } = flatCar();
  setCarInvulnerable(car, true);
  for (const p of car.parts) {
    expect(p.collisionFilter.mask).toBe(CAT.GROUND | CAT.SENSOR);
    expect((p.collisionFilter.mask ?? 0) & CAT.ALL_CARS).toBe(0);
    expect(p.collisionFilter.category).toBe(carCategory(0));
    expect(p.collisionFilter.group).toBe(-1);
  }
  setCarInvulnerable(car, false);
  for (const p of car.parts) expect(p.collisionFilter.mask).toBe(CAT.GROUND | CAT.ALL_CARS | CAT.SENSOR);
});
