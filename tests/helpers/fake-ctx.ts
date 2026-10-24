// Faux contexte 2D : enregistre chaque appel de méthode, avec le `fillStyle` et le `globalAlpha` courants au moment
// de l'appel (sorti de render-smoke.test.ts à la tâche 8b pour le partager avec le dessin des images).

/** Appel de méthode du contexte, avec le fillStyle et le globalAlpha courants au moment de l'appel. */
export type Call = { name: string; args: unknown[]; fillStyle?: unknown; globalAlpha?: unknown };

export function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const gradient = { addColorStop: () => {} };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({ name: prop, args, fillStyle: target.fillStyle, globalAlpha: target.globalAlpha });
        return prop.startsWith('create') ? gradient : undefined;
      };
    },
    set(target, prop: string, value) { target[prop] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
