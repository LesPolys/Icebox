import Phaser from "phaser";
import type { CardInstance } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs } from "../ui/layout";

export const CARD_WIDTH = s(120);
export const CARD_HEIGHT = s(170);

/**
 * Visual representation of a card. Colored rectangle with text overlay.
 * Supports two modes:
 *   - Normal (hand): bigger hover lift, drag-compatible
 *   - Market: subtle hover, no lift (cards are already scaled small)
 */
export class CardSprite extends Phaser.GameObjects.Container {
  public cardInstance: CardInstance;
  private bg: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private costText: Phaser.GameObjects.Text;
  private factionText: Phaser.GameObjects.Text;
  private typeText: Phaser.GameObjects.Text;
  private lifespanText: Phaser.GameObjects.Text;
  private highlight: Phaser.GameObjects.Rectangle;
  public selected = false;
  private originalY = 0;
  private marketMode = false;
  private baseScale = 1;
  private dragGhostActive = false;
  private affordableOverlay: Phaser.GameObjects.Graphics | null = null;
  private isAffordable = true;

  constructor(scene: Phaser.Scene, x: number, y: number, cardInstance: CardInstance) {
    super(scene, x, y);
    this.cardInstance = cardInstance;
    this.originalY = y;
    const card = cardInstance.card;

    // Background texture
    const textureKey = this.getTextureKey();
    this.bg = scene.add.image(0, 0, textureKey);
    this.add(this.bg);

    // Selection highlight (hidden by default)
    this.highlight = scene.add.rectangle(0, 0, CARD_WIDTH + s(8), CARD_HEIGHT + s(8));
    this.highlight.setStrokeStyle(s(4), NUM.chartreuse);
    this.highlight.setFillStyle(NUM.chartreuse, 0.12);
    this.highlight.setVisible(false);
    this.add(this.highlight);
    this.sendToBack(this.highlight);

    // Card name — Orbitron bold, bone
    this.nameText = scene.add.text(0, s(-65), card.name, {
      fontSize: fs(10),
      color: HEX.bone,
      fontFamily: "'Orbitron', monospace",
      fontStyle: "bold",
      wordWrap: { width: CARD_WIDTH - s(12) },
      align: "center",
    });
    this.nameText.setOrigin(0.5, 0);
    this.add(this.nameText);

    // Card type — Space Mono, teal
    this.typeText = scene.add.text(0, s(-40), `[${card.type.toUpperCase()}]`, {
      fontSize: fs(8),
      color: HEX.teal,
      fontFamily: "'Space Mono', monospace",
    });
    this.typeText.setOrigin(0.5, 0);
    this.add(this.typeText);

    // Cost display — teal
    const costParts: string[] = [];
    if (card.cost.matter) costParts.push(`M:${card.cost.matter}`);
    if (card.cost.energy) costParts.push(`E:${card.cost.energy}`);
    if (card.cost.data) costParts.push(`D:${card.cost.data}`);
    if (card.cost.influence) costParts.push(`I:${card.cost.influence}`);

    this.costText = scene.add.text(0, s(-25), costParts.join(" ") || "Free", {
      fontSize: fs(9),
      color: HEX.chartreuse,
      fontFamily: "'Space Mono', monospace",
      fontStyle: "bold",
    });
    this.costText.setOrigin(0.5, 0);
    this.add(this.costText);

    // Faction — graphite on the shell footer area
    const factionLabel = card.faction === "neutral" ? "Neutral" : card.faction.toUpperCase();
    this.factionText = scene.add.text(0, CARD_HEIGHT / 2 - s(12), factionLabel, {
      fontSize: fs(7),
      color: HEX.graphite,
      fontFamily: "'Space Mono', monospace",
    });
    this.factionText.setOrigin(0.5, 0);
    this.add(this.factionText);

    // Effect description — Space Grotesk, glow
    if (card.effects.length > 0) {
      const effectDesc = scene.add.text(0, s(25), card.effects[0].description, {
        fontSize: fs(7),
        color: HEX.glow,
        fontFamily: "'Space Grotesk', sans-serif",
        wordWrap: { width: CARD_WIDTH - s(16) },
        align: "center",
      });
      effectDesc.setOrigin(0.5, 0);
      effectDesc.setAlpha(0.85);
      this.add(effectDesc);
    }

    // Lifespan indicator
    const lifespanStr = cardInstance.remainingLifespan !== null
      ? `${cardInstance.remainingLifespan}`
      : "~";
    this.lifespanText = scene.add.text(CARD_WIDTH / 2 - s(10), CARD_HEIGHT / 2 - s(26), lifespanStr, {
      fontSize: fs(8),
      color: HEX.concrete,
      fontFamily: "'Space Mono', monospace",
    });
    this.lifespanText.setOrigin(1, 0.5);
    this.add(this.lifespanText);

    // Powered indicator
    if (!cardInstance.powered) {
      const depowered = scene.add.text(0, s(55), "[DEPOWERED]", {
        fontSize: fs(8),
        color: HEX.signalRed,
        fontFamily: "'Space Mono', monospace",
      });
      depowered.setOrigin(0.5, 0);
      this.add(depowered);
    }

    // Make interactive
    this.setSize(CARD_WIDTH, CARD_HEIGHT);
    this.setInteractive({ useHandCursor: true });

    // Hover effects
    this.on("pointerover", () => {
      if (this.marketMode) {
        // Market: subtle brightness only, no scale/lift
        this.setAlpha(1);
        this.setDepth(50);
      } else if (!this.selected) {
        this.setScale(this.baseScale * 1.15);
        this.y = this.originalY - s(20);
        this.setDepth(100);
      }
    });
    this.on("pointerout", () => {
      if (this.marketMode) {
        this.setAlpha(0.95);
        this.setDepth(0);
      } else if (!this.selected) {
        this.setScale(this.baseScale);
        this.y = this.originalY;
        this.setDepth(0);
      }
    });

    scene.add.existing(this);
  }

  private getTextureKey(): string {
    const card = this.cardInstance.card;
    if (card.type === "junk") return "card-junk";
    if (card.faction === "neutral") return "card-neutral";
    return `card-${card.faction}`;
  }

  /** Enable market mode — no hover lift, subtle feedback only */
  setMarketMode(enabled: boolean): void {
    this.marketMode = enabled;
    if (enabled) this.setAlpha(0.95);
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.highlight.setVisible(selected);
    if (selected) {
      this.setScale(this.baseScale * 1.15);
      this.y = this.originalY - s(20);
      this.setDepth(100);
    } else {
      this.setScale(this.baseScale);
      this.y = this.originalY;
      this.setDepth(0);
    }
  }

  /** Update the stored original Y (used when parent repositions cards) */
  setOriginalY(y: number): void {
    this.originalY = y;
  }

  /** Store the base scale for hover calculations */
  setBaseScale(s: number): void {
    this.baseScale = s;
  }

  /** Update display after card instance changes */
  refresh(): void {
    const lifespanStr = this.cardInstance.remainingLifespan !== null
      ? `${this.cardInstance.remainingLifespan}`
      : "~";
    this.lifespanText.setText(lifespanStr);
  }

  /** Visual state for when this card is being dragged out of hand to a target. */
  setDragGhost(enabled: boolean): void {
    this.dragGhostActive = enabled;
    if (enabled) {
      this.setAlpha(0.6);
      this.highlight.setStrokeStyle(s(4), NUM.chartreuse);
      this.highlight.setFillStyle(NUM.chartreuse, 0.15);
      this.highlight.setVisible(true);
    } else {
      this.setAlpha(1);
      this.highlight.setStrokeStyle(s(4), NUM.chartreuse);
      this.highlight.setFillStyle(NUM.chartreuse, 0.12);
      if (!this.selected) this.highlight.setVisible(false);
    }
  }

  /** Show/hide a red X overlay when the player can't afford this card. */
  setAffordable(canAfford: boolean): void {
    this.isAffordable = canAfford;
    if (!canAfford) {
      if (!this.affordableOverlay) {
        const gfx = this.scene.add.graphics();
        const hw = CARD_WIDTH * 0.3;
        const hh = CARD_HEIGHT * 0.3;
        gfx.lineStyle(s(4), 0xff3333, 0.7);
        gfx.lineBetween(-hw, -hh, hw, hh);
        gfx.lineBetween(hw, -hh, -hw, hh);
        this.add(gfx);
        this.affordableOverlay = gfx;
      }
      this.affordableOverlay.setVisible(true);
    } else {
      if (this.affordableOverlay) {
        this.affordableOverlay.setVisible(false);
      }
    }
  }
}
