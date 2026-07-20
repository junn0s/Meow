import Phaser from "phaser";
import { getMenuItem } from "../game/data/menuData";
import { getChapter } from "../game/data/chapterData";
import { formatCurrency } from "../game/economy/economyMath";
import type {
  ProgressionPurchaseView,
  ProgressionState,
} from "../game/types/game";

export type UpgradePurchaseHandler = () => void;

export class UpgradePanel {
  private readonly scene: Phaser.Scene;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly descriptionText: Phaser.GameObjects.Text;
  private readonly costText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly progressFill: Phaser.GameObjects.Rectangle;
  private readonly button: Phaser.GameObjects.Rectangle;
  private readonly buttonText: Phaser.GameObjects.Text;
  private readonly badgeText: Phaser.GameObjects.Text;
  private readonly levelText: Phaser.GameObjects.Text;
  private readonly fameText: Phaser.GameObjects.Text;
  private currentView?: ProgressionPurchaseView;
  private handler?: UpgradePurchaseHandler;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const depth = 910;
    scene.add.rectangle(415, 135, 130, 270, 0x12172c, 0.99).setDepth(depth);
    scene.add.rectangle(351, 135, 2, 270, 0xd47a43, 0.9).setDepth(depth + 1);
    scene.add
      .text(363, 9, "5개 챕터 · 150단계", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "11px",
        color: "#ffe0a1",
      })
      .setDepth(depth + 2);
    scene.add
      .text(363, 25, "새 가게를 하나씩 완성해요", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "7px",
        color: "#8f9abc",
      })
      .setDepth(depth + 2);

    scene.add.rectangle(415, 57, 106, 1, 0x424c70, 0.7).setDepth(depth + 1);
    this.badgeText = scene.add
      .text(363, 45, "1장 · 1단계", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "7px",
        color: "#f0ac67",
        backgroundColor: "#4b2834",
        padding: { x: 4, y: 2 },
      })
      .setDepth(depth + 2);
    this.nameText = scene.add
      .text(363, 65, "추가 좌석", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "12px",
        color: "#fff1c7",
        wordWrap: { width: 104 },
      })
      .setDepth(depth + 2);
    this.descriptionText = scene.add
      .text(363, 84, "손님을 더 받을 수 있어요.", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        lineSpacing: 2,
        color: "#b8c2df",
        wordWrap: { width: 104 },
      })
      .setDepth(depth + 2);
    this.costText = scene.add
      .text(415, 135, "50냥", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "14px",
        color: "#ffd16d",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);

    this.button = scene.add
      .rectangle(415, 165, 104, 28, 0xb84b38, 1)
      .setStrokeStyle(2, 0xf29a5b)
      .setDepth(depth + 2)
      .setInteractive({ useHandCursor: true });
    this.buttonText = scene.add
      .text(415, 165, "구매하기", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "10px",
        color: "#fff4d3",
      })
      .setOrigin(0.5)
      .setDepth(depth + 3);
    this.fameText = scene.add
      .text(415, 188, "명성 Lv.1 · 결제 +0%", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "7px",
        color: "#71e3d1",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    this.button.on("pointerover", () => {
      if (this.currentView?.canPurchase === true) {
        this.button.setFillStyle(0xd35e43);
      }
    });
    this.button.on("pointerout", () => this.refreshButton());
    this.button.on("pointerdown", () => {
      this.scene.tweens.add({ targets: [this.button, this.buttonText], scaleX: 0.96, scaleY: 0.96, duration: 60, yoyo: true });
      this.handler?.();
    });

    scene.add
      .text(363, 203, "가게 완성도", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        color: "#9ba7c8",
      })
      .setDepth(depth + 2);
    scene.add.rectangle(415, 222, 104, 7, 0x282f4e, 1).setDepth(depth + 1);
    this.progressFill = scene.add
      .rectangle(364, 222, 0, 5, 0xf0a65f, 1)
      .setOrigin(0, 0.5)
      .setDepth(depth + 2);
    this.progressText = scene.add
      .text(415, 234, "1단계 · 0/6", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#d1d7ed",
      })
      .setOrigin(0.5, 0)
      .setDepth(depth + 2);
    this.levelText = scene.add
      .text(415, 257, "현재 메뉴 · 어묵", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "7px",
        color: "#697494",
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);
  }

  public onPurchase(handler: UpgradePurchaseHandler): void {
    this.handler = handler;
  }

  public setProgression(
    view: ProgressionPurchaseView | undefined,
    state: ProgressionState,
  ): void {
    this.currentView = view;
    const progress = Phaser.Math.Clamp(view?.overallProgress ?? 1, 0, 1);
    const fameLevel = view?.visualTier ?? 6;
    this.fameText.setText(`명성 Lv.${fameLevel} · 결제 +${(fameLevel - 1) * 2}%`);
    this.progressFill.width = 102 * progress;
    const activeMenu = [...state.menuProgress].reverse().find((menu) => menu.unlocked)
      ?? state.menuProgress[0];
    this.levelText.setText(
      `현재 메뉴 · ${activeMenu === undefined ? "어묵" : getMenuItem(activeMenu.menuItemId).name}`,
    );

    if (view === undefined) {
      const chapter = getChapter(state.chapterId);
      this.badgeText.setText(`CHAPTER ${chapter.id} · 30단계 완성`);
      this.nameText.setText(chapter.finaleName);
      this.descriptionText.setText("평점 4.5를 달성하면 다음 가게가 열려요!");
      this.costText.setText("완성!").setColor("#ffe58a");
      this.button.disableInteractive().setFillStyle(0x39415d).setAlpha(0.7);
      this.buttonText.setText("완료").setColor("#aab4cf");
      this.progressText.setText("30단계 · 5/5");
      return;
    }

    const purchase = view.purchase;
    this.badgeText.setText(`CH.${view.chapterId} · ${purchase.stage}단계`);
    this.nameText.setText(purchase.name);
    this.descriptionText.setText(purchase.description);
    this.costText
      .setText(formatCurrency(purchase.cost))
      .setColor(view.canAfford ? "#ffd16d" : "#a27672");
    this.progressText.setText(
      `${purchase.stage}단계 · ${purchase.step - 1}/${purchase.stepCount}`,
    );
    this.refreshButton();
  }

  public pulseSuccess(): void {
    this.scene.tweens.add({
      targets: [this.nameText, this.badgeText],
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 130,
      yoyo: true,
    });
  }

  public pulseFailure(): void {
    this.scene.cameras.main.shake(90, 0.0025);
    this.scene.tweens.add({
      targets: this.costText,
      x: { from: 412, to: 418 },
      duration: 45,
      repeat: 2,
      yoyo: true,
    });
  }

  private refreshButton(): void {
    const enabled = this.currentView?.canPurchase === true;
    if (enabled) {
      this.button.setInteractive({ useHandCursor: true }).setFillStyle(0xb84b38).setAlpha(1);
      this.buttonText.setText("구매하기").setColor("#fff4d3");
    } else {
      this.button.disableInteractive().setFillStyle(0x343b57).setAlpha(0.78);
      this.buttonText.setText("금액 부족").setColor("#9099b5");
    }
  }
}
