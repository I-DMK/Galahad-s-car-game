// Conduite des robots (plan B, tâche 6 ; spec §7, addendum §1.8 et §2, addendum « bouton saut » §3 et §6.8) : le
// driver de chaque copain décide, à chaque pas, de son doigt (gaz) et de sa demande de saut. Pur (ni DOM, ni
// matter-js) : `sim/simulate.ts` lui passe un `DriverContext` et applique sa réponse.
import { fosseJumpLead } from '../cars/jump';
import type { Pilot } from '../cars/pilots';
import type { CarState } from '../cars/state';
import type { Config } from '../config';
import { inNoJumpZone, sliceAt } from '../track/query';
import { mulberry32 } from '../track/rng';
import type { Fosse, Track } from '../track/types';

/** Ce que voit un driver au début d'un pas (avant le pas physique). Rempli par `stepRace`, réutilisé d'un pas à l'autre. */
export interface DriverContext {
  /** Temps de course (s). */
  t: number;
  state: CarState;
  track: Track;
  /** Vitesse du châssis (m/s) et x du châssis (m). */
  speed: number;
  x: number;
  /** Une roue au moins sur la piste au pas précédent (contact débouncé, `CarSim.grounded`). */
  grounded: boolean;
  /** Autres voitures, dans l'ordre des index (index = celui de sim.cars). */
  others: readonly { index: number; x: number; speed: number }[];
  /** Étoile haute la plus proche devant, à moins de JUMP_LOOKAHEAD (40 m), avec sa disponibilité pour CETTE voiture ; null sinon. */
  nextHighStar: { index: number; x: number; available: boolean } | null;
  /** Prochaine fosse devant, à moins de JUMP_LOOKAHEAD : bord amont, rang dans la piste, tentative (2 après une chute dans cette fosse, 1 sinon) ; null sinon. */
  nextFosse: { xBord: number; index: number; attempt: 1 | 2 } | null;
}

/** Réponse d'un driver : doigt posé, et demande de saut (filtrée par `wantsJump`, `canJump` et la garde de `stepRace`). */
export interface DriverOutput { readonly throttle: boolean; readonly jump: boolean }
export type Driver = (ctx: DriverContext) => DriverOutput;

/** Les 4 réponses possibles, figées et partagées : un driver n'alloue rien par pas. */
const OUT: readonly [readonly [DriverOutput, DriverOutput], readonly [DriverOutput, DriverOutput]] = [
  [Object.freeze({ throttle: false, jump: false }), Object.freeze({ throttle: false, jump: true })],
  [Object.freeze({ throttle: true, jump: false }), Object.freeze({ throttle: true, jump: true })],
];
const out = (throttle: boolean, jump: boolean): DriverOutput => OUT[throttle ? 1 : 0][jump ? 1 : 0];

/** Tolérance (s) des comparaisons de temps : `sim.time` est une somme de PHYSICS_DT. */
const EPS = 1e-9;

/** Graine du driver du copain de rang `rank` : `(pilotSeed + rank × 0x9e3779b9) >>> 0` (ENCORE rejoue les mêmes décisions). */
export const driverSeed = (pilotSeed: number, rank: number): number => (pilotSeed + rank * 0x9e3779b9) >>> 0;

/** Loi normale centrée réduite, Box-Muller sur deux tirages de `rng` (le second sert l'angle). */
function normal(rng: () => number): number {
  const u1 = 1 - rng(); // ]0 ; 1] : log fini
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Cible de la dernière demande de saut : étoile haute ou fosse (indices), et tentative (`respawnCount`) de la demande. */
interface Pending { kind: 'star' | 'fosse'; index: number; epoch: number }

/** Tranche devant laquelle un copain peut lever le pied : rampe-saut ou double-bosse. */
const isLiftSlice = (s: { type: string }): boolean => s.type === 'rampe-saut' || s.type === 'double-bosse';

/** Tirages d'un driver, faits une fois à sa création (ENCORE les rejoue). */
export interface RobotDraws {
  /** Par indice dans `track.stars` : tente-t-il cette étoile haute ? (false pour une étoile basse). */
  starTry: boolean[];
  /** Par indice dans `track.stars` : erreur (s) sur l'instant du saut, N(0, jumpSkill) (0 pour une étoile basse). */
  starErr: number[];
  /** Par fosse (ordre de la piste) : erreurs (s) des tentatives 1 et 2, N(0, FOSSE_SKILL_FACTOR × jumpSkill). */
  fosseErr: [number, number][];
  /** Par rampe-saut ou double-bosse (ordre de la piste) : lève-t-il le pied avant elle ? */
  lift: boolean[];
}

/**
 * Tirages du driver du copain `pilot`, de rang `rank`, sur `track` (`seed` = graine des pilotes), sur la graine du
 * driver, dans cet ordre : pour chaque étoile haute (ordre de la piste) « tente-t-il ? » (`rng() < jumpTry`) puis son
 * erreur (Box-Muller) ; pour chaque fosse, deux erreurs, une par tentative ; pour chaque rampe-saut et double-bosse,
 * « lève-t-il le pied ? » (`rng() < lift`).
 */
export function robotDraws(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): RobotDraws {
  const rng = mulberry32(driverSeed(seed, rank));
  const starTry = track.stars.map(() => false);
  const starErr = track.stars.map(() => 0);
  track.stars.forEach((s, k) => {
    if (!s.high) return;
    starTry[k] = rng() < pilot.jumpTry;
    starErr[k] = normal(rng) * pilot.jumpSkill;
  });
  const fosseErr = track.volcanoes.filter((v) => v.kind === 'fosse')
    .map((): [number, number] => [normal(rng) * cfg.FOSSE_SKILL_FACTOR * pilot.jumpSkill, normal(rng) * cfg.FOSSE_SKILL_FACTOR * pilot.jumpSkill]);
  const lift = track.slices.filter(isLiftSlice).map(() => rng() < pilot.lift);
  return { starTry, starErr, fosseErr, lift };
}

/**
 * Driver du copain `pilot`, de rang `rank` sur la grille, sur `track` ; `seed` = graine des pilotes (`sim.pilotSeed`),
 * d'où la graine du driver (`driverSeed`). Tous les tirages sont faits à la création (`robotDraws`). Règles, par ordre
 * de priorité (plan B, tâche 6) :
 * 1. après l'arrivée, `stepRace` n'appelle plus le driver (la voiture freine) ;
 * 2. délai de départ : ni gaz ni saut tant que t < rank × START_DELAY_PER_RANK ;
 * 3. zone volcan [xLancement, xLava] (tremplin ou fosse) : doigt posé, jamais de lever de pied ni de politesse ;
 * 4. robots polis : une voiture plus lente que POLITE_SPEED, devant à une distance de châssis à châssis dans
 *    (0, POLITE_GAP], fait lever le pied ; après POLITE_MAX_WAIT d'attente continue derrière la même voiture, le robot
 *    repart ; l'attente revient à zéro quand la voiture de devant repart (ou s'éloigne) ;
 * 5. lever de pied : au premier pas dans les LIFT_LOOKAHEAD m avant une rampe-saut ou une double-bosse, si le tirage de
 *    cette tranche est tombé, doigt levé LIFT_SECONDS (une fois par tranche ; jamais dans un cratère) ;
 * 6. sinon, doigt posé.
 * Sauts, en plus du doigt :
 * - fosse (toujours tentée, sans tirage `jumpTry`) : sur l'approche [xLancement, xBord[, demande dès que
 *   (xBord − x) / max(v, 1) ≤ fosseJumpLead(v) + e (e : erreur de la tentative), et tant que la mémoire de la demande
 *   (JUMP_BUFFER) ne l'emmène pas au-delà du bord ; redemandée à chaque pas jusqu'au saut, puis plus aucune jusqu'à la
 *   tentative suivante (une réapparition) ;
 * - étoile haute disponible et tentée : demande dès que (xÉtoile − x) / max(v, 1) ≤ JUMP_STAR_LEAD + erreur, redemandée
 *   à chaque pas jusqu'au saut ou au passage de l'étoile ; après une réapparition, la même décision est rejouée ;
 * - jamais dans [xLancement, xReception] d'un tremplin (`inNoJumpZone`), ni de saut d'étoile dans une tranche fosse.
 * Une « tentative » change à chaque réapparition (`CarState.respawnCount`) : un saut fait pour une cible ne bloque que
 * la tentative où il a été demandé.
 */
export function makeRobotDriver(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): Driver {
  const { starTry, starErr, fosseErr, lift: liftDraw } = robotDraws(pilot, rank, track, seed, cfg);
  const fosseList = track.volcanoes.filter((v): v is Fosse => v.kind === 'fosse');
  const liftSlices = track.slices.filter(isLiftSlice);
  const liftUsed = liftSlices.map(() => false);
  /** Tentative (`respawnCount`) où la cible a été sautée ; −1 : jamais. */
  const starDone = new Map<number, number>();
  const fosseDone = fosseList.map(() => -1);

  const startAt = rank * cfg.START_DELAY_PER_RANK;
  let liftUntil = -Infinity;
  let politeTarget: number | null = null;
  let politeSince = 0;
  let pending: Pending | null = null;
  let seenJumpAt: number | null = null;

  /** Zone volcan [xLancement, xLava] (tremplin ou fosse) ? Sans allocation. */
  const inVolcanoZone = (x: number): boolean => {
    for (const v of track.volcanoes) if (x >= v.xLancement && x <= v.xLava) return true;
    return false;
  };

  /** Demande de saut du pas, ou false ; note la cible demandée (`pending`). */
  function wantJump(ctx: DriverContext, epoch: number): boolean {
    const { x, speed, nextFosse, nextHighStar } = ctx;
    const v = Math.max(speed, 1);
    if (nextFosse) {
      const f = fosseList[nextFosse.index];
      if (f && x >= f.xLancement) {
        if (fosseDone[nextFosse.index] === epoch) return false;
        const tte = (f.xBord - x) / v;
        const e = fosseErr[nextFosse.index][nextFosse.attempt - 1];
        if (tte <= fosseJumpLead(speed, cfg) + e + EPS && tte > cfg.JUMP_BUFFER + EPS) {
          pending = { kind: 'fosse', index: nextFosse.index, epoch };
          return true;
        }
        return false;
      }
    }
    const s = nextHighStar;
    if (!s || !s.available || !starTry[s.index] || starDone.get(s.index) === epoch) return false;
    if (sliceAt(track, x).type === 'fosse' || inNoJumpZone(track, x)) return false;
    if ((s.x - x) / v > cfg.JUMP_STAR_LEAD + starErr[s.index] + EPS) return false;
    pending = { kind: 'star', index: s.index, epoch };
    return true;
  }

  return (ctx) => {
    const { t, state, x } = ctx;
    const epoch = state.respawnCount;
    // Un saut a eu lieu depuis le pas précédent : il sert la dernière cible demandée, dans la tentative de la demande.
    if (state.lastJumpAt !== seenJumpAt) {
      seenJumpAt = state.lastJumpAt;
      if (pending && state.lastJumpAt !== null) {
        if (pending.kind === 'fosse') fosseDone[pending.index] = pending.epoch;
        else starDone.set(pending.index, pending.epoch);
      }
      pending = null;
    }
    if (t < startAt) return out(false, false);
    // Lever de pied : tirage de la tranche consommé au premier pas dans les LIFT_LOOKAHEAD m qui la précèdent.
    for (let k = 0; k < liftSlices.length; k++) {
      const xs = liftSlices[k].xStart;
      if (!liftUsed[k] && x >= xs - cfg.LIFT_LOOKAHEAD && x < xs) {
        liftUsed[k] = true;
        if (liftDraw[k]) liftUntil = t + cfg.LIFT_SECONDS;
      }
    }
    const jump = wantJump(ctx, epoch);
    if (inVolcanoZone(x)) {
      politeTarget = null;
      return out(true, jump);
    }
    // Robots polis : la voiture la plus proche devant, lente, à moins de POLITE_GAP.
    let blocker = -1;
    let gapMin = Infinity;
    for (const o of ctx.others) {
      const gap = o.x - x;
      if (gap > 0 && gap <= cfg.POLITE_GAP && o.speed < cfg.POLITE_SPEED && gap < gapMin) {
        gapMin = gap;
        blocker = o.index;
      }
    }
    if (blocker < 0) {
      politeTarget = null;
    } else {
      if (politeTarget !== blocker) {
        politeTarget = blocker;
        politeSince = t;
      }
      if (t - politeSince < cfg.POLITE_MAX_WAIT - EPS) return out(false, jump);
    }
    if (t < liftUntil - EPS && sliceAt(track, x).type !== 'cratère') return out(false, jump);
    return out(true, jump);
  };
}
