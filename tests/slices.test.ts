import { CONFIG } from '../src/config';
import { jumpRange } from '../src/track/ballistics';
import { mulberry32 } from '../src/track/rng';
import {
  bosses, doubleBosse, plat, rampeSaut, rampeVolcan, volcanoGeometry,
  type SliceProfile,
} from '../src/track/slices';

// Config figée : les valeurs de référence ci-dessous en dépendent (la calibration peut rejouer LAVA_MARGIN / L_ELAN).
const PINNED = { ...CONFIG, V_JUMP: 10, LAVA_MARGIN: 0.8, L_ELAN: 6 };
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
    expect(Math.abs(g.dxLava - 13.13)).toBeLessThan(0.05);
    expect(g.valleyRun).toBeCloseTo(4.86, 1);
    expect(g.lElan).toBe(PINNED.L_ELAN);
    expect(g.lLancement).toBe(PINNED.LANCEMENT_LENGTH);
    const dxLip = g.lLancement + g.lElan + g.rampRun;
    expect(Math.abs(g.dxReception - dxLip - 17.0)).toBeLessThan(0.05);
  });

  test('cohérence : réception = lave + demi-largeur + descente aval, sans butée', () => {
    expect(g.valleyRun).toBeGreaterThanOrEqual(0);
    expect(PINNED.RIM_HEIGHT).toBeLessThan(g.lipY);
    expect(g.dxLava).toBeCloseTo(g.descentRun + g.valleyRun + g.ascentRun + PINNED.LAVA_WIDTH / 2, 9);
    const dxLip = g.lLancement + g.lElan + g.rampRun;
    expect(g.dxReception).toBeCloseTo(
      dxLip + g.dxLava + PINNED.LAVA_WIDTH / 2 + PINNED.RIM_HEIGHT / Math.tan(PINNED.MAX_SLOPE), 9);
    const turbo = jumpRange(PINNED.V_MAX * PINNED.TURBO_FACTOR, PINNED.GRAVITY, PINNED.RAMP_ANGLE, g.lipY);
    expect(g.dxEnd).toBeCloseTo(Math.max(g.dxReception + 10, dxLip + 1.2 * turbo), 9);
    expect(g.dxEnd).toBeGreaterThanOrEqual(dxLip + 1.2 * turbo);
    expect(g.dxEnd).toBeGreaterThanOrEqual(g.dxReception + 10);
    expect(g.dxReception).toBeGreaterThan(dxLip + g.dxLava);
  });
});

describe('volcanoGeometry (CONFIG réelle : formules)', () => {
  const g = volcanoGeometry(CONFIG);
  test('lLancement = LANCEMENT_LENGTH, lElan = L_ELAN', () => {
    expect(g.lLancement).toBe(CONFIG.LANCEMENT_LENGTH);
    expect(g.lElan).toBe(CONFIG.L_ELAN);
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
  const tanM = Math.tan(PINNED.MAX_SLOPE);

  test('infos de volcan cohérentes avec volcanoGeometry (depuis le début de tranche)', () => {
    expect(v.dxElanStart).toBeCloseTo(g.lLancement, 9);
    expect(v.dxRampStart).toBeCloseTo(g.lLancement + g.lElan, 9);
    expect(v.dxLip).toBeCloseTo(g.lLancement + g.lElan + g.rampRun, 9);
    expect(v.lipY).toBeCloseTo(g.lipY, 9);
    expect(v.dxLava).toBeCloseTo(v.dxLip + g.dxLava, 9);
    expect(v.lavaWidth).toBe(PINNED.LAVA_WIDTH);
    expect(v.rimY).toBe(PINNED.RIM_HEIGHT);
    expect(v.dxReception).toBeCloseTo(g.dxReception, 9);
    expect(v.dxEnd).toBeCloseTo(p.length, 9);
    expect(p.length).toBeGreaterThanOrEqual(g.dxEnd - S);
  });

  test('plat de lancement et plat d\'élan à 0 sur [0, lLancement + lElan]', () => {
    const kLast = Math.floor((g.lLancement + g.lElan) / S + EPS);
    expect(kLast).toBeGreaterThan(0);
    expect(p.heights.slice(0, kLast).every((h) => h === 0)).toBe(true);
    expect(at(v.dxElanStart)).toBe(0);
    expect(at(v.dxElanStart + g.lElan / 2)).toBe(0);
    // la rampe monte dès le pas suivant
    expect(p.heights[kLast + 1]).toBeGreaterThan(0);
  });

  test('sommet de rampe à lipY, fond de lave à RIM − CRATER_DEPTH', () => {
    expect(Math.max(...p.heights)).toBeCloseTo(g.lipY, 1);
    expect(at(v.dxLava)).toBeCloseTo(PINNED.RIM_HEIGHT - PINNED.CRATER_DEPTH, 9);
  });

  test('vallée à 0 entre la descente et la montée', () => {
    const x = v.dxLip + g.descentRun + g.valleyRun / 2;
    expect(at(x)).toBeCloseTo(0, 9);
  });

  test('après le rebord aval : descente de RIM_HEIGHT vers 0 sans bosse, puis plat de réception à 0 jusqu\'à la fin', () => {
    const xRimB = v.dxLava + PINNED.LAVA_WIDTH / 2;
    const kRimB = Math.ceil(xRimB / S - EPS);              // premier échantillon au bord aval ou au-delà
    const tail = p.heights.slice(kRimB - 1);                // à partir du bord aval, jusqu'à la fin
    expect(Math.max(...tail)).toBeLessThanOrEqual(PINNED.RIM_HEIGHT + EPS);
    for (let k = 1; k < tail.length; k++) expect(tail[k]).toBeLessThanOrEqual(tail[k - 1] + EPS);   // jamais de remontée
    expect(at(xRimB + 0.5 * PINNED.RIM_HEIGHT / tanM)).toBeCloseTo(0.5 * PINNED.RIM_HEIGHT, 1);
    const k0 = Math.ceil(v.dxReception / S - EPS);         // premier échantillon en dxReception ou au-delà
    expect(p.heights[k0 - 2]).toBeLessThanOrEqual(tanM * S + EPS);   // dernier échantillon de la descente
    expect(p.heights.slice(k0 - 1).every((h) => h === 0)).toBe(true);
    expect(p.heights.length - k0).toBeGreaterThan(10 / S - 2);
  });

  test('parois verticales : un seul pas, exemptées ; deux parois exactement', () => {
    expect(p.exemptIndices).toHaveLength(2);
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
