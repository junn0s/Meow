import type { GrowthStage, VisualPhase, VisualTier } from "../types/game";

export const WORLD_CYCLE_MS = 10 * 60 * 1_000;
export const VISUAL_CROSSFADE_MS = 8_000;

export interface VisualPhaseTiming {
  readonly phase: VisualPhase;
  readonly startMs: number;
  readonly endMs: number;
}

export interface VisualPalette {
  readonly skyTop: number;
  readonly skyBottom: number;
  readonly building: number;
  readonly street: number;
  readonly canopy: number;
  readonly interior: number;
  readonly accent: number;
  readonly reflection: number;
}

export const VISUAL_PHASE_TIMINGS: readonly VisualPhaseTiming[] = [
  { phase: "day", startMs: 0, endMs: 3 * 60 * 1_000 },
  { phase: "sunset", startMs: 3 * 60 * 1_000, endMs: 4.5 * 60 * 1_000 },
  { phase: "night", startMs: 4.5 * 60 * 1_000, endMs: 9 * 60 * 1_000 },
  { phase: "dawn", startMs: 9 * 60 * 1_000, endMs: WORLD_CYCLE_MS },
];

export const VISUAL_PALETTES: Readonly<Record<VisualPhase, VisualPalette>> = {
  day: {
    skyTop: 0x72aebe,
    skyBottom: 0xb5dde2,
    building: 0x66828a,
    street: 0x5d7075,
    canopy: 0xd85c3e,
    interior: 0xf4b45f,
    accent: 0xffe0a1,
    reflection: 0xe88c55,
  },
  sunset: {
    skyTop: 0x625785,
    skyBottom: 0xd77a68,
    building: 0x424665,
    street: 0x384353,
    canopy: 0xc54c43,
    interior: 0xf6ad5d,
    accent: 0xffd5a0,
    reflection: 0xe46e63,
  },
  night: {
    skyTop: 0x070b24,
    skyBottom: 0x111a3f,
    building: 0x182554,
    street: 0x10182f,
    canopy: 0xa83b46,
    interior: 0xffb65d,
    accent: 0x38d7ff,
    reflection: 0xf15bd1,
  },
  dawn: {
    skyTop: 0x3e5278,
    skyBottom: 0xd08a78,
    building: 0x4c5369,
    street: 0x3b4656,
    canopy: 0xbf4b43,
    interior: 0xf7b266,
    accent: 0xffc6a0,
    reflection: 0x9b70c8,
  },
};

export const VISUAL_TIER_LABELS: Readonly<Record<VisualTier, string>> = {
  1: "작은 골목 포차",
  2: "따뜻한 천막 포차",
  3: "네온이 켜진 야식당",
  4: "활기찬 달빛 스낵바",
  5: "화려한 올나이트 포차",
  6: "도시의 달빛 명소",
};

export const VISUAL_SNAPSHOT_MATRIX: readonly {
  readonly stage: GrowthStage;
  readonly phase: Exclude<VisualPhase, "dawn">;
}[] = ([1, 10, 20, 30] as const).flatMap((stage) =>
  (["day", "sunset", "night"] as const).map((phase) => ({ stage, phase })),
);
