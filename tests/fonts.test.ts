// Police Fredoka auto-hébergée (plan B, tâche 10 ; addendum « présentation » §2) : les deux woff2 servis depuis
// `public/fonts/`, les @font-face d'`index.html` (url absolue, réécrite sous la base par Vite), `canvasFont` et `loadFont`
// (sans `document.fonts`, rien ne casse : jsdom).
import { FONT_FAMILY, canvasFont, loadFont } from '../src/ui/font';

interface NodeFs { readdirSync(p: string): string[]; statSync(p: string): { size: number }; readFileSync(p: string, enc: 'utf8'): string }
const fs = (): NodeFs => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }).process.getBuiltinModule('node:fs');
const FILES = ['fredoka-latin-600.woff2', 'fredoka-latin-700.woff2'];

test('public/fonts : exactement les deux woff2 de Fredoka, ≤ 24 KB chacun ; plus rien dans assets/fonts', () => {
  expect(fs().readdirSync('public/fonts').sort()).toEqual(FILES);
  for (const f of FILES) expect(fs().statSync(`public/fonts/${f}`).size, f).toBeLessThanOrEqual(24 * 1024);
  expect(() => fs().readdirSync('assets/fonts')).toThrow();
});

test('index.html : deux @font-face Fredoka (600 et 700), font-display swap, url absolue /fonts/ (réécrite sous la base par Vite), aucune adresse http', () => {
  const html = fs().readFileSync('index.html', 'utf8');
  const faces = html.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  expect(faces).toHaveLength(2);
  for (const face of faces) {
    expect(face).toMatch(/font-family:\s*['"]?Fredoka/);
    expect(face).toMatch(/font-display:\s*swap/);
    expect(face).toMatch(/url\(\/fonts\/fredoka-latin-(600|700)\.woff2\)\s*format\(['"]woff2['"]\)/);
  }
  expect(faces.map((f) => /font-weight:\s*(\d+)/.exec(f)![1]).sort()).toEqual(['600', '700']);
  expect(html).not.toMatch(/https?:\/\//);
});

test('canvasFont : graisse, taille arrondie, Fredoka puis system-ui', () => {
  expect(FONT_FAMILY).toBe('Fredoka, system-ui, sans-serif');
  expect(canvasFont(700, 20)).toBe('700 20px Fredoka, system-ui, sans-serif');
  expect(canvasFont(600, 13.6)).toBe('600 14px Fredoka, system-ui, sans-serif');
});

test('loadFont : sans document.fonts → faux, sans exception ; avec → load("700 20px Fredoka") puis vrai ; un rejet → faux', async () => {
  expect(await loadFont({} as Document)).toBe(false);
  const calls: string[] = [];
  const ok = { fonts: { load: (s: string) => { calls.push(s); return Promise.resolve([{}]); } } } as unknown as Document;
  expect(await loadFont(ok)).toBe(true);
  expect(calls).toEqual(['700 20px Fredoka']);
  const ko = { fonts: { load: () => Promise.reject(new Error('refus')) } } as unknown as Document;
  expect(await loadFont(ko)).toBe(false);
});
