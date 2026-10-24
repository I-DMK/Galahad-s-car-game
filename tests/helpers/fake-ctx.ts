// Faux contexte 2D : enregistre chaque appel de méthode avec l'état courant au moment de l'appel (`fillStyle`,
// `globalAlpha`, transformation, profondeur de la pile `save`/`restore`). Sorti de render-smoke.test.ts à la tâche 8b ;
// au tour 1, il suit la vraie pile d'états du canvas (`save` empile `globalAlpha`, `fillStyle` et la transformation,
// `restore` les rend) pour que les tests voient une fuite d'état (ombre dont l'opacité reste posée, roue sans `restore`).

/** Transformation courante [a, b, c, d, e, f], dans l'ordre de `DOMMatrix` ; l'identité au départ. */
export type Matrix = [number, number, number, number, number, number];

/** Appel de méthode du contexte, avec l'état courant AVANT que l'appel ne s'applique. */
export type Call = {
  name: string;
  args: unknown[];
  fillStyle?: unknown;
  globalAlpha?: unknown;
  matrix: Matrix;
  /** Profondeur de la pile `save`/`restore` (0 : aucun `save` en cours). */
  depth: number;
};

export interface FakeCtx {
  ctx: CanvasRenderingContext2D;
  calls: Call[];
  /** État courant : à lire après un dessin pour voir ce qu'il laisse derrière lui. */
  state(): { globalAlpha: unknown; fillStyle: unknown; matrix: Matrix; depth: number; underflows: number };
}

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** M × T(tx, ty), M × R(θ), M × S(sx, sy) : composition à droite, comme le canvas. */
function translated([a, b, c, d, e, f]: Matrix, tx: number, ty: number): Matrix {
  return [a, b, c, d, a * tx + c * ty + e, b * tx + d * ty + f];
}
function rotated([a, b, c, d, e, f]: Matrix, th: number): Matrix {
  const cos = Math.cos(th), sin = Math.sin(th);
  return [a * cos + c * sin, b * cos + d * sin, -a * sin + c * cos, -b * sin + d * cos, e, f];
}
function scaled([a, b, c, d, e, f]: Matrix, sx: number, sy: number): Matrix {
  return [a * sx, b * sx, c * sy, d * sy, e, f];
}

export function fakeCtx(): FakeCtx {
  const calls: Call[] = [];
  const gradient = { addColorStop: () => {} };
  const target: Record<string, unknown> = { globalAlpha: 1 };
  let matrix: Matrix = [...IDENTITY];
  const stack: { globalAlpha: unknown; fillStyle: unknown; matrix: Matrix }[] = [];
  let underflows = 0;
  const ctx = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return (...args: unknown[]) => {
        calls.push({ name: prop, args, fillStyle: t.fillStyle, globalAlpha: t.globalAlpha, matrix: [...matrix], depth: stack.length });
        const n = (i: number) => args[i] as number;
        switch (prop) {
          case 'save': stack.push({ globalAlpha: t.globalAlpha, fillStyle: t.fillStyle, matrix: [...matrix] }); break;
          case 'restore': {
            const s = stack.pop();
            if (!s) { underflows++; break; }
            t.globalAlpha = s.globalAlpha;
            t.fillStyle = s.fillStyle;
            matrix = s.matrix;
            break;
          }
          case 'translate': matrix = translated(matrix, n(0), n(1)); break;
          case 'rotate': matrix = rotated(matrix, n(0)); break;
          case 'scale': matrix = scaled(matrix, n(0), n(1)); break;
          case 'setTransform': matrix = [n(0), n(1), n(2), n(3), n(4), n(5)]; break;
          default: break;
        }
        return prop.startsWith('create') ? gradient : undefined;
      };
    },
    set(t, prop: string, value) { t[prop] = value; return true; },
  });
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    calls,
    state: () => ({ globalAlpha: target.globalAlpha, fillStyle: target.fillStyle, matrix: [...matrix], depth: stack.length, underflows }),
  };
}
