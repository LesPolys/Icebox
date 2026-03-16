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

  // ID format: prefix-suffix (e.g., vf-s01, loc-eng-base, jk-hull-01, st-001, hz-001, ns-001, wc-001)
  if (typeof c.id === "string" && !/^[a-z]{2,4}(-[a-z0-9]+)+$/.test(c.id)) {
    errors.push({ field: "id", message: "id must be kebab-case with 2-4 letter prefix (e.g., vf-s01, loc-eng-base, jk-hull-01)" });
  }

  // CardType
  const validTypes = ["location", "structure", "institution", "action", "event", "hazard", "junk", "crew", "crisis"];
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

  // Crew-specific validation
  if (c.type === "crew") {
    if (c.crew == null || typeof c.crew !== "object") {
      errors.push({ field: "crew", message: "crew data is required for crew-type cards" });
    } else {
      const crew = c.crew as Record<string, unknown>;
      const validSkillTags = ["Engineer", "Botanist", "Orator", "Logic"];
      if (!validSkillTags.includes(crew.skillTag as string)) {
        errors.push({ field: "crew.skillTag", message: `skillTag must be one of: ${validSkillTags.join(", ")}` });
      }
      if (typeof crew.maxStress !== "number" || crew.maxStress < 3 || crew.maxStress > 5) {
        errors.push({ field: "crew.maxStress", message: "maxStress must be a number between 3 and 5" });
      }
      if (typeof crew.expertAbilityDescription !== "string" || crew.expertAbilityDescription.length === 0) {
        errors.push({ field: "crew.expertAbilityDescription", message: "expertAbilityDescription is required" });
      }
    }
  }

  // Primary category tag validation (optional)
  if (c.primaryTag != null) {
    const validPrimaryTags = ["Machine", "Organic", "Law", "Tech"];
    if (!validPrimaryTags.includes(c.primaryTag as string)) {
      errors.push({ field: "primaryTag", message: `primaryTag must be one of: ${validPrimaryTags.join(", ")}` });
    }
  }

  // Attribute tags validation (optional)
  if (c.attributeTags != null) {
    if (!Array.isArray(c.attributeTags)) {
      errors.push({ field: "attributeTags", message: "attributeTags must be an array" });
    } else {
      const validAttrTags = ["Hazard", "Persistent", "Fragile", "Heavy"];
      for (const tag of c.attributeTags as string[]) {
        if (!validAttrTags.includes(tag)) {
          errors.push({ field: "attributeTags", message: `Invalid attribute tag: ${tag}` });
        }
      }
    }
  }

  // Construction validation (optional, only for structures)
  if (c.construction != null) {
    if (c.type !== "structure") {
      errors.push({ field: "construction", message: "construction data is only valid for structure-type cards" });
    } else {
      const con = c.construction as Record<string, unknown>;
      if (con.completionTime != null && (typeof con.completionTime !== "number" || (con.completionTime as number) < 0)) {
        errors.push({ field: "construction.completionTime", message: "completionTime must be a non-negative number" });
      }
      if (con.resourceRequirement != null && typeof con.resourceRequirement === "object") {
        validateResourceCost(con.resourceRequirement as Record<string, unknown>, "construction.resourceRequirement", errors);
      }
    }
  }

  // Crisis-type cards must have crisis data
  if (c.type === "crisis" && (c.crisis == null || (c.crisis as Record<string, unknown>).isCrisis !== true)) {
    errors.push({ field: "crisis", message: "crisis data with isCrisis=true is required for crisis-type cards" });
  }

  // Crisis validation (optional)
  if (c.crisis != null) {
    const crisis = c.crisis as Record<string, unknown>;
    if (crisis.isCrisis === true) {
      if (crisis.proactiveCost != null && typeof crisis.proactiveCost === "object") {
        validateResourceCost(crisis.proactiveCost as Record<string, unknown>, "crisis.proactiveCost", errors);
      }
      if (crisis.reactiveEntropyPenalty != null && (typeof crisis.reactiveEntropyPenalty !== "number" || (crisis.reactiveEntropyPenalty as number) < 0)) {
        errors.push({ field: "crisis.reactiveEntropyPenalty", message: "reactiveEntropyPenalty must be a non-negative number" });
      }
    }
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
