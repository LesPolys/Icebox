import type {
  GameState,
  CardEffect,
  CardInstance,
  ResourceCost,
  TransitMarketState,
} from "@icebox/shared";

/**
 * Unified passive effect scanner.
 *
 * Scans all sources of passive effects:
 * 1. Hazard cards in the transit market
 * 2. Tableau cards (structures, institutions) with timing: "passive"
 * 3. Location cards with passiveEffect
 *
 * Provides query functions for systems that need to check passive modifiers.
 */

interface PassiveSource {
  card: CardInstance;
  effect: CardEffect;
  source: "market-hazard" | "tableau" | "location";
}

/**
 * Gather all active passive effects from all sources.
 */
export function getAllPassiveEffects(state: GameState): PassiveSource[] {
  const results: PassiveSource[] = [];

  // 1. Market hazards
  const allSlots = [...state.transitMarket.upperRow.slots, ...state.transitMarket.lowerRow.slots];
  for (const slot of allSlots) {
    if (!slot) continue;
    if (slot.card.type !== "hazard") continue;
    for (const effect of slot.card.effects) {
      if (effect.timing === "passive") {
        results.push({ card: slot, effect, source: "market-hazard" });
      }
    }
  }

  // 2. Tableau cards
  for (const sector of state.ship.sectors) {
    for (const cardInst of sector.installedCards) {
      if (cardInst.underConstruction) continue;
      if (!cardInst.powered) continue;
      for (const effect of cardInst.card.effects) {
        if (effect.timing === "passive") {
          results.push({ card: cardInst, effect, source: "tableau" });
        }
      }
    }
  }

  // 3. Location passive effects
  for (const sector of state.ship.sectors) {
    if (sector.location?.card.location?.passiveEffect) {
      results.push({
        card: sector.location,
        effect: sector.location.card.location.passiveEffect,
        source: "location",
      });
    }
  }

  return results;
}

/**
 * Calculate aggregate cost modifier from all passive sources.
 *
 * @param scope - Which context to gather modifiers for:
 *   "market" — market purchases (matches scope "market", "all")
 *   "structures" — slotting structures/institutions (matches scope "structures", "all")
 *   "actions" — playing action cards (matches scope "actions", "all")
 *   "all" — everything
 */
export function getCostModifier(state: GameState, scope: string = "market"): ResourceCost {
  const modifier: ResourceCost = {};
  const passives = getAllPassiveEffects(state);

  for (const { effect } of passives) {
    if (effect.type !== "modify-cost") continue;
    const effectScope = (effect.params.scope as string) ?? "all";

    // Match if scopes align
    const matches =
      effectScope === "all" ||
      effectScope === scope ||
      scope === "all" ||
      (scope === "market" && effectScope === "market") ||
      (scope === "structures" && effectScope === "structures") ||
      (scope === "actions" && effectScope === "actions");

    if (!matches) continue;

    const resource = effect.params.resource as string | undefined;
    const amount = (effect.params.amount as number) ?? 0;
    if (resource && resource !== "any") {
      const key = resource as keyof ResourceCost;
      modifier[key] = (modifier[key] ?? 0) + amount;
    } else if (resource === "any") {
      // "any" applies to all resource types
      for (const key of ["matter", "energy", "data", "influence"] as const) {
        modifier[key] = (modifier[key] ?? 0) + amount;
      }
    }
  }

  return modifier;
}

/**
 * Check if a specific action is disabled by any passive effect.
 */
export function isActionDisabled(
  state: GameState,
  actionType: "draw-extra" | "play-action" | "slot-structure" | "gain-influence"
): boolean {
  const passives = getAllPassiveEffects(state);

  for (const { effect } of passives) {
    const params = effect.params;
    switch (actionType) {
      case "draw-extra":
        if (params.disableDrawExtra) return true;
        break;
      case "play-action":
        if (params.disableActions && params.scope === "structures") return true;
        break;
      case "slot-structure":
        break;
      case "gain-influence":
        if (params.disableInfluenceGain) return true;
        break;
    }
  }

  return false;
}

/**
 * Check if a specific market slot is locked by a passive effect.
 */
export function isSlotLocked(
  state: GameState,
  row: "upper" | "lower",
  slotIndex: number
): boolean {
  const passives = getAllPassiveEffects(state);

  for (const { effect } of passives) {
    if (effect.type !== "lock-market-slot") continue;
    const params = effect.params;

    // Exact slot lock
    if (params.row === row && params.slotIndex === slotIndex) return true;

    // Row-wide lock
    if (params.row === row && params.slotIndex === undefined) return true;

    // Scope-based (cheapest / most-expensive)
    if (params.scope === "cheapest" || params.scope === "most-expensive") {
      const marketRow = row === "upper" ? state.transitMarket.upperRow : state.transitMarket.lowerRow;
      const slots = marketRow.slots
        .map((s, i) => (s ? { cost: totalCost(s.card.cost), index: i } : null))
        .filter(Boolean) as { cost: number; index: number }[];

      if (slots.length === 0) continue;

      slots.sort((a, b) => a.cost - b.cost);
      const targetIdx = params.scope === "cheapest" ? slots[0].index : slots[slots.length - 1].index;
      if (targetIdx === slotIndex) return true;
    }
  }

  return false;
}

/**
 * Get the total hull damage reduction from prevent-damage passives.
 */
export function getDamageReduction(state: GameState): number {
  const passives = getAllPassiveEffects(state);
  let reduction = 0;

  for (const { effect } of passives) {
    if (effect.type !== "prevent-damage") continue;
    const scope = (effect.params.scope as string) ?? "hull";
    if (scope === "hull" || scope === "all") {
      reduction += (effect.params.amount as number) ?? 0;
    }
  }

  return reduction;
}

/**
 * Get the extra slide count from passive effects.
 */
export function getExtraSlideCount(state: GameState): number {
  const passives = getAllPassiveEffects(state);
  let extra = 0;

  for (const { effect } of passives) {
    if (effect.type === "shift-faction" && effect.params.extraSlide) {
      extra += effect.params.extraSlide as number;
    }
  }

  return extra;
}

/**
 * Get the number of cards to peek from deck passives.
 */
export function getPeekCount(state: GameState, target: "world-deck" | "mandate-deck"): number {
  const passives = getAllPassiveEffects(state);
  let count = 0;

  for (const { effect } of passives) {
    if (effect.type === "peek-deck" && effect.params.target === target) {
      count += (effect.params.count as number) ?? 0;
    }
  }

  return count;
}

function totalCost(cost: ResourceCost): number {
  return (cost.matter ?? 0) + (cost.energy ?? 0) + (cost.data ?? 0) + (cost.influence ?? 0);
}
