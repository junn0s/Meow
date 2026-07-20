import type { EconomyState, SaleResult } from "../types/game";
import {
  calculateSale,
  type SaleFormulaInput,
} from "../economy/economyMath";

export const INITIAL_MONEY = 0;
export const INITIAL_RATING = 1;
export const MAX_RATING = 5;

/** Displayed menu prices and paid prices now share the same 1:1 base amount. */
export const DEFAULT_SALE_PAYOUT_MULTIPLIER = 1;
export const DEFAULT_RATING_GAIN_PER_CUSTOMER = 0.12;

export interface RecordSaleInput extends SaleFormulaInput {
  readonly ratingGain?: number;
}

export type EconomyListener = (state: EconomyState) => void;

export class EconomySystem {
  private money: number;
  private customerCount: number;
  private rating: number;
  private infiniteMoney: boolean;
  private readonly listeners = new Set<EconomyListener>();

  public constructor(initialState: Partial<EconomyState> = {}) {
    this.money = normalizeNonNegativeInteger(
      initialState.money,
      INITIAL_MONEY,
    );
    this.customerCount = normalizeNonNegativeInteger(
      initialState.customerCount,
      0,
    );
    this.rating = normalizeRating(initialState.rating, INITIAL_RATING);
    this.infiniteMoney = initialState.infiniteMoney === true;
  }

  public getState(): EconomyState {
    return {
      money: this.money,
      customerCount: this.customerCount,
      rating: this.rating,
      infiniteMoney: this.infiniteMoney,
    };
  }

  public getMoney(): number {
    return this.money;
  }

  public getCustomerCount(): number {
    return this.customerCount;
  }

  public getRating(): number {
    return this.rating;
  }

  public isInfiniteMoneyEnabled(): boolean {
    return this.infiniteMoney;
  }

  public canAfford(amount: number): boolean {
    return isNonNegativeFiniteNumber(amount) && (this.infiniteMoney || this.money >= amount);
  }

  /** The only production API that removes money. */
  public trySpend(amount: number): boolean {
    if (!Number.isInteger(amount) || !this.canAfford(amount)) {
      return false;
    }

    if (!this.infiniteMoney) this.money -= amount;
    this.notify();
    return true;
  }

  public spend(amount: number): boolean {
    return this.trySpend(amount);
  }

  public addMoney(amount: number): number {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new RangeError("Money earned must be a non-negative integer.");
    }

    this.money += amount;
    this.notify();
    return this.money;
  }

  public earn(amount: number): number {
    return this.addMoney(amount);
  }

  /**
   * Atomically records payment, the served guest, and rating progress.
   * tipRate is expressed as a fraction (0.3 means a 30% tip).
   */
  public recordSale(input: RecordSaleInput): SaleResult;
  public recordSale(menuPrice: number, tipRate?: number, ratingGain?: number): SaleResult;
  public recordSale(
    inputOrMenuPrice: RecordSaleInput | number,
    legacyTipRate = 0,
    legacyRatingGain = DEFAULT_RATING_GAIN_PER_CUSTOMER,
  ): SaleResult {
    const input: RecordSaleInput = typeof inputOrMenuPrice === "number"
      ? {
          unitPrice: inputOrMenuPrice,
          tipRate: legacyTipRate,
          ratingGain: legacyRatingGain,
        }
      : inputOrMenuPrice;
    const ratingGain = input.ratingGain ?? DEFAULT_RATING_GAIN_PER_CUSTOMER;
    assertNonNegativeFiniteNumber(ratingGain, "Rating gain");
    const sale = calculateSale(input);

    this.money += sale.totalAmount;
    this.customerCount += 1;
    this.rating = normalizeRating(this.rating + ratingGain, this.rating);
    this.notify();

    return {
      ...sale,
      moneyAfterSale: this.money,
      customerCount: this.customerCount,
      rating: this.rating,
    };
  }

  public incrementCustomerCount(amount = 1): number {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new RangeError("Customer count must increase by a non-negative integer.");
    }

    this.customerCount += amount;
    this.notify();
    return this.customerCount;
  }

  public setRating(rating: number): number {
    if (!Number.isFinite(rating)) {
      throw new RangeError("Rating must be a finite number.");
    }

    this.rating = normalizeRating(rating, this.rating);
    this.notify();
    return this.rating;
  }

  public increaseRating(amount: number): number {
    assertNonNegativeFiniteNumber(amount, "Rating increase");
    return this.setRating(this.rating + amount);
  }

  /** Updates the displayed rating from the exponentially weighted recent service score. */
  public recordServiceScore(score: number): number {
    if (!Number.isFinite(score) || score < 0 || score > 1) {
      throw new RangeError("Service score must be between 0 and 1.");
    }
    const previousAverage = clampNumber((this.rating - 1) / 4, 0, 1);
    const nextAverage = previousAverage * 0.92 + score * 0.08;
    this.rating = normalizeRating(1 + 4 * nextAverage, this.rating);
    this.notify();
    return this.rating;
  }

  public restore(state: EconomyState): void {
    this.money = normalizeNonNegativeInteger(state.money, INITIAL_MONEY);
    this.customerCount = normalizeNonNegativeInteger(state.customerCount, 0);
    this.rating = normalizeRating(state.rating, INITIAL_RATING);
    this.infiniteMoney = state.infiniteMoney === true;
    this.notify();
  }

  public reset(): void {
    this.restore({
      money: INITIAL_MONEY,
      customerCount: 0,
      rating: INITIAL_RATING,
      infiniteMoney: false,
    });
  }

  public subscribe(listener: EconomyListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Test/debug helper. Gameplay code should use addMoney and trySpend. */
  public debugSetMoney(money: number): void {
    this.money = normalizeNonNegativeInteger(money, 0);
    this.notify();
  }

  /** Runtime-only test mode. It is intentionally never serialized. */
  public debugSetInfiniteMoney(enabled: boolean): void {
    this.infiniteMoney = enabled;
    this.notify();
  }

  /** Test/debug helper for quickly checking the clear flow. */
  public debugSetProgress(customerCount: number, rating: number): void {
    this.customerCount = normalizeNonNegativeInteger(customerCount, 0);
    this.rating = normalizeRating(rating, INITIAL_RATING);
    this.notify();
  }

  private notify(): void {
    const snapshot = this.getState();

    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A view listener must never break an economy transaction.
      }
    }
  }
}

function isNonNegativeFiniteNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function assertNonNegativeFiniteNumber(value: number, label: string): void {
  if (!isNonNegativeFiniteNumber(value)) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  return value !== undefined && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function normalizeRating(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(Math.min(Math.max(value, 0), MAX_RATING) * 100) / 100;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
