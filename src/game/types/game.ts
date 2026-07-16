export const MENU_ITEM_IDS = [
  "fishcake",
  "tteokbokki",
  "fish-bread",
  "ramen",
  "moon-skewer",
  "moonlight-set",
] as const;

export type MenuItemId = (typeof MENU_ITEM_IDS)[number];

export const UPGRADE_IDS = [
  "fishcake-counter",
  "add-seat-1",
  "fast-pot",
  "unlock-tteokbokki",
  "hire-chef",
  "add-table",
  "unlock-fish-bread",
  "hire-server",
  "neon-sign",
  "moonlight-sign",
] as const;

export type UpgradeId = (typeof UPGRADE_IDS)[number];

export const CUSTOMER_KINDS = [
  "rabbit",
  "dog",
  "hamster",
  "raccoon",
] as const;

export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

export enum CustomerState {
  ENTERING = "ENTERING",
  WAITING_FOR_SEAT = "WAITING_FOR_SEAT",
  MOVING_TO_SEAT = "MOVING_TO_SEAT",
  ORDERING = "ORDERING",
  WAITING_FOR_FOOD = "WAITING_FOR_FOOD",
  EATING = "EATING",
  PAYING = "PAYING",
  LEAVING = "LEAVING",
}

export type SatisfactionLevel =
  | "very_satisfied"
  | "satisfied"
  | "neutral"
  | "dissatisfied"
  | "very_dissatisfied";

export interface MenuItem {
  readonly id: MenuItemId;
  readonly name: string;
  readonly cookingTimeMs: number;
  readonly price: number;
  readonly unlockUpgradeId?: UpgradeId;
}

export type WorkerRole = "chef" | "server";

export const GROWTH_STAGES = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
] as const;

export type GrowthStage = (typeof GROWTH_STAGES)[number];
export type VisualPhase = "day" | "sunset" | "night" | "dawn";
export type VisualTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface StageConfig {
  readonly stage: GrowthStage;
  readonly targetDurationSeconds: number;
  readonly keyUpgrade: string;
  readonly startRevenuePerSecond: number;
  readonly exitRevenuePerSecond: number;
  readonly totalBudget: number;
  readonly purchaseCosts: readonly number[];
  readonly baseSpawnIntervalMs: number;
  readonly basePatienceMs: number;
  readonly seatCount: number;
  readonly chefCount: number;
  readonly serverCount: number;
  readonly targetUtilization: readonly [number, number];
  readonly targetSuccessRate: readonly [number, number];
  readonly visualTier: VisualTier;
}

export interface EconomyConfig {
  readonly worktopCostGrowth: number;
  readonly worktopPriceGrowth: number;
  readonly worktopMaxLevel: number;
  readonly priceMilestoneLevels: readonly number[];
  readonly priceMilestoneMultiplier: number;
  readonly cookingSpeedPerLevel: number;
  readonly minimumCookingTimeRatio: number;
  readonly extraItemCookingTimeRatio: number;
}

export interface MenuProgress {
  readonly menuItemId: MenuItemId;
  readonly unlocked: boolean;
  readonly priceLevel: number;
  readonly speedLevel: number;
  readonly specialMultiplier: number;
}

export interface WorkerProgress {
  readonly chefCount: number;
  readonly serverCount: number;
  readonly chefSpeedLevel: number;
  readonly serverSpeedLevel: number;
}

export interface FeverState {
  readonly level: 0 | 1 | 2 | 3;
  readonly gauge: number;
  readonly activeRemainingMs: number;
  readonly cooldownRemainingMs: number;
}

export interface ProgressionState {
  readonly currentStage: GrowthStage;
  readonly purchasedStepCount: number;
  readonly menuProgress: readonly MenuProgress[];
  readonly workerProgress: WorkerProgress;
  readonly feverState: FeverState;
  readonly finaleRevenueMultiplier: number;
}

export type ProgressionPurchaseEffect =
  | "menu_price"
  | "menu_speed"
  | "service_flow"
  | "decor"
  | "stage_key"
  | "finale_part";

export interface ProgressionPurchaseData {
  readonly stage: GrowthStage;
  readonly step: number;
  readonly stepCount: number;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly effect: ProgressionPurchaseEffect;
  readonly targetMenuItemId?: MenuItemId;
}

export interface ProgressionPurchaseView {
  readonly purchase: ProgressionPurchaseData;
  readonly canAfford: boolean;
  readonly canPurchase: boolean;
  readonly chapter: VisualTier;
  readonly overallProgress: number;
}

export interface ProgressionEffects {
  readonly unlockedMenuIds: readonly MenuItemId[];
  readonly seatCount: number;
  readonly cookingTimeMultiplier: number;
  readonly customerSpawnIntervalMultiplier: number;
  readonly chefCount: number;
  readonly serverCount: number;
  readonly chefHired: boolean;
  readonly serverHired: boolean;
  readonly feverLevel: 0 | 1 | 2 | 3;
  readonly vipUnlocked: boolean;
  readonly rushUnlocked: boolean;
  readonly finalFacilityPurchased: boolean;
}

export interface ProgressionPurchaseSuccess {
  readonly success: true;
  readonly purchase: ProgressionPurchaseData;
  readonly state: ProgressionState;
  readonly effects: ProgressionEffects;
  readonly remainingMoney: number;
  readonly stageCompleted: boolean;
}

export interface ProgressionPurchaseFailure {
  readonly success: false;
  readonly reason: "complete" | "insufficient_funds";
  readonly state: ProgressionState;
  readonly effects: ProgressionEffects;
  readonly remainingMoney: number;
}

export type ProgressionPurchaseResult =
  | ProgressionPurchaseSuccess
  | ProgressionPurchaseFailure;

export interface WorldVisualState {
  readonly worldClockMs: number;
  readonly phase: VisualPhase;
  readonly nextPhase: VisualPhase;
  readonly phaseProgress: number;
  readonly phaseRemainingMs: number;
  readonly visualTier: VisualTier;
}

export type UpgradeEffectType =
  | "unlock_menu"
  | "add_seat"
  | "cooking_speed"
  | "hire_worker"
  | "customer_rate"
  | "finish_game";

export interface UpgradeData {
  readonly id: UpgradeId;
  readonly order: number;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly prerequisiteId?: UpgradeId;
  readonly effectType: UpgradeEffectType;
  readonly effectValue?: number;
  readonly effectTarget?: MenuItemId | WorkerRole;
}

export interface CustomerData {
  readonly id: CustomerKind;
  readonly name: string;
  readonly emoji: string;
  /** RGB color used by placeholder renderers. */
  readonly color: number;
  readonly preferredMenuId?: MenuItemId;
  readonly patienceMs: number;
  readonly eatingTimeMs: number;
  readonly tipChance: number;
  readonly spawnWeight: number;
  readonly maxOrderQuantity: number;
}

export interface EconomyState {
  readonly money: number;
  readonly customerCount: number;
  readonly rating: number;
}

export interface SaleResult {
  readonly subtotal: number;
  readonly baseAmount: number;
  readonly tipAmount: number;
  readonly totalAmount: number;
  readonly moneyAfterSale: number;
  readonly customerCount: number;
  readonly rating: number;
}

export type UpgradeStatus =
  | "locked"
  | "unaffordable"
  | "available"
  | "purchased";

export interface UpgradeViewState {
  readonly upgrade: UpgradeData;
  readonly status: UpgradeStatus;
  readonly purchased: boolean;
  readonly prerequisiteMet: boolean;
  readonly canAfford: boolean;
  readonly canPurchase: boolean;
}

export interface UpgradeEffects {
  readonly unlockedMenuIds: readonly MenuItemId[];
  /** Total seats, including the two seats available at the beginning. */
  readonly seatCount: number;
  /** Multiply a menu's cooking time by this value. Lower is faster. */
  readonly cookingTimeMultiplier: number;
  /** Multiply the base spawn interval by this value. Lower is faster. */
  readonly customerSpawnIntervalMultiplier: number;
  readonly chefHired: boolean;
  readonly serverHired: boolean;
  readonly finalFacilityPurchased: boolean;
}

export type UpgradePurchaseFailureReason =
  | "unknown_upgrade"
  | "already_purchased"
  | "prerequisite_not_met"
  | "insufficient_funds";

export interface UpgradePurchaseSuccess {
  readonly success: true;
  readonly upgrade: UpgradeData;
  readonly remainingMoney: number;
  readonly effects: UpgradeEffects;
}

export interface UpgradePurchaseFailure {
  readonly success: false;
  readonly reason: UpgradePurchaseFailureReason;
  readonly upgrade?: UpgradeData;
  readonly remainingMoney: number;
  readonly effects: UpgradeEffects;
}

export type UpgradePurchaseResult =
  | UpgradePurchaseSuccess
  | UpgradePurchaseFailure;

export interface GameSettings {
  readonly masterVolume: number;
  readonly musicVolume: number;
  readonly sfxVolume: number;
  readonly muted: boolean;
  readonly reducedMotion: boolean;
}

export interface SaveData {
  readonly version: number;
  readonly money: number;
  readonly purchasedUpgradeIds: UpgradeId[];
  readonly customerCount: number;
  readonly rating: number;
  readonly settings: GameSettings;
  /** Mirrors settings.muted for compatibility with lightweight UI consumers. */
  readonly muted: boolean;
  readonly tutorialCompleted: boolean;
  readonly playStartedAt: number;
  /** Active in-game time only; menus and offline time are excluded. */
  readonly elapsedMs: number;
  /** Active-play day/night clock. Pauses and offline time never advance it. */
  readonly worldClockMs: number;
  readonly visualTier: VisualTier;
  readonly progression: ProgressionState;
  readonly cleared: boolean;
  readonly lastSavedAt: number;
}

export interface SaveDataInput {
  readonly money: number;
  readonly purchasedUpgradeIds: readonly UpgradeId[];
  readonly customerCount: number;
  readonly rating: number;
  readonly settings?: GameSettings;
  readonly muted?: boolean;
  readonly tutorialCompleted?: boolean;
  readonly playStartedAt?: number;
  readonly elapsedMs?: number;
  readonly worldClockMs?: number;
  readonly visualTier?: VisualTier;
  readonly progression?: ProgressionState;
  readonly cleared?: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isMenuItemId(value: unknown): value is MenuItemId {
  return (
    typeof value === "string" &&
    MENU_ITEM_IDS.some((menuItemId) => menuItemId === value)
  );
}

export function isUpgradeId(value: unknown): value is UpgradeId {
  return (
    typeof value === "string" &&
    UPGRADE_IDS.some((upgradeId) => upgradeId === value)
  );
}
