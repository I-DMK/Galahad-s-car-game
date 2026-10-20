/** Générateur pseudo-aléatoire déterministe : renvoie des nombres dans [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tire un élément avec une probabilité proportionnelle à son poids. */
export function pickWeighted<T>(rng: () => number, items: { item: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rng() * total;
  for (const { item, weight } of items) {
    if (weight <= 0) continue;
    if (r < weight) return item;
    r -= weight;
  }
  // Arrondis flottants : repli sur le dernier élément de poids > 0.
  for (let i = items.length - 1; i >= 0; i--) if (items[i].weight > 0) return items[i].item;
  throw new Error('pickWeighted: aucun poids strictement positif');
}
