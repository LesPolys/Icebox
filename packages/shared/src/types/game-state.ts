import type { FactionId } from "./faction.js";
import type { ResourceTotals } from "./resource.js";
import type { ShipState } from "./board.js";
import type {
  VaultState,
  WorldDeckState,
  TransitMarketState,
  MandateDeckState,
  LegacyArchiveState,
  GraveyardState,
} from "./deck.js";

// ─── Entropy Thresholds ──────────────────────────────────────────────

export interface EntropyThresholds {
  /** Below this Matter total, Hull Breach junk enters the mandate */
  hullBreach: number;
  /** Below this Energy total, tableau cards lose power */
  powerDown: number;
  /** Below this Data total, advanced cards decay from world deck */
  techDecay: number;
  /** Below this Influence total, factions stage coups */
  coup: number;
}

// ─── Game Rules (tunable gameplay constants) ────────────────────────

export interface GameRules {
  /** Cards in a full hand */
  handSize: number;
  /** Cards drawn at start of each turn */
  drawPerTurn: number;
  /** Resource cost to draw an extra card */
  extraDrawCost: number;
  /** Cards drawn on first turn after waking from cryosleep */
  wakeDrawCount: number;
  /** Fraction of cost returned when scrapping (0-1) */
  scrapRefundRate: number;
  /** Base market slides per end-of-turn */
  baseSlidesPerTurn: number;
  /** Minimum card tier vulnerable to tech decay */
  techDecayMinTier: number;
  /** Faction dominance ratio that triggers social collapse */
  socialCollapseThreshold: number;
  /** Hull damage per junk card from inertia breach */
  hullDamagePerJunk: number;
  /** Starting draw pile size for mandate deck */
  startingDeckSize: number;
}

// ─── Game Phase ──────────────────────────────────────────────────────

export type GamePhase =
  | "active-watch"   // player is taking turns
  | "succession"     // player is archiving cards for legacy
  | "cryosleep"      // sleep algorithm is running
  | "game-over";

// ─── Full Game State (serializable) ─────────────────────────────────

export interface GameState {
  /** Current game phase */
  phase: GamePhase;

  /** How many sleep cycles have occurred total */
  totalSleepCycles: number;

  /** Player resources */
  resources: ResourceTotals;

  /** Entropy thresholds (escalate each sleep cycle) */
  entropyThresholds: EntropyThresholds;

  /** The Vault (all possible cards for this timeline) */
  vault: VaultState;

  /** The World Deck (cards available for market) */
  worldDeck: WorldDeckState;

  /** The Transit Market (dual-row conveyor: upper + lower) */
  transitMarket: TransitMarketState;

  /** The Mandate Deck (player's deck, hand, discard) */
  mandateDeck: MandateDeckState;

  /** Legacy archive (permanent cards across sleeps) */
  legacyArchive: LegacyArchiveState;

  /** Graveyard (dead cards) */
  graveyard: GraveyardState;

  /** The ship state (3 sectors with tableau) */
  ship: ShipState;

  /** Faction presence scores (global, not per-sector) */
  globalFactionPresence: Record<FactionId, number>;

  /** Current turn number within this watch */
  turnNumber: number;

  /** Tunable gameplay rules (can be modified by effects/laws) */
  rules: GameRules;

  /** How many sleep cycles the player chose for current/last sleep */
  chosenSleepDuration: number;

  /** Hull integrity percentage (0-100). Defeat at 0. */
  hullIntegrity: number;

  /** Years elapsed in the journey (0-1000). Victory at 1000 with hull > 0. */
  yearsPassed: number;

  /** Centuries of dominance per faction (for victory type calculation) */
  dominanceHistory: Record<FactionId, number>;

  /** Current global law set by the dominant faction. null if none. */
  globalLaw: {
    faction: FactionId;
    description: string;
    effectId: string;
  } | null;

  /** Random seed for deterministic replay (optional) */
  seed?: number;
}
