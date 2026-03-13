import Phaser from "phaser";
import { gameConfig } from "./config";

// Launch the game
const game = new Phaser.Game(gameConfig);

// Expose for debugging
(window as unknown as Record<string, unknown>).__ICEBOX_GAME = game;
