// Course complète à 5 voitures (tâche 5b, addendum §2) : Galahad doigt toujours posé, les 4 copains à leur
// driver (tâche 6 : départ échelonné, lever de pied, robots polis, sauts d'étoile et de fosse), arrêt à l'arrivée de
// Galahad + 1,5 s.
// Invariants partagés par la CI (tests/race-smoke.test.ts, graines 1 et 2) et la suite lente
// (tests/slow/race-invariants-*.test.ts). `lavaByCar.galahad === 0` date de la tâche 5b (tour de
// correction 1 : CI graines 1 et 2, lent graines 0 à 9) ; la tâche 5c a élargi la suite lente aux
// graines 0 à 23 (quatre fichiers parallèles), classé la cause de chaque chute dans la lave et ajouté
// « aucune chute propre, toutes voitures ». Tâche 5g (décision P9, rulings R-F9 et R-F11) : Galahad court par défaut
// avec le saut parfait aux fosses (`sauteurParfait`, `lavaByCar.galahad === 0` garde son sens), les copains provisoires
// y sautent sans erreur ; une chute dans une fosse sans saut est « fosse » (attendue), ni « choc » ni « propre » ;
// `race-sans-saut-*` fait courir Galahad sans saut (2 chutes par fosse, au plus 2 par série, 0 au tremplin).
// Tâche 6 : les copains ratent parfois une fosse (erreur × FOSSE_SKILL_FACTOR, décision Q-F3) : une chute d'un copain
// dans une fosse après son saut est « fosse » (attendue), au plus 2 par série ; sans saut, « choc » ou « sans-tentative »
// (aucune tolérée depuis le tour 2) ; ≤ 3 réapparitions par copain hors chutes dans une fosse (saut §6.8) ; aucun saut de
// copain dans [xLancement, xReception] d'un tremplin.
import { CONFIG, type Config } from '../../src/config';
import { carSpeedMps } from '../../src/physics/car';
import { carPairsTouching, simulateRace, type SimulateResult } from '../../src/sim/harness';
import { makeRobotDriver, type Driver } from '../../src/ai/driver';
import { GALAHAD, type Pilot } from '../../src/cars/pilots';
import { driverContext, GALAHAD_INDEX, type RaceSim, type RespawnEvent } from '../../src/sim/simulate';
import { inNoJumpZone, nearestVolcanoZone, volcanoAhead } from '../../src/track/query';
import type { Track } from '../../src/track/types';
import { sauteurParfait } from './fosses';
import { describeRespawns, f1, f2, trackFor } from './runs';

/** Arrivée de Galahad exigée avant 240 s (addendum §2). */
export const RACE_MAX_SECONDS = 240;
/** Limite du spec : au plus 3 réapparitions par voiture et par course. */
export const MAX_RESPAWNS_PER_CAR = 3;
/**
 * « Bloqué > 2 s » : le chronomètre de blocage déclenche sa réapparition au premier pas où le blocage
 * dépasse STUCK_SECONDS (2 s) ; la mesure de `simulateRace` peut donc lire 2 s + 1 pas. Même tolérance
 * que les courses à une voiture (cas 6 et 7).
 */
export const MAX_STUCK_SECONDS = 2.1;

/**
 * Une chute dans la lave (toute voiture) et sa cause :
 * - Galahad dans une fosse sans avoir sauté depuis le début de son approche : « fosse » (attendue sans saut, ruling
 *   R-F11) ;
 * - copain dans une fosse après son saut (tâche 6 : il rate parfois, décision Q-F3) : « fosse » (attendue) ; sans saut :
 *   « choc » après un contact récent (poussé dans la lave), sinon « sans-tentative » (le copain n'a pas sauté : jamais
 *   attendu depuis le tour 2 de la tâche 6, voir `expectRaceInvariants`) ;
 * - sinon « choc » si la voiture a touché une autre voiture dans les CONTACT_WINDOW secondes qui précèdent (approche du
 *   volcan : plat de lancement, élan, rampe, vol ; dans la zone fantôme les voitures se traversent), « propre » sinon.
 * Une chute propre contredit la promesse « doigt posé depuis le plat de lancement, on ne tombe jamais » (tremplin), ou
 * « un saut au centre de la fenêtre passe » (fosse).
 */
export interface Fall {
  carId: string; t: number; x: number;
  /** Indice du volcan dans `track.volcanoes`. */
  volcano: number;
  /** Sorte du volcan (tâche 5g). */
  kind: 'tremplin' | 'fosse' | '?';
  cause: 'choc' | 'propre' | 'fosse' | 'sans-tentative';
  /** Vitesse du châssis (m/s) au pas qui précède la chute. */
  speed: number;
  /** Dernier contact avec une autre voiture avant la chute, null si aucun depuis le départ. */
  lastContact: { t: number; with: string } | null;
  /**
   * s entre le saut fait sur l'approche de ce volcan et la reprise par la lave (vol du raté : décision du papa au tour 2
   * de la tâche 6, le raté se voit) ; null sans saut.
   */
  flight: number | null;
}

/**
 * Cause d'une chute dans la lave (voir `Fall`) : sorte du volcan, voiture (copain ou Galahad), saut fait sur
 * l'approche, contact avec une autre voiture dans les CONTACT_WINDOW s qui précèdent. Exportée pour être testée en
 * table (tests/race-smoke.test.ts).
 */
export function fallCause(o: { kind: Fall['kind']; robot: boolean; jumped: boolean; shock: boolean }): Fall['cause'] {
  const { kind, robot, jumped, shock } = o;
  return kind !== 'fosse' ? (shock ? 'choc' : 'propre')
    : !robot ? (!jumped ? 'fosse' : shock ? 'choc' : 'propre')
    : jumped ? 'fosse' : shock ? 'choc' : 'sans-tentative';
}

/**
 * Chutes « sans-tentative » tolérées : aucune (décision du papa (3), tour 2 de la tâche 6 : tolérance resserrée à 0
 * quand les mesures le permettent). Au tour 1, le saut d'une erreur trop tardive partait au dernier pas permis
 * (JUMP_BUFFER + PHYSICS_DT avant le bord) et la lave, qui reprend le châssis 1,05 à 1,17 m avant le bord, le devançait
 * selon la phase du pas entre ≈ 10,5 et 11,25 m/s (bande de phase, 11,21 m/s au plus, MESURÉ) : la tolérance était
 * « sous 11,5 m/s ». Depuis le tour 2, une erreur trop tardive devient un saut trop tôt du même écart (`fosseJumpWanted`) :
 * le copain saute toujours avant la lave. MESURÉ (piste plate, erreur de −1,05 s, 3 à 21 m/s, 6 phases) : un saut
 * partout, 1,93 à 1,97 s de vol avant la reprise ; robots-sauts, race-invariants et race-sans-saut : voir le registre.
 */
export const isSansTentative = (f: Fall): boolean => f.cause === 'sans-tentative';
/** Fenêtre (s) avant la chute dans laquelle un contact entre voitures en fait une chute « par choc ». */
export const CONTACT_WINDOW = 5;
export const describeFall = (f: Fall): string =>
  `${f.carId} au volcan ${f.volcano} (${f.kind}, t = ${f1(f.t)} s, x = ${f1(f.x)}, ${f1(f.speed)} m/s) : ${f.cause}`
  + (f.flight !== null ? `, ${f2(f.flight)} s après son saut` : '')
  + (f.lastContact ? `, dernier contact avec ${f.lastContact.with} ${f1(f.t - f.lastContact.t)} s avant` : ', aucun contact depuis le départ');

/**
 * Vols des ratés (décision du papa, tour 2 de la tâche 6 : le raté se voit) : pour les chutes de copain dans une fosse
 * après un saut, s entre le saut et la reprise par la lave ; nombre, min, médiane, max.
 */
export function describeFlights(falls: readonly Fall[]): string {
  const xs = falls.filter((f) => f.carId !== 'galahad' && f.kind === 'fosse' && f.flight !== null).map((f) => f.flight!).sort((a, b) => a - b);
  return xs.length === 0 ? 'aucune chute de copain après un saut'
    : `${xs.length} chutes de copain après un saut, vol avant la reprise par la lave : min ${f2(xs[0])} s, `
      + `médiane ${f2(xs[Math.floor(xs.length / 2)])} s, max ${f2(xs[xs.length - 1])} s`;
}

export interface FiveCarRace {
  r: SimulateResult;
  /** Piste de la course. */
  track: Track;
  /** Chutes dans la lave de toutes les voitures, avec leur cause. */
  falls: Fall[];
  /** Étoiles prises par voiture (événements 'star' relevés par l'observateur), toutes les voitures. */
  stars: Record<string, number>;
  /** Première étoile de la course : premier 'star' relevé (au même pas, le plus petit index), null si aucune. */
  firstStar: { carId: string; t: number } | null;
  /** Voitures (ordre des index) qui ont pris une étoile au pas de `firstStar` : plus d'une = égalité. */
  firstStarCars: string[];
  /** Sauts de copain dans [xLancement, xReception] d'un tremplin (`inNoJumpZone` au x du saut) : 0 attendu (tâche 6). */
  noJumpZoneJumps: string[];
  /** Résumé lisible (par voiture), imprimé et repris dans les messages d'assertion. */
  summary: string;
  /** Durée mur de la simulation (s). */
  seconds: number;
}

/**
 * Course à 5 : durée maximale (défaut RACE_MAX_SECONDS ; réduite pour le test de l'observateur), doigt de Galahad
 * (défaut : toujours posé), son saut (défaut 'parfait' : `sauteurParfait` aux fosses ; 'jamais' : aucun saut, tâche
 * 5g ; 'sauteur' : variante « Galahad sauteur » du rattrapage, ruling Q9, tâche 6) et configuration, pistes comprises
 * (défaut CONFIG ; pistes d'avant : `withAnciennesPistes`).
 */
export interface FiveCarOptions {
  maxSeconds?: number; throttle?: (t: number) => boolean; cfg?: Config; jump?: 'parfait' | 'jamais' | 'sauteur';
  /** Galahad seul (sans copains), même harnais : `race-sans-saut-*` (saut §4). */
  solo?: boolean;
  /**
   * Traits de saut imposés aux 4 copains (mesure appariée « fonceurs contre prudents », tâche 6) : leurs drivers sont
   * refaits avec ces traits, le reste du pilote (base, lift) inchangé.
   */
  traits?: Pick<Pilot, 'jumpTry' | 'jumpSkill'>;
  /** Observateur de plus, appelé après chaque pas, après celui de `fiveCarRace` (sans effet sur la course). */
  observe?: (sim: RaceSim) => void;
}

/**
 * Traits de Galahad dans la variante « Galahad sauteur » (ruling Q9) : un driver de copain décide de ses sauts, il
 * tente toutes les étoiles hautes (jumpTry 1) et vise à 0,05 s près (jumpSkill).
 */
export const SAUTEUR_TRAITS = { jumpTry: 1, jumpSkill: 0.05 } as const;

/**
 * Sel de la graine du driver du « Galahad sauteur » (tour 3 de la tâche 6, code-review 8) : au rang 0, la graine d'un
 * driver est la graine des pilotes elle-même (`driverSeed(pilotSeed, 0) === pilotSeed`), et ses tirages sortaient du même
 * flux que `drawPilots`. Graine salée (`(pilotSeed ^ SAUTEUR_SEED_SALT) >>> 0`) : flux indépendant. Les chiffres
 * « sauteur » mesurés avant ce sel ne sont plus comparables.
 */
export const SAUTEUR_SEED_SALT = 0x5bd1e995;

/**
 * Option `jump` de `simulateRace`, variante « Galahad sauteur » (tâche 6, ruling Q9) : la demande de saut de Galahad
 * est celle d'un driver de copain (`makeRobotDriver`, rang 0, traits SAUTEUR_TRAITS, graine des pilotes salée par
 * SAUTEUR_SEED_SALT) appelé sur son contexte (`driverContext`) ; son doigt reste celui de `throttle`.
 */
export function sauteurRobot(track: Track, cfg: Config = CONFIG): (t: number, sim: RaceSim) => boolean {
  let driver: Driver | null = null;
  return (_t, sim) => {
    if (!driver) {
      const seed = (sim.pilotSeed ^ SAUTEUR_SEED_SALT) >>> 0;
      driver = makeRobotDriver({ ...GALAHAD, ...SAUTEUR_TRAITS }, GALAHAD_INDEX, track, seed, cfg);
      // Demandes d'un pilote automatique : la garde de zone tremplin de `updateJump` s'applique (code-review 3).
      sim.cars[GALAHAD_INDEX].autoJumps = true;
    }
    return driver(driverContext(sim, GALAHAD_INDEX)).jump;
  };
}

/** Options de `simulateRace` de la course à 5 (hors observateur) sur `track`. */
export const fiveCarOptions = (
  { maxSeconds = RACE_MAX_SECONDS, throttle = () => true, cfg = CONFIG, jump = 'parfait', solo = false, traits }: FiveCarOptions = {},
  track?: Track,
) => ({
  throttle, maxSeconds, cfg, robots: !solo,
  ...(jump === 'parfait' && track ? { jump: sauteurParfait(track, cfg) } : {}),
  ...(jump === 'sauteur' && track ? { jump: sauteurRobot(track, cfg) } : {}),
  ...(traits && track ? {
    setup: (sim: RaceSim) => sim.cars.forEach((car, rank) => {
      if (car.driver) car.driver = makeRobotDriver({ ...car.pilot, ...traits }, rank, track, sim.pilotSeed, cfg);
    }),
  } : {}),
});

/**
 * Course à 5 voitures sur la piste de la graine, observée par `onStep` : contacts entre voitures et chutes,
 * mais aussi étoiles par voiture et première étoile. Ces dernières sont relevées ici, et non lues dans
 * `SimulateResult.starsByCar` / `firstStar` (tâche 5d), pour que le harnais tourne aussi sur le code
 * d'avant la 5d : la mesure « avant » du rattrapage reste rejouable et comparable.
 */
export function fiveCarRace(seed: number, opts: FiveCarOptions = {}): FiveCarRace {
  const track = trackFor(seed, opts.cfg ?? CONFIG);
  const t0 = performance.now();
  const lastContact = new Map<string, { t: number; with: string }>();
  /** Dernier saut de chaque voiture (x du châssis, instant), pour classer une chute dans une fosse et mesurer son vol. */
  const lastJump = new Map<string, { x: number; t: number }>();
  /** Vitesse de chaque voiture au pas précédent. */
  const lastSpeed = new Map<string, number>();
  const falls: Fall[] = [];
  const noJumpZoneJumps: string[] = [];
  const starCounts: Record<string, number> = {};
  let firstStar: FiveCarRace['firstStar'] = null;
  const firstStarCars: string[] = [];
  const r = simulateRace(track, {
    ...fiveCarOptions(opts, track),
    onStep: (sim) => {
      const t = sim.time;
      for (const [a, b] of carPairsTouching(sim)) {
        lastContact.set(a, { t, with: b });
        lastContact.set(b, { t, with: a });
      }
      for (const e of sim.events) {
        if (e.type === 'jump') {
          lastJump.set(e.carId, { x: e.x, t: e.t });
          if (e.carId !== sim.cars[GALAHAD_INDEX].state.id && inNoJumpZone(track, e.x)) noJumpZoneJumps.push(`${e.carId} t = ${f1(e.t)} s, x = ${f1(e.x)}`);
        }
        if (e.type === 'star') {
          starCounts[e.carId] = (starCounts[e.carId] ?? 0) + 1;
          firstStar ??= { carId: e.carId, t: e.t };
          if (e.t === firstStar.t && !firstStarCars.includes(e.carId)) firstStarCars.push(e.carId);
        }
        if (e.type !== 'respawn') continue;
        if (e.reason === 'lava') {
          const v = nearestVolcanoZone(track, e.x) ?? volcanoAhead(track, e.x);
          const c = lastContact.get(e.carId) ?? null;
          const j = lastJump.get(e.carId);
          const jumped = v !== undefined && j !== undefined && j.x >= v.xLancement && j.x <= v.xLava;
          const robot = e.carId !== sim.cars[GALAHAD_INDEX].state.id;
          const shock = c !== null && e.t - c.t <= CONTACT_WINDOW;
          const cause = fallCause({ kind: v?.kind ?? '?', robot, jumped, shock });
          falls.push({
            carId: e.carId, t: e.t, x: e.x, volcano: v ? track.volcanoes.indexOf(v) : -1, kind: v?.kind ?? '?',
            cause, speed: lastSpeed.get(e.carId) ?? NaN, lastContact: c ? { ...c } : null, flight: jumped ? e.t - j!.t : null,
          });
        }
        // Un respawn est une téléportation : un contact d'avant ne peut pas causer la chute suivante, ni un saut d'avant.
        lastContact.delete(e.carId);
        lastJump.delete(e.carId);
      }
      for (const car of sim.cars) lastSpeed.set(car.state.id, carSpeedMps(car.body));
      opts.observe?.(sim);
    },
  });
  const seconds = (performance.now() - t0) / 1000;
  const stars = Object.fromEntries(Object.keys(r.respawnsByCar).map((id) => [id, starCounts[id] ?? 0]));
  const cars = Object.keys(r.respawnsByCar).map((id) => {
    const rs = r.respawnsByCar[id];
    return `${id} : respawns ${rs.length}, lave ${r.lavaByCar[id]}, étoiles ${stars[id]}, blocage max ${f2(r.maxStuckByCar[id])} s, `
      + `arrivée ${f1(r.finishedAtByCar[id])} s [${describeRespawns(rs).join(' ; ')}]`;
  });
  const variant = opts.jump === 'jamais' ? ', Galahad sans saut' : opts.jump === 'sauteur' ? ', Galahad sauteur' : '';
  const summary = `seed ${seed}${opts.solo ? ' (Galahad seul)' : ''}${variant}${opts.traits ? `, copains ${opts.traits.jumpTry} / ${opts.traits.jumpSkill}` : ''} : Galahad arrivé à ${f1(r.finishedAt)} s, fin à ${f1(r.time)} s, classement ${r.ranking.join(' > ')}, `
    + `meanStepMs ${f2(r.meanStepMs)} (indicateur, cible < 4), maxStepMs ${f1(r.maxStepMs)}, durée ${f1(seconds)} s\n  ${cars.join('\n  ')}`
    + `\n  chutes dans la lave : ${falls.length ? falls.map(describeFall).join(' ; ') : 'aucune'}`
    + (noJumpZoneJumps.length ? `\n  sauts de copain dans la zone d'un tremplin : ${noJumpZoneJumps.join(' ; ')}` : '');
  return { r, track, falls, noJumpZoneJumps, stars, firstStar, firstStarCars, summary, seconds };
}

/**
 * Séries de chutes dans la lave d'une voiture (tâche 5g, saut §6.4) : chutes consécutives dans la même lave, sans autre
 * réapparition entre elles. Longueurs des séries ; au plus 2 attendues, la 2e chute posant la voiture après le volcan
 * (option B pour une fosse) : une 3e chute de suite dans la même lave ferait une série de 3.
 */
export function lavaSeries(respawns: readonly RespawnEvent[], track: Track): number[] {
  const out: number[] = [];
  let lava: number | null = null;
  for (const e of respawns) {
    if (e.reason !== 'lava') { lava = null; continue; }
    const v = nearestVolcanoZone(track, e.x) ?? volcanoAhead(track, e.x);
    const key = v?.xLava ?? NaN;
    if (lava !== null && key === lava) out[out.length - 1]++;
    else out.push(1);
    lava = key;
  }
  return out;
}

/** Réapparitions de `id` hors chutes dans une fosse (la limite de 3 par course ne les compte pas, saut §6.8). */
export const respawnsHorsFosses = (race: FiveCarRace, id: string): number =>
  race.r.respawnsByCar[id].length - race.falls.filter((f) => f.carId === id && f.kind === 'fosse').length;

/**
 * ≤ 3 réapparitions par voiture hors chutes dans une fosse, au plus 2 chutes par série, aucun garde-fou de vitesse,
 * personne bloqué > 2 s, Galahad arrive avant 240 s sans tomber dans la lave (tâche 5b ; saut parfait aux fosses), aucun
 * choc dans une zone fantôme, aucune chute propre d'aucune voiture (tâche 5c, mesuré 0 sur les graines 0 à 23 ; les
 * chutes des copains dans une fosse sont « fosse », attendues, tâche 6), aucun saut de copain dans la zone d'un
 * tremplin ; cohérence des mesures de `simulateRace` (classement, chutes, arrivée).
 */
export function expectRaceInvariants(race: FiveCarRace): void {
  const { r, falls, summary } = race;
  expect(Object.keys(r.respawnsByCar), summary).toHaveLength(5);
  expect(r.finishedAt, summary).not.toBeNull();
  expect(r.finishedAt!, summary).toBeLessThan(RACE_MAX_SECONDS);
  expect(r.finishedAtByCar.galahad, summary).toBe(r.finishedAt);
  expect(r.lavaByCar.galahad, summary).toBe(0);
  expect(falls.filter((f) => f.cause === 'propre').map(describeFall), summary).toEqual([]);
  // Saut parfait de Galahad (relecture standard M4 de la 5g) : aucune chute « fosse » de Galahad ; celles des copains
  // (sauts ratés, tâche 6) sont attendues ; un copain ne tombe jamais sans avoir sauté (tour 2, `isSansTentative`).
  expect(falls.filter((f) => f.cause === 'fosse' && f.carId === 'galahad').map(describeFall), summary).toEqual([]);
  expect(falls.filter(isSansTentative).map(describeFall), summary).toEqual([]);
  expect(race.noJumpZoneJumps, summary).toEqual([]);
  // Fantômes près des volcans : aucune paire active entre deux voitures dont l'une est dans une zone fantôme.
  expect(r.ghostContacts, summary).toBe(0);
  for (const [id, rs] of Object.entries(r.respawnsByCar)) {
    expect(respawnsHorsFosses(race, id), `${id} : ${summary}`).toBeLessThanOrEqual(MAX_RESPAWNS_PER_CAR);
    expect(Math.max(0, ...lavaSeries(rs, race.track)), `${id} : ${summary}`).toBeLessThanOrEqual(2);
    expect(rs.filter((e) => e.reason === 'speed'), `${id} : ${summary}`).toEqual([]);
    expect(r.lavaByCar[id], `${id} : ${summary}`).toBe(rs.filter((e) => e.reason === 'lava').length);
    expect(r.maxStuckByCar[id], `${id} : ${summary}`).toBeLessThanOrEqual(MAX_STUCK_SECONDS);
  }
  // En tête du classement : la première arrivée (à temps égal, le plus petit index, ordre des clés).
  const arrived = Object.entries(r.finishedAtByCar).filter((e): e is [string, number] => e[1] !== null);
  const first = arrived.reduce((best, e) => (e[1] < best[1] ? e : best));
  expect(r.ranking[0], summary).toBe(first[0]);
}

/**
 * Invariants à 5 voitures sur `seeds` (suite lente, un fichier par tranche de graines pour paralléliser) :
 * `expectRaceInvariants` par graine, dont `lavaByCar.galahad === 0` (tâche 5b) et aucune chute propre
 * (tâche 5c), puis tableau des chutes
 * dans la lave de toutes les voitures, avec leur cause (choc ou propre).
 */
export function registerRaceInvariants(seeds: number[]): void {
  const falls: (Fall & { seed: number })[] = [];
  describe(`course à 5 voitures, doigt posé, saut parfait aux fosses (copains à leur driver, tâche 6), graines ${seeds[0]} à ${seeds[seeds.length - 1]}`, () => {
    test.each(seeds)('seed %i : ≤ 3 respawns par voiture, aucun garde-fou de vitesse, personne bloqué > 2 s, Galahad arrive sans tomber', (seed) => {
      const race = fiveCarRace(seed);
      console.log(`course à 5 ${race.summary}`);
      falls.push(...race.falls.map((f) => ({ ...f, seed })));
      expectRaceInvariants(race);
    });
    afterAll(() => {
      const propres = falls.filter((f) => f.cause === 'propre').length;
      const byKind = (k: Fall['kind']) => falls.filter((f) => f.kind === k).length;
      const sansTentative = falls.filter(isSansTentative).length;
      console.log(`chutes dans la lave à 5 voitures, graines ${seeds.join(', ')} : ${falls.length} (propres ${propres}, `
        + `choc ${falls.filter((f) => f.cause === 'choc').length}, fosse (attendues : copain qui rate son saut, Galahad sans saut) ${falls.filter((f) => f.cause === 'fosse').length}, `
        + `copain sans tentative ${sansTentative} ; `
        + `aux tremplins ${byKind('tremplin')}, aux fosses ${byKind('fosse')}) ; ${describeFlights(falls)}`
        + (falls.length ? `\n  ${falls.map((f) => `seed ${f.seed} : ${describeFall(f)}`).join('\n  ')}` : ''));
    });
  });
}
