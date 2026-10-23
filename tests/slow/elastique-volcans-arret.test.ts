// Budget : < 15 min mur (24 courses à 5 voitures de 90 s, ≈ 9 s chacune : ≈ 4 min ESTIMÉ). Galahad arrêté, copains
// derrière (plan B, tâche 7, Step 4 ; R7-12 ; ruling du coordinateur : on compte les réapparitions de Galahad après un
// contact avec un copain, CONTACT_WINDOW = 5 s ; décision du papa (1) des relectures de la tâche 7 : un copain à moins
// de POLITE_GAP derrière Galahad doigt levé lève le pied, `ai/driver.ts`). Galahad doigt levé 10 s à t = 40 et 70 s, saut
// parfait aux fosses, 90 s, graines 0 à 23. Exigé : 0 réapparition de Galahad après un contact avec un copain sur les
// graines 0 à 4 (le cas du Step 4) ; imprimé : graines 0 à 23 (la sonde), réapparitions de Galahad et leur cause (les
// chutes sans contact viennent de l'arrêt lui-même : doigt levé, il s'arrête devant un volcan), impacts sur Galahad
// arrêté (vitesse relative au pas d'avant le contact ; repères : 10,8 m/s avec la fenêtre de 12 m, 12,2 sans élastique),
// vx maximale d'un copain dans les 2 s après un contact. Avant le tour 1 (sans la règle) : graine 3, Galahad poussé par
// Timothé puis couché, réapparition « side » à 77 s ; sonde 0 à 23 : 11 réapparitions, dont 1 après un contact.
import { CONFIG } from '../../src/config';
import { toM } from '../../src/physics/units';
import { carPairsTouching } from '../../src/sim/harness';
import { CONTACT_WINDOW, fiveCarRace } from '../helpers/race';
import { f1, f2 } from '../helpers/runs';

const SEEDS = Array.from({ length: 24 }, (_, i) => i);
/** Graines où l'exigence porte (le cas du Step 4). */
const REQUIRED = [0, 1, 2, 3, 4];
const stopped = (t: number): boolean => (t >= 40 && t < 50) || (t >= 70 && t < 80);

interface StopRace { seed: number; respawns: number; byCopain: number; impacts: number[]; vxAfter: number; row: string }

/** Une course de la sonde : réapparitions de Galahad (cause), impacts sur Galahad arrêté, vx d'un copain après un contact. */
function stopRace(seed: number): StopRace {
  const prevV = new Map<string, number>();
  const lastTouch = new Map<string, number>();
  const lastAny = new Map<string, number>();
  const impacts: number[] = [];
  const mine: string[] = [];
  const causes: string[] = [];
  let lastG = -Infinity;
  let byCopain = 0;
  let vxAfter = 0;
  const race = fiveCarRace(seed, {
    maxSeconds: 90, throttle: (t) => !stopped(t),
    observe: (sim) => {
      const t = sim.time;
      for (const [a, b] of carPairsTouching(sim)) {
        lastAny.set(a, t); lastAny.set(b, t);
        if (a !== 'galahad' && b !== 'galahad') continue;
        lastG = t;
        const other = a === 'galahad' ? b : a;
        // Choc sur Galahad pendant un arrêt (ou dans les 2 s qui suivent) : vitesse relative au pas d'avant le contact.
        if (t - (lastTouch.get(other) ?? -Infinity) > 0.5 && (stopped(t) || stopped(t - 2))) {
          const vg = prevV.get('galahad') ?? 0;
          const rel = Math.abs((prevV.get(other) ?? 0) - vg);
          impacts.push(rel);
          mine.push(`${other} à ${f1(t)} s : ${f1(rel)} m/s (Galahad à ${f1(vg)} m/s)`);
        }
        lastTouch.set(other, t);
      }
      for (const e of sim.events) {
        if (e.type !== 'respawn' || e.carId !== 'galahad') continue;
        const contact = t - lastG <= CONTACT_WINDOW;
        if (contact) byCopain++;
        causes.push(`${e.reason} à ${f1(t)} s, x ${f1(e.x)}, ${contact ? `contact avec un copain ${f2(t - lastG)} s avant` : `sans contact depuis ${CONTACT_WINDOW} s`}`);
      }
      for (const car of sim.cars) {
        const vx = toM(car.body.chassis.velocity.x) / CONFIG.PHYSICS_DT;
        prevV.set(car.state.id, vx);
        if (car.state.id !== 'galahad' && t - (lastAny.get(car.state.id) ?? -Infinity) <= 2) vxAfter = Math.max(vxAfter, vx);
      }
    },
  });
  const respawns = race.r.respawnsByCar.galahad.length;
  const row = `g${seed} : réapparitions de Galahad ${respawns}${causes.length ? ` (${causes.join(' ; ')})` : ''}, impacts sur Galahad arrêté [${mine.join(' ; ')}]`;
  return { seed, respawns, byCopain, impacts, vxAfter, row };
}

const describeSet = (label: string, rs: StopRace[]): string => {
  const im = rs.flatMap((r) => r.impacts).sort((a, b) => a - b);
  return `${label} : réapparitions de Galahad ${rs.reduce((a, r) => a + r.respawns, 0)}, dont ${rs.reduce((a, r) => a + r.byCopain, 0)} après un contact `
    + `avec un copain ; ${im.length} impacts sur Galahad arrêté, max ${f1(im.length ? im[im.length - 1] : NaN)} m/s, médiane ${f1(im.length ? im[Math.floor(im.length / 2)] : NaN)} m/s ; `
    + `vx max d'un copain dans les 2 s après un contact ${f1(Math.max(...rs.map((r) => r.vxAfter)))} m/s`;
};

test('Galahad doigt levé 10 s à t = 40 et 70 s, copains derrière (sonde, graines 0 à 23) : 0 réapparition de Galahad après un contact avec un copain sur les graines 0 à 4', () => {
  const rows = SEEDS.map(stopRace);
  const required = rows.filter((r) => REQUIRED.includes(r.seed));
  console.log(`Galahad arrêté, copains derrière (repères des impacts : 10,8 m/s avec la fenêtre de 12 m, 12,2 sans élastique)\n`
    + `${describeSet('graines 0 à 4', required)}\n${describeSet('graines 0 à 23', rows)}\n  ${rows.map((r) => r.row).join('\n  ')}`);
  expect(required.map((r) => r.byCopain), required.map((r) => r.row).join('\n')).toEqual(REQUIRED.map(() => 0));
});
