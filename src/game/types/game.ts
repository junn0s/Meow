export const MENU_ITEM_IDS = [
  "fishcake",
  "tteokbokki",
  "fish-bread",
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
