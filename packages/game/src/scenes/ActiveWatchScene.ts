import Phaser from "phaser";
import type { GameState, Card } from "@icebox/shared";
import { MARKET_SLOTS, NUM, HEX } from "@icebox/shared";
import { createNewGameState } from "../systems/GameStateManager";
import { drawCards } from "../systems/DeckManager";
import { startTurn, executeAction, type PlayerAction } from "../systems/TurnManager";
import { updateShipPresence, calculateGlobalPresence } from "../systems/FactionTracker";
import { saveGame } from "../systems/SaveManager";
import { ResourceBar } from "../game-objects/ResourceBar";
import { MarketSlot } from "../game-objects/MarketSlot";
import { SectorDisplay } from "../game-objects/SectorDisplay";
import { HandDisplay } from "../ui/HandDisplay";
import { InfoPanel } from "../ui/InfoPanel";
import { PhaseIndicator } from "../ui/PhaseIndicator";
import { CardSprite } from "../game-objects/CardSprite";
import { BootScene } from "./BootScene";
import { SuccessionScene } from "./SuccessionScene";
import { MAIN_CX, LAYOUT, s, fontSize } from "../ui/layout";

export class ActiveWatchScene extends Phaser.Scene {
  static readonly KEY = "ActiveWatchScene";

  private gameState!: GameState;
  private cardDefs!: Card[];

  private resourceBar!: ResourceBar;
  private marketSlots: MarketSlot[] = [];
  private sectorDisplays: SectorDisplay[] = [];
  private handDisplay!: HandDisplay;
  private infoPanel!: InfoPanel;
  private phaseIndicator!: PhaseIndicator;
  private messageText!: Phaser.GameObjects.Text;
  private deckCountText!: Phaser.GameObjects.Text;

  constructor() {
    super(ActiveWatchScene.KEY);
  }

  init(data: { newGame: boolean; savedState?: GameState }): void {
    this.cardDefs = BootScene.cardDefinitions;
    if (data.newGame || !data.savedState) {
      this.gameState = createNewGameState(this.cardDefs);
      const result = drawCards(this.gameState.mandateDeck, 5);
      this.gameState.mandateDeck = result.deck;
    } else {
      this.gameState = data.savedState;
    }
    this.gameState.ship = updateShipPresence(this.gameState.ship);
    this.gameState.globalFactionPresence = calculateGlobalPresence(this.gameState.ship);
  }

  create(): void {
    // ─── Left gutter: Phase + Buttons ───
    this.phaseIndicator = new PhaseIndicator(this, LAYOUT.phaseX, LAYOUT.phaseY);
    this.createButtonColumn();

    // ─── Right gutter: Deck count + Info panel ───
    this.deckCountText = this.add.text(LAYOUT.deckCountX, LAYOUT.deckCountY, "", {
      fontSize: fontSize(10), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(1, 0);
    this.infoPanel = new InfoPanel(this, LAYOUT.infoPanelX, LAYOUT.infoPanelY);

    // ─── Main area ───
    this.createMarket();
    this.createSectors();

    this.resourceBar = new ResourceBar(this, MAIN_CX, LAYOUT.resourceY);

    this.handDisplay = new HandDisplay(this, MAIN_CX, LAYOUT.handY, LAYOUT.handTuckOffset);
    this.handDisplay.onCardSelected = (id) => this.showCardInInfoPanel(id);
    this.handDisplay.onCardHovered = (id) => {
      if (id) this.showCardInInfoPanel(id);
      else this.infoPanel.hide();
    };

    this.messageText = this.add.text(MAIN_CX, LAYOUT.messageY, "", {
      fontSize: fontSize(10), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);

    // Start
    this.gameState = startTurn(this.gameState);
    this.refreshAll();
    this.showMessage("Welcome aboard. The ship awaits your command.");
  }

  // ─── Market ───────────────────────────────────────────────────────

  private createMarket(): void {
    const cx = MAIN_CX;
    const cs = LAYOUT.marketColSpacing;
    const numCols = 6;

    // Label above everything
    this.add.text(cx, LAYOUT.marketLabelY, "TRANSIT MARKET", {
      fontSize: fontSize(10), color: HEX.darkCyan, fontFamily: "monospace", fontStyle: "bold",
    }).setOrigin(0.5);

    // Column numbers — positioned ABOVE the box
    for (let col = 0; col < numCols; col++) {
      const colX = cx + (col - 2.5) * cs;
      this.add.text(colX, LAYOUT.marketLabelY + s(14), `${col + 1}`, {
        fontSize: fontSize(13), color: HEX.eggshell, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(10);
    }

    // Box background — starts below the column numbers
    const boxPadX = s(40);
    const boxLeft = cx - 2.5 * cs - boxPadX;
    const boxTop = LAYOUT.marketLabelY + s(28);
    const boxW = 5 * cs + boxPadX * 2;
    const boxH = LAYOUT.marketRow2Y - LAYOUT.marketRow1Y + s(120);

    const gfx = this.add.graphics();
    gfx.fillStyle(NUM.midnightViolet, 0.3);
    gfx.fillRoundedRect(boxLeft, boxTop, boxW, boxH, s(6));
    gfx.lineStyle(s(1.5), NUM.charcoalBlue, 0.5);
    gfx.strokeRoundedRect(boxLeft, boxTop, boxW, boxH, s(6));

    // Column dividers — vertical lines between each column
    gfx.lineStyle(s(1), NUM.charcoalBlue, 0.3);
    for (let i = 0; i < numCols - 1; i++) {
      const divX = cx + (i - 2.5) * cs + cs / 2;
      gfx.lineBetween(divX, boxTop + s(4), divX, boxTop + boxH - s(4));
    }

    // Flow indicators
    const rightEdge = cx + 2.5 * cs + boxPadX - s(10);
    this.add.text(rightEdge, LAYOUT.marketRow1Y, "← NEW", {
      fontSize: fontSize(7), color: HEX.darkCyan, fontFamily: "monospace",
    }).setOrigin(1, 0.5);
    this.add.text(rightEdge, LAYOUT.marketRow2Y, "FALL →", {
      fontSize: fontSize(7), color: HEX.dustyMauve, fontFamily: "monospace",
    }).setOrigin(1, 0.5);
    this.add.text(rightEdge - s(14), (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2, "↓", {
      fontSize: fontSize(11), color: HEX.darkCyan, fontFamily: "monospace",
    }).setOrigin(0.5);

    // Slots: 6 cols × 2 rows = 12 total
    // Top row (newest): slots 11..6, left to right = 11, 10, 9, 8, 7, 6
    // Bottom row (oldest): slots 5..0, left to right = 5, 4, 3, 2, 1, 0
    this.marketSlots = [];
    for (let col = 0; col < numCols; col++) {
      const colX = cx + (col - 2.5) * cs;
      const topSlotIdx = 11 - col;
      const botSlotIdx = 5 - col;

      // Top row (newest)
      const top = new MarketSlot(this, colX, LAYOUT.marketRow1Y, topSlotIdx, true);
      this.marketSlots[topSlotIdx] = top;
      this.setupMarketSlotEvents(top, topSlotIdx);

      // Bottom row (oldest)
      const bot = new MarketSlot(this, colX, LAYOUT.marketRow2Y, botSlotIdx, true);
      this.marketSlots[botSlotIdx] = bot;
      this.setupMarketSlotEvents(bot, botSlotIdx);
    }
  }

  private setupMarketSlotEvents(slot: MarketSlot, slotIndex: number): void {
    slot.on("pointerdown", () => {
      if (slot.cardSprite) this.doAction({ type: "buy-from-market", slotIndex });
    });
  }

  private wireMarketHover(slot: MarketSlot): void {
    if (slot.cardSprite) {
      slot.cardSprite.on("pointerover", () => {
        if (slot.cardSprite) this.infoPanel.showCard(slot.cardSprite.cardInstance);
      });
      slot.cardSprite.on("pointerout", () => this.infoPanel.hide());
    }
  }

  // ─── Sectors ──────────────────────────────────────────────────────

  private createSectors(): void {
    for (let i = 0; i < 3; i++) {
      const sectorX = MAIN_CX + (i - 1) * LAYOUT.sectorSpacing;
      const sector = new SectorDisplay(this, sectorX, LAYOUT.sectorY, i);
      this.sectorDisplays.push(sector);

      // Structure card hover → InfoPanel
      sector.onCardClicked = (card) => this.infoPanel.showCard(card);

      sector.on("pointerdown", () => {
        const id = this.handDisplay.getSelectedInstanceId();
        if (id) this.doAction({ type: "slot-structure", instanceId: id, sectorIndex: i });
      });
    }
  }

  // ─── Buttons ──────────────────────────────────────────────────────

  private createButtonColumn(): void {
    const x = LAYOUT.btnX;
    let y = LAYOUT.btnStartY;
    const gap = LAYOUT.btnSpacing;

    this.createSmallBtn(x, y, "▶ PLAY", () => {
      const id = this.handDisplay.getSelectedInstanceId();
      if (id) this.doAction({ type: "play-card", instanceId: id });
    });
    this.createSmallBtn(x, y += gap, "+ DRAW", () => {
      this.doAction({ type: "draw-extra", resourceType: "energy" });
    });
    this.createSmallBtn(x, y += gap, "— END TURN", () => {
      this.doAction({ type: "pass" });
      this.gameState = startTurn(this.gameState);
      this.refreshAll();
    });
    this.createSmallBtn(x, y += gap, "❄ SLEEP", () => {
      this.doAction({ type: "enter-cryosleep" });
      if (this.gameState.phase === "succession") {
        saveGame(this.gameState);
        this.scene.start(SuccessionScene.KEY, {
          gameState: this.gameState, cardDefs: this.cardDefs,
        });
      }
    });
  }

  private createSmallBtn(x: number, y: number, label: string, onClick: () => void): void {
    const w = s(100), h = s(26);
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, NUM.midnightViolet, 0.9);
    bg.setStrokeStyle(s(1), NUM.charcoalBlue, 0.8);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, {
      fontSize: fontSize(9), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);
    bg.on("pointerover", () => { bg.setFillStyle(NUM.charcoalBlue2, 1); text.setColor(HEX.eggshell); });
    bg.on("pointerout",  () => { bg.setFillStyle(NUM.midnightViolet, 0.9); text.setColor(HEX.pearlAqua); });
    bg.on("pointerdown", onClick);
    container.add([bg, text]);
  }

  // ─── Actions / Refresh ────────────────────────────────────────────

  private showCardInInfoPanel(instanceId: string): void {
    let card = this.gameState.mandateDeck.hand.find(c => c.instanceId === instanceId);
    if (!card) {
      for (const slot of this.gameState.transitMarket.slots) {
        if (slot && slot.instanceId === instanceId) { card = slot; break; }
      }
    }
    if (!card) {
      for (const sector of this.gameState.ship.sectors) {
        const found = sector.installedCards.find(c => c.instanceId === instanceId);
        if (found) { card = found; break; }
      }
    }
    if (card) this.infoPanel.showCard(card);
  }

  private doAction(action: PlayerAction): void {
    const result = executeAction(this.gameState, action);
    if (result.success) {
      this.gameState = result.state;
      let msg = result.message;
      if (result.effectsTriggered?.length) msg += " | " + result.effectsTriggered.join(", ");
      this.showMessage(msg);
    } else {
      this.showMessage(`! ${result.message}`);
    }
    this.handDisplay.clearSelection();
    this.infoPanel.hide();
    this.refreshAll();
  }

  private refreshAll(): void {
    this.gameState.ship = updateShipPresence(this.gameState.ship);
    this.gameState.globalFactionPresence = calculateGlobalPresence(this.gameState.ship);

    this.resourceBar.update(this.gameState.resources, this.gameState.entropyThresholds);
    this.phaseIndicator.update(this.gameState.phase, this.gameState.turnNumber, this.gameState.totalSleepCycles);

    for (let i = 0; i < MARKET_SLOTS; i++) {
      if (this.marketSlots[i]) {
        this.marketSlots[i].setCard(this.gameState.transitMarket.slots[i] ?? null);
        this.wireMarketHover(this.marketSlots[i]);
      }
    }

    for (let i = 0; i < 3; i++) {
      this.sectorDisplays[i].updateDisplay(this.gameState.ship.sectors[i]);
    }

    this.handDisplay.updateHand(this.gameState.mandateDeck.hand);

    const draw = this.gameState.mandateDeck.drawPile.length;
    const disc = this.gameState.mandateDeck.discardPile.length;
    this.deckCountText.setText(`Deck: ${draw} | Discard: ${disc}`);
  }

  private showMessage(msg: string): void {
    this.messageText.setText(msg);
    this.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(1);
    this.tweens.add({ targets: this.messageText, alpha: 0, duration: 800, delay: 3000 });
  }
}
