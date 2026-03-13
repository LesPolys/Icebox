import Phaser from "phaser";
import type { CardInstance } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { CardSprite, CARD_WIDTH, CARD_HEIGHT } from "./CardSprite";
import { s, fontSize as fs } from "../ui/layout";

/** Scale applied to market cards so they fit cleanly in columns. */
const MARKET_CARD_SCALE = 0.55;

/**
 * A single slot in the Transit Market conveyor.
 * Cards are displayed at reduced scale.
 */
export class MarketSlot extends Phaser.GameObjects.Container {
  public slotIndex: number;
  public cardSprite: CardSprite | null = null;
  private emptySlot: Phaser.GameObjects.Image;
  private falloutIndicator: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, slotIndex: number, scaled = false) {
    super(scene, x, y);
    this.slotIndex = slotIndex;

    // Empty slot visual — also scaled if market uses smaller cards
    this.emptySlot = scene.add.image(0, 0, "card-empty");
    if (scaled) this.emptySlot.setScale(MARKET_CARD_SCALE);
    this.add(this.emptySlot);

    // Fallout warning on slot 0
    const yOffset = scaled ? -(CARD_HEIGHT * MARKET_CARD_SCALE) / 2 - s(10) : -CARD_HEIGHT / 2 - s(12);
    this.falloutIndicator = scene.add.text(0, yOffset, "FALLOUT", {
      fontSize: fs(7),
      color: HEX.dustyMauve,
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    this.falloutIndicator.setOrigin(0.5);
    this.falloutIndicator.setVisible(slotIndex === 0);
    this.add(this.falloutIndicator);

    scene.add.existing(this);
  }

  setCard(cardInstance: CardInstance | null): void {
    if (this.cardSprite) {
      this.cardSprite.destroy();
      this.cardSprite = null;
    }

    if (cardInstance) {
      this.emptySlot.setVisible(false);
      this.cardSprite = new CardSprite(this.scene, 0, 0, cardInstance);
      this.cardSprite.setScale(MARKET_CARD_SCALE);
      // Disable the large hover lift on market cards — keep them compact
      this.cardSprite.setMarketMode(true);
      this.add(this.cardSprite);
    } else {
      this.emptySlot.setVisible(true);
    }
  }

  clearCard(): void {
    this.setCard(null);
  }
}
