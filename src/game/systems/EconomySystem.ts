import type { EconomyState, SaleResult } from "../types/game";

export const INITIAL_MONEY = 0;
export const INITIAL_RATING = 1;
export const MAX_RATING = 5;

/**
 * Keeping the documented upgrade costs while paying out three times the menu
 * board price makes a complete run land near the five-to-eight minute target.
 */
export const DEFAULT_SALE_PAYOUT_MULTIPLIER = 3;
export const DEFAULT_RATING_GAIN_PER_CUSTOMER = 0.12;

export type EconomyListener = (state: EconomyState) => void;

export class EconomySystem {
  private money: number;
  private customerCount: number;
  private rating: number;
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
  }

  public getState(): EconomyState {
    return {
      money: this.money,
      customerCount: this.customerCount,
      rating: this.rating,
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

  public canAfford(amount: number): boolean {
    return isNonNegativeFiniteNumber(amount) && this.money >= amount;
  }

  /** The only production API that removes money. */
  public trySpend(amount: number): boolean {
    if (!Number.isInteger(amount) || !this.canAfford(amount)) {
      return false;
    }

    this.money -= amount;
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
  public recordSale(
    menuPrice: number,
    tipRate = 0,
    ratingGain = DEFAULT_RATING_GAIN_PER_CUSTOMER,
    payoutMultiplier = DEFAULT_SALE_PAYOUT_MULTIPLIER,
  ): SaleResult {
    assertNonNegativeFiniteNumber(menuPrice, "Menu price");
    assertNonNegativeFiniteNumber(tipRate, "Tip rate");
    assertNonNegativeFiniteNumber(ratingGain, "Rating gain");
    assertNonNegativeFiniteNumber(payoutMultiplier, "Payout multiplier");

    const baseAmount = Math.round(menuPrice * payoutMultiplier);
    const tipAmount = Math.round(baseAmount * tipRate);
    const totalAmount = baseAmount + tipAmount;

    this.money += totalAmount;
    this.customerCount += 1;
    this.rating = normalizeRating(this.rating + ratingGain, this.rating);
    this.notify();

    return {
      baseAmount,
      tipAmount,
      totalAmount,
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

  public restore(state: EconomyState): void {
    this.money = normalizeNonNegativeInteger(state.money, INITIAL_MONEY);
    this.customerCount = normalizeNonNegativeInteger(state.customerCount, 0);
    this.rating = normalizeRating(state.rating, INITIAL_RATING);
    this.notify();
  }

  public reset(): void {
    this.restore({
      money: INITIAL_MONEY,
      customerCount: 0,
      rating: INITIAL_RATING,
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
