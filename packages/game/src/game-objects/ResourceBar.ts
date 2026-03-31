import Phaser from "phaser";
import type { ResourceTotals } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs } from "../ui/layout";

/** Resource metadata — shared with MarketSlot for investment visuals. */
export const RESOURCE_META = [
  { key: "matter",    label: "MAT", color: "#CC6622", numColor: 0xCC6622, shape: "hexagon" },
  { key: "energy",    label: "ENG", color: "#22BB44", numColor: 0x22BB44, shape: "circle" },
  { key: "data",      label: "DAT", color: "#3366FF", numColor: 0x3366FF, shape: "diamond" },
  { key: "influence", label: "INF", color: "#8844CC", numColor: 0x8844CC, shape: "square" },
] as const;

export type ResourceKey = (typeof RESOURCE_META)[number]["key"];

/** Draw a resource shape into a Graphics object (reusable by MarketSlot etc). */
export function drawResourceShape(
  gfx: Phaser.GameObjects.Graphics,
  shape: string,
  cx: number,
  cy: number,
  size: number,
  color: number,
  fillAlpha = 0.25,
  strokeAlpha = 0.8
): void {
  gfx.fillStyle(color, fillAlpha);
  gfx.lineStyle(s(1.5), color, strokeAlpha);

  switch (shape) {
    case "hexagon": {
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
      }
      gfx.fillPoints(points, true);
      gfx.strokePoints(points, true);
      break;
    }
    case "circle":
      gfx.fillCircle(cx, cy, size);
      gfx.strokeCircle(cx, cy, size);
      break;
    case "diamond": {
      const pts = [
        { x: cx, y: cy - size },
        { x: cx + size * 0.75, y: cy },
        { x: cx, y: cy + size },
        { x: cx - size * 0.75, y: cy },
      ];
      gfx.fillPoints(pts, true);
      gfx.strokePoints(pts, true);
      break;
    }
    case "square":
      gfx.fillRect(cx - size * 0.75, cy - size * 0.75, size * 1.5, size * 1.5);
      gfx.strokeRect(cx - size * 0.75, cy - size * 0.75, size * 1.5, size * 1.5);
      break;
  }
}

/**
 * HUD display for the 4 resources with unique shapes per resource.
 * Labels above values, each value inside a distinct shape.
 * Shapes become draggable during purchase mode (setDraggable).
 */
export class ResourceBar extends Phaser.GameObjects.Container {
  private labels: Record<string, Phaser.GameObjects.Text> = {};
  private values: Record<string, Phaser.GameObjects.Text> = {};
  private thresholdTexts: Record<string, Phaser.GameObjects.Text> = {};
  private shapes: Record<string, Phaser.GameObjects.Graphics> = {};
  private hitAreas: Record<string, Phaser.GameObjects.Rectangle> = {};

  private static SHAPE_SIZE = s(22);
  private static COLUMN_WIDTH = s(90);

  // ── Drag state ──
  private dragGhost: Phaser.GameObjects.Graphics | null = null;
  private draggedResourceType: ResourceKey | null = null;
  private dragging = false;
  private glowTween: Phaser.Tweens.Tween | null = null;

  /** Fired on pointerup after dragging a resource token. Scene hit-tests the position. */
  public onResourceDropped: ((resourceType: ResourceKey, worldX: number, worldY: number) => void) | null = null;
  /** Fired when a resource drag starts (for visual feedback elsewhere). */
  public onDragStart: ((resourceType: ResourceKey) => void) | null = null;
  /** Fired when a resource drag ends (regardless of drop target). */
  public onDragEnd: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Background with tab indents
    const totalW = RESOURCE_META.length * ResourceBar.COLUMN_WIDTH + s(30);
    const barH = s(75);
    const tabW = s(8);
    const tabH = s(20);

    const bgGfx = scene.add.graphics();
    // Main bar
    bgGfx.fillStyle(NUM.slab, 0.85);
    bgGfx.fillRoundedRect(-totalW / 2, -barH / 2, totalW, barH, s(10));
    bgGfx.lineStyle(s(1), NUM.graphite, 0.6);
    bgGfx.strokeRoundedRect(-totalW / 2, -barH / 2, totalW, barH, s(10));
    // Left tab indent
    bgGfx.fillStyle(NUM.slab, 0.85);
    bgGfx.fillRoundedRect(-totalW / 2 - tabW, -tabH / 2, tabW, tabH, { tl: s(4), tr: 0, bl: s(4), br: 0 });
    bgGfx.lineStyle(s(1), NUM.graphite, 0.4);
    bgGfx.strokeRoundedRect(-totalW / 2 - tabW, -tabH / 2, tabW, tabH, { tl: s(4), tr: 0, bl: s(4), br: 0 });
    // Right tab indent
    bgGfx.fillStyle(NUM.slab, 0.85);
    bgGfx.fillRoundedRect(totalW / 2, -tabH / 2, tabW, tabH, { tl: 0, tr: s(4), bl: 0, br: s(4) });
    bgGfx.lineStyle(s(1), NUM.graphite, 0.4);
    bgGfx.strokeRoundedRect(totalW / 2, -tabH / 2, tabW, tabH, { tl: 0, tr: s(4), bl: 0, br: s(4) });
    this.add(bgGfx);

    // Center the columns within the bar
    const startX = -((RESOURCE_META.length - 1) * ResourceBar.COLUMN_WIDTH) / 2;
    for (let i = 0; i < RESOURCE_META.length; i++) {
      const res = RESOURCE_META[i];
      const colX = startX + i * ResourceBar.COLUMN_WIDTH;

      // Label above
      const label = scene.add.text(colX, s(-30), res.label, {
        fontSize: fs(10), color: "#ffffff", fontFamily: "'Orbitron', monospace", fontStyle: "bold",
      }).setOrigin(0.5);
      this.labels[res.key] = label;
      this.add(label);

      // Shape icon (centered)
      const shapeGfx = scene.add.graphics();
      drawResourceShape(shapeGfx, res.shape, 0, 0, ResourceBar.SHAPE_SIZE, res.numColor);
      shapeGfx.setPosition(colX, s(-2));
      this.shapes[res.key] = shapeGfx;
      this.add(shapeGfx);

      // Value text centered in shape
      const value = scene.add.text(colX, s(-2), "0", {
        fontSize: fs(14), color: HEX.bone, fontFamily: "'Orbitron', monospace", fontStyle: "bold",
      }).setOrigin(0.5);
      this.values[res.key] = value;
      this.add(value);

      // Threshold indicator below
      const threshold = scene.add.text(colX, s(30), "T:0", {
        fontSize: fs(10), color: HEX.abyss, fontFamily: "Space Mono",
      }).setOrigin(0.5);
      this.thresholdTexts[res.key] = threshold;
      this.add(threshold);

      // Invisible hit area for drag interaction
      const hitSize = ResourceBar.SHAPE_SIZE * 2 + s(8);
      const hit = scene.add.rectangle(colX, s(-2), hitSize, hitSize, 0x000000, 0);
      hit.setInteractive({ useHandCursor: false, cursor: "grab" });
      this.hitAreas[res.key] = hit;
      this.add(hit);

      // Wire drag on this hit area (always active)
      hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        this.startDrag(res.key as ResourceKey, pointer);
      });
    }

    // Scene-level move and up handlers for dragging
    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !this.dragGhost) return;
      this.dragGhost.setPosition(pointer.worldX, pointer.worldY);
    });

    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !this.draggedResourceType) return;
      const resType = this.draggedResourceType;
      this.endDrag();
      if (this.onResourceDropped) {
        this.onResourceDropped(resType, pointer.worldX, pointer.worldY);
      }
    });

    scene.add.existing(this);
  }

  /** Get the world position of a specific resource column's shape icon. */
  getResourceWorldPos(resourceKey: string): { x: number; y: number } {
    const shape = this.shapes[resourceKey];
    if (!shape) return { x: this.x, y: this.y };
    return { x: this.x + shape.x, y: this.y + shape.y };
  }

  /** Show/hide the glow pulse indicating purchase mode is active. */
  setDraggable(enabled: boolean): void {
    if (enabled) {
      this.startGlow();
    } else {
      this.stopGlow();
    }
  }

  private startDrag(resourceType: ResourceKey, pointer: Phaser.Input.Pointer): void {
    this.dragging = true;
    this.draggedResourceType = resourceType;

    // Create ghost shape at pointer position
    const meta = RESOURCE_META.find(r => r.key === resourceType)!;
    const ghost = this.scene.add.graphics();
    ghost.setDepth(800);
    drawResourceShape(ghost, meta.shape, 0, 0, ResourceBar.SHAPE_SIZE * 1.3, meta.numColor, 0.5, 1);
    ghost.setPosition(pointer.worldX, pointer.worldY);
    this.dragGhost = ghost;

    if (this.onDragStart) this.onDragStart(resourceType);
  }

  private endDrag(): void {
    if (this.dragGhost) {
      this.dragGhost.destroy();
      this.dragGhost = null;
    }
    this.dragging = false;
    this.draggedResourceType = null;
    if (this.onDragEnd) this.onDragEnd();
  }

  private startGlow(): void {
    this.stopGlow();
    // Pulse the shape graphics to indicate draggability
    const targets = RESOURCE_META.map(r => this.shapes[r.key]);
    this.glowTween = this.scene.tweens.add({
      targets,
      alpha: { from: 1, to: 0.6 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private stopGlow(): void {
    if (this.glowTween) {
      this.glowTween.destroy();
      this.glowTween = null;
    }
    for (const res of RESOURCE_META) {
      this.shapes[res.key].setAlpha(1);
    }
  }

  update(resources: ResourceTotals): void {
    for (const res of RESOURCE_META) {
      const val = resources[res.key as keyof ResourceTotals];

      this.values[res.key].setText(String(val));
      this.thresholdTexts[res.key].setText("");

      this.shapes[res.key].clear();
      drawResourceShape(this.shapes[res.key], res.shape, 0, 0, ResourceBar.SHAPE_SIZE, res.numColor);
    }
  }
}
