import type { Card } from "../types/card.js";
import type { MarketRowId } from "../types/deck.js";

/**
 * Determines which market row a card should be assigned to.
 *
 * Upper row: Matter/Energy focused — hardware, repairs, environmental hazards
 * Lower row: Data/Influence focused — policies, factions, cultural events
 *
 * Assignment rules:
 * - Hazards: use targetRow from hazard data if specified, else derive from faction
 * - By faction resource pairing:
 *   - Void-Forged (M+E) → upper
 *   - Sowers (M+I) → upper
 *   - Gilded (M+D) → upper
 *   - Archival Core (E+D) → lower
 *   - The Flux (E+I) → lower
 *   - The Echoes (D+I) → lower
 * - Neutral: use tags to determine, default to alternating
 */

let neutralCounter = 0;

export function getMarketRow(card: Card): MarketRowId {
  // Hazards can specify their target row
  if (card.type === "hazard" && card.hazard?.targetRow) {
    return card.hazard.targetRow;
  }

  // Faction-based assignment
  switch (card.faction) {
    case "void-forged":
    case "sowers":
    case "gilded":
      return "upper";

    case "archival-core":
    case "the-flux":
    case "the-echoes":
      return "lower";

    case "neutral":
    default: {
      // Use tags as hints
      const tags = card.tags;
      if (tags.includes("physical") || tags.includes("hull") || tags.includes("repair") || tags.includes("structural")) {
        return "upper";
      }
      if (tags.includes("social") || tags.includes("political") || tags.includes("cultural")) {
        return "lower";
      }
      // Alternate neutral cards between rows
      return (neutralCounter++ % 2 === 0) ? "upper" : "lower";
    }
  }
}

/** Reset the neutral counter (useful for testing) */
export function resetMarketRowCounter(): void {
  neutralCounter = 0;
}
