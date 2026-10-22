// Étoiles pour tous (plan B, tâche 5d ; addendum « bouton saut » §2) : l'état d'une étoile est tenu par
// voiture. Une voiture qui la prend la rend inactive pour elle seule pendant STAR_RESPAWN_SECONDS, et son
// turbo démarre ; pour les autres, l'étoile reste prenable. Capteurs : une catégorie de collision par
// voiture, le masque d'un capteur est le OU des voitures pour qui l'étoile est active. L'écran montre
// l'état vu par Galahad : une prise par un copain n'y laisse aucun signe (décision P5).
import { CONFIG } from '../src/config';
import { isStarActiveFor, newStarStates, takeStarFor } from '../src/cars/stars';
import { turboFactor } from '../src/cars/turbo';
import { placeCar } from '../src/physics/car';
import { createStarBodies, syncStarBodies } from '../src/physics/stars';
import { CAT, carCategory, createWorld, sensorsTouching } from '../src/physics/world';
import { GALAHAD_INDEX, createRaceSim, sceneOf, simulateRace, stepRace, type CarSim, type StarEvent } from '../src/sim/simulate';
import { heightAt, slopeAt } from '../src/track/query';
import { trackFor } from './helpers/runs';

const R = CONFIG.STAR_RESPAWN_SECONDS;
const DT = CONFIG.PHYSICS_DT;
const CARS = [0, 1, 2, 3, 4];
const STARS = [{ id: 4, x: 100, y: 1 }, { id: 9, x: 200, y: 2 }];
/** Graine 1, 1 680 m : sa première étoile (x ≈ 443 m) est sur un plat, hors zone fantôme. */
const TRACK = trackFor(1);
const STAR = TRACK.stars[0];

const activeFor = (s: Parameters<typeof isStarActiveFor>[0], t: number): boolean[] => CARS.map((k) => isStarActiveFor(s, k, t, CONFIG));
const place = (car: CarSim, x: number): void => placeCar(car.body, x, (xx) => heightAt(TRACK, xx), slopeAt(TRACK, x), CONFIG);

describe('état par voiture (pur)', () => {
  test('newStarStates : une case par voiture, aucune prise', () => {
    expect(newStarStates(STARS, 5)).toEqual([
      { id: 4, takenAt: [null, null, null, null, null] },
      { id: 9, takenAt: [null, null, null, null, null] },
    ]);
    expect(newStarStates(STARS, 1)).toEqual([{ id: 4, takenAt: [null] }, { id: 9, takenAt: [null] }]);
  });

  test('la voiture 1 prend l’étoile à t = 10 : active pour 0, 2, 3, 4 ; inactive pour 1 jusqu’à 10 + STAR_RESPAWN_SECONDS (borne exclue)', () => {
    const [s] = newStarStates(STARS, 5);
    expect(activeFor(s, 0)).toEqual([true, true, true, true, true]);
    takeStarFor(s, 1, 10);
    expect(s.takenAt).toEqual([null, 10, null, null, null]);
    for (const t of [10, 12, 10 + R - 1e-9]) expect(activeFor(s, t), `t = ${t}`).toEqual([true, false, true, true, true]);
    expect(activeFor(s, 10 + R)).toEqual([true, true, true, true, true]);
  });

  test('deux prises au même t : chaque voiture a son propre délai', () => {
    const [s] = newStarStates(STARS, 5);
    takeStarFor(s, 1, 10);
    takeStarFor(s, 3, 10);
    expect(activeFor(s, 10)).toEqual([true, false, true, false, true]);
    expect(activeFor(s, 10 + R)).toEqual([true, true, true, true, true]);
    // La voiture 1 la reprend dès qu'elle réapparaît pour elle ; la voiture 3 non.
    takeStarFor(s, 1, 10 + R);
    expect(activeFor(s, 10 + R)).toEqual([true, false, true, true, true]);
    expect(activeFor(s, 10 + 2 * R - 1e-9)).toEqual([true, false, true, true, true]);
    expect(activeFor(s, 10 + 2 * R)).toEqual([true, true, true, true, true]);
  });

  test('index de voiture hors de takenAt : RangeError (et non une réponse fausse en silence)', () => {
    const [s] = newStarStates(STARS, 2);
    for (const bad of [2, -1, 0.5]) {
      expect(() => isStarActiveFor(s, bad, 0, CONFIG), `${bad}`).toThrow(RangeError);
      expect(() => takeStarFor(s, bad, 0), `${bad}`).toThrow(RangeError);
    }
    expect(s.takenAt).toEqual([null, null]);
  });
});

describe('capteurs : une catégorie de collision par voiture', () => {
  test('carCategory : 5 bits distincts, disjoints de GROUND et de SENSOR, dont le OU vaut CAT.ALL_CARS ; au-delà, erreur', () => {
    const cats = CARS.map(carCategory);
    expect(new Set(cats).size).toBe(5);
    for (const c of cats) {
      expect(c > 0 && (c & (c - 1)) === 0, `${c} : un seul bit`).toBe(true);
      expect(c & (CAT.GROUND | CAT.SENSOR)).toBe(0);
    }
    expect(cats.reduce((a, c) => a | c, 0)).toBe(CAT.ALL_CARS);
    expect(CAT.ALL_CARS & (CAT.GROUND | CAT.SENSOR)).toBe(0);
    for (const bad of [5, -1, 1.5, Number.NaN]) expect(() => carCategory(bad), `${bad}`).toThrow(RangeError);
  });

  test('syncStarBodies : masque = OU des catégories des voitures pour qui l’étoile est active', () => {
    const world = createWorld(TRACK, CONFIG);
    const bodies = createStarBodies(world, STARS, CONFIG);
    expect(bodies.map((b) => b.collisionFilter.mask)).toEqual([CAT.ALL_CARS, CAT.ALL_CARS]);
    const states = newStarStates(STARS, 5);
    takeStarFor(states[0], 1, 10);
    syncStarBodies(bodies, states, 12, CONFIG);
    expect(bodies[0].collisionFilter.mask).toBe(carCategory(0) | carCategory(2) | carCategory(3) | carCategory(4));
    expect(bodies[1].collisionFilter.mask).toBe(CAT.ALL_CARS);
    syncStarBodies(bodies, states, 10 + R, CONFIG);
    expect(bodies[0].collisionFilter.mask).toBe(CAT.ALL_CARS);
  });

  test('Galahad seul : masque = sa catégorie si l’étoile est active pour lui, 0 sinon (comme avant la 5d)', () => {
    const world = createWorld(TRACK, CONFIG);
    const bodies = createStarBodies(world, STARS, CONFIG);
    const states = newStarStates(STARS, 1);
    takeStarFor(states[1], 0, 10);
    syncStarBodies(bodies, states, 12, CONFIG);
    expect(bodies.map((b) => b.collisionFilter.mask)).toEqual([carCategory(0), 0]);
  });
});

describe('course à 5 voitures, graine 1 : une étoile prise par un copain reste prenable par Galahad', () => {
  test('copain 6 m avant la 1re étoile, Galahad 20 m derrière lui, doigt posé : un « star » du même id chacun, deux turbos', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    const [g, copain, ...others] = sim.cars;
    for (const robot of others) robot.driver = () => false;
    copain.driver = () => true;
    place(copain, STAR.x - 6);
    place(g, STAR.x - 26);
    const taken: StarEvent[] = [];
    const activeAfterCopain: boolean[] = [];
    let turbosAtGalahad: boolean[] = [];
    while (sim.time < 10 && !taken.some((e) => e.carId === g.state.id)) {
      stepRace(sim, true);
      const events = sim.events.filter((e): e is StarEvent => e.type === 'star');
      taken.push(...events);
      const active = sceneOf(sim).stars[0].active;
      if (taken.some((e) => e.carId === g.state.id)) {
        turbosAtGalahad = [g, copain].map((c) => turboFactor(c.state, sim.time, CONFIG) > 1);
        expect(active, 'dessinée inactive dès la prise de Galahad').toBe(false);
      } else if (taken.length > 0) activeAfterCopain.push(active);
    }
    const summary = taken.map((e) => `${e.carId} id ${e.id} t ${e.t.toFixed(3)}`).join(' ; ');
    expect(taken.map((e) => [e.carId, e.id]), summary).toEqual([[copain.state.id, STAR.id], [g.state.id, STAR.id]]);
    expect(activeAfterCopain.length, summary).toBeGreaterThan(30);
    expect(activeAfterCopain.every(Boolean), 'visible pour Galahad après la prise du copain').toBe(true);
    expect(turbosAtGalahad, summary).toEqual([true, true]);
    expect(copain.state.turboUntil).toBeCloseTo(taken[0].t + CONFIG.TURBO_SECONDS, 9);
    expect(g.state.turboUntil).toBeCloseTo(taken[1].t + CONFIG.TURBO_SECONDS, 9);
  });

  // Reprise 1 à 2 pas après la prise précédente + STAR_RESPAWN_SECONDS, et non ± 1 pas : les capteurs sont
  // alignés en fin de pas sur le temps du pas (1 pas de latence, comme avant la tâche 5d), et le cumul de
  // `sim.time` peut lire 4,99999… au pas de la réapparition (1 pas de plus). Mesuré : 0 ; 5,0333 ; 10,0500.
  // Filtre par voiture : tant que l'étoile était inactive pour le copain au pas précédent (masque aligné à
  // la fin de ce pas), aucun capteur d'étoile ne touche ses pièces, alors qu'elle reste active pour Galahad.
  test('réapparition par voiture : un copain garé dans le capteur, doigt levé, reprend l’étoile à chaque réapparition, 1 à 2 pas après la prise précédente + R, jamais entre', () => {
    const sim = createRaceSim(TRACK, CONFIG, { robots: true });
    for (const robot of sim.cars.slice(1)) robot.driver = () => false;
    const copain = sim.cars[1];
    place(copain, STAR.x);
    const taken: StarEvent[] = [];
    let blind = 0;
    while (sim.time < 2 * R + 2) {
      const inactiveBefore = sim.time > 0 && !isStarActiveFor(sim.stars[0], 1, sim.time - DT, CONFIG);
      stepRace(sim, false);
      taken.push(...sim.events.filter((e): e is StarEvent => e.type === 'star'));
      if (inactiveBefore) {
        blind++;
        expect(sensorsTouching(sim.world.engine, copain.body.parts).filter((b) => b.label === 'star'), `t = ${sim.time}`).toEqual([]);
      }
      // Galahad ne l'a jamais prise : elle reste dessinée.
      expect(sceneOf(sim).stars[0].active).toBe(true);
    }
    expect(blind, 'pas contrôlés avec l’étoile inactive pour le copain').toBeGreaterThan(500);
    const summary = taken.map((e) => `${e.carId} t ${e.t.toFixed(4)}`).join(' ; ');
    expect(taken.map((e) => [e.carId, e.id]), summary).toEqual([0, 1, 2].map(() => [copain.state.id, STAR.id]));
    expect(taken[0].t, summary).toBe(0);
    for (let k = 1; k < taken.length; k++) {
      const gap = taken[k].t - taken[k - 1].t;
      expect(gap, summary).toBeGreaterThanOrEqual(R + DT - 1e-9);
      expect(gap, summary).toBeLessThanOrEqual(R + 2 * DT + 1e-9);
    }
  });
});

test('simulateRace : starsByCar (toutes les voitures) et firstStar (premier « star » de la course), cohérents avec starsTaken', () => {
  const seen: StarEvent[] = [];
  const r = simulateRace(TRACK, {
    throttle: () => true, maxSeconds: 45, cfg: CONFIG, robots: true,
    onStep: (sim) => seen.push(...sim.events.filter((e): e is StarEvent => e.type === 'star')),
  });
  const ids = Object.keys(r.respawnsByCar);
  expect(Object.keys(r.starsByCar)).toEqual(ids);
  for (const id of ids) expect(r.starsByCar[id], id).toEqual(seen.filter((e) => e.carId === id));
  expect(r.starsTaken).toEqual(r.starsByCar.galahad);
  expect(r.starsTaken, 'copie distincte').not.toBe(r.starsByCar.galahad);
  expect(seen.length, 'au moins une étoile prise en 45 s').toBeGreaterThan(0);
  expect(r.firstStar).toEqual({ carId: seen[0].carId, t: seen[0].t });
  expect(r.firstStarCars).toEqual([...new Set(seen.filter((e) => e.t === seen[0].t).map((e) => e.carId))]);
});

test('simulateRace : firstStar null sans étoile prise', () => {
  const r = simulateRace(TRACK, { throttle: () => false, maxSeconds: 1, cfg: CONFIG });
  expect(r.starsByCar).toEqual({ galahad: [] });
  expect(r.firstStar).toBeNull();
  expect(r.firstStarCars).toEqual([]);
});

test('simulateRace : deux voitures prennent la première étoile au même pas, firstStarCars les nomme toutes deux', () => {
  // Après le premier pas, Galahad et le copain de rang 1 (pas encore partis) sont posés de part et d'autre de
  // la 1re étoile, châssis sur le capteur (comme tests/simulate.test.ts) : ils la prennent au pas suivant.
  let copain = '';
  const r = simulateRace(TRACK, {
    throttle: () => false, maxSeconds: 0.1, cfg: CONFIG, robots: true,
    onStep: (sim) => {
      if (copain !== '') return;
      copain = sim.cars[1].state.id;
      place(sim.cars[GALAHAD_INDEX], STAR.x + 1.25);
      place(sim.cars[1], STAR.x - 1.25);
    },
  });
  expect(r.firstStar).toEqual({ carId: 'galahad', t: DT });
  expect(r.firstStarCars).toEqual(['galahad', copain]);
});
