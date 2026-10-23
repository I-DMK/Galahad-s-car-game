// Objectif de course sous élastique (plan B, tâche 7 ; spec §7 et §11, addendum §2 ; décisions D7-1 à D7-5 du papa) :
// compteurs « freinage net à l'écran » et « copain à l'écran », et (Step 5) lignes, tableau et cibles de l'objectif.
// L'écran est celui de l'élastique : une seule définition, `onScreen` (src/ai/rubberband.ts, ruling R7-16).
import { onScreen } from '../../src/ai/rubberband';
import { CONFIG, type Config } from '../../src/config';
import { carSpeedMps } from '../../src/physics/car';
import { toM } from '../../src/physics/units';
import { carPairsTouching } from '../../src/sim/harness';
import { chassisX, GALAHAD_INDEX, type RaceSim } from '../../src/sim/simulate';
import { RACE_MAX_SECONDS, fiveCarRace, isSansTentative, lavaSeries, respawnsHorsFosses, type FiveCarRace } from './race';
import { placeStats, type Motif, type RattrapageRow } from './rattrapage';
import { f1, f2, liftedPattern } from './runs';

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
  /** Baisses comptées (lisibles). */
  readonly events: string[] = [];
  /** Plus forte baisse de `speedFactor` en un pas d'un copain à l'écran, hors fin de son turbo (comptée ou non). */
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
      const turboEnd = this.prevTurbo[i] && !turbo;
      if (car.rubber !== null && car.onScreen && !turboEnd) this.maxDrop = Math.max(this.maxDrop, drop);
      if (car.rubber !== null && car.onScreen && drop > limit) {
        if (turboEnd) {
          this.turboEnds++;
        } else {
          this.count++;
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

/** Part du temps où Galahad lève le doigt dans le motif « doigt levé » (comme le rattrapage). */
export const LIFTED_P = 0.3;
/** Fenêtre (s) après un contact entre voitures où la vitesse d'un copain est « après contact » (catapultes, R-F12). */
export const AFTER_CONTACT_SECONDS = 2;
/** Écart (s) sans contact qui sépare deux contacts Galahad–copain (épisodes). */
const CONTACT_EPISODE_GAP = 0.5;
/** s : fenêtre de la décélération mesurée (vx moyenne d'un copain, de bout en bout de la fenêtre). */
const DECEL_WINDOW = 0.5;

/** Saut de Galahad dans l'objectif : modèle D7-1 (saut parfait aux fosses) ou variante « sauteur » (D7-5). */
export type ObjectiveJump = 'parfait' | 'sauteur';

/** Une course de l'objectif : la forme d'une ligne du rattrapage (mêmes courses, même lecture), et les mesures de l'élastique. */
export interface ObjectiveRow extends RattrapageRow {
  jump: ObjectiveJump;
  /** Réapparitions hors chutes dans une fosse, par voiture (ordre des ids). */
  respawnsHorsFosses: number[];
  /** Plus longue série de chutes dans la même lave, toutes voitures. */
  maxSeries: number;
  /** Chutes de copain « sans tentative » (0 exigé). */
  sansTentative: number;
  /** Facteur appliqué moyen (`speedFactor`) de chaque copain, après le neutre et avant l'arrivée de Galahad. */
  meanFactor: number[];
  /** Part du temps avec un copain à l'écran, et à l'écran devant Galahad (`ScreenShare`). */
  screenShare: number;
  aheadShare: number;
  /** Contacts Galahad–copain : épisodes (séparés de 0,5 s sans contact) et pas. */
  contactEpisodes: number;
  contactSteps: number;
  /** vx maximale (m/s) d'un copain dans les 2 s après un contact entre voitures, et hors de ces fenêtres (conduite). */
  vxAfterContact: number;
  vxDriven: number;
  /** Compteur « freinage net à l'écran » (0 exigé), fins de turbo à l'écran (exception), et ses baisses. */
  brake: number;
  turboEnds: number;
  brakeEvents: string[];
  /**
   * Décélération maximale (m/s²) d'un copain à l'écran : baisse de sa vx sur DECEL_WINDOW (0,5 s), toute la fenêtre à
   * l'écran, au sol au bout, sans contact entre voitures ni réapparition depuis 2 s (pentes, bosses et fin de son
   * turbo comprises) ; et baisse de facteur maximale en un pas à l'écran hors fin de turbo, en m/s² équivalents
   * (Δf × V_MAX / dt ; 2,1 m/s² au taux de l'élastique).
   */
  maxDecel: number;
  maxFactorDrop: number;
  /** Facteur appliqué maximal d'un copain (≤ 1,3). */
  maxFactor: number;
}

/**
 * Course de l'objectif (tâche 7, Step 5) : `fiveCarRace` de la graine (CONFIG), Galahad doigt posé (ou levé 30 %, motif
 * du rattrapage) avec le saut parfait aux fosses (modèle D7-1) ou la variante « sauteur » ; observateurs : écran,
 * freinage net, contacts, vitesses, facteurs.
 */
export function objectiveRace(seed: number, motif: Motif, jump: ObjectiveJump = 'parfait', cfg: Config = CONFIG): { row: ObjectiveRow; race: FiveCarRace } {
  let brake: BrakeWatch | null = null;
  const screen = new ScreenShare(cfg);
  const n = 5;
  const fSum = new Array<number>(n).fill(0);
  let fSteps = 0;
  let maxFactor = 0;
  let maxDecel = 0;
  const lastContact = new Array<number>(n).fill(-Infinity);
  let lastGContact = -Infinity;
  let contactEpisodes = 0;
  let contactSteps = 0;
  let vxAfterContact = 0;
  let vxDriven = 0;
  /** Par copain : vx des DECEL_WINDOW dernières secondes (anneau), et pas consécutifs à l'écran, au sol, hors contact. */
  const win = Math.round(DECEL_WINDOW / cfg.PHYSICS_DT);
  const vxRing = Array.from({ length: n }, () => new Array<number>(win).fill(0));
  const calm = new Array<number>(n).fill(0);
  let stepIndex = 0;
  const lastRespawn = new Array<number>(n).fill(-Infinity);
  const ids: string[] = [];
  const race = fiveCarRace(seed, {
    cfg, jump, ...(motif === 'levé' ? { throttle: liftedPattern(seed, LIFTED_P) } : {}),
    observe: (sim) => {
      brake ??= new BrakeWatch(sim, cfg);
      if (ids.length === 0) ids.push(...sim.cars.map((c) => c.state.id));
      brake.observe(sim);
      screen.observe(sim);
      const t = sim.time;
      const index = (id: string) => ids.indexOf(id);
      let gTouch = false;
      for (const [a, b] of carPairsTouching(sim)) {
        lastContact[index(a)] = t;
        lastContact[index(b)] = t;
        if (a === 'galahad' || b === 'galahad') gTouch = true;
      }
      if (gTouch) {
        contactSteps++;
        if (t - lastGContact > CONTACT_EPISODE_GAP) contactEpisodes++;
        lastGContact = t;
      }
      const g = sim.cars[GALAHAD_INDEX];
      const counting = t >= cfg.RUBBER_NEUTRAL_SECONDS && g.state.finishedAt === null;
      if (counting) fSteps++;
      for (const e of sim.events) if (e.type === 'respawn') lastRespawn[index(e.carId)] = t;
      sim.cars.forEach((car, i) => {
        if (i === GALAHAD_INDEX) return;
        const vx = toM(car.body.chassis.velocity.x) / cfg.PHYSICS_DT;
        if (t - lastContact[i] <= AFTER_CONTACT_SECONDS) vxAfterContact = Math.max(vxAfterContact, vx);
        else vxDriven = Math.max(vxDriven, vx);
        maxFactor = Math.max(maxFactor, car.speedFactor);
        if (counting) fSum[i] += car.speedFactor;
        const ring = vxRing[i];
        const old = ring[stepIndex % win];
        ring[stepIndex % win] = vx;
        const ok = car.onScreen && car.state.finishedAt === null && t - lastContact[i] > AFTER_CONTACT_SECONDS
          && t - lastRespawn[i] > AFTER_CONTACT_SECONDS;
        calm[i] = ok ? calm[i] + 1 : 0;
        // vx d'il y a DECEL_WINDOW s (win pas) : la case qu'on vient de remplacer ; fenêtre entière à l'écran et hors contact.
        if (calm[i] > win && car.grounded) maxDecel = Math.max(maxDecel, (old - vx) / DECEL_WINDOW);
      });
      stepIndex++;
    },
  });
  const { r } = race;
  const rid = Object.keys(r.respawnsByCar);
  const w = brake as BrakeWatch | null;
  const row: ObjectiveRow = {
    etape: 'objectif', commit: '', seed, motif, ids: rid, jump,
    winner: r.ranking[0],
    firstStar: race.firstStar?.carId ?? null,
    firstStarT: race.firstStar?.t ?? null,
    firstStarCars: race.firstStarCars,
    galahadPlace: r.ranking.indexOf('galahad') + 1,
    ranking: r.ranking,
    stars: rid.map((id) => race.stars[id]),
    lava: rid.map((id) => r.lavaByCar[id]),
    respawns: rid.map((id) => r.respawnsByCar[id].length),
    galahadFinishedAt: r.finishedAt,
    meanStepMs: r.meanStepMs,
    seconds: race.seconds,
    respawnsHorsFosses: rid.map((id) => respawnsHorsFosses(race, id)),
    maxSeries: Math.max(0, ...rid.map((id) => Math.max(0, ...lavaSeries(r.respawnsByCar[id], race.track)))),
    sansTentative: race.falls.filter(isSansTentative).length,
    meanFactor: fSum.slice(1).map((f) => f / Math.max(1, fSteps)),
    screenShare: screen.share,
    aheadShare: screen.aheadShare,
    contactEpisodes, contactSteps, vxAfterContact, vxDriven,
    brake: w?.count ?? 0, turboEnds: w?.turboEnds ?? 0, brakeEvents: w?.events ?? [],
    maxDecel,
    maxFactorDrop: (w?.maxDrop ?? 0) * cfg.V_MAX / cfg.PHYSICS_DT,
    maxFactor,
  };
  return { row, race };
}

const pc = (x: number): string => `${(100 * x).toFixed(0)} %`;
const short = (id: string | null): string => (id === null ? '—' : id === 'galahad' ? 'G' : id);

/** Une ligne du tableau de l'objectif (par graine). */
export function describeObjective(o: ObjectiveRow): string {
  const percar = o.ids.map((id, i) => `${short(id)} ${o.stars[i]}/${o.respawns[i]}`).join(', ');
  return `${o.motif}${o.jump === 'sauteur' ? ' sauteur' : ''} g${String(o.seed).padStart(2)} : Galahad ${o.galahadPlace}e (${f1(o.galahadFinishedAt)} s), `
    + `vainqueur ${short(o.winner)}, 1re étoile ${o.firstStarCars.map(short).join('+') || '—'} (${f1(o.firstStarT)} s) | `
    + `étoiles/réapparitions ${percar} | facteur moyen des copains ${o.meanFactor.map(f2).join('/')} | `
    + `copain à l'écran ${pc(o.screenShare)} (devant ${pc(o.aheadShare)}) | contacts Galahad–copain ${o.contactEpisodes} (${o.contactSteps} pas) | `
    + `vx max d'un copain après contact ${f1(o.vxAfterContact)} m/s, en conduite ${f1(o.vxDriven)} m/s, facteur max ${f2(o.maxFactor)} | `
    + `freinage net à l'écran ${o.brake} (fins de turbo à l'écran ${o.turboEnds}), décélération max hors contact ${f1(o.maxDecel)} m/s², `
    + `baisse de facteur max à l'écran ${f2(o.maxFactorDrop)} m/s² éq.`;
}

/**
 * Exigences de chaque course (Step 5, les deux fichiers) : ≤ 3 réapparitions par copain hors chutes dans une fosse, au
 * plus 2 chutes par série, arrivée de Galahad avant 240 s, 0 chute « sans tentative », 0 freinage net à l'écran.
 */
export function expectObjectiveRace(o: ObjectiveRow, summary: string): void {
  o.ids.forEach((id, i) => {
    if (id !== 'galahad') expect(o.respawnsHorsFosses[i], `${id} : ${summary}`).toBeLessThanOrEqual(3);
  });
  expect(o.maxSeries, summary).toBeLessThanOrEqual(2);
  expect(o.galahadFinishedAt, summary).not.toBeNull();
  expect(o.galahadFinishedAt!, summary).toBeLessThan(RACE_MAX_SECONDS);
  expect(o.sansTentative, summary).toBe(0);
  expect(o.brake, `${summary}\n  ${o.brakeEvents.join(' ; ')}`).toBe(0);
}

/** Cibles de l'objectif (décision D7-4 du papa) sur les courses du modèle D7-1. */
export const OBJECTIVE_TARGETS = { top2Min: 10, lastMax: 2, winsMin: 5, winsMax: 15, screenMin: 0.3 } as const;

/** Résumé d'un ensemble de courses : places (placeStats), part moyenne « copain à l'écran » (min–max), facteurs, contacts. */
export function describeTotals(label: string, rows: readonly ObjectiveRow[]): string {
  const p = placeStats(rows);
  const vis = rows.map((o) => o.screenShare);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  return `${label}, ${p.n} courses : Galahad 1er ${p.wins}, 1er ou 2e ${p.top2}, dernier ${p.last}, place moyenne ${p.mean.toFixed(2)} ; `
    + `copain à l'écran ${pc(mean(vis))} en moyenne (${pc(Math.min(...vis))} à ${pc(Math.max(...vis))}), devant ${pc(mean(rows.map((o) => o.aheadShare)))} ; `
    + `facteur moyen des copains ${f2(mean(rows.flatMap((o) => o.meanFactor)))} ; contacts Galahad–copain ${rows.reduce((a, o) => a + o.contactEpisodes, 0)} ; `
    + `vx max d'un copain après contact ${f1(Math.max(...rows.map((o) => o.vxAfterContact)))} m/s, en conduite ${f1(Math.max(...rows.map((o) => o.vxDriven)))} m/s ; `
    + `facteur max ${f2(Math.max(...rows.map((o) => o.maxFactor)))} ; freinage net à l'écran ${rows.reduce((a, o) => a + o.brake, 0)} ; `
    + `décélération max hors contact ${f1(Math.max(...rows.map((o) => o.maxDecel)))} m/s² ; `
    + `réapparitions de copain hors fosses max ${Math.max(...rows.flatMap((o) => o.respawnsHorsFosses.slice(1)))}`;
}

/** Accès à node (le projet n'a pas @types/node), au strict nécessaire. */
interface NodeFs { mkdirSync(path: string, opts: { recursive: boolean }): void; writeFileSync(path: string, data: string): void }
const nodeFs = (): NodeFs => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }).process.getBuiltinModule('node:fs');

/** Écrit les lignes de l'objectif dans tests/slow/out/<nom>.json (ignoré par git), pour le rapport et la comparaison au rattrapage. */
export function writeObjective(name: string, rows: readonly ObjectiveRow[]): void {
  nodeFs().mkdirSync('tests/slow/out', { recursive: true });
  nodeFs().writeFileSync(`tests/slow/out/${name}.json`, JSON.stringify(rows));
}
