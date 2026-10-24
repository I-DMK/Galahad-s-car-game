// Police du jeu (plan B, tâche 10 ; addendum « présentation » §2) : Fredoka, auto-hébergée (`public/fonts/`, @font-face
// dans `index.html` avec `font-display: swap`), `system-ui` tant qu'elle n'est pas prête : aucun texte ne l'attend.
// Sans DOM hors de `loadFont(doc)` : `render/car.ts` importe `canvasFont` pour les prénoms sur le canvas.

export const FONT_FAMILY = 'Fredoka, system-ui, sans-serif';

/** Chaîne pour `ctx.font` : `${weight} ${px}px ${FONT_FAMILY}` (px arrondi). */
export function canvasFont(weight: 600 | 700, px: number): string {
  return `${weight} ${Math.round(px)}px ${FONT_FAMILY}`;
}

/**
 * Demande la police au navigateur (`doc.fonts.load('700 20px Fredoka')`) ; vrai si elle est prête, faux sans `doc.fonts`
 * (jsdom) ou en cas d'échec ; ne lève jamais.
 */
export function loadFont(doc: Document): Promise<boolean> {
  try {
    const fonts = (doc as { fonts?: { load(font: string): Promise<unknown> } }).fonts;
    if (!fonts) return Promise.resolve(false);
    return fonts.load('700 20px Fredoka').then(() => true, () => false);
  } catch {
    return Promise.resolve(false);
  }
}
