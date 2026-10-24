// @vitest-environment jsdom
// HUD de position et barre de progression (tâche 8 du plan B ; spec §6 « Grille de départ » : position vide la
// première seconde ; §7 : place affichée avec hystérésis ; §8 « HUD » : position en haut à gauche, barre en haut
// au centre avec les 5 voitures ; décision du papa du 2026-10-24 : une ligne fine par voiture, empilées, Galahad en
// haut, plus épais). `Hud` seul, puis `Game` sous jsdom (faux requestAnimationFrame, dessin intercepté, comme
// tests/game-frame.test.ts) : le câblage réel, de l'état de la course à ce que le DOM affiche. L'hystérésis et
// R8-2 sont testés sur `DisplayedRank` (tests/ranking.test.ts) ; la géométrie (boîtes, recouvrements) en e2e.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DisplayedRank, rankCars } from '../src/cars/ranking';
import { CONFIG } from '../src/config';
import { Game } from '../src/game';
import { Renderer } from '../src/render/renderer';
import { GALAHAD_INDEX, type RaceSim } from '../src/sim/simulate';
import { Hud, type HudRacer } from '../src/ui/hud';

const DT = CONFIG.PHYSICS_DT;

/** Galahad en premier (bleu), puis quatre copains. */
const RACERS: HudRacer[] = [
  { color: '#1e5cff', isGalahad: true },
  { color: '#c8001e', isGalahad: false },
  { color: '#2ecc40', isGalahad: false },
  { color: '#f5f5f5', isGalahad: false },
  { color: '#ffff00', isGalahad: false },
];

/** Couleur CSS telle que le DOM la relit (jsdom normalise '#1e5cff' en 'rgb(30, 92, 255)'). */
function cssColor(color: string): string {
  const probe = document.createElement('div');
  probe.style.color = color;
  return probe.style.color;
}

/** Hauteur (px) donnée par la feuille de style à un élément (jsdom ne fait pas de mise en page : valeur déclarée). */
const declaredHeight = (el: Element): number => parseFloat(getComputedStyle(el).height);

let raf: FrameRequestCallback | null = null;
const disposers: (() => void)[] = [];

beforeEach(() => {
  raf = null;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { raf = cb; return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as RenderingContext);
  vi.spyOn(Renderer.prototype, 'resize').mockImplementation(() => {});
  vi.spyOn(Renderer.prototype, 'draw').mockImplementation(() => {});
});

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('Hud : position', () => {
  function makeHud(): { root: HTMLElement; hud: Hud; position: HTMLElement; text: HTMLElement } {
    const root = document.createElement('div');
    document.body.append(root);
    const hud = new Hud(root, RACERS);
    return { root, hud, position: root.querySelector('.hud-position')!, text: root.querySelector('.hud-rank')! };
  }

  test('vide au départ : rien d’affiché (ni texte ni voiture)', () => {
    const { position, text } = makeHud();
    expect(position.hidden).toBe(true);
    expect(text.textContent).toBe('');
  });

  test('la feuille de style donne display:none à .hud-position[hidden] (sinon son display:flex l’emporte sur l’attribut hidden)', () => {
    makeHud();
    const rules = [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules]) as CSSStyleRule[];
    const own = rules.filter((r) => r.selectorText === '.hud-position');
    expect(own.some((r) => r.style.display !== ''), 'le test ne vise plus la règle display de .hud-position').toBe(true);
    expect(rules.find((r) => r.selectorText === '.hud-position[hidden]')?.style.display).toBe('none');
    // (jsdom donne toujours « none » à un élément hidden : le style calculé réel est vérifié en e2e, dans Chromium.)
  });

  test('setPosition : « 1er », « 3e », puis vide (null)', () => {
    const { hud, position, text } = makeHud();
    hud.setPosition(1);
    expect(position.hidden).toBe(false);
    expect(text.textContent).toBe('1er');
    hud.setPosition(3);
    expect(text.textContent).toBe('3e');
    hud.setPosition(null);
    expect(position.hidden).toBe(true);
    expect(text.textContent).toBe('');
  });

  test('la petite voiture de la position est de la couleur de Galahad', () => {
    const { position } = makeHud();
    const car = position.querySelector<HTMLElement>('.hud-position-car')!;
    expect(car.querySelector('svg')).not.toBeNull();
    expect(car.style.color).toBe(cssColor('#1e5cff'));
  });

  test('le DOM n’est touché que quand la place change', () => {
    const { hud, position } = makeHud();
    hud.setPosition(2);
    const seen = new MutationObserver(() => {});
    seen.observe(position, { subtree: true, childList: true, characterData: true, attributes: true });
    hud.setPosition(2);
    hud.setPosition(2);
    expect(seen.takeRecords()).toHaveLength(0);
    hud.setPosition(1);
    expect(seen.takeRecords().length).toBeGreaterThan(0);
    seen.disconnect();
  });

  test('le style est injecté une seule fois', () => {
    makeHud();
    makeHud();
    expect(document.querySelectorAll('#hud-style')).toHaveLength(1);
  });
});

describe('Hud : barre de progression en cinq couloirs', () => {
  function makeHud(): { hud: Hud; bar: HTMLElement; lanes: HTMLElement[]; markers: HTMLElement[] } {
    const root = document.createElement('div');
    document.body.append(root);
    const hud = new Hud(root, RACERS);
    const bar = root.querySelector<HTMLElement>('.hud-bar')!;
    const lanes = [...bar.querySelectorAll<HTMLElement>('.hud-lane')];
    return { hud, bar, lanes, markers: lanes.map((l) => l.querySelector<HTMLElement>('.hud-marker')!) };
  }

  test('5 couloirs empilés dans l’ordre de la grille, un marqueur (petite voiture) dans chacun, de la couleur du pilote', () => {
    const { bar, lanes, markers } = makeHud();
    expect(lanes).toHaveLength(5);
    expect([...bar.children].slice(0, 5)).toEqual(lanes);   // les couloirs d'abord, le drapeau d'arrivée ensuite
    lanes.forEach((lane, i) => {
      expect(lane.style.color, `couloir ${i}`).toBe(cssColor(RACERS[i].color));
      expect(markers[i], `couloir ${i}`).not.toBeNull();
      expect(markers[i].querySelector('svg'), `couloir ${i}`).not.toBeNull();
      expect(lane.querySelectorAll('.hud-marker'), `couloir ${i}`).toHaveLength(1);
    });
  });

  test('le couloir de Galahad est le premier (en haut), le seul marqué is-galahad, bleu, et plus épais que les autres', () => {
    const { bar, lanes } = makeHud();
    expect(bar.firstElementChild).toBe(lanes[0]);
    expect(lanes.filter((l) => l.classList.contains('is-galahad'))).toEqual([lanes[0]]);
    expect(lanes[0].style.color).toBe(cssColor('#1e5cff'));
    const thickest = Math.max(...lanes.slice(1).map(declaredHeight));
    expect(declaredHeight(lanes[0])).toBeGreaterThan(thickest);
    // Les quatre copains ont un couloir de même épaisseur, qui ne s'annule pas.
    expect(new Set(lanes.slice(1).map(declaredHeight)).size).toBe(1);
    expect(thickest).toBeGreaterThan(0);
  });

  test('un drapeau à damier au bout de la barre, côté arrivée : un seul, après les cinq couloirs, damier noir et blanc, sans capter le toucher', () => {
    const { bar, lanes } = makeHud();
    const flags = document.querySelectorAll('.hud-flag');
    expect(flags).toHaveLength(1);
    const flag = flags[0];
    // Après la barre : dernier enfant de la barre, après ses cinq couloirs (CSS : à droite, là où arrive 100 %).
    expect(bar.lastElementChild).toBe(flag);
    expect(bar.children).toHaveLength(lanes.length + 1);
    expect(getComputedStyle(flag).getPropertyValue('pointer-events')).toBe('none');
    const svg = flag.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // Damier : 8 cases noires sur 4 × 4, jamais deux côte à côte (une case sur deux), sur un fond blanc.
    const rects = [...svg.querySelectorAll('rect')];
    const blacks = rects.filter((r) => r.getAttribute('fill') === '#000');
    const [x, y, size] = [(r: Element) => +r.getAttribute('x')!, (r: Element) => +r.getAttribute('y')!, +blacks[0].getAttribute('width')!];
    expect(blacks).toHaveLength(8);
    for (const a of blacks) {
      for (const b of blacks) {
        const dx = Math.abs(x(a) - x(b));
        const dy = Math.abs(y(a) - y(b));
        expect(dx + dy === size && (dx === 0 || dy === 0), 'deux cases noires côte à côte').toBe(false);
      }
    }
    expect(rects.some((r) => r.getAttribute('fill') === '#fff')).toBe(true);
  });

  test('setProgress place chaque marqueur en pour cent de son couloir (transform, pas de mise en page)', () => {
    const { hud, markers } = makeHud();
    hud.setProgress([0, 0.25, 0.5, 0.75, 1]);
    expect(markers.map((m) => m.style.transform)).toEqual([
      'translateX(0%)', 'translateX(25%)', 'translateX(50%)', 'translateX(75%)', 'translateX(100%)',
    ]);
    expect(markers.map((m) => m.style.left)).toEqual(['', '', '', '', '']);
    hud.setProgress([0.0333, 0.1, 0.5, 0.75, 1]);
    expect(markers[0].style.transform).toBe('translateX(3.3%)');
  });

  test('une position n’est réécrite que si elle change (au dixième de pour cent)', () => {
    const { hud, markers } = makeHud();
    const writes = markers.map((m) => {
      const style = m.style;
      let value = '';
      const count = { n: 0 };
      Object.defineProperty(style, 'transform', {
        configurable: true,
        get: () => value,
        set: (v: string) => { count.n++; value = v; },
      });
      return count;
    });
    hud.setProgress([0.2, 0.3, 0.4, 0.5, 0.6]);
    expect(writes.map((w) => w.n)).toEqual([1, 1, 1, 1, 1]);
    hud.setProgress([0.2, 0.3, 0.4, 0.5, 0.6]);
    hud.setProgress([0.2001, 0.3, 0.4, 0.5, 0.6]);   // même dixième de pour cent
    expect(writes.map((w) => w.n)).toEqual([1, 1, 1, 1, 1]);
    hud.setProgress([0.2, 0.3, 0.4, 0.5, 0.7]);
    expect(writes.map((w) => w.n)).toEqual([1, 1, 1, 1, 2]);
  });
});

/** pointerdown (pointeur 1) : le doigt de gaz de `Throttle`. */
function pressFinger(): void {
  const ev = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  window.dispatchEvent(ev);
}

interface GameInternals {
  sim: RaceSim;
  stop(): void;
  throttle: { dispose(): void };
  jumpInput: { dispose(): void };
}

function makeGame(): { game: Game; root: HTMLElement; sim: RaceSim } {
  const canvas = document.createElement('canvas');
  const root = document.createElement('div');
  document.body.append(canvas, root);
  const game = new Game(canvas, root, { seed: 1, length: 1680, debug: false });
  // `sim` n'est lu que pour comparer le DOM à l'état de la course ; tout passe par l'API publique (start, rAF, DOM).
  const internals = game as unknown as GameInternals;
  disposers.push(() => { internals.stop(); internals.throttle.dispose(); internals.jumpInput.dispose(); });
  return { game, root, sim: internals.sim };
}

describe('Game : HUD de position', () => {
  test('position vide la première seconde de course, « 1er » ensuite (Galahad en pole, doigt posé)', () => {
    const { game, root, sim } = makeGame();
    const position = root.querySelector<HTMLElement>('.hud-position')!;
    const text = root.querySelector('.hud-rank')!;
    pressFinger();
    game.start();
    let now = 0;
    let hidden = 0;
    let shown = 0;
    for (let f = 0; f < 90; f++) {
      now += DT * 1000;
      raf!(now);
      if (sim.time < CONFIG.RANK_HIDE_SECONDS) {
        hidden++;
        expect(position.hidden, `t = ${sim.time}`).toBe(true);
        expect(text.textContent, `t = ${sim.time}`).toBe('');
      } else {
        shown++;
        expect(position.hidden, `t = ${sim.time}`).toBe(false);
        expect(text.textContent, `t = ${sim.time}`).toBe('1er');
      }
    }
    // Contrôle vivant : les deux régimes ont bien été vus, et le changement tombe à RANK_HIDE_SECONDS.
    expect(hidden).toBeGreaterThanOrEqual(59);
    expect(shown).toBeGreaterThan(25);
  });

  test('Galahad est la voiture du couloir du haut et de la position : is-galahad sur le couloir 0, couleurs des pilotes', () => {
    const { root, sim } = makeGame();
    const lanes = [...root.querySelectorAll<HTMLElement>('.hud-lane')];
    expect(lanes).toHaveLength(5);
    expect(lanes.map((l) => l.style.color)).toEqual(sim.cars.map((c) => cssColor(c.state.color)));
    expect(lanes.map((l) => l.classList.contains('is-galahad'))).toEqual([true, false, false, false, false]);
    expect(sim.cars[GALAHAD_INDEX].state.id).toBe('galahad');
    expect(root.querySelector<HTMLElement>('.hud-position-car')!.style.color).toBe(cssColor(sim.cars[GALAHAD_INDEX].state.color));
    // Les copains ne sont pas bleus comme Galahad : la couleur du couloir 0 est bien celle de la voiture de la position.
    expect(lanes.slice(1).map((l) => l.style.color)).not.toContain(lanes[0].style.color);
  });

  test('chaque marqueur est à (x − xStart) / (xFinish − xStart) de sa voiture, grille à 0 %', () => {
    const { game, root, sim } = makeGame();
    const markers = [...root.querySelectorAll<HTMLElement>('.hud-marker')];
    expect(markers).toHaveLength(5);
    pressFinger();
    game.start();
    let now = 0;
    for (let f = 0; f < 600; f++) { now += DT * 1000; raf!(now); }
    const { xStart, xFinish } = sim.track;
    sim.cars.forEach((c, i) => {
      const expected = Math.min(1, Math.max(0, (c.state.progress - xStart) / (xFinish - xStart)));
      const shown = parseFloat(/translateX\(([\d.]+)%\)/.exec(markers[i].style.transform)![1]);
      // Arrondi au dixième de pour cent.
      expect(Math.abs(shown - expected * 100), `voiture ${i}`).toBeLessThanOrEqual(0.05 + 1e-9);
    });
    // Galahad a passé la ligne de départ.
    expect(sim.cars[0].state.progress).toBeGreaterThan(xStart);
    expect(parseFloat(/translateX\(([\d.]+)%\)/.exec(markers[0].style.transform)![1])).toBeGreaterThan(1);
  });

  test('la place montrée vient du classement de la course : DisplayedRank reçoit les voitures, Galahad et le temps de course', () => {
    const { game, sim } = makeGame();
    const update = vi.spyOn(DisplayedRank.prototype, 'update');
    pressFinger();
    game.start();
    for (let f = 0; f < 90; f++) raf!(5 + f * DT * 1000);
    expect(update).toHaveBeenCalled();
    const [cars, me, t] = update.mock.lastCall!;
    expect(me).toBe(GALAHAD_INDEX);
    expect(t).toBe(sim.time);
    expect(cars).toEqual(sim.cars.map((c, i) => ({ index: i, progress: c.state.progress, finishedAt: c.state.finishedAt })));
  });

  test('le HUD montre la place RENDUE par DisplayedRank (pas le classement brut, pas la première valeur) : vide la 1re seconde, « 4e » puis « 2e »', () => {
    const { game, root, sim } = makeGame();
    // `update` rend 4 jusqu'à 1,5 s de course, puis 2 ; Galahad, en pole et doigt posé, est 1er au classement brut tout du long.
    vi.spyOn(DisplayedRank.prototype, 'update').mockImplementation((_cars, _me, t) => (t < 1.5 ? 4 : 2));
    const position = root.querySelector<HTMLElement>('.hud-position')!;
    const text = root.querySelector('.hud-rank')!;
    pressFinger();
    game.start();
    const seen = { hidden: 0, fourth: 0, second: 0 };
    for (let f = 0; f < 120; f++) {
      raf!(5 + f * DT * 1000);
      const raw = rankCars(sim.cars.map((c, i) => ({ index: i, progress: c.state.progress, finishedAt: c.state.finishedAt }))).indexOf(GALAHAD_INDEX) + 1;
      expect(raw, `t = ${sim.time}`).toBe(1);
      if (sim.time < CONFIG.RANK_HIDE_SECONDS) {
        seen.hidden++;
        expect([position.hidden, text.textContent], `t = ${sim.time}`).toEqual([true, '']);
      } else if (sim.time < 1.5) {
        seen.fourth++;
        expect([position.hidden, text.textContent], `t = ${sim.time}`).toEqual([false, '4e']);
      } else {
        seen.second++;
        expect([position.hidden, text.textContent], `t = ${sim.time}`).toEqual([false, '2e']);
      }
    }
    // Contrôle vivant : les trois régimes ont bien été vus.
    expect(seen.hidden).toBeGreaterThanOrEqual(55);
    expect(seen.fourth).toBeGreaterThan(20);
    expect(seen.second).toBeGreaterThan(20);
  });

  test('pas de recalcul du classement ni de la barre aux images sans pas de course', () => {
    const { game } = makeGame();
    const update = vi.spyOn(DisplayedRank.prototype, 'update');
    const progress = vi.spyOn(Hud.prototype, 'setProgress');
    game.start();
    // 5 ms : moins d'un pas (1/60 s) : l'image dessine, la course n'avance pas.
    raf!(5);
    expect(update).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    // 5 + 1/60 s : un pas.
    raf!(5 + DT * 1000);
    expect(update).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
    // Image suivante à 5 ms : plus de pas, plus d'appel.
    raf!(5 + DT * 1000 + 5);
    expect(update).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
  });
});
