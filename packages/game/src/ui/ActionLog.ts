import Phaser from "phaser";
import { NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs, GAME_H } from "./layout";

interface LogEntry {
  text: string;
  turn: number;
  color: string;
}

/**
 * Collapsible action log on the left side of the screen.
 * Collapses leftward (slides off-screen). Toggle tab stays visible.
 */
export class ActionLog extends Phaser.GameObjects.Container {
  private entries: LogEntry[] = [];
  private currentTurn = 0;
  private collapsed = true;

  private panelContainer: Phaser.GameObjects.Container;
  private bgGfx: Phaser.GameObjects.Graphics;
  private logTexts: Phaser.GameObjects.Text[] = [];
  private toggleBtn: Phaser.GameObjects.Container;
  private scrollBottomBtn: Phaser.GameObjects.Container;
  private contentMask!: Phaser.Display.Masks.GeometryMask;
  private maskGfx: Phaser.GameObjects.Graphics;

  private readonly panelW = s(150);
  private readonly panelH: number;
  private readonly panelX = s(4);
  private readonly panelTop = s(60);
  private readonly lineH = s(13);
  private readonly padding = s(6);

  private scrollOffset = 0;
  private contentContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.panelH = GAME_H - this.panelTop - s(20);

    // Panel container (slides left/right)
    this.panelContainer = scene.add.container(0, 0);
    this.add(this.panelContainer);

    // Input blocker — prevents clicks from passing through to elements below
    const blocker = scene.add.rectangle(
      this.panelX + this.panelW / 2, this.panelTop + this.panelH / 2,
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
      this.panelX + this.padding, this.panelTop + s(3),
      "LOG", {
        fontSize: fs(7), color: HEX.chartreuse,
        fontFamily: "'Orbitron', monospace", fontStyle: "bold",
      }
    ).setOrigin(0, 0);
    this.panelContainer.add(title);

    // Scrollable content container
    this.contentContainer = scene.add.container(
      this.panelX + this.padding,
      this.panelTop + s(16)
    );
    this.panelContainer.add(this.contentContainer);

    // Mask for clipping content
    this.maskGfx = scene.make.graphics({ x: 0, y: 0 });
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillRect(
      this.panelX,
      this.panelTop + s(14),
      this.panelW,
      this.panelH - s(18)
    );
    this.contentMask = this.maskGfx.createGeometryMask();
    this.contentContainer.setMask(this.contentMask);

    // Toggle tab (always visible, sits at the right edge of the panel)
    this.toggleBtn = this.createToggleTab(scene);
    this.add(this.toggleBtn);

    // Scroll-to-bottom button (at bottom of panel)
    this.scrollBottomBtn = this.createScrollBottomBtn(scene);
    this.panelContainer.add(this.scrollBottomBtn);

    // Start collapsed
    this.panelContainer.x = -(this.panelW + this.panelX);
    this.toggleBtn.x = 0;
    this.maskGfx.x = -(this.panelW + this.panelX);

    // Scroll with mouse wheel over the panel
    scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
      if (this.collapsed) return;
      if (_pointer.x > this.panelX + this.panelW + s(10)) return;
      if (_pointer.y < this.panelTop || _pointer.y > this.panelTop + this.panelH) return;
      this.scrollOffset = Phaser.Math.Clamp(
        this.scrollOffset + (dy > 0 ? this.lineH * 2 : -this.lineH * 2),
        0,
        Math.max(0, this.entries.length * this.lineH - this.panelH + s(30))
      );
      this.renderEntries();
    });

    this.setDepth(100);
    scene.add.existing(this);
  }

  private drawBg(): void {
    this.bgGfx.clear();
    this.bgGfx.fillStyle(NUM.slab, 0.8);
    this.bgGfx.fillRoundedRect(this.panelX, this.panelTop, this.panelW, this.panelH, s(4));
    this.bgGfx.lineStyle(s(1), NUM.graphite, 0.5);
    this.bgGfx.strokeRoundedRect(this.panelX, this.panelTop, this.panelW, this.panelH, s(4));
  }

  private createToggleTab(scene: Phaser.Scene): Phaser.GameObjects.Container {
    // Small tab on the right edge of the panel
    const tabW = s(16);
    const tabH = s(40);
    const tabX = this.panelX + this.panelW;
    const tabY = this.panelTop + s(20);

    const gfx = scene.add.graphics();
    gfx.fillStyle(NUM.slab, 0.85);
    gfx.fillRoundedRect(0, -tabH / 2, tabW, tabH, { tl: 0, tr: s(4), bl: 0, br: s(4) });
    gfx.lineStyle(s(1), NUM.graphite, 0.5);
    gfx.strokeRoundedRect(0, -tabH / 2, tabW, tabH, { tl: 0, tr: s(4), bl: 0, br: s(4) });

    const arrow = scene.add.text(tabW / 2, 0, "▶", {
      fontSize: fs(8), color: HEX.abyss, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);

    const hitArea = scene.add.rectangle(tabW / 2, 0, tabW, tabH, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", () => this.toggle());

    return scene.add.container(tabX, tabY, [gfx, arrow, hitArea]);
  }

  private createScrollBottomBtn(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const btnW = s(24);
    const btnH = s(16);
    const bx = this.panelX + this.panelW - this.padding - btnW / 2;
    const by = this.panelTop + this.panelH - this.padding - btnH / 2;

    const gfx = scene.add.graphics();
    gfx.fillStyle(NUM.graphite, 0.7);
    gfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, s(3));
    const label = scene.add.text(0, 0, "▼", {
      fontSize: fs(7), color: HEX.abyss, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);
    const hit = scene.add.rectangle(0, 0, btnW, btnH, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => this.scrollToBottom());

    return scene.add.container(bx, by, [gfx, label, hit]);
  }

  scrollToBottom(): void {
    const totalH = this.entries.length * this.lineH;
    const viewH = this.panelH - s(30);
    this.scrollOffset = Math.max(0, totalH - viewH);
    this.renderEntries();
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    const arrow = this.toggleBtn.list[1] as Phaser.GameObjects.Text;

    if (this.collapsed) {
      // Slide panel left off-screen
      arrow.setText("▶");
      this.scene.tweens.add({
        targets: this.panelContainer,
        x: -(this.panelW + this.panelX),
        duration: 200,
        ease: "Power2",
      });
      // Move toggle tab to left edge
      this.scene.tweens.add({
        targets: this.toggleBtn,
        x: 0,
        duration: 200,
        ease: "Power2",
      });
      // Slide mask too
      this.scene.tweens.add({
        targets: this.maskGfx,
        x: -(this.panelW + this.panelX),
        duration: 200,
        ease: "Power2",
      });
    } else {
      // Slide panel back
      arrow.setText("◀");
      this.scene.tweens.add({
        targets: this.panelContainer,
        x: 0,
        duration: 200,
        ease: "Power2",
      });
      this.scene.tweens.add({
        targets: this.toggleBtn,
        x: this.panelX + this.panelW,
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

  setTurn(turn: number): void {
    if (turn !== this.currentTurn) {
      this.currentTurn = turn;
      this.entries.push({
        text: `─ Turn ${turn} ─`,
        turn,
        color: HEX.chartreuse,
      });
      this.renderEntries();
    }
  }

  addEntry(text: string, color?: string): void {
    this.entries.push({
      text,
      turn: this.currentTurn,
      color: color ?? HEX.abyss,
    });

    // Auto-scroll to bottom
    const totalH = this.entries.length * this.lineH;
    const viewH = this.panelH - s(30);
    if (totalH > viewH) {
      this.scrollOffset = totalH - viewH;
    }

    this.renderEntries();
  }

  private renderEntries(): void {
    for (const t of this.logTexts) t.destroy();
    this.logTexts = [];

    const startY = -this.scrollOffset;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const y = startY + i * this.lineH;

      if (y < -this.lineH * 2 || y > this.panelH) continue;

      const isTurnMarker = entry.text.startsWith("─");
      const text = this.scene.add.text(0, y, entry.text, {
        fontSize: fs(6),
        color: entry.color,
        fontFamily: "'Space Mono', monospace",
        fontStyle: isTurnMarker ? "bold" : "normal",
        wordWrap: { width: this.panelW - this.padding * 2 },
      }).setOrigin(0, 0);

      this.contentContainer.add(text);
      this.logTexts.push(text);
    }
  }
}
