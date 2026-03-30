import Phaser from "phaser";
import { gameConfig } from "./config";
import { recalculateLayout } from "./ui/layout";
import { recalculateCardDimensions } from "./game-objects/CardSprite";
import { BootScene } from "./scenes/BootScene";

// Launch the game
const game = new Phaser.Game(gameConfig);

// Expose for debugging
(window as unknown as Record<string, unknown>).__ICEBOX_GAME = game;

// Debounced resize handler: recalculate layout + textures, then restart active scene
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
window.addEventListener("resize", () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    recalculateLayout();
    recalculateCardDimensions();
    game.scale.resize(window.innerWidth, window.innerHeight);

    // Regenerate textures at new scale
    const bootScene = game.scene.getScene(BootScene.KEY) as BootScene;
    if (bootScene) bootScene.regenerateTextures();

    // Restart the active scene with its current data
    const active = game.scene.getScenes(true)[0];
    if (active && active.scene.key !== BootScene.KEY) {
      const data = (active as any).__restartData;
      active.scene.restart(data);
    }
  }, 300);
});
