/** Resource domains and what they protect against during sleep */
export const RESOURCE_DOMAINS = {
    matter: { domain: "Physicality", inertiaEffect: "Integrity — prevents Hull Breach junk" },
    energy: { domain: "Vitality", inertiaEffect: "Uptime — keeps tableau cards powered on" },
    data: { domain: "Knowledge", inertiaEffect: "Retention — prevents tech decay" },
    influence: { domain: "Spirit", inertiaEffect: "Cohesion — prevents factional coups" },
};
/** Helper: sum a ResourceCost into a single number */
export function totalResourceCost(cost) {
    return (cost.matter ?? 0) + (cost.energy ?? 0) + (cost.data ?? 0) + (cost.influence ?? 0);
}
/** Helper: check if totals can afford a cost */
export function canAfford(totals, cost) {
    return (totals.matter >= (cost.matter ?? 0) &&
        totals.energy >= (cost.energy ?? 0) &&
        totals.data >= (cost.data ?? 0) &&
        totals.influence >= (cost.influence ?? 0));
}
/** Helper: subtract cost from totals (returns new object, does NOT mutate) */
export function spendResources(totals, cost) {
    return {
        matter: totals.matter - (cost.matter ?? 0),
        energy: totals.energy - (cost.energy ?? 0),
        data: totals.data - (cost.data ?? 0),
        influence: totals.influence - (cost.influence ?? 0),
    };
}
/** Helper: add gain to totals (returns new object, does NOT mutate) */
export function gainResources(totals, gain) {
    return {
        matter: totals.matter + (gain.matter ?? 0),
        energy: totals.energy + (gain.energy ?? 0),
        data: totals.data + (gain.data ?? 0),
        influence: totals.influence + (gain.influence ?? 0),
    };
}
//# sourceMappingURL=resource.js.map