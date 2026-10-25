// Bouton saut (plan B, tâche 5e ; addendum « bouton saut » §1, amendé [plan]) : saut physique d'une voiture
// seule par `stepRace(sim, gaz, saut)`. Même hauteur partout (décision P3), au sol seulement (contact
// débouncé), délai JUMP_COOLDOWN, mémoire JUMP_BUFFER de la demande (décision P2), rien après l'arrivée,
// bouton prêt (`jumpReady`), déterminisme. Les apogées mesurés sont imprimés (Step 3 du plan).
import Matter from 'matter-js';
import { canJump, wantsJump } from '../src/cars/jump';
import { CONFIG, type Config } from '../src/config';
import { applyJump, placeCar } from '../src/physics/car';
import { mpsToPxPerStep, physToWorld, toPx } from '../src/physics/units';
import { createRaceSim, jumpReady, stepRace, type RaceSim, type SimEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt, slopeAt } from '../src/track/query';
import type { Slice, Track } from '../src/track/types';
import { stepFingerprint } from './helpers/fingerprint';

const { Body } = Matter;
const DT = CONFIG.PHYSICS_DT;
const G = CONFIG.GRAVITY;
const STEPS = (s: number): number => Math.round(s / DT);

/** Piste plate (tranches `plat` seulement), sans étoile : sauts sur le plat, sans turbo parasite. */
const FLAT: Track = { ...generateTrack(3, 300, CONFIG, { onlyPlat: true }), stars: [], rocks: [] };

/** Première rampe-saut (graines 0 à 19) précédée d'un plat d'au moins 20 m, sur une piste sans étoile. */
function rampTrack(): { track: Track; ramp: Slice; seed: number } {
  for (let seed = 0; seed < 20; seed++) {
    const t = generateTrack(seed, 1680, CONFIG);
    const i = t.slices.findIndex((s, k) => s.type === 'rampe-saut' && k > 1
      && t.slices[k - 1].type === 'plat' && t.slices[k - 1].xEnd - t.slices[k - 1].xStart >= 20);
    if (i >= 0) return { track: { ...t, stars: [], rocks: [] }, ramp: t.slices[i], seed };
  }
  throw new Error('aucune rampe-saut précédée d’un plat de 20 m');
}
const RAMP = rampTrack();
/** Longueur au sol de la montée d'une rampe-saut (m). */
const RAMP_RUN = CONFIG.RAMP_LENGTH * Math.cos(CONFIG.RAMP_ANGLE);

const galahad = (sim: RaceSim) => sim.cars[0];
/** y (m, monde) du châssis de Galahad. */
const yOf = (sim: RaceSim): number => physToWorld(galahad(sim).body.chassis.position).y;
const xOf = (sim: RaceSim): number => physToWorld(galahad(sim).body.chassis.position).x;
/** Vitesse verticale (m/s, vers le haut) d'un corps. */
const vyOf = (b: Matter.Body): number => (-b.velocity.y * 60) / CONFIG.PIXELS_PER_METER;
const jumpsOf = (sim: RaceSim): Extract<SimEvent, { type: 'jump' }>[] =>
  sim.events.filter((e): e is Extract<SimEvent, { type: 'jump' }> => e.type === 'jump');

/** Galahad seul sur `track`, reposé à l'arrêt en x (pente locale), à `lift` m au-dessus du sol. */
function simAt(track: Track, x: number, cfg: Config = CONFIG, lift = 0): RaceSim {
  const sim = createRaceSim(track, cfg);
  placeCar(galahad(sim).body, x, (xx) => heightAt(track, xx) + lift, lift === 0 ? slopeAt(track, x) : 0, cfg);
  return sim;
}

/** Lance toutes les pièces à v m/s le long de la pente locale, roues en roulement sans glissement. */
function launch(sim: RaceSim, v: number): void {
  const { body } = galahad(sim);
  const a = slopeAt(sim.track, xOf(sim));
  const vel = { x: mpsToPxPerStep(v * Math.cos(a)), y: -mpsToPxPerStep(v * Math.sin(a)) };
  for (const p of body.parts) Body.setVelocity(p, vel);
  for (const w of body.wheels) Body.setAngularVelocity(w, mpsToPxPerStep(v) / toPx(CONFIG.WHEEL_RADIUS));
}

/** Après un saut : suit le vol (gaz `throttle`) pendant `seconds` et rend le plus haut y du châssis. */
function apexAfter(sim: RaceSim, seconds: number, throttle = false): number {
  let maxY = yOf(sim);
  for (let i = 0; i < STEPS(seconds); i++) {
    stepRace(sim, throttle);
    maxY = Math.max(maxY, yOf(sim));
  }
  return maxY;
}

describe('applyJump (même hauteur partout, décision P3)', () => {
  test('vy0 ≤ 0 : JUMP_VY sur le châssis et les deux roues ; vy0 > 0 : √(vy0² + JUMP_VY²) ; vx de chaque pièce inchangée à 1e-9', () => {
    expect(CONFIG.JUMP_VY).toBeCloseTo(Math.sqrt(2 * CONFIG.GRAVITY * CONFIG.JUMP_APEX), 1);
    for (const vy0 of [-2, 0, 3, 5.24]) {
      const sim = simAt(FLAT, 100);
      launch(sim, 14);
      const { body } = galahad(sim);
      for (const p of body.parts) Body.setVelocity(p, { x: p.velocity.x, y: -mpsToPxPerStep(vy0) });
      const vxBefore = body.parts.map((p) => p.velocity.x);
      applyJump(body, CONFIG);
      const expected = vy0 > 0 ? Math.sqrt(vy0 * vy0 + CONFIG.JUMP_VY * CONFIG.JUMP_VY) : CONFIG.JUMP_VY;
      body.parts.forEach((p, k) => {
        expect(p.velocity.x, `vy0 ${vy0}, pièce ${k}`).toBeCloseTo(vxBefore[k], 9);
        expect(vyOf(p), `vy0 ${vy0}, pièce ${k}`).toBeCloseTo(expected, 9);
      });
    }
  });

  test('vx gardée : à 14 m/s sur le plat, vx de chaque pièce identique avant et après applyJump (1e-9)', () => {
    const sim = simAt(FLAT, 100);
    launch(sim, 14);
    for (let i = 0; i < 30; i++) stepRace(sim, true);
    const { body } = galahad(sim);
    const before = body.parts.map((p) => p.velocity.x);
    applyJump(body, CONFIG);
    body.parts.forEach((p, k) => expect(Math.abs(p.velocity.x - before[k]), `pièce ${k}`).toBeLessThan(1e-9));
  });
});

describe('apogée du saut (2,5 m ± 10 %)', () => {
  test('sur le plat à l’arrêt : voiture 2 s au repos, max(y) − y0 ∈ [2,25 ; 2,75]', () => {
    const sim = createRaceSim(FLAT, CONFIG);
    for (let i = 0; i < STEPS(2); i++) stepRace(sim, false);
    const y0 = yOf(sim);
    stepRace(sim, false, true);
    expect(jumpsOf(sim)).toHaveLength(1);
    const gain = apexAfter(sim, 4) - y0;
    console.log(`apogée du saut, plat à l'arrêt : ${gain.toFixed(3)} m (y0 = ${y0.toFixed(3)} m)`);
    expect(gain).toBeGreaterThanOrEqual(2.25);
    expect(gain).toBeLessThanOrEqual(2.75);
  });

  test('sur le plat à 14 m/s, doigt posé : max(y) − y0 ∈ [2,25 ; 2,75]', () => {
    const sim = simAt(FLAT, 60);
    launch(sim, 14);
    for (let i = 0; i < STEPS(2); i++) stepRace(sim, true);
    const y0 = yOf(sim);
    const vy0 = vyOf(galahad(sim).body.chassis);
    stepRace(sim, true, true);
    expect(jumpsOf(sim)).toHaveLength(1);
    const gain = apexAfter(sim, 4, true) - y0;
    console.log(`apogée du saut, plat à 14 m/s : ${gain.toFixed(3)} m (vy0 = ${vy0.toFixed(3)} m/s)`);
    expect(gain).toBeGreaterThanOrEqual(2.25);
    expect(gain).toBeLessThanOrEqual(2.75);
  });

  // À 14 m/s, la roue avant rebondit sur le pli du pied de la rampe-saut (0° → 22°, sans congé) : la voiture
  // survole le premier tiers de la montée (mesuré, graine 0 : en l'air de ≈ 1,2 à ≈ 4,0 m après le pied). Avec la
  // tolérance de sol (P11, Step 11), le saut part maintenant EN L'AIR, à la première demande depuis le milieu de la
  // montée (graine 0 : ≈ 2,9 m après le pied, ≈ 0,18 s après le dernier contact de jeu, gain ≈ 2,46 m, MESURÉ
  // (relecture)) ; la demande reste faite à chaque pas jusqu'au saut, avant le sommet. Assertions inchangées.
  test(`sur une pente (P3) : à 14 m/s dans la seconde moitié de la montée d'une rampe-saut, max(y) − y0 − vy0²/(2g) ∈ [2,25 ; 2,75], très en dessous de « s'ajoute »`, () => {
    const { track, ramp, seed } = RAMP;
    const sim = simAt(track, ramp.xStart - 15);
    launch(sim, 14);
    const mid = ramp.xStart + RAMP_RUN / 2;
    let guard = 0;
    while (xOf(sim) < mid && guard++ < STEPS(3)) stepRace(sim, true);
    let y0 = NaN;
    let vy0 = NaN;
    let xJump = NaN;
    for (let i = 0; i < STEPS(0.5) && jumpsOf(sim).length === 0; i++) {
      y0 = yOf(sim);
      vy0 = vyOf(galahad(sim).body.chassis);
      xJump = xOf(sim);
      stepRace(sim, true, true);
    }
    expect(jumpsOf(sim), `graine ${seed}, rampe en x = ${ramp.xStart.toFixed(1)}`).toHaveLength(1);
    expect(xJump - ramp.xStart).toBeGreaterThanOrEqual(RAMP_RUN / 2);
    expect(xJump - ramp.xStart).toBeLessThan(RAMP_RUN);
    expect(vy0).toBeGreaterThan(0);
    const apex = apexAfter(sim, 4, true) - y0;
    const gain = apex - (vy0 * vy0) / (2 * G);
    const added = ((vy0 + CONFIG.JUMP_VY) ** 2) / (2 * G);
    console.log(`apogée du saut, pente (graine ${seed}, ${(xJump - ramp.xStart).toFixed(2)} m après le pied) : vy0 = ${vy0.toFixed(3)} m/s, `
      + `max(y) − y0 = ${apex.toFixed(3)} m, au-dessus du vol sans saut ${gain.toFixed(3)} m ; « s'ajoute » donnerait ${added.toFixed(2)} m`);
    expect(gain).toBeGreaterThanOrEqual(2.25);
    expect(gain).toBeLessThanOrEqual(2.75);
    expect(apex).toBeLessThan(added - 3);
  });

  test('en descente (vy0 < 0) : sur la descente à 10° d’une rampe-saut, à ≈ 3 m/s plafonnés, max(y) − y0 ∈ [2,25 ; 2,75]', () => {
    const { track, ramp, seed } = RAMP;
    // Descente : de la cassure (premier échantillon après la montée) jusqu'au plat de 8 m de fin de tranche.
    const xBreak = ramp.xStart + (Math.floor(RAMP_RUN / CONFIG.TRACK_POINT_SPACING + 1e-9) + 1) * CONFIG.TRACK_POINT_SPACING;
    const sim = simAt(track, xBreak + 3);
    expect(slopeAt(track, xBreak + 3) * 180 / Math.PI).toBeCloseTo(-10, 0);
    launch(sim, 3);
    const cap = mpsToPxPerStep(3);
    for (let i = 0; i < STEPS(0.5); i++) {
      stepRace(sim, false);
      for (const p of galahad(sim).body.parts) {
        const n = Math.hypot(p.velocity.x, p.velocity.y);
        if (n > cap) Body.setVelocity(p, { x: (p.velocity.x * cap) / n, y: (p.velocity.y * cap) / n });
      }
    }
    expect(galahad(sim).grounded).toBe(true);
    const y0 = yOf(sim);
    const vy0 = vyOf(galahad(sim).body.chassis);
    stepRace(sim, false, true);
    expect(jumpsOf(sim)).toHaveLength(1);
    expect(vy0).toBeLessThan(0);
    const gain = apexAfter(sim, 4) - y0;
    console.log(`apogée du saut, descente (graine ${seed}) : vy0 = ${vy0.toFixed(3)} m/s, max(y) − y0 = ${gain.toFixed(3)} m`);
    expect(gain).toBeGreaterThanOrEqual(2.25);
    expect(gain).toBeLessThanOrEqual(2.75);
  });
});

// « Au sol seulement » devient la tolérance de sol (P11, Step 11) : au décollage d'une rampe-saut, une demande 0,30 s
// après le dernier contact de jeu donne un saut, à 0,40 et 0,7 s aucun (tests/jump-grace.test.ts).
describe('jamais de saut sans contact de jeu (lastGroundedAt nul à la création)', () => {
  test('voiture lâchée de 2 m, demande à chaque pas : aucun saut avant le contact, saut au premier pas au sol', () => {
    const sim = simAt(FLAT, 100, CONFIG, 2);
    let first: number | null = null;
    let firstGrounded: number | null = null;
    for (let i = 0; i < STEPS(2) && first === null; i++) {
      stepRace(sim, false, true);
      if (firstGrounded === null && galahad(sim).grounded) firstGrounded = i;
      if (jumpsOf(sim).length > 0) first = i;
    }
    expect(first).not.toBeNull();
    expect(first).toBe(firstGrounded);
    // Chute de ≈ 2 m (roues) : √(2 × 2 / 4,9) ≈ 0,9 s.
    expect(first! * DT).toBeGreaterThan(0.8);
  });
});

describe('mémoire de la demande (P2, JUMP_BUFFER 0,1 s)', () => {
  /** Pas du premier contact au sol d'une voiture lâchée de 2 m, sans demande. */
  function contactStep(): number {
    const sim = simAt(FLAT, 100, CONFIG, 2);
    for (let i = 0; i < STEPS(2); i++) {
      stepRace(sim, false);
      if (galahad(sim).grounded) return i;
    }
    throw new Error('pas de contact');
  }

  /** Lâchée de 2 m, une seule demande au pas `at` : pas des sauts. */
  function jumpsWithRequestAt(at: number): number[] {
    const sim = simAt(FLAT, 100, CONFIG, 2);
    const out: number[] = [];
    for (let i = 0; i < STEPS(2.5); i++) {
      stepRace(sim, false, i === at);
      if (jumpsOf(sim).length > 0) out.push(i);
    }
    return out;
  }

  test('une demande 0,05 s avant le contact donne un saut au premier pas au sol ; 0,15 s avant, aucun saut', () => {
    expect(CONFIG.JUMP_BUFFER).toBe(0.1);
    const k = contactStep();
    expect(k * DT).toBeGreaterThan(0.8);
    expect(jumpsWithRequestAt(k - 3)).toEqual([k]);
    expect(jumpsWithRequestAt(k - 9)).toEqual([]);
  });
});

describe('délai entre deux sauts (I4)', () => {
  test('JUMP_VY 0,5 (vol < 0,25 s) : une demande à chaque pas pendant 3 s donne des sauts espacés de 0,5 s ± 1 pas', () => {
    const cfg: Config = { ...CONFIG, JUMP_VY: 0.5 };
    const sim = createRaceSim(FLAT, cfg);
    for (let i = 0; i < STEPS(1); i++) stepRace(sim, false);
    const y0 = yOf(sim);
    let maxGain = 0;
    const times: number[] = [];
    for (let i = 0; i < STEPS(3); i++) {
      const t = sim.time;
      stepRace(sim, false, true);
      if (jumpsOf(sim).length > 0) times.push(t);
      maxGain = Math.max(maxGain, yOf(sim) - y0);
    }
    // Vol de 2 × 0,5 / 4,9 ≈ 0,2 s : la voiture est revenue au sol bien avant la fin du délai.
    expect(maxGain).toBeLessThan(0.2);
    expect(times.length).toBe(6);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      expect(gap, `sauts ${times.map((x) => x.toFixed(3)).join(' ')}`).toBeGreaterThanOrEqual(cfg.JUMP_COOLDOWN - 1e-6);
      expect(gap, `sauts ${times.map((x) => x.toFixed(3)).join(' ')}`).toBeLessThanOrEqual(cfg.JUMP_COOLDOWN + DT + 1e-6);
    }
  });
});

describe('canJump et wantsJump (table)', () => {
  test.each([
    { lastJumpAt: null, lastGroundedAt: 0, finished: false, t: 0, ok: true },
    { lastJumpAt: null, lastGroundedAt: null, finished: false, t: 5, ok: false },
    { lastJumpAt: null, lastGroundedAt: 5 - 0.3, finished: false, t: 5, ok: true },
    { lastJumpAt: null, lastGroundedAt: 5 - 0.35, finished: false, t: 5, ok: true },
    { lastJumpAt: null, lastGroundedAt: 5 - 0.4, finished: false, t: 5, ok: false },
    { lastJumpAt: null, lastGroundedAt: 5, finished: true, t: 5, ok: false },
    { lastJumpAt: 10, lastGroundedAt: 10.49, finished: false, t: 10.49, ok: false },
    { lastJumpAt: 10, lastGroundedAt: 10.5, finished: false, t: 10.5, ok: true },
    { lastJumpAt: 10, lastGroundedAt: 10.6, finished: false, t: 11, ok: false },
    { lastJumpAt: 10, lastGroundedAt: 11, finished: false, t: 11, ok: true },
  ])('canJump($lastJumpAt, contact $lastGroundedAt, arrivée $finished, t $t) = $ok', ({ ok, ...o }) => {
    expect(canJump(o, CONFIG)).toBe(ok);
  });

  test.each([
    { at: null, t: 3, ok: false },
    { at: 3, t: 3, ok: true },
    { at: 3, t: 3.05, ok: true },
    { at: 3, t: 3.1, ok: true },
    { at: 3, t: 3 + 0.1 + 1e-12, ok: true },
    { at: 3, t: 3.11, ok: false },
    { at: 3, t: 4, ok: false },
  ])('wantsJump($at, t $t) = $ok', ({ at, t, ok }) => {
    expect(wantsJump(at, t, CONFIG)).toBe(ok);
  });
});

describe('après l’arrivée, bouton prêt, déterminisme', () => {
  test('après l’arrivée : la demande est ignorée', () => {
    const sim = createRaceSim(FLAT, CONFIG);
    for (let i = 0; i < STEPS(1); i++) stepRace(sim, false);
    galahad(sim).state.finishedAt = sim.time;
    for (let i = 0; i < STEPS(1); i++) {
      stepRace(sim, false, true);
      expect(jumpsOf(sim)).toEqual([]);
    }
    expect(jumpReady(sim, 0)).toBe(false);
  });

  test('bouton grisé en l’air : jumpReady vrai jusqu’à JUMP_GROUND_GRACE après le dernier contact de jeu, faux ensuite jusqu’au retour au sol (vol d’une rampe-saut, sans saut)', () => {
    const { track, ramp } = RAMP;
    const sim = simAt(track, ramp.xStart - 15);
    launch(sim, 14);
    const grounded: boolean[] = [];
    const ready: boolean[] = [];
    for (let i = 0; i < STEPS(5); i++) {
      stepRace(sim, true);
      grounded.push(galahad(sim).grounded);
      ready.push(jumpReady(sim, 0));
    }
    // Vol : plus longue suite de pas sans contact de jeu ; `last` = dernier pas avec contact avant le vol.
    let best = { from: -1, len: 0 };
    for (let i = 0, run = 0; i < grounded.length; i++) {
      run = grounded[i] ? 0 : run + 1;
      if (run > best.len) best = { from: i - run + 1, len: run };
    }
    expect(best.len * DT).toBeGreaterThan(1);
    const last = best.from - 1;
    const landing = best.from + best.len;
    // `jumpReady` après le pas i se lit à t(i + 1) : prêt tant que t(i + 1) − t(last) ≤ 0,35 s (à 1e-9 près), soit
    // i ≤ last + 20.
    const grace = STEPS(CONFIG.JUMP_GROUND_GRACE);
    for (let i = last; i < last + grace; i++) expect(ready[i], `pas ${i - last} après le dernier contact`).toBe(true);
    for (let i = last + grace; i < landing; i++) expect(ready[i], `pas ${i - last} après le dernier contact`).toBe(false);
    expect(ready[landing]).toBe(true);
  });

  test('bouton grisé pendant le délai : jumpReady faux jusqu’à JUMP_COOLDOWN après le saut, même au sol (JUMP_VY 0,5)', () => {
    const cfg: Config = { ...CONFIG, JUMP_VY: 0.5 };
    const sim = createRaceSim(FLAT, cfg);
    for (let i = 0; i < STEPS(1); i++) stepRace(sim, false);
    expect(jumpReady(sim, 0)).toBe(true);
    const tJump = sim.time;
    stepRace(sim, false, true);
    expect(jumpsOf(sim)).toHaveLength(1);
    let groundedWhileWaiting = 0;
    while (sim.time < tJump + cfg.JUMP_COOLDOWN - 1e-6) {
      expect(jumpReady(sim, 0), `t − saut = ${(sim.time - tJump).toFixed(3)}`).toBe(false);
      stepRace(sim, false);
      if (galahad(sim).grounded && sim.time > tJump + 0.3) groundedWhileWaiting++;
    }
    expect(groundedWhileWaiting).toBeGreaterThan(0);
    expect(jumpReady(sim, 0)).toBe(true);
  });

  test('déterminisme : même calendrier de demandes, même empreinte à chaque pas', () => {
    const { track, ramp } = RAMP;
    const schedule = new Set([30, 95, 96, 140, 200, 260, 261, 262, 330]);
    const a = simAt(track, ramp.xStart - 40);
    const b = simAt(track, ramp.xStart - 40);
    let jumps = 0;
    for (let i = 0; i < 420; i++) {
      stepRace(a, true, schedule.has(i));
      stepRace(b, true, schedule.has(i));
      jumps += jumpsOf(a).length;
      expect(stepFingerprint(a), `pas ${i}`).toBe(stepFingerprint(b));
    }
    expect(jumps).toBeGreaterThanOrEqual(2);
  });
});
