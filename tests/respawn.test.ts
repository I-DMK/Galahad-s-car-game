import { CONFIG } from '../src/config';
import {
  applyRespawnToState,
  chooseRespawnTarget,
  normalizeAngle,
  shiftTarget,
  updateRespawnTimers,
  type RespawnObs,
} from '../src/cars/respawn';
import { newCarState } from '../src/cars/state';
import { generateTrack } from '../src/track/generate';
import { fosses, heightAt, slopeAt, tremplins } from '../src/track/query';
import type { Slice, Track, Volcano } from '../src/track/types';

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
  /** Piste de 3 000 m avec deux tremplins et une fosse au moins (tâche 5g). */
  function twoVolcanoTrack(): Track {
    for (let seed = 0; seed < 200; seed++) {
      const t = generateTrack(seed, 3000, CONFIG);
      if (tremplins(t).length >= 2 && fosses(t).length >= 1) return t;
    }
    throw new Error('aucune piste avec deux tremplins et une fosse');
  }
  const track = twoVolcanoTrack();
  const [V1, V2] = tremplins(track);
  const F = fosses(track)[0];

  test('1er respawn : point sûr, consecutive 1, lavaX du volcan, recul vers l’amont', () => {
    const s = newState();
    s.safePoint = { x: V1.xElanStart - 5, y: heightAt(track, V1.xElanStart - 5), angle: 0 };
    const r = chooseRespawnTarget(s, track, CONFIG, 'lava', V1.xLava - 1);
    expect(r.point).toEqual(s.safePoint);
    expect(r.consecutive).toBe(1);
    expect(r.lavaX).toBe(V1.xLava);
    expect(r.direction).toBe(-1);
  });

  test('fosse (tâche 5g, option B, Q-F2) : 1re chute au point sûr, 2e de suite posée à bord aval + 5, respawn groupé vers l’aval ; série remise à 0 (au plus 2 par série)', () => {
    expect(CONFIG.FOSSE_RESPAWN_AFTER).toBe(5);
    const s = newState();
    const S1 = { x: F.xLancement + 1, y: heightAt(track, F.xLancement + 1), angle: 0 };
    s.safePoint = S1;
    const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava', F.xBord - 0.7);
    expect(r1.point).toEqual(S1);
    expect(r1.lavaX).toBe(F.xLava);
    expect(r1.consecutive).toBe(1);
    expect(r1.direction).toBe(-1);
    applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
    const r2 = chooseRespawnTarget(s, track, CONFIG, 'lava', F.xBord - 0.7);
    expect(r2.point.x).toBeCloseTo(F.xReception + 5, 9);
    expect(r2.point.y).toBeCloseTo(heightAt(track, F.xReception + 5), 9);
    expect(r2.point.angle).toBeCloseTo(0, 9);
    expect(r2.lavaX).toBeNull();
    expect(r2.consecutive).toBe(0);
    expect(r2.direction).toBe(1);
    applyRespawnToState(s, r2.point, r2.lavaX, r2.consecutive, 20, CONFIG);
    // Série close : une chute plus loin (autre volcan, ou la même fosse reprise par derrière) recommence à 1.
    const r3 = chooseRespawnTarget(s, track, CONFIG, 'lava', F.xBord - 0.7);
    expect(r3.consecutive).toBe(1);
  });

  test('fosses des graines 0 à 19 : cible de 2e chute à bord aval + 5, sur le plat de réception, dans la zone fantôme', () => {
    let n = 0;
    for (let seed = 0; seed < 20; seed++) {
      const t = generateTrack(seed, 1680, CONFIG);
      for (const f of fosses(t)) {
        n++;
        const s = newState();
        s.lastRespawnLavaX = f.xLava;
        s.consecutiveRespawns = 1;
        s.safePoint = { x: f.xLancement + 1, y: 0, angle: 0 };
        const r = chooseRespawnTarget(s, t, CONFIG, 'lava', f.xBord - 0.7);
        const where = `seed ${seed}, fosse en x = ${f.xBord.toFixed(1)}`;
        expect(r.point.x, where).toBeCloseTo(f.xReception + CONFIG.FOSSE_RESPAWN_AFTER, 9);
        expect(r.point.y, where).toBe(0);
        expect(Math.abs(r.point.angle), where).toBeLessThan(1e-9);
        expect(r.direction, where).toBe(1);
        expect(r.point.x + 4 * 1.5 * CONFIG.CAR_LENGTH, where).toBeLessThan(f.xReception + CONFIG.FOSSE_GHOST_AFTER);
      }
    }
    expect(n).toBeGreaterThan(20);
  });

  test('volcan retenu (`volcano`, seule source du compte des chutes par volcan `CarSim.lavaFalls`, tour 3 de la tâche 6) : celui de la lave touchée, aux 1re et 2e chutes de suite ; null hors lave ou sans volcan', () => {
    const s = newState();
    s.safePoint = { x: F.xLancement + 1, y: 0, angle: 0 };
    const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava', F.xBord - 0.7);
    expect(r1.volcano).toBe(F);
    applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
    // 2e chute de suite (posée après la fosse) : c'est encore cette fosse qui a été touchée.
    const r2 = chooseRespawnTarget(s, track, CONFIG, 'lava', F.xBord - 0.7);
    expect(r2.consecutive).toBe(0);
    expect(r2.volcano).toBe(F);
    // Chute dans le cratère d'un tremplin, châssis au-delà de xLava (zone du volcan) : ce tremplin, pas le suivant.
    expect(chooseRespawnTarget(newState(), track, CONFIG, 'lava', V1.xLava + 1).volcano).toBe(V1);
    expect(chooseRespawnTarget(newState(), track, CONFIG, 'lava', V2.xLava - 1).volcano).toBe(V2);
    for (const reason of ['flipped', 'side', 'stuck', 'underground', 'speed'] as const) {
      expect(chooseRespawnTarget(s, track, CONFIG, reason, F.xBord - 0.7).volcano, reason).toBeNull();
    }
    const last = track.volcanoes[track.volcanoes.length - 1];
    expect(chooseRespawnTarget(newState(), track, CONFIG, 'lava', last.xEnd + 1).volcano).toBeNull();
  });

  test('sans volcan devant : lavaX null, consecutive 1, point sûr', () => {
    const s = newState();
    const last = track.volcanoes[track.volcanoes.length - 1];
    s.safePoint = { x: last.xEnd + 1, y: 0, angle: 0 };
    const r = chooseRespawnTarget(s, track, CONFIG, 'lava', last.xEnd + 1);
    expect(r.lavaX).toBeNull();
    expect(r.consecutive).toBe(1);
    expect(r.point).toEqual(s.safePoint);
  });

  test('2e respawn devant le même volcan (autre point sûr) → xEnd − RESPAWN_AFTER_VOLCANO_BACK, puis volcan différent → 1', () => {
    expect(CONFIG.RESPAWN_AFTER_VOLCANO_BACK).toBe(10);
    const s = newState();
    const S1 = { x: V1.xElanStart - 5, y: heightAt(track, V1.xElanStart - 5), angle: 0 };
    s.safePoint = S1;
    const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava', V1.xLava - 1);
    expect(r1.consecutive).toBe(1);
    expect(r1.lavaX).toBe(V1.xLava);
    applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
    expect(s.lastRespawnLavaX).toBe(V1.xLava);
    expect(s.consecutiveRespawns).toBe(1);

    // nouveau point sûr, différent, toujours avant V1
    const S2 = { x: V1.xElanStart - 2, y: heightAt(track, V1.xElanStart - 2), angle: 0 };
    s.safePoint = S2;
    const r2 = chooseRespawnTarget(s, track, CONFIG, 'lava', V1.xLava - 1);
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
    const r3 = chooseRespawnTarget(s, track, CONFIG, 'lava', V2.xLava - 1);
    expect(r3.consecutive).toBe(1);
    expect(r3.lavaX).toBe(V2.xLava);
    expect(r3.point).toEqual(S3);
  });

  test('graines 0 à 19 : la cible de 2e chute xEnd − 10 est ≥ xReception + 10 sur chaque tremplin', () => {
    let volcanoes = 0;
    for (let seed = 0; seed < 20; seed++) {
      const t = generateTrack(seed, 1680, CONFIG);
      for (const w of tremplins(t)) {
        volcanoes++;
        const s = newState();
        s.lastRespawnLavaX = w.xLava;
        s.consecutiveRespawns = 1;
        s.safePoint = { x: w.xLancement + 1, y: heightAt(t, w.xLancement + 1), angle: 0 };
        const r = chooseRespawnTarget(s, t, CONFIG, 'lava', w.xLava - 1);
        const where = `seed ${seed}, volcan en x = ${w.xLancement.toFixed(1)}`;
        expect(r.consecutive, where).toBe(0);
        expect(r.lavaX, where).toBeNull();
        expect(r.point.x, where).toBeCloseTo(w.xEnd - 10, 9);
        expect(r.point.x, where).toBeGreaterThanOrEqual(w.xReception + 10);
        expect(r.point.y, where).toBeCloseTo(heightAt(t, r.point.x), 9);
        expect(Math.abs(r.point.angle), where).toBeLessThan(1e-9);
      }
    }
    expect(volcanoes).toBeGreaterThan(30);
  });

  test.each(['side', 'flipped', 'stuck', 'underground', 'speed'] as const)(
    'lave puis %s au même volcan → point sûr normal, série remise à zéro',
    (reason) => {
      const s = newState();
      const S1 = { x: V1.xLancement + 1, y: heightAt(track, V1.xLancement + 1), angle: 0 };
      s.safePoint = S1;
      const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava', V1.xLava - 1);
      applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
      expect(s.lastRespawnLavaX).toBe(V1.xLava);
      expect(s.consecutiveRespawns).toBe(1);

      const r2 = chooseRespawnTarget(s, track, CONFIG, reason, V1.xLava - 1);
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
    const r1 = chooseRespawnTarget(s, track, CONFIG, 'lava', V1.xLava - 1);
    applyRespawnToState(s, r1.point, r1.lavaX, r1.consecutive, 10, CONFIG);
    const r2 = chooseRespawnTarget(s, track, CONFIG, 'side', V1.xLava - 1);
    applyRespawnToState(s, r2.point, r2.lavaX, r2.consecutive, 20, CONFIG);
    const r3 = chooseRespawnTarget(s, track, CONFIG, 'lava', V1.xLava - 1);
    expect(r3.point).toEqual(S1);
    expect(r3.lavaX).toBe(V1.xLava);
    expect(r3.consecutive).toBe(1);
    // La série repart : une 4e chute dans la même lave passe le volcan.
    applyRespawnToState(s, r3.point, r3.lavaX, r3.consecutive, 30, CONFIG);
    const r4 = chooseRespawnTarget(s, track, CONFIG, 'lava', V1.xLava - 1);
    expect(r4.consecutive).toBe(0);
    expect(r4.point.x).toBeCloseTo(V1.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK, 9);
  });

  test('la série compte la lave réellement touchée (x de la chute), pas le premier volcan devant le point sûr (tour 1 de la 5g)', () => {
    // Chute dans la lave de V2 avec un point sûr encore avant V1 (voiture passée sans nouveau point sûr) : la série
    // continue sur V2, qui a déjà fait tomber la voiture une fois.
    const s = newState();
    s.lastRespawnLavaX = V2.xLava;
    s.consecutiveRespawns = 1;
    s.safePoint = { x: V1.xLancement - 10, y: heightAt(track, V1.xLancement - 10), angle: 0 };
    const r = chooseRespawnTarget(s, track, CONFIG, 'lava', V2.xLava - 1);
    expect(r.consecutive).toBe(0);
    expect(r.point.x).toBeCloseTo(V2.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK, 9);
    // Inversement : point sûr juste après une fosse, chute dans la lave de cette fosse (voiture revenue en arrière) :
    // c'est la fosse qui compte, pas le volcan suivant.
    const t = newState();
    t.safePoint = { x: F.xReception + 3.5, y: 0, angle: 0 };
    const rf = chooseRespawnTarget(t, track, CONFIG, 'lava', F.xReception - 0.5);
    expect(rf.lavaX).toBe(F.xLava);
    expect(rf.consecutive).toBe(1);
  });

  test('volcan différent de celui du dernier respawn → consecutive 1', () => {
    const s = newState();
    s.lastRespawnLavaX = V1.xLava;
    s.consecutiveRespawns = 1;
    s.safePoint = { x: V2.xElanStart - 5, y: 0, angle: 0 };
    const r = chooseRespawnTarget(s, track, CONFIG, 'lava', V2.xLava - 1);
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

describe('shiftTarget : respawn groupé (addendum §1.6)', () => {
  /** Recul d'une voiture : 1,5 × CAR_LENGTH = 3,3 m. */
  const GAP = CONFIG.RESPAWN_GROUP_SPACING_FACTOR * CONFIG.CAR_LENGTH;
  const SPACING = CONFIG.TRACK_POINT_SPACING;
  const LENGTH = 200;
  const ramp = Math.tan(20 * DEG);

  /** Piste synthétique de 200 m : profil y(x) échantillonné tous les TRACK_POINT_SPACING, tranches et volcans fournis. */
  function synthetic(y: (x: number) => number, slices: Slice[] = [], volcanoes: Volcano[] = []): Track {
    const points = Array.from({ length: Math.round(LENGTH / SPACING) + 1 }, (_, i) => ({ x: i * SPACING, y: y(i * SPACING) }));
    return {
      seed: 0, targetLength: LENGTH, length: LENGTH, points, exemptPointIndices: [], volcanoes, stars: [],
      slices: slices.length > 0 ? slices : [{ type: 'plat', xStart: 0, xEnd: LENGTH }],
      xStart: 21.5, xFinish: 150, xWall: LENGTH,
    };
  }
  const flat = synthetic(() => 0);
  /** Pente de 20° (> SAFE_POINT_MAX_SLOPE) entre x = a et x = b, plat ailleurs. */
  const steepBetween = (a: number, b: number) => synthetic((x) => (x < a ? 0 : (Math.min(x, b) - a) * ramp));
  const at = (track: Track, x: number) => ({ x, y: heightAt(track, x), angle: slopeAt(track, x) });

  test('aucun châssis à moins de 3,3 m : la cible est rendue telle quelle', () => {
    const p = at(flat, 100);
    expect(shiftTarget(p, [], flat, CONFIG)).toEqual(p);
    expect(shiftTarget(p, [100 + GAP + 0.1, 100 - GAP - 0.1, 20], flat, CONFIG)).toEqual(p);
  });

  test('sur un plat : recule de 3,3 m par voiture déjà posée, au sol local', () => {
    const p = at(flat, 100);
    const occupied: number[] = [];
    for (let k = 1; k <= 4; k++) {
      occupied.push(100 - (k - 1) * GAP);
      const r = shiftTarget(p, occupied, flat, CONFIG);
      expect(r.x, `${k} occupant(s)`).toBeCloseTo(100 - k * GAP, 9);
      expect(r.y).toBe(heightAt(flat, r.x));
      expect(r.angle).toBe(slopeAt(flat, r.x));
    }
  });

  test('s’arrête à RESPAWN_GROUP_MAX_SHIFT = 4 reculs (5e occupant : chevauchement couvert par l’invulnérabilité)', () => {
    expect(CONFIG.RESPAWN_GROUP_MAX_SHIFT).toBe(4);
    const occupied = [0, 1, 2, 3, 4].map((k) => 100 - k * GAP);
    expect(shiftTarget(at(flat, 100), occupied, flat, CONFIG).x).toBeCloseTo(100 - 4 * GAP, 9);
  });

  test('saute une pente > SAFE_POINT_MAX_SLOPE : premier x en amont où la pente est douce', () => {
    // Pente de 20° sur [92, 97.5[ : le recul (96,7) tombe dessus, l'ajustement remonte jusqu'à x < 92.
    const track = steepBetween(92, 97.5);
    expect(Math.abs(slopeAt(track, 100 - GAP))).toBeGreaterThan(CONFIG.SAFE_POINT_MAX_SLOPE);
    const r = shiftTarget(at(track, 100), [100], track, CONFIG);
    expect(Math.abs(slopeAt(track, r.x))).toBeLessThan(CONFIG.SAFE_POINT_MAX_SLOPE);
    expect(r.x).toBeLessThanOrEqual(92 + 1e-9);
    expect(r.x).toBeGreaterThan(92 - SPACING - 1e-9);
    expect(r.y).toBe(heightAt(track, r.x));
    expect(r.angle).toBe(slopeAt(track, r.x));
  });

  test('refuse la zone interdite d’un volcan [xLancement + 5, xReception[ et une tranche cratère', () => {
    const v: Volcano = {
      kind: 'tremplin', xLancement: 90, xElanStart: 91, xRampStart: 92, xLip: 93, lipY: 1, xLava: 95, lavaWidth: 1, rimY: 0,
      xReception: 97, xEnd: 99,
    };
    const withVolcano = synthetic(() => 0, [], [v]);
    const r1 = shiftTarget(at(withVolcano, 99.5), [99.5], withVolcano, CONFIG);
    expect(r1.x).toBeLessThan(v.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN);
    expect(r1.x).toBeGreaterThan(v.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN - SPACING - 1e-9);

    const slices: Slice[] = [
      { type: 'plat', xStart: 0, xEnd: 94 }, { type: 'cratère', xStart: 94, xEnd: 97 }, { type: 'plat', xStart: 97, xEnd: LENGTH },
    ];
    const withCrater = synthetic(() => 0, slices);
    const r2 = shiftTarget(at(withCrater, 99.5), [99.5], withCrater, CONFIG);
    expect(r2.x).toBeLessThan(94);
    expect(r2.x).toBeGreaterThan(94 - SPACING - 1e-9);
  });

  test('cible juste après une fosse, occupée (tour 1 de la 5g) : le recul ne pose jamais le châssis à moins de 1,5 m du bord aval', () => {
    const f: Volcano = { kind: 'fosse', xLancement: 60, xBord: 92.4, xLava: 96.4, lavaWidth: 8, rimY: 0, xReception: 100.4, xEnd: 165.2 };
    const track = synthetic(() => 0, [], [f]);
    for (const dx of [1.6, 2.5, 3.5, 4.8]) {
      const p = at(track, f.xReception + dx);
      const r = shiftTarget(p, [p.x], track, CONFIG);
      expect(r.x, `cible à bord aval + ${dx}`).toBeGreaterThanOrEqual(f.xReception + 1.5 - 1e-9);
    }
    // Vers l'aval (option B) : avance au-delà de l'occupant.
    const p = at(track, f.xReception + 5);
    expect(shiftTarget(p, [p.x], track, CONFIG, 1).x).toBeCloseTo(f.xReception + 5 + GAP, 9);
  });

  test('rien de valide à moins de 10 m d’ajustement : garde la cible (ou la dernière cible valide)', () => {
    // Pente de 20° sur [80, 97.5[ : le recul (96,7) n'a pas de sol doux avant 86,7 (10 m) → abandonné.
    const track = steepBetween(80, 97.5);
    const p = at(track, 100);
    expect(shiftTarget(p, [100], track, CONFIG)).toEqual(p);
    // Premier recul valide (pente sur [80, 95.5[, 96,7 est plat), deuxième abandonné : on garde le premier.
    const track2 = steepBetween(80, 95.5);
    const r = shiftTarget(at(track2, 100), [100, 100 - GAP], track2, CONFIG);
    expect(r.x).toBeCloseTo(100 - GAP, 9);
  });

  test('jamais avant le début de la piste (rien n’est posé sous x = CAR_LENGTH)', () => {
    const p = at(flat, 4);
    expect(shiftTarget(p, [4], flat, CONFIG)).toEqual(p);
    const r = shiftTarget(at(flat, 6), [6], flat, CONFIG);
    expect(r.x).toBeCloseTo(6 - GAP, 9);
    expect(shiftTarget(at(flat, 6), [6, 6 - GAP], flat, CONFIG).x).toBeCloseTo(6 - GAP, 9);
  });

  test('vers l’aval (cible d’après une fosse, ruling R-F15) : avance de 3,3 m par voiture déjà posée, 4 fois au plus, au sol local', () => {
    const p = at(flat, 100);
    const occupied: number[] = [];
    for (let k = 1; k <= 5; k++) {
      occupied.push(100 + (k - 1) * GAP);
      const r = shiftTarget(p, occupied, flat, CONFIG, 1);
      expect(r.x, `${k} occupant(s)`).toBeCloseTo(100 + Math.min(k, 4) * GAP, 9);
      expect(r.y).toBe(heightAt(flat, r.x));
    }
    // Pente raide juste après : la cible continue vers l'aval jusqu'au premier sol doux.
    const track = synthetic((x) => (x < 102 ? 0 : x < 104.5 ? (x - 102) * ramp : 2.5 * ramp));
    const r = shiftTarget(at(track, 100), [100], track, CONFIG, 1);
    expect(Math.abs(slopeAt(track, r.x))).toBeLessThan(CONFIG.SAFE_POINT_MAX_SLOPE);
    expect(r.x).toBeGreaterThanOrEqual(104.5 - 1e-9);
    // Jamais au-delà du mur de fin (xWall − CAR_LENGTH).
    expect(shiftTarget(at(flat, LENGTH - 3), [LENGTH - 3], flat, CONFIG, 1).x).toBe(LENGTH - 3);
  });

  test('pur : l’entrée n’est pas modifiée', () => {
    const p = at(flat, 100);
    const occupied = [100, 50];
    shiftTarget(p, occupied, flat, CONFIG);
    expect(p).toEqual(at(flat, 100));
    expect(occupied).toEqual([100, 50]);
  });
});
