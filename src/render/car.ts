// Dessin d'une voiture : carrosserie (image du pilote, ou dessin par code : bandes, vitre, aileron, pilote casqué), roues
// (image tournée, ou dessin par code à rayons), flammes de turbo (4 images en boucle, ou dessin par code) et ombre au sol.
// Chaque pièce prend son image si elle est chargée, sinon son dessin par code : repli pièce par pièce (tâche 8b,
// addendum « présentation » §1.1). Les poses viennent de `CarView` (déjà interpolées) : le rendu ne lit rien de la course.
// Repère local de la carrosserie : mètres × ppm, x vers l'avant, y vers le BAS (écran), origine au centre.
// L'angle du monde (positif = nez en haut = anti-horaire à l'écran) se traduit par ctx.rotate(−angle).
import { CONFIG, type Config } from '../config';
import { heightAt, overLava, slopeAt } from '../track/query';
import type { Track } from '../track/types';
import { canvasFont } from '../ui/font';
import { FLAME_FILES, NO_ART, type Art } from './assets';
import type { CarView } from './renderer';

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
export type CarDims = Pick<Config, 'CAR_LENGTH' | 'CAR_HEIGHT' | 'WHEEL_RADIUS'>;

// Constantes de dessin (pas des paramètres de jeu : pas dans CONFIG, comme FOSSE_HALO_M dans track.ts).
/** Cadre de la carrosserie image (m) : 2,80 × 1,40 m centré sur le châssis, 183 px/m (assets/README.md, gabarit). */
const BODY_W_M = 2.8;
const BODY_H_M = 1.4;
/** Flammes du turbo : images par seconde (addendum §1.5). */
const FLAME_FPS = 14;
/** Accroche des flammes sur la carrosserie image : calque `reperes` du gabarit, y vers le bas (m). */
const FLAME_IMG_ANCHOR_X = -1.31;
const FLAME_IMG_ANCHOR_Y = -0.08;
/** Accroche sur la carrosserie par code : à l'arrière (x = −L/2), 8 cm sous le centre (comme avant la 8b). */
const FLAME_CODE_ANCHOR_Y = 0.08;
/** Image de flamme : carré de 1,2 m, dont le bord droit dépasse l'accroche de 0,34 m (bbox mesurées des 4 images). */
const FLAME_SIZE_M = 1.2;
const FLAME_RIGHT_M = 0.34;
/** Ombre au sol : demi-axes (m) et opacité au sol, hauteur de vol (m) qui la réduit de moitié (à juger sur capture). */
const SHADOW_RX_M = 1.2;
const SHADOW_RY_M = 0.15;
const SHADOW_ALPHA = 0.45;
const SHADOW_HALF_M = 1.5;

/**
 * Dessine `car` (coordonnées du monde) ; `toScreen` convertit un point du monde en pixels écran,
 * `ppm` = pixels par mètre, `t` = temps (s) pour l'animation des flammes. `art` : images chargées (`NO_ART` : tout par code).
 * Ordre : flammes, carrosserie, puis roues par-dessus, puis prénom.
 */
export function drawCar(
  ctx: Ctx, car: CarView, ppm: number, t: number, toScreen: (p: Pt) => Pt, dims: CarDims = CONFIG, art: Art = NO_ART,
): void {
  const L = dims.CAR_LENGTH;
  const H = dims.CAR_HEIGHT;
  const c = toScreen(car);
  const bodyImg = art.bodies.get(car.id);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(-car.angle);
  ctx.scale(ppm, ppm); // à partir d'ici, unités = mètres (y vers le bas)
  if (car.turbo) {
    // L'accroche suit la carrosserie dessinée : celle du gabarit pour l'image, l'arrière de la caisse sinon.
    const ax = bodyImg ? FLAME_IMG_ANCHOR_X : -L / 2;
    const ay = bodyImg ? FLAME_IMG_ANCHOR_Y : FLAME_CODE_ANCHOR_Y;
    // Garde au point d'appel : une image absente (tableau incomplet) ne va jamais à drawImage, qui lèverait sur un vrai canvas.
    const flame = art.flames?.[flameFrame(t)];
    if (flame) ctx.drawImage(flame, ax + FLAME_RIGHT_M - FLAME_SIZE_M, ay - FLAME_SIZE_M / 2, FLAME_SIZE_M, FLAME_SIZE_M);
    else drawFlames(ctx, ax, ay, t);
  }
  // Le casque, l'aileron, la vitre et les bandes font partie de l'image : seul le repli par code les dessine.
  if (bodyImg) ctx.drawImage(bodyImg, -BODY_W_M / 2, -BODY_H_M / 2, BODY_W_M, BODY_H_M);
  else drawBodyByCode(ctx, car, L, H);
  ctx.restore();

  const r = dims.WHEEL_RADIUS * ppm;
  for (const w of car.wheels) {
    if (art.wheel) drawWheelImage(ctx, art.wheel, toScreen(w), w.angle, r);
    else drawWheel(ctx, toScreen(w), w.angle, r);
  }

  if (car.name !== 'Galahad') {
    const top = toScreen({ x: car.x, y: car.y + 1.3 });
    ctx.fillStyle = '#ffffff';
    ctx.font = canvasFont(700, (14 * ppm) / 57);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(car.name, top.x, top.y);
  }
}

/** Index de l'image de flamme au temps `t` : 14 images/s en boucle de 4, toujours dans [0, 3] (même pour t < 0). */
export function flameFrame(t: number): number {
  const n = FLAME_FILES.length;
  return ((Math.floor(t * FLAME_FPS) % n) + n) % n;
}

/** Carrosserie par code (repli), repère local en mètres : pilote casqué, aileron, caisse, vitre, deux bandes. */
function drawBodyByCode(ctx: Ctx, car: CarView, L: number, H: number): void {
  // Pilote d'abord : le bas du casque est caché par la carrosserie (cockpit).
  const hx = -L / 6;
  const hy = -H / 2 - 0.08;
  circle(ctx, hx, hy, 0.14, car.helmet);
  ctx.fillStyle = '#16182a'; // visière vers l'avant
  ctx.beginPath();
  ctx.ellipse(hx + 0.06, hy - 0.01, 0.07, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // Aileron arrière.
  ctx.fillStyle = '#20232b';
  ctx.fillRect(-L / 2 + 0.1, -H / 2 - 0.2, 0.06, 0.22);
  ctx.fillStyle = car.accent;
  ctx.fillRect(-L / 2 - 0.05, -H / 2 - 0.26, 0.42, 0.08);

  // Carrosserie.
  ctx.fillStyle = car.color;
  roundRect(ctx, -L / 2, -H / 2, L, H, 0.15);
  ctx.fill();

  // Vitre inclinée sur le tiers avant supérieur.
  ctx.fillStyle = 'rgba(214, 236, 255, 0.9)';
  ctx.beginPath();
  ctx.moveTo(L / 6 - 0.1, -H / 2 + 0.06);
  ctx.lineTo(L / 6 + 0.2, -H / 2 + 0.06);
  ctx.lineTo(L / 2 - 0.12, -0.04);
  ctx.lineTo(L / 6 - 0.1, -0.04);
  ctx.closePath();
  ctx.fill();

  // Deux bandes sur toute la longueur.
  ctx.fillStyle = car.accent;
  ctx.fillRect(-L / 2 + 0.06, 0.04, L - 0.12, 0.08);
  ctx.fillRect(-L / 2 + 0.06, 0.18, L - 0.12, 0.08);
}

/** Roue image en pixels écran : carrée de 2r, tournée de −angle (comme les rayons de la roue par code). */
function drawWheelImage(ctx: Ctx, img: CanvasImageSource, c: Pt, angle: number, r: number): void {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(-angle);
  ctx.drawImage(img, -r, -r, 2 * r, 2 * r);
  ctx.restore();
}

/** Roue en pixels écran : pneu sombre, jante claire, 5 rayons tournés de −angle, moyeu. */
function drawWheel(ctx: Ctx, c: Pt, angle: number, r: number): void {
  circle(ctx, c.x, c.y, r, '#2a2a2e');
  circle(ctx, c.x, c.y, r * 0.68, '#a9adb5');
  circle(ctx, c.x, c.y, r * 0.56, '#5d616a');
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(-angle);
  ctx.strokeStyle = '#d7dae0';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56);
  }
  ctx.stroke();
  ctx.restore();
  circle(ctx, c.x, c.y, r * 0.16, '#e8e8e8');
}

/** Flammes derrière la voiture (repère local en mètres) : orange puis cœur jaune, longueur pulsée par t. */
function drawFlames(ctx: Ctx, xRear: number, yMid: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const y = yMid + (i - 1) * 0.14;
    const len = 0.55 + 0.25 * Math.sin(t * 25 + i * 2.1) + (i === 1 ? 0.2 : 0);
    flame(ctx, xRear, y, len, 0.09, '#ff7a00');
    flame(ctx, xRear, y, len * 0.55, 0.045, '#ffd400');
  }
}

function flame(ctx: Ctx, x: number, y: number, len: number, halfH: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 0.02, y - halfH);
  ctx.lineTo(x - len, y);
  ctx.lineTo(x + 0.02, y + halfH);
  ctx.closePath();
  ctx.fill();
}

/** Hauteur de vol (m) : la roue la plus basse au-dessus du sol sous elle, jamais négative ; 0 sans roue. */
export function flightHeight(car: CarView, track: Track, wheelRadius: number): number {
  let low = Infinity;
  for (const w of car.wheels) low = Math.min(low, w.y - wheelRadius - heightAt(track, w.x));
  return low === Infinity ? 0 : Math.max(0, low);
}

/** Échelle de l'ombre à la hauteur de vol `h` : 1 au sol, 0,5 à SHADOW_HALF_M, décroissante. */
export function shadowScale(h: number): number {
  return 1 / (1 + h / SHADOW_HALF_M);
}

/**
 * Ombre sous la voiture : ellipse noire posée sur le sol sous le châssis (`heightAt`), inclinée de la pente, qui rétrécit
 * et s'éclaircit avec la hauteur de vol. Aucune au-dessus de la lave. Dessinée par code, à dessiner avant les voitures.
 */
export function drawShadow(
  ctx: Ctx, car: CarView, track: Track, ppm: number, toScreen: (p: Pt) => Pt, dims: CarDims = CONFIG,
): void {
  if (overLava(track, car.x)) return;
  const s = shadowScale(flightHeight(car, track, dims.WHEEL_RADIUS));
  const g = toScreen({ x: car.x, y: heightAt(track, car.x) });
  ctx.save();
  ctx.globalAlpha = SHADOW_ALPHA * s;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(g.x, g.y, SHADOW_RX_M * ppm * s, SHADOW_RY_M * ppm * s, -slopeAt(track, car.x), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function circle(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
