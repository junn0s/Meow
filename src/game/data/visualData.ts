import type { ChapterId, GrowthStage, VisualPhase, VisualTier } from "../types/game";
import { MUSIC_PHASE_SLOTS, MUSIC_WORLD_CYCLE_MS } from "./musicSchedule";

export const WORLD_CYCLE_MS = MUSIC_WORLD_CYCLE_MS;
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

let phaseCursorMs = 0;
export const VISUAL_PHASE_TIMINGS: readonly VisualPhaseTiming[] = MUSIC_PHASE_SLOTS.map((slot) => {
  const timing = { phase: slot.phase, startMs: phaseCursorMs, endMs: phaseCursorMs + slot.durationMs };
  phaseCursorMs = timing.endMs;
  return timing;
});

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

export const CHAPTER_VISUAL_PALETTES: Readonly<Record<ChapterId, Readonly<Record<VisualPhase, VisualPalette>>>> = {
  1: VISUAL_PALETTES,
  2: {
    day: { skyTop: 0x4baec4, skyBottom: 0xbce9df, building: 0x408f9d, street: 0xe3c88f, canopy: 0x2f9f9a, interior: 0xffd389, accent: 0x4fe4d1, reflection: 0xff806f },
    sunset: { skyTop: 0x66558a, skyBottom: 0xff9a79, building: 0x315f73, street: 0xd1a875, canopy: 0x267f86, interior: 0xffbd7a, accent: 0x6ee6d6, reflection: 0xff6f86 },
    night: { skyTop: 0x071832, skyBottom: 0x123c58, building: 0x163e52, street: 0x173b47, canopy: 0x17636e, interior: 0xffc475, accent: 0x52f1dc, reflection: 0xff6684 },
    dawn: { skyTop: 0x476f91, skyBottom: 0xe99f8e, building: 0x396b79, street: 0xbdad88, canopy: 0x2c8588, interior: 0xffc981, accent: 0x7be5d3, reflection: 0xe97b88 },
  },
  3: {
    day: { skyTop: 0x91b8b0, skyBottom: 0xe8ddbd, building: 0x786a57, street: 0x8a795f, canopy: 0x4e704d, interior: 0xf0c36f, accent: 0xe9b85f, reflection: 0x6ca17b },
    sunset: { skyTop: 0x786779, skyBottom: 0xd79267, building: 0x5f4b42, street: 0x68594c, canopy: 0x435e43, interior: 0xf1b763, accent: 0xf0c36f, reflection: 0xa95d4e },
    night: { skyTop: 0x101a28, skyBottom: 0x283743, building: 0x362f2c, street: 0x292b2a, canopy: 0x304b38, interior: 0xf0b75f, accent: 0xecc46f, reflection: 0x5ea37a },
    dawn: { skyTop: 0x68798a, skyBottom: 0xd5a27e, building: 0x655748, street: 0x706454, canopy: 0x496449, interior: 0xf3bd6a, accent: 0xe9c47b, reflection: 0x7c9f78 },
  },
  4: {
    day: { skyTop: 0x9aacc5, skyBottom: 0xe8d8cf, building: 0x71606f, street: 0x655963, canopy: 0x7d354e, interior: 0xf4d391, accent: 0xe8c875, reflection: 0xa85a72 },
    sunset: { skyTop: 0x665671, skyBottom: 0xc78078, building: 0x544252, street: 0x463e48, canopy: 0x6f2f48, interior: 0xf2c47a, accent: 0xf0d188, reflection: 0xb35770 },
    night: { skyTop: 0x0d1023, skyBottom: 0x25233c, building: 0x30263a, street: 0x211d2c, canopy: 0x57213b, interior: 0xf0ca7d, accent: 0xf4d98f, reflection: 0xa64f72 },
    dawn: { skyTop: 0x616d86, skyBottom: 0xd7a18c, building: 0x5e4d5c, street: 0x504751, canopy: 0x71334b, interior: 0xf1cc83, accent: 0xf1d49a, reflection: 0x9c6077 },
  },
  5: {
    day: { skyTop: 0x9cb9bd, skyBottom: 0xe1ded0, building: 0x56666a, street: 0x88745e, canopy: 0x243d54, interior: 0xe9c98d, accent: 0x80c7bc, reflection: 0xd56a65 },
    sunset: { skyTop: 0x5c637c, skyBottom: 0xd28a78, building: 0x404b54, street: 0x655649, canopy: 0x20364b, interior: 0xe7bc7d, accent: 0x85c9bd, reflection: 0xd86665 },
    night: { skyTop: 0x080f1f, skyBottom: 0x152b3b, building: 0x24323b, street: 0x24272a, canopy: 0x172c43, interior: 0xe9bc78, accent: 0x82d1c3, reflection: 0xe46c67 },
    dawn: { skyTop: 0x5f7183, skyBottom: 0xd39a84, building: 0x4e5b5d, street: 0x6c5e50, canopy: 0x263d52, interior: 0xe8c183, accent: 0x8bc8bd, reflection: 0xcf716b },
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
