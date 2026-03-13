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

  /** The Transit Market (6-slot conveyor) */
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

  /** Hand size limit */
  handSize: number;

  /** How many sleep cycles the player chose for current/last sleep */
  chosenSleepDuration: number;

  /** Random seed for deterministic replay (optional) */
  seed?: number;
}
