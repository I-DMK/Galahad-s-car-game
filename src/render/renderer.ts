// Rendu canvas 2D d'une scène : ciel (parallaxe), piste (portion visible), ombres, effets, étoiles, voitures.
// Les images (tâche 8b) arrivent par `setArt` ; tant qu'elles manquent, tout se dessine par code.
// Tout est dessiné en pixels « backing » (canvas.width × canvas.height) ; pxPerMeter vient de la hauteur backing.
// Le renderer reçoit des coordonnées du monde (mètres, y vers le haut) et n'importe jamais matter-js.
import type { Pilot } from '../cars/pilots';
import type { Config } from '../config';
import type { Track } from '../track/types';
import { Camera, computeBackingSize, type BackingSize } from './camera';
import { prerenderSky } from './background';
import { NO_ART, type Art } from './assets';
import { SHADOW_ALPHA, SHADOW_RX_M, SHADOW_RY_M, drawCar, drawShadow, shadowScale } from './car';
import type { Effects } from './effects';
import { TITLE_GROUND_FRAC, TITLE_NAME_SCALE, restingCarView, type TitleScene } from './title';
import { drawStar, drawTrack } from './track';

/** Voiture à dessiner, en coordonnées du monde. `angle` : angle du monde (positif = nez en haut). */
export interface CarView {
  /** Id du pilote : clé de la carrosserie image (`Art.bodies`, tâche 8b). */
  id: string;
  x: number;
  y: number;
  angle: number;
  /** Centres des roues (monde) et angle de rotation de chaque roue (même convention). */
  wheels: { x: number; y: number; angle: number }[];
  /** Couleurs CSS : carrosserie, bandes et aileron, casque du pilote. */
  color: string;
  accent: string;
  helmet: string;
  /** Prénom, écrit au-dessus des copains (pas de Galahad). */
  name: string;
  turbo: boolean;
}

export interface Scene {
  track: Track;
  cars: CarView[];
  stars: { x: number; y: number; active: boolean }[];
  /** Temps (s) pour les animations. */
  t: number;
}

const SKY_PARALLAX = 0.1;
/** Sol de la scène du titre : gris lunaire de la piste et son liseré clair (mêmes couleurs que `drawTrack`). */
const TITLE_GROUND = '#8b8b8b';
const TITLE_GROUND_EDGE = '#c8c8c8';
/** Largeur CSS (px) d'une petite voiture du podium quand la mise en page ne la donne pas (jsdom). */
const ICON_DEFAULT_CSS_PX = 160;
/** Cadre de la petite voiture (m) : 3,2 de large (rapport 2:1), centré 0,75 m au-dessus du sol (roues en bas, toit en haut). */
const ICON_W_M = 3.2;
const ICON_CENTER_Y_M = 0.75;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private view: BackingSize = { w: 1, h: 1, scale: 1 };
  private sky: HTMLCanvasElement | null = null;
  /** Images reçues par `setArt` ; null avant (la course ne les attend jamais : tout est alors dessiné par code). */
  private loaded: Art | null = null;
  /** Caméra fixe de la scène du titre (tâche 10) : recalée sans lissage à chaque `drawTitle`. */
  private readonly titleCamera: Camera;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly cfg: Config) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.titleCamera = new Camera(cfg);
    this.resize();
  }

  /** Recalcule la taille du tampon depuis la taille CSS et devicePixelRatio ; re-pré-rend le ciel. */
  resize(): void {
    const cssW = Math.max(1, this.canvas.clientWidth);
    const cssH = Math.max(1, this.canvas.clientHeight);
    const v = computeBackingSize(cssW, cssH, window.devicePixelRatio || 1, this.cfg.BACKING_MAX_WIDTH);
    this.canvas.width = v.w;
    this.canvas.height = v.h;
    this.view = v;
    this.sky = prerenderSky(v.w, v.h);
  }

  /** Images arrivées (tâche 8b) : le dessin passe du code aux images à la trame suivante. */
  setArt(art: Art): void {
    this.loaded = art;
  }

  /** Images reçues, null tant que `setArt` n'a pas été appelé : la source unique de `Game.art` (`__game.art`). */
  get art(): Art | null {
    return this.loaded;
  }

  /** Demi-largeur visible (m) du tampon courant, pour l'émission des effets. */
  visibleHalfWidthM(camera: Camera): number {
    return camera.visibleHalfWidthM(this.view.w, this.view.h);
  }

  /** `effects` : particules dessinées après la piste et les ombres, avant les étoiles et les voitures. */
  draw(scene: Scene, camera: Camera, effects?: Effects): void {
    const { ctx, view } = this;
    const art = this.loaded ?? NO_ART;
    const ppm = camera.pxPerMeter(view.h);
    this.clearAndSky(camera.x, ppm);

    drawTrack(ctx, scene.track, camera, view, scene.t);

    const toScreen = (p: { x: number; y: number }) => camera.worldToScreen(p, view.w, view.h);
    const half = camera.visibleHalfWidthM(view.w, view.h) + 1;
    const carReach = half + this.cfg.CAR_LENGTH;
    // Ombres d'abord, sur le sol : ni sur les effets ni sur les voitures voisines.
    for (const car of scene.cars) {
      if (Math.abs(car.x - camera.x) > carReach) continue;
      drawShadow(ctx, car, scene.track, ppm, toScreen, this.cfg);
    }
    effects?.draw(ctx, toScreen, ppm);
    for (const s of scene.stars) {
      if (!s.active || Math.abs(s.x - camera.x) > half) continue;
      const p = toScreen(s);
      drawStar(ctx, p.x, p.y, scene.t, ppm, art.star);
    }

    // Dans l'ordre de la scène (le dernier dessiné est au-dessus) ; les voitures hors écran sont sautées.
    for (const car of scene.cars) {
      if (Math.abs(car.x - camera.x) > carReach) continue;
      drawCar(ctx, car, ppm, scene.t, toScreen, this.cfg, art);
    }
  }

  /**
   * Scène du titre (tâche 10) : ciel (comme en course), sol gris de la ligne y = 0 jusqu'en bas, liseré, ombres (ellipse
   * noire SHADOW_RX_M × SHADOW_RY_M × s, alpha SHADOW_ALPHA × s, s = shadowScale(h)), puis voitures par `drawCar` avec les
   * images reçues par `setArt`. Caméra fixe : x = scene.centerX, y = (TITLE_GROUND_FRAC − 0,5) × VISIBLE_HEIGHT_M (l'écran
   * est centré 1,68 m au-dessus du sol : le sol tombe à 62 % de la hauteur).
   */
  drawTitle(scene: TitleScene): void {
    const { ctx, view } = this;
    const art = this.loaded ?? NO_ART;
    const camera = this.titleCamera;
    camera.reset();
    camera.update(scene.centerX, (TITLE_GROUND_FRAC - 0.5) * this.cfg.VISIBLE_HEIGHT_M, 0, 1);
    const ppm = camera.pxPerMeter(view.h);
    this.clearAndSky(camera.x, ppm);

    const toScreen = (p: { x: number; y: number }) => camera.worldToScreen(p, view.w, view.h);
    const groundY = toScreen({ x: 0, y: 0 }).y;
    ctx.fillStyle = TITLE_GROUND;
    ctx.fillRect(0, groundY, view.w, Math.max(0, view.h - groundY));
    ctx.fillStyle = TITLE_GROUND_EDGE;
    ctx.fillRect(0, groundY - 2 * view.scale, view.w, 3 * view.scale);

    // Ombres d'abord, sur le sol, sous chaque voiture ; réduites et éclaircies avec la hauteur de vol.
    scene.cars.forEach((car, i) => {
      const s = shadowScale(scene.heights[i] ?? 0);
      const g = toScreen({ x: car.x, y: 0 });
      ctx.save();
      ctx.globalAlpha = SHADOW_ALPHA * s;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, SHADOW_RX_M * ppm * s, SHADOW_RY_M * ppm * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    // Prénoms plus gros qu'en course (TITLE_NAME_SCALE) : au titre, Galahad doit pouvoir les lire.
    for (const car of scene.cars) drawCar(ctx, car, ppm, scene.t, toScreen, this.cfg, art, TITLE_NAME_SCALE);
  }

  /**
   * Petite voiture du podium (tâche 11) : `pilot` au repos, de profil, dans `target` (peinte une fois, à l'entrée au podium),
   * par le même `drawCar` que la course (sprite et roue s'ils sont chargés, sinon par code), sans prénom (le DOM l'écrit).
   * Tampon à la largeur CSS × devicePixelRatio (plafonné à 2), hauteur moitié. Sans contexte 2D : rien.
   */
  paintCarIcon(target: HTMLCanvasElement, pilot: Pilot): void {
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.round((target.clientWidth || ICON_DEFAULT_CSS_PX) * dpr));
    const h = Math.round(w / 2);
    target.width = w;
    target.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    const ppm = w / ICON_W_M;
    // Même pose au repos que le titre (`restingCarView`), sans prénom : le DOM l'écrit.
    const car = restingCarView(pilot, 0, 0, 0, '', this.cfg);
    const toScreen = (p: { x: number; y: number }) => ({ x: w / 2 + p.x * ppm, y: h / 2 - (p.y - ICON_CENTER_Y_M) * ppm });
    drawCar(ctx, car, ppm, 0, toScreen, this.cfg, this.loaded ?? NO_ART);
  }

  /** Début de toute image : transformation identité, opacité 1, effacement, puis le ciel (parallaxe sur `cameraX`). */
  private clearAndSky(cameraX: number, ppm: number): void {
    const { ctx, view } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Défense : une opacité laissée par un dessin précédent assombrirait ciel, sol et voitures (tour 1 de la 8b).
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, view.w, view.h);

    if (this.sky) {
      // Décalage dans ]−w, 0] : deux copies côte à côte couvrent toujours l'écran.
      const m = (-SKY_PARALLAX * cameraX * ppm) % view.w;
      const ox = m > 0 ? m - view.w : m;
      ctx.drawImage(this.sky, ox, 0);
      ctx.drawImage(this.sky, ox + view.w, 0);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }
}
