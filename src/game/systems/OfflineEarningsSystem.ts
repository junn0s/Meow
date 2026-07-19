export const OFFLINE_MINIMUM_MS = 60_000;
export const OFFLINE_MAXIMUM_MS = 4 * 60 * 60 * 1_000;
export const OFFLINE_BASE_EFFICIENCY = 0.25;
export const OFFLINE_MAX_EFFICIENCY = 0.65;

export type OfflineBottleneck = "kitchen" | "service" | "seating" | "arrival";

export interface OfflineRewardInput {
  readonly elapsedMs: number;
  readonly averageOrderValue: number;
  readonly averageCookingTimeMs: number;
  readonly averageChefActionTimeMs: number;
  readonly averageServerActionTimeMs: number;
  readonly averageDiningTimeMs: number;
  readonly averageCustomerIntervalMs: number;
  readonly seatCount: number;
  readonly chefCount: number;
  readonly serverCount: number;
  readonly efficiency: number;
}

export interface OfflineCapacities {
  readonly kitchen: number;
  readonly service: number;
  readonly seating: number;
  readonly arrival: number;
}

export interface OfflineRewardResult {
  readonly elapsedMs: number;
  readonly amount: number;
  readonly capped: boolean;
  readonly ordersPerSecond: number;
  readonly efficiency: number;
  readonly bottleneck: OfflineBottleneck;
  readonly capacities: OfflineCapacities;
}

export function calculateOfflineEfficiency(fameLevel: number, facilityBonus = 0): number {
  const fameBonus = Math.max(0, Math.floor(fameLevel) - 1) * 0.07;
  const efficiency = Math.min(
    OFFLINE_MAX_EFFICIENCY,
    Math.max(OFFLINE_BASE_EFFICIENCY, OFFLINE_BASE_EFFICIENCY + fameBonus + facilityBonus),
  );
  return Math.round(efficiency * 100) / 100;
}

export function calculateOfflineReward(input: OfflineRewardInput): OfflineRewardResult {
  const elapsedMs = Math.min(OFFLINE_MAXIMUM_MS, Math.max(0, input.elapsedMs));
  const efficiency = Math.min(
    OFFLINE_MAX_EFFICIENCY,
    Math.max(0, input.efficiency),
  );
  const capacities = calculateCapacities(input);
  const bottleneck = findBottleneck(capacities);
  const ordersPerSecond = capacities[bottleneck];
  const amount = elapsedMs < OFFLINE_MINIMUM_MS
    ? 0
    : Math.floor(
        ordersPerSecond
          * Math.max(0, input.averageOrderValue)
          * efficiency
          * (elapsedMs / 1_000),
      );
  return {
    elapsedMs,
    amount,
    capped: input.elapsedMs > OFFLINE_MAXIMUM_MS,
    ordersPerSecond,
    efficiency,
    bottleneck,
    capacities,
  };
}

function calculateCapacities(input: OfflineRewardInput): OfflineCapacities {
  const cookingCycleSeconds = Math.max(
    0.25,
    (Math.max(0, input.averageCookingTimeMs) + Math.max(0, input.averageChefActionTimeMs)) / 1_000,
  );
  const serviceCycleSeconds = Math.max(0.25, Math.max(0, input.averageServerActionTimeMs) / 1_000);
  const tableCycleSeconds = Math.max(
    0.5,
    cookingCycleSeconds + serviceCycleSeconds + Math.max(0, input.averageDiningTimeMs) / 1_000,
  );
  return {
    kitchen: Math.max(0, input.chefCount) / cookingCycleSeconds,
    service: Math.max(0, input.serverCount) / serviceCycleSeconds,
    seating: Math.max(0, input.seatCount) / tableCycleSeconds,
    arrival: 1 / Math.max(0.25, Math.max(0, input.averageCustomerIntervalMs) / 1_000),
  };
}

function findBottleneck(capacities: OfflineCapacities): OfflineBottleneck {
  const entries = Object.entries(capacities) as [OfflineBottleneck, number][];
  return entries.reduce((slowest, candidate) => (
    candidate[1] < slowest[1] ? candidate : slowest
  ))[0];
}
