// Chargeur des images du jeu (tâche 8b ; addendum « présentation » §1.2) : 7 carrosseries, la roue,
// 4 flammes et l'étoile, servies depuis `public/sprites/` sous `import.meta.env.BASE_URL` (le site vit sous
// `/Galahad-s-car-game/`). Le chargement ne lève jamais : une image en échec devient `null` et la pièce
// correspondante est dessinée par code (repli de `render/car.ts`). Les noms de fichiers sont en ASCII
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

/** Rien de chargé : le jeu se dessine entièrement par code. */
export const NO_ART: Art = Object.freeze({
  bodies: new Map<string, CanvasImageSource>(),
  wheel: null,
  flames: null,
  star: null,
  loaded: Object.freeze([] as string[]),
  failed: Object.freeze([] as string[]),
});

/** Nom du fichier de carrosserie d'un pilote : son id sans accents + '.png' ('timothé' → 'timothe.png'). */
export function bodyFile(pilotId: string): string {
  return `${pilotId.normalize('NFD').replace(/[̀-ͯ]/g, '')}.png`;
}

export const FLAME_FILES: readonly string[] = ['flame-0.png', 'flame-1.png', 'flame-2.png', 'flame-3.png'];

const DRIVERS = [GALAHAD, ...PILOTS];

/** Tous les fichiers chargés : carrosseries de Galahad puis des copains, la roue, les flammes, l'étoile. */
export const ART_FILES: readonly string[] = [...DRIVERS.map((p) => bodyFile(p.id)), 'wheel.png', ...FLAME_FILES, 'star.png'];

export interface LoadArtOptions {
  /** Préfixe des adresses ; par défaut `import.meta.env.BASE_URL`. */
  base?: string;
  /** Fabrique d'image ; par défaut `new Image()` (un faux sert aux tests). */
  makeImage?: () => HTMLImageElement;
}

/** Une image, ou `null` en cas d'échec (y compris si `makeImage` lève) : la promesse ne rejette jamais. */
function loadOne(url: string, makeImage: () => HTMLImageElement): Promise<CanvasImageSource | null> {
  return new Promise((resolve) => {
    try {
      const img = makeImage();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Charge les 13 images en parallèle et se résout quand toutes sont réglées (`load` ou `error` : un navigateur
 * finit toujours par l'un des deux, donc pas de délai d'abandon). Ne rejette jamais.
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
