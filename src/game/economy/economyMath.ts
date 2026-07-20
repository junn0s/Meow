import { ECONOMY_CONFIG } from "../data/progressionData";

export interface SaleFormulaInput {
  readonly unitPrice: number;
  readonly quantity?: number;
  readonly tipRate?: number;
  readonly vipMultiplier?: number;
  readonly comboMultiplier?: number;
  readonly feverMultiplier?: number;
}

export interface SaleFormulaResult {
  readonly subtotal: number;
  readonly baseAmount: number;
  readonly tipAmount: number;
  readonly totalAmount: number;
}

export function calculateSale(input: SaleFormulaInput): SaleFormulaResult {
  const quantity = positiveInteger(input.quantity ?? 1, "Quantity");
  const unitPrice = nonNegativeFinite(input.unitPrice, "Unit price");
  const tipRate = nonNegativeFinite(input.tipRate ?? 0, "Tip rate");
  const vip = nonNegativeFinite(input.vipMultiplier ?? 1, "VIP multiplier");
  const combo = nonNegativeFinite(input.comboMultiplier ?? 1, "Combo multiplier");
  const fever = nonNegativeFinite(input.feverMultiplier ?? 1, "Fever multiplier");
  const subtotal = Math.round(unitPrice * quantity);
  const baseAmount = Math.round(subtotal * vip * combo * fever);
  const tipAmount = Math.round(baseAmount * tipRate);
  return { subtotal, baseAmount, tipAmount, totalAmount: baseAmount + tipAmount };
}

export function getWorktopUpgradeCost(baseCost: number, currentLevel: number): number {
  const level = boundedLevel(currentLevel);
  return niceNumber(baseCost * ECONOMY_CONFIG.worktopCostGrowth ** Math.max(0, level - 1));
}

export function getMenuPrice(
  basePrice: number,
  level: number,
  menuMultiplier = 1,
  globalMultiplier = 1,
): number {
  const normalizedLevel = boundedLevel(level);
  const milestoneCount = ECONOMY_CONFIG.priceMilestoneLevels.filter(
    (milestone) => normalizedLevel >= milestone,
  ).length;
  return Math.max(1, Math.round(
    basePrice
      * ECONOMY_CONFIG.worktopPriceGrowth ** Math.max(0, normalizedLevel - 1)
      * ECONOMY_CONFIG.priceMilestoneMultiplier ** milestoneCount
      * menuMultiplier
      * globalMultiplier,
  ));
}

export function getCookingTimeMs(
  baseCookingTimeMs: number,
  speedLevel: number,
  globalKitchenMultiplier = 1,
  quantity = 1,
): number {
  const normalizedSpeedLevel = Math.max(0, Math.floor(speedLevel));
  const itemTime = Math.max(
    baseCookingTimeMs * ECONOMY_CONFIG.minimumCookingTimeRatio,
    baseCookingTimeMs
      * ECONOMY_CONFIG.cookingSpeedPerLevel ** normalizedSpeedLevel
      * globalKitchenMultiplier,
  );
  const normalizedQuantity = positiveInteger(quantity, "Quantity");
  return Math.round(
    itemTime * (1 + ECONOMY_CONFIG.extraItemCookingTimeRatio * (normalizedQuantity - 1)),
  );
}

export function formatCompactNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  if (absolute < 1_000) {
    return `${sign}${Math.round(absolute).toLocaleString("ko-KR")}`;
  }
  const unitIndex = Math.max(1, Math.floor(Math.log10(absolute) / 3));
  const threshold = 10 ** (unitIndex * 3);
  const scaled = absolute / threshold;
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : maximumFractionDigits;
  return `${sign}${Number(scaled.toFixed(digits)).toString()}${getIdleUnitSuffix(unitIndex)}`;
}

export function formatCurrency(value: number): string {
  return `${formatCompactNumber(Math.max(0, value))}냥`;
}

function getIdleUnitSuffix(unitIndex: number): string {
  const familiarUnits = ["", "K", "M", "B", "T"] as const;
  const familiar = familiarUnits[unitIndex];
  if (familiar !== undefined) return familiar;

  const extendedIndex = unitIndex - familiarUnits.length;
  const first = Math.floor(extendedIndex / 26);
  const second = extendedIndex % 26;
  if (first < 26) {
    return `${String.fromCharCode(97 + first)}${String.fromCharCode(97 + second)}`;
  }
  return `u${unitIndex}`;
}

function niceNumber(value: number): number {
  if (value <= 0 || !Number.isFinite(value)) {
    return 0;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude >= 1_000 ? magnitude / 100 : 1;
  return Math.round(value / step) * step;
}

function boundedLevel(level: number): number {
  return Math.min(ECONOMY_CONFIG.worktopMaxLevel, Math.max(1, Math.floor(level)));
}

function nonNegativeFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
  return value;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
  return value;
}
