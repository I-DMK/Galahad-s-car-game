import { CONFIG } from '../src/config';
import { Camera, computeBackingSize } from '../src/render/camera';

describe('computeBackingSize', () => {
  test('tablette 1280×800 à DPR 2 : plafonnée à 1920 px de large', () => {
    expect(computeBackingSize(1280, 800, 2)).toEqual({ w: 1920, h: 1200, scale: 1.5 });
  });

  test('800×500 à DPR 1 : taille inchangée', () => {
    expect(computeBackingSize(800, 500, 1)).toEqual({ w: 800, h: 500, scale: 1 });
  });
});

describe('Camera', () => {
  test('le premier update se cale directement sur la cible (pas de balayage au départ)', () => {
    const cam = new Camera(CONFIG);
    cam.update(100, 5, 10, 1 / 60);
    expect(cam.x).toBeCloseTo(100 + 10 * CONFIG.CAMERA_LEAD_SECONDS, 9);
    expect(cam.y).toBeCloseTo(5, 9);
  });

  test('les updates suivants convergent vers la cible devant la voiture', () => {
    const cam = new Camera(CONFIG);
    cam.update(0, 0, 0, 1 / 60);
    const speed = 10;
    const target = 50 + speed * CONFIG.CAMERA_LEAD_SECONDS;
    cam.update(50, 2, speed, 1 / 60);
    // lissage : un seul pas ne fait qu'une fraction du chemin (0,08 à 60 fps)
    expect(cam.x).toBeCloseTo(target * CONFIG.CAMERA_SMOOTHING, 6);
    expect(cam.x).toBeLessThan(target);
    for (let i = 1; i < 120; i++) cam.update(50, 2, speed, 1 / 60);
    expect(Math.abs(cam.x - target)).toBeLessThan(0.1);
    expect(Math.abs(cam.y - 2)).toBeLessThan(0.1);
  });

  test('le lissage ne dépend pas de la cadence (2 pas à 1/60 ≈ 1 pas à 1/30)', () => {
    const a = new Camera(CONFIG);
    const b = new Camera(CONFIG);
    a.update(0, 0, 0, 1 / 60);
    b.update(0, 0, 0, 1 / 60);
    a.update(10, 0, 0, 1 / 60);
    a.update(10, 0, 0, 1 / 60);
    b.update(10, 0, 0, 1 / 30);
    expect(b.x).toBeCloseTo(a.x, 9);
  });

  test('pxPerMeter(800) ≈ 57,1', () => {
    expect(new Camera(CONFIG).pxPerMeter(800)).toBeCloseTo(800 / 14, 6);
    expect(new Camera(CONFIG).pxPerMeter(800)).toBeCloseTo(57.14, 2);
  });

  test('worldToScreen : centre au milieu, y du monde vers le haut = y écran vers le bas', () => {
    const cam = new Camera(CONFIG);
    cam.update(20, 3, 0, 1 / 60);
    const ppm = cam.pxPerMeter(800);
    expect(cam.worldToScreen({ x: 20, y: 3 }, 1280, 800)).toEqual({ x: 640, y: 400 });
    const above = cam.worldToScreen({ x: 21, y: 4 }, 1280, 800);
    expect(above.x).toBeCloseTo(640 + ppm, 9);
    expect(above.y).toBeCloseTo(400 - ppm, 9); // plus haut dans le monde → plus petit y à l'écran
  });

  test('visibleHalfWidthM = largeur / (2 × ppm)', () => {
    const cam = new Camera(CONFIG);
    expect(cam.visibleHalfWidthM(1280, 800)).toBeCloseTo(1280 / (2 * (800 / 14)), 9);
  });
});
