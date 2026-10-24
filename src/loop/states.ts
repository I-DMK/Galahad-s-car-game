// Machine d'états du jeu (plan B, tâche 10 ; spec §4 « Machine d'états ») : une table pure, sans DOM ni matter-js.
// `Game` l'orchestre : il envoie un événement, lit la phase rendue, et fait le reste (écrans, décompte, course).
// Un événement sans ligne pour la phase courante rend l'état inchangé (le même objet : aucune allocation).

export type Phase = 'title' | 'countdown' | 'racing' | 'finished' | 'podium' | 'paused' | 'error';

export type GameEvent =
  | 'play'            // JOUER (titre)
  | 'go'              // fin du décompte : PARTEZ
  | 'finish'          // Galahad passe la ligne
  | 'podium'          // tâche 11 : fin de la roue libre
  | 'pause'           // onglet caché, popstate, portrait
  | 'resume'          // REPRENDRE : repart toujours par le décompte
  | 'again'           // ENCORE : même piste, mêmes copains
  | 'menu'            // MENU : retour au titre
  | 'error';          // 3 échecs de stepRace, exception de rendu

/** `from` : phase d'où l'on est entré en pause ('countdown' ou 'racing'), null ailleurs. */
export interface MachineState { readonly phase: Phase; readonly from: 'countdown' | 'racing' | null }

export const INITIAL_STATE: MachineState = Object.freeze({ phase: 'title', from: null });

/** Phases d'où une pause est possible (et mémorisée dans `from`). */
type Pausable = 'countdown' | 'racing';

/** Phase d'arrivée d'un événement, ou `pause` : passage en pause en mémorisant la phase courante. */
type Row = Partial<Record<GameEvent, Phase | 'pause'>>;

/**
 * La table (spec §4) : `error` est atteignable depuis toute phase sauf `error`, qui absorbe tout ; `paused` ne sort que
 * par `resume` (→ `countdown`) ou `error` ; `podium` est dans la table mais n'est atteint qu'à la tâche 11.
 */
const TABLE: Record<Phase, Row> = {
  title: { play: 'countdown', error: 'error' },
  countdown: { go: 'racing', pause: 'pause', error: 'error' },
  racing: { finish: 'finished', pause: 'pause', error: 'error' },
  finished: { podium: 'podium', again: 'countdown', menu: 'title', error: 'error' },
  podium: { again: 'countdown', menu: 'title', error: 'error' },
  paused: { resume: 'countdown', error: 'error' },
  error: {},
};

/** Transition de la table ; sans ligne pour (phase, événement), rend `s` lui-même. */
export function transition(s: MachineState, ev: GameEvent): MachineState {
  const to = TABLE[s.phase][ev];
  if (to === undefined) return s;
  if (to === 'pause') return { phase: 'paused', from: s.phase as Pausable };
  return { phase: to, from: null };
}
