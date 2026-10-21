// Réapparitions branchées dans le pas de course (tâche 10b) : simulations complètes et scénarios ciblés.
import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import { placeCar } from '../src/physics/car';
import { physToWorld, worldToPhys } from '../src/physics/units';
import { CAT } from '../src/physics/world';
import { createRaceSim, simulateRace, stepRace, type RaceSim, type SimEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt, nearestVolcanoZone, slopeAt, volcanoAhead } from '../src/track/query';
import type { Track, Volcano } from '../src/track/types';

type RespawnEvent = Extract<SimEvent, { type: 'respawn' }>;

const SEEDS = [0, 1, 2, 3, 4];
const TRACK_LENGTH = 1680;
const DT = CONFIG.PHYSICS_DT;

const tracks = new Map<number, Track>();
function trackFor(seed: number): Track {
  let t = tracks.get(seed);
  if (!t) {
    t = generateTrack(seed, TRACK_LENGTH, CONFIG);
    tracks.set(seed, t);
  }
  return t;
}

/** Première piste (seed 1, 2, …) ayant un volcan, et ce volcan. */
function firstVolcano(): { track: Track; v: Volcano } {
  for (const seed of [1, 0, 2, 3, 4, 5, 6, 7]) {
    const track = trackFor(seed);
    if (track.volcanoes.length > 0) return { track, v: track.volcanoes[0] };
  }
  throw new Error('aucune piste avec volcan');
}

/** Pas de course jusqu'au premier événement 'respawn' (au plus maxSteps pas). */
function stepUntilRespawn(sim: RaceSim, throttle: boolean, maxSteps: number): RespawnEvent | undefined {
  for (let i = 0; i < maxSteps; i++) {
    stepRace(sim, throttle);
    const e = sim.events.find((ev): ev is RespawnEvent => ev.type === 'respawn');
    if (e) return e;
  }
  return undefined;
}

const h = (track: Track) => (x: number) => heightAt(track, x);
const chassisX = (sim: RaceSim) => physToWorld(sim.car.chassis.position).x;
const describeRespawns = (rs: SimEvent[]) =>
  rs.map((e) => (e.type === 'respawn' ? `${e.reason}@t=${e.t.toFixed(2)} x=${e.x.toFixed(1)}→${e.target.x.toFixed(1)}` : e.type));

describe('doigt toujours posé', () => {
  test.each(SEEDS)('seed %i : aucune réapparition, jamais bloqué, ligne d’arrivée atteinte', (seed) => {
    const track = trackFor(seed);
    const r = simulateRace(track, { throttle: () => true, maxSeconds: 240, cfg: CONFIG });
    expect(describeRespawns(r.respawns)).toEqual([]);
    expect(r.respawns.length).toBe(0);
    expect(r.maxStuckSeconds).toBeLessThanOrEqual(2.1);
    expect(r.progressAt(240)).toBeGreaterThanOrEqual(track.xFinish);
  });
});

/** Seeds des scénarios ciblés : le premier seed de 0..4 ayant un volcan, et le seed 1. */
const VOLCANO_SEEDS = [...new Set([SEEDS.find((s) => trackFor(s).volcanoes.length > 0)!, 1])];

describe.each(VOLCANO_SEEDS)('seed %i, premier volcan, voiture à l’arrêt puis doigt posé', (seed) => {
  const track = trackFor(seed);
  const v = track.volcanoes[0];

  test('flanc amont (rebord − 0,8 m, 27°) : réapparition (lave ou bloqué) en ≤ 2,1 s, ramenée avant la lave', () => {
    const x = v.xLava - v.lavaWidth / 2 - 0.8;
    expect(x).toBeGreaterThan(v.xLip + v.lipY / Math.tan(CONFIG.MAX_SLOPE) + 0.5);
    expect(slopeAt(track, x)).toBeCloseTo(CONFIG.MAX_SLOPE, 6);
    const sim = createRaceSim(track, CONFIG);
    placeCar(sim.car, x, h(track), slopeAt(track, x), CONFIG);
    const t0 = sim.time;
    const e = stepUntilRespawn(sim, true, Math.ceil(3 / DT));
    expect(e).toBeDefined();
    expect(['lava', 'stuck']).toContain(e!.reason);
    expect(e!.t - t0).toBeLessThanOrEqual(2.1);
    expect(sim.state.progress).toBeLessThan(v.xLava);
    expect(chassisX(sim)).toBeCloseTo(e!.target.x, 6);
  });

  test('rampe depuis la vallée : chute dans la lave en ≤ 10 s, jamais jusqu’à la réception', () => {
    const x = v.xLip + v.lipY / Math.tan(CONFIG.MAX_SLOPE) + 0.5;
    expect(slopeAt(track, x)).toBeCloseTo(0, 6);
    const sim = createRaceSim(track, CONFIG);
    placeCar(sim.car, x, h(track), 0, CONFIG);
    const t0 = sim.time;
    let maxX = -Infinity;
    let e: RespawnEvent | undefined;
    for (let i = 0; i < Math.ceil(10 / DT) && !e; i++) {
      stepRace(sim, true);
      e = sim.events.find((ev): ev is RespawnEvent => ev.type === 'respawn');
      if (!e) maxX = Math.max(maxX, chassisX(sim));
    }
    expect(e, `maxX=${maxX.toFixed(2)} xReception=${v.xReception.toFixed(2)}`).toBeDefined();
    expect(e!.reason).toBe('lava');
    expect(e!.t - t0).toBeLessThanOrEqual(10);
    expect(maxX).toBeLessThan(v.xReception);
  });
});

test('deux chutes de suite dans la lave sans nouveau point sûr : la 2e cible passe le volcan (xEnd − 10)', () => {
  const { track, v } = firstVolcano();
  const sim = createRaceSim(track, CONFIG);
  const xSafe = v.xLancement + 1;
  sim.state.safePoint = { x: xSafe, y: heightAt(track, xSafe), angle: 0 };

  placeCar(sim.car, v.xLava, h(track), 0, CONFIG);
  const first = stepUntilRespawn(sim, true, 5);
  expect(first).toBeDefined();
  expect(first!.reason).toBe('lava');
  expect(first!.target.x).toBeCloseTo(xSafe, 6);
  expect(chassisX(sim)).toBeCloseTo(xSafe, 6);

  // Pas de nouveau point sûr entre les deux : on replonge aussitôt.
  placeCar(sim.car, v.xLava, h(track), 0, CONFIG);
  const second = stepUntilRespawn(sim, true, 5);
  expect(second).toBeDefined();
  expect(second!.reason).toBe('lava');
  const xBack = v.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK;
  expect(xBack).toBeGreaterThanOrEqual(v.xReception + 10);
  expect(second!.target.x).toBeCloseTo(xBack, 6);
  expect(chassisX(sim)).toBeCloseTo(xBack, 6);
  expect(sim.state.safePoint.x).toBeCloseTo(xBack, 6);
});

describe('voiture retournée (inElanZone calculé par le pas de course)', () => {
  /**
   * Voiture posée à l'envers (châssis à 180°, roues en l'air) en x, vitesses nulles. Pose
   * volontairement grossière : seule l'orientation du châssis compte (les roues retombent ensuite).
   */
  function placeFlipped(sim: RaceSim, x: number): void {
    placeCar(sim.car, x, h(track0), 0, CONFIG);
    const ground = heightAt(track0, x);
    const lift = CONFIG.CAR_HEIGHT + 2 * CONFIG.WHEEL_RADIUS;
    Matter.Body.setPosition(sim.car.chassis, worldToPhys({ x, y: ground + CONFIG.CAR_HEIGHT / 2 + 0.05 }));
    Matter.Body.setAngle(sim.car.chassis, Math.PI);
    sim.car.wheels.forEach((w) => {
      const p = physToWorld(w.position);
      Matter.Body.setPosition(w, worldToPhys({ x: p.x, y: ground + lift }));
    });
    for (const p of sim.car.parts) { Matter.Body.setVelocity(p, { x: 0, y: 0 }); Matter.Body.setAngularVelocity(p, 0); }
  }
  const { track: track0, v: v0 } = firstVolcano();

  test.each([
    ['plat d’élan', (v: Volcano) => v.xElanStart + 1],
    ['rampe', (v: Volcano) => (v.xRampStart + v.xLip) / 2],
  ])('%s : flipped au premier pas', (_name, xOf) => {
    const sim = createRaceSim(track0, CONFIG);
    placeFlipped(sim, xOf(v0));
    stepRace(sim, false);
    const e = sim.events.find((ev): ev is RespawnEvent => ev.type === 'respawn');
    expect(e).toBeDefined();
    expect(e!.reason).toBe('flipped');
  });

  test.each([
    ['plat de lancement', (v: Volcano) => v.xLancement + 2],
    ['vallée (fond, pente nulle)', (v: Volcano) => v.xLip + v.lipY / Math.tan(CONFIG.MAX_SLOPE) + 0.5],
    ['hors volcan (plat de départ)', (_v: Volcano) => track0.xStart - 1],
  ])('%s : réapparition seulement après ≥ FLIP_SECONDS, raison flipped ou side (délais inchangés)', (_name, xOf) => {
    // La pose à l'envers ne tient pas > FLIP_ANGLE une seconde (les roues retombent) : en pratique
    // 'side' à ≈ 2 s ; seule l'absence de réapparition immédiate est asservie ici.
    const sim = createRaceSim(track0, CONFIG);
    placeFlipped(sim, xOf(v0));
    const t0 = sim.time;
    const e = stepUntilRespawn(sim, false, Math.ceil(3 / DT));
    expect(e).toBeDefined();
    expect(['flipped', 'side']).toContain(e!.reason);
    // Les chronomètres sont stricts (>) : ≥ reste vrai.
    expect(e!.t - t0).toBeGreaterThanOrEqual(e!.reason === 'side' ? CONFIG.SIDE_SECONDS : CONFIG.FLIP_SECONDS);
  });
});

test('motif 0,7 s posé / 0,3 s levé, seed 1 : au plus 2 réapparitions par volcan, jamais bloqué, arrivée atteinte', () => {
  const track = trackFor(1);
  const r = simulateRace(track, { throttle: (t) => t % 1 < 0.7, maxSeconds: 300, cfg: CONFIG });
  const perVolcano = new Map<string, number>();
  for (const e of r.respawns) {
    if (e.type !== 'respawn') continue;
    const v = nearestVolcanoZone(track, e.x) ?? volcanoAhead(track, e.x);
    const key = v ? v.xLava.toFixed(1) : 'none';
    perVolcano.set(key, (perVolcano.get(key) ?? 0) + 1);
  }
  const summary = { volcanoes: track.volcanoes.length, respawns: describeRespawns(r.respawns), perVolcano: [...perVolcano] };
  expect(r.respawns.length, JSON.stringify(summary)).toBeLessThanOrEqual(2 * track.volcanoes.length + 2);
  for (const [key, n] of perVolcano) expect(n, `${key} ${JSON.stringify(summary)}`).toBeLessThanOrEqual(2);
  expect(r.maxStuckSeconds).toBeLessThanOrEqual(2.1);
  expect(r.progressAt(300)).toBeGreaterThanOrEqual(track.xFinish);
});

describe('invulnérabilité après une réapparition', () => {
  const masks = (sim: RaceSim) => sim.car.parts.map((p) => (p.collisionFilter.mask ?? 0) & CAT.CAR);

  test('RESPAWN_INVULN s sans autre voiture : collisions entre voitures coupées puis rétablies', () => {
    const { track, v } = firstVolcano();
    const sim = createRaceSim(track, CONFIG);
    placeCar(sim.car, v.xLava, h(track), 0, CONFIG);
    const e = stepUntilRespawn(sim, false, 5);
    expect(e).toBeDefined();
    expect(sim.state.invulnerableUntil).toBe(e!.t + CONFIG.RESPAWN_INVULN);
    expect(sim.invulnerable).toBe(true);
    expect(masks(sim)).toEqual([0, 0, 0]);
    while (sim.time < sim.state.invulnerableUntil - 2 * DT) stepRace(sim, false);
    expect(masks(sim)).toEqual([0, 0, 0]);
    for (let i = 0; i < 3; i++) stepRace(sim, false);
    expect(sim.invulnerable).toBe(false);
    expect(masks(sim)).toEqual([CAT.CAR, CAT.CAR, CAT.CAR]);
  });

  test('autre châssis superposé : invulnérable jusqu’à invulnerableUntil + (RESPAWN_INVULN_MAX − RESPAWN_INVULN)', () => {
    const { track, v } = firstVolcano();
    const sim = createRaceSim(track, CONFIG);
    placeCar(sim.car, v.xLava, h(track), 0, CONFIG);
    const e = stepUntilRespawn(sim, false, 5);
    expect(e).toBeDefined();
    // Châssis fantôme (hors monde) posé sur la voiture : il la suit à chaque pas.
    const ghost = Matter.Bodies.rectangle(0, 0, 100, 100);
    sim.others.push(ghost);
    const follow = () => Matter.Body.setPosition(ghost, sim.car.chassis.position);
    follow();
    const release = sim.state.invulnerableUntil + (CONFIG.RESPAWN_INVULN_MAX - CONFIG.RESPAWN_INVULN);
    while (sim.time < release - 2 * DT) { stepRace(sim, false); follow(); }
    expect(sim.time).toBeGreaterThan(sim.state.invulnerableUntil + 1);
    expect(sim.invulnerable).toBe(true);
    expect(masks(sim)).toEqual([0, 0, 0]);
    for (let i = 0; i < 3; i++) { stepRace(sim, false); follow(); }
    expect(sim.invulnerable).toBe(false);
    expect(masks(sim)).toEqual([CAT.CAR, CAT.CAR, CAT.CAR]);
  });
});
