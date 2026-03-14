export type { ResourceType, ResourceCost, ResourceTotals, } from "./types/resource.js";
export type { FactionId, FactionDefinition, } from "./types/faction.js";
export type { CardType, CardTier, EffectTiming, EffectType, CardEffect, EffectCondition, DecayCondition, DeathOutcome, CardAging, CryosleepMeta, LocationData, HazardData, JunkSource, JunkData, Card, CardInstance, CardZone, } from "./types/card.js";
export type { SectorState, ShipState, } from "./types/board.js";
export type { VaultState, WorldDeckState, MarketRowState, TransitMarketState, MarketRowId, MandateDeckState, LegacyArchiveState, GraveyardState, } from "./types/deck.js";
export type { EntropyThresholds, GamePhase, GameState, } from "./types/game-state.js";
export { PALETTE, HEX, NUM } from "./constants/palette.js";
export { FACTIONS, getFaction } from "./constants/factions.js";
export { STARTING_THRESHOLDS, THRESHOLD_ESCALATION_PER_CYCLE, SEVERITY_DIVISORS, RESOURCE_DRAIN_PER_CYCLE, MAX_SLEEP_DURATION, MIN_SLEEP_DURATION, DOMINANT_FACTION_CARDS_PER_CYCLE, WEAKEST_FACTION_REMOVAL_PER_CYCLE, } from "./constants/thresholds.js";
export { STARTING_RESOURCES, DEFAULT_HAND_SIZE, AUTO_DRAW_COUNT, EXTRA_DRAW_COST, MARKET_SLOTS, MARKET_SLOTS_PER_ROW, STARTING_HULL_INTEGRITY, YEARS_PER_SLEEP, MAX_YEARS, HULL_DAMAGE_PER_JUNK, SECTOR_COUNT, DEFAULT_STRUCTURE_SLOTS, MIN_MANDATE_DECK_SIZE, STARTING_MANDATE_DECK_SIZE, MAX_ARCHIVE_SLOTS, calculateArchiveSlots, } from "./constants/defaults.js";
export { ALL_FACTION_IDS } from "./types/faction.js";
export { RESOURCE_DOMAINS, totalResourceCost, canAfford, spendResources, gainResources } from "./types/resource.js";
export { SECTOR_NAMES } from "./types/board.js";
export { getAllMarketSlots, getAllMarketCards, getMarketRowById, createEmptyRow } from "./types/deck.js";
export { shuffle, seededShuffle, drawCards, generateInstanceId } from "./utils/shuffle.js";
export { validateCard } from "./utils/validate-card.js";
export type { ValidationError } from "./utils/validate-card.js";
export { getMarketRow, resetMarketRowCounter } from "./utils/market-row.js";
//# sourceMappingURL=index.d.ts.map