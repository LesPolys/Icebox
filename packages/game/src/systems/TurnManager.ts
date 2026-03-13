import type { GameState, CardInstance, ResourceCost } from "@icebox/shared";
import { canAfford, spendResources, gainResources, AUTO_DRAW_COUNT, EXTRA_DRAW_COST } from "@icebox/shared";
import { drawCards, discardFromHand, addToDiscard } from "./DeckManager";
import { acquireFromMarket, slideMarket } from "./MarketManager";

/**
 * Pure logic for managing the Active Watch turn flow.
 */

export type PlayerAction =
  | { type: "play-card"; instanceId: string }
  | { type: "buy-from-market"; slotIndex: number }
  | { type: "slot-structure"; instanceId: string; sectorIndex: number }
  | { type: "draw-extra"; resourceType: "matter" | "energy" | "data" | "influence" }
  | { type: "pass" }
  | { type: "enter-cryosleep" };

export interface ActionResult {
  success: boolean;
  state: GameState;
  message: string;
  effectsTriggered?: string[];
}

/**
 * Start a new turn: auto-draw, increment turn number.
 */
export function startTurn(state: GameState): GameState {
  const s = structuredClone(state);
  s.turnNumber++;

  // Auto-draw
  const drawResult = drawCards(s.mandateDeck, AUTO_DRAW_COUNT);
  s.mandateDeck = drawResult.deck;

  // Re-power all tableau cards at turn start (if energy is sufficient)
  for (const sector of s.ship.sectors) {
    for (const card of sector.installedCards) {
      card.powered = true;
    }
  }

  return s;
}

/**
 * Execute a player action during Active Watch.
 */
export function executeAction(
  state: GameState,
  action: PlayerAction
): ActionResult {
  switch (action.type) {
    case "play-card":
      return playCard(state, action.instanceId);
    case "buy-from-market":
      return buyFromMarket(state, action.slotIndex);
    case "slot-structure":
      return slotStructure(state, action.instanceId, action.sectorIndex);
    case "draw-extra":
      return drawExtra(state, action.resourceType);
    case "pass":
      return endTurn(state);
    case "enter-cryosleep":
      return initiateCryosleep(state);
  }
}

function playCard(state: GameState, instanceId: string): ActionResult {
  const s = structuredClone(state);
  const cardIdx = s.mandateDeck.hand.findIndex((c) => c.instanceId === instanceId);

  if (cardIdx === -1) {
    return { success: false, state, message: "Card not in hand." };
  }

  const cardInst = s.mandateDeck.hand[cardIdx];
  const card = cardInst.card;

  // Check cost
  if (!canAfford(s.resources, card.cost)) {
    return { success: false, state, message: "Cannot afford this card." };
  }

  // Spend resources
  s.resources = spendResources(s.resources, card.cost);

  // Apply resource gain
  if (card.resourceGain) {
    s.resources = gainResources(s.resources, card.resourceGain);
  }

  // Move to discard
  s.mandateDeck = discardFromHand(s.mandateDeck, instanceId);

  // TODO: Trigger on-play effects via EffectResolver

  return {
    success: true,
    state: s,
    message: `Played ${card.name}.`,
    effectsTriggered: card.effects.filter((e) => e.timing === "on-play").map((e) => e.description),
  };
}

function buyFromMarket(state: GameState, slotIndex: number): ActionResult {
  const s = structuredClone(state);
  const slot = s.transitMarket.slots[slotIndex];

  if (!slot) {
    return { success: false, state, message: "Empty market slot." };
  }

  // Check cost
  if (!canAfford(s.resources, slot.card.cost)) {
    return { success: false, state, message: "Cannot afford this card." };
  }

  // Spend resources
  s.resources = spendResources(s.resources, slot.card.cost);

  // Remove from market, add to discard
  const result = acquireFromMarket(s.transitMarket, slotIndex);
  s.transitMarket = result.market;

  if (result.card) {
    s.mandateDeck = addToDiscard(s.mandateDeck, result.card);
  }

  return {
    success: true,
    state: s,
    message: `Acquired ${slot.card.name} from the market.`,
  };
}

function slotStructure(
  state: GameState,
  instanceId: string,
  sectorIndex: number
): ActionResult {
  const s = structuredClone(state);
  const sector = s.ship.sectors[sectorIndex];

  if (!sector) {
    return { success: false, state, message: "Invalid sector." };
  }

  if (sector.installedCards.length >= sector.maxSlots) {
    return { success: false, state, message: "Sector is full." };
  }

  // Find card in hand
  const cardIdx = s.mandateDeck.hand.findIndex((c) => c.instanceId === instanceId);
  if (cardIdx === -1) {
    return { success: false, state, message: "Card not in hand." };
  }

  const cardInst = s.mandateDeck.hand[cardIdx];
  if (cardInst.card.type !== "structure" && cardInst.card.type !== "institution") {
    return { success: false, state, message: "Only structures and institutions can be slotted." };
  }

  // Check cost
  if (!canAfford(s.resources, cardInst.card.cost)) {
    return { success: false, state, message: "Cannot afford to slot this card." };
  }

  // Spend resources
  s.resources = spendResources(s.resources, cardInst.card.cost);

  // Apply resource gain
  if (cardInst.card.resourceGain) {
    s.resources = gainResources(s.resources, cardInst.card.resourceGain);
  }

  // Move from hand to tableau
  s.mandateDeck.hand.splice(cardIdx, 1);
  cardInst.zone = "tableau";
  sector.installedCards.push(cardInst);

  return {
    success: true,
    state: s,
    message: `Slotted ${cardInst.card.name} into sector ${sectorIndex}.`,
  };
}

function drawExtra(
  state: GameState,
  resourceType: "matter" | "energy" | "data" | "influence"
): ActionResult {
  const s = structuredClone(state);

  const cost: ResourceCost = { [resourceType]: EXTRA_DRAW_COST };
  if (!canAfford(s.resources, cost)) {
    return { success: false, state, message: "Cannot afford to draw." };
  }

  s.resources = spendResources(s.resources, cost);
  const result = drawCards(s.mandateDeck, 1);
  s.mandateDeck = result.deck;

  const drawnName = result.drawnCards.length > 0 ? result.drawnCards[0].card.name : "nothing";
  return {
    success: true,
    state: s,
    message: `Drew ${drawnName}.`,
  };
}

function endTurn(state: GameState): ActionResult {
  const s = structuredClone(state);

  // Market slides left by 1
  const slideResult = slideMarket(s.transitMarket, s.worldDeck);
  s.transitMarket = slideResult.market;
  s.worldDeck = slideResult.worldDeck;

  // TODO: Trigger fallout effects on slideResult.falloutCard

  return {
    success: true,
    state: s,
    message: "Turn ended. Market slides.",
    effectsTriggered: slideResult.falloutCard
      ? [`Fallout: ${slideResult.falloutCard.card.name}`]
      : [],
  };
}

function initiateCryosleep(state: GameState): ActionResult {
  const s = structuredClone(state);
  s.phase = "succession";

  return {
    success: true,
    state: s,
    message: "Entering Succession phase...",
  };
}
