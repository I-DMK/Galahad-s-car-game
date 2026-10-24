import { GALAHAD, PILOTS } from '../src/cars/pilots';
import { ART_FILES, FLAME_FILES, NO_ART, bodyFile, loadArt } from '../src/render/assets';

/** Faux `Image` : `onload` (ou `onerror` si son fichier est dans `fail`) à la microtâche qui suit `src = …`. */
function fakeImages(fail: readonly string[] = []) {
  const srcs: string[] = [];
  const makeImage = (): HTMLImageElement => {
    const img = {
      onload: null as (() => void) | null, onerror: null as (() => void) | null, url: '',
      set src(v: string) {
        this.url = v; srcs.push(v);
        queueMicrotask(() => (fail.some((f) => v.endsWith(`/${f}`)) ? this.onerror : this.onload)?.());
      },
    };
    return img as unknown as HTMLImageElement;
  };
  return { srcs, makeImage };
}
const urlOf = (img: CanvasImageSource | null | undefined) => (img as unknown as { url: string } | null | undefined)?.url;
const B = '/Galahad-s-car-game/';

test('bodyFile : nom ASCII, un fichier par pilote ; « timothé » → timothe.png', () => {
  expect(bodyFile('galahad')).toBe('galahad.png');
  expect(bodyFile('timothé')).toBe('timothe.png');
  const files = [GALAHAD, ...PILOTS].map((p) => bodyFile(p.id));
  for (const f of files) expect(f).toMatch(/^[a-z0-9-]+\.png$/);
  expect(new Set(files).size).toBe(7);
});

test('ART_FILES : 7 carrosseries, la roue, 4 flammes, l’étoile ; pas la Terre (tâche 16)', () => {
  expect(ART_FILES).toEqual(['galahad.png', 'pablo.png', 'diego.png', 'timothe.png', 'matthis.png', 'malo.png', 'liam.png',
    'wheel.png', 'flame-0.png', 'flame-1.png', 'flame-2.png', 'flame-3.png', 'star.png']);
});

test('tout charge : adresses sous la base, carrosseries par id de pilote, flammes dans l’ordre', async () => {
  const { srcs, makeImage } = fakeImages();
  const art = await loadArt({ base: B, makeImage });
  expect(srcs).toEqual(ART_FILES.map((f) => `${B}sprites/${f}`));
  expect([...art.bodies.keys()]).toEqual([GALAHAD, ...PILOTS].map((p) => p.id));
  expect(urlOf(art.bodies.get('timothé'))).toBe(`${B}sprites/timothe.png`);
  expect(art.flames?.map(urlOf)).toEqual(FLAME_FILES.map((f) => `${B}sprites/${f}`));
  expect(urlOf(art.wheel)).toBe(`${B}sprites/wheel.png`);
  expect(urlOf(art.star)).toBe(`${B}sprites/star.png`);
  expect(art.loaded).toEqual(ART_FILES);
  expect(art.failed).toEqual([]);
});

test('échecs isolés : carrosserie absente, roue null, flammes null (les 4 ou rien), jamais d’exception', async () => {
  const art = await loadArt({ base: '/', makeImage: fakeImages(['pablo.png', 'wheel.png', 'flame-2.png']).makeImage });
  expect(art.bodies.has('pablo')).toBe(false);
  expect(art.bodies.size).toBe(6);
  expect(art.wheel).toBeNull();
  expect(art.flames).toBeNull();
  expect(art.star).not.toBeNull();
  expect(art.failed).toEqual(['pablo.png', 'wheel.png', 'flame-2.png']);
  expect(art.loaded).toHaveLength(10);
});

test('makeImage qui lève : la promesse se résout quand même, tout en échec', async () => {
  const art = await loadArt({ base: '/', makeImage: () => { throw new Error('pas d’Image'); } });
  expect(art.failed).toEqual(ART_FILES);
  expect(art.bodies.size).toBe(0);
});

test('base par défaut : import.meta.env.BASE_URL (« / » sous Vitest)', async () => {
  const { srcs, makeImage } = fakeImages();
  await loadArt({ makeImage });
  expect(import.meta.env.BASE_URL).toBe('/');
  expect(srcs[0]).toBe('/sprites/galahad.png');
});

test('NO_ART : rien de chargé, figé', () => {
  expect(NO_ART.bodies.size).toBe(0);
  expect([NO_ART.wheel, NO_ART.flames, NO_ART.star]).toEqual([null, null, null]);
  expect(Object.isFrozen(NO_ART)).toBe(true);
});

describe('public/sprites (addendum §1.2 : budget ; README : cadre du gabarit)', () => {
  /** Accès à node (pas de @types/node), au strict nécessaire. */
  interface NodeFs { readdirSync(p: string): string[]; statSync(p: string): { size: number }; readFileSync(p: string): Uint8Array }
  const fs = (): NodeFs => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }).process.getBuiltinModule('node:fs');
  const DIR = 'public/sprites';
  const size = (f: string) => fs().statSync(`${DIR}/${f}`).size;
  /** Largeur et hauteur lues dans l'en-tête IHDR (octets 16 à 23, gros-boutiste). */
  const dims = (f: string): [number, number] => {
    const b = fs().readFileSync(`${DIR}/${f}`);
    const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    return [u32(16), u32(20)];
  };
  const BODIES = [GALAHAD, ...PILOTS].map((p) => bodyFile(p.id));

  test('le dossier contient exactement les fichiers chargés (ART_FILES)', () => {
    expect(fs().readdirSync(DIR).sort()).toEqual([...ART_FILES].sort());
  });
  test('≤ 60 KB par carrosserie, ≤ 400 KB pour le dossier', () => {
    for (const f of BODIES) expect(size(f), f).toBeLessThanOrEqual(60 * 1024);
    const total = fs().readdirSync(DIR).reduce((s, f) => s + size(f), 0);
    console.log(`public/sprites : ${total} octets`);
    expect(total).toBeLessThanOrEqual(400 * 1024);
  });
  test('carrosseries 512 × 256 px (cadre 2,80 × 1,40 m à 183 px/m) ; roue et flammes carrées', () => {
    for (const f of BODIES) expect(dims(f), f).toEqual([512, 256]);
    for (const f of ['wheel.png', ...FLAME_FILES]) { const [w, h] = dims(f); expect(w, f).toBe(h); }
  });
});
