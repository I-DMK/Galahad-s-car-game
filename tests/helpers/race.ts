// Course complète à 5 voitures (tâche 5b, addendum §2) : Galahad doigt toujours posé, les 4 copains au
// driver provisoire (doigt posé dès n × START_DELAY_PER_RANK), arrêt à l'arrivée de Galahad + 1,5 s.
// Invariants partagés par la CI (tests/race-smoke.test.ts, graines 1 et 2) et la suite lente
// (tests/slow/race-invariants-*.test.ts). `lavaByCar.galahad === 0` date de la tâche 5b (tour de
// correction 1 : CI graines 1 et 2, lent graines 0 à 9) ; la tâche 5c a élargi la suite lente aux
// graines 0 à 23 (quatre fichiers parallèles), classé la cause de chaque chute dans la lave et ajouté
// « aucune chute propre, toutes voitures ».
import { CONFIG } from '../../src/config';
import { carPairsTouching, simulateRace, type SimulateResult } from '../../src/sim/simulate';
import { nearestVolcanoZone, volcanoAhead } from '../../src/track/query';
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
 * Une chute dans la lave (toute voiture) et sa cause : « choc » si la voiture a touché une autre voiture
 * dans les CONTACT_WINDOW secondes qui précèdent (approche du volcan : plat de lancement, élan, rampe,
 * vol ; dans la zone fantôme les voitures se traversent), « propre » sinon. Tous les drivers ont le doigt
 * posé (Galahad tout du long, les copains dès leur départ échelonné) : une chute propre contredit la
 * promesse « doigt posé depuis le plat de lancement, on ne tombe jamais ».
 */
export interface Fall {
  carId: string; t: number; x: number;
  /** Indice du volcan dans `track.volcanoes`. */
  volcano: number;
  cause: 'choc' | 'propre';
  /** Dernier contact avec une autre voiture avant la chute, null si aucun depuis le départ. */
  lastContact: { t: number; with: string } | null;
}
/** Fenêtre (s) avant la chute dans laquelle un contact entre voitures en fait une chute « par choc ». */
export const CONTACT_WINDOW = 5;
export const describeFall = (f: Fall): string =>
  `${f.carId} au volcan ${f.volcano} (t = ${f1(f.t)} s, x = ${f1(f.x)}) : ${f.cause}`
  + (f.lastContact ? `, dernier contact avec ${f.lastContact.with} ${f1(f.t - f.lastContact.t)} s avant` : ', aucun contact depuis le départ');

export interface FiveCarRace {
  r: SimulateResult;
  /** Chutes dans la lave de toutes les voitures, avec leur cause. */
  falls: Fall[];
  /** Résumé lisible (par voiture), imprimé et repris dans les messages d'assertion. */
  summary: string;
  /** Durée mur de la simulation (s). */
  seconds: number;
}

/** Options de `simulateRace` de la course à 5 (hors observateur) ; `maxSeconds` réduit pour le test de l'observateur. */
export const fiveCarOptions = (maxSeconds = RACE_MAX_SECONDS) => ({ throttle: () => true, maxSeconds, cfg: CONFIG, robots: true });

export function fiveCarRace(seed: number, maxSeconds = RACE_MAX_SECONDS): FiveCarRace {
  const track = trackFor(seed);
  const t0 = performance.now();
  const lastContact = new Map<string, { t: number; with: string }>();
  const falls: Fall[] = [];
  const r = simulateRace(track, {
    ...fiveCarOptions(maxSeconds),
    onStep: (sim) => {
      const t = sim.time;
      for (const [a, b] of carPairsTouching(sim)) {
        lastContact.set(a, { t, with: b });
        lastContact.set(b, { t, with: a });
      }
      for (const e of sim.events) {
        if (e.type !== 'respawn') continue;
        if (e.reason === 'lava') {
          const v = nearestVolcanoZone(track, e.x) ?? volcanoAhead(track, e.x);
          const c = lastContact.get(e.carId) ?? null;
          falls.push({
            carId: e.carId, t: e.t, x: e.x, volcano: v ? track.volcanoes.indexOf(v) : -1,
            cause: c && e.t - c.t <= CONTACT_WINDOW ? 'choc' : 'propre', lastContact: c ? { ...c } : null,
          });
        }
        // Un respawn est une téléportation : un contact d'avant ne peut pas causer la chute suivante.
        lastContact.delete(e.carId);
      }
    },
  });
  const seconds = (performance.now() - t0) / 1000;
  const cars = Object.keys(r.respawnsByCar).map((id) => {
    const rs = r.respawnsByCar[id];
    return `${id} : respawns ${rs.length}, lave ${r.lavaByCar[id]}, blocage max ${f2(r.maxStuckByCar[id])} s, `
      + `arrivée ${f1(r.finishedAtByCar[id])} s [${describeRespawns(rs).join(' ; ')}]`;
  });
  const summary = `seed ${seed} : Galahad arrivé à ${f1(r.finishedAt)} s, fin à ${f1(r.time)} s, classement ${r.ranking.join(' > ')}, `
    + `meanStepMs ${f2(r.meanStepMs)} (indicateur, cible < 4), maxStepMs ${f1(r.maxStepMs)}, durée ${f1(seconds)} s\n  ${cars.join('\n  ')}`
    + `\n  chutes dans la lave : ${falls.length ? falls.map(describeFall).join(' ; ') : 'aucune'}`;
  return { r, falls, summary, seconds };
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
  describe(`course à 5 voitures, doigt posé (robots : driver provisoire), graines ${seeds[0]} à ${seeds[seeds.length - 1]}`, () => {
    test.each(seeds)('seed %i : ≤ 3 respawns par voiture, aucun garde-fou de vitesse, personne bloqué > 2 s, Galahad arrive sans tomber', (seed) => {
      const race = fiveCarRace(seed);
      console.log(`course à 5 ${race.summary}`);
      falls.push(...race.falls.map((f) => ({ ...f, seed })));
      expectRaceInvariants(race);
    });
    afterAll(() => {
      const propres = falls.filter((f) => f.cause === 'propre').length;
      console.log(`chutes dans la lave à 5 voitures, graines ${seeds.join(', ')} : ${falls.length} (propres ${propres}, choc ${falls.length - propres})`
        + (falls.length ? `\n  ${falls.map((f) => `seed ${f.seed} : ${describeFall(f)}`).join('\n  ')}` : ''));
    });
  });
}
