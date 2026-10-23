// Courses doigt posé SANS saut (plan B, tâche 5g, Step 6 ; addendum « bouton saut » §4 et §6.1, décision P9) : Galahad
// seul, puis à 5 voitures (copains à leur driver, tâche 6), graines données. Exactement 2 chutes par fosse
// (la 2e pose la voiture juste après, option B), au plus 2 par série, 0 au tremplin, arrivée avant 240 s ; copains :
// chutes aux fosses seulement (sauts ratés, décision Q-F3), au plus 2 par série. Temps perdu par fosse imprimé, contre
// la même course de Galahad seul avec le saut parfait (≈ 4,3 à 4,6 s
// attendus). Étoiles basses des réceptions (demande du papa) : chaque étoile basse d'une réception est prise par
// Galahad seul doigt posé avec le saut parfait, et les atterrissages restent avant leur début, marge comprise.
import { CONFIG } from '../../src/config';
import { fosses } from '../../src/track/query';
import {
  CONTACT_WINDOW, MAX_STUCK_SECONDS, RACE_MAX_SECONDS, describeFall, fiveCarRace, isSansTentative, lavaSeries,
  respawnsHorsFosses, type FiveCarRace,
} from './race';
import { describeRow, expectReceptionStars, receptionRun, type ReceptionRow } from './reception';
import { trackFor } from './runs';

/** Limite du spec, hors fosses (saut §6.8) : au plus 3 réapparitions par voiture et par course. */
const MAX_OTHER_RESPAWNS = 3;
const f1 = (n: number | null): string => (n === null || !Number.isFinite(n) ? '—' : n.toFixed(1));

/** Assertions communes : Galahad tombe exactement 2 fois par fosse, au plus 2 par série, jamais au tremplin, et arrive. */
function expectSansSaut(race: FiveCarRace, nF: number, seed: number): void {
  const { r, falls, summary } = race;
  const track = trackFor(seed);
  expect(r.finishedAt, summary).not.toBeNull();
  expect(r.finishedAt!, summary).toBeLessThan(RACE_MAX_SECONDS);
  const g = falls.filter((f) => f.carId === 'galahad');
  expect(g.map((f) => `${f.kind} ${f.cause}`), summary).toEqual(Array.from({ length: 2 * nF }, () => 'fosse fosse'));
  expect(r.lavaByCar.galahad, summary).toBe(2 * nF);
  expect(lavaSeries(r.respawnsByCar.galahad, track), summary).toEqual(Array.from({ length: nF }, () => 2));
  // Copains (tâche 6) : ils ratent parfois une fosse (attendu), jamais un tremplin ; jamais de saut dans la zone d'un
  // tremplin.
  expect(falls.filter((f) => f.carId !== 'galahad' && f.kind !== 'fosse').map(describeFall), summary).toEqual([]);
  expect(falls.filter(isSansTentative).map(describeFall), summary).toEqual([]);
  expect(race.noJumpZoneJumps, summary).toEqual([]);
  expect(r.ghostContacts, summary).toBe(0);
  for (const [id, rs] of Object.entries(r.respawnsByCar)) {
    expect(respawnsHorsFosses(race, id), `${id} : ${summary}`).toBeLessThanOrEqual(MAX_OTHER_RESPAWNS);
    expect(Math.max(0, ...lavaSeries(rs, track)), `${id} : ${summary}`).toBeLessThanOrEqual(2);
    expect(rs.filter((e) => e.reason === 'speed'), `${id} : ${summary}`).toEqual([]);
    expect(r.maxStuckByCar[id], `${id} : ${summary}`).toBeLessThanOrEqual(MAX_STUCK_SECONDS);
  }
}

export function registerRaceSansSaut(seeds: readonly number[]): void {
  const lost: { seed: number; perFosse: number }[] = [];
  const receptions: ReceptionRow[] = [];
  /** Survols tolérés (volcan pris en turbo, décision du papa au tour 2 de la 5g), imprimés en fin de fichier. */
  const tolerated: ReceptionRow[] = [];
  describe(`doigt posé sans saut, graines ${seeds[0]} à ${seeds[seeds.length - 1]} (contact : ${CONTACT_WINDOW} s avant une chute)`, () => {
    test.each(seeds)('seed %i : Galahad seul puis à 5 voitures, 2 chutes par fosse, 0 au tremplin, arrivée ; temps perdu ; étoiles des réceptions', (seed) => {
      const nF = fosses(trackFor(seed)).length;
      const solo = fiveCarRace(seed, { solo: true, jump: 'jamais' });
      console.log(`sans saut, seul : ${solo.summary}`);
      expectSansSaut(solo, nF, seed);
      const jumper = receptionRun(seed, trackFor(seed), CONFIG);
      receptions.push(...jumper.rows);
      expect(jumper.respawns, `seed ${seed} : saut parfait`).toBe(0);
      expect(jumper.finishedAt, `seed ${seed} : saut parfait`).not.toBeNull();
      const perFosse = nF > 0 ? (solo.r.finishedAt! - jumper.finishedAt!) / nF : NaN;
      lost.push({ seed, perFosse });
      console.log(`seed ${seed} : ${nF} fosses ; arrivée sans saut ${f1(solo.r.finishedAt)} s, avec le saut parfait ${f1(jumper.finishedAt)} s ; `
        + `${f1(perFosse)} s perdues par fosse ratée deux fois\n  ${jumper.rows.map(describeRow).join('\n  ')}`);
      tolerated.push(...expectReceptionStars(jumper.rows));
      const five = fiveCarRace(seed, { jump: 'jamais' });
      console.log(`sans saut, 5 voitures : ${five.summary}`);
      expectSansSaut(five, nF, seed);
    });
    afterAll(() => {
      const ok = lost.filter((l) => Number.isFinite(l.perFosse)).map((l) => l.perFosse).sort((a, b) => a - b);
      const stars = receptions.flatMap((w) => w.stars);
      const tr = receptions.filter((w) => w.kind === 'tremplin');
      const fo = receptions.filter((w) => w.kind === 'fosse');
      const max = (ws: ReceptionRow[], k: 'touch' | 'lastMiss') => f1(Math.max(...ws.map((w) => w[k]).filter(Number.isFinite)));
      console.log(`graines ${seeds.join(', ')} : temps perdu par fosse ratée deux fois (Galahad seul) ${f1(ok[0])} à ${f1(ok[ok.length - 1])} s, `
        + `médiane ${f1(ok[Math.floor(ok.length / 2)])} s ; réceptions : ${tr.length} tremplins (contact jusqu'à ${max(tr, 'touch')} m, survol jusqu'à `
        + `${max(tr, 'lastMiss')} m), ${fo.length} fosses (contact jusqu'à ${max(fo, 'touch')} m, survol jusqu'à ${max(fo, 'lastMiss')} m) ; `
        + `étoiles basses des réceptions : ${stars.filter((s) => s.taken).length} prises sur ${stars.length} ; `
        + `survols tolérés (volcan pris en turbo) : ${tolerated.length}${tolerated.length ? `\n  ${tolerated.map(describeRow).join('\n  ')}` : ''}`);
      // Le test ne passe pas à vide : des étoiles de réception existent et sont prises.
      expect(stars.filter((s) => s.taken).length).toBeGreaterThanOrEqual(10);
    });
  });
}
