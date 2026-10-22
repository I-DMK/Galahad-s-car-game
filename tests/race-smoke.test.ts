// Courses complètes en CI. Cas 6 de l'addendum §1.7 (Galahad seul, graine 1, ≈ 20 s ; graines 0 à 4 :
// tests/slow/finish.test.ts). Course à 5 voitures (tâche 5b, addendum §2) : graines 1 et 2, doigt
// posé, invariants de tests/helpers/race.ts (graines 0 à 23 : tests/slow/race-invariants-*.test.ts).
// « 5 dans la lave » (review focus du plan) : respawn groupé sur le même point sûr.
import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import { placeCar } from '../src/physics/car';
import { simulateRace } from '../src/sim/harness';
import { createRaceSim, stepRace, type RaceSim, type SimEvent } from '../src/sim/simulate';
import { heightAt } from '../src/track/query';
import { expectRaceInvariants, fiveCarRace } from './helpers/race';
import { sauteurParfait } from './helpers/fosses';
import { FINISH_MAX_SECONDS, FINISH_MIN_SECONDS, describeRespawns, f2, firstTremplin, trackFor } from './helpers/runs';

type RespawnEvent = Extract<SimEvent, { type: 'respawn' }>;

const SEED = 1;
const MAX_SECONDS = 180;

// Tâche 5g : Galahad saute au centre de chaque fosse (`sauteurParfait`), sans quoi il y tombe deux fois (saut §6.1).
test(`cas 6, seed ${SEED} : course doigt posé avec le saut parfait aux fosses, sans réapparition, arrivée entre ${FINISH_MIN_SECONDS} et ${FINISH_MAX_SECONDS} s, 6 à 14 étoiles prises`, () => {
  const track = trackFor(SEED);
  // Défaut : Galahad seul (plan A).
  const r = simulateRace(track, { throttle: () => true, maxSeconds: MAX_SECONDS, cfg: CONFIG, jump: sauteurParfait(track) });
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

describe('course à 5 voitures, doigt posé (copains à leur driver, tâche 6)', () => {
  test.each([1, 2])('seed %i : ≤ 3 respawns par voiture, aucun garde-fou de vitesse, personne bloqué > 2 s, Galahad arrive', (seed) => {
    const race = fiveCarRace(seed);
    console.log(`course à 5 ${race.summary}`);
    expectRaceInvariants(race);
    // Arrêt à l'arrivée de Galahad + FINISH_COAST_SECONDS.
    expect(race.r.time - race.r.finishedAt!).toBeCloseTo(CONFIG.FINISH_COAST_SECONDS, 1);
  });
});

/** Boîte englobante d'un châssis, d'après ses sommets (sans l'extension par la vitesse de Matter). */
const box = (b: Matter.Body): Matter.Bounds => Matter.Bounds.create(b.vertices);

/** Paires (car, autre) dont les boîtes englobantes des châssis se chevauchent. */
function overlapsWith(sim: RaceSim, carId: string): string[] {
  const car = sim.cars.find((c) => c.state.id === carId)!;
  const a = box(car.body.chassis);
  return sim.cars
    .filter((c) => c !== car && Matter.Bounds.overlaps(a, box(c.body.chassis)))
    .map((c) => `${carId}/${c.state.id} à t = ${sim.time.toFixed(3)}`);
}

test('5 dans la lave d’un tremplin au même pas, même point sûr (xLancement + 1) : 5 respawns en file sans chevauchement, aucun garde-fou de vitesse', () => {
  const { track, v } = firstTremplin();
  const h = (x: number) => heightAt(track, x);
  const sim = createRaceSim(track, CONFIG, { robots: true });
  // Doigt posé pour tous dès le respawn : pas de délai de grille dans ce scénario (t = 0).
  for (const robot of sim.cars.slice(1)) robot.driver = () => ({ throttle: true, jump: false });
  const xSafe = v.xLancement + 1;
  for (const car of sim.cars) {
    car.state.safePoint = { x: xSafe, y: h(xSafe), angle: 0 };
    placeCar(car.body, v.xLava, h, 0, CONFIG);
  }
  const first = new Map<string, RespawnEvent>();
  const all: RespawnEvent[] = [];
  const overlaps: string[] = [];
  const collect = (): void => {
    for (const e of sim.events) {
      if (e.type !== 'respawn') continue;
      all.push(e);
      if (!first.has(e.carId)) first.set(e.carId, e);
      overlaps.push(...overlapsWith(sim, e.carId));
    }
  };
  while (sim.time < 3 && first.size < 5) { stepRace(sim, true); collect(); }
  const firsts = [...first.values()];
  const report = firsts.map((e) => `${e.carId} t=${e.t.toFixed(3)} ${e.reason} → x=${f2(e.target.x)}`).join(' ; ');
  expect(first.size, report).toBe(5);
  expect(firsts.every((e) => e.reason === 'lava'), report).toBe(true);
  const tLast = Math.max(...firsts.map((e) => e.t));
  expect(tLast, report).toBeLessThanOrEqual(3);
  while (sim.time < tLast + 5) { stepRace(sim, true); collect(); }
  const later = all.slice(firsts.length).map((e) => `${e.carId} ${e.reason}@${e.t.toFixed(2)} x=${f2(e.x)}→${f2(e.target.x)}`);
  console.log(`5 dans la lave (xLava ${f2(v.xLava)}, point sûr ${f2(xSafe)}) : ${report} ; ensuite : [${later.join(' ; ')}]`);
  expect(overlaps, report).toEqual([]);
  expect(all.filter((e) => e.reason === 'speed'), later.join(' ; ')).toEqual([]);
  // Galahad, en tête de la file, ne retombe pas dans la lave dans les 5 s.
  expect(all.slice(firsts.length).filter((e) => e.carId === 'galahad' && e.reason === 'lava'), later.join(' ; ')).toEqual([]);
  // Cibles en file, 1,5 × CAR_LENGTH entre deux voitures, la première au point sûr.
  const xs = firsts.map((e) => e.target.x).sort((a, b) => b - a);
  expect(xs[0]).toBeCloseTo(xSafe, 6);
  for (let i = 1; i < xs.length; i++) {
    expect(xs[i - 1] - xs[i], report).toBeGreaterThanOrEqual(CONFIG.RESPAWN_GROUP_SPACING_FACTOR * CONFIG.CAR_LENGTH - 1e-6);
  }
});
