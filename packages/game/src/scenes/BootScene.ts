import Phaser from "phaser";
import type { Card } from "@icebox/shared";
import { FACTIONS, NUM, HEX } from "@icebox/shared";
import coreSetData from "../../../shared/data/cards/core-set.json";
import { s, fontSize, GAME_W, GAME_H } from "../ui/layout";
import { MainMenuScene } from "./MainMenuScene";
import { OutlinePostFX } from "../ui/OutlineShader";
import { GlitchPostFX } from "../ui/GlitchShader";
import { PixelDissolvePostFX } from "../ui/PixelDissolveShader";

/**
 * Boot scene: loads card data and generates placeholder textures.
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
      color: HEX.teal,
      fontFamily: "Orbitron",
    });
    text.setOrigin(0.5);
  }

  async create(): Promise<void> {
    await document.fonts.ready;

    // Register PostFX pipelines
    const renderer = this.game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      renderer.pipelines.addPostPipeline(OutlinePostFX.KEY, OutlinePostFX);
      renderer.pipelines.addPostPipeline(GlitchPostFX.KEY, GlitchPostFX);
      renderer.pipelines.addPostPipeline(PixelDissolvePostFX.KEY, PixelDissolvePostFX);
    }

    BootScene.cardDefinitions = (coreSetData as { cards: Card[] }).cards;
    console.log(`Loaded ${BootScene.cardDefinitions.length} card definitions`);

    this.regenerateTextures();

    this.scene.start(MainMenuScene.KEY);
  }

  /** Generate (or re-generate) all textures at the current scale. */
  regenerateTextures(): void {
    this.generateCardTextures();
    this.generateUITextures();
  }

  private removeIfExists(key: string): void {
    if (this.textures.exists(key)) this.textures.remove(key);
  }

  private generateCardTextures(): void {
    const TEX = Math.max(3, Math.ceil(window.devicePixelRatio ?? 1)); // hi-res for crisp display
    const ts = (px: number) => s(px) * TEX;
    const cardW = ts(120);
    const cardH = ts(170);
    const shellR = ts(18);   // Barok outer shell radius
    const innerR = ts(12);   // Inner panel radius
    const inset = ts(8);     // Inner panel inset from shell
    const lw = ts(2);

    // ── Helper: draw the warm gray outer shell ──
    const drawShell = (gfx: Phaser.GameObjects.Graphics, alpha = 1) => {
      gfx.fillStyle(NUM.warmGray, alpha);
      gfx.fillRoundedRect(0, 0, cardW, cardH, shellR);
    };

    // ── Helper: draw the top-center notch indent ──
    const drawNotch = (gfx: Phaser.GameObjects.Graphics) => {
      const notchW = ts(50);
      const notchH = ts(14);
      const nx = cardW / 2 - notchW / 2;
      gfx.fillStyle(NUM.bone, 0.9);
      gfx.fillRoundedRect(nx, 0, notchW, notchH, { tl: 0, tr: 0, bl: ts(6), br: ts(6) });
      gfx.lineStyle(ts(1), NUM.graphite, 0.4);
      gfx.strokeRoundedRect(nx, 0, notchW, notchH, { tl: 0, tr: 0, bl: ts(6), br: ts(6) });
    };

    // ── Helper: draw inner panel ──
    const drawInnerPanel = (gfx: Phaser.GameObjects.Graphics, color: number, alpha: number) => {
      gfx.fillStyle(color, alpha);
      gfx.fillRoundedRect(inset, inset + ts(10), cardW - inset * 2, cardH - inset * 2 - ts(22), innerR);
    };

    // ── Helper: 4-pointed sparkle star (positions already in ts units) ──
    const drawSparkle = (gfx: Phaser.GameObjects.Graphics, sx: number, sy: number, size: number, color: number, alpha: number) => {
      gfx.fillStyle(color, alpha);
      gfx.fillPoints([
        { x: sx, y: sy - size },
        { x: sx + size * 0.25, y: sy },
        { x: sx, y: sy + size },
        { x: sx - size * 0.25, y: sy },
      ], true);
      gfx.fillPoints([
        { x: sx - size, y: sy },
        { x: sx, y: sy - size * 0.25 },
        { x: sx + size, y: sy },
        { x: sx, y: sy + size * 0.25 },
      ], true);
    };

    // ── Helper: dot grid (3×2) — positions already in ts units ──
    const drawDotGrid = (gfx: Phaser.GameObjects.Graphics, dx: number, dy: number) => {
      gfx.fillStyle(NUM.concrete, 0.3);
      const dotR = ts(1.5);
      const gap = ts(5);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          gfx.fillCircle(dx + col * gap, dy + row * gap, dotR);
        }
      }
    };

    // ── Helper: barcode lines at bottom-right of shell ──
    const drawBarcode = (gfx: Phaser.GameObjects.Graphics) => {
      gfx.fillStyle(NUM.graphite, 0.4);
      const bx = cardW - inset - ts(30);
      const by = cardH - ts(14);
      const barH = ts(8);
      const widths = [ts(2), ts(1), ts(3), ts(1), ts(2), ts(1), ts(2), ts(1)];
      let x = bx;
      for (let i = 0; i < widths.length; i++) {
        if (i % 2 === 0) gfx.fillRect(x, by, widths[i], barH);
        x += widths[i] + ts(1);
      }
    };

    // ── Helper: graphite outer border ──
    const drawOuterBorder = (gfx: Phaser.GameObjects.Graphics) => {
      gfx.lineStyle(lw, NUM.graphite, 0.8);
      gfx.strokeRoundedRect(0, 0, cardW, cardH, shellR);
    };

    // ═══ Card back ═══
    const backGfx = this.add.graphics();
    drawShell(backGfx);
    drawNotch(backGfx);
    // Void inner panel
    drawInnerPanel(backGfx, NUM.void, 0.9);
    // Teal diamond centered
    const cx = cardW / 2, cy = cardH / 2, dSize = ts(20);
    backGfx.fillStyle(NUM.teal, 0.4);
    backGfx.fillPoints([
      { x: cx, y: cy - dSize },
      { x: cx + dSize * 0.7, y: cy },
      { x: cx, y: cy + dSize },
      { x: cx - dSize * 0.7, y: cy },
    ], true);
    backGfx.lineStyle(ts(1), NUM.teal, 0.7);
    backGfx.strokePoints([
      { x: cx, y: cy - dSize },
      { x: cx + dSize * 0.7, y: cy },
      { x: cx, y: cy + dSize },
      { x: cx - dSize * 0.7, y: cy },
    ], true);
    // Sparkle stars
    drawSparkle(backGfx, inset + ts(14), inset + ts(24), ts(6), NUM.chartreuse, 0.3);
    drawSparkle(backGfx, cardW - inset - ts(14), inset + ts(24), ts(4), NUM.chartreuse, 0.2);
    // Holographic strip (3 thin lines)
    const stripY = cy + ts(28);
    backGfx.fillStyle(0x8833BB, 0.3);
    backGfx.fillRect(inset + ts(4), stripY, cardW - inset * 2 - ts(8), ts(1.5));
    backGfx.fillStyle(NUM.teal, 0.3);
    backGfx.fillRect(inset + ts(4), stripY + ts(4), cardW - inset * 2 - ts(8), ts(1.5));
    backGfx.fillStyle(NUM.chartreuse, 0.3);
    backGfx.fillRect(inset + ts(4), stripY + ts(8), cardW - inset * 2 - ts(8), ts(1.5));
    drawBarcode(backGfx);
    drawOuterBorder(backGfx);
    this.removeIfExists("card-back");
    backGfx.generateTexture("card-back", cardW, cardH);
    backGfx.destroy();

    // ═══ Faction cards ═══
    for (const [factionId, faction] of Object.entries(FACTIONS)) {
      const color = Phaser.Display.Color.HexStringToColor(faction.color).color;
      const gfx = this.add.graphics();
      drawShell(gfx);
      drawNotch(gfx);
      drawInnerPanel(gfx, color, 0.7);
      drawSparkle(gfx, inset + ts(14), inset + ts(24), ts(5), color, 0.3);
      drawDotGrid(gfx, cardW - inset - ts(18), inset + ts(18));
      drawOuterBorder(gfx);
      this.removeIfExists(`card-${factionId}`);
      gfx.generateTexture(`card-${factionId}`, cardW, cardH);
      gfx.destroy();
    }

    // ═══ Neutral card ═══
    const neutralGfx = this.add.graphics();
    drawShell(neutralGfx);
    drawNotch(neutralGfx);
    drawInnerPanel(neutralGfx, NUM.concrete, 0.5);
    drawDotGrid(neutralGfx, cardW - inset - ts(18), inset + ts(18));
    drawOuterBorder(neutralGfx);
    this.removeIfExists("card-neutral");
    neutralGfx.generateTexture("card-neutral", cardW, cardH);
    neutralGfx.destroy();

    // ═══ Junk card ═══
    const junkGfx = this.add.graphics();
    drawShell(junkGfx);
    drawNotch(junkGfx);
    drawInnerPanel(junkGfx, NUM.signalRed, 0.3);
    drawOuterBorder(junkGfx);
    this.removeIfExists("card-junk");
    junkGfx.generateTexture("card-junk", cardW, cardH);
    junkGfx.destroy();

    // ═══ Crisis card ═══
    const crisisGfx = this.add.graphics();
    drawShell(crisisGfx);
    drawNotch(crisisGfx);
    drawInnerPanel(crisisGfx, 0xcc3333, 0.35);
    drawSparkle(crisisGfx, inset + ts(14), inset + ts(24), ts(5), 0xcc3333, 0.4);
    drawOuterBorder(crisisGfx);
    this.removeIfExists("card-crisis");
    crisisGfx.generateTexture("card-crisis", cardW, cardH);
    crisisGfx.destroy();

    // ═══ Empty slot ═══
    const emptyGfx = this.add.graphics();
    drawShell(emptyGfx, 0.3);
    // Dashed border effect (series of short strokes)
    emptyGfx.lineStyle(ts(1), NUM.graphite, 0.4);
    emptyGfx.strokeRoundedRect(0, 0, cardW, cardH, shellR);
    this.removeIfExists("card-empty");
    emptyGfx.generateTexture("card-empty", cardW, cardH);
    emptyGfx.destroy();
  }

  private generateUITextures(): void {
    const r = s(8);

    // Button texture
    const btnW = s(200);
    const btnH = s(50);
    const btnGfx = this.add.graphics();
    btnGfx.fillStyle(NUM.steel, 1);
    btnGfx.fillRoundedRect(0, 0, btnW, btnH, r);
    btnGfx.lineStyle(s(2), NUM.teal, 1);
    btnGfx.strokeRoundedRect(0, 0, btnW, btnH, r);
    this.removeIfExists("btn-primary");
    btnGfx.generateTexture("btn-primary", btnW, btnH);
    btnGfx.destroy();

    // Sector background — 345 wide, 370 spacing
    const secW = s(345);
    const secH = s(215);
    const sectorGfx = this.add.graphics();
    sectorGfx.fillStyle(NUM.slab, 0.7);
    sectorGfx.fillRoundedRect(0, 0, secW, secH, r);
    sectorGfx.lineStyle(s(1), NUM.graphite, 0.6);
    sectorGfx.strokeRoundedRect(0, 0, secW, secH, r);
    this.removeIfExists("sector-bg");
    sectorGfx.generateTexture("sector-bg", secW, secH);
    sectorGfx.destroy();
  }
}

