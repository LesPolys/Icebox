import Phaser from "phaser";
import type { CardInstance, CardEffect, ResourceCost } from "@icebox/shared";
import { FACTIONS, NUM, HEX } from "@icebox/shared";
import { s, fontSize as fs, GAME_W, GAME_H } from "./layout";

const PANEL_W = s(240);
const EDGE_MARGIN = s(12);
const PAD = s(10);

function formatCost(cost: ResourceCost): string {
  const parts: string[] = [];
  if (cost.matter) parts.push(`M:${cost.matter}`);
  if (cost.energy) parts.push(`E:${cost.energy}`);
  if (cost.data) parts.push(`D:${cost.data}`);
  if (cost.influence) parts.push(`I:${cost.influence}`);
  return parts.join(" ") || "Free";
}

/**
 * Tooltip-style detail panel that follows the mouse pointer.
 * Dynamically sized based on card content with type-specific sections.
 */
export class InfoPanel extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private dynamicObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.bg = scene.add.rectangle(0, 0, PANEL_W, s(100), NUM.midnightViolet, 0.95);
    this.bg.setStrokeStyle(s(1), NUM.charcoalBlue);
    this.bg.setOrigin(0, 0);
    this.add(this.bg);

    this.setVisible(false);
    this.setDepth(1000);
    scene.add.existing(this);

    scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.visible) return;
      this.positionNearPointer(pointer.x, pointer.y);
    });
  }

  private positionNearPointer(px: number, py: number): void {
    const offset = s(16);
    const panelH = this.bg.height;
    let x = px + offset;
    let y = py - panelH / 2;

    if (x + PANEL_W > GAME_W - EDGE_MARGIN) x = px - PANEL_W - offset;
    if (x < EDGE_MARGIN) x = EDGE_MARGIN;
    if (y < EDGE_MARGIN) y = EDGE_MARGIN;
    if (y + panelH > GAME_H - EDGE_MARGIN) y = GAME_H - panelH - EDGE_MARGIN;

    this.setPosition(x, y);
  }

  private clearDynamic(): void {
    for (const obj of this.dynamicObjects) {
      obj.destroy();
    }
    this.dynamicObjects = [];
  }

  private addText(x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text {
    const t = this.scene.add.text(x, y, text, style);
    this.add(t);
    this.dynamicObjects.push(t);
    return t;
  }

  private addDivider(y: number): number {
    const gfx = this.scene.add.graphics();
    gfx.lineStyle(s(1), NUM.charcoalBlue, 0.5);
    gfx.lineBetween(PAD, y, PANEL_W - PAD, y);
    this.add(gfx);
    this.dynamicObjects.push(gfx);
    return y + s(6);
  }

  showCard(cardInst: CardInstance): void {
    this.clearDynamic();
    const card = cardInst.card;
    const cx = PANEL_W / 2;
    let y = PAD;

    // ── Name ──
    const nameT = this.addText(cx, y, card.name, {
      fontSize: fs(13), color: HEX.eggshell, fontFamily: "monospace", fontStyle: "bold",
      wordWrap: { width: PANEL_W - s(20) }, align: "center",
    });
    nameT.setOrigin(0.5, 0);
    y += nameT.height + s(4);

    // ── Type / Tier ──
    const typeLabel = card.type === "crisis"
      ? `CRISIS — Tier ${card.tier}`
      : `${card.type.toUpperCase()} — Tier ${card.tier}`;
    const typeColor = card.type === "crisis" ? "#cc3333" : HEX.darkCyan;
    const typeT = this.addText(cx, y, typeLabel, {
      fontSize: fs(10), color: typeColor, fontFamily: "monospace", fontStyle: card.type === "crisis" ? "bold" : "normal",
    });
    typeT.setOrigin(0.5, 0);
    y += typeT.height + s(4);

    // ── Faction ──
    let factionLabel = "Neutral";
    let factionColor: string = HEX.darkCyan;
    if (card.faction !== "neutral" && FACTIONS[card.faction]) {
      factionLabel = FACTIONS[card.faction].name;
      factionColor = FACTIONS[card.faction].color;
    }
    const facT = this.addText(cx, y, factionLabel, {
      fontSize: fs(9), color: factionColor, fontFamily: "monospace",
    });
    facT.setOrigin(0.5, 0);
    y += facT.height + s(4);

    // ── Cost ──
    const costStr = formatCost(card.cost);
    const costT = this.addText(cx, y, costStr, {
      fontSize: fs(10), color: HEX.pearlAqua, fontFamily: "monospace",
    });
    costT.setOrigin(0.5, 0);
    y += costT.height + s(4);

    // ── Resource Gain (if any) ──
    if (card.resourceGain) {
      const gainStr = "Gain: " + formatCost(card.resourceGain);
      const gainT = this.addText(cx, y, gainStr, {
        fontSize: fs(9), color: "#55cc55", fontFamily: "monospace",
      });
      gainT.setOrigin(0.5, 0);
      y += gainT.height + s(4);
    }

    y = this.addDivider(y);

    // ── Effects grouped by timing ──
    if (card.effects.length > 0) {
      const grouped = this.groupEffectsByTiming(card.effects);
      for (const [timing, effects] of grouped) {
        const label = this.timingLabel(timing);
        const labelT = this.addText(PAD, y, label, {
          fontSize: fs(8), color: "#aa8844", fontFamily: "monospace", fontStyle: "bold",
        });
        y += labelT.height + s(2);

        for (const eff of effects) {
          let desc = `  ${eff.description}`;
          const descT = this.addText(PAD, y, desc, {
            fontSize: fs(8), color: HEX.pearlAqua, fontFamily: "monospace",
            wordWrap: { width: PANEL_W - s(24) },
          });
          y += descT.height + s(1);

          if (eff.condition) {
            const condT = this.addText(PAD + s(8), y, `IF: ${eff.condition.type.replace(/-/g, " ")}`, {
              fontSize: fs(7), color: HEX.dustyMauve, fontFamily: "monospace", fontStyle: "italic",
            });
            y += condT.height + s(1);
          }
        }
        y += s(3);
      }
    } else {
      const noFx = this.addText(cx, y, "No effects.", {
        fontSize: fs(9), color: HEX.darkCyan, fontFamily: "monospace",
      });
      noFx.setOrigin(0.5, 0);
      y += noFx.height + s(4);
    }

    // ── Crisis-specific ──
    if (card.type === "crisis" && card.crisis) {
      y = this.addDivider(y);
      if (card.crisis.proactiveCost) {
        const proT = this.addText(PAD, y, `Resolve cost: ${formatCost(card.crisis.proactiveCost)}`, {
          fontSize: fs(9), color: "#cc3333", fontFamily: "monospace",
        });
        y += proT.height + s(2);
      }
      if (card.crisis.reactiveEntropyPenalty) {
        const penT = this.addText(PAD, y, `Fallout penalty: +${card.crisis.reactiveEntropyPenalty} entropy`, {
          fontSize: fs(9), color: "#cc3333", fontFamily: "monospace",
        });
        y += penT.height + s(2);
      }
    }

    // ── Crew-specific ──
    if (card.type === "crew" && card.crew) {
      y = this.addDivider(y);
      const skillT = this.addText(PAD, y, `Skill: ${card.crew.skillTag}`, {
        fontSize: fs(9), color: HEX.pearlAqua, fontFamily: "monospace",
      });
      y += skillT.height + s(2);

      const stressStr = cardInst.currentStress !== undefined
        ? `Stress: ${cardInst.currentStress}/${card.crew.maxStress}`
        : `Max Stress: ${card.crew.maxStress}`;
      const stressT = this.addText(PAD, y, stressStr, {
        fontSize: fs(9), color: HEX.pearlAqua, fontFamily: "monospace",
      });
      y += stressT.height + s(2);

      const expertT = this.addText(PAD, y, `Expert: ${card.crew.expertAbilityDescription}`, {
        fontSize: fs(8), color: HEX.darkCyan, fontFamily: "monospace",
        wordWrap: { width: PANEL_W - s(24) },
      });
      y += expertT.height + s(2);

      if (card.crew.reassignCost) {
        const reassT = this.addText(PAD, y, `Reassign: ${formatCost(card.crew.reassignCost)}`, {
          fontSize: fs(8), color: HEX.darkCyan, fontFamily: "monospace",
        });
        y += reassT.height + s(2);
      }
    }

    // ── Construction-specific ──
    if (card.type === "structure" && card.construction) {
      y = this.addDivider(y);
      const con = card.construction;
      if (con.completionTime && con.completionTime > 0) {
        const progress = cardInst.underConstruction
          ? `${cardInst.constructionProgress ?? 0}/${con.completionTime}`
          : `${con.completionTime}`;
        const buildT = this.addText(PAD, y, `Build time: ${progress} turns`, {
          fontSize: fs(9), color: "#aa8844", fontFamily: "monospace",
        });
        y += buildT.height + s(2);
      }
      if (con.resourceRequirement) {
        let reqStr = `Requires: ${formatCost(con.resourceRequirement)}`;
        if (cardInst.underConstruction && cardInst.constructionResourcesAdded) {
          reqStr += ` (added: ${formatCost(cardInst.constructionResourcesAdded)})`;
        }
        const reqT = this.addText(PAD, y, reqStr, {
          fontSize: fs(8), color: "#aa8844", fontFamily: "monospace",
          wordWrap: { width: PANEL_W - s(24) },
        });
        y += reqT.height + s(2);
      }
      if (con.fastTrackable) {
        let ftStr = "Fast-trackable";
        if (con.fastTrackCost) ftStr += ` (${formatCost(con.fastTrackCost)}/turn)`;
        if (con.fastTrackEntropy) ftStr += ` +${con.fastTrackEntropy} entropy`;
        const ftT = this.addText(PAD, y, ftStr, {
          fontSize: fs(8), color: "#aa8844", fontFamily: "monospace",
          wordWrap: { width: PANEL_W - s(24) },
        });
        y += ftT.height + s(2);
      }
    }

    // ── Hazard-specific ──
    if (card.type === "hazard" && card.hazard) {
      y = this.addDivider(y);
      const hazLabel = card.hazard.onBuy === "return-to-vault"
        ? "Buy to suppress (returns to vault)"
        : "Buy to destroy";
      const hazT = this.addText(PAD, y, hazLabel, {
        fontSize: fs(9), color: HEX.dustyMauve, fontFamily: "monospace",
      });
      y += hazT.height + s(2);
    }

    // ── Junk-specific ──
    if (card.type === "junk" && card.junk) {
      y = this.addDivider(y);
      const remT = this.addText(PAD, y, `Remove cost: ${formatCost(card.junk.removalCost)}`, {
        fontSize: fs(9), color: HEX.dustyMauve, fontFamily: "monospace",
      });
      y += remT.height + s(2);
      const srcT = this.addText(PAD, y, `Source: ${card.junk.source}`, {
        fontSize: fs(8), color: HEX.darkCyan, fontFamily: "monospace",
      });
      y += srcT.height + s(2);
    }

    // ── Lifespan ──
    y = this.addDivider(y);
    const lifespanStr = cardInst.remainingLifespan !== null
      ? `Lifespan: ${cardInst.remainingLifespan} cycles`
      : "Immortal";
    const lifeT = this.addText(cx, y, lifespanStr, {
      fontSize: fs(9), color: HEX.pearlAqua, fontFamily: "monospace",
    });
    lifeT.setOrigin(0.5, 0);
    y += lifeT.height + s(4);

    // ── Tags ──
    if (card.primaryTag || (card.attributeTags && card.attributeTags.length > 0)) {
      const tagParts: string[] = [];
      if (card.primaryTag) tagParts.push(card.primaryTag);
      if (card.attributeTags) tagParts.push(...card.attributeTags);
      const tagT = this.addText(cx, y, tagParts.join(" | "), {
        fontSize: fs(8), color: HEX.darkCyan, fontFamily: "monospace",
      });
      tagT.setOrigin(0.5, 0);
      y += tagT.height + s(4);
    }

    // ── Flavor Text ──
    if (card.flavorText) {
      const flvT = this.addText(cx, y, card.flavorText, {
        fontSize: fs(8), color: HEX.darkCyan, fontFamily: "monospace", fontStyle: "italic",
        wordWrap: { width: PANEL_W - s(20) }, align: "center",
      });
      flvT.setOrigin(0.5, 0);
      y += flvT.height + s(4);
    }

    // ── Resize background ──
    const totalH = y + PAD;
    this.bg.setSize(PANEL_W, totalH);

    const pointer = this.scene.input.activePointer;
    this.positionNearPointer(pointer.x, pointer.y);
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  private groupEffectsByTiming(effects: CardEffect[]): Map<string, CardEffect[]> {
    const order = [
      "on-play", "on-acquire", "passive", "on-manned", "on-burnout",
      "on-sleep", "on-wake", "on-fallout", "on-discard", "on-death",
    ];
    const map = new Map<string, CardEffect[]>();
    for (const timing of order) {
      const matched = effects.filter((e) => e.timing === timing);
      if (matched.length > 0) map.set(timing, matched);
    }
    // Catch any timings not in order
    for (const eff of effects) {
      if (!map.has(eff.timing)) {
        map.set(eff.timing, [eff]);
      }
    }
    return map;
  }

  private timingLabel(timing: string): string {
    const labels: Record<string, string> = {
      "on-play": "ON PLAY:",
      "on-acquire": "ON ACQUIRE:",
      "passive": "PASSIVE:",
      "on-manned": "ON MANNED:",
      "on-burnout": "ON BURNOUT:",
      "on-sleep": "ON SLEEP:",
      "on-wake": "ON WAKE:",
      "on-fallout": "ON FALLOUT:",
      "on-discard": "ON DISCARD:",
      "on-death": "ON DEATH:",
    };
    return labels[timing] ?? timing.toUpperCase() + ":";
  }
}
