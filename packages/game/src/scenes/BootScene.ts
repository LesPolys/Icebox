import Phaser from "phaser";
import type { Card } from "@icebox/shared";
import { FACTIONS, NUM } from "@icebox/shared";
import coreSetData from "../../../shared/data/cards/core-set.json";
import { s, fontSize, GAME_W, GAME_H } from "../ui/layout";
import { MainMenuScene } from "./MainMenuScene";

/**
 * Boot scene: loads card data and generates Barok-styled textures.
 */
export class BootScene extends Phaser.Scene {
  static readonly KEY = "BootScene";
  static cardDefinitions: Card[] = [];

  constructor() {
    super(BootScene.KEY);
  }

  preload(): void {
    const text = this.add.text(GAME_W / 2, GAME_H / 2, "Loading Icebox...", {
      fontSize: fontSize(24),
      color: "#00CCAA",
      fontFamily: "Orbitron, monospace",
    });
    text.setOrigin(0.5);
  }

  async create(): Promise<void> {
    // Wait for Google Fonts to load before generating textures with text
    await document.fonts.ready;

    BootScene.cardDefinitions = (coreSetData as { cards: Card[] }).cards;
    console.log(`Loaded ${BootScene.cardDefinitions.length} card definitions`);

    this.generateCardTextures();
    this.generateUITextures();

    this.scene.start(MainMenuScene.KEY);
  }

  /* ── Helper: draw a 4-pointed sparkle star ── */
  private drawSparkle(gfx: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, alpha: number): void {
    gfx.fillStyle(color, alpha);
    const s2 = size * 0.3;
    gfx.fillPoints([
      { x, y: y - size },
      { x: x + s2, y: y - s2 },
      { x: x + size, y },
      { x: x + s2, y: y + s2 },
      { x, y: y + size },
      { x: x - s2, y: y + s2 },
      { x: x - size, y },
      { x: x - s2, y: y - s2 },
    ], true);
  }

  /* ── Helper: draw a barcode pattern ── */
  private drawBarcode(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number): void {
    gfx.fillStyle(color, alpha);
    const barWidths = [2, 1, 3, 1, 2, 1, 2, 1];
    let bx = x;
    for (let i = 0; i < barWidths.length && bx < x + w; i++) {
      const bw = s(barWidths[i]);
      if (i % 2 === 0) gfx.fillRect(bx, y, bw, h);
      bx += bw + s(1);
    }
  }

  /* ── Helper: draw a dot grid ── */
  private drawDotGrid(gfx: Phaser.GameObjects.Graphics, x: number, y: number, cols: number, rows: number, gap: number, dotR: number, color: number, alpha: number): void {
    gfx.fillStyle(color, alpha);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        gfx.fillCircle(x + c * gap, y + r * gap, dotR);
      }
    }
  }

  /* ── Helper: draw the warm gray card shell with notch ── */
  private drawCardShell(gfx: Phaser.GameObjects.Graphics, cardW: number, cardH: number, borderColor: number, borderAlpha: number): void {
    const shellR = s(18);
    // Warm gray outer shell
    gfx.fillStyle(NUM.warmGray, 1);
    gfx.fillRoundedRect(0, 0, cardW, cardH, shellR);

    // Notch cutout at top center (darker indent)
    const notchW = s(36);
    const notchH = s(8);
    const notchX = (cardW - notchW) / 2;
    gfx.fillStyle(NUM.graphite, 0.4);
    gfx.fillRoundedRect(notchX, 0, notchW, notchH, { tl: 0, tr: 0, bl: s(4), br: s(4) });

    // Shell border
    gfx.lineStyle(s(2), borderColor, borderAlpha);
    gfx.strokeRoundedRect(0, 0, cardW, cardH, shellR);
  }

  /* ── Helper: draw the inner panel ── */
  private drawInnerPanel(gfx: Phaser.GameObjects.Graphics, cardW: number, cardH: number, color: number, alpha: number): void {
    const inset = s(8);
    const innerR = s(12);
    const footerH = s(22); // space for faction footer on the shell
    gfx.fillStyle(color, alpha);
    gfx.fillRoundedRect(inset, inset + s(6), cardW - inset * 2, cardH - inset * 2 - footerH, innerR);
  }

  private generateCardTextures(): void {
    const cardW = s(120);
    const cardH = s(170);
    const inset = s(8);
    const footerH = s(22);
    const innerTop = inset + s(6);
    const innerW = cardW - inset * 2;
    const innerH = cardH - inset * 2 - footerH;

    // ── Card back ──
    const backGfx = this.add.graphics();
    this.drawCardShell(backGfx, cardW, cardH, NUM.graphite, 0.8);
    // Void inner panel
    this.drawInnerPanel(backGfx, cardW, cardH, NUM.void, 0.95);
    // Teal diamond centered on inner panel
    const cx = cardW / 2;
    const cy = innerTop + innerH / 2;
    const dSize = s(22);
    backGfx.fillStyle(NUM.teal, 0.4);
    backGfx.fillPoints([
      { x: cx, y: cy - dSize },
      { x: cx + dSize * 0.7, y: cy },
      { x: cx, y: cy + dSize },
      { x: cx - dSize * 0.7, y: cy },
    ], true);
    backGfx.lineStyle(s(1), NUM.teal, 0.7);
    backGfx.strokePoints([
      { x: cx, y: cy - dSize },
      { x: cx + dSize * 0.7, y: cy },
      { x: cx, y: cy + dSize },
      { x: cx - dSize * 0.7, y: cy },
    ], true);
    // Sparkle stars
    this.drawSparkle(backGfx, inset + s(14), innerTop + s(10), s(5), NUM.chartreuse, 0.3);
    this.drawSparkle(backGfx, cardW - inset - s(14), innerTop + innerH - s(10), s(4), NUM.chartreuse, 0.25);
    // Holographic strip (3 thin lines approximating gradient)
    const stripY = innerTop + innerH * 0.72;
    backGfx.fillStyle(0x8833BB, 0.25);
    backGfx.fillRect(inset + s(4), stripY, innerW - s(8), s(2));
    backGfx.fillStyle(NUM.teal, 0.3);
    backGfx.fillRect(inset + s(4), stripY + s(3), innerW - s(8), s(2));
    backGfx.fillStyle(NUM.chartreuse, 0.25);
    backGfx.fillRect(inset + s(4), stripY + s(6), innerW - s(8), s(2));
    // Barcode on shell footer
    this.drawBarcode(backGfx, cardW - s(40), cardH - s(16), s(32), s(10), NUM.graphite, 0.4);
    backGfx.generateTexture("card-back", cardW, cardH);
    backGfx.destroy();

    // ── Faction cards ──
    for (const [factionId, faction] of Object.entries(FACTIONS)) {
      const color = Phaser.Display.Color.HexStringToColor(faction.color).color;
      const gfx = this.add.graphics();
      this.drawCardShell(gfx, cardW, cardH, NUM.graphite, 0.7);
      this.drawInnerPanel(gfx, cardW, cardH, color, 0.7);
      // Sparkle star on inner panel
      this.drawSparkle(gfx, inset + s(12), innerTop + s(10), s(4), color, 0.35);
      // Dot grid top-right of inner panel
      this.drawDotGrid(gfx, cardW - inset - s(18), innerTop + s(8), 3, 2, s(4), s(1), NUM.concrete, 0.3);
      // Barcode on shell footer
      this.drawBarcode(gfx, cardW - s(40), cardH - s(16), s(32), s(10), NUM.graphite, 0.4);
      gfx.generateTexture(`card-${factionId}`, cardW, cardH);
      gfx.destroy();
    }

    // ── Neutral card ──
    const neutralGfx = this.add.graphics();
    this.drawCardShell(neutralGfx, cardW, cardH, NUM.graphite, 0.7);
    this.drawInnerPanel(neutralGfx, cardW, cardH, NUM.concrete, 0.5);
    this.drawDotGrid(neutralGfx, cardW - inset - s(18), innerTop + s(8), 3, 2, s(4), s(1), NUM.concrete, 0.2);
    this.drawBarcode(neutralGfx, cardW - s(40), cardH - s(16), s(32), s(10), NUM.graphite, 0.35);
    neutralGfx.generateTexture("card-neutral", cardW, cardH);
    neutralGfx.destroy();

    // ── Junk card ──
    const junkGfx = this.add.graphics();
    this.drawCardShell(junkGfx, cardW, cardH, NUM.graphite, 0.5);
    this.drawInnerPanel(junkGfx, cardW, cardH, NUM.signalRed, 0.3);
    this.drawBarcode(junkGfx, cardW - s(40), cardH - s(16), s(32), s(10), NUM.graphite, 0.25);
    junkGfx.generateTexture("card-junk", cardW, cardH);
    junkGfx.destroy();

    // ── Empty slot ──
    const emptyGfx = this.add.graphics();
    emptyGfx.fillStyle(NUM.warmGray, 0.3);
    emptyGfx.fillRoundedRect(0, 0, cardW, cardH, s(18));
    // Dashed border approximation (short strokes around perimeter)
    emptyGfx.lineStyle(s(1), NUM.graphite, 0.4);
    emptyGfx.strokeRoundedRect(0, 0, cardW, cardH, s(18));
    // Dot grid in center to hint "empty"
    this.drawDotGrid(emptyGfx, cx - s(8), cardH / 2 - s(4), 3, 2, s(8), s(1.5), NUM.concrete, 0.2);
    emptyGfx.generateTexture("card-empty", cardW, cardH);
    emptyGfx.destroy();
  }

  private generateUITextures(): void {
    // ── Primary button ──
    const btnW = s(200);
    const btnH = s(50);
    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(NUM.steel, 1);
    btnGfx.fillRoundedRect(0, 0, btnW, btnH, s(10));
    btnGfx.lineStyle(s(2), NUM.chartreuse, 1);
    btnGfx.strokeRoundedRect(0, 0, btnW, btnH, s(10));
    btnGfx.generateTexture("btn-primary", btnW, btnH);
    btnGfx.destroy();

    // ── Sector background ──
    const secW = s(280);
    const secH = s(150);
    const sectorGfx = this.add.graphics();
    sectorGfx.fillStyle(NUM.slab, 0.7);
    sectorGfx.fillRoundedRect(0, 0, secW, secH, s(10));
    sectorGfx.lineStyle(s(1), NUM.graphite, 0.6);
    sectorGfx.strokeRoundedRect(0, 0, secW, secH, s(10));
    sectorGfx.generateTexture("sector-bg", secW, secH);
    sectorGfx.destroy();
  }
}
