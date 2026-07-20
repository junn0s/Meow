import type {
  EconomyState,
  GrowthStage,
  MenuItemId,
  ProgressionEffects,
  ProgressionState,
  UpgradeId,
  VisualPhase,
  VisualTier,
  WorldVisualState,
} from "./game/types/game";

export interface MeowDinerDebugState {
  readonly economy: EconomyState;
  readonly effects: ProgressionEffects;
  readonly purchasedUpgradeIds: readonly UpgradeId[];
  readonly progression: ProgressionState;
  readonly activeCustomers: number;
  readonly pendingPayments: number;
  readonly visual: WorldVisualState;
  readonly service: {
    readonly comboCount: number;
    readonly consecutiveWalkouts: number;
    readonly safetySlowdownRemainingMs: number;
    readonly rushCountdownMs: number;
    readonly rushRemainingMs: number;
    readonly fever: ProgressionState["feverState"];
    readonly feverMultiplier: number;
    readonly musicPlaybackRate: number;
    readonly audio: {
      readonly context?: VisualPhase | "menu";
      readonly trackIndex: number;
      readonly paused: boolean;
      readonly feverLayerActive: boolean;
      readonly playbackRate: number;
      readonly currentTimeSeconds: number;
      readonly settings: {
        readonly masterVolume: number;
        readonly musicVolume: number;
        readonly sfxVolume: number;
        readonly muted: boolean;
        readonly musicMuted: boolean;
        readonly sfxMuted: boolean;
      };
    };
    readonly promotionMenuId?: MenuItemId;
    readonly promotionRemainingMs: number;
    readonly tickets: {
      readonly accepted: number;
      readonly completed: number;
      readonly served: number;
      readonly cancelled: number;
      readonly wasted: number;
      readonly duplicateServices: number;
    };
  };
  readonly workers: {
    readonly chefs: readonly DebugWorkerState[];
    readonly servers: readonly DebugWorkerState[];
  };
  readonly stations: readonly {
    readonly menuItemId: MenuItemId;
    readonly queued: number;
    readonly ready: number;
    readonly active: boolean;
    readonly activeCount: number;
    readonly worktopSlots: number;
  }[];
  readonly atmosphere: {
    readonly activeLights: number;
    readonly particlePoolSize: number;
    readonly visibleParticles: number;
    readonly reducedMotion: boolean;
    readonly mode: "normal" | "fever" | "rush";
    readonly lowPowerMode: boolean;
    readonly performanceMode: "quality" | "balanced" | "battery";
    readonly updateIntervalMs: number;
    readonly reflectionsEnabled: boolean;
  };
  readonly performance: {
    readonly averageFps: number;
    readonly sampleCount: number;
    readonly targetFps: number;
    readonly mode: "quality" | "balanced" | "battery";
    readonly mobileProfile: boolean;
  };
  readonly offlineReward?: { readonly elapsedMs: number; readonly amount: number; readonly capped: boolean };
  readonly player: {
    readonly x: number;
    readonly y: number;
    readonly movementSpeedMultiplier: number;
    readonly carrying?: string;
    readonly carryingQuantity: number;
  };
  readonly customers: readonly {
    readonly id: string;
    readonly state: string;
    readonly x: number;
    readonly y: number;
    readonly orderId?: string;
    readonly quantity: number;
    readonly remainingQuantity: number;
    readonly patienceMs: number;
    readonly maxPatienceMs: number;
    readonly vip: boolean;
    readonly specialOrder: boolean;
  }[];
}

interface DebugWorkerState {
  readonly id: string;
  readonly ordinal: number;
  readonly busy: boolean;
  readonly customerId?: string;
  readonly stationId?: MenuItemId;
}

export interface MeowDinerDebugApi {
  getState(): MeowDinerDebugState;
  grantMoney(amount?: number): void;
  toggleInfiniteMoney(): boolean;
  setRating(rating?: number): void;
  setWorldPhase(phase: VisualPhase): void;
  setVisualTier(tier: VisualTier): void;
  setStage(stage: GrowthStage): void;
  spawnVip(): void;
  spawnSpecial(): void;
  triggerRush(): boolean;
  triggerFever(): boolean;
  triggerPromotion(menuItemId?: MenuItemId): boolean;
  setReducedMotion(reducedMotion: boolean): void;
  setPerformanceMode(mode: "quality" | "balanced" | "battery"): void;
  setAppHidden(hidden: boolean): void;
  purchaseNext(): boolean;
  skipTutorial(): void;
  setPlayerPosition(x: number, y: number): void;
  interact(): void;
}

declare global {
  interface Window {
    __MEOW_DINER__?: MeowDinerDebugApi;
  }
}
