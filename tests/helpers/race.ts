// Course complète à 5 voitures (tâche 5b, addendum §2) : Galahad doigt toujours posé, les 4 copains au
// driver provisoire (doigt posé dès n × START_DELAY_PER_RANK), arrêt à l'arrivée de Galahad + 1,5 s.
// Invariants partagés par la CI (tests/race-smoke.test.ts, graines 1 et 2) et la suite lente
// (tests/slow/race-invariants-*.test.ts). `lavaByCar.galahad === 0` date de la tâche 5b (tour de
// correction 1 : CI graines 1 et 2, lent graines 0 à 9) ; la tâche 5c a élargi la suite lente aux
// graines 0 à 23 (quatre fichiers parallèles), classé la cause de chaque chute dans la lave et ajouté
// « aucune chute propre, toutes voitures ». Tâche 5g (décision P9, rulings R-F9 et R-F11) : Galahad court par défaut
// avec le saut parfait aux fosses (`sauteurParfait`, `lavaByCar.galahad === 0` garde son sens), les copains provisoires
// y sautent sans erreur ; une chute dans une fosse sans saut est « fosse » (attendue), ni « choc » ni « propre » ;
// `race-sans-saut-*` fait courir Galahad sans saut (2 chutes par fosse, au plus 2 par série, 0 au tremplin).
import { CONFIG, type Config } from '../../src/config';
import { carPairsTouching, simulateRace, type SimulateResult } from '../../src/sim/harness';
import type { RespawnEvent } from '../../src/sim/simulate';
import { nearestVolcanoZone, volcanoAhead } from '../../src/track/query';
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
 * Une chute dans la lave (toute voiture) et sa cause : « fosse » si c'est une fosse et que la voiture n'a pas sauté
 * depuis le début de son approche (attendue sans saut, ruling R-F11) ; sinon « choc » si la voiture a touché une
 * autre voiture dans les CONTACT_WINDOW secondes qui précèdent (approche du volcan : plat de lancement, élan, rampe,
 * vol ; dans la zone fantôme les voitures se traversent), « propre » sinon. Tous les drivers ont le doigt
 * posé (Galahad tout du long, les copains dès leur départ échelonné) : une chute propre contredit la
 * promesse « doigt posé depuis le plat de lancement, on ne tombe jamais » (tremplin), ou « un saut au centre de la
 * fenêtre passe » (fosse).
 */
export interface Fall {
  carId: string; t: number; x: number;
  /** Indice du volcan dans `track.volcanoes`. */
  volcano: number;
  /** Sorte du volcan (tâche 5g). */
  kind: 'tremplin' | 'fosse' | '?';
  cause: 'choc' | 'propre' | 'fosse';
  /** Dernier contact avec une autre voiture avant la chute, null si aucun depuis le départ. */
  lastContact: { t: number; with: string } | null;
}
/** Fenêtre (s) avant la chute dans laquelle un contact entre voitures en fait une chute « par choc ». */
export const CONTACT_WINDOW = 5;
export const describeFall = (f: Fall): string =>
  `${f.carId} au volcan ${f.volcano} (${f.kind}, t = ${f1(f.t)} s, x = ${f1(f.x)}) : ${f.cause}`
  + (f.lastContact ? `, dernier contact avec ${f.lastContact.with} ${f1(f.t - f.lastContact.t)} s avant` : ', aucun contact depuis le départ');

export interface FiveCarRace {
  r: SimulateResult;
  /** Chutes dans la lave de toutes les voitures, avec leur cause. */
  falls: Fall[];
  /** Étoiles prises par voiture (événements 'star' relevés par l'observateur), toutes les voitures. */
  stars: Record<string, number>;
  /** Première étoile de la course : premier 'star' relevé (au même pas, le plus petit index), null si aucune. */
  firstStar: { carId: string; t: number } | null;
  /** Voitures (ordre des index) qui ont pris une étoile au pas de `firstStar` : plus d'une = égalité. */
  firstStarCars: string[];
  /** Résumé lisible (par voiture), imprimé et repris dans les messages d'assertion. */
  summary: string;
  /** Durée mur de la simulation (s). */
  seconds: number;
}

/**
 * Course à 5 : durée maximale (défaut RACE_MAX_SECONDS ; réduite pour le test de l'observateur), doigt de Galahad
 * (défaut : toujours posé), son saut (défaut 'parfait' : `sauteurParfait` aux fosses ; 'jamais' : aucun saut, tâche
 * 5g) et configuration, pistes comprises (défaut CONFIG ; pistes d'avant : `withAnciennesPistes`).
 */
export interface FiveCarOptions {
  maxSeconds?: number; throttle?: (t: number) => boolean; cfg?: Config; jump?: 'parfait' | 'jamais';
  /** Galahad seul (sans copains), même harnais : `race-sans-saut-*` (saut §4). */
  solo?: boolean;
}

/** Options de `simulateRace` de la course à 5 (hors observateur) sur `track`. */
export const fiveCarOptions = (
  { maxSeconds = RACE_MAX_SECONDS, throttle = () => true, cfg = CONFIG, jump = 'parfait', solo = false }: FiveCarOptions = {},
  track?: Track,
) => ({
  throttle, maxSeconds, cfg, robots: !solo,
  ...(jump === 'parfait' && track ? { jump: sauteurParfait(track, cfg) } : {}),
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
  /** Dernier saut de chaque voiture (x du châssis), pour classer une chute dans une fosse. */
  const lastJumpX = new Map<string, number>();
  const falls: Fall[] = [];
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
        if (e.type === 'jump') lastJumpX.set(e.carId, e.x);
        if (e.type === 'star') {
          starCounts[e.carId] = (starCounts[e.carId] ?? 0) + 1;
          firstStar ??= { carId: e.carId, t: e.t };
          if (e.t === firstStar.t && !firstStarCars.includes(e.carId)) firstStarCars.push(e.carId);
        }
        if (e.type !== 'respawn') continue;
        if (e.reason === 'lava') {
          const v = nearestVolcanoZone(track, e.x) ?? volcanoAhead(track, e.x);
          const c = lastContact.get(e.carId) ?? null;
          const jx = lastJumpX.get(e.carId);
          const jumped = v !== undefined && jx !== undefined && jx >= v.xLancement && jx <= v.xLava;
          const cause: Fall['cause'] = v?.kind === 'fosse' && !jumped ? 'fosse'
            : c && e.t - c.t <= CONTACT_WINDOW ? 'choc' : 'propre';
          falls.push({
            carId: e.carId, t: e.t, x: e.x, volcano: v ? track.volcanoes.indexOf(v) : -1, kind: v?.kind ?? '?',
            cause, lastContact: c ? { ...c } : null,
          });
        }
        // Un respawn est une téléportation : un contact d'avant ne peut pas causer la chute suivante, ni un saut d'avant.
        lastContact.delete(e.carId);
        lastJumpX.delete(e.carId);
      }
    },
  });
  const seconds = (performance.now() - t0) / 1000;
  const stars = Object.fromEntries(Object.keys(r.respawnsByCar).map((id) => [id, starCounts[id] ?? 0]));
  const cars = Object.keys(r.respawnsByCar).map((id) => {
    const rs = r.respawnsByCar[id];
    return `${id} : respawns ${rs.length}, lave ${r.lavaByCar[id]}, étoiles ${stars[id]}, blocage max ${f2(r.maxStuckByCar[id])} s, `
      + `arrivée ${f1(r.finishedAtByCar[id])} s [${describeRespawns(rs).join(' ; ')}]`;
  });
  const summary = `seed ${seed}${opts.solo ? ' (Galahad seul)' : ''}${opts.jump === 'jamais' ? ', Galahad sans saut' : ''} : Galahad arrivé à ${f1(r.finishedAt)} s, fin à ${f1(r.time)} s, classement ${r.ranking.join(' > ')}, `
    + `meanStepMs ${f2(r.meanStepMs)} (indicateur, cible < 4), maxStepMs ${f1(r.maxStepMs)}, durée ${f1(seconds)} s\n  ${cars.join('\n  ')}`
    + `\n  chutes dans la lave : ${falls.length ? falls.map(describeFall).join(' ; ') : 'aucune'}`;
  return { r, falls, stars, firstStar, firstStarCars, summary, seconds };
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

/**
 * ≤ 3 réapparitions par voiture, aucun garde-fou de vitesse, personne bloqué > 2 s, Galahad arrive avant
 * 240 s sans tomber dans la lave (tâche 5b), aucun choc dans une zone fantôme, aucune chute propre
 * d'aucune voiture (tous les drivers ont le doigt posé ; tâche 5c, mesuré 0 sur les graines 0 à 23) ;
 * cohérence des mesures de `simulateRace` (classement, chutes, arrivée).
 */
export function expectRaceInvariants({ r, falls, summary }: FiveCarRace): void {
  expect(Object.keys(r.respawnsByCar), summary).toHaveLength(5);
  expect(r.finishedAt, summary).not.toBeNull();
  expect(r.finishedAt!, summary).toBeLessThan(RACE_MAX_SECONDS);
  expect(r.finishedAtByCar.galahad, summary).toBe(r.finishedAt);
  expect(r.lavaByCar.galahad, summary).toBe(0);
  expect(falls.filter((f) => f.cause === 'propre').map(describeFall), summary).toEqual([]);
  // Saut parfait de Galahad, saut au centre des copains provisoires (relecture standard M4) : aucune chute « fosse ».
  expect(falls.filter((f) => f.cause === 'fosse').map(describeFall), summary).toEqual([]);
  // Fantômes près des volcans : aucune paire active entre deux voitures dont l'une est dans une zone fantôme.
  expect(r.ghostContacts, summary).toBe(0);
  for (const [id, rs] of Object.entries(r.respawnsByCar)) {
    expect(rs.length, `${id} : ${summary}`).toBeLessThanOrEqual(MAX_RESPAWNS_PER_CAR);
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
  describe(`course à 5 voitures, doigt posé, saut parfait aux fosses (robots : driver provisoire, sauteurs), graines ${seeds[0]} à ${seeds[seeds.length - 1]}`, () => {
    test.each(seeds)('seed %i : ≤ 3 respawns par voiture, aucun garde-fou de vitesse, personne bloqué > 2 s, Galahad arrive sans tomber', (seed) => {
      const race = fiveCarRace(seed);
      console.log(`course à 5 ${race.summary}`);
      falls.push(...race.falls.map((f) => ({ ...f, seed })));
      expectRaceInvariants(race);
    });
    afterAll(() => {
      const propres = falls.filter((f) => f.cause === 'propre').length;
      const byKind = (k: Fall['kind']) => falls.filter((f) => f.kind === k).length;
      console.log(`chutes dans la lave à 5 voitures, graines ${seeds.join(', ')} : ${falls.length} (propres ${propres}, `
        + `choc ${falls.filter((f) => f.cause === 'choc').length}, fosse sans saut ${falls.filter((f) => f.cause === 'fosse').length} ; `
        + `aux tremplins ${byKind('tremplin')}, aux fosses ${byKind('fosse')})`
        + (falls.length ? `\n  ${falls.map((f) => `seed ${f.seed} : ${describeFall(f)}`).join('\n  ')}` : ''));
    });
  });
}
