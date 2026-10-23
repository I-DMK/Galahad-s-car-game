// Bouton saut sur tablette simulée (plan B, tâche 5e, Step 4) : tap seul (saut sans gaz), gaz + tap (la voiture
// avance et saute), Espace (un saut, rien sur une répétition), HUD de debug sous le bouton, capture.
import { expect, test } from '@playwright/test';
import { SHOTS, gameState, holdFingerAndTapJump, jumpState, tapJump, waitForGame, waitForRaceTime } from './helpers';


test('tap seul sur le bouton : un saut, sans gaz', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  expect((await jumpState(page)).jumps).toBe(0);
  const { throttleDuring } = await tapJump(page);
  expect(throttleDuring).toBe(false);
  await page.waitForFunction(() => (window as any).__game.jumps >= 1);
  await page.waitForTimeout(300);
  expect(await jumpState(page)).toEqual({ jumps: 1, throttlePressed: false });
});

test('gaz d’un doigt + tap sur le bouton de l’autre : la voiture avance et saute', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
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
  await page.goto('./?seed=1&debug=1');
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
  await page.goto('./?seed=1&debug=1');
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
  // contact de jeu (tolérance de sol, tâche 5e Step 11). Saut une fois les 4 copains passés (15 m devant) : au départ,
  // un copain qui arrive par derrière heurte Galahad en l'air, et un toit compte comme du sol. Instant lu dans le
  // jeu, dans la même évaluation que la classe : délai de 0,5 s écoulé et tolérance dépassée de 0,05 s (un instant
  // lu après le tap arrive ≈ 0,3 s en retard).
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    const ids: string[] = g.pilots.map((p: { id: string }) => p.id);
    return ids.slice(1).every((id) => g.progress(id) > g.progress(ids[0]) + 15);
  }, undefined, { timeout: 30_000 });
  await tapJump(page);
  const s = (await (await page.waitForFunction(() => {
    const g = (window as any).__game;
    const c = g.sim.cars[0];
    const t: number = g.sim.time;
    const lastJ: number | null = c.state.lastJumpAt;
    if (g.jumps < 1 || lastJ === null || t < lastJ + 0.55) return false;
    if (!c.grounded && c.lastGroundedAt !== null && t < c.lastGroundedAt + 0.4) return false;
    const waiting = document.querySelector('.jump-button')!.classList.contains('is-waiting');
    return { t, lastJ, lastG: c.lastGroundedAt as number | null, grounded: c.grounded as boolean, waiting };
  })).jsonValue()) as { t: number; lastJ: number; lastG: number | null; grounded: boolean; waiting: boolean };
  expect(s.grounded, `en l'air : ${JSON.stringify(s)}`).toBe(false);
  expect(s.waiting, `grisé : ${JSON.stringify(s)}`).toBe(true);
  await page.screenshot({ path: `${SHOTS}/bouton-saut.png`, fullPage: true });
});

test('plat étoile : l’étoile haute du 1er plat étoile à l’écran ; capture plat-etoile.png', async ({ page }) => {
  await page.goto('./?seed=1&debug=1');
  await waitForGame(page);
  // Étoile du 1er plat étoile (tâche 5e) : x lu dans la piste du jeu (?debug=1).
  const x = await page.evaluate(() => {
    const t = (window as any).__game.sim.track;
    const flat = t.slices.find((s: { type: string }) => s.type === 'plat-étoile');
    return t.stars.find((s: { high: boolean; x: number }) => s.high && s.x >= flat.xStart && s.x <= flat.xEnd).x as number;
  });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 640, y: 400, id: 0 }] });
    await page.waitForFunction((xx) => (window as any).__game.progress('galahad') >= xx - 16, x, { timeout: 60_000 });
    await page.screenshot({ path: `${SHOTS}/plat-etoile.png`, fullPage: true });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  expect((await gameState(page)).progress).toBeGreaterThan(x - 20);
});
