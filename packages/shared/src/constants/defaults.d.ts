import type { ResourceTotals } from "../types/resource.js";
/** Starting resources for a new game */
export declare const STARTING_RESOURCES: ResourceTotals;
/** Default hand size limit */
export declare const DEFAULT_HAND_SIZE = 6;
/** Number of cards drawn automatically at start of each turn */
export declare const AUTO_DRAW_COUNT = 1;
/** Cost to draw an extra card (1 of any resource) */
export declare const EXTRA_DRAW_COST = 1;
/** Number of market slots (total across both rows) */
export declare const MARKET_SLOTS = 12;
/** Number of slots per market row */
export declare const MARKET_SLOTS_PER_ROW = 6;
/** Starting hull integrity (0-100) */
export declare const STARTING_HULL_INTEGRITY = 100;
/** Years per cryosleep cycle */
export declare const YEARS_PER_SLEEP = 100;
/** Maximum journey length in years */
export declare const MAX_YEARS = 1000;
/** Hull damage per junk card from inertia failure */
export declare const HULL_DAMAGE_PER_JUNK = 10;
/** Number of sectors on the ship */
export declare const SECTOR_COUNT = 3;
/** Default structure slots per sector */
export declare const DEFAULT_STRUCTURE_SLOTS = 3;
/** Minimum mandate deck size — if below this after sleep, draw from world deck */
export declare const MIN_MANDATE_DECK_SIZE = 12;
/** Starting mandate deck size for a new game */
export declare const STARTING_MANDATE_DECK_SIZE = 15;
/** Archive slots formula: min(MAX_ARCHIVE, sleepDuration + 1) */
export declare const MAX_ARCHIVE_SLOTS = 8;
/** Calculate archive slots for a given sleep duration */
export declare function calculateArchiveSlots(sleepDuration: number): number;
//# sourceMappingURL=defaults.d.ts.map