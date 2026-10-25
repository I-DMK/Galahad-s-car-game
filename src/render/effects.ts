// Particules visuelles (étincelles, poussière, bulles de lave, fumée, éclats de rocher, confettis du podium) en coordonnées du monde
// (m, y vers le haut).
// Logique pure : aucun accès au DOM hors de `draw(ctx, …)`. `Math.random` suffit (purement visuel, hors simulation).
import type { Config } from '../config';
import type { Track } from '../track/types';

export const MAX_PARTICLES = 300;

type Kind = 'spark' | 'dust' | 'bubble' | 'smoke' | 'confetti' | 'shard';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  kind: Kind;
  /** Rayon (m) au départ ; grandit pour la poussière et la fumée. */
  size: number;
  /** Confettis : couleur CSS et phase (rad) du battement du papier. */
  color?: string;
  phase?: number;
  /** Éclats de rocher (tâche 11c) : angle (rad) et vitesse de rotation (rad/s). */
  angle?: number;
  spin?: number;
}

const SPARK_GRAVITY = -9;
/** Éclats de rocher (tâche 11c, spec « rochers » §5) : nombre, vie (s), gravité (m/s²), grains de poussière. */
export const ROCK_SHARDS = 14;
export const ROCK_DUST = 10;
const SHARD_LIFE = 0.8;
const SHARD_GRAVITY = -7;
const SHARD_COLORS = ['#5e5853', '#7a736d', '#948c85'] as const;
const BUBBLE_PERIOD = 0.3;
const SMOKE_PERIOD = 0.5;
/** Marge (m) au-delà de l'écran où les volcans émettent encore. */
const VISIBLE_MARGIN = 5;
/** Le dessus de la lave est 0,15 m sous le rebord du cratère. */
const LAVA_SURFACE_DROP = 0.15;

/** Confettis du podium si Galahad gagne (tâche 11 ; spec §8 « Rendu ») : pluie de CONFETTI_SECONDS au-dessus de l'écran. */
export const CONFETTI_SECONDS = 4;
export const CONFETTI_PER_SECOND = 40;
/** m/s : chute la plus lente d'un confetti (vy dans [−2,6 ; −1,6]). */
const CONFETTI_MIN_FALL = 1.6;
/** m : marge sous le bas de l'écran (taille d'un confetti comprise) avant qu'il ne disparaisse. */
const CONFETTI_EXIT_MARGIN_M = 0.5;
const CONFETTI_COLORS = ['#ffd23f', '#ff4d6d', '#4dd2ff', '#7cff4d', '#ffffff', '#c77dff'] as const;
/** rad/s : battement du papier (largeur dessinée × |cos|). */
const CONFETTI_FLUTTER = 8;
/**
 * s : reste de pluie tenu pour nul. 240 retraits de 1/60 laissent ≈ 1e-15 s au lieu de 0 : sans cette tolérance, l'image
 * suivante émettrait un 161e confetti (comme COUNTDOWN_EPS dans `game.ts` et HOLD_EPSILON_S dans `ranking.ts`). Même
 * tolérance sur la fraction reportée : 240 × 40/60 font 159,99999… et le 160e ne partirait jamais (tour 1).
 */
const CONFETTI_EPS = 1e-9;

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class Effects {
  private particles: Particle[] = [];
  private bubbleTimer = 0;
  private smokeTimer = 0;
  /** s de pluie de confettis restantes, et fraction de confetti reportée d'une image à la suivante. */
  private confettiLeft = 0;
  private confettiCarry = 0;

  constructor(private readonly cfg: Config) {}

  get count(): number { return this.particles.length; }

  /** Confettis en vol (podium, tâche 11). */
  get confettiCount(): number {
    let n = 0;
    for (const p of this.particles) if (p.kind === 'confetti') n++;
    return n;
  }

  /**
   * Plus aucune particule (nouvelle course, tâche 10 : pas d'étincelles d'une course sur le titre) ; minuteries à zéro ;
   * pluie de confettis arrêtée (tâche 11) : une nouvelle course n'hérite jamais d'une pluie.
   */
  clear(): void {
    this.particles = [];
    this.bubbleTimer = 0;
    this.smokeTimer = 0;
    this.confettiLeft = 0;
    this.confettiCarry = 0;
  }

  /** Lance la pluie de confettis pour CONFETTI_SECONDS (émise par `rainConfetti`). */
  startConfetti(): void {
    this.confettiLeft = CONFETTI_SECONDS;
    this.confettiCarry = 0;
  }

  /**
   * Pendant la pluie : CONFETTI_PER_SECOND × dt confettis (le reste est reporté à l'image suivante), nés entre `topY` et
   * `topY + 1` (au-dessus du haut de l'écran), x dans [cx − halfWidthM, cx + halfWidthM], qui tombent à 1,6–2,6 m/s en dérivant.
   */
  rainConfetti(dt: number, cx: number, topY: number, halfWidthM: number): void {
    if (this.confettiLeft <= CONFETTI_EPS || dt <= 0) return;
    const d = Math.min(dt, this.confettiLeft);
    this.confettiLeft -= d;
    this.confettiCarry += d * CONFETTI_PER_SECOND;
    // Durée de vie : de quoi traverser toute la vue (né jusqu'à 1 m au-dessus du haut, VISIBLE_HEIGHT_M de haut) à la
    // chute la plus lente, plus une marge : aucun confetti ne disparaît encore à l'écran (cr 4, tour 1).
    const life = (this.cfg.VISIBLE_HEIGHT_M + 1 + CONFETTI_EXIT_MARGIN_M) / CONFETTI_MIN_FALL;
    while (this.confettiCarry >= 1 - CONFETTI_EPS) {
      this.confettiCarry -= 1;
      this.add({
        x: cx + rand(-halfWidthM, halfWidthM), y: topY + rand(0, 1), vx: rand(-0.6, 0.6), vy: rand(-2.6, -CONFETTI_MIN_FALL),
        life, maxLife: life, kind: 'confetti', size: rand(0.1, 0.16),
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], phase: rand(0, Math.PI * 2),
      });
    }
  }

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

  /**
   * Rocher qui éclate (tâche 11c, spec « rochers » §5) en (x, y) : ROCK_SHARDS éclats gris (triangles qui tournent, gravité,
   * vie SHARD_LIFE) lancés vers le haut et vers l'avant, et ROCK_DUST grains de poussière (comme `spawnDust`), dans le
   * plafond MAX_PARTICLES.
   */
  rockBurst(x: number, y: number): void {
    for (let i = 0; i < ROCK_SHARDS; i++) {
      const speed = rand(2, 5.5);
      const a = rand(0.2, Math.PI - 0.2);
      this.add({
        x: x + rand(-0.6, 0.6), y: y + rand(-0.4, 0.4), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: SHARD_LIFE, maxLife: SHARD_LIFE, kind: 'shard', size: rand(0.1, 0.22),
        color: SHARD_COLORS[i % SHARD_COLORS.length], angle: rand(0, Math.PI * 2), spin: rand(-9, 9),
      });
    }
    for (let i = 0; i < ROCK_DUST; i++) {
      const life = rand(0.5, 1);
      this.add({ x: x + rand(-1, 1), y: y + rand(-0.6, 0), vx: rand(-1.2, 1.2), vy: rand(0.3, 1), life, maxLife: life, kind: 'dust', size: 0.12 });
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

  /**
   * Podium (tâche 11, tour 1) : ne fait bouger et vieillir que les confettis. Étincelles, poussière, bulles et fumée restent
   * figées comme la course derrière, et les minuteries des volcans ne tournent pas (aucune bulle ni fumée ne naît).
   */
  updateConfetti(dt: number): void {
    for (const p of this.particles) {
      if (p.kind !== 'confetti') continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.kind !== 'confetti' || p.life > 0);
  }

  update(dt: number, track: Pick<Track, 'volcanoes'>, cameraX: number, halfWidthM: number): void {
    for (const p of this.particles) {
      if (p.kind === 'spark') p.vy += SPARK_GRAVITY * dt;
      if (p.kind === 'shard') {
        p.vy += SHARD_GRAVITY * dt;
        p.angle = (p.angle ?? 0) + (p.spin ?? 0) * dt;
      }
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

  /**
   * Confettis (tâche 11) : passe séparée, dessinée par `Renderer.draw` après les voitures (au-dessus de la scène, spec §8).
   * Papier qui se retourne : largeur × |cos| (au moins 1 px), opacité qui baisse le dernier tiers de sa vie.
   */
  drawConfetti(ctx: CanvasRenderingContext2D, toScreen: (p: { x: number; y: number }) => { x: number; y: number }, ppm: number): void {
    ctx.save();
    for (const p of this.particles) {
      if (p.kind !== 'confetti') continue;
      const s = toScreen(p);
      const r = p.size * ppm;
      const w = Math.max(1, 2 * r * Math.abs(Math.cos((p.phase ?? 0) + p.life * CONFETTI_FLUTTER)));
      ctx.globalAlpha = Math.min(1, (3 * p.life) / p.maxLife);
      ctx.fillStyle = p.color ?? '#ffffff';
      ctx.fillRect(s.x - w / 2, s.y - r / 2, w, r);
    }
    ctx.restore();
  }

  /** Étincelles, poussière, bulles, fumée et éclats (sous les voitures) ; les confettis sont dessinés à part (`drawConfetti`). */
  draw(ctx: CanvasRenderingContext2D, toScreen: (p: { x: number; y: number }) => { x: number; y: number }, ppm: number): void {
    ctx.save();
    for (const p of this.particles) {
      if (p.kind === 'confetti') continue;
      const k = p.life / p.maxLife; // 1 → 0
      const s = toScreen(p);
      let r = p.size * ppm;
      if (p.kind === 'shard') {
        // Triangle irrégulier qui tourne (angle écran = −angle monde).
        const a = -(p.angle ?? 0);
        ctx.globalAlpha = Math.min(1, 2 * k);
        ctx.fillStyle = p.color ?? '#7a736d';
        ctx.beginPath();
        ctx.moveTo(s.x + r * Math.cos(a), s.y + r * Math.sin(a));
        ctx.lineTo(s.x + 0.8 * r * Math.cos(a + 2.3), s.y + 0.8 * r * Math.sin(a + 2.3));
        ctx.lineTo(s.x + 0.6 * r * Math.cos(a + 4.1), s.y + 0.6 * r * Math.sin(a + 4.1));
        ctx.closePath();
        ctx.fill();
        continue;
      }
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
