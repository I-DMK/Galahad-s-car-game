// État de course d'une voiture, indépendant de la physique : pur (ni DOM, ni matter-js).

/** Point sûr de réapparition (monde : m, y vers le haut ; angle positif = nez levé). */
export interface SafePoint { x: number; y: number; angle: number }

export interface CarState {
  id: string;
  name: string;
  /** Couleurs CSS (#rrggbb). */
  color: string;
  accent: string;
  /** x du châssis (m). */
  progress: number;
  safePoint: SafePoint;
  /** Instant (s) du dernier point sûr enregistré. */
  lastSafePointAt: number;
  /** x de la lave lors de la dernière réapparition pour cause de lave (tâche 10b). */
  lastRespawnLavaX: number | null;
  consecutiveRespawns: number;
  /** Instants (s) de début de retournement / de voiture sur le côté / de blocage, null sinon. */
  flippedSince: number | null;
  sideSince: number | null;
  stuckSince: number | null;
  /** Progression de référence pour la détection de blocage. */
  stuckRefProgress: number;
  invulnerableUntil: number;
  turboUntil: number;
  finishedAt: number | null;
}

export function newCarState(id: string, name: string, color: string, accent: string, start: SafePoint): CarState {
  return {
    id,
    name,
    color,
    accent,
    progress: start.x,
    safePoint: { ...start },
    lastSafePointAt: 0,
    lastRespawnLavaX: null,
    consecutiveRespawns: 0,
    flippedSince: null,
    sideSince: null,
    stuckSince: null,
    stuckRefProgress: start.x,
    invulnerableUntil: 0,
    turboUntil: 0,
    finishedAt: null,
  };
}
