import {
  DEFAULT_PURCHASED_UPGRADE_IDS,
  UPGRADES,
} from "../data/upgradeData";
import {
  isUpgradeId,
  type GameSettings,
  type SaveData,
  type SaveDataInput,
  type StorageLike,
  type UpgradeData,
  type UpgradeId,
} from "../types/game";
import { INITIAL_MONEY, INITIAL_RATING, MAX_RATING } from "./EconomySystem";

export const SAVE_DATA_VERSION = 2;
export const DEFAULT_SAVE_KEY = "meow-night-diner.save.v2";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  masterVolume: 1,
  musicVolume: 0.55,
  sfxVolume: 0.8,
  muted: false,
};

export interface SaveSystemOptions {
  readonly storageKey?: string;
  /** Pass null to deliberately use the in-memory fallback. */
  readonly storage?: StorageLike | null;
  readonly now?: () => number;
}

/**
 * Browser-safe persistence. Every write also goes to an in-memory fallback, so
 * denied/private localStorage never interrupts the game loop.
 */
export class SaveSystem {
  private readonly storageKey: string;
  private readonly primaryStorage: StorageLike | null;
  private readonly fallbackStorage = new MemoryStorage();
  private readonly now: () => number;

  public constructor(options: SaveSystemOptions = {}) {
    this.storageKey = options.storageKey ?? DEFAULT_SAVE_KEY;
    this.primaryStorage =
      options.storage === undefined
        ? resolveBrowserStorage()
        : options.storage;
    this.now = options.now ?? Date.now;
  }

  public hasSave(): boolean {
    return this.load() !== null;
  }

  /** Returns null when no valid save exists; it never throws. */
  public load(): SaveData | null {
    const serialized = this.readSerialized();
    if (serialized === null) {
      return null;
    }

    try {
      return normalizeUnknownSave(JSON.parse(serialized), this.getNow());
    } catch {
      return null;
    }
  }

  public loadOrCreate(): SaveData {
    return this.load() ?? this.newGame();
  }

  public newGame(overrides: Partial<SaveDataInput> = {}): SaveData {
    const now = this.getNow();
    const base = createDefaultSaveData(now);

    return this.save({
      money: overrides.money ?? base.money,
      purchasedUpgradeIds:
        overrides.purchasedUpgradeIds ?? base.purchasedUpgradeIds,
      customerCount: overrides.customerCount ?? base.customerCount,
      rating: overrides.rating ?? base.rating,
      settings: overrides.settings ?? base.settings,
      muted: overrides.muted ?? base.muted,
      tutorialCompleted:
        overrides.tutorialCompleted ?? base.tutorialCompleted,
      playStartedAt: overrides.playStartedAt ?? now,
      elapsedMs: overrides.elapsedMs ?? 0,
      cleared: overrides.cleared ?? false,
    });
  }

  public createNewGame(overrides: Partial<SaveDataInput> = {}): SaveData {
    return this.newGame(overrides);
  }

  public save(data: SaveData): SaveData;
  public save(data: SaveDataInput): SaveData;
  public save(data: SaveData | SaveDataInput): SaveData {
    const now = this.getNow();
    const settings = normalizeSettings(data.settings, data.muted);
    const purchasedUpgradeIds = normalizePurchasedUpgradeIds(
      data.purchasedUpgradeIds,
    );
    const rating = normalizeNumber(data.rating, INITIAL_RATING, 0, MAX_RATING);
    const muted = normalizeBoolean(data.muted, settings.muted);
    const saved: SaveData = {
      version: SAVE_DATA_VERSION,
      money: normalizeInteger(data.money, INITIAL_MONEY, 0),
      purchasedUpgradeIds,
      customerCount: normalizeInteger(data.customerCount, 0, 0),
      rating,
      settings: { ...settings, muted },
      muted,
      tutorialCompleted: normalizeBoolean(data.tutorialCompleted, false),
      playStartedAt: normalizeTimestamp(data.playStartedAt, now),
      elapsedMs: normalizeInteger(data.elapsedMs, 0, 0),
      cleared:
        normalizeBoolean(data.cleared, false) ||
        (purchasedUpgradeIds.includes("moonlight-sign") &&
          rating >= MAX_RATING),
      lastSavedAt: now,
    };

    this.writeSerialized(JSON.stringify(saved));
    return cloneSaveData(saved);
  }

  /** Removes persisted data and returns, but does not persist, a clean state. */
  public reset(): SaveData {
    this.removeSerialized();
    return createDefaultSaveData(this.getNow());
  }

  public clear(): SaveData {
    return this.reset();
  }

  public isPersistentStorageAvailable(): boolean {
    return this.primaryStorage !== null;
  }

  public getStorageKey(): string {
    return this.storageKey;
  }

  /** Debug/import helper. Valid legacy fields are normalized before writing. */
  public importSerialized(serialized: string): SaveData | null {
    try {
      const normalized = normalizeUnknownSave(
        JSON.parse(serialized),
        this.getNow(),
      );
      if (normalized === null) {
        return null;
      }

      return this.save(normalized);
    } catch {
      return null;
    }
  }

  public exportSerialized(): string | null {
    return this.readSerialized();
  }

  private getNow(): number {
    return normalizeTimestamp(this.now(), Date.now());
  }

  private readSerialized(): string | null {
    const fallback = this.fallbackStorage.getItem(this.storageKey);
    if (this.primaryStorage !== null) {
      try {
        const stored = this.primaryStorage.getItem(this.storageKey);
        if (stored !== null) {
          return chooseNewestSerialized(stored, fallback);
        }
      } catch {
        // Continue with the fallback below.
      }
    }

    return fallback;
  }

  private writeSerialized(serialized: string): void {
    this.fallbackStorage.setItem(this.storageKey, serialized);

    if (this.primaryStorage !== null) {
      try {
        this.primaryStorage.setItem(this.storageKey, serialized);
      } catch {
        // The in-memory copy keeps the current session playable.
      }
    }
  }

  private removeSerialized(): void {
    this.fallbackStorage.removeItem(this.storageKey);

    if (this.primaryStorage !== null) {
      try {
        this.primaryStorage.removeItem(this.storageKey);
      } catch {
        // Storage denial is intentionally non-fatal.
      }
    }
  }
}

export function createDefaultSaveData(now = Date.now()): SaveData {
  const normalizedNow = normalizeTimestamp(now, Date.now());
  return {
    version: SAVE_DATA_VERSION,
    money: INITIAL_MONEY,
    purchasedUpgradeIds: [...DEFAULT_PURCHASED_UPGRADE_IDS],
    customerCount: 0,
    rating: INITIAL_RATING,
    settings: { ...DEFAULT_GAME_SETTINGS },
    muted: DEFAULT_GAME_SETTINGS.muted,
    tutorialCompleted: false,
    playStartedAt: normalizedNow,
    elapsedMs: 0,
    cleared: false,
    lastSavedAt: normalizedNow,
  };
}

class MemoryStorage implements StorageLike {
  private static readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return MemoryStorage.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    MemoryStorage.values.set(key, value);
  }

  public removeItem(key: string): void {
    MemoryStorage.values.delete(key);
  }
}

function resolveBrowserStorage(): StorageLike | null {
  try {
    const candidate: unknown = Reflect.get(globalThis, "localStorage");
    return isStorageLike(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function isStorageLike(value: unknown): value is StorageLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  try {
    return (
      typeof Reflect.get(value, "getItem") === "function" &&
      typeof Reflect.get(value, "setItem") === "function" &&
      typeof Reflect.get(value, "removeItem") === "function"
    );
  } catch {
    return false;
  }
}

function normalizeUnknownSave(value: unknown, now: number): SaveData | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawPurchasedIds = Array.isArray(value.purchasedUpgradeIds)
    ? value.purchasedUpgradeIds
    : Array.isArray(value.purchasedUpgrades)
      ? value.purchasedUpgrades
      : [];
  const purchasedUpgradeIds = normalizePurchasedUpgradeIds(rawPurchasedIds);
  const rating = normalizeNumber(value.rating, INITIAL_RATING, 0, MAX_RATING);
  const settings = normalizeSettings(value.settings, value.muted);
  const muted = normalizeBoolean(value.muted, settings.muted);
  const lastSavedAt = normalizeTimestamp(value.lastSavedAt, now);
  const playStartedAt = normalizeTimestamp(value.playStartedAt, lastSavedAt);

  return {
    version: SAVE_DATA_VERSION,
    money: normalizeInteger(value.money, INITIAL_MONEY, 0),
    purchasedUpgradeIds,
    customerCount: normalizeInteger(value.customerCount, 0, 0),
    rating,
    settings: { ...settings, muted },
    muted,
    tutorialCompleted: normalizeBoolean(value.tutorialCompleted, false),
    playStartedAt,
    elapsedMs: normalizeInteger(
      value.elapsedMs,
      Math.max(0, lastSavedAt - playStartedAt),
      0,
    ),
    cleared:
      normalizeBoolean(value.cleared, false) ||
      (purchasedUpgradeIds.includes("moonlight-sign") &&
        rating >= MAX_RATING),
    lastSavedAt,
  };
}

function normalizePurchasedUpgradeIds(values: readonly unknown[]): UpgradeId[] {
  const requestedIds = new Set<UpgradeId>();
  for (const value of values) {
    if (isUpgradeId(value)) {
      requestedIds.add(value);
    }
  }

  const normalizedIds: UpgradeId[] = [];
  const upgrades: readonly UpgradeData[] = UPGRADES;
  for (const upgrade of upgrades) {
    const isStartingUpgrade =
      upgrade.cost === 0 && upgrade.prerequisiteId === undefined;
    const prerequisiteMet =
      upgrade.prerequisiteId === undefined ||
      normalizedIds.includes(upgrade.prerequisiteId);

    if (
      prerequisiteMet &&
      (isStartingUpgrade || requestedIds.has(upgrade.id))
    ) {
      normalizedIds.push(upgrade.id);
    }
  }

  return normalizedIds;
}

function normalizeSettings(value: unknown, legacyMuted: unknown): GameSettings {
  const settings = isRecord(value) ? value : {};
  return {
    masterVolume: normalizeNumber(settings.masterVolume, 1, 0, 1),
    musicVolume: normalizeNumber(settings.musicVolume, 0.55, 0, 1),
    sfxVolume: normalizeNumber(settings.sfxVolume, 0.8, 0, 1),
    muted: normalizeBoolean(
      settings.muted,
      normalizeBoolean(legacyMuted, false),
    ),
  };
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  minimum: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(Math.floor(value), minimum)
    : fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : fallback;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : Math.floor(fallback);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneSaveData(save: SaveData): SaveData {
  return {
    ...save,
    purchasedUpgradeIds: [...save.purchasedUpgradeIds],
    settings: { ...save.settings },
  };
}

function chooseNewestSerialized(primary: string, fallback: string | null): string {
  if (fallback === null) {
    return primary;
  }
  const primaryInfo = inspectSerialized(primary);
  const fallbackInfo = inspectSerialized(fallback);
  if (!fallbackInfo.valid) {
    return primary;
  }
  if (!primaryInfo.valid || fallbackInfo.lastSavedAt >= primaryInfo.lastSavedAt) {
    return fallback;
  }
  return primary;
}

function inspectSerialized(serialized: string): {
  readonly valid: boolean;
  readonly lastSavedAt: number;
} {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isRecord(parsed)) {
      return { valid: false, lastSavedAt: -1 };
    }
    return {
      valid: true,
      lastSavedAt:
        typeof parsed.lastSavedAt === "number" && Number.isFinite(parsed.lastSavedAt)
          ? parsed.lastSavedAt
          : -1,
    };
  } catch {
    return { valid: false, lastSavedAt: -1 };
  }
}
