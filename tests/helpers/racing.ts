// Lance une course sous jsdom par le vrai chemin (plan B, tâche 10) : `start()` (titre), `play()` (JOUER), puis des
// images de 1 s jusqu'à `racing` (le décompte dure COUNTDOWN_SECONDS, aucun pas de course). Partagé par les tests de
// `Game` (hud, game-frame, renderer-art, game-screens) : tous passent par le décompte, comme Galahad.
import type { Game } from '../../src/game';

/** `game.start()`, `game.play()`, puis des images de 1 s (`raf(now)`) jusqu'à `racing` ; rend le `now` atteint. */
export function startRacing(game: Game, raf: () => FrameRequestCallback, now = 0): number {
  game.start();
  game.play();
  for (let i = 0; i < 10 && game.state !== 'racing'; i++) {
    now += 1000;
    raf()(now);
  }
  if (game.state !== 'racing') throw new Error(`startRacing : état « ${game.state} » après le décompte`);
  return now;
}
