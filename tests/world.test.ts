import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import { CAT, createWorld, sensorsTouching, stepWorld, type World } from '../src/physics/world';
import { mpsToPxPerStep, physToWorld, worldToPhys } from '../src/physics/units';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';
import type { Track } from '../src/track/types';

const { Bodies, Body, Composite } = Matter;

const R = CONFIG.WHEEL_RADIUS;

/** Roue de test : cercle dynamique, CAR, sans frottement de l'air ; les roues de test s'ignorent entre elles. */
function addWheel(world: World, x: number, y: number): Matter.Body {
  const p = worldToPhys({ x, y });
  const body = Bodies.circle(p.x, p.y, R * CONFIG.PIXELS_PER_METER, {
    frictionAir: 0,
    collisionFilter: { category: CAT.CAR, mask: CAT.GROUND | CAT.SENSOR, group: -999 },
  });
  Body.setMass(body, 1);
  Composite.add(world.engine.world, body);
  return body;
}

/** Abscisses des roues : une tous les 5 m sur [1, length − 1]. */
function wheelXs(track: Track): number[] {
  const xs: number[] = [];
  for (let x = 1; x <= track.length - 1; x += 5) xs.push(x);
  return xs;
}

const posM = (b: Matter.Body) => physToWorld(b.position);

test('gravité : un corps lâché tombe de 2,45 m en 60 pas (± 10 %)', () => {
  const track = generateTrack(1, CONFIG.TRACK_MIN_LENGTH, CONFIG);
  const world = createWorld(track, CONFIG);
  expect(world.engine.gravity.y).toBeCloseTo((CONFIG.GRAVITY * CONFIG.PIXELS_PER_METER) / 1000, 12);
  expect(world.engine.enableSleeping).toBe(false);
  const x = 10;
  const y0 = heightAt(track, x) + 50;
  const body = addWheel(world, x, y0);
  for (let i = 0; i < 60; i++) stepWorld(world);
  const fall = y0 - posM(body).y;
  expect(fall).toBeGreaterThan(2.45 * 0.9);
  expect(fall).toBeLessThan(2.45 * 1.1);
});

/**
 * Distance normale (m) du centre p au segment de sol le plus proche, signée :
 * négative si le centre est sous le sol. Sur une pente θ, une roue posée a son
 * centre à R de la surface selon la normale (R / cos θ à la verticale).
 */
function signedGroundDistance(track: Track, p: { x: number; y: number }): number {
  const pts = track.points;
  const s = CONFIG.TRACK_POINT_SPACING;
  const i0 = Math.max(0, Math.floor((p.x - 2) / s));
  const i1 = Math.min(pts.length - 1, Math.ceil((p.x + 2) / s));
  let best = Infinity;
  for (let i = i0; i < i1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return p.y >= heightAt(track, p.x) ? best : -best;
}

test.each([0, 1, 2, 3, 4])(
  'sol sans trou : des roues lâchées tous les 5 m reposent sur le sol (seed %i, 1680 m)',
  (seed) => {
    const track = generateTrack(seed, 1680, CONFIG);
    const world = createWorld(track, CONFIG);
    expect(world.track).toBe(track);
    expect(world.ground.length).toBe(track.points.length - 1);
    const wheels = wheelXs(track).map((x) => addWheel(world, x, heightAt(track, x) + 3));
    for (let i = 0; i < 300; i++) stepWorld(world);
    const bad: string[] = [];
    for (const w of wheels) {
      const p = posM(w);
      const gap = signedGroundDistance(track, p) - R;
      if (!(Math.abs(gap) <= 0.05)) bad.push(`x=${p.x.toFixed(2)} écart=${gap.toFixed(3)}`);
    }
    expect(bad).toEqual([]);
  },
);

test('tunneling : des roues lancées vers le bas à VERTICAL_SPEED_CAP ne traversent pas le sol', () => {
  const track = generateTrack(1, 1680, CONFIG);
  const world = createWorld(track, CONFIG);
  const wheels = wheelXs(track).map((x) => {
    const w = addWheel(world, x, heightAt(track, x) + 2);
    Body.setVelocity(w, { x: 0, y: mpsToPxPerStep(CONFIG.VERTICAL_SPEED_CAP) });
    return w;
  });
  const bad = new Set<number>();
  const check = () => {
    wheels.forEach((w, k) => {
      const p = posM(w);
      if (!(p.y > heightAt(track, p.x) - 0.1)) bad.add(k);
    });
  };
  for (let i = 0; i < 120; i++) {
    stepWorld(world);
    check();
  }
  expect([...bad].map((k) => wheelXs(track)[k])).toEqual([]);
});

test('lave : un cercle posé au fond du cratère ou 0,3 m sous le rebord touche le capteur, pas sur le plat de réception', () => {
  let seed = 0;
  while (seed < 10 && generateTrack(seed, 1680, CONFIG).volcanoes.length === 0) seed++;
  const track = generateTrack(seed, 1680, CONFIG);
  expect(track.volcanoes.length).toBeGreaterThan(0);
  const world = createWorld(track, CONFIG);
  expect(world.lava.length).toBe(track.volcanoes.length);
  const v = track.volcanoes[0];
  const inCrater = addWheel(world, v.xLava, v.rimY - CONFIG.CRATER_DEPTH + R);
  const onReception = addWheel(world, v.xReception + 2, heightAt(track, v.xReception + 2) + R);
  for (let i = 0; i < 10; i++) stepWorld(world);

  const touched = sensorsTouching(world.engine, [inCrater]);
  expect(touched.length).toBe(1);
  expect(touched[0].label).toBe('lava');
  expect(touched[0].isSensor).toBe(true);
  expect(touched[0].plugin.volcano).toBe(v);
  expect(sensorsTouching(world.engine, [onReception])).toEqual([]);
  // La roue du cratère repose sur le fond : le capteur ne la soutient pas.
  expect(posM(inCrater).y).toBeCloseTo(v.rimY - CONFIG.CRATER_DEPTH + R, 1);

  // Le capteur remplit tout le cratère jusqu'au niveau du rebord : une roue centrée 0,3 m sous le
  // rebord (sans toucher le fond) est déjà dans la lave.
  const nearRim = addWheel(world, v.xLava + 0.5, v.rimY - 0.3);
  stepWorld(world);
  expect(posM(nearRim).y).toBeGreaterThan(v.rimY - CONFIG.CRATER_DEPTH + R + 0.1);
  expect(sensorsTouching(world.engine, [nearRim]).map((b) => b.label)).toEqual(['lava']);
});

test('lave : le capteur monte à rimY + LAVA_SENSOR_ABOVE_RIM et descend au plancher', () => {
  let track: Track | undefined;
  for (let seed = 0; seed < 10 && !track; seed++) {
    const t = generateTrack(seed, 1680, CONFIG);
    if (t.volcanoes.length > 0) track = t;
  }
  expect(track).toBeDefined();
  if (!track) return;
  expect(track.volcanoes.length).toBeGreaterThan(0);
  const world = createWorld(track, CONFIG);
  const ppm = CONFIG.PIXELS_PER_METER;
  track.volcanoes.forEach((v, k) => {
    const b = world.lava[k].bounds;
    // y monde = −y physique / ppm (y physique vers le bas).
    expect(-b.min.y / ppm).toBeCloseTo(v.rimY + CONFIG.LAVA_SENSOR_ABOVE_RIM, 6);
    expect(b.max.y).toBeCloseTo(world.floorY, 6);
    expect(b.min.x / ppm).toBeCloseTo(v.xLava - v.lavaWidth / 2, 6);
    expect(b.max.x / ppm).toBeCloseTo(v.xLava + v.lavaWidth / 2, 6);
  });
  // Une roue dont le bas est 0,15 m au-dessus du rebord (sous le haut du capteur) est dans la lave ;
  // une roue dont le bas est 0,15 m au-dessus du haut du capteur ne l'est pas.
  const v = track.volcanoes[0];
  const low = addWheel(world, v.xLava, v.rimY + 0.15 + R);
  const high = addWheel(world, v.xLava, v.rimY + CONFIG.LAVA_SENSOR_ABOVE_RIM + 0.15 + R);
  stepWorld(world);
  expect(sensorsTouching(world.engine, [low]).map((b) => b.label)).toEqual(['lava']);
  expect(sensorsTouching(world.engine, [high])).toEqual([]);
});

test('mur : un corps lancé vers xWall est arrêté avant xWall + 1', () => {
  const track = generateTrack(1, CONFIG.TRACK_MIN_LENGTH, CONFIG);
  const world = createWorld(track, CONFIG);
  expect(world.wall.label).toBe('wall');
  const x0 = track.xWall - 10;
  const body = addWheel(world, x0, heightAt(track, x0) + R);
  Body.setVelocity(body, { x: mpsToPxPerStep(10), y: 0 });
  let maxX = -Infinity;
  for (let i = 0; i < 180; i++) {
    stepWorld(world);
    maxX = Math.max(maxX, posM(body).x);
  }
  expect(maxX).toBeGreaterThan(track.xWall - 1); // il a bien atteint le mur
  expect(maxX + R).toBeLessThan(track.xWall + 1);
  expect(posM(body).x).toBeLessThan(track.xWall);
});
