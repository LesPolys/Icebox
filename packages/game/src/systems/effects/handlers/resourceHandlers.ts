import type { GameState, CardEffect, CardInstance, ResourceCost } from "@icebox/shared";
import { gainResources, spendResources } from "@icebox/shared";
import { registerEffect, type EffectResult } from "../EffectRegistry";

const RESOURCE_KEYS = ["matter", "energy", "data", "influence"] as const;

/**
 * Extract a ResourceCost from effect params.
 * Supports two formats:
 *   1. Shorthand: { matter: 1, energy: 2 }
 *   2. Explicit:  { resource: "matter", amount: 1 }
 */
function extractResourceGain(params: Record<string, unknown>): ResourceCost {
  // Explicit format: { resource: "matter", amount: 1 }
  if (params.resource && params.amount !== undefined) {
    return { [params.resource as string]: params.amount as number };
  }
  // Shorthand format: { matter: 1, energy: 2 }
  const cost: ResourceCost = {};
  for (const key of RESOURCE_KEYS) {
    if (typeof params[key] === "number") {
      cost[key] = params[key] as number;
    }
  }
  return cost;
}

function describeResources(cost: ResourceCost): string {
  return RESOURCE_KEYS
    .filter((k) => cost[k])
    .map((k) => `${cost[k]} ${k}`)
    .join(", ");
}

registerEffect("gain-resource", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const gain = extractResourceGain(effect.params);
  s.resources = gainResources(s.resources, gain);
  return { state: s, message: `Gained ${describeResources(gain)}.` };
});

registerEffect("spend-resource", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);

  // Handle depower-structures variant (params.depower or params.effect === "depower")
  if (effect.params.depower || effect.params.effect === "depower") {
    const count = (effect.params.depower as number) ?? (effect.params.count as number) ?? 1;
    let depowered = 0;
    const allCards = s.ship.sectors.flatMap((sec) => sec.installedCards);
    const sorted = allCards
      .filter((c) => c.powered)
      .sort((a, b) => a.card.cryosleep.survivalPriority - b.card.cryosleep.survivalPriority);
    for (const card of sorted) {
      if (depowered >= count) break;
      card.powered = false;
      depowered++;
    }
    return { state: s, message: `Depowered ${depowered} structure(s).` };
  }

  const cost = extractResourceGain(effect.params);
  s.resources = spendResources(s.resources, cost);
  for (const key of RESOURCE_KEYS) {
    if (s.resources[key] < 0) s.resources[key] = 0;
  }

  // Optional: gain another resource (selfGain or gainResource)
  const selfGain = effect.params.selfGain as Record<string, unknown> | undefined;
  if (selfGain) {
    s.resources = gainResources(s.resources, extractResourceGain(selfGain));
  } else if (effect.params.gainResource) {
    s.resources = gainResources(s.resources, {
      [effect.params.gainResource as string]: effect.params.gainAmount as number,
    });
  }

  return { state: s, message: `Spent ${describeResources(cost)}.` };
});
