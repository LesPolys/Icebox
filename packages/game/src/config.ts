import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MainMenuScene } from "./scenes/MainMenuScene";
import { ActiveWatchScene } from "./scenes/ActiveWatchScene";
import { SuccessionScene } from "./scenes/SuccessionScene";
import { CryosleepScene } from "./scenes/CryosleepScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#212121",
  scene: [BootScene, MainMenuScene, ActiveWatchScene, SuccessionScene, CryosleepScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};
