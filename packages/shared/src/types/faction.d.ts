import type { ResourceType } from "./resource.js";
/** The six factions aboard the generation ship */
export type FactionId = "void-forged" | "sowers" | "gilded" | "archival-core" | "the-flux" | "the-echoes";
/** Each faction is defined by two paired resources and a mechanical identity */
export interface FactionDefinition {
    id: FactionId;
    name: string;
    resources: [ResourceType, ResourceType];
    color: string;
    description: string;
    mechanicalIdentity: string;
    sectorRule: string;
    /** Sector indices where this faction has affinity (0=Engineering, 1=Habitat, 2=Biosphere) */
    sectorAffinity: number[];
    /** Global law effect when this faction is dominant ship-wide */
    globalLaw: {
        description: string;
        effectId: string;
    };
}
export declare const ALL_FACTION_IDS: FactionId[];
//# sourceMappingURL=faction.d.ts.map