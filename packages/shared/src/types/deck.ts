import type { CardInstance } from "./card.js";

/** The three deck system */

/** The Vault: all possible cards for this timeline (source pool) */
export interface VaultState {
  cards: CardInstance[];
}

/** The World Deck: cards currently available for the market and events */
export interface WorldDeckState {
  drawPile: CardInstance[];
}

/** The Transit Market (Conveyor): 12 slots, slides left, leftmost falls out */
export interface TransitMarketState {
  /** Slots 0-11. Index 0 = leftmost (fallout position). Index 11 = newest. */
  slots: (CardInstance | null)[];
  /** Maximum number of market slots */
  maxSlots: number;
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
