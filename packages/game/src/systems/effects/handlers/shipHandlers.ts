import type { GameState, CardEffect, CardInstance, FactionId } from "@icebox/shared";
import { ALL_FACTION_IDS } from "@icebox/shared";
import { registerEffect, type EffectResult } from "../EffectRegistry";

registerEffect("modify-entropy", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const amount = (effect.params.amount as number) ?? 0;
  s.entropy = Math.max(0, Math.min(s.maxEntropy, s.entropy + amount));
  return {
    state: s,
    message: `Entropy ${amount >= 0 ? "+" : ""}${amount} (now ${s.entropy}).`,
  };
});

registerEffect("reduce-entropy", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const amount = (effect.params.amount as number) ?? 0;
  const reduction = Math.abs(amount);
  s.entropy = Math.max(0, s.entropy - reduction);
  return {
    state: s,
    message: `Entropy reduced by ${reduction} (now ${s.entropy}).`,
  };
});

/**
 * prevent-damage: Passive hull/entropy damage reduction.
 * Not resolved actively — checked by CryosleepEngine during entropy breakpoints.
 * Registered here so the registry knows about it.
 */
registerEffect("prevent-damage", (state: GameState, effect: CardEffect): EffectResult => {
  return { state, message: `Damage prevention active: ${effect.description}` };
});

registerEffect("extend-lifespan", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const amount = (effect.params.amount as number) ?? 0;
  const scope = effect.params.scope as string | undefined;
  const tierFilter = effect.params.tierFilter as number | undefined;
  let affected = 0;

  if (scope === "tableau") {
    for (const sector of s.ship.sectors) {
      for (const card of sector.installedCards) {
        if (tierFilter !== undefined && card.card.tier !== tierFilter) continue;
        if (card.remainingLifespan !== null) {
          card.remainingLifespan = Math.max(0, card.remainingLifespan + amount);
          affected++;
        }
      }
    }
  } else if (scope === "sector") {
    return { state, message: `Lifespan modifier active: ${effect.description}` };
  } else {
    const count = (effect.params.count as number) ?? 1;
    for (const sector of s.ship.sectors) {
      for (const card of sector.installedCards) {
        if (affected >= count) break;
        if (card.remainingLifespan !== null) {
          card.remainingLifespan = Math.max(0, card.remainingLifespan + amount);
          affected++;
        }
      }
      if (affected >= count) break;
    }
  }

  return {
    state: s,
    message: `${amount >= 0 ? "Extended" : "Reduced"} lifespan of ${affected} card(s) by ${Math.abs(amount)}.`,
  };
});

registerEffect("gain-presence", (state: GameState, effect: CardEffect): EffectResult => {
  const s = structuredClone(state);
  const amount = (effect.params.amount as number) ?? 0;
  const target = effect.params.target as string | undefined;
  const scope = effect.params.scope as string | undefined;

  // "dominant" target — boost dominant faction in sectors
  if (target === "dominant" || scope === "dominant") {
    for (const sector of s.ship.sectors) {
      if (sector.dominantFaction) {
        sector.factionPresence[sector.dominantFaction] = Math.max(
          0,
          sector.factionPresence[sector.dominantFaction] + amount
        );
      }
    }
    return {
      state: s,
      message: `Dominant faction presence ${amount >= 0 ? "+" : ""}${amount} in all sectors.`,
    };
  }

  // "all-factions" scope — apply to all factions globally
  if (scope === "all-factions") {
    for (const fid of ALL_FACTION_IDS) {
      s.globalFactionPresence[fid] = Math.max(0, s.globalFactionPresence[fid] + amount);
    }
    return { state: s, message: `All factions global presence ${amount >= 0 ? "+" : ""}${amount}.` };
  }

  // Specific faction
  if (effect.params.faction) {
    const faction = effect.params.faction as FactionId;

    // allSectors variant — add to each sector's faction presence
    if (effect.params.allSectors) {
      for (const sector of s.ship.sectors) {
        sector.factionPresence[faction] = Math.max(0, sector.factionPresence[faction] + amount);
      }
      return { state: s, message: `${faction} presence ${amount >= 0 ? "+" : ""}${amount} in all sectors.` };
    }

    // Default: global presence
    if (s.globalFactionPresence[faction] !== undefined) {
      s.globalFactionPresence[faction] = Math.max(0, s.globalFactionPresence[faction] + amount);
    }
    return { state: s, message: `${faction} global presence ${amount >= 0 ? "+" : ""}${amount}.` };
  }

  // Sector-specific presence for source card's sector
  if (scope === "sector" && effect.params.sectorIndex !== undefined) {
    const sectorIdx = effect.params.sectorIndex as number;
    const sector = s.ship.sectors[sectorIdx];
    if (sector) {
      // Apply to the sector's dominant faction or specified faction
      const factionId = (effect.params.targetFaction as FactionId) ?? sector.dominantFaction;
      if (factionId) {
        sector.factionPresence[factionId] = Math.max(0, sector.factionPresence[factionId] + amount);
      }
    }
    return { state: s, message: `Sector ${sectorIdx} presence change: ${amount}.` };
  }

  return { state: s, message: `Presence change: ${effect.description}` };
});
