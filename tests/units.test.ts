import { toPx, toM, worldToPhys, physToWorld, speedMps, mpsToPxPerStep } from '../src/physics/units';

test('toPx et toM sont inverses (40 px par mètre)', () => {
  expect(toPx(2)).toBe(80);
  expect(toM(80)).toBe(2);
  expect(toM(toPx(3.7))).toBeCloseTo(3.7, 10);
});

test('worldToPhys convertit en pixels et inverse y', () => {
  expect(worldToPhys({ x: 1, y: 2 })).toEqual({ x: 40, y: -80 });
});

test('physToWorld est l\'inverse de worldToPhys', () => {
  const p = physToWorld({ x: 40, y: -80 });
  expect(p.x).toBeCloseTo(1, 10);
  expect(p.y).toBeCloseTo(2, 10);
});

test('speedMps convertit des px par pas en m/s', () => {
  expect(speedMps({ x: 40 / 60, y: 0 })).toBeCloseTo(1, 10);
  expect(speedMps({ x: 3 / 60 * 40, y: 4 / 60 * 40 })).toBeCloseTo(5, 10);
});

test('mpsToPxPerStep est l\'inverse de speedMps', () => {
  expect(mpsToPxPerStep(1)).toBeCloseTo(40 / 60, 10);
  expect(speedMps({ x: mpsToPxPerStep(7), y: 0 })).toBeCloseTo(7, 10);
});
