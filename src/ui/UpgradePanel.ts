import Phaser from "phaser";
import type { UpgradeViewState } from "../game/types/game";

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
  private currentView?: UpgradeViewState;
  private handler?: UpgradePurchaseHandler;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const depth = 910;
    scene.add.rectangle(415, 135, 130, 270, 0x12172c, 0.99).setDepth(depth);
    scene.add.rectangle(351, 135, 2, 270, 0xd47a43, 0.9).setDepth(depth + 1);
    scene.add
      .text(363, 9, "오늘의 확장", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "11px",
        color: "#ffe0a1",
      })
      .setDepth(depth + 2);
    scene.add
      .text(363, 25, "작은 포차를 키워보세요", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "7px",
        color: "#8f9abc",
      })
      .setDepth(depth + 2);

    scene.add.rectangle(415, 57, 106, 1, 0x424c70, 0.7).setDepth(depth + 1);
    this.badgeText = scene.add
      .text(363, 45, "다음 시설", {
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
      .text(415, 234, "1 / 10", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#d1d7ed",
      })
      .setOrigin(0.5, 0)
      .setDepth(depth + 2);
    scene.add
      .text(415, 257, "클릭해서 시설 구매", {
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

  public setUpgrade(view: UpgradeViewState | undefined, purchasedCount: number): void {
    this.currentView = view;
    const progress = Phaser.Math.Clamp(purchasedCount / 10, 0, 1);
    this.progressFill.width = 102 * progress;
    this.progressText.setText(`${purchasedCount} / 10`);

    if (view === undefined) {
      this.badgeText.setText("모든 시설 완성");
      this.nameText.setText("달빛 야식당");
      this.descriptionText.setText("동네에서 가장 따뜻한 야식당이 되었어요!");
      this.costText.setText("완성!").setColor("#ffe58a");
      this.button.disableInteractive().setFillStyle(0x39415d).setAlpha(0.7);
      this.buttonText.setText("완료").setColor("#aab4cf");
      return;
    }

    this.badgeText.setText(`시설 ${view.upgrade.order}단계`);
    this.nameText.setText(view.upgrade.name);
    this.descriptionText.setText(view.upgrade.description);
    this.costText
      .setText(`${view.upgrade.cost.toLocaleString("ko-KR")}냥`)
      .setColor(view.canAfford ? "#ffd16d" : "#a27672");
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
