import Phaser from "phaser";
import type { MenuItemId } from "../types/game";

export type PlayerFacing = "down" | "up" | "left" | "right";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private facing: PlayerFacing = "down";
  private animationClock = 0;
  private animationFrame = 0;
  private frozen = false;
  private carriedFood?: MenuItemId;
  private carriedCustomerId?: string;
  private carriedSprite?: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player-down-0");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(50);
    this.setCollideWorldBounds(false);
    this.setSize(13, 12);
    this.setOffset(9, 18);

    const keyboard = scene.input.keyboard;
    if (keyboard === null) {
      throw new Error("Keyboard input is required for the player.");
    }

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  }

  public override update(deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.frozen) {
      body.setVelocity(0, 0);
      return;
    }

    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;
    const direction = new Phaser.Math.Vector2(
      Number(right) - Number(left),
      Number(down) - Number(up),
    );

    if (direction.lengthSq() > 0) {
      direction.normalize().scale(78);
      body.setVelocity(direction.x, direction.y);
      this.updateFacing(direction);
      this.animationClock += deltaMs;
      if (this.animationClock >= 145) {
        this.animationClock = 0;
        this.animationFrame = this.animationFrame === 0 ? 1 : 0;
      }
    } else {
      body.setVelocity(0, 0);
      this.animationClock = 0;
      this.animationFrame = 0;
    }

    this.x = Phaser.Math.Clamp(this.x, 15, 337);
    this.y = Phaser.Math.Clamp(this.y, 52, 255);
    this.setTexture(`player-${this.facing}-${this.animationFrame}`);
    this.setDepth(50 + Math.round(this.y));
    this.updateCarriedSprite();
  }

  public getFacing(): PlayerFacing {
    return this.facing;
  }

  public getCarriedFood(): MenuItemId | undefined {
    return this.carriedFood;
  }

  public getCarriedCustomerId(): string | undefined {
    return this.carriedCustomerId;
  }

  public setCarriedFood(menuItemId: MenuItemId, customerId: string): void {
    this.carriedFood = menuItemId;
    this.carriedCustomerId = customerId;
    this.carriedSprite?.destroy();
    this.carriedSprite = this.scene.add
      .image(this.x, this.y - 22, `food-${menuItemId}`)
      .setDepth(this.depth + 2);
    this.updateCarriedSprite();
  }

  public clearCarriedFood(): MenuItemId | undefined {
    const previous = this.carriedFood;
    this.carriedFood = undefined;
    this.carriedCustomerId = undefined;
    this.carriedSprite?.destroy();
    this.carriedSprite = undefined;
    return previous;
  }

  public setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    if (frozen) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.carriedSprite?.destroy();
    super.destroy(fromScene);
  }

  private updateFacing(direction: Phaser.Math.Vector2): void {
    if (Math.abs(direction.x) > Math.abs(direction.y)) {
      this.facing = direction.x < 0 ? "left" : "right";
    } else {
      this.facing = direction.y < 0 ? "up" : "down";
    }
  }

  private updateCarriedSprite(): void {
    if (this.carriedSprite === undefined) {
      return;
    }

    this.carriedSprite.setPosition(this.x, this.y - 22).setDepth(this.depth + 2);
  }
}
