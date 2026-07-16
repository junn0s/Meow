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
  const units = [
    { threshold: 1e12, suffix: "T" },
    { threshold: 1e9, suffix: "B" },
    { threshold: 1e6, suffix: "M" },
    { threshold: 1e3, suffix: "K" },
  ] as const;
  const unit = units.find((candidate) => absolute >= candidate.threshold);
  if (unit === undefined) {
    return `${sign}${Math.round(absolute).toLocaleString("ko-KR")}`;
  }
  const scaled = absolute / unit.threshold;
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : maximumFractionDigits;
  return `${sign}${Number(scaled.toFixed(digits)).toString()}${unit.suffix}`;
}

export function formatCurrency(value: number): string {
  return `${formatCompactNumber(Math.max(0, value))}냥`;
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
