// Conduite des robots (plan B, tâche 6 ; spec §7, addendum §1.8 et §2, addendum « bouton saut » §3 et §6.8) : le
// driver de chaque copain décide, à chaque pas, de son doigt (gaz) et de sa demande de saut. Pur (ni DOM, ni
// matter-js) : `sim/simulate.ts` lui passe un `DriverContext` et applique sa réponse.
import { inFosseJumpWindow, inRockJumpWindow } from '../cars/jump';
import type { Pilot } from '../cars/pilots';
import type { CarState } from '../cars/state';
import type { Config } from '../config';
import { fosses, inNoJumpZone, inVolcanoZone, sliceAt } from '../track/query';
import { mulberry32 } from '../track/rng';
import type { Track } from '../track/types';

/** Une autre voiture, vue par un driver au début du pas. */
export interface OtherCar {
  /** Index dans `sim.cars`. */
  index: number;
  /** x du châssis (m) et vitesse du châssis (m/s). */
  x: number;
  speed: number;
  /** Doigt posé au pas précédent (décision de son driver, ou de l'enfant) : une voiture qui démarre n'est pas arrêtée. */
  throttle: boolean;
  /** Fantôme ou invulnérable : les voitures se traversent, elle ne bloque personne. */
  traversable: boolean;
  /** C'est Galahad (tâche 7, tour 1 : un copain juste derrière lui lève le pied quand il lève le doigt). */
  galahad: boolean;
  /** Arrivée (elle freine après la ligne) : son doigt (`throttle`) est alors forcé à faux, ce n'est plus celui de l'enfant. */
  finished: boolean;
  /**
   * Partie : doigt posé à un pas précédent (`CarSim.started`). Galahad pas encore parti (sur la grille, avant son premier
   * appui) : pas de politesse derrière lui doigt levé, seulement la politesse ordinaire (tour 2 de la tâche 7).
   */
  started: boolean;
}

/** Ce que voit un driver au début d'un pas (avant le pas physique). Rempli par `stepRace`, réutilisé d'un pas à l'autre. */
export interface DriverContext {
  /** Temps de course (s). */
  t: number;
  state: CarState;
  track: Track;
  /** Vitesse du châssis (m/s) et x du châssis (m). */
  speed: number;
  x: number;
  /** Cette voiture est fantôme ou invulnérable : elle traverse les autres, aucune ne la bloque. */
  traversable: boolean;
  /** Autres voitures, dans l'ordre des index (index = celui de sim.cars). */
  others: readonly OtherCar[];
  /** Étoile haute la plus proche devant, à moins de JUMP_LOOKAHEAD (40 m), avec sa disponibilité pour CETTE voiture ; null sinon. */
  nextHighStar: { index: number; x: number; available: boolean } | null;
  /**
   * Prochaine fosse devant, à moins de JUMP_LOOKAHEAD : bord amont, rang parmi les fosses de la piste, tentative (2 si la
   * voiture est déjà tombée dans cette fosse, 1 sinon) ; null sinon.
   */
  nextFosse: { xBord: number; index: number; attempt: 1 | 2 } | null;
  /**
   * Prochain rocher devant (tâche 11c), à moins de JUMP_LOOKAHEAD, encore actif pour CETTE voiture (jamais touché par
   * elle) : xStart et rang dans `track.rocks` ; null sinon.
   */
  nextRock: { xStart: number; index: number } | null;
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
  /** Par rocher (ordre de la piste, tâche 11c) : erreur (s) sur l'instant du saut, N(0, FOSSE_SKILL_FACTOR × jumpSkill). */
  rockErr: number[];
  /** Par rampe-saut ou double-bosse (ordre de la piste) : lève-t-il le pied avant elle ? */
  lift: boolean[];
}

/**
 * Tirages du driver du copain `pilot`, de rang `rank`, sur `track` (`seed` = graine des pilotes), sur la graine du
 * driver, dans cet ordre : pour chaque étoile haute (ordre de la piste) « tente-t-il ? » (`rng() < jumpTry`) puis son
 * erreur (Box-Muller) ; pour chaque fosse, deux erreurs, une par tentative ; pour chaque rocher (tâche 11c, spec
 * « rochers » §4), une erreur ; pour chaque rampe-saut et double-bosse, « lève-t-il le pied ? » (`rng() < lift`). Les
 * erreurs des rochers viennent après celles des fosses et avant les levers de pied : sans rocher (ROCKS_PER_RACE 0),
 * aucun tirage de plus.
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
  const fosseErr = fosses(track)
    .map((): [number, number] => [normal(rng) * cfg.FOSSE_SKILL_FACTOR * pilot.jumpSkill, normal(rng) * cfg.FOSSE_SKILL_FACTOR * pilot.jumpSkill]);
  const rockErr = track.rocks.map(() => normal(rng) * cfg.FOSSE_SKILL_FACTOR * pilot.jumpSkill);
  const lift = track.slices.filter(isLiftSlice).map(() => rng() < pilot.lift);
  return { starTry, starErr, fosseErr, rockErr, lift };
}

/**
 * Driver du copain `pilot`, de rang `rank` sur la grille, sur `track` ; `seed` = graine des pilotes (`sim.pilotSeed`),
 * d'où la graine du driver (`driverSeed`). Tous les tirages sont faits à la création (`robotDraws`). Règles, par ordre
 * de priorité (plan B, tâche 6) :
 * 1. après l'arrivée, `stepRace` n'appelle plus le driver (la voiture freine) ;
 * 2. délai de départ : ni gaz ni saut tant que t < rank × START_DELAY_PER_RANK ;
 * 3. zone volcan [xLancement, xLava] (tremplin ou fosse) : doigt posé, jamais de lever de pied ni de politesse ;
 * 4. robots polis (décision du papa, tour 1 de la tâche 6 : seulement derrière une voiture vraiment arrêtée) : une
 *    voiture devant, à une distance de châssis à châssis dans (0, POLITE_GAP], plus lente que POLITE_SPEED, doigt levé
 *    (une voiture qui démarre ne compte pas), et qu'on ne traverserait pas (ni elle ni lui fantôme ou invulnérable),
 *    fait lever le pied. L'attente se cumule derrière la même voiture : au bout de POLITE_MAX_WAIT, le robot repart et la
 *    pousse ; elle ne revient à zéro que quand cette voiture repart d'elle-même (doigt posé), qu'une autre voiture
 *    bloque, ou à une réapparition (une poussée qui la fait dépasser POLITE_SPEED ne relance pas l'attente) ;
 *    poli aussi derrière Galahad doigt levé (décision du papa, relectures de la tâche 7) : Galahad parti (doigt posé au
 *    moins une fois, tour 2), devant, à une distance de châssis à châssis dans (0, POLITE_GAP], doigt levé au pas
 *    précédent, pas arrivé, et qu'on ne traverserait pas (ni lui ni le copain fantôme ou invulnérable), fait lever le
 *    pied quelle que soit sa vitesse, sans limite de durée : le copain attend tant que Galahad lève le doigt (un copain
 *    ramené juste derrière lui par l'élastique le poussait longtemps à faible vitesse relative, jusqu'à le coucher) ; sur
 *    la grille, avant le premier appui de Galahad, seule la politesse ordinaire joue (3 s au plus, comme à la tâche 6) ;
 * 5. lever de pied : au premier pas dans les LIFT_LOOKAHEAD m avant une rampe-saut ou une double-bosse, si le tirage de
 *    cette tranche est tombé, doigt levé LIFT_SECONDS (une fois par tranche ; jamais dans un cratère) ;
 * 6. sinon, doigt posé.
 * Sauts, en plus du doigt :
 * - fosse (toujours tentée, sans tirage `jumpTry`) : `inFosseJumpWindow` sur la fosse du contexte (`ctx.nextFosse`),
 *   avec l'erreur de la tentative (sur l'approche, bord à au plus fosseJumpLead(v) + e secondes ; une erreur trop
 *   tardive, plus tard que le bord au plus tard CALCULÉ, devient un saut trop tôt du même écart, à fosseJumpLead(v) − e :
 *   décision du papa au tour 2, le raté se voit) ;
 *   redemandée à chaque pas jusqu'au saut, puis plus aucune jusqu'à la tentative suivante (une réapparition) ;
 * - rocher (tâche 11c, spec « rochers » §4 ; toujours tenté, sans tirage `jumpTry`) : le rocher du contexte
 *   (`ctx.nextRock`, encore actif pour cette voiture), hors `inNoJumpZone`, `inRockJumpWindow` avec l'erreur pré-tirée
 *   de ce rocher (pas de bascule) ; redemandé à chaque pas jusqu'au saut, une seule tentative par rocher et par
 *   réapparition (après un choc, il n'est plus actif) ; après la fosse, avant l'étoile haute ;
 * - étoile haute disponible et tentée : demande tant que JUMP_STAR_MIN_LEAD ≤ (xÉtoile − x) / max(v, 1) ≤
 *   JUMP_STAR_LEAD + erreur, redemandée à chaque pas jusqu'au saut ; abandonnée sous JUMP_STAR_MIN_LEAD (un saut plus
 *   tardif passe sous l'étoile, par exemple après un survol en turbo) ; après une réapparition, la même décision est
 *   rejouée ;
 * - jamais dans [xLancement, xReception] d'un tremplin (`inNoJumpZone`), ni de saut d'étoile dans une tranche fosse.
 * Une « tentative » change à chaque réapparition (`CarState.respawnCount`) : un saut fait pour une cible ne bloque que
 * la tentative où il a été demandé.
 */
export function makeRobotDriver(pilot: Pilot, rank: number, track: Track, seed: number, cfg: Config): Driver {
  const { starTry, starErr, fosseErr, rockErr, lift: liftDraw } = robotDraws(pilot, rank, track, seed, cfg);
  const fosseList = fosses(track);
  const liftSlices = track.slices.filter(isLiftSlice);
  const liftUsed = liftSlices.map(() => false);
  /** Tentative (`respawnCount`) où la cible a été sautée ; −1 : jamais. */
  const starDone = track.stars.map(() => -1);
  const fosseDone = fosseList.map(() => -1);
  const rockDone = track.rocks.map(() => -1);

  const startAt = rank * cfg.START_DELAY_PER_RANK;
  let liftUntil = -Infinity;
  /** Politesse : voiture attendue, attente cumulée derrière elle (s, un PHYSICS_DT par appel bloqué), tentative de l'attente. */
  let waitTarget = -1;
  let waited = 0;
  let waitEpoch = 0;
  /** Dernière demande de saut : cible (0 aucune, 1 étoile, 2 fosse, 3 rocher), son indice, sa tentative. Sans allocation. */
  let pendingKind = 0;
  let pendingIndex = -1;
  let pendingEpoch = -1;
  let seenJumpAt: number | null = null;

  const request = (kind: number, index: number, epoch: number): boolean => {
    pendingKind = kind;
    pendingIndex = index;
    pendingEpoch = epoch;
    return true;
  };

  /** Demande de saut du pas, ou false ; note la cible demandée. */
  function wantJump(ctx: DriverContext, epoch: number): boolean {
    const { x, speed, nextFosse, nextHighStar, nextRock } = ctx;
    if (nextFosse) {
      const k = nextFosse.index;
      if (x >= fosseList[k].xLancement) {
        if (fosseDone[k] === epoch) return false;
        // Fosse du contexte (bord amont, rang, tentative) : une seule source, une seule formule de fenêtre (tour 3).
        return inFosseJumpWindow(nextFosse.xBord, x, speed, cfg, fosseErr[k][nextFosse.attempt - 1]) && request(2, k, epoch);
      }
    }
    // Rocher (tâche 11c) : après la fosse, avant l'étoile haute ; jamais dans [xLancement, xReception] d'un tremplin.
    if (nextRock && rockDone[nextRock.index] !== epoch && !inNoJumpZone(track, x)
      && inRockJumpWindow(nextRock.xStart, x, speed, cfg, rockErr[nextRock.index])) {
      return request(3, nextRock.index, epoch);
    }
    const s = nextHighStar;
    if (!s || !s.available || !starTry[s.index] || starDone[s.index] === epoch) return false;
    if (sliceAt(track, x).type === 'fosse' || inNoJumpZone(track, x)) return false;
    const tte = (s.x - x) / Math.max(speed, 1);
    if (tte > cfg.JUMP_STAR_LEAD + starErr[s.index] + EPS || tte < cfg.JUMP_STAR_MIN_LEAD - EPS) return false;
    return request(1, s.index, epoch);
  }

  /**
   * Galahad parti (premier appui fait), juste devant, doigt levé au pas précédent, pas arrivé, qu'on ne traverserait pas
   * (règle 4, tâche 7) : le copain lève le pied tant que dure ce doigt levé, sans limite de durée.
   */
  function behindGalahadLifted(ctx: DriverContext): boolean {
    if (ctx.traversable) return false;
    for (const o of ctx.others) {
      if (!o.galahad) continue;
      const gap = o.x - ctx.x;
      return o.started && gap > 0 && gap <= cfg.POLITE_GAP && !o.throttle && !o.finished && !o.traversable;
    }
    return false;
  }

  /** Voiture devant qui fait lever le pied (la plus proche), ou −1. */
  function blockerOf(ctx: DriverContext): number {
    if (ctx.traversable) return -1;
    let blocker = -1;
    let gapMin = Infinity;
    for (const o of ctx.others) {
      const gap = o.x - ctx.x;
      if (gap > 0 && gap <= cfg.POLITE_GAP && gap < gapMin && o.speed < cfg.POLITE_SPEED && !o.throttle && !o.traversable) {
        gapMin = gap;
        blocker = o.index;
      }
    }
    return blocker;
  }

  return (ctx) => {
    const { t, state, x } = ctx;
    const epoch = state.respawnCount;
    // Un saut a eu lieu depuis le pas précédent : il sert la dernière cible demandée, dans la tentative de la demande.
    if (state.lastJumpAt !== seenJumpAt) {
      seenJumpAt = state.lastJumpAt;
      if (pendingKind !== 0 && state.lastJumpAt !== null) {
        if (pendingKind === 2) fosseDone[pendingIndex] = pendingEpoch;
        else if (pendingKind === 3) rockDone[pendingIndex] = pendingEpoch;
        else starDone[pendingIndex] = pendingEpoch;
      }
      pendingKind = 0;
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
    // Attente polie : remise à zéro à une réapparition, ou quand la voiture attendue repart d'elle-même.
    if (epoch !== waitEpoch) {
      waitEpoch = epoch;
      waitTarget = -1;
    }
    for (const o of ctx.others) if (o.index === waitTarget && o.throttle) waitTarget = -1;
    // Zone volcan [xLancement, xLava] (tremplin ou fosse) : doigt posé (track/query.ts, tâche 7 : définition partagée).
    if (inVolcanoZone(track, x)) return out(true, jump);
    if (behindGalahadLifted(ctx)) return out(false, jump);
    const blocker = blockerOf(ctx);
    if (blocker >= 0) {
      if (blocker !== waitTarget) {
        waitTarget = blocker;
        waited = 0;
      }
      if (waited < cfg.POLITE_MAX_WAIT - EPS) {
        waited += cfg.PHYSICS_DT;
        return out(false, jump);
      }
    }
    if (t < liftUntil - EPS && sliceAt(track, x).type !== 'cratère') return out(false, jump);
    return out(true, jump);
  };
}
