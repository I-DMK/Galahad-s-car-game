// Classement de course (spec §6 « Arrivée ») : arrivés par temps, puis non arrivés par progression,
// égalité tranchée par l'index de voiture. Créé en 5b pour `simulateRace` ; l'affichage (hystérésis,
// ordinal) arrive en tâche 8.
import { rankCars } from '../src/cars/ranking';

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
