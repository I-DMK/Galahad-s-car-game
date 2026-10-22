// Budget : < 25 min mur (mesuré : 3 min 18 s pour les deux fichiers de vols ensemble, ≈ 6 min avec les autres calibrations).
// Calibration des étoiles hautes (plan B, tâche 5e, Step 8 (c)) : vols, graines 0 à 11. Une course enregistrée
// par graine à 5 voitures, doigt posé, sans saut et sans étoile haute (STAR_HIGH_PER_RACE 0, étoiles basses
// identiques) ; puis, pour chacun des 144 jeux (dégagement rampe-saut {50, 60, 70, 80}, bosses {8, 12, 16}, élan
// {10, 15, 20}, atterrissage {10, 15, 20, 25}), placement statique recalculé et garde hors ligne de chaque étoile
// haute placée, à chaque hauteur de 3,60 à 4,05 m (`clearanceProfile`, marge 5 cm). Mesure : seule la fin du
// balayage est assertée. Sortie : tests/slow/out/calibration-saut-vols-0-11.json. Ce fichier compte aussi, pour
// chaque jeu, les étoiles hautes des pistes des graines 0 à 49 (statique) : tests/slow/out/calibration-saut-comptes.json.
import { describeVols, expectNonVacuous, highXs, JEUX, jeuKey, RECORD_CFG, volsForSeeds, writeOut } from '../helpers/calibration-saut';
import { recordRace } from '../helpers/recorded';

const SEEDS = Array.from({ length: 11 - 0 + 1 }, (_, i) => 0 + i);

test('vols à 5 voitures doigt posé, graines 0 à 11 : garde des étoiles hautes de chaque jeu, à chaque hauteur', () => {
  expectNonVacuous(SEEDS);
  const rows = volsForSeeds(SEEDS, (seed) => recordRace(seed, { robots: true, cfg: RECORD_CFG }));
  console.log(`vols, graines 0 à 11 :\n${describeVols(rows)}`);
  console.log(rows.map((r) => `g${r.seed} arrivées ${r.finishedAt.map((t) => (t === null ? '—' : t.toFixed(1))).join('/')} s, `
    + `réapparitions ${r.respawns.join('/')}, lave ${r.lava.join('/')}`).join('\n'));
  writeOut('calibration-saut-vols-0-11', rows);
  expect(rows).toHaveLength(SEEDS.length);
  for (const r of rows) {
    expect(Object.keys(r.jeux)).toHaveLength(144);
    expect(Object.values(r.profiles).every((p) => p.min.every(Number.isFinite)), `graine ${r.seed}`).toBe(true);
  }
});

test('nombre d’étoiles hautes par course pour chaque jeu, graines 0 à 49 (placement statique)', () => {
  const seeds = Array.from({ length: 50 }, (_, i) => i);
  const rows = JEUX.map((j) => {
    const counts = seeds.map((seed) => highXs(seed, j).length);
    return {
      jeu: jeuKey(j), counts, mean: counts.reduce((a, b) => a + b, 0) / counts.length,
      min: Math.min(...counts), max: Math.max(...counts), withOne: counts.filter((n) => n > 0).length,
    };
  });
  console.log(`étoiles hautes par course (moyenne, min, max, pistes avec ≥ 1 / 50) :\n`
    + rows.map((r) => `${r.jeu} : ${r.mean.toFixed(2)}, ${r.min}, ${r.max}, ${r.withOne}/50`).join('\n'));
  writeOut('calibration-saut-comptes', rows);
  expect(rows).toHaveLength(144);
});
