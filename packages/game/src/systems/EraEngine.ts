import type { GameState, EraState, EraModifiers, ResourceTotals } from "@icebox/shared";
import { ERA_MODIFIERS, ERA_TRANSITION_THRESHOLDS, totalResourceCost } from "@icebox/shared";

/**
 * Calculate total resource reserves as a single number.
 */
function totalReserves(resources: ResourceTotals): number {
  return resources.matter + resources.energy + resources.data + resources.influence;
}

/**
 * Determine the new Era state based on current reserves and entropy.
 * All eras are reachable from any other era.
 * Transition rules:
 *   Zenith:     High Reserves + Low Entropy
 *   Unraveling: Low Reserves + Low Entropy
 *   Struggle:   Low Reserves + High Entropy
 *   Ascension:  High Reserves + High Entropy
 *
 * If no transition matches, the current Era persists.
 */
export function determineEraState(
  currentEra: EraState,
  resources: ResourceTotals,
  entropy: number
): EraState {
  const reserves = totalReserves(resources);
  const t = ERA_TRANSITION_THRESHOLDS;

  const highReserves = reserves >= t.highReserves;
  const lowReserves = reserves <= t.lowReserves;
  const highEntropy = entropy >= t.highEntropy;
  const lowEntropy = entropy <= t.lowEntropy;

  if (highReserves && lowEntropy) return "Zenith";
  if (lowReserves && lowEntropy) return "Unraveling";
  if (lowReserves && highEntropy) return "Struggle";
  if (highReserves && highEntropy) return "Ascension";

  // No transition — stay in current era
  return currentEra;
}

/**
 * Get the modifiers for a given Era state.
 */
export function getEraModifiers(era: EraState): EraModifiers {
  return { ...ERA_MODIFIERS[era] };
}

/**
 * Apply Era transition at the end of cryosleep.
 * Determines the new Era and sets modifiers on the game state.
 */
export function applyEraTransition(state: GameState): GameState {
  const s = structuredClone(state);
  const newEra = determineEraState(s.era, s.resources, s.entropy);
  s.era = newEra;
  s.eraModifiers = getEraModifiers(newEra);
  return s;
}
