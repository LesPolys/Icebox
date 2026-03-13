import type { ResourceType } from "./resource.js";

/** The six factions aboard the generation ship */
export type FactionId =
  | "void-forged"
  | "sowers"
  | "gilded"
  | "archival-core"
  | "the-flux"
  | "the-echoes";

/** Each faction is defined by two paired resources and a mechanical identity */
export interface FactionDefinition {
  id: FactionId;
  name: string;
  resources: [ResourceType, ResourceType];
  color: string; // hex color for card rendering
  description: string;
  mechanicalIdentity: string;
  sectorRule: string; // passive rule when faction dominates a sector
}

export const ALL_FACTION_IDS: FactionId[] = [
  "void-forged",
  "sowers",
  "gilded",
  "archival-core",
  "the-flux",
  "the-echoes",
];
