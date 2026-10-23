// Conduite des robots dans le pas de course (plan B, tâche 6) : garde de `stepRace` (jamais de saut de copain dans
// [xLancement, xReception] d'un tremplin, demande gardée en mémoire comprise), robots polis sur la grille (Galahad
// arrêté n'est pas poussé pendant au moins 2 s, ruling Q8), saut de fosse d'un copain par son driver. Le driver seul,
// avec un contexte fabriqué à la main : tests/driver.test.ts. Mesures à 5 voitures : tests/slow/robots-sauts-*.test.ts.
import { makeRobotDriver, robotDraws, type Driver } from '../src/ai/driver';
import { fosseJumpLead } from '../src/cars/jump';
import { PILOTS } from '../src/cars/pilots';
import { takeStarFor } from '../src/cars/stars';
import { CONFIG } from '../src/config';
import { carSpeedMps, placeCar } from '../src/physics/car';
import { carPairsTouching } from '../src/sim/harness';
import { chassisX, createRaceSim, driverContext, stepRace, type RaceSim, type RespawnEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt, inNoJumpZone, slopeAt } from '../src/track/query';
import { flatFosseWorld, fossePiste } from './helpers/fosses';
import { launchSolo, setCarSpeed } from './helpers/jump-runs';
import { firstTremplin, trackFor } from './helpers/runs';

const PARKED: Driver = () => ({ throttle: false, jump: false });

describe('garde de stepRace : jamais de saut de copain dans la zone d’un tremplin', () => {
  const { track, v } = firstTremplin();
  const h = (x: number) => heightAt(track, x);

  /** Copain 1 lancé à 14 m/s 40 m avant le plat de lancement, conduit par `driver` ; les autres voitures garées au départ. */
  function run(driver: Driver): { jumps: number[]; sim: RaceSim } {
    const sim = createRaceSim(track, CONFIG, { robots: true });
    sim.cars.forEach((car, k) => {
      if (k === 1) return;
      car.driver = k === 0 ? null : PARKED;
      placeCar(car.body, 10 + 4 * k, h, 0, CONFIG);
    });
    const c = sim.cars[1];
    c.driver = driver;
    const x0 = v.xLancement - 40;
    placeCar(c.body, x0, h, slopeAt(track, x0), CONFIG);
    launchSolo({ ...sim, cars: [c] }, x0, 14, CONFIG);
    const jumps: number[] = [];
    while (chassisX(c) < v.xReception + 40 && sim.time < 14) {
      stepRace(sim, false);
      for (const e of sim.events) if (e.type === 'jump' && e.carId === c.state.id) jumps.push(e.x);
    }
    return { jumps, sim };
  }

  test('un driver qui demande le saut à chaque pas : aucun saut dans [xLancement, xReception], des sauts avant et après', () => {
    const { jumps } = run(() => ({ throttle: true, jump: true }));
    expect(jumps.filter((x) => inNoJumpZone(track, x))).toEqual([]);
    expect(jumps.some((x) => x < v.xLancement)).toBe(true);
    expect(jumps.some((x) => x > v.xReception)).toBe(true);
  });

  test('une demande gardée en mémoire (délai pas écoulé) juste avant xLancement est oubliée dans la zone ; plus tôt, elle part', () => {
    /** Copain au sol, lancé à 14 m/s à `dx` m avant xLancement, encore 0,05 s de délai JUMP_COOLDOWN ; demande tant que x < xLancement. */
    const jumpsFrom = (dx: number): number[] => {
      const sim = createRaceSim(track, CONFIG, { robots: true });
      sim.cars.forEach((car, k) => {
        if (k === 1) return;
        car.driver = k === 0 ? null : PARKED;
        placeCar(car.body, 10 + 4 * k, h, 0, CONFIG);
      });
      const c = sim.cars[1];
      c.driver = (ctx) => ({ throttle: true, jump: ctx.x < v.xLancement });
      placeCar(c.body, v.xLancement - dx, h, 0, CONFIG);
      launchSolo({ ...sim, cars: [c] }, v.xLancement - dx, 14, CONFIG);
      c.state.lastJumpAt = sim.time - (CONFIG.JUMP_COOLDOWN - 0.05);
      const jumps: number[] = [];
      while (sim.time < 1) {
        stepRace(sim, false);
        for (const e of sim.events) if (e.type === 'jump' && e.carId === c.state.id) jumps.push(e.x);
      }
      return jumps;
    };
    // 0,3 m avant : la dernière demande (x < xLancement) attend la fin du délai, 3 pas plus tard, dans la zone.
    expect(jumpsFrom(0.3)).toEqual([]);
    // 3 m avant : le délai finit avant la zone, la demande part (la mémoire de la demande fonctionne).
    const early = jumpsFrom(3);
    expect(early).toHaveLength(1);
    expect(early[0]).toBeLessThan(v.xLancement);
  });
});

describe('garde des demandes d’un pilote automatique : Galahad dans la variante « sauteur » (code-review 3)', () => {
  test('Galahad, demande à chaque pas : avec autoJumps, aucun saut dans [xLancement, xReception] ; sans (le doigt de l’enfant), il peut y sauter', () => {
    const { track, v } = firstTremplin();
    const h = (x: number) => heightAt(track, x);
    const run = (autoJumps: boolean): number[] => {
      const sim = createRaceSim(track, CONFIG);
      const g = sim.cars[0];
      g.autoJumps = autoJumps;
      const x0 = v.xLancement - 40;
      placeCar(g.body, x0, h, slopeAt(track, x0), CONFIG);
      launchSolo(sim, x0, 14, CONFIG);
      const jumps: number[] = [];
      while (chassisX(g) < v.xReception + 40 && sim.time < 14) {
        stepRace(sim, true, true);
        for (const e of sim.events) if (e.type === 'jump') jumps.push(e.x);
      }
      return jumps;
    };
    expect(run(true).filter((x) => inNoJumpZone(track, x))).toEqual([]);
    expect(run(false).filter((x) => inNoJumpZone(track, x)).length).toBeGreaterThan(0);
  });
});

describe('contexte réel du driver (`driverContext`, relecture standard I1)', () => {
  test('prochaine fosse : null au-delà de JUMP_LOOKAHEAD ; tentative 1, puis 2 après une chute dans cette fosse, et encore 2 après un retournement', () => {
    const { track, f } = fossePiste();
    const sim = createRaceSim(track, CONFIG, { robots: true });
    sim.cars.forEach((car, k) => {
      if (k > 0) car.driver = PARKED;
      placeCar(car.body, 10 + 4 * k, () => 0, 0, CONFIG);
    });
    const c = sim.cars[1];
    placeCar(c.body, f.xBord - CONFIG.JUMP_LOOKAHEAD - 0.5, () => 0, 0, CONFIG);
    expect(driverContext(sim, 1).nextFosse).toBeNull();
    placeCar(c.body, f.xBord - CONFIG.JUMP_LOOKAHEAD + 0.5, () => 0, 0, CONFIG);
    expect(driverContext(sim, 1).nextFosse).toEqual({ xBord: f.xBord, index: 0, attempt: 1 });
    // Chute dans la lave : réapparition au point sûr (début de l'approche), tentative 2.
    c.state.safePoint = { x: f.xLancement + 1, y: 0, angle: 0 };
    placeCar(c.body, f.xLava, () => 0, 0, CONFIG);
    const respawns: RespawnEvent[] = [];
    const until = (n: number) => {
      while (respawns.length < n && sim.time < 10) {
        stepRace(sim, false);
        respawns.push(...sim.events.filter((e): e is RespawnEvent => e.type === 'respawn' && e.carId === c.state.id));
      }
    };
    until(1);
    expect(respawns.map((e) => e.reason)).toEqual(['lava']);
    expect(driverContext(sim, 1).nextFosse).toEqual({ xBord: f.xBord, index: 0, attempt: 2 });
    // Retournée sur l'approche : autre réapparition, la tentative reste comptée par fosse (code-review 5).
    placeCar(c.body, f.xLancement + 10, () => 0, Math.PI, CONFIG);
    until(2);
    expect(respawns[1].reason).toMatch(/^(flipped|side)$/);
    expect(driverContext(sim, 1).nextFosse).toEqual({ xBord: f.xBord, index: 0, attempt: 2 });
  });

  test('étoile haute : prise par la voiture i, indisponible pour i et disponible pour j ; autres voitures sans i, dans l’ordre, telles que l’instantané', () => {
    const track = trackFor(0);
    const k = track.stars.findIndex((s) => s.high);
    const star = track.stars[k];
    const sim = createRaceSim(track, CONFIG, { robots: true });
    const h = (x: number) => heightAt(track, x);
    sim.cars.forEach((car, i) => placeCar(car.body, star.x - 30 + 3 * i, h, slopeAt(track, star.x - 30 + 3 * i), CONFIG));
    sim.cars[3].invulnerable = true;
    sim.cars[4].throttle = true;
    sim.cars[1].state.finishedAt = 0;
    takeStarFor(sim.stars[k], 1, sim.time);
    expect(driverContext(sim, 1).nextHighStar).toEqual({ index: k, x: star.x, available: false });
    expect(driverContext(sim, 2).nextHighStar).toEqual({ index: k, x: star.x, available: true });
    const ctx = driverContext(sim, 2);
    expect(ctx.x).toBeCloseTo(chassisX(sim.cars[2]), 12);
    // Tâche 7, tour 1 : Galahad marqué (`galahad`, index 0) et arrivée de chaque voiture (`finished`).
    expect(ctx.others).toEqual([0, 1, 3, 4].map((j) => ({
      index: j, x: chassisX(sim.cars[j]), speed: carSpeedMps(sim.cars[j].body), throttle: j === 4, traversable: j === 3,
      galahad: j === 0, finished: j === 1,
    })));
    // Au-delà de JUMP_LOOKAHEAD : aucune étoile.
    placeCar(sim.cars[2].body, star.x - CONFIG.JUMP_LOOKAHEAD - 0.5, h, 0, CONFIG);
    expect(driverContext(sim, 2).nextHighStar).toBeNull();
  });
});

describe('raté tardif rendu visible (décision du papa, tour 2) : une erreur trop tardive devient un saut trop tôt du même écart', () => {
  const { world, f } = flatFosseWorld();
  // Pablo avec une erreur à la 1re tentative très en retard (< −1 s ; graine 72, −1,05 s) : visé à fosseJumpLead(v) − e,
  // plus d'une seconde trop tôt.
  const pablo = PILOTS.find((p) => p.id === 'pablo')!;
  const seed = Array.from({ length: 4000 }, (_, s) => s).find((s) => robotDraws(pablo, 1, world.track, s, CONFIG).fosseErr[0][0] < -1)!;
  const err = robotDraws(pablo, 1, world.track, seed, CONFIG).fosseErr[0][0];
  /**
   * s de vol exigées entre le saut et la reprise par la lave. MESURÉ (sonde du tour 2, piste plate, 3 à 21 m/s, 6 phases) :
   * 1,93 à 1,97 s partout, sans aucune chute sans saut. L'ancienne règle (tour 1, saut au dernier pas permis) sautait
   * 0 à 2 pas (≤ 0,033 s) avant la reprise ; ou pas du tout : toujours jusqu'à ≈ 10,5 m/s, et selon la phase du pas entre
   * ≈ 10,5 et 11,25 m/s (re-relecture du tour 1 : 10 m/s 6 phases sur 6, 11 m/s 1 sur 6, 11,25 m/s 2 sur 6).
   */
  const VOL_MIN = 1;

  // MESURÉ : de 3 à 17,5 m/s, saut à 5,1 m (3 m/s) … 31,6 m (17,5 m/s) du bord, la voiture retombe dans la fosse 1,93 s
  // après ; à 21 m/s, le saut visé (1,86 s, 39 m) est avant l'approche : il part au début de l'approche (32,35 m) et
  // retombe au bord aval, dans la lave (5 phases sur 6) ou juste après (la phase de ce test).
  test.each([3, 8, 11.25, 14, 17.5, 21])('%s m/s tenus : un seul saut, à fosseJumpLead(v) − e (ou au début de l’approche), puis au moins VOL_MIN de vol avant la lave', (v) => {
    const sim = createRaceSim(world.track, CONFIG, { robots: true, pilotSeed: seed });
    sim.cars.forEach((car, k) => {
      if (k > 1) car.driver = PARKED;
      if (k !== 1) placeCar(car.body, 10 + 4 * k, () => 0, 0, CONFIG);
    });
    sim.cars[0].state.finishedAt = 0;
    const c = sim.cars[1];
    c.driver = makeRobotDriver(pablo, 1, world.track, seed, CONFIG);
    const x0 = f.xLancement - 30;
    placeCar(c.body, x0, () => 0, 0, CONFIG);
    launchSolo({ ...sim, cars: [c] }, x0, v, CONFIG);
    const jumps: { d: number; v: number; t: number }[] = [];
    const respawns: { reason: string; t: number }[] = [];
    while (chassisX(c) < f.xReception + 30 && sim.time < 40 && respawns.length === 0) {
      // Vitesse vue par le driver au début du pas.
      const speed = carSpeedMps(c.body);
      stepRace(sim, false);
      for (const e of sim.events) {
        if (e.carId !== c.state.id) continue;
        if (e.type === 'jump') jumps.push({ d: f.xBord - e.x, v: speed, t: e.t });
        if (e.type === 'respawn') respawns.push({ reason: e.reason, t: e.t });
      }
    }
    const flight = respawns.length && jumps.length ? respawns[0].t - jumps[0].t : null;
    console.log(`raté tardif à ${v} m/s (e = ${err.toFixed(3)} s) : sauts à ${jumps.map((j) => `${j.d.toFixed(2)} m (${j.v.toFixed(2)} m/s)`).join(', ') || 'aucun'} du bord, `
      + `réapparitions [${respawns.map((r) => r.reason).join(', ')}]${flight === null ? '' : `, ${flight.toFixed(3)} s après le saut`}`);
    expect(jumps).toHaveLength(1);
    const [j] = jumps;
    // Visé plus tôt que le centre du même écart, borné par le début de l'approche.
    const aim = Math.min((fosseJumpLead(j.v, CONFIG) - err) * j.v, f.xBord - f.xLancement);
    expect(j.d).toBeLessThanOrEqual(aim + 0.05);
    expect(j.d).toBeGreaterThan(aim - j.v * CONFIG.PHYSICS_DT - 0.05);
    if (v <= 17.5) expect(respawns.map((r) => r.reason)).toEqual(['lava']);
    else expect(respawns.map((r) => r.reason)).toEqual(respawns.length ? ['lava'] : []);
    // Le raté se voit : la voiture décolle et vole avant la reprise par la lave.
    if (flight !== null) expect(flight).toBeGreaterThanOrEqual(VOL_MIN);
  });
});

describe('robots polis sur la grille : départ à 0,3 s × rang derrière une voiture qui démarre', () => {
  test.each([0, 1, 2])('graine %i : Galahad doigt posé dès 0 : chaque copain parcourt 0,3 m avant rang × 0,3 + 0,45 s', (seed) => {
    const sim = createRaceSim(trackFor(seed), CONFIG, { robots: true });
    const x0 = sim.cars.map(chassisX);
    const moved: (number | null)[] = sim.cars.map(() => null);
    while (sim.time < 3) {
      stepRace(sim, true);
      sim.cars.forEach((c, i) => { if (moved[i] === null && chassisX(c) - x0[i] > 0.3) moved[i] = sim.time; });
    }
    console.log(`départ graine ${seed} : ${moved.map((m, i) => `rang ${i} ${m?.toFixed(2)} s`).join(', ')}`);
    moved.forEach((m, i) => expect(m!, `rang ${i}`).toBeLessThan(i * CONFIG.START_DELAY_PER_RANK + 0.45));
  });
});

describe('robots polis sur la grille : Galahad arrêté n’est pas poussé pendant au moins 2 s (ruling Q8)', () => {
  test.each([0, 1, 2])('graine %i : aucun contact avec Galahad avant 2 s, Galahad bouge de moins de 0,5 m ; le copain de rang 1 attend tant que Galahad lève le doigt, les autres repartent après POLITE_MAX_WAIT', (seed) => {
    const sim = createRaceSim(trackFor(seed), CONFIG, { robots: true });
    const g = sim.cars[0];
    const x0 = chassisX(g);
    let firstContact: number | null = null;
    let xAt2 = NaN;
    let rank1Throttle = 0;
    while (sim.time < 6) {
      stepRace(sim, false);
      if (sim.cars[1].throttle) rank1Throttle++;
      if (firstContact === null && carPairsTouching(sim, new Set([g.state.id])).length > 0) firstContact = sim.time;
      if (Number.isNaN(xAt2) && sim.time >= 2) xAt2 = chassisX(g);
    }
    console.log(`grille graine ${seed} : premier contact avec Galahad à ${firstContact?.toFixed(2) ?? 'jamais'} s ; `
      + `copains à 6 s : ${sim.cars.slice(1).map((c) => `${c.state.id} ${(chassisX(c) - x0).toFixed(1)} m`).join(', ')}`);
    expect(firstContact === null || firstContact >= 2).toBe(true);
    expect(Math.abs(xAt2 - x0)).toBeLessThan(0.5);
    // Tâche 7, tour 1 (décision du papa) : le copain de rang 1, à 3,3 m derrière Galahad doigt levé, garde le doigt levé
    // les 6 s, sans limite de durée ; les copains de rang 2 à 4, polis derrière lui (voiture arrêtée), repartent après
    // POLITE_MAX_WAIT et poussent la file : le contact avec Galahad vient au plus tôt après leur attente (MESURÉ 4,93 s).
    expect(rank1Throttle).toBe(0);
    expect(firstContact).not.toBeNull();
    expect(firstContact!).toBeGreaterThanOrEqual(2 * CONFIG.START_DELAY_PER_RANK + CONFIG.POLITE_MAX_WAIT - 1e-9);
  });
});

describe('poli derrière Galahad doigt levé, dans le vrai pas de course (décision du papa, relectures de la tâche 7)', () => {
  /**
   * Galahad et un copain sur un plat, copain à `gap` m derrière lui, tous deux lancés à 10 m/s ; Galahad lève le doigt
   * pendant `liftSeconds` ; les autres copains garés au départ. Doigt du copain à chaque pas, contacts avec Galahad.
   */
  function run(gap: number, opts: { liftSeconds?: number; ghost?: boolean; finished?: boolean } = {}) {
    const track = generateTrack(1, 600, CONFIG, { onlyPlat: true });
    const sim = createRaceSim(track, CONFIG, { robots: true });
    for (const star of sim.stars) star.takenAt.forEach((_, k) => takeStarFor(star, k, 1e9));
    sim.cars.forEach((car, k) => {
      if (k > 1) { car.driver = PARKED; placeCar(car.body, 5 + 4 * k, () => 0, 0, CONFIG); }
    });
    const [g, c] = sim.cars;
    placeCar(g.body, 200, () => 0, 0, CONFIG);
    placeCar(c.body, 200 - gap, () => 0, 0, CONFIG);
    launchSolo(sim, 200, 10, CONFIG, 1);
    setCarSpeed(c, track, 200 - gap, 10, CONFIG);
    sim.time = 10; // départ et neutre passés
    g.throttle = true; // doigt de Galahad posé au pas d'avant le lever
    if (opts.finished) g.state.finishedAt = 9;
    const lift = opts.liftSeconds ?? 3;
    const throttles: boolean[] = [];
    let contacts = 0;
    const t0 = sim.time;
    while (sim.time < t0 + lift) {
      if (opts.ghost) g.invulnerable = true;
      stepRace(sim, false);
      throttles.push(c.throttle);
      if (carPairsTouching(sim, new Set([g.state.id])).length > 0) contacts++;
    }
    return { throttles, contacts, c };
  }

  test('copain à 3 m derrière Galahad qui lève le doigt : il lève le pied à chaque pas (après le premier, lu au pas précédent), aucun contact', () => {
    const r = run(3);
    expect(r.throttles[0]).toBe(true); // doigt de Galahad posé au pas d'avant (lancé)
    expect(r.throttles.slice(1).every((th) => !th)).toBe(true);
    expect(r.contacts).toBe(0);
  });

  test('copain à 6 m derrière : doigt posé (il rattrape Galahad, puis lève le pied à moins de 4 m)', () => {
    const r = run(6);
    expect(r.throttles.slice(0, 5).every((th) => th)).toBe(true);
    expect(r.throttles.some((th) => !th)).toBe(true);
  });

  test('Galahad invulnérable (traversable) ou arrivé : le copain garde le doigt posé', () => {
    expect(run(3, { ghost: true }).throttles.every((th) => th)).toBe(true);
    expect(run(3, { finished: true }).throttles.every((th) => th)).toBe(true);
  });
});

describe('saut de fosse d’un copain par son driver', () => {
  test('copain sans erreur (jumpSkill 0) lancé à 14 m/s : un seul saut, au centre fosseJumpLead(14), il passe la fosse', () => {
    const { world, f } = flatFosseWorld();
    const sim = createRaceSim(world.track, CONFIG, { robots: true });
    sim.cars.forEach((car, k) => {
      if (k === 1) return;
      if (k > 0) car.driver = PARKED;
      placeCar(car.body, 10 + 4 * k, () => 0, 0, CONFIG);
    });
    sim.cars[0].state.finishedAt = 0; // Galahad hors jeu.
    const c = sim.cars[1];
    c.driver = makeRobotDriver({ ...c.pilot, jumpSkill: 0 }, 1, world.track, sim.pilotSeed, CONFIG);
    const x0 = f.xLancement - 30;
    placeCar(c.body, x0, () => 0, 0, CONFIG);
    launchSolo({ ...sim, cars: [c] }, x0, 14, CONFIG);
    const jumps: number[] = [];
    const respawns: string[] = [];
    while (chassisX(c) < f.xReception + 30 && sim.time < 8) {
      stepRace(sim, false);
      for (const e of sim.events) {
        if (e.carId !== c.state.id) continue;
        if (e.type === 'jump') jumps.push(e.x);
        if (e.type === 'respawn') respawns.push(e.reason);
      }
    }
    expect(respawns).toEqual([]);
    expect(jumps).toHaveLength(1);
    expect((f.xBord - jumps[0]) / 14).toBeLessThanOrEqual(0.71 + 0.02);
    expect((f.xBord - jumps[0]) / 14).toBeGreaterThan(0.71 - 0.05);
  });
});
