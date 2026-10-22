// Étoiles basses des réceptions (plan B, tâche 5g, demande du papa) : sur la graine 14, une étoile au tout début de la
// réception du premier tremplin était survolée par toutes les voitures en turbo. Galahad doigt posé (saut parfait aux
// fosses) : chaque étoile basse d'une réception est prise, et l'atterrissage reste avant leur début, marge comprise.
// Graines 0 à 23 : tests/slow/race-sans-saut-*.test.ts.
import { trackFor } from './helpers/runs';
import { describeRow, expectReceptionStars, receptionRun } from './helpers/reception';

test('graine 14 : doigt posé, chaque étoile basse d’une réception est prise ; atterrissages avant leur début (marge 4 m)', () => {
  const { rows, respawns } = receptionRun(14, trackFor(14));
  console.log(`réceptions, graine 14 :\n  ${rows.map(describeRow).join('\n  ')}`);
  expect(respawns).toBe(0);
  expect(rows.length).toBeGreaterThanOrEqual(2);
  // Au moins une étoile de réception, prise (le test ne passe pas à vide).
  expect(rows.flatMap((w) => w.stars).filter((s) => s.taken).length).toBeGreaterThan(0);
  expectReceptionStars(rows);
});
