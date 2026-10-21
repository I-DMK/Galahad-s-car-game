// Réapparitions branchées dans le pas de course (tâches 10b du plan A et 3 du plan B) : scénarios
// ciblés rapides (quelques secondes simulées chacun), gardés en CI. Les courses complètes sont
// dans tests/slow/finish.test.ts. Galahad seul (défaut `robots: false` de createRaceSim, plan A),
// sauf le chevauchement par un autre châssis (5 voitures) ; respawn groupé : tests/race-smoke.test.ts.
import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import { placeCar } from '../src/physics/car';
import { physToWorld, worldToPhys } from '../src/physics/units';
import { CAT } from '../src/physics/world';
import { createRaceSim, stepRace, type RaceSim, type SimEvent } from '../src/sim/simulate';
import { heightAt, slopeAt } from '../src/track/query';
import type { Track, Volcano } from '../src/track/types';
import { firstVolcano, trackFor } from './helpers/runs';

type RespawnEvent = Extract<SimEvent, { type: 'respawn' }>;

const SEEDS = [0, 1, 2, 3, 4];
const DT = CONFIG.PHYSICS_DT;

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
const chassisX = (sim: RaceSim) => physToWorld(sim.cars[0].body.chassis.position).x;

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
    placeCar(sim.cars[0].body, x, h(track), slopeAt(track, x), CONFIG);
    const t0 = sim.time;
    const e = stepUntilRespawn(sim, true, Math.ceil(3 / DT));
    expect(e).toBeDefined();
    expect(['lava', 'stuck']).toContain(e!.reason);
    expect(e!.t - t0).toBeLessThanOrEqual(2.1);
    expect(sim.cars[0].state.progress).toBeLessThan(v.xLava);
    expect(chassisX(sim)).toBeCloseTo(e!.target.x, 6);
  });

  test('rampe depuis la vallée : chute dans la lave en ≤ 10 s, jamais jusqu’à la réception', () => {
    const x = v.xLip + v.lipY / Math.tan(CONFIG.MAX_SLOPE) + 0.5;
    expect(slopeAt(track, x)).toBeCloseTo(0, 6);
    const sim = createRaceSim(track, CONFIG);
    placeCar(sim.cars[0].body, x, h(track), 0, CONFIG);
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
  sim.cars[0].state.safePoint = { x: xSafe, y: heightAt(track, xSafe), angle: 0 };

  placeCar(sim.cars[0].body, v.xLava, h(track), 0, CONFIG);
  const first = stepUntilRespawn(sim, true, 5);
  expect(first).toBeDefined();
  expect(first!.reason).toBe('lava');
  expect(first!.target.x).toBeCloseTo(xSafe, 6);
  expect(chassisX(sim)).toBeCloseTo(xSafe, 6);

  // Pas de nouveau point sûr entre les deux : on replonge aussitôt.
  placeCar(sim.cars[0].body, v.xLava, h(track), 0, CONFIG);
  const second = stepUntilRespawn(sim, true, 5);
  expect(second).toBeDefined();
  expect(second!.reason).toBe('lava');
  const xBack = v.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK;
  expect(xBack).toBeGreaterThanOrEqual(v.xReception + 10);
  expect(second!.target.x).toBeCloseTo(xBack, 6);
  expect(chassisX(sim)).toBeCloseTo(xBack, 6);
  expect(sim.cars[0].state.safePoint.x).toBeCloseTo(xBack, 6);
});

describe('voiture retournée (inElanZone calculé par le pas de course)', () => {
  /**
   * Voiture posée à l'envers (châssis à 180°, roues en l'air) en x, vitesses nulles. Pose
   * volontairement grossière : seule l'orientation du châssis compte (les roues retombent ensuite).
   */
  function placeFlipped(sim: RaceSim, x: number): void {
    placeCar(sim.cars[0].body, x, h(track0), 0, CONFIG);
    const ground = heightAt(track0, x);
    const lift = CONFIG.CAR_HEIGHT + 2 * CONFIG.WHEEL_RADIUS;
    Matter.Body.setPosition(sim.cars[0].body.chassis, worldToPhys({ x, y: ground + CONFIG.CAR_HEIGHT / 2 + 0.05 }));
    Matter.Body.setAngle(sim.cars[0].body.chassis, Math.PI);
    sim.cars[0].body.wheels.forEach((w) => {
      const p = physToWorld(w.position);
      Matter.Body.setPosition(w, worldToPhys({ x: p.x, y: ground + lift }));
    });
    for (const p of sim.cars[0].body.parts) { Matter.Body.setVelocity(p, { x: 0, y: 0 }); Matter.Body.setAngularVelocity(p, 0); }
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

  test('deux retournements de suite dans l’élan : chaque fois ramenée au point sûr, jamais à xEnd − 10 (la série ne compte que la lave)', () => {
    const sim = createRaceSim(track0, CONFIG);
    const xSafe = v0.xLancement + 1;
    sim.cars[0].state.safePoint = { x: xSafe, y: heightAt(track0, xSafe), angle: 0 };
    const xBack = v0.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK;
    for (let k = 1; k <= 2; k++) {
      placeFlipped(sim, v0.xElanStart + 1);
      const e = stepUntilRespawn(sim, false, 1);
      expect(e, `retournement ${k}`).toBeDefined();
      expect(e!.reason, `retournement ${k}`).toBe('flipped');
      expect(e!.target.x, `retournement ${k}`).toBeCloseTo(xSafe, 6);
      expect(e!.target.x, `retournement ${k}`).not.toBeCloseTo(xBack, 6);
      expect(chassisX(sim), `retournement ${k}`).toBeCloseTo(xSafe, 6);
      expect(sim.cars[0].state.consecutiveRespawns, `retournement ${k}`).toBe(0);
      expect(sim.cars[0].state.lastRespawnLavaX, `retournement ${k}`).toBeNull();
    }
    // Lave, puis retournement, puis lave : la série est interrompue par le retournement → point sûr.
    placeCar(sim.cars[0].body, v0.xLava, h(track0), 0, CONFIG);
    expect(stepUntilRespawn(sim, true, 5)?.reason).toBe('lava');
    expect(sim.cars[0].state.consecutiveRespawns).toBe(1);
    placeFlipped(sim, v0.xElanStart + 1);
    expect(stepUntilRespawn(sim, false, 1)?.reason).toBe('flipped');
    placeCar(sim.cars[0].body, v0.xLava, h(track0), 0, CONFIG);
    const after = stepUntilRespawn(sim, true, 5);
    expect(after?.reason).toBe('lava');
    expect(after!.target.x).toBeCloseTo(xSafe, 6);
  });
});

describe('invulnérabilité après une réapparition', () => {
  const masks = (sim: RaceSim) => sim.cars[0].body.parts.map((p) => (p.collisionFilter.mask ?? 0) & CAT.CAR);

  test('RESPAWN_INVULN s sans autre voiture : collisions entre voitures coupées puis rétablies', () => {
    const { track, v } = firstVolcano();
    const sim = createRaceSim(track, CONFIG);
    placeCar(sim.cars[0].body, v.xLava, h(track), 0, CONFIG);
    const e = stepUntilRespawn(sim, false, 5);
    expect(e).toBeDefined();
    expect(sim.cars[0].state.invulnerableUntil).toBe(e!.t + CONFIG.RESPAWN_INVULN);
    expect(sim.cars[0].invulnerable).toBe(true);
    expect(masks(sim)).toEqual([0, 0, 0]);
    while (sim.time < sim.cars[0].state.invulnerableUntil - 2 * DT) stepRace(sim, false);
    expect(masks(sim)).toEqual([0, 0, 0]);
    for (let i = 0; i < 3; i++) stepRace(sim, false);
    expect(sim.cars[0].invulnerable).toBe(false);
    expect(masks(sim)).toEqual([CAT.CAR, CAT.CAR, CAT.CAR]);
  });

  test('roue d’une autre voiture dans une roue, châssis séparés : invulnérable jusqu’au plafond (toutes les pièces comptent)', () => {
    const { track, v } = firstVolcano();
    const sim = createRaceSim(track, CONFIG, { robots: true });
    for (const robot of sim.cars.slice(1)) robot.driver = () => false;
    const g = sim.cars[0];
    const xSafe = v.xLancement + 1;
    g.state.safePoint = { x: xSafe, y: heightAt(track, xSafe), angle: 0 };
    placeCar(g.body, v.xLava, h(track), 0, CONFIG);
    const e = stepUntilRespawn(sim, false, 5);
    expect(e?.carId).toBe('galahad');
    expect(e!.target.x).toBeCloseTo(xSafe, 6);
    // Copain reposé à chaque pas 2,35 m derrière Galahad : sa roue avant mord de 5 cm dans la roue arrière
    // de Galahad (0,85 m entre centres < 2 × WHEEL_RADIUS), les châssis restent à 15 cm l'un de l'autre.
    const other = sim.cars[1];
    const follow = () => {
      const x = physToWorld(g.body.chassis.position).x - 2.35;
      placeCar(other.body, x, h(track), slopeAt(track, x), CONFIG);
    };
    follow();
    expect(Matter.Query.collides(g.body.chassis, other.body.parts)).toEqual([]);
    expect(Matter.Query.collides(other.body.chassis, g.body.parts)).toEqual([]);
    expect(Matter.Query.collides(g.body.wheels[0], [other.body.wheels[1]])).not.toEqual([]);
    const release = g.state.invulnerableUntil + (CONFIG.RESPAWN_INVULN_MAX - CONFIG.RESPAWN_INVULN);
    while (sim.time < release - 2 * DT) { stepRace(sim, false); follow(); }
    expect(sim.time).toBeGreaterThan(g.state.invulnerableUntil + 1);
    expect(g.invulnerable).toBe(true);
    expect(masks(sim)).toEqual([0, 0, 0]);
    for (let i = 0; i < 3; i++) { stepRace(sim, false); follow(); }
    expect(g.invulnerable).toBe(false);
  });

  test('autre châssis superposé : invulnérable jusqu’à invulnerableUntil + (RESPAWN_INVULN_MAX − RESPAWN_INVULN)', () => {
    const { track, v } = firstVolcano();
    // 5 voitures : le copain de rang 1 sert de châssis superposé ; les copains restent à l'arrêt sur la grille.
    const sim = createRaceSim(track, CONFIG, { robots: true });
    for (const robot of sim.cars.slice(1)) robot.driver = () => false;
    placeCar(sim.cars[0].body, v.xLava, h(track), 0, CONFIG);
    const e = stepUntilRespawn(sim, false, 5);
    expect(e).toBeDefined();
    expect(e!.carId).toBe('galahad');
    // Le copain est reposé sur la voiture (même x, au sol) à chaque pas : son châssis la chevauche.
    const other = sim.cars[1];
    const follow = () => {
      const x = physToWorld(sim.cars[0].body.chassis.position).x;
      placeCar(other.body, x, h(track), slopeAt(track, x), CONFIG);
    };
    follow();
    expect(Matter.Query.collides(sim.cars[0].body.chassis, [other.body.chassis])).not.toEqual([]);
    const release = sim.cars[0].state.invulnerableUntil + (CONFIG.RESPAWN_INVULN_MAX - CONFIG.RESPAWN_INVULN);
    while (sim.time < release - 2 * DT) { stepRace(sim, false); follow(); }
    expect(sim.time).toBeGreaterThan(sim.cars[0].state.invulnerableUntil + 1);
    expect(sim.cars[0].invulnerable).toBe(true);
    expect(masks(sim)).toEqual([0, 0, 0]);
    for (let i = 0; i < 3; i++) { stepRace(sim, false); follow(); }
    expect(sim.cars[0].invulnerable).toBe(false);
    // Tombé dans la lave (zone fantôme) mais reposé hors zone : un respawn est une téléportation, pas
    // une sortie de zone en roulant ; pas fantôme, c'est l'invulnérabilité (plafonnée) qui gouverne.
    expect(sim.cars[0].ghost).toBe(false);
    expect(masks(sim)).toEqual([CAT.CAR, CAT.CAR, CAT.CAR]);
  });
});
