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
  /** x de la lave de la dernière chute dans la lave ; remis à null par tout autre respawn (tâche 10a du plan A, série « même volcan »). */
  lastRespawnLavaX: number | null;
  consecutiveRespawns: number;
  /**
   * Réapparitions depuis le départ (toute raison, et chaque reconstruction `rebuildCars`) : chaque téléportation
   * l'incrémente (`applyRespawnToState`). Le driver d'un copain y lit une nouvelle tentative (tâche 6).
   */
  respawnCount: number;
  /** Instants (s) de début de retournement / de voiture sur le côté / de blocage, null sinon. */
  flippedSince: number | null;
  sideSince: number | null;
  stuckSince: number | null;
  /** Progression de référence pour la détection de blocage. */
  stuckRefProgress: number;
  invulnerableUntil: number;
  turboUntil: number;
  finishedAt: number | null;
  /** Instant (s) du dernier saut de la voiture, null si jamais (délai JUMP_COOLDOWN, tâche 5e). */
  lastJumpAt: number | null;
  /** Instant (s) de la demande de saut pas encore servie, null sans demande (mémoire JUMP_BUFFER, tâche 5e). */
  jumpRequestedAt: number | null;
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
    respawnCount: 0,
    flippedSince: null,
    sideSince: null,
    stuckSince: null,
    stuckRefProgress: start.x,
    invulnerableUntil: 0,
    turboUntil: 0,
    finishedAt: null,
    lastJumpAt: null,
    jumpRequestedAt: null,
  };
}
