import Phaser from "phaser";
import { createGameBackdrop, type DinerDecor, UI_FONT } from "../art/SceneDecor";
import {
  ensureCustomizedPlayerTextures,
  getCustomizedPlayerTextureKey,
} from "../art/PixelArtFactory";
import { AtmosphereSystem, type ServiceLightMode } from "../art/AtmosphereSystem";
import { SoundManager, type SoundSettings } from "../audio/SoundManager";
import { CookingStation, type CookingTicket } from "../entities/CookingStation";
import { Customer } from "../entities/Customer";
import { Player } from "../entities/Player";
import { DiningTable } from "../entities/Table";
import { CUSTOMER_DATA, getCustomerData, pickCustomerDataForKinds } from "../data/customerData";
import { getMenuItem, setActiveMenuChapter } from "../data/menuData";
import { getChapter } from "../data/chapterData";
import {
  getStageConfig,
  MAX_WORKERS_PER_ROLE,
  WORKER_HIRE_CONFIGS,
} from "../data/progressionData";
import { formatCompactNumber } from "../economy/economyMath";
import { EconomySystem } from "../systems/EconomySystem";
import { DayNightController } from "../systems/DayNightController";
import { ProgressionSystem } from "../systems/ProgressionSystem";
import {
  calculateOfflineEfficiency,
  calculateOfflineReward,
  type OfflineRewardResult,
} from "../systems/OfflineEarningsSystem";
import { DEFAULT_GAME_SETTINGS, SaveSystem } from "../systems/SaveSystem";
import { getFameBenefits, type FameBenefits } from "../systems/FameSystem";
import {
  getPerformanceModeLabel,
  getPerformanceProfile,
  type PerformanceProfile,
} from "../systems/PerformanceSystem";
import { calculateCharacterTravelDurationMs } from "../systems/WorkerMovementRules";
import {
  CustomizationSystem,
  AVATAR_ITEMS,
  FACILITY_UPGRADES,
  OWNER_STYLES,
  getFacilityRequiredFame,
  getWorktopSlotUpgradeCost,
  type AvatarCategory,
  type AvatarLook,
  type FacilityCategory,
} from "../systems/CustomizationSystem";
import {
  calculateOrderPatienceMs,
  calculateSeatWaitPatienceMs,
  canReceiveFood,
  canSpawnCustomer,
  CUSTOMER_ARRIVAL_INTERVAL_MULTIPLIER,
  selectFoodRecipient,
} from "../systems/ServiceFlowRules";
import {
  CustomerState,
  type GrowthStage,
  type MenuItemId,
  type PerformanceMode,
  type ProgressionEffects,
  type SaveData,
  type VisualPhase,
  type WorkerRole,
} from "../types/game";
import { HUD } from "../../ui/HUD";
import { MobileUpgradePanel } from "../../ui/MobileUpgradePanel";
import { PixelButton } from "../../ui/PixelButton";
import { ToastManager } from "../../ui/ToastManager";
import { UpgradePanel } from "../../ui/UpgradePanel";
import {
  configureHighDefinitionScene,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  shouldUseMobilePowerProfile,
} from "../art/Presentation";
import { touchInput } from "../input/TouchControls";

export interface GameSceneData {
  readonly newGame?: boolean;
  readonly muted?: boolean;
  readonly audioSettings?: Partial<SoundSettings>;
}

interface PendingPayment {
  readonly image: Phaser.GameObjects.Image;
  readonly menuItemId: MenuItemId;
  readonly quantity: number;
  readonly tipRate: number;
  readonly vipMultiplier: number;
  readonly comboMultiplier: number;
  readonly specialMultiplier: number;
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

const TABLE_POSITIONS = [
  { x: 35, y: 142 }, { x: 105, y: 142 }, { x: 175, y: 142 }, { x: 245, y: 142 }, { x: 315, y: 142 },
  { x: 35, y: 187 }, { x: 105, y: 187 }, { x: 175, y: 187 }, { x: 245, y: 187 }, { x: 315, y: 187 },
  { x: 70, y: 232 }, { x: 140, y: 232 }, { x: 210, y: 232 }, { x: 280, y: 232 },
  { x: 350, y: 232 },
] as const;

// TEMP: Full-playthrough QA button. Remove with the matching button in create().
const TEMP_TEST_MONEY = 1_000_000_000_000_000;

const SERVER_HOME_POSITIONS = [
  { x: 316, y: 124 },
  { x: 275, y: 124 },
  { x: 234, y: 124 },
  { x: 193, y: 124 },
  { x: 152, y: 124 },
] as const;

const AUTO_ORDER_DELAY_MS = 720;
const SAVE_INTERVAL_MS = 8_000;
const MAX_POOLED_PAYMENTS = 24;
const RUSH_CONFIGS: Partial<Record<GrowthStage, RushConfig>> = {
  25: { periodMs: 90_000, durationMs: 25_000, spawnMultiplier: 0.65 },
  26: { periodMs: 85_000, durationMs: 25_000, spawnMultiplier: 0.65 },
  27: { periodMs: 80_000, durationMs: 27_000, spawnMultiplier: 0.62 },
  28: { periodMs: 75_000, durationMs: 27_000, spawnMultiplier: 0.6 },
  29: { periodMs: 70_000, durationMs: 30_000, spawnMultiplier: 0.58 },
  30: { periodMs: 60_000, durationMs: 30_000, spawnMultiplier: 0.55 },
};

interface RushConfig {
  readonly periodMs: number;
  readonly durationMs: number;
  readonly spawnMultiplier: number;
}

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
  private mobileUpgradePanel?: MobileUpgradePanel;
  private toast!: ToastManager;
  private readonly customers = new Map<string, Customer>();
  private readonly tables: DiningTable[] = [];
  private readonly stations = new Map<MenuItemId, CookingStation>();
  private readonly pendingPayments: PendingPayment[] = [];
  private readonly chefs: WorkerAgent[] = [];
  private readonly servers: WorkerAgent[] = [];
  private readonly chefAssignedCustomers = new Set<string>();
  private readonly serverTargetCustomerIds = new Set<string>();
  private paymentPool!: Phaser.GameObjects.Group;
  private spawnCountdownMs = 850;
  private saveCountdownMs = SAVE_INTERVAL_MS;
  private elapsedMs = 0;
  private currentVisualPhase: VisualPhase = "day";
  private customerSerial = 0;
  private workerAnimationClock = 0;
  private workerAnimationFrame = 0;
  private automationAccumulatorMs = 0;
  private eventAccumulatorMs = 0;
  private interactionAccumulatorMs = 0;
  private presentationAccumulatorMs = 0;
  private interactionMarker!: Phaser.GameObjects.Image;
  private interactionText!: Phaser.GameObjects.Text;
  private currentInteraction?: InteractionTarget;
  private isPaused = false;
  private appHidden = false;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private offlineOverlay?: Phaser.GameObjects.Container;
  private shopOverlay?: Phaser.GameObjects.Container;
  private readonly customization = new CustomizationSystem();
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
  private offlineReward?: OfflineRewardResult;
  private reducedMotion = false;
  private mobilePowerProfile = false;
  private performanceMode: PerformanceMode = "balanced";
  private performanceProfile: PerformanceProfile = getPerformanceProfile("balanced", false);
  private smoothedGameplayDeltaMs = 0;
  private gameplayFrameCount = 0;
  private feverWarningShown = false;
  private ticketStats = { accepted: 0, completed: 0, served: 0, cancelled: 0, wasted: 0, duplicateServices: 0 };
  private removeEconomyListener?: () => void;
  private removeProgressionListener?: () => void;
  private removeTouchActionListener?: () => void;
  private removeTouchPauseListener?: () => void;
  private debugStatusElement?: HTMLElement;

  public constructor() {
    super("GameScene");
  }

  public create(data: GameSceneData): void {
    document.body.classList.add("gameplay-active");
    configureHighDefinitionScene(this);
    this.physics.world.setBounds(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    this.resetTransientState();
    this.saveSystem = new SaveSystem();
    const previousSave = this.saveSystem.load();
    this.currentSave = data.newGame === true
      ? this.saveSystem.newGame({
          muted: data.audioSettings?.muted ?? data.muted ?? previousSave?.muted ?? false,
          settings: previousSave === null
            ? data.audioSettings === undefined
              ? undefined
              : { ...DEFAULT_GAME_SETTINGS, ...data.audioSettings }
            : {
                ...previousSave.settings,
                ...data.audioSettings,
                muted: data.audioSettings?.muted ?? data.muted ?? previousSave.muted,
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
    setActiveMenuChapter(this.progression.getChapterId());
    this.customization.setActiveChapter(this.progression.getChapterId());
    const debugStage = readDebugStage(window.location.search);
    if (debugStage !== undefined) {
      this.progression.debugGrantThroughStage(debugStage);
    }
    this.currentEffects = this.progression.getEffects();
    this.reducedMotion = this.currentSave.settings.reducedMotion
      || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    this.mobilePowerProfile = shouldUseMobilePowerProfile();
    this.performanceMode = this.currentSave.settings.performanceMode;
    this.performanceProfile = getPerformanceProfile(this.performanceMode, this.mobilePowerProfile);
    applyGameLoopFpsLimit(this.game.loop, this.performanceProfile.targetFps);
    this.applyOfflineReward(previousSave, data.newGame === true);
    this.tutorialCompleted = this.currentSave.tutorialCompleted;
    this.elapsedMs = this.currentSave.elapsedMs;
    this.sfx = SoundManager.forRegistry(this.registry, this.currentSave.settings);
    this.dayNight = new DayNightController(
      this.currentSave.worldClockMs,
      this.currentSave.visualTier,
    );
    this.decor = createGameBackdrop(this, this.progression.getChapterId());
    this.decor.setShopTier(this.customization.getFacilityEffects().visualTier);
    this.decor.setShopFacilities(this.customization.getOwnedFacilityIds());
    this.atmosphere = new AtmosphereSystem(
      this,
      this.reducedMotion,
      this.performanceMode,
      this.mobilePowerProfile,
      this.progression.getChapterId(),
    );
    const initialVisualState = this.dayNight.getState();
    this.currentVisualPhase = initialVisualState.phase;
    this.decor.setVisualTier(initialVisualState.visualTier);
    this.decor.setPhase(initialVisualState.phase, true);
    this.decor.setReducedMotion(this.reducedMotion);
    this.atmosphere.setVisualTier(initialVisualState.visualTier);
    this.atmosphere.setPhase(initialVisualState.phase, true);
    this.atmosphere.setWorkerCounts(this.currentEffects.chefCount, this.currentEffects.serverCount);
    this.sfx.setAmbience(initialVisualState.phase, this.reducedMotion, initialVisualState.phaseTrackIndex, initialVisualState.phaseElapsedMs);
    const progressionState = this.progression.getState();
    this.decor.setProgression(
      progressionState.currentStage,
      progressionState.purchasedStepCount,
    );

    this.createStations();
    this.createTables(this.currentEffects.seatCount + this.customization.getFacilityEffects().bonusSeats);
    this.player = new Player(this, 176, 128);
    this.player.setOwnerTint(this.customization.getSelected().tint);
    this.player.setAvatarLook(this.customization.getAvatarLook());
    this.createWorkers();
    this.createTransientPools();
    this.applyEffects(this.currentEffects, false);
    this.hud = new HUD(this);
    this.hud.setWorldTime(initialVisualState);
    this.upgradePanel = new UpgradePanel(this);
    this.mobileUpgradePanel = new MobileUpgradePanel();
    this.toast = new ToastManager(this);
    new PixelButton(this, 325, 47, "상점", () => {
      if (this.tutorialOverlay !== undefined || this.offlineOverlay !== undefined || this.clearing) return;
      this.openStyleShop();
    }, { width: 44, height: 18, primary: false, fontSize: 7 }).setDepth(920);
    new PixelButton(this, 325, 68, "테스트 ∞냥", () => this.grantTemporaryTestMoney(), {
      width: 44,
      height: 18,
      primary: false,
      fontSize: 6,
    }).setDepth(920);
    this.createInteractionIndicator();
    this.createInputHandlers();
    this.createSubscriptions();
    this.refreshUi(false);
    this.configureDebugApi();

    if (this.progression.isChapterComplete()) {
      this.time.delayedCall(220, () => this.beginClearSequence());
    } else if (this.offlineReward !== undefined && this.offlineReward.amount > 0) {
      this.saveProgress();
      this.showOfflineRewardOverlay();
    } else {
      this.beginOpeningFlow();
    }

    this.game.events.on("app-before-unload", this.saveProgress, this);
    this.game.events.on("app-visibility-change", this.handleAppVisibilityChange, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    this.cameras.main.fadeIn(260, 8, 11, 25);
  }

  public override update(_time: number, deltaMs: number): void {
    const stepMs = Math.min(deltaMs, 64);
    this.smoothedGameplayDeltaMs = this.smoothedGameplayDeltaMs === 0
      ? stepMs
      : this.smoothedGameplayDeltaMs * 0.9 + stepMs * 0.1;
    this.gameplayFrameCount += 1;
    this.hud.update(stepMs);
    if (this.appHidden || this.isPaused || this.tutorialOverlay !== undefined || this.clearing) {
      this.sfx.setMusicPaused(this.appHidden || this.isPaused || this.clearing);
      return;
    }
    this.sfx.setMusicPaused(false);

    this.elapsedMs += stepMs;
    this.presentationAccumulatorMs += stepMs;
    const presentationIntervalMs = Math.max(50, this.performanceProfile.uiUpdateIntervalMs);
    if (this.presentationAccumulatorMs >= presentationIntervalMs) {
      const visualState = this.dayNight.update(this.presentationAccumulatorMs);
      if (visualState.phase !== this.currentVisualPhase) {
        this.currentVisualPhase = visualState.phase;
        this.decor.setPhase(visualState.phase);
        this.atmosphere.setPhase(visualState.phase);
        this.sfx.setAmbience(visualState.phase, this.reducedMotion, visualState.phaseTrackIndex, visualState.phaseElapsedMs);
        for (const customer of this.customers.values()) {
          customer.setNightMode(visualState.phase === "night");
        }
      }
      this.hud.setElapsedTime(this.elapsedMs);
      this.hud.setWorldTime(visualState);
      this.presentationAccumulatorMs = 0;
    }
    this.atmosphere.update(stepMs);
    this.player.update(stepMs);
    this.updateDebugTelemetry();
    this.updateCustomers(stepMs);
    this.updateStations(stepMs);
    this.updateWorkers(stepMs);
    this.eventAccumulatorMs += stepMs;
    if (this.eventAccumulatorMs >= this.performanceProfile.automationUpdateIntervalMs) {
      const eventDeltaMs = this.eventAccumulatorMs;
      this.eventAccumulatorMs = 0;
      this.updateRush(eventDeltaMs);
      this.updateFeverAndPromotion(eventDeltaMs);
    }
    this.updatePayments(stepMs);
    this.updateSpawner(stepMs);
    this.interactionAccumulatorMs += stepMs;
    if (this.interactionAccumulatorMs >= this.performanceProfile.interactionUpdateIntervalMs) {
      this.interactionAccumulatorMs = 0;
      this.updateInteractionIndicator();
    }

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
    this.automationAccumulatorMs = 0;
    this.eventAccumulatorMs = 0;
    this.interactionAccumulatorMs = 0;
    this.presentationAccumulatorMs = 0;
    this.isPaused = false;
    this.appHidden = false;
    this.pauseOverlay = undefined;
    this.offlineOverlay = undefined;
    this.shopOverlay = undefined;
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
    this.feverWarningShown = false;
    this.smoothedGameplayDeltaMs = 0;
    this.gameplayFrameCount = 0;
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
        if (ticket.chefWorkerId !== undefined) this.releaseChefIfCookingComplete(ticket.chefWorkerId);
        this.sfx.ready();
        setStatus(`${getMenuItem(definition.menuItemId).name} 조리가 완료됐습니다.`);
      });
      station.setCookingTimeResolver((quantity) =>
        this.progression.getMenuCookingTimeMs(definition.menuItemId, quantity)
          * this.customization.getFacilityEffects().cookingTimeMultiplier);
      station.setCanStartNextResolver((ticket) => this.canStartCookingTicket(ticket));
      this.stations.set(definition.menuItemId, station);
    }
  }

  private canStartCookingTicket(ticket: CookingTicket): boolean {
    let activeChefCount = 0;
    let playerCooking = false;
    const cookingSlotCount = Math.max(1, Math.floor(this.currentEffects.cookingSlotCount));
    for (const station of this.stations.values()) {
      activeChefCount += station.getActiveChefCount();
      playerCooking ||= station.hasActivePlayerCooking();
      if (
        ticket.chefWorkerId !== undefined
        && station.hasActiveCookingForChef(ticket.chefWorkerId)
      ) return false;
    }
    if (ticket.cookingAgent === "player") {
      return ticket.playerStarted === true && !playerCooking;
    }
    if (ticket.cookingAgent === "chef" && ticket.chefWorkerId === undefined) {
      return false;
    }
    return activeChefCount < cookingSlotCount;
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
    for (let ordinal = 1; ordinal <= MAX_WORKERS_PER_ROLE; ordinal += 1) {
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
      const serverHome = SERVER_HOME_POSITIONS[ordinal - 1] ?? SERVER_HOME_POSITIONS[0];
      const serverX = serverHome.x;
      const serverY = serverHome.y;
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

  private createTransientPools(): void {
    this.paymentPool = this.add.group({
      classType: Phaser.GameObjects.Image,
      maxSize: MAX_POOLED_PAYMENTS,
      runChildUpdate: false,
    });
  }

  private acquirePaymentImage(x: number, y: number): Phaser.GameObjects.Image {
    const pooled = this.paymentPool.get(x, y, "coin") as Phaser.GameObjects.Image | null;
    const image = pooled ?? this.add.image(x, y, "coin");
    return image
      .setPosition(x, y)
      .setTexture("coin")
      .setAlpha(1)
      .setScale(1)
      .setActive(true)
      .setVisible(true)
      .setDepth(520);
  }

  private releasePaymentImage(image: Phaser.GameObjects.Image): void {
    this.tweens.killTweensOf(image);
    if (this.paymentPool.contains(image)) {
      this.paymentPool.killAndHide(image);
      image.setAlpha(1).setScale(1);
    } else {
      image.destroy();
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

  private grantTemporaryTestMoney(): void {
    this.economy.debugSetMoney(Math.max(this.economy.getMoney(), TEMP_TEST_MONEY));
    this.saveProgress();
    this.toast.show("테스트 자금 1,000조냥 지급!");
  }

  private createInputHandlers(): void {
    const keyboard = this.input.keyboard;
    if (keyboard !== null) {
      keyboard.on("keydown-SPACE", this.handleSpace, this);
      keyboard.on("keydown-ESC", this.togglePause, this);
      keyboard.on("keydown-M", this.toggleMute, this);
    }
    this.removeTouchActionListener = touchInput.subscribe("action", () => this.handleSpace());
    this.removeTouchPauseListener = touchInput.subscribe("pause", () => this.togglePause());
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
    this.mobileUpgradePanel?.onPurchase(() => this.purchaseNextProgression());
  }

  private updateSpawner(deltaMs: number): void {
    this.spawnCountdownMs -= deltaMs;
    if (this.spawnCountdownMs > 0) {
      return;
    }

    const seatCount = this.currentEffects.seatCount + this.customization.getFacilityEffects().bonusSeats;
    if (canSpawnCustomer(this.customers.values(), seatCount)) {
      this.spawnCustomer();
      return;
    }
    this.scheduleNextSpawn();
  }

  private spawnCustomer(forcedVip?: boolean, forcedSpecialOrder?: boolean): void {
    if (this.clearing) {
      return;
    }
    const fame = this.getCurrentFameBenefits();
    const data = pickCustomerDataForKinds(fame.unlockedCustomerKinds, Math.random());
    const stageConfig = getStageConfig(this.progression.getCurrentStage());
    const kindPatienceMultiplier = data.id === "rabbit"
      ? 0.8
      : data.id === "hamster"
        ? 0.95
        : data.id === "dog"
          ? 1.1
          : 1.2;
    const effectiveVipChance = Math.min(
      0.3,
      fame.vipChance + this.customization.getFacilityEffects().vipChanceBonus,
    );
    const vip = forcedVip ?? Math.random() < effectiveVipChance;
    const specialOrder = forcedSpecialOrder ?? Math.random() < Math.min(
      0.4,
      fame.specialOrderChance + this.customization.getFacilityEffects().specialOrderChanceBonus,
    );
    let waitingIndex = 0;
    for (const other of this.customers.values()) {
      if (
        other.customerState === CustomerState.ENTERING
        || other.customerState === CustomerState.WAITING_FOR_SEAT
      ) waitingIndex += 1;
    }
    const basePatienceMs = Math.round(
      stageConfig.basePatienceMs * kindPatienceMultiplier * (vip ? 1.25 : 1)
        * this.customization.getFacilityEffects().patienceMultiplier,
    );
    this.customerSerial += 1;
    const customer = new Customer(
      this,
      `guest-${Date.now()}-${this.customerSerial}`,
      data.id,
      -16,
      231,
      {
        patienceMs: calculateSeatWaitPatienceMs(basePatienceMs, waitingIndex),
        vip,
        specialOrder,
        nightMode: this.currentVisualPhase === "night",
      },
    );
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
      * safetyMultiplier
      * this.customization.getFacilityEffects().customerArrivalMultiplier;
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
    for (const customer of this.customers.values()) {
      switch (customer.customerState) {
        case CustomerState.ENTERING:
          if (customer.updateMovement(deltaMs)) {
            customer.setCustomerState(CustomerState.WAITING_FOR_SEAT);
          }
          break;
        case CustomerState.WAITING_FOR_SEAT:
          customer.tickPatience(deltaMs, this.performanceProfile.customerUiUpdateIntervalMs);
          if (customer.patienceMs <= 0) {
            this.handleCustomerWalkout(customer);
            break;
          }
          this.tryAssignSeat(customer);
          break;
        case CustomerState.MOVING_TO_SEAT:
          if (customer.updateMovement(deltaMs)) {
            this.createCustomerOrder(customer);
          }
          break;
        case CustomerState.ORDERING:
          customer.tickPatience(deltaMs, this.performanceProfile.customerUiUpdateIntervalMs);
          if (customer.patienceMs <= 0) {
            this.handleCustomerWalkout(customer);
            break;
          }
          break;
        case CustomerState.WAITING_FOR_FOOD:
          customer.tickPatience(deltaMs, this.performanceProfile.customerUiUpdateIntervalMs);
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

    for (const customer of this.customers.values()) {
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
        if (ticket.chefWorkerId !== undefined) this.releaseChefIfCookingComplete(ticket.chefWorkerId);
      }
    }
    for (const chef of this.chefs) {
      if (chef.assignedCustomerId === customer.customerId) this.releaseChef(chef.id);
    }
    const carriedFood = this.player.getCarriedFood();
    if (
      carriedFood !== undefined
      && carriedFood === customer.orderId
      && this.player.getCarriedTicketCustomerId() === customer.customerId
    ) {
      const carriedQuantity = this.player.getCarriedQuantity();
      const excludedCustomerIds = new Set(this.serverTargetCustomerIds);
      excludedCustomerIds.add(customer.customerId);
      const alternative = selectFoodRecipient(
        this.customers.values(),
        { menuItemId: carriedFood, quantity: carriedQuantity },
        excludedCustomerIds,
        this.player,
      );
      if (alternative === undefined) {
        this.player.clearCarriedFood();
        this.hud.setHeldFood();
        this.ticketStats.cancelled += 1;
      } else {
        const station = this.stations.get(carriedFood);
        const cancelledTicket = station?.cancelOneTicketForCustomer(
          alternative.customerId,
          carriedQuantity,
        );
        if (cancelledTicket !== undefined) {
          this.ticketStats.cancelled += 1;
          if (cancelledTicket.chefWorkerId !== undefined) {
            this.releaseChefIfCookingComplete(cancelledTicket.chefWorkerId);
          }
        }
        this.player.setCarriedFood(
          carriedFood,
          carriedQuantity,
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
    const singleServingCookingTimeMs = this.progression.getMenuCookingTimeMs(menuItemId)
      * this.customization.getFacilityEffects().cookingTimeMultiplier;
    const station = this.stations.get(menuItemId);
    const patienceBudgetMs = calculateOrderPatienceMs(
      customer.maxPatienceMs,
      singleServingCookingTimeMs,
      quantity,
      {
        kitchenQueueDelayMs: station?.getEstimatedQueueDelayMs() ?? singleServingCookingTimeMs,
        manualOrderTaking: this.currentEffects.chefCount === 0,
      },
    ) * (customer.isVip ? 1.2 : 1);
    customer.placeOrder(menuItemId, quantity, patienceBudgetMs);
    if (customer.isSpecialOrder) {
      this.toast.show(`★ 특별 주문 · ${getMenuItem(menuItemId).name} ×${quantity}`, "success");
    }
    setStatus(`${customer.isSpecialOrder ? "특별 " : ""}${getCustomerData(customer.kind).name} 손님이 ${getMenuItem(menuItemId).name}을 주문하려 합니다.`);
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
    const quantity = roll < one ? 1 : roll < one + two ? 2 : 3;
    return customer.isSpecialOrder ? Math.max(2, quantity) : quantity;
  }

  private acceptOrder(customer: Customer, automated: boolean, chefWorkerId?: string): boolean {
    if (customer.customerState !== CustomerState.ORDERING || customer.orderId === undefined) {
      return false;
    }
    const station = this.stations.get(customer.orderId);
    if (station === undefined || !station.isUnlocked()) {
      return false;
    }
    const totalCookingTimeMs = this.progression.getMenuCookingTimeMs(
      customer.orderId,
      customer.orderQuantity,
    ) * this.customization.getFacilityEffects().cookingTimeMultiplier;
    const perServingCookingTimeMs = Math.max(
      1,
      Math.round(totalCookingTimeMs / customer.orderQuantity),
    );
    customer.acceptOrder();
    for (let serving = 1; serving <= customer.orderQuantity; serving += 1) {
      const servingChefWorkerId = serving === 1
        ? chefWorkerId
        : this.claimExtraChefForCooking(customer, station);
      const ticket: CookingTicket = {
        customerId: customer.customerId,
        menuItemId: customer.orderId,
        quantity: 1,
        cookingTimeMs: perServingCookingTimeMs,
        chefWorkerId: servingChefWorkerId,
        cookingAgent: automated ? "chef" : "player",
        playerStarted: automated ? undefined : false,
      };
      station.enqueue(ticket);
      this.ticketStats.accepted += 1;
    }
    this.sfx.click();
    if (automated) {
      const chef = this.chefs.find((worker) => worker.id === chefWorkerId);
      if (chef !== undefined) {
        chef.assignedStationId = station.menuItemId;
        chef.assignedCustomerId = customer.customerId;
        this.tweens.killTweensOf(chef.sprite);
        this.tweens.add({
          targets: chef.sprite,
          x: station.x,
          y: station.y + 18,
          duration: calculateCharacterTravelDurationMs(
            chef.sprite.x,
            chef.sprite.y,
            station.x,
            station.y + 18,
          ),
          ease: "Linear",
          onUpdate: () => updateCharacterDepth(chef.sprite, 70),
        });
        this.pulseWorker(chef.sprite);
      }
    } else {
      this.toast.show(`${getMenuItem(customer.orderId).name} 주문 접수! 조리대로 가세요`, "success");
    }
    setStatus(automated
      ? `${getMenuItem(customer.orderId).name} 주문이 접수되어 셰프가 조리를 시작합니다.`
      : `${getMenuItem(customer.orderId).name} 주문을 받았습니다. 해당 조리대에서 직접 조리를 시작하세요.`);
    return true;
  }

  private claimExtraChefForCooking(
    customer: Customer,
    station: CookingStation,
  ): string | undefined {
    if (!this.hasAvailableChefCookingCapacity(station)) return undefined;
    const chef = this.chefs.find((worker) => worker.sprite.visible && !worker.busy);
    if (chef === undefined) return undefined;
    chef.busy = true;
    chef.assignedCustomerId = customer.customerId;
    chef.assignedStationId = station.menuItemId;
    chef.sprite.setTexture(`chef-${chef.ordinal}-1`).setFlipX(station.x < chef.sprite.x);
    this.tweens.killTweensOf(chef.sprite);
    this.tweens.add({
      targets: chef.sprite,
      x: station.x + 10,
      y: station.y + 18,
      duration: calculateCharacterTravelDurationMs(
        chef.sprite.x,
        chef.sprite.y,
        station.x + 10,
        station.y + 18,
      ),
      ease: "Linear",
      onUpdate: () => updateCharacterDepth(chef.sprite, 70),
    });
    return chef.id;
  }

  private hasAvailableChefCookingCapacity(station: CookingStation): boolean {
    if (!station.hasAvailableParallelSlot()) return false;
    let activeChefCount = 0;
    for (const candidate of this.stations.values()) {
      activeChefCount += candidate.getActiveChefCount();
    }
    return activeChefCount < Math.max(1, Math.floor(this.currentEffects.cookingSlotCount));
  }

  private assignChefToWaitingCooking(chef: WorkerAgent): boolean {
    for (const station of this.stations.values()) {
      if (!station.hasAvailableParallelSlot() || !this.hasAvailableChefCookingCapacity(station)) {
        continue;
      }
      const ticket = station.assignNextWaitingChefTicket(chef.id);
      if (ticket === undefined) continue;
      chef.busy = true;
      chef.assignedCustomerId = ticket.customerId;
      chef.assignedStationId = station.menuItemId;
      chef.sprite
        .setTexture(`chef-${chef.ordinal}-1`)
        .setFlipX(station.x < chef.sprite.x);
      this.tweens.killTweensOf(chef.sprite);
      this.tweens.add({
        targets: chef.sprite,
        x: station.x,
        y: station.y + 18,
        duration: calculateCharacterTravelDurationMs(
          chef.sprite.x,
          chef.sprite.y,
          station.x,
          station.y + 18,
        ),
        ease: "Linear",
        onUpdate: () => updateCharacterDepth(chef.sprite, 70),
      });
      this.pulseWorker(chef.sprite);
      return true;
    }
    return false;
  }

  private updateStations(deltaMs: number): void {
    const cookingSpeed = this.progression.getFeverCookingSpeedMultiplier();
    for (const station of this.stations.values()) {
      station.update(deltaMs * cookingSpeed);
    }
  }

  private updateWorkers(deltaMs: number): void {
    this.workerAnimationClock += deltaMs;
    if (this.workerAnimationClock >= this.performanceProfile.workerAnimationIntervalMs) {
      this.workerAnimationClock = 0;
      this.workerAnimationFrame = this.workerAnimationFrame === 0 ? 1 : 0;
      for (const chef of this.chefs) {
        if (!chef.sprite.visible) continue;
        chef.sprite.setTexture(`chef-${chef.ordinal}-${this.workerAnimationFrame}`);
      }
      for (const server of this.servers) {
        if (!server.sprite.visible) continue;
        const frame = server.busy ? this.workerAnimationFrame : 0;
        server.sprite.setTexture(`server-${server.ordinal}-${frame}`);
      }
    }
    this.automationAccumulatorMs += deltaMs;
    if (this.automationAccumulatorMs < this.performanceProfile.automationUpdateIntervalMs) return;
    this.automationAccumulatorMs = 0;
    this.dispatchChefOrders();
    this.dispatchServerDeliveries();
  }

  private dispatchChefOrders(): void {
    for (const chef of this.chefs) {
      if (!chef.sprite.visible || chef.busy) continue;
      if (this.assignChefToWaitingCooking(chef)) continue;
      let customer: Customer | undefined;
      for (const candidate of this.customers.values()) {
        if (
          candidate.customerState === CustomerState.ORDERING
          && candidate.stateElapsedMs >= AUTO_ORDER_DELAY_MS
          && !this.chefAssignedCustomers.has(candidate.customerId)
        ) {
          customer = candidate;
          break;
        }
      }
      if (customer === undefined) break;
      chef.busy = true;
      chef.assignedCustomerId = customer.customerId;
      this.chefAssignedCustomers.add(customer.customerId);
      const actionTime = getWorkerActionTimeMs("chef", chef.ordinal)
        * this.customization.getFacilityEffects().chefActionTimeMultiplier
        * this.currentEffects.chefActionTimeMultiplier
        / this.progression.getFeverWorkerSpeedMultiplier();
      const travelDurationMs = calculateCharacterTravelDurationMs(
        chef.sprite.x,
        chef.sprite.y,
        customer.x - 15,
        customer.y,
      );
      this.tweens.killTweensOf(chef.sprite);
      this.tweens.add({
        targets: chef.sprite,
        x: customer.x - 15,
        y: customer.y,
        duration: travelDurationMs,
        ease: "Linear",
        onUpdate: () => updateCharacterDepth(chef.sprite, 70),
      });
      this.time.delayedCall(Math.max(actionTime, travelDurationMs), () => {
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
    const actionTime = getWorkerActionTimeMs("server", worker.ordinal)
      * this.customization.getFacilityEffects().serverActionTimeMultiplier
      * this.currentEffects.serverActionTimeMultiplier
      / this.progression.getFeverWorkerSpeedMultiplier();
    const abortDelivery = (): void => {
      if (!worker.busy) return;
      if (ticket.customerId === target.customerId) {
        this.ticketStats.cancelled += 1;
      } else {
        station.returnReadyTicket(ticket);
      }
      this.releaseServer(worker);
    };
    this.tweens.add({
      targets: server,
      x: station.x + 19,
      y: station.y + 20,
      duration: calculateCharacterTravelDurationMs(
        server.x,
        server.y,
        station.x + 19,
        station.y + 20,
      ),
      ease: "Linear",
      onUpdate: () => updateCharacterDepth(server, 50),
      onComplete: () => {
        if (!server.active || !canReceiveFood(target, ticket)) {
          abortDelivery();
          return;
        }
        this.time.delayedCall(Math.max(80, Math.round(actionTime * 0.1)), () => {
          if (!worker.busy || !server.active || !canReceiveFood(target, ticket)) {
            abortDelivery();
            return;
          }
          server.setFlipX(target.x < server.x);
          this.tweens.add({
            targets: server,
            x: target.x + 17,
            y: target.y,
            duration: calculateCharacterTravelDurationMs(
              server.x,
              server.y,
              target.x + 17,
              target.y,
            ),
            ease: "Linear",
            onUpdate: () => updateCharacterDepth(server, 50),
            onComplete: () => {
              if (target.active && canReceiveFood(target, ticket)) {
                this.serveCustomer(target, true, worker, ticket);
              } else {
                abortDelivery();
                return;
              }
              this.serverTargetCustomerIds.delete(target.customerId);
              this.releaseServer(worker);
            },
          });
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
        const cancelledTicket = station?.cancelOneTicketForCustomer(
          customer.customerId,
          servedTicket.quantity,
        );
        if (cancelledTicket !== undefined) {
          this.ticketStats.cancelled += 1;
          if (cancelledTicket.chefWorkerId !== undefined) {
            this.releaseChefIfCookingComplete(cancelledTicket.chefWorkerId);
          }
        }
      }
    }
    const servedQuantity = servedTicket?.quantity ?? this.player.getCarriedQuantity();
    const orderCompleted = customer.serveOne(servedQuantity);
    this.ticketStats.served += 1;
    if (orderCompleted) customer.showHeart();
    this.sfx.buy();
    if (automated) {
      this.pulseWorker(worker?.sprite);
    } else {
      this.player.clearCarriedFood();
      this.hud.setHeldFood();
      this.toast.show(
        orderCompleted
          ? "주문을 모두 서빙했어요!"
          : `한 접시 서빙 · ${customer.remainingQuantity}개 남음`,
        "success",
      );
    }
    setStatus(
      orderCompleted
        ? `${getCustomerData(customer.kind).name} 손님의 주문을 모두 서빙했습니다.`
        : `${getCustomerData(customer.kind).name} 손님에게 한 접시를 서빙했습니다. ${customer.remainingQuantity}개 남았습니다.`,
    );
  }

  private finishMeal(customer: Customer): void {
    customer.setCustomerState(CustomerState.PAYING);
    const table = this.tables.find((candidate) => candidate.id === customer.assignedTableId);
    if (table !== undefined) {
      table.release(customer.customerId);
    }
    const ratio = customer.getPatienceRatio();
    const data = getCustomerData(customer.kind);
    const fame = this.getCurrentFameBenefits();
    const facilityEffects = this.customization.getFacilityEffects();
    const facilityTipBonus = facilityEffects.tipChanceBonus
      + fame.tipChanceBonus
      + this.progression.getFeverTipChanceBonus()
      + (this.currentVisualPhase === "night" ? facilityEffects.nightTipChanceBonus : 0)
      + (customer.isSpecialOrder ? 0.25 : 0);
    const tipChance = ratio >= 0.75
      ? Math.min(1, data.tipChance + 0.25 + facilityTipBonus)
      : ratio >= 0.45
        ? Math.min(1, data.tipChance + facilityTipBonus)
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
    const image = this.acquirePaymentImage(
      table?.seatPosition.x ?? customer.x,
      (table?.seatPosition.y ?? customer.y) + 4,
    );
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
      specialMultiplier: customer.isSpecialOrder ? 1.25 : 1,
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
      const distanceX = this.player.x - payment.image.x;
      const distanceY = this.player.y - payment.image.y;
      const playerReached = distanceX * distanceX + distanceY * distanceY <= 256;
      const autoCollect = this.currentEffects.serverHired && payment.ageMs >= 650;
      if (playerReached || autoCollect) {
        this.collectPayment(payment, index);
      }
    }
  }

  private collectPayment(payment: PendingPayment, index: number): void {
    const promotionMultiplier = payment.menuItemId === this.promotionMenuId ? 1.25 : 1;
    const feverMultiplier = this.progression.getFeverRevenueMultiplier()
      * promotionMultiplier
      * payment.specialMultiplier;
    const result = this.economy.recordSale({
      unitPrice: this.progression.getMenuPrice(payment.menuItemId),
      quantity: payment.quantity,
      tipRate: payment.tipRate,
      vipMultiplier: payment.vipMultiplier,
      comboMultiplier: payment.comboMultiplier,
      feverMultiplier: feverMultiplier
        * this.customization.getFacilityEffects().revenueMultiplier
        * getEffectiveFameRevenueMultiplier(this.currentEffects, this.customization.getFacilityEffects().fameBonus),
      ratingGain: 0,
    });
    const feverLevel = this.progression.getFeverState().level;
    const gaugePerSale = feverLevel === 1 ? 14 : feverLevel === 2 ? 12 : 10;
    const feverResult = this.progression.addFeverGauge(
      gaugePerSale
        * payment.quantity
        * this.customization.getFacilityEffects().feverChargeMultiplier,
    );
    if (feverResult.activated) {
      this.toast.show(`FEVER Lv.${feverResult.state.level} · 매출 폭발!`, "success");
      this.decor.celebrate();
      this.sfx.upgrade();
    }
    const x = payment.image.x;
    const y = payment.image.y;
    this.releasePaymentImage(payment.image);
    this.pendingPayments.splice(index, 1);
    this.sfx.coin();
    this.hud.flashMoney(true);
    this.showMoneyPopup(x, y, result.totalAmount, result.tipAmount);
    if (this.progression.isChapterComplete()) {
      this.beginClearSequence();
    }
  }

  private updateFeverAndPromotion(deltaMs: number): void {
    const feverTransition = this.progression.updateFever(deltaMs);
    const fever = this.progression.getFeverState();
    if (fever.activeRemainingMs > 3_000) this.feverWarningShown = false;
    if (fever.activeRemainingMs > 0 && fever.activeRemainingMs <= 3_000 && !this.feverWarningShown) {
      this.feverWarningShown = true;
      this.toast.show("피버 종료 3초 전!", "warning");
      this.cameras.main.flash(this.reducedMotion ? 80 : 160, 69, 255, 210, false);
    }
    if (feverTransition.ended) {
      this.feverWarningShown = false;
      this.toast.show("피버 종료 · 다시 게이지를 채워요");
    }
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
    this.refreshServiceLightMode(fever.activeRemainingMs > 0);
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

  private refreshServiceLightMode(
    feverActive = this.progression.getFeverState().activeRemainingMs > 0,
  ): void {
    const mode: ServiceLightMode = this.rushRemainingMs > 0
      ? "rush"
      : feverActive
        ? "fever"
        : "normal";
    this.atmosphere.setServiceMode(mode);
    this.sfx.setFeverActive(feverActive);
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
    let nearestDistanceSquared = 39 * 39;
    for (const station of this.stations.values()) {
      if (station.getReadyCount() === 0) {
        continue;
      }
      const distanceX = station.x - this.player.x;
      const distanceY = station.y - this.player.y;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;
      if (distanceSquared <= nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
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

    if (!this.isPlayerCooking()) {
      let nearestPlayerStation: CookingStation | undefined;
      nearestDistanceSquared = 39 * 39;
      for (const station of this.stations.values()) {
        if (!station.hasPendingPlayerTicket()) continue;
        const distanceX = station.x - this.player.x;
        const distanceY = station.y - this.player.y;
        const distanceSquared = distanceX * distanceX + distanceY * distanceY;
        if (distanceSquared <= nearestDistanceSquared) {
          nearestDistanceSquared = distanceSquared;
          nearestPlayerStation = station;
        }
      }
      if (nearestPlayerStation !== undefined) {
        const menuName = getMenuItem(nearestPlayerStation.menuItemId).name;
        return {
          x: nearestPlayerStation.x,
          y: nearestPlayerStation.y,
          label: `${menuName} 조리하기`,
          action: () => this.startPlayerCooking(nearestPlayerStation),
        };
      }
    }
    return undefined;
  }

  private isPlayerCooking(): boolean {
    for (const station of this.stations.values()) {
      if (station.hasPlayerCookingCommitment()) return true;
    }
    return false;
  }

  private startPlayerCooking(station: CookingStation): void {
    if (this.isPlayerCooking()) return;
    const ticket = station.startNextPlayerTicket();
    if (ticket === undefined) return;
    const menuName = getMenuItem(ticket.menuItemId).name;
    this.sfx.click();
    this.toast.show(`${menuName} 직접 조리 시작!`, "success");
    setStatus(`${menuName}을 만들고 있습니다. 셰프의 다른 메뉴와 동시에 조리됩니다.`);
  }

  private findNearestCustomer(
    predicate: (customer: Customer) => boolean,
    maximumDistance: number,
  ): Customer | undefined {
    let nearest: Customer | undefined;
    let nearestDistanceSquared = maximumDistance * maximumDistance;
    for (const customer of this.customers.values()) {
      if (!predicate(customer)) {
        continue;
      }
      const distanceX = this.player.x - customer.x;
      const distanceY = this.player.y - customer.y;
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;
      if (distanceSquared <= nearestDistanceSquared) {
        nearest = customer;
        nearestDistanceSquared = distanceSquared;
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
    setStatus(`${getMenuItem(ticket.menuItemId).name} 한 접시를 들었습니다. 같은 메뉴를 기다리는 손님 누구에게나 서빙할 수 있습니다.`);
  }

  private handleSpace(): void {
    if (this.tutorialOverlay !== undefined) {
      this.advanceTutorial();
      return;
    }
    if (this.isPaused || this.clearing || this.shopOverlay !== undefined) {
      return;
    }
    const interaction = this.findInteraction();
    if (interaction !== undefined) {
      interaction.action();
      this.currentInteraction = undefined;
    }
  }

  private applyEffects(effects: ProgressionEffects, celebrate: boolean): void {
    this.createTables(effects.seatCount + this.customization.getFacilityEffects().bonusSeats);
    const progressionState = this.progression.getState();
    for (const [menuItemId, station] of this.stations) {
      station.setUnlocked(effects.unlockedMenuIds.includes(menuItemId));
      station.setSpeedMultiplier(1);
      const worktopSlots = this.customization.getWorktopSlotCount(menuItemId);
      station.setParallelSlotCount(worktopSlots);
      const menuProgress = progressionState.menuProgress.find(
        (menu) => menu.menuItemId === menuItemId,
      );
      if (menuProgress !== undefined) {
        station.setProgressStats(`${formatCompactNumber(this.progression.getMenuPrice(menuItemId))}냥`);
      }
    }
    const facilityEffects = this.customization.getFacilityEffects();
    this.chefs.forEach((worker, index) => {
      worker.sprite.setVisible(index < effects.chefCount);
      if (facilityEffects.chefTint === undefined) worker.sprite.clearTint();
      else worker.sprite.setTint(facilityEffects.chefTint);
    });
    this.servers.forEach((worker, index) => {
      worker.sprite.setVisible(index < effects.serverCount);
      if (facilityEffects.serverTint === undefined) worker.sprite.clearTint();
      else worker.sprite.setTint(facilityEffects.serverTint);
    });
    this.atmosphere?.setWorkerCounts(effects.chefCount, effects.serverCount);
    if (effects.finalFacilityPurchased || this.customization.isFacilityOwned("moon-sign")) {
      this.decor.setSign("moon");
    } else if (this.progression.getVisualTier() >= 3 || this.customization.isFacilityOwned("neon-set")) {
      this.decor.setSign("neon");
    } else {
      this.decor.setSign("stall");
    }
    if (celebrate) {
      this.decor.celebrate();
    }
  }

  private purchaseNextProgression(): void {
    if (this.isPaused || this.shopOverlay !== undefined || this.tutorialOverlay !== undefined || this.clearing) {
      return;
    }
    const result = this.progression.purchaseNext();
    if (!result.success) {
      this.sfx.click();
      this.upgradePanel.pulseFailure();
      this.mobileUpgradePanel?.pulse(false);
      this.toast.show("조금만 더 모아볼까요?", "warning");
      return;
    }
    this.sfx.upgrade();
    this.upgradePanel.pulseSuccess();
    this.mobileUpgradePanel?.pulse(true);
    this.hud.flashMoney(false);
    this.toast.show(`${result.purchase.name} 완성!`, "success");
    setStatus(`${result.purchase.name} 업그레이드를 구매했습니다.`);
    if (result.stageCompleted) {
      this.decor.celebrate();
    }
    this.saveProgress();
    if (result.effects.finalFacilityPurchased && !this.progression.isChapterComplete()) {
      this.toast.show("최근 서비스 평점 4.5를 채우면 완성!", "warning");
    }
    if (this.progression.isChapterComplete()) {
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
    this.hud.setFame(this.getCurrentFameBenefits().level);
    this.hud.setCustomerCount(state.customerCount);
    const fever = this.progression.getFeverState();
    this.hud.setFever(fever.level, fever.gauge, fever.activeRemainingMs);
    this.hud.setPromotion(
      this.promotionMenuId === undefined ? undefined : getMenuItem(this.promotionMenuId).name,
    );
    const nextPurchase = this.progression.getNextPurchase();
    const progressionState = this.progression.getState();
    this.upgradePanel.setProgression(nextPurchase, progressionState);
    this.mobileUpgradePanel?.setProgression(nextPurchase);
  }

  private togglePause(): void {
    if (this.tutorialOverlay !== undefined || this.clearing) {
      return;
    }
    if (this.shopOverlay !== undefined && !this.isPaused) {
      this.closeLiveShop();
      return;
    }
    if (this.isPaused) {
      this.closePauseOverlay();
    } else {
      this.openPauseOverlay();
    }
  }

  private getCurrentFameBenefits(): FameBenefits {
    return getFameBenefits(
      this.currentEffects.fameLevel,
      this.customization.getFacilityEffects().fameBonus,
    );
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
      .text(240, 94, this.getSaveStatusText(), {
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
    const soundSettings = new PixelButton(
      this,
      240,
      155,
      "사운드 설정",
      () => this.openSoundSettings(),
      { width: 126, height: 24, primary: false, fontSize: 8 },
    );
    const performance = new PixelButton(
      this,
      320,
      184,
      "성능 설정",
      () => this.openPerformanceSettings(),
      { width: 72, height: 24, primary: false, fontSize: 7 },
    );
    const shop = new PixelButton(this, 160, 184, "상점", () => this.openStyleShop(), {
      width: 72, height: 24, primary: false, fontSize: 8,
    });
    const managementInfo = new PixelButton(this, 240, 184, "명성·피버", () => this.openManagementInfo(), {
      width: 72, height: 24, primary: true, fontSize: 7,
    });
    const saveButton = new PixelButton(this, 188, 214, "지금 저장", () => {
      this.saveProgress();
      this.sfx.click();
      subtitle.setText(`저장 완료 · ${formatClockTime(this.currentSave.lastSavedAt)}`);
      this.toast.show("진행 상황을 저장했어요", "success");
      this.time.delayedCall(1_500, () => {
        if (subtitle.active) {
          subtitle.setText(this.getSaveStatusText());
        }
      });
      setStatus("게임 진행 상황을 수동으로 저장했습니다.");
    }, { width: 90, height: 22, primary: false, fontSize: 8 });
    const titleButton = new PixelButton(this, 292, 214, "타이틀로", () => {
      this.saveProgress();
      this.scene.start("MenuScene");
    }, { width: 90, height: 22, primary: false, fontSize: 8 });
    this.pauseOverlay = this.add
      .container(0, 0, [shade, panel, title, subtitle, resume, soundSettings, shop, managementInfo, performance, saveButton, titleButton])
      .setDepth(3_000);
    setStatus("게임이 일시정지되었습니다.");
  }

  private getSaveStatusText(): string {
    return `자동저장 ${SAVE_INTERVAL_MS / 1_000}초 · 마지막 ${formatClockTime(this.currentSave.lastSavedAt)}`;
  }

  private beginOpeningFlow(): void {
    if (!this.tutorialCompleted) {
      this.showTutorial();
      return;
    }
    this.time.delayedCall(350, () => this.spawnCustomer());
    setStatus("영업을 시작했습니다. 방향키로 이동하고 스페이스바로 상호작용하세요.");
  }

  private showOfflineRewardOverlay(): void {
    const reward = this.offlineReward;
    if (reward === undefined || reward.amount <= 0) {
      this.beginOpeningFlow();
      return;
    }
    this.isPaused = true;
    this.player.setFrozen(true);
    const bottleneckNames: Record<typeof reward.bottleneck, string> = {
      kitchen: "주방 조리 속도",
      service: "서빙 인력",
      seating: "좌석 회전",
      arrival: "손님 유입",
    };
    const shade = this.add.rectangle(240, 135, 480, 270, 0x080b18, 0.88);
    const panel = this.add.rectangle(240, 137, 300, 188, 0x17213a, 1)
      .setStrokeStyle(2, 0x45c6b8);
    const moon = this.add.text(240, 61, "☾", {
      fontFamily: UI_FONT,
      fontSize: "22px",
      color: "#8de6db",
    }).setOrigin(0.5);
    const title = this.add.text(240, 84, "알바생들이 영업했어요!", {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      fontSize: "14px",
      color: "#fff0bd",
    }).setOrigin(0.5);
    const amount = this.add.text(240, 111, `+${formatCompactNumber(reward.amount)}냥`, {
      fontFamily: UI_FONT,
      fontStyle: "bold",
      fontSize: "20px",
      color: "#75e1a0",
    }).setOrigin(0.5);
    const details = this.add.text(
      240,
      148,
      `${formatOfflineDuration(reward.elapsedMs)} 동안 자동 운영\n효율 ${Math.round(reward.efficiency * 100)}% · 병목: ${bottleneckNames[reward.bottleneck]}${reward.capped ? "\n최대 4시간까지만 정산했어요" : ""}`,
      {
        fontFamily: UI_FONT,
        fontSize: "8px",
        color: "#b9c5df",
        align: "center",
        lineSpacing: 3,
      },
    ).setOrigin(0.5);
    const collect = new PixelButton(this, 240, 205, "정산받고 영업 시작", () => {
      this.sfx.coin();
      this.offlineOverlay?.destroy(true);
      this.offlineOverlay = undefined;
      this.isPaused = false;
      this.player.setFrozen(false);
      this.toast.show(`오프라인 수익 +${formatCompactNumber(reward.amount)}냥`, "success");
      this.beginOpeningFlow();
    }, { width: 150, height: 27, primary: true, fontSize: 8 });
    this.offlineOverlay = this.add
      .container(0, 0, [shade, panel, moon, title, amount, details, collect])
      .setDepth(3_500);
    setStatus(`오프라인 자동 운영 수익 ${reward.amount}냥을 정산했습니다.`);
  }

  private closePauseOverlay(): void {
    this.shopOverlay?.destroy(true);
    this.shopOverlay = undefined;
    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = undefined;
    this.isPaused = false;
    this.player.setFrozen(false);
    setStatus("영업을 계속합니다.");
  }

  private beginLiveShop(): void {
    this.pauseOverlay?.destroy(true);
    this.pauseOverlay = undefined;
    this.isPaused = false;
    this.player.setFrozen(true);
    this.interactionMarker.setVisible(false);
    this.interactionText.setVisible(false);
    this.sfx.setMusicPaused(false);
    setStatus("상점을 둘러보는 동안에도 포차 영업과 음악은 계속됩니다.");
  }

  private closeLiveShop(): void {
    this.shopOverlay?.destroy(true);
    this.shopOverlay = undefined;
    this.player.setFrozen(false);
    setStatus("상점을 닫고 직접 영업으로 돌아왔습니다.");
  }

  private openStyleShop(category: AvatarCategory = "fur"): void {
    if (this.shopOverlay !== undefined) return;
    this.beginLiveShop();
    const shade = this.add.rectangle(240, 135, 480, 270, 0x070a17, 0.82);
    const panel = this.add.rectangle(240, 137, 410, 220, 0x161d35, 1).setStrokeStyle(2, 0x53d8c8);
    const header = this.add.rectangle(240, 48, 406, 38, 0x202947, 1);
    const title = this.add.text(240, 42, "MOONLIGHT WARDROBE", {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "12px", color: "#fff0bd",
    }).setOrigin(0.5);
    const subtitle = this.add.text(240, 57, "LIVE · 영업과 음악은 계속돼요 · 코스튬 즉시 적용", {
      fontFamily: UI_FONT, fontSize: "6px", color: "#9facc9",
    }).setOrigin(0.5);
    const previewGlow = this.add.circle(105, 131, 38, 0x45c6b8, 0.12).setStrokeStyle(1, 0x45c6b8, 0.45);
    const selectedStyle = this.customization.getSelected();
    const look = this.customization.getAvatarLook();
    ensureCustomizedPlayerTextures(this, look, selectedStyle.tint);
    const preview = this.add.image(
      105,
      126,
      getCustomizedPlayerTextureKey(look, selectedStyle.tint, "down", 0),
    ).setScale(2.15);
    const previewLabels = this.add.text(
      105,
      179,
      `${getAvatarPreviewName(look.hat)} · ${getAvatarPreviewName(look.apron)}\n${getAvatarPreviewName(look.accessory)}`,
      { fontFamily: UI_FONT, fontSize: "6px", color: "#b8c6df", align: "center", lineSpacing: 2 },
    ).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [shade, panel, header, title, subtitle, previewGlow, preview, previewLabels];
    if (category === "fur") {
      OWNER_STYLES.forEach((style, index) => {
        const owned = this.customization.isOwned(style.id);
        const selected = selectedStyle.id === style.id;
        const swatch = this.add.circle(166, 86 + index * 29, 6, style.tint).setStrokeStyle(1, selected ? 0xffdf72 : 0x66718f);
        const button = new PixelButton(this, 297, 86 + index * 29,
          `${style.name} · ${selected ? "장착 중" : owned ? "장착" : `${formatCompactNumber(style.cost)}냥`}`,
          () => {
            const result = this.customization.purchaseOrEquip(style.id, this.economy);
            if (result === "insufficient") return void this.toast.show("코스튬을 사기엔 돈이 부족해요", "warning");
            this.player.setOwnerTint(style.tint);
            this.refreshUi(false);
            this.saveProgress();
            this.refreshStyleShop(category);
            this.toast.show(result === "purchased" ? `${style.name} 털색 구매!` : `${style.name} 장착!`, "success");
          }, { width: 242, height: 23, primary: selected, fontSize: 7 });
        items.push(swatch, button);
      });
    } else {
      AVATAR_ITEMS.filter((item) => item.category === category).forEach((item, index) => {
        const owned = this.customization.isAvatarOwned(item.id);
        const selected = look[category] === item.id;
        const candidateLook = { ...look, [category]: item.id } as AvatarLook;
        ensureCustomizedPlayerTextures(this, candidateLook, selectedStyle.tint);
        const icon = this.add.image(
          166,
          86 + index * 29,
          getCustomizedPlayerTextureKey(candidateLook, selectedStyle.tint, "down", 0),
        ).setScale(0.72).setAlpha(selected ? 1 : 0.82);
        const button = new PixelButton(this, 297, 86 + index * 29,
          `${item.name} · ${selected ? "장착 중" : owned ? "장착" : `${formatCompactNumber(item.cost)}냥`}`,
          () => {
            const result = this.customization.purchaseOrEquipAvatarItem(item.id, this.economy);
            if (result === "insufficient") return void this.toast.show("코스튬을 사기엔 돈이 부족해요", "warning");
            this.player.setAvatarLook(this.customization.getAvatarLook());
            this.refreshUi(false);
            this.saveProgress();
            this.refreshStyleShop(category);
            this.toast.show(result === "purchased" ? `${item.name} 구매!` : `${item.name} 장착!`, "success");
          }, { width: 242, height: 23, primary: selected, fontSize: 7 });
        items.push(icon, button);
      });
    }
    const categoryLabels: readonly [AvatarCategory, string][] = [
      ["fur", "털색"], ["eyes", "눈"], ["hat", "모자"], ["apron", "앞치마"], ["accessory", "장식"],
    ];
    categoryLabels.forEach(([targetCategory, label], index) => {
      items.push(new PixelButton(this, 81 + index * 64, 225, label, () => this.refreshStyleShop(targetCategory), {
        width: 56, height: 20, primary: category === targetCategory, fontSize: 7,
      }));
    });
    items.push(new PixelButton(this, 402, 225, "시설", () => {
      this.shopOverlay?.destroy(true);
      this.shopOverlay = undefined;
      this.openFacilityShop();
    }, { width: 52, height: 20, primary: false, fontSize: 7 }));
    items.push(new PixelButton(this, 416, 43, "×", () => {
      this.closeLiveShop();
    }, { width: 24, height: 20, primary: false, fontSize: 9 }));
    this.shopOverlay = this.add.container(0, 0, items).setDepth(3_200);
  }

  private refreshStyleShop(category: AvatarCategory): void {
    this.shopOverlay?.destroy(true);
    this.shopOverlay = undefined;
    this.openStyleShop(category);
  }

  private openManagementInfo(): void {
    if (this.shopOverlay !== undefined) return;
    const fame = this.getCurrentFameBenefits();
    const fever = this.progression.getFeverBenefits();
    const shade = this.add.rectangle(240, 135, 480, 270, 0x070a17, 0.93);
    const panel = this.add.rectangle(240, 137, 370, 210, 0x171e35, 1).setStrokeStyle(2, 0x53d8c8);
    const title = this.add.text(240, 48, "명성 & FEVER", {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "15px", color: "#fff0bd",
    }).setOrigin(0.5);
    const fameTitle = this.add.text(85, 76, `명성 Lv.${fame.level}`, {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "11px", color: "#75e1d4",
    });
    const fameBody = this.add.text(85, 98,
      `결제 +${Math.round((fame.revenueMultiplier - 1) * 100)}%\nVIP ${Math.round(fame.vipChance * 100)}%\n팁 확률 +${Math.round(fame.tipChanceBonus * 100)}%\n특별 주문 ${Math.round(fame.specialOrderChance * 100)}%\n손님 ${fame.unlockedCustomerKinds.length}/4종`, {
        fontFamily: UI_FONT, fontSize: "8px", color: "#c5cee5", lineSpacing: 5,
      });
    const feverTitle = this.add.text(254, 76, fever.level === 0 ? "FEVER 잠김" : `FEVER Lv.${fever.level}`, {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "11px", color: "#ffcb72",
    });
    const feverBody = this.add.text(254, 98, fever.level === 0
      ? "9단계에서 해금돼요"
      : `매출 ×${fever.revenueMultiplier}\n조리 ×${fever.cookingSpeedMultiplier}\n직원 ×${fever.workerSpeedMultiplier}\n팁 +${Math.round(fever.tipChanceBonus * 100)}%\n지속 ${Math.round(fever.durationMs / 1_000)}초`, {
        fontFamily: UI_FONT, fontSize: "8px", color: "#c5cee5", lineSpacing: 5,
      });
    const flow = this.add.text(240, 194, "결제 → 피버 게이지 → 100% 자동 발동 · 종료 3초 전 경고", {
      fontFamily: UI_FONT, fontSize: "7px", color: "#9facc9",
    }).setOrigin(0.5);
    const close = new PixelButton(this, 240, 224, "확인", () => {
      this.shopOverlay?.destroy(true);
      this.shopOverlay = undefined;
    }, { width: 86, height: 22, primary: true, fontSize: 8 });
    this.shopOverlay = this.add.container(0, 0, [shade, panel, title, fameTitle, fameBody, feverTitle, feverBody, flow, close]).setDepth(3_200);
  }

  private openFacilityShop(category: FacilityCategory = "kitchen"): void {
    if (this.shopOverlay !== undefined) return;
    this.beginLiveShop();
    const shade = this.add.rectangle(240, 135, 480, 270, 0x070a17, 0.82);
    const panel = this.add.rectangle(240, 137, 410, 220, 0x171e35, 1).setStrokeStyle(2, 0xffb765);
    const header = this.add.rectangle(240, 48, 406, 38, 0x2d263b, 1);
    const title = this.add.text(265, 43, "MOONLIGHT SHOP", {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "13px", color: "#fff0bd",
    }).setOrigin(0.5);
    const categoryNames: Record<FacilityCategory, string> = {
      kitchen: "주방", hall: "홀", exterior: "외관", management: "운영", staff: "직원",
    };
    const subtitle = this.add.text(265, 59, `LIVE · ${categoryNames[category]} 설비는 지정 위치에 설치`, {
      fontFamily: UI_FONT, fontSize: "6px", color: "#c1adc2",
    }).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [shade, panel, header, title, subtitle];
    FACILITY_UPGRADES.filter((item) => item.category === category).forEach((item, index) => {
      const owned = this.customization.isFacilityOwned(item.id);
      const fameLevel = this.getCurrentFameBenefits().level;
      const requiredFame = getFacilityRequiredFame(item.id);
      const locked = !owned && fameLevel < requiredFame;
      const cardY = 76 + index * 31;
      const iconPanel = this.add.rectangle(102, cardY, 34, 25, owned ? 0x365a4a : 0x252d49, 1)
        .setStrokeStyle(1, owned ? 0x75d49c : 0x687494);
      const icon = this.add.image(102, cardY, `facility-${item.id}`).setScale(0.72);
      if (!owned) icon.setAlpha(0.76);
      const button = new PixelButton(this, 278, cardY,
        `${item.name}  |  ${item.effect}\n${owned ? "✓ 보유 · 설치됨" : locked ? `명성 ${requiredFame} 필요` : `${formatCompactNumber(item.cost)}냥`}`,
        () => {
          const result = this.customization.purchaseFacility(item.id, this.economy, fameLevel);
          if (result === "locked") {
            this.toast.show(`명성 ${requiredFame}에서 해금돼요`, "warning");
            return;
          }
          if (result === "insufficient") {
            this.toast.show("시설을 사기엔 돈이 부족해요", "warning");
            return;
          }
          if (result === "purchased") {
            const facilityEffects = this.customization.getFacilityEffects();
            this.applyEffects(this.currentEffects, false);
            this.decor.setShopTier(facilityEffects.visualTier);
            this.decor.setShopFacilities(this.customization.getOwnedFacilityIds());
            this.refreshUi(false);
            this.saveProgress();
            this.toast.show(`${item.name}, 지정 위치에 설치 완료!`, "success");
          }
          this.shopOverlay?.destroy(true);
          this.shopOverlay = undefined;
          this.openFacilityShop(category);
        }, { width: 300, height: 26, primary: !owned && !locked, fontSize: 7 });
      items.push(iconPanel, icon, button);
    });
    const styleShop = new PixelButton(this, 78, 43, "옷장", () => {
      this.shopOverlay?.destroy(true);
      this.shopOverlay = undefined;
      this.openStyleShop();
    }, { width: 50, height: 20, primary: false, fontSize: 7 });
    const worktops = new PixelButton(this, 138, 43, "조리대", () => {
      this.shopOverlay?.destroy(true);
      this.shopOverlay = undefined;
      this.openWorktopShop();
    }, { width: 54, height: 20, primary: false, fontSize: 7 });
    const close = new PixelButton(this, 416, 43, "×", () => {
      this.closeLiveShop();
    }, { width: 24, height: 20, primary: false, fontSize: 9 });
    (["kitchen", "hall", "exterior", "management", "staff"] as const).forEach((targetCategory, index) => {
      items.push(new PixelButton(this, 85 + index * 78, 225, categoryNames[targetCategory], () => {
        this.shopOverlay?.destroy(true);
        this.shopOverlay = undefined;
        this.openFacilityShop(targetCategory);
      }, { width: 68, height: 20, primary: category === targetCategory, fontSize: 7 }));
    });
    items.push(styleShop, worktops, close);
    this.shopOverlay = this.add.container(0, 0, items).setDepth(3_200);
  }

  private openWorktopShop(page = 0): void {
    if (this.shopOverlay !== undefined) return;
    this.beginLiveShop();
    const unlockedMenus = this.currentEffects.unlockedMenuIds;
    const pageCount = Math.max(1, Math.ceil(unlockedMenus.length / 4));
    const safePage = Phaser.Math.Clamp(page, 0, pageCount - 1);
    const visibleMenus = unlockedMenus.slice(safePage * 4, safePage * 4 + 4);
    const shade = this.add.rectangle(240, 135, 480, 270, 0x080b18, 0.82);
    const panel = this.add.rectangle(240, 137, 350, 200, 0x171e37, 1).setStrokeStyle(2, 0xffb765);
    const title = this.add.text(240, 49, "메뉴별 조리대 확장", {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "14px", color: "#fff0bd",
    }).setOrigin(0.5);
    const hint = this.add.text(240, 67, "셰프 3명 + 조리대 2칸 = 같은 메뉴 2개 동시 · 사장님 별도", {
      fontFamily: UI_FONT, fontSize: "7px", color: "#9eabc8",
    }).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [shade, panel, title, hint];
    visibleMenus.forEach((menuItemId, index) => {
      const slots = this.customization.getWorktopSlotCount(menuItemId);
      const price = this.progression.getMenuPrice(menuItemId);
      const cost = getWorktopSlotUpgradeCost(price, slots);
      const menuName = getMenuItem(menuItemId).name;
      const button = new PixelButton(
        this,
        240,
        94 + index * 31,
        slots >= 3
          ? `${menuName} · 조리대 ${slots}/3 · 최대`
          : `${menuName} · ${slots}→${slots + 1}칸 · ${formatCompactNumber(cost)}냥`,
        () => {
          const result = this.customization.purchaseWorktopSlot(menuItemId, price, this.economy);
          if (result === "insufficient") {
            this.toast.show("조리대를 늘리기엔 돈이 부족해요", "warning");
            return;
          }
          if (result === "purchased") {
            this.applyEffects(this.currentEffects, false);
            this.refreshUi(false);
            this.saveProgress();
            this.toast.show(`${menuName} 동시 조리 슬롯 확장!`, "success");
          }
          this.shopOverlay?.destroy(true);
          this.shopOverlay = undefined;
          this.openWorktopShop(safePage);
        },
        { width: 274, height: 24, primary: slots < 3, fontSize: 7 },
      );
      items.push(button);
    });
    if (pageCount > 1) {
      const previous = new PixelButton(this, 175, 218, "◀", () => {
        this.shopOverlay?.destroy(true);
        this.shopOverlay = undefined;
        this.openWorktopShop((safePage - 1 + pageCount) % pageCount);
      }, { width: 36, height: 20, primary: false, fontSize: 8 });
      const pageLabel = this.add.text(240, 218, `${safePage + 1}/${pageCount}`, {
        fontFamily: UI_FONT, fontSize: "8px", color: "#d9dfef",
      }).setOrigin(0.5);
      const next = new PixelButton(this, 305, 218, "▶", () => {
        this.shopOverlay?.destroy(true);
        this.shopOverlay = undefined;
        this.openWorktopShop((safePage + 1) % pageCount);
      }, { width: 36, height: 20, primary: false, fontSize: 8 });
      items.push(previous, pageLabel, next);
    }
    const back = new PixelButton(this, 392, 218, "시설", () => {
      this.shopOverlay?.destroy(true);
      this.shopOverlay = undefined;
      this.openFacilityShop();
    }, { width: 55, height: 20, primary: false, fontSize: 7 });
    const close = new PixelButton(this, 402, 49, "×", () => this.closeLiveShop(), {
      width: 24, height: 20, primary: false, fontSize: 9,
    });
    items.push(back, close);
    this.shopOverlay = this.add.container(0, 0, items).setDepth(3_200);
  }

  private toggleMute(): void {
    const muted = this.sfx.toggleMute();
    this.toast.show(muted ? "소리를 껐어요" : "소리를 켰어요");
    this.saveProgress();
  }

  private openSoundSettings(): void {
    if (this.shopOverlay !== undefined) return;
    const shade = this.add.rectangle(240, 135, 480, 270, 0x070a17, 0.94);
    const panel = this.add.rectangle(240, 137, 340, 218, 0x161d35, 1).setStrokeStyle(2, 0x53d8c8);
    const title = this.add.text(240, 43, "SOUND MIXER", {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "13px", color: "#fff0bd",
    }).setOrigin(0.5);
    const subtitle = this.add.text(240, 60, "배경음과 효과음을 따로 조절할 수 있어요", {
      fontFamily: UI_FONT, fontSize: "7px", color: "#9faccc",
    }).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [shade, panel, title, subtitle];

    const createVolumeRow = (
      label: string,
      y: number,
      getVolume: () => number,
      setVolume: (volume: number) => void,
      toggleMuted: () => boolean,
      isMuted: () => boolean,
    ): void => {
      const labelText = this.add.text(112, y, label, {
        fontFamily: UI_FONT, fontStyle: "bold", fontSize: "8px", color: "#d9dfef",
      }).setOrigin(0, 0.5);
      const valueText = this.add.text(252, y, `${Math.round(getVolume() * 100)}%`, {
        fontFamily: UI_FONT, fontStyle: "bold", fontSize: "8px", color: "#79e3d7",
      }).setOrigin(0.5);
      const muteButton = new PixelButton(this, 358, y, isMuted() ? "켜기" : "끄기", () => {
        const muted = toggleMuted();
        muteButton.setText(muted ? "켜기" : "끄기");
        this.saveProgress();
      }, { width: 45, height: 21, primary: false, fontSize: 7 });
      const updateVolume = (step: number): void => {
        setVolume(getVolume() + step);
        valueText.setText(`${Math.round(getVolume() * 100)}%`);
        this.sfx.click();
        this.saveProgress();
      };
      const down = new PixelButton(this, 205, y, "−", () => updateVolume(-0.1), {
        width: 30, height: 21, primary: false, fontSize: 10,
      });
      const up = new PixelButton(this, 299, y, "+", () => updateVolume(0.1), {
        width: 30, height: 21, primary: false, fontSize: 10,
      });
      items.push(labelText, valueText, down, up, muteButton);
    };

    createVolumeRow(
      "전체",
      94,
      () => this.sfx.settings.masterVolume,
      (volume) => this.sfx.setMasterVolume(volume),
      () => this.sfx.toggleMute(),
      () => this.sfx.isMuted,
    );
    createVolumeRow(
      "배경음",
      137,
      () => this.sfx.settings.musicVolume,
      (volume) => this.sfx.setMusicVolume(volume),
      () => this.sfx.toggleMusicMute(),
      () => this.sfx.settings.musicMuted,
    );
    createVolumeRow(
      "효과음",
      180,
      () => this.sfx.settings.sfxVolume,
      (volume) => this.sfx.setSfxVolume(volume),
      () => this.sfx.toggleSfxMute(),
      () => this.sfx.settings.sfxMuted,
    );
    const close = new PixelButton(this, 240, 224, "설정 완료", () => {
      this.saveProgress();
      this.shopOverlay?.destroy(true);
      this.shopOverlay = undefined;
      setStatus("사운드 설정을 저장했습니다.");
    }, { width: 100, height: 23, primary: true, fontSize: 8 });
    items.push(close);
    this.shopOverlay = this.add.container(0, 0, items).setDepth(3_300);
  }

  private openPerformanceSettings(): void {
    if (this.shopOverlay !== undefined) return;
    const shade = this.add.rectangle(240, 135, 480, 270, 0x070a17, 0.94);
    const panel = this.add.rectangle(240, 137, 368, 220, 0x161d35, 1).setStrokeStyle(2, 0x53d8c8);
    const title = this.add.text(240, 40, "PERFORMANCE", {
      fontFamily: UI_FONT, fontStyle: "bold", fontSize: "13px", color: "#fff0bd",
    }).setOrigin(0.5);
    const subtitle = this.add.text(240, 57, "화질과 배터리 사용량을 선택하세요", {
      fontFamily: UI_FONT, fontSize: "7px", color: "#9faccc",
    }).setOrigin(0.5);
    const diagnostics = this.add.text(240, 158, "", {
      fontFamily: UI_FONT, fontSize: "7px", color: "#9faccc", align: "center", lineSpacing: 2,
    }).setOrigin(0.5);
    const items: Phaser.GameObjects.GameObject[] = [shade, panel, title, subtitle, diagnostics];
    const buttons: Partial<Record<PerformanceMode, PixelButton>> = {};
    const descriptions: Record<PerformanceMode, string> = {
      quality: "60FPS · 네온/비/반사 최대",
      balanced: `${this.mobilePowerProfile ? 30 : 60}FPS · 연출 수 절감`,
      battery: "24FPS · 최소 파티클 · 반사 끔",
    };
    const refresh = (): void => {
      for (const mode of ["quality", "balanced", "battery"] as const) {
        buttons[mode]?.setEnabled(mode !== this.performanceMode);
      }
      const atmosphere = this.atmosphere.getDiagnostics();
      diagnostics.setText(
        `현재 ${getPerformanceModeLabel(this.performanceMode)} · 목표 ${this.performanceProfile.targetFps}FPS\n`
        + `조명 ${atmosphere.activeLights}/${this.performanceProfile.lightLimit} · 파티클 ${atmosphere.visibleParticles} · 반사 ${atmosphere.reflectionsEnabled ? "켜짐" : "꺼짐"}`,
      );
    };
    (["quality", "balanced", "battery"] as const).forEach((mode, index) => {
      const x = 130 + index * 110;
      const button = new PixelButton(this, x, 91, getPerformanceModeLabel(mode), () => {
        this.setPerformanceMode(mode);
        refresh();
      }, { width: 92, height: 28, primary: mode === "balanced", fontSize: 9 });
      buttons[mode] = button;
      const description = this.add.text(x, 119, descriptions[mode], {
        fontFamily: UI_FONT, fontSize: "6px", color: "#aeb8d2", align: "center", wordWrap: { width: 96 },
      }).setOrigin(0.5);
      items.push(button, description);
    });
    const motion = new PixelButton(
      this,
      240,
      190,
      this.reducedMotion ? "모션 최소화: 켜짐" : "모션 최소화: 꺼짐",
      () => {
        this.setReducedMotion(!this.reducedMotion);
        motion.setText(this.reducedMotion ? "모션 최소화: 켜짐" : "모션 최소화: 꺼짐");
        refresh();
      },
      { width: 150, height: 23, primary: false, fontSize: 7 },
    );
    const close = new PixelButton(this, 240, 225, "설정 완료", () => {
      this.saveProgress();
      this.shopOverlay?.destroy(true);
      this.shopOverlay = undefined;
      setStatus(`성능 모드를 ${getPerformanceModeLabel(this.performanceMode)}로 저장했습니다.`);
    }, { width: 100, height: 23, primary: true, fontSize: 8 });
    items.push(motion, close);
    this.shopOverlay = this.add.container(0, 0, items).setDepth(3_300);
    refresh();
  }

  private setPerformanceMode(mode: PerformanceMode): void {
    this.performanceMode = mode;
    this.performanceProfile = getPerformanceProfile(mode, this.mobilePowerProfile);
    applyGameLoopFpsLimit(this.game.loop, this.performanceProfile.targetFps);
    this.atmosphere.setPerformanceMode(mode);
    this.toast.show(
      mode === "battery" ? "절전 모드 · 배터리 사용을 줄여요" : `${getPerformanceModeLabel(mode)} 모드 적용`,
      "success",
    );
    this.saveProgress();
  }

  private setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.decor.setReducedMotion(reducedMotion);
    this.atmosphere.setReducedMotion(reducedMotion);
    const visualState = this.dayNight.getState();
    this.sfx.setAmbience(this.currentVisualPhase, reducedMotion, visualState.phaseTrackIndex, visualState.phaseElapsedMs);
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
      "주문받기 → 해당 조리대에서 직접 조리하기\n완성 음식 들기 → 서빙 → 동전 수거 순서예요.",
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
    const completedChapterId = this.progression.getChapterId();
    const chapter = getChapter(completedChapterId);
    const finalChapter = completedChapterId === 5;
    this.player.setFrozen(true);
    this.decor.setSign("moon");
    this.decor.celebrate();
    this.sfx.clear();
    this.saveProgress(finalChapter);
    this.cameras.main.flash(this.reducedMotion ? 120 : 420, 255, 221, 131, false);
    const partNames = ["기초", "장식", "불빛", "상징", "완성"] as const;
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
      .text(175, 125, `${chapter.finaleName} 완성!\nCHAPTER ${completedChapterId} COMPLETE`, {
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
      const nextChapterId = finalChapter ? undefined : this.progression.advanceChapter(state.rating);
      if (nextChapterId !== undefined) {
        this.economy.reset();
        this.currentEffects = this.progression.getEffects();
        setActiveMenuChapter(nextChapterId);
        this.customization.setActiveChapter(nextChapterId);
        this.saveProgress(false, true);
      }
      this.scene.start("ResultScene", {
        money: state.money,
        customerCount: state.customerCount,
        rating: state.rating,
        elapsedMs: this.elapsedMs,
        completedChapterId,
        nextChapterId,
      });
    });
  }

  private saveProgress(cleared = this.clearing, resetChapterWorld = false): void {
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
        ...this.sfx.settings,
        performanceMode: this.performanceMode,
        reducedMotion: this.reducedMotion,
      },
      muted: this.sfx.isMuted,
      tutorialCompleted: this.tutorialCompleted,
      playStartedAt: this.currentSave.playStartedAt,
      elapsedMs: this.elapsedMs,
      worldClockMs: resetChapterWorld ? 0 : this.dayNight.getState().worldClockMs,
      visualTier: resetChapterWorld ? 1 : this.dayNight.getState().visualTier,
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
    const facilityEffects = this.customization.getFacilityEffects();
    const totalWeight = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
    const averageQuantity = getAverageOrderQuantity(this.progression.getCurrentStage());
    const quantityProbabilities = getOrderQuantityProbabilities(this.progression.getCurrentStage());
    let averageOrderValue = 0;
    let averageCookingTimeMs = 0;
    for (const [menuItemId, weight] of weights) {
      const normalizedWeight = weight / Math.max(0.001, totalWeight);
      averageOrderValue += normalizedWeight
        * this.progression.getMenuPrice(menuItemId)
        * averageQuantity
        * facilityEffects.revenueMultiplier
        * getEffectiveFameRevenueMultiplier(effects, facilityEffects.fameBonus);
      averageCookingTimeMs += normalizedWeight
        * quantityProbabilities.reduce(
          (sum, probability, index) => sum
            + probability * this.progression.getMenuCookingTimeMs(menuItemId, index + 1),
          0,
        )
        * facilityEffects.cookingTimeMultiplier;
    }
    const averageChefActionTimeMs = averageWorkerActionTimeMs("chef", effects.chefCount)
      * effects.chefActionTimeMultiplier;
    const averageServerActionTimeMs = averageWorkerActionTimeMs("server", effects.serverCount)
      * effects.serverActionTimeMultiplier;
    const customerWeight = CUSTOMER_DATA.reduce((sum, customer) => sum + customer.spawnWeight, 0);
    const averageDiningTimeMs = CUSTOMER_DATA.reduce(
      (sum, customer) => sum + customer.eatingTimeMs * customer.spawnWeight / customerWeight,
      0,
    );
    const stageConfig = getStageConfig(this.progression.getCurrentStage());
    const reward = calculateOfflineReward({
      elapsedMs,
      averageOrderValue,
      averageCookingTimeMs,
      averageChefActionTimeMs,
      averageServerActionTimeMs,
      averageDiningTimeMs,
      averageCustomerIntervalMs: stageConfig.baseSpawnIntervalMs
        * CUSTOMER_ARRIVAL_INTERVAL_MULTIPLIER,
      seatCount: effects.seatCount + facilityEffects.bonusSeats,
      chefCount: effects.chefCount,
      serverCount: effects.serverCount,
      efficiency: calculateOfflineEfficiency(
        effects.fameLevel + facilityEffects.fameBonus,
        facilityEffects.offlineEfficiencyBonus,
      ),
    });
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

  private releaseChefIfCookingComplete(workerId: string): void {
    for (const station of this.stations.values()) {
      if (station.hasPendingCookingForChef(workerId)) return;
    }
    this.releaseChef(workerId);
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
      duration: calculateCharacterTravelDurationMs(
        worker.sprite.x,
        worker.sprite.y,
        worker.homeX,
        worker.homeY,
      ),
      ease: "Linear",
      onComplete: () => worker.sprite.setDepth(116),
    });
  }

  private releaseServer(worker: WorkerAgent): void {
    if (worker.assignedCustomerId !== undefined) {
      this.serverTargetCustomerIds.delete(worker.assignedCustomerId);
    }
    worker.busy = false;
    worker.assignedCustomerId = undefined;
    worker.assignedStationId = undefined;
    this.tweens.killTweensOf(worker.sprite);
    worker.sprite.setTexture(`server-${worker.ordinal}-0`);
    updateCharacterDepth(worker.sprite, 50);
  }

  private configureDebugApi(): void {
    if (!new URLSearchParams(window.location.search).has("debug")) {
      return;
    }
    this.debugStatusElement = document.querySelector<HTMLElement>("#status-message") ?? undefined;
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
          musicPlaybackRate: this.sfx.getMusicPlaybackRate(),
          audio: this.sfx.diagnostics,
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
            activeCount: station.getActiveCount(),
            worktopSlots: this.customization.getWorktopSlotCount(station.menuItemId),
        })),
        atmosphere: this.atmosphere.getDiagnostics(),
        performance: {
          averageFps: this.smoothedGameplayDeltaMs <= 0
            ? 0
            : Math.round(1_000 / this.smoothedGameplayDeltaMs),
          sampleCount: this.gameplayFrameCount,
          targetFps: this.performanceProfile.targetFps,
          mode: this.performanceMode,
          mobileProfile: this.mobilePowerProfile,
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
          remainingQuantity: customer.remainingQuantity,
          patienceMs: Math.round(customer.patienceMs),
          maxPatienceMs: Math.round(customer.maxPatienceMs),
          vip: customer.isVip,
          specialOrder: customer.isSpecialOrder,
        })),
      }),
      grantMoney: (amount = 10_000) => this.economy.addMoney(Math.max(0, Math.round(amount))),
      setRating: (rating = 5) => this.economy.setRating(rating),
      setWorldPhase: (phase) => {
        const state = this.dayNight.setPhase(phase);
        this.currentVisualPhase = state.phase;
        this.decor.setPhase(state.phase, true);
        this.atmosphere.setPhase(state.phase, true);
        this.sfx.setAmbience(state.phase, this.reducedMotion, state.phaseTrackIndex, state.phaseElapsedMs);
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
        if (this.progression.isChapterComplete()) {
          this.beginClearSequence();
        }
        return result.success;
      },
      setStage: (stage) => {
        this.progression.debugGrantThroughStage(stage);
        this.saveProgress();
      },
      spawnVip: () => this.spawnCustomer(true),
      spawnSpecial: () => this.spawnCustomer(false, true),
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
      setPerformanceMode: (mode) => this.setPerformanceMode(mode),
      setAppHidden: (hidden) => {
        if (hidden) {
          this.handleAppVisibilityChange(true);
          this.game.loop.sleep();
        } else {
          this.game.loop.wake();
          this.handleAppVisibilityChange(false);
        }
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

  private handleAppVisibilityChange(hidden: boolean): void {
    this.appHidden = hidden;
    this.sfx.setMusicPaused(
      hidden || this.isPaused || this.clearing,
    );
  }

  private handleShutdown(): void {
    document.body.classList.remove("gameplay-active");
    this.saveProgress(this.clearing || this.progression.isGameComplete());
    this.removeEconomyListener?.();
    this.removeProgressionListener?.();
    this.removeTouchActionListener?.();
    this.removeTouchPauseListener?.();
    this.removeTouchActionListener = undefined;
    this.removeTouchPauseListener = undefined;
    this.mobileUpgradePanel?.destroy();
    this.mobileUpgradePanel = undefined;
    touchInput.resetDirections();
    if (this.debugStatusElement !== undefined) {
      delete this.debugStatusElement.dataset.playerX;
      delete this.debugStatusElement.dataset.playerY;
      this.debugStatusElement = undefined;
    }
    this.game.events.off("app-before-unload", this.saveProgress, this);
    this.game.events.off("app-visibility-change", this.handleAppVisibilityChange, this);
    const keyboard = this.input.keyboard;
    keyboard?.off("keydown-SPACE", this.handleSpace, this);
    keyboard?.off("keydown-ESC", this.togglePause, this);
    keyboard?.off("keydown-M", this.toggleMute, this);
    this.atmosphere.destroy();
    window.__MEOW_DINER__ = undefined;
  }

  private updateDebugTelemetry(): void {
    if (this.debugStatusElement === undefined) return;
    this.debugStatusElement.dataset.playerX = this.player.x.toFixed(1);
    this.debugStatusElement.dataset.playerY = this.player.y.toFixed(1);
  }
}

type MutableTimeStep = Phaser.Core.TimeStep & {
  _limitRate: number;
  _target: number;
};

function updateCharacterDepth(
  character: Phaser.GameObjects.Image,
  baseDepth: number,
): void {
  const targetDepth = baseDepth + Math.round(character.y / 4) * 4;
  if (character.depth !== targetDepth) character.setDepth(targetDepth);
}

function applyGameLoopFpsLimit(loop: Phaser.Core.TimeStep, fps: number): void {
  const normalizedFps = Math.max(20, Math.min(60, Math.round(fps)));
  const mutable = loop as MutableTimeStep;
  loop.targetFps = normalizedFps;
  loop.fpsLimit = normalizedFps;
  loop.hasFpsLimit = true;
  mutable._target = 1_000 / normalizedFps;
  mutable._limitRate = 1_000 / normalizedFps;
}

function getRushConfig(stage: GrowthStage): RushConfig | undefined {
  return RUSH_CONFIGS[stage];
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

function averageWorkerActionTimeMs(role: WorkerRole, count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  for (let ordinal = 1; ordinal <= count; ordinal += 1) {
    total += getWorkerActionTimeMs(role, ordinal);
  }
  return total / count;
}

function getAverageOrderQuantity(stage: GrowthStage): number {
  return getOrderQuantityProbabilities(stage).reduce(
    (sum, probability, index) => sum + probability * (index + 1),
    0,
  );
}

function getOrderQuantityProbabilities(stage: GrowthStage): readonly number[] {
  const probabilities = [
    [1, 0, 0],
    [0.95, 0.05, 0],
    [0.88, 0.12, 0],
    [0.78, 0.2, 0.02],
    [0.68, 0.26, 0.06],
    [0.55, 0.35, 0.1],
  ] as const;
  return probabilities[Math.min(5, Math.floor((stage - 1) / 5))] ?? probabilities[0];
}

function getEffectiveFameRevenueMultiplier(
  effects: ProgressionEffects,
  facilityFameBonus: number,
): number {
  return getFameBenefits(effects.fameLevel, facilityFameBonus).revenueMultiplier;
}

function getAvatarPreviewName(id: string): string {
  return AVATAR_ITEMS.find((item) => item.id === id)?.name ?? "기본";
}

function formatClockTime(timestamp: number): string {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function formatOfflineDuration(elapsedMs: number): string {
  const totalMinutes = Math.max(1, Math.floor(elapsedMs / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function setStatus(message: string): void {
  const element = document.querySelector<HTMLElement>("#status-message");
  if (element !== null) {
    element.textContent = message;
  }
}
