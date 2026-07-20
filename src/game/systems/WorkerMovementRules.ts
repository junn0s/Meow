export const CHARACTER_MOVE_SPEED_PX_PER_SECOND = 78;

export function calculateCharacterTravelDurationMs(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speedMultiplier = 1,
): number {
  const distance = Math.hypot(toX - fromX, toY - fromY);
  if (!Number.isFinite(distance) || distance <= 0) return 1;
  const safeSpeedMultiplier = Number.isFinite(speedMultiplier)
    ? Math.max(0.1, speedMultiplier)
    : 1;
  return Math.max(
    1,
    Math.round(distance / (CHARACTER_MOVE_SPEED_PX_PER_SECOND * safeSpeedMultiplier) * 1_000),
  );
}
