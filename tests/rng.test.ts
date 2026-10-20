import { mulberry32, pickWeighted } from '../src/track/rng';

test('mulberry32 est déterministe pour une même graine', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) expect(a()).toBe(b());
});

test('mulberry32 diffère selon la graine', () => {
  expect(mulberry32(1)()).not.toBe(mulberry32(2)());
});

test('mulberry32 reste dans [0, 1) sur 1 000 tirages', () => {
  const r = mulberry32(12345);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});

test('pickWeighted respecte les poids à ±5 % sur 10 000 tirages', () => {
  const r = mulberry32(2024);
  const items = [
    { item: 'a', weight: 1 },
    { item: 'b', weight: 2 },
    { item: 'c', weight: 7 },
  ];
  const N = 10000;
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < N; i++) counts[pickWeighted(r, items)]++;
  expect(Math.abs(counts.a / N - 0.1)).toBeLessThan(0.05);
  expect(Math.abs(counts.b / N - 0.2)).toBeLessThan(0.05);
  expect(Math.abs(counts.c / N - 0.7)).toBeLessThan(0.05);
});

test('pickWeighted ne tire jamais un poids nul', () => {
  const r = mulberry32(7);
  const items = [{ item: 'x', weight: 0 }, { item: 'y', weight: 3 }];
  for (let i = 0; i < 500; i++) expect(pickWeighted(r, items)).toBe('y');
});
