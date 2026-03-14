import type {
  CardInstance,
  TransitMarketState,
  MarketRowState,
  MarketRowId,
  WorldDeckState,
  ResourceCost,
  FactionId,
} from "@icebox/shared";
import { getMarketRowById } from "@icebox/shared";

/**
 * Pure logic for the dual-row Transit Market (Conveyor) system.
 * Each row slides independently. Leftmost card falls out (fallout).
 */

// ── Row-level operations ────────────────────────────────────────────

export interface RowSlideResult {
  row: MarketRowState;
  worldDeck: WorldDeckState;
  falloutCard: CardInstance | null;
  falloutInvestment: ResourceCost | null;
  newCard: CardInstance | null;
}

/**
 * Slide a single row left by 1. Leftmost card falls out.
 * Investments slide with cards.
 */
export function slideRow(
  row: MarketRowState,
  worldDeck: WorldDeckState
): RowSlideResult {
  const slots = [...row.slots];
  const investments = [...row.investments];
  const drawPile = [...worldDeck.drawPile];

  // Pop the leftmost card and investment (fallout)
  const falloutCard = slots.shift() ?? null;
  const falloutInvestment = investments.shift() ?? null;
  if (falloutCard) {
    falloutCard.zone = "discard";
  }

  // Draw a new card from world deck for the right side
  let newCard: CardInstance | null = null;
  if (drawPile.length > 0) {
    newCard = drawPile.shift()!;
    newCard.zone = "transit-market";
    slots.push(newCard);
  } else {
    slots.push(null);
  }
  investments.push(null); // New slot has no investment

  return {
    row: { slots, investments },
    worldDeck: { drawPile },
    falloutCard,
    falloutInvestment,
    newCard,
  };
}

// ── Market-level operations ─────────────────────────────────────────

export interface SlideResult {
  market: TransitMarketState;
  worldDeck: WorldDeckState;
  physicalFallout: { card: CardInstance | null; investment: ResourceCost | null };
  socialFallout: { card: CardInstance | null; investment: ResourceCost | null };
  claimedInvestments: { faction: FactionId; resources: ResourceCost }[];
}

/**
 * Slide both market rows left by 1.
 */
export function slideMarket(
  market: TransitMarketState,
  worldDeck: WorldDeckState
): SlideResult {
  // Slide physical row
  const physResult = slideRow(market.physicalRow, worldDeck);
  // Slide social row (using remaining world deck)
  const socResult = slideRow(market.socialRow, physResult.worldDeck);

  // Calculate claimed investments (faction claims resources on fallout)
  const claimedInvestments: { faction: FactionId; resources: ResourceCost }[] = [];

  for (const { card, investment } of [
    { card: physResult.falloutCard, investment: physResult.falloutInvestment },
    { card: socResult.falloutCard, investment: socResult.falloutInvestment },
  ]) {
    if (card && investment && card.card.faction !== "neutral") {
      claimedInvestments.push({
        faction: card.card.faction as FactionId,
        resources: investment,
      });
    }
  }

  return {
    market: {
      physicalRow: physResult.row,
      socialRow: socResult.row,
      maxSlotsPerRow: market.maxSlotsPerRow,
    },
    worldDeck: socResult.worldDeck,
    physicalFallout: { card: physResult.falloutCard, investment: physResult.falloutInvestment },
    socialFallout: { card: socResult.falloutCard, investment: socResult.falloutInvestment },
    claimedInvestments,
  };
}

/**
 * Slide both rows by N slots (for Flux effects).
 */
export function slideMarketMultiple(
  market: TransitMarketState,
  worldDeck: WorldDeckState,
  count: number
): { market: TransitMarketState; worldDeck: WorldDeckState; allFallout: { card: CardInstance; row: MarketRowId }[] } {
  let currentMarket = market;
  let currentWorldDeck = worldDeck;
  const allFallout: { card: CardInstance; row: MarketRowId }[] = [];

  for (let i = 0; i < count; i++) {
    const result = slideMarket(currentMarket, currentWorldDeck);
    currentMarket = result.market;
    currentWorldDeck = result.worldDeck;
    if (result.physicalFallout.card) {
      allFallout.push({ card: result.physicalFallout.card, row: "physical" });
    }
    if (result.socialFallout.card) {
      allFallout.push({ card: result.socialFallout.card, row: "social" });
    }
  }

  return { market: currentMarket, worldDeck: currentWorldDeck, allFallout };
}

/**
 * Buy (acquire) a card from a specific market row.
 */
export function acquireFromMarket(
  market: TransitMarketState,
  rowId: MarketRowId,
  slotIndex: number
): { card: CardInstance | null; market: TransitMarketState } {
  const row = getMarketRowById(market, rowId);

  if (slotIndex < 0 || slotIndex >= market.maxSlotsPerRow) {
    return { card: null, market };
  }

  const slots = [...row.slots];
  const investments = [...row.investments];
  const card = slots[slotIndex];

  if (!card) return { card: null, market };

  slots[slotIndex] = null;
  investments[slotIndex] = null;
  card.zone = "discard";

  const updatedRow: MarketRowState = { slots, investments };
  const updatedMarket: TransitMarketState = rowId === "physical"
    ? { ...market, physicalRow: updatedRow }
    : { ...market, socialRow: updatedRow };

  return { card, market: updatedMarket };
}

/**
 * Place an investment on a market slot.
 * Returns null if the slot is empty or already has an investment.
 */
export function investOnSlot(
  market: TransitMarketState,
  rowId: MarketRowId,
  slotIndex: number,
  resource: ResourceCost
): TransitMarketState | null {
  const row = getMarketRowById(market, rowId);

  if (slotIndex < 0 || slotIndex >= market.maxSlotsPerRow) return null;
  if (!row.slots[slotIndex]) return null; // Can't invest on empty slot
  if (row.investments[slotIndex]) return null; // Already invested

  const investments = [...row.investments];
  investments[slotIndex] = { ...resource };

  const updatedRow: MarketRowState = { slots: [...row.slots], investments };
  return rowId === "physical"
    ? { ...market, physicalRow: updatedRow }
    : { ...market, socialRow: updatedRow };
}

/**
 * Check if a card at a slot can be bought (all preceding slots have investments).
 */
export function canBuyFromSlot(
  market: TransitMarketState,
  rowId: MarketRowId,
  slotIndex: number
): boolean {
  if (slotIndex === 0) return true; // Slot 0 doesn't need investments
  const row = getMarketRowById(market, rowId);
  for (let i = 0; i < slotIndex; i++) {
    if (!row.investments[i]) return false;
  }
  return true;
}

/**
 * Fill all empty market slots from the world deck.
 * Used at game start and after cryosleep.
 */
export function fillMarket(
  market: TransitMarketState,
  worldDeck: WorldDeckState
): { market: TransitMarketState; worldDeck: WorldDeckState } {
  let drawPile = [...worldDeck.drawPile];

  const fillRow = (row: MarketRowState): MarketRowState => {
    const slots = [...row.slots];
    for (let i = 0; i < slots.length; i++) {
      if (slots[i] === null && drawPile.length > 0) {
        const card = drawPile.shift()!;
        card.zone = "transit-market";
        slots[i] = card;
      }
    }
    return { slots, investments: [...row.investments] };
  };

  const physicalRow = fillRow(market.physicalRow);
  const socialRow = fillRow(market.socialRow);

  return {
    market: { ...market, physicalRow, socialRow },
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

  const flushRow = (row: MarketRowState): MarketRowState => {
    for (const slot of row.slots) {
      if (slot) flushedCards.push(slot);
    }
    return {
      slots: new Array(row.slots.length).fill(null),
      investments: new Array(row.investments.length).fill(null),
    };
  };

  return {
    flushedCards,
    market: {
      ...market,
      physicalRow: flushRow(market.physicalRow),
      socialRow: flushRow(market.socialRow),
    },
  };
}

/**
 * Get all non-null cards currently in the market.
 */
export function getMarketCards(market: TransitMarketState): CardInstance[] {
  const cards: CardInstance[] = [];
  for (const slot of market.physicalRow.slots) {
    if (slot) cards.push(slot);
  }
  for (const slot of market.socialRow.slots) {
    if (slot) cards.push(slot);
  }
  return cards;
}
