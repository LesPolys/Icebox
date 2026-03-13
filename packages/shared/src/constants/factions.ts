import type { FactionDefinition } from "../types/faction.js";

export const FACTIONS: Record<string, FactionDefinition> = {
  "void-forged": {
    id: "void-forged",
    name: "Void-Forged",
    resources: ["matter", "energy"],
    color: "#e85d3a",
    description: "Engineers and mechanics who keep the hull intact through brute force and ingenuity.",
    mechanicalIdentity: "Scrapping, Overclocking, High-Risk Repairs",
    sectorRule: "All repair/structure costs in this sector: -1 Matter",
  },
  sowers: {
    id: "sowers",
    name: "Sowers",
    resources: ["matter", "influence"],
    color: "#4caf50",
    description: "Agrarian collective focused on growth, sustainability, and deep-rooted community.",
    mechanicalIdentity: "Growth, Resource Conversion, 'Rooted' Presence",
    sectorRule: "Gain +1 Influence when playing cards in this sector",
  },
  gilded: {
    id: "gilded",
    name: "Gilded",
    resources: ["matter", "data"],
    color: "#ffc107",
    description: "Merchants and hoarders who control the flow of goods through taxation and inventory.",
    mechanicalIdentity: "Hoarding, Tolls/Taxes, Inventory Control",
    sectorRule: "Market cards cost +1 of any resource (toll)",
  },
  "archival-core": {
    id: "archival-core",
    name: "Archival Core",
    resources: ["energy", "data"],
    color: "#2196f3",
    description: "Keepers of mission parameters and original Earth knowledge. Precision above all.",
    mechanicalIdentity: "Market Locking, Mission Compliance, Precision",
    sectorRule: "Cards in this sector cannot be removed by entropy effects",
  },
  "the-flux": {
    id: "the-flux",
    name: "The Flux",
    resources: ["energy", "influence"],
    color: "#ab47bc",
    description: "Agents of change and instability. They thrive in chaos and rapid evolution.",
    mechanicalIdentity: "Market Jumping, Rapid Evolution, Instability",
    sectorRule: "Market slides 1 extra slot when this sector is active",
  },
  "the-echoes": {
    id: "the-echoes",
    name: "The Echoes",
    resources: ["data", "influence"],
    color: "#78909c",
    description: "Preservers of memory and morale. They carry the weight of generations past.",
    mechanicalIdentity: "History Preservation, Morale Buffs, Multi-Sleep Persistence",
    sectorRule: "Cards in this sector persist through 1 additional sleep cycle",
  },
};

/** Get a faction definition by ID */
export function getFaction(id: string): FactionDefinition | undefined {
  return FACTIONS[id];
}
