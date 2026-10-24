import { GALAHAD, PILOTS } from '../src/cars/pilots';
import { ART_FILES, ART_TIMEOUT_MS, FLAME_FILES, NO_ART, bodyFile, loadArt, type Art } from '../src/render/assets';
import { fringeProblems, readPng8 } from './helpers/png';

/**
 * Faux `Image` : `onload` (ou `onerror` si son fichier est dans `fail`) à la microtâche qui suit `src = …`. `cuts` : les
 * adresses dont la requête a été coupée (`removeAttribute('src')`) ; une image chargée ou en erreur ne doit jamais l'être.
 */
function fakeImages(fail: readonly string[] = []) {
  const srcs: string[] = [];
  const cuts: string[] = [];
  const makeImage = (): HTMLImageElement => {
    const img = {
      onload: null as (() => void) | null, onerror: null as (() => void) | null, url: '',
      set src(v: string) {
        this.url = v; srcs.push(v);
        queueMicrotask(() => (fail.some((f) => v.endsWith(`/${f}`)) ? this.onerror : this.onload)?.());
      },
      removeAttribute(name: string) { if (name === 'src') cuts.push(this.url); },
    };
    return img as unknown as HTMLImageElement;
  };
  return { srcs, cuts, makeImage };
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
  const { srcs, cuts, makeImage } = fakeImages();
  const art = await loadArt({ base: B, makeImage });
  expect(srcs).toEqual(ART_FILES.map((f) => `${B}sprites/${f}`));
  expect(cuts, 'une image chargée garde son src').toEqual([]);
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

test.each(ART_FILES)('%s seule en échec : cette pièce manque, les 12 autres sont chargées, jamais d’exception', async (file) => {
  const art = await loadArt({ base: '/', makeImage: fakeImages([file]).makeImage });
  expect(art.failed).toEqual([file]);
  expect(art.loaded).toEqual(ART_FILES.filter((f) => f !== file));
  // Une carrosserie manque seule, la roue et l'étoile seules ; une flamme manquante fait tomber les 4 (animation par code).
  expect(art.bodies.size).toBe(file === bodyFile(GALAHAD.id) || PILOTS.some((p) => bodyFile(p.id) === file) ? 6 : 7);
  expect(art.wheel === null).toBe(file === 'wheel.png');
  expect(art.star === null).toBe(file === 'star.png');
  expect(art.flames === null).toBe(FLAME_FILES.includes(file));
  if (art.flames) expect(art.flames).toHaveLength(4);
});

test('NO_ART : la table des carrosseries ne se modifie pas (partagée par tous les Renderer)', () => {
  const bodies = NO_ART.bodies as unknown as Map<string, CanvasImageSource>;
  expect(() => bodies.set('galahad', {} as CanvasImageSource)).toThrow();
  expect(() => bodies.clear()).toThrow();
  expect(NO_ART.bodies.size).toBe(0);
  expect(NO_ART.bodies.get('galahad')).toBeUndefined();
  expect(NO_ART.bodies.has('galahad')).toBe(false);
  expect([...NO_ART.bodies]).toEqual([]);
  expect([...NO_ART.bodies.keys()]).toEqual([]);
  expect(Object.isFrozen(NO_ART.loaded) && Object.isFrozen(NO_ART.failed)).toBe(true);
});

describe('délai d’abandon par image (ART_TIMEOUT_MS)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  /**
   * Faux `Image` : chaque fichier répond (`onload`) après `delays[fichier]` ms ; 'jamais' : ni `load` ni `error` ; absent :
   * tout de suite. `removeAttribute('src')` coupe la requête (la réponse en attente est annulée, comme dans un navigateur)
   * sauf si `honourCut` est faux (une requête qu'on ne sait pas annuler : sa réponse tardive arrive quand même). `cuts` note
   * chaque coupure (adresse, instant) ; `images` rend le faux objet de chaque fichier.
   */
  function slowImages(delays: Record<string, number | 'jamais'>, honourCut = true) {
    const cuts: { url: string; at: number }[] = [];
    const images = new Map<string, { onload: unknown; onerror: unknown }>();
    const makeImage = (): HTMLImageElement => {
      const img = {
        onload: null as (() => void) | null, onerror: null as (() => void) | null, url: '',
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
        set src(v: string) {
          this.url = v;
          images.set(v.split('/').pop()!, this);
          const d = Object.entries(delays).find(([f]) => v.endsWith(`/${f}`))?.[1] ?? 0;
          if (d !== 'jamais') this.timer = setTimeout(() => this.onload?.(), d);
        },
        removeAttribute(name: string) {
          if (name !== 'src') return;
          cuts.push({ url: this.url, at: Date.now() });
          if (honourCut) clearTimeout(this.timer);
        },
      };
      return img as unknown as HTMLImageElement;
    };
    return { makeImage, cuts, images };
  }

  /** Lance `loadArt`, avance le temps de `ms` et rend l'état : l'Art s'il est résolu, la promesse, les coupures et les images. */
  async function runFor(delays: Record<string, number | 'jamais'>, ms: number, honourCut = true) {
    const fake = slowImages(delays, honourCut);
    let art: Art | undefined;
    const p = loadArt({ base: B, makeImage: fake.makeImage }).then((a) => { art = a; });
    await vi.advanceTimersByTimeAsync(ms);
    return { art: () => art, p, ...fake };
  }

  test('une image qui ne répond jamais : null au bout du délai, sa requête coupée, les 12 autres chargées, la promesse se résout', async () => {
    const { art, p, cuts, images } = await runFor({ 'wheel.png': 'jamais' }, ART_TIMEOUT_MS - 1);
    expect(art(), 'pas résolue avant le délai').toBeUndefined();
    expect(cuts, 'requête encore vivante avant le délai').toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    // Échec rapide si le délai régresse : sans cette assertion, `await p` attendrait le délai du test (180 s).
    expect(art(), 'résolue au délai').toBeDefined();
    await p;
    const a = art()!;
    expect(a.wheel).toBeNull();
    expect(a.failed).toEqual(['wheel.png']);
    expect(a.loaded).toHaveLength(12);
    expect(a.bodies.size).toBe(7);
    expect(a.flames).toHaveLength(4);
    expect(a.star).not.toBeNull();
    // La requête abandonnée est coupée une fois, au délai : sinon elle reste en vol et retient l'événement `load` de la page.
    expect(cuts).toEqual([{ url: `${B}sprites/wheel.png`, at: Date.now() }]);
    expect(images.get('wheel.png')).toMatchObject({ onload: null, onerror: null });
    expect(vi.getTimerCount(), 'aucune minuterie après la résolution').toBe(0);
  });

  test('plusieurs images muettes : toutes abandonnées et coupées au même délai, jamais plus tard', async () => {
    const { art, p, cuts } = await runFor({ 'wheel.png': 'jamais', 'flame-1.png': 'jamais', 'liam.png': 'jamais' }, ART_TIMEOUT_MS);
    expect(art(), 'résolue au délai').toBeDefined();
    await p;
    expect(art()!.failed).toEqual(['liam.png', 'wheel.png', 'flame-1.png']);
    expect(art()!.flames).toBeNull();
    expect(cuts.map((c) => c.url.split('/').pop()).sort()).toEqual(['flame-1.png', 'liam.png', 'wheel.png']);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('une image qui arrive à temps est gardée, sans attendre le délai, et n’est jamais coupée', async () => {
    const { art, p, cuts } = await runFor({ 'pablo.png': ART_TIMEOUT_MS - 1000 }, ART_TIMEOUT_MS - 1000);
    expect(art(), 'résolue dès l’arrivée de la dernière image').toBeDefined();
    await p;
    expect(art()!.loaded).toEqual(ART_FILES);
    expect(art()!.failed).toEqual([]);
    expect(art()!.bodies.has('pablo')).toBe(true);
    expect(cuts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(ART_TIMEOUT_MS);
    expect(cuts, 'ni plus tard').toEqual([]);
  });

  test('une image qui arrive après le délai reste en échec, même si sa requête ne s’annule pas : son arrivée tardive ne change rien', async () => {
    const { art, p, cuts } = await runFor({ 'star.png': ART_TIMEOUT_MS + 5000 }, ART_TIMEOUT_MS, false);
    expect(art(), 'résolue au délai').toBeDefined();
    await p;
    const a = art()!;
    expect(a.star).toBeNull();
    expect(a.failed).toEqual(['star.png']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(art()).toBe(a);
    expect(a.star).toBeNull();
    expect(cuts).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('tout répond tout de suite : résolu sans attendre le délai, aucune minuterie laissée, aucune coupure', async () => {
    const { art, p, cuts } = await runFor({}, 0);
    expect(art(), 'résolue sans attendre').toBeDefined();
    await p;
    expect(art()!.failed).toEqual([]);
    expect(cuts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('un échec franc (onerror) règle l’image sans attendre le délai et efface sa minuterie', async () => {
    const { makeImage, cuts } = fakeImages(['liam.png']);
    const p = loadArt({ base: B, makeImage });
    await vi.advanceTimersByTimeAsync(0);
    const a = await p;
    expect(a.failed).toEqual(['liam.png']);
    expect(cuts, 'une image en erreur n’a rien à couper').toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
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
  test('propreté : aucun alpha de palette de 240 à 254, aucun liseré rose à alpha partiel (hors liam.png, carrosserie rose)', () => {
    // Le liseré magenta et les alpha 250 des images Grok / du générateur : tools/sprites/lisere.py et controle.py les retirent.
    // Une nouvelle passe (la Terre à la tâche 16, une carrosserie refaite) qui les remettrait ferait échouer ce test.
    for (const f of ART_FILES) {
      const png = readPng8(fs().readFileSync(`${DIR}/${f}`));
      expect(fringeProblems(png, f === 'liam.png'), f).toEqual([]);
    }
  });
  test('carrosseries 512 × 256 px (cadre 2,80 × 1,40 m à 183 px/m) ; roue et flammes carrées', () => {
    for (const f of BODIES) expect(dims(f), f).toEqual([512, 256]);
    for (const f of ['wheel.png', ...FLAME_FILES]) { const [w, h] = dims(f); expect(w, f).toBe(h); }
  });
});
