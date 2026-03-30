import Phaser from "phaser";
import type { CardInstance } from "@icebox/shared";
import { FACTIONS, NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs, GAME_W, GAME_H } from "./layout";

const PANEL_W = s(220);
const PANEL_H = s(300);
const EDGE_MARGIN = s(12);

/**
 * Tooltip-style detail panel that follows the mouse pointer.
 * Automatically constrained to stay within the game viewport.
 */
export class InfoPanel extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private typeText: Phaser.GameObjects.Text;
  private costText: Phaser.GameObjects.Text;
  private factionText: Phaser.GameObjects.Text;
  private effectsText: Phaser.GameObjects.Text;
  private lifespanText: Phaser.GameObjects.Text;
  private flavorText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    // Background — origin (0,0) is the top-left of the panel
    this.bg = scene.add.rectangle(0, 0, PANEL_W, PANEL_H, NUM.slab, 0.95);
    this.bg.setStrokeStyle(s(1), NUM.graphite);
    this.bg.setOrigin(0, 0);
    this.add(this.bg);

    let yPos = s(10);
    const textX = PANEL_W / 2;

    this.nameText = scene.add.text(textX, yPos, "", {
      fontSize: fs(14), color: HEX.bone, fontFamily: "'Orbitron', monospace", fontStyle: "bold",
      wordWrap: { width: PANEL_W - s(20) }, align: "center",
    }).setOrigin(0.5, 0);
    this.add(this.nameText);

    yPos += s(30);
    this.typeText = scene.add.text(textX, yPos, "", {
      fontSize: fs(10), color: HEX.teal, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5, 0);
    this.add(this.typeText);

    yPos += s(20);
    this.factionText = scene.add.text(textX, yPos, "", {
      fontSize: fs(10), color: HEX.teal, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5, 0);
    this.add(this.factionText);

    yPos += s(20);
    this.costText = scene.add.text(textX, yPos, "", {
      fontSize: fs(10), color: HEX.chartreuse, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5, 0);
    this.add(this.costText);

    yPos += s(25);
    this.effectsText = scene.add.text(textX, yPos, "", {
      fontSize: fs(9), color: HEX.glow, fontFamily: "'Space Grotesk', sans-serif",
      wordWrap: { width: PANEL_W - s(20) }, align: "center",
    }).setOrigin(0.5, 0);
    this.add(this.effectsText);

    yPos += s(80);
    this.lifespanText = scene.add.text(textX, yPos, "", {
      fontSize: fs(9), color: HEX.concrete, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5, 0);
    this.add(this.lifespanText);

    yPos += s(20);
    this.flavorText = scene.add.text(textX, yPos, "", {
      fontSize: fs(8), color: HEX.concrete, fontFamily: "'Space Grotesk', sans-serif", fontStyle: "italic",
      wordWrap: { width: PANEL_W - s(20) }, align: "center",
    }).setOrigin(0.5, 0);
    this.add(this.flavorText);

    this.setVisible(false);
    this.setDepth(1000);
    scene.add.existing(this);

    // Follow the pointer every frame
    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.visible) return;
      this.positionNearPointer(pointer.x, pointer.y);
    });
  }

  /** Place the panel near the pointer, clamped so it stays fully on-screen. */
  private positionNearPointer(px: number, py: number): void {
    const offset = s(16);

    // Try placing to the right of the pointer
    let x = px + offset;
    let y = py - PANEL_H / 2;

    // If it would go off the right edge, flip to the left
    if (x + PANEL_W > GAME_W - EDGE_MARGIN) {
      x = px - PANEL_W - offset;
    }
    if (x < EDGE_MARGIN) x = EDGE_MARGIN;

    // Clamp vertical
    if (y < EDGE_MARGIN) y = EDGE_MARGIN;
    if (y + PANEL_H > GAME_H - EDGE_MARGIN) y = GAME_H - PANEL_H - EDGE_MARGIN;

    this.setPosition(x, y);
  }

  showCard(cardInst: CardInstance): void {
    const card = cardInst.card;

    this.nameText.setText(card.name);
    this.typeText.setText(`${card.type.toUpperCase()} — Tier ${card.tier}`);

    if (card.faction !== "neutral" && FACTIONS[card.faction]) {
      this.factionText.setText(FACTIONS[card.faction].name);
      this.factionText.setColor(FACTIONS[card.faction].color);
    } else {
      this.factionText.setText("Neutral");
      this.factionText.setColor(HEX.teal);
    }

    const costParts: string[] = [];
    if (card.cost.matter) costParts.push(`Matter: ${card.cost.matter}`);
    if (card.cost.energy) costParts.push(`Energy: ${card.cost.energy}`);
    if (card.cost.data) costParts.push(`Data: ${card.cost.data}`);
    if (card.cost.influence) costParts.push(`Influence: ${card.cost.influence}`);
    this.costText.setText(costParts.length > 0 ? costParts.join(" | ") : "Free");

    const effectDescs = card.effects.map((e) => `• ${e.description}`).join("\n");
    this.effectsText.setText(effectDescs || "No effects.");

    if (cardInst.remainingLifespan !== null) {
      this.lifespanText.setText(`Lifespan: ${cardInst.remainingLifespan} cycles`);
    } else {
      this.lifespanText.setText("Immortal");
    }

    this.flavorText.setText(card.flavorText ?? "");

    // Position at current pointer
    const pointer = this.scene.input.activePointer;
    this.positionNearPointer(pointer.x, pointer.y);

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }
}
