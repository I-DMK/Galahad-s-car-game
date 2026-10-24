"""Retire le liseré magenta des images Grok (flammes, étoile ; la Terre à la tâche 16).

python3 -B -I tools/sprites/lisere.py <entree.png> <sortie.png>
(Pillow et numpy ; `-B` : pas de `tools/sprites/__pycache__/`, que .gitignore ne couvre pas.)

C'est ce que assets/README.md demande, « de la même façon » que pour la roue : la couleur du bord vient du
pixel opaque voisin, et tout alpha ≥ 240 passe à 255.

1. « rose » = r − g > 40 et b − g > 40 : aucune couleur légitime des flammes (rouge, orange, jaune, blanc),
   de l'étoile (crème) ni de la Terre n'y entre ;
2. garde-fou : l'image est refusée (code de sortie 2) si plus de 25 % de ses pixels d'alpha ≥ 240 sont roses.
   Mesuré : liam.png ≈ 50 % (carrosserie rose, à ne jamais passer), flammes ≈ 6 à 9 %, Terre ≈ 0,6 %,
   étoile 0 % ;
3. chaque pixel rose visible prend la couleur du pixel non rose d'alpha ≥ 240 le plus proche : la couleur
   se propage par couches de 4-voisins sur toute l'image, transparent compris, pour atteindre aussi les points
   roses isolés ; seuls les pixels roses changent de couleur, et leur alpha ne change pas ;
4. alpha ≥ 240 → 255 ;
5. PNG-8 par `quantize` de controle.py (octree + tramage, entrées de palette d'alpha ≥ 240 remises à 255) ;
   rapport JSON sur la sortie standard.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

# `python3 -I` n'ajoute pas le dossier du script à sys.path : on le fait pour importer controle.py.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from controle import OPAQUE_FROM, quantize  # noqa: E402

ROSE_MAX_PART = 0.25  # garde-fou : part de roses parmi les pixels d'alpha ≥ 240
VOISINS = ((-1, 0), (1, 0), (0, -1), (0, 1))


def rose(px):
    """Pixels roses (liseré magenta) ; px : int32, (h, w, 4)."""
    r, g, b = px[..., 0], px[..., 1], px[..., 2]
    return (r - g > 40) & (b - g > 40)


def shift(arr, dy, dx):
    """arr décalé de (dy, dx), bords remplis de zéros (pas d'enroulement, contrairement à np.roll)."""
    out = np.zeros_like(arr)
    h, w = arr.shape[:2]
    out[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = arr[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return out


def fix(px):  # px : int32, (h, w, 4)
    a = px[..., 3]
    target = rose(px) & (a > 0)
    filled = ~rose(px) & (a >= OPAQUE_FROM)
    rgb = px[..., :3].astype(np.float64)
    while (target & ~filled).any():
        acc = sum(shift(rgb * filled[..., None], dy, dx) for dy, dx in VOISINS)
        cnt = sum(shift(filled.astype(np.float64), dy, dx) for dy, dx in VOISINS)
        ready = ~filled & (cnt > 0)
        if not ready.any():
            break  # aucune source : rien à propager
        rgb[ready] = acc[ready] / cnt[ready][:, None]
        filled |= ready
    out = px.copy()
    out[..., :3][target] = np.clip(np.rint(rgb[target]), 0, 255)
    out[..., 3][a >= OPAQUE_FROM] = 255
    return out.astype(np.uint8), int(target.sum())


def mesure(px):
    """Roses visibles (alpha ≥ 16) et pixels d'alpha 240 à 254 : ce que le correctif doit ramener à 0."""
    px = px.astype(np.int32)
    a = px[..., 3]
    return {'roses_alpha_ge_16': int((rose(px) & (a >= 16)).sum()),
            'alpha_240_254': int(((a >= OPAQUE_FROM) & (a < 255)).sum())}


def main():
    if len(sys.argv) != 3:
        sys.exit('usage : python3 -B -I tools/sprites/lisere.py <entree.png> <sortie.png>')
    src, out = sys.argv[1:3]
    avant = np.array(Image.open(src).convert('RGBA'))
    px = avant.astype(np.int32)
    opaques = px[..., 3] >= OPAQUE_FROM
    part = float((rose(px) & opaques).sum()) / max(1, int(opaques.sum()))
    if part > ROSE_MAX_PART:
        print(f'{src} refusée : {part:.0%} des pixels opaques sont roses (> {ROSE_MAX_PART:.0%}) ; '
              f'c\'est une carrosserie rose, pas un liseré. Rien écrit.', file=sys.stderr)
        sys.exit(2)
    corrige, n_roses = fix(px)
    octets = quantize(Image.fromarray(corrige), out)
    apres = np.array(Image.open(out).convert('RGBA'))
    print(json.dumps({'source': os.path.basename(src), 'octets_avant': os.path.getsize(src), 'octets_apres': octets,
                      'roses_corriges': n_roses, 'avant': mesure(avant), 'apres': mesure(apres)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
