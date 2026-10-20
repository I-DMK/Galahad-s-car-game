// Turbo : pur (ni DOM, ni matter-js). Une étoile donne TURBO_SECONDS de vitesse × TURBO_FACTOR.
import type { Config } from '../config';
import type { CarState } from './state';

/** Lance (ou relance à TURBO_SECONDS pleines) le turbo à l'instant t (s). */
export function activateTurbo(state: CarState, t: number, cfg: Config): void {
  state.turboUntil = t + cfg.TURBO_SECONDS;
}

/** Facteur de vitesse à l'instant t : TURBO_FACTOR pendant le turbo, 1 sinon. */
export function turboFactor(state: CarState, t: number, cfg: Config): number {
  return t < state.turboUntil ? cfg.TURBO_FACTOR : 1;
}
