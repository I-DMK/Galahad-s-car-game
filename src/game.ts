// Boucle de jeu : une image (`runFrame` : pas fixes de l'accumulateur, pas de course de Galahad et ses 4 copains,
// poses interpolées entre les deux derniers pas) → caméra sur la pose dessinée de Galahad → rendu → HUD.
import type { Pilot } from './cars/pilots';
import { CONFIG, type Config } from './config';
import { Throttle } from './input/throttle';
import { runFrame, type FrameState, type StepOutcome } from './loop/frame';
import { StepHistogram, type StepCounts } from './loop/frame-stats';
import { PoseHistory, type CarPose } from './loop/interpolation';
import { Camera } from './render/camera';
import { Effects } from './render/effects';
import { Renderer } from './render/renderer';
import { presentFrame, stepOutcome } from './sim/present';
import { createRaceSim, posesOf, rebuildCars, stepRace, type RaceSim, type SimEvent } from './sim/simulate';
import { generateTrack } from './track/generate';
import { heightAt } from './track/query';
import { Hud } from './ui/hud';

export type GameState = 'racing' | 'finished' | 'error';

/** Au 3e échec de `stepRace`, on abandonne. */
const MAX_ERRORS = 3;
/** m : marge au-delà du bord de l'écran où les effets d'une voiture sont encore joués. */
const EFFECTS_MARGIN_M = 3;

export class Game {
  private readonly cfg: Config = CONFIG;
  private readonly sim: RaceSim;
  private readonly renderer: Renderer;
  private readonly camera: Camera;
  private readonly effects: Effects;
  private readonly hud: Hud;
  private readonly throttle: Throttle;
  private _state: GameState = 'racing';
  /** Reste de l'accumulateur et poses des deux derniers pas (rendu interpolé, tâche 5f). */
  private readonly loop: FrameState = { acc: 0, history: new PoseHistory() };
  /** Pas par image sur la dernière seconde (`?debug=1`, `frameSteps`). */
  private readonly stepStats = new StepHistogram();
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
    // Course à 5 voitures ; les copains et leur ordre sur la grille dépendent de la graine de piste : recharger (ENCORE) redonne les mêmes.
    this.sim = createRaceSim(track, this.cfg, { robots: true });
    this.renderer = new Renderer(canvas, this.cfg);
    this.camera = new Camera(this.cfg);
    this.effects = new Effects(this.cfg);
    this.hud = new Hud(hudRoot);
    this.loop.history.reset(posesOf(this.sim));
    this.throttle = new Throttle(window);
    if (opts.debug) (window as unknown as { __game: Game }).__game = this;
  }

  get state(): GameState { return this._state; }
  get time(): number { return this.sim.time; }
  get seed(): number { return this.opts.seed; }
  /** Images de la dernière seconde : total, à 0 pas, à 2 pas ou plus (debug, tremblement §8). */
  get frameSteps(): StepCounts { return { ...this.stepStats.last }; }

  /** Pilotes de la course, dans l'ordre de la grille (Galahad en premier). */
  get pilots(): Pilot[] { return this.sim.cars.map((c) => c.pilot); }

  /** Progression (x du châssis, m) de la voiture `id` (Galahad ou un copain), NaN si inconnue. */
  progress(id: string): number {
    return this.sim.cars.find((c) => c.state.id === id)?.state.progress ?? NaN;
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
    // `last` suffit : l'image suivante n'avance que du temps écoulé depuis le retour (le reste de
    // l'accumulateur est gardé, sinon la voiture dessinée reculerait d'une fraction de pas).
    this.last = this.fpsSince = performance.now();
    this.fpsFrames = 0;
    this.stepStats.reset();
  };

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const elapsed = Math.min(Math.max(0, (now - this.last) / 1000), 1);
    this.last = now;
    const pressed = this.throttle.pressed;
    // `sim.events` ne contient que le dernier pas : on les recueille à chaque pas.
    const events: SimEvent[] = [];
    const frame = runFrame(this.loop, elapsed, this.cfg, () => this.step(pressed, events));
    if (frame.stopped) return;
    if (this.stepStats.record(frame.steps, now) && this.opts.debug) this.hud.setFrameSteps(this.stepStats.last);

    try {
      this.present(now, elapsed, events, frame);
    } catch (err) {
      // Caméra, effets, rendu ou HUD : sans ce garde-fou, l'exception tuerait la boucle en silence.
      console.error('le rendu a échoué', err);
      this._state = 'error';
      this.hud.showError('Oups ! Recharge la page');
      this.stop();
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  /**
   * Un pas de course pour `runFrame` : événements recueillis dans `events`, arrivée de Galahad ; poses
   * après le pas et voitures réapparues (téléportées : pas d'interpolation depuis l'ancienne position).
   * Sur exception : `rebuildCars` (historique remis à zéro), ou abandon au MAX_ERRORS-ième échec.
   */
  private step(pressed: boolean, events: SimEvent[]): StepOutcome {
    const { sim } = this;
    try {
      stepRace(sim, pressed);
      events.push(...sim.events);
      const galahad = sim.cars[0].state;
      if (this.finishTime === null && sim.events.some((e) => e.type === 'finish' && e.carId === galahad.id)) {
        this._state = 'finished';
        this.finishTime = galahad.finishedAt;
      }
      return stepOutcome(sim);
    } catch (err) {
      console.error('stepRace a échoué', err);
      if (++this.errors >= MAX_ERRORS) {
        this._state = 'error';
        this.hud.showError('Oups ! Recharge la page');
        this.stop();
        return 'stop';
      }
      rebuildCars(sim);
      return { rebuilt: posesOf(sim) };
    }
  }

  /**
   * Caméra, effets, rendu et HUD d'une image, après les pas de course : voitures et caméra aux poses
   * dessinées `frame.poses` (interpolées, fraction `frame.alpha` du pas ; `presentFrame`). Ne modifie jamais `sim`.
   */
  private present(now: number, elapsed: number, events: SimEvent[], frame: { poses: CarPose[]; alpha: number }): void {
    const { sim } = this;
    const galahad = sim.cars[0];
    const scene = presentFrame(sim, frame, this.camera, elapsed);
    const half = this.renderer.visibleHalfWidthM(this.camera);
    // Effets de Galahad, et des copains seulement à l'écran (spec §9).
    const shown = (carId: string, x: number) => carId === galahad.state.id || Math.abs(x - this.camera.x) <= half + EFFECTS_MARGIN_M;
    for (const e of events) {
      if (e.type === 'respawn' && shown(e.carId, e.target.x)) this.effects.spawnSparks(e.target.x, e.target.y + 0.5);
      else if (e.type === 'landing' && shown(e.carId, e.x)) this.effects.spawnDust(e.x, heightAt(sim.track, e.x), e.strength);
    }
    this.effects.update(elapsed, sim.track, this.camera.x, half);
    this.renderer.draw(scene, this.camera, this.effects);
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
  }
}
