import type { EntropyThresholds } from "../types/game-state.js";
/** Starting entropy thresholds (before any sleep cycles) */
export declare const STARTING_THRESHOLDS: EntropyThresholds;
/** How much thresholds increase per sleep cycle */
export declare const THRESHOLD_ESCALATION_PER_CYCLE = 1;
/** Severity divisors — how much deficit translates into negative effects */
export declare const SEVERITY_DIVISORS: {
    hullBreach: number;
    powerDown: number;
    techDecay: number;
    coup: number;
};
/** Resource drain per sleep cycle (passive entropy) */
export declare const RESOURCE_DRAIN_PER_CYCLE: {
    matter: number;
    energy: number;
    data: number;
    influence: number;
};
/** Max sleep duration the player can choose */
export declare const MAX_SLEEP_DURATION = 5;
/** Min sleep duration */
export declare const MIN_SLEEP_DURATION = 1;
/** Cards added to world deck per cycle by dominant faction */
export declare const DOMINANT_FACTION_CARDS_PER_CYCLE = 2;
/** Cards removed from world deck per cycle for weakest faction */
export declare const WEAKEST_FACTION_REMOVAL_PER_CYCLE = 1;
//# sourceMappingURL=thresholds.d.ts.map