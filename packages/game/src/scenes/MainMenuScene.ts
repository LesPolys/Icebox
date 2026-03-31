import Phaser from "phaser";
import { HEX, NUM } from "@icebox/shared";
import { ActiveWatchScene } from "./ActiveWatchScene";
import { s, fontSize as fs } from "../ui/layout";
import { renderBarokText, measureBarokText } from "../ui/BarokFont";
import { encodeCode128B } from "../ui/barcode";
import { GlitchPostFX } from "../ui/GlitchShader";

export class MainMenuScene extends Phaser.Scene {
  static readonly KEY = "MainMenuScene";

  constructor() {
    super(MainMenuScene.KEY);
  }

  create(): void {
    const { width, height } = this.scale;

    // ── Card dimensions ──
    const cardW = s(320);
    const cardH = s(520);
    const cardX = width / 2 - cardW / 2;
    const cardY = height / 2 - cardH / 2;
    const shellR = s(18);
    const innerR = s(12);
    const inset = s(10);
    const lw = s(2);

    // Container holds all card visuals — glitch applies here only
    const card = this.add.container(0, 0);

    const gfx = this.add.graphics();
    card.add(gfx);

    // ── Outer shell (warmGray) ──
    gfx.fillStyle(NUM.warmGray, 1);
    gfx.fillRoundedRect(cardX, cardY, cardW, cardH, shellR);

    // ── Top-center notch ──
    const notchW = s(80);
    const notchH = s(14);
    const nx = cardX + cardW / 2 - notchW / 2;
    gfx.fillStyle(NUM.bone, 0.9);
    gfx.fillRoundedRect(nx, cardY, notchW, notchH, { tl: 0, tr: 0, bl: s(6), br: s(6) });
    gfx.lineStyle(s(1), NUM.graphite, 0.4);
    gfx.strokeRoundedRect(nx, cardY, notchW, notchH, { tl: 0, tr: 0, bl: s(6), br: s(6) });

    // ── Dot grid (centered, top of shell above inner panel) ──
    gfx.fillStyle(NUM.concrete, 0.4);
    const dotR = s(1.5);
    const dotGap = s(5);
    const dotCols = 4;
    const dotGridW = (dotCols - 1) * dotGap;
    const dotBaseX = cardX + cardW / 2 - dotGridW / 2;
    const dotBaseY = cardY + s(6);
    for (let col = 0; col < dotCols; col++) {
      gfx.fillCircle(dotBaseX + col * dotGap, dotBaseY, dotR);
    }

    // ── Inner panel (teal) ──
    const panelTop = cardY + s(24);
    const panelBottom = cardY + cardH - s(150);
    const panelH = panelBottom - panelTop;
    gfx.fillStyle(NUM.teal, 0.85);
    gfx.fillRoundedRect(cardX + inset, panelTop, cardW - inset * 2, panelH, innerR);

    // ── Sparkle star (centered at top of teal panel, dark, wide) ──
    const sparkleX = cardX + cardW / 2;
    const sparkleY = panelTop + s(28);
    const sparkleV = s(20);   // vertical arm length
    const sparkleH = s(40);   // horizontal arm length (2× vertical)
    gfx.fillStyle(NUM.void, 1);
    gfx.fillPoints([
      { x: sparkleX, y: sparkleY - sparkleV },
      { x: sparkleX + sparkleV * 0.25, y: sparkleY },
      { x: sparkleX, y: sparkleY + sparkleV },
      { x: sparkleX - sparkleV * 0.25, y: sparkleY },
    ], true);
    gfx.fillPoints([
      { x: sparkleX - sparkleH, y: sparkleY },
      { x: sparkleX, y: sparkleY - sparkleH * 0.12 },
      { x: sparkleX + sparkleH, y: sparkleY },
      { x: sparkleX, y: sparkleY + sparkleH * 0.12 },
    ], true);

    // ── Title: "ICEBOX" repeated 4 times, stacked ──
    const titleSize = s(42);
    const titleKernMin = 0.82;
    const titleKernMax = 1.0;
    const titleStartY = sparkleY + sparkleV + s(8);
    const titleSpacing = s(50);
    let titleContainers: Phaser.GameObjects.Container[] = [];

    const drawTitles = (randomize = false) => {
      for (const t of titleContainers) t.destroy();
      titleContainers = [];
      const k = randomize
        ? titleKernMin + Math.random() * (titleKernMax - titleKernMin)
        : titleKernMin;
      const tw = measureBarokText("ICEBOX", titleSize, k);
      const tx = width / 2 - tw / 2;
      for (let i = 0; i < 4; i++) {
        const t = renderBarokText(this, "ICEBOX", NUM.bone, titleSize, tx, titleStartY + i * titleSpacing, 1, k);
        card.add(t);
        titleContainers.push(t);
      }
    };
    drawTitles();

    // ── Dot matrix pattern (vertically centered between last title and panel bottom) ──
    const matrixCx = cardX + cardW / 2;
    const lastTitleBottom = titleStartY + 3 * titleSpacing + titleSize * 1.1;
    const matrixTotalH = 3 * s(9); // (matRows-1) * matDotGap
    const matrixY = lastTitleBottom + (panelBottom - lastTitleBottom - matrixTotalH) / 2;
    const matDotR = s(3.5);
    const matDotGap = s(9);
    const matCols = 10;
    const matRows = 4;
    const matStartX = matrixCx - ((matCols - 1) * matDotGap) / 2;
    const dotMatrixGfx = this.add.graphics();
    card.add(dotMatrixGfx);

    const drawDotMatrix = () => {
      dotMatrixGfx.clear();
      const seed = Math.random() * 1000;
      dotMatrixGfx.fillStyle(NUM.void, 1);
      for (let row = 0; row < matRows; row++) {
        for (let col = 0; col < matCols; col++) {
          const hash = Math.sin((row * matCols + col) * 127.1 + seed) * 43758.5453;
          if (hash - Math.floor(hash) > 0.35) {
            dotMatrixGfx.fillCircle(matStartX + col * matDotGap, matrixY + row * matDotGap, matDotR);
          }
        }
      }
    };
    drawDotMatrix();

    // ── Button area (below inner panel, in shell zone) ──
    const btnAreaY = panelBottom + s(16);
    const btnW = s(200);
    const btnH = s(34);
    const btnX = cardX + cardW / 2 - btnW / 2;

    // Decorative frame around button
    const frameW = btnW + s(40);
    const frameX = cardX + cardW / 2 - frameW / 2;
    gfx.lineStyle(s(1.5), NUM.graphite, 0.6);
    gfx.lineBetween(frameX, btnAreaY + btnH / 2, btnX - s(6), btnAreaY + btnH / 2);
    gfx.lineBetween(btnX + btnW + s(6), btnAreaY + btnH / 2, frameX + frameW, btnAreaY + btnH / 2);

    // Button border (no fill)
    gfx.lineStyle(s(1.5), NUM.graphite, 0.7);
    gfx.strokeRoundedRect(btnX, btnAreaY, btnW, btnH, s(4));

    // "NEW GAME" label (standard font)
    const ngText = this.add.text(cardX + cardW / 2, btnAreaY + btnH / 2, "NEW GAME", {
      fontSize: fs(14),
      color: HEX.void,
      fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);
    card.add(ngText);

    // Hover border highlight graphics (drawn on top)
    const btnHoverGfx = this.add.graphics();
    btnHoverGfx.setVisible(false);
    card.add(btnHoverGfx);

    // Invisible hit area for New Game
    const newGameHit = this.add.rectangle(cardX + cardW / 2, btnAreaY + btnH / 2, btnW, btnH, 0x000000, 0);
    newGameHit.setInteractive({ useHandCursor: true });
    newGameHit.on("pointerover", () => {
      btnHoverGfx.clear();
      btnHoverGfx.lineStyle(s(2), NUM.chartreuse, 1);
      btnHoverGfx.strokeRoundedRect(btnX, btnAreaY, btnW, btnH, s(4));
      btnHoverGfx.setVisible(true);
    });
    newGameHit.on("pointerout", () => {
      btnHoverGfx.setVisible(false);
    });
    newGameHit.on("pointerdown", () => {
      this.scene.start(ActiveWatchScene.KEY, { newGame: true });
    });
    card.add(newGameHit);

    // Continue button (hidden — not yet ready for testing)

    // ── Holographic strip + barcode sandwich (between button and card bottom) ──
    const stripLeft = cardX + inset + s(8);
    const stripW = cardW - inset * 2 - s(16);
    // Calculate total height of barcode block: strip + gap + barcode + gap + 2 strips
    const barcodeWidths = encodeCode128B("ICEBOX");
    let totalBarcodeW = 0;
    const moduleW = s(1.8);
    for (const bw of barcodeWidths) totalBarcodeW += bw * moduleW;
    const barcodeH = s(30);
    const blockH = s(1.5) + s(6) + barcodeH + s(4) + s(1.5) + s(4) + s(1.5);
    // Center the block between button bottom and card bottom
    const blockTop = btnAreaY + btnH + (cardY + cardH - (btnAreaY + btnH) - blockH) / 2;

    gfx.fillStyle(0x8833BB, 0.3);
    gfx.fillRect(stripLeft, blockTop, stripW, s(1.5));

    const barcodeX = cardX + cardW / 2 - totalBarcodeW / 2;
    const barcodeY = blockTop + s(1.5) + s(6);
    let bx = barcodeX;
    for (let i = 0; i < barcodeWidths.length; i++) {
      const w = barcodeWidths[i] * moduleW;
      if (i % 2 === 0) {
        gfx.fillStyle(NUM.chartreuse, 0.7);
        gfx.fillRect(bx, barcodeY, w, barcodeH);
      }
      bx += w;
    }

    const strip2Y = barcodeY + barcodeH + s(4);
    gfx.fillStyle(NUM.teal, 0.3);
    gfx.fillRect(stripLeft, strip2Y, stripW, s(1.5));
    gfx.fillStyle(NUM.chartreuse, 0.3);
    gfx.fillRect(stripLeft, strip2Y + s(4), stripW, s(1.5));

    // ── Outer border ──
    gfx.lineStyle(lw, NUM.graphite, 0.8);
    gfx.strokeRoundedRect(cardX, cardY, cardW, cardH, shellR);

    // ── Version text (outside card, bottom-right) ──
    this.add
      .text(width - s(10), height - s(10), "v0.1.0 — Prototype", {
        fontSize: fs(12),
        color: HEX.concrete,
        fontFamily: "'Space Mono', monospace",
      })
      .setOrigin(1, 1);

    // ── Glitch effect on the card container only ──
    this.setupGlitch(card, () => {
      drawDotMatrix();
      drawTitles(true);
    });
  }

  private setupGlitch(card: Phaser.GameObjects.Container, onGlitch: () => void): void {
    card.setPostPipeline(GlitchPostFX.KEY);
    const glitch = card.getPostPipeline(GlitchPostFX.KEY) as GlitchPostFX | null;
    if (!glitch) return;

    glitch.setIntensity(0);

    const triggerGlitch = () => {
      const delay = 3000 + Math.random() * 4000;
      this.time.delayedCall(delay, () => {
        glitch.setSeed(Math.random() * 1000);
        onGlitch();

        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 80,
          ease: "Cubic.easeIn",
          onUpdate: (tween) => {
            glitch.setIntensity((tween.getValue() ?? 0) as number * 0.6);
          },
          onComplete: () => {
            this.time.delayedCall(60 + Math.random() * 120, () => {
              this.tweens.addCounter({
                from: 1,
                to: 0,
                duration: 150,
                ease: "Cubic.easeOut",
                onUpdate: (tween) => {
                  glitch.setIntensity((tween.getValue() ?? 0) as number * 0.6);
                },
                onComplete: () => {
                  glitch.setIntensity(0);
                  triggerGlitch();
                },
              });
            });
          },
        });
      });
    };

    triggerGlitch();
  }
}
