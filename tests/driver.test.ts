// Conduite des robots (plan B, tâche 6 ; spec §7, addendum §1.8 et §2, addendum « bouton saut » §3 et §6.8) : le driver
// d'un copain, pur, avec un contexte fabriqué à la main (voiture menée à vitesse donnée le long de la piste, sans
// physique). Délai de départ, zone volcan, lever de pied, robots polis, sauts d'étoile haute et de fosse, déterminisme.
// Le câblage dans `stepRace` (contexte réel, garde `inNoJumpZone`) : tests/simulate.test.ts et tests/robots.test.ts.
import { driverSeed, makeRobotDriver, robotDraws, type Driver, type DriverContext } from '../src/ai/driver';
import { fosseJumpLead } from '../src/cars/jump';
import { PILOTS, type Pilot } from '../src/cars/pilots';
import { newCarState, type CarState } from '../src/cars/state';
import { CONFIG } from '../src/config';
import { fosses, inNoJumpZone, sliceAt, tremplins } from '../src/track/query';
import { mulberry32 } from '../src/track/rng';
import { plat } from '../src/track/slices';
import type { Star, Track } from '../src/track/types';
import { fossePiste, trackOf } from './helpers/fosses';
import { trackFor } from './helpers/runs';

const DT = CONFIG.PHYSICS_DT;
const EPS = 1e-9;
const PABLO = PILOTS.find((p) => p.id === 'pablo')!;
/** Pilote d'essai : Pablo, traits surchargés. */
const pilot = (o: Partial<Pilot>): Pilot => ({ ...PABLO, ...o });
const SEED = 12345;
const freshState = (x = 0): CarState => newCarState('essai', 'Essai', '#000000', '#ffffff', { x, y: 0, angle: 0 });
const flat = (length = 400): Track => trackOf([plat(mulberry32(1), CONFIG, length)]);

type Other = { index: number; x: number; speed: number };

/** Contexte comme `stepRace` le remplit (étoile haute et fosse devant, à moins de JUMP_LOOKAHEAD), fabriqué à la main. */
function ctxOf(track: Track, o: { t: number; x: number; v: number; state: CarState; others?: Other[]; available?: boolean }): DriverContext {
  let nextHighStar: DriverContext['nextHighStar'] = null;
  const k = track.stars.findIndex((s) => s.high && s.x > o.x);
  if (k >= 0 && track.stars[k].x - o.x <= CONFIG.JUMP_LOOKAHEAD) nextHighStar = { index: k, x: track.stars[k].x, available: o.available ?? true };
  let nextFosse: DriverContext['nextFosse'] = null;
  const fs = fosses(track);
  const r = fs.findIndex((f) => f.xBord > o.x);
  if (r >= 0 && fs[r].xBord - o.x <= CONFIG.JUMP_LOOKAHEAD) {
    const f = fs[r];
    nextFosse = { xBord: f.xBord, index: r, attempt: o.state.lastRespawnLavaX === f.xLava && o.state.consecutiveRespawns >= 1 ? 2 : 1 };
  }
  return { t: o.t, state: o.state, track, speed: o.v, x: o.x, grounded: true, others: o.others ?? [], nextHighStar, nextFosse };
}

interface Step { t: number; x: number; throttle: boolean; jump: boolean }

/**
 * Mène la voiture de x0 à x1 (exclu) à la vitesse v, un pas de PHYSICS_DT à la fois, depuis t0. `serve` : une demande
 * de saut est servie aussitôt (`state.lastJumpAt` = t, comme `updateJump` sur une voiture au sol) ; sinon jamais.
 */
function drive(
  driver: Driver, track: Track,
  o: { x0: number; x1: number; v: number; t0: number; state: CarState; serve?: boolean; others?: (x: number) => Other[]; available?: boolean },
): Step[] {
  const steps: Step[] = [];
  let t = o.t0;
  for (let x = o.x0; x < o.x1; x += o.v * DT, t += DT) {
    const out = driver(ctxOf(track, { t, x, v: o.v, state: o.state, others: o.others?.(x), available: o.available }));
    steps.push({ t, x, throttle: out.throttle, jump: out.jump });
    if (out.jump && o.serve) o.state.lastJumpAt = t;
  }
  return steps;
}

/** Indices des pas où `pred` est vrai. */
const where = (steps: Step[], pred: (s: Step) => boolean): number[] => steps.flatMap((s, i) => (pred(s) ? [i] : []));

describe('délai de départ', () => {
  test.each([1, 2, 3, 4])('rang %i : ni gaz ni saut tant que t < rang × 0,3 s, doigt posé ensuite (route libre)', (rank) => {
    const track = flat();
    const driver = makeRobotDriver(PABLO, rank, track, SEED, CONFIG);
    const start = rank * CONFIG.START_DELAY_PER_RANK;
    expect(start).toBeCloseTo(rank * 0.3, 12);
    const state = freshState();
    for (let k = 0; k < Math.round((start + 0.5) / DT); k++) {
      const t = k * DT;
      if (Math.abs(t - start) < 1e-6) continue;
      expect(driver(ctxOf(track, { t, x: 50, v: 0, state })), `t = ${t.toFixed(4)}`).toEqual({ throttle: t > start, jump: false });
    }
  });

  test('pendant le délai, même dans la fenêtre d’une fosse : aucune demande de saut', () => {
    const { track, f } = fossePiste();
    const driver = makeRobotDriver(pilot({ jumpSkill: 0 }), 4, track, SEED, CONFIG);
    const x = f.xBord - fosseJumpLead(14, CONFIG) * 14 + 0.5;
    expect(driver(ctxOf(track, { t: 1, x, v: 14, state: freshState() }))).toEqual({ throttle: false, jump: false });
    expect(driver(ctxOf(track, { t: 1.3, x, v: 14, state: freshState() })).jump).toBe(true);
  });
});

describe('zone volcan [xLancement, xLava]', () => {
  test('doigt jamais levé, même avec lift = 1 et une voiture arrêtée juste devant (graines 0 à 9, tremplins et fosses, pas de 0,1 m)', () => {
    let n = 0;
    const bad: string[] = [];
    for (let seed = 0; seed < 10; seed++) {
      const track = trackFor(seed);
      const driver = makeRobotDriver(pilot({ lift: 1 }), 1, track, SEED, CONFIG);
      const state = freshState();
      let t = 1;
      for (const v of track.volcanoes) {
        for (let x = v.xLancement; x <= v.xLava; x += 0.1, t += DT) {
          n++;
          const out = driver(ctxOf(track, { t, x, v: 3, state, others: [{ index: 0, x: x + 2, speed: 0 }] }));
          if (!out.throttle) bad.push(`g${seed} ${v.kind} x = ${x.toFixed(1)}`);
        }
      }
    }
    expect(n).toBeGreaterThan(5000);
    expect(bad).toEqual([]);
  });
});

describe('lever de pied', () => {
  const liftSlices = (track: Track) => track.slices.filter((s) => s.type === 'rampe-saut' || s.type === 'double-bosse');

  test.each([5, 14])('lift = 1, %s m/s : doigt levé 24 pas ± 1 à partir du premier pas dans les 8 m avant chaque rampe-saut et double-bosse (graines 0 à 4)', (v) => {
    let n = 0;
    for (let seed = 0; seed < 5; seed++) {
      const track = trackFor(seed);
      for (const sl of liftSlices(track)) {
        const driver = makeRobotDriver(pilot({ lift: 1 }), 1, track, SEED, CONFIG);
        const steps = drive(driver, track, { x0: sl.xStart - CONFIG.LIFT_LOOKAHEAD - 0.5, x1: sl.xStart + 8, v, t0: 2, state: freshState() });
        const first = steps.findIndex((s) => s.x >= sl.xStart - CONFIG.LIFT_LOOKAHEAD);
        const lifted = where(steps, (s) => !s.throttle);
        const what = `g${seed} ${sl.type} en ${sl.xStart.toFixed(1)} : levé aux pas ${lifted.join(',')} (premier pas dans la zone : ${first})`;
        expect(lifted[0], what).toBe(first);
        expect(lifted.length, what).toBeGreaterThanOrEqual(23);
        expect(lifted.length, what).toBeLessThanOrEqual(25);
        expect(lifted[lifted.length - 1] - lifted[0] + 1, what).toBe(lifted.length);
        n++;
      }
    }
    expect(n).toBeGreaterThan(10);
  });

  test('lift = 1 : une seule fois par tranche, même après un retour en arrière (réapparition)', () => {
    const track = trackFor(0);
    const sl = liftSlices(track)[0];
    const driver = makeRobotDriver(pilot({ lift: 1 }), 1, track, SEED, CONFIG);
    const state = freshState();
    const a = drive(driver, track, { x0: sl.xStart - 10, x1: sl.xStart + 2, v: 14, t0: 2, state });
    state.respawnCount++;
    const b = drive(driver, track, { x0: sl.xStart - 10, x1: sl.xStart + 2, v: 14, t0: 5, state });
    expect(where(a, (s) => !s.throttle).length).toBeGreaterThanOrEqual(23);
    expect(where(b, (s) => !s.throttle)).toEqual([]);
  });

  test('lift = 0 : jamais levé sur toute la piste (graines 0 à 4, route libre)', () => {
    for (let seed = 0; seed < 5; seed++) {
      const track = trackFor(seed);
      const driver = makeRobotDriver(pilot({ lift: 0 }), 1, track, SEED, CONFIG);
      const steps = drive(driver, track, { x0: track.xStart, x1: track.xFinish, v: 14, t0: 1, state: freshState() });
      expect(where(steps, (s) => !s.throttle), `g${seed}`).toEqual([]);
    }
  });
});

describe('robots polis', () => {
  const track = flat();
  const run = (others: Other[], t = 1) => makeRobotDriver(PABLO, 1, track, SEED, CONFIG)(ctxOf(track, { t, x: 100, v: 0, state: freshState(), others }));

  test('voiture devant à 3 m qui roule à 1 m/s : doigt levé', () => {
    expect(run([{ index: 0, x: 103, speed: 1 }]).throttle).toBe(false);
  });

  test('devant à 3 m mais à 5 m/s : doigt posé ; à 6 m : doigt posé ; derrière : doigt posé', () => {
    expect(run([{ index: 0, x: 103, speed: 5 }]).throttle).toBe(true);
    expect(run([{ index: 0, x: 106, speed: 0 }]).throttle).toBe(true);
    expect(run([{ index: 2, x: 97, speed: 0 }]).throttle).toBe(true);
    expect(run([{ index: 2, x: 100, speed: 0 }]).throttle).toBe(true);
  });

  test('dans la zone volcan : doigt posé, même derrière une voiture arrêtée', () => {
    const { track: ft, f } = fossePiste();
    const driver = makeRobotDriver(PABLO, 1, ft, SEED, CONFIG);
    const x = f.xLancement + 2;
    expect(driver(ctxOf(ft, { t: 1, x, v: 0, state: freshState(), others: [{ index: 0, x: x + 3, speed: 0 }] })).throttle).toBe(true);
  });

  test('après 3 s d’attente continue derrière la même voiture, il repart ; l’attente revient à zéro quand elle repart', () => {
    const driver = makeRobotDriver(PABLO, 1, track, SEED, CONFIG);
    const state = freshState();
    const at = (t: number, speed: number, index = 0) => driver(ctxOf(track, { t, x: 100, v: 0, state, others: [{ index, x: 103, speed }] })).throttle;
    const t0 = 1;
    for (let k = 0; k * DT < CONFIG.POLITE_MAX_WAIT - DT / 2; k++) expect(at(t0 + k * DT, 0), `${(k * DT).toFixed(3)} s`).toBe(false);
    expect(at(t0 + CONFIG.POLITE_MAX_WAIT, 0)).toBe(true);
    expect(at(t0 + CONFIG.POLITE_MAX_WAIT + 1, 0)).toBe(true);
    // La voiture de devant repart (5 m/s) : attente remise à zéro ; elle ralentit de nouveau : nouvelle attente.
    expect(at(t0 + 5, 5)).toBe(true);
    expect(at(t0 + 5 + DT, 1)).toBe(false);
    expect(at(t0 + 5 + DT + 2.9, 1)).toBe(false);
    expect(at(t0 + 5 + DT + CONFIG.POLITE_MAX_WAIT, 1)).toBe(true);
    // Une autre voiture lente devant : nouvelle attente.
    expect(at(t0 + 9, 1, 2)).toBe(false);
  });
});

/** Piste de la graine avec, en plus, des étoiles hautes fictives en `xs` (ids et ordre refaits). */
function withHighStars(track: Track, xs: number[]): Track {
  const extra: Star[] = xs.map((x) => ({ id: -1, x, y: 3.9, high: true }));
  const stars = [...track.stars, ...extra].sort((a, b) => a.x - b.x).map((s, id) => ({ ...s, id }));
  return { ...track, stars };
}

describe('saut d’étoile haute', () => {
  const track = trackFor(0);
  const k = track.stars.findIndex((s) => s.high);
  const star = track.stars[k];

  test.each([11.2, 14, 21])('jumpTry 1, jumpSkill 0, %s m/s : demande au premier pas où (xÉtoile − x) / v ≤ JUMP_STAR_LEAD, redemandée jusqu’au passage', (v) => {
    const driver = makeRobotDriver(pilot({ jumpTry: 1, jumpSkill: 0 }), 1, track, SEED, CONFIG);
    const steps = drive(driver, track, { x0: star.x - 39, x1: star.x + 0.5, v, t0: 2, state: freshState() });
    const expected = steps.findIndex((s) => (star.x - s.x) / v <= CONFIG.JUMP_STAR_LEAD + EPS);
    const jumps = where(steps, (s) => s.jump);
    expect(jumps[0]).toBe(expected);
    expect(jumps).toEqual(where(steps, (s, ) => s.x < star.x).slice(expected));
  });

  test('servie : plus aucune demande pour cette étoile ; après une réapparition avant elle, la même décision est rejouée', () => {
    const driver = makeRobotDriver(pilot({ jumpTry: 1, jumpSkill: 0 }), 1, track, SEED, CONFIG);
    const state = freshState();
    const a = drive(driver, track, { x0: star.x - 30, x1: star.x + 0.5, v: 14, t0: 2, state, serve: true });
    expect(where(a, (s) => s.jump)).toHaveLength(1);
    state.respawnCount++;
    const b = drive(driver, track, { x0: star.x - 30, x1: star.x + 0.5, v: 14, t0: 6, state, serve: true });
    expect(where(b, (s) => s.jump)).toEqual(where(a, (s) => s.jump));
  });

  test('jumpTry 0 : jamais ; étoile indisponible pour lui : jamais', () => {
    const never = makeRobotDriver(pilot({ jumpTry: 0, jumpSkill: 0 }), 1, track, SEED, CONFIG);
    expect(where(drive(never, track, { x0: star.x - 39, x1: star.x, v: 14, t0: 2, state: freshState() }), (s) => s.jump)).toEqual([]);
    const taken = makeRobotDriver(pilot({ jumpTry: 1, jumpSkill: 0 }), 1, track, SEED, CONFIG);
    expect(where(drive(taken, track, { x0: star.x - 39, x1: star.x, v: 14, t0: 2, state: freshState(), available: false }), (s) => s.jump)).toEqual([]);
  });

  test('jamais de demande dans inNoJumpZone (tremplins, graines 0 à 19, pas de 0,1 m, étoile fictive juste après chaque réception), ni de saut d’étoile dans une tranche fosse', () => {
    let tremplinsSeen = 0;
    let after = 0;
    const bad: string[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const base = trackFor(seed);
      const xs = base.volcanoes.map((v) => v.xReception + (v.kind === 'tremplin' ? 5 : 30));
      const track = withHighStars(base, xs);
      for (const skill of [0, 0.25]) {
        const driver = makeRobotDriver(pilot({ jumpTry: 1, jumpSkill: skill }), 1, track, seed, CONFIG);
        const state = freshState();
        let t = 1;
        for (const v of track.volcanoes) {
          if (v.kind === 'tremplin') tremplinsSeen++;
          const x1 = v.kind === 'tremplin' ? v.xReception + 5 : v.xEnd;
          for (let x = v.xLancement - 45; x < x1; x += 0.1, t += DT) {
            // Hors de la fenêtre d'une fosse : seul le saut d'étoile peut demander.
            const f = fosses(track).find((ff) => x >= ff.xLancement && x < ff.xBord);
            const out = driver(ctxOf(track, { t, x, v: 14, state }));
            if (!out.jump || f) continue;
            if (inNoJumpZone(track, x)) bad.push(`g${seed} tremplin x = ${x.toFixed(1)} (zone [${v.xLancement.toFixed(1)}, ${v.xReception.toFixed(1)}])`);
            else if (sliceAt(track, x).type === 'fosse') bad.push(`g${seed} étoile demandée dans la tranche fosse, x = ${x.toFixed(1)}`);
            else if (v.kind === 'tremplin' && x > v.xReception && x < v.xReception + 5) after++;
          }
        }
      }
    }
    expect(tremplinsSeen).toBeGreaterThan(20);
    expect(bad).toEqual([]);
    // Le balayage n'est pas vide : l'étoile fictive est demandée dès la sortie de la zone.
    expect(after).toBeGreaterThan(tremplinsSeen);
  });

  test('inNoJumpZone : [xLancement, xReception] des tremplins, jamais sur une tranche fosse (graines 0 à 19)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const track = trackFor(seed);
      for (const v of tremplins(track)) {
        expect(inNoJumpZone(track, v.xLancement)).toBe(true);
        expect(inNoJumpZone(track, v.xReception)).toBe(true);
        expect(inNoJumpZone(track, v.xLancement - 0.01)).toBe(false);
        expect(inNoJumpZone(track, v.xReception + 0.01)).toBe(false);
      }
      for (const sl of track.slices.filter((s) => s.type === 'fosse')) {
        for (let x = sl.xStart; x <= sl.xEnd; x += 0.5) expect(inNoJumpZone(track, x), `g${seed} x = ${x}`).toBe(false);
      }
    }
  });
});

describe('saut de fosse', () => {
  const { track, f } = fossePiste();
  const window = (steps: Step[], v: number, e = 0) => steps.findIndex((s) => s.x >= f.xLancement
    && (f.xBord - s.x) / v <= fosseJumpLead(v, CONFIG) + e + EPS && (f.xBord - s.x) / v > CONFIG.JUMP_BUFFER + EPS);

  test.each([8, 11.2, 14, 21])('jumpSkill 0, %s m/s : demande au premier pas où (xBord − x) / v ≤ fosseJumpLead(v), redemandée à chaque pas jusqu’au saut', (v) => {
    const driver = makeRobotDriver(pilot({ jumpSkill: 0 }), 1, track, SEED, CONFIG);
    const steps = drive(driver, track, { x0: f.xLancement - 10, x1: f.xBord, v, t0: 2, state: freshState() });
    const first = window(steps, v);
    const jumps = where(steps, (s) => s.jump);
    expect(first).toBeGreaterThan(0);
    expect(jumps[0]).toBe(first);
    // Sans saut servi, la demande est refaite à chaque pas, jusqu'à ce que la mémoire de la demande atteigne le bord.
    expect(jumps).toEqual(where(steps, (s) => (f.xBord - s.x) / v > CONFIG.JUMP_BUFFER + EPS).slice(first));
  });

  test('un saut servi : plus aucune demande dans la même approche ; jumpTry = 0 : la fosse est quand même sautée', () => {
    for (const jumpTry of [0, 1]) {
      const driver = makeRobotDriver(pilot({ jumpSkill: 0, jumpTry }), 1, track, SEED, CONFIG);
      const steps = drive(driver, track, { x0: f.xLancement - 10, x1: f.xReception + 10, v: 14, t0: 2, state: freshState(), serve: true });
      expect(where(steps, (s) => s.jump), `jumpTry ${jumpTry}`).toEqual([window(steps, 14)]);
    }
  });

  test('2e tentative (après une chute dans cette fosse) : la 2e erreur pré-tirée ; une 3e approche (autre réapparition) reprend la 1re', () => {
    const p = pilot({ jumpSkill: 0.1 });
    const seed = Array.from({ length: 200 }, (_, s) => s).find((s) => {
      const [e1, e2] = robotDraws(p, 1, track, s, CONFIG).fosseErr[0];
      return Math.abs(e1 - e2) > 0.1 && Math.min(e1, e2) > -0.3;
    })!;
    const [e1, e2] = robotDraws(p, 1, track, seed, CONFIG).fosseErr[0];
    const driver = makeRobotDriver(p, 1, track, seed, CONFIG);
    const state = freshState();
    const go = (t0: number) => drive(driver, track, { x0: f.xLancement - 10, x1: f.xBord, v: 14, t0, state, serve: true });
    const a = go(2);
    expect(where(a, (s) => s.jump)).toEqual([window(a, 14, e1)]);
    // Chute dans la lave de cette fosse : réapparition, série à 1 (tentative 2).
    state.respawnCount++;
    state.lastRespawnLavaX = f.xLava;
    state.consecutiveRespawns = 1;
    const b = go(6);
    expect(where(b, (s) => s.jump)).toEqual([window(b, 14, e2)]);
    expect(window(b, 14, e2)).not.toBe(window(a, 14, e1));
    // Retournement ensuite (autre raison) : série remise à zéro, tentative 1 de nouveau.
    state.respawnCount++;
    state.lastRespawnLavaX = null;
    state.consecutiveRespawns = 0;
    const c = go(10);
    expect(where(c, (s) => s.jump)).toEqual([window(c, 14, e1)]);
  });

  test('erreurs aux fosses : N(0, FOSSE_SKILL_FACTOR × jumpSkill), 2 par fosse (graines 0 à 399, Pablo : écart-type 0,45 s ± 0,03)', () => {
    const errs: number[] = [];
    for (let s = 0; s < 400; s++) errs.push(...robotDraws(PABLO, 1, track, s, CONFIG).fosseErr.flat());
    expect(errs).toHaveLength(800);
    const mean = errs.reduce((a, e) => a + e, 0) / errs.length;
    const sd = Math.sqrt(errs.reduce((a, e) => a + (e - mean) ** 2, 0) / errs.length);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(sd).toBeGreaterThan(CONFIG.FOSSE_SKILL_FACTOR * PABLO.jumpSkill - 0.03);
    expect(sd).toBeLessThan(CONFIG.FOSSE_SKILL_FACTOR * PABLO.jumpSkill + 0.03);
  });
});

describe('déterminisme', () => {
  test('même graine et même rang : mêmes réponses sur toute une piste (graine 3, voiture lente devant par moments)', () => {
    const track = trackFor(3);
    const others = (x: number): Other[] => [{ index: 0, x: x + 3, speed: Math.floor(x / 37) % 3 === 0 ? 1 : 9 }];
    const run = () => drive(makeRobotDriver(PABLO, 2, track, SEED, CONFIG), track, { x0: track.xStart, x1: track.xFinish, v: 13, t0: 0, state: freshState(), others, serve: true });
    const a = run();
    expect(a.some((s) => !s.throttle) && a.some((s) => s.jump)).toBe(true);
    expect(run()).toEqual(a);
  });

  test('graine du driver (pilotSeed + rang × 0x9e3779b9) >>> 0 : deux rangs, deux tirages différents', () => {
    const track = trackFor(3);
    expect(driverSeed(7, 0)).toBe(7);
    expect(driverSeed(7, 2)).toBe((7 + 2 * 0x9e3779b9) >>> 0);
    const a = robotDraws(PABLO, 1, track, SEED, CONFIG);
    const b = robotDraws(PABLO, 2, track, SEED, CONFIG);
    expect(robotDraws(PABLO, 1, track, SEED, CONFIG)).toEqual(a);
    expect(a.starErr).not.toEqual(b.starErr);
    expect(a.fosseErr).not.toEqual(b.fosseErr);
  });
});
