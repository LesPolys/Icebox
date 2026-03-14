import Phaser from "phaser";
import type { CardInstance } from "@icebox/shared";
import { CardSprite } from "./CardSprite";

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

  constructor(scene: Phaser.Scene, x: number, y: number, slotIndex: number, scaled = false) {
    super(scene, x, y);
    this.slotIndex = slotIndex;

    // Empty slot visual — also scaled if market uses smaller cards
    this.emptySlot = scene.add.image(0, 0, "card-empty");
    if (scaled) this.emptySlot.setScale(MARKET_CARD_SCALE);
    this.add(this.emptySlot);

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
