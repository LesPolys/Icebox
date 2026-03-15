import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import { ENTROPY_BREAKPOINTS, MAX_ENTROPY, ENTROPY_PER_SLEEP_CYCLE } from "@icebox/shared";
import { s, fontSize as fs } from "./layout";

/**
 * Radial dial / pressure gauge for the unified entropy track.
 * Box-first layout: define the box, then fit the gauge inside.
 * Semi-circular arc from left (0) to right (maxEntropy).
 * Colored zones match breakpoints: green -> yellow -> orange -> red.
 */
export class EntropyGauge extends Phaser.GameObjects.Container {
  private needle: Phaser.GameObjects.Graphics;
  private valueText: Phaser.GameObjects.Text;
  private arcGraphics: Phaser.GameObjects.Graphics;
  private breakpointMarkers: Phaser.GameObjects.Graphics;

  private currentEntropy = 0;
  private maxEntropy: number;
  private radius: number;
  private gaugeCX: number;
  private gaugeCY: number;

  public readonly boxW: number;
  public readonly boxH: number;

  private static readonly ARC_START = Math.PI;
  private static readonly ARC_END = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, maxEntropy = MAX_ENTROPY) {
    super(scene, x, y);
    this.maxEntropy = maxEntropy;

    // ── Box-first: define box, derive gauge from it ──
    this.boxW = s(130);
    this.boxH = s(110);
    this.radius = s(32);

    // Gauge center: centered horizontally, pushed down so semicircle fits below title + value text
    this.gaugeCX = this.boxW / 2;
    this.gaugeCY = s(26) + this.radius + s(4);

    // Box background
    const bg = scene.add.graphics();
    bg.fillStyle(NUM.midnightViolet, 0.7);
    bg.fillRoundedRect(0, 0, this.boxW, this.boxH, s(6));
    bg.lineStyle(s(1.5), NUM.charcoalBlue, 0.5);
    bg.strokeRoundedRect(0, 0, this.boxW, this.boxH, s(6));
    this.add(bg);

    // Title
    this.add(scene.add.text(this.boxW / 2, s(4), "ENTROPY", {
      fontSize: fs(7), color: HEX.darkCyan, fontFamily: "monospace",
    }).setOrigin(0.5, 0));

    // Arc
    this.arcGraphics = scene.add.graphics();
    this.arcGraphics.setPosition(this.gaugeCX, this.gaugeCY);
    this.add(this.arcGraphics);

    // Breakpoint ticks
    this.breakpointMarkers = scene.add.graphics();
    this.breakpointMarkers.setPosition(this.gaugeCX, this.gaugeCY);
    this.add(this.breakpointMarkers);

    // Needle
    this.needle = scene.add.graphics();
    this.needle.setPosition(this.gaugeCX, this.gaugeCY);
    this.add(this.needle);

    // Combined value + max text halfway between title bottom and arc top
    const midY = s(38);
    this.valueText = scene.add.text(this.gaugeCX, midY, `0 / ${maxEntropy}`, {
      fontSize: fs(10), color: HEX.eggshell, fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5, 0.5);
    this.add(this.valueText);

    this.drawArc();
    this.drawBreakpoints();
    this.drawNeedle(0);

    // ── Hover tooltip ──
    const hitZone = scene.add.rectangle(this.boxW / 2, this.boxH / 2, this.boxW, this.boxH, 0x000000, 0);
    hitZone.setInteractive({ useHandCursor: true });
    this.add(hitZone);

    const tipW = s(260);
    const lineH = s(18);
    const tipPad = s(12);

    const lines = [
      { text: "ENTROPY", color: HEX.darkCyan, bold: true, header: true },
      { text: `+${ENTROPY_PER_SLEEP_CYCLE} per cryosleep cycle`, color: HEX.eggshell, bold: false, header: false },
      { text: "Card effects & crisis fallout", color: HEX.eggshell, bold: false, header: false },
      { text: "", color: "", bold: false, header: false },
      { text: "BREAKPOINTS", color: HEX.darkCyan, bold: true, header: true },
      ...ENTROPY_BREAKPOINTS.map(bp => ({
        text: `${bp.threshold}: ${bp.description}`,
        color: bp.threshold >= 30 ? "#cc4444" : bp.threshold >= 20 ? "#cc8844" : bp.threshold >= 10 ? "#aaaa44" : "#44aa44",
        bold: false,
        header: false,
      })),
    ];

    const tipH = tipPad * 2 + lines.length * lineH;
    const tipContainer = scene.add.container(0, 0);
    tipContainer.setVisible(false);
    tipContainer.setDepth(900);

    const tipBg = scene.add.graphics();
    tipBg.fillStyle(NUM.midnightViolet, 0.95);
    tipBg.fillRoundedRect(0, 0, tipW, tipH, s(4));
    tipBg.lineStyle(s(1), NUM.charcoalBlue, 0.7);
    tipBg.strokeRoundedRect(0, 0, tipW, tipH, s(4));
    tipContainer.add(tipBg);

    lines.forEach((line, i) => {
      if (!line.text) return;
      const t = scene.add.text(tipPad, tipPad + i * lineH, line.text, {
        fontSize: fs(line.header ? 9 : 8),
        color: line.color,
        fontFamily: "monospace",
        fontStyle: line.bold ? "bold" : "normal",
        wordWrap: { width: tipW - tipPad * 2 },
      });
      tipContainer.add(t);
    });

    hitZone.on("pointerover", () => {
      // Position tooltip in world space, to the left of this container
      tipContainer.setPosition(this.x - tipW - s(8), this.y);
      tipContainer.setVisible(true);
    });
    hitZone.on("pointerout", () => tipContainer.setVisible(false));

    scene.add.existing(this);
  }

  private entropyToAngle(entropy: number): number {
    const t = Math.min(1, Math.max(0, entropy / this.maxEntropy));
    return EntropyGauge.ARC_START - t * Math.PI;
  }

  private getZoneColor(entropy: number): number {
    if (entropy < 10) return 0x44aa44;
    if (entropy < 20) return 0xaaaa44;
    if (entropy < 30) return 0xcc8844;
    return 0xcc4444;
  }

  private drawArc(): void {
    const gfx = this.arcGraphics;
    gfx.clear();
    const r = this.radius;

    const zones = [
      { from: 0, to: 10, color: 0x44aa44 },
      { from: 10, to: 20, color: 0xaaaa44 },
      { from: 20, to: 30, color: 0xcc8844 },
      { from: 30, to: this.maxEntropy, color: 0xcc4444 },
    ];

    for (const zone of zones) {
      gfx.lineStyle(s(8), zone.color, 0.35);
      gfx.beginPath();
      gfx.arc(0, 0, r - s(4), this.entropyToAngle(zone.from), this.entropyToAngle(zone.to), true);
      gfx.strokePath();
    }

    gfx.lineStyle(s(1), NUM.charcoalBlue, 0.6);
    gfx.beginPath();
    gfx.arc(0, 0, r, EntropyGauge.ARC_START, EntropyGauge.ARC_END, true);
    gfx.strokePath();
    gfx.beginPath();
    gfx.arc(0, 0, r - s(8), EntropyGauge.ARC_START, EntropyGauge.ARC_END, true);
    gfx.strokePath();
  }

  private drawBreakpoints(): void {
    const gfx = this.breakpointMarkers;
    gfx.clear();
    const r = this.radius;

    for (const bp of ENTROPY_BREAKPOINTS) {
      const angle = this.entropyToAngle(bp.threshold);
      gfx.lineStyle(s(2), NUM.eggshell, 0.5);
      gfx.lineBetween(
        Math.cos(angle) * (r - s(12)), Math.sin(angle) * (r - s(12)),
        Math.cos(angle) * (r + s(2)), Math.sin(angle) * (r + s(2)),
      );
    }
  }

  private drawNeedle(entropy: number): void {
    const gfx = this.needle;
    gfx.clear();
    const angle = this.entropyToAngle(entropy);
    const len = this.radius - s(5);
    const color = this.getZoneColor(entropy);

    gfx.lineStyle(s(2), color, 0.9);
    gfx.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
    gfx.fillStyle(NUM.eggshell, 1);
    gfx.fillCircle(0, 0, s(3));
  }

  setValue(entropy: number): void {
    this.currentEntropy = entropy;
    this.valueText.setText(`${entropy} / ${this.maxEntropy}`);
    this.drawNeedle(entropy);

    if (entropy >= 30) this.valueText.setColor("#cc4444");
    else if (entropy >= 20) this.valueText.setColor("#cc8844");
    else if (entropy >= 10) this.valueText.setColor("#aaaa44");
    else this.valueText.setColor(HEX.eggshell);
  }

  animateChange(from: number, to: number, duration = 800): void {
    this.scene.tweens.addCounter({
      from, to, duration, ease: "Sine.easeInOut",
      onUpdate: (tween) => this.setValue(Math.round(tween.getValue() ?? 0)),
    });
  }
}
