// Turbo et étoiles (tâche 12) : logique pure.
import { CONFIG } from '../src/config';
import { isStarActive, newStarStates, takeStar } from '../src/cars/stars';
import { newCarState } from '../src/cars/state';
import { activateTurbo, turboFactor } from '../src/cars/turbo';

const fresh = () => newCarState('galahad', 'Galahad', '#1e5cff', '#e2231a', { x: 0, y: 0, angle: 0 });

describe('turbo', () => {
  test('facteur 1 avant toute étoile', () => {
    const s = fresh();
    expect(turboFactor(s, 0, CONFIG)).toBe(1);
    expect(turboFactor(s, 10, CONFIG)).toBe(1);
  });

  test('TURBO_FACTOR pendant TURBO_SECONDS, puis 1', () => {
    const s = fresh();
    activateTurbo(s, 10, CONFIG);
    expect(s.turboUntil).toBe(10 + CONFIG.TURBO_SECONDS);
    expect(turboFactor(s, 10, CONFIG)).toBe(CONFIG.TURBO_FACTOR);
    expect(turboFactor(s, 12.99, CONFIG)).toBe(CONFIG.TURBO_FACTOR);
    expect(turboFactor(s, 13, CONFIG)).toBe(1);
    expect(turboFactor(s, 20, CONFIG)).toBe(1);
  });

  test('une 2e étoile pendant le turbo remet 3 s pleines (t = 2 → fin à 5)', () => {
    const s = fresh();
    activateTurbo(s, 0, CONFIG);
    activateTurbo(s, 2, CONFIG);
    expect(s.turboUntil).toBe(5);
    expect(turboFactor(s, 4.9, CONFIG)).toBe(CONFIG.TURBO_FACTOR);
    expect(turboFactor(s, 5, CONFIG)).toBe(1);
  });
});

describe('étoiles', () => {
  test('newStarStates : un état par étoile, mêmes ids, aucune prise', () => {
    const states = newStarStates([{ id: 3, x: 10, y: 1 }, { id: 7, x: 30, y: 2 }]);
    expect(states).toEqual([{ id: 3, takenAt: null }, { id: 7, takenAt: null }]);
  });

  test('active tant que non prise ; prise : inactive STAR_RESPAWN_SECONDS puis de nouveau active', () => {
    const [s] = newStarStates([{ id: 1, x: 0, y: 0 }]);
    expect(isStarActive(s, 0, CONFIG)).toBe(true);
    takeStar(s, 20);
    expect(s.takenAt).toBe(20);
    expect(isStarActive(s, 20, CONFIG)).toBe(false);
    expect(isStarActive(s, 24.9, CONFIG)).toBe(false);
    expect(isStarActive(s, 20 + CONFIG.STAR_RESPAWN_SECONDS, CONFIG)).toBe(true);
    expect(isStarActive(s, 30, CONFIG)).toBe(true);
  });
});
