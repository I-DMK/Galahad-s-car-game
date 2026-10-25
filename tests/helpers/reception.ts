// Étoiles basses des réceptions (plan B, tâche 5g, demande du papa) : une étoile au tout début d'une réception était
// survolée doigt posé (graine 14 : toutes les voitures en turbo en ratent une). Les étoiles basses commencent après
// l'atterrissage le plus long doigt posé (STAR_TREMPLIN_LANDING, STAR_FOSSE_LANDING). Ce harnais mesure, sur une course
// de Galahad doigt posé (saut parfait aux fosses), l'atterrissage après chaque volcan et les étoiles basses de chaque
// réception, prises ou survolées.
import { CONFIG, type Config } from '../../src/config';
import { physToWorld } from '../../src/physics/units';
import { simulateRace } from '../../src/sim/harness';
import { chassisX, GALAHAD_INDEX, type RaceSim } from '../../src/sim/simulate';
import { heightAt } from '../../src/track/query';
import type { Track, Volcano } from '../../src/track/types';
import { sauteurParfait } from './fosses';

/** m : marge exigée entre l'atterrissage le plus long mesuré et le début des étoiles basses de la réception. */
export const LANDING_MARGIN = 4;
/** m : hauteur du bas d'une roue au-dessus du sol au-delà de laquelle une étoile basse (capteur de 0,1 à 1,1 m) est survolée. */
const STAR_TOP = 1.1;

export interface ReceptionRow {
  seed: number;
  kind: Volcano['kind'];
  /** x (m après xReception) du châssis au premier contact d'une roue après le sommet ou le bord ; NaN sans contact. */
  touch: number;
  /**
   * Dernier x (m après xReception) où toutes les roues passent au-dessus d'une étoile basse, avant tout saut de Galahad sur
   * la réception (rocher, tâche 11c) ; −Infinity sinon.
   */
  lastMiss: number;
  /** Turbo actif au passage du sommet ou du bord (volcan pris en turbo). */
  turbo: boolean;
  /** Étoiles basses de la réception : x (m après xReception) et prise par Galahad. */
  stars: { dx: number; taken: boolean }[];
}

/** Dégagement des étoiles basses d'une réception (cfg). */
export const landingOf = (v: Volcano, cfg: Config = CONFIG): number =>
  (v.kind === 'tremplin' ? cfg.STAR_TREMPLIN_LANDING : cfg.STAR_FOSSE_LANDING);

/**
 * Galahad seul, doigt posé, saut parfait aux fosses (`sauteurParfait`), course complète de la graine : une ligne par
 * volcan passé sans réapparition.
 */
export function receptionRun(seed: number, track: Track, cfg: Config = CONFIG): { rows: ReceptionRow[]; respawns: number; finishedAt: number | null } {
  const lowStars = track.stars.filter((s) => !s.high);
  const taken = new Set<number>();
  const rows: ReceptionRow[] = [];
  let cur: { v: Volcano; passed: boolean; jumpedOnReception: boolean; row: ReceptionRow } | null = null;
  const close = (): void => {
    if (!cur) return;
    const { v, row } = cur;
    row.stars = lowStars.filter((s) => s.x >= v.xReception && s.x <= v.xEnd).map((s) => ({ dx: s.x - v.xReception, taken: taken.has(s.id) }));
    rows.push(row);
    cur = null;
  };
  const r = simulateRace(track, {
    throttle: () => true, maxSeconds: 240, cfg, jump: sauteurParfait(track, cfg),
    onStep: (sim: RaceSim) => {
      const g = sim.cars[GALAHAD_INDEX];
      for (const e of sim.events) {
        if (e.type === 'star' && e.carId === g.state.id) taken.add(e.id);
        if (e.type === 'respawn' && e.carId === g.state.id) cur = null;
        // Saut de Galahad sur la réception (rocher, tâche 11c) : ce n'est pas l'atterrissage du volcan, le survol qui
        // suit n'est plus relevé (les étoiles de la réception restent jugées).
        if (e.type === 'jump' && e.carId === g.state.id && cur && e.x >= cur.v.xReception) cur.jumpedOnReception = true;
      }
      const x = chassisX(g);
      if (cur && x >= cur.v.xEnd) close();
      if (!cur) {
        const v = track.volcanoes.find((w) => x >= w.xLancement && x < w.xEnd);
        if (!v) return;
        cur = { v, passed: false, jumpedOnReception: false, row: { seed, kind: v.kind, touch: NaN, lastMiss: -Infinity, turbo: false, stars: [] } };
      }
      const { v, row } = cur;
      const edge = v.kind === 'fosse' ? v.xBord : v.xLip;
      if (!cur.passed && x >= edge) { cur.passed = true; row.turbo = g.state.turboUntil > sim.time; }
      const low = Math.min(...g.body.wheels.map((w) => {
        const p = physToWorld(w.position);
        return p.y - cfg.WHEEL_RADIUS - heightAt(track, p.x);
      }));
      if (cur.passed && Number.isNaN(row.touch) && x > v.xLava && low < 0.05) row.touch = x - v.xReception;
      if (x >= v.xReception && low > STAR_TOP && !cur.jumpedOnReception) row.lastMiss = Math.max(row.lastMiss, x - v.xReception);
    },
  });
  close();
  return { rows, respawns: r.respawns.length, finishedAt: r.finishedAt };
}

export const describeRow = (w: ReceptionRow): string =>
  `g${w.seed} ${w.kind}${w.turbo ? ' (turbo)' : ''} : contact à ${w.touch.toFixed(1)} m, survol jusqu'à ${Number.isFinite(w.lastMiss) ? w.lastMiss.toFixed(1) : '—'} m, `
  + `étoiles [${w.stars.map((s) => `${s.dx.toFixed(1)}${s.taken ? ' prise' : ' RATÉE'}`).join(', ')}]`;

/**
 * Assertions : le premier contact reste à LANDING_MARGIN au moins avant le début des étoiles basses de la réception ;
 * hors turbo, le dernier survol aussi, et chaque étoile basse de la réception est prise. Volcan pris en turbo (décision
 * du papa, tour 2 de la 5g : graine 2, un tremplin pris en turbo rebondit et survole jusqu'à 62,2 m une étoile en
 * 60,7 m ; dégagement gardé à 55 m) : survol et étoile ratée tolérés, renvoyés pour être imprimés (noté pour le test
 * tablette). Ruling : « turbo actif » se lit au sommet (`turbo`), pas au contact : le turbo de l'étoile d'élan (3 s)
 * finit pendant le vol, et à l'atterrissage de la graine 2 il ne l'est plus.
 */
export function expectReceptionStars(rows: readonly ReceptionRow[], cfg: Config = CONFIG): ReceptionRow[] {
  const tolerated: ReceptionRow[] = [];
  for (const w of rows) {
    const clear = w.kind === 'tremplin' ? cfg.STAR_TREMPLIN_LANDING : cfg.STAR_FOSSE_LANDING;
    expect(w.touch, describeRow(w)).toBeLessThanOrEqual(clear - LANDING_MARGIN);
    const missed = w.lastMiss > clear - LANDING_MARGIN || w.stars.some((s) => !s.taken);
    if (missed && w.turbo) { tolerated.push(w); continue; }
    expect(w.lastMiss, describeRow(w)).toBeLessThanOrEqual(clear - LANDING_MARGIN);
    expect(w.stars.filter((s) => !s.taken), describeRow(w)).toEqual([]);
  }
  return tolerated;
}
