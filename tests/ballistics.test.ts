import { jumpRange, runUpDistance } from '../src/track/ballistics';

const A = 22 * Math.PI / 180;

test('jumpRange sans chute = v² sin(2θ) / g', () => {
  expect(jumpRange(10, 4.9, A)).toBeCloseTo(100 * Math.sin(2 * A) / 4.9, 6);
});

test('jumpRange avec chute de 1,05 m ≈ 16,42 m', () => {
  expect(jumpRange(10, 4.9, A, 1.05)).toBeCloseTo(16.42, 1);
  expect(Math.abs(jumpRange(10, 4.9, A, 1.05) - 16.42)).toBeLessThan(0.05);
});

test('une chute plus grande allonge la portée', () => {
  expect(jumpRange(10, 4.9, A, 1.05)).toBeGreaterThan(jumpRange(10, 4.9, A));
});

test('runUpDistance(11, 4) ≈ 15,125 m', () => {
  expect(runUpDistance(11, 4)).toBeCloseTo(15.125, 6);
});
