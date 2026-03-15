/**
 * Market Slide Simulation (Dual-Row)
 *
 * Standalone script that simulates the Transit Market conveyor
 * with hazard passives and fallout resolution on both rows.
 *
 * Run: npx tsx packages/game/src/sim/market-slide-sim.ts
 */

import type {
  Card,
  CardInstance,
  GameState,
  TransitMarketState,
  MarketRowState,
  ResourceTotals,
} from "@icebox/shared";
import {
  STARTING_RESOURCES,
  STARTING_ENTROPY,
  MAX_ENTROPY,
  STARTING_ERA,
  ERA_MODIFIERS,
  MARKET_SLOTS_PER_ROW,
  STARTING_HULL_INTEGRITY,
  ALL_FACTION_IDS,
  generateInstanceId,
  createEmptyRow,
  getMarketRow,
  resetMarketRowCounter,
  createDefaultRules,
} from "@icebox/shared";
import type { FactionId } from "@icebox/shared";

import { slideMarket } from "../systems/MarketManager";
import { resolveFallout } from "../systems/FalloutHandler";
import { getActiveMarketEffects, getExtraSlideCount } from "../systems/MarketEffectResolver";

// ── Load card definitions ───────────────────────────────────────────
import coreSet from "../../../shared/data/cards/core-set.json" assert { type: "json" };

const allCards: Card[] = coreSet.cards as Card[];

// ── Helpers ─────────────────────────────────────────────────────────

function makeInstance(card: Card, zone: CardInstance["zone"] = "transit-market"): CardInstance {
  return {
    card,
    instanceId: generateInstanceId(),
    remainingLifespan: card.aging.lifespan,
    powered: true,
    zone,
  };
}

function emptyFactionPresence(): Record<FactionId, number> {
  const result = {} as Record<FactionId, number>;
  for (const fid of ALL_FACTION_IDS) result[fid] = 0;
  return result;
}

function makeMinimalState(market: TransitMarketState, worldDeckCards: CardInstance[]): GameState {
  return {
    phase: "active-watch",
    totalSleepCycles: 0,
    resources: { ...STARTING_RESOURCES },
    entropy: STARTING_ENTROPY,
    maxEntropy: MAX_ENTROPY,
    vault: { cards: [] },
    worldDeck: { drawPile: worldDeckCards },
    transitMarket: market,
    mandateDeck: { drawPile: [], hand: [], discardPile: [] },
    legacyArchive: { cards: [] },
    graveyard: { cards: [] },
    ship: {
      sectors: [
        { index: 0, location: null, installedCards: [], maxSlots: 3, factionPresence: emptyFactionPresence(), dominantFaction: null },
        { index: 1, location: null, installedCards: [], maxSlots: 3, factionPresence: emptyFactionPresence(), dominantFaction: null },
        { index: 2, location: null, installedCards: [], maxSlots: 3, factionPresence: emptyFactionPresence(), dominantFaction: null },
      ],
    },
    globalFactionPresence: emptyFactionPresence(),
    turnNumber: 0,
    rules: createDefaultRules(),
    chosenSleepDuration: 1,
    hullIntegrity: STARTING_HULL_INTEGRITY,
    yearsPassed: 0,
    dominanceHistory: (() => {
      const h = {} as Record<FactionId, number>;
      for (const fid of ALL_FACTION_IDS) h[fid] = 0;
      return h;
    })(),
    globalLaw: null,
    era: STARTING_ERA,
    eraModifiers: { ...ERA_MODIFIERS[STARTING_ERA] },
    seed: 42,
  };
}

// ── Build a controlled dual-row market ──────────────────────────────

function findCard(id: string): Card {
  const card = allCards.find((c) => c.id === id);
  if (!card) throw new Error(`Card not found: ${id}`);
  return card;
}

resetMarketRowCounter();

// Upper row: hardware, repairs, environmental hazards
const upperLayout: string[] = [
  "nu-001",    // Slot 0: Emergency Rations (will fall out first)
  "hz-001",    // Slot 1: Power Surge (hazard)
  "vf-002",    // Slot 2: Overclock Protocol
  "hz-007",    // Slot 3: Structural Fatigue (hazard)
  "sw-002",    // Slot 4: Community Gathering
  "ev-005",    // Slot 5: Harvest Festival (event)
];

// Lower row: policies, factions, cultural events
const lowerLayout: string[] = [
  "ev-001",    // Slot 0: Resource Audit (event - will fall out first)
  "hz-005",    // Slot 1: Factional Agitator (hazard)
  "ev-003",    // Slot 2: Wildcat Strike (event)
  "hz-003",    // Slot 3: Data Corruption Wave (hazard)
  "ac-002",    // Slot 4: Diagnostic Sweep
  "gl-002",    // Slot 5: Inventory Audit
];

function buildRow(layout: string[]): MarketRowState {
  const slots: (CardInstance | null)[] = layout.map((id) => makeInstance(findCard(id)));
  while (slots.length < MARKET_SLOTS_PER_ROW) slots.push(null);
  return {
    slots,
    investments: new Array(MARKET_SLOTS_PER_ROW).fill(null),
  };
}

const market: TransitMarketState = {
  upperRow: buildRow(upperLayout),
  lowerRow: buildRow(lowerLayout),
  maxSlotsPerRow: MARKET_SLOTS_PER_ROW,
};

// World deck for refills
const worldDeckIds = ["nu-002", "nu-003", "nu-004", "fx-001", "ec-002", "gl-001",
  "hz-002", "ev-002", "hz-008", "ev-004", "hz-006", "ev-006"];
const worldDeckCards = worldDeckIds.map((id) => makeInstance(findCard(id), "world-deck"));

let state = makeMinimalState(market, worldDeckCards);

// ── Logging helpers ─────────────────────────────────────────────────

function logResources(resources: ResourceTotals): void {
  console.log(
    `  Resources: M:${resources.matter} E:${resources.energy} D:${resources.data} I:${resources.influence}`
  );
}

function logRow(label: string, row: MarketRowState): void {
  console.log(`  ${label}:`);
  for (let i = 0; i < row.slots.length; i++) {
    const slot = row.slots[i];
    const inv = row.investments[i];
    if (slot) {
      const typeTag = slot.card.type === "hazard" ? " [HAZARD]" :
                      slot.card.type === "event" ? " [EVENT]" : "";
      const invTag = inv ? ` [INV: M:${inv.matter ?? 0} E:${inv.energy ?? 0} D:${inv.data ?? 0} I:${inv.influence ?? 0}]` : "";
      console.log(`    Slot ${i}: ${slot.card.name} (${slot.card.faction})${typeTag}${invTag}`);
    } else {
      console.log(`    Slot ${i}: [empty]`);
    }
  }
}

function logMarketState(market: TransitMarketState): void {
  logRow("Upper Row", market.upperRow);
  logRow("Lower Row", market.lowerRow);
}

function logMarketPassives(market: TransitMarketState): void {
  const actives = getActiveMarketEffects(market);
  if (actives.length > 0) {
    console.log("  Active Hazard Passives:");
    for (const { card, effect } of actives) {
      console.log(`    >> ${card.card.name}: ${effect.description}`);
    }
    const extraSlides = getExtraSlideCount(market);
    if (extraSlides > 0) {
      console.log(`    >> Extra slides per turn: +${extraSlides}`);
    }
  }
}

function handleFallout(current: GameState, card: CardInstance | null, rowLabel: string): GameState {
  if (!card) return current;
  console.log(`  [${rowLabel} FALLOUT]`);
  const result = resolveFallout(current, card);
  for (const msg of result.messages) {
    console.log(`    -> ${msg}`);
  }
  if (result.destroyed) {
    console.log(`    ${card.card.name} is destroyed.`);
  } else {
    console.log(`    ${card.card.name} enters discard pile.`);
  }
  return result.state;
}

// ── Run simulation ──────────────────────────────────────────────────

const TURNS = 14;

console.log("=".repeat(70));
console.log("ICEBOX — Dual-Row Market Slide Simulation");
console.log("=".repeat(70));
console.log(`Running ${TURNS} turns with ${MARKET_SLOTS_PER_ROW} slots per row (2 rows)`);
console.log();

logResources(state.resources);
console.log();

for (let turn = 1; turn <= TURNS; turn++) {
  console.log("-".repeat(70));
  console.log(`TURN ${turn}`);
  console.log("-".repeat(70));

  // Show current market
  logMarketState(state.transitMarket);
  console.log();

  // Show active hazard passives
  logMarketPassives(state.transitMarket);
  console.log();

  // Slide both rows
  const slideResult = slideMarket(state.transitMarket, state.worldDeck);
  state = {
    ...state,
    transitMarket: slideResult.market,
    worldDeck: slideResult.worldDeck,
  };

  // Handle fallout from both rows
  state = handleFallout(state, slideResult.upperFallout.card, "UPPER");
  state = handleFallout(state, slideResult.lowerFallout.card, "LOWER");

  // Handle claimed investments
  for (const claim of slideResult.claimedInvestments) {
    const total = (claim.resources.matter ?? 0) + (claim.resources.energy ?? 0) +
                 (claim.resources.data ?? 0) + (claim.resources.influence ?? 0);
    console.log(`  [INVESTMENT CLAIMED] ${claim.faction} gains ${total} presence.`);
    if (state.globalFactionPresence[claim.faction] !== undefined) {
      state.globalFactionPresence[claim.faction] += total;
    }
  }

  console.log();
  logResources(state.resources);

  // Check for extra slides from hazards
  const extraSlides = getExtraSlideCount(state.transitMarket);
  if (extraSlides > 0) {
    console.log(`  [EXTRA SLIDE] Hazard effect triggers ${extraSlides} additional slide(s)`);
    for (let i = 0; i < extraSlides; i++) {
      const extraResult = slideMarket(state.transitMarket, state.worldDeck);
      state = {
        ...state,
        transitMarket: extraResult.market,
        worldDeck: extraResult.worldDeck,
      };
      state = handleFallout(state, extraResult.upperFallout.card, "UPPER EXTRA");
      state = handleFallout(state, extraResult.lowerFallout.card, "LOWER EXTRA");
    }
    logResources(state.resources);
  }

  console.log();
}

console.log("=".repeat(70));
console.log("SIMULATION COMPLETE");
console.log("=".repeat(70));
logResources(state.resources);
console.log(`Hull Integrity: ${state.hullIntegrity}`);
console.log(`Graveyard: ${state.graveyard.cards.map((c) => c.card.name).join(", ") || "(empty)"}`);
console.log(`Discard: ${state.mandateDeck.discardPile.map((c) => c.card.name).join(", ") || "(empty)"}`);
