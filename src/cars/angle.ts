const TWO_PI = 2 * Math.PI;

/** Angle ramené dans (−π, π]. */
export function normalizeAngle(a: number): number {
  let r = a % TWO_PI; // (−2π, 2π)
  if (r <= -Math.PI) r += TWO_PI;
  else if (r > Math.PI) r -= TWO_PI;
  return r;
}
