// Fenêtres de saut des fosses des vraies pistes (plan B, tâche 5g, Step 6 ; addendum « bouton saut » §6.2, ruling
// R-F17) : pour chaque fosse des graines données, `fosseWindow` (chaque pas des 1,6 s avant la chute du témoin) à
// 11,2 et 14 m/s tenus (b), au départ arrêté au pire point sûr (c), et lancée à 14 m/s avec un turbo pris 40 m avant le
// bord (d). Fenêtre principale ≥ 0,4 s d'un seul tenant ; `fosseJumpLead(v)` à moins de 0,05 s du centre mesuré à
// vitesse tenue (écart imprimé au départ arrêté et en turbo, saut §6.8) ; (d) tout saut qui passe atterrit avant
// `xEnd − 10`.
import { fosseJumpLead } from '../../src/cars/jump';
import { CONFIG } from '../../src/config';
import { fosses } from '../../src/track/query';
import { fosseWindow, type FosseWindow } from './fosses';
import { croppedWorld } from './phases';
import { trackFor } from './runs';

const MIN_WINDOW = 0.4;
const LEAD_TOLERANCE = 0.05;

interface Row { seed: number; fi: number; name: string; v: number | 'arrêt'; w: FosseWindow; lead: number | null }

const f2 = (n: number): string => (Number.isFinite(n) ? n.toFixed(2) : '—');

export function registerFosseWindows(seeds: readonly number[]): void {
  const rows: Row[] = [];
  const t0 = performance.now();
  for (const seed of seeds) {
    const track = trackFor(seed);
    fosses(track).forEach((f, fi) => {
      const world = croppedWorld(track, CONFIG, f.xBord - 80, f.xEnd + 20);
      const cases: [string, number | 'arrêt', { turboAtX?: number }][] = [
        ['(b) 11,2 m/s', CONFIG.V_CRUISE, {}],
        ['(b) 14 m/s', CONFIG.V_MAX, {}],
        ['(c) arrêt au pire point sûr', 'arrêt', {}],
        ['(d) turbo 40 m avant le bord', CONFIG.V_MAX, { turboAtX: f.xBord - 40 }],
      ];
      test.each(cases)(`graine ${seed}, fosse ${fi} (bord en ${f.xBord.toFixed(1)}) : %s`, (name, v, opts) => {
        const w = fosseWindow(world, f, v, opts);
        const held = typeof v === 'number' && opts.turboAtX === undefined;
        const lead = typeof v === 'number' ? fosseJumpLead(v, CONFIG) : null;
        rows.push({ seed, fi, name, v, w, lead });
        const where = `graine ${seed}, fosse ${fi}, ${name} : fenêtre ${f2(w.seconds)} s (${w.pieces} morceaux : `
          + `${w.pieceList.map((p) => `${f2(p.seconds)} s de ${f2(p.leadFrom)} à ${f2(p.leadTo)} s avant le bord`).join(' ; ')}), `
          + `s ∈ [${f2(w.sMin)} ; ${f2(w.sMax)}] m, centre ${f2(w.centreLead)} s${lead === null ? '' : ` (fosseJumpLead ${f2(lead)} s)`}, `
          + `atterrissage jusqu'à ${f2(w.landMax)} m après le bord aval, ${w.runs} runs`;
        console.log(where);
        expect(w.seconds, where).toBeGreaterThanOrEqual(MIN_WINDOW - 1e-9);
        if (held) expect(Math.abs(w.centreLead - lead!), where).toBeLessThanOrEqual(LEAD_TOLERANCE);
        if (opts.turboAtX !== undefined) expect(w.landMax, where).toBeLessThan(f.xEnd - 10 - f.xReception);
      });
    });
  }
  afterAll(() => {
    const by = (name: string) => rows.filter((r) => r.name === name);
    const lines = [...new Set(rows.map((r) => r.name))].map((name) => {
      const ws = by(name).map((r) => r.w.seconds).sort((a, b) => a - b);
      const gaps = by(name).filter((r) => r.lead !== null).map((r) => r.w.centreLead - r.lead!);
      return `${name} : ${ws.length} fosses, fenêtre min ${f2(ws[0])} s, médiane ${f2(ws[Math.floor(ws.length / 2)])} s, max ${f2(ws[ws.length - 1])} s ; `
        + `centre ${f2(Math.min(...by(name).map((r) => r.w.centreLead)))} à ${f2(Math.max(...by(name).map((r) => r.w.centreLead)))} s`
        + (gaps.length ? ` (écart au fosseJumpLead ${f2(Math.min(...gaps))} à ${f2(Math.max(...gaps))} s)` : '')
        + ` ; morceaux max ${Math.max(...by(name).map((r) => r.w.pieces))} ; atterrissage max ${f2(Math.max(...by(name).map((r) => r.w.landMax)))} m après le bord aval`;
    });
    console.log(`fenêtres des fosses, graines ${seeds.join(', ')} (${((performance.now() - t0) / 60_000).toFixed(1)} min) :\n${lines.join('\n')}`);
  });
}
