import Phaser from "phaser";

export class ToastManager {
  private readonly scene: Phaser.Scene;
  private activeToast?: Phaser.GameObjects.Container;

  public constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public show(message: string, tone: "neutral" | "success" | "warning" = "neutral"): void {
    this.activeToast?.destroy();
    const color = tone === "success" ? 0x315d4b : tone === "warning" ? 0x713b3f : 0x283454;
    const text = this.scene.add
      .text(175, 0, message, {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "9px",
        color: "#fff5d6",
        align: "center",
        wordWrap: { width: 260 },
      })
      .setOrigin(0.5);
    const width = Math.min(280, Math.max(90, text.width + 20));
    const background = this.scene.add
      .rectangle(175, 0, width, 22, color, 0.96)
      .setStrokeStyle(1, tone === "success" ? 0x72bd84 : tone === "warning" ? 0xd77764 : 0x7885ac);
    const container = this.scene.add.container(0, 45, [background, text]).setDepth(1000).setAlpha(0);
    this.activeToast = container;
    this.scene.tweens.add({
      targets: container,
      y: 53,
      alpha: 1,
      duration: 160,
      ease: "Back.Out",
      onComplete: () => {
        this.scene.time.delayedCall(1_600, () => {
          if (!container.active) {
            return;
          }
          this.scene.tweens.add({
            targets: container,
            y: 45,
            alpha: 0,
            duration: 210,
            onComplete: () => container.destroy(),
          });
        });
      },
    });
  }
}
