import Phaser from "phaser";
import type { GameState, Card, CardInstance, MarketRowId, ResourceCost } from "@icebox/shared";
import { MARKET_SLOTS, MARKET_SLOTS_PER_ROW, NUM, HEX, FACTIONS, getAllMarketSlots, getMarketRowById, canAfford, gainResources, spendResources } from "@icebox/shared";
import { createNewGameState } from "../systems/GameStateManager";
import { ShipRenderer } from "../ship/ShipRenderer";
import type { SectionId } from "../ship/ShipTypes";
import { ShipControls, loadDefaults, DEFAULT_CAMERA, DEFAULT_ORIENTATION } from "../ship/ShipControls";
import { generateShip } from "../ship/ShipGenerator";

import { startTurn, executeAction, type PlayerAction } from "../systems/TurnManager";
import { getCostModifier, getExtraSlideCount, isSlotLocked } from "../systems/effects/PassiveScanner";
import { compactMarket, slideMarketNoRefill, fillMarket, investOnSlot } from "../systems/MarketManager";
import { resolveFallout } from "../systems/FalloutHandler";
import { updateShipPresence, calculateGlobalPresence } from "../systems/FactionTracker";
import { ResourceBar, type ResourceKey, drawResourceShape, RESOURCE_META } from "../game-objects/ResourceBar";
import { MarketSlot } from "../game-objects/MarketSlot";
import { HandDisplay } from "../ui/HandDisplay";
import { InfoPanel } from "../ui/InfoPanel";
import { PhaseIndicator } from "../ui/PhaseIndicator";
import { ActionLog } from "../ui/ActionLog";
import { MessagePanel } from "../ui/MessagePanel";
import { ConfirmPopup } from "../ui/ConfirmPopup";
import { CardSprite, CARD_WIDTH, CARD_HEIGHT } from "../game-objects/CardSprite";
import { EraDisplay } from "../ui/EraDisplay";
import { EraTheme } from "../ui/EraTheme";
import { BootScene } from "./BootScene";
import { SuccessionScene } from "./SuccessionScene";
import { MAIN_CX, LAYOUT, s, fontSize } from "../ui/layout";
import { ActionPool } from "../ui/ActionPool";
import { ScryDialog } from "../ui/ScryDialog";
import {
  extractResourceActions,
  resolveProgressBuilding,
  resolveTapCard,
  resolveScryMarket,
  resolveSwapMarket,
  peekMarketDeck,
  type PendingResourceActionGroup,
  type ResourceAction,
} from "../systems/ResourceActionManager";

export class ActiveWatchScene extends Phaser.Scene {
  static readonly KEY = "ActiveWatchScene";

  private gameState!: GameState;
  private cardDefs!: Card[];

  private resourceBar!: ResourceBar;
  private marketSlots: MarketSlot[] = [];
  private handDisplay!: HandDisplay;
  private infoPanel!: InfoPanel;
  private phaseIndicator!: PhaseIndicator;
  private actionLog!: ActionLog;
  private messagePanel!: MessagePanel;

  // ── Ship visualizer (background) ──
  private shipRenderer: ShipRenderer | null = null;
  private shipControls: ShipControls | null = null;

  // ── Hardpoint panel overlay ──
  private panelOverlay: HTMLDivElement | null = null;
  private svgOverlay: SVGSVGElement | null = null;
  private activeHardpointIdx = -1;
  private lockedHardpointIdx = -1;
  private hardpointPanel: HTMLDivElement | null = null;
  private hardpointLine: SVGLineElement | null = null;
  private panelCurrentX = 0;
  private panelCurrentY = 0;
  private panelVelocityX = 0;
  private panelVelocityY = 0;
  private readonly springStiffness = 8;
  private readonly springDamping = 0.55;
  /** True while a card drag is in progress (used to raycast hardpoint drop targets) */
  private isDraggingCard = false;
  private draggingCardId: string | null = null;
  /** Always-on hardpoint labels (card name when occupied) */
  private hardpointLabels: HTMLDivElement[] = [];

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

  // ── Action Pool (persistent resource action tokens) ──
  private actionPool!: ActionPool;
  /** Swap mode state for influence action */
  private swapMode: { row: MarketRowId; col: number } | null = null;

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
    // Reset arrays and flags (Phaser reuses scene instances on restart)
    this.marketSlots = [];
    this.marketColPositions = [];
    this.purchaseMode = null;
    this.endTurnAnimating = false;
    this.swapMode = null;
    this.pendingSwapActivation = false;
    this.activeHardpointIdx = -1;
    this.lockedHardpointIdx = -1;
    this.isDraggingCard = false;
    this.draggingCardId = null;

    // Disable browser right-click menu for right-click interactions
    this.input.mouse?.disableContextMenu();

    // ─── Ship background (Three.js behind Phaser canvas) ───
    this.initShipBackground();

    // ─── END button (standalone, positioned right of market deck) ───
    const marketDeckX = MAIN_CX + 2.5 * LAYOUT.marketColSpacing + s(55) + s(70);
    const marketDeckY = (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2;
    const endBtnX = marketDeckX + s(120);
    const endBtnY = marketDeckY;
    this.createEndButton(endBtnX, endBtnY);

    // ─── Action log (left gutter) ───
    this.actionLog = new ActionLog(this);

    // ─── Era environmental theme ───
    this.eraTheme = new EraTheme(this);
    this.eraTheme.applyTheme(this.gameState.era);

    // ─── Right gutter: Deck count + Info panel ───
    // Deck/discard counts shown on the pile visuals instead

    this.infoPanel = new InfoPanel(this);

    // ─── Main area ───
    this.createMarket();

    // ─── Left of market: Era display ───
    const marketTopY = LAYOUT.marketRow1Y - s(30);
    this.eraDisplay = new EraDisplay(this, 0, 0);
    this.eraDisplay.setPosition(this.marketBoxLeft - this.eraDisplay.boxW - s(12), marketTopY);

    // ─── Phase indicator — bounded box above era display ───
    this.phaseIndicator = new PhaseIndicator(
      this,
      this.eraDisplay.x,
      this.eraDisplay.y - s(64),
      this.eraDisplay.boxW
    );

    this.resourceBar = new ResourceBar(this, MAIN_CX, LAYOUT.resourceY);
    this.wireResourceBarDrag();
    this.createPlayerPiles();

    // ─── Hand ───
    this.handDisplay = new HandDisplay(this, MAIN_CX, LAYOUT.handY, LAYOUT.handTuckOffset);
    this.wireHandCallbacks();

    this.messagePanel = new MessagePanel(this);

    // ─── Action Pool (below era display) ───
    this.actionPool = new ActionPool(
      this,
      this.eraDisplay.x,
      this.eraDisplay.y + this.eraDisplay.boxH + s(8),
      this.eraDisplay.boxW
    );
    this.actionPool.onActionClicked = (key) => this.handleActionPoolClick(key);

    // ─── Cancel purchase mode on click on empty space ───
    this.input.on("pointerdown", (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      // Cancel pending swap activation on empty-space click
      if (this.pendingSwapActivation && currentlyOver.length === 0) {
        this.pendingSwapActivation = false;
        this.showMessage("Swap cancelled.");
      }
      // Cancel swap mode on empty-space click
      if (this.swapMode && currentlyOver.length === 0) {
        this.swapMode = null;
        for (let fi = 0; fi < MARKET_SLOTS; fi++) {
          this.marketSlots[fi]?.setPurchaseHighlight(null);
        }
        this.showMessage("Swap cancelled.");
      }
      if (!this.purchaseMode) return;
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

  update(): void {
    if (this.shipControls && this.shipRenderer) {
      this.shipControls.update(this.shipRenderer.camera);
      this.shipRenderer.update();
      this.updateHardpointTracking();
      this.updateHardpointLabels();
    }
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
      badge.fillStyle(NUM.concrete, 0.7);
      badge.fillCircle(colX, badgeY, badgeR);
      badge.lineStyle(s(1.5), NUM.graphite, 0.8);
      badge.strokeCircle(colX, badgeY, badgeR);
      badge.setDepth(9);
      const colNumText = this.add.text(colX, badgeY, `${col}`, {
        fontSize: fontSize(11), color: HEX.bone, fontFamily: "'Orbitron', monospace", fontStyle: "bold",
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
    gfx.fillStyle(NUM.slab, 0.3);
    gfx.fillRoundedRect(boxLeft, boxTop, boxW, boxH, s(6));
    gfx.lineStyle(s(1.5), NUM.graphite, 0.5);
    gfx.strokeRoundedRect(boxLeft, boxTop, boxW, boxH, s(6));

    // Row divider — horizontal line between upper and lower rows
    const rowDivY = (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2;
    gfx.lineStyle(s(1), NUM.graphite, 0.3);
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
    const deckX = cx + 2.5 * cs + boxPadX + s(70);
    const deckY = (LAYOUT.marketRow1Y + LAYOUT.marketRow2Y) / 2;
    this.deckPileX = deckX;
    this.deckPileY = deckY;

    // Stacked card-backs for deck (offset card behind for depth)
    const worldDeckScale = 0.85;
    const worldBackShadow = this.add.image(deckX + s(3), deckY + s(2), "card-back");
    worldBackShadow.setDisplaySize(CARD_WIDTH * worldDeckScale, s(170) * worldDeckScale);
    worldBackShadow.setAlpha(0.5);
    const worldBack = this.add.image(deckX, deckY, "card-back");
    worldBack.setDisplaySize(CARD_WIDTH * worldDeckScale, s(170) * worldDeckScale);
    // Count text below the card
    this.worldDeckCountText = this.add.text(deckX, deckY + s(82), "", {
      fontSize: fontSize(9), color: HEX.abyss, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);

    // Click on world deck pile → scry action (data)
    const deckHitArea = this.add.rectangle(deckX, deckY, s(80), s(110), 0x000000, 0);
    deckHitArea.setInteractive({ useHandCursor: true });
    deckHitArea.on("pointerdown", () => {
      if (this.gameState.availableActions.data > 0) {
        this.useScryMarket();
      }
    });
  }

  private wireMarketSlotInteractions(slot: MarketSlot, slotIndex: number, row: MarketRowId): void {
    if (!slot.cardSprite) return;

    // Click to buy, enter purchase mode, swap (influence action), or withdraw investment
    slot.cardSprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0) return;
      if (!slot.cardSprite) return;

      // In swap mode (influence action): handle second click
      if (this.swapMode) {
        this.handleSwapClick(row, slotIndex);
        return;
      }

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

      // Influence swap: activated from ActionPool, first click selects source
      if (this.pendingSwapActivation && this.gameState.availableActions.influence > 0) {
        this.pendingSwapActivation = false;
        this.swapMode = { row, col: slotIndex };
        this.showMessage("Now click an adjacent card to swap with.");
        this.highlightSwapTargets(row, slotIndex);
        return;
      }

      // Buy lock: cannot buy a card invested in this turn
      const slotKey = `${row}-${slotIndex}`;
      if (this.gameState.turnInvestments.includes(slotKey)) {
        this.showMessage("Cannot buy a card you invested in this turn.", "#cc4444");
        return;
      }

      // Check if slot is locked by a passive effect
      if (isSlotLocked(this.gameState, row, slotIndex)) {
        this.showMessage("This slot is locked.", "#cc4444");
        return;
      }

      // Check if card is reachable (all preceding columns have cards)
      if (!this.isSlotPurchasable(slotIndex)) {
        this.showMessage("Can't buy — an empty column blocks this card.", "#cc4444");
        return;
      }

      if (slotIndex === 0) {
        // Column 0 is free — but crisis cards need confirmation + additional cost
        const isCrisis = slot.cardSprite.cardInstance.card.type === "crisis";
        if (isCrisis) {
          const pc = slot.cardSprite.cardInstance.card.crisis?.proactiveCost ?? {};
          const canPayCrisis = canAfford(this.gameState.resources, pc);
          const costParts: string[] = [];
          if (pc.matter) costParts.push(`M:${pc.matter}`);
          if (pc.energy) costParts.push(`E:${pc.energy}`);
          if (pc.data) costParts.push(`D:${pc.data}`);
          if (pc.influence) costParts.push(`I:${pc.influence}`);
          const costStr = costParts.length > 0 ? costParts.join(" ") : "Free";

          if (!canPayCrisis) {
            this.showMessage(`Cannot afford crisis resolution cost (${costStr}).`, "#cc4444");
            return;
          }

          new ConfirmPopup(
            this, MAIN_CX, LAYOUT.resourceY,
            `Resolve crisis?\nCost: ${costStr}\nThis triggers cryosleep.`,
            () => {
              this.gameState.resources = spendResources(this.gameState.resources, pc);
              this.animateBuyToDiscard(row, slotIndex);
              this.doAction({ type: "buy-from-market", row, slotIndex, payment: {} });
            }
          );
        } else {
          this.animateBuyToDiscard(row, slotIndex);
          this.doAction({ type: "buy-from-market", row, slotIndex, payment: {} });
        }
      } else {
        this.enterPurchaseMode(row, slotIndex);
      }
    });

    slot.cardSprite.on("pointerover", () => {
      if (!slot.cardSprite) return;

      // Show in InfoPanel
      this.infoPanel.showCard(slot.cardSprite.cardInstance);

      // Affordability check: positional cost = slotIndex (any resources)
      // But don't override the gap-blocked X
      if (!this.purchaseMode && this.isSlotPurchasable(slotIndex)) {
        const r = this.gameState.resources;
        const totalResources = r.matter + r.energy + r.data + r.influence;
        slot.cardSprite.setAffordable(totalResources >= slotIndex);
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
      // Only reset affordability if this card isn't blocked by an empty column gap
      if (slot.cardSprite && this.isSlotPurchasable(slotIndex)) {
        slot.cardSprite.setAffordable(true);
      }

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

  /**
   * Check if a market slot can be purchased: all preceding columns must have
   * at least one card (upper or lower row) so resources can be invested on them.
   */
  private isSlotPurchasable(targetSlotIndex: number): boolean {
    if (targetSlotIndex === 0) return true;
    const market = this.gameState.transitMarket;
    for (let i = 0; i < targetSlotIndex; i++) {
      const upperHas = !!getMarketRowById(market, "upper").slots[i];
      const lowerHas = !!getMarketRowById(market, "lower").slots[i];
      if (!upperHas && !lowerHas) return false;
    }
    return true;
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
      // Build the payment from investments placed this session
      const payment: ResourceCost = { matter: 0, energy: 0, data: 0, influence: 0 };
      for (const [, entry] of investments) {
        payment.matter = (payment.matter ?? 0) + (entry.resource.matter ?? 0);
        payment.energy = (payment.energy ?? 0) + (entry.resource.energy ?? 0);
        payment.data = (payment.data ?? 0) + (entry.resource.data ?? 0);
        payment.influence = (payment.influence ?? 0) + (entry.resource.influence ?? 0);
      }

      const completePurchase = () => {
        // Commit all pending investments to market state and track for turn
        for (const [col, entry] of this.purchaseMode!.investments) {
          const updated = investOnSlot(this.gameState.transitMarket, entry.row, col, entry.resource);
          if (updated) this.gameState.transitMarket = updated;
          const slotKey = `${entry.row}-${col}`;
          if (!this.gameState.turnInvestments.includes(slotKey)) {
            this.gameState.turnInvestments.push(slotKey);
          }
        }
        this.exitPurchaseMode(false);
        this.animateBuyToDiscard(row, targetSlotIndex);
        this.doAction({ type: "buy-from-market", row, slotIndex: targetSlotIndex, payment });
      };

      // Crisis cards: confirm before completing — player must also afford proactive cost
      const targetSlot = getMarketRowById(this.gameState.transitMarket, row).slots[targetSlotIndex];
      if (targetSlot?.card.type === "crisis") {
        const pc = targetSlot.card.crisis?.proactiveCost ?? {};
        const canPayCrisis = canAfford(this.gameState.resources, pc);
        const costParts: string[] = [];
        if (pc.matter) costParts.push(`M:${pc.matter}`);
        if (pc.energy) costParts.push(`E:${pc.energy}`);
        if (pc.data) costParts.push(`D:${pc.data}`);
        if (pc.influence) costParts.push(`I:${pc.influence}`);
        const costStr = costParts.length > 0 ? costParts.join(" ") : "Free";

        if (!canPayCrisis) {
          // Can't afford the crisis cost — refund and tell the player
          this.exitPurchaseMode(true);
          this.showMessage(`Cannot afford crisis resolution cost (${costStr}).`, "#cc4444");
          return;
        }

        new ConfirmPopup(
          this, MAIN_CX, LAYOUT.resourceY,
          `Resolve crisis?\nAdditional cost: ${costStr}\nThis triggers cryosleep.`,
          () => {
            this.gameState.resources = spendResources(this.gameState.resources, pc);
            completePurchase();
          },
          () => this.exitPurchaseMode(true) // No → refund investments
        );
        return;
      }

      completePurchase();
    } else {
      this.highlightPurchaseSlots();
    }
  }

  // ─── Resource Bar Drag ─────────────────────────────────────────────

  private wireResourceBarDrag(): void {
    // Disable ship camera controls while dragging resources
    this.resourceBar.onDragStart = () => {
      if (this.shipControls) this.shipControls.enabled = false;
    };
    this.resourceBar.onDragEnd = () => {
      if (this.shipControls) this.shipControls.enabled = true;
    };

    this.resourceBar.onResourceDropped = (resourceType: ResourceKey, worldX: number, worldY: number) => {
      // Hit-test: market slot?
      const slotHit = this.hitTestMarketSlot(worldX, worldY);

      if (slotHit && this.purchaseMode) {
        // In purchase mode: invest on preceding columns
        const { targetSlotIndex } = this.purchaseMode;
        const col = slotHit.slotIndex;

        if (col >= targetSlotIndex) {
          this.showMessage("Invest on the highlighted preceding slots");
          return;
        }

        if (this.purchaseMode.investments.has(col)) {
          this.showMessage("Already invested in this column — click the slot to withdraw first");
          return;
        }

        // Invest on the same row as the purchase target; only fall back to
        // the other row when the purchase row has no card in this column.
        const market = this.gameState.transitMarket;
        const purchaseRow = this.purchaseMode.row;
        const otherRow: MarketRowId = purchaseRow === "upper" ? "lower" : "upper";
        let investRow: MarketRowId | null = null;
        if (getMarketRowById(market, purchaseRow).slots[col]) {
          investRow = purchaseRow;
        } else if (getMarketRowById(market, otherRow).slots[col]) {
          investRow = otherRow;
        }
        if (!investRow) {
          this.showMessage("No card in this column to invest");
          return;
        }

        const resource: ResourceCost = { [resourceType]: 1 };
        if (!canAfford(this.gameState.resources, resource)) {
          this.showMessage("Cannot afford this investment.");
          return;
        }

        this.gameState.resources = gainResources(this.gameState.resources, { [resourceType]: -1 });
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

      this.showMessage("Drop on a market slot, hardpoint, or your deck");
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

  // ─── Ship Background & Hardpoint System ──────────────────────────

  private static readonly SECTION_TO_SECTOR: Record<string, number> = {
    engineering: 0, habitat: 1, command: 2,
  };
  private static readonly SECTOR_TO_SECTION: SectionId[] = [
    "engineering", "habitat", "command",
  ];
  private static readonly SECTION_LABELS: Record<string, string> = {
    asteroid: "ASTEROID CORE", engineering: "ENGINEERING",
    habitat: "HABITAT", command: "COMMAND",
  };

  /** Map a hardpoint index → game sector + slot */
  private getSlotForHardpoint(hpIdx: number): { sectorIndex: number; slotIndex: number } | null {
    if (!this.shipRenderer) return null;
    const hp = this.shipRenderer.hardpoints[hpIdx];
    if (!hp) return null;
    const sectorIndex = ActiveWatchScene.SECTION_TO_SECTOR[hp.sectionId];
    if (sectorIndex === undefined) return null;
    return { sectorIndex, slotIndex: hp.data.slotIndex };
  }

  /** Map a game sector + slot → hardpoint index */
  private getHardpointForSlot(sectorIndex: number, slotIndex: number): number {
    if (!this.shipRenderer) return -1;
    const section = ActiveWatchScene.SECTOR_TO_SECTION[sectorIndex];
    if (!section) return -1;
    return this.shipRenderer.hardpoints.findIndex(
      hp => hp.sectionId === section && hp.data.slotIndex === slotIndex
    );
  }

  private initShipBackground(): void {
    const container = this.game.canvas.parentElement;
    if (!container) return;

    // Ship canvas is inserted behind Phaser canvas via ShipRenderer backgroundMode

    // Create ship renderer behind Phaser canvas (z-index 0)
    this.shipRenderer = new ShipRenderer(container, { backgroundMode: true });
    // Ship is deterministic from gameState.seed — always produces the same ship for a given save
    const seed = this.gameState.seed!;
    const shipGeometry = generateShip({ seed });
    this.shipRenderer.buildGeometry(shipGeometry);

    // Apply saved defaults (async)
    loadDefaults().then((defaults) => {
      if (!this.shipRenderer || !container) return;

      this.shipRenderer.orientation.rotX = defaults.orientation.rotX;
      this.shipRenderer.orientation.rotY = defaults.orientation.rotY;
      this.shipRenderer.orientation.rotZ = defaults.orientation.rotZ;
      this.shipRenderer.hoverMode = defaults.hoverMode;
      this.shipRenderer.enginePower = defaults.enginePower;
      this.shipRenderer.starDriftSpeed = defaults.starDriftSpeed;
      this.shipRenderer.applyHoverMode();

      // Camera controls — bind to the PHASER canvas (which is on top and receives events)
      // instead of the ship canvas (which has pointer-events: none)
      this.shipControls = new ShipControls(this.game.canvas, defaults.camera);
      this.shipControls.bindShipOrientation(this.shipRenderer.orientation);
      this.shipControls.bindShipPivot(this.shipRenderer.shipPivot);

      // Create hardpoint overlay system
      this.createPanelOverlay(container);
      this.bindShipPointerEvents();
    });

    this.events.once("shutdown", this.cleanupShip, this);
  }

  private createEndButton(x: number, y: number): void {
    const r = LAYOUT.playMatBtnRadius;
    const gfx = this.add.graphics();
    const drawNormal = () => {
      gfx.clear();
      gfx.fillStyle(NUM.slab, 0.85);
      gfx.fillCircle(0, 0, r);
      gfx.lineStyle(s(2), NUM.graphite, 0.7);
      gfx.strokeCircle(0, 0, r);
    };
    const drawHover = () => {
      gfx.clear();
      gfx.fillStyle(NUM.slab, 1);
      gfx.fillCircle(0, 0, r);
      gfx.lineStyle(s(2), NUM.bone, 0.9);
      gfx.strokeCircle(0, 0, r);
    };
    drawNormal();

    const btnFontSize = s(12);
    const normalLabel = this.add.text(0, 0, "END", {
      fontSize: `${btnFontSize}px`, color: HEX.bone, fontFamily: "'Orbitron', monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    const hoverLabel = this.add.text(0, 0, "END", {
      fontSize: `${btnFontSize}px`, color: "#ffffff", fontFamily: "'Orbitron', monospace", fontStyle: "bold",
    }).setOrigin(0.5);
    hoverLabel.setVisible(false);

    const hitArea = this.add.circle(0, 0, r, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerover", () => { drawHover(); normalLabel.setVisible(false); hoverLabel.setVisible(true); });
    hitArea.on("pointerout", () => { drawNormal(); normalLabel.setVisible(true); hoverLabel.setVisible(false); });
    hitArea.on("pointerdown", () => this.animatedEndTurn());

    const container = this.add.container(x, y, [gfx, normalLabel, hoverLabel, hitArea]);
    container.setDepth(50);
  }

  // ── Hardpoint Panel Overlay ──

  /** Container for always-on hardpoint labels (low z-index, under panels) */
  private labelOverlay: HTMLDivElement | null = null;

  private createPanelOverlay(container: HTMLElement): void {
    // Label overlay — sits above the 3D ship (z-index:-2) but below
    // the Phaser canvas (position:static, paints at z-index:0 layer)
    const labels = document.createElement("div");
    labels.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: -1;
    `;
    container.appendChild(labels);
    this.labelOverlay = labels;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 3;
    `;
    container.appendChild(svg);
    this.svgOverlay = svg;

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 4;
    `;
    container.appendChild(overlay);
    this.panelOverlay = overlay;
  }

  private showHardpointPanel(hpIdx: number): void {
    if (!this.shipRenderer || !this.panelOverlay || !this.svgOverlay) return;
    const hp = this.shipRenderer.hardpoints[hpIdx];
    if (!hp) return;

    this.removeHardpointElements();
    this.activeHardpointIdx = hpIdx;

    // SVG connecting line
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", HEX.void);
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("opacity", "0.9");
    this.svgOverlay.appendChild(line);
    this.hardpointLine = line;

    const sectionLabel = ActiveWatchScene.SECTION_LABELS[hp.sectionId] || hp.sectionId.toUpperCase();
    const hoverColor = hp.sectionId === "engineering" ? HEX.signalRed
      : hp.sectionId === "habitat" ? HEX.teal
      : hp.sectionId === "command" ? HEX.chartreuse
      : HEX.concrete;

    // Each hardpoint represents one slot — show only that slot
    const sectorIndex = ActiveWatchScene.SECTION_TO_SECTOR[hp.sectionId];
    const sector = sectorIndex !== undefined ? this.gameState.ship.sectors[sectorIndex] : null;
    const isLocked = this.lockedHardpointIdx === hpIdx;
    const slotIdx = hp.data.slotIndex;
    const card = sector?.installedCards[slotIdx];

    // ── Build card-proportioned slot HTML ──
    // Card dimensions scaled to match Phaser cards
    const slotW = s(100);
    const slotH = s(140);
    const notchW = Math.round(slotW * 0.35);
    const notchH = s(6);
    const cornerR = s(6);
    const innerPad = s(6);

    // SVG card-shaped clip path with top-center notch indent
    const slotSvgOutline = (color: string, dashed: boolean) => {
      const sw = slotW;
      const sh = slotH;
      const nx = (sw - notchW) / 2;
      const nr = Math.min(notchH, 4);
      const cr = cornerR;
      // Path: starts top-left, goes right to notch, dips notch, continues to top-right, down, around
      const d = [
        `M ${cr} 0`,
        `L ${nx} 0`,
        `L ${nx} ${notchH - nr}`,
        `Q ${nx} ${notchH} ${nx + nr} ${notchH}`,
        `L ${nx + notchW - nr} ${notchH}`,
        `Q ${nx + notchW} ${notchH} ${nx + notchW} ${notchH - nr}`,
        `L ${nx + notchW} 0`,
        `L ${sw - cr} 0`,
        `Q ${sw} 0 ${sw} ${cr}`,
        `L ${sw} ${sh - cr}`,
        `Q ${sw} ${sh} ${sw - cr} ${sh}`,
        `L ${cr} ${sh}`,
        `Q 0 ${sh} 0 ${sh - cr}`,
        `L 0 ${cr}`,
        `Q 0 0 ${cr} 0`,
      ].join(" ");
      const strokeDash = dashed ? `stroke-dasharray="4 3"` : "";
      return `<svg width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" style="position:absolute;top:0;left:0;">
        <path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" ${strokeDash} opacity="0.8"/>
      </svg>`;
    };

    let slotHtml: string;
    if (card) {
      const statusLine = card.underConstruction
        ? `<div style="color: ${HEX.chartreuse}; font-size: ${s(8)}px; margin-top: ${s(4)}px;">⚒ ${card.constructionProgress ?? 0}/${card.card.construction?.completionTime ?? "?"}</div>`
        : card.tapped
          ? `<div style="color: ${HEX.concrete}; font-size: ${s(8)}px; margin-top: ${s(4)}px;">TAPPED</div>`
          : "";
      const attachedCrew = sector?.installedCards.filter(c => c.card.type === "crew" && c.attachedTo === card.instanceId) ?? [];
      const crewPips = attachedCrew.length > 0
        ? `<div style="display: flex; gap: ${s(3)}px; margin-top: ${s(4)}px;">${attachedCrew.map(() => `<div style="width: ${s(6)}px; height: ${s(6)}px; border-radius: 50%; background: ${HEX.teal};"></div>`).join("")}</div>`
        : "";
      // Faction color for inner panel (matches card texture style)
      const factionColor = card.card.faction
        ? this.getFactionColor(card.card.faction)
        : HEX.concrete;
      slotHtml = `
        <div class="hp-slot" data-slot="${slotIdx}" style="
          position: relative; width: ${slotW}px; height: ${slotH}px;
          background: ${HEX.warmGray}30; border-radius: ${cornerR}px;
          overflow: hidden;
        ">
          ${slotSvgOutline(hoverColor, false)}
          <div style="
            position: absolute; top: ${notchH + innerPad}px; left: ${innerPad}px;
            right: ${innerPad}px; bottom: ${innerPad}px;
            background: ${factionColor}18; border-radius: ${s(4)}px;
            padding: ${s(6)}px; display: flex; flex-direction: column;
          ">
            <div style="color: ${HEX.bone}; font-family: 'Orbitron', sans-serif; font-size: ${s(9)}px; font-weight: bold; margin-bottom: ${s(3)}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.card.name}</div>
            <div style="color: ${HEX.teal}; font-family: 'Space Mono', monospace; font-size: ${s(7)}px; text-transform: uppercase; letter-spacing: 0.5px;">[${card.card.type.toUpperCase()}]</div>
            ${statusLine}
            ${crewPips}
            <div style="flex: 1;"></div>
            <div style="display: flex; gap: ${s(2)}px; opacity: 0.3; justify-content: flex-end;">
              ${Array.from({length: 6}, () => `<div style="width: 1px; height: ${s(10)}px; background: ${HEX.graphite};"></div>`).join("")}
            </div>
          </div>
        </div>`;
    } else {
      // Empty slot — card-shaped placeholder with notch, dashed outline
      slotHtml = `
        <div class="hp-slot" data-slot="${slotIdx}" style="
          position: relative; width: ${slotW}px; height: ${slotH}px;
          background: ${HEX.warmGray}08; border-radius: ${cornerR}px;
        ">
          ${slotSvgOutline(hoverColor, true)}
          <div style="
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: ${s(6)}px;
          ">
            <svg width="${s(24)}" height="${s(24)}" viewBox="0 0 24 24" opacity="0.3">
              <path d="M12 2 L14 10 L22 10 L16 14 L18 22 L12 18 L6 22 L8 14 L2 10 L10 10 Z" fill="none" stroke="${hoverColor}" stroke-width="1"/>
            </svg>
            <div style="color: ${HEX.concrete}; font-family: 'Space Mono', monospace; font-size: ${s(7)}px; letter-spacing: 1px; opacity: 0.6;">EMPTY SLOT</div>
          </div>
        </div>`;
    }

    const panel = document.createElement("div");
    panel.style.cssText = `
      position: absolute; pointer-events: none;
      background: rgba(22, 22, 24, 0.93); border: 1px solid ${HEX.graphite};
      border-top: 2px solid ${hoverColor};
      padding: ${s(8)}px ${s(10)}px ${s(10)}px;
      font-family: 'Space Mono', monospace;
      font-size: ${s(11)}px; color: ${HEX.bone};
      transform-origin: left center; transform: scale(0);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    panel.innerHTML = `
      <div style="margin-bottom: ${s(4)}px;">
        <span style="color: ${hoverColor}; font-family: 'Orbitron', sans-serif; font-size: ${s(8)}px; font-weight: bold; letter-spacing: 0.5px;">${sectionLabel} · SLOT ${slotIdx + 1}</span>
      </div>
      ${slotHtml}
    `;

    // Enable pointer events on panel when locked (for card interactions)
    if (isLocked && sectorIndex !== undefined && card) {
      panel.style.pointerEvents = "auto";
      panel.style.cursor = "default";
      const slotEl = panel.querySelector(".hp-slot") as HTMLElement | null;
      if (slotEl) {
        slotEl.style.cursor = "pointer";
        slotEl.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          new ConfirmPopup(
            this, MAIN_CX, LAYOUT.resourceY,
            "Scrap this structure?",
            () => this.doAction({ type: "scrap-structure", instanceId: card!.instanceId, sectorIndex: sectorIndex! })
          );
        });
        slotEl.addEventListener("click", () => {
          if (card!.underConstruction) {
            if (this.gameState.availableActions.matter > 0) {
              new ConfirmPopup(this, MAIN_CX, LAYOUT.resourceY,
                `Use Build action to\nprogress ${card!.card.name}?`,
                () => this.useProgressBuilding(card!.instanceId));
            } else {
              const con = card!.card.construction;
              if (con?.fastTrackable) {
                const ftCost = con.fastTrackCost ?? {};
                const costParts: string[] = [];
                if (ftCost.matter) costParts.push(`M:${ftCost.matter}`);
                if (ftCost.energy) costParts.push(`E:${ftCost.energy}`);
                if (ftCost.data) costParts.push(`D:${ftCost.data}`);
                if (ftCost.influence) costParts.push(`I:${ftCost.influence}`);
                const costStr = costParts.length > 0 ? costParts.join(" ") : "Free";
                new ConfirmPopup(this, MAIN_CX, LAYOUT.resourceY,
                  `Fast-track 1 turn? (${costStr})`,
                  () => this.doAction({ type: "fast-track", structureInstanceId: card!.instanceId, turnsToSkip: 1 }));
              }
            }
          } else if (
            this.gameState.availableActions.energy > 0 &&
            !card!.tapped && card!.card.tapEffect
          ) {
            new ConfirmPopup(this, MAIN_CX, LAYOUT.resourceY,
              `Tap ${card!.card.name}?\n${card!.card.tapEffect.description}`,
              () => this.useTapCard(card!.instanceId));
          } else {
            this.infoPanel.showCard(card!);
          }
        });
      }
    }

    this.panelOverlay.appendChild(panel);
    this.hardpointPanel = panel;

    // Initialize spring position
    const canvasW = this.shipRenderer.canvas.clientWidth;
    const canvasH = this.shipRenderer.canvas.clientHeight;
    const initPos = this.shipRenderer.projectHardpoint(hpIdx, canvasW, canvasH);
    if (initPos) {
      // Clamp initial position to the allowed panel zone
      const zoneLeft = s(140);
      const zoneTop = s(388);
      const zoneRight = canvasW - s(180);
      const zoneBottom = s(575);
      this.panelCurrentX = Math.max(zoneLeft, Math.min(zoneRight - 150, initPos.x + 100));
      this.panelCurrentY = Math.max(zoneTop, Math.min(zoneBottom - 130, initPos.y - 40));
    }
    this.panelVelocityX = 0;
    this.panelVelocityY = 0;

    requestAnimationFrame(() => { panel.style.transform = "scale(1)"; });
  }

  private hideHardpointPanel(): void {
    if (this.hardpointPanel) {
      const panel = this.hardpointPanel;
      panel.style.transform = "scale(0)";
      panel.style.transition = "transform 0.15s cubic-bezier(0.55, 0.085, 0.68, 0.53)";
      setTimeout(() => this.removeHardpointElements(), 160);
    } else {
      this.removeHardpointElements();
    }
    this.activeHardpointIdx = -1;
  }

  private removeHardpointElements(): void {
    if (this.hardpointLine) { this.hardpointLine.remove(); this.hardpointLine = null; }
    if (this.hardpointPanel) { this.hardpointPanel.remove(); this.hardpointPanel = null; }
  }

  private updateHardpointTracking(): void {
    if (!this.shipRenderer) return;
    const idx = this.activeHardpointIdx;
    if (idx < 0 || !this.hardpointPanel || !this.hardpointLine) return;

    const canvasW = this.shipRenderer.canvas.clientWidth;
    const canvasH = this.shipRenderer.canvas.clientHeight;
    const pos = this.shipRenderer.projectHardpoint(idx, canvasW, canvasH);

    if (!pos || pos.x < -50 || pos.x > canvasW + 50 || pos.y < -50 || pos.y > canvasH + 50) {
      if (this.lockedHardpointIdx === idx) this.lockedHardpointIdx = -1;
      this.hideHardpointPanel();
      return;
    }

    // Zone where panels are allowed (avoids overlapping market, hand, deck, discard)
    const panelW = this.hardpointPanel.offsetWidth || 140;
    const panelH = this.hardpointPanel.offsetHeight || 120;
    const zoneLeft = s(140);
    const zoneTop = s(388);
    const zoneRight = canvasW - s(180);
    const zoneBottom = s(575);

    // Clamp the spring target itself so the spring moves toward a valid position
    const targetX = Math.max(zoneLeft, Math.min(zoneRight - panelW, pos.x + 100));
    const targetY = Math.max(zoneTop, Math.min(zoneBottom - panelH, pos.y - 20));
    const dt = 1 / 60;
    const dx = targetX - this.panelCurrentX;
    const dy = targetY - this.panelCurrentY;
    const ax = dx * this.springStiffness - this.panelVelocityX * this.springDamping;
    const ay = dy * this.springStiffness - this.panelVelocityY * this.springDamping;
    this.panelVelocityX += ax;
    this.panelVelocityY += ay;
    this.panelCurrentX += this.panelVelocityX * dt;
    this.panelCurrentY += this.panelVelocityY * dt;

    // Hard clamp to zone bounds
    const clampedX = Math.max(zoneLeft, Math.min(zoneRight - panelW, this.panelCurrentX));
    const clampedY = Math.max(zoneTop, Math.min(zoneBottom - panelH, this.panelCurrentY));
    if (clampedX !== this.panelCurrentX) { this.panelCurrentX = clampedX; this.panelVelocityX = 0; }
    if (clampedY !== this.panelCurrentY) { this.panelCurrentY = clampedY; this.panelVelocityY = 0; }

    this.hardpointPanel.style.left = `${this.panelCurrentX}px`;
    this.hardpointPanel.style.top = `${this.panelCurrentY}px`;
    this.hardpointLine.setAttribute("x1", String(pos.x));
    this.hardpointLine.setAttribute("y1", String(pos.y));
    this.hardpointLine.setAttribute("x2", String(this.panelCurrentX));
    this.hardpointLine.setAttribute("y2", String(this.panelCurrentY + 15));
  }

  /**
   * Sync hardpoint 3D marker visuals and always-on labels with game state.
   * Called from refreshAll() whenever game state changes.
   */
  private syncHardpointOccupancy(): void {
    if (!this.shipRenderer || !this.labelOverlay) return;

    // Clear old labels
    for (const lbl of this.hardpointLabels) lbl.remove();
    this.hardpointLabels = [];

    for (let i = 0; i < this.shipRenderer.hardpoints.length; i++) {
      const hp = this.shipRenderer.hardpoints[i];
      const sectorIdx = ActiveWatchScene.SECTION_TO_SECTOR[hp.sectionId];
      if (sectorIdx === undefined) {
        this.shipRenderer.setHardpointOccupied(i, false);
        continue;
      }
      const sector = this.gameState.ship.sectors[sectorIdx];
      const card = sector?.installedCards[hp.data.slotIndex];

      if (card) {
        this.shipRenderer.setHardpointOccupied(i, true);

        // Create always-on label
        const label = document.createElement("div");
        label.dataset.hpIdx = String(i);
        label.style.cssText = `
          position: absolute; pointer-events: none;
          font-family: 'Space Mono', monospace; font-size: ${s(7)}px;
          color: ${HEX.bone}; background: ${HEX.void}cc;
          padding: ${s(1)}px ${s(4)}px; border-radius: ${s(2)}px;
          white-space: nowrap; transform: translate(-50%, 0);
          letter-spacing: 0.5px; opacity: 0.85;
          border-bottom: 1px solid ${this.getFactionColor(card.card.faction ?? "")}60;
        `;
        label.textContent = card.card.name;
        this.labelOverlay.appendChild(label);
        this.hardpointLabels.push(label);
      } else {
        this.shipRenderer.setHardpointOccupied(i, false);
      }
    }
  }

  /** Update positions of always-on hardpoint labels (called per frame) */
  private updateHardpointLabels(): void {
    if (!this.shipRenderer || this.hardpointLabels.length === 0) return;
    const canvasW = this.shipRenderer.canvas.clientWidth;
    const canvasH = this.shipRenderer.canvas.clientHeight;

    for (const label of this.hardpointLabels) {
      const idx = parseInt(label.dataset.hpIdx ?? "-1", 10);
      if (idx < 0) continue;
      const pos = this.shipRenderer.projectHardpoint(idx, canvasW, canvasH);
      if (!pos || pos.x < -50 || pos.x > canvasW + 50 || pos.y < -50 || pos.y > canvasH + 50) {
        label.style.display = "none";
      } else {
        label.style.display = "";
        label.style.left = `${pos.x}px`;
        label.style.top = `${pos.y + s(12)}px`;
      }
    }
  }

  // ── Ship Pointer Events (Phaser → Three.js raycasting) ──

  private bindShipPointerEvents(): void {
    if (!this.shipRenderer) return;
    const renderer = this.shipRenderer;

    // Hover: raycast on pointer move for hardpoint/section highlights
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!renderer) return;
      const canvasW = this.game.canvas.clientWidth;
      const canvasH = this.game.canvas.clientHeight;
      const ndcX = (pointer.x / canvasW) * 2 - 1;
      const ndcY = -(pointer.y / canvasH) * 2 + 1;
      const { sectionIdx, hardpointIdx } = renderer.raycast(ndcX, ndcY);

      renderer.highlightSection(sectionIdx);

      if (this.isDraggingCard) {
        // During drag, highlight the hovered hardpoint as potential drop target
        renderer.highlightHardpoint(hardpointIdx);
        // Show/hide hardpoint panel as the dragged card approaches a hardpoint
        if (hardpointIdx >= 0 && hardpointIdx !== this.activeHardpointIdx) {
          this.showHardpointPanel(hardpointIdx);
        } else if (hardpointIdx < 0 && this.activeHardpointIdx >= 0) {
          this.hideHardpointPanel();
        }
        return;
      }

      // Normal hover (not dragging)
      if (this.lockedHardpointIdx < 0) {
        if (hardpointIdx !== this.activeHardpointIdx) {
          if (hardpointIdx >= 0) {
            this.showHardpointPanel(hardpointIdx);
          } else {
            this.hideHardpointPanel();
          }
        }
        renderer.highlightHardpoint(hardpointIdx);
      } else {
        renderer.highlightHardpoint(hardpointIdx >= 0 ? hardpointIdx : this.lockedHardpointIdx);
      }
    });

    // Click: lock/unlock hardpoint panels (only when not hitting Phaser objects)
    this.input.on("pointerdown", (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (currentlyOver.length > 0) return; // Phaser object was clicked
      if (!renderer) return;

      const canvasW = this.game.canvas.clientWidth;
      const canvasH = this.game.canvas.clientHeight;
      const ndcX = (_pointer.x / canvasW) * 2 - 1;
      const ndcY = -(_pointer.y / canvasH) * 2 + 1;
      const { hardpointIdx } = renderer.raycast(ndcX, ndcY);

      if (hardpointIdx >= 0) {
        if (this.lockedHardpointIdx === hardpointIdx) {
          // Unlock — animate back to neutral
          this.lockedHardpointIdx = -1;
          this.hideHardpointPanel();
          if (this.shipControls) {
            this.shipControls.animateTo(0, 0, 500);
          }
        } else {
          // Lock — animate camera toward hardpoint
          this.lockedHardpointIdx = hardpointIdx;
          this.showHardpointPanel(hardpointIdx);
          this.animateCameraToHardpoint(hardpointIdx);
        }
      } else if (this.lockedHardpointIdx >= 0) {
        // Clicked empty space while a hardpoint was locked — unlock
        this.lockedHardpointIdx = -1;
        this.hideHardpointPanel();
        if (this.shipControls) {
          this.shipControls.animateTo(0, 0, 500);
        }
      }
    });
  }

  /** Animate the ship camera to bring a hardpoint closer and more centered */
  private animateCameraToHardpoint(hpIdx: number): void {
    if (!this.shipRenderer || !this.shipControls) return;

    const { azimuth, elevation, distance } = this.shipControls.params;

    // Compute zone center in NDC space so the hardpoint aims for the
    // center of the panel display area, not the viewport center.
    const canvasW = this.shipRenderer.canvas.clientWidth;
    const canvasH = this.shipRenderer.canvas.clientHeight;
    const zoneLeft = s(140);
    const zoneTop = s(388);
    const zoneRight = canvasW - s(180);
    const zoneBottom = s(575);
    const zoneCenterX = (zoneLeft + zoneRight) / 2;
    const zoneCenterY = (zoneTop + zoneBottom) / 2;
    // CSS pixels → NDC: x from -1..1 left to right, y from +1..-1 top to bottom
    const targetNdcX = (zoneCenterX / canvasW) * 2 - 1;
    const targetNdcY = -((zoneCenterY / canvasH) * 2 - 1);

    const result = this.shipRenderer.computeFocusRollAndDolly(
      hpIdx, azimuth, elevation, distance, targetNdcX, targetNdcY,
    );
    if (!result) return;

    this.shipControls.animateTo(result.dolly, result.roll, 600);
  }

  private getFactionColor(factionId: string): string {
    return FACTIONS[factionId]?.color ?? HEX.concrete;
  }

  private cleanupShip(): void {
    this.shipControls?.dispose();
    this.shipControls = null;
    this.shipRenderer?.dispose();
    this.shipRenderer = null;
    this.svgOverlay?.remove();
    this.svgOverlay = null;
    this.panelOverlay?.remove();
    this.panelOverlay = null;
    for (const lbl of this.hardpointLabels) lbl.remove();
    this.hardpointLabels = [];
    this.labelOverlay?.remove();
    this.labelOverlay = null;
    this.removeHardpointElements();
    this.activeHardpointIdx = -1;
    this.lockedHardpointIdx = -1;
    // (no Phaser canvas style changes to restore)
  }

  // ─── Player Deck & Discard Piles ─────────────────────────────────

  private createPlayerPiles(): void {
    const matCx = MAIN_CX;
    const matW = LAYOUT.playMatW;
    const playerPileScale = 0.65;
    const cardH = s(170) * playerPileScale;
    // Align pile tops with top of playmat
    const pileY = LAYOUT.playMatTop + cardH / 2 + s(20);

    // Player draw pile — right of play mat
    const deckX = matCx + matW / 2 + s(55);
    this.playerDeckPileX = deckX;
    this.playerDeckPileY = pileY;

    // Stacked card-backs for draw pile (offset card behind for depth)
    const playerBackShadow = this.add.image(deckX + s(2), pileY + s(1.5), "card-back");
    playerBackShadow.setDisplaySize(CARD_WIDTH * playerPileScale, cardH);
    playerBackShadow.setAlpha(0.5);
    const playerBack = this.add.image(deckX, pileY, "card-back");
    playerBack.setDisplaySize(CARD_WIDTH * playerPileScale, cardH);
    this.add.text(deckX, pileY - cardH / 2 - s(12), "DECK", {
      fontSize: fontSize(8), color: HEX.abyss, fontFamily: "'Orbitron', monospace",
    }).setOrigin(0.5);
    this.playerDeckCountText = this.add.text(deckX, pileY + cardH / 2 + s(10), "", {
      fontSize: fontSize(9), color: HEX.abyss, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);

    // Player discard pile — left of play mat
    const discardX = matCx - matW / 2 - s(55);
    this.playerDiscardPileX = discardX;
    this.playerDiscardPileY = pileY;

    // Stacked card-backs for discard pile (offset card behind for depth)
    const discardBackShadow = this.add.image(discardX + s(2), pileY + s(1.5), "card-back");
    discardBackShadow.setDisplaySize(CARD_WIDTH * playerPileScale, cardH);
    discardBackShadow.setAlpha(0.5);
    const discardBack = this.add.image(discardX, pileY, "card-back");
    discardBack.setDisplaySize(CARD_WIDTH * playerPileScale, cardH);
    this.add.text(discardX, pileY - cardH / 2 - s(12), "DISCARD", {
      fontSize: fontSize(8), color: HEX.abyss, fontFamily: "'Orbitron', monospace",
    }).setOrigin(0.5);
    this.playerDiscardCountText = this.add.text(discardX, pileY + cardH / 2 + s(10), "", {
      fontSize: fontSize(9), color: HEX.abyss, fontFamily: "'Space Mono', monospace",
    }).setOrigin(0.5);
  }

  // ─── Hand Callbacks ────────────────────────────────────────────────

  private wireHandCallbacks(): void {
    // Disable ship camera controls the moment the user presses on a hand card
    this.handDisplay.onCardPointerDown = () => {
      if (this.shipControls) this.shipControls.enabled = false;
    };
    this.handDisplay.onCardPointerUp = () => {
      if (!this.isDraggingCard && this.shipControls) this.shipControls.enabled = true;
    };

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
        this.showMessage("Drag to a hardpoint to install");
      } else if (type === "crew") {
        this.showMessage("Drag to a structure to attach crew");
      } else {
        this.doAction({ type: "play-card", instanceId });
      }
    };

    this.handDisplay.onDragStarted = (instanceId) => {
      this.isDraggingCard = true;
      this.draggingCardId = instanceId;
      // Disable ship spin/scroll while holding a card
      if (this.shipControls) this.shipControls.enabled = false;
      // Hide any open hardpoint panel so it doesn't block the drag
      this.lockedHardpointIdx = -1;
      this.hideHardpointPanel();
    };

    this.handDisplay.onDragEnded = () => {
      this.isDraggingCard = false;
      this.draggingCardId = null;
      // Re-enable ship camera controls
      if (this.shipControls) this.shipControls.enabled = true;
      // Clear all hardpoint highlights and close drag panels
      if (this.shipRenderer) this.shipRenderer.highlightHardpoint(-1);
      this.hideHardpointPanel();
    };

    this.handDisplay.onCardDropped = (instanceId, worldX, worldY) => {
      const card = this.gameState.mandateDeck.hand.find(c => c.instanceId === instanceId);
      if (!card) return;

      // Use the currently-highlighted hardpoint (from drag hover) or raycast as fallback
      const hpIdx = this.activeHardpointIdx >= 0
        ? this.activeHardpointIdx
        : this.raycastHardpointAtScreen(worldX, worldY);

      if (card.card.type === "crew") {
        // Crew: drop on a hardpoint's section, attach to first structure there
        if (hpIdx < 0) {
          this.showMessage("Drop crew on a ship hardpoint with structures");
          return;
        }
        const slot = this.getSlotForHardpoint(hpIdx);
        if (!slot) return;
        const sector = this.gameState.ship.sectors[slot.sectorIndex];
        const structures = sector.installedCards.filter(
          c => (c.card.type === "structure" || c.card.type === "institution") && !c.underConstruction
        );
        if (structures.length === 0) {
          this.showMessage("No completed structures in this section");
          return;
        }
        this.doAction({
          type: "attach-crew",
          crewInstanceId: instanceId,
          structureInstanceId: structures[0].instanceId,
          sectorIndex: slot.sectorIndex,
        });
        return;
      }

      const isStructureType = card.card.type === "structure" || card.card.type === "institution";

      // If a hardpoint is active and this is a structure card, use it directly
      if (isStructureType && hpIdx >= 0) {
        const slot = this.getSlotForHardpoint(hpIdx);
        if (slot) {
          this.doAction({ type: "slot-structure", instanceId, sectorIndex: slot.sectorIndex });
          return;
        }
      }

      const target = this.getDropTarget(worldX, worldY, isStructureType);
      if (!target) {
        if (isStructureType) {
          this.showMessage("Drag to a ship hardpoint to install");
        } else {
          this.showMessage("Drop on a valid target");
        }
        return;
      }

      if (target.type === "hardpoint") {
        this.doAction({ type: "slot-structure", instanceId, sectorIndex: target.sectorIndex });
      } else if (target.type === "play-zone") {
        this.doAction({ type: "play-card", instanceId });
      }
    };
  }

  /** Raycast from screen-space Phaser pointer coords to find a hardpoint */
  private raycastHardpointAtScreen(screenX: number, screenY: number): number {
    if (!this.shipRenderer) return -1;
    const canvasW = this.game.canvas.clientWidth;
    const canvasH = this.game.canvas.clientHeight;
    const ndcX = (screenX / canvasW) * 2 - 1;
    const ndcY = -(screenY / canvasH) * 2 + 1;
    const { hardpointIdx } = this.shipRenderer.raycast(ndcX, ndcY);
    return hardpointIdx;
  }

  private getDropTarget(worldX: number, worldY: number, canSlotStructure: boolean):
    | { type: "hardpoint"; sectorIndex: number }
    | { type: "play-zone" }
    | null {
    // Check hardpoints (for structure/institution cards)
    if (canSlotStructure) {
      const hpIdx = this.raycastHardpointAtScreen(worldX, worldY);
      if (hpIdx >= 0) {
        const slot = this.getSlotForHardpoint(hpIdx);
        if (slot) return { type: "hardpoint", sectorIndex: slot.sectorIndex };
      }
    }

    // Anything above the hand area counts as play zone (generous drop area)
    if (worldY < LAYOUT.handY - s(40)) {
      return { type: "play-zone" };
    }

    return null;
  }

  // ─── Buy Animation ──────────────────────────────────────────────

  /** Animate a card-back ghost from a world position to the discard pile. */
  private animateCardToDiscard(fromX: number, fromY: number): void {
    const ghost = this.add.image(fromX, fromY, "card-back");
    ghost.setDisplaySize(CARD_WIDTH * 0.7, CARD_HEIGHT * 0.7);
    ghost.setDepth(500);
    const halfScale = ghost.scaleX * (0.35 / 0.7);

    this.tweens.add({
      targets: ghost,
      x: this.playerDiscardPileX,
      y: this.playerDiscardPileY,
      scaleX: halfScale,
      scaleY: halfScale,
      alpha: 0.6,
      duration: 350,
      ease: "Power2",
      onComplete: () => { if (ghost.scene) ghost.destroy(); },
    });
    this.time.delayedCall(550, () => { if (ghost.scene) ghost.destroy(); });
  }

  private animateBuyToDiscard(row: MarketRowId, slotIndex: number): void {
    const fi = this.flatIdx(row, slotIndex);
    const slot = this.marketSlots[fi];
    if (!slot) return;

    // Hide the slot's card sprite immediately so no ghost remains
    if (slot.cardSprite) slot.cardSprite.setVisible(false);

    const fromX = slot.x;
    const fromY = slot.y;

    const ghost = this.add.image(fromX, fromY, "card-back");
    ghost.setDisplaySize(CARD_WIDTH * 0.45, CARD_HEIGHT * 0.45);
    ghost.setDepth(500);
    const targetScale = ghost.scaleX * (0.35 / 0.45);

    this.tweens.add({
      targets: ghost,
      x: this.playerDiscardPileX,
      y: this.playerDiscardPileY,
      scaleX: targetScale,
      scaleY: targetScale,
      alpha: 0,
      duration: 400,
      ease: "Power2",
      onComplete: () => {
        if (!ghost.scene) return;
        ghost.destroy();
      },
    });
    // Failsafe: destroy ghost after timeout in case tween doesn't complete
    this.time.delayedCall(600, () => {
      if (ghost.scene) ghost.destroy();
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

    // Clear action pool — unused actions are lost, fallout will grant fresh ones
    this.gameState.availableActions = { matter: 0, energy: 0, data: 0, influence: 0 };
    this.actionPool.updatePool(this.gameState.availableActions);

    // Phase 1: Compact
    this.animateCompact(() => {
      // Phase 2: Slide + Fallout (may loop for extra slides from hazards)
      const extraSlides = getExtraSlideCount(this.gameState);
      const totalSlides = 1 + extraSlides;
      if (extraSlides > 0) {
        this.actionLog.addEntry(
          `Market slides ${totalSlides}× (${extraSlides} extra from hazards).`,
          HEX.bone
        );
      }

      this.animateSlideLoop(totalSlides, 0, () => {
        // Phase 3: Refill
        this.animateRefill(() => {
          // Phase 4: Start next turn
          // Preserve actions accumulated during fallout — startTurn resets them
          const falloutActions = { ...this.gameState.availableActions };
          const handBefore = new Set(this.gameState.mandateDeck.hand.map(c => c.instanceId));
          const turnResult = startTurn(this.gameState);
          this.gameState = turnResult.state;
          // Restore fallout actions into the fresh turn
          this.gameState.availableActions.matter += falloutActions.matter;
          this.gameState.availableActions.energy += falloutActions.energy;
          this.gameState.availableActions.data += falloutActions.data;
          this.gameState.availableActions.influence += falloutActions.influence;
          this.actionLog.setTurn(this.gameState.turnNumber);
          if (turnResult.reshuffled) {
            this.showMessage("Discard reshuffled into deck.");
            this.actionLog.addEntry("Discard reshuffled into deck.", HEX.teal);
          }
          this.refreshAll();

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
      if (allSlots[i]?.card.type === "crisis") {
        this.marketSlots[i].setCrisisIndicator(true);
      }
      const isUpper = i < MARKET_SLOTS_PER_ROW;
      const row: MarketRowId = isUpper ? "upper" : "lower";
      const slotIndex = isUpper ? i : i - MARKET_SLOTS_PER_ROW;
      const marketRow = getMarketRowById(this.gameState.transitMarket, row);
      this.marketSlots[i].setInvestment(marketRow.investments[slotIndex] ?? null);

      // Passive effect: locked market slots
      this.marketSlots[i].setLocked(isSlotLocked(this.gameState, row, slotIndex));

      this.wireMarketSlotInteractions(this.marketSlots[i], slotIndex, row);
    }
    this.worldDeckCountText.setText(`${this.gameState.worldDeck.drawPile.length}`);
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
        img.setDisplaySize(CARD_WIDTH * 0.55, CARD_HEIGHT * 0.55);
        img.setDepth(500);
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
          if (ghost.scene) ghost.destroy();
          if (investGhost?.scene) investGhost.destroy();
          if (--remaining <= 0) {
            for (const fi of hiddenFis) {
              if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(true);
              this.marketSlots[fi]?.setInvestmentVisible(true);
            }
            onComplete();
          }
        },
      });
      // Failsafe: destroy ghost after timeout in case tween doesn't complete
      this.time.delayedCall(duration + 200, () => {
        if (ghost.scene) ghost.destroy();
        if (investGhost?.scene) investGhost.destroy();
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

    let reactiveSleep = false;
    const falloutInvestments: { card: CardInstance; investment: ResourceCost | null; row: string }[] = [];
    for (const [idx, falloutData] of [slideResult.upperFallout, slideResult.lowerFallout].entries()) {
      if (falloutData.card) {
        const fr = resolveFallout(this.gameState, falloutData.card);
        this.gameState = fr.state;
        for (const msg of fr.messages) {
          this.showMessage(msg);
          this.actionLog.addEntry(msg, HEX.bone);
        }
        if (fr.triggersReactiveSleep) reactiveSleep = true;
        falloutInvestments.push({
          card: falloutData.card,
          investment: falloutData.investment,
          row: idx === 0 ? "upper" : "lower",
        });
      }
    }

    // Accumulate resource actions from fallout investments into action pool
    for (const { card, investment } of falloutInvestments) {
      if (investment) {
        const actions = extractResourceActions(investment);
        for (const action of actions) {
          switch (action.type) {
            case "progress-building": this.gameState.availableActions.matter += action.count; break;
            case "tap-card": this.gameState.availableActions.energy += action.count; break;
            case "scry-market": this.gameState.availableActions.data += action.count; break;
            case "swap-market": this.gameState.availableActions.influence += action.count; break;
          }
        }
        if (actions.length > 0) {
          this.actionLog.addEntry(`  Actions from ${card.card.name}: ${actions.map(a => `${a.count}× ${a.type}`).join(", ")}`, HEX.bone);
        }
      }
    }

    // Update action pool live as cards fall off
    this.actionPool.updatePool(this.gameState.availableActions);

    // Reactive cryosleep: crisis card fell off the market
    if (reactiveSleep) {
      this.gameState.phase = "succession";
      this.time.delayedCall(1200, () => {
        this.scene.start(SuccessionScene.KEY, { gameState: this.gameState, cardDefs: this.cardDefs });
      });
      return;
    }

    for (const claim of slideResult.claimedInvestments) {
      const msg = `${claim.faction} claimed invested resources.`;
      this.showMessage(msg);
      this.actionLog.addEntry(msg, HEX.bone);
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
        img.setDisplaySize(CARD_WIDTH * 0.55, CARD_HEIGHT * 0.55);
        img.setDepth(500);
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
          if (ghost.scene) ghost.destroy();
          if (investGhost?.scene) investGhost.destroy();
        },
      });
      // Failsafe: destroy ghost after timeout in case tween doesn't complete
      this.time.delayedCall(1000, () => {
        if (ghost.scene) ghost.destroy();
        if (investGhost?.scene) investGhost.destroy();
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
      ghost.setDisplaySize(CARD_WIDTH * 0.3, CARD_HEIGHT * 0.3);
      ghost.setAlpha(0).setDepth(500);
      const refillTarget = ghost.scaleX * (0.5 / 0.3);

      this.tweens.add({
        targets: ghost,
        x: this.marketSlots[fi].x,
        y: this.marketSlots[fi].y,
        scaleX: refillTarget,
        scaleY: refillTarget,
        alpha: 1,
        duration: 400,
        delay: idx * 120,
        ease: "Back.easeOut",
        onComplete: () => {
          if (ghost.scene) ghost.destroy();
          if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(true);
          if (++filled >= newFis.length) onComplete();
        },
      });
      // Failsafe: destroy ghost after timeout in case tween doesn't complete
      this.time.delayedCall(400 + idx * 120 + 200, () => {
        if (ghost.scene) ghost.destroy();
        if (this.marketSlots[fi]?.cardSprite) this.marketSlots[fi].cardSprite!.setVisible(true);
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
          this.actionLog.addEntry(`  ${eff}`, HEX.bone);
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

      // Check for phase transition to succession (triggered by crisis resolution)
      if (this.gameState.phase === "succession") {
        this.time.delayedCall(600, () => {
          this.scene.start(SuccessionScene.KEY, { gameState: this.gameState, cardDefs: this.cardDefs });
        });
      }

      // Actions from purchase are now accumulated in gameState.availableActions
      // and shown in the ActionPool — no modal resolution needed
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

        // Crisis indicator
        if (allSlots[i]?.card.type === "crisis") {
          this.marketSlots[i].setCrisisIndicator(true);
        }

        // Determine row and slot index for this flat index
        // getAllMarketSlots order: upper 0-5, lower 6-11
        const isUpper = i < MARKET_SLOTS_PER_ROW;
        const row: MarketRowId = isUpper ? "upper" : "lower";
        const slotIndex = isUpper ? i : i - MARKET_SLOTS_PER_ROW;

        // Update investment indicator
        const marketRow = getMarketRowById(this.gameState.transitMarket, row);
        this.marketSlots[i].setInvestment(marketRow.investments[slotIndex] ?? null);

        // Passive effect: locked market slots
        this.marketSlots[i].setLocked(isSlotLocked(this.gameState, row, slotIndex));

        // Fresh investment highlight (invested this turn)
        const slotKey = `${row}-${slotIndex}`;
        this.marketSlots[i].setFreshInvestment(this.gameState.turnInvestments.includes(slotKey));

        this.wireMarketSlotInteractions(this.marketSlots[i], slotIndex, row);
      }
    }

    // Mark cards beyond empty column gaps as unreachable (dimmed)
    // Find the first empty column (no card in either row)
    let firstEmptyCol = -1;
    for (let col = 0; col < MARKET_SLOTS_PER_ROW; col++) {
      const upperHas = !!allSlots[col];
      const lowerHas = !!allSlots[col + MARKET_SLOTS_PER_ROW];
      if (!upperHas && !lowerHas) {
        firstEmptyCol = col;
        break;
      }
    }
    if (firstEmptyCol >= 0) {
      // Dim all cards in columns beyond the gap
      for (let col = firstEmptyCol + 1; col < MARKET_SLOTS_PER_ROW; col++) {
        const upperFi = col;
        const lowerFi = col + MARKET_SLOTS_PER_ROW;
        if (this.marketSlots[upperFi]?.cardSprite) {
          this.marketSlots[upperFi].cardSprite!.setAffordable(false);
        }
        if (this.marketSlots[lowerFi]?.cardSprite) {
          this.marketSlots[lowerFi].cardSprite!.setAffordable(false);
        }
      }
    }

    // Sync hardpoint 3D visuals + labels with current game state
    this.syncHardpointOccupancy();

    // Refresh hardpoint panel if one is currently visible
    if (this.activeHardpointIdx >= 0 && this.lockedHardpointIdx >= 0) {
      this.showHardpointPanel(this.lockedHardpointIdx);
    }

    this.handDisplay.updateHand(this.gameState.mandateDeck.hand);

    const draw = this.gameState.mandateDeck.drawPile.length;
    const disc = this.gameState.mandateDeck.discardPile.length;
    // Player pile counts
    this.playerDeckCountText.setText(`${draw}`);
    this.playerDiscardCountText.setText(`${disc}`);

    // Update world deck count
    const worldDeckCount = this.gameState.worldDeck.drawPile.length;
    this.worldDeckCountText.setText(`${worldDeckCount}`);

    // Era display
    this.eraDisplay.update(this.gameState.era, this.gameState.eraModifiers);

    // Action pool
    this.actionPool.updatePool(this.gameState.availableActions);
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
      ghost.setDisplaySize(CARD_WIDTH * 0.45, CARD_HEIGHT * 0.45);
      ghost.setDepth(200);
      const handScale = ghost.scaleX * (1 / 0.45);

      const delay = idx * 80;
      this.tweens.add({
        targets: ghost,
        x: target.x,
        y: target.y,
        scaleX: handScale,
        scaleY: handScale,
        duration: 350,
        delay,
        ease: "Power2",
        onComplete: () => {
          if (ghost.scene) ghost.destroy();
          this.handDisplay.setCardsVisible(new Set([id]), true);
        },
      });
      this.time.delayedCall(delay + 550, () => {
        if (ghost.scene) ghost.destroy();
        this.handDisplay.setCardsVisible(new Set([id]), true);
      });
      idx++;
    }
  }

  private showMessage(msg: string, color?: string): void {
    this.messagePanel.addMessage(msg, color);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLICK-TO-USE RESOURCE ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Consume one action token from the pool.
   * Returns true if there was a token to consume.
   */
  private consumePoolAction(key: keyof typeof this.gameState.availableActions): boolean {
    if (this.gameState.availableActions[key] <= 0) return false;
    this.gameState.availableActions[key]--;
    return true;
  }

  // ── Matter: Progress Building (triggered by hardpoint panel click) ──

  /** Called when a sector with under-construction buildings is clicked and matter actions are available */
  private useProgressBuilding(instanceId: string): void {
    if (!this.consumePoolAction("matter")) return;
    const result = resolveProgressBuilding(this.gameState, instanceId);
    if (result.success) {
      this.gameState = result.state;
      this.actionLog.addEntry(result.message);
      this.showMessage(result.message);
    } else {
      this.showMessage(`! ${result.message}`, "#cc4444");
      // Refund the action
      this.gameState.availableActions.matter++;
    }
    this.refreshAll();
  }

  // ── Energy: Tap Card (triggered by hardpoint panel click on tappable card) ──

  /** Called when a tappable card in the tableau is clicked and energy actions are available */
  private useTapCard(instanceId: string): void {
    if (!this.consumePoolAction("energy")) return;
    const result = resolveTapCard(this.gameState, instanceId);
    if (result.success) {
      this.gameState = result.state;
      this.actionLog.addEntry(result.message);
      this.showMessage(result.message);
    } else {
      this.showMessage(`! ${result.message}`, "#cc4444");
      this.gameState.availableActions.energy++;
    }
    this.refreshAll();
  }

  // ── Data: Scry Market Deck (triggered by clicking world deck pile) ──

  private useScryMarket(): void {
    if (this.gameState.availableActions.data <= 0) return;
    const topCards = peekMarketDeck(this.gameState, 3);
    if (topCards.length === 0) {
      this.showMessage("Market deck is empty.", "#4488cc");
      return;
    }

    const dialog = new ScryDialog(this, topCards);
    dialog.onConfirm = (order: number[]) => {
      this.consumePoolAction("data");
      const result = resolveScryMarket(this.gameState, order);
      if (result.success) {
        this.gameState = result.state;
        this.actionLog.addEntry(result.message);
        this.showMessage(result.message);
      }
      this.refreshAll();
    };
  }

  // ── Action Pool Click Handler ──────────────────────────────────────

  private handleActionPoolClick(resourceKey: string): void {
    if (this.purchaseMode) return; // Don't interrupt purchase mode

    switch (resourceKey) {
      case "matter": {
        // Find first under-construction building and prompt
        const candidates: { instanceId: string; name: string }[] = [];
        for (const sector of this.gameState.ship.sectors) {
          for (const card of sector.installedCards) {
            if (card.underConstruction) {
              candidates.push({ instanceId: card.instanceId, name: card.card.name });
            }
          }
        }
        if (candidates.length === 0) {
          this.showMessage("No buildings under construction.", "#cc8844");
          return;
        }
        if (candidates.length === 1) {
          new ConfirmPopup(this, MAIN_CX, LAYOUT.resourceY,
            `Progress ${candidates[0].name}?`,
            () => this.useProgressBuilding(candidates[0].instanceId));
        } else {
          // Multiple candidates: show a popup for the first one found
          this.showMessage("Click a hardpoint to select a building to progress.");
          new ConfirmPopup(this, MAIN_CX, LAYOUT.resourceY,
            `Progress ${candidates[0].name}?`,
            () => this.useProgressBuilding(candidates[0].instanceId));
        }
        break;
      }
      case "energy": {
        // Find tappable cards and prompt
        const candidates: { instanceId: string; name: string }[] = [];
        for (const sector of this.gameState.ship.sectors) {
          for (const card of sector.installedCards) {
            if (!card.tapped && !card.underConstruction && card.card.tapEffect) {
              candidates.push({ instanceId: card.instanceId, name: card.card.name });
            }
          }
        }
        if (candidates.length === 0) {
          this.showMessage("No cards available to tap.", "#44cc44");
          return;
        }
        if (candidates.length === 1) {
          new ConfirmPopup(this, MAIN_CX, LAYOUT.resourceY,
            `Tap ${candidates[0].name}?\n${candidates[0].name}`,
            () => this.useTapCard(candidates[0].instanceId));
        } else {
          // Multiple tappable: show a popup for the first one found
          this.showMessage("Click a hardpoint to select a card to tap.");
          new ConfirmPopup(this, MAIN_CX, LAYOUT.resourceY,
            `Tap ${candidates[0].name}?`,
            () => this.useTapCard(candidates[0].instanceId));
        }
        break;
      }
      case "data":
        this.useScryMarket();
        break;
      case "influence":
        this.showMessage("Click a market card to select it for swapping.");
        this.pendingSwapActivation = true;
        break;
    }
  }

  /** Flag: next market card click should enter swap mode */
  private pendingSwapActivation = false;

  // ── Influence: Swap Market Cards (triggered by clicking market cards) ──

  private handleSwapClick(row: MarketRowId, col: number): void {
    if (!this.swapMode) return;

    // This is the second click — execute the swap
    const slotA = this.swapMode;
    const slotB = { row, col };

    // Clear swap mode + highlights
    this.swapMode = null;
    for (let fi = 0; fi < MARKET_SLOTS; fi++) {
      this.marketSlots[fi]?.setPurchaseHighlight(null);
    }

    // Check adjacency
    const adjacent = this.getAdjacentSlots(slotA.row, slotA.col);
    const isAdj = adjacent.some(a => a.row === slotB.row && a.col === slotB.col);
    if (!isAdj) {
      this.showMessage("Cards must be adjacent to swap.", "#cc4444");
      return;
    }

    if (!this.consumePoolAction("influence")) return;
    const result = resolveSwapMarket(this.gameState, slotA, slotB);
    if (result.success) {
      this.gameState = result.state;
      this.actionLog.addEntry(result.message);
      this.showMessage(result.message);
    } else {
      this.showMessage(`! ${result.message}`, "#cc4444");
      this.gameState.availableActions.influence++;
    }
    this.refreshAll();
  }

  private highlightSwapTargets(row: MarketRowId, col: number): void {
    // Highlight the selected slot
    const selFi = row === "upper" ? col : col + MARKET_SLOTS_PER_ROW;
    this.marketSlots[selFi]?.setPurchaseHighlight("target");

    // Highlight adjacent slots
    const adjacent = this.getAdjacentSlots(row, col);
    for (const adj of adjacent) {
      const fi = adj.row === "upper" ? adj.col : adj.col + MARKET_SLOTS_PER_ROW;
      this.marketSlots[fi]?.setPurchaseHighlight("needs-invest");
    }
  }

  private getAdjacentSlots(row: MarketRowId, col: number): { row: MarketRowId; col: number }[] {
    const adjacent: { row: MarketRowId; col: number }[] = [];
    const maxCol = MARKET_SLOTS_PER_ROW - 1;

    if (col > 0) adjacent.push({ row, col: col - 1 });
    if (col < maxCol) adjacent.push({ row, col: col + 1 });
    const otherRow: MarketRowId = row === "upper" ? "lower" : "upper";
    adjacent.push({ row: otherRow, col });

    return adjacent.filter(({ row: r, col: c }) => {
      const marketRow = getMarketRowById(this.gameState.transitMarket, r);
      return marketRow.slots[c] !== null;
    });
  }
}
