import { CONFIG } from '../config';

export interface Vec { x: number; y: number }

const PPM = CONFIG.PIXELS_PER_METER;
const STEPS_PER_SECOND = 60;

export const toPx = (m: number): number => m * PPM;
export const toM = (px: number): number => px / PPM;

/** Monde (mètres, y vers le haut) -> physique Matter (pixels, y vers le bas). */
export const worldToPhys = (p: Vec): Vec => ({ x: p.x * PPM, y: -p.y * PPM });
/** Physique Matter (pixels, y vers le bas) -> monde (mètres, y vers le haut). */
export const physToWorld = (p: Vec): Vec => ({ x: p.x / PPM, y: -p.y / PPM });

/** Vitesse Matter (px par pas de 1/60 s) -> m/s. */
export const speedMps = (v: Vec): number => (Math.hypot(v.x, v.y) * STEPS_PER_SECOND) / PPM;
/** m/s -> px par pas de 1/60 s. */
export const mpsToPxPerStep = (v: number): number => (v * PPM) / STEPS_PER_SECOND;
