// Saut et piste (plan B, tâche 5e, tour de correction 1 ; décision du papa : « seule la piste compte ») :
// - la tolérance de sol se date sur la piste seule (sol, mur, écart roue-sol), jamais sur le toit d'un copain : pas de
//   nouveau saut depuis une autre voiture ;
// - le vol d'un saut ne compte pas comme un blocage : un saut depuis l'arrêt, gaz posé, vole ≈ 2,02 s sans avancer,
//   plus que STUCK_SECONDS (relecture adversariale : respawn « stuck » à l'atterrissage, série « même volcan » remise
//   à zéro, option B repoussée).
import Matter from 'matter-js';
import { CONFIG } from '../src/config';
import { worldToPhys } from '../src/physics/units';
import { CAT, carCategory } from '../src/physics/world';
import { createRaceSim, stepRace, type RaceSim, type RespawnEvent } from '../src/sim/simulate';
import { generateTrack } from '../src/track/generate';
import { heightAt, tremplins } from '../src/track/query';
import { trackFor } from './helpers/runs';

const STEPS = (s: number): number => Math.round(s / CONFIG.PHYSICS_DT);

describe('seule la piste compte pour la tolérance de sol', () => {
  test('graines 0 à 3 à 5 voitures, saut à t = 0 puis appui à chaque pas : jamais de nouveau saut sans nouveau contact avec la piste (toit d’un copain)', () => {
    let roofSteps = 0;
    for (const seed of [0, 1, 2, 3]) {
      const sim = createRaceSim(trackFor(seed), CONFIG, { robots: true });
      const g = sim.cars[0];
      // Contact avec la piste à chaque pas, et pas des sauts de Galahad.
      const onTrack: boolean[] = [];
      const jumps: number[] = [];
      for (let i = 0; i < STEPS(8); i++) {
        stepRace(sim, false, true);
        onTrack.push(g.grounded);
        if (sim.events.some((e) => e.type === 'jump' && e.carId === g.state.id)) jumps.push(i);
        // Contact de jeu (une roue sur une autre voiture) sans la piste : Galahad est sur un toit.
        if (g.airborneSince === null && !g.grounded) roofSteps++;
      }
      expect(jumps[0], `graine ${seed} : saut à t = 0`).toBe(0);
      for (let k = 1; k < jumps.length; k++) {
        // Entre deux sauts : la piste quittée (après le contact débouncé du décollage), puis touchée de nouveau.
        const between = onTrack.slice(jumps[k - 1] + 1, jumps[k] + 1);
        const left = between.indexOf(false);
        expect(left, `graine ${seed}, saut ${k} : la piste n'a pas été quittée`).toBeGreaterThanOrEqual(0);
        expect(between.slice(left).includes(true), `graine ${seed}, saut ${k} au pas ${jumps[k]} sans nouveau contact avec la piste`).toBe(true);
      }
    }
    // Contrôle vivant : Galahad se pose bien sur le toit d'un copain (mesuré : 42 à 91 pas par graine, dès 1,78 s).
    expect(roofSteps).toBeGreaterThan(100);
  });
});

describe('le vol d’un saut ne compte pas comme un blocage', () => {
  test('graines 0 à 3, Galahad seul, appui à t = 0, gaz posé : un vol plus long que STUCK_SECONDS, 0 réapparition « stuck »', () => {
    for (const seed of [0, 1, 2, 3]) {
      const sim = createRaceSim(trackFor(seed), CONFIG);
      const g = sim.cars[0];
      const respawns: RespawnEvent[] = [];
      let landedAt: number | null = null;
      let jumpX = NaN;
      let jumpY = NaN;
      for (let i = 0; i < STEPS(10); i++) {
        stepRace(sim, true, i === 0);
        for (const e of sim.events) if (e.type === 'respawn') respawns.push(e);
        for (const e of sim.events) if (e.type === 'jump') { jumpX = e.x; jumpY = e.y; }
        if (landedAt === null && i > 0 && sim.events.some((e) => e.type === 'landing')) landedAt = sim.time;
      }
      expect(g.state.lastJumpAt, `graine ${seed}`).toBe(0);
      expect(jumpY, `graine ${seed} : saut au sol, poussière au sol`).toBeCloseTo(heightAt(sim.track, jumpX), 9);
      expect(landedAt, `graine ${seed} : atterrissage`).not.toBeNull();
      expect(landedAt!, `graine ${seed} : vol plus long que STUCK_SECONDS`).toBeGreaterThan(CONFIG.STUCK_SECONDS);
      expect(respawns, `graine ${seed}`).toEqual([]);
    }
  });

  // Tâche 5g : le volcan de la graine 9 dont la lave était en 1 035 est devenu une fosse ; le scénario vise maintenant le
  // premier tremplin de la graine 9 (les deux chutes de suite à une fosse : tests/fosses.test.ts).
  test('graine 9 : lave au premier tremplin, retour au point sûr, rafale d’appuis juste après : 0 « stuck », la 2e chute de suite pose la voiture après le volcan', () => {
    const track = trackFor(9);
    const v = tremplins(track)[0];
    expect(v, 'premier tremplin de la graine 9').toBeDefined();
    const sim = createRaceSim(track, CONFIG);
    const g = sim.cars[0];
    const respawns: RespawnEvent[] = [];
    let burstUntil = -1;
    let armed = true;
    while (sim.time < 200 && respawns.filter((e) => e.reason === 'lava').length < 2) {
      const x = g.state.progress;
      // Saut mal placé, 6 m avant l'élan (première chute mesurée au Step 14), à chaque approche ; rafale de 0,2 s
      // d'appuis juste après chaque reprise.
      let jump = sim.time <= burstUntil;
      if (armed && x >= v.xElanStart - 6 && x < v.xElanStart) { jump = true; armed = false; }
      stepRace(sim, true, jump);
      for (const e of sim.events) {
        if (e.type !== 'respawn') continue;
        respawns.push(e);
        burstUntil = sim.time + 0.2;
        armed = true;
      }
    }
    expect(respawns.map((e) => e.reason)).toEqual(['lava', 'lava']);
    const [first, second] = respawns;
    expect(Math.abs(first.x - v.xLava)).toBeLessThan(10);
    // Point sûr : avant la zone interdite (au plus les 5 premiers mètres du plat de lancement).
    expect(first.target.x).toBeLessThan(v.xLancement + CONFIG.SAFE_LANCEMENT_MARGIN);
    // Option B : deuxième chute de suite dans la même lave → posée en fin de réception, après le volcan.
    expect(second.target.x).toBeCloseTo(v.xEnd - CONFIG.RESPAWN_AFTER_VOLCANO_BACK, 9);
  });
});

/**
 * Plafond du vol de saut (tour 2 de la 5e) : Galahad seul sur une piste plate, saut à t = 0 gaz posé ; à l'apogée
 * (t = 1 s), un obstacle est posé sous lui :
 * - « perché » : un pilier de 0,4 m de large et 1 m de haut sous le châssis, entre les roues (piste) : le châssis s'y
 *   pose, les roues pendent dans le vide, le vol ne se clôt jamais ; seul le plafond (≈ 4,04 s) rend la voiture
 *   « bloquée » : réapparition vers 6,04 s ;
 * - « toit » : une plaque à 1 m (catégorie d'une voiture, pas la piste) sous les deux roues et une butée devant : le
 *   vol se clôt à l'atterrissage sur le toit (≈ 1,8 s), « bloquée » 2 s plus tard (≈ 3,8 s).
 */
function perchedRun(kind: 'perché' | 'toit'): { stuckAt: number | null; others: RespawnEvent[]; landedOnRoof: boolean } {
  const sim: RaceSim = createRaceSim(generateTrack(3, 400, CONFIG, { onlyPlat: true }), CONFIG);
  const g = sim.cars[0];
  const box = (x: number, y: number, w: number, h: number, category: number): Matter.Body => {
    const p = worldToPhys({ x, y });
    return Matter.Bodies.rectangle(p.x, p.y, w * CONFIG.PIXELS_PER_METER, h * CONFIG.PIXELS_PER_METER, {
      isStatic: true, collisionFilter: { category, mask: CAT.ALL_CARS },
    });
  };
  let placed = false;
  let landedOnRoof = false;
  let stuckAt: number | null = null;
  const others: RespawnEvent[] = [];
  for (let i = 0; i < STEPS(10) && stuckAt === null; i++) {
    stepRace(sim, true, i === 0);
    if (!placed && sim.time >= 1) {
      const x = g.state.progress;
      const bodies = kind === 'perché'
        ? [box(x, 0.5, 0.4, 1, CAT.GROUND)]
        : [box(x, 0.9, 3, 0.2, carCategory(1)), box(x + 1.45, 2, 0.2, 2, carCategory(1))];
      Matter.Composite.add(sim.world.engine.world, bodies);
      placed = true;
    }
    if (kind === 'toit' && placed && g.airborneSince === null && !g.grounded) landedOnRoof = true;
    for (const e of sim.events) {
      if (e.type !== 'respawn') continue;
      if (e.reason === 'stuck') stuckAt = e.t;
      else others.push(e);
    }
  }
  return { stuckAt, others, landedOnRoof };
}

describe('plafond du vol de saut pour le chronomètre « bloquée »', () => {
  test('châssis perché sur un pilier, roues dans le vide, après un saut : « stuck » en 6,1 s au plus (sans plafond : jamais)', () => {
    const r = perchedRun('perché');
    console.log(`perché sur un pilier après un saut : « stuck » à ${r.stuckAt?.toFixed(2)} s`);
    expect(r.others).toEqual([]);
    expect(r.stuckAt, 'réapparition « stuck »').not.toBeNull();
    // Plafond 4 × JUMP_VY / GRAVITY ≈ 4,04 s, puis STUCK_SECONDS.
    expect(r.stuckAt!).toBeGreaterThan((4 * CONFIG.JUMP_VY) / CONFIG.GRAVITY + CONFIG.STUCK_SECONDS - 0.1);
    expect(r.stuckAt!).toBeLessThanOrEqual(6.1);
  });

  test('roues posées sur un toit contre une butée : vol clos à l’atterrissage, « stuck » vers 3,8 s', () => {
    const r = perchedRun('toit');
    console.log(`roues sur un toit contre une butée : « stuck » à ${r.stuckAt?.toFixed(2)} s`);
    expect(r.landedOnRoof, 'roues sur le toit (contact de jeu sans la piste)').toBe(true);
    expect(r.others).toEqual([]);
    expect(r.stuckAt, 'réapparition « stuck »').not.toBeNull();
    expect(r.stuckAt!).toBeGreaterThan(3.3);
    expect(r.stuckAt!).toBeLessThan(4.3);
  });
});
