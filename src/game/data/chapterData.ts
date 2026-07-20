import type { ChapterId, MenuItem, MenuItemId } from "../types/game";

export interface ChapterDefinition {
  readonly id: ChapterId;
  readonly title: string;
  readonly shortTitle: string;
  readonly concept: string;
  readonly finaleName: string;
  readonly finaleMessage: string;
  readonly economyScale: number;
  readonly accent: number;
  readonly secondary: number;
  readonly menus: Readonly<Record<MenuItemId, MenuItem>>;
}

const MENU_IDS: readonly MenuItemId[] = [
  "fishcake", "tteokbokki", "fish-bread", "ramen", "moon-skewer", "moonlight-set",
];

function menuSet(
  names: readonly [string, string, string, string, string, string],
  cookingTimes: readonly [number, number, number, number, number, number],
  economyScale: number,
): Readonly<Record<MenuItemId, MenuItem>> {
  const basePrices = [18, 630, 22_000, 790_000, 28_000_000, 1_000_000_000] as const;
  return Object.freeze(Object.fromEntries(MENU_IDS.map((id, index) => [id, Object.freeze({
    id,
    name: names[index] ?? id,
    cookingTimeMs: cookingTimes[index] ?? 4_000,
    price: Math.round((basePrices[index] ?? 18) * economyScale),
  })])) as Record<MenuItemId, MenuItem>);
}

export const CHAPTERS: Readonly<Record<ChapterId, ChapterDefinition>> = {
  1: {
    id: 1,
    title: "냥포차: 달빛 아래 야식당",
    shortTitle: "달빛 야식당",
    concept: "푸른 네온이 번지는 골목 포차",
    finaleName: "달빛 간판",
    finaleMessage: "골목의 달빛 명소가 완성됐어요!",
    economyScale: 1,
    accent: 0x45d8d0,
    secondary: 0xf15bd1,
    menus: menuSet(
      ["어묵", "떡볶이", "순대", "야식 라면", "달빛 꼬치", "달빛 정식"],
      [4_000, 7_000, 10_000, 13_000, 16_000, 20_000],
      1,
    ),
  },
  2: {
    id: 2,
    title: "냥비치: 선셋 칵테일 바",
    shortTitle: "선셋 칵테일 바",
    concept: "산호빛 노을과 청록 파도가 만나는 해변 바",
    finaleName: "오션 라이트하우스",
    finaleMessage: "해변에서 가장 빛나는 칵테일 바가 열렸어요!",
    economyScale: 2,
    accent: 0x50e3d2,
    secondary: 0xff7e7e,
    menus: menuSet(
      ["코코넛 워터", "블루 레모네이드", "선셋 칵테일", "트로피컬 펀치", "별빛 마티니", "오션 타워"],
      [3_500, 6_000, 8_500, 11_500, 15_000, 19_000],
      2,
    ),
  },
  3: {
    id: 3,
    title: "냥한상: 고양이 한식당",
    shortTitle: "고양이 한식당",
    concept: "기와와 창호, 따뜻한 놋그릇의 한옥 식당",
    finaleName: "황금 솥뚜껑",
    finaleMessage: "정성 가득한 고양이 한상이 완성됐어요!",
    economyScale: 5,
    accent: 0xf0bd68,
    secondary: 0x5fa47a,
    menus: menuSet(
      ["김치전", "돌솥 비빔밥", "불고기", "갈비찜", "궁중 전골", "달빛 한정식"],
      [4_500, 7_500, 10_500, 14_000, 17_000, 21_000],
      5,
    ),
  },
  4: {
    id: 4,
    title: "Le Chat: 별빛 레스토랑",
    shortTitle: "별빛 레스토랑",
    concept: "버건디 벨벳과 황금 조명의 클래식 다이닝",
    finaleName: "미슐냥 스타",
    finaleMessage: "도시 최고의 별빛 레스토랑이 탄생했어요!",
    economyScale: 12,
    accent: 0xf2cc7d,
    secondary: 0xa8596d,
    menus: menuSet(
      ["갈릭 브레드", "트러플 파스타", "안심 스테이크", "버터 랍스터", "셰프 코스", "그랜드 테이스팅"],
      [4_000, 7_000, 11_000, 14_500, 18_000, 22_000],
      12,
    ),
  },
  5: {
    id: 5,
    title: "네코마에: 달빛 오마카세",
    shortTitle: "달빛 오마카세",
    concept: "남색 노렌과 편백 카운터의 심야 스시야",
    finaleName: "장인의 칼",
    finaleMessage: "다섯 번째 가게, 전설의 오마카세가 완성됐어요!",
    economyScale: 30,
    accent: 0x88c9c0,
    secondary: 0xe76f68,
    menus: menuSet(
      ["계란말이", "연어 니기리", "참치 사시미", "장어 덮밥", "장인 스시", "달빛 오마카세"],
      [3_800, 6_500, 9_500, 13_500, 17_500, 22_000],
      30,
    ),
  },
};

export function getChapter(chapterId: ChapterId): ChapterDefinition {
  return CHAPTERS[chapterId];
}

export function getNextChapterId(chapterId: ChapterId): ChapterId | undefined {
  return chapterId < 5 ? (chapterId + 1) as ChapterId : undefined;
}
