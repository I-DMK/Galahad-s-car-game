// Une image de la boucle (`runFrame`, `cameraTarget`, tâche 5f du plan B) : tests purs, sans physique.
import { CONFIG } from '../src/config';
import { advanceAccumulator } from '../src/loop/accumulator';
import { cameraTarget, runFrame, type FrameState, type StepOutcome } from '../src/loop/frame';
import { PoseHistory, type CarPose } from '../src/loop/interpolation';

const DT = CONFIG.PHYSICS_DT;

/** Pose d'une voiture au x donné (y = 0, angles nuls). */
const pose = (x: number, y = 0, speed = 0): CarPose => ({
  chassis: { x, y, angle: 0 }, wheels: [{ x: x - 0.7, y, angle: 0 }, { x: x + 0.7, y, angle: 0 }], speed,
});

function freshState(x = 0): FrameState {
  const history = new PoseHistory();
  history.reset([pose(x)]);
  return { acc: 0, history };
}

/** Pas factices : la voiture avance de 1 m par pas ; indices reçus mémorisés. */
function stepper(calls: number[]): (i: number) => StepOutcome {
  let x = 0;
  return (i) => {
    calls.push(i);
    x += 1;
    return { poses: [pose(x)], teleported: new Set() };
  };
}

test.each([0, 0.004, DT, DT * 1.5, DT * 2 + 0.003, 0.2, 1])('nombre de pas = advanceAccumulator (elapsed %f s)', (elapsed) => {
  const s = freshState();
  s.acc = 0.01;
  const expected = advanceAccumulator(0.01, elapsed, DT, CONFIG.MAX_STEPS_PER_FRAME);
  const calls: number[] = [];
  const r = runFrame(s, elapsed, CONFIG, stepper(calls));
  expect(r.steps).toBe(expected.steps);
  expect(calls).toHaveLength(expected.steps);
  expect(s.acc).toBe(expected.acc);
  expect(r.stopped).toBe(false);
});

test('step reçoit i = 0 pour le premier pas, puis 1, 2…', () => {
  const calls: number[] = [];
  runFrame(freshState(), 3 * DT + 0.001, CONFIG, stepper(calls));
  expect(calls).toEqual([0, 1, 2]);
});

test("'stop' interrompt la boucle", () => {
  const calls: number[] = [];
  const r = runFrame(freshState(), 3 * DT + 0.001, CONFIG, (i) => {
    calls.push(i);
    return i === 1 ? 'stop' : { poses: [pose(i + 1)], teleported: new Set() };
  });
  expect(calls).toEqual([0, 1]);
  expect(r.stopped).toBe(true);
});

test('{ rebuilt } remet l’historique à zéro et termine les pas de l’image', () => {
  const s = freshState();
  const calls: number[] = [];
  const r = runFrame(s, 3 * DT + DT / 2, CONFIG, (i) => {
    calls.push(i);
    return i === 1 ? { rebuilt: [pose(42)] } : { poses: [pose(i + 1)], teleported: new Set() };
  });
  expect(calls).toEqual([0, 1]);
  expect(r.stopped).toBe(false);
  // Historique remis à zéro : précédent = courant = poses reconstruites, quel que soit alpha.
  expect(r.poses[0].chassis.x).toBe(42);
  expect(s.history.at(0)[0].chassis.x).toBe(42);
  expect(s.history.at(1)[0].chassis.x).toBe(42);
});

test('sans interpolation : poses du dernier pas, alpha = 1', () => {
  const r = runFrame(freshState(), 2 * DT + DT / 2, CONFIG, stepper([]), false);
  expect(r.alpha).toBe(1);
  expect(r.poses[0].chassis.x).toBe(2);
});

test('alpha = acc / dt', () => {
  const s = freshState();
  const r = runFrame(s, DT * 1.25, CONFIG, stepper([]));
  expect(r.steps).toBe(1);
  expect(r.alpha).toBeCloseTo(0.25, 9);
  expect(r.alpha).toBe(s.acc / DT);
});

test('cameraTarget : x et vitesse de la pose, y = max(y, sol + 3)', () => {
  expect(cameraTarget(pose(10, 2, 14), () => 1)).toEqual({ x: 10, y: 4, speed: 14 });
  expect(cameraTarget(pose(10, 9, 7), () => 1)).toEqual({ x: 10, y: 9, speed: 7 });
  expect(cameraTarget(pose(10, 2, 0), (x) => x / 10)).toEqual({ x: 10, y: 4, speed: 0 });
});
