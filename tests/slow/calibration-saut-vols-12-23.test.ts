// Budget : < 25 min mur (mesuré : 3 min 18 s pour les deux fichiers de vols ensemble, ≈ 6 min avec les autres calibrations).
// Calibration des étoiles hautes (plan B, tâche 5e, Step 8 (c)) : vols, graines 12 à 23. Une course enregistrée
// par graine à 5 voitures, doigt posé, sans saut et sans étoile haute (STAR_HIGH_PER_RACE 0, étoiles basses
// identiques) ; puis, pour chacun des 144 jeux (dégagement rampe-saut {50, 60, 70, 80}, bosses {8, 12, 16}, élan
// {10, 15, 20}, atterrissage {10, 15, 20, 25}), placement statique recalculé et garde hors ligne de chaque étoile
// haute placée, à chaque hauteur de 3,60 à 4,05 m (`clearanceProfile`, marge 5 cm). Mesure : seule la fin du
// balayage est assertée. Sortie : tests/slow/out/calibration-saut-vols-12-23.json.
import { describeVols, expectNonVacuous, RECORD_CFG, volsForSeeds, writeOut } from '../helpers/calibration-saut';
import { recordRace } from '../helpers/recorded';

const SEEDS = Array.from({ length: 23 - 12 + 1 }, (_, i) => 12 + i);

test('vols à 5 voitures doigt posé, graines 12 à 23 : garde des étoiles hautes de chaque jeu, à chaque hauteur', () => {
  expectNonVacuous(SEEDS);
  const rows = volsForSeeds(SEEDS, (seed) => recordRace(seed, { robots: true, cfg: RECORD_CFG }));
  console.log(`vols, graines 12 à 23 :\n${describeVols(rows)}`);
  console.log(rows.map((r) => `g${r.seed} arrivées ${r.finishedAt.map((t) => (t === null ? '—' : t.toFixed(1))).join('/')} s, `
    + `réapparitions ${r.respawns.join('/')}, lave ${r.lava.join('/')}`).join('\n'));
  writeOut('calibration-saut-vols-12-23', rows);
  expect(rows).toHaveLength(SEEDS.length);
  for (const r of rows) {
    expect(Object.keys(r.jeux)).toHaveLength(144);
    expect(Object.values(r.profiles).every((p) => p.min.every(Number.isFinite)), `graine ${r.seed}`).toBe(true);
  }
});
