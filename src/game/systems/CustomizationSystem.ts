import { CHAPTER_IDS, MENU_ITEM_IDS, type ChapterId, type MenuItemId } from "../types/game";
import type { EconomySystem } from "./EconomySystem";

export const OWNER_STYLES = [
  { id: "cream", name: "크림", tint: 0xffffff, cost: 0 },
  { id: "peach", name: "복숭아", tint: 0xffc0a8, cost: 500 },
  { id: "mint", name: "민트", tint: 0xa8f0d8, cost: 5_000 },
  { id: "midnight", name: "한밤", tint: 0x9caee8, cost: 50_000 },
] as const;

export type OwnerStyleId = (typeof OWNER_STYLES)[number]["id"];
export const AVATAR_ITEMS = [
  { id: "eyes-round", category: "eyes", name: "동그란 눈", cost: 0, icon: "●●" },
  { id: "eyes-sleepy", category: "eyes", name: "나른한 눈", cost: 1_000, icon: "––" },
  { id: "eyes-sparkle", category: "eyes", name: "별빛 눈", cost: 20_000, icon: "✦✦" },
  { id: "eyes-heart", category: "eyes", name: "설렘 눈", cost: 350_000, icon: "♥♥" },
  { id: "hat-none", category: "hat", name: "모자 없음", cost: 0, icon: "·" },
  { id: "hat-band", category: "hat", name: "빨간 머리띠", cost: 2_500, icon: "▰" },
  { id: "hat-chef", category: "hat", name: "꼬마 셰프모", cost: 50_000, icon: "♨" },
  { id: "hat-moon", category: "hat", name: "달빛 베레모", cost: 1_000_000, icon: "☾" },
  { id: "hat-flower", category: "hat", name: "벚꽃 머리핀", cost: 4_000_000, icon: "✿" },
  { id: "apron-none", category: "apron", name: "앞치마 없음", cost: 0, icon: "·" },
  { id: "apron-red", category: "apron", name: "포차 앞치마", cost: 1_500, icon: "▣" },
  { id: "apron-mint", category: "apron", name: "민트 앞치마", cost: 25_000, icon: "▣" },
  { id: "apron-night", category: "apron", name: "심야 앞치마", cost: 500_000, icon: "◆" },
  { id: "apron-cream", category: "apron", name: "크림 체크 앞치마", cost: 5_000_000, icon: "▦" },
  { id: "acc-none", category: "accessory", name: "장식 없음", cost: 0, icon: "·" },
  { id: "acc-bell", category: "accessory", name: "금빛 방울", cost: 5_000, icon: "●" },
  { id: "acc-fish", category: "accessory", name: "어묵 브로치", cost: 80_000, icon: "◇" },
  { id: "acc-moon", category: "accessory", name: "초승달 참", cost: 2_000_000, icon: "☾" },
  { id: "acc-scarf", category: "accessory", name: "노을 스카프", cost: 8_000_000, icon: "≈" },
] as const;
export type AvatarCategory = "fur" | (typeof AVATAR_ITEMS)[number]["category"];
export type AvatarItemId = (typeof AVATAR_ITEMS)[number]["id"];
export interface AvatarLook {
  readonly eyes: "eyes-round" | "eyes-sleepy" | "eyes-sparkle" | "eyes-heart";
  readonly hat: "hat-none" | "hat-band" | "hat-chef" | "hat-moon" | "hat-flower";
  readonly apron: "apron-none" | "apron-red" | "apron-mint" | "apron-night" | "apron-cream";
  readonly accessory: "acc-none" | "acc-bell" | "acc-fish" | "acc-moon" | "acc-scarf";
}
export const FACILITY_UPGRADES = [
  { id: "copper-pot", category: "kitchen", name: "구리 냄비", cost: 2_000, effect: "조리 -10%", icon: "♨" },
  { id: "double-burner", category: "kitchen", name: "쌍화구", cost: 35_000, effect: "조리 -8%", icon: "▣" },
  { id: "prep-rack", category: "kitchen", name: "손질 선반", cost: 120_000, effect: "셰프 +12%", icon: "▤" },
  { id: "steam-hood", category: "kitchen", name: "달빛 환기후드", cost: 900_000, effect: "조리 -6%", icon: "▱" },
  { id: "soft-chair", category: "hall", name: "푹신한 의자", cost: 20_000, effect: "인내심 +15%", icon: "▥" },
  { id: "wide-table", category: "hall", name: "넓은 식탁", cost: 200_000, effect: "좌석 +1", icon: "▰" },
  { id: "moon-counter", category: "hall", name: "달빛 계산대", cost: 1_000_000, effect: "서버 +12%", icon: "☾" },
  { id: "tea-dispenser", category: "hall", name: "온차 보온통", cost: 3_000_000, effect: "인내심 +12%", icon: "♨" },
  { id: "paper-lantern", category: "exterior", name: "청사초롱", cost: 30_000, effect: "VIP +3%", icon: "◆" },
  { id: "blue-canopy", category: "exterior", name: "푸른 천막", cost: 400_000, effect: "인내심 +10%", icon: "▰" },
  { id: "neon-set", category: "exterior", name: "달빛 네온", cost: 2_000_000, effect: "결제 +10%", icon: "✦" },
  { id: "moon-sign", category: "exterior", name: "초승달 간판", cost: 20_000_000, effect: "명성 +1", icon: "☾" },
  { id: "wind-chime", category: "exterior", name: "별빛 풍경", cost: 8_000_000, effect: "손님 +5%", icon: "♫" },
  { id: "lucky-cat", category: "management", name: "복고양이", cost: 100_000, effect: "팁 +8%", icon: "●" },
  { id: "festival-drum", category: "management", name: "축제 북", cost: 5_000_000, effect: "피버 +20%", icon: "◎" },
  { id: "night-ledger", category: "management", name: "심야 장부", cost: 50_000_000, effect: "오프라인 +8%", icon: "▤" },
  { id: "coupon-board", category: "management", name: "단골 쿠폰판", cost: 15_000_000, effect: "결제 +6%", icon: "▦" },
  { id: "chef-uniform", category: "staff", name: "청록 셰프복", cost: 250_000, effect: "셰프 외형", icon: "♨" },
  { id: "server-uniform", category: "staff", name: "자홍 서버복", cost: 500_000, effect: "서버 외형", icon: "◆" },
  { id: "staff-badge", category: "staff", name: "달빛 직원 배지", cost: 10_000_000, effect: "직원 +5%", icon: "★" },
  { id: "server-shoes", category: "staff", name: "날쌘 운동화", cost: 7_000_000, effect: "서버 +8%", icon: "≈" },
] as const;
export type FacilityUpgradeId = (typeof FACILITY_UPGRADES)[number]["id"];
export type FacilityCategory = (typeof FACILITY_UPGRADES)[number]["category"];
export interface FacilityEffects {
  readonly cookingTimeMultiplier: number;
  readonly patienceMultiplier: number;
  readonly bonusSeats: number;
  readonly revenueMultiplier: number;
  readonly visualTier: number;
  readonly chefActionTimeMultiplier: number;
  readonly serverActionTimeMultiplier: number;
  readonly vipChanceBonus: number;
  readonly tipChanceBonus: number;
  readonly feverChargeMultiplier: number;
  readonly offlineEfficiencyBonus: number;
  readonly fameBonus: number;
  readonly chefTint?: number;
  readonly serverTint?: number;
  readonly customerArrivalMultiplier: number;
  readonly nightTipChanceBonus: number;
  readonly specialOrderChanceBonus: number;
}
const STORAGE_KEY = "meow-night-diner.customization.v1";
const MAX_WORKTOP_SLOTS = 3;

export class CustomizationSystem {
  private owned = new Set<OwnerStyleId>(["cream"]);
  private selected: OwnerStyleId = "cream";
  private facilities = new Set<FacilityUpgradeId>();
  private activeChapterId: ChapterId = 1;
  private worktopSlotsByChapter = Object.fromEntries(
    CHAPTER_IDS.map((chapterId) => [chapterId, createDefaultWorktopSlots()]),
  ) as Record<ChapterId, Record<MenuItemId, number>>;
  private avatarOwned = new Set<AvatarItemId>(["eyes-round", "hat-none", "apron-none", "acc-none"]);
  private avatarLook: AvatarLook = {
    eyes: "eyes-round",
    hat: "hat-none",
    apron: "apron-none",
    accessory: "acc-none",
  };

  public constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as {
          owned?: unknown;
          selected?: unknown;
          facilities?: unknown;
          worktopSlots?: unknown;
          worktopSlotsByChapter?: unknown;
          avatarOwned?: unknown;
          avatarLook?: unknown;
        };
        if (Array.isArray(parsed.owned)) {
          for (const id of parsed.owned) if (isOwnerStyleId(id)) this.owned.add(id);
        }
        if (isOwnerStyleId(parsed.selected) && this.owned.has(parsed.selected)) this.selected = parsed.selected;
        if (Array.isArray(parsed.facilities)) {
          for (const id of parsed.facilities) if (isFacilityUpgradeId(id)) this.facilities.add(id);
        }
        if (isRecord(parsed.worktopSlotsByChapter)) {
          for (const chapterId of CHAPTER_IDS) {
            const chapterSlots = parsed.worktopSlotsByChapter[String(chapterId)];
            if (isRecord(chapterSlots)) this.restoreWorktopSlots(chapterId, chapterSlots);
          }
        } else if (isRecord(parsed.worktopSlots)) {
          this.restoreWorktopSlots(1, parsed.worktopSlots);
        }
        if (Array.isArray(parsed.avatarOwned)) {
          for (const id of parsed.avatarOwned) if (isAvatarItemId(id)) this.avatarOwned.add(id);
        }
        if (isRecord(parsed.avatarLook)) {
          for (const category of ["eyes", "hat", "apron", "accessory"] as const) {
            const id = parsed.avatarLook[category];
            if (isAvatarItemId(id) && getAvatarItem(id).category === category && this.avatarOwned.has(id)) {
              this.avatarLook = { ...this.avatarLook, [category]: id } as AvatarLook;
            }
          }
        }
      }
    } catch { /* Storage denial keeps the free default style. */ }
  }

  public getSelected() { return OWNER_STYLES.find((style) => style.id === this.selected) ?? OWNER_STYLES[0]; }
  public isOwned(id: OwnerStyleId): boolean { return this.owned.has(id); }
  public isFacilityOwned(id: FacilityUpgradeId): boolean { return this.facilities.has(id); }
  public getOwnedFacilityIds(): readonly FacilityUpgradeId[] { return [...this.facilities]; }
  public setActiveChapter(chapterId: ChapterId): void { this.activeChapterId = chapterId; }
  public getWorktopSlotCount(menuItemId: MenuItemId): number { return this.worktopSlotsByChapter[this.activeChapterId][menuItemId]; }
  public getAvatarLook(): AvatarLook { return { ...this.avatarLook }; }
  public isAvatarOwned(id: AvatarItemId): boolean { return this.avatarOwned.has(id); }

  public purchaseOrEquipAvatarItem(
    id: AvatarItemId,
    economy: EconomySystem,
  ): "purchased" | "equipped" | "insufficient" {
    const item = getAvatarItem(id);
    const purchased = !this.avatarOwned.has(id);
    if (purchased) {
      if (!economy.trySpend(item.cost)) return "insufficient";
      this.avatarOwned.add(id);
    }
    this.avatarLook = { ...this.avatarLook, [item.category]: id } as AvatarLook;
    this.persist();
    return purchased ? "purchased" : "equipped";
  }

  public purchaseWorktopSlot(
    menuItemId: MenuItemId,
    menuPrice: number,
    economy: EconomySystem,
  ): "purchased" | "maxed" | "insufficient" {
    const currentSlots = this.worktopSlotsByChapter[this.activeChapterId][menuItemId];
    if (currentSlots >= MAX_WORKTOP_SLOTS) return "maxed";
    const cost = getWorktopSlotUpgradeCost(menuPrice, currentSlots);
    if (!economy.trySpend(cost)) return "insufficient";
    this.worktopSlotsByChapter[this.activeChapterId][menuItemId] = currentSlots + 1;
    this.persist();
    return "purchased";
  }

  public getFacilityEffects(): FacilityEffects {
    return {
      cookingTimeMultiplier: (this.facilities.has("copper-pot") ? 0.9 : 1)
        * (this.facilities.has("double-burner") ? 0.92 : 1)
        * (this.facilities.has("steam-hood") ? 0.94 : 1),
      patienceMultiplier: (this.facilities.has("soft-chair") ? 1.15 : 1)
        * (this.facilities.has("blue-canopy") ? 1.1 : 1)
        * (this.facilities.has("tea-dispenser") ? 1.12 : 1),
      bonusSeats: this.facilities.has("wide-table") ? 1 : 0,
      revenueMultiplier: (this.facilities.has("neon-set") ? 1.1 : 1)
        * (this.facilities.has("coupon-board") ? 1.06 : 1),
      visualTier: Math.min(4, this.facilities.size),
      chefActionTimeMultiplier: (this.facilities.has("prep-rack") ? 0.88 : 1)
        * (this.facilities.has("staff-badge") ? 0.95 : 1),
      serverActionTimeMultiplier: (this.facilities.has("moon-counter") ? 0.88 : 1)
        * (this.facilities.has("staff-badge") ? 0.95 : 1)
        * (this.facilities.has("server-shoes") ? 0.92 : 1),
      vipChanceBonus: this.facilities.has("paper-lantern") ? 0.03 : 0,
      tipChanceBonus: this.facilities.has("lucky-cat") ? 0.08 : 0,
      feverChargeMultiplier: this.facilities.has("festival-drum") ? 1.2 : 1,
      offlineEfficiencyBonus: this.facilities.has("night-ledger") ? 0.08 : 0,
      fameBonus: this.facilities.has("moon-sign") ? 1 : 0,
      chefTint: this.facilities.has("chef-uniform") ? 0x8ff0df : undefined,
      serverTint: this.facilities.has("server-uniform") ? 0xff9dcd : undefined,
      customerArrivalMultiplier: (this.facilities.has("moon-sign") ? 0.92 : 1)
        * (this.facilities.has("wind-chime") ? 0.95 : 1),
      nightTipChanceBonus: this.facilities.has("neon-set") ? 0.05 : 0,
      specialOrderChanceBonus: this.facilities.has("moon-sign") ? 0.05 : 0,
    };
  }

  public purchaseFacility(
    id: FacilityUpgradeId,
    economy: EconomySystem,
    fameLevel = 6,
  ): "purchased" | "owned" | "insufficient" | "locked" {
    if (this.facilities.has(id)) return "owned";
    if (fameLevel < getFacilityRequiredFame(id)) return "locked";
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        owned: [...this.owned],
        selected: this.selected,
        facilities: [...this.facilities],
        worktopSlots: this.worktopSlotsByChapter[1],
        worktopSlotsByChapter: this.worktopSlotsByChapter,
        avatarOwned: [...this.avatarOwned],
        avatarLook: this.avatarLook,
      }));
    } catch { /* no-op */ }
  }

  private restoreWorktopSlots(chapterId: ChapterId, slots: Record<string, unknown>): void {
    for (const menuItemId of MENU_ITEM_IDS) {
      const value = slots[menuItemId];
      if (typeof value === "number" && Number.isFinite(value)) {
        this.worktopSlotsByChapter[chapterId][menuItemId] = Math.min(
          MAX_WORKTOP_SLOTS,
          Math.max(1, Math.floor(value)),
        );
      }
    }
  }
}

export function getAvatarItem(id: AvatarItemId) {
  const item = AVATAR_ITEMS.find((candidate) => candidate.id === id);
  if (item === undefined) throw new RangeError(`Unknown avatar item: ${id}`);
  return item;
}

export function getFacilityRequiredFame(id: FacilityUpgradeId): number {
  const requirements: Partial<Record<FacilityUpgradeId, number>> = {
    "paper-lantern": 2,
    "blue-canopy": 2,
    "neon-set": 3,
    "moon-sign": 5,
    "lucky-cat": 2,
    "festival-drum": 4,
    "night-ledger": 5,
    "chef-uniform": 3,
    "server-uniform": 3,
    "staff-badge": 4,
    "steam-hood": 3,
    "tea-dispenser": 3,
    "wind-chime": 4,
    "coupon-board": 4,
    "server-shoes": 3,
  };
  return requirements[id] ?? 1;
}

export function getWorktopSlotUpgradeCost(menuPrice: number, currentSlots: number): number {
  const multiplier = currentSlots <= 1 ? 15 : 80;
  return Math.max(100, Math.ceil(Math.max(1, menuPrice) * multiplier / 10) * 10);
}

function createDefaultWorktopSlots(): Record<MenuItemId, number> {
  return Object.fromEntries(MENU_ITEM_IDS.map((menuItemId) => [menuItemId, 1])) as Record<MenuItemId, number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFacilityUpgradeId(value: unknown): value is FacilityUpgradeId {
  return typeof value === "string" && FACILITY_UPGRADES.some((item) => item.id === value);
}

function isOwnerStyleId(value: unknown): value is OwnerStyleId {
  return typeof value === "string" && OWNER_STYLES.some((style) => style.id === value);
}

function isAvatarItemId(value: unknown): value is AvatarItemId {
  return typeof value === "string" && AVATAR_ITEMS.some((item) => item.id === value);
}
