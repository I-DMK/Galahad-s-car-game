// Accumulateur de pas fixes : pur calcul (ni DOM, ni matter-js).

/** Tolérance d'arrondi : 1/60 + 1/60 doit donner 2 pas, pas 1,999… → 1. */
const EPS = 1e-9;

/**
 * Ajoute `elapsed` (s) à l'accumulateur `acc`, plafonné à `maxSteps × dt` (spirale de la mort,
 * onglet en veille), puis consomme autant de pas entiers de `dt` que possible.
 */
export function advanceAccumulator(
  acc: number, elapsed: number, dt: number, maxSteps: number,
): { steps: number; acc: number } {
  const total = Math.min(acc + elapsed, maxSteps * dt);
  const steps = Math.min(maxSteps, Math.floor(total / dt + EPS));
  return { steps, acc: Math.max(0, total - steps * dt) };
}
