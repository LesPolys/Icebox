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
  /** Upper deck row */
  upperRow: MarketRowState;
  /** Lower deck row */
  lowerRow: MarketRowState;
  /** Maximum number of slots per row */
  maxSlotsPerRow: number;
}

export type MarketRowId = "upper" | "lower";

/** Helper: get all market slots across both rows as a flat array */
export function getAllMarketSlots(market: TransitMarketState): (CardInstance | null)[] {
  return [...market.upperRow.slots, ...market.lowerRow.slots];
}

/** Helper: get all non-null cards currently in the market */
export function getAllMarketCards(market: TransitMarketState): CardInstance[] {
  return getAllMarketSlots(market).filter((s): s is CardInstance => s !== null);
}

/** Helper: get a specific row by ID */
export function getMarketRowById(market: TransitMarketState, rowId: MarketRowId): MarketRowState {
  return rowId === "upper" ? market.upperRow : market.lowerRow;
}

/** Helper: create an empty market row */
export function createEmptyRow(slotsPerRow: number): MarketRowState {
  return {
    slots: new Array(slotsPerRow).fill(null),
    investments: new Array(slotsPerRow).fill(null),
  };
}

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
