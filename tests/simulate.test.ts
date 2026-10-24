// Pas de course (tâche 5b) : non-régression du plan A (Galahad seul, défaut `robots: false`), grille
// de départ à 5 voitures (`robots: true`), délai de départ, déterminisme, étoiles par voiture (tâche 5d),
// garde-fou `rebuildCars`.
import Matter from 'matter-js';
import { GALAHAD, drawPilots } from '../src/cars/pilots';
import { isStarActiveFor } from '../src/cars/stars';
import { CONFIG } from '../src/config';
import { placeCar } from '../src/physics/car';
import { CAT, carCategory } from '../src/physics/world';
import { makeRobotDriver } from '../src/ai/driver';
import { carPairsTouching, simulateRace } from '../src/sim/harness';
import {
  carView, chassisX, createRaceSim, driverContext, rankEntriesOf, rebuildCars, sceneOf, stepRace, type RaceSim, type SimEvent,
} from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { AP } from './helpers/anciennes-pistes';
import type { Track } from '../src/track/types';
import { heightAt, slopeAt } from '../src/track/query';

const TRACK = generateTrack(1, 1680, CONFIG);
/** Graine 1 sur les pistes d'avant (tâche 5e) : `PLAN_A_TRACE` y reste comparable au plan A. */
const AP_TRACK = generateTrack(1, 1680, AP);
const DT = CONFIG.PHYSICS_DT;
/** Espacement de la grille entre deux centres de châssis (m) : 1,5 × CAR_LENGTH = 3,3. */
const GRID_GAP = CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH;

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
    // Élastique (tâche 7) : jamais sur Galahad ; facteurs appliqués à 1 avant le premier pas.
    expect(g.rubber).toBeNull();
    expect([g.speedFactor, g.torqueFactor, g.onScreen]).toEqual([1, 1, false]);
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
    const r = simulateRace(AP_TRACK, { throttle: () => true, maxSeconds: 20, cfg: AP }); // défaut : Galahad seul, pistes d'avant
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
      // Élastique (tâche 7) : 1 à la création pour un copain, coupé (null) pour Galahad.
      expect(car.rubber).toBe(i === 0 ? null : 1);
      expect([car.speedFactor, car.torqueFactor, car.onScreen]).toEqual([1, 1, false]);
      expect(car.driver === null).toBe(i === 0);
      const view = carView(sim, i);
      expect(view.id).toBe(pilot.id);
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
    expect(carPairsTouching(sim)).toEqual([]);
    for (const car of sim.cars) {
      expect(car.invulnerable).toBe(false);
      for (const p of car.body.parts) expect((p.collisionFilter.mask ?? 0) & CAT.ALL_CARS).toBe(CAT.ALL_CARS);
    }
  });

  test('délai de départ : le robot de rang n ne pose le doigt qu’à partir de n × START_DELAY_PER_RANK (route libre devant lui)', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    for (let n = 1; n <= 4; n++) {
      const { driver } = sim.cars[n];
      // Contexte réel de la grille (`driverContext`), sans les autres voitures : la politesse n'entre pas en jeu.
      const ctx = (t: number) => ({ ...driverContext(sim, n), t, others: [] });
      const start = n * CONFIG.START_DELAY_PER_RANK;
      expect(driver!(ctx(start - DT / 2)), `rang ${n}`).toEqual({ throttle: false, jump: false });
      expect(driver!(ctx(start + DT / 2)), `rang ${n}`).toEqual({ throttle: true, jump: false });
    }
  });

  test('drivers des copains : `makeRobotDriver(pilote, rang, piste, pilotSeed)`, mêmes réponses qu’un driver neuf sur 20 s de course', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    const diffs: string[] = [];
    let calls = 0;
    sim.cars.forEach((car, n) => {
      if (n === 0) return;
      // Le jumeau reçoit le contexte que `stepRace` passe au vrai driver, une fois par pas, comme lui.
      const real = car.driver!;
      const twin = makeRobotDriver(car.pilot, n, TRACK, sim.pilotSeed, CONFIG);
      car.driver = (ctx) => {
        const got = real(ctx);
        const want = twin(ctx);
        calls++;
        if (want.throttle !== got.throttle || want.jump !== got.jump) diffs.push(`rang ${n} à t = ${ctx.t.toFixed(3)}`);
        return got;
      };
    });
    for (let i = 0; i < Math.round(20 / DT); i++) stepRace(sim, true);
    expect(calls).toBe(4 * Math.round(20 / DT));
    expect(diffs).toEqual([]);
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

test('une étoile prise par une voiture reste active pour les autres, inactive pour elle seule : au même pas et au pas suivant', () => {
  const sim = createRaceSim(TRACK, CONFIG, { robots: true });
  for (const robot of sim.cars.slice(1)) robot.driver = () => ({ throttle: false, jump: false });
  // Première étoile basse (les étoiles hautes de la tâche 5e sont hors de portée d'une voiture au sol) ; repérée par
  // `high` et son rang dans `track.stars`, qui est aussi celui de `sim.stars` et `sim.starBodies`.
  const k = TRACK.stars.findIndex((s) => !s.high);
  const star = TRACK.stars[k];
  const [a, b] = sim.cars;
  // Les deux châssis recouvrent le capteur de l'étoile (rayon 0,5 m), l'un devant, l'autre derrière, sans se toucher.
  for (const [car, dx] of [[a, 1.25], [b, -1.25]] as const) {
    placeCar(car.body, star.x + dx, (x) => heightAt(TRACK, x), slopeAt(TRACK, star.x + dx), CONFIG);
  }
  const taken: SimEvent[] = [];
  for (let i = 0; i < 2; i++) {
    stepRace(sim, false);
    taken.push(...sim.events.filter((e) => e.type === 'star'));
  }
  // Au même pas, chacune la prend pour elle (ordre des index) ; au pas suivant, ni l'une ni l'autre.
  expect(taken).toEqual([
    { type: 'star', carId: a.state.id, t: 0, id: star.id },
    { type: 'star', carId: b.state.id, t: 0, id: star.id },
  ]);
  expect(a.state.turboUntil).toBeCloseTo(CONFIG.TURBO_SECONDS, 9);
  expect(b.state.turboUntil).toBeCloseTo(CONFIG.TURBO_SECONDS, 9);
  expect([0, 1, 2, 3, 4].map((c) => isStarActiveFor(sim.stars[k], c, sim.time, CONFIG))).toEqual([false, false, true, true, true]);
  // Le capteur ne détecte plus que les trois autres voitures.
  expect(sim.starBodies[k].collisionFilter.mask).toBe(carCategory(2) | carCategory(3) | carCategory(4));
  // L'écran montre l'état vu par Galahad (a = cars[0]), qui l'a prise.
  expect(sceneOf(sim).stars[k].active).toBe(false);
});

describe('rebuildCars (garde-fou après une exception de stepRace)', () => {
  /** Course à 5 voitures, doigt posé, jusqu'à t (s). */
  const raceUntil = (track: Track, t: number): RaceSim => {
    const sim = createRaceSim(track, CONFIG, { robots: true });
    while (sim.time < t - 1e-9) stepRace(sim, true);
    return sim;
  };

  test('à t = 0,2 s : chaque voiture reste sur sa case de la grille (les anciennes positions ne comptent pas)', () => {
    const sim = raceUntil(TRACK, 0.2);
    rebuildCars(sim);
    sim.cars.forEach((car, i) => {
      expect(chassisX(car), car.state.id).toBeCloseTo(TRACK.xStart - 2 - i * GRID_GAP, 1);
    });
  });

  test('à mi-course : état remis comme après un respawn, aucun respawn « stuck » dans les 3 s', () => {
    const sim = raceUntil(TRACK, 40);
    rebuildCars(sim);
    for (const car of sim.cars) {
      const x = chassisX(car);
      expect(car.state.safePoint.x, car.state.id).toBeCloseTo(x, 6);
      expect(car.state.stuckRefProgress, car.state.id).toBeCloseTo(x, 6);
      expect([car.state.stuckSince, car.state.flippedSince, car.state.sideSince], car.state.id).toEqual([null, null, null]);
      expect(car.invulnerable, car.state.id).toBe(true);
    }
    const respawns: string[] = [];
    while (sim.time < 43) {
      stepRace(sim, true);
      for (const e of sim.events) if (e.type === 'respawn') respawns.push(`${e.carId} ${e.reason} @${e.t.toFixed(2)}`);
    }
    expect(respawns.filter((r) => r.includes('stuck'))).toEqual([]);
  });

  test('après l’arrivée : la voiture arrivée est reconstruite sur place, au-delà de xFinish', () => {
    const short = generateTrack(1, 300, CONFIG);
    const sim = createRaceSim(short, CONFIG, { robots: true });
    const g = sim.cars[0];
    while (g.state.finishedAt === null && sim.time < 60) stepRace(sim, true);
    const finishedAt = g.state.finishedAt;
    expect(finishedAt).not.toBeNull();
    for (let i = 0; i < 60; i++) stepRace(sim, true);
    const before = chassisX(g);
    expect(before).toBeGreaterThan(short.xFinish);
    rebuildCars(sim);
    expect(chassisX(g)).toBeCloseTo(before, 6);
    expect(g.state.finishedAt).toBe(finishedAt);
    for (let i = 0; i < 120; i++) stepRace(sim, true);
    expect(chassisX(g)).toBeGreaterThan(short.xFinish);
    expect(g.state.finishedAt).toBe(finishedAt);
  });
});

test('rankEntriesOf : une entrée par voiture, rangées par index, avec le x du châssis et l’instant d’arrivée (état de course)', () => {
  const sim = createRaceSim(TRACK, CONFIG, { robots: true });
  sim.cars[2].state.progress = 123.4;
  sim.cars[3].state.finishedAt = 99.5;
  const entries = rankEntriesOf(sim);
  expect(entries.map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
  expect(entries[2]).toEqual({ index: 2, progress: 123.4, finishedAt: null });
  expect(entries[3].finishedAt).toBe(99.5);
  expect(entries[0].progress).toBe(sim.cars[0].state.progress);
  // Une copie : les entrées ne sont pas l'état de la course.
  entries[2].progress = 0;
  expect(sim.cars[2].state.progress).toBe(123.4);
});
