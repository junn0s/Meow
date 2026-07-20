import type { CookingTicket } from "../entities/CookingStation";

export function canStartCookingTicket(
  ticket: CookingTicket,
  activeTickets: readonly CookingTicket[],
  cookingSlotCount: number,
): boolean {
  if (ticket.cookingAgent === "player") {
    if (ticket.playerStarted !== true) return false;
    return !activeTickets.some(
      (activeTicket) => activeTicket.cookingAgent === "player",
    );
  }

  if (ticket.cookingAgent === "chef" && ticket.chefWorkerId === undefined) {
    return false;
  }

  let activeChefTickets = 0;
  for (const activeTicket of activeTickets) {
    if (activeTicket.cookingAgent === "player") continue;
    activeChefTickets += 1;
    if (
      ticket.chefWorkerId !== undefined
      && activeTicket.chefWorkerId === ticket.chefWorkerId
    ) return false;
  }
  return activeChefTickets < Math.max(1, Math.floor(cookingSlotCount));
}

export function getMenuConcurrentChefLimit(
  chefCount: number,
  worktopSlotCount: number,
): number {
  return Math.min(
    Math.max(0, Math.floor(chefCount)),
    Math.max(1, Math.floor(worktopSlotCount)),
  );
}
