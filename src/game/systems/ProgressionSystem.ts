import {
  createDefaultProgressionState,
  getStageConfig,
  MENU_PROGRESSION_CONFIGS,
  stageToVisualTier,
  STAGE_CONFIGS,
} from "../data/progressionData";
import {
  getCookingTimeMs,
  getMenuPrice as calculateMenuPrice,
} from "../economy/economyMath";
import {
  type FeverState,
  type GrowthStage,
  type MenuItemId,
  type MenuProgress,
  type ProgressionEffects,
  type ProgressionPurchaseData,
  type ProgressionPurchaseResult,
  type ProgressionPurchaseView,
  type ProgressionState,
  type VisualTier,
  type WorkerProgress,
} from "../types/game";
import { EconomySystem } from "./EconomySystem";

export const PROGRESSION_CLEAR_RATING = 4.5;

const FEVER_DURATIONS_MS = [0, 15_000, 18_000, 20_000] as const;
const FEVER_COOLDOWNS_MS = [0, 18_000, 16_000, 14_000] as const;
const FEVER_REVENUE_MULTIPLIERS = [1, 1.5, 1.65, 1.8] as const;

const GENERIC_EFFECTS = [
  { effect: "menu_price", name: "주력 메뉴 가격 I", description: "표시 단가를 올려 주문 한 건의 가치를 키웁니다." },
  { effect: "menu_speed", name: "조리대 속도", description: "주력 메뉴 조리시간을 10% 단축합니다." },
  { effect: "menu_price", name: "주력 메뉴 가격 II", description: "재료를 개선해 표시 단가를 한 단계 올립니다." },
  { effect: "service_flow", name: "포차 동선 정비", description: "주문·조리 동선과 회전 효율을 같이 개선합니다." },
  { effect: "decor", name: "포차 꾸미기", description: "가게 외형을 키우고 메뉴 명성 효과를 올립니다." },
] as const;

const MENU_SPECIALS = new Map<GrowthStage, { menuItemId: MenuItemId; multiplier: number }>([
  [5, { menuItemId: "fishcake", multiplier: 1.5 }],
  [10, { menuItemId: "tteokbokki", multiplier: 1.75 }],
  [15, { menuItemId: "fish-bread", multiplier: 2 }],
  [20, { menuItemId: "ramen", multiplier: 2.25 }],
  [25, { menuItemId: "moon-skewer", multiplier: 2.5 }],
]);

const MENU_UNLOCKS = new Map<GrowthStage, MenuItemId>([
  [6, "tteokbokki"],
  [11, "fish-bread"],
  [16, "ramen"],
  [21, "moon-skewer"],
  [26, "moonlight-set"],
]);

export type ProgressionListener = (
  state: ProgressionState,
  effects: ProgressionEffects,
) => void;

export class ProgressionSystem {
  private state: ProgressionState;
  private readonly listeners = new Set<ProgressionListener>();

  public constructor(
    private readonly economy: EconomySystem,
    initialState: ProgressionState = createDefaultProgressionState(),
  ) {
    this.state = repairProgressionState(initialState);
  }

  public getState(): ProgressionState {
    return cloneState(this.state);
  }

  public getCurrentStage(): GrowthStage {
    return this.state.currentStage;
  }

  public getVisualTier(): VisualTier {
    return stageToVisualTier(this.state.currentStage);
  }

  public getNextPurchase(): ProgressionPurchaseView | undefined {
    if (this.isFinalFacilityPurchased()) {
      return undefined;
    }
    const purchase = buildPurchase(this.state);
    const canAfford = this.economy.canAfford(purchase.cost);
    return {
      purchase,
      canAfford,
      canPurchase: canAfford,
      chapter: stageToVisualTier(this.state.currentStage),
      overallProgress: getOverallProgress(this.state),
    };
  }

  public purchaseNext(): ProgressionPurchaseResult {
    const view = this.getNextPurchase();
    if (view === undefined) {
      return this.failure("complete");
    }
    if (!this.economy.trySpend(view.purchase.cost)) {
      return this.failure("insufficient_funds");
    }
    const stageBefore = this.state.currentStage;
    this.applyPurchase(view.purchase);
    const stageCompleted = this.state.currentStage !== stageBefore || this.isFinalFacilityPurchased();
    const effects = this.getEffects();
    this.notify(effects);
    return {
      success: true,
      purchase: view.purchase,
      state: this.getState(),
      effects,
      remainingMoney: this.economy.getMoney(),
      stageCompleted,
    };
  }

  public getEffects(): ProgressionEffects {
    const completedStage = getCompletedStage(this.state);
    const completedConfig = completedStage > 0
      ? STAGE_CONFIGS[completedStage - 1]
      : undefined;
    const cookingTimeMultiplier = (completedStage >= 3 ? 0.85 : 1)
      * (completedStage >= 17 ? 0.82 : 1);
    const unlockedMenuIds = this.state.menuProgress
      .filter((menu) => menu.unlocked)
      .map((menu) => menu.menuItemId);
    return {
      unlockedMenuIds,
      seatCount: completedConfig?.seatCount ?? 2,
      cookingTimeMultiplier,
      customerSpawnIntervalMultiplier: 1,
      chefCount: this.state.workerProgress.chefCount,
      serverCount: this.state.workerProgress.serverCount,
      chefHired: this.state.workerProgress.chefCount > 0,
      serverHired: this.state.workerProgress.serverCount > 0,
      feverLevel: this.state.feverState.level,
      vipUnlocked: completedStage >= 23,
      rushUnlocked: completedStage >= 25,
      finalFacilityPurchased: this.isFinalFacilityPurchased(),
    };
  }

  public getMenuPrice(menuItemId: MenuItemId): number {
    const config = MENU_PROGRESSION_CONFIGS.find((menu) => menu.menuItemId === menuItemId);
    const progress = this.state.menuProgress.find((menu) => menu.menuItemId === menuItemId);
    if (config === undefined || progress === undefined) {
      throw new RangeError(`Unknown progression menu: ${menuItemId}`);
    }
    return calculateMenuPrice(
      config.basePrice,
      Math.max(1, progress.priceLevel),
      progress.specialMultiplier,
      this.state.finaleRevenueMultiplier,
    );
  }

  public getMenuCookingTimeMs(menuItemId: MenuItemId, quantity = 1): number {
    const config = MENU_PROGRESSION_CONFIGS.find((menu) => menu.menuItemId === menuItemId);
    const progress = this.state.menuProgress.find((menu) => menu.menuItemId === menuItemId);
    if (config === undefined || progress === undefined) {
      throw new RangeError(`Unknown progression menu: ${menuItemId}`);
    }
    return getCookingTimeMs(
      config.baseCookingTimeMs,
      progress.speedLevel,
      this.getEffects().cookingTimeMultiplier,
      quantity,
    );
  }

  public getMenuOrderWeights(): ReadonlyMap<MenuItemId, number> {
    const unlocked = MENU_PROGRESSION_CONFIGS.filter((menu) =>
      this.state.menuProgress.some(
        (progress) => progress.menuItemId === menu.menuItemId && progress.unlocked,
      ));
    const finalWeights = [
      [1],
      [0.65, 0.35],
      [0.45, 0.25, 0.3],
      [0.32, 0.18, 0.2, 0.3],
      [0.24, 0.13, 0.15, 0.18, 0.3],
      [0.18, 0.1, 0.12, 0.13, 0.17, 0.3],
    ][unlocked.length - 1] ?? [1];
    if (unlocked.length <= 1) {
      return new Map([["fishcake", 1]]);
    }
    const newest = unlocked[unlocked.length - 1];
    if (newest === undefined) {
      return new Map([["fishcake", 1]]);
    }
    const maturity = Math.min(1, Math.max(0, (this.state.currentStage - newest.unlockStage) / 4));
    const finalNewestWeight = finalWeights[finalWeights.length - 1] ?? 0.3;
    const newestWeight = 0.18 + (finalNewestWeight - 0.18) * maturity;
    const earlierFinalTotal = finalWeights
      .slice(0, -1)
      .reduce((sum, weight) => sum + weight, 0);
    return new Map(unlocked.map((menu, index) => {
      if (index === unlocked.length - 1) {
        return [menu.menuItemId, newestWeight];
      }
      const relative = (finalWeights[index] ?? 0) / Math.max(0.0001, earlierFinalTotal);
      return [menu.menuItemId, relative * (1 - newestWeight)];
    }));
  }

  public getFeverState(): FeverState {
    return { ...this.state.feverState };
  }

  public getFeverRevenueMultiplier(): number {
    const fever = this.state.feverState;
    return fever.activeRemainingMs > 0
      ? FEVER_REVENUE_MULTIPLIERS[fever.level]
      : 1;
  }

  /** Advances only active-play fever timers; menus, pauses and offline time do not count. */
  public updateFever(deltaMs: number): { activated: boolean; ended: boolean } {
    const elapsed = Math.max(0, deltaMs);
    const previous = this.state.feverState;
    let activeRemainingMs = Math.max(0, previous.activeRemainingMs - elapsed);
    let cooldownRemainingMs = previous.cooldownRemainingMs;
    const ended = previous.activeRemainingMs > 0 && activeRemainingMs === 0;
    if (ended) {
      cooldownRemainingMs = FEVER_COOLDOWNS_MS[previous.level];
    } else if (activeRemainingMs === 0) {
      cooldownRemainingMs = Math.max(0, cooldownRemainingMs - elapsed);
    }
    this.state = {
      ...this.state,
      feverState: { ...previous, activeRemainingMs, cooldownRemainingMs },
    };
    return { activated: false, ended };
  }

  /** Successful payments fill a deterministic gauge and automatically start fever at 100. */
  public addFeverGauge(amount: number): { activated: boolean; state: FeverState } {
    const previous = this.state.feverState;
    if (
      previous.level === 0
      || previous.activeRemainingMs > 0
      || previous.cooldownRemainingMs > 0
    ) {
      return { activated: false, state: { ...previous } };
    }
    const gauge = Math.min(100, previous.gauge + Math.max(0, amount));
    const activated = gauge >= 100;
    const feverState: FeverState = activated
      ? {
          ...previous,
          gauge: 0,
          activeRemainingMs: FEVER_DURATIONS_MS[previous.level],
          cooldownRemainingMs: 0,
        }
      : { ...previous, gauge };
    this.state = { ...this.state, feverState };
    return { activated, state: { ...feverState } };
  }

  public debugTriggerFever(): boolean {
    const fever = this.state.feverState;
    if (fever.level === 0) {
      return false;
    }
    this.state = {
      ...this.state,
      feverState: {
        ...fever,
        gauge: 0,
        activeRemainingMs: FEVER_DURATIONS_MS[fever.level],
        cooldownRemainingMs: 0,
      },
    };
    return true;
  }

  public isFinalFacilityPurchased(): boolean {
    return this.state.currentStage === 30
      && this.state.purchasedStepCount >= getStageConfig(30).purchaseCosts.length;
  }

  public isGameComplete(rating = this.economy.getRating()): boolean {
    return this.isFinalFacilityPurchased() && rating >= PROGRESSION_CLEAR_RATING;
  }

  public subscribe(listener: ProgressionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState(), this.getEffects());
    return () => this.listeners.delete(listener);
  }

  public debugGrantThroughStage(targetStage: GrowthStage): void {
    this.state = createDefaultProgressionState();
    while (
      !this.isFinalFacilityPurchased()
      && (this.state.currentStage < targetStage || targetStage === 30)
    ) {
      const purchase = buildPurchase(this.state);
      this.applyPurchase(purchase);
      if (targetStage < 30 && this.state.currentStage === targetStage) {
        break;
      }
    }
    this.notify();
  }

  public debugCompleteNextPurchase(): boolean {
    const view = this.getNextPurchase();
    if (view === undefined) {
      return false;
    }
    this.applyPurchase(view.purchase);
    this.notify();
    return true;
  }

  private applyPurchase(purchase: ProgressionPurchaseData): void {
    let menuProgress = this.state.menuProgress.map((menu) => ({ ...menu }));
    let workerProgress = { ...this.state.workerProgress };
    let feverState = { ...this.state.feverState };
    let finaleRevenueMultiplier = this.state.finaleRevenueMultiplier;

    if (purchase.effect === "finale_part") {
      finaleRevenueMultiplier *= 1.12;
    } else if (purchase.effect === "stage_key") {
      ({ menuProgress, workerProgress, feverState } = applyStageKey(
        purchase.stage,
        menuProgress,
        workerProgress,
        feverState,
      ));
    } else if (purchase.targetMenuItemId !== undefined) {
      menuProgress = menuProgress.map((menu) => {
        if (menu.menuItemId !== purchase.targetMenuItemId) {
          return menu;
        }
        if (purchase.effect === "menu_speed") {
          return { ...menu, speedLevel: menu.speedLevel + 1 };
        }
        const priceLevels = purchase.effect === "decor" ? 2 : 1;
        return { ...menu, priceLevel: menu.priceLevel + priceLevels };
      });
    }

    const config = getStageConfig(this.state.currentStage);
    const nextStepCount = this.state.purchasedStepCount + 1;
    const stageFinished = nextStepCount >= config.purchaseCosts.length;
    this.state = {
      currentStage: stageFinished && this.state.currentStage < 30
        ? (this.state.currentStage + 1) as GrowthStage
        : this.state.currentStage,
      purchasedStepCount: stageFinished && this.state.currentStage < 30 ? 0 : nextStepCount,
      menuProgress,
      workerProgress,
      feverState,
      finaleRevenueMultiplier,
    };
  }

  private failure(reason: "complete" | "insufficient_funds"): ProgressionPurchaseResult {
    return {
      success: false,
      reason,
      state: this.getState(),
      effects: this.getEffects(),
      remainingMoney: this.economy.getMoney(),
    };
  }

  private notify(effects = this.getEffects()): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state, effects);
      } catch {
        // A visual listener cannot roll back a completed purchase.
      }
    }
  }
}

function buildPurchase(state: ProgressionState): ProgressionPurchaseData {
  const config = getStageConfig(state.currentStage);
  const step = state.purchasedStepCount + 1;
  const stepCount = config.purchaseCosts.length;
  const cost = config.purchaseCosts[state.purchasedStepCount];
  if (cost === undefined) {
    throw new RangeError(`Stage ${state.currentStage} has no purchase step ${step}.`);
  }
  const activeMenu = [...state.menuProgress].reverse().find((menu) => menu.unlocked)
    ?? state.menuProgress[0];

  if (state.currentStage === 30) {
    return {
      stage: 30,
      step,
      stepCount,
      name: `달빛 간판 부품 ${step}`,
      description: `달빛 간판의 ${step}/5 부품을 켜고 전체 수익을 12% 올립니다.`,
      cost,
      effect: "finale_part",
    };
  }

  if (step === stepCount) {
    return {
      stage: state.currentStage,
      step,
      stepCount,
      name: config.keyUpgrade,
      description: `${state.currentStage}단계의 핵심 확장을 완성하고 다음 단계를 엽니다.`,
      cost,
      effect: "stage_key",
      targetMenuItemId: activeMenu?.menuItemId,
    };
  }

  const generic = GENERIC_EFFECTS[state.purchasedStepCount] ?? GENERIC_EFFECTS[0];
  return {
    stage: state.currentStage,
    step,
    stepCount,
    name: generic.name,
    description: generic.description,
    cost,
    effect: generic.effect,
    targetMenuItemId: activeMenu?.menuItemId,
  };
}

function applyStageKey(
  stage: GrowthStage,
  menuProgress: MenuProgress[],
  workerProgress: WorkerProgress,
  feverState: FeverState,
): { menuProgress: MenuProgress[]; workerProgress: WorkerProgress; feverState: FeverState } {
  const unlock = MENU_UNLOCKS.get(stage);
  if (unlock !== undefined) {
    menuProgress = menuProgress.map((menu) => menu.menuItemId === unlock
      ? { ...menu, unlocked: true, priceLevel: Math.max(1, menu.priceLevel) }
      : menu);
  }
  const special = MENU_SPECIALS.get(stage);
  if (special !== undefined) {
    menuProgress = menuProgress.map((menu) => menu.menuItemId === special.menuItemId
      ? { ...menu, specialMultiplier: Math.max(menu.specialMultiplier, special.multiplier) }
      : menu);
  }
  if ([4, 12, 19, 27].includes(stage)) {
    workerProgress = { ...workerProgress, chefCount: Math.min(4, workerProgress.chefCount + 1) };
  }
  if ([7, 14, 22, 28].includes(stage)) {
    workerProgress = { ...workerProgress, serverCount: Math.min(4, workerProgress.serverCount + 1) };
  }
  const feverLevel = stage >= 29 ? 3 : stage >= 18 ? 2 : stage >= 9 ? 1 : feverState.level;
  feverState = { ...feverState, level: feverLevel as FeverState["level"] };
  return { menuProgress, workerProgress, feverState };
}

function repairProgressionState(state: ProgressionState): ProgressionState {
  const cloned = cloneState(state);
  const completedStage = getCompletedStage(cloned);
  const menuProgress = cloned.menuProgress.map((menu) => {
    const config = MENU_PROGRESSION_CONFIGS.find((candidate) => candidate.menuItemId === menu.menuItemId);
    const specialEntry = [...MENU_SPECIALS.values()].find((entry) => entry.menuItemId === menu.menuItemId);
    const specialStage = [...MENU_SPECIALS.entries()].find(([, entry]) => entry.menuItemId === menu.menuItemId)?.[0];
    return {
      ...menu,
      unlocked: menu.unlocked || (config !== undefined && config.unlockStage <= completedStage),
      priceLevel: menu.unlocked || (config !== undefined && config.unlockStage <= completedStage)
        ? Math.max(1, menu.priceLevel)
        : menu.priceLevel,
      specialMultiplier: specialStage !== undefined && specialStage <= completedStage && specialEntry !== undefined
        ? Math.max(menu.specialMultiplier, specialEntry.multiplier)
        : menu.specialMultiplier,
    };
  });
  const completedConfig = completedStage > 0 ? STAGE_CONFIGS[completedStage - 1] : undefined;
  return {
    ...cloned,
    menuProgress,
    workerProgress: {
      ...cloned.workerProgress,
      chefCount: Math.max(cloned.workerProgress.chefCount, completedConfig?.chefCount ?? 0),
      serverCount: Math.max(cloned.workerProgress.serverCount, completedConfig?.serverCount ?? 0),
    },
    feverState: {
      ...cloned.feverState,
      level: (completedStage >= 29 ? 3 : completedStage >= 18 ? 2 : completedStage >= 9 ? 1 : 0),
    },
  };
}

function getCompletedStage(state: ProgressionState): number {
  return state.currentStage === 30
    && state.purchasedStepCount >= getStageConfig(30).purchaseCosts.length
    ? 30
    : state.currentStage - 1;
}

function getOverallProgress(state: ProgressionState): number {
  const totalPurchases = STAGE_CONFIGS.reduce((sum, stage) => sum + stage.purchaseCosts.length, 0);
  const completedPurchases = STAGE_CONFIGS
    .slice(0, state.currentStage - 1)
    .reduce((sum, stage) => sum + stage.purchaseCosts.length, 0)
    + state.purchasedStepCount;
  return completedPurchases / totalPurchases;
}

function cloneState(state: ProgressionState): ProgressionState {
  return {
    ...state,
    menuProgress: state.menuProgress.map((menu) => ({ ...menu })),
    workerProgress: { ...state.workerProgress },
    feverState: { ...state.feverState },
  };
}
