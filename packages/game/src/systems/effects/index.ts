/**
 * Effect System — Registry-based card effect resolution.
 *
 * Import this module to initialize all handlers and conditions.
 * All registrations happen as side effects of importing the handler/condition modules.
 */

// Register all condition evaluators
import "./conditions/index";

// Register all effect handlers
import "./handlers/resourceHandlers";
import "./handlers/deckHandlers";
import "./handlers/marketHandlers";
import "./handlers/shipHandlers";
import "./handlers/crewHandlers";

// Re-export public API
export { resolveEffect, emitTiming, registerEffect, hasHandler, getRegisteredEffectTypes } from "./EffectRegistry";
export type { EffectResult, EffectHandler, TimingContext } from "./EffectRegistry";
export { evaluateCondition, registerCondition, hasEvaluator, getRegisteredConditionTypes } from "./ConditionRegistry";
export type { ConditionEvaluator } from "./ConditionRegistry";
export {
  getAllPassiveEffects,
  getCostModifier,
  isActionDisabled,
  isSlotLocked,
  getDamageReduction,
  getExtraSlideCount,
  getPeekCount,
} from "./PassiveScanner";
export { setCardDefinitions } from "./handlers/deckHandlers";
