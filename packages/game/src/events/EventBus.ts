import Phaser from "phaser";

/**
 * Global event bus for cross-scene and system-to-scene communication.
 * Systems emit events, scenes listen and render.
 */
export const EventBus = new Phaser.Events.EventEmitter();

// ─── Event Names ─────────────────────────────────────────────────────

export const GameEvents = {
  // Resource changes
  RESOURCES_CHANGED: "resources-changed",

  // Deck operations
  CARD_DRAWN: "card-drawn",
  CARD_PLAYED: "card-played",
  CARD_DISCARDED: "card-discarded",
  CARD_ACQUIRED: "card-acquired",
  CARD_SLOTTED: "card-slotted",

  // Market
  MARKET_SLID: "market-slid",
  MARKET_FALLOUT: "market-fallout",
  MARKET_REFILLED: "market-refilled",

  // Turn flow
  TURN_STARTED: "turn-started",
  TURN_ENDED: "turn-ended",
  PLAYER_PASSED: "player-passed",

  // Cryosleep
  SLEEP_INITIATED: "sleep-initiated",
  SLEEP_CYCLE_STARTED: "sleep-cycle-started",
  SLEEP_CYCLE_COMPLETED: "sleep-cycle-completed",
  SLEEP_COMPLETED: "sleep-completed",
  INERTIA_CHECK: "inertia-check",
  MARKET_FLUSHED: "market-flushed",
  TRANSFORMATION_COMPLETE: "transformation-complete",
  AGING_TICK: "aging-tick",
  CARD_DIED: "card-died",
  CARD_TRANSFORMED: "card-transformed",

  // Legacy
  LEGACY_ARCHIVE_UPDATED: "legacy-archive-updated",
  SUCCESSION_STARTED: "succession-started",
  SUCCESSION_COMPLETED: "succession-completed",

  // Faction
  FACTION_DOMINANCE_CHANGED: "faction-dominance-changed",
  SECTOR_CONTROL_CHANGED: "sector-control-changed",

  // Game state
  GAME_STATE_LOADED: "game-state-loaded",
  GAME_SAVED: "game-saved",
  GAME_OVER: "game-over",
} as const;
