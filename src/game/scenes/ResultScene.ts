import Phaser from "phaser";
import { createMenuBackdrop, UI_FONT } from "../art/SceneDecor";
import { SoundManager } from "../audio/SoundManager";
import { PixelButton } from "../../ui/PixelButton";
import { SaveSystem } from "../systems/SaveSystem";
import { configureHighDefinitionScene } from "../art/Presentation";

export interface ResultSceneData {
  readonly money?: number;
  readonly customerCount?: number;
  readonly rating?: number;
  readonly elapsedMs?: number;
}

export class ResultScene extends Phaser.Scene {
  public constructor() {
    super("ResultScene");
  }

  public create(data: ResultSceneData): void {
    configureHighDefinitionScene(this);
    createMenuBackdrop(this);
    this.add.rectangle(240, 135, 480, 270, 0x0a0d1d, 0.66).setDepth(15);
    const save = new SaveSystem().load();
    const sound = new SoundManager(save?.muted ?? false);
    void sound.unlock();
    sound.clear();

    this.add.image(240, 59, "sign-moon").setScale(1.55).setDepth(30);
    this.add
      .text(240, 92, "달빛 야식당 완성!", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "22px",
        color: "#fff0ad",
        stroke: "#703139",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(31);
    this.add
      .text(240, 117, "오늘 밤도 모두의 배와 마음을 따뜻하게 채웠어요.", {
        fontFamily: UI_FONT,
        fontSize: "9px",
        color: "#c8d1e8",
      })
      .setOrigin(0.5)
      .setDepth(31);

    const elapsedMs = data.elapsedMs ?? 0;
    const seconds = Math.floor(elapsedMs / 1000);
    const stats = [
      ["찾아온 손님", `${data.customerCount ?? 0}명`],
      ["남은 매출", `${(data.money ?? 0).toLocaleString("ko-KR")}냥`],
      ["가게 평점", `${(data.rating ?? 5).toFixed(1)} / 5.0`],
      ["영업 시간", `${Math.floor(seconds / 60)}분 ${seconds % 60}초`],
    ] as const;
    this.add.rectangle(240, 158, 260, 54, 0x18203a, 0.96).setStrokeStyle(1, 0x5f6b91).setDepth(30);
    stats.forEach(([label, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? 180 : 300;
      const y = 143 + row * 23;
      this.add
        .text(x, y, label, { fontFamily: UI_FONT, fontSize: "7px", color: "#8f9cbd" })
        .setOrigin(0.5)
        .setDepth(31);
      this.add
        .text(x, y + 9, value, { fontFamily: UI_FONT, fontStyle: "bold", fontSize: "9px", color: "#ffe3a0" })
        .setOrigin(0.5)
        .setDepth(31);
    });

    new PixelButton(this, 240, 210, "새로운 밤 시작", () => {
      sound.click();
      this.scene.start("GameScene", { newGame: true });
    }, { width: 140, height: 28, primary: true, fontSize: 10 }).setDepth(40);
    new PixelButton(this, 240, 243, "타이틀로", () => {
      sound.click();
      this.scene.start("MenuScene");
    }, { width: 100, height: 22, primary: false, fontSize: 8 }).setDepth(40);

    for (let index = 0; index < 28; index += 1) {
      const sparkle = this.add
        .image(Phaser.Math.Between(40, 440), Phaser.Math.Between(24, 195), "sparkle")
        .setDepth(25)
        .setAlpha(0);
      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0, to: 1 },
        scaleX: { from: 0.4, to: 1.3 },
        scaleY: { from: 0.4, to: 1.3 },
        duration: Phaser.Math.Between(500, 900),
        delay: index * 65,
        yoyo: true,
        repeat: -1,
      });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sound.dispose());
    setStatus("달빛 야식당을 완성했습니다.");
  }
}

function setStatus(message: string): void {
  const element = document.querySelector<HTMLElement>("#status-message");
  if (element !== null) {
    element.textContent = message;
  }
}
