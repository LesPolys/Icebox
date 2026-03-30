import type { GameState, ResourceCost, MarketRowId } from "@icebox/shared";
import { getMarketRowById } from "@icebox/shared";
import { resolveEffect } from "./EffectResolver";
import { progressConstruction } from "./ConstructionManager";

/**
 * Resource Action System
 *
 * When cards fall off the market or are purchased, the investments on them
 * grant the player actions based on resource type:
 *   - Matter:    Progress a building by 1 tick
 *   - Energy:    Tap (activate) a card in the tableau
 *   - Data:      Scry: look at top 3 of market deck, reorder them
 *   - Influence: Swap two adjacent cards on the market
 */

export type ResourceActionType =
  | "progress-building"   // matter
  | "tap-card"            // energy
  | "scry-market"         // data
  | "swap-market";        // influence

export interface ResourceAction {
  type: ResourceActionType;
  /** How many of this action the player gets (e.g., 2 matter = 2 progress actions) */
  count: number;
}

export interface PendingResourceActionGroup {
  /** Where these actions came from */
  source: "fallout" | "purchase";
  /** Name of the card that had the investment */
  cardName: string;
  /** Actions to resolve (player chooses order within a group) */
  actions: ResourceAction[];
}

/**
 * Break an investment into individual resource actions.
 */
export function extractResourceActions(investment: ResourceCost): ResourceAction[] {
  const actions: ResourceAction[] = [];

  if (investment.matter && investment.matter > 0) {
    actions.push({ type: "progress-building", count: investment.matter });
  }
  if (investment.energy && investment.energy > 0) {
    actions.push({ type: "tap-card", count: investment.energy });
  }
  if (investment.data && investment.data > 0) {
    actions.push({ type: "scry-market", count: investment.data });
  }
  if (investment.influence && investment.influence > 0) {
    actions.push({ type: "swap-market", count: investment.influence });
  }

  return actions;
}

// ─── Action Resolvers ─────────────────────────────────────────────────

export interface ResourceActionResult {
  success: boolean;
  state: GameState;
  message: string;
}

/**
 * Matter action: progress a building by 1 tick.
 */
export function resolveProgressBuilding(
  state: GameState,
  structureInstanceId: string
): ResourceActionResult {
  const result = progressConstruction(state, structureInstanceId, 1);
  return { success: result.success, state: result.state, message: result.message };
}

/**
 * Energy action: tap a card in the tableau, triggering its tapEffect.
 */
export function resolveTapCard(
  state: GameState,
  cardInstanceId: string
): ResourceActionResult {
  const s = structuredClone(state);

  // Find the card in tableau
  for (const sector of s.ship.sectors) {
    const card = sector.installedCards.find((c) => c.instanceId === cardInstanceId);
    if (card) {
      if (card.tapped) {
        return { success: false, state, message: `${card.card.name} is already tapped.` };
      }
      if (card.underConstruction) {
        return { success: false, state, message: `${card.card.name} is under construction.` };
      }
      if (!card.card.tapEffect) {
        return { success: false, state, message: `${card.card.name} has no tap ability.` };
      }

      card.tapped = true;

      // Resolve the tap effect
      const effectResult = resolveEffect(s, card.card.tapEffect, card);
      return {
        success: true,
        state: effectResult.state,
        message: `Tapped ${card.card.name}: ${effectResult.message}`,
      };
    }
  }

  return { success: false, state, message: "Card not found in tableau." };
}

/**
 * Data action: peek at top 3 cards of the market deck and reorder them.
 * The `newOrder` is an array of indices (0-2) representing the desired order.
 */
export function resolveScryMarket(
  state: GameState,
  newOrder: number[]
): ResourceActionResult {
  const s = structuredClone(state);
  const drawPile = s.worldDeck.drawPile;

  const peekCount = Math.min(3, drawPile.length);
  if (peekCount === 0) {
    return { success: false, state, message: "Market deck is empty." };
  }

  // Validate order
  if (newOrder.length !== peekCount) {
    return { success: false, state, message: `Must order exactly ${peekCount} cards.` };
  }

  const topCards = drawPile.splice(0, peekCount);
  const reordered = newOrder.map((i) => topCards[i]);
  drawPile.unshift(...reordered);

  return {
    success: true,
    state: s,
    message: `Reordered top ${peekCount} cards of the market deck.`,
  };
}

/**
 * Get the top N cards of the market deck for the scry preview.
 */
export function peekMarketDeck(state: GameState, count: number = 3) {
  return state.worldDeck.drawPile.slice(0, Math.min(count, state.worldDeck.drawPile.length));
}

/**
 * Influence action: swap two adjacent cards on the market.
 * Adjacent = same row adjacent columns, or same column different rows.
 */
export function resolveSwapMarket(
  state: GameState,
  slotA: { row: MarketRowId; col: number },
  slotB: { row: MarketRowId; col: number }
): ResourceActionResult {
  const s = structuredClone(state);

  // Validate adjacency
  const sameRow = slotA.row === slotB.row;
  const sameCol = slotA.col === slotB.col;
  const adjCol = Math.abs(slotA.col - slotB.col) === 1;

  const isAdjacent = (sameRow && adjCol) || (sameCol && slotA.row !== slotB.row);
  if (!isAdjacent) {
    return { success: false, state, message: "Slots must be adjacent (same row neighboring columns, or same column different rows)." };
  }

  const rowA = getMarketRowById(s.transitMarket, slotA.row);
  const rowB = getMarketRowById(s.transitMarket, slotB.row);

  // Swap cards
  const tempCard = rowA.slots[slotA.col];
  rowA.slots[slotA.col] = rowB.slots[slotB.col];
  rowB.slots[slotB.col] = tempCard;

  // Swap investments too
  const tempInv = rowA.investments[slotA.col];
  rowA.investments[slotA.col] = rowB.investments[slotB.col];
  rowB.investments[slotB.col] = tempInv;

  const nameA = tempCard?.card.name ?? "empty";
  const nameB = rowA.slots[slotA.col]?.card.name ?? "empty";
  return {
    success: true,
    state: s,
    message: `Swapped ${nameA} and ${nameB} on the market.`,
  };
}
