import Phaser from "phaser";
import type { Card } from "@icebox/shared";
import { FACTIONS, NUM } from "@icebox/shared";
import coreSetData from "../../../shared/data/cards/core-set.json";
import { s, fontSize, GAME_W, GAME_H } from "../ui/layout";
import { MainMenuScene } from "./MainMenuScene";

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
      color: "#A5CFC5",
      fontFamily: "monospace",
    });
    text.setOrigin(0.5);
  }

  create(): void {
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
    const cardW = s(120);
    const cardH = s(170);
    const headerH = s(40);
    const r = s(8);
    const lw = s(2);

    // Card back — with diamond pattern
    const backGfx = this.add.graphics();
    backGfx.fillStyle(NUM.midnightViolet, 1);
    backGfx.fillRoundedRect(0, 0, cardW, cardH, r);
    // Inner border
    backGfx.lineStyle(s(1), NUM.charcoalBlue, 0.4);
    backGfx.strokeRoundedRect(s(6), s(6), cardW - s(12), cardH - s(12), s(4));
    // Center diamond
    const cx = cardW / 2, cy = cardH / 2, dSize = s(24);
    backGfx.fillStyle(NUM.darkCyan, 0.3);
    backGfx.fillPoints([
      { x: cx, y: cy - dSize },
      { x: cx + dSize * 0.7, y: cy },
      { x: cx, y: cy + dSize },
      { x: cx - dSize * 0.7, y: cy },
    ], true);
    backGfx.lineStyle(s(1), NUM.darkCyan, 0.5);
    backGfx.strokePoints([
      { x: cx, y: cy - dSize },
      { x: cx + dSize * 0.7, y: cy },
      { x: cx, y: cy + dSize },
      { x: cx - dSize * 0.7, y: cy },
    ], true);
    // Outer border
    backGfx.lineStyle(lw, NUM.charcoalBlue, 1);
    backGfx.strokeRoundedRect(0, 0, cardW, cardH, r);
    this.removeIfExists("card-back");
    backGfx.generateTexture("card-back", cardW, cardH);
    backGfx.destroy();

    // Faction-colored cards
    for (const [factionId, faction] of Object.entries(FACTIONS)) {
      const color = Phaser.Display.Color.HexStringToColor(faction.color).color;
      const gfx = this.add.graphics();
      gfx.fillStyle(NUM.midnightViolet, 1);
      gfx.fillRoundedRect(0, 0, cardW, cardH, r);
      gfx.fillStyle(color, 0.3);
      gfx.fillRoundedRect(0, 0, cardW, headerH, { tl: r, tr: r, bl: 0, br: 0 });
      gfx.lineStyle(lw, color, 1);
      gfx.strokeRoundedRect(0, 0, cardW, cardH, r);
      this.removeIfExists(`card-${factionId}`);
      gfx.generateTexture(`card-${factionId}`, cardW, cardH);
      gfx.destroy();
    }

    // Neutral card
    const neutralGfx = this.add.graphics();
    neutralGfx.fillStyle(NUM.midnightViolet, 1);
    neutralGfx.fillRoundedRect(0, 0, cardW, cardH, r);
    neutralGfx.fillStyle(NUM.vintageGrape, 0.4);
    neutralGfx.fillRoundedRect(0, 0, cardW, headerH, { tl: r, tr: r, bl: 0, br: 0 });
    neutralGfx.lineStyle(lw, NUM.vintageGrape, 1);
    neutralGfx.strokeRoundedRect(0, 0, cardW, cardH, r);
    this.removeIfExists("card-neutral");
    neutralGfx.generateTexture("card-neutral", cardW, cardH);
    neutralGfx.destroy();

    // Junk card (dusty mauve tint)
    const junkGfx = this.add.graphics();
    junkGfx.fillStyle(NUM.midnightViolet, 1);
    junkGfx.fillRoundedRect(0, 0, cardW, cardH, r);
    junkGfx.fillStyle(NUM.dustyMauve, 0.35);
    junkGfx.fillRoundedRect(0, 0, cardW, headerH, { tl: r, tr: r, bl: 0, br: 0 });
    junkGfx.lineStyle(lw, NUM.dustyMauve, 1);
    junkGfx.strokeRoundedRect(0, 0, cardW, cardH, r);
    this.removeIfExists("card-junk");
    junkGfx.generateTexture("card-junk", cardW, cardH);
    junkGfx.destroy();

    // Empty slot
    const emptyGfx = this.add.graphics();
    emptyGfx.fillStyle(NUM.midnightViolet, 0.3);
    emptyGfx.fillRoundedRect(0, 0, cardW, cardH, r);
    emptyGfx.lineStyle(s(1), NUM.vintageGrape, 0.4);
    emptyGfx.strokeRoundedRect(0, 0, cardW, cardH, r);
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
    btnGfx.fillStyle(NUM.charcoalBlue2, 1);
    btnGfx.fillRoundedRect(0, 0, btnW, btnH, r);
    btnGfx.lineStyle(s(2), NUM.darkCyan, 1);
    btnGfx.strokeRoundedRect(0, 0, btnW, btnH, r);
    this.removeIfExists("btn-primary");
    btnGfx.generateTexture("btn-primary", btnW, btnH);
    btnGfx.destroy();

    // Sector background — 345 wide, 370 spacing
    const secW = s(345);
    const secH = s(215);
    const sectorGfx = this.add.graphics();
    sectorGfx.fillStyle(NUM.midnightViolet, 0.7);
    sectorGfx.fillRoundedRect(0, 0, secW, secH, r);
    sectorGfx.lineStyle(s(1), NUM.charcoalBlue, 0.6);
    sectorGfx.strokeRoundedRect(0, 0, secW, secH, r);
    this.removeIfExists("sector-bg");
    sectorGfx.generateTexture("sector-bg", secW, secH);
    sectorGfx.destroy();
  }
}

