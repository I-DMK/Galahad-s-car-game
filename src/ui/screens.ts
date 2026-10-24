// Écrans DOM du jeu (plan B, tâche 10 ; spec §8 « Écrans », §4 « pause » ; addendum « présentation » §2) dans #hud :
// titre (nom du jeu, version, JOUER avec drapeau, AUTRE PISTE avec dé ; la scène des voitures est dessinée derrière par
// le canvas, `render/title.ts`), décompte (3, 2, 1, PARTEZ ; calque sans toucher) et pause (« PAUSE » + REPRENDRE en
// paysage, « TOURNE » + dessin de tablette en portrait). Les trois calques sont créés une fois et cachés par `hidden`,
// jamais retirés : un doigt posé sur JOUER garde ainsi sa cible jusqu'au `pointerup`, qui remonte à `window` et relâche
// le gaz (`Throttle`). Chromium redirige de lui-même vers `window` le `pointerup` d'une cible retirée (mesuré en e2e) ;
// la protection vaut pour jsdom et les autres navigateurs, et ne coûte rien. JOUER n'a PAS `data-no-pedal` (« le
// pointerdown sur JOUER compte comme doigt posé », spec §8) ; AUTRE PISTE, REPRENDRE et le voile de pause entier en
// portent (un tap n'y est jamais du gaz).
import { FONT_FAMILY } from './font';

const STYLE_ID = 'screens-style';

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

export interface TitleActions {
  /**
   * JOUER : au `pointerdown` (`viaPointer` vrai : le doigt compte comme gaz, spec §8, et le plein écran se demande au
   * `pointerup` suivant) et au `click` (`viaPointer` faux : clavier, pas de plein écran) ; `Game` ignore le doublon.
   */
  onPlay(viaPointer: boolean): void;
  /** AUTRE PISTE : au `click` ; le bouton porte data-no-pedal. */
  onOtherTrack(): void;
}

export class Screens {
  private readonly title: HTMLDivElement;
  private readonly countdown: HTMLDivElement;
  private readonly countdownText: HTMLDivElement;
  private readonly pause: HTMLDivElement;
  private readonly pauseText: HTMLDivElement;
  private readonly tablet: HTMLDivElement;
  private readonly resume: HTMLButtonElement;
  private lastCountdown = '';

  /**
   * Crée les trois calques cachés dans `root` (#hud), après le HUD et le bouton saut, et injecte le style une fois
   * (`screens-style`). `onResume` : REPRENDRE, au `pointerdown` ET au `click` (un doigt tenu sur le bouton n'émet pas de
   * `click` avant d'être levé ; `Game` ignore le doublon).
   */
  constructor(private readonly root: HTMLElement, opts: { version: string }, actions: TitleActions & { onResume(): void }) {
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

    for (const s of [this.title, this.countdown, this.pause]) s.hidden = true;
    root.append(this.title, this.countdown, this.pause);
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

  /** Cache les trois calques (course, arrivée, erreur). */
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
    for (const s of [this.title, this.countdown, this.pause]) s.hidden = s !== shown;
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
