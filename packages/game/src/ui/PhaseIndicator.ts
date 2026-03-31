import Phaser from "phaser";
import type { GamePhase } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs } from "./layout";

export class PhaseIndicator extends Phaser.GameObjects.Container {
  private phaseContainers: Map<string, Phaser.GameObjects.Text> = new Map();
  private turnText: Phaser.GameObjects.Text;
  private sleepText: Phaser.GameObjects.Text;
  private bgGfx: Phaser.GameObjects.Graphics;
  public readonly boxW: number;
  public readonly boxH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, boxWidth?: number) {
    super(scene, x, y);

    const pad = s(10);
    this.boxW = boxWidth ?? s(240);
    this.boxH = s(58);

    // Background box
    this.bgGfx = scene.add.graphics();
    this.bgGfx.fillStyle(NUM.slab, 0.7);
    this.bgGfx.fillRoundedRect(0, 0, this.boxW, this.boxH, s(6));
    this.bgGfx.lineStyle(s(1), NUM.graphite, 0.5);
    this.bgGfx.strokeRoundedRect(0, 0, this.boxW, this.boxH, s(6));
    this.add(this.bgGfx);

    // Pre-render all phase labels
    const phaseLabels: Record<GamePhase, string> = {
      "active-watch": "ACTIVE WATCH",
      succession: "SUCCESSION",
      cryosleep: "CRYOSLEEP",
      "game-over": "GAME OVER",
    };
    for (const [, label] of Object.entries(phaseLabels)) {
      const text = scene.add.text(pad, pad, label, {
        fontSize: fs(12), color: "#ffffff", fontFamily: "'Orbitron', monospace", fontStyle: "bold",
      }).setOrigin(0, 0).setVisible(false);
      this.add(text);
      this.phaseContainers.set(label, text);
    }
    // Show default
    this.phaseContainers.get("ACTIVE WATCH")?.setVisible(true);

    this.turnText = scene.add.text(pad, s(30), "Turn 1", {
      fontSize: fs(10),
      color: HEX.abyss,
      fontFamily: "'Space Mono', monospace",
    }).setOrigin(0, 0);
    this.add(this.turnText);

    this.sleepText = scene.add.text(pad + s(80), s(30), "Sleeps: 0", {
      fontSize: fs(10),
      color: HEX.abyss,
      fontFamily: "'Space Mono', monospace",
    }).setOrigin(0, 0);
    this.add(this.sleepText);

    scene.add.existing(this);
  }

  update(phase: GamePhase, turnNumber: number, totalSleeps: number): void {
    const phaseLabels: Record<GamePhase, string> = {
      "active-watch": "ACTIVE WATCH",
      succession: "SUCCESSION",
      cryosleep: "CRYOSLEEP",
      "game-over": "GAME OVER",
    };
    const label = phaseLabels[phase];
    // Hide all, show active
    for (const [key, container] of this.phaseContainers) {
      container.setVisible(key === label);
    }
    this.turnText.setText(`Turn ${turnNumber}`);
    this.sleepText.setText(`Sleeps: ${totalSleeps}`);
  }
}
