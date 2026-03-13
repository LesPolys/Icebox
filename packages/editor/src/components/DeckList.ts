import type { Card } from "@icebox/shared";
import { FACTIONS } from "@icebox/shared";

/**
 * Sidebar list of all cards in the editor.
 */
export class DeckList {
  private container: HTMLElement;
  private searchInput: HTMLInputElement;
  private cards: Card[] = [];
  private selectedId: string | null = null;
  public onCardSelected: ((card: Card) => void) | null = null;

  constructor(listContainerId: string, searchInputId: string) {
    this.container = document.getElementById(listContainerId)!;
    this.searchInput = document.getElementById(searchInputId) as HTMLInputElement;

    this.searchInput.addEventListener("input", () => this.render());
  }

  setCards(cards: Card[]): void {
    this.cards = cards;
    this.render();
  }

  selectCard(id: string): void {
    this.selectedId = id;
    this.render();
  }

  private render(): void {
    const filter = this.searchInput.value.toLowerCase();
    const filtered = this.cards.filter(
      (c) =>
        c.name.toLowerCase().includes(filter) ||
        c.id.toLowerCase().includes(filter) ||
        c.faction.toLowerCase().includes(filter) ||
        c.type.toLowerCase().includes(filter)
    );

    this.container.innerHTML = filtered
      .map((card) => {
        const faction = card.faction !== "neutral" ? FACTIONS[card.faction] : null;
        const dotColor = faction ? faction.color : "#555555";
        const selected = card.id === this.selectedId ? "selected" : "";

        return `
          <div class="deck-item ${selected}" data-id="${card.id}">
            <span class="faction-dot" style="background:${dotColor}"></span>
            <span>${card.name}</span>
            <span class="card-id">${card.id}</span>
          </div>
        `;
      })
      .join("");

    // Bind clicks
    this.container.querySelectorAll(".deck-item").forEach((el) => {
      el.addEventListener("click", () => {
        const id = (el as HTMLElement).dataset.id!;
        const card = this.cards.find((c) => c.id === id);
        if (card) {
          this.selectedId = id;
          this.render();
          this.onCardSelected?.(card);
        }
      });
    });
  }
}
