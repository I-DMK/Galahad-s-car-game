// Bouton saut sur tablette simulée (plan B, tâche 5e, Step 4) : tap seul (saut sans gaz), gaz + tap (la voiture
// avance et saute), Espace (un saut, rien sur une répétition), HUD de debug sous le bouton, capture.
import { expect, test } from '@playwright/test';
import { gameState, holdFingerAndTapJump, jumpState, tapJump, waitForGame, waitForRaceTime } from './helpers';

const SHOTS = 'e2e/screenshots';

test('tap seul sur le bouton : un saut, sans gaz', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  expect((await jumpState(page)).jumps).toBe(0);
  const { throttleDuring } = await tapJump(page);
  expect(throttleDuring).toBe(false);
  await page.waitForFunction(() => (window as any).__game.jumps >= 1);
  await page.waitForTimeout(300);
  expect(await jumpState(page)).toEqual({ jumps: 1, throttlePressed: false });
});

test('gaz d’un doigt + tap sur le bouton de l’autre : la voiture avance et saute', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  const before = (await gameState(page)).progress;
  const { throttleWithB, throttleAfterB } = await holdFingerAndTapJump(page);
  expect(throttleWithB).toBe(true);
  expect(throttleAfterB).toBe(true);
  const after = await gameState(page);
  expect((await jumpState(page)).jumps).toBe(1);
  expect(after.progress - before).toBeGreaterThan(10);
});

test('Espace : un saut ; Espace répété (repeat) une fois la voiture prête : rien', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => (window as any).__game.jumps >= 1);
  const t = (await gameState(page)).time;
  // Retombée (≈ 2 s de vol) et délai écoulé : le bouton est de nouveau prêt.
  await waitForRaceTime(page, t + 3);
  await expect(page.locator('.jump-button')).not.toHaveClass(/is-waiting/);
  // Touche toujours enfoncée : Playwright envoie ce keydown avec repeat = true.
  await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true })));
  await waitForRaceTime(page, t + 3.5);
  await page.keyboard.up('Space');
  expect((await jumpState(page)).jumps).toBe(1);
});

test('HUD de debug sous le bouton : boîtes disjointes, bouton dans la vue ; capture bouton-saut.png', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  const button = page.locator('.jump-button');
  await expect(button).toBeVisible();
  await expect(page.locator('.hud-fps')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.hud-steps')).toBeVisible({ timeout: 5_000 });
  const boxes = {
    button: (await button.boundingBox())!,
    fps: (await page.locator('.hud-fps').boundingBox())!,
    steps: (await page.locator('.hud-steps').boundingBox())!,
  };
  const disjoint = (p: typeof boxes.button, q: typeof boxes.button): boolean =>
    p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y;
  expect(disjoint(boxes.button, boxes.fps), JSON.stringify(boxes)).toBe(true);
  expect(disjoint(boxes.button, boxes.steps), JSON.stringify(boxes)).toBe(true);
  expect(disjoint(boxes.fps, boxes.steps), JSON.stringify(boxes)).toBe(true);
  const b = boxes.button;
  expect(b.width).toBeGreaterThanOrEqual(140);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(1280);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
  // En bas à gauche.
  expect(b.x + b.width / 2).toBeLessThan(640);
  expect(b.y + b.height / 2).toBeGreaterThan(400);
  // Capture en plein saut : le bouton est grisé en l'air, à partir de JUMP_GROUND_GRACE (0,35 s) après le dernier
  // contact de jeu (tolérance de sol, tâche 5e Step 11) ; 0,8 s de course après le saut, il l'est.
  await tapJump(page);
  await page.waitForFunction(() => (window as any).__game.jumps >= 1);
  const tJump = (await gameState(page)).time;
  await waitForRaceTime(page, tJump + 0.8);
  await expect(button).toHaveClass(/is-waiting/);
  await page.screenshot({ path: `${SHOTS}/bouton-saut.png`, fullPage: true });
});
