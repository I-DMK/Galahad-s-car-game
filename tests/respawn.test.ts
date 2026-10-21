import { CONFIG } from '../src/config';
import {
  applyRespawnToState,
  chooseRespawnTarget,
  normalizeAngle,
  updateRespawnTimers,
  type RespawnObs,
} from '../src/cars/respawn';
import { newCarState } from '../src/cars/state';
import { generateTrack } from '../src/track/generate';
import { heightAt, slopeAt } from '../src/track/query';
import type { Track } from '../src/track/types';

const DEG = Math.PI / 180;

function newState() {
  return newCarState('a', 'A', '#fff', '#000', { x: 0, y: 0, angle: 0 });
}
const base: RespawnObs = {
  t: 0, angle: 0, throttle: false, progress: 0, y: 5, groundY: 5, speedMps: 10, onLava: false, inElanZone: false,
};
const obs = (o: Partial<RespawnObs>): RespawnObs => ({ ...base, ...o });

describe('normalizeAngle (réexporté)', () => {
  test('ramène dans (−π, π]', () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(normalizeAngle(-190 * DEG)).toBeCloseTo(170 * DEG, 12);
  });
});

describe('updateRespawnTimers', () => {
  test('rien à signaler : null', () => {
    expect(updateRespawnTimers(newState(), base, CONFIG)).toBeNull();
  });

  test('flipped : 0,9 s → null, 1,05 s → flipped', () => {
    const s = newState();
    expect(updateRespawnTimers(s, obs({ t: 10, angle: 150 * DEG }), CONFIG)).toBeNull();
    expect(s.flippedSince).toBe(10);
    expect(updateRespawnTimers(s, obs({ t: 10.9, angle: 150 * DEG }), CONFIG)).toBeNull();
    expect(updateRespawnTimers(s, obs({ t: 11.05, angle: 150 * DEG }), CONFIG)).toBe('flipped');
  });

  test('flipped : l’angle est normalisé (−200° compte comme 160°)', () => {
    const s = newState();
    updateRespawnTimers(s, obs({ t: 0, angle: -200 * DEG }), CONFIG);
    expect(updateRespawnTimers(s, obs({ t: 1.05, angle: -200 * DEG }), CONFIG)).toBe('flipped');
  });

  test('flipped : timer remis à null quand la condition cesse', () => {
    const s = newState();
    updateRespawnTimers(s, obs({ t: 0, angle: 150 * DEG }), CONFIG);
    expect(s.flippedSince).toBe(0);
    expect(updateRespawnTimers(s, obs({ t: 0.5, angle: 0 }), CONFIG)).toBeNull();
    expect(s.flippedSince).toBeNull();
    expect(s.sideSince).toBeNull();
    // le chrono repart de zéro
    expect(updateRespawnTimers(s, obs({ t: 0.6, angle: 150 * DEG }), CONFIG)).toBeNull();
    expect(updateRespawnTimers(s, obs({ t: 1.5, angle: 150 * DEG }), CONFIG)).toBeNull();
  });

  test('side : 80° pendant 2,05 s → side (1,9 s → null)', () => {
    const s = newState();
    expect(updateRespawnTimers(s, obs({ t: 0, angle: 80 * DEG }), CONFIG)).toBeNull();
    expect(s.sideSince).toBe(0);
    expect(s.flippedSince).toBeNull();
    expect(updateRespawnTimers(s, obs({ t: 1.9, angle: 80 * DEG }), CONFIG)).toBeNull();
    expect(updateRespawnTimers(s, obs({ t: 2.05, angle: 80 * DEG }), CONFIG)).toBe('side');
  });

  test('flipped implique side : les deux timers tournent, flipped gagne', () => {
    const s = newState();
    updateRespawnTimers(s, obs({ t: 0, angle: 150 * DEG }), CONFIG);
    expect(s.flippedSince).toBe(0);
    expect(s.sideSince).toBe(0);
    expect(updateRespawnTimers(s, obs({ t: 1.05, angle: 150 * DEG }), CONFIG)).toBe('flipped');
  });

  test('stuck : throttle sans progresser pendant 2,05 s → stuck', () => {
    const s = newState();
    expect(updateRespawnTimers(s, obs({ t: 0, throttle: true, progress: 0 }), CONFIG)).toBeNull();
    expect(s.stuckSince).toBe(0);
    expect(updateRespawnTimers(s, obs({ t: 1.9, throttle: true, progress: 0.5 }), CONFIG)).toBeNull();
    expect(updateRespawnTimers(s, obs({ t: 2.05, throttle: true, progress: 0.5 }), CONFIG)).toBe('stuck');
  });

  test('stuck : sans throttle, jamais', () => {
    const s = newState();
    for (let t = 0; t <= 5; t += 0.5) {
      expect(updateRespawnTimers(s, obs({ t, throttle: false, progress: 0 }), CONFIG)).toBeNull();
    }
    expect(s.stuckSince).toBeNull();
  });

  test('stuck : la référence avance quand la voiture progresse, le chrono repart', () => {
    const s = newState();
    updateRespawnTimers(s, obs({ t: 0, throttle: true, progress: 0 }), CONFIG);
    expect(updateRespawnTimers(s, obs({ t: 1.5, throttle: true, progress: 1.2 }), CONFIG)).toBeNull();
    expect(s.stuckRefProgress).toBe(1.2);
    expect(s.stuckSince).toBeNull();
    // 1,5 s sans progrès depuis la nouvelle référence → pas encore stuck
    expect(updateRespawnTimers(s, obs({ t: 1.6, throttle: true, progress: 1.3 }), CONFIG)).toBeNull();
    expect(updateRespawnTimers(s, obs({ t: 3.5, throttle: true, progress: 1.4 }), CONFIG)).toBeNull();
    expect(updateRespawnTimers(s, obs({ t: 3.7, throttle: true, progress: 1.4 }), CONFIG)).toBe('stuck');
  });

  test('stuck : relâcher le throttle remet chrono et référence à zéro', () => {
    const s = newState();
    updateRespawnTimers(s, obs({ t: 0, throttle: true, progress: 0 }), CONFIG);
    updateRespawnTimers(s, obs({ t: 1, throttle: false, progress: 0.3 }), CONFIG);
    expect(s.stuckSince).toBeNull();
    expect(s.stuckRefProgress).toBe(0.3);
  });

  test('lava : immédiat', () => {
    expect(updateRespawnTimers(newState(), obs({ onLava: true }), CONFIG)).toBe('lava');
  });

  test('underground : y < groundY − 1', () => {
    expect(updateRespawnTimers(newState(), obs({ y: 3.9, groundY: 5 }), CONFIG)).toBe('underground');
    expect(updateRespawnTimers(newState(), obs({ y: 4.1, groundY: 5 }), CONFIG)).toBeNull();
  });

  test('speed : > SPEED_GUARD', () => {
    expect(updateRespawnTimers(newState(), obs({ speedMps: CONFIG.SPEED_GUARD + 1 }), CONFIG)).toBe('speed');
    expect(updateRespawnTimers(newState(), obs({ speedMps: CONFIG.SPEED_GUARD - 1 }), CONFIG)).toBeNull();
  });

  test('priorité : lava > speed > underground > flipped', () => {
    const s = newState();
    updateRespawnTimers(s, obs({ t: 0, angle: 150 * DEG }), CONFIG);
    const all = obs({ t: 5, angle: 150 * DEG, onLava: true, speedMps: 100, y: 0, groundY: 5 });
    expect(updateRespawnTimers(s, all, CONFIG)).toBe('lava');
    expect(updateRespawnTimers(s, { ...all, onLava: false }, CONFIG)).toBe('speed');
    expect(updateRespawnTimers(s, { ...all, onLava: false, speedMps: 10 }, CONFIG)).toBe('underground');
    expect(updateRespawnTimers(s, { ...all, onLava: false, speedMps: 10, y: 5 }, CONFIG)).toBe('flipped');
  });

  describe('retournée ou sur le flanc dans l’élan ou sur la rampe (inElanZone) : immédiat (addendum §1.6)', () => {
    test('|angle| > FLIP_ANGLE au premier pas → flipped, sans délai', () => {
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: 150 * DEG, inElanZone: true }), CONFIG)).toBe('flipped');
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: -150 * DEG, inElanZone: true }), CONFIG)).toBe('flipped');
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: 180 * DEG, inElanZone: true }), CONFIG)).toBe('flipped');
      // L'angle est normalisé (−200° compte comme 160°).
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: -200 * DEG, inElanZone: true }), CONFIG)).toBe('flipped');
    });

    test('SIDE_ANGLE < |angle| ≤ FLIP_ANGLE au premier pas → side, sans délai (la raison reste vraie)', () => {
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: 80 * DEG, inElanZone: true }), CONFIG)).toBe('side');
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: -80 * DEG, inElanZone: true }), CONFIG)).toBe('side');
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: CONFIG.FLIP_ANGLE, inElanZone: true }), CONFIG)).toBe('side');
    });

    test('|angle| ≤ SIDE_ANGLE dans l’élan → rien', () => {
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: 60 * DEG, inElanZone: true }), CONFIG)).toBeNull();
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: CONFIG.SIDE_ANGLE, inElanZone: true }), CONFIG)).toBeNull();
      expect(updateRespawnTimers(newState(), obs({ t: 10, angle: 0, inElanZone: true }), CONFIG)).toBeNull();
    });

    test('hors de l’élan (inElanZone false) : délais FLIP_SECONDS / SIDE_SECONDS inchangés', () => {
      const s = newState();
      expect(updateRespawnTimers(s, obs({ t: 10, angle: 150 * DEG, inElanZone: false }), CONFIG)).toBeNull();
      expect(updateRespawnTimers(s, obs({ t: 10.9, angle: 150 * DEG, inElanZone: false }), CONFIG)).toBeNull();
      expect(updateRespawnTimers(s, obs({ t: 11.05, angle: 150 * DEG, inElanZone: false }), CONFIG)).toBe('flipped');
      const s2 = newState();
      expect(updateRespawnTimers(s2, obs({ t: 0, angle: 80 * DEG, inElanZone: false }), CONFIG)).toBeNull();
      expect(updateRespawnTimers(s2, obs({ t: 1.9, angle: 80 * DEG, inElanZone: false }), CONFIG)).toBeNull();
      expect(updateRespawnTimers(s2, obs({ t: 2.05, angle: 80 * DEG, inElanZone: false }), CONFIG)).toBe('side');
    });

    test('priorité : lava > speed > underground > flipped immédiat', () => {
      const all = obs({ t: 5, angle: 180 * DEG, inElanZone: true, onLava: true, speedMps: 100, y: 0, groundY: 5 });
      expect(updateRespawnTimers(newState(), all, CONFIG)).toBe('lava');
      expect(updateRespawnTimers(newState(), { ...all, onLava: false }, CONFIG)).toBe('speed');
      expect(updateRespawnTimers(newState(), { ...all, onLava: false, speedMps: 10 }, CONFIG)).toBe('underground');
      expect(updateRespawnTimers(newState(), { ...all, onLava: false, speedMps: 10, y: 5 }, CONFIG)).toBe('flipped');
      expect(updateRespawnTimers(newState(), { ...all, onLava: false, speedMps: 10, y: 5, angle: 80 * DEG }, CONFIG)).toBe('side');
    });
  });
});

describe('chooseRespawnTarget / applyRespawnToState', () => {
  function twoVolcanoTrack(): Track {
    for (let seed = 0; seed < 200; seed++) {
      const t = generateTrack(seed, 3000, CONFIG);
      if (t.volcanoes.length >= 2) return t;
    }
    throw new Error('aucune piste avec deux volcans');
  }
  const track = twoVolcanoTrack();
  const [V1, V2] = track.volcanoes;

  test('1er respawn : point sûr, consecutive 1, lavaX du volcan', () => {
    const s = newState();
    s.safePoint = { x: V1.xElanStart - 5, y: heightAt(track, V1.xElanStart - 5), angle: 0 };
    const r = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r.point).toEqual(s.safePoint);
    expect(r.consecutive).toBe(1);
    expect(r.lavaX).toBe(V1.xLava);
  });

  test('sans volcan devant : lavaX null, consecutive 1, point sûr', () => {
    const s = newState();
    const last = track.volcanoes[track.volcanoes.length - 1];
    s.safePoint = { x: last.xEnd + 1, y: 0, angle: 0 };
    const r = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r.lavaX).toBeNull();
    expect(r.consecutive).toBe(1);
    expect(r.point).toEqual(s.safePoint);
  });

  test('2e respawn devant le même volcan (autre point sûr) → xEnd − RESPAWN_AFTER_VOLCANO_BACK, puis volcan différent → 1', () => {
    expect(CONFIG.RESPAWN_AFTER_VOLCANO_BACK).toBe(10);
    const s = newState();
    const S1 = { x: V1.xElanStart - 5, y: heightAt(track, V1.xElanStart - 5), angle: 0 };
    s.safePoint = S1;
    const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r1.consecutive).toBe(1);
    expect(r1.lavaX).toBe(V1.xLava);
    applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
    expect(s.lastRespawnLavaX).toBe(V1.xLava);
    expect(s.consecutiveRespawns).toBe(1);

    // nouveau point sûr, différent, toujours avant V1
    const S2 = { x: V1.xElanStart - 2, y: heightAt(track, V1.xElanStart - 2), angle: 0 };
    s.safePoint = S2;
    const r2 = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r2.consecutive).toBe(0);
    expect(r2.lavaX).toBeNull();
    const xBack = V1.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK;
    expect(r2.point.x).toBeCloseTo(xBack, 9);
    expect(r2.point.y).toBeCloseTo(heightAt(track, xBack), 9);
    // Hauteur et angle du sol local : le plat de réception est horizontal.
    expect(r2.point.angle).toBeCloseTo(slopeAt(track, xBack), 12);
    expect(r2.point.angle).toBeCloseTo(0, 9);
    expect(r2.point.x).toBeGreaterThanOrEqual(V1.xReception + 10);
    applyRespawnToState(s, r2.point, r2.lavaX, r2.consecutive, 20, CONFIG);
    expect(s.lastRespawnLavaX).toBeNull();
    expect(s.consecutiveRespawns).toBe(0);

    // 3e : point sûr avant un AUTRE volcan → consecutive 1
    const S3 = { x: V2.xElanStart - 5, y: heightAt(track, V2.xElanStart - 5), angle: 0 };
    s.safePoint = S3;
    const r3 = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r3.consecutive).toBe(1);
    expect(r3.lavaX).toBe(V2.xLava);
    expect(r3.point).toEqual(S3);
  });

  test('graines 0 à 19 : la cible de 2e chute xEnd − 10 est ≥ xReception + 10 sur chaque volcan', () => {
    let volcanoes = 0;
    for (let seed = 0; seed < 20; seed++) {
      const t = generateTrack(seed, 1680, CONFIG);
      for (const w of t.volcanoes) {
        volcanoes++;
        const s = newState();
        s.lastRespawnLavaX = w.xLava;
        s.consecutiveRespawns = 1;
        s.safePoint = { x: w.xLancement + 1, y: heightAt(t, w.xLancement + 1), angle: 0 };
        const r = chooseRespawnTarget(s, t, CONFIG, 'lava');
        const where = `seed ${seed}, volcan en x = ${w.xLancement.toFixed(1)}`;
        expect(r.consecutive, where).toBe(0);
        expect(r.lavaX, where).toBeNull();
        expect(r.point.x, where).toBeCloseTo(w.xEnd - 10, 9);
        expect(r.point.x, where).toBeGreaterThanOrEqual(w.xReception + 10);
        expect(r.point.y, where).toBeCloseTo(heightAt(t, r.point.x), 9);
        expect(Math.abs(r.point.angle), where).toBeLessThan(1e-9);
      }
    }
    expect(volcanoes).toBeGreaterThan(50);
  });

  test.each(['side', 'flipped', 'stuck', 'underground', 'speed'] as const)(
    'lave puis %s au même volcan → point sûr normal, série remise à zéro',
    (reason) => {
      const s = newState();
      const S1 = { x: V1.xLancement + 1, y: heightAt(track, V1.xLancement + 1), angle: 0 };
      s.safePoint = S1;
      const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava');
      applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
      expect(s.lastRespawnLavaX).toBe(V1.xLava);
      expect(s.consecutiveRespawns).toBe(1);

      const r2 = chooseRespawnTarget(s, track, CONFIG, reason);
      expect(r2.point).toEqual(S1);
      expect(r2.lavaX).toBeNull();
      expect(r2.consecutive).toBe(0);
      applyRespawnToState(s, r2.point, r2.lavaX, r2.consecutive, 20, CONFIG);
      expect(s.lastRespawnLavaX).toBeNull();
      expect(s.consecutiveRespawns).toBe(0);
    },
  );

  test('lave, side, lave au même volcan → point sûr normal (consecutive 1), pas xEnd − 10', () => {
    const s = newState();
    const S1 = { x: V1.xLancement + 1, y: heightAt(track, V1.xLancement + 1), angle: 0 };
    s.safePoint = S1;
    const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava');
    applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
    const r2 = chooseRespawnTarget(s, track, CONFIG, 'side');
    applyRespawnToState(s, r2.point, r2.lavaX, r2.consecutive, 20, CONFIG);
    const r3 = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r3.point).toEqual(S1);
    expect(r3.lavaX).toBe(V1.xLava);
    expect(r3.consecutive).toBe(1);
    // La série repart : une 4e chute dans la même lave passe le volcan.
    applyRespawnToState(s, r3.point, r3.lavaX, r3.consecutive, 30, CONFIG);
    const r4 = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r4.consecutive).toBe(0);
    expect(r4.point.x).toBeCloseTo(V1.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK, 9);
  });

  test('volcan différent de celui du dernier respawn → consecutive 1', () => {
    const s = newState();
    s.lastRespawnLavaX = V1.xLava;
    s.consecutiveRespawns = 1;
    s.safePoint = { x: V2.xElanStart - 5, y: 0, angle: 0 };
    const r = chooseRespawnTarget(s, track, CONFIG, 'lava');
    expect(r.consecutive).toBe(1);
    expect(r.lavaX).toBe(V2.xLava);
  });

  test('applyRespawnToState remet l’état à neuf', () => {
    const s = newState();
    s.flippedSince = 1; s.sideSince = 2; s.stuckSince = 3;
    s.invulnerableUntil = 0;
    const target = { x: 42, y: 7, angle: 0.1 };
    applyRespawnToState(s, target, 99, 1, 12, CONFIG);
    expect(s.lastRespawnLavaX).toBe(99);
    expect(s.consecutiveRespawns).toBe(1);
    expect(s.invulnerableUntil).toBeCloseTo(12 + CONFIG.RESPAWN_INVULN, 12);
    expect(s.flippedSince).toBeNull();
    expect(s.sideSince).toBeNull();
    expect(s.stuckSince).toBeNull();
    expect(s.stuckRefProgress).toBe(42);
    expect(s.progress).toBe(42);
    expect(s.safePoint).toEqual(target);
    expect(s.lastSafePointAt).toBe(12);
  });
});
