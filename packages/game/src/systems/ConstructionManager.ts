import type { GameState, CardInstance, ResourceCost } from "@icebox/shared";
import { canAfford, spendResources } from "@icebox/shared";

export interface ConstructionActionResult {
  state: GameState;
  success: boolean;
  message: string;
}

/**
 * Check if a card instance has met all construction requirements.
 * Construction is now purely time-based.
 * @param eraModifier — constructionTimeModifier from current era (default 0)
 */
export function checkCompletion(instance: CardInstance, eraModifier: number = 0): boolean {
  const construction = instance.card.construction;
  if (!construction || !instance.underConstruction) return false;

  if (construction.completionTime && construction.completionTime > 0) {
    const adjustedTime = Math.max(1, construction.completionTime + eraModifier);
    if ((instance.constructionProgress ?? 0) < adjustedTime) {
      return false;
    }
  }

  return true;
}

/**
 * Complete a construction: flip face-up, clear construction state.
 */
function completeConstruction(instance: CardInstance): void {
  instance.underConstruction = false;
  instance.constructionProgress = undefined;
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

  const handIdx = s.mandateDeck.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (handIdx === -1) {
    return { state: s, success: false, message: "Card not found in hand." };
  }

  const card = s.mandateDeck.hand[handIdx];
  if (card.card.type !== "structure" || !card.card.construction) {
    return { state: s, success: false, message: "Card is not a constructable structure." };
  }

  const occupiedSlots = sector.installedCards.filter(
    (c) => c.card.type === "structure" || c.card.type === "institution"
  ).length;
  if (occupiedSlots >= sector.maxSlots) {
    return { state: s, success: false, message: "No available structure slots in this sector." };
  }

  s.mandateDeck.hand.splice(handIdx, 1);
  card.zone = "tableau";
  card.underConstruction = true;
  card.constructionProgress = 0;
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
        if (card.card.construction.completionTime && card.card.construction.completionTime > 0) {
          card.constructionProgress = (card.constructionProgress ?? 0) + 1;
        }

        if (checkCompletion(card, eraModifier)) {
          completeConstruction(card);
        }
      }
    }
  }

  return s;
}

/**
 * Progress a building's construction by a given number of ticks.
 * Used by the matter resource action from market falloff/purchase.
 */
export function progressConstruction(
  state: GameState,
  cardInstanceId: string,
  ticks: number = 1
): ConstructionActionResult {
  const s = structuredClone(state);

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

  card.constructionProgress = (card.constructionProgress ?? 0) + ticks;

  const eraModifier = s.eraModifiers?.constructionTimeModifier ?? 0;
  if (checkCompletion(card, eraModifier)) {
    completeConstruction(card);
    return { state: s, success: true, message: `${card.card.name} construction complete!` };
  }

  return { state: s, success: true, message: `${card.card.name} progressed ${ticks} tick(s).` };
}

/**
 * Fast-track a structure's construction by skipping turns.
 * Costs extra resources.
 */
export function fastTrack(
  state: GameState,
  cardInstanceId: string,
  turnsToSkip: number
): ConstructionActionResult {
  const s = structuredClone(state);

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

  s.resources = spendResources(s.resources, totalCost);
  card.constructionProgress = (card.constructionProgress ?? 0) + turnsToSkip;

  const ftEraModifier = s.eraModifiers?.constructionTimeModifier ?? 0;
  if (checkCompletion(card, ftEraModifier)) {
    completeConstruction(card);
    return { state: s, success: true, message: `${card.card.name} fast-tracked to completion!` };
  }

  return { state: s, success: true, message: `${card.card.name} fast-tracked ${turnsToSkip} turns.` };
}
