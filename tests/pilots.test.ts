import { CONFIG } from '../src/config';
import { GALAHAD, PILOTS, drawPilots } from '../src/cars/pilots';
import type { Pilot } from '../src/cars/pilots';

const NOMS = ['Pablo', 'Diego', 'Timothé', 'Matthis', 'Malo', 'Liam'];
/**
 * Arrêt le plus clair du dégradé du ciel (#000000 → #0a1030, prerenderSky dans
 * src/render/background.ts). Les couleurs testées sont plus claires que le ciel : le pire
 * contraste est donc contre cet arrêt.
 */
const CIEL = 0x0a1030;
/** Les 7 voitures : les 6 copains, puis Galahad. */
const TOUS: readonly Pilot[] = [...PILOTS, GALAHAD];

const canaux = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Plus grand écart sur une composante R, V ou B entre deux couleurs 0xRRGGBB. */
function ecartRVB(a: number, b: number): number {
  const [x, y] = [canaux(a), canaux(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - y[i])));
}

/** Distance RGB euclidienne entre deux couleurs 0xRRGGBB. */
function distance(a: number, b: number): number {
  const [x, y] = [canaux(a), canaux(b)];
  return Math.hypot(...x.map((v, i) => v - y[i]));
}

/** Luminance relative WCAG 2.x d'une couleur 0xRRGGBB. */
function luminance(c: number): number {
  const [r, g, b] = canaux(c).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2.x entre deux couleurs (de 1 à 21). */
function contraste(a: number, b: number): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

/** Toutes les paires {a, b} d'une liste, chaque paire une seule fois. */
function paires<T>(items: readonly T[]): [T, T][] {
  return items.flatMap((a, i) => items.slice(i + 1).map((b): [T, T] => [a, b]));
}

/** Libellés « A / B » des couples pour lesquels `ok` est faux : [] si tout va bien, sinon le test nomme les fautifs. */
function enDefaut(couples: readonly [Pilot, Pilot][], ok: (a: Pilot, b: Pilot) => boolean): string[] {
  return couples.filter(([a, b]) => !ok(a, b)).map(([a, b]) => `${a.name} / ${b.name}`);
}

const ids = (pilotes: readonly Pilot[]) => pilotes.map((p) => p.id);

describe('PILOTS', () => {
  test('6 pilotes, dans l’ordre Pablo, Diego, Timothé, Matthis, Malo, Liam', () => {
    expect(PILOTS.map((p) => p.name)).toEqual(NOMS);
  });

  test('l’id est le prénom en minuscules, et il est unique', () => {
    expect(ids(PILOTS)).toEqual(NOMS.map((n) => n.toLowerCase()));
    expect(new Set(ids(PILOTS)).size).toBe(PILOTS.length);
  });

  test('base ∈ [0,97 ; 1] (décision D7-3 du papa, tâche 7) et lift ∈ [0 ; 0,6] pour chaque pilote', () => {
    for (const p of PILOTS) {
      expect(p.base, `${p.name}.base`).toBeGreaterThanOrEqual(0.97);
      expect(p.base, `${p.name}.base`).toBeLessThanOrEqual(1);
      expect(p.lift, `${p.name}.lift`).toBeGreaterThanOrEqual(0);
      expect(p.lift, `${p.name}.lift`).toBeLessThanOrEqual(0.6);
    }
  });

  test('base des copains, décision D7-3 du papa (2026-10-23) : Pablo 1,00, Matthis 0,995, Malo 0,9875, Diego 0,985, Liam 0,975, Timothé 0,97', () => {
    // Caractère de vitesse regroupé près de 1 (élastique, tâche 7) : le caractère est porté par lift, jumpTry et jumpSkill.
    expect(Object.fromEntries(PILOTS.map((p) => [p.id, p.base]))).toEqual({
      pablo: 1, matthis: 0.995, malo: 0.9875, diego: 0.985, liam: 0.975, 'timothé': 0.97,
    });
  });

  test('caractères cohérents : triés par base décroissante, le lift croît strictement', () => {
    // Plus un pilote fonce (base haute), moins il lève le pied (lift bas) : 2 fonceurs, 2 moyens, 2 prudents.
    const tries = [...PILOTS].sort((a, b) => b.base - a.base);
    for (let i = 1; i < tries.length; i++) {
      expect(tries[i].base, `${tries[i].name} après ${tries[i - 1].name} : base strictement décroissante`).toBeLessThan(tries[i - 1].base);
      expect(tries[i].lift, `${tries[i].name} après ${tries[i - 1].name}`).toBeGreaterThan(tries[i - 1].lift);
    }
  });

  test('le tableau et ses entrées sont figés (aucun appelant ne peut les modifier)', () => {
    expect(Object.isFrozen(PILOTS)).toBe(true);
    for (const p of PILOTS) expect(Object.isFrozen(p), p.name).toBe(true);
    expect(() => (PILOTS as Pilot[]).push(PILOTS[0])).toThrow(TypeError);
    expect(() => ((PILOTS[0] as { base: number }).base = 0)).toThrow(TypeError);
  });
});

describe('couleurs', () => {
  test('carrosseries distinctes deux à deux, Galahad compris (écart ≥ 120 sur R, V ou B)', () => {
    expect(enDefaut(paires(TOUS), (a, b) => ecartRVB(a.color, b.color) >= 120)).toEqual([]);
  });

  test('aucune carrosserie de copain n’est bleue, cyan, turquoise ou violette : ≥ 200 (RGB euclidien) du bleu de Galahad', () => {
    const fautifs = PILOTS.filter((p) => distance(p.color, GALAHAD.color) < 200).map((p) => p.name);
    expect(fautifs).toEqual([]);
  });

  test('le casque de chaque copain est une nuance de sa carrosserie : à ≥ 40 d’elle, et plus près d’elle que de toute autre carrosserie (Galahad compris)', () => {
    // Galahad est exclu : son casque rouge reprend les bandes du plan A, pas sa carrosserie bleue.
    for (const p of PILOTS) {
      const propre = distance(p.helmet, p.color);
      expect(propre, `${p.name} : casque / sa carrosserie`).toBeGreaterThanOrEqual(40);
      for (const o of TOUS.filter((autre) => autre !== p)) {
        expect(propre, `${p.name} : casque plus près de sa carrosserie que de celle de ${o.name}`).toBeLessThan(
          distance(p.helmet, o.color),
        );
      }
    }
  });

  test('casques distincts deux à deux, Galahad compris (≥ 60, RGB euclidien)', () => {
    expect(enDefaut(paires(TOUS), (a, b) => distance(a.helmet, b.helmet) >= 60)).toEqual([]);
  });

  test('carrosserie, casque et bandes des copains ont un contraste WCAG ≥ 3:1 contre le ciel (arrêt le plus clair du dégradé)', () => {
    const fautifs = PILOTS.flatMap((p) =>
      (['color', 'helmet', 'accent'] as const)
        .filter((k) => contraste(p[k], CIEL) < 3)
        .map((k) => `${p.name}.${k} ${contraste(p[k], CIEL).toFixed(2)}`),
    );
    expect(fautifs).toEqual([]);
  });

  test('les bandes de chaque copain sont à ≥ 60 (RGB euclidien) de toutes les carrosseries : la sienne et celles des 6 autres voitures', () => {
    // Les bandes sont dessinées sur la carrosserie du copain : elles doivent s’y voir aussi.
    const couples = PILOTS.flatMap((p) => TOUS.map((o): [Pilot, Pilot] => [p, o]));
    expect(enDefaut(couples, (p, o) => distance(p.accent, o.color) >= 60)).toEqual([]);
  });
});

describe('GALAHAD', () => {
  test('id « galahad », bleu et rouge repris de CONFIG (source unique), casque rouge', () => {
    expect(GALAHAD.id).toBe('galahad');
    expect(GALAHAD.name).toBe('Galahad');
    expect(GALAHAD.color).toBe(CONFIG.GALAHAD_COLOR);
    expect(GALAHAD.accent).toBe(CONFIG.GALAHAD_ACCENT);
    expect(GALAHAD.helmet).toBe(CONFIG.GALAHAD_ACCENT);
    expect(CONFIG.GALAHAD_COLOR).toBe(0x1e5cff);
    expect(CONFIG.GALAHAD_ACCENT).toBe(0xe2231a);
  });

  test('base 1 et lift 0 : valeurs neutres, le pilote automatique ne le conduit pas', () => {
    expect(GALAHAD.base).toBe(1);
    expect(GALAHAD.lift).toBe(0);
  });

  test('jumpTry 0 et jumpSkill 0 (tâche 6) : c’est l’enfant qui saute', () => {
    expect(GALAHAD.jumpTry).toBe(0);
    expect(GALAHAD.jumpSkill).toBe(0);
  });

  test('n’est pas dans PILOTS', () => {
    expect(PILOTS).not.toContain(GALAHAD);
    expect(ids(PILOTS)).not.toContain('galahad');
  });
});

describe('traits de saut (tâche 6, décision P4 du papa : tableau gardé)', () => {
  const par = (id: string): Pilot => PILOTS.find((p) => p.id === id)!;
  const FONCEURS = ['pablo', 'matthis'].map(par);
  const MOYENS = ['diego', 'malo'].map(par);
  const PRUDENTS = ['timothé', 'liam'].map(par);
  const min = (ps: Pilot[], k: 'jumpTry' | 'jumpSkill') => Math.min(...ps.map((p) => p[k]));
  const max = (ps: Pilot[], k: 'jumpTry' | 'jumpSkill') => Math.max(...ps.map((p) => p[k]));

  test('valeurs validées : Pablo 0,80 / 0,18, Matthis 0,75 / 0,15, Diego 0,55 / 0,10, Malo 0,50 / 0,09, Timothé 0,30 / 0,04, Liam 0,30 / 0,05', () => {
    expect(Object.fromEntries(PILOTS.map((p) => [p.id, [p.jumpTry, p.jumpSkill]]))).toEqual({
      pablo: [0.8, 0.18], matthis: [0.75, 0.15], diego: [0.55, 0.1], malo: [0.5, 0.09], 'timothé': [0.3, 0.04], liam: [0.3, 0.05],
    });
  });

  test('bornes : jumpTry ∈ [0 ; 1], jumpSkill ∈ [0,02 ; 0,25] s', () => {
    for (const p of PILOTS) {
      expect(p.jumpTry, `${p.name}.jumpTry`).toBeGreaterThanOrEqual(0);
      expect(p.jumpTry, `${p.name}.jumpTry`).toBeLessThanOrEqual(1);
      expect(p.jumpSkill, `${p.name}.jumpSkill`).toBeGreaterThanOrEqual(0.02);
      expect(p.jumpSkill, `${p.name}.jumpSkill`).toBeLessThanOrEqual(0.25);
    }
  });

  test('jumpTry : fonceurs > moyens > prudents (ils tentent plus souvent)', () => {
    expect(min(FONCEURS, 'jumpTry')).toBeGreaterThan(max(MOYENS, 'jumpTry'));
    expect(min(MOYENS, 'jumpTry')).toBeGreaterThan(max(PRUDENTS, 'jumpTry'));
  });

  test('jumpSkill : prudents < moyens < fonceurs (les prudents visent juste)', () => {
    expect(max(PRUDENTS, 'jumpSkill')).toBeLessThan(min(MOYENS, 'jumpSkill'));
    expect(max(MOYENS, 'jumpSkill')).toBeLessThan(min(FONCEURS, 'jumpSkill'));
  });
});

describe('drawPilots', () => {
  test('tire 4 pilotes par défaut, sans doublon et jamais Galahad (graines 0 à 99)', () => {
    for (let seed = 0; seed < 100; seed++) {
      const tirage = drawPilots(seed);
      expect(tirage, `graine ${seed}`).toHaveLength(4);
      expect(new Set(ids(tirage)).size, `graine ${seed}`).toBe(4);
      expect(ids(tirage), `graine ${seed}`).not.toContain('galahad');
      for (const p of tirage) expect(PILOTS, `graine ${seed}`).toContain(p);
    }
  });

  test('même graine → mêmes pilotes, dans le même ordre', () => {
    for (const seed of [0, 1, 42, 99, 123456789]) {
      expect(ids(drawPilots(seed))).toEqual(ids(drawPilots(seed)));
      expect(ids(drawPilots(seed, 6))).toEqual(ids(drawPilots(seed, 6)));
    }
  });

  test('tirage figé : les graines 0 et 1 donnent toujours ces pilotes, dans cet ordre', () => {
    // Valeurs de l’implémentation actuelle : si elles changent, les courses déjà jouées ne se rejouent plus à l’identique.
    expect(ids(drawPilots(0))).toEqual(['diego', 'pablo', 'timothé', 'matthis']);
    expect(ids(drawPilots(1))).toEqual(['matthis', 'diego', 'malo', 'liam']);
  });

  test('graines 0 à 99 : chaque pilote apparaît au moins 20 fois', () => {
    const apparitions = new Map<string, number>(PILOTS.map((p) => [p.id, 0]));
    for (let seed = 0; seed < 100; seed++) {
      for (const p of drawPilots(seed)) apparitions.set(p.id, (apparitions.get(p.id) ?? 0) + 1);
    }
    for (const [id, n] of apparitions) expect(n, id).toBeGreaterThanOrEqual(20);
  });

  test('graines 0 à 999 : chaque pilote apparaît 607 à 727 fois (±4σ de 666,7) et au moins 300 tirages ordonnés distincts', () => {
    // Un mélange naïf biaisé (j = floor(rng() × n)) ou une simple rotation de la liste passent
    // « chaque pilote au moins 20 fois » ; le nombre de tirages ordonnés distincts (360 possibles) les distingue.
    const apparitions = new Map<string, number>(PILOTS.map((p) => [p.id, 0]));
    const tirages = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      const tirage = drawPilots(seed);
      tirages.add(ids(tirage).join(','));
      for (const p of tirage) apparitions.set(p.id, (apparitions.get(p.id) ?? 0) + 1);
    }
    for (const [id, n] of apparitions) {
      expect(n, id).toBeGreaterThanOrEqual(607);
      expect(n, id).toBeLessThanOrEqual(727);
    }
    expect(tirages.size).toBeGreaterThanOrEqual(300);
  });

  test('l’index i du tirage est le robot de rang i + 1 sur la grille (Galahad = rang 0) : chaque pilote peut prendre chaque rang', () => {
    const rangs = PILOTS.map(() => [0, 0, 0, 0]);
    for (let seed = 0; seed < 100; seed++) {
      drawPilots(seed).forEach((p, i) => rangs[PILOTS.indexOf(p)][i]++);
    }
    PILOTS.forEach((p, k) => {
      rangs[k].forEach((n, i) => expect(n, `${p.name} au rang ${i + 1}`).toBeGreaterThan(0));
    });
  });

  test('count = 0 → aucun pilote ; count = 6 → les 6 pilotes, mélangés', () => {
    expect(drawPilots(7, 0)).toEqual([]);
    for (let seed = 0; seed < 20; seed++) {
      expect(ids(drawPilots(seed, 6)).sort()).toEqual(ids(PILOTS).slice().sort());
    }
  });

  test('ne modifie pas PILOTS et renvoie un tableau que l’appelant peut modifier', () => {
    const avant = ids(PILOTS);
    const tirage = drawPilots(5, 6);
    tirage.reverse();
    tirage.pop();
    expect(ids(PILOTS)).toEqual(avant);
    expect(PILOTS).toHaveLength(6);
  });

  test('RangeError si count n’est pas un entier dans [0, 6]', () => {
    for (const count of [-1, 7, 1.5, 0.1, NaN, Infinity, -Infinity]) {
      expect(() => drawPilots(1, count), String(count)).toThrow(RangeError);
    }
  });

  test('RangeError si pilotSeed n’est pas un entier dans [0, 2³²) ; 0 et 2³² − 1 passent', () => {
    // mulberry32 fait `seed >>> 0` : sans cette garde, NaN, 0,5 ou 2³² donneraient en silence le tirage de la graine 0.
    for (const seed of [NaN, 0.5, -1, 2 ** 32, Infinity, -Infinity]) {
      expect(() => drawPilots(seed), String(seed)).toThrow(RangeError);
    }
    expect(() => drawPilots(0)).not.toThrow();
    expect(() => drawPilots(2 ** 32 - 1)).not.toThrow();
  });
});
