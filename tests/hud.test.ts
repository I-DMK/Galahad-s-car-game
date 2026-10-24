// @vitest-environment jsdom
// HUD de position et barre de progression (tâche 8 du plan B ; spec §6 « Grille de départ » : position vide la
// première seconde ; §7 : place affichée avec hystérésis ; §8 « HUD » : position en haut à gauche, barre en haut
// au centre avec les 5 voitures). `Hud` seul, puis `Game` sous jsdom (faux requestAnimationFrame, dessin intercepté,
// comme tests/game-frame.test.ts) : le câblage réel, de l'état de la course à ce que le DOM affiche.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/game';
import { Renderer } from '../src/render/renderer';
import type { RaceSim } from '../src/sim/simulate';
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

  test('vide au départ (rien d’affiché, ni texte ni voiture)', () => {
    const { position, text } = makeHud();
    expect(position.hidden).toBe(true);
    expect(text.textContent).toBe('');
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

describe('Hud : barre de progression', () => {
  function makeHud(): { hud: Hud; bar: HTMLElement; markers: HTMLElement[] } {
    const root = document.createElement('div');
    document.body.append(root);
    const hud = new Hud(root, RACERS);
    const bar = root.querySelector<HTMLElement>('.hud-bar')!;
    return { hud, bar, markers: [...bar.querySelectorAll<HTMLElement>('.hud-marker')] };
  }

  test('5 marqueurs, un par voiture, de la couleur du pilote', () => {
    const { markers } = makeHud();
    expect(markers).toHaveLength(5);
    markers.forEach((m, i) => {
      expect(m.style.color, `marqueur ${i}`).toBe(cssColor(RACERS[i].color));
      expect(m.querySelector('svg'), `marqueur ${i}`).not.toBeNull();
    });
  });

  test('setProgress place chaque marqueur en pour cent de la largeur de la barre', () => {
    const { hud, markers } = makeHud();
    hud.setProgress([0, 0.25, 0.5, 0.75, 1]);
    expect(markers.map((m) => m.style.left)).toEqual(['0%', '25%', '50%', '75%', '100%']);
    hud.setProgress([0.0333, 0.1, 0.5, 0.75, 1]);
    expect(markers[0].style.left).toBe('3.3%');
  });

  test('le DOM n’est touché que quand une position change (au dixième de pour cent)', () => {
    const { hud, bar } = makeHud();
    hud.setProgress([0.2, 0.3, 0.4, 0.5, 0.6]);
    const seen = new MutationObserver(() => {});
    seen.observe(bar, { subtree: true, childList: true, characterData: true, attributes: true });
    hud.setProgress([0.2, 0.3, 0.4, 0.5, 0.6]);
    hud.setProgress([0.2001, 0.3, 0.4, 0.5, 0.6]);   // même dixième de pour cent
    expect(seen.takeRecords()).toHaveLength(0);
    hud.setProgress([0.2, 0.3, 0.4, 0.5, 0.7]);
    expect(seen.takeRecords()).toHaveLength(1);
    seen.disconnect();
  });

  test('le marqueur de Galahad se distingue : seul à porter is-galahad, bleu, au-dessus des autres', () => {
    const { markers } = makeHud();
    const galahad = markers.filter((m) => m.classList.contains('is-galahad'));
    expect(galahad).toEqual([markers[0]]);
    expect(galahad[0].style.color).toBe(cssColor('#1e5cff'));
    // « Au-dessus » : la feuille de style donne un z-index à `.is-galahad`.
    const css = document.getElementById('hud-style')!.textContent!;
    expect(css).toMatch(/\.hud-marker\.is-galahad\{[^}]*z-index:\s*[1-9]/);
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
  /** Classement et barre d'une image (appelé par `present`). */
  updateRank(): void;
  stop(): void;
  throttle: { dispose(): void };
  jumpInput: { dispose(): void };
}

function makeGame(): { game: Game; root: HTMLElement; internals: GameInternals; position: HTMLElement; text: HTMLElement } {
  const canvas = document.createElement('canvas');
  const root = document.createElement('div');
  document.body.append(canvas, root);
  const game = new Game(canvas, root, { seed: 1, length: 1680, debug: false });
  const internals = game as unknown as GameInternals;
  disposers.push(() => { internals.stop(); internals.throttle.dispose(); internals.jumpInput.dispose(); });
  return { game, root, internals, position: root.querySelector('.hud-position')!, text: root.querySelector('.hud-rank')! };
}

describe('Game : HUD de position', () => {
  test('position vide la première seconde de course, « 1er » ensuite', () => {
    const { game, internals, position, text } = makeGame();
    const { sim } = internals;
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

  test('5 marqueurs, placés à (x − xStart) / (xFinish − xStart) de chaque voiture, grille à 0 %', () => {
    const { game, root, internals } = makeGame();
    const { sim } = internals;
    const markers = [...root.querySelectorAll<HTMLElement>('.hud-marker')];
    expect(markers).toHaveLength(5);
    expect(markers.map((m) => m.style.color)).toEqual(sim.cars.map((c) => cssColor(c.state.color)));
    pressFinger();
    game.start();
    let now = 0;
    for (let f = 0; f < 600; f++) { now += DT * 1000; raf!(now); }
    const { xStart, xFinish } = sim.track;
    sim.cars.forEach((c, i) => {
      const expected = Math.min(1, Math.max(0, (c.state.progress - xStart) / (xFinish - xStart)));
      // Arrondi au dixième de pour cent.
      expect(Math.abs(parseFloat(markers[i].style.left) - expected * 100), `voiture ${i}`).toBeLessThanOrEqual(0.05 + 1e-9);
    });
    // Galahad a passé la ligne de départ ; le dernier copain est encore sur la grille (ou à peine parti).
    expect(parseFloat(markers[0].style.left)).toBeGreaterThan(1);
    expect(sim.cars[0].state.progress).toBeGreaterThan(xStart);
  });

  /** Place chaque voiture à `xs[i]` (m) sans avancer la course : seul le classement est exercé. */
  function place(internals: GameInternals, t: number, xs: number[], finishedAt: (number | null)[] = []): void {
    internals.sim.time = t;
    xs.forEach((x, i) => {
      internals.sim.cars[i].state.progress = x;
      internals.sim.cars[i].state.finishedAt = finishedAt[i] ?? null;
    });
    internals.updateRank();
  }

  test('changement de place : montré s’il tient 0,5 s, tout de suite si l’écart dépasse 2 m', () => {
    const { internals, text } = makeGame();
    place(internals, 5, [100, 90, 80, 70, 60]);
    expect(text.textContent).toBe('1er');
    // Le copain 1 passe devant, de 1 m : pas montré avant 0,5 s.
    place(internals, 5.25, [100, 101, 80, 70, 60]);
    expect(text.textContent).toBe('1er');
    place(internals, 5.5, [100, 101, 80, 70, 60]);
    expect(text.textContent).toBe('1er');
    place(internals, 5.75, [100, 101, 80, 70, 60]);
    expect(text.textContent).toBe('2e');
    // Il repasse derrière, puis un autre file loin devant (écart 4,5 m > 2 m) : montré immédiatement.
    place(internals, 6, [100, 90, 80, 70, 60]);
    place(internals, 6.25, [100, 90, 80, 70, 60]);
    place(internals, 6.5, [100, 90, 80, 70, 60]);
    place(internals, 6.75, [100, 90, 80, 70, 60]);
    expect(text.textContent).toBe('1er');
    place(internals, 7, [100, 104.5, 80, 70, 60]);
    expect(text.textContent).toBe('2e');
  });

  test('l’écart est mesuré à la voiture qui occupe la place déjà affichée, pas au chef de file (R8-2)', () => {
    const { internals, text } = makeGame();
    // Galahad 2e, loin derrière le chef de file (150 m), un copain à 0,5 m derrière lui.
    place(internals, 5, [100, 90, 150, 99.5, 60]);
    expect(text.textContent).toBe('2e');
    // Le copain 3 le double de 0,5 m : échange de voisins, pas un saut de 50 m. Tenu 0,5 s avant d'être montré.
    place(internals, 5.25, [100, 90, 150, 100.5, 60]);
    expect(text.textContent).toBe('2e');
    place(internals, 5.5, [100, 90, 150, 100.5, 60]);
    expect(text.textContent).toBe('2e');
    place(internals, 5.75, [100, 90, 150, 100.5, 60]);
    expect(text.textContent).toBe('3e');
  });

  test('une fois Galahad arrivé, sa place est définitive et montrée tout de suite', () => {
    const { internals, text } = makeGame();
    place(internals, 4.5, [100, 90, 80, 70, 60]);
    expect(text.textContent).toBe('1er');
    // Le copain 1 passe devant de 1 m (candidat depuis 4,7), puis franchit la ligne à 4,8 s.
    place(internals, 4.7, [100, 101, 80, 70, 60]);
    place(internals, 4.8, [100, 101, 80, 70, 60], [null, 4.8]);
    expect(text.textContent).toBe('1er');
    // Galahad arrive à 5 s : 2e, sans attendre les 0,5 s ni un écart de 2 m.
    place(internals, 5, [100, 101, 80, 70, 60], [5, 4.8]);
    expect(text.textContent).toBe('2e');
  });
});
