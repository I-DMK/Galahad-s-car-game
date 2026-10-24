// Caméra 2D et taille du tampon du canvas. Pur calcul : ni DOM, ni matter-js (testable sous node).
// Coordonnées du monde en mètres, y vers le HAUT ; coordonnées écran en pixels, y vers le BAS.
import type { Config } from '../config';

export interface BackingSize { w: number; h: number; scale: number }

/**
 * Taille du tampon (pixels « backing ») pour un canvas de cssW × cssH px CSS à la densité dpr,
 * largeur plafonnée à maxW ; `scale` = pixels backing par pixel CSS.
 */
export function computeBackingSize(cssW: number, cssH: number, dpr: number, maxW = 1920): BackingSize {
  const w = Math.min(Math.round(cssW * dpr), maxW);
  const scale = w / cssW;
  const h = Math.round(cssH * scale);
  return { w, h, scale };
}

/**
 * Caméra suiveuse : centre de l'écran en (x, y) mètres.
 *
 * `update(targetX, targetY, speedMps, dt)` vise `(targetX + speedMps × CAMERA_LEAD_SECONDS, targetY)`
 * (on voit plus loin devant quand on roule vite) avec un lissage exponentiel indépendant de la cadence :
 * `x += (cible − x) × (1 − (1 − CAMERA_SMOOTHING)^(dt × 60))` (simple lerp de 0,08 à 60 i/s).
 * Le premier appel se cale directement sur la cible (pas de balayage au départ).
 *
 * La caméra reste générique : c'est l'appelant (boucle de jeu, Task 9b) qui choisit targetY,
 * attendu `max(yVoiture, ySolSousLaVoiture + 3)` pour garder le sol dans le bas de l'écran.
 */
export class Camera {
  private _x = 0;
  private _y = 0;
  private started = false;

  constructor(private readonly cfg: Config) {}

  get x(): number { return this._x; }
  get y(): number { return this._y; }

  /** La prochaine `update` se cale sur la cible sans lissage (scène du titre, nouvelle course ; tâche 10). */
  reset(): void {
    this.started = false;
  }

  update(targetX: number, targetY: number, speedMps: number, dt: number): void {
    const tx = targetX + speedMps * this.cfg.CAMERA_LEAD_SECONDS;
    if (!this.started) {
      this._x = tx;
      this._y = targetY;
      this.started = true;
      return;
    }
    const k = 1 - Math.pow(1 - this.cfg.CAMERA_SMOOTHING, dt * 60);
    this._x += (tx - this._x) * k;
    this._y += (targetY - this._y) * k;
  }

  /** Pixels par mètre pour une vue de viewH pixels de haut (VISIBLE_HEIGHT_M mètres visibles). */
  pxPerMeter(viewH: number): number {
    return viewH / this.cfg.VISIBLE_HEIGHT_M;
  }

  /** Demi-largeur visible, en mètres. */
  visibleHalfWidthM(viewW: number, viewH: number): number {
    return viewW / (2 * this.pxPerMeter(viewH));
  }

  /** Point du monde (m, y vers le haut) → pixels écran (y vers le bas). */
  worldToScreen(p: { x: number; y: number }, viewW: number, viewH: number): { x: number; y: number } {
    const ppm = this.pxPerMeter(viewH);
    return { x: viewW / 2 + (p.x - this._x) * ppm, y: viewH / 2 - (p.y - this._y) * ppm };
  }
}
