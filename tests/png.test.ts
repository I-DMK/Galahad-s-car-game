// Le lecteur de PNG des tests (tests/helpers/png.ts) et le contrôle de propreté des images (tâche 8b, tour 1) : le contrôle
// doit échouer sur un PNG sale, sinon il ne garde rien. Les PNG sont construits en mémoire.
import { alphaCentroid, fringeProblems, makePng8, readPng8, type PaletteEntry } from './helpers/png';

const c = (r: number, g: number, b: number, a = 255): PaletteEntry => ({ r, g, b, a });

describe('readPng8', () => {
  test('palette avec alpha (tRNS court : 255 au-delà) et pixels, pour chacun des 5 filtres PNG', () => {
    const palette = [c(0, 0, 0, 0), c(255, 0, 0), c(10, 200, 30, 128), c(1, 2, 3)];
    const w = 7, h = 5;
    const indices = Array.from({ length: w * h }, (_, i) => (i * 7 + (i >> 2)) % 4);
    for (const filter of [0, 1, 2, 3, 4]) {
      const png = readPng8(makePng8(w, h, palette, indices, Array(h).fill(filter)));
      expect([png.width, png.height, png.bitDepth], `filtre ${filter}`).toEqual([w, h, 8]);
      expect(png.palette, `filtre ${filter}`).toEqual(palette);
      expect([...png.indices()], `filtre ${filter}`).toEqual(indices);
    }
    // Les 5 filtres dans la même image, une ligne chacun.
    const mixed = readPng8(makePng8(w, h, palette, indices, [0, 1, 2, 3, 4]));
    expect([...mixed.indices()]).toEqual(indices);
  });

  test('refuse ce qui n’est pas un PNG à palette', () => {
    expect(() => readPng8(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow('pas un PNG');
  });

  test('centre de gravité de l’alpha : pondéré par l’alpha, centre du pixel en i + 0,5', () => {
    // 4 × 2 : alpha 255 en (1, 0) et (3, 1), 0 ailleurs, plus un pixel à 255/2 en (0, 1).
    const palette = [c(0, 0, 0, 0), c(9, 9, 9, 255), c(9, 9, 9, 100)];
    const idx = [0, 1, 0, 0, 2, 0, 0, 1];
    const g = alphaCentroid(readPng8(makePng8(4, 2, palette, idx)));
    expect(g.x).toBeCloseTo((255 * 1.5 + 255 * 3.5 + 100 * 0.5) / 610, 9);
    expect(g.y).toBeCloseTo((255 * 0.5 + 255 * 1.5 + 100 * 1.5) / 610, 9);
  });
});

describe('fringeProblems : le contrôle de propreté des images', () => {
  const png = (entries: PaletteEntry[]) => readPng8(makePng8(1, 1, entries, [0]));

  test('image propre : opaque, transparent, bords lissés non roses, rose opaque → rien à signaler', () => {
    expect(fringeProblems(png([c(0, 0, 0, 0), c(30, 90, 255), c(255, 119, 170), c(255, 200, 100, 128), c(255, 0, 255, 255)]))).toEqual([]);
  });

  test('alpha 250 (le générateur livre 240 à 254 au lieu de 255) : signalé, rose permis ou non', () => {
    for (const a of [240, 250, 254]) {
      expect(fringeProblems(png([c(30, 90, 255, a)])), `alpha ${a}`).toHaveLength(1);
      expect(fringeProblems(png([c(30, 90, 255, a)]), true), `alpha ${a}, rose permis`).toHaveLength(1);
    }
    expect(fringeProblems(png([c(30, 90, 255, 239)]))).toEqual([]);
    expect(fringeProblems(png([c(30, 90, 255, 255)]))).toEqual([]);
  });

  test('liseré magenta (rose visible à alpha partiel) : signalé, sauf pour la carrosserie rose de liam.png', () => {
    const fringe = png([c(0, 0, 0, 0), c(255, 0, 255, 128)]);
    expect(fringeProblems(fringe)).toHaveLength(1);
    expect(fringeProblems(fringe)[0]).toContain('rose');
    expect(fringeProblems(fringe, true)).toEqual([]);
    expect(fringeProblems(png([c(230, 20, 140, 16)]))).toHaveLength(1); // à peine visible : α = 16
    expect(fringeProblems(png([c(255, 0, 255, 15)]))).toEqual([]); // invisible : α < 16
  });
});
