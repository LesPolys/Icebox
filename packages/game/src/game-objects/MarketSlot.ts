import Phaser from "phaser";
import type { CardInstance, ResourceCost } from "@icebox/shared";
import { NUM } from "@icebox/shared";
import { CardSprite } from "./CardSprite";
import { drawResourceShape, RESOURCE_META } from "./ResourceBar";
import { s, fontSize as fs } from "../ui/layout";
import { OutlinePostFX } from "../ui/OutlineShader";

/** Scale applied to market cards so they fit cleanly in columns. */
const MARKET_CARD_SCALE = 0.72;

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

  // Crisis indicator
  private crisisTween: Phaser.Tweens.Tween | null = null;
  private crisisTextTween: Phaser.Tweens.Tween | null = null;

  // Lock indicator
  private lockGfx: Phaser.GameObjects.Graphics | null = null;

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

    this.setCrisisIndicator(false);

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

    // Collect non-zero resource entries as grouped (shape + count)
    const groups: { meta: (typeof RESOURCE_META)[number]; count: number }[] = [];
    for (const meta of RESOURCE_META) {
      const val = resource[meta.key as keyof ResourceCost] ?? 0;
      if (val > 0) groups.push({ meta, count: val });
    }
    if (groups.length === 0) return;

    const iconSize = s(8);
    const gap = s(22);
    const totalW = (groups.length - 1) * gap;
    const startX = -totalW / 2;
    const iconY = s(38); // near bottom of scaled card

    for (let i = 0; i < groups.length; i++) {
      const { meta, count } = groups[i];
      const gfx = this.scene.add.graphics();
      // Dark backing circle for contrast
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillCircle(startX + i * gap, iconY, iconSize + s(2));
      drawResourceShape(gfx, meta.shape, startX + i * gap, iconY, iconSize, meta.numColor, 0.8, 1);
      gfx.setDepth(10 + i);
      this.add(gfx);
      this.investmentIcons.push(gfx);

      // Show count number over the shape if > 1
      if (count > 1) {
        const countText = this.scene.add.text(startX + i * gap, iconY, String(count), {
          fontSize: `${s(10)}px`, color: "#ffffff", fontFamily: "Space Mono", fontStyle: "bold",
          stroke: "#000000", strokeThickness: s(2),
        }).setOrigin(0.5).setDepth(11 + i);
        this.add(countText);
        this.investmentIcons.push(countText as any);
      }
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

  /** Show or hide investment icons (used during animation). */
  setInvestmentVisible(visible: boolean): void {
    for (const icon of this.investmentIcons) icon.setVisible(visible);
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

    const hw = s(46);
    const hh = s(64);

    let color: number;
    let alpha: number;
    switch (mode) {
      case "target":
        color = NUM.chartreuse;
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

  // ── Crisis indicator ──

  /** Show/hide a shader-based perimeter outline + flashing card text for crisis cards. */
  setCrisisIndicator(active: boolean): void {
    if (this.crisisTween) { this.crisisTween.destroy(); this.crisisTween = null; }
    if (this.crisisTextTween) { this.crisisTextTween.destroy(); this.crisisTextTween = null; }

    if (!active || !this.cardSprite) {
      // Remove PostFX outline if present
      if (this.cardSprite) {
        this.cardSprite.resetPostPipeline();
      }
      return;
    }

    // Shader-based perimeter outline that follows card shape
    this.cardSprite.setPostPipeline(OutlinePostFX.KEY);
    const fx = this.cardSprite.getPostPipeline(OutlinePostFX.KEY) as OutlinePostFX | null;
    if (fx) {
      fx.setOutlineColor(204, 51, 51, 255);
      fx.setThickness(3.0);
    }

    // Pulse the outline via card alpha oscillation (subtle)
    this.crisisTween = this.scene.tweens.add({
      targets: this.cardSprite,
      scaleX: { from: this.cardSprite.scaleX, to: this.cardSprite.scaleX * 1.01 },
      scaleY: { from: this.cardSprite.scaleY, to: this.cardSprite.scaleY * 1.01 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Flash the card's name text red ↔ white
    this.crisisTextTween = this.cardSprite.flashNameText(this.scene);
  }

  // ── Lock indicator ──

  /** Show/hide a lock icon overlay for locked market slots. */
  setLocked(locked: boolean): void {
    if (this.lockGfx) { this.lockGfx.destroy(); this.lockGfx = null; }
    if (!locked) return;

    const gfx = this.scene.add.graphics();
    // Lock body
    gfx.fillStyle(0xcc3333, 0.6);
    gfx.fillRect(-s(8), -s(4), s(16), s(12));
    // Lock shackle
    gfx.lineStyle(s(2), 0xcc3333, 0.8);
    gfx.strokeCircle(0, -s(8), s(6));
    gfx.setDepth(15);
    this.add(gfx);
    this.lockGfx = gfx;
  }

  // ── Fresh investment indicator ──

  private freshInvestGfx: Phaser.GameObjects.Graphics | null = null;
  private freshInvestTween: Phaser.Tweens.Tween | null = null;

  /** Show/hide a golden glow for slots invested in this turn. */
  setFreshInvestment(fresh: boolean): void {
    if (this.freshInvestGfx) { this.freshInvestGfx.destroy(); this.freshInvestGfx = null; }
    if (this.freshInvestTween) { this.freshInvestTween.destroy(); this.freshInvestTween = null; }
    if (!fresh || !this.cardSprite) return;

    const hw = s(45);
    const hh = s(65);
    const gfx = this.scene.add.graphics();
    gfx.lineStyle(s(2), 0xddaa44, 0.8);
    gfx.strokeRoundedRect(-hw, -hh, hw * 2, hh * 2, s(4));
    gfx.setDepth(12);
    this.add(gfx);
    this.freshInvestGfx = gfx;

    this.freshInvestTween = this.scene.tweens.add({
      targets: gfx,
      alpha: { from: 0.8, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}
