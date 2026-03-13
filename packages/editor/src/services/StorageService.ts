import type { Card } from "@icebox/shared";

const STORAGE_KEY = "icebox_editor_cards";

/**
 * IndexedDB-like storage for the card editor (using localStorage for MVP).
 */
export class StorageService {
  private cards: Map<string, Card> = new Map();

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Card[];
        for (const card of arr) {
          this.cards.set(card.id, card);
        }
      }
    } catch (e) {
      console.error("Failed to load editor cards:", e);
    }
  }

  private save(): void {
    try {
      const arr = Array.from(this.cards.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.error("Failed to save editor cards:", e);
    }
  }

  getAll(): Card[] {
    return Array.from(this.cards.values());
  }

  get(id: string): Card | undefined {
    return this.cards.get(id);
  }

  upsert(card: Card): void {
    this.cards.set(card.id, card);
    this.save();
  }

  delete(id: string): void {
    this.cards.delete(id);
    this.save();
  }

  importCards(cards: Card[]): number {
    let count = 0;
    for (const card of cards) {
      this.cards.set(card.id, card);
      count++;
    }
    this.save();
    return count;
  }

  exportAll(): string {
    return JSON.stringify(
      {
        setId: "custom",
        setName: "Custom Card Set",
        cards: this.getAll(),
      },
      null,
      2
    );
  }

  clear(): void {
    this.cards.clear();
    this.save();
  }
}
