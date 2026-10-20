// Ciel lunaire pré-rendu dans un canvas hors écran : dégradé noir → bleu nuit, ~200 étoiles, la Terre.
// Graine fixe : le ciel est identique d'une partie à l'autre.
import { mulberry32 } from '../track/rng';

const SKY_STAR_COUNT = 200;

export function prerenderSky(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#000000');
  grad.addColorStop(1, '#0a1030');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rng = mulberry32(42);
  const unit = h / 800; // tailles pensées pour 800 px de haut
  for (let i = 0; i < SKY_STAR_COUNT; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = (0.5 + rng() * 1.5) * unit;
    const a = 0.3 + rng() * 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEarth(ctx, w * 0.8, h * 0.18, h / 12, rng);
  return canvas;
}

/** La Terre : disque bleu, quelques continents verts, nuages blancs, halo doux. */
function drawEarth(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rng: () => number): void {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.6);
  glow.addColorStop(0, 'rgba(110, 170, 255, 0.45)');
  glow.addColorStop(1, 'rgba(110, 170, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const ocean = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  ocean.addColorStop(0, '#4f9dff');
  ocean.addColorStop(1, '#1747b8');
  ctx.fillStyle = ocean;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  const blobs: [string, number][] = [['#3fae4a', 4], ['#ffffff', 4]];
  for (const [color, n] of blobs) {
    ctx.fillStyle = color;
    ctx.globalAlpha = color === '#ffffff' ? 0.75 : 1;
    for (let i = 0; i < n; i++) {
      const bx = cx + (rng() * 2 - 1) * r * 0.7;
      const by = cy + (rng() * 2 - 1) * r * 0.7;
      ctx.beginPath();
      ctx.ellipse(bx, by, r * (0.15 + rng() * 0.25), r * (0.08 + rng() * 0.15), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Ombre côté nuit pour le relief.
  const shade = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  shade.addColorStop(0.55, 'rgba(0, 0, 20, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 20, 0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  ctx.restore();
}
