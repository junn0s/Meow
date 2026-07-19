import Phaser from "phaser";
import { getCustomerData } from "../data/customerData";
import { CustomerState, type CustomerKind, type MenuItemId } from "../types/game";

export interface CustomerOptions {
  readonly patienceMs?: number;
  readonly vip?: boolean;
  readonly nightMode?: boolean;
}

export class Customer extends Phaser.GameObjects.Container {
  public readonly customerId: string;
  public readonly kind: CustomerKind;
  public readonly isVip: boolean;
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
  private animationClock = 0;
  private animationFrame = 0;
  private showPatience = false;

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
    ]);
    scene.add.existing(this);
    this.setDepth(40 + Math.round(y));
  }

  public setCustomerState(state: CustomerState): void {
    this.customerState = state;
    this.stateElapsedMs = 0;
    this.showPatience =
      state === CustomerState.ORDERING || state === CustomerState.WAITING_FOR_FOOD;
    this.patienceBackground.setVisible(this.showPatience);
    this.patienceFill.setVisible(this.showPatience);

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
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
    if (distance <= 1.2) {
      this.setPosition(this.targetX, this.targetY);
      this.character.setTexture(`customer-${this.kind}-0`);
      this.nightRim.setTexture(`customer-${this.kind}-0`);
      return true;
    }

    const step = Math.min(distance, this.moveSpeed * (deltaMs / 1000));
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetX, this.targetY);
    this.x += Math.cos(angle) * step;
    this.y += Math.sin(angle) * step;
    this.animationClock += deltaMs;
    if (this.animationClock >= 190) {
      this.animationClock = 0;
      this.animationFrame = this.animationFrame === 0 ? 1 : 0;
      this.character.setTexture(`customer-${this.kind}-${this.animationFrame}`);
      this.nightRim.setTexture(`customer-${this.kind}-${this.animationFrame}`);
    }
    this.setDepth(40 + Math.round(this.y));
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
      this.maxPatienceMs = Math.max(this.maxPatienceMs, normalizedPatience);
      this.patienceMs = Math.max(this.patienceMs, normalizedPatience);
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

  public tickPatience(deltaMs: number): void {
    this.stateElapsedMs += deltaMs;
    if (!this.showPatience) {
      this.statusText.setVisible(false);
      return;
    }

    const multiplier = this.customerState === CustomerState.ORDERING ? 1.25 : 1;
    this.patienceMs = Math.max(0, this.patienceMs - deltaMs * multiplier);
    const ratio = this.getPatienceRatio();
    this.patienceFill.width = 24 * ratio;
    this.patienceFill.setFillStyle(
      ratio > 0.58 ? 0x77d48b : ratio > 0.28 ? 0xf3bc61 : 0xe85a59,
    );
    this.statusText
      .setText(ratio > 0.58 ? "" : ratio > 0.28 ? "!" : "!!")
      .setVisible(ratio <= 0.58);
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
    if (Math.floor(this.eatingRemainingMs / 420) % 2 === 0) {
      this.character.setY(-1);
    } else {
      this.character.setY(0);
    }
    return this.eatingRemainingMs <= 0;
  }

  public getPatienceRatio(): number {
    return this.maxPatienceMs <= 0
      ? 0
      : Phaser.Math.Clamp(this.patienceMs / this.maxPatienceMs, 0, 1);
  }

  public showHeart(): void {
    const heart = this.scene.add.image(this.x, this.y - 25, "heart").setDepth(this.depth + 20);
    this.scene.tweens.add({
      targets: heart,
      y: heart.y - 14,
      alpha: 0,
      duration: 820,
      ease: "Sine.Out",
      onComplete: () => heart.destroy(),
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
