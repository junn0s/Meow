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
  }[];
  readonly atmosphere: {
    readonly activeLights: number;
    readonly particlePoolSize: number;
    readonly visibleParticles: number;
    readonly reducedMotion: boolean;
    readonly mode: "normal" | "fever" | "rush";
  };
  readonly performance: { readonly averageFps: number; readonly sampleCount: number };
  readonly offlineReward?: { readonly elapsedMs: number; readonly amount: number; readonly capped: boolean };
  readonly player: {
    readonly x: number;
    readonly y: number;
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
    readonly patienceMs: number;
    readonly vip: boolean;
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
  setRating(rating?: number): void;
  setWorldPhase(phase: VisualPhase): void;
  setVisualTier(tier: VisualTier): void;
  setStage(stage: GrowthStage): void;
  spawnVip(): void;
  triggerRush(): boolean;
  triggerFever(): boolean;
  triggerPromotion(menuItemId?: MenuItemId): boolean;
  setReducedMotion(reducedMotion: boolean): void;
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
