// Suite lente (npm run test:slow) : cas 1 à 5 et turbo permanent. Les scénarios à trajectoire unique
// (cas 1, cas 2 au pire point sûr, cas 4 ; même vitesse au sommet à 3e-6 près sur les 43 volcans des
// graines 0 à 9, voir helpers/cases.ts) sont déjà joués en CI : une seule graine ici (3), le rejouer
// ailleurs serait un pur doublon. Les scénarios qui varient avec la piste (cas 2 au début du plat de
// lancement, cas 5, turbo permanent : la roue arrière part de la tranche précédente) tournent sur
// tous les volcans des graines 0 à 9 (la CI n'en joue que le premier des graines 0 à 2) ; le cas 3 sur
// tous les volcans des graines 3 à 9 (0 à 2 en CI). Cas 7 (course « doigt levé 30 % du
// temps », graines 0 à 9 ; absorbe l'ancien motif 0,7 s / 0,3 s de respawn-sim) et le scénario du
// registre « rampe-saut → plat → volcan avec turbo pris avant la rampe-saut » (le plat de lancement
// absorbe le saut turbo, option (a) de la tâche 1).
import { CONFIG } from '../../src/config';
import { simulateRace } from '../../src/sim/simulate';
import { nearestVolcanoZone, volcanoAhead } from '../../src/track/query';
import type { Volcano } from '../../src/track/types';
import { registerVolcanoCases } from '../helpers/cases';
import { describeRespawns, describeRun, f1, liftedPattern, runFrom, trackFor, worldFor } from '../helpers/runs';

const SLOW_SEEDS = [3, 4, 5, 6, 7, 8, 9];
const UNIQUE_SEEDS = [3];
const ALL_SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const RACE_SEEDS = ALL_SEEDS;
/** Cas 7 : part du temps doigt levé, arrivée exigée avant 240 s, au plus 2 réapparitions par volcan. */
const LIFTED_SHARE = 0.3;
const RACE_MAX_SECONDS = 240;
/** Scénario (i) : turbo pris 20 à 60 m avant la rampe-saut, 40 m de plat avant pour être à V_MAX. */
const TURBO_BEFORE_RAMP = [20, 40, 60];
const RUN_UP_BEFORE_TURBO = 40;

registerVolcanoCases(
  { 1: UNIQUE_SEEDS, 2: UNIQUE_SEEDS, '2-lancement': ALL_SEEDS, 3: SLOW_SEEDS, 4: UNIQUE_SEEDS, 5: ALL_SEEDS, turbo: ALL_SEEDS },
  ['2-lancement', 3, 5, 'turbo'],
);

/** Motifs rampe-saut → plat → rampe-volcan de la piste : indice de la rampe-saut et volcan visé. */
function rampPlatVolcano(seed: number): { i: number; v: Volcano }[] {
  const track = trackFor(seed);
  const { slices } = track;
  const found: { i: number; v: Volcano }[] = [];
  for (let i = 0; i + 2 < slices.length; i++) {
    if (slices[i].type !== 'rampe-saut' || slices[i + 1].type !== 'plat' || slices[i + 2].type !== 'rampe-volcan') continue;
    found.push({ i, v: track.volcanoes.find((vv) => vv.xLancement === slices[i + 2].xStart)! });
  }
  return found;
}

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
    const found = rampPlatVolcano(seed);
    for (const { i, v } of found) {
      const ramp = slices[i];
      for (const before of TURBO_BEFORE_RAMP) {
        const turboAt = ramp.xStart - before;
        let x0 = Math.max(1, turboAt - RUN_UP_BEFORE_TURBO);
        // Jamais au départ dans la zone d'un volcan précédent : on repart de son plat de réception.
        for (const vv of track.volcanoes) if (x0 >= vv.xLancement && x0 < vv.xReception) x0 = vv.xReception;
        const r = runFrom(world, x0, { throttle: () => true, turboAt, maxSeconds: 40, volcano: v });
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
    console.log(`scénario (i) seed ${seed} : ${found.length} motif(s) rampe-saut → plat → volcan`);
  });
  test(`au moins un motif sur les graines ${RACE_SEEDS.join(', ')} (compté sur les pistes)`, () => {
    const perSeed = RACE_SEEDS.map((seed) => rampPlatVolcano(seed).length);
    expect(perSeed.reduce((a, b) => a + b, 0), `motifs par graine : ${perSeed.join(', ')}`).toBeGreaterThan(0);
  });
});
