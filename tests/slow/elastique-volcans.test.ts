// Budget : < 15 min mur (MESURÉ 8 min 19 à 8 min 40, machine chargée, avec les 5 courses de « Galahad arrêté » ; ≈ 2 200
// runs en monde rogné ; la marche 1,3 → 1,0 au pied, 1 836 runs, est dans elastique-volcans-marche.test.ts ; Galahad arrêté
// avec les copains derrière, 24 courses à 5 voitures depuis le tour 1, dans elastique-volcans-arret.test.ts). Volcans sous élastique
// (plan B, tâche 7, Step 4 ; Review Focus n° 1 et n° 3 de la tâche ; addendum §1.8, spec §7) : un copain sous le vrai
// élastique, forcé par son `rubber` et par la position de Galahad garé (protocole : tests/helpers/elastique-volcans.ts),
// sur tous les volcans des graines 0 à 9 :
// - Review Focus n° 3 : copain freiné à 0,6 (Galahad 150 m derrière) qui aborde un volcan ; variante « réapparu à
//   xLancement + 1 avec 0,6 » ; exigé : facteur ≥ 1 à chaque pas de [xLancement, xLava], tremplin sans lave et sommet
//   ≥ LIP_SPEED_THRESHOLD + 1, fosse passée par un saut sans erreur ;
// - tremplins à 1,3 (plafond et couple) : arrêt au pire point sûr et en − 30 (départs décalés de 0,05 m), lancée à
//   18,2 m/s (décalée de 0,37 m) ; exigé : 0 chute, atterrissage avant xEnd − 10, garde ≥ 0,3 m ;
// - fosses à 1,3 : saut centré et saut le plus tardif permis (10 phases) ; exigé : atterrissage ≤ bord aval + 35 m,
//   0 chute au saut centré ; imprimé : chutes par tranche de vitesse, facteur au saut, chutes sans saut (copain encore en
//   l'air, au-delà de la tolérance de sol, quand tombe la demande la plus tardive : MESURÉ 1 sur 180, comme la relecture
//   adversariale) ;
// - plats étoile à 1,3, lancée à 18,2 m/s, sans saut : 0 prise ;
// - départ à 0,6 (couple 0,6) au pied des bosses, double-bosses et rampes-saut : 0 réapparition.
import { CONFIG } from '../../src/config';
import { fosses, tremplins } from '../../src/track/query';
import type { Track } from '../../src/track/types';
import {
  AHEAD, BEHIND, clearWorlds, LIP_MIN, MIN_GUARD, elasticRun, f1, f2, fosseDriver, latestError, range, worstSafe,
  type ElasticRun,
} from '../helpers/elastique-volcans';
import { FOSSE_LANDING_MAX } from '../helpers/robots-sauts';
import { trackFor } from '../helpers/runs';

const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const PHASES = 10;
const centred = (track: Track) => fosseDriver(track, () => 0);

describe('volcans sous élastique, graines 0 à 9 (vrai élastique, copain forcé)', () => {
  afterEach(() => clearWorlds());

  test('Review Focus n° 3 : copain freiné à 0,6 loin devant (Galahad 150 m derrière) qui aborde chaque volcan ; variante réapparu à xLancement + 1 avec 0,6', () => {
    const rows: string[] = [];
    const fails: string[] = [];
    const lanc: number[] = []; const lip: number[] = []; const bord: number[] = [];
    let n = 0;
    for (const seed of SEEDS) {
      const track = trackFor(seed);
      track.volcanoes.forEach((v, vi) => {
        const prev = track.volcanoes[vi - 1];
        const starts: [string, number, number][] = [
          ['lancé à 8,4 m/s, 100 m avant', Math.max(v.xLancement - 100, prev ? prev.xEnd + 1 : track.xStart), 0.6 * CONFIG.V_MAX],
          ['réapparu à xLancement + 1', v.xLancement + 1, 0],
        ];
        for (const [name, x0, v0] of starts) {
          n++;
          const marks: Record<string, number> = { lancement: v.xLancement, ...(v.kind === 'tremplin' ? { sommet: v.xLip } : { bord: v.xBord }) };
          const r = elasticRun({
            track, x0, v0, rubber0: 0.6, xG: Math.max(5, x0 - BEHIND), xStop: v.xReception + 25, maxSeconds: 40,
            xLandAfter: v.kind === 'tremplin' ? v.xLip : v.xBord, driver: centred(track), volcano: v, marks,
          });
          const what = `g${seed} ${v.kind} ${f1(v.xLancement)} (${name}) : facteur au 1er pas ${f2(r.firstFactor)}, min dans la zone ${f2(r.minZoneFactor)} `
            + `(${r.zoneSteps} pas), lancement ${f2(r.speedAt.lancement)} m/s, ${v.kind === 'tremplin' ? `sommet ${f2(r.speedAt.sommet)}` : `bord ${f2(r.speedAt.bord)}`} m/s, `
            + `atterrissage ${r.landX === null ? '—' : f1(r.landX - v.xReception)} m après la réception, réapparitions [${r.respawns.join(', ')}]`;
          rows.push(what);
          if (name.startsWith('lancé')) {
            if (r.speedAt.lancement !== undefined) lanc.push(r.speedAt.lancement);
            if (r.speedAt.sommet !== undefined) lip.push(r.speedAt.sommet);
            if (r.speedAt.bord !== undefined) bord.push(r.speedAt.bord);
          }
          const ok = r.zoneSteps > 0 && r.minZoneFactor >= 1 && r.respawns.length === 0 && r.landX !== null
            && (v.kind !== 'tremplin' || (r.speedAt.sommet ?? 0) >= LIP_MIN)
            && (!name.startsWith('réapparu') || r.firstFactor >= 1);
          if (!ok) fails.push(what);
        }
      });
    }
    console.log(`Review Focus n° 3 : ${n} runs ; vitesse à xLancement ${range(lanc)} m/s, au sommet ${range(lip)} m/s, au bord ${range(bord)} m/s\n  ${rows.join('\n  ')}`);
    expect(n).toBeGreaterThanOrEqual(60);
    expect(fails).toEqual([]);
  });

  test('tremplins à 1,3 (plafond et couple) : pire point sûr, arrêt en − 30, lancée à 18,2 m/s, 10 phases : 0 chute, atterrissage avant xEnd − 10, garde ≥ 0,3 m', () => {
    const fams: Record<string, { n: number; guard: number[]; lip: number[]; margin: number[]; vmax: number[]; fails: string[] }> = {};
    for (const seed of SEEDS) {
      const track = trackFor(seed);
      for (const v of tremplins(track)) {
        for (let k = 0; k < PHASES; k++) {
          const cases: [string, number, number][] = [
            ['pire point sûr, arrêt', worstSafe(v) - 0.05 * k, 0],
            ['arrêt en − 30', v.xLancement - 30 - 0.05 * k, 0],
            ['lancée à 18,2 m/s en − 45', v.xLancement - 45 - 0.37 * k, 1.3 * CONFIG.V_MAX],
          ];
          for (const [name, x0, v0] of cases) {
            const r = elasticRun({
              track, x0, v0, rubber0: 1.3, xG: v.xEnd + AHEAD, xStop: v.xEnd, maxSeconds: 25, xLandAfter: v.xLip, volcano: v,
              marks: { sommet: v.xLip }, driver: centred(track),
            });
            const fam = (fams[name] ??= { n: 0, guard: [], lip: [], margin: [], vmax: [], fails: [] });
            fam.n++;
            fam.guard.push(r.guard);
            if (r.speedAt.sommet !== undefined) fam.lip.push(r.speedAt.sommet);
            if (r.landX !== null) fam.margin.push(v.xEnd - r.landX);
            fam.vmax.push(r.maxSpeed);
            const ok = r.lava === 0 && r.respawns.length === 0 && !r.flipped && r.landX !== null && r.landX <= v.xEnd - 10
              && r.guard >= MIN_GUARD && r.maxFactor <= 1.3 && r.minZoneFactor >= 1.3 - 1e-12;
            if (!ok) fam.fails.push(`g${seed} ${f1(v.xLancement)} k${k} : lave ${r.lava}, [${r.respawns.join(', ')}], garde ${f2(r.guard)}, atterrissage ${f1(r.landX)} (xEnd ${f1(v.xEnd)}), facteur ${f2(r.minZoneFactor)}`);
          }
        }
      }
    }
    for (const [name, f] of Object.entries(fams)) {
      console.log(`tremplins à 1,3, ${name} : ${f.n} runs, échecs ${f.fails.length} ; garde min ${f2(Math.min(...f.guard))} m ; sommet ${range(f.lip)} m/s ; `
        + `marge avant xEnd min ${f1(Math.min(...f.margin))} m ; vitesse maximale conduite ${f1(Math.max(...f.vmax))} m/s${f.fails.length ? `\n  ${f.fails.join('\n  ')}` : ''}`);
    }
    for (const f of Object.values(fams)) {
      expect(f.n).toBeGreaterThanOrEqual(150);
      expect(f.fails).toEqual([]);
    }
  });

  test('fosses à 1,3 : saut centré et saut le plus tardif permis, 10 phases : atterrissage ≤ bord aval + 35 m, 0 chute au saut centré ; chutes par tranche de vitesse imprimées', () => {
    const fams: Record<string, { runs: ElasticRun[]; land: number[]; fails: string[]; noJump: string[]; bins: Map<string, [number, number]>; jumpS: number[]; edge: number[]; jf: number[] }> = {};
    for (const seed of SEEDS) {
      const track = trackFor(seed);
      for (const f of fosses(track)) {
        for (let k = 0; k < PHASES; k++) {
          const x0 = f.xLancement - CONFIG.FOSSE_GUARD - 40 - 0.37 * k;
          for (const [name, driver] of [['centré', centred(track)], ['le plus tardif permis', fosseDriver(track, (v) => latestError(v))]] as const) {
            const r = elasticRun({
              track, x0, v0: 1.3 * CONFIG.V_MAX, rubber0: 1.3, xG: f.xEnd + AHEAD, xStop: f.xEnd, maxSeconds: 20, xLandAfter: f.xBord,
              volcano: f, marks: { bord: f.xBord }, driver,
            });
            const fam = (fams[name] ??= { runs: [], land: [], fails: [], noJump: [], bins: new Map(), jumpS: [], edge: [], jf: [] });
            fam.runs.push(r);
            if (r.jumpX !== null) fam.jumpS.push(f.xBord - r.jumpX);
            if (r.speedAt.bord !== undefined) fam.edge.push(r.speedAt.bord);
            if (r.jumpFactor !== null) fam.jf.push(r.jumpFactor);
            const bin = r.jumpSpeed === null ? 'sans saut' : `${2 * Math.floor(r.jumpSpeed / 2)}–${2 * Math.floor(r.jumpSpeed / 2) + 2} m/s`;
            const b = fam.bins.get(bin) ?? [0, 0];
            fam.bins.set(bin, [b[0] + (r.lava > 0 ? 1 : 0), b[1] + 1]);
            if (r.lava === 0 && r.landX !== null) fam.land.push(r.landX - f.xReception);
            const landOk = r.lava > 0 || (r.landX !== null && r.landX - f.xReception <= FOSSE_LANDING_MAX);
            const ok = landOk && (name !== 'centré' || (r.lava === 0 && r.jumpX !== null)) && r.respawns.every((x) => x === 'lava')
              && (r.jumpX !== null || r.lateAirborne);
            if (r.jumpX === null) fam.noJump.push(`g${seed} fosse ${f1(f.xBord)} k${k} : pas de saut${r.lateAirborne ? ' (demande pendant un vol, au-delà de la tolérance de sol)' : ''}, lave ${r.lava}`);
            if (!ok) fam.fails.push(`g${seed} fosse ${f1(f.xBord)} k${k} : lave ${r.lava}, [${r.respawns.join(', ')}], saut à ${f2(r.jumpX === null ? NaN : f.xBord - r.jumpX)} m du bord à ${f1(r.jumpSpeed)} m/s, atterrissage ${f1(r.landX === null ? NaN : r.landX - f.xReception)} m`);
          }
        }
      }
    }
    for (const [name, f] of Object.entries(fams)) {
      const falls = f.runs.filter((r) => r.lava > 0).length;
      console.log(`fosses à 1,3, saut ${name} : ${f.runs.length} runs, chutes ${falls} ; saut à ${range(f.jumpS)} m du bord ; vitesse au bord ${range(f.edge)} m/s ; `
        + `facteur au saut ${range(f.jf)} ; atterrissage le plus long bord aval + ${f1(Math.max(...f.land))} m (exigé ≤ ${FOSSE_LANDING_MAX}) ; `
        + `chutes par tranche de vitesse au saut : ${[...f.bins].map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ')}`
        + `${f.noJump.length ? `\n  sans saut : ${f.noJump.join(' ; ')}` : ''}${f.fails.length ? `\n  ÉCHECS :\n  ${f.fails.join('\n  ')}` : ''}`);
    }
    for (const f of Object.values(fams)) {
      expect(f.runs.length).toBeGreaterThanOrEqual(150);
      expect(f.fails).toEqual([]);
    }
  });

  test('plats étoile à 1,3, lancée à 18,2 m/s sans saut, 10 phases : 0 étoile haute prise', () => {
    let n = 0; let taken = 0; let top = -Infinity; let at = '';
    const fails: string[] = [];
    for (const seed of SEEDS) {
      const track = trackFor(seed);
      track.slices.forEach((s, i) => {
        if (s.type !== 'plat-étoile' || i === 0) return;
        const star = track.stars.find((st) => st.high && st.x >= s.xStart && st.x <= s.xEnd);
        if (!star) return;
        const prev = track.slices[i - 1];
        for (let k = 0; k < PHASES; k++) {
          n++;
          const r = elasticRun({
            track, x0: prev.xStart - 5 - 0.37 * k, v0: 1.3 * CONFIG.V_MAX, rubber0: 1.3, xG: star.x + AHEAD, xStop: star.x + 30,
            maxSeconds: 20, xLandAfter: Infinity, stars: [star], topRange: [star.x - 3, star.x + 3], stopAfterLanding: false,
          });
          taken += r.starsTaken;
          if (r.topMax > top) { top = r.topMax; at = `g${seed} plat étoile ${f1(s.xStart)} après ${prev.type} k${k}`; }
          if (r.starsTaken > 0 || r.respawns.length > 0) fails.push(`g${seed} ${f1(star.x)} k${k} : prises ${r.starsTaken}, [${r.respawns.join(', ')}]`);
        }
      });
    }
    console.log(`plats étoile à 1,3 : ${n} runs, prises sans saut ${taken} ; haut du châssis au plus ${f2(top)} m au-dessus du sol à ± 3 m de l'étoile (${at}) ; bas du capteur ≈ ${f2(CONFIG.STAR_HIGH_Y - 0.5)} m`);
    expect(n).toBeGreaterThanOrEqual(100);
    expect(fails).toEqual([]);
  });

  test('départ à 0,6 (plafond et couple) au pied des bosses, double-bosses et rampes-saut, 4 décalages : 0 réapparition', () => {
    let n = 0;
    const fails: string[] = [];
    const types = new Map<string, number>();
    for (const seed of SEEDS) {
      const track = trackFor(seed);
      for (const s of track.slices) {
        if (s.type !== 'bosses' && s.type !== 'double-bosse' && s.type !== 'rampe-saut') continue;
        for (const d of [0.5, 1.7, 5, 8]) {
          n++;
          types.set(s.type, (types.get(s.type) ?? 0) + 1);
          const x0 = s.xStart - d;
          const r = elasticRun({
            track, x0, v0: 0, rubber0: 0.6, xG: Math.max(5, x0 - BEHIND), xStop: s.xEnd + 2, maxSeconds: 25, xLandAfter: Infinity,
            holdRubber: () => 0.6, stopAfterLanding: false,
          });
          // Hors des zones [xLancement, xLava] le facteur tenu reste ≈ 0,6 (+ un cran de rampe) ; une bosse qui précède un
          // volcan mène le copain dans la zone, où le clamp le relève à 1 (attendu).
          if (r.respawns.length > 0 || r.maxFactorOutZone > 0.61) fails.push(`g${seed} ${s.type} ${f1(s.xStart)} d ${d} : [${r.respawns.join(', ')}], facteur max hors zone ${f2(r.maxFactorOutZone)}, ${f1(r.seconds)} s`);
        }
      }
    }
    console.log(`départ à 0,6 : ${n} runs (${[...types].map(([k, m]) => `${k} ${m}`).join(', ')}), échecs ${fails.length}${fails.length ? `\n  ${fails.join('\n  ')}` : ''}`);
    expect(n).toBeGreaterThanOrEqual(100);
    expect(fails).toEqual([]);
  });
});
