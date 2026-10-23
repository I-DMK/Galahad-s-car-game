// Conduite des robots (plan B, tâche 6 ; spec §7, addendum §1.8 et §2, addendum « bouton saut » §3 et §6.8) : le driver
// d'un copain, pur, avec un contexte fabriqué à la main (voiture menée à vitesse donnée le long de la piste, sans
// physique). Délai de départ, zone volcan, lever de pied, robots polis, sauts d'étoile haute et de fosse, déterminisme.
// Le câblage dans `stepRace` (contexte réel `driverContext`, garde `inNoJumpZone`) : tests/robots.test.ts.
import { driverSeed, makeRobotDriver, robotDraws, type Driver, type DriverContext, type OtherCar } from '../src/ai/driver';
import { fosseJumpLead, fosseJumpWanted, fosseLatestLead } from '../src/cars/jump';
import { PILOTS, type Pilot } from '../src/cars/pilots';
import { newCarState, type CarState } from '../src/cars/state';
import { CONFIG } from '../src/config';
import { fosses, inNoJumpZone, sliceAt, tremplins } from '../src/track/query';
import { mulberry32 } from '../src/track/rng';
import { fosse, plat } from '../src/track/slices';
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

/** Autre voiture : doigt levé et solide par défaut (une voiture arrêtée). */
type Other = Partial<OtherCar> & { index: number; x: number; speed: number };
const other = (o: Other): OtherCar => ({ ...o, throttle: o.throttle ?? false, traversable: o.traversable ?? false, galahad: o.galahad ?? false, finished: o.finished ?? false });

/**
 * Contexte comme `stepRace` le remplit (étoile haute et fosse devant, à moins de JUMP_LOOKAHEAD), fabriqué à la main ;
 * `falls` : chutes déjà faites dans la fosse devant (tentative 2 dès une chute).
 */
function ctxOf(
  track: Track,
  o: { t: number; x: number; v: number; state: CarState; others?: Other[]; available?: boolean; falls?: number; traversable?: boolean },
): DriverContext {
  let nextHighStar: DriverContext['nextHighStar'] = null;
  const k = track.stars.findIndex((s) => s.high && s.x > o.x);
  if (k >= 0 && track.stars[k].x - o.x <= CONFIG.JUMP_LOOKAHEAD) nextHighStar = { index: k, x: track.stars[k].x, available: o.available ?? true };
  let nextFosse: DriverContext['nextFosse'] = null;
  const fs = fosses(track);
  const r = fs.findIndex((f) => f.xBord > o.x);
  if (r >= 0 && fs[r].xBord - o.x <= CONFIG.JUMP_LOOKAHEAD) {
    const f = fs[r];
    nextFosse = { xBord: f.xBord, index: r, attempt: (o.falls ?? 0) >= 1 ? 2 : 1 };
  }
  return {
    t: o.t, state: o.state, track, speed: o.v, x: o.x, traversable: o.traversable ?? false, others: (o.others ?? []).map(other),
    nextHighStar, nextFosse,
  };
}

interface Step { t: number; x: number; throttle: boolean; jump: boolean }

/**
 * Mène la voiture de x0 à x1 (exclu) à la vitesse v, un pas de PHYSICS_DT à la fois, depuis t0. `serve` : une demande
 * de saut est servie aussitôt (`state.lastJumpAt` = t, comme `updateJump` sur une voiture au sol) ; sinon jamais.
 */
function drive(
  driver: Driver, track: Track,
  o: {
    x0: number; x1: number; v: number; t0: number; state: CarState; serve?: boolean; others?: (x: number) => Other[]; available?: boolean;
    falls?: number;
  },
): Step[] {
  const steps: Step[] = [];
  let t = o.t0;
  for (let x = o.x0; x < o.x1; x += o.v * DT, t += DT) {
    const out = driver(ctxOf(track, { t, x, v: o.v, state: o.state, others: o.others?.(x), available: o.available, falls: o.falls }));
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

describe('robots polis : seulement derrière une voiture vraiment arrêtée (décision du papa, tour 1)', () => {
  const track = flat();
  const run = (others: Other[], o: { traversable?: boolean } = {}) =>
    makeRobotDriver(PABLO, 1, track, SEED, CONFIG)(ctxOf(track, { t: 1, x: 100, v: 0, state: freshState(), others, ...o }));

  test('voiture devant à 3 m, à 1 m/s, doigt levé : doigt levé', () => {
    expect(run([{ index: 0, x: 103, speed: 1 }]).throttle).toBe(false);
  });

  test('voiture qui démarre (doigt posé, 1 m/s) : doigt posé — la grille part à 0,3 s × rang', () => {
    expect(run([{ index: 0, x: 103, speed: 1, throttle: true }]).throttle).toBe(true);
  });

  test('devant à 3 m mais à 5 m/s : doigt posé ; à 6 m : doigt posé ; derrière ou à la même place : doigt posé', () => {
    expect(run([{ index: 0, x: 103, speed: 5 }]).throttle).toBe(true);
    expect(run([{ index: 0, x: 106, speed: 0 }]).throttle).toBe(true);
    expect(run([{ index: 2, x: 97, speed: 0 }]).throttle).toBe(true);
    expect(run([{ index: 2, x: 100, speed: 0 }]).throttle).toBe(true);
  });

  test('voiture qu’on traverse (fantôme ou invulnérable), ou copain lui-même fantôme : doigt posé', () => {
    expect(run([{ index: 0, x: 103, speed: 0, traversable: true }]).throttle).toBe(true);
    expect(run([{ index: 0, x: 103, speed: 0 }], { traversable: true }).throttle).toBe(true);
  });

  test('dans la zone volcan : doigt posé, même derrière une voiture arrêtée', () => {
    const { track: ft, f } = fossePiste();
    const driver = makeRobotDriver(PABLO, 1, ft, SEED, CONFIG);
    const x = f.xLancement + 2;
    expect(driver(ctxOf(ft, { t: 1, x, v: 0, state: freshState(), others: [{ index: 0, x: x + 3, speed: 0 }] })).throttle).toBe(true);
  });

  test('attente cumulée derrière la même voiture : il repart au bout de 3 s ; une poussée qui la fait rouler ne relance pas l’attente ; elle repart d’elle-même : remise à zéro', () => {
    const driver = makeRobotDriver(PABLO, 1, track, SEED, CONFIG);
    const state = freshState();
    let t = 1;
    const step = (o: Partial<Other>, index = 0) => {
      const out = driver(ctxOf(track, { t, x: 100, v: 0, state, others: [{ index, x: 103, speed: 0, ...o }] })).throttle;
      t += DT;
      return out;
    };
    const lifted = (n: number, o: Partial<Other>, index = 0) => Array.from({ length: n }, () => step(o, index)).filter((th) => !th).length;
    // 1,5 s derrière Galahad arrêté, puis 0,5 s où il est poussé à 2,5 m/s (pas un bloqueur), puis de nouveau arrêté :
    // l'attente reprend où elle en était (1,5 s de plus seulement), puis il repart.
    expect(lifted(90, {})).toBe(90);
    expect(lifted(30, { speed: 2.5 })).toBe(0);
    expect(lifted(120, {})).toBe(90);
    expect(lifted(60, {})).toBe(0);
    // La voiture repart d'elle-même (doigt posé), puis s'arrête de nouveau : nouvelle attente de 3 s.
    expect(lifted(1, { throttle: true })).toBe(0);
    expect(lifted(200, {})).toBe(180);
    // Une autre voiture arrêtée devant : nouvelle attente.
    expect(lifted(10, {}, 2)).toBe(10);
    // Une réapparition (nouvelle tentative) remet aussi l'attente à zéro : 2,9 s derrière la même voiture, réapparition,
    // puis de nouveau 3 s entières derrière elle (sans la remise à zéro, il repartirait au bout de 0,1 s : re-relecture
    // du tour 1, mutant 2d).
    expect(lifted(164, {}, 2)).toBe(164);
    state.respawnCount++;
    expect(lifted(200, {}, 2)).toBe(180);
  });
});

describe('poli derrière Galahad doigt levé (décision du papa, relectures de la tâche 7)', () => {
  const track = flat();
  /** Galahad (index 0) à `dx` m devant le copain (en x0), à `speed` m/s ; doigt levé au pas précédent par défaut. */
  const G = (dx: number, o: Partial<Other> = {}, x0 = 100): Other => ({ index: 0, x: x0 + dx, speed: 8, galahad: true, ...o });
  const run = (others: Other[], o: { traversable?: boolean; x?: number; tr?: Track } = {}) => {
    const tr = o.tr ?? track;
    return makeRobotDriver(PABLO, 1, tr, SEED, CONFIG)(ctxOf(tr, { t: 1, x: o.x ?? 100, v: 8, state: freshState(), others, traversable: o.traversable }));
  };

  test('Galahad doigt levé juste devant (0 à POLITE_GAP = 4 m), à n’importe quelle vitesse : doigt levé', () => {
    for (const dx of [0.5, 2.5, 3.3, 4]) {
      for (const speed of [0, 1.9, 8, 14]) expect(run([G(dx, { speed })]).throttle, `${dx} m, ${speed} m/s`).toBe(false);
    }
  });

  test('Galahad doigt posé, plus loin que 4 m, derrière ou à la même place, ou arrivé : doigt posé', () => {
    expect(run([G(3, { throttle: true })]).throttle).toBe(true);
    expect(run([G(4.01)]).throttle).toBe(true);
    expect(run([G(-2)]).throttle).toBe(true);
    expect(run([G(0)]).throttle).toBe(true);
    expect(run([G(3, { finished: true })]).throttle).toBe(true);
  });

  test('une autre voiture que Galahad, doigt levé à 8 m/s devant à 3 m : doigt posé (la politesse ordinaire exige < 2 m/s)', () => {
    expect(run([{ index: 2, x: 103, speed: 8 }]).throttle).toBe(true);
  });

  test('Galahad fantôme ou invulnérable, ou copain lui-même traversable : doigt posé', () => {
    expect(run([G(3, { traversable: true })]).throttle).toBe(true);
    expect(run([G(3)], { traversable: true }).throttle).toBe(true);
  });

  test('dans la zone volcan [xLancement, xLava] : doigt posé ; juste avant xLancement : doigt levé', () => {
    const { track: ft, f } = fossePiste();
    expect(run([G(3, {}, f.xLancement + 2)], { tr: ft, x: f.xLancement + 2 }).throttle).toBe(true);
    expect(run([G(3, {}, f.xLancement - 4)], { tr: ft, x: f.xLancement - 4 }).throttle).toBe(false);
  });

  test('sans limite de durée : 10 s derrière Galahad doigt levé, doigt levé à chaque pas ; il repart au premier doigt posé de Galahad', () => {
    const driver = makeRobotDriver(PABLO, 1, track, SEED, CONFIG);
    const state = freshState();
    let t = 1;
    const step = (o: Partial<Other> = {}) => {
      const out = driver(ctxOf(track, { t, x: 100, v: 1, state, others: [G(3, { speed: 0.5, ...o })] })).throttle;
      t += DT;
      return out;
    };
    const lifted = Array.from({ length: 600 }, () => step()).filter((th) => !th).length;
    expect(lifted).toBe(600);
    expect(step({ throttle: true })).toBe(true);
  });

  test('le saut d’une fosse reste demandé pendant ce lever de pied', () => {
    const { track: ft, f } = fossePiste();
    const driver = makeRobotDriver({ ...PABLO, jumpSkill: 0 }, 1, ft, SEED, CONFIG);
    // Juste avant l'approche (hors zone), Galahad doigt levé à 3 m : doigt levé ; la demande de saut n'existe que sur
    // l'approche, en zone : là, doigt posé et saut au centre de la fenêtre (la règle de zone passe avant).
    const x = f.xBord - 14 * 0.71;
    const out = driver(ctxOf(ft, { t: 1, x, v: 14, state: freshState(), others: [G(3, {}, x)] }));
    expect(out).toEqual({ throttle: true, jump: true });
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

  test.each([11.2, 14, 21])('jumpTry 1, jumpSkill 0, %s m/s : demande au premier pas où (xÉtoile − x) / v ≤ JUMP_STAR_LEAD, redemandée à chaque pas, abandonnée sous JUMP_STAR_MIN_LEAD', (v) => {
    const driver = makeRobotDriver(pilot({ jumpTry: 1, jumpSkill: 0 }), 1, track, SEED, CONFIG);
    const steps = drive(driver, track, { x0: star.x - 39, x1: star.x + 0.5, v, t0: 2, state: freshState() });
    const tte = (s: Step) => (star.x - s.x) / v;
    expect(where(steps, (s) => s.jump)).toEqual(where(steps, (s) => tte(s) <= CONFIG.JUMP_STAR_LEAD + EPS && tte(s) >= CONFIG.JUMP_STAR_MIN_LEAD - EPS));
    expect(where(steps, (s) => s.jump).length).toBeGreaterThan(10);
  });

  test('erreur négative au-delà de la demi-fenêtre (lead + e < JUMP_STAR_MIN_LEAD) : aucune demande, pas de saut sous l’étoile', () => {
    const p = pilot({ jumpTry: 1, jumpSkill: 0.2 });
    const seed = Array.from({ length: 2000 }, (_, s) => s).find((s) => robotDraws(p, 1, track, s, CONFIG).starErr[k] < CONFIG.JUMP_STAR_MIN_LEAD - CONFIG.JUMP_STAR_LEAD - 0.02)!;
    const driver = makeRobotDriver(p, 1, track, seed, CONFIG);
    expect(where(drive(driver, track, { x0: star.x - 39, x1: star.x + 0.5, v: 14, t0: 2, state: freshState() }), (s) => s.jump)).toEqual([]);
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

  test('jamais de demande dans inNoJumpZone (tremplins, graines 0 à 19, pas de 0,1 m, étoile fictive 12 m après chaque réception), ni de saut d’étoile dans une tranche fosse', () => {
    let tremplinsSeen = 0;
    let after = 0;
    const bad: string[] = [];
    for (let seed = 0; seed < 20; seed++) {
      const base = trackFor(seed);
      const xs = base.volcanoes.map((v) => v.xReception + (v.kind === 'tremplin' ? 12 : 30));
      const track = withHighStars(base, xs);
      for (const skill of [0, 0.25]) {
        const driver = makeRobotDriver(pilot({ jumpTry: 1, jumpSkill: skill }), 1, track, seed, CONFIG);
        const state = freshState();
        let t = 1;
        for (const v of track.volcanoes) {
          if (v.kind === 'tremplin') tremplinsSeen++;
          const x1 = v.kind === 'tremplin' ? v.xReception + 12 : v.xEnd;
          for (let x = v.xLancement - 45; x < x1; x += 0.1, t += DT) {
            // Hors de la fenêtre d'une fosse : seul le saut d'étoile peut demander.
            const f = fosses(track).find((ff) => x >= ff.xLancement && x < ff.xBord);
            const out = driver(ctxOf(track, { t, x, v: 14, state }));
            if (!out.jump || f) continue;
            if (inNoJumpZone(track, x)) bad.push(`g${seed} tremplin x = ${x.toFixed(1)} (zone [${v.xLancement.toFixed(1)}, ${v.xReception.toFixed(1)}])`);
            else if (sliceAt(track, x).type === 'fosse') bad.push(`g${seed} étoile demandée dans la tranche fosse, x = ${x.toFixed(1)}`);
            else if (v.kind === 'tremplin' && x > v.xReception && x < v.xReception + 12) after++;
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

  test('2e tentative (déjà tombé dans cette fosse) : la 2e erreur pré-tirée, gardée à toute approche suivante', () => {
    const p = pilot({ jumpSkill: 0.1 });
    const seed = Array.from({ length: 200 }, (_, s) => s).find((s) => {
      const [e1, e2] = robotDraws(p, 1, track, s, CONFIG).fosseErr[0];
      return Math.abs(e1 - e2) > 0.1 && Math.min(e1, e2) > -0.3;
    })!;
    const [e1, e2] = robotDraws(p, 1, track, seed, CONFIG).fosseErr[0];
    const driver = makeRobotDriver(p, 1, track, seed, CONFIG);
    const state = freshState();
    const go = (t0: number, falls: number) => drive(driver, track, { x0: f.xLancement - 10, x1: f.xBord, v: 14, t0, state, serve: true, falls });
    const a = go(2, 0);
    expect(where(a, (s) => s.jump)).toEqual([window(a, 14, e1)]);
    // Chute dans la lave de cette fosse : réapparition (nouvelle tentative), tentative 2.
    state.respawnCount++;
    const b = go(6, 1);
    expect(where(b, (s) => s.jump)).toEqual([window(b, 14, e2)]);
    expect(window(b, 14, e2)).not.toBe(window(a, 14, e1));
    // Retournement ensuite (autre raison) : la tentative reste comptée par fosse (une chute) : 2e erreur encore.
    state.respawnCount++;
    const c = go(10, 1);
    expect(where(c, (s) => s.jump)).toEqual([window(c, 14, e2)]);
  });

  // Raté tardif rendu visible (décision du papa, tour 2 de la tâche 6) : une erreur qui viserait plus tard que le bord au
  // plus tard CALCULÉ (`fosseLatestLead`, saut §6.2) devient un saut trop tôt du même écart : visé à fosseJumpLead(v) − e.
  test('bord au plus tard CALCULÉ : FOSSE_JUMP_LATE_DISTANCE / v + FOSSE_JUMP_LATE_TIME ; 0,21 / 0,167 / 0,146 / 0,117 s à 8 / 11,2 / 14 / 21 m/s ; v < 1 compté 1', () => {
    expect(CONFIG.FOSSE_JUMP_LATE_DISTANCE).toBe(1.2);
    expect(CONFIG.FOSSE_JUMP_LATE_TIME).toBe(0.06);
    expect(fosseLatestLead(8, CONFIG)).toBeCloseTo(0.21, 9);
    expect(fosseLatestLead(11.2, CONFIG)).toBeCloseTo(0.167, 3);
    expect(fosseLatestLead(14, CONFIG)).toBeCloseTo(0.146, 3);
    expect(fosseLatestLead(21, CONFIG)).toBeCloseTo(0.117, 3);
    expect(fosseLatestLead(0.5, CONFIG)).toBe(fosseLatestLead(1, CONFIG));
  });

  test('e = 0 jamais basculé : fosseJumpLead(v) ≥ fosseLatestLead(v) à toute vitesse (0 à 40 m/s, pas de 0,01 m/s), et fosseJumpWanted sans erreur inchangé', () => {
    let gapMin = Infinity;
    let vMin = NaN;
    for (let k = 0; k <= 4000; k++) {
      const v = k / 100;
      const gap = fosseJumpLead(v, CONFIG) - fosseLatestLead(v, CONFIG);
      if (gap < gapMin) { gapMin = gap; vMin = v; }
    }
    console.log(`fosseJumpLead − fosseLatestLead : au moins ${gapMin.toFixed(4)} s (à ${vMin} m/s)`);
    expect(gapMin).toBeGreaterThan(0.07);
    // Sans erreur, la demande est celle d'avant le tour 2 : bord à au plus fosseJumpLead(v), à plus de JUMP_BUFFER.
    for (const v of [1, 3, 6, 8, 11.2, 14, 17.5, 21, 30]) {
      for (let x = f.xLancement; x < f.xBord; x += 0.05) {
        const tte = (f.xBord - x) / v;
        const before = tte <= fosseJumpLead(v, CONFIG) + EPS && tte > CONFIG.JUMP_BUFFER + EPS;
        expect(fosseJumpWanted(track, x, v, CONFIG, 0), `v = ${v}, x = ${x.toFixed(2)}`).toBe(before);
        expect(fosseJumpWanted(track, x, v, CONFIG), `v = ${v}, x = ${x.toFixed(2)}`).toBe(before);
      }
    }
  });

  test.each([8, 11.2, 14, 21])('bascule à %s m/s : erreur juste au-dessus du seuil, demande à fosseJumpLead + e ; juste au-dessous, à fosseJumpLead − e (plus tôt du même écart)', (v) => {
    const lead = fosseJumpLead(v, CONFIG);
    /** e < seuil : trop tardive. */
    const seuil = fosseLatestLead(v, CONFIG) - lead;
    expect(seuil).toBeLessThan(0);
    /** Demande voulue à tte s avant le bord (x de la piste plate), avec l'erreur e. */
    const at = (tte: number, e: number) => fosseJumpWanted(track, f.xBord - tte * v, v, CONFIG, e);
    const above = seuil + 0.002;
    const below = seuil - 0.002;
    // Juste au-dessus : visé à lead + e (le plus tard permis), pas plus tôt.
    expect(at(lead + above - 0.001, above)).toBe(true);
    expect(at(lead + above + 0.001, above)).toBe(false);
    expect(at(lead - above - 0.001, above)).toBe(false);
    // Juste au-dessous : visé à lead − e, plus tôt que le centre du même écart ; redemandé jusqu'au dernier pas permis.
    expect(at(lead - below - 0.001, below)).toBe(true);
    expect(at(lead - below + 0.001, below)).toBe(false);
    expect(at(lead + below, below)).toBe(true);
    expect(at(CONFIG.JUMP_BUFFER + DT, below)).toBe(true);
    expect(at(CONFIG.JUMP_BUFFER - 0.001, below)).toBe(false);
    // Le saut basculé de justesse tombe au bord au plus tôt CALCULÉ (saut §6.2 : (1,96 s × v − W − 1,2 m) / v), à
    // 0,02 s près : du côté tôt de la fenêtre, qui est large.
    const earliest = (1.96 * v - CONFIG.FOSSE_WIDTH - 1.2) / v;
    expect(Math.abs(lead - seuil - earliest)).toBeLessThan(0.025);
  });

  test.each([8, 11.2, 14, 21])('erreur très tardive (< −1 s) à %s m/s, par le driver : une seule demande, au premier pas où (xBord − x) / v ≤ fosseJumpLead(v) − e (ou dès le début de l’approche)', (v) => {
    const p = pilot({ jumpSkill: 0.25 });
    const seed = Array.from({ length: 4000 }, (_, s) => s).find((s) => robotDraws(p, 1, track, s, CONFIG).fosseErr[0][0] < -1)!;
    expect(seed).toBeDefined();
    const e = robotDraws(p, 1, track, seed, CONFIG).fosseErr[0][0];
    const steps = drive(makeRobotDriver(p, 1, track, seed, CONFIG), track, { x0: f.xLancement - 10, x1: f.xBord, v, t0: 2, state: freshState(), serve: true });
    const jumps = where(steps, (s) => s.jump);
    expect(jumps).toEqual([window(steps, v, -e)]);
    // Visé plus tôt que le centre de |e| > 1 s, borné par le début de l'approche (à 21 m/s, 32,35 m font 1,54 s).
    const aim = Math.min(fosseJumpLead(v, CONFIG) - e, (f.xBord - f.xLancement) / v);
    const tte = (f.xBord - steps[jumps[0]].x) / v;
    expect(tte).toBeLessThanOrEqual(aim + EPS);
    expect(tte).toBeGreaterThan(aim - DT - EPS);
  });

  test('le driver lit la fosse de son contexte (`ctx.nextFosse.xBord`, tour 3) : un bord amont décalé de 3 m décale la demande de 3 m', () => {
    const driver = makeRobotDriver(pilot({ jumpSkill: 0 }), 1, track, SEED, CONFIG);
    const v = 14;
    const state = freshState();
    /** Premier x (pas de 0,01 m sur l'approche) où le driver demande, le bord du contexte décalé de `shift`. */
    const firstAsk = (shift: number): number => {
      for (let x = f.xLancement; x < f.xBord; x += 0.01) {
        const ctx = ctxOf(track, { t: 2, x, v, state });
        ctx.nextFosse = { ...ctx.nextFosse!, xBord: ctx.nextFosse!.xBord - shift };
        if (driver(ctx).jump) return x;
      }
      return NaN;
    };
    expect(firstAsk(0)).toBeCloseTo(f.xBord - fosseJumpLead(v, CONFIG) * v, 1);
    expect(firstAsk(3)).toBeCloseTo(firstAsk(0) - 3, 1);
  });

  test('deux fosses : chacune avec son erreur pré-tirée et son propre bord (tour 3 ; l’erreur de la fosse k n’est jamais appliquée à une autre)', () => {
    const rng = mulberry32(1);
    const two = trackOf([plat(rng, CONFIG, 150), fosse(CONFIG), plat(rng, CONFIG, 60), fosse(CONFIG), plat(rng, CONFIG, 100)]);
    const [f0, f1] = fosses(two);
    const p = pilot({ jumpSkill: 0.1 });
    // Erreurs bien différentes, sans bascule (au-dessus de −0,3 s).
    const seed = Array.from({ length: 400 }, (_, s) => s).find((s) => {
      const [[a], [b]] = robotDraws(p, 1, two, s, CONFIG).fosseErr;
      return Math.abs(a - b) > 0.15 && Math.min(a, b) > -0.3;
    })!;
    const [[e0], [e1]] = robotDraws(p, 1, two, seed, CONFIG).fosseErr;
    const v = 14;
    const steps = drive(makeRobotDriver(p, 1, two, seed, CONFIG), two, { x0: f0.xLancement - 10, x1: f1.xBord, v, t0: 2, state: freshState(), serve: true });
    const first = (ff: typeof f0, e: number) => steps.findIndex((s) => s.x >= ff.xLancement && s.x < ff.xBord
      && (ff.xBord - s.x) / v <= fosseJumpLead(v, CONFIG) + e + EPS && (ff.xBord - s.x) / v > CONFIG.JUMP_BUFFER + EPS);
    expect(where(steps, (s) => s.jump)).toEqual([first(f0, e0), first(f1, e1)]);
    // Le second saut n'est pas celui qu'aurait donné l'erreur de la première fosse.
    expect(first(f1, e1)).not.toBe(first(f1, e0));
  });

  test('étoiles hautes : tentée avec la probabilité jumpTry, erreur N(0, jumpSkill) (graines 0 à 399, traits de Pablo : 0,80 et 0,18 s)', () => {
    const t0 = trackFor(0);
    const highs = t0.stars.flatMap((s, i) => (s.high ? [i] : []));
    const tries: boolean[] = [];
    const errs: number[] = [];
    for (let s = 0; s < 400; s++) {
      const d = robotDraws(PABLO, 1, t0, s, CONFIG);
      for (const i of highs) { tries.push(d.starTry[i]); errs.push(d.starErr[i]); }
      // Étoiles basses : ni tentative ni erreur.
      t0.stars.forEach((st, i) => { if (!st.high) expect([d.starTry[i], d.starErr[i]]).toEqual([false, 0]); });
    }
    expect(errs).toHaveLength(1200);
    const rate = tries.filter(Boolean).length / tries.length;
    const mean = errs.reduce((a, e) => a + e, 0) / errs.length;
    const sd = Math.sqrt(errs.reduce((a, e) => a + (e - mean) ** 2, 0) / errs.length);
    expect(Math.abs(rate - PABLO.jumpTry)).toBeLessThan(0.04);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(sd).toBeGreaterThan(PABLO.jumpSkill - 0.015);
    expect(sd).toBeLessThan(PABLO.jumpSkill + 0.015);
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
