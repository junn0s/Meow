import Phaser from "phaser";
import { getCustomerData } from "../data/customerData";
import { CustomerState, type CustomerKind, type MenuItemId } from "../types/game";

export interface CustomerOptions {
  readonly patienceMs?: number;
  readonly vip?: boolean;
  readonly nightMode?: boolean;
  readonly specialOrder?: boolean;
}

export class Customer extends Phaser.GameObjects.Container {
  public readonly customerId: string;
  public readonly kind: CustomerKind;
  public readonly isVip: boolean;
  public readonly isSpecialOrder: boolean;
  public customerState = CustomerState.ENTERING;
  public assignedTableId?: string;
  public orderId?: MenuItemId;
  public orderQuantity = 1;
  public remainingQuantity = 1;
  public orderAccepted = false;
  public patienceMs: number;
  public maxPatienceMs: number;
  public eatingRemainingMs = 0;
  public stateElapsedMs = 0;
  public targetX: number;
  public targetY: number;
  public readonly moveSpeed: number;

  private readonly character: Phaser.GameObjects.Image;
  private readonly nightRim: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Image;
  private readonly foodIcon: Phaser.GameObjects.Image;
  private readonly patienceBackground: Phaser.GameObjects.Rectangle;
  private readonly patienceFill: Phaser.GameObjects.Rectangle;
  private readonly quantityText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly vipText: Phaser.GameObjects.Text;
  private readonly specialText: Phaser.GameObjects.Text;
  private readonly heart: Phaser.GameObjects.Image;
  private animationClock = 0;
  private animationFrame = 0;
  private showPatience = false;
  private patiencePresentationAccumulatorMs = 0;
  private patienceBand = -1;

  public constructor(
    scene: Phaser.Scene,
    customerId: string,
    kind: CustomerKind,
    x: number,
    y: number,
    options: CustomerOptions = {},
  ) {
    super(scene, x, y);
    this.customerId = customerId;
    this.kind = kind;
    this.isVip = options.vip ?? false;
    this.isSpecialOrder = options.specialOrder ?? false;
    const data = getCustomerData(kind);
    this.patienceMs = options.patienceMs ?? data.patienceMs;
    this.maxPatienceMs = this.patienceMs;
    this.moveSpeed = kind === "rabbit" ? 34 : kind === "hamster" ? 29 : 26;
    this.targetX = x;
    this.targetY = y;

    this.nightRim = scene.add
      .image(0, -1, `customer-${kind}-0`)
      .setTint(0x49bfff)
      .setAlpha(0.32)
      .setScale(1.08)
      .setVisible(options.nightMode ?? false);
    this.character = scene.add.image(0, 0, `customer-${kind}-0`);
    this.bubble = scene.add.image(0, -24, "order-bubble").setVisible(false);
    this.foodIcon = scene.add.image(0, -25, "food-fishcake").setVisible(false);
    this.patienceBackground = scene.add
      .rectangle(-13, -18, 26, 3, 0x281b30, 0.94)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.patienceFill = scene.add
      .rectangle(-12, -18, 24, 1, 0x77d48b)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.quantityText = scene.add
      .text(8, -32, "", {
        fontFamily: '"Jua", sans-serif',
        fontSize: "8px",
        color: "#39243c",
        stroke: "#fff4d6",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.statusText = scene.add
      .text(15, -18, "", {
        fontFamily: '"Jua", sans-serif',
        fontSize: "7px",
        color: "#fff4d6",
        backgroundColor: "#a33a43",
        padding: { x: 2, y: 0 },
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.vipText = scene.add
      .text(0, 14, "VIP", {
        fontFamily: '"Jua", sans-serif',
        fontSize: "6px",
        color: "#3c2638",
        backgroundColor: "#ffd86a",
        padding: { x: 2, y: 0 },
      })
      .setOrigin(0.5)
      .setVisible(this.isVip);
    this.specialText = scene.add
      .text(0, 20, "★ 특별", {
        fontFamily: '"Jua", sans-serif',
        fontSize: "6px",
        color: "#291d3b",
        backgroundColor: "#8de6db",
        padding: { x: 2, y: 0 },
      })
      .setOrigin(0.5)
      .setVisible(this.isSpecialOrder);
    this.heart = scene.add.image(0, -25, "heart").setAlpha(0).setVisible(false);

    this.add([
      this.nightRim,
      this.character,
      this.bubble,
      this.foodIcon,
      this.patienceBackground,
      this.patienceFill,
      this.quantityText,
      this.statusText,
      this.vipText,
      this.specialText,
      this.heart,
    ]);
    scene.add.existing(this);
    this.setDepth(40 + Math.round(y / 4) * 4);
  }

  public setCustomerState(state: CustomerState): void {
    this.customerState = state;
    this.stateElapsedMs = 0;
    this.showPatience =
      state === CustomerState.WAITING_FOR_SEAT
      || state === CustomerState.ORDERING
      || state === CustomerState.WAITING_FOR_FOOD;
    this.patienceBackground.setVisible(this.showPatience);
    this.patienceFill.setVisible(this.showPatience);
    this.patiencePresentationAccumulatorMs = Number.POSITIVE_INFINITY;
    this.patienceBand = -1;

    if (state === CustomerState.EATING) {
      this.bubble.setVisible(false);
      this.foodIcon.setVisible(false);
      this.quantityText.setVisible(false);
      this.statusText.setVisible(false);
    }
  }

  public setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
  }

  public updateMovement(deltaMs: number): boolean {
    this.stateElapsedMs += deltaMs;
    const deltaX = this.targetX - this.x;
    const deltaY = this.targetY - this.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared <= 1.44) {
      this.setPosition(this.targetX, this.targetY);
      const idleTexture = `customer-${this.kind}-0`;
      if (this.character.texture.key !== idleTexture) this.character.setTexture(idleTexture);
      if (this.nightRim.texture.key !== idleTexture) this.nightRim.setTexture(idleTexture);
      return true;
    }

    const distance = Math.sqrt(distanceSquared);
    const step = Math.min(distance, this.moveSpeed * (deltaMs / 1000));
    this.x += deltaX / distance * step;
    this.y += deltaY / distance * step;
    this.animationClock += deltaMs;
    if (this.animationClock >= 190) {
      this.animationClock = 0;
      this.animationFrame = this.animationFrame === 0 ? 1 : 0;
      if (this.x >= -8 && this.x <= 358 && this.y >= 32 && this.y <= 270) {
        const textureKey = `customer-${this.kind}-${this.animationFrame}`;
        if (this.character.texture.key !== textureKey) this.character.setTexture(textureKey);
        if (this.nightRim.texture.key !== textureKey) this.nightRim.setTexture(textureKey);
      }
    }
    const targetDepth = 40 + Math.round(this.y / 4) * 4;
    if (this.depth !== targetDepth) this.setDepth(targetDepth);
    return false;
  }

  public placeOrder(menuItemId: MenuItemId, quantity = 1, patienceBudgetMs?: number): void {
    const normalizedQuantity = Math.max(1, Math.round(quantity));
    this.orderId = menuItemId;
    this.orderQuantity = normalizedQuantity;
    this.remainingQuantity = normalizedQuantity;
    this.orderAccepted = false;
    if (patienceBudgetMs !== undefined) {
      const normalizedPatience = Math.max(1, Math.round(patienceBudgetMs));
      this.maxPatienceMs = normalizedPatience;
      this.patienceMs = normalizedPatience;
    }
    this.bubble.setVisible(true);
    this.foodIcon.setTexture(`food-${menuItemId}`).setVisible(true);
    this.updateQuantityLabel();
    this.setCustomerState(CustomerState.ORDERING);
  }

  public acceptOrder(): void {
    this.orderAccepted = true;
    this.bubble.setTint(0xffe6a4);
    this.setCustomerState(CustomerState.WAITING_FOR_FOOD);
  }

  public tickPatience(deltaMs: number, presentationIntervalMs = 100): void {
    this.stateElapsedMs += deltaMs;
    if (!this.showPatience) {
      this.statusText.setVisible(false);
      return;
    }

    const multiplier = this.customerState === CustomerState.ORDERING ? 1.25 : 1;
    this.patienceMs = Math.max(0, this.patienceMs - deltaMs * multiplier);
    this.patiencePresentationAccumulatorMs += deltaMs;
    if (
      this.patienceMs > 0
      && this.patiencePresentationAccumulatorMs < Math.max(50, presentationIntervalMs)
    ) return;
    this.patiencePresentationAccumulatorMs = 0;
    const ratio = this.getPatienceRatio();
    this.patienceFill.width = 24 * ratio;
    const nextBand = ratio > 0.58 ? 0 : ratio > 0.28 ? 1 : 2;
    if (nextBand !== this.patienceBand) {
      this.patienceBand = nextBand;
      this.patienceFill.setFillStyle(nextBand === 0 ? 0x77d48b : nextBand === 1 ? 0xf3bc61 : 0xe85a59);
      this.statusText
        .setText(nextBand === 0 ? "" : nextBand === 1 ? "!" : "!!")
        .setVisible(nextBand > 0);
    }
  }

  public serveOne(quantity = 1): boolean {
    const servedQuantity = Math.max(1, Math.round(quantity));
    this.remainingQuantity = Math.max(0, this.remainingQuantity - servedQuantity);
    if (this.remainingQuantity > 0) {
      this.patienceMs = Math.min(this.maxPatienceMs, this.patienceMs + 2_500);
      this.updateQuantityLabel();
      this.character.setTint(0xfff0bb);
      this.scene.time.delayedCall(180, () => this.character.clearTint());
      return false;
    }
    const data = getCustomerData(this.kind);
    this.eatingRemainingMs = data.eatingTimeMs;
    this.setCustomerState(CustomerState.EATING);
    this.character.setTint(0xfff0bb);
    this.scene.time.delayedCall(240, () => this.character.clearTint());
    return true;
  }

  public tickEating(deltaMs: number): boolean {
    this.stateElapsedMs += deltaMs;
    this.eatingRemainingMs = Math.max(0, this.eatingRemainingMs - deltaMs);
    const bobY = Math.floor(this.eatingRemainingMs / 420) % 2 === 0 ? -1 : 0;
    if (this.character.y !== bobY) this.character.setY(bobY);
    return this.eatingRemainingMs <= 0;
  }

  public getPatienceRatio(): number {
    return this.maxPatienceMs <= 0
      ? 0
      : Phaser.Math.Clamp(this.patienceMs / this.maxPatienceMs, 0, 1);
  }

  public showHeart(): void {
    this.scene.tweens.killTweensOf(this.heart);
    this.heart.setPosition(0, -25).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: this.heart,
      y: -39,
      alpha: 0,
      duration: 820,
      ease: "Sine.Out",
      onComplete: () => this.heart.setVisible(false),
    });
  }

  public showWalkout(): void {
    this.bubble.setVisible(false);
    this.foodIcon.setVisible(false);
    this.quantityText.setVisible(false);
    this.statusText.setText("헉냥!").setVisible(true);
    this.character.setTint(0x9aa0b8);
  }

  public setNightMode(enabled: boolean): void {
    this.nightRim.setVisible(enabled);
  }

  public resetBubbleTint(): void {
    this.bubble.clearTint();
  }

  private updateQuantityLabel(): void {
    const showRemaining = this.orderQuantity > 1 && this.remainingQuantity > 0;
    this.quantityText
      .setText(showRemaining ? `×${this.remainingQuantity}` : "")
      .setVisible(showRemaining);
  }
}
