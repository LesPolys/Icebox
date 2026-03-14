import type {
  GameState,
  CardInstance,
  FactionId,
  Card,
  EntropyThresholds,
} from "@icebox/shared";
import {
  ALL_FACTION_IDS,
  SEVERITY_DIVISORS,
  THRESHOLD_ESCALATION_PER_CYCLE,
  RESOURCE_DRAIN_PER_CYCLE,
  DOMINANT_FACTION_CARDS_PER_CYCLE,
  WEAKEST_FACTION_REMOVAL_PER_CYCLE,
  HULL_DAMAGE_PER_JUNK,
  YEARS_PER_SLEEP,
  calculateArchiveSlots,
  shuffle,
  generateInstanceId,
  FACTIONS,
} from "@icebox/shared";
import { drainResources, getDeficit } from "./ResourceManager";
import { flushMarket, fillMarket } from "./MarketManager";
import {
  calculateWorldScore,
  resolveDominant,
  resolveWeakest,
  updateShipPresence,
} from "./FactionTracker";
import {
  processAgingTick,
  buildCardSectorMap,
  type AgingContext,
  type DeathEvent,
} from "./AgingManager";
import { createCardInstance } from "./GameStateManager";
import { checkDefeat, checkVictory } from "./VictoryConditions";

/**
 * Core cryosleep algorithm. Pure logic — no Phaser imports.
 *
 * The player chooses sleep duration (1-5 cycles).
 * Each cycle runs: Inertia → Flush → Transformation → Aging → Escalation.
 * After all cycles: Legacy Update (interactive, finalized separately).
 */

// ─── Event Log (for animation) ──────────────────────────────────────

export type CryosleepEventType =
  | "cycle-start"
  | "inertia-breach"
  | "market-flush"
  | "world-score"
  | "transformation-add"
  | "transformation-remove"
  | "card-death"
  | "card-transform"
  | "threshold-escalation"
  | "resource-drain"
  | "hull-damage"
  | "global-law-set"
  | "dominance-recorded"
  | "defeat"
  | "victory"
  | "cycle-end";

export interface CryosleepEvent {
  type: CryosleepEventType;
  cycle: number;
  data: Record<string, unknown>;
}

// ─── Result ─────────────────────────────────────────────────────────

export interface CryosleepResult {
  /** Ordered log for scene animation */
  events: CryosleepEvent[];
  /** Updated game state after all cycles */
  newState: GameState;
  /** Number of archive slots available for legacy update */
  archiveSlots: number;
  /** Summary stats */
  summary: {
    totalDeaths: number;
    totalCardsAdded: number;
    totalCardsRemoved: number;
    dominantFactions: FactionId[];
    weakestFactions: FactionId[];
  };
}

/**
 * Execute the full cryosleep algorithm for N cycles.
 */
export function executeCryosleep(
  state: GameState,
  sleepDuration: number,
  allCardDefinitions: Card[]
): CryosleepResult {
  const events: CryosleepEvent[] = [];
  let currentState = structuredClone(state);
  currentState.chosenSleepDuration = sleepDuration;

  const dominantFactions: FactionId[] = [];
  const weakestFactions: FactionId[] = [];
  let totalDeaths = 0;
  let totalCardsAdded = 0;
  let totalCardsRemoved = 0;

  for (let cycle = 0; cycle < sleepDuration; cycle++) {
    events.push({
      type: "cycle-start",
      cycle,
      data: { cycleNumber: cycle + 1, totalCycles: sleepDuration },
    });

    // ═══════════════════════════════════════════
    // PHASE 1: INERTIA CHECK
    // ═══════════════════════════════════════════
    currentState = processInertiaCheck(currentState, cycle, events, allCardDefinitions);

    // ═══════════════════════════════════════════
    // PHASE 2: THE FLUSH (Market → World Score)
    // ═══════════════════════════════════════════
    const { flushedCards: marketCards, market: emptyMarket } = flushMarket(
      currentState.transitMarket
    );
    currentState.transitMarket = emptyMarket;

    events.push({
      type: "market-flush",
      cycle,
      data: { flushedCount: marketCards.length },
    });

    const worldScore = calculateWorldScore(
      marketCards,
      currentState.ship,
      currentState.globalFactionPresence
    );

    events.push({
      type: "world-score",
      cycle,
      data: { worldScore: { ...worldScore } },
    });

    // ═══════════════════════════════════════════
    // PHASE 3: THE TRANSFORMATION
    // ═══════════════════════════════════════════
    const dominant = resolveDominant(worldScore, currentState.worldDeck.drawPile);
    const weakest = resolveWeakest(worldScore, currentState.worldDeck.drawPile);
    dominantFactions.push(dominant);
    weakestFactions.push(weakest);

    // Dominant faction: add cards from vault to world deck
    const cardsAdded = addFromVault(
      currentState,
      dominant,
      DOMINANT_FACTION_CARDS_PER_CYCLE,
      allCardDefinitions
    );
    totalCardsAdded += cardsAdded.length;

    for (const card of cardsAdded) {
      events.push({
        type: "transformation-add",
        cycle,
        data: {
          faction: dominant,
          cardName: card.card.name,
          cardId: card.card.id,
        },
      });
    }

    // Weakest faction: remove cards from world deck
    if (dominant !== weakest) {
      const removed = removeFromWorldDeck(
        currentState,
        weakest,
        WEAKEST_FACTION_REMOVAL_PER_CYCLE
      );
      totalCardsRemoved += removed.length;

      for (const card of removed) {
        events.push({
          type: "transformation-remove",
          cycle,
          data: {
            faction: weakest,
            cardName: card.card.name,
            cardId: card.card.id,
          },
        });
      }
    }

    // Set global law from dominant faction
    const factionDef = FACTIONS[dominant];
    if (factionDef) {
      currentState.globalLaw = {
        faction: dominant,
        description: factionDef.globalLaw.description,
        effectId: factionDef.globalLaw.effectId,
      };
      events.push({
        type: "global-law-set",
        cycle,
        data: { faction: dominant, description: factionDef.globalLaw.description },
      });
    }

    // Record dominance history
    if (currentState.dominanceHistory[dominant] !== undefined) {
      currentState.dominanceHistory[dominant]++;
    }
    events.push({
      type: "dominance-recorded",
      cycle,
      data: { dominant, weakest, dominanceHistory: { ...currentState.dominanceHistory } },
    });

    // Refill market from evolved world deck
    const fillResult = fillMarket(currentState.transitMarket, currentState.worldDeck);
    currentState.transitMarket = fillResult.market;
    currentState.worldDeck = fillResult.worldDeck;

    // ═══════════════════════════════════════════
    // PHASE 4: AGING TICK
    // ═══════════════════════════════════════════
    const agingResult = processAgingPhase(currentState, allCardDefinitions);
    totalDeaths += agingResult.deaths.length;

    for (const death of agingResult.deaths) {
      events.push({
        type: death.outcome === "transform" ? "card-transform" : "card-death",
        cycle,
        data: {
          cardName: death.card.card.name,
          cause: death.cause,
          outcome: death.outcome,
          conditionDescription: death.conditionDescription,
          transformInto: death.transformInto,
        },
      });
    }

    currentState = agingResult.newState;

    // ═══════════════════════════════════════════
    // PHASE 5: THRESHOLD ESCALATION
    // ═══════════════════════════════════════════
    currentState.entropyThresholds = escalateThresholds(
      currentState.entropyThresholds
    );
    currentState.resources = drainResources(
      currentState.resources,
      RESOURCE_DRAIN_PER_CYCLE
    );
    currentState.totalSleepCycles++;
    currentState.yearsPassed += YEARS_PER_SLEEP;

    events.push({
      type: "threshold-escalation",
      cycle,
      data: { newThresholds: { ...currentState.entropyThresholds } },
    });
    events.push({
      type: "resource-drain",
      cycle,
      data: { newResources: { ...currentState.resources } },
    });

    // Update ship presence
    currentState.ship = updateShipPresence(currentState.ship);

    // Hull damage event
    events.push({
      type: "hull-damage",
      cycle,
      data: { hullIntegrity: currentState.hullIntegrity },
    });

    // Check victory/defeat after each cycle
    const defeat = checkDefeat(currentState);
    if (defeat) {
      events.push({
        type: "defeat",
        cycle,
        data: { reason: defeat.reason },
      });
      events.push({ type: "cycle-end", cycle, data: {} });
      break; // Stop processing further cycles
    }

    const victory = checkVictory(currentState);
    if (victory) {
      events.push({
        type: "victory",
        cycle,
        data: { type: victory.type, dominantFaction: victory.dominantFaction },
      });
    }

    events.push({ type: "cycle-end", cycle, data: {} });
  }

  const archiveSlots = calculateArchiveSlots(sleepDuration);

  return {
    events,
    newState: currentState,
    archiveSlots,
    summary: {
      totalDeaths,
      totalCardsAdded,
      totalCardsRemoved,
      dominantFactions,
      weakestFactions,
    },
  };
}

// ─── Phase Implementations ───────────────────────────────────────────

function processInertiaCheck(
  state: GameState,
  cycle: number,
  events: CryosleepEvent[],
  allCardDefs: Card[]
): GameState {
  const s = state;
  const t = s.entropyThresholds;

  // Matter vs Hull Breach
  const matterDeficit = getDeficit(s.resources, "matter", t.hullBreach);
  if (matterDeficit > 0) {
    const junkCount = Math.ceil(matterDeficit / SEVERITY_DIVISORS.hullBreach);
    const hullBreachDef = allCardDefs.find((c) => c.id === "jk-001");
    if (hullBreachDef) {
      for (let i = 0; i < junkCount; i++) {
        const junkInst = createCardInstance(hullBreachDef);
        junkInst.zone = "mandate-deck";
        s.mandateDeck.drawPile.push(junkInst);
      }
    }
    // Hull damage from junk
    const hullDamage = junkCount * HULL_DAMAGE_PER_JUNK;
    s.hullIntegrity = Math.max(0, s.hullIntegrity - hullDamage);

    events.push({
      type: "inertia-breach",
      cycle,
      data: { resource: "matter", deficit: matterDeficit, junkAdded: junkCount, hullDamage },
    });
  }

  // Energy vs Power Down
  const energyDeficit = getDeficit(s.resources, "energy", t.powerDown);
  if (energyDeficit > 0) {
    const depowerCount = Math.ceil(energyDeficit / SEVERITY_DIVISORS.powerDown);
    let depowered = 0;
    for (const sector of s.ship.sectors) {
      const sorted = [...sector.installedCards]
        .filter((c) => c.powered)
        .sort((a, b) => a.card.cryosleep.survivalPriority - b.card.cryosleep.survivalPriority);
      for (const card of sorted) {
        if (depowered >= depowerCount) break;
        card.powered = false;
        depowered++;
      }
    }
    events.push({
      type: "inertia-breach",
      cycle,
      data: { resource: "energy", deficit: energyDeficit, depowered: depowered },
    });
  }

  // Data vs Tech Decay
  const dataDeficit = getDeficit(s.resources, "data", t.techDecay);
  if (dataDeficit > 0) {
    const decayCount = Math.ceil(dataDeficit / SEVERITY_DIVISORS.techDecay);
    const vulnerable = s.worldDeck.drawPile
      .filter(
        (c) =>
          c.card.tier >= 2 &&
          c.card.cryosleep.decayVulnerability.includes("data")
      )
      .sort((a, b) => a.card.cryosleep.survivalPriority - b.card.cryosleep.survivalPriority);

    const removed = vulnerable.splice(0, decayCount);
    for (const card of removed) {
      const idx = s.worldDeck.drawPile.indexOf(card);
      if (idx >= 0) s.worldDeck.drawPile.splice(idx, 1);
      card.zone = "vault";
      s.vault.cards.push(card);
    }
    events.push({
      type: "inertia-breach",
      cycle,
      data: { resource: "data", deficit: dataDeficit, decayed: removed.length },
    });
  }

  // Influence vs Coup
  const influenceDeficit = getDeficit(s.resources, "influence", t.coup);
  if (influenceDeficit > 0) {
    const coupCount = Math.ceil(influenceDeficit / SEVERITY_DIVISORS.coup);
    // For now: add sedition junk to mandate
    const seditionDef = allCardDefs.find((c) => c.id === "jk-003");
    if (seditionDef) {
      for (let i = 0; i < coupCount; i++) {
        const junkInst = createCardInstance(seditionDef);
        junkInst.zone = "mandate-deck";
        s.mandateDeck.drawPile.push(junkInst);
      }
    }
    events.push({
      type: "inertia-breach",
      cycle,
      data: { resource: "influence", deficit: influenceDeficit, coupsTriggered: coupCount },
    });
  }

  return s;
}

function processAgingPhase(
  state: GameState,
  allCardDefs: Card[]
): { deaths: DeathEvent[]; newState: GameState } {
  const s = structuredClone(state);
  const allDeaths: DeathEvent[] = [];

  const cardSectorMap = buildCardSectorMap(s.ship.sectors);

  const agingCtx: AgingContext = {
    resources: s.resources,
    sectorDominance: Object.fromEntries(
      s.ship.sectors.map((sec) => [sec.index, sec.dominantFaction])
    ),
    sectorPresence: Object.fromEntries(
      s.ship.sectors.map((sec) => [sec.index, sec.factionPresence])
    ),
    totalSleepCycles: s.totalSleepCycles,
    cardSectorMap,
  };

  // Age mandate deck cards
  const mandateResult = processAgingTick(
    [...s.mandateDeck.drawPile, ...s.mandateDeck.hand, ...s.mandateDeck.discardPile],
    agingCtx
  );
  allDeaths.push(...mandateResult.deaths);

  // Rebuild mandate from survivors
  const mandateSurvivors = new Set(mandateResult.survivors.map((c) => c.instanceId));
  s.mandateDeck.drawPile = s.mandateDeck.drawPile.filter((c) => mandateSurvivors.has(c.instanceId));
  s.mandateDeck.hand = s.mandateDeck.hand.filter((c) => mandateSurvivors.has(c.instanceId));
  s.mandateDeck.discardPile = s.mandateDeck.discardPile.filter((c) => mandateSurvivors.has(c.instanceId));

  // Age tableau cards
  for (const sector of s.ship.sectors) {
    const tableauResult = processAgingTick(sector.installedCards, agingCtx);
    allDeaths.push(...tableauResult.deaths);
    sector.installedCards = tableauResult.survivors;
  }

  // Age world deck cards
  const worldResult = processAgingTick(s.worldDeck.drawPile, agingCtx);
  allDeaths.push(...worldResult.deaths);
  s.worldDeck.drawPile = worldResult.survivors;

  // Process death outcomes
  for (const death of allDeaths) {
    switch (death.outcome) {
      case "transform": {
        if (death.transformInto) {
          const transformDef = allCardDefs.find((c) => c.id === death.transformInto);
          if (transformDef) {
            const newInst = createCardInstance(transformDef);
            newInst.zone = death.card.zone;
            // Put transformed card where the dead card was
            if (death.card.zone === "mandate-deck" || death.card.zone === "hand" || death.card.zone === "discard") {
              s.mandateDeck.discardPile.push(newInst);
            } else if (death.card.zone === "tableau") {
              // Find the sector and add it
              for (const sector of s.ship.sectors) {
                if (cardSectorMap.get(death.card.instanceId) === sector.index) {
                  sector.installedCards.push(newInst);
                  break;
                }
              }
            }
          }
        }
        s.graveyard.cards.push(death.card);
        break;
      }
      case "return-to-vault": {
        death.card.zone = "vault";
        s.vault.cards.push(death.card);
        break;
      }
      case "destroy": {
        death.card.zone = "graveyard";
        s.graveyard.cards.push(death.card);
        break;
      }
    }
  }

  return { deaths: allDeaths, newState: s };
}

function addFromVault(
  state: GameState,
  faction: FactionId,
  count: number,
  allCardDefs: Card[]
): CardInstance[] {
  // First try to pull from vault
  const vaultCandidates = state.vault.cards
    .filter((c) => c.card.faction === faction)
    .sort((a, b) => b.card.tier - a.card.tier); // prefer higher tier

  const added: CardInstance[] = [];

  for (let i = 0; i < count; i++) {
    if (vaultCandidates.length > 0) {
      const card = vaultCandidates.shift()!;
      const idx = state.vault.cards.indexOf(card);
      if (idx >= 0) state.vault.cards.splice(idx, 1);
      card.zone = "world-deck";
      card.remainingLifespan = card.card.aging.lifespan; // reset lifespan
      card.powered = true;
      state.worldDeck.drawPile.push(card);
      added.push(card);
    } else {
      // If vault is empty for this faction, create new instance from definitions
      const eligibleDefs = allCardDefs.filter(
        (c) =>
          c.faction === faction &&
          c.type !== "junk" &&
          c.type !== "location" &&
          !state.worldDeck.drawPile.some((w) => w.card.id === c.id)
      );
      if (eligibleDefs.length > 0) {
        const def = eligibleDefs[Math.floor(Math.random() * eligibleDefs.length)];
        const inst = createCardInstance(def);
        inst.zone = "world-deck";
        state.worldDeck.drawPile.push(inst);
        added.push(inst);
      }
    }
  }

  return added;
}

function removeFromWorldDeck(
  state: GameState,
  faction: FactionId,
  count: number
): CardInstance[] {
  const candidates = state.worldDeck.drawPile
    .filter((c) => c.card.faction === faction)
    .sort((a, b) => a.card.cryosleep.survivalPriority - b.card.cryosleep.survivalPriority);

  const removed: CardInstance[] = [];
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const card = candidates.shift()!;
    const idx = state.worldDeck.drawPile.indexOf(card);
    if (idx >= 0) {
      state.worldDeck.drawPile.splice(idx, 1);
      card.zone = "vault";
      state.vault.cards.push(card);
      removed.push(card);
    }
  }

  return removed;
}

function escalateThresholds(thresholds: EntropyThresholds): EntropyThresholds {
  return {
    hullBreach: thresholds.hullBreach + THRESHOLD_ESCALATION_PER_CYCLE,
    powerDown: thresholds.powerDown + THRESHOLD_ESCALATION_PER_CYCLE,
    techDecay: thresholds.techDecay + THRESHOLD_ESCALATION_PER_CYCLE,
    coup: thresholds.coup + THRESHOLD_ESCALATION_PER_CYCLE,
  };
}

/**
 * Finalize the legacy update after player has chosen cards to archive.
 * Called after the Succession scene.
 */
export function finalizeLegacy(
  state: GameState,
  cardIdsToArchive: string[]
): GameState {
  const s = structuredClone(state);

  for (const instanceId of cardIdsToArchive) {
    // Check hand
    let idx = s.mandateDeck.hand.findIndex((c) => c.instanceId === instanceId);
    if (idx >= 0) {
      const [card] = s.mandateDeck.hand.splice(idx, 1);
      card.zone = "legacy-archive";
      s.legacyArchive.cards.push(card);
      continue;
    }

    // Check discard
    idx = s.mandateDeck.discardPile.findIndex((c) => c.instanceId === instanceId);
    if (idx >= 0) {
      const [card] = s.mandateDeck.discardPile.splice(idx, 1);
      card.zone = "legacy-archive";
      s.legacyArchive.cards.push(card);
      continue;
    }
  }

  // Shuffle remaining hand and discard back into draw pile
  const remaining = [...s.mandateDeck.hand, ...s.mandateDeck.discardPile];
  remaining.forEach((c) => (c.zone = "mandate-deck"));
  s.mandateDeck.drawPile = shuffle([...s.mandateDeck.drawPile, ...remaining]);
  s.mandateDeck.hand = [];
  s.mandateDeck.discardPile = [];

  // Add legacy archive cards back to mandate draw pile for next watch
  for (const card of s.legacyArchive.cards) {
    const copy = structuredClone(card);
    copy.zone = "mandate-deck";
    copy.instanceId = generateInstanceId();
    s.mandateDeck.drawPile.push(copy);
  }

  // Reshuffle
  s.mandateDeck.drawPile = shuffle(s.mandateDeck.drawPile);

  // Transition back to active watch
  s.phase = "active-watch";
  s.turnNumber = 0;

  return s;
}
