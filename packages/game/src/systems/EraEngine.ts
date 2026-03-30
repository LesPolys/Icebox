import type { GameState, EraState, EraModifiers, ResourceTotals } from "@icebox/shared";
import { ERA_MODIFIERS, ERA_TRANSITION_THRESHOLDS } from "@icebox/shared";

/**
 * Calculate total resource reserves as a single number.
 */
function totalReserves(resources: ResourceTotals): number {
  return resources.matter + resources.energy + resources.data + resources.influence;
}

/**
 * Determine the new Era state based on current reserves.
 * Transition rules (reserves-only):
 *   Zenith:     High Reserves
 *   Ascension:  High Reserves, coming from Struggle
 *   Struggle:   Low Reserves
 *   Unraveling: Mid Reserves
 *
 * If no transition matches, the current Era persists.
 */
export function determineEraState(
  currentEra: EraState,
  resources: ResourceTotals
): EraState {
  const reserves = totalReserves(resources);
  const t = ERA_TRANSITION_THRESHOLDS;

  const highReserves = reserves >= t.highReserves;
  const lowReserves = reserves <= t.lowReserves;

  if (highReserves && currentEra === "Struggle") return "Ascension";
  if (highReserves) return "Zenith";
  if (lowReserves) return "Struggle";
  return "Unraveling";
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
  const newEra = determineEraState(s.era, s.resources);
  s.era = newEra;
  s.eraModifiers = getEraModifiers(newEra);
  return s;
}
