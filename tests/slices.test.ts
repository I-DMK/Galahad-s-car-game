import { CONFIG } from '../src/config';
import { jumpRange, runUpDistance } from '../src/track/ballistics';
import { mulberry32 } from '../src/track/rng';
import {
  bosses, doubleBosse, plat, rampeSaut, rampeVolcan, volcanoGeometry,
  type SliceProfile,
} from '../src/track/slices';

// Config figée : les tâches suivantes recalibrent DRIVE_ACCEL / LAVA_MARGIN.
const PINNED = { ...CONFIG, DRIVE_ACCEL: 4, V_JUMP: 10, LAVA_MARGIN: 0.7 };
const S = CONFIG.TRACK_POINT_SPACING;
const EPS = 1e-9;

function profiles(): Record<string, SliceProfile> {
  const rng = mulberry32(42);
  return {
    plat: plat(rng, PINNED),
    bosses: bosses(rng, PINNED),
    'rampe-saut': rampeSaut(rng, PINNED),
    'double-bosse': doubleBosse(rng, PINNED),
    'rampe-volcan': rampeVolcan(PINNED),
  };
}

describe.each(Object.entries(profiles()))('profil %s', (name, p) => {
  test('type, longueur = n × espacement, finit exactement à 0', () => {
    expect(p.type).toBe(name);
    expect(p.heights.length).toBeGreaterThan(0);
    expect(p.length).toBeCloseTo(p.heights.length * S, 9);
    expect(p.heights[p.heights.length - 1]).toBe(0);
  });

  test('démarre à 0 : première pente mesurée depuis 0', () => {
    expect(Math.abs(p.heights[0])).toBeLessThanOrEqual(Math.tan(PINNED.MAX_SLOPE) * S + EPS);
  });

  test('pente ≤ MAX_SLOPE partout sauf aux indices exemptés', () => {
    const exempt = new Set(p.exemptIndices);
    const bad: number[] = [];
    for (let k = 0; k < p.heights.length; k++) {
      const prev = k === 0 ? 0 : p.heights[k - 1];
      const slope = Math.atan(Math.abs(p.heights[k] - prev) / S);
      if (slope > PINNED.MAX_SLOPE + EPS && !exempt.has(k)) bad.push(k);
    }
    expect(bad).toEqual([]);
  });

  test("les indices exemptés sont valides et leur nombre est borné", () => {
    for (const i of p.exemptIndices) {
      expect(Number.isInteger(i)).toBe(true);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(p.heights.length);
    }
    const max: Record<string, number> = { 'rampe-saut': 1, 'rampe-volcan': 2 };
    expect(p.exemptIndices.length).toBeLessThanOrEqual(max[name] ?? 0);
  });
});

test('rampe-saut a exactement une cassure exemptée, rampe-volcan deux parois', () => {
  expect(rampeSaut(mulberry32(1), PINNED).exemptIndices).toHaveLength(1);
  expect(rampeVolcan(PINNED).exemptIndices).toHaveLength(2);
});

test('plat : 20–40 m par défaut, longueur imposée respectée, tout à 0', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const p = plat(mulberry32(seed), PINNED);
    expect(p.length).toBeGreaterThanOrEqual(20 - S);
    expect(p.length).toBeLessThanOrEqual(40 + S);
    expect(p.heights.every((h) => h === 0)).toBe(true);
  }
  expect(plat(mulberry32(1), PINNED, 26.4).length).toBeCloseTo(26.4, 9);
  // longueur hors grille : arrondie au pas le plus proche
  expect(Math.abs(plat(mulberry32(1), PINNED, 26.5).length - 26.5)).toBeLessThanOrEqual(S / 2 + EPS);
});

test('bosses : 30–60 m, vraies bosses non nulles', () => {
  let tallest = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const p = bosses(mulberry32(seed), PINNED);
    expect(p.length).toBeGreaterThanOrEqual(30 - S);
    expect(p.length).toBeLessThanOrEqual(60 + S);
    tallest = Math.max(tallest, ...p.heights.map(Math.abs));
  }
  expect(tallest).toBeGreaterThan(0.1);
});

test('double-bosse : deux bosses de 0,9 m, 22 m au total', () => {
  const p = doubleBosse(mulberry32(1), PINNED);
  expect(p.length).toBeCloseTo(22, 9);
  expect(Math.max(...p.heights)).toBeCloseTo(0.9, 6);
  // deux sommets séparés : le milieu du palier entre les bosses est à 0
  expect(p.heights[Math.round((6 + 2) / S) - 1]).toBeCloseTo(0, 9);
});

test('rampe-saut : monte à ≈ 2,25 m puis la cassure de 0,4 m', () => {
  const p = rampeSaut(mulberry32(1), PINNED);
  const peak = Math.max(...p.heights);
  expect(peak).toBeGreaterThan(2.0);
  expect(peak).toBeLessThanOrEqual(PINNED.RAMP_LENGTH * Math.sin(PINNED.RAMP_ANGLE) + EPS);
  const i = p.exemptIndices[0];
  expect(p.heights[i - 1] - p.heights[i]).toBeGreaterThan(0.35);
});

describe('volcanoGeometry (config figée)', () => {
  const g = volcanoGeometry(PINNED);

  test('valeurs de référence', () => {
    expect(g.lipY).toBeCloseTo(2.25, 2);
    expect(g.rampRun).toBeCloseTo(5.56, 2);
    expect(g.descentRun).toBeCloseTo(4.41, 2);
    expect(g.ascentRun).toBeCloseTo(2.36, 2);
    expect(Math.abs(g.dxLava - 11.49)).toBeLessThan(0.1);
    expect(g.valleyRun).toBeCloseTo(3.22, 1);
    expect(Math.abs(g.lElan - 24.4)).toBeLessThan(0.5);
  });

  test('cohérence', () => {
    expect(g.valleyRun).toBeGreaterThanOrEqual(0);
    expect(PINNED.RIM_HEIGHT).toBeLessThan(g.lipY);
    expect(g.dxLava).toBeCloseTo(g.descentRun + g.valleyRun + g.ascentRun + PINNED.LAVA_WIDTH / 2, 9);
    const dxLip = g.lElan + g.rampRun;
    const turbo = jumpRange(PINNED.V_MAX * PINNED.TURBO_FACTOR, PINNED.GRAVITY, PINNED.RAMP_ANGLE, g.lipY);
    expect(g.dxEnd).toBeGreaterThanOrEqual(dxLip + 1.2 * turbo);
    expect(g.dxEnd).toBeGreaterThanOrEqual(g.dxReception + 10);
    expect(g.dxReception).toBeGreaterThan(dxLip + g.dxLava);
  });
});

describe('volcanoGeometry (CONFIG réelle : formules)', () => {
  const g = volcanoGeometry(CONFIG);
  test('lElan suit la formule', () => {
    const vBottom = Math.sqrt(CONFIG.V_JUMP ** 2 + 2 * CONFIG.GRAVITY * g.lipY);
    expect(g.lElan).toBeCloseTo(
      (runUpDistance(vBottom, CONFIG.DRIVE_ACCEL) * CONFIG.ELAN_MARGIN) / CONFIG.ELAN_SAFE_FRACTION, 9);
  });
  test('dxLava = LAVA_MARGIN × portée à V_JUMP', () => {
    expect(g.dxLava).toBeCloseTo(
      CONFIG.LAVA_MARGIN * jumpRange(CONFIG.V_JUMP, CONFIG.GRAVITY, CONFIG.RAMP_ANGLE, g.lipY - CONFIG.RIM_HEIGHT), 9);
  });
});

describe('rampe-volcan : géométrie du profil', () => {
  const p = rampeVolcan(PINNED);
  const v = p.volcano!;
  const g = volcanoGeometry(PINNED);
  const at = (x: number) => p.heights[Math.round(x / S) - 1];

  test('infos de volcan cohérentes avec volcanoGeometry (depuis le début de tranche)', () => {
    expect(v.dxRampStart).toBeCloseTo(g.lElan, 9);
    expect(v.dxLip).toBeCloseTo(g.lElan + g.rampRun, 9);
    expect(v.lipY).toBeCloseTo(g.lipY, 9);
    expect(v.dxLava).toBeCloseTo(v.dxLip + g.dxLava, 9);
    expect(v.lavaWidth).toBe(PINNED.LAVA_WIDTH);
    expect(v.rimY).toBe(PINNED.RIM_HEIGHT);
    expect(v.dxReception).toBeCloseTo(g.dxReception, 9);
    expect(v.dxEnd).toBeCloseTo(p.length, 9);
    expect(p.length).toBeGreaterThanOrEqual(g.dxEnd - S);
  });

  test('plat d\'élan à 0, sommet de rampe à lipY, fond de lave à RIM − CRATER_DEPTH', () => {
    expect(at(v.dxRampStart / 2)).toBe(0);
    expect(Math.max(...p.heights)).toBeCloseTo(g.lipY, 1);
    expect(at(v.dxLava)).toBeCloseTo(PINNED.RIM_HEIGHT - PINNED.CRATER_DEPTH, 9);
  });

  test('vallée à 0 entre la descente et la montée', () => {
    const x = v.dxLip + g.descentRun + g.valleyRun / 2;
    expect(at(x)).toBeCloseTo(0, 9);
  });

  test('butée de 0,3 m puis plat de réception à 0 jusqu\'à la fin', () => {
    const bumpTop = v.dxReception - PINNED.STOP_BUMP_LENGTH;
    expect(at(bumpTop)).toBeCloseTo(PINNED.STOP_BUMP_HEIGHT, 1);
    const k0 = Math.round(v.dxReception / S);
    expect(p.heights.slice(k0).every((h) => h === 0)).toBe(true);
  });

  test('butée : pente max ≈ 25° (sous MAX_SLOPE)', () => {
    const k0 = Math.round((v.dxReception - 2 * PINNED.STOP_BUMP_LENGTH) / S);
    let worst = 0;
    for (let k = k0; k < k0 + Math.round((2 * PINNED.STOP_BUMP_LENGTH) / S); k++) {
      worst = Math.max(worst, Math.atan(Math.abs(p.heights[k] - p.heights[k - 1]) / S));
    }
    expect((worst * 180) / Math.PI).toBeGreaterThan(20);
    expect(worst).toBeLessThanOrEqual(PINNED.MAX_SLOPE);
  });

  test('parois verticales : un seul pas, exemptées', () => {
    const [a, b] = p.exemptIndices;
    expect(p.heights[a - 1] - p.heights[a]).toBeGreaterThan(0.9);
    expect(p.heights[b] - p.heights[b - 1]).toBeGreaterThan(0.9);
  });

  test('lance si la lave serait trop proche (valleyRun < 0)', () => {
    expect(() => rampeVolcan({ ...PINNED, LAVA_MARGIN: 0.4 })).toThrow();
  });
});

test('builders déterministes pour un même rng', () => {
  for (const build of [plat, bosses, rampeSaut, doubleBosse] as const) {
    expect(build(mulberry32(7), PINNED)).toEqual(build(mulberry32(7), PINNED));
  }
  expect(rampeVolcan(PINNED)).toEqual(rampeVolcan(PINNED));
  expect(bosses(mulberry32(7), PINNED)).not.toEqual(bosses(mulberry32(8), PINNED));
});

test('bosses : pente ≤ MAX_SLOPE pour de nombreuses graines', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const p = bosses(mulberry32(seed), PINNED);
    let prev = 0;
    for (const h of p.heights) {
      expect(Math.atan(Math.abs(h - prev) / S)).toBeLessThanOrEqual(PINNED.MAX_SLOPE + EPS);
      prev = h;
    }
  }
});
