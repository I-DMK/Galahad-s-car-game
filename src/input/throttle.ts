/**
 * Accélérateur à un doigt : un doigt n'importe où sur l'écran = on accélère.
 * Suit les `pointerId` actifs ; tout événement qui peut « perdre » un doigt
 * (blur, changement de visibilité) relâche tout.
 */
export class Throttle {
  private readonly active = new Set<number>();
  private readonly target: Window;
  private readonly doc: Document;

  constructor(target: Window = window) {
    this.target = target;
    this.doc = target.document;
    target.addEventListener('pointerdown', this.onDown, { passive: true });
    target.addEventListener('pointerup', this.onUp, { passive: true });
    target.addEventListener('pointercancel', this.onUp, { passive: true });
    target.addEventListener('blur', this.onClear);
    target.addEventListener('contextmenu', this.onContextMenu);
    this.doc.addEventListener('visibilitychange', this.onClear);
  }

  get pressed(): boolean {
    return this.active.size > 0;
  }

  dispose(): void {
    const t = this.target;
    t.removeEventListener('pointerdown', this.onDown);
    t.removeEventListener('pointerup', this.onUp);
    t.removeEventListener('pointercancel', this.onUp);
    t.removeEventListener('blur', this.onClear);
    t.removeEventListener('contextmenu', this.onContextMenu);
    this.doc.removeEventListener('visibilitychange', this.onClear);
    this.active.clear();
  }

  private readonly onDown = (e: Event): void => {
    const t = e.target;
    if (t instanceof Element && t.closest('[data-no-pedal]')) return;
    this.active.add((e as PointerEvent).pointerId);
  };

  private readonly onUp = (e: Event): void => {
    this.active.delete((e as PointerEvent).pointerId);
  };

  private readonly onClear = (): void => {
    this.active.clear();
  };

  private readonly onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
}
