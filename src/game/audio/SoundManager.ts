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
  private disposed = false;
  private ambienceOscillator: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambiencePhase?: VisualPhase;

  public constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;

    if (this.masterGain !== null && this.context !== null) {
      const now = this.context.currentTime;
      const nextVolume = muted ? 0 : 0.45;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(nextVolume, now, 0.01);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Call from an input handler if the browser requires a user gesture before
   * audio can start. It is also safe to omit; play() attempts the same resume.
   */
  public async unlock(): Promise<boolean> {
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
    if (this.muted || this.disposed) {
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
  public setAmbience(phase: VisualPhase, reducedMotion = false): void {
    this.ambiencePhase = phase;
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
    this.ambienceGain.gain.setTargetAtTime(this.muted ? 0.0001 : 0.012, now, reducedMotion ? 0.03 : 0.25);
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
      masterGain.gain.value = this.muted ? 0 : 0.45;
      masterGain.connect(context.destination);
      this.context = context;
      this.masterGain = masterGain;
      if (this.ambiencePhase !== undefined) {
        queueMicrotask(() => this.setAmbience(this.ambiencePhase ?? "night"));
      }
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
}

export default SoundManager;
import type { VisualPhase } from "../types/game";
