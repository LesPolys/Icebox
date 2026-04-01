import Phaser from "phaser";
import type { CardInstance } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs } from "../ui/layout";
import { encodeCode128B } from "../ui/barcode";

export let CARD_WIDTH = s(120);
export let CARD_HEIGHT = s(170);

/** Recompute card dimensions after layout recalculation. */
export function recalculateCardDimensions(): void {
  CARD_WIDTH = s(120);
  CARD_HEIGHT = s(170);
}

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
  private barcodeGfx: Phaser.GameObjects.Graphics;
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
  private stressPipsGfx: Phaser.GameObjects.Graphics | null = null;
  private stressPipsTween: Phaser.Tweens.Tween | null = null;
  private statusOverlay: Phaser.GameObjects.Graphics | null = null;
  private statusLabel: Phaser.GameObjects.Text | null = null;
  private constructionBar: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, cardInstance: CardInstance) {
    super(scene, x, y);
    this.cardInstance = cardInstance;
    this.originalY = y;
    const card = cardInstance.card;

    // Background texture (generated at 2x, display at logical size)
    const textureKey = this.getTextureKey();
    this.bg = scene.add.image(0, 0, textureKey);
    this.bg.setDisplaySize(CARD_WIDTH, CARD_HEIGHT);
    this.add(this.bg);

    // Selection highlight (hidden by default)
    this.highlight = scene.add.rectangle(0, 0, CARD_WIDTH + s(8), CARD_HEIGHT + s(8));
    this.highlight.setStrokeStyle(s(4), NUM.chartreuse);
    this.highlight.setFillStyle(NUM.chartreuse, 0.12);
    this.highlight.setVisible(false);
    this.add(this.highlight);
    this.sendToBack(this.highlight);

    // Card name — fixed position below notch
    this.nameText = scene.add.text(0, s(-65), card.name, {
      fontSize: fs(9),
      color: HEX.bone,
      fontFamily: "'Orbitron', monospace",
      fontStyle: "bold",
      wordWrap: { width: CARD_WIDTH - s(16) },
      align: "center",
    });
    this.nameText.setOrigin(0.5, 0);
    this.add(this.nameText);

    // Card type
    this.typeText = scene.add.text(0, s(-38), `[${card.type.toUpperCase()}]`, {
      fontSize: fs(7),
      color: HEX.abyss,
      fontFamily: "'Space Mono', monospace",
      fontStyle: "bold",
    });
    this.typeText.setOrigin(0.5, 0);
    this.add(this.typeText);

    // Cost display
    const costParts: string[] = [];
    if (card.cost.matter) costParts.push(`M:${card.cost.matter}`);
    if (card.cost.energy) costParts.push(`E:${card.cost.energy}`);
    if (card.cost.data) costParts.push(`D:${card.cost.data}`);
    if (card.cost.influence) costParts.push(`I:${card.cost.influence}`);

    this.costText = scene.add.text(0, s(-24), costParts.join(" ") || "Free", {
      fontSize: fs(8),
      color: HEX.abyss,
      fontFamily: "'Space Mono', monospace",
      fontStyle: "bold",
    });
    this.costText.setOrigin(0.5, 0);
    this.add(this.costText);

    // Effect description — fixed zone between cost and footer
    if (card.effects.length > 0) {
      const effectDesc = scene.add.text(0, s(-6), card.effects[0].description, {
        fontSize: fs(10),
        color: HEX.abyss,
        fontFamily: "'Space Grotesk', sans-serif",
        wordWrap: { width: CARD_WIDTH - s(20) },
        align: "center",
      });
      effectDesc.setOrigin(0.5, 0);
      effectDesc.setAlpha(0.85);
      this.add(effectDesc);
    }

    // Lifespan indicator — shell footer
    const lifespanStr = cardInstance.remainingLifespan !== null
      ? `${cardInstance.remainingLifespan}`
      : "~";
    this.lifespanText = scene.add.text(CARD_WIDTH / 2 - s(10), s(57), lifespanStr, {
      fontSize: fs(8),
      color: HEX.concrete,
      fontFamily: "'Space Mono', monospace",
    });
    this.lifespanText.setOrigin(1, 0.5);
    this.add(this.lifespanText);

    // Code 128 barcode — scaled to fit card width
    const barcodeWidths = encodeCode128B(card.id);
    this.barcodeGfx = scene.add.graphics();
    let totalUnits = 0;
    for (const bw of barcodeWidths) totalUnits += bw;
    const maxBarcodeW = CARD_WIDTH - s(24);
    const unitW = maxBarcodeW / totalUnits;
    const barcodeH = s(8);
    const barcodeStartX = -maxBarcodeW / 2;
    const barcodeY = s(67);
    let bx = barcodeStartX;
    for (let bi = 0; bi < barcodeWidths.length; bi++) {
      const w = barcodeWidths[bi] * unitW;
      if (bi % 2 === 0) {
        this.barcodeGfx.fillStyle(NUM.graphite, 0.5);
        this.barcodeGfx.fillRect(bx, barcodeY, w, barcodeH);
      }
      bx += w;
    }
    this.add(this.barcodeGfx);

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

  getTextureKey(): string {
    const card = this.cardInstance.card;
    if (card.type === "junk") return "card-junk";
    if (card.type === "crisis") return "card-crisis";
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

  /** Flash the card name text between bone and red for crisis indication. Returns the tween. */
  flashNameText(scene: Phaser.Scene): Phaser.Tweens.Tween {
    const nameRef = this.nameText;
    return scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        const val = tween.getValue() ?? 0;
        // Interpolate bone (#F5F0E0) → red (#CC3333)
        const cr = Math.round(0xF5 + (0xCC - 0xF5) * (val as number));
        const cg = Math.round(0xF0 + (0x33 - 0xF0) * (val as number));
        const cb = Math.round(0xE0 + (0x33 - 0xE0) * (val as number));
        nameRef.setColor(`#${cr.toString(16).padStart(2, "0")}${cg.toString(16).padStart(2, "0")}${cb.toString(16).padStart(2, "0")}`);
      },
    });
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

  /**
   * Draw stress pips for crew cards.
   * Filled circles = remaining stress, empty circles = lost stress.
   * At 1 remaining stress, pips pulse red as a burnout warning.
   */
  setStressPips(currentStress: number, maxStress: number): void {
    // Clean up previous
    if (this.stressPipsGfx) {
      this.stressPipsGfx.destroy();
      this.stressPipsGfx = null;
    }
    if (this.stressPipsTween) {
      this.stressPipsTween.destroy();
      this.stressPipsTween = null;
    }

    if (maxStress <= 0) return;

    const gfx = this.scene.add.graphics();
    const pipRadius = s(4);
    const gap = s(10);
    const totalW = (maxStress - 1) * gap;
    const startX = -totalW / 2;
    const pipY = CARD_HEIGHT / 2 - s(8);

    for (let i = 0; i < maxStress; i++) {
      const cx = startX + i * gap;
      if (i < currentStress) {
        // Filled pip (remaining stress)
        gfx.fillStyle(0x55cc55, 0.9);
        gfx.fillCircle(cx, pipY, pipRadius);
        gfx.lineStyle(s(1), 0x338833, 0.8);
        gfx.strokeCircle(cx, pipY, pipRadius);
      } else {
        // Empty pip (lost stress)
        gfx.fillStyle(0x444444, 0.4);
        gfx.fillCircle(cx, pipY, pipRadius);
        gfx.lineStyle(s(1), 0x666666, 0.5);
        gfx.strokeCircle(cx, pipY, pipRadius);
      }
    }

    this.add(gfx);
    this.stressPipsGfx = gfx;

    // Burnout warning: pulse red at 1 remaining stress
    if (currentStress === 1) {
      this.stressPipsTween = this.scene.tweens.add({
        targets: gfx,
        alpha: { from: 1, to: 0.3 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  /**
   * Show a damage overlay on structures (cracked/sparking visual).
   * Call with "damaged" for a cracked appearance.
   */
  setDamageOverlay(active: boolean): void {
    if (this.statusOverlay) {
      this.statusOverlay.destroy();
      this.statusOverlay = null;
    }
    if (this.statusLabel) {
      this.statusLabel.destroy();
      this.statusLabel = null;
    }

    if (!active) return;

    const gfx = this.scene.add.graphics();
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;

    // Semi-transparent red overlay
    gfx.fillStyle(0xcc4444, 0.1);
    gfx.fillRect(-hw, -hh, CARD_WIDTH, CARD_HEIGHT);

    // Crack lines
    gfx.lineStyle(s(2), 0xcc4444, 0.5);
    gfx.lineBetween(-hw * 0.3, -hh * 0.6, hw * 0.1, 0);
    gfx.lineBetween(hw * 0.1, 0, -hw * 0.1, hh * 0.5);
    gfx.lineBetween(hw * 0.1, 0, hw * 0.4, hh * 0.3);

    // Spark dots
    gfx.fillStyle(0xffaa44, 0.6);
    gfx.fillCircle(hw * 0.1, 0, s(2));
    gfx.fillCircle(-hw * 0.2, hh * 0.2, s(1.5));

    this.add(gfx);
    this.statusOverlay = gfx;

    const label = this.scene.add.text(0, -hh + s(6), "DAMAGED", {
      fontSize: fs(7),
      color: "#cc4444",
      fontFamily: "Space Mono",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);
    this.add(label);
    this.statusLabel = label;
  }

  /**
   * Show an under-construction overlay with scaffolding and progress bar.
   * @param progress  Turns elapsed (0 to completionTime)
   * @param total     Total turns required (0 means resource-only)
   */
  setConstructionOverlay(active: boolean, progress = 0, total = 0): void {
    if (this.statusOverlay) {
      this.statusOverlay.destroy();
      this.statusOverlay = null;
    }
    if (this.statusLabel) {
      this.statusLabel.destroy();
      this.statusLabel = null;
    }
    if (this.constructionBar) {
      this.constructionBar.destroy();
      this.constructionBar = null;
    }

    if (!active) return;

    const gfx = this.scene.add.graphics();
    const hw = CARD_WIDTH / 2;
    const hh = CARD_HEIGHT / 2;

    // Scaffolding overlay — semi-transparent with hash pattern
    gfx.fillStyle(0x886644, 0.12);
    gfx.fillRect(-hw, -hh, CARD_WIDTH, CARD_HEIGHT);

    // Scaffolding lines (diagonal hatching)
    gfx.lineStyle(s(1), 0x886644, 0.25);
    for (let i = -6; i <= 6; i++) {
      const offset = i * s(20);
      gfx.lineBetween(-hw + offset, -hh, -hw + offset + CARD_HEIGHT, hh);
    }

    // Scaffold frame
    gfx.lineStyle(s(2), 0xaa8844, 0.4);
    gfx.strokeRect(-hw + s(4), -hh + s(4), CARD_WIDTH - s(8), CARD_HEIGHT - s(8));

    this.add(gfx);
    this.statusOverlay = gfx;

    // Label
    const label = this.scene.add.text(0, -hh + s(6), "BUILDING", {
      fontSize: fs(7),
      color: "#aa8844",
      fontFamily: "Space Mono",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);
    this.add(label);
    this.statusLabel = label;

    // Progress bar (only shown if time-based)
    if (total > 0) {
      const barGfx = this.scene.add.graphics();
      const barW = CARD_WIDTH - s(20);
      const barH = s(6);
      const barX = -barW / 2;
      const barY = hh - s(16);
      const fillFraction = Math.min(1, progress / total);

      // Background
      barGfx.fillStyle(0x333333, 0.6);
      barGfx.fillRect(barX, barY, barW, barH);

      // Fill
      if (fillFraction > 0) {
        barGfx.fillStyle(0xaa8844, 0.8);
        barGfx.fillRect(barX, barY, barW * fillFraction, barH);
      }

      // Border
      barGfx.lineStyle(s(1), 0xaa8844, 0.5);
      barGfx.strokeRect(barX, barY, barW, barH);

      this.add(barGfx);
      this.constructionBar = barGfx;
    }
  }
}
