import Phaser from "phaser";

export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 270;
export const RENDER_SCALE = 2;
export const RENDER_WIDTH = LOGICAL_WIDTH * RENDER_SCALE;
export const RENDER_HEIGHT = LOGICAL_HEIGHT * RENDER_SCALE;
export const TEXT_RESOLUTION = RENDER_SCALE;

const configuredTextFactories = new WeakSet<Phaser.GameObjects.GameObjectFactory>();

/**
 * Keeps the game world on a 480×270 logical grid while rendering it to a
 * 960×540 backing canvas. Text gets a matching 2× internal canvas, so Hangul
 * strokes reach the screen one-to-one instead of being rasterized at 8px and
 * enlarged after the fact.
 */
export function configureHighDefinitionScene(scene: Phaser.Scene): void {
  scene.cameras.main
    .setZoom(RENDER_SCALE)
    .centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);

  const factory = scene.add;
  if (configuredTextFactories.has(factory)) {
    return;
  }

  const originalTextFactory = factory.text.bind(factory);
  factory.text = (
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text => {
    const highResolutionStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      ...(style ?? {}),
      resolution: style?.resolution ?? TEXT_RESOLUTION,
    };
    return originalTextFactory(x, y, text, highResolutionStyle);
  };
  configuredTextFactories.add(factory);
}
