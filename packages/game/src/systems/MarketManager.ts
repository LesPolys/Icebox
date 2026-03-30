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

// ── Compact (fill gaps) ────────────────────────────────────────────

/** Shift all non-null cards left within a row to fill gaps. Investments move with cards. */
function compactRow(row: MarketRowState): MarketRowState {
  const slots: (CardInstance | null)[] = [];
  const investments: (ResourceCost | null)[] = [];
  for (let i = 0; i < row.slots.length; i++) {
    if (row.slots[i] !== null) {
      slots.push(row.slots[i]);
      investments.push(row.investments[i]);
    }
  }
  while (slots.length < row.slots.length) {
    slots.push(null);
    investments.push(null);
  }
  return { slots, investments };
}

/** Compact both market rows — cards shift left to fill empty slots. */
export function compactMarket(market: TransitMarketState): TransitMarketState {
  return {
    ...market,
    upperRow: compactRow(market.upperRow),
    lowerRow: compactRow(market.lowerRow),
  };
}

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
  upperFallout: { card: CardInstance | null; investment: ResourceCost | null };
  lowerFallout: { card: CardInstance | null; investment: ResourceCost | null };
  claimedInvestments: { faction: FactionId; resources: ResourceCost }[];
}

/**
 * Slide both market rows left by 1.
 */
export function slideMarket(
  market: TransitMarketState,
  worldDeck: WorldDeckState
): SlideResult {
  const upperResult = slideRow(market.upperRow, worldDeck);
  const lowerResult = slideRow(market.lowerRow, upperResult.worldDeck);

  const claimedInvestments: { faction: FactionId; resources: ResourceCost }[] = [];

  for (const { card, investment } of [
    { card: upperResult.falloutCard, investment: upperResult.falloutInvestment },
    { card: lowerResult.falloutCard, investment: lowerResult.falloutInvestment },
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
      upperRow: upperResult.row,
      lowerRow: lowerResult.row,
      maxSlotsPerRow: market.maxSlotsPerRow,
    },
    worldDeck: lowerResult.worldDeck,
    upperFallout: { card: upperResult.falloutCard, investment: upperResult.falloutInvestment },
    lowerFallout: { card: lowerResult.falloutCard, investment: lowerResult.falloutInvestment },
    claimedInvestments,
  };
}

export interface SlideNoRefillResult {
  market: TransitMarketState;
  upperFallout: { card: CardInstance | null; investment: ResourceCost | null };
  lowerFallout: { card: CardInstance | null; investment: ResourceCost | null };
  claimedInvestments: { faction: FactionId; resources: ResourceCost }[];
}

/** Slide both rows left by 1 WITHOUT drawing new cards from world deck. */
export function slideMarketNoRefill(market: TransitMarketState): SlideNoRefillResult {
  const slideRowOnly = (row: MarketRowState) => {
    const slots = [...row.slots];
    const investments = [...row.investments];
    const falloutCard = slots.shift() ?? null;
    const falloutInvestment = investments.shift() ?? null;
    if (falloutCard) falloutCard.zone = "discard";
    slots.push(null);
    investments.push(null);
    return { row: { slots, investments } as MarketRowState, falloutCard, falloutInvestment };
  };

  const upperResult = slideRowOnly(market.upperRow);
  const lowerResult = slideRowOnly(market.lowerRow);

  const claimedInvestments: { faction: FactionId; resources: ResourceCost }[] = [];
  for (const { card, investment } of [
    { card: upperResult.falloutCard, investment: upperResult.falloutInvestment },
    { card: lowerResult.falloutCard, investment: lowerResult.falloutInvestment },
  ]) {
    if (card && investment && card.card.faction !== "neutral") {
      claimedInvestments.push({ faction: card.card.faction as FactionId, resources: investment });
    }
  }

  return {
    market: { upperRow: upperResult.row, lowerRow: lowerResult.row, maxSlotsPerRow: market.maxSlotsPerRow },
    upperFallout: { card: upperResult.falloutCard, investment: upperResult.falloutInvestment },
    lowerFallout: { card: lowerResult.falloutCard, investment: lowerResult.falloutInvestment },
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
    if (result.upperFallout.card) {
      allFallout.push({ card: result.upperFallout.card, row: "upper" });
    }
    if (result.lowerFallout.card) {
      allFallout.push({ card: result.lowerFallout.card, row: "lower" });
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
  const updatedMarket: TransitMarketState = rowId === "upper"
    ? { ...market, upperRow: updatedRow }
    : { ...market, lowerRow: updatedRow };

  return { card, market: updatedMarket };
}

/**
 * Place an investment on a market slot.
 * Investments accumulate — multiple resources can be added to the same card.
 * Returns null if the slot is empty.
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

  const investments = [...row.investments];
  const existing = investments[slotIndex];
  if (existing) {
    // Accumulate onto existing investment
    investments[slotIndex] = {
      matter: (existing.matter ?? 0) + (resource.matter ?? 0),
      energy: (existing.energy ?? 0) + (resource.energy ?? 0),
      data: (existing.data ?? 0) + (resource.data ?? 0),
      influence: (existing.influence ?? 0) + (resource.influence ?? 0),
    };
  } else {
    investments[slotIndex] = { ...resource };
  }

  const updatedRow: MarketRowState = { slots: [...row.slots], investments };
  return rowId === "upper"
    ? { ...market, upperRow: updatedRow }
    : { ...market, lowerRow: updatedRow };
}

/**
 * Check if a card at a slot can be bought.
 * Each preceding column (0..slotIndex-1) must have an investment in at least one row.
 * When the target row's slot is empty, the other row's slot in that column counts.
 */
export function canBuyFromSlot(
  market: TransitMarketState,
  rowId: MarketRowId,
  slotIndex: number
): boolean {
  if (slotIndex === 0) return true;
  for (let i = 0; i < slotIndex; i++) {
    if (!market.upperRow.investments[i] && !market.lowerRow.investments[i]) {
      return false;
    }
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
  const drawPile = [...worldDeck.drawPile];
  const upperSlots = [...market.upperRow.slots];
  const lowerSlots = [...market.lowerRow.slots];
  const numCols = upperSlots.length;

  // Fill column-by-column, top then bottom, left to right
  for (let col = 0; col < numCols; col++) {
    if (upperSlots[col] === null && drawPile.length > 0) {
      const card = drawPile.shift()!;
      card.zone = "transit-market";
      upperSlots[col] = card;
    }
    if (lowerSlots[col] === null && drawPile.length > 0) {
      const card = drawPile.shift()!;
      card.zone = "transit-market";
      lowerSlots[col] = card;
    }
  }

  return {
    market: {
      ...market,
      upperRow: { slots: upperSlots, investments: [...market.upperRow.investments] },
      lowerRow: { slots: lowerSlots, investments: [...market.lowerRow.investments] },
    },
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
      upperRow: flushRow(market.upperRow),
      lowerRow: flushRow(market.lowerRow),
    },
  };
}

/**
 * Get all non-null cards currently in the market.
 */
export function getMarketCards(market: TransitMarketState): CardInstance[] {
  const cards: CardInstance[] = [];
  for (const slot of market.upperRow.slots) {
    if (slot) cards.push(slot);
  }
  for (const slot of market.lowerRow.slots) {
    if (slot) cards.push(slot);
  }
  return cards;
}
