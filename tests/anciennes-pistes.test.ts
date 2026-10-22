// Pistes d'avant (plan B, tâche 5e, Step 10 ; addendum « bouton saut » §6.9) : `withAnciennesPistes(CONFIG)` redonne
// au bit près les pistes de e02dcae sans étoiles hautes (points, tranches, volcans, étoiles). sha1 mesuré sur le code
// de e02dcae (src/ identique à 4a414c6 et à 23a8db2) et collé ici. Si ce sha1 bouge, l'interrupteur ment : les tests
// qui comparent à une mesure d'avant (empreinte, PLAN_A_TRACE, PRE_5E_STARS, phases, dosage, calibration) ne
// prouvent plus rien.
import { CONFIG } from '../src/config';
import { generateTrack } from '../src/track/generate';
import type { Track } from '../src/track/types';
import { AP, ANCIENNES_PISTES, withAnciennesPistes } from './helpers/anciennes-pistes';

interface Hash { update(data: Uint8Array): Hash; digest(encoding: 'hex'): string }
const sha1 = (): Hash => (globalThis as unknown as {
  process: { getBuiltinModule(id: 'node:crypto'): { createHash(a: string): Hash } };
}).process.getBuiltinModule('node:crypto').createHash('sha1');

const f64 = (values: number[]): Uint8Array => new Uint8Array(Float64Array.from(values).buffer);
const text = (s: string): Uint8Array => new TextEncoder().encode(s);

/** sha1 d'une suite de pistes : Float64 des points, puis tranches (type et bornes), volcans (tous les champs), étoiles. */
function tracksSha1(tracks: Track[]): string {
  const h = sha1();
  for (const t of tracks) {
    h.update(f64([t.seed, t.targetLength, t.length, t.xStart, t.xFinish, t.xWall]));
    h.update(f64(t.points.flatMap((p) => [p.x, p.y])));
    h.update(f64(t.exemptPointIndices));
    for (const sl of t.slices) { h.update(text(sl.type)); h.update(f64([sl.xStart, sl.xEnd])); }
    for (const v of t.volcanoes) {
      // Pistes d'avant : que des tremplins (FOSSE_PERIOD 0) ; une fosse ferait échouer le sha1 par ce marqueur.
      if (v.kind !== 'tremplin') { h.update(text(`fosse ${v.xBord}`)); continue; }
      h.update(f64([v.xLancement, v.xElanStart, v.xRampStart, v.xLip, v.lipY, v.xLava, v.lavaWidth, v.rimY, v.xReception, v.xEnd]));
    }
    h.update(f64(t.stars.flatMap((s) => [s.id, s.x, s.y, s.high ? 1 : 0])));
  }
  return h.digest('hex');
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Pistes de e02dcae sans étoiles hautes (mesuré sur le code de e02dcae, tâche 5e Step 10). */
const FROZEN = {
  len1680: 'b1c5e5de8a56e948840024b461684af146f74442',
  len300: '9a49d7a6745fbcdec230ddfccfbe6a827823e970',
  len6000: 'b033f581f0a1e5b0944c6fca50a8c1abbf7a4ced',
};

describe('ANCIENNES_PISTES', () => {
  test('withAnciennesPistes ne pose que les clés connues de la configuration, sans toucher au reste', () => {
    const cfg = withAnciennesPistes(CONFIG);
    for (const [k, v] of Object.entries(ANCIENNES_PISTES)) {
      if (k in CONFIG) expect((cfg as Record<string, number>)[k], k).toBe(v);
      else expect(k in cfg, k).toBe(false);
    }
    for (const k of Object.keys(CONFIG) as (keyof typeof CONFIG)[]) {
      if (!(k in ANCIENNES_PISTES)) expect(cfg[k], k).toBe(CONFIG[k]);
    }
    expect(AP).toEqual(cfg);
  });

  test.each([
    ['len1680', 1680, range(50)],
    ['len300', 300, range(10)],
    ['len6000', 6000, range(10)],
  ] as const)('%s : pistes de e02dcae sans étoiles hautes, au bit près (sha1)', (key, len, seeds) => {
    const got = tracksSha1(seeds.map((seed) => generateTrack(seed, len, AP)));
    console.log(`pistes d'avant ${key} : ${got}`);
    expect(got).toBe(FROZEN[key]);
  });
});
