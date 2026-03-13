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

---

## 3. Faction Design

Six factions compete for dominance aboard the ship. Each faction sits at the intersection of two resources, defining its identity and mechanical role.

### Faction Summary Table

| Faction | Resources | Color | Hex | Role |
|---------|-----------|-------|-----|------|
| Void-Forged | MAT + ENG | Orange-Red | `#e85d3a` | Industrial builders, hull maintainers, power engineers |
| Sowers | MAT + INF | Green | `#4caf50` | Bio-engineers, terraformers, life sustainers |
| Gilded | MAT + DAT | Amber | `#ffc107` | Resource traders, material archivists, economists |
| Archival Core | ENG + DAT | Blue | `#2196f3` | Scientists, data keepers, knowledge preservers |
| The Flux | ENG + INF | Purple | `#ab47bc` | Energy mystics, political agitators, revolutionaries |
| The Echoes | DAT + INF | Blue-Grey | `#78909c` | Philosophers, ghost-watchers, memory keepers |

### Faction Profiles

**Void-Forged** (MAT + ENG)
The backbone of the ship. Void-Forged cards focus on structural integrity, power systems, and raw industrial output. When they dominate, the ship is physically sound — but politically neglected.

**Sowers** (MAT + INF)
Life finds a way. Sowers blend biological engineering with grassroots political organization. They grow food, cultivate ecosystems, and build communities. Their strength is sustainability; their weakness is technological stagnation.

**Gilded** (MAT + DAT)
Everything has a price. The Gilded control trade routes, material inventories, and the archives of physical wealth. They optimize and commodify. Under their rule, nothing is wasted — and nothing is free.

**Archival Core** (ENG + DAT)
Keepers of the mission. The Archival Core preserves scientific knowledge, maintains sensor arrays, and guards the ship's computational infrastructure. They remember what others forget, but their detachment from politics makes them vulnerable.

**The Flux** (ENG + INF)
Change is the only constant. The Flux channels raw energy into political upheaval. They are mystics, agitators, and visionaries who believe the ship must transform to survive. Unpredictable but powerful.

**The Echoes** (DAT + INF)
The ship remembers. The Echoes are philosophers and historians who commune with the data-ghosts of previous generations. They wield knowledge as political leverage and believe the past holds the key to survival.

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
|  TRANSIT MARKET   |  6 visible cards. Slides left
|    (Conveyor)     |  each turn. Leftmost falls out
+--------+----------+  with on-fallout triggers.
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

### Transit Market (Conveyor)

The Transit Market displays 6 face-up cards drawn from the World Deck. It operates as a conveyor belt:

- Cards are arranged left to right (position 1 through 6).
- At the end of each turn, cards slide one position to the left.
- The card at position 1 falls off the conveyor, triggering any on-fallout effects.
- A new card is drawn from the World Deck to fill position 6.
- The player may purchase cards from any market position during their turn.

### Mandate Deck (Player Deck)

The Mandate Deck is the player's personal deck, following standard deckbuilder conventions:

- **Draw Pile**: Face-down stack of undrawn cards.
- **Hand**: Cards currently available for play.
- **Discard Pile**: Played and discarded cards awaiting reshuffle.
- When the draw pile is empty, the discard pile shuffles to form a new draw pile.

---

## 5. Card Types & Aging System

### Card Types

| Type | Description | Typical Placement |
|------|-------------|-------------------|
| Location | Defines a sector's identity and base abilities | Sector location slot |
| Structure | Physical installations with ongoing effects | Sector structure/institution slots |
| Institution | Social/political organizations with ongoing effects | Sector structure/institution slots |
| Action | One-time effects, played from hand | Resolved and discarded |
| Event | Triggered effects from market fallout or world events | Resolved contextually |
| Junk | Dead weight from entropy; clogs the deck | Mandate deck (unwanted) |

### The Aging System

Cards in Icebox are mortal. Most cards carry a lifespan value measured in Cryosleep cycles. Each cycle, every card ages. When a card reaches the end of its lifespan, it dies.

#### Lifespan

- Expressed as an integer representing remaining sleep cycles.
- Decremented by 1 during each Cryosleep Aging Tick (Phase 4).
- A lifespan of `null` indicates an immortal card (never ages).
- At lifespan 0, the card dies.

#### Typical Lifespans by Tier

| Tier | Lifespan Range | Description |
|------|---------------|-------------|
| Tier 1 | 3-5 cycles | Common, easily replaced |
| Tier 2 | 5-8 cycles | Uncommon, moderate investment |
| Tier 3 | 8-12 cycles | Rare, significant investment |

#### Decay Conditions

Cards can die before their lifespan expires if certain conditions are met. Decay conditions are checked during the Cryosleep Aging Tick.

| Condition | Trigger |
|-----------|---------|
| `resource-below` | A specified resource drops below a threshold |
| `faction-dominance` | A hostile faction controls the card's sector |
| `no-presence-in-sector` | The card's faction has zero presence in its sector |
| `sleep-count-above` | Total accumulated sleep cycles exceed a threshold |

#### Death Outcomes

How a card dies determines what happens to it:

| Death Type | Outcome | Description |
|------------|---------|-------------|
| Old Age | Transform | Card becomes a weaker version or Junk card |
| Entropy | Return to Vault | Card re-enters the Vault, available for future World Deck evolution |
| Explicit Destroy | Removed from Game | Card is permanently eliminated |

#### Lifespan Extension

Lifespan extension is an emergent mechanic handled entirely through gameplay effects (card abilities, faction powers, sector bonuses). Cards do not have an inherent "extendable" property. This keeps the card data clean and pushes interesting decisions into play.

---

## 6. Ship Tableau — Three Sectors

The ship is divided into three sectors, each represented on the tableau. Sectors are the spatial foundation of the game — where cards are installed, where factions compete for dominance, and where passive rules shape gameplay.

### Sector Layout

```
+--------------------+--------------------+--------------------+
|    ENGINEERING     |      HABITAT       |      COMMAND       |
|--------------------|--------------------|--------------------|
| [Location Card]    | [Location Card]    | [Location Card]    |
|                    |                    |                    |
| [Structure 1]     | [Structure 1]      | [Structure 1]      |
| [Structure 2]     | [Structure 2]      | [Structure 2]      |
| [Structure 3]     | [Structure 3]      | [Structure 3]      |
|                    |                    |                    |
| Faction Presence:  | Faction Presence:  | Faction Presence:  |
| VF: 3  SW: 1      | SW: 4  EC: 2      | AC: 3  FL: 1      |
| Dominant: V-Forged | Dominant: Sowers   | Dominant: Arch.C.  |
+--------------------+--------------------+--------------------+
```

### Sector Components

Each sector contains:

- **Location Card**: A single card that defines the sector's identity and grants a base ability. Always present; cannot be removed.
- **Structure/Institution Slots (x3)**: Up to three Structure or Institution cards may be installed in each sector.
- **Faction Presence Tracking**: The sum of all faction icons on installed cards in the sector. The faction with the highest presence is dominant.
- **Dominant Faction Rule**: The dominant faction imposes a passive rule on the sector (see below).

### Sector Control Rules

When a faction achieves dominance in a sector (highest faction presence count), it imposes a passive rule that affects all activity in that sector.

| Dominant Faction | Sector Rule | Effect |
|-----------------|-------------|--------|
| Void-Forged | Structural Efficiency | Repair and structure installation costs -1 Matter |
| Sowers | Grassroots Momentum | +1 Influence gained when playing cards in this sector |
| Gilded | Trade Toll | Market cards adjacent to this sector cost +1 to purchase |
| Archival Core | Preservation Field | Cards installed in this sector are immune to entropy decay |
| The Flux | Accelerated Flow | Transit Market slides 1 extra position per turn |
| The Echoes | Temporal Persistence | Cards in this sector persist 1 extra Cryosleep cycle |

### Dominance Ties

When two or more factions are tied for presence in a sector, resolve in order:

1. Total card count affiliated with each tied faction in the sector.
2. Sum of paired resource totals for each tied faction.
3. Alphabetical by faction name.

---

## 7. Game Loop

A complete cycle of play consists of three phases: Active Watch, Succession, and Cryosleep. The player repeats this loop until the game ends.

### Phase 1 — Active Watch (Tactical Play)

The Active Watch is the player's turn — the period during which the Watchkeeper is awake and making decisions.

**Turn Structure:**

1. **Auto-Draw**: Draw 1 card from the Mandate Deck automatically.
2. **Player Actions** (repeat as desired / affordable):
   - **Play a Card**: Play a card from hand, paying any costs and resolving effects.
   - **Buy from Market**: Purchase a card from the Transit Market, paying its cost. The card enters the discard pile.
   - **Slot a Structure/Institution**: Install a Structure or Institution card into an open sector slot, paying installation costs.
   - **Draw Extra**: Spend resources to draw additional cards from the Mandate Deck.
   - **Activate Tableau Ability**: Use an installed card's activated ability, paying any activation costs.
3. **End Turn**:
   - Transit Market slides left by 1. Leftmost card falls off (resolve on-fallout triggers). New card fills position 6 from World Deck.
   - Discard all played cards to the discard pile.
4. **Cryosleep Option**: At the end of any turn, the player may choose to enter Cryosleep, advancing to the Succession phase.

**Turn Economy**: Resource-gated freeform. There are no action points. The player may take as many actions as they can afford with available resources. This creates tension between spending resources on immediate actions and conserving them for Cryosleep survival thresholds.

### Phase 2 — Succession (Legacy Planning)

Succession is the transition between waking life and cryosleep. The player prepares their legacy for the next Watchkeeper.

1. **Choose Sleep Duration**: Select a duration of 1 to 5 Cryosleep cycles. Longer sleep means more world evolution (risk and reward) and more archive slots.
2. **Archive Cards**:
   - Archive slots available = `min(8, sleepDuration + 1)`
   - Select cards from hand and/or discard to archive permanently. Archived cards are preserved across sleep cycles and guaranteed to be in the next Watchkeeper's starting hand.
3. **Shuffle Remainder**: All non-archived cards in hand and discard shuffle into the Mandate Deck draw pile.

### Phase 3 — Cryosleep (Automated World Evolution)

The ship evolves without the player. The Cryosleep Algorithm (see Section 8) runs once for each cycle of the chosen sleep duration. If the player chose 3 cycles, the algorithm executes 3 times in sequence.

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

---

## 8. Cryosleep Algorithm (Per Cycle)

The Cryosleep Algorithm executes once per sleep cycle. If the player chose a sleep duration of N, this algorithm runs N times in sequence. Each execution represents one cycle of time passing aboard the ship while the Watchkeeper sleeps.

### Phase 1 — Inertia Check

Compare current resource levels against entropy thresholds. For each resource below its threshold, apply consequences.

| Resource | Threshold Name | Starting Threshold | Consequence |
|----------|---------------|-------------------|-------------|
| Matter | Hull Breach | 5 | Add `ceil(deficit / 3)` Hull Breach Junk cards to Mandate Deck |
| Energy | Power Down | 4 | Depower `ceil(deficit / 4)` lowest-priority tableau cards |
| Data | Tech Decay | 6 | Remove `ceil(deficit / 5)` lowest-priority Tier 2+ cards from World Deck |
| Influence | Coup | 4 | Dominant faction forces `ceil(deficit / 5)` law changes |

Where `deficit = threshold - currentResourceLevel` (only applied when resource is below threshold).

**Threshold Escalation**: All thresholds increase by +1 after each cycle (see Phase 5). The ship's entropy is relentless.

### Phase 2 — The Flush

Tally the World Score from all cards currently in the Transit Market and on the ship tableau.

```
World Score = SUM( factionIcons * factionWeight )
```

For each card, count its faction icons and multiply by that faction's current weight (derived from resource levels and card presence). This score determines faction standings for The Transformation.

### Phase 3 — The Transformation

The world evolves based on faction power.

1. **Dominant Faction Grows**: The faction with the highest World Score adds 2 cards from the Vault to the World Deck. These cards are drawn from the Vault's pool of cards affiliated with the dominant faction.
2. **Weakest Faction Shrinks**: The faction with the lowest World Score loses 1 card from the World Deck (returned to Vault).
3. **Tie Resolution** (for both dominant and weakest):
   - First: Total card count in World Deck affiliated with each tied faction.
   - Second: Sum of paired resource totals for each tied faction.
   - Third: Alphabetical by faction name.
4. **Market Refill**: The Transit Market refills any empty positions from the evolved World Deck.

### Phase 4 — Aging Tick

All cards with a lifespan value are aged.

1. **Decrement Lifespan**: Subtract 1 from the lifespan of every card in the Mandate Deck (draw pile), discard pile, hand (archived cards), and tableau.
2. **Check Decay Conditions**: Evaluate all decay conditions on all cards. Any card whose decay condition is met is flagged for death.
3. **Process Deaths**:
   - **Old Age** (lifespan reached 0): Transform the card into its designated weaker version or a Junk card.
   - **Entropy Death** (decay condition met): Return the card to the Vault.
   - **Explicit Destroy** (special effect): Remove the card from the game entirely.

### Phase 5 — Threshold Escalation

The entropy clock advances.

- All Inertia Check thresholds increase by +1.
- Resources drain slightly (implementation-specific drain rates).

**Threshold Progression Example:**

| Cycle | Hull Breach (MAT) | Power Down (ENG) | Tech Decay (DAT) | Coup (INF) |
|-------|-------------------|-------------------|-------------------|------------|
| 0 | 5 | 4 | 6 | 4 |
| 1 | 6 | 5 | 7 | 5 |
| 2 | 7 | 6 | 8 | 6 |
| 3 | 8 | 7 | 9 | 7 |
| 4 | 9 | 8 | 10 | 8 |
| 5 | 10 | 9 | 11 | 9 |

---

## 9. Design Decisions

Key design choices and their rationale.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Turn Economy | Resource-gated freeform (no action points) | Emphasizes resource tension; every action has an opportunity cost measured in the same currency as survival |
| Draw Mechanic | Auto-draw 1 + spend resources for extra draws | Guarantees forward momentum while rewarding resource investment in card access |
| Faction Power | Sector control (dominant faction per sector) | Localizes faction influence to spatial decisions; forces the player to consider board geography |
| Legacy / Archive | Sleep-duration-based slot count | Ties the risk/reward of long sleep to the legacy planning decision |
| Sleep Risk | Higher entropy BUT more transformation cycles | Long sleep is a gamble: more world evolution means more opportunity but also more entropy damage |
| Card Aging | Lifespan + condition-based decay; death via transform/degrade | Cards are mortal; the world naturally decays, forcing the player to continuously adapt |
| Lifespan Extension | Gameplay effects only, not a card property | Keeps card data clean; extension is an emergent reward for good play, not a static stat |

---

## 10. Color Palette

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

---

## 11. Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Game Engine | Phaser 3 |
| Language | TypeScript |
| Build Tool | Vite |
| Architecture | Monorepo |

### Package Structure

```
icebox/
  packages/
    shared/       @icebox/shared    Types, data, constants, card definitions
    game/         @icebox/game      Phaser client, rendering, input handling
    editor/       @icebox/editor    Card editor tool for design/balancing
```

**@icebox/shared**: Contains all type definitions, interfaces, card data (loaded from JSON), game constants, and shared utilities. Zero runtime dependencies on Phaser or any rendering library.

**@icebox/game**: The Phaser 3 client application. Handles rendering, animation, input, audio, and scene management. Imports game logic from `@icebox/shared` but never contains game rules.

**@icebox/editor**: A standalone card editor tool for designing and balancing cards. Uses shared types and data to ensure consistency with the game client.

### Design Principles

**Pure Game Systems**: All game logic (Cryosleep algorithm, faction scoring, card aging, resource management, market mechanics) is implemented as pure TypeScript functions with zero Phaser imports. This guarantees:

- Full unit testability without mocking a game engine.
- Clean separation between simulation and presentation.
- Potential for headless simulation runs (AI testing, balance verification).

**Immutable State**: Game state is treated as immutable. Systems are pure functions that accept current state and return new state.

```typescript
// Conceptual pattern — not actual API
function processCryosleepCycle(state: GameState): GameState {
  let next = inertiaCheck(state);
  next = flush(next);
  next = transformation(next);
  next = agingTick(next);
  next = thresholdEscalation(next);
  return next;
}
```

**Card Data**: All card definitions are stored in JSON files (e.g., `core-set.json`) and validated against TypeScript interfaces at build time. Card data is never hardcoded in game logic.

---

## Appendix: Quick Reference

### Starting State

| Parameter | Value |
|-----------|-------|
| Matter | 8 |
| Energy | 6 |
| Data | 5 |
| Influence | 5 |
| Hull Breach Threshold | 5 |
| Power Down Threshold | 4 |
| Tech Decay Threshold | 6 |
| Coup Threshold | 4 |
| Market Size | 6 cards |
| Sector Count | 3 (Engineering, Habitat, Command) |
| Slots per Sector | 3 structure/institution |
| Sleep Duration Range | 1-5 cycles |
| Archive Slots Formula | `min(8, sleepDuration + 1)` |
