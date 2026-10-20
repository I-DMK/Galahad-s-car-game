// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Throttle } from '../src/input/throttle';

function fire(type: string, pointerId = 1, target: EventTarget = window): void {
  let ev: Event;
  if (typeof PointerEvent === 'undefined') {
    ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerId', { value: pointerId });
  } else {
    ev = new PointerEvent(type, { pointerId, bubbles: true, cancelable: true });
  }
  target.dispatchEvent(ev);
}

describe('Throttle', () => {
  let throttle: Throttle;

  beforeEach(() => {
    throttle = new Throttle(window);
  });

  afterEach(() => {
    throttle.dispose();
    document.body.innerHTML = '';
  });

  it('est relâché au départ', () => {
    expect(throttle.pressed).toBe(false);
  });

  it('pointerdown -> pressed', () => {
    fire('pointerdown', 1);
    expect(throttle.pressed).toBe(true);
    fire('pointerup', 1);
    expect(throttle.pressed).toBe(false);
  });

  it('deux doigts, un levé -> toujours pressed', () => {
    fire('pointerdown', 1);
    fire('pointerdown', 2);
    fire('pointerup', 1);
    expect(throttle.pressed).toBe(true);
    fire('pointerup', 2);
    expect(throttle.pressed).toBe(false);
  });

  it('pointercancel -> relâché', () => {
    fire('pointerdown', 1);
    fire('pointercancel', 1);
    expect(throttle.pressed).toBe(false);
  });

  it('pointerup sans pointerdown -> relâché, puis pointerdown -> pressed', () => {
    fire('pointerup', 7);
    expect(throttle.pressed).toBe(false);
    fire('pointerdown', 1);
    expect(throttle.pressed).toBe(true);
  });

  it('visibilitychange -> relâché', () => {
    fire('pointerdown', 1);
    fire('visibilitychange', 0, document);
    expect(throttle.pressed).toBe(false);
  });

  it('blur -> relâché', () => {
    fire('pointerdown', 1);
    fire('blur', 0, window);
    expect(throttle.pressed).toBe(false);
  });

  it('pointerdown sur un élément data-no-pedal est ignoré (y compris descendant)', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-no-pedal', '');
    const inner = document.createElement('span');
    btn.appendChild(inner);
    document.body.appendChild(btn);
    fire('pointerdown', 1, btn);
    expect(throttle.pressed).toBe(false);
    fire('pointerdown', 2, inner);
    expect(throttle.pressed).toBe(false);
    fire('pointerup', 1, btn);
    expect(throttle.pressed).toBe(false);
  });

  it('contextmenu est bloqué (preventDefault)', () => {
    const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('dispose retire les écouteurs', () => {
    throttle.dispose();
    fire('pointerdown', 1);
    expect(throttle.pressed).toBe(false);
    const ev = new Event('contextmenu', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
