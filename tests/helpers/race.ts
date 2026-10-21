// Course complète à 5 voitures (tâche 5b, addendum §2) : Galahad doigt toujours posé, les 4 copains au
// driver provisoire (doigt posé dès n × START_DELAY_PER_RANK), arrêt à l'arrivée de Galahad + 1,5 s.
// Invariants partagés par la CI (tests/race-smoke.test.ts, graines 1 et 2) et la suite lente
// (tests/slow/race-invariants.test.ts, graines 0 à 9).
import { CONFIG } from '../../src/config';
import { simulateRace, type SimulateResult } from '../../src/sim/simulate';
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

export interface FiveCarRace {
  r: SimulateResult;
  /** Résumé lisible (par voiture), imprimé et repris dans les messages d'assertion. */
  summary: string;
  /** Durée mur de la simulation (s). */
  seconds: number;
}

export function fiveCarRace(seed: number): FiveCarRace {
  const track = trackFor(seed);
  const t0 = performance.now();
  const r = simulateRace(track, { throttle: () => true, maxSeconds: RACE_MAX_SECONDS, cfg: CONFIG, robots: true });
  const seconds = (performance.now() - t0) / 1000;
  const cars = Object.keys(r.respawnsByCar).map((id) => {
    const rs = r.respawnsByCar[id];
    return `${id} : respawns ${rs.length}, lave ${r.lavaByCar[id]}, blocage max ${f2(r.maxStuckByCar[id])} s, `
      + `arrivée ${f1(r.finishedAtByCar[id])} s [${describeRespawns(rs).join(' ; ')}]`;
  });
  const summary = `seed ${seed} : Galahad arrivé à ${f1(r.finishedAt)} s, fin à ${f1(r.time)} s, classement ${r.ranking.join(' > ')}, `
    + `meanStepMs ${f2(r.meanStepMs)} (indicateur, cible < 4), maxStepMs ${f1(r.maxStepMs)}, durée ${f1(seconds)} s\n  ${cars.join('\n  ')}`;
  return { r, summary, seconds };
}

/**
 * ≤ 3 réapparitions par voiture, aucun garde-fou de vitesse, personne bloqué > 2 s, Galahad arrive avant
 * 240 s sans tomber dans la lave ; cohérence des mesures de `simulateRace` (classement, chutes, arrivée).
 */
export function expectRaceInvariants({ r, summary }: FiveCarRace): void {
  expect(Object.keys(r.respawnsByCar), summary).toHaveLength(5);
  expect(r.finishedAt, summary).not.toBeNull();
  expect(r.finishedAt!, summary).toBeLessThan(RACE_MAX_SECONDS);
  expect(r.finishedAtByCar.galahad, summary).toBe(r.finishedAt);
  expect(r.lavaByCar.galahad, summary).toBe(0);
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
