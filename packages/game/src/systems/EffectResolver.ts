import type { GameState, CardEffect, CardInstance } from "@icebox/shared";
import { gainResources, spendResources } from "@icebox/shared";
import { drawCards } from "./DeckManager";

/**
 * Resolves card effects. Currently handles the 5 core effect types
 * needed for Milestone 1. More effects will be added as the game grows.
 */

export interface EffectResult {
  state: GameState;
  message: string;
}

/**
 * Resolve a single card effect.
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

  switch (effect.type) {
    case "gain-resource":
      return resolveGainResource(state, effect);
    case "spend-resource":
      return resolveSpendResource(state, effect);
    case "draw-cards":
      return resolveDrawCards(state, effect);
    case "add-junk":
      return resolveAddJunk(state, effect);
    case "remove-junk":
      return resolveRemoveJunk(state, effect);
    case "modify-cost":
      // Modify-cost is passive — tracked separately by TurnManager
      return { state, message: `Cost modifier active: ${effect.description}` };
    case "remove-card":
      return resolveRemoveCard(state, effect);
    default:
      return { state, message: `Unknown effect type: ${effect.type}` };
  }
}

function resolveGainResource(state: GameState, effect: CardEffect): EffectResult {
  const s = structuredClone(state);
  const resource = effect.params.resource as string;
  const amount = effect.params.amount as number;

  s.resources = gainResources(s.resources, { [resource]: amount });

  return { state: s, message: `Gained ${amount} ${resource}.` };
}

function resolveSpendResource(state: GameState, effect: CardEffect): EffectResult {
  const s = structuredClone(state);
  const resource = effect.params.resource as string;
  const amount = effect.params.amount as number;

  s.resources = spendResources(s.resources, { [resource]: amount });
  // Clamp to 0
  const key = resource as keyof typeof s.resources;
  if (s.resources[key] < 0) s.resources[key] = 0;

  // Optional: gain another resource
  if (effect.params.gainResource) {
    s.resources = gainResources(s.resources, {
      [effect.params.gainResource as string]: effect.params.gainAmount as number,
    });
  }

  return { state: s, message: `Spent ${amount} ${resource}.` };
}

function resolveDrawCards(state: GameState, effect: CardEffect): EffectResult {
  const s = structuredClone(state);
  const count = effect.params.count as number;
  const result = drawCards(s.mandateDeck, count);
  s.mandateDeck = result.deck;

  return { state: s, message: `Drew ${result.drawnCards.length} card(s).` };
}

function resolveAddJunk(state: GameState, effect: CardEffect): EffectResult {
  // Junk addition is handled by CryosleepEngine for inertia checks
  // For on-play effects, we'd need to import card definitions
  // For now, return a message
  return {
    state,
    message: `Junk added: ${effect.params.junkSource} x${effect.params.count}`,
  };
}

function resolveRemoveJunk(state: GameState, effect: CardEffect): EffectResult {
  const s = structuredClone(state);
  const count = effect.params.count as number;
  let removed = 0;

  // Remove junk from hand first, then discard
  for (let i = 0; i < count; i++) {
    // Try hand
    const handJunkIdx = s.mandateDeck.hand.findIndex((c) => c.card.type === "junk");
    if (handJunkIdx >= 0) {
      s.mandateDeck.hand.splice(handJunkIdx, 1);
      removed++;
      continue;
    }

    // Try discard
    const discardJunkIdx = s.mandateDeck.discardPile.findIndex((c) => c.card.type === "junk");
    if (discardJunkIdx >= 0) {
      s.mandateDeck.discardPile.splice(discardJunkIdx, 1);
      removed++;
      continue;
    }
  }

  return { state: s, message: `Removed ${removed} junk card(s).` };
}

function resolveRemoveCard(state: GameState, effect: CardEffect): EffectResult {
  // Placeholder for targeted card removal
  return { state, message: `Card removal: ${effect.description}` };
}

function evaluateCondition(
  state: GameState,
  condition: { type: string; params: Record<string, unknown> }
): boolean {
  switch (condition.type) {
    case "resource-threshold": {
      const resource = condition.params.resource as keyof typeof state.resources;
      const threshold = condition.params.threshold as number;
      const comparison = (condition.params.comparison as string) ?? "gte";
      const value = state.resources[resource];
      return comparison === "gte" ? value >= threshold : value < threshold;
    }
    case "sleep-count": {
      const threshold = condition.params.threshold as number;
      return state.totalSleepCycles >= threshold;
    }
    default:
      return true; // Unknown conditions pass by default
  }
}
