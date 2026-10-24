// Classement de course (spec §6 « Arrivée ») : arrivés par temps, puis non arrivés par progression,
// égalité tranchée par l'index de voiture. Créé en 5b pour `simulateRace` ; tâche 8 : place affichée avec
// hystérésis (spec §7 : un changement tient 0,5 s ou l'écart dépasse 2 m), ordinal, position sur la barre.
import { CONFIG } from '../src/config';
import { DisplayedRank, ordinal, progressFraction, rankCars } from '../src/cars/ranking';

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

/** Galahad (index 0) à 100 m, les autres voitures (index 1, 2…) aux x donnés. */
const field = (...others: number[]) => [car(0, 100), ...others.map((x, i) => car(i + 1, x))];

describe('DisplayedRank (hystérésis d’affichage, spec §7)', () => {
  test('la première place calculée est adoptée telle quelle', () => {
    expect(new DisplayedRank().update(field(150, 120), 0, 0)).toBe(3);
  });

  test('constantes de la config : 0,5 s et 2 m', () => {
    expect(CONFIG.RANK_HYSTERESIS_S).toBe(0.5);
    expect(CONFIG.RANK_HYSTERESIS_M).toBe(2);
  });

  test('un changement bref est ignoré (la place brute revient avant 0,5 s)', () => {
    const d = new DisplayedRank();
    d.update(field(90), 0, 10);                        // 1er
    expect(d.update(field(101), 0, 10.1)).toBe(1);     // un copain passe devant de 1 m : 2e brut
    expect(d.update(field(101), 0, 10.4)).toBe(1);
    expect(d.update(field(90), 0, 10.45)).toBe(1);     // il est repassé : 1er brut
    // La reprise repart de zéro : 2e brut depuis 10,5 seulement, donc pas encore montré à 10,9.
    expect(d.update(field(101), 0, 10.5)).toBe(1);
    expect(d.update(field(101), 0, 10.9)).toBe(1);
  });

  test('un changement tenu 0,5 s est montré, et seulement alors', () => {
    const d = new DisplayedRank();
    d.update(field(90), 0, 10);
    expect(d.update(field(101), 0, 10)).toBe(1);
    expect(d.update(field(101), 0, 10.25)).toBe(1);
    expect(d.update(field(101), 0, 10.49)).toBe(1);
    expect(d.update(field(101), 0, 10.5)).toBe(2);
    // Une fois montrée, la nouvelle place reste affichée.
    expect(d.update(field(101), 0, 11)).toBe(2);
  });

  test('0,5 s de pas de 1/60 s depuis 0 (somme flottante 0,49999999999999994) : montré au 30e pas, pas au 31e', () => {
    const d = new DisplayedRank();
    let t = 0;
    d.update(field(90), 0, t);
    d.update(field(101), 0, t);
    let steps = 0;
    while (d.update(field(101), 0, t += 1 / 60) === 1) steps++;
    expect(steps).toBe(29);
  });

  test('un écart de plus de 2 m avec la voiture échangée est montré tout de suite (2 m pile : non)', () => {
    const d = new DisplayedRank();
    d.update(field(90), 0, 10);
    expect(d.update(field(102), 0, 10.1)).toBe(1);
    expect(d.update(field(102.01), 0, 10.2)).toBe(2);
  });

  test('un changement de plusieurs places d’un coup, loin de la voiture de la place montrée, est tout de suite montré', () => {
    const d = new DisplayedRank();
    expect(d.update(field(140, 130, 120, 90), 0, 10)).toBe(4);
    // Un copain repasse devant : 5e brut ; la voiture du 4e rang brut (celle de la place montrée) est à 10 m.
    expect(d.update(field(140, 130, 120, 110), 0, 10.1)).toBe(5);
    // Galahad remonte 1er d'un coup (respawn d'un adversaire…) : la voiture du 5e rang brut est à 40 m.
    expect(d.update(field(90, 80, 70, 60), 0, 10.2)).toBe(1);
  });

  test('l’écart est mesuré à la voiture qui occupe la place déjà montrée, pas au chef de file ni à la voiture juste devant (R8-2)', () => {
    // Galahad 2e derrière un chef de file à 150 m ; un copain 0,5 m derrière lui.
    const a = new DisplayedRank();
    expect(a.update(field(150, 99.5), 0, 5)).toBe(2);
    // Le copain le double de 0,5 m : échange de voisins, pas un saut de 50 m (chef de file) : tenu 0,5 s.
    expect(a.update(field(150, 100.5), 0, 5.25)).toBe(2);
    expect(a.update(field(150, 100.5), 0, 5.5)).toBe(2);
    expect(a.update(field(150, 100.5), 0, 5.75)).toBe(3);
    // Galahad 2e perd deux places d'un coup : brut 4e ; la voiture de la place montrée (2e brut) est à 10 m : immédiat,
    // alors que la voiture juste devant lui (3e brut) n'est qu'à 0,5 m.
    const b = new DisplayedRank();
    expect(b.update(field(150, 90, 80), 0, 5)).toBe(2);
    expect(b.update(field(150, 110, 100.5, 80), 0, 5.1)).toBe(4);
  });

  test('un changement vers une autre place brute repart de zéro (1 → 2 → 3)', () => {
    const d = new DisplayedRank();
    d.update(field(90, 80), 0, 10);
    d.update(field(101, 80), 0, 10);                   // 2e brut
    expect(d.update(field(101, 101.5), 0, 10.4)).toBe(1);   // 3e brut : ne tient que depuis 10,4 (écart 1,5 m)
    expect(d.update(field(101, 101.5), 0, 10.8)).toBe(1);
    expect(d.update(field(101, 101.5), 0, 10.9)).toBe(3);
  });

  test('revenir à l’ancienne place demande de nouveau 0,5 s', () => {
    const d = new DisplayedRank();
    d.update(field(90), 0, 10);
    d.update(field(101), 0, 10);
    expect(d.update(field(101), 0, 10.5)).toBe(2);
    expect(d.update(field(99), 0, 10.6)).toBe(2);
    expect(d.update(field(99), 0, 11)).toBe(2);
    expect(d.update(field(99), 0, 11.1)).toBe(1);
  });

  test('une fois Galahad arrivé, sa place est définitive et montrée tout de suite', () => {
    const d = new DisplayedRank();
    expect(d.update(field(90), 0, 4.5)).toBe(1);
    // Le copain passe devant de 1 m (candidat depuis 4,7) puis arrive à 4,8 s : Galahad est toujours montré 1er.
    expect(d.update(field(101), 0, 4.7)).toBe(1);
    expect(d.update([car(0, 100), car(1, 101, 4.8)], 0, 4.8)).toBe(1);
    // Galahad arrive à 5 s : 2e, sans attendre les 0,5 s ni un écart de 2 m.
    expect(d.update([car(0, 100, 5), car(1, 101, 4.8)], 0, 5)).toBe(2);
    // Et s'il arrive premier alors qu'il était montré 2e : 1er tout de suite.
    const e = new DisplayedRank();
    expect(e.update(field(101), 0, 4.7)).toBe(2);
    expect(e.update([car(0, 100, 5), car(1, 101)], 0, 5)).toBe(1);
  });

  test('une voiture inconnue, ou des entrées qui ne sont pas rangées par index, lèvent une erreur explicite (pas de NaN silencieux)', () => {
    expect(() => new DisplayedRank().update(field(90), 7, 0)).toThrow(RangeError);
    expect(() => new DisplayedRank().update([car(1, 10), car(0, 20)], 0, 0)).toThrow(RangeError);
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
