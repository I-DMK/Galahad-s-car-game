const DEG = Math.PI / 180;
/** runUpDistance(V_MAX, DRIVE_ACCEL) × 1,2 : plat garantissant V_MAX depuis l'arrêt (≈ 27,3 m) ; à recalculer si DRIVE_ACCEL change. */
const D_LANCE = (14 * 14) / (2 * 4.3) * 1.2;
export const CONFIG = {
  PIXELS_PER_METER: 40,
  GRAVITY: 4.9,                 // m/s²
  V_MAX: 14,                    // m/s
  V_CRUISE: 0.8 * 14,
  V_JUMP: 10,                   // m/s au sommet de rampe : vitesse de calibration des volcans (à 22°, LAVA_MARGIN 0,8 et capteur à +0,3 m : seuil entre 9,76 (lave) et 10,03 m/s (passe), mesuré au tour de relecture de la tâche 1)
  TURBO_FACTOR: 1.5,
  TURBO_SECONDS: 3,
  STAR_RESPAWN_SECONDS: 5,
  STAR_EXCLUSION_BEFORE_LAVA: 3 * 14 * 1.5,   // 63 m — retirée en tâche 2
  RAMP_ANGLE: 22 * DEG,
  RAMP_LENGTH: 6,               // m le long de la pente → sommet à 2,25 m
  MAX_SLOPE: 27 * DEG,
  LAVA_MARGIN: 0.8,             // lave à 80 % de la portée calculée à V_JUMP (13,1 m du sommet, centre) ; voiture lancée la plus lente mesurée 11,47 m/s au sommet, soit ≈ 1,5 m/s au-dessus du seuil [9,76 ; 10,03] (tour de relecture de la tâche 1)
  L_ELAN: 6,                    // m : plat d'élan entre le plat de lancement et la rampe, seul levier de difficulté (addendum §1.6)
  D_LANCE,
  LANCEMENT_LENGTH: D_LANCE + 5,   // m : plat de lancement devant chaque plat d'élan (addendum §1.4)
  LAVA_SENSOR_ABOVE_RIM: 0.3,   // m : le capteur de lave dépasse le rebord (un rebond sur le flanc amont ne survole pas la lave)
  ELAN_SAFE_FRACTION: 0.75,     // retirée en tâche 3 (transition : forbiddenZone l'applique au plat de lancement)
  CAR_LENGTH: 2.2, CAR_HEIGHT: 0.7, WHEEL_BASE: 1.5, WHEEL_RADIUS: 0.45, WHEEL_DROP: 0.25,
  WHEEL_SIDES: 48,              // roues en 48-gone (Bodies.polygon) : Bodies.circle plafonne les côtés à min(maxSides, r px) = 18 ici ; excursion du châssis à V_MAX 0,105 m avec 18 côtés → 0,067 m dans la configuration livrée (48 côtés, 3e ressort, WHEEL_SPINUP 0,0054 ; mesuré en 7c)
  CHASSIS_MASS: 60, WHEEL_MASS: 40,
  SUSPENSION_STIFFNESS: 0.3, SUSPENSION_DAMPING: 0.1, SUSPENSION_ANCHOR_SPREAD: 0.3,
  SUSPENSION_TOP_OFFSET: 0.6,   // m au-dessus du toit : 3e ancrage de chaque roue (7c), rend unique la position de la roue (sans lui, position miroir au-dessus de l'axe)
  WHEEL_FRICTION: 1.0, CHASSIS_FRICTION: 0.3, RESTITUTION: 0.05, AIR_DRAG: 0,
  DRIVE_ACCEL: 4.3,             // m/s² : mesuré en 7a (plein gaz sur plat, v(2 s) / 2 = 4,33 ; 4,25–4,49 selon x de départ)
  WHEEL_SPINUP: 0.0054,         // rad/pas par pas, recalibré en 7c (48 côtés, 3e ressort) : 4,34 m/s² sur 0–2 s (x de départ 10 à 200 m) ; sans 3e ressort 0,005 → 4,0 ; 0,0054 → 4,29 ; 0,0056 → 4,47 ; 0,006 → 4,93 (7a, 18 côtés : 0,006 → 4,33)
  ENGINE_BRAKE: 0.995,          // facteur par pas sur omega, doigt levé
  FINISH_BRAKE: 0.98,           // facteur par pas après l'arrivée
  GROUND_DEBOUNCE_SECONDS: 0.1, // une roue reste « au sol » 0,1 s après son dernier contact (brut ou écart < GROUND_CONTACT_GAP) ; mesuré en 7c plein gaz sur le plat : contact brut 28 % des pas (une roue) et 4 % (deux), contact de jeu 98 % et 93 % ; turbo 18 % → 85 % (une roue)
  GROUND_CONTACT_GAP: 0.03,     // m : roue « au sol » si le bas de la roue est à moins de 3 cm du sol (écart vertical), même sans contact Matter ce pas-ci (7c)
  AIR_LEVEL_K: 0.004, AIR_LEVEL_D: 0.08,   // rad/pas² par rad, et par rad/pas ; vérifiés en 7a sur la voiture complète, suspension au repos : 40° → 2,9° en 90 pas (32 / 21 / 13 / 8 / 4,8 / 2,9° tous les 15 pas), sans dépassement ; 40° inchangé sans air-level ; 7c (3e ressort) : 33 / 25 / 19 / 14 / 10 / 7,8°
  TRACK_POINT_SPACING: 0.2,
  RACE_TARGET_SECONDS: 150,
  TRACK_MIN_LENGTH: 300, TRACK_MAX_LENGTH: 6000,
  START_LENGTH: 5 * 1.5 * 2.2 + 10,     // 26,5 m
  FINISH_PLAT_BEFORE: 20, AFTER_FINISH: 60,
  LAVA_WIDTH: 3, RIM_HEIGHT: 1.2, CRATER_DEPTH: 1,
  PHYSICS_DT: 1 / 60, MAX_STEPS_PER_FRAME: 4,
  SAFE_POINT_INTERVAL: 0.5, SAFE_POINT_MAX_SLOPE: 10 * DEG,
  RESPAWN_INVULN: 0.5, RESPAWN_INVULN_MAX: 2,
  FLIP_ANGLE: 110 * DEG, FLIP_SECONDS: 1, SIDE_ANGLE: 70 * DEG, SIDE_SECONDS: 2,
  STUCK_SECONDS: 2, STUCK_DISTANCE: 1,
  SPEED_GUARD: 3 * 14 * 1.5,    // 63 m/s
  VERTICAL_SPEED_CAP: 14 * 1.5 * 1.5,   // 31,5 m/s
  FINISH_COAST_SECONDS: 1.5,
  BACKING_MAX_WIDTH: 1920,
  CAMERA_LEAD_SECONDS: 0.6, CAMERA_SMOOTHING: 0.08, VISIBLE_HEIGHT_M: 14,   // 57 px/m à 800 px CSS → voiture ≈ 125 px
  GALAHAD_COLOR: 0x1e5cff, GALAHAD_ACCENT: 0xe2231a,
} as const;
export type Config = { readonly [K in keyof typeof CONFIG]: number };
