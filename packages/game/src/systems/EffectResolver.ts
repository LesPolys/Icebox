import type { GameState, CardEffect, CardInstance, FactionId } from "@icebox/shared";
import { gainResources, spendResources, ALL_FACTION_IDS } from "@icebox/shared";
import { drawCards } from "./DeckManager";
import { slideMarketMultiple } from "./MarketManager";

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
    case "extend-lifespan":
      return resolveExtendLifespan(state, effect);
    case "shift-faction":
      return resolveShiftFaction(state, effect);
    case "lock-market-slot":
      // Passive — tracked by MarketEffectResolver
      return { state, message: `Lock/disable active: ${effect.description}` };
    case "modify-threshold":
      // Passive — tracked by AgingManager
      return { state, message: `Threshold modifier active: ${effect.description}` };
    case "gain-presence":
      return resolveGainPresence(state, effect);
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

  // Handle depower-structures variant
  if (effect.params.depower) {
    const count = effect.params.depower as number;
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

function resolveExtendLifespan(state: GameState, effect: CardEffect): EffectResult {
  const s = structuredClone(state);
  const amount = (effect.params.amount as number) ?? 0;
  const scope = effect.params.scope as string | undefined;
  const tierFilter = effect.params.tierFilter as number | undefined;
  let affected = 0;

  if (scope === "tableau") {
    for (const sector of s.ship.sectors) {
      for (const card of sector.installedCards) {
        if (tierFilter !== undefined && card.card.tier !== tierFilter) continue;
        if (card.remainingLifespan !== null) {
          card.remainingLifespan = Math.max(0, card.remainingLifespan + amount);
          affected++;
        }
      }
    }
  } else if (scope === "sector") {
    // Applied by passive system, not directly resolved
    return { state, message: `Lifespan modifier active: ${effect.description}` };
  } else {
    // Target specific count (interactive — for now extend first N found)
    const count = (effect.params.count as number) ?? 1;
    for (const sector of s.ship.sectors) {
      for (const card of sector.installedCards) {
        if (affected >= count) break;
        if (card.remainingLifespan !== null) {
          card.remainingLifespan = Math.max(0, card.remainingLifespan + amount);
          affected++;
        }
      }
      if (affected >= count) break;
    }
  }

  return {
    state: s,
    message: `${amount >= 0 ? "Extended" : "Reduced"} lifespan of ${affected} card(s) by ${Math.abs(amount)}.`,
  };
}

function resolveShiftFaction(state: GameState, effect: CardEffect): EffectResult {
  const s = structuredClone(state);

  // Market slide effect
  if (effect.params.marketSlide) {
    const count = effect.params.marketSlide as number;
    const result = slideMarketMultiple(s.transitMarket, s.worldDeck, count);
    s.transitMarket = result.market;
    s.worldDeck = result.worldDeck;
    return {
      state: s,
      message: `Market slid ${count} extra slot(s). ${result.allFallout.length} card(s) fell out.`,
    };
  }

  // Add cards from vault to world deck
  if (effect.params.addFromVault) {
    const faction = effect.params.faction as string;
    const count = effect.params.addFromVault as number;
    let added = 0;
    for (let i = 0; i < count; i++) {
      const idx = s.vault.cards.findIndex((c) => c.card.faction === faction);
      if (idx >= 0) {
        const card = s.vault.cards.splice(idx, 1)[0];
        card.zone = "world-deck";
        s.worldDeck.drawPile.push(card);
        added++;
      }
    }
    return { state: s, message: `Added ${added} ${faction} card(s) from vault to world deck.` };
  }

  // Change sector dominance
  if (effect.params.targetFaction && effect.params.scope === "sector") {
    const targetFaction = effect.params.targetFaction as FactionId;
    // Default to sector 0 if not specified (interactive choice in real game)
    const sectorIdx = (effect.params.sectorIndex as number) ?? 0;
    const sector = s.ship.sectors[sectorIdx];
    if (sector) {
      sector.dominantFaction = targetFaction;
      return { state: s, message: `Sector ${sectorIdx} dominance changed to ${targetFaction}.` };
    }
  }

  return { state, message: `Faction shift: ${effect.description}` };
}

function resolveGainPresence(state: GameState, effect: CardEffect): EffectResult {
  const s = structuredClone(state);
  const amount = (effect.params.amount as number) ?? 0;
  const target = effect.params.target as string;
  const scope = effect.params.scope as string;

  if (target === "dominant" && scope === "all-sectors") {
    for (const sector of s.ship.sectors) {
      if (sector.dominantFaction) {
        sector.factionPresence[sector.dominantFaction] = Math.max(
          0,
          sector.factionPresence[sector.dominantFaction] + amount
        );
      }
    }
    return {
      state: s,
      message: `Dominant faction presence ${amount >= 0 ? "+" : ""}${amount} in all sectors.`,
    };
  }

  // Direct faction presence change
  if (effect.params.faction) {
    const faction = effect.params.faction as FactionId;
    if (s.globalFactionPresence[faction] !== undefined) {
      s.globalFactionPresence[faction] = Math.max(0, s.globalFactionPresence[faction] + amount);
    }
    return { state: s, message: `${faction} global presence ${amount >= 0 ? "+" : ""}${amount}.` };
  }

  return { state, message: `Presence change: ${effect.description}` };
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
