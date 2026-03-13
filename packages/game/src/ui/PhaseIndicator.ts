import Phaser from "phaser";
import type { GamePhase } from "@icebox/shared";
import { HEX } from "@icebox/shared";
import { s, fontSize as fs } from "./layout";

export class PhaseIndicator extends Phaser.GameObjects.Container {
  private phaseText: Phaser.GameObjects.Text;
  private turnText: Phaser.GameObjects.Text;
  private sleepText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.phaseText = scene.add.text(0, 0, "ACTIVE WATCH", {
      fontSize: fs(12),
      color: HEX.darkCyan,
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0, 0.5);
    this.add(this.phaseText);

    this.turnText = scene.add.text(0, s(18), "Turn 1", {
      fontSize: fs(10),
      color: HEX.pearlAqua,
      fontFamily: "monospace",
    }).setOrigin(0, 0.5);
    this.add(this.turnText);

    this.sleepText = scene.add.text(0, s(32), "Sleeps: 0", {
      fontSize: fs(10),
      color: HEX.pearlAqua,
      fontFamily: "monospace",
    }).setOrigin(0, 0.5);
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
    this.phaseText.setText(phaseLabels[phase]);
    this.turnText.setText(`Turn ${turnNumber}`);
    this.sleepText.setText(`Sleeps: ${totalSleeps}`);
  }
}
