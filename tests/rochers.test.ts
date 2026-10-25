// Rochers dans le vrai pas de course (plan C, tâche 11c ; spec « rochers » §1, §2 et §6 « Physique ») : état par voiture,
// choc (`applyRockHit`), capteur par voiture, cas physiques sur la piste plate (`tests/helpers/rochers.ts`). Fenêtres
// entières : tests/slow/rochers-fenetres.test.ts.
import Matter from 'matter-js';
import { inRockJumpWindow, rockJumpLead, rockJumpWanted, rockLatestLead } from '../src/cars/jump';
import { hitRockFor, isRockActiveFor, newRockStates } from '../src/cars/rocks';
import { CONFIG } from '../src/config';
import { applyRockHit, carSpeedMps, createCar, placeCar } from '../src/physics/car';
import { mpsToPxPerStep, speedMps, toPx } from '../src/physics/units';
import { CAT, carCategory, createWorld } from '../src/physics/world';
import { chassisX, createRaceSim, GALAHAD_INDEX, stepRace, type SimEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';
import type { Rock, Track } from '../src/track/types';
import { disposeSolo, launchSolo, setCarSpeed, soloSim } from './helpers/jump-runs';
import { fossePiste } from './helpers/fosses';
import {
  BLOCK_HALF_STEPS, leadOf, localRockLead, passedRock, realTrackRun, ROCK_X, rockBlock, rockRun, rockStart, rockTrack, rockWorld,
} from './helpers/rochers';
import { f2 } from './helpers/runs';

const { Body, Composite } = Matter;

const ROCKS: Rock[] = [{ id: 0, xStart: 100, xEnd: 103 }, { id: 1, xStart: 300, xEnd: 303 }];

describe('état par voiture (cars/rocks.ts)', () => {
  test('newRockStates : un état par rocher (mêmes ids), une case par voiture, aucun choc', () => {
    const s = newRockStates(ROCKS, 5);
    expect(s.map((r) => r.id)).toEqual([0, 1]);
    for (const r of s) expect(r.hitAt).toEqual([null, null, null, null, null]);
    expect(newRockStates([], 5)).toEqual([]);
  });

  test('isRockActiveFor / hitRockFor : un choc ne vaut que pour sa voiture, jamais réarmé ; RangeError hors index', () => {
    const [s] = newRockStates(ROCKS, 3);
    expect(isRockActiveFor(s, 1)).toBe(true);
    hitRockFor(s, 1, 4.5);
    expect(s.hitAt).toEqual([null, 4.5, null]);
    expect(isRockActiveFor(s, 1)).toBe(false);
    expect(isRockActiveFor(s, 0)).toBe(true);
    expect(isRockActiveFor(s, 2)).toBe(true);
    for (const k of [-1, 3, 1.5, Number.NaN]) {
      expect(() => isRockActiveFor(s, k)).toThrow(RangeError);
      expect(() => hitRockFor(s, k, 0)).toThrow(RangeError);
    }
  });
});

describe('applyRockHit (physics/car.ts) : chaque pièce ramenée à ROCK_HIT_SPEED', () => {
  const flat: Track = { ...generateTrack(3, 300, CONFIG, { onlyPlat: true }), stars: [], rocks: [] };
  const world = createWorld(flat, CONFIG);
  const withCar = (fn: (car: ReturnType<typeof createCar>) => void): void => {
    const car = createCar(world, 'galahad', 0, 60, CONFIG);
    try { fn(car); } finally { Composite.remove(world.engine.world, car.composite); }
  };
  const omegaHit = mpsToPxPerStep(CONFIG.ROCK_HIT_SPEED) / toPx(CONFIG.WHEEL_RADIUS);

  test('pièces à 14 m/s : chaque pièce à 2,000 m/s ; roues au roulement à 2 m/s, en rad par pas (I3)', () => {
    withCar((car) => {
      for (const p of car.parts) Body.setVelocity(p, { x: mpsToPxPerStep(14), y: 0 });
      for (const w of car.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(14) / toPx(CONFIG.WHEEL_RADIUS));
      applyRockHit(car, CONFIG);
      expect(Math.abs(carSpeedMps(car) - 2)).toBeLessThan(1e-9);
      for (const p of car.parts) expect(Math.abs(speedMps(p.velocity) - 2)).toBeLessThan(1e-9);
      for (const w of car.wheels) expect(Math.abs(w.angularVelocity - omegaHit)).toBeLessThan(1e-9);
      // Pas des rad/s : 2 / 0,45 = 4,44 rad/s ≈ 0,074 rad/pas.
      expect(omegaHit).toBeCloseTo(2 / 0.45 / 60, 12);
    });
  });

  test('une pièce déjà à 1 m/s est inchangée ; direction gardée sur une pièce à (10, −3) m/s', () => {
    withCar((car) => {
      const [chassis, rear, front] = car.parts;
      Body.setVelocity(chassis, { x: mpsToPxPerStep(10), y: mpsToPxPerStep(-3) });
      Body.setVelocity(rear, { x: mpsToPxPerStep(1), y: 0 });
      Body.setVelocity(front, { x: mpsToPxPerStep(14), y: 0 });
      const rearBefore = { ...rear.velocity };
      applyRockHit(car, CONFIG);
      expect(rear.velocity.x).toBe(rearBefore.x);
      expect(rear.velocity.y).toBe(rearBefore.y);
      expect(Math.abs(speedMps(chassis.velocity) - 2)).toBeLessThan(1e-9);
      expect(chassis.velocity.y / chassis.velocity.x).toBeCloseTo(-3 / 10, 12);
      expect(chassis.velocity.x).toBeGreaterThan(0);
      expect(Math.abs(speedMps(front.velocity) - 2)).toBeLessThan(1e-9);
    });
  });
});

describe('câblage dans stepRace (5 voitures, piste plate à un rocher en 250 m)', () => {
  test('état par voiture : Galahad touche le rocher → masque du capteur sans sa catégorie, les 4 autres bits restent ; un second passage de Galahad à 2 m/s ne donne aucun second événement', () => {
    const track = rockTrack([ROCK_X]);
    const sim = createRaceSim(track, CONFIG, { robots: true });
    expect(sim.rockBodies).toHaveLength(1);
    expect(sim.rockBodies[0].label).toBe('rock');
    expect(sim.rockBodies[0].isSensor).toBe(true);
    expect(sim.rockBodies[0].collisionFilter.mask).toBe(CAT.ALL_CARS);
    const g = sim.cars[GALAHAD_INDEX];
    placeCar(g.body, ROCK_X - 20, (x) => heightAt(track, x), 0, CONFIG);
    setCarSpeed(g, track, ROCK_X - 20, 14, CONFIG);
    const rocks: SimEvent[] = [];
    while (sim.time < 3 && rocks.length === 0) {
      stepRace(sim, true);
      rocks.push(...sim.events.filter((e) => e.type === 'rock'));
    }
    expect(rocks).toHaveLength(1);
    const e = rocks[0] as Extract<SimEvent, { type: 'rock' }>;
    expect(e.carId).toBe(g.state.id);
    expect(e.id).toBe(0);
    expect(sim.rocks[0].hitAt).toEqual([e.t, null, null, null, null]);
    expect(sim.rockBodies[0].collisionFilter.mask).toBe(carCategory(1) | carCategory(2) | carCategory(3) | carCategory(4));
    expect(g.invulnerable).toBe(true);
    // Second passage, lancé à 2 m/s dedans : aucun second événement.
    placeCar(g.body, ROCK_X - 4, (x) => heightAt(track, x), 0, CONFIG);
    setCarSpeed(g, track, ROCK_X - 4, 2, CONFIG);
    const again: SimEvent[] = [];
    for (let k = 0; k < 4 / CONFIG.PHYSICS_DT; k++) {
      stepRace(sim, true);
      again.push(...sim.events.filter((ev) => ev.type === 'rock' && ev.carId === g.state.id));
    }
    expect(chassisX(g)).toBeGreaterThan(ROCK_X + 10);
    expect(again).toEqual([]);
    expect(sim.rocks[0].hitAt[0]).toBe(e.t);
  });

  test('createRaceSim sans rocher : rocks et rockBodies vides', () => {
    const sim = createRaceSim(rockTrack([]), CONFIG);
    expect(sim.rocks).toEqual([]);
    expect(sim.rockBodies).toEqual([]);
  });
});

// ——— Cas physiques, piste plate, Galahad seul, rocher en 250 m (spec §6 « Physique ») ———

const DT = CONFIG.PHYSICS_DT;
const { world: WORLD, rock: ROCK } = rockWorld();
const startFor = (v: number): number => rockStart(ROCK, v);

describe('(a) doigt posé sans saut : la voiture bute', () => {
  test.each([8, 11.2, 14, 21])('%s m/s tenus : un seul événement rock, châssis ≤ 2,1 m/s au pas suivant, aucune réapparition en 5 s, châssis passe xEnd + 10', (v) => {
    const r = rockRun(WORLD, ROCK, { x0: startFor(v), v, pressAtStep: null });
    console.log(`${v} m/s : choc en x = ${f2(r.hitX!)} (${f2(ROCK.xStart - r.hitX!)} m avant le rocher) à ${f2(r.hitSpeed)} m/s, ${f2(r.speedAfterHit)} m/s au pas suivant`);
    expect(r.hit).toBe(true);
    expect(r.hits).toBe(1);
    expect(r.speedAfterHit).toBeLessThanOrEqual(2.1);
    expect(r.respawn).toBe(false);
    expect(r.flipped).toBe(false);
    expect(r.xMax).toBeGreaterThan(ROCK.xEnd + 10);
  });

  test('turbo pris 40 m avant : touché, un seul événement, pas de réapparition', () => {
    const r = rockRun(WORLD, ROCK, { x0: startFor(14), v: 14, pressAtStep: null, turboAtX: ROCK.xStart - 40 });
    console.log(`turbo pris 40 m avant : choc à ${f2(r.hitSpeed)} m/s`);
    expect(r.hit).toBe(true);
    expect(r.hitSpeed).toBeGreaterThan(17);
    expect(r.hits).toBe(1);
    expect(r.respawn).toBe(false);
  });

  test('14 m/s : temps perdu entre 1,0 et 1,4 s sur les 60 m qui suivent le x du choc (mesuré 1,22 s ; I4 : 0,88 s si l’on compte depuis xStart)', () => {
    const x0 = startFor(14);
    const r = rockRun(WORLD, ROCK, { x0, v: 14, pressAtStep: null, afterHitSeconds: 8 });
    const { world: empty } = rockWorld({ rocks: [] });
    const w = rockRun(empty, ROCK, { x0, v: 14, pressAtStep: null, maxSeconds: 12 });
    const xEnd = r.hitX! + 60;
    const lost = r.tAt(xEnd)! - w.tAt(xEnd)!;
    // I4 : compté sur le segment [xStart, xStart + 60] (temps de chaque run depuis son passage en xStart), le rampement
    // jusqu'à xStart à 2 m/s n'est pas compté.
    const segment = (run: typeof r): number => run.tAt(ROCK.xStart + 60)! - run.tAt(ROCK.xStart)!;
    const fromStart = segment(r) - segment(w);
    console.log(`coût du choc à 14 m/s : ${f2(lost)} s sur les 60 m après le x du choc (${f2(fromStart)} s sur [xStart, xStart + 60])`);
    expect(lost).toBeGreaterThanOrEqual(1.0);
    expect(lost).toBeLessThanOrEqual(1.4);
  });

  test('départ arrêté 30 m avant : touché à ≥ 11 m/s, pas de réapparition', () => {
    const r = rockRun(WORLD, ROCK, { x0: rockStart(ROCK, 'arrêt'), v: 'arrêt', pressAtStep: null });
    console.log(`départ arrêté 30 m avant : choc à ${f2(r.hitSpeed)} m/s`);
    expect(r.hit).toBe(true);
    expect(r.hitSpeed).toBeGreaterThanOrEqual(11);
    expect(r.respawn).toBe(false);
  });
});

describe('(b) fenêtre', () => {
  test.each([11.2, 14, 'arrêt'] as const)('bloc central à %s : 25 appuis sur 25 passent', (v) => {
    const b = rockBlock(WORLD, ROCK, v);
    console.log(`bloc central à ${v} : k* à ${f2(b.leadStar)} s avant xStart, ${b.passed}/${b.runs - 1} passent${b.failed.length ? `, ratés ${b.failed.join(' ')}` : ''}`);
    expect(b.passed).toBe(25);
  });

  test('14 m/s : le dernier appui qui passe est entre 0,40 et 0,56 s avant xStart ; 0,2 s avant : touché', () => {
    const x0 = startFor(14);
    const witness = rockRun(WORLD, ROCK, { x0, v: 14, pressAtStep: null, trace: true });
    const kAt = (lead: number): number => witness.xs.findIndex((x, k) => leadOf(ROCK, x, witness.speeds[k]) <= lead);
    let k = kAt(0.7);
    expect(rockRun(WORLD, ROCK, { x0, v: 14, pressAtStep: k }).passed).toBe(true);
    while (rockRun(WORLD, ROCK, { x0, v: 14, pressAtStep: k + 1 }).passed) k++;
    const lastLead = leadOf(ROCK, witness.xs[k], witness.speeds[k]);
    console.log(`14 m/s : dernier appui qui passe à ${f2(lastLead)} s avant xStart`);
    expect(lastLead).toBeGreaterThanOrEqual(0.4);
    expect(lastLead).toBeLessThanOrEqual(0.56);
    const late = rockRun(WORLD, ROCK, { x0, v: 14, pressAtStep: kAt(0.2) });
    expect(late.jumpX).not.toBeNull();
    expect(late.hit).toBe(true);
    expect(late.respawn).toBe(false);
  });
});

describe('(c) après le choc', () => {
  test('traversable : invulnerable vrai au pas du choc, levé entre 1,5 et 3,0 s après (aucune autre voiture)', () => {
    const r = rockRun(WORLD, ROCK, { x0: startFor(14), v: 14, pressAtStep: null });
    expect(r.invulnerableFrom).toBe(r.hitStep);
    const lifted = (r.invulnerableTo! + 1 - r.hitStep!) * DT;
    console.log(`traversable ${f2(lifted)} s après le choc`);
    expect(lifted).toBeGreaterThanOrEqual(1.5);
    expect(lifted).toBeLessThanOrEqual(3.0);
    expect(r.invulnerableSteps).toBe(r.invulnerableTo! - r.invulnerableFrom! + 1);
  });

  test('lastJumpAt et jumpRequestedAt inchangés par le choc ; un saut 0,6 s après le choc passe (délai écoulé, au sol)', () => {
    const x0 = ROCK.xStart - 80;
    const sim = soloSim(WORLD, x0, [], CONFIG);
    try {
      launchSolo(sim, x0, 14, CONFIG);
      const g = sim.cars[GALAHAD_INDEX];
      let hitT: number | null = null;
      let jumpAfter: number | null = null;
      // Saut bien avant le rocher (atterri avant lui), puis choc ; demande de saut 0,6 s après le choc.
      for (let i = 0; i < 12 / DT && jumpAfter === null; i++) {
        const press = i === 30 || (hitT !== null && Math.abs(sim.time - (hitT + 0.6)) < DT / 2);
        const before = { lastJumpAt: g.state.lastJumpAt, jumpRequestedAt: g.state.jumpRequestedAt };
        stepRace(sim, true, press);
        for (const e of sim.events) {
          if (e.type === 'rock') {
            hitT = e.t;
            expect(before.lastJumpAt).not.toBeNull();
            expect(g.state.lastJumpAt).toBe(before.lastJumpAt);
            expect(g.state.jumpRequestedAt).toBe(before.jumpRequestedAt);
          }
          if (e.type === 'jump' && hitT !== null) jumpAfter = e.t - hitT;
          expect(e.type).not.toBe('respawn');
        }
      }
      expect(hitT).not.toBeNull();
      expect(jumpAfter).not.toBeNull();
      expect(jumpAfter!).toBeCloseTo(0.6, 1);
    } finally {
      disposeSolo(sim);
    }
  });

  test('déterminisme : deux runs identiques (xs, speeds, hitStep)', () => {
    const a = rockRun(WORLD, ROCK, { x0: startFor(11.2), v: 11.2, pressAtStep: null, trace: true });
    const b = rockRun(WORLD, ROCK, { x0: startFor(11.2), v: 11.2, pressAtStep: null, trace: true });
    expect(b.hitStep).toBe(a.hitStep);
    expect(b.xs).toEqual(a.xs);
    expect(b.speeds).toEqual(a.speeds);
  });
});

describe('Review Focus 1 à 3 (choc en l’air, deux rochers à 60 m, réception de fosse)', () => {
  test('saut 0,3 s avant le rocher à 14 m/s (trop tard) : événement rock en l’air, aucun retournement (|angle| < FLIP_ANGLE sur les 3 s suivantes), aucune réapparition, châssis repasse sous 0,9 m', () => {
    const x0 = startFor(14);
    const witness = rockRun(WORLD, ROCK, { x0, v: 14, pressAtStep: null, trace: true });
    const k = witness.xs.findIndex((x, i) => leadOf(ROCK, x, witness.speeds[i]) <= 0.3);
    const r = rockRun(WORLD, ROCK, { x0, v: 14, pressAtStep: k, afterHitSeconds: 3 });
    console.log(`saut 0,3 s avant à 14 m/s : saut en ${f2(r.jumpX!)}, choc à ${f2(r.hitHeight)} m au-dessus du sol (repos 0,70), plus bas ensuite ${f2(r.minHeightAfterHit)} m`);
    expect(r.jumpX).not.toBeNull();
    expect(r.hit).toBe(true);
    expect(r.hits).toBe(1);
    expect(r.hitHeight).toBeGreaterThan(1.0);
    expect(r.flipped).toBe(false);
    expect(r.respawn).toBe(false);
    expect(r.minHeightAfterHit).toBeLessThan(0.9);
  });

  test('deux rochers à 60 m : sans saut, deux événements, aucune réapparition ; vitesse au second ≥ 12 m/s ; bloc central du second (25 appuis) : ≥ 23 passent', () => {
    const { world, rock } = rockWorld({ rocks: [{ xStart: ROCK_X }, { xStart: ROCK_X + CONFIG.ROCK_SPACING }] });
    const second = world.track.rocks[1];
    const x0 = rockStart(rock, 14);
    const witness = rockRun(world, rock, { x0, v: 14, pressAtStep: null, trace: true, afterHitSeconds: 10, maxSeconds: 20 });
    console.log(`deux rochers à 60 m : chocs ${witness.hitList.map((h) => `rocher ${h.id} à ${f2(h.speed)} m/s`).join(', ')}`);
    expect(witness.hitList.map((h) => h.id)).toEqual([0, 1]);
    expect(witness.respawn).toBe(false);
    expect(witness.hitList[1].speed).toBeGreaterThanOrEqual(12);
    // Bloc central du second : le témoin part après le premier choc.
    const k1 = witness.hitList[0].step;
    const kStar = witness.xs.findIndex((x, k) => k > k1 && x < second.xStart
      && leadOf(second, x, witness.speeds[k]) <= localRockLead(witness.speeds[k]));
    let passed = 0;
    const failed: number[] = [];
    for (let d = -BLOCK_HALF_STEPS; d <= BLOCK_HALF_STEPS; d++) {
      const r = rockRun(world, rock, { x0, v: 14, pressAtStep: kStar + d, afterHitSeconds: 10, maxSeconds: 20 });
      if (passedRock(r, second)) passed++; else failed.push(d);
    }
    console.log(`bloc central du second rocher : ${passed}/25${failed.length ? `, ratés ${failed.join(' ')}` : ''}`);
    expect(passed).toBeGreaterThanOrEqual(23);
  });

  test('réception de fosse : rocher en xReception + 35, Galahad posé à l’arrêt en xReception + FOSSE_RESPAWN_AFTER, doigt posé : touché à ≥ 11 m/s (fantôme), pas de réapparition ; bloc central au départ arrêté : 25/25', () => {
    const { track: base, f } = fossePiste();
    const xStart = f.xReception + CONFIG.FOSSE_STAR_AFTER + CONFIG.ROCK_STAR_GAP;
    const track: Track = { ...base, rocks: [{ id: 0, xStart, xEnd: xStart + CONFIG.ROCK_WIDTH }] };
    const world = createWorld(track, CONFIG);
    const rock = track.rocks[0];
    const x0 = f.xReception + CONFIG.FOSSE_RESPAWN_AFTER;
    const r = rockRun(world, rock, { x0, v: 'arrêt', pressAtStep: null });
    console.log(`réception de fosse : choc à ${f2(r.hitSpeed)} m/s, ${f2(rock.xStart - x0)} m après la pose, fantôme ${r.ghostAtHit}`);
    expect(r.hit).toBe(true);
    expect(r.hits).toBe(1);
    expect(r.hitSpeed).toBeGreaterThanOrEqual(11);
    expect(r.ghostAtHit).toBe(true);
    expect(r.respawn).toBe(false);
    const b = rockBlock(world, rock, 'arrêt', { x0 });
    console.log(`réception de fosse, bloc central au départ arrêté : ${b.passed}/25${b.failed.length ? `, ratés ${b.failed.join(' ')}` : ''}`);
    expect(b.passed).toBe(25);
  });
});

describe('saut voulu devant un rocher (cars/jump.ts, fonctions pures)', () => {
  const EPS = 1e-9;
  test('rockJumpLead(8 | 11,2 | 14) = 0,8125 / 0,866 / 0,893 ; v < 1 compté 1 ; rockLatestLead = 0,5', () => {
    expect(rockJumpLead(8, CONFIG)).toBeCloseTo(0.8125, 3);
    expect(rockJumpLead(11.2, CONFIG)).toBeCloseTo(0.866, 3);
    expect(rockJumpLead(14, CONFIG)).toBeCloseTo(0.893, 3);
    expect(rockJumpLead(0.5, CONFIG)).toBe(rockJumpLead(1, CONFIG));
    for (const v of [0, 8, 14, 21]) expect(rockLatestLead(v, CONFIG)).toBe(0.5);
  });

  test.each([8, 11.2, 14, 21])('inRockJumpWindow à %s m/s : vrai sur [xStart − lead × v, xStart − JUMP_BUFFER × v[, faux avant et après ; une erreur ± 0,3 s déplace le bord tôt', (v) => {
    const xs = 500;
    const lead = rockJumpLead(v, CONFIG);
    const at = (tte: number, e = 0): boolean => inRockJumpWindow(xs, xs - tte * v, v, CONFIG, e);
    expect(at(lead + 0.001)).toBe(false);
    expect(at(lead - 0.001)).toBe(true);
    expect(at(0.5)).toBe(true);
    expect(at(CONFIG.JUMP_BUFFER + 0.001)).toBe(true);
    expect(at(CONFIG.JUMP_BUFFER - 0.001)).toBe(false);
    expect(at(0)).toBe(false);
    expect(at(-1)).toBe(false);
    expect(at(lead + 0.29, 0.3)).toBe(true);
    expect(at(lead + 0.31, 0.3)).toBe(false);
    expect(at(lead - 0.31, -0.3)).toBe(true);
    expect(at(lead - 0.29, -0.3)).toBe(false);
    // Erreur très tardive : pas de bascule, filet JUMP_BUFFER + PHYSICS_DT.
    expect(at(CONFIG.JUMP_BUFFER + CONFIG.PHYSICS_DT - EPS, -5)).toBe(true);
    expect(at(CONFIG.JUMP_BUFFER + CONFIG.PHYSICS_DT + 0.01, -5)).toBe(false);
  });

  test('rockJumpWanted sur une piste à rochers (graines 0 à 49) : vrai dans la fenêtre du premier rocher, faux 41 m avant, faux après xEnd ; faux sur une piste ROCKS_PER_RACE 0', () => {
    let checked = 0;
    for (let seed = 0; seed < 50; seed++) {
      const t = generateTrack(seed, 1680, CONFIG);
      const [r] = t.rocks;
      if (!r) continue;
      checked++;
      const v = 14;
      const lead = rockJumpLead(v, CONFIG);
      expect(rockJumpWanted(t, r.xStart - (lead - 0.05) * v, v, CONFIG), `graine ${seed}`).toBe(true);
      expect(rockJumpWanted(t, r.xStart - 41, v, CONFIG), `graine ${seed}`).toBe(false);
      expect(rockJumpWanted(t, r.xEnd + 0.5, v, CONFIG), `graine ${seed}`).toBe(false);
      const none = generateTrack(seed, 1680, { ...CONFIG, ROCKS_PER_RACE: 0 });
      expect(rockJumpWanted(none, r.xStart - (lead - 0.05) * v, v, CONFIG), `graine ${seed}, sans rocher`).toBe(false);
    }
    expect(checked).toBe(50);
  });
});

describe('Review Focus 4 : masque du capteur à 5 voitures', () => {
  test('Galahad devant touche le rocher, puis un copain : hitAt n’a que leurs cases, masque = OU des 3 autres ; un seul événement par voiture', () => {
    const track = rockTrack([ROCK_X]);
    const sim = createRaceSim(track, CONFIG, { robots: true });
    const [g, c] = sim.cars;
    const launch = (car: typeof g, x: number): void => {
      placeCar(car.body, x, (u) => heightAt(track, u), 0, CONFIG);
      setCarSpeed(car, track, x, 14, CONFIG);
    };
    launch(g, ROCK_X - 20);
    const events: Extract<SimEvent, { type: 'rock' }>[] = [];
    const run = (seconds: number): void => {
      for (let k = 0; k < seconds / DT; k++) {
        stepRace(sim, true);
        for (const e of sim.events) if (e.type === 'rock') events.push(e);
      }
    };
    run(2);
    expect(events.map((e) => e.carId)).toEqual([g.state.id]);
    expect(sim.rocks[0].hitAt.map((h) => h !== null)).toEqual([true, false, false, false, false]);
    expect(sim.rockBodies[0].collisionFilter.mask).toBe(carCategory(1) | carCategory(2) | carCategory(3) | carCategory(4));
    // Le copain de rang 1, lancé 20 m avant ; son driver est remplacé par un doigt posé sans saut, pour un choc sûr.
    c.driver = () => ({ throttle: true, jump: false });
    launch(c, ROCK_X - 20);
    run(3);
    expect(events.map((e) => e.carId)).toEqual([g.state.id, c.state.id]);
    expect(sim.rocks[0].hitAt.map((h) => h !== null)).toEqual([true, true, false, false, false]);
    expect(sim.rockBodies[0].collisionFilter.mask).toBe(carCategory(2) | carCategory(3) | carCategory(4));
  });
});

describe('vraies pistes, Galahad seul, doigt posé sans saut (graines 0 à 4 ; 5 à 9 en suite lente)', () => {
  test.each([0, 1, 2, 3, 4])('graine %i : chaque rocher donne exactement un « rock » de Galahad ; aucune réapparition dans les 3 s après ; arrivée avant 240 s', (seed) => {
    const r = realTrackRun(seed);
    console.log(`graine ${seed} : ${r.rocks} rochers, chocs ${r.hits.join(', ')}, arrivée ${r.finishedAt?.toFixed(1)} s${r.missed.length ? `, SURVOLS ${r.missed.join(' ; ')}` : ''}`);
    expect(r.missed).toEqual([]);
    expect([...r.hits].sort((a, b) => a - b)).toEqual(Array.from({ length: r.rocks }, (_, k) => k));
    expect(r.rockRespawns).toEqual([]);
    expect(r.finishedAt).not.toBeNull();
    expect(r.finishedAt!).toBeLessThan(240);
  }, 120_000);
});
