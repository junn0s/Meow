import type { UpgradeData, UpgradeId } from "../types/game";

/** Two seats and the fishcake menu are ready before the player starts. */
export const BASE_SEAT_COUNT = 2;
export const INITIAL_UPGRADE_ID: UpgradeId = "fishcake-counter";
export const DEFAULT_PURCHASED_UPGRADE_IDS: readonly UpgradeId[] = [
  INITIAL_UPGRADE_ID,
];

/**
 * The ten design-document stages in strict purchase order. Costs intentionally
 * match the original plan; only the free starting counter is pre-purchased.
 */
export const UPGRADES = [
  {
    id: "fishcake-counter",
    order: 1,
    name: "어묵 조리대",
    description: "어묵 판매를 시작합니다.",
    cost: 0,
    effectType: "unlock_menu",
    effectTarget: "fishcake",
  },
  {
    id: "add-seat-1",
    order: 2,
    name: "추가 좌석",
    description: "손님 좌석을 두 개 추가합니다.",
    cost: 50,
    prerequisiteId: "fishcake-counter",
    effectType: "add_seat",
    effectValue: 2,
  },
  {
    id: "fast-pot",
    order: 3,
    name: "빠른 냄비",
    description: "모든 음식의 조리 시간을 30% 줄입니다.",
    cost: 100,
    prerequisiteId: "add-seat-1",
    effectType: "cooking_speed",
    effectValue: 0.7,
  },
  {
    id: "unlock-tteokbokki",
    order: 4,
    name: "떡볶이 조리대",
    description: "떡볶이 판매를 시작합니다.",
    cost: 200,
    prerequisiteId: "fast-pot",
    effectType: "unlock_menu",
    effectTarget: "tteokbokki",
  },
  {
    id: "hire-chef",
    order: 5,
    name: "셰프 고양이",
    description: "턱시도 고양이가 주문된 음식을 자동으로 조리합니다.",
    cost: 350,
    prerequisiteId: "unlock-tteokbokki",
    effectType: "hire_worker",
    effectTarget: "chef",
  },
  {
    id: "add-table",
    order: 6,
    name: "추가 테이블",
    description: "손님 좌석을 두 개 더 추가합니다.",
    cost: 500,
    prerequisiteId: "hire-chef",
    effectType: "add_seat",
    effectValue: 2,
  },
  {
    id: "unlock-fish-bread",
    order: 7,
    name: "붕어빵 기계",
    description: "붕어빵 판매를 시작합니다.",
    cost: 700,
    prerequisiteId: "add-table",
    effectType: "unlock_menu",
    effectTarget: "fish-bread",
  },
  {
    id: "hire-server",
    order: 8,
    name: "서버 고양이",
    description: "삼색 고양이가 완성된 음식을 자동으로 서빙합니다.",
    cost: 900,
    prerequisiteId: "unlock-fish-bread",
    effectType: "hire_worker",
    effectTarget: "server",
  },
  {
    id: "neon-sign",
    order: 9,
    name: "네온 간판",
    description: "손님 방문 간격을 30% 줄입니다.",
    cost: 1_200,
    prerequisiteId: "hire-server",
    effectType: "customer_rate",
    effectValue: 0.7,
  },
  {
    id: "moonlight-sign",
    order: 10,
    name: "달빛 간판",
    description: "포장마차를 동네 최고의 야식당으로 완성합니다.",
    cost: 2_000,
    prerequisiteId: "neon-sign",
    effectType: "finish_game",
  },
] as const satisfies readonly UpgradeData[];

export function getUpgrade(upgradeId: UpgradeId): UpgradeData {
  const upgrade = UPGRADES.find(({ id }) => id === upgradeId);

  if (upgrade === undefined) {
    throw new Error(`Unknown upgrade: ${upgradeId}`);
  }

  return upgrade;
}
