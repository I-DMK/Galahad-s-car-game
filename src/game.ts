// Boucle de jeu et machine d'états (plan B, tâche 10 ; spec §4). La machine (`loop/states.ts`, pure) décide des phases ;
// `Game` l'orchestre : titre (scène des copains dessinée par `Renderer.drawTitle`), décompte (3, 2, 1, PARTEZ : aucun pas
// de course, la grille figée est dessinée), course (`runFrame` : pas fixes de l'accumulateur, pas de course de Galahad et
// ses 4 copains, poses interpolées entre les deux derniers pas → caméra sur la pose dessinée de Galahad → rendu → HUD et
// bouton saut), arrivée (ENCORE, MENU), pause (onglet caché, geste retour, portrait : scène figée, reprise par un décompte).
// La course entière est recréée (`newRace`) pour AUTRE PISTE, ENCORE et MENU ; la simulation ne fait aucun pas hors de
// `racing` et `finished`.
import type { Pilot } from './cars/pilots';
import { DisplayedRank, progressFraction } from './cars/ranking';
import { CONFIG, type Config } from './config';
import { JumpInput } from './input/jump';
import { Throttle } from './input/throttle';
import { runFrame, type FrameState, type StepOutcome } from './loop/frame';
import { StepHistogram, type StepCounts } from './loop/frame-stats';
import { PoseHistory, type CarPose } from './loop/interpolation';
import { INITIAL_STATE, transition, type GameEvent, type MachineState, type Phase } from './loop/states';
import type { Art } from './render/assets';
import { Camera } from './render/camera';
import { flightHeight } from './render/car';
import { Effects } from './render/effects';
import { Renderer } from './render/renderer';
import { titleScene } from './render/title';
import { presentFrame, stepOutcome } from './sim/present';
import {
  carView, createRaceSim, GALAHAD_INDEX, jumpReady, posesOf, rankEntriesOf, rebuildCars, stepRace, type RaceSim, type SimEvent,
} from './sim/simulate';
import { generateTrack } from './track/generate';
import { heightAt } from './track/query';
import { Hud } from './ui/hud';
import { JumpButton } from './ui/jump-button';
import { Screens } from './ui/screens';

/** Phases de la machine d'états (spec §4) ; la phase initiale est `title`. */
export type GameState = Phase;

export interface GameOptions {
  seed: number;
  length: number;
  debug: boolean;
  /** Version affichée au titre (`v1.1.0`) ; '' par défaut (tests). */
  version?: string;
}

/** Au 3e échec de `stepRace`, on abandonne. */
const MAX_ERRORS = 3;
/** Tolérance d'arrondi du décompte (s) : trois images de 1 s font 2,999999999999999 (comme `advanceAccumulator`). */
const COUNTDOWN_EPS = 1e-9;
/** m : marge au-delà du bord de l'écran où les effets d'une voiture sont encore joués. */
const EFFECTS_MARGIN_M = 3;
/** Force de la poussière d'un saut (comme un atterrissage à 4 m/s : 8 grains). */
const JUMP_DUST_STRENGTH = 4;

export class Game {
  private readonly cfg: Config = CONFIG;
  /** La course en cours ; réassignée par `newRace` (AUTRE PISTE, ENCORE, MENU), créée par le constructeur (le titre a besoin des copains). */
  private sim!: RaceSim;
  private readonly renderer: Renderer;
  private readonly camera: Camera;
  private readonly effects: Effects;
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly throttle: Throttle;
  private readonly jumpButton: JumpButton;
  private readonly jumpInput: JumpInput;
  /** Sauts de Galahad depuis le départ (événements 'jump', `?debug=1` : `jumps`). */
  private jumpCount = 0;
  /** Réapparitions de Galahad depuis le départ (`?debug=1` : `respawns`, e2e des fosses, tâche 5g). */
  private readonly respawnLog: { reason: string; t: number; x: number; targetX: number }[] = [];
  /** Phase courante (machine pure de `loop/states.ts`). */
  private machine: MachineState = INITIAL_STATE;
  /** Reste de l'accumulateur et poses des deux derniers pas (rendu interpolé, tâche 5f). */
  private readonly loop: FrameState = { acc: 0, history: new PoseHistory() };
  /** Pas par image sur la dernière seconde (`?debug=1`, `frameSteps`). */
  private readonly stepStats = new StepHistogram();
  private last = 0;
  private errors = 0;
  /** Temps de course (s) à l'arrivée : chrono figé dessus ; null avant l'arrivée. */
  private finishTime: number | null = null;
  private finishShown = false;
  /** Place de Galahad montrée au HUD (hystérésis, spec §7) ; neuve à chaque course. */
  private displayedRank: DisplayedRank;
  private running = false;
  private rafId = 0;
  private fpsFrames = 0;
  private fpsSince = 0;
  /** s écoulées depuis le début du décompte courant (temps réel des images, pas de la course). */
  private countdownElapsed = 0;
  /** Texte du décompte montré ('3', '2', '1', 'PARTEZ'), null quand le calque est caché (`countdownText`). */
  private countdownLabel: string | null = null;
  /** Instant (ms, horloge des images) jusqu'auquel « PARTEZ » reste affiché après le passage en course. */
  private goShownUntil = 0;
  /** Une entrée d'historique est en place (geste retour → pause) ; `popstate` la consomme. */
  private historyArmed = false;
  private _portrait = false;
  private readonly opts: GameOptions;

  /**
   * `art` : promesse des images (`loadArt`, lancée par `main.ts` avant la construction). À sa résolution, le rendu passe
   * du dessin par code aux images à la trame suivante ; la course n'attend jamais. Un rejet (que `loadArt` ne produit pas)
   * est géré sans bruit : tout reste dessiné par code.
   */
  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, opts: GameOptions, art?: Promise<Art>) {
    this.opts = { ...opts };
    this.renderer = new Renderer(canvas, this.cfg);
    void art?.then((a) => this.renderer.setArt(a), () => { /* images indisponibles : dessin par code */ });
    this.camera = new Camera(this.cfg);
    this.effects = new Effects(this.cfg);
    this.hud = new Hud(hudRoot, []);
    this.displayedRank = new DisplayedRank(this.cfg);
    this.throttle = new Throttle(window);
    this.jumpButton = new JumpButton(hudRoot, this.cfg);
    // Espace n'est pris que pendant la course (ni au titre, ni sur ENCORE, ni après une erreur).
    this.jumpInput = new JumpInput(window, this.jumpButton.el, () => this.machine.phase === 'racing');
    // Les écrans viennent après le HUD et le bouton saut : au-dessus d'eux (le voile de pause couvre le bouton saut).
    this.screens = new Screens(hudRoot, { version: opts.version ?? '' }, {
      onPlay: (viaPointer) => this.play(viaPointer), onOtherTrack: () => this.otherTrack(), onResume: () => this.resume(),
    });
    // Course à 5 voitures ; les copains et leur ordre sur la grille dépendent de la graine de piste : ENCORE redonne les mêmes.
    this.newRace(this.opts.seed);
    this.hud.setRaceVisible(false);
    this.jumpButton.setVisible(false);
    if (opts.debug) (window as unknown as { __game: Game }).__game = this;
  }

  get state(): GameState { return this.machine.phase; }
  /** Temps de course (s) : 0 au titre et pendant le premier décompte. */
  get time(): number { return this.sim.time; }
  /** Graine courante (change à AUTRE PISTE). */
  get seed(): number { return this.opts.seed; }
  /** '3' | '2' | '1' pendant le décompte, 'PARTEZ' la première seconde de course, null sinon (e2e). */
  get countdownText(): string | null { return this.countdownLabel; }
  /** `innerHeight > innerWidth`, lu à `start()`, à chaque `resize`, et à chaque entrée en décompte (JOUER, REPRENDRE, ENCORE). */
  get portrait(): boolean { return this._portrait; }
  /** Images de la dernière seconde : total, à 0 pas, à 2 pas ou plus (debug, tremblement §8). */
  get frameSteps(): StepCounts { return { ...this.stepStats.last }; }
  /** Sauts de Galahad depuis le départ (debug, e2e). */
  get jumps(): number { return this.jumpCount; }
  /**
   * Réapparitions de Galahad (debug, e2e, tâche 5g) : raison, instant (s), x du châssis avant la téléportation et x de
   * la cible ; copies.
   */
  get respawns(): { reason: string; t: number; x: number; targetX: number }[] { return this.respawnLog.map((r) => ({ ...r })); }
  /** Doigt de gaz posé (debug, e2e : un tap sur le bouton saut n'en est jamais un). */
  get throttlePressed(): boolean { return this.throttle.pressed; }
  /** Images (debug, e2e, tâche 8b) : réglées ou non, fichiers chargés et en échec ; copies de ce que le `Renderer` a reçu. */
  get art(): { settled: boolean; loaded: string[]; failed: string[] } {
    const a = this.renderer.art;
    return { settled: a !== null, loaded: a ? [...a.loaded] : [], failed: a ? [...a.failed] : [] };
  }
  /**
   * Hauteur de vol de Galahad (m) : sa roue la plus basse au-dessus du sol, 0 au sol (debug, e2e, tâche 8b) ; c'est
   * la hauteur qui règle son ombre (`flightHeight`).
   */
  get airHeight(): number {
    return flightHeight(carView(this.sim, GALAHAD_INDEX), this.sim.track, this.cfg.WHEEL_RADIUS);
  }

  /** Pilotes de la course, dans l'ordre de la grille (Galahad en premier). */
  get pilots(): Pilot[] { return this.sim.cars.map((c) => c.pilot); }

  /** Progression (x du châssis, m) de la voiture `id` (Galahad ou un copain), NaN si inconnue. */
  progress(id: string): number {
    return this.sim.cars.find((c) => c.state.id === id)?.state.progress ?? NaN;
  }

  /** Branche les écouteurs et montre le TITRE ; la boucle tourne dès maintenant (scène du titre). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.renderer.resize();
    this.readPortrait();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('popstate', this.onPopState);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.showTitle();
    this.last = this.fpsSince = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /**
   * JOUER : title → countdown ; sans effet ailleurs. `viaPointer` (pointerdown sur le bouton) : le plein écran est demandé
   * au prochain `pointerup`, qui accorde l'activation que le `pointerdown` tactile n'accorde pas (spec §8) ; refus ignoré.
   * Le chemin clavier (click sans pointeur) se passe de plein écran : la tablette est tactile.
   */
  play(viaPointer = false): void {
    if (!this.send('play')) return;
    if (viaPointer) window.addEventListener('pointerup', requestFullscreen, { once: true });
    this.beginCountdown();
  }

  /**
   * AUTRE PISTE (titre seulement) : seed = Date.now() % 100000, nouvelle course (piste et copains), puis URL réécrite
   * (`?seed=` ; `len` et `debug` gardés). Un `replaceState` qui lève (quota après des taps en rafale) ne change rien à la
   * course : l'adresse garde l'ancienne graine, c'est tout.
   */
  otherTrack(): void {
    if (this.machine.phase !== 'title') return;
    this.opts.seed = Date.now() % 100000;
    this.newRace(this.opts.seed);
    this.showTitle();
    try {
      const params = new URLSearchParams(location.search);
      params.set('seed', String(this.opts.seed));
      history.replaceState(null, '', `?${params.toString()}`);
    } catch { /* adresse non réécrite : la course, elle, est bien la nouvelle */ }
  }

  /** REPRENDRE (pause seulement, et seulement en paysage) : → countdown à 3, puis la course reprend où elle en était. */
  resume(): void {
    if (this.machine.phase !== 'paused') return;
    if (this._portrait) {
      this.screens.setPortrait(true);
      return;
    }
    if (!this.send('resume')) return;
    this.beginCountdown();
  }

  /** ENCORE (finished, podium) : nouvelle course sur la même graine (mêmes piste et copains) → countdown. */
  again(): void {
    if (!this.send('again')) return;
    this.newRace(this.opts.seed);
    this.beginCountdown();
  }

  /**
   * MENU (finished, podium) : → title, nouvelle course sur la même graine (le titre montre les mêmes copains). L'entrée
   * d'historique armée par le décompte est consommée (`history.back()` : le `popstate` qui suit trouve la phase `title`
   * et ne fait que remettre `historyArmed` à faux), sinon un geste retour au titre reviendrait sur cette entrée fantôme.
   */
  menu(): void {
    if (!this.send('menu')) return;
    this.newRace(this.opts.seed);
    this.showTitle();
    if (this.historyArmed) history.back();
  }

  /** Envoie `ev` à la machine ; vrai si la phase a changé. */
  private send(ev: GameEvent): boolean {
    const next = transition(this.machine, ev);
    if (next === this.machine) return false;
    this.machine = next;
    return true;
  }

  /**
   * Remplace l'état d'une course : piste et copains de `seed`, historique de poses, classement, chrono, compteurs, caméra
   * (calée d'un coup à la prochaine image), effets, couloirs du HUD, calque ARRIVÉE retiré, demande de saut jetée.
   */
  private newRace(seed: number): void {
    const track = generateTrack(seed, this.opts.length, this.cfg);
    this.sim = createRaceSim(track, this.cfg, { robots: true });
    this.loop.acc = 0;
    this.loop.history.reset(posesOf(this.sim));
    this.displayedRank = new DisplayedRank(this.cfg);
    this.finishTime = null;
    this.finishShown = false;
    this.jumpCount = 0;
    this.respawnLog.length = 0;
    this.errors = 0;
    this.countdownLabel = null;
    this.camera.reset();
    this.effects.clear();
    this.hud.setRacers(this.sim.cars.map((c, i) => ({ color: c.state.color, isGalahad: i === GALAHAD_INDEX })));
    this.hud.hide();
    this.jumpInput.clear();
  }

  /** Titre : calque du titre, HUD de course et bouton saut cachés (la scène du titre est dessinée par `frame`). */
  private showTitle(): void {
    this.countdownLabel = null;
    this.screens.showTitle();
    this.hud.setRaceVisible(false);
    this.jumpButton.setVisible(false);
  }

  /**
   * Entrée en `countdown` (JOUER, REPRENDRE, ENCORE) : décompte à COUNTDOWN_SECONDS, HUD visible, bouton saut visible mais
   * grisé, demande de saut jetée, entrée d'historique en place ; si la tablette est déjà en portrait, pause (TOURNE) aussitôt.
   */
  private beginCountdown(): void {
    this.readPortrait();
    this.countdownElapsed = 0;
    this.showCountdown(String(this.cfg.COUNTDOWN_SECONDS));
    this.hud.setRaceVisible(true);
    this.jumpButton.setVisible(true);
    this.jumpButton.setReady(false);
    this.jumpInput.clear();
    this.armHistory();
    if (this._portrait) this.pause();
  }

  private showCountdown(text: string): void {
    this.countdownLabel = text;
    this.screens.showCountdown(text);
  }

  /** Depuis `countdown` ou `racing` : pause (calque PAUSE ou TOURNE), demande de saut jetée ; sans effet ailleurs. */
  private pause(): void {
    if (!this.send('pause')) return;
    this.countdownLabel = null;
    this.jumpInput.clear();
    this.jumpButton.setReady(false);
    this.screens.showPaused(this._portrait);
  }

  /**
   * Geste retour (spec §8, plan v2.1) : une entrée d'historique est poussée s'il n'y en a pas, remplacée sinon : la pile
   * reste stable d'un décompte à l'autre ; `popstate` la consomme (`historyArmed` remis à faux).
   */
  private armHistory(): void {
    if (!this.historyArmed) {
      history.pushState({ galahad: true }, '');
      this.historyArmed = true;
    } else {
      history.replaceState({ galahad: true }, '');
    }
  }

  private readPortrait(): void {
    this._portrait = window.innerHeight > window.innerWidth;
  }

  /** 3 échecs de `stepRace` ou une exception de rendu : « Oups ! Recharge la page », boucle arrêtée. */
  private fail(): void {
    this.send('error');
    this.countdownLabel = null;
    this.screens.hide();
    this.hud.showError('Oups ! Recharge la page');
    this.stop();
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('popstate', this.onPopState);
    window.removeEventListener('pointerup', requestFullscreen);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  /** Taille du canvas, puis orientation : portrait pendant le décompte ou la course → pause ; en pause → le calque suit. */
  private readonly onResize = (): void => {
    this.renderer.resize();
    this.readPortrait();
    const { phase } = this.machine;
    if (this._portrait && (phase === 'countdown' || phase === 'racing')) this.pause();
    else if (phase === 'paused') this.screens.setPortrait(this._portrait);
  };

  /** Geste retour : l'entrée est consommée ; pause pendant le décompte ou la course, MENU après l'arrivée (A5). */
  private readonly onPopState = (): void => {
    this.historyArmed = false;
    const { phase } = this.machine;
    if (phase === 'finished' || phase === 'podium') this.menu();
    else this.pause();
  };

  private readonly onVisibility = (): void => {
    // Un appui d'avant le changement d'onglet ne part jamais au retour.
    this.jumpInput.clear();
    if (document.visibilityState !== 'visible') {
      // Onglet caché : pause (la reprise passe par REPRENDRE, jamais toute seule au retour).
      this.pause();
      return;
    }
    // `last` suffit : l'image suivante n'avance que du temps écoulé depuis le retour (le reste de
    // l'accumulateur est gardé, sinon la voiture dessinée reculerait d'une fraction de pas).
    this.last = this.fpsSince = performance.now();
    this.fpsFrames = 0;
    this.stepStats.reset();
  };

  /**
   * Une image, selon la phase : titre (scène du titre), décompte (texte, scène de course figée, aucun pas), pause (scène
   * figée), course et arrivée (`raceFrame`). Toute exception (rendu, HUD, caméra) → `fail` : sans ce garde-fou, elle
   * tuerait la boucle en silence. Le fps (debug) est compté ici, à toute phase.
   */
  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const elapsed = Math.min(Math.max(0, (now - this.last) / 1000), 1);
    this.last = now;
    if (this.opts.debug) this.countFps(now);
    try {
      switch (this.machine.phase) {
        case 'title':
          this.renderer.drawTitle(titleScene(this.pilots, now / 1000, this.cfg));
          break;
        case 'countdown':
          this.countdownFrame(now, elapsed);
          break;
        case 'paused':
          this.jumpInput.clear();
          this.presentFrozen(now, elapsed);
          break;
        case 'racing':
        case 'finished':
        case 'podium':
          if (!this.raceFrame(now, elapsed)) return;
          break;
        case 'error':
          return;
      }
    } catch (err) {
      console.error('le rendu a échoué', err);
      this.fail();
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  /**
   * Décompte : d'abord le passage à PARTEZ (`go` : la course est en `racing`, mais cette image ne fait aucun pas ; le
   * premier pas est à l'image suivante), sinon le chiffre (3, 2, 1 ; jamais 0). Aucun pas de simulation ; la grille est
   * dessinée aux poses du dernier pas, caméra calée, HUD visible, bouton saut grisé.
   */
  private countdownFrame(now: number, elapsed: number): void {
    this.countdownElapsed += elapsed;
    this.jumpInput.clear();
    const left = this.cfg.COUNTDOWN_SECONDS - this.countdownElapsed - COUNTDOWN_EPS;
    if (left <= 0) {
      this.send('go');
      this.goShownUntil = now + this.cfg.COUNTDOWN_GO_SECONDS * 1000;
      this.showCountdown('PARTEZ');
    } else {
      // `left` > 0 : ceil ≥ 1, jamais « 0 ».
      this.showCountdown(String(Math.ceil(left)));
    }
    this.jumpButton.setReady(false);
    this.presentFrozen(now, elapsed);
  }

  /**
   * Scène de course aux poses du dernier pas (décompte, pause) : aucun pas, `presentFrame` avec `steps: 0` et un temps
   * écoulé nul : la caméra et les particules sont figées comme les voitures (la caméra remise à zéro par `newRace` se cale
   * quand même d'un coup à sa première mise à jour).
   */
  private presentFrozen(now: number, _elapsed: number): void {
    this.present(now, 0, [], { poses: this.loop.history.at(1), alpha: 1, steps: 0 });
  }

  /** Course et arrivée : pas de l'accumulateur, bouton saut, compteur d'images, PARTEZ retiré après sa seconde, rendu. Faux si la boucle s'arrête. */
  private raceFrame(now: number, elapsed: number): boolean {
    const pressed = this.throttle.pressed;
    // `sim.events` ne contient que le dernier pas : on les recueille à chaque pas.
    const events: SimEvent[] = [];
    const frame = runFrame(this.loop, elapsed, this.cfg, (i) => this.step(i, pressed, events));
    if (frame.stopped) return false;
    // Après l'arrivée, les appuis sont jetés (stepRace les ignorerait de toute façon).
    if (this.machine.phase !== 'racing') this.jumpInput.clear();
    this.jumpButton.setReady(this.machine.phase === 'racing' && jumpReady(this.sim, GALAHAD_INDEX));
    if (this.stepStats.record(frame.steps, now) && this.opts.debug) this.hud.setFrameSteps(this.stepStats.last);
    if (this.countdownLabel !== null && now >= this.goShownUntil) {
      this.countdownLabel = null;
      this.screens.hide();
    }
    this.present(now, elapsed, events, frame);
    return true;
  }

  /** Images par seconde (debug), à toute phase : le titre et le décompte ont un fps aussi. */
  private countFps(now: number): void {
    this.fpsFrames++;
    const span = now - this.fpsSince;
    if (span >= 1000) {
      this.hud.setFps((this.fpsFrames * 1000) / span);
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
  }

  /**
   * Pas `i` de l'image pour `runFrame` : la demande de saut est donnée au premier pas (`i === 0`) et consommée
   * quand il réussit ; une image sans pas la laisse en attente ; un pas qui lève la jette (`rebuildCars` est une
   * téléportation, qui oublie la demande). Événements recueillis
   * dans `events`, sauts et arrivée de Galahad ; poses après le pas et voitures réapparues (téléportées : pas
   * d'interpolation depuis l'ancienne position). Sur exception : `rebuildCars` (historique remis à zéro), ou
   * abandon au MAX_ERRORS-ième échec.
   */
  private step(i: number, pressed: boolean, events: SimEvent[]): StepOutcome {
    const { sim } = this;
    try {
      const jump = i === 0 && this.jumpInput.pending;
      stepRace(sim, pressed, jump);
      if (jump) this.jumpInput.clear();
      events.push(...sim.events);
      const galahad = sim.cars[GALAHAD_INDEX].state;
      for (const e of sim.events) {
        if (e.carId !== galahad.id) continue;
        if (e.type === 'jump') this.jumpCount++;
        else if (e.type === 'respawn') this.respawnLog.push({ reason: e.reason, t: e.t, x: e.x, targetX: e.target.x });
      }
      if (this.finishTime === null && sim.events.some((e) => e.type === 'finish' && e.carId === galahad.id)) {
        this.send('finish');
        this.finishTime = galahad.finishedAt;
      }
      return stepOutcome(sim);
    } catch (err) {
      console.error('stepRace a échoué', err);
      // `rebuildCars` est une téléportation : elle oublie la demande de saut, celle du pas qui a levé comprise.
      this.jumpInput.clear();
      if (++this.errors >= MAX_ERRORS) {
        this.fail();
        return 'stop';
      }
      rebuildCars(sim);
      return { rebuilt: posesOf(sim) };
    }
  }

  /**
   * Position de Galahad et barre de progression du HUD (lecture seule de `sim`), aux images où la course a avancé :
   * `DisplayedRank` recalcule le classement brut et décide de la place montrée (hystérésis, spec §7) ; vide la première
   * seconde (spec §6). Quelques petits tableaux par image (5 voitures), sans effet sur le reste de l'image.
   */
  private updateRank(): void {
    const { sim } = this;
    const cars = rankEntriesOf(sim);
    const shown = this.displayedRank.update(cars, GALAHAD_INDEX, sim.time);
    this.hud.setPosition(sim.time < this.cfg.RANK_HIDE_SECONDS ? null : shown);
    const { xStart, xFinish } = sim.track;
    this.hud.setProgress(cars.map((c) => progressFraction(c.progress, xStart, xFinish)));
  }

  /**
   * Caméra, effets, rendu et HUD d'une image, après les pas de course : voitures et caméra aux poses
   * dessinées `frame.poses` (interpolées, fraction `frame.alpha` du pas ; `presentFrame`). Ne modifie jamais `sim`.
   */
  private present(now: number, elapsed: number, events: SimEvent[], frame: { poses: CarPose[]; alpha: number; steps: number }): void {
    const { sim } = this;
    const galahad = sim.cars[GALAHAD_INDEX];
    const scene = presentFrame(sim, frame, this.camera, elapsed);
    const half = this.renderer.visibleHalfWidthM(this.camera);
    // Effets de Galahad, et des copains seulement à l'écran (spec §9).
    const shown = (carId: string, x: number) => carId === galahad.state.id || Math.abs(x - this.camera.x) <= half + EFFECTS_MARGIN_M;
    for (const e of events) {
      if (e.type === 'respawn' && shown(e.carId, e.target.x)) this.effects.spawnSparks(e.target.x, e.target.y + 0.5);
      else if (e.type === 'landing' && shown(e.carId, e.x)) this.effects.spawnDust(e.x, heightAt(sim.track, e.x), e.strength);
      // Poussière du saut au sol si la voiture le touchait, sinon à la hauteur du châssis (`y` de l'événement).
      else if (e.type === 'jump' && shown(e.carId, e.x)) this.effects.spawnDust(e.x, e.y, JUMP_DUST_STRENGTH);
    }
    this.effects.update(elapsed, sim.track, this.camera.x, half);
    this.renderer.draw(scene, this.camera, this.effects);
    this.hud.setTime(this.finishTime ?? sim.time);
    // Le classement ne change qu'avec un pas de course : pas de recalcul aux images à 0 pas (écrans à 120 Hz).
    if (frame.steps > 0) this.updateRank();
    // Après l'arrivée, la voiture roule encore FINISH_COAST_SECONDS en freinant, puis le calque s'affiche : ENCORE (même
    // piste, mêmes copains) et MENU (titre), décision Q2 du papa ; le podium de la tâche 11 le remplacera.
    if (this.finishTime !== null && !this.finishShown && sim.time >= this.finishTime + this.cfg.FINISH_COAST_SECONDS) {
      this.finishShown = true;
      this.hud.showFinished(this.finishTime, () => this.again(), () => this.menu());
    }
  }
}

/** Plein écran au premier `pointerup` après JOUER ; refus (ou API absente : jsdom) ignoré. */
function requestFullscreen(): void {
  try {
    void document.documentElement.requestFullscreen?.()?.catch(() => { /* refus : on continue sans */ });
  } catch { /* API qui lève : on continue sans */ }
}
