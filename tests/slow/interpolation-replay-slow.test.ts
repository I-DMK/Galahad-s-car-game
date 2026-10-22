// Rendu interpolé (tâche 5f du plan B ; tremblement §6), suite lente : 12 courses à 5 voitures doigt posé
// (graines 0 à 11, 150 s), chacune rejouée sur 4 écrans simulés en physique / actuel / interpolé, à travers
// `runFrame` et `presentFrame` comme `Game`. Budget : moins de 30 min mur (≈ 4 min 30 mesurées) ;
// enregistrements en mémoire, une course par graine.
//
// Exigences, par écran :
// - aucun épisode interpolé dû à la cadence (`classifyEpisodes(…).cadence` = 0 sur chaque course) ;
// - au plus MAX_MASKED épisode interpolé masqué (expliqué par la trajectoire) par écran : le masquage ne doit pas
//   devenir une porte de sortie (interpolé = masqués + cadence, et cadence = 0 est déjà exigé) ;
// - contrôle vivant : à 60,05 et à 59,94 Hz, le rendu actuel (sans interpolation) a au moins un épisode dû
//   à la cadence.
// Mesuré au tour 1 (épisodes physique / actuel / interpolé, dont masqués) : 60,05 Hz 0 / 75 / 0 ;
// 59,94 Hz 0 / 90 / 0 ; 60,000 Hz 0 / 3 / 1, dont 1 masqué ; 120 Hz 0 / 13 / 0. L'épisode masqué : graine 0,
// 49,8 s, un choc entre voitures qui donne 2 à-coups en physique (pas d'épisode) et 3 en interpolé (un
// épisode), sans réapparition à moins de 1 s.
import { CONFIG } from '../../src/config';
import { classifyEpisodes, recordTrajectory, replayScreenX, shakeEpisodes, type RenderMode, type ScreenModel } from '../helpers/frames';
import { AP } from '../helpers/anciennes-pistes';
import { trackFor } from '../helpers/runs';

const SEEDS = Array.from({ length: 12 }, (_, i) => i);
const SECONDS = 150;
const SCREENS: Omit<ScreenModel, 'seed'>[] = [
  { hz: 60.05, jitterMs: 0.2 },
  { hz: 59.94, jitterMs: 0.1 },
  { hz: 60.0, jitterMs: 0.2 },
  { hz: 120, jitterMs: 0.1 },
];
/** Écrans du contrôle vivant (le rendu actuel y tremble). */
const LIVE_CONTROL_HZ = [60.05, 59.94];
const MODES: RenderMode[] = ['physique', 'actuel', 'interpolé'];

/** Par course et par écran : épisodes bruts par mode, interpolés hors ±1 s d'une réapparition, masqués, dus à la cadence. */
interface Row extends Record<RenderMode, number> {
  interpoléHorsRespawn: number; masqués: number; cadence: number; actuelCadence: number;
}

const rows: Row[][] = SCREENS.map(() => []);

test.each(SEEDS)('graine %i : 0 épisode interpolé dû à la cadence, sur chaque écran', (seed) => {
  const traj = recordTrajectory(seed, SECONDS, true, AP);
  const track = trackFor(seed, AP);
  const dtMs = CONFIG.PHYSICS_DT * 1000;
  const respawnMs = traj.teleported.flatMap((set, k) => (set.size > 0 ? [k * dtMs] : []));
  SCREENS.forEach((screen, si) => {
    const model = { ...screen, seed };
    const replays = Object.fromEntries(MODES.map((m) => [m, replayScreenX(traj, track, model, m)])) as Record<RenderMode, ReturnType<typeof replayScreenX>>;
    const interp = classifyEpisodes(replays['interpolé'], replays.physique);
    const row: Row = {
      physique: shakeEpisodes(replays.physique),
      actuel: shakeEpisodes(replays.actuel),
      'interpolé': interp.total,
      // À-coups exclus à ±1 s (TELEPORT_GUARD_MS) d'une réapparition de n'importe quelle voiture.
      interpoléHorsRespawn: shakeEpisodes(replays['interpolé'], respawnMs),
      masqués: interp.masked,
      cadence: interp.cadence,
      actuelCadence: classifyEpisodes(replays.actuel, replays.physique).cadence,
    };
    rows[si].push(row);
    expect(row.cadence, `${screen.hz} Hz`).toBe(0);
  });
});

const sum = (si: number, k: keyof Row) => rows[si].reduce((a, r) => a + r[k], 0);

/** Mesuré au tour 1 : 1 / 0 / 0 / 0 épisodes masqués selon l'écran (choc réel, graine 0 à 60,000 Hz). */
const MAX_MASKED = 1;

test.each(SCREENS.map((s, si) => [`${s.hz} Hz, gigue ${s.jitterMs} ms`, si] as const))('%s : au plus MAX_MASKED épisode masqué', (_, si) => {
  expect(rows[si]).toHaveLength(SEEDS.length);
  expect(sum(si, 'masqués')).toBeLessThanOrEqual(MAX_MASKED);
});

test.each(LIVE_CONTROL_HZ)('contrôle vivant : à %f Hz, le rendu actuel a au moins un épisode dû à la cadence', (hz) => {
  const si = SCREENS.findIndex((s) => s.hz === hz);
  expect(rows[si]).toHaveLength(SEEDS.length);
  expect(sum(si, 'actuelCadence')).toBeGreaterThanOrEqual(1);
});

afterAll(() => {
  const lines = SCREENS.map((s, si) =>
    `| ${s.hz} Hz, gigue ${s.jitterMs} ms | ${rows[si].length} | ${sum(si, 'physique')} | ${sum(si, 'actuel')} (cadence ${sum(si, 'actuelCadence')}) | ${sum(si, 'interpolé')} | ${sum(si, 'interpoléHorsRespawn')} | ${sum(si, 'masqués')} | ${sum(si, 'cadence')} |`);
  console.log(['Épisodes de tremblement (5 voitures, doigt posé, 150 s) :',
    '| Écran | Courses | Physique | Actuel | Interpolé | Interpolé hors ±1 s respawn | Masqués | Dus à la cadence |',
    '|---|---|---|---|---|---|---|---|', ...lines].join('\n'));
});
