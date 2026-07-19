import assert from "node:assert/strict";
import {
  calculateSale,
  formatCompactNumber,
  getCookingTimeMs,
  getMenuPrice,
  getWorktopUpgradeCost,
} from "../src/game/economy/economyMath";
import { DayNightController } from "../src/game/systems/DayNightController";
import { MUSIC_WORLD_CYCLE_MS } from "../src/game/data/musicSchedule";
import { EconomySystem } from "../src/game/systems/EconomySystem";
import { ProgressionSystem } from "../src/game/systems/ProgressionSystem";
import { calculateOfflineReward } from "../src/game/systems/OfflineEarningsSystem";
import {
  calculateOrderPatienceMs,
  canSpawnCustomer,
  CUSTOMER_ARRIVAL_INTERVAL_MULTIPLIER,
  MAX_WAITING_CUSTOMERS,
  selectFoodRecipient,
} from "../src/game/systems/ServiceFlowRules";
import { TouchInputState } from "../src/game/input/TouchControls";
import { canStartCookingTicket } from "../src/game/systems/CookingFlowRules";
import { CustomizationSystem } from "../src/game/systems/CustomizationSystem";
import {
  getStageConfig,
  TOTAL_TARGET_ACTIVE_SECONDS,
  WORKER_HIRE_CONFIGS,
} from "../src/game/data/progressionData";
import {
  DEFAULT_SAVE_KEY,
  SAVE_DATA_VERSION,
  SaveSystem,
} from "../src/game/systems/SaveSystem";
import { CustomerState, type StorageLike } from "../src/game/types/game";

class MapStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

const sale = calculateSale({
  unitPrice: 100,
  quantity: 3,
  tipRate: 0.1,
  vipMultiplier: 1.5,
  comboMultiplier: 1.2,
  feverMultiplier: 2,
});
assert.deepEqual(sale, {
  subtotal: 300,
  baseAmount: 1_080,
  tipAmount: 108,
  totalAmount: 1_188,
});

const economy = new EconomySystem();
assert.equal(economy.recordSale(100).totalAmount, 100, "display price must equal base payment");
assert.equal(economy.getMoney(), 100, "the removed hidden x3 must not return");
assert.equal(new EconomySystem().recordServiceScore(1), 1.32);
assert.equal(getWorktopUpgradeCost(100, 2), 118);
assert.equal(getMenuPrice(100, 10), 417);
assert.equal(getCookingTimeMs(10_000, 100), 3_500, "cooking speed must respect its floor");
assert.equal(getCookingTimeMs(10_000, 0, 1, 3), 23_000);
assert.equal(formatCompactNumber(1_250_000), "1.25M");
const cosmeticEconomy = new EconomySystem({ money: 500 });
const cosmetics = new CustomizationSystem();
assert.equal(cosmetics.purchaseOrEquip("peach", cosmeticEconomy), "purchased");
assert.equal(cosmetics.getSelected().id, "peach");
assert.equal(cosmeticEconomy.getMoney(), 0);
const facilityEconomy = new EconomySystem({ money: 2_000 });
assert.equal(cosmetics.purchaseFacility("copper-pot", facilityEconomy), "purchased");
assert.equal(cosmetics.getFacilityEffects().cookingTimeMultiplier, 0.9);
assert.equal(facilityEconomy.getMoney(), 0);
const chefOneTicket = {
  customerId: "cook-a",
  menuItemId: "tteokbokki" as const,
  quantity: 1,
  chefWorkerId: "chef-1",
};
const chefTwoTicket = { ...chefOneTicket, customerId: "cook-b", chefWorkerId: "chef-2" };
assert.equal(canStartCookingTicket(chefTwoTicket, [chefOneTicket], 2), true);
assert.equal(
  canStartCookingTicket({ ...chefOneTicket, customerId: "cook-c" }, [chefOneTicket], 2),
  false,
  "one chef must not occupy two simultaneous cooking slots",
);
assert.equal(
  canStartCookingTicket(chefTwoTicket, [chefOneTicket], 1),
  false,
  "the kitchen-wide cooking-slot cap must be enforced",
);
assert.equal(getStageConfig(6).targetDurationSeconds, 204);
assert.equal(getStageConfig(11).targetDurationSeconds, 336);
assert.equal(getStageConfig(30).targetDurationSeconds, 2_520);
assert.equal(TOTAL_TARGET_ACTIVE_SECONDS, 16_218);
assert.equal(
  WORKER_HIRE_CONFIGS.find((worker) => worker.role === "server" && worker.ordinal === 1)?.cost,
  10_000,
);

const clock = new DayNightController();
assert.equal(clock.getState().phase, "day");
assert.equal(clock.getState().phaseTrackIndex, 0);
assert.equal(clock.setClock(171_814).phase, "sunset");
assert.equal(clock.setClock(292_565).phase, "night");
assert.equal(clock.setClock(407_076).phase, "dawn");
assert.equal(clock.setClock(503_239).phase, "day");
assert.equal(clock.getState().phaseTrackIndex, 1);
assert.equal(clock.getState().musicLoopIndex, 1);
assert.equal(clock.setClock(MUSIC_WORLD_CYCLE_MS).phase, "day");
assert.equal(clock.getState().musicLoopIndex, 0);

const progressionEconomy = new EconomySystem({ money: 10_000 });
const progression = new ProgressionSystem(progressionEconomy);
assert.equal(progression.getNextPurchase()?.purchase.cost, 8);
for (let step = 0; step < 6; step += 1) {
  assert.equal(progression.purchaseNext().success, true);
}
assert.equal(progression.getCurrentStage(), 2);
assert.equal(progression.getState().purchasedStepCount, 0);
assert.ok(progression.getMenuPrice("fishcake") > 18);
progression.debugGrantThroughStage(8);
assert.deepEqual(progression.getEffects().unlockedMenuIds, ["fishcake", "tteokbokki"]);
assert.equal(progression.getEffects().serverCount, 1);
assert.ok(
  (progression.getState().menuProgress.find((menu) => menu.menuItemId === "tteokbokki")?.speedLevel ?? 0) >= 1,
  "new menus must open with one speed level so their first orders do not feel stalled",
);
progression.debugGrantThroughStage(10);
assert.equal(progression.getFeverState().level, 1);
assert.equal(progression.addFeverGauge(100).activated, true);
assert.equal(progression.getFeverRevenueMultiplier(), 1.5);
progression.updateFever(15_000);
assert.equal(progression.getFeverRevenueMultiplier(), 1);
progression.debugGrantThroughStage(13);
assert.equal(progression.getEffects().chefCount, 2);
assert.equal(progression.getEffects().cookingSlotCount, 2);
assert.equal(progression.getEffects().fameLevel, 3);
assert.equal(progression.getEffects().fameRevenueMultiplier, 1.04);
progression.debugGrantThroughStage(30);
assert.equal(progression.getEffects().seatCount, 14);
assert.equal(progression.getEffects().unlockedMenuIds.length, 6);
assert.equal(progression.isFinalFacilityPurchased(), true);

assert.deepEqual(calculateOfflineReward({
  elapsedMs: 8 * 60 * 60 * 1_000,
  revenuePerSecond: 100,
  automation: 1,
  nextPurchaseCost: 1_000,
}), { elapsedMs: 4 * 60 * 60 * 1_000, amount: 450, capped: true });

const serviceCustomers = [
  {
    customerId: "first",
    customerState: CustomerState.WAITING_FOR_FOOD,
    orderId: "fishcake" as const,
    orderQuantity: 1,
    remainingQuantity: 1,
    patienceMs: 20_000,
    maxPatienceMs: 30_000,
    x: 10,
    y: 10,
  },
  {
    customerId: "urgent",
    customerState: CustomerState.WAITING_FOR_FOOD,
    orderId: "fishcake" as const,
    orderQuantity: 1,
    remainingQuantity: 1,
    patienceMs: 5_000,
    maxPatienceMs: 30_000,
    x: 100,
    y: 100,
  },
];
assert.equal(
  selectFoodRecipient(serviceCustomers, { menuItemId: "fishcake", quantity: 1 })?.customerId,
  "urgent",
  "ready food should go to any compatible guest, prioritizing the most impatient",
);
assert.equal(
  selectFoodRecipient(
    serviceCustomers,
    { menuItemId: "fishcake", quantity: 1 },
    new Set(["urgent"]),
  )?.customerId,
  "first",
  "a server-reserved guest must not receive the same order twice",
);
assert.equal(
  selectFoodRecipient(serviceCustomers, { menuItemId: "fishcake", quantity: 2 }),
  undefined,
  "one customer cannot receive more servings than remain on the order",
);
assert.equal(
  selectFoodRecipient(
    [{ ...serviceCustomers[0], customerId: "multi", orderQuantity: 2, remainingQuantity: 2 }],
    { menuItemId: "fishcake", quantity: 1 },
  )?.customerId,
  "multi",
  "multi-item orders must accept one freely assigned serving at a time",
);
assert.equal(
  selectFoodRecipient(
    [{ ...serviceCustomers[0], customerId: "complete", orderQuantity: 2, remainingQuantity: 0 }],
    { menuItemId: "fishcake", quantity: 1 },
  ),
  undefined,
  "completed multi-item orders must reject duplicate servings",
);
assert.equal(calculateOrderPatienceMs(24_000, 10_000, 1), 31_000);
assert.equal(
  calculateOrderPatienceMs(24_000, 16_500, 2),
  44_400,
  "patience must cover batch cooking time and extra servings",
);
assert.equal(MAX_WAITING_CUSTOMERS, 2);
assert.equal(CUSTOMER_ARRIVAL_INTERVAL_MULTIPLIER, 1.12);
assert.equal(canSpawnCustomer([
  ...serviceCustomers,
  { ...serviceCustomers[0], customerId: "queue-1", customerState: CustomerState.WAITING_FOR_SEAT },
], 2), true);
assert.equal(canSpawnCustomer([
  ...serviceCustomers,
  { ...serviceCustomers[0], customerId: "queue-1", customerState: CustomerState.WAITING_FOR_SEAT },
  { ...serviceCustomers[0], customerId: "queue-2", customerState: CustomerState.ENTERING },
], 2), false, "the visible waiting line must be capped at two guests");

const touchInput = new TouchInputState();
touchInput.pressDirection(11, "left");
touchInput.pressDirection(12, "up");
assert.equal(touchInput.isDirectionDown("left"), true);
assert.equal(touchInput.isDirectionDown("up"), true, "two-finger diagonal movement must be supported");
touchInput.releasePointer(11);
assert.equal(touchInput.isDirectionDown("left"), false);
assert.equal(touchInput.isDirectionDown("up"), true);
touchInput.resetDirections();
assert.equal(touchInput.isDirectionDown("up"), false, "blur and visibility reset must stop movement");
let actionCount = 0;
const removeActionListener = touchInput.subscribe("action", () => actionCount += 1);
touchInput.trigger("action");
removeActionListener();
touchInput.trigger("action");
assert.equal(actionCount, 1, "touch command listeners must be removable on scene shutdown");

const storage = new MapStorage();
storage.setItem("meow-night-diner.save.v2", JSON.stringify({
  version: 2,
  money: 321,
  purchasedUpgradeIds: ["fishcake-counter", "add-seat-1"],
  customerCount: 7,
  rating: 2.5,
  muted: false,
  tutorialCompleted: true,
  playStartedAt: 1_000,
  elapsedMs: 123_456,
  cleared: false,
  lastSavedAt: 2_000,
}));
const migrated = new SaveSystem({ storage, now: () => 3_000 }).load();
assert.ok(migrated);
assert.equal(migrated.version, SAVE_DATA_VERSION);
assert.equal(migrated.money, 321);
assert.equal(migrated.worldClockMs, 123_456);
assert.equal(migrated.progression.currentStage, 2);
assert.equal(migrated.progression.menuProgress.length, 6);
assert.equal(migrated.settings.reducedMotion, false);
assert.ok(storage.getItem(DEFAULT_SAVE_KEY), "migration must persist a v3 copy");

process.stdout.write("Foundation smoke tests: PASS (economy, progression, service flow, touch input, fever, offline, clock, save migration)\n");
