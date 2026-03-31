import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import type { ActionPoolState } from "@icebox/shared";
import { s, fontSize as fs } from "./layout";
import { RESOURCE_META, drawResourceShape } from "../game-objects/ResourceBar";
import { renderBarokText, measureBarokText } from "./BarokFont";

/**
 * Persistent UI widget showing available resource action tokens.
 * Positioned below the EraDisplay on the left side of the screen.
 *
 * Each resource type is shown as a row with a label and token icons.
 * Tokens pop in when gained and shrink out when consumed.
 */

const ACTION_LABELS: Record<string, string> = {
  matter: "Build",
  energy: "Tap",
  data: "Scry",
  influence: "Swap",
};

export class ActionPool extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private rows: Map<string, {
    label: Phaser.GameObjects.Text;
    tokens: Phaser.GameObjects.Graphics[];
    count: number;
    hitArea: Phaser.GameObjects.Rectangle;
  }> = new Map();
  private panelW: number;
  private panelH: number;

  /** Current action counts */
  private poolState: ActionPoolState = { matter: 0, energy: 0, data: 0, influence: 0 };

  /** Callback when player clicks an action row to activate it */
  public onActionClicked: ((resourceKey: string) => void) | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    super(scene, x, y);
    this.setDepth(100);
    this.panelW = width;

    const rowH = s(22);
    const titleH = s(18);
    const pad = s(6);
    this.panelH = titleH + pad + RESOURCE_META.length * rowH + pad;

    // Background
    this.bg = scene.add.rectangle(0, 0, this.panelW, this.panelH, NUM.slab, 0.7);
    this.bg.setStrokeStyle(s(1), NUM.graphite, 0.5);
    this.bg.setOrigin(0, 0);
    this.add(this.bg);

    // Title (Barok font)
    const titleW = measureBarokText("ACTION POOL", s(8));
    const titleContainer = renderBarokText(scene, "ACTION POOL", NUM.chartreuse, s(8), this.panelW / 2 - titleW / 2, pad);
    this.add(titleContainer);
    // Keep reference for potential future updates (unused but matches original field)
    this.titleText = scene.add.text(0, 0, "").setVisible(false);
    this.add(this.titleText);

    // Create rows for each resource type
    let rowY = titleH + pad;
    for (const meta of RESOURCE_META) {
      const label = scene.add.text(pad + s(4), rowY + rowH / 2, `${ACTION_LABELS[meta.key]}`, {
        fontSize: fs(7),
        color: meta.color,
        fontFamily: "Space Mono",
        fontStyle: "bold",
      }).setOrigin(0, 0.5);
      this.add(label);

      // Clickable hit area for the whole row
      const hitArea = scene.add.rectangle(this.panelW / 2, rowY + rowH / 2, this.panelW, rowH, 0xffffff, 0);
      hitArea.setInteractive({ useHandCursor: true });
      hitArea.on("pointerover", () => {
        const r = this.rows.get(meta.key);
        if (r && r.count > 0) hitArea.setFillStyle(0xffffff, 0.05);
      });
      hitArea.on("pointerout", () => hitArea.setFillStyle(0xffffff, 0));
      hitArea.on("pointerdown", () => {
        const r = this.rows.get(meta.key);
        if (r && r.count > 0) this.onActionClicked?.(meta.key);
      });
      this.add(hitArea);

      this.rows.set(meta.key, { label, tokens: [], count: 0, hitArea });
      rowY += rowH;
    }

    scene.add.existing(this as unknown as Phaser.GameObjects.Container);
  }

  /** Update the pool display from game state */
  updatePool(actions: ActionPoolState): void {
    const prev = this.poolState;
    this.poolState = { ...actions };

    for (const meta of RESOURCE_META) {
      const key = meta.key as keyof ActionPoolState;
      const row = this.rows.get(meta.key);
      if (!row) continue;

      const newCount = actions[key];
      const oldCount = row.count;

      if (newCount !== oldCount) {
        this.rebuildTokens(meta.key, newCount, newCount > oldCount);
      }
    }
  }

  /** Get current count of a specific action type */
  getCount(resourceKey: string): number {
    return this.poolState[resourceKey as keyof ActionPoolState] ?? 0;
  }

  private rebuildTokens(key: string, count: number, animate: boolean): void {
    const row = this.rows.get(key);
    if (!row) return;
    const meta = RESOURCE_META.find(m => m.key === key);
    if (!meta) return;

    // Destroy old tokens
    for (const t of row.tokens) t.destroy();
    row.tokens = [];
    row.count = count;

    // Token layout: start after the label text
    const tokenStartX = s(50);
    const tokenSpacing = s(16);
    const tokenSize = s(6);
    const rowIdx = RESOURCE_META.indexOf(meta);
    const rowH = s(22);
    const titleH = s(18);
    const pad = s(6);
    const rowY = titleH + pad + rowIdx * rowH + rowH / 2;

    for (let i = 0; i < count; i++) {
      const gfx = this.scene.add.graphics();
      const tx = tokenStartX + i * tokenSpacing;

      drawResourceShape(gfx, meta.shape, tx, rowY, tokenSize, meta.numColor, 0.6, 1);

      if (animate) {
        gfx.setScale(0);
        this.scene.tweens.add({
          targets: gfx,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          delay: i * 50,
          ease: "Back.easeOut",
        });
      }

      this.add(gfx);
      row.tokens.push(gfx);
    }

    // Update label opacity based on whether tokens exist
    row.label.setAlpha(count > 0 ? 1 : 0.3);
  }

  /** Get the height of this panel for layout purposes */
  get panelHeight(): number {
    return this.panelH;
  }
}
