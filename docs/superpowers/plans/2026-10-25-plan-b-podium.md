# Tâche 11 — Podium (et, en option, bouton pause en course) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Régime « écrans » de l'addendum « présentation » §5, **durci par la décision du papa du 2026-10-23** : un implémenteur frais pour toute la tâche (Parties 1 à 4, plus la Partie 5 si le papa la retient), puis **quatre relectures** du diff de la tâche (standard, adversariale, skill `code-review`, skill `security-review`), tours de correction (≤ 5), **validation du papa sur capture** avant la fusion. Pas de suite lente. Jamais de PR.

**Statut :** v1.1 (2026-10-25), relu contre le code ; Q1 à Q3 tranchées par le papa le 2026-10-25 : **(a) partout** — bouton pause dans la 11 (Partie 5 faite), en haut à droite sous le chrono, visible pendant le décompte et la course.
- v1 (`b6fbbc9`) : brouillon.
- v1.1 : corrections de la relecture contre le code. SVG de MENU sans blanc entre les balises (`textContent` exact) ; tolérance `CONFETTI_EPS` sur le reste de la pluie (sinon un 161e confetti) ; ENCORE au `pointerdown` ET au `click` (un doigt de gaz peut rester posé à l'arrivée), MENU au `click` seul (A20), e2e à deux doigts ; caméra figée vérifiée au podium ; `.podium-me` caché dès la création (testé) ; médaille plafonnée à 9vh et marche du 3e à 13vh ; `tests/game-frame.test.ts` commenté (commit du Step 13) ; repli en portrait étroit (A11) ; assertion `throttlePressed` lue pendant l'appui.

**Goal:** Remplacer le calque ARRIVÉE par un vrai podium : 1,5 s après l'arrivée de Galahad (roue libre, les copains roulent encore), la course se fige et l'écran montre le temps de Galahad en gros, les trois premiers sur des marches (prénom, voiture, médaille), Galahad toujours visible (sur sa marche ou à côté avec sa place), ENCORE (gros) et MENU, et une pluie de confettis s'il gagne ; sans changer un bit de la simulation. En option (Partie 5, selon la réponse du papa à Q1) : un bouton pause en course.

**Architecture:** La machine d'états ne change pas (`podium` est déjà dans la table de `src/loop/states.ts` : `finished` → `podium` par l'événement `'podium'`, `podium` → `again` / `menu`). `Game` envoie `'podium'` quand le temps de course atteint `finishTime + FINISH_COAST_SECONDS` (l'instant où le calque ARRIVÉE s'affiche aujourd'hui), calcule une fois le classement final (`podiumView`, pur, dans `src/cars/ranking.ts`, sur `rankCars`), puis ne fait **plus aucun pas** : la scène de course est dessinée figée, seuls les confettis tombent (`Effects`, coordonnées du monde). L'écran est un quatrième calque DOM de `src/ui/screens.ts` (créé une fois, caché par `hidden`, jamais retiré, comme les trois de la tâche 10) ; chaque voiture du podium est une petite toile peinte une fois par `Renderer.paintCarIcon` avec le même `drawCar` que la course (sprite et roues s'ils sont chargés, sinon dessin par code), pour que Galahad reconnaisse les voitures. `Hud.showFinished` disparaît.

**Tech Stack:** TypeScript 5.7 strict, Vite 8, Vitest 5 (+ jsdom), Playwright 1.56. **Aucune nouvelle dépendance.**

**Spec :** `docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md` §4 « Machine d'états », §6 « Arrivée », §7 (classement), §8 « Rendu » (confettis) et « Écrans » (podium) ; `docs/superpowers/specs/2026-10-22-addendum-presentation.md` §2 (police, boutons, mots courts), §5 (régime), §6 (jalon « démo tablette » juste après la 11) ; plan v2.1 `docs/superpowers/plans/2026-10-21-plan-b-copains-et-finitions.md`, Task 11 (règles) et Task 12 (où s'arrêter : le son et le bouton son sont à la 12) ; plan de la tâche 10 `docs/superpowers/plans/2026-10-24-plan-b-ecrans.md` (décision Q2 : ENCORE = même course, MENU = titre, déjà câblés). Références ci-dessous : « spec §n », « addendum §n », « plan v2.1 », « plan 10 ».

**État de départ :** la tâche 10 est close (validée sur capture puis sur la tablette, déployée, run 46, version 1.1.0). **BASE = `5bc711d`** (tête de `wip-plan-b` ; `origin/ccr-5b6fabc4-n96ofo` = `6fa6f6f` en est l'ancêtre : la fusion finale se fait **en avance rapide**). Avant le Step 1, le contrôleur : écrit BASE dans le registre (première ligne « Task 11: »), pose Q1 à Q3 au papa (section « Questions pour le papa ») et note ses réponses au registre (« DÉCISION PAPA (date) : … »). BASE est **recopié en clair** dans chaque commande qui en a besoin (Steps 14 et 24, notés `<BASE>` : une variable de shell ne survit pas d'un appel d'outil à l'autre). Dernière demande du papa (registre, 2026-10-25) : « un bouton pause en course » → Partie 5 optionnelle.

## Global Constraints

- « La physique ne change pas d'un bit » : aucun pas de `stepRace` hors de `racing` et `finished` (le `case 'podium'` de `Game.frame`, qui menait aujourd'hui à `raceFrame`, mène à un rendu figé) ; `tests/empreinte.test.ts` reste identique ; rien ne change sous `src/sim/`, `src/physics/`, `src/track/`, `src/ai/` ; sous `src/cars/`, seul `ranking.ts` gagne `podiumView` (pur) ; `src/config.ts` ne change pas ; sous `src/loop/`, seul le commentaire de la table dans `states.ts` change. Le Step 14 le vérifie par `git diff --stat`.
- Arrivée (spec §4, §6) : `finished` dure `FINISH_COAST_SECONDS` (1,5 s) de **temps de course** (la course continue : les copains roulent, Galahad freine), puis `podium`. Le classement final est `rankCars` (arrivés par temps, puis non arrivés par progression, égalité par index), **calculé une fois** à l'entrée au podium.
- Podium (spec §8, plan v2.1 Task 11) : les 3 premiers sur des marches avec prénom, voiture et médaille ; Galahad toujours affiché (sa marche surlignée, ou une case à côté avec sa place « 4e », « 5e ») ; son temps en gros chiffres (mm:ss, comme le chrono) ; gros bouton ENCORE (même piste, mêmes copains : `again()` de la 10) ; bouton MENU (titre : `menu()` de la 10) ; confettis **seulement si Galahad est 1er**. Le bouton son et la trompette : tâche 12, rien ici.
- Boutons ≥ 96 px CSS de côté, mots courts avec icône (addendum §2, spec §8) ; ENCORE et MENU portent `data-no-pedal`, le voile entier du podium aussi (un doigt laissé sur le podium n'est pas du gaz à PARTEZ après ENCORE ; même règle que le voile de pause, plan 10 A18) ; ENCORE agit au `pointerdown` et au `click` (un doigt de gaz peut rester posé quand le podium arrive, A7), MENU au `pointerup` du doigt posé sur lui et au `click`, jamais au `pointerdown`, click du tap avalé (A20, révisé au tour 1) ; tout calque ou bouton caché par l'attribut `hidden` alors qu'une règle lui donne `display` a sa règle `…[hidden]{display:none}` (leçon de la session 6), testée sur la feuille en jsdom et sur la boîte en e2e.
- Prénoms et textes en `textContent` ; `innerHTML` réservé aux SVG **constants** (médailles, icônes).
- Version `1.2.0` dans `package.json` (décision Q3 de la 10 : +1 par tâche déployée) ; `package-lock.json` n'est pas touché (voir « Écarts »).
- Plan B : une seule dépendance d'exécution ; `track/`, `cars/`, `ai/` et `loop/` sans DOM ni matter-js (`tests/deps.test.ts`), `render/` sans matter-js ; aucun cycle d'import (`ui/screens.ts` importe `ui/hud.ts` et `cars/ranking.ts`, jamais l'inverse) ; pas de `@types/node`.
- `npm run typecheck` et `npm test` verts à chaque commit. Jamais de `.skip`. Budget CI : `npm test` < 6 min sur le runner.
- Commits en français préfixés `feat:` / `fix:` / `test:` / `chore:` / `docs:`, trailers de la session, aucun identifiant de modèle. Code, commentaires et docs en français.
- Jamais de `git reset` / `checkout` / `stash` / `clean` pendant qu'un autre agent travaille dans l'arbre. Commits ciblés (`git commit -- <chemins>`). Pas de `.superpowers/` ni de `tests/zz-probe-*` dans un commit.
- **Retour arrière** si la tâche déployée déplaît : `git revert` des commits de la 11 sur `ccr-5b6fabc4-n96ofo` (fusion en avance rapide : pas de commit de fusion à annuler), push, CI verte, `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live`.

## Environnement (conteneur)

Playwright 1.56.1 attend Chromium **1194**, le conteneur a la **1243** : dossier de liens dans le scratchpad de la session et `PLAYWRIGHT_BROWSERS_PATH` **devant chaque commande Playwright** (commande de création : plan de la 8b, `docs/superpowers/plans/2026-10-24-plan-b-images.md`, section « Environnement »). Le chemin change à chaque session : noté `<scratchpad>/pw-browsers` ci-dessous, à recopier en clair.

```bash
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npx playwright test e2e/podium.spec.ts
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live
```

Le skill `security-review` a besoin de `origin/HEAD` : `git remote set-head origin ccr-5b6fabc4-n96ofo` (à refaire dans un clone frais). Chromium headless accorde le plein écran au `pointerup` de JOUER : un e2e qui change la taille de la fenêtre en sort d'abord (`document.exitFullscreen()`, passation « Environnement »).

## Review Focus

1. **Roue libre puis podium.** Galahad passe la ligne : `finished`, la course avance encore 1,5 s de temps de course (les copains roulent), aucun podium avant ; puis `podium` et plus **aucun pas** (le chrono de course et les voitures ne bougent plus, seuls les confettis tombent). Couvert par le test jsdom « podium : FINISH_COAST_SECONDS de roue libre » (Step 9) et l'e2e « course courte jusqu'au podium » (Step 16).
2. **Galahad hors du podium.** Trois copains arrivés avant lui : les marches sont à eux, Galahad est dans sa case à côté avec « 4e », sa voiture et son prénom ; pas de confettis. Couvert par le test jsdom « Galahad 4e » (Step 9) et l'e2e « Galahad 4e », téléphone compris (Step 16).
3. **ENCORE depuis le podium, puis un second podium.** Même graine, mêmes copains, chrono à 0, podium caché, confettis effacés **et pluie arrêtée** (un second podium où Galahad n'est pas 1er ne doit pas hériter de confettis), entrée d'historique remplacée, pas poussée ; ENCORE répond même quand un doigt de gaz est resté posé depuis la course (le `click` peut alors ne pas partir : ENCORE agit au `pointerdown`). Couvert par les tests jsdom « ENCORE et MENU » et « confettis : clear() arrête la pluie » (Steps 1, 5 et 9) et l'e2e à deux doigts « doigt de gaz encore posé + ENCORE » (Step 16).
4. **Geste retour et onglet caché au podium.** Retour → titre (entrée déjà consommée par le navigateur, pas de `history.back()`) ; onglet caché → rien (la table n'a pas de pause au podium), aucun pas. Couvert par les tests jsdom adaptés (Step 9).
5. **Téléphone en paysage (844 × 390).** Temps, marches, case de Galahad et boutons dans la fenêtre, sans recouvrement, boutons ≥ 96 px. Couvert par l'e2e « Galahad 4e » (passage à 844 × 390, Step 16).
6. **(Partie 5, si retenue)** Doigt de gaz posé et tap sur ⏸ : pause, et ni le tap ni la reprise ne sont du gaz ; bouton sans recouvrir chrono, barre, drapeau, position, saut. Couvert par les tests de la Partie 5 (Steps 19 et 22).

## Structure des fichiers

| Fichier | Rôle | Partie |
|---|---|---|
| `src/cars/ranking.ts` | `PodiumPlace`, `PodiumView`, `podiumView(entries, pilots, galahadIndex, galahadTime)` (pur, sur `rankCars`) | 1 |
| `src/render/effects.ts` | confettis : `CONFETTI_SECONDS`, `CONFETTI_PER_SECOND`, `startConfetti`, `rainConfetti`, `confettiCount`, dessin ; `clear` arrête la pluie | 1 |
| `src/render/title.ts` | `CHASSIS_ABOVE_AXLE_M`, `WHEEL_X_M` exportés (pose au repos réutilisée) | 1 |
| `src/render/car.ts` | `drawCar` n'écrit pas un prénom vide | 1 |
| `src/render/renderer.ts` | `paintCarIcon(target, pilot)` : petite voiture du podium | 1 |
| `tests/podium.test.ts` (créé, jsdom) | `podiumView`, confettis, `paintCarIcon`, écran `showPodium` | 1, 2 |
| `src/ui/screens.ts` | calque `.screen-podium`, `showPodium(view, paintCar)`, actions `onAgain`, `onMenu`, médailles et icônes SVG | 2 |
| `tests/screens.test.ts` | `make()` avec `onAgain`/`onMenu` ; quatre calques | 2 |
| `src/game.ts` | `enterPodium`, `podiumFrame` (aucun pas), getters `podium` et `confetti` (debug) ; `finishShown` retiré | 3 |
| `src/ui/hud.ts` | `showFinished`, son bouton et son CSS retirés (calque ARRIVÉE remplacé) | 3 |
| `src/loop/states.ts` | commentaire de la table seulement | 3 |
| `package.json` | `"version": "1.2.0"` | 3 |
| `tests/game-screens.test.ts` | espion `paintCarIcon` ; `driveToFinished` / `driveToPodium` ; tests du podium ; deux tests adaptés | 3 |
| `tests/game-frame.test.ts` | commentaire seulement (s'arrête avant le podium) | 3 |
| `e2e/helpers.ts` | `driveToFinish` et `collectErrors` sortis de `race.spec.ts` ; `driveToFinish` rend sur `finished` **ou** `podium` | 4 |
| `e2e/race.spec.ts` | « course courte » déplacé dans `podium.spec.ts` ; « captures » finit au podium (plus d'`arrivee.png`) | 4 |
| `e2e/podium.spec.ts` (créé) | course courte jusqu'au podium, Galahad 4e, téléphone, ENCORE à deux doigts, captures | 4 |
| `src/ui/pause-button.ts` (créé), `src/game.ts`, `tests/game-screens.test.ts`, `e2e/screens.spec.ts`, `e2e/helpers.ts`, `e2e/race.spec.ts` | **Partie 5 (optionnelle)** : bouton ⏸ en course | 5 |
| passation, registre | lignes de la tâche 11 | 6 |

---

## Partie 1 — Classement final, confettis, petite voiture (Steps 1 à 4)

**Files:**
- Create: `tests/podium.test.ts`
- Modify: `src/cars/ranking.ts`, `src/render/effects.ts`, `src/render/title.ts` (l. 25–26 : `export`), `src/render/car.ts` (l. 80 : garde du prénom), `src/render/renderer.ts`

**Interfaces (produit) :**

```ts
// src/cars/ranking.ts — pur
export interface PodiumPlace {
  place: number;      // 1 = première
  index: number;      // index de la voiture (rang de grille ; Galahad = 0)
  id: string;
  name: string;
  color: string;      // couleur CSS (#rrggbb) de la carrosserie
  isGalahad: boolean;
}
export interface PodiumView {
  places: PodiumPlace[];   // tout le classement final, place 1 d'abord
  galahadPlace: number;    // 1 à N
  galahadTime: number;     // temps de course de Galahad à l'arrivée (s)
}
/** Classement final (spec §6) : `rankCars(entries)`, pilotes pris dans `pilots` par index ; lève RangeError sur un index sans pilote. */
export function podiumView(entries: readonly RankEntry[], pilots: readonly Pilot[], galahadIndex: number, galahadTime: number): PodiumView;

// src/render/effects.ts
export const CONFETTI_SECONDS = 4;        // s de pluie
export const CONFETTI_PER_SECOND = 40;
export class Effects {
  get confettiCount(): number;
  startConfetti(): void;                                                     // lance la pluie (CONFETTI_SECONDS)
  rainConfetti(dt: number, cx: number, topY: number, halfWidthM: number): void;   // émet pendant la pluie
  clear(): void;                                                             // + arrête la pluie
}

// src/render/renderer.ts
export class Renderer {
  /** Petite voiture du podium : `pilot` de profil dans `target`, par `drawCar` (sprite et roues si chargés), sans prénom ; tampon 2:1. */
  paintCarIcon(target: HTMLCanvasElement, pilot: Pilot): void;
}
```

- [ ] **Step 1 : Tests** dans `tests/podium.test.ts` (jsdom ; la Partie 2 y ajoutera les tests de l'écran).

```ts
// @vitest-environment jsdom
// Podium (plan B, tâche 11 ; spec §6 « Arrivée », §8 « Écrans » et « Rendu ») : classement final pur (`podiumView`),
// confettis (`Effects`), petite voiture peinte par `Renderer.paintCarIcon`, écran DOM (`Screens.showPodium`, Partie 2).
import { afterEach, expect, test, vi } from 'vitest';
import { GALAHAD, PILOTS, colorHex } from '../src/cars/pilots';
import { podiumView, rankCars, type RankEntry } from '../src/cars/ranking';
import { CONFIG } from '../src/config';
import { CONFETTI_PER_SECOND, CONFETTI_SECONDS, Effects, MAX_PARTICLES } from '../src/render/effects';
import { Renderer } from '../src/render/renderer';
import { fakeCtx } from './helpers/fake-ctx';

/** Galahad, puis pablo, diego, timothé, matthis (index 0 à 4). */
const pilots = [GALAHAD, PILOTS[0], PILOTS[1], PILOTS[2], PILOTS[3]];
const entry = (index: number, progress: number, finishedAt: number | null = null): RankEntry => ({ index, progress, finishedAt });
const DT = 1 / 60;
const NO_VOLCANO = { volcanoes: [] };

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; document.head.innerHTML = ''; });

test('podiumView : arrivés par temps, puis non arrivés par progression (rankCars), égalité par index ; prénoms, couleurs, Galahad repéré', () => {
  const entries = [entry(0, 300, 80), entry(1, 290), entry(2, 310, 78.5), entry(3, 295), entry(4, 295)];
  const v = podiumView(entries, pilots, 0, 80);
  expect(v.places.map((p) => p.index)).toEqual(rankCars(entries));
  expect(v.places.map((p) => p.index)).toEqual([2, 0, 3, 4, 1]);
  expect(v.places.map((p) => p.place)).toEqual([1, 2, 3, 4, 5]);
  expect(v.places[0]).toEqual({ place: 1, index: 2, id: 'diego', name: 'Diego', color: colorHex(PILOTS[1].color), isGalahad: false });
  expect(v.places.filter((p) => p.isGalahad).map((p) => p.id)).toEqual(['galahad']);
  expect(v.galahadPlace).toBe(2);
  expect(v.galahadTime).toBe(80);
});

test('podiumView : Galahad 4e (trois copains arrivés avant lui), 5e (dernier sans arrivée) ; moins de trois voitures', () => {
  const four = podiumView([entry(0, 300, 90), entry(1, 300, 70), entry(2, 300, 71), entry(3, 300, 72), entry(4, 100)], pilots, 0, 90);
  expect(four.galahadPlace).toBe(4);
  expect(four.places.slice(0, 3).map((p) => p.id)).toEqual(['pablo', 'diego', 'timothé']);
  expect(podiumView([entry(0, 10), entry(1, 50), entry(2, 40), entry(3, 30), entry(4, 20)], pilots, 0, 0).galahadPlace).toBe(5);
  const alone = podiumView([entry(0, 300, 60)], [GALAHAD], 0, 60);
  expect(alone.places).toHaveLength(1);
  expect(alone.galahadPlace).toBe(1);
  expect(() => podiumView([entry(0, 1), entry(7, 2)], pilots, 0, 0)).toThrow(RangeError);
});

test('confettis : rien sans startConfetti ; pluie de CONFETTI_SECONDS, puis plus aucun nouveau ; tout est tombé ensuite', () => {
  const fx = new Effects(CONFIG);
  const tick = () => { fx.rainConfetti(DT, 100, 20, 11); fx.update(DT, NO_VOLCANO, 100, 11); };
  for (let i = 0; i < 60; i++) tick();
  expect(fx.confettiCount).toBe(0);
  fx.startConfetti();
  let max = 0;
  for (let i = 0; i < Math.round(CONFETTI_SECONDS / DT); i++) { tick(); max = Math.max(max, fx.confettiCount); }
  expect(max).toBeGreaterThanOrEqual(0.9 * CONFETTI_SECONDS * CONFETTI_PER_SECOND);
  expect(max).toBeLessThanOrEqual(Math.min(MAX_PARTICLES, CONFETTI_SECONDS * CONFETTI_PER_SECOND));
  const after = fx.confettiCount;
  // Aucun confetti ne meurt avant 7 s : un seul de plus (reste flottant de la pluie, CONFETTI_EPS) se verrait ici.
  for (let i = 0; i < 30; i++) tick();
  expect(fx.confettiCount).toBe(after);
  for (let i = 0; i < 600; i++) tick();
  expect(fx.confettiCount).toBe(0);
});

test('confettis : nés au-dessus de topY dans [cx − demi-largeur, cx + demi-largeur], rectangles de plusieurs couleurs, pile save/restore vide ; clear() arrête la pluie', () => {
  const fx = new Effects(CONFIG);
  fx.startConfetti();
  fx.rainConfetti(0.5, 100, 20, 11);
  expect(fx.confettiCount).toBe(0.5 * CONFETTI_PER_SECOND);
  const { ctx, calls, state } = fakeCtx();
  fx.draw(ctx, (p) => ({ x: p.x, y: p.y }), 1);
  const rects = calls.filter((c) => c.name === 'fillRect');
  expect(rects).toHaveLength(fx.confettiCount);
  for (const r of rects) {
    const [x, y] = r.args as number[];
    expect(x).toBeGreaterThanOrEqual(100 - 11 - 1);
    expect(x).toBeLessThanOrEqual(100 + 11 + 1);
    expect(y).toBeGreaterThanOrEqual(20 - 1);
    expect(r.fillStyle).toMatch(/^#[0-9a-f]{6}$/);
  }
  expect(new Set(rects.map((r) => r.fillStyle)).size).toBeGreaterThan(1);
  expect(state()).toMatchObject({ depth: 0, underflows: 0 });
  fx.clear();
  expect(fx.confettiCount).toBe(0);
  fx.rainConfetti(0.5, 100, 20, 11);
  expect(fx.confettiCount).toBe(0);
});

test('Renderer.paintCarIcon : carrosserie image puis deux roues image, centrée, sans prénom, tampon 2:1 ; carrosserie par code sans image', () => {
  const { ctx, calls, state } = fakeCtx();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as RenderingContext);
  const renderer = new Renderer(document.createElement('canvas'), CONFIG);
  const img = (n: string) => ({ name: n }) as unknown as CanvasImageSource;
  renderer.setArt({ bodies: new Map([[PILOTS[1].id, img('diego')]]), wheel: img('wheel'), flames: null, star: null, loaded: [], failed: [] });
  const icon = document.createElement('canvas');
  calls.length = 0;
  renderer.paintCarIcon(icon, PILOTS[1]);
  // jsdom : clientWidth 0 → largeur par défaut (160 px CSS), devicePixelRatio 1.
  expect(icon.width).toBe(160);
  expect(icon.height).toBe(80);
  const images = calls.filter((c) => c.name === 'drawImage');
  expect(images.map((c) => (c.args[0] as { name: string }).name)).toEqual(['diego', 'wheel', 'wheel']);
  expect(images[0].matrix[4]).toBeCloseTo(80, 6);   // carrosserie centrée dans la toile
  expect(calls.some((c) => c.name === 'fillText')).toBe(false);
  expect(state()).toMatchObject({ depth: 0, underflows: 0, globalAlpha: 1 });
  calls.length = 0;
  renderer.paintCarIcon(icon, PILOTS[0]);   // pas d'image de pablo : carrosserie par code
  expect(calls.filter((c) => c.name === 'drawImage').map((c) => (c.args[0] as { name: string }).name)).toEqual(['wheel', 'wheel']);
  expect(calls.some((c) => c.name === 'clearRect')).toBe(true);
});
```

- [ ] **Step 2 : Vérifier l'échec** : `npx vitest run tests/podium.test.ts` → FAIL (`podiumView`, `CONFETTI_SECONDS`, `paintCarIcon` absents).

- [ ] **Step 3 : Implémenter.**
  - `src/cars/ranking.ts` : `import { colorHex, type Pilot } from './pilots';` puis, après `rankCars` :

```ts
/** Une place du classement final (podium, tâche 11). */
export interface PodiumPlace {
  /** 1 = première. */
  place: number;
  /** Index de la voiture (rang de grille ; Galahad = 0). */
  index: number;
  id: string;
  name: string;
  /** Couleur CSS (#rrggbb) de la carrosserie. */
  color: string;
  isGalahad: boolean;
}

/** Classement final montré au podium : calculé une fois, à l'entrée au podium (tâche 11). */
export interface PodiumView {
  /** Tout le classement, place 1 d'abord. */
  places: PodiumPlace[];
  /** Place de Galahad (1 à N). */
  galahadPlace: number;
  /** Temps de course de Galahad à l'arrivée (s). */
  galahadTime: number;
}

/**
 * Classement final (spec §6 « Arrivée ») : `rankCars(entries)` (arrivées par temps, puis non arrivées par progression,
 * égalité par index), chaque voiture nommée par `pilots[index]` (ordre de la grille). Lève RangeError sur un index sans pilote.
 */
export function podiumView(entries: readonly RankEntry[], pilots: readonly Pilot[], galahadIndex: number, galahadTime: number): PodiumView {
  const places = rankCars(entries).map((index, k): PodiumPlace => {
    const p = pilots[index];
    if (p === undefined) throw new RangeError(`podiumView : pas de pilote d'index ${index} (${pilots.length} reçus)`);
    return { place: k + 1, index, id: p.id, name: p.name, color: colorHex(p.color), isGalahad: index === galahadIndex };
  });
  return { places, galahadPlace: places.findIndex((p) => p.isGalahad) + 1, galahadTime };
}
```

  - `src/render/effects.ts` : `Kind` gagne `'confetti'` ; `Particle` gagne `color?: string` et `phase?: number` (confettis : couleur et phase du battement) ; constantes et méthodes :

```ts
/** Confettis du podium si Galahad gagne (tâche 11 ; spec §8 « Rendu ») : pluie de CONFETTI_SECONDS au-dessus de l'écran. */
export const CONFETTI_SECONDS = 4;
export const CONFETTI_PER_SECOND = 40;
/** s : de quoi traverser les 14 m de la vue à ≈ 2 m/s. */
const CONFETTI_LIFE = 7;
const CONFETTI_COLORS = ['#ffd23f', '#ff4d6d', '#4dd2ff', '#7cff4d', '#ffffff', '#c77dff'] as const;
/** rad/s : battement du papier (largeur dessinée × |cos|). */
const CONFETTI_FLUTTER = 8;
/**
 * s : reste de pluie tenu pour nul. 240 retraits de 1/60 laissent ≈ 1e-15 s au lieu de 0 : sans cette tolérance, l'image
 * suivante émettrait un 161e confetti (comme COUNTDOWN_EPS dans `game.ts` et HOLD_EPSILON_S dans `ranking.ts`).
 */
const CONFETTI_EPS = 1e-9;

// dans la classe :
private confettiLeft = 0;
private confettiCarry = 0;

get confettiCount(): number {
  let n = 0;
  for (const p of this.particles) if (p.kind === 'confetti') n++;
  return n;
}

/** Lance la pluie de confettis pour CONFETTI_SECONDS (émise par `rainConfetti`). */
startConfetti(): void {
  this.confettiLeft = CONFETTI_SECONDS;
  this.confettiCarry = 0;
}

/**
 * Pendant la pluie : CONFETTI_PER_SECOND × dt confettis (le reste est reporté à l'image suivante), nés entre `topY` et
 * `topY + 1` (au-dessus du haut de l'écran), x dans [cx − halfWidthM, cx + halfWidthM], qui tombent à 1,6–2,6 m/s en dérivant.
 */
rainConfetti(dt: number, cx: number, topY: number, halfWidthM: number): void {
  if (this.confettiLeft <= CONFETTI_EPS || dt <= 0) return;
  const d = Math.min(dt, this.confettiLeft);
  this.confettiLeft -= d;
  this.confettiCarry += d * CONFETTI_PER_SECOND;
  while (this.confettiCarry >= 1) {
    this.confettiCarry -= 1;
    this.add({
      x: cx + rand(-halfWidthM, halfWidthM), y: topY + rand(0, 1), vx: rand(-0.6, 0.6), vy: rand(-2.6, -1.6),
      life: CONFETTI_LIFE, maxLife: CONFETTI_LIFE, kind: 'confetti', size: rand(0.1, 0.16),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], phase: rand(0, Math.PI * 2),
    });
  }
}
```

    `clear()` remet aussi `confettiLeft` et `confettiCarry` à 0 (commentaire : « une nouvelle course n'hérite jamais d'une pluie »). `update` est inchangé (les confettis tombent à vitesse constante, sans la gravité des étincelles). Dans `draw`, juste après le calcul de `s` et `r`, avant le `switch` :

```ts
if (p.kind === 'confetti') {
  // Papier qui se retourne : largeur × |cos| (au moins 1 px), opacité qui baisse le dernier tiers de sa vie.
  const w = Math.max(1, 2 * r * Math.abs(Math.cos((p.phase ?? 0) + p.life * CONFETTI_FLUTTER)));
  ctx.globalAlpha = Math.min(1, 3 * k);
  ctx.fillStyle = p.color ?? '#ffffff';
  ctx.fillRect(s.x - w / 2, s.y - r / 2, w, r);
  continue;
}
```

  - `src/render/title.ts` l. 25–26 : `export const CHASSIS_ABOVE_AXLE_M` et `export const WHEEL_X_M` (valeurs inchangées).
  - `src/render/car.ts` l. 80 : `if (car.name !== 'Galahad' && car.name !== '')` (commentaire : « un prénom vide n'est pas écrit : petites voitures du podium, dont le DOM écrit le prénom »).
  - `src/render/renderer.ts` : imports `colorHex, type Pilot` de `../cars/pilots`, `CHASSIS_ABOVE_AXLE_M, WHEEL_X_M` de `./title` ; constantes de module et méthode :

```ts
/** Largeur CSS (px) d'une petite voiture du podium quand la mise en page ne la donne pas (jsdom). */
const ICON_DEFAULT_CSS_PX = 160;
/** Cadre de la petite voiture (m) : 3,2 de large (rapport 2:1), centré 0,75 m au-dessus du sol (roues en bas, toit en haut). */
const ICON_W_M = 3.2;
const ICON_CENTER_Y_M = 0.75;

/**
 * Petite voiture du podium (tâche 11) : `pilot` au repos, de profil, dans `target` (peinte une fois, à l'entrée au podium),
 * par le même `drawCar` que la course (sprite et roue s'ils sont chargés, sinon par code), sans prénom (le DOM l'écrit).
 * Tampon à la largeur CSS × devicePixelRatio (plafonné à 2), hauteur moitié. Sans contexte 2D : rien.
 */
paintCarIcon(target: HTMLCanvasElement, pilot: Pilot): void {
  const ctx = target.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round((target.clientWidth || ICON_DEFAULT_CSS_PX) * dpr));
  const h = Math.round(w / 2);
  target.width = w;
  target.height = h;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  const ppm = w / ICON_W_M;
  const R = this.cfg.WHEEL_RADIUS;
  const car: CarView = {
    id: pilot.id, x: 0, y: R + CHASSIS_ABOVE_AXLE_M, angle: 0,
    wheels: [{ x: -WHEEL_X_M, y: R, angle: 0 }, { x: WHEEL_X_M, y: R, angle: 0 }],
    color: colorHex(pilot.color), accent: colorHex(pilot.accent), helmet: colorHex(pilot.helmet),
    name: '', turbo: false,
  };
  const toScreen = (p: { x: number; y: number }) => ({ x: w / 2 + p.x * ppm, y: h / 2 - (p.y - ICON_CENTER_Y_M) * ppm });
  drawCar(ctx, car, ppm, 0, toScreen, this.cfg, this.loaded ?? NO_ART);
}
```

- [ ] **Step 4 : Vert et commit** : `npx vitest run tests/podium.test.ts tests/effects.test.ts tests/ranking.test.ts tests/title-scene.test.ts tests/render-smoke.test.ts tests/render-sprites.test.ts tests/deps.test.ts` → vert ; `npm run typecheck` → 0. Commit : `git add tests/podium.test.ts && git commit -m "feat: classement final du podium, confettis, petite voiture peinte par drawCar" -- src/cars/ranking.ts src/render/effects.ts src/render/title.ts src/render/car.ts src/render/renderer.ts tests/podium.test.ts`

---

## Partie 2 — Écran podium dans `src/ui/screens.ts` (Steps 5 à 8)

**Files:**
- Modify: `src/ui/screens.ts`, `tests/podium.test.ts` (ajouts), `tests/screens.test.ts` (l. 13–20 `make()`, l. 23–29)

**Interfaces :**
- Consumes : `PodiumView`, `PodiumPlace`, `ordinal` (`src/cars/ranking.ts`) ; `formatTime` (`src/ui/hud.ts`).
- Produces :

```ts
export interface PodiumActions {
  /**
   * ENCORE : au `pointerdown` ET au `click` (data-no-pedal). Un doigt de gaz peut rester posé quand le podium arrive : avec
   * un autre doigt sur l'écran, le `click` du tap ne part pas toujours (leçon de REPRENDRE, session 6). Le doublon est sans
   * effet : après le premier, la phase est `countdown`, qui n'a pas de ligne `again`.
   */
  onAgain(): void;
  /** MENU : au `click` seul (data-no-pedal) : A20. */
  onMenu(): void;
}
export class Screens {
  constructor(root: HTMLElement, opts: { version: string }, actions: TitleActions & PodiumActions & { onResume(): void });
  /**
   * Montre le podium (les autres calques cachés) : temps de Galahad (mm:ss), les trois premiers sur leurs marches (2e, 1er,
   * 3e de gauche à droite : prénom, petite toile peinte par `paintCar`, médaille), la marche de Galahad surlignée ; hors
   * podium, sa case à droite (« 4e », sa voiture, son prénom). Rappelé à chaque arrivée : tout est réécrit, rien n'est ajouté.
   */
  showPodium(view: PodiumView, paintCar: (canvas: HTMLCanvasElement, place: PodiumPlace) => void): void;
}
```

DOM et classes (tests et e2e s'y accrochent) : `.screen.screen-podium` (`data-no-pedal` sur le calque entier, voile léger `rgba(0,0,20,.35)` : la course figée et les confettis se voient derrière) contenant `.podium-time`, `.podium-row` (trois `.podium-step.step-2`, `.step-1`, `.step-3` dans cet ordre, chacun : `.podium-name`, `canvas.podium-car`, `.podium-block` contenant `.podium-medal` ; plus `.podium-me` : `.podium-me-place`, `canvas.podium-car`, `.podium-name`), `.podium-buttons` (`button.btn-again` « ENCORE » rond avec flèche, `button.btn-menu` « MENU » avec maison, tous deux `data-no-pedal`). `is-galahad` sur la marche de Galahad. Feuille, à ajouter à `CSS` :

```css
.screen-podium{background:rgba(0,0,20,.35);pointer-events:auto;justify-content:space-between;padding:2vh 0 4vh;box-sizing:border-box}
.podium-time{font-size:clamp(40px,12vh,110px);font-weight:700;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:.03em}
.podium-row{display:flex;align-items:flex-end;justify-content:center;gap:clamp(8px,1.5vw,20px)}
.podium-step,.podium-me{display:flex;flex-direction:column;align-items:center;width:clamp(110px,16vw,200px)}
.podium-name{font-size:clamp(16px,3.4vh,28px);font-weight:700;line-height:1.1;white-space:nowrap}
.podium-car{display:block;width:100%;height:auto;aspect-ratio:2/1}
.podium-block{width:100%;box-sizing:border-box;display:flex;justify-content:center;align-items:flex-start;padding-top:6px;
  background:#c8c8c8;border:3px solid #fff;border-bottom:none;border-radius:10px 10px 0 0;box-shadow:inset 0 -6px 0 #0002}
.step-1 .podium-block{height:24vh}
.step-2 .podium-block{height:18vh}
.step-3 .podium-block{height:13vh}
.podium-medal{height:min(9vh,80px)}
.podium-medal svg{display:block;height:100%;width:auto}
.podium-step.is-galahad .podium-name{color:#ffd23f}
.podium-step.is-galahad .podium-block{background:#ffe27a}
.podium-me{margin-left:clamp(16px,4vw,56px);align-self:center}
.podium-me-place{font-size:clamp(40px,10vh,88px);font-weight:700;line-height:1}
.podium-buttons{display:flex;align-items:center;justify-content:center;gap:clamp(20px,6vw,80px)}
.btn-again{min-width:96px;min-height:96px;width:clamp(96px,16vh,130px);height:clamp(96px,16vh,130px);border-radius:50%;
  padding:0;margin:0;background:#e2231a;font-weight:700;font-size:clamp(18px,3.2vh,26px)}
.btn-again .btn-icon{width:36%;height:36%}
.btn-menu{min-width:96px;min-height:96px;height:96px;padding:0 28px;margin:0;border-radius:24px;background:#1e5cff;
  font-weight:700;font-size:20px}
.btn-menu .btn-icon{width:38px;height:38px}
@media (orientation:portrait){
  .podium-row{flex-wrap:wrap}
  .podium-step{width:24vw}
  .podium-me{width:100%;margin:2vh 0 0;flex-direction:row;justify-content:center;gap:12px}
  .podium-me .podium-car{width:24vw}
}
```

(`.podium-me` et les marches ont `display:flex` : leur `hidden` est couvert par la règle existante `.screen [hidden]{display:none}`, de spécificité 0,2,0, plus forte que 0,1,0 ; le test de la feuille le vérifie. Hauteurs vérifiées sur le papier : à 390 px de haut, 8 + 47 (temps) + 20 + 67 + 94 (marche du 1er) + 96 (ENCORE) + 16 = 348 px ; à 844 px de large, 3 × 135 + 2 × 8 + 34 + 135 = 590 px. La médaille est réglée sur la hauteur (9vh, au plus 80 px : rapport 64 × 80) pour tenir dans la marche du 3e : à 390 px, 35 + 6 de marge = 41 px dans 13vh = 51 px (avec 8vh de large et 11vh de marche, elle dépassait d'≈ 8 px). Le bloc `orientation:portrait` est un repli : la rangée ferait ≈ 470 px dans 390 (A11) ; les marches passent à 24vw et la case de Galahad sous elles.)

- [ ] **Step 5 : Tests.** Dans `tests/screens.test.ts` : `make()` reçoit `onAgain: vi.fn(), onMenu: vi.fn()` dans `actions` ; le premier test devient « quatre calques créés cachés » avec `'.screen-podium'` dans la liste. Puis, à la fin de `tests/podium.test.ts` (ajouter les imports `ordinal` de `../src/cars/ranking`, `formatTime` de `../src/ui/hud`, `Screens` de `../src/ui/screens`, `type Pilot` de `../src/cars/pilots`) :

```ts
function makeScreens() {
  const root = document.createElement('div');
  document.body.append(root);
  const actions = { onPlay: vi.fn(), onOtherTrack: vi.fn(), onResume: vi.fn(), onAgain: vi.fn(), onMenu: vi.fn() };
  const screens = new Screens(root, { version: '1.2.0' }, actions);
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  const qa = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
  return { root, screens, actions, q, qa };
}
/** Classement où la voiture `order[k]` arrive k-ième. */
const viewOf = (order: number[], time = 83.4, ps: readonly Pilot[] = pilots) =>
  podiumView(order.map((index, k) => entry(index, 0, 10 + k)), ps, 0, time);
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const pointerDown = (el: Element) => { const e = new Event('pointerdown', { bubbles: true }); Object.defineProperty(e, 'pointerId', { value: 3 }); el.dispatchEvent(e); };

test('podium : calque caché à la création, montré seul par showPodium, voile entier data-no-pedal, temps de Galahad en mm:ss', () => {
  const { screens, q } = makeScreens();
  expect(q('.screen-podium').hidden).toBe(true);
  expect(q('.podium-me').hidden).toBe(true);   // la case de Galahad ne se montre jamais avant un podium où il est 4e ou 5e
  screens.showTitle();
  screens.showPodium(viewOf([0, 1, 2, 3, 4]), () => {});
  expect(q('.screen-podium').hidden).toBe(false);
  for (const s of ['.screen-title', '.screen-countdown', '.screen-pause']) expect(q(s).hidden, s).toBe(true);
  expect(q('.screen-podium').hasAttribute('data-no-pedal')).toBe(true);
  expect(q('.podium-time').textContent).toBe(formatTime(83.4));
  expect(q('.podium-time').textContent).toBe('01:23');
});

test('trois marches dans l’ordre 2e, 1er, 3e : prénoms, médaille SVG, voiture peinte par le rappel (une fois par marche, dans l’ordre du DOM)', () => {
  const { screens, qa } = makeScreens();
  const paint = vi.fn();
  screens.showPodium(viewOf([2, 0, 1, 3, 4]), paint);
  const steps = qa('.podium-step');
  expect(steps.map((s) => [...s.classList].find((c) => c.startsWith('step-')))).toEqual(['step-2', 'step-1', 'step-3']);
  expect(steps.map((s) => s.querySelector('.podium-name')!.textContent)).toEqual(['Galahad', 'Diego', 'Pablo']);
  for (const s of steps) expect(s.querySelector('.podium-medal svg')).not.toBeNull();
  expect(paint).toHaveBeenCalledTimes(3);
  expect(paint.mock.calls.map(([c]) => c)).toEqual(steps.map((s) => s.querySelector('canvas')));
  expect(paint.mock.calls.map(([, p]) => p.place)).toEqual([2, 1, 3]);
});

test('Galahad 1er : sa marche surlignée, pas de case à côté ; Galahad 2e : la marche du 2e surlignée', () => {
  const { screens, q, qa } = makeScreens();
  screens.showPodium(viewOf([0, 1, 2, 3, 4]), () => {});
  expect(q('.step-1').classList.contains('is-galahad')).toBe(true);
  expect(qa('.podium-step.is-galahad')).toHaveLength(1);
  expect(q('.podium-me').hidden).toBe(true);
  screens.showPodium(viewOf([1, 0, 2, 3, 4]), () => {});
  expect(qa('.podium-step.is-galahad').map((s) => s.classList.contains('step-2'))).toEqual([true]);
  expect(q('.podium-me').hidden).toBe(true);
});

test('Galahad 4e puis 5e : case à droite avec sa place, sa voiture (peinte en 4e appel) et son prénom ; aucune marche surlignée', () => {
  const { screens, q, qa } = makeScreens();
  const paint = vi.fn();
  screens.showPodium(viewOf([1, 2, 3, 0, 4]), paint);
  expect(q('.podium-me').hidden).toBe(false);
  expect(q('.podium-me-place').textContent).toBe(ordinal(4));
  expect(q('.podium-me .podium-name').textContent).toBe('Galahad');
  expect(qa('.podium-step.is-galahad')).toHaveLength(0);
  expect(paint).toHaveBeenCalledTimes(4);
  expect(paint.mock.calls[3][0]).toBe(q('.podium-me canvas'));
  expect(paint.mock.calls[3][1].isGalahad).toBe(true);
  screens.showPodium(viewOf([1, 2, 3, 4, 0]), () => {});
  expect(q('.podium-me-place').textContent).toBe('5e');
});

test('ENCORE et MENU : data-no-pedal, mots et icônes ; onAgain au pointerdown ET au click (un doigt de gaz peut rester posé) ; onMenu au click seul (A20) ; ≥ 96 px déclarés', () => {
  const { screens, actions, q } = makeScreens();
  screens.showPodium(viewOf([0, 1, 2, 3, 4]), () => {});
  const again = q('.btn-again');
  const menu = q('.btn-menu');
  for (const b of [again, menu]) {
    expect(b.hasAttribute('data-no-pedal')).toBe(true);
    expect(b.querySelector('svg')).not.toBeNull();
    expect(parseFloat(getComputedStyle(b).getPropertyValue('min-width'))).toBeGreaterThanOrEqual(96);
    expect(parseFloat(getComputedStyle(b).getPropertyValue('min-height'))).toBeGreaterThanOrEqual(96);
  }
  expect(again.textContent).toBe('ENCORE');
  expect(menu.textContent).toBe('MENU');
  expect(again.querySelector('.btn-label')!.textContent).toBe('ENCORE');
  expect(menu.querySelector('.btn-label')!.textContent).toBe('MENU');
  pointerDown(again);
  expect(actions.onAgain).toHaveBeenCalledTimes(1);
  click(again);   // le click qui suit le doigt levé : `Game` l'ignore (aucune ligne `again` depuis `countdown`)
  expect(actions.onAgain).toHaveBeenCalledTimes(2);
  pointerDown(menu);
  expect(actions.onMenu).not.toHaveBeenCalled();
  click(menu);
  expect(actions.onMenu).toHaveBeenCalledTimes(1);
});

test('showPodium deux fois : contenu réécrit, jamais doublé ; un autre écran cache le podium (jamais retiré du DOM)', () => {
  const { screens, q, qa } = makeScreens();
  screens.showPodium(viewOf([1, 2, 3, 0, 4]), () => {});
  screens.showPodium(viewOf([0, 1, 2, 3, 4], 61), () => {});
  expect(qa('.podium-step')).toHaveLength(3);
  expect(qa('.podium-me')).toHaveLength(1);
  expect(qa('.btn-again')).toHaveLength(1);
  expect(q('.podium-time').textContent).toBe('01:01');
  expect(q('.podium-me').hidden).toBe(true);
  screens.showCountdown('3');
  expect(q('.screen-podium').hidden).toBe(true);
  expect(q('.screen-podium').isConnected).toBe(true);
});

test('prénoms en texte : un prénom à balises n’injecte aucun élément', () => {
  const { screens, q } = makeScreens();
  const evil: Pilot = { ...PILOTS[0], id: 'x', name: '<img src=x onerror=alert(1)>' };
  screens.showPodium(viewOf([1, 0, 2, 3, 4], 50, [GALAHAD, evil, PILOTS[1], PILOTS[2], PILOTS[3]]), () => {});
  expect(q('.step-1 .podium-name').textContent).toBe('<img src=x onerror=alert(1)>');
  expect(q('.screen-podium').querySelector('img')).toBeNull();
});

test('moins de trois places : marches vides cachées', () => {
  const { screens, q } = makeScreens();
  screens.showPodium(podiumView([entry(0, 300, 60)], [GALAHAD], 0, 60), () => {});
  expect(q('.step-1').hidden).toBe(false);
  expect(q('.step-2').hidden).toBe(true);
  expect(q('.step-3').hidden).toBe(true);
});

test('la feuille : .screen-podium (flex de .screen) et la case de Galahad cachée par .screen [hidden] ; police Fredoka', () => {
  makeScreens();
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  expect(rules.find((r) => r.selectorText === '.screen [hidden]')?.style.display).toBe('none');
  expect(rules.find((r) => r.selectorText.split(',').map((s) => s.trim()).includes('.podium-me'))?.style.display).toBe('flex');
  expect(rules.find((r) => r.selectorText === '.screen')?.style.fontFamily).toMatch(/Fredoka/);
});
```

(jsdom sérialise une règle à deux sélecteurs avec ou sans espace après la virgule : le test de la feuille découpe `selectorText` sur les virgules.)

- [ ] **Step 6 : Vérifier l'échec** : `npx vitest run tests/podium.test.ts tests/screens.test.ts` → FAIL (`showPodium` absent ; `make()` refusé par le typecheck tant que `PodiumActions` n'existe pas : vitest passe quand même, le typecheck viendra au Step 8).

- [ ] **Step 7 : Écrire le podium dans `src/ui/screens.ts`.**
  - Imports : `import { ordinal, type PodiumPlace, type PodiumView } from '../cars/ranking';` et `import { formatTime } from './hud';`. En-tête du fichier : ajouter le podium (tâche 11) à la liste des calques.
  - SVG constants (aucune donnée insérée) :

```ts
/** Médaille (SVG inline) : ruban bleu, disque `fill` cerclé de `rim`, chiffre de la place. Arguments constants uniquement. */
const medal = (fill: string, rim: string, n: 1 | 2 | 3) => `<svg viewBox="0 0 64 80" aria-hidden="true" focusable="false">
  <path d="M18 0h12l6 24H24zM34 0h12l-6 24H28z" fill="#1e5cff"/>
  <circle cx="32" cy="50" r="25" fill="${fill}" stroke="${rim}" stroke-width="5"/>
  <text x="32" y="61" text-anchor="middle" font-size="30" font-weight="700" font-family="Fredoka, system-ui, sans-serif" fill="#3a2a00">${n}</text>
</svg>`;
/** Or, argent, bronze : médailles des places 1, 2, 3. */
const MEDAL_SVG = [medal('#ffd23f', '#c99a00', 1), medal('#d9dee6', '#9aa3ad', 2), medal('#e08a4a', '#a3592a', 3)] as const;
/** Flèche en boucle (ENCORE). */
const AGAIN_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="#fff" stroke-width="8"
  stroke-linecap="round" stroke-linejoin="round"><path d="M50 32a18 18 0 1 1-6-13.4"/><path d="M46 6v14H32"/></svg>`;
/**
 * Maison (MENU). Aucun blanc entre les balises (ni dans AGAIN_SVG) : un nœud texte « \n  » dans l'icône s'ajouterait au
 * `textContent` du bouton (« \n  MENU »), que les tests comparent à « MENU ». Les médailles ne sont pas dans des boutons.
 */
const HOME_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="#fff"><path d="M32 8 6 30h8v24h14V40h8v14h14V30h8z"/></svg>`;
```

  - Champs : `podium`, `podiumTime`, `steps: { place: 1 | 2 | 3; step: HTMLDivElement; name: HTMLDivElement; car: HTMLCanvasElement }[]`, `me`, `meRank`, `meName`, `meCar`, et `layers: HTMLDivElement[]` (les quatre calques : `show()` et la boucle de création les parcourent).
  - Constructeur, après la pause :

```ts
// Podium (tâche 11) : voile data-no-pedal (un doigt laissé dessus n'est pas du gaz à PARTEZ après ENCORE), temps de
// Galahad, trois marches (2e, 1er, 3e de gauche à droite), case de Galahad hors podium, ENCORE et MENU. Rempli par `showPodium`.
this.podium = this.div('screen screen-podium');
this.podium.setAttribute('data-no-pedal', '');
this.podiumTime = this.div('podium-time');
const row = this.div('podium-row');
this.steps = ([2, 1, 3] as const).map((place) => {
  const step = this.div(`podium-step step-${place}`);
  const name = this.div('podium-name');
  const car = doc.createElement('canvas');
  car.className = 'podium-car';
  const block = this.div('podium-block');
  const medalBox = this.div('podium-medal');
  medalBox.innerHTML = MEDAL_SVG[place - 1];
  block.appendChild(medalBox);
  step.append(name, car, block);
  row.appendChild(step);
  return { place, step, name, car };
});
this.me = this.div('podium-me');
this.meRank = this.div('podium-me-place');
this.meCar = doc.createElement('canvas');
this.meCar.className = 'podium-car';
this.meName = this.div('podium-name');
this.me.append(this.meRank, this.meCar, this.meName);
this.me.hidden = true;
row.appendChild(this.me);
const podiumButtons = this.div('podium-buttons');
const again = this.button('btn-again', 'ENCORE', AGAIN_SVG);
again.setAttribute('data-no-pedal', '');
// ENCORE au pointerdown (doigt de gaz encore posé : le click peut ne pas partir) et au click (clavier) ; doublon ignoré par `Game`.
again.addEventListener('pointerdown', () => actions.onAgain());
again.addEventListener('click', () => actions.onAgain());
// MENU au click seul (A20) : au titre, AUTRE PISTE est presque à la même place ; un click fantôme y changerait de piste.
const menu = this.button('btn-menu', 'MENU', HOME_SVG);
menu.setAttribute('data-no-pedal', '');
menu.addEventListener('click', () => actions.onMenu());
podiumButtons.append(again, menu);
this.podium.append(this.podiumTime, row, podiumButtons);

this.layers = [this.title, this.countdown, this.pause, this.podium];
for (const s of this.layers) s.hidden = true;
root.append(...this.layers);
```

  - `showPodium` :

```ts
showPodium(view: PodiumView, paintCar: (canvas: HTMLCanvasElement, place: PodiumPlace) => void): void {
  this.podiumTime.textContent = formatTime(view.galahadTime);
  for (const s of this.steps) {
    const p = view.places[s.place - 1];
    s.step.hidden = p === undefined;
    s.step.classList.toggle('is-galahad', p?.isGalahad === true);
    s.name.textContent = p?.name ?? '';
  }
  const me = view.places[view.galahadPlace - 1];
  this.me.hidden = me === undefined || view.galahadPlace <= 3;
  this.meRank.textContent = ordinal(view.galahadPlace);
  this.meName.textContent = me?.name ?? '';
  this.show(this.podium);
  // Après `show` : la mise en page donne leur largeur aux petites toiles (jsdom : 0, `paintCarIcon` prend sa largeur par défaut).
  for (const s of this.steps) {
    const p = view.places[s.place - 1];
    if (p) paintCar(s.car, p);
  }
  if (!this.me.hidden && me) paintCar(this.meCar, me);
}
```

  - `show(shown)` parcourt `this.layers` ; `hide()` cache les quatre (commentaire mis à jour).
  - Le `ENCORE` de `textContent` : l'icône est un `span.btn-icon` sans texte, le mot un `span.btn-label` : `textContent === 'ENCORE'` (utilitaire `button()` existant).

- [ ] **Step 8 : Vert et commit** : `npx vitest run tests/podium.test.ts tests/screens.test.ts` → vert ; `npm run typecheck` → **1 erreur attendue** dans `src/game.ts` (le constructeur de `Screens` réclame `onAgain` et `onMenu`) : ajouter tout de suite dans `src/game.ts` l. 115–117 `onAgain: () => this.again(), onMenu: () => this.menu(),` (le reste de `Game` à la Partie 3), puis `npm run typecheck` → 0 et `npx vitest run tests/game-screens.test.ts` → vert (rien d'autre n'a changé). Commit : `git commit -m "feat: écran podium en DOM (trois marches, médailles, case de Galahad, ENCORE, MENU)" -- src/ui/screens.ts src/game.ts tests/podium.test.ts tests/screens.test.ts`

---

## Partie 3 — `Game` : roue libre, podium figé, confettis (Steps 9 à 14)

**Files:**
- Modify: `src/game.ts` (à éditer avec `Edit` après relecture), `src/ui/hud.ts`, `src/loop/states.ts` (commentaire l. 30–31), `package.json`, `tests/game-screens.test.ts`, `tests/game-frame.test.ts` (commentaire l. 171)

**Interfaces :**
- Consumes : `podiumView` (Partie 1), `Screens.showPodium` (Partie 2), `Renderer.paintCarIcon`, `Effects.startConfetti` / `rainConfetti` / `confettiCount`, `presentFrame`, `rankEntriesOf`.
- Produces :

```ts
// src/game.ts
export class Game {
  /** Podium (debug, e2e) : ids dans l'ordre du classement final, place et temps de Galahad ; null avant le podium. */
  get podium(): { order: string[]; galahadPlace: number; time: number } | null;
  /** Confettis en vol (debug, e2e). */
  get confetti(): number;
}
// src/ui/hud.ts : `showFinished` et son utilitaire `button` retirés (le podium remplace le calque ARRIVÉE).
```

Comportement de `Game` (ce que le code doit faire) :
- Champ `podiumData: PodiumView | null` (null dans `newRace`) à la place de `finishShown` (retiré, avec sa remise à faux dans `newRace`).
- `raceFrame` (phases `racing` et `finished`), après `present` : si `phase === 'finished'`, `finishTime !== null` et `sim.time >= finishTime + FINISH_COAST_SECONDS` → `enterPodium()` (même condition, même instant que le calque ARRIVÉE d'aujourd'hui). Le bloc `showFinished` de `present` (l. 547–552) disparaît.
- `enterPodium()` : `send('podium')` (sinon rien) ; `podiumData = podiumView(rankEntriesOf(sim), this.pilots, GALAHAD_INDEX, finishTime)` (**une fois**) ; `jumpInput.clear()` ; `hud.setRaceVisible(false)` ; `jumpButton.setVisible(false)` ; `screens.showPodium(podiumData, (canvas, p) => renderer.paintCarIcon(canvas, sim.cars[p.index].pilot))` ; `effects.startConfetti()` si `galahadPlace === 1`.
- `frame` : `case 'podium': this.podiumFrame(elapsed)` (plus `raceFrame`).
- `podiumFrame(elapsed)` : **aucun pas** ; `effects.rainConfetti(elapsed, camera.x, camera.y + VISIBLE_HEIGHT_M / 2, half)` puis `effects.update(elapsed, sim.track, camera.x, half)` ; scène aux poses du dernier pas (`presentFrame(sim, { poses: loop.history.at(1), alpha: 1 }, camera, 0)` : caméra immobile) ; `renderer.draw(scene, camera, effects)`. Ni HUD ni classement.
- `again()`, `menu()`, `popstate` (podium → `menu()`), `visibilitychange` (rien au podium, la table n'a pas de pause) : inchangés ; `newRace` vide les effets **et arrête la pluie** (`Effects.clear`).

- [ ] **Step 9 : Tests de câblage** dans `tests/game-screens.test.ts`.
  - En tête : `import { rankCars } from '../src/cars/ranking';`, `import { formatTime } from '../src/ui/hud';`, `rankEntriesOf` ajouté à l'import de `../src/sim/simulate` ; `let painted: string[] = [];` à côté de `drawn`.
  - `beforeEach` : `painted = [];` et `vi.spyOn(Renderer.prototype, 'paintCarIcon').mockImplementation((_canvas, pilot) => { painted.push(pilot.id); });` (le faux contexte `{}` des tests lèverait dans `drawCar` ; l'exception remonterait au `try` de `frame` → `error`).
  - `Internals.effects` gagne `confettiCount: number`.
  - `driveToArrival` (l. 437–445) est remplacé par deux aides, et ses cinq appels (l. 381, 401, 422, 449, 474) appellent `driveToPodium` :

```ts
/** Galahad posé 3 m avant la ligne, doigt posé (pointeur 1), images jusqu'à `finished` ; rend le `now` atteint. */
function driveToFinished(game: Game, internals: () => Internals, now: number): number {
  const { sim } = internals();
  placeCar(sim.cars[0].body, sim.track.xFinish - 3, (x) => heightAt(sim.track, x), 0, CONFIG);
  pointer('pointerdown', 1);
  for (let f = 0; f < 600 && game.state !== 'finished'; f++) now = frames(1, now);
  expect(game.state).toBe('finished');
  return now;
}
/** `driveToFinished`, puis FINISH_COAST_SECONDS d'images (+ 5) : le podium (tâche 11). */
function driveToPodium(game: Game, internals: () => Internals, now: number): number {
  now = frames(Math.ceil(CONFIG.FINISH_COAST_SECONDS / DT) + 5, driveToFinished(game, internals, now));
  expect(game.state).toBe('podium');
  return now;
}
```

  - Test l. 396 (« MENU avec une entrée d'historique armée… ; geste retour pendant finished… ») : titre → « … ; geste retour pendant le podium → titre sans history.back » ; chaque `expect(root.querySelector('.hud-overlay')).toBeNull()` devient `expect(root.querySelector<HTMLElement>('.screen-podium')!.hidden).toBe(true)` et `.not.toBeNull()` devient `.hidden).toBe(false)`.
  - Test l. 447 (« arrivée : calque ARRIVÉE… ») remplacé par :

```ts
test('podium : ENCORE et MENU (data-no-pedal) ; ENCORE → décompte sur la même piste et les mêmes copains, chrono à 0, podium caché, confettis effacés ; MENU → titre', () => {
  const { game, q, root, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const podium = q('.screen-podium');
  expect(podium.hidden).toBe(false);
  expect(root.querySelector('.hud-overlay')).toBeNull();   // plus de calque ARRIVÉE
  expect(podium.textContent).not.toMatch(/ARRIVÉE/);
  const buttons = [...podium.querySelectorAll<HTMLButtonElement>('button')];
  expect(buttons.map((b) => b.textContent)).toEqual(['ENCORE', 'MENU']);
  for (const b of buttons) expect(b.hasAttribute('data-no-pedal'), b.textContent!).toBe(true);
  now = frames(30, now);
  expect(internals().effects.confettiCount).toBeGreaterThan(0);   // Galahad 1er
  const pilots = game.pilots.map((p) => p.id);
  const seed = game.seed;
  expect(game.time).toBeGreaterThan(0);
  q('.btn-again').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
  expect(game.time).toBe(0);
  expect(game.pilots.map((p) => p.id)).toEqual(pilots);
  expect(game.seed).toBe(seed);
  expect(podium.hidden).toBe(true);
  expect(game.podium).toBeNull();
  expect(internals().effects.confettiCount).toBe(0);
  expect(q('.hud-time').hidden).toBe(false);
  expect(q('.hud-time').textContent).toBe('00:00');
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  now = frames(60, now);
  expect(game.time).toBeGreaterThan(0);
  // Second podium (même mise en place), puis MENU : titre, HUD caché, mêmes pilotes, plus aucune course dessinée.
  now = driveToPodium(game, internals, now);
  q('.btn-menu').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('title');
  expect(q('.screen-title').hidden).toBe(false);
  expect(podium.hidden).toBe(true);
  for (const sel of ['.hud-time', '.hud-bar', '.hud-position', '.jump-button']) expect(q(sel).hidden, sel).toBe(true);
  expect(game.pilots.map((p) => p.id)).toEqual(pilots);
  expect(game.time).toBe(0);
  const race = drawn.race;
  frames(5, now, 1000 / 60);
  expect(drawn.race).toBe(race);
  expect(drawn.title).toBeGreaterThanOrEqual(5);
});
```

  - Nouveaux tests :

```ts
test('podium : FINISH_COAST_SECONDS de roue libre après l’arrivée (la course avance, pas de podium), puis podium ; aucun pas ensuite ; HUD de course et bouton saut cachés ; temps de Galahad', () => {
  const { game, q, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToFinished(game, internals, now);
  const { sim } = internals();
  const finishedAt = sim.cars[0].state.finishedAt!;
  const t0 = sim.time;
  for (let f = 0; f < 200 && sim.time < finishedAt + CONFIG.FINISH_COAST_SECONDS - 2 * DT; f++) {
    now = frames(1, now);
    expect(game.state).toBe('finished');
  }
  expect(sim.time).toBeGreaterThan(t0);   // la course a avancé pendant la roue libre
  expect(q('.screen-podium').hidden).toBe(true);
  now = frames(3, now);
  expect(game.state).toBe('podium');
  expect(q('.screen-podium').hidden).toBe(false);
  expect(sim.time).toBeGreaterThanOrEqual(finishedAt + CONFIG.FINISH_COAST_SECONDS);
  now = frames(1, now);   // au moins une image de podium (`podiumFrame`) avant de relever la caméra
  const t = sim.time;
  const x = game.progress(game.pilots[1].id);
  const cam = { x: internals().camera.x, y: internals().camera.y };
  now = frames(120, now);
  expect(sim.time).toBe(t);   // aucun pas au podium
  expect(game.progress(game.pilots[1].id)).toBe(x);
  // Caméra immobile : `presentFrame(…, 0)` ; avec le temps écoulé de l'image, elle glisserait vers son avance de vitesse.
  expect(internals().camera.x).toBe(cam.x);
  expect(internals().camera.y).toBe(cam.y);
  expect(q('.podium-time').textContent).toBe(formatTime(finishedAt));
  expect(game.podium!.time).toBe(finishedAt);
  for (const sel of ['.hud-time', '.hud-bar', '.hud-position', '.jump-button']) expect(q(sel).hidden, sel).toBe(true);
  expect(painted).toHaveLength(3);
});

test('classement figé à l’entrée au podium (rankCars, copains non arrivés par progression) ; Galahad 1er → confettis ; voitures peintes dans l’ordre des marches', () => {
  const { game, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const { sim } = internals();
  const order = rankCars(rankEntriesOf(sim)).map((i) => sim.cars[i].state.id);
  expect(game.podium!.order).toEqual(order);
  expect(game.podium!.galahadPlace).toBe(1);   // posé 3 m avant la ligne, les copains loin derrière
  expect(painted).toEqual([order[1], order[0], order[2]]);
  now = frames(30, now);
  expect(internals().effects.confettiCount).toBeGreaterThan(0);
  expect(game.confetti).toBe(internals().effects.confettiCount);
  sim.cars[4].state.progress = 1e6;   // sonde : une progression changée après coup ne change pas le podium
  now = frames(10, now);
  expect(game.podium!.order).toEqual(order);
});

test('Galahad 4e (trois copains arrivés avant lui) : sa case à côté du podium avec « 4e », marches aux copains, aucun confetti', () => {
  const { game, q, root, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  const { sim } = internals();
  // Trois copains déclarés arrivés (comme tests/fosses.test.ts déclare Galahad arrivé) : ils freinent sur la grille.
  for (const i of [1, 2, 3]) sim.cars[i].state.finishedAt = 0.1 * i;
  now = driveToPodium(game, internals, now);
  expect(game.podium!.galahadPlace).toBe(4);
  expect(q('.podium-me').hidden).toBe(false);
  expect(q('.podium-me-place').textContent).toBe('4e');
  expect(root.querySelectorAll('.podium-step.is-galahad')).toHaveLength(0);
  expect([...root.querySelectorAll('.podium-step .podium-name')].map((n) => n.textContent)).toEqual([2, 1, 3].map((i) => sim.cars[i].pilot.name));
  now = frames(60, now);
  expect(internals().effects.confettiCount).toBe(0);
  expect(painted).toHaveLength(4);
});

test('onglet caché au podium : reste au podium (pas de pause), aucun pas', () => {
  const { game, q, internals } = makeGame();
  let now = startRacing(game, () => raf!);
  now = driveToPodium(game, internals, now);
  const t = internals().sim.time;
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(game.state).toBe('podium');
  expect(q('.screen-pause').hidden).toBe(true);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  frames(30, now);
  expect(internals().sim.time).toBe(t);
  expect(q('.screen-podium').hidden).toBe(false);
});
```

L'en-tête du fichier (l. 4–6) remplace « ARRIVÉE avec ENCORE et MENU » par « podium (roue libre, classement figé, confettis, ENCORE et MENU) » et cite `paintCarIcon` parmi les méthodes interceptées. `tests/game-frame.test.ts` : **un commentaire seulement**, aucune assertion changée. Il s'arrête 70 images (1,17 s) après l'arrivée, avant le podium ; au-dessus de la boucle de 60 images (l. 171), ajouter « 60 + 10 images (1,17 s) : on reste en `finished`, le podium vient à FINISH_COAST_SECONDS (1,5 s) ; au-delà, `paintCarIcon` serait appelé sur le faux contexte `{}` et lèverait ». Le fichier est dans le commit du Step 13.

- [ ] **Step 10 : Vérifier l'échec** : `npx vitest run tests/game-screens.test.ts` → FAIL (état `finished` au lieu de `podium`, `game.podium` absent).

- [ ] **Step 11 : Implémenter.**
  - `src/game.ts` :
    - en-tête (l. 1–7) : « arrivée (1,5 s de roue libre) puis podium figé (classement final, confettis si Galahad gagne, ENCORE, MENU) » ; la dernière phrase devient « la simulation ne fait aucun pas hors de `racing` et `finished` (le podium est une scène figée) » ;
    - import : `import { DisplayedRank, podiumView, progressFraction, type PodiumView } from './cars/ranking';` ;
    - champ : `finishShown` remplacé par `/** Classement final montré au podium, calculé une fois à l'entrée ; null avant. */ private podiumData: PodiumView | null = null;` ; dans `newRace`, `this.finishShown = false;` → `this.podiumData = null;` et le commentaire de `newRace` dit « podium oublié » au lieu de « calque ARRIVÉE retiré » ;
    - `GameOptions.version` : commentaire `v1.2.0` ;
    - getters, après `airHeight` :

```ts
/** Podium (debug, e2e, tâche 11) : ids dans l'ordre du classement final, place et temps de Galahad ; null avant le podium. */
get podium(): { order: string[]; galahadPlace: number; time: number } | null {
  const v = this.podiumData;
  return v && { order: v.places.map((p) => p.id), galahadPlace: v.galahadPlace, time: v.galahadTime };
}
/** Confettis en vol (debug, e2e, tâche 11). */
get confetti(): number { return this.effects.confettiCount; }
```

    - `frame` : `case 'racing': case 'finished':` → `raceFrame` ; nouveau `case 'podium': this.podiumFrame(elapsed); break;` ; commentaire de `frame` : « podium (scène figée, confettis) » ;
    - `raceFrame`, après `this.present(now, elapsed, events, frame);` :

```ts
// Roue libre finie (FINISH_COAST_SECONDS de temps de course après l'arrivée de Galahad : les copains ont roulé) : podium.
if (this.machine.phase === 'finished' && this.finishTime !== null && this.sim.time >= this.finishTime + this.cfg.FINISH_COAST_SECONDS) {
  this.enterPodium(this.finishTime);
}
```

    - `present` : les l. 547–552 (calque ARRIVÉE) sont retirées ;
    - nouvelles méthodes :

```ts
/**
 * Entrée au podium (tâche 11 ; spec §4, §6, §8) : classement final calculé une fois (`podiumView` sur `rankCars` : les
 * copains non arrivés sont classés par progression), HUD de course et bouton saut cachés, écran du podium avec les petites
 * voitures peintes par `drawCar`, confettis si Galahad est 1er. Plus aucun pas ensuite (`podiumFrame`).
 */
private enterPodium(galahadTime: number): void {
  if (!this.send('podium')) return;
  const { sim } = this;
  const view = podiumView(rankEntriesOf(sim), this.pilots, GALAHAD_INDEX, galahadTime);
  this.podiumData = view;
  this.jumpInput.clear();
  this.hud.setRaceVisible(false);
  this.jumpButton.setVisible(false);
  this.screens.showPodium(view, (canvas, p) => this.renderer.paintCarIcon(canvas, sim.cars[p.index].pilot));
  if (view.galahadPlace === 1) this.effects.startConfetti();
}

/**
 * Une image du podium : aucun pas ; la scène de course aux poses du dernier pas, caméra immobile (temps écoulé nul pour
 * elle) ; seuls les confettis tombent, au-dessus du haut de l'écran, sur la largeur visible.
 */
private podiumFrame(elapsed: number): void {
  const { sim, camera } = this;
  const half = this.renderer.visibleHalfWidthM(camera);
  this.effects.rainConfetti(elapsed, camera.x, camera.y + this.cfg.VISIBLE_HEIGHT_M / 2, half);
  this.effects.update(elapsed, sim.track, camera.x, half);
  const scene = presentFrame(sim, { poses: this.loop.history.at(1), alpha: 1 }, camera, 0);
  this.renderer.draw(scene, camera, this.effects);
}
```

  - `src/ui/hud.ts` : retirer `showFinished`, l'utilitaire privé `button`, et les règles `.hud-title`, `.hud-big`, `.hud-buttons`, `.hud-again`, `.hud-menu` ; l'en-tête (l. 4 et l. 6) parle du « message d'erreur » à la place du « calque d'arrivée (ENCORE, MENU) » ; le commentaire de `hide()` : « Retire le message d'erreur ».
  - `src/loop/states.ts` l. 30–31 : « `podium` est atteint 1,5 s (temps de course) après l'arrivée de Galahad (tâche 11) ».
  - `package.json` : `"version": "1.2.0"`.
  - `npm run typecheck` → 0 ; `npm test` → tout vert (≈ 3 min).

- [ ] **Step 12 : Mutants à tuer avant de commiter** (chacun réécrit puis restauré, le test cité doit rougir) : podium dès l'arrivée, sans roue libre (« FINISH_COAST_SECONDS de roue libre ») ; `case 'podium'` qui appelle `raceFrame` (« aucun pas ensuite ») ; `podiumView` recalculé à chaque image (« classement figé ») ; confettis pour toute place (« Galahad 4e … aucun confetti ») ; confettis jamais lancés (« Galahad 1er → confettis ») ; `Effects.clear` qui n'arrête pas la pluie (« clear() arrête la pluie ») ; `hud.setRaceVisible(false)` oublié à l'entrée au podium (« HUD de course … cachés ») ; ENCORE sans `data-no-pedal` ; ENCORE sans écouteur `pointerdown` (« onAgain au pointerdown ET au click ») ; MENU au `pointerdown` (« onMenu au click seul ») ; reste de pluie sans `CONFETTI_EPS` (« plus aucun nouveau ») ; `presentFrame(…, elapsed)` au podium (« caméra immobile ») ; `textContent` des prénoms remplacé par `innerHTML` (« prénom à balises ») ; case de Galahad montrée quand il est 3e ; marches dans l'ordre 1, 2, 3.

- [ ] **Step 13 : Commit** : `git commit -m "feat: podium 1,5 s après l'arrivée (scène figée, classement final, confettis si Galahad gagne), calque ARRIVÉE retiré, version 1.2.0" -- src/game.ts src/ui/hud.ts src/loop/states.ts package.json tests/game-screens.test.ts tests/game-frame.test.ts`

- [ ] **Step 14 : Empreinte et frontière de la simulation** :

```bash
npx vitest run tests/empreinte.test.ts tests/ranking.test.ts tests/deps.test.ts
git diff --stat <BASE> -- src/sim src/physics src/track src/cars src/ai src/config.ts src/loop
```

Expected : `empreinte` 6/6 (`FROZEN`, `FROZEN_CONFIG` inchangés), `ranking` et `deps` verts ; le diff ne montre que `src/cars/ranking.ts` (+ `PodiumPlace`, `PodiumView`, `podiumView`, import de `pilots`) et `src/loop/states.ts` (commentaire).

---

## Partie 4 — Bout en bout (Steps 15 à 18)

**Files:**
- Create: `e2e/podium.spec.ts`
- Modify: `e2e/helpers.ts`, `e2e/race.spec.ts`

- [ ] **Step 15 : Aides et `race.spec.ts`.**
  - `e2e/helpers.ts` : `collectErrors` déplacé tel quel depuis `race.spec.ts` (l. 23–31, exporté) ; `MAX_HOLD_S` et `driveToFinish` déplacés et adaptés :

```ts
/** Durée maximale doigt posé pour finir une piste de 300 m. */
export const MAX_HOLD_S = 90;

/**
 * Doigt posé par tranches de `chunkS` s jusqu'à l'arrivée de Galahad (au plus MAX_HOLD_S) ; rend dès que l'état n'est
 * plus `racing` : `finished`, ou déjà `podium` (tâche 11) si la dernière tranche a duré plus que la roue libre (1,5 s).
 */
export async function driveToFinish(page: Page, chunkS = 5): Promise<void> {
  const deadline = Date.now() + MAX_HOLD_S * 1000;
  while ((await gameState(page)).state === 'racing' && Date.now() < deadline) await holdFinger(page, chunkS);
  await page.waitForFunction(() => ['finished', 'podium'].includes((window as any).__game.state), null, { timeout: 1_000 });
}
```

  - `e2e/race.spec.ts` : en-tête « … course courte jusqu'à l'arrivée (le podium : `podium.spec.ts`), captures » ; import de `collectErrors`, `driveToFinish` depuis `./helpers`, définitions locales retirées ; le test « course courte : arrivée et calque ARRIVÉE, sans erreur console » (l. 224–237) est **supprimé** (repris par `podium.spec.ts`, A14) ; le test « captures » devient « captures : course.png, course-copains-arrivee.png (Galahad au drapeau), puis podium » : les l. 258–261 (`ARRIVÉE`, `ENCORE`, `MENU`, `arrivee.png`) sont remplacées par `await waitForState(page, 'podium', 5_000);` et `await expect(page.locator('.screen-podium')).toBeVisible();`.

- [ ] **Step 16 : Écrire `e2e/podium.spec.ts`.**

```ts
// Podium (plan B, tâche 11) sur la tablette simulée : course courte (?len=300) jusqu'au podium, 1,5 s après l'arrivée ;
// trois marches (prénoms du classement final), temps de Galahad, ENCORE et MENU ; Galahad 4e à côté du podium, à 1280 × 800
// puis 844 × 390 ; doigt de gaz encore posé + ENCORE (deux doigts) ; captures podium.png, podium-4e.png, podium-telephone.png.
import { expect, test, type Page } from '@playwright/test';
import {
  SHOTS, boxOf, collectErrors, driveToFinish, gameState, pilotIds, startRace, tapAt, waitForGame, waitForState, type Box,
} from './helpers';

type Podium = { order: string[]; galahadPlace: number; time: number };
const podiumOf = (page: Page) => page.evaluate(() => (window as any).__game.podium as Podium | null);
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Mise en page : temps, marches, case de Galahad (si montrée) et boutons dans la fenêtre, sans recouvrement ; boutons ≥ 96 px. */
async function expectPodiumLayout(page: Page): Promise<void> {
  const { width, height } = page.viewportSize()!;
  const blocks: [string, Box][] = [
    ['temps', await boxOf(page, '.podium-time')], ['marches', await boxOf(page, '.podium-row')],
    ['ENCORE', await boxOf(page, '.btn-again')], ['MENU', await boxOf(page, '.btn-menu')],
  ];
  if (await page.locator('.podium-me').isVisible()) blocks.push(['case de Galahad', await boxOf(page, '.podium-me')]);
  for (const [label, b] of blocks) {
    expect(b.x, label).toBeGreaterThanOrEqual(0);
    expect(b.y, label).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, label).toBeLessThanOrEqual(width);
    expect(b.y + b.height, label).toBeLessThanOrEqual(height);
  }
  for (const [label, b] of blocks.slice(2, 4)) expect(Math.min(b.width, b.height), label).toBeGreaterThanOrEqual(96);
  // La case de Galahad est dans la rangée des marches : on compare temps, rangée et boutons.
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    expect(overlap(blocks[i][1], blocks[j][1]), `${blocks[i][0]} et ${blocks[j][0]} se recouvrent`).toBe(false);
  }
}

test('course courte jusqu’au podium : 1,5 s de roue libre, puis marches du classement final, temps de Galahad, ENCORE et MENU ; aucun pas ; confettis si Galahad 1er ; sans erreur console ; capture podium.png ; ENCORE → même course', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  await driveToFinish(page, 0.5);
  expect((await gameState(page)).state).toBe('finished');
  await expect(page.locator('.screen-podium')).toBeHidden();
  await waitForState(page, 'podium', 5_000);
  const podium = (await podiumOf(page))!;
  const t = (await gameState(page)).time;
  await page.waitForTimeout(500);
  expect((await gameState(page)).time, 'aucun pas au podium').toBe(t);
  const pilots: [string, string][] = await page.evaluate(() => (window as any).__game.pilots.map((p: { id: string; name: string }) => [p.id, p.name]));
  const nameOf = new Map(pilots);
  expect(await page.locator('.podium-step .podium-name').allTextContents()).toEqual([1, 0, 2].map((k) => nameOf.get(podium.order[k])));
  await expect(page.locator('.podium-time')).toHaveText(/^\d\d:\d\d$/);
  await expectPodiumLayout(page);
  if (podium.galahadPlace === 1) {
    await expect(page.locator('.step-1')).toHaveClass(/is-galahad/);
    await page.waitForFunction(() => (window as any).__game.confetti > 20);
  } else {
    test.info().annotations.push({ type: 'podium', description: `Galahad ${podium.galahadPlace}e sur seed=1 len=300` });
  }
  await page.waitForTimeout(800);   // pluie bien lancée pour la capture
  await page.screenshot({ path: `${SHOTS}/podium.png`, fullPage: true });
  const ids = await pilotIds(page);
  const seed = (await gameState(page)).seed;
  await tapAt(page, '.btn-again');
  await waitForState(page, 'countdown', 2_000);
  await expect(page.locator('.screen-podium')).toBeHidden();
  expect(await pilotIds(page)).toEqual(ids);
  const after = await gameState(page);
  expect(after.seed).toBe(seed);
  expect(after.time).toBe(0);
  expect(errors).toEqual([]);
});

test('doigt de gaz encore posé à l’arrivée + tap sur ENCORE de l’autre doigt : décompte ; le doigt sur ENCORE n’est pas du gaz', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  // Doigt A posé en course (gaz) et GARDÉ jusqu'au podium : avec lui sur l'écran, le `click` d'un second doigt ne part pas
  // toujours ; ENCORE doit répondre au `pointerdown` (A7).
  const { width, height } = page.viewportSize()!;
  const a = { x: width / 2, y: height / 2, id: 0 };
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
    await page.waitForFunction(() => (window as any).__game.state === 'podium', null, { timeout: 120_000 });
    expect(await page.evaluate(() => (window as any).__game.throttlePressed), 'doigt A toujours posé').toBe(true);
    const e = await boxOf(page, '.btn-again');
    const b = { x: e.x + e.width / 2, y: e.y + e.height / 2, id: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] });
    await waitForState(page, 'countdown', 2_000);
    // A levé, B encore posé sur ENCORE (caché sous le doigt, jamais retiré du DOM) : plus de gaz.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [b] });
    expect(await page.evaluate(() => (window as any).__game.throttlePressed), 'le doigt sur ENCORE n’est pas du gaz').toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  expect((await gameState(page)).state).toBe('countdown');   // le click éventuel du doigt B n'a rien relancé
});

test('Galahad 4e : sa place à côté du podium, pas de confettis ; tient en 844 × 390 ; MENU → titre ; captures podium-4e.png, podium-telephone.png', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./?seed=1&len=300&debug=1');
  await waitForGame(page);
  await startRace(page);
  // Trois copains déclarés arrivés dès le départ par la poignée de débogage (A12) : ils freinent sur la grille derrière
  // Galahad ; le quatrième, poli, reste derrière eux. Seul chemin déterministe vers « Galahad 4e ».
  await page.evaluate(() => { const g = (window as any).__game; for (const i of [1, 2, 3]) g.sim.cars[i].state.finishedAt = 0.1 * i; });
  await driveToFinish(page);
  await waitForState(page, 'podium', 5_000);
  expect((await podiumOf(page))!.galahadPlace).toBe(4);
  await expect(page.locator('.podium-me')).toBeVisible();
  await expect(page.locator('.podium-me-place')).toHaveText('4e');
  await expect(page.locator('.podium-me .podium-name')).toHaveText('Galahad');
  await expect(page.locator('.podium-step.is-galahad')).toHaveCount(0);
  await expectPodiumLayout(page);
  expect(await page.evaluate(() => (window as any).__game.confetti)).toBe(0);
  await page.screenshot({ path: `${SHOTS}/podium-4e.png`, fullPage: true });
  // Téléphone en paysage : sortir du plein écran (accordé au pointerup de JOUER) avant de changer la fenêtre.
  await page.evaluate(() => document.exitFullscreen?.().catch(() => {}));
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(844);
  expect((await gameState(page)).state).toBe('podium');
  await expectPodiumLayout(page);
  await page.screenshot({ path: `${SHOTS}/podium-telephone.png`, fullPage: true });
  await tapAt(page, '.btn-menu');
  await waitForState(page, 'title', 2_000);
  await expect(page.locator('.screen-title')).toBeVisible();
  await expect(page.locator('.screen-podium')).toBeHidden();
});
```

- [ ] **Step 17 : Suites complètes, build sous la base, aperçu** :

```bash
npm run typecheck && npm test
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
VITE_BASE=/Galahad-s-car-game/ npm run build && grep -o 'v1\.2\.0\|1\.2\.0' dist/assets/index-*.js | head -1
VITE_BASE=/Galahad-s-car-game/ npx vite preview --port 4174 --strictPort   # en arrière-plan
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers E2E_LIVE_URL=http://localhost:4174/Galahad-s-car-game/ npx playwright test -c playwright.live.config.ts e2e/podium.spec.ts
```

Expected : typecheck 0 ; `npm test` tout vert (≈ 3 min, +1 fichier : `tests/podium.test.ts`) ; `npm run e2e` : **29 passed** (27 d'avant − « course courte » + les 3 de `podium.spec.ts`) ; la version dans le bundle ; les 3 e2e du podium verts **sous la base** (sprites servis sous `/Galahad-s-car-game/` : petites voitures en images). Mesurer et noter au registre : place de Galahad sur `seed=1&len=300` (attendu 1er ; sinon l'annotation du test le dit et `podium.png` reste valable), temps d'image au podium (`?debug=1`, fps) avec et sans confettis. Arrêter l'aperçu.

- [ ] **Step 18 : Commit** : `git add e2e/podium.spec.ts && git commit -m "test: e2e du podium (course courte, Galahad 4e, téléphone, ENCORE à deux doigts) ; driveToFinish et collectErrors partagés" -- e2e`

---

## Partie 5 (optionnelle) — Bouton pause en course (Steps 19 à 23)

**À faire seulement si le papa répond (a) à Q1.** Réponse (b) : la Partie devient une tâche à part après le jalon « démo tablette », avec ce texte pour plan ; réponse (c) : rien. Sans cette Partie, les Steps 19 à 23 sont cochés « sans objet » et la numérotation ne change pas.

**Files:**
- Create: `src/ui/pause-button.ts`
- Modify: `src/game.ts`, `tests/game-screens.test.ts`, `e2e/screens.spec.ts`, `e2e/helpers.ts` (`hudLayout`), `e2e/race.spec.ts` (`expectHudLayout`)

**Interfaces :**

```ts
// src/ui/pause-button.ts
export class PauseButton {
  readonly el: HTMLButtonElement;   // button.pause-button, data-no-pedal, aria-label « Pause », caché à la création
  /** Crée le bouton dans `root` (#hud) et injecte le style une fois (`pause-button-style`) ; `onPause` au pointerdown ET au click. */
  constructor(root: HTMLElement, onPause: () => void);
  setVisible(visible: boolean): void;
}
```

Règles (décisions recommandées, à confirmer par Q2 et Q3) : sous le chrono, en haut à droite (pas en bas : le bouton saut est en bas à gauche, la main droite pose le gaz en bas à droite) ; 96 × 96 px, coins arrondis, fond sombre translucide, deux barres blanches ; visible pendant le **décompte et la course**, caché au titre, en pause, à l'arrivée, au podium, en erreur ; `data-no-pedal` (son tap n'est jamais du gaz) ; il appelle la même `pause()` que le geste retour (calque PAUSE, REPRENDRE, reprise par un décompte à 3). Il amende spec §8 « aucun bouton pendant la course » et addendum §2 (« hormis le saut ») : décision du papa du 2026-10-25.

- [ ] **Step 19 : Tests** dans `tests/game-screens.test.ts` :

```ts
test('bouton pause (option) : caché au titre ; visible au décompte et en course ; tap → PAUSE + REPRENDRE, sim figée, pas de gaz ; caché en pause, à l’arrivée et au podium ; REPRENDRE le rend', () => {
  const { game, q, internals } = makeGame();
  game.start();
  const btn = q('.pause-button');
  expect(btn.hidden).toBe(true);
  expect(btn.hasAttribute('data-no-pedal')).toBe(true);
  let now = startRacing(game, () => raf!);
  expect(btn.hidden).toBe(false);
  now = frames(60, now);
  const t0 = internals().sim.time;
  pointer('pointerdown', 6, btn);
  expect(game.state).toBe('paused');
  expect(internals().throttle.pressed).toBe(false);
  expect(q('.pause-text').textContent).toBe('PAUSE');
  expect(btn.hidden).toBe(true);
  pointer('pointerup', 6, btn);
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // le click qui suit le doigt : sans effet en pause
  expect(game.state).toBe('paused');
  now = frames(30, now);
  expect(internals().sim.time).toBe(t0);
  q('.btn-resume').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(btn.hidden).toBe(false);
  pointer('pointerdown', 7, btn);   // pause pendant le décompte aussi
  expect(game.state).toBe('paused');
  pointer('pointerup', 7, btn);
  game.resume();
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  now = driveToFinished(game, internals, now);
  expect(btn.hidden).toBe(true);   // arrivée
  now = frames(Math.ceil(CONFIG.FINISH_COAST_SECONDS / DT) + 5, now);
  expect(game.state).toBe('podium');
  expect(btn.hidden).toBe(true);
});

test('bouton pause (option) : ≥ 96 px déclarés, règle .pause-button[hidden]{display:none}, au-dessus du HUD et sous les écrans (ordre du DOM)', () => {
  const { game, root } = makeGame();
  game.start();
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  const base = rules.find((r) => r.selectorText === '.pause-button')!;
  expect(base.style.display).toBe('flex');
  expect(parseFloat(base.style.width)).toBeGreaterThanOrEqual(96);
  expect(parseFloat(base.style.height)).toBeGreaterThanOrEqual(96);
  expect(rules.find((r) => r.selectorText === '.pause-button[hidden]')?.style.display).toBe('none');
  const kids = [...root.children];
  expect(kids.indexOf(root.querySelector('.pause-button')!)).toBeLessThan(kids.indexOf(root.querySelector('.screen-pause')!));
});
```

- [ ] **Step 20 : Vérifier l'échec** : `npx vitest run tests/game-screens.test.ts` → FAIL (`.pause-button` absent).

- [ ] **Step 21 : Implémenter.**
  - `src/ui/pause-button.ts` :

```ts
// Bouton pause en course (plan B, tâche 11, Partie 5 ; demande du papa après le test tablette de la tâche 10) : sous le
// chrono, en haut à droite, visible pendant le décompte et la course seulement (`Game`). data-no-pedal : son tap n'est jamais
// du gaz (`Throttle`) ; il met en pause comme le geste retour (calque PAUSE, REPRENDRE, reprise par un décompte à 3).
const STYLE_ID = 'pause-button-style';
/** Sous le chrono de `hud.ts` (top clamp(6px,1.25vw,16px), police clamp(26px,5vw,64px)), même marge droite. */
const CSS = `
.pause-button{position:absolute;top:calc(clamp(6px,1.25vw,16px) + 1.25 * clamp(26px,5vw,64px) + 8px);
  right:clamp(10px,2.2vw,28px);width:96px;height:96px;padding:0;margin:0;border-radius:24px;border:4px solid #fff;
  background:#0007;display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none;
  -webkit-tap-highlight-color:transparent;cursor:pointer;box-shadow:0 4px 0 #0008}
.pause-button[hidden]{display:none}
.pause-button svg{width:44%;height:44%;pointer-events:none}
`;
const PAUSE_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <rect x="14" y="10" width="13" height="44" rx="3" fill="#fff"/><rect x="37" y="10" width="13" height="44" rx="3" fill="#fff"/>
</svg>`;

export class PauseButton {
  readonly el: HTMLButtonElement;

  constructor(root: HTMLElement, onPause: () => void) {
    const doc = root.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      doc.head.appendChild(style);
    }
    const el = doc.createElement('button');
    el.type = 'button';
    el.className = 'pause-button';
    el.setAttribute('data-no-pedal', '');
    el.setAttribute('aria-label', 'Pause');
    el.innerHTML = PAUSE_SVG;
    el.hidden = true;
    // Au pointerdown (tout de suite, même avec un doigt de gaz posé ailleurs) et au click (clavier) ; `Game` ignore le doublon.
    // `blur` : un Espace tapé ensuite au clavier reste un saut, pas un nouveau click sur ce bouton.
    const fire = (): void => { el.blur(); onPause(); };
    el.addEventListener('pointerdown', fire);
    el.addEventListener('click', fire);
    root.appendChild(el);
    this.el = el;
  }

  setVisible(visible: boolean): void {
    this.el.hidden = !visible;
  }
}
```

  - `src/game.ts` : champ `private readonly pauseButton: PauseButton;` créé **après** `jumpButton` et **avant** `Screens` (le voile de pause le couvre) : `this.pauseButton = new PauseButton(hudRoot, () => this.pause());`. Visibilité : `setVisible(true)` dans `beginCountdown` (avant le `if (this._portrait) this.pause()`) ; `setVisible(false)` dans `pause()` (après le `send` réussi), `showTitle()`, `fail()`, `enterPodium()`, et dans `step()` juste après `this.send('finish')`.
  - `npm run typecheck` → 0 ; `npx vitest run tests/game-screens.test.ts tests/hud.test.ts tests/game-frame.test.ts` → vert.

- [ ] **Step 22 : e2e.**
  - `e2e/helpers.ts` : `HudLayout` gagne `pause: Box | null` (null si `.pause-button` est caché) ; `hudLayout` le lit (`el.hidden ? null : box(el)`).
  - `e2e/race.spec.ts`, `expectHudLayout` : si `l.pause` n'est pas nul, `['bouton pause', l.pause]` rejoint `blocks` (aucun recouvrement avec position, barre, drapeau, chrono, bouton saut) et `expect(Math.min(l.pause.width, l.pause.height)).toBeGreaterThanOrEqual(96)` ; les tests « HUD … » à 1280 × 800 et 844 × 390 le vérifient en course.
  - `e2e/screens.spec.ts`, nouveau test :

```ts
test('bouton pause en course : tap → PAUSE, course figée, le tap n’est pas du gaz ; REPRENDRE → décompte → course ; capture pause-bouton.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await startRace(page);
  await waitForRaceTime(page, 0.5);
  const btn = await boxOf(page, '.pause-button');
  expect(Math.min(btn.width, btn.height)).toBeGreaterThanOrEqual(96);
  await page.screenshot({ path: `${SHOTS}/pause-bouton.png`, fullPage: true });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: btn.x + btn.width / 2, y: btn.y + btn.height / 2 }] });
    await waitForState(page, 'paused', 2_000);
    expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  await expect(page.locator('.pause-text')).toHaveText('PAUSE');
  await expect(page.locator('.pause-button')).toBeHidden();
  const { time: t1, progress: x0 } = await gameState(page);
  await page.waitForTimeout(700);
  expect((await gameState(page)).time).toBe(t1);
  await tapAt(page, '.btn-resume');
  await waitForState(page, 'countdown', 2_000);
  await expect(page.locator('.pause-button')).toBeVisible();
  await waitForState(page, 'racing', 6_000);
  expect(Math.abs((await gameState(page)).progress - x0)).toBeLessThan(0.3);
});
```

- [ ] **Step 23 : Suites et commit** : `npm run typecheck && npm test` ; `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e` → **30 passed**. Commit : `git add src/ui/pause-button.ts && git commit -m "feat: bouton pause en course et pendant le décompte (demande du papa)" -- src/ui/pause-button.ts src/game.ts tests/game-screens.test.ts e2e/screens.spec.ts e2e/helpers.ts e2e/race.spec.ts`

---

## Partie 6 — Relectures, tours, validation, passation, fusion (Steps 24 à 31)

- [ ] **Step 24 : Quatre relectures** du diff `<BASE>..HEAD` (`<BASE>` = `5bc711d` recopié), par des sous-agents frais qui reçoivent ce plan, la spec §4, §6, §8, l'addendum §2 et §5, la passation, et la consigne de ne lancer aucun test dans l'arbre partagé tant que l'implémenteur y travaille (worktree du scratchpad avec lien `node_modules` sinon).
  - **Standard** (spec et qualité) : chaque ligne des Global Constraints pointe sur du code et un test ; rien ne reste du calque ARRIVÉE (`grep -rn "ARRIVÉE\|hud-again\|hud-menu\|showFinished" src tests e2e` ne rend que des commentaires historiques, s'il en reste).
  - **Adversariale.** Mutants (chacun réécrit puis restauré, le test cité doit rougir) : ceux du Step 12 ; `rankCars` sans tri des non-arrivés ; `podiumView` qui prend `pilots[k]` au lieu de `pilots[index]` ; marche de Galahad non surlignée ; temps de la course au lieu du temps d'arrivée (`sim.time` au podium) ; `paintCarIcon` qui écrit le prénom ; `paintCarIcon` sans `clearRect` (deux voitures superposées au second podium) ; voile du podium sans `data-no-pedal` ; `.podium-me` sans `hidden` à la création ; `Effects.clear` oublié à `newRace` ; rendu du podium qui fait avancer la caméra (`presentFrame(…, elapsed)`) ; `MAX_PARTICLES` dépassé par la pluie. Sondes : podium en portrait (390 × 844, repli A11 : tout dans la fenêtre, sans recouvrement, capture) ; captures du podium à 3 graines (`?seed=2&len=300`, `?seed=5&len=300`, `?seed=18&len=300`) ; Galahad 2e et 3e (deux copains, puis un, déclarés arrivés) ; temps d'image au podium avec la pluie (≤ celui d'une image de course) ; ENCORE → podium → MENU → JOUER × 3 sans écouteur ni toile en trop (`document.querySelectorAll('canvas').length` stable) ; geste retour au podium ; images absentes (`page.route('**/sprites/*.png', r => r.abort())`) : petites voitures par code, sans exception. **Partie 5 si faite** : ⏸ sans `data-no-pedal` ; ⏸ visible au podium ; ⏸ sous le voile de pause (ordre du DOM) ; doigt de gaz tenu + tap ⏸ + REPRENDRE : la voiture repart à PARTEZ avec le doigt, jamais à cause du tap.
  - **Skill `code-review`** (niveau `high`).
  - **Skill `security-review`.** Points : prénoms en `textContent` ; `innerHTML` réservé aux SVG constants (médailles construites par `medal()` sur des arguments constants) ; aucune nouvelle entrée lue de l'URL ; l'écriture de `__game.sim` n'existe que dans un e2e, sous `?debug=1` ; aucune requête hors du site.

- [ ] **Step 25 : Tours de correction** (≤ 5). Chaque constat retenu est corrigé avec son test. Puis `npm run typecheck && npm test`, et `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e` si un écran ou le câblage a changé. Commit `fix: <constat> (tour n de la tâche 11)`. Re-relecture ciblée des constats.

- [ ] **Step 26 : Validation du papa sur capture, AVANT la fusion** (ruling R8b-2) : `e2e/screenshots/podium.png`, `podium-4e.png`, `podium-telephone.png` (et `pause-bouton.png` si la Partie 5 est faite). Questions Q4 à Q6. Un réglage demandé donne un commit `fix:` et une nouvelle capture. Chaque réponse va au registre (« DÉCISION PAPA (date) : … »).

- [ ] **Step 27 : Passation et registre.**
  - **Passation** (`docs/superpowers/handoff/2026-10-21-plan-b-passation.md`) : puce « Tâche 11 faite » dans « Où en est-on » (commits, fichiers, décisions, tests et e2e comptés, mesures du Step 17), ligne 11 du tableau (et une ligne « pause en course » si la Partie 5 est faite ou reportée), « Prochaine action précise » → **jalon « démo tablette »** (addendum §6 : Galahad lance une course seul depuis le titre, reconnaît les voitures, voit le podium ; le papa filme 30 s ; lien de la vidéo dans la passation), puis 11c (plan C, régime physique), 12, 13… ; « Leçons de la session ».
  - **Registre** (`docs/superpowers/handoff/sdd-ledger-plan-b.md`) : **3 à 5 lignes** « Task 11: … » en plus de la ligne `BASE` du départ : commits ; mesures (place de Galahad sur `seed=1&len=300`, temps d'image au podium, e2e comptés) ; choix qui s'écartent du plan avec leur coût ; verdicts des relectures et tours ; à dire au papa.

```bash
git commit -m "docs: tâche 11 (podium), passation et registre" -- docs/superpowers/handoff/2026-10-21-plan-b-passation.md docs/superpowers/handoff/sdd-ledger-plan-b.md docs/superpowers/plans/2026-10-25-plan-b-podium.md
```

- [ ] **Step 28 : Fusion en avance rapide, push, CI, site en ligne.** Aucun sous-agent dans l'arbre à ce moment.

```bash
git status -sb
git fetch origin ccr-5b6fabc4-n96ofo
git checkout -B ccr-5b6fabc4-n96ofo origin/ccr-5b6fabc4-n96ofo
git merge --ff-only wip-plan-b
git push -u origin ccr-5b6fabc4-n96ofo                 # session en mode « accepter les modifications »
# run GitHub Actions (outils mcp__github__actions_list / actions_get) : attendre « completed success »
VITE_BASE=/Galahad-s-car-game/ npm run build && ls dist/assets   # hash du index-*.js local
curl -s https://i-dmk.github.io/Galahad-s-car-game/ | grep -o 'index-[A-Za-z0-9_-]*\.js'   # même hash
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live   # 29 verts (30 avec la Partie 5), podium.spec compris
git checkout wip-plan-b && git merge --ff-only ccr-5b6fabc4-n96ofo && git push -u origin wip-plan-b
```

Expected : run vert ; hash du bundle servi = hash du build local à la même base ; `e2e:live` tout vert ; captures du site dans `test-results/live-screenshots/` (dont `podium.png`).

- [ ] **Step 29 : Tablette et jalon « démo tablette ».** Le papa regarde une course jusqu'au podium (fps avec `?debug=1`, confettis), ENCORE et MENU, Galahad hors podium s'il arrive (sinon la capture `podium-4e.png` suffit), le bouton pause si la Partie 5 est faite ; puis le **jalon** : Galahad seul, du titre au podium, filmé 30 s. Réponses au registre ; un réglage → `fix:`, nouvelle fusion (Step 28).

- [ ] **Step 30 : Clôture.** Passation « 11 validée » (et jalon fait, lien de la vidéo), registre « Task 11: complete … VALIDÉE par le papa le … ; déploiement vérifié (run n) », commit `docs:`, fusion et push comme au Step 28.

- [ ] **Step 31 : Prévenir les sessions actives** s'il en est (`git ls-remote`, sessions) : nouvelle tête et fichiers touchés (`send_message`, priorité « later »).

---

## Performance

- Podium : une image = la scène de course (comme une image de pause, sans pas) + au plus ≈ 160 confettis (`fillRect` chacun, `CONFETTI_SECONDS` × `CONFETTI_PER_SECOND`), sous le plafond `MAX_PARTICLES` (300) : moins qu'une image de course, qui fait aussi les pas de cinq voitures.
- Petites voitures : 3 ou 4 toiles de ≈ 320 × 160 px (DPR 2) peintes **une fois** à l'entrée au podium ; aucune allocation par image.
- Rien n'est ajouté dans la boucle de course ; `podiumView` alloue 5 objets une fois par course.
- Partie 5 : un bouton DOM de plus, aucun coût par image.

## Ce que la tâche 11 ne fait pas

- Le son : bouton son au podium, trompette de l'arrivée, musique (tâche 12).
- Les temps des copains, un record mémorisé, un classement entre courses.
- La règle globale `[hidden]{display:none!important}` (mineur reporté de la 10) : les nouvelles règles restent par composant, comme aujourd'hui.
- Le cache des images et de la police, le manifeste (tâche 13) ; les obstacles du plan C (tâche 11c, après le jalon).
- Rien de la simulation ni de la piste.

## Ambiguïtés et choix

| # | Choix | Pourquoi | Coût si faux |
|---|---|---|---|
| A1 | Le podium **remplace** le calque ARRIVÉE ; `Hud.showFinished`, son bouton et son CSS sont retirés ; pas de mot « ARRIVÉE » | décision Q2 de la 10 (« le podium de la 11 remplacera le calque ») ; code mort sinon | un titre à ajouter sur le podium |
| A2 | Instant du podium : `sim.time ≥ finishTime + FINISH_COAST_SECONDS` (temps de course, comme le calque d'aujourd'hui), pas l'horloge murale | spec §5 « chrono basé sur le temps simulé » ; la roue libre est un temps de course ; tablette lente → même course | nul |
| A3 | **Aucun pas au podium** : scène figée aux poses du dernier pas, caméra immobile, seuls les confettis bougent ; le `case 'podium'` qui menait à `raceFrame` est remplacé | plan 10 « aucun pas hors de `racing` et `finished` » ; le classement est figé, des copains qui passeraient la ligne derrière l'écran le contrediraient ; captures déterministes ; moins de calcul sur la tablette | fond immobile ; une ligne pour le faire vivre (Q5) |
| A4 | Classement calculé **une fois** à l'entrée (`podiumView`), copains non arrivés par progression à cet instant | spec §6 ; plan v2.1 ; aucune place qui change sous les yeux de Galahad | nul |
| A5 | Podium en DOM (`Screens`), voitures en petites toiles peintes une fois par `drawCar` (sprites et roues), plutôt qu'une scène canvas comme le titre | mise en page robuste (téléphone), tests jsdom simples, mêmes voitures qu'en course (jalon : « reconnaît les voitures ») ; un sprite en `<img>` serait sans roues | 3 ou 4 toiles ; une scène canvas reste possible |
| A6 | Confettis dans `Effects`, en coordonnées du monde, pluie de 4 s au-dessus de l'écran ; constantes visuelles dans `effects.ts`, pas dans `CONFIG` | plan v2.1 Task 11 (« `src/render/effects.ts` ») ; spec §8 « Rendu » ; comme `SPARK_GRAVITY`, ce ne sont pas des réglages de jeu | réglages à la capture (Q6) |
| A7 | ENCORE au `pointerdown` ET au `click`, `data-no-pedal` ; voile du podium entier `data-no-pedal` | décision Q2 de la 10 ; un doigt de gaz peut rester posé quand le podium arrive, et avec un second doigt le `click` ne part pas toujours (leçon de REPRENDRE) ; le doublon est sans effet (`countdown` n'a pas de ligne `again`) ; un doigt laissé sur le podium ne devient pas du gaz par ce tap (spec §4 « tap consommé ») | si le papa veut qu'un doigt gardé sur ENCORE soit du gaz (comme JOUER) : retirer un attribut |
| A8 | Temps de Galahad en mm:ss (`formatTime` du HUD) | le chrono de course est en mm:ss (spec §8) ; Galahad commence à lire | dixièmes à ajouter (Q6) |
| A9 | Galahad sur le podium : sa marche surlignée (prénom jaune, marche dorée) ; hors podium : une case à droite des marches avec « 4e » / « 5e », sa voiture et son prénom | spec §8 « sur le podium ou à côté avec sa place » | Q4 |
| A10 | HUD de course et bouton saut cachés au podium ; fps et compteur (debug) restent | le podium montre son propre temps ; aucun bouton de course hors course | nul |
| A11 | Au podium : geste retour → MENU (déjà câblé, A5 de la 10) ; onglet caché → rien ; **portrait → rien non plus** (pas de TOURNE : la table n'a pas de pause au podium), la feuille a un repli `orientation:portrait` (marches à 24vw, case de Galahad sous les marches) car la rangée de paysage (≈ 470 px) déborderait de 390 px | le podium est un écran immobile : rien à mettre en pause ; la tablette tournée au podium est rare et le manifeste de la tâche 13 fixera le paysage | repli vu seulement sur une sonde de la relecture adversariale (capture à 390 × 844), pas d'e2e dédié |
| A12 | e2e « Galahad 4e » : trois copains déclarés arrivés au départ par la poignée de débogage (`__game.sim`, `?debug=1`) | doigt posé depuis la pole, Galahad gagne presque toujours ; des copains polis ne le doublent pas s'il s'arrête : aucun chemin réel déterministe ; le vrai chemin est couvert par l'autre e2e et par jsdom | une écriture d'état dans un test ; rien dans le code livré |
| A13 | Version `1.2.0` dans `package.json` seul ; `package-lock.json` non touché | décision Q3 de la 10 ; la tâche 10 avait fait de même ; un `npm install` changerait le lock pour rien | nul (voir Écarts) |
| A14 | L'e2e « course courte » quitte `race.spec.ts` pour `podium.spec.ts` ; `race.spec.ts` « captures » finit au podium sans capture ; `arrivee.png` n'est plus produite | une course de 300 m de moins dans la suite (≈ 40 s) ; une capture d'un écran qui n'existe plus tromperait | nul |
| A15 | `driveToFinish` rend sur `finished` **ou** `podium` | une tranche de doigt de 5 s dépasse la roue libre de 1,5 s : l'état est déjà `podium` | nul |
| A16 | `drawCar` n'écrit pas un prénom vide (garde ajoutée) | la petite voiture du podium a son prénom en DOM | nul |
| A17 | `podiumView` accepte moins de trois voitures (marches vides cachées) | `createRaceSim` sans robots existe (tests) ; `Game` en a toujours cinq | nul |
| A18 | Le bouton pause n'est fait que sur réponse (a) à Q1 (Partie 5) | il amende spec §8 « aucun bouton pendant la course » : au papa de trancher | une Partie de plus ou de moins |
| A20 | MENU jamais au `pointerdown` ; **révisé au tour 1 (cr 2)** : MENU agit au `pointerup` du doigt posé sur MENU lui-même (et au `click`, clavier), et le click du même tap est avalé (capture sur `window`, 600 ms, usage unique) | au titre, AUTRE PISTE est presque à la même place que MENU : un MENU au `pointerdown` montrerait le titre sous le doigt et le `click` du tap partirait sur AUTRE PISTE. Au `click` seul, MENU ne répondait pas avec un doigt de gaz encore posé (le click ne part pas). Au `pointerup`, Chromium calcule encore le click du tap à l'endroit du doigt, sur le titre déjà montré : il tombait sur AUTRE PISTE (mesuré en e2e à 844 × 390), d'où l'avalement. Prouvé par les e2e « Galahad 4e … MENU → titre » (graine inchangée) et « doigt de gaz encore posé + tap sur MENU » | un vrai tap sur AUTRE PISTE moins de 600 ms après un MENU sans click (doigt de gaz tenu) serait perdu : irréalisable au doigt |
| A19 | (Partie 5) Bouton sous le chrono, en haut à droite, 96 px, visible au décompte et en course, `pointerdown` + `click` | en bas à gauche : le saut ; en bas à droite : la main du gaz ; en haut à gauche, à 844 px, la place manque entre la position et la barre (≈ 77 px) | Q2, Q3 |

## Questions pour le papa

Q1 à Q3 avant l'implémentation ; Q4 à Q6 sur capture (Step 26).

- **Q1 — le bouton pause en course que tu as demandé.**
  - (a) Dans la tâche 11 (Partie 5 de ce plan : ≈ 1 h de plus, un e2e de plus), **avant** le jalon « démo tablette ». **Recommandé** : Galahad doit pouvoir s'arrêter seul pendant la démo, et la pause existe déjà (onglet caché, retour, portrait) : il ne manque que le bouton.
  - (b) Une petite tâche à part, juste après le jalon : la 11 reste plus courte, la démo se fait sans bouton (pause par le geste retour).
  - (c) Pas maintenant : on garde « tout l'écran est la pédale, aucun bouton hormis le saut ».
- **Q2 — où le mettre** (si (a) ou (b)).
  - (a) En haut à droite, sous le chrono. **Recommandé** : loin du bouton saut (en bas à gauche) et de la main du gaz (en bas à droite) ; tient sur un téléphone.
  - (b) En haut, entre la barre et le chrono : plus discret, mais la place est juste sur un téléphone (≈ 106 px pour un bouton de 96).
  - (c) En bas à droite : le plus près du pouce, mais un appui de gaz qui glisse mettrait la course en pause.
- **Q3 — quand le montrer** (si (a) ou (b)).
  - (a) Pendant le décompte et la course. **Recommandé** : même pause dans les deux cas, comme le geste retour.
  - (b) Pendant la course seulement.
- **Q4 — Galahad hors du podium** (sur capture `podium-4e.png`).
  - (a) Une case à droite des marches : « 4e », sa voiture, son prénom. **Recommandé** : la spec dit « à côté avec sa place ».
  - (b) Deux petites marches basses pour le 4e et le 5e : tout le monde a sa marche.
  - (c) Une liste des cinq sous le podium.
- **Q5 — le fond du podium** (sur capture).
  - (a) La course figée derrière un voile léger, les confettis par-dessus. **Recommandé** : rien ne bouge que la fête, la capture est la même à chaque fois.
  - (b) La course continue derrière (les copains finissent leur course) : plus vivant, mais un copain qui passe la ligne derrière le podium n'y monte pas.
  - (c) Fond noir étoilé seul.
- **Q6 — réglages du podium** (sur capture, puis tablette) : taille du temps (mm:ss), hauteur des marches, médailles, petites voitures, confettis (4 s, seulement si Galahad gagne : spec).
  - (a) Bien.
  - (b) À régler : préciser (par exemple des confettis aussi pour une 2e ou 3e place, plus petits ; les dixièmes au temps).

## Écarts relevés entre les documents et le code

1. **`Game.frame` envoie la phase `podium` à `raceFrame`** (l. 396–400 : des pas de course continueraient au podium) alors que le plan 10 pose « aucun pas hors de `racing` et `finished` ». Inatteignable jusqu'ici ; corrigé par A3.
2. **Spec §8 « Podium … bouton son »** et §6 « trompette » : rendus à la tâche 12 (plan v2.1 Task 12 : « bouton son au titre et au podium »).
3. **Spec §8 « Aucun bouton pendant la course »** et addendum §2 « hormis le saut » contre la demande du papa du 2026-10-25 (bouton pause) : Partie 5 optionnelle, Q1.
4. **Plan v2.1 Task 11** : « ENCORE → `countdown` avec mêmes graines piste et pilotes ; MENU → `title` » est déjà fait à la tâche 10 (Q2) ; la 11 ne fait que remplacer le calque. Plan v2.1 Task 14 prévoit aussi « course courte jusqu'au podium » : couvert dès la 11 par `podium.spec.ts`.
5. **La table de `states.ts` garde `finished` → `again` / `menu`** (spec §4 : seulement depuis `podium`). Après la 11, aucun bouton ne les envoie depuis `finished` ; seul le geste retour pendant la roue libre mène à MENU (A5 de la 10). Table gardée telle quelle (aucun test à changer).
6. **`package-lock.json`** porte `"name": "i-dmk"`, `"version": "1.0.0"` alors que `package.json` porte `course-lunaire` `1.1.0` : la tâche 10 n'a pas touché le lock ; la 11 non plus (A13). À aligner un jour par `npm install --package-lock-only` dans une tâche de maintenance (la CI fait `npm ci`, qui ne vérifie pas ces deux champs).
7. **Commentaires périmés** : `src/ui/hud.ts` l. 4–6 et l. 243–244 (« le podium de la tâche 11 remplacera ce calque »), `src/game.ts` l. 547–548, `src/loop/states.ts` l. 30–31 (« n'est atteint qu'à la tâche 11 ») : réécrits par cette tâche.
8. **Spec §7** cite huit pilotes (Mathilde, Suzanne) ; le code en a six (tâche 5a). Sans effet sur le podium ; pour mémoire.
9. **Addendum §5** prévoit au régime « écrans » une seule relecture et « une ligne dans la passation » ; la décision du papa du 2026-10-23 impose quatre relectures et 3 à 5 lignes au registre : ce plan suit le papa.
10. **Passation « Environnement »** dit encore « Chromium pré-installé (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) » puis, plus bas, que cette révision ne convient pas : c'est le contournement par le scratchpad qui fait foi.
