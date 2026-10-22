// Budget : < 25 min mur (mesuré : 22 min 26 s, dont passe 1 11,4 min ; marge faible, à scinder si le runner est plus lent).
// Calibration des étoiles hautes (plan B, tâche 5e, Step 8 (b)) : fenêtre de décollage. Une trajectoire de saut
// sur le plat par vitesse (`flatJumpTrajectory` à 11,2 et 14 m/s ; 21 m/s pour information) donne la fenêtre
// géométrique prédite ; puis, pour chaque candidate du jeu de départ des graines 0 à 9, dichotomie des deux bords
// en simulation réelle (`windowFor`, monde rogné, ≈ 14 runs par étoile, par vitesse et par hauteur) : fenêtre (s),
// centre en temps avant l'étoile (futur JUMP_STAR_LEAD de la tâche 6), réapparition vue à l'atterrissage.
// Hauteurs 3,60 à 4,10 m (4,10 = 4,05 + 5 cm). Hauteur retenue par ce fichier (H*) : la plus haute où toutes ces
// fenêtres tiennent 0,3 s aux deux vitesses, à H* et à H* + 5 cm ; puis, à H* et H* + 5 cm, fenêtres des positions
// de toutes les candidates des 144 jeux (graines 0 à 9). Les prises sans saut sont jugées par les autres fichiers.
// Mesure : seule la fin du balayage est assertée. Sortie : tests/slow/out/calibration-saut-fenetres.json.
import { CONFIG } from '../../src/config';
import type { World } from '../../src/physics/world';
import { generateTrack } from '../../src/track/generate';
import { heightAt } from '../../src/track/query';
import type { Star, Track } from '../../src/track/types';
import { candidateUnion, candidatesOf, DEFAULT_JEU, f2, f3, HEIGHTS, RECORD_CFG, writeOut } from '../helpers/calibration-saut';
import { flatJumpTrajectory, predictedWindow, RUN_UP, windowFor, type JumpWindow } from '../helpers/jump-runs';
import { croppedWorld } from '../helpers/phases';
import { RECORD_TRACK_LENGTH } from '../helpers/recorded';

const SEEDS = Array.from({ length: 10 }, (_, i) => i);
const SPEEDS = [CONFIG.V_CRUISE, CONFIG.V_MAX];
const INFO_SPEED = 21;
const WINDOW_HEIGHTS = [...HEIGHTS, 4.1];
const MIN_WINDOW = 0.3;

interface Row { seed: number; x: number; h: number; v: number; w: JumpWindow }

const tracks = new Map<number, Track>();
const trackOf = (seed: number): Track => {
  let t = tracks.get(seed);
  if (!t) { t = generateTrack(seed, RECORD_TRACK_LENGTH, RECORD_CFG); tracks.set(seed, t); }
  return t;
};
/** Dernier monde rogné (un seul gardé : un monde de piste complète pèse ≈ 8 400 corps). */
let lastWorld: { key: string; world: World } | null = null;
/** Monde rogné autour de l'étoile : élan (RUN_UP), vol et 3 s après l'atterrissage à 21 m/s. */
const worldOf = (seed: number, x: number): World => {
  const key = `${seed}:${x.toFixed(6)}`;
  if (lastWorld?.key !== key) {
    lastWorld = { key, world: croppedWorld(trackOf(seed), CONFIG, x - RUN_UP - 15, x + INFO_SPEED * 9 + 30) };
  }
  return lastWorld.world;
};
const starAt = (seed: number, x: number, h: number): Star => ({ id: 0, x, y: heightAt(trackOf(seed), x) + h, high: true });

test('fenêtre de décollage des étoiles hautes : prédite, puis réelle par dichotomie (graines 0 à 9)', () => {
  const t0 = performance.now();
  const trajs = new Map([...SPEEDS, INFO_SPEED].map((v) => [v, flatJumpTrajectory(v, CONFIG)]));
  const predicted = [...trajs].map(([v, traj]) => ({
    v,
    byHeight: WINDOW_HEIGHTS.map((h) => {
      const p = predictedWindow(traj, h, CONFIG);
      return { h, seconds: Number.isNaN(p.sMin) ? 0 : (p.sMax - p.sMin) / v, sMin: p.sMin, sMax: p.sMax };
    }),
  }));
  console.log(`fenêtre géométrique prédite (s) :\n${predicted.map((p) => `${p.v} m/s : ${p.byHeight.map((b) => `${b.h.toFixed(2)} ${f3(b.seconds)}`).join(' ; ')}`).join('\n')}`);

  // Passe 1 : candidates du jeu de départ, toutes les hauteurs, trois vitesses.
  const defaults = SEEDS.flatMap((seed) => candidatesOf(trackOf(seed), DEFAULT_JEU).map((x) => ({ seed, x })));
  const pass1: Row[] = [];
  for (const { seed, x } of defaults) {
    for (const h of WINDOW_HEIGHTS) {
      for (const v of [...SPEEDS, INFO_SPEED]) {
        pass1.push({ seed, x, h, v, w: windowFor(worldOf(seed, x), starAt(seed, x, h), v, CONFIG, trajs.get(v)) });
      }
    }
  }
  const minAt = (rows: Row[], h: number, v: number): number =>
    Math.min(...rows.filter((r) => Math.abs(r.h - h) < 1e-9 && r.v === v).map((r) => r.w.seconds));
  const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const table = WINDOW_HEIGHTS.map((h) => {
    const at = pass1.filter((r) => Math.abs(r.h - h) < 1e-9 && SPEEDS.includes(r.v));
    return {
      h, min112: minAt(pass1, h, SPEEDS[0]), min14: minAt(pass1, h, SPEEDS[1]), min21: minAt(pass1, h, INFO_SPEED),
      median: median(at.map((r) => r.w.seconds)), lead: median(at.filter((r) => r.w.seconds > 0).map((r) => r.w.centreLead)),
      respawns: pass1.filter((r) => Math.abs(r.h - h) < 1e-9 && r.w.respawnSeen).length,
    };
  });
  const ok = (h: number): boolean => {
    const row = table.find((r) => Math.abs(r.h - h) < 1e-9);
    return !!row && row.min112 >= MIN_WINDOW && row.min14 >= MIN_WINDOW;
  };
  const hStar = [...HEIGHTS].reverse().find((h) => ok(h) && ok(Math.round((h + 0.05) * 100) / 100)) ?? NaN;
  console.log(`fenêtre réelle, ${defaults.length} candidates du jeu de départ (graines 0 à 9) : hauteur, min à 11,2 / 14 m/s (21 m/s pour info), `
    + `médiane (11,2 et 14), centre médian en temps avant l'étoile, réapparitions vues :\n`
    + table.map((r) => `${r.h.toFixed(2)} m : ${f3(r.min112)} / ${f3(r.min14)} s (${f3(r.min21)}), médiane ${f3(r.median)} s, `
      + `centre ${f2(r.lead)} s, réapparitions ${r.respawns}`).join('\n')
    + `\nH* (plus haute hauteur tenant ${MIN_WINDOW} s aux deux vitesses, à H* et H* + 5 cm) : ${f2(hStar)} m ; `
    + `${pass1.reduce((a, r) => a + r.w.runs, 0)} runs, ${((performance.now() - t0) / 60_000).toFixed(1)} min`);

  // Passe 2 : toutes les positions candidates des 144 jeux, à H* et H* + 5 cm, deux vitesses.
  const pass2: Row[] = [];
  if (Number.isFinite(hStar)) {
    const union = SEEDS.flatMap((seed) => candidateUnion(trackOf(seed)).map((x) => ({ seed, x })));
    for (const { seed, x } of union) {
      for (const h of [hStar, Math.round((hStar + 0.05) * 100) / 100]) {
        for (const v of SPEEDS) {
          const known = pass1.find((r) => r.seed === seed && Math.abs(r.x - x) < 1e-6 && Math.abs(r.h - h) < 1e-9 && r.v === v);
          pass2.push(known ?? { seed, x, h, v, w: windowFor(worldOf(seed, x), starAt(seed, x, h), v, CONFIG, trajs.get(v)) });
        }
      }
    }
    const low = pass2.filter((r) => r.w.seconds < MIN_WINDOW);
    console.log(`passe 2 : ${union.length} positions (144 jeux, graines 0 à 9) à ${f2(hStar)} et +5 cm : min `
      + `${f3(Math.min(...pass2.map((r) => r.w.seconds)))} s, sous ${MIN_WINDOW} s : ${low.length} `
      + `(${low.map((r) => `g${r.seed} x ${r.x.toFixed(1)} ${r.h.toFixed(2)} m ${r.v} m/s ${f3(r.w.seconds)}`).join(' ; ')}) ; `
      + `${((performance.now() - t0) / 60_000).toFixed(1)} min au total`);
  }
  writeOut('calibration-saut-fenetres', { predicted, table, hStar, pass1, pass2 });
  expect(pass1.length).toBe(defaults.length * WINDOW_HEIGHTS.length * 3);
  expect(defaults.length).toBeGreaterThan(5);
});
