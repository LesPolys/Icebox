import type { ResourceCost, ResourceTotals, ResourceType } from "@icebox/shared";
import { canAfford, spendResources, gainResources } from "@icebox/shared";

/**
 * Pure logic for resource management.
 * Re-exports shared helpers and adds game-specific operations.
 */

export { canAfford, spendResources, gainResources };

export interface ResourceTransaction {
  type: "spend" | "gain";
  resources: ResourceCost;
  reason: string;
}

/**
 * Apply a transaction to totals. Returns new totals or null if cannot afford.
 */
export function applyTransaction(
  totals: ResourceTotals,
  transaction: ResourceTransaction
): ResourceTotals | null {
  if (transaction.type === "spend") {
    if (!canAfford(totals, transaction.resources)) return null;
    return spendResources(totals, transaction.resources);
  } else {
    return gainResources(totals, transaction.resources);
  }
}

/**
 * Apply multiple transactions in sequence. Returns null if any spend fails.
 */
export function applyTransactions(
  totals: ResourceTotals,
  transactions: ResourceTransaction[]
): ResourceTotals | null {
  let current = totals;
  for (const tx of transactions) {
    const result = applyTransaction(current, tx);
    if (result === null) return null;
    current = result;
  }
  return current;
}

/**
 * Drain resources by a fixed amount per sleep cycle (clamped to 0).
 */
export function drainResources(
  totals: ResourceTotals,
  drain: ResourceCost
): ResourceTotals {
  return {
    matter: Math.max(0, totals.matter - (drain.matter ?? 0)),
    energy: Math.max(0, totals.energy - (drain.energy ?? 0)),
    data: Math.max(0, totals.data - (drain.data ?? 0)),
    influence: Math.max(0, totals.influence - (drain.influence ?? 0)),
  };
}

/**
 * Get the deficit for a specific resource against a threshold.
 * Returns 0 if at or above threshold.
 */
export function getDeficit(
  totals: ResourceTotals,
  resource: ResourceType,
  threshold: number
): number {
  return Math.max(0, threshold - totals[resource]);
}

/**
 * Check which resources are below their thresholds.
 */
export function checkThresholdBreaches(
  totals: ResourceTotals,
  thresholds: {
    matter: number;
    energy: number;
    data: number;
    influence: number;
  }
): Record<ResourceType, number> {
  return {
    matter: getDeficit(totals, "matter", thresholds.matter),
    energy: getDeficit(totals, "energy", thresholds.energy),
    data: getDeficit(totals, "data", thresholds.data),
    influence: getDeficit(totals, "influence", thresholds.influence),
  };
}
