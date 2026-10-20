// Garde de dépendances : la logique pure (piste, voitures, boucle) ne doit toucher
// ni matter-js, ni le DOM. Les sources sont lues via Vite (?raw) ; un dossier absent
// ne correspond à aucun fichier et est donc simplement ignoré.
const FORBIDDEN = ["from 'matter-js'", 'from "matter-js"', 'document.', 'window.'];

const sources = import.meta.glob('../src/{track,cars,loop}/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

test('track, cars et loop restent purs (ni matter-js, ni document, ni window)', () => {
  const offenders: string[] = [];
  for (const [file, src] of Object.entries(sources)) {
    for (const bad of FORBIDDEN) if (src.includes(bad)) offenders.push(`${file}: ${bad}`);
  }
  expect(offenders).toEqual([]);
});

test('la garde voit bien les fichiers de src/track', () => {
  expect(Object.keys(sources).some((f) => f.endsWith('/track/rng.ts'))).toBe(true);
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
