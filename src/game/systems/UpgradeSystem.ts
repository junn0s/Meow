import {
  BASE_SEAT_COUNT,
  DEFAULT_PURCHASED_UPGRADE_IDS,
  UPGRADES,
} from "../data/upgradeData";
import {
  isMenuItemId,
  type MenuItemId,
  type UpgradeData,
  type UpgradeEffects,
  type UpgradeId,
  type UpgradePurchaseResult,
  type UpgradeViewState,
} from "../types/game";
import { EconomySystem } from "./EconomySystem";

export const CLEAR_RATING = 5;

export interface UpgradeSystemOptions {
  readonly upgrades?: readonly UpgradeData[];
  readonly purchasedUpgradeIds?: readonly string[];
}

export type UpgradeListener = (
  purchasedUpgradeIds: readonly UpgradeId[],
  effects: UpgradeEffects,
) => void;

export class UpgradeSystem {
  private readonly economy: EconomySystem;
  private readonly upgrades: readonly UpgradeData[];
  private readonly upgradeById: ReadonlyMap<string, UpgradeData>;
  private readonly purchasedUpgradeIds = new Set<UpgradeId>();
  private readonly listeners = new Set<UpgradeListener>();

  public constructor(
    economy: EconomySystem,
    purchasedUpgradeIds?: readonly string[],
  );
  public constructor(economy: EconomySystem, options?: UpgradeSystemOptions);
  public constructor(
    economy: EconomySystem,
    purchasedOrOptions: readonly string[] | UpgradeSystemOptions = {},
  ) {
    this.economy = economy;
    const options = isStringArray(purchasedOrOptions)
      ? { purchasedUpgradeIds: purchasedOrOptions }
      : purchasedOrOptions;
    this.upgrades = [...(options.upgrades ?? UPGRADES)].sort(
      (left, right) => left.order - right.order,
    );
    validateUpgradeDefinitions(this.upgrades);
    this.upgradeById = new Map(
      this.upgrades.map((upgrade) => [upgrade.id, upgrade]),
    );
    this.restorePurchasedUpgradeIds(
      options.purchasedUpgradeIds ?? DEFAULT_PURCHASED_UPGRADE_IDS,
      false,
    );
  }

  public getAllUpgrades(): readonly UpgradeData[] {
    return this.upgrades;
  }

  public getPurchasedUpgradeIds(): readonly UpgradeId[] {
    return this.upgrades
      .filter(({ id }) => this.purchasedUpgradeIds.has(id))
      .map(({ id }) => id);
  }

  public isPurchased(upgradeId: string): boolean {
    return isKnownUpgradeId(upgradeId, this.upgradeById)
      ? this.purchasedUpgradeIds.has(upgradeId)
      : false;
  }

  public isPrerequisiteMet(upgrade: UpgradeData): boolean {
    return (
      upgrade.prerequisiteId === undefined ||
      this.purchasedUpgradeIds.has(upgrade.prerequisiteId)
    );
  }

  public getUpgradeState(upgradeId: string): UpgradeViewState | undefined {
    const upgrade = this.upgradeById.get(upgradeId);
    return upgrade === undefined ? undefined : this.buildViewState(upgrade);
  }

  public getUpgradeStates(): readonly UpgradeViewState[] {
    return this.upgrades.map((upgrade) => this.buildViewState(upgrade));
  }

  public getNextUpgrade(): UpgradeViewState | undefined {
    const nextUpgrade = this.upgrades.find(
      (upgrade) =>
        !this.purchasedUpgradeIds.has(upgrade.id) &&
        this.isPrerequisiteMet(upgrade),
    );

    return nextUpgrade === undefined
      ? undefined
      : this.buildViewState(nextUpgrade);
  }

  public canPurchase(upgradeId: string): boolean {
    return this.getUpgradeState(upgradeId)?.canPurchase ?? false;
  }

  public purchase(upgradeId: string): UpgradePurchaseResult {
    const upgrade = this.upgradeById.get(upgradeId);

    if (upgrade === undefined) {
      return this.failure("unknown_upgrade");
    }

    if (this.purchasedUpgradeIds.has(upgrade.id)) {
      return this.failure("already_purchased", upgrade);
    }

    if (!this.isPrerequisiteMet(upgrade)) {
      return this.failure("prerequisite_not_met", upgrade);
    }

    if (!this.economy.trySpend(upgrade.cost)) {
      return this.failure("insufficient_funds", upgrade);
    }

    this.purchasedUpgradeIds.add(upgrade.id);
    const effects = this.getEffects();
    this.notify(effects);

    return {
      success: true,
      upgrade,
      remainingMoney: this.economy.getMoney(),
      effects,
    };
  }

  public purchaseNext(): UpgradePurchaseResult | undefined {
    const nextUpgrade = this.getNextUpgrade();
    return nextUpgrade === undefined
      ? undefined
      : this.purchase(nextUpgrade.upgrade.id);
  }

  public getEffects(): UpgradeEffects {
    const unlockedMenuIds: MenuItemId[] = [];
    let seatCount = BASE_SEAT_COUNT;
    let cookingTimeMultiplier = 1;
    let customerSpawnIntervalMultiplier = 1;
    let chefHired = false;
    let serverHired = false;
    let finalFacilityPurchased = false;

    for (const upgrade of this.upgrades) {
      if (!this.purchasedUpgradeIds.has(upgrade.id)) {
        continue;
      }

      switch (upgrade.effectType) {
        case "unlock_menu":
          if (
            isMenuItemId(upgrade.effectTarget) &&
            !unlockedMenuIds.includes(upgrade.effectTarget)
          ) {
            unlockedMenuIds.push(upgrade.effectTarget);
          }
          break;
        case "add_seat":
          seatCount += normalizePositiveEffect(upgrade.effectValue, 0);
          break;
        case "cooking_speed":
          cookingTimeMultiplier *= normalizePositiveEffect(
            upgrade.effectValue,
            1,
          );
          break;
        case "hire_worker":
          chefHired ||= upgrade.effectTarget === "chef";
          serverHired ||= upgrade.effectTarget === "server";
          break;
        case "customer_rate":
          customerSpawnIntervalMultiplier *= normalizePositiveEffect(
            upgrade.effectValue,
            1,
          );
          break;
        case "finish_game":
          finalFacilityPurchased = true;
          break;
      }
    }

    return {
      unlockedMenuIds,
      seatCount,
      cookingTimeMultiplier,
      customerSpawnIntervalMultiplier,
      chefHired,
      serverHired,
      finalFacilityPurchased,
    };
  }

  public isGameComplete(rating = this.economy.getRating()): boolean {
    return this.getEffects().finalFacilityPurchased && rating >= CLEAR_RATING;
  }

  public restorePurchasedUpgradeIds(
    upgradeIds: readonly string[],
    shouldNotify = true,
  ): void {
    const requestedIds = new Set(upgradeIds);
    this.purchasedUpgradeIds.clear();

    for (const upgrade of this.upgrades) {
      const isStartingUpgrade =
        upgrade.cost === 0 && upgrade.prerequisiteId === undefined;
      if (
        (isStartingUpgrade || requestedIds.has(upgrade.id)) &&
        this.isPrerequisiteMet(upgrade)
      ) {
        this.purchasedUpgradeIds.add(upgrade.id);
      }
    }

    if (shouldNotify) {
      this.notify();
    }
  }

  public subscribe(listener: UpgradeListener): () => void {
    this.listeners.add(listener);
    listener(this.getPurchasedUpgradeIds(), this.getEffects());

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Test/debug helper that grants every stage through the requested stage. */
  public debugGrantThrough(upgradeId: UpgradeId): void {
    const target = this.upgradeById.get(upgradeId);
    if (target === undefined) {
      return;
    }

    for (const upgrade of this.upgrades) {
      if (upgrade.order <= target.order) {
        this.purchasedUpgradeIds.add(upgrade.id);
      }
    }
    this.notify();
  }

  public debugGrantAll(): void {
    for (const upgrade of this.upgrades) {
      this.purchasedUpgradeIds.add(upgrade.id);
    }
    this.notify();
  }

  private buildViewState(upgrade: UpgradeData): UpgradeViewState {
    const purchased = this.purchasedUpgradeIds.has(upgrade.id);
    const prerequisiteMet = this.isPrerequisiteMet(upgrade);
    const canAfford = this.economy.canAfford(upgrade.cost);
    const canPurchase = !purchased && prerequisiteMet && canAfford;
    const status = purchased
      ? "purchased"
      : !prerequisiteMet
        ? "locked"
        : canAfford
          ? "available"
          : "unaffordable";

    return {
      upgrade,
      status,
      purchased,
      prerequisiteMet,
      canAfford,
      canPurchase,
    };
  }

  private failure(
    reason:
      | "unknown_upgrade"
      | "already_purchased"
      | "prerequisite_not_met"
      | "insufficient_funds",
    upgrade?: UpgradeData,
  ): UpgradePurchaseResult {
    return {
      success: false,
      reason,
      upgrade,
      remainingMoney: this.economy.getMoney(),
      effects: this.getEffects(),
    };
  }

  private notify(effects = this.getEffects()): void {
    const purchasedIds = this.getPurchasedUpgradeIds();
    for (const listener of this.listeners) {
      try {
        listener(purchasedIds, effects);
      } catch {
        // A scene listener must never invalidate an already-completed purchase.
      }
    }
  }
}

function isStringArray(
  value: readonly string[] | UpgradeSystemOptions,
): value is readonly string[] {
  return Array.isArray(value);
}

function isKnownUpgradeId(
  value: string,
  upgrades: ReadonlyMap<string, UpgradeData>,
): value is UpgradeId {
  return upgrades.has(value);
}

function normalizePositiveEffect(
  effectValue: number | undefined,
  fallback: number,
): number {
  return effectValue !== undefined &&
    Number.isFinite(effectValue) &&
    effectValue >= 0
    ? effectValue
    : fallback;
}

function validateUpgradeDefinitions(upgrades: readonly UpgradeData[]): void {
  const ids = new Set<UpgradeId>();
  const orders = new Set<number>();

  for (const upgrade of upgrades) {
    if (ids.has(upgrade.id)) {
      throw new Error(`Duplicate upgrade id: ${upgrade.id}`);
    }
    if (orders.has(upgrade.order)) {
      throw new Error(`Duplicate upgrade order: ${upgrade.order}`);
    }
    if (!Number.isInteger(upgrade.cost) || upgrade.cost < 0) {
      throw new Error(`Invalid cost for upgrade: ${upgrade.id}`);
    }
    if (
      upgrade.prerequisiteId !== undefined &&
      !ids.has(upgrade.prerequisiteId)
    ) {
      throw new Error(
        `Upgrade ${upgrade.id} must follow its declared prerequisite.`,
      );
    }

    ids.add(upgrade.id);
    orders.add(upgrade.order);
  }
}
