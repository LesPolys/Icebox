import type { CardInstance, MandateDeckState } from "@icebox/shared";
import { shuffle } from "@icebox/shared";

/**
 * Pure logic for deck operations: draw, shuffle, discard.
 * All functions return new state objects (immutable pattern).
 */

export interface DrawResult {
  drawnCards: CardInstance[];
  deck: MandateDeckState;
  reshuffled: boolean;
}

/**
 * Draw N cards from the mandate deck. If draw pile is empty,
 * shuffle discard into draw pile first.
 */
export function drawCards(deck: MandateDeckState, count: number): DrawResult {
  let drawPile = [...deck.drawPile];
  let discardPile = [...deck.discardPile];
  const hand = [...deck.hand];
  const drawn: CardInstance[] = [];
  let reshuffled = false;

  for (let i = 0; i < count; i++) {
    // If draw pile is empty, shuffle discard into it
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break; // No cards left anywhere
      drawPile = shuffle(discardPile);
      drawPile.forEach((c) => (c.zone = "mandate-deck"));
      discardPile = [];
      reshuffled = true;
    }

    const card = drawPile.shift()!;
    card.zone = "hand";
    hand.push(card);
    drawn.push(card);
  }

  return {
    drawnCards: drawn,
    deck: { drawPile, hand, discardPile },
    reshuffled,
  };
}

/**
 * Discard a card from hand to discard pile.
 */
export function discardFromHand(
  deck: MandateDeckState,
  instanceId: string
): MandateDeckState {
  const hand = [...deck.hand];
  const discardPile = [...deck.discardPile];
  const idx = hand.findIndex((c) => c.instanceId === instanceId);

  if (idx === -1) return deck;

  const [card] = hand.splice(idx, 1);
  card.zone = "discard";
  discardPile.push(card);

  return { ...deck, hand, discardPile };
}

/**
 * Discard entire hand to discard pile.
 */
export function discardHand(deck: MandateDeckState): MandateDeckState {
  const discardPile = [...deck.discardPile];
  for (const card of deck.hand) {
    card.zone = "discard";
    discardPile.push(card);
  }
  return { ...deck, hand: [], discardPile };
}

/**
 * Add a card to the discard pile (e.g., from market purchase).
 */
export function addToDiscard(
  deck: MandateDeckState,
  card: CardInstance
): MandateDeckState {
  card.zone = "discard";
  return { ...deck, discardPile: [...deck.discardPile, card] };
}

/**
 * Add a card to the bottom of the draw pile (e.g., bought from market).
 */
export function addToBottomOfDeck(
  deck: MandateDeckState,
  card: CardInstance
): MandateDeckState {
  card.zone = "mandate-deck";
  return { ...deck, drawPile: [...deck.drawPile, card] };
}

/**
 * Add a card directly to the draw pile (e.g., junk injection).
 */
export function addToDrawPile(
  deck: MandateDeckState,
  card: CardInstance
): MandateDeckState {
  card.zone = "mandate-deck";
  return { ...deck, drawPile: [...deck.drawPile, card] };
}

/**
 * Remove a card from wherever it is in the mandate deck system.
 */
export function removeCard(
  deck: MandateDeckState,
  instanceId: string
): { removed: CardInstance | null; deck: MandateDeckState } {
  // Check hand
  let idx = deck.hand.findIndex((c) => c.instanceId === instanceId);
  if (idx !== -1) {
    const hand = [...deck.hand];
    const [removed] = hand.splice(idx, 1);
    return { removed, deck: { ...deck, hand } };
  }

  // Check discard
  idx = deck.discardPile.findIndex((c) => c.instanceId === instanceId);
  if (idx !== -1) {
    const discardPile = [...deck.discardPile];
    const [removed] = discardPile.splice(idx, 1);
    return { removed, deck: { ...deck, discardPile } };
  }

  // Check draw pile
  idx = deck.drawPile.findIndex((c) => c.instanceId === instanceId);
  if (idx !== -1) {
    const drawPile = [...deck.drawPile];
    const [removed] = drawPile.splice(idx, 1);
    return { removed, deck: { ...deck, drawPile } };
  }

  return { removed: null, deck };
}

/**
 * Shuffle all cards (hand + discard + draw) into a fresh draw pile.
 * Used when rebuilding mandate deck after sleep.
 */
export function reshuffleFull(deck: MandateDeckState): MandateDeckState {
  const allCards = [...deck.drawPile, ...deck.hand, ...deck.discardPile];
  allCards.forEach((c) => (c.zone = "mandate-deck"));
  return {
    drawPile: shuffle(allCards),
    hand: [],
    discardPile: [],
  };
}

/**
 * Get total card count across all zones.
 */
export function totalCards(deck: MandateDeckState): number {
  return deck.drawPile.length + deck.hand.length + deck.discardPile.length;
}
