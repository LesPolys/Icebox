import Phaser from "phaser";
import type { GameState, Card, CardInstance, MarketRowId, ResourceCost } from "@icebox/shared";
import { MARKET_SLOTS, MARKET_SLOTS_PER_ROW, NUM, HEX, getAllMarketSlots, getMarketRowById, canAfford, gainResources } from "@icebox/shared";
import { createNewGameState } from "../systems/GameStateManager";

import { startTurn, executeAction, type PlayerAction } from "../systems/TurnManager";
import { getMarketCostModifier, getExtraSlideCount } from "../systems/MarketEffectResolver";
import { compactMarket, slideMarketNoRefill, fillMarket, investOnSlot } from "../systems/MarketManager";
import { resolveFallout } from "../systems/FalloutHandler";
import { updateShipPresence, calculateGlobalPresence } from "../systems/FactionTracker";
import { ResourceBar, type ResourceKey, drawResourceShape, RESOURCE_META } from "../game-objects/ResourceBar";
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
import { EntropyGauge } from "../ui/EntropyGauge";
import { EraDisplay } from "../ui/EraDisplay";
import { EraTheme } from "../ui/EraTheme";
import { BootScene } from "./BootScene";
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
  private entropyGauge!: EntropyGauge;
  private eraDisplay!: EraDisplay;
  private eraTheme!: EraTheme;
  private worldDeckCountText!: Phaser.GameObjects.Text;
  private playerDeckCountText!: Phaser.GameObjects.Text;
  private playerDiscardCountText!: Phaser.GameObjects.Text;

  // ── Purchase mode state ──
  private purchaseMode: {
    row: MarketRowId;
    targetSlotIndex: number;
    /** Tracks per-column: which row was invested on and what resource was spent. */
    investments: Map<number, { row: MarketRowId; resource: ResourceCost }>;
  } | null = null;

  // Market geometry for hit-testing resource drops
  private marketColPositions: number[] = [];
  private deckPileX = 0;
  private deckPileY = 0;
  private marketBoxLeft = 0;

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
    } else {
      this.gameState = data.savedState;
    }
    this.gameState.ship = updateShipPresence(this.gameState.ship);
    this.gameState.globalFactionPresence = calculateGlobalPresence(this.gameState.ship);
    (this as any).__restartData = { newGame: false, savedState: this.gameState };
  }

  create(): void {
    // Reset arrays (Phaser reuses scene instances on restart)
    this.marketSlots = [];
    this.sectorDisplays = [];
    this.marketColPositions = [];
    this.purchaseMode = null;

    // Disable browser right-click menu for right-click interactions
    this.input.mouse?.disableContextMenu();

    // ─── Play mat (rendered below everything) ───
    this.playMat = new PlayMat(this);
    this.playMat.onEndTurn = () => {
      this.animatedEndTurn();
    };

    // ─── Left gutter: Phase indicator + Action log ───
    this.phaseIndicator = new PhaseIndicator(this, LAYOUT.phaseX, LAYOUT.phaseY);
    this.actionLog = new ActionLog(this);

    // ─── Era environmental theme ───
    this.eraTheme = new EraTheme(this);
    this.eraTheme.applyTheme(this.gameState.era);

    // ─── Right gutter: Deck count + Info panel ───
    // Deck/discard counts shown on the pile visuals instead
    this.deckCountText = this.add.text(0, 0, "").setVisible(false);
    this.infoPanel = new InfoPanel(this);

    // ─── Main area ───
    this.createMarket();

    // ─── Left of market: Era display ───
    const marketTopY = LAYOUT.marketRow1Y - s(30);
    this.eraDisplay = new EraDisplay(this, 0, 0);
    this.eraDisplay.setPosition(this.marketBoxLeft - this.eraDisplay.boxW - s(12), marketTopY);

    // ─── Right of market deck: Entropy gauge (vertically centered on market) ───
    const marketMidY = (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2;
    this.entropyGauge = new EntropyGauge(this, this.deckPileX + s(55), marketMidY - s(55));

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
    const handBefore = new Set(this.gameState.mandateDeck.hand.map(c => c.instanceId));
    const initialTurn = startTurn(this.gameState);
    this.gameState = initialTurn.state;
    this.actionLog.setTurn(this.gameState.turnNumber);
    this.refreshAll();
    const newCards = new Set(
      this.gameState.mandateDeck.hand
        .filter(c => !handBefore.has(c.instanceId))
        .map(c => c.instanceId)
    );
    this.animateDrawToHand(newCards);
    this.showMessage("Welcome aboard. The ship awaits your command.");
  }

  // ─── Market ───────────────────────────────────────────────────────

  private createMarket(): void {
    const cx = MAIN_CX;
    const cs = LAYOUT.marketColSpacing;
    const numCols = 6;

    // Column numbers — bordered badges above the box
    const badgeY = LAYOUT.marketLabelY;
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
      this.add.text(colX, badgeY, `${col}`, {
        fontSize: fontSize(11), color: HEX.eggshell, fontFamily: "monospace", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(10);
    }

    // Box background — starts below the badge row
    const boxPadX = s(55);
    const boxLeft = cx - 2.5 * cs - boxPadX;
    this.marketBoxLeft = boxLeft;
    const boxTop = badgeY + badgeR + s(4);
    const boxW = 5 * cs + boxPadX * 2;
    const boxH = (LAYOUT.marketRow2Y - LAYOUT.marketRow1Y) * 2;

    const gfx = this.add.graphics();
    gfx.fillStyle(NUM.midnightViolet, 0.3);
    gfx.fillRoundedRect(boxLeft, boxTop, boxW, boxH, s(6));
    gfx.lineStyle(s(1.5), NUM.charcoalBlue, 0.5);
    gfx.strokeRoundedRect(boxLeft, boxTop, boxW, boxH, s(6));

    // Row divider — horizontal line between upper and lower rows
    const rowDivY = (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2;
    gfx.lineStyle(s(1), NUM.charcoalBlue, 0.3);
    gfx.lineBetween(boxLeft + s(8), rowDivY, boxLeft + boxW - s(8), rowDivY);

    // Column dividers — vertical lines between each column
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
    const deckX = cx + 2.5 * cs + boxPadX + s(50);
    const deckY = (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2;
    this.deckPileX = deckX;
    this.deckPileY = deckY;

    // Stacked card-back images to suggest a pile
    for (let i = 2; i >= 0; i--) {
      const offset = i * s(2);
      const back = this.add.image(deckX + offset, deckY + offset, "card-back");
      back.setScale(0.65);
      back.setAlpha(0.6 + i * 0.15);
    }
    this.worldDeckCountText = this.add.text(deckX, deckY + s(55), "", {
      fontSize: fontSize(9), color: HEX.pearlAqua, fontFamily: "monospace",
    }).setOrigin(0.5);
  }

  private wireMarketSlotInteractions(slot: MarketSlot, slotIndex: number, row: MarketRowId): void {
    if (!slot.cardSprite) return;

    // Click to buy, enter purchase mode, or withdraw investment
    slot.cardSprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      if (!slot.cardSprite) return;

      // In purchase mode: click an invested slot to withdraw
      if (this.purchaseMode) {
        if (this.purchaseMode.investments.has(slotIndex)) {
          this.refundInvestment(slotIndex);
          this.refreshAll();
          this.highlightPurchaseSlots();
          this.showMessage("Investment withdrawn");
        }
        return;
      }

      if (slotIndex === 0) {
        // Column 0 has no preceding slots — buy directly if affordable
        const costMod = getMarketCostModifier(this.gameState.transitMarket);
        const baseCost = slot.cardSprite.cardInstance.card.cost;
        const effectiveCost: ResourceCost = {
          matter: (baseCost.matter ?? 0) + (costMod.matter ?? 0),
          energy: (baseCost.energy ?? 0) + (costMod.energy ?? 0),
          data: (baseCost.data ?? 0) + (costMod.data ?? 0),
          influence: (baseCost.influence ?? 0) + (costMod.influence ?? 0),
        };
        if (!canAfford(this.gameState.resources, effectiveCost)) {
          this.showMessage("Can't afford this card!", "#cc4444");
          return;
        }
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

      // Affordability check (skip during purchase mode — resources are mid-investment)
      if (!this.purchaseMode) {
        const costMod = getMarketCostModifier(this.gameState.transitMarket);
        const baseCost = slot.cardSprite.cardInstance.card.cost;
        const effectiveCost: ResourceCost = {
          matter: (baseCost.matter ?? 0) + (costMod.matter ?? 0),
          energy: (baseCost.energy ?? 0) + (costMod.energy ?? 0),
          data: (baseCost.data ?? 0) + (costMod.data ?? 0),
          influence: (baseCost.influence ?? 0) + (costMod.influence ?? 0),
        };
        slot.cardSprite.setAffordable(canAfford(this.gameState.resources, effectiveCost));
      }

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
    this.purchaseMode = { row, targetSlotIndex, investments: new Map() };
    this.resourceBar.setDraggable(true);
    this.showMessage("Drag resources onto highlighted slots to invest");
    this.highlightPurchaseSlots();
  }

  /** Apply purchase-mode highlights based on session-invested columns. */
  private highlightPurchaseSlots(): void {
    if (!this.purchaseMode) return;
    const { row, targetSlotIndex, investments } = this.purchaseMode;
    const market = this.gameState.transitMarket;

    // Clear all first
    for (const ms of this.marketSlots) {
      if (ms) ms.setPurchaseHighlight(null);
    }

    const mode = (col: number) => investments.has(col) ? "invested" as const : "needs-invest" as const;

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

  /** Refund a single pending investment during purchase mode. */
  private refundInvestment(col: number): void {
    if (!this.purchaseMode) return;
    const entry = this.purchaseMode.investments.get(col);
    if (!entry) return;

    // Refund resources (investment was never committed to market state)
    this.gameState.resources = gainResources(this.gameState.resources, entry.resource);
    this.purchaseMode.investments.delete(col);
  }

  /** Show pending investment visuals on market slots (overlays on top of real state). */
  private refreshPendingInvestments(): void {
    if (!this.purchaseMode) return;
    for (const [col, entry] of this.purchaseMode.investments) {
      const fi = this.flatIdx(entry.row, col);
      const slot = this.marketSlots[fi];
      if (!slot) continue;
      // Merge any existing real investment with the pending one
      const row = getMarketRowById(this.gameState.transitMarket, entry.row);
      const existing = row.investments[col];
      const merged: ResourceCost = {
        matter: (existing?.matter ?? 0) + (entry.resource.matter ?? 0),
        energy: (existing?.energy ?? 0) + (entry.resource.energy ?? 0),
        data: (existing?.data ?? 0) + (entry.resource.data ?? 0),
        influence: (existing?.influence ?? 0) + (entry.resource.influence ?? 0),
      };
      slot.setInvestment(merged);
    }
  }

  /**
   * Exit purchase mode.
   * @param refund If true (default), refund all session investments with animation.
   *               Pass false when the purchase succeeded (investments should stay).
   */
  private exitPurchaseMode(refund = true): void {
    if (refund && this.purchaseMode && this.purchaseMode.investments.size > 0) {
      // Animate refund: investment icons fly back to their resource pile
      for (const [col, entry] of this.purchaseMode.investments) {
        const fi = this.flatIdx(entry.row, col);
        const slot = this.marketSlots[fi];
        if (slot) {
          // Target the specific resource pile in the bar
          const resKey = Object.keys(entry.resource).find(
            k => (entry.resource as Record<string, number>)[k] > 0
          ) ?? "matter";
          const targetPos = this.resourceBar.getResourceWorldPos(resKey);

          const ghost = this.createInvestmentGhost(entry.resource, slot.x, slot.y);
          this.tweens.add({
            targets: ghost,
            x: targetPos.x,
            y: targetPos.y,
            alpha: 0.3,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 400,
            ease: "Power2",
            onComplete: () => ghost.destroy(),
          });
        }
      }

      // Refund all investments
      for (const col of [...this.purchaseMode.investments.keys()]) {
        this.refundInvestment(col);
      }

      this.refreshAll();
    }

    this.purchaseMode = null;
    this.resourceBar.setDraggable(false);
    for (const ms of this.marketSlots) {
      if (ms) ms.setPurchaseHighlight(null);
    }
  }

  /** Check if all preceding columns have been invested this session. */
  private checkAutoBuy(): void {
    if (!this.purchaseMode) return;
    const { row, targetSlotIndex, investments } = this.purchaseMode;

    // All preceding columns that have a card must be invested in THIS session
    const market = this.gameState.transitMarket;
    const otherRow: MarketRowId = row === "upper" ? "lower" : "upper";
    let allInvested = true;
    for (let i = 0; i < targetSlotIndex; i++) {
      const hasCard = !!getMarketRowById(market, row).slots[i] || !!getMarketRowById(market, otherRow).slots[i];
      if (hasCard && !investments.has(i)) { allInvested = false; break; }
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
      // Commit all pending investments to market state
      for (const [col, entry] of investments) {
        const updated = investOnSlot(this.gameState.transitMarket, entry.row, col, entry.resource);
        if (updated) this.gameState.transitMarket = updated;
      }

      this.exitPurchaseMode(false); // Don't refund — purchase succeeded
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
        if (this.purchaseMode.investments.has(col)) {
          this.showMessage("Already invested in this column — click the slot to withdraw first");
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

        // Check affordability without committing
        if (!canAfford(this.gameState.resources, resource)) {
          this.showMessage("Cannot afford this investment.");
          return;
        }

        // Pending investment: deduct resource but don't commit to market state
        this.gameState.resources = gainResources(this.gameState.resources, {
          [resourceType]: -1,
        });
        this.purchaseMode.investments.set(col, { row: investRow, resource });
        this.showMessage(`Invested on ${investRow} row slot ${col}.`);
        this.refreshAll();
        this.refreshPendingInvestments();
        this.checkAutoBuy();
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
    }).setOrigin(0.5).setDepth(10);

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
    }).setOrigin(0.5).setDepth(10);
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
      const card = this.gameState.mandateDeck.hand.find(c => c.instanceId === instanceId);
      if (!card) return;

      const isStructureType = card.card.type === "structure" || card.card.type === "institution";
      const target = this.getDropTarget(worldX, worldY, isStructureType);
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

  private getDropTarget(worldX: number, worldY: number, canSlotStructure: boolean):
    | { type: "sector"; sectorIndex: number }
    | { type: "play-zone" }
    | null {
    // Check sectors (only for structure/institution cards)
    if (canSlotStructure) {
      for (let i = 0; i < 3; i++) {
        const sectorX = MAIN_CX + (i - 1) * LAYOUT.sectorSpacing;
        const sectorY = LAYOUT.sectorY;
        if (
          Math.abs(worldX - sectorX) < s(160) &&
          Math.abs(worldY - sectorY) < s(100)
        ) {
          return { type: "sector", sectorIndex: i };
        }
      }
    }

    // Anything above the hand area counts as play zone (generous drop area)
    if (worldY < LAYOUT.handY - s(40)) {
      return { type: "play-zone" };
    }

    return null;
  }

  // ─── Buy Animation ──────────────────────────────────────────────

  /** Animate a card-back from a market slot position to the discard pile. */
  /** Animate a card-back ghost from a world position to the discard pile. */
  private animateCardToDiscard(fromX: number, fromY: number): void {
    const ghost = this.add.image(fromX, fromY, "card-back");
    ghost.setScale(0.7);
    ghost.setDepth(500);

    this.tweens.add({
      targets: ghost,
      x: this.playerDiscardPileX,
      y: this.playerDiscardPileY,
      scaleX: 0.35,
      scaleY: 0.35,
      alpha: 0.6,
      duration: 350,
      ease: "Power2",
      onComplete: () => ghost.destroy(),
    });
  }

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

  // ─── Animated End Turn ──────────────────────────────────────────────

  private endTurnAnimating = false;

  /**
   * Phased animated end-turn:
   *   1. Compact gaps (cards slide left within rows)
   *   2. Slide left by 1 + fallout (repeat for extra slides)
   *   3. Refill from world deck (top-to-bottom, left-to-right)
   *   4. Start next turn
   *
   * Each phase applies its state change, refreshes market visuals,
   * then animates only the affected cards from old→new positions.
   */
  private animatedEndTurn(): void {
    if (this.endTurnAnimating) return;
    this.endTurnAnimating = true;

    this.showMessage("Turn ended.");
    this.actionLog.addEntry("Turn ended.");

    // Phase 1: Compact
    this.animateCompact(() => {
      // Phase 2: Slide + Fallout (may loop for extra slides from hazards)
      const extraSlides = getExtraSlideCount(this.gameState.transitMarket);
      const totalSlides = 1 + extraSlides;
      if (extraSlides > 0) {
        this.actionLog.addEntry(
          `Market slides ${totalSlides}× (${extraSlides} extra from hazards).`,
          HEX.eggshell
        );
      }

      this.animateSlideLoop(totalSlides, 0, () => {
        // Phase 3: Refill
        this.animateRefill(() => {
          // Phase 4: Start next turn
          const handBefore = new Set(this.gameState.mandateDeck.hand.map(c => c.instanceId));
          const turnResult = startTurn(this.gameState);
          this.gameState = turnResult.state;
          this.actionLog.setTurn(this.gameState.turnNumber);
          if (turnResult.reshuffled) {
            this.showMessage("Discard reshuffled into deck.");
            this.actionLog.addEntry("Discard reshuffled into deck.", HEX.darkCyan);
          }
          this.refreshAll();

          // Animate drawn cards from deck to hand
          const newCards = new Set(
            this.gameState.mandateDeck.hand
              .filter(c => !handBefore.has(c.instanceId))
              .map(c => c.instanceId)
          );
          this.animateDrawToHand(newCards);
          this.endTurnAnimating = false;
        });
      });
    });
  }

  /** Snapshot: instanceId → { fi, investment } for all non-null market slots. */
  private snapshotMarket(): Map<string, { fi: number; investment: ResourceCost | null }> {
    const map = new Map<string, { fi: number; investment: ResourceCost | null }>();
    const slots = getAllMarketSlots(this.gameState.transitMarket);
    for (let i = 0; i < MARKET_SLOTS; i++) {
      if (slots[i]) {
        const isUpper = i < MARKET_SLOTS_PER_ROW;
        const row = getMarketRowById(this.gameState.transitMarket, isUpper ? "upper" : "lower");
        const slotIdx = isUpper ? i : i - MARKET_SLOTS_PER_ROW;
        map.set(slots[i]!.instanceId, { fi: i, investment: row.investments[slotIdx] ?? null });
      }
    }
    return map;
  }

  /** Refresh only market slot visuals from current gameState. */
  private refreshMarketDisplay(): void {
    const allSlots = getAllMarketSlots(this.gameState.transitMarket);
    for (let i = 0; i < MARKET_SLOTS; i++) {
      if (!this.marketSlots[i]) continue;
      this.marketSlots[i].setCard(allSlots[i] ?? null);
      const isUpper = i < MARKET_SLOTS_PER_ROW;
      const row: MarketRowId = isUpper ? "upper" : "lower";
      const slotIndex = isUpper ? i : i - MARKET_SLOTS_PER_ROW;
      const marketRow = getMarketRowById(this.gameState.transitMarket, row);
      this.marketSlots[i].setInvestment(marketRow.investments[slotIndex] ?? null);
      this.wireMarketSlotInteractions(this.marketSlots[i], slotIndex, row);
    }
    this.worldDeckCountText.setText(`${this.gameState.worldDeck.drawPile.length} cards`);
  }

  /**
   * Animate moved cards: hide destination sprites + investments, tween ghosts
   * (card + investment icons) from old→new, reveal on complete.
   */
  private animateCardMoves(
    moved: { fromFi: number; toFi: number; investment: ResourceCost | null }[],
    duration: number,
    onComplete: () => void
  ): void {
    if (moved.length === 0) { onComplete(); return; }

    const hiddenFis = new Set(moved.map(m => m.toFi));
    for (const fi of hiddenFis) {
      if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(false);
      this.marketSlots[fi]?.setInvestmentVisible(false);
    }

    let remaining = moved.length;
    for (const m of moved) {
      const fromSlot = this.marketSlots[m.fromFi];
      const toSlot = this.marketSlots[m.toFi];

      // Full card ghost — clone as a CardSprite so all text/details are visible
      const cardInst = toSlot.cardSprite?.cardInstance;
      let ghost: Phaser.GameObjects.GameObject;
      if (cardInst) {
        const cardGhost = new CardSprite(this, fromSlot.x, fromSlot.y, cardInst);
        cardGhost.setScale(0.72);
        cardGhost.setMarketMode(true);
        cardGhost.setDepth(500);
        ghost = cardGhost;
      } else {
        const img = this.add.image(fromSlot.x, fromSlot.y, "card-back");
        img.setScale(0.55).setDepth(500);
        ghost = img;
      }

      // Investment ghost (travels with card)
      let investGhost: Phaser.GameObjects.Graphics | null = null;
      if (m.investment) {
        investGhost = this.createInvestmentGhost(m.investment, fromSlot.x, fromSlot.y);
      }

      const targets: Phaser.GameObjects.GameObject[] = [ghost];
      if (investGhost) targets.push(investGhost);

      this.tweens.add({
        targets,
        x: toSlot.x,
        y: toSlot.y,
        duration,
        ease: "Power2",
        onComplete: () => {
          ghost.destroy();
          if (investGhost) investGhost.destroy();
          if (--remaining <= 0) {
            for (const fi of hiddenFis) {
              if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(true);
              this.marketSlots[fi]?.setInvestmentVisible(true);
            }
            onComplete();
          }
        },
      });
    }
  }

  /** Create a graphics object showing investment resource icons at the given world position. */
  private createInvestmentGhost(investment: ResourceCost, wx: number, wy: number): Phaser.GameObjects.Graphics {
    const gfx = this.add.graphics();
    gfx.setPosition(wx, wy);
    gfx.setDepth(501);

    const groups: { meta: (typeof RESOURCE_META)[number]; count: number }[] = [];
    for (const meta of RESOURCE_META) {
      const val = investment[meta.key as keyof ResourceCost] ?? 0;
      if (val > 0) groups.push({ meta, count: val });
    }

    const iconSize = s(8);
    const gap = s(22);
    const totalW = (groups.length - 1) * gap;
    const startX = -totalW / 2;
    const iconY = s(38); // same offset as MarketSlot.setInvestment

    for (let i = 0; i < groups.length; i++) {
      const { meta } = groups[i];
      gfx.fillStyle(0x000000, 0.5);
      gfx.fillCircle(startX + i * gap, iconY, iconSize + s(2));
      drawResourceShape(gfx, meta.shape, startX + i * gap, iconY, iconSize, meta.numColor, 0.8, 1);
    }

    return gfx;
  }

  /** Phase 1: Compact both rows — fill gaps by sliding cards left. */
  private animateCompact(onComplete: () => void): void {
    const oldMap = this.snapshotMarket();
    this.gameState.transitMarket = compactMarket(this.gameState.transitMarket);
    const newMap = this.snapshotMarket();

    const moved: { fromFi: number; toFi: number; investment: ResourceCost | null }[] = [];
    for (const [id, newSnap] of newMap) {
      const oldSnap = oldMap.get(id);
      if (oldSnap !== undefined && oldSnap.fi !== newSnap.fi) {
        moved.push({ fromFi: oldSnap.fi, toFi: newSnap.fi, investment: oldSnap.investment });
      }
    }

    this.refreshMarketDisplay();
    this.animateCardMoves(moved, 500, onComplete);
  }

  /** Phase 2: Slide left by 1. Leftmost cards fall off. Repeats for extra slides. */
  private animateSlideLoop(total: number, current: number, onComplete: () => void): void {
    if (current >= total) { onComplete(); return; }

    const oldMap = this.snapshotMarket();

    // Find column-0 cards (will fall out) — capture card instances before refresh
    const slotsBefore = getAllMarketSlots(this.gameState.transitMarket);
    const falloutFis: { fi: number; investment: ResourceCost | null; cardInst: CardInstance | null }[] = [];
    for (let fi = 0; fi < MARKET_SLOTS; fi++) {
      const col = fi < MARKET_SLOTS_PER_ROW ? fi : fi - MARKET_SLOTS_PER_ROW;
      if (col === 0 && slotsBefore[fi]) {
        const snap = oldMap.get(slotsBefore[fi]!.instanceId);
        const cardInst = this.marketSlots[fi]?.cardSprite?.cardInstance ?? null;
        falloutFis.push({ fi, investment: snap?.investment ?? null, cardInst });
      }
    }

    // Apply slide + resolve fallout effects
    const slideResult = slideMarketNoRefill(this.gameState.transitMarket);
    this.gameState.transitMarket = slideResult.market;

    for (const falloutData of [slideResult.upperFallout, slideResult.lowerFallout]) {
      if (falloutData.card) {
        const fr = resolveFallout(this.gameState, falloutData.card);
        this.gameState = fr.state;
        for (const msg of fr.messages) {
          this.showMessage(msg);
          this.actionLog.addEntry(msg, HEX.eggshell);
        }
      }
    }

    for (const claim of slideResult.claimedInvestments) {
      const msg = `${claim.faction} claimed invested resources.`;
      this.showMessage(msg);
      this.actionLog.addEntry(msg, HEX.eggshell);
      if (this.gameState.globalFactionPresence[claim.faction] !== undefined) {
        const totalRes = (claim.resources.matter ?? 0) + (claim.resources.energy ?? 0) +
                         (claim.resources.data ?? 0) + (claim.resources.influence ?? 0);
        this.gameState.globalFactionPresence[claim.faction] += totalRes;
      }
    }

    // Determine surviving cards that shifted
    const newMap = this.snapshotMarket();
    const moved: { fromFi: number; toFi: number; investment: ResourceCost | null }[] = [];
    for (const [id, newSnap] of newMap) {
      const oldSnap = oldMap.get(id);
      if (oldSnap !== undefined && oldSnap.fi !== newSnap.fi) {
        moved.push({ fromFi: oldSnap.fi, toFi: newSnap.fi, investment: oldSnap.investment });
      }
    }

    // Hide column-0 slots (fallout cards) — they'll be replaced by ghosts
    for (const { fi } of falloutFis) {
      if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(false);
      this.marketSlots[fi]?.setInvestmentVisible(false);
    }

    // Animate fallout — ghost cards spin off-screen to the left
    for (const { fi, investment, cardInst } of falloutFis) {
      const slot = this.marketSlots[fi];
      let ghost: Phaser.GameObjects.GameObject;
      if (cardInst) {
        const cardGhost = new CardSprite(this, slot.x, slot.y, cardInst);
        cardGhost.setScale(0.72);
        cardGhost.setMarketMode(true);
        cardGhost.setDepth(500);
        ghost = cardGhost;
      } else {
        const img = this.add.image(slot.x, slot.y, "card-back");
        img.setScale(0.55).setDepth(500);
        ghost = img;
      }

      let investGhost: Phaser.GameObjects.Graphics | null = null;
      if (investment) {
        investGhost = this.createInvestmentGhost(investment, slot.x, slot.y);
      }

      const targets: Phaser.GameObjects.GameObject[] = [ghost];
      if (investGhost) targets.push(investGhost);

      this.tweens.add({
        targets,
        x: slot.x - s(200),
        y: slot.y + s(30),
        angle: -45,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 700,
        ease: "Power2",
        onComplete: () => {
          ghost.destroy();
          if (investGhost) investGhost.destroy();
        },
      });
    }

    // After fallout animates, refresh display and slide survivors
    const slideDelay = falloutFis.length > 0 ? 450 : 0;

    if (moved.length === 0) {
      this.time.delayedCall(slideDelay + 500, () => {
        this.refreshMarketDisplay();
        this.animateSlideLoop(total, current + 1, onComplete);
      });
      return;
    }

    this.time.delayedCall(slideDelay, () => {
      this.refreshMarketDisplay();
      this.animateCardMoves(moved, 600, () => {
        this.animateSlideLoop(total, current + 1, onComplete);
      });
    });
  }

  /** Phase 3: Fill empty slots from world deck (upper row L→R, then lower row L→R). */
  private animateRefill(onComplete: () => void): void {
    const oldMap = this.snapshotMarket();

    const fillResult = fillMarket(this.gameState.transitMarket, this.gameState.worldDeck);
    this.gameState.transitMarket = fillResult.market;
    this.gameState.worldDeck = fillResult.worldDeck;

    const newMap = this.snapshotMarket();
    const newFis: number[] = [];
    for (const [id, snap] of newMap) {
      if (!oldMap.has(id)) newFis.push(snap.fi);
    }

    // Sort: column-by-column, top then bottom, left to right
    newFis.sort((a, b) => {
      const aCol = a % MARKET_SLOTS_PER_ROW;
      const bCol = b % MARKET_SLOTS_PER_ROW;
      if (aCol !== bCol) return aCol - bCol;
      const aRow = a < MARKET_SLOTS_PER_ROW ? 0 : 1;
      const bRow = b < MARKET_SLOTS_PER_ROW ? 0 : 1;
      return aRow - bRow;
    });

    this.refreshMarketDisplay();

    if (newFis.length === 0) {
      onComplete();
      return;
    }

    // Hide new cards, animate them flying in from world deck pile
    for (const fi of newFis) {
      if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(false);
    }

    let filled = 0;
    for (let idx = 0; idx < newFis.length; idx++) {
      const fi = newFis[idx];
      const ghost = this.add.image(this.deckPileX, this.deckPileY, "card-back");
      ghost.setScale(0.3).setAlpha(0).setDepth(500);

      this.tweens.add({
        targets: ghost,
        x: this.marketSlots[fi].x,
        y: this.marketSlots[fi].y,
        scaleX: 0.5,
        scaleY: 0.5,
        alpha: 1,
        duration: 400,
        delay: idx * 120,
        ease: "Back.easeOut",
        onComplete: () => {
          ghost.destroy();
          if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(true);
          if (++filled >= newFis.length) onComplete();
        },
      });
    }
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
    const handBefore = new Set(this.gameState.mandateDeck.hand.map(c => c.instanceId));
    const handPositions = this.handDisplay.getCardWorldPositions();
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

    if (result.success) {
      // Animate cards that left hand → discard pile
      const handAfter = new Set(this.gameState.mandateDeck.hand.map(c => c.instanceId));
      const discardIds = new Set(this.gameState.mandateDeck.discardPile.map(c => c.instanceId));
      for (const id of handBefore) {
        if (!handAfter.has(id) && discardIds.has(id)) {
          const pos = handPositions.get(id);
          if (pos) this.animateCardToDiscard(pos.x, pos.y);
        }
      }

      // Animate newly drawn cards from the deck pile to hand
      const newCards = new Set(
        this.gameState.mandateDeck.hand
          .filter(c => !handBefore.has(c.instanceId))
          .map(c => c.instanceId)
      );
      this.animateDrawToHand(newCards);
    }
  }

  private refreshAll(): void {
    this.gameState.ship = updateShipPresence(this.gameState.ship);
    this.gameState.globalFactionPresence = calculateGlobalPresence(this.gameState.ship);
    (this as any).__restartData = { newGame: false, savedState: this.gameState };

    this.resourceBar.update(this.gameState.resources);
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

    // Entropy gauge
    this.entropyGauge.setValue(this.gameState.entropy);

    // Era display
    this.eraDisplay.update(this.gameState.era, this.gameState.eraModifiers);
  }

  /**
   * Animate card-back ghosts from the player deck pile to the hand positions
   * for newly drawn cards.
   */
  private animateDrawToHand(newCardIds: Set<string>): void {
    if (newCardIds.size === 0) return;

    const positions = this.handDisplay.getCardWorldPositions();
    this.handDisplay.setCardsVisible(newCardIds, false);

    let idx = 0;
    for (const id of newCardIds) {
      const target = positions.get(id);
      if (!target) continue;

      const ghost = this.add.image(this.playerDeckPileX, this.playerDeckPileY, "card-back");
      ghost.setScale(0.45);
      ghost.setDepth(200);

      const delay = idx * 80;
      this.tweens.add({
        targets: ghost,
        x: target.x,
        y: target.y,
        scaleX: 1,
        scaleY: 1,
        duration: 350,
        delay,
        ease: "Power2",
        onComplete: () => {
          ghost.destroy();
          this.handDisplay.setCardsVisible(new Set([id]), true);
        },
      });
      idx++;
    }
  }

  private showMessage(msg: string, color?: string): void {
    this.messagePanel.addMessage(msg, color);
  }
}
