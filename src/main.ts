import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./game/scenes/BootScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { GameScene } from "./game/scenes/GameScene";
import { ResultScene } from "./game/scenes/ResultScene";
import { RENDER_HEIGHT, RENDER_WIDTH } from "./game/art/Presentation";
import { bindTouchControls } from "./game/input/TouchControls";

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
  },
  scene: [BootScene, MenuScene, GameScene, ResultScene],
};

const game = new Phaser.Game(config);
const removeTouchControls = bindTouchControls();

window.addEventListener("beforeunload", () => {
  removeTouchControls();
  game.events.emit("app-before-unload");
});
