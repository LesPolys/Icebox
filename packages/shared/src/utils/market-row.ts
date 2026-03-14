import type { Card } from "../types/card.js";
import type { MarketRowId } from "../types/deck.js";

/**
 * Determines which market row a card should be assigned to.
 *
 * Row A (Physical): Matter/Energy focused — hardware, repairs, environmental hazards
 * Row B (Social): Data/Influence focused — policies, factions, cultural events
 *
 * Assignment rules:
 * - Hazards: use targetRow from hazard data if specified, else derive from faction
 * - By faction resource pairing:
 *   - Void-Forged (M+E) → physical
 *   - Sowers (M+I) → physical
 *   - Gilded (M+D) → physical
 *   - Archival Core (E+D) → social
 *   - The Flux (E+I) → social
 *   - The Echoes (D+I) → social
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
      return "physical";

    case "archival-core":
    case "the-flux":
    case "the-echoes":
      return "social";

    case "neutral":
    default: {
      // Use tags as hints
      const tags = card.tags;
      if (tags.includes("physical") || tags.includes("hull") || tags.includes("repair") || tags.includes("structural")) {
        return "physical";
      }
      if (tags.includes("social") || tags.includes("political") || tags.includes("cultural")) {
        return "social";
      }
      // Alternate neutral cards between rows
      return (neutralCounter++ % 2 === 0) ? "physical" : "social";
    }
  }
}

/** Reset the neutral counter (useful for testing) */
export function resetMarketRowCounter(): void {
  neutralCounter = 0;
}
