import { advanceAccumulator } from '../src/loop/accumulator';

const DT = 1 / 60;

test('un écart énorme (onglet en veille) est plafonné à maxSteps pas', () => {
  const r = advanceAccumulator(0, 30, DT, 4);
  expect(r.steps).toBe(4);
  expect(r.acc).toBeCloseTo(0, 9);
});

test('une image de 1/60 s donne exactement un pas', () => {
  const r = advanceAccumulator(0, DT, DT, 4);
  expect(r.steps).toBe(1);
  expect(r.acc).toBeCloseTo(0, 9);
});

test('moins d’un pas : on accumule sans avancer', () => {
  const r = advanceAccumulator(0.01, 0.005, DT, 4);
  expect(r.steps).toBe(0);
  expect(r.acc).toBeCloseTo(0.015, 12);
});

test('deux demi-images successives de 1/60 s donnent deux pas malgré l’arrondi flottant', () => {
  const r = advanceAccumulator(DT, DT, DT, 4);
  expect(r.steps).toBe(2);
  expect(r.acc).toBeGreaterThanOrEqual(0);
  expect(r.acc).toBeCloseTo(0, 9);
});
