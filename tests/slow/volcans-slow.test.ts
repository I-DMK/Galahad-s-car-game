// Suite lente (npm run test:slow) : cas 1 à 5 et turbo permanent. Les scénarios à trajectoire unique
// (cas 1, cas 2 au pire point sûr, cas 4 ; même vitesse au sommet à 3e-6 près sur les 43 volcans des
// graines 0 à 9, voir helpers/cases.ts) sont déjà joués en CI : une seule graine ici (3), le rejouer
// ailleurs serait un pur doublon. Les scénarios qui varient avec la piste (cas 2 au début du plat de
// lancement, cas 5, turbo permanent : la roue arrière part de la tranche précédente) tournent sur
// tous les volcans des graines 0 à 9 (la CI n'en joue que le premier des graines 0 à 2) ; le cas 3 sur
// tous les volcans des graines 4 à 9 (0 à 3 en CI). Cas 7 (course « doigt levé 30 % du
// temps », graines 0 à 9 ; absorbe l'ancien motif 0,7 s / 0,3 s de respawn-sim) et le scénario du
// registre « rampe-saut → plat → volcan avec turbo pris avant la rampe-saut » (le plat de lancement
// absorbe le saut turbo, option (a) de la tâche 1).
// Budget : ≈ budget d'avant (≈ 7 min) + 5 min (tâche 5g). Tâche 5g : cas 1 à 5 et (i) sur les tremplins seuls ; cas 7
// « au plus 2 chutes par série » (une fosse ratée sans saut fait 2 chutes, la 2e pose la voiture après) ; scénario
// (ii) double-bosse, une tranche, puis tremplin (plus de tremplin juste après une double-bosse, décision du papa), turbo
// pris à chaque 2 m avant et sur la double-bosse, doigt posé : 0 chute (promesse des tremplins), et son témoin ; scénario (iii) rampe-saut → plat → fosse, turbo pris avant la rampe-saut : lave sans saut, passage
// avec le saut parfait (`fosseJumpWanted`).
import { CONFIG } from '../../src/config';
import { simulateRace } from '../../src/sim/harness';
import { nearestVolcanoZone, tremplins, volcanoAhead } from '../../src/track/query';
import type { Tremplin } from '../../src/track/types';
import { passesVolcano, registerVolcanoCases } from '../helpers/cases';
import { fosseRun } from '../helpers/fosses';
import { croppedWorld } from '../helpers/phases';
import { lavaSeries } from '../helpers/race';
import { describeRespawns, describeRun, f1, liftedPattern, runFrom, trackFor, worldFor } from '../helpers/runs';
import type { Fosse } from '../../src/track/types';

/** Cas 3 : graines 4 à 9 (0 à 3 en CI ; tour 1 de la 5g, la graine 3 passe en CI : les graines 0 à 2 n'ont plus de tremplin après des bosses). */
const SLOW_SEEDS = [4, 5, 6, 7, 8, 9];
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

/** Motifs rampe-saut → plat → rampe-volcan (tremplin) de la piste : indice de la rampe-saut et tremplin visé. */
function rampPlatVolcano(seed: number): { i: number; v: Tremplin }[] {
  const track = trackFor(seed);
  const { slices } = track;
  const found: { i: number; v: Tremplin }[] = [];
  for (let i = 0; i + 2 < slices.length; i++) {
    if (slices[i].type !== 'rampe-saut' || slices[i + 1].type !== 'plat' || slices[i + 2].type !== 'rampe-volcan') continue;
    const v = tremplins(track).find((vv) => vv.xLancement === slices[i + 2].xStart);
    if (v) found.push({ i, v });
  }
  return found;
}

describe(`cas 7 : course « doigt levé ${LIFTED_SHARE * 100} % du temps » (motif mulberry32(seed) par tranche de 1 s)`, () => {
  test.each(RACE_SEEDS)('seed %i : au plus 2 chutes par série, jamais bloqué, arrivée avant 240 s', (seed) => {
    const track = trackFor(seed);
    // Galahad seul (défaut `robots: false`, plan A) ; arrêt à l'arrivée + FINISH_COAST_SECONDS.
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
    // Tâche 5g : une fosse ratée sans saut fait 2 chutes, puis la voiture est posée après ; au plus 2 chutes par série,
    // et au plus 3 réapparitions au même volcan (une série de 2 et une autre raison).
    const series = lavaSeries(r.respawns.filter((e) => e.type === 'respawn'), track);
    expect(Math.max(0, ...series), `séries ${series.join(' ')} : ${summary}`).toBeLessThanOrEqual(2);
    for (const [key, n] of perVolcano) expect(n, `volcan ${key} : ${summary}`).toBeLessThanOrEqual(3);
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
        // Jamais au départ dans la zone d'un volcan précédent : on repart de son plat de réception (`startAfter`).
        const x0 = startAfter(track, Math.max(1, turboAt - RUN_UP_BEFORE_TURBO));
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

/**
 * Départ hors de la zone d'un volcan précédent (garde d'une fosse comprise) et assez loin après sa lave pour que la
 * roue arrière n'y soit pas (tâche 5g : un départ au bord aval exact d'une fosse touchait la lave au premier pas) :
 * décalé à xReception + 5.
 */
function startAfter(track: ReturnType<typeof trackFor>, x: number): number {
  let x0 = x;
  for (const v of track.volcanoes) {
    const from = v.kind === 'fosse' ? v.xLancement - CONFIG.FOSSE_GUARD : v.xLancement;
    if (x0 >= from && x0 < v.xReception + 5) x0 = v.xReception + 5;
  }
  return x0;
}

/** Tranches i, i + 1 (et i + 2) d'une piste dont les types sont donnés, et le volcan qui suit. */
function pattern(seed: number, types: string[]): { i: number; track: ReturnType<typeof trackFor> }[] {
  const track = trackFor(seed);
  const out: { i: number; track: typeof track }[] = [];
  for (let i = 0; i + types.length <= track.slices.length; i++) {
    if (types.every((t, k) => track.slices[i + k].type === t)) out.push({ i, track });
  }
  return out;
}

const PATTERN_SEEDS = Array.from({ length: 50 }, (_, i) => i);

/**
 * Scénario (ii), tâche 5g, tour 1 (décision du papa : pas de tremplin juste après une double-bosse). Le balayage de la
 * phase 1 (double-bosse puis tremplin, 1 568 runs) trouvait 3 chutes doigt posé, une seule trajectoire : turbo pris
 * 31,8 m avant la double-bosse, il finit pendant son vol, sommet du tremplin ≈ 11,2 m/s. La règle supprime ce motif ;
 * le balayage porte sur les tremplins qui suivent une double-bosse à une tranche d'écart (bosses ou plat entre les
 * deux), même turbo tous les 2 m : **0 chute**, sans tolérance. Témoin (pistes avec la règle levée,
 * `TREMPLIN_AFTER_DOUBLE_BOSSE: 1`) : la trajectoire de la phase 1 tombe toujours.
 */
describe('scénario (ii) : double-bosse, une tranche, puis tremplin ; turbo pris tous les 2 m de 80 m avant la double-bosse jusqu’à sa fin, doigt posé : 0 chute', () => {
  test(`graines 0 à 49 : chaque double-bosse suivie d'une tranche puis d'un tremplin`, () => {
    const t0 = performance.now();
    let runs = 0;
    let motifs = 0;
    const fails: string[] = [];
    let minLip = Infinity;
    for (const seed of PATTERN_SEEDS) {
      const track = trackFor(seed);
      expect(pattern(seed, ['double-bosse', 'rampe-volcan']), `graine ${seed} : tremplin juste après une double-bosse`).toEqual([]);
      for (let i = 0; i + 2 < track.slices.length; i++) {
        if (track.slices[i].type !== 'double-bosse' || track.slices[i + 2].type !== 'rampe-volcan') continue;
        motifs++;
        const db = track.slices[i];
        const v = tremplins(track).find((w) => Math.abs(w.xLancement - track.slices[i + 2].xStart) < 1e-9)!;
        const x0 = startAfter(track, Math.max(5, db.xStart - 100));
        const world = croppedWorld(track, CONFIG, x0 - 10, v.xEnd + 20);
        for (let t = Math.max(x0, db.xStart - 80); t <= db.xEnd + 1e-9; t += 2) {
          const r = runFrom(world, x0, { throttle: () => true, launchSpeed: CONFIG.V_MAX, turboAt: t, maxSeconds: 25, volcano: v });
          runs++;
          minLip = Math.min(minLip, r.lipSpeed ?? 0);
          if (!passesVolcano(r, v)) fails.push(describeRun(seed, v, `double-bosse en ${f1(db.xStart)}, ${track.slices[i + 1].type}, turbo en ${f1(t)}`, r));
        }
      }
    }
    console.log(`scénario (ii) : ${motifs} motifs, ${runs} runs (${((performance.now() - t0) / 60_000).toFixed(1)} min), sommet min ${f1(minLip)} m/s, échecs ${fails.length}`
      + `${fails.length ? `\n  ${fails.join('\n  ')}` : ''}`);
    expect(runs).toBeGreaterThan(500);
    expect(fails, fails.join('\n')).toEqual([]);
  });

  test('témoin, règle levée (graine 7) : double-bosse puis tremplin, turbo pris 31,8 m avant la double-bosse, chute', () => {
    // Pistes du tour 1 de la 5g, règle levée : poids de tirage des volcans d'avant le tour 2 (3).
    const cfg = { ...CONFIG, TREMPLIN_AFTER_DOUBLE_BOSSE: 1, VOLCANO_WEIGHT: 3 };
    const track = trackFor(7, cfg);
    const i = track.slices.findIndex((sl, k) => sl.type === 'double-bosse' && track.slices[k + 1]?.type === 'rampe-volcan');
    expect(i).toBeGreaterThan(0);
    const db = track.slices[i];
    const v = tremplins(track).find((w) => Math.abs(w.xLancement - track.slices[i + 1].xStart) < 1e-9)!;
    const x0 = startAfter(track, Math.max(5, db.xStart - 100));
    const world = croppedWorld(track, cfg, x0 - 10, v.xEnd + 20);
    const r = runFrom(world, x0, { throttle: () => true, launchSpeed: CONFIG.V_MAX, turboAt: db.xStart - 31.8, maxSeconds: 25, volcano: v });
    const where = describeRun(7, v, `règle levée, double-bosse en ${f1(db.xStart)}, turbo en ${f1(db.xStart - 31.8)}`, r);
    console.log(`scénario (ii), témoin : ${where}`);
    expect(passesVolcano(r, v), where).toBe(false);
  });
});

describe('scénario (iii) : rampe-saut → plat → fosse, turbo pris 20 à 60 m avant la rampe-saut : lave sans saut, passage avec le saut parfait', () => {
  test('graines 0 à 49 : chaque motif', () => {
    const rows: string[] = [];
    let n = 0;
    for (const seed of PATTERN_SEEDS) {
      for (const { i, track } of pattern(seed, ['rampe-saut', 'plat', 'fosse'])) {
        const ramp = track.slices[i];
        const f = track.volcanoes.find((w): w is Fosse => w.kind === 'fosse' && Math.abs(w.xLancement - CONFIG.FOSSE_GUARD - track.slices[i + 2].xStart) < 1e-9)!;
        for (const before of TURBO_BEFORE_RAMP) {
          const turboAtX = ramp.xStart - before;
          const x0 = startAfter(track, Math.max(5, turboAtX - RUN_UP_BEFORE_TURBO));
          const world = croppedWorld(track, CONFIG, x0 - 10, f.xEnd + 20);
          const base = { x0, v: CONFIG.V_MAX, turboAtX, fosse: f, maxSeconds: 25, stopAtX: f.xReception + 5 };
          const none = fosseRun(world, { ...base, pressAtStep: null });
          const jump = fosseRun(world, { ...base, pressAtStep: 'voulu', stopAtX: undefined });
          n++;
          const where = `g${seed} rampe-saut en ${f1(ramp.xStart)} (plat de ${f1(track.slices[i + 1].xEnd - track.slices[i + 1].xStart)} m), turbo à −${before} m : `
            + `sans saut ${none.lava ? 'lave' : none.respawn ? 'autre réapparition' : 'SURVOL'}, saut parfait ${jump.passed ? 'passe' : 'ÉCHEC'} `
            + `(saut à ${jump.jumpX === null ? '—' : f1(f.xBord - jump.jumpX)} m du bord, à ${f1(jump.jumpSpeed)} m/s, atterrissage à ${jump.landX === null ? '—' : f1(jump.landX - f.xReception)} m)`;
          rows.push(where);
          expect(none.lava, where).toBe(true);
          expect(jump.passed, where).toBe(true);
        }
      }
    }
    console.log(`scénario (iii) : ${n} runs\n  ${rows.join('\n  ')}`);
    expect(n).toBeGreaterThan(0);
  });
});
