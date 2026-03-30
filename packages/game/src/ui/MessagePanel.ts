import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs, GAME_W, GAME_H } from "./layout";

interface MessageEntry {
  text: string;
  color: string;
  timestamp: number;
}

/**
 * Collapsible message panel on the right side of the screen.
 * Collapses rightward. Toggle tab stays visible with a notification dot
 * when new messages arrive while collapsed.
 */
export class MessagePanel extends Phaser.GameObjects.Container {
  private entries: MessageEntry[] = [];
  private collapsed = true;
  private unreadCount = 0;

  private panelContainer: Phaser.GameObjects.Container;
  private bgGfx: Phaser.GameObjects.Graphics;
  private msgTexts: Phaser.GameObjects.Text[] = [];
  private toggleBtn: Phaser.GameObjects.Container;
  private scrollBottomBtn: Phaser.GameObjects.Container;
  private notifDot: Phaser.GameObjects.Graphics;
  private notifText: Phaser.GameObjects.Text;
  private contentMask!: Phaser.Display.Masks.GeometryMask;
  private maskGfx: Phaser.GameObjects.Graphics;

  private readonly panelW = s(180);
  private readonly panelH: number;
  private readonly panelTop = s(60);
  private readonly lineGap = s(20);
  private readonly padding = s(8);
  private panelRight: number;

  private scrollOffset = 0;
  private contentContainer: Phaser.GameObjects.Container;
  /** Total content height for scroll calculations. */
  private totalContentHeight = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.panelH = GAME_H - this.panelTop - s(20);
    this.panelRight = GAME_W - s(4);
    const panelLeft = this.panelRight - this.panelW;

    // Panel container (slides right when collapsed)
    this.panelContainer = scene.add.container(0, 0);
    this.add(this.panelContainer);

    // Input blocker — prevents clicks from passing through to elements below
    const blocker = scene.add.rectangle(
      panelLeft + this.panelW / 2, this.panelTop + this.panelH / 2,
      this.panelW, this.panelH, 0x000000, 0
    );
    blocker.setInteractive();
    this.panelContainer.add(blocker);

    // Background
    this.bgGfx = scene.add.graphics();
    this.drawBg();
    this.panelContainer.add(this.bgGfx);

    // Title
    const title = scene.add.text(
      panelLeft + this.padding, this.panelTop + s(3),
      "MESSAGES", {
        fontSize: fs(7), color: HEX.chartreuse,
        fontFamily: "'Orbitron', monospace", fontStyle: "bold",
      }
    ).setOrigin(0, 0);
    this.panelContainer.add(title);

    // Scrollable content container
    this.contentContainer = scene.add.container(
      panelLeft + this.padding,
      this.panelTop + s(16)
    );
    this.panelContainer.add(this.contentContainer);

    // Mask for clipping content
    this.maskGfx = scene.make.graphics({ x: 0, y: 0 });
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillRect(
      panelLeft,
      this.panelTop + s(14),
      this.panelW,
      this.panelH - s(18)
    );
    this.contentMask = this.maskGfx.createGeometryMask();
    this.contentContainer.setMask(this.contentMask);

    // Toggle tab (sits at the left edge of the panel)
    this.toggleBtn = this.createToggleTab(scene, panelLeft);
    this.add(this.toggleBtn);

    // Notification dot (on the toggle tab, hidden by default)
    this.notifDot = scene.add.graphics();
    this.notifDot.setVisible(false);
    this.toggleBtn.add(this.notifDot);

    this.notifText = scene.add.text(-s(8), -s(12), "", {
      fontSize: fs(6), color: "#ffffff", fontFamily: "'Space Mono', monospace", fontStyle: "bold",
    }).setOrigin(0.5).setVisible(false);
    this.toggleBtn.add(this.notifText);

    // Scroll-to-bottom button
    this.scrollBottomBtn = this.createScrollBottomBtn(scene, panelLeft);
    this.panelContainer.add(this.scrollBottomBtn);

    // Start collapsed
    this.panelContainer.x = this.panelW + s(4);
    this.toggleBtn.x = this.panelRight - s(16);
    this.maskGfx.x = this.panelW + s(4);

    // Scroll with mouse wheel over the panel
    scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
      if (this.collapsed) return;
      const panelLeft2 = this.panelRight - this.panelW;
      if (_pointer.x < panelLeft2 - s(10)) return;
      if (_pointer.y < this.panelTop || _pointer.y > this.panelTop + this.panelH) return;
      const scrollStep = s(36);
      this.scrollOffset = Phaser.Math.Clamp(
        this.scrollOffset + (dy > 0 ? scrollStep : -scrollStep),
        0,
        Math.max(0, this.totalContentHeight - this.panelH + s(30))
      );
      this.renderEntries();
    });

    this.setDepth(100);
    scene.add.existing(this);
  }

  private drawBg(): void {
    const panelLeft = this.panelRight - this.panelW;
    this.bgGfx.clear();
    this.bgGfx.fillStyle(NUM.slab, 0.8);
    this.bgGfx.fillRoundedRect(panelLeft, this.panelTop, this.panelW, this.panelH, s(4));
    this.bgGfx.lineStyle(s(1), NUM.graphite, 0.5);
    this.bgGfx.strokeRoundedRect(panelLeft, this.panelTop, this.panelW, this.panelH, s(4));
  }

  private createToggleTab(scene: Phaser.Scene, panelLeft: number): Phaser.GameObjects.Container {
    const tabW = s(16);
    const tabH = s(40);
    const tabX = panelLeft - tabW;
    const tabY = this.panelTop + s(20);

    const gfx = scene.add.graphics();
    gfx.fillStyle(NUM.slab, 0.85);
    gfx.fillRoundedRect(0, -tabH / 2, tabW, tabH, { tl: s(4), tr: 0, bl: s(4), br: 0 });
    gfx.lineStyle(s(1), NUM.graphite, 0.5);
    gfx.strokeRoundedRect(0, -tabH / 2, tabW, tabH, { tl: s(4), tr: 0, bl: s(4), br: 0 });

    const arrow = scene.add.text(tabW / 2, 0, "◀", {
      fontSize: fs(8), color: HEX.teal, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);

    const hitArea = scene.add.rectangle(tabW / 2, 0, tabW, tabH, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", () => this.toggle());

    return scene.add.container(tabX, tabY, [gfx, arrow, hitArea]);
  }

  private createScrollBottomBtn(scene: Phaser.Scene, panelLeft: number): Phaser.GameObjects.Container {
    const btnW = s(24);
    const btnH = s(16);
    const bx = panelLeft + this.panelW - this.padding - btnW / 2;
    const by = this.panelTop + this.panelH - this.padding - btnH / 2;

    const gfx = scene.add.graphics();
    gfx.fillStyle(NUM.graphite, 0.7);
    gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, s(3));
    const label = scene.add.text(0, 0, "▼", {
      fontSize: fs(7), color: HEX.teal, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);
    const hit = scene.add.rectangle(0, 0, btnW, btnH, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.scrollToBottom());

    return scene.add.container(bx, by, [gfx, label, hit]);
  }

  scrollToBottom(): void {
    const viewH = this.panelH - s(30);
    this.scrollOffset = Math.max(0, this.totalContentHeight - viewH);
    this.renderEntries();
  }

  private updateNotifDot(): void {
    if (this.unreadCount > 0 && this.collapsed) {
      this.notifDot.clear();
      this.notifDot.fillStyle(NUM.signalRed, 1);
      this.notifDot.fillCircle(-s(8), -s(12), s(7));
      this.notifDot.setVisible(true);
      this.notifText.setText(`${this.unreadCount}`);
      this.notifText.setVisible(true);
    } else {
      this.notifDot.setVisible(false);
      this.notifText.setVisible(false);
    }
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    const arrow = this.toggleBtn.list[1] as Phaser.GameObjects.Text;
    const panelLeft = this.panelRight - this.panelW;

    if (this.collapsed) {
      arrow.setText("◀");
      this.scene.tweens.add({
        targets: this.panelContainer,
        x: this.panelW + s(4),
        duration: 200,
        ease: "Power2",
      });
      this.scene.tweens.add({
        targets: this.toggleBtn,
        x: this.panelRight - s(16),
        duration: 200,
        ease: "Power2",
      });
      this.scene.tweens.add({
        targets: this.maskGfx,
        x: this.panelW + s(4),
        duration: 200,
        ease: "Power2",
      });
    } else {
      arrow.setText("▶");
      this.unreadCount = 0;
      this.updateNotifDot();
      this.scene.tweens.add({
        targets: this.panelContainer,
        x: 0,
        duration: 200,
        ease: "Power2",
      });
      this.scene.tweens.add({
        targets: this.toggleBtn,
        x: panelLeft - s(16),
        duration: 200,
        ease: "Power2",
      });
      this.scene.tweens.add({
        targets: this.maskGfx,
        x: 0,
        duration: 200,
        ease: "Power2",
      });
    }
  }

  addMessage(text: string, color?: string): void {
    this.entries.push({
      text,
      color: color ?? HEX.bone,
      timestamp: Date.now(),
    });

    if (this.collapsed) {
      this.unreadCount++;
      this.updateNotifDot();
    }

    this.renderEntries();

    // Auto-scroll to bottom after render (uses computed totalContentHeight)
    const viewH = this.panelH - s(30);
    if (this.totalContentHeight > viewH) {
      this.scrollOffset = this.totalContentHeight - viewH;
      this.renderEntries();
    }
  }

  private renderEntries(): void {
    for (const t of this.msgTexts) t.destroy();
    this.msgTexts = [];

    // First pass: compute cumulative Y positions for all entries
    const wrapWidth = this.panelW - this.padding * 2;
    let cumulativeY = 0;
    const yPositions: number[] = [];
    for (let i = 0; i < this.entries.length; i++) {
      yPositions.push(cumulativeY);
      // Estimate height: create temp text to measure
      const tmp = this.scene.add.text(0, 0, this.entries[i].text, {
        fontSize: fs(12), fontFamily: "'Space Grotesk', sans-serif",
        wordWrap: { width: wrapWidth },
      });
      cumulativeY += tmp.height + this.lineGap;
      tmp.destroy();
    }
    this.totalContentHeight = cumulativeY;

    // Second pass: render visible entries
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const y = yPositions[i] - this.scrollOffset;

      if (y < -s(60) || y > this.panelH) continue;

      const text = this.scene.add.text(0, y, entry.text, {
        fontSize: fs(12),
        color: entry.color,
        fontFamily: "'Space Grotesk', sans-serif",
        wordWrap: { width: wrapWidth },
      }).setOrigin(0, 0);

      this.contentContainer.add(text);
      this.msgTexts.push(text);
    }
  }
}
