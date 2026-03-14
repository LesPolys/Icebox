import Phaser from "phaser";
import type { GameState, Card, MarketRowId, ResourceCost } from "@icebox/shared";
import { MARKET_SLOTS, MARKET_SLOTS_PER_ROW, NUM, HEX, getAllMarketSlots, getMarketRowById, canAfford } from "@icebox/shared";
import { createNewGameState } from "../systems/GameStateManager";
import { drawCards } from "../systems/DeckManager";
import { startTurn, executeAction, type PlayerAction } from "../systems/TurnManager";
import { getMarketCostModifier } from "../systems/MarketEffectResolver";
import { updateShipPresence, calculateGlobalPresence } from "../systems/FactionTracker";
import { saveGame } from "../systems/SaveManager";
import { ResourceBar, type ResourceKey } from "../game-objects/ResourceBar";
import { MarketSlot } from "../game-objects/MarketSlot";
import { SectorDisplay } from "../game-objects/SectorDisplay";
import { HandDisplay } from "../ui/HandDisplay";
import { InfoPanel } from "../ui/InfoPanel";
import { PhaseIndicator } from "../ui/PhaseIndicator";
import { PlayMat } from "../ui/PlayMat";
import { ActionLog } from "../ui/ActionLog";
import { MessagePanel } from "../ui/MessagePanel";
import { ConfirmPopup } from "../ui/ConfirmPopup";
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
  private playMat!: PlayMat;
  private actionLog!: ActionLog;
  private messagePanel!: MessagePanel;
  private deckCountText!: Phaser.GameObjects.Text;
  private worldDeckCountText!: Phaser.GameObjects.Text;
  private playerDeckCountText!: Phaser.GameObjects.Text;
  private playerDiscardCountText!: Phaser.GameObjects.Text;

  // ── Purchase mode state ──
  private purchaseMode: {
    row: MarketRowId;
    targetSlotIndex: number;
    investedCols: Set<number>; // columns invested during THIS purchase session
  } | null = null;

  // Market geometry for hit-testing resource drops
  private marketColPositions: number[] = [];
  private deckPileX = 0;
  private deckPileY = 0;

  // Player deck/discard positions (world coords, set in createPlayerPiles)
  private playerDeckPileX = 0;
  private playerDeckPileY = 0;
  private playerDiscardPileX = 0;
  private playerDiscardPileY = 0;

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
    // Disable browser right-click menu for right-click interactions
    this.input.mouse?.disableContextMenu();

    // ─── Play mat (rendered below everything) ───
    this.playMat = new PlayMat(this);
    this.playMat.onEndTurn = () => {
      this.doAction({ type: "pass" });
      const turnResult = startTurn(this.gameState);
      this.gameState = turnResult.state;
      this.actionLog.setTurn(this.gameState.turnNumber);
      if (turnResult.reshuffled) {
        this.showMessage("Discard reshuffled into deck.");
        this.actionLog.addEntry("Discard reshuffled into deck.", HEX.darkCyan);
      }
      this.refreshAll();
    };
    this.playMat.onSleep = () => {
      this.doAction({ type: "enter-cryosleep" });
      if (this.gameState.phase === "succession") {
        saveGame(this.gameState);
        this.scene.start(SuccessionScene.KEY, {
          gameState: this.gameState, cardDefs: this.cardDefs,
        });
      }
    };

    // ─── Left gutter: Phase indicator + Action log ───
    this.phaseIndicator = new PhaseIndicator(this, LAYOUT.phaseX, LAYOUT.phaseY);
    this.actionLog = new ActionLog(this);

    // ─── Right gutter: Deck count + Info panel ───
    this.deckCountText = this.add.text(LAYOUT.deckCountX, LAYOUT.deckCountY, "", {
      fontSize: fontSize(10), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(1, 0);
    this.infoPanel = new InfoPanel(this);

    // ─── Main area ───
    this.createMarket();
    this.createSectors();

    this.resourceBar = new ResourceBar(this, MAIN_CX, LAYOUT.resourceY);
    this.wireResourceBarDrag();
    this.createPlayerPiles();

    // ─── Hand ───
    this.handDisplay = new HandDisplay(this, MAIN_CX, LAYOUT.handY, LAYOUT.handTuckOffset);
    this.wireHandCallbacks();

    this.messagePanel = new MessagePanel(this);

    // ─── Cancel purchase mode on click on empty space ───
    this.input.on("pointerdown", (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (!this.purchaseMode) return;
      // If clicking on any interactive element (market card, resource shape, button), don't cancel
      if (currentlyOver.length > 0) return;
      this.exitPurchaseMode();
    });

    // Start
    const initialTurn = startTurn(this.gameState);
    this.gameState = initialTurn.state;
    this.actionLog.setTurn(this.gameState.turnNumber);
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

    // Column numbers — bordered badges above the box
    const badgeY = LAYOUT.marketLabelY + s(18);
    const badgeR = s(12);
    for (let col = 0; col < numCols; col++) {
      const colX = cx + (col - 2.5) * cs;
      this.marketColPositions.push(colX);
      const badge = this.add.graphics();
      badge.fillStyle(NUM.midnightViolet, 0.8);
      badge.fillCircle(colX, badgeY, badgeR);
      badge.lineStyle(s(1.5), NUM.charcoalBlue, 0.7);
      badge.strokeCircle(colX, badgeY, badgeR);
      badge.setDepth(9);
      this.add.text(colX, badgeY, `${col + 1}`, {
        fontSize: fontSize(11), color: HEX.eggshell, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(10);
    }

    // Box background — starts below the badge row
    const boxPadX = s(40);
    const boxLeft = cx - 2.5 * cs - boxPadX;
    const boxTop = badgeY + badgeR + s(4);
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

    // Slots: 6 cols × 2 rows = 12 total
    // Top row = Upper, Bottom row = Lower
    this.marketSlots = [];
    for (let col = 0; col < numCols; col++) {
      const colX = cx + (col - 2.5) * cs;
      const slotIdx = col;

      // Top row = Upper (flat indices 0..5, matching getAllMarketSlots order)
      const upperFlatIdx = slotIdx;
      const top = new MarketSlot(this, colX, LAYOUT.marketRow1Y, upperFlatIdx, true);
      this.marketSlots[upperFlatIdx] = top;

      // Bottom row = Lower (flat indices 6..11)
      const lowerFlatIdx = slotIdx + MARKET_SLOTS_PER_ROW;
      const bot = new MarketSlot(this, colX, LAYOUT.marketRow2Y, lowerFlatIdx, true);
      this.marketSlots[lowerFlatIdx] = bot;
    }

    // World deck pile — to the right of the market box
    const deckX = cx + 2.5 * cs + boxPadX + s(40);
    const deckY = (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2;
    this.deckPileX = deckX;
    this.deckPileY = deckY;

    // Stacked card-back images to suggest a pile
    for (let i = 2; i >= 0; i--) {
      const offset = i * s(2);
      const back = this.add.image(deckX + offset, deckY + offset, "card-back");
      back.setScale(0.5);
      back.setAlpha(0.6 + i * 0.15);
    }
    this.worldDeckCountText = this.add.text(deckX, deckY + s(55), "", {
      fontSize: fontSize(9), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);
  }

  private wireMarketSlotInteractions(slot: MarketSlot, slotIndex: number, row: MarketRowId): void {
    if (!slot.cardSprite) return;

    // Click to buy or enter purchase mode
    slot.cardSprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      if (this.purchaseMode) return;
      if (!slot.cardSprite) return;

      if (slotIndex === 0) {
        // Column 0 has no preceding slots — buy directly
        this.animateBuyToDiscard(row, slotIndex);
        this.doAction({ type: "buy-from-market", row, slotIndex });
      } else {
        // Columns 1+ always require a fresh investment session
        this.enterPurchaseMode(row, slotIndex);
      }
    });

    slot.cardSprite.on("pointerover", () => {
      if (!slot.cardSprite) return;

      // Show in InfoPanel
      this.infoPanel.showCard(slot.cardSprite.cardInstance);

      // Affordability check
      const costMod = getMarketCostModifier(this.gameState.transitMarket);
      const baseCost = slot.cardSprite.cardInstance.card.cost;
      const effectiveCost: ResourceCost = {
        matter: (baseCost.matter ?? 0) + (costMod.matter ?? 0),
        energy: (baseCost.energy ?? 0) + (costMod.energy ?? 0),
        data: (baseCost.data ?? 0) + (costMod.data ?? 0),
        influence: (baseCost.influence ?? 0) + (costMod.influence ?? 0),
      };
      slot.cardSprite.setAffordable(canAfford(this.gameState.resources, effectiveCost));

      // Ghost investment icons on preceding uninvested columns (one per column, prefer hovered row)
      if (slotIndex > 0 && !this.purchaseMode) {
        const market = this.gameState.transitMarket;
        const otherRow: MarketRowId = row === "upper" ? "lower" : "upper";
        for (let i = 0; i < slotIndex; i++) {
          const sameRowHasCard = !!getMarketRowById(market, row).slots[i];
          const otherRowHasCard = !!getMarketRowById(market, otherRow).slots[i];
          if (sameRowHasCard) {
            this.marketSlots[this.flatIdx(row, i)]?.showInvestmentGhost(true);
          } else if (otherRowHasCard) {
            this.marketSlots[this.flatIdx(otherRow, i)]?.showInvestmentGhost(true);
          }
        }
      }
    });

    slot.cardSprite.on("pointerout", () => {
      this.infoPanel.hide();
      if (slot.cardSprite) slot.cardSprite.setAffordable(true);

      // Clear ghost icons
      for (const ms of this.marketSlots) {
        if (ms) ms.showInvestmentGhost(false);
      }
    });
  }

  // ─── Purchase Mode ─────────────────────────────────────────────────

  /** Convert row + slotIndex to flat array index matching getAllMarketSlots order. */
  private flatIdx(row: MarketRowId, slotIndex: number): number {
    return row === "upper" ? slotIndex : slotIndex + MARKET_SLOTS_PER_ROW;
  }

  private enterPurchaseMode(row: MarketRowId, targetSlotIndex: number): void {
    this.purchaseMode = { row, targetSlotIndex, investedCols: new Set() };
    this.resourceBar.setDraggable(true);
    this.showMessage("Drag resources onto highlighted slots to invest");
    this.highlightPurchaseSlots();
  }

  /** Apply purchase-mode highlights based on session-invested columns. */
  private highlightPurchaseSlots(): void {
    if (!this.purchaseMode) return;
    const { row, targetSlotIndex, investedCols } = this.purchaseMode;
    const market = this.gameState.transitMarket;

    // Clear all first
    for (const ms of this.marketSlots) {
      if (ms) ms.setPurchaseHighlight(null);
    }

    const mode = (col: number) => investedCols.has(col) ? "invested" as const : "needs-invest" as const;

    for (let i = 0; i < targetSlotIndex; i++) {
      // Highlight whichever card(s) exist in this column — prefer same row
      const sameHas = !!getMarketRowById(market, row).slots[i];
      const otherRow: MarketRowId = row === "upper" ? "lower" : "upper";
      const otherHas = !!getMarketRowById(market, otherRow).slots[i];

      if (sameHas) this.marketSlots[this.flatIdx(row, i)]?.setPurchaseHighlight(mode(i));
      else if (otherHas) this.marketSlots[this.flatIdx(otherRow, i)]?.setPurchaseHighlight(mode(i));
    }

    // Highlight the target card
    const targetFi = this.flatIdx(row, targetSlotIndex);
    this.marketSlots[targetFi]?.setPurchaseHighlight("target");
  }

  private exitPurchaseMode(): void {
    this.purchaseMode = null;
    this.resourceBar.setDraggable(false);
    for (const ms of this.marketSlots) {
      if (ms) ms.setPurchaseHighlight(null);
    }
  }

  /** Check if all preceding columns have been invested this session. */
  private checkAutoBuy(): void {
    if (!this.purchaseMode) return;
    const { row, targetSlotIndex, investedCols } = this.purchaseMode;

    // All preceding columns must be invested in THIS session
    let allInvested = true;
    for (let i = 0; i < targetSlotIndex; i++) {
      if (!investedCols.has(i)) { allInvested = false; break; }
    }

    if (allInvested) {
      // Verify affordability before exiting purchase mode
      const targetRow = getMarketRowById(this.gameState.transitMarket, row);
      const card = targetRow.slots[targetSlotIndex];
      if (card) {
        const costMod = getMarketCostModifier(this.gameState.transitMarket);
        const baseCost = card.card.cost;
        const effectiveCost: ResourceCost = {
          matter: (baseCost.matter ?? 0) + (costMod.matter ?? 0),
          energy: (baseCost.energy ?? 0) + (costMod.energy ?? 0),
          data: (baseCost.data ?? 0) + (costMod.data ?? 0),
          influence: (baseCost.influence ?? 0) + (costMod.influence ?? 0),
        };
        if (!canAfford(this.gameState.resources, effectiveCost)) {
          this.showMessage("All slots invested but can't afford the card!");
          this.highlightPurchaseSlots();
          return;
        }
      }
      this.exitPurchaseMode();
      this.animateBuyToDiscard(row, targetSlotIndex);
      this.doAction({ type: "buy-from-market", row, slotIndex: targetSlotIndex });
    } else {
      this.highlightPurchaseSlots();
    }
  }

  // ─── Resource Bar Drag ─────────────────────────────────────────────

  private wireResourceBarDrag(): void {
    this.resourceBar.onResourceDropped = (resourceType: ResourceKey, worldX: number, worldY: number) => {
      // Hit-test: market slot?
      const slotHit = this.hitTestMarketSlot(worldX, worldY);
      if (slotHit && this.purchaseMode) {
        const { targetSlotIndex } = this.purchaseMode;
        const col = slotHit.slotIndex;

        // Only preceding columns, not the target itself
        if (col >= targetSlotIndex) {
          this.showMessage("Invest on the highlighted preceding slots");
          return;
        }

        // Check if this column was already invested in THIS session
        if (this.purchaseMode.investedCols.has(col)) {
          this.showMessage("Already invested in this column for this purchase");
          return;
        }

        // Find a card to invest on in this column — prefer the row user dropped on, fall back to other
        const market = this.gameState.transitMarket;
        const otherRow: MarketRowId = slotHit.row === "upper" ? "lower" : "upper";
        let investRow: MarketRowId | null = null;
        if (getMarketRowById(market, slotHit.row).slots[col]) {
          investRow = slotHit.row;
        } else if (getMarketRowById(market, otherRow).slots[col]) {
          investRow = otherRow;
        }
        if (!investRow) {
          this.showMessage("No card in this column to invest");
          return;
        }

        const resource: ResourceCost = { [resourceType]: 1 };
        const result = executeAction(this.gameState, {
          type: "invest", row: investRow, slotIndex: col, resource,
        });
        if (result.success) {
          this.gameState = result.state;
          this.purchaseMode.investedCols.add(col);
          this.showMessage(result.message);
          this.refreshAll();
          this.checkAutoBuy();
        } else {
          this.showMessage(`! ${result.message}`);
        }
        return;
      }

      // Hit-test: player deck pile? (draw-extra)
      const dx = worldX - this.playerDeckPileX;
      const dy = worldY - this.playerDeckPileY;
      if (Math.sqrt(dx * dx + dy * dy) < s(50)) {
        this.doAction({ type: "draw-extra", resourceType });
        return;
      }

      this.showMessage("Drop on a market slot or your deck");
    };
  }

  private hitTestMarketSlot(worldX: number, worldY: number): { slotIndex: number; row: MarketRowId } | null {
    const cs = LAYOUT.marketColSpacing;
    const halfCol = cs / 2;
    const numCols = 6;

    // Determine row
    let row: MarketRowId | null = null;
    if (Math.abs(worldY - LAYOUT.marketRow1Y) < s(55)) row = "upper";
    else if (Math.abs(worldY - LAYOUT.marketRow2Y) < s(55)) row = "lower";
    if (!row) return null;

    // Determine column (left-to-right: col 0 = slot 0)
    for (let col = 0; col < numCols; col++) {
      const colX = MAIN_CX + (col - 2.5) * cs;
      if (Math.abs(worldX - colX) < halfCol) {
        return { slotIndex: col, row };
      }
    }
    return null;
  }

  // ─── Sectors ──────────────────────────────────────────────────────

  private createSectors(): void {
    for (let i = 0; i < 3; i++) {
      const sectorX = MAIN_CX + (i - 1) * LAYOUT.sectorSpacing;
      const sector = new SectorDisplay(this, sectorX, LAYOUT.sectorY, i);
      this.sectorDisplays.push(sector);

      // Structure card hover → InfoPanel
      sector.onCardClicked = (card) => this.infoPanel.showCard(card);
      sector.onCardUnhovered = () => this.infoPanel.hide();

      // Click sector with selected card → slot structure (legacy path)
      sector.on("pointerdown", () => {
        const id = this.handDisplay.getSelectedInstanceId();
        if (id) this.doAction({ type: "slot-structure", instanceId: id, sectorIndex: i });
      });

      // Right-click installed card → scrap
      sector.onCardRightClicked = (instanceId, sectorIndex) => {
        const sectorWorldX = sectorX;
        const sectorWorldY = LAYOUT.sectorY;
        new ConfirmPopup(
          this, sectorWorldX, sectorWorldY - s(80),
          "Scrap this structure?",
          () => this.doAction({ type: "scrap-structure", instanceId, sectorIndex })
        );
      };
    }
  }

  // ─── Player Deck & Discard Piles ─────────────────────────────────

  private createPlayerPiles(): void {
    const matCx = MAIN_CX;
    const matW = LAYOUT.playMatW;
    const pileY = (LAYOUT.playMatTop + LAYOUT.playMatBottom) / 2;

    // Player draw pile — right of play mat
    const deckX = matCx + matW / 2 + s(55);
    this.playerDeckPileX = deckX;
    this.playerDeckPileY = pileY;

    // Stacked card-backs for draw pile
    for (let i = 2; i >= 0; i--) {
      const offset = i * s(2);
      const back = this.add.image(deckX + offset, pileY + offset, "card-back");
      back.setScale(0.45);
      back.setAlpha(0.6 + i * 0.15);
    }
    this.add.text(deckX, pileY - s(55), "DECK", {
      fontSize: fontSize(8), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);
    this.playerDeckCountText = this.add.text(deckX, pileY + s(55), "", {
      fontSize: fontSize(9), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);

    // Player discard pile — left of play mat
    const discardX = matCx - matW / 2 - s(55);
    this.playerDiscardPileX = discardX;
    this.playerDiscardPileY = pileY;

    // Stacked card-backs for discard (slightly scattered)
    for (let i = 2; i >= 0; i--) {
      const offset = i * s(2);
      const back = this.add.image(discardX - offset, pileY + offset, "card-back");
      back.setScale(0.45);
      back.setAlpha(0.4 + i * 0.1);
      back.setAngle(-3 + i * 3); // slight scatter
    }
    this.add.text(discardX, pileY - s(55), "DISCARD", {
      fontSize: fontSize(8), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);
    this.playerDiscardCountText = this.add.text(discardX, pileY + s(55), "", {
      fontSize: fontSize(9), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);
  }

  // ─── Hand Callbacks ────────────────────────────────────────────────

  private wireHandCallbacks(): void {
    this.handDisplay.onCardSelected = (id) => this.showCardInInfoPanel(id);

    this.handDisplay.onCardHovered = (id) => {
      if (id) {
        this.showCardInInfoPanel(id);
      } else {
        this.infoPanel.hide();
      }
    };

    this.handDisplay.onCardDoubleClicked = (instanceId) => {
      const card = this.gameState.mandateDeck.hand.find(c => c.instanceId === instanceId);
      if (!card) return;

      const type = card.card.type;
      if (type === "structure" || type === "institution") {
        this.showMessage("Drag to a sector to install");
      } else {
        this.doAction({ type: "play-card", instanceId });
      }
    };

    this.handDisplay.onDragStarted = (instanceId) => {
      const card = this.gameState.mandateDeck.hand.find(c => c.instanceId === instanceId);
      if (!card) return;

      const type = card.card.type;
      if (type === "structure" || type === "institution") {
        // Highlight sectors for structure drop
        for (let i = 0; i < 3; i++) {
          const sector = this.gameState.ship.sectors[i];
          const hasSpace = sector.installedCards.length < sector.maxSlots;
          this.sectorDisplays[i].setDropHighlight(true, hasSpace);
        }
      } else {
        // Highlight the play mat for action/junk play
        this.playMat.setHighlight(true);
      }
    };

    this.handDisplay.onDragEnded = () => {
      this.playMat.setHighlight(false);
      for (const sd of this.sectorDisplays) {
        sd.setDropHighlight(false, false);
      }
    };

    this.handDisplay.onCardDropped = (instanceId, worldX, worldY) => {
      const target = this.getDropTarget(worldX, worldY);
      if (!target) {
        this.showMessage("Drop on a valid target");
        return;
      }

      if (target.type === "sector") {
        this.doAction({ type: "slot-structure", instanceId, sectorIndex: target.sectorIndex });
      } else if (target.type === "play-zone") {
        this.doAction({ type: "play-card", instanceId });
      }
    };
  }

  private getDropTarget(worldX: number, worldY: number):
    | { type: "sector"; sectorIndex: number }
    | { type: "play-zone" }
    | null {
    // Check sectors
    for (let i = 0; i < 3; i++) {
      const sectorX = MAIN_CX + (i - 1) * LAYOUT.sectorSpacing;
      const sectorY = LAYOUT.sectorY;
      if (
        Math.abs(worldX - sectorX) < s(135) &&
        Math.abs(worldY - sectorY) < s(70)
      ) {
        return { type: "sector", sectorIndex: i };
      }
    }

    // Check play zone (between resource bar and hand)
    if (
      worldY > LAYOUT.playZoneY - LAYOUT.playZoneH / 2 &&
      worldY < LAYOUT.playZoneY + LAYOUT.playZoneH / 2
    ) {
      return { type: "play-zone" };
    }

    // Anything above sectors counts as play zone too (generous drop area)
    if (worldY > LAYOUT.playMatTop && worldY < LAYOUT.handY - s(80)) {
      return { type: "play-zone" };
    }

    return null;
  }

  // ─── Buy Animation ──────────────────────────────────────────────

  /** Animate a card-back from a market slot position to the discard pile. */
  private animateBuyToDiscard(row: MarketRowId, slotIndex: number): void {
    const fi = this.flatIdx(row, slotIndex);
    const slot = this.marketSlots[fi];
    if (!slot) return;

    // Get world position of the market slot
    const fromX = slot.x;
    const fromY = slot.y;

    const ghost = this.add.image(fromX, fromY, "card-back");
    ghost.setScale(0.45);
    ghost.setDepth(500);

    this.tweens.add({
      targets: ghost,
      x: this.playerDiscardPileX,
      y: this.playerDiscardPileY,
      scaleX: 0.35,
      scaleY: 0.35,
      alpha: 0.6,
      duration: 400,
      ease: "Power2",
      onComplete: () => ghost.destroy(),
    });
  }

  // ─── Actions / Refresh ────────────────────────────────────────────

  private showCardInInfoPanel(instanceId: string): void {
    let card = this.gameState.mandateDeck.hand.find(c => c.instanceId === instanceId);
    if (!card) {
      for (const slot of getAllMarketSlots(this.gameState.transitMarket)) {
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
      this.actionLog.addEntry(result.message);
      if (result.effectsTriggered?.length) {
        for (const eff of result.effectsTriggered) {
          this.actionLog.addEntry(`  ${eff}`, HEX.eggshell);
        }
      }
    } else {
      this.showMessage(`! ${result.message}`, "#cc4444");
      this.actionLog.addEntry(`! ${result.message}`, "#cc4444");
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

    const allSlots = getAllMarketSlots(this.gameState.transitMarket);
    const numCols = 6;
    for (let i = 0; i < MARKET_SLOTS; i++) {
      if (this.marketSlots[i]) {
        this.marketSlots[i].setCard(allSlots[i] ?? null);

        // Determine row and slot index for this flat index
        // getAllMarketSlots order: upper 0-5, lower 6-11
        const isUpper = i < MARKET_SLOTS_PER_ROW;
        const row: MarketRowId = isUpper ? "upper" : "lower";
        const slotIndex = isUpper ? i : i - MARKET_SLOTS_PER_ROW;

        // Update investment indicator
        const marketRow = getMarketRowById(this.gameState.transitMarket, row);
        this.marketSlots[i].setInvestment(marketRow.investments[slotIndex] ?? null);

        this.wireMarketSlotInteractions(this.marketSlots[i], slotIndex, row);
      }
    }

    for (let i = 0; i < 3; i++) {
      this.sectorDisplays[i].updateDisplay(this.gameState.ship.sectors[i]);
    }

    this.handDisplay.updateHand(this.gameState.mandateDeck.hand);

    const draw = this.gameState.mandateDeck.drawPile.length;
    const disc = this.gameState.mandateDeck.discardPile.length;
    this.deckCountText.setText(`Deck: ${draw} | Discard: ${disc}`);

    // Player pile counts
    this.playerDeckCountText.setText(`${draw}`);
    this.playerDiscardCountText.setText(`${disc}`);

    // Update world deck count
    const worldDeckCount = this.gameState.worldDeck.drawPile.length;
    this.worldDeckCountText.setText(`${worldDeckCount} cards`);
  }

  private showMessage(msg: string, color?: string): void {
    this.messagePanel.addMessage(msg, color);
  }
}
