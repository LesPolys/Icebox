import type { Card } from "@icebox/shared";
import coreSetData from "../../shared/data/cards/core-set.json";
import { StorageService } from "./services/StorageService";
import { CardValidator } from "./services/CardValidator";
import { CardForm } from "./components/CardForm";
import { CardPreview } from "./components/CardPreview";
import { DeckList } from "./components/DeckList";
import { JsonExport } from "./components/JsonExport";

// ─── Initialize services ──────────────────────────────────────────────

const storage = new StorageService();
const validator = new CardValidator("validation-output");
const form = new CardForm("card-form-container");
const preview = new CardPreview("card-preview");
const deckList = new DeckList("deck-list", "search-input");

// Load core set into storage if empty
if (storage.getAll().length === 0) {
  const coreCards = (coreSetData as { cards: Card[] }).cards;
  storage.importCards(coreCards);
}

// ─── Wire components ──────────────────────────────────────────────────

// Form changes update preview and validation
form.onChange = (card) => {
  preview.update(card);
  validator.validate(card);
};

// Deck list selection loads card into form
deckList.onCardSelected = (card) => {
  form.loadCard(card);
  preview.update(card);
  validator.validate(card);
};

// Refresh deck list
function refreshDeckList(): void {
  deckList.setCards(storage.getAll());
}

// ─── Header button actions ────────────────────────────────────────────

document.getElementById("btn-new")!.addEventListener("click", () => {
  form.loadBlank();
  preview.update(form.getCard());
});

document.getElementById("btn-import")!.addEventListener("click", () => {
  document.getElementById("file-import")!.click();
});

document.getElementById("file-import")!.addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const cards = JsonExport.parseImport(reader.result as string);
      const count = storage.importCards(cards);
      refreshDeckList();
      alert(`Imported ${count} cards.`);
    } catch (err) {
      alert(`Import failed: ${err}`);
    }
  };
  reader.readAsText(file);
});

document.getElementById("btn-export-all")!.addEventListener("click", () => {
  const json = storage.exportAll();
  JsonExport.downloadJson(json, "icebox-cards.json");
});

// ─── Save current card on change ──────────────────────────────────────

// Add a "Save Card" mechanism
const origOnChange = form.onChange;
form.onChange = (card) => {
  origOnChange?.(card);

  // Auto-save if card has valid ID
  if (card.id && card.name) {
    storage.upsert(card as Card);
    refreshDeckList();
  }
};

// ─── Initial render ───────────────────────────────────────────────────

refreshDeckList();

// Load first card
const allCards = storage.getAll();
if (allCards.length > 0) {
  form.loadCard(allCards[0]);
  preview.update(allCards[0]);
  deckList.selectCard(allCards[0].id);
}

console.log("Icebox Card Editor loaded.");
