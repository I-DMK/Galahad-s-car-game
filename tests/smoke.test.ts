import { CONFIG } from '../src/config';

describe('CONFIG', () => {
  it('expose les constantes de base', () => {
    expect(CONFIG.PIXELS_PER_METER).toBe(40);
    expect(CONFIG.GRAVITY).toBe(4.9);
    expect(CONFIG.STAR_EXCLUSION_BEFORE_LAVA).toBe(63);
    expect(CONFIG.AIR_DRAG).toBe(0);
  });

  it('volcan v2 : plat de lancement, élan de 6 m, lave reculée, capteur rehaussé', () => {
    expect(CONFIG.L_ELAN).toBe(6);
    expect(CONFIG.D_LANCE).toBeCloseTo((14 * 14) / (2 * 4.3) * 1.2, 9);
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

  it('constantes en sursis (retirées en tâches 2 et 3)', () => {
    expect(CONFIG.ELAN_SAFE_FRACTION).toBe(0.75);
    expect(CONFIG.STAR_EXCLUSION_BEFORE_LAVA).toBe(63);
  });

  it('dimensionne la zone de départ pour 5 longueurs de voiture à vitesse turbo plus 10 m', () => {
    expect(CONFIG.START_LENGTH).toBeGreaterThanOrEqual(5 * 1.5 * CONFIG.CAR_LENGTH + 10);
  });
});
