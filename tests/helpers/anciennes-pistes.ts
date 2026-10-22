// Pistes d'avant (plan B, tâche 5e, Step 10 ; addendum « bouton saut » §6.9) : l'interrupteur qui redonne, au bit
// près, les pistes de e02dcae SANS étoiles hautes (ni plats étoile, ni fosses, pas du curseur [60, 100], étoiles basses
// dès le début des réceptions : `STAR_TREMPLIN_LANDING` 0, tâche 5g). Les tests
// qui jugent la physique ou comparent à une mesure d'avant (empreinte, PLAN_A_TRACE, PRE_5E_STARS, phases, dosage,
// calibrations, rejeu d'interpolation, rattrapage apparié) tournent sur ces pistes ; les tests d'acceptation du jeu
// tournent sur CONFIG.
import { CONFIG, type Config } from '../../src/config';

/**
 * Valeurs des pistes d'avant. `STAR_FLATS_PER_RACE` (fin de la 5e), `FOSSE_PERIOD` et `STAR_TREMPLIN_LANDING` (5g) ne
 * sont posées que si la configuration les connaît : sans elles, le générateur fait déjà les pistes d'avant.
 * `STAR_TREMPLIN_LANDING` 0 (tâche 5g, ruling : clé ajoutée à l'interrupteur de la spec §6.9) redonne la zone du
 * curseur [xReception, xEnd] des tremplins ; sans fosse, `STAR_FOSSE_LANDING` ne sert pas.
 */
export const ANCIENNES_PISTES: Readonly<Record<string, number>> = {
  STAR_FLATS_PER_RACE: 0, FOSSE_PERIOD: 0, STAR_HIGH_PER_RACE: 0, STAR_STEP_MIN: 60, STAR_STEP_MAX: 100,
  STAR_TREMPLIN_LANDING: 0,
};

/** `cfg` avec les pistes d'avant (clés d'`ANCIENNES_PISTES` présentes dans `cfg` seulement). */
export function withAnciennesPistes(cfg: Config = CONFIG): Config {
  const out: Record<string, number> = { ...cfg };
  for (const [k, v] of Object.entries(ANCIENNES_PISTES)) if (k in cfg) out[k] = v;
  return out as Config;
}

/** CONFIG sur les pistes d'avant. */
export const AP: Config = withAnciennesPistes(CONFIG);
