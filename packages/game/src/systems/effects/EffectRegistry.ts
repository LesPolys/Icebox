import type { GameState, CardEffect, CardInstance, EffectTiming, EffectType } from "@icebox/shared";
import { evaluateCondition } from "./ConditionRegistry";

// ─── Types ──────────────────────────────────────────────────────────

export interface EffectResult {
  state: GameState;
  message: string;
}

/**
 * Handler function for a specific effect type.
 * Receives the current state, the effect definition, and the source card instance.
 * Must return the updated state and a human-readable message.
 */
export type EffectHandler = (
  state: GameState,
  effect: CardEffect,
  source: CardInstance
) => EffectResult;

// ─── Registry ───────────────────────────────────────────────────────

const handlers = new Map<string, EffectHandler>();

/**
 * Register a handler for an effect type.
 * Call this at module init time to add support for new effect types.
 */
export function registerEffect(type: EffectType | string, handler: EffectHandler): void {
  handlers.set(type, handler);
}

/**
 * Check if a handler exists for the given effect type.
 */
export function hasHandler(type: string): boolean {
  return handlers.has(type);
}

/**
 * Get all registered effect type names.
 */
export function getRegisteredEffectTypes(): string[] {
  return [...handlers.keys()];
}

// ─── Resolution ─────────────────────────────────────────────────────

/**
 * Resolve a single card effect through the registry.
 * Evaluates the effect's condition first; if it fails, returns early.
 */
export function resolveEffect(
  state: GameState,
  effect: CardEffect,
  sourceCard: CardInstance
): EffectResult {
  // Check condition if present
  if (effect.condition) {
    if (!evaluateCondition(state, effect.condition)) {
      return { state, message: `Condition not met for ${effect.description}` };
    }
  }

  const handler = handlers.get(effect.type);
  if (!handler) {
    return { state, message: `No handler registered for effect type: ${effect.type}` };
  }

  return handler(state, effect, sourceCard);
}

// ─── Timing Dispatcher ──────────────────────────────────────────────

/**
 * Context for narrowing which cards' effects should fire.
 */
export interface TimingContext {
  /** If set, only fire effects on this specific card instance */
  sourceInstanceId?: string;
  /** If set, only fire effects on cards in this sector */
  sectorIndex?: number;
}

/**
 * Emit a timing event, resolving all matching effects across the tableau.
 *
 * Scans all installed cards (structures, institutions, crew) across all sectors
 * for effects matching the given timing. Evaluates conditions and resolves
 * each effect through the handler registry.
 *
 * Use `context` to narrow scope:
 * - sourceInstanceId: only fire effects belonging to that specific card
 * - sectorIndex: only fire effects on cards in that sector
 */
export function emitTiming(
  state: GameState,
  timing: EffectTiming,
  context?: TimingContext
): { state: GameState; messages: string[] } {
  const messages: string[] = [];
  let current = state;

  // Gather all effect sources from tableau
  const effectSources = gatherEffectSources(current, timing, context);

  for (const { effect, source } of effectSources) {
    const result = resolveEffect(current, effect, source);
    current = result.state;
    if (result.message) {
      messages.push(result.message);
    }
  }

  return { state: current, messages };
}

/**
 * Gather all card effects matching a timing from the tableau.
 */
function gatherEffectSources(
  state: GameState,
  timing: EffectTiming,
  context?: TimingContext
): { effect: CardEffect; source: CardInstance }[] {
  const results: { effect: CardEffect; source: CardInstance }[] = [];

  const sectors = context?.sectorIndex !== undefined
    ? [state.ship.sectors[context.sectorIndex]].filter(Boolean)
    : state.ship.sectors;

  for (const sector of sectors) {
    // Check location card
    if (sector.location) {
      const loc = sector.location;
      if (!context?.sourceInstanceId || loc.instanceId === context.sourceInstanceId) {
        // Location passive effects are stored in location.passiveEffect, not in effects[]
        // But locations can also have regular effects
        for (const effect of loc.card.effects) {
          if (effect.timing === timing) {
            results.push({ effect, source: loc });
          }
        }
      }
    }

    // Check installed cards (structures, institutions, crew)
    for (const cardInst of sector.installedCards) {
      if (context?.sourceInstanceId && cardInst.instanceId !== context.sourceInstanceId) {
        continue;
      }

      // Skip unpowered cards for passive effects
      if (timing === "passive" && !cardInst.powered) {
        continue;
      }

      // Skip cards under construction
      if (cardInst.underConstruction) {
        continue;
      }

      for (const effect of cardInst.card.effects) {
        if (effect.timing === timing) {
          results.push({ effect, source: cardInst });
        }
      }
    }
  }

  return results;
}
