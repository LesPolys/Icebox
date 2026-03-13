import Phaser from "phaser";
import type { CardInstance } from "@icebox/shared";
import { FACTIONS, NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs } from "./layout";

/**
 * Detail panel that shows full card information on hover/select.
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

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const panelW = s(220);
    const panelH = s(300);

    this.bg = scene.add.rectangle(0, 0, panelW, panelH, NUM.midnightViolet, 0.95);
    this.bg.setStrokeStyle(s(1), NUM.charcoalBlue);
    this.add(this.bg);

    let yPos = s(-130);

    this.nameText = scene.add.text(0, yPos, "", {
      fontSize: fs(14), color: HEX.eggshell, fontFamily: "monospace", fontStyle: "bold",
      wordWrap: { width: panelW - s(20) }, align: "center",
    }).setOrigin(0.5, 0);
    this.add(this.nameText);

    yPos += s(30);
    this.typeText = scene.add.text(0, yPos, "", {
      fontSize: fs(10), color: HEX.darkCyan, fontFamily: "monospace",
    }).setOrigin(0.5, 0);
    this.add(this.typeText);

    yPos += s(20);
    this.factionText = scene.add.text(0, yPos, "", {
      fontSize: fs(10), color: HEX.darkCyan, fontFamily: "monospace",
    }).setOrigin(0.5, 0);
    this.add(this.factionText);

    yPos += s(20);
    this.costText = scene.add.text(0, yPos, "", {
      fontSize: fs(10), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5, 0);
    this.add(this.costText);

    yPos += s(25);
    this.effectsText = scene.add.text(0, yPos, "", {
      fontSize: fs(9), color: HEX.pearlAqua, fontFamily: "monospace",
      wordWrap: { width: panelW - s(20) }, align: "center",
    }).setOrigin(0.5, 0);
    this.add(this.effectsText);

    yPos += s(80);
    this.lifespanText = scene.add.text(0, yPos, "", {
      fontSize: fs(9), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5, 0);
    this.add(this.lifespanText);

    yPos += s(20);
    this.flavorText = scene.add.text(0, yPos, "", {
      fontSize: fs(8), color: HEX.darkCyan, fontFamily: "monospace", fontStyle: "italic",
      wordWrap: { width: panelW - s(20) }, align: "center",
    }).setOrigin(0.5, 0);
    this.add(this.flavorText);

    this.setVisible(false);
    scene.add.existing(this);
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
      this.factionText.setColor(HEX.darkCyan);
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

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }
}
