import Phaser from "phaser";
import type { SectorState, CardInstance } from "@icebox/shared";
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
  private titleContainer: Phaser.GameObjects.Container;
  private nameText: Phaser.GameObjects.Text;
  private dominantText: Phaser.GameObjects.Text;
  private slotsContainer: Phaser.GameObjects.Container;
  private cardSprites: CardSprite[] = [];
  private slotIndicators: Phaser.GameObjects.Rectangle[] = [];

  private dropHighlightGfx: Phaser.GameObjects.Graphics;

  /** Callback fired when a sector card is hovered (for InfoPanel) */
  public onCardClicked: ((card: import("@icebox/shared").CardInstance) => void) | null = null;
  /** Callback fired when pointer leaves a sector card */
  public onCardUnhovered: (() => void) | null = null;
  /** Callback fired on right-click of an installed card (for scrap) */
  public onCardRightClicked: ((instanceId: string, sectorIndex: number) => void) | null = null;
  /** Callback fired on left-click of an under-construction card (for construction panel) */
  public onConstructionClicked: ((card: CardInstance, sectorIndex: number) => void) | null = null;

  private crewPipObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, sectorIndex: number) {
    super(scene, x, y);
    this.sectorIndex = sectorIndex;

    // Background
    this.bg = scene.add.image(0, 0, "sector-bg");
    this.add(this.bg);

    // Title row: "Engineering  >> Void-Forged" on one line
    this.titleContainer = scene.add.container(0, s(-78));
    this.add(this.titleContainer);

    this.nameText = scene.add.text(0, 0, SECTOR_NAMES[sectorIndex], {
      fontSize: fs(12),
      color: HEX.eggshell,
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    this.nameText.setOrigin(1, 0.5); // right-aligned, will position dynamically
    this.titleContainer.add(this.nameText);

    this.dominantText = scene.add.text(s(4), 0, "", {
      fontSize: fs(9),
      color: HEX.darkCyan,
      fontFamily: "monospace",
    });
    this.dominantText.setOrigin(0, 0.5); // left-aligned, sits after name
    this.titleContainer.add(this.dominantText);

    // Slot containers
    this.slotsContainer = scene.add.container(0, s(10));
    this.add(this.slotsContainer);

    // Create 3 empty slot indicators — 0.88 scale cards
    const slotScale = 0.88;
    for (let i = 0; i < 3; i++) {
      const slotX = (i - 1) * (CARD_WIDTH * slotScale + s(6));
      const slot = scene.add.rectangle(slotX, 0, CARD_WIDTH * slotScale + s(2), s(120), NUM.midnightViolet, 0.3);
      slot.setStrokeStyle(s(1), NUM.charcoalBlue, 0.3);
      this.slotsContainer.add(slot);
      this.slotIndicators.push(slot);
    }

    // Drop highlight overlay (hidden by default)
    this.dropHighlightGfx = scene.add.graphics();
    this.dropHighlightGfx.setVisible(false);
    this.add(this.dropHighlightGfx);

    // Interactive for slotting structures (click the sector zone)
    this.setSize(s(345), s(215));
    this.setInteractive({ useHandCursor: true, dropZone: true });

    scene.add.existing(this);
  }

  private repositionTitle(): void {
    // Center the combined "Name  >> Faction" as a unit
    const nameW = this.nameText.width;
    const domW = this.dominantText.width;
    const gap = s(4);
    const totalW = nameW + gap + domW;
    this.nameText.setX(-totalW / 2 + nameW);
    this.dominantText.setX(-totalW / 2 + nameW + gap);
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
      this.dominantText.setText("");
      this.dominantText.setColor(HEX.darkCyan);
      this.bg.clearTint();
      this.bg.setAlpha(1);
    }

    this.repositionTitle();

    // Clear existing card sprites and crew pips
    for (const sprite of this.cardSprites) {
      sprite.destroy();
    }
    this.cardSprites = [];
    for (const pip of this.crewPipObjects) {
      pip.destroy();
    }
    this.crewPipObjects = [];

    // Build crew attachment map: structureInstanceId → crew cards attached
    const crewMap = new Map<string, CardInstance[]>();
    for (const card of sector.installedCards) {
      if (card.card.type === "crew" && card.attachedTo) {
        const existing = crewMap.get(card.attachedTo) ?? [];
        existing.push(card);
        crewMap.set(card.attachedTo, existing);
      }
    }

    // Show installed cards — hover shows InfoPanel
    const cardScale = 0.88;
    for (let i = 0; i < sector.installedCards.length; i++) {
      const inst = sector.installedCards[i];
      // Skip crew cards that are attached (they show as pips on the structure)
      if (inst.card.type === "crew" && inst.attachedTo) continue;

      const slotX = (i - 1) * (CARD_WIDTH * cardScale + s(6));
      const sprite = new CardSprite(this.scene, slotX, 0, inst);
      sprite.setScale(cardScale);
      sprite.setBaseScale(cardScale);

      // Enable market-mode hover (subtle, no lift) for tooltip support
      sprite.setMarketMode(true);

      // Construction overlay
      if (inst.underConstruction && inst.card.construction) {
        sprite.setConstructionOverlay(
          true,
          inst.constructionProgress ?? 0,
          inst.card.construction.completionTime ?? 0
        );
      }

      // Fire callback when hovered so InfoPanel can display card details
      sprite.on("pointerover", () => {
        if (this.onCardClicked) this.onCardClicked(inst);
      });
      sprite.on("pointerout", () => {
        if (this.onCardUnhovered) this.onCardUnhovered();
      });
      // Click handling
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.button === 2 && this.onCardRightClicked) {
          this.onCardRightClicked(inst.instanceId, this.sectorIndex);
        } else if (pointer.button === 0 && inst.underConstruction && this.onConstructionClicked) {
          this.onConstructionClicked(inst, this.sectorIndex);
        }
      });

      this.slotsContainer.add(sprite);
      this.cardSprites.push(sprite);

      // Draw crew pips on structures that have attached crew
      const attachedCrew = crewMap.get(inst.instanceId);
      if (attachedCrew && attachedCrew.length > 0) {
        const pipY = s(50); // below center of card
        const pipGap = s(12);
        const startPipX = slotX - ((attachedCrew.length - 1) * pipGap) / 2;
        for (let j = 0; j < attachedCrew.length; j++) {
          const crew = attachedCrew[j];
          const skillColors: Record<string, number> = {
            Engineer: 0x4488cc,
            Botanist: 0x44cc44,
            Orator: 0xcccc44,
            Logic: 0xcc44cc,
          };
          const color = skillColors[crew.card.crew?.skillTag ?? ""] ?? 0xaaaaaa;
          const pipGfx = this.scene.add.graphics();
          const pipX = startPipX + j * pipGap;
          pipGfx.fillStyle(color, 0.9);
          pipGfx.fillCircle(pipX, pipY, s(5));
          pipGfx.lineStyle(s(1), 0xffffff, 0.5);
          pipGfx.strokeCircle(pipX, pipY, s(5));
          this.slotsContainer.add(pipGfx);
          this.crewPipObjects.push(pipGfx);

          // Skill initial
          const initial = (crew.card.crew?.skillTag ?? "?")[0];
          const pipText = this.scene.add.text(pipX, pipY, initial, {
            fontSize: fs(6), color: "#ffffff", fontFamily: "monospace", fontStyle: "bold",
          }).setOrigin(0.5);
          this.slotsContainer.add(pipText);
          this.crewPipObjects.push(pipText);
        }
      }
    }

    // Update slot indicators visibility
    for (let i = 0; i < this.slotIndicators.length; i++) {
      this.slotIndicators[i].setVisible(i >= sector.installedCards.length && i < sector.maxSlots);
    }
  }

  /** Show/hide a colored overlay indicating this sector is a valid/invalid drop target. */
  setDropHighlight(active: boolean, valid: boolean): void {
    this.dropHighlightGfx.clear();
    if (!active) {
      this.dropHighlightGfx.setVisible(false);
      return;
    }
    const color = valid ? 0x44cc44 : 0xcc4444;
    const w = s(345);
    const h = s(215);
    this.dropHighlightGfx.fillStyle(color, 0.1);
    this.dropHighlightGfx.fillRoundedRect(-w / 2, -h / 2, w, h, s(6));
    this.dropHighlightGfx.lineStyle(s(2), color, 0.6);
    this.dropHighlightGfx.strokeRoundedRect(-w / 2, -h / 2, w, h, s(6));
    this.dropHighlightGfx.setVisible(true);
  }
}
