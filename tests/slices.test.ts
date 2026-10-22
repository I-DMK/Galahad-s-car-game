import { CONFIG } from '../src/config';
import { jumpRange } from '../src/track/ballistics';
import { mulberry32 } from '../src/track/rng';
import {
  bosses, doubleBosse, fosse, fosseGeometry, plat, platEtoile, rampeSaut, rampeVolcan, volcanoGeometry,
  type SliceProfile, type VolcanoProfile,
} from '../src/track/slices';

// Config figée : les valeurs de référence ci-dessous en dépendent (la calibration peut rejouer LAVA_MARGIN / L_ELAN).
const PINNED = { ...CONFIG, V_JUMP: 10, LAVA_MARGIN: 0.8, L_ELAN: 6, RAMP_FOOT_RADIUS: 10 };
/** Pied de rampe d'avant la tâche 5c : pli 0° → 22°, sans congé (RAMP_FOOT_RADIUS 0). */
const SHARP = { ...PINNED, RAMP_FOOT_RADIUS: 0 };
const DEG = Math.PI / 180;
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
    fosse: fosse(PINNED),
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
    const max: Record<string, number> = { 'rampe-saut': 1, 'rampe-volcan': 2, fosse: 2 };
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

/** Volcan d'un profil de tremplin (le test échoue si le profil n'en porte pas). */
function tremplinOf(p: SliceProfile): Extract<VolcanoProfile, { kind: 'tremplin' }> {
  if (p.volcano?.kind !== 'tremplin') throw new Error(`profil ${p.type} sans tremplin`);
  return p.volcano;
}

describe('rampe-volcan : géométrie du profil', () => {
  const p = rampeVolcan(PINNED);
  const v = tremplinOf(p);
  const g = volcanoGeometry(PINNED);
  const at = (x: number) => p.heights[Math.round(x / S) - 1];
  const tanM = Math.tan(PINNED.MAX_SLOPE);

  test('infos de volcan cohérentes avec volcanoGeometry (depuis le début de tranche)', () => {
    expect(v.kind).toBe('tremplin');
    expect(v.dxLancement).toBe(0);
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

  /** Congé du pied (tâche 5c) : tangent au plat d'élan en x1, à la rampe en x2 ; arc de rayon R entre les deux. */
  const R = PINNED.RAMP_FOOT_RADIUS;
  const x1 = v.dxRampStart - R * Math.tan(PINNED.RAMP_ANGLE / 2);
  const x2 = x1 + R * Math.sin(PINNED.RAMP_ANGLE);
  const arc = (x: number) => R - Math.sqrt(R * R - (x - x1) ** 2);
  const sharp = rampeVolcan(SHARP);

  test('plat de lancement et plat d\'élan à 0 sur [0, xRampStart − R tan(θ/2)], puis relevés par le congé sur leurs ≈ 1,94 derniers mètres', () => {
    // Lu sur le profil : dernier échantillon à 0 avant le pied ≈ 1,94 m avant xRampStart (à un pas près).
    const lastZero = p.heights.reduce((k, h, i) => ((i + 1) * S <= v.dxRampStart && h === 0 ? i : k), -1);
    const xLastZero = (lastZero + 1) * S;
    expect(v.dxRampStart - xLastZero).toBeGreaterThanOrEqual(1.944 - EPS);
    expect(v.dxRampStart - xLastZero).toBeLessThan(1.944 + S);
    const kFlat = Math.floor(x1 / S + EPS);                 // échantillons 1..kFlat en x ≤ x1
    expect(kFlat).toBeGreaterThan(0);
    expect(p.heights.slice(0, kFlat).every((h) => h === 0)).toBe(true);
    expect(at(v.dxElanStart)).toBe(0);
    expect(at(v.dxElanStart + g.lElan / 2)).toBe(0);
    // Fin du plat d'élan relevée : chaque échantillon de ]x1, xRampStart] est sur l'arc, au-dessus de 0.
    const raised = p.heights.map((h, i) => ({ x: (i + 1) * S, h })).filter(({ x }) => x > x1 + EPS && x <= v.dxRampStart);
    expect(raised.length).toBeGreaterThan(5);
    for (const { x, h } of raised) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeCloseTo(arc(x), 9);
    }
    // Au droit de l'ancien pli, le sol du profil (interpolé entre deux échantillons) est relevé de
    // R − √(R² − (R tan(θ/2))²) ≈ 0,19 m.
    const k = Math.floor(v.dxRampStart / S + EPS);          // échantillon en k × S ≤ xRampStart < (k + 1) × S
    const w = v.dxRampStart / S - k;
    const hFoot = (1 - w) * p.heights[k - 1] + w * p.heights[k];
    expect(hFoot).toBeCloseTo(0.191, 2);
  });

  test('premier point de rampe : sur l\'arc du congé, au-dessus de l\'ancienne rampe rectiligne', () => {
    const k = Math.floor(v.dxRampStart / S + EPS) + 1;      // premier échantillon au-delà de xRampStart
    const x = k * S;
    expect(x).toBeLessThan(x2);
    expect(p.heights[k - 1]).toBeCloseTo(arc(x), 9);
    expect(p.heights[k - 1]).toBeGreaterThan((x - v.dxRampStart) * Math.tan(PINNED.RAMP_ANGLE));
    expect(sharp.heights[k - 1]).toBeCloseTo((x - v.dxRampStart) * Math.tan(PINNED.RAMP_ANGLE), 9);
  });

  test('au-delà du congé : rampe rectiligne, sommet (dxLip, lipY), lave et réception identiques au pied sans congé', () => {
    expect(v).toEqual(sharp.volcano);
    expect(p.length).toBe(sharp.length);
    expect(p.exemptIndices).toEqual(sharp.exemptIndices);
    p.heights.forEach((h, i) => {
      const x = (i + 1) * S;
      if (x >= x2 - EPS || x <= x1 + EPS) expect(h, `x = ${x.toFixed(1)}`).toBe(sharp.heights[i]);
      else expect(h, `x = ${x.toFixed(1)}`).toBeGreaterThanOrEqual(sharp.heights[i]);
    });
    expect(Math.max(...p.heights)).toBe(Math.max(...sharp.heights));
  });

  test('congé : pente continue de 0 à RAMP_ANGLE, pas de pli au pied (variation ≤ 1,5° par segment ; 22° sans congé)', () => {
    const kFrom = Math.floor(v.dxElanStart / S + EPS);
    const kTo = Math.floor(v.dxLip / S + EPS) - 1;           // dernier segment entièrement sur la rampe
    const kink = (heights: number[]) => {
      let maxTurn = 0; let maxSlope = 0; let minSlope = Infinity;
      for (let k = kFrom + 1; k <= kTo; k++) {
        const a = Math.atan((heights[k - 1] - heights[k - 2]) / S);
        const b = Math.atan((heights[k] - heights[k - 1]) / S);
        maxTurn = Math.max(maxTurn, Math.abs(b - a));
        maxSlope = Math.max(maxSlope, b); minSlope = Math.min(minSlope, b);
      }
      return { maxTurn, maxSlope, minSlope };
    };
    const filleted = kink(p.heights);
    expect(filleted.maxTurn).toBeLessThanOrEqual(1.5 * DEG);
    expect(filleted.maxSlope).toBeLessThanOrEqual(PINNED.RAMP_ANGLE + EPS);
    expect(filleted.minSlope).toBeGreaterThanOrEqual(0);
    expect(kink(sharp.heights).maxTurn).toBeGreaterThan(15 * DEG);
  });

  test('RAMP_FOOT_RADIUS 0 : pli d\'origine, plats à 0 sur [0, lLancement + lElan] et rampe rectiligne dès le pied', () => {
    const kLast = Math.floor((g.lLancement + g.lElan) / S + EPS);
    expect(kLast).toBeGreaterThan(0);
    expect(sharp.heights.slice(0, kLast).every((h) => h === 0)).toBe(true);
    // la rampe monte dès l'échantillon suivant (heights[i] = f((i + 1) × S))
    expect(sharp.heights[kLast]).toBeGreaterThan(0);
    expect(sharp.heights[kLast]).toBeCloseTo(((kLast + 1) * S - (g.lLancement + g.lElan)) * Math.tan(PINNED.RAMP_ANGLE), 9);
  });

  test('lance si le congé dépasse le plat d\'élan ou atteint le sommet', () => {
    expect(() => rampeVolcan({ ...PINNED, L_ELAN: 1.5 })).toThrow(/congé/);
    expect(() => rampeVolcan({ ...PINNED, L_ELAN: 12, RAMP_FOOT_RADIUS: 32 })).toThrow(/congé/);
    expect(() => rampeVolcan({ ...PINNED, L_ELAN: 3 })).not.toThrow();
  });

  test('le congé ne touche que la rampe-volcan : rampe-saut identique avec ou sans', () => {
    expect(rampeSaut(mulberry32(1), PINNED)).toEqual(rampeSaut(mulberry32(1), SHARP));
  });

  test('sommet de rampe à lipY, fond de lave à RIM − CRATER_DEPTH', () => {
    // dxLip est hors grille : l'échantillon le plus proche est à moins de S/2 du sommet, sur la rampe
    // (pente tan RAMP_ANGLE) ou la descente (pente tan MAX_SLOPE).
    const kLip = Math.round(v.dxLip / S);
    const tol = (Math.tan(PINNED.MAX_SLOPE) * S) / 2 + EPS;
    expect(Math.abs(p.heights[kLip - 1] - g.lipY)).toBeLessThanOrEqual(tol);
    expect(Math.max(...p.heights)).toBeLessThanOrEqual(g.lipY + EPS);
    expect(Math.max(...p.heights)).toBeGreaterThanOrEqual(g.lipY - tol);
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

describe('fosse (tâche 5g, saut §6.2, ruling R-F2)', () => {
  const p = fosse(CONFIG);
  const g = fosseGeometry(CONFIG);
  const v = p.volcano;
  if (v?.kind !== 'fosse') throw new Error('fosse sans volcan de sorte fosse');
  /** Hauteur de l'échantillon en x (x sur la maille, x > 0). */
  const at = (x: number): number => p.heights[Math.round(x / S) - 1];
  const onGrid = (x: number): boolean => Math.abs(x / S - Math.round(x / S)) < 1e-6;

  test('longueur égale à celle de la rampe-volcan (125,2 m), type « fosse », sans tirage', () => {
    expect(p.type).toBe('fosse');
    expect(p.length).toBeCloseTo(rampeVolcan(CONFIG).length, 9);
    expect(g.length).toBeCloseTo(p.length, 9);
    expect(p.length).toBeCloseTo(125.2, 9);
    expect(fosse(CONFIG)).toEqual(p);
  });

  test('garde de 20 m, approche LANCEMENT_LENGTH (à la maille supérieure), lave de 8 m, réception ≥ 60 m (64,8 m)', () => {
    expect(g.guard).toBeCloseTo(CONFIG.FOSSE_GUARD, 9);
    expect(g.approach).toBeGreaterThanOrEqual(CONFIG.LANCEMENT_LENGTH - 1e-9);
    expect(g.approach).toBeLessThan(CONFIG.LANCEMENT_LENGTH + S);
    expect(g.width).toBeCloseTo(CONFIG.FOSSE_WIDTH, 9);
    expect(g.reception).toBeGreaterThanOrEqual(60);
    expect(g.reception).toBeCloseTo(64.8, 9);
    expect(g.guard + g.approach + g.width + g.reception).toBeCloseTo(g.length, 9);
    expect(v.dxLancement).toBeCloseTo(g.guard, 9);
    expect(v.dxBord).toBeCloseTo(g.guard + g.approach, 9);
    expect(v.dxLava).toBeCloseTo(v.dxBord + g.width / 2, 9);
    expect(v.lavaWidth).toBeCloseTo(g.width, 9);
    expect(v.rimY).toBe(0);
    expect(v.dxReception).toBeCloseTo(v.dxBord + g.width, 9);
    expect(v.dxEnd).toBeCloseTo(p.length, 9);
  });

  test('bords sur la maille', () => {
    for (const x of [v.dxLancement, v.dxBord, v.dxReception, v.dxEnd]) expect(onGrid(x), `x = ${x}`).toBe(true);
  });

  test('hauteur 0 sur [début, xBord] et sur [xReception, xEnd] (aucune lèvre, aucune pente), −CRATER_DEPTH dans la fosse', () => {
    const bad: number[] = [];
    p.heights.forEach((h, k) => {
      const x = (k + 1) * S;
      const inside = x > v.dxBord + 1e-9 && x < v.dxReception - 1e-9;
      if (inside ? Math.abs(h + CONFIG.CRATER_DEPTH) > 1e-12 : h !== 0) bad.push(x);
    });
    expect(bad).toEqual([]);
    expect(at(v.dxBord)).toBe(0);
    expect(at(v.dxBord + S)).toBe(-CONFIG.CRATER_DEPTH);
    expect(at(v.dxReception - S)).toBe(-CONFIG.CRATER_DEPTH);
    expect(at(v.dxReception)).toBe(0);
  });

  test('deux parois verticales exemptées, exactement (segments qui arrivent en xBord + maille et en xReception)', () => {
    expect([...p.exemptIndices].sort((a, b) => a - b)).toEqual([Math.round(v.dxBord / S), Math.round(v.dxReception / S) - 1]);
  });

  test('lance si la réception tombe sous 60 m', () => {
    expect(() => fosseGeometry({ ...CONFIG, FOSSE_WIDTH: 14 })).toThrow(/réception/);
    expect(() => fosse({ ...CONFIG, FOSSE_GUARD: 30 })).toThrow(/réception/);
    expect(() => fosseGeometry({ ...CONFIG, FOSSE_WIDTH: 10 })).not.toThrow();
  });
});

describe('plat étoile (tâche 5e, saut §6.6)', () => {
  test('platEtoile : tranche « plat-étoile » de STAR_FLAT_LENGTH (57 m) à la maille, hauteur 0, sans exemption ni tirage', () => {
    const p = platEtoile(CONFIG);
    expect(p.type).toBe('plat-étoile');
    expect(p.length).toBeCloseTo(CONFIG.STAR_FLAT_LENGTH, 9);
    expect(p.heights).toHaveLength(Math.round(CONFIG.STAR_FLAT_LENGTH / CONFIG.TRACK_POINT_SPACING));
    expect(p.heights.every((h) => h === 0)).toBe(true);
    expect(p.exemptIndices).toEqual([]);
    expect(p.volcano).toBeUndefined();
  });
});
