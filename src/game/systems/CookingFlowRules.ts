import type { CookingTicket } from "../entities/CookingStation";

export function canStartCookingTicket(
  ticket: CookingTicket,
  activeTickets: readonly CookingTicket[],
  cookingSlotCount: number,
): boolean {
  if (activeTickets.length >= Math.max(1, Math.floor(cookingSlotCount))) {
    return false;
  }
  return !activeTickets.some(
    (activeTicket) => activeTicket.chefWorkerId === ticket.chefWorkerId,
  );
}
