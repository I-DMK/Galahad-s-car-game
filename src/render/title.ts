// Scène de l'écran titre (plan B, tâche 10 ; spec §8 « Titre », addendum « présentation » §2) : la voiture de Galahad qui
// rebondit, devant les quatre copains tirés pour la graine, rangés comme sur la grille (rang n à n × 3,3 m derrière), chacun
// avec son prénom (`drawCar` l'écrit au-dessus des copains, pas de Galahad). Pur calcul (ni DOM, ni matter-js) : poses en
// mètres, sol à y = 0 ; `Renderer.drawTitle` les dessine avec le même `drawCar` que la course (sprites ou code).
import { colorHex, type Pilot } from '../cars/pilots';
import type { Config } from '../config';
import type { CarView } from './renderer';

// Constantes de la scène (pas des paramètres de jeu : pas dans CONFIG, comme les constantes de dessin de car.ts).
/** s : un bond de Galahad. */
export const TITLE_BOUNCE_PERIOD_S = 1.1;
/** m : hauteur du bond (roues au-dessus du sol). */
export const TITLE_BOUNCE_HEIGHT_M = 0.5;
/** Le sol de la scène à 62 % de la hauteur de l'écran (la bande 45 à 62 % reste libre de tout texte DOM). */
export const TITLE_GROUND_FRAC = 0.62;
/** rad/s : roues de Galahad qui tournent (sens de la marche). */
export const TITLE_WHEEL_SPIN_RAD_S = 6;
/**
 * Prénoms des copains au titre : 1,8 fois ceux de la course (≈ 25 px CSS au lieu de 14 sur la tablette), pour que Galahad
 * les lise (décision du papa sur capture, tour 3 de la tâche 10). La course garde sa taille (`drawCar`, échelle 1).
 */
export const TITLE_NAME_SCALE = 1.8;

/** m : le châssis repose WHEEL_DROP au-dessus de l'axe des roues (gabarit : axes à (±0,75 ; −0,25) du châssis). */
const CHASSIS_ABOVE_AXLE_M = 0.25;
const WHEEL_X_M = 0.75;

/**
 * Voiture de `pilot` posée au repos, de profil (titre, et petites voitures du podium de la tâche 11) : châssis à
 * x, y = WHEEL_RADIUS + 0,25 + h, roues à (x ± 0,75 ; WHEEL_RADIUS + h) tournées de `wheelAngle`, angle 0, sans turbo ;
 * `name` écrit par `drawCar` (vide : rien d'écrit).
 */
export function restingCarView(
  pilot: Pilot, x: number, h: number, wheelAngle: number, name: string, cfg: Pick<Config, 'WHEEL_RADIUS'>,
): CarView {
  const R = cfg.WHEEL_RADIUS;
  return {
    id: pilot.id,
    x,
    y: R + CHASSIS_ABOVE_AXLE_M + h,
    angle: 0,
    wheels: [{ x: x - WHEEL_X_M, y: R + h, angle: wheelAngle }, { x: x + WHEEL_X_M, y: R + h, angle: wheelAngle }],
    color: colorHex(pilot.color),
    accent: colorHex(pilot.accent),
    helmet: colorHex(pilot.helmet),
    name,
    turbo: false,
  };
}

/** Hauteur du bond à l'instant t : parabole périodique 4H·u(1 − u), u = (t mod T)/T ; 0 aux rebonds, H à mi-période ; ≥ 0 pour t < 0. */
export function bounceHeight(t: number): number {
  const T = TITLE_BOUNCE_PERIOD_S;
  const u = ((t % T) + T) % T / T;
  return Math.max(0, 4 * TITLE_BOUNCE_HEIGHT_M * u * (1 - u));
}

export interface TitleScene {
  /** Voitures dans l'ordre de dessin (copain de rang 4 d'abord, Galahad en dernier, au-dessus), poses en mètres, sol à y = 0. */
  cars: CarView[];
  /** Hauteur de vol (m) de chaque voiture de `cars`, pour son ombre (0 pour les copains). */
  heights: number[];
  /** Centre horizontal de la rangée (m) : la caméra s'y place. */
  centerX: number;
  t: number;
}

/**
 * `pilots` dans l'ordre de la grille (Galahad en premier). Rangée comme sur la grille : Galahad en x = 0 (écrit `0`, jamais
 * `−0 × …` : `Object.is(−0, 0)` est faux), le copain de rang n à 0 − n × GRID_SPACING_FACTOR × CAR_LENGTH (3,3 m). Châssis à
 * y = WHEEL_RADIUS + 0,25 + h, roues à (x ± 0,75 ; WHEEL_RADIUS + h), angle 0 ; h = bounceHeight(t) pour Galahad, 0 sinon ;
 * roues de Galahad tournées de −t × TITLE_WHEEL_SPIN_RAD_S ; `turbo` faux ; `name` = prénom ; `id`, `color`, `accent`,
 * `helmet` du pilote. Tableau construit du dernier rang au rang 0 ; `centerX` = milieu de la première et de la dernière.
 */
export function titleScene(pilots: readonly Pilot[], t: number, cfg: Config): TitleScene {
  const spacing = cfg.GRID_SPACING_FACTOR * cfg.CAR_LENGTH;
  const cars: CarView[] = [];
  const heights: number[] = [];
  for (let rank = pilots.length - 1; rank >= 0; rank--) {
    const p = pilots[rank];
    const x = rank === 0 ? 0 : -rank * spacing;
    const h = rank === 0 ? bounceHeight(t) : 0;
    const wheelAngle = rank === 0 ? -t * TITLE_WHEEL_SPIN_RAD_S : 0;
    cars.push(restingCarView(p, x, h, wheelAngle, p.name, cfg));
    heights.push(h);
  }
  const centerX = cars.length === 0 ? 0 : (cars[0].x + cars[cars.length - 1].x) / 2;
  return { cars, heights, centerX, t };
}
