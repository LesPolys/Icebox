import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { validateCard } from "../utils/validate-card.js";
import { ALL_FACTION_IDS } from "../types/faction.js";
import type { Card, EffectTiming, EffectType, SkillTag, PrimaryCategoryTag, AttributeTag } from "../types/card.js";

const coreSetPath = resolve(__dirname, "../../data/cards/core-set.json");
const coreSet = JSON.parse(readFileSync(coreSetPath, "utf8"));
const cards: Card[] = coreSet.cards;

describe("Card Pool — Per-Card Integrity", () => {
  it("should have 261 cards total", () => {
    expect(cards.length).toBe(261);
  });

  it("all IDs should be unique", () => {
    const ids = cards.map((c) => c.id);
    const uniqueIds = new Set(ids);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    expect(uniqueIds.size).toBe(cards.length);
  });

  it("all cards should pass structural validation", () => {
    const allErrors: Array<{ id: string; errors: Array<{ field: string; message: string }> }> = [];
    for (const card of cards) {
      const errors = validateCard(card);
      if (errors.length > 0) {
        allErrors.push({ id: card.id, errors });
      }
    }
    if (allErrors.length > 0) {
      const summary = allErrors
        .slice(0, 10)
        .map((e) => `${e.id}: ${e.errors.map((er) => er.message).join(", ")}`)
        .join("\n");
      expect.fail(`Validation errors in ${allErrors.length} cards:\n${summary}`);
    }
  });

  it("all transformInto targets should reference existing card IDs", () => {
    const allIds = new Set(cards.map((c) => c.id));
    const broken: string[] = [];
    for (const card of cards) {
      if (card.aging?.onDeath === "transform" && card.aging.transformInto) {
        if (!allIds.has(card.aging.transformInto)) {
          broken.push(`${card.id} -> ${card.aging.transformInto}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("all factionIcons should be valid faction IDs", () => {
    const validFactions = new Set([...ALL_FACTION_IDS]);
    const broken: string[] = [];
    for (const card of cards) {
      for (const icon of card.factionIcons || []) {
        if (!validFactions.has(icon as typeof ALL_FACTION_IDS[number])) {
          broken.push(`${card.id}: invalid factionIcon "${icon}"`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("all effect types should be valid EffectTypes", () => {
    const validTypes: Set<string> = new Set([
      "gain-resource", "spend-resource", "draw-cards", "add-junk", "remove-junk",
      "remove-card", "modify-cost", "shift-faction", "lock-market-slot",
      "extend-lifespan", "gain-presence",
      "prevent-damage", "peek-deck", "apply-stress",
    ]);
    const broken: string[] = [];
    for (const card of cards) {
      for (const effect of card.effects || []) {
        if (!validTypes.has(effect.type)) {
          broken.push(`${card.id}/${effect.id}: invalid type "${effect.type}"`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("all effect timings should be valid EffectTimings", () => {
    const validTimings: Set<string> = new Set([
      "on-play", "passive", "on-fallout", "on-discard", "on-sleep", "on-wake",
      "on-acquire", "on-death", "on-manned", "on-burnout",
    ]);
    const broken: string[] = [];
    for (const card of cards) {
      for (const effect of card.effects || []) {
        if (!validTimings.has(effect.timing)) {
          broken.push(`${card.id}/${effect.id}: invalid timing "${effect.timing}"`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("all effect condition types should be valid", () => {
    const validConditions: Set<string> = new Set([
      "faction-dominance", "resource-threshold", "sector-control",
      "card-in-tableau", "sleep-count",
    ]);
    const broken: string[] = [];
    for (const card of cards) {
      for (const effect of card.effects || []) {
        if (effect.condition && !validConditions.has(effect.condition.type)) {
          broken.push(`${card.id}/${effect.id}: invalid condition "${effect.condition.type}"`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("crew cards should have crew data", () => {
    const broken = cards
      .filter((c) => c.type === "crew" && !c.crew)
      .map((c) => c.id);
    expect(broken).toEqual([]);
  });

  it("location cards should have location data", () => {
    const broken = cards
      .filter((c) => c.type === "location" && !c.location)
      .map((c) => c.id);
    expect(broken).toEqual([]);
  });

  it("junk cards should have junk data", () => {
    const broken = cards
      .filter((c) => c.type === "junk" && !c.junk)
      .map((c) => c.id);
    expect(broken).toEqual([]);
  });

  it("hazard cards should have hazard data", () => {
    const broken = cards
      .filter((c) => c.type === "hazard" && !c.hazard)
      .map((c) => c.id);
    expect(broken).toEqual([]);
  });

  it("cost objects should only use valid resource keys", () => {
    const validResources = new Set(["matter", "energy", "data", "influence"]);
    const broken: string[] = [];
    for (const card of cards) {
      if (card.cost) {
        for (const key of Object.keys(card.cost)) {
          if (!validResources.has(key)) {
            broken.push(`${card.id}.cost: invalid key "${key}"`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("crisis cards should have valid crisis data and type 'crisis'", () => {
    const crisisCards = cards.filter((c) => c.crisis?.isCrisis);
    expect(crisisCards.length).toBe(8);
    for (const card of crisisCards) {
      expect(card.type).toBe("crisis");
      expect(card.crisis!.proactiveCost).toBeDefined();
    }
  });
});

describe("Card Pool — Coverage Requirements", () => {
  it("every EffectTiming should appear on at least 1 card", () => {
    const allTimings: EffectTiming[] = [
      "on-play", "passive", "on-fallout", "on-discard", "on-sleep", "on-wake",
      "on-acquire", "on-death", "on-manned", "on-burnout",
    ];
    const found = new Set<string>();
    for (const card of cards) {
      for (const effect of card.effects || []) {
        found.add(effect.timing);
      }
    }
    const missing = allTimings.filter((t) => !found.has(t));
    expect(missing).toEqual([]);
  });

  it("every EffectType should appear on at least 1 card", () => {
    const allTypes: EffectType[] = [
      "gain-resource", "spend-resource", "draw-cards", "add-junk", "remove-junk",
      "remove-card", "modify-cost", "shift-faction", "lock-market-slot",
      "extend-lifespan", "gain-presence",
      "prevent-damage", "peek-deck", "apply-stress",
    ];
    const found = new Set<string>();
    for (const card of cards) {
      for (const effect of card.effects || []) {
        found.add(effect.type);
      }
    }
    const missing = allTypes.filter((t) => !found.has(t));
    expect(missing).toEqual([]);
  });

  it("every condition type should appear on at least 1 card", () => {
    const allConditions = [
      "faction-dominance", "resource-threshold", "sector-control",
      "card-in-tableau", "sleep-count",
    ];
    const found = new Set<string>();
    for (const card of cards) {
      for (const effect of card.effects || []) {
        if (effect.condition) found.add(effect.condition.type);
      }
    }
    const missing = allConditions.filter((t) => !found.has(t));
    expect(missing).toEqual([]);
  });

  it("every SkillTag should appear on 4+ crew cards", () => {
    const skillCounts: Record<string, number> = {};
    for (const card of cards) {
      if (card.crew) {
        skillCounts[card.crew.skillTag] = (skillCounts[card.crew.skillTag] || 0) + 1;
      }
    }
    const allSkills: SkillTag[] = ["Engineer", "Botanist", "Orator", "Logic"];
    for (const skill of allSkills) {
      expect(skillCounts[skill] || 0).toBeGreaterThanOrEqual(4);
    }
  });

  it("every DecayCondition type should be used", () => {
    const allDecay = ["resource-below", "faction-dominance", "no-presence-in-sector", "sleep-count-above"];
    const found = new Set<string>();
    for (const card of cards) {
      for (const dc of card.aging?.decayConditions || []) {
        found.add(dc.type);
      }
    }
    const missing = allDecay.filter((t) => !found.has(t));
    expect(missing).toEqual([]);
  });

  it("every DeathOutcome should be used", () => {
    const allOutcomes = ["transform", "return-to-vault", "destroy"];
    const found = new Set<string>();
    for (const card of cards) {
      if (card.aging) found.add(card.aging.onDeath);
    }
    const missing = allOutcomes.filter((t) => !found.has(t));
    expect(missing).toEqual([]);
  });

  it("every PrimaryCategoryTag should be used", () => {
    const allTags: PrimaryCategoryTag[] = ["Machine", "Organic", "Law", "Tech"];
    const found = new Set<string>();
    for (const card of cards) {
      if (card.primaryTag) found.add(card.primaryTag);
    }
    const missing = allTags.filter((t) => !found.has(t));
    expect(missing).toEqual([]);
  });

  it("every AttributeTag should be used", () => {
    const allAttrs: AttributeTag[] = ["Hazard", "Persistent", "Fragile", "Heavy"];
    const found = new Set<string>();
    for (const card of cards) {
      for (const tag of card.attributeTags || []) {
        found.add(tag);
      }
    }
    const missing = allAttrs.filter((t) => !found.has(t));
    expect(missing).toEqual([]);
  });

  it("each non-neutral faction should have exactly 30 cards (including junk)", () => {
    // Note: faction junk cards have faction "neutral" but their IDs indicate their faction
    const factionPrefixes: Record<string, string> = {
      "void-forged": "vf-",
      "sowers": "sw-",
      "gilded": "gl-",
      "archival-core": "ac-",
      "the-flux": "fx-",
      "the-echoes": "ec-",
    };
    for (const [faction, prefix] of Object.entries(factionPrefixes)) {
      const count = cards.filter((c) => c.id.startsWith(prefix)).length;
      expect(count).toBe(30);
    }
  });

  it("locations should cover all 3 sectors", () => {
    const locationCards = cards.filter((c) => c.type === "location");
    const sectors = new Set(locationCards.map((c) => c.location!.sector));
    expect(sectors).toEqual(new Set([0, 1, 2]));
    expect(locationCards.length).toBe(12);
  });

  it("tier distribution should be roughly 45% T1, 40% T2, 15% T3", () => {
    const nonJunkNonLocation = cards.filter((c) => c.type !== "junk" && c.type !== "location");
    const t1 = nonJunkNonLocation.filter((c) => c.tier === 1).length;
    const t2 = nonJunkNonLocation.filter((c) => c.tier === 2).length;
    const t3 = nonJunkNonLocation.filter((c) => c.tier === 3).length;
    const total = nonJunkNonLocation.length;
    // Allow ±15% tolerance
    expect(t1 / total).toBeGreaterThan(0.3);
    expect(t1 / total).toBeLessThan(0.6);
    expect(t2 / total).toBeGreaterThan(0.25);
    expect(t2 / total).toBeLessThan(0.55);
    expect(t3 / total).toBeGreaterThan(0.05);
    expect(t3 / total).toBeLessThan(0.3);
  });
});

describe("Card Pool — Reference Integrity", () => {
  it("add-junk effect params should reference valid junk sources", () => {
    const validSources = new Set(["hull-breach", "tech-decay", "factional-coup"]);
    const broken: string[] = [];
    for (const card of cards) {
      for (const effect of card.effects || []) {
        if (effect.type === "add-junk") {
          const source = (effect.params as Record<string, unknown>).junkSource as string;
          if (!validSources.has(source)) {
            broken.push(`${card.id}/${effect.id}: invalid junkSource "${source}"`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("transformInto targets should be junk-type cards", () => {
    const junkIds = new Set(cards.filter((c) => c.type === "junk").map((c) => c.id));
    const broken: string[] = [];
    for (const card of cards) {
      if (card.aging?.onDeath === "transform" && card.aging.transformInto) {
        if (!junkIds.has(card.aging.transformInto)) {
          broken.push(`${card.id} transforms into "${card.aging.transformInto}" which is not a junk card`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("starter IDs should match expected pattern", () => {
    const starters = cards.filter((c) => c.id.startsWith("st-"));
    expect(starters.length).toBe(10);
    for (const s of starters) {
      expect(s.type).toBe("action");
      expect(s.faction).toBe("neutral");
    }
  });

  it("location sector indices should be valid (0, 1, 2)", () => {
    const locationCards = cards.filter((c) => c.type === "location");
    for (const loc of locationCards) {
      expect([0, 1, 2]).toContain(loc.location!.sector);
    }
  });

  it("construction data should have valid fields", () => {
    const constructionCards = cards.filter((c) => c.construction);
    expect(constructionCards.length).toBeGreaterThanOrEqual(18);
    for (const card of constructionCards) {
      expect(card.type).toBe("structure");
      expect(card.construction!.completionTime).toBeGreaterThanOrEqual(1);
      expect(typeof card.construction!.fastTrackable).toBe("boolean");
    }
  });
});
