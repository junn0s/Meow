import Phaser from "phaser";
import {
  VISUAL_CROSSFADE_MS,
  VISUAL_PALETTES,
  type VisualPalette,
} from "../data/visualData";
import type { GrowthStage, VisualPhase, VisualTier } from "../types/game";

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

export function createGameBackdrop(scene: Phaser.Scene): DinerDecor {
  const phases: readonly VisualPhase[] = ["day", "sunset", "night", "dawn"];
  const layers = new Map<VisualPhase, Phaser.GameObjects.Graphics>();
  for (const phase of phases) {
    const layer = drawGameBackdropLayer(scene, VISUAL_PALETTES[phase]);
    layer.setAlpha(phase === "night" ? 1 : 0);
    layers.set(phase, layer);
  }

  const neonDetails = scene.add.graphics().setDepth(7);
  neonDetails.fillStyle(0x38d7ff, 0.95);
  neonDetails.fillRect(12, 60, 42, 2);
  neonDetails.fillRect(296, 60, 42, 2);
  neonDetails.fillStyle(0x5d73ff, 0.8);
  neonDetails.fillRect(112, 63, 2, 42);
  neonDetails.fillRect(236, 63, 2, 42);
  neonDetails.fillStyle(0xf15bd1, 0.75);
  neonDetails.fillRect(136, 104, 78, 2);

  let currentPhase: VisualPhase = "night";
  let visualTier: VisualTier = 1;
  let currentStage: GrowthStage = 1;
  let purchasedStepCount = 0;
  let shopTier = 0;
  let shopFacilities = new Set<string>();
  const facilityDetails = scene.add.graphics().setDepth(6);

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
    if (shopTier >= 1) {
      facilityDetails.fillStyle(0xd78345, 0.95).fillCircle(31, 91, 5);
    }
    if (shopTier >= 2) {
      facilityDetails.fillStyle(0x8f5d79, 0.9).fillRect(106, 190, 28, 3);
    }
    if (shopTier >= 3) {
      facilityDetails.fillStyle(0xc88b55, 0.95).fillRect(150, 181, 50, 4);
    }
    if (shopTier >= 4) {
      facilityDetails.lineStyle(2, night ? 0x45ffd2 : 0xe5ad68, 0.95).strokeRoundedRect(287, 68, 47, 18, 4);
    }
    if (shopFacilities.has("copper-pot")) {
      facilityDetails.fillStyle(0x5b332d, 1).fillCircle(31, 91, 7);
      facilityDetails.fillStyle(0xd78345, 1).fillCircle(31, 90, 5);
      facilityDetails.fillStyle(0xffbe6b, 0.9).fillRect(27, 88, 8, 2);
    }
    if (shopFacilities.has("double-burner")) {
      facilityDetails.lineStyle(2, 0xff8c50, 0.9).strokeCircle(79, 91, 5).strokeCircle(93, 91, 5);
    }
    if (shopFacilities.has("prep-rack")) {
      facilityDetails.fillStyle(0x8ca0aa, 0.9).fillRect(122, 65, 34, 2).fillRect(122, 72, 34, 2);
    }
    if (shopFacilities.has("soft-chair")) {
      facilityDetails.fillStyle(0xa05d78, 0.95).fillRect(106, 188, 28, 5);
    }
    if (shopFacilities.has("wide-table")) {
      facilityDetails.fillStyle(0xc88b55, 0.95).fillRect(150, 180, 50, 5);
      facilityDetails.fillStyle(0x70402f, 1).fillRect(154, 185, 3, 8).fillRect(193, 185, 3, 8);
    }
    if (shopFacilities.has("moon-counter")) {
      facilityDetails.fillStyle(0x384465, 1).fillRect(287, 68, 47, 18);
      facilityDetails.lineStyle(2, night ? 0x45ffd2 : 0xe5ad68, 0.95).strokeRoundedRect(287, 68, 47, 18, 4);
    }
    if (shopFacilities.has("paper-lantern")) {
      facilityDetails.fillStyle(night ? 0x55dbe3 : 0xf4b45f, 0.95).fillRect(15, 68, 7, 11).fillRect(328, 68, 7, 11);
    }
    if (shopFacilities.has("blue-canopy")) {
      facilityDetails.fillStyle(night ? 0x315a91 : 0x4f87b8, 0.9).fillRect(5, 62, 340, 3);
      for (let x = 8; x < 345; x += 24) facilityDetails.fillTriangle(x, 65, x + 20, 65, x + 10, 72);
    }
    if (shopFacilities.has("neon-set")) {
      facilityDetails.lineStyle(2, night ? 0xf15bd1 : 0xdd776d, 0.95).strokeRoundedRect(139, 38, 72, 21, 5);
    }
    if (shopFacilities.has("moon-sign")) {
      facilityDetails.fillStyle(0xffdf71, 0.95).fillCircle(214, 45, 6);
      facilityDetails.fillStyle(night ? 0x171b35 : 0x8cc9d0, 1).fillCircle(217, 43, 6);
    }
    if (shopFacilities.has("lucky-cat")) {
      facilityDetails.fillStyle(0xffe6b7, 1).fillRect(319, 171, 8, 11);
      facilityDetails.fillStyle(0xd85c3e, 1).fillRect(321, 177, 4, 2);
    }
    if (shopFacilities.has("festival-drum")) {
      facilityDetails.fillStyle(0x7a3438, 1).fillCircle(224, 188, 8);
      facilityDetails.lineStyle(2, 0xffd45c, 1).strokeCircle(224, 188, 6);
    }
    if (shopFacilities.has("night-ledger")) {
      facilityDetails.fillStyle(0x263b76, 1).fillRect(299, 91, 14, 10);
      facilityDetails.fillStyle(0xffd45c, 1).fillRect(302, 94, 8, 1).fillRect(302, 97, 6, 1);
    }
    if (shopFacilities.has("chef-uniform") || shopFacilities.has("server-uniform")) {
      facilityDetails.fillStyle(0x6e4a35, 1).fillRect(255, 171, 30, 2);
      if (shopFacilities.has("chef-uniform")) facilityDetails.fillStyle(0x8ff0df, 1).fillRect(258, 173, 9, 11);
      if (shopFacilities.has("server-uniform")) facilityDetails.fillStyle(0xff9dcd, 1).fillRect(273, 173, 9, 11);
    }
    if (shopFacilities.has("staff-badge")) {
      facilityDetails.fillStyle(0xffdf71, 1).fillRect(269, 168, 3, 3);
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

  const sign = scene.add.image(175, 49, "sign-stall").setDepth(8).setScale(0.88);
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
      sign.setTexture(`sign-${level}`);
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
    setShopTier(tier): void {
      shopTier = Math.max(0, Math.min(4, Math.floor(tier)));
      renderFacilityDetails();
    },
    setShopFacilities(facilityIds): void {
      shopFacilities = new Set(facilityIds);
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

export function createMenuBackdrop(
  scene: Phaser.Scene,
  reducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
): void {
  const graphics = scene.add.graphics().setDepth(-20);
  graphics.fillStyle(0x0b1026, 1);
  graphics.fillRect(0, 0, 480, 270);

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
