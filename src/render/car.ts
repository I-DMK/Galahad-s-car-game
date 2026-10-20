// Dessin d'une voiture : carrosserie, bandes, vitre, aileron, pilote casqué, roues à rayons, flammes de turbo.
// Repère local de la carrosserie : mètres × ppm, x vers l'avant, y vers le BAS (écran), origine au centre.
// L'angle du monde (positif = nez en haut = anti-horaire à l'écran) se traduit par ctx.rotate(−angle).
import { CONFIG, type Config } from '../config';
import type { CarView } from './renderer';

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };
export type CarDims = Pick<Config, 'CAR_LENGTH' | 'CAR_HEIGHT' | 'WHEEL_RADIUS'>;

/**
 * Dessine `car` (coordonnées du monde) ; `toScreen` convertit un point du monde en pixels écran,
 * `ppm` = pixels par mètre, `t` = temps (s) pour l'animation des flammes.
 */
export function drawCar(
  ctx: Ctx, car: CarView, ppm: number, t: number, toScreen: (p: Pt) => Pt, dims: CarDims = CONFIG,
): void {
  const L = dims.CAR_LENGTH;
  const H = dims.CAR_HEIGHT;
  const c = toScreen(car);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(-car.angle);
  ctx.scale(ppm, ppm); // à partir d'ici, unités = mètres (y vers le bas)
  if (car.turbo) drawFlames(ctx, -L / 2, 0.08, t);

  // Pilote d'abord : le bas du casque est caché par la carrosserie (cockpit).
  const hx = -L / 6;
  const hy = -H / 2 - 0.08;
  circle(ctx, hx, hy, 0.14, car.accent);
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
  ctx.restore();

  for (const w of car.wheels) drawWheel(ctx, toScreen(w), w.angle, dims.WHEEL_RADIUS * ppm);

  if (car.name !== 'Galahad') {
    const top = toScreen({ x: car.x, y: car.y + 1.3 });
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round((14 * ppm) / 57)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(car.name, top.x, top.y);
  }
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
