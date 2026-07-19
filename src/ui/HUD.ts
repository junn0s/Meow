import Phaser from "phaser";
import type { MenuItemId } from "../game/types/game";
import type { WorldVisualState } from "../game/types/game";
import { getMenuItem } from "../game/data/menuData";
import { formatCurrency } from "../game/economy/economyMath";

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly moneyText: Phaser.GameObjects.Text;
  private readonly ratingText: Phaser.GameObjects.Text;
  private readonly customerText: Phaser.GameObjects.Text;
  private readonly fameText: Phaser.GameObjects.Text;
  private readonly heldText: Phaser.GameObjects.Text;
  private readonly clockText: Phaser.GameObjects.Text;
  private readonly phaseText: Phaser.GameObjects.Text;
  private readonly phaseBar: Phaser.GameObjects.Rectangle;
  private readonly eventText: Phaser.GameObjects.Text;
  private readonly feverText: Phaser.GameObjects.Text;
  private readonly feverFill: Phaser.GameObjects.Rectangle;
  private readonly promotionText: Phaser.GameObjects.Text;
  private displayedMoney = 0;
  private targetMoney = 0;
  private displayedElapsedSecond = -1;
  private displayedPhase?: WorldVisualState["phase"];
  private displayedPhaseBarWidth = -1;
  private displayedServiceEventKey = "";
  private displayedFeverText = "";
  private displayedFeverColor = "";
  private displayedFeverFillColor = -1;
  private displayedFeverFillWidth = -1;
  private displayedPromotionText = "";

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.add.rectangle(175, 17, 350, 34, 0x11162c, 0.97).setDepth(900);
    scene.add.rectangle(175, 34, 350, 2, 0xd77c43, 0.85).setDepth(901);
    scene.add
      .text(9, 7, "냥포차", {
        fontFamily: '"Jua", "Gowun Dodum", sans-serif',
        fontSize: "11px",
        color: "#ffe4a3",
      })
      .setDepth(902);

    this.phaseText = scene.add
      .text(54, 7, "☀ 낮", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        color: "#d9f5ff",
      })
      .setDepth(902);

    this.moneyText = scene.add
      .text(101, 6, "0냥", {
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
    this.fameText = scene.add
      .text(82, 22, "명성 1", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "6px",
        color: "#75e1d4",
      })
      .setDepth(903);
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
    scene.add.rectangle(312, 25, 48, 3, 0x34405f, 0.9).setDepth(902);
    this.phaseBar = scene.add
      .rectangle(288, 25, 48, 3, 0x72aebe, 1)
      .setOrigin(0, 0.5)
      .setDepth(903);
    this.eventText = scene.add
      .text(238, 7, "", {
        fontFamily: '"Jua", sans-serif',
        fontSize: "8px",
        color: "#ffe6ed",
        backgroundColor: "#8e2948",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 0)
      .setDepth(904)
      .setVisible(false);
    this.feverText = scene.add
      .text(203, 28, "FEVER 잠김", {
        fontFamily: "monospace",
        fontSize: "5px",
        color: "#8090af",
      })
      .setDepth(904);
    scene.add.rectangle(270, 31, 50, 3, 0x2e3855, 1).setDepth(903);
    this.feverFill = scene.add
      .rectangle(245, 31, 0, 3, 0x45ffd2, 1)
      .setOrigin(0, 0.5)
      .setDepth(904);
    this.promotionText = scene.add
      .text(337, 21, "", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "6px",
        color: "#ffe59c",
      })
      .setOrigin(1, 0)
      .setDepth(904);
  }

  public update(deltaMs: number): void {
    if (Math.round(this.displayedMoney) === this.targetMoney) {
      return;
    }

    const distance = this.targetMoney - this.displayedMoney;
    const step = Math.sign(distance) * Math.max(1, Math.abs(distance) * deltaMs * 0.012);
    this.displayedMoney =
      Math.abs(step) >= Math.abs(distance) ? this.targetMoney : this.displayedMoney + step;
    this.moneyText.setText(formatCurrency(Math.round(this.displayedMoney)));
  }

  public setMoney(money: number, animate = true): void {
    this.targetMoney = Math.max(0, Math.round(money));
    if (!animate) {
      this.displayedMoney = this.targetMoney;
      this.moneyText.setText(formatCurrency(this.targetMoney));
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

  public setFame(level: number): void {
    this.fameText.setText(`명성 ${Math.max(1, Math.min(6, Math.floor(level)))}`);
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
    if (totalSeconds === this.displayedElapsedSecond) return;
    this.displayedElapsedSecond = totalSeconds;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.clockText.setText(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
  }

  public setWorldTime(state: WorldVisualState): void {
    const presentation = {
      day: { icon: "☀", label: "낮", color: "#d9f5ff", bar: 0x72aebe },
      sunset: { icon: "◒", label: "노을", color: "#ffd0a6", bar: 0xd77a68 },
      night: { icon: "☾", label: "밤", color: "#aeeaff", bar: 0x38d7ff },
      dawn: { icon: "◐", label: "새벽", color: "#e6c6de", bar: 0x9b70c8 },
    } as const;
    const phase = presentation[state.phase];
    if (this.displayedPhase !== state.phase) {
      this.displayedPhase = state.phase;
      this.phaseText.setText(`${phase.icon} ${phase.label}`).setColor(phase.color);
      this.phaseBar.setFillStyle(phase.bar, 1);
    }
    const barWidth = Math.round(480 * Math.min(1, Math.max(0, state.phaseProgress))) / 10;
    if (barWidth !== this.displayedPhaseBarWidth) {
      this.displayedPhaseBarWidth = barWidth;
      this.phaseBar.setDisplaySize(barWidth, 3);
    }
  }

  public setServiceEvent(label?: string, warning = false): void {
    const eventKey = label === undefined || label.length === 0 ? "none" : `${warning ? "warning" : "normal"}:${label}`;
    if (eventKey === this.displayedServiceEventKey) return;
    this.displayedServiceEventKey = eventKey;
    if (label === undefined || label.length === 0) {
      this.eventText.setVisible(false);
      return;
    }
    this.eventText
      .setText(label)
      .setBackgroundColor(warning ? "#8e2948" : "#176b7a")
      .setVisible(true);
  }

  public setFever(level: number, gauge: number, activeRemainingMs: number): void {
    let label: string;
    let textColor: string;
    let fillColor: number;
    let fillWidth: number;
    if (level <= 0) {
      label = "FEVER 잠김";
      textColor = "#8090af";
      fillColor = 0x39bfa8;
      fillWidth = 0;
    } else {
      const active = activeRemainingMs > 0;
      const multiplier = [1, 1.5, 1.65, 1.8][level] ?? 1;
      label = active
        ? `FEVER ×${multiplier} · ${Math.ceil(activeRemainingMs / 1_000)}s`
        : `FEVER ×${multiplier} · ${Math.round(gauge)}%`;
      textColor = activeRemainingMs > 0 && activeRemainingMs <= 3_000
        ? "#ff8f9c"
        : active ? "#9ffff0" : "#b5c7d8";
      fillColor = active ? 0x45ffd2 : 0x39bfa8;
      fillWidth = Math.round(500 * (active ? 1 : Math.min(1, Math.max(0, gauge / 100)))) / 10;
    }
    if (label !== this.displayedFeverText || textColor !== this.displayedFeverColor) {
      this.displayedFeverText = label;
      this.displayedFeverColor = textColor;
      this.feverText.setText(label).setColor(textColor);
    }
    if (fillColor !== this.displayedFeverFillColor) {
      this.displayedFeverFillColor = fillColor;
      this.feverFill.setFillStyle(fillColor, 1);
    }
    if (fillWidth !== this.displayedFeverFillWidth) {
      this.displayedFeverFillWidth = fillWidth;
      this.feverFill.setDisplaySize(fillWidth, 3);
    }
  }

  public setPromotion(label?: string): void {
    const nextText = label === undefined ? "" : `홍보 ${label}`;
    if (nextText === this.displayedPromotionText) return;
    this.displayedPromotionText = nextText;
    this.promotionText.setText(nextText);
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
