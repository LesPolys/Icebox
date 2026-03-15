import type { EraState, EraModifiers } from "../types/game-state.js";

/** Modifier values for each Era state */
export const ERA_MODIFIERS: Record<EraState, EraModifiers> = {
  Zenith: {
    marketSlideModifier: 1,        // market moves faster — prosperity breeds complacency
    maintenanceCostModifier: 0.8,   // cheaper maintenance — systems are well-oiled
    constructionTimeModifier: 0,    // normal construction
  },
  Unraveling: {
    marketSlideModifier: 0,         // normal market speed
    maintenanceCostModifier: 1.2,   // more expensive maintenance — supply chains breaking
    constructionTimeModifier: 1,    // construction takes longer — workforce stretched thin
  },
  Struggle: {
    marketSlideModifier: 0,         // normal market speed
    maintenanceCostModifier: 0.5,   // cheaper maintenance — everyone focused on survival
    constructionTimeModifier: 1,    // construction slower — resources scarce
  },
  Ascension: {
    marketSlideModifier: -1,        // market slows — controlled expansion
    maintenanceCostModifier: 1.0,   // normal maintenance
    constructionTimeModifier: -2,   // construction much faster — engineering golden age
  },
};

/** Thresholds for Era state transitions.
 * "High" reserves = total resources >= this value.
 * "High" entropy = entropy gauge >= this value.
 */
export const ERA_TRANSITION_THRESHOLDS = {
  /** Total resource sum considered "high reserves" */
  highReserves: 16,
  /** Total resource sum considered "low reserves" */
  lowReserves: 10,
  /** Entropy value considered "high entropy" */
  highEntropy: 20,
  /** Entropy value considered "low entropy" */
  lowEntropy: 10,
};

/** Default starting era for a new game */
export const STARTING_ERA: EraState = "Zenith";
