# Icebox — Game Design Document

> A single-player legacy deckbuilder set aboard a generation ship on an interstellar journey.

---

## 1. Game Overview & Vision

**Icebox** is a single-player legacy deckbuilder set aboard a generation ship — an O'Neill cylinder hurtling through interstellar space. The player assumes the role of successive Watchkeepers, each waking from cryosleep to manage the ship's dwindling resources, navigate faction politics, and ensure the vessel survives long enough to reach its destination.

### Core Inspirations

| Game | Borrowed Concept |
|------|-----------------|
| Earthborn Rangers | Deck evolution over time; cards that grow, change, and die |
| Pax Pamir | Faction manipulation as a core mechanic; shifting loyalties |
| Oath | World state persistence between sessions; emergent narrative |

### Central Thesis

The world deck evolves through Cryosleep cycles. Factions rise and fall. Cards age and die. The ship transforms around the player. Each time the Watchkeeper enters cryosleep, the world moves on without them — and the ship they wake to is never the same one they left.

### Core Tension

Manage scarce resources to keep the ship alive while navigating the political landscape of six competing factions. Every decision spent shoring up the hull is a decision not spent consolidating political power. Every cycle spent asleep is a cycle the entropy clock advances unchecked.

---

## 2. Resource Matrix

Four resources govern the ship's systems. Each resource is paired with two factions and represents a domain of shipboard life.

| Resource | Abbreviation | Domain | Starting Value | Description |
|----------|-------------|--------|---------------|-------------|
| Matter | MAT | Physicality | 8 | Raw materials, hull integrity, physical goods |
| Energy | ENG | Vitality | 6 | Power generation, life support, thermal regulation |
| Data | DAT | Knowledge | 5 | Research archives, sensor networks, computational capacity |
| Influence | INF | Spirit | 5 | Political capital, social leverage, cultural authority |

### Resource Pairing Map

Each faction draws from exactly two resources, creating a web of dependencies:

```
        MAT
       / | \
      /  |  \
  Void  Sow  Gild
  Forged ers  ed
      \  |  /
  ENG--+--+--DAT
      /  |  \
  The   Arch  The
  Flux  Core  Echoes
      \  |  /
       \ | /
        INF
```

### Resource Domains During Cryosleep

Each resource protects against a specific entropy consequence:

| Resource | Entropy Domain | What Shortfall Causes |
|----------|---------------|----------------------|
| Matter | Hull integrity | Hull Breach junk cards added to Mandate Deck |
| Energy | Power systems | Tableau cards depowered |
| Data | Knowledge base | Low-tier cards removed from World Deck |
| Influence | Political stability | Factional coups and forced law changes |

---

## 3. Faction Design

Six factions compete for dominance aboard the ship. Each faction sits at the intersection of two resources, defining its identity and mechanical role.

### Faction Summary Table

| Faction | Resources | Color | Hex | Sector Affinity | Role |
|---------|-----------|-------|-----|-----------------|------|
| Void-Forged | MAT + ENG | Orange-Red | `#e85d3a` | Engineering | Industrial builders, hull maintainers, power engineers |
| Sowers | MAT + INF | Green | `#4caf50` | Biosphere | Bio-engineers, terraformers, life sustainers |
| Gilded | MAT + DAT | Amber | `#ffc107` | Habitat | Resource traders, material archivists, economists |
| Archival Core | ENG + DAT | Blue | `#2196f3` | Engineering | Scientists, data keepers, knowledge preservers |
| The Flux | ENG + INF | Purple | `#ab47bc` | Biosphere | Energy mystics, political agitators, revolutionaries |
| The Echoes | DAT + INF | Blue-Grey | `#78909c` | Habitat | Philosophers, ghost-watchers, memory keepers |

### Faction Profiles

**Void-Forged** (MAT + ENG)
The backbone of the ship. Void-Forged cards focus on structural integrity, power systems, and raw industrial output. When they dominate, the ship is physically sound — but politically neglected.
*Mechanical Identity*: Scrapping, Overclocking, High-Risk Repairs.

**Sowers** (MAT + INF)
Life finds a way. Sowers blend biological engineering with grassroots political organization. They grow food, cultivate ecosystems, and build communities. Their strength is sustainability; their weakness is technological stagnation.
*Mechanical Identity*: Growth, Resource Conversion, "Rooted" Presence.

**Gilded** (MAT + DAT)
Everything has a price. The Gilded control trade routes, material inventories, and the archives of physical wealth. They optimize and commodify. Under their rule, nothing is wasted — and nothing is free.
*Mechanical Identity*: Hoarding, Tolls/Taxes, Inventory Control.

**Archival Core** (ENG + DAT)
Keepers of the mission. The Archival Core preserves scientific knowledge, maintains sensor arrays, and guards the ship's computational infrastructure. They remember what others forget, but their detachment from politics makes them vulnerable.
*Mechanical Identity*: Market Locking, Mission Compliance, Precision.

**The Flux** (ENG + INF)
Change is the only constant. The Flux channels raw energy into political upheaval. They are mystics, agitators, and visionaries who believe the ship must transform to survive. Unpredictable but powerful.
*Mechanical Identity*: Market Jumping, Rapid Evolution, Instability.

**The Echoes** (DAT + INF)
The ship remembers. The Echoes are philosophers and historians who commune with the data-ghosts of previous generations. They wield knowledge as political leverage and believe the past holds the key to survival.
*Mechanical Identity*: History Preservation, Morale Buffs, Multi-Sleep Persistence.

### Sector Control Rules

When a faction achieves dominance in a sector (highest faction presence count), it imposes a passive rule that affects all activity in that sector.

| Dominant Faction | Sector Rule |
|-----------------|-------------|
| Void-Forged | All repair/structure costs in this sector: -1 Matter |
| Sowers | Gain +1 Influence when playing cards in this sector |
| Gilded | Market cards cost +1 of any resource (toll) |
| Archival Core | Cards in this sector cannot be removed by entropy effects |
| The Flux | Market slides 1 extra slot when this sector is active |
| The Echoes | Cards in this sector persist through 1 additional sleep cycle |

### Dominance Ties

When two or more factions are tied for presence in a sector, resolve in order:

1. Total card count affiliated with each tied faction in the sector.
2. Sum of paired resource totals for each tied faction.
3. Alphabetical by faction name.

### Global Laws

When a faction achieves ship-wide dominance (highest World Score during Cryosleep), it imposes a global law that affects the entire ship until the next Cryosleep cycle.

| Faction | Global Law | Effect |
|---------|-----------|--------|
| Void-Forged | Mandatory Hull Inspections | All structures cost -1 Matter but +1 Energy |
| Sowers | Communal Rationing | Gain +1 Matter and +1 Influence at start of each turn |
| Gilded | Trade Tariffs | All market purchases cost +1 Matter, but buying grants +1 Data |
| Archival Core | Data Compliance Protocol | Tech Decay threshold +2, but draw 1 fewer card per turn |
| The Flux | Accelerated Change | Market slides 1 extra slot per turn, but fallout grants +1 Energy |
| The Echoes | Ancestral Mandate | All tableau cards gain +1 lifespan, but Influence drain +1 per sleep |

---

## 4. Three-Deck System

Icebox uses a layered deck architecture that separates the world state from the player state. Cards flow between these decks according to game rules, creating a living ecosystem.

### Deck Architecture

```
+-------------------+
|      VAULT        |  Master pool of all cards.
| (World Deck Src)  |  Cards enter/leave the World Deck
+--------+----------+  from here during Cryosleep.
         |
         v
+-------------------+
|    WORLD DECK     |  Active card pool. Evolves each
|                   |  sleep cycle based on faction
+--------+----------+  dominance. Feeds the market.
         |
         v
+-------------------+
|  TRANSIT MARKET   |  Dual-row conveyor: 2 rows × 6
|  (Upper + Lower)  |  slots = 12 visible cards. Slides
+--------+----------+  left each turn.
         |
         v (buy)
+-------------------+
|   MANDATE DECK    |  Player's draw pile, hand,
|  (Player Deck)    |  and discard. Standard
+-------------------+  deckbuilder cycle.
```

### Vault (World Deck Source)

The Vault is the master pool containing every card in the game that is not currently in active play. During Cryosleep, cards flow between the Vault and the World Deck based on faction dominance and world evolution rules. The Vault represents the latent potential of the ship — technologies not yet rediscovered, factions not yet mobilized, structures not yet built.

### World Deck

The World Deck is the active pool of cards available to the ship's current state. It feeds the Transit Market and evolves each Cryosleep cycle. When a dominant faction gains power, it pulls cards from the Vault into the World Deck. When a faction weakens, its cards drain back to the Vault. The World Deck is the game's living world.

### Transit Market (Dual-Row Conveyor)

The Transit Market displays cards drawn from the World Deck in a dual-row conveyor belt layout:

```
+-------+-------+-------+-------+-------+-------+
| Upper | Upper | Upper | Upper | Upper | Upper |  ← UPPER ROW
|  [0]  |  [1]  |  [2]  |  [3]  |  [4]  |  [5]  |
+-------+-------+-------+-------+-------+-------+
| Lower | Lower | Lower | Lower | Lower | Lower |  ← LOWER ROW
|  [0]  |  [1]  |  [2]  |  [3]  |  [4]  |  [5]  |
+-------+-------+-------+-------+-------+-------+
  ← FALLOUT                          NEW CARDS →
```

- **Two rows** (upper and lower), **6 slots each** = **12 total visible cards**.
- At the end of each turn, cards in both rows slide one position to the left.
- Cards at position [0] in each row fall off, triggering on-fallout effects.
- New cards are drawn from the World Deck to fill empty rightmost slots.
- Gaps from purchased cards compact leftward before new cards enter.
- The player may purchase cards from any visible slot during their turn.

### Market Investment

Players can invest resources on a market slot instead of buying outright. Invested resources sit on the slot; when the card slides off the market, the investing faction (determined by the resource type) gains global presence proportional to the investment. This allows the player to influence faction dominance without purchasing cards.

### Mandate Deck (Player Deck)

The Mandate Deck is the player's personal deck, following standard deckbuilder conventions:

- **Draw Pile**: Face-down stack of undrawn cards.
- **Hand**: Cards currently available for play (hand size: 6).
- **Discard Pile**: Played and discarded cards awaiting reshuffle.
- When the draw pile is empty, the discard pile shuffles to form a new draw pile.

### Legacy Archive

Cards archived during the Succession phase persist permanently across sleep cycles. Archived cards are guaranteed to appear in the next Watchkeeper's Mandate Deck. Archive slots available: `min(8, sleepDuration + 1)`.

### Graveyard

Dead and destroyed cards. Cards that die from aging, are scrapped, or are explicitly destroyed end up here. Graveyard cards do not return to play.

---

## 5. Card Types & Tags

### Card Types

| Type | Description | Typical Placement |
|------|-------------|-------------------|
| Location | Defines a sector's identity and base abilities | Sector location slot (permanent) |
| Structure | Physical installations with ongoing effects; may require construction | Sector structure/institution slots |
| Institution | Social/political organizations with ongoing effects | Sector structure/institution slots |
| Action | One-time effects, played from hand | Resolved and discarded |
| Event | Triggered effects from market fallout or world events | Resolved contextually |
| Hazard | Market parasites with passive negative effects while in market; buying resolves them; fallout is catastrophic | Transit Market |
| Junk | Dead weight from entropy; clogs the deck (hull breach, tech decay, factional coup) | Mandate Deck (unwanted) |
| Crew | Attachment cards played onto structures; have stress and skill systems | Attached to structures in tableau |

### Tag System

Cards carry tags that enable effect targeting and filtering.

**Primary Category Tags** (what a card IS):

| Tag | Description |
|-----|-------------|
| Machine | Mechanical/industrial technology |
| Organic | Biological/living systems |
| Law | Legal/political frameworks |
| Tech | Digital/computational systems |

**Attribute Tags** (how a card behaves):

| Tag | Description |
|-----|-------------|
| Hazard | Dangerous element |
| Persistent | Resists removal |
| Fragile | Vulnerable to damage |
| Heavy | Resource-intensive |

Cards may also carry freeform string tags for additional filtering.

### Card Cost & Gain

- **Cost**: Resource cost to acquire from market or play from hand (`{ matter, energy, data, influence }`).
- **Resource Gain**: Immediate resource gain on play (optional).
- **Faction Icons**: Faction affiliations for World Score tallying during Cryosleep flush.

### Cryosleep Metadata

Every card carries metadata that determines how it interacts with the Cryosleep algorithm:

| Field | Type | Purpose |
|-------|------|---------|
| `inertiaContribution` | ResourceCost | What this card contributes to inertia resource checks |
| `decayVulnerability` | ResourceType[] | Which resource shortfalls can target this card for removal |
| `survivalPriority` | number | Tiebreaker: higher = harder to lose during sleep |
| `factionWeight` | number | How much this card counts toward World Score during flush |

---

## 6. Aging & Mortality

Cards in Icebox are mortal. Most cards carry a lifespan value measured in Cryosleep cycles. Each cycle, every card ages. When a card reaches the end of its lifespan, it dies.

### Lifespan

- Expressed as an integer representing remaining sleep cycles.
- Decremented by 1 during each Cryosleep Aging Tick (Phase 4).
- A lifespan of `null` indicates an immortal card (never ages).
- At lifespan 0, the card dies.

### Typical Lifespans by Tier

| Tier | Lifespan Range | Description |
|------|---------------|-------------|
| Tier 1 | 3-5 cycles | Common, easily replaced |
| Tier 2 | 5-8 cycles | Uncommon, moderate investment |
| Tier 3 | 8-12 cycles | Rare, significant investment |

### Decay Conditions

Cards can die before their lifespan expires if certain conditions are met. Decay conditions are checked during the Cryosleep Aging Tick.

| Condition | Trigger |
|-----------|---------|
| `resource-below` | A specified resource drops below a threshold |
| `faction-dominance` | A hostile faction controls the card's sector |
| `no-presence-in-sector` | The card's faction has zero presence in its sector |
| `sleep-count-above` | Total accumulated sleep cycles exceed a threshold |

### Death Outcomes

How a card dies determines what happens to it:

| Death Type | Outcome | Description |
|------------|---------|-------------|
| Old Age | Transform | Card becomes a weaker version or Junk card |
| Entropy | Return to Vault | Card re-enters the Vault, available for future World Deck evolution |
| Explicit Destroy | Removed to Graveyard | Card is permanently eliminated |

### Lifespan Extension

Lifespan extension is an emergent mechanic handled entirely through gameplay effects (card abilities, faction powers, sector bonuses). Cards do not have an inherent "extendable" property. This keeps the card data clean and pushes interesting decisions into play.

---

## 7. Ship Tableau — Three Sectors

The ship is divided into three sectors, each represented on the tableau. Sectors are the spatial foundation of the game — where cards are installed, where factions compete for dominance, and where passive rules shape gameplay.

### Sector Layout

```
+--------------------+--------------------+--------------------+
|    ENGINEERING     |      HABITAT       |     BIOSPHERE      |
|--------------------|--------------------|--------------------|
| [Location Card]    | [Location Card]    | [Location Card]    |
|                    |                    |                    |
| [Structure 1]     | [Structure 1]      | [Structure 1]      |
| [Structure 2]     | [Structure 2]      | [Structure 2]      |
| [Structure 3]     | [Structure 3]      | [Structure 3]      |
|                    |                    |                    |
| Faction Presence:  | Faction Presence:  | Faction Presence:  |
| VF: 3  AC: 2      | GI: 4  EC: 2      | SW: 3  FL: 1      |
| Dominant: V-Forged | Dominant: Gilded   | Dominant: Sowers   |
+--------------------+--------------------+--------------------+
```

### Sector Components

Each sector contains:

- **Location Card**: A single card that defines the sector's identity and grants a base ability. Always present; cannot be removed.
- **Structure/Institution Slots (x3)**: Up to three Structure or Institution cards may be installed in each sector.
- **Faction Presence Tracking**: The sum of all faction icons on installed cards in the sector. The faction with the highest presence is dominant.
- **Dominant Faction Rule**: The dominant faction imposes a passive rule on the sector (see Section 3).

### Faction Sector Affinities

Each faction has a "home" sector where they naturally concentrate:

| Sector | Index | Home Factions |
|--------|-------|---------------|
| Engineering | 0 | Void-Forged, Archival Core |
| Habitat | 1 | Gilded, The Echoes |
| Biosphere | 2 | Sowers, The Flux |

---

## 8. Crew System

Crew cards are a special card type that attach to structures in the tableau. They represent named individuals with skills and a finite tolerance for stress.

### Crew Properties

| Property | Description |
|----------|-------------|
| Skill Tag | Specialization: Engineer, Botanist, Orator, or Logic |
| Max Stress | Stress threshold before burnout (typically 3-5) |
| Expert Ability | Unique power unlocked when this crew mans a matching structure |
| Reassign Cost | Cost to move this crew to a different structure (default: 1 Influence) |

### Stress & Burnout

- Crew start at their **max stress** value.
- Stress **decrements toward 0** as the crew is used or exposed to hazards.
- When a hazard card falls off the market, all crew across all sectors take 1 stress.
- At stress 0, the crew **burns out** and is removed (triggers `on-burnout` effects).

### Crew Attachment

- One crew card may be attached to each structure in the tableau.
- Attaching crew costs nothing beyond playing the crew card.
- Reassigning crew to a different structure costs the crew's reassign cost (default: 1 Influence).
- Crew in the `attached` zone are considered part of the sector's tableau for presence calculations.

### Cryosleep Mortality

By default, all crew die during cryosleep. The player can pay to preserve them:

| Fate | Cost | Outcome |
|------|------|---------|
| Natural | Free | Crew dies (removed to graveyard) |
| Cryo-Pod | 3 Energy | Crew survives into next watch |
| Mentorship | 3 Influence | Crew dies, but a junior variant is added next watch |
| Digital Archive | 3 Data | Crew transforms into a [Tech] AI structure card |

---

## 9. Construction System

Structures with a `construction` field require build time before becoming active. While under construction, the card is placed face-down in its sector slot and provides no effects.

### Construction Properties

| Property | Description |
|----------|-------------|
| `completionTime` | Turns to auto-complete (0 or undefined = instant) |
| `resourceRequirement` | Additional resources that must be contributed to finish |
| `fastTrackable` | Whether this structure can be fast-tracked |
| `fastTrackCost` | Resource cost per turn skipped via fast-track |
| `fastTrackEntropy` | Entropy generated per turn skipped (default: 2) |

### Construction Flow

1. **Slot structure** → Card placed face-down as "Under Construction" in sector.
2. **Each turn start** → Construction progress advances automatically (1 turn tick).
3. **Contribute resources** → Player can pay toward `resourceRequirement` to accelerate completion.
4. **Fast-track** → Pay `fastTrackCost` per turn skipped; generates `fastTrackEntropy` entropy per skip.
5. **Completion** → Card flips face-up and becomes an active tableau card with full effects.

---

## 10. Entropy & Era System

### Unified Entropy Gauge

Entropy is tracked on a unified gauge from **0 to 40**. It represents the cumulative degradation of the ship's systems over time.

- **Starting value**: 0
- **Maximum**: 40
- **Per-cycle increase**: +3 entropy per Cryosleep cycle
- **Fast-track increase**: +2 entropy per construction turn skipped

### Entropy Breakpoints

At specific thresholds, deterministic consequences trigger during each Cryosleep cycle:

| Threshold | Effect | Description |
|-----------|--------|-------------|
| 10 | minor-decay | Depower 1 lowest-priority tableau card |
| 20 | power-fluctuations | Depower 2 additional tableau cards |
| 30 | structural-warnings | Add Hull Breach junk card to Mandate Deck |
| 40 | critical-failure | Hull damage (2× hullDamagePerJunk) + cascading system failures |

Breakpoints are **cumulative** — at entropy 30, thresholds 10, 20, and 30 all trigger.

### Resource Drain

Each Cryosleep cycle drains 1 of every resource:

```
Per cycle: -1 Matter, -1 Energy, -1 Data, -1 Influence
```

### Era System (Societal State Machine)

The ship's societal state transitions between four eras based on total reserves and entropy level. Eras impose modifiers on gameplay.

| Era | Reserves | Entropy | Description |
|-----|----------|---------|-------------|
| **Zenith** | High (≥16) | Low (≤10) | Golden age — prosperity breeds complacency |
| **Unraveling** | Low (≤10) | Low (≤10) | Decay begins — supply chains breaking |
| **Struggle** | Low (≤10) | High (≥20) | Survival mode — everyone focused on staying alive |
| **Ascension** | High (≥16) | High (≥20) | Engineering golden age under pressure |

### Era Modifiers

| Era | Market Slide Modifier | Maintenance Cost | Construction Time |
|-----|----------------------|-----------------|-------------------|
| Zenith | +1 (faster) | ×0.8 (cheaper) | Normal |
| Unraveling | Normal | ×1.2 (expensive) | +1 turns |
| Struggle | Normal | ×0.5 (cheaper) | +1 turns |
| Ascension | -1 (slower) | Normal | -2 turns (faster) |

**Starting Era**: Zenith.

---

## 11. Game Loop

A complete cycle of play consists of three phases: Active Watch, Succession, and Cryosleep. The player repeats this loop until the game ends.

```
CYCLE FLOW:

  +---------------+     +-------------+     +------------+
  | Active Watch  | --> | Succession  | --> | Cryosleep  |
  | (Player Turn) |     | (Plan/Save) |     | (Auto Sim) |
  +---------------+     +-------------+     +-----+------+
        ^                                         |
        |                                         |
        +-----------------------------------------+
                    Next Watchkeeper Wakes
```

### Phase 1 — Active Watch (Tactical Play)

The Active Watch is the player's turn — the period during which the Watchkeeper is awake and making decisions.

**Turn Structure:**

1. **Start of Turn**:
   - Increment turn number.
   - **Auto-Draw**: Draw 1 card from the Mandate Deck (or 6 on wake/first turn).
   - Re-power all tableau cards.
   - Advance all under-construction structures by 1 turn.

2. **Player Actions** (repeat as desired / affordable):
   - **Play a Card**: Play a card from hand, paying costs and resolving effects.
   - **Buy from Market**: Purchase a card from a market slot, paying its cost (+ hazard modifiers). Hazards/events are resolved and removed; other cards enter discard.
   - **Invest on Market Slot**: Place resources on a market slot for faction presence when the card slides off.
   - **Slot Structure/Institution**: Install a card into an open sector slot, paying costs. Structures with construction data begin face-down.
   - **Scrap Structure**: Remove an installed card from a sector; gain 50% of its cost as a resource refund.
   - **Draw Extra**: Spend 1 of any resource to draw 1 additional card.
   - **Attach Crew**: Play a crew card onto a structure in the tableau.
   - **Reassign Crew**: Move a crew card to a different structure (costs reassign cost, default 1 Influence).
   - **Contribute to Construction**: Pay resources toward a structure's construction requirement.
   - **Fast-Track Construction**: Pay fast-track cost to skip construction turns (generates entropy).
   - **Resolve Crisis**: Pay a crisis card's proactive cost to trigger Succession on your terms.
   - **Pass (End Turn)**: End your turn.

3. **End of Turn**:
   - Compact market (fill gaps from purchased cards).
   - Slide both market rows left by `baseSlidesPerTurn + extraSlides + eraSlideModifier` positions.
   - For each card that falls off (slot [0]): resolve on-fallout effects, apply stress to all crew.
   - Process claimed investments (faction gains presence).
   - Refill empty market slots from World Deck.

4. **Cryosleep Option**: At the end of any turn, the player may choose to enter Cryosleep, advancing to the Succession phase. Crisis cards can also force this transition.

**Turn Economy**: Resource-gated freeform. There are no action points. The player may take as many actions as they can afford with available resources. This creates tension between spending resources on immediate actions and conserving them for Cryosleep survival thresholds.

### Phase 2 — Succession (Legacy Planning)

Succession is the transition between waking life and cryosleep. The player prepares their legacy for the next Watchkeeper.

1. **Choose Sleep Duration**: Select a duration of 1 to 5 Cryosleep cycles. Longer sleep means more world evolution (risk and reward) and more archive slots.
2. **Archive Cards**:
   - Archive slots available = `min(8, sleepDuration + 1)`
   - Select cards from hand and/or discard to archive permanently. Archived cards are preserved across sleep cycles and guaranteed to be in the next Watchkeeper's Mandate Deck.
3. **Choose Crew Fates**: For each crew card in the tableau, choose a cryosleep fate (see Section 8).
4. **Shuffle Remainder**: All non-archived cards in hand and discard shuffle into the Mandate Deck draw pile.

### Phase 3 — Cryosleep (Automated World Evolution)

The ship evolves without the player. The Cryosleep Algorithm (see Section 12) runs once for each cycle of the chosen sleep duration. If the player chose 3 cycles, the algorithm executes 3 times in sequence.

---

## 12. Cryosleep Algorithm (Per Cycle)

The Cryosleep Algorithm executes once per sleep cycle. If the player chose a sleep duration of N, this algorithm runs N times in sequence. Each execution represents one cycle of time passing aboard the ship while the Watchkeeper sleeps.

### Phase 1 — Entropy Breakpoint Check

Evaluate the unified entropy gauge against breakpoints. Each crossed breakpoint triggers deterministic consequences (see Section 10: Entropy Breakpoints). Breakpoints are cumulative — all thresholds at or below the current entropy level fire.

### Phase 2 — The Flush (Market → World Score)

Clear the Transit Market. Tally the **World Score** from all flushed market cards plus the ship tableau plus existing global faction presence.

```
World Score = SUM( factionIcons × factionWeight ) per faction
```

For each card, count its faction icons and multiply by that faction's weight. The resulting per-faction scores determine standings for The Transformation.

### Phase 3 — The Transformation

The world evolves based on faction power.

1. **Dominant Faction Grows**: The faction with the highest World Score adds 2 cards from the Vault to the World Deck (higher-tier cards preferred).
2. **Weakest Faction Shrinks**: The faction with the lowest World Score loses 1 card from the World Deck (returned to Vault). Skipped if dominant and weakest are the same faction.
3. **Global Law Set**: The dominant faction's global law takes effect ship-wide.
4. **Dominance Recorded**: The dominant faction gains +1 century in dominance history (used for victory type calculation).
5. **Market Refill**: The Transit Market refills empty positions from the evolved World Deck.

**Tie Resolution** (for both dominant and weakest):
1. Total card count in World Deck affiliated with each tied faction.
2. Sum of paired resource totals for each tied faction.
3. Alphabetical by faction name.

### Phase 4 — Aging Tick

All cards with a lifespan value are aged.

1. **Decrement Lifespan**: Subtract 1 from the lifespan of every card in the Mandate Deck (draw pile, hand, discard), tableau, and World Deck.
2. **Check Decay Conditions**: Evaluate all decay conditions. Any card whose condition is met is flagged for death.
3. **Process Deaths**:
   - **Old Age** (lifespan = 0): Transform into designated weaker version or Junk card.
   - **Entropy Death** (decay condition met): Return to the Vault.
   - **Explicit Destroy**: Remove to graveyard.
   - Transformed cards are placed in the zone where the dead card was (discard pile for mandate cards, sector for tableau cards).

### Phase 5 — Crew Mortality

Process all crew cards in the tableau according to the player's chosen fate plan (see Section 8: Cryosleep Mortality). If no fate was chosen, crew die naturally. If the player cannot afford a chosen fate, the crew dies instead.

### Phase 6 — Entropy Escalation

The entropy clock advances.

- Entropy += 3 (`ENTROPY_PER_SLEEP_CYCLE`)
- All resources drain by 1 (`RESOURCE_DRAIN_PER_CYCLE`)
- Total sleep cycles incremented
- Years passed += 100 (`YEARS_PER_SLEEP`)

### Phase 7 — Era Transition

Evaluate whether the ship's era should change based on current reserves and entropy (see Section 10: Era System). If a transition occurs, new era modifiers take effect immediately.

After all phases: update ship presence scores and check victory/defeat conditions. If defeat is triggered, stop processing further cycles.

---

## 13. Hazard & Market Effects

Hazard cards exert passive negative pressure while they sit in the Transit Market. These effects are resolved by the Market Effect system each turn.

### Passive Hazard Effects

| Effect Type | Description |
|-------------|-------------|
| **Cost Modifiers** | Increase the resource cost of market purchases (e.g., +1 Matter to all buys) |
| **Action Disables** | Prevent specific player actions (draw-extra, play-action, gain-influence) |
| **Market Locks** | Lock specific slots (prevents buying from those positions) |
| **Extra Slides** | Cause additional market slides per turn (accelerates fallout) |

### Hazard Resolution

- **Buy**: Purchasing a hazard from the market resolves it. Depending on `hazard.onBuy`, the card is either destroyed or returned to the Vault.
- **Fallout**: When a hazard slides off the market, its `on-fallout` effects trigger (typically catastrophic).
- **Stress**: When any hazard falls off, all crew in all sectors take 1 stress.

---

## 14. Crisis System

Crisis cards are special event/hazard cards that can trigger the Cryosleep transition, pulling the player out of Active Watch.

### Crisis Properties

| Property | Description |
|----------|-------------|
| `isCrisis` | Boolean flag marking this card as a crisis trigger |
| `proactiveCost` | Resource cost to resolve the crisis on the player's terms |
| `reactiveEntropyPenalty` | Entropy added when the crisis forces reactive sleep (falls off at slot [0]) |

### Resolution Paths

- **Proactive**: The player pays the `proactiveCost` to resolve the crisis. The card is removed from the market and destroyed. The game transitions to Succession with no penalty.
- **Reactive**: If the crisis card slides off the market (reaches slot [0] and falls out), cryosleep is forced. The `reactiveEntropyPenalty` is applied and the game transitions to Cryosleep with less player control.

---

## 15. Victory & Defeat

### Defeat Conditions

The game ends in defeat if either condition is met:

| Condition | Trigger | Description |
|-----------|---------|-------------|
| **Structural Failure** | Hull Integrity ≤ 0% | The hull has failed. The void claims the ship. |
| **Social Collapse** | Any faction reaches ≥90% of total global presence | A faction has staged a coup. The Commanding Mandate is dissolved. |

### Victory Condition

The game is won when:
- **Years Passed** ≥ 1000
- **Hull Integrity** > 0%

### Victory Types

The type of civilization that emerges is determined by which faction accumulated the most centuries of dominance across the journey:

| Dominant Faction | Victory Type | Description |
|-----------------|-------------|-------------|
| Void-Forged | Survivalist | A civilization forged in hardship |
| Sowers | Biological Utopia | Life thrives aboard the vessel |
| Gilded | Corporate State | Commerce rules all |
| Archival Core | Preserved Heritage | Knowledge endures |
| The Flux | Evolutionary Anarchy | Constant change became the way |
| The Echoes | Ancestral Legacy | The past shapes the future |

---

## 16. Effect System

### Effect Timings

Effects trigger at specific moments in the game:

| Timing | When |
|--------|------|
| `on-play` | When played from hand or bought from market |
| `passive` | Continuous while in market or tableau |
| `on-fallout` | When a card slides off the market |
| `on-discard` | When discarded from hand/tableau |
| `on-sleep` | Triggers during cryosleep |
| `on-wake` | Triggers when waking from cryosleep |
| `on-acquire` | When purchased from market |
| `on-death` | When this card dies (aging/decay) |
| `on-manned` | When a crew member is attached to this structure |
| `on-burnout` | When a crew member reaches 0 stress |

### Effect Types

| Type | Description | Implementation |
|------|-------------|----------------|
| `gain-resource` | Gain a specific resource | Active |
| `spend-resource` | Spend/drain a resource (or depower cards) | Active |
| `draw-cards` | Draw N cards from mandate deck | Active |
| `add-junk` | Add junk cards to mandate deck | Partial (cryosleep only) |
| `remove-junk` | Remove junk from hand/discard | Active |
| `remove-card` | Targeted card removal | Placeholder |
| `modify-cost` | Alter purchase costs | Passive (MarketEffectResolver) |
| `shift-faction` | Market slides, vault additions, sector dominance changes | Active |
| `lock-market-slot` | Lock/disable market features | Passive (MarketEffectResolver) |
| `modify-entropy` | Add/subtract entropy | Active |
| `reduce-entropy` | Reduce entropy | Active |
| `extend-lifespan` | Add/subtract lifespan from cards | Active |
| `gain-presence` | Modify faction presence | Active |
| `prevent-damage` | Shield from damage | Passive (not fully implemented) |
| `peek-deck` | Reveal top N of world deck | Passive (UI layer) |
| `apply-stress` | Apply stress to crew | Active |

### Effect Conditions

Effects can be gated by conditions that must be true for the effect to fire:

| Condition | Evaluation |
|-----------|-----------|
| `resource-threshold` | A resource is above/below a threshold |
| `sleep-count` | Total sleep cycles ≥ threshold |
| `entropy-above` | Entropy gauge ≥ threshold |
| `faction-dominance` | A specific faction controls a sector (basic evaluation) |
| `sector-control` | Player has control of a sector (basic evaluation) |
| `card-in-tableau` | A specific card is installed (basic evaluation) |

> **Note**: `faction-dominance`, `sector-control`, and `card-in-tableau` conditions currently pass by default and need full implementation.

---

## 17. Design Decisions

Key design choices and their rationale.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Turn Economy | Resource-gated freeform (no action points) | Emphasizes resource tension; every action has an opportunity cost measured in the same currency as survival |
| Draw Mechanic | Auto-draw 1 + spend resources for extra draws | Guarantees forward momentum while rewarding resource investment in card access |
| Faction Power | Sector control (dominant faction per sector) + global laws | Localizes faction influence to spatial decisions while also creating ship-wide consequences |
| Legacy / Archive | Sleep-duration-based slot count | Ties the risk/reward of long sleep to the legacy planning decision |
| Sleep Risk | Higher entropy BUT more transformation cycles | Long sleep is a gamble: more world evolution means more opportunity but also more entropy damage |
| Card Aging | Lifespan + condition-based decay; death via transform/degrade | Cards are mortal; the world naturally decays, forcing the player to continuously adapt |
| Lifespan Extension | Gameplay effects only, not a card property | Keeps card data clean; extension is an emergent reward for good play, not a static stat |
| Entropy System | Unified gauge (0-40) with breakpoints | Simpler than per-resource thresholds; creates clear escalation stages the player can plan around |
| Dual-Row Market | Two rows of 6 slots (12 visible cards) | More strategic depth than single row; allows hazard targeting, row-specific effects, and richer investment decisions |
| Era System | 4-state machine based on reserves + entropy | Creates distinct gameplay phases that feel different; rewards adaptation |
| Crew System | Stress-based mortality with sleep fate choices | Creates attachment to individual cards; meaningful decisions during succession |
| Scrap Mechanic | 50% refund of original cost | Gives players an escape valve for bad tableau decisions without being free |

---

## 18. Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Game Engine | Phaser 3 |
| Language | TypeScript |
| Build Tool | Vite |
| Architecture | Monorepo (yarn workspaces) |

### Package Structure

```
icebox/
  packages/
    shared/       @icebox/shared    Types, constants, utilities, card data (JSON)
    game/         @icebox/game      Phaser client + game logic systems
    editor/       @icebox/editor    Card editor tool for design/balancing
```

**@icebox/shared**: Contains all type definitions, interfaces, card data (loaded from JSON), game constants, and shared utilities. Zero runtime dependencies on Phaser or any rendering library.

**@icebox/game**: The Phaser 3 client application. Contains both rendering/UI code AND all game logic systems. Systems are implemented as pure TypeScript functions with zero Phaser imports, located in `src/systems/`. Scenes in `src/scenes/` coordinate systems and handle rendering.

**@icebox/editor**: A standalone card editor tool for designing and balancing cards. Uses shared types and data to ensure consistency with the game client.

### Game Logic Systems

All game logic lives in `packages/game/src/systems/` as pure functions:

| System | File | Responsibility |
|--------|------|----------------|
| GameStateManager | `GameStateManager.ts` | State creation, serialization, card instance creation |
| TurnManager | `TurnManager.ts` | Active Watch turn flow, action dispatch |
| CryosleepEngine | `CryosleepEngine.ts` | Full 7-phase sleep algorithm, legacy finalization |
| MarketManager | `MarketManager.ts` | Slide, compact, fill, acquire, invest operations |
| DeckManager | `DeckManager.ts` | Draw, discard, shuffle |
| ResourceManager | `ResourceManager.ts` | Resource transactions (gain, spend, drain) |
| FactionTracker | `FactionTracker.ts` | Presence calculation, world score, dominance resolution |
| EraEngine | `EraEngine.ts` | Era state transitions and modifier application |
| EffectResolver | `EffectResolver.ts` | Card effect execution and condition evaluation |
| MarketEffectResolver | `MarketEffectResolver.ts` | Passive hazard effects (cost mods, action locks, slides) |
| FalloutHandler | `FalloutHandler.ts` | Market slide-off consequences |
| CrewManager | `CrewManager.ts` | Crew attachment, reassignment, stress, burnout |
| ConstructionManager | `ConstructionManager.ts` | Build time, resource contribution, fast-tracking |
| AgingManager | `AgingManager.ts` | Lifespan tracking, decay conditions, death processing |
| VictoryConditions | `VictoryConditions.ts` | Win/loss checks |
| SaveManager | `SaveManager.ts` | localStorage persistence with version checking |

### Design Principles

**Pure Game Systems**: All game logic is implemented as pure TypeScript functions with zero Phaser imports. This guarantees:

- Full unit testability without mocking a game engine.
- Clean separation between simulation and presentation.
- Potential for headless simulation runs (AI testing, balance verification).

**Immutable State**: Game state is treated as immutable. Systems clone state via `structuredClone()` before mutation and return new state objects.

**Card Data**: All card definitions are stored in JSON files (`core-set.json`) and validated against TypeScript interfaces at build time. Card data is never hardcoded in game logic.

---

## 19. Appendix: Quick Reference

### Starting State

| Parameter | Value |
|-----------|-------|
| Matter | 8 |
| Energy | 6 |
| Data | 5 |
| Influence | 5 |
| Hull Integrity | 100% |
| Entropy | 0 |
| Max Entropy | 40 |
| Era | Zenith |
| Years Passed | 0 |
| Market Size | 12 cards (2 rows × 6) |
| Sector Count | 3 (Engineering, Habitat, Biosphere) |
| Slots per Sector | 3 structure/institution |
| Sleep Duration Range | 1-5 cycles |
| Archive Slots Formula | `min(8, sleepDuration + 1)` |

### Game Rules (Tunable Defaults)

| Rule | Default | Description |
|------|---------|-------------|
| Hand Size | 6 | Maximum cards in hand |
| Draw Per Turn | 1 | Auto-draw at turn start |
| Wake Draw Count | 6 | Cards drawn on first turn after waking |
| Extra Draw Cost | 1 | Resource cost per extra card drawn |
| Scrap Refund Rate | 50% | Fraction of cost returned when scrapping |
| Base Slides Per Turn | 1 | Market slides at end of turn (before modifiers) |
| Tech Decay Min Tier | 2 | Minimum card tier vulnerable to data shortfall removal |
| Social Collapse Threshold | 90% | Faction presence ratio that triggers defeat |
| Hull Damage Per Junk | 10 | Hull integrity lost per junk from inertia failure |
| Starting Deck Size | **⚠ Discrepancy**: `STARTING_MANDATE_DECK_SIZE = 15` vs `createDefaultRules().startingDeckSize = 8` | Needs reconciliation |

### Cryosleep Constants

| Constant | Value |
|----------|-------|
| Entropy Per Sleep Cycle | 3 |
| Entropy Per Fast-Track Turn | 2 |
| Resource Drain Per Cycle | 1 each (MAT, ENG, DAT, INF) |
| Years Per Sleep Cycle | 100 |
| Max Years (Victory) | 1000 |
| Dominant Faction Cards Added/Cycle | 2 |
| Weakest Faction Cards Removed/Cycle | 1 |

### Crew Costs

| Fate | Cost |
|------|------|
| Cryo-Pod | 3 Energy |
| Mentorship | 3 Influence |
| Digital Archive | 3 Data |
| Reassignment | 1 Influence (default) |

---

## 20. Color Palette

The visual identity of Icebox uses a muted, industrial palette with selective accent colors.

| Name | Hex | Swatch | Usage |
|------|-----|--------|-------|
| Dusty Mauve | `#B23B4E` | ![#B23B4E](https://via.placeholder.com/16/B23B4E/B23B4E) | Alerts, warnings, critical thresholds |
| Eggshell | `#E3E4D4` | ![#E3E4D4](https://via.placeholder.com/16/E3E4D4/E3E4D4) | Primary text, light backgrounds |
| Charcoal Blue | `#2B556B` | ![#2B556B](https://via.placeholder.com/16/2B556B/2B556B) | Secondary UI elements, borders |
| Coffee Bean | `#1B111B` | ![#1B111B](https://via.placeholder.com/16/1B111B/1B111B) | Deep backgrounds, card backs |
| Charcoal Blue 2 | `#2B475B` | ![#2B475B](https://via.placeholder.com/16/2B475B/2B475B) | Alternate dark panels, depth layering |
| Dark Cyan | `#539593` | ![#539593](https://via.placeholder.com/16/539593/539593) | Positive states, resource gains |
| Midnight Violet | `#261F31` | ![#261F31](https://via.placeholder.com/16/261F31/261F31) | Overlay backgrounds, modal panels |
| Carbon Black | `#212121` | ![#212121](https://via.placeholder.com/16/212121/212121) | Primary background, void space |
| Vintage Grape | `#4E4553` | ![#4E4553](https://via.placeholder.com/16/4E4553/4E4553) | Muted UI elements, disabled states |
| Pearl Aqua | `#A5CFC5` | ![#A5CFC5](https://via.placeholder.com/16/A5CFC5/A5CFC5) | Highlights, selection states, focus rings |

### Faction Colors (Distinct from UI Palette)

| Faction | Hex |
|---------|-----|
| Void-Forged | `#e85d3a` |
| Sowers | `#4caf50` |
| Gilded | `#ffc107` |
| Archival Core | `#2196f3` |
| The Flux | `#ab47bc` |
| The Echoes | `#78909c` |
