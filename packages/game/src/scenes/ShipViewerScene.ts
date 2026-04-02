import Phaser from "phaser";
import { HEX, NUM } from "@icebox/shared";
import { ShipRenderer } from "../ship/ShipRenderer";
import type { ShipOrientation } from "../ship/ShipRenderer";
import { ShipControls, loadDefaults, saveDefaults } from "../ship/ShipControls";
import type { CameraParams } from "../ship/ShipControls";
import { generateShip } from "../ship/ShipGenerator";

const SECTION_LABELS: Record<string, string> = {
  asteroid: "ASTEROID CORE",
  engineering: "ENGINEERING",
  habitat: "HABITAT",
  command: "COMMAND",
};

export class ShipViewerScene extends Phaser.Scene {
  static readonly KEY = "ShipViewerScene";

  private shipRenderer: ShipRenderer | null = null;
  private shipControls: ShipControls | null = null;
  private escKey: Phaser.Input.Keyboard.Key | null = null;
  private hudElement: HTMLDivElement | null = null;
  private debugPanel: HTMLDivElement | null = null;
  private debugBody: HTMLDivElement | null = null;
  private debugCollapsed = false;
  private sliderInputs: { target: Record<string, number>; key: string; input: HTMLInputElement; valSpan: HTMLSpanElement; step: number }[] = [];

  // Hardpoint panel overlay
  private panelOverlay: HTMLDivElement | null = null;
  private svgOverlay: SVGSVGElement | null = null;
  private activeHardpointIdx = -1;
  private lockedHardpointIdx = -1;
  private hardpointPanel: HTMLDivElement | null = null;
  private hardpointLine: SVGLineElement | null = null;
  private panelAnimationId: number | null = null;

  // Elastic spring state for panel tracking
  private panelCurrentX = 0;
  private panelCurrentY = 0;
  private panelVelocityX = 0;
  private panelVelocityY = 0;
  private readonly springStiffness = 8;
  private readonly springDamping = 0.55;

  // Ship state
  private currentSeed = 0;
  private seedLabel: HTMLDivElement | null = null;

  constructor() {
    super(ShipViewerScene.KEY);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NUM.warmGray);

    const container = this.game.canvas.parentElement;
    if (!container) return;

    // Initialize Three.js renderer immediately with fallback defaults
    this.shipRenderer = new ShipRenderer(container);
    this.currentSeed = Date.now();
    this.rebuildShip(this.currentSeed);

    // ESC to go back
    if (this.input.keyboard) {
      this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    this.events.once("shutdown", this.cleanup, this);

    // Load saved defaults async, then apply and build UI
    loadDefaults().then((defaults) => {
      if (!this.shipRenderer || !container) return;

      // Apply saved orientation + options
      this.shipRenderer.orientation.rotX = defaults.orientation.rotX;
      this.shipRenderer.orientation.rotY = defaults.orientation.rotY;
      this.shipRenderer.orientation.rotZ = defaults.orientation.rotZ;
      this.shipRenderer.hoverMode = defaults.hoverMode;
      this.shipRenderer.enginePower = defaults.enginePower;
      this.shipRenderer.starDriftSpeed = defaults.starDriftSpeed;
      this.shipRenderer.applyHoverMode();

      // Initialize camera controls with saved params
      this.shipControls = new ShipControls(this.shipRenderer.canvas, defaults.camera);
      this.shipControls.bindShipOrientation(this.shipRenderer.orientation);
      this.shipControls.bindShipPivot(this.shipRenderer.shipPivot);

      this.createHUD(container, this.currentSeed);
      this.createDebugPanel(container);
      this.createPanelOverlay(container);
      this.bindMouseEvents(container);
    });
  }

  private rebuildShip(seed: number): void {
    if (!this.shipRenderer) return;
    this.currentSeed = seed;
    const shipGeometry = generateShip({ seed });
    this.shipRenderer.buildGeometry(shipGeometry);
    this.shipRenderer.applyHoverMode();
    // Close any open hardpoint panel since geometry changed
    this.lockedHardpointIdx = -1;
    this.hideHardpointPanel();
    // Update seed label
    if (this.seedLabel) {
      this.seedLabel.textContent = `SEED: ${seed}`;
    }
  }

  private createHUD(container: HTMLElement, seed: number): void {
    this.hudElement = document.createElement("div");
    this.hudElement.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 1;
      font-family: 'Space Mono', monospace;
    `;

    const backLabel = document.createElement("div");
    backLabel.style.cssText = `position: absolute; top: 16px; left: 16px; color: ${HEX.concrete}; font-size: 12px;`;
    backLabel.textContent = "[ESC] BACK";
    this.hudElement.appendChild(backLabel);

    this.seedLabel = document.createElement("div");
    this.seedLabel.style.cssText = `position: absolute; bottom: 16px; left: 16px; color: ${HEX.concrete}; font-size: 11px;`;
    this.seedLabel.textContent = `SEED: ${seed}`;
    this.hudElement.appendChild(this.seedLabel);

    const legend = document.createElement("div");
    legend.style.cssText = `position: absolute; top: 16px; right: 16px; color: ${HEX.bone}; font-size: 11px; text-align: right; line-height: 1.8;`;
    legend.innerHTML = `
      <span style="color:${HEX.signalRed}">&#9632;</span> ENGINEERING<br>
      <span style="color:${HEX.teal}">&#9632;</span> HABITAT<br>
      <span style="color:${HEX.chartreuse}">&#9632;</span> COMMAND<br>
      <span style="color:${HEX.concrete}">&#9632;</span> ASTEROID CORE
    `;
    this.hudElement.appendChild(legend);

    const controls = document.createElement("div");
    controls.style.cssText = `position: absolute; bottom: 16px; right: 16px; color: ${HEX.concrete}; font-size: 11px; text-align: right;`;
    controls.textContent = "SCROLL: dolly  |  DRAG: roll";
    this.hudElement.appendChild(controls);

    container.appendChild(this.hudElement);
  }

  private createDebugPanel(container: HTMLElement): void {
    if (!this.shipControls || !this.shipRenderer) return;
    this.sliderInputs = [];

    const panel = document.createElement("div");
    panel.style.cssText = `
      position: absolute; bottom: 48px; left: 16px;
      background: rgba(22, 22, 24, 0.95); border: 1px solid ${HEX.graphite};
      font-family: 'Space Mono', monospace;
      font-size: 11px; color: ${HEX.bone}; z-index: 2;
      pointer-events: auto; min-width: 260px;
    `;

    // Header bar (always visible, toggles collapse)
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; cursor: pointer; user-select: none;
      border-bottom: 1px solid ${HEX.graphite};
    `;

    const headerTitle = document.createElement("span");
    headerTitle.style.cssText = `color: ${HEX.chartreuse}; font-size: 12px; letter-spacing: 0.5px;`;
    headerTitle.textContent = "CAMERA DEBUG";
    header.appendChild(headerTitle);

    const chevron = document.createElement("span");
    chevron.style.cssText = `color: ${HEX.concrete}; font-size: 14px; transition: transform 0.2s;`;
    chevron.textContent = "▼";
    header.appendChild(chevron);

    header.addEventListener("click", () => {
      this.debugCollapsed = !this.debugCollapsed;
      if (this.debugBody) {
        this.debugBody.style.display = this.debugCollapsed ? "none" : "block";
      }
      chevron.style.transform = this.debugCollapsed ? "rotate(-90deg)" : "rotate(0deg)";
    });

    panel.appendChild(header);

    // Body (collapsible)
    const body = document.createElement("div");
    body.style.cssText = "padding: 12px 16px; max-height: 70vh; overflow-y: auto;";
    this.debugBody = body;

    const addSection = (titleText: string, color: string) => {
      const title = document.createElement("div");
      title.style.cssText = `color: ${color}; margin: 10px 0 6px 0; font-size: 12px;`;
      title.textContent = titleText;
      body.appendChild(title);
    };

    const addSlider = (
      target: Record<string, number>,
      key: string,
      label: string,
      min: number,
      max: number,
      step: number,
    ) => {
      const row = document.createElement("div");
      row.style.cssText = "display: flex; align-items: center; margin-bottom: 5px; gap: 8px;";

      const lbl = document.createElement("span");
      lbl.style.cssText = `color: ${HEX.concrete}; min-width: 70px; font-size: 10px;`;
      lbl.textContent = label;
      row.appendChild(lbl);

      const input = document.createElement("input");
      input.type = "range";
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(target[key]);
      input.style.cssText = `flex: 1; accent-color: ${HEX.teal}; cursor: pointer;`;

      const valSpan = document.createElement("span");
      valSpan.style.cssText = `color: ${HEX.teal}; min-width: 50px; text-align: right; font-size: 10px;`;
      valSpan.textContent = step < 1 ? Number(target[key]).toFixed(2) : String(target[key]);

      input.addEventListener("input", () => {
        const v = parseFloat(input.value);
        target[key] = v;
        valSpan.textContent = step < 1 ? v.toFixed(2) : String(v);
      });

      row.appendChild(input);
      row.appendChild(valSpan);
      body.appendChild(row);

      this.sliderInputs.push({ target, key, input, valSpan, step });
    };

    // -- Camera section --
    addSection("CAMERA", HEX.chartreuse);
    const cam = this.shipControls.params as unknown as Record<string, number>;
    addSlider(cam, "distance", "DISTANCE", 20, 200, 1);
    addSlider(cam, "fov", "FOV", 15, 90, 1);
    addSlider(cam, "elevation", "ELEVATION", -1.5, 1.5, 0.01);
    addSlider(cam, "azimuth", "AZIMUTH", -Math.PI, Math.PI, 0.01);

    // -- Ship orientation section --
    addSection("SHIP ROTATION", HEX.teal);
    const ori = this.shipRenderer.orientation as unknown as Record<string, number>;
    addSlider(ori, "rotX", "PITCH (X)", -Math.PI, Math.PI, 0.01);
    addSlider(ori, "rotY", "YAW (Y)", -Math.PI, Math.PI, 0.01);
    addSlider(ori, "rotZ", "ROLL (Z)", -Math.PI, Math.PI, 0.01);

    // -- Options section --
    addSection("OPTIONS", HEX.chartreuse);

    const modeRow = document.createElement("div");
    modeRow.style.cssText = "display: flex; align-items: center; margin-bottom: 8px; gap: 8px;";

    const modeLabel = document.createElement("span");
    modeLabel.style.cssText = `color: ${HEX.concrete}; font-size: 10px; min-width: 70px;`;
    modeLabel.textContent = "RENDER";
    modeRow.appendChild(modeLabel);

    const modeSelect = document.createElement("select");
    modeSelect.style.cssText = `
      flex: 1; background: ${HEX.steel}; color: ${HEX.teal}; border: 1px solid ${HEX.graphite};
      font-family: 'Space Mono', monospace; font-size: 10px; padding: 4px 6px; cursor: pointer;
    `;
    const modes = [
      { value: "wireframe", label: "WIREFRAME" },
      { value: "solid-hover", label: "SOLID HOVER" },
      { value: "solid-highlight", label: "SOLID HIGHLIGHT" },
    ] as const;
    for (const m of modes) {
      const opt = document.createElement("option");
      opt.value = m.value;
      opt.textContent = m.label;
      opt.style.cssText = `background: ${HEX.steel}; color: ${HEX.teal};`;
      if (m.value === this.shipRenderer.hoverMode) opt.selected = true;
      modeSelect.appendChild(opt);
    }
    modeSelect.addEventListener("change", () => {
      this.shipRenderer!.hoverMode = modeSelect.value as "wireframe" | "solid-hover" | "solid-highlight";
      this.shipRenderer!.applyHoverMode();
    });
    modeRow.appendChild(modeSelect);
    body.appendChild(modeRow);

    // -- New Ship button --
    const newShipRow = document.createElement("div");
    newShipRow.style.cssText = "margin-top: 12px;";

    const newShipBtn = document.createElement("button");
    newShipBtn.textContent = "NEW SHIP";
    newShipBtn.style.cssText = `
      width: 100%; padding: 8px 0; border: 1px solid ${HEX.graphite}; background: ${HEX.steel};
      color: ${HEX.teal}; font-family: 'Space Mono', monospace; font-size: 11px;
      cursor: pointer; letter-spacing: 0.5px;
    `;
    newShipBtn.addEventListener("mouseenter", () => { newShipBtn.style.borderColor = HEX.teal; });
    newShipBtn.addEventListener("mouseleave", () => { newShipBtn.style.borderColor = HEX.graphite; });
    newShipBtn.addEventListener("click", () => {
      this.rebuildShip(Date.now());
    });
    newShipRow.appendChild(newShipBtn);
    body.appendChild(newShipRow);

    // -- Engine Power slider --
    const engineRow = document.createElement("div");
    engineRow.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 10px;";
    const engineLabel = document.createElement("span");
    engineLabel.textContent = "ENGINE";
    engineLabel.style.cssText = `color: ${HEX.concrete}; font-size: 9px; letter-spacing: 0.5px; min-width: 48px;`;
    const engineSlider = document.createElement("input");
    engineSlider.type = "range";
    engineSlider.min = "0";
    engineSlider.max = "100";
    const currentPower = this.shipRenderer?.enginePower ?? 0.7;
    engineSlider.value = String(Math.round(currentPower * 100));
    engineSlider.style.cssText = "flex: 1; accent-color: " + HEX.signalRed + ";";
    const engineVal = document.createElement("span");
    engineVal.textContent = currentPower.toFixed(2);
    engineVal.style.cssText = `color: ${HEX.signalRed}; font-size: 10px; min-width: 32px; text-align: right;`;
    engineSlider.addEventListener("input", () => {
      const v = parseInt(engineSlider.value, 10) / 100;
      if (this.shipRenderer) this.shipRenderer.enginePower = v;
      engineVal.textContent = v.toFixed(2);
    });
    engineRow.appendChild(engineLabel);
    engineRow.appendChild(engineSlider);
    engineRow.appendChild(engineVal);
    body.appendChild(engineRow);

    // -- Star drift speed slider --
    const starRow = document.createElement("div");
    starRow.style.cssText = "display: flex; align-items: center; gap: 8px; margin-top: 6px;";
    const starLabel = document.createElement("span");
    starLabel.textContent = "STARS";
    starLabel.style.cssText = `color: ${HEX.concrete}; font-size: 9px; letter-spacing: 0.5px; min-width: 48px;`;
    const starSlider = document.createElement("input");
    starSlider.type = "range";
    starSlider.min = "0";
    starSlider.max = "200";
    starSlider.value = String(Math.round((this.shipRenderer?.starDriftSpeed ?? 3) * 10));
    starSlider.style.cssText = "flex: 1; accent-color: " + HEX.concrete + ";";
    const starVal = document.createElement("span");
    starVal.textContent = (this.shipRenderer?.starDriftSpeed ?? 3).toFixed(1);
    starVal.style.cssText = `color: ${HEX.concrete}; font-size: 10px; min-width: 32px; text-align: right;`;
    starSlider.addEventListener("input", () => {
      const v = parseInt(starSlider.value, 10) / 10;
      if (this.shipRenderer) this.shipRenderer.starDriftSpeed = v;
      starVal.textContent = v.toFixed(1);
    });
    starRow.appendChild(starLabel);
    starRow.appendChild(starSlider);
    starRow.appendChild(starVal);
    body.appendChild(starRow);

    // -- Save button --
    const btnRow = document.createElement("div");
    btnRow.style.cssText = "margin-top: 6px;";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "SAVE AS DEFAULT";
    saveBtn.style.cssText = `
      width: 100%; padding: 8px 0; border: 1px solid ${HEX.graphite}; background: ${HEX.steel};
      color: ${HEX.chartreuse}; font-family: 'Space Mono', monospace; font-size: 11px;
      cursor: pointer; letter-spacing: 0.5px;
    `;
    saveBtn.addEventListener("mouseenter", () => { saveBtn.style.borderColor = HEX.chartreuse; });
    saveBtn.addEventListener("mouseleave", () => { saveBtn.style.borderColor = HEX.graphite; });
    saveBtn.addEventListener("click", async () => {
      const ok = await saveDefaults({
        camera: this.shipControls!.params,
        orientation: this.shipRenderer!.orientation,
        hoverMode: this.shipRenderer!.hoverMode,
        enginePower: this.shipRenderer!.enginePower,
        starDriftSpeed: this.shipRenderer!.starDriftSpeed,
      });
      saveBtn.textContent = ok ? "SAVED" : "SAVE FAILED";
      saveBtn.style.color = ok ? HEX.teal : HEX.signalRed;
      setTimeout(() => {
        saveBtn.textContent = "SAVE AS DEFAULT";
        saveBtn.style.color = HEX.chartreuse;
      }, 1500);
    });
    btnRow.appendChild(saveBtn);
    body.appendChild(btnRow);

    panel.appendChild(body);
    container.appendChild(panel);
    this.debugPanel = panel;
  }

  private createPanelOverlay(container: HTMLElement): void {
    // SVG overlay for connecting lines
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 3;
    `;
    container.appendChild(svg);
    this.svgOverlay = svg;

    // Container for hardpoint panel divs
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 4;
    `;
    container.appendChild(overlay);
    this.panelOverlay = overlay;
  }

  private bindMouseEvents(container: HTMLElement): void {
    const canvas = this.shipRenderer?.canvas;
    if (!canvas || !this.shipRenderer) return;
    const renderer = this.shipRenderer;

    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const { sectionIdx, hardpointIdx } = renderer.raycast(ndcX, ndcY);

      // Section hover
      renderer.highlightSection(sectionIdx);

      // Hardpoint hover (don't override locked panel)
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
        // Even when locked, highlight on hover
        renderer.highlightHardpoint(hardpointIdx >= 0 ? hardpointIdx : this.lockedHardpointIdx);
      }

      // Cursor
      canvas.style.cursor = hardpointIdx >= 0 ? "pointer" : sectionIdx >= 0 ? "crosshair" : "grab";
    });

    canvas.addEventListener("click", (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const { hardpointIdx } = renderer.raycast(ndcX, ndcY);

      if (hardpointIdx >= 0) {
        if (this.lockedHardpointIdx === hardpointIdx) {
          // Click same hardpoint — unlock and close
          this.lockedHardpointIdx = -1;
          this.hideHardpointPanel();
        } else {
          // Lock to new hardpoint
          this.lockedHardpointIdx = hardpointIdx;
          this.showHardpointPanel(hardpointIdx);
        }
      }
    });
  }

  private showHardpointPanel(hpIdx: number): void {
    if (!this.shipRenderer || !this.panelOverlay || !this.svgOverlay) return;
    const hp = this.shipRenderer.hardpoints[hpIdx];
    if (!hp) return;

    // Clean up previous
    this.removeHardpointElements();

    this.activeHardpointIdx = hpIdx;

    // Create SVG line — bone colored, solid, visible
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", HEX.void);
    line.setAttribute("stroke-width", "2.5");
    line.setAttribute("opacity", "0.9");
    this.svgOverlay.appendChild(line);
    this.hardpointLine = line;

    // Create panel div — sized to hold a card slot (120×170 at 720p design scale)
    const panel = document.createElement("div");
    panel.style.cssText = `
      position: absolute; pointer-events: none;
      background: rgba(22, 22, 24, 0.95); border: 1px solid ${HEX.graphite};
      padding: 12px 14px; font-family: 'Space Mono', monospace;
      font-size: 11px; color: ${HEX.bone}; min-width: 160px;
      transform-origin: left center; transform: scale(0);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    const sectionLabel = SECTION_LABELS[hp.sectionId] || hp.sectionId.toUpperCase();
    const hoverColor = hp.sectionId === "engineering" ? HEX.signalRed
      : hp.sectionId === "habitat" ? HEX.teal
      : hp.sectionId === "command" ? HEX.chartreuse
      : HEX.concrete;

    panel.innerHTML = `
      <div style="color: ${hoverColor}; font-size: 12px; margin-bottom: 8px; letter-spacing: 0.5px;">${sectionLabel}</div>
      <div style="color: ${HEX.concrete}; margin-bottom: 3px;">ID: <span style="color: ${HEX.bone}">${hp.data.id}</span></div>
      <div style="color: ${HEX.concrete}; margin-bottom: 10px;">SLOT: <span style="color: ${HEX.bone}">${hp.data.slotIndex}</span></div>
      <div style="
        width: 120px; height: 170px;
        border: 1px dashed ${HEX.graphite};
        display: flex; align-items: center; justify-content: center;
        color: ${HEX.concrete}; font-size: 9px; letter-spacing: 0.5px;
      ">EMPTY</div>
    `;

    this.panelOverlay.appendChild(panel);
    this.hardpointPanel = panel;

    // Initialize spring position to target so it doesn't fly in from (0,0)
    const canvasW = this.shipRenderer.canvas.clientWidth;
    const canvasH = this.shipRenderer.canvas.clientHeight;
    const initPos = this.shipRenderer.projectHardpoint(hpIdx, canvasW, canvasH);
    if (initPos) {
      this.panelCurrentX = initPos.x + 120;
      this.panelCurrentY = initPos.y - 40;
    }
    this.panelVelocityX = 0;
    this.panelVelocityY = 0;

    // Trigger open animation
    requestAnimationFrame(() => {
      panel.style.transform = "scale(1)";
    });
  }

  private hideHardpointPanel(): void {
    if (this.hardpointPanel) {
      const panel = this.hardpointPanel;
      panel.style.transform = "scale(0)";
      panel.style.transition = "transform 0.15s cubic-bezier(0.55, 0.085, 0.68, 0.53)";
      setTimeout(() => {
        this.removeHardpointElements();
      }, 160);
    } else {
      this.removeHardpointElements();
    }
    this.activeHardpointIdx = -1;
  }

  private removeHardpointElements(): void {
    if (this.hardpointLine) {
      this.hardpointLine.remove();
      this.hardpointLine = null;
    }
    if (this.hardpointPanel) {
      this.hardpointPanel.remove();
      this.hardpointPanel = null;
    }
  }

  private updateHardpointTracking(): void {
    if (!this.shipRenderer) return;
    const idx = this.activeHardpointIdx;
    if (idx < 0 || !this.hardpointPanel || !this.hardpointLine) return;

    const canvasW = this.shipRenderer.canvas.clientWidth;
    const canvasH = this.shipRenderer.canvas.clientHeight;
    const pos = this.shipRenderer.projectHardpoint(idx, canvasW, canvasH);

    if (!pos || pos.x < -50 || pos.x > canvasW + 50 || pos.y < -50 || pos.y > canvasH + 50) {
      // Off-screen — auto-close if locked
      if (this.lockedHardpointIdx === idx) {
        this.lockedHardpointIdx = -1;
      }
      this.hideHardpointPanel();
      return;
    }

    // Target position: offset from hardpoint
    const targetX = pos.x + 100;
    const targetY = pos.y - 20;

    // Spring physics — panel lags behind with elastic overshoot
    const dt = 1 / 60; // approximate frame time
    const dx = targetX - this.panelCurrentX;
    const dy = targetY - this.panelCurrentY;

    // Spring force + damping
    const ax = dx * this.springStiffness - this.panelVelocityX * this.springDamping;
    const ay = dy * this.springStiffness - this.panelVelocityY * this.springDamping;

    this.panelVelocityX += ax;
    this.panelVelocityY += ay;
    this.panelCurrentX += this.panelVelocityX * dt;
    this.panelCurrentY += this.panelVelocityY * dt;

    this.hardpointPanel.style.left = `${this.panelCurrentX}px`;
    this.hardpointPanel.style.top = `${this.panelCurrentY}px`;

    // Line from hardpoint to panel edge — also uses spring position
    this.hardpointLine.setAttribute("x1", String(pos.x));
    this.hardpointLine.setAttribute("y1", String(pos.y));
    this.hardpointLine.setAttribute("x2", String(this.panelCurrentX));
    this.hardpointLine.setAttribute("y2", String(this.panelCurrentY + 15));
  }

  update(): void {
    if (this.shipControls && this.shipRenderer) {
      this.shipControls.update(this.shipRenderer.camera);

      // Sync the rotZ slider with drag-driven roll value
      const ori = this.shipRenderer.orientation as unknown as Record<string, number>;
      for (const s of this.sliderInputs) {
        if (s.key === "rotZ" && s.target === ori) {
          if (s.input !== document.activeElement) {
            s.input.value = String(ori.rotZ);
            s.valSpan.textContent = ori.rotZ.toFixed(2);
          }
        }
      }

      this.shipRenderer.update();
      this.updateHardpointTracking();
    }

    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.scene.start("MainMenuScene");
    }
  }

  private cleanup(): void {
    this.shipControls?.dispose();
    this.shipControls = null;
    this.shipRenderer?.dispose();
    this.shipRenderer = null;
    this.hudElement?.remove();
    this.hudElement = null;
    this.debugPanel?.remove();
    this.debugPanel = null;
    this.debugBody = null;
    this.svgOverlay?.remove();
    this.svgOverlay = null;
    this.panelOverlay?.remove();
    this.panelOverlay = null;
    this.removeHardpointElements();
    this.sliderInputs = [];
    this.escKey = null;
    this.activeHardpointIdx = -1;
    this.lockedHardpointIdx = -1;
    this.seedLabel = null;
  }
}
