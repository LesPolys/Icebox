import Phaser from "phaser";
import type { GameState, Card } from "@icebox/shared";
import {
  executeCryosleep,
  finalizeLegacy,
  type CryosleepEvent,
  type CryosleepResult,
} from "../systems/CryosleepEngine";
import { saveGame } from "../systems/SaveManager";
import { ActiveWatchScene } from "./ActiveWatchScene";
import { s, fontSize as fs } from "../ui/layout";

interface CycleGroup {
  cycleNumber: number;
  totalCycles: number;
  events: CryosleepEvent[];
}

/**
 * Cryosleep scene: per-cycle summary panels showing grouped events.
 * Each cycle gets one screen; click NEXT to advance through cycles.
 */
export class CryosleepScene extends Phaser.Scene {
  static readonly KEY = "CryosleepScene";

  private gameState!: GameState;
  private cardDefs!: Card[];
  private sleepDuration!: number;
  private archivedCardIds!: string[];

  private result!: CryosleepResult;
  private cycleGroups: CycleGroup[] = [];
  private currentCycleIndex = 0;
  private phase: "cycles" | "summary" = "cycles";

  // UI elements
  private contentContainer!: Phaser.GameObjects.Container;
  private contentTexts: Phaser.GameObjects.GameObject[] = [];
  private progressText!: Phaser.GameObjects.Text;
  private btnBg!: Phaser.GameObjects.Rectangle;
  private btnText!: Phaser.GameObjects.Text;

  // Scroll state
  private scrollOffset = 0;
  private totalContentHeight = 0;
  private panelTop = 0;
  private panelHeight = 0;
  private maskGfx!: Phaser.GameObjects.Graphics;
  private contentMask!: Phaser.Display.Masks.GeometryMask;

  constructor() {
    super(CryosleepScene.KEY);
  }

  init(data: {
    gameState: GameState;
    cardDefs: Card[];
    sleepDuration: number;
    archivedCardIds: string[];
  }): void {
    (this as any).__restartData = data;
    this.gameState = data.gameState;
    this.cardDefs = data.cardDefs;
    this.sleepDuration = data.sleepDuration;
    this.archivedCardIds = data.archivedCardIds;
    this.currentCycleIndex = 0;
    this.phase = "cycles";
    this.scrollOffset = 0;
  }

  create(): void {
    const { width, height } = this.scale;

    // Run the cryosleep algorithm
    this.result = executeCryosleep(this.gameState, this.sleepDuration, this.cardDefs);

    // Group events by cycle
    this.cycleGroups = this.groupEventsByCycle(this.result.events);

    // Title
    this.add.text(width / 2, s(30), "C R Y O S L E E P", {
      fontSize: fs(28), color: "#4466aa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, s(60), `Sleeping for ${this.sleepDuration} cycle(s)...`, {
      fontSize: fs(11), color: "#556677", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Panel area
    this.panelTop = s(90);
    this.panelHeight = height - s(170);
    const panelLeft = s(60);
    const panelWidth = width - s(120);

    // Panel background
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x111122, 0.6);
    panelBg.fillRoundedRect(panelLeft, this.panelTop, panelWidth, this.panelHeight, s(6));
    panelBg.lineStyle(s(1), 0x334466, 0.5);
    panelBg.strokeRoundedRect(panelLeft, this.panelTop, panelWidth, this.panelHeight, s(6));

    // Content container (scrollable)
    this.contentContainer = this.add.container(panelLeft + s(16), this.panelTop + s(8));

    // Mask for clipping
    this.maskGfx = this.make.graphics({ x: 0, y: 0 });
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillRect(panelLeft, this.panelTop, panelWidth, this.panelHeight);
    this.contentMask = this.maskGfx.createGeometryMask();
    this.contentContainer.setMask(this.contentMask);

    // Scroll with mouse wheel
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
      const maxScroll = Math.max(0, this.totalContentHeight - this.panelHeight + s(20));
      this.scrollOffset = Phaser.Math.Clamp(
        this.scrollOffset + (dy > 0 ? s(40) : -s(40)),
        0, maxScroll
      );
      this.contentContainer.y = this.panelTop + s(8) - this.scrollOffset;
    });

    // Progress
    this.progressText = this.add.text(width / 2, height - s(80), "", {
      fontSize: fs(9), color: "#556677", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Next button
    this.btnBg = this.add.rectangle(width / 2, height - s(40), s(200), s(40), 0x2244aa);
    this.btnBg.setStrokeStyle(s(2), 0x4466cc);
    this.btnBg.setInteractive({ useHandCursor: true });
    this.btnText = this.add.text(width / 2, height - s(40), "NEXT CYCLE", {
      fontSize: fs(14), color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    this.btnBg.setDepth(100);
    this.btnText.setDepth(100);
    this.progressText.setDepth(100);

    this.btnBg.on("pointerdown", () => this.advance());
    this.btnBg.on("pointerover", () => this.btnBg.setFillStyle(0x3366cc));
    this.btnBg.on("pointerout", () => this.btnBg.setFillStyle(0x2244aa));

    // Show first cycle
    this.showCyclePanel(0);
  }

  private groupEventsByCycle(events: CryosleepEvent[]): CycleGroup[] {
    const groups: CycleGroup[] = [];
    let current: CycleGroup | null = null;

    for (const event of events) {
      if (event.type === "cycle-start") {
        current = {
          cycleNumber: event.data.cycleNumber as number,
          totalCycles: event.data.totalCycles as number,
          events: [],
        };
        groups.push(current);
      } else if (current) {
        current.events.push(event);
      }
    }

    return groups;
  }

  private advance(): void {
    if (this.phase === "summary") {
      // WAKE UP — transition directly to active watch
      try {
        const finalState = finalizeLegacy(this.result.newState, this.archivedCardIds);
        saveGame(finalState);
        this.scene.start(ActiveWatchScene.KEY, {
          newGame: false,
          savedState: finalState,
        });
      } catch (e) {
        console.error("CryosleepScene: failed to wake up:", e);
      }
      return;
    }

    // phase === "cycles" — advance to next cycle or summary
    this.currentCycleIndex++;
    if (this.currentCycleIndex >= this.cycleGroups.length) {
      this.showSummary();
    } else {
      this.showCyclePanel(this.currentCycleIndex);
    }
  }

  private clearContent(): void {
    for (const obj of this.contentTexts) obj.destroy();
    this.contentTexts = [];
    this.scrollOffset = 0;
    this.contentContainer.y = this.panelTop + s(8);
  }

  private addText(
    x: number, y: number, text: string,
    style: Partial<Phaser.Types.GameObjects.Text.TextStyle>
  ): Phaser.GameObjects.Text {
    const contentWidth = this.scale.width - s(152);
    const t = this.add.text(x, y, text, {
      fontFamily: "monospace",
      wordWrap: { width: contentWidth },
      ...style,
    });
    this.contentContainer.add(t);
    this.contentTexts.push(t);
    return t;
  }

  private showCyclePanel(index: number): void {
    this.clearContent();
    const group = this.cycleGroups[index];
    if (!group) return;

    this.progressText.setText(`Cycle ${group.cycleNumber} of ${group.totalCycles}`);

    // Check if this is the last cycle
    const isLast = index === this.cycleGroups.length - 1;
    this.btnText.setText(isLast ? "VIEW SUMMARY" : "NEXT CYCLE");

    let y = 0;

    // Cycle header
    const header = this.addText(0, y, `CYCLE ${group.cycleNumber}`, {
      fontSize: fs(18), color: "#4466aa", fontStyle: "bold",
    });
    y += header.height + s(12);

    // Group events by category
    const entropyBP = group.events.filter(e => e.type === "entropy-breakpoint");
    const flush = group.events.find(e => e.type === "market-flush");
    const worldScore = group.events.find(e => e.type === "world-score");
    const adds = group.events.filter(e => e.type === "transformation-add");
    const removes = group.events.filter(e => e.type === "transformation-remove");
    const law = group.events.find(e => e.type === "global-law-set");
    const deaths = group.events.filter(e => e.type === "card-death");
    const transforms = group.events.filter(e => e.type === "card-transform");
    const entropyEsc = group.events.find(e => e.type === "entropy-escalation");
    const drain = group.events.find(e => e.type === "resource-drain");
    const hull = group.events.find(e => e.type === "hull-damage");
    const defeat = group.events.find(e => e.type === "defeat");
    const victory = group.events.find(e => e.type === "victory");
    const crewMortality = group.events.filter(e => e.type === "crew-mortality" || e.type === "crew-cryo-pod" || e.type === "crew-mentorship" || e.type === "crew-digital-archive");
    const eraTransition = group.events.find(e => e.type === "era-transition");

    // ── Entropy Breakpoints ──
    if (entropyBP.length > 0) {
      y = this.addSection(y, "ENTROPY BREAKPOINTS", "#cc6644");
      for (const ev of entropyBP) {
        const d = ev.data;
        const t = this.addText(s(8), y, `${d.effect}: ${d.description}`, { fontSize: fs(9), color: "#cc8866" });
        y += t.height + s(4);
      }
      y += s(8);
    }

    // ── Market & World Score ──
    if (flush || worldScore) {
      y = this.addSection(y, "MARKET & WORLD SCORE", "#6688aa");
      if (flush) {
        const t = this.addText(s(8), y, `${flush.data.flushedCount} cards flushed from market`, {
          fontSize: fs(9), color: "#8899aa",
        });
        y += t.height + s(4);
      }
      if (worldScore) {
        const scores = worldScore.data.worldScore as Record<string, number>;
        const scoreLines = Object.entries(scores)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([fid, v]) => `  ${fid}: ${v}`)
          .join("\n");
        if (scoreLines) {
          const t = this.addText(s(8), y, scoreLines, { fontSize: fs(9), color: "#8899aa" });
          y += t.height + s(4);
        }
      }
      y += s(8);
    }

    // ── Faction Changes ──
    if (adds.length > 0 || removes.length > 0 || law) {
      y = this.addSection(y, "FACTION CHANGES", "#66aa88");
      if (law) {
        const t = this.addText(s(8), y, `Global Law: ${law.data.faction} — ${law.data.description}`, {
          fontSize: fs(9), color: "#88ccaa",
        });
        y += t.height + s(4);
      }
      for (const ev of adds) {
        const t = this.addText(s(8), y, `+ ${ev.data.faction} adds "${ev.data.cardName}"`, {
          fontSize: fs(9), color: "#77bb88",
        });
        y += t.height + s(4);
      }
      for (const ev of removes) {
        const t = this.addText(s(8), y, `- ${ev.data.faction} loses "${ev.data.cardName}"`, {
          fontSize: fs(9), color: "#aa7766",
        });
        y += t.height + s(4);
      }
      y += s(8);
    }

    // ── Aging: Deaths & Transforms ──
    if (deaths.length > 0 || transforms.length > 0) {
      y = this.addSection(y, `AGING (${deaths.length + transforms.length} cards affected)`, "#aa6688");
      for (const ev of deaths) {
        const cause = ev.data.conditionDescription || ev.data.cause || "lifespan expired";
        const t = this.addText(s(8), y, `✝ "${ev.data.cardName}" — ${cause}`, {
          fontSize: fs(9), color: "#aa8899",
        });
        y += t.height + s(4);
      }
      for (const ev of transforms) {
        const t = this.addText(s(8), y, `↻ "${ev.data.cardName}" → "${ev.data.transformInto ?? "wreckage"}"`, {
          fontSize: fs(9), color: "#9988aa",
        });
        y += t.height + s(4);
      }
      y += s(8);
    }

    // ── Entropy: Escalation, Drain, Hull ──
    if (entropyEsc || drain || hull) {
      y = this.addSection(y, "ENTROPY", "#8866aa");
      if (entropyEsc) {
        const t = this.addText(s(8), y,
          `Entropy: ${entropyEsc.data.entropy} / ${entropyEsc.data.maxEntropy}`, {
          fontSize: fs(9), color: "#9988bb",
        });
        y += t.height + s(4);
      }
      if (drain) {
        const r = drain.data.newResources as Record<string, number>;
        const t = this.addText(s(8), y,
          `Resources: MAT ${r.matter} | ENG ${r.energy} | DAT ${r.data} | INF ${r.influence}`, {
          fontSize: fs(9), color: "#9988bb",
        });
        y += t.height + s(4);
      }
      if (hull) {
        const t = this.addText(s(8), y, `Hull Integrity: ${hull.data.hullIntegrity}`, {
          fontSize: fs(9), color: "#9988bb",
        });
        y += t.height + s(4);
      }
      y += s(8);
    }

    // ── Defeat / Victory ──
    if (defeat) {
      y = this.addSection(y, "DEFEAT", "#ff4444");
      const t = this.addText(s(8), y, `${defeat.data.reason}`, {
        fontSize: fs(12), color: "#ff6666",
      });
      y += t.height + s(8);
      // Stop progression
      this.btnText.setText("WAKE UP");
      this.phase = "summary";
    }
    if (victory) {
      y = this.addSection(y, "VICTORY", "#44ff44");
      const t = this.addText(s(8), y, `${victory.data.type} — Dominant: ${victory.data.dominantFaction}`, {
        fontSize: fs(12), color: "#66ff66",
      });
      y += t.height + s(8);
    }

    this.totalContentHeight = y;
  }

  private addSection(y: number, title: string, color: string): number {
    // Separator line
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(s(1), Phaser.Display.Color.HexStringToColor(color).color, 0.4);
    lineGfx.lineBetween(0, y, this.scale.width - s(152), y);
    this.contentContainer.add(lineGfx);
    this.contentTexts.push(lineGfx);

    const t = this.addText(0, y + s(3), title, {
      fontSize: fs(10), color, fontStyle: "bold",
    });
    return y + t.height + s(10);
  }

  private showSummary(): void {
    this.clearContent();
    this.phase = "summary";

    this.progressText.setText("");
    this.btnText.setText("WAKE UP");

    let y = 0;

    const header = this.addText(0, y, "CRYOSLEEP COMPLETE", {
      fontSize: fs(18), color: "#4466aa", fontStyle: "bold",
    });
    y += header.height + s(16);

    const sum = this.result.summary;

    const stats = [
      `Cards died: ${sum.totalDeaths}`,
      `Cards added to World Deck: ${sum.totalCardsAdded}`,
      `Cards removed from World Deck: ${sum.totalCardsRemoved}`,
      ``,
      `Dominant factions: ${sum.dominantFactions.join(", ")}`,
      `Weakest factions: ${sum.weakestFactions.join(", ")}`,
      ``,
      `Cards archived: ${this.archivedCardIds.length}`,
    ];

    for (const line of stats) {
      if (line === "") { y += s(8); continue; }
      const t = this.addText(0, y, line, {
        fontSize: fs(11), color: "#99bbcc",
      });
      y += t.height + s(4);
    }

    this.totalContentHeight = y;
  }
}
