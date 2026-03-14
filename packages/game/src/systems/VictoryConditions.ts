import type { GameState, FactionId } from "@icebox/shared";
import { ALL_FACTION_IDS, MAX_YEARS } from "@icebox/shared";

/**
 * Victory and defeat condition checks.
 *
 * Victory: Reach year 1000 with Hull Integrity > 0%.
 * Defeat: Hull Integrity = 0% (Structural Failure) OR
 *         any faction reaches 100% Dominance (Social Collapse).
 */

export interface DefeatResult {
  defeated: true;
  reason: "structural-failure" | "social-collapse";
  description: string;
  faction?: FactionId;
}

export interface VictoryResult {
  victory: true;
  type: string;
  dominantFaction: FactionId;
  description: string;
}

/**
 * Check if the game has been lost.
 */
export function checkDefeat(state: GameState): DefeatResult | null {
  // Structural Failure: Hull Integrity = 0
  if (state.hullIntegrity <= 0) {
    return {
      defeated: true,
      reason: "structural-failure",
      description: "The hull has failed. The void has claimed the Aethel.",
    };
  }

  // Social Collapse: any faction has overwhelming dominance
  // "100% Dominance" is interpreted as a faction controlling all 3 sectors
  // AND having dominant presence globally above a threshold
  const totalPresence = Object.values(state.globalFactionPresence).reduce((a, b) => a + b, 0);
  if (totalPresence > 0) {
    for (const fid of ALL_FACTION_IDS) {
      const ratio = state.globalFactionPresence[fid] / totalPresence;
      if (ratio >= 0.9) { // 90%+ dominance triggers coup
        return {
          defeated: true,
          reason: "social-collapse",
          description: `${fid} has staged a coup. The Commanding Mandate has been dissolved.`,
          faction: fid,
        };
      }
    }
  }

  return null;
}

/**
 * Check if the game has been won.
 */
export function checkVictory(state: GameState): VictoryResult | null {
  if (state.yearsPassed < MAX_YEARS) return null;
  if (state.hullIntegrity <= 0) return null; // Dead ships don't win

  // Determine victory type from dominance history
  let maxCenturies = 0;
  let dominantFaction: FactionId = "void-forged";

  for (const fid of ALL_FACTION_IDS) {
    const centuries = state.dominanceHistory[fid] ?? 0;
    if (centuries > maxCenturies) {
      maxCenturies = centuries;
      dominantFaction = fid;
    }
  }

  const victoryTypes: Record<FactionId, string> = {
    "void-forged": "Survivalist",
    "sowers": "Biological Utopia",
    "gilded": "Corporate State",
    "archival-core": "Preserved Heritage",
    "the-flux": "Evolutionary Anarchy",
    "the-echoes": "Ancestral Legacy",
  };

  return {
    victory: true,
    type: victoryTypes[dominantFaction] ?? "Unknown",
    dominantFaction,
    description: `The Aethel has arrived. A ${victoryTypes[dominantFaction]} civilization emerges.`,
  };
}
