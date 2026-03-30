import type { GameState, EffectCondition } from "@icebox/shared";

/**
 * Evaluator function for a condition type.
 * Returns true if the condition is met.
 */
export type ConditionEvaluator = (
  state: GameState,
  params: Record<string, unknown>
) => boolean;

// ─── Registry ───────────────────────────────────────────────────────

const evaluators = new Map<string, ConditionEvaluator>();

/**
 * Register a condition evaluator.
 * Call this at module init time to add support for new condition types.
 */
export function registerCondition(type: string, evaluator: ConditionEvaluator): void {
  evaluators.set(type, evaluator);
}

/**
 * Check if an evaluator exists for the given condition type.
 */
export function hasEvaluator(type: string): boolean {
  return evaluators.has(type);
}

/**
 * Get all registered condition type names.
 */
export function getRegisteredConditionTypes(): string[] {
  return [...evaluators.keys()];
}

// ─── Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a condition against the current game state.
 * Unknown condition types pass by default (permissive).
 */
export function evaluateCondition(
  state: GameState,
  condition: EffectCondition
): boolean {
  const evaluator = evaluators.get(condition.type);
  if (!evaluator) {
    // Unknown conditions are permissive — allows forward compatibility
    return true;
  }
  return evaluator(state, condition.params);
}
