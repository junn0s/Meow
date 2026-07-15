import Phaser from "phaser";

export const UI_FONT = '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';

export interface DinerDecor {
  readonly sign: Phaser.GameObjects.Image;
  setSign(level: "stall" | "neon" | "moon"): void;
  celebrate(): void;
}

export function createGameBackdrop(scene: Phaser.Scene): DinerDecor {
  const graphics = scene.add.graphics().setDepth(-50);

  graphics.fillStyle(0x0d1229, 1);
  graphics.fillRect(0, 0, 350, 270);
  graphics.fillStyle(0x141b38, 1);
  graphics.fillRect(0, 35, 350, 81);
  graphics.fillStyle(0x1e2541, 1);
  graphics.fillRect(0, 116, 350, 154);

  // Rainy street and warm reflections.
  graphics.fillStyle(0x171d35, 1);
  graphics.fillRect(0, 224, 350, 46);
  graphics.fillStyle(0x242a45, 1);
  for (let y = 230; y < 270; y += 10) {
    graphics.fillRect(0, y, 350, 1);
  }
  graphics.fillStyle(0x9c5438, 0.18);
  graphics.fillRect(23, 225, 55, 42);
  graphics.fillStyle(0xf0a35e, 0.12);
  graphics.fillRect(145, 225, 54, 42);
  graphics.fillStyle(0xd75e43, 0.13);
  graphics.fillRect(268, 225, 54, 42);

  // Stall beams and red canopy.
  graphics.fillStyle(0x452936, 1);
  graphics.fillRect(4, 37, 5, 190);
  graphics.fillRect(341, 37, 5, 190);
  graphics.fillStyle(0x6f2d35, 1);
  graphics.fillRect(2, 36, 346, 14);
  graphics.fillStyle(0xb6423d, 1);
  graphics.fillRect(6, 38, 338, 8);
  for (let x = 8; x < 344; x += 28) {
    graphics.fillStyle(x % 56 === 8 ? 0xe05a49 : 0xa9363b, 1);
    graphics.fillTriangle(x, 46, x + 28, 46, x + 14, 57);
  }
  graphics.fillStyle(0xe6a45e, 0.85);
  graphics.fillRect(13, 58, 324, 2);

  // Warm paper lanterns.
  const lanternPositions = [25, 325];
  for (const x of lanternPositions) {
    graphics.fillStyle(0x3c2733, 1);
    graphics.fillRect(x - 1, 49, 2, 8);
    graphics.fillStyle(0xffb85f, 0.18);
    graphics.fillCircle(x, 67, 14);
    graphics.fillStyle(0xf6a24d, 1);
    graphics.fillRect(x - 5, 57, 10, 14);
    graphics.fillStyle(0xffd27c, 1);
    graphics.fillRect(x - 3, 59, 6, 10);
    graphics.fillStyle(0x6c3232, 1);
    graphics.fillRect(x - 5, 56, 10, 2);
    graphics.fillRect(x - 5, 71, 10, 2);
  }

  // Kitchen shelf and separators.
  graphics.fillStyle(0x543246, 1);
  graphics.fillRect(10, 108, 330, 6);
  graphics.fillStyle(0xb36c43, 1);
  graphics.fillRect(10, 108, 330, 2);
  graphics.fillStyle(0x313a5a, 0.9);
  graphics.fillRect(113, 63, 2, 42);
  graphics.fillRect(235, 63, 2, 42);

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

  createRain(scene, new Phaser.Geom.Rectangle(0, 35, 350, 235), 820, 24);

  return {
    sign,
    setSign(level): void {
      sign.setTexture(`sign-${level}`);
      scene.tweens.add({ targets: sign, scaleX: 1.08, scaleY: 1.08, duration: 160, yoyo: true });
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

export function createMenuBackdrop(scene: Phaser.Scene): void {
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

  createRain(scene, new Phaser.Geom.Rectangle(0, 0, 480, 270), 10, 34);
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
