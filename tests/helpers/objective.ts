// Objectif de course sous élastique (plan B, tâche 7 ; spec §7 et §11, addendum §2 ; décisions D7-1 à D7-5 du papa) :
// compteurs « freinage net à l'écran » et « copain à l'écran », et (Step 5) lignes, tableau et cibles de l'objectif.
// L'écran est celui de l'élastique : une seule définition, `onScreen` (src/ai/rubberband.ts, ruling R7-16).
import { onScreen } from '../../src/ai/rubberband';
import { CONFIG, type Config } from '../../src/config';
import { carSpeedMps } from '../../src/physics/car';
import { chassisX, GALAHAD_INDEX, type RaceSim } from '../../src/sim/simulate';
import { f2 } from './runs';

/**
 * Seuil du « freinage net à l'écran » (spec §7 : « jamais d'arrêt net visible ») : une baisse de `speedFactor` de plus
 * de RUBBER_RATE_PER_S × dt (+ 1e-9) en un pas, pour un copain dont `onScreen` est vrai à ce pas. Seule exception : la
 * fin de son propre turbo (R7-6). Le plafond « ≤ 1 hors écran devant » tombe au bord de la vue (R7-16) : jamais compté.
 */
export const brakeThreshold = (cfg: Config = CONFIG): number => cfg.RUBBER_RATE_PER_S * cfg.PHYSICS_DT + 1e-9;

/**
 * Compteur « freinage net à l'écran », à appeler après chaque pas (`observe`). Turbo du pas : `turboUntil` lu après le
 * pas précédent, comparé au temps du pas (une étoile prise pendant le pas ne change que le pas suivant), comme
 * `stepRace` le lit avant la conduite.
 */
export class BrakeWatch {
  count = 0;
  /** Baisses comptées (lisibles), et la plus forte baisse à l'écran hors fin de turbo. */
  readonly events: string[] = [];
  maxDrop = 0;
  /** Pas où un copain à l'écran a vu son facteur baisser à la fin de son turbo (exception), et la plus forte de ces baisses. */
  turboEnds = 0;
  private readonly prevF: number[];
  private readonly prevTurbo: boolean[];
  private readonly turboSeen: number[];
  private lastTime: number;

  constructor(sim: RaceSim, private readonly cfg: Config = sim.cfg) {
    this.prevF = sim.cars.map((c) => c.speedFactor);
    this.prevTurbo = sim.cars.map((c) => sim.time < c.state.turboUntil);
    this.turboSeen = sim.cars.map((c) => c.state.turboUntil);
    this.lastTime = sim.time;
  }

  observe(sim: RaceSim): void {
    const t = this.lastTime;
    const limit = brakeThreshold(this.cfg);
    sim.cars.forEach((car, i) => {
      if (i === GALAHAD_INDEX) return;
      const turbo = t < this.turboSeen[i];
      const drop = this.prevF[i] - car.speedFactor;
      if (car.rubber !== null && car.onScreen && drop > limit) {
        if (this.prevTurbo[i] && !turbo) {
          this.turboEnds++;
        } else {
          this.count++;
          this.maxDrop = Math.max(this.maxDrop, drop);
          if (this.events.length < 20) this.events.push(`${car.state.id} t = ${t.toFixed(3)} s : ${f2(this.prevF[i])} → ${f2(car.speedFactor)}`);
        }
      }
      this.prevF[i] = car.speedFactor;
      this.prevTurbo[i] = turbo;
      this.turboSeen[i] = car.state.turboUntil;
    });
    this.lastTime = sim.time;
  }
}

/**
 * Part « copain à l'écran » (définition du § 0.2 de la tâche 7, celle de la relecture adversariale) : pas après les
 * RUBBER_NEUTRAL_SECONDS neutres et avant l'arrivée de Galahad où au moins un copain est à l'écran
 * (`onScreen(xCopain − xGalahad, vitesse de Galahad)`), et où au moins un copain est à l'écran devant lui (gap > 0).
 * À appeler après chaque pas : positions de fin de pas (= début du pas suivant).
 */
export class ScreenShare {
  steps = 0;
  visible = 0;
  visibleAhead = 0;

  constructor(private readonly cfg: Config = CONFIG) {}

  observe(sim: RaceSim): void {
    const g = sim.cars[GALAHAD_INDEX];
    if (sim.time < this.cfg.RUBBER_NEUTRAL_SECONDS || g.state.finishedAt !== null) return;
    const gx = chassisX(g);
    const vG = carSpeedMps(g.body);
    let vis = false;
    let ahead = false;
    for (let i = 0; i < sim.cars.length; i++) {
      if (i === GALAHAD_INDEX) continue;
      const gap = chassisX(sim.cars[i]) - gx;
      if (onScreen(gap, vG, this.cfg)) {
        vis = true;
        if (gap > 0) ahead = true;
      }
    }
    this.steps++;
    if (vis) this.visible++;
    if (ahead) this.visibleAhead++;
  }

  get share(): number { return this.visible / Math.max(1, this.steps); }
  get aheadShare(): number { return this.visibleAhead / Math.max(1, this.steps); }
}
