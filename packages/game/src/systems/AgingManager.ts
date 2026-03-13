import type {
  CardInstance,
  FactionId,
  ResourceTotals,
  SectorState,
  Card,
} from "@icebox/shared";

/**
 * Pure logic for the card aging and mortality system.
 * Processes lifespan ticks and decay condition checks during cryosleep.
 */

export interface DeathEvent {
  card: CardInstance;
  cause: "lifespan" | "decay-condition";
  conditionDescription?: string;
  outcome: "transform" | "return-to-vault" | "destroy";
  transformInto?: string; // card ID to become
}

export interface AgingResult {
  /** Cards that survived this cycle */
  survivors: CardInstance[];
  /** Cards that died this cycle */
  deaths: DeathEvent[];
  /** New cards created from transformations */
  transformedCards: CardInstance[];
}

/**
 * Tick aging for a set of card instances.
 * Decrements lifespan and checks decay conditions.
 */
export function processAgingTick(
  cards: CardInstance[],
  gameContext: AgingContext
): AgingResult {
  const survivors: CardInstance[] = [];
  const deaths: DeathEvent[] = [];
  const transformedCards: CardInstance[] = [];

  for (const cardInst of cards) {
    // Skip immortal cards (null lifespan)
    if (cardInst.remainingLifespan === null) {
      survivors.push(cardInst);
      continue;
    }

    // Decrement lifespan
    cardInst.remainingLifespan = Math.max(0, cardInst.remainingLifespan - 1);

    // Check lifespan death
    if (cardInst.remainingLifespan <= 0) {
      deaths.push({
        card: cardInst,
        cause: "lifespan",
        outcome: cardInst.card.aging.onDeath,
        transformInto: cardInst.card.aging.transformInto,
      });
      continue;
    }

    // Check decay conditions
    const failedCondition = checkDecayConditions(cardInst, gameContext);
    if (failedCondition) {
      deaths.push({
        card: cardInst,
        cause: "decay-condition",
        conditionDescription: failedCondition,
        outcome: "return-to-vault", // condition deaths always return to vault
      });
      continue;
    }

    survivors.push(cardInst);
  }

  return { survivors, deaths, transformedCards };
}

/**
 * Context needed to evaluate decay conditions.
 */
export interface AgingContext {
  resources: ResourceTotals;
  sectorDominance: Record<number, FactionId | null>;
  sectorPresence: Record<number, Record<FactionId, number>>;
  totalSleepCycles: number;
  /** Map of card instance IDs to their sector index (-1 if not in tableau) */
  cardSectorMap: Map<string, number>;
}

/**
 * Check all decay conditions for a card instance.
 * Returns the description of the first failed condition, or null if all pass.
 */
function checkDecayConditions(
  cardInst: CardInstance,
  ctx: AgingContext
): string | null {
  for (const condition of cardInst.card.aging.decayConditions) {
    switch (condition.type) {
      case "resource-below": {
        const resource = condition.params.resource as keyof ResourceTotals;
        const threshold = condition.params.threshold as number;
        if (ctx.resources[resource] < threshold) {
          return condition.description;
        }
        break;
      }

      case "faction-dominance": {
        const rivalFaction = condition.params.rivalFaction as FactionId;
        const sectorIdx = ctx.cardSectorMap.get(cardInst.instanceId) ?? -1;
        if (sectorIdx >= 0 && ctx.sectorDominance[sectorIdx] === rivalFaction) {
          return condition.description;
        }
        break;
      }

      case "no-presence-in-sector": {
        const faction = condition.params.faction as FactionId;
        const sectorIdx = ctx.cardSectorMap.get(cardInst.instanceId) ?? -1;
        if (sectorIdx >= 0) {
          const presence = ctx.sectorPresence[sectorIdx]?.[faction] ?? 0;
          if (presence <= 0) {
            return condition.description;
          }
        }
        break;
      }

      case "sleep-count-above": {
        const threshold = condition.params.threshold as number;
        if (ctx.totalSleepCycles > threshold) {
          return condition.description;
        }
        break;
      }
    }
  }

  return null;
}

/**
 * Build a card-to-sector mapping for decay condition evaluation.
 */
export function buildCardSectorMap(
  sectors: SectorState[]
): Map<string, number> {
  const map = new Map<string, number>();

  for (const sector of sectors) {
    if (sector.location) {
      map.set(sector.location.instanceId, sector.index);
    }
    for (const card of sector.installedCards) {
      map.set(card.instanceId, sector.index);
    }
  }

  return map;
}
