import type { VisualPhase } from "../types/game";

export type MusicContext = VisualPhase | "menu";

const asset = (name: string): string => `${import.meta.env?.BASE_URL ?? "/"}audio/${name}`;

const MUSIC_PLAYLISTS: Readonly<Record<MusicContext, readonly string[]>> = {
  menu: [asset("menu.opus")],
  day: [asset("day-1.opus"), asset("day-2.opus")],
  sunset: [asset("sunset-1.opus"), asset("sunset-2.opus")],
  night: [asset("night-1.opus"), asset("night-2.opus"), asset("night-3.opus")],
  dawn: [asset("dawn-1.opus"), asset("dawn-2.opus")],
};

export function getMusicPlaylist(context: MusicContext): readonly string[] {
  return MUSIC_PLAYLISTS[context];
}
