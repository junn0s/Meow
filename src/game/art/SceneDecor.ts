import Phaser from "phaser";
import {
  VISUAL_CROSSFADE_MS,
  CHAPTER_VISUAL_PALETTES,
  type VisualPalette,
} from "../data/visualData";
import type { ChapterId, GrowthStage, VisualPhase, VisualTier } from "../types/game";
import { getChapter } from "../data/chapterData";
import { getFacilityPresentationMode } from "../systems/CustomizationSystem";

export const UI_FONT = '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';

export interface DinerDecor {
  readonly sign: Phaser.GameObjects.Image;
  setSign(level: "stall" | "neon" | "moon"): void;
  setPhase(phase: VisualPhase, immediate?: boolean): void;
  setVisualTier(tier: VisualTier): void;
  setProgression(stage: GrowthStage, purchasedStepCount: number): void;
  setShopTier(tier: number): void;
  setShopFacilities(facilityIds: readonly string[]): void;
  setReducedMotion(reducedMotion: boolean): void;
  celebrate(): void;
}

export function createGameBackdrop(scene: Phaser.Scene, chapterId: ChapterId = 1): DinerDecor {
  const chapter = getChapter(chapterId);
  const phases: readonly VisualPhase[] = ["day", "sunset", "night", "dawn"];
  const layers = new Map<VisualPhase, Phaser.GameObjects.Graphics>();
  for (const phase of phases) {
    const layer = drawGameBackdropLayer(scene, CHAPTER_VISUAL_PALETTES[chapterId][phase], chapterId);
    layer.setAlpha(phase === "night" ? 1 : 0);
    layers.set(phase, layer);
  }

  const neonDetails = scene.add.graphics().setDepth(7);
  neonDetails.fillStyle(chapter.accent, 0.95);
  neonDetails.fillRect(12, 60, 42, 2);
  neonDetails.fillRect(296, 60, 42, 2);
  neonDetails.fillStyle(0x5d73ff, 0.8);
  neonDetails.fillRect(112, 63, 2, 42);
  neonDetails.fillRect(236, 63, 2, 42);
  neonDetails.fillStyle(chapter.secondary, 0.75);
  neonDetails.fillRect(136, 104, 78, 2);

  let currentPhase: VisualPhase = "night";
  let visualTier: VisualTier = 1;
  let currentStage: GrowthStage = 1;
  let purchasedStepCount = 0;
  let shopFacilities = new Set<string>();
  const facilityDetails = scene.add.graphics().setDepth(6);
  const facilityPlacements = [
    ["copper-pot", 26, 88, 0.72, 16], ["double-burner", 66, 89, 0.72, 16],
    ["prep-rack", 108, 82, 0.72, 15], ["steam-hood", 150, 78, 0.78, 15],
    ["soft-chair", 50, 205, 0.82, 44], ["wide-table", 97, 207, 0.9, 43],
    ["moon-counter", 326, 91, 0.82, 16], ["tea-dispenser", 285, 91, 0.72, 16],
    ["paper-lantern", 18, 72, 0.7, 10], ["blue-canopy", 63, 68, 0.72, 9],
    ["neon-set", 174, 48, 0.82, 9], ["moon-sign", 221, 48, 0.72, 9],
    ["wind-chime", 310, 69, 0.66, 10], ["lucky-cat", 327, 178, 0.78, 40],
    ["festival-drum", 222, 204, 0.78, 42], ["night-ledger", 252, 87, 0.68, 16],
    ["coupon-board", 35, 112, 0.7, 15],
  ] as const;
  const facilityObjects = new Map<string, Phaser.GameObjects.Image>();
  for (const [id, x, y, scale, depth] of facilityPlacements) {
    facilityObjects.set(
      id,
      scene.add.image(x, y, `facility-chapter-${chapterId}-${id}`).setScale(scale).setDepth(depth).setVisible(false),
    );
  }

  const renderFacilityDetails = (): void => {
    facilityDetails.clear();
    const night = currentPhase === "night";
    const completedStage = currentStage === 30 && purchasedStepCount >= 5
      ? 30
      : currentStage - 1;
    const lightColor = night ? 0x38d7ff : 0xffd37a;
    for (let index = 0; index < completedStage; index += 1) {
      const x = 13 + (index % 15) * 23;
      const y = index < 15 ? 52 : 56;
      facilityDetails.fillStyle(index % 5 === 4 ? 0xf15bd1 : lightColor, night ? 0.95 : 0.72);
      facilityDetails.fillRect(x, y, index % 5 === 4 ? 4 : 2, 2);
    }
    if (visualTier >= 2) {
      facilityDetails.fillStyle(night ? 0xf15bd1 : 0xb84b43, 0.9);
      facilityDetails.fillRect(9, 76, 3, 32);
      facilityDetails.fillRect(338, 76, 3, 32);
    }
    if (visualTier >= 3) {
      facilityDetails.fillStyle(night ? 0x38d7ff : 0xf4b45f, 0.9);
      facilityDetails.fillRect(54, 61, 56, 2);
      facilityDetails.fillRect(240, 61, 56, 2);
    }
    if (visualTier >= 4) {
      facilityDetails.fillStyle(0x2b314f, 1);
      facilityDetails.fillRect(14, 91, 31, 15);
      facilityDetails.fillStyle(night ? 0x5d73ff : 0xffd27c, 0.9);
      facilityDetails.fillRect(17, 94, 25, 2);
      facilityDetails.fillRect(17, 99, 18, 2);
    }
    if (visualTier >= 5) {
      facilityDetails.fillStyle(night ? 0xf15bd1 : 0xd85c3e, 0.82);
      facilityDetails.fillRect(1, 64, 3, 47);
      facilityDetails.fillRect(346, 64, 3, 47);
      facilityDetails.fillTriangle(1, 64, 12, 70, 1, 76);
      facilityDetails.fillTriangle(349, 64, 338, 70, 349, 76);
    }
    if (visualTier >= 6) {
      facilityDetails.lineStyle(2, night ? 0xffd76a : 0xb85a4b, 0.95);
      facilityDetails.strokeCircle(175, 49, 29);
      facilityDetails.fillStyle(night ? 0xffe077 : 0xf4b45f, 0.9);
      facilityDetails.fillCircle(147, 49, 2);
      facilityDetails.fillCircle(203, 49, 2);
    }
    for (const [id, image] of facilityObjects) {
      image.setVisible(shopFacilities.has(id));
      image.setAlpha(night && ["paper-lantern", "neon-set", "moon-sign"].includes(id) ? 1 : 0.92);
    }
  };

  const updateNeon = (immediate: boolean): void => {
    const phaseStrength = currentPhase === "night"
      ? 1
      : currentPhase === "sunset" || currentPhase === "dawn"
        ? 0.18
        : 0;
    const tierStrength = visualTier <= 2 ? 0 : 0.2 + (visualTier - 2) * 0.2;
    const alpha = Math.min(1, phaseStrength * tierStrength);
    scene.tweens.killTweensOf(neonDetails);
    if (immediate) {
      neonDetails.setAlpha(alpha);
    } else {
      scene.tweens.add({ targets: neonDetails, alpha, duration: VISUAL_CROSSFADE_MS });
    }
  };

  const sign = scene.add.image(175, 49, `sign-chapter-${chapterId}-stall`).setDepth(8).setScale(0.88);
  scene.add.text(175, 50, chapter.shortTitle, {
    fontFamily: UI_FONT,
    fontStyle: "bold",
    fontSize: chapterId === 2 || chapterId === 4 ? "6px" : "7px",
    color: "#fff4d4",
    stroke: "#15172a",
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(9);
  const steam = [
    scene.add.image(62, 50, "steam-0"),
    scene.add.image(171, 50, "steam-1"),
    scene.add.image(280, 50, "steam-0"),
  ];
  steam.forEach((image, index) => {
    image.setDepth(12).setAlpha(index === 0 ? 0.72 : 0.24);
    scene.tweens.add({
      targets: image,
      y: image.y - 7,
      alpha: { from: image.alpha, to: 0 },
      duration: 1_000 + index * 170,
      delay: index * 210,
      repeat: -1,
    });
  });

  return {
    sign,
    setSign(level): void {
      sign.setTexture(`sign-chapter-${chapterId}-${level}`);
      scene.tweens.add({ targets: sign, scaleX: 1.08, scaleY: 1.08, duration: 160, yoyo: true });
    },
    setPhase(phase, immediate = false): void {
      currentPhase = phase;
      for (const [layerPhase, layer] of layers) {
        const alpha = layerPhase === phase ? 1 : 0;
        scene.tweens.killTweensOf(layer);
        if (immediate) {
          layer.setAlpha(alpha);
        } else {
          scene.tweens.add({ targets: layer, alpha, duration: VISUAL_CROSSFADE_MS });
        }
      }
      updateNeon(immediate);
      renderFacilityDetails();
    },
    setVisualTier(tier): void {
      visualTier = tier;
      updateNeon(false);
      renderFacilityDetails();
    },
    setProgression(stage, steps): void {
      currentStage = stage;
      purchasedStepCount = steps;
      renderFacilityDetails();
    },
    setShopTier(_tier): void { renderFacilityDetails(); },
    setShopFacilities(facilityIds): void {
      shopFacilities = new Set(
        facilityIds.filter((id) => getFacilityPresentationMode(id) === "world"),
      );
      renderFacilityDetails();
    },
    setReducedMotion(reducedMotion): void {
      steam.forEach((image, index) => image.setVisible(!reducedMotion || index === 0));
    },
    celebrate(): void {
      for (let index = 0; index < 20; index += 1) {
        const sparkle = scene.add
          .image(
            Phaser.Math.Between(18, 332),
            Phaser.Math.Between(48, 220),
            "sparkle",
          )
          .setDepth(870)
          .setScale(Phaser.Math.FloatBetween(0.6, 1.25));
        scene.tweens.add({
          targets: sparkle,
          alpha: 0,
          scaleX: 1.8,
          scaleY: 1.8,
          duration: Phaser.Math.Between(600, 1_100),
          delay: index * 35,
          onComplete: () => sparkle.destroy(),
        });
      }
    },
  };
}

function drawGameBackdropLayer(
  scene: Phaser.Scene,
  palette: VisualPalette,
  chapterId: ChapterId,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics().setDepth(-50);
  graphics.fillGradientStyle(
    palette.skyTop,
    palette.skyTop,
    palette.skyBottom,
    palette.skyBottom,
    1,
  );
  graphics.fillRect(0, 0, 350, 116);
  graphics.fillStyle(palette.building, 1);
  graphics.fillRect(0, 86, 350, 138);
  for (const [x, top, width] of [[0, 65, 48], [43, 76, 62], [101, 58, 52], [148, 73, 75], [218, 54, 54], [266, 70, 84]] as const) {
    graphics.fillStyle(Phaser.Display.Color.ValueToColor(palette.building).darken((x / 43) % 2 === 0 ? 6 : 13).color, 1);
    graphics.fillRect(x, top, width, 116 - top);
  }

  graphics.fillStyle(palette.street, 1);
  graphics.fillRect(0, 116, 350, 154);
  graphics.fillStyle(0xffffff, 0.08);
  for (let y = 230; y < 270; y += 10) {
    graphics.fillRect(0, y, 350, 1);
  }
  graphics.fillStyle(palette.reflection, 0.2);
  graphics.fillRect(23, 225, 55, 42);
  graphics.fillStyle(palette.interior, 0.14);
  graphics.fillRect(145, 225, 54, 42);
  graphics.fillStyle(palette.accent, 0.13);
  graphics.fillRect(268, 225, 54, 42);

  drawChapterMapMotif(graphics, chapterId, palette);

  graphics.fillStyle(0x452936, 1);
  graphics.fillRect(4, 37, 5, 190);
  graphics.fillRect(341, 37, 5, 190);
  graphics.fillStyle(palette.canopy, 1);
  graphics.fillRect(2, 36, 346, 14);
  graphics.fillStyle(Phaser.Display.Color.ValueToColor(palette.canopy).brighten(18).color, 1);
  graphics.fillRect(6, 38, 338, 8);
  for (let x = 8; x < 344; x += 28) {
    graphics.fillStyle(
      x % 56 === 8
        ? Phaser.Display.Color.ValueToColor(palette.canopy).brighten(25).color
        : Phaser.Display.Color.ValueToColor(palette.canopy).darken(12).color,
      1,
    );
    graphics.fillTriangle(x, 46, x + 28, 46, x + 14, 57);
  }
  graphics.fillStyle(palette.interior, 0.85);
  graphics.fillRect(13, 58, 324, 2);

  for (const x of [25, 325]) {
    graphics.fillStyle(0x3c2733, 1);
    graphics.fillRect(x - 1, 49, 2, 8);
    graphics.fillStyle(palette.interior, 0.2);
    graphics.fillCircle(x, 67, 14);
    graphics.fillStyle(0xf6a24d, 1);
    graphics.fillRect(x - 5, 57, 10, 14);
    graphics.fillStyle(0xffd27c, 1);
    graphics.fillRect(x - 3, 59, 6, 10);
    graphics.fillStyle(0x6c3232, 1);
    graphics.fillRect(x - 5, 56, 10, 2);
    graphics.fillRect(x - 5, 71, 10, 2);
  }

  graphics.fillStyle(0x543246, 1);
  graphics.fillRect(10, 108, 330, 6);
  graphics.fillStyle(palette.interior, 0.72);
  graphics.fillRect(10, 108, 330, 2);
  graphics.fillStyle(palette.building, 0.9);
  graphics.fillRect(113, 63, 2, 42);
  graphics.fillRect(235, 63, 2, 42);
  return graphics;
}

function drawChapterMapMotif(graphics: Phaser.GameObjects.Graphics, chapterId: ChapterId, palette: VisualPalette): void {
  if (chapterId === 1) return;
  if (chapterId === 2) {
    graphics.fillStyle(0x2d8298, 0.9).fillRect(0, 103, 350, 13);
    graphics.fillStyle(0x78d8d2, 0.7).fillRect(0, 104, 350, 2);
    graphics.fillStyle(0xe2c58c, 0.22);
    for (let x = 8; x < 350; x += 24) graphics.fillCircle(x, 242 + (x % 3), 2);
    graphics.fillStyle(0x315944, 1).fillRect(33, 55, 4, 52);
    for (const [x, y] of [[19, 57], [25, 51], [34, 49], [44, 52], [51, 59]] as const) {
      graphics.fillStyle(0x3d936d, 1).fillTriangle(35, 58, x, y, x + 7, y + 10);
    }
  } else if (chapterId === 3) {
    graphics.fillStyle(0x302822, 1).fillTriangle(0, 89, 65, 53, 130, 89);
    graphics.fillTriangle(220, 89, 285, 53, 350, 89);
    graphics.lineStyle(2, palette.accent, 0.55);
    for (let x = 18; x < 340; x += 34) graphics.strokeRect(x, 128, 24, 29);
  } else if (chapterId === 4) {
    graphics.fillStyle(0x211d2b, 0.9);
    for (let x = 15; x < 340; x += 54) {
      graphics.fillRect(x, 65, 34, 46);
      graphics.lineStyle(2, palette.accent, 0.65).strokeRoundedRect(x + 3, 68, 28, 40, 7);
    }
    graphics.fillStyle(0xffffff, 0.05);
    for (let y = 118; y < 270; y += 16) for (let x = (y / 16) % 2 === 0 ? 0 : 16; x < 350; x += 32) graphics.fillRect(x, y, 16, 16);
  } else {
    graphics.fillStyle(0xe7dfcf, 0.16);
    for (let x = 14; x < 340; x += 42) {
      graphics.fillRect(x, 62, 32, 47);
      graphics.lineStyle(1, 0x24364a, 0.8).strokeRect(x, 62, 32, 47);
      graphics.lineBetween(x + 16, 62, x + 16, 109);
      graphics.lineBetween(x, 85, x + 32, 85);
    }
    graphics.fillStyle(0x9a6544, 0.45).fillRect(0, 209, 350, 5);
    for (let x = 0; x < 350; x += 28) graphics.fillStyle(0xd9b77e, 0.08).fillRect(x, 116, 1, 154);
  }
}

export function createMenuBackdrop(
  scene: Phaser.Scene,
  reducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  chapterId: ChapterId = 1,
): void {
  const graphics = scene.add.graphics().setDepth(-20);
  graphics.fillStyle(0x0b1026, 1);
  graphics.fillRect(0, 0, 480, 270);
  if (chapterId !== 1) {
    const palette = CHAPTER_VISUAL_PALETTES[chapterId].night;
    graphics.fillStyle(palette.skyTop, 0.78).fillRect(0, 0, 480, 105);
    graphics.fillStyle(palette.street, 0.72).fillRect(0, 176, 480, 94);
  }

  // Layered midnight skyline.
  graphics.fillStyle(0x171d39, 1);
  graphics.fillRect(0, 92, 480, 178);
  const buildings = [
    { x: 0, width: 58, top: 68 },
    { x: 51, width: 78, top: 83 },
    { x: 121, width: 66, top: 57 },
    { x: 183, width: 92, top: 76 },
    { x: 268, width: 64, top: 62 },
    { x: 326, width: 86, top: 81 },
    { x: 402, width: 78, top: 55 },
  ];
  for (const [index, building] of buildings.entries()) {
    graphics.fillStyle(index % 2 === 0 ? 0x12182f : 0x1b2140, 1);
    graphics.fillRect(building.x, building.top, building.width, 178 - building.top);
    for (let x = building.x + 10; x < building.x + building.width - 4; x += 18) {
      for (let y = building.top + 15; y < 145; y += 19) {
        graphics.fillStyle((x + y + index) % 3 === 0 ? 0xf0a85d : 0x303958, 0.82);
        graphics.fillRect(x, y, 5, 7);
      }
    }
  }

  graphics.fillStyle(0xffe7a2, 1);
  graphics.fillCircle(406, 38, 16);
  graphics.fillStyle(0x0b1026, 1);
  graphics.fillCircle(412, 33, 15);
  graphics.fillStyle(0xaebbdc, 0.75);
  for (const [x, y] of [[33, 35], [75, 54], [337, 29], [299, 48], [448, 69], [208, 25]] as const) {
    graphics.fillRect(x, y, 2, 2);
  }

  // Street and puddle reflections.
  graphics.fillStyle(0x11172e, 1);
  graphics.fillRect(0, 176, 480, 94);
  graphics.fillStyle(0x242c49, 1);
  graphics.fillRect(0, 212, 480, 2);
  graphics.fillStyle(0xd0553e, 0.14);
  graphics.fillRect(94, 216, 286, 45);
  graphics.fillStyle(0xffb45e, 0.09);
  graphics.fillRect(144, 216, 186, 39);
  graphics.fillStyle(0x505979, 0.6);
  graphics.fillRect(35, 239, 90, 1);
  graphics.fillRect(345, 227, 74, 1);

  // The little street stall.
  graphics.fillStyle(0x54313a, 1);
  graphics.fillRect(104, 112, 273, 94);
  graphics.fillStyle(0x7a3a35, 1);
  graphics.fillRect(91, 102, 298, 18);
  graphics.fillStyle(0xc84a3d, 1);
  graphics.fillRect(96, 104, 288, 11);
  for (let x = 96; x < 384; x += 32) {
    graphics.fillStyle(x % 64 === 0 ? 0xf06a4d : 0xad363c, 1);
    graphics.fillTriangle(x, 115, x + 32, 115, x + 16, 130);
  }
  graphics.fillStyle(0x2a1d2b, 1);
  graphics.fillRect(113, 132, 255, 64);
  graphics.fillStyle(0xf6a552, 0.18);
  graphics.fillRect(120, 137, 241, 54);
  graphics.fillStyle(0xd28b4e, 1);
  graphics.fillRect(105, 191, 271, 9);
  graphics.fillStyle(0x76432f, 1);
  graphics.fillRect(105, 200, 271, 9);

  if (chapterId !== 1) {
    const palette = CHAPTER_VISUAL_PALETTES[chapterId].night;
    graphics.fillStyle(palette.building, 0.22).fillRect(0, 92, 480, 84);
    graphics.fillStyle(palette.street, 0.32).fillRect(0, 176, 480, 94);
    graphics.fillStyle(palette.canopy, 0.82).fillRect(96, 104, 288, 11);
    graphics.lineStyle(2, palette.accent, 0.7).strokeRoundedRect(113, 132, 255, 64, 4);
  }

  createRain(scene, new Phaser.Geom.Rectangle(0, 0, 480, 270), 10, reducedMotion ? 12 : 34);
}

export function createRain(
  scene: Phaser.Scene,
  bounds: Phaser.Geom.Rectangle,
  depth: number,
  count: number,
): void {
  for (let index = 0; index < count; index += 1) {
    const startX = Phaser.Math.Between(bounds.x, bounds.right);
    const startY = Phaser.Math.Between(bounds.y, bounds.bottom);
    const drop = scene.add
      .image(startX, startY, "rain-drop")
      .setDepth(depth)
      .setAlpha(Phaser.Math.FloatBetween(0.18, 0.5));
    const duration = Phaser.Math.Between(850, 1_350);
    scene.tweens.add({
      targets: drop,
      x: startX - 32,
      y: bounds.bottom + 12,
      duration,
      delay: Phaser.Math.Between(0, 1_200),
      repeat: -1,
      onRepeat: () => {
        drop.setPosition(
          Phaser.Math.Between(bounds.x + 20, bounds.right + 30),
          bounds.y - Phaser.Math.Between(4, 50),
        );
      },
    });
  }
}
