import Phaser from "phaser";
import type { CardInstance, ResourceCost } from "@icebox/shared";
import { NUM } from "@icebox/shared";
import { CardSprite } from "./CardSprite";
import { drawResourceShape, RESOURCE_META } from "./ResourceBar";
import { s } from "../ui/layout";

/** Scale applied to market cards so they fit cleanly in columns. */
const MARKET_CARD_SCALE = 0.55;

type PurchaseHighlight = "target" | "needs-invest" | "invested" | null;

/**
 * A single slot in the Transit Market conveyor.
 * Cards are displayed at reduced scale.
 * Supports investment indicators, purchase highlights, and ghost icons.
 */
export class MarketSlot extends Phaser.GameObjects.Container {
  public slotIndex: number;
  public cardSprite: CardSprite | null = null;
  private emptySlot: Phaser.GameObjects.Image;

  // Investment visuals
  private investmentIcons: Phaser.GameObjects.Graphics[] = [];
  private investmentGhost: Phaser.GameObjects.Graphics | null = null;

  // Purchase highlight
  private highlightGfx: Phaser.GameObjects.Graphics;
  private highlightMode: PurchaseHighlight = null;
  private highlightTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, slotIndex: number, scaled = false) {
    super(scene, x, y);
    this.slotIndex = slotIndex;

    // Empty slot visual — also scaled if market uses smaller cards
    this.emptySlot = scene.add.image(0, 0, "card-empty");
    if (scaled) this.emptySlot.setScale(MARKET_CARD_SCALE);
    this.add(this.emptySlot);

    // Highlight rectangle (hidden by default)
    this.highlightGfx = scene.add.graphics();
    this.highlightGfx.setVisible(false);
    this.add(this.highlightGfx);

    scene.add.existing(this);
  }

  setCard(cardInstance: CardInstance | null): void {
    if (this.cardSprite) {
      this.cardSprite.destroy();
      this.cardSprite = null;
    }

    if (cardInstance) {
      this.emptySlot.setVisible(false);
      this.cardSprite = new CardSprite(this.scene, 0, 0, cardInstance);
      this.cardSprite.setScale(MARKET_CARD_SCALE);
      this.cardSprite.setMarketMode(true);
      this.add(this.cardSprite);
    } else {
      this.emptySlot.setVisible(true);
    }
  }

  clearCard(): void {
    this.setCard(null);
  }

  // ── Investment visuals ──

  /** Show invested resource icons on the card, arranged horizontally at the bottom. */
  setInvestment(resource: ResourceCost | null): void {
    for (const icon of this.investmentIcons) icon.destroy();
    this.investmentIcons = [];
    if (!resource) return;

    // Collect all non-zero resource entries, expanded (e.g., matter:2 → 2 hexagons)
    const icons: (typeof RESOURCE_META)[number][] = [];
    for (const meta of RESOURCE_META) {
      const val = resource[meta.key as keyof ResourceCost] ?? 0;
      for (let n = 0; n < val; n++) icons.push(meta);
    }
    if (icons.length === 0) return;

    const iconSize = s(8);
    const gap = s(14);
    const totalW = (icons.length - 1) * gap;
    const startX = -totalW / 2;
    const iconY = s(38); // near bottom of scaled card

    for (let i = 0; i < icons.length; i++) {
      const gfx = this.scene.add.graphics();
      // Draw a small dark backing circle for contrast
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillCircle(startX + i * gap, iconY, iconSize + s(2));
      drawResourceShape(gfx, icons[i].shape, startX + i * gap, iconY, iconSize, icons[i].numColor, 0.8, 1);
      gfx.setDepth(10 + i);
      this.add(gfx);
      this.investmentIcons.push(gfx);
    }
  }

  /** Show/hide a ghost "?" circle to preview that investment is needed. */
  showInvestmentGhost(visible: boolean): void {
    if (visible && !this.investmentGhost) {
      const ghost = this.scene.add.graphics();
      ghost.fillStyle(0xaaaaaa, 0.3);
      ghost.fillCircle(0, 0, s(12));
      ghost.lineStyle(s(1), 0xaaaaaa, 0.5);
      ghost.strokeCircle(0, 0, s(12));
      this.add(ghost);
      this.investmentGhost = ghost;
    } else if (!visible && this.investmentGhost) {
      this.investmentGhost.destroy();
      this.investmentGhost = null;
    }
  }

  // ── Purchase mode highlights ──

  setPurchaseHighlight(mode: PurchaseHighlight): void {
    if (this.highlightTween) {
      this.highlightTween.destroy();
      this.highlightTween = null;
    }

    this.highlightMode = mode;
    this.highlightGfx.clear();

    if (!mode) {
      this.highlightGfx.setVisible(false);
      this.highlightGfx.setAlpha(1);
      return;
    }

    const hw = s(36);
    const hh = s(52);

    let color: number;
    let alpha: number;
    switch (mode) {
      case "target":
        color = NUM.darkCyan;
        alpha = 0.7;
        break;
      case "needs-invest":
        color = 0xddaa44; // amber/gold
        alpha = 0.6;
        break;
      case "invested":
        color = 0x44cc44; // green
        alpha = 0.6;
        break;
    }

    this.highlightGfx.lineStyle(s(2.5), color, alpha);
    this.highlightGfx.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, s(4));
    this.highlightGfx.setVisible(true);

    if (mode === "needs-invest") {
      // Pulse for attention
      this.highlightTween = this.scene.tweens.add({
        targets: this.highlightGfx,
        alpha: { from: 1, to: 0.4 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }
}
