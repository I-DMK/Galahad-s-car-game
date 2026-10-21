import { CONFIG } from '../src/config';
import { GALAHAD, PILOTS, drawPilots } from '../src/cars/pilots';
import type { Pilot } from '../src/cars/pilots';

const NOMS = ['Pablo', 'Diego', 'Timothée', 'Matthis', 'Malo', 'Liam'];

/** Plus grand écart sur une composante R, V ou B entre deux couleurs 0xRRGGBB. */
function ecartRVB(a: number, b: number): number {
  return Math.max(
    Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)),
    Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)),
    Math.abs((a & 255) - (b & 255)),
  );
}

const ids = (pilotes: readonly Pilot[]) => pilotes.map((p) => p.id);

describe('PILOTS', () => {
  test('6 pilotes, dans l’ordre Pablo, Diego, Timothée, Matthis, Malo, Liam', () => {
    expect(PILOTS.map((p) => p.name)).toEqual(NOMS);
  });

  test('l’id est le prénom en minuscules, et il est unique', () => {
    expect(ids(PILOTS)).toEqual(NOMS.map((n) => n.toLowerCase()));
    expect(new Set(ids(PILOTS)).size).toBe(PILOTS.length);
  });

  test('base ∈ [0,85 ; 1] et lift ∈ [0 ; 0,6] pour chaque pilote', () => {
    for (const p of PILOTS) {
      expect(p.base, `${p.name}.base`).toBeGreaterThanOrEqual(0.85);
      expect(p.base, `${p.name}.base`).toBeLessThanOrEqual(1);
      expect(p.lift, `${p.name}.lift`).toBeGreaterThanOrEqual(0);
      expect(p.lift, `${p.name}.lift`).toBeLessThanOrEqual(0.6);
    }
  });

  test('le tableau et ses entrées sont figés (aucun appelant ne peut les modifier)', () => {
    expect(Object.isFrozen(PILOTS)).toBe(true);
    for (const p of PILOTS) expect(Object.isFrozen(p), p.name).toBe(true);
    expect(() => (PILOTS as Pilot[]).push(PILOTS[0])).toThrow(TypeError);
    expect(() => ((PILOTS[0] as { base: number }).base = 0)).toThrow(TypeError);
  });

  test('couleurs de carrosserie distinctes deux à deux, Galahad compris (écart ≥ 120 sur R, V ou B)', () => {
    const tous = [...PILOTS, GALAHAD];
    for (let i = 0; i < tous.length; i++) {
      for (let j = i + 1; j < tous.length; j++) {
        expect(ecartRVB(tous[i].color, tous[j].color), `${tous[i].name} / ${tous[j].name}`).toBeGreaterThanOrEqual(120);
      }
    }
  });

  test('couleurs de casque distinctes deux à deux, Galahad compris (écart ≥ 120 sur R, V ou B)', () => {
    const tous = [...PILOTS, GALAHAD];
    for (let i = 0; i < tous.length; i++) {
      for (let j = i + 1; j < tous.length; j++) {
        expect(ecartRVB(tous[i].helmet, tous[j].helmet), `${tous[i].name} / ${tous[j].name}`).toBeGreaterThanOrEqual(120);
      }
    }
  });
});

describe('GALAHAD', () => {
  test('id « galahad », bleu et rouge repris de CONFIG (source unique), casque rouge', () => {
    expect(GALAHAD.id).toBe('galahad');
    expect(GALAHAD.name).toBe('Galahad');
    expect(GALAHAD.color).toBe(CONFIG.GALAHAD_COLOR);
    expect(GALAHAD.accent).toBe(CONFIG.GALAHAD_ACCENT);
    expect(GALAHAD.helmet).toBe(CONFIG.GALAHAD_ACCENT);
    expect(CONFIG.GALAHAD_COLOR).toBe(0x1e5cff);
    expect(CONFIG.GALAHAD_ACCENT).toBe(0xe2231a);
  });

  test('n’est pas dans PILOTS', () => {
    expect(PILOTS).not.toContain(GALAHAD);
    expect(ids(PILOTS)).not.toContain('galahad');
  });
});

describe('drawPilots', () => {
  test('tire 4 pilotes par défaut, sans doublon et jamais Galahad (graines 0 à 99)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const tirage = drawPilots(seed);
      expect(tirage, `graine ${seed}`).toHaveLength(4);
      expect(new Set(ids(tirage)).size, `graine ${seed}`).toBe(4);
      expect(ids(tirage), `graine ${seed}`).not.toContain('galahad');
      for (const p of tirage) expect(PILOTS, `graine ${seed}`).toContain(p);
    }
  });

  test('même graine → mêmes pilotes, dans le même ordre', () => {
    for (const seed of [0, 1, 42, 99, 123456789]) {
      expect(ids(drawPilots(seed))).toEqual(ids(drawPilots(seed)));
      expect(ids(drawPilots(seed, 6))).toEqual(ids(drawPilots(seed, 6)));
    }
  });

  test('graines 0 à 99 : chaque pilote apparaît au moins 20 fois', () => {
    const apparitions = new Map<string, number>(PILOTS.map((p) => [p.id, 0]));
    for (let seed = 0; seed < 100; seed++) {
      for (const p of drawPilots(seed)) apparitions.set(p.id, (apparitions.get(p.id) ?? 0) + 1);
    }
    for (const [id, n] of apparitions) expect(n, id).toBeGreaterThanOrEqual(20);
  });

  test('l’ordre du tirage est le rang sur la grille : chaque pilote peut partir en tête, et le tirage n’est pas toujours dans l’ordre de PILOTS', () => {
    const enTete = new Set<string>();
    let dansLOrdre = 0;
    for (let seed = 0; seed < 100; seed++) {
      const tirage = drawPilots(seed);
      enTete.add(tirage[0].id);
      const rangs = tirage.map((p) => PILOTS.indexOf(p));
      if (rangs.every((r, i) => i === 0 || rangs[i - 1] < r)) dansLOrdre++;
    }
    expect([...enTete].sort()).toEqual(ids(PILOTS).slice().sort());
    expect(dansLOrdre).toBeLessThan(100);
  });

  test('count = 0 → aucun pilote ; count = 6 → les 6 pilotes, mélangés', () => {
    expect(drawPilots(7, 0)).toEqual([]);
    for (let seed = 0; seed < 20; seed++) {
      expect(ids(drawPilots(seed, 6)).sort()).toEqual(ids(PILOTS).slice().sort());
    }
  });

  test('ne modifie pas PILOTS et renvoie un tableau que l’appelant peut modifier', () => {
    const avant = ids(PILOTS);
    const tirage = drawPilots(5, 6);
    tirage.reverse();
    tirage.pop();
    expect(ids(PILOTS)).toEqual(avant);
    expect(PILOTS).toHaveLength(6);
  });

  test('RangeError si count n’est pas un entier dans [0, 6]', () => {
    for (const count of [-1, 7, 1.5, 0.1, NaN, Infinity, -Infinity]) {
      expect(() => drawPilots(1, count), String(count)).toThrow(RangeError);
    }
  });
});
