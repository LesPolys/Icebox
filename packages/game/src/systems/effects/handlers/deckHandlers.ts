import type { GameState, CardEffect, CardInstance, Card } from "@icebox/shared";
import { generateInstanceId } from "@icebox/shared";
import { drawCards } from "../../DeckManager";
import { registerEffect, type EffectResult } from "../EffectRegistry";

registerEffect("draw-cards", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const count = effect.params.count as number;
  const result = drawCards(s.mandateDeck, count);
  s.mandateDeck = result.deck;
  return { state: s, message: `Drew ${result.drawnCards.length} card(s).` };
});

/**
 * add-junk: Create junk card instance(s) and add to mandate deck discard pile.
 *
 * Params:
 * - junkId?: string — specific junk card ID to add
 * - junkSource?: string — pick a random junk of this source type
 * - count?: number — how many to add (default 1)
 *
 * Requires allCardDefs to be set via setCardDefinitions().
 */
let allCardDefs: Card[] = [];

export function setCardDefinitions(cards: Card[]): void {
  allCardDefs = cards;
}

registerEffect("add-junk", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const count = (effect.params.count as number) ?? 1;
  const junkId = effect.params.junkId as string | undefined;
  const junkSource = effect.params.junkSource as string | undefined;
  let added = 0;

  for (let i = 0; i < count; i++) {
    let junkDef: Card | undefined;

    if (junkId) {
      junkDef = allCardDefs.find((c) => c.id === junkId);
    } else if (junkSource) {
      // Pick a random junk of this source type
      const candidates = allCardDefs.filter(
        (c) => c.type === "junk" && c.junk?.source === junkSource
      );
      if (candidates.length > 0) {
        junkDef = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    if (junkDef) {
      const inst: CardInstance = {
        card: junkDef,
        instanceId: generateInstanceId(),
        remainingLifespan: junkDef.aging.lifespan,
        powered: true,
        zone: "discard",
      };
      s.mandateDeck.discardPile.push(inst);
      added++;
    }
  }

  return {
    state: s,
    message: added > 0
      ? `Added ${added} junk card(s) to mandate deck.`
      : `No matching junk card found.`,
  };
});

registerEffect("remove-junk", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const count = (effect.params.count as number) ?? 1;
  let removed = 0;

  for (let i = 0; i < count; i++) {
    // Try hand first
    const handIdx = s.mandateDeck.hand.findIndex((c) => c.card.type === "junk");
    if (handIdx >= 0) {
      s.mandateDeck.hand.splice(handIdx, 1);
      removed++;
      continue;
    }
    // Try discard
    const discardIdx = s.mandateDeck.discardPile.findIndex((c) => c.card.type === "junk");
    if (discardIdx >= 0) {
      s.mandateDeck.discardPile.splice(discardIdx, 1);
      removed++;
      continue;
    }
  }

  return { state: s, message: `Removed ${removed} junk card(s).` };
});

registerEffect("remove-card", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const targetId = effect.params.targetInstanceId as string | undefined;
  const filter = effect.params.filter as string | undefined;

  if (targetId) {
    // Remove specific card by instance ID — search all zones
    for (const sector of s.ship.sectors) {
      const idx = sector.installedCards.findIndex((c) => c.instanceId === targetId);
      if (idx >= 0) {
        const removed = sector.installedCards.splice(idx, 1)[0];
        removed.zone = "graveyard";
        s.graveyard.cards.push(removed);
        return { state: s, message: `Removed ${removed.card.name} from tableau.` };
      }
    }
    // Check mandate deck zones
    for (const zone of ["hand", "drawPile", "discardPile"] as const) {
      const arr = zone === "hand" ? s.mandateDeck.hand
        : zone === "drawPile" ? s.mandateDeck.drawPile
        : s.mandateDeck.discardPile;
      const idx = arr.findIndex((c) => c.instanceId === targetId);
      if (idx >= 0) {
        const removed = arr.splice(idx, 1)[0];
        removed.zone = "graveyard";
        s.graveyard.cards.push(removed);
        return { state: s, message: `Removed ${removed.card.name}.` };
      }
    }
    return { state: s, message: `Target card not found.` };
  }

  if (filter === "lowest-priority") {
    // Remove lowest survival priority card from tableau
    let lowest: { card: CardInstance; sectorIdx: number; cardIdx: number } | null = null;
    for (let si = 0; si < s.ship.sectors.length; si++) {
      const sector = s.ship.sectors[si];
      for (let ci = 0; ci < sector.installedCards.length; ci++) {
        const c = sector.installedCards[ci];
        if (c.underConstruction) continue;
        if (!lowest || c.card.cryosleep.survivalPriority < lowest.card.card.cryosleep.survivalPriority) {
          lowest = { card: c, sectorIdx: si, cardIdx: ci };
        }
      }
    }
    if (lowest) {
      s.ship.sectors[lowest.sectorIdx].installedCards.splice(lowest.cardIdx, 1);
      lowest.card.zone = "graveyard";
      s.graveyard.cards.push(lowest.card);
      return { state: s, message: `Removed ${lowest.card.card.name} (lowest priority).` };
    }
  }

  return { state: s, message: `Card removal: ${effect.description}` };
});
