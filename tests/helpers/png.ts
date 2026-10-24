// Lecture minimale d'un PNG à palette (les PNG-8 de public/sprites) sous node, sans dépendance : en-tête, palette
// avec son alpha (PLTE + tRNS) et pixels (zlib du système, via `process.getBuiltinModule`, comme tests/helpers/phases.ts :
// pas de @types/node). Les sommes de contrôle ne sont pas vérifiées. Sert aux tests des images (tâche 8b, tour 1) : propreté
// du liseré, centre de l'étoile.

interface NodeZlib { inflateSync(b: Uint8Array): Uint8Array; deflateSync(b: Uint8Array): Uint8Array }
const zlib = (): NodeZlib => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:zlib'): NodeZlib } }).process.getBuiltinModule('node:zlib');

export interface PaletteEntry { r: number; g: number; b: number; a: number }

export interface Png8 {
  width: number;
  height: number;
  bitDepth: number;
  /** Une entrée par couleur de la palette ; `a` vient de tRNS (255 pour les entrées qu'il ne couvre pas). */
  palette: PaletteEntry[];
  /** Indice de palette de chaque pixel, ligne par ligne (width × height). */
  indices(): Uint8Array;
}

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const u32 = (b: Uint8Array, i: number): number => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** Lit un PNG à palette (type 3, sans entrelacement) ; lève sur tout autre PNG. */
export function readPng8(bytes: Uint8Array): Png8 {
  if (SIGNATURE.some((v, i) => bytes[i] !== v)) throw new Error('pas un PNG');
  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0;
  let plte: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  for (let i = 8; i < bytes.length;) {
    const n = u32(bytes, i);
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const data = bytes.subarray(i + 8, i + 8 + n);
    if (type === 'IHDR') { width = u32(data, 0); height = u32(data, 4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    i += 12 + n;
  }
  if (colorType !== 3 || !plte) throw new Error(`PNG à palette attendu (type ${colorType})`);
  if (interlace !== 0) throw new Error('PNG entrelacé non pris en charge');
  const palette: PaletteEntry[] = [];
  for (let i = 0; i < plte.length / 3; i++) palette.push({ r: plte[3 * i], g: plte[3 * i + 1], b: plte[3 * i + 2], a: trns && i < trns.length ? trns[i] : 255 });
  return { width, height, bitDepth, palette, indices: () => decodeIndices(idat, width, height, bitDepth) };
}

function decodeIndices(idat: Uint8Array[], width: number, height: number, bitDepth: number): Uint8Array {
  const all = new Uint8Array(idat.reduce((s, d) => s + d.length, 0));
  idat.reduce((o, d) => { all.set(d, o); return o + d.length; }, 0);
  const raw = zlib().inflateSync(all);
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const rows = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowBytes + 1)];
    const src = y * (rowBytes + 1) + 1;
    const dst = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const a = x > 0 ? rows[dst + x - 1] : 0; // octets par pixel : 1 (palette)
      const b = y > 0 ? rows[dst - rowBytes + x] : 0;
      const c = x > 0 && y > 0 ? rows[dst - rowBytes + x - 1] : 0;
      let p: number;
      switch (filter) {
        case 0: p = 0; break;
        case 1: p = a; break;
        case 2: p = b; break;
        case 3: p = (a + b) >> 1; break;
        case 4: p = paeth(a, b, c); break;
        default: throw new Error(`filtre PNG inconnu : ${filter}`);
      }
      rows[dst + x] = (raw[src + x] + p) & 255;
    }
  }
  if (bitDepth === 8) return rows;
  // 1, 2 ou 4 bits par pixel : un indice par pixel, bits de poids fort d'abord.
  const out = new Uint8Array(width * height);
  const mask = (1 << bitDepth) - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const bit = x * bitDepth;
      out[y * width + x] = (rows[y * rowBytes + (bit >> 3)] >> (8 - bitDepth - (bit & 7))) & mask;
    }
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Construit un PNG à palette 8 bits (sommes de contrôle à zéro : `readPng8` ne les vérifie pas). `filters` : le type de
 * filtre de chaque ligne (0 à 4, 0 par défaut), appliqué pour de vrai, pour tester le décodeur.
 */
export function makePng8(width: number, height: number, palette: PaletteEntry[], indices: ArrayLike<number>, filters: number[] = []): Uint8Array {
  const chunk = (type: string, data: number[] | Uint8Array): number[] => {
    const n = data.length;
    return [n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255, ...[...type].map((ch) => ch.charCodeAt(0)), ...data, 0, 0, 0, 0];
  };
  const raw: number[] = [];
  for (let y = 0; y < height; y++) {
    const f = filters[y] ?? 0;
    raw.push(f);
    for (let x = 0; x < width; x++) {
      const v = indices[y * width + x];
      const a = x > 0 ? indices[y * width + x - 1] : 0;
      const b = y > 0 ? indices[(y - 1) * width + x] : 0;
      const c = x > 0 && y > 0 ? indices[(y - 1) * width + x - 1] : 0;
      const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
      raw.push((v - p) & 255);
    }
  }
  const alphas = palette.map((e) => e.a);
  while (alphas.length && alphas[alphas.length - 1] === 255) alphas.pop();
  return Uint8Array.from([
    ...SIGNATURE,
    ...chunk('IHDR', [width >>> 24, (width >> 16) & 255, (width >> 8) & 255, width & 255, height >>> 24, (height >> 16) & 255, (height >> 8) & 255, height & 255, 8, 3, 0, 0, 0]),
    ...chunk('PLTE', palette.flatMap((e) => [e.r, e.g, e.b])),
    ...(alphas.length ? chunk('tRNS', alphas) : []),
    ...chunk('IDAT', zlib().deflateSync(Uint8Array.from(raw))),
    ...chunk('IEND', []),
  ]);
}

/** Pixel « rose » du liseré magenta : r − g > 40 et b − g > 40 (même critère que tools/sprites/lisere.py). */
export const isPink = (e: PaletteEntry): boolean => e.r - e.g > 40 && e.b - e.g > 40;

/**
 * Défauts de propreté d'une image de public/sprites (tâche 8b, tour 1) : une entrée de palette d'alpha 240 à 254 (le
 * générateur livre 250 à 254 au lieu de 255 : `controle.py` et `lisere.py` les passent à 255) ; une entrée rose
 * visible à alpha partiel (16 à 254 : un liseré magenta, comme `lisere.py` en mesure) sauf si `pinkAllowed` (la carrosserie
 * rose de `liam.png` en a de légitimes). Les entrées rose d'alpha < 16 sont invisibles et ne comptent pas.
 */
export function fringeProblems(png: Png8, pinkAllowed = false): string[] {
  const problems: string[] = [];
  png.palette.forEach((e, i) => {
    if (e.a >= 240 && e.a <= 254) problems.push(`entrée ${i} : alpha ${e.a} (240 à 254)`);
    if (!pinkAllowed && isPink(e) && e.a >= 16 && e.a <= 254) problems.push(`entrée ${i} : rose (${e.r}, ${e.g}, ${e.b}) à alpha partiel ${e.a}`);
  });
  return problems;
}

/** Centre de gravité de l'alpha (px, repère de l'image, centre du pixel en i + 0,5) : l'alpha de chaque pixel pèse son poids. */
export function alphaCentroid(png: Png8): { x: number; y: number } {
  const idx = png.indices();
  let sum = 0, sx = 0, sy = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const a = png.palette[idx[y * png.width + x]].a;
      sum += a; sx += a * (x + 0.5); sy += a * (y + 0.5);
    }
  }
  return { x: sx / sum, y: sy / sum };
}
