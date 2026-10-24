// @vitest-environment jsdom
// Écrans DOM du jeu (plan B, tâche 10 ; spec §8 « Écrans », §4 « pause », addendum §2) : titre (JOUER sans data-no-pedal :
// le doigt compte comme gaz ; AUTRE PISTE avec), décompte (calque sans toucher), pause / TOURNE (voile entier
// data-no-pedal, REPRENDRE caché en portrait). Les calques sont créés une fois et cachés, jamais retirés (un doigt
// posé sur JOUER garde son chemin d'événements jusqu'au pointerup). jsdom ne met pas en page : les tailles lues sont
// celles déclarées par la feuille ; les boîtes réelles sont vérifiées en e2e (e2e/screens.spec.ts).
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
