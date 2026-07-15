import Phaser from "phaser";
import { createPixelArtTextures } from "../art/PixelArtFactory";
import { UI_FONT } from "../art/SceneDecor";
import { configureHighDefinitionScene } from "../art/Presentation";

export class BootScene extends Phaser.Scene {
  public constructor() {
    super("BootScene");
  }

  public create(): void {
    configureHighDefinitionScene(this);
    this.cameras.main.setBackgroundColor(0x0b1026);
    const moon = this.add.circle(240, 105, 17, 0xffe49b, 1);
    this.add.circle(247, 100, 16, 0x0b1026, 1);
    const title = this.add
      .text(240, 143, "냥포차 불을 켜는 중…", {
        fontFamily: UI_FONT,
        fontSize: "12px",
        color: "#ffe1a0",
      })
      .setOrigin(0.5);
    const progressBackground = this.add.rectangle(240, 165, 142, 5, 0x222b49, 1);
    const progress = this.add
      .rectangle(170, 165, 0, 3, 0xf0a259, 1)
      .setOrigin(0, 0.5);

    this.tweens.add({ targets: moon, alpha: 0.65, duration: 600, yoyo: true, repeat: -1 });
    createPixelArtTextures(this);
    progress.width = 140;
    title.setText("따뜻한 자리를 준비했어요");
    setStatus("게임 리소스 준비 완료");

    this.time.delayedCall(220, () => {
      progressBackground.destroy();
      this.scene.start("MenuScene");
    });
  }
}

function setStatus(message: string): void {
  const element = document.querySelector<HTMLElement>("#status-message");
  if (element !== null) {
    element.textContent = message;
  }
}
