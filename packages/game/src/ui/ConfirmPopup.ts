import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs, GAME_W, GAME_H } from "./layout";

/**
 * Confirmation dialog with Yes / No buttons.
 * Auto-sizes to fit message content.
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

    const panelW = s(220);
    const btnH = s(24);
    const btnY_offset = s(10); // gap between text bottom and buttons
    const bottomPad = s(12);

    // Message text — create first to measure height
    const text = scene.add.text(0, 0, message, {
      fontSize: fs(10),
      color: HEX.bone,
      fontFamily: "Space Grotesk",
      wordWrap: { width: panelW - s(24) },
      align: "center",
    }).setOrigin(0.5, 0);
    this.add(text);

    // Compute layout from text height
    const textH = text.height;
    const topPad = s(12);
    const panelH = topPad + textH + btnY_offset + btnH + bottomPad;

    // Position text at top of panel
    text.setY(-panelH / 2 + topPad);

    // Background
    const bg = scene.add.rectangle(0, 0, panelW, panelH, NUM.slab, 0.95);
    bg.setStrokeStyle(s(1.5), NUM.graphite, 0.8);
    this.addAt(bg, 0); // behind text

    // Buttons centered below text
    const btnW = s(60);
    const btnCenterY = panelH / 2 - bottomPad - btnH / 2;

    this.createBtn(scene, -s(38), btnCenterY, btnW, btnH, "Yes", NUM.chartreuse, () => {
      onConfirm();
      this.destroy();
    });

    this.createBtn(scene, s(38), btnCenterY, btnW, btnH, "No", NUM.steel, () => {
      if (onCancel) onCancel();
      this.destroy();
    });

    // Clamp to screen bounds
    const halfW = panelW / 2;
    const halfH = panelH / 2;
    if (x - halfW < s(8)) this.x = halfW + s(8);
    if (x + halfW > GAME_W - s(8)) this.x = GAME_W - halfW - s(8);
    if (y - halfH < s(8)) this.y = halfH + s(8);
    if (y + halfH > GAME_H - s(8)) this.y = GAME_H - halfH - s(8);

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
      color: HEX.bone,
      fontFamily: "Space Mono",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.add(text);
  }
}
