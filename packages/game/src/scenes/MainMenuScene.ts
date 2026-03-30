import Phaser from "phaser";
import { HEX, NUM } from "@icebox/shared";
import { hasSave, loadGame } from "../systems/SaveManager";
import { ActiveWatchScene } from "./ActiveWatchScene";
import { s, fontSize as fs } from "../ui/layout";

export class MainMenuScene extends Phaser.Scene {
  static readonly KEY = "MainMenuScene";

  constructor() {
    super(MainMenuScene.KEY);
  }

  create(): void {
    const { width, height } = this.scale;

    // Title
    this.add
      .text(width / 2, s(150), "ICEBOX", {
        fontSize: fs(64),
        color: HEX.chartreuse,
        fontFamily: "'Orbitron', monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, s(220), "A Generation Ship Deckbuilder", {
        fontSize: fs(18),
        color: HEX.teal,
        fontFamily: "'Space Grotesk', sans-serif",
      })
      .setOrigin(0.5);

    // New Game button
    this.createButton(width / 2, s(350), "New Game", () => {
      this.scene.start(ActiveWatchScene.KEY, { newGame: true });
    });

    // Continue button (if save exists)
    if (hasSave()) {
      this.createButton(width / 2, s(420), "Continue", () => {
        const state = loadGame();
        if (state) {
          this.scene.start(ActiveWatchScene.KEY, { newGame: false, savedState: state });
        }
      });
    }

    // Version info
    this.add
      .text(width - s(10), height - s(10), "v0.1.0 — Prototype", {
        fontSize: fs(12),
        color: HEX.concrete,
        fontFamily: "'Space Mono', monospace",
      })
      .setOrigin(1, 1);
  }

  private createButton(x: number, y: number, label: string, onClick: () => void): void {
    const btn = this.add.image(x, y, "btn-primary").setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontSize: fs(18),
        color: "#ffffff",
        fontFamily: "'Orbitron', monospace",
      })
      .setOrigin(0.5);

    btn.on("pointerover", () => {
      btn.setTint(NUM.chartreuse);
      text.setColor("#ffffff");
    });
    btn.on("pointerout", () => {
      btn.clearTint();
      text.setColor("#ffffff");
    });
    btn.on("pointerdown", onClick);
  }
}
