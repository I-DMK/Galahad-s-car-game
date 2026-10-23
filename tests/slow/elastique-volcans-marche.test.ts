// Budget : < 15 min mur (MESURÉ ≈ 7 min 50, machine chargée : 1 836 runs en monde rogné ; relecture adversariale de la
// tâche 7 : 1 836 runs émulés). Marche 1,3 → 1,0 au pied d'un tremplin (plan B, tâche 7, Step 4 ; Review Focus n° 3 de la tâche ;
// pire cas connu de la 5c : la fin d'un turbo au pied ramène d'un coup ω au plafond, les roues freinent) : copain sous le
// vrai élastique (protocole : tests/helpers/elastique-volcans.ts), élastique tenu à 1 (Galahad garé loin devant), turbo
// dès le départ et fini au premier pas où le châssis passe xm (facteur 1,3 → ≈ 1,0 au plafond et au couple) ; xm balayé
// au pas de 1 m de xLancement − 10 au sommet ; lancée à 18,2 m/s en xLancement − 45 et − 50 ; tous les tremplins des
// graines 0 à 9. Exigé : 0 chute, garde ≥ 0,3 m, atterrissage avant xEnd − 10 ; imprimé : garde minimale, sommet minimal.
import { CONFIG } from '../../src/config';
import { tremplins } from '../../src/track/query';
import { AHEAD, MIN_GUARD, clearWorlds, elasticRun, f1, f2, range } from '../helpers/elastique-volcans';
import { trackFor } from '../helpers/runs';

const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
afterEach(() => clearWorlds());

test('marche 1,3 → 1,0 au pied (fin du turbo, élastique à 1), balayée au pas de 1 m de xLancement − 10 au sommet, lancée en − 45 et − 50 : 0 chute, garde ≥ 0,3 m, atterrissage avant xEnd − 10', () => {
  let n = 0;
  const fails: string[] = [];
  const guard: number[] = []; const lip: number[] = []; const margin: number[] = [];
  let worst = { guard: Infinity, at: '' };
  for (const seed of SEEDS) {
    const track = trackFor(seed);
    for (const v of tremplins(track)) {
      for (let xm = v.xLancement - 10; xm <= v.xLip; xm += 1) {
        for (const d of [45, 50]) {
          n++;
          const r = elasticRun({
            track, x0: v.xLancement - d, v0: 1.3 * CONFIG.V_MAX, rubber0: 1, holdRubber: () => 1, turboUntilX: xm,
            xG: v.xEnd + AHEAD, xStop: v.xEnd, maxSeconds: 20, xLandAfter: v.xLip, volcano: v, marks: { sommet: v.xLip },
          });
          guard.push(r.guard);
          if (r.speedAt.sommet !== undefined) lip.push(r.speedAt.sommet);
          if (r.landX !== null) margin.push(v.xEnd - r.landX);
          if (r.guard < worst.guard) worst = { guard: r.guard, at: `g${seed} ${f1(v.xLancement)}, fin du turbo à xLancement ${xm - v.xLancement >= 0 ? '+' : '−'} ${f1(Math.abs(xm - v.xLancement))}, lancée en − ${d}` };
          const ok = r.lava === 0 && r.respawns.length === 0 && !r.flipped && r.landX !== null && r.landX <= v.xEnd - 10 && r.guard >= MIN_GUARD;
          if (!ok) fails.push(`g${seed} ${f1(v.xLancement)} xm ${f1(xm - v.xLancement)} d ${d} : lave ${r.lava}, [${r.respawns.join(', ')}], garde ${f2(r.guard)}, atterrissage ${f1(r.landX)} (xEnd ${f1(v.xEnd)})`);
        }
      }
    }
  }
  console.log(`marche 1,3 → 1,0 au pied : ${n} runs, échecs ${fails.length} ; garde min ${f2(Math.min(...guard))} m (${worst.at}) ; sommet ${range(lip)} m/s ; `
    + `marge avant xEnd min ${f1(Math.min(...margin))} m${fails.length ? `\n  ${fails.join('\n  ')}` : ''}`);
  expect(n).toBeGreaterThanOrEqual(1000);
  expect(fails).toEqual([]);
});
