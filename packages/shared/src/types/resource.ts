/** The four core resources that drive all game systems */
export type ResourceType = "matter" | "energy" | "data" | "influence";

/** A cost or gain expressed in resources. All fields optional; missing = 0 */
export interface ResourceCost {
  matter?: number;
  energy?: number;
  data?: number;
  influence?: number;
}

/** Concrete resource totals (all fields required) */
export interface ResourceTotals {
  matter: number;
  energy: number;
  data: number;
  influence: number;
}

/** Resource domains and what they protect against during sleep */
export const RESOURCE_DOMAINS: Record<ResourceType, { domain: string; inertiaEffect: string }> = {
  matter: { domain: "Physicality", inertiaEffect: "Integrity — prevents Hull Breach junk" },
  energy: { domain: "Vitality", inertiaEffect: "Uptime — keeps tableau cards powered on" },
  data: { domain: "Knowledge", inertiaEffect: "Retention — prevents tech decay" },
  influence: { domain: "Spirit", inertiaEffect: "Cohesion — prevents factional coups" },
};

/** Helper: sum a ResourceCost into a single number */
export function totalResourceCost(cost: ResourceCost): number {
  return (cost.matter ?? 0) + (cost.energy ?? 0) + (cost.data ?? 0) + (cost.influence ?? 0);
}

/** Helper: check if totals can afford a cost */
export function canAfford(totals: ResourceTotals, cost: ResourceCost): boolean {
  return (
    totals.matter >= (cost.matter ?? 0) &&
    totals.energy >= (cost.energy ?? 0) &&
    totals.data >= (cost.data ?? 0) &&
    totals.influence >= (cost.influence ?? 0)
  );
}

/** Helper: subtract cost from totals (returns new object, does NOT mutate) */
export function spendResources(totals: ResourceTotals, cost: ResourceCost): ResourceTotals {
  return {
    matter: totals.matter - (cost.matter ?? 0),
    energy: totals.energy - (cost.energy ?? 0),
    data: totals.data - (cost.data ?? 0),
    influence: totals.influence - (cost.influence ?? 0),
  };
}

/** Helper: add gain to totals (returns new object, does NOT mutate) */
export function gainResources(totals: ResourceTotals, gain: ResourceCost): ResourceTotals {
  return {
    matter: totals.matter + (gain.matter ?? 0),
    energy: totals.energy + (gain.energy ?? 0),
    data: totals.data + (gain.data ?? 0),
    influence: totals.influence + (gain.influence ?? 0),
  };
}
