import {
  VISUAL_PHASE_TIMINGS,
  WORLD_CYCLE_MS,
} from "../data/visualData";
import type {
  VisualPhase,
  VisualTier,
  WorldVisualState,
} from "../types/game";

export class DayNightController {
  private worldClockMs: number;
  private visualTier: VisualTier;

  public constructor(initialClockMs = 0, visualTier: VisualTier = 1) {
    this.worldClockMs = normalizeClock(initialClockMs);
    this.visualTier = visualTier;
  }

  public update(activeDeltaMs: number): WorldVisualState {
    if (!Number.isFinite(activeDeltaMs) || activeDeltaMs < 0) {
      throw new RangeError("Day/night delta must be a non-negative finite number.");
    }
    this.worldClockMs = normalizeClock(this.worldClockMs + activeDeltaMs);
    return this.getState();
  }

  public getState(): WorldVisualState {
    const index = VISUAL_PHASE_TIMINGS.findIndex(
      (timing) => this.worldClockMs >= timing.startMs && this.worldClockMs < timing.endMs,
    );
    const safeIndex = index < 0 ? 0 : index;
    const timing = VISUAL_PHASE_TIMINGS[safeIndex] ?? VISUAL_PHASE_TIMINGS[0];
    if (timing === undefined) {
      throw new Error("Visual phase timings are empty.");
    }
    const nextTiming = VISUAL_PHASE_TIMINGS[(safeIndex + 1) % VISUAL_PHASE_TIMINGS.length];
    if (nextTiming === undefined) {
      throw new Error("Visual phase cycle is incomplete.");
    }
    const duration = timing.endMs - timing.startMs;
    return {
      worldClockMs: this.worldClockMs,
      phase: timing.phase,
      nextPhase: nextTiming.phase,
      phaseProgress: duration <= 0 ? 1 : (this.worldClockMs - timing.startMs) / duration,
      phaseRemainingMs: timing.endMs - this.worldClockMs,
      visualTier: this.visualTier,
    };
  }

  public setClock(worldClockMs: number): WorldVisualState {
    this.worldClockMs = normalizeClock(worldClockMs);
    return this.getState();
  }

  public setPhase(phase: VisualPhase, progress = 0): WorldVisualState {
    const timing = VISUAL_PHASE_TIMINGS.find((entry) => entry.phase === phase);
    if (timing === undefined) {
      throw new RangeError(`Unknown visual phase: ${phase}`);
    }
    const clampedProgress = Math.min(0.999999, Math.max(0, progress));
    return this.setClock(timing.startMs + (timing.endMs - timing.startMs) * clampedProgress);
  }

  public setVisualTier(visualTier: VisualTier): WorldVisualState {
    this.visualTier = visualTier;
    return this.getState();
  }
}

function normalizeClock(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return ((Math.floor(value) % WORLD_CYCLE_MS) + WORLD_CYCLE_MS) % WORLD_CYCLE_MS;
}
