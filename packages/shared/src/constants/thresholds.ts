/**
 * Legacy thresholds module — re-exports from entropy.ts.
 * The per-resource EntropyThresholds system has been replaced
 * with the unified entropy gauge (0-40+).
 */
export {
  RESOURCE_DRAIN_PER_CYCLE,
  MAX_SLEEP_DURATION,
  MIN_SLEEP_DURATION,
  DOMINANT_FACTION_CARDS_PER_CYCLE,
  WEAKEST_FACTION_REMOVAL_PER_CYCLE,
} from "./entropy.js";
