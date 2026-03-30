import { describe, it, expect, beforeAll } from "vitest";
import type { GameState, CardInstance, Card, CardEffect, FactionId } from "@icebox/shared";
import { ALL_FACTION_IDS, createDefaultRules } from "@icebox/shared";

// Import the effect system (registers all handlers + conditions)
import "../systems/effects/index";

import {
  resolveEffect,
  emitTiming,
  hasHandler,
  getRegisteredEffectTypes,
} from "../systems/effects/EffectRegistry";

import {
  evaluateCondition,
  hasEvaluator,
  getRegisteredConditionTypes,
} from "../systems/effects/ConditionRegistry";

// ─── Test Helpers ────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "test-001",
    name: "Test Card",
    type: "structure",
    faction: "neutral",
    tier: 1,
    art: "art/cards/test.png",
    cost: {},
    effects: [],
    factionIcons: [],
    tags: [],
    aging: { lifespan: null, decayConditions: [], onDeath: "destroy" },
    cryosleep: { inertiaContribution: {}, decayVulnerability: [], survivalPriority: 1, factionWeight: 0 },
    ...overrides,
  };
}

function makeInstance(card?: Card, overrides: Partial<CardInstance> = {}): CardInstance {
  const c = card || makeCard();
  return {
    card: c,
    instanceId: `inst-${Math.random().toString(36).slice(2, 8)}`,
    remainingLifespan: c.aging.lifespan,
    powered: true,
    zone: "tableau",
    ...overrides,
  };
}

function makeMinimalState(overrides: Partial<GameState> = {}): GameState {
  const emptyPresence = () => {
    const result = {} as Record<FactionId, number>;
    for (const fid of ALL_FACTION_IDS) result[fid] = 0;
    return result;
  };

  return {
    phase: "active-watch",
    totalSleepCycles: 0,
    resources: { matter: 5, energy: 5, data: 5, influence: 5 },
    vault: { cards: [] },
    worldDeck: { drawPile: [] },
    transitMarket: { upper: { id: "A", slots: [], direction: "left-to-right" }, lower: { id: "B", slots: [], direction: "right-to-left" } },
    mandateDeck: { drawPile: [], hand: [], discardPile: [] },
    legacyArchive: { cards: [], maxSlots: 5 },
    graveyard: { cards: [] },
    ship: {
      sectors: [
        { index: 0, location: null, installedCards: [], maxSlots: 4, factionPresence: emptyPresence(), dominantFaction: null },
        { index: 1, location: null, installedCards: [], maxSlots: 4, factionPresence: emptyPresence(), dominantFaction: null },
        { index: 2, location: null, installedCards: [], maxSlots: 4, factionPresence: emptyPresence(), dominantFaction: null },
      ] as [any, any, any],
    },
    globalFactionPresence: emptyPresence(),
    turnNumber: 1,
    rules: createDefaultRules(),
    chosenSleepDuration: 1,
    hullIntegrity: 100,
    yearsPassed: 0,
    dominanceHistory: emptyPresence(),
    globalLaw: null,
    era: "Zenith",
    eraModifiers: { marketSlideModifier: 0, maintenanceCostModifier: 1, constructionTimeModifier: 0 },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe("Effect Registry — Handler Registration", () => {
  const expectedTypes = [
    "gain-resource", "spend-resource", "draw-cards", "add-junk", "remove-junk",
    "remove-card", "modify-cost", "shift-faction", "lock-market-slot",
    "extend-lifespan", "gain-presence",
    "prevent-damage", "peek-deck", "apply-stress",
  ];

  it("should have handlers registered for all effect types", () => {
    const registered = getRegisteredEffectTypes();
    const missing = expectedTypes.filter((t) => !registered.includes(t));
    expect(missing).toEqual([]);
  });

  for (const type of expectedTypes) {
    it(`handler for "${type}" should exist`, () => {
      expect(hasHandler(type)).toBe(true);
    });
  }
});

describe("Condition Registry — Evaluator Registration", () => {
  const expectedConditions = [
    "resource-threshold", "sleep-count",
    "faction-dominance", "sector-control", "card-in-tableau",
  ];

  it("should have evaluators registered for all condition types", () => {
    const registered = getRegisteredConditionTypes();
    const missing = expectedConditions.filter((t) => !registered.includes(t));
    expect(missing).toEqual([]);
  });

  for (const type of expectedConditions) {
    it(`evaluator for "${type}" should exist`, () => {
      expect(hasEvaluator(type)).toBe(true);
    });
  }
});

describe("Effect Resolution — Smoke Tests", () => {
  it("gain-resource should increase resources (explicit format)", () => {
    const state = makeMinimalState({ resources: { matter: 0, energy: 0, data: 0, influence: 0 } });
    const effect: CardEffect = {
      id: "test-e1", timing: "on-play", description: "Gain 2 matter",
      type: "gain-resource", params: { resource: "matter", amount: 2 },
    };
    const source = makeInstance();
    const result = resolveEffect(state, effect, source);
    expect(result.state.resources.matter).toBe(2);
  });

  it("gain-resource should increase resources (shorthand format)", () => {
    const state = makeMinimalState({ resources: { matter: 0, energy: 0, data: 0, influence: 0 } });
    const effect: CardEffect = {
      id: "test-e2", timing: "on-play", description: "Gain 1 matter, 1 energy",
      type: "gain-resource", params: { matter: 1, energy: 1 },
    };
    const result = resolveEffect(state, effect, makeInstance());
    expect(result.state.resources.matter).toBe(1);
    expect(result.state.resources.energy).toBe(1);
  });

  it("spend-resource should decrease resources (explicit format)", () => {
    const state = makeMinimalState({ resources: { matter: 5, energy: 5, data: 5, influence: 5 } });
    const effect: CardEffect = {
      id: "test-e1", timing: "on-play", description: "Spend 2 energy",
      type: "spend-resource", params: { resource: "energy", amount: 2 },
    };
    const result = resolveEffect(state, effect, makeInstance());
    expect(result.state.resources.energy).toBe(3);
  });

  it("spend-resource should decrease resources (shorthand format)", () => {
    const state = makeMinimalState({ resources: { matter: 5, energy: 5, data: 5, influence: 5 } });
    const effect: CardEffect = {
      id: "test-e3", timing: "on-play", description: "Spend 1 data",
      type: "spend-resource", params: { data: 1 },
    };
    const result = resolveEffect(state, effect, makeInstance());
    expect(result.state.resources.data).toBe(4);
  });

  it("spend-resource depower variant should work with effect param", () => {
    const state = makeMinimalState();
    const card = makeCard({ cryosleep: { inertiaContribution: {}, decayVulnerability: [], survivalPriority: 1, factionWeight: 0 } });
    const inst = makeInstance(card, { powered: true });
    state.ship.sectors[0].installedCards.push(inst);
    const effect: CardEffect = {
      id: "test-e4", timing: "on-sleep", description: "Depower 1 structure",
      type: "spend-resource", params: { target: "random-structure", effect: "depower", count: 1 },
    };
    const result = resolveEffect(state, effect, makeInstance());
    expect(result.state.ship.sectors[0].installedCards[0].powered).toBe(false);
  });

  it("draw-cards should move cards from draw pile to hand", () => {
    const drawCard = makeInstance(makeCard({ id: "draw-test" }), { zone: "mandate-deck" });
    const state = makeMinimalState();
    state.mandateDeck.drawPile = [drawCard];
    const effect: CardEffect = {
      id: "test-e1", timing: "on-play", description: "Draw 1",
      type: "draw-cards", params: { count: 1 },
    };
    const result = resolveEffect(state, effect, makeInstance());
    expect(result.state.mandateDeck.hand.length).toBe(1);
    expect(result.state.mandateDeck.drawPile.length).toBe(0);
  });

  it("conditional effect should not fire when condition fails", () => {
    const state = makeMinimalState({ resources: { matter: 1, energy: 1, data: 1, influence: 1 } });
    const effect: CardEffect = {
      id: "test-e1", timing: "on-play", description: "Gain 5 matter if rich",
      type: "gain-resource", params: { resource: "matter", amount: 5 },
      condition: { type: "resource-threshold", params: { resource: "matter", threshold: 10, comparison: "gte" } },
    };
    const result = resolveEffect(state, effect, makeInstance());
    // Matter should be unchanged since condition fails
    expect(result.state.resources.matter).toBe(1);
  });
});

describe("Condition Evaluation — Smoke Tests", () => {
  it("resource-threshold should pass when resource >= threshold", () => {
    const state = makeMinimalState({ resources: { matter: 5, energy: 5, data: 5, influence: 5 } });
    const result = evaluateCondition(state, {
      type: "resource-threshold",
      params: { resource: "matter", threshold: 3 },
    });
    expect(result).toBe(true);
  });

  it("resource-threshold should fail when resource < threshold", () => {
    const state = makeMinimalState({ resources: { matter: 1, energy: 1, data: 1, influence: 1 } });
    const result = evaluateCondition(state, {
      type: "resource-threshold",
      params: { resource: "matter", threshold: 5 },
    });
    expect(result).toBe(false);
  });

  it("sleep-count should pass when totalSleepCycles >= threshold", () => {
    const state = makeMinimalState({ totalSleepCycles: 3 });
    expect(evaluateCondition(state, {
      type: "sleep-count",
      params: { threshold: 2 },
    })).toBe(true);
  });

  it("unknown condition type should pass (permissive)", () => {
    const state = makeMinimalState();
    expect(evaluateCondition(state, {
      type: "nonexistent-condition" as any,
      params: {},
    })).toBe(true);
  });
});

describe("Timing Dispatcher — emitTiming", () => {
  it("should resolve effects matching the timing", () => {
    const card = makeCard({
      effects: [{
        id: "timing-test-e1", timing: "on-sleep", description: "Gain 1 matter on sleep",
        type: "gain-resource", params: { resource: "matter", amount: 1 },
      }],
    });
    const instance = makeInstance(card);
    const state = makeMinimalState({ resources: { matter: 0, energy: 0, data: 0, influence: 0 } });
    state.ship.sectors[0].installedCards.push(instance);

    const result = emitTiming(state, "on-sleep");
    expect(result.state.resources.matter).toBe(1);
  });

  it("should not resolve effects with non-matching timing", () => {
    const card = makeCard({
      effects: [{
        id: "timing-test-e1", timing: "on-wake", description: "Gain 1 matter on wake",
        type: "gain-resource", params: { resource: "matter", amount: 1 },
      }],
    });
    const instance = makeInstance(card);
    const state = makeMinimalState({ resources: { matter: 0, energy: 0, data: 0, influence: 0 } });
    state.ship.sectors[0].installedCards.push(instance);

    const result = emitTiming(state, "on-sleep");
    expect(result.state.resources.matter).toBe(0);
  });

  it("should filter by sectorIndex when context is provided", () => {
    const card = makeCard({
      effects: [{
        id: "timing-test-e1", timing: "on-sleep", description: "Gain 1 data",
        type: "gain-resource", params: { resource: "data", amount: 1 },
      }],
    });
    const instance = makeInstance(card);
    const state = makeMinimalState({ resources: { matter: 0, energy: 0, data: 0, influence: 0 } });
    state.ship.sectors[1].installedCards.push(instance);

    // Emit for sector 0 only — should not fire
    const result = emitTiming(state, "on-sleep", { sectorIndex: 0 });
    expect(result.state.resources.data).toBe(0);

    // Emit for sector 1 — should fire
    const result2 = emitTiming(state, "on-sleep", { sectorIndex: 1 });
    expect(result2.state.resources.data).toBe(1);
  });

  it("should skip unpowered cards for passive timing", () => {
    const card = makeCard({
      effects: [{
        id: "timing-test-e1", timing: "passive", description: "Gain 1 energy passive",
        type: "gain-resource", params: { resource: "energy", amount: 1 },
      }],
    });
    const instance = makeInstance(card, { powered: false });
    const state = makeMinimalState({ resources: { matter: 0, energy: 0, data: 0, influence: 0 } });
    state.ship.sectors[0].installedCards.push(instance);

    const result = emitTiming(state, "passive");
    expect(result.state.resources.energy).toBe(0);
  });

  it("should skip cards under construction", () => {
    const card = makeCard({
      effects: [{
        id: "timing-test-e1", timing: "on-sleep", description: "Gain 1 matter",
        type: "gain-resource", params: { resource: "matter", amount: 1 },
      }],
    });
    const instance = makeInstance(card, { underConstruction: true });
    const state = makeMinimalState({ resources: { matter: 0, energy: 0, data: 0, influence: 0 } });
    state.ship.sectors[0].installedCards.push(instance);

    const result = emitTiming(state, "on-sleep");
    expect(result.state.resources.matter).toBe(0);
  });
});
