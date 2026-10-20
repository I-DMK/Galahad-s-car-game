// Boucle de jeu : pas fixes (accumulateur) → pas de course → caméra → rendu → HUD.
import { CONFIG, type Config } from './config';
import { Throttle } from './input/throttle';
import { advanceAccumulator } from './loop/accumulator';
import { carSpeedMps } from './physics/car';
import { physToWorld } from './physics/units';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import { Renderer } from './render/renderer';
import { createRaceSim, rebuildCar, sceneOf, stepRace, type RaceSim, type SimEvent } from './sim/simulate';
import { generateTrack } from './track/generate';
import { heightAt } from './track/query';
import { Hud } from './ui/hud';

export type GameState = 'racing' | 'finished' | 'error';

/** Au 3e échec de `stepRace`, on abandonne. */
const MAX_ERRORS = 3;

export class Game {
  private readonly cfg: Config = CONFIG;
  private readonly sim: RaceSim;
  private readonly renderer: Renderer;
  private readonly camera: Camera;
  private readonly effects: Effects;
  private readonly hud: Hud;
  private readonly throttle: Throttle;
  private _state: GameState = 'racing';
  private acc = 0;
  private last = 0;
  private errors = 0;
  /** Temps de course (s) à l'arrivée : chrono figé dessus ; null avant l'arrivée. */
  private finishTime: number | null = null;
  private finishShown = false;
  private running = false;
  private rafId = 0;
  private fpsFrames = 0;
  private fpsSince = 0;

  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, private readonly opts: { seed: number; length: number; debug: boolean }) {
    const track = generateTrack(opts.seed, opts.length, this.cfg);
    this.sim = createRaceSim(track, this.cfg);
    this.renderer = new Renderer(canvas, this.cfg);
    this.camera = new Camera(this.cfg);
    this.effects = new Effects(this.cfg);
    this.hud = new Hud(hudRoot);
    this.throttle = new Throttle(window);
    if (opts.debug) (window as unknown as { __game: Game }).__game = this;
  }

  get state(): GameState { return this._state; }
  get time(): number { return this.sim.time; }
  get seed(): number { return this.opts.seed; }

  /** Progression (x du châssis, m) de la voiture `id`, NaN si inconnue. */
  progress(id: string): number {
    return id === this.sim.state.id ? this.sim.state.progress : NaN;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this._state = 'racing';
    this.renderer.resize();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.last = this.fpsSince = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private readonly onResize = (): void => this.renderer.resize();

  private readonly onVisibility = (): void => {
    if (document.visibilityState !== 'visible') return;
    this.acc = 0;
    this.last = this.fpsSince = performance.now();
    this.fpsFrames = 0;
  };

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const elapsed = Math.min(Math.max(0, (now - this.last) / 1000), 1);
    this.last = now;
    const { steps, acc } = advanceAccumulator(this.acc, elapsed, this.cfg.PHYSICS_DT, this.cfg.MAX_STEPS_PER_FRAME);
    this.acc = acc;
    const pressed = this.throttle.pressed;
    // `sim.events` ne contient que le dernier pas : on les recueille à chaque pas.
    const events: SimEvent[] = [];
    for (let i = 0; i < steps; i++) {
      try {
        stepRace(this.sim, pressed);
        events.push(...this.sim.events);
        if (this.finishTime === null && this.sim.events.some((e) => e.type === 'finish')) {
          this._state = 'finished';
          this.finishTime = this.sim.state.finishedAt;
        }
      } catch (err) {
        console.error('stepRace a échoué', err);
        if (++this.errors >= MAX_ERRORS) {
          this._state = 'error';
          this.hud.showError('Oups ! Recharge la page');
          this.stop();
          return;
        }
        rebuildCar(this.sim);
        break;
      }
    }

    const { sim } = this;
    const c = physToWorld(sim.car.chassis.position);
    this.camera.update(c.x, Math.max(c.y, heightAt(sim.track, c.x) + 3), carSpeedMps(sim.car), elapsed);
    for (const e of events) {
      if (e.type === 'respawn') this.effects.spawnSparks(e.target.x, e.target.y + 0.5);
      else if (e.type === 'landing') this.effects.spawnDust(e.x, heightAt(sim.track, e.x), e.strength);
    }
    this.effects.update(elapsed, sim.track, this.camera.x, this.renderer.visibleHalfWidthM(this.camera));
    this.renderer.draw(sceneOf(sim), this.camera, this.effects);
    this.hud.setTime(this.finishTime ?? sim.time);
    // Après l'arrivée, la voiture roule encore FINISH_COAST_SECONDS en freinant, puis le calque s'affiche.
    if (this.finishTime !== null && !this.finishShown && sim.time >= this.finishTime + this.cfg.FINISH_COAST_SECONDS) {
      this.finishShown = true;
      // L'adresse garde ?seed, ?len et ?debug : recharger relance la même piste.
      this.hud.showFinished(this.finishTime, () => location.reload());
    }

    if (this.opts.debug) {
      this.fpsFrames++;
      const span = now - this.fpsSince;
      if (span >= 1000) {
        this.hud.setFps((this.fpsFrames * 1000) / span);
        this.fpsFrames = 0;
        this.fpsSince = now;
      }
    }
    this.rafId = requestAnimationFrame(this.frame);
  };
}
