// Tolérance de sol pour le saut (plan B, tâche 5e, Step 11 ; décision P11 du papa, addendum « bouton saut » §1 et
// §6.2, ruling R-F14) : le saut part si une roue a eu le contact de jeu (débouncé) dans les JUMP_GROUND_GRACE
// (0,35 s) précédentes. Mémoire de 0,1 s gardée ; JUMP_COOLDOWN empêche le double saut ; une téléportation
// oublie le contact d'avant. « 0 appui perdu » : calculé sur la suite « au sol / en l'air » d'une course sans saut,
// sans relancer la physique par appui.
import { CONFIG } from '../src/config';
import { placeCar } from '../src/physics/car';
import { createWorld } from '../src/physics/world';
import { createRaceSim, jumpReady, stepRace, type RaceSim } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt } from '../src/track/query';
import type { Track } from '../src/track/types';
import { jumpRun, lastGroundedBefore, rampSautTrack } from './helpers/jump-runs';

const DT = CONFIG.PHYSICS_DT;
const STEPS = (s: number): number => Math.round(s / DT);
const FLAT: Track = { ...generateTrack(3, 400, CONFIG, { onlyPlat: true }), stars: [] };
const RAMP = rampSautTrack();
const RAMP_RUN = CONFIG.RAMP_LENGTH * Math.cos(CONFIG.RAMP_ANGLE);
const jumps = (sim: RaceSim): number => sim.events.filter((e) => e.type === 'jump').length;

describe('tolérance de sol (P11)', () => {
  test('constantes : contact de jeu (0,1 s) + tolérance (0,35 s) finissent au moins 0,05 s avant la fin du délai (0,5 s) : pas de double saut', () => {
    expect(CONFIG.JUMP_GROUND_GRACE).toBe(0.35);
    expect(CONFIG.GROUND_DEBOUNCE_SECONDS + CONFIG.JUMP_GROUND_GRACE + 0.05).toBeLessThanOrEqual(CONFIG.JUMP_COOLDOWN + 1e-9);
  });

  test('pas de double saut : une demande à chaque pas pendant 3 s après un saut, un seul saut avant le retour au sol', () => {
    const sim = createRaceSim(FLAT, CONFIG);
    for (let i = 0; i < STEPS(1); i++) stepRace(sim, false);
    stepRace(sim, false, true);
    expect(jumps(sim)).toBe(1);
    const t0 = sim.time;
    let airborne = false;
    let inFlight = 0;
    let landedAt: number | null = null;
    for (let i = 0; i < STEPS(3) && landedAt === null; i++) {
      stepRace(sim, false, true);
      const g = sim.cars[0].grounded;
      if (!g) airborne = true;
      if (airborne && g) landedAt = sim.time;
      else inFlight += jumps(sim);
    }
    expect(airborne).toBe(true);
    expect(landedAt, 'retour au sol').not.toBeNull();
    expect(landedAt! - t0).toBeGreaterThan(1.5);
    expect(inFlight, 'saut en l’air, demande à chaque pas').toBe(0);
  });

  test('une téléportation (respawn) remet lastGroundedAt à null : pas de saut de tolérance sur le contact d’avant', () => {
    const { track } = RAMP;
    const v = track.volcanoes[0];
    const sim = createRaceSim(track, CONFIG);
    const g = sim.cars[0];
    for (let i = 0; i < STEPS(0.5); i++) stepRace(sim, false);
    expect(g.lastGroundedAt).not.toBeNull();
    placeCar(g.body, v.xLava, (x) => heightAt(track, x), 0, CONFIG);
    let respawned = false;
    for (let i = 0; i < STEPS(2) && !respawned; i++) {
      stepRace(sim, false);
      respawned = sim.events.some((e) => e.type === 'respawn');
    }
    expect(respawned).toBe(true);
    expect(g.lastGroundedAt).toBeNull();
    expect(jumpReady(sim, 0)).toBe(false);
  });

  test('lastGroundedAt vaut null à la création', () => {
    const sim = createRaceSim(FLAT, CONFIG, { robots: true });
    expect(sim.cars.map((c) => c.lastGroundedAt)).toEqual([null, null, null, null, null]);
  });
});

describe('au décollage d’une rampe-saut (tolérance de sol)', () => {
  const world = createWorld(RAMP.track, CONFIG);
  const x0 = RAMP.ramp.xStart - 15;
  const lip = RAMP.ramp.xStart + RAMP_RUN;
  const pilot = jumpRun(world, { x0, v: 14, jumpAtStep: null, maxSeconds: 4 });
  const last = lastGroundedBefore(pilot, lip + 3);

  test('repère : dernier contact de jeu au sommet, puis un vol', () => {
    expect(last).toBeGreaterThan(0);
    expect(pilot.grounded.slice(last + 1, last + STEPS(1)).every((g) => !g)).toBe(true);
  });

  test('demande 0,30 s après le dernier contact de jeu : saut', () => {
    const r = jumpRun(world, { x0, v: 14, jumpAtStep: last + STEPS(0.3), maxSeconds: 4 });
    expect(r.jumpStep).toBe(last + STEPS(0.3));
  });

  test.each([0.4, 0.7])('demande %f s après le dernier contact de jeu : aucun saut, trajectoire inchangée', (dt) => {
    const k = last + STEPS(dt);
    const r = jumpRun(world, { x0, v: 14, jumpAtStep: k, maxSeconds: 4 });
    expect(r.jumped).toBe(false);
    expect(r.trace.slice(0, k + STEPS(0.5))).toEqual(pilot.trace.slice(0, k + STEPS(0.5)));
  });
});

/**
 * Appuis perdus (saut §6.2, ruling R-F14) : 24 lancers de 9 s décalés de 0,37 m sur une piste plate, sans saut ;
 * chaque pas de [2 s, 8 s] est un appui (6 s × 60 × 24 = 8 640). Un appui au pas k est servi si un pas j de
 * [k, k + JUMP_BUFFER] a eu un contact de jeu dans les JUMP_GROUND_GRACE qui précèdent j.
 */
function lostPresses(v: number, opts: { factor?: number; turboAtSeconds?: readonly number[] } = {}): { lost: number; presses: number; longestAir: number } {
  const world = createWorld(FLAT, CONFIG);
  const buffer = STEPS(CONFIG.JUMP_BUFFER);
  const grace = STEPS(CONFIG.JUMP_GROUND_GRACE);
  let lost = 0;
  let presses = 0;
  let longestAir = 0;
  for (let n = 0; n < 24; n++) {
    const r = jumpRun(world, { x0: 60 + 0.37 * n, v, jumpAtStep: null, maxSeconds: 9, factor: opts.factor, turboAtSeconds: opts.turboAtSeconds ? [...opts.turboAtSeconds] : undefined });
    const lastG: number[] = [];
    let run = 0;
    r.grounded.forEach((g, i) => {
      lastG.push(g ? i : (i > 0 ? lastG[i - 1] : -Infinity));
      run = g ? 0 : run + 1;
      if (i >= STEPS(2)) longestAir = Math.max(longestAir, run);
    });
    for (let k = STEPS(2); k < STEPS(8); k++) {
      presses++;
      let served = false;
      for (let j = k; j <= k + buffer && !served; j++) served = lastG[j] >= j - grace;
      if (!served) lost++;
    }
  }
  return { lost, presses, longestAir };
}

describe('aucun appui perdu dans une fenêtre (tolérance de 0,35 s)', () => {
  test.each([
    ['11,2 m/s', CONFIG.V_CRUISE, {}],
    ['14 m/s', CONFIG.V_MAX, {}],
    ['turbo pris à 14 m/s', CONFIG.V_MAX, { turboAtSeconds: [2] }],
  ] as const)('%s : 0 appui perdu sur 8 640', (label, v, opts) => {
    const r = lostPresses(v, opts);
    console.log(`appuis perdus, ${label} : ${r.lost} / ${r.presses} ; plus long vol (contact de jeu) ${r.longestAir} pas`);
    expect(r.presses).toBe(8640);
    expect(r.lost).toBe(0);
  });

  test('21 m/s tenus (facteur 1,5 permanent) : part imprimée, au plus 0,5 % (Q-F6)', () => {
    const r = lostPresses(CONFIG.V_MAX * CONFIG.TURBO_FACTOR);
    const share = r.lost / r.presses;
    console.log(`appuis perdus, 21 m/s tenus : ${r.lost} / ${r.presses} (${(100 * share).toFixed(2)} %) ; plus long vol ${r.longestAir} pas`);
    expect(share).toBeLessThanOrEqual(0.005);
  });
});
