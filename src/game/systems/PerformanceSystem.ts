import type { PerformanceMode } from "../types/game";

export interface PerformanceProfile {
  readonly mode: PerformanceMode;
  readonly targetFps: number;
  readonly lightLimit: number;
  readonly rainLimit: number;
  readonly mistLimit: number;
  readonly atmosphereUpdateIntervalMs: number;
  readonly uiUpdateIntervalMs: number;
  readonly automationUpdateIntervalMs: number;
  readonly interactionUpdateIntervalMs: number;
  readonly customerUiUpdateIntervalMs: number;
  readonly workerAnimationIntervalMs: number;
  readonly reflectionsEnabled: boolean;
}

export function getPerformanceProfile(
  mode: PerformanceMode,
  mobile: boolean,
): PerformanceProfile {
  if (mode === "quality") {
    return {
      mode,
      targetFps: 60,
      lightLimit: 24,
      rainLimit: 48,
      mistLimit: 12,
      atmosphereUpdateIntervalMs: 0,
      uiUpdateIntervalMs: 0,
      automationUpdateIntervalMs: 50,
      interactionUpdateIntervalMs: 50,
      customerUiUpdateIntervalMs: 50,
      workerAnimationIntervalMs: 360,
      reflectionsEnabled: true,
    };
  }
  if (mode === "battery") {
    return {
      mode,
      targetFps: 24,
      lightLimit: 8,
      rainLimit: 12,
      mistLimit: 2,
      atmosphereUpdateIntervalMs: 80,
      uiUpdateIntervalMs: 200,
      automationUpdateIntervalMs: 160,
      interactionUpdateIntervalMs: 120,
      customerUiUpdateIntervalMs: 160,
      workerAnimationIntervalMs: 720,
      reflectionsEnabled: false,
    };
  }
  return {
    mode,
    targetFps: mobile ? 30 : 60,
    lightLimit: mobile ? 16 : 20,
    rainLimit: mobile ? 24 : 36,
    mistLimit: mobile ? 6 : 8,
    atmosphereUpdateIntervalMs: mobile ? 34 : 20,
    uiUpdateIntervalMs: mobile ? 100 : 50,
    automationUpdateIntervalMs: mobile ? 100 : 67,
    interactionUpdateIntervalMs: mobile ? 80 : 50,
    customerUiUpdateIntervalMs: mobile ? 100 : 75,
    workerAnimationIntervalMs: mobile ? 520 : 420,
    reflectionsEnabled: true,
  };
}

export function normalizePerformanceMode(value: unknown): PerformanceMode {
  return value === "quality" || value === "battery" ? value : "balanced";
}

export function getPerformanceModeLabel(mode: PerformanceMode): string {
  return mode === "quality" ? "고화질" : mode === "battery" ? "절전" : "균형";
}
