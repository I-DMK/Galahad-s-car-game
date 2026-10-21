// Présentation d'une image (plan B, tâche 5f) : issue d'un pas pour `runFrame`, puis caméra et scène aux
// poses dessinées. Sans DOM ; partagé par `Game` et par le rejeu des tests (tests/helpers/frames.ts), pour
// que les tests passent par le même câblage que le jeu.
import type { CarPose } from '../loop/interpolation';
import { cameraTarget, type StepOutcome } from '../loop/frame';
import type { Camera } from '../render/camera';
import type { Scene } from '../render/renderer';
import { heightAt } from '../track/query';
import { posesOf, sceneOf, teleportedOf, type RaceSim } from './simulate';

/** Issue d'un `stepRace` réussi pour `runFrame` : poses après le pas et voitures réapparues pendant le pas. */
export function stepOutcome(sim: RaceSim): StepOutcome {
  return { poses: posesOf(sim), teleported: teleportedOf(sim) };
}

/**
 * Caméra sur la pose dessinée de Galahad (`cameraTarget(poses[0])`, lissage au temps réel `elapsed`),
 * puis scène aux poses dessinées (`sceneOf(sim, poses, alpha)`). Ne modifie jamais `sim`.
 */
export function presentFrame(
  sim: RaceSim, frame: { poses: CarPose[]; alpha: number }, camera: Camera, elapsed: number,
): Scene {
  const target = cameraTarget(frame.poses[0], (x) => heightAt(sim.track, x));
  camera.update(target.x, target.y, target.speed, elapsed);
  return sceneOf(sim, frame.poses, frame.alpha);
}
