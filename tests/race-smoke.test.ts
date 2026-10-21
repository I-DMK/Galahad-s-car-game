// Cas 6 de l'addendum §1.7 pour la CI : une seule course complète doigt posé (graine 1, ≈ 20 s).
// Graines 0 à 4 : tests/slow/finish.test.ts.
import { CONFIG } from '../src/config';
import { simulateRace } from '../src/sim/simulate';
import { FINISH_MAX_SECONDS, FINISH_MIN_SECONDS, describeRespawns, trackFor } from './helpers/runs';

const SEED = 1;
const MAX_SECONDS = 180;

test(`cas 6, seed ${SEED} : course doigt posé sans réapparition, arrivée entre ${FINISH_MIN_SECONDS} et ${FINISH_MAX_SECONDS} s, 6 à 14 étoiles prises`, () => {
  const track = trackFor(SEED);
  const r = simulateRace(track, { throttle: () => true, maxSeconds: MAX_SECONDS, cfg: CONFIG });
  const summary = `finishedAt=${r.finishedAt?.toFixed(1)} stars=${r.starsTaken.length}/${track.stars.length} respawns=${r.respawns.length} `
    + `maxStuck=${r.maxStuckSeconds.toFixed(2)} [${describeRespawns(r.respawns).join(' ; ')}]`;
  console.log(`cas 6 seed ${SEED} : ${summary}`);
  expect(r.respawns, summary).toEqual([]);
  expect(r.finishedAt, summary).not.toBeNull();
  expect(r.finishedAt!, summary).toBeGreaterThanOrEqual(FINISH_MIN_SECONDS);
  expect(r.finishedAt!, summary).toBeLessThanOrEqual(FINISH_MAX_SECONDS);
  expect(r.starsTaken.length, summary).toBeGreaterThanOrEqual(6);
  expect(r.starsTaken.length, summary).toBeLessThanOrEqual(14);
  expect(r.maxStuckSeconds, summary).toBeLessThanOrEqual(2.1);
});
