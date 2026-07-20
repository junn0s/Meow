import progressionSeed from "./progressionSeed.json";
import {
  GROWTH_STAGES,
  MENU_ITEM_IDS,
  type EconomyConfig,
  type ChapterId,
  type GrowthStage,
  type MenuItemId,
  type ProgressionState,
  type StageConfig,
  type VisualTier,
} from "../types/game";
import { getChapter } from "./chapterData";

export const ECONOMY_CONFIG: EconomyConfig = {
  worktopCostGrowth: 1.18,
  worktopPriceGrowth: 1.085,
  worktopMaxLevel: 50,
  priceMilestoneLevels: [10, 25, 50],
  priceMilestoneMultiplier: 2,
  cookingSpeedPerLevel: 0.84,
  minimumCookingTimeRatio: 0.25,
  extraItemCookingTimeRatio: 0.65,
};

export const MAX_WORKERS_PER_ROLE = 5;

export interface MenuProgressionConfig {
  readonly menuItemId: MenuItemId;
  readonly name: string;
  readonly unlockStage: GrowthStage;
  readonly basePrice: number;
  readonly baseCookingTimeMs: number;
  readonly initialOrderWeight: number;
  readonly matureOrderWeight: number;
}

export interface WorkerHireConfig {
  readonly role: "chef" | "server";
  readonly ordinal: 1 | 2 | 3 | 4 | 5;
  readonly unlockStage: GrowthStage;
  readonly cost: number;
  readonly actionTimeMs: number;
}

export const MENU_PROGRESSION_CONFIGS: readonly MenuProgressionConfig[] = [
  { menuItemId: "fishcake", name: "어묵", unlockStage: 1, basePrice: 18, baseCookingTimeMs: 4_000, initialOrderWeight: 1, matureOrderWeight: 1 },
  { menuItemId: "tteokbokki", name: "떡볶이", unlockStage: 6, basePrice: 630, baseCookingTimeMs: 7_000, initialOrderWeight: 0.18, matureOrderWeight: 0.35 },
  { menuItemId: "fish-bread", name: "순대", unlockStage: 11, basePrice: 22_000, baseCookingTimeMs: 10_000, initialOrderWeight: 0.18, matureOrderWeight: 0.3 },
  { menuItemId: "ramen", name: "야식 라면", unlockStage: 16, basePrice: 790_000, baseCookingTimeMs: 13_000, initialOrderWeight: 0.18, matureOrderWeight: 0.3 },
  { menuItemId: "moon-skewer", name: "달빛 꼬치", unlockStage: 21, basePrice: 28_000_000, baseCookingTimeMs: 16_000, initialOrderWeight: 0.18, matureOrderWeight: 0.3 },
  { menuItemId: "moonlight-set", name: "달빛 정식", unlockStage: 26, basePrice: 1_000_000_000, baseCookingTimeMs: 20_000, initialOrderWeight: 0.18, matureOrderWeight: 0.3 },
];

export function getMenuProgressionConfigs(chapterId: ChapterId): readonly MenuProgressionConfig[] {
  const chapter = getChapter(chapterId);
  return MENU_PROGRESSION_CONFIGS.map((config) => {
    const menu = chapter.menus[config.menuItemId];
    return {
      ...config,
      name: menu.name,
      basePrice: menu.price,
      baseCookingTimeMs: menu.cookingTimeMs,
    };
  });
}

export const WORKER_HIRE_CONFIGS: readonly WorkerHireConfig[] = [
  { role: "chef", ordinal: 1, unlockStage: 4, cost: 762, actionTimeMs: 950 },
  { role: "chef", ordinal: 2, unlockStage: 12, cost: 340_000, actionTimeMs: 850 },
  { role: "chef", ordinal: 3, unlockStage: 19, cost: 33_400_000, actionTimeMs: 650 },
  { role: "chef", ordinal: 4, unlockStage: 27, cost: 8_260_000_000, actionTimeMs: 500 },
  { role: "chef", ordinal: 5, unlockStage: 29, cost: 19_200_000_000, actionTimeMs: 500 },
  { role: "server", ordinal: 1, unlockStage: 7, cost: 10_000, actionTimeMs: 4_200 },
  { role: "server", ordinal: 2, unlockStage: 14, cost: 1_120_000, actionTimeMs: 4_300 },
  { role: "server", ordinal: 3, unlockStage: 22, cost: 284_000_000, actionTimeMs: 3_900 },
  { role: "server", ordinal: 4, unlockStage: 28, cost: 18_100_000_000, actionTimeMs: 3_600 },
  { role: "server", ordinal: 5, unlockStage: 29, cost: 19_200_000_000, actionTimeMs: 3_600 },
];

const PRESSURE_BANDS = [
  { utilization: [0.55, 0.65], success: [0.97, 1] },
  { utilization: [0.65, 0.75], success: [0.92, 0.96] },
  { utilization: [0.72, 0.82], success: [0.88, 0.92] },
  { utilization: [0.78, 0.86], success: [0.84, 0.88] },
  { utilization: [0.84, 0.9], success: [0.81, 0.84] },
  { utilization: [0.88, 0.93], success: [0.75, 0.82] },
] as const;

export const STAGE_CONFIGS: readonly StageConfig[] = progressionSeed.map((raw, index) => {
  const expectedStage = GROWTH_STAGES[index];
  const pressure = PRESSURE_BANDS[Math.min(5, Math.floor(index / 5))];
  if (expectedStage === undefined || pressure === undefined || raw.stage !== expectedStage) {
    throw new Error(`Invalid progression seed at index ${index}.`);
  }

  return {
    ...raw,
    stage: expectedStage,
    purchaseCosts: Object.freeze([...raw.purchaseCosts]),
    targetUtilization: pressure.utilization,
    targetSuccessRate: pressure.success,
    visualTier: (Math.floor(index / 5) + 1) as VisualTier,
  };
});

if (STAGE_CONFIGS.length !== GROWTH_STAGES.length) {
  throw new Error(`Expected ${GROWTH_STAGES.length} progression stages.`);
}

export const TOTAL_TARGET_ACTIVE_SECONDS = STAGE_CONFIGS.reduce(
  (total, stage) => total + stage.targetDurationSeconds,
  0,
);

export function getStageConfig(stage: GrowthStage, chapterId: ChapterId = 1): StageConfig {
  const config = STAGE_CONFIGS[stage - 1];
  if (config === undefined) {
    throw new RangeError(`Unknown growth stage: ${stage}`);
  }
  if (chapterId === 1) return config;
  const scale = getChapter(chapterId).economyScale;
  return {
    ...config,
    keyUpgrade: `${getChapter(chapterId).shortTitle} · ${config.keyUpgrade}`,
    startRevenuePerSecond: Math.round(config.startRevenuePerSecond * scale),
    exitRevenuePerSecond: Math.round(config.exitRevenuePerSecond * scale),
    totalBudget: Math.round(config.totalBudget * scale),
    purchaseCosts: config.purchaseCosts.map((cost) => Math.round(cost * scale)),
  };
}

export function stageToVisualTier(stage: GrowthStage): VisualTier {
  return getStageConfig(stage).visualTier;
}

export function createDefaultProgressionState(chapterId: ChapterId = 1): ProgressionState {
  return {
    chapterId,
    currentStage: 1,
    purchasedStepCount: 0,
    menuProgress: MENU_ITEM_IDS.map((menuItemId, index) => ({
      menuItemId,
      unlocked: index === 0,
      priceLevel: index === 0 ? 1 : 0,
      speedLevel: 0,
      specialMultiplier: 1,
    })),
    workerProgress: {
      chefCount: 0,
      serverCount: 0,
      chefSpeedLevel: 0,
      serverSpeedLevel: 0,
    },
    feverState: {
      level: 0,
      gauge: 0,
      activeRemainingMs: 0,
      cooldownRemainingMs: 0,
    },
    finaleRevenueMultiplier: 1,
  };
}
