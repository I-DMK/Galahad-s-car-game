// Réapparitions dans le pas de course (tâche 10b du plan A) : courses complètes doigt posé, graines
// 0 à 4 (suite lente). Les scénarios ciblés (flanc amont, vallée, deux chutes, retournée dans l'élan,
// invulnérabilité) vivent dans tests/respawn-e2e.test.ts ; le motif « doigt levé » est le cas 7 de
// tests/slow/volcans-slow.test.ts.
import { CONFIG } from '../../src/config';
import { simulateRace, type SimEvent } from '../../src/sim/simulate';
import { trackFor } from '../helpers/runs';

const SEEDS = [0, 1, 2, 3, 4];

const describeRespawns = (rs: SimEvent[]) =>
  rs.map((e) => (e.type === 'respawn' ? `${e.reason}@t=${e.t.toFixed(2)} x=${e.x.toFixed(1)}→${e.target.x.toFixed(1)}` : e.type));

describe('doigt toujours posé', () => {
  test.each(SEEDS)('seed %i : aucune réapparition, jamais bloqué, ligne d’arrivée atteinte', (seed) => {
    const track = trackFor(seed);
    const r = simulateRace(track, { throttle: () => true, maxSeconds: 240, cfg: CONFIG });
    expect(describeRespawns(r.respawns)).toEqual([]);
    expect(r.respawns.length).toBe(0);
    expect(r.maxStuckSeconds).toBeLessThanOrEqual(2.1);
    expect(r.progressAt(240)).toBeGreaterThanOrEqual(track.xFinish);
  });
});
