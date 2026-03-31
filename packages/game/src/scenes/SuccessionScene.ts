import Phaser from "phaser";
import type { GameState, Card, CardInstance } from "@icebox/shared";
import { calculateArchiveSlots, HEX, NUM } from "@icebox/shared";
import { CardSprite, CARD_WIDTH } from "../game-objects/CardSprite";
import { CryosleepScene } from "./CryosleepScene";
import { s, fontSize as fs } from "../ui/layout";

/**
 * Succession scene: player chooses which cards to archive before cryosleep.
 * Also chooses sleep duration.
 */
export class SuccessionScene extends Phaser.Scene {
  static readonly KEY = "SuccessionScene";

  private gameState!: GameState;
  private cardDefs!: Card[];
  private selectedCards: Set<string> = new Set();
  private sleepDuration = 1;
  private maxArchive = 2;

  private cardSprites: CardSprite[] = [];
  private archiveCountText!: Phaser.GameObjects.Text;
  private sleepDurationText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;

  constructor() {
    super(SuccessionScene.KEY);
  }

  init(data: { gameState: GameState; cardDefs: Card[] }): void {
    (this as any).__restartData = data;
    this.gameState = data.gameState;
    this.cardDefs = data.cardDefs;
    this.selectedCards.clear();
    this.sleepDuration = 1;
    this.maxArchive = calculateArchiveSlots(this.sleepDuration);
  }

  create(): void {
    const { width, height } = this.scale;

    // Title
    this.add.text(width / 2, s(30), "THE SUCCESSION", {
      fontSize: fs(28), color: HEX.chartreuse, fontFamily: "'Orbitron', monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, s(65), "Choose cards to archive and sleep duration", {
      fontSize: fs(12), color: HEX.abyss, fontFamily: "'Space Grotesk', sans-serif",
    }).setOrigin(0.5);

    // Sleep duration selector
    this.add.text(width / 2 - s(200), s(100), "Sleep Duration:", {
      fontSize: fs(14), color: HEX.concrete, fontFamily: "'Space Grotesk', sans-serif",
    });

    this.sleepDurationText = this.add.text(width / 2, s(100), `${this.sleepDuration} cycle(s)`, {
      fontSize: fs(14), color: HEX.chartreuse, fontFamily: "'Space Mono', monospace", fontStyle: "bold",
    });

    // Duration buttons
    this.createBtn(width / 2 + s(120), s(100), "−", () => {
      this.sleepDuration = Math.max(1, this.sleepDuration - 1);
      this.updateSleepDisplay();
    });
    this.createBtn(width / 2 + s(160), s(100), "+", () => {
      this.sleepDuration = Math.min(5, this.sleepDuration + 1);
      this.updateSleepDisplay();
    });

    // Archive info
    this.archiveCountText = this.add.text(width / 2, s(130), "", {
      fontSize: fs(12), color: HEX.abyss, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);

    this.instructionText = this.add.text(width / 2, s(155), "", {
      fontSize: fs(10), color: HEX.concrete, fontFamily: "'Space Grotesk', sans-serif",
    }).setOrigin(0.5);

    // Display eligible cards (hand + discard)
    const eligible = [
      ...this.gameState.mandateDeck.hand,
      ...this.gameState.mandateDeck.discardPile,
    ].filter((c) => c.card.type !== "junk");

    this.add.text(width / 2, s(190), "Eligible Cards (click to select for archive)", {
      fontSize: fs(10), color: HEX.abyss, fontFamily: "'Space Grotesk', sans-serif",
    }).setOrigin(0.5);

    const startX = width / 2 - ((Math.min(eligible.length, 8) - 1) * (CARD_WIDTH + s(10))) / 2;
    const cardsPerRow = 8;

    for (let i = 0; i < eligible.length; i++) {
      const row = Math.floor(i / cardsPerRow);
      const col = i % cardsPerRow;
      const x = startX + col * (CARD_WIDTH + s(10));
      const y = s(300) + row * s(200);

      const sprite = new CardSprite(this, x, y, eligible[i]);
      sprite.on("pointerdown", () => this.toggleCard(eligible[i].instanceId, sprite));
      this.cardSprites.push(sprite);
    }

    // Confirm button
    this.createActionBtn(width / 2, height - s(50), "ENTER CRYOSLEEP", () => {
      this.confirmSleep();
    });

    this.updateSleepDisplay();
  }

  private toggleCard(instanceId: string, sprite: CardSprite): void {
    if (this.selectedCards.has(instanceId)) {
      this.selectedCards.delete(instanceId);
      sprite.setSelected(false);
    } else if (this.selectedCards.size < this.maxArchive) {
      this.selectedCards.add(instanceId);
      sprite.setSelected(true);
    }
    this.updateSleepDisplay();
  }

  private updateSleepDisplay(): void {
    this.maxArchive = calculateArchiveSlots(this.sleepDuration);
    this.sleepDurationText.setText(`${this.sleepDuration} cycle(s)`);
    this.archiveCountText.setText(
      `Archive: ${this.selectedCards.size} / ${this.maxArchive} cards`
    );

    // Warnings
    const warnings: string[] = [];
    if (this.sleepDuration >= 3) warnings.push("⚠ HIGH ENTROPY RISK");
    if (this.sleepDuration >= 4) warnings.push("⚠ SEVERE WORLD EVOLUTION");
    this.instructionText.setText(warnings.join(" | "));
    this.instructionText.setColor(this.sleepDuration >= 4 ? HEX.signalRed : HEX.chartreuse);

    // Deselect excess cards if archive shrunk
    if (this.selectedCards.size > this.maxArchive) {
      const excess = this.selectedCards.size - this.maxArchive;
      const iter = this.selectedCards.values();
      for (let i = 0; i < excess; i++) {
        const id = iter.next().value;
        if (id) this.selectedCards.delete(id);
      }
      // Update sprites
      for (const sprite of this.cardSprites) {
        sprite.setSelected(this.selectedCards.has(sprite.cardInstance.instanceId));
      }
    }
  }

  private confirmSleep(): void {
    this.gameState.phase = "cryosleep";
    this.gameState.chosenSleepDuration = this.sleepDuration;

    this.scene.start(CryosleepScene.KEY, {
      gameState: this.gameState,
      cardDefs: this.cardDefs,
      sleepDuration: this.sleepDuration,
      archivedCardIds: Array.from(this.selectedCards),
    });
  }

  private createBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, s(30), s(24), NUM.steel);
    bg.setStrokeStyle(s(1), NUM.graphite);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: fs(16), color: HEX.bone, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);
    bg.on("pointerdown", onClick);
    bg.on("pointerover", () => bg.setFillStyle(NUM.graphite));
    bg.on("pointerout", () => bg.setFillStyle(NUM.steel));
  }

  private createActionBtn(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, s(240), s(44), NUM.steel);
    bg.setStrokeStyle(s(2), NUM.chartreuse);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontSize: fs(16), color: "#ffffff", fontFamily: "'Orbitron', monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    bg.on("pointerdown", onClick);
    bg.on("pointerover", () => bg.setFillStyle(NUM.chartreuse));
    bg.on("pointerout", () => bg.setFillStyle(NUM.steel));
  }
}
