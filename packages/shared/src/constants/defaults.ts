import type { ResourceTotals } from "../types/resource.js";

/** Starting resources for a new game */
export const STARTING_RESOURCES: ResourceTotals = {
  matter: 8,
  energy: 6,
  data: 5,
  influence: 5,
};

/** Default hand size limit */
export const DEFAULT_HAND_SIZE = 6;

/** Number of cards drawn automatically at start of each turn */
export const AUTO_DRAW_COUNT = 1;

/** Cost to draw an extra card (1 of any resource) */
export const EXTRA_DRAW_COST = 1;

/** Number of market slots */
export const MARKET_SLOTS = 12;

/** Number of sectors on the ship */
export const SECTOR_COUNT = 3;

/** Default structure slots per sector */
export const DEFAULT_STRUCTURE_SLOTS = 3;

/** Minimum mandate deck size — if below this after sleep, draw from world deck */
export const MIN_MANDATE_DECK_SIZE = 12;

/** Starting mandate deck size for a new game */
export const STARTING_MANDATE_DECK_SIZE = 15;

/** Archive slots formula: min(MAX_ARCHIVE, sleepDuration + 1) */
export const MAX_ARCHIVE_SLOTS = 8;

/** Calculate archive slots for a given sleep duration */
export function calculateArchiveSlots(sleepDuration: number): number {
  return Math.min(MAX_ARCHIVE_SLOTS, sleepDuration + 1);
}
