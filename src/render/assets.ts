// Chargeur des images du jeu (tâche 8b ; addendum « présentation » §1.2) : 7 carrosseries, la roue,
// 4 flammes et l'étoile, servies depuis `public/sprites/` sous `import.meta.env.BASE_URL` (le site vit sous
// `/Galahad-s-car-game/`). Le chargement ne lève jamais : une image en échec devient `null` et la pièce
// correspondante est dessinée par code (repli de `render/car.ts`). Une image qui ne répond pas passe à `null` au bout de
// `ART_TIMEOUT_MS` : elle ne retient ni les 12 autres ni l'événement `load` de la page. Les noms de fichiers sont en ASCII
// (`timothe.png` pour l'id `timothé`) : adresses sans encodage `%C3%A9`, pas de piège NFC/NFD.
import { GALAHAD, PILOTS } from '../cars/pilots';

export interface Art {
  /** Carrosseries chargées, par id de pilote ('galahad', 'timothé'…) ; un pilote absent = carrosserie par code. */
  readonly bodies: ReadonlyMap<string, CanvasImageSource>;
  readonly wheel: CanvasImageSource | null;
  /** Les 4 images de flamme dans l'ordre, ou null si l'une manque (animation par code). */
  readonly flames: readonly CanvasImageSource[] | null;
  readonly star: CanvasImageSource | null;
  /** Fichiers chargés et en échec, dans l'ordre d'ART_FILES (`__game.art`, e2e). */
  readonly loaded: readonly string[];
  readonly failed: readonly string[];
}

/**
 * Carrosseries de `NO_ART` : une table vide en lecture seule. Une vraie `Map` figée resterait modifiable (`set` agit sur
 * l'état interne, pas sur ses propriétés) ; cet objet n'a aucun mutateur, et NO_ART est partagé par tous les `Renderer`.
 */
const NO_BODIES: ReadonlyMap<string, CanvasImageSource> = Object.freeze({
  size: 0,
  get: (_id: string): CanvasImageSource | undefined => undefined,
  has: (_id: string): boolean => false,
  forEach: (): void => {},
  keys: () => new Map<string, CanvasImageSource>().keys(),
  values: () => new Map<string, CanvasImageSource>().values(),
  entries: () => new Map<string, CanvasImageSource>().entries(),
  [Symbol.iterator]: () => new Map<string, CanvasImageSource>()[Symbol.iterator](),
});

/** Rien de chargé : le jeu se dessine entièrement par code. */
export const NO_ART: Art = Object.freeze({
  bodies: NO_BODIES,
  wheel: null,
  flames: null,
  star: null,
  loaded: Object.freeze([] as string[]),
  failed: Object.freeze([] as string[]),
});

/** Nom du fichier de carrosserie d'un pilote : son id sans accents + '.png' ('timothé' → 'timothe.png'). */
export function bodyFile(pilotId: string): string {
  return `${pilotId.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.png`;
}

export const FLAME_FILES: readonly string[] = ['flame-0.png', 'flame-1.png', 'flame-2.png', 'flame-3.png'];

const DRIVERS = [GALAHAD, ...PILOTS];

/**
 * Délai d'abandon d'une image (ms) : sans `load` ni `error` passé ce délai, elle compte comme en échec (`null`, repli par
 * code). Un navigateur finit en général par l'un des deux, mais un réseau qui stagne retiendrait sinon `loadArt` et
 * l'événement `load` de la page (tâche 8b, tour 1 : ruling R8b-4).
 */
export const ART_TIMEOUT_MS = 8000;

/** Tous les fichiers chargés : carrosseries de Galahad puis des copains, la roue, les flammes, l'étoile. */
export const ART_FILES: readonly string[] = [...DRIVERS.map((p) => bodyFile(p.id)), 'wheel.png', ...FLAME_FILES, 'star.png'];

export interface LoadArtOptions {
  /** Préfixe des adresses ; par défaut `import.meta.env.BASE_URL`. */
  base?: string;
  /** Fabrique d'image ; par défaut `new Image()` (un faux sert aux tests). */
  makeImage?: () => HTMLImageElement;
}

/**
 * Une image, ou `null` en cas d'échec (erreur, délai de `ART_TIMEOUT_MS` écoulé, ou `makeImage` qui lève) : la promesse
 * ne rejette jamais. La minuterie est effacée dès que l'image est réglée ; une image qui arrive après le délai est
 * ignorée (ses gestionnaires sont retirés).
 */
function loadOne(url: string, makeImage: () => HTMLImageElement): Promise<CanvasImageSource | null> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let img: HTMLImageElement | undefined;
    const done = (result: CanvasImageSource | null): void => {
      clearTimeout(timer);
      if (img) img.onload = img.onerror = null;
      resolve(result);
    };
    try {
      img = makeImage();
      const loading = img;
      img.onload = () => done(loading);
      img.onerror = () => done(null);
      timer = setTimeout(() => done(null), ART_TIMEOUT_MS);
      img.src = url;
    } catch {
      done(null);
    }
  });
}

/**
 * Charge les 13 images en parallèle et se résout quand toutes sont réglées (`load`, `error` ou délai d'abandon de chacune,
 * soit au plus `ART_TIMEOUT_MS`). Ne rejette jamais.
 */
export async function loadArt(opts: LoadArtOptions = {}): Promise<Art> {
  const base = opts.base ?? import.meta.env.BASE_URL;
  const makeImage = opts.makeImage ?? (() => new Image());
  const imgs = await Promise.all(ART_FILES.map((f) => loadOne(`${base}sprites/${f}`, makeImage)));
  const byFile = new Map(ART_FILES.map((f, i) => [f, imgs[i]]));

  const bodies = new Map<string, CanvasImageSource>();
  for (const p of DRIVERS) {
    const img = byFile.get(bodyFile(p.id));
    if (img) bodies.set(p.id, img);
  }
  const flames = FLAME_FILES.map((f) => byFile.get(f) ?? null);
  return {
    bodies,
    wheel: byFile.get('wheel.png') ?? null,
    flames: flames.every((f) => f !== null) ? (flames as CanvasImageSource[]) : null,
    star: byFile.get('star.png') ?? null,
    loaded: ART_FILES.filter((f) => byFile.get(f)),
    failed: ART_FILES.filter((f) => !byFile.get(f)),
  };
}
