export const OFFLINE_MINIMUM_MS = 60_000;
export const OFFLINE_MAXIMUM_MS = 4 * 60 * 60 * 1_000;
export const OFFLINE_EFFICIENCY = 0.25;
export const OFFLINE_NEXT_PURCHASE_CAP = 0.45;

export interface OfflineRewardInput {
  readonly elapsedMs: number;
  readonly revenuePerSecond: number;
  readonly automation: number;
  readonly nextPurchaseCost?: number;
}

export interface OfflineRewardResult {
  readonly elapsedMs: number;
  readonly amount: number;
  readonly capped: boolean;
}

export function calculateOfflineReward(input: OfflineRewardInput): OfflineRewardResult {
  const elapsedMs = Math.min(OFFLINE_MAXIMUM_MS, Math.max(0, input.elapsedMs));
  if (elapsedMs < OFFLINE_MINIMUM_MS) return { elapsedMs, amount: 0, capped: false };
  const rawAmount = Math.floor(
    Math.max(0, input.revenuePerSecond)
      * Math.min(1, Math.max(0, input.automation))
      * OFFLINE_EFFICIENCY
      * (elapsedMs / 1_000),
  );
  const cap = input.nextPurchaseCost === undefined
    ? rawAmount
    : Math.max(1, Math.floor(input.nextPurchaseCost * OFFLINE_NEXT_PURCHASE_CAP));
  const amount = Math.min(rawAmount, cap);
  return { elapsedMs, amount, capped: amount < rawAmount };
}
