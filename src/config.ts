const DEG = Math.PI / 180;
export const CONFIG = {
  PIXELS_PER_METER: 40,
  GRAVITY: 4.9,                 // m/s²
  V_MAX: 14,                    // m/s
  V_CRUISE: 0.8 * 14,
  V_JUMP: 10,                   // m/s au sommet de rampe : vitesse de calibration des volcans (à 22°, exige ≥ 8,8 m/s pour passer le bord aval de la lave)
  TURBO_FACTOR: 1.5,
  TURBO_SECONDS: 3,
  STAR_RESPAWN_SECONDS: 5,
  STAR_EXCLUSION_BEFORE_LAVA: 3 * 14 * 1.5,   // 63 m
  RAMP_ANGLE: 22 * DEG,
  RAMP_LENGTH: 6,               // m le long de la pente → sommet à 2,25 m
  MAX_SLOPE: 27 * DEG,
  LAVA_MARGIN: 0.7,             // lave à 70 % de la portée calculée à V_JUMP
  ELAN_MARGIN: 1.2,
  ELAN_SAFE_FRACTION: 0.75,     // le plat d'élan est dimensionné pour qu'il suffise de 75 % de sa longueur
  CAR_LENGTH: 2.2, CAR_HEIGHT: 0.7, WHEEL_BASE: 1.5, WHEEL_RADIUS: 0.45, WHEEL_DROP: 0.25,
  CHASSIS_MASS: 60, WHEEL_MASS: 40,
  SUSPENSION_STIFFNESS: 0.3, SUSPENSION_DAMPING: 0.1, SUSPENSION_ANCHOR_SPREAD: 0.3,
  WHEEL_FRICTION: 1.0, CHASSIS_FRICTION: 0.3, RESTITUTION: 0.05, AIR_DRAG: 0,
  DRIVE_ACCEL: 4.3,             // m/s² : mesuré en 7a (plein gaz sur plat, v(2 s) / 2 = 4,33 ; 4,25–4,49 selon x de départ)
  WHEEL_SPINUP: 0.006,          // rad/pas par pas, calibré en 7a (0,005 → 3,9 m/s² ; 0,007 → 5,2 ; 0,01 → 6,3)
  ENGINE_BRAKE: 0.995,          // facteur par pas sur omega, doigt levé
  FINISH_BRAKE: 0.98,           // facteur par pas après l'arrivée
  AIR_LEVEL_K: 0.004, AIR_LEVEL_D: 0.08,   // rad/pas² par rad, et par rad/pas ; vérifiés en 7a sur la voiture complète : 40° → 1,5° en 90 pas, sans dépassement
  TRACK_POINT_SPACING: 0.2,
  RACE_TARGET_SECONDS: 150,
  TRACK_MIN_LENGTH: 300, TRACK_MAX_LENGTH: 6000,
  START_LENGTH: 5 * 1.5 * 2.2 + 10,     // 26,5 m
  FINISH_PLAT_BEFORE: 20, AFTER_FINISH: 60,
  LAVA_WIDTH: 3, RIM_HEIGHT: 1.2, CRATER_DEPTH: 1, STOP_BUMP_HEIGHT: 0.3, STOP_BUMP_LENGTH: 1,
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
