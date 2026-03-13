import type { Card } from "@icebox/shared";
import { FACTIONS } from "@icebox/shared";

/**
 * Live visual preview of a card.
 */
export class CardPreview {
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  update(card: Partial<Card>): void {
    const faction = card.faction && card.faction !== "neutral" ? FACTIONS[card.faction] : null;
    const headerColor = faction ? faction.color : "#555555";

    const costParts: string[] = [];
    if (card.cost?.matter) costParts.push(`M:${card.cost.matter}`);
    if (card.cost?.energy) costParts.push(`E:${card.cost.energy}`);
    if (card.cost?.data) costParts.push(`D:${card.cost.data}`);
    if (card.cost?.influence) costParts.push(`I:${card.cost.influence}`);

    const effectsHtml = (card.effects ?? [])
      .map((e) => `<div>• ${e.description}</div>`)
      .join("");

    const lifespan = card.aging?.lifespan !== null && card.aging?.lifespan !== undefined
      ? `⏳ ${card.aging.lifespan} cycles`
      : "∞ Immortal";

    this.container.innerHTML = `
      <div class="preview-card" style="border-color: ${headerColor}">
        <div class="pc-header" style="background: ${headerColor}40">
          <div class="pc-name">${card.name || "Untitled Card"}</div>
          <div class="pc-type">${card.type ?? "?"} — T${card.tier ?? "?"}</div>
        </div>
        <div class="pc-cost">${costParts.join(" ") || "Free"}</div>
        <div class="pc-effects">${effectsHtml || '<span style="color:#445566">No effects</span>'}</div>
        <div class="pc-bottom">
          <div class="pc-lifespan">${lifespan}</div>
          <div class="pc-flavor">${card.flavorText ?? ""}</div>
          <div style="color:#445566;margin-top:4px">${card.id ?? "no-id"} | ${faction?.name ?? "Neutral"}</div>
        </div>
      </div>
    `;
  }
}
