import type { Card, CardType, CardTier, FactionId, EffectTiming, EffectType, DeathOutcome, JunkSource, PrimaryCategoryTag, AttributeTag, SkillTag } from "@icebox/shared";
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
              ${["location", "structure", "institution", "action", "event", "hazard", "junk", "crew"]
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
            <label>Primary Category</label>
            <select data-field="primaryTag">
              <option value="" ${!c.primaryTag ? "selected" : ""}>(none)</option>
              ${(["Machine", "Organic", "Law", "Tech"] as const)
                .map((t) => `<option value="${t}" ${c.primaryTag === t ? "selected" : ""}>${t}</option>`)
                .join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Attribute Tags (comma-separated)</label>
            <input type="text" data-field="attributeTags" value="${(c.attributeTags ?? []).join(", ")}" placeholder="Hazard, Persistent, Fragile, Heavy" />
          </div>
        </div>
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
              <option value="0" ${c.location?.sector === 0 ? "selected" : ""}>0 — Engineering Bay</option>
              <option value="1" ${c.location?.sector === 1 ? "selected" : ""}>1 — Habitat Ring</option>
              <option value="2" ${c.location?.sector === 2 ? "selected" : ""}>2 — Command Deck</option>
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

      ${c.type === "crew" ? `
      <div class="form-section">
        <h3>Crew Data</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Skill Tag</label>
            <select data-field="crew.skillTag">
              ${(["Engineer", "Botanist", "Orator", "Logic"] as const)
                .map((s) => `<option value="${s}" ${c.crew?.skillTag === s ? "selected" : ""}>${s}</option>`)
                .join("")}
            </select>
          </div>
          <div class="form-field">
            <label>Max Stress (3-5)</label>
            <input type="number" data-field="crew.maxStress" value="${c.crew?.maxStress ?? 3}" min="3" max="5" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Expert Ability Description</label>
            <textarea data-field="crew.expertAbilityDescription">${c.crew?.expertAbilityDescription ?? ""}</textarea>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Reassign Matter</label><input type="number" data-field="crew.reassign.matter" value="${c.crew?.reassignCost?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Reassign Energy</label><input type="number" data-field="crew.reassign.energy" value="${c.crew?.reassignCost?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Reassign Data</label><input type="number" data-field="crew.reassign.data" value="${c.crew?.reassignCost?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Reassign Influence</label><input type="number" data-field="crew.reassign.influence" value="${c.crew?.reassignCost?.influence ?? 1}" min="0" /></div>
        </div>
      </div>
      ` : ""}

      ${c.type === "structure" ? `
      <div class="form-section">
        <h3>Construction (optional)</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Completion Time (turns, 0=instant)</label>
            <input type="number" data-field="construction.completionTime" value="${c.construction?.completionTime ?? 0}" min="0" />
          </div>
          <div class="form-field">
            <label>Fast-Trackable</label>
            <select data-field="construction.fastTrackable">
              <option value="false" ${!c.construction?.fastTrackable ? "selected" : ""}>No</option>
              <option value="true" ${c.construction?.fastTrackable ? "selected" : ""}>Yes</option>
            </select>
          </div>
          <div class="form-field">
            <label>Fast-Track Entropy</label>
            <input type="number" data-field="construction.fastTrackEntropy" value="${c.construction?.fastTrackEntropy ?? 2}" min="0" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Required Matter</label><input type="number" data-field="construction.req.matter" value="${c.construction?.resourceRequirement?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Required Energy</label><input type="number" data-field="construction.req.energy" value="${c.construction?.resourceRequirement?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Required Data</label><input type="number" data-field="construction.req.data" value="${c.construction?.resourceRequirement?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Required Influence</label><input type="number" data-field="construction.req.influence" value="${c.construction?.resourceRequirement?.influence ?? 0}" min="0" /></div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Fast-Track Matter</label><input type="number" data-field="construction.ft.matter" value="${c.construction?.fastTrackCost?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Fast-Track Energy</label><input type="number" data-field="construction.ft.energy" value="${c.construction?.fastTrackCost?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Fast-Track Data</label><input type="number" data-field="construction.ft.data" value="${c.construction?.fastTrackCost?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Fast-Track Influence</label><input type="number" data-field="construction.ft.influence" value="${c.construction?.fastTrackCost?.influence ?? 0}" min="0" /></div>
        </div>
      </div>
      ` : ""}

      ${c.type === "event" || c.type === "hazard" ? `
      <div class="form-section">
        <h3>Crisis Data (optional)</h3>
        <div class="form-row">
          <div class="form-field">
            <label>Is Crisis (triggers cryosleep)</label>
            <select data-field="crisis.isCrisis">
              <option value="false" ${!c.crisis?.isCrisis ? "selected" : ""}>No</option>
              <option value="true" ${c.crisis?.isCrisis ? "selected" : ""}>Yes</option>
            </select>
          </div>
          <div class="form-field">
            <label>Reactive Entropy Penalty</label>
            <input type="number" data-field="crisis.reactiveEntropyPenalty" value="${c.crisis?.reactiveEntropyPenalty ?? 5}" min="0" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field"><label>Proactive Matter</label><input type="number" data-field="crisis.proactive.matter" value="${c.crisis?.proactiveCost?.matter ?? 0}" min="0" /></div>
          <div class="form-field"><label>Proactive Energy</label><input type="number" data-field="crisis.proactive.energy" value="${c.crisis?.proactiveCost?.energy ?? 0}" min="0" /></div>
          <div class="form-field"><label>Proactive Data</label><input type="number" data-field="crisis.proactive.data" value="${c.crisis?.proactiveCost?.data ?? 0}" min="0" /></div>
          <div class="form-field"><label>Proactive Influence</label><input type="number" data-field="crisis.proactive.influence" value="${c.crisis?.proactiveCost?.influence ?? 0}" min="0" /></div>
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

    // Primary category tag
    const primaryTag = val("primaryTag") as PrimaryCategoryTag | "";
    c.primaryTag = primaryTag || undefined;

    // Attribute tags
    const attrTagStr = val("attributeTags");
    c.attributeTags = attrTagStr
      ? attrTagStr.split(",").map((t) => t.trim()).filter(Boolean) as AttributeTag[]
      : undefined;
    if (c.attributeTags && c.attributeTags.length === 0) c.attributeTags = undefined;

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

    // Crew-specific data
    if (c.type === "crew") {
      const reassignCost: Record<string, number> = {};
      if (num("crew.reassign.matter") > 0) reassignCost.matter = num("crew.reassign.matter");
      if (num("crew.reassign.energy") > 0) reassignCost.energy = num("crew.reassign.energy");
      if (num("crew.reassign.data") > 0) reassignCost.data = num("crew.reassign.data");
      if (num("crew.reassign.influence") > 0) reassignCost.influence = num("crew.reassign.influence");
      c.crew = {
        skillTag: (val("crew.skillTag") as SkillTag) || "Engineer",
        maxStress: Math.max(3, Math.min(5, num("crew.maxStress") || 3)),
        expertAbilityDescription: val("crew.expertAbilityDescription") || "",
        reassignCost: Object.keys(reassignCost).length > 0 ? reassignCost : undefined,
      };
    } else {
      delete c.crew;
    }

    // Construction data (optional for structures)
    if (c.type === "structure") {
      const completionTime = num("construction.completionTime");
      const reqCost: Record<string, number> = {};
      if (num("construction.req.matter") > 0) reqCost.matter = num("construction.req.matter");
      if (num("construction.req.energy") > 0) reqCost.energy = num("construction.req.energy");
      if (num("construction.req.data") > 0) reqCost.data = num("construction.req.data");
      if (num("construction.req.influence") > 0) reqCost.influence = num("construction.req.influence");
      const ftCost: Record<string, number> = {};
      if (num("construction.ft.matter") > 0) ftCost.matter = num("construction.ft.matter");
      if (num("construction.ft.energy") > 0) ftCost.energy = num("construction.ft.energy");
      if (num("construction.ft.data") > 0) ftCost.data = num("construction.ft.data");
      if (num("construction.ft.influence") > 0) ftCost.influence = num("construction.ft.influence");
      const hasReqs = completionTime > 0 || Object.keys(reqCost).length > 0;
      if (hasReqs) {
        c.construction = {
          completionTime: completionTime > 0 ? completionTime : undefined,
          resourceRequirement: Object.keys(reqCost).length > 0 ? reqCost : undefined,
          fastTrackable: val("construction.fastTrackable") === "true",
          fastTrackCost: Object.keys(ftCost).length > 0 ? ftCost : undefined,
          fastTrackEntropy: num("construction.fastTrackEntropy") || undefined,
        };
      } else {
        delete c.construction;
      }
    } else {
      delete c.construction;
    }

    // Crisis data (optional for events/hazards)
    if (c.type === "event" || c.type === "hazard") {
      const isCrisis = val("crisis.isCrisis") === "true";
      if (isCrisis) {
        const proactiveCost: Record<string, number> = {};
        if (num("crisis.proactive.matter") > 0) proactiveCost.matter = num("crisis.proactive.matter");
        if (num("crisis.proactive.energy") > 0) proactiveCost.energy = num("crisis.proactive.energy");
        if (num("crisis.proactive.data") > 0) proactiveCost.data = num("crisis.proactive.data");
        if (num("crisis.proactive.influence") > 0) proactiveCost.influence = num("crisis.proactive.influence");
        c.crisis = {
          isCrisis: true,
          proactiveCost: Object.keys(proactiveCost).length > 0 ? proactiveCost : undefined,
          reactiveEntropyPenalty: num("crisis.reactiveEntropyPenalty") || undefined,
        };
      } else {
        delete c.crisis;
      }
    } else {
      delete c.crisis;
    }

    this.onChange?.(c);
  }
}
