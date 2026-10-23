"""Contrôle d'un sprite de carrosserie généré contre le gabarit (docs/sprites-gabarit.svg).

python3 -I tools/sprites/controle.py <brut.png> <sortie-512.png> <apercu.png> [calque.png] [wheel.png]
(Pillow et numpy ; calque.png : `node tools/sprites/rendu-gabarit.cjs calque calque.png`.)

0. rend pleinement opaque la carrosserie (alpha ≥ 240 → 255) ;
1. repère les deux arches : bord du trou transparent sous la carrosserie, de part et d'autre de son
   milieu, et cercle porté par le plus de points de ce bord (RANSAC puis moindres carrés) ; marche
   pour une arche ouverte vers le bas comme pour un anneau fermé, et sépare l'arche d'une roue
   dessinée avec du jeu (deux cercles concentriques) ; si aucune arche plausible n'est trouvée (roues
   dessinées serrées), repère les roues sur le bas de la silhouette et s'en sert comme axes ;
2. met l'image à l'échelle et en place pour que les centres des arches tombent sur les axes
   (±75 ; +25) cm du gabarit, dans le cadre 280 × 140 cm = 512 × 256 px ;
3. vérifie : rayon des arches dans [43 ; 55] cm (des roues seules : [42 ; 48] cm), écart des
   centres ≤ 3 cm en hauteur, pente de la ligne des centres ≤ 1,5°, rien d'opaque coupé par le
   cadre hors zone effacée, ≤ 60 KB ;
4. efface l'intérieur des arches (disque de rayon min(rayon mesuré, 50) − 1 cm sur les axes), ou les
   roues dessinées (rayon mesuré + 1 cm) : wheel.png les remplace en jeu ;
5. quantifie en PNG-8 (256 couleurs, tramage ; entrées de palette d'alpha ≥ 240 remises à 255) et
   donne la taille ;
6. écrit un aperçu : sur le ciel du jeu, roues posées aux axes (rendu en jeu), puis la même image
   avec le calque du gabarit par-dessus ; et imprime le rapport (JSON) avec le verdict.
Vérifié sur la silhouette du gabarit (export `silhouette`, décalée sur une toile plus grande) :
acceptée, arches à 49,5 cm, même emprise au pixel près que le rendu direct à 512 px.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

FRAME_W_CM, FRAME_H_CM = 280.0, 140.0
OUT_W, OUT_H = 512, 256
PX_PER_CM = OUT_W / FRAME_W_CM
AXLES_CM = [(-75.0, 25.0), (75.0, 25.0)]  # repère du gabarit : origine au centre, y vers le bas
# Arche serrée acceptée dès 43 cm : la roue de 45 cm, dessinée par-dessus, en cache le bord (sprites
# générés du 2026-10-23 : 44 à 46 cm, aucun jour visible en jeu). Le gabarit vise 50 cm.
WHEEL_R_CM, ARCH_R_CM, ARCH_MIN, ARCH_MAX = 45.0, 50.0, 43.0, 55.0
# Alpha de la carrosserie : certains générateurs livrent 250 à 254 au lieu de 255 ; tout alpha ≥ 240
# devient 255 (carrosserie pleinement opaque), les bords lissés (alpha plus bas) restent tels quels.
OPAQUE_FROM = 240
SKY = (10, 16, 48, 255)


def alpha_mask(im, thr=24):
    return np.array(im)[:, :, 3] > thr


def fit_circle(xs, ys):
    """Cercle des moindres carrés (méthode de Kåsa) : centre (cx, cy), rayon r, résidu RMS."""
    A = np.column_stack([xs, ys, np.ones_like(xs)])
    b = xs ** 2 + ys ** 2
    (a0, a1, a2), *_ = np.linalg.lstsq(A, b, rcond=None)
    cx, cy = a0 / 2, a1 / 2
    r = np.sqrt(a2 + cx ** 2 + cy ** 2)
    res = np.sqrt(np.mean((np.hypot(xs - cx, ys - cy) - r) ** 2))
    return cx, cy, r, res


def ransac_circle(xs, ys, tol, iters=4000, seed=1):
    """Cercle porté par le plus de points (à tol px près), affiné aux moindres carrés sur ces points :
    le bas de la carrosserie entre les arches ou un pare-chocs ne faussent pas l'ajustement."""
    rng = np.random.default_rng(seed)
    best = None
    for _ in range(iters):
        i = rng.choice(len(xs), 3, replace=False)
        try:
            cx, cy, r, _ = fit_circle(xs[i], ys[i])
        except np.linalg.LinAlgError:
            continue
        if not np.isfinite(r):
            continue
        inl = np.abs(np.hypot(xs - cx, ys - cy) - r) < tol
        if best is None or inl.sum() > best.sum():
            best = inl
    cx, cy, r, res = fit_circle(xs[best], ys[best])
    return cx, cy, r, res, int(best.sum())


def find_arches(mask):
    """Bord des arches : dans chaque colonne, le trou transparent le plus bas sous la carrosserie
    (entre deux tronçons opaques, ou entre le dernier tronçon et le bas de la silhouette), d'au
    moins 3 % de la hauteur et dont le haut est dans les 70 % inférieurs. Le haut du trou est sur
    l'arche ; son bas aussi quand l'arche est un anneau fermé (sprites Grok), pas quand elle est
    ouverte (le bas est alors le bas de la silhouette)."""
    cols = np.where(mask.any(axis=0))[0]
    rows = np.where(mask.any(axis=1))[0]
    x0, x1, y_top, y_low = cols.min(), cols.max(), rows.min(), rows.max()
    height = y_low - y_top
    gap_min, ceil_min = 0.03 * height, y_top + 0.3 * height
    mid = (x0 + x1) / 2
    pts = {-1: ([], []), 1: ([], [])}
    for x in range(x0, x1 + 1):
        col = mask[y_top:y_low + 1, x]
        ys = np.nonzero(col)[0] + y_top
        if len(ys) == 0:
            continue
        ends = list(ys[np.nonzero(np.diff(ys) > 1)[0]]) + [ys[-1]]           # bas de chaque tronçon
        starts = [ys[0]] + list(ys[np.nonzero(np.diff(ys) > 1)[0] + 1])      # haut de chaque tronçon
        gaps = [(ends[i], starts[i + 1], True) for i in range(len(ends) - 1)] + [(ends[-1], y_low + 1, False)]
        gaps = [g for g in gaps if g[1] - g[0] - 1 >= gap_min and g[0] >= ceil_min]
        if not gaps:
            continue
        top, bot, closed = gaps[-1]
        side = -1 if x < mid else 1
        pts[side][0].append(x); pts[side][1].append(top)
        if closed:
            pts[side][0].append(x); pts[side][1].append(bot)
    arches = []
    for side in (-1, 1):
        px, py = np.array(pts[side][0], float), np.array(pts[side][1], float)
        tol = max(1.5, 0.006 * height)
        first = ransac_circle(px, py, tol)
        arch = {'cx': first[0], 'cy': first[1], 'r': first[2], 'res': first[3], 'n': first[4], 'points': len(px)}
        # Roue dessinée avec du jeu : le trou est l'anneau entre la roue et l'arche, ses deux bords sont
        # deux cercles concentriques. Le plus grand est l'arche, le plus petit la roue (à effacer).
        rest = np.abs(np.hypot(px - first[0], py - first[1]) - first[2]) >= tol
        if rest.sum() >= 0.2 * len(px):
            sec = ransac_circle(px[rest], py[rest], tol)
            if (sec[4] >= 0.5 * first[4] and np.hypot(sec[0] - first[0], sec[1] - first[1]) < 0.05 * first[2]
                    and abs(sec[2] - first[2]) > 0.03 * first[2]):
                small, big = sorted([first, sec], key=lambda c: c[2])
                arch = {'cx': big[0], 'cy': big[1], 'r': big[2], 'res': big[3], 'n': big[4], 'points': len(px),
                        'roue_r': small[2]}
        arches.append(arch)
    return arches, (int(x0), int(rows.min()), int(x1), int(y_low))


def find_wheels(mask):
    """Repli quand le générateur a dessiné les roues (pas de trou sous la carrosserie) : le bas de la
    silhouette, de part et d'autre de son milieu, est le bas des roues ; cercle RANSAC sur ce profil."""
    cols = np.where(mask.any(axis=0))[0]
    rows = np.where(mask.any(axis=1))[0]
    x0, x1, height = cols.min(), cols.max(), rows.max() - rows.min()
    mid = (x0 + x1) / 2
    wheels = []
    for side in (-1, 1):
        xs = np.arange(x0, int(mid)) if side < 0 else np.arange(int(mid) + 1, x1 + 1)
        xs = np.array([x for x in xs if mask[:, x].any()])
        bottom = np.array([np.nonzero(mask[:, x])[0].max() for x in xs], float)
        cx, cy, r, res, n = ransac_circle(xs.astype(float), bottom, tol=max(1.5, 0.006 * height))
        wheels.append({'cx': cx, 'cy': cy, 'r': r, 'res': res, 'n': n, 'points': len(xs)})
    return wheels


def plausible(circles):
    """Deux cercles de rayons voisins (±10 %), à la même hauteur (±10 % du rayon), portés chacun par
    au moins 20 % de leurs points, et espacés de plus de deux rayons."""
    a, b = circles
    r = (a['r'] + b['r']) / 2
    return (abs(a['r'] - b['r']) < 0.1 * r and abs(a['cy'] - b['cy']) < 0.1 * r
            and min(c['n'] / max(1, c['points']) for c in circles) >= 0.2 and b['cx'] - a['cx'] > 2 * r)


def place(im, arches):
    """Échelle (cm/px) et fenêtre source (en flottants) qui envoient les centres d'arches sur les axes
    du gabarit ; rééchantillonnage Lanczos sur l'alpha prémultiplié, sans arrondi de position."""
    (r_, f_) = arches
    dx, dy = f_['cx'] - r_['cx'], f_['cy'] - r_['cy']
    cm_per_px = 150.0 / np.hypot(dx, dy)
    tilt_deg = np.degrees(np.arctan2(dy, dx))
    pad = int(np.ceil(FRAME_W_CM / cm_per_px)) + 4
    padded = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    padded.paste(im, (pad, pad))
    # Indices de pixels → coordonnées continues (centre du pixel à i + 0,5).
    mx = (r_['cx'] + f_['cx']) / 2 + 0.5 + pad
    my = (r_['cy'] + f_['cy']) / 2 + 0.5 + pad
    box = (mx - (FRAME_W_CM / 2) / cm_per_px, my - (FRAME_H_CM / 2 + 25) / cm_per_px,
           mx + (FRAME_W_CM / 2) / cm_per_px, my + (FRAME_H_CM / 2 - 25) / cm_per_px)
    canvas = padded.convert('RGBa').resize((OUT_W, OUT_H), Image.LANCZOS, box=box).convert('RGBA')
    return canvas, {'cm_per_px': cm_per_px, 'tilt_deg': tilt_deg, 'box': box, 'pad': pad,
                    'radii_cm': [a['r'] * cm_per_px for a in arches], 'dy_cm': dy * cm_per_px}


def cut_outside(im, m, r_erase):
    """Pixels opaques de la source hors du cadre, sauf ceux de la zone effacée (roues dessinées)."""
    box, pad, k = m['box'], m['pad'], m['cm_per_px']
    ys, xs = np.nonzero(alpha_mask(im))
    xc, yc = xs + 0.5 + pad, ys + 0.5 + pad
    out = (xc < box[0]) | (xc > box[2]) | (yc < box[1]) | (yc > box[3])
    xcm = (xc - box[0]) * k - FRAME_W_CM / 2   # coordonnées du gabarit (cm)
    ycm = (yc - box[1]) * k - FRAME_H_CM / 2
    for (ax, ay) in AXLES_CM:
        out &= np.hypot(xcm - ax, ycm - ay) >= r_erase
    return int(out.sum())


def to_out_px(xcm, ycm):
    return ((xcm + FRAME_W_CM / 2) * PX_PER_CM, (ycm + FRAME_H_CM / 2) * PX_PER_CM)


def erase_arches(canvas, r_cm):
    a = np.array(canvas)
    yy, xx = np.mgrid[0:OUT_H, 0:OUT_W]
    erased = 0
    for (ax, ay) in AXLES_CM:
        cx, cy = to_out_px(ax, ay)
        inside = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy) < r_cm * PX_PER_CM
        erased += int((a[:, :, 3][inside] > 24).sum())
        a[:, :, 3][inside] = 0
    return Image.fromarray(a), erased


def quantize(canvas, path):
    q = canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    # L'octree mêle l'alpha des couleurs voisines : des entrées de la carrosserie opaque sortent à 250-254.
    pal = q.getpalette('RGBA')
    for i in range(3, len(pal), 4):
        if pal[i] >= OPAQUE_FROM:
            pal[i] = 255
    q.putpalette(pal, 'RGBA')
    q.save(path, optimize=True)
    return os.path.getsize(path)


def preview(canvas, wheel_path, calque_path, path, scale=2):
    W, H = OUT_W * scale, OUT_H * scale
    sky = Image.new('RGBA', (W, H), SKY)
    car = canvas.resize((W, H), Image.LANCZOS)
    sky.alpha_composite(car)
    if wheel_path:
        wheel = Image.open(wheel_path).convert('RGBA')
        d = round(2 * WHEEL_R_CM * PX_PER_CM * scale)
        wheel = wheel.resize((d, d), Image.LANCZOS)
        for (ax, ay) in AXLES_CM:
            cx, cy = to_out_px(ax, ay)
            sky.alpha_composite(wheel, (round(cx * scale - d / 2), round(cy * scale - d / 2)))
    with_overlay = sky.copy()
    if calque_path:
        cal = Image.open(calque_path).convert('RGBA').resize((W, H), Image.LANCZOS)
        with_overlay.alpha_composite(cal)
    out = Image.new('RGBA', (W, 2 * H + 8), (255, 255, 255, 255))
    out.paste(sky, (0, 0))
    out.paste(with_overlay, (0, H + 8))
    out.convert('RGB').save(path)


def main():
    src, out, prev = sys.argv[1:4]
    calque = sys.argv[4] if len(sys.argv) > 4 else None
    wheel = sys.argv[5] if len(sys.argv) > 5 else None
    im = Image.open(src).convert('RGBA')
    px = np.array(im)
    px[:, :, 3][px[:, :, 3] >= OPAQUE_FROM] = 255
    im = Image.fromarray(px)
    mask = alpha_mask(im)
    arches, bbox = find_arches(mask)
    mode = 'arches vides'
    if not plausible(arches):
        wheels = find_wheels(mask)
        if plausible(wheels):
            arches, mode = wheels, 'roues dessinées'
    elif all('roue_r' in a for a in arches):
        mode = 'arches et roues dessinées'
    canvas, m = place(im, arches)
    if mode == 'arches vides':
        # Intérieur des arches : ce qui reste (reflets, morceau de roue) part, le bord reste.
        r_erase = min(min(m['radii_cm']), ARCH_R_CM) - 1.0
    elif mode == 'arches et roues dessinées':
        # Les roues dessinées partent en entier (wheel.png les remplace), sans entamer l'arche.
        wheel_cm = max(a['roue_r'] for a in arches) * m['cm_per_px']
        r_erase = min(wheel_cm + 1.0, min(m['radii_cm']) - 1.0)
    else:
        # Roues dessinées serrées dans l'arche : elles partent en entier ; l'arche n'est pas mesurée.
        r_erase = max(m['radii_cm']) + 1.0
    canvas, erased = erase_arches(canvas, r_erase)
    cut = cut_outside(im, m, r_erase)
    # Roues dessinées, même serrées dans l'arche : la zone effacée était surtout opaque.
    drawn = erased > 0.3 * 2 * np.pi * (r_erase * PX_PER_CM) ** 2
    size = quantize(canvas, out)
    preview(Image.open(out).convert('RGBA'), wheel, calque, prev)
    rmin, rmax = (WHEEL_R_CM - 3, WHEEL_R_CM + 3) if mode == 'roues dessinées' else (ARCH_MIN, ARCH_MAX)
    checks = {k: bool(v) for k, v in {
        f'cercles ({mode}) dans [{rmin:g} ; {rmax:g}] cm': all(rmin <= r <= rmax for r in m['radii_cm']),
        'centres à la même hauteur (≤ 3 cm)': abs(m['dy_cm']) <= 3.0,
        'pente ≤ 1,5°': abs(m['tilt_deg']) <= 1.5,
        'rien de coupé par le cadre (hors zone effacée)': cut == 0,
        'taille ≤ 60 KB': size <= 60 * 1024,
    }.items()}
    report = {
        'source': src, 'taille_source': list(im.size), 'bbox_alpha': bbox, 'mode': mode,
        'cercles_px': [{k: round(float(v), 1) for k, v in a.items()} for a in arches],
        'echelle_cm_par_px_source': round(m['cm_per_px'], 4),
        'rayons_cm': [round(r, 1) for r in m['radii_cm']], 'rayon_efface_cm': round(r_erase, 1),
        'ecart_hauteur_centres_cm': round(m['dy_cm'], 2), 'pente_deg': round(m['tilt_deg'], 2),
        'opaque_coupe_px_source': cut, 'opaque_efface_px': erased, 'roues_dessinees': bool(drawn),
        'taille_png8_octets': size, 'controles': checks, 'accepte': bool(all(checks.values())),
    }
    print(json.dumps(report, ensure_ascii=False, indent=1, default=float))


if __name__ == '__main__':
    main()
