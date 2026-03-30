import type { GameState, FactionId } from "@icebox/shared";
import { registerCondition } from "../ConditionRegistry";

// ─── Resource Conditions ────────────────────────────────────────────

registerCondition("resource-threshold", (state: GameState, params: Record<string, unknown>) => {
  const resource = params.resource as keyof typeof state.resources;
  const threshold = params.threshold as number;
  const comparison = (params.comparison as string) ?? "gte";
  const value = state.resources[resource];
  return comparison === "gte" ? value >= threshold : value < threshold;
});

// ─── Sleep / Time Conditions ────────────────────────────────────────

registerCondition("sleep-count", (state: GameState, params: Record<string, unknown>) => {
  const threshold = params.threshold as number;
  return state.totalSleepCycles >= threshold;
});

// ─── Faction Conditions ─────────────────────────────────────────────

registerCondition("faction-dominance", (state: GameState, params: Record<string, unknown>) => {
  const faction = params.faction as FactionId;
  const scope = (params.scope as string) ?? "global";

  if (scope === "sector") {
    const sectorIndex = params.sectorIndex as number;
    const sector = state.ship.sectors[sectorIndex];
    return sector ? sector.dominantFaction === faction : false;
  }

  // Global: check if faction has highest global presence
  let maxPresence = 0;
  let maxFaction: FactionId | null = null;
  for (const [f, p] of Object.entries(state.globalFactionPresence)) {
    if (p > maxPresence) {
      maxPresence = p;
      maxFaction = f as FactionId;
    }
  }
  return maxFaction === faction;
});

registerCondition("sector-control", (state: GameState, params: Record<string, unknown>) => {
  const sectorIndex = params.sectorIndex as number;
  const minCards = (params.minCards as number) ?? 1;
  const sector = state.ship.sectors[sectorIndex];
  if (!sector) return false;
  return sector.installedCards.filter((c) => !c.underConstruction).length >= minCards;
});

// ─── Tableau Conditions ─────────────────────────────────────────────

registerCondition("card-in-tableau", (state: GameState, params: Record<string, unknown>) => {
  const cardId = params.cardId as string | undefined;
  const tag = params.tag as string | undefined;
  const faction = params.faction as FactionId | undefined;

  for (const sector of state.ship.sectors) {
    for (const cardInst of sector.installedCards) {
      if (cardInst.underConstruction) continue;

      if (cardId && cardInst.card.id === cardId) return true;
      if (tag && cardInst.card.tags.includes(tag)) return true;
      if (faction && cardInst.card.faction === faction) return true;
    }
  }
  return false;
});
