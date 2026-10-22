// Mesure du rattrapage à 5 voitures (plan B, tâche 5d, « Mesure du rattrapage » ; resservira en 5e et 6) :
// part des courses gagnées par la voiture qui a pris la première étoile. Courses `fiveCarRace` : Galahad
// doigt posé (graines 0 à 47), plus 16 courses au motif doigt levé 30 % (`liftedPattern(seed, 0.3)`,
// graines 0 à 15) ; les copains gardent leur driver. Une ligne JSON par course dans
// tests/slow/out/rattrapage-<étape>.jsonl (étape : variable RATTRAPAGE_ETAPE, défaut « courant »), puis
// comparaison appariée par graine avec l'étape de référence (RATTRAPAGE_REF, défaut « avant ») si son
// fichier existe. Les deux fichiers lents écrivent en parallèle dans le même fichier (ajout ligne à
// ligne) ; à la relecture, la dernière ligne d'une course (graine, motif) fait foi. Mesure seule : pas
// d'assertion chiffrée (ruling Q9).
import { fiveCarRace } from './race';
import { f1, liftedPattern } from './runs';

/** Accès à node (le projet n'a pas @types/node, cf. phases.ts), typé au strict nécessaire. */
interface NodeFs {
  mkdirSync(path: string, opts: { recursive: boolean }): void;
  appendFileSync(path: string, data: string): void;
  readFileSync(path: string, encoding: 'utf8'): string;
  existsSync(path: string): boolean;
}
const nodeProcess = (globalThis as unknown as {
  process: { env: Record<string, string | undefined>; getBuiltinModule(id: 'node:fs'): NodeFs };
}).process;
const fs = (): NodeFs => nodeProcess.getBuiltinModule('node:fs');

export const OUT_DIR = 'tests/slow/out';
export const ETAPE = nodeProcess.env.RATTRAPAGE_ETAPE ?? 'courant';
export const REF = nodeProcess.env.RATTRAPAGE_REF ?? 'avant';
export const outFile = (etape: string): string => `${OUT_DIR}/rattrapage-${etape}.jsonl`;

/** Part du temps où Galahad lève le doigt dans le motif « doigt levé ». */
const LIFTED_P = 0.3;
export type Motif = 'posé' | 'levé';

/** Une course : ids, étoiles, chutes et réapparitions dans l'ordre de la grille (Galahad en premier). */
export interface RattrapageRow {
  etape: string;
  seed: number;
  motif: Motif;
  ids: string[];
  winner: string;
  /** Voiture de la première étoile et instant (s), null si aucune étoile n'a été prise. */
  firstStar: string | null;
  firstStarT: number | null;
  /** Place de Galahad au classement final (1 à 5). */
  galahadPlace: number;
  ranking: string[];
  stars: number[];
  lava: number[];
  respawns: number[];
  galahadFinishedAt: number | null;
  meanStepMs: number;
  seconds: number;
}

/** Course (graine, motif) à 5 voitures, mesurée et ajoutée au fichier de l'étape. */
export function runRattrapage(seed: number, motif: Motif): RattrapageRow {
  const race = fiveCarRace(seed, undefined, motif === 'levé' ? liftedPattern(seed, LIFTED_P) : undefined);
  const { r } = race;
  const ids = Object.keys(r.respawnsByCar);
  const row: RattrapageRow = {
    etape: ETAPE, seed, motif, ids,
    winner: r.ranking[0],
    firstStar: race.firstStar?.carId ?? null,
    firstStarT: race.firstStar?.t ?? null,
    galahadPlace: r.ranking.indexOf('galahad') + 1,
    ranking: r.ranking,
    stars: ids.map((id) => race.stars[id]),
    lava: ids.map((id) => r.lavaByCar[id]),
    respawns: ids.map((id) => r.respawnsByCar[id].length),
    galahadFinishedAt: r.finishedAt,
    meanStepMs: r.meanStepMs,
    seconds: race.seconds,
  };
  fs().mkdirSync(OUT_DIR, { recursive: true });
  fs().appendFileSync(outFile(ETAPE), `${JSON.stringify(row)}\n`);
  return row;
}

const key = (r: { seed: number; motif: Motif }): string => `${r.motif}/${r.seed}`;

/** Lignes d'une étape, la dernière par course (graine, motif) ; vide si le fichier n'existe pas. */
export function readRows(etape: string): Map<string, RattrapageRow> {
  const rows = new Map<string, RattrapageRow>();
  if (!fs().existsSync(outFile(etape))) return rows;
  for (const line of fs().readFileSync(outFile(etape), 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    const row = JSON.parse(line) as RattrapageRow;
    rows.set(key(row), row);
  }
  return rows;
}

const short = (id: string | null): string => (id === null ? '—' : id === 'galahad' ? 'G' : id);

/** Une ligne du tableau par course : vainqueur, première étoile, place de Galahad, étoiles / chutes / réapparitions par voiture. */
export function describeRow(r: RattrapageRow): string {
  const percar = r.ids.map((id, i) => `${short(id)} ${r.stars[i]}/${r.lava[i]}/${r.respawns[i]}`).join(', ');
  return `${r.motif} g${String(r.seed).padStart(2)} : vainqueur ${short(r.winner).padEnd(9)} 1re étoile ${short(r.firstStar).padEnd(9)}`
    + ` (${f1(r.firstStarT)} s)${r.winner === r.firstStar ? ' =' : '  '} | Galahad ${r.galahadPlace}e (${f1(r.galahadFinishedAt)} s)`
    + ` | étoiles/lave/respawns : ${percar}`;
}

/** Part des courses gagnées par la voiture de la première étoile, par motif et au total. */
function shares(rows: RattrapageRow[]): string {
  const part = (rs: RattrapageRow[]): string => {
    const won = rs.filter((r) => r.firstStar !== null && r.winner === r.firstStar).length;
    const g = rs.filter((r) => r.winner === 'galahad').length;
    const place = rs.reduce((a, r) => a + r.galahadPlace, 0) / Math.max(1, rs.length);
    return `${won}/${rs.length} (${((100 * won) / Math.max(1, rs.length)).toFixed(0)} %), Galahad gagne ${g}, place moyenne ${place.toFixed(2)}`;
  };
  const posé = rows.filter((r) => r.motif === 'posé');
  const levé = rows.filter((r) => r.motif === 'levé');
  return `doigt posé ${part(posé)} ; doigt levé 30 % ${part(levé)} ; total ${part(rows)}`;
}

/**
 * Tableau de l'étape courante (toutes les courses du fichier, les deux fichiers lents compris) et, si
 * l'étape de référence existe, comparaison appariée par graine : « vainqueur = première étoile » qui passe
 * de vrai à faux et l'inverse, écart moyen de la place de Galahad.
 */
export function rattrapageReport(): string {
  const cur = readRows(ETAPE);
  const rows = [...cur.values()].sort((a, b) => a.motif.localeCompare(b.motif) || a.seed - b.seed);
  const lines = [`rattrapage, étape « ${ETAPE} » (${rows.length} courses) : vainqueur = première étoile ${shares(rows)}`];
  lines.push(...rows.map(describeRow));
  const ref = readRows(REF);
  if (REF !== ETAPE && ref.size > 0) {
    const pairs = rows.filter((r) => ref.has(key(r))).map((r) => ({ after: r, before: ref.get(key(r))! }));
    const same = (r: RattrapageRow) => r.firstStar !== null && r.winner === r.firstStar;
    const lost = pairs.filter((p) => same(p.before) && !same(p.after));
    const gained = pairs.filter((p) => !same(p.before) && same(p.after));
    const dPlace = pairs.reduce((a, p) => a + p.after.galahadPlace - p.before.galahadPlace, 0) / Math.max(1, pairs.length);
    lines.push(`comparaison appariée « ${REF} » → « ${ETAPE} » sur ${pairs.length} courses :`);
    lines.push(`  « ${REF} » : ${shares(pairs.map((p) => p.before))}`);
    lines.push(`  « ${ETAPE} » : ${shares(pairs.map((p) => p.after))}`);
    lines.push(`  vainqueur = première étoile : vrai → faux ${lost.length} [${lost.map((p) => key(p.after)).join(', ')}], `
      + `faux → vrai ${gained.length} [${gained.map((p) => key(p.after)).join(', ')}]`);
    lines.push(`  place de Galahad : écart moyen ${dPlace >= 0 ? '+' : ''}${dPlace.toFixed(2)} (négatif = mieux placé)`);
    const sum = (rs: RattrapageRow[], i: number) => rs.reduce((a, r) => a + r.stars[i], 0);
    const b = pairs.map((p) => p.before);
    const a = pairs.map((p) => p.after);
    lines.push(`  étoiles prises par rang de grille (Galahad, rangs 1 à 4), total : avant ${[0, 1, 2, 3, 4].map((i) => sum(b, i)).join('/')}, `
      + `après ${[0, 1, 2, 3, 4].map((i) => sum(a, i)).join('/')}`);
  }
  return lines.join('\n');
}

/** Un fichier lent : courses doigt posé sur `posé`, doigt levé 30 % sur `levé`, puis le tableau. */
export function registerRattrapage(seeds: { posé: number[]; levé: number[] }): void {
  const cases: [number, Motif][] = [...seeds.posé.map((s): [number, Motif] => [s, 'posé']), ...seeds.levé.map((s): [number, Motif] => [s, 'levé'])];
  describe(`rattrapage à 5 voitures, étape « ${ETAPE} »`, () => {
    test.each(cases)('graine %i, doigt %s', (seed, motif) => {
      const row = runRattrapage(seed, motif);
      console.log(`${describeRow(row)} | ${f1(row.seconds)} s mur`);
      expect(row.ranking).toHaveLength(5);
      expect(row.galahadPlace).toBeGreaterThanOrEqual(1);
    });
    afterAll(() => {
      console.log(rattrapageReport());
    });
  });
}
