// @vitest-environment jsdom
// Entrée du saut (plan B, tâche 5e ; addendum « bouton saut » §1) : front d'appui sur le bouton ou Espace non
// répété, jamais compté comme du gaz ; bouton rond d'au moins 140 px en bas à gauche, `data-no-pedal`,
// grisé par une classe et jamais par `disabled` (un bouton désactivé n'émet pas de pointerdown vers sa cible).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { JumpInput } from '../src/input/jump';
import { Throttle } from '../src/input/throttle';
import { JumpButton } from '../src/ui/jump-button';

function pointer(type: string, target: EventTarget, pointerId = 1): void {
  let ev: Event;
  if (typeof PointerEvent === 'undefined') {
    ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: pointerId });
  } else {
    ev = new PointerEvent(type, { pointerId, bubbles: true, cancelable: true });
  }
  target.dispatchEvent(ev);
}

function key(code: string, repeat = false): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { code, key: code === 'Space' ? ' ' : code, repeat, bubbles: true, cancelable: true });
  window.dispatchEvent(ev);
  return ev;
}

describe('JumpInput et JumpButton', () => {
  let root: HTMLDivElement;
  let button: JumpButton;
  let throttle: Throttle;
  let input: JumpInput;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'hud';
    document.body.appendChild(root);
    button = new JumpButton(root, CONFIG);
    throttle = new Throttle(window);
    input = new JumpInput(window, button.el);
  });

  afterEach(() => {
    input.dispose();
    throttle.dispose();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('pointerdown sur le bouton : une demande (take() vrai puis faux), et pas de gaz', () => {
    pointer('pointerdown', button.el, 3);
    expect(throttle.pressed).toBe(false);
    expect(input.take()).toBe(true);
    expect(input.take()).toBe(false);
    pointer('pointerup', button.el, 3);
    expect(throttle.pressed).toBe(false);
  });

  it('pointerdown sur l’icône du bouton : une demande, pas de gaz', () => {
    const icon = button.el.querySelector('svg') ?? button.el;
    pointer('pointerdown', icon, 4);
    expect(throttle.pressed).toBe(false);
    expect(input.take()).toBe(true);
  });

  it('doigt maintenu sur le bouton : un seul take() vrai', () => {
    pointer('pointerdown', button.el, 3);
    pointer('pointermove', button.el, 3);
    pointer('pointermove', button.el, 3);
    expect(input.take()).toBe(true);
    pointer('pointermove', button.el, 3);
    expect(input.take()).toBe(false);
    expect(input.take()).toBe(false);
  });

  it('Espace : une demande (défaut empêché) ; Espace répété (repeat) : rien ; une autre touche : rien', () => {
    const ev = key('Space');
    expect(ev.defaultPrevented).toBe(true);
    expect(input.take()).toBe(true);
    key('Space', true);
    key('Space', true);
    expect(input.take()).toBe(false);
    key('KeyA');
    key('Enter');
    expect(input.take()).toBe(false);
    expect(throttle.pressed).toBe(false);
  });

  it('Espace hors de la course (isActive faux) : ni demande, ni défaut empêché', () => {
    let racing = false;
    const gated = new JumpInput(window, button.el, () => racing);
    input.dispose();
    const ev = key('Space');
    expect(ev.defaultPrevented).toBe(false);
    expect(gated.take()).toBe(false);
    racing = true;
    expect(key('Space').defaultPrevented).toBe(true);
    expect(gated.take()).toBe(true);
    gated.dispose();
  });

  it('Espace sur un bouton qui a le focus (ENCORE) : ni demande, ni défaut empêché', () => {
    const encore = document.createElement('button');
    encore.textContent = 'ENCORE';
    document.body.appendChild(encore);
    encore.focus();
    const ev = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true });
    encore.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(input.take()).toBe(false);
  });

  it('blur et changement de visibilité jettent la demande en attente (comme Throttle) ; pending ne la consomme pas', () => {
    pointer('pointerdown', button.el, 3);
    expect(input.pending).toBe(true);
    expect(input.pending).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(input.pending).toBe(false);
    pointer('pointerdown', button.el, 3);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(input.take()).toBe(false);
  });

  it('pointerdown ailleurs : du gaz, aucune demande', () => {
    pointer('pointerdown', document.body, 1);
    expect(throttle.pressed).toBe(true);
    expect(input.take()).toBe(false);
  });

  it('gaz d’un doigt et tap sur le bouton d’un autre : gaz gardé, une demande', () => {
    pointer('pointerdown', document.body, 1);
    pointer('pointerdown', button.el, 2);
    expect(throttle.pressed).toBe(true);
    pointer('pointerup', button.el, 2);
    expect(throttle.pressed).toBe(true);
    expect(input.take()).toBe(true);
  });

  it('clear() jette la demande en attente ; dispose() coupe l’écoute', () => {
    pointer('pointerdown', button.el, 3);
    input.clear();
    expect(input.take()).toBe(false);
    input.dispose();
    pointer('pointerdown', button.el, 5);
    key('Space');
    expect(input.take()).toBe(false);
  });

  it('bouton : rond d’au moins 140 px, data-no-pedal, en bas à gauche, cliquable dans un #hud sans pointeur', () => {
    const el = button.el;
    expect(el.tagName).toBe('BUTTON');
    expect(el.parentElement).toBe(root);
    expect(el.hasAttribute('data-no-pedal')).toBe(true);
    expect(CONFIG.JUMP_BUTTON_SIZE_PX).toBeGreaterThanOrEqual(140);
    const style = getComputedStyle(el);
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(140);
    expect(parseFloat(style.height)).toBe(parseFloat(style.width));
    expect(style.borderRadius).toBe('50%');
    expect(style.position).toBe('absolute');
    expect(style.left).toBe('28px');
    expect(style.bottom).toBe('40px');
    expect(style.pointerEvents).toBe('auto');
    expect(style.touchAction).toBe('none');
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('setReady(false) : grisé par la classe is-waiting, jamais disabled ; setReady(true) le rend', () => {
    button.setReady(false);
    expect(button.el.classList.contains('is-waiting')).toBe(true);
    expect(button.el.disabled).toBe(false);
    expect(button.el.hasAttribute('disabled')).toBe(false);
    pointer('pointerdown', button.el, 3);
    expect(input.take()).toBe(true);
    expect(throttle.pressed).toBe(false);
    button.setReady(true);
    expect(button.el.classList.contains('is-waiting')).toBe(false);
  });
});
