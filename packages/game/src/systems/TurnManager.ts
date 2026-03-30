import type { GameState, CardInstance, ResourceCost, MarketRowId } from "@icebox/shared";
import { canAfford, spendResources, gainResources, getMarketRowById } from "@icebox/shared";
import { drawCards, discardFromHand, addToBottomOfDeck } from "./DeckManager";
import { acquireFromMarket, slideMarketNoRefill, compactMarket, fillMarket, investOnSlot } from "./MarketManager";
import { resolveFallout } from "./FalloutHandler";
import { resolveEffect, emitTiming } from "./EffectResolver";
import { getCostModifier, isActionDisabled, getExtraSlideCount, isSlotLocked } from "./effects/PassiveScanner";
import { attachCrew, reassignCrew } from "./CrewManager";
import { advanceAllConstruction, beginConstruction, fastTrack } from "./ConstructionManager";
import { extractResourceActions } from "./ResourceActionManager";

/**
 * Pure logic for managing the Active Watch turn flow.
 */

export type PlayerAction =
  | { type: "play-card"; instanceId: string }
  | { type: "buy-from-market"; row: MarketRowId; slotIndex: number; payment: ResourceCost }
  | { type: "invest"; row: MarketRowId; slotIndex: number; resource: ResourceCost }
  | { type: "slot-structure"; instanceId: string; sectorIndex: number }
  | { type: "scrap-structure"; instanceId: string; sectorIndex: number }
  | { type: "draw-extra"; resourceType: "matter" | "energy" | "data" | "influence" }
  | { type: "attach-crew"; crewInstanceId: string; structureInstanceId: string; sectorIndex: number }
  | { type: "reassign-crew"; crewInstanceId: string; newStructureInstanceId: string; newSectorIndex: number }
  | { type: "fast-track"; structureInstanceId: string; turnsToSkip: number }
  | { type: "resolve-crisis"; row: MarketRowId; slotIndex: number }
  | { type: "pass" };

export interface ActionResult {
  success: boolean;
  state: GameState;
  message: string;
  effectsTriggered?: string[];
}

/**
 * Start a new turn: auto-draw, increment turn number.
 * If the mandate deck is completely empty (draw + discard), auto-transition to succession.
 */
export interface StartTurnResult {
  state: GameState;
  reshuffled: boolean;
}

export function startTurn(state: GameState): StartTurnResult {
  let s = structuredClone(state);
  s.turnNumber++;

  // Clear turn-scoped state
  s.availableActions = { matter: 0, energy: 0, data: 0, influence: 0 };
  s.turnInvestments = [];

  // Draw cards — full hand on wake (turn 1 with empty hand), otherwise normal draw
  const isWake = s.turnNumber === 1 && s.mandateDeck.hand.length === 0;
  const drawCount = isWake ? s.rules.wakeDrawCount : s.rules.drawPerTurn;
  const drawResult = drawCards(s.mandateDeck, drawCount);
  s.mandateDeck = drawResult.deck;

  // Re-power and untap all tableau cards at turn start
  for (const sector of s.ship.sectors) {
    for (const card of sector.installedCards) {
      card.powered = true;
      card.tapped = false;
    }
  }

  // Advance construction progress on all under-construction structures
  s = advanceAllConstruction(s);

  return { state: s, reshuffled: drawResult.reshuffled };
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
      return buyFromMarket(state, action.row, action.slotIndex, action.payment);
    case "invest":
      return investAction(state, action.row, action.slotIndex, action.resource);
    case "slot-structure":
      return slotStructure(state, action.instanceId, action.sectorIndex);
    case "scrap-structure":
      return scrapStructure(state, action.instanceId, action.sectorIndex);
    case "draw-extra":
      return drawExtra(state, action.resourceType);
    case "attach-crew": {
      const r = attachCrew(state, action.crewInstanceId, action.structureInstanceId, action.sectorIndex);
      return { success: r.success, state: r.state, message: r.message };
    }
    case "reassign-crew": {
      const r = reassignCrew(state, action.crewInstanceId, action.newStructureInstanceId, action.newSectorIndex);
      return { success: r.success, state: r.state, message: r.message };
    }
    case "fast-track": {
      const r = fastTrack(state, action.structureInstanceId, action.turnsToSkip);
      return { success: r.success, state: r.state, message: r.message };
    }
    case "resolve-crisis":
      return resolveCrisis(state, action.row, action.slotIndex);
    case "pass":
      return endTurn(state);
  }
}

function playCard(state: GameState, instanceId: string): ActionResult {
  let s = structuredClone(state);
  const cardIdx = s.mandateDeck.hand.findIndex((c) => c.instanceId === instanceId);

  if (cardIdx === -1) {
    return { success: false, state, message: "Card not in hand." };
  }

  const cardInst = s.mandateDeck.hand[cardIdx];
  const card = cardInst.card;

  // Check hazard passive: action abilities disabled
  if (card.type === "action" && isActionDisabled(s, "play-action")) {
    return { success: false, state, message: "A hazard is preventing action abilities." };
  }

  if (!canAfford(s.resources, card.cost)) {
    return { success: false, state, message: "Cannot afford this card." };
  }

  s.resources = spendResources(s.resources, card.cost);

  if (card.resourceGain) {
    let gain = { ...card.resourceGain };
    if (isActionDisabled(s, "gain-influence") && gain.influence) {
      gain = { ...gain, influence: 0 };
    }
    s.resources = gainResources(s.resources, gain);
  }

  s.mandateDeck = discardFromHand(s.mandateDeck, instanceId);

  // Fire on-discard effects from the discarded card
  for (const effect of card.effects.filter((e) => e.timing === "on-discard")) {
    const discardResult = resolveEffect(s, effect, cardInst);
    s = discardResult.state;
  }

  // Execute on-play effects mechanically
  const effectMessages: string[] = [];
  for (const effect of card.effects.filter((e) => e.timing === "on-play")) {
    const result = resolveEffect(s, effect, cardInst);
    s = result.state;
    effectMessages.push(result.message);
  }

  return {
    success: true,
    state: s,
    message: `Played ${card.name}.`,
    effectsTriggered: effectMessages,
  };
}

/**
 * Buy a card from the market. Cost = column index (slot 0 = free, slot 1 = 1 resource, etc.).
 * Player chooses which resource types to pay via the `payment` parameter.
 * The total resources in `payment` must equal `slotIndex`.
 * If the card has investments on it, those generate pending resource actions.
 * Bought cards go to the bottom of the draw pile (not discard).
 */
function buyFromMarket(state: GameState, rowId: MarketRowId, slotIndex: number, payment: ResourceCost): ActionResult {
  let s = structuredClone(state);
  const row = getMarketRowById(s.transitMarket, rowId);
  const slot = row.slots[slotIndex];

  if (!slot) {
    return { success: false, state, message: "Empty market slot." };
  }

  // Check if this slot was invested in this turn — cannot buy cards you invested in
  const slotKey = `${rowId}-${slotIndex}`;
  if (s.turnInvestments.includes(slotKey)) {
    return { success: false, state, message: "Cannot buy a card you invested in this turn." };
  }

  // Check if slot is locked by a passive effect
  const marketRow = rowId === "upper" ? "upper" : "lower";
  if (isSlotLocked(s, marketRow, slotIndex)) {
    return { success: false, state, message: "This market slot is locked by a passive effect." };
  }

  // Positional cost: must pay exactly slotIndex resources total
  // Note: resources are already deducted by the scene's investment drag flow.
  // The payment parameter is for validation only — it records what was spent.
  const totalPayment = (payment.matter ?? 0) + (payment.energy ?? 0) +
                       (payment.data ?? 0) + (payment.influence ?? 0);
  if (totalPayment !== slotIndex) {
    return { success: false, state, message: `Must pay exactly ${slotIndex} resources for slot ${slotIndex}.` };
  }

  // Capture investment before acquiring (it gets cleared)
  const investment = row.investments[slotIndex];

  const result = acquireFromMarket(s.transitMarket, rowId, slotIndex);
  s.transitMarket = result.market;

  const cardType = slot.card.type;
  const isHazardOrEvent = cardType === "hazard" || cardType === "event" || cardType === "crisis";

  if (result.card) {
    if (isHazardOrEvent) {
      if (result.card.card.resourceGain) {
        s.resources = gainResources(s.resources, result.card.card.resourceGain);
      }
      const hazardData = result.card.card.hazard;
      if (hazardData?.onBuy === "return-to-vault") {
        result.card.zone = "vault";
        s.vault.cards.push(result.card);
      } else {
        result.card.zone = "graveyard";
        s.graveyard.cards.push(result.card);
      }
    } else {
      // Bought cards go to bottom of draw pile
      s.mandateDeck = addToBottomOfDeck(s.mandateDeck, result.card);
    }
  }

  // Execute on-play effects mechanically
  const effectMessages: string[] = [];
  for (const effect of slot.card.effects.filter((e) => e.timing === "on-play")) {
    const effResult = resolveEffect(s, effect, result.card ?? slot);
    s = effResult.state;
    effectMessages.push(effResult.message);
  }

  // Accumulate resource actions from investment into the action pool
  if (investment) {
    const actions = extractResourceActions(investment);
    for (const action of actions) {
      switch (action.type) {
        case "progress-building": s.availableActions.matter += action.count; break;
        case "tap-card": s.availableActions.energy += action.count; break;
        case "scry-market": s.availableActions.data += action.count; break;
        case "swap-market": s.availableActions.influence += action.count; break;
      }
    }
  }

  const buyVerb = isHazardOrEvent ? "Resolved" : "Acquired";
  return {
    success: true,
    state: s,
    message: `${buyVerb} ${slot.card.name} from the ${rowId} row.`,
    effectsTriggered: effectMessages,
  };
}

function investAction(
  state: GameState,
  rowId: MarketRowId,
  slotIndex: number,
  resource: ResourceCost
): ActionResult {
  if (!canAfford(state.resources, resource)) {
    return { success: false, state, message: "Cannot afford this investment." };
  }

  const s = structuredClone(state);
  s.resources = spendResources(s.resources, resource);

  const updatedMarket = investOnSlot(s.transitMarket, rowId, slotIndex, resource);
  if (!updatedMarket) {
    return { success: false, state, message: "Cannot invest on this slot." };
  }

  s.transitMarket = updatedMarket;

  return {
    success: true,
    state: s,
    message: `Invested on ${rowId} row slot ${slotIndex}.`,
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

  const cardIdx = s.mandateDeck.hand.findIndex((c) => c.instanceId === instanceId);
  if (cardIdx === -1) {
    return { success: false, state, message: "Card not in hand." };
  }

  const cardInst = s.mandateDeck.hand[cardIdx];
  if (cardInst.card.type !== "structure" && cardInst.card.type !== "institution") {
    return { success: false, state, message: "Only structures and institutions can be slotted." };
  }

  // Cost modifiers for slotting (from hazards + tableau passives)
  const costModifier = getCostModifier(s, "structures");
  const baseCost = cardInst.card.cost;
  const effectiveCost: ResourceCost = {
    matter: Math.max(0, (baseCost.matter ?? 0) + (costModifier.matter ?? 0)),
    energy: Math.max(0, (baseCost.energy ?? 0) + (costModifier.energy ?? 0)),
    data: Math.max(0, (baseCost.data ?? 0) + (costModifier.data ?? 0)),
    influence: Math.max(0, (baseCost.influence ?? 0) + (costModifier.influence ?? 0)),
  };

  if (!canAfford(s.resources, effectiveCost)) {
    return { success: false, state, message: "Cannot afford to slot this card." };
  }

  s.resources = spendResources(s.resources, effectiveCost);

  if (cardInst.card.resourceGain) {
    s.resources = gainResources(s.resources, cardInst.card.resourceGain);
  }

  // Check if structure requires construction
  if (cardInst.card.type === "structure" && cardInst.card.construction) {
    s.mandateDeck.hand.splice(cardIdx, 1);
    s.mandateDeck.hand.push(cardInst);
    const conResult = beginConstruction(s, instanceId, sectorIndex);
    return {
      success: conResult.success,
      state: conResult.state,
      message: conResult.message,
    };
  }

  s.mandateDeck.hand.splice(cardIdx, 1);
  cardInst.zone = "tableau";
  sector.installedCards.push(cardInst);

  return {
    success: true,
    state: s,
    message: `Slotted ${cardInst.card.name} into sector ${sectorIndex}.`,
  };
}

function scrapStructure(
  state: GameState,
  instanceId: string,
  sectorIndex: number
): ActionResult {
  const s = structuredClone(state);
  const sector = s.ship.sectors[sectorIndex];

  if (!sector) {
    return { success: false, state, message: "Invalid sector." };
  }

  const cardIdx = sector.installedCards.findIndex((c) => c.instanceId === instanceId);
  if (cardIdx === -1) {
    return { success: false, state, message: "Card not installed in this sector." };
  }

  const cardInst = sector.installedCards[cardIdx];
  const cost = cardInst.card.cost;
  const rate = s.rules.scrapRefundRate;
  const refund: ResourceCost = {
    matter: Math.floor((cost.matter ?? 0) * rate),
    energy: Math.floor((cost.energy ?? 0) * rate),
    data: Math.floor((cost.data ?? 0) * rate),
    influence: Math.floor((cost.influence ?? 0) * rate),
  };
  s.resources = gainResources(s.resources, refund);

  sector.installedCards.splice(cardIdx, 1);
  cardInst.zone = "graveyard";
  s.graveyard.cards.push(cardInst);

  return {
    success: true,
    state: s,
    message: `Scrapped ${cardInst.card.name} from sector ${sectorIndex}.`,
  };
}

function drawExtra(
  state: GameState,
  resourceType: "matter" | "energy" | "data" | "influence"
): ActionResult {
  if (isActionDisabled(state, "draw-extra")) {
    return { success: false, state, message: "A hazard is preventing extra draws." };
  }

  const s = structuredClone(state);
  const cost: ResourceCost = { [resourceType]: s.rules.extraDrawCost };
  if (!canAfford(s.resources, cost)) {
    return { success: false, state, message: "Cannot afford to draw." };
  }

  s.resources = spendResources(s.resources, cost);
  const result = drawCards(s.mandateDeck, 1);
  s.mandateDeck = result.deck;

  const drawnName = result.drawnCards.length > 0 ? result.drawnCards[0].card.name : "nothing";
  const reshuffleMsg = result.reshuffled ? " Discard reshuffled into deck." : "";
  return {
    success: true,
    state: s,
    message: `Drew ${drawnName}.${reshuffleMsg}`,
  };
}

function endTurn(state: GameState): ActionResult {
  let s = structuredClone(state);
  const allEffects: string[] = [];

  // 1. Compact gaps — cards shift left to fill empty slots
  s.transitMarket = compactMarket(s.transitMarket);

  // 2. Slide (no refill) — leftmost card falls out
  const extraSlides = getExtraSlideCount(s);
  const eraSlideModifier = s.eraModifiers?.marketSlideModifier ?? 0;
  const totalSlides = Math.max(0, s.rules.baseSlidesPerTurn + extraSlides + eraSlideModifier);

  for (let i = 0; i < totalSlides; i++) {
    const slideResult = slideMarketNoRefill(s.transitMarket);
    s.transitMarket = slideResult.market;

    // Resolve fallout from upper row first, then lower row
    for (const falloutData of [slideResult.upperFallout, slideResult.lowerFallout]) {
      if (falloutData.card) {
        const fallout = resolveFallout(s, falloutData.card);
        s = fallout.state;
        allEffects.push(...fallout.messages);

        // Accumulate resource actions from fallout investments into the action pool
        if (falloutData.investment) {
          const actions = extractResourceActions(falloutData.investment);
          for (const action of actions) {
            switch (action.type) {
              case "progress-building": s.availableActions.matter += action.count; break;
              case "tap-card": s.availableActions.energy += action.count; break;
              case "scry-market": s.availableActions.data += action.count; break;
              case "swap-market": s.availableActions.influence += action.count; break;
            }
          }
        }
      }
    }

    // Handle claimed investments (faction gains presence)
    for (const claim of slideResult.claimedInvestments) {
      allEffects.push(`${claim.faction} claimed invested resources.`);
      if (s.globalFactionPresence[claim.faction] !== undefined) {
        const total = (claim.resources.matter ?? 0) + (claim.resources.energy ?? 0) +
                     (claim.resources.data ?? 0) + (claim.resources.influence ?? 0);
        s.globalFactionPresence[claim.faction] += total;
      }
    }
  }

  // 3. Refill empty slots from world deck (top row left-to-right, then bottom row)
  const fillResult = fillMarket(s.transitMarket, s.worldDeck);
  s.transitMarket = fillResult.market;
  s.worldDeck = fillResult.worldDeck;

  if (extraSlides > 0) {
    allEffects.push(`Market slid ${totalSlides} times (${extraSlides} extra from hazards).`);
  }

  return {
    success: true,
    state: s,
    message: "Turn ended. Market slides.",
    effectsTriggered: allEffects,
  };
}

/**
 * Proactively resolve a crisis card in the market.
 * Pay the proactive cost to trigger cryosleep on your terms.
 */
function resolveCrisis(
  state: GameState,
  rowId: MarketRowId,
  slotIndex: number
): ActionResult {
  const s = structuredClone(state);
  const row = getMarketRowById(s.transitMarket, rowId);
  const slot = row.slots[slotIndex];

  if (!slot) {
    return { success: false, state, message: "Empty market slot." };
  }

  if (!slot.card.crisis?.isCrisis) {
    return { success: false, state, message: "This card is not a crisis." };
  }

  const proactiveCost = slot.card.crisis.proactiveCost ?? {};
  if (!canAfford(s.resources, proactiveCost)) {
    return { success: false, state, message: "Cannot afford to resolve this crisis." };
  }

  s.resources = spendResources(s.resources, proactiveCost);

  // Remove crisis card from market
  row.slots[slotIndex] = null;
  slot.zone = "graveyard";
  s.graveyard.cards.push(slot);

  // Trigger succession (proactive sleep)
  s.phase = "succession";

  return {
    success: true,
    state: s,
    message: `Crisis resolved: ${slot.card.name}. Entering Succession phase...`,
  };
}
