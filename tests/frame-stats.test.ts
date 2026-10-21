// Compteur d'images à 0 et à 2+ pas (tâche 5f du plan B, `?debug=1`).
import { StepHistogram } from '../src/loop/frame-stats';

test('1, 0, 2, 1, 1, 3 sur 1 s → { 6, 1, 2 }, puis le compteur repart à zéro', () => {
  const h = new StepHistogram();
  expect(h.last).toEqual({ frames: 0, zero: 0, multi: 0 });
  [1, 0, 2, 1, 1].forEach((s, i) => h.record(s, 1000 + i * 200));
  // Seconde pas encore close : rien de publié.
  expect(h.last).toEqual({ frames: 0, zero: 0, multi: 0 });
  h.record(3, 2000);
  expect(h.last).toEqual({ frames: 6, zero: 1, multi: 2 });
  // Nouvelle seconde : 1, 1, 1 → { 3, 0, 0 } (rien de la précédente).
  h.record(1, 2400);
  h.record(1, 2800);
  expect(h.last).toEqual({ frames: 6, zero: 1, multi: 2 });
  h.record(1, 3000);
  expect(h.last).toEqual({ frames: 3, zero: 0, multi: 0 });
});
