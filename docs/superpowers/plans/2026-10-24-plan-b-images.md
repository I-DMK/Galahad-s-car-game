# Tâche 8b — Images (carrosseries, roue, flammes, étoile, ombre au sol) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Régime « écrans » de l'addendum « présentation » §5, **avec la dérogation du papa pour cette session** : un implémenteur frais pour toute la 8b (Parties 1 à 4), puis **quatre relectures** du diff de la tâche (standard, adversariale, skill `code-review`, skill `security-review`), tours de correction (≤ 5), capture validée par le papa **sur la tablette après déploiement**. Pas de suite lente. Jamais de PR.

**Statut :** v1.1 (2026-10-24), à relire par le papa avant exécution.
- v1 (`6b5c977`) : brouillon.
- v1.1 : relecture du plan (`.superpowers/sdd/2026-10-21-plan-b-copains-et-finitions/plan-8b-review.md` : 3 importants, 13 mineurs) et décisions du coordinateur.
  - Contournement Playwright (section « Environnement »).
  - Départ après la clôture de la tâche 8, `BASE` en SHA écrit en clair.
  - Mineurs corrigés ou gardés avec leur raison (A16 à A19).
  - `teinte.py` réduit à une mesure du scratchpad.
  - Registre de 3 à 5 lignes.

**Goal:** Dessiner les voitures avec les sept carrosseries générées et la roue PNG, les flammes du turbo et l'étoile en images, plus une ombre au sol sous chaque voiture, sans changer un bit de la simulation, avec un repli par code image par image.

**Architecture:** Un module `src/render/assets.ts` charge les 13 images au démarrage (`loadArt(): Promise<Art>`, jamais d'exception, une image en échec manque). `Game` reçoit la promesse et la course n'attend jamais : à la résolution, `Renderer.setArt(art)` bascule le dessin. Ensuite, `drawCar` prend pour chaque pièce l'image si elle existe, sinon le dessin d'aujourd'hui. Les poses viennent de `CarView`, déjà interpolées par la 5f. Le rendu ne lit et n'écrit rien de `RaceSim`.

**Tech Stack:** TypeScript 5.7 strict, Vite 8 (dossier `public/`, `import.meta.env.BASE_URL`), Vitest 5 (+ jsdom), Playwright 1.56. Outils d'images en Python 3 + Pillow 12 + numpy (dans `tools/sprites/`, hors du jeu, lancés avec `python3 -B -I` : `-B` évite d'écrire `tools/sprites/__pycache__/`, que `.gitignore` ne couvre pas). **Aucune nouvelle dépendance.**

**Spec :** `docs/superpowers/specs/2026-10-22-addendum-presentation.md` (§1, §5, §7, §8 ; il l'emporte sur les documents plus anciens), puis `assets/README.md` (contrat des carrosseries contrôlées) et `docs/sprites-gabarit.svg` (calque `reperes` : accroche des flammes). Références ci-dessous : « addendum §n », « README ».

**État de départ (décision du coordinateur) :** la 8b ne commence qu'une fois la **tâche 8 close** : tours de correction faits, validation du papa, fusion sur `ccr-5b6fabc4-n96ofo` et déploiement vérifié. Aucun commit de la 8 n'arrive donc pendant la 8b.
- La tâche 8 touche `src/cars/ranking.ts`, `src/ui/hud.ts`, `src/game.ts`, `src/config.ts`, `tests/ranking.test.ts`, `tests/hud.test.ts` et `e2e/race.spec.ts`. La 8b ne modifie aucun de ces fichiers, sauf `src/game.ts`, où ses ajouts sont disjoints : un paramètre du constructeur, un champ et un accesseur. Ce fichier s'édite avec `Edit`, après l'avoir relu, jamais par réécriture complète.
- **BASE** = le SHA de la tête de `wip-plan-b` à la clôture de la tâche 8. Le contrôleur l'écrit en clair dans le registre (première ligne « Task 8b: ») avant le Step 1. On le **recopie en clair** dans chaque commande qui en a besoin (Steps 21 et 24, notés `<BASE>` ci-dessous) : une variable de shell ne survit pas d'un appel d'outil à l'autre.

**Step 0 : fait et validé.** La session sprites (2026-10-22 et 23) a livré le gabarit `docs/sprites-gabarit.svg` et les outils `tools/sprites/`. Les sept carrosseries générées par le papa ont été contrôlées et réduites dans `assets/sprites/` (512 × 256 px, PNG-8, 93 528 octets les sept). La planche `docs/sprites-planche.png` a été **validée par le papa le 2026-10-23**, arches serrées gardées ; le jugement final se fait sur la tablette, ici (Step 28). **Ce plan commence au Step 1.**

## Global Constraints

- « La physique ne change pas d'un bit : les sprites se posent sur les poses que le moteur fournit déjà (`CarView`) […]. Les empreintes de Galahad seul (`tests/helpers/fingerprint.ts`) restent identiques. » (addendum §1.1, §7 « Déterminisme »). Sous `src/sim/`, la seule ligne changée est `id` dans `carView` (vue de rendu, hors `stepRace`).
- « Carrosserie et roues séparées […] un PNG de roue commun, tourné de l'angle que Matter donne à chaque roue. » (§1.1)
- « Repli par code : si une image manque ou n'a pas chargé, `drawCar` dessine la voiture comme aujourd'hui. » Sous jsdom, aucune image ne charge ; un faux `Image` sert au chemin image (§1.1).
- Budget : « ≤ 60 KB par carrosserie, ≤ 400 KB en tout » pour `public/sprites/`, vérifié par un test (§1.2). 1 KB = 1 024 octets, comme `controle.py`.
- « Chemins : préfixés par `import.meta.env.BASE_URL` (le site vit sous `/Galahad-s-car-game/`). » (§1.2)
- « `loadArt(): Promise<Art>`, lancé au démarrage en parallèle de la création de la piste ; une image en échec devient `null` (repli par code, jamais d'exception). L'écran titre n'attend pas les images […]. En debug, `__game.art` expose ce qui a chargé (e2e). » (§1.2)
- Carrosseries : « 512 × 256 px […] cadre du gabarit : 2,80 × 1,40 m centré sur le châssis (183 px/m), axes des roues à (±0,75 ; −0,25) m. La 8b dessine l'image dans ce rectangle, tourné de l'angle du châssis, puis `wheel.png` à chaque roue, par-dessus la carrosserie. » (README)
- « Le `helmet` d'un pilote à sprite n'est plus dessiné (le casque est dans l'image) ; la constante reste pour le repli. » Si la teinte d'un sprite « s'écarte visiblement de sa constante, c'est la constante qui s'aligne sur le sprite, sous les mêmes tests de contraste ; les coloris sont alors re-validés par le papa » (§1.4).
- « Flammes de turbo : les 4 images en boucle à ≈ 14 images/s, à l'arrière de la carrosserie, à la place de `drawFlames`. Repli par code inchangé. » ; « Étoile : `star.png` si présent, sinon `drawStar`. Même taille qu'aujourd'hui. » ; « Ombre au sol : ellipse sombre sous chaque voiture, à la hauteur du sol (`heightAt`), qui rétrécit et s'éclaircit avec la hauteur de vol […]. Dessinée par code, derrière les roues. » (§1.5)
- Plan B :
  - une seule dépendance d'exécution (matter-js) ;
  - `track/`, `cars/`, `ai/` et `loop/` sans DOM ni matter-js, `render/` sans matter-js (`tests/deps.test.ts`) ;
  - aucun cycle d'import ;
  - pas de `@types/node` : accès à node par `process.getBuiltinModule` (comme `tests/helpers/phases.ts`).
- `npm run typecheck` et `npm test` verts à chaque commit. Jamais de `.skip`.
- Commits en français préfixés `feat:` / `fix:` / `test:` / `chore:` / `docs:`, avec les trailers de la session et aucun identifiant de modèle dans le message. Code, commentaires et docs en français.
- Jamais de `git reset` / `checkout` / `stash` / `clean` pendant qu'un autre agent travaille dans l'arbre. Commits ciblés (`git commit -- <chemins>`).
- Outils Python en `python3 -B -I`. Chemins du scratchpad écrits en clair, jamais en variable.
- **Retour arrière** si la 8b déployée déplaît ou fait chuter le fps : `git revert` des commits de la 8b. Pour la fusion, `git revert -m 1 <fusion>` sur `ccr-5b6fabc4-n96ofo`, puis push, CI verte et `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live`. Le revert du commit `chore:` remet les images dans `assets/`.

## Environnement (conteneur)

Playwright 1.56.1 attend Chromium **révision 1194** (`node_modules/playwright-core/browsers.json`). Le conteneur n'a que la **1243**, dans `/opt/pw-browsers`, et `npm run e2e` échoue alors à `browserType.launch`.

Le contournement ne touche ni le dépôt ni `/opt` : aucun `executablePath`, aucun `npx playwright install` (réseau fermé). On crée un dossier de liens dans le scratchpad de la session et on fait pointer `PLAYWRIGHT_BROWSERS_PATH` dessus **devant chaque commande Playwright** :

```bash
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npx playwright test e2e/sprites.spec.ts
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live
```

Cette session : `<scratchpad>/pw-browsers` = `/tmp/claude-0/-home-user-Galahad-s-car-game/d539fc7a-7dfe-5fa5-86a5-9556ce005c65/scratchpad/pw-browsers`. Dans un conteneur neuf, recréer le dossier à l'identique avec la commande ci-dessous, en remplaçant le chemin de `PW` par le scratchpad de la nouvelle session. On obtient :
- `chromium-1194/chrome-linux/*` → `chromium-1243/chrome-linux64/*` ;
- `chromium_headless_shell-1194/chrome-linux/*` → `chromium_headless_shell-1243/chrome-headless-shell-linux64/*`, plus `headless_shell` ;
- `ffmpeg-1011/*` → `ffmpeg-1011/*` ;
- les marqueurs vides de Playwright.

```bash
PW=/tmp/claude-0/-home-user-Galahad-s-car-game/d539fc7a-7dfe-5fa5-86a5-9556ce005c65/scratchpad/pw-browsers; O=/opt/pw-browsers
mkdir -p "$PW/chromium-1194/chrome-linux" "$PW/chromium_headless_shell-1194/chrome-linux" "$PW/ffmpeg-1011"
for f in "$O"/chromium-1243/chrome-linux64/*; do ln -sfn "$f" "$PW/chromium-1194/chrome-linux/"; done
for f in "$O"/chromium_headless_shell-1243/chrome-headless-shell-linux64/*; do ln -sfn "$f" "$PW/chromium_headless_shell-1194/chrome-linux/"; done
ln -sfn "$O/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell" "$PW/chromium_headless_shell-1194/chrome-linux/headless_shell"
for f in "$O"/ffmpeg-1011/*; do ln -sfn "$f" "$PW/ffmpeg-1011/"; done
touch "$PW/chromium-1194/INSTALLATION_COMPLETE" "$PW/chromium_headless_shell-1194/INSTALLATION_COMPLETE" "$PW/chromium_headless_shell-1194/DEPENDENCIES_VALIDATED"
```

Si `node_modules/playwright-core/browsers.json` demande un jour la 1243, le contournement devient inutile : lancer les commandes sans la variable.

## Review Focus

1. **Site déployé sous `/Galahad-s-car-game/`.** Une adresse construite sans `BASE_URL` marche en local (base `/`) et donne 13 × 404 en ligne. Le repli par code masque ces 404 : personne ne voit l'erreur. Attendu : `__game.art.failed` vide **sur le site en ligne**. Couvert par le test « tout charge » (base `/Galahad-s-car-game/`, Step 1), l'aperçu de build sous la base (Step 22) et `npm run e2e:live` (Step 27).
2. **`Scene.t` négatif.** Au départ, `sim.time − (1 − α)·dt` < 0. Un index de flamme hors de [0, 3] donne `drawImage(undefined)`, qui **lève** dans un vrai canvas : écran « Oups ! Recharge la page ». Attendu : index toujours dans [0, 3]. Couvert par le test `flameFrame(−0,5/14) = 3` (Step 12).
3. **Une seule image en échec** (réseau de la tablette, cache partiel). Attendu : voiture mi-image mi-code, aucune exception, course qui roule. Couvert par les tests « image par image » (Step 12) et l'e2e « galahad.png bloquée » (Step 20).
4. **Voiture au-dessus de la lave, ou en vol haut.** `heightAt` y donne le fond du cratère ou de la fosse, sous la lave dessinée : une ombre posée là apparaîtrait dans la lave. Attendu : pas d'ombre au-dessus de la lave, ombre réduite de moitié à 1,5 m de vol. Couvert par les tests de l'ombre (Step 12).
5. **Images arrivées en pleine course** (tablette lente). Attendu : la course n'a jamais attendu ; le dessin passe du code aux images entre deux trames, sans erreur. Couvert par les tests `Game` à promesse jamais résolue puis résolue (Step 18).

## Structure des fichiers

| Fichier | Rôle | Partie |
|---|---|---|
| `src/render/assets.ts` (créé) | `Art`, `NO_ART`, `ART_FILES`, `FLAME_FILES`, `bodyFile`, `loadArt` | 1 |
| `tests/assets.test.ts` (créé, node) | chargeur (faux `Image`), puis budget et en-têtes de `public/sprites/` | 1, 2 |
| `tools/sprites/lisere.py` (créé) | retire le liseré magenta des images Grok (flammes, étoile ; Terre à la 16) | 2 |
| `teinte.py` (scratchpad, non commité) | mesure des teintes du Step 10 ; commité dans `tools/sprites/` seulement si le papa aligne une constante (Q1 = b) | 2 |
| `public/sprites/*.png` (13) | images servies : 7 carrosseries, roue, 4 flammes, étoile | 2 |
| `assets/README.md` | chemins, noms ASCII, `lisere.py`, Terre restée pour la 16 | 2 |
| `src/render/renderer.ts` | `CarView.id`, `Renderer.setArt`, ordre ombres → effets → étoiles → voitures | 3 |
| `src/render/car.ts` | images de carrosserie, de roue et de flamme ; `flameFrame`, `flightHeight`, `shadowScale`, `drawShadow` | 3 |
| `src/render/track.ts` | `drawStar(…, img)` | 3 |
| `src/sim/simulate.ts` (`carView`, l. 703–719) | `id: state.id` | 3 |
| `tests/helpers/fake-ctx.ts` (créé) | faux contexte 2D sorti de `render-smoke.test.ts`, note aussi `globalAlpha` | 3 |
| `tests/render-smoke.test.ts` | importe le faux contexte ; `id` dans ses deux `CarView` | 3 |
| `tests/simulate.test.ts` (boucle l. 110–112) | `carView(sim, i).id` = id du pilote | 3 |
| `tests/render-sprites.test.ts` (créé, node) | dessin des images, flammes, ombre, étoile | 3 |
| `tests/renderer-art.test.ts` (créé, jsdom) | `Renderer` avec et sans images ; `Game` qui n'attend pas | 3, 4 |
| `src/game.ts`, `src/main.ts` | `loadArt()` au démarrage, `new Game(…, art)`, `__game.art` | 4 |
| `e2e/sprites.spec.ts` (créé) | `__game.art` complet, capture `course-sprites.png`, image bloquée | 4 |
| passation, registre | lignes de la 8b | 5 |

---

## Partie 1 — Chargeur `src/render/assets.ts` (Steps 1 à 4)

**Files:**
- Create: `src/render/assets.ts`
- Test: `tests/assets.test.ts`

**Interfaces:**
- Consumes : `GALAHAD`, `PILOTS` (`src/cars/pilots.ts`, ids `'galahad'`, `'pablo'`, `'diego'`, `'timothé'`, `'matthis'`, `'malo'`, `'liam'`).
- Produces :

```ts
export interface Art {
  /** Carrosseries chargées, par id de pilote ('galahad', 'timothé'…) ; un pilote absent = carrosserie par code. */
  readonly bodies: ReadonlyMap<string, CanvasImageSource>;
  readonly wheel: CanvasImageSource | null;
  /** Les 4 images de flamme dans l'ordre, ou null si l'une manque (animation par code). */
  readonly flames: readonly CanvasImageSource[] | null;
  readonly star: CanvasImageSource | null;
  /** Fichiers chargés et en échec, dans l'ordre d'ART_FILES (`__game.art`, e2e). */
  readonly loaded: readonly string[];
  readonly failed: readonly string[];
}
export const NO_ART: Art;                             // figé : rien de chargé, loaded = failed = []
export function bodyFile(pilotId: string): string;    // id sans accents + '.png' : 'timothé' → 'timothe.png'
export const FLAME_FILES: readonly string[];          // ['flame-0.png', 'flame-1.png', 'flame-2.png', 'flame-3.png']
export const ART_FILES: readonly string[];            // carrosseries de GALAHAD puis PILOTS, 'wheel.png', FLAME_FILES, 'star.png'
export interface LoadArtOptions { base?: string; makeImage?: () => HTMLImageElement }
export function loadArt(opts?: LoadArtOptions): Promise<Art>; // base = import.meta.env.BASE_URL ; adresse `${base}sprites/${fichier}`
```

- [ ] **Step 1 : Écrire les tests du chargeur** dans `tests/assets.test.ts` (environnement node : le faux `Image` est injecté par `makeImage`).

```ts
import { GALAHAD, PILOTS } from '../src/cars/pilots';
import { ART_FILES, FLAME_FILES, NO_ART, bodyFile, loadArt } from '../src/render/assets';

/** Faux `Image` : `onload` (ou `onerror` si son fichier est dans `fail`) à la microtâche qui suit `src = …`. */
function fakeImages(fail: readonly string[] = []) {
  const srcs: string[] = [];
  const makeImage = (): HTMLImageElement => {
    const img = {
      onload: null as (() => void) | null, onerror: null as (() => void) | null, url: '',
      set src(v: string) {
        this.url = v; srcs.push(v);
        queueMicrotask(() => (fail.some((f) => v.endsWith(`/${f}`)) ? this.onerror : this.onload)?.());
      },
    };
    return img as unknown as HTMLImageElement;
  };
  return { srcs, makeImage };
}
const urlOf = (img: CanvasImageSource | null | undefined) => (img as unknown as { url: string } | null | undefined)?.url;
const B = '/Galahad-s-car-game/';

test('bodyFile : nom ASCII, un fichier par pilote ; « timothé » → timothe.png', () => {
  expect(bodyFile('galahad')).toBe('galahad.png');
  expect(bodyFile('timothé')).toBe('timothe.png');
  const files = [GALAHAD, ...PILOTS].map((p) => bodyFile(p.id));
  for (const f of files) expect(f).toMatch(/^[a-z0-9-]+\.png$/);
  expect(new Set(files).size).toBe(7);
});

test('ART_FILES : 7 carrosseries, la roue, 4 flammes, l’étoile ; pas la Terre (tâche 16)', () => {
  expect(ART_FILES).toEqual(['galahad.png', 'pablo.png', 'diego.png', 'timothe.png', 'matthis.png', 'malo.png', 'liam.png',
    'wheel.png', 'flame-0.png', 'flame-1.png', 'flame-2.png', 'flame-3.png', 'star.png']);
});

test('tout charge : adresses sous la base, carrosseries par id de pilote, flammes dans l’ordre', async () => {
  const { srcs, makeImage } = fakeImages();
  const art = await loadArt({ base: B, makeImage });
  expect(srcs).toEqual(ART_FILES.map((f) => `${B}sprites/${f}`));
  expect([...art.bodies.keys()]).toEqual([GALAHAD, ...PILOTS].map((p) => p.id));
  expect(urlOf(art.bodies.get('timothé'))).toBe(`${B}sprites/timothe.png`);
  expect(art.flames?.map(urlOf)).toEqual(FLAME_FILES.map((f) => `${B}sprites/${f}`));
  expect(urlOf(art.wheel)).toBe(`${B}sprites/wheel.png`);
  expect(urlOf(art.star)).toBe(`${B}sprites/star.png`);
  expect(art.loaded).toEqual(ART_FILES);
  expect(art.failed).toEqual([]);
});

test('échecs isolés : carrosserie absente, roue null, flammes null (les 4 ou rien), jamais d’exception', async () => {
  const art = await loadArt({ base: '/', makeImage: fakeImages(['pablo.png', 'wheel.png', 'flame-2.png']).makeImage });
  expect(art.bodies.has('pablo')).toBe(false);
  expect(art.bodies.size).toBe(6);
  expect(art.wheel).toBeNull();
  expect(art.flames).toBeNull();
  expect(art.star).not.toBeNull();
  expect(art.failed).toEqual(['pablo.png', 'wheel.png', 'flame-2.png']);
  expect(art.loaded).toHaveLength(10);
});

test('makeImage qui lève : la promesse se résout quand même, tout en échec', async () => {
  const art = await loadArt({ base: '/', makeImage: () => { throw new Error('pas d’Image'); } });
  expect(art.failed).toEqual(ART_FILES);
  expect(art.bodies.size).toBe(0);
});

test('base par défaut : import.meta.env.BASE_URL (« / » sous Vitest)', async () => {
  const { srcs, makeImage } = fakeImages();
  await loadArt({ makeImage });
  expect(import.meta.env.BASE_URL).toBe('/');
  expect(srcs[0]).toBe('/sprites/galahad.png');
});

test('NO_ART : rien de chargé, figé', () => {
  expect(NO_ART.bodies.size).toBe(0);
  expect([NO_ART.wheel, NO_ART.flames, NO_ART.star]).toEqual([null, null, null]);
  expect(Object.isFrozen(NO_ART)).toBe(true);
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `npx vitest run tests/assets.test.ts`
Expected: FAIL, « Failed to resolve import "../src/render/assets" ».

- [ ] **Step 3 : Écrire `src/render/assets.ts`.**
  - `bodyFile(id)` = `id.normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '.png'`.
  - Chaque fichier d'`ART_FILES` donne une promesse qui ne rejette jamais. `makeImage()` (par défaut `() => new Image()`), puis `onload` → l'image, `onerror` → `null`, puis `src = url`. Le tout est dans un `try`, et un `catch` donne `null`.
  - `Promise.all`, puis `Art` : `bodies` = les ids de `[GALAHAD, ...PILOTS]` dont l'image n'est pas `null` ; `flames` = le tableau si les 4 sont là, sinon `null` ; `loaded` et `failed` dans l'ordre d'`ART_FILES`.
  - Pas de délai d'abandon : un navigateur finit toujours par `load` ou `error`. `NO_ART` est figé par `Object.freeze`.
  - En tête du fichier, un commentaire renvoie à l'addendum §1.2 et justifie les noms ASCII.

- [ ] **Step 4 : Vérifier puis commiter**

Run: `npx vitest run tests/assets.test.ts tests/deps.test.ts && npm run typecheck`
Expected: 7 tests du chargeur verts, `deps` vert (aucun cycle), typecheck sans erreur.

```bash
git add src/render/assets.ts tests/assets.test.ts
git commit -m "feat: chargeur des images (loadArt), une image en échec devient null" -- src/render/assets.ts tests/assets.test.ts
```

---

## Partie 2 — Images dans `public/sprites/` (Steps 5 à 11)

**Files:**
- Create: `tools/sprites/lisere.py`, `public/sprites/` (13 fichiers) ; `teinte.py` dans le scratchpad (mesure, non commitée sauf Q1 = b)
- Move: `assets/sprites/{galahad,pablo,diego,matthis,malo,liam,wheel}.png` → `public/sprites/` ; `assets/sprites/timothée.png` → `public/sprites/timothe.png`
- Replace: `assets/sprites/flame-{0..3}.png` et `star.png`, corrigés vers `public/sprites/` puis retirés d'`assets/` ; `assets/sprites/earth.png` **reste** (tâche 16)
- Modify: `assets/README.md`, `tests/assets.test.ts`

**Interfaces:**
- Consumes : `ART_FILES`, `FLAME_FILES`, `bodyFile` (Partie 1) ; `quantize(canvas, path)` de `tools/sprites/controle.py`.
- Produces : les 13 fichiers d'`ART_FILES` dans `public/sprites/`, servis sous `${BASE_URL}sprites/`.

- [ ] **Step 5 : Écrire les tests du budget**, à la fin de `tests/assets.test.ts`.

```ts
describe('public/sprites (addendum §1.2 : budget ; README : cadre du gabarit)', () => {
  /** Accès à node (pas de @types/node), au strict nécessaire. */
  interface NodeFs { readdirSync(p: string): string[]; statSync(p: string): { size: number }; readFileSync(p: string): Uint8Array }
  const fs = (): NodeFs => (globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }).process.getBuiltinModule('node:fs');
  const DIR = 'public/sprites';
  const size = (f: string) => fs().statSync(`${DIR}/${f}`).size;
  /** Largeur et hauteur lues dans l'en-tête IHDR (octets 16 à 23, gros-boutiste). */
  const dims = (f: string): [number, number] => {
    const b = fs().readFileSync(`${DIR}/${f}`);
    const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    return [u32(16), u32(20)];
  };
  const BODIES = [GALAHAD, ...PILOTS].map((p) => bodyFile(p.id));

  test('le dossier contient exactement les fichiers chargés (ART_FILES)', () => {
    expect(fs().readdirSync(DIR).sort()).toEqual([...ART_FILES].sort());
  });
  test('≤ 60 KB par carrosserie, ≤ 400 KB pour le dossier', () => {
    for (const f of BODIES) expect(size(f), f).toBeLessThanOrEqual(60 * 1024);
    const total = fs().readdirSync(DIR).reduce((s, f) => s + size(f), 0);
    console.log(`public/sprites : ${total} octets`);
    expect(total).toBeLessThanOrEqual(400 * 1024);
  });
  test('carrosseries 512 × 256 px (cadre 2,80 × 1,40 m à 183 px/m) ; roue et flammes carrées', () => {
    for (const f of BODIES) expect(dims(f), f).toEqual([512, 256]);
    for (const f of ['wheel.png', ...FLAME_FILES]) { const [w, h] = dims(f); expect(w, f).toBe(h); }
  });
});
```

Run: `npx vitest run tests/assets.test.ts`
Expected: les 3 nouveaux tests en FAIL (`ENOENT … public/sprites`), les 7 de la Partie 1 verts.

- [ ] **Step 6 : Écrire `tools/sprites/lisere.py`** (`python3 -B -I tools/sprites/lisere.py <entrée.png> <sortie.png>`). Il fait ce que le README demande, « de la même façon » que pour la roue : la couleur du bord vient du pixel opaque voisin, et tout alpha ≥ 240 passe à 255.
  - « Rose » = `r − g > 40` et `b − g > 40`. Aucune couleur légitime des flammes (rouge, orange, jaune, blanc), de l'étoile (crème) ni de la Terre n'y entre.
  - **Garde-fou** : le script refuse l'image (code de sortie 2, message) si plus de 25 % des pixels d'alpha ≥ 240 sont roses. Mesuré, à ±2 points selon le dénominateur : `liam.png` ≈ 50 % (carrosserie rose, à ne jamais passer), flammes ≈ 6 à 9 %, Terre ≈ 0,6 %, étoile 0 %.
  - Pour atteindre aussi les points roses isolés, la couleur se propage par couches de 4-voisins sur toute l'image, transparent compris. Les sources sont les pixels non roses d'alpha ≥ 240. Seuls les pixels roses changent de couleur, et leur alpha ne change pas.
  - Le décalage `shift(arr, dy, dx)` remplit ses bords de zéros (pas de `np.roll`, qui enroule).
  - Quantification : `quantize` de `controle.py`, importé après `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))`, car `python3 -I` n'ajoute pas le dossier du script. Lancé en `-B` : pas de `__pycache__` dans `tools/sprites/`.
  - Rapport JSON : `source`, `octets_avant`, `octets_apres`, `roses_corriges`, `avant` et `apres` = `{roses_alpha_ge_16, alpha_240_254}`.

Le cœur (seul algorithme que la signature ne fixe pas) :

```python
VOISINS = ((-1, 0), (1, 0), (0, -1), (0, 1))

def fix(px):  # px : int32, (h, w, 4)
    a = px[..., 3]
    target = rose(px) & (a > 0)
    filled = ~rose(px) & (a >= OPAQUE_FROM)
    rgb = px[..., :3].astype(np.float64)
    while (target & ~filled).any():
        acc = sum(shift(rgb * filled[..., None], dy, dx) for dy, dx in VOISINS)
        cnt = sum(shift(filled.astype(np.float64), dy, dx) for dy, dx in VOISINS)
        ready = ~filled & (cnt > 0)
        if not ready.any():
            break  # aucune source : rien à propager
        rgb[ready] = acc[ready] / cnt[ready][:, None]
        filled |= ready
    out = px.copy()
    out[..., :3][target] = np.clip(np.rint(rgb[target]), 0, 255)
    out[..., 3][a >= OPAQUE_FROM] = 255
    return out.astype(np.uint8), int(target.sum())
```

- [ ] **Step 7 : Corriger les flammes et l'étoile vers `public/sprites/`**

```bash
mkdir -p public/sprites
for f in flame-0 flame-1 flame-2 flame-3 star; do python3 -B -I tools/sprites/lisere.py assets/sprites/$f.png public/sprites/$f.png; done
```

Expected : valeurs ≈ mesurées le 2026-10-24 (Pillow 12.3.0) par le prototype. Les comptes de pixels sont exacts à Pillow égal ; les octets varient de ±5 % avec une autre version de Pillow. Ce qui doit être exact : « après » = 0 dans les deux colonnes.

| Fichier | roses corrigés | roses visibles (α ≥ 16) avant → après | α 240–254 avant → après | octets avant → après |
|---|---|---|---|---|
| `flame-0.png` | 1 335 | 938 → 0 | 2 104 → 0 | 5 122 → 4 775 |
| `flame-1.png` | 2 678 | 2 017 → 0 | 7 117 → 0 | 8 137 → 7 480 |
| `flame-2.png` | 2 183 | 1 582 → 0 | 7 213 → 0 | 8 129 → 7 541 |
| `flame-3.png` | 1 455 | 1 052 → 0 | 2 969 → 0 | 5 638 → 5 197 |
| `star.png` | 658 | 399 → 0 | 21 012 → 0 | 10 423 → 10 298 |

Idempotence : `python3 -B -I tools/sprites/lisere.py public/sprites/flame-1.png <scratchpad>/x.png` (chemin du scratchpad écrit en clair) → `roses_corriges: 0`, même taille. Garde-fou : `… assets/sprites/liam.png <scratchpad>/y.png` → refus, code de sortie 2. Joindre au papa l'aperçu avant / après sur le ciel du jeu (`#0a1030`), cinq images côte à côte. Il est produit dans le scratchpad et n'est pas commité.

- [ ] **Step 8 : Déplacer le reste**

```bash
git mv assets/sprites/galahad.png assets/sprites/pablo.png assets/sprites/diego.png assets/sprites/matthis.png \
       assets/sprites/malo.png assets/sprites/liam.png assets/sprites/wheel.png public/sprites/
git mv 'assets/sprites/timothée.png' public/sprites/timothe.png
git rm assets/sprites/flame-0.png assets/sprites/flame-1.png assets/sprites/flame-2.png assets/sprites/flame-3.png assets/sprites/star.png
git add public/sprites
ls public/sprites | wc -l; ls assets/sprites
```

Expected : `13`, puis `earth.png` seul.

- [ ] **Step 9 : Vérifier le budget**

Run: `npx vitest run tests/assets.test.ts`
Expected: 10 verts ; imprimé « public/sprites : ≈ 146 846 octets » (≈ 143 KiB, ±5 % selon Pillow ; exigé ≤ 400 KiB). On recopie ensuite **la valeur imprimée par le test**, pas celle-ci.

- [ ] **Step 10 : Mesurer les teintes** (addendum §1.4). C'est une mesure, pas un outil du dépôt : écrire `<scratchpad>/teinte.py` (`python3 -B -I <scratchpad>/teinte.py <dossier> <fichier>=<RRGGBB> …`). Il n'est copié dans `tools/sprites/` et commité que si le papa aligne une constante (Q1 = b), pour que la mesure derrière le changement reste rejouable.
  - **Zone de caisse**, dans le repère du châssis (centre de l'image en (256, 128), 512/2,8 px/m) : x ∈ [−1,0 ; 1,0] m, y ∈ [−0,20 ; +0,35] m, y vers le haut. On prend les pixels d'alpha 255.
  - Parmi eux, les pixels à ΔE76 ≤ 25 de la constante (Lab D65) donnent la part de la zone et la médiane RGB. Le script calcule le ΔE76 entre cette médiane et la constante, et le Δteinte HSV quand la saturation de la constante est ≥ 0,2.
  - **Verdict** : « à montrer au papa » si la part est < 25 %, si ΔE76 > 20 ou si Δteinte > 15° ; sinon « garder ».

Run: `python3 -B -I <scratchpad>/teinte.py public/sprites galahad.png=1e5cff pablo.png=c8001e diego.png=2ecc40 timothe.png=f5f5f5 matthis.png=ffff00 malo.png=ff8000 liam.png=ff77aa`

Expected : valeurs ≈ mesurées le 2026-10-24, à ±1 sur ΔE76 et ±2 points sur la part selon l'arrondi de la zone ; les constantes viennent de `CONFIG.GALAHAD_COLOR` et de `PILOTS[].color`.

| Fichier | constante | médiane du sprite | part | ΔE76 | Δteinte | verdict |
|---|---|---|---|---|---|---|
| galahad | `#1e5cff` | `#004af9` | 49 % | 10,7 | 1° | garder |
| pablo | `#c8001e` | `#ca0012` | 53 % | 6,2 | 4° | garder |
| diego | `#2ecc40` | `#16d92f` | 53 % | 12,7 | 1° | garder |
| timothe | `#f5f5f5` | `#f5f5f5` | 57 % | 0,0 | — | garder |
| matthis | `#ffff00` | `#fdf904` | 46 % | 3,1 | 1° | garder |
| malo | `#ff8000` | `#fc7601` | 50 % | 4,7 | 2° | garder |
| liam | `#ff77aa` | `#fb5b9b` | 53 % | 10,8 | 2° | garder |

Aucune constante ne change dans la 8b : les sprites sont juste un peu plus saturés, sans changement de teinte. Le tableau va au papa avec la capture (question Q1). Si un verdict sort « à montrer », ne rien changer et poser Q1 avec la ligne concernée. S'il choisit d'aligner :
- la constante prend la médiane mesurée ;
- `npx vitest run tests/pilots.test.ts` (contraste ≥ 3:1, aucun copain bleu) doit rester vert ;
- `teinte.py` est copié dans `tools/sprites/` et commité avec la constante ;
- le papa re-valide les coloris comme en 5a.

- [ ] **Step 11 : Mettre à jour `assets/README.md`, puis commiter.**
  - Titre et intro : les images servies sont dans `public/sprites/`, et `assets/` ne garde que les bruts (`generated/`), la Terre et les polices.
  - Noms ASCII. Le brut reste `assets/generated/timothée.png` (accentué, non déplacé), la sortie servie est `public/sprites/timothe.png`. La commande `controle.py <brut> <sortie>` se lance donc avec ces deux noms, pas avec un `<id>.png` commun.
  - Commande de `controle.py` : sortie `public/sprites/<fichier>`, outils en `python3 -B -I`.
  - Section « Roue, étoile, Terre, flammes » : liseré corrigé le 2026-10-24 par `lisere.py` (tableau du Step 7) ; Terre non corrigée, à passer à la tâche 16 ; ne jamais passer une carrosserie.
  - Teintes : une ligne (« mesurées le 2026-10-24, conformes, constantes gardées » ou la décision Q1).
  - Budget : la valeur imprimée au Step 9.

```bash
npm run typecheck
git add tools/sprites/lisere.py
git commit -m "chore: images dans public/sprites (liseré magenta retiré des flammes et de l'étoile), budget et cadre testés" \
  -- public/sprites assets/sprites tools/sprites/lisere.py assets/README.md tests/assets.test.ts
git status --short   # attendu : rien sous tools/ (pas de __pycache__)
```

---

## Partie 3 — Dessin (Steps 12 à 17)

**Files:**
- Create: `tests/helpers/fake-ctx.ts`, `tests/render-sprites.test.ts` (node), `tests/renderer-art.test.ts` (jsdom)
- Modify: `src/render/renderer.ts`, `src/render/car.ts`, `src/render/track.ts:296-321`, `src/sim/simulate.ts:703-719`, `tests/render-smoke.test.ts:10-26,56-60,72-74`, `tests/simulate.test.ts:110-112`

**Interfaces:**
- Consumes : `Art`, `NO_ART` (Partie 1) ; `heightAt`, `slopeAt` (`src/track/query.ts`) ; `CarPose` déjà interpolée (`sceneOf`).
- Produces :

```ts
// src/render/renderer.ts
export interface CarView { id: string; /* id du pilote, clé de Art.bodies */ /* … champs actuels inchangés */ }
export class Renderer { setArt(art: Art): void; /* draw(scene, camera, effects?) inchangé */ }

// src/render/car.ts
export function drawCar(ctx: Ctx, car: CarView, ppm: number, t: number, toScreen: (p: Pt) => Pt,
                        dims: CarDims = CONFIG, art: Art = NO_ART): void;
export function flameFrame(t: number): number;                                  // ((⌊14 t⌋ mod 4) + 4) mod 4
export function flightHeight(car: CarView, track: Track, wheelRadius: number): number; // max(0, min des roues (w.y − R − heightAt(w.x))) ; sans roue : 0
export function shadowScale(h: number): number;                                  // 1 / (1 + h / 1,5)
export function drawShadow(ctx: Ctx, car: CarView, track: Track, ppm: number, toScreen: (p: Pt) => Pt,
                           dims: CarDims = CONFIG): void;

// src/render/track.ts
export function drawStar(ctx: Ctx, x: number, y: number, t: number, ppm: number, img: CanvasImageSource | null = null): void;
```

Valeurs fixées, en constantes de module de `car.ts` : ce sont des constantes de dessin, comme `FOSSE_HALO_M` dans `track.ts`, pas des paramètres de `CONFIG`.

| Constante | Valeur | Origine |
|---|---|---|
| `BODY_W_M`, `BODY_H_M` | 2,8, 1,4 | cadre du gabarit (README) |
| `FLAME_FPS` | 14 | addendum §1.5 |
| accroche des flammes, carrosserie image | (−1,31 ; −0,08), repère local y vers le bas | gabarit, calque `reperes` : triangle `-131 -12 … -131 -4` |
| accroche des flammes, carrosserie par code | (−L/2 ; +0,08) | `drawFlames(ctx, −L/2, 0.08, t)` actuel |
| `FLAME_SIZE_M`, `FLAME_RIGHT_M` | 1,2 (carré), 0,34 | bbox mesurées des 4 flammes (x ≈ 23–51 → 189–229 px, y centrés à ≈ 0,47–0,50) : flamme visible ≈ 0,62–0,74 m derrière l'arrière, 0,39–0,65 m de haut ; le bord droit du carré dépasse l'accroche de 0,34 m sous la carrosserie |
| `SHADOW_RX_M`, `SHADOW_RY_M`, `SHADOW_ALPHA`, `SHADOW_HALF_M` | 1,2, 0,15, 0,45, 1,5 | à juger sur capture |

Ordre dans `drawCar` :
1. `save`, `translate`, `rotate(−angle)`, `scale(ppm)`.
2. Si `turbo` : flamme image (`art.flames[flameFrame(t)]`, rectangle `(ax + FLAME_RIGHT_M − FLAME_SIZE_M, ay − FLAME_SIZE_M / 2, FLAME_SIZE_M, FLAME_SIZE_M)`), sinon `drawFlames`.
3. Carrosserie image `drawImage(body, −1,4, −0,7, 2,8, 1,4)` (sans casque, aileron, vitre ni bandes), sinon le dessin d'aujourd'hui.
4. `restore`.
5. Roues : image (`save`, `translate(écran)`, `rotate(−w.angle)`, `drawImage(wheel, −r, −r, 2r, 2r)`, `restore`, avec r = `WHEEL_RADIUS × ppm`), sinon `drawWheel`.
6. Prénom, inchangé.

Ordre dans `Renderer.draw` : ciel → piste → **ombres** (voitures visibles, même tri que les voitures) → effets → étoiles (`drawStar(…, this.art.star)`) → voitures (`drawCar(…, this.cfg, this.art)`).

- [ ] **Step 12 : Écrire les tests.**
  - Déplacer `fakeCtx` de `render-smoke.test.ts` vers `tests/helpers/fake-ctx.ts` : `export type Call = { name; args; fillStyle?; globalAlpha? }`, où `globalAlpha` est la valeur courante à l'appel. Ajouter `id: 'robot'` et `id: 'malo'` aux deux `CarView` de `render-smoke`.
  - Puis `tests/render-sprites.test.ts`. Chaque test crée son `{ ctx, calls } = fakeCtx()`, avec :
    - `PPM = 85.7` et `S = (p) => ({ x: p.x * 10, y: -p.y * 10 })` ;
    - des fausses images `{ name }` (`body`, `wheel`, `flames[0..3]`, `star`) ;
    - `art(over = {})` = `{ bodies: new Map([['galahad', body]]), wheel, flames, star, loaded: [], failed: [], ...over }` ;
    - `car` = `{ id: 'galahad', name: 'Galahad', helmet: '#00ff00', turbo: false, … }` en (10 ; 1), angle 0,3, roues en (9,25 ; 0,4, angle 1) et (10,75 ; 0,4, angle −2) :

```ts
const draws = (calls: Call[]) => calls.filter((c) => c.name === 'drawImage');
const before = (calls: Call[], c: Call, n: number) => calls.slice(calls.indexOf(c) - n, calls.indexOf(c)).map((d) => [d.name, ...d.args]);

test('carrosserie image : cadre 2,80 × 1,40 m centré sur le châssis, tourné de −angle ; ni casque ni carrosserie par code', () => {
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, car, PPM, 0, S, CONFIG, art());
  const d = draws(calls);
  expect(d.map((c) => c.args[0])).toEqual([body, wheel, wheel]);
  expect(d[0].args.slice(1)).toEqual([-1.4, -0.7, 2.8, 1.4]);
  expect(before(calls, d[0], 3)).toEqual([['translate', 100, -10], ['rotate', -0.3], ['scale', PPM, PPM]]);
  expect(calls.some((c) => c.name === 'fill' && c.fillStyle === car.helmet)).toBe(false);
  expect(calls.some((c) => c.name === 'arcTo')).toBe(false);
});

test('roue image à la position de chaque roue, tournée de −w.angle, par-dessus la carrosserie', () => {
  const { ctx, calls } = fakeCtx();
  drawCar(ctx, car, PPM, 0, S, CONFIG, art());
  const r = CONFIG.WHEEL_RADIUS * PPM;
  car.wheels.forEach((w, k) => {
    const d = draws(calls)[1 + k];
    expect(before(calls, d, 2)).toEqual([['translate', w.x * 10, -w.y * 10], ['rotate', -w.angle]]);
    expect(d.args.slice(1)).toEqual([-r, -r, 2 * r, 2 * r]);
  });
});
```

D'autres tests du même fichier (les noms suffisent, avec les assertions dites) :
  - **Repli image par image.**
    - `bodies` vide : `fill` avec `fillStyle === '#00ff00'` (casque), 2 `drawImage` (les roues).
    - `wheel: null` : `drawImage` = `[body]` seul, et `rotate` = `[−0,3, −1, 2]`.
    - Sans `art` ou avec `NO_ART` : aucun `drawImage`.
  - **Flammes**, `turbo: true`, `t = 1,5/14` :
    - carrosserie image : `draws[0]` = `flames[1]`, args ≈ `(−2,17, −0,68, 1,2, 1,2)` (`toBeCloseTo`, 9), puis le `drawImage` de la carrosserie juste après ;
    - carrosserie par code : `flames[1]` en ≈ `(−1,96, −0,52, 1,2, 1,2)` ;
    - `flames: null` : `fill` en `'#ff7a00'` (code) et aucun `drawImage` de flamme ;
    - `turbo: false` : aucune flamme.
  - **`flameFrame`** : `0 → 0`, `0,5/14 → 0`, `1,5/14 → 1`, `3,5/14 → 3`, `4,5/14 → 0`, `−0,5/14 → 3`, `1e6 + 0,5/14 →` un entier de [0, 3].
  - **Ombre.** Piste `generateTrack(1, 1680, CONFIG)`, `x0 = track.xStart − 2`, roues posées à `heightAt + R` :
    - `flightHeight` ≈ 0 ; tout relevé de 1,5 m → ≈ 1,5 ; roues sous le sol → 0 ;
    - `shadowScale(0) = 1`, `shadowScale(1,5) = 0,5`, `shadowScale(3) ≈ 1/3`, strictement décroissante ;
    - `drawShadow` au sol : un `ellipse` en `S(x0, heightAt(x0))`, rayons ≈ `1,2·PPM·s` et `0,15·PPM·s`, rotation `−slopeAt(track, x0)` ; le `fill` porte `fillStyle '#000000'` et `globalAlpha ≈ 0,45·s` ; `save` avant, `restore` après ;
    - voiture en `track.volcanoes[0].xLava` à 5 m de haut : aucun `ellipse`.
  - **Étoile image** : `drawStar(ctx, 100, 50, 2, PPM, star)` donne un `createRadialGradient` (halo gardé), 0 `lineTo`, `drawImage(star, −0,5·PPM, −0,5·PPM, PPM, PPM)` précédé de `translate(100, 50)`, `rotate(1,6)`. Sans `img`, les 9 `lineTo` d'aujourd'hui.

`tests/simulate.test.ts`, dans la boucle existante des lignes 110 à 112 (`const view = carView(sim, i)`) : ajouter `expect(view.id).toBe(pilot.id);`. La boucle couvre les 5 pilotes de la grille, Galahad compris.

`tests/renderer-art.test.ts` (`// @vitest-environment jsdom`, bloc `Renderer`) :
  - **Mise en place.** `getContext` espionné → `fakeCtx().ctx`. `clientWidth` et `clientHeight` du canvas définis à 1 280 et 800. Course `createRaceSim(generateTrack(1, 1680, CONFIG), CONFIG, { robots: true })`, scène `sceneOf(sim)`, caméra centrée sur la moyenne des x des 5 voitures (y sol + 3). Vider `calls` avant chaque `draw`.
  - **Sans images** (`NO_ART`) : 2 `drawImage` (le ciel).
  - **Après `setArt`** avec les 7 carrosseries, la roue, les flammes et l'étoile : 2 + 5 + 10 + n `drawImage`, où n = étoiles actives à moins de demi-largeur + 1 m de la caméra (compté dans le test). Les 5 `ellipse` à `fillStyle '#000000'` viennent toutes avant le premier `drawImage` de carrosserie.

- [ ] **Step 13 : Vérifier l'échec**

Run: `npx vitest run tests/render-sprites.test.ts tests/renderer-art.test.ts tests/render-smoke.test.ts`
Expected: FAIL. Il manque les exports `flameFrame`, `flightHeight`, `shadowScale`, `drawShadow` et `setArt`, et `CarView` n'a pas encore `id` (typecheck).

- [ ] **Step 14 : `CarView.id` et `carView`.** Dans `renderer.ts`, ajouter le champ `id: string`. Dans `simulate.ts`, ajouter `id: state.id` dans `carView`.
  - Run: `npm run typecheck`
  - Expected: plus d'erreur hors des tests de la Partie 3.

- [ ] **Step 15 : `drawCar` avec `art`, `flameFrame`, ombre, étoile, aux interfaces et dans l'ordre ci-dessus.**
  - Sans allocation par trame : `Map.get`, index par calcul.
  - L'ombre passe par `globalAlpha` (pas de chaîne `rgba(…)` construite à chaque trame).
  - Ordre exact dans `drawShadow`, que lisent les tests (le faux contexte note le `fillStyle` courant à chaque appel) : `save`, `globalAlpha = …`, `fillStyle = '#000000'`, `beginPath`, `ellipse`, `fill`, `restore`.
  - `overLava(track, x)` en boucle `for…of` locale à `car.ts` : |x − xLava| ≤ lavaWidth / 2 pour un volcan.

- [ ] **Step 16 : `Renderer.setArt`** (champ `art = NO_ART`) **et l'ordre de `draw`.**

- [ ] **Step 17 : Vérifier puis commiter**

Run: `npx vitest run tests/render-sprites.test.ts tests/renderer-art.test.ts tests/render-smoke.test.ts tests/simulate.test.ts tests/game-frame.test.ts && npm run typecheck`
Expected: tous verts, `render-smoke` inchangé sur le fond (rotations `[−0,3, −1, −1]`, casque en `helmet`), typecheck sans erreur.

```bash
git add tests/helpers/fake-ctx.ts tests/render-sprites.test.ts tests/renderer-art.test.ts
git commit -m "feat: carrosseries, roues, flammes et étoile en images, ombre au sol, repli par code image par image" \
  -- src/render/renderer.ts src/render/car.ts src/render/track.ts src/sim/simulate.ts tests/simulate.test.ts \
     tests/helpers/fake-ctx.ts tests/render-smoke.test.ts tests/render-sprites.test.ts tests/renderer-art.test.ts
```

---

## Partie 4 — Branchement, e2e, empreinte (Steps 18 à 23)

**Files:**
- Modify: `src/game.ts` (constructeur, champ, accesseur), `src/main.ts`, `tests/renderer-art.test.ts`
- Create: `e2e/sprites.spec.ts`

**Interfaces:**
- Consumes : `loadArt`, `Art` (Partie 1) ; `Renderer.setArt` (Partie 3).
- Produces :

```ts
// src/game.ts : 4e paramètre ajouté, le reste inchangé (`private readonly opts` compris)
constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, private readonly opts: { seed: number; length: number; debug: boolean }, art?: Promise<Art>);
/** Images (debug, e2e, tâche 8b) : réglées ou non, fichiers chargés et en échec ; copies. */
get art(): { settled: boolean; loaded: string[]; failed: string[] };
// src/main.ts : const art = loadArt(); puis new Game(canvas, hud, opts, art)
```

- [ ] **Step 18 : Écrire les tests `Game`** (bloc `Game` de `tests/renderer-art.test.ts`). Même harnais que `tests/game-frame.test.ts` : faux `requestAnimationFrame`, `getContext` → `{}`, `Renderer.prototype.resize` et `draw` simulés, `setArt` espionné **avant** le constructeur, nettoyage `stop` / `throttle.dispose` / `jumpInput.dispose`.
  - **La course n'attend pas les images.** Avec `new Promise<Art>(() => {})` : `start()` puis 10 trames, `draw` appelé 10 fois, `game.art` = `{ settled: false, loaded: [], failed: [] }`, `setArt` jamais appelé.
  - **Images arrivées en pleine course.** Avec `Promise.resolve(a)`, où `a = { ...NO_ART, loaded: ['galahad.png'], failed: ['wheel.png'] }` : 3 trames, puis `await Promise.resolve()` deux fois, puis 3 trames. `setArt` est appelé une fois, avec `a`, et `draw` 6 fois. `game.art` = `{ settled: true, loaded: ['galahad.png'], failed: ['wheel.png'] }` ; un `push` sur le tableau rendu ne change pas l'appel suivant.

Run: `npx vitest run tests/renderer-art.test.ts`
Expected: FAIL. Le constructeur ignore `art`, et `game.art` est `undefined`.

- [ ] **Step 19 : Brancher.** Dans `Game`, après `new Renderer` :

```ts
void art?.then((a) => { this.loadedArt = a; this.renderer.setArt(a); });
```

Ajouter le champ `loadedArt: Art | null = null` et l'accesseur `art`, par `Edit` après relecture de `src/game.ts`. Dans `main.ts`, `const art = loadArt();` **avant** `new Game(…)`, avec un commentaire : les requêtes partent pendant que `generateTrack` tourne dans le constructeur.

Run: `npx vitest run tests/renderer-art.test.ts tests/game-frame.test.ts`
Expected: verts.

- [ ] **Step 20 : Écrire `e2e/sprites.spec.ts`.** Liste locale `ART` = les 13 noms triés. Les helpers sont importés de `./helpers` (`SHOTS`, `waitForGame`, `holdFinger`, `holdFingerAndTapJump`, `jumpState`, `gameState`) ; `e2e/race.spec.ts` n'est pas touché.
  - `images : __game.art complet sur la tablette simulée, Galahad en l’air avec son ombre ; capture course-sprites.png`
    1. Erreurs console et `pageerror` recueillies, `goto('./?seed=1&debug=1')`.
    2. `page.waitForFunction(() => (window as any).__game.art.settled, null, { timeout: 10_000 })` ; `failed` = `[]` ; `loaded` trié = `ART`.
    3. `holdFingerAndTapJump(page, 2.5, 0.3)`, puis `jumps === 1`, puis `page.screenshot({ path: `${SHOTS}/course-sprites.png`, fullPage: true })`.
    4. Aucune erreur recueillie.
  - `une carrosserie bloquée (galahad.png) : repli par code, la course roule sans exception`
    1. `page.route('**/sprites/galahad.png', (r) => r.abort())`.
    2. `settled`, puis `failed` = `['galahad.png']` et 12 chargées.
    3. `holdFinger(page, 2)`, puis `state === 'racing'` et `progress` en hausse de plus de 3 m.
    4. Aucun `pageerror`. Les messages console « Failed to load resource » de la requête bloquée sont filtrés.

Run: `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npx playwright test e2e/sprites.spec.ts` (section « Environnement »)
Expected: 2 passed ; `e2e/screenshots/course-sprites.png` écrit. Le regarder : carrosseries reconnaissables, roues dans les arches, ombre sous Galahad en l'air.

- [ ] **Step 21 : Empreinte et frontière de la simulation**

```bash
npx vitest run tests/empreinte.test.ts tests/pilots.test.ts tests/deps.test.ts
git diff --stat <BASE> -- src/sim src/physics src/track src/cars src/ai src/loop src/config.ts   # <BASE> : SHA en clair, lu au registre
```

Expected:
- `empreinte` 6/6 avec les hash figés inchangés (`FROZEN` et `FROZEN_CONFIG`), `pilots` vert, `deps` vert ;
- le diff ne montre que `src/sim/simulate.ts | 1 +` (le champ `id` de `carView`).

- [ ] **Step 22 : Suites complètes et build sous la base du site**

```bash
npm run typecheck && npm test
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
VITE_BASE=/Galahad-s-car-game/ npm run build && ls dist/sprites | wc -l
VITE_BASE=/Galahad-s-car-game/ npx vite preview --port 4174 --strictPort   # en arrière-plan
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers E2E_LIVE_URL=http://localhost:4174/Galahad-s-car-game/ \
  npx playwright test -c playwright.live.config.ts e2e/sprites.spec.ts
```

Expected:
- typecheck sans erreur ; `npm test` tout vert (≈ 3 min) ; `npm run e2e` : 16 passed (les 14 de la tâche 8, plus 2) ;
- `13` fichiers dans `dist/sprites` ;
- les 2 e2e des images verts **sous `/Galahad-s-car-game/`** (Review Focus 1), avant tout déploiement. Arrêter l'aperçu ensuite.

- [ ] **Step 23 : Commiter**

```bash
git add e2e/sprites.spec.ts
git commit -m "feat: images chargées au démarrage, __game.art, e2e course-sprites" -- src/game.ts src/main.ts tests/renderer-art.test.ts e2e/sprites.spec.ts
```

---

## Partie 5 — Relectures, passation, déploiement, validation (Steps 24 à 30)

- [ ] **Step 24 : Quatre relectures** du diff `<BASE>..HEAD`, avec `<BASE>` en SHA littéral recopié du registre, par des sous-agents frais. Chacun reçoit ce plan, l'addendum §1, le README, `docs/sprites-gabarit.svg` et la consigne de ne lancer aucun test dans l'arbre partagé tant que l'implémenteur y travaille.
  - **Standard** (spec et qualité).
  - **Adversariale.** Mutants à faire tuer par les tests, chacun réécrit puis restauré :
    - `rotate(+angle)` pour la carrosserie image ;
    - roue image tournée de `+w.angle` ;
    - `flameFrame` sans modulo positif ;
    - casque dessiné avec la carrosserie image ;
    - ombres après les voitures ;
    - ombre au-dessus de la lave ;
    - adresse sans `base` ;
    - `bodyFile` sans retrait des accents ;
    - 3 flammes sur 4 utilisées ;
    - `setArt` jamais appelé ;
    - `loadArt` qui rejette quand `makeImage` lève ;
    - `loadArt` attendu avant `start` ;
    - `carView` sans `id`, ou avec un `id` faux (`state.name`, par exemple).

    Sonde : capture à 2 graines de plus (`?seed=2`, `?seed=5`) avec un copain en turbo, si l'occasion se présente.
  - **Skill `code-review`.**
  - **Skill `security-review`.** Il a besoin de `origin/HEAD`, déjà posé dans ce conteneur ; dans un conteneur neuf, lancer d'abord `git remote set-head origin ccr-5b6fabc4-n96ofo`. Points à regarder : images de même origine, aucune entrée de l'utilisateur dans une adresse (la base vient du build), `page.route` limité aux e2e, pas d'`innerHTML`.

- [ ] **Step 25 : Tours de correction** (≤ 5). Chaque constat retenu est corrigé avec son test. Puis `npm run typecheck && npm test`, et `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e` si le dessin ou le branchement a changé. Commit `fix: <constat> (tour n de la tâche 8b)`. Re-relecture ciblée des constats.

- [ ] **Step 26 : Passation et registre.**
  - **Passation** (`docs/superpowers/handoff/2026-10-21-plan-b-passation.md`) :
    - puce « Tâche 8b faite » dans « Où en est-on » : commits, 13 images, taille de `public/sprites/` (valeur imprimée par le test du Step 9), liseré, teintes gardées, tests et e2e comptés ;
    - ligne 8b du tableau ;
    - « Prochaine action précise » → tâche 10, titre avec les copains, police, régime « écrans » ;
    - environnement : le contournement Playwright (section « Environnement ») remplace « Chromium pré-installé ».
  - **Registre** (`docs/superpowers/handoff/sdd-ledger-plan-b.md`) : **3 à 5 lignes** « Task 8b: … » en plus de la ligne `BASE` du départ (addendum §5 : une ligne suffit au régime « écrans »).
    1. Commits.
    2. Mesures : liseré, budget, teintes.
    3. Choix appliqués qui s'écartent de ce plan, s'il y en a, avec leur coût si faux.
    4. Verdicts des relectures et tours.
    5. À dire au papa.

```bash
git commit -m "docs: tâche 8b (images), passation et registre" -- docs/superpowers/handoff/2026-10-21-plan-b-passation.md docs/superpowers/handoff/sdd-ledger-plan-b.md
```

- [ ] **Step 27 : Fusion normale, push, CI, site en ligne.** Aucun sous-agent ne doit travailler dans l'arbre à ce moment. La tâche 8 est déjà fusionnée et déployée (état de départ) : cette fusion ne porte que la 8b. En cas d'échec en ligne ou de refus du papa, appliquer le **retour arrière** des Global Constraints.

```bash
git status -sb
git fetch origin ccr-5b6fabc4-n96ofo
git checkout -B ccr-5b6fabc4-n96ofo origin/ccr-5b6fabc4-n96ofo
git merge wip-plan-b -m "Merge de wip-plan-b : tâche 8b (images)"   # conflit possible : la passation, garder les deux côtés
git push origin ccr-5b6fabc4-n96ofo                                  # session en mode « accepter les modifications »
gh run list --branch ccr-5b6fabc4-n96ofo --limit 1                   # attendre « completed success »
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live   # tout vert, sprites.spec compris (Review Focus 1)
curl -sI https://i-dmk.github.io/Galahad-s-car-game/sprites/timothe.png | head -1   # HTTP/2 200
git checkout wip-plan-b && git merge --ff-only ccr-5b6fabc4-n96ofo && git push origin wip-plan-b
```

Expected : run vert, e2e:live tout vert, captures du site dans `test-results/live-screenshots/`. Le `index-*.js` servi doit être celui du build local (`VITE_BASE=/Galahad-s-car-game/ npm run build`).

- [ ] **Step 28 : Validation du papa.**
  - **À lui montrer** : `course-sprites.png` (locale et en ligne), l'aperçu du liseré avant / après (Step 7) et le tableau des teintes (Step 10).
  - **Sur la tablette**, après le déploiement, avec `?debug=1` pour le fps, questions Q1 à Q5 (section « Questions pour le papa »).
  - Chaque réponse va au registre (« DÉCISION PAPA (date) : … »). Un réglage demandé (taille des flammes, ombre, étoile) donne un commit `fix:`, puis un nouveau déploiement (Step 27), puis un nouveau regard du papa.

- [ ] **Step 29 : Clôture.**
  - Passation : 8b **validée** ; registre « Task 8b: complete … VALIDÉE par le papa le … ; déploiement vérifié (run n) ».
  - Commit `docs: tâche 8b validée par le papa, passation et registre`, puis fusion et push comme au Step 27 (CI verte, `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live`).

- [ ] **Step 30 : Prévenir les sessions actives.** Si une autre session travaille sur `wip-plan-b` (`git ls-remote`, sessions actives), lui envoyer un message (`send_message`, priorité « later ») : nouvelle tête et fichiers touchés.

---

## Performance sur la tablette

- **Appels par trame.** Ciel 2 `drawImage`, étoiles visibles ≤ 2, puis par voiture visible 1 carrosserie, 2 roues et ≤ 1 flamme : **≤ 24 `drawImage`**, plus 5 ellipses d'ombre. Le dessin par code d'une voiture coûtait ≈ 20 opérations de tracé (`arc`, `arcTo`, `fill`, `stroke`) ; les images en font moins.
- **Réduction des images.** À 1 920 × 1 200 px de tampon (tablette, DPR 2 plafonné par `BACKING_MAX_WIDTH`), ppm ≈ 85,7. Une carrosserie de 512 px se dessine sur ≈ 240 px (× 0,47), une roue de 256 px sur ≈ 77 px (× 0,30), une flamme sur ≈ 103 px.
- **Lissage.** Celui par défaut du canvas reste (`imageSmoothingEnabled` vrai), sans réglage de qualité ni pré-réduction. Si le papa voit scintiller les roues sur la tablette : copies pré-réduites à la taille d'affichage, refaites à chaque `resize`. C'est une tâche à part, mesurée au fps (`?debug=1`), avec la 9 ou la 16.
- **Aucune allocation par trame ajoutée.**
  - `Map.get` pour la carrosserie, index de flamme calculé.
  - `globalAlpha` au lieu de chaînes `rgba(…)`, constantes de module.
  - `overLava` en boucle simple.
  - Les objets créés par `toScreen` existaient déjà.
- **Mémoire.** 13 images décodées, ≈ 7 × 512 × 256 × 4 + 6 × 256² × 4 ≈ 5,2 Mo : négligeable. Décodage au premier dessin : quelques millisecondes une fois, au premier turbo pour les flammes. `img.decode()` n'est pas utilisé.

## Ce que la 8b ne fait pas

- La police Fredoka, `@font-face` et `public/fonts/` : tâche 10. `assets/fonts/` reste en place.
- Les copains sur l'écran titre : tâche 10, qui réutilisera `drawCar` et `Art`.
- Le cache du service worker : tâche 13.
- La Terre (`earth.png`) : tâche 16. Elle reste dans `assets/sprites/`, liseré non corrigé, et `lisere.py` est prêt pour elle.
- Aucun changement de `index.html` (aucun préchargement : `loadArt` part dès le module principal), de `vite.config.ts`, de `src/config.ts` ou de `deploy.yml`.

## Ambiguïtés et choix

| # | Choix | Pourquoi | Coût si faux |
|---|---|---|---|
| A1 | `earth.png` reste dans `assets/` sans correction ; 13 fichiers déplacés | addendum §3 : la Terre est à la 16 ; YAGNI ; le test « dossier = `ART_FILES` » reste exact | une commande à la 16 |
| A2 | Noms de fichiers ASCII : `timothe.png` pour l'id `timothé` (`bodyFile` retire les accents) | adresses sans encodage `%C3%A9`, pas de piège NFC/NFD (git, macOS), noms cp437 vus à l'envoi des archives | nul |
| A3 | Liseré : « rose » = `r − g > 40` et `b − g > 40` ; couleur du plus proche pixel non rose d'alpha ≥ 240 ; alpha inchangé sauf ≥ 240 → 255 ; garde-fou à 25 % de rose opaque | le README dit « couleur du bord prise sur le pixel opaque voisin » ; critère mesuré, tableau du Step 7. Les parts du README (flammes 78–86 %, étoile 16 %) venaient d'un autre critère | un rose légitime recoloré : aucun dans les flammes ni l'étoile ; le garde-fou bloque une carrosserie rose |
| A4 | Repli par pièce : carrosserie, roue, étoile indépendantes ; flammes par 4 ou rien | une animation à trous clignoterait | une voiture mi-image mi-code si une seule image manque : rare, visible, sans erreur |
| A5 | Flammes : accroche du gabarit (−1,31 ; 8 cm au-dessus du centre) avec la carrosserie image, celle du code (−1,10 ; 8 cm dessous) sinon ; carré de 1,2 m dont 0,34 m sous la carrosserie, dessiné avant elle ; image `⌊14 t⌋ mod 4` sur `Scene.t` | contrat du gabarit ; tailles tirées des bbox mesurées ; même temps que les flammes par code | un réglage de deux constantes après la capture (Q3) |
| A6 | Étoile : halo gardé, image tournée comme aujourd'hui (`t × 0,8`), carré de 1,0 m (image 256 × 250 étirée de 2,4 %) | « même taille qu'aujourd'hui » ; le halo signale l'étoile à prendre | une ligne (Q4) |
| A7 | Ombre : noire par `globalAlpha` ; rayons 1,2 × 0,15 m × s, alpha 0,45 × s, s = 1/(1 + h/1,5) ; h tiré de la roue la plus basse ; ellipse tournée de la pente ; aucune au-dessus de la lave ; toutes les ombres avant effets et voitures | §1.5 ; le fond du cratère ou de la fosse est sous la lave dessinée ; une ombre ne doit pas couvrir la voiture d'à côté | quatre constantes (Q5) |
| A8 | `loadArt` se résout quand toutes les images sont réglées (pas image par image), sans délai d'abandon | signature de l'addendum ; un navigateur finit toujours par `load` ou `error` | une image bloquée retarde les autres jusqu'au délai réseau du navigateur ; la course roule en dessin par code |
| A9 | `Game` reçoit `Promise<Art>` en 4e paramètre facultatif ; `Renderer.setArt` ; `loadArt()` appelé dans `main.ts` avant `new Game` | « en parallèle de la création de la piste » (faite dans le constructeur) ; les tests existants ne changent pas | nul |
| A10 | `CarView` gagne `id` (une ligne dans `carView`, `src/sim/simulate.ts`) | seul moyen de choisir la carrosserie ; vue de rendu, hors `stepRace` ; empreinte vérifiée (Step 21) | nul |
| A11 | Constantes de dessin dans `render/car.ts`, pas dans `CONFIG` | précédent : `FOSSE_HALO_M`, `SKY_PARALLAX` ; `CONFIG` porte les paramètres de jeu | nul |
| A12 | Teinte : « visiblement » = part < 25 %, ΔE76 > 20 ou Δteinte > 15° ; mesuré : aucun ; `teinte.py` reste dans le scratchpad sauf alignement | ΔE76 ≈ 11–13 entre deux bleus (ou verts, ou roses) de même teinte ne change pas « la voiture bleue » ; le README dit déjà « couleurs conformes à la palette 5a » | Q1 tranche |
| A13 | e2e dans un nouveau fichier `e2e/sprites.spec.ts` | `e2e/race.spec.ts` est à la tâche 8 | nul |
| A14 | `lisere.py` importe `quantize` de `controle.py` (`sys.path`, à cause de `-I`), lancé en `-B` | une seule quantification (alpha ≥ 240 → 255 dans la palette) ; pas de `__pycache__` dans l'arbre | nul |
| A15 | Bruts `assets/generated/` (4,3 Mo) gardés, non servis | sources pour une nouvelle passe de `controle.py` | taille du dépôt |
| A16 | Gardé tel quel (relecture M6) : le test « base par défaut » ne voit pas une base `'/'` écrite en dur | le test « tout charge » passe une base non racine ; une base codée en dur est prise au Step 22 (build et aperçu sous `/Galahad-s-car-game/`) et au Step 27 (`e2e:live`), avant que le papa ne voie quoi que ce soit | nul en ligne ; le défaut serait vu un step plus tard qu'en unitaire |
| A17 | Gardé tel quel (relecture M8) : `overLava` ne teste que le centre du châssis ; à moins de 1,2 m du bord, l'ellipse peut déborder sur la lave | risque seulement visuel ; à juger sur la capture et sur la tablette (Q5) plutôt que de compliquer le test | un bout d'ombre sur la lave au bord ; si le papa le voit, tester les deux extrémités de l'ellipse (une ligne) |
| A18 | Gardé tel quel (relecture M9) : lissage par défaut pour la roue réduite × 0,30 | aucune mesure ne montre de scintillement ; l'option à une ligne (`imageSmoothingQuality = 'medium'` dans `Renderer.draw`, ou `wheel.png` à 128 px) se mesure au fps sur la tablette si le papa le signale | roues qui scintillent : réglage ensuite, mesuré |
| A19 | Gardé tel quel (relecture M10) : chargement tout ou rien, sans délai d'abandon (A8) | site statique sur GitHub Pages, où une requête qui stagne est rare ; l'e2e couvre l'échec franc (`abort`) | une image qui stagne retient les 12 autres ; remède prêt : délai de 8 à 10 s qui règle les restantes à `null` |

## Questions pour le papa

Q1 se pose avec le tableau du Step 10. Q2 à Q5 se posent sur la tablette, après le déploiement, avec la capture.

- **Q1 — couleurs des pastilles et du dessin de repli.** Les sprites sont un peu plus saturés que les constantes, de même teinte (Δteinte ≤ 4°, ΔE76 0 à 12,7 : Galahad 10,7, Diego 12,7, Liam 10,8).
  - (a) Garder les constantes. **Recommandé**, rien à revalider.
  - (b) Aligner Galahad, Diego et Liam sur les sprites (`#004af9`, `#16d92f`, `#fb5b9b`), puis re-valider les coloris de la 5a.
- **Q2 — voitures et arches serrées**, jugement final (README).
  - (a) On reconnaît chaque voiture et les roues vont bien. **Recommandé** si c'est ce qu'il voit.
  - (b) Une voiture à refaire : nouvelle génération, session dédiée.
  - (c) Les arches gênent : nouvelle génération à 50 cm.
- **Q3 — flammes du turbo**, à voir après une étoile.
  - (a) Bien.
  - (b) Plus grandes (carré de 1,5 m).
  - (c) Plus petites (1,0 m).
  - (d) Revenir aux flammes par code.
- **Q4 — étoile.**
  - (a) Image crème qui tourne, avec halo. Défaut.
  - (b) Image fixe avec halo.
  - (c) Étoile jaune par code.
- **Q5 — ombre au sol.**
  - (a) Bien.
  - (b) Plus sombre (alpha 0,6).
  - (c) Plus claire (0,3).
  - (d) Rétrécit trop vite ou pas assez : préciser.
- **Q6 — hors 8b, sans urgence.** Le prénom affiché est « Timothé » (code de la 5a). L'addendum, le README, la planche et le fichier source écrivent « Timothée ».
  - (a) « Timothé ».
  - (b) « Timothée » : seul le `name` change, l'id reste.

## Écarts relevés entre l'addendum et le code

1. **Pas d'id de pilote dans `CarView`.** L'addendum §1.1 suppose que les poses suffisent, mais `CarView` ne porte pas l'id du pilote : il faut l'ajouter pour choisir la carrosserie (A10).
2. **Hauteur des flammes.** Les flammes par code sont 8 cm **sous** le centre (`drawFlames(ctx, −L/2, 0.08, t)`, y vers le bas). Le gabarit, contrat des sprites, les accroche 8 cm **au-dessus**, à x = −1,31 m. Le gabarit fait foi pour les images ; le repli reste inchangé (A5).
3. **Ombre au-dessus de la lave.** L'addendum §1.5 met l'ombre « à la hauteur du sol (`heightAt`) ». Au-dessus d'un tremplin ou d'une fosse, `heightAt` est le fond, sous la lave dessinée par `drawTrack` : pas d'ombre là (A7).
4. **Place de la Terre.** L'addendum §1.2 range `earth.png` dans `public/sprites/`, le §3 la met à la tâche 16 (A1).
5. **Tableau de correspondance caduc.** Celui des sprites Grok (§1.4) ne sert plus depuis l'option A : les sprites générés portent déjà le nom de leur pilote.
6. **Orthographe.** « Timothée » dans l'addendum, le README et la planche ; « Timothé » et `timothé` dans le code (Q6).
7. **Image interdite par le plan B.** La règle « pas d'images en fichiers » (Global Constraints du plan B) est amendée par l'addendum §1.1 pour ces seuls sprites. Le régime « écrans » prévoit une relecture (§5), portée à quatre par décision du papa pour cette session.
