// Fosses de lave (plan B, tâche 5g ; addendum « bouton saut » §6.1 à §6.5, décisions P8, P9, Q-F1, Q-F2, Q-F5) :
// partie statique (pistes des graines 0 à 49), fonctions pures du saut voulu (`fosseJumpLead`, `fosseJumpWanted`), puis
// cas physiques qui discriminent sur une fosse de 8 m posée sur une piste plate (monde rogné), par le vrai `stepRace`.
// Fenêtres entières et courses complètes : suite lente (tests/slow/fosses-*.test.ts, race-sans-saut-*.test.ts).
import Matter from 'matter-js';
import { fosseJumpLead, fosseJumpWanted } from '../src/cars/jump';
import { CONFIG } from '../src/config';
import { carSpeedMps, placeCar } from '../src/physics/car';
import { carPairsTouching } from '../src/sim/harness';
import { chassisX, createRaceSim, stepRace, type CarSim, type RaceSim, type RespawnEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { fosses, heightAt, inGhostZone } from '../src/track/query';
import { mulberry32 } from '../src/track/rng';
import { fosse, plat, rampeVolcan } from '../src/track/slices';
import type { Track } from '../src/track/types';
import { BLOCK_HALF_STEPS, flatFosseWorld, fosseBlock, fosseRun, trackOf } from './helpers/fosses';
import { launchSolo } from './helpers/jump-runs';
import { fiveCarRace, lavaSeries } from './helpers/race';
import { trackFor } from './helpers/runs';

const S = CONFIG.TRACK_POINT_SPACING;
const SEEDS = Array.from({ length: 50 }, (_, i) => i);
const tracks: Track[] = SEEDS.map((seed) => generateTrack(seed, 1680, CONFIG));
const onGrid = (x: number): boolean => Math.abs(x / S - Math.round(x / S)) < 1e-6;

describe('fosses des pistes (graines 0 à 49, 1 680 m) : géométrie', () => {
  const all = tracks.flatMap((t) => fosses(t).map((f) => ({ t, f, slice: t.slices.find((s) => s.type === 'fosse' && Math.abs(s.xEnd - f.xEnd) < 1e-9)! })));

  test('au moins une fosse par piste à 2 volcans ou plus ; chaque fosse est une tranche « fosse » de la longueur de la rampe-volcan', () => {
    expect(all.length).toBeGreaterThan(60);
    for (const { t, slice } of all) {
      expect(slice, `graine ${t.seed}`).toBeDefined();
      expect(slice.xEnd - slice.xStart, `graine ${t.seed}`).toBeCloseTo(rampeVolcan(CONFIG).length, 9);
    }
  });

  test('garde de 20 m, approche LANCEMENT_LENGTH (maille supérieure), lave de 8 m, réception ≥ 60 m, bords sur la maille', () => {
    for (const { t, f, slice } of all) {
      const where = `graine ${t.seed}, fosse en ${f.xBord.toFixed(1)}`;
      expect(f.xLancement - slice.xStart, where).toBeCloseTo(CONFIG.FOSSE_GUARD, 9);
      expect(f.xBord - f.xLancement, where).toBeGreaterThanOrEqual(CONFIG.LANCEMENT_LENGTH - 1e-9);
      expect(f.xBord - f.xLancement, where).toBeLessThan(CONFIG.LANCEMENT_LENGTH + S);
      expect(f.xReception - f.xBord, where).toBeCloseTo(CONFIG.FOSSE_WIDTH, 9);
      expect(f.lavaWidth, where).toBeCloseTo(CONFIG.FOSSE_WIDTH, 9);
      expect(f.xLava, where).toBeCloseTo(f.xBord + CONFIG.FOSSE_WIDTH / 2, 9);
      expect(f.xEnd - f.xReception, where).toBeGreaterThanOrEqual(60);
      expect(f.rimY, where).toBe(0);
      for (const x of [slice.xStart, f.xLancement, f.xBord, f.xReception, f.xEnd]) expect(onGrid(x), `${where} : ${x}`).toBe(true);
    }
  });

  test('hauteur 0 sur [début, xBord] et sur [xReception, xEnd] (aucune lèvre), −CRATER_DEPTH dans la fosse, deux parois exemptées', () => {
    for (const { t, f, slice } of all) {
      const where = `graine ${t.seed}, fosse en ${f.xBord.toFixed(1)}`;
      const i0 = Math.round(slice.xStart / S);
      const i1 = Math.round(slice.xEnd / S);
      const iB = Math.round(f.xBord / S);
      const iR = Math.round(f.xReception / S);
      for (let i = i0; i <= i1; i++) {
        const want = i > iB && i < iR ? -CONFIG.CRATER_DEPTH : 0;
        if (t.points[i].y !== want) throw new Error(`${where} : point ${i} (x = ${t.points[i].x}) à ${t.points[i].y}, ${want} attendu`);
      }
      const exempt = t.exemptPointIndices.filter((i) => i > i0 && i <= i1);
      expect(exempt, where).toEqual([iB + 1, iR]);
      expect(heightAt(t, f.xLava), where).toBe(-CONFIG.CRATER_DEPTH);
    }
  });
});

describe('saut voulu devant une fosse (fonctions pures, saut §6.8)', () => {
  test('fosseJumpLead : FOSSE_JUMP_AIM − FOSSE_WIDTH / (2v), au moins FOSSE_JUMP_MIN_DISTANCE / v ; 0,50 / 0,64 / 0,71 / 0,81 s à 8 / 11,2 / 14 / 21 m/s ; v < 1 compté 1', () => {
    expect(CONFIG.FOSSE_JUMP_AIM).toBe(1);
    expect(CONFIG.FOSSE_JUMP_MIN_DISTANCE).toBe(2);
    expect(fosseJumpLead(8, CONFIG)).toBeCloseTo(0.5, 9);
    expect(fosseJumpLead(11.2, CONFIG)).toBeCloseTo(1 - 8 / 22.4, 9);
    expect(fosseJumpLead(11.2, CONFIG)).toBeCloseTo(0.643, 3);
    expect(fosseJumpLead(14, CONFIG)).toBeCloseTo(0.714, 3);
    expect(fosseJumpLead(21, CONFIG)).toBeCloseTo(0.810, 3);
    // Plancher en distance (tour 1 de la 5g) : 2 m avant le bord sous ≈ 6 m/s (la formule tombait sous 1,15 m, puis ≤ 0).
    expect(fosseJumpLead(6, CONFIG)).toBeCloseTo(1 / 3, 9);
    expect(fosseJumpLead(5, CONFIG)).toBeCloseTo(0.4, 9);
    expect(fosseJumpLead(4, CONFIG)).toBeCloseTo(0.5, 9);
    expect(fosseJumpLead(3, CONFIG)).toBeCloseTo(2 / 3, 9);
    expect(fosseJumpLead(0.5, CONFIG)).toBe(fosseJumpLead(1, CONFIG));
    expect(fosseJumpLead(1, CONFIG)).toBe(2);
    for (const v of [1, 2, 3, 4, 5, 6, 8, 14, 21]) expect(fosseJumpLead(v, CONFIG) * v, `v = ${v}`).toBeGreaterThanOrEqual(2 - 1e-9);
  });

  const t = tracks.find((tr) => fosses(tr).length >= 2)!;
  const [f, g] = fosses(t);

  test.each([3, 8, 11.2, 14, 21])('fosseJumpWanted à %s m/s : vrai sur [xBord − lead × v, xBord − JUMP_BUFFER × v[, faux avant (approche comprise) et après', (v) => {
    const lead = fosseJumpLead(v, CONFIG);
    const xOpen = f.xBord - lead * v;
    // Une demande gardée 0,1 s ne doit pas partir au-dessus de la lave (tour 1 de la 5g) : plus de demande dans les
    // JUMP_BUFFER dernières secondes avant le bord.
    const xClose = f.xBord - CONFIG.JUMP_BUFFER * Math.max(v, 1);
    expect(xOpen).toBeGreaterThan(f.xLancement);
    expect(xClose).toBeGreaterThan(xOpen);
    expect(fosseJumpWanted(t, xOpen - 0.01, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, xOpen + 1e-6, v, CONFIG)).toBe(true);
    expect(fosseJumpWanted(t, xClose - 0.01, v, CONFIG)).toBe(true);
    expect(fosseJumpWanted(t, xClose + 1e-6, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, f.xBord - 0.01, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, f.xBord, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, f.xLava, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, f.xReception + 1, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, f.xLancement - 0.01, v, CONFIG)).toBe(false);
    // Hors de [xLancement, xBord[ de la prochaine fosse : jamais (garde, plats, tremplins).
    expect(fosseJumpWanted(t, 0, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, g.xBord - lead * v + 0.01, v, CONFIG)).toBe(true);
  });

  test('à 40 m/s (relecture standard M1) : le centre visé tombe avant l’approche, la garde x < xLancement coupe la demande', () => {
    const v = 40;
    expect(f.xBord - fosseJumpLead(v, CONFIG) * v).toBeLessThan(f.xLancement);
    expect(fosseJumpWanted(t, f.xLancement - 0.01, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, f.xLancement - CONFIG.FOSSE_GUARD / 2, v, CONFIG)).toBe(false);
    expect(fosseJumpWanted(t, f.xLancement, v, CONFIG)).toBe(true);
  });

  test('piste sans fosse : jamais', () => {
    const noFosse = generateTrack(1, 1680, { ...CONFIG, FOSSE_PERIOD: 0 });
    for (let x = 0; x < noFosse.length; x += 1) expect(fosseJumpWanted(noFosse, x, 14, CONFIG)).toBe(false);
  });
});

// ——— Cas physiques (Step 3) : fosse de 8 m sur une piste plate, Galahad seul par le vrai `stepRace` ———

const DT = CONFIG.PHYSICS_DT;
const { world, f: F } = flatFosseWorld();
const T0 = performance.now();
afterAll(() => console.log(`tests/fosses.test.ts : cas physiques en ${((performance.now() - T0) / 1000).toFixed(1)} s`));

describe('(a) sans sauter, on tombe toujours (piste plate)', () => {
  test.each([3, 11.2, 14, 21, 30])('lancée à %s m/s tenus, doigt posé, sans saut : lave, châssis repris avant le bord amont', (v) => {
    const r = fosseRun(world, { x0: F.xBord - Math.max(30, 3 * v), v, pressAtStep: null, maxSeconds: 20, trace: true });
    const xFall = r.lavaStep === null ? NaN : r.xs[r.lavaStep];
    const where = `v = ${v} : lave ${r.lava}, autre réapparition ${r.respawn}, châssis à la chute ${xFall.toFixed(2)} (bord ${F.xBord.toFixed(2)})`;
    expect(r.lava, where).toBe(true);
    expect(r.respawn, where).toBe(false);
    expect(xFall, where).toBeLessThan(F.xBord);
  });
});

describe('(b), (c) bloc central de 0,4 s (25 appuis, un par pas de [k* − 12, k* + 12]) : tous passent, sans réapparition 3 s après l’atterrissage', () => {
  const cases: [string, number | 'arrêt', { turboAtX?: number }][] = [
    ['(b) lancée à 14 m/s tenus', 14, {}],
    ['(b) lancée à 14 m/s, turbo pris 40 m avant le bord', 14, { turboAtX: F.xBord - 40 }],
    ['(c) départ arrêté au pire point sûr (xLancement + 5 − 0,01)', 'arrêt', {}],
  ];
  test.each(cases)('%s', (name, v, opts) => {
    const b = fosseBlock(world, F, v, opts);
    const where = `${name} : k* = ${b.kStar} (${b.leadStar.toFixed(2)} s avant le bord, ${((b.kFall - b.kStar) * DT).toFixed(2)} s avant la chute du témoin), `
      + `${b.passed}/${b.runs - 1} passent, échecs à k* ${b.failed.map((d) => (d >= 0 ? `+${d}` : d)).join(' ')}`;
    console.log(`bloc central ${where}`);
    expect(b.passed, where).toBe(2 * BLOCK_HALF_STEPS + 1);
  });
});

test('à doigt posé seulement (saut §6.1) : à 5 m/s tenus, 13 appuis tous les 0,05 s de 0 à 0,6 s avant la chute du témoin, aucun ne passe', () => {
  const x0 = F.xBord - 25;
  const witness = fosseRun(world, { x0, v: 5, pressAtStep: null });
  expect(witness.lava).toBe(true);
  const kFall = witness.lavaStep!;
  const passed: number[] = [];
  for (let j = 0; j <= 12; j++) {
    const k = kFall - Math.round((j * 0.05) / DT);
    if (fosseRun(world, { x0, v: 5, pressAtStep: k }).passed) passed.push(k);
  }
  expect(passed, `appuis qui passent (pas, chute du témoin au pas ${kFall})`).toEqual([]);
});

test.each([8, 11.2, 21])('saut voulu (`fosseJumpWanted`, redemandé à chaque pas) à %s m/s tenus : passe, atterrit sur la réception', (v) => {
  const r = fosseRun(world, { x0: F.xBord - Math.max(40, 3.5 * v), v, pressAtStep: 'voulu' });
  const where = `v = ${v} : saut à ${r.jumpX === null ? '—' : (F.xBord - r.jumpX).toFixed(2)} m du bord, atterrissage à ${r.landX === null ? '—' : (r.landX - F.xReception).toFixed(1)} m du bord aval, garde min ${r.minWheelGap.toFixed(2)} m`;
  console.log(`saut voulu ${where}`);
  expect(r.passed, where).toBe(true);
  expect(r.landX! - F.xReception, where).toBeLessThan(F.xEnd - 10 - F.xReception);
});

describe('2e chute de suite dans une fosse (option B, Q-F2) et séries', () => {
  /** Galahad seul sur la piste à fosse, point sûr à xLancement + 1, doigt posé sans saut, jusqu'à n réapparitions. */
  function run(n: number, beforeSecond?: (sim: RaceSim) => void): { sim: RaceSim; respawns: RespawnEvent[] } {
    const sim = createRaceSim(world.track, CONFIG);
    const g = sim.cars[0];
    const xSafe = F.xLancement + 1;
    g.state.safePoint = { x: xSafe, y: 0, angle: 0 };
    placeCar(g.body, xSafe, () => 0, 0, CONFIG);
    const respawns: RespawnEvent[] = [];
    while (respawns.length < n && sim.time < 30) {
      stepRace(sim, true);
      for (const e of sim.events) {
        if (e.type !== 'respawn') continue;
        respawns.push(e);
        if (respawns.length === 1) beforeSecond?.(sim);
      }
    }
    return { sim, respawns };
  }

  test('doigt posé sans saut : 1re chute → point sûr (sur les 5 premiers mètres de l’approche) ; 2e de suite → posée à bord aval + 5, à l’arrêt, au sol ; puis elle finit la piste', () => {
    const { sim, respawns } = run(2);
    expect(respawns.map((e) => e.reason)).toEqual(['lava', 'lava']);
    expect(respawns[0].target.x).toBeGreaterThanOrEqual(F.xLancement + 1 - 1e-9);
    expect(respawns[0].target.x).toBeLessThan(F.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN);
    expect(respawns[1].target.x).toBeCloseTo(F.xReception + CONFIG.FOSSE_RESPAWN_AFTER, 6);
    const g = sim.cars[0];
    expect(chassisX(g)).toBeCloseTo(F.xReception + CONFIG.FOSSE_RESPAWN_AFTER, 6);
    expect(carSpeedMps(g.body)).toBeLessThan(0.01);
    expect(g.state.consecutiveRespawns).toBe(0);
    // Elle repart et passe la fin de la réception sans autre réapparition.
    const more: RespawnEvent[] = [];
    while (chassisX(g) < F.xEnd + 10 && sim.time < 40) {
      stepRace(sim, true);
      more.push(...sim.events.filter((e): e is RespawnEvent => e.type === 'respawn'));
    }
    expect(more).toEqual([]);
    expect(chassisX(g)).toBeGreaterThanOrEqual(F.xEnd + 10);
  });

  test('une chute puis un retournement (sur l’approche : délai FLIP_SECONDS, pas immédiat) : la série repart, la chute suivante ramène au point sûr', () => {
    let flippedAt = NaN;
    const { respawns } = run(3, (sim) => {
      // Juste après la 1re chute : voiture retournée sur l'approche, à plat, roues en l'air.
      const g = sim.cars[0];
      const x = F.xLancement + 10;
      placeCar(g.body, x, () => 0, Math.PI, CONFIG);
      flippedAt = sim.time;
    });
    // La pose à l'envers ne tient pas (les roues retombent) : 'flipped' ou 'side', jamais immédiat hors de l'élan d'un
    // tremplin (inElanZone faux sur une fosse) ; au moins FLIP_SECONDS.
    expect(respawns.map((e) => e.reason)).toEqual(['lava', expect.stringMatching(/^(flipped|side)$/), 'lava']);
    expect(respawns[1].t - flippedAt).toBeGreaterThan(CONFIG.FLIP_SECONDS - 1e-9);
    // Série remise à zéro : la chute suivante ramène au point sûr (avant xLancement + 5), pas après la fosse.
    expect(respawns[2].target.x).toBeLessThan(F.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN);
  });
});

describe('réapparition près du bord aval (tour 1 de la 5g, scénario de la relecture adversariale)', () => {
  /** Course à 5 sur `track` : Galahad au point sûr `xSafe`, le copain 1 garé dessus, les autres garés loin derrière. */
  function setup(track: Track, xSafe: number): { sim: RaceSim; respawns: RespawnEvent[]; run: (seconds: number, throttle: boolean) => void } {
    const sim = createRaceSim(track, CONFIG, { robots: true });
    sim.cars.slice(1).forEach((car, k) => {
      car.driver = () => false;
      placeCar(car.body, k === 0 ? xSafe : 10 + 4 * k, () => 0, 0, CONFIG);
    });
    const g = sim.cars[0];
    g.state.safePoint = { x: xSafe, y: 0, angle: 0 };
    // Galahad retourné plus loin sur la réception : réapparition « side » ou « flipped » vers son point sûr, occupé.
    placeCar(g.body, xSafe + 25, () => 0, Math.PI, CONFIG);
    const respawns: RespawnEvent[] = [];
    const run = (seconds: number, throttle: boolean): void => {
      const end = sim.time + seconds;
      while (sim.time < end) {
        stepRace(sim, throttle);
        respawns.push(...sim.events.filter((e): e is RespawnEvent => e.type === 'respawn' && e.carId === g.state.id));
      }
    };
    return { sim, respawns, run };
  }

  test('point sûr à bord aval + 3,5 m, copain arrêté dessus, réapparition « side » : la cible reste à ≥ bord aval + 1,5 m, une seule réapparition', () => {
    const { respawns, run } = setup(world.track, F.xReception + 3.5);
    run(5, false);
    const what = respawns.map((e) => `${e.reason} → ${e.target.x.toFixed(2)}`).join(' ; ');
    expect(respawns.length, what).toBe(1);
    expect(respawns[0].reason, what).toMatch(/^(side|flipped)$/);
    expect(respawns[0].target.x, what).toBeGreaterThanOrEqual(F.xReception + 1.5 - 1e-9);
  });

  test('même chose avec une autre fosse ensuite : la série reste sur la bonne fosse (2 chutes à la 2e fosse avant d’être posé après elle)', () => {
    const rng = mulberry32(2);
    const two = trackOf([plat(rng, CONFIG, 150), fosse(CONFIG), plat(rng, CONFIG, 30), fosse(CONFIG), plat(rng, CONFIG, 100)]);
    const [f1, f2] = fosses(two);
    const { respawns, run } = setup(two, f1.xReception + 3.5);
    run(4, false);
    run(30, true);
    const what = respawns.map((e) => `${e.reason}@${e.x.toFixed(1)} → ${e.target.x.toFixed(2)}`).join(' ; ');
    expect(respawns.map((e) => e.reason).slice(1, 3), what).toEqual(['lava', 'lava']);
    expect(respawns[0].target.x, what).toBeGreaterThanOrEqual(f1.xReception + 1.5 - 1e-9);
    // 1re chute à la 2e fosse : retour au point sûr (avant elle) ; 2e de suite : posée juste après elle.
    expect(respawns[1].x, what).toBeGreaterThan(f2.xLancement);
    expect(respawns[1].target.x, what).toBeLessThan(f2.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN);
    expect(respawns[2].target.x, what).toBeCloseTo(f2.xReception + CONFIG.FOSSE_RESPAWN_AFTER, 6);
  });
});

describe('copain lent (tour 1 de la 5g) : il tente son saut, et jamais au-dessus de la lave', () => {
  test('copain à 3 m/s tenus : saut demandé à 2 m du bord, parti avant que la lave ne le reprenne (il tombe : sous ≈ 6 m/s aucun saut ne passe)', () => {
    const sim = createRaceSim(world.track, CONFIG, { robots: true });
    const c = sim.cars[1];
    sim.cars.slice(2).forEach((car, k) => { car.driver = () => false; placeCar(car.body, 10 + 4 * k, () => 0, 0, CONFIG); });
    sim.cars[0].state.finishedAt = 0; // Galahad hors jeu (il freine sur place).
    c.driver = () => true;
    placeCar(c.body, F.xBord - 12, () => 0, 0, CONFIG);
    launchSolo({ ...sim, cars: [c] }, F.xBord - 12, 3, CONFIG);
    const jumps: number[] = [];
    let fell = false;
    while (sim.time < 8 && !fell) {
      stepRace(sim, false);
      for (const e of sim.events) {
        if (e.carId !== c.state.id) continue;
        if (e.type === 'jump') jumps.push(e.x);
        if (e.type === 'respawn') fell = true;
      }
    }
    expect(jumps.length).toBeGreaterThanOrEqual(1);
    expect(F.xBord - jumps[0]).toBeGreaterThan(1.5);
    expect(F.xBord - jumps[0]).toBeLessThanOrEqual(CONFIG.FOSSE_JUMP_MIN_DISTANCE + 1e-6);
    expect(fell).toBe(true);
  });
});

describe('5 voitures (respawn groupé)', () => {
  /** Course à 5 sur la piste à fosse, copains doigt posé dès t = 0, tous au point sûr xLancement + 1. */
  function five(): RaceSim {
    const sim = createRaceSim(world.track, CONFIG, { robots: true });
    for (const robot of sim.cars.slice(1)) robot.driver = () => true;
    const xSafe = F.xLancement + 1;
    for (const car of sim.cars) car.state.safePoint = { x: xSafe, y: 0, angle: 0 };
    return sim;
  }
  const box = (b: Matter.Body): Matter.Bounds => Matter.Bounds.create(b.vertices);
  const overlapsAt = (sim: RaceSim, carId: string): string[] => {
    const car = sim.cars.find((c) => c.state.id === carId)!;
    return sim.cars.filter((c) => c !== car && Matter.Bounds.overlaps(box(car.body.chassis), box(c.body.chassis)))
      .map((c) => `${carId}/${c.state.id} à t = ${sim.time.toFixed(3)}`);
  };
  /** Pose toutes les voitures sur la lave et fait des pas jusqu'à une réapparition de chacune. */
  function dropAll(sim: RaceSim, all: RespawnEvent[], overlaps: string[]): RespawnEvent[] {
    for (const car of sim.cars) placeCar(car.body, F.xLava, (x) => heightAt(world.track, x), 0, CONFIG);
    const first = new Map<string, RespawnEvent>();
    while (first.size < 5 && sim.time < 30) {
      stepRace(sim, true);
      for (const e of sim.events) {
        if (e.type !== 'respawn') continue;
        all.push(e);
        if (!first.has(e.carId)) first.set(e.carId, e);
        overlaps.push(...overlapsAt(sim, e.carId));
      }
    }
    return [...first.values()];
  }

  test('5 dans la fosse au même pas, point sûr xLancement + 1 : 5 respawns en file sans chevauchement, aucun garde-fou de vitesse', () => {
    const sim = five();
    const all: RespawnEvent[] = [];
    const overlaps: string[] = [];
    const firsts = dropAll(sim, all, overlaps);
    const report = firsts.map((e) => `${e.carId} ${e.reason} → ${e.target.x.toFixed(2)}`).join(' ; ');
    expect(firsts.every((e) => e.reason === 'lava'), report).toBe(true);
    expect(overlaps, report).toEqual([]);
    const xs = firsts.map((e) => e.target.x).sort((a, b) => b - a);
    expect(xs[0], report).toBeCloseTo(F.xLancement + 1, 6);
    for (let i = 1; i < xs.length; i++) expect(xs[i - 1] - xs[i], report).toBeGreaterThanOrEqual(1.5 * CONFIG.CAR_LENGTH - 1e-6);
    expect(all.filter((e) => e.reason === 'speed')).toEqual([]);
  });

  test('5 qui ratent toutes deux fois : posées à bord aval + 5, + 8,3, + 11,6… (vers l’aval, ruling R-F15), aucun garde-fou de vitesse', () => {
    const sim = five();
    const all: RespawnEvent[] = [];
    const overlaps: string[] = [];
    dropAll(sim, all, overlaps);
    const seconds = dropAll(sim, all, overlaps);
    const report = seconds.map((e) => `${e.carId} ${e.reason} → ${e.target.x.toFixed(2)}`).join(' ; ');
    expect(seconds.every((e) => e.reason === 'lava'), report).toBe(true);
    const gap = 1.5 * CONFIG.CAR_LENGTH;
    const xs = seconds.map((e) => e.target.x).sort((a, b) => a - b);
    xs.forEach((x, k) => expect(x, report).toBeCloseTo(F.xReception + CONFIG.FOSSE_RESPAWN_AFTER + k * gap, 6));
    expect(overlaps, report).toEqual([]);
    expect(all.filter((e) => e.reason === 'speed')).toEqual([]);
    // Toutes posées dans la zone fantôme de la fosse (bord aval + 40).
    for (const x of xs) expect(inGhostZone(world.track, x, CONFIG), report).toBe(true);
  });
});

describe('fantômes d’une fosse (zone [xLancement, bord aval + 40], ruling R-F16)', () => {
  /** Galahad et un copain sur la piste à fosse ; les trois autres garés loin derrière, à l'arrêt. */
  function duo(): { sim: RaceSim; g: CarSim; c: CarSim } {
    const sim = createRaceSim(world.track, CONFIG, { robots: true });
    sim.cars.slice(2).forEach((car, k) => {
      car.driver = () => false;
      placeCar(car.body, 10 + 4 * k, () => 0, 0, CONFIG);
    });
    return { sim, g: sim.cars[0], c: sim.cars[1] };
  }
  const pairsOf = (sim: RaceSim, a: CarSim, b: CarSim): number =>
    carPairsTouching(sim, new Set([a.state.id])).filter(([x, y]) => (x === b.state.id || y === b.state.id)).length;

  test('une voiture arrêtée au point sûr est traversée par une voiture lancée', () => {
    const { sim, g, c } = duo();
    c.driver = () => false;
    placeCar(c.body, F.xLancement + 4.99, () => 0, 0, CONFIG);
    placeCar(g.body, F.xLancement - 30, () => 0, 0, CONFIG);
    launchSolo({ ...sim, cars: [g] }, F.xLancement - 30, 14, CONFIG, 1);
    let pairs = 0;
    while (chassisX(g) < F.xLancement + 15 && sim.time < 6) { stepRace(sim, true); pairs += pairsOf(sim, g, c); }
    expect(chassisX(g)).toBeGreaterThan(chassisX(c) + 5);
    expect(pairs).toBe(0);
  });

  test('une voiture posée à bord aval + 5 est traversée par une voiture qui atterrit ; deux sauteurs qui se croisent en l’air ne se touchent pas', () => {
    // Le copain saute seul au centre de la fenêtre (driver provisoire) ; Galahad, plus rapide, saute juste après lui.
    const { sim, g, c } = duo();
    const parked = sim.cars[2];
    placeCar(parked.body, F.xReception + CONFIG.FOSSE_RESPAWN_AFTER, () => 0, 0, CONFIG);
    c.driver = () => true;
    placeCar(c.body, F.xBord - 35, () => 0, 0, CONFIG);
    launchSolo({ ...sim, cars: [c] }, F.xBord - 35, 11.2, CONFIG);
    placeCar(g.body, F.xBord - 60, () => 0, 0, CONFIG);
    launchSolo({ ...sim, cars: [g] }, F.xBord - 60, 18, CONFIG);
    let pairsGc = 0;
    let pairsLanded = 0;
    let crossedInAir = false;
    const respawns: RespawnEvent[] = [];
    while (chassisX(g) < F.xReception + 30 && sim.time < 10) {
      const want = fosseJumpWanted(world.track, chassisX(g), carSpeedMps(g.body), CONFIG);
      stepRace(sim, true, want);
      pairsGc += pairsOf(sim, g, c);
      pairsLanded += pairsOf(sim, g, parked) + pairsOf(sim, c, parked);
      respawns.push(...sim.events.filter((e): e is RespawnEvent => e.type === 'respawn'));
      if (!g.grounded && !c.grounded && Math.abs(chassisX(g) - chassisX(c)) < 1) crossedInAir = true;
    }
    expect(respawns.map((e) => `${e.carId} ${e.reason}`)).toEqual([]);
    expect(crossedInAir, 'les deux sauteurs se croisent en l’air').toBe(true);
    expect(pairsGc).toBe(0);
    expect(pairsLanded).toBe(0);
    expect(chassisX(g)).toBeGreaterThan(F.xReception + 30 - 1);
    expect(chassisX(c)).toBeGreaterThan(F.xReception + CONFIG.FOSSE_RESPAWN_AFTER);
  });
});

test('Galahad seul, doigt posé sans saut, première graine de 0 à 9 à ≥ 2 fosses : exactement 2 chutes par fosse, 0 au tremplin, arrivée < 240 s', () => {
  const seed = SEEDS.slice(0, 10).find((s) => fosses(tracks[s]).length >= 2)!;
  const track = trackFor(seed);
  const race = fiveCarRace(seed, { solo: true, jump: 'jamais' });
  const { r } = race;
  const nF = fosses(track).length;
  console.log(`course sans saut ${race.summary}`);
  expect(r.finishedAt, race.summary).not.toBeNull();
  expect(r.finishedAt!, race.summary).toBeLessThan(240);
  expect(race.falls.filter((f) => f.carId === 'galahad').map((f) => `${f.kind} ${f.cause}`), race.summary)
    .toEqual(Array.from({ length: 2 * nF }, () => 'fosse fosse'));
  expect(lavaSeries(r.respawnsByCar.galahad, track), race.summary).toEqual(Array.from({ length: nF }, () => 2));
  expect(r.respawnsByCar.galahad.filter((e) => e.reason !== 'lava'), race.summary).toEqual([]);
});
