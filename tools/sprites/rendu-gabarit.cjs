// Rend docs/sprites-gabarit.svg en PNG avec le Chromium de Playwright (tâche 8b, Step 0).
//   node tools/sprites/rendu-gabarit.cjs <mode> <sortie.png> [largeur px]
// Modes :
//   annote      tout le gabarit, cotes et légende (défaut 1700 px)
//   reference   cadre seul, silhouette, pilote et roues en pointillés sur fond blanc : l'image à donner au
//               générateur (défaut 1536 px ; sans les roues, la silhouette ne se lit plus comme une voiture)
//   silhouette  cadre seul, silhouette et pilote sur fond transparent : un sprite conforme par construction,
//               pour vérifier controle.py (défaut 1536 px)
//   calque      cadre seul, traits sur fond transparent : posé par controle.py sur l'aperçu (défaut 1024 px)
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');

const SVG = path.resolve(__dirname, '../../docs/sprites-gabarit.svg');
const FRAME = '-140 -70 280 140';
const hide = (ids) => ids.map((id) => `#${id}{display:none}`).join('');

const [mode, out, widthArg] = process.argv.slice(2);
let svg = fs.readFileSync(SVG, 'utf8').replace(/<\?xml[^>]*>/, '');
const [, , vbW, vbH] = svg.match(/viewBox="([^"]*)"/)[1].split(/\s+/).map(Number);
let extra = '';
let framed = true;
let w;
if (mode === 'annote') {
  framed = false;
  w = Number(widthArg ?? 1700);
} else if (mode === 'reference') {
  w = Number(widthArg ?? 1536);
  extra = hide(['titre', 'cotes', 'chassis', 'arches', 'reperes', 'cadre']) + '.roue{stroke:#8a8f99}';
} else if (mode === 'silhouette') {
  w = Number(widthArg ?? 1536);
  extra = hide(['fond', 'titre', 'cotes', 'chassis', 'arches', 'roues', 'reperes', 'cadre']);
} else if (mode === 'calque') {
  w = Number(widthArg ?? 1024);
  extra = hide(['fond', 'titre', 'cotes', 'pilote'])
    + '.carrosserie{fill:none;stroke:#ffffff;stroke-opacity:.9;stroke-width:.7}'
    + '.roue,.axe,.cadre{stroke:#ffffff}';
} else {
  console.error('mode : annote | reference | silhouette | calque');
  process.exit(2);
}
const h = framed ? w / 2 : Math.round((w * vbH) / vbW);
if (framed) svg = svg.replace(/viewBox="[^"]*"/, `viewBox="${FRAME}"`);
svg = svg.replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`).replace('</style>', `${extra}</style>`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').screenshot({ path: out, omitBackground: true });
  await browser.close();
  console.log(`${out} : ${w} × ${h} px`);
})();
