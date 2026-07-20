import Phaser from "phaser";
import { createMenuBackdrop, UI_FONT } from "../art/SceneDecor";
import { SoundManager } from "../audio/SoundManager";
import { SaveSystem } from "../systems/SaveSystem";
import { PixelButton } from "../../ui/PixelButton";
import { configureHighDefinitionScene } from "../art/Presentation";
import { touchInput } from "../input/TouchControls";
import { getChapter } from "../data/chapterData";

export class MenuScene extends Phaser.Scene {
  private readonly saveSystem = new SaveSystem();
  private effects?: SoundManager;
  private confirmingReset = false;

  public constructor() {
    super("MenuScene");
  }

  public create(): void {
    configureHighDefinitionScene(this);
    this.confirmingReset = false;
    const save = this.saveSystem.load();
    const reducedMotion = save?.settings.reducedMotion
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const chapter = getChapter(save?.progression.chapterId ?? 1);
    createMenuBackdrop(this, reducedMotion, chapter.id);
    this.effects = SoundManager.forRegistry(this.registry, save?.settings ?? false);
    this.effects.setMusicPaused(false);
    this.effects.setMenuMusic();
    const handleVisibilityChange = (): void => {
      this.effects?.setMusicPaused(document.visibilityState === "hidden");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    this.add
      .text(240, 28, "냥포차", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "30px",
        color: "#fff0bd",
        stroke: "#6e2e35",
        strokeThickness: 5,
        shadow: { color: "#f39851", blur: 8, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.add
      .text(240, 59, "FIVE RESTAURANT JOURNEY", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "11px",
        color: "#ffc977",
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.add
      .text(240, 79, `CHAPTER ${chapter.id} · ${chapter.shortTitle}`, {
        fontFamily: UI_FONT,
        fontSize: "8px",
        color: "#aeb9d8",
      })
      .setOrigin(0.5)
      .setDepth(30);

    const cat = this.add.image(240, 164, "player-down-0").setScale(1.5).setDepth(35);
    this.add.image(203, 166, "chef-0").setScale(1.15).setDepth(34).setAlpha(0.92);
    this.add.image(277, 166, "server-0").setScale(1.15).setDepth(34).setAlpha(0.92);
    if (!reducedMotion) {
      this.tweens.add({ targets: cat, y: 162, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
    this.add.image(241, 126, "steam-0").setScale(1.2).setDepth(36).setAlpha(0.65);

    const hasSave = save !== null;
    const continueLabel = save?.cleared === true ? "완성 기록 보기" : hasSave ? `CH.${chapter.id} 이어하기` : "CH.1 영업 시작";
    const primaryAction = (): void => {
      void this.effects?.unlock();
      if (save?.cleared === true) {
          this.openResult(
            save.money,
            save.customerCount,
            save.rating,
            save.elapsedMs,
            save.progression.chapterId,
          );
      } else {
        this.startGame(!hasSave);
      }
    };
    const primaryButton = new PixelButton(
      this,
      240,
      218,
      continueLabel,
      primaryAction,
      { width: 142, height: 30, primary: true, fontSize: 11 },
    ).setDepth(40);

    if (hasSave) {
      new PixelButton(
        this,
        240,
        251,
        "새 밤 시작",
        () => this.confirmNewGame(primaryButton),
        { width: 112, height: 22, primary: false, fontSize: 8 },
      ).setDepth(40);
      this.add
        .text(468, 260, `${save.customerCount}명 · ${save.money.toLocaleString("ko-KR")}냥`, {
          fontFamily: UI_FONT,
          fontSize: "7px",
          color: "#697596",
        })
        .setOrigin(1)
        .setDepth(40);
    }

    const muteText = this.add
      .text(468, 10, this.effects.isMuted ? "소리 끔" : "소리 켬", {
        fontFamily: UI_FONT,
        fontSize: "8px",
        color: "#c2cae1",
        backgroundColor: "#1c2440cc",
        padding: { x: 5, y: 3 },
      })
      .setOrigin(1, 0)
      .setDepth(60)
      .setInteractive({ useHandCursor: true });
    muteText.on("pointerdown", () => {
      const muted = this.effects?.toggleMute() ?? false;
      muteText.setText(muted ? "소리 끔" : "소리 켬");
      if (save !== null) {
        this.saveSystem.save({ ...save, muted, settings: { ...save.settings, ...this.effects?.settings, muted } });
      }
    });

    const keyboard = this.input.keyboard;
    const unlockAudio = (): void => {
      void this.effects?.unlock();
    };
    this.input.on(Phaser.Input.Events.POINTER_DOWN, unlockAudio);
    keyboard?.on("keydown", unlockAudio);
    keyboard?.once("keydown-ENTER", primaryAction);
    keyboard?.once("keydown-N", () => this.confirmNewGame(primaryButton));
    const removeTouchAction = touchInput.subscribe("action", primaryAction);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, unlockAudio);
      keyboard?.off("keydown", unlockAudio);
      removeTouchAction();
      touchInput.resetDirections();
    });
    setStatus("메뉴 화면. 시작 버튼을 누르거나 행동 버튼으로 게임을 시작할 수 있습니다.");
  }

  private confirmNewGame(primaryButton: PixelButton): void {
    if (this.confirmingReset) {
      return;
    }
    this.confirmingReset = true;
    this.effects?.click();
    const overlay = this.add.rectangle(240, 135, 480, 270, 0x090d1d, 0.78).setDepth(100);
    const panel = this.add.rectangle(240, 142, 260, 112, 0x171e37, 1).setStrokeStyle(2, 0xc66b47).setDepth(101);
    const title = this.add
      .text(240, 113, "새로운 밤을 시작할까요?", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "13px",
        color: "#ffe5aa",
      })
      .setOrigin(0.5)
      .setDepth(102);
    const warning = this.add
      .text(240, 134, "현재 진행 상황은 처음부터 다시 시작돼요.", {
        fontFamily: UI_FONT,
        fontSize: "8px",
        color: "#aeb9d5",
      })
      .setOrigin(0.5)
      .setDepth(102);
    const yes = new PixelButton(this, 199, 168, "새로 시작", () => this.startGame(true), {
      width: 84,
      height: 24,
      primary: true,
      fontSize: 8,
    }).setDepth(102);
    const no = new PixelButton(this, 289, 168, "돌아가기", () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      warning.destroy();
      yes.destroy();
      no.destroy();
      this.confirmingReset = false;
      primaryButton.setEnabled(true);
    }, {
      width: 84,
      height: 24,
      primary: false,
      fontSize: 8,
    }).setDepth(102);
    primaryButton.setEnabled(false);
  }

  private startGame(newGame: boolean): void {
    this.effects?.click();
    void this.effects?.unlock();
    this.cameras.main.fadeOut(260, 8, 11, 25);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("GameScene", {
        newGame,
        muted: this.effects?.isMuted ?? false,
        audioSettings: this.effects?.settings,
      });
    });
  }

  private openResult(
    money: number,
    customerCount: number,
    rating: number,
    elapsedMs: number,
    completedChapterId: 1 | 2 | 3 | 4 | 5,
  ): void {
    this.effects?.click();
    this.scene.start("ResultScene", { money, customerCount, rating, elapsedMs, completedChapterId });
  }
}

function setStatus(message: string): void {
  const element = document.querySelector<HTMLElement>("#status-message");
  if (element !== null) {
    element.textContent = message;
  }
}
