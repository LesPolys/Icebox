import type { EntropyBreakpoint } from "../types/game-state.js";

/** Starting entropy level for a new game */
export const STARTING_ENTROPY = 0;

/** Maximum entropy before catastrophic failure */
export const MAX_ENTROPY = 40;

/** Entropy breakpoints — deterministic consequences at each threshold */
export const ENTROPY_BREAKPOINTS: EntropyBreakpoint[] = [
  {
    threshold: 10,
    effect: "minor-decay",
    description: "Systems strain — minor structural wear accelerates.",
  },
  {
    threshold: 20,
    effect: "power-fluctuations",
    description: "Power grid unstable — some tableau cards lose power.",
  },
  {
    threshold: 30,
    effect: "structural-warnings",
    description: "Hull stress detected — junk cards enter the mandate deck.",
  },
  {
    threshold: 40,
    effect: "critical-failure",
    description: "Ship in crisis — hull damage and cascading system failures.",
  },
];

/** Entropy added per cryosleep cycle */
export const ENTROPY_PER_SLEEP_CYCLE = 3;

/** Entropy added per fast-tracked construction turn */
export const ENTROPY_PER_FAST_TRACK = 2;

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
