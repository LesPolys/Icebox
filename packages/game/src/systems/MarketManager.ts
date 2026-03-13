import type {
  CardInstance,
  TransitMarketState,
  WorldDeckState,
} from "@icebox/shared";
import { MARKET_SLOTS } from "@icebox/shared";

/**
 * Pure logic for the Transit Market (Conveyor) system.
 * Cards slide left each turn. Leftmost falls out.
 */

export interface SlideResult {
  market: TransitMarketState;
  worldDeck: WorldDeckState;
  falloutCard: CardInstance | null;
  newCard: CardInstance | null;
}

/**
 * Slide the market left by 1. Leftmost card falls out.
 * A new card enters from the world deck on the right.
 */
export function slideMarket(
  market: TransitMarketState,
  worldDeck: WorldDeckState
): SlideResult {
  const slots = [...market.slots];
  const drawPile = [...worldDeck.drawPile];

  // Pop the leftmost card (fallout)
  const falloutCard = slots.shift() ?? null;
  if (falloutCard) {
    falloutCard.zone = "discard"; // will be processed by fallout handler
  }

  // Draw a new card from world deck for the right side
  let newCard: CardInstance | null = null;
  if (drawPile.length > 0) {
    newCard = drawPile.shift()!;
    newCard.zone = "transit-market";
    slots.push(newCard);
  } else {
    slots.push(null); // empty slot if world deck is empty
  }

  // Ensure we always have maxSlots entries
  while (slots.length < market.maxSlots) {
    slots.push(null);
  }

  return {
    market: { ...market, slots },
    worldDeck: { drawPile },
    falloutCard,
    newCard,
  };
}

/**
 * Slide the market by N slots (for Flux effects).
 */
export function slideMarketMultiple(
  market: TransitMarketState,
  worldDeck: WorldDeckState,
  count: number
): { market: TransitMarketState; worldDeck: WorldDeckState; falloutCards: CardInstance[] } {
  let currentMarket = market;
  let currentWorldDeck = worldDeck;
  const falloutCards: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    const result = slideMarket(currentMarket, currentWorldDeck);
    currentMarket = result.market;
    currentWorldDeck = result.worldDeck;
    if (result.falloutCard) {
      falloutCards.push(result.falloutCard);
    }
  }

  return { market: currentMarket, worldDeck: currentWorldDeck, falloutCards };
}

/**
 * Buy (acquire) a card from the market. Returns null if slot is empty.
 */
export function acquireFromMarket(
  market: TransitMarketState,
  slotIndex: number
): { card: CardInstance | null; market: TransitMarketState } {
  if (slotIndex < 0 || slotIndex >= market.maxSlots) {
    return { card: null, market };
  }

  const slots = [...market.slots];
  const card = slots[slotIndex];

  if (!card) return { card: null, market };

  slots[slotIndex] = null;
  card.zone = "discard"; // goes to player's discard after purchase

  return { card, market: { ...market, slots } };
}

/**
 * Fill all empty market slots from the world deck.
 * Used at game start and after cryosleep.
 */
export function fillMarket(
  market: TransitMarketState,
  worldDeck: WorldDeckState
): { market: TransitMarketState; worldDeck: WorldDeckState } {
  const slots = [...market.slots];
  const drawPile = [...worldDeck.drawPile];

  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === null && drawPile.length > 0) {
      const card = drawPile.shift()!;
      card.zone = "transit-market";
      slots[i] = card;
    }
  }

  return {
    market: { ...market, slots },
    worldDeck: { drawPile },
  };
}

/**
 * Flush the entire market (Cryosleep Phase 2).
 * Returns all cards and clears the market.
 */
export function flushMarket(
  market: TransitMarketState
): { flushedCards: CardInstance[]; market: TransitMarketState } {
  const flushedCards: CardInstance[] = [];
  const emptySlots: (CardInstance | null)[] = [];

  for (const slot of market.slots) {
    if (slot) {
      flushedCards.push(slot);
    }
    emptySlots.push(null);
  }

  return {
    flushedCards,
    market: { ...market, slots: emptySlots },
  };
}

/**
 * Get all non-null cards currently in the market.
 */
export function getMarketCards(market: TransitMarketState): CardInstance[] {
  return market.slots.filter((s): s is CardInstance => s !== null);
}
