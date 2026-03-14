import type {
  GameState,
  Card,
  CardInstance,
  FactionId,
  SectorState,
} from "@icebox/shared";
import {
  STARTING_RESOURCES,
  STARTING_THRESHOLDS,
  DEFAULT_HAND_SIZE,
  MARKET_SLOTS_PER_ROW,
  STARTING_HULL_INTEGRITY,
  DEFAULT_STRUCTURE_SLOTS,
  ALL_FACTION_IDS,
  shuffle,
  generateInstanceId,
  getMarketRow,
  resetMarketRowCounter,
  createEmptyRow,
} from "@icebox/shared";

/**
 * Creates a CardInstance from a Card definition.
 */
export function createCardInstance(card: Card): CardInstance {
  return {
    card,
    instanceId: generateInstanceId(),
    remainingLifespan: card.aging.lifespan,
    powered: true,
    zone: "vault",
  };
}

/**
 * Create a fresh starting game state from card definitions.
 */
export function createNewGameState(allCards: Card[]): GameState {
  resetMarketRowCounter();

  const locationCards = allCards.filter((c) => c.type === "location");
  const starterIds = new Set(["vf-001", "sw-001", "ac-001"]);
  const playableCards = allCards.filter(
    (c) => c.type !== "location" && c.type !== "junk" && !starterIds.has(c.id)
  );

  const allInstances = playableCards.map((c) => {
    const inst = createCardInstance(c);
    inst.zone = "vault";
    return inst;
  });

  const shuffled = shuffle(allInstances);
  const mandateCards = shuffled.slice(0, 8);
  mandateCards.forEach((c) => (c.zone = "mandate-deck"));

  const worldDeckCards = shuffled.slice(8);
  worldDeckCards.forEach((c) => (c.zone = "world-deck"));

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
  const physicalRow = createEmptyRow(MARKET_SLOTS_PER_ROW);
  const socialRow = createEmptyRow(MARKET_SLOTS_PER_ROW);

  let physIdx = 0;
  let socIdx = 0;
  for (const card of worldDeckShuffled) {
    const row = getMarketRow(card.card);
    if (row === "physical" && physIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      physicalRow.slots[physIdx++] = card;
    } else if (row === "social" && socIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      socialRow.slots[socIdx++] = card;
    } else if (physIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      physicalRow.slots[physIdx++] = card;
    } else if (socIdx < MARKET_SLOTS_PER_ROW) {
      card.zone = "transit-market";
      socialRow.slots[socIdx++] = card;
    } else {
      break;
    }
  }

  const marketCount = physIdx + socIdx;
  const remainingWorldDeck = worldDeckShuffled.slice(marketCount);

  return {
    phase: "active-watch",
    totalSleepCycles: 0,
    resources: { ...STARTING_RESOURCES },
    entropyThresholds: { ...STARTING_THRESHOLDS },
    vault: { cards: [] },
    worldDeck: { drawPile: remainingWorldDeck },
    transitMarket: {
      physicalRow,
      socialRow,
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
    handSize: DEFAULT_HAND_SIZE,
    chosenSleepDuration: 1,
    hullIntegrity: STARTING_HULL_INTEGRITY,
    yearsPassed: 0,
    dominanceHistory: (() => {
      const h = {} as Record<FactionId, number>;
      for (const fid of ALL_FACTION_IDS) h[fid] = 0;
      return h;
    })(),
    globalLaw: null,
    seed: Math.floor(Math.random() * 2147483647),
  };
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function deserializeGameState(json: string): GameState {
  return JSON.parse(json) as GameState;
}
