import Phaser from "phaser";
import type { CardInstance, SectorState } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { s, LAYOUT, MAIN_CX } from "./layout";

/**
 * Visual overlay showing valid drop targets while dragging a card from hand.
 *
 * - Action / event / junk cards: shows a horizontal "PLAY" bar in the play zone.
 * - Structure / institution cards: highlights sector zones (green = has space, red = full).
 */
export class DropZoneIndicator extends Phaser.GameObjects.Container {
  private playBar: Phaser.GameObjects.Container;
  private sectorHighlights: Phaser.GameObjects.Graphics[] = [];
  private pulseTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setDepth(5);

    // ── Play bar (for action / event / junk) ──
    const barW = LAYOUT.playMatW * 0.6;
    const barH = LAYOUT.playZoneH;
    this.playBar = scene.add.container(MAIN_CX, LAYOUT.playZoneY);

    const barBg = scene.add.rectangle(0, 0, barW, barH, NUM.chartreuse, 0.2);
    barBg.setStrokeStyle(s(2), NUM.chartreuse, 0.6);
    this.playBar.add(barBg);

    const barText = scene.add.text(0, 0, "DROP TO PLAY", {
      fontSize: `${s(12)}px`,
      color: HEX.chartreuse,
      fontFamily: "'Orbitron', monospace",
      fontStyle: "bold",
    }).setOrigin(0.5).setAlpha(0.8);
    this.playBar.add(barText);

    this.playBar.setVisible(false);
    this.add(this.playBar);

    // ── Sector highlights (for structure / institution) ──
    for (let i = 0; i < 3; i++) {
      const sectorX = MAIN_CX + (i - 1) * LAYOUT.sectorSpacing;
      const gfx = scene.add.graphics();
      gfx.setPosition(sectorX, LAYOUT.sectorY);
      gfx.setVisible(false);
      this.sectorHighlights.push(gfx);
      this.add(gfx);
    }

    this.setVisible(false);
    scene.add.existing(this);
  }

  showForCard(card: CardInstance, sectors: SectorState[]): void {
    this.setVisible(true);
    const type = card.card.type;

    if (type === "structure" || type === "institution") {
      this.playBar.setVisible(false);
      for (let i = 0; i < 3; i++) {
        const hasSpace = sectors[i].installedCards.length < sectors[i].maxSlots;
        this.drawSectorHighlight(i, hasSpace);
        this.sectorHighlights[i].setVisible(true);
      }
    } else {
      // action, event, junk
      this.playBar.setVisible(true);
      for (const h of this.sectorHighlights) h.setVisible(false);
    }

    this.startPulse();
  }

  hide(): void {
    this.setVisible(false);
    this.playBar.setVisible(false);
    for (const h of this.sectorHighlights) h.setVisible(false);
    this.stopPulse();
  }

  private drawSectorHighlight(index: number, valid: boolean): void {
    const gfx = this.sectorHighlights[index];
    const color = valid ? NUM.chartreuse : NUM.signalRed;
    const w = s(270);
    const h = s(140);
    gfx.clear();
    gfx.fillStyle(color, 0.12);
    gfx.fillRoundedRect(-w / 2, -h / 2, w, h, s(6));
    gfx.lineStyle(s(2), color, 0.6);
    gfx.strokeRoundedRect(-w / 2, -h / 2, w, h, s(6));
  }

  private startPulse(): void {
    this.stopPulse();
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private stopPulse(): void {
    if (this.pulseTween) {
      this.pulseTween.destroy();
      this.pulseTween = null;
    }
    this.setAlpha(1);
  }
}
