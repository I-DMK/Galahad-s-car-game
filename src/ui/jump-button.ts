// Bouton saut (plan B, tâche 5e ; addendum « bouton saut » §1) : rond, en bas à gauche, icône de ressort.
// Il vit dans #hud (`pointer-events: none`) et reprend donc le pointeur pour lui seul. Il porte `data-no-pedal` :
// son appui n'est jamais du gaz (`Throttle`). Grisé par la classe `is-waiting`, jamais par `disabled` : un
// bouton désactivé n'émet pas de `pointerdown` vers sa cible, et le tap risquerait de compter comme du gaz.
import type { Config } from '../config';

const STYLE_ID = 'jump-button-style';
const css = (size: number): string => `
.jump-button{position:absolute;left:28px;bottom:40px;width:${size}px;height:${size}px;border-radius:50%;
  border:5px solid #fff;background:#1e5cff;color:#fff;padding:0;margin:0;display:flex;align-items:center;
  justify-content:center;pointer-events:auto;touch-action:none;box-shadow:0 6px 0 #0008;cursor:pointer;
  -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;opacity:1;
  transition:opacity .12s linear}
.jump-button[hidden]{display:none}
.jump-button svg{width:62%;height:62%;pointer-events:none}
.jump-button.is-waiting{opacity:.4}
`;

/** Ressort comprimé sous une flèche vers le haut (SVG inline, sans fichier). */
const ICON = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor"
  stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M32 6 L20 18 M32 6 L44 18 M32 6 V26"/>
  <path d="M16 34 H48 L16 42 H48 L16 50 H48 L16 58 H48"/>
</svg>`;

export class JumpButton {
  readonly el: HTMLButtonElement;

  constructor(root: HTMLElement, cfg: Config) {
    const doc = root.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css(cfg.JUMP_BUTTON_SIZE_PX);
      doc.head.appendChild(style);
    }
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = 'jump-button';
    el.setAttribute('data-no-pedal', '');
    el.setAttribute('aria-label', 'Sauter');
    // Hors de l'ordre de tabulation : Espace (saut au clavier) n'active jamais le bouton.
    el.tabIndex = -1;
    el.innerHTML = ICON;
    root.appendChild(el);
    this.el = el;
  }

  /** Prêt (pleine opacité) ou en attente (grisé : en l'air, délai, course finie, décompte). */
  setReady(ready: boolean): void {
    this.el.classList.toggle('is-waiting', !ready);
  }

  /** Caché au titre, montré du décompte à l'arrivée (tâche 10) : attribut `hidden` (la feuille déclare `[hidden]{display:none}`). */
  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }
}
