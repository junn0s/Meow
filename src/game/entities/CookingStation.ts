import Phaser from "phaser";
import { getMenuItem } from "../data/menuData";
import type { MenuItemId } from "../types/game";

export interface CookingTicket {
  readonly customerId: string;
  readonly menuItemId: MenuItemId;
  readonly quantity: number;
  readonly chefWorkerId?: string;
}

export type FoodReadyCallback = (station: CookingStation, ticket: CookingTicket) => void;

export class CookingStation {
  public readonly menuItemId: MenuItemId;
  public readonly x: number;
  public readonly y: number;

  private readonly scene: Phaser.Scene;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private readonly lockLabel: Phaser.GameObjects.Text;
  private readonly progressBackground: Phaser.GameObjects.Rectangle;
  private readonly progressFill: Phaser.GameObjects.Rectangle;
  private readonly readyIcon: Phaser.GameObjects.Image;
  private readonly queue: CookingTicket[] = [];
  private readonly readyTickets: CookingTicket[] = [];
  private activeTicket?: CookingTicket;
  private elapsedMs = 0;
  private durationMs = 1;
  private unlocked = false;
  private speedMultiplier = 1;
  private onFoodReady?: FoodReadyCallback;
  private cookingTimeResolver?: (quantity: number) => number;
  private canStartNextResolver?: () => boolean;

  public constructor(scene: Phaser.Scene, menuItemId: MenuItemId, x: number, y: number) {
    this.scene = scene;
    this.menuItemId = menuItemId;
    this.x = x;
    this.y = y;
    const item = getMenuItem(menuItemId);
    this.sprite = scene.add.image(x, y, `station-${menuItemId}`).setDepth(16);
    this.label = scene.add
      .text(x, y + 25, item.name, {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        color: "#ffe7b3",
        backgroundColor: "#24182acb",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(18);
    this.lockLabel = scene.add
      .text(x, y, "잠김", {
        fontFamily: '"Gowun Dodum", sans-serif',
        fontSize: "8px",
        color: "#aeb4cd",
        backgroundColor: "#101426e6",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(19);
    this.progressBackground = scene.add
      .rectangle(x - 19, y + 19, 38, 3, 0x21172a, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(19)
      .setVisible(false);
    this.progressFill = scene.add
      .rectangle(x - 18, y + 19, 36, 1, 0xffc36a, 1)
      .setOrigin(0, 0.5)
      .setDepth(20)
      .setVisible(false);
    this.readyIcon = scene.add
      .image(x + 16, y - 20, `food-${menuItemId}`)
      .setDepth(24)
      .setVisible(false);
    this.setUnlocked(menuItemId === "fishcake");
  }

  public setUnlocked(unlocked: boolean): void {
    this.unlocked = unlocked;
    this.sprite.setAlpha(unlocked ? 1 : 0.28);
    this.label.setAlpha(unlocked ? 1 : 0.38);
    this.lockLabel.setVisible(!unlocked);
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Phaser.Math.Clamp(multiplier, 0.2, 2);
  }

  public setReadyCallback(callback: FoodReadyCallback): void {
    this.onFoodReady = callback;
  }

  public setCookingTimeResolver(resolver: (quantity: number) => number): void {
    this.cookingTimeResolver = resolver;
  }

  public setCanStartNextResolver(resolver: () => boolean): void {
    this.canStartNextResolver = resolver;
  }

  public setProgressStats(priceLabel: string, priceLevel: number, speedLevel: number): void {
    const item = getMenuItem(this.menuItemId);
    this.label
      .setText(`${item.name} ${priceLabel}\nP${priceLevel} · S${speedLevel}`)
      .setFontSize(6)
      .setAlign("center");
  }

  public enqueue(ticket: CookingTicket): void {
    if (!this.unlocked) {
      return;
    }
    this.queue.push(ticket);
    this.startNextIfIdle();
  }

  public update(deltaMs: number): void {
    if (this.activeTicket === undefined) {
      this.startNextIfIdle();
      return;
    }

    this.elapsedMs += deltaMs;
    const ratio = Phaser.Math.Clamp(this.elapsedMs / this.durationMs, 0, 1);
    this.progressFill.width = 36 * ratio;
    if (this.elapsedMs < this.durationMs) {
      return;
    }

    const completedTicket = this.activeTicket;
    this.activeTicket = undefined;
    this.readyTickets.push(completedTicket);
    this.progressBackground.setVisible(false);
    this.progressFill.setVisible(false);
    this.readyIcon.setVisible(true);
    this.scene.tweens.add({
      targets: this.readyIcon,
      y: this.y - 24,
      duration: 230,
      yoyo: true,
      ease: "Sine.Out",
    });
    this.onFoodReady?.(this, completedTicket);
    this.startNextIfIdle();
  }

  public takeReadyTicket(): CookingTicket | undefined {
    const ticket = this.readyTickets.shift();
    this.readyIcon.setVisible(this.readyTickets.length > 0);
    return ticket;
  }

  public returnReadyTicket(ticket: CookingTicket): void {
    this.readyTickets.unshift(ticket);
    this.readyIcon.setVisible(true);
  }

  public peekReadyTicket(): CookingTicket | undefined {
    return this.readyTickets[0];
  }

  public getReadyCount(): number {
    return this.readyTickets.length;
  }

  public getQueueCount(): number {
    return this.queue.length + Number(this.activeTicket !== undefined);
  }

  public reassignTicketCustomer(
    fromCustomerId: string,
    toCustomerId: string,
    quantity: number,
  ): boolean {
    const reassign = (ticket: CookingTicket): CookingTicket => ({
      ...ticket,
      customerId: toCustomerId,
    });
    const queueIndex = this.queue.findIndex(
      (ticket) => ticket.customerId === fromCustomerId && ticket.quantity === quantity,
    );
    if (queueIndex >= 0) {
      const ticket = this.queue[queueIndex];
      if (ticket !== undefined) this.queue[queueIndex] = reassign(ticket);
      return ticket !== undefined;
    }
    const readyIndex = this.readyTickets.findIndex(
      (ticket) => ticket.customerId === fromCustomerId && ticket.quantity === quantity,
    );
    if (readyIndex >= 0) {
      const ticket = this.readyTickets[readyIndex];
      if (ticket !== undefined) this.readyTickets[readyIndex] = reassign(ticket);
      return ticket !== undefined;
    }
    if (
      this.activeTicket?.customerId === fromCustomerId
      && this.activeTicket.quantity === quantity
    ) {
      this.activeTicket = reassign(this.activeTicket);
      return true;
    }
    return false;
  }

  public cancelTicketsForCustomer(customerId: string): CookingTicket[] {
    const cancelled: CookingTicket[] = [];
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index]?.customerId === customerId) {
        const [ticket] = this.queue.splice(index, 1);
        if (ticket !== undefined) cancelled.push(ticket);
      }
    }
    for (let index = this.readyTickets.length - 1; index >= 0; index -= 1) {
      if (this.readyTickets[index]?.customerId === customerId) {
        const [ticket] = this.readyTickets.splice(index, 1);
        if (ticket !== undefined) cancelled.push(ticket);
      }
    }
    if (this.activeTicket?.customerId === customerId) {
      cancelled.push(this.activeTicket);
      this.activeTicket = undefined;
      this.elapsedMs = 0;
      this.progressBackground.setVisible(false);
      this.progressFill.setVisible(false);
      this.startNextIfIdle();
    }
    this.readyIcon.setVisible(this.readyTickets.length > 0);
    return cancelled;
  }

  public getActiveTicket(): CookingTicket | undefined {
    return this.activeTicket;
  }

  public distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.x, this.y, x, y);
  }

  private startNextIfIdle(): void {
    if (
      this.activeTicket !== undefined
      || this.queue.length === 0
      || this.canStartNextResolver?.() === false
    ) {
      return;
    }

    this.activeTicket = this.queue.shift();
    if (this.activeTicket === undefined) {
      return;
    }
    this.elapsedMs = 0;
    this.durationMs = this.cookingTimeResolver?.(this.activeTicket.quantity)
      ?? getMenuItem(this.activeTicket.menuItemId).cookingTimeMs * this.speedMultiplier;
    this.progressFill.width = 0;
    this.progressBackground.setVisible(true);
    this.progressFill.setVisible(true);
  }
}
