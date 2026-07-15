import Phaser from "phaser";
import { UI_FONT } from "../game/art/SceneDecor";

export interface PixelButtonOptions {
  readonly width?: number;
  readonly height?: number;
  readonly primary?: boolean;
  readonly fontSize?: number;
}

export class PixelButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private callback: () => void;
  private enabled = true;
  private readonly primary: boolean;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    callback: () => void,
    options: PixelButtonOptions = {},
  ) {
    super(scene, x, y);
    this.callback = callback;
    this.primary = options.primary ?? true;
    const width = options.width ?? 132;
    const height = options.height ?? 30;
    this.background = scene.add
      .rectangle(0, 0, width, height, this.primary ? 0xb74839 : 0x293450, 1)
      .setStrokeStyle(2, this.primary ? 0xf19a5a : 0x6d789d)
      .setInteractive({ useHandCursor: true });
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: `${options.fontSize ?? 10}px`,
        color: "#fff5d6",
      })
      .setOrigin(0.5);
    this.add([this.background, this.label]);
    scene.add.existing(this);

    this.background.on("pointerover", () => {
      if (this.enabled) {
        this.background.setFillStyle(this.primary ? 0xd25b42 : 0x374467);
      }
    });
    this.background.on("pointerout", () => this.refresh());
    this.background.on("pointerdown", () => {
      if (!this.enabled) {
        return;
      }
      scene.tweens.add({
        targets: this,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 55,
        yoyo: true,
        onComplete: () => this.callback(),
      });
    });
  }

  public setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  public setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.refresh();
    return this;
  }

  public setCallback(callback: () => void): this {
    this.callback = callback;
    return this;
  }

  private refresh(): void {
    if (!this.enabled) {
      this.setAlpha(0.55);
      this.background.disableInteractive().setFillStyle(0x30354a);
      return;
    }
    this.setAlpha(1);
    this.background
      .setInteractive({ useHandCursor: true })
      .setFillStyle(this.primary ? 0xb74839 : 0x293450);
  }
}
