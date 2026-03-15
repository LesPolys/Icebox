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
  | "junk"          // negative card (hull breach, tech decay, factional coup)
  | "crew";         // attachment card played onto structures, has stress system

export type CardTier = 1 | 2 | 3; // 1=basic, 2=advanced, 3=legendary

// ─── Tag System ─────────────────────────────────────────────────────

/** Primary category: defines what a card IS */
export type PrimaryCategoryTag = "Machine" | "Organic" | "Law" | "Tech";

/** Attribute tags: modify how a card behaves */
export type AttributeTag = "Hazard" | "Persistent" | "Fragile" | "Heavy";

// ─── Crew System ────────────────────────────────────────────────────

/** Skill specializations for crew archetypes */
export type SkillTag = "Engineer" | "Botanist" | "Orator" | "Logic";

/** Crew sleep fate choices during cryosleep */
export type CrewSleepChoice = "natural" | "cryo-pod" | "mentorship" | "digital-archive";

export interface CrewData {
  /** Skill archetype */
  skillTag: SkillTag;
  /** Maximum stress before burnout (3-5) */
  maxStress: number;
  /** Description of the expert ability unlocked when manning a structure */
  expertAbilityDescription: string;
  /** Cost to reassign this crew to another structure. Defaults to { influence: 1 } */
  reassignCost?: ResourceCost;
}

// ─── Construction System ────────────────────────────────────────────

export interface ConstructionData {
  /** Turns to auto-complete. 0 or undefined = no time requirement */
  completionTime?: number;
  /** Resources that must be contributed to complete construction */
  resourceRequirement?: ResourceCost;
  /** Whether this structure can be fast-tracked */
  fastTrackable: boolean;
  /** Resource cost per turn skipped via fast-track */
  fastTrackCost?: ResourceCost;
  /** Entropy generated per turn skipped via fast-track */
  fastTrackEntropy?: number;
}

// ─── Crisis System ──────────────────────────────────────────────────

export interface CrisisData {
  /** Whether this card triggers cryosleep */
  isCrisis: boolean;
  /** Cost to proactively resolve the crisis (sleep on your terms) */
  proactiveCost?: ResourceCost;
  /** Entropy added when crisis forces reactive sleep (slot 0 fallout) */
  reactiveEntropyPenalty?: number;
}

// ─── Effect System ───────────────────────────────────────────────────

export type EffectTiming =
  | "on-play"       // when played from hand
  | "passive"       // while in tableau
  | "on-fallout"    // when it falls off the market
  | "on-discard"    // when discarded from hand/tableau
  | "on-sleep"      // triggers during cryosleep
  | "on-wake"       // triggers when waking from cryosleep
  | "on-acquire"    // when bought from market
  | "on-death"      // when this card dies (aging/decay)
  | "on-manned"     // when a crew member is attached to this structure
  | "on-burnout";   // when a crew member reaches 0 stress

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
  | "modify-entropy"
  | "reduce-entropy"
  | "extend-lifespan"
  | "gain-presence"
  | "prevent-damage"
  | "peek-deck"
  | "apply-stress";

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
    | "sleep-count"
    | "entropy-above";
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
  targetRow?: "upper" | "lower";
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

  /** Primary category tag — defines what this card IS */
  primaryTag?: PrimaryCategoryTag;

  /** Attribute tags — modify how this card behaves */
  attributeTags?: AttributeTag[];

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

  /** Crew-specific fields (only for type="crew") */
  crew?: CrewData;

  /** Construction rules (only for type="structure", optional) */
  construction?: ConstructionData;

  /** Crisis trigger data (for event/hazard cards that trigger cryosleep) */
  crisis?: CrisisData;

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

  // ─── Crew state (only for type="crew") ──────────────────────────
  /** Current stress level. Initialized to maxStress, decrements toward 0. */
  currentStress?: number;
  /** Instance ID of the structure this crew is attached to */
  attachedTo?: string;

  // ─── Construction state (only for type="structure") ─────────────
  /** Whether this structure is under construction (face-down) */
  underConstruction?: boolean;
  /** Turns of construction progress elapsed */
  constructionProgress?: number;
  /** Resources contributed toward construction so far */
  constructionResourcesAdded?: ResourceCost;
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
  | "graveyard"        // dead cards
  | "attached";        // crew attached to a structure
