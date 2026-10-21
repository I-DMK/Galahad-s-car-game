// Compteur d'images par nombre de pas (plan B, tâche 5f ; `?debug=1`) : pur calcul (ni DOM, ni matter-js).

/** Images de la dernière seconde close : total, à 0 pas, à 2 pas ou plus. */
export interface StepCounts { frames: number; zero: number; multi: number }

/**
 * Pas par image (`runFrame`) comptés sur des fenêtres d'au moins 1 s : `last` donne la dernière fenêtre
 * close (zéros avant la première), puis le compteur repart à zéro.
 */
export class StepHistogram {
  readonly last: StepCounts = { frames: 0, zero: 0, multi: 0 };
  private readonly current: StepCounts = { frames: 0, zero: 0, multi: 0 };
  private since: number | null = null;

  /**
   * Une image de `steps` pas à l'instant `nowMs` (horodatage de requestAnimationFrame). Renvoie true quand
   * elle ferme une fenêtre (`last` vient de changer).
   */
  record(steps: number, nowMs: number): boolean {
    this.since ??= nowMs;
    const c = this.current;
    c.frames++;
    if (steps === 0) c.zero++;
    else if (steps >= 2) c.multi++;
    if (nowMs - this.since < 1000) return false;
    Object.assign(this.last, c);
    this.reset();
    this.since = nowMs;
    return true;
  }

  /** Oublie la fenêtre en cours (retour d'onglet : l'image suivante en ouvre une neuve) ; `last` est gardé. */
  reset(): void {
    const c = this.current;
    c.frames = c.zero = c.multi = 0;
    this.since = null;
  }
}
