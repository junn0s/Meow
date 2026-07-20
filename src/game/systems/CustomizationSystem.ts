import { CHAPTER_IDS, MENU_ITEM_IDS, type ChapterId, type MenuItemId } from "../types/game";
import { getChapter } from "../data/chapterData";
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
export type FacilityPresentationMode = "world" | "staff";
export interface ChapterShopTheme {
  readonly label: string;
  readonly wardrobeTitle: string;
  readonly facilityTitle: string;
  readonly strength: number;
}

const CHAPTER_SHOP_THEMES: Readonly<Record<ChapterId, ChapterShopTheme & {
  readonly ownerNames: readonly [string, string, string, string];
  readonly ownerTints: readonly [number, number, number, number];
  readonly avatarNames: readonly string[];
  readonly facilityNames: readonly string[];
}>> = {
  1: {
    label: "달빛 골목 컬렉션", wardrobeTitle: "MOONLIGHT WARDROBE", facilityTitle: "MOONLIGHT SHOP", strength: 1,
    ownerNames: ["크림", "복숭아", "민트", "한밤"], ownerTints: [0xffffff, 0xffc0a8, 0xa8f0d8, 0x9caee8],
    avatarNames: ["동그란 눈", "나른한 눈", "별빛 눈", "설렘 눈", "모자 없음", "빨간 머리띠", "꼬마 셰프모", "달빛 베레모", "벚꽃 머리핀", "앞치마 없음", "포차 앞치마", "민트 앞치마", "심야 앞치마", "크림 체크 앞치마", "장식 없음", "금빛 방울", "어묵 브로치", "초승달 참", "노을 스카프"],
    facilityNames: ["구리 냄비", "쌍화구", "손질 선반", "달빛 환기후드", "푹신한 의자", "넓은 식탁", "달빛 계산대", "온차 보온통", "청사초롱", "푸른 천막", "달빛 네온", "초승달 간판", "별빛 풍경", "복고양이", "축제 북", "심야 장부", "단골 쿠폰판", "청록 셰프복", "자홍 서버복", "달빛 직원 배지", "날쌘 운동화"],
  },
  2: {
    label: "알로하 선셋 컬렉션", wardrobeTitle: "ALOHA BEACH CLOSET", facilityTitle: "TIKI RESORT SHOP", strength: 1.1,
    ownerNames: ["코코넛", "코랄", "라군", "딥 오션"], ownerTints: [0xffefcf, 0xff9f92, 0x71e3d1, 0x7089cb],
    avatarNames: ["파도 눈", "낮잠 눈", "오션 글리터 눈", "선셋 하트 눈", "맨머리", "히비스커스 밴드", "비치 바텐더 햇", "야자수 베레모", "플루메리아 핀", "기본 비치웨어", "알로하 앞치마", "라군 앞치마", "미드나잇 서퍼복", "코코넛 체크웨어", "장식 없음", "조개 목걸이", "파인애플 브로치", "진주 참", "선셋 파레오"],
    facilityNames: ["트로피컬 셰이커", "더블 블렌더", "가니시 바", "바닷바람 후드", "라탄 라운지체어", "대나무 파티 테이블", "조개 계산대", "코코넛 아이스통", "티키 횃불", "야자잎 캐노피", "웨이브 네온", "오션 등대 간판", "조개 윈드차임", "행운 파인애플", "선셋 콩가", "리조트 매출 장부", "해피아워 보드", "알로하 셰프 셔츠", "코랄 서버 셔츠", "리조트 크루 배지", "샌드 러닝슈즈"],
  },
  3: {
    label: "한옥 잔칫상 컬렉션", wardrobeTitle: "HANOK DRESS ROOM", facilityTitle: "ROYAL HANSIK SHOP", strength: 1.2,
    ownerNames: ["백자", "홍시", "쑥빛", "쪽빛"], ownerTints: [0xfff4dc, 0xe99375, 0x9bc695, 0x7187ad],
    avatarNames: ["단정한 눈", "사색 눈", "옥빛 눈", "복주머니 눈", "맨머리", "전통 머리띠", "궁중 조리모", "선비 갓", "매화 비녀", "기본 한복", "주막 앞치마", "쑥빛 두루마기", "쪽빛 한복", "백자 문양 한복", "장식 없음", "노리개 방울", "놋숟가락 브로치", "옥 노리개", "단풍 목도리"],
    facilityNames: ["무쇠 가마솥", "쌍아궁이", "반찬 손질상", "한옥 연기후드", "비단 방석", "대형 소반", "놋쇠 계산대", "전통 보온 주전자", "연꽃 등롱", "기와 처마", "창호 네온", "한옥 현판", "대나무 풍경", "복주머니 고양이", "사물놀이 장구", "한지 장부", "단골 도장판", "궁중 조리복", "한복 서빙복", "왕실 직원 패", "고무신 운동화"],
  },
  4: {
    label: "벨벳 파인다이닝 컬렉션", wardrobeTitle: "LE CHAT ATELIER", facilityTitle: "GRAND DINING BOUTIQUE", strength: 1.3,
    ownerNames: ["샹파뉴", "로제", "세이지", "미드나잇 블루"], ownerTints: [0xffedc2, 0xdca0a7, 0x9bb7a0, 0x70789e],
    avatarNames: ["클래식 눈", "시크 눈", "다이아 눈", "로제 하트 눈", "맨머리", "벨벳 헤어밴드", "토크 블랑슈", "마에스트로 베레", "장미 코사지", "기본 유니폼", "버건디 앞치마", "세이지 베스트", "블랙 타이 웨어", "샹파뉴 체크 베스트", "장식 없음", "골드 커프", "트러플 브로치", "크리스털 참", "로제 스카프"],
    facilityNames: ["프렌치 코퍼팬", "더블 가스레인지", "플레이팅 패스", "브라스 후드", "벨벳 다이닝체어", "마호가니 테이블", "마블 카운터", "와인 칠러", "크리스털 램프", "버건디 어닝", "샹들리에 네온", "미슐냥 스타 간판", "실버 모빌", "행운 샴페인", "재즈 스테이지", "소믈리에 장부", "멤버십 보드", "마스터 셰프 재킷", "로제 서버 베스트", "골드 크루 브로치", "에나멜 서비스화"],
  },
  5: {
    label: "장인 오마카세 컬렉션", wardrobeTitle: "NEKOMAE KIMONO", facilityTitle: "TAKUMI TOOL SHOP", strength: 1.4,
    ownerNames: ["샤리", "사쿠라", "와사비", "남색 노렌"], ownerTints: [0xfff1d6, 0xf4a9b7, 0x9bc49a, 0x65769c],
    avatarNames: ["장인 눈", "명상 눈", "물결 눈", "사쿠라 하트 눈", "맨머리", "하치마키", "스시 장인모", "남색 두건", "벚꽃 칸자시", "기본 사무에", "적색 마에카케", "와사비 사무에", "남색 장인복", "편백 체크복", "장식 없음", "스즈 방울", "참치 브로치", "옥빛 네츠케", "사쿠라 목도리"],
    facilityNames: ["장인 도나베", "쌍 로바타", "사시미 작업대", "편백 배기후드", "다다미 좌석", "편백 카운터", "스시 계산대", "사케 워머", "와시 초롱", "남색 노렌", "물결 네온", "장인 목패", "에도 풍경", "행운 다루마", "마쓰리 타이코", "오마카세 장부", "단골 목찰판", "백색 이타마에복", "남색 나카이복", "장인 문장", "타비 서비스화"],
  },
};
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
const STORAGE_KEY = "meow-night-diner.customization.v2";
const LEGACY_STORAGE_KEY = "meow-night-diner.customization.v1";
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
      localStorage.removeItem(LEGACY_STORAGE_KEY);
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
          chapterId?: unknown;
        };
        if (isChapterId(parsed.chapterId)) this.activeChapterId = parsed.chapterId;
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

  public getShopTheme(): ChapterShopTheme { return CHAPTER_SHOP_THEMES[this.activeChapterId]; }
  public getOwnerStyles() {
    const theme = CHAPTER_SHOP_THEMES[this.activeChapterId];
    return OWNER_STYLES.map((style, index) => ({
      ...style,
      name: theme.ownerNames[index] ?? style.name,
      tint: theme.ownerTints[index] ?? style.tint,
    }));
  }
  public getAvatarItems() {
    const theme = CHAPTER_SHOP_THEMES[this.activeChapterId];
    return AVATAR_ITEMS.map((item, index) => ({ ...item, name: theme.avatarNames[index] ?? item.name }));
  }
  public getFacilityUpgrades() {
    const theme = CHAPTER_SHOP_THEMES[this.activeChapterId];
    return FACILITY_UPGRADES.map((item, index) => ({
      ...item,
      name: theme.facilityNames[index] ?? item.name,
      effect: getFacilityEffectLabel(item.id, theme.strength),
    }));
  }
  public getSelected() {
    const styles = this.getOwnerStyles();
    return styles.find((style) => style.id === this.selected) ?? styles[0] ?? OWNER_STYLES[0];
  }
  public isOwned(id: OwnerStyleId): boolean { return this.owned.has(id); }
  public isFacilityOwned(id: FacilityUpgradeId): boolean { return this.facilities.has(id); }
  public getOwnedFacilityIds(): readonly FacilityUpgradeId[] { return [...this.facilities]; }
  public setActiveChapter(chapterId: ChapterId): void {
    if (this.activeChapterId === chapterId) return;
    this.resetInventory(chapterId);
    this.persist();
  }
  public getWorktopSlotCount(menuItemId: MenuItemId): number { return this.worktopSlotsByChapter[this.activeChapterId][menuItemId]; }
  public getAvatarLook(): AvatarLook { return { ...this.avatarLook }; }
  public isAvatarOwned(id: AvatarItemId): boolean { return this.avatarOwned.has(id); }
  public getOwnerStyleCost(id: OwnerStyleId): number {
    return this.scaleShopCost(this.getOwnerStyles().find((style) => style.id === id)?.cost ?? 0);
  }
  public getAvatarItemCost(id: AvatarItemId): number {
    return this.scaleShopCost(this.getAvatarItems().find((item) => item.id === id)?.cost ?? 0);
  }
  public getFacilityCost(id: FacilityUpgradeId): number {
    return this.scaleShopCost(this.getFacilityUpgrades().find((item) => item.id === id)?.cost ?? 0);
  }

  /** Clears every shop purchase/equipment/placement for an entirely fresh night. */
  public resetAllPurchases(): void {
    this.resetInventory(1);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch { /* In-memory defaults are still reset when storage is unavailable. */ }
  }

  private resetInventory(chapterId: ChapterId): void {
    this.owned = new Set<OwnerStyleId>(["cream"]);
    this.selected = "cream";
    this.facilities = new Set<FacilityUpgradeId>();
    this.activeChapterId = chapterId;
    this.worktopSlotsByChapter = Object.fromEntries(
      CHAPTER_IDS.map((chapterId) => [chapterId, createDefaultWorktopSlots()]),
    ) as Record<ChapterId, Record<MenuItemId, number>>;
    this.avatarOwned = new Set<AvatarItemId>([
      "eyes-round",
      "hat-none",
      "apron-none",
      "acc-none",
    ]);
    this.avatarLook = {
      eyes: "eyes-round",
      hat: "hat-none",
      apron: "apron-none",
      accessory: "acc-none",
    };
  }

  public purchaseOrEquipAvatarItem(
    id: AvatarItemId,
    economy: EconomySystem,
  ): "purchased" | "equipped" | "insufficient" {
    const item = this.getAvatarItems().find((candidate) => candidate.id === id);
    if (item === undefined) return "insufficient";
    const purchased = !this.avatarOwned.has(id);
    if (purchased) {
      if (!economy.trySpend(this.getAvatarItemCost(id))) return "insufficient";
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
    const strength = this.getShopTheme().strength;
    const reduction = (amount: number): number => 1 - amount * strength;
    const increase = (amount: number): number => 1 + amount * strength;
    return {
      cookingTimeMultiplier: (this.facilities.has("copper-pot") ? reduction(0.1) : 1)
        * (this.facilities.has("double-burner") ? reduction(0.08) : 1)
        * (this.facilities.has("steam-hood") ? reduction(0.06) : 1),
      patienceMultiplier: (this.facilities.has("soft-chair") ? increase(0.15) : 1)
        * (this.facilities.has("blue-canopy") ? increase(0.1) : 1)
        * (this.facilities.has("tea-dispenser") ? increase(0.12) : 1),
      bonusSeats: this.facilities.has("wide-table") ? 1 : 0,
      revenueMultiplier: (this.facilities.has("neon-set") ? increase(0.1) : 1)
        * (this.facilities.has("coupon-board") ? increase(0.06) : 1),
      visualTier: Math.min(4, this.facilities.size),
      chefActionTimeMultiplier: (this.facilities.has("prep-rack") ? reduction(0.12) : 1)
        * (this.facilities.has("staff-badge") ? reduction(0.05) : 1),
      serverActionTimeMultiplier: (this.facilities.has("moon-counter") ? reduction(0.12) : 1)
        * (this.facilities.has("staff-badge") ? reduction(0.05) : 1)
        * (this.facilities.has("server-shoes") ? reduction(0.08) : 1),
      vipChanceBonus: this.facilities.has("paper-lantern") ? 0.03 * strength : 0,
      tipChanceBonus: this.facilities.has("lucky-cat") ? 0.08 * strength : 0,
      feverChargeMultiplier: this.facilities.has("festival-drum") ? increase(0.2) : 1,
      offlineEfficiencyBonus: this.facilities.has("night-ledger") ? 0.08 * strength : 0,
      fameBonus: this.facilities.has("moon-sign") ? 1 : 0,
      chefTint: this.facilities.has("chef-uniform") ? getChapter(this.activeChapterId).accent : undefined,
      serverTint: this.facilities.has("server-uniform") ? getChapter(this.activeChapterId).secondary : undefined,
      customerArrivalMultiplier: (this.facilities.has("moon-sign") ? reduction(0.08) : 1)
        * (this.facilities.has("wind-chime") ? reduction(0.05) : 1),
      nightTipChanceBonus: this.facilities.has("neon-set") ? 0.05 * strength : 0,
      specialOrderChanceBonus: this.facilities.has("moon-sign") ? 0.05 * strength : 0,
    };
  }

  public purchaseFacility(
    id: FacilityUpgradeId,
    economy: EconomySystem,
    fameLevel = 6,
  ): "purchased" | "owned" | "insufficient" | "locked" {
    if (this.facilities.has(id)) return "owned";
    if (fameLevel < getFacilityRequiredFame(id)) return "locked";
    const item = this.getFacilityUpgrades().find((candidate) => candidate.id === id);
    if (item === undefined || !economy.trySpend(this.getFacilityCost(id))) return "insufficient";
    this.facilities.add(id);
    this.persist();
    return "purchased";
  }

  public purchaseOrEquip(id: OwnerStyleId, economy: EconomySystem): "purchased" | "equipped" | "insufficient" {
    const style = this.getOwnerStyles().find((candidate) => candidate.id === id);
    if (style === undefined) return "insufficient";
    if (!this.owned.has(id)) {
      if (!economy.trySpend(this.getOwnerStyleCost(id))) return "insufficient";
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
        chapterId: this.activeChapterId,
      }));
    } catch { /* no-op */ }
  }

  private scaleShopCost(baseCost: number): number {
    return Math.round(baseCost * getChapter(this.activeChapterId).economyScale);
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

function getFacilityEffectLabel(id: FacilityUpgradeId, strength: number): string {
  const percent = (base: number): number => Math.round(base * strength);
  const labels: Record<FacilityUpgradeId, string> = {
    "copper-pot": `조리 -${percent(10)}%`,
    "double-burner": `조리 -${percent(8)}%`,
    "prep-rack": `셰프 +${percent(12)}%`,
    "steam-hood": `조리 -${percent(6)}%`,
    "soft-chair": `인내심 +${percent(15)}%`,
    "wide-table": "좌석 +1",
    "moon-counter": `서버 +${percent(12)}%`,
    "tea-dispenser": `인내심 +${percent(12)}%`,
    "paper-lantern": `VIP +${percent(3)}%`,
    "blue-canopy": `인내심 +${percent(10)}%`,
    "neon-set": `결제 +${percent(10)}%`,
    "moon-sign": `명성 +1 · 특별주문 +${percent(5)}%`,
    "wind-chime": `손님 +${percent(5)}%`,
    "lucky-cat": `팁 +${percent(8)}%`,
    "festival-drum": `피버 +${percent(20)}%`,
    "night-ledger": `오프라인 +${percent(8)}%`,
    "coupon-board": `결제 +${percent(6)}%`,
    "chef-uniform": "셰프 테마 외형",
    "server-uniform": "서버 테마 외형",
    "staff-badge": `직원 +${percent(5)}%`,
    "server-shoes": `서버 +${percent(8)}%`,
  };
  return labels[id];
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

/** Staff equipment belongs on worker sprites and must never be placed on the diner floor. */
export function getFacilityPresentationMode(id: string): FacilityPresentationMode {
  const item = FACILITY_UPGRADES.find((candidate) => candidate.id === id);
  return item?.category === "staff" ? "staff" : "world";
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

function isChapterId(value: unknown): value is ChapterId {
  return typeof value === "number" && CHAPTER_IDS.includes(value as ChapterId);
}
