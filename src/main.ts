import { CONFIG } from './config';
import { Game } from './game';
import { loadArt } from './render/assets';
import { parseTrackOptions } from './track/generate';
import { loadFont } from './ui/font';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLElement;
const opts = parseTrackOptions(location.search, CONFIG);
// La police (tâche 10) est demandée tout de suite ; aucun texte ne l'attend (`system-ui` jusqu'à son arrivée).
void loadFont(document);
// Les images (tâche 8b) se chargent avant la construction de `Game` : leurs requêtes partent pendant que
// `generateTrack` tourne dans le constructeur. La course ne les attend pas (repli par code jusqu'à leur arrivée).
const art = loadArt();
const game = new Game(canvas, hud, { ...opts, version: __APP_VERSION__ }, art);
game.start();
