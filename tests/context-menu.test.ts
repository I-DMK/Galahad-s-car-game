// @vitest-environment jsdom
// Garde du menu contextuel (tâche 11d) : ce qui reste de l'accélérateur au doigt (`Throttle`, retiré). Un appui long
// n'ouvre jamais de menu ; la fonction rendue retire l'écouteur.
import { expect, test } from 'vitest';
import { blockContextMenu } from '../src/input/context-menu';

const contextMenu = (target: EventTarget): Event => {
  const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
  target.dispatchEvent(ev);
  return ev;
};

test('contextmenu empêché (preventDefault), sur la fenêtre comme sur un élément de la page', () => {
  const release = blockContextMenu(window);
  expect(contextMenu(window).defaultPrevented).toBe(true);
  expect(contextMenu(document.body).defaultPrevented).toBe(true);
  release();
});

test('la fonction rendue retire l’écouteur', () => {
  const release = blockContextMenu(window);
  release();
  expect(contextMenu(window).defaultPrevented).toBe(false);
});
