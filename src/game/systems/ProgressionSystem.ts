import {
  createDefaultProgressionState,
  getStageConfig,
  getMenuProgressionConfigs,
  MAX_WORKERS_PER_ROLE,
  stageToVisualTier,
  STAGE_CONFIGS,
} from "../data/progressionData";
import { getChapter, getNextChapterId } from "../data/chapterData";
import {
  getCookingTimeMs,
  getMenuPrice as calculateMenuPrice,
} from "../economy/economyMath";
import {
  type ChapterId,
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
import {
  applyMenuPortfolioPriceFloor,
  getSharedMenuPriceLevelGain,
} from "./MenuPriceProgressionRules";

export const PROGRESSION_CLEAR_RATING = 4.5;

const FEVER_DURATIONS_MS = [0, 15_000, 18_000, 20_000] as const;
const FEVER_COOLDOWNS_MS = [0, 18_000, 16_000, 14_000] as const;
const FEVER_REVENUE_MULTIPLIERS = [1, 1.5, 1.65, 1.8] as const;
const FEVER_COOKING_SPEED_MULTIPLIERS = [1, 1.15, 1.25, 1.35] as const;
const FEVER_WORKER_SPEED_MULTIPLIERS = [1, 1.12, 1.2, 1.3] as const;
const FEVER_TIP_CHANCE_BONUSES = [0, 0.08, 0.12, 0.18] as const;
const NO_FEVER_TRANSITION = Object.freeze({ activated: false, ended: false });

const GENERIC_EFFECTS = [
  { effect: "menu_price", name: "모든 메뉴 판매가격 상승", description: "해금한 모든 메뉴의 판매가격이 함께 올라갑니다." },
  { effect: "menu_speed", name: "주력 메뉴 조리시간 10% 단축", description: "현재 주력 메뉴가 10% 더 빨리 완성됩니다." },
  { effect: "menu_price", name: "모든 메뉴 판매가격 상승", description: "싼 메뉴를 포함한 모든 메뉴의 판매가격이 함께 올라갑니다." },
  { effect: "service_flow", name: "직원 작업시간 2% 단축", description: "셰프의 주문 접수와 알바의 서빙 준비가 2% 빨라집니다." },
  { effect: "decor", name: "가게 외형 성장 + 메뉴값 상승", description: "가게가 꾸며지고 모든 메뉴의 판매가격도 함께 올라갑니다." },
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

  public getChapterId(): ChapterId {
    return this.state.chapterId;
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
    const chapterProgress = getOverallProgress(this.state);
    return {
      purchase,
      canAfford,
      canPurchase: canAfford,
      chapterId: this.state.chapterId,
      visualTier: stageToVisualTier(this.state.currentStage),
      overallProgress: chapterProgress,
      worldProgress: ((this.state.chapterId - 1) + chapterProgress) / 5,
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
    const fameLevel = stageToVisualTier(this.state.currentStage);
    return {
      unlockedMenuIds,
      seatCount: completedConfig?.seatCount ?? 2,
      cookingTimeMultiplier,
      customerSpawnIntervalMultiplier: 1,
      chefCount: this.state.workerProgress.chefCount,
      serverCount: this.state.workerProgress.serverCount,
      chefActionTimeMultiplier: Math.max(
        0.55,
        0.98 ** this.state.workerProgress.chefSpeedLevel,
      ),
      serverActionTimeMultiplier: Math.max(
        0.55,
        0.98 ** this.state.workerProgress.serverSpeedLevel,
      ),
      cookingSlotCount: Math.max(1, this.state.workerProgress.chefCount),
      chefHired: this.state.workerProgress.chefCount > 0,
      serverHired: this.state.workerProgress.serverCount > 0,
      feverLevel: this.state.feverState.level,
      fameLevel,
      fameRevenueMultiplier: 1 + (fameLevel - 1) * 0.02,
      vipUnlocked: fameLevel >= 4,
      rushUnlocked: completedStage >= 25,
      finalFacilityPurchased: this.isFinalFacilityPurchased(),
    };
  }

  public getMenuPrice(menuItemId: MenuItemId): number {
    const configs = getMenuProgressionConfigs(this.state.chapterId);
    const config = configs.find((menu) => menu.menuItemId === menuItemId);
    const progress = this.state.menuProgress.find((menu) => menu.menuItemId === menuItemId);
    if (config === undefined || progress === undefined) {
      throw new RangeError(`Unknown progression menu: ${menuItemId}`);
    }
    const rawPrice = this.calculateRawMenuPrice(config.basePrice, progress);
    if (!progress.unlocked) {
      return rawPrice;
    }
    const newestUnlockedIndex = this.state.menuProgress
      .map((menu) => menu.unlocked)
      .lastIndexOf(true);
    const menuIndex = this.state.menuProgress.findIndex((menu) => menu.menuItemId === menuItemId);
    const newestProgress = this.state.menuProgress[newestUnlockedIndex];
    const newestConfig = configs[newestUnlockedIndex];
    if (newestProgress === undefined || newestConfig === undefined || menuIndex < 0) {
      return rawPrice;
    }
    return applyMenuPortfolioPriceFloor(
      rawPrice,
      this.calculateRawMenuPrice(newestConfig.basePrice, newestProgress),
      newestUnlockedIndex - menuIndex,
    );
  }

  public getMenuCookingTimeMs(menuItemId: MenuItemId, quantity = 1): number {
    const config = getMenuProgressionConfigs(this.state.chapterId)
      .find((menu) => menu.menuItemId === menuItemId);
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
    const unlocked = getMenuProgressionConfigs(this.state.chapterId).filter((menu) =>
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

  public getFeverCookingSpeedMultiplier(): number {
    const fever = this.state.feverState;
    return fever.activeRemainingMs > 0 ? FEVER_COOKING_SPEED_MULTIPLIERS[fever.level] : 1;
  }

  public getFeverWorkerSpeedMultiplier(): number {
    const fever = this.state.feverState;
    return fever.activeRemainingMs > 0 ? FEVER_WORKER_SPEED_MULTIPLIERS[fever.level] : 1;
  }

  public getFeverTipChanceBonus(): number {
    const fever = this.state.feverState;
    return fever.activeRemainingMs > 0 ? FEVER_TIP_CHANCE_BONUSES[fever.level] : 0;
  }

  public getFeverBenefits(): {
    readonly level: 0 | 1 | 2 | 3;
    readonly revenueMultiplier: number;
    readonly cookingSpeedMultiplier: number;
    readonly workerSpeedMultiplier: number;
    readonly tipChanceBonus: number;
    readonly durationMs: number;
  } {
    const level = this.state.feverState.level;
    return {
      level,
      revenueMultiplier: FEVER_REVENUE_MULTIPLIERS[level],
      cookingSpeedMultiplier: FEVER_COOKING_SPEED_MULTIPLIERS[level],
      workerSpeedMultiplier: FEVER_WORKER_SPEED_MULTIPLIERS[level],
      tipChanceBonus: FEVER_TIP_CHANCE_BONUSES[level],
      durationMs: FEVER_DURATIONS_MS[level],
    };
  }

  /** Advances only active-play fever timers; menus, pauses and offline time do not count. */
  public updateFever(deltaMs: number): { activated: boolean; ended: boolean } {
    const elapsed = Math.max(0, deltaMs);
    const previous = this.state.feverState;
    if (
      elapsed === 0
      || (previous.activeRemainingMs === 0 && previous.cooldownRemainingMs === 0)
    ) return NO_FEVER_TRANSITION;
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
      && this.state.purchasedStepCount >= getStageConfig(30, this.state.chapterId).purchaseCosts.length;
  }

  public isChapterComplete(rating = this.economy.getRating()): boolean {
    return this.isFinalFacilityPurchased() && rating >= PROGRESSION_CLEAR_RATING;
  }

  public isGameComplete(rating = this.economy.getRating()): boolean {
    return this.state.chapterId === 5 && this.isChapterComplete(rating);
  }

  public advanceChapter(rating = this.economy.getRating()): ChapterId | undefined {
    if (!this.isChapterComplete(rating)) return undefined;
    const nextChapterId = getNextChapterId(this.state.chapterId);
    if (nextChapterId === undefined) return undefined;
    this.state = createDefaultProgressionState(nextChapterId);
    this.notify();
    return nextChapterId;
  }

  public subscribe(listener: ProgressionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState(), this.getEffects());
    return () => this.listeners.delete(listener);
  }

  public debugGrantThroughStage(targetStage: GrowthStage): void {
    this.state = createDefaultProgressionState(this.state.chapterId);
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
    } else if (purchase.effect === "menu_speed" && purchase.targetMenuItemId !== undefined) {
      menuProgress = menuProgress.map((menu) => {
        if (menu.menuItemId !== purchase.targetMenuItemId) {
          return menu;
        }
        return { ...menu, speedLevel: menu.speedLevel + 1 };
      });
    } else if (purchase.effect === "service_flow") {
      workerProgress = {
        ...workerProgress,
        chefSpeedLevel: workerProgress.chefSpeedLevel + 1,
        serverSpeedLevel: workerProgress.serverSpeedLevel + 1,
      };
    } else {
      const sharedPriceLevelGain = getSharedMenuPriceLevelGain(purchase.effect);
      if (sharedPriceLevelGain > 0) {
        menuProgress = menuProgress.map((menu) => menu.unlocked
          ? { ...menu, priceLevel: menu.priceLevel + sharedPriceLevelGain }
          : menu);
      }
    }

    const config = getStageConfig(this.state.currentStage, this.state.chapterId);
    const nextStepCount = this.state.purchasedStepCount + 1;
    const stageFinished = nextStepCount >= config.purchaseCosts.length;
    this.state = {
      chapterId: this.state.chapterId,
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

  private calculateRawMenuPrice(basePrice: number, progress: MenuProgress): number {
    return calculateMenuPrice(
      basePrice,
      Math.max(1, progress.priceLevel),
      progress.specialMultiplier,
      this.state.finaleRevenueMultiplier,
    );
  }
}

function buildPurchase(state: ProgressionState): ProgressionPurchaseData {
  const config = getStageConfig(state.currentStage, state.chapterId);
  const menuConfigs = getMenuProgressionConfigs(state.chapterId);
  const step = state.purchasedStepCount + 1;
  const stepCount = config.purchaseCosts.length;
  const cost = config.purchaseCosts[state.purchasedStepCount];
  if (cost === undefined) {
    throw new RangeError(`Stage ${state.currentStage} has no purchase step ${step}.`);
  }
  const activeMenu = [...state.menuProgress].reverse().find((menu) => menu.unlocked)
    ?? state.menuProgress[0];

  if (state.currentStage === 30) {
    const chapter = getChapter(state.chapterId);
    return {
      stage: 30,
      step,
      stepCount,
      name: `${chapter.finaleName} 부품 ${step}`,
      description: `${chapter.finaleName}의 ${step}/5 부품을 완성하고 전체 수익을 12% 올립니다.`,
      cost,
      effect: "finale_part",
    };
  }

  if (step === stepCount) {
    const keyEffectCopy = getStageKeyEffectCopy(state.currentStage, state.chapterId);
    return {
      stage: state.currentStage,
      step,
      stepCount,
      name: keyEffectCopy.name,
      description: keyEffectCopy.description,
      cost,
      effect: "stage_key",
      targetMenuItemId: activeMenu?.menuItemId,
    };
  }

  const generic = GENERIC_EFFECTS[state.purchasedStepCount] ?? GENERIC_EFFECTS[0];
  const activeMenuName = menuConfigs.find(
    (menu) => menu.menuItemId === activeMenu?.menuItemId,
  )?.name ?? "주력 메뉴";
  return {
    stage: state.currentStage,
    step,
    stepCount,
    name: generic.effect === "menu_speed"
      ? `${activeMenuName} 조리시간 10% 단축`
      : generic.name,
    description: generic.effect === "menu_speed"
      ? `${activeMenuName} 주문이 10% 더 빨리 완성됩니다.`
      : generic.description,
    cost,
    effect: generic.effect,
    targetMenuItemId: activeMenu?.menuItemId,
  };
}

function getStageKeyEffectCopy(stage: GrowthStage, chapterId: ChapterId): { name: string; description: string } {
  const config = getStageConfig(stage, chapterId);
  const menuConfigs = getMenuProgressionConfigs(chapterId);
  const previousConfig = STAGE_CONFIGS[stage - 2];
  const changes: string[] = [];
  const unlock = MENU_UNLOCKS.get(stage);
  let unlockedMenuName: string | undefined;
  if (unlock !== undefined) {
    unlockedMenuName = menuConfigs.find(
      (menu) => menu.menuItemId === unlock,
    )?.name ?? "새 메뉴";
    changes.push(`${unlockedMenuName} 해금`);
  }
  const special = MENU_SPECIALS.get(stage);
  let specialMenuName: string | undefined;
  if (special !== undefined) {
    specialMenuName = menuConfigs.find(
      (menu) => menu.menuItemId === special.menuItemId,
    )?.name ?? "메뉴";
    changes.push(`${specialMenuName} 판매가격 ×${special.multiplier}`);
  }
  if (stage === 3) changes.push("모든 메뉴 조리시간 15% 단축");
  if (stage === 17) changes.push("모든 메뉴 조리시간 추가 18% 단축");
  const previousChefCount = previousConfig?.chefCount ?? 0;
  if (config.chefCount > previousChefCount) changes.push(`셰프 ${config.chefCount}명 고용`);
  const previousServerCount = previousConfig?.serverCount ?? 0;
  if (config.serverCount > previousServerCount) {
    changes.push(`서빙 알바 ${config.serverCount}명 고용`);
  }
  const previousSeatCount = previousConfig?.seatCount ?? 2;
  if (config.seatCount > previousSeatCount) {
    changes.push(`좌석 ${previousSeatCount}개 → ${config.seatCount}개`);
  }
  if (stage === 9) changes.push("FEVER Lv.1 해금");
  if (stage === 18) changes.push("FEVER Lv.2 해금");
  if (stage === 23) changes.push("VIP 손님과 메뉴 홍보 해금");
  if (stage === 25) changes.push("러시타임 해금");
  if (stage === 29) changes.push("FEVER Lv.3 해금");

  if (changes.length === 0) {
    return {
      name: `${stage}단계 완료`,
      description: `이 단계를 완료하고 ${Math.min(30, stage + 1)}단계를 엽니다.`,
    };
  }
  const chefHired = config.chefCount > previousChefCount;
  const serverHired = config.serverCount > previousServerCount;
  const seatsAdded = config.seatCount > previousSeatCount;
  const name = unlockedMenuName !== undefined
    ? `${unlockedMenuName} 해금`
    : special !== undefined
      ? `${specialMenuName ?? "메뉴"} 가격 ×${special.multiplier}`
      : chefHired && serverHired
        ? `직원 ${config.chefCount}명씩 고용`
        : chefHired
          ? `셰프 ${config.chefCount}명 고용`
          : serverHired
            ? `서빙 알바 ${config.serverCount}명 고용`
            : stage === 3
              ? "전체 조리시간 -15%"
              : stage === 17
                ? "전체 조리시간 -18%"
                : seatsAdded
                  ? `좌석 ${previousSeatCount}개 → ${config.seatCount}개`
                  : changes[0] ?? `${stage}단계 완료`;
  return {
    name,
    description: `${changes.join(" · ")}.`,
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
      ? {
          ...menu,
          unlocked: true,
          priceLevel: Math.max(1, menu.priceLevel),
          speedLevel: Math.max(1, menu.speedLevel),
        }
      : menu);
  }
  const special = MENU_SPECIALS.get(stage);
  if (special !== undefined) {
    menuProgress = menuProgress.map((menu) => menu.menuItemId === special.menuItemId
      ? { ...menu, specialMultiplier: Math.max(menu.specialMultiplier, special.multiplier) }
      : menu);
  }
  if ([4, 12, 19, 27, 29].includes(stage)) {
    workerProgress = {
      ...workerProgress,
      chefCount: Math.min(MAX_WORKERS_PER_ROLE, workerProgress.chefCount + 1),
    };
  }
  if ([7, 14, 22, 28, 29].includes(stage)) {
    workerProgress = {
      ...workerProgress,
      serverCount: Math.min(MAX_WORKERS_PER_ROLE, workerProgress.serverCount + 1),
    };
  }
  const feverLevel = stage >= 29 ? 3 : stage >= 18 ? 2 : stage >= 9 ? 1 : feverState.level;
  feverState = { ...feverState, level: feverLevel as FeverState["level"] };
  return { menuProgress, workerProgress, feverState };
}

function repairProgressionState(state: ProgressionState): ProgressionState {
  const cloned = cloneState(state);
  const menuConfigs = getMenuProgressionConfigs(cloned.chapterId);
  const completedStage = getCompletedStage(cloned);
  const menuProgress = cloned.menuProgress.map((menu) => {
    const config = menuConfigs.find((candidate) => candidate.menuItemId === menu.menuItemId);
    const specialEntry = [...MENU_SPECIALS.values()].find((entry) => entry.menuItemId === menu.menuItemId);
    const specialStage = [...MENU_SPECIALS.entries()].find(([, entry]) => entry.menuItemId === menu.menuItemId)?.[0];
    return {
      ...menu,
      unlocked: menu.unlocked || (config !== undefined && config.unlockStage <= completedStage),
      priceLevel: menu.unlocked || (config !== undefined && config.unlockStage <= completedStage)
        ? Math.max(1, menu.priceLevel)
        : menu.priceLevel,
      speedLevel: config !== undefined && config.unlockStage > 1 && config.unlockStage <= completedStage
        ? Math.max(1, menu.speedLevel)
        : menu.speedLevel,
      specialMultiplier: specialStage !== undefined && specialStage <= completedStage && specialEntry !== undefined
        ? Math.max(menu.specialMultiplier, specialEntry.multiplier)
        : menu.specialMultiplier,
    };
  });
  const completedConfig = completedStage > 0 ? STAGE_CONFIGS[completedStage - 1] : undefined;
  const repairedWorkerSpeedLevel = Math.min(29, completedStage)
    + (cloned.currentStage < 30 && cloned.purchasedStepCount >= 4 ? 1 : 0);
  return {
    ...cloned,
    menuProgress,
    workerProgress: {
      ...cloned.workerProgress,
      chefCount: Math.max(cloned.workerProgress.chefCount, completedConfig?.chefCount ?? 0),
      serverCount: Math.max(cloned.workerProgress.serverCount, completedConfig?.serverCount ?? 0),
      chefSpeedLevel: Math.max(
        cloned.workerProgress.chefSpeedLevel,
        repairedWorkerSpeedLevel,
      ),
      serverSpeedLevel: Math.max(
        cloned.workerProgress.serverSpeedLevel,
        repairedWorkerSpeedLevel,
      ),
    },
    feverState: {
      ...cloned.feverState,
      level: (completedStage >= 29 ? 3 : completedStage >= 18 ? 2 : completedStage >= 9 ? 1 : 0),
    },
  };
}

function getCompletedStage(state: ProgressionState): number {
  return state.currentStage === 30
    && state.purchasedStepCount >= getStageConfig(30, state.chapterId).purchaseCosts.length
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
