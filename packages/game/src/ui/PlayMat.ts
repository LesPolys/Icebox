import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs, LAYOUT, MAIN_CX } from "./layout";

/**
 * Visual "play mat" enclosing the sectors and hand area.
 * Contains two large circular buttons:
 *   - SLEEP (above discard pile)
 *   - END TURN (above deck pile)
 * Buttons are added directly to the scene at high depth so the hand never covers them.
 */
export class PlayMat extends Phaser.GameObjects.Container {
  public onEndTurn: (() => void) | null = null;
  public onSleep: (() => void) | null = null;

  private bgGfx: Phaser.GameObjects.Graphics;
  private highlightTween: Phaser.Tweens.Tween | null = null;
  private matW: number;
  private matH: number;

  constructor(scene: Phaser.Scene) {
    const cx = MAIN_CX;
    const top = LAYOUT.playMatTop;
    const bottom = LAYOUT.playMatBottom;
    const w = LAYOUT.playMatW;
    const h = bottom - top;
    const midY = top + h / 2;

    super(scene, cx, midY);
    this.matW = w;
    this.matH = h;

    // Background rounded rectangle
    this.bgGfx = scene.add.graphics();
    this.drawBg(false);
    this.add(this.bgGfx);

    // Action buttons — positioned above player discard (left) and deck (right) piles
    // Created as direct scene objects at high depth so hand cards can't cover them
    const r = LAYOUT.playMatBtnRadius;
    const pileOffsetX = w / 2 + s(55); // matches createPlayerPiles offset
    const btnY = top + r + s(8);       // above the play mat area

    this.createCircleBtn(
      scene,
      cx - pileOffsetX,
      btnY,
      r,
      "❄",
      NUM.teal,
      () => { if (this.onSleep) this.onSleep(); },
      Math.round(r * 4 / 3),
      "Enter Cryosleep — skip to Succession phase"
    );

    this.createCircleBtn(
      scene,
      cx + pileOffsetX,
      btnY,
      r,
      "END",
      NUM.slab,
      () => { if (this.onEndTurn) this.onEndTurn(); },
      undefined,
      "End Turn — resolve market and draw cards"
    );

    this.setDepth(-1);
    scene.add.existing(this);
  }

  private createCircleBtn(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    label: string,
    fillColor: number,
    onClick: () => void,
    labelSize?: number,
    tooltip?: string
  ): void {
    const gfx = scene.add.graphics();
    const drawNormal = () => {
      gfx.clear();
      gfx.fillStyle(fillColor, 0.85);
      gfx.fillCircle(0, 0, radius);
      gfx.lineStyle(s(2), NUM.graphite, 0.7);
      gfx.strokeCircle(0, 0, radius);
    };
    const drawHover = () => {
      gfx.clear();
      gfx.fillStyle(fillColor, 1);
      gfx.fillCircle(0, 0, radius);
      gfx.lineStyle(s(2), NUM.bone, 0.9);
      gfx.strokeCircle(0, 0, radius);
    };
    drawNormal();

    const text = scene.add.text(0, 0, label, {
      fontSize: labelSize ? `${labelSize}px` : fs(12),
      color: HEX.bone,
      fontFamily: "'Orbitron', monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // Tooltip text (hidden by default, shown on hover)
    let tooltipText: Phaser.GameObjects.Text | null = null;
    let tooltipBg: Phaser.GameObjects.Graphics | null = null;
    if (tooltip) {
      tooltipBg = scene.add.graphics();
      tooltipText = scene.add.text(0, -radius - s(20), tooltip, {
        fontSize: fs(8),
        color: HEX.bone,
        fontFamily: "'Space Grotesk', sans-serif",
        backgroundColor: "#1a1a2e",
        padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setVisible(false);
    }

    // Invisible interactive hit area over the circle
    const hitArea = scene.add.circle(0, 0, radius, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => {
      drawHover();
      text.setColor("#ffffff");
      if (tooltipText) tooltipText.setVisible(true);
    });
    hitArea.on("pointerout", () => {
      drawNormal();
      text.setColor(HEX.bone);
      if (tooltipText) tooltipText.setVisible(false);
    });
    hitArea.on("pointerdown", onClick);

    // Add to scene directly (not to PlayMat container) at high depth
    const children: Phaser.GameObjects.GameObject[] = [gfx, text, hitArea];
    if (tooltipText) children.push(tooltipText);
    const container = scene.add.container(x, y, children);
    container.setDepth(50);
  }

  private drawBg(highlighted: boolean): void {
    const w = this.matW;
    const h = this.matH;
    this.bgGfx.clear();
    if (highlighted) {
      this.bgGfx.fillStyle(NUM.chartreuse, 0.15);
      this.bgGfx.fillRoundedRect(-w / 2, -h / 2, w, h, s(12));
      this.bgGfx.lineStyle(s(2.5), NUM.chartreuse, 0.6);
      this.bgGfx.strokeRoundedRect(-w / 2, -h / 2, w, h, s(12));
    } else {
      this.bgGfx.fillStyle(NUM.slab, 0.12);
      this.bgGfx.fillRoundedRect(-w / 2, -h / 2, w, h, s(12));
      this.bgGfx.lineStyle(s(1.5), NUM.graphite, 0.35);
      this.bgGfx.strokeRoundedRect(-w / 2, -h / 2, w, h, s(12));
    }
  }

  /** Highlight the play mat as a valid drop target. */
  setHighlight(active: boolean): void {
    if (this.highlightTween) {
      this.highlightTween.destroy();
      this.highlightTween = null;
    }
    this.drawBg(active);
    if (active) {
      this.highlightTween = this.scene.tweens.add({
        targets: this.bgGfx,
        alpha: { from: 1, to: 0.5 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else {
      this.bgGfx.setAlpha(1);
    }
  }
}
