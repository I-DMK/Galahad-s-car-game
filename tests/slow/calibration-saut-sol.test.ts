// Budget : < 10 min mur (mesuré ≈ 4 min 10 s).
// Calibration des étoiles hautes (plan B, tâche 5e, Step 8 (a)) : garde au sol. Galahad seul doigt posé, sans
// jamais sauter, graines 0 à 9, course enregistrée une fois à V_MAX (turbos des étoiles basses seulement), une fois
// avec un turbo forcé 20 m avant chaque candidate. Candidates : union des candidates des 144 jeux. Pour chaque
// hauteur : garde minimale pièces–capteur (m) et prises sans saut (garde ≤ 5 cm), hors ligne (`clearanceProfile`).
// Mesure : seule la fin du balayage est assertée. Sortie : tests/slow/out/calibration-saut-sol.json.
import { generateTrack } from '../../src/track/generate';
import {
  candidateUnion, candidatesOf, clearanceProfile, DEFAULT_JEU, f3, HEIGHTS, isTaken, RECORD_CFG, writeOut,
} from '../helpers/calibration-saut';
import { recordRace, RECORD_TRACK_LENGTH } from '../helpers/recorded';

const SEEDS = Array.from({ length: 10 }, (_, i) => i);

test('garde au sol des étoiles hautes candidates, Galahad seul doigt posé, à V_MAX et en turbo forcé (graines 0 à 9)', () => {
  const rows: { seed: number; x: number; inDefault: boolean; vmax: number[]; turbo: number[] }[] = [];
  for (const seed of SEEDS) {
    const track = generateTrack(seed, RECORD_TRACK_LENGTH, RECORD_CFG);
    const union = candidateUnion(track);
    const defaults = new Set(candidatesOf(track, DEFAULT_JEU).map((x) => x.toFixed(6)));
    const plain = recordRace(seed, { robots: false, cfg: RECORD_CFG });
    const vmax = union.map((x) => clearanceProfile(plain, x).min);
    const turbo = recordRace(seed, { robots: false, cfg: RECORD_CFG, turboBefore: union.map((x) => x - 20) });
    union.forEach((x, i) => {
      rows.push({ seed, x, inDefault: defaults.has(x.toFixed(6)), vmax: vmax[i], turbo: clearanceProfile(turbo, x).min });
    });
  }
  const lines = HEIGHTS.map((h, n) => {
    const all = (sel: (r: typeof rows[number]) => boolean, key: 'vmax' | 'turbo') => {
      const v = rows.filter(sel).map((r) => r[key][n]);
      return { min: Math.min(...v), taken: v.filter(isTaken).length };
    };
    const u = [all(() => true, 'vmax'), all(() => true, 'turbo')];
    const d = [all((r) => r.inDefault, 'vmax'), all((r) => r.inDefault, 'turbo')];
    return `${h.toFixed(2)} m : union ${f3(u[0].min)} / ${f3(u[1].min)} m, prises ${u[0].taken} / ${u[1].taken} ; `
      + `jeu de départ ${f3(d[0].min)} / ${f3(d[1].min)} m, prises ${d[0].taken} / ${d[1].taken}`;
  });
  console.log(`garde au sol (V_MAX / turbo forcé), ${rows.length} candidates (union des 144 jeux, graines 0 à 9), `
    + `dont ${rows.filter((r) => r.inDefault).length} du jeu de départ :\n${lines.join('\n')}`);
  writeOut('calibration-saut-sol', { heights: HEIGHTS, rows });
  expect(rows.length).toBeGreaterThan(10);
  expect(rows.every((r) => r.vmax.every(Number.isFinite) && r.turbo.every(Number.isFinite))).toBe(true);
});
