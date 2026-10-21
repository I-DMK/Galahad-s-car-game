// Ligne d'arrivée (tâche 11 du plan A), réapparitions en course (tâche 10b, ex-respawn-sim) et cas 6
// de l'addendum §1.7 : course complète doigt posé, graines 0 à 4 : chrono figé à l'arrivée, frein,
// arrêt sur le plat avant le mur de fin, 0 réapparition, jamais bloqué, arrivée entre
// FINISH_MIN_SECONDS et FINISH_MAX_SECONDS, 6 à 14 étoiles prises. Suite lente (npm run test:slow) ;
// la seule graine 1 tourne en CI dans tests/race-smoke.test.ts.
import { CONFIG } from '../../src/config';
import { simulateRace } from '../../src/sim/simulate';
import { FINISH_MAX_SECONDS, FINISH_MIN_SECONDS, describeRespawns, trackFor } from '../helpers/runs';

const SEEDS = [0, 1, 2, 3, 4];
const MAX_SECONDS = 240;
const DT = CONFIG.PHYSICS_DT;

describe('doigt toujours posé (cas 6)', () => {
  test.each(SEEDS)(`seed %i : arrivée entre ${FINISH_MIN_SECONDS} et ${FINISH_MAX_SECONDS} s, détectée au bon pas, arrêt avant le mur, 0 réapparition, jamais bloqué, 6 à 14 étoiles`, (seed) => {
    const track = trackFor(seed);
    const r = simulateRace(track, { throttle: () => true, maxSeconds: MAX_SECONDS, cfg: CONFIG });
    const summary = `seed ${seed} : finishedAt=${r.finishedAt?.toFixed(1)} stars=${r.starsTaken.length}/${track.stars.length} `
      + `respawns=${r.respawns.length} maxStuck=${r.maxStuckSeconds.toFixed(2)} [${describeRespawns(r.respawns).join(' ; ')}]`;
    console.log(`cas 6 ${summary}`);
    expect(r.respawns, summary).toEqual([]);
    expect(r.maxStuckSeconds, summary).toBeLessThanOrEqual(2.1);
    expect(r.finishedAt, summary).not.toBeNull();
    const finishedAt = r.finishedAt!;
    expect(finishedAt, summary).toBeGreaterThanOrEqual(FINISH_MIN_SECONDS);
    expect(finishedAt, summary).toBeLessThanOrEqual(FINISH_MAX_SECONDS);
    expect(r.finishes).toBe(1);
    expect(r.starsTaken.length, summary).toBeGreaterThanOrEqual(6);
    expect(r.starsTaken.length, summary).toBeLessThanOrEqual(14);
    expect(r.progressAt(MAX_SECONDS), summary).toBeGreaterThanOrEqual(track.xFinish);

    let tCross = Infinity;
    for (let i = 0; i * DT <= MAX_SECONDS; i++) {
      if (r.progressAt(i * DT) >= track.xFinish) { tCross = i * DT; break; }
    }
    expect(Math.abs(finishedAt - tCross)).toBeLessThanOrEqual(DT + 1e-9);

    const tRest = finishedAt + 10;
    expect(tRest).toBeLessThanOrEqual(MAX_SECONDS);
    const rest = `${summary} x=${r.progressAt(tRest).toFixed(2)} v=${r.speedAt(tRest).toFixed(3)} xWall=${track.xWall.toFixed(1)}`;
    expect(r.progressAt(tRest), rest).toBeLessThan(track.xWall - 1);
    expect(r.speedAt(tRest), rest).toBeLessThan(0.5);
  });
});
