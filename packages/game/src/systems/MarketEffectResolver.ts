import type {
  CardEffect,
  CardInstance,
  ResourceCost,
  TransitMarketState,
} from "@icebox/shared";

/**
 * Scans the transit market for active passive effects from hazard cards.
 * Hazards exert negative pressure while they sit in the market.
 */

/**
 * Get all active passive effects from cards currently in the market.
 */
export function getActiveMarketEffects(
  market: TransitMarketState
): { card: CardInstance; effect: CardEffect }[] {
  const results: { card: CardInstance; effect: CardEffect }[] = [];

  // Scan both rows
  const allSlots = [...market.upperRow.slots, ...market.lowerRow.slots];

  for (const slot of allSlots) {
    if (!slot) continue;
    if (slot.card.type !== "hazard") continue;

    for (const effect of slot.card.effects) {
      if (effect.timing === "passive") {
        results.push({ card: slot, effect });
      }
    }
  }

  return results;
}

/**
 * Calculate the aggregate cost modifier from all active hazard passives.
 * Returns extra cost that should be added to any market purchase.
 */
export function getMarketCostModifier(
  market: TransitMarketState
): ResourceCost {
  const modifier: ResourceCost = {};
  const activeEffects = getActiveMarketEffects(market);

  for (const { effect } of activeEffects) {
    if (effect.type === "modify-cost" && effect.params.scope === "market") {
      const resource = effect.params.resource as string | undefined;
      const amount = (effect.params.amount as number) ?? 0;

      if (resource) {
        // Specific resource modifier
        const key = resource as keyof ResourceCost;
        modifier[key] = (modifier[key] ?? 0) + amount;
      }
      // If no resource specified, it's a generic "any resource" modifier
      // This is tracked but requires UI to let player choose which resource
    }
  }

  return modifier;
}

/**
 * Check if a specific action type is disabled by an active hazard.
 */
export function isActionDisabled(
  market: TransitMarketState,
  actionType: "draw-extra" | "play-action" | "slot-structure" | "gain-influence"
): boolean {
  const activeEffects = getActiveMarketEffects(market);

  for (const { effect } of activeEffects) {
    const params = effect.params;

    switch (actionType) {
      case "draw-extra":
        if (params.disableDrawExtra) return true;
        break;
      case "play-action":
        if (params.disableActions && params.scope === "structures") return true;
        break;
      case "slot-structure":
        // Structural Fatigue doesn't disable slotting, just costs more
        break;
      case "gain-influence":
        if (params.disableInfluenceGain) return true;
        break;
    }
  }

  return false;
}

/**
 * Get the extra slide count from hazard passives (e.g., Factional Agitator).
 */
export function getExtraSlideCount(market: TransitMarketState): number {
  let extra = 0;
  const activeEffects = getActiveMarketEffects(market);

  for (const { effect } of activeEffects) {
    if (effect.type === "shift-faction" && effect.params.extraSlide) {
      extra += effect.params.extraSlide as number;
    }
  }

  return extra;
}
