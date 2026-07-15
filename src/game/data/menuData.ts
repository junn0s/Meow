import type { MenuItem, MenuItemId } from "../types/game";

export const MENU_ITEMS = [
  {
    id: "fishcake",
    name: "어묵",
    cookingTimeMs: 3_000,
    price: 10,
  },
  {
    id: "tteokbokki",
    name: "떡볶이",
    cookingTimeMs: 5_000,
    price: 25,
    unlockUpgradeId: "unlock-tteokbokki",
  },
  {
    id: "fish-bread",
    name: "붕어빵",
    cookingTimeMs: 7_000,
    price: 45,
    unlockUpgradeId: "unlock-fish-bread",
  },
] as const satisfies readonly MenuItem[];

export function getMenuItem(menuItemId: MenuItemId): MenuItem {
  const menuItem = MENU_ITEMS.find(({ id }) => id === menuItemId);

  if (menuItem === undefined) {
    throw new Error(`Unknown menu item: ${menuItemId}`);
  }

  return menuItem;
}
