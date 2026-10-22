// Garde de dépendances : la logique pure (piste, voitures, boucle, pilotes automatiques) ne doit toucher
// ni matter-js, ni le DOM. Les sources sont lues via Vite (?raw) ; un dossier absent
// ne correspond à aucun fichier et est donc simplement ignoré.
const FORBIDDEN = ["from 'matter-js'", 'from "matter-js"', 'document.', 'window.'];

const sources = import.meta.glob('../src/{track,cars,loop,ai}/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

test('track, cars, loop et ai restent purs (ni matter-js, ni document, ni window)', () => {
  const offenders: string[] = [];
  for (const [file, src] of Object.entries(sources)) {
    for (const bad of FORBIDDEN) if (src.includes(bad)) offenders.push(`${file}: ${bad}`);
  }
  expect(offenders).toEqual([]);
});

test('la garde voit bien les fichiers de src/track et de src/ai', () => {
  expect(Object.keys(sources).some((f) => f.endsWith('/track/rng.ts'))).toBe(true);
  expect(Object.keys(sources).some((f) => f.endsWith('/ai/driver.ts'))).toBe(true);
});

const renderSources = import.meta.glob('../src/render/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

test('render ne touche pas matter-js (il reçoit des coordonnées du monde)', () => {
  expect(Object.keys(renderSources).some((f) => f.endsWith('/render/renderer.ts'))).toBe(true);
  const offenders = Object.entries(renderSources)
    .filter(([, src]) => src.includes("from 'matter-js'") || src.includes('from "matter-js"'))
    .map(([f]) => f);
  expect(offenders).toEqual([]);
});

const allSources = import.meta.glob('../src/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** `dir` + `rel` (chemin relatif d'un import), normalisé, avec l'extension .ts. */
function resolveImport(file: string, rel: string): string {
  const parts = file.split('/').slice(0, -1);
  for (const p of rel.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return `${parts.join('/')}.ts`;
}

/** Imports d'exécution (ni `import type`, ni modules externes) et réexports d'un fichier source. */
function runtimeImports(file: string, src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/^(import|export)\s+(?!type\b)([\s\S]*?)\sfrom\s+'(\.[^']+)'/gm)) {
    if (m[1] === 'export' && !m[2].trim().startsWith('{') && !m[2].trim().startsWith('*')) continue;
    out.push(resolveImport(file, m[3]));
  }
  return out;
}

test('aucun cycle d’import d’exécution dans src (les types qui remontent passent par import type ; tâche 6)', () => {
  const graph = new Map(Object.entries(allSources).map(([f, src]) => [f, runtimeImports(f, src)]));
  expect(graph.get('../src/sim/simulate.ts')).toContain('../src/ai/driver.ts');
  const cycles: string[] = [];
  const state = new Map<string, 'en cours' | 'fini'>();
  const visit = (f: string, path: string[]): void => {
    if (state.get(f) === 'fini') return;
    if (state.get(f) === 'en cours') { cycles.push([...path.slice(path.indexOf(f)), f].join(' → ')); return; }
    state.set(f, 'en cours');
    for (const g of graph.get(f) ?? []) if (graph.has(g)) visit(g, [...path, f]);
    state.set(f, 'fini');
  };
  for (const f of graph.keys()) visit(f, []);
  expect(cycles).toEqual([]);
});
