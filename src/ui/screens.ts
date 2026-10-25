// Écrans DOM du jeu (plan B, tâche 10 ; spec §8 « Écrans », §4 « pause » ; addendum « présentation » §2) dans #hud :
// titre (nom du jeu, version, JOUER avec drapeau, AUTRE PISTE avec dé ; la scène des voitures est dessinée derrière par
// le canvas, `render/title.ts`), décompte (3, 2, 1, PARTEZ ; calque sans toucher) et pause (« PAUSE » + REPRENDRE en
// paysage, « TOURNE » + dessin de tablette en portrait) et, depuis la tâche 11, podium (temps de Galahad, trois marches
// avec prénom, petite voiture et médaille, case de Galahad hors podium, ENCORE et MENU). Les quatre calques sont créés une
// fois et cachés par `hidden`,
// jamais retirés : un doigt posé sur JOUER garde ainsi sa cible jusqu'au `pointerup`, qui remonte à `window` et relâche
// le gaz (`Throttle`). Chromium redirige de lui-même vers `window` le `pointerup` d'une cible retirée (mesuré en e2e) ;
// la protection vaut pour jsdom et les autres navigateurs, et ne coûte rien. JOUER n'a PAS `data-no-pedal` (« le
// pointerdown sur JOUER compte comme doigt posé », spec §8) ; AUTRE PISTE, REPRENDRE et le voile de pause entier en
// portent (un tap n'y est jamais du gaz) ; au podium, le voile entier, ENCORE et MENU aussi.
import { ordinal, type PodiumPlace, type PodiumView } from '../cars/ranking';
import { FONT_FAMILY } from './font';
import { formatTime } from './hud';

const STYLE_ID = 'screens-style';
/** ms : fenêtre où le click d'un tap qui a déjà agi au pointerup (MENU) est avalé. */
const CLICK_SWALLOW_MS = 600;

/**
 * Les boutons font au moins 96 px CSS de côté (spec §8), déclarés en px (`min-width`, `min-height`) pour que la feuille
 * le dise sans mise en page (tests jsdom) ; JOUER grandit avec la hauteur de l'écran. Zones du titre : nom dans les 30 % du
 * haut, boutons dans les 30 % du bas (`bottom: 4vh`), version en bas à droite (le fps de `?debug=1` est en bas à gauche) ;
 * la bande de 45 à 62 % de la hauteur reste libre pour les voitures (TITLE_GROUND_FRAC, `render/title.ts`).
 * La règle générique `.screen button` (spécificité 0,1,1) ne déclare ni `padding` ni `margin` : elle l'emporterait sur le
 * remplissage de `.btn-other` et `.btn-resume` (0,1,0) ; chaque bouton déclare le sien.
 */
const CSS = `
.screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;font-family:${FONT_FAMILY};
  color:#fff;text-shadow:0 3px 0 #000a}
.screen[hidden]{display:none}
.screen [hidden]{display:none}
.screen button{font-family:inherit;color:#fff;border:4px solid #fff;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:.2em;cursor:pointer;pointer-events:auto;touch-action:none;
  -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;box-shadow:0 6px 0 #0008;
  text-shadow:0 2px 0 #000a;line-height:1}
.screen button .btn-icon{display:block;flex:none}
.screen button svg{display:block;width:100%;height:100%;pointer-events:none}
.screen-title{pointer-events:auto}
.title-name{position:absolute;top:3vh;left:0;right:0;margin:0;text-align:center;font-weight:700;
  font-size:clamp(40px,9vh,88px);line-height:1.05;letter-spacing:.02em}
.title-name small{display:block;font-size:.55em;font-weight:600;margin-top:.1em}
.title-version{position:absolute;bottom:6px;right:10px;font-size:12px;font-weight:600;line-height:1;opacity:.85;
  text-shadow:0 1px 0 #000a}
.title-buttons{position:absolute;bottom:4vh;left:0;right:0;display:flex;align-items:center;justify-content:center;
  gap:clamp(20px,6vw,80px);pointer-events:none}
.btn-play{min-width:96px;min-height:96px;width:clamp(96px,22vh,170px);height:clamp(96px,22vh,170px);border-radius:50%;
  padding:0;margin:0;background:#22c55e;font-weight:700;font-size:clamp(17px,3.2vh,26px)}
.btn-play .btn-icon{width:38%;height:38%}
.btn-other{min-width:96px;min-height:96px;height:96px;padding:0 28px;margin:0;border-radius:24px;background:#1e5cff;
  font-weight:700;font-size:17px}
.btn-other .btn-icon{width:38px;height:38px}
.screen-countdown{pointer-events:none;justify-content:center}
.countdown-text{font-size:160px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:.04em;
  text-shadow:0 6px 0 #000a,0 0 .2em #000c}
.screen-pause{background:rgba(0,0,20,.65);pointer-events:auto;justify-content:center;gap:24px}
.pause-text{font-size:clamp(56px,12vh,96px);font-weight:700;line-height:1;letter-spacing:4px}
.pause-tablet{width:clamp(90px,22vh,150px);height:auto}
.pause-tablet svg{display:block;width:100%;height:auto}
.btn-resume{min-width:96px;min-height:96px;height:96px;padding:0 36px;margin:0;border-radius:24px;background:#e2231a;
  font-weight:700;font-size:28px}
.screen-podium{background:rgba(0,0,20,.35);pointer-events:auto;justify-content:space-between;padding:2vh 0 4vh;box-sizing:border-box}
.podium-time{font-size:clamp(40px,12vh,110px);font-weight:700;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:.03em}
.podium-row{display:flex;align-items:flex-end;justify-content:center;gap:clamp(8px,1.5vw,20px)}
.podium-step,.podium-me{display:flex;flex-direction:column;align-items:center;width:clamp(110px,16vw,200px)}
.podium-name{font-size:clamp(16px,3.4vh,28px);font-weight:700;line-height:1.1;white-space:nowrap}
.podium-car{display:block;width:100%;height:auto;aspect-ratio:2/1}
.podium-block{width:100%;box-sizing:border-box;display:flex;justify-content:center;align-items:flex-start;padding-top:6px;
  background:#c8c8c8;border:3px solid #fff;border-bottom:none;border-radius:10px 10px 0 0;box-shadow:inset 0 -6px 0 #0002}
.step-1 .podium-block{height:24vh}
.step-2 .podium-block{height:18vh}
.step-3 .podium-block{height:13vh}
.podium-medal{height:min(9vh,80px)}
.podium-medal svg{display:block;height:100%;width:auto}
.podium-step.is-galahad .podium-name{color:#ffd23f}
.podium-step.is-galahad .podium-block{background:#ffe27a}
.podium-me{margin-left:clamp(16px,4vw,56px);align-self:center}
.podium-me-place{font-size:clamp(40px,10vh,88px);font-weight:700;line-height:1}
.podium-buttons{display:flex;align-items:center;justify-content:center;gap:clamp(20px,6vw,80px)}
.btn-again{min-width:96px;min-height:96px;width:clamp(96px,16vh,130px);height:clamp(96px,16vh,130px);border-radius:50%;
  padding:0;margin:0;background:#e2231a;font-weight:700;font-size:clamp(18px,3.2vh,26px)}
.btn-again .btn-icon{width:36%;height:36%}
.btn-menu{min-width:96px;min-height:96px;height:96px;padding:0 28px;margin:0;border-radius:24px;background:#1e5cff;
  font-weight:700;font-size:20px}
.btn-menu .btn-icon{width:38px;height:38px}
@media (orientation:portrait){
  .podium-row{flex-wrap:wrap}
  .podium-step{width:24vw}
  .podium-me{width:100%;margin:2vh 0 0;flex-direction:row;justify-content:center;gap:12px}
  .podium-me .podium-car{width:24vw}
}
`;

/** Drapeau à damier (SVG inline, sans fichier) : mât et 3 × 3 cases. */
const FLAG_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <rect x="10" y="4" width="5" height="58" rx="2.5" fill="#fff"/>
  <rect x="15" y="6" width="42" height="30" fill="#fff"/>
  <rect x="15" y="6" width="14" height="10" fill="#000"/><rect x="43" y="6" width="14" height="10" fill="#000"/>
  <rect x="29" y="16" width="14" height="10" fill="#000"/>
  <rect x="15" y="26" width="14" height="10" fill="#000"/><rect x="43" y="26" width="14" height="10" fill="#000"/>
</svg>`;

/** Dé à cinq points (SVG inline). */
const DICE_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <rect x="6" y="6" width="52" height="52" rx="10" fill="#fff"/>
  <circle cx="20" cy="20" r="5.5" fill="#1e5cff"/><circle cx="44" cy="20" r="5.5" fill="#1e5cff"/>
  <circle cx="32" cy="32" r="5.5" fill="#1e5cff"/>
  <circle cx="20" cy="44" r="5.5" fill="#1e5cff"/><circle cx="44" cy="44" r="5.5" fill="#1e5cff"/>
</svg>`;

/** Tablette en portrait avec une flèche de rotation (SVG inline) : « tourne la tablette ». */
const TABLET_SVG = `<svg viewBox="0 0 120 160" aria-hidden="true" focusable="false" fill="none" stroke="#fff" stroke-width="6"
  stroke-linecap="round" stroke-linejoin="round">
  <rect x="26" y="14" width="68" height="112" rx="10" fill="#0a1030"/>
  <rect x="34" y="24" width="52" height="86" rx="3" fill="#1e5cff" stroke="none"/>
  <circle cx="60" cy="118" r="3.5" fill="#fff" stroke="none"/>
  <path d="M14 96 A48 48 0 0 1 24 44"/>
  <path d="M12 60 L24 44 L36 58" />
  <path d="M106 64 A48 48 0 0 1 96 116"/>
  <path d="M108 100 L96 116 L84 102" />
</svg>`;

/** Médaille (SVG inline) : ruban bleu, disque `fill` cerclé de `rim`, chiffre de la place. Arguments constants uniquement. */
const medal = (fill: string, rim: string, n: 1 | 2 | 3) => `<svg viewBox="0 0 64 80" aria-hidden="true" focusable="false">
  <path d="M18 0h12l6 24H24zM34 0h12l-6 24H28z" fill="#1e5cff"/>
  <circle cx="32" cy="50" r="25" fill="${fill}" stroke="${rim}" stroke-width="5"/>
  <text x="32" y="61" text-anchor="middle" font-size="30" font-weight="700" font-family="Fredoka, system-ui, sans-serif" fill="#3a2a00">${n}</text>
</svg>`;
/** Or, argent, bronze : médailles des places 1, 2, 3. */
const MEDAL_SVG = [medal('#ffd23f', '#c99a00', 1), medal('#d9dee6', '#9aa3ad', 2), medal('#e08a4a', '#a3592a', 3)] as const;
/** Flèche en boucle (ENCORE). */
const AGAIN_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="#fff" stroke-width="8"
  stroke-linecap="round" stroke-linejoin="round"><path d="M50 32a18 18 0 1 1-6-13.4"/><path d="M46 6v14H32"/></svg>`;
/**
 * Maison (MENU). Aucun blanc entre les balises (ni dans AGAIN_SVG) : un nœud texte « \n  » dans l'icône s'ajouterait au
 * `textContent` du bouton (« \n  MENU »), que les tests comparent à « MENU ». Les médailles ne sont pas dans des boutons.
 */
const HOME_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="#fff"><path d="M32 8 6 30h8v24h14V40h8v14h14V30h8z"/></svg>`;

export interface TitleActions {
  /**
   * JOUER : au `pointerdown` (`viaPointer` vrai : le doigt compte comme gaz, spec §8, et le plein écran se demande au
   * `pointerup` suivant) et au `click` (`viaPointer` faux : clavier, pas de plein écran) ; `Game` ignore le doublon.
   */
  onPlay(viaPointer: boolean): void;
  /** AUTRE PISTE : au `click` ; le bouton porte data-no-pedal. */
  onOtherTrack(): void;
}

export interface PodiumActions {
  /**
   * ENCORE : au `pointerdown` ET au `click` (data-no-pedal). Un doigt de gaz peut rester posé quand le podium arrive : avec
   * un autre doigt sur l'écran, le `click` du tap ne part pas toujours (leçon de REPRENDRE, session 6). Le doublon est sans
   * effet : après le premier, la phase est `countdown`, qui n'a pas de ligne `again`.
   */
  onAgain(): void;
  /**
   * MENU (data-no-pedal) : au `pointerup` du doigt posé sur MENU et au `click`, jamais au `pointerdown` (A20, revu au tour 1).
   */
  onMenu(): void;
}

export class Screens {
  private readonly title: HTMLDivElement;
  private readonly countdown: HTMLDivElement;
  private readonly countdownText: HTMLDivElement;
  private readonly pause: HTMLDivElement;
  private readonly pauseText: HTMLDivElement;
  private readonly tablet: HTMLDivElement;
  private readonly resume: HTMLButtonElement;
  private readonly podium: HTMLDivElement;
  private readonly podiumTime: HTMLDivElement;
  /** Les trois marches, de gauche à droite : 2e, 1er, 3e. */
  private readonly steps: { place: 1 | 2 | 3; step: HTMLDivElement; name: HTMLDivElement; car: HTMLCanvasElement }[];
  /** Case de Galahad hors podium (4e, 5e) : place, petite voiture, prénom. */
  private readonly me: HTMLDivElement;
  private readonly meRank: HTMLDivElement;
  private readonly meName: HTMLDivElement;
  private readonly meCar: HTMLCanvasElement;
  /** Les quatre calques (titre, décompte, pause, podium) : `show()` et la création les parcourent. */
  private readonly layers: HTMLDivElement[];
  private lastCountdown = '';

  /**
   * Crée les quatre calques cachés dans `root` (#hud), après le HUD et le bouton saut, et injecte le style une fois
   * (`screens-style`). `onResume` : REPRENDRE, au `pointerdown` ET au `click` (un doigt tenu sur le bouton n'émet pas de
   * `click` avant d'être levé ; `Game` ignore le doublon). `onAgain`, `onMenu` : ENCORE et MENU du podium (`PodiumActions`).
   */
  constructor(
    private readonly root: HTMLElement, opts: { version: string }, actions: TitleActions & PodiumActions & { onResume(): void },
  ) {
    const doc = root.ownerDocument;
    if (!doc.getElementById(STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      doc.head.appendChild(style);
    }

    // Titre : nom sur deux lignes (décision Q4 du papa), version, JOUER (drapeau) et AUTRE PISTE (dé).
    this.title = this.div('screen screen-title');
    const name = doc.createElement('h1');
    name.className = 'title-name';
    name.append('Course Lunaire');
    const small = doc.createElement('small');
    small.textContent = 'de Galahad';
    name.appendChild(small);
    const version = this.div('title-version', `v${opts.version}`);
    const buttons = this.div('title-buttons');
    const play = this.button('btn-play', 'JOUER', FLAG_SVG);
    play.setAttribute('aria-label', 'Jouer');
    play.addEventListener('pointerdown', () => actions.onPlay(true));
    play.addEventListener('click', () => actions.onPlay(false));
    const other = this.button('btn-other', 'AUTRE PISTE', DICE_SVG);
    other.setAttribute('data-no-pedal', '');
    other.addEventListener('click', () => actions.onOtherTrack());
    buttons.append(play, other);
    this.title.append(name, buttons, version);

    // Décompte : un texte centré, le calque ne capte pas le toucher (le doigt gardé depuis JOUER reste du gaz).
    this.countdown = this.div('screen screen-countdown');
    this.countdownText = this.div('countdown-text');
    this.countdown.appendChild(this.countdownText);

    // Pause : voile entier data-no-pedal (un doigt posé hors du bouton n'est jamais du gaz à PARTEZ), texte, tablette, REPRENDRE.
    this.pause = this.div('screen screen-pause');
    this.pause.setAttribute('data-no-pedal', '');
    this.pauseText = this.div('pause-text', 'PAUSE');
    this.tablet = this.div('pause-tablet');
    this.tablet.innerHTML = TABLET_SVG;
    this.tablet.hidden = true;
    this.resume = this.button('btn-resume', 'REPRENDRE');
    this.resume.setAttribute('data-no-pedal', '');
    this.resume.addEventListener('pointerdown', () => actions.onResume());
    this.resume.addEventListener('click', () => actions.onResume());
    this.pause.append(this.pauseText, this.tablet, this.resume);

    // Podium (tâche 11) : voile data-no-pedal (un doigt laissé dessus n'est pas du gaz à PARTEZ après ENCORE), temps de
    // Galahad, trois marches (2e, 1er, 3e de gauche à droite), case de Galahad hors podium, ENCORE et MENU. Rempli par `showPodium`.
    this.podium = this.div('screen screen-podium');
    this.podium.setAttribute('data-no-pedal', '');
    this.podiumTime = this.div('podium-time');
    const row = this.div('podium-row');
    this.steps = ([2, 1, 3] as const).map((place) => {
      const step = this.div(`podium-step step-${place}`);
      const name = this.div('podium-name');
      const car = doc.createElement('canvas');
      car.className = 'podium-car';
      const block = this.div('podium-block');
      const medalBox = this.div('podium-medal');
      medalBox.innerHTML = MEDAL_SVG[place - 1];
      block.appendChild(medalBox);
      step.append(name, car, block);
      row.appendChild(step);
      return { place, step, name, car };
    });
    this.me = this.div('podium-me');
    this.meRank = this.div('podium-me-place');
    this.meCar = doc.createElement('canvas');
    this.meCar.className = 'podium-car';
    this.meName = this.div('podium-name');
    this.me.append(this.meRank, this.meCar, this.meName);
    this.me.hidden = true;
    row.appendChild(this.me);
    const podiumButtons = this.div('podium-buttons');
    const again = this.button('btn-again', 'ENCORE', AGAIN_SVG);
    again.setAttribute('data-no-pedal', '');
    // ENCORE au pointerdown (doigt de gaz encore posé : le click peut ne pas partir) et au click (clavier) ; doublon ignoré par `Game`.
    again.addEventListener('pointerdown', () => actions.onAgain());
    again.addEventListener('click', () => actions.onAgain());
    // MENU jamais au pointerdown (A20) : au titre, AUTRE PISTE est presque à la même place ; le titre montré sous le doigt
    // posé, le click du même tap y changerait de piste. MENU agit au pointerup du doigt posé sur MENU lui-même (le click ne
    // part pas toujours quand un doigt de gaz reste posé, cr 2 du tour 1) et au click (clavier). Le click qui suit le
    // pointerup est calculé par Chromium à l'endroit du tap, sur le titre déjà montré : il tomberait sur AUTRE PISTE
    // (mesuré en e2e à 844 × 390). Il est donc avalé (`swallowNextClick`). `Game` ignore un doublon (`title` n'a pas de
    // ligne `menu`).
    const menu = this.button('btn-menu', 'MENU', HOME_SVG);
    menu.setAttribute('data-no-pedal', '');
    let menuPointer: number | null = null;
    menu.addEventListener('pointerdown', (e) => { menuPointer = e.pointerId; });
    menu.addEventListener('pointerup', (e) => {
      if (e.pointerId !== menuPointer) return;
      menuPointer = null;
      this.swallowNextClick();
      actions.onMenu();
    });
    menu.addEventListener('click', () => actions.onMenu());
    podiumButtons.append(again, menu);
    this.podium.append(this.podiumTime, row, podiumButtons);

    this.layers = [this.title, this.countdown, this.pause, this.podium];
    for (const s of this.layers) s.hidden = true;
    root.append(...this.layers);
  }

  /** Montre le titre (les autres calques cachés). */
  showTitle(): void {
    this.show(this.title);
  }

  /**
   * Montre le décompte avec ce texte ('3', '2', '1', 'PARTEZ') ; le calque ne capte pas le toucher. Appelé à chaque image du
   * décompte : le texte n'est écrit que s'il change et les attributs `hidden` que si le calque était caché (aucune mutation
   * du DOM sinon).
   */
  showCountdown(text: string): void {
    if (text !== this.lastCountdown) this.countdownText.textContent = this.lastCountdown = text;
    if (this.countdown.hidden) this.show(this.countdown);
  }

  /** Montre la pause : « PAUSE » + REPRENDRE en paysage, « TOURNE » + dessin de tablette sans REPRENDRE en portrait. */
  showPaused(portrait: boolean): void {
    this.applyPortrait(portrait);
    this.show(this.pause);
  }

  /** Change le calque de pause déjà montré (rotation pendant la pause) ; sans effet ailleurs. */
  setPortrait(portrait: boolean): void {
    if (this.pause.hidden) return;
    this.applyPortrait(portrait);
  }

  /**
   * Montre le podium (les autres calques cachés) : temps de Galahad (mm:ss), les trois premiers sur leurs marches (2e, 1er,
   * 3e de gauche à droite : prénom, petite toile peinte par `paintCar`, médaille), la marche de Galahad surlignée ; hors
   * podium, sa case à droite (« 4e », sa voiture, son prénom). Rappelé à chaque arrivée : tout est réécrit, rien n'est ajouté.
   */
  showPodium(view: PodiumView, paintCar: (canvas: HTMLCanvasElement, place: PodiumPlace) => void): void {
    this.podiumTime.textContent = formatTime(view.galahadTime);
    for (const s of this.steps) {
      const p = view.places[s.place - 1];
      s.step.hidden = p === undefined;
      s.step.classList.toggle('is-galahad', p?.isGalahad === true);
      s.name.textContent = p?.name ?? '';
    }
    const me = view.places[view.galahadPlace - 1];
    this.me.hidden = me === undefined || view.galahadPlace <= 3;
    this.meRank.textContent = ordinal(view.galahadPlace);
    this.meName.textContent = me?.name ?? '';
    this.show(this.podium);
    // Après `show` : la mise en page donne leur largeur aux petites toiles (jsdom : 0, `paintCarIcon` prend sa largeur par défaut).
    for (const s of this.steps) {
      const p = view.places[s.place - 1];
      if (p) paintCar(s.car, p);
    }
    if (!this.me.hidden && me) paintCar(this.meCar, me);
  }

  /** Cache les quatre calques (course, arrivée, erreur). */
  hide(): void {
    this.show(null);
  }

  private applyPortrait(portrait: boolean): void {
    this.pauseText.textContent = portrait ? 'TOURNE' : 'PAUSE';
    this.tablet.hidden = !portrait;
    this.resume.hidden = portrait;
  }

  /** Montre `shown` seul ; `null` cache tout. Les calques restent dans le DOM (jamais retirés). */
  private show(shown: HTMLDivElement | null): void {
    for (const s of this.layers) s.hidden = s !== shown;
  }

  /**
   * Avale (phase de capture, sur `window`) le prochain click s'il arrive dans les CLICK_SWALLOW_MS : celui du tap qui vient
   * d'agir au pointerup, quelle que soit sa cible. Un click plus tardif passe (l'écouteur, à usage unique, se retire).
   */
  private swallowNextClick(): void {
    const win = this.root.ownerDocument.defaultView;
    if (!win) return;
    const until = win.performance.now() + CLICK_SWALLOW_MS;
    win.addEventListener('click', (e) => {
      if (win.performance.now() > until) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, { capture: true, once: true });
  }

  private div(className: string, text?: string): HTMLDivElement {
    const d = this.root.ownerDocument.createElement('div');
    d.className = className;
    if (text !== undefined) d.textContent = text;
    return d;
  }

  /** Bouton (type button) : icône SVG constante (inline, sans fichier) au-dessus d'un mot court. */
  private button(className: string, label: string, svg?: string): HTMLButtonElement {
    const doc = this.root.ownerDocument;
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = className;
    if (svg) {
      const icon = doc.createElement('span');
      icon.className = 'btn-icon';
      icon.innerHTML = svg;
      b.appendChild(icon);
    }
    const word = doc.createElement('span');
    word.className = 'btn-label';
    word.textContent = label;
    b.appendChild(word);
    return b;
  }
}
