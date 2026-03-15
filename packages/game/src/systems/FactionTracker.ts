import type {
  FactionId,
  CardInstance,
  SectorState,
  ShipState,
} from "@icebox/shared";
import { ALL_FACTION_IDS } from "@icebox/shared";

/**
 * Pure logic for tracking faction presence and dominance.
 */

/**
 * Calculate faction presence for a single sector based on installed cards.
 */
export function calculateSectorPresence(
  sector: SectorState
): Record<FactionId, number> {
  const presence = emptyPresence();

  // Location card contributes
  if (sector.location) {
    for (const icon of sector.location.card.factionIcons) {
      presence[icon] += sector.location.card.cryosleep.factionWeight;
    }
  }

  // Installed structures/institutions contribute
  for (const cardInst of sector.installedCards) {
    if (!cardInst.powered) continue; // depowered cards don't count
    if (cardInst.underConstruction) continue; // under-construction cards don't count
    for (const icon of cardInst.card.factionIcons) {
      presence[icon] += cardInst.card.cryosleep.factionWeight;
    }
  }

  return presence;
}

/**
 * Determine the dominant faction in a sector.
 * Returns null if no faction has presence.
 */
export function getSectorDominant(
  presence: Record<FactionId, number>
): FactionId | null {
  let maxPresence = 0;
  let dominant: FactionId | null = null;

  for (const fid of ALL_FACTION_IDS) {
    if (presence[fid] > maxPresence) {
      maxPresence = presence[fid];
      dominant = fid;
    }
  }

  return dominant;
}

/**
 * Update all sector presence and dominance values.
 */
export function updateShipPresence(ship: ShipState): ShipState {
  const sectors = ship.sectors.map((sector) => {
    const factionPresence = calculateSectorPresence(sector);
    const dominantFaction = getSectorDominant(factionPresence);
    return { ...sector, factionPresence, dominantFaction };
  }) as [SectorState, SectorState, SectorState];

  return { sectors };
}

/**
 * Calculate global faction presence across all sectors.
 */
export function calculateGlobalPresence(
  ship: ShipState
): Record<FactionId, number> {
  const global = emptyPresence();

  for (const sector of ship.sectors) {
    for (const fid of ALL_FACTION_IDS) {
      global[fid] += sector.factionPresence[fid];
    }
  }

  return global;
}

/**
 * Calculate World Score for Cryosleep from market + tableau + existing presence.
 */
export function calculateWorldScore(
  flushedMarketCards: CardInstance[],
  ship: ShipState,
  existingPresence: Record<FactionId, number>
): Record<FactionId, number> {
  const score = emptyPresence();

  // Market cards
  for (const cardInst of flushedMarketCards) {
    for (const icon of cardInst.card.factionIcons) {
      score[icon] += cardInst.card.cryosleep.factionWeight;
    }
  }

  // Tableau cards (skip under-construction)
  for (const sector of ship.sectors) {
    for (const cardInst of sector.installedCards) {
      if (cardInst.underConstruction) continue;
      for (const icon of cardInst.card.factionIcons) {
        score[icon] += cardInst.card.cryosleep.factionWeight;
      }
    }
  }

  // Existing presence baseline
  for (const fid of ALL_FACTION_IDS) {
    score[fid] += existingPresence[fid];
  }

  return score;
}

/**
 * Determine dominant faction from world score.
 * Tiebreakers: (1) card count in world deck, (2) alphabetical.
 */
export function resolveDominant(
  worldScore: Record<FactionId, number>,
  worldDeckCards: CardInstance[]
): FactionId {
  const sorted = ALL_FACTION_IDS
    .map((fid) => ({ fid, score: worldScore[fid] }))
    .sort((a, b) => {
      // Primary: highest score
      if (b.score !== a.score) return b.score - a.score;
      // Tiebreaker 1: most cards in world deck
      const aCount = worldDeckCards.filter((c) => c.card.faction === a.fid).length;
      const bCount = worldDeckCards.filter((c) => c.card.faction === b.fid).length;
      if (bCount !== aCount) return bCount - aCount;
      // Tiebreaker 2: alphabetical
      return a.fid.localeCompare(b.fid);
    });

  return sorted[0].fid;
}

/**
 * Determine weakest faction from world score.
 * Tiebreakers: (1) fewest cards in world deck, (2) reverse alphabetical.
 */
export function resolveWeakest(
  worldScore: Record<FactionId, number>,
  worldDeckCards: CardInstance[]
): FactionId {
  const sorted = ALL_FACTION_IDS
    .map((fid) => ({ fid, score: worldScore[fid] }))
    .sort((a, b) => {
      // Primary: lowest score
      if (a.score !== b.score) return a.score - b.score;
      // Tiebreaker 1: fewest cards
      const aCount = worldDeckCards.filter((c) => c.card.faction === a.fid).length;
      const bCount = worldDeckCards.filter((c) => c.card.faction === b.fid).length;
      if (aCount !== bCount) return aCount - bCount;
      // Tiebreaker 2: reverse alphabetical
      return b.fid.localeCompare(a.fid);
    });

  return sorted[0].fid;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function emptyPresence(): Record<FactionId, number> {
  const result = {} as Record<FactionId, number>;
  for (const fid of ALL_FACTION_IDS) result[fid] = 0;
  return result;
}
