// Élastique des copains (plan B, tâche 7 ; spec §7, addendum §1.8 et §2 ; décisions D7-2 et D7-3 du papa) : fonctions
// pures de src/ai/rubberband.ts. Le câblage dans le pas de course : tests/elastique.test.ts.
import {
  finalFactor, onScreen, rampFactor, screenAheadEdge, screenBehindEdge, stepRubber, targetFactor, zoneFloor,
} from '../src/ai/rubberband';
import { CONFIG } from '../src/config';
import { inVolcanoZone } from '../src/track/query';
import { trackFor } from './helpers/runs';

const C = CONFIG;
const DT = C.PHYSICS_DT;
const STEP = C.RUBBER_RATE_PER_S * DT;
/** `base` des copains (décision D7-3), et les bornes de la plage. */
const BASES = [1, 0.995, 0.9875, 0.985, 0.975, 0.97];

describe('targetFactor (fenêtre de la vue : 20 m devant, 3 m derrière ; rampe de 40 m de base à la borne, R7-15)', () => {
  test('base sur [−3, 20] (bornes comprises)', () => {
    for (const base of BASES) {
      for (let gap = -3; gap <= 20 + 1e-9; gap += 0.25) expect(targetFactor(gap, base, C), `base ${base}, gap ${gap}`).toBe(base);
    }
  });

  test('0,6 au-delà de 60 m devant, 1,3 en deçà de 43 m derrière ; constante au-delà', () => {
    for (const base of BASES) {
      for (const gap of [60, 60.01, 75, 200, 1e4]) expect(targetFactor(gap, base, C), `base ${base}, gap ${gap}`).toBeCloseTo(0.6, 12);
      for (const gap of [-43, -43.01, -60, -200, -1e4]) expect(targetFactor(gap, base, C), `base ${base}, gap ${gap}`).toBeCloseTo(1.3, 12);
    }
  });

  test('linéaire entre la fenêtre et la borne : mi-chemin à 40 m devant et à 23 m derrière', () => {
    for (const base of BASES) {
      expect(targetFactor(40, base, C)).toBeCloseTo(base + (0.6 - base) / 2, 12);
      expect(targetFactor(30, base, C)).toBeCloseTo(base + (0.6 - base) / 4, 12);
      expect(targetFactor(-23, base, C)).toBeCloseTo(base + (1.3 - base) / 2, 12);
      expect(targetFactor(-13, base, C)).toBeCloseTo(base + (1.3 - base) / 4, 12);
    }
  });

  test('bornes [0,6 ; 1,3] et non croissante en gap (−120 à 120 m au pas de 0,1), pour toute base de [0,97 ; 1]', () => {
    for (const base of [...BASES, 0.9725, 0.99]) {
      let prev = Infinity;
      for (let i = -1200; i <= 1200; i++) {
        const gap = i / 10;
        const f = targetFactor(gap, base, C);
        expect(f, `base ${base}, gap ${gap}`).toBeGreaterThanOrEqual(0.6 - 1e-12);
        expect(f, `base ${base}, gap ${gap}`).toBeLessThanOrEqual(1.3 + 1e-12);
        expect(f, `base ${base}, gap ${gap} : non croissante`).toBeLessThanOrEqual(prev);
        prev = f;
      }
    }
  });
});

describe('rampFactor (spec §7 : au plus 0,15 par seconde)', () => {
  test('|Δ| ≤ 0,15 × dt, et la cible est atteinte sans la dépasser, à la montée comme à la descente', () => {
    for (const [from, to] of [[0.6, 1.3], [1.3, 0.6], [1, 0.97], [0.97, 1], [1, 1]]) {
      let r = from;
      let steps = 0;
      while (r !== to && steps < 10_000) {
        const next = rampFactor(r, to, DT, C);
        expect(Math.abs(next - r), `${from} → ${to}, pas ${steps}`).toBeLessThanOrEqual(STEP + 1e-15);
        if (to > from) expect(next).toBeLessThanOrEqual(to);
        if (to < from) expect(next).toBeGreaterThanOrEqual(to);
        r = next;
        steps++;
      }
      expect(r, `${from} → ${to}`).toBe(to);
      // Le nombre de pas est celui du taux : |to − from| / (0,15 × dt), arrondi au-dessus (à un pas près : flottants).
      const expected = Math.abs(to - from) / STEP;
      expect(steps).toBeGreaterThanOrEqual(Math.ceil(expected - 1e-6));
      expect(steps).toBeLessThanOrEqual(Math.ceil(expected - 1e-6) + 1);
    }
  });
});

describe('zoneFloor et inVolcanoZone (addendum §1.8 : facteur au moins 1 de xLancement − 40 m à xLava)', () => {
  test('zoneFloor : 1 sur [xLancement − 40, xLava] de chaque tremplin et de chaque fosse (garde comprise), graines 0 à 19 ; 0 à ± 1 cm hors des bornes', () => {
    let n = 0;
    for (let seed = 0; seed < 20; seed++) {
      const track = trackFor(seed);
      for (const v of track.volcanoes) {
        const a = v.xLancement - C.RUBBER_PREZONE_M;
        for (let x = a; x <= v.xLava; x += 0.5) expect(zoneFloor(track, x, C), `g${seed} ${v.kind} ${v.xLancement.toFixed(1)}, x ${x}`).toBe(1);
        expect(zoneFloor(track, a, C)).toBe(1);
        expect(zoneFloor(track, v.xLava, C)).toBe(1);
        if (v.kind === 'fosse') expect(zoneFloor(track, v.xLancement - C.FOSSE_GUARD, C), 'garde de la fosse').toBe(1);
        expect(zoneFloor(track, a - 0.01, C), `g${seed} ${v.kind} : 1 cm avant la pré-zone`).toBe(0);
        expect(zoneFloor(track, v.xLava + 0.01, C), `g${seed} ${v.kind} : 1 cm après xLava`).toBe(0);
        n++;
      }
    }
    expect(n).toBeGreaterThanOrEqual(60);
  });
});

describe('vue de référence (R7-16) : bords de l’écran de 1 280 × 800, caméra en avance de 0,6 s × v, marge de 1,6 m', () => {
  test('SCREEN_REF_HALF_WIDTH_M = VISIBLE_HEIGHT_M × 1 280 / 800 / 2 = 11,2 m ; marge 1,6 m', () => {
    expect(C.SCREEN_REF_HALF_WIDTH_M).toBe((C.VISIBLE_HEIGHT_M * 1280) / 800 / 2);
    expect(C.SCREEN_REF_HALF_WIDTH_M).toBeCloseTo(11.2, 12);
    expect(C.SCREEN_EDGE_MARGIN_M).toBe(1.6);
  });

  test('bords : 21,2 m et −4,4 m à 14 m/s ; 25,4 m à 21 m/s ; ± 12,8 m à l’arrêt', () => {
    expect(screenAheadEdge(14, C)).toBeCloseTo(21.2, 9);
    expect(screenBehindEdge(14, C)).toBeCloseTo(-4.4, 9);
    expect(screenAheadEdge(21, C)).toBeCloseTo(25.4, 9);
    expect(screenAheadEdge(0, C)).toBeCloseTo(12.8, 9);
    expect(screenBehindEdge(0, C)).toBeCloseTo(-12.8, 9);
  });

  test('onScreen : screenBehindEdge ≤ gap ≤ screenAheadEdge', () => {
    for (const v of [0, 7, 14, 21]) {
      const a = screenAheadEdge(v, C);
      const b = screenBehindEdge(v, C);
      expect(onScreen(a, v, C)).toBe(true);
      expect(onScreen(b, v, C)).toBe(true);
      expect(onScreen(0, v, C)).toBe(true);
      expect(onScreen(a + 0.01, v, C)).toBe(false);
      expect(onScreen(b - 0.01, v, C)).toBe(false);
    }
  });
});

describe('finalFactor : turbo plafonné à 1,3 au total, ≤ 1 hors écran devant Galahad (R7-1, R7-16)', () => {
  test('plafond total 1,3 : 0,97 × 1,5 → 1,3 ; 1 × 1,5 → 1,3 ; 0,8 × 1,5 → 1,2 ; sans turbo, l’élastique tel quel', () => {
    expect(finalFactor(0.97, 1.5, 0, 14, C)).toBe(1.3);
    expect(finalFactor(1, 1.5, 0, 14, C)).toBe(1.3);
    expect(finalFactor(0.8, 1.5, 0, 14, C)).toBeCloseTo(1.2, 12);
    expect(finalFactor(1.3, 1, -50, 14, C)).toBe(1.3);
    expect(finalFactor(0.97, 1, 0, 14, C)).toBe(0.97);
  });

  test('Galahad à 14 m/s, copain en turbo : 1,3 à 15 m (à l’écran) et à 20,5 m (au-delà de la fenêtre, encore à l’écran) ; 1,0 à 21,3 m', () => {
    expect(finalFactor(1, 1.5, 15, 14, C)).toBe(1.3); // mutant « plafond à 12 m »
    expect(finalFactor(1, 1.5, 20.5, 14, C)).toBe(1.3); // mutant « plafond à 20 m, la fenêtre »
    expect(finalFactor(1, 1.5, 21.3, 14, C)).toBe(1);
    expect(finalFactor(0.97, 1.5, 21.3, 14, C)).toBe(1);
  });

  test('Galahad à 21 m/s : 1,3 à 24 m, 1,0 à 25,5 m', () => {
    expect(finalFactor(1, 1.5, 24, 21, C)).toBe(1.3);
    expect(finalFactor(1, 1.5, 25.5, 21, C)).toBe(1);
  });

  test('hors écran devant sans turbo : l’élastique (≤ 1 de toute façon) ; derrière, jamais plafonné à 1', () => {
    expect(finalFactor(0.6, 1, 100, 14, C)).toBe(0.6);
    expect(finalFactor(1.2, 1, 100, 14, C)).toBe(1);
    expect(finalFactor(1.2, 1, -100, 14, C)).toBe(1.2);
    expect(finalFactor(1.2, 1.5, -100, 14, C)).toBe(1.3);
  });
});

describe('stepRubber : cible, plancher, rampe, clamp de zone (règles 1 à 4, dans cet ordre)', () => {
  const track = trackFor(1);
  /** x loin de tout volcan (avant la pré-zone du premier). */
  const xFree = track.xStart + 20;

  test('x de référence hors de toute pré-zone', () => {
    expect(zoneFloor(track, xFree, C)).toBe(0);
    expect(inVolcanoZone(track, xFree)).toBe(false);
  });

  test('neutre : cible 1 pour t < 5 s, même avec un gap de ± 100 m ; ensuite, la fenêtre', () => {
    for (const t of [0, 1, 2.5, 4.9, 4.99]) {
      expect(stepRubber(1, t, 100, 0.97, xFree, track, C), `t ${t}, devant`).toBe(1);
      expect(stepRubber(1, t, -100, 0.97, xFree, track, C), `t ${t}, derrière`).toBe(1);
      expect(stepRubber(0.6, t, 100, 0.97, xFree, track, C), `t ${t}, de 0,6`).toBeCloseTo(0.6 + STEP, 12);
    }
    expect(stepRubber(1, 5, 100, 0.97, xFree, track, C)).toBeCloseTo(1 - STEP, 12);
    expect(stepRubber(1, 5, -100, 0.97, xFree, track, C)).toBeCloseTo(1 + STEP, 12);
    expect(stepRubber(0.97, 5, 0, 0.97, xFree, track, C)).toBe(0.97);
  });

  test('pré-zone : la cible vaut au moins 1 (montée à 0,15/s, sans marche) ; clamp ≥ 1 au premier pas dans [xLancement, xLava] depuis 0,6, puis baisse à 0,15/s au plus en sortant (clamp stocké)', () => {
    for (let seed = 0; seed < 10; seed++) {
      const tr = trackFor(seed);
      for (const v of tr.volcanoes) {
        const what = `g${seed} ${v.kind} ${v.xLancement.toFixed(1)}`;
        // Dans la pré-zone, hors zone : 0,6 monte d'un cran, sans clamp.
        expect(stepRubber(0.6, 10, 100, 0.97, v.xLancement - 0.01, tr, C), what).toBeCloseTo(0.6 + STEP, 12);
        expect(stepRubber(0.6, 10, 100, 0.97, v.xLancement - C.RUBBER_PREZONE_M, tr, C), what).toBeCloseTo(0.6 + STEP, 12);
        // Premier pas dans la zone : clamp à 1, immédiat.
        const r1 = stepRubber(0.6, 10, 100, 0.97, v.xLancement, tr, C);
        expect(r1, what).toBe(1);
        expect(stepRubber(0.6, 10, 100, 0.97, v.xLava, tr, C), what).toBe(1);
        // Un copain à 1,3 (loin derrière) garde 1,3 dans la zone : le clamp ne fait que monter.
        expect(stepRubber(1.3, 10, -100, 0.97, v.xLancement + 1, tr, C), what).toBe(1.3);
        // En sortant (x > xLava, cible 0,6), la baisse part de la valeur stockée (1), d'un cran.
        const out = stepRubber(r1, 10, 100, 0.97, v.xLava + 0.01, tr, C);
        expect(out, what).toBeCloseTo(1 - STEP, 12);
        expect(out, what).toBeGreaterThanOrEqual(1 - STEP - 1e-12);
      }
    }
  });
});
