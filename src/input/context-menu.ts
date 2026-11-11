/**
 * Appui long sans menu contextuel (tâche 11d). Jusqu'à la tâche 11c, l'accélérateur au doigt (`Throttle`) empêchait le
 * `contextmenu` d'un doigt gardé posé ; il est retiré avec le gaz au doigt (la voiture roule seule), cette garde reste :
 * un doigt laissé sur l'écran n'ouvre jamais de menu. Rend la fonction qui retire l'écouteur.
 */
export function blockContextMenu(target: Window): () => void {
  const onContextMenu = (e: Event): void => {
    e.preventDefault();
  };
  target.addEventListener('contextmenu', onContextMenu);
  return () => target.removeEventListener('contextmenu', onContextMenu);
}
