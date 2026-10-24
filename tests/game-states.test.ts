// Machine d'états pure du jeu (plan B, tâche 10 ; spec §4 « Machine d'états ») : la table des transitions seule, sans
// `Game` ni DOM. Un événement sans ligne pour la phase courante rend le même objet (aucune allocation).
import { INITIAL_STATE, transition, type GameEvent, type MachineState, type Phase } from '../src/loop/states';

const at = (phase: Phase, from: MachineState['from'] = null): MachineState => ({ phase, from });
const EVENTS: GameEvent[] = ['play', 'go', 'finish', 'podium', 'pause', 'resume', 'again', 'menu', 'error'];

test('état initial : titre', () => {
  expect(INITIAL_STATE).toEqual({ phase: 'title', from: null });
});

test('chemin nominal : titre → JOUER → décompte → PARTEZ → course → arrivée → ENCORE → décompte', () => {
  let s = INITIAL_STATE;
  s = transition(s, 'play'); expect(s.phase).toBe('countdown');
  s = transition(s, 'go'); expect(s.phase).toBe('racing');
  s = transition(s, 'finish'); expect(s.phase).toBe('finished');
  s = transition(s, 'again'); expect(s.phase).toBe('countdown');
  s = transition(s, 'go'); s = transition(s, 'finish');
  expect(transition(s, 'menu')).toEqual(at('title'));
  expect(transition(s, 'podium')).toEqual(at('podium'));
  expect(transition(at('podium'), 'again')).toEqual(at('countdown'));
  expect(transition(at('podium'), 'menu')).toEqual(at('title'));
});

test('pause depuis le décompte ou la course, mémorise d’où ; reprise = décompte à 3', () => {
  expect(transition(at('countdown'), 'pause')).toEqual(at('paused', 'countdown'));
  expect(transition(at('racing'), 'pause')).toEqual(at('paused', 'racing'));
  expect(transition(at('paused', 'racing'), 'resume')).toEqual(at('countdown'));
  expect(transition(at('paused', 'countdown'), 'resume')).toEqual(at('countdown'));
});

test('pause ignorée au titre, à l’arrivée, au podium, en pause et en erreur (même objet rendu)', () => {
  for (const p of ['title', 'finished', 'podium', 'error'] as Phase[]) { const s = at(p); expect(transition(s, 'pause'), p).toBe(s); }
  const paused = at('paused', 'racing');
  expect(transition(paused, 'pause')).toBe(paused);
});

test('error depuis toute phase sauf error ; error absorbe tout', () => {
  for (const p of ['title', 'countdown', 'racing', 'finished', 'podium', 'paused'] as Phase[]) expect(transition(at(p), 'error')).toEqual(at('error'));
  for (const ev of EVENTS) { const s = at('error'); expect(transition(s, ev), ev).toBe(s); }
});

test('un événement sans ligne rend le même objet (aucune allocation, aucun changement)', () => {
  const cases: [MachineState, GameEvent][] = [
    [at('title'), 'go'], [at('title'), 'resume'], [at('title'), 'again'], [at('title'), 'menu'], [at('title'), 'finish'],
    [at('countdown'), 'play'], [at('countdown'), 'finish'], [at('racing'), 'play'], [at('racing'), 'go'], [at('racing'), 'resume'],
    [at('finished'), 'pause'], [at('finished'), 'go'], [at('paused', 'racing'), 'go'], [at('paused', 'racing'), 'play'],
  ];
  for (const [s, ev] of cases) expect(transition(s, ev), `${s.phase} + ${ev}`).toBe(s);
});

test('toute transition sort une phase connue et `from` n’est posé qu’en pause', () => {
  const phases: Phase[] = ['title', 'countdown', 'racing', 'finished', 'podium', 'paused', 'error'];
  for (const p of phases) for (const ev of EVENTS) {
    const out = transition(at(p, p === 'paused' ? 'racing' : null), ev);
    expect(phases).toContain(out.phase);
    expect(out.from === null || out.phase === 'paused').toBe(true);
  }
});
