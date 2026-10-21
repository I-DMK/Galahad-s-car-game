// Balayage de dosage (addendum §1.6, tâche 4, tour de correction 1). Les départs arrêtés à une
// position relative fixe donnent une seule trajectoire par géométrie : les tableaux se mesurent sur
// le premier volcan de la graine 0. Trois tableaux imprimés (silent: false) :
//  (a) L_ELAN de 3 à 12 m au pas de 0,25 (cfg surchargé, piste regénérée) : cas 1 (arrêt à
//      xElanStart) et cas 2 (pire point sûr) — vitesse au pied de la rampe, au sommet, issue,
//      atterrissage ;
//  (b) à CONFIG.L_ELAN, « doigt levé pendant T s puis gaz » : lancée à V_MAX depuis xLancement,
//      relâche à xElanStart − 10 pendant T, puis doigt posé ;
//  (c) à CONFIG.L_ELAN, arrêt complet à xElanStart − k.
// Chaque ligne est poussée dans le tableau avant toute assertion. Assertion conservée : à
// CONFIG.L_ELAN, le cas 1 tombe et le cas 2 passe. Puis bissection du seuil de franchissement au
// sommet (LIP_SPEED_THRESHOLD) sur tous les volcans des graines 0 à 2, min / max imprimés.
import { CONFIG, type Config } from '../../src/config';
import type { World } from '../../src/physics/world';
import type { Volcano } from '../../src/track/types';
import { expectFalls, expectPasses, passesVolcano, scenariosFor } from '../helpers/cases';
import {
  LIP_SPEED_THRESHOLD, buildWorld, f1, f2, runFrom, worldFor, type RunResult,
} from '../helpers/runs';

const SEEDS = [0, 1, 2];
const TABLE_SEED = 0;
const L_ELAN_FROM = 3;
const L_ELAN_TO = 12;
const L_ELAN_STEP = 0.25;
const L_ELANS = Array.from({ length: Math.round((L_ELAN_TO - L_ELAN_FROM) / L_ELAN_STEP) + 1 }, (_, i) => L_ELAN_FROM + i * L_ELAN_STEP);
/** (b) : relâche du doigt à xElanStart − 10 pendant T s. */
const RELEASE_BEFORE_ELAN = 10;
const RELEASE_SECONDS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4];
/** (c) : arrêt complet à xElanStart − k. */
const STOP_BEFORE_ELAN = [0, 1, 2, 3, 4, 6, 8, 10];
const RUN_SECONDS = 20;
/**
 * Le seuil est une bande, pas un nombre : la roue arrière frappe l'arête du sommet 0 à 0,4 m après la
 * lecture de la vitesse et ce coup décide de la trajectoire ; la phase de rebond dépend du départ (roue
 * arrière posée sur le relief précédent quand on part de xLancement). Mesuré (roues bridées) : tombe
 * 9,54–10,26, passe 9,84–10,47 m/s. Le haut de la bande doit rester sous LIP_SPEED_THRESHOLD + tolérance,
 * elle-même sous la marge +1 m/s exigée du cas 2.
 */
const BAND_TOLERANCE = 0.5;

const outcome = (r: RunResult, v: Volcano): string => (r.lava ? 'lave ' : passesVolcano(r, v) ? 'passe' : 'autre');
const cell = (r: RunResult, v: Volcano): string =>
  `pied ${f2(r.rampSpeed)} sommet ${f2(r.lipSpeed)} → ${outcome(r, v)} atterrissage ${f1(r.landX)}`;

const firstVolcano = (world: World): Volcano => {
  const v = world.track.volcanoes[0];
  if (!v) throw new Error(`graine ${world.track.seed} sans volcan`);
  return v;
};

describe(`(a) L_ELAN de ${L_ELAN_FROM} à ${L_ELAN_TO} m au pas de ${L_ELAN_STEP}, premier volcan de la graine ${TABLE_SEED}`, () => {
  const rows: string[] = [];
  test.each(L_ELANS)('L_ELAN = %s m', (lElan) => {
    const cfg: Config = { ...CONFIG, L_ELAN: lElan };
    const world = buildWorld(TABLE_SEED, cfg);
    const v = firstVolcano(world);
    const [c1] = scenariosFor(1, world.track, v, cfg);
    const [c2] = scenariosFor(2, world.track, v, cfg);
    const r1 = runFrom(world, c1.x0, c1.opts);
    const r2 = runFrom(world, c2.x0, c2.opts);
    const isConfig = Math.abs(lElan - CONFIG.L_ELAN) < 1e-9;
    rows.push(`L_ELAN ${lElan.toFixed(2).padStart(5)} m | cas 1 : ${cell(r1, v)} | cas 2 : ${cell(r2, v)}${isConfig ? '  ← CONFIG' : ''}`);
    if (isConfig) {
      expectFalls(r1, v, `cas 1 à CONFIG.L_ELAN : ${cell(r1, v)}`);
      expectPasses(r2, v, `cas 2 (pire point sûr) à CONFIG.L_ELAN : ${cell(r2, v)}`);
    }
  });
  afterAll(() => {
    console.log(`(a) tableau de dosage, graine ${TABLE_SEED}, lave à ${f1(firstVolcano(worldFor(TABLE_SEED)).xLava)}, réception à ${f1(firstVolcano(worldFor(TABLE_SEED)).xReception)}\n${rows.join('\n')}`);
  });
});

describe(`(b) à CONFIG.L_ELAN (${CONFIG.L_ELAN} m) : lancée à V_MAX, doigt levé pendant T s à partir de xElanStart − ${RELEASE_BEFORE_ELAN}, puis gaz`, () => {
  const rows: string[] = [];
  test.each(RELEASE_SECONDS)('T = %s s', (T) => {
    const world = worldFor(TABLE_SEED);
    const v = firstVolcano(world);
    const xRelease = v.xElanStart - RELEASE_BEFORE_ELAN;
    let releasedAt: number | null = null;
    const throttle = (t: number, x: number): boolean => {
      if (releasedAt === null && x >= xRelease) releasedAt = t;
      return releasedAt === null || t >= releasedAt + T;
    };
    const r = runFrom(world, v.xLancement, { throttle, maxSeconds: RUN_SECONDS, volcano: v });
    rows.push(`T ${T.toFixed(1)} s | ${cell(r, v)}`);
    expect(r.lipSpeed).not.toBeNull();
  });
  afterAll(() => console.log(`(b) doigt levé T s puis gaz, graine ${TABLE_SEED}\n${rows.join('\n')}`));
});

describe(`(c) à CONFIG.L_ELAN (${CONFIG.L_ELAN} m) : arrêt complet à xElanStart − k, doigt posé`, () => {
  const rows: string[] = [];
  test.each(STOP_BEFORE_ELAN)('k = %i m', (k) => {
    const world = worldFor(TABLE_SEED);
    const v = firstVolcano(world);
    const r = runFrom(world, v.xElanStart - k, { throttle: () => true, maxSeconds: RUN_SECONDS, volcano: v });
    rows.push(`k ${String(k).padStart(2)} m | ${cell(r, v)}`);
    expect(r.lipSpeed).not.toBeNull();
    if (k === 0) expectFalls(r, v, `k = 0 (cas 1) : ${cell(r, v)}`);
  });
  afterAll(() => console.log(`(c) arrêt à xElanStart − k, graine ${TABLE_SEED}\n${rows.join('\n')}`));
});

describe('bissection du seuil de franchissement au sommet (LIP_SPEED_THRESHOLD)', () => {
  test(`sur tous les volcans des graines ${SEEDS.join(', ')} : la plus grande vitesse qui tombe est < ${LIP_SPEED_THRESHOLD} + ${BAND_TOLERANCE} m/s`, () => {
    const falls: number[] = [];
    const passes: number[] = [];
    const lines: string[] = [];
    for (const seed of SEEDS) {
      const world = worldFor(seed);
      for (const v of world.track.volcanoes) {
        // Norme de la vitesse ramenée à `cap` jusqu'au sommet, roues bridées au roulement (sinon la roue
        // arrière pousse encore sur l'arête après la lecture : bande « tombe » jusqu'à 10,13 m/s mesurée
        // roues libres). Bissection sur `cap`, lecture de lipSpeed (dernier pas libre).
        const probe = (cap: number) => {
          const r = runFrom(world, v.xLancement, { throttle: () => true, speedCapUntil: { x: v.xLip, v: cap, wheels: true }, maxSeconds: RUN_SECONDS, volcano: v });
          return { cap, lip: r.lipSpeed ?? NaN, ok: passesVolcano(r, v) };
        };
        let lo = probe(7);
        let hi = probe(12);
        expect(lo.ok, `seed ${seed}, volcan ${f1(v.xLancement)} : plafond 7 m/s devrait tomber (sommet ${f2(lo.lip)})`).toBe(false);
        expect(hi.ok, `seed ${seed}, volcan ${f1(v.xLancement)} : plafond 12 m/s devrait passer (sommet ${f2(hi.lip)})`).toBe(true);
        for (let k = 0; k < 8; k++) {
          const mid = probe((lo.cap + hi.cap) / 2);
          if (mid.ok) hi = mid; else lo = mid;
        }
        lines.push(`seed ${seed}, volcan ${f1(v.xLancement)} : tombe à ${f2(lo.lip)} m/s, passe à ${f2(hi.lip)} m/s (plafonds ${f2(lo.cap)} / ${f2(hi.cap)})`);
        falls.push(lo.lip);
        passes.push(hi.lip);
      }
    }
    const band = `tombe : ${f2(Math.min(...falls))}–${f2(Math.max(...falls))} ; passe : ${f2(Math.min(...passes))}–${f2(Math.max(...passes))}`;
    console.log(`bissection du seuil (LAVA_MARGIN ${CONFIG.LAVA_MARGIN}, capteur +${CONFIG.LAVA_SENSOR_ABOVE_RIM} m, ${falls.length} volcans)\n${lines.join('\n')}\n→ ${band} ; LIP_SPEED_THRESHOLD = ${LIP_SPEED_THRESHOLD}`);
    expect(falls.length).toBeGreaterThan(0);
    expect(Math.max(...falls), band).toBeLessThan(LIP_SPEED_THRESHOLD + BAND_TOLERANCE);
    expect(Math.min(...falls), band).toBeLessThan(LIP_SPEED_THRESHOLD);
    expect(Math.min(...passes), band).toBeGreaterThan(Math.min(...falls));
  });
});
