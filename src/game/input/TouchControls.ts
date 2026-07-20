export const TOUCH_DIRECTIONS = ["up", "down", "left", "right"] as const;
export type TouchDirection = (typeof TOUCH_DIRECTIONS)[number];
export type TouchCommand = "action" | "pause";

type CommandListener = () => void;

export class TouchInputState {
  private readonly directionsByPointer = new Map<number, ReadonlySet<TouchDirection>>();
  private readonly commandListeners = new Map<TouchCommand, Set<CommandListener>>();

  public pressDirection(pointerId: number, direction: TouchDirection): void {
    this.setPointerDirections(pointerId, [direction]);
  }

  public setPointerDirections(
    pointerId: number,
    directions: readonly TouchDirection[],
  ): void {
    const validDirections = new Set(
      directions.filter((direction) => TOUCH_DIRECTIONS.includes(direction)),
    );
    if (validDirections.size === 0) {
      this.directionsByPointer.delete(pointerId);
      return;
    }
    this.directionsByPointer.set(pointerId, validDirections);
  }

  public releasePointer(pointerId: number): void {
    this.directionsByPointer.delete(pointerId);
  }

  public isDirectionDown(direction: TouchDirection): boolean {
    for (const activeDirections of this.directionsByPointer.values()) {
      if (activeDirections.has(direction)) return true;
    }
    return false;
  }

  public resetDirections(): void {
    this.directionsByPointer.clear();
  }

  public subscribe(command: TouchCommand, listener: CommandListener): () => void {
    const listeners = this.commandListeners.get(command) ?? new Set<CommandListener>();
    listeners.add(listener);
    this.commandListeners.set(command, listeners);
    return () => listeners.delete(listener);
  }

  public trigger(command: TouchCommand): void {
    for (const listener of this.commandListeners.get(command) ?? []) listener();
  }
}

export const touchInput = new TouchInputState();

export function getJoystickDirections(
  horizontal: number,
  vertical: number,
  deadZone = 0.2,
): readonly TouchDirection[] {
  const magnitude = Math.hypot(horizontal, vertical);
  if (!Number.isFinite(magnitude) || magnitude < Math.max(0, deadZone)) return [];
  const x = horizontal / magnitude;
  const y = vertical / magnitude;
  const directions: TouchDirection[] = [];
  if (x <= -0.38) directions.push("left");
  if (x >= 0.38) directions.push("right");
  if (y <= -0.38) directions.push("up");
  if (y >= 0.38) directions.push("down");
  return directions;
}

export function bindTouchControls(root: ParentNode = document): () => void {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>(
    "button[data-touch-direction], button[data-touch-command]",
  )];
  const cleanups: Array<() => void> = [];

  for (const button of buttons) {
    const direction = parseDirection(button.dataset.touchDirection);
    const command = parseCommand(button.dataset.touchCommand);
    const activePointerIds = new Set<number>();

    const setPressed = (pressed: boolean): void => {
      if (pressed) button.dataset.touchActive = "true";
      else delete button.dataset.touchActive;
      button.setAttribute("aria-pressed", String(pressed));
    };
    const release = (event: PointerEvent): void => {
      if (!activePointerIds.delete(event.pointerId)) return;
      event.preventDefault();
      touchInput.releasePointer(event.pointerId);
      setPressed(activePointerIds.size > 0);
    };
    const press = (event: PointerEvent): void => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      const wasInactive = activePointerIds.size === 0;
      activePointerIds.add(event.pointerId);
      setPressed(true);
      if (direction !== undefined) touchInput.pressDirection(event.pointerId, direction);
      else if (command !== undefined && wasInactive) touchInput.trigger(command);
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Older mobile browsers can reject capture; pointerup still releases the input.
      }
    };
    const preventNativeGesture = (event: Event): void => event.preventDefault();

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", preventNativeGesture);
    button.addEventListener("dblclick", preventNativeGesture);
    button.addEventListener("dragstart", preventNativeGesture);
    button.addEventListener("selectstart", preventNativeGesture);
    cleanups.push(() => {
      button.removeEventListener("pointerdown", press);
      button.removeEventListener("pointerup", release);
      button.removeEventListener("pointercancel", release);
      button.removeEventListener("lostpointercapture", release);
      button.removeEventListener("contextmenu", preventNativeGesture);
      button.removeEventListener("dblclick", preventNativeGesture);
      button.removeEventListener("dragstart", preventNativeGesture);
      button.removeEventListener("selectstart", preventNativeGesture);
      for (const pointerId of activePointerIds) touchInput.releasePointer(pointerId);
      activePointerIds.clear();
      setPressed(false);
    });
  }

  const joystick = root.querySelector<HTMLElement>("[data-touch-joystick]");
  const joystickKnob = joystick?.querySelector<HTMLElement>("[data-touch-joystick-knob]");
  let joystickPointerId: number | undefined;

  const resetJoystick = (): void => {
    if (joystickPointerId !== undefined) touchInput.releasePointer(joystickPointerId);
    joystickPointerId = undefined;
    if (joystick !== null) delete joystick.dataset.touchActive;
    if (joystickKnob !== null && joystickKnob !== undefined) {
      joystickKnob.style.transform = "translate3d(0, 0, 0)";
    }
  };
  const updateJoystick = (event: PointerEvent): void => {
    if (joystick === null || joystickPointerId !== event.pointerId) return;
    event.preventDefault();
    const bounds = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
    const horizontal = (event.clientX - (bounds.left + bounds.width / 2)) / radius;
    const vertical = (event.clientY - (bounds.top + bounds.height / 2)) / radius;
    const distance = Math.hypot(horizontal, vertical);
    const clamp = distance > 1 ? 1 / distance : 1;
    const clampedX = horizontal * clamp;
    const clampedY = vertical * clamp;
    touchInput.setPointerDirections(
      event.pointerId,
      getJoystickDirections(clampedX, clampedY),
    );
    if (joystickKnob !== null && joystickKnob !== undefined) {
      const travel = radius * 0.42;
      joystickKnob.style.transform = `translate3d(${clampedX * travel}px, ${clampedY * travel}px, 0)`;
    }
  };
  const pressJoystick = (event: PointerEvent): void => {
    if (joystick === null || joystickPointerId !== undefined) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    joystickPointerId = event.pointerId;
    joystick.dataset.touchActive = "true";
    try {
      joystick.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional on older iOS versions.
    }
    updateJoystick(event);
  };
  const releaseJoystick = (event: PointerEvent): void => {
    if (joystickPointerId !== event.pointerId) return;
    event.preventDefault();
    resetJoystick();
  };

  if (joystick !== null) {
    joystick.addEventListener("pointerdown", pressJoystick);
    joystick.addEventListener("pointermove", updateJoystick);
    joystick.addEventListener("pointerup", releaseJoystick);
    joystick.addEventListener("pointercancel", releaseJoystick);
    joystick.addEventListener("lostpointercapture", releaseJoystick);
    joystick.addEventListener("contextmenu", preventDefault);
    joystick.addEventListener("dblclick", preventDefault);
  }

  const reset = (): void => {
    touchInput.resetDirections();
    resetJoystick();
    for (const button of buttons) {
      delete button.dataset.touchActive;
      button.setAttribute("aria-pressed", "false");
    }
  };
  const resetWhenHidden = (): void => {
    if (document.visibilityState !== "visible") reset();
  };
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", resetWhenHidden);
  const gestureEvents = ["gesturestart", "gesturechange", "gestureend"] as const;
  for (const eventName of gestureEvents) document.addEventListener(eventName, preventDefault);
  document.addEventListener("dblclick", preventTouchZoom, { passive: false });

  return () => {
    for (const cleanup of cleanups) cleanup();
    window.removeEventListener("blur", reset);
    document.removeEventListener("visibilitychange", resetWhenHidden);
    if (joystick !== null) {
      joystick.removeEventListener("pointerdown", pressJoystick);
      joystick.removeEventListener("pointermove", updateJoystick);
      joystick.removeEventListener("pointerup", releaseJoystick);
      joystick.removeEventListener("pointercancel", releaseJoystick);
      joystick.removeEventListener("lostpointercapture", releaseJoystick);
      joystick.removeEventListener("contextmenu", preventDefault);
      joystick.removeEventListener("dblclick", preventDefault);
    }
    for (const eventName of gestureEvents) document.removeEventListener(eventName, preventDefault);
    document.removeEventListener("dblclick", preventTouchZoom);
    reset();
  };
}

function preventDefault(event: Event): void {
  event.preventDefault();
}

function preventTouchZoom(event: MouseEvent): void {
  if (navigator.maxTouchPoints > 0) event.preventDefault();
}

function parseDirection(value: string | undefined): TouchDirection | undefined {
  return TOUCH_DIRECTIONS.find((direction) => direction === value);
}

function parseCommand(value: string | undefined): TouchCommand | undefined {
  return value === "action" || value === "pause" ? value : undefined;
}
