import type { GameState, CardEffect, CardInstance, FactionId } from "@icebox/shared";
import { registerEffect, type EffectResult } from "../EffectRegistry";
import { slideMarketMultiple } from "../../MarketManager";

/**
 * modify-cost: Passive cost modifier.
 * Not resolved actively — scanned by PassiveScanner.
 * Registered here so the registry knows about it (no-op handler).
 */
registerEffect("modify-cost", (state: GameState, effect: CardEffect): EffectResult => {
  return { state, message: `Cost modifier active: ${effect.description}` };
});

/**
 * lock-market-slot: Passive market lock.
 * Not resolved actively — checked by PassiveScanner.isSlotLocked().
 */
registerEffect("lock-market-slot", (state: GameState, effect: CardEffect): EffectResult => {
  return { state, message: `Market lock active: ${effect.description}` };
});

/**
 * peek-deck: Passive deck visibility.
 * Not resolved actively — checked by UI layer via PassiveScanner.getPeekCount().
 */
registerEffect("peek-deck", (state: GameState, effect: CardEffect): EffectResult => {
  return { state, message: `Deck peek active: ${effect.description}` };
});

/**
 * shift-faction: Market slides, vault additions, or dominance changes.
 */
registerEffect("shift-faction", (state: GameState, effect: CardEffect): EffectResult => {
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
    const sectorIdx = (effect.params.sectorIndex as number) ?? 0;
    const sector = s.ship.sectors[sectorIdx];
    if (sector) {
      sector.dominantFaction = targetFaction;
      return { state: s, message: `Sector ${sectorIdx} dominance changed to ${targetFaction}.` };
    }
  }

  return { state, message: `Faction shift: ${effect.description}` };
});
