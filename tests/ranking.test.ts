// Classement de course (spec §6 « Arrivée ») : arrivés par temps, puis non arrivés par progression,
// égalité tranchée par l'index de voiture. Créé en 5b pour `simulateRace` ; tâche 8 : place affichée avec
// hystérésis (spec §7 : un changement tient 0,5 s ou l'écart dépasse 2 m), ordinal, position sur la barre.
import { CONFIG } from '../src/config';
import { DisplayedRank, gapToPlace, ordinal, progressFraction, rankCars } from '../src/cars/ranking';

const car = (index: number, progress: number, finishedAt: number | null = null) => ({ index, progress, finishedAt });

describe('rankCars', () => {
  test('arrivés par temps croissant, devant tous les non arrivés (même plus avancés)', () => {
    expect(rankCars([car(0, 1600, 130), car(1, 1700), car(2, 1610, 120.5), car(3, 1605, 125)])).toEqual([2, 3, 0, 1]);
  });

  test('non arrivés par progression décroissante', () => {
    expect(rankCars([car(0, 100), car(1, 300), car(2, 200), car(3, 250), car(4, 50)])).toEqual([1, 3, 2, 0, 4]);
  });

  test('égalité tranchée par l’index (temps égaux, progressions égales)', () => {
    expect(rankCars([car(3, 1650, 120), car(1, 1650, 120), car(4, 500), car(2, 500), car(0, 500)])).toEqual([1, 3, 0, 2, 4]);
  });

  test('renvoie les index (pas les positions) et ne modifie pas l’entrée', () => {
    const input = [car(2, 10), car(0, 30), car(1, 20)];
    const copy = input.map((c) => ({ ...c }));
    expect(rankCars(input)).toEqual([0, 1, 2]);
    expect(input).toEqual(copy);
    expect(rankCars([])).toEqual([]);
  });
});

describe('DisplayedRank (hystérésis d’affichage, spec §7)', () => {
  test('la première place calculée est adoptée telle quelle', () => {
    const d = new DisplayedRank();
    expect(d.current).toBeNull();
    expect(d.update(3, 0, 0)).toBe(3);
    expect(d.current).toBe(3);
  });

  test('constantes de la config : 0,5 s et 2 m', () => {
    expect(CONFIG.RANK_HYSTERESIS_S).toBe(0.5);
    expect(CONFIG.RANK_HYSTERESIS_M).toBe(2);
  });

  test('un changement bref est ignoré (la place brute revient avant 0,5 s)', () => {
    const d = new DisplayedRank();
    d.update(1, 0, 10);
    expect(d.update(2, 1, 10.1)).toBe(1);
    expect(d.update(2, 1, 10.4)).toBe(1);
    expect(d.update(1, 0, 10.45)).toBe(1);
    // La reprise repart de zéro : 2 depuis 10,5 seulement, donc pas encore montré à 10,9.
    expect(d.update(2, 1, 10.5)).toBe(1);
    expect(d.update(2, 1, 10.9)).toBe(1);
    expect(d.current).toBe(1);
  });

  test('un changement tenu 0,5 s est montré, et seulement alors', () => {
    const d = new DisplayedRank();
    d.update(1, 0, 10);
    expect(d.update(2, 1, 10)).toBe(1);
    expect(d.update(2, 1, 10.25)).toBe(1);
    expect(d.update(2, 1, 10.49)).toBe(1);
    expect(d.update(2, 1, 10.5)).toBe(2);
    // Une fois montrée, la nouvelle place reste affichée.
    expect(d.update(2, 1, 11)).toBe(2);
    expect(d.current).toBe(2);
  });

  test('un écart de plus de 2 m est montré tout de suite (2 m pile : non)', () => {
    const d = new DisplayedRank();
    d.update(1, 0, 10);
    expect(d.update(2, 2, 10.1)).toBe(1);
    expect(d.update(2, 2.01, 10.2)).toBe(2);
    // Dans l'autre sens aussi, et de plusieurs places d'un coup.
    expect(d.update(5, 40, 10.3)).toBe(5);
  });

  test('un changement vers une autre place brute repart de zéro (1 → 2 → 3)', () => {
    const d = new DisplayedRank();
    d.update(1, 0, 10);
    d.update(2, 1, 10);
    expect(d.update(3, 1, 10.4)).toBe(1);   // 3 ne tient que depuis 10,4
    expect(d.update(3, 1, 10.8)).toBe(1);
    expect(d.update(3, 1, 10.9)).toBe(3);
  });

  test('revenir à l’ancienne place demande de nouveau 0,5 s', () => {
    const d = new DisplayedRank();
    d.update(1, 0, 10);
    d.update(2, 1, 10);
    expect(d.update(2, 1, 10.5)).toBe(2);
    expect(d.update(1, 1, 10.6)).toBe(2);
    expect(d.update(1, 1, 11)).toBe(2);
    expect(d.update(1, 1, 11.1)).toBe(1);
  });
});

describe('ordinal', () => {
  test('1er, puis 2e, 3e… (en français, seul le 1 prend « er »)', () => {
    expect([1, 2, 3, 4, 5].map(ordinal)).toEqual(['1er', '2e', '3e', '4e', '5e']);
    expect([11, 21, 101].map(ordinal)).toEqual(['11e', '21e', '101e']);
  });
});

describe('progressFraction (position d’un point de la barre, R8-3)', () => {
  test('(x − xStart) / (xFinish − xStart), borné à [0 ; 1]', () => {
    expect(progressFraction(200, 100, 500)).toBe(0.25);
    expect(progressFraction(100, 100, 500)).toBe(0);
    expect(progressFraction(500, 100, 500)).toBe(1);
  });

  test('la grille (x < xStart) est à 0 %, au-delà de la ligne à 100 %', () => {
    expect(progressFraction(96.7, 100, 500)).toBe(0);
    expect(progressFraction(-10, 100, 500)).toBe(0);
    expect(progressFraction(560, 100, 500)).toBe(1);
  });
});

describe('gapToPlace (écart au voisin d’échange, R8-2)', () => {
  const cars = [car(0, 100), car(1, 101), car(2, 150), car(3, 99.5), car(4, 60)];

  test('distance à la voiture qui occupe la place donnée du classement brut', () => {
    const order = rankCars(cars);   // [2, 1, 0, 3, 4]
    expect(order).toEqual([2, 1, 0, 3, 4]);
    expect(gapToPlace(cars, order, 0, 2)).toBe(1);     // 2e place brute : la voiture 1, à 1 m
    expect(gapToPlace(cars, order, 0, 1)).toBe(50);    // 1re : la voiture 2, à 50 m
    expect(gapToPlace(cars, order, 0, 4)).toBe(0.5);   // 4e : la voiture 3
  });

  test('sa propre place : écart nul', () => {
    expect(gapToPlace(cars, rankCars(cars), 0, 3)).toBe(0);
  });
});
