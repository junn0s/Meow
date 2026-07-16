import Phaser from "phaser";
import { createGameBackdrop, type DinerDecor, UI_FONT } from "../art/SceneDecor";
import { AtmosphereSystem, type ServiceLightMode } from "../art/AtmosphereSystem";
import { SoundManager } from "../audio/SoundManager";
import { CookingStation, type CookingTicket } from "../entities/CookingStation";
import { Customer } from "../entities/Customer";
import { Player } from "../entities/Player";
import { DiningTable } from "../entities/Table";
import { getCustomerData, pickCustomerData } from "../data/customerData";
import { getMenuItem } from "../data/menuData";
import { getStageConfig, WORKER_HIRE_CONFIGS } from "../data/progressionData";
import { formatCompactNumber } from "../economy/economyMath";
import { EconomySystem } from "../systems/EconomySystem";
import { DayNightController } from "../systems/DayNightController";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import { calculateOfflineReward } from "../systems/OfflineEarningsSystem";
import { SaveSystem } from "../systems/SaveSystem";
import {
  canReceiveFood,
  canSpawnCustomer,
  CUSTOMER_ARRIVAL_INTERVAL_MULTIPLIER,
  selectFoodRecipient,
} from "../systems/ServiceFlowRules";
import {
  CustomerState,
  type GrowthStage,
  type MenuItemId,
  type ProgressionEffects,
  type SaveData,
  type VisualPhase,
  type WorkerRole,
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
  readonly vipMultiplier: number;
  readonly comboMultiplier: number;
  ageMs: number;
}

interface InteractionTarget {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly action: () => void;
}

interface WorkerAgent {
  readonly id: string;
  readonly role: WorkerRole;
  readonly ordinal: number;
  readonly sprite: Phaser.GameObjects.Image;
  readonly homeX: number;
  readonly homeY: number;
  busy: boolean;
  assignedCustomerId?: string;
  assignedStationId?: MenuItemId;
}

interface OfflineRewardSummary {
  readonly elapsedMs: number;
  readonly amount: number;
  readonly capped: boolean;
}

const TABLE_POSITIONS = [
  { x: 35, y: 142 }, { x: 105, y: 142 }, { x: 175, y: 142 }, { x: 245, y: 142 }, { x: 315, y: 142 },
  { x: 35, y: 187 }, { x: 105, y: 187 }, { x: 175, y: 187 }, { x: 245, y: 187 }, { x: 315, y: 187 },
  { x: 70, y: 232 }, { x: 140, y: 232 }, { x: 210, y: 232 }, { x: 280, y: 232 },
] as const;

const AUTO_ORDER_DELAY_MS = 720;
const SAVE_INTERVAL_MS = 4_000;

export class GameScene extends Phaser.Scene {
  private saveSystem!: SaveSystem;
  private economy!: EconomySystem;
  private dayNight!: DayNightController;
  private progression!: ProgressionSystem;
  private currentSave!: SaveData;
  private currentEffects!: ProgressionEffects;
  private sfx!: SoundManager;
  private decor!: DinerDecor;
  private atmosphere!: AtmosphereSystem;
  private player!: Player;
  private hud!: HUD;
  private upgradePanel!: UpgradePanel;
  private toast!: ToastManager;
  private readonly customers = new Map<string, Customer>();
  private readonly tables: DiningTable[] = [];
  private readonly stations = new Map<MenuItemId, CookingStation>();
  private readonly pendingPayments: PendingPayment[] = [];
  private readonly chefs: WorkerAgent[] = [];
  private readonly servers: WorkerAgent[] = [];
  private readonly chefAssignedCustomers = new Set<string>();
  private readonly serverTargetCustomerIds = new Set<string>();
  private spawnCountdownMs = 850;
  private saveCountdownMs = SAVE_INTERVAL_MS;
  private elapsedMs = 0;
  private currentVisualPhase: VisualPhase = "day";
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
  private comboCount = 0;
  private consecutiveWalkouts = 0;
  private safetySlowdownRemainingMs = 0;
  private rushCountdownMs = 0;
  private rushRemainingMs = 0;
  private rushWarningShown = false;
  private configuredRushStage = 0;
  private promotionMenuId?: MenuItemId;
  private promotionRemainingMs = 0;
  private promotionCountdownMs = 45_000;
  private promotionSerial = 0;
  private offlineReward?: OfflineRewardSummary;
  private reducedMotion = false;
  private readonly frameSamples: number[] = [];
  private ticketStats = { accepted: 0, completed: 0, served: 0, cancelled: 0, wasted: 0, duplicateServices: 0 };
  private removeEconomyListener?: () => void;
  private removeProgressionListener?: () => void;

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
    this.progression = new ProgressionSystem(this.economy, this.currentSave.progression);
    const debugStage = readDebugStage(window.location.search);
    if (debugStage !== undefined) {
      this.progression.debugGrantThroughStage(debugStage);
    }
    this.currentEffects = this.progression.getEffects();
    this.reducedMotion = this.currentSave.settings.reducedMotion
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    this.applyOfflineReward(previousSave, data.newGame === true);
    this.tutorialCompleted = this.currentSave.tutorialCompleted;
    this.elapsedMs = this.currentSave.elapsedMs;
    this.sfx = new SoundManager(this.currentSave.muted);
    this.dayNight = new DayNightController(
      this.currentSave.worldClockMs,
      this.currentSave.visualTier,
    );
    this.decor = createGameBackdrop(this);
    this.atmosphere = new AtmosphereSystem(this, this.reducedMotion);
    const initialVisualState = this.dayNight.getState();
    this.currentVisualPhase = initialVisualState.phase;
    this.decor.setVisualTier(initialVisualState.visualTier);
    this.decor.setPhase(initialVisualState.phase, true);
    this.decor.setReducedMotion(this.reducedMotion);
    this.atmosphere.setVisualTier(initialVisualState.visualTier);
    this.atmosphere.setPhase(initialVisualState.phase, true);
    this.atmosphere.setWorkerCounts(this.currentEffects.chefCount, this.currentEffects.serverCount);
    this.sfx.setAmbience(initialVisualState.phase, this.reducedMotion);
    const progressionState = this.progression.getState();
    this.decor.setProgression(
      progressionState.currentStage,
      progressionState.purchasedStepCount,
    );

    this.createStations();
    this.createTables(this.currentEffects.seatCount);
    this.player = new Player(this, 176, 128);
    this.createWorkers();
    this.applyEffects(this.currentEffects, false);
    this.hud = new HUD(this);
    this.hud.setWorldTime(initialVisualState);
    this.upgradePanel = new UpgradePanel(this);
    this.toast = new ToastManager(this);
    this.createInteractionIndicator();
    this.createInputHandlers();
    this.createSubscriptions();
    this.refreshUi(false);
    this.configureDebugApi();

    if (this.offlineReward !== undefined && this.offlineReward.amount > 0) {
      this.toast.show(
        `쉬는 동안 +${formatCompactNumber(this.offlineReward.amount)}냥`,
        "success",
      );
      this.saveProgress();
    }

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
    this.frameSamples.push(stepMs);
    if (this.frameSamples.length > 120) this.frameSamples.shift();
    this.hud.update(stepMs);
    if (this.isPaused || this.tutorialOverlay !== undefined || this.clearing) {
      return;
    }

    this.elapsedMs += stepMs;
    this.hud.setElapsedTime(this.elapsedMs);
    const visualState = this.dayNight.update(stepMs);
    if (visualState.phase !== this.currentVisualPhase) {
      this.currentVisualPhase = visualState.phase;
      this.decor.setPhase(visualState.phase);
      this.atmosphere.setPhase(visualState.phase);
      this.sfx.setAmbience(visualState.phase, this.reducedMotion);
      for (const customer of this.customers.values()) {
        customer.setNightMode(visualState.phase === "night");
      }
    }
    this.hud.setWorldTime(visualState);
    this.atmosphere.update(stepMs);
    this.player.update(stepMs);
    this.updateCustomers(stepMs);
    this.updateStations(stepMs);
    this.updateWorkers(stepMs);
    this.updateRush(stepMs);
    this.updateFeverAndPromotion(stepMs);
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
    this.chefs.length = 0;
    this.servers.length = 0;
    this.chefAssignedCustomers.clear();
    this.serverTargetCustomerIds.clear();
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
    this.comboCount = 0;
    this.consecutiveWalkouts = 0;
    this.safetySlowdownRemainingMs = 0;
    this.rushCountdownMs = 0;
    this.rushRemainingMs = 0;
    this.rushWarningShown = false;
    this.configuredRushStage = 0;
    this.promotionMenuId = undefined;
    this.promotionRemainingMs = 0;
    this.promotionCountdownMs = 45_000;
    this.promotionSerial = 0;
    this.offlineReward = undefined;
    this.frameSamples.length = 0;
    this.ticketStats = { accepted: 0, completed: 0, served: 0, cancelled: 0, wasted: 0, duplicateServices: 0 };
  }

  private createStations(): void {
    const stationDefinitions = [
      { menuItemId: "fishcake", x: 32 },
      { menuItemId: "tteokbokki", x: 89 },
      { menuItemId: "fish-bread", x: 146 },
      { menuItemId: "ramen", x: 203 },
      { menuItemId: "moon-skewer", x: 260 },
      { menuItemId: "moonlight-set", x: 317 },
    ] as const;
    for (const definition of stationDefinitions) {
      const station = new CookingStation(this, definition.menuItemId, definition.x, 84);
      station.setReadyCallback((_readyStation, ticket) => {
        this.ticketStats.completed += 1;
        if (ticket.chefWorkerId !== undefined) this.releaseChef(ticket.chefWorkerId);
        this.sfx.ready();
        setStatus(`${getMenuItem(definition.menuItemId).name} 조리가 완료됐습니다.`);
      });
      station.setCookingTimeResolver((quantity) =>
        this.progression.getMenuCookingTimeMs(definition.menuItemId, quantity));
      station.setCanStartNextResolver(() => {
        const activeCount = [...this.stations.values()].filter(
          (candidate) => candidate.getActiveTicket() !== undefined,
        ).length;
        return activeCount < Math.max(1, this.currentEffects.chefCount);
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
    for (let ordinal = 1; ordinal <= 4; ordinal += 1) {
      const chefX = 15 + ordinal * 20;
      const chefY = 96;
      this.chefs.push({
        id: `chef-${ordinal}`,
        role: "chef",
        ordinal,
        sprite: this.add
          .image(chefX, chefY, `chef-${ordinal}-0`)
          .setDepth(116)
          .setVisible(false),
        homeX: chefX,
        homeY: chefY,
        busy: false,
      });
      const serverX = 335;
      const serverY = 105 + ordinal * 29;
      this.servers.push({
        id: `server-${ordinal}`,
        role: "server",
        ordinal,
        sprite: this.add
          .image(serverX, serverY, `server-${ordinal}-0`)
          .setDepth(150 + serverY)
          .setVisible(false),
        homeX: serverX,
        homeY: serverY,
        busy: false,
      });
    }
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
    this.removeProgressionListener = this.progression.subscribe((state, effects) => {
      this.currentEffects = effects;
      this.applyEffects(effects, false);
      const visualState = this.dayNight.setVisualTier(this.progression.getVisualTier());
      this.decor.setVisualTier(visualState.visualTier);
      this.atmosphere.setVisualTier(visualState.visualTier);
      this.decor.setProgression(state.currentStage, state.purchasedStepCount);
      this.configureRushForStage(state.currentStage);
      this.refreshUi();
    });
    this.upgradePanel.onPurchase(() => this.purchaseNextProgression());
  }

  private updateSpawner(deltaMs: number): void {
    this.spawnCountdownMs -= deltaMs;
    if (this.spawnCountdownMs > 0) {
      return;
    }

    if (canSpawnCustomer(this.customers.values(), this.currentEffects.seatCount)) {
      this.spawnCustomer();
      return;
    }
    this.scheduleNextSpawn();
  }

  private spawnCustomer(forcedVip?: boolean): void {
    if (this.clearing) {
      return;
    }
    const data = pickCustomerData(Math.random());
    const stageConfig = getStageConfig(this.progression.getCurrentStage());
    const kindPatienceMultiplier = data.id === "rabbit"
      ? 0.8
      : data.id === "hamster"
        ? 0.95
        : data.id === "dog"
          ? 1.1
          : 1.2;
    const vipChance = !this.currentEffects.vipUnlocked
      ? 0
      : this.progression.getCurrentStage() >= 30
        ? 0.12
        : this.progression.getCurrentStage() >= 26
          ? 0.08
          : 0.05;
    const vip = forcedVip ?? Math.random() < vipChance;
    this.customerSerial += 1;
    const customer = new Customer(
      this,
      `guest-${Date.now()}-${this.customerSerial}`,
      data.id,
      -16,
      231,
      {
        patienceMs: Math.round(
          stageConfig.basePatienceMs * kindPatienceMultiplier * (vip ? 1.25 : 1),
        ),
        vip,
        nightMode: this.currentVisualPhase === "night",
      },
    );
    const waitingIndex = [...this.customers.values()].filter(
      (other) =>
        other.customerState === CustomerState.ENTERING ||
        other.customerState === CustomerState.WAITING_FOR_SEAT,
    ).length;
    customer.setTarget(20 + (waitingIndex % 3) * 15, 230 - Math.floor(waitingIndex / 3) * 18);
    customer.setCustomerState(CustomerState.ENTERING);
    this.customers.set(customer.customerId, customer);
    this.scheduleNextSpawn();
    this.sfx.enter();
  }

  private scheduleNextSpawn(): void {
    const config = getStageConfig(this.progression.getCurrentStage());
    const jitter = Phaser.Math.FloatBetween(0.85, 1.15);
    const rushMultiplier = this.rushRemainingMs > 0
      ? getRushConfig(this.progression.getCurrentStage())?.spawnMultiplier ?? 1
      : 1;
    const safetyMultiplier = this.safetySlowdownRemainingMs > 0 ? 1.15 : 1;
    this.spawnCountdownMs = config.baseSpawnIntervalMs
      * CUSTOMER_ARRIVAL_INTERVAL_MULTIPLIER
      * jitter
      * rushMultiplier
      * safetyMultiplier;
  }

  private configureRushForStage(stage: GrowthStage): void {
    if (this.configuredRushStage === stage) {
      return;
    }
    this.configuredRushStage = stage;
    const config = getRushConfig(stage);
    this.rushRemainingMs = 0;
    this.rushCountdownMs = config?.periodMs ?? 0;
    this.rushWarningShown = false;
    this.hud?.setServiceEvent();
  }

  private updateRush(deltaMs: number): void {
    this.safetySlowdownRemainingMs = Math.max(
      0,
      this.safetySlowdownRemainingMs - deltaMs,
    );
    const config = getRushConfig(this.progression.getCurrentStage());
    if (config === undefined || !this.currentEffects.rushUnlocked) {
      this.hud.setServiceEvent();
      return;
    }
    if (this.rushRemainingMs > 0) {
      this.rushRemainingMs = Math.max(0, this.rushRemainingMs - deltaMs);
      this.hud.setServiceEvent(
        `RUSH ${Math.ceil(this.rushRemainingMs / 1_000)}초`,
        true,
      );
      if (this.rushRemainingMs === 0) {
        this.rushCountdownMs = Math.max(1_000, config.periodMs - config.durationMs);
        this.rushWarningShown = false;
        this.hud.setServiceEvent();
      }
      return;
    }
    this.rushCountdownMs = Math.max(0, this.rushCountdownMs - deltaMs);
    if (this.rushCountdownMs <= 10_000 && !this.rushWarningShown) {
      this.rushWarningShown = true;
      this.toast.show("⚠ 10초 뒤 손님 러시!", "warning");
    }
    if (this.rushCountdownMs <= 10_000) {
      this.hud.setServiceEvent(
        `⚠ ${Math.ceil(this.rushCountdownMs / 1_000)}초`,
        true,
      );
    }
    if (this.rushCountdownMs === 0) {
      this.rushRemainingMs = config.durationMs;
      this.hud.setServiceEvent("RUSH!", true);
      this.scheduleNextSpawn();
    }
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
          if (customer.patienceMs <= 0) {
            this.handleCustomerWalkout(customer);
            break;
          }
          break;
        case CustomerState.WAITING_FOR_FOOD:
          customer.tickPatience(deltaMs);
          if (customer.patienceMs <= 0) {
            this.handleCustomerWalkout(customer);
          }
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

  private handleCustomerWalkout(customer: Customer): void {
    const table = this.tables.find((candidate) => candidate.id === customer.assignedTableId);
    table?.release(customer.customerId);
    for (const station of this.stations.values()) {
      const cancelledTickets = station.cancelTicketsForCustomer(customer.customerId);
      this.ticketStats.cancelled += cancelledTickets.length;
      for (const ticket of cancelledTickets) {
        if (ticket.chefWorkerId !== undefined) this.releaseChef(ticket.chefWorkerId);
      }
    }
    for (const chef of this.chefs) {
      if (chef.assignedCustomerId === customer.customerId) this.releaseChef(chef.id);
    }
    const carriedFood = this.player.getCarriedFood();
    if (
      carriedFood !== undefined
      && carriedFood === customer.orderId
      && this.player.getCarriedQuantity() === customer.orderQuantity
    ) {
      const excludedCustomerIds = new Set(this.serverTargetCustomerIds);
      excludedCustomerIds.add(customer.customerId);
      const alternative = selectFoodRecipient(
        this.customers.values(),
        { menuItemId: carriedFood, quantity: this.player.getCarriedQuantity() },
        excludedCustomerIds,
        this.player,
      );
      if (alternative === undefined) {
        this.player.clearCarriedFood();
        this.hud.setHeldFood();
        this.ticketStats.cancelled += 1;
      } else if (this.player.getCarriedTicketCustomerId() === customer.customerId) {
        const station = this.stations.get(carriedFood);
        const cancelledTickets = station?.cancelTicketsForCustomer(alternative.customerId) ?? [];
        this.ticketStats.cancelled += cancelledTickets.length;
        for (const ticket of cancelledTickets) {
          if (ticket.chefWorkerId !== undefined) this.releaseChef(ticket.chefWorkerId);
        }
        this.player.setCarriedFood(
          carriedFood,
          this.player.getCarriedQuantity(),
          alternative.customerId,
        );
      }
    }
    this.comboCount = 0;
    this.consecutiveWalkouts += 1;
    this.economy.recordServiceScore(0);
    if (this.consecutiveWalkouts >= 3) {
      this.consecutiveWalkouts = 0;
      this.safetySlowdownRemainingMs = 30_000;
      this.toast.show("손님 간격을 30초간 조절합니다", "warning");
    } else {
      this.toast.show("기다리다 손님이 떠났어요", "warning");
    }
    customer.setTarget(-22, 238);
    customer.setCustomerState(CustomerState.LEAVING);
    customer.showWalkout();
    setStatus("손님의 인내심이 0이 되어 결제 없이 떠났습니다.");
    this.saveProgress();
  }

  private createCustomerOrder(customer: Customer): void {
    const menuItemId = this.pickMenuForCustomer(customer);
    const quantity = this.pickOrderQuantity(customer);
    customer.placeOrder(menuItemId, quantity);
    setStatus(`${getCustomerData(customer.kind).name} 손님이 ${getMenuItem(menuItemId).name}을 주문하려 합니다.`);
  }

  private pickMenuForCustomer(customer: Customer): MenuItemId {
    const weights = this.progression.getMenuOrderWeights();
    const preferred = getCustomerData(customer.kind).preferredMenuId;
    const weighted = [...weights.entries()].map(([menuItemId, weight]) => ({
      menuItemId,
      weight: weight
        * (menuItemId === preferred ? 1.8 : 1)
        * (menuItemId === this.promotionMenuId ? 2 : 1),
    }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = Math.random() * total;
    for (const entry of weighted) {
      cursor -= entry.weight;
      if (cursor <= 0) {
        return entry.menuItemId;
      }
    }
    return weighted[0]?.menuItemId ?? "fishcake";
  }

  private pickOrderQuantity(customer: Customer): number {
    const stage = this.progression.getCurrentStage();
    const band = Math.min(5, Math.floor((stage - 1) / 5));
    const probabilities = [
      [1, 0, 0],
      [0.95, 0.05, 0],
      [0.88, 0.12, 0],
      [0.78, 0.2, 0.02],
      [0.68, 0.26, 0.06],
      [0.55, 0.35, 0.1],
    ][band] ?? [1, 0, 0];
    const raccoonBoost = customer.kind === "raccoon" ? 0.1 : 0;
    const one = Math.max(0, (probabilities[0] ?? 1) - raccoonBoost);
    const two = Math.min(1, (probabilities[1] ?? 0) + raccoonBoost * 0.75);
    const roll = Math.random();
    if (roll < one) {
      return 1;
    }
    if (roll < one + two) {
      return 2;
    }
    return 3;
  }

  private acceptOrder(customer: Customer, automated: boolean, chefWorkerId?: string): boolean {
    if (customer.customerState !== CustomerState.ORDERING || customer.orderId === undefined) {
      return false;
    }
    const station = this.stations.get(customer.orderId);
    if (station === undefined || !station.isUnlocked()) {
      return false;
    }
    const ticket: CookingTicket = {
      customerId: customer.customerId,
      menuItemId: customer.orderId,
      quantity: customer.orderQuantity,
      chefWorkerId,
    };
    customer.acceptOrder();
    station.enqueue(ticket);
    this.ticketStats.accepted += 1;
    this.sfx.click();
    if (automated) {
      const chef = this.chefs.find((worker) => worker.id === chefWorkerId);
      if (chef !== undefined) {
        chef.assignedStationId = station.menuItemId;
        chef.assignedCustomerId = customer.customerId;
        this.tweens.add({
          targets: chef.sprite,
          x: station.x,
          y: station.y + 18,
          duration: 220,
          onUpdate: () => chef.sprite.setDepth(70 + Math.round(chef.sprite.y)),
        });
        this.pulseWorker(chef.sprite);
      }
    } else {
      this.toast.show(`${getMenuItem(customer.orderId).name} 주문 접수!`, "success");
    }
    setStatus(`${getMenuItem(customer.orderId).name} 주문이 접수되어 조리를 시작합니다.`);
    return true;
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
      for (const chef of this.chefs) {
        chef.sprite.setTexture(`chef-${chef.ordinal}-${this.workerAnimationFrame}`);
      }
      for (const server of this.servers) {
        const frame = server.busy ? this.workerAnimationFrame : 0;
        server.sprite.setTexture(`server-${server.ordinal}-${frame}`);
      }
    }
    this.dispatchChefOrders();
    this.dispatchServerDeliveries();
  }

  private dispatchChefOrders(): void {
    const ordering = [...this.customers.values()].filter(
      (customer) => customer.customerState === CustomerState.ORDERING
        && customer.stateElapsedMs >= AUTO_ORDER_DELAY_MS
        && !this.chefAssignedCustomers.has(customer.customerId),
    );
    for (const chef of this.chefs) {
      if (!chef.sprite.visible || chef.busy) continue;
      const customer = ordering.shift();
      if (customer === undefined) break;
      chef.busy = true;
      chef.assignedCustomerId = customer.customerId;
      this.chefAssignedCustomers.add(customer.customerId);
      const actionTime = getWorkerActionTimeMs("chef", chef.ordinal);
      this.tweens.add({
        targets: chef.sprite,
        x: customer.x - 15,
        y: customer.y,
        duration: Math.min(320, actionTime * 0.35),
        onUpdate: () => chef.sprite.setDepth(70 + Math.round(chef.sprite.y)),
      });
      this.time.delayedCall(actionTime, () => {
        this.chefAssignedCustomers.delete(customer.customerId);
        if (!chef.sprite.active || !this.acceptOrder(customer, true, chef.id)) {
          this.releaseChef(chef.id);
        }
      });
    }
  }

  private dispatchServerDeliveries(): void {
    for (const worker of this.servers) {
      if (!worker.sprite.visible || worker.busy) continue;
      let assigned = false;
      for (const station of this.stations.values()) {
        const ticket = station.peekReadyTicket();
        if (ticket === undefined) continue;
        const target = selectFoodRecipient(
          this.customers.values(),
          ticket,
          this.serverTargetCustomerIds,
          station,
        );
        if (target === undefined) continue;
        station.takeReadyTicket();
        this.startServerDelivery(worker, station, ticket, target);
        assigned = true;
        break;
      }
      if (!assigned) continue;
    }
  }

  private startServerDelivery(
    worker: WorkerAgent,
    station: CookingStation,
    ticket: CookingTicket,
    target: Customer,
  ): void {
    const server = worker.sprite;
    worker.busy = true;
    worker.assignedCustomerId = target.customerId;
    worker.assignedStationId = station.menuItemId;
    this.serverTargetCustomerIds.add(target.customerId);
    this.tweens.killTweensOf(server);
    server
      .setTexture(`server-${worker.ordinal}-1`)
      .setDepth(300)
      .setFlipX(station.x < server.x);
    const actionTime = getWorkerActionTimeMs("server", worker.ordinal);
    this.tweens.add({
      targets: server,
      x: station.x + 19,
      y: station.y + 20,
      duration: Math.round(actionTime * 0.2),
      ease: "Sine.InOut",
      onUpdate: () => server.setDepth(50 + Math.round(server.y)),
      onComplete: () => {
        if (!server.active || !canReceiveFood(target, ticket)) {
          if (ticket.customerId === target.customerId) {
            this.ticketStats.cancelled += 1;
          } else {
            station.returnReadyTicket(ticket);
          }
          this.releaseServer(worker);
          return;
        }
        server.setFlipX(target.x < server.x);
        this.tweens.add({
          targets: server,
          x: target.x + 17,
          y: target.y,
          duration: Math.round(actionTime * 0.45),
          ease: "Sine.InOut",
          onUpdate: () => server.setDepth(50 + Math.round(server.y)),
          onComplete: () => {
            if (target.active && canReceiveFood(target, ticket)) {
              this.serveCustomer(target, true, worker, ticket);
            } else {
              if (ticket.customerId === target.customerId) {
                this.ticketStats.cancelled += 1;
              } else {
                station.returnReadyTicket(ticket);
              }
            }
            this.serverTargetCustomerIds.delete(target.customerId);
            server.setFlipX(worker.homeX < server.x);
            this.tweens.add({
              targets: server,
              x: worker.homeX,
              y: worker.homeY,
              duration: Math.round(actionTime * 0.25),
              ease: "Sine.InOut",
              onUpdate: () => server.setDepth(50 + Math.round(server.y)),
              onComplete: () => this.releaseServer(worker, false),
            });
          },
        });
      },
    });
  }

  private serveCustomer(
    customer: Customer,
    automated: boolean,
    worker?: WorkerAgent,
    servedTicket?: CookingTicket,
  ): void {
    if (customer.customerState !== CustomerState.WAITING_FOR_FOOD) {
      this.ticketStats.duplicateServices += 1;
      return;
    }
    if (servedTicket !== undefined && servedTicket.customerId !== customer.customerId) {
      const station = this.stations.get(servedTicket.menuItemId);
      const ticketOwner = this.customers.get(servedTicket.customerId);
      if (ticketOwner !== undefined && canReceiveFood(ticketOwner, servedTicket)) {
        station?.reassignTicketCustomer(
          customer.customerId,
          servedTicket.customerId,
          servedTicket.quantity,
        );
      } else {
        const cancelledTickets = station?.cancelTicketsForCustomer(customer.customerId) ?? [];
        this.ticketStats.cancelled += cancelledTickets.length;
        for (const ticket of cancelledTickets) {
          if (ticket.chefWorkerId !== undefined) this.releaseChef(ticket.chefWorkerId);
        }
      }
    }
    customer.serve();
    this.ticketStats.served += 1;
    customer.showHeart();
    this.sfx.buy();
    if (automated) {
      this.pulseWorker(worker?.sprite);
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
    const data = getCustomerData(customer.kind);
    const tipChance = ratio >= 0.75
      ? Math.min(1, data.tipChance + 0.25)
      : ratio >= 0.45
        ? data.tipChance
        : 0;
    const tipRate = customer.isVip || Math.random() >= tipChance
      ? 0
      : ratio >= 0.75
        ? 0.2
        : 0.1;
    const serviceScore = ratio >= 0.75 ? 1 : ratio >= 0.45 ? 0.85 : 0.6;
    this.economy.recordServiceScore(serviceScore);
    this.consecutiveWalkouts = 0;
    this.comboCount += 1;
    const comboMultiplier = this.comboCount >= 20
      ? 1.15
      : this.comboCount >= 10
        ? 1.1
        : this.comboCount >= 5
          ? 1.05
          : 1;
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
      vipMultiplier: customer.isVip ? 2 : 1,
      comboMultiplier,
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
    const promotionMultiplier = payment.menuItemId === this.promotionMenuId ? 1.25 : 1;
    const feverMultiplier = this.progression.getFeverRevenueMultiplier() * promotionMultiplier;
    const result = this.economy.recordSale({
      unitPrice: this.progression.getMenuPrice(payment.menuItemId),
      quantity: payment.quantity,
      tipRate: payment.tipRate,
      vipMultiplier: payment.vipMultiplier,
      comboMultiplier: payment.comboMultiplier,
      feverMultiplier,
      ratingGain: 0,
    });
    const feverLevel = this.progression.getFeverState().level;
    const gaugePerSale = feverLevel === 1 ? 14 : feverLevel === 2 ? 12 : 10;
    const feverResult = this.progression.addFeverGauge(gaugePerSale * payment.quantity);
    if (feverResult.activated) {
      this.toast.show(`FEVER Lv.${feverResult.state.level} · 매출 폭발!`, "success");
      this.decor.celebrate();
      this.sfx.upgrade();
    }
    const x = payment.image.x;
    const y = payment.image.y;
    this.tweens.killTweensOf(payment.image);
    payment.image.destroy();
    this.pendingPayments.splice(index, 1);
    this.sfx.coin();
    this.hud.flashMoney(true);
    this.showMoneyPopup(x, y, result.totalAmount, result.tipAmount);
    this.saveProgress();
    if (this.progression.isGameComplete()) {
      this.beginClearSequence();
    }
  }

  private updateFeverAndPromotion(deltaMs: number): void {
    const feverTransition = this.progression.updateFever(deltaMs);
    const fever = this.progression.getFeverState();
    if (feverTransition.ended) this.toast.show("피버 종료 · 다시 게이지를 채워요");
    this.hud.setFever(fever.level, fever.gauge, fever.activeRemainingMs);

    if (this.promotionRemainingMs > 0) {
      this.promotionRemainingMs = Math.max(0, this.promotionRemainingMs - deltaMs);
      if (this.promotionRemainingMs === 0) {
        this.promotionMenuId = undefined;
        this.promotionCountdownMs = 75_000;
        this.hud.setPromotion();
      }
    } else {
      this.promotionCountdownMs = Math.max(0, this.promotionCountdownMs - deltaMs);
      if (this.promotionCountdownMs === 0) this.startMenuPromotion();
    }
    if (this.promotionMenuId !== undefined) {
      this.hud.setPromotion(
        `${getMenuItem(this.promotionMenuId).name} ${Math.ceil(this.promotionRemainingMs / 1_000)}s`,
      );
    }
    this.refreshServiceLightMode();
  }

  private startMenuPromotion(menuItemId?: MenuItemId): boolean {
    const unlocked = this.currentEffects.unlockedMenuIds;
    if (unlocked.length === 0) return false;
    const selected = menuItemId ?? unlocked[this.promotionSerial % unlocked.length];
    if (selected === undefined || !unlocked.includes(selected)) return false;
    this.promotionSerial += 1;
    this.promotionMenuId = selected;
    this.promotionRemainingMs = 30_000;
    this.promotionCountdownMs = 0;
    this.toast.show(`${getMenuItem(selected).name} 집중 홍보 · 주문 2배`, "success");
    return true;
  }

  private refreshServiceLightMode(): void {
    const mode: ServiceLightMode = this.rushRemainingMs > 0
      ? "rush"
      : this.progression.getFeverState().activeRemainingMs > 0
        ? "fever"
        : "normal";
    this.atmosphere.setServiceMode(mode);
  }

  private showMoneyPopup(x: number, y: number, amount: number, tip: number): void {
    const popup = this.add
      .text(x, y - 7, `+${formatCompactNumber(amount)}냥${tip > 0 ? " ♥" : ""}`, {
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
      const carriedQuantity = this.player.getCarriedQuantity();
      const customer = this.findNearestCustomer(
        (candidate) =>
          canReceiveFood(
            candidate,
            { menuItemId: carriedFood, quantity: carriedQuantity },
            this.serverTargetCustomerIds,
          ),
        34,
      );
      if (customer !== undefined) {
        const ticketCustomerId = this.player.getCarriedTicketCustomerId();
        return {
          x: customer.x,
          y: customer.y,
          label: "서빙하기",
          action: () => this.serveCustomer(
            customer,
            false,
            undefined,
            ticketCustomerId === undefined
              ? undefined
              : {
                  customerId: ticketCustomerId,
                  menuItemId: carriedFood,
                  quantity: carriedQuantity,
                },
          ),
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
    this.player.setCarriedFood(ticket.menuItemId, ticket.quantity, ticket.customerId);
    this.hud.setHeldFood(ticket.menuItemId);
    this.sfx.click();
    this.toast.show(`${getMenuItem(ticket.menuItemId).name}을 들었어요`);
    setStatus(`${getMenuItem(ticket.menuItemId).name} ×${ticket.quantity}을 들었습니다. 같은 주문을 기다리는 손님에게 가져다주세요.`);
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

  private applyEffects(effects: ProgressionEffects, celebrate: boolean): void {
    this.createTables(effects.seatCount);
    const progressionState = this.progression.getState();
    for (const [menuItemId, station] of this.stations) {
      station.setUnlocked(effects.unlockedMenuIds.includes(menuItemId));
      station.setSpeedMultiplier(1);
      const menuProgress = progressionState.menuProgress.find(
        (menu) => menu.menuItemId === menuItemId,
      );
      if (menuProgress !== undefined) {
        station.setProgressStats(
          `${formatCompactNumber(this.progression.getMenuPrice(menuItemId))}냥`,
          menuProgress.priceLevel,
          menuProgress.speedLevel,
        );
      }
    }
    this.chefs.forEach((worker, index) => worker.sprite.setVisible(index < effects.chefCount));
    this.servers.forEach((worker, index) => worker.sprite.setVisible(index < effects.serverCount));
    this.atmosphere?.setWorkerCounts(effects.chefCount, effects.serverCount);
    if (effects.finalFacilityPurchased) {
      this.decor.setSign("moon");
    } else if (this.progression.getVisualTier() >= 3) {
      this.decor.setSign("neon");
    } else {
      this.decor.setSign("stall");
    }
    if (celebrate) {
      this.decor.celebrate();
    }
  }

  private purchaseNextProgression(): void {
    if (this.isPaused || this.tutorialOverlay !== undefined || this.clearing) {
      return;
    }
    const result = this.progression.purchaseNext();
    if (!result.success) {
      this.sfx.click();
      this.upgradePanel.pulseFailure();
      this.toast.show("조금만 더 모아볼까요?", "warning");
      return;
    }
    this.sfx.upgrade();
    this.upgradePanel.pulseSuccess();
    this.hud.flashMoney(false);
    this.toast.show(`${result.purchase.name} 완성!`, "success");
    setStatus(`${result.purchase.name} 업그레이드를 구매했습니다.`);
    if (result.stageCompleted) {
      this.decor.celebrate();
    }
    this.saveProgress();
    if (result.effects.finalFacilityPurchased && !this.progression.isGameComplete()) {
      this.toast.show("최근 서비스 평점 4.5를 채우면 완성!", "warning");
    }
    if (this.progression.isGameComplete()) {
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
    const fever = this.progression.getFeverState();
    this.hud.setFever(fever.level, fever.gauge, fever.activeRemainingMs);
    this.hud.setPromotion(
      this.promotionMenuId === undefined ? undefined : getMenuItem(this.promotionMenuId).name,
    );
    this.upgradePanel.setProgression(
      this.progression.getNextPurchase(),
      this.progression.getState(),
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
    const motion = new PixelButton(
      this,
      240,
      184,
      this.reducedMotion ? "움직임 기본으로" : "움직임 줄이기",
      () => {
        this.setReducedMotion(!this.reducedMotion);
        motion.setText(this.reducedMotion ? "움직임 기본으로" : "움직임 줄이기");
      },
      { width: 126, height: 24, primary: false, fontSize: 8 },
    );
    const titleButton = new PixelButton(this, 240, 214, "타이틀로", () => {
      this.saveProgress();
      this.scene.start("MenuScene");
    }, { width: 90, height: 22, primary: false, fontSize: 8 });
    this.pauseOverlay = this.add
      .container(0, 0, [shade, panel, title, subtitle, resume, mute, motion, titleButton])
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

  private setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.decor.setReducedMotion(reducedMotion);
    this.atmosphere.setReducedMotion(reducedMotion);
    this.sfx.setAmbience(this.currentVisualPhase, reducedMotion);
    this.toast.show(reducedMotion ? "움직임을 줄였어요" : "기본 움직임을 켰어요");
    this.saveProgress();
  }

  private showTutorial(): void {
    this.player.setFrozen(true);
    this.tutorialStep = 0;
    const shade = this.add.rectangle(240, 135, 480, 270, 0x090c1b, 0.79);
    const panel = this.add.rectangle(240, 142, 316, 176, 0x171e37, 1).setStrokeStyle(2, 0xd47a48);
    const icon = this.add.image(240, 78, "player-down-0").setScale(1.35);
    const stepLabel = this.add
      .text(240, 104, "첫 번째 밤 · 1/4", {
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
    if (this.tutorialStep >= 4) {
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
    const titles = ["", "주문부터 계산까지", "포차를 키워보세요!", "직원과 피버를 활용해요"];
    const bodies = [
      "",
      "주문받기 → 조리대에서 음식 들기 → 서빙하기\n손님이 남긴 동전은 가까이 가면 수거돼요.",
      "오른쪽에서 단계별 확장을 구매하세요.\n표시 가격이 그대로 정산되고 포차가 성장해요!",
      "셰프와 서버는 각자 한 작업씩 맡아요.\nFEVER 게이지와 메뉴 홍보로 러시를 돌파하세요!",
    ];
    const icons = ["player-down-0", "food-fishcake", "sign-moon", "chef-1-0"];
    const title = overlay.getByName("tutorial-title") as Phaser.GameObjects.Text | null;
    const body = overlay.getByName("tutorial-body") as Phaser.GameObjects.Text | null;
    const step = overlay.getByName("tutorial-step") as Phaser.GameObjects.Text | null;
    const next = overlay.getByName("tutorial-next") as PixelButton | null;
    const icon = overlay.list[2] as Phaser.GameObjects.Image | undefined;
    title?.setText(titles[this.tutorialStep] ?? "");
    body?.setText(bodies[this.tutorialStep] ?? "");
    step?.setText(`첫 번째 밤 · ${this.tutorialStep + 1}/4`);
    next?.setText(this.tutorialStep === 3 ? "영업 시작" : "다음");
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
    this.cameras.main.flash(this.reducedMotion ? 120 : 420, 255, 221, 131, false);
    const partNames = ["틀", "달", "등불", "고양이", "점등"] as const;
    const partLights = partNames.map((name, index) => this.add
      .text(122 + index * 27, 91, `○\n${name}`, {
        fontFamily: UI_FONT,
        fontSize: "7px",
        align: "center",
        color: "#65708f",
      })
      .setOrigin(0.5)
      .setDepth(2_001));
    const partDelay = this.reducedMotion ? 60 : 180;
    partLights.forEach((part, index) => {
      this.time.delayedCall(index * partDelay, () => {
        part.setText(`●\n${partNames[index] ?? ""}`).setColor(index === 4 ? "#45ffd2" : "#ffe17d");
        this.sfx.click();
      });
    });
    const revealDelay = partDelay * partLights.length;
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
    this.time.delayedCall(revealDelay, () => {
      this.tweens.add({
        targets: banner,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: this.reducedMotion ? 120 : 360,
        ease: this.reducedMotion ? "Linear" : "Back.Out",
      });
    });
    const state = this.economy.getState();
    this.time.delayedCall(revealDelay + (this.reducedMotion ? 520 : 1_050), () => {
      this.scene.start("ResultScene", {
        money: state.money,
        customerCount: state.customerCount,
        rating: state.rating,
        elapsedMs: this.elapsedMs,
      });
    });
  }

  private saveProgress(cleared = this.clearing): void {
    if (this.saveSystem === undefined || this.economy === undefined || this.progression === undefined) {
      return;
    }
    const state = this.economy.getState();
    this.currentSave = this.saveSystem.save({
      money: state.money,
      purchasedUpgradeIds: this.currentSave.purchasedUpgradeIds,
      customerCount: state.customerCount,
      rating: state.rating,
      settings: {
        ...this.currentSave.settings,
        muted: this.sfx.isMuted,
        reducedMotion: this.reducedMotion,
      },
      muted: this.sfx.isMuted,
      tutorialCompleted: this.tutorialCompleted,
      playStartedAt: this.currentSave.playStartedAt,
      elapsedMs: this.elapsedMs,
      worldClockMs: this.dayNight.getState().worldClockMs,
      visualTier: this.dayNight.getState().visualTier,
      progression: this.progression.getState(),
      cleared,
    });
  }

  private applyOfflineReward(previousSave: SaveData | null, newGame: boolean): void {
    if (newGame || previousSave === null || previousSave.cleared) return;
    const elapsedMs = Math.max(0, Date.now() - previousSave.lastSavedAt);
    const effects = this.progression.getEffects();
    if (effects.chefCount === 0 || effects.serverCount === 0) return;
    const weights = this.progression.getMenuOrderWeights();
    let revenuePerSecond = 0;
    for (const [menuItemId, weight] of weights) {
      revenuePerSecond += weight
        * this.progression.getMenuPrice(menuItemId)
        / Math.max(1, this.progression.getMenuCookingTimeMs(menuItemId) / 1_000);
    }
    const automation = Math.min(1, effects.chefCount / Math.max(1, effects.unlockedMenuIds.length))
      * Math.min(1, effects.serverCount / 2);
    const nextCost = this.progression.getNextPurchase()?.purchase.cost;
    const reward = calculateOfflineReward({ elapsedMs, revenuePerSecond, automation, nextPurchaseCost: nextCost });
    if (reward.amount <= 0) return;
    this.economy.addMoney(reward.amount);
    this.offlineReward = reward;
  }

  private pulseWorker(worker: Phaser.GameObjects.Image | undefined): void {
    if (worker === undefined) {
      return;
    }
    this.tweens.add({ targets: worker, scaleX: 1.15, scaleY: 1.15, duration: 100, yoyo: true });
  }

  private releaseChef(workerId: string): void {
    const worker = this.chefs.find((candidate) => candidate.id === workerId);
    if (worker === undefined) return;
    if (worker.assignedCustomerId !== undefined) {
      this.chefAssignedCustomers.delete(worker.assignedCustomerId);
    }
    worker.busy = false;
    worker.assignedCustomerId = undefined;
    worker.assignedStationId = undefined;
    this.tweens.killTweensOf(worker.sprite);
    this.tweens.add({
      targets: worker.sprite,
      x: worker.homeX,
      y: worker.homeY,
      duration: 260,
      onComplete: () => worker.sprite.setDepth(116),
    });
  }

  private releaseServer(worker: WorkerAgent, returnHome = true): void {
    if (worker.assignedCustomerId !== undefined) {
      this.serverTargetCustomerIds.delete(worker.assignedCustomerId);
    }
    worker.busy = false;
    worker.assignedCustomerId = undefined;
    worker.assignedStationId = undefined;
    this.tweens.killTweensOf(worker.sprite);
    worker.sprite.setTexture(`server-${worker.ordinal}-0`);
    if (!returnHome) {
      worker.sprite
        .setPosition(worker.homeX, worker.homeY)
        .setFlipX(false)
        .setDepth(150 + worker.homeY);
      return;
    }
    worker.sprite.setFlipX(worker.homeX < worker.sprite.x);
    this.tweens.add({
      targets: worker.sprite,
      x: worker.homeX,
      y: worker.homeY,
      duration: 280,
      onComplete: () => worker.sprite
        .setFlipX(false)
        .setDepth(150 + worker.homeY),
    });
  }

  private configureDebugApi(): void {
    if (!new URLSearchParams(window.location.search).has("debug")) {
      return;
    }
    window.__MEOW_DINER__ = {
      getState: () => ({
        economy: this.economy.getState(),
        effects: this.progression.getEffects(),
        purchasedUpgradeIds: this.currentSave.purchasedUpgradeIds,
        progression: this.progression.getState(),
        activeCustomers: this.customers.size,
        pendingPayments: this.pendingPayments.length,
        visual: this.dayNight.getState(),
        service: {
          comboCount: this.comboCount,
          consecutiveWalkouts: this.consecutiveWalkouts,
          safetySlowdownRemainingMs: Math.round(this.safetySlowdownRemainingMs),
          rushCountdownMs: Math.round(this.rushCountdownMs),
          rushRemainingMs: Math.round(this.rushRemainingMs),
          fever: this.progression.getFeverState(),
          feverMultiplier: this.progression.getFeverRevenueMultiplier(),
          promotionMenuId: this.promotionMenuId,
          promotionRemainingMs: Math.round(this.promotionRemainingMs),
          tickets: { ...this.ticketStats },
        },
        workers: {
          chefs: this.chefs.filter((worker) => worker.sprite.visible).map((worker) => ({
            id: worker.id,
            ordinal: worker.ordinal,
            busy: worker.busy,
            customerId: worker.assignedCustomerId,
            stationId: worker.assignedStationId,
          })),
          servers: this.servers.filter((worker) => worker.sprite.visible).map((worker) => ({
            id: worker.id,
            ordinal: worker.ordinal,
            busy: worker.busy,
            customerId: worker.assignedCustomerId,
            stationId: worker.assignedStationId,
          })),
        },
        stations: [...this.stations.values()].map((station) => ({
          menuItemId: station.menuItemId,
          queued: station.getQueueCount(),
          ready: station.getReadyCount(),
          active: station.getActiveTicket() !== undefined,
        })),
        atmosphere: this.atmosphere.getDiagnostics(),
        performance: {
          averageFps: this.frameSamples.length === 0
            ? 0
            : Math.round(1_000 / (this.frameSamples.reduce((sum, sample) => sum + sample, 0) / this.frameSamples.length)),
          sampleCount: this.frameSamples.length,
        },
        offlineReward: this.offlineReward,
        player: {
          x: Math.round(this.player.x),
          y: Math.round(this.player.y),
          carrying: this.player.getCarriedFood(),
          carryingQuantity: this.player.getCarriedQuantity(),
        },
        customers: [...this.customers.values()].map((customer) => ({
          id: customer.customerId,
          state: customer.customerState,
          x: Math.round(customer.x),
          y: Math.round(customer.y),
          orderId: customer.orderId,
          quantity: customer.orderQuantity,
          patienceMs: Math.round(customer.patienceMs),
          vip: customer.isVip,
        })),
      }),
      grantMoney: (amount = 10_000) => this.economy.addMoney(Math.max(0, Math.round(amount))),
      setRating: (rating = 5) => this.economy.setRating(rating),
      setWorldPhase: (phase) => {
        const state = this.dayNight.setPhase(phase);
        this.currentVisualPhase = state.phase;
        this.decor.setPhase(state.phase, true);
        this.atmosphere.setPhase(state.phase, true);
        this.sfx.setAmbience(state.phase, this.reducedMotion);
        for (const customer of this.customers.values()) customer.setNightMode(state.phase === "night");
        this.hud.setWorldTime(state);
      },
      setVisualTier: (tier) => {
        const state = this.dayNight.setVisualTier(tier);
        this.decor.setVisualTier(tier);
        this.hud.setWorldTime(state);
      },
      purchaseNext: () => {
        const result = this.progression.purchaseNext();
        this.saveProgress();
        if (this.progression.isGameComplete()) {
          this.beginClearSequence();
        }
        return result.success;
      },
      setStage: (stage) => {
        this.progression.debugGrantThroughStage(stage);
        this.saveProgress();
      },
      spawnVip: () => this.spawnCustomer(true),
      triggerRush: () => {
        const config = getRushConfig(this.progression.getCurrentStage());
        if (config === undefined) {
          return false;
        }
        this.rushCountdownMs = 0;
        this.rushRemainingMs = config.durationMs;
        this.rushWarningShown = true;
        this.scheduleNextSpawn();
        this.refreshServiceLightMode();
        return true;
      },
      triggerFever: () => {
        const activated = this.progression.debugTriggerFever();
        this.refreshServiceLightMode();
        return activated;
      },
      triggerPromotion: (menuItemId) => this.startMenuPromotion(menuItemId),
      setReducedMotion: (reducedMotion) => this.setReducedMotion(reducedMotion),
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
    this.saveProgress(this.clearing || this.progression.isGameComplete());
    this.removeEconomyListener?.();
    this.removeProgressionListener?.();
    this.game.events.off("app-before-unload", this.saveProgress, this);
    const keyboard = this.input.keyboard;
    keyboard?.off("keydown-SPACE", this.handleSpace, this);
    keyboard?.off("keydown-ESC", this.togglePause, this);
    keyboard?.off("keydown-M", this.toggleMute, this);
    this.sfx.dispose();
    this.atmosphere.destroy();
    window.__MEOW_DINER__ = undefined;
  }
}

function getRushConfig(stage: GrowthStage): {
  readonly periodMs: number;
  readonly durationMs: number;
  readonly spawnMultiplier: number;
} | undefined {
  const configs = {
    25: [90_000, 25_000, 0.65],
    26: [85_000, 25_000, 0.65],
    27: [80_000, 27_000, 0.62],
    28: [75_000, 27_000, 0.6],
    29: [70_000, 30_000, 0.58],
    30: [60_000, 30_000, 0.55],
  } as const;
  const config = configs[stage as keyof typeof configs];
  return config === undefined
    ? undefined
    : { periodMs: config[0], durationMs: config[1], spawnMultiplier: config[2] };
}

function readDebugStage(search: string): GrowthStage | undefined {
  const params = new URLSearchParams(search);
  if (!params.has("debug")) return undefined;
  const raw = Number(params.get("debugStage"));
  if (!Number.isInteger(raw) || raw < 1 || raw > 30) return undefined;
  return raw as GrowthStage;
}

function getWorkerActionTimeMs(role: WorkerRole, ordinal: number): number {
  return WORKER_HIRE_CONFIGS.find(
    (config) => config.role === role && config.ordinal === ordinal,
  )?.actionTimeMs ?? (role === "chef" ? 1_100 : 4_800);
}

function setStatus(message: string): void {
  const element = document.querySelector<HTMLElement>("#status-message");
  if (element !== null) {
    element.textContent = message;
  }
}
