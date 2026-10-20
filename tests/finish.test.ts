// Ligne d'arrivée (tâche 11) : chrono figé à l'arrivée, frein, arrêt sur le plat avant le mur de fin.
import { CONFIG } from '../src/config';
import { simulateRace } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';

const SEEDS = [0, 1, 2, 3, 4];
const TRACK_LENGTH = 1680;
const MAX_SECONDS = 240;
const DT = CONFIG.PHYSICS_DT;

describe('doigt toujours posé', () => {
  test.each(SEEDS)('seed %i : arrivée en < 240 s, détectée au bon pas, arrêt avant le mur', (seed) => {
    const track = generateTrack(seed, TRACK_LENGTH, CONFIG);
    const r = simulateRace(track, { throttle: () => true, maxSeconds: MAX_SECONDS, cfg: CONFIG });
    expect(r.finishedAt).not.toBeNull();
    const finishedAt = r.finishedAt!;
    expect(finishedAt).toBeLessThan(MAX_SECONDS);
    expect(r.finishes).toBe(1);

    let tCross = Infinity;
    for (let i = 0; i * DT <= MAX_SECONDS; i++) {
      if (r.progressAt(i * DT) >= track.xFinish) { tCross = i * DT; break; }
    }
    expect(Math.abs(finishedAt - tCross)).toBeLessThanOrEqual(DT + 1e-9);

    const tRest = finishedAt + 10;
    expect(tRest).toBeLessThanOrEqual(MAX_SECONDS);
    const summary = `finishedAt=${finishedAt.toFixed(2)} x=${r.progressAt(tRest).toFixed(2)} v=${r.speedAt(tRest).toFixed(3)} xWall=${track.xWall.toFixed(1)}`;
    expect(r.progressAt(tRest), summary).toBeLessThan(track.xWall - 1);
    expect(r.speedAt(tRest), summary).toBeLessThan(0.5);
    expect(r.respawns).toEqual([]);
  });
});
