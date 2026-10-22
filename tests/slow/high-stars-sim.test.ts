// Budget : < 25 min mur (mesuré au Step 14 : (i) 5,4 min, (iii) 1,8 min, ≈ 8 min en tout avec (ii) et (iv)).
// Acceptation des étoiles hautes des plats étoile (plan B, tâche 5e, Step 14 ; addendum « bouton saut » §4 et §6.6,
// ruling R-F12) :
// (i) 5 voitures doigt posé sans saut, turbo compris, graines 0 à 23 : 0 étoile haute prise par Galahad ; un copain ne
//     la prend sans saut que dans les 2 s après un contact entre voitures (« catapulte », observateur
//     `carPairsTouching`) : ces prises sont comptées et imprimées ; une prise sans contact échoue ;
// (ii) Galahad seul, turbo forcé tous les 5 m de [x★ − 80, x★ − 20], graines 0 à 9 : 0 prise ;
// (iii) chaque étoile de plat étoile des graines 0 à 9 : fenêtre ≥ 0,4 s à 11,2 et 14 m/s, ≥ 0,3 s à + 5 cm, sans
//     réapparition (`windowFor`) ; centre imprimé (futur JUMP_STAR_LEAD) ;
// (iv) chaque plat étoile précédé de bosses ou d'une double-bosse (graines 0 à 49) : élan à 21 m/s tenus sur la
//     tranche précédente, 0 prise sans saut.
import { CONFIG } from '../../src/config';
import { carPairsTouching, simulateRace } from '../../src/sim/harness';
import type { Star, Track } from '../../src/track/types';
import { jumpRun, RUN_UP, windowFor, flatJumpTrajectory } from '../helpers/jump-runs';
import { croppedWorld } from '../helpers/phases';
import { trackFor } from '../helpers/runs';

/** s : une prise d'étoile haute sans saut par un copain n'est tolérée que dans cette durée après un contact (R-F12). */
const CATAPULT_WINDOW = 2;
const f2 = (n: number): string => (Number.isFinite(n) ? n.toFixed(2) : '—');
const flatStars = (t: Track): Star[] => t.stars.filter((s) => s.high);

test('(i) 5 voitures doigt posé sans saut, graines 0 à 23 : 0 étoile haute prise par Galahad, copains seulement catapultés', () => {
  const t0 = performance.now();
  const catapults: string[] = [];
  const failures: string[] = [];
  for (let seed = 0; seed < 24; seed++) {
    const track = trackFor(seed);
    const highIds = new Set(flatStars(track).map((s) => s.id));
    const lastContact = new Map<string, number>();
    const r = simulateRace(track, {
      throttle: () => true, maxSeconds: 240, cfg: CONFIG, robots: true,
      onStep: (sim) => {
        for (const [a, b] of carPairsTouching(sim)) { lastContact.set(a, sim.time); lastContact.set(b, sim.time); }
        for (const e of sim.events) {
          if (e.type === 'respawn') lastContact.delete(e.carId);
          if (e.type !== 'star' || !highIds.has(e.id)) continue;
          const c = lastContact.get(e.carId);
          const what = `g${seed} ${e.carId} étoile ${e.id} t = ${e.t.toFixed(2)} s, dernier contact ${c === undefined ? 'aucun' : `${(e.t - c).toFixed(2)} s avant`}`;
          if (e.carId !== 'galahad' && c !== undefined && e.t - c <= CATAPULT_WINDOW) catapults.push(what);
          else failures.push(what);
        }
      },
    });
    expect(r.lavaByCar.galahad, `g${seed}`).toBe(0);
    expect(r.highStarsByCar.galahad, `g${seed}`).toEqual([]);
  }
  console.log(`(i) 24 courses à 5 voitures (${((performance.now() - t0) / 60_000).toFixed(1)} min) : copains catapultés ${catapults.length}`
    + `${catapults.length ? ` (${catapults.join(' ; ')})` : ''} ; prises sans contact ${failures.length}`);
  expect(failures).toEqual([]);
});

test('(ii) Galahad seul, turbo forcé tous les 5 m de [x★ − 80, x★ − 20], graines 0 à 9 : 0 prise sans saut', () => {
  let runs = 0;
  const taken: string[] = [];
  for (let seed = 0; seed < 10; seed++) {
    const track = trackFor(seed);
    for (const star of flatStars(track)) {
      const world = croppedWorld(track, CONFIG, star.x - 120, star.x + 120);
      for (let d = 80; d >= 20; d -= 5) {
        const r = jumpRun(world, { x0: star.x - 100, v: CONFIG.V_MAX, jumpAtStep: null, maxSeconds: 12, stars: [star], turboAtX: [star.x - d], stopAtX: star.x + 30 });
        runs++;
        if (r.starTaken.length > 0) taken.push(`g${seed} étoile x = ${star.x.toFixed(1)}, turbo à x★ − ${d}`);
      }
    }
  }
  console.log(`(ii) ${runs} runs en turbo forcé : prises ${taken.length}`);
  expect(runs).toBe(10 * 3 * 13);
  expect(taken).toEqual([]);
});

test('(iii) étoiles des plats étoile, graines 0 à 9 : fenêtre ≥ 0,4 s à 11,2 et 14 m/s, ≥ 0,3 s à + 5 cm, sans réapparition', () => {
  const t0 = performance.now();
  const trajs = new Map([CONFIG.V_CRUISE, CONFIG.V_MAX].map((v) => [v, flatJumpTrajectory(v, CONFIG)]));
  const rows: { seed: number; x: number; v: number; w: number; up: number; lead: number; respawn: boolean }[] = [];
  for (let seed = 0; seed < 10; seed++) {
    const track = trackFor(seed);
    for (const star of flatStars(track)) {
      const world = croppedWorld(track, CONFIG, star.x - RUN_UP - 15, star.x + 14 * 9 + 30);
      for (const v of [CONFIG.V_CRUISE, CONFIG.V_MAX]) {
        const w = windowFor(world, star, v, CONFIG, trajs.get(v));
        const up = windowFor(world, { ...star, y: star.y + 0.05 }, v, CONFIG, trajs.get(v));
        rows.push({ seed, x: star.x, v, w: w.seconds, up: up.seconds, lead: w.centreLead, respawn: w.respawnSeen || up.respawnSeen });
      }
    }
  }
  const at = (v: number) => rows.filter((r) => r.v === v);
  const leads = rows.map((r) => r.lead).sort((a, b) => a - b);
  console.log(`(iii) ${rows.length / 2} étoiles (${((performance.now() - t0) / 60_000).toFixed(1)} min) : fenêtre min 11,2 / 14 m/s `
    + `${f2(Math.min(...at(CONFIG.V_CRUISE).map((r) => r.w)))} / ${f2(Math.min(...at(CONFIG.V_MAX).map((r) => r.w)))} s, `
    + `à + 5 cm ${f2(Math.min(...rows.map((r) => r.up)))} s ; centre ${f2(leads[0])} à ${f2(leads[leads.length - 1])} s avant l'étoile`);
  for (const r of rows) {
    const where = `g${r.seed} étoile x = ${r.x.toFixed(1)} à ${r.v} m/s`;
    expect(r.w, where).toBeGreaterThanOrEqual(0.4);
    expect(r.up, where).toBeGreaterThanOrEqual(0.3);
    expect(r.respawn, where).toBe(false);
  }
  expect(rows).toHaveLength(10 * 3 * 2);
});

test('(iv) plats étoile après bosses ou double-bosse, graines 0 à 49 : élan à 21 m/s tenus, 0 prise sans saut', () => {
  let runs = 0;
  const taken: string[] = [];
  for (let seed = 0; seed < 50; seed++) {
    const track = trackFor(seed);
    track.slices.forEach((sl, i) => {
      if (sl.type !== 'plat-étoile') return;
      const prev = track.slices[i - 1];
      if (prev.type !== 'bosses' && prev.type !== 'double-bosse') return;
      const star = flatStars(track).find((s) => s.x >= sl.xStart && s.x <= sl.xEnd)!;
      const world = croppedWorld(track, CONFIG, prev.xStart - 30, sl.xEnd + 60);
      const r = jumpRun(world, { x0: prev.xStart, v: 21, jumpAtStep: null, maxSeconds: 10, stars: [star], stopAtX: star.x + 30 });
      runs++;
      if (r.starTaken.length > 0) taken.push(`g${seed} ${prev.type} → étoile x = ${star.x.toFixed(1)}`);
    });
  }
  console.log(`(iv) ${runs} plats étoile après bosses ou double-bosse, élan à 21 m/s : prises ${taken.length}`);
  expect(runs).toBeGreaterThan(20);
  expect(taken).toEqual([]);
});
