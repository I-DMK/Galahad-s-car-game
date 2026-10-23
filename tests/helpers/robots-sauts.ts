// Mesures des sauts des copains à 5 voitures (plan B, tâche 6, Step 3 ; addendum « bouton saut » §3, §4 et §6.8) :
// Galahad doigt posé avec le saut parfait aux fosses (`sauteurParfait`), graines données, trois courses par graine :
// les 4 copains avec les traits de saut de Pablo (bras « fonceurs »), avec ceux de Timothé (bras « prudents »), puis le
// tirage normal (chacun ses traits). Comparaison appariée par graine : seul le trait de saut change entre les deux bras.
//
// Par course, l'observateur relève chaque saut de copain :
// - étoile haute (tout saut hors de l'approche d'une fosse) : tentative ; prise au saut (une étoile haute prise dans les
//   STAR_TAKE_WINDOW s qui suivent) ou ratée ; réapparition dans les RESPAWN_WINDOW s ;
// - fosse : chaque approche [xLancement, xBord[ d'une fosse est une tentative, close par une chute dans la lave, un
//   passage (x > bord aval + 5 m) ou une autre réapparition ; vitesse au saut (au pas de la décision), ou à la chute
//   sans saut ; tentative 2 = la voiture est déjà tombée dans cette fosse (départ arrêté au point sûr), comptée par fosse
//   comme le driver (`CarSim.lavaFalls`), une autre réapparition ne la remet pas à 1.
// Les invariants de course (tests/helpers/race.ts) valent pour les trois courses. Mesure seule pour les taux ; assertions :
// au moins MIN_ATTEMPTS tentatives par bras, raté « fonceurs » > raté « prudents » aux étoiles hautes et aux fosses ;
// tâche 7 (élastique, copains jusqu'à 18,2 m/s, R-F16) : par bras, atterrissage le plus long d'un copain après le bord aval
// d'une fosse passée ≤ FOSSE_GHOST_AFTER − 5 (35 m).
import { PILOTS, type Pilot } from '../../src/cars/pilots';
import { CONFIG } from '../../src/config';
import { carSpeedMps } from '../../src/physics/car';
import { chassisX, type RaceSim } from '../../src/sim/simulate';
import { fosses } from '../../src/track/query';
import type { Fosse, Track } from '../../src/track/types';
import { stepFingerprint } from './fingerprint';
import { describeFlights, expectRaceInvariants, fiveCarRace, respawnsHorsFosses, type FiveCarRace } from './race';
import { f1, trackFor } from './runs';

/** s : une étoile haute prise dans cette durée après le saut est « prise au saut » ; sinon le saut est raté. */
export const STAR_TAKE_WINDOW = 2.5;
/** s : réapparition comptée après un saut d'étoile. */
export const RESPAWN_WINDOW = 3;
/** Tentatives exigées par bras (plan, puissance des mesures I7). */
export const MIN_ATTEMPTS = 40;

export type Arm = 'fonceurs' | 'prudents' | 'normal';
const PABLO = PILOTS.find((p) => p.id === 'pablo')!;
const TIMOTHE = PILOTS.find((p) => p.id === 'timothé')!;
const ARM_TRAITS: Record<Arm, Pick<Pilot, 'jumpTry' | 'jumpSkill'> | undefined> = {
  fonceurs: { jumpTry: PABLO.jumpTry, jumpSkill: PABLO.jumpSkill },
  prudents: { jumpTry: TIMOTHE.jumpTry, jumpSkill: TIMOTHE.jumpSkill },
  normal: undefined,
};

export interface StarAttempt { arm: Arm; seed: number; carId: string; t: number; x: number; speed: number; taken: boolean; respawn: boolean }
export interface FosseAttempt {
  arm: Arm; seed: number; carId: string; t: number; fosse: number; attempt: 1 | 2;
  jumped: boolean;
  /** Vitesse (m/s) au saut (pas de la décision), sinon à la chute. */
  speed: number;
  outcome: 'passe' | 'chute' | 'autre';
  /** Premier atterrissage après le saut, en m après le bord aval (xReception) ; null sans saut ou sans atterrissage relevé. */
  landing: number | null;
}
export interface RaceMeasure {
  arm: Arm; seed: number; stars: StarAttempt[]; fosses: FosseAttempt[];
  /** Sauts de copain (carId, t, x), dans l'ordre : déterminisme. */
  jumps: string[];
  /** Empreinte des pièces au dernier pas : déterminisme. */
  finalPrint: string;
  /** Réapparitions hors chutes dans une fosse, par copain ; chutes de copain aux tremplins. */
  otherRespawns: Record<string, number>;
  tremplinFalls: number;
  race: FiveCarRace;
}

interface OpenFosse { f: Fosse; index: number; attempt: 1 | 2; t: number; jumped: boolean; speed: number; landing: number | null }

/** Atterrissage le plus long exigé après le bord aval d'une fosse (tâche 7, tableau « Fosses » ; R-F16) : 35 m. */
export const FOSSE_LANDING_MAX = CONFIG.FOSSE_GHOST_AFTER - 5;

/** Observateur d'une course : sauts d'étoile et tentatives aux fosses de chaque copain. */
function observer(arm: Arm, seed: number, track: Track, out: { stars: StarAttempt[]; fosses: FosseAttempt[]; jumps: string[] }) {
  const fs = fosses(track);
  const highIds = new Set(track.stars.filter((s) => s.high).map((s) => s.id));
  const prevSpeed = new Map<string, number>();
  const openStars = new Map<string, StarAttempt[]>();
  const open = new Map<string, OpenFosse | null>();
  /** Chutes de chaque copain par fosse (clé « id/rang ») : tentative 2 dès une chute. */
  const fallsAt = new Map<string, number>();
  /** Tentative passée encore en l'air à sa clôture : son atterrissage est relevé au premier événement 'landing'. */
  const awaiting = new Map<string, FosseAttempt>();
  return (sim: RaceSim): void => {
    const t = sim.time;
    const galahad = sim.cars[0].state.id;
    for (const e of sim.events) {
      if (e.carId === galahad) continue;
      const mine = openStars.get(e.carId) ?? [];
      openStars.set(e.carId, mine);
      const o = open.get(e.carId) ?? null;
      if (e.type === 'jump') {
        out.jumps.push(`${e.carId} ${e.t.toFixed(4)} ${e.x.toFixed(4)}`);
        const inApproach = fs.some((f) => e.x >= f.xLancement && e.x <= f.xBord);
        if (inApproach) {
          if (o) { o.jumped = true; o.speed = prevSpeed.get(e.carId) ?? NaN; }
        } else {
          mine.push({ arm, seed, carId: e.carId, t: e.t, x: e.x, speed: prevSpeed.get(e.carId) ?? NaN, taken: false, respawn: false });
        }
      } else if (e.type === 'landing') {
        if (o && o.jumped && o.landing === null && e.x > o.f.xBord) o.landing = e.x - o.f.xReception;
        const a = awaiting.get(e.carId);
        if (a) {
          a.landing = e.x - fs[a.fosse].xReception;
          awaiting.delete(e.carId);
        }
      } else if (e.type === 'star' && highIds.has(e.id)) {
        const a = mine.find((s) => !s.taken && e.t - s.t <= STAR_TAKE_WINDOW);
        if (a) a.taken = true;
      } else if (e.type === 'respawn') {
        for (const s of mine) if (e.t - s.t <= RESPAWN_WINDOW) s.respawn = true;
        awaiting.delete(e.carId);
        if (o) {
          out.fosses.push({
            arm, seed, carId: e.carId, t: o.t, fosse: o.index, attempt: o.attempt, jumped: o.jumped,
            speed: o.jumped ? o.speed : prevSpeed.get(e.carId) ?? NaN, outcome: e.reason === 'lava' ? 'chute' : 'autre', landing: null,
          });
          if (e.reason === 'lava') fallsAt.set(`${e.carId}/${o.index}`, (fallsAt.get(`${e.carId}/${o.index}`) ?? 0) + 1);
          open.set(e.carId, null);
        }
      }
    }
    for (const car of sim.cars.slice(1)) {
      const id = car.state.id;
      const x = chassisX(car);
      // Étoiles : une tentative est close après STAR_TAKE_WINDOW (et la fenêtre de réapparition).
      const mine = openStars.get(id) ?? [];
      openStars.set(id, mine.filter((s) => {
        if (t - s.t <= Math.max(STAR_TAKE_WINDOW, RESPAWN_WINDOW)) return true;
        out.stars.push(s);
        return false;
      }));
      const o = open.get(id) ?? null;
      if (o && x > o.f.xReception + CONFIG.FOSSE_RESPAWN_AFTER) {
        const a: FosseAttempt = { arm, seed, carId: id, t: o.t, fosse: o.index, attempt: o.attempt, jumped: o.jumped, speed: o.speed, outcome: 'passe', landing: o.landing };
        out.fosses.push(a);
        if (o.jumped && o.landing === null) awaiting.set(id, a);
        open.set(id, null);
      }
      if (!open.get(id) && car.state.finishedAt === null) {
        const index = fs.findIndex((f) => x >= f.xLancement && x < f.xBord);
        if (index >= 0) {
          const f = fs[index];
          const attempt = (fallsAt.get(`${id}/${index}`) ?? 0) >= 1 ? 2 : 1;
          open.set(id, { f, index, attempt, t, jumped: false, speed: NaN, landing: null });
        }
      }
      prevSpeed.set(id, carSpeedMps(car.body));
    }
    // Fin de course : les tentatives d'étoile encore ouvertes sont closes telles quelles.
    if (sim.cars[0].state.finishedAt !== null && t >= sim.cars[0].state.finishedAt + CONFIG.FINISH_COAST_SECONDS - CONFIG.PHYSICS_DT - 1e-9) {
      for (const [id, mine] of openStars) { out.stars.push(...mine); openStars.set(id, []); }
    }
  };
}

/** Une course de la graine dans le bras donné, mesurée. */
export function measureRace(seed: number, arm: Arm): RaceMeasure {
  const track = trackFor(seed);
  const out = { stars: [] as StarAttempt[], fosses: [] as FosseAttempt[], jumps: [] as string[] };
  let last: RaceSim | null = null;
  const observe = observer(arm, seed, track, out);
  const race = fiveCarRace(seed, { traits: ARM_TRAITS[arm], observe: (sim) => { observe(sim); last = sim; } });
  const ids = Object.keys(race.r.respawnsByCar).filter((id) => id !== 'galahad');
  return {
    arm, seed, stars: out.stars, fosses: out.fosses, jumps: out.jumps,
    finalPrint: last ? stepFingerprint(last) : '',
    otherRespawns: Object.fromEntries(ids.map((id) => [id, respawnsHorsFosses(race, id)])),
    tremplinFalls: race.falls.filter((f) => f.carId !== 'galahad' && f.kind === 'tremplin').length,
    race,
  };
}

const pct = (k: number, n: number): string => (n === 0 ? '—' : `${k}/${n} (${((100 * k) / n).toFixed(1)} %)`);
const rate = (k: number, n: number): number => (n === 0 ? NaN : k / n);

/** Tranche de vitesse d'une tentative à une fosse : « départ arrêté (2e essai) » ou tranche de 2 m/s de la vitesse au saut. */
export function speedBin(a: FosseAttempt): string {
  if (a.attempt === 2) return 'arrêt (2e essai)';
  const lo = 2 * Math.floor(a.speed / 2);
  return Number.isFinite(lo) ? `${lo}–${lo + 2} m/s` : '?';
}

/** Taux de raté d'un ensemble : étoiles (sauts sans prise) et fosses (chutes par tentative). */
export const starMissRate = (s: StarAttempt[]): number => rate(s.filter((a) => !a.taken).length, s.length);
export const fosseFallRate = (f: FosseAttempt[]): number => rate(f.filter((a) => a.outcome === 'chute').length, f.filter((a) => a.outcome !== 'autre').length);

/** Tableau lisible d'un ensemble de tentatives (un bras, ou un pilote du tirage normal). */
export function describeAttempts(label: string, stars: StarAttempt[], fs: FosseAttempt[]): string {
  const counted = fs.filter((a) => a.outcome !== 'autre');
  const bins = [...new Set(counted.map(speedBin))].sort((a, b) => parseFloat(a) - parseFloat(b) || a.localeCompare(b));
  const byBin = bins.map((b) => {
    const xs = counted.filter((a) => speedBin(a) === b);
    const noJump = xs.filter((a) => !a.jumped).length;
    return `${b} ${pct(xs.filter((a) => a.outcome === 'chute').length, xs.length)}${noJump ? `, sans saut ${noJump}` : ''}`;
  });
  return `${label} : étoiles hautes ${stars.length} tentatives, ${stars.filter((a) => a.taken).length} prises au saut, `
    + `ratés ${pct(stars.filter((a) => !a.taken).length, stars.length)}, réapparitions dans les ${RESPAWN_WINDOW} s ${stars.filter((a) => a.respawn).length} ; `
    + `fosses ${counted.length} tentatives (sans saut ${counted.filter((a) => !a.jumped).length}, autres ${fs.length - counted.length}), `
    + `chutes ${pct(counted.filter((a) => a.outcome === 'chute').length, counted.length)} [${byBin.join(' ; ')}]`;
}

/** Accès à node (le projet n'a pas @types/node), au strict nécessaire. */
interface NodeFs { mkdirSync(path: string, opts: { recursive: boolean }): void; writeFileSync(path: string, data: string): void }
const fs = (): NodeFs => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }).process.getBuiltinModule('node:fs');

/**
 * Un fichier lent : graines `seeds`, trois courses par graine (bras « fonceurs », « prudents », tirage normal),
 * invariants de course à chaque course, puis comparaison des bras et tableau du tirage normal pilote par pilote
 * (sortie dans tests/slow/out/robots-sauts-<a>-<b>.json). `determinism` : une graine rejouée (tirage normal).
 */
export function registerRobotsSauts(seeds: number[], determinism?: number): void {
  const all: RaceMeasure[] = [];
  const name = `robots-sauts-${seeds[0]}-${seeds[seeds.length - 1]}`;
  describe(`sauts des copains à 5 voitures, graines ${seeds[0]} à ${seeds[seeds.length - 1]} (bras fonceurs / prudents / tirage normal)`, () => {
    test.each(seeds)('seed %i : trois courses, invariants de course, aucun saut de copain dans la zone d’un tremplin', (seed) => {
      for (const arm of ['fonceurs', 'prudents', 'normal'] as const) {
        const m = measureRace(seed, arm);
        all.push(m);
        console.log(`[${arm}] ${m.race.summary}\n  ${describeAttempts(`[${arm}] g${seed}`, m.stars, m.fosses)}`);
        expectRaceInvariants(m.race);
        expect(m.fosses.filter((a) => a.outcome === 'autre').length, m.race.summary).toBeLessThanOrEqual(1);
      }
    });

    if (determinism !== undefined) {
      test(`déterminisme : graine ${determinism} rejouée, même empreinte finale et mêmes sauts`, () => {
        const a = measureRace(determinism, 'normal');
        const b = measureRace(determinism, 'normal');
        expect(a.jumps.length).toBeGreaterThan(0);
        expect(b.jumps).toEqual(a.jumps);
        expect(b.finalPrint).toBe(a.finalPrint);
      });
    }

    afterAll(() => {
      const arm = (k: Arm) => all.filter((m) => m.arm === k);
      const stars = (ms: RaceMeasure[]) => ms.flatMap((m) => m.stars);
      const fos = (ms: RaceMeasure[]) => ms.flatMap((m) => m.fosses);
      const lines = (['fonceurs', 'prudents', 'normal'] as const).map((k) => {
        const falls = arm(k).flatMap((m) => m.race.falls).filter((f) => f.carId !== 'galahad');
        const causes = (['fosse', 'choc', 'sans-tentative', 'propre'] as const).map((c) => `${c} ${falls.filter((f) => f.cause === c).length}`);
        return `${describeAttempts(`bras ${k}`, stars(arm(k)), fos(arm(k)))}\n  chutes de copain par cause : ${causes.join(', ')} ; ${describeFlights(falls)}`;
      });
      const normal = arm('normal');
      const pilots = PILOTS.map((p) => describeAttempts(`  ${p.name} (${p.jumpTry} / ${p.jumpSkill})`,
        stars(normal).filter((a) => a.carId === p.id), fos(normal).filter((a) => a.carId === p.id)));
      const respawns = all.flatMap((m) => Object.values(m.otherRespawns));
      console.log(`=== ${name} (${seeds.length} graines) ===\n${lines.join('\n')}\ntirage normal, pilote par pilote :\n${pilots.join('\n')}\n`
        + `réapparitions hors fosses par copain et par course : max ${Math.max(...respawns)}, moyenne ${f1(respawns.reduce((a, b) => a + b, 0) / respawns.length)}`);
      fs().mkdirSync('tests/slow/out', { recursive: true });
      fs().writeFileSync(`tests/slow/out/${name}.json`, JSON.stringify(all.map(({ race, ...m }) => ({ ...m, summary: race.summary, falls: race.falls }))));
    });

    test(`tâche 7 (élastique) : par bras, atterrissage le plus long d'un copain après le bord aval d'une fosse passée ≤ FOSSE_GHOST_AFTER − 5 (${FOSSE_LANDING_MAX} m)`, () => {
      const lines = (['fonceurs', 'prudents', 'normal'] as const).map((k) => {
        const passes = all.filter((m) => m.arm === k).flatMap((m) => m.fosses).filter((a) => a.outcome === 'passe' && a.jumped);
        const landed = passes.filter((a) => a.landing !== null);
        const longest = landed.reduce<FosseAttempt | null>((b, a) => (b === null || a.landing! > b.landing! ? a : b), null);
        return { k, passes: passes.length, landed: landed.length, longest };
      });
      const what = lines.map((l) => `${l.k} : ${l.passes} sauts passés, ${l.landed} atterrissages relevés, le plus long `
        + `${l.longest ? `${f1(l.longest.landing!)} m (g${l.longest.seed} ${l.longest.carId}, fosse ${l.longest.fosse}, ${f1(l.longest.speed)} m/s au saut)` : '—'}`).join(' ; ');
      console.log(`atterrissages après une fosse (tâche 7) : ${what}`);
      for (const l of lines) {
        expect(l.landed, what).toBeGreaterThan(0);
        expect(l.longest!.landing!, what).toBeLessThanOrEqual(FOSSE_LANDING_MAX);
      }
    });

    test('fonceurs contre prudents (appariés par graine) : au moins 40 tentatives par bras, les fonceurs ratent plus, aux étoiles hautes et aux fosses', () => {
      const of = (k: Arm) => all.filter((m) => m.arm === k);
      const [sF, sP] = (['fonceurs', 'prudents'] as const).map((k) => of(k).flatMap((m) => m.stars));
      const [fF, fP] = (['fonceurs', 'prudents'] as const).map((k) => of(k).flatMap((m) => m.fosses).filter((a) => a.outcome !== 'autre'));
      const what = `étoiles ${describeAttempts('fonceurs', sF, fF)} | ${describeAttempts('prudents', sP, fP)}`;
      expect(of('fonceurs').length, what).toBe(seeds.length);
      expect(sF.length, what).toBeGreaterThanOrEqual(MIN_ATTEMPTS);
      expect(sP.length, what).toBeGreaterThanOrEqual(MIN_ATTEMPTS);
      expect(fF.length, what).toBeGreaterThanOrEqual(MIN_ATTEMPTS);
      expect(fP.length, what).toBeGreaterThanOrEqual(MIN_ATTEMPTS);
      expect(starMissRate(sF), what).toBeGreaterThan(starMissRate(sP));
      expect(fosseFallRate(fF), what).toBeGreaterThan(fosseFallRate(fP));
    });
  });
}
