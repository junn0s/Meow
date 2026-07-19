import type { CustomerKind, VisualTier } from "../types/game";

export interface FameBenefits {
  readonly level: VisualTier;
  readonly revenueMultiplier: number;
  readonly vipChance: number;
  readonly tipChanceBonus: number;
  readonly specialOrderChance: number;
  readonly unlockedCustomerKinds: readonly CustomerKind[];
}

export function getFameBenefits(baseLevel: number, bonusLevel = 0): FameBenefits {
  const level = Math.min(6, Math.max(1, Math.floor(baseLevel + Math.max(0, bonusLevel)))) as VisualTier;
  const unlockedCustomerKinds: CustomerKind[] = ["rabbit", "dog"];
  if (level >= 2) unlockedCustomerKinds.push("hamster");
  if (level >= 3) unlockedCustomerKinds.push("raccoon");
  return {
    level,
    revenueMultiplier: 1 + (level - 1) * 0.02,
    vipChance: level < 4 ? 0 : [0, 0, 0, 0, 0.04, 0.07, 0.11][level] ?? 0,
    tipChanceBonus: (level - 1) * 0.02,
    specialOrderChance: level < 5 ? 0 : level === 5 ? 0.1 : 0.18,
    unlockedCustomerKinds,
  };
}
