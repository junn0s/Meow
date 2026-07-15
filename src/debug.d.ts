import type { EconomyState, UpgradeEffects, UpgradeId } from "./game/types/game";

export interface MeowDinerDebugState {
  readonly economy: EconomyState;
  readonly effects: UpgradeEffects;
  readonly purchasedUpgradeIds: readonly UpgradeId[];
  readonly activeCustomers: number;
  readonly pendingPayments: number;
  readonly player: { readonly x: number; readonly y: number; readonly carrying?: string };
  readonly customers: readonly {
    readonly id: string;
    readonly state: string;
    readonly x: number;
    readonly y: number;
    readonly orderId?: string;
  }[];
}

export interface MeowDinerDebugApi {
  getState(): MeowDinerDebugState;
  grantMoney(amount?: number): void;
  setRating(rating?: number): void;
  purchaseNext(): boolean;
  skipTutorial(): void;
  setPlayerPosition(x: number, y: number): void;
  interact(): void;
}

declare global {
  interface Window {
    __MEOW_DINER__?: MeowDinerDebugApi;
  }
}
