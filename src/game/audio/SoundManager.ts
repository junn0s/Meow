import type { GameSettings, VisualPhase } from "../types/game";
import { getMusicPlaylist, type MusicContext } from "./musicTracks";

export const SOUND_EFFECTS = [
  "coin",
  "ready",
  "buy",
  "enter",
  "upgrade",
  "clear",
  "click",
] as const;

export type SoundEffect = (typeof SOUND_EFFECTS)[number];

export type SoundSettings = Pick<
  GameSettings,
  "masterVolume" | "musicVolume" | "sfxVolume" | "muted" | "musicMuted" | "sfxMuted"
>;

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  masterVolume: 1,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  muted: false,
  musicMuted: false,
  sfxMuted: false,
};

const MUSIC_OUTPUT_SCALE = 0.33;
const SFX_OUTPUT_SCALE = 0.5625;

interface Tone {
  readonly frequency: number;
  readonly duration: number;
  readonly offset?: number;
  readonly volume?: number;
  readonly type?: OscillatorType;
  readonly endFrequency?: number;
}

const EFFECT_TONES: Readonly<Record<SoundEffect, readonly Tone[]>> = {
  coin: [
    { frequency: 880, duration: 0.07, volume: 0.2, type: "square" },
    { frequency: 1320, duration: 0.11, offset: 0.065, volume: 0.18, type: "square" },
  ],
  ready: [
    { frequency: 523.25, duration: 0.08, volume: 0.15, type: "triangle" },
    { frequency: 659.25, duration: 0.08, offset: 0.075, volume: 0.15, type: "triangle" },
    { frequency: 783.99, duration: 0.14, offset: 0.15, volume: 0.18, type: "triangle" },
  ],
  buy: [
    { frequency: 392, duration: 0.08, volume: 0.15, type: "square" },
    { frequency: 523.25, duration: 0.11, offset: 0.07, volume: 0.17, type: "square" },
  ],
  enter: [
    { frequency: 440, duration: 0.08, volume: 0.11, type: "sine", endFrequency: 520 },
    { frequency: 659.25, duration: 0.1, offset: 0.07, volume: 0.12, type: "sine" },
  ],
  upgrade: [
    { frequency: 392, duration: 0.1, volume: 0.14, type: "triangle" },
    { frequency: 493.88, duration: 0.1, offset: 0.085, volume: 0.14, type: "triangle" },
    { frequency: 587.33, duration: 0.1, offset: 0.17, volume: 0.15, type: "triangle" },
    { frequency: 783.99, duration: 0.2, offset: 0.255, volume: 0.17, type: "triangle" },
  ],
  clear: [
    { frequency: 523.25, duration: 0.14, volume: 0.13, type: "triangle" },
    { frequency: 659.25, duration: 0.14, offset: 0.12, volume: 0.13, type: "triangle" },
    { frequency: 783.99, duration: 0.14, offset: 0.24, volume: 0.14, type: "triangle" },
    { frequency: 1046.5, duration: 0.3, offset: 0.36, volume: 0.17, type: "triangle" },
    { frequency: 1318.51, duration: 0.22, offset: 0.48, volume: 0.1, type: "sine" },
  ],
  click: [
    { frequency: 220, duration: 0.035, volume: 0.1, type: "square", endFrequency: 160 },
  ],
};

/**
 * Tiny procedural effects player. It has no audio files and does not depend on
 * Phaser's sound system, so the game can boot even when Web Audio is unavailable.
 */
export class SoundManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean;
  private musicMuted: boolean;
  private sfxMuted: boolean;
  private masterVolume: number;
  private musicVolume: number;
  private sfxVolume: number;
  private disposed = false;
  private ambienceOscillator: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambiencePhase?: VisualPhase;
  private music?: HTMLAudioElement;
  private musicContext?: MusicContext;
  private musicTrackIndex = 0;
  private musicPaused = false;
  private feverActive = false;
  private feverTone: OscillatorNode | null = null;
  private feverPulse: OscillatorNode | null = null;
  private feverPulseDepth: GainNode | null = null;
  private feverPulseGain: GainNode | null = null;
  private feverOutputGain: GainNode | null = null;

  public constructor(initial: boolean | Partial<SoundSettings> = false) {
    const settings = typeof initial === "boolean"
      ? { ...DEFAULT_SOUND_SETTINGS, muted: initial }
      : { ...DEFAULT_SOUND_SETTINGS, ...initial };
    this.muted = settings.muted;
    this.musicMuted = settings.musicMuted;
    this.sfxMuted = settings.sfxMuted;
    this.masterVolume = clampVolume(settings.masterVolume);
    this.musicVolume = clampVolume(settings.musicVolume);
    this.sfxVolume = clampVolume(settings.sfxVolume);
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyOutputLevels();
    if (!muted) void this.playMusic();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public get settings(): SoundSettings {
    return {
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      muted: this.muted,
      musicMuted: this.musicMuted,
      sfxMuted: this.sfxMuted,
    };
  }

  public setMasterVolume(volume: number): void {
    this.masterVolume = clampVolume(volume);
    this.applyOutputLevels();
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = clampVolume(volume);
    this.applyOutputLevels();
    if (!this.musicMuted && this.musicVolume > 0) void this.playMusic();
  }

  public setSfxVolume(volume: number): void {
    this.sfxVolume = clampVolume(volume);
    this.applyOutputLevels();
  }

  public toggleMusicMute(): boolean {
    this.musicMuted = !this.musicMuted;
    this.applyOutputLevels();
    if (!this.musicMuted) void this.playMusic();
    return this.musicMuted;
  }

  public toggleSfxMute(): boolean {
    this.sfxMuted = !this.sfxMuted;
    this.applyOutputLevels();
    return this.sfxMuted;
  }

  /**
   * Call from an input handler if the browser requires a user gesture before
   * audio can start. It is also safe to omit; play() attempts the same resume.
   */
  public async unlock(): Promise<boolean> {
    void this.playMusic();
    const context = this.getOrCreateContext();
    if (context === null) {
      return false;
    }

    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }

    return context.state === "running";
  }

  public play(effect: SoundEffect): void {
    if (this.muted || this.sfxMuted || this.sfxVolume <= 0 || this.disposed) {
      return;
    }

    const context = this.getOrCreateContext();
    const destination = this.masterGain;
    if (context === null || destination === null) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
    void this.playMusic();

    const startTime = context.currentTime + 0.005;
    for (const tone of EFFECT_TONES[effect]) {
      this.scheduleTone(context, destination, tone, startTime);
    }
  }

  public coin(): void {
    this.play("coin");
  }

  public ready(): void {
    this.play("ready");
  }

  public buy(): void {
    this.play("buy");
  }

  public enter(): void {
    this.play("enter");
  }

  public upgrade(): void {
    this.play("upgrade");
  }

  public clear(): void {
    this.play("clear");
  }

  public click(): void {
    this.play("click");
  }

  /** A very quiet procedural room tone that crossfades with the four visual phases. */
  public setAmbience(
    phase: VisualPhase,
    reducedMotion = false,
    trackIndex = 0,
    elapsedMs = 0,
  ): void {
    this.ambiencePhase = phase;
    this.setMusicContext(phase, trackIndex, elapsedMs);
    const context = this.getOrCreateContext();
    const destination = this.masterGain;
    if (context === null || destination === null) return;
    if (this.ambienceOscillator === null || this.ambienceGain === null) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      this.ambienceOscillator = oscillator;
      this.ambienceGain = gain;
    }
    const frequencies: Record<VisualPhase, number> = {
      day: 196,
      sunset: 164.81,
      night: 110,
      dawn: 146.83,
    };
    const now = context.currentTime;
    this.ambienceOscillator.frequency.cancelScheduledValues(now);
    this.ambienceOscillator.frequency.setTargetAtTime(frequencies[phase], now, reducedMotion ? 0.04 : 0.35);
    this.ambienceGain.gain.cancelScheduledValues(now);
    this.ambienceGain.gain.setTargetAtTime(
      this.muted || this.sfxMuted || this.sfxVolume <= 0 ? 0.0001 : 0.012,
      now,
      reducedMotion ? 0.03 : 0.25,
    );
  }

  public setMenuMusic(): void {
    this.setMusicContext("menu", 0, 0);
  }

  public setMusicPaused(paused: boolean): void {
    if (this.musicPaused === paused) return;
    this.musicPaused = paused;
    if (paused) {
      this.music?.pause();
      if (this.context?.state === "running") void this.context.suspend().catch(() => undefined);
    } else {
      if (this.context?.state === "suspended") void this.context.resume().catch(() => undefined);
      void this.playMusic();
    }
  }

  public setFeverActive(active: boolean): void {
    if (this.feverActive === active) return;
    this.feverActive = active;
    if (this.music !== undefined) this.music.playbackRate = 1;
    if (active) this.startFeverLayer();
    else this.stopFeverLayer();
  }

  public getMusicPlaybackRate(): number {
    return this.music?.playbackRate ?? 1;
  }

  public get diagnostics(): {
    readonly context?: MusicContext;
    readonly trackIndex: number;
    readonly paused: boolean;
    readonly feverLayerActive: boolean;
    readonly playbackRate: number;
    readonly currentTimeSeconds: number;
    readonly settings: SoundSettings;
  } {
    return {
      context: this.musicContext,
      trackIndex: this.musicTrackIndex,
      paused: this.musicPaused,
      feverLayerActive: this.feverTone !== null,
      playbackRate: this.getMusicPlaybackRate(),
      currentTimeSeconds: this.music?.currentTime ?? 0,
      settings: this.settings,
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    try {
      this.ambienceOscillator?.stop();
    } catch {
      // The oscillator may already have been stopped by the browser.
    }
    this.ambienceOscillator?.disconnect();
    this.ambienceGain?.disconnect();
    this.ambienceOscillator = null;
    this.ambienceGain = null;
    this.stopFeverLayer();
    if (this.music !== undefined) {
      this.music.pause();
      this.music.removeAttribute("src");
      this.music.load();
      this.music = undefined;
    }
    const context = this.context;
    this.context = null;
    this.masterGain = null;

    if (context !== null && context.state !== "closed") {
      void context.close().catch(() => undefined);
    }
  }

  /** Phaser-style alias for scene shutdown handlers. */
  public destroy(): void {
    this.dispose();
  }

  private getOrCreateContext(): AudioContext | null {
    if (this.disposed || typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      return null;
    }

    if (this.context !== null) {
      return this.context;
    }

    try {
      const context = new window.AudioContext();
      const masterGain = context.createGain();
      masterGain.gain.value = this.getSfxOutputLevel();
      masterGain.connect(context.destination);
      this.context = context;
      this.masterGain = masterGain;
      return context;
    } catch {
      return null;
    }
  }

  private scheduleTone(context: AudioContext, destination: AudioNode, tone: Tone, baseTime: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = baseTime + (tone.offset ?? 0);
    const end = start + tone.duration;
    const attackEnd = Math.min(start + 0.012, end);
    const volume = Math.max(0.0001, tone.volume ?? 0.15);

    oscillator.type = tone.type ?? "square";
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    if (tone.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency), end);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    });
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }

  private setMusicContext(context: MusicContext, trackIndex: number, elapsedMs: number): void {
    if (this.disposed) return;
    const playlist = getMusicPlaylist(context);
    const safeTrackIndex = Math.max(0, Math.min(playlist.length - 1, Math.floor(trackIndex)));
    if (this.musicContext === context && this.musicTrackIndex === safeTrackIndex) return;
    this.musicContext = context;
    this.musicTrackIndex = safeTrackIndex;
    const music = this.getOrCreateMusic();
    if (music === undefined) return;
    music.src = playlist[safeTrackIndex] ?? "";
    music.load();
    if (elapsedMs > 0) {
      music.addEventListener("loadedmetadata", () => {
        music.currentTime = Math.min(Math.max(0, elapsedMs / 1_000), Math.max(0, music.duration - 0.05));
      }, { once: true });
    }
    void this.playMusic();
  }

  private getOrCreateMusic(): HTMLAudioElement | undefined {
    if (this.disposed || typeof Audio === "undefined") return undefined;
    if (this.music !== undefined) return this.music;
    const music = new Audio();
    music.preload = "metadata";
    music.volume = this.getMusicOutputLevel();
    music.playbackRate = 1;
    this.music = music;
    return music;
  }

  private async playMusic(): Promise<void> {
    if (
      this.muted
      || this.musicMuted
      || this.musicVolume <= 0
      || this.masterVolume <= 0
      || this.musicPaused
      || this.disposed
      || this.musicContext === undefined
    ) return;
    const music = this.getOrCreateMusic();
    if (music === undefined || music.src.length === 0) return;
    try {
      await music.play();
    } catch {
      // Retry after the next user gesture when autoplay is restricted.
    }
  }

  private getMusicOutputLevel(): number {
    return this.muted || this.musicMuted
      ? 0
      : clampVolume(this.masterVolume * this.musicVolume * MUSIC_OUTPUT_SCALE);
  }

  private getSfxOutputLevel(): number {
    return this.muted || this.sfxMuted
      ? 0
      : clampVolume(this.masterVolume * this.sfxVolume * SFX_OUTPUT_SCALE);
  }

  private applyOutputLevels(): void {
    if (this.music !== undefined) this.music.volume = this.getMusicOutputLevel();
    if (this.feverOutputGain !== null && this.context !== null) {
      const now = this.context.currentTime;
      this.feverOutputGain.gain.cancelScheduledValues(now);
      this.feverOutputGain.gain.setTargetAtTime(this.getMusicOutputLevel() * 0.06, now, 0.02);
    }
    if (this.masterGain !== null && this.context !== null) {
      const now = this.context.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.getSfxOutputLevel(), now, 0.01);
    }
  }

  private startFeverLayer(): void {
    if (this.feverTone !== null || this.disposed) return;
    const context = this.getOrCreateContext();
    if (context === null) return;
    const tone = context.createOscillator();
    const pulse = context.createOscillator();
    const pulseDepth = context.createGain();
    const pulseGain = context.createGain();
    const output = context.createGain();
    tone.type = "triangle";
    tone.frequency.value = 110;
    pulse.type = "sine";
    pulse.frequency.value = 3.2;
    pulseDepth.gain.value = 0.42;
    pulseGain.gain.value = 0.55;
    output.gain.value = this.getMusicOutputLevel() * 0.06;
    tone.connect(pulseGain);
    pulse.connect(pulseDepth);
    pulseDepth.connect(pulseGain.gain);
    pulseGain.connect(output);
    output.connect(context.destination);
    tone.start();
    pulse.start();
    this.feverTone = tone;
    this.feverPulse = pulse;
    this.feverPulseDepth = pulseDepth;
    this.feverPulseGain = pulseGain;
    this.feverOutputGain = output;
  }

  private stopFeverLayer(): void {
    try {
      this.feverTone?.stop();
      this.feverPulse?.stop();
    } catch {
      // The nodes may already be stopped during scene disposal.
    }
    this.feverTone?.disconnect();
    this.feverPulse?.disconnect();
    this.feverPulseDepth?.disconnect();
    this.feverPulseGain?.disconnect();
    this.feverOutputGain?.disconnect();
    this.feverTone = null;
    this.feverPulse = null;
    this.feverPulseDepth = null;
    this.feverPulseGain = null;
    this.feverOutputGain = null;
  }
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.round(Math.max(0, Math.min(1, volume)) * 100) / 100;
}

export default SoundManager;
