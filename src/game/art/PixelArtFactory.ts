import Phaser from "phaser";

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
    fishBread: "food-fish-bread",
  },
  furniture: {
    table: "table",
    seat: "seat",
  },
  stations: {
    fishcake: "station-fishcake",
    tteokbokki: "station-tteokbokki",
    fishBread: "station-fish-bread",
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
    orderFishBread: "order-bubble-fish-bread",
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
type FoodKind = "fishcake" | "tteokbokki" | "fish-bread";

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

function drawCheesePlayer(graphics: Graphics, direction: Direction, frame: number): void {
  const palette = PIXEL_PALETTE;
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
}

function drawChef(graphics: Graphics, frame: number): void {
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
  rect(graphics, palette.outline, frame === 0 ? 9 : 10, 25, 6, 3);
  rect(graphics, palette.outline, frame === 0 ? 17 : 16, 25, 6, 3);
}

function drawServer(graphics: Graphics, frame: number): void {
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
  } else {
    rect(graphics, palette.outline, offsetX + 2, offsetY + 4, 12, 8);
    rect(graphics, palette.orangeLight, offsetX + 3, offsetY + 5, 10, 6);
    rect(graphics, palette.orangeDark, offsetX + 5, offsetY + 6, 6, 1);
    rect(graphics, palette.orangeDark, offsetX + 7, offsetY + 7, 2, 3);
    rect(graphics, palette.outline, offsetX + 1, offsetY + 6, 3, 4);
    rect(graphics, palette.outline, offsetX + 12, offsetY + 6, 3, 4);
    rect(graphics, palette.orangeLight, offsetX + 2, offsetY + 7, 2, 2);
    rect(graphics, palette.orangeLight, offsetX + 12, offsetY + 7, 2, 2);
  }
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

function drawFishBreadStation(graphics: Graphics): void {
  const palette = PIXEL_PALETTE;
  drawStationBase(graphics);
  rect(graphics, palette.outline, 7, 6, 34, 14);
  rect(graphics, palette.charcoal, 8, 7, 32, 12);
  rect(graphics, palette.steel, 10, 9, 12, 8);
  rect(graphics, palette.steel, 26, 9, 12, 8);
  rect(graphics, palette.orangeLight, 12, 11, 8, 4);
  rect(graphics, palette.orangeLight, 28, 11, 8, 4);
  rect(graphics, palette.orangeDark, 15, 12, 2, 2);
  rect(graphics, palette.orangeDark, 31, 12, 2, 2);
  rect(graphics, palette.outline, 20, 2, 8, 5);
  rect(graphics, palette.wood, 21, 3, 6, 3);
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
  const foodKinds: readonly FoodKind[] = ["fishcake", "tteokbokki", "fish-bread"];
  for (const kind of foodKinds) {
    painter.paint(`food-${kind}`, 16, 16, (graphics) => drawFood(graphics, kind));
  }
}

function createFurnitureAndStations(painter: TexturePainter): void {
  painter.paint("table", 48, 32, drawTable);
  painter.paint("seat", 24, 24, drawSeat);
  painter.paint("station-fishcake", 48, 48, drawFishcakeStation);
  painter.paint("station-tteokbokki", 48, 48, drawTteokbokkiStation);
  painter.paint("station-fish-bread", 48, 48, drawFishBreadStation);
  painter.paint("sign-stall", 48, 24, (graphics) => drawSign(graphics, "stall"));
  painter.paint("sign-neon", 48, 24, (graphics) => drawSign(graphics, "neon"));
  painter.paint("sign-moon", 48, 24, (graphics) => drawSign(graphics, "moon"));
}

function createUiAndEffects(painter: TexturePainter): void {
  painter.paint("coin", 12, 12, drawCoin);
  painter.paint("heart", 12, 12, drawHeart);
  painter.paint("rating-star", 14, 14, drawRatingStar);
  painter.paint("order-bubble", 24, 24, drawOrderBubble);

  const orderKinds: readonly FoodKind[] = ["fishcake", "tteokbokki", "fish-bread"];
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
    createUiAndEffects(painter);
  } finally {
    painter.destroy();
  }
}
