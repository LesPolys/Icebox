import type { Card } from "@icebox/shared";

/**
 * JSON export/download functionality for the card editor.
 */
export class JsonExport {
  /**
   * Copy JSON string to clipboard.
   */
  static copyToClipboard(json: string): void {
    navigator.clipboard.writeText(json).then(
      () => alert("Copied to clipboard!"),
      () => alert("Failed to copy.")
    );
  }

  /**
   * Download JSON as a file.
   */
  static downloadJson(json: string, filename: string): void {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export a single card as JSON.
   */
  static exportCard(card: Card): string {
    return JSON.stringify(card, null, 2);
  }

  /**
   * Export multiple cards as a card set JSON.
   */
  static exportSet(cards: Card[], setName = "Custom Set"): string {
    return JSON.stringify(
      { setId: "custom", setName, cards },
      null,
      2
    );
  }

  /**
   * Parse imported JSON file contents.
   */
  static parseImport(jsonString: string): Card[] {
    const parsed = JSON.parse(jsonString);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.cards && Array.isArray(parsed.cards)) return parsed.cards;
    if (parsed.id && parsed.name) return [parsed]; // single card
    throw new Error("Unrecognized JSON format");
  }
}
