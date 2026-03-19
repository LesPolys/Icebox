import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs, GAME_W, GAME_H, MAIN_CX } from "./layout";
import type { ResourceAction, PendingResourceActionGroup } from "../systems/ResourceActionManager";

/**
 * UI panel that shows pending resource actions from market falloff or purchase.
 * Displays the current group's card name, remaining actions, and lets the player
 * pick which action to resolve next (or skip).
 */

const ACTION_LABELS: Record<ResourceAction["type"], string> = {
  "progress-building": "Matter: Progress a building",
  "tap-card": "Energy: Tap a card",
  "scry-market": "Data: Scry market deck",
  "swap-market": "Influence: Swap market cards",
};

const ACTION_COLORS: Record<ResourceAction["type"], number> = {
  "progress-building": 0xcc8844,  // matter orange
  "tap-card": 0x44cc44,           // energy green
  "scry-market": 0x4488cc,        // data blue
  "swap-market": 0x8844cc,        // influence purple
};

export class ResourceActionPanel extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Rectangle;
  private titleText!: Phaser.GameObjects.Text;
  private sourceText!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Container[] = [];

  /** Callback when the player selects an action to resolve */
  public onActionSelected: ((action: ResourceAction) => void) | null = null;
  /** Callback when the player skips an action */
  public onActionSkipped: ((action: ResourceAction) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, MAIN_CX, s(340));
    this.setDepth(900);
    this.setVisible(false);

    const panelW = s(320);
    const panelH = s(200);

    this.bg = scene.add.rectangle(0, 0, panelW, panelH, NUM.midnightViolet, 0.95);
    this.bg.setStrokeStyle(s(2), 0x6688aa, 0.8);
    this.add(this.bg);

    this.titleText = scene.add.text(0, -panelH / 2 + s(12), "RESOLVE RESOURCE ACTIONS", {
      fontSize: fs(11),
      color: HEX.pearlAqua,
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5, 0);
    this.add(this.titleText);

    this.sourceText = scene.add.text(0, -panelH / 2 + s(28), "", {
      fontSize: fs(9),
      color: HEX.eggshell,
      fontFamily: "monospace",
    }).setOrigin(0.5, 0);
    this.add(this.sourceText);

    scene.add.existing(this);
  }

  /**
   * Show the panel with a group of pending actions.
   */
  show(group: PendingResourceActionGroup): void {
    // Clear old buttons
    for (const btn of this.actionButtons) btn.destroy();
    this.actionButtons = [];

    const sourceLabel = group.source === "fallout" ? "Fallout" : "Purchase";
    this.sourceText.setText(`${sourceLabel}: ${group.cardName}`);

    const panelW = s(320);
    let y = -s(200) / 2 + s(50);

    for (const action of group.actions) {
      for (let i = 0; i < action.count; i++) {
        const btn = this.createActionButton(
          0, y,
          panelW - s(40),
          action,
          i + 1,
          action.count
        );
        this.actionButtons.push(btn);
        y += s(32);
      }
    }

    // Resize panel to fit
    const totalH = s(60) + group.actions.reduce((sum, a) => sum + a.count * s(32), 0) + s(16);
    this.bg.setSize(panelW, Math.max(s(100), totalH));
    this.bg.setPosition(0, 0);

    // Reposition title and source
    this.titleText.setY(-totalH / 2 + s(12));
    this.sourceText.setY(-totalH / 2 + s(28));

    // Reposition buttons relative to new panel size
    let btnY = -totalH / 2 + s(50);
    for (const btn of this.actionButtons) {
      btn.setY(btnY);
      btnY += s(32);
    }

    this.setVisible(true);

    // Scale-in
    this.setScale(0);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1, scaleY: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  hide(): void {
    this.setVisible(false);
    for (const btn of this.actionButtons) btn.destroy();
    this.actionButtons = [];
  }

  private createActionButton(
    x: number,
    y: number,
    w: number,
    action: ResourceAction,
    index: number,
    total: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const h = s(26);
    const color = ACTION_COLORS[action.type];

    const bg = this.scene.add.rectangle(0, 0, w, h, color, 0.2);
    bg.setStrokeStyle(s(1), color, 0.6);
    bg.setInteractive({ useHandCursor: true });
    container.add(bg);

    const countLabel = total > 1 ? ` (${index}/${total})` : "";
    const label = this.scene.add.text(-w / 2 + s(8), 0, `${ACTION_LABELS[action.type]}${countLabel}`, {
      fontSize: fs(9),
      color: "#ffffff",
      fontFamily: "monospace",
    }).setOrigin(0, 0.5);
    container.add(label);

    // Skip button on right side
    const skipBg = this.scene.add.rectangle(w / 2 - s(24), 0, s(40), h - s(4), 0x666666, 0.3);
    skipBg.setStrokeStyle(s(1), 0x888888, 0.5);
    skipBg.setInteractive({ useHandCursor: true });
    container.add(skipBg);

    const skipLabel = this.scene.add.text(w / 2 - s(24), 0, "Skip", {
      fontSize: fs(8),
      color: "#aaaaaa",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    container.add(skipLabel);

    // Hover effects
    bg.on("pointerover", () => bg.setFillStyle(color, 0.4));
    bg.on("pointerout", () => bg.setFillStyle(color, 0.2));
    bg.on("pointerdown", () => {
      this.onActionSelected?.(action);
    });

    skipBg.on("pointerover", () => skipBg.setFillStyle(0x888888, 0.5));
    skipBg.on("pointerout", () => skipBg.setFillStyle(0x666666, 0.3));
    skipBg.on("pointerdown", () => {
      this.onActionSkipped?.(action);
    });

    this.add(container);
    return container;
  }
}
