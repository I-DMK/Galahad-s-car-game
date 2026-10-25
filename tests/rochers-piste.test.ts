// Rochers posés par le générateur (plan C, tâche 11c ; spec « rochers » §3 et §6 « Statique »).
// La fixture `tests/fixtures/pistes-base.json` est le hash du terrain et des étoiles des pistes à BASE (9a0744a), avant
// tout changement du générateur : les rochers sont tirés après tout le reste, terrain et étoiles ne bougent pas.
import { CONFIG, type Config } from '../src/config';
import { generateTrack } from '../src/track/generate';
import BASE from './fixtures/pistes-base.json';
import { terrainHash } from './helpers/fingerprint';

const SANS_ROCHER: Config = { ...CONFIG, ROCKS_PER_RACE: 0 };
const FIXTURE = BASE as Record<string, string[]>;

test.each([[1680, 50], [300, 20], [600, 20], [1000, 20]])('%i m : terrain et étoiles identiques à BASE, avec CONFIG et avec ROCKS_PER_RACE = 0', (len, n) => {
  const expected = FIXTURE[String(len)];
  expect(expected).toHaveLength(n);
  for (let seed = 0; seed < n; seed++) {
    expect(terrainHash(generateTrack(seed, len, CONFIG)), `graine ${seed}, CONFIG`).toBe(expected[seed]);
    expect(terrainHash(generateTrack(seed, len, SANS_ROCHER)), `graine ${seed}, ROCKS_PER_RACE 0`).toBe(expected[seed]);
  }
});
