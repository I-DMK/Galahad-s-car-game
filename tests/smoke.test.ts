import { CONFIG } from '../src/config';
import { runUpDistance } from '../src/track/ballistics';

describe('CONFIG', () => {
  it('expose les constantes de base', () => {
    expect(CONFIG.PIXELS_PER_METER).toBe(40);
    expect(CONFIG.GRAVITY).toBe(4.9);
    expect(CONFIG.AIR_DRAG).toBe(0);
  });

  it('volcan v2 : plat de lancement, élan de 6 m, lave reculée, capteur rehaussé', () => {
    expect(CONFIG.L_ELAN).toBe(6);
    // D_LANCE est un littéral dans config.ts : cette assertion attrape une dérive de V_MAX / DRIVE_ACCEL.
    expect(CONFIG.D_LANCE).toBeCloseTo(runUpDistance(CONFIG.V_MAX, CONFIG.DRIVE_ACCEL) * 1.2, 9);
    expect(CONFIG.D_LANCE).toBeCloseTo(27.35, 1);
    expect(CONFIG.LANCEMENT_LENGTH).toBeCloseTo(CONFIG.D_LANCE + 5, 9);
    expect(CONFIG.LAVA_MARGIN).toBe(0.8);
    expect(CONFIG.LAVA_SENSOR_ABOVE_RIM).toBe(0.3);
  });

  it('constantes retirées en tâche 1 : ELAN_MARGIN, STOP_BUMP_*', () => {
    expect('ELAN_MARGIN' in CONFIG).toBe(false);
    expect('STOP_BUMP_HEIGHT' in CONFIG).toBe(false);
    expect('STOP_BUMP_LENGTH' in CONFIG).toBe(false);
  });

  it('étoiles v2 (tâche 2) : pas du curseur, plancher, étoile d’élan ; STAR_EXCLUSION_BEFORE_LAVA retirée', () => {
    // Tâche 5e (Step 13) : [55, 90] avec les plats étoile (saut §6.5) ; [60, 100] reste celui des pistes d'avant.
    expect(CONFIG.STAR_STEP_MIN).toBe(55);
    expect(CONFIG.STAR_STEP_MAX).toBe(90);
    expect(CONFIG.STAR_MIN_COUNT).toBe(6);
    expect(CONFIG.STAR_ELAN_OFFSET).toBe(2);
    expect(CONFIG.STAR_ELAN_GAP).toBe(5);
    expect('STAR_EXCLUSION_BEFORE_LAVA' in CONFIG).toBe(false);
  });

  it('points sûrs et respawn v2 (tâche 3) : marge de lancement, recul en fin de réception ; ELAN_SAFE_FRACTION retirée', () => {
    expect(CONFIG.SAFE_LANCEMENT_MARGIN).toBe(5);
    expect(CONFIG.LANCEMENT_LENGTH).toBe(CONFIG.D_LANCE + CONFIG.SAFE_LANCEMENT_MARGIN);
    expect(CONFIG.RESPAWN_AFTER_VOLCANO_BACK).toBe(10);
    expect('ELAN_SAFE_FRACTION' in CONFIG).toBe(false);
  });

  it('course à 5 voitures (tâche 5b) : grille, délai de départ, respawn groupé', () => {
    expect(CONFIG.GRID_SPACING_FACTOR).toBe(1.5);
    expect(CONFIG.START_DELAY_PER_RANK).toBe(0.3);
    expect(CONFIG.RESPAWN_GROUP_SPACING_FACTOR).toBe(1.5);
    expect(CONFIG.RESPAWN_GROUP_MAX_SHIFT).toBe(4);
    expect(CONFIG.RESPAWN_GROUP_MAX_ADJUST).toBe(10);
    // Le robot de rang 4 (xStart − 2 − 4 × 1,5 × CAR_LENGTH) reste sur le plat de départ (x ≥ 0), roues comprises.
    const xStart = CONFIG.START_LENGTH - 5;
    const rearWheel = xStart - 2 - 4 * CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH - CONFIG.WHEEL_BASE / 2 - CONFIG.WHEEL_RADIUS;
    expect(rearWheel).toBeGreaterThan(0);
  });

  it('bouton saut (tâche 5e) : apogée 2,5 m, JUMP_VY dérivée de la gravité, délai, mémoire 0,1 s, tolérance de sol 0,35 s, bouton ≥ 140 px', () => {
    expect(CONFIG.JUMP_APEX).toBe(2.5);
    expect(CONFIG.JUMP_VY).toBeCloseTo(Math.sqrt(2 * CONFIG.GRAVITY * CONFIG.JUMP_APEX), 12);
    expect(CONFIG.JUMP_VY).toBeCloseTo(4.95, 2);
    expect(CONFIG.JUMP_COOLDOWN).toBe(0.5);
    expect(CONFIG.JUMP_BUFFER).toBe(0.1);
    expect(CONFIG.JUMP_GROUND_GRACE).toBe(0.35);
    expect(CONFIG.JUMP_BUTTON_SIZE_PX).toBeGreaterThanOrEqual(140);
  });

  it('étoiles hautes (tâche 5e) : 3 par course, 3,90 m (décision P6), jeu 50 / 12 / 20 / 25 de la calibration (ruling R-F7)', () => {
    expect(CONFIG.STAR_HIGH_PER_RACE).toBe(3);
    expect(CONFIG.STAR_HIGH_GAP).toBe(10);
    expect(CONFIG.STAR_HIGH_Y).toBe(3.9);
    expect(CONFIG.STAR_HIGH_TAKEOFF_ROOM).toBe(20);
    expect(CONFIG.STAR_HIGH_LANDING_ROOM).toBe(25);
    expect(CONFIG.STAR_HIGH_RAMP_CLEARANCE).toBe(50);
    expect(CONFIG.STAR_HIGH_BUMP_CLEARANCE).toBe(12);
  });

  it('plats étoile (tâche 5e, Step 13) : 3 par course, un par 400 m au plus, 57 m = dégagement + élan + atterrissage', () => {
    expect(CONFIG.STAR_FLATS_PER_RACE).toBe(3);
    expect(CONFIG.STAR_FLAT_SPACING).toBe(400);
    expect(CONFIG.STAR_FLAT_LENGTH).toBe(57);
  });

  it('dimensionne la zone de départ pour 5 longueurs de voiture à vitesse turbo plus 10 m', () => {
    expect(CONFIG.START_LENGTH).toBeGreaterThanOrEqual(5 * 1.5 * CONFIG.CAR_LENGTH + 10);
  });
});
