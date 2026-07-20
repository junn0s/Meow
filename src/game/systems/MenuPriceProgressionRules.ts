import type { ProgressionPurchaseData } from "../types/game";

/**
 * Minimum price of an older menu relative to the newest unlocked menu.
 *
 * A fast, familiar dish remains cheaper than a newly launched signature dish,
 * but it never becomes economically irrelevant just because the shop grew.
 */
export const MENU_PORTFOLIO_PRICE_FLOORS = Object.freeze([
  1,
  0.24,
  0.09,
  0.04,
  0.02,
  0.01,
] as const);

export function getMenuPortfolioFloorRatio(newerMenuCount: number): number {
  const distance = Math.max(0, Math.floor(newerMenuCount));
  return MENU_PORTFOLIO_PRICE_FLOORS[
    Math.min(distance, MENU_PORTFOLIO_PRICE_FLOORS.length - 1)
  ] ?? 1;
}

export function applyMenuPortfolioPriceFloor(
  rawPrice: number,
  newestMenuRawPrice: number,
  newerMenuCount: number,
): number {
  const floorPrice = Math.round(
    Math.max(0, newestMenuRawPrice) * getMenuPortfolioFloorRatio(newerMenuCount),
  );
  return Math.max(1, Math.round(rawPrice), floorPrice);
}

/** Only explicit menu-value purchases raise prices; flow upgrades must not do so. */
export function getSharedMenuPriceLevelGain(
  effect: ProgressionPurchaseData["effect"],
): number {
  return effect === "menu_price" || effect === "decor" ? 1 : 0;
}
