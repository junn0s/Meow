import Phaser from "phaser";
import { createGameBackdrop, type DinerDecor, UI_FONT } from "../art/SceneDecor";
import { SoundManager } from "../audio/SoundManager";
import { CookingStation, type CookingTicket } from "../entities/CookingStation";
import { Customer } from "../entities/Customer";
import { Player } from "../entities/Player";
import { DiningTable } from "../entities/Table";
import { getCustomerData, pickCustomerData } from "../data/customerData";
import { getMenuItem } from "../data/menuData";
import { EconomySystem } from "../systems/EconomySystem";
import { SaveSystem } from "../systems/SaveSystem";
import { UpgradeSystem } from "../systems/UpgradeSystem";
import {
  CustomerState,
  type MenuItemId,
  type SaveData,
  type UpgradeEffects,
} from "../types/game";
import { HUD } from "../../ui/HUD";
import { PixelButton } from "../../ui/PixelButton";
import { ToastManager } from "../../ui/ToastManager";
import { UpgradePanel } from "../../ui/UpgradePanel";
import { configureHighDefinitionScene, LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../art/Presentation";

export interface GameSceneData {
  readonly newGame?: boolean;
  readonly muted?: boolean;
}

interface PendingPayment {
  readonly image: Phaser.GameObjects.Image;
  readonly menuItemId: MenuItemId;
  readonly quantity: number;
  readonly tipRate: number;
  readonly ratingGain: number;
  ageMs: number;
}

interface InteractionTarget {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly action: () => void;
}

const TABLE_POSITIONS = [
  { x: 83, y: 151 },
  { x: 267, y: 151 },
  { x: 83, y: 213 },
  { x: 267, y: 213 },
  { x: 175, y: 151 },
  { x: 175, y: 213 },
] as const;

const BASE_SPAWN_INTERVAL_MS = 3_150;
const AUTO_ORDER_DELAY_MS = 720;
const SAVE_INTERVAL_MS = 4_000;

export class GameScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;
  private economy!: EconomySystem;
  private upgrades!: UpgradeSystem;
  private currentSave!: SaveData;
  private currentEffects!: UpgradeEffects;
  private sfx!: SoundManager;
  private decor!: DinerDecor;
  private player!: Player;
  private hud!: HUD;
  private upgradePanel!: UpgradePanel;
  private toast!: ToastManager;
  private readonly customers = new Map<string, Customer>();
  private readonly tables: DiningTable[] = [];
  private readonly stations = new Map<MenuItemId, CookingStation>();
  private readonly pendingPayments: PendingPayment[] = [];
  private chefSprite?: Phaser.GameObjects.Image;
  private serverSprite?: Phaser.GameObjects.Image;
  private serverBusy = false;
  private serverTargetCustomerId?: string;
  private spawnCountdownMs = 850;
  private saveCountdownMs = SAVE_INTERVAL_MS;
  private elapsedMs = 0;
  private customerSerial = 0;
  private workerAnimationClock = 0;
  private workerAnimationFrame = 0;
  private interactionMarker!: Phaser.GameObjects.Image;
  private interactionText!: Phaser.GameObjects.Text;
  private currentInteraction?: InteractionTarget;
  private isPaused = false;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private tutorialOverlay?: Phaser.GameObjects.Container;
  private tutorialStep = 0;
  private tutorialCompleted = false;
  private clearing = false;
  private removeEconomyListener?: () => void;
  private removeUpgradeListener?: () => void;

  public constructor() {
    super("GameScene");
  }

  public create(data: GameSceneData): void {
    configureHighDefinitionScene(this);
    this.physics.world.setBounds(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.resetTransientState();
    this.saveSystem = new SaveSystem();
    const previousSave = this.saveSystem.load();
    this.currentSave = data.newGame === true
      ? this.saveSystem.newGame({
          muted: data.muted ?? previousSave?.muted ?? false,
          settings: previousSave === null
            ? undefined
            : {
                ...previousSave.settings,
                muted: data.muted ?? previousSave.muted,
              },
          elapsedMs: 0,
        })
      : previousSave ?? this.saveSystem.newGame({ muted: data.muted });
    this.economy = new EconomySystem({
      money: this.currentSave.money,
      customerCount: this.currentSave.customerCount,
      rating: this.currentSave.rating,
    });
    this.upgrades = new UpgradeSystem(this.economy, this.currentSave.purchasedUpgradeIds);
    this.currentEffects = this.upgrades.getEffects();
    this.tutorialCompleted = this.currentSave.tutorialCompleted;
    this.elapsedMs = this.currentSave.elapsedMs;
    this.sfx = new SoundManager(this.currentSave.muted);
    this.decor = createGameBackdrop(this);

    this.createStations();
    this.createTables(this.currentEffects.seatCount);
    this.player = new Player(this, 176, 128);
    this.createWorkers();
    this.applyEffects(this.currentEffects, false);
    this.hud = new HUD(this);
    this.upgradePanel = new UpgradePanel(this);
    this.toast = new ToastManager(this);
    this.createInteractionIndicator();
    this.createInputHandlers();
    this.createSubscriptions();
    this.refreshUi(false);
    this.configureDebugApi();

    if (!this.tutorialCompleted) {
      this.showTutorial();
    } else {
      this.time.delayedCall(350, () => this.spawnCustomer());
      setStatus("영업을 시작했습니다. 방향키로 이동하고 스페이스바로 상호작용하세요.");
    }

    this.game.events.on("app-before-unload", this.saveProgress, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.cameras.main.fadeIn(260, 8, 11, 25);
  }

  public override update(_time: number, deltaMs: number): void {
    const stepMs = Math.min(deltaMs, 64);
    this.hud.update(stepMs);
    if (this.isPaused || this.tutorialOverlay !== undefined || this.clearing) {
      return;
    }

    this.elapsedMs += stepMs;
    this.hud.setElapsedTime(this.elapsedMs);
    this.player.update(stepMs);
    this.updateCustomers(stepMs);
    this.updateStations(stepMs);
    this.updateWorkers(stepMs);
    this.updatePayments(stepMs);
    this.updateSpawner(stepMs);
    this.updateInteractionIndicator();

    this.saveCountdownMs -= stepMs;
    if (this.saveCountdownMs <= 0) {
      this.saveCountdownMs = SAVE_INTERVAL_MS;
      this.saveProgress();
    }
  }

  private resetTransientState(): void {
    this.customers.clear();
    this.tables.length = 0;
    this.stations.clear();
    this.pendingPayments.length = 0;
    this.serverBusy = false;
    this.serverTargetCustomerId = undefined;
    this.spawnCountdownMs = 850;
    this.saveCountdownMs = SAVE_INTERVAL_MS;
    this.customerSerial = 0;
    this.workerAnimationClock = 0;
    this.workerAnimationFrame = 0;
    this.isPaused = false;
    this.pauseOverlay = undefined;
    this.tutorialOverlay = undefined;
    this.tutorialStep = 0;
    this.clearing = false;
  }

  private createStations(): void {
    const stationDefinitions = [
      { menuItemId: "fishcake", x: 62 },
      { menuItemId: "tteokbokki", x: 171 },
      { menuItemId: "fish-bread", x: 280 },
    ] as const;
    for (const definition of stationDefinitions) {
      const station = new CookingStation(this, definition.menuItemId, definition.x, 84);
      station.setReadyCallback((_readyStation, _ticket) => {
        this.sfx.ready();
        setStatus(`${getMenuItem(definition.menuItemId).name} 조리가 완료됐습니다.`);
      });
      this.stations.set(definition.menuItemId, station);
    }
  }

  private createTables(targetCount: number): void {
    while (this.tables.length < targetCount) {
      const position = TABLE_POSITIONS[this.tables.length];
      if (position === undefined) {
        break;
      }
      const table = new DiningTable(
        this,
        `table-${this.tables.length + 1}`,
        position.x,
        position.y,
      );
      table.pulse();
      this.tables.push(table);
    }
  }

  private createWorkers(): void {
    this.chefSprite = this.add.image(29, 89, "chef-0").setDepth(116).setVisible(false);
    this.serverSprite = this.add.image(323, 128, "server-0").setDepth(150).setVisible(false);
  }

  private createInteractionIndicator(): void {
    this.interactionMarker = this.add
      .image(0, 0, "interaction-marker")
      .setDepth(880)
      .setVisible(false);
    this.interactionText = this.add
      .text(0, 0, "", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "8px",
        color: "#fff4c7",
        backgroundColor: "#202842e8",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(881)
      .setVisible(false);
  }

  private createInputHandlers(): void {
    const keyboard = this.input.keyboard;
    if (keyboard === null) {
      return;
    }
    keyboard.on("keydown-SPACE", this.handleSpace, this);
    keyboard.on("keydown-ESC", this.togglePause, this);
    keyboard.on("keydown-M", this.toggleMute, this);
  }

  private createSubscriptions(): void {
    this.removeEconomyListener = this.economy.subscribe(() => this.refreshUi());
    this.removeUpgradeListener = this.upgrades.subscribe((_ids, effects) => {
      this.currentEffects = effects;
      this.applyEffects(effects, true);
      this.refreshUi();
    });
    this.upgradePanel.onPurchase(() => this.purchaseNextUpgrade());
  }

  private updateSpawner(deltaMs: number): void {
    this.spawnCountdownMs -= deltaMs;
    if (this.spawnCountdownMs > 0) {
      return;
    }

    const maxWaiting = this.currentEffects.seatCount + 4;
    if (this.customers.size < maxWaiting) {
      this.spawnCustomer();
    }
    this.spawnCountdownMs = BASE_SPAWN_INTERVAL_MS * this.currentEffects.customerSpawnIntervalMultiplier;
  }

  private spawnCustomer(): void {
    if (this.clearing) {
      return;
    }
    const data = pickCustomerData(Math.random());
    this.customerSerial += 1;
    const customer = new Customer(
      this,
      `guest-${Date.now()}-${this.customerSerial}`,
      data.id,
      -16,
      231,
    );
    const waitingIndex = [...this.customers.values()].filter(
      (other) =>
        other.customerState === CustomerState.ENTERING ||
        other.customerState === CustomerState.WAITING_FOR_SEAT,
    ).length;
    customer.setTarget(20 + (waitingIndex % 3) * 15, 230 - Math.floor(waitingIndex / 3) * 18);
    customer.setCustomerState(CustomerState.ENTERING);
    this.customers.set(customer.customerId, customer);
    this.spawnCountdownMs =
      BASE_SPAWN_INTERVAL_MS * this.currentEffects.customerSpawnIntervalMultiplier;
    this.sfx.enter();
  }

  private updateCustomers(deltaMs: number): void {
    const customers = [...this.customers.values()];
    for (const customer of customers) {
      switch (customer.customerState) {
        case CustomerState.ENTERING:
          if (customer.updateMovement(deltaMs)) {
            customer.setCustomerState(CustomerState.WAITING_FOR_SEAT);
          }
          break;
        case CustomerState.WAITING_FOR_SEAT:
          this.tryAssignSeat(customer);
          break;
        case CustomerState.MOVING_TO_SEAT:
          if (customer.updateMovement(deltaMs)) {
            this.createCustomerOrder(customer);
          }
          break;
        case CustomerState.ORDERING:
          customer.tickPatience(deltaMs);
          if (this.currentEffects.chefHired && customer.stateElapsedMs >= AUTO_ORDER_DELAY_MS) {
            this.acceptOrder(customer, true);
          }
          break;
        case CustomerState.WAITING_FOR_FOOD:
          customer.tickPatience(deltaMs);
          break;
        case CustomerState.EATING:
          if (customer.tickEating(deltaMs)) {
            this.finishMeal(customer);
          }
          break;
        case CustomerState.PAYING:
          break;
        case CustomerState.LEAVING:
          if (customer.updateMovement(deltaMs)) {
            this.customers.delete(customer.customerId);
            customer.destroy();
          }
          break;
      }
    }

    for (const customer of customers) {
      if (customer.customerState === CustomerState.WAITING_FOR_SEAT) {
        this.tryAssignSeat(customer);
      }
    }
  }

  private tryAssignSeat(customer: Customer): void {
    const table = this.tables.find((candidate) => candidate.isAvailable());
    if (table === undefined || !table.reserve(customer.customerId)) {
      return;
    }
    customer.assignedTableId = table.id;
    customer.setTarget(table.seatPosition.x, table.seatPosition.y);
    customer.setCustomerState(CustomerState.MOVING_TO_SEAT);
  }

  private createCustomerOrder(customer: Customer): void {
    const menuItemId = this.pickMenuForCustomer(customer);
    const quantity = customer.kind === "raccoon" && Math.random() < 0.4 ? 2 : 1;
    customer.placeOrder(menuItemId, quantity);
    setStatus(`${getCustomerData(customer.kind).name} 손님이 ${getMenuItem(menuItemId).name}을 주문하려 합니다.`);
  }

  private pickMenuForCustomer(customer: Customer): MenuItemId {
    const unlocked = this.currentEffects.unlockedMenuIds;
    const preferred = getCustomerData(customer.kind).preferredMenuId;
    if (preferred !== undefined && unlocked.includes(preferred) && Math.random() < 0.67) {
      return preferred;
    }
    const picked = unlocked[Phaser.Math.Between(0, Math.max(0, unlocked.length - 1))];
    return picked ?? "fishcake";
  }

  private acceptOrder(customer: Customer, automated: boolean): void {
    if (customer.customerState !== CustomerState.ORDERING || customer.orderId === undefined) {
      return;
    }
    const station = this.stations.get(customer.orderId);
    if (station === undefined || !station.isUnlocked()) {
      return;
    }
    const ticket: CookingTicket = {
      customerId: customer.customerId,
      menuItemId: customer.orderId,
      quantity: customer.orderQuantity,
    };
    customer.acceptOrder();
    station.enqueue(ticket);
    this.sfx.click();
    if (automated) {
      this.pulseWorker(this.chefSprite);
    } else {
      this.toast.show(`${getMenuItem(customer.orderId).name} 주문 접수!`, "success");
    }
    setStatus(`${getMenuItem(customer.orderId).name} 주문이 접수되어 조리를 시작합니다.`);
  }

  private updateStations(deltaMs: number): void {
    for (const station of this.stations.values()) {
      station.update(deltaMs);
    }
  }

  private updateWorkers(deltaMs: number): void {
    this.workerAnimationClock += deltaMs;
    if (this.workerAnimationClock >= 360) {
      this.workerAnimationClock = 0;
      this.workerAnimationFrame = this.workerAnimationFrame === 0 ? 1 : 0;
      this.chefSprite?.setTexture(`chef-${this.workerAnimationFrame}`);
      if (!this.serverBusy) {
        this.serverSprite?.setTexture(`server-${this.workerAnimationFrame}`);
      }
    }

    if (!this.currentEffects.serverHired || this.serverBusy) {
      return;
    }
    for (const station of this.stations.values()) {
      const ticket = station.peekReadyTicket();
      if (ticket === undefined) {
        continue;
      }
      station.takeReadyTicket();
      this.startServerDelivery(station, ticket);
      break;
    }
  }

  private startServerDelivery(station: CookingStation, ticket: CookingTicket): void {
    const server = this.serverSprite;
    if (server === undefined) {
      return;
    }
    this.serverBusy = true;
    server.setTexture("server-1").setDepth(300).setPosition(station.x + 19, station.y + 20);
    this.time.delayedCall(160, () => {
      const target = this.findWaitingCustomer(ticket.customerId, ticket.menuItemId);
      if (target === undefined || !server.active) {
        station.returnReadyTicket(ticket);
        this.serverBusy = false;
        this.serverTargetCustomerId = undefined;
        return;
      }
      this.serverTargetCustomerId = target.customerId;
      this.tweens.add({
        targets: server,
        x: target.x + 17,
        y: target.y,
        duration: 390,
        ease: "Sine.InOut",
        onUpdate: () => server.setDepth(50 + Math.round(server.y)),
        onComplete: () => {
          const deliveryTarget =
            target.active && target.customerState === CustomerState.WAITING_FOR_FOOD
              ? target
              : this.findWaitingCustomer(ticket.customerId, ticket.menuItemId);
          if (deliveryTarget !== undefined) {
            this.serveCustomer(deliveryTarget, true);
          } else {
            station.returnReadyTicket(ticket);
          }
          this.serverTargetCustomerId = undefined;
          this.tweens.add({
            targets: server,
            x: 323,
            y: 128,
            duration: 340,
            onComplete: () => {
              this.serverBusy = false;
              server.setDepth(150);
            },
          });
        },
      });
    });
  }

  private findWaitingCustomer(customerId: string, menuItemId: MenuItemId): Customer | undefined {
    const exact = this.customers.get(customerId);
    if (
      exact?.customerState === CustomerState.WAITING_FOR_FOOD &&
      exact.orderId === menuItemId
    ) {
      return exact;
    }
    return [...this.customers.values()].find(
      (customer) =>
        customer.customerState === CustomerState.WAITING_FOR_FOOD &&
        customer.orderId === menuItemId,
    );
  }

  private serveCustomer(customer: Customer, automated: boolean): void {
    customer.serve();
    customer.showHeart();
    this.sfx.buy();
    if (automated) {
      this.pulseWorker(this.serverSprite);
    } else {
      this.player.clearCarriedFood();
      this.hud.setHeldFood();
      this.toast.show("따뜻하게 서빙했어요!", "success");
    }
    setStatus(`${getCustomerData(customer.kind).name} 손님에게 음식을 서빙했습니다.`);
  }

  private finishMeal(customer: Customer): void {
    customer.setCustomerState(CustomerState.PAYING);
    const table = this.tables.find((candidate) => candidate.id === customer.assignedTableId);
    if (table !== undefined) {
      table.release(customer.customerId);
    }
    const ratio = customer.getPatienceRatio();
    const tipRate = ratio >= 0.78 ? 0.3 : ratio >= 0.48 ? 0.1 : 0;
    const ratingGain = ratio >= 0.78 ? 0.17 : ratio >= 0.35 ? 0.12 : 0.07;
    const image = this.add
      .image(table?.seatPosition.x ?? customer.x, (table?.seatPosition.y ?? customer.y) + 4, "coin")
      .setDepth(520);
    this.tweens.add({
      targets: image,
      y: image.y - 3,
      duration: 430,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.pendingPayments.push({
      image,
      menuItemId: customer.orderId ?? "fishcake",
      quantity: customer.orderQuantity,
      tipRate,
      ratingGain,
      ageMs: 0,
    });
    if (ratio >= 0.48) {
      customer.showHeart();
    }
    customer.setTarget(-22, 238);
    customer.setCustomerState(CustomerState.LEAVING);
  }

  private updatePayments(deltaMs: number): void {
    for (let index = this.pendingPayments.length - 1; index >= 0; index -= 1) {
      const payment = this.pendingPayments[index];
      if (payment === undefined) {
        continue;
      }
      payment.ageMs += deltaMs;
      const playerReached = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        payment.image.x,
        payment.image.y,
      ) <= 16;
      const autoCollect = this.currentEffects.serverHired && payment.ageMs >= 650;
      if (playerReached || autoCollect) {
        this.collectPayment(payment, index);
      }
    }
  }

  private collectPayment(payment: PendingPayment, index: number): void {
    const price = getMenuItem(payment.menuItemId).price * payment.quantity;
    const result = this.economy.recordSale(price, payment.tipRate, payment.ratingGain);
    const x = payment.image.x;
    const y = payment.image.y;
    this.tweens.killTweensOf(payment.image);
    payment.image.destroy();
    this.pendingPayments.splice(index, 1);
    this.sfx.coin();
    this.hud.flashMoney(true);
    this.showMoneyPopup(x, y, result.totalAmount, result.tipAmount);
    this.saveProgress();
    if (this.upgrades.isGameComplete()) {
      this.beginClearSequence();
    }
  }

  private showMoneyPopup(x: number, y: number, amount: number, tip: number): void {
    const popup = this.add
      .text(x, y - 7, `+${amount}냥${tip > 0 ? " ♥" : ""}`, {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "9px",
        color: tip > 0 ? "#ffe38a" : "#ffd16d",
        stroke: "#302033",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(890);
    this.tweens.add({
      targets: popup,
      y: popup.y - 18,
      alpha: 0,
      duration: 920,
      ease: "Sine.Out",
      onComplete: () => popup.destroy(),
    });
  }

  private updateInteractionIndicator(): void {
    const interaction = this.findInteraction();
    this.currentInteraction = interaction;
    if (interaction === undefined) {
      this.interactionMarker.setVisible(false);
      this.interactionText.setVisible(false);
      return;
    }
    this.interactionMarker.setPosition(interaction.x, interaction.y - 26).setVisible(true);
    this.interactionText
      .setPosition(interaction.x, interaction.y - 38)
      .setText(`SPACE · ${interaction.label}`)
      .setVisible(true);
  }

  private findInteraction(): InteractionTarget | undefined {
    const carriedFood = this.player.getCarriedFood();
    if (carriedFood !== undefined) {
      const customer = this.findNearestCustomer(
        (candidate) =>
          candidate.customerState === CustomerState.WAITING_FOR_FOOD &&
          candidate.orderId === carriedFood &&
          candidate.customerId !== this.serverTargetCustomerId,
        34,
      );
      if (customer !== undefined) {
        return {
          x: customer.x,
          y: customer.y,
          label: "서빙하기",
          action: () => this.serveCustomer(customer, false),
        };
      }
      return undefined;
    }

    const orderingCustomer = this.findNearestCustomer(
      (customer) => customer.customerState === CustomerState.ORDERING,
      34,
    );
    if (orderingCustomer !== undefined) {
      return {
        x: orderingCustomer.x,
        y: orderingCustomer.y,
        label: "주문받기",
        action: () => this.acceptOrder(orderingCustomer, false),
      };
    }

    let nearestStation: CookingStation | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const station of this.stations.values()) {
      if (station.getReadyCount() === 0) {
        continue;
      }
      const distance = station.distanceTo(this.player.x, this.player.y);
      if (distance <= 39 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestStation = station;
      }
    }
    if (nearestStation !== undefined) {
      return {
        x: nearestStation.x,
        y: nearestStation.y,
        label: "음식 들기",
        action: () => this.pickUpFood(nearestStation),
      };
    }
    return undefined;
  }

  private findNearestCustomer(
    predicate: (customer: Customer) => boolean,
    maximumDistance: number,
  ): Customer | undefined {
    let nearest: Customer | undefined;
    let nearestDistance = maximumDistance;
    for (const customer of this.customers.values()) {
      if (!predicate(customer)) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, customer.x, customer.y);
      if (distance <= nearestDistance) {
        nearest = customer;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private pickUpFood(station: CookingStation): void {
    const ticket = station.takeReadyTicket();
    if (ticket === undefined) {
      return;
    }
    this.player.setCarriedFood(ticket.menuItemId);
    this.hud.setHeldFood(ticket.menuItemId);
    this.sfx.click();
    this.toast.show(`${getMenuItem(ticket.menuItemId).name}을 들었어요`);
    setStatus(`${getMenuItem(ticket.menuItemId).name}을 들었습니다. 주문한 손님에게 가져다주세요.`);
  }

  private handleSpace(): void {
    if (this.tutorialOverlay !== undefined) {
      this.advanceTutorial();
      return;
    }
    if (this.isPaused || this.clearing) {
      return;
    }
    const interaction = this.findInteraction();
    if (interaction !== undefined) {
      interaction.action();
      this.currentInteraction = undefined;
    }
  }

  private applyEffects(effects: UpgradeEffects, celebrate: boolean): void {
    this.createTables(effects.seatCount);
    for (const [menuItemId, station] of this.stations) {
      station.setUnlocked(effects.unlockedMenuIds.includes(menuItemId));
      station.setSpeedMultiplier(effects.cookingTimeMultiplier);
    }
    this.chefSprite?.setVisible(effects.chefHired);
    this.serverSprite?.setVisible(effects.serverHired);
    if (effects.finalFacilityPurchased) {
      this.decor.setSign("moon");
    } else if (this.upgrades?.isPurchased("neon-sign")) {
      this.decor.setSign("neon");
    } else {
      this.decor.setSign("stall");
    }
    if (celebrate) {
      this.decor.celebrate();
    }
  }

  private purchaseNextUpgrade(): void {
    if (this.isPaused || this.tutorialOverlay !== undefined || this.clearing) {
      return;
    }
    const next = this.upgrades.getNextUpgrade();
    if (next === undefined) {
      return;
    }
    const result = this.upgrades.purchase(next.upgrade.id);
    if (!result.success) {
      this.sfx.click();
      this.upgradePanel.pulseFailure();
      this.toast.show("조금만 더 모아볼까요?", "warning");
      return;
    }
    this.sfx.upgrade();
    this.upgradePanel.pulseSuccess();
    this.hud.flashMoney(false);
    this.toast.show(`${result.upgrade.name} 완성!`, "success");
    setStatus(`${result.upgrade.name} 업그레이드를 구매했습니다.`);
    this.saveProgress();
    if (result.effects.finalFacilityPurchased && !this.upgrades.isGameComplete()) {
      this.toast.show("평점 5점을 채우면 달빛 간판이 빛나요!", "warning");
    }
    if (this.upgrades.isGameComplete()) {
      this.beginClearSequence();
    }
  }

  private refreshUi(animateMoney = true): void {
    if (this.hud === undefined || this.upgradePanel === undefined) {
      return;
    }
    const state = this.economy.getState();
    this.hud.setMoney(state.money, animateMoney);
    this.hud.setRating(state.rating);
    this.hud.setCustomerCount(state.customerCount);
    this.upgradePanel.setUpgrade(
      this.upgrades.getNextUpgrade(),
      this.upgrades.getPurchasedUpgradeIds().length,
    );
  }

  private togglePause(): void {
    if (this.tutorialOverlay !== undefined || this.clearing) {
      return;
    }
    if (this.isPaused) {
      this.closePauseOverlay();
    } else {
      this.openPauseOverlay();
    }
  }

  private openPauseOverlay(): void {
    this.isPaused = true;
    this.player.setFrozen(true);
    this.interactionMarker.setVisible(false);
    this.interactionText.setVisible(false);
    const shade = this.add.rectangle(240, 135, 480, 270, 0x090c1b, 0.8);
    const panel = this.add.rectangle(240, 138, 254, 174, 0x171d35, 1).setStrokeStyle(2, 0xd07a49);
    const title = this.add
      .text(240, 73, "잠시 쉬어갈까요?", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "16px",
        color: "#ffe4a7",
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(240, 94, "진행 상황은 자동으로 저장돼요", {
        fontFamily: UI_FONT,
        fontSize: "8px",
        color: "#a7b2d1",
      })
      .setOrigin(0.5);
    const resume = new PixelButton(this, 240, 122, "계속 영업", () => this.closePauseOverlay(), {
      width: 126,
      height: 27,
      primary: true,
      fontSize: 9,
    });
    const mute = new PixelButton(
      this,
      240,
      155,
      this.sfx.isMuted ? "소리 켜기 (M)" : "소리 끄기 (M)",
      () => {
        this.toggleMute();
        mute.setText(this.sfx.isMuted ? "소리 켜기 (M)" : "소리 끄기 (M)");
      },
      { width: 126, height: 24, primary: false, fontSize: 8 },
    );
    const titleButton = new PixelButton(this, 240, 188, "타이틀로", () => {
      this.saveProgress();
      this.scene.start("MenuScene");
    }, { width: 90, height: 22, primary: false, fontSize: 8 });
    this.pauseOverlay = this.add
      .container(0, 0, [shade, panel, title, subtitle, resume, mute, titleButton])
      .setDepth(3_000);
    setStatus("게임이 일시정지되었습니다.");
  }

  private closePauseOverlay(): void {
    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = undefined;
    this.isPaused = false;
    this.player.setFrozen(false);
    setStatus("영업을 계속합니다.");
  }

  private toggleMute(): void {
    const muted = this.sfx.toggleMute();
    this.toast.show(muted ? "소리를 껐어요" : "소리를 켰어요");
    this.saveProgress();
  }

  private showTutorial(): void {
    this.player.setFrozen(true);
    this.tutorialStep = 0;
    const shade = this.add.rectangle(240, 135, 480, 270, 0x090c1b, 0.79);
    const panel = this.add.rectangle(240, 142, 316, 176, 0x171e37, 1).setStrokeStyle(2, 0xd47a48);
    const icon = this.add.image(240, 78, "player-down-0").setScale(1.35);
    const stepLabel = this.add
      .text(240, 104, "첫 번째 밤 · 1/3", {
        fontFamily: UI_FONT,
        fontSize: "8px",
        color: "#f1a662",
      })
      .setOrigin(0.5)
      .setName("tutorial-step");
    const title = this.add
      .text(240, 123, "사장님, 움직여볼까요?", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "14px",
        color: "#ffe6aa",
      })
      .setOrigin(0.5)
      .setName("tutorial-title");
    const body = this.add
      .text(240, 151, "WASD 또는 방향키로 이동하고\n가까이에서 SPACE로 상호작용해요.", {
        fontFamily: UI_FONT,
        fontSize: "9px",
        align: "center",
        lineSpacing: 4,
        color: "#c5cee5",
      })
      .setOrigin(0.5)
      .setName("tutorial-body");
    const next = new PixelButton(this, 240, 200, "다음", () => this.advanceTutorial(), {
      width: 100,
      height: 26,
      primary: true,
      fontSize: 9,
    }).setName("tutorial-next");
    const hint = this.add
      .text(240, 227, "SPACE로도 넘길 수 있어요", {
        fontFamily: UI_FONT,
        fontSize: "7px",
        color: "#76819f",
      })
      .setOrigin(0.5);
    this.tutorialOverlay = this.add
      .container(0, 0, [shade, panel, icon, stepLabel, title, body, next, hint])
      .setDepth(3_100);
    setStatus("튜토리얼 1단계. 방향키로 이동하고 스페이스바로 상호작용합니다.");
  }

  private advanceTutorial(): void {
    const overlay = this.tutorialOverlay;
    if (overlay === undefined) {
      return;
    }
    this.sfx.click();
    this.tutorialStep += 1;
    if (this.tutorialStep >= 3) {
      overlay.destroy(true);
      this.tutorialOverlay = undefined;
      this.tutorialCompleted = true;
      this.player.setFrozen(false);
      this.saveProgress();
      this.toast.show("첫 영업을 시작해요!", "success");
      this.time.delayedCall(280, () => this.spawnCustomer());
      setStatus("튜토리얼 완료. 첫 손님이 곧 도착합니다.");
      return;
    }
    const titles = ["", "주문부터 계산까지", "포차를 키워보세요!"];
    const bodies = [
      "",
      "주문받기 → 조리대에서 음식 들기 → 서빙하기\n손님이 남긴 동전은 가까이 가면 수거돼요.",
      "오른쪽에서 시설을 순서대로 구매하세요.\n메뉴판 가격에 밤손님 보너스 ×3가 정산돼요!",
    ];
    const icons = ["player-down-0", "food-fishcake", "sign-moon"];
    const title = overlay.getByName("tutorial-title") as Phaser.GameObjects.Text | null;
    const body = overlay.getByName("tutorial-body") as Phaser.GameObjects.Text | null;
    const step = overlay.getByName("tutorial-step") as Phaser.GameObjects.Text | null;
    const next = overlay.getByName("tutorial-next") as PixelButton | null;
    const icon = overlay.list[2] as Phaser.GameObjects.Image | undefined;
    title?.setText(titles[this.tutorialStep] ?? "");
    body?.setText(bodies[this.tutorialStep] ?? "");
    step?.setText(`첫 번째 밤 · ${this.tutorialStep + 1}/3`);
    next?.setText(this.tutorialStep === 2 ? "영업 시작" : "다음");
    icon?.setTexture(icons[this.tutorialStep] ?? "player-down-0");
    setStatus(`튜토리얼 ${this.tutorialStep + 1}단계.`);
  }

  private beginClearSequence(): void {
    if (this.clearing) {
      return;
    }
    this.clearing = true;
    this.player.setFrozen(true);
    this.decor.setSign("moon");
    this.decor.celebrate();
    this.sfx.clear();
    this.saveProgress(true);
    this.cameras.main.flash(420, 255, 221, 131, false);
    const banner = this.add
      .text(175, 125, "달빛 간판이 켜졌어요!\n냥포차 완성!", {
        fontFamily: UI_FONT,
        fontStyle: "bold",
        fontSize: "18px",
        align: "center",
        color: "#fff0aa",
        backgroundColor: "#351e32ed",
        padding: { x: 18, y: 12 },
        stroke: "#7a3438",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(2_000)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.add({
      targets: banner,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 360,
      ease: "Back.Out",
    });
    const state = this.economy.getState();
    this.time.delayedCall(1_450, () => {
      this.scene.start("ResultScene", {
        money: state.money,
        customerCount: state.customerCount,
        rating: state.rating,
        elapsedMs: this.elapsedMs,
      });
    });
  }

  private saveProgress(cleared = this.clearing): void {
    if (this.saveSystem === undefined || this.economy === undefined || this.upgrades === undefined) {
      return;
    }
    const state = this.economy.getState();
    this.currentSave = this.saveSystem.save({
      money: state.money,
      purchasedUpgradeIds: this.upgrades.getPurchasedUpgradeIds(),
      customerCount: state.customerCount,
      rating: state.rating,
      settings: { ...this.currentSave.settings, muted: this.sfx.isMuted },
      muted: this.sfx.isMuted,
      tutorialCompleted: this.tutorialCompleted,
      playStartedAt: this.currentSave.playStartedAt,
      elapsedMs: this.elapsedMs,
      cleared,
    });
  }

  private pulseWorker(worker: Phaser.GameObjects.Image | undefined): void {
    if (worker === undefined) {
      return;
    }
    this.tweens.add({ targets: worker, scaleX: 1.15, scaleY: 1.15, duration: 100, yoyo: true });
  }

  private configureDebugApi(): void {
    if (!new URLSearchParams(window.location.search).has("debug")) {
      return;
    }
    window.__MEOW_DINER__ = {
      getState: () => ({
        economy: this.economy.getState(),
        effects: this.upgrades.getEffects(),
        purchasedUpgradeIds: this.upgrades.getPurchasedUpgradeIds(),
        activeCustomers: this.customers.size,
        pendingPayments: this.pendingPayments.length,
        player: {
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          carrying: this.player.getCarriedFood(),
        },
        customers: [...this.customers.values()].map((customer) => ({
          id: customer.customerId,
          state: customer.customerState,
          x: Math.round(customer.x),
          y: Math.round(customer.y),
          orderId: customer.orderId,
        })),
      }),
      grantMoney: (amount = 10_000) => this.economy.addMoney(Math.max(0, Math.round(amount))),
      setRating: (rating = 5) => this.economy.setRating(rating),
      purchaseNext: () => {
        const next = this.upgrades.getNextUpgrade();
        if (next === undefined) {
          return false;
        }
        const result = this.upgrades.purchase(next.upgrade.id);
        this.saveProgress();
        if (this.upgrades.isGameComplete()) {
          this.beginClearSequence();
        }
        return result.success;
      },
      skipTutorial: () => {
        while (this.tutorialOverlay !== undefined) {
          this.advanceTutorial();
        }
      },
      setPlayerPosition: (x, y) => {
        this.player.setPosition(
          Phaser.Math.Clamp(x, 15, 337),
          Phaser.Math.Clamp(y, 52, 255),
        );
      },
      interact: () => this.handleSpace(),
    };
    this.add
      .text(345, 265, "DEBUG", {
        fontFamily: "monospace",
        fontSize: "6px",
        color: "#e87777",
      })
      .setOrigin(1)
      .setDepth(950);
  }

  private handleShutdown(): void {
    this.saveProgress(this.clearing || this.upgrades.isGameComplete());
    this.removeEconomyListener?.();
    this.removeUpgradeListener?.();
    this.game.events.off("app-before-unload", this.saveProgress, this);
    const keyboard = this.input.keyboard;
    keyboard?.off("keydown-SPACE", this.handleSpace, this);
    keyboard?.off("keydown-ESC", this.togglePause, this);
    keyboard?.off("keydown-M", this.toggleMute, this);
    this.sfx.dispose();
    window.__MEOW_DINER__ = undefined;
  }
}

function setStatus(message: string): void {
  const element = document.querySelector<HTMLElement>("#status-message");
  if (element !== null) {
    element.textContent = message;
  }
}
