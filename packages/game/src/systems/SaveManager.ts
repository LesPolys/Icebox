import type { GameState } from "@icebox/shared";
import { serializeGameState, deserializeGameState } from "./GameStateManager";

const SAVE_KEY = "icebox_save";
const SAVE_VERSION = 1;

interface SaveData {
  version: number;
  timestamp: number;
  state: GameState;
}

/**
 * Save game state to localStorage.
 */
export function saveGame(state: GameState): boolean {
  try {
    const saveData: SaveData = {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      state,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (e) {
    console.error("Failed to save game:", e);
    return false;
  }
}

/**
 * Load game state from localStorage.
 */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saveData = JSON.parse(raw) as SaveData;
    if (saveData.version !== SAVE_VERSION) {
      console.warn("Save version mismatch, discarding save.");
      return null;
    }
    return saveData.state;
  } catch (e) {
    console.error("Failed to load game:", e);
    return null;
  }
}

/**
 * Check if a save exists.
 */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * Delete the save.
 */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/**
 * Export save as downloadable JSON file.
 */
export function exportSave(state: GameState): void {
  const blob = new Blob([serializeGameState(state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `icebox-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
