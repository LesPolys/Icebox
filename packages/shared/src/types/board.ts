import type { CardInstance } from "./card.js";
import type { FactionId } from "./faction.js";

/** A single sector of the ship (there are 3) */
export interface SectorState {
  /** Sector index (0, 1, 2) */
  index: number;
  /** The location card defining this sector's base rules */
  location: CardInstance | null;
  /** Structure/institution slots (max determined by location card) */
  installedCards: CardInstance[];
  /** Maximum number of structure slots */
  maxSlots: number;
  /** Faction presence scores (sum of faction icons on installed cards) */
  factionPresence: Record<FactionId, number>;
  /** Which faction currently dominates this sector (highest presence) */
  dominantFaction: FactionId | null;
}

/** The full ship tableau */
export interface ShipState {
  sectors: [SectorState, SectorState, SectorState];
}

/** Sector names for display */
export const SECTOR_NAMES = ["Engineering", "Habitat", "Biosphere"] as const;
export type SectorName = (typeof SECTOR_NAMES)[number];
