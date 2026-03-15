import type { GameState, CardInstance, ResourceCost } from "@icebox/shared";
import { canAfford, spendResources, DEFAULT_REASSIGN_COST } from "@icebox/shared";

export interface CrewActionResult {
  state: GameState;
  success: boolean;
  message: string;
}

/**
 * Find all crew cards attached in a given sector.
 */
export function getCrewInSector(state: GameState, sectorIdx: number): CardInstance[] {
  return state.ship.sectors[sectorIdx].installedCards.filter(
    (c) => c.card.type === "crew" && c.zone === "attached"
  );
}

/**
 * Get the crew card attached to a specific structure, if any.
 */
export function getCrewForStructure(
  state: GameState,
  structureInstanceId: string
): CardInstance | null {
  for (const sector of state.ship.sectors) {
    for (const card of sector.installedCards) {
      if (
        card.card.type === "crew" &&
        card.zone === "attached" &&
        card.attachedTo === structureInstanceId
      ) {
        return card;
      }
    }
  }
  return null;
}

/**
 * Attach a crew card from the player's hand to a structure in a sector.
 * Validates one-crew-per-structure rule.
 */
export function attachCrew(
  state: GameState,
  crewInstanceId: string,
  structureInstanceId: string,
  sectorIdx: number
): CrewActionResult {
  const s = structuredClone(state);
  const sector = s.ship.sectors[sectorIdx];

  // Find the structure
  const structure = sector.installedCards.find(
    (c) => c.instanceId === structureInstanceId && (c.card.type === "structure" || c.card.type === "institution")
  );
  if (!structure) {
    return { state: s, success: false, message: "Target structure not found in sector." };
  }

  // Check if structure is under construction
  if (structure.underConstruction) {
    return { state: s, success: false, message: "Cannot attach crew to a structure under construction." };
  }

  // Check one-crew-per-structure
  const existingCrew = sector.installedCards.find(
    (c) => c.card.type === "crew" && c.zone === "attached" && c.attachedTo === structureInstanceId
  );
  if (existingCrew) {
    return { state: s, success: false, message: "Structure already has a crew member attached." };
  }

  // Find the crew card in hand
  const handIdx = s.mandateDeck.hand.findIndex((c) => c.instanceId === crewInstanceId);
  if (handIdx === -1) {
    return { state: s, success: false, message: "Crew card not found in hand." };
  }

  const crewCard = s.mandateDeck.hand.splice(handIdx, 1)[0];
  crewCard.zone = "attached";
  crewCard.attachedTo = structureInstanceId;
  sector.installedCards.push(crewCard);

  return { state: s, success: true, message: `Crew attached to ${structure.card.name}.` };
}

/**
 * Reassign a crew card from one structure to another.
 * Costs resources (default: 1 Influence).
 */
export function reassignCrew(
  state: GameState,
  crewInstanceId: string,
  newStructureInstanceId: string,
  newSectorIdx: number
): CrewActionResult {
  const s = structuredClone(state);

  // Find the crew card across all sectors
  let crewCard: CardInstance | null = null;
  let oldSectorIdx = -1;

  for (let i = 0; i < s.ship.sectors.length; i++) {
    const sector = s.ship.sectors[i];
    const idx = sector.installedCards.findIndex(
      (c) => c.instanceId === crewInstanceId && c.card.type === "crew" && c.zone === "attached"
    );
    if (idx !== -1) {
      crewCard = sector.installedCards[idx];
      oldSectorIdx = i;
      break;
    }
  }

  if (!crewCard || oldSectorIdx === -1) {
    return { state: s, success: false, message: "Crew card not found attached to any structure." };
  }

  // Check cost
  const cost: ResourceCost = crewCard.card.crew?.reassignCost ?? DEFAULT_REASSIGN_COST;
  if (!canAfford(s.resources, cost)) {
    return { state: s, success: false, message: "Cannot afford reassignment cost." };
  }

  // Check target structure
  const newSector = s.ship.sectors[newSectorIdx];
  const newStructure = newSector.installedCards.find(
    (c) => c.instanceId === newStructureInstanceId && (c.card.type === "structure" || c.card.type === "institution")
  );
  if (!newStructure) {
    return { state: s, success: false, message: "Target structure not found." };
  }
  if (newStructure.underConstruction) {
    return { state: s, success: false, message: "Cannot attach crew to a structure under construction." };
  }

  // Check one-crew-per-structure on new target
  const existingCrew = newSector.installedCards.find(
    (c) => c.card.type === "crew" && c.zone === "attached" && c.attachedTo === newStructureInstanceId
  );
  if (existingCrew) {
    return { state: s, success: false, message: "Target structure already has a crew member." };
  }

  // Spend resources
  s.resources = spendResources(s.resources, cost);

  // Move crew
  if (oldSectorIdx !== newSectorIdx) {
    const oldSector = s.ship.sectors[oldSectorIdx];
    const idx = oldSector.installedCards.findIndex((c) => c.instanceId === crewInstanceId);
    oldSector.installedCards.splice(idx, 1);
    newSector.installedCards.push(crewCard);
  }
  crewCard.attachedTo = newStructureInstanceId;

  return { state: s, success: true, message: `Crew reassigned to ${newStructure.card.name}.` };
}

/**
 * Apply stress to a crew member. Returns updated state.
 * If stress reaches 0, triggers burnout (discard to graveyard).
 */
export interface StressResult {
  state: GameState;
  burnedOut: boolean;
}

export function applyStress(
  state: GameState,
  crewInstanceId: string,
  amount: number
): StressResult {
  const s = structuredClone(state);

  for (const sector of s.ship.sectors) {
    const crewIdx = sector.installedCards.findIndex(
      (c) => c.instanceId === crewInstanceId && c.card.type === "crew"
    );
    if (crewIdx !== -1) {
      const crew = sector.installedCards[crewIdx];
      crew.currentStress = Math.max(0, (crew.currentStress ?? 0) - amount);

      // Burnout check
      if (crew.currentStress <= 0) {
        sector.installedCards.splice(crewIdx, 1);
        crew.zone = "graveyard";
        crew.attachedTo = undefined;
        s.graveyard.cards.push(crew);
        return { state: s, burnedOut: true };
      }

      return { state: s, burnedOut: false };
    }
  }

  return { state: s, burnedOut: false };
}

/**
 * Apply stress to all crew in a sector (e.g., from hazard fallout).
 */
export interface SectorStressResult {
  state: GameState;
  affectedCrew: number;
}

export function applyStressToSector(
  state: GameState,
  sectorIdx: number,
  amount: number
): SectorStressResult {
  let s = state;
  let affectedCrew = 0;
  const crewIds = getCrewInSector(s, sectorIdx).map((c) => c.instanceId);
  for (const id of crewIds) {
    const result = applyStress(s, id, amount);
    s = result.state;
    affectedCrew++;
  }
  return { state: s, affectedCrew };
}
