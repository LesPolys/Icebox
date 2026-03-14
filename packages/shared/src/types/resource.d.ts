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
export declare const RESOURCE_DOMAINS: Record<ResourceType, {
    domain: string;
    inertiaEffect: string;
}>;
/** Helper: sum a ResourceCost into a single number */
export declare function totalResourceCost(cost: ResourceCost): number;
/** Helper: check if totals can afford a cost */
export declare function canAfford(totals: ResourceTotals, cost: ResourceCost): boolean;
/** Helper: subtract cost from totals (returns new object, does NOT mutate) */
export declare function spendResources(totals: ResourceTotals, cost: ResourceCost): ResourceTotals;
/** Helper: add gain to totals (returns new object, does NOT mutate) */
export declare function gainResources(totals: ResourceTotals, gain: ResourceCost): ResourceTotals;
//# sourceMappingURL=resource.d.ts.map