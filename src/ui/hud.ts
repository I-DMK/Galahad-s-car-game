// HUD en DOM au-dessus du canvas : chrono, fps et compteur d'images à 0 / 2+ pas (debug, sous le bouton saut
// de `ui/jump-button.ts`, tâche 5e), calque d'arrivée, message d'erreur.
// Le conteneur (#hud) est en `pointer-events: none` : seul le calque d'arrivée capte le toucher.
import type { StepCounts } from '../loop/frame-stats';

const STYLE_ID = 'hud-style';
const CSS = `
.hud-time{position:absolute;top:16px;right:28px;font:700 64px system-ui,sans-serif;color:#fff;
  text-shadow:0 3px 0 #000a,0 0 12px #000c;font-variant-numeric:tabular-nums;letter-spacing:2px}
.hud-fps{position:absolute;left:28px;bottom:6px;font:500 16px system-ui,sans-serif;color:#fffc;
  text-shadow:0 1px 2px #000;line-height:20px}
.hud-steps{position:absolute;left:112px;bottom:6px;font:500 16px system-ui,sans-serif;color:#fffc;
  text-shadow:0 1px 2px #000;font-variant-numeric:tabular-nums;line-height:20px;white-space:nowrap}
.hud-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:24px;background:rgba(0,0,20,.65);pointer-events:auto;color:#fff;
  font-family:system-ui,sans-serif;text-align:center;text-shadow:0 3px 0 #000a}
.hud-title{font-weight:800;font-size:72px;letter-spacing:4px}
.hud-big{font-weight:800;font-size:120px;font-variant-numeric:tabular-nums}
.hud-again{width:120px;height:120px;border-radius:50%;border:4px solid #fff;background:#e2231a;
  color:#fff;font:800 22px system-ui,sans-serif;box-shadow:0 6px 0 #0008;cursor:pointer}
.hud-error{font-weight:700;font-size:48px;padding:0 32px}
`;

/** Secondes → « mm:ss ». */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private readonly time: HTMLDivElement;
  private readonly fps: HTMLDivElement;
  private readonly steps: HTMLDivElement;
  private overlay: HTMLDivElement | null = null;
  private lastTime = '';

  constructor(private readonly root: HTMLElement) {
    const doc = root.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      doc.head.appendChild(style);
    }
    this.time = this.div('hud-time');
    this.fps = this.div('hud-fps');
    this.fps.hidden = true;
    this.steps = this.div('hud-steps');
    this.steps.hidden = true;
    root.append(this.time, this.fps, this.steps);
    this.setTime(0);
  }

  setTime(seconds: number): void {
    const text = formatTime(seconds);
    if (text !== this.lastTime) this.time.textContent = this.lastTime = text;
  }

  setFps(fps: number | null): void {
    this.fps.hidden = fps === null;
    if (fps !== null) this.fps.textContent = `${Math.round(fps)} fps`;
  }

  /** Affiche les images de la dernière seconde à 0 pas et à 2 pas ou plus (`?debug=1`, tremblement §8). */
  setFrameSteps(counts: StepCounts): void {
    this.steps.hidden = false;
    this.steps.textContent = `0 pas : ${counts.zero} · 2+ pas : ${counts.multi}`;
  }

  showFinished(seconds: number, onAgain: () => void): void {
    const overlay = this.showOverlay();
    const title = this.div('hud-title', 'ARRIVÉE');
    const big = this.div('hud-big', formatTime(seconds));
    const again = this.root.ownerDocument.createElement('button');
    again.className = 'hud-again';
    again.type = 'button';
    again.textContent = 'ENCORE';
    again.setAttribute('data-no-pedal', '');
    again.addEventListener('click', () => onAgain());
    overlay.append(title, big, again);
  }

  showError(message: string): void {
    this.showOverlay().append(this.div('hud-error', message));
  }

  /** Retire le calque (arrivée ou erreur). */
  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private showOverlay(): HTMLDivElement {
    this.hide();
    this.overlay = this.div('hud-overlay');
    this.root.appendChild(this.overlay);
    return this.overlay;
  }

  private div(className: string, text?: string): HTMLDivElement {
    const d = this.root.ownerDocument.createElement('div');
    d.className = className;
    if (text !== undefined) d.textContent = text;
    return d;
  }
}
