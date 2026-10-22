// Mesure du rattrapage à 5 voitures (plan B, tâche 5d, « Mesure du rattrapage » ; resservira en 5e et 6) :
// part des courses gagnées par la voiture qui a pris la première étoile. Courses `fiveCarRace` : Galahad
// doigt posé (graines 0 à 47), plus 16 courses au motif doigt levé 30 % (`liftedPattern(seed, 0.3)`,
// graines 0 à 15) ; les copains gardent leur driver. Lancement à la demande : `npm run test:slow:rattrapage`
// (vitest.slow-rattrapage.config.ts, hors de `npm run test:slow`).
//
// Une ligne JSON par course dans tests/slow/out/rattrapage-<étape>.jsonl (étape : RATTRAPAGE_ETAPE, défaut
// « courant »), marquée du commit mesuré : RATTRAPAGE_COMMIT, sinon `git rev-parse --short HEAD`, suffixé
// « -modifié-<sha1 du diff> » si l'arbre a des modifications suivies. Les deux fichiers lents écrivent en parallèle dans le
// même fichier (ajout ligne à ligne) ; une ligne illisible (tronquée) est ignorée avec un avertissement.
// Un seul rapport, après les deux fichiers (`globalSetup` tests/helpers/rattrapage-rapport.ts) : courses
// de l'étape au commit courant, comparées à l'étape de référence (RATTRAPAGE_REF, défaut « avant ») au
// commit de sa dernière ligne ; la dernière ligne d'une course (graine, motif) fait foi. Mesure seule :
// pas d'assertion chiffrée (ruling Q9).
import { fiveCarRace } from './race';
import { f1, liftedPattern } from './runs';

/** Accès à node (le projet n'a pas @types/node, cf. phases.ts), typé au strict nécessaire. */
interface NodeFs {
  mkdirSync(path: string, opts: { recursive: boolean }): void;
  appendFileSync(path: string, data: string): void;
  readFileSync(path: string, encoding: 'utf8'): string;
  existsSync(path: string): boolean;
}
interface NodeChildProcess { execSync(cmd: string, opts: { encoding: 'utf8'; stdio: string[]; maxBuffer?: number }): string }
interface NodeCrypto { createHash(alg: 'sha1'): { update(s: string): { digest(enc: 'hex'): string } } }
const nodeProcess = (globalThis as unknown as {
  process: {
    env: Record<string, string | undefined>;
    getBuiltinModule(id: 'node:fs'): NodeFs;
    getBuiltinModule(id: 'node:child_process'): NodeChildProcess;
    getBuiltinModule(id: 'node:crypto'): NodeCrypto;
  };
}).process;
const fs = (): NodeFs => nodeProcess.getBuiltinModule('node:fs');

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** Graines mesurées : doigt posé et doigt levé 30 % ; chaque fichier lent en prend une moitié. */
export const POSE_SEEDS = range(0, 47);
export const LEVE_SEEDS = range(0, 15);
export const EXPECTED_RACES = POSE_SEEDS.length + LEVE_SEEDS.length;

export const OUT_DIR = 'tests/slow/out';
export const ETAPE = nodeProcess.env.RATTRAPAGE_ETAPE ?? 'courant';
export const REF = nodeProcess.env.RATTRAPAGE_REF ?? 'avant';
export const outFile = (etape: string): string => `${OUT_DIR}/rattrapage-${etape}.jsonl`;

/**
 * Commit mesuré : RATTRAPAGE_COMMIT, sinon HEAD (court) ; si l'arbre a des modifications suivies, HEAD suivi de
 * « -modifié- » et des 8 premiers caractères du sha1 du diff (`git diff HEAD`) : deux arbres sales différents sur
 * le même HEAD ne partagent jamais d'étiquette, donc jamais de lignes. « inconnu » hors dépôt.
 */
export function currentCommit(): string {
  const fromEnv = nodeProcess.env.RATTRAPAGE_COMMIT;
  if (fromEnv) return fromEnv;
  try {
    const cp = nodeProcess.getBuiltinModule('node:child_process');
    const run = (cmd: string) => cp.execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const head = run('git rev-parse --short HEAD');
    if (run('git status --porcelain --untracked-files=no') === '') return head;
    const crypto = nodeProcess.getBuiltinModule('node:crypto');
    const diff = cp.execSync('git diff HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    return `${head}-modifié-${crypto.createHash('sha1').update(diff).digest('hex').slice(0, 8)}`;
  } catch {
    return 'inconnu';
  }
}
let commitMemo: string | null = null;
const commit = (): string => (commitMemo ??= currentCommit());

/** Part du temps où Galahad lève le doigt dans le motif « doigt levé ». */
const LIFTED_P = 0.3;
export type Motif = 'posé' | 'levé';

/** Une course : ids, étoiles, chutes et réapparitions dans l'ordre de la grille (Galahad en premier). */
export interface RattrapageRow {
  etape: string;
  /** Commit mesuré (`currentCommit`). */
  commit: string;
  seed: number;
  motif: Motif;
  ids: string[];
  winner: string;
  /** Voiture de la première étoile (au même pas : le plus petit index) et instant (s), null si aucune étoile. */
  firstStar: string | null;
  firstStarT: number | null;
  /** Toutes les voitures qui ont pris une étoile au pas de la première : plus d'une = égalité. */
  firstStarCars: string[];
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
  const race = fiveCarRace(seed, motif === 'levé' ? { throttle: liftedPattern(seed, LIFTED_P) } : {});
  const { r } = race;
  const ids = Object.keys(r.respawnsByCar);
  const row: RattrapageRow = {
    etape: ETAPE, commit: commit(), seed, motif, ids,
    winner: r.ranking[0],
    firstStar: race.firstStar?.carId ?? null,
    firstStarT: race.firstStar?.t ?? null,
    firstStarCars: race.firstStarCars,
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

/** Lignes d'une étape au commit voulu (défaut : celui de la dernière ligne lisible), la dernière par course. */
export interface StageRows { etape: string; commit: string | null; rows: Map<string, RattrapageRow>; warnings: string[] }

export function readStage(etape: string, wanted?: string): StageRows {
  const warnings: string[] = [];
  const all: RattrapageRow[] = [];
  if (fs().existsSync(outFile(etape))) {
    fs().readFileSync(outFile(etape), 'utf8').split('\n').forEach((line, i) => {
      if (line.trim() === '') return;
      try {
        all.push(JSON.parse(line) as RattrapageRow);
      } catch {
        warnings.push(`${outFile(etape)} ligne ${i + 1} illisible (tronquée ?), ignorée`);
      }
    });
  }
  const c = wanted ?? all[all.length - 1]?.commit ?? null;
  const rows = new Map<string, RattrapageRow>();
  for (const row of all) if (row.commit === c) rows.set(key(row), row);
  const others = new Set(all.filter((r) => r.commit !== c).map((r) => r.commit ?? 'sans commit'));
  if (others.size > 0) warnings.push(`${outFile(etape)} : lignes d'autres commits ignorées (${[...others].join(', ')})`);
  return { etape, commit: c, rows, warnings };
}

const short = (id: string | null): string => (id === null ? '—' : id === 'galahad' ? 'G' : id);
/** La voiture gagnante a-t-elle pris la première étoile (égalités comprises) ? */
const winnerTookFirst = (r: RattrapageRow): boolean => r.firstStarCars.includes(r.winner);
const tie = (r: RattrapageRow): boolean => r.firstStarCars.length > 1;

/** Une ligne du tableau par course : vainqueur, première étoile, place de Galahad, étoiles / chutes / réapparitions par voiture. */
export function describeRow(r: RattrapageRow): string {
  const percar = r.ids.map((id, i) => `${short(id)} ${r.stars[i]}/${r.lava[i]}/${r.respawns[i]}`).join(', ');
  const first = r.firstStarCars.length > 0 ? r.firstStarCars.map(short).join('+') : '—';
  return `${r.motif} g${String(r.seed).padStart(2)} : vainqueur ${short(r.winner).padEnd(9)} 1re étoile ${first.padEnd(9)}`
    + ` (${f1(r.firstStarT)} s)${winnerTookFirst(r) ? ' =' : '  '} | Galahad ${r.galahadPlace}e (${f1(r.galahadFinishedAt)} s)`
    + ` | étoiles/lave/respawns : ${percar}`;
}

const pct = (k: number, n: number): string => `${k}/${n} (${((100 * k) / Math.max(1, n)).toFixed(0)} %)`;

/** Indicateurs d'un ensemble de courses : vainqueur = 1re étoile, égalités, victoires et place de Galahad, étoiles par rang de grille. */
function indicators(label: string, rs: RattrapageRow[]): string {
  const n = rs.length;
  const place = rs.reduce((a, r) => a + r.galahadPlace, 0) / Math.max(1, n);
  const stars = [0, 1, 2, 3, 4].map((i) => rs.reduce((a, r) => a + r.stars[i], 0));
  const lava = rs.reduce((a, r) => a + r.lava[0], 0);
  return `${label}, ${n} courses : vainqueur = première étoile ${pct(rs.filter(winnerTookFirst).length, n)}, `
    + `égalités à la première étoile ${rs.filter(tie).length} ; Galahad gagne ${pct(rs.filter((r) => r.winner === 'galahad').length, n)}, `
    + `place moyenne ${place.toFixed(2)}, chutes de Galahad dans la lave ${lava} ; étoiles par rang de grille (Galahad, rangs 1 à 4) ${stars.join('/')}`;
}

function indicatorBlock(rows: RattrapageRow[]): string[] {
  return [
    indicators('doigt posé', rows.filter((r) => r.motif === 'posé')),
    indicators('doigt levé 30 %', rows.filter((r) => r.motif === 'levé')),
    indicators('total', rows),
  ];
}

const coverage = (s: StageRows): string => `commit ${s.commit}, ${s.rows.size} courses lues sur ${EXPECTED_RACES}`
  + (s.rows.size < EXPECTED_RACES ? ' (tableau partiel)' : '');

/**
 * Rapport complet, lu après les deux fichiers lents : tableau de l'étape courante au commit courant et, si
 * l'étape de référence existe, comparaison appariée par graine (« vainqueur = première étoile » qui passe de
 * vrai à faux et l'inverse, place de Galahad), avec les indicateurs des deux étapes sur les courses appariées.
 */
export function rattrapageReport(): string {
  const cur = readStage(ETAPE, commit());
  const rows = [...cur.rows.values()].sort((a, b) => b.motif.localeCompare(a.motif) || a.seed - b.seed);
  const lines = [`=== rattrapage, étape « ${ETAPE} » : ${coverage(cur)} ===`, ...indicatorBlock(rows).map((l) => `  ${l}`)];
  lines.push(...rows.map(describeRow));
  const ref = readStage(REF);
  if (REF === ETAPE) {
    lines.push('(étape courante = étape de référence : pas de comparaison)');
  } else if (ref.rows.size === 0) {
    lines.push(`référence « ${REF} » absente (${outFile(REF)})`);
  } else {
    const pairs = rows.filter((r) => ref.rows.has(key(r))).map((r) => ({ after: r, before: ref.rows.get(key(r))! }));
    const lost = pairs.filter((p) => winnerTookFirst(p.before) && !winnerTookFirst(p.after));
    const gained = pairs.filter((p) => !winnerTookFirst(p.before) && winnerTookFirst(p.after));
    const dPlace = pairs.reduce((a, p) => a + p.after.galahadPlace - p.before.galahadPlace, 0) / Math.max(1, pairs.length);
    lines.push(`=== comparaison appariée « ${REF} » (${coverage(ref)}) → « ${ETAPE} », ${pairs.length} courses appariées ===`);
    lines.push(`  « ${REF} » :`, ...indicatorBlock(pairs.map((p) => p.before)).map((l) => `    ${l}`));
    lines.push(`  « ${ETAPE} » :`, ...indicatorBlock(pairs.map((p) => p.after)).map((l) => `    ${l}`));
    lines.push(`  vainqueur = première étoile : vrai → faux ${lost.length} [${lost.map((p) => key(p.after)).join(', ')}], `
      + `faux → vrai ${gained.length} [${gained.map((p) => key(p.after)).join(', ')}]`);
    lines.push(`  place de Galahad : écart moyen ${dPlace >= 0 ? '+' : ''}${dPlace.toFixed(2)} (négatif = mieux placé)`);
  }
  const warnings = [...cur.warnings, ...ref.warnings];
  if (warnings.length > 0) lines.push(...warnings.map((w) => `avertissement : ${w}`));
  return lines.join('\n');
}

/** Un fichier lent : courses doigt posé sur `posé`, doigt levé 30 % sur `levé` (le rapport vient après les deux fichiers). */
export function registerRattrapage(seeds: { posé: number[]; levé: number[] }): void {
  const cases: [number, Motif][] = [...seeds.posé.map((s): [number, Motif] => [s, 'posé']), ...seeds.levé.map((s): [number, Motif] => [s, 'levé'])];
  describe(`rattrapage à 5 voitures, étape « ${ETAPE} », commit ${commit()}`, () => {
    test.each(cases)('graine %i, doigt %s', (seed, motif) => {
      const row = runRattrapage(seed, motif);
      console.log(`${describeRow(row)} | ${f1(row.seconds)} s mur`);
      expect(row.ranking).toHaveLength(5);
      expect(row.galahadPlace).toBeGreaterThanOrEqual(1);
    });
  });
}
