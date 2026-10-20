// Course sur tablette simulée : chargement, accélérateur au doigt, course courte jusqu'à l'arrivée, captures.
import { expect, test, type Page } from '@playwright/test';
import { gameState, holdFinger, waitForGame, waitForState } from './helpers';

const SHOTS = 'e2e/screenshots';
/** Durée maximale doigt posé pour finir une piste de 300 m. */
const MAX_HOLD_S = 90;

/** Doigt posé par tranches de 5 s jusqu'à l'arrivée (au plus MAX_HOLD_S). */
async function driveToFinish(page: Page): Promise<void> {
  const deadline = Date.now() + MAX_HOLD_S * 1000;
  while ((await gameState(page)).state === 'racing' && Date.now() < deadline) {
    await holdFinger(page, 5);
  }
  await waitForState(page, 'finished', 1_000);
}

/** Collecte les erreurs console et les exceptions non rattrapées de la page. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

test('la page charge', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  const dims = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(dims).toEqual({ scrollWidth: 1280, scrollHeight: 800 });
  expect((await gameState(page)).state).toBe('racing');
  const canvas = page.locator('canvas#game');
  await expect(canvas).toHaveCount(1);
  expect(await canvas.evaluate((c) => c.clientWidth)).toBe(1280);
});

test('doigt posé 3 s : la voiture avance', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  const before = (await gameState(page)).progress;
  await holdFinger(page, 3);
  const after = (await gameState(page)).progress;
  expect(after - before).toBeGreaterThan(5);
});

test('sans doigt : la voiture ne bouge pas', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  const before = (await gameState(page)).progress;
  await page.waitForTimeout(2_000);
  const after = (await gameState(page)).progress;
  expect(Math.abs(after - before)).toBeLessThan(0.5);
});

test('course courte : arrivée et calque ARRIVÉE, sans erreur console', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectErrors(page);
  await page.goto('/?seed=1&len=300&debug=1');
  await waitForGame(page);
  await driveToFinish(page);
  expect((await gameState(page)).state).toBe('finished');
  await expect(page.getByText('ARRIVÉE')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('button[data-no-pedal]', { hasText: 'ENCORE' })).toBeVisible({ timeout: 5_000 });
  expect(errors).toEqual([]);
});

test('captures : course.png et arrivee.png', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/?seed=1&debug=1');
  await waitForGame(page);
  await holdFinger(page, 3);
  await page.screenshot({ path: `${SHOTS}/course.png`, fullPage: true });

  await page.goto('/?seed=1&len=300&debug=1');
  await waitForGame(page);
  await driveToFinish(page);
  await expect(page.getByText('ARRIVÉE')).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: `${SHOTS}/arrivee.png`, fullPage: true });
});
