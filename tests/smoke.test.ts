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
    expect(CONFIG.STAR_STEP_MIN).toBe(60);
    expect(CONFIG.STAR_STEP_MAX).toBe(100);
    expect(CONFIG.STAR_MIN_COUNT).toBe(6);
    expect(CONFIG.STAR_ELAN_OFFSET).toBe(2);
    expect(CONFIG.STAR_ELAN_GAP).toBe(5);
    expect('STAR_EXCLUSION_BEFORE_LAVA' in CONFIG).toBe(false);
  });

  it('points sûrs et respawn v2 (tâche 3) : marge de lancement, recul en fin de réception ; ELAN_SAFE_FRACTION retirée', () => {
    expect(CONFIG.SAFE_LANCEMENT_MARGIN).toBe(5);
    expect(CONFIG.RESPAWN_AFTER_VOLCANO_BACK).toBe(10);
    expect('ELAN_SAFE_FRACTION' in CONFIG).toBe(false);
  });

  it('dimensionne la zone de départ pour 5 longueurs de voiture à vitesse turbo plus 10 m', () => {
    expect(CONFIG.START_LENGTH).toBeGreaterThanOrEqual(5 * 1.5 * CONFIG.CAR_LENGTH + 10);
  });
});
