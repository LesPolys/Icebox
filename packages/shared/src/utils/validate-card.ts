import type { Card } from "../types/card.js";
import { ALL_FACTION_IDS } from "../types/faction.js";

export interface ValidationError {
  field: string;
  message: string;
}

/** Validate a card object against expected structure */
export function validateCard(card: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  const c = card as Record<string, unknown>;

  // Required string fields
  for (const field of ["id", "name", "art"]) {
    if (typeof c[field] !== "string" || (c[field] as string).length === 0) {
      errors.push({ field, message: `${field} is required and must be a non-empty string` });
    }
  }

  // ID format
  if (typeof c.id === "string" && !/^[a-z]{1,4}-\d{3}[a-z]?$/.test(c.id)) {
    errors.push({ field: "id", message: "id must match pattern: 1-4 lowercase letters, dash, 3 digits, optional letter suffix (e.g., vf-001, vf-001b)" });
  }

  // CardType
  const validTypes = ["location", "structure", "institution", "action", "event", "hazard", "junk"];
  if (!validTypes.includes(c.type as string)) {
    errors.push({ field: "type", message: `type must be one of: ${validTypes.join(", ")}` });
  }

  // Faction
  const validFactions = [...ALL_FACTION_IDS, "neutral"];
  if (!validFactions.includes(c.faction as string)) {
    errors.push({ field: "faction", message: `faction must be one of: ${validFactions.join(", ")}` });
  }

  // Tier
  if (![1, 2, 3].includes(c.tier as number)) {
    errors.push({ field: "tier", message: "tier must be 1, 2, or 3" });
  }

  // Cost
  if (c.cost != null && typeof c.cost === "object") {
    validateResourceCost(c.cost as Record<string, unknown>, "cost", errors);
  }

  // Faction icons
  if (!Array.isArray(c.factionIcons)) {
    errors.push({ field: "factionIcons", message: "factionIcons must be an array" });
  } else {
    for (const icon of c.factionIcons as string[]) {
      if (!ALL_FACTION_IDS.includes(icon as typeof ALL_FACTION_IDS[number])) {
        errors.push({ field: "factionIcons", message: `Invalid faction icon: ${icon}` });
      }
    }
  }

  // Tags
  if (!Array.isArray(c.tags)) {
    errors.push({ field: "tags", message: "tags must be an array" });
  }

  // Aging
  if (c.aging == null || typeof c.aging !== "object") {
    errors.push({ field: "aging", message: "aging is required" });
  } else {
    const aging = c.aging as Record<string, unknown>;
    if (aging.lifespan !== null && (typeof aging.lifespan !== "number" || aging.lifespan < 0)) {
      errors.push({ field: "aging.lifespan", message: "lifespan must be null or a non-negative number" });
    }
    const validDeathOutcomes = ["transform", "return-to-vault", "destroy"];
    if (!validDeathOutcomes.includes(aging.onDeath as string)) {
      errors.push({ field: "aging.onDeath", message: `onDeath must be one of: ${validDeathOutcomes.join(", ")}` });
    }
    if (aging.onDeath === "transform" && typeof aging.transformInto !== "string") {
      errors.push({ field: "aging.transformInto", message: "transformInto is required when onDeath is 'transform'" });
    }
  }

  // Cryosleep
  if (c.cryosleep == null || typeof c.cryosleep !== "object") {
    errors.push({ field: "cryosleep", message: "cryosleep is required" });
  }

  // Location-specific validation
  if (c.type === "location" && c.location == null) {
    errors.push({ field: "location", message: "location data is required for location-type cards" });
  }

  // Hazard-specific validation
  if (c.type === "hazard" && c.hazard == null) {
    errors.push({ field: "hazard", message: "hazard data is required for hazard-type cards" });
  }

  // Junk-specific validation
  if (c.type === "junk" && c.junk == null) {
    errors.push({ field: "junk", message: "junk data is required for junk-type cards" });
  }

  return errors;
}

function validateResourceCost(
  cost: Record<string, unknown>,
  prefix: string,
  errors: ValidationError[]
): void {
  for (const key of ["matter", "energy", "data", "influence"]) {
    if (cost[key] != null && (typeof cost[key] !== "number" || (cost[key] as number) < 0)) {
      errors.push({ field: `${prefix}.${key}`, message: `${key} must be a non-negative number` });
    }
  }
}
