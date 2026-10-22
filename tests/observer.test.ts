// Les observateurs `onStep` des harnais (tâche 5c) sont sans effet : même course, même run, avec et sans.
// simulateRace : l'observateur de la course à 5 (contacts entre voitures, classement des chutes) ;
// runFrom : l'observateur de l'échantillonnage des phases (phaseRun : positions, contacts avec la lave).
import { simulateRace, type SimulateResult } from '../src/sim/harness';
import { tremplins } from '../src/track/query';
import { REFERENCE, historiesFor, phaseRun, variantTrack, volcanoWorld } from './helpers/phases';
import { fiveCarOptions, fiveCarRace } from './helpers/race';
import { runFrom } from './helpers/runs';

const SEED = 1;

/** Résultat comparable : sans les durées mur (meanStepMs, maxStepMs), fonctions échantillonnées. */
function comparable(r: SimulateResult): unknown {
  const { meanStepMs: _m, maxStepMs: _x, progressAt, speedAt, ...rest } = r;
  const ts = Array.from({ length: Math.floor(r.time) + 1 }, (_, i) => i);
  return { ...rest, progress: ts.map(progressAt), speed: ts.map(speedAt) };
}

test(`simulateRace à 5 voitures, graine ${SEED}, 12 s : même résultat avec et sans l'observateur de fiveCarRace`, () => {
  // Mêmes pistes des deux côtés (relecture standard M5) : celles du candidat de référence.
  const track = variantTrack(SEED, REFERENCE);
  const observed = fiveCarRace(SEED, { maxSeconds: 12, cfg: REFERENCE.cfg }).r;
  const plain = simulateRace(track, fiveCarOptions({ maxSeconds: 12, cfg: REFERENCE.cfg }, track));
  expect(observed.time).toBeGreaterThan(11);
  expect(comparable(observed)).toEqual(comparable(plain));
});

test(`runFrom, graine ${SEED}, premier volcan : même run avec et sans l'observateur de phaseRun`, () => {
  const track = variantTrack(SEED, REFERENCE);
  const v = tremplins(track)[0];
  const world = volcanoWorld(SEED, 0, REFERENCE);
  const hs = historiesFor(SEED, 0, track, REFERENCE.cfg, { perWindow: 1, motifs: 1, turbos: 1, dense: true });
  for (const h of [hs[0], hs.find((x) => x.family === 'turbo')!, hs.find((x) => x.family === 'turbo dense')!]) {
    // L'observateur reçoit la voiture : phaseRun la lit (positions, collisions avec la lave) sans la modifier.
    const sample = phaseRun(world, v, h, SEED, 0, REFERENCE.cfg);
    const plain = runFrom(world, h.x0, h.opts);
    const observed = runFrom(world, h.x0, { ...h.opts, onStep: () => {} });
    expect(observed, h.label).toEqual(plain);
    expect(sample.lipSpeed, h.label).toBe(plain.lipSpeed);
    expect(sample.landX, h.label).toBe(plain.landX);
    expect(sample.steps, h.label).toBe(Math.round(plain.seconds / REFERENCE.cfg.PHYSICS_DT));
  }
});
