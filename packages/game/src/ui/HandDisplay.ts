import Phaser from "phaser";
import type { CardInstance } from "@icebox/shared";
import { NUM, HEX } from "@icebox/shared";
import { CardSprite, CARD_WIDTH, CARD_HEIGHT } from "../game-objects/CardSprite";
import { s, fontSize as fs, GAME_H } from "./layout";

const CARD_SPACING = s(8);
const HAND_PADDING = s(20);
const MIN_HAND_WIDTH = s(300);

/** Minimum pointer movement (px) before a click becomes a drag */
const DRAG_THRESHOLD = s(6);

/** Max interval (ms) between two clicks to count as double-click */
const DOUBLE_CLICK_MS = 350;

/**
 * Horizontal card layout for the player's hand.
 *
 * Single click = select/deselect + InfoPanel.
 * Double-click = play card (fires onCardDoubleClicked).
 * Drag within hand = reorder.
 * Drag above hand zone = drag-out (fires onDragStarted / onCardDropped).
 * Hand tucks down when the mouse leaves the area.
 */
export class HandDisplay extends Phaser.GameObjects.Container {
  private cardSprites: CardSprite[] = [];
  private selectedInstanceId: string | null = null;
  private handBg!: Phaser.GameObjects.Rectangle;
  private handBorder!: Phaser.GameObjects.Rectangle;
  private handLabel!: Phaser.GameObjects.Text;

  // ── Public callbacks ──
  public onCardSelected: ((instanceId: string) => void) | null = null;
  public onCardHovered: ((instanceId: string | null) => void) | null = null;
  public onCardDoubleClicked: ((instanceId: string) => void) | null = null;
  public onCardDropped: ((instanceId: string, worldX: number, worldY: number) => void) | null = null;
  public onDragStarted: ((instanceId: string) => void) | null = null;
  public onDragEnded: (() => void) | null = null;

  // Pointer-down state (before we know if it's a click or drag)
  private pendingCard: CardSprite | null = null;
  private pendingIndex = -1;
  private pointerStartX = 0;
  private pointerStartY = 0;

  // Active drag state (only set after threshold exceeded)
  private dragging = false;
  private dragCard: CardSprite | null = null;
  private dragStartIndex = -1;
  private dragLocalOffsetX = 0;
  private dragLocalOffsetY = 0;

  // Drag-out-of-hand state
  private draggedOutOfHand = false;
  private dragOutFired = false;

  // Double-click detection
  private lastClickTime = 0;
  private lastClickInstanceId: string | null = null;

  private handCards: CardInstance[] = [];

  // Tuck state
  private baseY: number;
  private tuckOffset: number;
  private tucked = true;

  /** Y threshold — pointer below this triggers untuck */
  private handZoneTopY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, tuckOffset = 60) {
    super(scene, x, y + tuckOffset); // start tucked
    this.baseY = y;
    this.tuckOffset = tuckOffset;

    // The hand zone starts well above the cards to give a comfortable hover area
    this.handZoneTopY = y - CARD_HEIGHT / 2 - HAND_PADDING - s(40);

    // Hand area background
    this.handBg = scene.add.rectangle(0, 0, MIN_HAND_WIDTH, CARD_HEIGHT + HAND_PADDING * 2, NUM.slab, 0.5);
    this.add(this.handBg);

    // Hand area border
    this.handBorder = scene.add.rectangle(0, 0, MIN_HAND_WIDTH, CARD_HEIGHT + HAND_PADDING * 2);
    this.handBorder.setStrokeStyle(s(2), NUM.graphite, 0.7);
    this.handBorder.setFillStyle(0x000000, 0);
    this.add(this.handBorder);

    // "HAND" label
    this.handLabel = scene.add.text(0, -(CARD_HEIGHT / 2 + HAND_PADDING + s(2)), "HAND", {
      fontSize: fs(9),
      color: HEX.chartreuse,
      fontFamily: "'Orbitron', monospace",
    });
    this.handLabel.setOrigin(0.5, 1);
    this.add(this.handLabel);

    // ── Scene-level pointer handlers for tuck/untuck + drag ──

    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      // Tuck/untuck based on pointer Y position
      if (pointer.y >= this.handZoneTopY) {
        this.untuck();
      } else if (!this.dragging) {
        this.tuck();
      }

      // Drag handling
      if (!this.pendingCard) return;

      const dx = pointer.x - this.pointerStartX;
      const dy = pointer.y - this.pointerStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Haven't crossed threshold yet — don't move anything
      if (!this.dragging && dist < DRAG_THRESHOLD) return;

      // First time crossing threshold → promote to drag
      if (!this.dragging) {
        this.dragging = true;
        this.dragCard = this.pendingCard;
        this.dragStartIndex = this.pendingIndex;

        const localPx = this.pointerStartX - this.x;
        const localPy = this.pointerStartY - this.y;
        this.dragLocalOffsetX = this.dragCard.x - localPx;
        this.dragLocalOffsetY = this.dragCard.y - localPy;

        this.dragCard.setDepth(200);
        this.dragCard.setAlpha(0.8);
        // Clear selection highlight while dragging
        this.dragCard.setSelected(false);
      }

      // Move the card with the pointer
      const localX = pointer.x - this.x;
      const localY = pointer.y - this.y;
      this.dragCard!.x = localX + this.dragLocalOffsetX;
      this.dragCard!.y = localY + this.dragLocalOffsetY;

      // Check if card has been dragged above the hand zone
      if (pointer.y < this.handZoneTopY) {
        if (!this.draggedOutOfHand) {
          this.draggedOutOfHand = true;
          this.dragOutFired = false;
        }
        if (!this.dragOutFired && this.dragCard) {
          this.dragOutFired = true;
          this.dragCard.setDragGhost(true);
          if (this.onDragStarted) {
            this.onDragStarted(this.dragCard.cardInstance.instanceId);
          }
        }
        // Don't reorder when dragged out
      } else {
        // Back in hand zone — revert to reorder mode
        if (this.draggedOutOfHand && this.dragCard) {
          this.draggedOutOfHand = false;
          this.dragOutFired = false;
          this.dragCard.setDragGhost(false);
          if (this.onDragEnded) this.onDragEnded();
        }
        this.checkReorder();
      }
    });

    scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.dragging && this.dragCard) {
        if (this.draggedOutOfHand) {
          // Card was dropped outside the hand — notify scene
          const instanceId = this.dragCard.cardInstance.instanceId;
          this.dragCard.setDragGhost(false);
          if (this.onCardDropped) {
            this.onCardDropped(instanceId, pointer.worldX, pointer.worldY);
          }
          if (this.onDragEnded) this.onDragEnded();
        }
        this.finishDrag();
      } else if (this.pendingCard) {
        // It was a click (no significant movement) — check double-click
        const instanceId = this.pendingCard.cardInstance.instanceId;
        const now = Date.now();

        if (
          this.lastClickInstanceId === instanceId &&
          now - this.lastClickTime < DOUBLE_CLICK_MS
        ) {
          // Double-click!
          this.lastClickTime = 0;
          this.lastClickInstanceId = null;
          if (this.onCardDoubleClicked) this.onCardDoubleClicked(instanceId);
        } else {
          // Single click — toggle selection
          this.lastClickTime = now;
          this.lastClickInstanceId = instanceId;
          this.toggleSelect(instanceId);
        }
      }

      // Reset pending/drag state
      this.pendingCard = null;
      this.pendingIndex = -1;
      this.dragging = false;
      this.draggedOutOfHand = false;
      this.dragOutFired = false;
    });

    scene.add.existing(this);
  }

  // ── Tuck ──

  private untuck(): void {
    if (!this.tucked) return;
    this.tucked = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.baseY,
      duration: 200,
      ease: "Power2",
    });
  }

  private tuck(): void {
    if (this.tucked || this.dragging) return;
    this.tucked = true;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.baseY + this.tuckOffset,
      duration: 300,
      ease: "Power2",
    });
  }

  // ── Build / rebuild hand display ──

  updateHand(handCards: CardInstance[]): void {
    this.handCards = [...handCards];

    // Clear old sprites
    for (const sprite of this.cardSprites) sprite.destroy();
    this.cardSprites = [];

    const cardCount = handCards.length;
    const totalWidth = Math.max(MIN_HAND_WIDTH, cardCount * (CARD_WIDTH + CARD_SPACING) - CARD_SPACING + HAND_PADDING * 2);
    const cardsWidth = cardCount * (CARD_WIDTH + CARD_SPACING) - CARD_SPACING;
    const startX = -cardsWidth / 2 + CARD_WIDTH / 2;

    this.handBg.setSize(totalWidth, CARD_HEIGHT + HAND_PADDING * 2);
    this.handBorder.setSize(totalWidth, CARD_HEIGHT + HAND_PADDING * 2);

    for (let i = 0; i < handCards.length; i++) {
      const cardX = startX + i * (CARD_WIDTH + CARD_SPACING);
      const sprite = new CardSprite(this.scene, cardX, 0, handCards[i]);
      sprite.setOriginalY(0);

      // Hover → InfoPanel
      sprite.on("pointerover", () => {
        if (this.onCardHovered) this.onCardHovered(handCards[i].instanceId);
      });
      sprite.on("pointerout", () => {
        if (this.onCardHovered && !this.selectedInstanceId) this.onCardHovered(null);
      });

      // Pointer down → record as pending (click or drag TBD)
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        // Find the current index of this sprite (may differ from closure `i` after swaps)
        const idx = this.cardSprites.indexOf(sprite);
        this.pendingCard = sprite;
        this.pendingIndex = idx >= 0 ? idx : i;
        this.pointerStartX = pointer.x;
        this.pointerStartY = pointer.y;
      });

      this.add(sprite);
      this.cardSprites.push(sprite);
    }

    // Reapply selection visual
    if (this.selectedInstanceId) this.highlightSelected();
  }

  // ── Selection ──

  private toggleSelect(instanceId: string): void {
    if (this.selectedInstanceId === instanceId) {
      this.selectedInstanceId = null;
    } else {
      this.selectedInstanceId = instanceId;
    }
    this.highlightSelected();
    if (this.selectedInstanceId && this.onCardSelected) {
      this.onCardSelected(this.selectedInstanceId);
    }
    if (!this.selectedInstanceId && this.onCardHovered) {
      this.onCardHovered(null);
    }
  }

  private highlightSelected(): void {
    for (const sprite of this.cardSprites) {
      sprite.setSelected(sprite.cardInstance.instanceId === this.selectedInstanceId);
    }
  }

  selectCard(instanceId: string): void {
    this.toggleSelect(instanceId);
  }

  getSelectedInstanceId(): string | null {
    return this.selectedInstanceId;
  }

  /** Return world-space position of each card by instanceId. */
  getCardWorldPositions(): Map<string, { x: number; y: number }> {
    const map = new Map<string, { x: number; y: number }>();
    for (const sprite of this.cardSprites) {
      const worldX = this.x + sprite.x;
      const worldY = this.y + sprite.y;
      map.set(sprite.cardInstance.instanceId, { x: worldX, y: worldY });
    }
    return map;
  }

  /** Hide specific cards by instanceId (used during draw animation). */
  setCardsVisible(instanceIds: Set<string>, visible: boolean): void {
    for (const sprite of this.cardSprites) {
      if (instanceIds.has(sprite.cardInstance.instanceId)) {
        sprite.setVisible(visible);
      }
    }
  }

  clearSelection(): void {
    this.selectedInstanceId = null;
    this.highlightSelected();
  }

  // ── Drag reorder ──

  private slotX(index: number): number {
    const cardCount = this.cardSprites.length;
    const cardsWidth = cardCount * (CARD_WIDTH + CARD_SPACING) - CARD_SPACING;
    const startX = -cardsWidth / 2 + CARD_WIDTH / 2;
    return startX + index * (CARD_WIDTH + CARD_SPACING);
  }

  private checkReorder(): void {
    if (!this.dragCard || this.dragStartIndex < 0) return;

    const dragX = this.dragCard.x;
    const idx = this.dragStartIndex;
    const count = this.cardSprites.length;

    // Swap left
    if (idx > 0 && dragX < this.slotX(idx - 1) + (CARD_WIDTH + CARD_SPACING) / 2) {
      this.swapCards(idx, idx - 1);
      return;
    }
    // Swap right
    if (idx < count - 1 && dragX > this.slotX(idx + 1) - (CARD_WIDTH + CARD_SPACING) / 2) {
      this.swapCards(idx, idx + 1);
    }
  }

  private swapCards(fromIdx: number, toIdx: number): void {
    // Swap data
    [this.handCards[fromIdx], this.handCards[toIdx]] = [this.handCards[toIdx], this.handCards[fromIdx]];
    [this.cardSprites[fromIdx], this.cardSprites[toIdx]] = [this.cardSprites[toIdx], this.cardSprites[fromIdx]];

    // Animate the displaced card (now at fromIdx) to its new slot
    const displaced = this.cardSprites[fromIdx];
    this.scene.tweens.killTweensOf(displaced);
    this.scene.tweens.add({
      targets: displaced,
      x: this.slotX(fromIdx),
      duration: 120,
      ease: "Power2",
    });
    displaced.setOriginalY(0);

    this.dragStartIndex = toIdx;
  }

  private finishDrag(): void {
    if (!this.dragCard || this.dragStartIndex < 0) return;

    const finalX = this.slotX(this.dragStartIndex);
    const card = this.dragCard;

    this.scene.tweens.add({
      targets: card,
      x: finalX,
      y: 0,
      duration: 150,
      ease: "Power2",
      onComplete: () => {
        card.setAlpha(1);
        card.setDepth(0);
        card.setOriginalY(0);
      },
    });

    this.dragCard = null;
    this.dragStartIndex = -1;
    this.dragLocalOffsetX = 0;
    this.dragLocalOffsetY = 0;
  }
}
