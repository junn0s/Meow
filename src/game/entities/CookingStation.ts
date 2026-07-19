import Phaser from "phaser";
import { getMenuItem } from "../data/menuData";
import type { MenuItemId } from "../types/game";

export interface CookingTicket {
  readonly customerId: string;
  readonly menuItemId: MenuItemId;
  readonly quantity: number;
  readonly cookingTimeMs?: number;
  readonly chefWorkerId?: string;
}

export type FoodReadyCallback = (station: CookingStation, ticket: CookingTicket) => void;

interface ActiveCookingSlot {
  ticket: CookingTicket;
  elapsedMs: number;
  durationMs: number;
}

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
  private readonly readyCountLabel: Phaser.GameObjects.Text;
  private readonly slotPips: Phaser.GameObjects.Arc[];
  private readonly queue: CookingTicket[] = [];
  private readonly readyTickets: CookingTicket[] = [];
  private readonly activeSlots: ActiveCookingSlot[] = [];
  private parallelSlotCount = 1;
  private unlocked = false;
  private speedMultiplier = 1;
  private onFoodReady?: FoodReadyCallback;
  private cookingTimeResolver?: (quantity: number) => number;
  private canStartNextResolver?: (ticket: CookingTicket) => boolean;

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
    this.readyCountLabel = scene.add
      .text(x + 23, y - 24, "", {
        fontFamily: '"Jua", sans-serif',
        fontSize: "7px",
        color: "#fff7d6",
        backgroundColor: "#9a3942",
        padding: { x: 2, y: 0 },
      })
      .setOrigin(0.5)
      .setDepth(25)
      .setVisible(false);
    this.slotPips = [-7, 0, 7].map((offset) => scene.add
      .circle(x + offset, y - 18, 2, 0x26304b, 1)
      .setStrokeStyle(1, 0xc88e5b)
      .setDepth(20));
    this.setUnlocked(menuItemId === "fishcake");
  }

  public setUnlocked(unlocked: boolean): void {
    this.unlocked = unlocked;
    this.sprite.setAlpha(unlocked ? 1 : 0.28);
    this.label.setAlpha(unlocked ? 1 : 0.38);
    this.lockLabel.setVisible(!unlocked);
    this.slotPips.forEach((pip) => pip.setVisible(unlocked));
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

  public setCanStartNextResolver(resolver: (ticket: CookingTicket) => boolean): void {
    this.canStartNextResolver = resolver;
  }

  public setParallelSlotCount(count: number): void {
    this.parallelSlotCount = Phaser.Math.Clamp(Math.floor(count), 1, 4);
    this.slotPips.forEach((pip, index) => {
      pip.setFillStyle(index < this.parallelSlotCount ? 0xffcb69 : 0x26304b, 1);
    });
    this.sprite.setTint(this.parallelSlotCount >= 3 ? 0xffd278 : this.parallelSlotCount === 2 ? 0xffb68c : 0xffffff);
    this.startAvailableTickets();
  }

  public setProgressStats(
    priceLabel: string,
    priceLevel: number,
    speedLevel: number,
    cookingSlotCount = 1,
  ): void {
    const item = getMenuItem(this.menuItemId);
    this.label
      .setText(`${item.name} ${priceLabel}\nP${priceLevel} · S${speedLevel} · C${cookingSlotCount}`)
      .setFontSize(6)
      .setAlign("center");
  }

  public enqueue(ticket: CookingTicket): void {
    if (!this.unlocked) {
      return;
    }
    this.queue.push(ticket);
    this.startAvailableTickets();
  }

  public update(deltaMs: number): void {
    this.startAvailableTickets();
    if (this.activeSlots.length === 0) {
      return;
    }

    for (const slot of this.activeSlots) {
      slot.elapsedMs += deltaMs;
    }
    const furthestProgress = Math.max(...this.activeSlots.map(
      (slot) => Phaser.Math.Clamp(slot.elapsedMs / slot.durationMs, 0, 1),
    ));
    this.progressFill.width = 36 * furthestProgress;

    const completed = this.activeSlots.filter((slot) => slot.elapsedMs >= slot.durationMs);
    if (completed.length === 0) return;
    for (const slot of completed) {
      const index = this.activeSlots.indexOf(slot);
      if (index >= 0) this.activeSlots.splice(index, 1);
      this.readyTickets.push(slot.ticket);
      this.onFoodReady?.(this, slot.ticket);
    }
    this.progressBackground.setVisible(this.activeSlots.length > 0);
    this.progressFill.setVisible(this.activeSlots.length > 0);
    this.readyIcon.setVisible(true);
    this.refreshReadyCount();
    this.scene.tweens.add({
      targets: this.readyIcon,
      y: this.y - 24,
      duration: 230,
      yoyo: true,
      ease: "Sine.Out",
    });
    this.startAvailableTickets();
  }

  public takeReadyTicket(): CookingTicket | undefined {
    const ticket = this.readyTickets.shift();
    this.readyIcon.setVisible(this.readyTickets.length > 0);
    this.refreshReadyCount();
    return ticket;
  }

  public returnReadyTicket(ticket: CookingTicket): void {
    this.readyTickets.unshift(ticket);
    this.readyIcon.setVisible(true);
    this.refreshReadyCount();
  }

  public peekReadyTicket(): CookingTicket | undefined {
    return this.readyTickets[0];
  }

  public getReadyCount(): number {
    return this.readyTickets.length;
  }

  public getQueueCount(): number {
    return this.queue.length + this.activeSlots.length;
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
    const activeSlot = this.activeSlots.find(
      (slot) => slot.ticket.customerId === fromCustomerId && slot.ticket.quantity === quantity,
    );
    if (activeSlot !== undefined) {
      activeSlot.ticket = reassign(activeSlot.ticket);
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
    for (let index = this.activeSlots.length - 1; index >= 0; index -= 1) {
      const slot = this.activeSlots[index];
      if (slot?.ticket.customerId === customerId) {
        const [removed] = this.activeSlots.splice(index, 1);
        if (removed !== undefined) cancelled.push(removed.ticket);
      }
    }
    this.progressBackground.setVisible(this.activeSlots.length > 0);
    this.progressFill.setVisible(this.activeSlots.length > 0);
    this.startAvailableTickets();
    this.readyIcon.setVisible(this.readyTickets.length > 0);
    this.refreshReadyCount();
    return cancelled;
  }

  public cancelOneTicketForCustomer(
    customerId: string,
    quantity = 1,
  ): CookingTicket | undefined {
    const queueIndex = this.queue.findIndex(
      (ticket) => ticket.customerId === customerId && ticket.quantity === quantity,
    );
    if (queueIndex >= 0) {
      const [ticket] = this.queue.splice(queueIndex, 1);
      return ticket;
    }
    const activeIndex = this.activeSlots.findIndex(
      (slot) => slot.ticket.customerId === customerId && slot.ticket.quantity === quantity,
    );
    if (activeIndex >= 0) {
      const [slot] = this.activeSlots.splice(activeIndex, 1);
      this.progressBackground.setVisible(this.activeSlots.length > 0);
      this.progressFill.setVisible(this.activeSlots.length > 0);
      this.startAvailableTickets();
      return slot?.ticket;
    }
    const readyIndex = this.readyTickets.findIndex(
      (ticket) => ticket.customerId === customerId && ticket.quantity === quantity,
    );
    if (readyIndex >= 0) {
      const [ticket] = this.readyTickets.splice(readyIndex, 1);
      this.readyIcon.setVisible(this.readyTickets.length > 0);
      this.refreshReadyCount();
      return ticket;
    }
    return undefined;
  }

  public getActiveTicket(): CookingTicket | undefined {
    return this.activeSlots[0]?.ticket;
  }

  public getActiveTickets(): readonly CookingTicket[] {
    return this.activeSlots.map((slot) => slot.ticket);
  }

  public getActiveCount(): number {
    return this.activeSlots.length;
  }

  public getEstimatedQueueDelayMs(): number {
    if (this.activeSlots.length < this.parallelSlotCount && this.queue.length === 0) {
      return 0;
    }
    const activeWorkMs = this.activeSlots.reduce(
      (sum, slot) => sum + Math.max(0, slot.durationMs - slot.elapsedMs),
      0,
    );
    const queuedWorkMs = this.queue.reduce((sum, ticket) => sum + (
      ticket.cookingTimeMs
        ?? this.cookingTimeResolver?.(ticket.quantity)
        ?? getMenuItem(ticket.menuItemId).cookingTimeMs * this.speedMultiplier
    ), 0);
    return Math.round((activeWorkMs + queuedWorkMs) / Math.max(1, this.parallelSlotCount));
  }

  public hasPendingCookingForChef(workerId: string): boolean {
    return this.queue.some((ticket) => ticket.chefWorkerId === workerId)
      || this.activeSlots.some((slot) => slot.ticket.chefWorkerId === workerId);
  }

  public distanceTo(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.x, this.y, x, y);
  }

  private startAvailableTickets(): void {
    while (this.activeSlots.length < this.parallelSlotCount && this.queue.length > 0) {
      const queueIndex = this.queue.findIndex(
        (ticket) => this.canStartNextResolver?.(ticket) !== false,
      );
      if (queueIndex < 0) break;
      const [ticket] = this.queue.splice(queueIndex, 1);
      if (ticket === undefined) break;
      const durationMs = ticket.cookingTimeMs
        ?? this.cookingTimeResolver?.(ticket.quantity)
        ?? getMenuItem(ticket.menuItemId).cookingTimeMs * this.speedMultiplier;
      this.activeSlots.push({ ticket, elapsedMs: 0, durationMs });
      this.progressFill.width = 0;
      this.progressBackground.setVisible(true);
      this.progressFill.setVisible(true);
    }
  }

  private refreshReadyCount(): void {
    this.readyCountLabel
      .setText(this.readyTickets.length > 1 ? `×${this.readyTickets.length}` : "")
      .setVisible(this.readyTickets.length > 1);
  }
}
