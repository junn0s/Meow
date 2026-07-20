import Phaser from "phaser";
import { MAX_WORKERS_PER_ROLE } from "../data/progressionData";
import type { AvatarLook, FacilityUpgradeId } from "../systems/CustomizationSystem";
import { CHAPTER_IDS, MENU_ITEM_IDS, type ChapterId, type MenuItemId } from "../types/game";
import { getChapter } from "../data/chapterData";

/** A small, shared palette for the warm night-market look. */
export const PIXEL_PALETTE = {
  transparent: 0x000000,
  night: 0x11162f,
  nightLight: 0x263259,
  outline: 0x38283a,
  shadow: 0x161426,
  cream: 0xffe6b7,
  warmWhite: 0xfff4d6,
  orange: 0xf2a23a,
  orangeLight: 0xffc85c,
  orangeDark: 0xc66b2b,
  red: 0xb83b42,
  redLight: 0xe65a4f,
  redDark: 0x772d3a,
  wood: 0xa9633c,
  woodLight: 0xd08a4d,
  woodDark: 0x70402f,
  steel: 0x8ca0aa,
  steelLight: 0xc9d2cf,
  charcoal: 0x30313f,
  brown: 0x80533d,
  tan: 0xd9a76c,
  white: 0xf7eedf,
  black: 0x242330,
  pink: 0xf08c8e,
  green: 0x6fa66f,
  mint: 0xa8d8a0,
  yellow: 0xffd45c,
  gold: 0xf5b83b,
  goldLight: 0xffe077,
  blue: 0x6e9fc7,
} as const;

export const PIXEL_TEXTURE_KEYS = {
  player: {
    down: ["player-down-0", "player-down-1"],
    up: ["player-up-0", "player-up-1"],
    left: ["player-left-0", "player-left-1"],
    right: ["player-right-0", "player-right-1"],
  },
  chef: ["chef-0", "chef-1"],
  server: ["server-0", "server-1"],
  customers: {
    rabbit: ["customer-rabbit-0", "customer-rabbit-1"],
    dog: ["customer-dog-0", "customer-dog-1"],
    hamster: ["customer-hamster-0", "customer-hamster-1"],
    raccoon: ["customer-raccoon-0", "customer-raccoon-1"],
  },
  food: {
    fishcake: "food-fishcake",
    tteokbokki: "food-tteokbokki",
    sundae: "food-fish-bread",
    ramen: "food-ramen",
    moonSkewer: "food-moon-skewer",
    moonlightSet: "food-moonlight-set",
  },
  furniture: {
    table: "table",
    seat: "seat",
  },
  stations: {
    fishcake: "station-fishcake",
    tteokbokki: "station-tteokbokki",
    sundae: "station-fish-bread",
    ramen: "station-ramen",
    moonSkewer: "station-moon-skewer",
    moonlightSet: "station-moonlight-set",
  },
  signs: {
    stall: "sign-stall",
    neon: "sign-neon",
    moon: "sign-moon",
  },
  ui: {
    coin: "coin",
    heart: "heart",
    orderBubble: "order-bubble",
    orderFishcake: "order-bubble-fishcake",
    orderTteokbokki: "order-bubble-tteokbokki",
    orderSundae: "order-bubble-fish-bread",
    interaction: "interaction-marker",
    ratingStar: "rating-star",
  },
  effects: {
    steam: ["steam-0", "steam-1"],
    sparkle: "sparkle",
    rainDrop: "rain-drop",
  },
} as const;

type DeepStringValue<T> = T extends string
  ? T
  : T extends readonly (infer Item)[]
    ? DeepStringValue<Item>
    : T extends object
      ? { [Key in keyof T]: DeepStringValue<T[Key]> }[keyof T]
      : never;

export type PixelTextureKey = DeepStringValue<typeof PIXEL_TEXTURE_KEYS>;

type Graphics = Phaser.GameObjects.Graphics;
type DrawTexture = (graphics: Graphics) => void;
type Direction = "down" | "up" | "left" | "right";
type CustomerKind = "rabbit" | "dog" | "hamster" | "raccoon";
type FoodKind =
  | "fishcake"
  | "tteokbokki"
  | "fish-bread"
  | "ramen"
  | "moon-skewer"
  | "moonlight-set";

interface TexturePainter {
  paint(key: string, width: number, height: number, draw: DrawTexture): void;
  destroy(): void;
}

function createPainter(scene: Phaser.Scene): TexturePainter {
  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);

  return {
    paint(key, width, height, draw): void {
      if (scene.textures.exists(key)) {
        return;
      }

      graphics.clear();
      draw(graphics);
      graphics.generateTexture(key, width, height);
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    },
    destroy(): void {
      graphics.destroy();
    },
  };
}

function rect(graphics: Graphics, color: number, x: number, y: number, width: number, height: number): void {
  graphics.fillStyle(color, 1);
  graphics.fillRect(x, y, width, height);
}

function pixelShadow(graphics: Graphics, x = 7, y = 27, width = 18): void {
  graphics.fillStyle(PIXEL_PALETTE.shadow, 0.34);
  graphics.fillRect(x, y, width, 3);
  graphics.fillRect(x + 2, y - 1, width - 4, 1);
}

function multiplyColor(color: number, tint: number): number {
  const red = Math.round(((color >> 16) & 0xff) * ((tint >> 16) & 0xff) / 255);
  const green = Math.round(((color >> 8) & 0xff) * ((tint >> 8) & 0xff) / 255);
  const blue = Math.round((color & 0xff) * (tint & 0xff) / 255);
  return (red << 16) | (green << 8) | blue;
}

function drawAvatarDetails(
  graphics: Graphics,
  direction: Direction,
  frame: number,
  look: AvatarLook,
  muzzleColor: number,
  chapterId: ChapterId,
): void {
  const chapter = getChapter(chapterId);
  const bob = frame === 1 ? 1 : 0;
  const front = direction === "down";
  const side = direction === "left" || direction === "right";

  if (look.apron !== "apron-none" && direction !== "up") {
    const colors: Record<Exclude<AvatarLook["apron"], "apron-none">, number> = {
      "apron-red": chapter.secondary,
      "apron-mint": chapter.accent,
      "apron-night": multiplyColor(chapter.accent, 0x6f789d),
      "apron-cream": 0xffe3a8,
    };
    const color = colors[look.apron];
    rect(graphics, PIXEL_PALETTE.outline, side ? 12 : 10, 18 + bob, side ? 10 : 12, 8);
    rect(graphics, color, side ? 13 : 11, 18 + bob, side ? 8 : 10, 7);
    if (look.apron === "apron-night") rect(graphics, PIXEL_PALETTE.goldLight, 15, 20 + bob, 2, 2);
    if (look.apron === "apron-cream") {
      rect(graphics, 0xd78365, side ? 15 : 13, 18 + bob, 2, 7);
      rect(graphics, 0xd78365, side ? 13 : 11, 21 + bob, side ? 8 : 10, 1);
    }
  }

  if (front) {
    rect(graphics, muzzleColor, 10, 10 + bob, 12, 4);
    if (look.eyes === "eyes-sleepy") {
      rect(graphics, PIXEL_PALETTE.outline, 11, 12 + bob, 3, 1);
      rect(graphics, PIXEL_PALETTE.outline, 18, 12 + bob, 3, 1);
    } else if (look.eyes === "eyes-sparkle") {
      rect(graphics, 0x3c7d8d, 11, 10 + bob, 3, 3);
      rect(graphics, 0x3c7d8d, 18, 10 + bob, 3, 3);
      rect(graphics, 0xffffff, 11, 10 + bob, 1, 1);
      rect(graphics, 0xffffff, 18, 10 + bob, 1, 1);
    } else if (look.eyes === "eyes-heart") {
      rect(graphics, 0xe95b78, 11, 10 + bob, 3, 2);
      rect(graphics, 0xe95b78, 12, 12 + bob, 1, 1);
      rect(graphics, 0xe95b78, 18, 10 + bob, 3, 2);
      rect(graphics, 0xe95b78, 19, 12 + bob, 1, 1);
    } else {
      rect(graphics, PIXEL_PALETTE.outline, 11, 11 + bob, 2, 2);
      rect(graphics, PIXEL_PALETTE.outline, 19, 11 + bob, 2, 2);
    }
  }

  if (look.hat === "hat-band") {
    rect(graphics, PIXEL_PALETTE.outline, 7, 7 + bob, 18, 3);
    rect(graphics, chapter.secondary, 8, 7 + bob, 16, 2);
    rect(graphics, chapter.secondary, direction === "left" ? 23 : 5, 8 + bob, 4, 4);
  } else if (look.hat === "hat-chef") {
    rect(graphics, PIXEL_PALETTE.outline, 9, 2 + bob, 14, 7);
    rect(graphics, PIXEL_PALETTE.warmWhite, 10, 3 + bob, 12, 6);
    rect(graphics, PIXEL_PALETTE.warmWhite, 7, 4 + bob, 5, 4);
    rect(graphics, PIXEL_PALETTE.warmWhite, 20, 4 + bob, 5, 4);
  } else if (look.hat === "hat-moon") {
    rect(graphics, PIXEL_PALETTE.outline, 7, 4 + bob, 18, 5);
    rect(graphics, chapter.accent, 8, 4 + bob, 16, 4);
    rect(graphics, PIXEL_PALETTE.goldLight, 18, 5 + bob, 3, 2);
  } else if (look.hat === "hat-flower") {
    rect(graphics, chapter.secondary, direction === "left" ? 8 : 20, 5 + bob, 3, 3);
    rect(graphics, 0xffd8e2, direction === "left" ? 7 : 19, 6 + bob, 5, 1);
    rect(graphics, PIXEL_PALETTE.goldLight, direction === "left" ? 9 : 21, 6 + bob, 1, 1);
  }

  if (look.accessory !== "acc-none" && direction !== "up") {
    if (look.accessory === "acc-scarf") {
      rect(graphics, PIXEL_PALETTE.outline, side ? 11 : 10, 17 + bob, side ? 12 : 13, 3);
      rect(graphics, chapter.secondary, side ? 12 : 11, 17 + bob, side ? 10 : 11, 2);
      rect(graphics, chapter.accent, direction === "left" ? 20 : 18, 19 + bob, 3, 5);
    } else {
      const color = look.accessory === "acc-bell"
        ? PIXEL_PALETTE.goldLight
        : look.accessory === "acc-fish" ? chapter.secondary : chapter.accent;
      rect(graphics, PIXEL_PALETTE.outline, side ? 12 : 15, 17 + bob, 4, 4);
      rect(graphics, color, side ? 13 : 16, 18 + bob, 2, 2);
    }
  }
}

function drawCheesePlayer(
  graphics: Graphics,
  direction: Direction,
  frame: number,
  look?: AvatarLook,
  ownerTint = 0xffffff,
  chapterId: ChapterId = 1,
): void {
  const palette = {
    ...PIXEL_PALETTE,
    orange: multiplyColor(PIXEL_PALETTE.orange, ownerTint),
    orangeDark: multiplyColor(PIXEL_PALETTE.orangeDark, ownerTint),
    cream: multiplyColor(PIXEL_PALETTE.cream, ownerTint),
  };
  const bob = frame === 1 ? 1 : 0;
  const leftFootY = frame === 0 ? 25 : 24;
  const rightFootY = frame === 0 ? 24 : 25;

  pixelShadow(graphics);

  if (direction === "left" || direction === "right") {
    const facingLeft = direction === "left";
    const headX = facingLeft ? 5 : 12;
    const bodyX = facingLeft ? 11 : 7;
    const snoutX = facingLeft ? 3 : 24;
    const tailX = facingLeft ? 23 : 5;

    rect(graphics, palette.outline, bodyX - 1, 15 + bob, 17, 11);
    rect(graphics, palette.orange, bodyX, 16 + bob, 15, 9);
    rect(graphics, palette.outline, tailX, 18 + bob, 4, 3);
    rect(graphics, palette.orangeDark, facingLeft ? tailX + 2 : tailX - 2, 16 + bob, 4, 3);
    rect(graphics, palette.outline, headX, 7 + bob, 15, 13);
    rect(graphics, palette.orange, headX + 1, 8 + bob, 13, 11);
    rect(graphics, palette.outline, headX + 1, 4 + bob, 5, 5);
    rect(graphics, palette.outline, headX + 9, 4 + bob, 5, 5);
    rect(graphics, palette.orange, headX + 2, 5 + bob, 3, 4);
    rect(graphics, palette.orange, headX + 10, 5 + bob, 3, 4);
    rect(graphics, palette.cream, snoutX, 13 + bob, 5, 4);
    rect(graphics, palette.outline, facingLeft ? headX + 2 : headX + 11, 11 + bob, 2, 2);
    rect(graphics, palette.pink, facingLeft ? snoutX : snoutX + 3, 14 + bob, 2, 1);
    rect(graphics, palette.orangeDark, headX + 6, 8 + bob, 2, 4);
    rect(graphics, palette.outline, bodyX + 2, leftFootY, 5, 3);
    rect(graphics, palette.outline, bodyX + 10, rightFootY, 5, 3);
    rect(graphics, palette.cream, bodyX + 3, leftFootY, 3, 2);
    rect(graphics, palette.cream, bodyX + 11, rightFootY, 3, 2);
    if (look !== undefined) drawAvatarDetails(graphics, direction, frame, look, palette.cream, chapterId);
    return;
  }

  rect(graphics, palette.outline, 9, 15 + bob, 14, 12);
  rect(graphics, palette.orange, 10, 16 + bob, 12, 10);
  rect(graphics, palette.outline, 22, 18 + bob, 5, 3);
  rect(graphics, palette.orangeDark, 24, 16 + bob, 4, 3);
  rect(graphics, palette.outline, 7, 7 + bob, 18, 13);
  rect(graphics, palette.orange, 8, 8 + bob, 16, 11);
  rect(graphics, palette.outline, 8, 3 + bob, 6, 6);
  rect(graphics, palette.outline, 18, 3 + bob, 6, 6);
  rect(graphics, palette.orange, 9, 4 + bob, 4, 5);
  rect(graphics, palette.orange, 19, 4 + bob, 4, 5);
  rect(graphics, palette.pink, 10, 5 + bob, 2, 2);
  rect(graphics, palette.pink, 20, 5 + bob, 2, 2);
  rect(graphics, palette.orangeDark, 11, 8 + bob, 2, 4);
  rect(graphics, palette.orangeDark, 19, 8 + bob, 2, 4);

  if (direction === "down") {
    rect(graphics, palette.cream, 11, 14 + bob, 10, 5);
    rect(graphics, palette.outline, 11, 11 + bob, 2, 2);
    rect(graphics, palette.outline, 19, 11 + bob, 2, 2);
    rect(graphics, palette.pink, 15, 14 + bob, 2, 2);
    rect(graphics, palette.outline, 15, 16 + bob, 1, 1);
    rect(graphics, palette.outline, 17, 16 + bob, 1, 1);
  } else {
    rect(graphics, palette.orangeDark, 14, 9 + bob, 4, 2);
    rect(graphics, palette.orangeDark, 11, 13 + bob, 3, 2);
    rect(graphics, palette.orangeDark, 18, 13 + bob, 3, 2);
  }

  rect(graphics, palette.outline, 9, leftFootY, 6, 3);
  rect(graphics, palette.outline, 17, rightFootY, 6, 3);
  rect(graphics, palette.cream, 11, leftFootY, 3, 2);
  rect(graphics, palette.cream, 18, rightFootY, 3, 2);
  if (look !== undefined) drawAvatarDetails(graphics, direction, frame, look, palette.cream, chapterId);
}

function drawChef(graphics: Graphics, frame: number, rank = 0): void {
  const palette = PIXEL_PALETTE;
  const bob = frame === 1 ? 1 : 0;
  pixelShadow(graphics);
  rect(graphics, palette.outline, 9, 16 + bob, 14, 11);
  rect(graphics, palette.white, 10, 17 + bob, 12, 9);
  rect(graphics, palette.outline, 7, 8 + bob, 18, 12);
  rect(graphics, palette.black, 8, 9 + bob, 16, 10);
  rect(graphics, palette.white, 12, 14 + bob, 8, 5);
  rect(graphics, palette.outline, 11, 1 + bob, 10, 8);
  rect(graphics, palette.white, 12, 2 + bob, 8, 7);
  rect(graphics, palette.outline, 8, 4 + bob, 6, 5);
  rect(graphics, palette.outline, 18, 4 + bob, 6, 5);
  rect(graphics, palette.white, 9, 5 + bob, 5, 4);
  rect(graphics, palette.white, 18, 5 + bob, 5, 4);
  rect(graphics, palette.outline, 11, 11 + bob, 2, 2);
  rect(graphics, palette.outline, 19, 11 + bob, 2, 2);
  rect(graphics, palette.pink, 15, 14 + bob, 2, 2);
  rect(graphics, palette.red, 15, 18 + bob, 2, 2);
  if (rank > 0) {
    const rankColors = [
      palette.redLight, palette.blue, palette.green, palette.goldLight, palette.pink,
    ] as const;
    const rankColor = rankColors[Math.min(4, rank - 1)] ?? palette.redLight;
    rect(graphics, rankColor, 12, 7 + bob, 8, 2);
    rect(graphics, rankColor, 11, 20 + bob, 3 + rank, 2);
  }
  rect(graphics, palette.outline, frame === 0 ? 9 : 10, 25, 6, 3);
  rect(graphics, palette.outline, frame === 0 ? 17 : 16, 25, 6, 3);
}

function drawServer(graphics: Graphics, frame: number, rank = 0): void {
  const palette = PIXEL_PALETTE;
  const bob = frame === 1 ? 1 : 0;
  pixelShadow(graphics);
  rect(graphics, palette.outline, 8, 16 + bob, 16, 11);
  rect(graphics, palette.orange, 9, 17 + bob, 14, 9);
  rect(graphics, palette.cream, 12, 18 + bob, 8, 8);
  rect(graphics, palette.outline, 7, 7 + bob, 18, 13);
  rect(graphics, palette.white, 8, 8 + bob, 16, 11);
  rect(graphics, palette.outline, 8, 3 + bob, 6, 6);
  rect(graphics, palette.outline, 18, 3 + bob, 6, 6);
  rect(graphics, palette.orange, 9, 4 + bob, 4, 5);
  rect(graphics, palette.black, 19, 4 + bob, 4, 5);
  rect(graphics, palette.orange, 8, 8 + bob, 7, 6);
  rect(graphics, palette.black, 18, 8 + bob, 6, 7);
  rect(graphics, palette.brown, 14, 8 + bob, 4, 5);
  rect(graphics, palette.outline, 11, 12 + bob, 2, 2);
  rect(graphics, palette.outline, 19, 12 + bob, 2, 2);
  rect(graphics, palette.pink, 15, 15 + bob, 2, 2);
  rect(graphics, palette.red, 13, 18 + bob, 3, 3);
  rect(graphics, palette.redDark, 16, 18 + bob, 3, 3);
  if (rank > 0) {
    const rankColors = [
      palette.redLight, palette.blue, palette.green, palette.goldLight, palette.pink,
    ] as const;
    const rankColor = rankColors[Math.min(4, rank - 1)] ?? palette.redLight;
    rect(graphics, rankColor, 21, 17 + bob, 3, 3);
    rect(graphics, palette.outline, 23, 13 + bob, 7, 2);
    rect(graphics, rankColor, 24, 12 + bob, 5, 2);
  }
  rect(graphics, palette.outline, frame === 0 ? 8 : 10, 25, 7, 3);
  rect(graphics, palette.outline, frame === 0 ? 17 : 15, 25, 7, 3);
}

function drawCustomer(graphics: Graphics, kind: CustomerKind, frame: number): void {
  const palette = PIXEL_PALETTE;
  const bob = frame === 1 ? 1 : 0;
  pixelShadow(graphics, 7, 27, 18);

  if (kind === "rabbit") {
    rect(graphics, palette.outline, 10, 1 + bob, 5, 12);
    rect(graphics, palette.outline, 18, 1 + bob, 5, 12);
    rect(graphics, palette.white, 11, 2 + bob, 3, 10);
    rect(graphics, palette.white, 19, 2 + bob, 3, 10);
    rect(graphics, palette.pink, 12, 3 + bob, 1, 7);
    rect(graphics, palette.pink, 20, 3 + bob, 1, 7);
    rect(graphics, palette.outline, 7, 9 + bob, 18, 13);
    rect(graphics, palette.white, 8, 10 + bob, 16, 11);
    rect(graphics, palette.outline, 10, 13 + bob, 2, 2);
    rect(graphics, palette.outline, 20, 13 + bob, 2, 2);
    rect(graphics, palette.pink, 15, 16 + bob, 3, 2);
    rect(graphics, palette.outline, 9, 20 + bob, 14, 7);
    rect(graphics, palette.blue, 10, 21 + bob, 12, 5);
  } else if (kind === "dog") {
    rect(graphics, palette.outline, 7, 8 + bob, 18, 14);
    rect(graphics, palette.tan, 8, 9 + bob, 16, 12);
    rect(graphics, palette.outline, 3, 9 + bob, 7, 11);
    rect(graphics, palette.brown, 4, 10 + bob, 5, 9);
    rect(graphics, palette.outline, 22, 9 + bob, 7, 11);
    rect(graphics, palette.brown, 23, 10 + bob, 5, 9);
    rect(graphics, palette.outline, 10, 12 + bob, 2, 2);
    rect(graphics, palette.outline, 20, 12 + bob, 2, 2);
    rect(graphics, palette.cream, 12, 15 + bob, 8, 5);
    rect(graphics, palette.outline, 15, 15 + bob, 3, 2);
    rect(graphics, palette.outline, 9, 20 + bob, 14, 7);
    rect(graphics, palette.green, 10, 21 + bob, 12, 5);
    rect(graphics, palette.yellow, 15, 20 + bob, 3, 3);
  } else if (kind === "hamster") {
    rect(graphics, palette.outline, 6, 8 + bob, 20, 15);
    rect(graphics, palette.tan, 7, 9 + bob, 18, 13);
    rect(graphics, palette.outline, 6, 5 + bob, 7, 7);
    rect(graphics, palette.outline, 20, 5 + bob, 7, 7);
    rect(graphics, palette.pink, 8, 7 + bob, 4, 4);
    rect(graphics, palette.pink, 21, 7 + bob, 4, 4);
    rect(graphics, palette.cream, 9, 14 + bob, 6, 6);
    rect(graphics, palette.cream, 18, 14 + bob, 6, 6);
    rect(graphics, palette.outline, 10, 12 + bob, 2, 2);
    rect(graphics, palette.outline, 21, 12 + bob, 2, 2);
    rect(graphics, palette.pink, 15, 16 + bob, 3, 2);
    rect(graphics, palette.outline, 9, 21 + bob, 15, 6);
    rect(graphics, palette.red, 10, 22 + bob, 13, 4);
  } else {
    rect(graphics, palette.outline, 6, 8 + bob, 20, 14);
    rect(graphics, palette.steel, 7, 9 + bob, 18, 12);
    rect(graphics, palette.outline, 8, 5 + bob, 6, 6);
    rect(graphics, palette.outline, 19, 5 + bob, 6, 6);
    rect(graphics, palette.steel, 9, 6 + bob, 4, 5);
    rect(graphics, palette.steel, 20, 6 + bob, 4, 5);
    rect(graphics, palette.charcoal, 8, 11 + bob, 7, 5);
    rect(graphics, palette.charcoal, 18, 11 + bob, 7, 5);
    rect(graphics, palette.warmWhite, 14, 14 + bob, 5, 6);
    rect(graphics, palette.outline, 10, 12 + bob, 2, 2);
    rect(graphics, palette.outline, 21, 12 + bob, 2, 2);
    rect(graphics, palette.outline, 15, 16 + bob, 3, 2);
    rect(graphics, palette.outline, 9, 20 + bob, 15, 7);
    rect(graphics, palette.redDark, 10, 21 + bob, 13, 5);
    rect(graphics, palette.charcoal, 24, 21 + bob, 5, 3);
    rect(graphics, palette.steelLight, 27, 20 + bob, 3, 3);
  }

  const footShift = frame === 0 ? 0 : 2;
  rect(graphics, palette.outline, 8 + footShift, 25, 7, 3);
  rect(graphics, palette.outline, 17 - footShift, 25, 7, 3);
}

function drawFood(graphics: Graphics, kind: FoodKind, offsetX = 0, offsetY = 0): void {
  const palette = PIXEL_PALETTE;
  if (kind === "fishcake") {
    rect(graphics, palette.woodDark, offsetX + 7, offsetY + 3, 2, 12);
    rect(graphics, palette.outline, offsetX + 3, offsetY + 3, 8, 7);
    rect(graphics, palette.orangeLight, offsetX + 4, offsetY + 4, 6, 5);
    rect(graphics, palette.orangeDark, offsetX + 5, offsetY + 5, 3, 1);
    rect(graphics, palette.red, offsetX + 2, offsetY + 11, 12, 3);
    rect(graphics, palette.cream, offsetX + 3, offsetY + 11, 10, 2);
  } else if (kind === "tteokbokki") {
    rect(graphics, palette.outline, offsetX + 2, offsetY + 6, 12, 7);
    rect(graphics, palette.redDark, offsetX + 3, offsetY + 7, 10, 5);
    rect(graphics, palette.redLight, offsetX + 4, offsetY + 7, 8, 3);
    rect(graphics, palette.cream, offsetX + 5, offsetY + 6, 3, 2);
    rect(graphics, palette.orangeLight, offsetX + 9, offsetY + 8, 3, 2);
    rect(graphics, palette.steelLight, offsetX + 11, offsetY + 2, 2, 6);
  } else if (kind === "fish-bread") {
    rect(graphics, palette.outline, offsetX + 1, offsetY + 10, 14, 4);
    rect(graphics, palette.steelLight, offsetX + 2, offsetY + 11, 12, 2);
    rect(graphics, palette.outline, offsetX + 2, offsetY + 5, 5, 6);
    rect(graphics, palette.redDark, offsetX + 3, offsetY + 6, 3, 4);
    rect(graphics, palette.tan, offsetX + 4, offsetY + 7, 1, 2);
    rect(graphics, palette.outline, offsetX + 6, offsetY + 3, 5, 8);
    rect(graphics, palette.brown, offsetX + 7, offsetY + 4, 3, 6);
    rect(graphics, palette.cream, offsetX + 8, offsetY + 6, 1, 2);
    rect(graphics, palette.outline, offsetX + 10, offsetY + 5, 5, 6);
    rect(graphics, palette.redDark, offsetX + 11, offsetY + 6, 3, 4);
    rect(graphics, palette.tan, offsetX + 12, offsetY + 7, 1, 2);
  } else if (kind === "ramen") {
    rect(graphics, palette.outline, offsetX + 2, offsetY + 7, 12, 6);
    rect(graphics, palette.redDark, offsetX + 3, offsetY + 8, 10, 4);
    rect(graphics, palette.orangeLight, offsetX + 4, offsetY + 7, 8, 2);
    rect(graphics, palette.cream, offsetX + 5, offsetY + 8, 6, 1);
    rect(graphics, palette.yellow, offsetX + 7, offsetY + 6, 3, 2);
    rect(graphics, palette.steelLight, offsetX + 12, offsetY + 2, 1, 7);
  } else if (kind === "moon-skewer") {
    rect(graphics, palette.woodDark, offsetX + 3, offsetY + 12, 11, 2);
    rect(graphics, palette.outline, offsetX + 3, offsetY + 3, 5, 5);
    rect(graphics, palette.redLight, offsetX + 4, offsetY + 4, 3, 3);
    rect(graphics, palette.outline, offsetX + 7, offsetY + 6, 5, 5);
    rect(graphics, palette.orangeLight, offsetX + 8, offsetY + 7, 3, 3);
    rect(graphics, palette.outline, offsetX + 10, offsetY + 9, 5, 5);
    rect(graphics, palette.mint, offsetX + 11, offsetY + 10, 3, 3);
  } else {
    rect(graphics, palette.outline, offsetX + 1, offsetY + 5, 14, 9);
    rect(graphics, palette.steelLight, offsetX + 2, offsetY + 6, 12, 7);
    rect(graphics, palette.redDark, offsetX + 3, offsetY + 8, 5, 4);
    rect(graphics, palette.orangeLight, offsetX + 4, offsetY + 7, 3, 3);
    rect(graphics, palette.cream, offsetX + 9, offsetY + 7, 4, 4);
    rect(graphics, palette.mint, offsetX + 10, offsetY + 6, 2, 2);
    rect(graphics, palette.goldLight, offsetX + 7, offsetY + 2, 2, 4);
  }
}

function drawChapterFood(
  graphics: Graphics,
  chapterId: Exclude<ChapterId, 1>,
  menuItemId: MenuItemId,
  offsetX = 0,
  offsetY = 0,
): void {
  const index = MENU_ITEM_IDS.indexOf(menuItemId);
  const chapter = getChapter(chapterId);
  const accent = chapter.accent;
  const secondary = chapter.secondary;
  const p = PIXEL_PALETTE;
  if (chapterId === 2) {
    if (index === 0) {
      rect(graphics, p.outline, offsetX + 3, offsetY + 4, 10, 10);
      rect(graphics, 0x8c693f, offsetX + 4, offsetY + 5, 8, 8);
      rect(graphics, 0xe9f3d0, offsetX + 6, offsetY + 6, 4, 4);
      rect(graphics, 0x62ba7a, offsetX + 11, offsetY + 1, 2, 7);
    } else {
      const glassWidth = index >= 4 ? 12 : 9;
      const glassX = offsetX + Math.floor((16 - glassWidth) / 2);
      rect(graphics, p.outline, glassX, offsetY + 3, glassWidth, 11);
      rect(graphics, 0xdffaff, glassX + 1, offsetY + 4, glassWidth - 2, 8);
      rect(graphics, index % 2 === 0 ? secondary : accent, glassX + 2, offsetY + 7, glassWidth - 4, 5);
      rect(graphics, p.warmWhite, glassX + 3, offsetY + 5, 2, 2);
      rect(graphics, 0x63b66e, glassX + glassWidth - 3, offsetY + 2, 2, 5);
      if (index >= 4) rect(graphics, p.goldLight, offsetX + 2, offsetY + 2, 2, 2);
    }
    return;
  }
  if (chapterId === 3) {
    rect(graphics, p.outline, offsetX + 1, offsetY + 7, 14, 7);
    rect(graphics, 0xb78a55, offsetX + 2, offsetY + 8, 12, 5);
    const foodColors = [0xd95c44, 0x6fa66f, 0x9a553b, 0x754031, 0xc68a46, p.goldLight] as const;
    rect(graphics, foodColors[index] ?? accent, offsetX + 4, offsetY + 6, 8, 5);
    rect(graphics, p.cream, offsetX + 6, offsetY + 5, 4, 3);
    if (index >= 3) rect(graphics, 0x6fa66f, offsetX + 11, offsetY + 4, 2, 5);
    return;
  }
  if (chapterId === 4) {
    graphics.fillStyle(p.shadow, 0.3).fillEllipse(offsetX + 1, offsetY + 12, 14, 3);
    rect(graphics, p.outline, offsetX + 1, offsetY + 7, 14, 6);
    rect(graphics, p.warmWhite, offsetX + 2, offsetY + 8, 12, 4);
    const foodColors = [0xd69d55, 0xe7c574, 0x8e4639, 0xe46d55, accent, p.goldLight] as const;
    rect(graphics, foodColors[index] ?? accent, offsetX + 4, offsetY + 6, 8, 5);
    if (index === 1) {
      rect(graphics, 0xe7c574, offsetX + 3, offsetY + 5, 10, 1);
      rect(graphics, 0xe7c574, offsetX + 5, offsetY + 4, 6, 1);
    }
    if (index >= 4) rect(graphics, secondary, offsetX + 7, offsetY + 3, 2, 3);
    return;
  }
  rect(graphics, p.outline, offsetX + 1, offsetY + 8, 14, 5);
  rect(graphics, 0x8a6047, offsetX + 2, offsetY + 9, 12, 3);
  const fishColors = [0xf3c95e, 0xf08a78, 0xbc4d55, 0x9b633f, accent, p.goldLight] as const;
  if (index <= 2) {
    rect(graphics, p.cream, offsetX + 4, offsetY + 7, 8, 4);
    rect(graphics, fishColors[index] ?? secondary, offsetX + 3, offsetY + 5, 10, 4);
  } else {
    rect(graphics, 0x27344f, offsetX + 3, offsetY + 5, 10, 6);
    rect(graphics, fishColors[index] ?? secondary, offsetX + 5, offsetY + 5, 6, 4);
  }
  if (index >= 4) rect(graphics, 0x79b58b, offsetX + 12, offsetY + 4, 2, 4);
}

function drawTable(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  graphics.fillStyle(palette.shadow, 0.35);
  graphics.fillRect(4, 25, 40, 5);
  rect(graphics, palette.outline, 3, 5, 42, 20);
  rect(graphics, palette.woodDark, 4, 6, 40, 18);
  rect(graphics, palette.wood, 5, 7, 38, 15);
  rect(graphics, palette.woodLight, 6, 8, 36, 3);
  rect(graphics, palette.woodDark, 6, 15, 36, 2);
  rect(graphics, palette.outline, 7, 24, 6, 7);
  rect(graphics, palette.outline, 35, 24, 6, 7);
  rect(graphics, palette.woodDark, 8, 24, 4, 6);
  rect(graphics, palette.woodDark, 36, 24, 4, 6);
}

function drawSeat(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  graphics.fillStyle(palette.shadow, 0.35);
  graphics.fillRect(3, 18, 18, 3);
  rect(graphics, palette.outline, 3, 6, 18, 8);
  rect(graphics, palette.redDark, 4, 7, 16, 6);
  rect(graphics, palette.red, 5, 7, 14, 3);
  rect(graphics, palette.outline, 5, 13, 4, 8);
  rect(graphics, palette.outline, 15, 13, 4, 8);
  rect(graphics, palette.woodDark, 6, 14, 2, 6);
  rect(graphics, palette.woodDark, 16, 14, 2, 6);
}

function drawStationBase(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  graphics.fillStyle(palette.shadow, 0.35);
  graphics.fillRect(3, 42, 42, 4);
  rect(graphics, palette.outline, 3, 16, 42, 28);
  rect(graphics, palette.woodDark, 4, 17, 40, 26);
  rect(graphics, palette.redDark, 5, 20, 38, 9);
  rect(graphics, palette.red, 6, 20, 36, 5);
  rect(graphics, palette.wood, 7, 31, 34, 10);
  rect(graphics, palette.woodLight, 8, 32, 32, 2);
  rect(graphics, palette.outline, 22, 31, 3, 10);
}

function drawFishcakeStation(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  drawStationBase(graphics);
  rect(graphics, palette.outline, 8, 8, 31, 11);
  rect(graphics, palette.steel, 9, 9, 29, 9);
  rect(graphics, palette.steelLight, 11, 10, 25, 2);
  rect(graphics, palette.orangeDark, 13, 11, 6, 5);
  rect(graphics, palette.orangeLight, 14, 11, 4, 4);
  rect(graphics, palette.orangeDark, 24, 11, 6, 5);
  rect(graphics, palette.orangeLight, 25, 11, 4, 4);
  rect(graphics, palette.woodDark, 15, 3, 2, 10);
  rect(graphics, palette.woodDark, 27, 2, 2, 11);
}

function drawTteokbokkiStation(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  drawStationBase(graphics);
  rect(graphics, palette.outline, 7, 7, 34, 12);
  rect(graphics, palette.charcoal, 8, 8, 32, 10);
  rect(graphics, palette.redDark, 10, 10, 28, 7);
  rect(graphics, palette.redLight, 11, 11, 26, 4);
  rect(graphics, palette.cream, 14, 10, 5, 3);
  rect(graphics, palette.orangeLight, 23, 12, 6, 3);
  rect(graphics, palette.cream, 31, 10, 4, 3);
  rect(graphics, palette.steelLight, 35, 2, 3, 10);
}

function drawSundaeStation(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  drawStationBase(graphics);
  rect(graphics, palette.outline, 7, 7, 34, 13);
  rect(graphics, palette.steel, 8, 8, 32, 11);
  rect(graphics, palette.steelLight, 10, 9, 28, 2);
  rect(graphics, palette.charcoal, 10, 12, 28, 6);
  rect(graphics, palette.redDark, 12, 13, 7, 3);
  rect(graphics, palette.brown, 21, 13, 7, 3);
  rect(graphics, palette.redDark, 30, 13, 6, 3);
  rect(graphics, palette.tan, 14, 14, 2, 1);
  rect(graphics, palette.cream, 23, 14, 2, 1);
  rect(graphics, palette.tan, 32, 14, 2, 1);
  rect(graphics, palette.outline, 12, 4, 24, 4);
  rect(graphics, palette.steelLight, 14, 5, 20, 2);
  rect(graphics, palette.warmWhite, 16, 1, 2, 4);
  rect(graphics, palette.steelLight, 25, 2, 2, 3);
}

function drawPremiumStation(graphics: Graphics, kind: FoodKind): void {
  const palette = PIXEL_PALETTE;
  drawStationBase(graphics);
  rect(graphics, palette.outline, 7, 5, 34, 15);
  rect(graphics, kind === "moonlight-set" ? palette.nightLight : palette.charcoal, 8, 6, 32, 13);
  rect(graphics, kind === "moon-skewer" ? palette.redDark : palette.steel, 10, 8, 28, 9);
  drawFood(graphics, kind, 16, 2);
  if (kind === "moonlight-set") {
    rect(graphics, palette.goldLight, 9, 7, 2, 10);
    rect(graphics, palette.mint, 37, 7, 2, 10);
  }
}

function drawSign(graphics: Graphics, kind: "stall" | "neon" | "moon"): void {
  const palette = PIXEL_PALETTE;
  rect(graphics, palette.outline, 2, 2, 44, 20);
  rect(graphics, kind === "stall" ? palette.woodDark : palette.night, 3, 3, 42, 18);
  rect(graphics, kind === "stall" ? palette.red : palette.nightLight, 5, 5, 38, 14);

  if (kind === "stall") {
    rect(graphics, palette.cream, 9, 8, 5, 7);
    rect(graphics, palette.cream, 17, 7, 4, 9);
    rect(graphics, palette.cream, 25, 7, 4, 9);
    rect(graphics, palette.cream, 33, 8, 5, 7);
    rect(graphics, palette.orangeLight, 7, 17, 34, 2);
  } else if (kind === "neon") {
    rect(graphics, palette.redLight, 8, 7, 4, 10);
    rect(graphics, palette.orangeLight, 12, 7, 6, 3);
    rect(graphics, palette.orangeLight, 12, 14, 6, 3);
    rect(graphics, palette.mint, 22, 8, 3, 8);
    rect(graphics, palette.mint, 25, 8, 6, 3);
    rect(graphics, palette.mint, 25, 13, 6, 3);
    rect(graphics, palette.redLight, 35, 7, 3, 10);
  } else {
    rect(graphics, palette.goldLight, 8, 6, 10, 11);
    rect(graphics, palette.nightLight, 13, 5, 8, 9);
    rect(graphics, palette.orangeLight, 24, 7, 3, 9);
    rect(graphics, palette.orangeLight, 27, 7, 7, 3);
    rect(graphics, palette.orangeLight, 27, 13, 7, 3);
    rect(graphics, palette.goldLight, 38, 6, 2, 2);
    rect(graphics, palette.goldLight, 40, 8, 2, 2);
  }
}

function drawChapterStation(graphics: Graphics, chapterId: Exclude<ChapterId, 1>, menuItemId: MenuItemId): void {
  const chapter = getChapter(chapterId);
  const baseColors: Record<Exclude<ChapterId, 1>, readonly [number, number, number]> = {
    2: [0x315d68, 0xd59b62, 0x53cfc0],
    3: [0x4c3328, 0x9a6a3d, 0xe2b85f],
    4: [0x392635, 0x774356, 0xe6c77b],
    5: [0x25364d, 0x9b6b48, 0x79bcb1],
  };
  const [dark, body, trim] = baseColors[chapterId];
  graphics.fillStyle(PIXEL_PALETTE.shadow, 0.35).fillRect(3, 42, 42, 4);
  rect(graphics, PIXEL_PALETTE.outline, 3, 15, 42, 29);
  rect(graphics, dark, 4, 16, 40, 27);
  rect(graphics, body, 5, 20, 38, 9);
  rect(graphics, trim, 6, 20, 36, 3);
  rect(graphics, body, 7, 31, 34, 10);
  rect(graphics, chapter.accent, 8, 32, 32, 2);
  rect(graphics, PIXEL_PALETTE.outline, 22, 31, 3, 10);
  rect(graphics, PIXEL_PALETTE.outline, 7, 4, 34, 16);
  rect(graphics, dark, 8, 5, 32, 14);
  rect(graphics, chapter.secondary, 10, 7, 28, 2);
  drawChapterFood(graphics, chapterId, menuItemId, 16, 2);
}

function drawChapterSign(
  graphics: Graphics,
  chapterId: ChapterId,
  kind: "stall" | "neon" | "moon",
): void {
  if (chapterId === 1) {
    drawSign(graphics, kind);
    return;
  }
  const chapter = getChapter(chapterId);
  rect(graphics, PIXEL_PALETTE.outline, 2, 2, 44, 20);
  rect(graphics, kind === "stall" ? 0x554132 : 0x151a32, 3, 3, 42, 18);
  rect(graphics, kind === "moon" ? chapter.accent : chapter.secondary, 5, 5, 38, 14);
  rect(graphics, 0x101426, 7, 7, 34, 10);
  if (chapterId === 2) {
    rect(graphics, 0x5fe3d0, 9, 12, 28, 2);
    graphics.fillStyle(0xffd071, 1).fillCircle(32, 9, 4);
    graphics.fillStyle(0x101426, 1).fillCircle(34, 8, 4);
  } else if (chapterId === 3) {
    rect(graphics, 0xe6bd69, 10, 8, 5, 7); rect(graphics, 0xe6bd69, 19, 7, 2, 8);
    rect(graphics, 0xe6bd69, 23, 8, 7, 7); rect(graphics, 0x69a47d, 34, 8, 3, 7);
  } else if (chapterId === 4) {
    graphics.fillStyle(0xf2cc7d, 1).fillCircle(15, 12, 5);
    rect(graphics, 0x101426, 14, 7, 2, 10); rect(graphics, 0xf2cc7d, 24, 8, 10, 2);
    rect(graphics, 0xf2cc7d, 28, 8, 2, 8);
  } else {
    rect(graphics, 0xf2eee0, 9, 8, 6, 7); rect(graphics, 0xe76f68, 18, 8, 4, 7);
    rect(graphics, 0xf2eee0, 26, 8, 10, 2); rect(graphics, 0xf2eee0, 30, 8, 2, 8);
  }
  if (kind === "moon") {
    rect(graphics, PIXEL_PALETTE.goldLight, 7, 4, 3, 3);
    rect(graphics, PIXEL_PALETTE.goldLight, 39, 17, 2, 2);
  }
}

function drawOrderBubble(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  rect(graphics, palette.outline, 2, 2, 20, 17);
  rect(graphics, palette.warmWhite, 3, 3, 18, 15);
  rect(graphics, palette.outline, 6, 19, 6, 3);
  rect(graphics, palette.warmWhite, 7, 18, 4, 3);
}

function drawCoin(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  rect(graphics, palette.outline, 2, 1, 8, 10);
  rect(graphics, palette.gold, 1, 3, 10, 6);
  rect(graphics, palette.goldLight, 3, 2, 6, 8);
  rect(graphics, palette.gold, 4, 4, 4, 4);
  rect(graphics, palette.warmWhite, 4, 3, 2, 2);
}

function drawHeart(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  rect(graphics, palette.outline, 1, 2, 5, 5);
  rect(graphics, palette.outline, 6, 2, 5, 5);
  rect(graphics, palette.outline, 2, 6, 8, 3);
  rect(graphics, palette.outline, 4, 9, 4, 2);
  rect(graphics, palette.redLight, 2, 3, 3, 4);
  rect(graphics, palette.redLight, 7, 3, 3, 4);
  rect(graphics, palette.redLight, 3, 6, 6, 2);
  rect(graphics, palette.redLight, 5, 8, 2, 2);
  rect(graphics, palette.pink, 3, 3, 2, 2);
}

function drawRatingStar(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  rect(graphics, palette.outline, 5, 1, 4, 3);
  rect(graphics, palette.outline, 2, 4, 10, 3);
  rect(graphics, palette.outline, 3, 7, 8, 3);
  rect(graphics, palette.outline, 2, 10, 4, 3);
  rect(graphics, palette.outline, 8, 10, 4, 3);
  rect(graphics, palette.goldLight, 6, 2, 2, 3);
  rect(graphics, palette.goldLight, 3, 5, 8, 2);
  rect(graphics, palette.goldLight, 4, 7, 6, 2);
  rect(graphics, palette.goldLight, 4, 9, 2, 2);
  rect(graphics, palette.goldLight, 8, 9, 2, 2);
}

function createCharacters(painter: TexturePainter): void {
  const directions: readonly Direction[] = ["down", "up", "left", "right"];
  for (const direction of directions) {
    for (let frame = 0; frame < 2; frame += 1) {
      painter.paint(`player-${direction}-${frame}`, 32, 32, (graphics) => {
        drawCheesePlayer(graphics, direction, frame);
      });
    }
  }

  for (let frame = 0; frame < 2; frame += 1) {
    painter.paint(`chef-${frame}`, 32, 32, (graphics) => drawChef(graphics, frame));
    painter.paint(`server-${frame}`, 32, 32, (graphics) => drawServer(graphics, frame));
    for (let rank = 1; rank <= MAX_WORKERS_PER_ROLE; rank += 1) {
      painter.paint(`chef-${rank}-${frame}`, 32, 32, (graphics) => drawChef(graphics, frame, rank));
      painter.paint(`server-${rank}-${frame}`, 32, 32, (graphics) => drawServer(graphics, frame, rank));
    }
  }

  const customerKinds: readonly CustomerKind[] = ["rabbit", "dog", "hamster", "raccoon"];
  for (const kind of customerKinds) {
    for (let frame = 0; frame < 2; frame += 1) {
      painter.paint(`customer-${kind}-${frame}`, 32, 32, (graphics) => {
        drawCustomer(graphics, kind, frame);
      });
    }
  }
}

function createFoods(painter: TexturePainter): void {
  const foodKinds: readonly FoodKind[] = [
    "fishcake", "tteokbokki", "fish-bread", "ramen", "moon-skewer", "moonlight-set",
  ];
  for (const kind of foodKinds) {
    painter.paint(`food-${kind}`, 16, 16, (graphics) => drawFood(graphics, kind));
  }
  for (const chapterId of CHAPTER_IDS.slice(1) as readonly Exclude<ChapterId, 1>[]) {
    for (const menuItemId of MENU_ITEM_IDS) {
      painter.paint(`food-chapter-${chapterId}-${menuItemId}`, 16, 16, (graphics) => {
        drawChapterFood(graphics, chapterId, menuItemId);
      });
    }
  }
}

function createFurnitureAndStations(painter: TexturePainter): void {
  painter.paint("table", 48, 32, drawTable);
  painter.paint("seat", 24, 24, drawSeat);
  painter.paint("station-fishcake", 48, 48, drawFishcakeStation);
  painter.paint("station-tteokbokki", 48, 48, drawTteokbokkiStation);
  painter.paint("station-fish-bread", 48, 48, drawSundaeStation);
  for (const kind of ["ramen", "moon-skewer", "moonlight-set"] as const) {
    painter.paint(`station-${kind}`, 48, 48, (graphics) => drawPremiumStation(graphics, kind));
  }
  painter.paint("sign-stall", 48, 24, (graphics) => drawSign(graphics, "stall"));
  painter.paint("sign-neon", 48, 24, (graphics) => drawSign(graphics, "neon"));
  painter.paint("sign-moon", 48, 24, (graphics) => drawSign(graphics, "moon"));
  for (const chapterId of CHAPTER_IDS) {
    for (const kind of ["stall", "neon", "moon"] as const) {
      painter.paint(`sign-chapter-${chapterId}-${kind}`, 48, 24, (graphics) => {
        drawChapterSign(graphics, chapterId, kind);
      });
    }
    if (chapterId === 1) continue;
    for (const menuItemId of MENU_ITEM_IDS) {
      painter.paint(`station-chapter-${chapterId}-${menuItemId}`, 48, 48, (graphics) => {
        drawChapterStation(graphics, chapterId, menuItemId);
      });
    }
  }
}

const FACILITY_TEXTURE_IDS: readonly FacilityUpgradeId[] = [
  "copper-pot", "double-burner", "prep-rack", "steam-hood",
  "soft-chair", "wide-table", "moon-counter", "tea-dispenser",
  "paper-lantern", "blue-canopy", "neon-set", "moon-sign", "wind-chime",
  "lucky-cat", "festival-drum", "night-ledger", "coupon-board",
  "chef-uniform", "server-uniform", "staff-badge", "server-shoes",
];

function drawFacilityObject(graphics: Graphics, id: FacilityUpgradeId, chapterId: ChapterId): void {
  const p = PIXEL_PALETTE;
  const chapter = getChapter(chapterId);
  const outline = p.outline;
  graphics.fillStyle(p.shadow, 0.28).fillEllipse(4, 24, 24, 3);
  switch (id) {
    case "copper-pot":
      rect(graphics, outline, 5, 10, 22, 12); rect(graphics, 0xc56e3f, 7, 11, 18, 9);
      rect(graphics, 0xffba6b, 9, 12, 14, 2); rect(graphics, outline, 2, 13, 5, 3); rect(graphics, outline, 25, 13, 5, 3);
      rect(graphics, outline, 10, 7, 12, 3); rect(graphics, p.goldLight, 15, 5, 3, 3); break;
    case "double-burner":
      rect(graphics, outline, 2, 11, 28, 12); rect(graphics, p.charcoal, 4, 13, 24, 8);
      graphics.lineStyle(2, p.orangeLight, 1).strokeCircle(10, 17, 5).strokeCircle(22, 17, 5);
      rect(graphics, p.redLight, 7, 16, 6, 2); rect(graphics, p.redLight, 19, 16, 6, 2); break;
    case "prep-rack":
      rect(graphics, outline, 3, 3, 3, 21); rect(graphics, outline, 26, 3, 3, 21);
      rect(graphics, p.steelLight, 5, 5, 22, 3); rect(graphics, p.steel, 5, 13, 22, 3); rect(graphics, p.steel, 5, 21, 22, 3);
      rect(graphics, p.green, 8, 9, 5, 4); rect(graphics, p.orangeLight, 18, 8, 6, 5); break;
    case "steam-hood":
      rect(graphics, outline, 5, 4, 22, 5); rect(graphics, p.steelLight, 7, 5, 18, 3);
      rect(graphics, outline, 2, 9, 28, 7); rect(graphics, p.steel, 4, 10, 24, 4);
      rect(graphics, 0x63d7d0, 9, 12, 3, 2); rect(graphics, 0x63d7d0, 20, 12, 3, 2); break;
    case "soft-chair":
      rect(graphics, outline, 7, 4, 18, 15); rect(graphics, 0xa65f7d, 9, 6, 14, 11);
      rect(graphics, outline, 5, 16, 22, 7); rect(graphics, 0xd4869c, 7, 17, 18, 4);
      rect(graphics, outline, 7, 22, 3, 4); rect(graphics, outline, 22, 22, 3, 4); break;
    case "wide-table":
      rect(graphics, outline, 2, 10, 28, 7); rect(graphics, p.woodLight, 4, 11, 24, 4);
      rect(graphics, p.cream, 8, 8, 6, 3); rect(graphics, p.mint, 19, 8, 5, 3);
      rect(graphics, outline, 5, 17, 4, 8); rect(graphics, outline, 23, 17, 4, 8); break;
    case "moon-counter":
      rect(graphics, outline, 2, 8, 28, 17); rect(graphics, 0x334a6d, 4, 10, 24, 13);
      rect(graphics, 0x65e3dc, 4, 10, 24, 2); rect(graphics, p.goldLight, 14, 15, 5, 5);
      rect(graphics, 0x334a6d, 17, 14, 4, 4); break;
    case "tea-dispenser":
      rect(graphics, outline, 8, 5, 16, 19); rect(graphics, 0xb56b47, 10, 7, 12, 14);
      rect(graphics, p.orangeLight, 12, 8, 8, 3); rect(graphics, outline, 22, 11, 5, 3);
      rect(graphics, p.steelLight, 14, 21, 5, 3); rect(graphics, 0xe8f5e1, 25, 16, 4, 5); break;
    case "paper-lantern":
      rect(graphics, outline, 14, 2, 4, 4); rect(graphics, outline, 8, 6, 16, 17);
      rect(graphics, 0x53d8d0, 10, 7, 12, 15); rect(graphics, 0xe4f7e8, 12, 9, 8, 3);
      rect(graphics, p.goldLight, 14, 23, 4, 4); break;
    case "blue-canopy":
      rect(graphics, outline, 2, 6, 28, 5); rect(graphics, 0x3e6fa2, 3, 7, 26, 3);
      for (let x = 3; x < 28; x += 6) {
        graphics.fillStyle(x % 12 === 3 ? 0x5b93c4 : 0x315983, 1).fillTriangle(x, 11, x + 6, 11, x + 3, 18);
      }
      rect(graphics, outline, 4, 17, 2, 9); rect(graphics, outline, 26, 17, 2, 9); break;
    case "neon-set":
      rect(graphics, outline, 2, 4, 28, 19); graphics.lineStyle(2, 0xf15bd1, 1).strokeRoundedRect(4, 6, 24, 15, 3);
      graphics.lineStyle(2, 0x55e7dc, 1).strokeCircle(13, 14, 5); rect(graphics, p.goldLight, 21, 10, 3, 8); break;
    case "moon-sign":
      rect(graphics, outline, 3, 4, 26, 20); rect(graphics, 0x28365f, 5, 6, 22, 16);
      graphics.fillStyle(p.goldLight, 1).fillCircle(15, 14, 7); graphics.fillStyle(0x28365f, 1).fillCircle(18, 11, 7);
      rect(graphics, 0x8de6db, 22, 8, 2, 2); break;
    case "wind-chime":
      rect(graphics, outline, 8, 4, 16, 3); rect(graphics, 0x63d8cf, 10, 7, 12, 4);
      rect(graphics, p.steelLight, 11, 11, 2, 8); rect(graphics, p.steelLight, 19, 11, 2, 8);
      rect(graphics, p.goldLight, 14, 19, 4, 6); rect(graphics, 0xf3a9c5, 12, 24, 8, 2); break;
    case "lucky-cat":
      rect(graphics, outline, 8, 8, 17, 16); rect(graphics, p.cream, 10, 9, 13, 13);
      rect(graphics, p.redLight, 10, 18, 13, 4); rect(graphics, outline, 12, 12, 2, 2); rect(graphics, outline, 19, 12, 2, 2);
      rect(graphics, outline, 23, 5, 5, 12); rect(graphics, p.cream, 24, 6, 3, 10); rect(graphics, p.goldLight, 15, 18, 4, 4); break;
    case "festival-drum":
      rect(graphics, outline, 5, 7, 22, 17); rect(graphics, 0x8d3d45, 7, 9, 18, 13);
      graphics.lineStyle(2, p.goldLight, 1).strokeCircle(16, 15, 8); rect(graphics, p.cream, 11, 10, 10, 10);
      rect(graphics, outline, 3, 3, 3, 12); rect(graphics, p.woodLight, 4, 3, 2, 11); break;
    case "night-ledger":
      rect(graphics, outline, 5, 3, 22, 23); rect(graphics, 0x344f8b, 7, 5, 18, 19);
      rect(graphics, p.goldLight, 9, 8, 14, 2); rect(graphics, p.steelLight, 10, 13, 11, 1);
      rect(graphics, p.steelLight, 10, 17, 8, 1); rect(graphics, p.goldLight, 5, 4, 3, 21); break;
    case "coupon-board":
      rect(graphics, outline, 3, 3, 26, 22); rect(graphics, p.wood, 5, 5, 22, 18);
      rect(graphics, p.cream, 7, 7, 8, 6); rect(graphics, p.mint, 17, 8, 8, 5);
      rect(graphics, p.pink, 8, 16, 7, 5); rect(graphics, p.goldLight, 18, 16, 6, 5); break;
    case "chef-uniform":
    case "server-uniform": {
      const color = id === "chef-uniform" ? chapter.accent : chapter.secondary;
      rect(graphics, outline, 14, 2, 4, 4); rect(graphics, outline, 8, 5, 16, 19);
      rect(graphics, color, 10, 7, 12, 15); rect(graphics, outline, 4, 8, 7, 6); rect(graphics, outline, 21, 8, 7, 6);
      rect(graphics, color, 5, 9, 6, 4); rect(graphics, color, 21, 9, 6, 4); rect(graphics, p.goldLight, 15, 10, 2, 2); break;
    }
    case "staff-badge":
      rect(graphics, outline, 7, 3, 18, 22); rect(graphics, 0x28365f, 9, 5, 14, 18);
      graphics.fillStyle(p.goldLight, 1).fillCircle(16, 12, 6); rect(graphics, p.warmWhite, 15, 7, 2, 10); rect(graphics, p.warmWhite, 11, 11, 10, 2); break;
    case "server-shoes":
      rect(graphics, outline, 2, 10, 13, 12); rect(graphics, 0xf07679, 4, 11, 9, 8);
      rect(graphics, p.warmWhite, 3, 19, 13, 4); rect(graphics, outline, 17, 8, 12, 13);
      rect(graphics, 0x59cfc3, 19, 9, 8, 9); rect(graphics, p.warmWhite, 17, 18, 13, 4); break;
  }

  rect(graphics, chapter.accent, 3, 25, 13, 2);
  rect(graphics, chapter.secondary, 16, 25, 13, 2);
  if (chapterId === 2) {
    rect(graphics, 0x8b5738, 27, 2, 2, 7);
    rect(graphics, chapter.accent, 23, 1, 5, 2);
    rect(graphics, chapter.accent, 27, 0, 4, 2);
  } else if (chapterId === 3) {
    rect(graphics, chapter.secondary, 23, 2, 8, 2);
    rect(graphics, chapter.accent, 25, 4, 4, 3);
  } else if (chapterId === 4) {
    rect(graphics, chapter.accent, 26, 1, 3, 7);
    rect(graphics, chapter.secondary, 24, 3, 7, 3);
  } else if (chapterId === 5) {
    rect(graphics, chapter.secondary, 25, 1, 5, 5);
    rect(graphics, 0xfff1d6, 26, 2, 3, 3);
  }
}

function createFacilityTextures(painter: TexturePainter): void {
  for (const chapterId of CHAPTER_IDS) {
    for (const id of FACILITY_TEXTURE_IDS) {
      painter.paint(`facility-chapter-${chapterId}-${id}`, 32, 28, (graphics) => {
        drawFacilityObject(graphics, id, chapterId);
      });
    }
  }
}

function createUiAndEffects(painter: TexturePainter): void {
  painter.paint("coin", 12, 12, drawCoin);
  painter.paint("heart", 12, 12, drawHeart);
  painter.paint("rating-star", 14, 14, drawRatingStar);
  painter.paint("order-bubble", 24, 24, drawOrderBubble);

  const orderKinds: readonly FoodKind[] = [
    "fishcake", "tteokbokki", "fish-bread", "ramen", "moon-skewer", "moonlight-set",
  ];
  for (const kind of orderKinds) {
    painter.paint(`order-bubble-${kind}`, 24, 24, (graphics) => {
      drawOrderBubble(graphics);
      drawFood(graphics, kind, 4, 3);
    });
  }

  painter.paint("interaction-marker", 12, 12, (graphics) => {
    const palette = PIXEL_PALETTE;
    rect(graphics, palette.outline, 4, 1, 4, 7);
    rect(graphics, palette.warmWhite, 5, 2, 2, 5);
    rect(graphics, palette.outline, 4, 9, 4, 3);
    rect(graphics, palette.orangeLight, 5, 9, 2, 2);
  });

  painter.paint("steam-0", 8, 14, (graphics) => {
    rect(graphics, PIXEL_PALETTE.warmWhite, 4, 1, 2, 3);
    rect(graphics, PIXEL_PALETTE.steelLight, 2, 4, 3, 4);
    rect(graphics, PIXEL_PALETTE.warmWhite, 3, 8, 2, 4);
  });
  painter.paint("steam-1", 8, 14, (graphics) => {
    rect(graphics, PIXEL_PALETTE.steelLight, 2, 1, 2, 3);
    rect(graphics, PIXEL_PALETTE.warmWhite, 3, 4, 3, 4);
    rect(graphics, PIXEL_PALETTE.steelLight, 2, 8, 2, 4);
  });
  painter.paint("sparkle", 10, 10, (graphics) => {
    rect(graphics, PIXEL_PALETTE.goldLight, 4, 0, 2, 10);
    rect(graphics, PIXEL_PALETTE.goldLight, 0, 4, 10, 2);
    rect(graphics, PIXEL_PALETTE.warmWhite, 4, 4, 2, 2);
  });
  painter.paint("rain-drop", 3, 8, (graphics) => {
    rect(graphics, PIXEL_PALETTE.blue, 1, 0, 2, 5);
    rect(graphics, PIXEL_PALETTE.steelLight, 0, 5, 2, 3);
  });
}

/**
 * Generates every game texture from Phaser Graphics. Safe to call from multiple
 * scenes: existing texture keys are retained and skipped.
 */
export function createPixelArtTextures(scene: Phaser.Scene): void {
  const painter = createPainter(scene);

  try {
    createCharacters(painter);
    createFoods(painter);
    createFurnitureAndStations(painter);
    createFacilityTextures(painter);
    createUiAndEffects(painter);
  } finally {
    painter.destroy();
  }
}

function getAvatarTexturePrefix(look: AvatarLook, ownerTint: number, chapterId: ChapterId): string {
  return `player-custom-${chapterId}-${ownerTint.toString(16)}-${look.eyes}-${look.hat}-${look.apron}-${look.accessory}`;
}

export function getCustomizedPlayerTextureKey(
  look: AvatarLook,
  ownerTint: number,
  direction: Direction,
  frame: number,
  chapterId: ChapterId = 1,
): string {
  return `${getAvatarTexturePrefix(look, ownerTint, chapterId)}-${direction}-${frame}`;
}

/** Bakes the selected face and outfit into the moving sprite, so no follower overlay can lag behind. */
export function ensureCustomizedPlayerTextures(
  scene: Phaser.Scene,
  look: AvatarLook,
  ownerTint: number,
  chapterId: ChapterId = 1,
): void {
  const painter = createPainter(scene);
  try {
    for (const direction of ["down", "up", "left", "right"] as const) {
      for (let frame = 0; frame < 2; frame += 1) {
        painter.paint(getCustomizedPlayerTextureKey(look, ownerTint, direction, frame, chapterId), 32, 32, (graphics) => {
          drawCheesePlayer(graphics, direction, frame, look, ownerTint, chapterId);
        });
      }
    }
  } finally {
    painter.destroy();
  }
}
