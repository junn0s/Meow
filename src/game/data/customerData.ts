import type { CustomerData, CustomerKind } from "../types/game";

export const CUSTOMER_DATA = [
  {
    id: "rabbit",
    name: "토끼",
    emoji: "🐰",
    color: 0xf4d9e7,
    patienceMs: 18_000,
    eatingTimeMs: 4_000,
    tipChance: 0.1,
    spawnWeight: 1,
    maxOrderQuantity: 1,
  },
  {
    id: "dog",
    name: "강아지",
    emoji: "🐶",
    color: 0xd6a86b,
    patienceMs: 25_000,
    eatingTimeMs: 5_000,
    tipChance: 0.45,
    spawnWeight: 1.2,
    maxOrderQuantity: 1,
  },
  {
    id: "hamster",
    name: "햄스터",
    emoji: "🐹",
    color: 0xf2bd62,
    preferredMenuId: "fish-bread",
    patienceMs: 22_000,
    eatingTimeMs: 3_000,
    tipChance: 0.2,
    spawnWeight: 0.9,
    maxOrderQuantity: 1,
  },
  {
    id: "raccoon",
    name: "너구리",
    emoji: "🦝",
    color: 0x8c8b91,
    preferredMenuId: "tteokbokki",
    patienceMs: 28_000,
    eatingTimeMs: 6_000,
    tipChance: 0.25,
    spawnWeight: 0.8,
    maxOrderQuantity: 2,
  },
] as const satisfies readonly CustomerData[];

/** Alias kept concise for systems that treat the entries as customer types. */
export const CUSTOMER_TYPES: readonly CustomerData[] = CUSTOMER_DATA;

export function getCustomerData(customerKind: CustomerKind): CustomerData {
  const customer = CUSTOMER_DATA.find(({ id }) => id === customerKind);

  if (customer === undefined) {
    throw new Error(`Unknown customer kind: ${customerKind}`);
  }

  return customer;
}

export function pickCustomerData(randomValue = Math.random()): CustomerData {
  const totalWeight = CUSTOMER_DATA.reduce(
    (sum, customer) => sum + customer.spawnWeight,
    0,
  );
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 0.999_999)
    : 0;
  let cursor = normalizedRandom * totalWeight;

  for (const customer of CUSTOMER_DATA) {
    cursor -= customer.spawnWeight;
    if (cursor < 0) {
      return customer;
    }
  }

  return CUSTOMER_DATA[0];
}
