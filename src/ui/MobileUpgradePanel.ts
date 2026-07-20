import { formatCurrency } from "../game/economy/economyMath";
import type { ProgressionPurchaseView } from "../game/types/game";

export class MobileUpgradePanel {
  private readonly root: HTMLElement;
  private readonly badge: HTMLElement;
  private readonly name: HTMLElement;
  private readonly description: HTMLElement;
  private readonly cost: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly progress: HTMLElement;
  private readonly step: HTMLElement;
  private handler?: () => void;
  private pulseTimer?: number;
  private chapterId = 1;

  public constructor(documentRoot: Document = document) {
    this.root = requireElement(documentRoot, "#mobile-upgrade-panel");
    this.badge = requireElement(this.root, "[data-mobile-upgrade-badge]");
    this.name = requireElement(this.root, "[data-mobile-upgrade-name]");
    this.description = requireElement(this.root, "[data-mobile-upgrade-description]");
    this.cost = requireElement(this.root, "[data-mobile-upgrade-cost]");
    this.button = requireElement<HTMLButtonElement>(this.root, "[data-mobile-upgrade-button]");
    this.progress = requireElement(this.root, "[data-mobile-upgrade-progress]");
    this.step = requireElement(this.root, "[data-mobile-upgrade-step]");
    this.button.addEventListener("click", this.handlePurchase);
    this.root.hidden = false;
  }

  public onPurchase(handler: () => void): void {
    this.handler = handler;
  }

  public setProgression(view: ProgressionPurchaseView | undefined): void {
    const overallProgress = Math.min(1, Math.max(0, view?.overallProgress ?? 1));
    this.progress.style.width = `${Math.round(overallProgress * 100)}%`;

    if (view === undefined) {
      this.badge.textContent = `CHAPTER ${this.chapterId} · 30단계 완성`;
      this.name.textContent = "챕터 피날레 완성";
      this.description.textContent = "완성 화면의 버튼을 누르면 다음 챕터로 이동해요!";
      this.cost.textContent = "완성!";
      this.button.textContent = "완료";
      this.button.disabled = true;
      this.step.textContent = "30단계 · 5/5";
      return;
    }

    const purchase = view.purchase;
    this.chapterId = view.chapterId;
    this.badge.textContent = `CH.${view.chapterId} · ${purchase.stage}단계`;
    this.name.textContent = purchase.name;
    this.description.textContent = purchase.description;
    this.cost.textContent = formatCurrency(purchase.cost);
    this.cost.dataset.affordable = String(view.canAfford);
    this.button.textContent = view.canAfford ? "구매하기" : "금액 부족";
    this.button.disabled = !view.canPurchase;
    this.step.textContent = `${purchase.stage}단계 · ${purchase.step - 1}/${purchase.stepCount}`;
  }

  public pulse(success: boolean): void {
    window.clearTimeout(this.pulseTimer);
    this.root.dataset.pulse = success ? "success" : "failure";
    this.pulseTimer = window.setTimeout(() => delete this.root.dataset.pulse, 320);
  }

  public destroy(): void {
    window.clearTimeout(this.pulseTimer);
    this.button.removeEventListener("click", this.handlePurchase);
    this.root.hidden = true;
    delete this.root.dataset.pulse;
    this.handler = undefined;
  }

  private readonly handlePurchase = (event: MouseEvent): void => {
    event.preventDefault();
    if (!this.button.disabled) this.handler?.();
  };
}

function requireElement<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing mobile upgrade element: ${selector}`);
  return element;
}
