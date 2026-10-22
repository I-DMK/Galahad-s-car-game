import { CONFIG } from '../src/config';
import { forbiddenZone, isSafePointCandidate } from '../src/cars/safepoint';
import { newCarState } from '../src/cars/state';
import { generateTrack } from '../src/track/generate';
import { fosses, sliceAt, tremplins } from '../src/track/query';
import type { Track } from '../src/track/types';

const DEG = Math.PI / 180;

/** Piste avec un tremplin et une fosse (tâche 5g). */
function makeTrack(): Track {
  for (let seed = 0; seed < 10; seed++) {
    const t = generateTrack(seed, 1680, CONFIG);
    if (tremplins(t).length >= 1 && fosses(t).length >= 1) return t;
  }
  throw new Error('aucune piste avec tremplin et fosse');
}
const track = makeTrack();
const v = tremplins(track)[0];
const f = fosses(track)[0];
const [zoneStart, zoneEnd] = forbiddenZone(v, CONFIG);

function state() {
  const s = newCarState('a', 'A', '#fff', '#000', { x: 0, y: 0, angle: 0 });
  s.lastSafePointAt = 0;
  return s;
}
// Un instant et une position acceptables par défaut, hors de toute zone interdite.
const okX = track.xStart + 1;
const ok = { x: okX, t: 1, bothWheelsOnGround: true, carAngle: 0, groundSlope: 0 };

describe('forbiddenZone', () => {
  test('= [xLancement + SAFE_LANCEMENT_MARGIN, xReception) (addendum §1.6)', () => {
    expect(CONFIG.SAFE_LANCEMENT_MARGIN).toBe(5);
    expect(zoneStart).toBeCloseTo(v.xLancement + 5, 9);
    expect(zoneEnd).toBe(v.xReception);
    // Le plat d'élan (6 m) et la rampe sont entièrement interdits : jamais de point sûr dessus.
    expect(zoneStart).toBeLessThan(v.xElanStart);
    // D_LANCE de plat garanti après le pire point sûr (V_MAX avant l'élan).
    expect(v.xElanStart - zoneStart).toBeCloseTo(CONFIG.D_LANCE, 9);
  });

  test('fosse : [xLancement + 5, bord aval + WHEEL_BASE/2 + WHEEL_RADIUS + 0,3) (tour 1 de la 5g) ; la garde accepte les points sûrs ; D_LANCE de plat (et la maille) avant le bord', () => {
    const [a, b] = forbiddenZone(f, CONFIG);
    const exit = CONFIG.WHEEL_BASE / 2 + CONFIG.WHEEL_RADIUS + 0.3;
    expect(exit).toBeCloseTo(1.5, 9);
    expect(a).toBeCloseTo(f.xLancement + 5, 9);
    expect(b).toBeCloseTo(f.xReception + exit, 9);
    expect(f.xBord - a).toBeGreaterThanOrEqual(CONFIG.D_LANCE - 1e-9);
    expect(f.xBord - a).toBeLessThan(CONFIG.D_LANCE + CONFIG.TRACK_POINT_SPACING);
    const guard = f.xLancement - CONFIG.FOSSE_GUARD;
    expect(isSafePointCandidate({ ...ok, x: guard + 1 }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: f.xLancement - 0.01 }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: f.xLancement + 4.99 }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: f.xLancement + 5 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: f.xBord - 1 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: f.xLava }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: f.xReception - 0.01 }, state(), track, CONFIG)).toBe(false);
    // Le bord aval est le bord de la lave : un châssis posé là aurait la roue arrière dans le capteur.
    expect(isSafePointCandidate({ ...ok, x: f.xReception }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: b - 0.01 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: b }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: f.xReception + CONFIG.FOSSE_RESPAWN_AFTER }, state(), track, CONFIG)).toBe(true);
  });

  test('graines 0 à 19 : même règle pour chaque volcan', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const w of generateTrack(seed, 1680, CONFIG).volcanoes) {
        const [a, b] = forbiddenZone(w, CONFIG);
        expect(a).toBeCloseTo(w.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN, 9);
        if (w.kind === 'tremplin') expect(b).toBe(w.xReception);
        else expect(b).toBeCloseTo(w.xReception + CONFIG.WHEEL_BASE / 2 + CONFIG.WHEEL_RADIUS + 0.3, 9);
      }
    }
  });
});

describe('isSafePointCandidate', () => {
  test('sanity : le cas de base est accepté', () => {
    expect(track.volcanoes.some((w) => okX >= forbiddenZone(w, CONFIG)[0] && okX < forbiddenZone(w, CONFIG)[1])).toBe(false);
    expect(isSafePointCandidate(ok, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : moins de 0,5 s depuis le dernier point sûr', () => {
    const s = state();
    s.lastSafePointAt = 0.8;
    expect(isSafePointCandidate({ ...ok, t: 1.2 }, s, track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, t: 1.3 }, s, track, CONFIG)).toBe(true);
  });

  test('refusé : une roue en l’air', () => {
    expect(isSafePointCandidate({ ...ok, bothWheelsOnGround: false }, state(), track, CONFIG)).toBe(false);
  });

  test('refusé : voiture inclinée de 20° ou plus', () => {
    expect(isSafePointCandidate({ ...ok, carAngle: 25 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, carAngle: -25 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, carAngle: 15 * DEG }, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : pente de 15°', () => {
    expect(isSafePointCandidate({ ...ok, groundSlope: 15 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, groundSlope: -15 * DEG }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, groundSlope: 5 * DEG }, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : dans la zone interdite [xLancement + 5, xReception), demi-ouverte', () => {
    const mid = (zoneStart + zoneEnd) / 2;
    expect(isSafePointCandidate({ ...ok, x: mid }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: v.xLancement + 5 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: v.xLava - 1 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: v.xReception - 0.01 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: v.xReception }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: v.xLancement + 5 - 0.01 }, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : sur le plat d’élan et la rampe', () => {
    expect(isSafePointCandidate({ ...ok, x: v.xElanStart }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: v.xElanStart + 3 }, state(), track, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: v.xRampStart + 1 }, state(), track, CONFIG)).toBe(false);
  });

  test('accepté : plat de réception et 5 premiers mètres du plat de lancement', () => {
    expect(isSafePointCandidate({ ...ok, x: v.xReception + 3 }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: v.xEnd - 10 }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: v.xLancement }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: v.xLancement + 2.5 }, state(), track, CONFIG)).toBe(true);
    expect(isSafePointCandidate({ ...ok, x: v.xLancement - 1 }, state(), track, CONFIG)).toBe(true);
  });

  test('refusé : dans une tranche « cratère » (fixture : un plat retypé, en copie)', () => {
    // Un plat intérieur (ni premier ni dernier : sliceAt clampe aux extrémités) hors zone interdite,
    // dont le milieu est accepté sur la piste d'origine.
    const plat = track.slices.find((s, i) => {
      if (s.type !== 'plat' || i === 0 || i === track.slices.length - 1) return false;
      const x = (s.xStart + s.xEnd) / 2;
      return isSafePointCandidate({ ...ok, x }, state(), track, CONFIG);
    });
    expect(plat).toBeDefined();
    const xMid = (plat!.xStart + plat!.xEnd) / 2;
    const cratered: Track = {
      ...track,
      slices: track.slices.map((s) => (s === plat ? { ...s, type: 'cratère' as const } : s)),
    };
    expect(sliceAt(cratered, xMid).type).toBe('cratère');
    expect(sliceAt(track, xMid).type).toBe('plat'); // la piste d'origine n'est pas mutée
    expect(isSafePointCandidate({ ...ok, x: xMid }, state(), cratered, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: plat!.xStart }, state(), cratered, CONFIG)).toBe(false);
    expect(isSafePointCandidate({ ...ok, x: plat!.xEnd - 0.01 }, state(), cratered, CONFIG)).toBe(false);
    // Les voisins (hors cratère) restent acceptés quand ils l'étaient déjà.
    const before = isSafePointCandidate({ ...ok, x: plat!.xStart - 0.01 }, state(), track, CONFIG);
    expect(isSafePointCandidate({ ...ok, x: plat!.xStart - 0.01 }, state(), cratered, CONFIG)).toBe(before);
    expect(isSafePointCandidate({ ...ok, x: xMid }, state(), track, CONFIG)).toBe(true);
  });
});
