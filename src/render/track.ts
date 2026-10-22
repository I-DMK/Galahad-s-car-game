// Dessin de la piste : sol lunaire, cratères décoratifs, plots, volcans (tremplins et fosses) et lave, départ, arrivée, mur.
// Monde en mètres (y vers le haut) → écran via camera.worldToScreen (y vers le bas).
// Seule la portion visible est parcourue : x ∈ [camera.x − demi-largeur − 5, camera.x + demi-largeur + 5].
import { heightAt } from '../track/query';
import { mulberry32 } from '../track/rng';
import type { Fosse, Track } from '../track/types';
import type { BackingSize, Camera } from './camera';

const MARGIN_M = 5;
const CRATER_BLOCK_M = 37;
const POST_EVERY_M = 10;
/** Surface de la lave sous le niveau du rebord (m) : le cratère paraît plein, comme le capteur. */
const LAVA_BELOW_RIM_M = 0.15;
/** Hauteur (m) sous la surface où flottent les bulles. */
const BUBBLE_DEPTH_M = 0.3;
/** Fosse (tâche 5g, saut §6.7) : surface de lave à 0,1 m sous le sol (fosse pleine, « à ras bord »). */
const FOSSE_LAVA_BELOW_M = 0.1;
/** Langues de feu d'une fosse : jusqu'à la hauteur du haut du capteur (LAVA_SENSOR_ABOVE_RIM au-dessus du sol). */
const FOSSE_FLAMES_PER_M = 1.5;
/** Halo d'une fosse : lueur orange jusqu'à ≈ 3 m au-dessus du sol, pulsée au temps de simulation. */
const FOSSE_HALO_M = 3;
/** Panneau d'une fosse, planté à xLancement : poteau de 1,6 m, triangle jaune de 1,1 m de côté portant le ressort. */
const SIGN_POLE_M = 1.6;
const SIGN_SIDE_M = 1.1;

type Ctx = CanvasRenderingContext2D;
interface Pt { x: number; y: number }

export function drawTrack(ctx: Ctx, track: Track, camera: Camera, view: BackingSize, t: number): void {
  const ppm = camera.pxPerMeter(view.h);
  const half = camera.visibleHalfWidthM(view.w, view.h);
  const xMin = camera.x - half - MARGIN_M;
  const xMax = camera.x + half + MARGIN_M;
  const S = (x: number, y: number): Pt => camera.worldToScreen({ x, y }, view.w, view.h);

  const surface = visibleSurface(track, xMin, xMax);
  if (surface.length < 2) return;

  // Sol : un polygone rempli jusqu'au bas de l'écran.
  fillDown(ctx, surface.map((p) => S(p.x, p.y)), view.h, '#8b8b8b');
  drawCraters(ctx, track, xMin, xMax, ppm, S);

  // Tremplins : cône plus sombre, puis lave animée au fond du cratère. Fosses (tâche 5g) : halo, lave à ras bord,
  // langues de feu ; leur panneau est dessiné après le liseré.
  for (const v of track.volcanoes) {
    if (v.kind === 'fosse') {
      if (v.xReception + FOSSE_HALO_M < xMin || v.xBord - FOSSE_HALO_M > xMax) continue;
      drawFosse(ctx, v, heightAt(track, v.xLava), t, ppm, S);
      continue;
    }
    if (v.xReception < xMin || v.xLip > xMax) continue;
    const cone = surface.filter((p) => p.x >= v.xLip && p.x <= v.xReception);
    if (cone.length >= 2) fillDown(ctx, cone.map((p) => S(p.x, p.y)), view.h, '#5a4a4a');
    drawLava(ctx, v.xLava - v.lavaWidth / 2, v.xLava + v.lavaWidth / 2, heightAt(track, v.xLava), v.rimY - LAVA_BELOW_RIM_M, t, ppm, S);
  }

  // Liseré clair sur la surface.
  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 3 * view.scale;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  surface.forEach((p, i) => {
    const s = S(p.x, p.y);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  ctx.stroke();

  // Plots lumineux tous les 10 m (hors fosses de lave).
  for (let k = Math.ceil(xMin / POST_EVERY_M); k * POST_EVERY_M <= Math.min(xMax, track.xWall); k++) {
    const x = k * POST_EVERY_M;
    if (track.volcanoes.some((v) => Math.abs(x - v.xLava) <= v.lavaWidth / 2 + 0.3)) continue;
    const base = S(x, heightAt(track, x));
    ctx.fillStyle = '#e8ffff';
    ctx.fillRect(base.x - 0.04 * ppm, base.y - 0.3 * ppm, 0.08 * ppm, 0.3 * ppm);
    ctx.fillStyle = 'rgba(0, 230, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(base.x, base.y - 0.3 * ppm, 0.07 * ppm, 0, Math.PI * 2);
    ctx.fill();
  }

  // Panneau « saute » au début de l'approche de chaque fosse (pas devant un tremplin : il suffit d'y garder le doigt).
  for (const v of track.volcanoes) {
    if (v.kind === 'fosse' && inRange(v.xLancement, xMin, xMax)) drawFosseSign(ctx, S(v.xLancement, heightAt(track, v.xLancement)), ppm);
  }

  if (inRange(track.xStart, xMin, xMax)) drawStartLine(ctx, S(track.xStart, heightAt(track, track.xStart)), ppm);
  if (inRange(track.xFinish, xMin, xMax)) drawFinishFlag(ctx, S(track.xFinish, heightAt(track, track.xFinish)), ppm);
  if (track.xWall + 1 >= xMin && track.xWall <= xMax) {
    const top = S(track.xWall, 10);
    const h = Math.max(0, view.h - top.y);
    ctx.fillStyle = '#6b6b6b';
    ctx.fillRect(top.x, top.y, ppm, h);
    ctx.strokeStyle = '#4a4a4a';
    ctx.lineWidth = 2 * view.scale;
    ctx.strokeRect(top.x, top.y, ppm, h);
  }
}

/** Points de la piste dans [xMin, xMax] (indices déduits de l'espacement), prolongés à plat au-delà des extrémités. */
function visibleSurface(track: Track, xMin: number, xMax: number): Pt[] {
  const pts = track.points;
  const n = pts.length;
  if (n === 0) return [];
  const step = n > 1 ? pts[1].x - pts[0].x : 1;
  const i0 = Math.max(0, Math.floor((xMin - pts[0].x) / step));
  const i1 = Math.min(n - 1, Math.ceil((xMax - pts[0].x) / step));
  const out = i0 <= i1 ? pts.slice(i0, i1 + 1) : [];
  if (xMin < pts[0].x) out.unshift({ x: xMin, y: pts[0].y });
  const last = pts[n - 1];
  if (xMax > last.x) {
    if (out.length === 0) out.push(last);
    out.push({ x: xMax, y: last.y });
  }
  return out;
}

function fillDown(ctx: Ctx, line: Pt[], bottom: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(line[0].x, bottom);
  for (const p of line) ctx.lineTo(p.x, p.y);
  ctx.lineTo(line[line.length - 1].x, bottom);
  ctx.closePath();
  ctx.fill();
}

/** Cratères décoratifs sous la surface, positions déterministes (une graine par bloc de 37 m). */
function drawCraters(ctx: Ctx, track: Track, xMin: number, xMax: number, ppm: number, S: (x: number, y: number) => Pt): void {
  for (let b = Math.floor(xMin / CRATER_BLOCK_M); b * CRATER_BLOCK_M <= xMax; b++) {
    const rng = mulberry32(b * 7919 + 13);
    const count = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const x = b * CRATER_BLOCK_M + rng() * CRATER_BLOCK_M;
      const rx = 0.6 + rng() * 1.4;
      const ry = rx * (0.3 + rng() * 0.2);
      const depth = 0.8 + rng() * 2.5 + ry;
      if (x < 0 || x > track.xWall) continue;
      let ground = Infinity; // sol le plus bas sous l'ellipse : le creux ne dépasse jamais la surface
      for (let k = -2; k <= 2; k++) ground = Math.min(ground, heightAt(track, x + (k * rx) / 2));
      const c = S(x, ground - depth);
      ctx.fillStyle = '#767676';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx * ppm, ry * ppm, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a0a0a0'; // lèvre éclairée en bas du creux
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + ry * ppm * 0.35, rx * ppm * 0.8, ry * ppm * 0.45, 0, 0, Math.PI);
      ctx.fill();
    }
  }
}

/** Lave du fond du cratère (floorY) jusqu'à la surface topY (m), bulles près de la surface. */
function drawLava(
  ctx: Ctx, xA: number, xB: number, floorY: number, topY: number, t: number, ppm: number, S: (x: number, y: number) => Pt,
): void {
  const tl = S(xA, topY);
  const br = S(xB, floorY);
  const glow = 0.5 + 0.5 * Math.sin(t * 2);
  const g = ctx.createLinearGradient(0, tl.y, 0, br.y);
  g.addColorStop(0, `rgb(255, ${Math.round(150 + 60 * glow)}, ${Math.round(40 * glow)})`);
  g.addColorStop(1, `rgb(${Math.round(190 + 40 * glow)}, 30, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.fillStyle = '#ffb000';
  for (let i = 0; i < 4; i++) {
    const bx = xA + ((i + 0.5) / 4) * (xB - xA);
    const by = topY - BUBBLE_DEPTH_M * (0.25 - 0.35 * Math.sin(t * 3 + i));
    const p = S(bx, by);
    ctx.beginPath();
    ctx.arc(p.x, p.y, (0.08 + 0.03 * i) * ppm, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Fosse (tâche 5g, saut §6.7) : halo orange pulsé (au temps de simulation `t`) jusqu'à ≈ 3 m au-dessus de la fosse,
 * lave à ras bord (surface 0,1 m sous le sol) avec ses bulles, et langues de feu animées qui montent jusqu'au haut du
 * capteur (0,3 m au-dessus du sol) : une roue qui touche la lave touche du feu dessiné. La lave brille tout le temps :
 * rien ne s'allume quand une voiture arrive (Q-F5).
 */
function drawFosse(ctx: Ctx, f: Fosse, floorY: number, t: number, ppm: number, S: (x: number, y: number) => Pt): void {
  const xA = f.xBord;
  const xB = f.xReception;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);
  // Halo : dégradé vertical du sol vers le ciel, un peu plus large que la fosse.
  const top = S(xA - 1, f.rimY + FOSSE_HALO_M);
  const bottom = S(xB + 1, f.rimY);
  const halo = ctx.createLinearGradient(0, bottom.y, 0, top.y);
  halo.addColorStop(0, `rgba(255, 120, 20, ${(0.35 + 0.2 * pulse).toFixed(3)})`);
  halo.addColorStop(1, 'rgba(255, 120, 20, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(top.x, top.y, bottom.x - top.x, bottom.y - top.y);
  drawLava(ctx, xA, xB, floorY, f.rimY - FOSSE_LAVA_BELOW_M, t, ppm, S);
  // Langues de feu : triangles qui ondulent, du dessus de la lave jusqu'à 0,3 m au-dessus du sol au plus haut.
  const n = Math.max(3, Math.round((xB - xA) * FOSSE_FLAMES_PER_M));
  const w = (xB - xA) / n;
  const base = f.rimY - FOSSE_LAVA_BELOW_M;
  for (let i = 0; i < n; i++) {
    const x0 = xA + i * w;
    const flicker = 0.5 + 0.5 * Math.sin(t * 7 + i * 1.7);
    const tip = base + (FOSSE_LAVA_BELOW_M + 0.3) * (0.55 + 0.45 * flicker);
    ctx.fillStyle = i % 2 === 0 ? '#ff7a1a' : '#ffd23f';
    ctx.beginPath();
    const a = S(x0, base);
    const b = S(x0 + w / 2 + 0.15 * w * Math.sin(t * 5 + i), tip);
    const c = S(x0 + w, base);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Panneau d'une fosse : poteau et triangle jaune portant le ressort du bouton saut (même dessin que le bouton). */
function drawFosseSign(ctx: Ctx, base: Pt, ppm: number): void {
  const pole = SIGN_POLE_M * ppm;
  const side = SIGN_SIDE_M * ppm;
  ctx.fillStyle = '#dddddd';
  ctx.fillRect(base.x - 0.05 * ppm, base.y - pole, 0.1 * ppm, pole);
  // Triangle pointe en haut, posé sur le haut du poteau.
  const h = (side * Math.sqrt(3)) / 2;
  const cx = base.x;
  const by = base.y - pole;
  ctx.fillStyle = '#ffd400';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1, 0.06 * ppm);
  ctx.beginPath();
  ctx.moveTo(cx, by - h);
  ctx.lineTo(cx + side / 2, by);
  ctx.lineTo(cx - side / 2, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ressort sous une flèche (icône du bouton saut, viewBox 64 → 0,45 m), centré dans le bas du triangle.
  const k = (0.45 * ppm) / 64;
  const ox = cx - 32 * k;
  const oy = by - h * 0.62 - 32 * k;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy + y * k];
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = Math.max(1, 5 * k);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(...P(32, 6)); ctx.lineTo(...P(20, 18));
  ctx.moveTo(...P(32, 6)); ctx.lineTo(...P(44, 18));
  ctx.moveTo(...P(32, 6)); ctx.lineTo(...P(32, 26));
  ctx.moveTo(...P(16, 34));
  for (const [x, y] of [[48, 34], [16, 42], [48, 42], [16, 50], [48, 50], [16, 58], [48, 58]] as const) ctx.lineTo(...P(x, y));
  ctx.stroke();
}

function drawStartLine(ctx: Ctx, base: Pt, ppm: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(base.x - 0.05 * ppm, base.y - 2 * ppm, 0.1 * ppm, 2 * ppm);
  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.moveTo(base.x + 0.05 * ppm, base.y - 2 * ppm);
  ctx.lineTo(base.x + 0.75 * ppm, base.y - 1.75 * ppm);
  ctx.lineTo(base.x + 0.05 * ppm, base.y - 1.5 * ppm);
  ctx.closePath();
  ctx.fill();
}

/** Drapeau à damier : 2 × 6 cases noires/blanches en haut d'un mât de 2,5 m. */
function drawFinishFlag(ctx: Ctx, base: Pt, ppm: number): void {
  const poleH = 2.5 * ppm;
  ctx.fillStyle = '#dddddd';
  ctx.fillRect(base.x - 0.05 * ppm, base.y - poleH, 0.1 * ppm, poleH);
  const cell = 0.2 * ppm;
  const left = base.x + 0.05 * ppm;
  const top = base.y - poleH;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#000000' : '#ffffff';
      ctx.fillRect(left + c * cell, top + r * cell, cell, cell);
    }
  }
}

function inRange(x: number, a: number, b: number): boolean {
  return x >= a && x <= b;
}

/**
 * Étoile à ramasser, en pixels écran (x, y) : 5 branches jaunes de 0,5 m, tournant lentement (t × 0,8 rad),
 * halo radial doux de 0,9 m.
 */
export function drawStar(ctx: Ctx, x: number, y: number, t: number, ppm: number): void {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, 0.9 * ppm);
  halo.addColorStop(0, 'rgba(255, 224, 102, 0.35)');
  halo.addColorStop(1, 'rgba(255, 224, 102, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 0.9 * ppm, 0, Math.PI * 2);
  ctx.fill();
  const rOut = 0.5 * ppm;
  const rIn = rOut * 0.45;
  const rot = t * 0.8;
  ctx.fillStyle = '#ffd400';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rOut : rIn;
    if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}
