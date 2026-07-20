import Phaser from "phaser";
import { getFoodTextureKey, getMenuItem, getStationTextureKey } from "../data/menuData";
import type { MenuItemId } from "../types/game";

export interface CookingTicket {
  readonly customerId: string;
  readonly menuItemId: MenuItemId;
  readonly quantity: number;
  readonly cookingTimeMs?: number;
  readonly chefWorkerId?: string;
  /** Player tickets wait at the worktop until the owner explicitly starts them. */
  readonly cookingAgent?: "chef" | "player";
  readonly playerStarted?: boolean;
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
  private readonly cookingCountLabel: Phaser.GameObjects.Text;
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
    this.sprite = scene.add.image(x, y, getStationTextureKey(menuItemId)).setDepth(16);
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
      .image(x + 16, y - 20, getFoodTextureKey(menuItemId))
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
    this.cookingCountLabel = scene.add
      .text(x - 17, y - 27, "", {
        fontFamily: '"Jua", sans-serif',
        fontSize: "6px",
        color: "#fff1b8",
        backgroundColor: "#b94b3fe6",
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
    this.refreshCookingDisplay();
  }

  public setUnlocked(unlocked: boolean): void {
    this.unlocked = unlocked;
    this.sprite.setAlpha(unlocked ? 1 : 0.28);
    this.label.setAlpha(unlocked ? 1 : 0.38);
    this.lockLabel.setVisible(!unlocked);
    this.slotPips.forEach((pip) => pip.setVisible(unlocked));
    this.cookingCountLabel.setVisible(unlocked && this.activeSlots.length > 1);
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
    this.sprite.setTint(this.parallelSlotCount >= 3 ? 0xffd278 : this.parallelSlotCount === 2 ? 0xffb68c : 0xffffff);
    this.refreshCookingDisplay();
    this.startAvailableTickets();
  }

  public setProgressStats(priceLabel: string): void {
    const item = getMenuItem(this.menuItemId);
    this.label
      .setText(`${item.name} ${priceLabel}`)
      .setFontSize(7)
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

    let furthestProgress = 0;
    for (const slot of this.activeSlots) {
      slot.elapsedMs += deltaMs;
      furthestProgress = Math.max(
        furthestProgress,
        Phaser.Math.Clamp(slot.elapsedMs / slot.durationMs, 0, 1),
      );
    }
    this.progressFill.width = 36 * furthestProgress;

    let completedAny = false;
    for (let index = 0; index < this.activeSlots.length;) {
      const slot = this.activeSlots[index];
      if (slot === undefined || slot.elapsedMs < slot.durationMs) {
        index += 1;
        continue;
      }
      this.activeSlots.splice(index, 1);
      this.readyTickets.push(slot.ticket);
      this.onFoodReady?.(this, slot.ticket);
      completedAny = true;
    }
    if (!completedAny) return;
    this.progressBackground.setVisible(this.activeSlots.length > 0);
    this.progressFill.setVisible(this.activeSlots.length > 0);
    this.refreshCookingDisplay();
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

  public hasAvailableParallelSlot(): boolean {
    return this.activeSlots.length < this.parallelSlotCount;
  }

  public assignNextWaitingChefTicket(workerId: string): CookingTicket | undefined {
    const queueIndex = this.queue.findIndex(
      (ticket) => ticket.cookingAgent === "chef" && ticket.chefWorkerId === undefined,
    );
    const ticket = this.queue[queueIndex];
    if (queueIndex < 0 || ticket === undefined) return undefined;
    const assignedTicket: CookingTicket = { ...ticket, chefWorkerId: workerId };
    this.queue[queueIndex] = assignedTicket;
    this.startAvailableTickets();
    return assignedTicket;
  }

  public hasPendingPlayerTicket(): boolean {
    return this.queue.some(
      (ticket) => ticket.cookingAgent === "player" && ticket.playerStarted !== true,
    );
  }

  public startNextPlayerTicket(): CookingTicket | undefined {
    const queueIndex = this.queue.findIndex(
      (ticket) => ticket.cookingAgent === "player" && ticket.playerStarted !== true,
    );
    const ticket = this.queue[queueIndex];
    if (queueIndex < 0 || ticket === undefined) return undefined;

    const startedTicket: CookingTicket = { ...ticket, playerStarted: true };
    this.queue[queueIndex] = startedTicket;
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 110,
      yoyo: true,
      ease: "Sine.Out",
    });
    this.startAvailableTickets();
    return startedTicket;
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
    this.refreshCookingDisplay();
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
      this.refreshCookingDisplay();
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

  public getActiveChefCount(): number {
    let count = 0;
    for (const slot of this.activeSlots) {
      if (slot.ticket.cookingAgent !== "player") count += 1;
    }
    return count;
  }

  public hasActivePlayerCooking(): boolean {
    return this.activeSlots.some((slot) => slot.ticket.cookingAgent === "player");
  }

  public hasPlayerCookingCommitment(): boolean {
    return this.hasActivePlayerCooking() || this.queue.some(
      (ticket) => ticket.cookingAgent === "player" && ticket.playerStarted === true,
    );
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

  public hasActiveCookingForChef(workerId: string): boolean {
    return this.activeSlots.some((slot) => slot.ticket.chefWorkerId === workerId);
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
      this.refreshCookingDisplay();
    }
  }

  private refreshCookingDisplay(): void {
    this.slotPips.forEach((pip, index) => {
      const active = index < this.activeSlots.length;
      const available = index < this.parallelSlotCount;
      pip
        .setFillStyle(active ? 0xff685f : available ? 0xffcb69 : 0x26304b, 1)
        .setStrokeStyle(1, active ? 0xffe0a1 : 0xc88e5b);
    });
    this.cookingCountLabel
      .setText(this.activeSlots.length > 1 ? `조리×${this.activeSlots.length}` : "")
      .setVisible(this.unlocked && this.activeSlots.length > 1);
  }

  private refreshReadyCount(): void {
    this.readyCountLabel
      .setText(this.readyTickets.length > 1 ? `×${this.readyTickets.length}` : "")
      .setVisible(this.readyTickets.length > 1);
  }
}
