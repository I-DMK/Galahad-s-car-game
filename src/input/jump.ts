/**
 * Demande de saut (plan B, tâche 5e ; addendum « bouton saut » §1) : un front d'appui, `pointerdown` sur le
 * bouton ou `keydown` Espace non répété, dépose une demande ; garder le doigt ou la touche enfoncés ne relance
 * rien. Le bouton porte `data-no-pedal` : son pointeur n'entre jamais dans `Throttle` (le gaz).
 */
export class JumpInput {
  private requested = false;
  private readonly target: Window;
  private readonly button: HTMLElement;

  constructor(target: Window, button: HTMLElement) {
    this.target = target;
    this.button = button;
    button.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('keydown', this.onKeyDown);
  }

  /** Vrai s'il y a une demande depuis le dernier appel, et la consomme. */
  take(): boolean {
    const r = this.requested;
    this.requested = false;
    return r;
  }

  /** Jette la demande en attente (après l'arrivée ; décompte et pause, tâche 10). */
  clear(): void {
    this.requested = false;
  }

  dispose(): void {
    this.button.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.requested = false;
  }

  private readonly onPointerDown = (): void => {
    this.requested = true;
  };

  private readonly onKeyDown = (e: Event): void => {
    const k = e as KeyboardEvent;
    if (k.code !== 'Space') return;
    // Espace ne fait jamais défiler la page ni n'active un bouton qui aurait le focus.
    k.preventDefault();
    if (!k.repeat) this.requested = true;
  };
}
