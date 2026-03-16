import type { GameState, CardInstance, ResourceCost } from "@icebox/shared";
import { canAfford, spendResources, ENTROPY_PER_FAST_TRACK } from "@icebox/shared";

export interface ConstructionActionResult {
  state: GameState;
  success: boolean;
  message: string;
}

/**
 * Check if a card instance has met all construction requirements.
 * @param eraModifier — constructionTimeModifier from current era (default 0)
 */
export function checkCompletion(instance: CardInstance, eraModifier: number = 0): boolean {
  const construction = instance.card.construction;
  if (!construction || !instance.underConstruction) return false;

  // Time requirement (adjusted by era modifier)
  if (construction.completionTime && construction.completionTime > 0) {
    const adjustedTime = Math.max(1, construction.completionTime + eraModifier);
    if ((instance.constructionProgress ?? 0) < adjustedTime) {
      return false;
    }
  }

  // Resource requirement
  if (construction.resourceRequirement) {
    const req = construction.resourceRequirement;
    const added = instance.constructionResourcesAdded ?? {};
    if ((req.matter ?? 0) > (added.matter ?? 0)) return false;
    if ((req.energy ?? 0) > (added.energy ?? 0)) return false;
    if ((req.data ?? 0) > (added.data ?? 0)) return false;
    if ((req.influence ?? 0) > (added.influence ?? 0)) return false;
  }

  return true;
}

/**
 * Complete a construction: flip face-up, clear construction state.
 */
function completeConstruction(instance: CardInstance): void {
  instance.underConstruction = false;
  instance.constructionProgress = undefined;
  instance.constructionResourcesAdded = undefined;
}

/**
 * Begin construction of a structure in a sector.
 * The card is placed face-down as "Under Construction."
 */
export function beginConstruction(
  state: GameState,
  cardInstanceId: string,
  sectorIdx: number
): ConstructionActionResult {
  const s = structuredClone(state);
  const sector = s.ship.sectors[sectorIdx];

  // Find the card (should be in hand, being played)
  const handIdx = s.mandateDeck.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (handIdx === -1) {
    return { state: s, success: false, message: "Card not found in hand." };
  }

  const card = s.mandateDeck.hand[handIdx];
  if (card.card.type !== "structure" || !card.card.construction) {
    return { state: s, success: false, message: "Card is not a constructable structure." };
  }

  // Check sector has room
  const occupiedSlots = sector.installedCards.filter(
    (c) => c.card.type === "structure" || c.card.type === "institution"
  ).length;
  if (occupiedSlots >= sector.maxSlots) {
    return { state: s, success: false, message: "No available structure slots in this sector." };
  }

  // Move from hand to sector
  s.mandateDeck.hand.splice(handIdx, 1);
  card.zone = "tableau";
  card.underConstruction = true;
  card.constructionProgress = 0;
  card.constructionResourcesAdded = {};
  sector.installedCards.push(card);

  return { state: s, success: true, message: `${card.card.name} construction started.` };
}

/**
 * Advance construction progress for all under-construction structures.
 * Called at the start of each turn.
 */
export function advanceAllConstruction(state: GameState): GameState {
  const s = structuredClone(state);
  const eraModifier = s.eraModifiers?.constructionTimeModifier ?? 0;

  for (const sector of s.ship.sectors) {
    for (const card of sector.installedCards) {
      if (card.underConstruction && card.card.construction) {
        // Advance time-based progress
        if (card.card.construction.completionTime && card.card.construction.completionTime > 0) {
          card.constructionProgress = (card.constructionProgress ?? 0) + 1;
        }

        // Check if construction is now complete (with era modifier)
        if (checkCompletion(card, eraModifier)) {
          completeConstruction(card);
        }
      }
    }
  }

  return s;
}

/**
 * Contribute resources toward a structure's construction.
 */
export function contributeResources(
  state: GameState,
  cardInstanceId: string,
  resources: ResourceCost
): ConstructionActionResult {
  const s = structuredClone(state);

  // Check player can afford
  if (!canAfford(s.resources, resources)) {
    return { state: s, success: false, message: "Cannot afford resource contribution." };
  }

  // Find the under-construction card
  let card: CardInstance | null = null;
  for (const sector of s.ship.sectors) {
    const found = sector.installedCards.find(
      (c) => c.instanceId === cardInstanceId && c.underConstruction
    );
    if (found) {
      card = found;
      break;
    }
  }

  if (!card) {
    return { state: s, success: false, message: "Under-construction structure not found." };
  }

  // Spend resources and add to construction
  s.resources = spendResources(s.resources, resources);
  const added = card.constructionResourcesAdded ?? {};
  card.constructionResourcesAdded = {
    matter: (added.matter ?? 0) + (resources.matter ?? 0),
    energy: (added.energy ?? 0) + (resources.energy ?? 0),
    data: (added.data ?? 0) + (resources.data ?? 0),
    influence: (added.influence ?? 0) + (resources.influence ?? 0),
  };

  // Check completion (with era modifier)
  const eraModifier = s.eraModifiers?.constructionTimeModifier ?? 0;
  if (checkCompletion(card, eraModifier)) {
    completeConstruction(card);
    return { state: s, success: true, message: `${card.card.name} construction complete!` };
  }

  return { state: s, success: true, message: `Resources contributed to ${card.card.name}.` };
}

/**
 * Fast-track a structure's construction by skipping turns.
 * Costs extra resources and generates entropy.
 */
export function fastTrack(
  state: GameState,
  cardInstanceId: string,
  turnsToSkip: number
): ConstructionActionResult {
  const s = structuredClone(state);

  // Find the under-construction card
  let card: CardInstance | null = null;
  for (const sector of s.ship.sectors) {
    const found = sector.installedCards.find(
      (c) => c.instanceId === cardInstanceId && c.underConstruction
    );
    if (found) {
      card = found;
      break;
    }
  }

  if (!card || !card.card.construction) {
    return { state: s, success: false, message: "Under-construction structure not found." };
  }

  if (!card.card.construction.fastTrackable) {
    return { state: s, success: false, message: "This structure cannot be fast-tracked." };
  }

  // Calculate total cost
  const ftCost = card.card.construction.fastTrackCost ?? {};
  const totalCost: ResourceCost = {
    matter: (ftCost.matter ?? 0) * turnsToSkip,
    energy: (ftCost.energy ?? 0) * turnsToSkip,
    data: (ftCost.data ?? 0) * turnsToSkip,
    influence: (ftCost.influence ?? 0) * turnsToSkip,
  };

  if (!canAfford(s.resources, totalCost)) {
    return { state: s, success: false, message: "Cannot afford fast-track cost." };
  }

  // Spend resources
  s.resources = spendResources(s.resources, totalCost);

  // Generate entropy
  const entropyPerTurn = card.card.construction.fastTrackEntropy ?? ENTROPY_PER_FAST_TRACK;
  s.entropy += entropyPerTurn * turnsToSkip;

  // Advance progress
  card.constructionProgress = (card.constructionProgress ?? 0) + turnsToSkip;

  // Check completion (with era modifier)
  const ftEraModifier = s.eraModifiers?.constructionTimeModifier ?? 0;
  if (checkCompletion(card, ftEraModifier)) {
    completeConstruction(card);
    return { state: s, success: true, message: `${card.card.name} fast-tracked to completion!` };
  }

  return { state: s, success: true, message: `${card.card.name} fast-tracked ${turnsToSkip} turns.` };
}
