// Compteur d'images à 0 et à 2+ pas (tâche 5f du plan B, `?debug=1`).
import { StepHistogram } from '../src/loop/frame-stats';

test('1, 0, 2, 1, 1, 3 sur 1 s → { 6, 1, 2 }, puis le compteur repart à zéro', () => {
  const h = new StepHistogram();
  expect(h.last).toEqual({ frames: 0, zero: 0, multi: 0 });
  // Seconde pas encore close : rien de publié, record renvoie false.
  expect([1, 0, 2, 1, 1].map((s, i) => h.record(s, 1000 + i * 200))).toEqual([false, false, false, false, false]);
  expect(h.last).toEqual({ frames: 0, zero: 0, multi: 0 });
  expect(h.record(3, 2000)).toBe(true);
  expect(h.last).toEqual({ frames: 6, zero: 1, multi: 2 });
  // Nouvelle seconde : 1, 1, 1 → { 3, 0, 0 } (rien de la précédente).
  expect(h.record(1, 2400)).toBe(false);
  expect(h.record(1, 2800)).toBe(false);
  expect(h.last).toEqual({ frames: 6, zero: 1, multi: 2 });
  expect(h.record(1, 3000)).toBe(true);
  expect(h.last).toEqual({ frames: 3, zero: 0, multi: 0 });
});

test('reset (retour d’onglet) : la fenêtre en cours est oubliée, la suivante part de l’image d’après ; last gardé', () => {
  const h = new StepHistogram();
  h.record(1, 0);
  h.record(2, 1000);
  expect(h.last).toEqual({ frames: 2, zero: 0, multi: 1 });
  h.record(0, 1200);
  h.reset();
  expect(h.last).toEqual({ frames: 2, zero: 0, multi: 1 });
  // Onglet caché 30 s : la fenêtre repart à 31 000, sans l'image à 0 pas d'avant.
  expect(h.record(1, 31_000)).toBe(false);
  expect(h.record(1, 31_500)).toBe(false);
  expect(h.record(1, 32_000)).toBe(true);
  expect(h.last).toEqual({ frames: 3, zero: 0, multi: 0 });
});
