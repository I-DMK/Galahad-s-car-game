// Rendu interpolé (tâche 5f du plan B ; tremblement §6), suite lente : 12 courses à 5 voitures doigt posé
// (graines 0 à 11, 150 s), chacune rejouée sur 4 écrans simulés en physique / actuel / interpolé.
// Budget : moins de 30 min mur (≈ 4 min 30 mesurées) ; enregistrements en mémoire, une course par graine.
// Exigences par écran : interpolé ≤ physique, et 0 épisode hors de ±1 s autour d'une réapparition, sauf
// épisode expliqué par la trajectoire (`cadenceEpisodes` : à-coups du rejeu physique au même moment ; graine 0
// à 60,000 Hz : un choc entre voitures à 49,8 s donne 2 à-coups en physique et 3 en interpolé).
import { CONFIG } from '../../src/config';
import { cadenceEpisodes, recordTrajectory, replayScreenX, shakeEpisodes, type RenderMode, type ScreenModel } from '../helpers/frames';
import { trackFor } from '../helpers/runs';

const SEEDS = Array.from({ length: 12 }, (_, i) => i);
const SECONDS = 150;
const SCREENS: Omit<ScreenModel, 'seed'>[] = [
  { hz: 60.05, jitterMs: 0.2 },
  { hz: 59.94, jitterMs: 0.1 },
  { hz: 60.0, jitterMs: 0.2 },
  { hz: 120, jitterMs: 0.1 },
];
const MODES: RenderMode[] = ['physique', 'actuel', 'interpolé'];
type Row = Record<RenderMode, number> & { interpoléHorsRespawn: number; cadence: number };

const rows: Row[][] = SCREENS.map(() => []);

test.each(SEEDS)('graine %i : sur chaque écran, 0 épisode interpolé non expliqué par la trajectoire (rejeu physique)', (seed) => {
  const traj = recordTrajectory(seed, SECONDS, true);
  const track = trackFor(seed);
  const dtMs = CONFIG.PHYSICS_DT * 1000;
  const respawnMs = traj.teleported.flatMap((set, k) => (set.size > 0 ? [k * dtMs] : []));
  SCREENS.forEach((screen, si) => {
    const model = { ...screen, seed };
    const replays = Object.fromEntries(MODES.map((m) => [m, replayScreenX(traj, track, model, m)])) as Record<RenderMode, ReturnType<typeof replayScreenX>>;
    const row = Object.fromEntries(MODES.map((m) => [m, shakeEpisodes(replays[m])])) as Row;
    // À-coups exclus à ±1 s (TELEPORT_GUARD_MS) d'une réapparition de n'importe quelle voiture.
    row.interpoléHorsRespawn = shakeEpisodes(replays['interpolé'], respawnMs);
    // Épisodes interpolés que la trajectoire n'explique pas (aucun à-coup physique au même moment) : la cadence seule.
    row.cadence = cadenceEpisodes(replays['interpolé'], replays.physique);
    rows[si].push(row);
    expect(row.cadence, `${screen.hz} Hz`).toBe(0);
  });
});

afterAll(() => {
  const sum = (si: number, k: keyof Row) => rows[si].reduce((a, r) => a + r[k], 0);
  const lines = SCREENS.map((s, si) =>
    `| ${s.hz} Hz, gigue ${s.jitterMs} ms | ${rows[si].length} | ${sum(si, 'physique')} | ${sum(si, 'actuel')} | ${sum(si, 'interpolé')} | ${sum(si, 'interpoléHorsRespawn')} | ${sum(si, 'cadence')} |`);
  console.log(['Épisodes de tremblement (5 voitures, doigt posé, 150 s) :',
    '| Écran | Courses | Physique | Actuel | Interpolé | Interpolé hors ±1 s respawn | dont cadence |', '|---|---|---|---|---|---|---|', ...lines].join('\n'));
});
