import {
  CustomerState,
  type MenuItemId,
} from "../types/game";

export const MAX_WAITING_CUSTOMERS = 2;
export const CUSTOMER_ARRIVAL_INTERVAL_MULTIPLIER = 1.12;

export interface ServiceCustomerCandidate {
  readonly customerId: string;
  readonly customerState: CustomerState;
  readonly orderId?: MenuItemId;
  readonly orderQuantity: number;
  readonly remainingQuantity: number;
  readonly patienceMs: number;
  readonly maxPatienceMs: number;
  readonly x: number;
  readonly y: number;
}

export interface PreparedFood {
  readonly menuItemId: MenuItemId;
  readonly quantity: number;
}

export interface OrderPatienceContext {
  /** Estimated time already committed to this menu's cooking station. */
  readonly kitchenQueueDelayMs?: number;
  /** True while the owner must take orders because no chef is available. */
  readonly manualOrderTaking?: boolean;
}

export function calculateSeatWaitPatienceMs(
  basePatienceMs: number,
  waitingAhead = 0,
): number {
  const safeBase = Math.max(1, Number.isFinite(basePatienceMs) ? basePatienceMs : 1);
  const safeWaitingAhead = Math.max(0, Math.floor(waitingAhead));
  return Math.round(Math.max(18_000, safeBase * 0.75) + safeWaitingAhead * 4_000);
}

export function calculateOrderPatienceMs(
  basePatienceMs: number,
  singleServingCookingTimeMs: number,
  quantity = 1,
  context: OrderPatienceContext = {},
): number {
  const safeBase = Math.max(1, Number.isFinite(basePatienceMs) ? basePatienceMs : 1);
  const safeCookingTime = Math.max(
    0,
    Number.isFinite(singleServingCookingTimeMs) ? singleServingCookingTimeMs : 0,
  );
  const safeQuantity = Math.max(1, Math.round(quantity));
  const safeQueueDelay = Math.max(
    0,
    Number.isFinite(context.kitchenQueueDelayMs) ? context.kitchenQueueDelayMs ?? 0 : 0,
  );
  const baseBudget = Math.max(25_000, safeBase);
  const cookingBudget = safeCookingTime * 1.5;
  const quantityBudget = (safeQuantity - 1) * safeCookingTime * 0.7;
  const congestionBudget = safeQueueDelay * 0.75;
  const manualOrderBudget = context.manualOrderTaking
    ? Math.max(5_000, safeCookingTime * 0.5)
    : 0;
  return Math.round(
    baseBudget + cookingBudget + quantityBudget + congestionBudget + manualOrderBudget,
  );
}

export function canSpawnCustomer(
  customers: Iterable<ServiceCustomerCandidate>,
  seatCount: number,
): boolean {
  let activeCount = 0;
  let waitingCount = 0;

  for (const customer of customers) {
    if (
      customer.customerState !== CustomerState.LEAVING
      && customer.customerState !== CustomerState.PAYING
    ) {
      activeCount += 1;
    }
    if (
      customer.customerState === CustomerState.ENTERING
      || customer.customerState === CustomerState.WAITING_FOR_SEAT
    ) {
      waitingCount += 1;
    }
  }

  return waitingCount < MAX_WAITING_CUSTOMERS
    && activeCount < Math.max(1, seatCount) + MAX_WAITING_CUSTOMERS;
}

export function canReceiveFood(
  customer: ServiceCustomerCandidate,
  food: PreparedFood,
  reservedCustomerIds: ReadonlySet<string> = new Set<string>(),
): boolean {
  return customer.customerState === CustomerState.WAITING_FOR_FOOD
    && customer.orderId === food.menuItemId
    && customer.remainingQuantity >= food.quantity
    && !reservedCustomerIds.has(customer.customerId);
}

export function selectFoodRecipient<T extends ServiceCustomerCandidate>(
  customers: Iterable<T>,
  food: PreparedFood,
  reservedCustomerIds: ReadonlySet<string> = new Set<string>(),
  origin: Readonly<{ x: number; y: number }> = { x: 0, y: 0 },
): T | undefined {
  let selected: T | undefined;
  let selectedPatienceRatio = Number.POSITIVE_INFINITY;
  let selectedDistanceSquared = Number.POSITIVE_INFINITY;

  for (const customer of customers) {
    if (!canReceiveFood(customer, food, reservedCustomerIds)) continue;
    const patienceRatio = customer.maxPatienceMs <= 0
      ? 0
      : customer.patienceMs / customer.maxPatienceMs;
    const distanceSquared = (customer.x - origin.x) ** 2 + (customer.y - origin.y) ** 2;
    if (
      patienceRatio < selectedPatienceRatio
      || (patienceRatio === selectedPatienceRatio && distanceSquared < selectedDistanceSquared)
    ) {
      selected = customer;
      selectedPatienceRatio = patienceRatio;
      selectedDistanceSquared = distanceSquared;
    }
  }

  return selected;
}
