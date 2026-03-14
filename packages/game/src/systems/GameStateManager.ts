import type {
  GameState,
  Card,
  CardInstance,
  FactionId,
  ResourceTotals,
  SectorState,
} from "@icebox/shared";
import {
  STARTING_RESOURCES,
  STARTING_THRESHOLDS,
  DEFAULT_HAND_SIZE,
  MARKET_SLOTS,
  DEFAULT_STRUCTURE_SLOTS,
  ALL_FACTION_IDS,
  shuffle,
  generateInstanceId,
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
  // Separate cards by purpose
  const locationCards = allCards.filter((c) => c.type === "location");
  const junkTemplates = allCards.filter((c) => c.type === "junk");
  // IDs reserved for pre-installed sector structures (excluded from deck pools)
  const starterIds = new Set(["vf-001", "sw-001", "ac-001"]);
  const playableCards = allCards.filter(
    (c) => c.type !== "location" && c.type !== "junk" && !starterIds.has(c.id)
  );

  // Create instances for all playable cards
  const allInstances = playableCards.map((c) => {
    const inst = createCardInstance(c);
    inst.zone = "vault";
    return inst;
  });

  // Split: some go to starting mandate, rest to vault/world deck
  const shuffled = shuffle(allInstances);

  // Starting mandate: 8 cards so the market (12 slots) can be filled
  const mandateCards = shuffled.slice(0, 8);
  mandateCards.forEach((c) => (c.zone = "mandate-deck"));

  const worldDeckCards = shuffled.slice(8);
  worldDeckCards.forEach((c) => (c.zone = "world-deck"));

  // Setup locations for 3 sectors
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

  // Pre-install one starter structure per sector for initial content
  const starterStructures: Record<number, string> = {
    0: "vf-001",  // Engineering: Weld-Rig Alpha (Void-Forged)
    1: "sw-001",  // Habitat: Hydroponics Bay (Sowers)
    2: "ac-001",  // Command: Mission Archive (Archival Core)
  };
  for (const [sectorIdx, cardId] of Object.entries(starterStructures)) {
    const card = allCards.find((c) => c.id === cardId);
    if (card) {
      const inst = createCardInstance(card);
      inst.zone = "tableau";
      sectors[Number(sectorIdx)].installedCards.push(inst);
    }
  }

  // Fill initial market from world deck
  const worldDeckShuffled = shuffle(worldDeckCards);
  const marketCards = worldDeckShuffled.splice(0, MARKET_SLOTS);
  marketCards.forEach((c) => (c.zone = "transit-market"));

  return {
    phase: "active-watch",
    totalSleepCycles: 0,
    resources: { ...STARTING_RESOURCES },
    entropyThresholds: { ...STARTING_THRESHOLDS },
    vault: {
      cards: [], // Vault would hold cards not yet in the world deck — for now empty, cards added by faction dominance
    },
    worldDeck: {
      drawPile: worldDeckShuffled,
    },
    transitMarket: {
      slots: marketCards.map((c) => c),
      maxSlots: MARKET_SLOTS,
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
    seed: Math.floor(Math.random() * 2147483647),
  };
}

/**
 * Serialize game state to JSON string for saving.
 */
export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize game state from JSON string.
 */
export function deserializeGameState(json: string): GameState {
  return JSON.parse(json) as GameState;
}
