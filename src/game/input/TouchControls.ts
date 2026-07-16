export const TOUCH_DIRECTIONS = ["up", "down", "left", "right"] as const;
export type TouchDirection = (typeof TOUCH_DIRECTIONS)[number];
export type TouchCommand = "action" | "pause";

type CommandListener = () => void;

export class TouchInputState {
  private readonly directionByPointer = new Map<number, TouchDirection>();
  private readonly commandListeners = new Map<TouchCommand, Set<CommandListener>>();

  public pressDirection(pointerId: number, direction: TouchDirection): void {
    this.directionByPointer.set(pointerId, direction);
  }

  public releasePointer(pointerId: number): void {
    this.directionByPointer.delete(pointerId);
  }

  public isDirectionDown(direction: TouchDirection): boolean {
    for (const activeDirection of this.directionByPointer.values()) {
      if (activeDirection === direction) return true;
    }
    return false;
  }

  public resetDirections(): void {
    this.directionByPointer.clear();
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
    const preventContextMenu = (event: Event): void => event.preventDefault();

    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", preventContextMenu);
    cleanups.push(() => {
      button.removeEventListener("pointerdown", press);
      button.removeEventListener("pointerup", release);
      button.removeEventListener("pointercancel", release);
      button.removeEventListener("lostpointercapture", release);
      button.removeEventListener("contextmenu", preventContextMenu);
      for (const pointerId of activePointerIds) touchInput.releasePointer(pointerId);
      activePointerIds.clear();
      setPressed(false);
    });
  }

  const reset = (): void => {
    touchInput.resetDirections();
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

  return () => {
    for (const cleanup of cleanups) cleanup();
    window.removeEventListener("blur", reset);
    document.removeEventListener("visibilitychange", resetWhenHidden);
    reset();
  };
}

function parseDirection(value: string | undefined): TouchDirection | undefined {
  return TOUCH_DIRECTIONS.find((direction) => direction === value);
}

function parseCommand(value: string | undefined): TouchCommand | undefined {
  return value === "action" || value === "pause" ? value : undefined;
}
