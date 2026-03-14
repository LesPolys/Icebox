import type { CardInstance } from "./card.js";
import type { ResourceCost } from "./resource.js";
/** The three deck system */
/** The Vault: all possible cards for this timeline (source pool) */
export interface VaultState {
    cards: CardInstance[];
}
/** The World Deck: cards currently available for the market and events */
export interface WorldDeckState {
    drawPile: CardInstance[];
}
/** A single row of the dual-row Transit Market */
export interface MarketRowState {
    /** Slots in this row. Index 0 = leftmost (fallout). Last index = newest. */
    slots: (CardInstance | null)[];
    /** Resources invested on each slot (parallel to slots). null = no investment. */
    investments: (ResourceCost | null)[];
}
/** The Transit Market (Conveyor): two rows of 6 slots each */
export interface TransitMarketState {
    /** Row A: Physical — hardware, repairs, environmental hazards */
    physicalRow: MarketRowState;
    /** Row B: Social — policies, factions, cultural events */
    socialRow: MarketRowState;
    /** Maximum number of slots per row */
    maxSlotsPerRow: number;
}
export type MarketRowId = "physical" | "social";
/** Helper: get all market slots across both rows as a flat array */
export declare function getAllMarketSlots(market: TransitMarketState): (CardInstance | null)[];
/** Helper: get all non-null cards currently in the market */
export declare function getAllMarketCards(market: TransitMarketState): CardInstance[];
/** Helper: get a specific row by ID */
export declare function getMarketRowById(market: TransitMarketState, rowId: MarketRowId): MarketRowState;
/** Helper: create an empty market row */
export declare function createEmptyRow(slotsPerRow: number): MarketRowState;
/** The Mandate Deck: player's personal deck */
export interface MandateDeckState {
    drawPile: CardInstance[];
    hand: CardInstance[];
    discardPile: CardInstance[];
}
/** Legacy archive: cards that persist permanently across sleeps */
export interface LegacyArchiveState {
    cards: CardInstance[];
}
/** Graveyard: dead cards */
export interface GraveyardState {
    cards: CardInstance[];
}
//# sourceMappingURL=deck.d.ts.map