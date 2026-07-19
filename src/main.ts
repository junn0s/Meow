import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./game/scenes/BootScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { GameScene } from "./game/scenes/GameScene";
import { ResultScene } from "./game/scenes/ResultScene";
import {
  RENDER_HEIGHT,
  RENDER_WIDTH,
  shouldUseMobilePowerProfile,
} from "./game/art/Presentation";
import { bindTouchControls } from "./game/input/TouchControls";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

const mobilePowerProfile = shouldUseMobilePowerProfile();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: RENDER_WIDTH,
  height: RENDER_HEIGHT,
  backgroundColor: "#0b1026",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: RENDER_WIDTH,
    height: RENDER_HEIGHT,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    powerPreference: mobilePowerProfile ? "low-power" : "default",
  },
  fps: mobilePowerProfile
    ? { target: 30, limit: 30, min: 20, smoothStep: true }
    : { target: 60, limit: 60, min: 30, smoothStep: true },
  scene: [BootScene, MenuScene, GameScene, ResultScene],
};

const game = new Phaser.Game(config);
const removeTouchControls = bindTouchControls();
registerServiceWorker();
const requestProgressSave = (): void => {
  game.events.emit("app-before-unload");
};

window.addEventListener("pagehide", requestProgressSave);
document.addEventListener("visibilitychange", () => {
  const hidden = document.visibilityState === "hidden";
  if (hidden) {
    game.events.emit("app-visibility-change", true);
    requestProgressSave();
    game.loop.sleep();
  } else {
    game.loop.wake();
    game.events.emit("app-visibility-change", false);
  }
});

window.addEventListener("beforeunload", () => {
  requestProgressSave();
  removeTouchControls();
});
