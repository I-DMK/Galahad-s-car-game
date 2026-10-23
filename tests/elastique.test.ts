// Élastique des copains dans le vrai pas de course (plan B, tâche 7 ; spec §7, addendum §1.8 et §2 ; décisions D7-2 et
// D7-3 du papa ; rulings R7-1 à R7-16) : Galahad sans élastique (champs et effet physique), neutre de départ, taux,
// fenêtre de la vue, turbo plafonné hors écran devant, aucun freinage net à l'écran, copain freiné à 0,6 qui aborde un
// volcan (Review Focus n° 3), élastique coupé par `launchSolo`. Fonctions pures : tests/rubberband.test.ts. Volcans sous
// élastique en grand nombre : tests/slow/elastique-volcans.test.ts.
import { makeRobotDriver, type Driver } from '../src/ai/driver';
import { screenAheadEdge, zoneFloor } from '../src/ai/rubberband';
import { takeStarFor } from '../src/cars/stars';
import { activateTurbo, turboFactor } from '../src/cars/turbo';
import { CONFIG, type Config } from '../src/config';
import { carSpeedMps, placeCar } from '../src/physics/car';
import {
  carView, chassisX, createRaceSim, stepRace, type CarSim, type RaceSim, type RespawnEvent,
} from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { fosses, heightAt, inVolcanoZone, slopeAt, tremplins } from '../src/track/query';
import type { Track, Volcano } from '../src/track/types';
import { sauteurParfait } from './helpers/fosses';
import { launchSolo, setCarSpeed } from './helpers/jump-runs';
import { BrakeWatch } from './helpers/objective';
import { f1, f2, trackFor } from './helpers/runs';

const PARKED: Driver = () => ({ throttle: false, jump: false });
const DT = CONFIG.PHYSICS_DT;
const STEP = CONFIG.RUBBER_RATE_PER_S * DT;
/** Neutre de départ coupé : l'élastique agit dès le premier pas (scénarios forcés). */
const NO_NEUTRAL: Config = { ...CONFIG, RUBBER_NEUTRAL_SECONDS: 0 };

const place = (sim: RaceSim, car: CarSim, x: number): void =>
  placeCar(car.body, x, (u) => heightAt(sim.track, u), slopeAt(sim.track, x), sim.cfg);

/** Un pas de la course enregistré, par voiture : ce que le pas a lu (avant) et ce qu'il a appliqué (après). */
interface CarStep {
  x: number; finished: boolean; turbo: number; factor: number;
  rubberBefore: number | null; rubber: number | null; speedFactor: number; torqueFactor: number; onScreen: boolean;
}
interface RecordedStep { t: number; galahadSpeed: number; cars: CarStep[] }

/** Course à 5 de la graine 1 : Galahad doigt posé avec le saut parfait aux fosses, 60 s, chaque pas relevé. */
function recordRace(seconds: number): { sim: RaceSim; steps: RecordedStep[]; brake: BrakeWatch; stars: string[] } {
  const track = trackFor(1);
  const sim = createRaceSim(track, CONFIG, { robots: true });
  const jump = sauteurParfait(track);
  const brake = new BrakeWatch(sim);
  const steps: RecordedStep[] = [];
  const stars: string[] = [];
  while (sim.time < seconds - 1e-9) {
    const t = sim.time;
    const before = sim.cars.map((c) => ({
      x: chassisX(c), finished: c.state.finishedAt !== null, turbo: turboFactor(c.state, t, CONFIG), factor: c.factor, rubberBefore: c.rubber,
    }));
    stepRace(sim, true, jump(t, sim));
    brake.observe(sim);
    for (const e of sim.events) if (e.type === 'star') stars.push(`${e.carId} à ${f2(e.t)} s`);
    steps.push({
      t, galahadSpeed: carSpeedMps(sim.cars[0].body),
      cars: sim.cars.map((c, i) => ({
        ...before[i], rubber: c.rubber, speedFactor: c.speedFactor, torqueFactor: c.torqueFactor, onScreen: c.onScreen,
      })),
    });
  }
  return { sim, steps, brake, stars };
}

describe('course à 5 de la graine 1, Galahad doigt posé (saut parfait aux fosses), 60 s', () => {
  let rec: ReturnType<typeof recordRace>;
  beforeAll(() => { rec = recordRace(60); }, 120_000);

  test('Galahad, champs : à chaque pas des 30 premières secondes, pas d’élastique, torqueFactor === 1 et speedFactor === turbo × factor', () => {
    const g = rec.sim.cars[0];
    expect(g.rubber).toBeNull();
    for (const s of rec.steps.filter((x) => x.t < 30)) {
      const c = s.cars[0];
      expect(c.rubber, `t = ${s.t}`).toBeNull();
      expect(c.torqueFactor, `t = ${s.t}`).toBe(1);
      expect(c.speedFactor, `t = ${s.t}`).toBe(c.turbo * c.factor);
      expect(c.onScreen, `t = ${s.t}`).toBe(false);
    }
  });

  test('Galahad, effet physique : de son premier turbo à 3 s après, il dépasse 19 m/s (sous l’élastique, il plafonnerait à 18,2)', () => {
    const first = rec.steps.find((s) => s.cars[0].turbo > 1);
    expect(first, 'Galahad prend une étoile avant 60 s').toBeDefined();
    const vmax = Math.max(...rec.steps.filter((s) => s.t >= first!.t && s.t <= first!.t + 3).map((s) => s.galahadSpeed));
    console.log(`Galahad : premier turbo à ${f2(first!.t)} s, vitesse maximale dans les 3 s qui suivent ${f2(vmax)} m/s`);
    expect(vmax).toBeGreaterThan(19);
  });

  test('copains : couple = plafond (speedFactor === torqueFactor) à chaque pas où ils conduisent ; jamais au-delà de 1,3', () => {
    for (const s of rec.steps) {
      for (const c of s.cars.slice(1)) {
        if (c.finished) continue;
        expect(c.torqueFactor, `t = ${s.t}`).toBe(c.speedFactor);
        expect(c.speedFactor, `t = ${s.t}`).toBeLessThanOrEqual(CONFIG.RUBBER_MAX);
      }
    }
  });

  test('neutre (R7-8) : avant 5 s, les copains ont 1, ou 1,3 en turbo (ou 1 hors écran devant) ; étoiles prises avant 5 s imprimées', () => {
    const early = rec.steps.filter((s) => s.t < CONFIG.RUBBER_NEUTRAL_SECONDS);
    // sim.time est une somme de PHYSICS_DT : le pas de t ≈ 5 − 1e-13 est encore neutre (même comparaison que stepRubber).
    expect(early.length).toBeGreaterThanOrEqual(Math.round(CONFIG.RUBBER_NEUTRAL_SECONDS / DT));
    expect(early.length).toBeLessThanOrEqual(Math.round(CONFIG.RUBBER_NEUTRAL_SECONDS / DT) + 1);
    for (const s of early) {
      for (const c of s.cars.slice(1)) {
        expect(c.rubber, `t = ${s.t}`).toBe(1);
        expect([1, 1.3], `t = ${s.t}`).toContain(c.speedFactor);
        if (c.turbo === 1) expect(c.speedFactor, `t = ${s.t}`).toBe(1);
      }
    }
    const before5 = rec.stars.filter((x) => parseFloat(x.split(' à ')[1]) < CONFIG.RUBBER_NEUTRAL_SECONDS);
    console.log(`étoiles prises avant ${CONFIG.RUBBER_NEUTRAL_SECONDS} s (graine 1) : ${before5.length ? before5.join(', ') : 'aucune'}`);
  });

  test('taux : sur 30 s, |Δ rubber| ≤ 0,15 × dt à chaque pas d’un copain, hors pas du clamp de zone ; l’élastique a bien bougé', () => {
    const track = rec.sim.track;
    let moved = 0;
    let clamps = 0;
    for (const s of rec.steps.filter((x) => x.t < 30)) {
      for (const c of s.cars.slice(1)) {
        if (c.finished || c.rubberBefore === null || c.rubber === null) continue;
        const clamp = inVolcanoZone(track, c.x) && c.rubberBefore + STEP < 1;
        if (clamp) { clamps++; continue; }
        expect(Math.abs(c.rubber - c.rubberBefore), `t = ${s.t}, x = ${f1(c.x)}`).toBeLessThanOrEqual(STEP + 1e-12);
        moved = Math.max(moved, Math.abs(c.rubber - 1));
      }
    }
    console.log(`taux : écart maximal de l'élastique à 1 sur 30 s ${f2(moved)} ; pas de clamp de zone ${clamps}`);
    expect(moved).toBeGreaterThan(0.05);
  });

  test('freinage net à l’écran : 0 sur 60 s (seule exception : la fin du turbo du copain lui-même)', () => {
    console.log(`freinage net à l'écran, graine 1, 60 s : ${rec.brake.count} (fins de turbo à l'écran : ${rec.brake.turboEnds}) ${rec.brake.events.join(' ; ')}`);
    expect(rec.brake.count, rec.brake.events.join(' ; ')).toBe(0);
  });
});

describe('scénarios forcés (vrai pas de course)', () => {
  const track = trackFor(1);
  /** x d'un plat de la graine 1, loin de toute pré-zone (premier volcan à 365 m). */
  const X = 150;

  /** Course à 5 neuve : copains garés sur la grille (sauf ceux que le test conduit), Galahad garé en `xG`. */
  function forced(cfg: Config, xG: number, tr: Track = track): RaceSim {
    const sim = createRaceSim(tr, cfg, { robots: true });
    for (const c of sim.cars.slice(1)) c.driver = PARKED;
    place(sim, sim.cars[0], xG);
    return sim;
  }

  test('fenêtre : à 2,5 m derrière Galahad, cible base ; à 3,5 m derrière, cible > base ; à 19,5 m devant, base ; à 20,5 m devant, < base', () => {
    expect(zoneFloor(track, X - 4, NO_NEUTRAL) + zoneFloor(track, X + 21, NO_NEUTRAL)).toBe(0);
    const after = (gap: number): { base: number; rubber: number } => {
      const sim = forced(NO_NEUTRAL, X);
      const c = sim.cars[1];
      place(sim, c, X + gap);
      c.rubber = c.pilot.base;
      stepRace(sim, false);
      return { base: c.pilot.base, rubber: c.rubber! };
    };
    const a = after(-2.5);
    expect(a.rubber).toBe(a.base);
    const b = after(-3.5);
    expect(b.rubber).toBeGreaterThan(b.base);
    const c = after(19.5);
    expect(c.rubber).toBe(c.base);
    const d = after(20.5);
    expect(d.rubber).toBeLessThan(d.base);
  });

  test('turbo loin devant (spec §7) : copain 60 m devant Galahad, turbo forcé : speedFactor ≤ 1, flammes gardées', () => {
    const sim = forced(CONFIG, X);
    const c = sim.cars[1];
    c.driver = () => ({ throttle: true, jump: false });
    place(sim, c, X + 60);
    activateTurbo(c.state, sim.time, CONFIG);
    for (let i = 0; i < 30; i++) {
      stepRace(sim, false);
      expect(c.speedFactor).toBeLessThanOrEqual(1);
      expect(carView(sim, 1).turbo).toBe(true);
    }
  });

  test('freinage net, scénario forcé : copain en turbo (rubber 1,3) parti 15 m devant Galahad tenu à 14 m/s sur un plat : 1,3 tant qu’il est à l’écran, 1,0 au premier pas au-delà (hors écran), compteur à 0', () => {
    const flat = generateTrack(1, 600, CONFIG, { onlyPlat: true });
    const sim = forced(NO_NEUTRAL, 100, flat);
    const [g, c] = sim.cars;
    // Aucune étoile prenable : Galahad reste à 14 m/s, le copain garde son seul turbo (prises datées très loin).
    for (const star of sim.stars) star.takenAt.forEach((_, k) => takeStarFor(star, k, 1e9));
    c.driver = () => ({ throttle: true, jump: false });
    place(sim, c, 115);
    launchSolo(sim, 100, 14, NO_NEUTRAL, 1); // Galahad : facteur 1, sans élastique
    setCarSpeed(c, flat, 115, 14, NO_NEUTRAL);
    c.rubber = 1.3;
    activateTurbo(c.state, sim.time, NO_NEUTRAL);
    const brake = new BrakeWatch(sim);
    let crossed: { t: number; gap: number; edge: number; f: number; onScreen: boolean } | null = null;
    let onScreenSteps = 0;
    while (sim.time < 3 && crossed === null) {
      const gap = chassisX(c) - chassisX(g);
      const edge = screenAheadEdge(carSpeedMps(g.body), NO_NEUTRAL);
      stepRace(sim, true);
      brake.observe(sim);
      if (gap <= edge) {
        onScreenSteps++;
        expect(c.speedFactor, `t = ${sim.time}, gap ${gap}`).toBe(1.3);
        expect(c.onScreen).toBe(true);
      } else {
        crossed = { t: sim.time, gap, edge, f: c.speedFactor, onScreen: c.onScreen };
      }
    }
    console.log(`freinage net, scénario forcé : ${onScreenSteps} pas à l'écran à 1,3 ; bord franchi à t = ${f2(crossed?.t ?? NaN)} s (gap ${f2(crossed?.gap ?? NaN)} m, bord ${f2(crossed?.edge ?? NaN)} m), facteur ${crossed?.f}`);
    expect(crossed, 'le copain passe le bord avant de l’écran pendant son turbo').not.toBeNull();
    expect(crossed!.gap).toBeGreaterThan(21);
    expect(crossed!.gap).toBeLessThan(21.6);
    expect(crossed!.f).toBe(1);
    expect(crossed!.onScreen).toBe(false);
    expect(c.state.turboUntil).toBeGreaterThan(sim.time);
    expect(brake.count, brake.events.join(' ; ')).toBe(0);
  });

  /**
   * Review Focus n° 3 : un copain (jumpSkill 0) freiné à 0,6, Galahad garé 150 m derrière lui, posé 100 m avant
   * xLancement (ou juste après le xEnd du volcan précédent s'il est plus près), lancé à 0,6 × V_MAX, ou posé à
   * xLancement + 1 (clamp au premier pas) ; facteur appliqué à chaque pas de [xLancement, xLava], chutes.
   */
  function rf3(v: Volcano, x0: number): { minF: number; minRubber: number; zoneSteps: number; firstF: number; lava: number; passed: boolean; respawns: string[]; edgeSpeed: number } {
    const sim = forced(NO_NEUTRAL, Math.max(5, x0 - 150));
    const c = sim.cars[1];
    c.driver = makeRobotDriver({ ...c.pilot, jumpSkill: 0 }, 1, track, sim.pilotSeed, NO_NEUTRAL);
    place(sim, c, x0);
    setCarSpeed(c, track, x0, 0.6 * CONFIG.V_MAX, NO_NEUTRAL);
    c.rubber = 0.6;
    let minF = Infinity;
    let minRubber = Infinity;
    let zoneSteps = 0;
    let firstF = NaN;
    let edgeSpeed = NaN;
    const respawns: string[] = [];
    while (sim.time < 30 && chassisX(c) < v.xReception + 20) {
      const x = chassisX(c);
      if (Number.isNaN(edgeSpeed) && x >= (v.kind === 'fosse' ? v.xBord : v.xLancement) - 0.5) edgeSpeed = carSpeedMps(c.body);
      stepRace(sim, false);
      if (Number.isNaN(firstF)) firstF = c.speedFactor;
      if (x >= v.xLancement && x <= v.xLava) {
        zoneSteps++;
        minF = Math.min(minF, c.speedFactor);
        minRubber = Math.min(minRubber, c.rubber!);
      }
      for (const e of sim.events) if (e.type === 'respawn' && e.carId === c.state.id) respawns.push((e as RespawnEvent).reason);
      if (respawns.length) break;
    }
    return { minF, minRubber, zoneSteps, firstF, lava: respawns.filter((r) => r === 'lava').length, passed: chassisX(c) >= v.xReception + 20, respawns, edgeSpeed };
  }

  const tremplin = tremplins(track)[0];
  const fosse = fosses(track)[0];
  /** 100 m avant xLancement, ou juste après le xEnd du volcan précédent s'il est plus près. */
  const startBefore = (v: Volcano): number => {
    const prev = track.volcanoes[track.volcanoes.indexOf(v) - 1];
    return Math.max(v.xLancement - 100, prev ? prev.xEnd + 1 : -Infinity);
  };

  test.each([
    ['premier tremplin', tremplin],
    ['première fosse', fosse],
  ] as const)('Review Focus n° 3, %s de la graine 1 : copain freiné à 0,6 loin devant, facteur ≥ 1 sur [xLancement, xLava], volcan passé sans chute', (_name, v) => {
    const r = rf3(v, startBefore(v));
    console.log(`Review Focus n° 3, ${v.kind} ${f1(v.xLancement)} : départ ${f1(startBefore(v))} ; facteur au 1er pas ${f2(r.firstF)} ; dans la zone : ${r.zoneSteps} pas, facteur min ${f2(r.minF)}, élastique min ${f2(r.minRubber)} ; vitesse au ${v.kind === 'fosse' ? 'bord' : 'lancement'} ${f2(r.edgeSpeed)} m/s ; réapparitions [${r.respawns.join(', ')}]`);
    expect(r.firstF).toBeCloseTo(0.6, 2);
    expect(r.zoneSteps).toBeGreaterThan(60);
    expect(r.minF).toBeGreaterThanOrEqual(1);
    expect(r.minRubber).toBeGreaterThanOrEqual(1);
    expect(r.respawns).toEqual([]);
    expect(r.passed).toBe(true);
  });

  test.each([
    ['premier tremplin', tremplin],
    ['première fosse', fosse],
  ] as const)('Review Focus n° 3, variante : le copain posé à xLancement + 1 avec 0,6 (%s) : clamp au premier pas, volcan passé', (_name, v) => {
    const r = rf3(v, v.xLancement + 1);
    console.log(`Review Focus n° 3, variante, ${v.kind} ${f1(v.xLancement)} : facteur au 1er pas ${f2(r.firstF)}, min ${f2(r.minF)} ; réapparitions [${r.respawns.join(', ')}]`);
    expect(r.firstF).toBeGreaterThanOrEqual(1);
    expect(r.minF).toBeGreaterThanOrEqual(1);
    expect(r.respawns).toEqual([]);
    expect(r.passed).toBe(true);
  });

  test('élastique coupé (R7-3) : launchSolo sur un copain met rubber = null ; il roule alors à turbo × factor, couple 1', () => {
    const sim = forced(CONFIG, X);
    const c = sim.cars[1];
    c.driver = () => ({ throttle: true, jump: false });
    place(sim, c, X + 30);
    expect(c.rubber).toBe(1);
    launchSolo({ ...sim, cars: [c] }, X + 30, 3, CONFIG);
    expect(c.rubber).toBeNull();
    expect(c.factor).toBeCloseTo(3 / 14, 12);
    stepRace(sim, false);
    expect(c.speedFactor).toBe(c.factor);
    expect(c.torqueFactor).toBe(1);
    expect(c.onScreen).toBe(false);
  });
});
