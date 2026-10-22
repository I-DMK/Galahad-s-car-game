const DEG = Math.PI / 180;
/** runUpDistance(V_MAX, DRIVE_ACCEL) × 1,2 : plat garantissant V_MAX depuis l'arrêt (≈ 27,3 m) ; à recalculer si DRIVE_ACCEL change. */
const D_LANCE = (14 * 14) / (2 * 4.3) * 1.2;
/** m : points sûrs admis strictement avant xLancement + SAFE_LANCEMENT_MARGIN sur le plat de lancement (addendum §1.6). */
const SAFE_LANCEMENT_MARGIN = 5;
/** m/s² : gravité du jeu (Lune « jouable »), réutilisée par JUMP_VY. */
const GRAVITY = 4.9;
/** m : hauteur gagnée par un saut au-dessus du vol sans saut, quelle que soit la pente (décision P3 du papa, plan B tâche 5e). */
const JUMP_APEX = 2.5;
/** m : dégagement après bosses, élan et atterrissage d'une étoile haute (tâche 5e) ; STAR_FLAT_LENGTH en est dérivée. */
const STAR_HIGH_BUMP_CLEARANCE = 12;
const STAR_HIGH_TAKEOFF_ROOM = 20;
const STAR_HIGH_LANDING_ROOM = 25;
export const CONFIG = {
  PIXELS_PER_METER: 40,
  GRAVITY,                      // m/s²
  V_MAX: 14,                    // m/s
  V_CRUISE: 0.8 * 14,
  V_JUMP: 10,                   // m/s au sommet de rampe : vitesse de calibration des volcans (à 22°, LAVA_MARGIN 0,8 et capteur à +0,3 m). Le seuil réel n'est pas net (bissection de tests/slow/dosage.test.ts, 15 volcans des graines 0 à 2, roues bridées : tombe 9,75–10,14 m/s, passe 9,96–10,75 ; tâche 5c). Avant le congé du pied (RAMP_FOOT_RADIUS, tâche 5c), des chutes doigt posé étaient mesurées jusqu'à 11,44 m/s au sommet : ce n'est pas la vitesse mais la direction au décollage qui décidait
  TURBO_FACTOR: 1.5,
  TURBO_SECONDS: 3,
  STAR_RESPAWN_SECONDS: 5,
  STAR_STEP_MIN: 35, STAR_STEP_MAX: 58,    // m : pas du curseur global d'étoiles (addendum §1.5, cible 8 à 12) ; [60, 100] jusqu'à la tâche 5e (≈ 9,02 étoiles basses ; [80, 130] donnait 7,3) ; [55, 90] avec les plats étoile (tâche 5e, saut §6.5), qui prennent ≈ 171 m de plats par course ; [35, 58] en 5g (ruling du Step 7) : fosses, et plus d'étoile basse avant l'atterrissage sur les réceptions (STAR_TREMPLIN_LANDING, STAR_FOSSE_LANDING) : au pas [50, 85] du plan, 6,50 étoiles basses (4 à 9) ; à [35, 58], 8,50 (5 à 12 ; graines 0 à 19 : 6 à 12) : voir le registre
  STAR_MIN_COUNT: 6,            // plancher : étoiles d'élan ajoutées aux volcans sans étoile, dans l'ordre de la piste ; plancher non garanti sans volcan (une piste sans volcan ou `?len=300` peut en avoir moins, jusqu'à 0)
  STAR_ELAN_OFFSET: 2,          // m : étoile d'élan à xElanStart − 2 (turbo encore actif au sommet)
  STAR_ELAN_GAP: 5,             // m : le curseur s'arrête à xElanStart − 5 sur le plat de lancement (≥ 3 m avant l'étoile d'élan)
  RAMP_ANGLE: 22 * DEG,
  RAMP_LENGTH: 6,               // m le long de la pente → sommet à 2,25 m
  RAMP_FOOT_RADIUS: 10,         // m : congé concave au pied de la rampe-volcan (pas des rampes-saut), tangent au plat d'élan 1,94 m avant xRampStart et à la rampe 1,80 m après ; sommet, angle de décollage et lave inchangés. Sans lui, la roue avant tapait le pli 0° → 22° et la voiture décollait dès le pied, survolait la rampe et partait du sommet à ≈ 14° au lieu de ≈ 21° : 4 chutes propres doigt posé sur 2 924 historiques en phase 1 (3 avec le tirage de turboAt du tour 1 ; 43 volcans des graines 0 à 9), garde minimale −0,03 m au-dessus du capteur de lave ; avec R = 10 : 0 chute sur 2 924 + 4 601 historiques (famille turbo dense), garde minimale 0,63 m en fin de turbo au pied (lancée à V_MAX en xLancement − 45, turbo pris à xLancement − 26, doigt posé : arrivée au pied à 11,3 m/s ; g0 v2 et g8 v3), ≥ 1,72 m hors fin de turbo ; marge gardée par le papa, assertée ≥ 0,3 m (tâche 5c du plan B, tests/slow/phases.test.ts et phases-dense.test.ts)
  MAX_SLOPE: 27 * DEG,
  LAVA_MARGIN: 0.8,             // lave à 80 % de la portée calculée à V_JUMP (13,1 m du sommet, centre) ; avec le congé du pied (RAMP_FOOT_RADIUS) : voiture lancée la plus lente 12,66 m/s au sommet (cas 2-lancement) (doigt posé depuis xLancement, graines 0 à 9), échantillonnage des phases 0 chute (2 924 historiques + 4 601 en turbo dense), garde minimale au-dessus du capteur 0,63 m en fin de turbo au pied, ≥ 1,72 m sinon (tâche 5c)
  L_ELAN: 6,                    // m : plat d'élan entre le plat de lancement et la rampe, seul levier de difficulté (addendum §1.6) ; le congé du pied (RAMP_FOOT_RADIUS) relève ses R tan(11°) ≈ 1,94 derniers mètres : le sol est à 0 sur L_ELAN − 1,94 ≈ 4,06 m (tâche 5c)
  D_LANCE,
  LANCEMENT_LENGTH: D_LANCE + SAFE_LANCEMENT_MARGIN,   // m : plat de lancement devant chaque plat d'élan (addendum §1.4) ; la zone interdite étant fermée en xLancement + SAFE_LANCEMENT_MARGIN, le pire point sûr est strictement avant et laisse au moins D_LANCE de plat
  LAVA_SENSOR_ABOVE_RIM: 0.3,   // m : le capteur de lave dépasse le rebord (un rebond sur le flanc amont ne survole pas la lave)
  SAFE_LANCEMENT_MARGIN,        // m : jamais de point sûr dans [xLancement + SAFE_LANCEMENT_MARGIN, xReception[ (addendum §1.6)
  RESPAWN_AFTER_VOLCANO_BACK: 10,   // m : deuxième chute de suite au même volcan → replacée à xEnd − 10 (fin du plat de réception, hors de la zone d'atterrissage des autres voitures)
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
  GRID_SPACING_FACTOR: 1.5,     // grille de départ (spec §6) : robot de rang n à xStart − 2 − n × 1,5 × CAR_LENGTH (3,3 m entre centres) ; Galahad en pole
  START_DELAY_PER_RANK: 0.3,    // s : le robot de rang n pose le doigt à n × 0,3 s
  RESPAWN_GROUP_SPACING_FACTOR: 1.5,   // respawn groupé (addendum §1.6) : un châssis à moins de 1,5 × CAR_LENGTH de la cible la fait reculer de 1,5 × CAR_LENGTH
  RESPAWN_GROUP_MAX_SHIFT: 4,   // au plus 4 reculs (5 voitures sur le même point sûr) ; au-delà, l'invulnérabilité couvre le chevauchement
  RESPAWN_GROUP_MAX_ADJUST: 10, // m : un recul est ajusté vers l'amont (pente < SAFE_POINT_MAX_SLOPE, hors zone interdite et cratère) sur au plus 10 m, sinon abandonné
  FLIP_ANGLE: 110 * DEG, FLIP_SECONDS: 1, SIDE_ANGLE: 70 * DEG, SIDE_SECONDS: 2,
  STUCK_SECONDS: 2, STUCK_DISTANCE: 1,
  SPEED_GUARD: 3 * 14 * 1.5,    // 63 m/s
  VERTICAL_SPEED_CAP: 14 * 1.5 * 1.5,   // 31,5 m/s
  FINISH_COAST_SECONDS: 1.5,
  BACKING_MAX_WIDTH: 1920,
  CAMERA_LEAD_SECONDS: 0.6, CAMERA_SMOOTHING: 0.08, VISIBLE_HEIGHT_M: 14,   // 57 px/m à 800 px CSS → voiture ≈ 125 px
  GALAHAD_COLOR: 0x1e5cff, GALAHAD_ACCENT: 0xe2231a,
  // Bouton saut (plan B, tâche 5e ; addendum « bouton saut » §1, amendé [plan]).
  JUMP_APEX,
  JUMP_VY: Math.sqrt(2 * GRAVITY * JUMP_APEX),   // ≈ 4,95 m/s : vitesse verticale d'un saut depuis l'arrêt (applyJump) ; apogée mesuré du châssis (tests/jump.test.ts) : voir le registre, tâche 5e
  JUMP_COOLDOWN: 0.5,           // s depuis le dernier saut de cette voiture
  JUMP_BUFFER: 0.1,             // s : mémoire d'une demande de saut pas encore servie (décision P2 du papa)
  JUMP_GROUND_GRACE: 0.35,      // s : tolérance de sol (décision P11 du papa, gardée à 0,35 s : Q-F6) : le saut part si une roue a touché la piste (sol, mur, écart roue-sol, débouncé ; jamais une autre voiture : « seule la piste compte », relectures de la 5e) dans les 0,35 s précédentes ; mesuré : 0 appui perdu sur 8 640 à 11,2 et 14 m/s et turbo pris à 14 m/s, 0,41 % à 21 m/s tenus (tests/jump-grace.test.ts) ; pas de double saut : GROUND_DEBOUNCE_SECONDS + JUMP_GROUND_GRACE finit 0,05 s avant JUMP_COOLDOWN, et le toit d'un copain ne compte pas, donc un nouveau saut demande un nouveau contact avec la piste (tests/jump-piste.test.ts)
  JUMP_BUTTON_SIZE_PX: 150,     // px CSS (≥ 140), bouton rond en bas à gauche
  // Étoiles hautes ajoutées (plan B, tâche 5e ; décision P1 du papa) : placeStars, étape 5, tirages après tous les
  // autres. Hauteur et jeu de dégagements calibrés au Step 8 (4a414c6 : à 3,90 m, fenêtre min 0,57 / 0,53 s à 11,2 /
  // 14 m/s, 0,42 s à + 5 cm ; garde au sol de Galahad ≥ 2,1 m ; 50 / 12 / 20 / 25 : le plus permissif des jeux à 0 prise
  // sans saut, 5 voitures, graines 0 à 23) et choisis par le papa (e02dcae, décision P6 ; ruling R-F7). La fenêtre de
  // saut est très sensible à STAR_HIGH_Y : recalibrer si JUMP_VY, la gravité, la suspension ou les roues changent
  // (tests/high-stars-window.test.ts).
  STAR_HIGH_PER_RACE: 3,        // au plus N étoiles hautes ajoutées par course ; 0 = étoiles d'avant la tâche 5e, au bit près
  STAR_HIGH_Y: 3.9,             // m au-dessus du sol local (centre de l'étoile), décision P6
  STAR_HIGH_TAKEOFF_ROOM,       // 20 m de terrain permis avant l'étoile (élan du saut), pas forcément du plat
  STAR_HIGH_LANDING_ROOM,       // 25 m de terrain permis après l'étoile (atterrissage) ; vol ≈ 2,2 s, ≈ 31 m à 14 m/s
  STAR_HIGH_GAP: 10,            // m minimum entre une étoile haute et toute étoile basse
  STAR_HIGH_RAMP_CLEARANCE: 50, // m interdits après la fin d'une rampe-saut (vol doigt posé, turbo compris)
  STAR_HIGH_BUMP_CLEARANCE,     // 12 m interdits après la fin d'une bosses, double-bosse ou cratère
  // Plats étoile (tâche 5e, décisions P7 et Q-F4, saut §6.6, ruling R-F8) : le générateur pose STAR_FLATS_PER_RACE
  // tranches 'plat-étoile' (une par STAR_FLAT_SPACING m de piste au plus), chacune avec son étoile haute à
  // dégagement + élan = 32 m de son début ; jamais juste après une rampe-saut, aucune étoile basse dessus.
  STAR_FLATS_PER_RACE: 3,       // plats étoile par course ; 0 = aucun (pistes d'avant)
  STAR_FLAT_SPACING: 400,       // m de piste par plat étoile (pistes courtes : 1 à 600 m, 0 à 300 m)
  STAR_FLAT_LENGTH: STAR_HIGH_BUMP_CLEARANCE + STAR_HIGH_TAKEOFF_ROOM + STAR_HIGH_LANDING_ROOM,   // 57 m : dégagement d'entrée + élan + atterrissage
  // Fosses de lave (plan B, tâche 5g ; décisions P8, Q-F1, Q-F2 du papa ; saut §6.2 à §6.5 et §6.9) : une rampe-volcan
  // tirée sur FOSSE_PERIOD devient une fosse (alternance, phase sur un mulberry32 à part), même longueur (125,2 m) :
  // garde, approche (LANCEMENT_LENGTH), lave de FOSSE_WIDTH au ras du sol, réception.
  FOSSE_PERIOD: 2,              // 1 volcan sur 2 est une fosse ; 0 = aucune (pistes d'avant)
  FOSSE_WIDTH: 8,               // m de lave (Q-F1) : franchissable à doigt posé, pas sous ≈ 6 m/s
  FOSSE_GUARD: 20,              // m de plat de garde avant l'approche : absorbe le vol d'une bosse ou double-bosse prise en turbo (R-F4)
  FOSSE_STAR_AFTER: 25,         // m entre le bord aval et l'étoile de réception (tirée 1 fosse sur 2, comme l'étoile d'élan)
  FOSSE_JUMP_AIM: 1,            // s : fosseJumpLead(v) = FOSSE_JUMP_AIM − FOSSE_WIDTH / (2v), centre de la fenêtre (saut §6.8)
  FOSSE_RESPAWN_AFTER: 5,       // m : 2e chute de suite dans une fosse → posée à bord aval + 5 (Q-F2, option B)
  FOSSE_GHOST_AFTER: 40,        // m : zone fantôme d'une fosse jusqu'à bord aval + 40 (atterrissage le plus long ≈ 32 m, R-F16)
  // Étoiles basses des réceptions (tâche 5g, demande du papa : une étoile au tout début d'une réception était survolée
  // doigt posé, graine 14 : toutes les voitures en turbo en ratent une sur un tremplin). Aucune étoile basse du curseur
  // avant xReception + ces dégagements : atterrissage le plus long doigt posé (turbo compris), plus une marge.
  // Mesuré (5 voitures et Galahad seul, graines 0 à 23, Galahad avec un saut au centre de chaque fosse) : tremplin,
  // premier contact jusqu'à 49,4 m après xReception (sommet à 19,5 m/s en turbo ; ≈ 50,7 m CALCULÉ à 21 m/s) ; fosse,
  // jusqu'à 17,6 m après le bord aval (sauts au centre, turbo compris). Voir le registre, tâche 5g.
  STAR_TREMPLIN_LANDING: 55,    // m après le pied de la descente aval d'un tremplin sans étoile basse (reste ≈ 9,3 m de réception)
  STAR_FOSSE_LANDING: 22,       // m après le bord aval d'une fosse sans étoile basse du curseur ; l'étoile de réception (FOSSE_STAR_AFTER) est au-delà
} as const;
export type Config = { readonly [K in keyof typeof CONFIG]: number };
