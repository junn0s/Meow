import type { MenuItem, MenuItemId } from "../types/game";

export const MENU_ITEMS = [
  {
    id: "fishcake",
    name: "어묵",
    cookingTimeMs: 4_000,
    price: 18,
  },
  {
    id: "tteokbokki",
    name: "떡볶이",
    cookingTimeMs: 7_000,
    price: 630,
  },
  {
    id: "fish-bread",
    name: "붕어빵",
    cookingTimeMs: 10_000,
    price: 22_000,
  },
  {
    id: "ramen",
    name: "야식 라면",
    cookingTimeMs: 13_000,
    price: 790_000,
  },
  {
    id: "moon-skewer",
    name: "달빛 꼬치",
    cookingTimeMs: 16_000,
    price: 28_000_000,
  },
  {
    id: "moonlight-set",
    name: "달빛 정식",
    cookingTimeMs: 20_000,
    price: 1_000_000_000,
  },
] as const satisfies readonly MenuItem[];

export function getMenuItem(menuItemId: MenuItemId): MenuItem {
  const menuItem = MENU_ITEMS.find(({ id }) => id === menuItemId);

  if (menuItem === undefined) {
    throw new Error(`Unknown menu item: ${menuItemId}`);
  }

  return menuItem;
}
