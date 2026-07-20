import Phaser from "phaser";
import type { MenuItemId } from "../types/game";
import { getFoodTextureKey } from "../data/menuData";
import { touchInput } from "../input/TouchControls";
import type { AvatarLook } from "../systems/CustomizationSystem";
import { CHARACTER_MOVE_SPEED_PX_PER_SECOND } from "../systems/WorkerMovementRules";
import {
  ensureCustomizedPlayerTextures,
  getCustomizedPlayerTextureKey,
} from "../art/PixelArtFactory";

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
  private avatarLook?: AvatarLook;
  private ownerTint = 0xffffff;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player-down-0");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(50);
    this.setCollideWorldBounds(false);
    this.setSize(13, 12);
    this.setOffset(9, 18);
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
    const textureKey = this.getPlayerTextureKey();
    if (this.texture.key !== textureKey) this.setTexture(textureKey);
    const targetDepth = 50 + Math.round(this.y / 4) * 4;
    if (this.depth !== targetDepth) this.setDepth(targetDepth);
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
      .image(this.x, this.y - 22, getFoodTextureKey(menuItemId))
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
    this.ownerTint = tint;
    this.clearTint();
    this.rebuildAvatarTextures();
  }

  public setAvatarLook(look: AvatarLook): void {
    this.avatarLook = { ...look };
    this.rebuildAvatarTextures();
  }

  public override destroy(fromScene?: boolean): void {
    this.carriedSprite?.destroy();
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

  private rebuildAvatarTextures(): void {
    const look = this.avatarLook;
    if (look === undefined) return;
    ensureCustomizedPlayerTextures(this.scene, look, this.ownerTint);
    this.setTexture(this.getPlayerTextureKey());
  }

  private getPlayerTextureKey(): string {
    if (this.avatarLook === undefined) return `player-${this.facing}-${this.animationFrame}`;
    return getCustomizedPlayerTextureKey(
      this.avatarLook,
      this.ownerTint,
      this.facing,
      this.animationFrame,
    );
  }
}
