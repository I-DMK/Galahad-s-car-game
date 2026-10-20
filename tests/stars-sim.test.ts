// Étoiles et turbo dans le pas de course (tâche 12) : seed 1, 1680 m, doigt toujours posé.
import { CONFIG } from '../src/config';
import { isStarActive } from '../src/cars/stars';
import { createRaceSim, sceneOf, simulateRace, stepRace, carView, type SimEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';

type StarEvent = Extract<SimEvent, { type: 'star' }>;

const TRACK = generateTrack(1, 1680, CONFIG);
const MAX_SECONDS = 240;

test('course complète : étoiles prises tôt, turbo au-delà de V_MAX, arrivée sans aucune réapparition', () => {
  const r = simulateRace(TRACK, { throttle: () => true, maxSeconds: MAX_SECONDS, cfg: CONFIG });
  const stars = r.starsTaken as StarEvent[];
  const summary = `stars=${stars.length} first=${stars[0]?.t.toFixed(2)} maxSpeed=${r.maxSpeed.toFixed(2)} finishedAt=${r.finishedAt?.toFixed(2)} respawns=${r.respawns.length}`;
  expect(stars.length, summary).toBeGreaterThanOrEqual(1);
  expect(stars[0].t, summary).toBeLessThan(60);
  expect(r.maxSpeed, summary).toBeGreaterThan(1.2 * CONFIG.V_MAX);
  expect(r.finishedAt, summary).not.toBeNull();
  expect(r.respawns, summary).toEqual([]);
});

test('la première étoile prise : turbo et flammes, inactive STAR_RESPAWN_SECONDS puis de nouveau active', () => {
  const sim = createRaceSim(TRACK, CONFIG);
  expect(sim.stars.length).toBe(TRACK.stars.length);
  expect(sim.starBodies.length).toBe(TRACK.stars.length);
  expect(sceneOf(sim).stars.every((s) => s.active)).toBe(true);
  let taken: StarEvent | undefined;
  for (let i = 0; i < Math.ceil(60 / CONFIG.PHYSICS_DT) && !taken; i++) {
    stepRace(sim, true);
    taken = sim.events.find((e): e is StarEvent => e.type === 'star');
  }
  expect(taken).toBeDefined();
  const { t, id } = taken!;
  const idx = sim.stars.findIndex((s) => s.id === id);
  expect(sim.stars[idx].takenAt).toBe(t);
  expect(sim.state.turboUntil).toBeCloseTo(t + CONFIG.TURBO_SECONDS, 9);
  expect(carView(sim).turbo).toBe(true);
  expect(sceneOf(sim).stars[idx].active).toBe(false);
  expect(sim.starBodies[idx].collisionFilter.mask).toBe(0);

  while (sim.time < t + 4.9) stepRace(sim, true);
  expect(isStarActive(sim.stars[idx], sim.time, CONFIG)).toBe(false);
  expect(sceneOf(sim).stars[idx].active).toBe(false);
  expect(carView(sim).turbo).toBe(false);
  while (sim.time < t + 5.1) stepRace(sim, true);
  expect(isStarActive(sim.stars[idx], sim.time, CONFIG)).toBe(true);
  expect(sceneOf(sim).stars[idx].active).toBe(true);
  expect(sim.starBodies[idx].collisionFilter.mask).not.toBe(0);
  // Elle n'a été prise qu'une fois : la voiture est loin devant quand elle réapparaît.
  expect(sim.stars[idx].takenAt).toBe(t);
});
