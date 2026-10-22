/**
 * Demande de saut (plan B, tâche 5e ; addendum « bouton saut » §1) : un front d'appui, `pointerdown` sur le
 * bouton ou `keydown` Espace non répété, dépose une demande ; garder le doigt ou la touche enfoncés ne relance
 * rien. Le bouton porte `data-no-pedal` : son pointeur n'entre jamais dans `Throttle` (le gaz). Espace n'est pris
 * (et son défaut empêché) que pendant la course (`isActive`) et hors d'un contrôle qui a le focus (le bouton ENCORE,
 * un autre bouton) : là, Espace garde son rôle. Comme `Throttle`, tout ce qui peut faire perdre un appui (blur,
 * changement de visibilité) jette la demande en attente.
 */
export class JumpInput {
  private requested = false;
  private readonly target: Window;
  private readonly doc: Document;
  private readonly button: HTMLElement;
  private readonly isActive: () => boolean;

  constructor(target: Window, button: HTMLElement, isActive: () => boolean = () => true) {
    this.target = target;
    this.doc = target.document;
    this.button = button;
    this.isActive = isActive;
    button.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('blur', this.onClear);
    this.doc.addEventListener('visibilitychange', this.onClear);
  }

  /** Une demande attend-elle (sans la consommer) ? */
  get pending(): boolean {
    return this.requested;
  }

  /** Vrai s'il y a une demande depuis le dernier appel, et la consomme. */
  take(): boolean {
    const r = this.requested;
    this.requested = false;
    return r;
  }

  /** Jette la demande en attente (après l'arrivée, au retour d'onglet ; décompte et pause, tâche 10). */
  clear(): void {
    this.requested = false;
  }

  dispose(): void {
    this.button.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('blur', this.onClear);
    this.doc.removeEventListener('visibilitychange', this.onClear);
    this.requested = false;
  }

  private readonly onPointerDown = (): void => {
    this.requested = true;
  };

  private readonly onClear = (): void => {
    this.requested = false;
  };

  private readonly onKeyDown = (e: Event): void => {
    const k = e as KeyboardEvent;
    if (k.code !== 'Space' || !this.isActive()) return;
    // Un contrôle qui a le focus (bouton ENCORE, autre bouton, champ) garde Espace pour lui.
    const t = k.target;
    if (t instanceof Element && t !== this.button && t.closest(FOCUSABLE)) return;
    // Pendant la course, Espace ne fait jamais défiler la page.
    k.preventDefault();
    if (!k.repeat) this.requested = true;
  };
}

/** Contrôles qui gardent Espace quand ils ont le focus. */
const FOCUSABLE = 'button, a[href], input, select, textarea, [contenteditable]';
