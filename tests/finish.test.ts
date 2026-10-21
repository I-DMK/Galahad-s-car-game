// Ligne d'arrivée (tâche 11) : chrono figé à l'arrivée, frein, arrêt sur le plat avant le mur de fin.
import { CONFIG } from '../src/config';
import { simulateRace } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import type { Track } from '../src/track/types';

const SEEDS = [0, 1, 2, 3, 4];
const TRACK_LENGTH = 1680;
const MAX_SECONDS = 240;
const DT = CONFIG.PHYSICS_DT;

/**
 * Transition tâche 1 → 2 : les étoiles « 1 m avant une rampe-saut » du plan A (addendum §1.5 : plus
 * admissibles, retirées par la tâche 2) lancent un saut turbo de ≈ 50 m par-dessus la rampe-saut qui
 * précède un volcan v2 (graine 4 : atterrissage au bout du plat de lancement, rebond, lave). On les
 * retire des courses doigt posé ; toutes les autres étoiles (et leur turbo) restent jouées.
 */
function withoutPlanAJumpStars(track: Track): Track {
  const ramps = track.slices.filter((s) => s.type === 'rampe-saut');
  track.stars = track.stars.filter((s) => !ramps.some((r) => Math.abs(s.x - (r.xStart - 1)) < 1e-6));
  return track;
}

describe('doigt toujours posé', () => {
  test.each(SEEDS)('seed %i : arrivée en < 240 s, détectée au bon pas, arrêt avant le mur', (seed) => {
    const track = withoutPlanAJumpStars(generateTrack(seed, TRACK_LENGTH, CONFIG));
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
