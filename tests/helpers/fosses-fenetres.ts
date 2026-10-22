// Fenêtres de saut d'une fosse (plan B, tâche 5g, Step 6 ; addendum « bouton saut » §6.2, ruling R-F17 ; tour 1 de la
// 5g, relecture adversariale 2). Les fosses des vraies pistes sont toutes les mêmes (garde, approche, lave, réception) :
// les 18 fosses des graines 0 à 9 ne donnaient que 4 trajectoires. On balaie donc UNE fosse (`fossePiste`) et on fait
// varier ce qui change la trajectoire : la vitesse tenue, le départ arrêté au pire point sûr, la distance du turbo au
// bord amont, la tranche d'avant prise en turbo (recette du saut §6.2 (a)) et un saut d'étoile haute juste avant.
// Chaque cas : `fosseWindow` (un appui à chaque pas des 1,6 s avant la chute du témoin, prolongé par blocs de 0,4 s
// jusqu'à 2,8 s si la fenêtre déborde : un turbo qui finit dans la fenêtre la fait durer jusqu'à 1,85 s), départ 3,5 s
// avant le bord sur du plat, sinon lancé 20 m avant la tranche d'avant, le turbo et le saut préalable. Fenêtre
// principale ≥ 0,4 s d'un seul tenant ; à vitesse tenue sur du plat, `fosseJumpLead(v)` à moins de 0,05 s du centre mesuré ; en turbo,
// tout saut qui passe atterrit avant `xEnd − 10` ; saut préalable : il a lieu et retombe avant la fenêtre.
import { fosseJumpLead } from '../../src/cars/jump';
import { CONFIG } from '../../src/config';
import { createWorld, type World } from '../../src/physics/world';
import { mulberry32 } from '../../src/track/rng';
import { bosses, doubleBosse, type SliceProfile } from '../../src/track/slices';
import type { Fosse } from '../../src/track/types';
import { fossePiste, fosseWindow, type FosseWindow } from './fosses';

export const MIN_WINDOW = 0.4;
export const LEAD_TOLERANCE = 0.05;

/**
 * Tranche d'avant la fosse : 'plat' (rien de plus que le plat de 150 m) ou k de la recette du saut §6.2 (a) : k = 0,
 * une double-bosse ; k = 1 à 10, `bosses(mulberry32(500 + k))` ; k = 11 à 15, `bosses` puis `doubleBosse` sur le même rng.
 */
export type Before = 'plat' | number;

export interface WindowCase {
  name: string;
  before: Before;
  /** Lancée tenue (m/s) ou départ arrêté au pire point sûr. */
  v: number | 'arrêt';
  /** Turbo pris à cette distance (m) avant le bord amont. */
  turboBefore?: number;
  /** Saut d'étoile haute à cette distance (m) avant le bord amont. */
  preJumpBefore?: number;
}

const beforeProfiles = (b: Before): SliceProfile[] => {
  if (b === 'plat') return [];
  const rng = mulberry32(500 + b);
  if (b === 0) return [doubleBosse(rng, CONFIG)];
  return b <= 10 ? [bosses(rng, CONFIG)] : [bosses(rng, CONFIG), doubleBosse(rng, CONFIG)];
};

export const beforeLabel = (b: Before): string =>
  b === 'plat' ? 'plat' : b === 0 ? 'double-bosse (k = 0)' : b <= 10 ? `bosses (k = ${b})` : `bosses + double-bosse (k = ${b})`;

const worlds = new Map<Before, { world: World; f: Fosse; beforeStart: number }>();
/** Monde de la fosse précédée de `before` (mis en cache), et le début des tranches d'avant. */
export function windowWorld(b: Before): { world: World; f: Fosse; beforeStart: number } {
  let w = worlds.get(b);
  if (!w) {
    const { track, f } = fossePiste({ before: beforeProfiles(b) });
    w = { world: createWorld(track, CONFIG), f, beforeStart: track.slices[1].xStart };
    worlds.set(b, w);
  }
  return w;
}

const f2 = (n: number | null): string => (n !== null && Number.isFinite(n) ? n.toFixed(2) : '—');

interface Row { c: WindowCase; w: FosseWindow; lead: number | null }

/** Enregistre un test par cas, et un résumé imprimé en fin de fichier. */
export function registerFosseWindows(title: string, cases: readonly WindowCase[]): void {
  const rows: Row[] = [];
  const t0 = performance.now();
  describe(title, () => {
    test.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
      const { world, f, beforeStart } = windowWorld(c.before);
      // Départ : 3,5 s avant le bord (`fosseStart`) sur du plat sans turbo ni saut préalable ; sinon lancé 20 m avant
      // la tranche d'avant, le turbo et le saut préalable.
      const plain = c.before === 'plat' && c.turboBefore === undefined && c.preJumpBefore === undefined;
      const x0 = plain ? undefined : Math.min(
        c.before === 'plat' ? Infinity : beforeStart - 20,
        f.xBord - Math.max(c.turboBefore ?? 0, c.preJumpBefore ?? 0) - 20,
      );
      const opts = {
        turboAtX: c.turboBefore === undefined ? undefined : f.xBord - c.turboBefore,
        preJumpAtX: c.preJumpBefore === undefined ? undefined : f.xBord - c.preJumpBefore,
        x0,
      };
      const w = fosseWindow(world, f, c.v, opts);
      const held = typeof c.v === 'number' && c.turboBefore === undefined && c.before === 'plat' && c.preJumpBefore === undefined;
      const lead = typeof c.v === 'number' && c.turboBefore === undefined ? fosseJumpLead(c.v, CONFIG) : null;
      rows.push({ c, w, lead });
      const where = `${c.name} : fenêtre ${f2(w.seconds)} s (${w.pieces} morceaux : `
        + `${w.pieceList.map((p) => `${f2(p.seconds)} s de ${f2(p.leadFrom)} à ${f2(p.leadTo)} s avant le bord`).join(' ; ')}), `
        + `s ∈ [${f2(w.sMin)} ; ${f2(w.sMax)}] m, centre ${f2(w.centreLead)} s${lead === null ? '' : ` (fosseJumpLead ${f2(lead)} s)`}, `
        + `vitesse ${f2(w.sweepSpeed)} m/s, atterrissage jusqu'à ${f2(w.landMax)} m après le bord aval`
        + `${c.preJumpBefore === undefined ? '' : `, saut préalable à ${f2(w.preJumpX === null ? null : f.xBord - w.preJumpX)} m du bord, retombé à ${f2(w.preLandX === null ? null : f.xBord - w.preLandX)} m`}, ${w.runs} runs`;
      console.log(where);
      expect(w.seconds, where).toBeGreaterThanOrEqual(MIN_WINDOW - 1e-9);
      if (held) expect(Math.abs(w.centreLead - lead!), where).toBeLessThanOrEqual(LEAD_TOLERANCE);
      if (c.turboBefore !== undefined) expect(w.landMax, where).toBeLessThan(f.xEnd - 10 - f.xReception);
      if (c.preJumpBefore !== undefined) {
        expect(w.preJumpX, where).not.toBeNull();
        expect(w.preLandX, where).not.toBeNull();
        // Retombé avant la fenêtre principale (s au plus tôt = sMax avant le bord).
        expect(f.xBord - w.preLandX!, where).toBeGreaterThan(w.sMax);
      }
    });
  });
  afterAll(() => {
    if (rows.length === 0) return;
    const ws = rows.map((r) => r.w.seconds);
    const worst = rows.reduce((a, b) => (b.w.seconds < a.w.seconds ? b : a));
    const gaps = rows.filter((r) => r.lead !== null).map((r) => r.w.centreLead - r.lead!);
    console.log(`${title} (${((performance.now() - t0) / 60_000).toFixed(1)} min) : ${rows.length} cas, fenêtre min ${f2(Math.min(...ws))} s `
      + `(${worst.c.name}), max ${f2(Math.max(...ws))} s ; centre ${f2(Math.min(...rows.map((r) => r.w.centreLead)))} à `
      + `${f2(Math.max(...rows.map((r) => r.w.centreLead)))} s avant le bord`
      + (gaps.length ? ` (écart au fosseJumpLead ${f2(Math.min(...gaps))} à ${f2(Math.max(...gaps))} s)` : '')
      + ` ; morceaux max ${Math.max(...rows.map((r) => r.w.pieces))} ; atterrissage max ${f2(Math.max(...rows.map((r) => r.w.landMax).filter(Number.isFinite)))} m après le bord aval`);
  });
}
