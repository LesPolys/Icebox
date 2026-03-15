import type {
  GameState,
  Card,
  CardInstance,
  FactionId,
  SectorState,
} from "@icebox/shared";
import {
  STARTING_RESOURCES,
  STARTING_ENTROPY,
  MAX_ENTROPY,
  STARTING_ERA,
  ERA_MODIFIERS,
  MARKET_SLOTS_PER_ROW,
  STARTING_HULL_INTEGRITY,
  DEFAULT_STRUCTURE_SLOTS,
  ALL_FACTION_IDS,
  shuffle,
  generateInstanceId,
  getMarketRow,
  resetMarketRowCounter,
  createEmptyRow,
  createDefaultRules,
} from "@icebox/shared";

/**
 * Creates a CardInstance from a Card definition.
 */
export function createCardInstance(card: Card): CardInstance {
  const instance: CardInstance = {
    card,
    instanceId: generateInstanceId(),
    remainingLifespan: card.aging.lifespan,
    powered: true,
    zone: "vault",
  };

  // Initialize crew-specific state
  if (card.type === "crew" && card.crew) {
    instance.currentStress = card.crew.maxStress;
  }

  return instance;
}

/**
 * Create a fresh starting game state from card definitions.
 */
export function createNewGameState(allCards: Card[]): GameState {
  resetMarketRowCounter();

  const locationCards = allCards.filter((c) => c.type === "location");
  const starterIds = new Set(["vf-001", "sw-001", "ac-001"]);
  // Mandate deck gets actions, structures, institutions, and crew.
  // Hazards, events, and junk are world-deck-only (market effects).
  const mandateTypes = new Set(["action", "structure", "institution", "crew"]);
  const mandateEligible = allCards.filter(
    (c) => mandateTypes.has(c.type) && !starterIds.has(c.id)
  );

  // World deck gets everything except locations and starters
  const worldEligible = allCards.filter(
    (c) => c.type !== "location" && !starterIds.has(c.id) && !mandateTypes.has(c.type)
  );

  const mandateInstances = mandateEligible.map((c) => {
    const inst = createCardInstance(c);
    inst.zone = "mandate-deck";
    return inst;
  });

  const worldInstances = worldEligible.map((c) => {
    const inst = createCardInstance(c);
    inst.zone = "world-deck";
    return inst;
  });

  // Also add surplus mandate-eligible cards to the world deck
  const rules = createDefaultRules();
  const shuffledMandate = shuffle(mandateInstances);
  const mandateCards = shuffledMandate.slice(0, rules.startingDeckSize);
  const surplusMandate = shuffledMandate.slice(rules.startingDeckSize);
  surplusMandate.forEach((c) => (c.zone = "world-deck"));

  const worldDeckCards = [...worldInstances, ...surplusMandate];

  const sectorLocations = locationCards.slice(0, 3);

  const emptyFactionPresence = (): Record<FactionId, number> => {
    const result = {} as Record<FactionId, number>;
    for (const fid of ALL_FACTION_IDS) result[fid] = 0;
    return result;
  };

  const makeSector = (i: number): SectorState => ({
    index: i,
    location: sectorLocations[i]
      ? { ...createCardInstance(sectorLocations[i]), zone: "tableau" as const }
      : null,
    installedCards: [],
    maxSlots: sectorLocations[i]?.location?.structureSlots ?? DEFAULT_STRUCTURE_SLOTS,
    factionPresence: emptyFactionPresence(),
    dominantFaction: null,
  });

  const sectors: [SectorState, SectorState, SectorState] = [
    makeSector(0), makeSector(1), makeSector(2),
  ];

  const starterStructures: Record<number, string> = {
    0: "vf-001",
    1: "sw-001",
    2: "ac-001",
  };
  for (const [sectorIdx, cardId] of Object.entries(starterStructures)) {
    const card = allCards.find((c) => c.id === cardId);
    if (card) {
      const inst = createCardInstance(card);
      inst.zone = "tableau";
      sectors[Number(sectorIdx)].installedCards.push(inst);
    }
  }

  // Fill initial dual-row market
  const worldDeckShuffled = shuffle(worldDeckCards);
  const upperRow = createEmptyRow(MARKET_SLOTS_PER_ROW);
  const lowerRow = createEmptyRow(MARKET_SLOTS_PER_ROW);

  let upperIdx = 0;
  let lowerIdx = 0;
  for (const card of worldDeckShuffled) {
    const row = getMarketRow(card.card);
    if (row === "upper" && upperIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      upperRow.slots[upperIdx++] = card;
    } else if (row === "lower" && lowerIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      lowerRow.slots[lowerIdx++] = card;
    } else if (upperIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      upperRow.slots[upperIdx++] = card;
    } else if (lowerIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      lowerRow.slots[lowerIdx++] = card;
    } else {
      break;
    }
  }

  const marketCount = upperIdx + lowerIdx;
  const remainingWorldDeck = worldDeckShuffled.slice(marketCount);

  return {
    phase: "active-watch",
    totalSleepCycles: 0,
    resources: { ...STARTING_RESOURCES },
    entropy: STARTING_ENTROPY,
    maxEntropy: MAX_ENTROPY,
    vault: { cards: [] },
    worldDeck: { drawPile: remainingWorldDeck },
    transitMarket: {
      upperRow,
      lowerRow,
      maxSlotsPerRow: MARKET_SLOTS_PER_ROW,
    },
    mandateDeck: {
      drawPile: shuffle(mandateCards),
      hand: [],
      discardPile: [],
    },
    legacyArchive: { cards: [] },
    graveyard: { cards: [] },
    ship: { sectors },
    globalFactionPresence: emptyFactionPresence(),
    turnNumber: 0,
    rules,
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
    seed: Math.floor(Math.random() * 2147483647),
  };
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(json: string): GameState {
  return JSON.parse(json) as GameState;
}
