import { CONFIG } from '../src/config';
import { createRaceSim, simulateRace } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';

const TRACK = generateTrack(1, 1680, CONFIG);
const DT = CONFIG.PHYSICS_DT;

test('createRaceSim : Galahad posé 2 m avant la ligne de départ, point sûr au sol', () => {
  const sim = createRaceSim(TRACK, CONFIG);
  const x0 = TRACK.xStart - 2;
  expect(sim.car.id).toBe('galahad');
  expect(sim.state.name).toBe('Galahad');
  expect(sim.state.color).toBe('#1e5cff');
  expect(sim.state.accent).toBe('#e2231a');
  expect(sim.state.safePoint).toEqual({ x: x0, y: heightAt(TRACK, x0), angle: 0 });
  expect(sim.state.progress).toBeCloseTo(x0, 6);
  expect(sim.time).toBe(0);
});

test('doigt posé 5 s : la voiture avance de plus de 20 m', () => {
  const r = simulateRace(TRACK, { throttle: () => true, maxSeconds: 5, cfg: CONFIG });
  expect(Math.abs(r.time - 5)).toBeLessThanOrEqual(DT + 1e-9);
  expect(r.progressAt(5) - r.progressAt(0)).toBeGreaterThan(20);
  expect(r.maxSpeed).toBeGreaterThan(5);
  expect(r.respawns).toEqual([]);
  expect(r.finishedAt).toBeNull();
});

test('doigt levé 5 s : la voiture reste sur place (< 0,5 m)', () => {
  const r = simulateRace(TRACK, { throttle: () => false, maxSeconds: 5, cfg: CONFIG });
  expect(Math.abs(r.time - 5)).toBeLessThanOrEqual(DT + 1e-9);
  expect(Math.abs(r.progressAt(5) - r.progressAt(0))).toBeLessThan(0.5);
});
