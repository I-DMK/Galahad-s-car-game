// Pas de course (tâche 5b) : non-régression du plan A (Galahad seul, défaut `robots: false`), grille
// de départ à 5 voitures (`robots: true`), délai de départ, déterminisme, garde-fou `rebuildCars`.
import Matter from 'matter-js';
import { GALAHAD, drawPilots } from '../src/cars/pilots';
import { CONFIG } from '../src/config';
import { physToWorld } from '../src/physics/units';
import { CAT } from '../src/physics/world';
import {
  carView, createRaceSim, rebuildCars, sceneOf, simulateRace, stepRace, type CarSim, type RaceSim,
} from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';

const TRACK = generateTrack(1, 1680, CONFIG);
const DT = CONFIG.PHYSICS_DT;
/** Espacement de la grille entre deux centres de châssis (m) : 1,5 × CAR_LENGTH = 3,3. */
const GRID_GAP = CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH;

const chassisX = (car: CarSim): number => physToWorld(car.body.chassis.position).x;
const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Trace figée du plan A, capturée AVANT la refonte à 5 voitures (code du commit 745d68a) : graine 1,
 * 1 680 m, Galahad seul, doigt toujours posé, x du châssis (m) à t = 0, 1, …, 20 s
 * (`simulateRace(...).progressAt(t)`, arrondi à 1e-4). Avec le défaut `robots: false`, la course doit
 * rester identique à ±0,01 m : si elle bouge, c'est un défaut de la refonte, pas une valeur à recapturer.
 */
const PLAN_A_TRACE = [
  19.5, 21.6756, 27.541, 34.8112, 42.8405, 51.1456, 60.7517, 73.7171, 85.4157, 96.0462, 107.097,
  119.4203, 132.1322, 144.9215, 157.0952, 169.1846, 181.252, 194.1849, 207.9578, 221.4995, 234.9332,
];

describe('Galahad seul (défaut robots: false, comme au plan A)', () => {
  test('createRaceSim : une seule voiture, Galahad posé 2 m avant la ligne de départ, point sûr au sol', () => {
    const sim = createRaceSim(TRACK, CONFIG); // défaut : Galahad seul
    const x0 = TRACK.xStart - 2;
    expect(sim.cars).toHaveLength(1);
    const [g] = sim.cars;
    expect(g.pilot).toBe(GALAHAD);
    expect(g.driver).toBeNull();
    expect(g.factor).toBe(1);
    expect(g.body.id).toBe('galahad');
    expect(g.state.id).toBe('galahad');
    expect(g.state.name).toBe('Galahad');
    expect(g.state.color).toBe('#1e5cff');
    expect(g.state.accent).toBe('#e2231a');
    expect(g.state.safePoint).toEqual({ x: x0, y: heightAt(TRACK, x0), angle: 0 });
    expect(g.state.progress).toBeCloseTo(x0, 6);
    expect(sim.time).toBe(0);
    expect(carView(sim, 0).helmet).toBe('#e2231a');
  });

  test('non-régression du plan A : graine 1, doigt posé 20 s, progression = trace figée à ±0,01 m chaque seconde', () => {
    const r = simulateRace(TRACK, { throttle: () => true, maxSeconds: 20, cfg: CONFIG }); // défaut : Galahad seul
    const got = PLAN_A_TRACE.map((_, t) => Number(r.progressAt(t).toFixed(4)));
    PLAN_A_TRACE.forEach((x, t) => {
      expect(Math.abs(r.progressAt(t) - x), `t = ${t} s : ${JSON.stringify(got)}`).toBeLessThanOrEqual(0.01);
    });
  });

  test('doigt posé 5 s : la voiture avance de plus de 20 m', () => {
    const r = simulateRace(TRACK, { throttle: () => true, maxSeconds: 5, cfg: CONFIG }); // défaut : Galahad seul
    expect(Math.abs(r.time - 5)).toBeLessThanOrEqual(DT + 1e-9);
    expect(r.progressAt(5) - r.progressAt(0)).toBeGreaterThan(20);
    expect(r.maxSpeed).toBeGreaterThan(5);
    expect(r.respawns).toEqual([]);
    expect(r.finishedAt).toBeNull();
    expect(r.ranking).toEqual(['galahad']);
  });

  test('doigt levé 5 s : la voiture reste sur place (< 0,5 m)', () => {
    const r = simulateRace(TRACK, { throttle: () => false, maxSeconds: 5, cfg: CONFIG }); // défaut : Galahad seul
    expect(Math.abs(r.time - 5)).toBeLessThanOrEqual(DT + 1e-9);
    expect(Math.abs(r.progressAt(5) - r.progressAt(0))).toBeLessThan(0.5);
  });
});

describe('grille de départ à 5 voitures (robots: true)', () => {
  test('Galahad en pole à xStart − 2, 4 copains tirés par pilotSeed, espacés de 1,5 × CAR_LENGTH = 3,3 m', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    expect(GRID_GAP).toBeCloseTo(3.3, 9);
    expect(sim.pilotSeed).toBe((TRACK.seed ^ 0x9e3779b9) >>> 0);
    expect(sim.cars.map((c) => c.pilot)).toEqual([GALAHAD, ...drawPilots(sim.pilotSeed)]);
    sim.cars.forEach((car, i) => {
      const { pilot } = car;
      const x = TRACK.xStart - 2 - i * GRID_GAP;
      expect(car.body.id).toBe(pilot.id);
      expect(car.body.index).toBe(i);
      expect(car.state.id).toBe(pilot.id);
      expect(car.state.name).toBe(pilot.name);
      expect(car.state.color).toBe(hex(pilot.color));
      expect(car.state.accent).toBe(hex(pilot.accent));
      expect(car.state.safePoint).toEqual({ x, y: heightAt(TRACK, x), angle: 0 });
      expect(chassisX(car)).toBeCloseTo(x, 6);
      expect(car.factor).toBe(1);
      expect(car.driver === null).toBe(i === 0);
      const view = carView(sim, i);
      expect(view.name).toBe(pilot.name);
      expect(view.helmet).toBe(hex(pilot.helmet));
      if (i > 0) expect(chassisX(sim.cars[i - 1]) - chassisX(car)).toBeCloseTo(GRID_GAP, 6);
    });
    // Le dernier robot reste sur le plat de départ.
    expect(chassisX(sim.cars[4]) - CONFIG.CAR_LENGTH / 2).toBeGreaterThan(0);
  });

  test('pilotSeed imposé : le tirage suit drawPilots(pilotSeed)', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true, pilotSeed: 7 });
    expect(sim.pilotSeed).toBe(7);
    expect(sim.cars.slice(1).map((c) => c.pilot)).toEqual(drawPilots(7));
  });

  test('aucune paire active entre deux voitures au pas 0', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    stepRace(sim, false);
    const carOf = (b: Matter.Body): string | undefined => (b.parent.plugin as { carId?: string } | undefined)?.carId;
    const between = sim.world.engine.pairs.list.filter((p: Matter.Pair) => {
      const a = carOf(p.bodyA);
      const b = carOf(p.bodyB);
      return p.isActive && a !== undefined && b !== undefined && a !== b;
    });
    expect(between).toEqual([]);
    for (const car of sim.cars) {
      expect(car.invulnerable).toBe(false);
      for (const p of car.body.parts) expect((p.collisionFilter.mask ?? 0) & CAT.CAR).toBe(CAT.CAR);
    }
  });

  test('délai de départ : le robot de rang n ne pose le doigt qu’à partir de n × START_DELAY_PER_RANK', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    for (let n = 1; n <= 4; n++) {
      const { driver, state, body } = sim.cars[n];
      const ctx = (t: number) => ({ t, state, track: TRACK, speed: Matter.Vector.magnitude(body.chassis.velocity) });
      const start = n * CONFIG.START_DELAY_PER_RANK;
      expect(driver!(ctx(start - DT / 2)), `rang ${n}`).toBe(false);
      expect(driver!(ctx(start + DT / 2)), `rang ${n}`).toBe(true);
    }
  });

  test('même graine → même course (5 voitures, doigt posé 6 s)', () => {
    const run = (): number[][] => {
      const sim = createRaceSim(TRACK, CONFIG, { robots: true });
      const xs: number[][] = [];
      for (let i = 0; i < Math.round(6 / DT); i++) {
        stepRace(sim, true);
        if (i % 60 === 59) xs.push(sim.cars.map((c) => c.state.progress));
      }
      return xs;
    };
    const a = run();
    expect(a[a.length - 1][0]).toBeGreaterThan(TRACK.xStart + 20);
    // Les robots sont partis aussi.
    for (let i = 1; i < 5; i++) expect(a[a.length - 1][i], `rang ${i}`).toBeGreaterThan(TRACK.xStart + 5);
    expect(run()).toEqual(a);
  });

  test('sceneOf : les 5 voitures, Galahad dessiné en dernier (au-dessus des copains)', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    const names = sceneOf(sim).cars.map((c) => c.name);
    expect(names).toHaveLength(5);
    expect(names[names.length - 1]).toBe('Galahad');
    expect([...names].sort()).toEqual(sim.cars.map((c) => c.state.name).sort());
  });

  test('rebuildCars : voitures neuves à leur point sûr (décalées si occupé), invulnérables, la course repart', () => {
    const sim: RaceSim = createRaceSim(TRACK, CONFIG, { robots: true });
    for (let i = 0; i < 30; i++) stepRace(sim, true);
    // Même point sûr pour les 5 : le respawn groupé les remet en file.
    const xSafe = TRACK.xStart + 40;
    for (const car of sim.cars) car.state.safePoint = { x: xSafe, y: heightAt(TRACK, xSafe), angle: 0 };
    const old = sim.cars.map((c) => c.body);
    rebuildCars(sim);
    const xs = sim.cars.map(chassisX);
    sim.cars.forEach((car, i) => {
      expect(car.body).not.toBe(old[i]);
      expect(car.body.id).toBe(old[i].id);
      expect(car.body.index).toBe(i);
      expect(Matter.Composite.allBodies(sim.world.engine.world)).not.toContain(old[i].chassis);
      expect(car.invulnerable).toBe(true);
      expect(car.state.progress).toBeCloseTo(xs[i], 9);
    });
    const sorted = [...xs].sort((a, b) => b - a);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1] - sorted[i]).toBeGreaterThanOrEqual(GRID_GAP - 1e-6);
    expect(Math.max(...xs)).toBeCloseTo(xSafe, 6);
    for (let i = 0; i < 60; i++) stepRace(sim, true);
    expect(sim.cars.every((c) => c.state.progress > xSafe - 6 * GRID_GAP)).toBe(true);
  });
});
