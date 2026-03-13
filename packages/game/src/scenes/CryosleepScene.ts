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

/**
 * Cryosleep scene: step-through display of the cryosleep algorithm results.
 */
export class CryosleepScene extends Phaser.Scene {
  static readonly KEY = "CryosleepScene";

  private gameState!: GameState;
  private cardDefs!: Card[];
  private sleepDuration!: number;
  private archivedCardIds!: string[];

  private result!: CryosleepResult;
  private currentEventIndex = 0;

  private titleText!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private summaryText!: Phaser.GameObjects.Text;

  constructor() {
    super(CryosleepScene.KEY);
  }

  init(data: {
    gameState: GameState;
    cardDefs: Card[];
    sleepDuration: number;
    archivedCardIds: string[];
  }): void {
    this.gameState = data.gameState;
    this.cardDefs = data.cardDefs;
    this.sleepDuration = data.sleepDuration;
    this.archivedCardIds = data.archivedCardIds;
    this.currentEventIndex = 0;
  }

  create(): void {
    const { width, height } = this.scale;

    // Run the cryosleep algorithm
    this.result = executeCryosleep(this.gameState, this.sleepDuration, this.cardDefs);

    // Title
    this.titleText = this.add.text(width / 2, s(40), "C R Y O S L E E P", {
      fontSize: fs(32), color: "#4466aa", fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, s(80), `Sleeping for ${this.sleepDuration} cycle(s)...`, {
      fontSize: fs(14), color: "#556677", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Event display area
    this.eventText = this.add.text(width / 2, s(180), "", {
      fontSize: fs(16), color: "#aabbcc", fontFamily: "monospace", fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5);

    this.detailText = this.add.text(width / 2, s(280), "", {
      fontSize: fs(12), color: "#889aab", fontFamily: "monospace",
      wordWrap: { width: s(800) }, align: "center", lineSpacing: s(6),
    }).setOrigin(0.5, 0);

    // Progress
    this.progressText = this.add.text(width / 2, height - s(100), "", {
      fontSize: fs(10), color: "#556677", fontFamily: "monospace",
    }).setOrigin(0.5);

    // Summary (hidden initially)
    this.summaryText = this.add.text(width / 2, s(200), "", {
      fontSize: fs(12), color: "#99bbcc", fontFamily: "monospace",
      wordWrap: { width: s(600) }, align: "center", lineSpacing: s(8),
    }).setOrigin(0.5, 0);
    this.summaryText.setVisible(false);

    // Next button
    const nextBg = this.add.rectangle(width / 2, height - s(50), s(200), s(44), 0x2244aa);
    nextBg.setStrokeStyle(s(2), 0x4466cc);
    nextBg.setInteractive({ useHandCursor: true });
    const nextText = this.add.text(width / 2, height - s(50), "NEXT →", {
      fontSize: fs(16), color: "#ffffff", fontFamily: "monospace",
    }).setOrigin(0.5);

    nextBg.on("pointerdown", () => this.advanceEvent());
    nextBg.on("pointerover", () => nextBg.setFillStyle(0x3366cc));
    nextBg.on("pointerout", () => nextBg.setFillStyle(0x2244aa));

    // Show first event
    this.showCurrentEvent();
  }

  private advanceEvent(): void {
    this.currentEventIndex++;

    if (this.currentEventIndex >= this.result.events.length) {
      this.showSummary();
    } else {
      this.showCurrentEvent();
    }
  }

  private showCurrentEvent(): void {
    const event = this.result.events[this.currentEventIndex];
    if (!event) return;

    this.progressText.setText(
      `Event ${this.currentEventIndex + 1} / ${this.result.events.length}`
    );

    const eventLabels: Record<string, string> = {
      "cycle-start": `═══ CYCLE ${(event.data.cycleNumber as number)} of ${event.data.totalCycles} ═══`,
      "inertia-breach": "⚠ INERTIA BREACH",
      "market-flush": "◈ MARKET FLUSH",
      "world-score": "◆ WORLD SCORE",
      "transformation-add": "▲ FACTION RISES",
      "transformation-remove": "▼ FACTION FALLS",
      "card-death": "✝ CARD DEATH",
      "card-transform": "↻ CARD TRANSFORMS",
      "threshold-escalation": "↑ THRESHOLDS RISE",
      "resource-drain": "↓ RESOURCES DRAIN",
      "cycle-end": `═══ CYCLE COMPLETE ═══`,
    };

    this.eventText.setText(eventLabels[event.type] ?? event.type);
    this.detailText.setText(this.formatEventDetail(event));
    this.summaryText.setVisible(false);
    this.eventText.setVisible(true);
    this.detailText.setVisible(true);
  }

  private formatEventDetail(event: CryosleepEvent): string {
    const d = event.data;
    switch (event.type) {
      case "inertia-breach":
        return `Resource: ${d.resource}\nDeficit: ${d.deficit}\n${
          d.junkAdded ? `Junk injected: ${d.junkAdded}` : ""
        }${d.depowered ? `Cards depowered: ${d.depowered}` : ""}${
          d.decayed ? `Cards decayed: ${d.decayed}` : ""
        }${d.coupsTriggered ? `Coups triggered: ${d.coupsTriggered}` : ""}`;
      case "market-flush":
        return `${d.flushedCount} cards flushed from the market.\nTheir faction icons contribute to the World Score.`;
      case "world-score": {
        const scores = d.worldScore as Record<string, number>;
        return Object.entries(scores)
          .filter(([_, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .map(([fid, v]) => `${fid}: ${v}`)
          .join("\n");
      }
      case "transformation-add":
        return `${d.faction} adds "${d.cardName}" to the World Deck.`;
      case "transformation-remove":
        return `${d.faction} loses "${d.cardName}" from the World Deck.`;
      case "card-death":
        return `"${d.cardName}" has died.\nCause: ${d.cause}\n${d.conditionDescription ?? ""}`;
      case "card-transform":
        return `"${d.cardName}" transforms into "${d.transformInto ?? "wreckage"}".`;
      case "threshold-escalation": {
        const t = d.newThresholds as Record<string, number>;
        return `New thresholds:\nHull Breach: ${t.hullBreach} | Power Down: ${t.powerDown}\nTech Decay: ${t.techDecay} | Coup: ${t.coup}`;
      }
      case "resource-drain": {
        const r = d.newResources as Record<string, number>;
        return `Resources after drain:\nMatter: ${r.matter} | Energy: ${r.energy}\nData: ${r.data} | Influence: ${r.influence}`;
      }
      default:
        return "";
    }
  }

  private showSummary(): void {
    this.eventText.setVisible(false);
    this.detailText.setVisible(false);
    this.summaryText.setVisible(true);

    const sum = this.result.summary;
    const lines = [
      `══════ CRYOSLEEP COMPLETE ══════`,
      ``,
      `Cards died: ${sum.totalDeaths}`,
      `Cards added to World Deck: ${sum.totalCardsAdded}`,
      `Cards removed from World Deck: ${sum.totalCardsRemoved}`,
      `Dominant factions: ${sum.dominantFactions.join(", ")}`,
      `Weakest factions: ${sum.weakestFactions.join(", ")}`,
      ``,
      `Cards archived: ${this.archivedCardIds.length}`,
      ``,
      `Click NEXT to wake up.`,
    ];
    this.summaryText.setText(lines.join("\n"));
    this.progressText.setText("Summary");

    // Finalize legacy and transition
    const finalState = finalizeLegacy(this.result.newState, this.archivedCardIds);

    // Replace the next click to transition to active watch
    this.input.once("pointerdown", () => {
      saveGame(finalState);
      this.scene.start(ActiveWatchScene.KEY, {
        newGame: false,
        savedState: finalState,
      });
    });
  }
}
