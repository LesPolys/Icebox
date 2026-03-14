import type { FactionId } from "./faction.js";
import type { ResourceCost, ResourceType } from "./resource.js";

// ─── Card Classification ─────────────────────────────────────────────

export type CardType =
  | "location"      // defines a sector's base rules
  | "structure"     // persistent card slotted into a sector
  | "institution"   // persistent card representing social/political entities
  | "action"        // one-shot card played from hand
  | "event"         // triggered from market fallout or sleep
  | "hazard"        // market parasite: passive negative while in market, buy=fix, fallout=catastrophe
  | "junk";         // negative card (hull breach, tech decay, factional coup)

export type CardTier = 1 | 2 | 3; // 1=basic, 2=advanced, 3=legendary

// ─── Effect System ───────────────────────────────────────────────────

export type EffectTiming =
  | "on-play"       // when played from hand
  | "passive"       // while in tableau
  | "on-fallout"    // when it falls off the market
  | "on-discard"    // when discarded from hand/tableau
  | "on-sleep"      // triggers during cryosleep
  | "on-wake"       // triggers when waking from cryosleep
  | "on-acquire"    // when bought from market
  | "on-death";     // when this card dies (aging/decay)

/** Known effect types for the EffectResolver */
export type EffectType =
  | "gain-resource"
  | "spend-resource"
  | "draw-cards"
  | "add-junk"
  | "remove-junk"
  | "remove-card"
  | "modify-cost"
  | "shift-faction"
  | "lock-market-slot"
  | "modify-threshold"
  | "extend-lifespan"
  | "gain-presence";

export interface CardEffect {
  id: string;
  timing: EffectTiming;
  description: string;
  type: EffectType;
  params: Record<string, unknown>;
  condition?: EffectCondition;
}

export interface EffectCondition {
  type:
    | "faction-dominance"
    | "resource-threshold"
    | "sector-control"
    | "card-in-tableau"
    | "sleep-count";
  params: Record<string, unknown>;
}

// ─── Aging / Mortality System ────────────────────────────────────────

export interface DecayCondition {
  type:
    | "resource-below"
    | "faction-dominance"
    | "no-presence-in-sector"
    | "sleep-count-above";
  params: Record<string, unknown>;
  description: string;
}

export type DeathOutcome = "transform" | "return-to-vault" | "destroy";

export interface CardAging {
  /** Sleep cycles until death. null = immortal. */
  lifespan: number | null;
  /** Conditions that can kill this card before lifespan runs out */
  decayConditions: DecayCondition[];
  /** What happens when this card dies */
  onDeath: DeathOutcome;
  /** Card ID to become on death (only if onDeath = "transform") */
  transformInto?: string;
}

// ─── Cryosleep Metadata ─────────────────────────────────────────────

export interface CryosleepMeta {
  /** What this card contributes to inertia checks */
  inertiaContribution: ResourceCost;
  /** Which resource shortfalls can target this card for removal */
  decayVulnerability: ResourceType[];
  /** Tiebreaker: higher = harder to lose during sleep */
  survivalPriority: number;
  /** How much this card counts toward World Score during flush */
  factionWeight: number;
}

// ─── Location-Specific Fields ────────────────────────────────────────

export interface LocationData {
  sector: number; // 0, 1, or 2
  structureSlots: number;
  passiveEffect?: CardEffect;
}

// ─── Hazard-Specific Fields ──────────────────────────────────────────

export interface HazardData {
  /** Which market row this hazard targets (for dual-row market) */
  targetRow?: "physical" | "social";
  /** What happens when the player buys/suppresses this hazard */
  onBuy: "destroy" | "return-to-vault";
}

// ─── Junk-Specific Fields ────────────────────────────────────────────

export type JunkSource = "hull-breach" | "tech-decay" | "factional-coup";

export interface JunkData {
  source: JunkSource;
  removalCost: ResourceCost;
}

// ─── The Card ────────────────────────────────────────────────────────

export interface Card {
  id: string;
  name: string;
  type: CardType;
  faction: FactionId | "neutral";
  tier: CardTier;
  art: string;

  /** Resource cost to acquire from market or play from hand */
  cost: ResourceCost;
  /** Immediate resource gain on play */
  resourceGain?: ResourceCost;

  effects: CardEffect[];

  /** Faction icons for World Score tallying during flush */
  factionIcons: FactionId[];

  /** Freeform tags for filtering and effect targeting */
  tags: string[];

  /** Aging and mortality rules */
  aging: CardAging;

  /** Cryosleep algorithm metadata */
  cryosleep: CryosleepMeta;

  /** Cost to draw this as an extra draw action (if applicable) */
  drawCost?: ResourceCost;

  /** Location-specific fields (only for type="location") */
  location?: LocationData;

  /** Hazard-specific fields (only for type="hazard") */
  hazard?: HazardData;

  /** Junk-specific fields (only for type="junk") */
  junk?: JunkData;

  flavorText?: string;

  /** Editor-only notes, stripped in production builds */
  designNotes?: string;
}

// ─── Runtime Card Instance ───────────────────────────────────────────
// Cards in play need mutable state (remaining lifespan, powered status, etc.)

export interface CardInstance {
  /** Reference to the card definition */
  card: Card;
  /** Unique instance ID (for tracking across zones) */
  instanceId: string;
  /** Remaining lifespan (decremented during sleep). null if immortal. */
  remainingLifespan: number | null;
  /** Whether this card is currently powered (Energy inertia) */
  powered: boolean;
  /** Which zone this card is currently in */
  zone: CardZone;
}

export type CardZone =
  | "vault"           // source pool (never enters play directly)
  | "world-deck"      // available for market/events
  | "transit-market"   // in the 6-slot market
  | "mandate-deck"     // player's draw pile
  | "hand"             // player's hand
  | "discard"          // player's discard pile
  | "tableau"          // installed in a sector
  | "legacy-archive"   // permanently archived
  | "graveyard";       // dead cards
