import type { GameState, CardInstance } from "@icebox/shared";
import { resolveEffect } from "./EffectResolver";
import { applyStressToSector } from "./CrewManager";

/**
 * Handles fallout resolution when a card slides off the market (exits Slot 0).
 * - Hazards: trigger catastrophe (on-fallout), card is destroyed
 * - Events: trigger natural outcome (on-fallout), card is destroyed
 * - Manifest cards: neutral fallout, card goes to discard
 */

export interface FalloutResult {
  state: GameState;
  messages: string[];
  /** Whether the card was destroyed (hazards/events) vs added to discard (manifest) */
  destroyed: boolean;
  /** Whether this fallout triggered a reactive cryosleep (crisis card) */
  triggersReactiveSleep: boolean;
}

/**
 * Resolve all fallout effects for a card that has exited the market.
 */
export function resolveFallout(
  state: GameState,
  falloutCard: CardInstance
): FalloutResult {
  const messages: string[] = [];
  let current = state;
  let triggersReactiveSleep = false;
  const cardType = falloutCard.card.type;

  // Check if this is a crisis card — triggers reactive cryosleep
  if (falloutCard.card.crisis?.isCrisis) {
    triggersReactiveSleep = true;
    const penalty = falloutCard.card.crisis.reactiveEntropyPenalty ?? 0;
    if (penalty > 0) {
      const s = structuredClone(current);
      s.entropy = Math.min(s.maxEntropy, s.entropy + penalty);
      current = s;
      messages.push(
        `[CRISIS] ${falloutCard.card.name} triggers reactive cryosleep! Entropy +${penalty} (now ${current.entropy}).`
      );
    } else {
      messages.push(
        `[CRISIS] ${falloutCard.card.name} triggers reactive cryosleep!`
      );
    }
  }

  // Get on-fallout effects
  const falloutEffects = falloutCard.card.effects.filter(
    (e) => e.timing === "on-fallout"
  );

  // Resolve each fallout effect
  for (const effect of falloutEffects) {
    messages.push(`[FALLOUT] ${falloutCard.card.name}: ${effect.description}`);
    const result = resolveEffect(current, effect, falloutCard);
    current = result.state;
    messages.push(`  -> ${result.message}`);
  }

  // Apply stress to crew when hazards fall out
  if (cardType === "hazard") {
    // Apply 1 stress to all crew in all sectors (hazard fallout is ship-wide)
    for (let sectorIdx = 0; sectorIdx < current.ship.sectors.length; sectorIdx++) {
      const stressResult = applyStressToSector(current, sectorIdx, 1);
      current = stressResult.state;
      if (stressResult.affectedCrew > 0) {
        messages.push(
          `  Hazard stress: ${stressResult.affectedCrew} crew affected in sector ${sectorIdx}.`
        );
      }
    }
  }

  // Determine card fate based on type
  const isDestroyable = cardType === "hazard" || cardType === "event";

  if (isDestroyable) {
    // Hazards and events are destroyed on fallout (or returned to vault based on hazard data)
    const s = structuredClone(current);
    const hazardData = falloutCard.card.hazard;

    if (hazardData?.onBuy === "return-to-vault") {
      // Return to vault
      falloutCard.zone = "vault";
      s.vault.cards.push(falloutCard);
      messages.push(`  ${falloutCard.card.name} returned to the Vault.`);
    } else {
      // Destroy
      falloutCard.zone = "graveyard";
      s.graveyard.cards.push(falloutCard);
      messages.push(`  ${falloutCard.card.name} destroyed.`);
    }
    current = s;
  } else {
    // Manifest cards go to discard
    const s = structuredClone(current);
    falloutCard.zone = "discard";
    s.mandateDeck.discardPile.push(falloutCard);
    if (falloutEffects.length === 0) {
      messages.push(
        `[FALLOUT] ${falloutCard.card.name} slides off the market.`
      );
    }
    current = s;
  }

  return {
    state: current,
    messages,
    destroyed: isDestroyable,
    triggersReactiveSleep,
  };
}
