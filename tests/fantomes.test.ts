// Voitures fantômes près des volcans (tâche 5b, tours 2 et 3, décision du papa) : du début du plat de
// lancement jusqu'à ce que la roue arrière ait passé xReception, les voitures se traversent ; partout
// ailleurs elles se cognent. En sortant de la zone en roulant, une voiture reste fantôme tant qu'une de
// ses pièces chevauche une autre voiture ; un respawn (téléportation) recalcule l'état à la cible.
import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import { placeCar } from '../src/physics/car';
import { CAT } from '../src/physics/world';
import { carPairsTouching } from '../src/sim/harness';
import { chassisX, createRaceSim, stepRace, type CarSim, type RaceSim, type SimEvent } from '../src/sim/simulate';
import { heightAt, inGhostZone, slopeAt } from '../src/track/query';
import { firstTremplin } from './helpers/runs';

type RespawnEvent = Extract<SimEvent, { type: 'respawn' }>;

const { track, v } = firstTremplin();
const h = (x: number) => heightAt(track, x);
const place = (car: CarSim, x: number): void => placeCar(car.body, x, h, slopeAt(track, x), CONFIG);

/** Course à 5 voitures, copains à l'arrêt (conduite coupée). */
function parked(): RaceSim {
  const sim = createRaceSim(track, CONFIG, { robots: true });
  for (const robot of sim.cars.slice(1)) robot.driver = () => ({ throttle: false, jump: false });
  return sim;
}

/** Paires actives entre deux voitures différentes au dernier pas, lisibles dans un message d'assertion. */
const carPairs = (sim: RaceSim): string[] => carPairsTouching(sim).map(([a, b]) => `${a}/${b} à t = ${sim.time.toFixed(3)}`);
/** Une pièce de `a` chevauche-t-elle une pièce de `b` ? */
const overlap = (a: CarSim, b: CarSim): boolean => a.body.parts.some((p) => Matter.Query.collides(p, b.body.parts).length > 0);
/** Bits « voitures » (CAT.ALL_CARS) du masque de chaque pièce : 0 = traverse les autres voitures. */
const carBits = (car: CarSim): number[] => car.body.parts.map((p) => (p.collisionFilter.mask ?? 0) & CAT.ALL_CARS);
const SOLID = [CAT.ALL_CARS, CAT.ALL_CARS, CAT.ALL_CARS];
const PASS = [0, 0, 0];

test('dans la zone, deux voitures posées en chevauchement se traversent ; hors zone, à distance de contact, elles se cognent', () => {
  const sim = parked();
  const [a, b] = sim.cars;
  const x = v.xLancement + 10;
  expect(inGhostZone(track, x, CONFIG) && inGhostZone(track, x - 1, CONFIG)).toBe(true);
  place(a, x);
  place(b, x - 1); // châssis recouverts sur 1,2 m
  expect(overlap(a, b)).toBe(true);
  const pairs: string[] = [];
  for (let i = 0; i < 60; i++) { stepRace(sim, false); pairs.push(...carPairs(sim)); }
  expect(pairs).toEqual([]);
  expect([a.ghost, b.ghost]).toEqual([true, true]);
  expect([carBits(a), carBits(b)]).toEqual([PASS, PASS]);
  expect(overlap(a, b)).toBe(true); // aucune impulsion ne les a séparées

  // Hors zone (plat qui précède le plat de lancement), roue contre roue : collision.
  const out = parked();
  const [c, d] = out.cars;
  const y = v.xLancement - 8;
  expect(inGhostZone(track, y, CONFIG) || inGhostZone(track, y - 2.35, CONFIG)).toBe(false);
  place(c, y);
  place(d, y - 2.35); // roues engagées de 5 cm, châssis à 15 cm
  const hits: string[] = [];
  for (let i = 0; i < 10; i++) { stepRace(out, false); hits.push(...carPairs(out)); }
  expect(hits.length).toBeGreaterThan(0);
  expect([c.ghost, d.ghost]).toEqual([false, false]);
});

test('une voiture plus rapide rattrape une autre sur l’élan : elle la traverse sans paire active, aucune ne tombe dans la lave', () => {
  const sim = parked();
  const [g, slow] = sim.cars;
  // Copain lent (≤ 0,7 m/s) au début du plat d'élan ; Galahad part arrêté de xLancement + 1, doigt posé.
  slow.driver = () => ({ throttle: true, jump: false });
  slow.factor = 0.05;
  const xSlow = v.xElanStart - 1;
  place(g, v.xLancement + 1);
  place(slow, xSlow);
  const pairs: string[] = [];
  const respawns: RespawnEvent[] = [];
  let crossedAt: number | null = null;
  while (chassisX(g) < v.xReception + 5 && sim.time < 12) {
    stepRace(sim, true);
    pairs.push(...carPairs(sim));
    respawns.push(...sim.events.filter((e): e is RespawnEvent => e.type === 'respawn'));
    if (crossedAt === null && overlap(g, slow)) crossedAt = chassisX(g);
  }
  expect(crossedAt, 'Galahad n’a pas rattrapé le copain').not.toBeNull();
  // Rattrapé sur le plat d'élan, avant la rampe.
  expect(crossedAt!).toBeGreaterThan(v.xElanStart - 2.4);
  expect(crossedAt!).toBeLessThan(v.xRampStart);
  expect(pairs).toEqual([]);
  expect(respawns.map((e) => `${e.carId} ${e.reason}`)).toEqual([]);
  expect(chassisX(g)).toBeGreaterThanOrEqual(v.xReception + 5);
  expect(chassisX(slow)).toBeLessThan(v.xRampStart); // le copain lent n'a pas encore abordé la rampe
});

test('deux voitures qui se chevauchent en sortant de la zone restent fantômes jusqu’à séparation, puis se cognent ; aucun garde-fou de vitesse', () => {
  const sim = parked();
  const [g, r] = sim.cars;
  const respawns: RespawnEvent[] = [];
  const pairs: string[] = [];
  const step = (galahadThrottle: boolean): void => {
    stepRace(sim, galahadThrottle);
    respawns.push(...sim.events.filter((e): e is RespawnEvent => e.type === 'respawn'));
  };
  // 1. Fantômes dans la zone, posées en chevauchement (0,5 m d'écart) ; puis sorties ensemble, toujours
  // recouvertes, sur le plat de réception (juste avant xReception, c'est le flanc aval du cratère).
  place(g, v.xLancement + 10);
  place(r, v.xLancement + 9.5);
  step(false);
  expect([g.ghost, r.ghost]).toEqual([true, true]);
  place(g, v.xReception + 2.5);
  place(r, v.xReception + 2);
  expect(inGhostZone(track, chassisX(g), CONFIG) || inGhostZone(track, chassisX(r), CONFIG)).toBe(false);
  // Même conduite bridée à 4,2 m/s : elles roulent ensemble, recouvertes, hors zone.
  g.factor = 0.3;
  r.factor = 0.3;
  r.driver = () => ({ throttle: true, jump: false });
  for (let i = 0; i < 60; i++) { step(true); pairs.push(...carPairs(sim)); }
  expect(inGhostZone(track, chassisX(g), CONFIG) || inGhostZone(track, chassisX(r), CONFIG)).toBe(false);
  expect(overlap(g, r)).toBe(true);
  expect([g.ghost, r.ghost]).toEqual([true, true]);
  expect([carBits(g), carBits(r)]).toEqual([PASS, PASS]);
  // 2. Galahad accélère, le copain lève le pied : elles se séparent, toujours sans se toucher.
  g.factor = 1;
  r.driver = () => ({ throttle: false, jump: false });
  while (overlap(g, r) && sim.time < 10) { step(true); pairs.push(...carPairs(sim)); }
  expect(overlap(g, r)).toBe(false);
  step(true);
  pairs.push(...carPairs(sim));
  expect(pairs).toEqual([]);
  expect([g.ghost, r.ghost]).toEqual([false, false]);
  expect([carBits(g), carBits(r)]).toEqual([SOLID, SOLID]);
  // 3. Galahad lève le pied, le copain fonce : il le percute (collision rétablie), hors de toute zone.
  r.driver = () => ({ throttle: true, jump: false });
  r.factor = 1;
  const t0 = sim.time;
  let hit: string[] = [];
  while (hit.length === 0 && sim.time < t0 + 8) { step(false); hit = carPairs(sim); }
  expect(hit.length, 'pas de choc').toBeGreaterThan(0);
  expect(inGhostZone(track, chassisX(g), CONFIG) || inGhostZone(track, chassisX(r), CONFIG)).toBe(false);
  expect(chassisX(g)).toBeLessThan(v.xEnd);
  expect(respawns.map((e) => `${e.carId} ${e.reason} @${e.t.toFixed(2)}`)).toEqual([]);
});

test('masque = fantôme OU invulnérable : aucun des deux états n’écrase l’autre', () => {
  const sim = createRaceSim(track, CONFIG); // Galahad seul suffit : seul son masque est observé
  const [g] = sim.cars;
  const xIn = v.xLancement + 1;
  const xOut = v.xLancement - 8;
  // Respawn dans la zone : invulnérable et fantôme.
  g.state.safePoint = { x: xIn, y: h(xIn), angle: 0 };
  place(g, v.xLava);
  stepRace(sim, false);
  expect(sim.events.some((e) => e.type === 'respawn')).toBe(true);
  stepRace(sim, false);
  expect([g.invulnerable, g.ghost, carBits(g)]).toEqual([true, true, PASS]);
  // Fin de l'invulnérabilité dans la zone : le masque reste sans voitures (fantôme).
  while (g.invulnerable && sim.time < 3) stepRace(sim, false);
  expect([g.invulnerable, g.ghost, carBits(g)]).toEqual([false, true, PASS]);
  // Sortie de zone : masque normal.
  place(g, xOut);
  stepRace(sim, false);
  expect([g.invulnerable, g.ghost, carBits(g)]).toEqual([false, false, SOLID]);
  // Respawn hors zone : invulnérable, pas fantôme ; il entre dans la zone encore invulnérable, puis l'invulnérabilité finit.
  g.state.safePoint = { x: xOut, y: h(xOut), angle: 0 };
  place(g, v.xLava);
  stepRace(sim, false);
  stepRace(sim, false);
  expect([g.invulnerable, g.ghost, carBits(g)]).toEqual([true, false, PASS]);
  place(g, xIn);
  stepRace(sim, false);
  expect([g.invulnerable, g.ghost, carBits(g)]).toEqual([true, true, PASS]);
  while (g.invulnerable && sim.time < 10) stepRace(sim, false);
  expect([g.ghost, carBits(g)]).toEqual([true, PASS]);
  place(g, xOut);
  stepRace(sim, false);
  expect([g.ghost, carBits(g)]).toEqual([false, SOLID]);
  // Invulnérable hors zone, ressorti de la zone avant la fin de l'invulnérabilité : masque toujours coupé.
  g.state.safePoint = { x: xIn, y: h(xIn), angle: 0 };
  place(g, v.xLava);
  stepRace(sim, false);
  place(g, xOut);
  stepRace(sim, false);
  expect([g.invulnerable, g.ghost, carBits(g)]).toEqual([true, false, PASS]);
  while (g.invulnerable && sim.time < 20) stepRace(sim, false);
  expect(carBits(g)).toEqual(SOLID);
});

test('chute dans la lave en zone, respawn hors zone sur une voiture : pas fantôme, invulnérable, masque normal au plafond', () => {
  const sim = parked();
  const [g, r] = sim.cars;
  // Point sûr sur le plat de réception, hors zone, occupé par un copain à l'arrêt : le recul tombe dans
  // la zone interdite du volcan et est abandonné, la cible reste sur le copain (chevauchement).
  const xSafe = v.xReception + 2;
  expect(inGhostZone(track, xSafe, CONFIG)).toBe(false);
  g.state.safePoint = { x: xSafe, y: h(xSafe), angle: 0 };
  place(r, xSafe);
  place(g, v.xLava);
  stepRace(sim, false);
  const e = sim.events.find((ev): ev is RespawnEvent => ev.type === 'respawn');
  expect(e?.carId).toBe('galahad');
  expect(e!.target.x).toBeCloseTo(xSafe, 6);
  expect(overlap(g, r)).toBe(true);
  expect([g.ghost, g.invulnerable, carBits(g)]).toEqual([false, true, PASS]);
  const release = g.state.invulnerableUntil + (CONFIG.RESPAWN_INVULN_MAX - CONFIG.RESPAWN_INVULN);
  while (sim.time < release - 2 * CONFIG.PHYSICS_DT) stepRace(sim, false);
  expect(overlap(g, r)).toBe(true);
  expect([g.ghost, g.invulnerable, carBits(g)]).toEqual([false, true, PASS]);
  for (let i = 0; i < 3; i++) stepRace(sim, false);
  expect([g.ghost, g.invulnerable, carBits(g)]).toEqual([false, false, SOLID]);
});

test('la voiture reste fantôme tant que sa roue arrière n’a pas dépassé xReception', () => {
  const sim = createRaceSim(track, CONFIG); // Galahad seul : seul son état fantôme est observé
  const [g] = sim.cars;
  const rear = CONFIG.WHEEL_BASE / 2 + CONFIG.WHEEL_RADIUS;
  place(g, v.xReception + rear - 0.1);
  stepRace(sim, false);
  expect([g.ghost, carBits(g)]).toEqual([true, PASS]);
  place(g, v.xReception + rear + 0.1);
  stepRace(sim, false);
  expect([g.ghost, carBits(g)]).toEqual([false, SOLID]);
});
