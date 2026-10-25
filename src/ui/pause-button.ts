// Bouton pause en course (plan B, tâche 11, Partie 5 ; demande du papa après le test tablette de la tâche 10) : sous le
// chrono, en haut à droite, visible pendant le décompte et la course seulement (`Game`). data-no-pedal : son tap n'est jamais
// du gaz (`Throttle`) ; il met en pause comme le geste retour (calque PAUSE, REPRENDRE, reprise par un décompte à 3).
const STYLE_ID = 'pause-button-style';
/** Sous le chrono de `hud.ts` (top clamp(6px,1.25vw,16px), police clamp(26px,5vw,64px)), même marge droite. */
const CSS = `
.pause-button{position:absolute;top:calc(clamp(6px,1.25vw,16px) + 1.25 * clamp(26px,5vw,64px) + 8px);
  right:clamp(10px,2.2vw,28px);width:96px;height:96px;padding:0;margin:0;border-radius:24px;border:4px solid #fff;
  background:#0007;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;
  -webkit-tap-highlight-color:transparent;cursor:pointer;box-shadow:0 4px 0 #0008}
.pause-button[hidden]{display:none}
.pause-button svg{width:44%;height:44%;pointer-events:none}
`;
const PAUSE_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <rect x="14" y="10" width="13" height="44" rx="3" fill="#fff"/><rect x="37" y="10" width="13" height="44" rx="3" fill="#fff"/>
</svg>`;

export class PauseButton {
  readonly el: HTMLButtonElement;

  constructor(root: HTMLElement, onPause: () => void) {
    const doc = root.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      doc.head.appendChild(style);
    }
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = 'pause-button';
    el.setAttribute('data-no-pedal', '');
    el.setAttribute('aria-label', 'Pause');
    el.innerHTML = PAUSE_SVG;
    el.hidden = true;
    // Au pointerdown (tout de suite, même avec un doigt de gaz posé ailleurs) et au click (clavier) ; `Game` ignore le doublon.
    // `blur` : un Espace tapé ensuite au clavier reste un saut, pas un nouveau click sur ce bouton.
    const fire = (): void => { el.blur(); onPause(); };
    el.addEventListener('pointerdown', fire);
    el.addEventListener('click', fire);
    root.appendChild(el);
    this.el = el;
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }
}
