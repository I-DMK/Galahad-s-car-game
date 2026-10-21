// Interpolation des poses entre deux pas (tâche 5f du plan B) : tests purs.
import { lerpAngle, lerpCarPose, PoseHistory, type CarPose } from '../src/loop/interpolation';

const DEG = Math.PI / 180;

const pose = (x: number, angle = 0, wheelAngle = 0, speed = 0): CarPose => ({
  chassis: { x, y: x / 2, angle },
  wheels: [{ x: x - 0.7, y: 0, angle: wheelAngle }, { x: x + 0.7, y: 0, angle: wheelAngle }],
  speed,
});

test('lerpAngle(179°, −179°, 0,5) passe par ±180°, pas par 0', () => {
  const a = lerpAngle(179 * DEG, -179 * DEG, 0.5);
  expect(Math.abs(Math.cos(a) + 1)).toBeLessThan(1e-12);
  expect(Math.abs(a)).toBeCloseTo(Math.PI, 12);
});

test('lerpAngle : chemin court, angle cumulé de roue conservé (pas de remise dans (−π, π])', () => {
  expect(lerpAngle(0, 90 * DEG, 0.5)).toBeCloseTo(45 * DEG, 12);
  expect(lerpAngle(-170 * DEG, 170 * DEG, 0.5)).toBeCloseTo(-180 * DEG, 12);
  // Roue en turbo : angle cumulé de 100 tours, + 44,6° par pas.
  const a = 200 * Math.PI;
  expect(lerpAngle(a, a + 44.6 * DEG, 0.5)).toBeCloseTo(a + 22.3 * DEG, 9);
  expect(lerpAngle(a, a + 44.6 * DEG, 0)).toBe(a);
});

test('lerpCarPose : alpha 0 → prev, 1 → cur, 0,5 → milieu (châssis, roues, vitesse)', () => {
  const prev = pose(0, 0, 0, 10);
  const cur = pose(1, 10 * DEG, 40 * DEG, 12);
  expect(lerpCarPose(prev, cur, 0)).toEqual(prev);
  expect(lerpCarPose(prev, cur, 1)).toEqual(cur);
  const mid = lerpCarPose(prev, cur, 0.5);
  expect(mid.chassis.x).toBeCloseTo(0.5, 12);
  expect(mid.chassis.y).toBeCloseTo(0.25, 12);
  expect(mid.chassis.angle).toBeCloseTo(5 * DEG, 12);
  expect(mid.wheels[0].x).toBeCloseTo(-0.2, 12);
  expect(mid.wheels[1].angle).toBeCloseTo(20 * DEG, 12);
  expect(mid.speed).toBeCloseTo(11, 12);
});

function history(): PoseHistory {
  const h = new PoseHistory();
  h.reset([pose(0), pose(10)]);
  h.push([pose(1), pose(12)], new Set());
  return h;
}

test('PoseHistory.at : 0 → précédent, 1 → courant, hors de [0, 1] borné', () => {
  const h = history();
  expect(h.at(0).map((p) => p.chassis.x)).toEqual([0, 10]);
  expect(h.at(1).map((p) => p.chassis.x)).toEqual([1, 12]);
  expect(h.at(0.5).map((p) => p.chassis.x)).toEqual([0.5, 11]);
  expect(h.at(-0.3).map((p) => p.chassis.x)).toEqual([0, 10]);
  expect(h.at(1.7).map((p) => p.chassis.x)).toEqual([1, 12]);
});

test('voiture téléportée : at(α) = courant pour elle seule', () => {
  const h = new PoseHistory();
  h.reset([pose(0), pose(10)]);
  h.push([pose(-30), pose(12)], new Set([0]));
  for (const a of [0, 0.5, 0.99]) {
    expect(h.at(a)[0]).toEqual(pose(-30));
    expect(h.at(a)[1].chassis.x).toBeCloseTo(10 + 2 * a, 12);
  }
  // Le pas suivant interpole de nouveau depuis la cible.
  h.push([pose(-29), pose(13)], new Set());
  expect(h.at(0.5)[0].chassis.x).toBeCloseTo(-29.5, 12);
});

test('reset : précédent = courant = poses données', () => {
  const h = history();
  h.reset([pose(5), pose(6)]);
  for (const a of [0, 0.5, 1]) expect(h.at(a).map((p) => p.chassis.x)).toEqual([5, 6]);
});

test('at ne modifie rien : ni l’historique, ni les poses poussées ; poses neuves', () => {
  const prev = [pose(0), pose(10)];
  const cur = [pose(1), pose(12)];
  const snapshot = JSON.stringify([prev, cur]);
  const h = new PoseHistory();
  h.reset(prev);
  h.push(cur, new Set());
  const a = h.at(0.5);
  a[0].chassis.x = 999;
  a[0].wheels[0].angle = 999;
  const b = h.at(1);
  b[1].chassis.x = 999;
  expect(JSON.stringify([prev, cur])).toBe(snapshot);
  expect(h.at(0.5)[0].chassis.x).toBe(0.5);
  expect(h.at(1)[1].chassis.x).toBe(12);
});

test('at(1) et au-delà : copie exacte de la pose courante (bits compris, −0 gardé)', () => {
  const h = new PoseHistory();
  const prev = { chassis: { x: 0.1, y: 0.3, angle: 0.1 }, wheels: [{ x: 0.1, y: 0, angle: 0.2 }], speed: 1 };
  const cur = { chassis: { x: 0.7, y: 0.1 + 0.2, angle: -0 }, wheels: [{ x: 0.7, y: 0, angle: -0 }], speed: 3 };
  h.reset([prev]);
  h.push([cur], new Set());
  for (const a of [1, 1.5]) {
    const got = h.at(a)[0];
    expect(got).toEqual(cur);
    expect(Object.is(got.chassis.angle, -0)).toBe(true);
    expect(got).not.toBe(cur);
    expect(got.wheels[0]).not.toBe(cur.wheels[0]);
  }
});
