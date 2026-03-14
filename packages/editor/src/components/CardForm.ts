import type { Card, CardType, CardTier, FactionId, EffectTiming, EffectType, DeathOutcome, JunkSource } from "@icebox/shared";
import { ALL_FACTION_IDS } from "@icebox/shared";
import type { MarketRowId } from "@icebox/shared";

/**
 * Dynamic form for editing all card properties.
 */
export class CardForm {
  private container: HTMLElement;
  private currentCard: Partial<Card> = {};
  public onChange: ((card: Partial<Card>) => void) | null = null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  loadCard(card: Card): void {
    this.currentCard = structuredClone(card);
    this.render();
  }

  loadBlank(): void {
    this.currentCard = {
      id: "",
      name: "",
      type: "action",
      faction: "neutral",
      tier: 1,
      art: "",
      cost: {},
      effects: [],
      factionIcons: [],
      tags: [],
      aging: { lifespan: 3, decayConditions: [], onDeath: "return-to-vault" },
      cryosleep: { inertiaContribution: {}, decayVulnerability: [], survivalPriority: 1, factionWeight: 1 },
      flavorText: "",
      designNotes: "",
    };
    this.render();
  }

  getCard(): Partial<Card> {
    return this.currentCard;
  }

  private render(): void {
    const c = this.currentCard;
    this.container.innerHTML = `
      <div class="form-section">
        <h3>Identity</h3>
        <div class="form-row">
          <div class="form-field">
            <label>ID</label>
            <input type="text" data-field="id" value="${c.id ?? ""}" placeholder="vf-001" />
          </div>
          <div class="form-field">
            <label>Name</label>
            <input type="text" data-field="name" value="${c.name ?? ""}" placeholder="Card Name" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Type</label>
            <select data-field="type">
              ${["location", "structure", "institution", "action", "event", "hazard", "junk"]
                .map((t) => `<option value="${t}" ${c.type === t ? "selected" : ""}>${t}</option>`)
                .join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Faction</label>
            <select data-field="faction">
              <option value="neutral" ${c.faction === "neutral" ? "selected" : ""}>neutral</option>
              ${ALL_FACTION_IDS.map(
                (f) => `<option value="${f}" ${c.faction === f ? "selected" : ""}>${f}</option>`
              ).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Tier</label>
            <select data-field="tier">
              ${[1, 2, 3].map((t) => `<option value="${t}" ${c.tier === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Art Key</label>
            <input type="text" data-field="art" value="${c.art ?? ""}" placeholder="cards/vf-example" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Cost & Gain</h3>
        <div class="form-row">
          <div class="form-field"><label>Matter Cost</label><input type="number" data-field="cost.matter" value="${c.cost?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Energy Cost</label><input type="number" data-field="cost.energy" value="${c.cost?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Data Cost</label><input type="number" data-field="cost.data" value="${c.cost?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Influence Cost</label><input type="number" data-field="cost.influence" value="${c.cost?.influence ?? 0}" min="0" /></div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Matter Gain</label><input type="number" data-field="gain.matter" value="${c.resourceGain?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Energy Gain</label><input type="number" data-field="gain.energy" value="${c.resourceGain?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Data Gain</label><input type="number" data-field="gain.data" value="${c.resourceGain?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Influence Gain</label><input type="number" data-field="gain.influence" value="${c.resourceGain?.influence ?? 0}" min="0" /></div>
        </div>
      </div>

      <div class="form-section">
        <h3>Aging & Mortality</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Lifespan (cycles, -1=immortal)</label>
            <input type="number" data-field="aging.lifespan" value="${c.aging?.lifespan ?? 3}" min="-1" />
          </div>
          <div class="form-field">
            <label>On Death</label>
            <select data-field="aging.onDeath">
              ${(["transform", "return-to-vault", "destroy"] as DeathOutcome[]).map(
                (d) => `<option value="${d}" ${c.aging?.onDeath === d ? "selected" : ""}>${d}</option>`
              ).join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Transform Into (card ID)</label>
            <input type="text" data-field="aging.transformInto" value="${c.aging?.transformInto ?? ""}" placeholder="vf-001b" />
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Cryosleep Metadata</h3>
        <div class="form-row">
          <div class="form-field"><label>Survival Priority</label><input type="number" data-field="cryosleep.survivalPriority" value="${c.cryosleep?.survivalPriority ?? 1}" min="0" /></div>
          <div class="form-field"><label>Faction Weight</label><input type="number" data-field="cryosleep.factionWeight" value="${c.cryosleep?.factionWeight ?? 1}" min="0" /></div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Inertia Matter</label><input type="number" data-field="cryosleep.inertia.matter" value="${c.cryosleep?.inertiaContribution?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Inertia Energy</label><input type="number" data-field="cryosleep.inertia.energy" value="${c.cryosleep?.inertiaContribution?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Inertia Data</label><input type="number" data-field="cryosleep.inertia.data" value="${c.cryosleep?.inertiaContribution?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Inertia Influence</label><input type="number" data-field="cryosleep.inertia.influence" value="${c.cryosleep?.inertiaContribution?.influence ?? 0}" min="0" /></div>
        </div>
      </div>

      <div class="form-section">
        <h3>Tags & Text</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Tags (comma-separated)</label>
            <input type="text" data-field="tags" value="${(c.tags ?? []).join(", ")}" placeholder="repair, infrastructure" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Faction Icons (comma-separated)</label>
            <input type="text" data-field="factionIcons" value="${(c.factionIcons ?? []).join(", ")}" placeholder="void-forged, sowers" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Flavor Text</label>
            <textarea data-field="flavorText">${c.flavorText ?? ""}</textarea>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Design Notes</label>
            <textarea data-field="designNotes">${c.designNotes ?? ""}</textarea>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h3>Effects (JSON)</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Effects Array (JSON)</label>
            <textarea data-field="effects" style="min-height:120px;font-size:10px">${JSON.stringify(c.effects ?? [], null, 2)}</textarea>
          </div>
        </div>
      </div>

      ${c.type === "hazard" ? `
      <div class="form-section">
        <h3>Hazard Data</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Target Row</label>
            <select data-field="hazard.targetRow">
              <option value="" ${!c.hazard?.targetRow ? "selected" : ""}>(auto / faction-based)</option>
              <option value="upper" ${c.hazard?.targetRow === "upper" ? "selected" : ""}>upper</option>
              <option value="lower" ${c.hazard?.targetRow === "lower" ? "selected" : ""}>lower</option>
            </select>
          </div>
          <div class="form-field">
            <label>On Buy</label>
            <select data-field="hazard.onBuy">
              <option value="destroy" ${c.hazard?.onBuy === "destroy" ? "selected" : ""}>destroy</option>
              <option value="return-to-vault" ${c.hazard?.onBuy === "return-to-vault" ? "selected" : ""}>return-to-vault</option>
            </select>
          </div>
        </div>
      </div>
      ` : ""}

      ${c.type === "location" ? `
      <div class="form-section">
        <h3>Location Data</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Sector</label>
            <select data-field="location.sector">
              <option value="0" ${c.location?.sector === 0 ? "selected" : ""}>0 — Engineering Core</option>
              <option value="1" ${c.location?.sector === 1 ? "selected" : ""}>1 — Habitat Rings</option>
              <option value="2" ${c.location?.sector === 2 ? "selected" : ""}>2 — Biosphere Sectors</option>
            </select>
          </div>
          <div class="form-field">
            <label>Structure Slots</label>
            <input type="number" data-field="location.structureSlots" value="${c.location?.structureSlots ?? 3}" min="1" max="6" />
          </div>
        </div>
      </div>
      ` : ""}

      ${c.type === "junk" ? `
      <div class="form-section">
        <h3>Junk Data</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Source</label>
            <select data-field="junk.source">
              ${(["hull-breach", "tech-decay", "factional-coup"] as const)
                .map((s) => `<option value="${s}" ${c.junk?.source === s ? "selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Removal Matter</label><input type="number" data-field="junk.cost.matter" value="${c.junk?.removalCost?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Removal Energy</label><input type="number" data-field="junk.cost.energy" value="${c.junk?.removalCost?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Removal Data</label><input type="number" data-field="junk.cost.data" value="${c.junk?.removalCost?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Removal Influence</label><input type="number" data-field="junk.cost.influence" value="${c.junk?.removalCost?.influence ?? 0}" min="0" /></div>
        </div>
      </div>
      ` : ""}
    `;

    // Bind change events
    this.container.querySelectorAll("input, select, textarea").forEach((el) => {
      el.addEventListener("input", () => {
        this.collectFormData();
        // Re-render when type changes to show/hide type-specific sections
        const field = (el as HTMLElement).dataset.field;
        if (field === "type") {
          this.render();
        }
      });
    });
  }

  private collectFormData(): void {
    const c = this.currentCard;

    const val = (field: string): string => {
      const el = this.container.querySelector(`[data-field="${field}"]`) as HTMLInputElement;
      return el?.value ?? "";
    };
    const num = (field: string): number => {
      const v = parseInt(val(field), 10);
      return isNaN(v) ? 0 : v;
    };

    c.id = val("id");
    c.name = val("name");
    c.type = val("type") as CardType;
    c.faction = val("faction") as FactionId | "neutral";
    c.tier = num("tier") as CardTier;
    c.art = val("art");

    c.cost = {};
    if (num("cost.matter") > 0) c.cost.matter = num("cost.matter");
    if (num("cost.energy") > 0) c.cost.energy = num("cost.energy");
    if (num("cost.data") > 0) c.cost.data = num("cost.data");
    if (num("cost.influence") > 0) c.cost.influence = num("cost.influence");

    c.resourceGain = {};
    if (num("gain.matter") > 0) c.resourceGain.matter = num("gain.matter");
    if (num("gain.energy") > 0) c.resourceGain.energy = num("gain.energy");
    if (num("gain.data") > 0) c.resourceGain.data = num("gain.data");
    if (num("gain.influence") > 0) c.resourceGain.influence = num("gain.influence");

    const lifespan = num("aging.lifespan");
    c.aging = {
      lifespan: lifespan < 0 ? null : lifespan,
      decayConditions: c.aging?.decayConditions ?? [],
      onDeath: val("aging.onDeath") as DeathOutcome,
      transformInto: val("aging.transformInto") || undefined,
    };

    c.cryosleep = {
      inertiaContribution: {},
      decayVulnerability: c.cryosleep?.decayVulnerability ?? [],
      survivalPriority: num("cryosleep.survivalPriority"),
      factionWeight: num("cryosleep.factionWeight"),
    };
    if (num("cryosleep.inertia.matter") > 0) c.cryosleep.inertiaContribution.matter = num("cryosleep.inertia.matter");
    if (num("cryosleep.inertia.energy") > 0) c.cryosleep.inertiaContribution.energy = num("cryosleep.inertia.energy");
    if (num("cryosleep.inertia.data") > 0) c.cryosleep.inertiaContribution.data = num("cryosleep.inertia.data");
    if (num("cryosleep.inertia.influence") > 0) c.cryosleep.inertiaContribution.influence = num("cryosleep.inertia.influence");

    c.tags = val("tags").split(",").map((t) => t.trim()).filter(Boolean);
    c.factionIcons = val("factionIcons").split(",").map((t) => t.trim()).filter(Boolean) as FactionId[];
    c.flavorText = val("flavorText") || undefined;
    c.designNotes = val("designNotes") || undefined;

    // Parse effects JSON
    try {
      c.effects = JSON.parse(val("effects") || "[]");
    } catch {
      // Keep existing effects if JSON is invalid
    }

    // Type-specific data
    if (c.type === "hazard") {
      const targetRow = val("hazard.targetRow") as MarketRowId | "";
      c.hazard = {
        targetRow: targetRow || undefined,
        onBuy: (val("hazard.onBuy") as "destroy" | "return-to-vault") || "destroy",
      };
    } else {
      delete c.hazard;
    }

    if (c.type === "location") {
      c.location = {
        sector: num("location.sector"),
        structureSlots: num("location.structureSlots") || 3,
      };
    } else {
      delete c.location;
    }

    if (c.type === "junk") {
      const removalCost: Record<string, number> = {};
      if (num("junk.cost.matter") > 0) removalCost.matter = num("junk.cost.matter");
      if (num("junk.cost.energy") > 0) removalCost.energy = num("junk.cost.energy");
      if (num("junk.cost.data") > 0) removalCost.data = num("junk.cost.data");
      if (num("junk.cost.influence") > 0) removalCost.influence = num("junk.cost.influence");
      c.junk = {
        source: (val("junk.source") as JunkSource) || "hull-breach",
        removalCost,
      };
    } else {
      delete c.junk;
    }

    this.onChange?.(c);
  }
}
