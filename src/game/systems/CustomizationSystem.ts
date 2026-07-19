import type { EconomySystem } from "./EconomySystem";

export const OWNER_STYLES = [
  { id: "cream", name: "크림", tint: 0xffffff, cost: 0 },
  { id: "peach", name: "복숭아", tint: 0xffc0a8, cost: 500 },
  { id: "mint", name: "민트", tint: 0xa8f0d8, cost: 5_000 },
  { id: "midnight", name: "한밤", tint: 0x9caee8, cost: 50_000 },
] as const;

export type OwnerStyleId = (typeof OWNER_STYLES)[number]["id"];
export const FACILITY_UPGRADES = [
  { id: "copper-pot", name: "구리 냄비", cost: 2_000 },
  { id: "soft-chair", name: "푹신한 의자", cost: 20_000 },
  { id: "wide-table", name: "넓은 식탁", cost: 200_000 },
  { id: "neon-set", name: "달빛 네온 세트", cost: 2_000_000 },
] as const;
export type FacilityUpgradeId = (typeof FACILITY_UPGRADES)[number]["id"];
export interface FacilityEffects {
  readonly cookingTimeMultiplier: number;
  readonly patienceMultiplier: number;
  readonly bonusSeats: number;
  readonly revenueMultiplier: number;
  readonly visualTier: number;
}
const STORAGE_KEY = "meow-night-diner.customization.v1";

export class CustomizationSystem {
  private owned = new Set<OwnerStyleId>(["cream"]);
  private selected: OwnerStyleId = "cream";
  private facilities = new Set<FacilityUpgradeId>();

  public constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as { owned?: unknown; selected?: unknown; facilities?: unknown };
        if (Array.isArray(parsed.owned)) {
          for (const id of parsed.owned) if (isOwnerStyleId(id)) this.owned.add(id);
        }
        if (isOwnerStyleId(parsed.selected) && this.owned.has(parsed.selected)) this.selected = parsed.selected;
        if (Array.isArray(parsed.facilities)) {
          for (const id of parsed.facilities) if (isFacilityUpgradeId(id)) this.facilities.add(id);
        }
      }
    } catch { /* Storage denial keeps the free default style. */ }
  }

  public getSelected() { return OWNER_STYLES.find((style) => style.id === this.selected) ?? OWNER_STYLES[0]; }
  public isOwned(id: OwnerStyleId): boolean { return this.owned.has(id); }
  public isFacilityOwned(id: FacilityUpgradeId): boolean { return this.facilities.has(id); }

  public getFacilityEffects(): FacilityEffects {
    return {
      cookingTimeMultiplier: this.facilities.has("copper-pot") ? 0.9 : 1,
      patienceMultiplier: this.facilities.has("soft-chair") ? 1.15 : 1,
      bonusSeats: this.facilities.has("wide-table") ? 1 : 0,
      revenueMultiplier: this.facilities.has("neon-set") ? 1.1 : 1,
      visualTier: this.facilities.size,
    };
  }

  public purchaseFacility(id: FacilityUpgradeId, economy: EconomySystem): "purchased" | "owned" | "insufficient" {
    if (this.facilities.has(id)) return "owned";
    const item = FACILITY_UPGRADES.find((candidate) => candidate.id === id);
    if (item === undefined || !economy.trySpend(item.cost)) return "insufficient";
    this.facilities.add(id);
    this.persist();
    return "purchased";
  }

  public purchaseOrEquip(id: OwnerStyleId, economy: EconomySystem): "purchased" | "equipped" | "insufficient" {
    const style = OWNER_STYLES.find((candidate) => candidate.id === id);
    if (style === undefined) return "insufficient";
    if (!this.owned.has(id)) {
      if (!economy.trySpend(style.cost)) return "insufficient";
      this.owned.add(id);
      this.selected = id;
      this.persist();
      return "purchased";
    }
    this.selected = id;
    this.persist();
    return "equipped";
  }

  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ owned: [...this.owned], selected: this.selected, facilities: [...this.facilities] })); } catch { /* no-op */ }
  }
}

function isFacilityUpgradeId(value: unknown): value is FacilityUpgradeId {
  return typeof value === "string" && FACILITY_UPGRADES.some((item) => item.id === value);
}

function isOwnerStyleId(value: unknown): value is OwnerStyleId {
  return typeof value === "string" && OWNER_STYLES.some((style) => style.id === value);
}
