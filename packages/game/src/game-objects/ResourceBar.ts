import Phaser from "phaser";
import type { ResourceTotals, EntropyThresholds } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs } from "../ui/layout";

/**
 * HUD display for the 4 resources with unique shapes per resource.
 * Labels above values, each value inside a distinct shape.
 */
export class ResourceBar extends Phaser.GameObjects.Container {
  private labels: Record<string, Phaser.GameObjects.Text> = {};
  private values: Record<string, Phaser.GameObjects.Text> = {};
  private thresholdTexts: Record<string, Phaser.GameObjects.Text> = {};
  private shapes: Record<string, Phaser.GameObjects.Graphics> = {};

  private static RESOURCES = [
    { key: "matter",    label: "MAT", color: "#e88a3a", numColor: 0xe88a3a, shape: "hexagon" },
    { key: "energy",    label: "ENG", color: "#55cc55", numColor: 0x55cc55, shape: "circle" },
    { key: "data",      label: "DAT", color: "#4488ff", numColor: 0x4488ff, shape: "diamond" },
    { key: "influence", label: "INF", color: "#cc77dd", numColor: 0xcc77dd, shape: "square" },
  ];

  private static SHAPE_SIZE = s(21);
  private static COLUMN_WIDTH = s(68);

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Background
    const totalW = ResourceBar.RESOURCES.length * ResourceBar.COLUMN_WIDTH + s(30);
    const bg = scene.add.rectangle(0, 0, totalW, s(60), NUM.midnightViolet, 0.85);
    bg.setStrokeStyle(s(1), NUM.charcoalBlue, 0.6);
    this.add(bg);

    let offsetX = -(totalW / 2) + s(38);
    for (const res of ResourceBar.RESOURCES) {
      // Label above
      const label = scene.add.text(offsetX, s(-22), res.label, {
        fontSize: fs(8),
        color: HEX.pearlAqua,
        fontFamily: "monospace",
        fontStyle: "bold",
      });
      label.setOrigin(0.5);
      this.labels[res.key] = label;
      this.add(label);

      // Shape background
      const shapeGfx = scene.add.graphics();
      this.drawShape(shapeGfx, res.shape, 0, 0, ResourceBar.SHAPE_SIZE, res.numColor);
      shapeGfx.setPosition(offsetX, s(-3));
      this.shapes[res.key] = shapeGfx;
      this.add(shapeGfx);

      // Value text centered in shape
      const value = scene.add.text(offsetX, s(-4), "0", {
        fontSize: fs(12),
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      });
      value.setOrigin(0.5);
      this.values[res.key] = value;
      this.add(value);

      // Threshold indicator below — darkCyan for subtle but readable
      const threshold = scene.add.text(offsetX, s(17), "T:0", {
        fontSize: fs(6),
        color: HEX.darkCyan,
        fontFamily: "monospace",
      });
      threshold.setOrigin(0.5);
      this.thresholdTexts[res.key] = threshold;
      this.add(threshold);

      offsetX += ResourceBar.COLUMN_WIDTH;
    }

    scene.add.existing(this);
  }

  private drawShape(
    gfx: Phaser.GameObjects.Graphics,
    shape: string,
    cx: number,
    cy: number,
    size: number,
    color: number
  ): void {
    gfx.clear();
    gfx.fillStyle(color, 0.25);
    gfx.lineStyle(s(1.5), color, 0.8);

    switch (shape) {
      case "hexagon": {
        const points: { x: number; y: number }[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          points.push({
            x: cx + size * Math.cos(angle),
            y: cy + size * Math.sin(angle),
          });
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

  update(resources: ResourceTotals, thresholds: EntropyThresholds): void {
    const thresholdMap: Record<string, number> = {
      matter: thresholds.hullBreach,
      energy: thresholds.powerDown,
      data: thresholds.techDecay,
      influence: thresholds.coup,
    };

    for (const res of ResourceBar.RESOURCES) {
      const val = resources[res.key as keyof ResourceTotals];
      const thresh = thresholdMap[res.key];

      this.values[res.key].setText(String(val));
      this.thresholdTexts[res.key].setText(`T:${thresh}`);

      // Flash red if below threshold, redraw shape
      if (val < thresh) {
        this.values[res.key].setColor("#ff4444");
        this.drawShape(this.shapes[res.key], res.shape, 0, 0, ResourceBar.SHAPE_SIZE, 0xff4444);
      } else {
        this.values[res.key].setColor("#ffffff");
        this.drawShape(this.shapes[res.key], res.shape, 0, 0, ResourceBar.SHAPE_SIZE, res.numColor);
      }
    }
  }
}
