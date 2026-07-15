import Phaser from "phaser";
import type { MenuItemId } from "../game/types/game";
import { getMenuItem } from "../game/data/menuData";

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly moneyText: Phaser.GameObjects.Text;
  private readonly ratingText: Phaser.GameObjects.Text;
  private readonly customerText: Phaser.GameObjects.Text;
  private readonly heldText: Phaser.GameObjects.Text;
  private readonly clockText: Phaser.GameObjects.Text;
  private displayedMoney = 0;
  private targetMoney = 0;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.add.rectangle(175, 17, 350, 34, 0x11162c, 0.97).setDepth(900);
    scene.add.rectangle(175, 34, 350, 2, 0xd77c43, 0.85).setDepth(901);
    scene.add
      .text(9, 7, "☾ 냥포차", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "11px",
        color: "#ffe4a3",
      })
      .setDepth(902);

    this.moneyText = scene.add
      .text(89, 6, "0냥", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "11px",
        color: "#ffd46a",
      })
      .setDepth(902);
    this.ratingText = scene.add
      .text(9, 21, "★★★☆☆ 3.0", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        color: "#ffc96b",
      })
      .setDepth(902);
    this.customerText = scene.add
      .text(120, 21, "손님 0", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        color: "#c9d4ff",
      })
      .setDepth(902);
    this.heldText = scene.add
      .text(203, 21, "손이 비었어요", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        color: "#9ea9ca",
      })
      .setDepth(902);
    this.clockText = scene.add
      .text(337, 7, "00:00", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#aab6db",
      })
      .setOrigin(1, 0)
      .setDepth(902);
  }

  public update(deltaMs: number): void {
    if (Math.round(this.displayedMoney) === this.targetMoney) {
      return;
    }

    const distance = this.targetMoney - this.displayedMoney;
    const step = Math.sign(distance) * Math.max(1, Math.abs(distance) * deltaMs * 0.012);
    this.displayedMoney =
      Math.abs(step) >= Math.abs(distance) ? this.targetMoney : this.displayedMoney + step;
    this.moneyText.setText(`${Math.round(this.displayedMoney).toLocaleString("ko-KR")}냥`);
  }

  public setMoney(money: number, animate = true): void {
    this.targetMoney = Math.max(0, Math.round(money));
    if (!animate) {
      this.displayedMoney = this.targetMoney;
      this.moneyText.setText(`${this.targetMoney.toLocaleString("ko-KR")}냥`);
    }
  }

  public setRating(rating: number): void {
    const roundedStars = Math.max(1, Math.min(5, Math.round(rating)));
    this.ratingText.setText(
      `${"★".repeat(roundedStars)}${"☆".repeat(5 - roundedStars)} ${rating.toFixed(1)}`,
    );
  }

  public setCustomerCount(count: number): void {
    this.customerText.setText(`손님 ${count}`);
  }

  public setHeldFood(menuItemId?: MenuItemId): void {
    if (menuItemId === undefined) {
      this.heldText.setText("손이 비었어요").setColor("#9ea9ca");
      return;
    }
    this.heldText.setText(`${getMenuItem(menuItemId).name} 운반 중`).setColor("#ffe5a4");
  }

  public setElapsedTime(elapsedMs: number): void {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.clockText.setText(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
  }

  public flashMoney(gain: boolean): void {
    this.scene.tweens.killTweensOf(this.moneyText);
    this.scene.tweens.add({
      targets: this.moneyText,
      scaleX: 1.18,
      scaleY: 1.18,
      color: gain ? "#fff3a6" : "#ff8b7d",
      duration: 110,
      yoyo: true,
      onComplete: () => this.moneyText.setColor("#ffd46a"),
    });
  }
}
