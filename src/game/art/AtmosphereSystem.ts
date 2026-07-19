import Phaser from "phaser";
import type { VisualPhase, VisualTier } from "../types/game";

export type ServiceLightMode = "normal" | "fever" | "rush";
export const MAX_DYNAMIC_LIGHTS = 24;
export const MAX_ATMOSPHERE_PARTICLES = 60;
const RAIN_PARTICLE_COUNT = 48;
const MIST_PARTICLE_COUNT = MAX_ATMOSPHERE_PARTICLES - RAIN_PARTICLE_COUNT;

export interface AtmosphereDiagnostics {
  readonly activeLights: number;
  readonly particlePoolSize: number;
  readonly visibleParticles: number;
  readonly reducedMotion: boolean;
  readonly mode: ServiceLightMode;
  readonly lowPowerMode: boolean;
}

/** Fixed-size, allocation-free atmosphere layers for the gameplay scene. */
export class AtmosphereSystem {
  private readonly lightRig: LightRig;
  private readonly reflections: ReflectionLayer;
  private readonly weather: WeatherLayer;
  private phase: VisualPhase = "day";
  private tier: VisualTier = 1;
  private mode: ServiceLightMode = "normal";
  private reducedMotion: boolean;

  public constructor(
    scene: Phaser.Scene,
    reducedMotion = false,
    private readonly lowPowerMode = false,
  ) {
    this.reducedMotion = reducedMotion;
    this.lightRig = new LightRig(scene, reducedMotion, lowPowerMode);
    this.reflections = new ReflectionLayer(scene);
    this.weather = new WeatherLayer(scene, reducedMotion, lowPowerMode);
  }

  public update(deltaMs: number): void {
    this.weather.update(deltaMs);
  }

  public setPhase(phase: VisualPhase, immediate = false): void {
    this.phase = phase;
    this.lightRig.setState(this.phase, this.tier, this.mode, immediate);
    this.reflections.setState(this.phase, this.tier, this.mode);
    this.weather.setPhase(phase);
  }

  public setVisualTier(tier: VisualTier): void {
    this.tier = tier;
    this.lightRig.setState(this.phase, this.tier, this.mode, false);
    this.reflections.setState(this.phase, this.tier, this.mode);
  }

  public setWorkerCounts(chefCount: number, serverCount: number): void {
    this.lightRig.setWorkerCount(Math.min(8, Math.max(0, chefCount + serverCount)));
    this.lightRig.setState(this.phase, this.tier, this.mode, false);
  }

  public setServiceMode(mode: ServiceLightMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.lightRig.setState(this.phase, this.tier, this.mode, false);
    this.reflections.setState(this.phase, this.tier, this.mode);
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.lightRig.setReducedMotion(reducedMotion);
    this.weather.setReducedMotion(reducedMotion);
    this.lightRig.setState(this.phase, this.tier, this.mode, true);
  }

  public getDiagnostics(): AtmosphereDiagnostics {
    return {
      activeLights: this.lightRig.getActiveCount(),
      particlePoolSize: this.weather.getPoolSize(),
      visibleParticles: this.weather.getVisibleCount(),
      reducedMotion: this.reducedMotion,
      mode: this.mode,
      lowPowerMode: this.lowPowerMode,
    };
  }

  public destroy(): void {
    this.lightRig.destroy();
    this.reflections.destroy();
    this.weather.destroy();
  }
}

class LightRig {
  private readonly scene: Phaser.Scene;
  private readonly lights: Phaser.GameObjects.Arc[] = [];
  private reducedMotion: boolean;
  private workerCount = 0;
  private activeCount = 0;

  public constructor(
    scene: Phaser.Scene,
    reducedMotion: boolean,
    private readonly lowPowerMode: boolean,
  ) {
    this.scene = scene;
    this.reducedMotion = reducedMotion;
    for (let index = 0; index < MAX_DYNAMIC_LIGHTS; index += 1) {
      const x = 15 + (index % 12) * 29;
      const y = index < 12 ? 58 : 105;
      this.lights.push(
        scene.add
          .circle(x, y, index % 5 === 0 ? 3 : 2, 0x38d7ff, 0)
          .setDepth(index < 12 ? 9 : 14)
          .setBlendMode(Phaser.BlendModes.ADD),
      );
    }
  }

  public setWorkerCount(count: number): void {
    this.workerCount = count;
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
  }

  public setState(
    phase: VisualPhase,
    tier: VisualTier,
    mode: ServiceLightMode,
    immediate: boolean,
  ): void {
    const phaseVisible = phase === "night" || phase === "sunset" || phase === "dawn";
    const tierCount = phaseVisible ? tier * 3 : 0;
    const modeBonus = mode === "normal" ? 0 : 4;
    const lightLimit = this.lowPowerMode ? 16 : MAX_DYNAMIC_LIGHTS;
    this.activeCount = Math.min(lightLimit, tierCount + this.workerCount + modeBonus);
    const color = mode === "rush" ? 0xf15bd1 : mode === "fever" ? 0x45ffd2 : 0x38d7ff;
    const targetAlpha = phase === "night" ? 0.9 : phaseVisible ? 0.28 : 0;
    const duration = immediate ? 0 : this.reducedMotion ? 120 : 260;
    for (const [index, light] of this.lights.entries()) {
      this.scene.tweens.killTweensOf(light);
      light.setFillStyle(index % 5 === 4 && mode === "normal" ? 0xffd76a : color, 1);
      const alpha = index < this.activeCount ? targetAlpha : 0;
      if (duration === 0) {
        light.setAlpha(alpha);
      } else {
        this.scene.tweens.add({
          targets: light,
          alpha,
          duration,
          delay: phase === "night" && !this.reducedMotion ? index * 40 : 0,
        });
      }
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public destroy(): void {
    for (const light of this.lights) light.destroy();
  }
}

class ReflectionLayer {
  private readonly graphics: Phaser.GameObjects.Graphics;

  public constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(5);
  }

  public setState(phase: VisualPhase, tier: VisualTier, mode: ServiceLightMode): void {
    this.graphics.clear();
    if (phase === "day") return;
    const alpha = phase === "night" ? 0.22 : 0.1;
    const accent = mode === "rush" ? 0xf15bd1 : mode === "fever" ? 0x45ffd2 : 0x38d7ff;
    for (let index = 0; index < tier + 2; index += 1) {
      const x = 13 + ((index * 57) % 306);
      const y = 224 + (index % 3) * 12;
      this.graphics.fillStyle(index % 3 === 0 ? 0xffb45e : accent, alpha);
      this.graphics.fillRect(x, y, 24 + tier * 4, 1 + (index % 2));
      this.graphics.fillStyle(accent, alpha * 0.45);
      this.graphics.fillRect(x + 5, y + 4, 12 + tier * 3, 1);
    }
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}

class WeatherLayer {
  private readonly rain: Phaser.GameObjects.Rectangle[] = [];
  private readonly mist: Phaser.GameObjects.Rectangle[] = [];
  private phase: VisualPhase = "day";
  private reducedMotion: boolean;

  public constructor(
    private readonly scene: Phaser.Scene,
    reducedMotion: boolean,
    private readonly lowPowerMode: boolean,
  ) {
    this.reducedMotion = reducedMotion;
    for (let index = 0; index < RAIN_PARTICLE_COUNT; index += 1) {
      this.rain.push(
        scene.add
          .rectangle(
            Phaser.Math.Between(0, 349),
            Phaser.Math.Between(35, 269),
            1,
            Phaser.Math.Between(3, 6),
            0x8ac7e8,
            0.22,
          )
          .setDepth(818),
      );
    }
    for (let index = 0; index < MIST_PARTICLE_COUNT; index += 1) {
      this.mist.push(
        scene.add
          .rectangle(
            Phaser.Math.Between(0, 349),
            212 + (index % 4) * 13,
            Phaser.Math.Between(18, 42),
            2,
            0xd8d5ee,
            0,
          )
          .setDepth(6),
      );
    }
    this.refreshVisibility();
  }

  public update(deltaMs: number): void {
    const rainCount = this.reducedMotion ? 12 : this.lowPowerMode ? 24 : RAIN_PARTICLE_COUNT;
    const rainSpeed = this.reducedMotion ? 0.035 : 0.095;
    for (let index = 0; index < rainCount; index += 1) {
      const drop = this.rain[index];
      if (drop === undefined || !drop.visible) continue;
      drop.x -= deltaMs * rainSpeed * 0.35;
      drop.y += deltaMs * rainSpeed;
      if (drop.y > 274) drop.setPosition(Phaser.Math.Between(20, 370), 34);
    }
    const mistCount = this.reducedMotion ? 3 : this.lowPowerMode ? 6 : MIST_PARTICLE_COUNT;
    for (let index = 0; index < mistCount; index += 1) {
      const fog = this.mist[index];
      if (fog === undefined || !fog.visible) continue;
      fog.x += deltaMs * (this.reducedMotion ? 0.002 : 0.006);
      if (fog.x > 370) fog.x = -30;
    }
  }

  public setPhase(phase: VisualPhase): void {
    this.phase = phase;
    this.refreshVisibility();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.refreshVisibility();
  }

  public getPoolSize(): number {
    return this.rain.length + this.mist.length;
  }

  public getVisibleCount(): number {
    return [...this.rain, ...this.mist].filter((particle) => particle.visible).length;
  }

  public destroy(): void {
    for (const particle of [...this.rain, ...this.mist]) particle.destroy();
  }

  private refreshVisibility(): void {
    const rainy = this.phase === "night" || this.phase === "sunset";
    const rainCount = rainy
      ? (this.reducedMotion ? 12 : this.lowPowerMode ? 24 : RAIN_PARTICLE_COUNT)
      : 0;
    this.rain.forEach((drop, index) => drop.setVisible(index < rainCount));
    const foggy = this.phase === "dawn";
    const mistCount = foggy
      ? (this.reducedMotion ? 3 : this.lowPowerMode ? 6 : MIST_PARTICLE_COUNT)
      : 0;
    this.mist.forEach((fog, index) => fog.setVisible(index < mistCount).setAlpha(foggy ? 0.12 : 0));
  }
}
