// Rendu interpolé (tâche 5f du plan B ; tremblement §6) : rejeu d'une course enregistrée sur des écrans
// simulés à travers les mêmes `runFrame`, `presentFrame` (caméra, scène) et `stepOutcome` que `Game` ;
// scène aux poses données ; téléportations sans traînée ; physique inchangée par la boucle d'images. La
// version longue (12 courses à 5 voitures, 4 écrans) est dans tests/slow/interpolation-replay-slow.test.ts ;
// le câblage de `Game` lui-même : tests/game-frame.test.ts.
import { CONFIG } from '../src/config';
import { runFrame, type FrameState, type StepOutcome } from '../src/loop/frame';
import { PoseHistory } from '../src/loop/interpolation';
import { placeCar } from '../src/physics/car';
import { stepOutcome } from '../src/sim/present';
import { createRaceSim, posesOf, rebuildCars, sceneOf, stepRace, type RaceSim } from '../src/sim/simulate';
import { heightAt } from '../src/track/query';
import { frameTimesMs, recordTrajectory, replayScreenX, shakeEpisodes, VIEW_W, type RenderMode, type ScreenModel } from './helpers/frames';
import { stepFingerprint } from './helpers/fingerprint';
import { AP } from './helpers/anciennes-pistes';
import { trackFor } from './helpers/runs';

const DT = CONFIG.PHYSICS_DT;

describe('Galahad seul, graine 1, 40 s doigt posé : épisodes de tremblement au rejeu', () => {
  const seed = 1;
  const traj = recordTrajectory(seed, 40, false, AP);
  const track = trackFor(seed, AP);
  const screens: ScreenModel[] = [0, 1, 2].flatMap((s) => [
    { hz: 60.05, jitterMs: 0.2, seed: s },
    { hz: 59.94, jitterMs: 0.1, seed: s },
  ]);
  const modes: RenderMode[] = ['physique', 'actuel', 'interpolé'];
  const replays = screens.map((m) => Object.fromEntries(modes.map((mode) => [mode, replayScreenX(traj, track, m, mode)])) as Record<RenderMode, ReturnType<typeof replayScreenX>>);
  const counts = replays.map((r) => Object.fromEntries(modes.map((mode) => [mode, shakeEpisodes(r[mode])])) as Record<RenderMode, number>);
  console.log(screens.map((m, i) => `${m.hz} Hz σ ${m.jitterMs} ms écran ${m.seed} : physique ${counts[i].physique}, actuel ${counts[i].actuel}, interpolé ${counts[i]['interpolé']}`).join('\n'));

  test('contrôle : le rendu actuel (sans interpolation) tremble au moins une fois', () => {
    expect(counts.reduce((a, c) => a + c.actuel, 0)).toBeGreaterThanOrEqual(1);
  });

  test.each(screens.map((m, i) => [`${m.hz} Hz σ ${m.jitterMs} écran ${m.seed}`, i] as const))('%s : interpolé = 0 et ≤ physique', (_, i) => {
    expect(counts[i]['interpolé']).toBe(0);
    expect(counts[i]['interpolé']).toBeLessThanOrEqual(counts[i].physique);
  });

  test('Galahad dessiné reste à l’écran à chaque image (la scène suit les poses, la caméra le suit)', () => {
    for (const r of replays) {
      for (const mode of modes) {
        const xs = r[mode].x;
        expect(xs.length).toBeGreaterThan(2000);
        expect(Math.min(...xs), mode).toBeGreaterThan(0);
        expect(Math.max(...xs), mode).toBeLessThan(VIEW_W);
      }
    }
  });
});

/** Pas de course pour `runFrame`, comme `Game.step` (`stepOutcome`) ; sans le drapeau de téléportation si `keepTeleport` est faux. */
const stepOf = (sim: RaceSim, keepTeleport = true) => (): StepOutcome => {
  stepRace(sim, true);
  const out = stepOutcome(sim);
  return keepTeleport || out === 'stop' || 'rebuilt' in out ? out : { poses: out.poses, teleported: new Set() };
};

function frameState(sim: RaceSim): FrameState {
  const history = new PoseHistory();
  history.reset(posesOf(sim));
  return { acc: 0, history };
}

describe('téléportation : Galahad posé à xLava du premier volcan de la graine 1', () => {
  const track = trackFor(1, AP);
  const v = track.volcanoes[0];
  const fresh = (): RaceSim => {
    const sim = createRaceSim(track, CONFIG);
    placeCar(sim.cars[0].body, v.xLava, (x) => heightAt(track, x), 0, CONFIG);
    return sim;
  };
  // Pas (index 1…) du premier 'respawn'.
  const respawnStep = (() => {
    const sim = fresh();
    for (let k = 1; k <= 600; k++) {
      stepRace(sim, true);
      if (sim.events.some((e) => e.type === 'respawn')) return k;
    }
    throw new Error('pas de réapparition en 10 s');
  })();

  /** Rejoue jusqu'au pas de la réapparition, qui tombe en dernier pas d'une image d'alpha `a`. */
  function drawnAtRespawn(a: number, keepTeleport: boolean) {
    const sim = fresh();
    const s = frameState(sim);
    for (let k = 1; k < respawnStep; k++) runFrame(s, DT, CONFIG, stepOf(sim, keepTeleport));
    expect(s.acc).toBe(0);
    const r = runFrame(s, DT * (1 + a), CONFIG, stepOf(sim, keepTeleport));
    expect(r.steps).toBe(1);
    expect(r.alpha).toBeCloseTo(a, 6);
    const e = sim.events.find((ev) => ev.type === 'respawn');
    expect(e).toBeDefined();
    return { sim, r, prevX: s.history.at(0)[0].chassis.x, target: e!.type === 'respawn' ? e!.target : null };
  }

  test.each([0, 0.5, 0.99])('alpha %f : l’image dessine exactement la cible', (a) => {
    const { sim, r, target } = drawnAtRespawn(a, true);
    expect(r.poses[0]).toEqual(posesOf(sim)[0]);
    expect(r.poses[0].chassis.x).toBeCloseTo(target!.x, 6);
  });

  test('contrôle : sans le drapeau de téléportation, alpha 0,5 dessine un x intermédiaire (traînée)', () => {
    const before = fresh();
    for (let k = 1; k < respawnStep; k++) stepRace(before, true);
    const xBefore = posesOf(before)[0].chassis.x;
    const { r, target } = drawnAtRespawn(0.5, false);
    const x = r.poses[0].chassis.x;
    expect(Math.abs(x - target!.x)).toBeGreaterThan(1);
    expect(x).toBeCloseTo((xBefore + target!.x) / 2, 6);
  });
});

test('rebuildCars : la pose dessinée est la cible reconstruite, sans interpolation', () => {
  const sim = createRaceSim(trackFor(1, AP), CONFIG);
  const s = frameState(sim);
  for (let k = 0; k < 120; k++) runFrame(s, DT, CONFIG, stepOf(sim));
  const xBefore = posesOf(sim)[0].chassis.x;
  const r = runFrame(s, DT * 1.5, CONFIG, () => {
    rebuildCars(sim);
    return { rebuilt: posesOf(sim) };
  });
  expect(r.alpha).toBeCloseTo(0.5, 6);
  expect(r.steps).toBe(0);
  expect(r.poses).toEqual(posesOf(sim));
  expect(Math.abs(r.poses[0].chassis.x - xBefore)).toBeGreaterThan(1);
});

test('physique inchangée : 600 pas à 5 voitures (graine 2), avec et sans runFrame, même empreinte à chaque pas', () => {
  const track = trackFor(2, AP);
  const direct = createRaceSim(track, CONFIG, { robots: true });
  const expected: string[] = [];
  for (let k = 0; k < 600; k++) {
    stepRace(direct, true);
    expected.push(stepFingerprint(direct));
  }
  const sim = createRaceSim(track, CONFIG, { robots: true });
  const s = frameState(sim);
  const got: string[] = [];
  const times = frameTimesMs({ hz: 60.05, jitterMs: 0.5, seed: 7 }, 12);
  let last = 0;
  for (const now of times) {
    const elapsed = (now - last) / 1000;
    last = now;
    runFrame(s, elapsed, CONFIG, () => {
      if (got.length >= 600) return 'stop';
      stepRace(sim, true);
      got.push(stepFingerprint(sim));
      return stepOutcome(sim);
    });
    if (got.length >= 600) break;
  }
  expect(got).toHaveLength(600);
  expect(got).toEqual(expected);
});

test('sceneOf(sim, poses, α) : voitures aux poses données (Galahad dessiné en dernier), t = sim.time − (1 − α)·dt', () => {
  const sim = createRaceSim(trackFor(2, AP), CONFIG, { robots: true });
  for (let k = 0; k < 90; k++) stepRace(sim, true);
  const poses = posesOf(sim).map((p, i) => ({
    chassis: { x: p.chassis.x - 1 - i, y: p.chassis.y + 0.5, angle: 0.1 * i },
    wheels: p.wheels.map((w, j) => ({ x: w.x - 1 - i, y: w.y + 0.5, angle: 7 + i + j })),
    speed: 3,
  }));
  for (const a of [0, 0.25, 0.99]) {
    const scene = sceneOf(sim, poses, a);
    expect(scene.t).toBe(sim.time - (1 - a) * DT);
    const drawn = [...scene.cars].reverse();
    expect(drawn).toHaveLength(5);
    drawn.forEach((c, i) => {
      expect({ x: c.x, y: c.y, angle: c.angle }).toEqual(poses[i].chassis);
      expect(c.wheels).toEqual(poses[i].wheels);
      expect(c.name).toBe(sim.cars[i].state.name);
    });
  }
  // Sans poses : état du dernier pas, t = sim.time.
  const plain = sceneOf(sim);
  expect(plain.t).toBe(sim.time);
  expect(plain.cars[4].x).toBe(posesOf(sim)[0].chassis.x);
});
