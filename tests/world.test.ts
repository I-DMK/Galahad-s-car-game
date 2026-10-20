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

test('sol sans trou : des roues lâchées tous les 5 m reposent sur le sol (seed 1, 1680 m)', () => {
  const track = generateTrack(1, 1680, CONFIG);
  const world = createWorld(track, CONFIG);
  expect(world.track).toBe(track);
  expect(world.ground.length).toBe(track.points.length - 1);
  const wheels = wheelXs(track).map((x) => addWheel(world, x, heightAt(track, x) + 3));
  for (let i = 0; i < 300; i++) stepWorld(world);
  const bad: string[] = [];
  for (const w of wheels) {
    const p = posM(w);
    const gap = p.y - (heightAt(track, p.x) + R);
    if (!(Math.abs(gap) <= 0.05)) bad.push(`x=${p.x.toFixed(2)} écart=${gap.toFixed(3)}`);
  }
  expect(bad).toEqual([]);
});

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
  check();
  expect([...bad].map((k) => wheelXs(track)[k])).toEqual([]);
});

test('lave : un cercle posé dans le cratère touche le capteur, pas sur le plat de réception', () => {
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
