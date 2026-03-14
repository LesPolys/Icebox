import Phaser from "phaser";
import type { SectorState } from "@icebox/shared";
import { SECTOR_NAMES, FACTIONS, NUM, HEX } from "@icebox/shared";
import { CardSprite, CARD_WIDTH } from "./CardSprite";
import { s, fontSize as fs } from "../ui/layout";

/**
 * Visual display for one ship sector (compact version).
 * Installed structures are shown at small scale with NO hover highlight —
 * clicking a sector card displays it in the InfoPanel instead.
 */
export class SectorDisplay extends Phaser.GameObjects.Container {
  public sectorIndex: number;
  private bg: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private dominantText: Phaser.GameObjects.Text;
  private slotsContainer: Phaser.GameObjects.Container;
  private cardSprites: CardSprite[] = [];
  private slotIndicators: Phaser.GameObjects.Rectangle[] = [];

  /** Callback fired when a sector card is hovered (for InfoPanel) */
  public onCardClicked: ((card: import("@icebox/shared").CardInstance) => void) | null = null;
  /** Callback fired when pointer leaves a sector card */
  public onCardUnhovered: (() => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, sectorIndex: number) {
    super(scene, x, y);
    this.sectorIndex = sectorIndex;

    // Background (compact)
    this.bg = scene.add.image(0, 0, "sector-bg");
    this.add(this.bg);

    // Sector name — eggshell for readability
    this.nameText = scene.add.text(0, s(-60), SECTOR_NAMES[sectorIndex], {
      fontSize: fs(11),
      color: HEX.eggshell,
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    this.nameText.setOrigin(0.5);
    this.add(this.nameText);

    // Dominant faction indicator — darkCyan default
    this.dominantText = scene.add.text(0, s(-44), "No faction dominant", {
      fontSize: fs(8),
      color: HEX.darkCyan,
      fontFamily: "monospace",
    });
    this.dominantText.setOrigin(0.5);
    this.add(this.dominantText);

    // Slot containers
    this.slotsContainer = scene.add.container(0, s(10));
    this.add(this.slotsContainer);

    // Create 3 empty slot indicators (compact)
    for (let i = 0; i < 3; i++) {
      const slotX = (i - 1) * (CARD_WIDTH * 0.45 + s(6));
      const slot = scene.add.rectangle(slotX, 0, CARD_WIDTH * 0.45 + s(2), s(60), NUM.midnightViolet, 0.3);
      slot.setStrokeStyle(s(1), NUM.charcoalBlue, 0.3);
      this.slotsContainer.add(slot);
      this.slotIndicators.push(slot);
    }

    // Interactive for slotting structures (click the sector zone)
    this.setSize(s(270), s(140));
    this.setInteractive({ useHandCursor: true, dropZone: true });

    scene.add.existing(this);
  }

  updateDisplay(sector: SectorState): void {
    // Update dominant faction
    if (sector.dominantFaction) {
      const faction = FACTIONS[sector.dominantFaction];
      this.dominantText.setText(`>> ${faction.name}`);
      this.dominantText.setColor(faction.color);
      this.bg.setTint(
        Phaser.Display.Color.HexStringToColor(faction.color).color
      );
      this.bg.setAlpha(0.2);
    } else {
      this.dominantText.setText("No faction dominant");
      this.dominantText.setColor(HEX.darkCyan);
      this.bg.clearTint();
      this.bg.setAlpha(1);
    }

    // Clear existing card sprites
    for (const sprite of this.cardSprites) {
      sprite.destroy();
    }
    this.cardSprites = [];

    // Show installed cards (compact scale) — hover shows InfoPanel
    for (let i = 0; i < sector.installedCards.length; i++) {
      const slotX = (i - 1) * (CARD_WIDTH * 0.45 + s(6));
      const sprite = new CardSprite(this.scene, slotX, 0, sector.installedCards[i]);
      sprite.setScale(0.42);
      sprite.setBaseScale(0.42);

      // Enable market-mode hover (subtle, no lift) for tooltip support
      sprite.setMarketMode(true);

      // Fire callback when hovered so InfoPanel can display card details
      sprite.on("pointerover", () => {
        if (this.onCardClicked) this.onCardClicked(sector.installedCards[i]);
      });
      sprite.on("pointerout", () => {
        if (this.onCardUnhovered) this.onCardUnhovered();
      });

      this.slotsContainer.add(sprite);
      this.cardSprites.push(sprite);
    }

    // Update slot indicators visibility
    for (let i = 0; i < this.slotIndicators.length; i++) {
      this.slotIndicators[i].setVisible(i >= sector.installedCards.length && i < sector.maxSlots);
    }
  }
}
