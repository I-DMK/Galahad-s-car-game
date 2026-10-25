// Chocs des copains contre les rochers à 5 voitures (plan C, tâche 11c, Step 18 ; spec « rochers » §4 et §6), sur le modèle
// de `robots-sauts.ts` : Galahad doigt posé, sauteur parfait (fosses et rochers), graines données, trois courses par
// graine : les 4 copains avec les traits de saut de Pablo (bras « fonceurs »), avec ceux de Timothé (« prudents »), puis
// le tirage normal. Par course, l'observateur relève, pour chaque voiture, les rochers rencontrés (châssis passé au-delà
// de xEnd, ou choc) et les chocs ('rock'), et toute réapparition d'une voiture dans les ROCK_RESPAWN_WINDOW s qui suivent
// son choc (0 attendue : un rocher ne cause jamais de réapparition, spec §0).
// Assertions : fonceurs 15 à 45 % de chocs par rocher rencontré, prudents ≤ 2 %, tirage normal entre les deux ;
// 0 réapparition après un choc ; invariants de course (`expectRaceInvariants`).
import { PILOTS, type Pilot } from '../../src/cars/pilots';
import { carSpeedMps } from '../../src/physics/car';
import { chassisX, type RaceSim } from '../../src/sim/simulate';
import type { Track } from '../../src/track/types';
import { expectRaceInvariants, fiveCarRace, type FiveCarRace } from './race';
import { f1, trackFor } from './runs';

/** s : une réapparition dans cette durée après le choc d'une voiture contre un rocher est un défaut (spec §0). */
export const ROCK_RESPAWN_WINDOW = 3;

export type Arm = 'fonceurs' | 'prudents' | 'normal';
const PABLO = PILOTS.find((p) => p.id === 'pablo')!;
const TIMOTHE = PILOTS.find((p) => p.id === 'timothé')!;
const ARM_TRAITS: Record<Arm, Pick<Pilot, 'jumpTry' | 'jumpSkill'> | undefined> = {
  fonceurs: { jumpTry: PABLO.jumpTry, jumpSkill: PABLO.jumpSkill },
  prudents: { jumpTry: TIMOTHE.jumpTry, jumpSkill: TIMOTHE.jumpSkill },
  normal: undefined,
};

/** Rocher rencontré par une voiture : choc ou pas, vitesse du châssis au pas qui précède le choc ou le passage. */
export interface RockEncounter { arm: Arm; seed: number; carId: string; rock: number; hit: boolean; speed: number }
export interface RockMeasure {
  arm: Arm; seed: number; encounters: RockEncounter[];
  /** Réapparitions d'une voiture dans les ROCK_RESPAWN_WINDOW s après son choc (« id t = … ») : vide attendu. */
  rockRespawns: string[];
  race: FiveCarRace;
}

/** Observateur : rochers rencontrés et chocs de chaque voiture, réapparitions après un choc. */
function observer(arm: Arm, seed: number, track: Track, out: { encounters: RockEncounter[]; rockRespawns: string[] }) {
  const done = new Set<string>();
  const lastHit = new Map<string, number>();
  const prevSpeed = new Map<string, number>();
  return (sim: RaceSim): void => {
    for (const e of sim.events) {
      if (e.type === 'rock') {
        lastHit.set(e.carId, e.t);
        const key = `${e.carId}/${e.id}`;
        if (!done.has(key)) {
          done.add(key);
          out.encounters.push({ arm, seed, carId: e.carId, rock: e.id, hit: true, speed: prevSpeed.get(e.carId) ?? NaN });
        }
      } else if (e.type === 'respawn') {
        const h = lastHit.get(e.carId);
        if (h !== undefined && e.t - h <= ROCK_RESPAWN_WINDOW) out.rockRespawns.push(`${e.carId} t = ${f1(e.t)} s (${e.reason}, choc à ${f1(h)} s)`);
      }
    }
    for (const car of sim.cars) {
      const id = car.state.id;
      const x = chassisX(car);
      track.rocks.forEach((r) => {
        const key = `${id}/${r.id}`;
        if (!done.has(key) && x > r.xEnd) {
          done.add(key);
          out.encounters.push({ arm, seed, carId: id, rock: r.id, hit: false, speed: prevSpeed.get(id) ?? NaN });
        }
      });
      prevSpeed.set(id, carSpeedMps(car.body));
    }
  };
}

/** Une course de la graine dans le bras donné, mesurée. */
export function measureRockRace(seed: number, arm: Arm): RockMeasure {
  const track = trackFor(seed);
  const out = { encounters: [] as RockEncounter[], rockRespawns: [] as string[] };
  const race = fiveCarRace(seed, { traits: ARM_TRAITS[arm], jump: 'parfait', observe: observer(arm, seed, track, out) });
  return { arm, seed, encounters: out.encounters, rockRespawns: out.rockRespawns, race };
}

const pct = (k: number, n: number): string => (n === 0 ? '—' : `${k}/${n} (${((100 * k) / n).toFixed(1)} %)`);
/** Chocs par rocher rencontré (copains seulement). */
export const hitRate = (es: RockEncounter[]): number => {
  const xs = es.filter((e) => e.carId !== 'galahad');
  return xs.length === 0 ? NaN : xs.filter((e) => e.hit).length / xs.length;
};
const describe1 = (label: string, es: RockEncounter[]): string => {
  const xs = es.filter((e) => e.carId !== 'galahad');
  return `${label} : chocs ${pct(xs.filter((e) => e.hit).length, xs.length)} par rocher rencontré`;
};

/** Accès à node (le projet n'a pas @types/node), au strict nécessaire. */
interface NodeFs { mkdirSync(path: string, opts: { recursive: boolean }): void; writeFileSync(path: string, data: string): void }
const fs = (): NodeFs => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }).process.getBuiltinModule('node:fs');

/**
 * Un fichier lent : graines `seeds`, trois courses par graine (bras « fonceurs », « prudents », tirage normal),
 * invariants de course et aucune réapparition après un choc à chaque course, puis taux de chocs par bras (sortie dans
 * tests/slow/out/robots-rochers-<a>-<b>.json).
 */
export function registerRobotsRochers(seeds: number[]): void {
  const all: RockMeasure[] = [];
  const name = `robots-rochers-${seeds[0]}-${seeds[seeds.length - 1]}`;
  describe(`chocs des copains contre les rochers à 5 voitures, graines ${seeds[0]} à ${seeds[seeds.length - 1]} (bras fonceurs / prudents / tirage normal)`, () => {
    test.each(seeds)('seed %i : trois courses, invariants de course, aucune réapparition dans les 3 s après un choc', (seed) => {
      for (const arm of ['fonceurs', 'prudents', 'normal'] as const) {
        const m = measureRockRace(seed, arm);
        all.push(m);
        const g = m.encounters.filter((e) => e.carId === 'galahad');
        console.log(`[${arm}] ${m.race.summary}\n  ${describe1(`[${arm}] g${seed}`, m.encounters)} ; Galahad (sauteur parfait) ${g.filter((e) => e.hit).length}/${g.length}`);
        expect(m.rockRespawns, m.race.summary).toEqual([]);
        expectRaceInvariants(m.race);
      }
    });

    afterAll(() => {
      const arm = (k: Arm) => all.filter((m) => m.arm === k).flatMap((m) => m.encounters);
      const lines = (['fonceurs', 'prudents', 'normal'] as const).map((k) => describe1(`bras ${k}`, arm(k)));
      const normal = arm('normal');
      const pilots = PILOTS.map((p) => describe1(`  ${p.name} (jumpSkill ${p.jumpSkill})`, normal.filter((e) => e.carId === p.id)));
      const g = all.flatMap((m) => m.encounters).filter((e) => e.carId === 'galahad');
      console.log(`=== ${name} (${seeds.length} graines) ===\n${lines.join('\n')}\ntirage normal, pilote par pilote :\n${pilots.join('\n')}\n`
        + `Galahad sauteur parfait : ${pct(g.filter((e) => e.hit).length, g.length)}`);
      fs().mkdirSync('tests/slow/out', { recursive: true });
      fs().writeFileSync(`tests/slow/out/${name}.json`, JSON.stringify(all.map(({ race, ...m }) => ({ ...m, summary: race.summary }))));
    });

    test('taux de chocs par bras : fonceurs 15 à 45 % par rocher rencontré, prudents ≤ 2 %, tirage normal entre les deux', () => {
      const rates = (['fonceurs', 'prudents', 'normal'] as const).map((k) => hitRate(all.filter((m) => m.arm === k).flatMap((m) => m.encounters)));
      const what = (['fonceurs', 'prudents', 'normal'] as const).map((k, i) => `${k} ${(100 * rates[i]).toFixed(1)} %`).join(', ');
      console.log(`chocs par rocher rencontré : ${what}`);
      const [fonceurs, prudents, normal] = rates;
      expect(fonceurs, what).toBeGreaterThanOrEqual(0.15);
      expect(fonceurs, what).toBeLessThanOrEqual(0.45);
      expect(prudents, what).toBeLessThanOrEqual(0.02);
      expect(normal, what).toBeGreaterThanOrEqual(prudents);
      expect(normal, what).toBeLessThanOrEqual(fonceurs);
    });
  });
}
