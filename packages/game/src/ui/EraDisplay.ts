import Phaser from "phaser";
import type { EraState, EraModifiers } from "@icebox/shared";
import { NUM, HEX, ERA_MODIFIERS } from "@icebox/shared";
import { s, fontSize as fs } from "./layout";

/** Color and icon config per era. */
const ERA_VISUALS: Record<EraState, { color: string; numColor: number; icon: string; desatColor: string; desatNum: number }> = {
  Zenith:     { color: "#55cc88", numColor: 0x55cc88, icon: "\u2605", desatColor: "#3a6b4e", desatNum: 0x3a6b4e },
  Unraveling: { color: "#aa8855", numColor: 0xaa8855, icon: "\u25c7", desatColor: "#6b5c3e", desatNum: 0x6b5c3e },
  Struggle:   { color: "#cc6644", numColor: 0xcc6644, icon: "\u25b2", desatColor: "#7a4432", desatNum: 0x7a4432 },
  Ascension:  { color: "#6688cc", numColor: 0x6688cc, icon: "\u25c6", desatColor: "#3e4f6b", desatNum: 0x3e4f6b },
};

const ERA_ORDER: EraState[] = ["Zenith", "Unraveling", "Struggle", "Ascension"];

/** Tooltip data: trigger conditions and effect descriptions per era. */
const ERA_TOOLTIPS: Record<EraState, { trigger: string; effects: string[] }> = {
  Zenith: {
    trigger: "High Reserves + Low Entropy",
    effects: ["Slide +1 (market faster)", "Maint \u00d70.8 (cheaper)"],
  },
  Unraveling: {
    trigger: "Low Reserves + Low Entropy",
    effects: ["Maint \u00d71.2 (costlier)", "Build +1 (slower)"],
  },
  Struggle: {
    trigger: "Low Reserves + High Entropy",
    effects: ["Maint \u00d70.5 (cheap)", "Build +1 (slower)"],
  },
  Ascension: {
    trigger: "High Reserves + High Entropy",
    effects: ["Slide -1 (market slower)", "Build -2 (much faster)"],
  },
};

// Grid layout helpers
const CELL_W = () => s(110);
const CELL_H = () => s(50);
const GAP = () => s(5);
const PAD = () => s(10);
const GRID_TOP_OFFSET = () => s(8);

/**
 * 2x2 grid showing all four eras with a pawn on the active one.
 * Hover on any cell shows a tooltip with trigger conditions and effects.
 */
export class EraDisplay extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private eraCells: Map<EraState, {
    cellBg: Phaser.GameObjects.Graphics;
    iconText: Phaser.GameObjects.Text;
    nameText: Phaser.GameObjects.Text;
    hitArea: Phaser.GameObjects.Rectangle;
  }> = new Map();
  private pawn: Phaser.GameObjects.Text;
  private modifierText: Phaser.GameObjects.Text;
  private currentEra: EraState = "Zenith";

  // Tooltip elements (shared, repositioned per cell)
  private tooltipBg: Phaser.GameObjects.Graphics;
  private tooltipTexts: Phaser.GameObjects.Text[] = [];
  private tooltipContainer: Phaser.GameObjects.Container;

  public readonly boxW: number;
  public readonly boxH: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const cellW = CELL_W();
    const cellH = CELL_H();
    const gap = GAP();
    const pad = PAD();
    const modRowH = s(20);

    this.boxW = pad * 2 + cellW * 2 + gap;
    this.boxH = pad * 2 + cellH * 2 + gap + modRowH + GRID_TOP_OFFSET();

    // Background panel
    this.bg = scene.add.graphics();
    this.bg.fillStyle(NUM.slab, 0.7);
    this.bg.fillRoundedRect(0, 0, this.boxW, this.boxH, s(6));
    this.bg.lineStyle(s(1.5), NUM.graphite, 0.5);
    this.bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, s(6));
    this.add(this.bg);

    // Title
    this.add(scene.add.text(this.boxW / 2, s(5), "ERA", {
      fontSize: fs(7), color: "#ffffff", fontFamily: "'Orbitron', monospace", fontStyle: "bold",
    }).setOrigin(0.5, 0));

    // 2x2 grid: [Zenith, Unraveling] / [Struggle, Ascension]
    const gridTop = pad + GRID_TOP_OFFSET();
    for (let i = 0; i < 4; i++) {
      const era = ERA_ORDER[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = pad + col * (cellW + gap);
      const cy = gridTop + row * (cellH + gap);
      const vis = ERA_VISUALS[era];

      const cellBg = scene.add.graphics();
      this.add(cellBg);

      const iconText = scene.add.text(cx + s(6), cy + cellH / 2, vis.icon, {
        fontSize: fs(16), color: vis.desatColor, fontFamily: "Space Mono",
      }).setOrigin(0, 0.5);
      this.add(iconText);

      const nameText = scene.add.text(cx + s(28), cy + cellH / 2, era.toUpperCase(), {
        fontSize: fs(12), color: vis.desatColor, fontFamily: "Space Mono", fontStyle: "bold",
      }).setOrigin(0, 0.5);
      this.add(nameText);

      // Invisible hit area for hover
      const hitArea = scene.add.rectangle(cx + cellW / 2, cy + cellH / 2, cellW, cellH, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on("pointerover", () => this.showTooltip(era));
      hitArea.on("pointerout", () => this.hideTooltip());
      this.add(hitArea);

      this.eraCells.set(era, { cellBg, iconText, nameText, hitArea });
      this.drawCell(era, era === this.currentEra, cellBg, cx, cy, cellW, cellH);
    }

    // Pawn indicator
    this.pawn = scene.add.text(0, 0, "\u265F", {
      fontSize: fs(14), color: HEX.bone, fontFamily: "serif", fontStyle: "bold",
    }).setOrigin(0.5);
    this.add(this.pawn);

    // Modifier summary
    this.modifierText = scene.add.text(this.boxW / 2, this.boxH - s(5), "", {
      fontSize: fs(8), color: HEX.abyss, fontFamily: "Space Mono",
    }).setOrigin(0.5, 1);
    this.add(this.modifierText);

    // ── Tooltip container (hidden by default) ──
    this.tooltipContainer = scene.add.container(0, 0);
    this.tooltipContainer.setVisible(false);
    this.tooltipContainer.setDepth(500);

    this.tooltipBg = scene.add.graphics();
    this.tooltipContainer.add(this.tooltipBg);

    // Pre-create text objects for tooltip (title + trigger + up to 3 effect lines)
    for (let i = 0; i < 5; i++) {
      const t = scene.add.text(0, 0, "", {
        fontSize: fs(8), color: HEX.bone, fontFamily: "Space Mono",
        wordWrap: { width: s(200) },
      });
      this.tooltipContainer.add(t);
      this.tooltipTexts.push(t);
    }

    // Add tooltip to the scene directly (not to this container) so it renders on top
    scene.add.existing(this.tooltipContainer);

    this.positionPawn(this.currentEra);
    scene.add.existing(this);
  }

  private showTooltip(era: EraState): void {
    const vis = ERA_VISUALS[era];
    const tip = ERA_TOOLTIPS[era];
    const cell = this.eraCells.get(era)!;
    const cellPos = this.getCellPos(era);

    // Position tooltip below this container
    const worldX = this.x + cellPos.x;
    const worldY = this.y + this.boxH + s(4);

    const tipPad = s(8);
    const lineH = s(14);
    let lineIdx = 0;

    // Title line
    this.tooltipTexts[lineIdx].setText(`${vis.icon} ${era.toUpperCase()}`);
    this.tooltipTexts[lineIdx].setColor(vis.color);
    this.tooltipTexts[lineIdx].setStyle({ fontStyle: "bold", fontSize: fs(9), fontFamily: "Space Mono", color: vis.color });
    this.tooltipTexts[lineIdx].setPosition(tipPad, tipPad + lineIdx * lineH);
    lineIdx++;

    // Trigger line
    this.tooltipTexts[lineIdx].setText(`Trigger: ${tip.trigger}`);
    this.tooltipTexts[lineIdx].setStyle({ fontStyle: "normal", fontSize: fs(7), fontFamily: "Space Mono", color: HEX.abyss });
    this.tooltipTexts[lineIdx].setPosition(tipPad, tipPad + lineIdx * lineH);
    lineIdx++;

    // Spacer line
    this.tooltipTexts[lineIdx].setText("Effects:");
    this.tooltipTexts[lineIdx].setStyle({ fontStyle: "bold", fontSize: fs(7), fontFamily: "Space Mono", color: HEX.bone });
    this.tooltipTexts[lineIdx].setPosition(tipPad, tipPad + lineIdx * lineH + s(2));
    lineIdx++;

    // Effect lines
    for (const eff of tip.effects) {
      if (lineIdx >= this.tooltipTexts.length) break;
      this.tooltipTexts[lineIdx].setText(`  ${eff}`);
      this.tooltipTexts[lineIdx].setStyle({ fontStyle: "normal", fontSize: fs(7), fontFamily: "Space Mono", color: HEX.bone });
      this.tooltipTexts[lineIdx].setPosition(tipPad, tipPad + lineIdx * lineH + s(2));
      lineIdx++;
    }

    // Hide unused lines
    for (let i = 0; i < this.tooltipTexts.length; i++) {
      this.tooltipTexts[i].setVisible(i < lineIdx);
    }

    // Draw tooltip background
    const tipW = s(220);
    const tipH = tipPad * 2 + lineIdx * lineH + s(4);
    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(NUM.slab, 0.95);
    this.tooltipBg.fillRoundedRect(0, 0, tipW, tipH, s(4));
    this.tooltipBg.lineStyle(s(1), vis.numColor, 0.5);
    this.tooltipBg.strokeRoundedRect(0, 0, tipW, tipH, s(4));

    this.tooltipContainer.setPosition(worldX, worldY);
    this.tooltipContainer.setVisible(true);
  }

  private hideTooltip(): void {
    this.tooltipContainer.setVisible(false);
  }

  private getCellPos(era: EraState): { x: number; y: number; w: number; h: number } {
    const cellW = CELL_W();
    const cellH = CELL_H();
    const gap = GAP();
    const pad = PAD();
    const gridTop = pad + GRID_TOP_OFFSET();
    const i = ERA_ORDER.indexOf(era);
    return {
      x: pad + (i % 2) * (cellW + gap),
      y: gridTop + Math.floor(i / 2) * (cellH + gap),
      w: cellW,
      h: cellH,
    };
  }

  private drawCell(
    era: EraState, active: boolean, gfx: Phaser.GameObjects.Graphics,
    cx: number, cy: number, w: number, h: number,
  ): void {
    const vis = ERA_VISUALS[era];
    gfx.clear();
    if (active) {
      gfx.fillStyle(vis.numColor, 0.15);
      gfx.fillRoundedRect(cx, cy, w, h, s(4));
      gfx.lineStyle(s(1.5), vis.numColor, 0.6);
      gfx.strokeRoundedRect(cx, cy, w, h, s(4));
    } else {
      gfx.fillStyle(NUM.slab, 0.4);
      gfx.fillRoundedRect(cx, cy, w, h, s(4));
      gfx.lineStyle(s(1), NUM.graphite, 0.25);
      gfx.strokeRoundedRect(cx, cy, w, h, s(4));
    }
  }

  private positionPawn(era: EraState): void {
    const pos = this.getCellPos(era);
    this.pawn.setPosition(pos.x + pos.w - s(10), pos.y + s(10));
  }

  update(era: EraState, modifiers: EraModifiers): void {
    this.currentEra = era;

    for (const e of ERA_ORDER) {
      const cell = this.eraCells.get(e)!;
      const vis = ERA_VISUALS[e];
      const active = e === era;
      const pos = this.getCellPos(e);

      this.drawCell(e, active, cell.cellBg, pos.x, pos.y, pos.w, pos.h);
      cell.iconText.setColor(active ? vis.color : vis.desatColor);
      cell.nameText.setColor(active ? vis.color : vis.desatColor);
      cell.iconText.setAlpha(active ? 1 : 0.5);
      cell.nameText.setAlpha(active ? 1 : 0.5);
    }

    this.positionPawn(era);

    const parts: string[] = [];
    if (modifiers.marketSlideModifier !== 0) {
      const sign = modifiers.marketSlideModifier > 0 ? "+" : "";
      parts.push(`Slide ${sign}${modifiers.marketSlideModifier}`);
    }
    if (modifiers.maintenanceCostModifier !== 1) {
      parts.push(`Maint \u00d7${modifiers.maintenanceCostModifier}`);
    }
    if (modifiers.constructionTimeModifier !== 0) {
      const sign = modifiers.constructionTimeModifier > 0 ? "+" : "";
      parts.push(`Build ${sign}${modifiers.constructionTimeModifier}`);
    }
    this.modifierText.setText(parts.join(" | ") || "No modifiers");
  }

  animateTransition(from: EraState, to: EraState, modifiers: EraModifiers): void {
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.2 },
      duration: 200,
      yoyo: true,
      onComplete: () => {
        this.update(to, modifiers);
        this.scene.tweens.add({
          targets: this, alpha: { from: 0.6, to: 1 }, duration: 400, ease: "Sine.easeOut",
        });
      },
    });
  }
}

export { ERA_VISUALS };
