import { CHAPTERS } from "./chapterData";
import type { ChapterId, MenuItem, MenuItemId } from "../types/game";

let activeChapterId: ChapterId = 1;

export const MENU_ITEMS = Object.values(CHAPTERS[1].menus) as readonly MenuItem[];

export function setActiveMenuChapter(chapterId: ChapterId): void {
  activeChapterId = chapterId;
}

export function getActiveMenuChapter(): ChapterId {
  return activeChapterId;
}

export function getMenuItem(menuItemId: MenuItemId, chapterId = activeChapterId): MenuItem {
  const menuItem = CHAPTERS[chapterId].menus[menuItemId];
  if (menuItem === undefined) throw new Error(`Unknown menu item: ${menuItemId}`);
  return menuItem;
}

export function getFoodTextureKey(menuItemId: MenuItemId, chapterId = activeChapterId): string {
  return chapterId === 1 ? `food-${menuItemId}` : `food-chapter-${chapterId}-${menuItemId}`;
}

export function getStationTextureKey(menuItemId: MenuItemId, chapterId = activeChapterId): string {
  return chapterId === 1 ? `station-${menuItemId}` : `station-chapter-${chapterId}-${menuItemId}`;
}
