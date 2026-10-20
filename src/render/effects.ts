// Particules visuelles (étincelles, poussière, bulles de lave, fumée) en coordonnées du monde (m, y vers le haut).
// Logique pure : aucun accès au DOM hors de `draw(ctx, …)`. `Math.random` suffit (purement visuel, hors simulation).
import type { Config } from '../config';
import type { Track } from '../track/types';

export const MAX_PARTICLES = 300;

type Kind = 'spark' | 'dust' | 'bubble' | 'smoke';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  kind: Kind;
  /** Rayon (m) au départ ; grandit pour la poussière et la fumée. */
  size: number;
}

const SPARK_GRAVITY = -9;
const BUBBLE_PERIOD = 0.3;
const SMOKE_PERIOD = 0.5;
/** Marge (m) au-delà de l'écran où les volcans émettent encore. */
const VISIBLE_MARGIN = 5;
/** Le dessus de la lave est 0,15 m sous le rebord du cratère. */
const LAVA_SURFACE_DROP = 0.15;

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class Effects {
  private particles: Particle[] = [];
  private bubbleTimer = 0;
  private smokeTimer = 0;

  constructor(private readonly cfg: Config) {}

  get count(): number { return this.particles.length; }

  private add(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift(); // plein : on perd la plus ancienne
    this.particles.push(p);
  }

  /** 20 à 40 étincelles orange/jaune lancées vers le haut. */
  spawnSparks(x: number, y: number): void {
    const n = 20 + Math.floor(Math.random() * 21);
    for (let i = 0; i < n; i++) {
      const speed = rand(2, 6);
      const a = rand(0.15, Math.PI - 0.15); // demi-cercle supérieur
      const life = rand(0.4, 0.8);
      this.add({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, maxLife: life, kind: 'spark', size: 0.05 });
    }
  }

  /** `min(12, round(strength × 2))` petits nuages gris qui montent lentement. */
  spawnDust(x: number, y: number, strength: number): void {
    const n = Math.min(12, Math.round(strength * 2));
    for (let i = 0; i < n; i++) {
      const life = rand(0.5, 1);
      this.add({
        x: x + rand(-0.4, 0.4), y, vx: rand(-1, 1), vy: rand(0.3, 1), life, maxLife: life, kind: 'dust', size: 0.12,
      });
    }
  }

  update(dt: number, track: Pick<Track, 'volcanoes'>, cameraX: number, halfWidthM: number): void {
    for (const p of this.particles) {
      if (p.kind === 'spark') p.vy += SPARK_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    const range = halfWidthM + VISIBLE_MARGIN;
    const visible = track.volcanoes.filter((v) => Math.abs(v.xLava - cameraX) <= range);
    this.bubbleTimer += dt;
    while (this.bubbleTimer >= BUBBLE_PERIOD) {
      this.bubbleTimer -= BUBBLE_PERIOD;
      for (const v of visible) {
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          this.add({
            x: v.xLava + rand(-v.lavaWidth / 2, v.lavaWidth / 2), y: v.rimY - LAVA_SURFACE_DROP,
            vx: 0, vy: 0.3, life: 0.6, maxLife: 0.6, kind: 'bubble', size: rand(0.08, 0.16),
          });
        }
      }
    }
    this.smokeTimer += dt;
    while (this.smokeTimer >= SMOKE_PERIOD) {
      this.smokeTimer -= SMOKE_PERIOD;
      for (const v of visible) {
        this.add({
          x: v.xLava + rand(-v.lavaWidth / 2, v.lavaWidth / 2), y: v.rimY - LAVA_SURFACE_DROP,
          vx: rand(-0.1, 0.1), vy: 0.8, life: 2, maxLife: 2, kind: 'smoke', size: 0.25,
        });
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, toScreen: (p: { x: number; y: number }) => { x: number; y: number }, ppm: number): void {
    ctx.save();
    for (const p of this.particles) {
      const k = p.life / p.maxLife; // 1 → 0
      const s = toScreen(p);
      let r = p.size * ppm;
      switch (p.kind) {
        case 'spark':
          ctx.globalAlpha = k;
          ctx.strokeStyle = k > 0.5 ? '#ffd23f' : '#ff7a1a';
          ctx.lineWidth = Math.max(1, r);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - p.vx * 0.03 * ppm, s.y + p.vy * 0.03 * ppm);
          ctx.stroke();
          ctx.fillStyle = ctx.strokeStyle;
          break;
        case 'dust':
          r *= 1 + (1 - k) * 2;
          ctx.globalAlpha = k * 0.6;
          ctx.fillStyle = '#b8b2a8';
          break;
        case 'bubble':
          ctx.globalAlpha = k;
          ctx.fillStyle = '#ff9a2e';
          break;
        case 'smoke':
          r *= 1 + (1 - k) * 3;
          ctx.globalAlpha = k * 0.35;
          ctx.fillStyle = '#8a8a92';
          break;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
