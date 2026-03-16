import type {
  GameState,
  CardInstance,
  FactionId,
  Card,
  CrewSleepChoice,
} from "@icebox/shared";
import {
  ALL_FACTION_IDS,
  ENTROPY_BREAKPOINTS,
  ENTROPY_PER_SLEEP_CYCLE,
  RESOURCE_DRAIN_PER_CYCLE,
  DOMINANT_FACTION_CARDS_PER_CYCLE,
  WEAKEST_FACTION_REMOVAL_PER_CYCLE,
  YEARS_PER_SLEEP,
  CRYO_POD_COST,
  MENTORSHIP_COST,
  DIGITAL_ARCHIVE_COST,
  calculateArchiveSlots,
  shuffle,
  generateInstanceId,
  canAfford,
  spendResources,
  FACTIONS,
} from "@icebox/shared";
import { drainResources } from "./ResourceManager";
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
import { applyEraTransition } from "./EraEngine";
import { emitTiming, resolveEffect } from "./effects/EffectRegistry";
import { getDamageReduction } from "./effects/PassiveScanner";

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
  | "entropy-breakpoint"
  | "market-flush"
  | "world-score"
  | "transformation-add"
  | "transformation-remove"
  | "card-death"
  | "card-transform"
  | "entropy-escalation"
  | "resource-drain"
  | "hull-damage"
  | "global-law-set"
  | "dominance-recorded"
  | "crew-mortality"
  | "crew-cryo-pod"
  | "crew-mentorship"
  | "crew-digital-archive"
  | "era-transition"
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
  allCardDefinitions: Card[],
  crewFatePlan?: Map<string, CrewSleepChoice>
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
    // PHASE 0: ON-SLEEP TRIGGERS
    // ═══════════════════════════════════════════
    const sleepResult = emitTiming(currentState, "on-sleep");
    currentState = sleepResult.state;

    // ═══════════════════════════════════════════
    // PHASE 1: ENTROPY BREAKPOINT CHECK
    // ═══════════════════════════════════════════
    currentState = processEntropyBreakpoints(currentState, cycle, events, allCardDefinitions);

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
    // PHASE 5: CREW MORTALITY
    // ═══════════════════════════════════════════
    currentState = processCrewMortality(currentState, cycle, events, crewFatePlan, allCardDefinitions);

    // ═══════════════════════════════════════════
    // PHASE 6: ENTROPY ESCALATION
    // ═══════════════════════════════════════════
    const prevEntropy = currentState.entropy;
    currentState.entropy += ENTROPY_PER_SLEEP_CYCLE;
    // Apply era maintenance cost modifier to resource drain
    const maintenanceMod = currentState.eraModifiers?.maintenanceCostModifier ?? 1;
    const scaledDrain = {
      matter: Math.round((RESOURCE_DRAIN_PER_CYCLE.matter ?? 0) * maintenanceMod),
      energy: Math.round((RESOURCE_DRAIN_PER_CYCLE.energy ?? 0) * maintenanceMod),
      data: Math.round((RESOURCE_DRAIN_PER_CYCLE.data ?? 0) * maintenanceMod),
      influence: Math.round((RESOURCE_DRAIN_PER_CYCLE.influence ?? 0) * maintenanceMod),
    };
    currentState.resources = drainResources(
      currentState.resources,
      scaledDrain
    );
    currentState.totalSleepCycles++;
    currentState.yearsPassed += YEARS_PER_SLEEP;

    events.push({
      type: "entropy-escalation",
      cycle,
      data: { prevEntropy, newEntropy: currentState.entropy },
    });
    events.push({
      type: "resource-drain",
      cycle,
      data: { newResources: { ...currentState.resources } },
    });

    // ═══════════════════════════════════════════
    // PHASE 7: ERA TRANSITION
    // ═══════════════════════════════════════════
    const prevEra = currentState.era;
    currentState = applyEraTransition(currentState);
    if (currentState.era !== prevEra) {
      events.push({
        type: "era-transition",
        cycle,
        data: { prevEra, newEra: currentState.era, modifiers: { ...currentState.eraModifiers } },
      });
    }

    // ═══════════════════════════════════════════
    // PHASE 8: ON-WAKE TRIGGERS
    // ═══════════════════════════════════════════
    const wakeResult = emitTiming(currentState, "on-wake");
    currentState = wakeResult.state;

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

/**
 * Evaluate the unified entropy gauge against breakpoints.
 * Each crossed breakpoint triggers deterministic consequences.
 */
function processEntropyBreakpoints(
  state: GameState,
  cycle: number,
  events: CryosleepEvent[],
  allCardDefs: Card[]
): GameState {
  const s = state;
  const entropy = s.entropy;

  for (const bp of ENTROPY_BREAKPOINTS) {
    if (entropy < bp.threshold) break; // breakpoints are ordered, stop once we're below

    events.push({
      type: "entropy-breakpoint",
      cycle,
      data: { threshold: bp.threshold, effect: bp.effect, description: bp.description },
    });

    switch (bp.effect) {
      case "minor-decay": {
        // Minor structural wear: depower 1 lowest-priority card
        for (const sector of s.ship.sectors) {
          const powered = sector.installedCards
            .filter((c) => c.powered && !c.underConstruction)
            .sort((a, b) => a.card.cryosleep.survivalPriority - b.card.cryosleep.survivalPriority);
          if (powered.length > 0) {
            powered[0].powered = false;
            break;
          }
        }
        break;
      }
      case "power-fluctuations": {
        // Power grid unstable: depower 2 more cards
        let depowered = 0;
        for (const sector of s.ship.sectors) {
          const powered = sector.installedCards
            .filter((c) => c.powered && !c.underConstruction)
            .sort((a, b) => a.card.cryosleep.survivalPriority - b.card.cryosleep.survivalPriority);
          for (const card of powered) {
            if (depowered >= 2) break;
            card.powered = false;
            depowered++;
          }
        }
        break;
      }
      case "structural-warnings": {
        // Hull stress: add junk to mandate deck
        const hullBreachDef = allCardDefs.find((c) => c.id === "jk-hull-01");
        if (hullBreachDef) {
          const junkInst = createCardInstance(hullBreachDef);
          junkInst.zone = "mandate-deck";
          s.mandateDeck.drawPile.push(junkInst);
        }
        break;
      }
      case "critical-failure": {
        // Cascading failure: hull damage + junk + depower all
        const rawDamage = s.rules.hullDamagePerJunk * 2;
        const damageReduction = getDamageReduction(s);
        const hullDamage = Math.max(0, rawDamage - damageReduction);
        s.hullIntegrity = Math.max(0, s.hullIntegrity - hullDamage);
        events.push({
          type: "hull-damage",
          cycle,
          data: { hullIntegrity: s.hullIntegrity, damage: hullDamage },
        });
        break;
      }
    }
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

  // Process death outcomes — fire on-death triggers, then apply outcomes
  let ds = s;
  for (const death of allDeaths) {
    // Fire on-death effects from the dying card before applying outcome
    for (const effect of death.card.card.effects.filter((e) => e.timing === "on-death")) {
      const deathEffResult = resolveEffect(ds, effect, death.card);
      ds = deathEffResult.state;
    }
    switch (death.outcome) {
      case "transform": {
        if (death.transformInto) {
          const transformDef = allCardDefs.find((c) => c.id === death.transformInto);
          if (transformDef) {
            const newInst = createCardInstance(transformDef);
            newInst.zone = death.card.zone;
            if (death.card.zone === "mandate-deck" || death.card.zone === "hand" || death.card.zone === "discard") {
              ds.mandateDeck.discardPile.push(newInst);
            } else if (death.card.zone === "tableau") {
              for (const sector of ds.ship.sectors) {
                if (cardSectorMap.get(death.card.instanceId) === sector.index) {
                  sector.installedCards.push(newInst);
                  break;
                }
              }
            }
          }
        }
        ds.graveyard.cards.push(death.card);
        break;
      }
      case "return-to-vault": {
        death.card.zone = "vault";
        ds.vault.cards.push(death.card);
        break;
      }
      case "destroy": {
        death.card.zone = "graveyard";
        ds.graveyard.cards.push(death.card);
        break;
      }
    }
  }

  return { deaths: allDeaths, newState: ds };
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

/**
 * Process crew mortality during cryosleep.
 * By default all crew die. Players can pay to preserve them.
 */
function processCrewMortality(
  state: GameState,
  cycle: number,
  events: CryosleepEvent[],
  crewFatePlan: Map<string, CrewSleepChoice> | undefined,
  allCardDefs: Card[]
): GameState {
  const s = structuredClone(state);

  for (const sector of s.ship.sectors) {
    const crewCards = sector.installedCards.filter(
      (c) => c.card.type === "crew" && (c.zone === "attached" || c.zone === "tableau")
    );

    for (const crew of crewCards) {
      const fate = crewFatePlan?.get(crew.instanceId) ?? "natural";

      switch (fate) {
        case "cryo-pod": {
          if (canAfford(s.resources, CRYO_POD_COST)) {
            s.resources = spendResources(s.resources, CRYO_POD_COST);
            events.push({
              type: "crew-cryo-pod",
              cycle,
              data: { crewName: crew.card.name, instanceId: crew.instanceId },
            });
            // Crew stays on structure — no action needed
          } else {
            // Can't afford, falls through to natural death
            removeCrew(s, sector, crew);
            events.push({
              type: "crew-mortality",
              cycle,
              data: { crewName: crew.card.name, reason: "Cannot afford Cryo-Pod" },
            });
          }
          break;
        }
        case "mentorship": {
          if (canAfford(s.resources, MENTORSHIP_COST)) {
            s.resources = spendResources(s.resources, MENTORSHIP_COST);
            removeCrew(s, sector, crew);
            // Add Junior archetype card to next starting hand
            // (tracked as a flag; the actual card is created during legacy finalization)
            events.push({
              type: "crew-mentorship",
              cycle,
              data: {
                crewName: crew.card.name,
                skillTag: crew.card.crew?.skillTag,
                instanceId: crew.instanceId,
              },
            });
          } else {
            removeCrew(s, sector, crew);
            events.push({
              type: "crew-mortality",
              cycle,
              data: { crewName: crew.card.name, reason: "Cannot afford Mentorship" },
            });
          }
          break;
        }
        case "digital-archive": {
          if (canAfford(s.resources, DIGITAL_ARCHIVE_COST)) {
            s.resources = spendResources(s.resources, DIGITAL_ARCHIVE_COST);
            // Transform crew into a [Tech] AI card
            // For now, update the card's primary tag and remove stress
            crew.card = {
              ...crew.card,
              primaryTag: "Tech",
              type: "structure", // AI becomes a persistent structure
            };
            crew.currentStress = undefined;
            crew.zone = "tableau";
            events.push({
              type: "crew-digital-archive",
              cycle,
              data: { crewName: crew.card.name, instanceId: crew.instanceId },
            });
          } else {
            removeCrew(s, sector, crew);
            events.push({
              type: "crew-mortality",
              cycle,
              data: { crewName: crew.card.name, reason: "Cannot afford Digital Archive" },
            });
          }
          break;
        }
        case "natural":
        default: {
          removeCrew(s, sector, crew);
          events.push({
            type: "crew-mortality",
            cycle,
            data: { crewName: crew.card.name, reason: "Natural mortality" },
          });
          break;
        }
      }
    }
  }

  return s;
}

function removeCrew(
  state: GameState,
  sector: GameState["ship"]["sectors"][number],
  crew: CardInstance
): void {
  const idx = sector.installedCards.findIndex((c) => c.instanceId === crew.instanceId);
  if (idx >= 0) {
    sector.installedCards.splice(idx, 1);
    crew.zone = "graveyard";
    crew.attachedTo = undefined;
    state.graveyard.cards.push(crew);
  }
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
