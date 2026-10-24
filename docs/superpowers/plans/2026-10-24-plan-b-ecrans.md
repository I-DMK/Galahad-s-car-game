# Tâche 10 — Machine d'états, titre avec les copains, décompte, pause, orientation, police : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Régime « écrans » de l'addendum « présentation » §5, **durci par la décision du papa du 2026-10-23** : un implémenteur frais pour toute la tâche (Parties 1 à 5), puis **quatre relectures** du diff de la tâche (standard, adversariale, skill `code-review`, skill `security-review`), tours de correction (≤ 5), **validation du papa sur capture** avant la fusion. Pas de suite lente. Jamais de PR.

**Statut :** v1.1 (2026-10-24), relu contre le code (`.superpowers/sdd/2026-10-21-plan-b-copains-et-finitions/plan-10-review.md` : 7 importants, 8 mineurs, tous intégrés), en attente des réponses du papa (Q1 à Q4).
- v1 (`59223f6`) : brouillon.
- v1.1 : REPRENDRE au `pointerdown` aussi (doigt tenu) ; voile de pause en `data-no-pedal` ; `[hidden]{display:none}` sur les calques flex et le bouton saut ; champs `sim`, `loop`, `step` de `Game` gardés (tests et `__game.sim`) ; adaptation précise des tests existants (`now` relatif, `mockClear`, caméra témoin) ; `defaultPilotSeed(trackSeed)` pur dans `cars/pilots.ts` ; portrait lu à `start`/`play`/`resume` ; fps compté dans `frame` ; `go` testé avant le texte ; flottants en `toBeCloseTo` ; `Camera.reset` au Step 12 ; comptes (28 e2e, 5 fichiers Vitest).

**Goal:** Donner au jeu son enveloppe : un écran titre avec Galahad qui rebondit et les quatre copains tirés pour la piste, le bouton JOUER qui lance un décompte 3, 2, 1, PARTEZ, une pause (onglet caché, geste retour, tablette en portrait) avec reprise par un tap qui n'accélère pas, et la police Fredoka auto-hébergée partout, sans changer un bit de la simulation.

**Architecture:** Une machine d'états pure dans `src/loop/states.ts` (`transition(state, event)`, table figée, testée seule). `Game` l'orchestre : il crée la course au démarrage (la piste et les copains de la graine servent au titre), ne fait **aucun pas de simulation** hors de `racing` et `finished`, et recrée la course entière (`newRace`) pour AUTRE PISTE et ENCORE. Les écrans sont du DOM dans `src/ui/screens.ts` (créés une fois, montrés et cachés par `hidden`, jamais retirés : un doigt posé sur JOUER garde son chemin d'événements jusqu'au `pointerup`). La scène du titre est calculée dans `src/render/title.ts` (pur) et dessinée par `Renderer.drawTitle` avec le même `drawCar` que la course (sprites s'ils sont chargés, sinon dessin par code). La police est un `@font-face` dans `index.html`, fichiers dans `public/fonts/`, demandée par `document.fonts.load` au démarrage ; aucun texte ne l'attend.

**Tech Stack:** TypeScript 5.7 strict, Vite 8 (`define`, dossier `public/`, réécriture des `url(/fonts/…)` de `index.html` sous `base` : vérifié le 2026-10-24 sur un projet d'essai, `url(/Galahad-s-car-game/fonts/a.woff2)` dans `dist/index.html`), Vitest 5 (+ jsdom), Playwright 1.56. **Aucune nouvelle dépendance.**

**Spec :** `docs/superpowers/specs/2026-10-22-addendum-presentation.md` §2 (titre, police ; il l'emporte sur les documents plus anciens), §5, §6, §7 « Titre », « Police » ; `docs/superpowers/specs/2026-10-20-course-lunaire-galahad-design.md` §4 « Machine d'états », §8 « Entrée tactile » et « Écrans », §10, §11 « Playwright » ; plan v2.1 `docs/superpowers/plans/2026-10-21-plan-b-copains-et-finitions.md`, Task 10 (règles) et Task 11 (où s'arrêter). Références ci-dessous : « addendum §n », « spec §n », « plan v2.1 ».

**État de départ :** la tâche 8b est close (validée sur la tablette, déployée, run 45). **BASE = `106f714`** (tête de `wip-plan-b` et de la tâche 8b ; `origin/ccr-5b6fabc4-n96ofo` = `5e97707` en est l'ancêtre : la fusion finale se fait **en avance rapide**). Le contrôleur écrit BASE dans le registre (première ligne « Task 10: ») avant le Step 1 et le **recopie en clair** dans chaque commande qui en a besoin (Steps 23 et 26, notés `<BASE>` : une variable de shell ne survit pas d'un appel d'outil à l'autre).

## Global Constraints

- « La physique ne change pas d'un bit » : aucun pas de `stepRace` hors de `racing` et `finished` ; `tests/empreinte.test.ts` reste identique ; sous `src/sim/`, `src/physics/`, `src/track/`, `src/cars/`, `src/ai/`, seules changent : `colorHex` et `defaultPilotSeed(trackSeed)` déplacés de `simulate.ts` vers `cars/pilots.ts` (purs, réimportés par `simulate.ts`) ; le Step 19 le vérifie par `git diff --stat`.
- Machine d'états (spec §4, plan v2.1 Task 10) : `title | countdown | racing | finished | podium | paused | error` ; `title` → JOUER → `countdown` (3, 2, 1, PARTEZ, 1 s chacun) → `racing` ; `popstate`, `visibilitychange` caché, portrait (`innerHeight > innerWidth`) depuis `countdown` ou `racing` → `paused(précédent)` avec calque « PAUSE » ou « TOURNE » + dessin de tablette et bouton REPRENDRE (≥ 96 px, `data-no-pedal`, actif seulement en paysage) ; reprise = `countdown` à 3 ; `error` garde le comportement actuel (3 échecs de `stepRace` ou une exception de rendu → « Oups ! Recharge la page », boucle arrêtée). `podium` est dans la table mais n'est atteint qu'à la tâche 11.
- Titre (spec §8, addendum §2) : nom du jeu, version en tout petit, voiture de Galahad qui rebondit, **les quatre copains tirés pour cette graine, chacun avec sa voiture (sprite ou code) et son prénom, dans l'ordre de la grille, sans mot de caractère**, JOUER (rond, drapeau), AUTRE PISTE (dé → `seed = Date.now() % 100000`, écrit dans l'URL par `history.replaceState`, qui retire les copains et en tire d'autres). Le bouton son arrive à la tâche 12 (A3). « Le `pointerdown` sur JOUER compte comme doigt posé » (spec §8) : JOUER n'a pas `data-no-pedal`.
- Activation (spec §8) : `requestFullscreen()` au premier geste qui l'accorde après JOUER, avec `.catch(() => {})` ; refus ignoré. `AudioContext.resume()` : tâche 12.
- Geste retour (spec §8, plan v2.1) : `history.pushState` **si aucune entrée n'est en place** (drapeau `historyArmed`, remis à faux par `popstate`, qui consomme l'entrée), sinon `replaceState` ; pile stable.
- Police (addendum §2) : Fredoka 600 et 700, `woff2` latin, **auto-hébergée dans `public/fonts/`**, `@font-face` dans `index.html` avec `font-display: swap`, utilisée par le HUD, les écrans et les textes canvas (prénoms) ; `document.fonts.load('700 20px Fredoka')` au démarrage ; `system-ui` tant qu'elle n'est pas prête ; **aucune requête hors du site**. jsdom : `document.fonts` absent → rien ne casse.
- Boutons ≥ 96 px CSS de côté, bouton saut ≥ 140 px, **aucun bouton pendant la course hormis le saut**, mots courts (addendum §2, spec §8).
- Chaque nouveau paramètre va dans `src/config.ts` (nombres) : `COUNTDOWN_SECONDS: 3`, `COUNTDOWN_GO_SECONDS: 1`. La version ne vient pas de `CONFIG` : `define: { __APP_VERSION__ }` dans `vite.config.ts`, déclaré dans `src/vite-env.d.ts` (plan v2.1).
- Plan B : une seule dépendance d'exécution ; `track/`, `cars/`, `ai/` et `loop/` sans DOM ni matter-js (`tests/deps.test.ts` : `src/loop/states.ts` ne doit contenir ni `document.` ni `window.`), `render/` sans matter-js ; aucun cycle d'import ; pas de `@types/node` (`process.getBuiltinModule`, comme `tests/assets.test.ts`).
- `npm run typecheck` et `npm test` verts à chaque commit. Jamais de `.skip`. Budget CI : `npm test` < 6 min sur le runner.
- Commits en français préfixés `feat:` / `fix:` / `test:` / `chore:` / `docs:`, trailers de la session, aucun identifiant de modèle. Code, commentaires et docs en français.
- Jamais de `git reset` / `checkout` / `stash` / `clean` pendant qu'un autre agent travaille dans l'arbre. Commits ciblés (`git commit -- <chemins>`). Pas de `.superpowers/` ni de `tests/zz-probe-*` dans un commit.
- **Retour arrière** si la tâche déployée déplaît : `git revert` des commits de la 10 sur `ccr-5b6fabc4-n96ofo` (fusion en avance rapide : pas de commit de fusion à annuler), push, CI verte, `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live`.

## Environnement (conteneur)

Playwright 1.56.1 attend Chromium **1194**, le conteneur a la **1243** : dossier de liens dans le scratchpad et `PLAYWRIGHT_BROWSERS_PATH` **devant chaque commande Playwright** (commande de création : plan de la 8b, `docs/superpowers/plans/2026-10-24-plan-b-images.md`, section « Environnement »). Cette session : `/tmp/claude-0/-home-user-Galahad-s-car-game/bcc007f9-45ba-5953-aa9c-79529af6694d/scratchpad/pw-browsers`. Noté `<scratchpad>/pw-browsers` ci-dessous, à recopier en clair.

```bash
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npx playwright test e2e/screens.spec.ts
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live
```

Le skill `security-review` a besoin de `origin/HEAD` : `git remote set-head origin ccr-5b6fabc4-n96ofo` (déjà fait dans cette session).

## Review Focus

1. **Doigt gardé posé depuis JOUER à travers le décompte.** Le titre disparaît sous le doigt ; si le bouton était **retiré** du DOM, son `pointerup` ne remonterait plus à `window` et `Throttle` garderait le doigt « posé » pour toujours (la voiture ne s'arrêterait plus). Attendu : la voiture part à PARTEZ, et le doigt levé relâche le gaz. Couvert par le test jsdom « pointerup sur JOUER caché relâche le gaz » et l'e2e « doigt gardé depuis JOUER » (Steps 17 et 21).
2. **Portrait pendant le décompte, puis retour paysage.** Attendu : « TOURNE », REPRENDRE invisible tant que la tablette est en portrait, puis tap qui n'accélère pas et décompte relancé à 3 (plan v2.1 Review Focus 4). Couvert par le test jsdom « resize portrait pendant countdown » (Step 17) et l'e2e portrait (Step 21).
3. **Reprise après une pause en course.** Attendu : le chrono reprend où il était (temps simulé), la demande de saut en attente est jetée, aucune voiture n'a bougé pendant la pause ni le décompte. Couvert par le test jsdom « pause en course : sim.time figé, reprise sans saut » (Step 17).
4. **Exception de rendu à l'écran titre** (canvas, image). Attendu : « Oups ! Recharge la page » et boucle arrêtée, jamais un écran figé sans message. Couvert par le test jsdom « drawTitle qui lève » (Step 17).
5. **Site déployé sous `/Galahad-s-car-game/`.** Une police en `url(fonts/…)` ou `url(/fonts/…)` non réécrite donnerait 404 en ligne et un titre en `system-ui` sans que personne ne le voie. Attendu : `dist/index.html` sous la base pointe sur `/Galahad-s-car-game/fonts/…` et `document.fonts.check('700 20px Fredoka')` est vrai sur le site en ligne. Couvert par le Step 22 (build sous la base + aperçu) et l'e2e « police » rejoué par `npm run e2e:live` (Step 27).

## Structure des fichiers

| Fichier | Rôle | Partie |
|---|---|---|
| `src/loop/states.ts` (créé) | `Phase`, `GameEvent`, `MachineState`, `INITIAL_STATE`, `transition` (table pure) | 1 |
| `tests/game-states.test.ts` (créé, node) | table des transitions, événements ignorés | 1 |
| `src/config.ts` | `COUNTDOWN_SECONDS`, `COUNTDOWN_GO_SECONDS` ; commentaire de `RANK_HIDE_SECONDS` | 1 |
| `public/fonts/fredoka-latin-600.woff2`, `-700.woff2` (déplacés depuis `assets/fonts/`) | police servie | 1 |
| `index.html` | deux `@font-face` (`font-display: swap`), `font-family` du body | 1 |
| `src/ui/font.ts` (créé) | `FONT_FAMILY`, `canvasFont(weight, px)`, `loadFont(doc)` | 1 |
| `tests/fonts.test.ts` (créé, node) | fichiers de `public/fonts/`, `index.html`, `canvasFont`, `loadFont` sans `document.fonts` | 1 |
| `src/ui/hud.ts`, `src/render/car.ts` | Fredoka dans le CSS et les prénoms canvas ; `Hud.setRacers`, `Hud.setRaceVisible`, `showFinished(seconds, onAgain, onMenu)` | 1, 4 |
| `assets/README.md` | `fonts/` déplacé dans `public/fonts/` | 1 |
| `src/ui/screens.ts` (créé) | `Screens` : titre, décompte, pause/TOURNE ; style injecté une fois | 2 |
| `tests/screens.test.ts` (créé, jsdom) | boutons, `data-no-pedal`, portrait, textes du décompte | 2 |
| `src/cars/pilots.ts`, `src/sim/simulate.ts` | `colorHex` et `defaultPilotSeed(trackSeed)` déplacés dans `pilots.ts` (purs) | 3 |
| `src/render/title.ts` (créé) | `titleScene(pilots, t, cfg)`, `bounceHeight(t)`, constantes de la scène | 3 |
| `src/render/renderer.ts`, `src/render/camera.ts` | `drawTitle(scene)` : ciel, sol, ombres, voitures ; `Camera.reset()` | 3 |
| `tests/title-scene.test.ts` (créé, jsdom) | poses de la scène ; `Renderer.drawTitle` sur faux contexte | 3 |
| `src/ui/jump-button.ts` | `setVisible`, règle `.jump-button[hidden]{display:none}` | 4 |
| `src/render/effects.ts` | `Effects.clear()` | 4 |
| `src/game.ts` | machine d'états branchée, `newRace` (champs réassignés), décompte, pause, historique, orientation, `play`/`otherTrack`/`resume`/`again`/`menu` | 4 |
| `src/main.ts`, `vite.config.ts`, `src/vite-env.d.ts` (créé) | `__APP_VERSION__`, `loadFont`, `game.start()` → titre | 4 |
| `tests/game-screens.test.ts` (créé, jsdom) | câblage de `Game` : titre → décompte → course, pause, reprise, historique, AUTRE PISTE, ENCORE, erreur | 4 |
| `tests/hud.test.ts`, `tests/game-frame.test.ts`, `tests/renderer-art.test.ts` | passent par `startRacing` (helper) au lieu de `start()` seul | 4 |
| `tests/helpers/racing.ts` (créé) | `startRacing(game, raf, now)` : `start()`, `play()`, images jusqu'à `racing` | 4 |
| `e2e/helpers.ts` | `startRace(page)`, `tapButton(page, name)`, `requestsOffSite(page)` | 5 |
| `e2e/race.spec.ts`, `jump.spec.ts`, `fosse.spec.ts`, `sprites.spec.ts` | `startRace` après `waitForGame` ; deux tests des images reformulés | 5 |
| `e2e/screens.spec.ts` (créé) | titre, copains, AUTRE PISTE, décompte, doigt gardé, portrait, pause, police, captures | 5 |
| passation, registre | lignes de la tâche 10 | 6 |

---

## Partie 1 — Machine d'états pure, paramètres, police (Steps 1 à 6)

**Files:**
- Create: `src/loop/states.ts`, `src/ui/font.ts`, `tests/game-states.test.ts`, `tests/fonts.test.ts`
- Move: `assets/fonts/fredoka-latin-600.woff2` → `public/fonts/fredoka-latin-600.woff2`, idem `-700` (`git mv`)
- Modify: `src/config.ts` (après `RANK_HIDE_SECONDS`), `index.html`, `src/ui/hud.ts` (CSS, l. 48–83), `src/render/car.ts` (l. 77), `assets/README.md`

**Interfaces (produit) :**

```ts
// src/loop/states.ts — pur (ni DOM, ni matter-js)
export type Phase = 'title' | 'countdown' | 'racing' | 'finished' | 'podium' | 'paused' | 'error';
export type GameEvent =
  | 'play'            // JOUER (titre)
  | 'go'              // fin du décompte : PARTEZ
  | 'finish'          // Galahad passe la ligne
  | 'podium'          // tâche 11 : fin de la roue libre
  | 'pause'           // onglet caché, popstate, portrait
  | 'resume'          // REPRENDRE : repart toujours par le décompte
  | 'again'           // ENCORE : même piste, mêmes copains
  | 'menu'            // MENU : retour au titre
  | 'error';          // 3 échecs de stepRace, exception de rendu
/** `from` : phase d'où l'on est entré en pause ('countdown' ou 'racing'), null ailleurs. */
export interface MachineState { readonly phase: Phase; readonly from: 'countdown' | 'racing' | null }
export const INITIAL_STATE: MachineState;   // { phase: 'title', from: null }
/** Table : un événement sans ligne pour la phase courante rend l'état inchangé (même objet). */
export function transition(s: MachineState, ev: GameEvent): MachineState;
```

Table (la seule chose à décider ; tout autre couple est ignoré) :

| Phase \ Événement | play | go | finish | podium | pause | resume | again | menu | error |
|---|---|---|---|---|---|---|---|---|---|
| title | countdown | | | | | | | | error |
| countdown | | racing | | | paused(from countdown) | | | | error |
| racing | | | finished | | paused(from racing) | | | | error |
| finished | | | | podium | | | countdown | title | error |
| podium | | | | | | | countdown | title | error |
| paused | | | | | | countdown | | | error |
| error | | | | | | | | | |

```ts
// src/ui/font.ts
export const FONT_FAMILY = 'Fredoka, system-ui, sans-serif';
/** Chaîne pour `ctx.font` : `${weight} ${px}px ${FONT_FAMILY}` (px arrondi). */
export function canvasFont(weight: 600 | 700, px: number): string;
/** Demande la police au navigateur (`doc.fonts.load('700 20px Fredoka')`), rend vrai si elle est prête ; faux sans `doc.fonts` ou en cas d'échec ; ne lève jamais. */
export function loadFont(doc: Document): Promise<boolean>;
```

```ts
// src/config.ts, après RANK_HIDE_SECONDS
COUNTDOWN_SECONDS: 3,         // s : 3, 2, 1 (un chiffre par seconde) avant PARTEZ (spec §4, tâche 10)
COUNTDOWN_GO_SECONDS: 1,      // s : « PARTEZ » reste affiché pendant la première seconde de course
```

- [ ] **Step 1 : Tests de la machine d'états** dans `tests/game-states.test.ts` (node).

```ts
import { INITIAL_STATE, transition, type GameEvent, type MachineState, type Phase } from '../src/loop/states';

const at = (phase: Phase, from: MachineState['from'] = null): MachineState => ({ phase, from });
const EVENTS: GameEvent[] = ['play', 'go', 'finish', 'podium', 'pause', 'resume', 'again', 'menu', 'error'];

test('état initial : titre', () => {
  expect(INITIAL_STATE).toEqual({ phase: 'title', from: null });
});

test('chemin nominal : titre → JOUER → décompte → PARTEZ → course → arrivée → ENCORE → décompte', () => {
  let s = INITIAL_STATE;
  s = transition(s, 'play'); expect(s.phase).toBe('countdown');
  s = transition(s, 'go'); expect(s.phase).toBe('racing');
  s = transition(s, 'finish'); expect(s.phase).toBe('finished');
  s = transition(s, 'again'); expect(s.phase).toBe('countdown');
  s = transition(s, 'go'); s = transition(s, 'finish');
  expect(transition(s, 'menu')).toEqual(at('title'));
  expect(transition(s, 'podium')).toEqual(at('podium'));
  expect(transition(at('podium'), 'again')).toEqual(at('countdown'));
  expect(transition(at('podium'), 'menu')).toEqual(at('title'));
});

test('pause depuis le décompte ou la course, mémorise d’où ; reprise = décompte à 3', () => {
  expect(transition(at('countdown'), 'pause')).toEqual(at('paused', 'countdown'));
  expect(transition(at('racing'), 'pause')).toEqual(at('paused', 'racing'));
  expect(transition(at('paused', 'racing'), 'resume')).toEqual(at('countdown'));
  expect(transition(at('paused', 'countdown'), 'resume')).toEqual(at('countdown'));
});

test('pause ignorée au titre, à l’arrivée, au podium, en pause et en erreur (même objet rendu)', () => {
  for (const p of ['title', 'finished', 'podium', 'error'] as Phase[]) { const s = at(p); expect(transition(s, 'pause'), p).toBe(s); }
  const paused = at('paused', 'racing');
  expect(transition(paused, 'pause')).toBe(paused);
});

test('error depuis toute phase sauf error ; error absorbe tout', () => {
  for (const p of ['title', 'countdown', 'racing', 'finished', 'podium', 'paused'] as Phase[]) expect(transition(at(p), 'error')).toEqual(at('error'));
  for (const ev of EVENTS) { const s = at('error'); expect(transition(s, ev), ev).toBe(s); }
});

test('un événement sans ligne rend le même objet (aucune allocation, aucun changement)', () => {
  const cases: [MachineState, GameEvent][] = [
    [at('title'), 'go'], [at('title'), 'resume'], [at('title'), 'again'], [at('title'), 'menu'], [at('title'), 'finish'],
    [at('countdown'), 'play'], [at('countdown'), 'finish'], [at('racing'), 'play'], [at('racing'), 'go'], [at('racing'), 'resume'],
    [at('finished'), 'pause'], [at('finished'), 'go'], [at('paused', 'racing'), 'go'], [at('paused', 'racing'), 'play'],
  ];
  for (const [s, ev] of cases) expect(transition(s, ev), `${s.phase} + ${ev}`).toBe(s);
});

test('toute transition sort une phase connue et `from` n’est posé qu’en pause', () => {
  const phases: Phase[] = ['title', 'countdown', 'racing', 'finished', 'podium', 'paused', 'error'];
  for (const p of phases) for (const ev of EVENTS) {
    const out = transition(at(p, p === 'paused' ? 'racing' : null), ev);
    expect(phases).toContain(out.phase);
    expect(out.from === null || out.phase === 'paused').toBe(true);
  }
});
```

- [ ] **Step 2 : Vérifier l'échec** : `npx vitest run tests/game-states.test.ts` → FAIL (`Cannot find module '../src/loop/states'`).

- [ ] **Step 3 : Écrire `src/loop/states.ts`** : la table comme `Record<Phase, Partial<Record<GameEvent, (s) => MachineState>>>` ou un `switch` ; `paused` prend `from` = phase courante ; toute autre sortie a `from: null` ; sans ligne, `return s`. Puis **`src/config.ts`** : les deux constantes ; commentaire de `RANK_HIDE_SECONDS` : « la position reste vide la première seconde de course (`sim.time`, qui part à PARTEZ) ». Puis `npx vitest run tests/game-states.test.ts tests/deps.test.ts` → vert (deps : `loop/` toujours pur).

- [ ] **Step 4 : Tests de la police** dans `tests/fonts.test.ts` (node).

```ts
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
```

- [ ] **Step 5 : Vérifier l'échec** : `npx vitest run tests/fonts.test.ts` → FAIL (module absent, `public/fonts` absent).

- [ ] **Step 6 : Police** :
  - `git mv assets/fonts/fredoka-latin-600.woff2 public/fonts/fredoka-latin-600.woff2` et `-700` ; `assets/fonts/` disparaît.
  - `index.html`, dans `<style>` : deux `@font-face{font-family:Fredoka;font-style:normal;font-weight:600;font-display:swap;src:url(/fonts/fredoka-latin-600.woff2) format('woff2')}` (et 700) ; `body{font-family:Fredoka,system-ui,sans-serif}` ; `<title>Course Lunaire de Galahad</title>`.
  - `src/ui/font.ts` selon l'interface ; `loadFont` : `doc.fonts?.load('700 20px Fredoka')` dans un `try`, `.then(() => true, () => false)`.
  - `src/ui/hud.ts` : chaque `system-ui,sans-serif` du CSS → `Fredoka,system-ui,sans-serif` (position, chrono, fps, steps, overlay, bouton ENCORE).
  - `src/render/car.ts` l. 77 : `ctx.font = canvasFont(700, (14 * ppm) / 57)` (import de `../ui/font` : `render/` peut importer `ui/font.ts`, qui est sans DOM hors de `loadFont(doc)` ; **ne pas** importer `ui/hud.ts`). Le test `render-smoke` « fillText » reste vert.
  - `assets/README.md` : section `fonts/` → « déplacées dans `public/fonts/` à la tâche 10 (Fredoka 600 et 700, 16 468 et 15 900 octets, SIL OFL 1.1) », en-tête : `assets/` ne garde que `generated/` et la Terre.
  - `npx vitest run tests/fonts.test.ts tests/render-smoke.test.ts tests/hud.test.ts` → vert ; `npm run typecheck` → 0.
  - Commit : `git add public/fonts src/loop/states.ts src/ui/font.ts tests/game-states.test.ts tests/fonts.test.ts && git commit -m "feat: machine d'états pure, police Fredoka auto-hébergée, COUNTDOWN_SECONDS" -- public/fonts assets/fonts src/loop/states.ts src/ui/font.ts src/config.ts index.html src/ui/hud.ts src/render/car.ts assets/README.md tests/game-states.test.ts tests/fonts.test.ts`

---

## Partie 2 — Écrans DOM `src/ui/screens.ts` (Steps 7 à 9)

**Files:**
- Create: `src/ui/screens.ts`, `tests/screens.test.ts`

**Interfaces :**
- Consumes : `FONT_FAMILY` (`src/ui/font.ts`) ; rien de `Game`.
- Produces :

```ts
export interface TitleActions {
  /** JOUER : au `pointerdown` (le doigt compte comme gaz, spec §8) et au `click` (clavier) ; `Game` ignore le doublon. */
  onPlay(): void;
  /** AUTRE PISTE : au `click` ; le bouton porte data-no-pedal. */
  onOtherTrack(): void;
}
export class Screens {
  /**
   * Crée les trois calques cachés dans `root` (#hud), après le HUD et le bouton saut, et injecte le style une fois (`screens-style`).
   * `onResume` : REPRENDRE, au `pointerdown` ET au `click` (un doigt tenu sur le bouton n'émet pas de `click` avant d'être levé ; `Game` ignore le doublon).
   */
  constructor(root: HTMLElement, opts: { version: string }, actions: TitleActions & { onResume(): void });
  /** Montre le titre (les autres calques cachés). */
  showTitle(): void;
  /** Montre le décompte avec ce texte ('3', '2', '1', 'PARTEZ') ; le calque ne capte pas le toucher. */
  showCountdown(text: string): void;
  /** Montre la pause : « PAUSE » + REPRENDRE en paysage, « TOURNE » + dessin de tablette sans REPRENDRE en portrait. */
  showPaused(portrait: boolean): void;
  /** Change le calque de pause déjà montré (rotation pendant la pause) ; sans effet ailleurs. */
  setPortrait(portrait: boolean): void;
  /** Cache les trois calques (course, arrivée, erreur). */
  hide(): void;
}
```

DOM et classes (les tests et e2e s'y accrochent) ; chaque calque porte la classe commune `screen` (`position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;font-family:Fredoka,system-ui,sans-serif;color:#fff;text-shadow:0 3px 0 #000a`) plus la sienne, et la feuille déclare **`.screen[hidden]{display:none}`** (un `display:flex` l'emporterait sinon sur l'attribut `hidden`, comme `.hud-position[hidden]`, `tests/hud.test.ts` l. 72) : `.screen-title` (transparent : le canvas dessine la scène derrière ; `pointer-events: auto` ; **sans** `data-no-pedal` : un doigt sur JOUER compte) contenant `h1.title-name` (deux lignes : « Course Lunaire » et `<small>` « de Galahad »), `.title-version` (en bas à gauche, 12 px, `v${version}`), `button.btn-play` (texte « JOUER », drapeau SVG inline, rond, `clamp(96px, 22vh, 170px)` de côté, **sans** `data-no-pedal`, `aria-label="Jouer"`), `button.btn-other` (« AUTRE PISTE », dé SVG inline, ≥ 96 px, `data-no-pedal`) ; `.screen-countdown` (`pointer-events: none`, `.countdown-text` centré, 160 px, `font-variant-numeric: tabular-nums`) ; `.screen-pause` (voile `rgba(0,0,20,.65)`, `pointer-events: auto`, **`data-no-pedal` sur le calque entier** : un doigt posé sur le voile, hors bouton, n'est jamais du gaz (spec §4 « tap consommé » ; `Throttle` teste `closest`), `.pause-text` « PAUSE » ou « TOURNE », `.pause-tablet` SVG inline d'une tablette en portrait avec une flèche de rotation, visible seulement en portrait, `button.btn-resume` « REPRENDRE », ≥ 96 px, `data-no-pedal`, `hidden` en portrait). Zones du titre : nom dans les 30 % du haut, boutons dans les 30 % du bas (`bottom: 4vh`), version `bottom: 6px; left: 10px` ; la bande 45 à 62 % de la hauteur reste libre pour les voitures (Partie 3). Tous les boutons : `tabIndex` par défaut (clavier), `-webkit-tap-highlight-color: transparent`, `touch-action: none`.

- [ ] **Step 7 : Tests des écrans** dans `tests/screens.test.ts` (jsdom).

```ts
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { Screens } from '../src/ui/screens';

afterEach(() => { document.body.innerHTML = ''; document.head.innerHTML = ''; });

function make() {
  const root = document.createElement('div');
  document.body.append(root);
  const actions = { onPlay: vi.fn(), onOtherTrack: vi.fn(), onResume: vi.fn() };
  const screens = new Screens(root, { version: '1.1.0' }, actions);
  const q = <T extends Element>(sel: string): T => root.querySelector<T>(sel)!;
  return { root, screens, actions, q };
}
const declaredPx = (el: Element, prop: 'width' | 'height' | 'min-width' | 'min-height') => parseFloat(getComputedStyle(el).getPropertyValue(prop));
const pointer = (type: string, id: number) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: id }); return e; };

test('trois calques créés cachés, dans root, style injecté une fois', () => {
  const { root, q } = make();
  for (const s of ['.screen-title', '.screen-countdown', '.screen-pause']) expect(q<HTMLElement>(s).hidden, s).toBe(true);
  make();
  expect(document.querySelectorAll('#screens-style')).toHaveLength(1);
  expect(root.querySelectorAll('.screen-title')).toHaveLength(1);
});

test('titre : nom du jeu, version, JOUER sans data-no-pedal (le doigt compte comme gaz), AUTRE PISTE avec', () => {
  const { screens, q } = make();
  screens.showTitle();
  expect(q<HTMLElement>('.screen-title').hidden).toBe(false);
  expect(q('.title-name').textContent).toMatch(/Course Lunaire/);
  expect(q('.title-name').textContent).toMatch(/de Galahad/);
  expect(q('.title-version').textContent).toBe('v1.1.0');
  expect(q('.btn-play').hasAttribute('data-no-pedal')).toBe(false);
  expect(q('.btn-other').hasAttribute('data-no-pedal')).toBe(true);
  expect(q('.btn-play').textContent).toMatch(/JOUER/);
  expect(q('.btn-other').textContent).toMatch(/AUTRE PISTE/);
  expect(q('.btn-play svg')).not.toBeNull();   // drapeau
  expect(q('.btn-other svg')).not.toBeNull();  // dé
});

test('JOUER : onPlay au pointerdown ET au click ; AUTRE PISTE : onOtherTrack au click seulement', () => {
  const { screens, actions, q } = make();
  screens.showTitle();
  q('.btn-play').dispatchEvent(pointer('pointerdown', 1));
  expect(actions.onPlay).toHaveBeenCalledTimes(1);
  q('.btn-play').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(actions.onPlay).toHaveBeenCalledTimes(2);
  q('.btn-other').dispatchEvent(pointer('pointerdown', 2));
  expect(actions.onOtherTrack).not.toHaveBeenCalled();
  q('.btn-other').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(actions.onOtherTrack).toHaveBeenCalledTimes(1);
});

test('le titre reste dans le DOM quand il est caché : le pointerup d’un doigt posé sur JOUER remonte encore à window', () => {
  const { screens, q } = make();
  screens.showTitle();
  const play = q<HTMLElement>('.btn-play');
  play.dispatchEvent(pointer('pointerdown', 3));
  screens.showCountdown('3');
  expect(q<HTMLElement>('.screen-title').hidden).toBe(true);
  expect(play.isConnected).toBe(true);
  const seen = vi.fn();
  window.addEventListener('pointerup', seen);
  play.dispatchEvent(pointer('pointerup', 3));
  expect(seen).toHaveBeenCalledTimes(1);
  window.removeEventListener('pointerup', seen);
});

test('décompte : texte affiché, calque sans toucher (pointer-events none), remplace le titre', () => {
  const { screens, q } = make();
  screens.showTitle();
  screens.showCountdown('3');
  expect(q<HTMLElement>('.screen-countdown').hidden).toBe(false);
  expect(q('.countdown-text').textContent).toBe('3');
  expect(getComputedStyle(q('.screen-countdown')).getPropertyValue('pointer-events')).toBe('none');
  screens.showCountdown('PARTEZ');
  expect(q('.countdown-text').textContent).toBe('PARTEZ');
  screens.hide();
  expect(q<HTMLElement>('.screen-countdown').hidden).toBe(true);
});

test('pause en paysage : « PAUSE », REPRENDRE visible, onResume au pointerdown ET au click ; le voile entier porte data-no-pedal ; tablette cachée', () => {
  const { screens, actions, q } = make();
  screens.showPaused(false);
  expect(q('.pause-text').textContent).toBe('PAUSE');
  const resume = q<HTMLButtonElement>('.btn-resume');
  expect(resume.hidden).toBe(false);
  expect(q('.screen-pause').hasAttribute('data-no-pedal')).toBe(true);
  expect(resume.closest('[data-no-pedal]')).not.toBeNull();
  expect(q('.screen-title').closest('[data-no-pedal]')).toBeNull();
  expect(q<HTMLElement>('.pause-tablet').hidden).toBe(true);
  resume.dispatchEvent(pointer('pointerdown', 5));
  expect(actions.onResume).toHaveBeenCalledTimes(1);
  resume.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(actions.onResume).toHaveBeenCalledTimes(2);
});

test('la feuille cache vraiment un calque flex caché : .screen[hidden] a display:none', () => {
  make();
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  expect(rules.find((r) => r.selectorText === '.screen')?.style.display).toBe('flex');
  expect(rules.find((r) => r.selectorText === '.screen[hidden]')?.style.display).toBe('none');
});

test('pause en portrait : « TOURNE », dessin de tablette, REPRENDRE caché ; setPortrait(false) le rend', () => {
  const { screens, q } = make();
  screens.showPaused(true);
  expect(q('.pause-text').textContent).toBe('TOURNE');
  expect(q<HTMLElement>('.pause-tablet').hidden).toBe(false);
  expect(q<HTMLElement>('.btn-resume').hidden).toBe(true);
  screens.setPortrait(false);
  expect(q('.pause-text').textContent).toBe('PAUSE');
  expect(q<HTMLElement>('.btn-resume').hidden).toBe(false);
  screens.setPortrait(true);
  expect(q<HTMLElement>('.btn-resume').hidden).toBe(true);
});

test('boutons ≥ 96 px déclarés (JOUER : min-width/min-height 96 ; AUTRE PISTE et REPRENDRE : min-height 96), police Fredoka', () => {
  const { q } = make();
  for (const sel of ['.btn-play', '.btn-other', '.btn-resume']) {
    expect(declaredPx(q(sel), 'min-height'), sel).toBeGreaterThanOrEqual(96);
    expect(declaredPx(q(sel), 'min-width'), sel).toBeGreaterThanOrEqual(96);
  }
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  const screen = rules.find((r) => r.selectorText === '.screen');
  expect(screen?.style.fontFamily).toMatch(/Fredoka/);
});
```

(jsdom ne met pas en page : les tailles lues sont celles **déclarées** par la feuille ; les boîtes réelles sont vérifiées en e2e, Step 21. Pour que `getComputedStyle` rende `min-height`, la feuille doit les déclarer en `px` sur les classes des boutons, pas seulement par `clamp` : `min-width:96px;min-height:96px;width:clamp(…)`.)

- [ ] **Step 8 : Vérifier l'échec** : `npx vitest run tests/screens.test.ts` → FAIL (module absent).

- [ ] **Step 9 : Écrire `src/ui/screens.ts`** selon l'interface et le DOM ci-dessus, dans le style de `hud.ts` (style injecté une fois sous l'id `screens-style`, `div()` utilitaire, SVG inline pour le drapeau, le dé et la tablette, sans fichier). `showTitle` / `showCountdown` / `showPaused` cachent les deux autres calques. `npx vitest run tests/screens.test.ts` → vert ; `npm run typecheck` → 0. Commit : `git add src/ui/screens.ts tests/screens.test.ts && git commit -m "feat: écrans titre, décompte et pause en DOM (Screens)" -- src/ui/screens.ts tests/screens.test.ts`

---

## Partie 3 — Scène du titre `src/render/title.ts` et `Renderer.drawTitle` (Steps 10 à 13)

**Files:**
- Create: `src/render/title.ts`, `tests/title-scene.test.ts`
- Modify: `src/cars/pilots.ts` (`colorHex`, `defaultPilotSeed`), `src/sim/simulate.ts` (l. 150–159 : importe les deux, fonctions locales retirées), `src/render/renderer.ts` (`drawTitle`), `src/render/camera.ts` (`reset`)

**Interfaces :**
- Consumes : `Pilot`, `GALAHAD` (`src/cars/pilots.ts`) ; `CarView`, `Renderer` ; `drawCar`, `shadowScale` (`src/render/car.ts`) ; `Camera` ; `Config` (`CAR_LENGTH`, `WHEEL_RADIUS`, `GRID_SPACING_FACTOR`, `VISIBLE_HEIGHT_M`).
- Produces :

```ts
// src/cars/pilots.ts (déplacés depuis sim/simulate.ts, mêmes corps ; purs : e2e et tests les importent sans matter-js)
export function colorHex(n: number): string;              // 0x1e5cff → '#1e5cff'
export function defaultPilotSeed(trackSeed: number): number;   // (trackSeed ^ 0x9e3779b9) >>> 0 ; simulate.ts appelle defaultPilotSeed(track.seed)
// src/render/camera.ts
export class Camera { reset(): void }   // la prochaine update se cale sans lissage (titre, nouvelle course)

// src/render/title.ts — pur (ni DOM, ni matter-js)
/** Constantes de la scène (pas des paramètres de jeu : pas dans CONFIG). */
export const TITLE_BOUNCE_PERIOD_S = 1.1;   // un bond de Galahad
export const TITLE_BOUNCE_HEIGHT_M = 0.5;   // hauteur du bond (roues au-dessus du sol)
export const TITLE_GROUND_FRAC = 0.62;      // le sol de la scène à 62 % de la hauteur de l'écran
export const TITLE_WHEEL_SPIN_RAD_S = 6;    // roues de Galahad qui tournent (sens de la marche)
/** Hauteur du bond à l'instant t : parabole périodique 4H·u(1 − u), u = (t mod T)/T ; 0 aux rebonds, H à mi-période ; ≥ 0 pour t < 0. */
export function bounceHeight(t: number): number;
export interface TitleScene {
  /** Voitures dans l'ordre de dessin (copain de rang 4 d'abord, Galahad en dernier, au-dessus), poses en mètres, sol à y = 0. */
  cars: CarView[];
  /** Hauteur de vol (m) de chaque voiture de `cars`, pour son ombre (0 pour les copains). */
  heights: number[];
  /** Centre horizontal de la rangée (m) : la caméra s'y place. */
  centerX: number;
  t: number;
}
/**
 * `pilots` dans l'ordre de la grille (Galahad en premier). Rangée comme sur la grille : Galahad en x = 0 (écrit `0`, jamais `−0 × …` :
 * `Object.is(−0, 0)` est faux), le copain de rang n à 0 − n × GRID_SPACING_FACTOR × CAR_LENGTH (3,3 m). Châssis à y = WHEEL_RADIUS + 0,25 + h, roues à (x ± 0,75 ; WHEEL_RADIUS + h),
 * angle 0 ; h = bounceHeight(t) pour Galahad, 0 sinon ; roues de Galahad tournées de −t × TITLE_WHEEL_SPIN_RAD_S ; `turbo` faux ;
 * `name` = prénom (drawCar l'écrit au-dessus des copains, pas de Galahad) ; `id`, `color`, `accent`, `helmet` du pilote.
 */
export function titleScene(pilots: readonly Pilot[], t: number, cfg: Config): TitleScene;

// src/render/renderer.ts
export class Renderer {
  /**
   * Scène du titre : ciel (comme en course), sol gris (#8b8b8b) de la ligne y = 0 jusqu'en bas, liseré #c8c8c8, ombres (ellipse noire
   * 1,2 × 0,15 m × s, alpha 0,45 × s, s = shadowScale(h)), puis voitures par `drawCar` avec les images reçues par `setArt`.
   * Caméra fixe : x = scene.centerX, y = (TITLE_GROUND_FRAC − 0,5) × VISIBLE_HEIGHT_M = +1,68 m (l'écran est centré 1,68 m au-dessus
   * du sol : le sol tombe à 62 % de la hauteur, `worldToScreen` : y_écran = h/2 − (0 − 1,68) × ppm).
   */
  drawTitle(scene: TitleScene): void;
}
```

- [ ] **Step 10 : Tests de la scène** dans `tests/title-scene.test.ts` (jsdom : `Renderer` crée un canvas de ciel).

```ts
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { GALAHAD, PILOTS, colorHex, defaultPilotSeed, drawPilots } from '../src/cars/pilots';
import { CONFIG } from '../src/config';
import { Renderer } from '../src/render/renderer';
import {
  TITLE_BOUNCE_HEIGHT_M, TITLE_BOUNCE_PERIOD_S, TITLE_GROUND_FRAC, bounceHeight, titleScene,
} from '../src/render/title';
import { createRaceSim } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { fakeCtx } from './helpers/fake-ctx';

const pilots = [GALAHAD, ...drawPilots(7)];

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

test('colorHex (déplacé dans pilots) : 0x1e5cff → #1e5cff, zéros gardés', () => {
  expect(colorHex(0x1e5cff)).toBe('#1e5cff');
  expect(colorHex(0x00a8a0)).toBe('#00a8a0');
});

test('bounceHeight : 0 aux rebonds, H à mi-période, jamais négatif, périodique', () => {
  expect(bounceHeight(0)).toBeCloseTo(0, 9);
  expect(bounceHeight(TITLE_BOUNCE_PERIOD_S / 2)).toBeCloseTo(TITLE_BOUNCE_HEIGHT_M, 9);
  expect(bounceHeight(TITLE_BOUNCE_PERIOD_S)).toBeCloseTo(0, 9);
  for (const t of [-0.3, 0.17, 2.9, 100.01]) {
    expect(bounceHeight(t)).toBeGreaterThanOrEqual(0);
    expect(bounceHeight(t)).toBeLessThanOrEqual(TITLE_BOUNCE_HEIGHT_M + 1e-9);
    expect(bounceHeight(t + TITLE_BOUNCE_PERIOD_S)).toBeCloseTo(bounceHeight(t), 9);
  }
});

test('titleScene : cinq voitures, Galahad dessiné en dernier et devant (x = 0), copains à −3,3 m par rang, prénoms et couleurs des pilotes', () => {
  const s = titleScene(pilots, 0, CONFIG);
  expect(s.cars).toHaveLength(5);
  const galahad = s.cars[4];
  expect(galahad.id).toBe('galahad');
  expect(galahad.x).toBeCloseTo(0, 9);
  // Ordre de dessin inverse de la grille : le copain de rang 4 d'abord.
  for (let rank = 1; rank <= 4; rank++) {
    const c = s.cars[4 - rank];
    expect(c.id).toBe(pilots[rank].id);
    expect(c.name).toBe(pilots[rank].name);
    expect(c.x).toBeCloseTo(-rank * CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH, 9);
    expect(c.color).toBe(colorHex(pilots[rank].color));
    expect(c.accent).toBe(colorHex(pilots[rank].accent));
    expect(c.helmet).toBe(colorHex(pilots[rank].helmet));
    expect(c.turbo).toBe(false);
    expect(c.angle).toBe(0);
  }
  expect(s.centerX).toBeCloseTo(-2 * CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH, 9);
});

test('titleScene : poses au sol (châssis à R + 0,25, roues à ±0,75 et R), Galahad seul rebondit, ses roues tournent', () => {
  const R = CONFIG.WHEEL_RADIUS;
  const t = TITLE_BOUNCE_PERIOD_S / 2;
  const s = titleScene(pilots, t, CONFIG);
  const h = bounceHeight(t);
  expect(h).toBeGreaterThan(0.4);
  for (const c of s.cars.slice(0, 4)) {
    expect(c.y).toBeCloseTo(R + 0.25, 9);
    expect(c.wheels).toHaveLength(2);
    // Flottants (−rank × 3,3 + 0,75 n'est pas exact) : au 1e-9 près.
    expect(c.wheels[0].x - c.x).toBeCloseTo(-0.75, 9);
    expect(c.wheels[1].x - c.x).toBeCloseTo(0.75, 9);
    for (const w of c.wheels) { expect(w.y).toBeCloseTo(R, 9); expect(w.angle).toBe(0); }
  }
  const g = s.cars[4];
  expect(g.y).toBeCloseTo(R + 0.25 + h, 9);
  for (const w of g.wheels) {
    expect(w.y).toBeCloseTo(R + h, 9);
    expect(w.angle).toBeLessThan(0);   // sens de la marche (convention anti-horaire du monde)
  }
  expect(s.heights).toEqual([0, 0, 0, 0, h]);
  expect(s.t).toBe(t);
});

test('titleScene : avec moins de pilotes (course sans robots), une seule voiture, centrée', () => {
  const s = titleScene([GALAHAD], 0.3, CONFIG);
  expect(s.cars).toHaveLength(1);
  expect(s.centerX).toBeCloseTo(0, 9);
});

test('defaultPilotSeed (déplacé dans pilots) : entier de [0, 2³²) décorrélé de la graine, celui que createRaceSim utilise', () => {
  expect(defaultPilotSeed(1)).toBe((1 ^ 0x9e3779b9) >>> 0);
  expect(defaultPilotSeed(123)).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(defaultPilotSeed(2 ** 31 + 5))).toBe(true);
  expect(createRaceSim(generateTrack(1, 1680, CONFIG), CONFIG, { robots: true }).pilotSeed).toBe(defaultPilotSeed(1));
});

test('Renderer.drawTitle : ciel, sol #8b8b8b, cinq ombres avant les voitures, cinq carrosseries image (setArt), sol à 62 % de la hauteur', () => {
  const { ctx, calls, state } = fakeCtx();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as RenderingContext);
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 1280 });
  Object.defineProperty(canvas, 'clientHeight', { value: 800 });
  const renderer = new Renderer(canvas, CONFIG);
  const img = (n: string) => ({ name: n }) as unknown as CanvasImageSource;
  renderer.setArt({ bodies: new Map([GALAHAD, ...PILOTS].map((p) => [p.id, img(p.id)])), wheel: img('wheel'), flames: null, star: null, loaded: [], failed: [] });
  calls.length = 0;
  const scene = titleScene(pilots, 0.2, CONFIG);
  renderer.drawTitle(scene);
  const names = calls.map((c) => c.name);
  expect(names.slice(0, 3)).toEqual(['setTransform', 'clearRect', 'drawImage']);   // ciel juste après l'effacement (globalAlpha remis à 1 avant)
  // Sol : un `fillRect` gris (le faux contexte note le nom de la méthode : `fillRect`, pas `fill`).
  const ground = calls.find((c) => c.name === 'fillRect' && c.fillStyle === '#8b8b8b');
  expect(ground).toBeDefined();
  const shadows = calls.filter((c) => c.name === 'ellipse' && c.fillStyle === '#000000');
  expect(shadows).toHaveLength(5);
  const bodies = calls.filter((c) => c.name === 'drawImage' && typeof (c.args[0] as { name?: string }).name === 'string' && (c.args[0] as { name: string }).name !== 'wheel');
  expect(bodies.map((c) => (c.args[0] as { name: string }).name)).toEqual(scene.cars.map((c) => c.id));
  expect(calls.indexOf(shadows[4])).toBeLessThan(calls.indexOf(bodies[0]));
  // Le sol (y = 0 du monde) tombe à TITLE_GROUND_FRAC de la hauteur du tampon : l'ombre d'un copain au sol y est posée.
  const h = canvas.height;
  expect(shadows[0].args[1] as number).toBeCloseTo(TITLE_GROUND_FRAC * h, 0);
  // Rien ne fuit : pile save/restore vide, opacité 1.
  expect(state()).toMatchObject({ depth: 0, globalAlpha: 1, underflows: 0 });
  // Sans images : tout par code, toujours cinq ombres, aucune image hormis le ciel (2 copies).
  renderer.setArt({ bodies: new Map(), wheel: null, flames: null, star: null, loaded: [], failed: [] });
  calls.length = 0;
  renderer.drawTitle(scene);
  expect(calls.filter((c) => c.name === 'drawImage')).toHaveLength(2);
  expect(calls.filter((c) => c.name === 'ellipse' && c.fillStyle === '#000000')).toHaveLength(5);
});
```

- [ ] **Step 11 : Vérifier l'échec** : `npx vitest run tests/title-scene.test.ts` → FAIL (`colorHex` non exporté, module `title` absent).

- [ ] **Step 12 : Implémenter** :
  - `src/cars/pilots.ts` : `export function colorHex(n: number): string` (corps de `simulate.ts` l. 151–153) et `export function defaultPilotSeed(trackSeed: number): number` (corps de l. 159, sur le nombre) ; `src/sim/simulate.ts` : supprimer les deux fonctions locales, les importer de `../cars/pilots`, `defaultPilotSeed(track.seed)` l. 189.
  - `src/render/camera.ts` : `reset(): void` (`started = false`).
  - `src/render/title.ts` selon l'interface. Tableau `cars` construit du rang 4 au rang 0 ; `heights` dans le même ordre ; `centerX` = moyenne des x de la première et de la dernière voiture.
  - `src/render/renderer.ts` : `drawTitle(scene)` : même début que `draw` (`setTransform`, `globalAlpha = 1`, `clearRect`, ciel avec `camera.x = scene.centerX`), caméra privée `titleCamera = new Camera(cfg)` mise à jour à chaque appel par `update(centerX, (TITLE_GROUND_FRAC − 0.5) × VISIBLE_HEIGHT_M, 0, 1)` après `reset()` (ou une caméra neuve : la première mise à jour se cale sans lissage), sol : `fillRect` de `y = toScreen(0)` jusqu'en bas en `#8b8b8b`, liseré `#c8c8c8` de 2 px, ombres par une fonction locale (mêmes constantes que `drawShadow` : les exporter de `car.ts` sous `SHADOW_RX_M`, `SHADOW_RY_M`, `SHADOW_ALPHA` plutôt que les recopier), puis `drawCar(ctx, car, ppm, scene.t, toScreen, this.cfg, art)`.
  - `npx vitest run tests/title-scene.test.ts tests/render-sprites.test.ts tests/renderer-art.test.ts tests/simulate.test.ts tests/deps.test.ts tests/pilots.test.ts` → vert ; `npm run typecheck` → 0.

- [ ] **Step 13 : Commit** : `git add src/render/title.ts tests/title-scene.test.ts && git commit -m "feat: scène du titre (Galahad qui rebondit, copains de la grille), Renderer.drawTitle" -- src/render/title.ts src/render/renderer.ts src/render/car.ts src/render/camera.ts src/cars/pilots.ts src/sim/simulate.ts tests/title-scene.test.ts`

---

## Partie 4 — `Game` : machine branchée, décompte, pause, orientation, historique, AUTRE PISTE, ENCORE (Steps 14 à 19)

**Files:**
- Create: `tests/game-screens.test.ts`, `tests/helpers/racing.ts`, `src/vite-env.d.ts`
- Modify: `src/game.ts` (refonte, à éditer avec `Edit` après relecture, jamais réécrit d'un bloc sans l'avoir relu), `src/main.ts`, `vite.config.ts`, `package.json`, `src/ui/hud.ts` (`setRacers`, `setRaceVisible`, `showFinished`), `src/ui/jump-button.ts` (`setVisible`, règle `[hidden]`), `src/render/effects.ts` (`clear`), `tests/hud.test.ts`, `tests/game-frame.test.ts`, `tests/renderer-art.test.ts`

**Interfaces :**
- Consumes : `transition`, `INITIAL_STATE` (Partie 1) ; `Screens` (Partie 2) ; `titleScene`, `Renderer.drawTitle` (Partie 3) ; `loadFont` ; `createRaceSim`, `generateTrack`, `posesOf`, `jumpReady`, `rankEntriesOf`.
- Produces :

```ts
// src/game.ts
export type GameState = Phase;   // réexport : 'title' | 'countdown' | 'racing' | 'finished' | 'podium' | 'paused' | 'error'
export interface GameOptions { seed: number; length: number; debug: boolean; version?: string }   // version : '' par défaut
export class Game {
  constructor(canvas: HTMLCanvasElement, hudRoot: HTMLElement, opts: GameOptions, art?: Promise<Art>);
  /** Branche les écouteurs et montre le TITRE (plus la course) ; la boucle tourne dès maintenant (scène du titre). */
  start(): void;
  /** JOUER : title → countdown ; sans effet ailleurs. Le plein écran est demandé au prochain `pointerup` (ou tout de suite au clavier). */
  play(): void;
  /** AUTRE PISTE (titre seulement) : seed = Date.now() % 100000, URL réécrite (`?seed=` ; `len` et `debug` gardés), nouvelle course (piste et copains). */
  otherTrack(): void;
  /** REPRENDRE (pause seulement, et seulement en paysage) : → countdown à 3, puis la course reprend où elle en était. */
  resume(): void;
  /** ENCORE (finished, podium) : nouvelle course sur la même graine (mêmes piste et copains) → countdown. */
  again(): void;
  /** MENU (finished, podium) : → title, nouvelle course sur la même graine (le titre montre les mêmes copains). */
  menu(): void;
  get state(): GameState;
  get time(): number;              // temps de course (0 au titre et pendant le premier décompte)
  get seed(): number;              // graine courante (change à AUTRE PISTE)
  get pilots(): Pilot[];           // ordre de la grille, Galahad en premier
  get countdownText(): string | null;   // '3' | '2' | '1' pendant countdown, 'PARTEZ' la première seconde de racing, null sinon (e2e)
  get portrait(): boolean;         // innerHeight > innerWidth, lu à start(), à chaque resize, et à play()/resume()
  progress(id: string): number;
  // inchangés : frameSteps, jumps, respawns, throttlePressed, art, airHeight
  // Gardés tels quels (privés, lus par les tests via `internals` et par les e2e via `__game.sim`) : les champs `sim`, `loop`, `throttle`,
  // `jumpInput` et la méthode `step(i, pressed, events)` : `newRace` RÉASSIGNE `sim`, `displayedRank`, `finishTime`, `finishShown`, `jumpCount`,
  // `respawnLog`, `errors` et remet `loop.acc = 0` + `loop.history.reset(...)` (pas d'objet `RaceRun` : `tests/game-frame.test.ts` l. 63–77
  // remplace `internals.step` et lit `internals.loop.acc`, `tests/hud.test.ts` l. 236 lit `internals.sim`, `e2e/jump.spec.ts` l. 86 et
  // `e2e/sprites.spec.ts` l. 84 lisent `__game.sim`). Les `readonly` de ces champs sont retirés.
}
// src/ui/hud.ts
export class Hud {
  /** Reconstruit les cinq couloirs et la couleur de la petite voiture (nouvelle course : autres copains) ; marqueurs à 0 %, position vide, chrono 00:00. */
  setRacers(racers: readonly HudRacer[]): void;
  /** Cache (titre) ou montre (décompte, course) le chrono, la position et la barre ; fps et compteur d'images (debug) restent. */
  setRaceVisible(visible: boolean): void;
  /** Calque ARRIVÉE : chrono, ENCORE (onAgain) et MENU (onMenu), tous deux data-no-pedal (décision Q2 du papa). */
  showFinished(seconds: number, onAgain: () => void, onMenu: () => void): void;
}
// src/ui/jump-button.ts
export class JumpButton { setVisible(visible: boolean): void }   // attribut hidden ; la feuille gagne `.jump-button[hidden]{display:none}` (le bouton est display:flex)
// src/render/effects.ts
export class Effects { clear(): void }  // plus aucune particule
// tests/helpers/racing.ts
/** `game.start()`, `game.play()`, puis des images de 1 s (`raf(now)`) jusqu'à `racing` ; rend le `now` atteint. */
export function startRacing(game: Game, raf: () => FrameRequestCallback, now = 0): number;
// src/vite-env.d.ts
declare const __APP_VERSION__: string;
```

Comportement de `Game` (ce que le code doit faire, pas comment) :
- **Course** : `newRace(seed)` remplace l'état d'une course : `generateTrack`, `this.sim = createRaceSim(track, cfg, { robots: true })`, `loop.acc = 0`, `loop.history.reset(posesOf(sim))`, `displayedRank` neuf, `finishTime = null`, `finishShown = false`, `jumpCount = 0`, `respawnLog.length = 0`, `errors = 0`, `camera.reset()`, `effects.clear()`, `hud.setRacers(…)`, `hud.hide()`, `jumpInput.clear()`. Le constructeur appelle `newRace(opts.seed)` (le titre a besoin des copains) ; `otherTrack` (nouvelle graine), `again` et `menu` (même graine) aussi.
- **fps (debug)** : compté dans `frame`, plus dans `present` (le titre et le décompte ont un fps aussi ; `e2e/jump.spec.ts` l. 52 attend `.hud-fps` visible). `updateRank` et `setProgress` ne sont appelés qu'en course, à une image qui a fait un pas (inchangé).
- **Boucle** (`frame`) : `elapsed` comme aujourd'hui ; selon la phase :
  - `title` : `renderer.drawTitle(titleScene(this.pilots, now / 1000, cfg))` dans le `try` de rendu existant (une exception → `error`, « Oups ! Recharge la page », boucle arrêtée) ; HUD de course caché, bouton saut caché.
  - `countdown` : `countdownElapsed += elapsed` ; **d'abord** le test `countdownElapsed ≥ COUNTDOWN_SECONDS` : événement `go`, `goShownUntil = now + COUNTDOWN_GO_SECONDS × 1000`, `screens.showCountdown('PARTEZ')` ; **sinon** texte `String(ceil(COUNTDOWN_SECONDS − countdownElapsed))` (3, 2, 1 ; jamais « 0 », écrit seulement s'il change) ; **aucun pas de simulation** ; rendu de la scène de course aux poses du dernier pas (`loop.history.at(1)`, `presentFrame` avec `steps: 0`) : la grille, caméra calée ; HUD visible (chrono au temps de course, barre, position vide), bouton saut visible mais grisé ; `jumpInput.clear()` à chaque image.
  - `racing` / `finished` : comme aujourd'hui (`runFrame`, `present`, HUD) ; `screens.hide()` quand `now ≥ goShownUntil`.
  - `paused` : rendu de la scène aux poses du dernier pas (figée), aucun pas, `jumpInput.clear()` ; l'onglet caché n'a de toute façon pas de `requestAnimationFrame`.
  - `error` : boucle arrêtée (inchangé).
- **Événements** : `play()` → `transition('play')` ; si la phase devient `countdown` : `countdownElapsed = 0`, `screens.showCountdown('3')`, `hud.setRaceVisible(true)`, `jumpButton.setVisible(true)`, `armHistory()` ; plein écran : `window.addEventListener('pointerup', requestFullscreen, { once: true })` où `requestFullscreen` = `document.documentElement.requestFullscreen?.()?.catch(() => {})` (le `pointerup` accorde l'activation que le `pointerdown` tactile n'accorde pas ; le chemin clavier, sans pointeur, se passe de plein écran : la tablette est tactile). L'image qui fait passer en `racing` (`go`) ne fait **aucun pas** : le premier pas de course est à l'image suivante.
  - `pause()` (privé) : depuis `countdown` ou `racing` : `transition('pause')`, `screens.showPaused(this.portrait)`, `jumpInput.clear()` ; déclenché par `popstate` (→ `historyArmed = false`), `visibilitychange` caché, `resize` en portrait, et **tout de suite après `play()` ou `resume()` si la tablette est déjà en portrait** (JOUER tapé en portrait → décompte → TOURNE aussitôt, spec §4).
  - `resume()` : seulement si `paused` et pas en portrait : `transition('resume')` → `countdown` (comme `play` : décompte à 3, `armHistory()`), sans toucher à `sim` (le chrono reprend).
  - `readPortrait()` : `portrait = innerHeight > innerWidth`, appelé par `start()`, `onResize`, `play()`, `resume()`.
  - `onResize` : `renderer.resize()` ; `readPortrait()` ; portrait et phase `countdown` ou `racing` → `pause()` ; phase `paused` → `screens.setPortrait(portrait)`.
  - `finish` : à l'événement 'finish' de Galahad (inchangé) ; le calque ARRIVÉE (après `FINISH_COAST_SECONDS`) reçoit `again` et `menu` (Q2). `popstate` pendant `finished` → `menu()`.
  - `again()` / `menu()` : `transition` puis `newRace(this.opts.seed)` ; `again` enchaîne comme `play` (décompte) ; `menu` montre le titre (`screens.showTitle()`, HUD et bouton saut cachés).
  - `otherTrack()` : titre seulement ; `opts.seed = Date.now() % 100000` ; `history.replaceState(null, '', '?' + params)` où `params` = `location.search` avec `seed` remplacé (`URLSearchParams`), `len` et `debug` gardés ; `newRace(seed)`.
  - **Historique** : `armHistory()` : si `!historyArmed` → `history.pushState({ galahad: true }, '')`, `historyArmed = true` ; sinon `history.replaceState({ galahad: true }, '')`. `popstate` → `historyArmed = false`, puis `pause()` ou `menu()` selon la phase. Les tests jsdom lisent `history.length`.
- **Debug** : `__game` posé dans le constructeur comme aujourd'hui (le titre expose déjà `pilots` et `seed`).

- [ ] **Step 14 : Helper et tests de câblage** : `tests/helpers/racing.ts` selon l'interface ; puis `tests/game-screens.test.ts` (jsdom ; même `beforeEach`/`afterEach` que `tests/hud.test.ts` : faux `requestAnimationFrame`, `performance.now` à 0, `getContext` vide, `Renderer.resize`/`draw`/`drawTitle` interceptés).

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/game';
import { Renderer } from '../src/render/renderer';
import type { RaceSim } from '../src/sim/simulate';
import { defaultPilotSeed, drawPilots, GALAHAD } from '../src/cars/pilots';
import { placeCar } from '../src/physics/car';
import { heightAt } from '../src/track/query';
import { startRacing } from './helpers/racing';

const DT = CONFIG.PHYSICS_DT;
let raf: FrameRequestCallback | null = null;
const disposers: (() => void)[] = [];
let drawn: { title: number; race: number };

beforeEach(() => {
  raf = null;
  drawn = { title: 0, race: 0 };
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { raf = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as RenderingContext);
  vi.spyOn(Renderer.prototype, 'resize').mockImplementation(() => {});
  vi.spyOn(Renderer.prototype, 'draw').mockImplementation(() => { drawn.race++; });
  vi.spyOn(Renderer.prototype, 'drawTitle').mockImplementation(() => { drawn.title++; });
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});
afterEach(() => {
  for (const d of disposers.splice(0)) d();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.body.innerHTML = ''; document.head.innerHTML = '';
  history.replaceState(null, '', '/');
});

interface Internals { sim: RaceSim; stop(): void; throttle: { dispose(): void; pressed: boolean }; jumpInput: { dispose(): void; pending: boolean } }
function makeGame(seed = 1, debug = false) {
  const canvas = document.createElement('canvas');
  const root = document.createElement('div');
  document.body.append(canvas, root);
  const game = new Game(canvas, root, { seed, length: 1680, debug, version: '1.1.0' });
  const internals = () => game as unknown as Internals;
  disposers.push(() => { internals().stop(); internals().throttle.dispose(); internals().jumpInput.dispose(); });
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  return { game, root, q, internals };
}
const pointer = (type: string, id: number, target: EventTarget = window) => {
  const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'pointerId', { value: id }); target.dispatchEvent(e);
};
const frames = (n: number, now: number, stepMs = DT * 1000): number => { for (let i = 0; i < n; i++) { now += stepMs; raf!(now); } return now; };
const setOrientation = (w: number, h: number) => {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
  window.dispatchEvent(new Event('resize'));
};

test('start : titre, scène du titre dessinée, aucune course dessinée, HUD de course et bouton saut cachés, sim figée', () => {
  const { game, q, internals } = makeGame();
  game.start();
  expect(game.state).toBe('title');
  expect(q('.screen-title').hidden).toBe(false);
  frames(30, 0, 1000 / 60);
  expect(drawn).toEqual({ title: 30, race: 0 });
  expect(internals().sim.time).toBe(0);
  for (const sel of ['.hud-time', '.hud-bar', '.hud-position', '.jump-button']) expect(q(sel).hidden, sel).toBe(true);
  expect(q('.title-version').textContent).toBe('v1.1.0');
  expect(game.pilots.map((p) => p.id)).toEqual([GALAHAD, ...drawPilots(defaultPilotSeed(1))].map((p) => p.id));
});

test('JOUER (pointerdown) → décompte 3, 2, 1 sans aucun pas, PARTEZ la première seconde de course, puis course ; HUD visible, bouton saut grisé pendant le décompte', () => {
  const { game, q, internals } = makeGame();
  game.start();
  let now = 0;
  pointer('pointerdown', 1, q('.btn-play'));
  expect(game.state).toBe('countdown');
  expect(q('.screen-title').hidden).toBe(true);
  expect(q('.hud-time').hidden).toBe(false);
  expect(q('.jump-button').hidden).toBe(false);
  now += 1000 / 60; raf!(now);
  expect(q('.jump-button').classList.contains('is-waiting')).toBe(true);   // grisé : pas de saut pendant le décompte
  const texts: string[] = [q('.countdown-text').textContent!];
  let i = 1;
  // Images de 1/60 s jusqu'au passage en course : l'image qui fait passer à `racing` ne fait aucun pas (le premier pas est à l'image suivante).
  for (; game.state === 'countdown' && i < 200; i++) {
    now += 1000 / 60; raf!(now);
    const t = q('.countdown-text').textContent!;
    if (texts[texts.length - 1] !== t) texts.push(t);
    expect(internals().sim.time, `image ${i}`).toBe(0);
  }
  expect(game.state).toBe('racing');
  expect(i).toBeGreaterThanOrEqual(178);   // ≈ 3 s à 60 images par seconde, aux arrondis près
  expect(i).toBeLessThanOrEqual(182);
  expect(texts).toEqual(['3', '2', '1', 'PARTEZ']);
  expect(game.countdownText).toBe('PARTEZ');
  expect(drawn.race).toBeGreaterThan(170);   // la grille est dessinée pendant le décompte
  // Première seconde de course : PARTEZ affiché, la course avance ; puis le calque se retire.
  now = frames(30, now);
  expect(internals().sim.time).toBeCloseTo(30 * DT, 6);
  expect(q('.screen-countdown').hidden).toBe(false);
  now = frames(40, now);
  expect(q('.screen-countdown').hidden).toBe(true);
  expect(game.countdownText).toBeNull();
});

test('doigt gardé posé depuis JOUER : Galahad avance dès PARTEZ ; le pointerup sur le bouton caché relâche le gaz', () => {
  const { game, q, internals } = makeGame();
  game.start();
  pointer('pointerdown', 4, q('.btn-play'));
  expect(internals().throttle.pressed).toBe(true);
  let now = startRacing(game, () => raf!, 0);   // ne touche pas au doigt : le décompte s'écoule avec le doigt posé
  const x0 = game.progress('galahad');
  now = frames(120, now);
  expect(game.progress('galahad') - x0).toBeGreaterThan(2);
  pointer('pointerup', 4, q('.btn-play'));
  expect(internals().throttle.pressed).toBe(false);
});

test('startRacing : helper → racing, time 0 au premier pas', () => {
  const { game } = makeGame();
  const now = startRacing(game, () => raf!);
  expect(game.state).toBe('racing');
  expect(now).toBeGreaterThanOrEqual(CONFIG.COUNTDOWN_SECONDS * 1000);
  expect(game.time).toBe(0);
});

test('pause en course (popstate) : PAUSE + REPRENDRE, sim figée, demande de saut jetée ; REPRENDRE → décompte à 3 → la course reprend au même temps', () => {
  const { game, q, internals } = makeGame();
  pointer('pointerdown', 1);
  let now = startRacing(game, () => raf!);
  now = frames(120, now);
  const t0 = internals().sim.time;
  const x0 = game.progress('galahad');
  pointer('pointerdown', 9, q('.jump-button'));
  expect(internals().jumpInput.pending).toBe(true);
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(game.state).toBe('paused');
  expect(q('.pause-text').textContent).toBe('PAUSE');
  expect(q('.btn-resume').hidden).toBe(false);
  now = frames(60, now);
  expect(internals().sim.time).toBe(t0);
  expect(internals().jumpInput.pending).toBe(false);
  q('.btn-resume').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
  now = frames(3, now, 1000);
  expect(game.state).toBe('racing');
  expect(internals().sim.time).toBe(t0);
  expect(game.progress('galahad')).toBe(x0);
  now = frames(10, now);
  expect(internals().sim.time).toBeCloseTo(t0 + 10 * DT, 6);
  expect(game.jumps).toBe(0);
});

test('onglet caché pendant le décompte → pause ; le retour visible ne reprend pas tout seul ; REPRENDRE relance le décompte à 3', () => {
  const { game, q } = makeGame();
  game.start();
  game.play();
  frames(1, 0, 1500);
  expect(q('.countdown-text').textContent).toBe('2');
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(game.state).toBe('paused');
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(game.state).toBe('paused');
  game.resume();
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
});

test('portrait pendant le décompte → TOURNE, REPRENDRE caché et inactif ; paysage → PAUSE + REPRENDRE ; tap → décompte à 3', () => {
  const { game, q } = makeGame();
  game.start();
  game.play();
  setOrientation(800, 1280);
  expect(game.state).toBe('paused');
  expect(game.portrait).toBe(true);
  expect(q('.pause-text').textContent).toBe('TOURNE');
  expect(q('.btn-resume').hidden).toBe(true);
  game.resume();
  expect(game.state).toBe('paused');   // refusé en portrait
  setOrientation(1280, 800);
  expect(q('.pause-text').textContent).toBe('PAUSE');
  expect(q('.btn-resume').hidden).toBe(false);
  q('.btn-resume').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('countdown');
  expect(q('.countdown-text').textContent).toBe('3');
});

test('portrait au titre : rien ne change (pas de pause au titre) ; JOUER tapé en portrait → décompte puis TOURNE aussitôt', () => {
  const { game, q } = makeGame();
  game.start();
  setOrientation(800, 1280);
  expect(game.state).toBe('title');
  expect(q('.screen-pause').hidden).toBe(true);
  game.play();
  expect(game.state).toBe('paused');
  expect(q('.pause-text').textContent).toBe('TOURNE');
  setOrientation(1280, 800);
  game.resume();
  expect(game.state).toBe('countdown');
});

test('portrait lu dès start() sans resize préalable (fenêtre déjà en portrait au chargement)', () => {
  Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 1280, configurable: true });
  const { game } = makeGame();
  game.start();
  expect(game.portrait).toBe(true);
});

test('le bouton saut caché le reste malgré son display:flex : règle .jump-button[hidden]{display:none}', () => {
  makeGame().game.start();
  const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  expect(rules.find((r) => r.selectorText === '.jump-button')?.style.display).toBe('flex');
  expect(rules.find((r) => r.selectorText === '.jump-button[hidden]')?.style.display).toBe('none');
});

test('fps (debug) compté au titre et pendant le décompte, pas seulement en course', () => {
  const { game, q } = makeGame(1, true);
  game.start();
  frames(70, 0, 1000 / 60);   // > 1 s au titre
  expect(q('.hud-fps').hidden).toBe(false);
  expect(q('.hud-fps').textContent).toMatch(/^\d+ fps$/);
});

test('historique : une entrée poussée au premier décompte, consommée par popstate, repoussée à la reprise ; replaceState sinon (pile stable)', () => {
  const { game, internals } = makeGame();
  game.start();
  const len0 = history.length;
  game.play();
  expect(history.length).toBe(len0 + 1);
  window.dispatchEvent(new PopStateEvent('popstate'));   // jsdom ne dépile pas tout seul : on simule le navigateur
  expect(game.state).toBe('paused');
  game.resume();
  expect(history.length).toBe(len0 + 2);   // repoussée (le navigateur réel avait dépilé la première)
  // Sans popstate entre-temps : une vraie arrivée puis ENCORE ne poussent rien de plus (replaceState : l'entrée est encore là).
  let now = startRacing(game, () => raf!, 10_000);
  const { sim } = internals();
  placeCar(sim.cars[0].body, sim.track.xFinish - 3, (x) => heightAt(sim.track, x), 0, CONFIG);
  pointer('pointerdown', 1);
  for (let f = 0; f < 600 && game.state !== 'finished'; f++) now = frames(1, now);
  expect(game.state).toBe('finished');
  const len1 = history.length;
  game.again();
  expect(game.state).toBe('countdown');
  expect(history.length).toBe(len1);
});

test('AUTRE PISTE : nouvelle graine (Date.now() % 100000) dans l’URL (len et debug gardés), nouveaux copains, toujours au titre, aucune course dessinée', () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_761_300_000_123);
  history.replaceState(null, '', '/?seed=1&len=1680&debug=1');
  const { game, q } = makeGame(1, true);
  game.start();
  const before = game.pilots.map((p) => p.id);
  q('.btn-other').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(game.state).toBe('title');
  expect(game.seed).toBe(1_761_300_000_123 % 100_000);
  expect(new URLSearchParams(location.search).get('seed')).toBe(String(game.seed));
  expect(new URLSearchParams(location.search).get('len')).toBe('1680');
  expect(new URLSearchParams(location.search).get('debug')).toBe('1');
  const expected = [GALAHAD, ...drawPilots(defaultPilotSeed(game.seed))].map((p) => p.id);
  expect(game.pilots.map((p) => p.id)).toEqual(expected);
  // Graine 1 : diego, timothé, liam, malo ; graine 123 : timothé, diego, matthis, pablo (mesuré) : les copains ont bien changé.
  expect(expected).not.toEqual(before);
  expect([...q('.hud-bar').querySelectorAll<HTMLElement>('.hud-lane')].map((l) => l.style.color).length).toBe(5);
  expect(game.time).toBe(0);
});

test('AUTRE PISTE ignoré hors du titre', () => {
  const { game } = makeGame();
  startRacing(game, () => raf!);
  const seed = game.seed;
  game.otherTrack();
  expect(game.seed).toBe(seed);
  expect(game.state).toBe('racing');
});

test('arrivée : calque ARRIVÉE avec ENCORE et MENU (data-no-pedal) ; ENCORE → décompte sur la même piste et les mêmes copains, chrono à 0 ; MENU → titre', () => {
  // Reprendre la mise en place de tests/game-frame.test.ts : Galahad posé 3 m avant la ligne, doigt posé, images jusqu'à finished,
  // puis FINISH_COAST_SECONDS d'images : le calque apparaît.
  // Assertions : .hud-overlay contient deux boutons ENCORE et MENU, tous deux data-no-pedal ; click ENCORE → state 'countdown',
  // game.time 0, game.pilots identiques, game.seed identique, .hud-overlay retiré ; après le décompte et 60 images, time > 0.
  // Puis une seconde arrivée (même mise en place) et click MENU → 'title', .screen-title visible, HUD caché, mêmes pilotes.
});

test('erreur de rendu au titre (drawTitle lève) → error, « Oups ! Recharge la page », boucle arrêtée', () => {
  vi.spyOn(Renderer.prototype, 'drawTitle').mockImplementation(() => { throw new Error('canvas perdu (test)'); });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { game, root } = makeGame();
  game.start();
  raf!(16);
  expect(game.state).toBe('error');
  expect(root.querySelector('.hud-error')?.textContent).toBe('Oups ! Recharge la page');
  expect(error).toHaveBeenCalled();
  const again = raf;
  raf = null;
  again!(32);
  expect(raf).toBeNull();   // plus de requestAnimationFrame
});

test('aucun pas de course hors de racing et finished : 3 échecs de stepRace en course → error, comme avant', () => {
  // Reprendre le scénario de tests/game-frame.test.ts (setAngularVelocity qui lève) trois fois de suite → state 'error'.
});
```

Les deux tests laissés en commentaire sont écrits en entier par l'implémenteur, sur le modèle de `tests/game-frame.test.ts` (placement de Galahad avant la ligne avec `placeCar`, exception injectée dans `Matter.Body.setAngularVelocity`). Dans le test « historique », préférer la vraie arrivée à l'écriture de `race.finishTime`.

- [ ] **Step 15 : Vérifier l'échec** : `npx vitest run tests/game-screens.test.ts` → FAIL (`play`, `Screens`, `drawTitle` absents de `Game`).

- [ ] **Step 16 : Implémenter `Game` et ses voisins** :
  - `src/render/effects.ts` : `clear()` ; `src/ui/jump-button.ts` : `setVisible` et la règle `.jump-button[hidden]{display:none}` ; `src/ui/hud.ts` : `setRacers` (retire les couloirs et refait la barre, remet la couleur de `.hud-position-car`, `lastTenths` et `lastRank` à neuf, `setTime(0)`), `setRaceVisible` (`hidden` sur `time`, `position`… attention : `position` a déjà son `hidden` piloté par `setPosition` : garder un drapeau `raceVisible` et un `refreshPosition()` qui applique `hidden = !raceVisible || rank === null`), `showFinished(seconds, onAgain, onMenu)` : bouton MENU `.hud-menu` (≥ 96 px, `data-no-pedal`) à côté d'ENCORE (`.hud-again`).
  - `src/game.ts` selon « Comportement de `Game` ». `GameState` devient l'alias de `Phase`. La phase initiale est `title` ; `start()` n'appelle plus `_state = 'racing'`. Écouteurs ajoutés dans `start()` : `popstate`, `resize` (existant, enrichi), `visibilitychange` (existant, enrichi : caché → `pause()`).
  - `src/vite-env.d.ts` : `declare const __APP_VERSION__: string;` ; `vite.config.ts` : `import pkg from './package.json';` et `define: { __APP_VERSION__: JSON.stringify(pkg.version) }` (Vite charge sa config par esbuild, qui lit le JSON ; `vite.config.ts` n'est pas dans l'`include` de `tsconfig`) ; `src/main.ts` : `void loadFont(document)` avant `new Game(canvas, hud, { ...opts, version: __APP_VERSION__ }, art)`.
  - `package.json` : `"version": "1.1.0"` (décision Q3 du papa : la version bouge à chaque tâche déployée).
  - Tests existants (13 appels de `game.start()` : `game-frame` 3, `hud` 5, `renderer-art` 5), **sans affaiblir une assertion** :
    - partout : `pressFinger(); game.start();` → `pressFinger(); let now = startRacing(game, () => raf!);` et **tous les `now` absolus deviennent relatifs** : `raf!(5 + f * DT * 1000)` → `raf!(now + 5 + f * DT * 1000)` (`tests/hud.test.ts` l. 304, 322, 348–358 ; `tests/game-frame.test.ts` l. 148–171 : `let now = 5` → `now += 5`), sinon `elapsed = 0` et aucun pas ;
    - `tests/game-frame.test.ts` premier test (l. 86–116) : `drawn.length = 0` après `startRacing`, et la caméra témoin reçoit d'abord **une** mise à jour sur la pose immobile du décompte (`camera.update(target.x, target.y, 0, 1)` avec la cible de `posesOf(sim)[0]` avant tout pas) : la caméra de `Game` a lissé depuis la grille, une caméra neuve se calerait d'un coup ;
    - `tests/renderer-art.test.ts` l. 195–197 : `draw.mockClear()` après `startRacing`, puis `frames` à partir du `now` rendu ;
    - `tests/hud.test.ts` l. 342–359 (« pas de recalcul… ») : les espions `update` et `setProgress` se posent **après** `startRacing` (aucun appel pendant le décompte, ce que ce test vérifie aussi : `expect(update).not.toHaveBeenCalled()` juste après `startRacing`).
  - `npm run typecheck` → 0 ; `npm test` → tout vert (≈ 3 min).

- [ ] **Step 17 : Mutants à tuer avant de commiter** (chacun réécrit puis restauré, le test cité doit rougir) : titre retiré du DOM au `play` (test « pointerup sur JOUER caché ») ; `stepRace` appelé pendant `countdown` (« sans aucun pas ») ; reprise directe en `racing` sans décompte (« REPRENDRE → décompte à 3 ») ; `resume()` accepté en portrait ; `play()` en portrait sans pause (« JOUER tapé en portrait ») ; `pushState` à chaque `play` (« pile stable ») ; `otherTrack` sans `replaceState` ; exception de `drawTitle` non rattrapée ; texte du décompte calculé avant le test `go` (« `['3','2','1','PARTEZ']` », pas de « 0 ») ; règle `.jump-button[hidden]` retirée.

- [ ] **Step 18 : Commit** : `git add src/vite-env.d.ts tests/game-screens.test.ts tests/helpers/racing.ts && git commit -m "feat: titre, décompte, pause et orientation branchés dans Game ; AUTRE PISTE, ENCORE, MENU ; version au titre" -- src/game.ts src/main.ts vite.config.ts src/vite-env.d.ts package.json src/ui/hud.ts src/ui/jump-button.ts src/render/effects.ts tests/game-screens.test.ts tests/helpers/racing.ts tests/hud.test.ts tests/game-frame.test.ts tests/renderer-art.test.ts`

- [ ] **Step 19 : Empreinte et frontière de la simulation** :

```bash
npx vitest run tests/empreinte.test.ts tests/pilots.test.ts tests/deps.test.ts
git diff --stat <BASE> -- src/sim src/physics src/track src/cars src/ai src/config.ts
```

Expected : `empreinte` 6/6 (`FROZEN`, `FROZEN_CONFIG` inchangés), `pilots` et `deps` verts ; le diff ne montre que `src/cars/pilots.ts` (+ `colorHex`, + `defaultPilotSeed`), `src/sim/simulate.ts` (import, deux fonctions locales retirées, `defaultPilotSeed(track.seed)`) et `src/config.ts` (+ 2 constantes, 1 commentaire).

---

## Partie 5 — Bout en bout (Steps 20 à 23)

**Files:**
- Create: `e2e/screens.spec.ts`
- Modify: `e2e/helpers.ts`, `e2e/race.spec.ts`, `e2e/jump.spec.ts`, `e2e/fosse.spec.ts`, `e2e/sprites.spec.ts`

**Interfaces (produit) :**

```ts
// e2e/helpers.ts
/** Depuis le titre : tap (CDP tactile, touchStart puis touchEnd) au centre du bouton `.btn-play`, puis attente de `racing` (décompte compris, ≤ 10 s). */
export async function startRace(page: Page): Promise<void>;
/** Tap tactile (CDP) au centre de l'élément `selector` ; `holdMs` entre touchStart et touchEnd. */
export async function tapAt(page: Page, selector: string, holdMs?: number): Promise<void>;
/** Boîte de `selector` (px CSS) ; lève si absent ou caché. */
export async function boxOf(page: Page, selector: string): Promise<Box>;
/** Collecte (tableau rempli au fil des requêtes) les adresses dont l'origine n'est pas celle du document (origine de la première requête de navigation). À brancher avant `goto`. */
export function offSiteRequests(page: Page): string[];
```

- [ ] **Step 20 : Adapter les e2e existants.** Chaque test qui faisait `goto` puis `waitForGame` puis agissait sur la course appelle `startRace(page)` après `waitForGame` (décision Q1 : le vrai chemin JOUER ; ≈ 4 s de plus par test). Précisions :
  - `race.spec.ts` « la page charge » : attend `title` au lieu de `racing`, puis `startRace` et `racing`.
  - « sans doigt » : `startRace` puis `before.time < 0.3` : le temps de course part à PARTEZ, la lecture suit `waitForState('racing')` de quelques images.
  - « HUD : place en ordinal après 1 s… » : la première seconde se lit après `startRace` (le `t < 1` garde-fou reste).
  - « course courte » et « captures » : après l'arrivée, `ENCORE` et `MENU` visibles (`button[data-no-pedal]`).
  - `sprites.spec.ts` « images lentes (1,5 s) » : la course **ne part plus au DOM prêt** : le test devient « le titre apparaît et JOUER lance le décompte sans attendre les images » : au DOM prêt, `state === 'title'`, `.btn-play` visible, `art.settled === false` ; tap JOUER → `countdown` avant que `art.settled` ne soit vrai ; puis `load` part avec les 13 images. « wheel.png muette » : idem (le titre est là, `startRace` roule, `load` part au délai).
  - `fosse.spec.ts`, `jump.spec.ts` : `startRace` après `waitForGame`.
  - Les scénarios `holdFinger` restent valables : le doigt se pose après `racing`.

- [ ] **Step 21 : Écrire `e2e/screens.spec.ts`.**

```ts
// Écrans (plan B, tâche 10) sur la tablette simulée : titre avec les copains de la graine, AUTRE PISTE, décompte, doigt gardé depuis
// JOUER, pause par portrait et reprise sans gaz, police Fredoka servie par le site, captures titre.png, decompte.png, pause.png, tourne.png.
import { expect, test } from '@playwright/test';
import { GALAHAD, defaultPilotSeed, drawPilots } from '../src/cars/pilots';   // purs : pas de matter-js dans le runner Playwright
import { CONFIG } from '../src/config';
import { SHOTS, boxOf, gameState, offSiteRequests, pilotIds, startRace, tapAt, waitForGame, waitForRaceTime, waitForState, type Box } from './helpers';

const expectedIds = (seed: number) => [GALAHAD, ...drawPilots(defaultPilotSeed(seed))].map((p) => p.id);
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('titre : état title, aucun pas, les copains de la graine dans l’ordre de la grille, JOUER et AUTRE PISTE ≥ 96 px, rien sur la bande des voitures ; capture titre.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  expect((await gameState(page)).state).toBe('title');
  await page.waitForTimeout(500);
  expect((await gameState(page)).time).toBe(0);
  expect(await pilotIds(page)).toEqual(expectedIds(1));
  const play = await boxOf(page, '.btn-play');
  const other = await boxOf(page, '.btn-other');
  const name = await boxOf(page, '.title-name');
  const version = await boxOf(page, '.title-version');
  for (const [label, b] of [['JOUER', play], ['AUTRE PISTE', other]] as const) {
    expect(b.width, label).toBeGreaterThanOrEqual(96);
    expect(b.height, label).toBeGreaterThanOrEqual(96);
  }
  // Bande des voitures : du sol (62 % de la hauteur) à 1,9 m au-dessus (voiture 1,4 m + bond 0,5 m), à l'échelle de la vue.
  const { width, height } = page.viewportSize()!;
  const ppm = height / CONFIG.VISIBLE_HEIGHT_M;
  const band: Box = { x: 0, y: 0.62 * height - 1.9 * ppm, width, height: 1.9 * ppm };
  for (const [label, b] of [['JOUER', play], ['AUTRE PISTE', other], ['nom', name], ['version', version]] as const) {
    expect(overlap(b, band), `${label} recouvre les voitures`).toBe(false);
  }
  expect(overlap(play, other)).toBe(false);
  expect(overlap(play, name)).toBe(false);
  await expect(page.locator('.hud-time')).toBeHidden();
  await expect(page.locator('.jump-button')).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/titre.png`, fullPage: true });
});

test('AUTRE PISTE : graine dans l’URL, autres copains, toujours au titre, le tap n’est pas du gaz', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await tapAt(page, '.btn-other');
  const s = await gameState(page);
  expect(s.state).toBe('title');
  expect(s.seed).not.toBe(1);
  expect(new URL(page.url()).searchParams.get('seed')).toBe(String(s.seed));
  expect(new URL(page.url()).searchParams.get('debug')).toBe('1');
  expect(await pilotIds(page)).toEqual(expectedIds(s.seed));
  expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
});

test('JOUER : décompte 3, 2, 1, PARTEZ sans aucun pas, puis course ; capture decompte.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await tapAt(page, '.btn-play');
  await waitForState(page, 'countdown', 2_000);
  const text = page.locator('.countdown-text');
  await expect(text).toHaveText('3');
  await page.screenshot({ path: `${SHOTS}/decompte.png`, fullPage: true });
  await expect(text).toHaveText('2', { timeout: 2_000 });
  expect((await gameState(page)).time).toBe(0);
  await expect(text).toHaveText('1', { timeout: 2_000 });
  await expect(text).toHaveText('PARTEZ', { timeout: 2_000 });
  await waitForState(page, 'racing', 1_000);
  await expect(page.locator('.screen-countdown')).toBeHidden({ timeout: 2_000 });
  await expect(page.locator('.hud-time')).toBeVisible();
});

test('doigt gardé posé depuis JOUER à travers le décompte : la voiture part à PARTEZ, et le doigt levé la relâche', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  const b = await boxOf(page, '.btn-play');
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
    await waitForState(page, 'racing', 10_000);
    const x0 = (await gameState(page)).progress;
    await page.waitForFunction((t) => (window as any).__game.time >= t, 2);
    expect((await gameState(page)).progress - x0).toBeGreaterThan(2);
    expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
});

test('portrait en course → TOURNE sans REPRENDRE, course figée ; paysage → PAUSE + REPRENDRE ; doigt tenu sur REPRENDRE → décompte puis course sans gaz ; captures tourne.png, pause.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  // Galahad à l'arrêt sur la grille (sans doigt, les copains ne le poussent pas avant 2 s : race.spec « sans doigt ») : sa progression
  // sert de témoin, le doigt sur REPRENDRE ne doit pas la changer.
  await startRace(page);
  await waitForRaceTime(page, 0.5);
  await page.setViewportSize({ width: 800, height: 1280 });
  await waitForState(page, 'paused', 2_000);
  await expect(page.locator('.pause-text')).toHaveText('TOURNE');
  await expect(page.locator('.btn-resume')).toBeHidden();
  await expect(page.locator('.pause-tablet')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/tourne.png`, fullPage: true });
  const { time: t1, progress: x0 } = await gameState(page);
  await page.waitForTimeout(700);
  expect((await gameState(page)).time).toBe(t1);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.pause-text')).toHaveText('PAUSE');
  const resume = await boxOf(page, '.btn-resume');
  expect(Math.min(resume.width, resume.height)).toBeGreaterThanOrEqual(96);
  await page.screenshot({ path: `${SHOTS}/pause.png`, fullPage: true });
  // Doigt posé sur REPRENDRE et GARDÉ à travers le décompte et la première seconde de course : jamais du gaz (data-no-pedal).
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: resume.x + resume.width / 2, y: resume.y + resume.height / 2 }] });
    await waitForState(page, 'countdown', 2_000);
    expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
    await waitForState(page, 'racing', 6_000);
    await waitForRaceTime(page, t1 + 1);
    const after = await gameState(page);
    expect(Math.abs(after.progress - x0), 'le doigt sur REPRENDRE n’a pas fait avancer la voiture').toBeLessThan(0.3);
    expect(await page.evaluate(() => (window as any).__game.throttlePressed)).toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
});

test('police : Fredoka chargée depuis le site, aucune requête hors site, texte visible au titre', async ({ page }) => {
  const off = offSiteRequests(page);
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  await expect(page.locator('.btn-play')).toBeVisible();
  // `document.fonts.check` rend vrai même sans @font-face Fredoka : on exige une FontFace Fredoka réellement chargée.
  await page.waitForFunction(() => [...document.fonts].some((f) => /Fredoka/.test(f.family) && f.status === 'loaded'), null, { timeout: 5_000 });
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => /Fredoka/.test(f.family) && f.status === 'loaded').map((f) => f.weight).sort());
  expect(loaded).toEqual(['600', '700']);
  const family = await page.evaluate(() => getComputedStyle(document.querySelector('.title-name')!).fontFamily);
  expect(family).toMatch(/Fredoka/);
  expect(off).toEqual([]);
});

test.describe('téléphone en paysage (844 × 390)', () => {
  test.use({ viewport: { width: 844, height: 390 } });
  test('titre : boutons ≥ 96 px, dans la fenêtre, sans recouvrement ; capture titre-telephone.png', async ({ page }) => {
    await page.goto('./?seed=1&debug=1');
    await waitForGame(page);
    const play = await boxOf(page, '.btn-play');
    const other = await boxOf(page, '.btn-other');
    const name = await boxOf(page, '.title-name');
    for (const b of [play, other, name]) {
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(844); expect(b.y + b.height).toBeLessThanOrEqual(390);
    }
    expect(Math.min(play.width, play.height)).toBeGreaterThanOrEqual(96);
    expect(Math.min(other.width, other.height)).toBeGreaterThanOrEqual(96);
    expect(overlap(play, other) || overlap(play, name) || overlap(other, name)).toBe(false);
    await page.screenshot({ path: `${SHOTS}/titre-telephone.png`, fullPage: true });
  });
});
```

- [ ] **Step 22 : Suites complètes, build sous la base, aperçu** :

```bash
npm run typecheck && npm test
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e
VITE_BASE=/Galahad-s-car-game/ npm run build && grep -o 'url([^)]*fonts[^)]*)' dist/index.html && ls dist/fonts && grep -o 'v1\.1\.0' dist/assets/index-*.js | head -1
VITE_BASE=/Galahad-s-car-game/ npx vite preview --port 4174 --strictPort   # en arrière-plan
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers E2E_LIVE_URL=http://localhost:4174/Galahad-s-car-game/ npx playwright test -c playwright.live.config.ts e2e/screens.spec.ts
```

(Le Step 22 est le seul moment où `npm run e2e` tourne en entier avant les relectures : les 20 e2e adaptés (Step 20) et les 8 nouveaux. La police compte en e2e : « police » exige deux `FontFace` Fredoka chargées, 600 et 700.)

Expected : typecheck 0 ; `npm test` tout vert (≈ 3 min, +5 fichiers) ; `npm run e2e` : **28 passed** (les 20 d'avant, adaptés, plus les 8 de `screens.spec.ts`, téléphone compris) ; `grep` : deux `url(/Galahad-s-car-game/fonts/fredoka-latin-6|700.woff2)` ; `dist/fonts` : 2 fichiers ; la version dans le bundle ; les 7 e2e des écrans verts **sous la base** (Review Focus 5), police comprise. Arrêter l'aperçu ensuite.

- [ ] **Step 23 : Commit** : `git add e2e/screens.spec.ts && git commit -m "test: e2e des écrans (titre, copains, décompte, pause, orientation, police) ; démarrage par JOUER dans les e2e" -- e2e`

---

## Partie 6 — Relectures, tours, validation, passation, fusion (Steps 24 à 31)

- [ ] **Step 24 : Quatre relectures** du diff `<BASE>..HEAD` (`<BASE>` = `106f714` recopié), par des sous-agents frais qui reçoivent ce plan, l'addendum §2 et §5, la spec §4 et §8, la passation, et la consigne de ne lancer aucun test dans l'arbre partagé tant que l'implémenteur y travaille (worktree du scratchpad avec lien `node_modules` sinon).
  - **Standard** (spec et qualité) : chaque ligne des Global Constraints pointe sur du code et un test.
  - **Adversariale.** Mutants (chacun réécrit puis restauré, le test cité doit rougir) : ceux du Step 17 ; `transition` qui accepte `pause` au titre ; REPRENDRE sans `data-no-pedal` ; JOUER **avec** `data-no-pedal` ; décompte à 2 s ; PARTEZ affiché avant le passage en `racing` ; `again` sur une nouvelle graine ; `menu` qui garde l'ancienne course ; `setRaceVisible` qui ne cache pas la barre ; police `sans-serif` seule dans `canvasFont` ; `@font-face` sans `font-display` ; `url(fonts/…)` relative ; `hud.hide()` oublié à `newRace` (calque ARRIVÉE sous le titre) ; `Effects.clear` oublié (étincelles d'une course sur le titre). Sondes : capture du titre à 3 graines (`?seed=2`, `?seed=5`, `?seed=18`) ; mesurer que la bande des voitures reste libre à 1280 × 800 et 844 × 390 ; chronométrer le temps d'image de `drawTitle` (≤ celui de `draw`) ; vérifier que `Throttle.pressed` redevient faux après un JOUER tenu puis lâché hors du bouton (déplacement du doigt) ; un `popstate` pendant `finished`.
  - **Skill `code-review`** (niveau `high`).
  - **Skill `security-review`.** Points : `history.replaceState` construit depuis `URLSearchParams` (aucune chaîne de l'URL réinjectée telle quelle hors des paramètres connus) ; `textContent` partout, `innerHTML` réservé aux SVG constants ; police de même origine ; `requestFullscreen` sans argument sensible ; `__game` seulement en `?debug=1`.

- [ ] **Step 25 : Tours de correction** (≤ 5). Chaque constat retenu est corrigé avec son test. Puis `npm run typecheck && npm test`, et `PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e` si un écran ou le câblage a changé. Commit `fix: <constat> (tour n de la tâche 10)`. Re-relecture ciblée des constats.

- [ ] **Step 26 : Validation du papa sur capture, AVANT la fusion** (comme la 8b, ruling R8b-2) : `e2e/screenshots/titre.png`, `titre-telephone.png`, `decompte.png`, `pause.png`, `tourne.png`, `arrivee.png` (ENCORE et MENU). Questions Q5 et Q6 (section « Questions pour le papa »). Un réglage demandé donne un commit `fix:` et une nouvelle capture. Chaque réponse va au registre (« DÉCISION PAPA (date) : … »).

- [ ] **Step 27 : Passation et registre.**
  - **Passation** (`docs/superpowers/handoff/2026-10-21-plan-b-passation.md`) : puce « Tâche 10 faite » dans « Où en est-on » (commits, fichiers, décisions Q1 à Q6, tests et e2e comptés), ligne 10 du tableau, « Prochaine action précise » → tâche 11 (podium : `finished` → 1,5 s → `podium`, ENCORE/MENU déjà câblés dans la machine ; le calque ARRIVÉE devient le podium), « Environnement » : la version bouge à chaque tâche déployée ; « Leçons de la session 6 ».
  - **Registre** (`docs/superpowers/handoff/sdd-ledger-plan-b.md`) : **3 à 5 lignes** « Task 10: … » en plus de la ligne `BASE` du départ : commits ; mesures (temps d'image du titre, taille de `public/fonts/`, e2e comptés) ; choix qui s'écartent du plan avec leur coût ; verdicts des relectures et tours ; à dire au papa.

```bash
git commit -m "docs: tâche 10 (écrans), passation et registre" -- docs/superpowers/handoff/2026-10-21-plan-b-passation.md docs/superpowers/handoff/sdd-ledger-plan-b.md docs/superpowers/plans/2026-10-24-plan-b-ecrans.md
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
curl -sI https://i-dmk.github.io/Galahad-s-car-game/fonts/fredoka-latin-700.woff2 | head -1   # HTTP/2 200
PLAYWRIGHT_BROWSERS_PATH=<scratchpad>/pw-browsers npm run e2e:live   # 28 verts, screens.spec compris
git checkout wip-plan-b && git merge --ff-only ccr-5b6fabc4-n96ofo && git push -u origin wip-plan-b
```

Expected : run vert ; hash du bundle servi = hash du build local à la même base ; police en 200 ; `e2e:live` tout vert ; captures du site dans `test-results/live-screenshots/`.

- [ ] **Step 29 : Tablette.** Le papa regarde le titre, le décompte, une pause (rotation) et la reprise ; fps avec `?debug=1`. Réponses au registre ; un réglage → `fix:`, nouvelle fusion (Step 28).

- [ ] **Step 30 : Clôture.** Passation « 10 validée », registre « Task 10: complete … VALIDÉE par le papa le … ; déploiement vérifié (run n) », commit `docs:`, fusion et push comme au Step 28.

- [ ] **Step 31 : Prévenir les sessions actives** s'il en est (`git ls-remote`, sessions) : nouvelle tête et fichiers touchés (`send_message`, priorité « later »).

---

## Performance

- Titre : une image = ciel (2 `drawImage`), un `fillRect`, 5 ellipses, 5 `drawCar` (≤ 15 `drawImage` avec les sprites) : moins qu'une image de course. `titleScene` alloue 5 `CarView` et 10 roues par image : négligeable (comme `sceneOf` en course), et seulement au titre.
- Décompte et pause : rendu de la scène de course sans pas ; `presentFrame` avec `alpha = 1`.
- Aucune allocation ajoutée dans la boucle de course. Le texte du décompte n'est écrit que s'il change.

## Ce que la tâche 10 ne fait pas

- Le podium, l'enchaînement `finished` → 1,5 s → `podium`, les confettis : tâche 11 (`podium` est dans la table ; `again` et `menu` sont déjà câblés).
- Le bouton son, `AudioContext.resume()`, les bips du décompte : tâche 12.
- Le cache de la police et des sprites, le manifeste, `orientation: landscape` du manifeste : tâche 13.
- Rien de la simulation ni de la piste.

## Ambiguïtés et choix

| # | Choix | Pourquoi | Coût si faux |
|---|---|---|---|
| A1 | Le décompte part au **`pointerdown`** sur JOUER (et au `click` pour le clavier) ; le plein écran est demandé au `pointerup` suivant | spec §8 : « si Galahad garde le doigt après avoir appuyé, la voiture part à PARTEZ » : un `click` n'arrive qu'au doigt levé ; le `pointerup` accorde l'activation que `pointerdown` tactile n'accorde pas | un plein écran demandé un peu plus tard que la spec (au lever du doigt) ; refus toujours ignoré |
| A2 | Les écrans sont **créés une fois et cachés par `hidden`**, jamais retirés | un élément retiré sous le doigt ne propage plus son `pointerup` à `window` : gaz bloqué (Review Focus 1) ; moins de DOM par partie | nul |
| A3 | Pas de bouton son au titre | rien à couper avant la tâche 12, qui ajoute le bouton (plan v2.1 Task 12 : « bouton son au titre et au podium ») | nul |
| A4 | `history.pushState` à l'entrée en **`countdown`** (pas `racing`) | couvre le premier décompte et ceux des reprises : un geste retour pendant un décompte met en pause au lieu de quitter la page ; le drapeau `historyArmed` reste celui du plan v2.1 | nul |
| A5 | `popstate` pendant `finished` → MENU (titre) ; pendant `title` : rien (le navigateur quitte, comportement normal) | le geste retour « sort » de la course finie ; au titre, il n'y a rien d'où sortir | nul |
| A6 | Reprise d'une pause **toujours** par un décompte à 3, le chrono reprenant où il était | spec §4 : « une pause pendant countdown relance le décompte à 3 » ; §11 : REPRENDRE → racing ; le temps de course est simulé : il ne bouge pas pendant la pause | nul |
| A7 | ARRIVÉE garde ENCORE et gagne MENU (Q2 a) ; ENCORE recrée la course sur la **même graine** (piste et copains identiques, `defaultPilotSeed`) | la machinerie `newRace` existe pour AUTRE PISTE ; le plan v2.1 « titre après 3 s » retirait le rejeu qui existe aujourd'hui ; la 11 remplace le calque par le podium sans changer la machine | si le papa préfère (b) : deux boutons de moins et une minuterie |
| A8 | Rangée du titre = la grille : Galahad devant (droite), copains derrière à 3,3 m, prénoms des copains seuls (ceux que `drawCar` écrit) | addendum §2 « dans l'ordre de la grille », « à côté de la voiture de Galahad » ; Galahad est « la voiture bleue » et son nom est dans le titre | réglage de la rangée (Q5) |
| A9 | Scène du titre dessinée sur le canvas (sol plat, ciel de la course, ombres), texte et boutons en DOM | spec §8 « voiture de Galahad qui rebondit (canvas) » ; réutilise `drawCar` et `Art` (sprites ou repli), comme la 8b l'annonçait | nul |
| A10 | Aucun pas de simulation pendant `countdown` : la grille est dessinée aux poses du dernier pas (figées) ; les copains partent à `rang × 0,3 + 0,38 s` **après PARTEZ** | le temps de course part à PARTEZ (spec §6 « Arrivée » : chrono démarré à PARTEZ) ; `RANK_HIDE_SECONDS` compte depuis là | nul |
| A11 | La police est demandée par `document.fonts.load` dans `main.ts`, et toutes les chaînes `font` listent `Fredoka, system-ui, sans-serif` : aucun drapeau « prête » | le canvas prend la police dès qu'elle est chargée, `system-ui` avant ; `font-display: swap` fait pareil en DOM ; rien n'attend | nul |
| A12 | `@font-face` dans `index.html` avec `url(/fonts/…)` absolu | Vite réécrit les URL absolues des styles de `index.html` sous `base` (vérifié) ; un `url(fonts/…)` relatif n'est pas réécrit et peut échouer | 404 de police en ligne : Review Focus 5 le voit au Step 22 |
| A13 | `colorHex` et `defaultPilotSeed(trackSeed)` déplacés dans `cars/pilots.ts` (purs) | la scène du titre et les e2e en ont besoin sans importer matter-js (`render/` et `e2e/` importent `cars/` ; `fosse.spec.ts` n'importe que `track/`) | nul (empreinte vérifiée au Step 19) |
| A18 | REPRENDRE agit au `pointerdown` et au `click` ; le voile de pause entier porte `data-no-pedal` | un doigt tenu n'émet pas de `click` ; un doigt posé sur le voile hors bouton ne doit pas devenir du gaz à PARTEZ (spec §4 « tap consommé ») | nul |
| A19 | Les champs `sim`, `loop`, `step` de `Game` gardent leurs noms et sont réassignés par `newRace` (pas d'objet `RaceRun`) | `tests/game-frame.test.ts` remplace `internals.step` et lit `loop.acc` ; `__game.sim` est lu par deux e2e | nul |
| A14 | Les e2e passent par le vrai JOUER (`startRace`), pas par un paramètre d'URL qui sauterait le titre (Q1 a) | spec §11 : « Titre affiché ; click sur JOUER → décompte → course » ; aucun chemin de test dans le code livré | ≈ 4 s par test, ≈ 2 min sur la suite |
| A15 | Version `1.1.0` dans `package.json`, montée à chaque tâche déployée (Q3 a) | une version qui ne bouge pas ne dit rien au papa ; une date de build changerait le hash du bundle à chaque jour et casserait la comparaison local / en ligne | une ligne à bumper par tâche |
| A16 | `GameState` devient l'alias de `Phase` (les valeurs d'avant restent) | les e2e et tests lisent `__game.state` ; la nouvelle valeur initiale est `title` | nul |
| A17 | `setRaceVisible` cache chrono, position et barre ; fps et compteur d'images (debug) restent visibles au titre, et le fps est compté dans `frame` (plus dans `present`) | un fps au titre sert à mesurer la scène du titre sur la tablette ; `e2e/jump.spec.ts` attend `.hud-fps` | nul |

## Questions pour le papa

Q1 à Q4 avant l'implémentation ; Q5 et Q6 sur capture (Step 26).

- **Q1 — démarrage de la course dans les tests de bout en bout.**
  - (a) Par le vrai bouton JOUER, décompte compris (≈ 4 s par test, ≈ 2 min sur la suite). **Recommandé** : c'est le chemin de Galahad, et aucun raccourci de test ne vit dans le code livré.
  - (b) Un paramètre `?start=1` (avec `?debug=1` seulement) qui saute le titre et le décompte : suite plus courte, un chemin de plus à maintenir.
- **Q2 — après ARRIVÉE, en attendant le podium (tâche 11).**
  - (a) Le calque ARRIVÉE garde ENCORE (même piste, mêmes copains, décompte) et gagne MENU (titre). **Recommandé** : la 11 n'aura qu'à remplacer le calque par le podium.
  - (b) Le plan v2.1 à la lettre : retour au titre après 3 s, aucun bouton.
  - (c) Rien ne change : ENCORE recharge la page (qui arrive maintenant au titre).
- **Q3 — numéro de version au titre.**
  - (a) `package.json` passe à `1.1.0` maintenant, et monte d'un cran à chaque tâche déployée (noté dans la passation). **Recommandé** : stable, le hash du bundle reste comparable local / en ligne.
  - (b) Version + date de build : automatique, mais le hash change chaque jour (la vérification du déploiement par le hash ne tient plus).
  - (c) Version + 7 caractères du SHA git : exact, mais la commande de build locale doit recevoir le même SHA.
- **Q4 — texte du titre.**
  - (a) « Course Lunaire » en gros, « de Galahad » en dessous plus petit. **Recommandé** : mots courts, lisibles pour un lecteur débutant.
  - (b) « La Course Lunaire de Galahad » sur une ligne.
  - (c) « COURSE LUNAIRE » seul.
- **Q5 — rangée du titre** (sur capture).
  - (a) Comme la grille : Galahad devant à droite, les quatre copains derrière à 3,3 m, prénoms au-dessus des copains. **Recommandé**.
  - (b) Galahad au milieu, deux copains de chaque côté.
  - (c) Le prénom « Galahad » aussi, au-dessus de sa voiture.
- **Q6 — rebond de Galahad** (sur capture, puis tablette) : hauteur 0,5 m, période 1,1 s, roues qui tournent.
  - (a) Bien.
  - (b) Plus haut / plus lent : préciser.
  - (c) Sans rotation des roues.

## Écarts relevés entre les documents et le code

1. **`click` sur JOUER contre « doigt gardé »** : la spec §8 demande les deux ; incompatibles tels quels (A1).
2. **Plan v2.1 « `finished` → `title` après 3 s »** retire le rejeu (ENCORE) qui existe depuis le plan A (A7, Q2).
3. **Spec §4 « REPRENDRE → racing »** (§11) et « décompte relancé à 3 » (§4) : A6 fait passer toute reprise par le décompte.
4. **`GameState`** a aujourd'hui trois valeurs ; la machine en a sept : alias (A16), valeur initiale `title`.
5. **`colorHex`** vit dans `sim/simulate.ts` (matter-js) : déplacé (A13).
6. **Les e2e supposent une course lancée au chargement** (20 tests) : tous passent par `startRace` (A14).
7. **« Bouton son » au titre** dans le plan v2.1 Task 10 et dans la Task 12 : rendu à la 12 (A3).
