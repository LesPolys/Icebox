import type { EntropyThresholds } from "../types/game-state.js";

/** Starting entropy thresholds (before any sleep cycles) */
export const STARTING_THRESHOLDS: EntropyThresholds = {
  hullBreach: 5,   // Matter threshold
  powerDown: 4,    // Energy threshold
  techDecay: 6,    // Data threshold
  coup: 4,         // Influence threshold
};

/** How much thresholds increase per sleep cycle */
export const THRESHOLD_ESCALATION_PER_CYCLE = 1;

/** Severity divisors — how much deficit translates into negative effects */
export const SEVERITY_DIVISORS = {
  hullBreach: 3,   // 1 junk card per 3 deficit
  powerDown: 4,    // 1 depowered card per 4 deficit
  techDecay: 5,    // 1 card removed per 5 deficit
  coup: 5,         // 1 law change per 5 deficit
};

/** Resource drain per sleep cycle (passive entropy) */
export const RESOURCE_DRAIN_PER_CYCLE = {
  matter: 1,
  energy: 1,
  data: 1,
  influence: 1,
};

/** Max sleep duration the player can choose */
export const MAX_SLEEP_DURATION = 5;

/** Min sleep duration */
export const MIN_SLEEP_DURATION = 1;

/** Cards added to world deck per cycle by dominant faction */
export const DOMINANT_FACTION_CARDS_PER_CYCLE = 2;

/** Cards removed from world deck per cycle for weakest faction */
export const WEAKEST_FACTION_REMOVAL_PER_CYCLE = 1;
