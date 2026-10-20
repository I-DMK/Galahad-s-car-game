// Dessin de la piste : sol lunaire, cratères décoratifs, plots, volcans et lave, départ, arrivée, mur.
// Monde en mètres (y vers le haut) → écran via camera.worldToScreen (y vers le bas).
// Seule la portion visible est parcourue : x ∈ [camera.x − demi-largeur − 5, camera.x + demi-largeur + 5].
import { heightAt } from '../track/query';
import { mulberry32 } from '../track/rng';
import type { Track } from '../track/types';
import type { BackingSize, Camera } from './camera';

const MARGIN_M = 5;
const CRATER_BLOCK_M = 37;
const POST_EVERY_M = 10;
/** Surface de la lave sous le niveau du rebord (m) : le cratère paraît plein, comme le capteur. */
const LAVA_BELOW_RIM_M = 0.15;
/** Hauteur (m) sous la surface où flottent les bulles. */
const BUBBLE_DEPTH_M = 0.3;

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

  // Cônes de volcan, plus sombres, puis lave animée au fond du cratère.
  for (const v of track.volcanoes) {
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
