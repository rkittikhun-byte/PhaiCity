/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Smooth entrances and exits for windows, screens and menus. Entrances are plain CSS animations that run
// when an element appears (css/style.css, "Motion"); exits need script, because an element that is hidden
// at once has no time to animate. hide() plays the exit animation, then hides the element.

const LEAVE_CLASS = "motionLeave";
const LEAVE_MS = 200;
const pending = new WeakMap<HTMLElement, number>();

function reducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function cancelLeave(element: HTMLElement): void {
  const timer = pending.get(element);
  if (timer !== undefined) window.clearTimeout(timer);
  pending.delete(element);
  element.classList.remove(LEAVE_CLASS);
}

/** True when the element is on screen and not on its way out. */
export function isShown(element: HTMLElement): boolean {
  return !element.hidden && element.style.display !== "none" && !element.classList.contains(LEAVE_CLASS) &&
    getComputedStyle(element).display !== "none";
}

/**
 * Shows the element (its CSS entrance animation runs), cancelling an exit still in progress.
 * Elements hidden by a class need an inline display; elements hidden by the hidden attribute do not.
 */
export function show(element: HTMLElement, display?: string): void {
  cancelLeave(element);
  element.hidden = false;
  element.style.display = display ?? "";
}

/** Plays the exit animation, then hides the element the same way show() revealed it. */
export function hide(element: HTMLElement, useHiddenAttribute = false): void {
  if (!isShown(element)) return;
  const finish = (): void => {
    pending.delete(element);
    element.classList.remove(LEAVE_CLASS);
    if (useHiddenAttribute) {
      element.style.display = "";
      element.hidden = true;
    } else {
      element.style.display = "none";
    }
  };
  if (reducedMotion()) {
    finish();
    return;
  }
  element.classList.add(LEAVE_CLASS);
  pending.set(element, window.setTimeout(finish, LEAVE_MS));
}

/** Numbers the matching children (--i) so CSS can stagger their entrance one after another. */
export function stagger(root: ParentNode, selector: string): void {
  root.querySelectorAll<HTMLElement>(selector).forEach((element, index) => element.style.setProperty("--i", String(index)));
}
