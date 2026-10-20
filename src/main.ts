import { CONFIG } from './config';
import { Game } from './game';
import { parseTrackOptions } from './track/generate';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const opts = parseTrackOptions(location.search, CONFIG);
const game = new Game(canvas, hud, opts);
game.start();
