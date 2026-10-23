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
    // Tâche 5g (ruling du Step 7) : [35, 58] avec les fosses et les réceptions sans étoile avant l'atterrissage.
    expect(CONFIG.STAR_STEP_MIN).toBe(35);
    expect(CONFIG.STAR_STEP_MAX).toBe(58);
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

  it('fosses (tâche 5g, saut §6.9) : 1 volcan sur 2, 8 m, garde 20 m, étoile de réception à 25 m, visée 1 s (au moins 2 m), posée à + 5 m, fantôme jusqu’à + 40 m, pas de tremplin juste après une double-bosse, poids de tirage des volcans 4', () => {
    expect(CONFIG.FOSSE_PERIOD).toBe(2);
    expect(CONFIG.FOSSE_WIDTH).toBe(8);
    expect(CONFIG.FOSSE_GUARD).toBe(20);
    expect(CONFIG.FOSSE_STAR_AFTER).toBe(25);
    expect(CONFIG.FOSSE_JUMP_AIM).toBe(1);
    expect(CONFIG.FOSSE_JUMP_MIN_DISTANCE).toBe(2);
    expect(CONFIG.TREMPLIN_AFTER_DOUBLE_BOSSE).toBe(0);
    expect(CONFIG.VOLCANO_WEIGHT).toBe(4);
    expect(CONFIG.FOSSE_RESPAWN_AFTER).toBe(5);
    expect(CONFIG.FOSSE_GHOST_AFTER).toBe(40);
  });

  it('conduite des robots (tâche 6) : robots polis 2 m/s, 4 m, 3 s au plus ; lever de pied 8 m, 0,4 s ; sauts vus à 40 m, étoile visée 1 s avant, erreur × 2,5 aux fosses', () => {
    expect(CONFIG.POLITE_SPEED).toBe(2);
    expect(CONFIG.POLITE_GAP).toBe(4);
    // La grille (3,3 m entre deux centres) est « juste devant » : sans doigt, Galahad n'est pas poussé avant POLITE_MAX_WAIT.
    expect(CONFIG.GRID_SPACING_FACTOR * CONFIG.CAR_LENGTH).toBeLessThanOrEqual(CONFIG.POLITE_GAP);
    expect(CONFIG.POLITE_MAX_WAIT).toBe(3);
    expect(CONFIG.LIFT_LOOKAHEAD).toBe(8);
    expect(CONFIG.LIFT_SECONDS).toBe(0.4);
    expect(CONFIG.JUMP_LOOKAHEAD).toBe(40);
    // Une fosse est vue dès le début de son approche (LANCEMENT_LENGTH avant le bord).
    expect(CONFIG.JUMP_LOOKAHEAD).toBeGreaterThanOrEqual(CONFIG.LANCEMENT_LENGTH);
    expect(CONFIG.JUMP_STAR_LEAD).toBe(1);
    // Demande d'étoile abandonnée sous 0,7 s (tour 1) : au-delà de la demi-fenêtre (≈ 0,28 s) autour du centre.
    expect(CONFIG.JUMP_STAR_MIN_LEAD).toBe(0.7);
    expect(CONFIG.FOSSE_SKILL_FACTOR).toBe(2.5);
  });

  it('élastique des copains (tâche 7, décisions D7-2 et D7-3 du papa) : fenêtre de la vue 20 m devant, 3 m derrière ; rampe 40 m ; 0,6 à 1,3 ; 0,15/s ; neutre 5 s ; pré-zone 40 m ; vue de référence 11,2 m + 1,6 m', () => {
    expect(CONFIG.RUBBER_WINDOW_AHEAD_M).toBe(20);
    expect(CONFIG.RUBBER_WINDOW_BEHIND_M).toBe(3);
    expect(CONFIG.RUBBER_RAMP_M).toBe(40);
    expect(CONFIG.RUBBER_MIN).toBe(0.6);
    expect(CONFIG.RUBBER_MAX).toBe(1.3);
    expect(CONFIG.RUBBER_RATE_PER_S).toBe(0.15);
    expect(CONFIG.RUBBER_NEUTRAL_SECONDS).toBe(5);
    expect(CONFIG.RUBBER_PREZONE_M).toBe(40);
    expect(CONFIG.SCREEN_REF_HALF_WIDTH_M).toBe((CONFIG.VISIBLE_HEIGHT_M * 1280) / 800 / 2);
    expect(CONFIG.SCREEN_REF_HALF_WIDTH_M).toBeCloseTo(11.2, 12);
    expect(CONFIG.SCREEN_EDGE_MARGIN_M).toBe(1.6);
    expect(CONFIG.VISIBLE_HEIGHT_M).toBe(14);
    // La fenêtre devant couvre la vue de la tablette à V_MAX (11,2 + 0,6 × 14 = 19,6 m) ; derrière, 2,8 m visibles.
    expect(CONFIG.RUBBER_WINDOW_AHEAD_M).toBeGreaterThanOrEqual(CONFIG.SCREEN_REF_HALF_WIDTH_M + CONFIG.CAMERA_LEAD_SECONDS * CONFIG.V_MAX);
    // Turbo d'un copain plafonné à 1,3 au total : 18,2 m/s, sous le turbo de Galahad (21 m/s, R7-1).
    expect(CONFIG.RUBBER_MAX * CONFIG.V_MAX).toBeLessThan(CONFIG.TURBO_FACTOR * CONFIG.V_MAX);
    // RUBBER_WINDOW_M (12 m, plan v2.1) n'est pas créée.
    expect('RUBBER_WINDOW_M' in CONFIG).toBe(false);
  });

  it('étoiles basses des réceptions (tâche 5g, demande du papa) : aucune avant l’atterrissage le plus long doigt posé', () => {
    expect(CONFIG.STAR_TREMPLIN_LANDING).toBe(55);
    expect(CONFIG.STAR_FOSSE_LANDING).toBe(22);
    expect(CONFIG.FOSSE_STAR_AFTER).toBeGreaterThanOrEqual(CONFIG.STAR_FOSSE_LANDING);
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
