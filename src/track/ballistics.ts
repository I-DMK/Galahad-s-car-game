/**
 * Portée horizontale d'un saut : départ à la vitesse v0 (m/s) avec l'angle `angle` (rad),
 * gravité g (m/s²), et `drop` mètres de chute entre le point de départ et l'atterrissage.
 */
export function jumpRange(v0: number, g: number, angle: number, drop = 0): number {
  const vy = v0 * Math.sin(angle);
  const t = (vy + Math.sqrt(vy * vy + 2 * g * drop)) / g;
  return v0 * Math.cos(angle) * t;
}

/** Distance d'élan pour atteindre vTarget (m/s) avec une accélération constante accel (m/s²). */
export const runUpDistance = (vTarget: number, accel: number): number =>
  (vTarget * vTarget) / (2 * accel);
