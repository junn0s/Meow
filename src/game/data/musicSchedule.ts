import type { VisualPhase } from "../types/game";

export interface MusicPhaseSlot {
  readonly phase: VisualPhase;
  readonly trackIndex: number;
  readonly durationMs: number;
}

const duration = {
  day1: 171_814, day2: 181_610,
  sunset1: 120_751, sunset2: 134_824,
  night1: 114_511, night2: 143_479, night3: 135_948,
  dawn1: 96_163, dawn2: 102_877,
} as const;

export const MUSIC_PHASE_SLOTS: readonly MusicPhaseSlot[] = [
  { phase: "day", trackIndex: 0, durationMs: duration.day1 }, { phase: "sunset", trackIndex: 0, durationMs: duration.sunset1 }, { phase: "night", trackIndex: 0, durationMs: duration.night1 }, { phase: "dawn", trackIndex: 0, durationMs: duration.dawn1 },
  { phase: "day", trackIndex: 1, durationMs: duration.day2 }, { phase: "sunset", trackIndex: 1, durationMs: duration.sunset2 }, { phase: "night", trackIndex: 1, durationMs: duration.night2 }, { phase: "dawn", trackIndex: 1, durationMs: duration.dawn2 },
  { phase: "day", trackIndex: 0, durationMs: duration.day1 }, { phase: "sunset", trackIndex: 0, durationMs: duration.sunset1 }, { phase: "night", trackIndex: 2, durationMs: duration.night3 }, { phase: "dawn", trackIndex: 0, durationMs: duration.dawn1 },
  { phase: "day", trackIndex: 1, durationMs: duration.day2 }, { phase: "sunset", trackIndex: 1, durationMs: duration.sunset2 }, { phase: "night", trackIndex: 0, durationMs: duration.night1 }, { phase: "dawn", trackIndex: 1, durationMs: duration.dawn2 },
  { phase: "day", trackIndex: 0, durationMs: duration.day1 }, { phase: "sunset", trackIndex: 0, durationMs: duration.sunset1 }, { phase: "night", trackIndex: 1, durationMs: duration.night2 }, { phase: "dawn", trackIndex: 0, durationMs: duration.dawn1 },
  { phase: "day", trackIndex: 1, durationMs: duration.day2 }, { phase: "sunset", trackIndex: 1, durationMs: duration.sunset2 }, { phase: "night", trackIndex: 2, durationMs: duration.night3 }, { phase: "dawn", trackIndex: 1, durationMs: duration.dawn2 },
];

export const MUSIC_WORLD_CYCLE_MS = MUSIC_PHASE_SLOTS.reduce((sum, slot) => sum + slot.durationMs, 0);
