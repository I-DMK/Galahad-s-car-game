// Suite lente (npm run test:slow) : cas 1 à 5 de l'addendum §1.7 sur les graines 3 à 9, cas 7
// (course « doigt levé 30 % du temps », graines 0 à 9 ; absorbe l'ancien motif 0,7 s / 0,3 s de
// respawn-sim) et le scénario du registre « rampe-saut → plat → volcan avec turbo pris avant la
// rampe-saut » (le plat de lancement absorbe le saut turbo, option (a) de la tâche 1).
import { CONFIG } from '../../src/config';
import { simulateRace, type SimEvent } from '../../src/sim/simulate';
import { nearestVolcanoZone, volcanoAhead } from '../../src/track/query';
import { registerVolcanoCases } from '../helpers/cases';
import { describeRun, f1, liftedPattern, runFrom, trackFor, worldFor } from '../helpers/runs';

const SLOW_SEEDS = [3, 4, 5, 6, 7, 8, 9];
const RACE_SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Cas 7 : part du temps doigt levé, arrivée exigée avant 240 s, au plus 2 réapparitions par volcan. */
const LIFTED_SHARE = 0.3;
const RACE_MAX_SECONDS = 240;
/** Scénario (i) : turbo pris 20 à 60 m avant la rampe-saut, 40 m de plat avant pour être à V_MAX. */
const TURBO_BEFORE_RAMP = [20, 40, 60];
const RUN_UP_BEFORE_TURBO = 40;

registerVolcanoCases({ 1: SLOW_SEEDS, 2: SLOW_SEEDS, 3: SLOW_SEEDS, 4: SLOW_SEEDS, 5: SLOW_SEEDS });

const describeRespawns = (rs: SimEvent[]) =>
  rs.map((e) => (e.type === 'respawn' ? `${e.reason}@t=${e.t.toFixed(1)} x=${e.x.toFixed(1)}→${e.target.x.toFixed(1)}` : e.type));

describe(`cas 7 : course « doigt levé ${LIFTED_SHARE * 100} % du temps » (motif mulberry32(seed) par tranche de 1 s)`, () => {
  test.each(RACE_SEEDS)('seed %i : au plus 2 réapparitions par volcan, jamais bloqué, arrivée avant 240 s', (seed) => {
    const track = trackFor(seed);
    const r = simulateRace(track, { throttle: liftedPattern(seed, LIFTED_SHARE), maxSeconds: RACE_MAX_SECONDS, cfg: CONFIG });
    const perVolcano = new Map<string, number>();
    for (const e of r.respawns) {
      if (e.type !== 'respawn') continue;
      const v = nearestVolcanoZone(track, e.x) ?? volcanoAhead(track, e.x);
      const key = v ? v.xLava.toFixed(1) : 'none';
      perVolcano.set(key, (perVolcano.get(key) ?? 0) + 1);
    }
    const maxPerVolcano = Math.max(0, ...perVolcano.values());
    const summary = `seed ${seed} : volcans=${track.volcanoes.length} finishedAt=${r.finishedAt?.toFixed(1)} respawns=${r.respawns.length} `
      + `(max ${maxPerVolcano} par volcan) stars=${r.starsTaken.length}/${track.stars.length} maxStuck=${r.maxStuckSeconds.toFixed(2)} `
      + `[${describeRespawns(r.respawns).join(' ; ')}]`;
    console.log(`cas 7 ${summary}`);
    for (const [key, n] of perVolcano) expect(n, `volcan ${key} : ${summary}`).toBeLessThanOrEqual(2);
    expect(r.maxStuckSeconds, summary).toBeLessThanOrEqual(2.1);
    expect(r.finishedAt, summary).not.toBeNull();
    expect(r.finishedAt!, summary).toBeLessThan(RACE_MAX_SECONDS);
  });
});

describe('scénario (i) : rampe-saut → plat → volcan, turbo pris 20 à 60 m avant la rampe-saut', () => {
  test.each(RACE_SEEDS)('seed %i : pas de lave, atterrissage sur le plat de réception', (seed) => {
    const world = worldFor(seed);
    const { track } = world;
    const { slices } = track;
    let patterns = 0;
    for (let i = 0; i + 2 < slices.length; i++) {
      if (slices[i].type !== 'rampe-saut' || slices[i + 1].type !== 'plat' || slices[i + 2].type !== 'rampe-volcan') continue;
      const ramp = slices[i];
      const v = track.volcanoes.find((vv) => vv.xLancement === slices[i + 2].xStart)!;
      patterns++;
      for (const before of TURBO_BEFORE_RAMP) {
        const turboAt = ramp.xStart - before;
        let x0 = Math.max(1, turboAt - RUN_UP_BEFORE_TURBO);
        // Jamais au départ dans la zone d'un volcan précédent : on repart de son plat de réception.
        for (const vv of track.volcanoes) if (x0 >= vv.xLancement && x0 < vv.xReception) x0 = vv.xReception;
        const r = runFrom(world, x0, { throttle: () => true, turboAt, maxSeconds: 40 });
        const where = describeRun(seed, v, `rampe-saut en ${f1(ramp.xStart)} (plat de ${f1(slices[i + 1].xEnd - slices[i + 1].xStart)} m), turbo à −${before} m, départ ${f1(x0)}`, r);
        console.log(`scénario (i) ${where}`);
        expect(r.lava, where).toBe(false);
        expect(r.landX, where).not.toBeNull();
        expect(r.landX!, where).toBeGreaterThanOrEqual(v.xReception);
        expect(r.landX!, where).toBeLessThan(v.xEnd);
        expect(r.flipped, where).toBe(false);
        expect(r.wheelsBelow, where).toBe(true);
      }
    }
    console.log(`scénario (i) seed ${seed} : ${patterns} motif(s) rampe-saut → plat → volcan`);
  });
});
