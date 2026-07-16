import Phaser from "phaser";

export interface SeatPosition {
  readonly x: number;
  readonly y: number;
}

export class DiningTable {
  public readonly id: string;
  public readonly seatPosition: SeatPosition;
  private readonly scene: Phaser.Scene;
  private readonly tableSprite: Phaser.GameObjects.Image;
  private readonly seatSprite: Phaser.GameObjects.Image;
  private reservedBy?: string;

  public constructor(scene: Phaser.Scene, id: string, x: number, y: number, scale = 0.78) {
    this.scene = scene;
    this.id = id;
    this.seatPosition = { x, y: y + 7 };
    this.tableSprite = scene.add
      .image(x, y - 6, "table")
      .setScale(scale)
      .setDepth(20 + Math.round(y));
    this.seatSprite = scene.add
      .image(x, y + 9, "seat")
      .setScale(scale)
      .setDepth(19 + Math.round(y));
  }

  public isAvailable(): boolean {
    return this.reservedBy === undefined;
  }

  public reserve(customerId: string): boolean {
    if (!this.isAvailable()) {
      return false;
    }

    this.reservedBy = customerId;
    this.seatSprite.setTint(0xffd38a);
    return true;
  }

  public release(customerId: string): void {
    if (this.reservedBy !== customerId) {
      return;
    }

    this.reservedBy = undefined;
    this.seatSprite.clearTint();
  }

  public getReservedCustomerId(): string | undefined {
    return this.reservedBy;
  }

  public pulse(): void {
    this.scene.tweens.add({
      targets: [this.tableSprite, this.seatSprite],
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 130,
      yoyo: true,
      ease: "Sine.Out",
    });
  }

  public destroy(): void {
    this.tableSprite.destroy();
    this.seatSprite.destroy();
  }
}
