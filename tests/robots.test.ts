// Conduite des robots dans le pas de course (plan B, tâche 6) : garde de `stepRace` (jamais de saut de copain dans
// [xLancement, xReception] d'un tremplin, demande gardée en mémoire comprise), robots polis sur la grille (Galahad
// arrêté n'est pas poussé pendant au moins 2 s, ruling Q8), saut de fosse d'un copain par son driver. Le driver seul,
// avec un contexte fabriqué à la main : tests/driver.test.ts. Mesures à 5 voitures : tests/slow/robots-sauts-*.test.ts.
import { makeRobotDriver, type Driver } from '../src/ai/driver';
import { CONFIG } from '../src/config';
import { placeCar } from '../src/physics/car';
import { carPairsTouching } from '../src/sim/harness';
import { chassisX, createRaceSim, stepRace, type RaceSim } from '../src/sim/simulate';
import { heightAt, inNoJumpZone, slopeAt } from '../src/track/query';
import { flatFosseWorld } from './helpers/fosses';
import { launchSolo } from './helpers/jump-runs';
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

describe('robots polis sur la grille : Galahad arrêté n’est pas poussé pendant au moins 2 s (ruling Q8)', () => {
  test.each([0, 1, 2])('graine %i : aucun contact avec Galahad avant 2 s, Galahad bouge de moins de 0,5 m ; les copains repartent après POLITE_MAX_WAIT', (seed) => {
    const sim = createRaceSim(trackFor(seed), CONFIG, { robots: true });
    const g = sim.cars[0];
    const x0 = chassisX(g);
    let firstContact: number | null = null;
    let xAt2 = NaN;
    while (sim.time < 6) {
      stepRace(sim, false);
      if (firstContact === null && carPairsTouching(sim, new Set([g.state.id])).length > 0) firstContact = sim.time;
      if (Number.isNaN(xAt2) && sim.time >= 2) xAt2 = chassisX(g);
    }
    console.log(`grille graine ${seed} : premier contact avec Galahad à ${firstContact?.toFixed(2) ?? 'jamais'} s ; `
      + `copains à 6 s : ${sim.cars.slice(1).map((c) => `${c.state.id} ${(chassisX(c) - x0).toFixed(1)} m`).join(', ')}`);
    expect(firstContact === null || firstContact >= 2).toBe(true);
    expect(Math.abs(xAt2 - x0)).toBeLessThan(0.5);
    // Après l'attente maximale, le copain de rang 1 repart : il est contre Galahad à 6 s.
    expect(firstContact).not.toBeNull();
    expect(firstContact!).toBeGreaterThanOrEqual(CONFIG.START_DELAY_PER_RANK + CONFIG.POLITE_MAX_WAIT - 1e-9);
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
