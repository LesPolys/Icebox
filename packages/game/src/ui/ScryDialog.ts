import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import type { CardInstance } from "@icebox/shared";
import { s, fontSize as fs, MAIN_CX, GAME_H } from "./layout";
import { CardSprite, CARD_WIDTH } from "../game-objects/CardSprite";

/**
 * Dialog for the Data (scry) resource action.
 * Shows the top N cards of the market deck and lets the player reorder them
 * by clicking cards to set their order (1st click = top, 2nd = next, etc.).
 */
export class ScryDialog extends Phaser.GameObjects.Container {
  private cards: CardInstance[];
  private cardSprites: CardSprite[] = [];
  private orderLabels: Phaser.GameObjects.Text[] = [];
  private selectedOrder: number[] = [];
  private confirmBtn!: Phaser.GameObjects.Rectangle;
  private confirmLabel!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;

  public onConfirm: ((order: number[]) => void) | null = null;

  constructor(scene: Phaser.Scene, cards: CardInstance[]) {
    super(scene, MAIN_CX, GAME_H / 2);
    this.setDepth(960);
    this.cards = cards;

    const panelW = s(80) + cards.length * (CARD_WIDTH + s(16));
    const panelH = s(280);

    // Background
    const bg = scene.add.rectangle(0, 0, panelW, panelH, NUM.midnightViolet, 0.95);
    bg.setStrokeStyle(s(2), 0x4488cc, 0.8);
    this.add(bg);

    // Title
    const title = scene.add.text(0, -panelH / 2 + s(14), "SCRY: REORDER MARKET DECK", {
      fontSize: fs(12),
      color: HEX.pearlAqua,
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);
    this.add(title);

    // Instructions
    this.instructionText = scene.add.text(0, -panelH / 2 + s(32), "Click cards in the order you want (top of deck first)", {
      fontSize: fs(8),
      color: HEX.eggshell,
      fontFamily: "monospace",
    }).setOrigin(0.5, 0);
    this.add(this.instructionText);

    // Card sprites
    const startX = -(cards.length - 1) * (CARD_WIDTH + s(16)) / 2;
    for (let i = 0; i < cards.length; i++) {
      const cx = startX + i * (CARD_WIDTH + s(16));
      const cy = s(10);

      const sprite = new CardSprite(scene, cx, cy, cards[i]);
      sprite.setScale(0.85);
      sprite.setMarketMode(true);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", () => this.selectCard(i));
      this.add(sprite);
      this.cardSprites.push(sprite);

      // Order label (hidden initially)
      const orderLabel = scene.add.text(cx, cy - s(80), "", {
        fontSize: fs(16),
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
        backgroundColor: "#4488cc",
        padding: { x: 6, y: 2 },
      }).setOrigin(0.5);
      orderLabel.setVisible(false);
      this.add(orderLabel);
      this.orderLabels.push(orderLabel);
    }

    // Confirm button (disabled initially)
    const btnY = panelH / 2 - s(30);
    this.confirmBtn = scene.add.rectangle(0, btnY, s(120), s(28), 0x44cc44, 0.2);
    this.confirmBtn.setStrokeStyle(s(1), 0x44cc44, 0.4);
    this.confirmBtn.setInteractive({ useHandCursor: true });
    this.confirmBtn.on("pointerdown", () => this.confirm());
    this.add(this.confirmBtn);

    this.confirmLabel = scene.add.text(0, btnY, "Confirm", {
      fontSize: fs(10),
      color: "#88cc88",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.add(this.confirmLabel);

    this.updateConfirmState();

    // Scale-in
    this.setScale(0);
    scene.tweens.add({
      targets: this,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: "Back.easeOut",
    });

    scene.add.existing(this);
  }

  private selectCard(index: number): void {
    // If already selected, deselect it and all after it
    const existingPos = this.selectedOrder.indexOf(index);
    if (existingPos !== -1) {
      // Remove this and all subsequent selections
      const removed = this.selectedOrder.splice(existingPos);
      for (const ri of removed) {
        this.orderLabels[ri].setVisible(false);
        this.cardSprites[ri].setSelected(false);
      }
    } else if (this.selectedOrder.length < this.cards.length) {
      // Add to selection
      this.selectedOrder.push(index);
      const orderNum = this.selectedOrder.length;
      this.orderLabels[index].setText(`${orderNum}`);
      this.orderLabels[index].setVisible(true);
      this.cardSprites[index].setSelected(true);
    }

    this.updateConfirmState();
  }

  private updateConfirmState(): void {
    const ready = this.selectedOrder.length === this.cards.length;
    this.confirmBtn.setFillStyle(ready ? 0x44cc44 : 0x444444, ready ? 0.4 : 0.2);
    this.confirmBtn.setStrokeStyle(s(1), ready ? 0x44cc44 : 0x444444, ready ? 0.7 : 0.3);
    this.confirmLabel.setColor(ready ? "#44cc44" : "#666666");

    if (ready) {
      this.instructionText.setText("Ready! Click Confirm to set this order.");
    } else {
      const remaining = this.cards.length - this.selectedOrder.length;
      this.instructionText.setText(`Click ${remaining} more card${remaining !== 1 ? "s" : ""} to set order`);
    }
  }

  private confirm(): void {
    if (this.selectedOrder.length !== this.cards.length) return;
    this.onConfirm?.(this.selectedOrder);
    this.destroy();
  }
}
