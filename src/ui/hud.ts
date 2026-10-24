// HUD en DOM au-dessus du canvas : position de Galahad en haut à gauche (tâche 8), barre de progression en cinq
// couloirs en haut au centre (tâche 8 ; décision du papa du 2026-10-24 : une ligne fine par voiture, empilées, pour que
// les copains ne se cachent pas sous Galahad, avec un drapeau à damier côté arrivée), chrono en haut à droite, fps et compteur d'images à 0 / 2+ pas (debug,
// sous le bouton saut de `ui/jump-button.ts`, tâche 5e), calque d'arrivée, message d'erreur.
// Le conteneur (#hud) est en `pointer-events: none` : seul le calque d'arrivée capte le toucher.
import { ordinal } from '../cars/ranking';
import type { StepCounts } from '../loop/frame-stats';

const STYLE_ID = 'hud-style';
/**
 * px : épaisseur du couloir d'un copain et de Galahad (plus épais) sur la barre ; la petite voiture y est 2 fois plus
 * large que haute. Le trait de chaque couloir est rentré de GALAHAD_LANE_PX (demi-largeur de la plus grosse voiture) à
 * chaque bout : le centre de toute voiture est au bout du trait à 0 % et à 100 %, au même x dans les 5 couloirs.
 */
const LANE_PX = 10;
const GALAHAD_LANE_PX = 18;
/** Drapeau d'arrivée : boîte du dessin (rapport 34 / 64, hauteur de la barre) ; damier de 4 × 4 cases de 7 en haut du mât. */
const FLAG_W = 34;
const FLAG_H = 64;
const FLAG_CELL = 7;
const FLAG_X = 5;
const FLAG_Y = 1;
/**
 * Drapeau à damier (SVG inline, sans fichier) : mât clair et damier noir et blanc (une case sur deux) cerné d'un liseré
 * blanc, pour se lire sur le ciel noir.
 */
const FLAG_SVG = (() => {
  let blacks = '';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if ((row + col) % 2 === 0) {
        blacks += `<rect x="${FLAG_X + col * FLAG_CELL}" y="${FLAG_Y + row * FLAG_CELL}" width="${FLAG_CELL}" height="${FLAG_CELL}" fill="#000"/>`;
      }
    }
  }
  return `<svg viewBox="0 0 ${FLAG_W} ${FLAG_H}" aria-hidden="true" focusable="false">
  <rect x="1" y="0" width="3" height="${FLAG_H}" rx="1.5" fill="#e8e8e8"/>
  <rect x="${FLAG_X}" y="${FLAG_Y}" width="${4 * FLAG_CELL}" height="${4 * FLAG_CELL}" fill="#fff"/>
  ${blacks}
  <rect x="${FLAG_X}" y="${FLAG_Y}" width="${4 * FLAG_CELL}" height="${4 * FLAG_CELL}" fill="none" stroke="#fff" stroke-width="1.5"/>
</svg>`;
})();
/**
 * Les tailles de la position, du chrono et de la barre suivent la largeur de la fenêtre (vw, bornées) : à 1 280 px la
 * position fait 104 px et le chrono 64 px, comme à l'origine ; sur un téléphone en paysage (844 × 390) ils rétrécissent
 * et ne se recouvrent pas (tests e2e).
 */
const CSS = `
.hud-position{position:absolute;top:clamp(4px,.8vw,10px);left:clamp(10px,2.2vw,28px);display:flex;align-items:center;
  gap:.15em;font:800 clamp(40px,8.1vw,104px) Fredoka,system-ui,sans-serif;line-height:1;color:#fff;
  text-shadow:0 .04em 0 #000a,0 0 .13em #000c}
.hud-position[hidden]{display:none}
.hud-position-car{width:1.06em;height:.53em;filter:drop-shadow(0 .03em 0 #000a)}
.hud-bar{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:clamp(240px,36vw,520px);
  box-sizing:border-box;padding:1px 0;border-radius:8px;background:#0008;box-shadow:0 3px 0 #000a}
.hud-lane{position:relative;height:${LANE_PX}px;color:#fff}
.hud-lane.is-galahad{height:${GALAHAD_LANE_PX}px}
.hud-lane::before{content:'';position:absolute;left:${GALAHAD_LANE_PX}px;right:${GALAHAD_LANE_PX}px;top:50%;height:2px;
  margin-top:-1px;border-radius:1px;background:currentColor;opacity:.6}
.hud-lane.is-galahad::before{height:5px;margin-top:-2.5px;border-radius:3px;opacity:1}
.hud-marker{position:absolute;left:${GALAHAD_LANE_PX - LANE_PX}px;top:0;height:100%;width:calc(100% - ${2 * GALAHAD_LANE_PX}px);
  will-change:transform}
.hud-lane.is-galahad .hud-marker{left:0}
.hud-marker svg{display:block;width:${2 * LANE_PX}px;height:100%}
.hud-lane.is-galahad .hud-marker svg{width:${2 * GALAHAD_LANE_PX}px}
.hud-flag{position:absolute;left:100%;top:0;height:100%;aspect-ratio:${FLAG_W}/${FLAG_H};margin-left:6px;pointer-events:none}
.hud-flag svg{display:block;width:100%;height:100%;filter:drop-shadow(0 2px 0 #000a)}
.hud-position-car svg{display:block;width:100%;height:100%}
.hud-time{position:absolute;top:clamp(6px,1.25vw,16px);right:clamp(10px,2.2vw,28px);font:700 clamp(26px,5vw,64px) Fredoka,system-ui,sans-serif;
  color:#fff;text-shadow:0 .05em 0 #000a,0 0 .19em #000c;font-variant-numeric:tabular-nums;letter-spacing:.03em}
.hud-fps{position:absolute;left:28px;bottom:6px;font:500 16px Fredoka,system-ui,sans-serif;color:#fffc;
  text-shadow:0 1px 2px #000;line-height:20px}
.hud-steps{position:absolute;left:112px;bottom:6px;font:500 16px Fredoka,system-ui,sans-serif;color:#fffc;
  text-shadow:0 1px 2px #000;font-variant-numeric:tabular-nums;line-height:20px;white-space:nowrap}
.hud-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:24px;background:rgba(0,0,20,.65);pointer-events:auto;color:#fff;
  font-family:Fredoka,system-ui,sans-serif;text-align:center;text-shadow:0 3px 0 #000a}
.hud-title{font-weight:800;font-size:72px;letter-spacing:4px}
.hud-big{font-weight:800;font-size:120px;font-variant-numeric:tabular-nums}
.hud-again{width:120px;height:120px;border-radius:50%;border:4px solid #fff;background:#e2231a;
  color:#fff;font:800 22px Fredoka,system-ui,sans-serif;box-shadow:0 6px 0 #0008;cursor:pointer}
.hud-error{font-weight:700;font-size:48px;padding:0 32px}
`;

/** Petite voiture de côté (SVG inline, sans fichier), carrosserie de la couleur CSS du conteneur (`currentColor`). */
const CAR_SVG = `<svg viewBox="0 0 44 22" aria-hidden="true" focusable="false">
  <path d="M3 16V11.5C3 10 4 9 5.5 8.8L13 7.5L17 2.5C17.6 1.8 18.4 1.5 19.3 1.5H27.5C28.4 1.5 29.2 1.9 29.8 2.6L33.5 7.5L39 8.8C40.6 9.2 41 10.2 41 11.5V16Z"
    fill="currentColor" stroke="#000" stroke-opacity=".6" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="12" cy="16" r="4.5" fill="#1a1a1a" stroke="#fff" stroke-width="1.5"/>
  <circle cx="32" cy="16" r="4.5" fill="#1a1a1a" stroke="#fff" stroke-width="1.5"/>
</svg>`;

/** Une voiture de la course telle que le HUD la montre sur la barre. */
export interface HudRacer {
  /** Couleur CSS (#rrggbb) de sa carrosserie : celle de son pilote. */
  color: string;
  /** Galahad : son couloir est plus épais ; sa couleur est celle de la petite voiture de la position. */
  isGalahad: boolean;
}

/** Secondes → « mm:ss ». */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export class Hud {
  private readonly time: HTMLDivElement;
  private readonly fps: HTMLDivElement;
  private readonly steps: HTMLDivElement;
  private readonly position: HTMLDivElement;
  private readonly rank: HTMLDivElement;
  /** Le marqueur (petite voiture) du couloir de chaque voiture, dans l'ordre de `racers` (= de la grille, Galahad en haut). */
  private readonly markers: HTMLDivElement[];
  /** Dernière position écrite de chaque marqueur, en dixièmes de pour cent. */
  private readonly lastTenths: number[];
  private overlay: HTMLDivElement | null = null;
  private lastTime = '';
  private lastRank: number | null = null;

  /** `racers` : les voitures de la course, dans l'ordre de `RaceSim.cars` (le même que celui de `setProgress`). */
  constructor(private readonly root: HTMLElement, racers: readonly HudRacer[]) {
    const doc = root.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      doc.head.appendChild(style);
    }
    this.time = this.div('hud-time');
    this.fps = this.div('hud-fps');
    this.fps.hidden = true;
    this.steps = this.div('hud-steps');
    this.steps.hidden = true;
    // Position : vide (cachée) tant que `setPosition` ne reçoit pas de place.
    this.position = this.div('hud-position');
    this.position.hidden = true;
    const car = this.div('hud-position-car');
    car.innerHTML = CAR_SVG;
    const galahad = racers.find((r) => r.isGalahad);
    if (galahad) car.style.color = galahad.color;
    this.rank = this.div('hud-rank');
    this.position.append(car, this.rank);
    // Barre : un couloir par voiture, dans l'ordre de la grille (Galahad en haut, ordre fixe toute la course), avec son
    // marqueur à 0 % (CSS) jusqu'au premier `setProgress`.
    const bar = this.div('hud-bar');
    this.markers = racers.map((r) => {
      const lane = this.div('hud-lane');
      lane.style.color = r.color;
      if (r.isGalahad) lane.classList.add('is-galahad');
      const marker = this.div('hud-marker');
      marker.innerHTML = CAR_SVG;
      lane.appendChild(marker);
      bar.appendChild(lane);
      return marker;
    });
    // Drapeau à damier au bout de la barre, côté arrivée (à droite, là où arrive 100 %) : après les couloirs, hors de la barre.
    const flag = this.div('hud-flag');
    flag.innerHTML = FLAG_SVG;
    bar.appendChild(flag);
    this.lastTenths = racers.map(() => NaN);
    root.append(this.time, this.position, bar, this.fps, this.steps);
    this.setTime(0);
  }

  setTime(seconds: number): void {
    const text = formatTime(seconds);
    if (text !== this.lastTime) this.time.textContent = this.lastTime = text;
  }

  /** Place de Galahad (1 = première) : « 1er », « 2e »… ; null vide l'affichage (première seconde). */
  setPosition(rank: number | null): void {
    if (rank === this.lastRank) return;
    this.lastRank = rank;
    this.position.hidden = rank === null;
    this.rank.textContent = rank === null ? '' : ordinal(rank);
  }

  /**
   * Place chaque voiture sur son couloir : `fractions[i]` ∈ [0 ; 1] pour la voiture i. Déplacée par `transform` (le
   * compositeur, sans mise en page) : le marqueur est large comme la course libre de la petite voiture, donc `translateX`
   * en pour cent de sa propre largeur ; écrit au dixième de pour cent, et seulement quand la valeur change.
   */
  setProgress(fractions: readonly number[]): void {
    const n = Math.min(this.markers.length, fractions.length);
    for (let i = 0; i < n; i++) {
      const tenths = Math.round(fractions[i] * 1000);
      if (tenths === this.lastTenths[i]) continue;
      this.lastTenths[i] = tenths;
      this.markers[i].style.transform = `translateX(${tenths / 10}%)`;
    }
  }

  setFps(fps: number | null): void {
    this.fps.hidden = fps === null;
    if (fps !== null) this.fps.textContent = `${Math.round(fps)} fps`;
  }

  /** Affiche les images de la dernière seconde à 0 pas et à 2 pas ou plus (`?debug=1`, tremblement §8). */
  setFrameSteps(counts: StepCounts): void {
    this.steps.hidden = false;
    this.steps.textContent = `0 pas : ${counts.zero} · 2+ pas : ${counts.multi}`;
  }

  showFinished(seconds: number, onAgain: () => void): void {
    const overlay = this.showOverlay();
    const title = this.div('hud-title', 'ARRIVÉE');
    const big = this.div('hud-big', formatTime(seconds));
    const again = this.root.ownerDocument.createElement('button');
    again.className = 'hud-again';
    again.type = 'button';
    again.textContent = 'ENCORE';
    again.setAttribute('data-no-pedal', '');
    again.addEventListener('click', () => onAgain());
    overlay.append(title, big, again);
  }

  showError(message: string): void {
    this.showOverlay().append(this.div('hud-error', message));
  }

  /** Retire le calque (arrivée ou erreur). */
  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private showOverlay(): HTMLDivElement {
    this.hide();
    this.overlay = this.div('hud-overlay');
    this.root.appendChild(this.overlay);
    return this.overlay;
  }

  private div(className: string, text?: string): HTMLDivElement {
    const d = this.root.ownerDocument.createElement('div');
    d.className = className;
    if (text !== undefined) d.textContent = text;
    return d;
  }
}
