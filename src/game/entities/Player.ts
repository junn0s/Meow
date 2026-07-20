import Phaser from "phaser";
import type { MenuItemId } from "../types/game";
import { touchInput } from "../input/TouchControls";
import type { AvatarLook } from "../systems/CustomizationSystem";
import { CHARACTER_MOVE_SPEED_PX_PER_SECOND } from "../systems/WorkerMovementRules";

export type PlayerFacing = "down" | "up" | "left" | "right";

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd?: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private facing: PlayerFacing = "down";
  private animationClock = 0;
  private animationFrame = 0;
  private frozen = false;
  private carriedFood?: MenuItemId;
  private carriedQuantity = 1;
  private carriedTicketCustomerId?: string;
  private carriedSprite?: Phaser.GameObjects.Image;
  private readonly avatarGraphics: Phaser.GameObjects.Graphics;
  private avatarLook?: AvatarLook;
  private avatarRenderKey = "";

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player-down-0");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(50);
    this.setCollideWorldBounds(false);
    this.setSize(13, 12);
    this.setOffset(9, 18);
    this.avatarGraphics = scene.add.graphics().setDepth(this.depth + 1);

    const keyboard = scene.input.keyboard;
    if (keyboard !== null) {
      this.cursors = keyboard.createCursorKeys();
      this.wasd = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      }) as Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
    }
  }

  public override update(deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.frozen) {
      body.setVelocity(0, 0);
      return;
    }

    const left = this.cursors?.left.isDown === true
      || this.wasd?.left.isDown === true
      || touchInput.isDirectionDown("left");
    const right = this.cursors?.right.isDown === true
      || this.wasd?.right.isDown === true
      || touchInput.isDirectionDown("right");
    const up = this.cursors?.up.isDown === true
      || this.wasd?.up.isDown === true
      || touchInput.isDirectionDown("up");
    const down = this.cursors?.down.isDown === true
      || this.wasd?.down.isDown === true
      || touchInput.isDirectionDown("down");
    const directionX = Number(right) - Number(left);
    const directionY = Number(down) - Number(up);

    if (directionX !== 0 || directionY !== 0) {
      const directionScale = directionX !== 0 && directionY !== 0 ? Math.SQRT1_2 : 1;
      const velocityX = directionX * CHARACTER_MOVE_SPEED_PX_PER_SECOND * directionScale;
      const velocityY = directionY * CHARACTER_MOVE_SPEED_PX_PER_SECOND * directionScale;
      body.setVelocity(velocityX, velocityY);
      this.updateFacing(velocityX, velocityY);
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
    const textureKey = `player-${this.facing}-${this.animationFrame}`;
    if (this.texture.key !== textureKey) this.setTexture(textureKey);
    const targetDepth = 50 + Math.round(this.y / 4) * 4;
    if (this.depth !== targetDepth) this.setDepth(targetDepth);
    this.updateAvatarGraphics();
    this.updateCarriedSprite();
  }

  public getFacing(): PlayerFacing {
    return this.facing;
  }

  public getCarriedFood(): MenuItemId | undefined {
    return this.carriedFood;
  }

  public getCarriedQuantity(): number {
    return this.carriedQuantity;
  }

  public getCarriedTicketCustomerId(): string | undefined {
    return this.carriedTicketCustomerId;
  }

  public setCarriedFood(menuItemId: MenuItemId, quantity = 1, ticketCustomerId?: string): void {
    this.carriedFood = menuItemId;
    this.carriedQuantity = Math.max(1, Math.round(quantity));
    this.carriedTicketCustomerId = ticketCustomerId;
    this.carriedSprite?.destroy();
    this.carriedSprite = this.scene.add
      .image(this.x, this.y - 22, `food-${menuItemId}`)
      .setDepth(this.depth + 2);
    this.updateCarriedSprite();
  }

  public clearCarriedFood(): MenuItemId | undefined {
    const previous = this.carriedFood;
    this.carriedFood = undefined;
    this.carriedQuantity = 1;
    this.carriedTicketCustomerId = undefined;
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

  public setOwnerTint(tint: number): void {
    if (tint === 0xffffff) this.clearTint();
    else this.setTint(tint);
  }

  public setAvatarLook(look: AvatarLook): void {
    this.avatarLook = { ...look };
    this.avatarRenderKey = "";
    this.updateAvatarGraphics();
  }

  public override destroy(fromScene?: boolean): void {
    this.carriedSprite?.destroy();
    this.avatarGraphics.destroy();
    super.destroy(fromScene);
  }

  private updateFacing(directionX: number, directionY: number): void {
    if (Math.abs(directionX) > Math.abs(directionY)) {
      this.facing = directionX < 0 ? "left" : "right";
    } else {
      this.facing = directionY < 0 ? "up" : "down";
    }
  }

  private updateCarriedSprite(): void {
    if (this.carriedSprite === undefined) {
      return;
    }

    if (this.carriedSprite.x !== this.x || this.carriedSprite.y !== this.y - 22) {
      this.carriedSprite.setPosition(this.x, this.y - 22);
    }
    if (this.carriedSprite.depth !== this.depth + 2) {
      this.carriedSprite.setDepth(this.depth + 2);
    }
  }

  private updateAvatarGraphics(): void {
    const look = this.avatarLook;
    if (look === undefined) return;
    if (this.avatarGraphics.x !== this.x - 16 || this.avatarGraphics.y !== this.y - 16) {
      this.avatarGraphics.setPosition(this.x - 16, this.y - 16);
    }
    if (this.avatarGraphics.depth !== this.depth + 1) {
      this.avatarGraphics.setDepth(this.depth + 1);
    }
    const renderKey = `${this.facing}:${this.animationFrame}:${look.eyes}:${look.hat}:${look.apron}:${look.accessory}`;
    if (renderKey === this.avatarRenderKey) return;
    this.avatarRenderKey = renderKey;
    const graphics = this.avatarGraphics.clear();
    const bob = this.animationFrame === 1 ? 1 : 0;
    const front = this.facing === "down";
    const side = this.facing === "left" || this.facing === "right";

    if (look.apron !== "apron-none" && this.facing !== "up") {
      const color = look.apron === "apron-red" ? 0xc94843 : look.apron === "apron-mint" ? 0x5bc7ae : 0x263b76;
      graphics.fillStyle(0x38283a, 1).fillRect(side ? 12 : 10, 18 + bob, side ? 10 : 12, 8);
      graphics.fillStyle(color, 1).fillRect(side ? 13 : 11, 18 + bob, side ? 8 : 10, 7);
      if (look.apron === "apron-night") graphics.fillStyle(0xffd45c, 1).fillRect(15, 20 + bob, 2, 2);
    }
    if (front && look.eyes !== "eyes-round") {
      graphics.fillStyle(0xffe6b7, 1).fillRect(10, 10 + bob, 12, 4);
      graphics.fillStyle(look.eyes === "eyes-sparkle" ? 0x67e8e0 : 0x38283a, 1);
      if (look.eyes === "eyes-sleepy") {
        graphics.fillRect(11, 12 + bob, 3, 1).fillRect(18, 12 + bob, 3, 1);
      } else {
        graphics.fillRect(11, 10 + bob, 2, 2).fillRect(19, 10 + bob, 2, 2);
        graphics.fillStyle(0xffffff, 1).fillRect(11, 10 + bob, 1, 1).fillRect(19, 10 + bob, 1, 1);
      }
    }
    if (look.hat === "hat-band") {
      graphics.fillStyle(0x38283a, 1).fillRect(7, 7 + bob, 18, 3);
      graphics.fillStyle(0xd24b46, 1).fillRect(8, 7 + bob, 16, 2);
      graphics.fillRect(this.facing === "left" ? 23 : 5, 8 + bob, 4, 4);
    } else if (look.hat === "hat-chef") {
      graphics.fillStyle(0x38283a, 1).fillRect(9, 2 + bob, 14, 7);
      graphics.fillStyle(0xfff4d6, 1).fillRect(10, 3 + bob, 12, 6).fillRect(7, 4 + bob, 5, 4).fillRect(20, 4 + bob, 5, 4);
    } else if (look.hat === "hat-moon") {
      graphics.fillStyle(0x38283a, 1).fillRect(7, 4 + bob, 18, 5);
      graphics.fillStyle(0x344f9b, 1).fillRect(8, 4 + bob, 16, 4);
      graphics.fillStyle(0xffdf71, 1).fillRect(18, 5 + bob, 3, 2);
    }
    if (look.accessory !== "acc-none" && this.facing !== "up") {
      const color = look.accessory === "acc-bell" ? 0xffd45c : look.accessory === "acc-fish" ? 0xf28c72 : 0x8de6db;
      graphics.fillStyle(0x38283a, 1).fillRect(side ? 12 : 15, 17 + bob, 4, 4);
      graphics.fillStyle(color, 1).fillRect(side ? 13 : 16, 18 + bob, 2, 2);
    }
  }
}
