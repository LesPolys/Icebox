import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs } from "./layout";

/**
 * Small confirmation dialog with Yes / No buttons.
 * Auto-destroys after a button is clicked.
 */
export class ConfirmPopup extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) {
    super(scene, x, y);
    this.setDepth(950);

    const panelW = s(180);
    const panelH = s(80);

    // Background
    const bg = scene.add.rectangle(0, 0, panelW, panelH, NUM.slab, 0.95);
    bg.setStrokeStyle(s(1.5), NUM.graphite, 0.8);
    this.add(bg);

    // Message text
    const text = scene.add.text(0, -s(18), message, {
      fontSize: fs(9),
      color: HEX.bone,
      fontFamily: "'Space Grotesk', sans-serif",
      wordWrap: { width: panelW - s(16) },
      align: "center",
    }).setOrigin(0.5);
    this.add(text);

    // Buttons
    const btnW = s(60);
    const btnH = s(24);
    const btnY = s(18);

    this.createBtn(scene, -s(38), btnY, btnW, btnH, "Yes", NUM.chartreuse, "#ffffff", () => {
      onConfirm();
      this.destroy();
    });

    this.createBtn(scene, s(38), btnY, btnW, btnH, "No", NUM.steel, HEX.concrete, () => {
      if (onCancel) onCancel();
      this.destroy();
    });

    // Scale-in animation
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: "Back.easeOut",
    });

    scene.add.existing(this);
  }

  private createBtn(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    color: number,
    textColor: string,
    onClick: () => void
  ): void {
    const btnBg = scene.add.rectangle(x, y, w, h, color, 0.3);
    btnBg.setStrokeStyle(s(1), color, 0.7);
    btnBg.setInteractive({ useHandCursor: true });
    btnBg.on("pointerover", () => btnBg.setFillStyle(color, 0.6));
    btnBg.on("pointerout", () => btnBg.setFillStyle(color, 0.3));
    btnBg.on("pointerdown", onClick);
    this.add(btnBg);

    const text = scene.add.text(x, y, label, {
      fontSize: fs(9),
      color: textColor,
      fontFamily: "'Orbitron', monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.add(text);
  }
}
